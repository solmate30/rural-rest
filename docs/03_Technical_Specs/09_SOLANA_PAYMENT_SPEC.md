# Solana Payment Specification
> Created: 2026-02-10 16:00
> Last Updated: 2026-02-10 16:00

## 1. 결제 수단 확장 전략

### 1.1. 기존 결제 유지
- Stripe (카드 결제) 및 PayPal은 기존대로 유지
- `bookings.paymentMethod` 필드 확장: `'stripe' | 'paypal' | 'sol' | 'usdc'`

### 1.2. 신규 결제 옵션
| 토큰 | Mint Address (Mainnet) | 용도 |
|------|----------------------|------|
| SOL | Native | 소액 결제, 가스비 |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 안정적 결제 (스테이블코인) |

### 1.3. 결제 수단 선택 UI 흐름
```
Booking Flow Step 4
  ├── Tab: "Card" (기존 Stripe/PayPal)
  └── Tab: "Crypto"
        ├── SOL 선택 -> SOL 금액 표시
        └── USDC 선택 -> USDC 금액 표시
```

---

## 2. 결제 흐름 (Transaction Flow)

### 2.1. SOL 결제 시퀀스
```
Guest          Client             Server             Solana
  │               │                  │                  │
  │ "Pay with SOL"│                  │                  │
  ├──────────────>│                  │                  │
  │               │ POST /api/payment/solana/create     │
  │               ├─────────────────>│                  │
  │               │                  │ create escrow PDA│
  │               │                  ├─────────────────>│
  │               │   { tx: unsigned }                  │
  │               │<─────────────────┤                  │
  │ Sign in wallet│                  │                  │
  │<──────────────┤                  │                  │
  │  (approve)    │                  │                  │
  ├──────────────>│                  │                  │
  │               │ submit signed tx │                  │
  │               ├─────────────────────────────────────>
  │               │                  │   tx confirmed   │
  │               │ POST /api/payment/solana/confirm     │
  │               ├─────────────────>│                  │
  │               │                  │ verify tx on-chain
  │               │                  ├─────────────────>│
  │               │                  │ update booking   │
  │               │  { status: confirmed }              │
  │               │<─────────────────┤                  │
  │  "결제 완료!" │                  │                  │
  │<──────────────┤                  │                  │
```

### 2.2. USDC 결제 시퀀스
SOL과 동일한 흐름이나, SPL Token Transfer 인스트럭션 사용:
- `createTransferInstruction(fromATA, toATA, owner, amount)`
- Associated Token Account(ATA) 자동 생성 처리 포함

### 2.3. 에스크로 패턴
1. Guest가 결제 시 대금이 에스크로 PDA로 전송
2. 체크인 완료 후 (또는 일정 기간 경과) 서버가 릴리스 실행
3. 릴리스 시: 플랫폼 수수료 차감 -> 호스트 지갑으로 전송
```
Guest Wallet ---(payment)---> Escrow PDA ---(release)---> Host Wallet
                                  |
                                  +----(fee)----> Treasury Wallet
```

---

## 3. 환율 처리

### 3.1. 환율 API
- **1차**: Jupiter Aggregator Price API (`https://price.jup.ag/v6/price`)
- **2차 (폴백)**: CoinGecko API
- KRW -> USD -> SOL/USDC 이중 환산 (한국원 직접 페어 부재 시)

### 3.2. 환율 고정 시간
- 결제 화면 진입 시 환율 조회 및 고정
- **유효 시간**: 5분 (만료 시 자동 재조회 + 금액 업데이트)
- 서명 시점의 환율과 고정 환율의 차이가 슬리피지 범위 초과 시 재조회 요구

### 3.3. 슬리피지 허용 범위
- SOL 결제: 1% (변동성 높음)
- USDC 결제: 0.1% (스테이블코인, 거의 변동 없음)

---

## 4. 정산 (Settlement)

### 4.1. 호스트 정산 흐름
```
1. 체크인 완료 이벤트 발생
2. 서버가 에스크로 릴리스 인스트럭션 실행
3. 에스크로 PDA에서:
   - 플랫폼 수수료 (10%) -> Treasury Wallet
   - 순 금액 (90%) -> Host Wallet
4. wallet_transactions 테이블에 정산 기록 저장
```

### 4.2. 호스트 지갑 미연결 시
- 정산 금액을 Treasury에 보관
- 호스트가 지갑을 연결하면 미정산 금액 일괄 전송
- 30일 이상 미연결 시 기존 결제 수단(은행 계좌)으로 환전 정산 검토

### 4.3. 정산 주기 및 최소 금액
- 즉시 정산 (에스크로 릴리스 즉시)
- 최소 정산 금액: 0.01 SOL 또는 1 USDC (가스비 대비 효율)

---

## 5. 환불 처리

