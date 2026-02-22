# RWA Tokenization Business Logic
> Created: 2026-02-10 16:30
> Last Updated: 2026-02-10 16:30

## 1. Context

### 1.1. 기존 Roadmap 연계
기존 "Village Governance" 비전을 블록체인으로 구현하는 첫 단계. 빈집 소유권 토큰화를 통해 글로벌 투자 자본이 한국 농촌 재생에 직접 참여할 수 있도록 한다.

### 1.2. 핵심 원칙
- **투명성**: 임대 수익, 운영비, 배당 내역이 온체인에 공개
- **자동화**: 배당 분배를 스마트 컨트랙트로 자동 실행
- **접근성**: 최소 5만원(~33 USDC)부터 투자 가능

---

## 2. 토큰화 프로세스 (Tokenization Pipeline)

### 2.1. 전체 파이프라인

```
Step 1           Step 2           Step 3           Step 4           Step 5
신청             법률 검토        감정평가         토큰 발행        세일 시작
─────────────────────────────────────────────────────────────────────────────

Host가          법무법인이       감정평가사가     플랫폼이         투자자가
토큰화 신청  -> SPV 설립,    -> 빈집 감정가  -> Anchor Program -> USDC로
서류 제출       증권 해당성     산정            으로 토큰 발행     토큰 매수
               판단                            (SPL Token)

예상: 1주       예상: 2-4주      예상: 1-2주     예상: 1일        기간: 4-8주
```

### 2.2. 각 단계 상세

**Step 1: 신청**
- Host가 Admin 페이지에서 토큰화 신청
- 필수 서류: 등기부등본, 건축물대장, 리모델링 이력, 최근 6개월 예약 실적
- 플랫폼 사전 심사: 예약률 50% 이상, 리뷰 평점 4.0 이상

**Step 2: 법률 검토**
- SPV(특수목적회사) 설립 (법인세 최적화)
- 빈집 소유권 또는 수익권을 SPV에 위탁
- 증권 해당 여부 판단 -> STO 절차 필요 시 증권신고서 준비

**Step 3: 감정평가**
- 인가 감정평가법인을 통한 공정가치 산정
- 감정 기준: 토지가, 건물가, 리모델링 비용, 입지 프리미엄, 수익 환원법
- 감정가 = 토큰 발행 총액의 기준

**Step 4: 토큰 발행**
- Anchor Program `initialize_property` 호출
- SPL Token Mint 생성 (총 발행량 = 감정가 / 토큰당 가격)
- 메타데이터 온체인 등록

**Step 5: 세일**
- 투자자가 USDC로 토큰 매수 (`purchase_tokens`)
- 세일 기간: 4-8주 (미판매 분은 보관 또는 재세일)
- 최소 판매율: 60% 미달 시 전액 환불 후 토큰화 취소

---

## 3. 배당 분배 알고리즘

### 3.1. 월별 배당 대상 수익 계산

```typescript
async function calculateMonthlyDividend(
    tokenMint: string,
    period: string  // "2026-01"
): Promise<DividendCalculation> {
    const rwaToken = await db.query.rwaTokens.findFirst({
        where: eq(rwaTokens.tokenMint, tokenMint),
    });

    // 1. 해당 빈집의 월간 예약 매출
    const [year, month] = period.split('-').map(Number);
    const startDate = `${period}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const monthlyBookings = await db.query.bookings.findMany({
        where: and(
            eq(bookings.listingId, rwaToken.listingId),
            eq(bookings.status, 'completed'),
            gte(bookings.checkIn, startDate),
            lt(bookings.checkIn, endDate),
        ),
    });

    const grossRevenue = monthlyBookings.reduce(
        (sum, b) => sum + b.totalPrice, 0
    );

    // 2. 공제 항목
    const platformFee = grossRevenue * 0.10;        // 플랫폼 수수료 10%
    const operatingCost = grossRevenue * 0.08;       // 운영비 8% (청소, 유지보수)
    const hostReward = (grossRevenue - platformFee - operatingCost) * 0.15; // 호스트 보상 15%

    // 3. 순수익 (투자자 배당 대상)
    const netRevenue = grossRevenue - platformFee - operatingCost - hostReward;

    // 4. 토큰당 배당금
    const amountPerToken = netRevenue / rwaToken.totalSupply;

    return {
        grossRevenue,
        platformFee,
        operatingCost,
        hostReward,
        netRevenue,
        totalSupply: rwaToken.totalSupply,
        amountPerToken,
        amountPerTokenUsdc: convertKRWToUSDC(amountPerToken),
    };
}
```

### 3.2. 수익 분배 구조
```
총 예약 매출 (100%)
    │
    ├── 플랫폼 수수료 (10%)  -> Treasury Wallet
    ├── 운영비 (8%)          -> 운영 계정 (청소, 수선, 관리)
    ├── 호스트 보상 (15%)    -> Host Wallet (of net)
    └── 투자자 배당 (67%)    -> DividendPool -> 투자자별 Claim
