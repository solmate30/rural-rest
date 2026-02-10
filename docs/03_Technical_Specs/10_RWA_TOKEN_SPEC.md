# RWA Token Specification (Real World Asset Tokenization)
> Created: 2026-02-10 16:00
> Last Updated: 2026-02-10 16:00

## 1. RWA 토큰화 개요

### 1.1. 빈집 자산 토큰화의 정의
농촌 빈집(실물 부동산)의 경제적 가치를 Solana SPL Token으로 분할 표현하여, 다수의 투자자가 소액으로 소유권에 참여할 수 있게 하는 것.

### 1.2. 법적 구조
```
빈집 소유자 (Host)
    │
    ├── SPV (특수목적회사) 설립
    │     └── 빈집 소유권 이전 (또는 수익권 위탁)
    │
    ├── SPL Token 발행 (SPV 명의)
    │     └── 토큰 = SPV 지분 (수익 배당 청구권)
    │
    └── 투자자가 USDC로 토큰 매수
          └── 임대 수익 발생 시 토큰 보유 비율로 배당
```

### 1.3. 한국 규제 프레임워크
| 규제 | 내용 | 대응 |
|------|------|------|
| 자본시장법 | RWA 토큰이 "증권"에 해당할 가능성 높음 | STO 가이드라인 준수, 증권신고서 제출 |
| 금융위원회 토큰증권 가이드라인 | 분산원장 기반 증권의 발행/유통 규정 | 인가 투자중개업자(혁신금융서비스)와 협력 |
| 부동산 실거래신고법 | 부동산 거래 신고 의무 | SPV 설립 시 법무사 자문 |
| 외국환거래법 | 외국인 투자 시 적용 가능 | 법률 자문 확인 |

---

## 2. 토큰 설계

### 2.1. SPL Token Standard 활용
- Solana SPL Token Standard (Fungible Token)
- 각 빈집마다 별도의 Token Mint 생성
- Decimals: 0 (정수 단위 토큰)

### 2.2. 토큰 메타데이터
```json
{
    "name": "Rural Rest - 양평 돌담 고택",
    "symbol": "YANG-001",
    "description": "경기도 양평군 소재 전통 돌담 고택의 분할 소유권 토큰",
    "image": "https://arweave.net/xxx",
    "attributes": {
        "location": "경기도 양평군 서종면",
        "valuation_krw": 500000000,
        "total_supply": 10000,
        "property_type": "한옥",
        "renovation_date": "2025-08",
        "listing_id": "uuid-xxx"
    }
}
```

### 2.3. 최소 투자 단위
- 토큰 1개 = 감정가 / 총 발행량
- 예: 감정가 5억원, 10,000 토큰 -> 토큰 1개 = 50,000원 (약 33.5 USDC)
- 최소 매수: 1 토큰 (~50,000원)

### 2.4. 토큰 발행 상한
- 1 빈집 = 고정 토큰 수량 (재발행 불가)
- 추가 발행은 재감정 + 거버넌스 투표 후에만 가능 (Phase 4)

---

## 3. Anchor Program 설계

### 3.1. State Accounts

```rust
#[account]
pub struct PropertyToken {
    pub authority: Pubkey,        // 관리자 (플랫폼)
    pub listing_id: String,       // DB listing ID
    pub token_mint: Pubkey,       // SPL Token Mint
    pub total_supply: u64,        // 총 발행량
    pub tokens_sold: u64,         // 판매된 수량
    pub valuation_krw: u64,       // 감정가 (KRW)
    pub price_per_token_usdc: u64, // 토큰당 USDC 가격 (6 decimals)
    pub status: PropertyStatus,   // draft/active/paused/closed
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct InvestorPosition {
    pub investor: Pubkey,         // 투자자 지갑
    pub property_mint: Pubkey,    // 어떤 빈집 토큰인지
    pub token_amount: u64,        // 보유 토큰 수
    pub total_invested_usdc: u64, // 총 투자 금액
    pub claimed_dividends: u64,   // 누적 수령 배당금
    pub bump: u8,
}

#[account]
pub struct DividendPool {
    pub property_mint: Pubkey,
    pub period: String,           // "2026-01" 형태
    pub total_amount_usdc: u64,   // 해당 기간 총 배당금
    pub amount_per_token: u64,    // 토큰당 배당금
    pub distributed: bool,
    pub created_at: i64,
    pub bump: u8,
}
```

