# RWA 스마트 컨트랙트 보안 명세

- 작성일: 2026-03-25 00:00
- 최종 수정: 2026-03-25 00:00
- 담당: 개발팀

---

## 1. 개요

Rural Rest RWA 프로그램(`rural_rest_rwa`) Anchor 스마트 컨트랙트의 보안 설계를 정의한다.
Program ID: `EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR` (Devnet)

---

## 2. 보안 위협 목록 및 대응

### 2-1. 발행자 자기투자 (Authority Self-Investment)

**위협:** RWA 토큰을 발행한 운영자(property authority)가 본인이 발행한 토큰에 직접 투자
**위험도:** High

**악용 시나리오:**
- 펀딩률 조작: 소액으로 자기 매물 투자 → 통계 부풀리기
- 배당 자기 수령: Active 상태 전환 후 자신에게 배당 지급
- 규제 위반: 증권형 토큰 자기거래는 자본시장법상 시세조종 해당 가능

**대응 방식:** 온체인 제약 (constraint)

```rust
// PurchaseTokens 계정 구조
#[account(
    mut,
    constraint = investor.key() != property_token.authority
        @ RwaError::AuthorityCannotInvest,
)]
pub investor: Signer<'info>,
```

**효과:** 트랜잭션 서명자가 해당 매물 authority와 동일하면 즉시 실패 (에러코드 6009)
**우회 불가:** 온체인 검증이므로 프론트엔드 우회 불가

---

### 2-2. 자금 이중 인출 (Release Funds Double Execution)

**위협:** `release_funds` 명령을 두 번 호출하여 escrow vault에서 자금을 두 번 인출
**위험도:** Critical

**악용 시나리오:**
- 첫 번째 호출: Funding → Funded 상태로 전환, 자금 인출 성공
- 두 번째 호출: 상태가 이미 Funded이므로 조건 재검증 없이 재인출 (버그 상태에서)

**대응 방식:** 상태 기반 사전 검증

```rust
pub fn release_funds(ctx: Context<ReleaseFunds>, listing_id: String) -> Result<()> {
    let pt = &mut ctx.accounts.property_token;

    // 이중 실행 방지: Funding 상태에서만 실행 가능
    require!(pt.status == PropertyStatus::Funding, RwaError::InvalidStatus);

    // 완판 OR (기한 경과 + 최소 목표 달성) 조건 확인
    let is_sold_out = pt.tokens_sold >= pt.total_supply;
    let now = Clock::get()?.unix_timestamp;
    let deadline_passed = pt.funding_deadline > 0 && now >= pt.funding_deadline;
    let goal_reached = if pt.min_funding_bps > 0 {
        pt.tokens_sold * 10000 >= pt.total_supply * (pt.min_funding_bps as u64)
    } else {
        true
    };
    require!(is_sold_out || (deadline_passed && goal_reached), RwaError::ReleaseNotAvailable);

    // 상태를 Funded로 변경 (재진입 방지)
    pt.status = PropertyStatus::Funded;
    // ... 자금 이체
}
```

**효과:** 상태가 Funding이 아닌 경우 즉시 실패 → 두 번째 호출 불가

---

### 2-3. 배당 청구 언더플로우 (Claim Dividend Underflow)

**위협:** `claim_dividend` 호출 시 `pending_dividend_usdc`가 0인 상태에서 감산 → 정수 언더플로우
**위험도:** Medium (Rust checked arithmetic으로 패닉 발생)

**기존 코드 문제:**
```rust
// 버그: pending_dividend_usdc = 0일 때 언더플로우 가능
ip.pending_dividend_usdc = ip.pending_dividend_usdc
    .checked_sub(ip.pending_dividend_usdc)
    .ok_or(RwaError::MathOverflow)?;
```

**대응 방식:** 명시적 잔액 검증

```rust
pub fn claim_dividend(...) -> Result<()> {
    let ip = &mut ctx.accounts.investor_position;

    // 명시적 검증: 청구 가능 금액이 0이면 즉시 실패
    require!(ip.pending_dividend_usdc > 0, RwaError::NoPendingDividend);

    let amount = ip.pending_dividend_usdc;
    ip.pending_dividend_usdc = 0;
    // ... 이체
}
```

**효과:** `NoPendingDividend` 에러 반환 (에러코드 6003)

---

### 2-4. 민트 권한 잔존 (Mint Authority Not Revoked)

