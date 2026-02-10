# Blockchain Feature Roadmap
> Created: 2026-02-10 16:00
> Last Updated: 2026-02-10 16:00

## 1. Phase 1: Foundation -- 결제 기반 구축 (0-3개월)

### 1.1. Solana Wallet Adapter 통합
- `@solana/wallet-adapter-react` 설치 및 `WalletProvider` 구성
- React Router 7 SSR 환경에서 `ClientOnly` 래퍼 처리
- 지원 지갑: Phantom, Solflare, Backpack, Ledger

### 1.2. 사용자 프로필 지갑 연결
- `user` 테이블에 `walletAddress`, `walletConnectedAt` 필드 추가
- 프로필 설정에 "Connect Wallet" UI 추가
- 기존 Better Auth 인증과 지갑 주소의 Optional 연결

### 1.3. Devnet 환경 구축
- Solana Devnet RPC 설정 (Helius 또는 QuickNode)
- 테스트 SOL/USDC 파우셋 연동
- 환경 변수 분리: `SOLANA_NETWORK=devnet`

### 1.4. SOL/USDC 결제 MVP
- 에스크로 Anchor 프로그램 개발 (Payment Program)
- Booking Flow에 결제 수단 선택 UI 추가 ("Card" / "Crypto" 탭)
- 트랜잭션 서명 -> 검증 -> 예약 확정 플로우
- 환율 API 연동 (Jupiter Aggregator)

### 마일스톤
- [ ] Wallet Adapter 연동 완료
- [ ] Devnet 에스크로 결제 성공
- [ ] 결제 수단 선택 UI 완성
- [ ] Booking State Machine에 crypto 결제 분기 통합

---

## 2. Phase 2: Gamification + NFT (3-6개월)

### 2.1. Experience Badge NFT 자동 발행
- Metaplex Bubblegum (Compressed NFT) 기반 Collection 생성
- 숙박 완료(`booking.status === 'completed'`) 트리거로 자동 민팅
- 메타데이터: 숙소명, 체크인/아웃 일자, 계절, 숙소 이미지
- Irys/Arweave에 메타데이터 영구 저장

### 2.2. Eco-Points 온체인 포인트 시스템 MVP
- 포인트 적립 규칙 정의 (숙박 1000EP, 리뷰 300EP, 장기 체류 보너스)
- 포인트 사용: 할인 쿠폰 교환, 특별 체험 교환
- 온체인/오프체인 하이브리드 저장 전략 (빈번한 조회는 DB, 정산은 온체인)

### 2.3. NFT Gallery UI
- `/my-nfts` 라우트 추가
- NFT 카드 그리드: 숙소 이미지 + 민팅 일시 + Solana Explorer 링크
- Empty State: "첫 숙박 완료 후 NFT를 받아보세요"

### 2.4. 등급 시스템 구현
- Bronze (0-2,999 EP) / Silver (3,000-9,999 EP) / Gold (10,000-29,999 EP) / Platinum (30,000+ EP)
- 등급별 할인율 자동 적용 (Booking Flow 연동)
- 등급 배지 UI (프로필, 리뷰 옆 표시)

### 마일스톤
- [ ] Compressed NFT Collection 생성 (Devnet)
- [ ] 숙박 완료 -> NFT 자동 민팅 파이프라인 완성
- [ ] Eco-Points 적립/사용 기능 완성
- [ ] NFT Gallery + 등급 대시보드 UI 완성

---

## 3. Phase 3: RWA Tokenization (6-12개월)

### 3.1. 법률/규제 클리어런스
- 법률 자문: RWA 토큰의 증권 해당 여부 확인
- SPV(특수목적회사) 설립 구조 설계
- 금융위원회 STO 가이드라인 대응 전략 수립
- KYC/AML 요구사항 정의 및 파트너 선정

### 3.2. 파일럿 숙소 1개 토큰화
- 감정평가 완료된 빈집 1채 선정
- SPL Token 기반 소유권 분할 발행 (Anchor Program)
- 토큰 세일 인터페이스 구현 (USDC -> 토큰 매수)