### 3.2. Instructions

| Instruction | 호출자 | 설명 |
|------------|--------|------|
| `initialize_property` | Authority (관리자) | 새 빈집 토큰 생성, SPL Token Mint 초기화 |
| `purchase_tokens` | 투자자 | USDC 지불 -> 토큰 수령, InvestorPosition 업데이트 |
| `distribute_dividends` | Authority (서버) | 특정 기간 배당금 풀 생성, 토큰당 배당금 계산 |
| `claim_dividend` | 투자자 | 미수령 배당금 수령 (USDC 전송) |
| `redeem_tokens` | 투자자 | 토큰 반환 -> USDC 환매 (조건부) |
| `pause_property` | Authority | 비상 시 토큰 거래/배당 일시 중지 |

### 3.3. PDA 구조
```
PropertyToken PDA:   seeds = [property_mint, "property"]
InvestorPosition PDA: seeds = [property_mint, investor_pubkey, "investor"]
DividendPool PDA:    seeds = [property_mint, period_bytes, "dividend"]
Escrow Vault PDA:    seeds = [property_mint, "vault"]
```

---

## 4. 배당 메커니즘

### 4.1. 임대 수익 계산
```
월별 배당 대상 수익 계산:
1. 해당 빈집의 월간 예약 매출 합산 (bookings.totalPrice WHERE listingId = X)
2. 플랫폼 수수료 차감 (10%)
3. 운영비 차감 (유지보수, 청소, 관리비 -- 호스트 보고 기반)
4. 호스트 운영 보상 차감 (순수익의 15%)
5. 순수익 = 투자자 배당 대상 금액
```

### 4.2. 배당 주기
- **기본**: 월간 (매월 1일 전월 수익 정산)
- **최소 배당 금액**: 토큰당 0.01 USDC 미만이면 다음 달로 이월

### 4.3. 자동 배당 분배 로직
```
distribute_dividends(property_mint, period, total_amount):
  1. total_supply = PropertyToken.total_supply
  2. amount_per_token = total_amount / total_supply
  3. DividendPool 계정 생성 (period, amount_per_token)
  4. 각 투자자가 claim_dividend()로 개별 수령

claim_dividend(investor):
  1. InvestorPosition 조회 -> token_amount
  2. 미수령 배당 기간 확인
  3. claimable = sum(amount_per_token * token_amount) for unclaimed periods
  4. USDC 전송: Vault -> Investor
  5. InvestorPosition.claimed_dividends 업데이트
```

### 4.4. 배당금 Claim UI
- "Claim" 버튼 클릭 -> 지갑 서명 -> USDC 수령
- 미수령 배당금 누적 표시 ("3개월 미수령: 12,300 USDC")
- 자동 Claim 옵션 (Phase 4 검토)

---

## 5. 토큰 거래 (Secondary Market)

### 5.1. P2P 전송 허용 범위
- Phase 3: 직접 전송(P2P) 허용하되, 양쪽 모두 KYC 완료 지갑만 허용
- Transfer Hook 또는 Token Extensions의 `TransferFeeConfig` 활용

### 5.2. 향후 DEX/마켓플레이스 연동
- Phase 4: OpenBook DEX 또는 Tensor 마켓플레이스 상장 검토
- 유동성 풀 생성 시 USDC/RWA-Token 페어

