# 13. RWA Integration Implementation Log
> Created: 2026-02-20
> Last Updated: 2026-02-20

본 문서는 `rural-rest` 프로젝트에 솔라나 RWA(Real World Asset) 토큰화 및 투자 기능을 연동하는 작업의 진행 상황을 추적합니다. (진행 브랜치: `feat/rwa-wallet-connect` 등)

## Phase 1: 기반 인프라 연동 (Wallet 연동)
- [x] RWA 연동 브랜치 환경 세팅 (`feat/rwa-wallet-connect`)
- [x] `@solana/wallet-adapter` 관련 의존성 패키지 설치
- [x] `RwaWalletProvider` 컨텍스트 생성 및 `root.tsx` 적용
- [x] Header UI 컴포넌트에 `<WalletMultiButton />` 연동
- [x] `user` 테이블에 지갑 주소 저장을 위한 `walletAddress`, `walletConnectedAt` 스키마 추가 정의

## Phase 2: RWA 대시보드 및 투자 뷰 뼈대 (UI Structure)
- [x] `/invest` (RWA 탐색 메인) 라우트 및 페이지 컴포넌트 추가
- [ ] `/invest/:listingId` (RWA 상세 및 투자 폼) 라우트 및 페이지 구현
- [ ] `/my-investments` (내 투자 및 배당 현황) 라우트 추가
- [x] Shadcn 기반의 RWA용 공통 UI 컴포넌트(수익률 카드, 진행률 바 등) 분리

## Phase 3: RWA 컨트랙트 모의 통합 (Mock Integration)
- [ ] 빈집 토큰(`rwa_tokens`) 및 투자 내역(`rwa_investments`) 스키마 추가 및 마이그레이션 (`drizzle-kit push`)
- [ ] 투자 대시보드에 표시할 RWA Mock 데이터 DB 시딩 로직 구현
- [ ] 지갑 서명을 발생시키는 구매(Purchase) 트랜잭션 Mock UI 연동

## Phase 4: 배당금 로직 (Dividend Distribution)
- [ ] 배당금 수령 이력(`rwa_dividends`) 스키마 정의
- [ ] 호스트 순수익 기반 배당 로직 설계 반영
- [ ] 투자자의 Dividend Claim 버튼 동작 및 지갑 서명 플로우 연결

## Related Documents
- **UI Structure**: [RWA Pages Structure](../02_UI_Screens/09_RWA_PAGES_STRUCTURE.md) - RWA 관련 웹 화면 설계
- **Specs**: [RWA Token Spec](../03_Technical_Specs/10_RWA_TOKEN_SPEC.md) - 온체인 토큰 발행 명세