### 3.3. 임대 수익 자동 배당
- 배당 분배 스마트 컨트랙트: 월별 수익 집계 -> 보유 비율 분배
- 배당금 Claim UI: 투자자가 축적된 배당금을 수령

### 3.4. 투자 대시보드 UI
- `/invest` 라우트: 토큰화된 빈집 목록, 투자 기회 탐색
- `/invest/:id` 라우트: 토큰 상세, 수익률, 매수 인터페이스
- `/my-investments` 라우트: 포트폴리오, 배당 이력

### 마일스톤
- [ ] 법률 자문 완료 및 규제 대응 전략 확정
- [ ] 파일럿 빈집 감정평가 완료
- [ ] RWA Anchor Program Devnet 배포
- [ ] 파일럿 토큰 세일 + 첫 배당 분배 성공

---

## 4. Phase 4: 생태계 확장 (12개월+)

### 4.1. NFT Marketplace
- Experience Badge P2P 거래 기능
- 희귀 NFT (특정 계절, 특별 이벤트) 프리미엄 거래

### 4.2. DAO 기반 마을 거버넌스
- RWA 토큰 홀더의 마을 운영 결정 투표
- 리모델링 방향, 체험 프로그램 기획 등에 토큰 홀더 참여

### 4.3. 크로스체인 브릿지 검토
- Wormhole 등을 통한 EVM 체인 연동 가능성 평가
- Ethereum/Polygon 사용자 유입 채널 확대

### 4.4. DeFi 통합
- RWA 토큰 스테이킹 (추가 수익)
- 유동성 풀 생성 (DEX 상장)

---

## 5. 마일스톤 & 의존성

### 5.1. Phase 간 의존성
```
Phase 1 (결제)
  ├── Wallet Adapter 통합 ──────┐
  └── Payment Program 개발 ───┐ │
                               v v
Phase 2 (NFT/Gamification) ────────┐
  ├── Wallet Adapter (Phase 1 완료) │
  ├── NFT Minting Program          │
  └── Points System                │
                                   v
Phase 3 (RWA) ─────────────────────┐
  ├── 법률 자문 (비기술, 병행 가능)   │
  ├── KYC 시스템                     │
  └── RWA Program                   │
                                   v
Phase 4 (생태계)
  └── Phase 1-3 모두 완료
```

### 5.2. 기존 MVP 의존성
- Booking Flow 완성 (현재 Mock 기반) -> Phase 1 시작 조건
- 숙박 완료 상태 전이 안정화 -> Phase 2 NFT 민팅 트리거 전제
- Admin Dashboard 완성 -> Phase 3 호스트 토큰화 신청 UI 전제

### 5.3. Mainnet 전환 기준
| 기준 | 조건 |
|------|------|
| Devnet 테스트 | 전체 시나리오 통과, 에지 케이스 처리 완료 |
| 보안 감사 | 외부 감사 업체(OtterSec 등) 감사 완료 |
| 법률 검토 | VASP 해당 여부 확정, 필요시 신고 완료 |
| 성능 테스트 | 동시 100명 결제 처리 안정성 확인 |
| 비상 계획 | 프로그램 일시정지, 긴급 업그레이드 절차 수립 |

---

## 6. Related Documents
- **Foundation**: [Blockchain Vision](./08_BLOCKCHAIN_VISION.md) - 블록체인 도입 전략적 배경
- **Foundation**: [Roadmap](./04_ROADMAP.md) - 기존 프로젝트 로드맵
- **Specs**: [Blockchain Infra Spec](../03_Technical_Specs/08_BLOCKCHAIN_INFRA_SPEC.md) - Solana 기술 스택
- **Specs**: [Solana Payment Spec](../03_Technical_Specs/09_SOLANA_PAYMENT_SPEC.md) - 결제 API 명세
- **Specs**: [RWA Token Spec](../03_Technical_Specs/10_RWA_TOKEN_SPEC.md) - RWA 토큰 명세
- **Logic**: [NFT Gamification Logic](../04_Logic_&_Progress/11_NFT_GAMIFICATION_LOGIC.md) - NFT/포인트 비즈니스 로직