```

### 3.3. 배당 분배 실행
```typescript
async function distributeDividends(tokenMint: string, period: string) {
    const calc = await calculateMonthlyDividend(tokenMint, period);

    // 최소 배당 기준 미달 시 이월
    if (calc.amountPerTokenUsdc < 0.01) {
        await deferDividend(tokenMint, period, calc.netRevenue);
        return;
    }

    // 1. Anchor Program 호출: DividendPool 생성
    const tx = await program.methods
        .distributeDividends(period, new BN(calc.netRevenue))
        .accounts({ propertyToken: getPropertyPDA(tokenMint) })
        .rpc();

    // 2. DB 기록
    await db.insert(rwaDividends).values({
        id: uuidv4(),
        tokenMintAddress: tokenMint,
        period,
        totalAmountUsdc: calc.amountPerTokenUsdc * calc.totalSupply,
        amountPerToken: calc.amountPerTokenUsdc,
        distributed: false, // 투자자가 claim하면 true
        txSignature: tx,
    });

    // 3. 투자자 알림
    await notifyTokenHolders(tokenMint, {
        type: 'dividend_available',
        title: `${period} 배당금이 준비되었습니다`,
        body: `토큰당 ${calc.amountPerTokenUsdc} USDC`,
    });
}
```

---

## 4. 가치 평가 및 리밸런싱

### 4.1. 초기 감정가 산정 기준
| 항목 | 비중 | 설명 |
|------|------|------|
| 토지 공시지가 | 30% | 국토교통부 공시지가 기준 |
| 건물 잔존가치 | 15% | 구조물 내용연수 반영 |
| 리모델링 투자비 | 25% | 실투자 비용 (증빙 기반) |
| 수익 환원법 | 20% | 연간 예상 임대수익 / 기대수익률 |
| 입지 프리미엄 | 10% | 관광지 접근성, 교통편의성 |

### 4.2. 연간 재감정 프로세스
- 매년 1회 (토큰 발행 기념일 기준) 재감정 실시
- 감정가 변동 시 토큰 가격 업데이트 (`update_valuation` instruction)
- 신규 매수 가격에만 적용 (기존 보유자의 매입가는 변경 없음)

### 4.3. 수익률 기반 참고 지표
```
실질 수익률 = (연간 배당 합계 / 토큰 매입가) x 100
참고 수익률 = (최근 12개월 배당 합계 / 현재 토큰 가격) x 100
```
- 투자 대시보드에 참고 수익률 표시 (투자 권유 아님 명시)

---

## 5. 투자자 보호 메커니즘

### 5.1. 최소/최대 투자 한도
| 구분 | 한도 | 근거 |
|------|------|------|
| 최소 투자 | 1 토큰 (~50,000원) | 소액 투자 접근성 |
| 최대 투자 (일반) | 총 발행량의 10% | 집중 리스크 방지 |
| 최대 투자 (적격) | 총 발행량의 30% | 전문 투자자 우대 |

### 5.2. 락업(Lock-up) 기간
- 매수 후 **90일간** 전송/판매 제한
- 이유: 단기 투기 방지, 안정적 투자자 기반 구축
- 락업 기간 중에도 배당금 수령은 가능

### 5.3. 환매 보장 조건
- 플랫폼이 분기별 환매 창구 운영 (최대 환매량: 발행량의 5%/분기)
- 환매 가격: 최근 감정가 기준 (할인 없음)
- 환매 우선순위: 신청 순서

### 5.4. 정보 공시 의무
- **월간 공시**: 예약률, 매출, 배당금 내역
- **분기 공시**: 운영비 상세, 시설 상태 보고
- **연간 공시**: 재감정 결과, 연간 실적 요약
- 공시 데이터는 온체인 + 플랫폼 대시보드 이중 게시

---

## 6. 호스트(빈집 소유자) 인센티브

### 6.1. 토큰화 시 초기 자금 확보
- 토큰 세일 수익금의 일부를 리모델링 비용으로 즉시 사용 가능
- 나머지는 SPV 계정에 운영 자금으로 보관

### 6.2. 운영 호스트 보상
- 순수익의 15%를 운영 보상으로 지급
- 호스트가 직접 운영(청소, 게스트 응대)할수록 보상 증가
- 위탁 운영 시 보상률 조정 (10%)

### 6.3. 토큰 일부 보유를 통한 장기 수익 참여
- 호스트에게 총 발행량의 10%를 무상 배정 (락업 12개월)
- 호스트도 배당금 수령 가능 -> 장기 운영 동기 부여

---

## 7. State Machine: Tokenization Status

### 7.1. 상태 정의

```
 draft -> under_review -> approved -> minting -> active -> paused -> closed
   │          │              │                     │          │
   │          v              v                     v          v
   └──> rejected       review_failed          suspended    delisted
