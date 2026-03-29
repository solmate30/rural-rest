# 13. RWA 온체인 / 오프체인 데이터 관리 정책

**작성일: 2026-03-25**

---

## 1. 데이터 관리 원칙

Rural Rest RWA는 **온체인이 Source of Truth**, 오프체인 DB는 조회 성능과 UX를 위한 캐시 레이어다.
온체인과 DB가 불일치할 경우 온체인 데이터가 우선한다.

---

## 2. 온체인 데이터 (Solana / Anchor PDA)

| 데이터 | PDA / Account | 설명 |
|--------|--------------|------|
| 부동산 토큰 메타 | `PropertyToken` (seeds: `["property", listingId]`) | totalSupply, tokensSold, status, tokenMint, fundingGoal |
| 투자자 포지션 | `InvestorPosition` (seeds: `["investor_position", listingId, investor_pubkey]`) | tokenAmount, investedUsdc |
| 펀딩 볼트 | `FundingVault` (seeds: `["funding_vault", listingId]`) | USDC 에스크로 잔액 |
| 토큰 민트 | `tokenMint` (Token-2022) | RWA 토큰 공급량, mint authority |

**온체인에서만 확인 가능한 것:**
- 실제 토큰 보유량 (투자자 ATA 잔액)
- 에스크로 USDC 잔액
- mint authority 소각 여부
- 트랜잭션 서명 유효성

---

## 3. 오프체인 데이터 (Turso / SQLite DB)

| 테이블 | 역할 | 온체인 동기화 여부 |
|--------|------|------------------|
| `listings` | 매물 정보, 사진, 설명 | 없음 (오프체인 전용) |
| `rwa_tokens` | 토큰 메타 캐시 (`tokensSold`, `status` 등) | 수동 동기화 필요 |
| `rwa_investments` | 투자자별 구매 내역 | `purchaseTx`로 온체인 검증 가능 |
| `rwa_dividends` | 배당 내역 | `claimTx`로 온체인 검증 가능 |

**오프체인에만 있는 것:**
- 매물 사진, 설명, 개보수 이력
- 한국어 매물명, 위치 정보
- 배당 계산 로직 및 월별 배당 기록
- 투자자 포트폴리오 UI용 집계 데이터

---

## 4. 나중에 고민해야 할 것들

### 4-1. 온체인 동기화 자동화
- **문제**: record-purchase API 실패 시 tokensSold 불일치
- **후보 솔루션**:
  - Helius Webhook으로 온체인 이벤트 감지 → DB 자동 동기화
  - 주기적 크론잡으로 온체인 PDA 읽어서 DB 보정
  - 클라이언트에서 실패 시 재시도 로직 추가

### 4-2. 인증 / 지갑 연동
- **문제**: 현재 지갑 주소(walletAddress)와 Better Auth 계정(userId) 이중 구조
- **후보 솔루션**:
  - Sign-In With Solana (SIWS) — 지갑 서명으로 Better Auth 세션 발급
  - walletAddress → userId 매핑 테이블 추가
  - 통합 아이덴티티: 지갑이 계정의 primary key

### 4-3. tokensSold Source of Truth
- **문제**: DB의 tokensSold와 온체인 `PropertyToken.tokens_sold`가 다를 수 있음
- **후보 솔루션**:
  - invest 페이지 로드 시 온체인에서 직접 읽기 (RPC 비용 발생)
  - Helius RPC 캐시 활용
  - 온체인 읽기는 상세 페이지에서만, 목록 페이지는 DB 사용

### 4-4. 펀딩 완료 자동 처리
- **문제**: funding → funded → active 상태 전환이 수동
- **후보 솔루션**:
  - tokensSold >= totalSupply 감지 시 `release_funds` 자동 호출
  - 관리자 알림 → 수동 승인 후 처리

### 4-4. 환율 (KRW/USDC)
- **문제**: KRW_PER_USDC = 1350 하드코딩
- **후보 솔루션**:
  - Pyth Network 오라클 연동
  - 한국은행 OPEN API 일 1회 갱신
  - 투자 시점 환율 고정 (pricePerTokenUsdc 기준)

### 4-6. 배당금 분배 온체인화
- **문제**: 현재 배당은 오프체인 DB에서 계산 후 관리자가 수동 처리
- **후보 솔루션**:
  - `distribute_dividends` 인스트럭션 구현
  - 숙박 수익 → USDC → 자동 분배 스마트 컨트랙트
  - 투자자가 `claim_dividend`로 직접 수령

### 4-7. 보안: walletAddress 스푸핑
- **문제**: `/my-investments?wallet=xxx`는 URL 파라미터 위조 가능
- **현재**: 파일럿 데모 수준이라 허용
- **후보 솔루션**:
  - SIWS — 지갑 서명으로 세션 발급
  - 지갑 연결 + 서명 → JWT 발급 후 쿠키 저장

---

## 6. 단기 보정 스크립트

온체인과 DB 불일치 시 수동 보정:

```bash
# tokensSold 수동 업데이트
sqlite3 /home/mei/solana/rural-rest/web/local.db \
  "UPDATE rwa_tokens SET tokens_sold = <온체인값> WHERE listing_id = '<listingId>';"

# 기존 투자 레코드에 wallet_address 추가
sqlite3 /home/mei/solana/rural-rest/web/local.db \
  "UPDATE rwa_investments SET wallet_address = '<pubkey>' WHERE wallet_address = '';"
```