### 5.1. 취소 정책 연동
기존 Booking State Machine의 취소 정책을 그대로 적용:
| 시점 | 환불율 | 크립토 환불 |
|------|--------|-----------|
| 체크인 7일 전 | 100% | 전액 원래 지갑으로 반환 |
| 체크인 3일 전 | 50% | 50% 반환, 50% 호스트 지갑 |
| 체크인 3일 이내 | 0% | 전액 호스트 지갑 릴리스 |

### 5.2. 환불 트랜잭션
- 에스크로가 아직 릴리스되지 않은 경우: 에스크로 PDA에서 직접 환불
- 이미 릴리스된 경우: Treasury에서 환불 실행 (호스트에게 별도 청구)

### 5.3. 부분 환불 로직
- 50% 환불 시: 에스크로 금액의 50%를 Guest에게, 나머지를 Host에게 분배
- 가스비는 플랫폼 부담 (환불 트랜잭션)

---

## 6. API Endpoints

### 6.1. `POST /api/payment/solana/create`
- **Input**: `{ bookingId, payerWallet, tokenMint, amount }`
- **Output**: `{ transaction: base64_serialized_tx, escrowPDA, expiresAt }`
- **로직**: 에스크로 생성 인스트럭션 조립 -> 미서명 트랜잭션 반환

### 6.2. `POST /api/payment/solana/confirm`
- **Input**: `{ bookingId, txSignature }`
- **Output**: `{ status: 'confirmed' | 'failed', booking }`
- **로직**: 온체인 트랜잭션 검증 -> booking 상태 업데이트

### 6.3. `GET /api/payment/solana/status/:txSignature`
- **Output**: `{ status, confirmations, blockTime, slot }`
- **로직**: RPC `getTransaction`으로 상태 조회

### 6.4. `POST /api/payment/solana/refund`
- **Input**: `{ bookingId, amount, reason }`
- **Output**: `{ refundTxSignature, status }`
- **로직**: 취소 정책 확인 -> 에스크로/Treasury에서 환불 실행

### 6.5. `GET /api/payment/solana/rate`
- **Output**: `{ sol_krw, usdc_krw, updatedAt }`
- **로직**: Jupiter/CoinGecko에서 환율 조회 (30초 캐시)

---

## 7. DB Schema: `wallet_transactions` 테이블

```typescript
export const walletTransactions = sqliteTable("wallet_transactions", {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").references(() => bookings.id),
    txSignature: text("tx_signature").notNull().unique(),
    type: text("type", { enum: ["payment", "refund", "settlement", "dividend"] }).notNull(),
    fromWallet: text("from_wallet").notNull(),
    toWallet: text("to_wallet").notNull(),
    amount: real("amount").notNull(),
    tokenMint: text("token_mint"), // null = SOL, otherwise SPL token mint
    status: text("status", { enum: ["pending", "confirmed", "failed"] }).notNull(),
    confirmations: integer("confirmations").default(0),
    blockTime: integer("block_time"),
    createdAt: text("created_at").default(sql`(current_timestamp)`),
    confirmedAt: text("confirmed_at"),
});
```

---

## 8. Error Handling

### 8.1. 트랜잭션 실패 시나리오
| 시나리오 | 처리 |
|----------|------|
| 네트워크 오류 (RPC 불가) | 백업 RPC로 자동 전환, 사용자에게 재시도 안내 |
| 잔액 부족 | 서명 전 `getBalance` 사전 검증, 부족 시 결제 차단 |
| 사용자 서명 거부 | booking 상태 유지 (pending), "결제가 취소되었습니다" 표시 |
| 트랜잭션 드롭 | 60초 후 타임아웃, 재전송 옵션 제공 |

### 8.2. Confirmation Level
- **결제 확인**: `confirmed` 수준 (optimistic confirmation, ~400ms)
- **정산 실행**: `finalized` 수준 (absolute finality, ~6초)
- 이유: 결제 UX는 빠른 확인이 중요하나, 정산은 확실한 확정 필요

---

## 9. Related Documents
- **Foundation**: [Blockchain Roadmap](../01_Concept_&_Design/09_BLOCKCHAIN_ROADMAP.md) - Phase 1 결제 로드맵
- **Prototype**: [Wallet Connect Review](../02_UI_Screens/06_WALLET_CONNECT_REVIEW.md) - 결제 UI
- **Specs**: [Blockchain Infra Spec](./08_BLOCKCHAIN_INFRA_SPEC.md) - Payment Program 아키텍처
- **Logic**: [Solana Payment Logic](../04_Logic_&_Progress/10_SOLANA_PAYMENT_LOGIC.md) - 결제 상태 머신
- **Logic**: [Booking State Machine](../04_Logic_&_Progress/01_BOOKING_STATE_MACHINE.md) - 기존 예약 상태 머신
- **Test**: [Blockchain Test Scenarios](../05_QA_&_Validation/06_BLOCKCHAIN_TEST_SCENARIOS.md) - 결제 테스트 케이스