```

| 상태 | 설명 |
|------|------|
| `draft` | 호스트가 신청서 작성 중 |
| `under_review` | 법률 검토 + 감정평가 진행 중 |
| `approved` | 검토 완료, 토큰 발행 대기 |
| `rejected` | 심사 탈락 (사유 통보) |
| `minting` | 토큰 발행 중 (온체인 트랜잭션 처리) |
| `active` | 세일 진행 중 또는 운영 중 |
| `paused` | 일시 중지 (시설 보수, 분쟁 등) |
| `closed` | 토큰화 종료 (환매 완료, 소유권 변경) |

### 7.2. 허용 작업 매트릭스
| 현재 상태 | 허용 작업 |
|-----------|-----------|
| `draft` | 서류 수정, 제출, 취소 |
| `under_review` | 추가 서류 제출 (플랫폼 요청 시) |
| `approved` | 토큰 발행 실행 |
| `active` | 배당 분배, 토큰 매수/매도, 정보 공시 |
| `paused` | 재개, 강제 종료 |
| `closed` | 최종 정산, 기록 보관 |

---

## 8. Related Documents
- **Foundation**: [Blockchain Vision](../01_Concept_Design/08_BLOCKCHAIN_VISION.md) - RWA 전략적 배경
- **Foundation**: [Blockchain Roadmap](../01_Concept_Design/09_BLOCKCHAIN_ROADMAP.md) - Phase 3 마일스톤
- **Prototype**: [RWA Dashboard Review](../02_UI_Screens/08_RWA_DASHBOARD_REVIEW.md) - 투자 대시보드 UI
- **Specs**: [RWA Token Spec](../03_Technical_Specs/10_RWA_TOKEN_SPEC.md) - Anchor Program 명세, 토큰 설계
- **Specs**: [Blockchain Infra Spec](../03_Technical_Specs/08_BLOCKCHAIN_INFRA_SPEC.md) - 온체인 인프라
- **Test**: [Blockchain Test Scenarios](../05_QA_Validation/06_BLOCKCHAIN_TEST_SCENARIOS.md) - TC-BC-040~044
