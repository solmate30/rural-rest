# 13. RWA Integration Implementation Log
> Created: 2026-02-20
> Last Updated: 2026-02-20

본 문서는 `rural-rest` 프로젝트에 솔라나 RWA(Real World Asset) 토큰화 및 투자 기능을 연동하는 작업의 진행 상황을 추적합니다. (진행 브랜치: `feat/rwa-invest`)

## Phase 1: 기반 인프라 연동 (Wallet 연동)
- [x] RWA 연동 브랜치 환경 세팅 (`feat/rwa-wallet-connect` → `feat/rwa-invest`)
- [x] `@solana/wallet-adapter` 관련 의존성 패키지 설치
- [x] `RwaWalletProvider` 컨텍스트 생성 및 `/invest`·`/invest/:listingId` 라우트에서 적용
- [x] Header UI 컴포넌트에 `<WalletMultiButton />` 연동 (Invest 경로에서 Primary Green 스타일)
- [x] `user` 테이블에 지갑 주소 저장을 위한 `walletAddress`, `walletConnectedAt` 스키마 추가 정의
- [x] 지갑 모달 중복 항목 필터링 (`WalletDeduplicator` - 동일 이름 지갑 1개만 표시)
- [x] 지갑 버튼 Primary Green (`#17cf54`) 스타일 적용 (`app.css` 오버라이드)
- [x] Material Symbols Outlined 폰트 로드 (`root.tsx` links)

## Phase 2: RWA 대시보드 및 투자 뷰 (UI Structure)

*참고: [08. RWA Dashboard Review](../02_UI_Screens/08_RWA_DASHBOARD_REVIEW.md) 화면 명세 기준*

### `/invest` (RWA 토큰 목록)
- [x] 페이지 헤더: "Invest in Rural Korea", "빈집의 재탄생에 함께하세요", [Filter]
- [x] 토큰화된 빈집 카드: 이미지, 숙소명, 위치, Token Price ₩50,000/token, Est. Yield 8.2% annually, Tokens Sold 진행률, CTA
- [x] 필터 옵션: 지역(전체/경기/강원/충청/전라/경상/제주), 정렬(수익률순/최신순/가격순), 상태(모집 중/모집 완료/운영 중)
- [x] CTA: 지갑 연결 → "Invest Now →", 미연결 → "Connect Wallet to Invest" (지갑 모달 트리거)
- [ ] KYC 미완료 시 "Complete KYC to Invest" 표시 및 KYC 페이지 이동

### `/invest/:listingId` (토큰 상세 및 투자)
- [x] 이미지 갤러리 (리모델링 전/후 구성 가능)
- [x] 빈집 정보: 숙소명, 위치, 숙소 스펙(방/욕실/최대 인원), 편의시설, 호스트
- [ ] 리모델링 이력 블록 (일자별: 구조 보강, 인테리어, 등록·운영 시작)
- [ ] 월 평균 예약률 표시
- [x] 토큰 정보 패널 (Sticky): Token Name, Total Supply, Price/Token, Valuation, 모집률(Sold)
- [ ] Token Information 상세: Holders 수, Last Dividend (월별 ₩/token)
- [ ] 수익 분배 이력 차트: 월별 배당금 막대(12개월), 누적 라인 오버레이, 호버 시 상세(총수익/운영비/수수료/순배당)
- [x] Purchase Tokens: Amount(토큰 수), Total(KRW), 플랫폼 수수료, CTA
- [ ] Total USDC (≈ ₩) 병기, Est. Annual Return 표시
- [x] "Buy with USDC →" / 지갑 미연결 시 안내
- [x] 투자 위험 고지 (원금 손실, 리스크 검토 안내)

### `/my-investments` (내 투자 포트폴리오)
- [ ] 라우트 및 페이지 추가
- [ ] Summary: Total Invested, Current Value (+n%), Total Dividends
- [ ] 보유 토큰 카드 목록: 숙소명+Token Name, 보유 수량|투자금, Dividend (claimed/pending), [View] [Claim Dividend]
- [ ] 배당금 수령 이력 테이블: 날짜/숙소명/배당금/트랜잭션/상태
- [ ] Solana Explorer 링크 (온체인 검증)
- [ ] CSV 다운로드 (세금 신고용)

### Host: `/admin/tokenize` (토큰화 신청)
- [ ] 토큰화 신청 폼: 숙소 선택, 감정평가서·등기부등본 업로드, 희망 토큰 수, 신청하기
- [ ] 심사 상태 표시: 신청 → 법률 검토 → 감정평가 → 승인 → 토큰 발행 (Primary Green 진행 단계, Gray 미진행)
- [ ] 단계별 예상 소요 기간·메모

### 디자인 시스템 준수 (08 §5)
- [x] 투자 카드: rounded-3xl 또는 rounded-2xl, shadow-sm, 호버 shadow-md
- [x] 진행률 바: Primary Green, rounded-full
- [x] 수익률 양수: text-green-600
- [ ] 수익률 음수: text-red-600 (내 투자 등)
- [ ] 위험 안내: bg-amber-50 border-amber-200 text-amber-800
- [ ] 차트 라이브러리: Recharts 또는 Chart.js 도입
- [x] 반응형: 데스크톱 2~4열, 모바일 1열 그리드

## Phase 3: RWA 컨트랙트 모의 통합 (Mock Integration)
- [ ] 빈집 토큰(`rwa_tokens`) 및 투자 내역(`rwa_investments`) 스키마 추가 및 마이그레이션 (`drizzle-kit push`)
- [ ] 투자 대시보드에 표시할 RWA Mock 데이터 DB 시딩 로직 구현
- [ ] 지갑 서명을 발생시키는 구매(Purchase) 트랜잭션 Mock UI 연동

## Phase 4: 배당금 로직 (Dividend Distribution)
- [ ] 배당금 수령 이력(`rwa_dividends`) 스키마 정의
- [ ] 호스트 순수익 기반 배당 로직 설계 반영
- [ ] 투자자의 Dividend Claim 버튼 동작 및 지갑 서명 플로우 연결

## Related Documents
- **UI Review**: [08. RWA Dashboard Review](../02_UI_Screens/08_RWA_DASHBOARD_REVIEW.md) - 대시보드·상세·내 투자·토큰화 신청 스크린 명세 (구현 기준)
- **UI Structure**: [09. RWA Pages Structure](../02_UI_Screens/09_RWA_PAGES_STRUCTURE.md) - RWA 화면·필터·CTA 명세
- **Specs**: [10. RWA Token Spec](../03_Technical_Specs/10_RWA_TOKEN_SPEC.md) - 온체인 토큰 발행 명세
- **Logic**: [12. RWA Tokenization Logic](./12_RWA_TOKENIZATION_LOGIC.md) - 배당 알고리즘
- **Test**: [06. Blockchain Test Scenarios](../05_QA_Validation/06_BLOCKCHAIN_TEST_SCENARIOS.md) - RWA 테스트 케이스