### 5.3. 거래 제한 조건
- KYC 미완료 지갑으로의 전송 차단
- 일일 거래 한도 설정 (비정상 거래 방지)
- 락업 기간 중 전송 차단

---

## 6. DB Schema

### 6.1. `rwa_tokens` 테이블
```typescript
export const rwaTokens = sqliteTable("rwa_tokens", {
    id: text("id").primaryKey(),
    listingId: text("listing_id").notNull().references(() => listings.id),
    tokenMint: text("token_mint").notNull().unique(),
    symbol: text("symbol").notNull(),           // e.g. "YANG-001"
    totalSupply: integer("total_supply").notNull(),
    tokensSold: integer("tokens_sold").default(0),
    pricePerTokenUsdc: real("price_per_token_usdc").notNull(),
    valuationKrw: integer("valuation_krw").notNull(),
    status: text("status", { enum: ["draft", "under_review", "approved", "active", "paused", "closed"] }).notNull(),
    createdAt: text("created_at").default(sql`(current_timestamp)`),
    updatedAt: text("updated_at"),
});
```

### 6.2. `rwa_investments` 테이블
```typescript
export const rwaInvestments = sqliteTable("rwa_investments", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id),
    tokenMintAddress: text("token_mint_address").notNull(),
    amount: integer("amount").notNull(),
    totalInvestedUsdc: real("total_invested_usdc").notNull(),
    purchaseTxSignature: text("purchase_tx_signature").notNull(),
    createdAt: text("created_at").default(sql`(current_timestamp)`),
});
```

### 6.3. `rwa_dividends` 테이블
```typescript
export const rwaDividends = sqliteTable("rwa_dividends", {
    id: text("id").primaryKey(),
    tokenMintAddress: text("token_mint_address").notNull(),
    period: text("period").notNull(),           // "2026-01"
    totalAmountUsdc: real("total_amount_usdc").notNull(),
    amountPerToken: real("amount_per_token").notNull(),
    distributed: integer("distributed", { mode: "boolean" }).default(false),
    txSignature: text("tx_signature"),
    createdAt: text("created_at").default(sql`(current_timestamp)`),
});
```

---

## 7. 법률 및 컴플라이언스

### 7.1. 금융위원회 STO 규제 대응
- 증권신고서 제출 또는 소액공모 면제 요건 확인
- 인가 투자중개업자(혁신금융서비스 지정) 파트너십 체결
- 토큰 증권 발행인 등록

### 7.2. KYC/AML 요구사항
- 투자 전 KYC 필수 (신분증, 주소 확인)
- AML 모니터링: 의심 거래 보고 (STR) 시스템 구축
- KYC 파트너: Sumsub, Persona 등 검토

### 7.3. 투자자 적격성 확인
- 일반 투자자: 소액공모 면제 범위 내 (1인당 상한 설정)
- 적격 투자자(Accredited Investor): 상한 완화
- 외국인 투자자: 외국환거래법 준수 여부 확인

---

## 8. Related Documents
- **Foundation**: [Blockchain Vision](../01_Concept_&_Design/08_BLOCKCHAIN_VISION.md) - RWA 전략적 배경
- **Foundation**: [Blockchain Roadmap](../01_Concept_&_Design/09_BLOCKCHAIN_ROADMAP.md) - Phase 3 RWA 로드맵
- **Prototype**: [RWA Dashboard Review](../02_UI_Screens/08_RWA_DASHBOARD_REVIEW.md) - 투자 대시보드 UI
- **Specs**: [Blockchain Infra Spec](./08_BLOCKCHAIN_INFRA_SPEC.md) - Anchor Program 아키텍처
- **Logic**: [RWA Tokenization Logic](../04_Logic_&_Progress/12_RWA_TOKENIZATION_LOGIC.md) - 배당/환매 비즈니스 로직
- **Test**: [Blockchain Test Scenarios](../05_QA_&_Validation/06_BLOCKCHAIN_TEST_SCENARIOS.md) - RWA 테스트 케이스
