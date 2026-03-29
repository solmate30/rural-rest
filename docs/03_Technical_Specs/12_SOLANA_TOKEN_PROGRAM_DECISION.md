# Solana 토큰 프로그램 선택 근거

- 작성일: 2026-03-25

---

## 결정 사항

RWA 토큰은 **Token-2022 (Token Extensions)** 프로그램으로 발행한다.
USDC 결제는 기존 **SPL Token** 프로그램을 사용한다.

---

## Token-2022를 선택한 이유

Token-2022는 Solana 공식 신규 표준이며, 기존 SPL Token의 상위 호환이다.

RWA 토큰화에 유리한 확장 기능:
- **Transfer Fee**: 토큰 전송 시 수수료 자동 차감 (운영비 처리에 활용 가능)
- **Metadata Extension**: 온체인 메타데이터 저장 (매물 정보 연결)
- **Interest-Bearing**: 이자 발생 토큰 구현 가능

현재 구현에서 확장 기능을 직접 사용하지 않더라도, 추후 확장을 위해 Token-2022로 시작하는 것이 올바른 방향이다.

---

## USDC에 SPL Token을 유지하는 이유

devnet USDC(`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`)는 Circle이 SPL Token으로 발행한 민트다. 외부 발행 토큰의 프로그램은 변경할 수 없다.

**핵심 규칙**: 토큰 계정(ATA)과 CPI 전송 시 반드시 해당 민트를 발행한 프로그램과 일치해야 한다. 불일치 시 트랜잭션 시뮬레이션 실패.

---

## 구현 방식

Anchor `TokenInterface`를 사용해 두 프로그램을 단일 인터페이스로 처리하되, 계정별로 분리:

```rust
// lib.rs — 모든 instruction struct에 적용
pub token_program: Interface<'info, TokenInterface>,      // Token-2022 (RWA 민트)
pub usdc_token_program: Interface<'info, TokenInterface>, // SPL Token  (USDC)
```

```ts
// 클라이언트 (InitializePropertyButton.tsx)
.accounts({
    tokenProgram: TOKEN_2022_PROGRAM_ID,  // RWA 토큰 민트 생성
    usdcTokenProgram: TOKEN_PROGRAM_ID,   // USDC 볼트 및 전송
})
```

---

## 영향 범위

| Instruction | token_program | usdc_token_program |
|---|---|---|
| initialize_property | RWA 민트 생성 | funding_vault, usdc_vault 생성 |
| purchase_tokens | investor_rwa_account, mint_to | USDC 전송, funding_vault |
| release_funds | — | funding_vault → 운영자 |
| refund | — | funding_vault → 투자자 |
| distribute_monthly_revenue | — | authority → usdc_vault |
| claim_dividend | — | usdc_vault → 투자자 |