**위협:** `activate_property` 이후에도 mint authority가 남아있어 추가 토큰 발행 가능
**위험도:** Critical

**악용 시나리오:**
- 펀딩 완료 후 authority가 추가 토큰을 임의 발행
- 기존 투자자의 지분 희석 (dilution attack)
- 토큰 총공급량 조작

**대응 방식:** `activate_property` 실행 시 mint authority 영구 폐기

```rust
pub fn activate_property(ctx: Context<ActivateProperty>, listing_id: String) -> Result<()> {
    // ... 상태를 Active로 전환

    // Mint authority 영구 폐기: 이후 추가 발행 불가
    let set_auth_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        SetAuthority {
            current_authority: ctx.accounts.property_token.to_account_info(),
            account_or_mint: ctx.accounts.token_mint.to_account_info(),
        },
        &[&[b"property", listing_id.as_bytes(), &[ctx.accounts.property_token.bump]]],
    );
    set_authority(set_auth_ctx, AuthorityType::MintTokens, None)?;

    Ok(())
}
```

**효과:** `AuthorityType::MintTokens`를 `None`으로 설정 → 영구 불가역 폐기
**검증:** `spl-token display <MINT>` 명령으로 "Mint authority: (not set)" 확인 가능

---

## 3. 에러 코드 목록

| 코드 | 이름 | 메시지 |
|------|------|--------|
| 6000 | `InsufficientTokenSupply` | Insufficient token supply remaining. |
| 6001 | `ExceedsInvestorCap` | Exceeds individual investor cap (10%). |
| 6002 | `MathOverflow` | Math overflow. |
| 6003 | `NoPendingDividend` | No pending dividend to claim. |
| 6004 | `Unauthorized` | Unauthorized. |
| 6005 | `InvalidStatus` | Invalid property status for this operation. |
| 6006 | `FundingExpired` | Funding deadline has passed. |
| 6007 | `RefundNotAvailable` | Refund conditions not met: goal was reached or deadline has not passed. |
| 6008 | `AlreadyRefunded` | This position has already been refunded. |
| 6009 | `InvalidDeadline` | Deadline must be in the future. |
| 6010 | `ReleaseNotAvailable` | Release conditions not met. |
| 6011 | `AuthorityCannotInvest` | The property authority cannot invest in their own property. |

---

## 4. 상태 전환 다이어그램

```
initialize_property
        |
        v
   [Funding] ──── purchase_tokens ──── [Funding]
        |
        |── 완판 OR (기한 + 목표 달성) → release_funds
        |                                      |
        |                                      v
        |                                 [Funded]
        |                                      |
        |                              activate_property
        |                                      |
        |                                      v
        |                                  [Active] ──── distribute_dividend
        |                                                      |
        |                                                 claim_dividend
        |
        |── 기한 경과 + 목표 미달 → [Failed] ──── refund_investor
```

---

## 5. 투자자 개인 한도

- 단일 투자자 최대 보유: 총공급량의 **10%** (ExceedsInvestorCap)
- 계산: `(position.token_amount + requested) * 10 > total_supply`
- 목적: 소수 대형 투자자에 의한 지배 방지

---

## 6. 온체인 vs 오프체인 검증 분리

| 검증 항목 | 온체인 (Anchor) | 오프체인 (프론트엔드) |
|-----------|-----------------|----------------------|
| 발행자 자기투자 금지 | constraint | UI 버튼 비활성화 (추가 UX) |
| 토큰 잔량 초과 | require! | input max 제한 |
| KYC 완료 여부 | - | `isKycCompleted` 체크 |
| 투자자 한도 10% | require! | - |
| 상태 유효성 | require! | 상태 배지 표시 |

**원칙:** 보안 검증은 반드시 온체인에서 수행. 프론트엔드 검증은 UX 보조 목적.

---

## 7. 향후 개선 과제

| 항목 | 우선순위 | 설명 |
|------|----------|------|
| Pyth 오라클 KRW/USDC 환율 | High | 현재 KRW_PER_USDC = 1350 하드코딩 |
| 멀티시그 authority | Medium | 단일 authority 키 손실 위험 대비 |
| 외부 감사 (Audit) | High | 메인넷 배포 전 Certik/OtterSec 등 |
| 이벤트 로깅 (emit!) | Medium | 투명성 및 인덱싱 목적 |
| 정산 수수료 국고 계정 | Low | 플랫폼 1% 수수료 자동 분리 |
