# NFT Gallery & Gamification UI Review
> Created: 2026-02-10 16:00
> Last Updated: 2026-02-10 16:00

## 1. My NFT Collection 페이지 (`/my-nfts`)

### 1.1. NFT 카드 그리드 레이아웃
```
┌─────────────────────────────────────────────┐
│ My Experience Badges              [3 total] │
│                                             │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│ │ [숙소 img] │ │ [숙소 img] │ │ [숙소 img] │ │
│ │           │ │           │ │           │ │
│ │ 고성 한옥  │ │ 양평 돌집  │ │ 제주 귤밭  │ │
│ │ 2026.01   │ │ 2026.02   │ │ 2025.12   │ │
│ │ ☀️ Summer │ │ ❄️ Winter │ │ 🍂 Autumn │ │
│ └───────────┘ └───────────┘ └───────────┘ │
└─────────────────────────────────────────────┘
```
- 3열 그리드 (데스크톱), 2열 (태블릿), 1열 (모바일)
- 카드: `rounded-3xl`, 숙소 대표 이미지 배경, 반투명 오버레이에 텍스트
- 계절 뱃지: 체크인 날짜 기준 자동 부여

### 1.2. NFT 상세 모달
카드 클릭 시 Radix Dialog로 상세 정보 표시:
```
┌─────────────────────────────────────┐
│ [숙소 대표 이미지 - 풀 width]        │
│                                     │
│ 고성 한옥 스테이 Experience Badge    │
│                                     │
│ 체크인:  2026-01-15                 │
│ 체크아웃: 2026-01-17                │
│ 계절:    겨울 (Winter)              │
│ 위치:    강원도 고성군               │
│                                     │
│ Mint Address: 8xKf...3mNp          │
│ [View on Solana Explorer →]         │
│                                     │
│ Collection: Rural Rest Experiences  │
│ #47 of 1,250 minted                │
│                                     │
│                          [Close]    │
└─────────────────────────────────────┘
```

### 1.3. Empty State
NFT가 없을 때:
```
┌─────────────────────────────────────┐
│                                     │
│        🏡                           │
│   아직 Experience Badge가 없어요    │
│                                     │
│   첫 숙박을 완료하면 한정판 NFT를    │
│   받을 수 있어요!                    │
│                                     │
│   [숙소 둘러보기 →]                  │
│                                     │
└─────────────────────────────────────┘
```

---

## 2. Gamification Dashboard (`/my-points`)

### 2.1. Eco-Points 잔액 표시
```
┌─────────────────────────────────────┐
│ My Eco-Points                       │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │   🌿 12,450 EP                  │ │
│ │   Gold Member                   │ │
│ │   ████████████░░░ 70%           │ │
│ │   → Platinum까지 17,550 EP 더   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2.2. 등급 배지 및 진행률
- Bronze / Silver / Gold / Platinum 아이콘
- 현재 등급 하이라이트 + 다음 등급까지 진행률 바
- 현재 등급의 혜택 요약 ("10% 할인 + 우선 예약")

### 2.3. 포인트 획득 이력
```
┌─────────────────────────────────────┐
│ Recent Activity                     │
│                                     │
│ 🏡 숙박 완료 - 양평 돌집    +1,000 │
│ ✏️ 리뷰 작성               +300   │
│ 🏡 숙박 완료 - 고성 한옥    +2,000 │
│    (7일 장기체류 2x 보너스)         │
│ 🎋 체험활동 - 대나무공예    +500   │
│                                     │
│ [See All →]                         │
└─────────────────────────────────────┘
```

### 2.4. 리워드 교환 인터페이스
```
┌─────────────────────────────────────┐
│ Rewards                             │
│                                     │
│ ┌───────────────────────────────┐  │
│ │ 🎫 10,000원 할인 쿠폰         │  │
│ │    10,000 EP                  │  │
│ │    [Exchange]                 │  │
│ └───────────────────────────────┘  │
│ ┌───────────────────────────────┐  │
│ │ 🎨 한정판 아트 NFT            │  │
│ │    25,000 EP                  │  │
│ │    [Exchange]                 │  │
│ └───────────────────────────────┘  │
│ ┌───────────────────────────────┐  │
│ │ 🏔️ 무료 체험활동 1회          │  │
│ │    5,000 EP                   │  │
│ │    [Exchange]                 │  │
│ └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## 3. Property Detail 내 NFT 배너

### 3.1. 프로모션 배너
숙소 상세 페이지(`/property/:id`) 어메니티 섹션 아래에 배치:
```
┌─────────────────────────────────────┐
│ 🎖️ Stay here & earn an exclusive   │
│    Experience Badge NFT!            │
│                                     │
│    This stay has issued 47 badges   │
│    so far.                          │
│                                     │
│    [Learn more about NFT rewards →] │
└─────────────────────────────────────┘
```
- 배경: Primary Green 10% opacity, 테두리: Green
- `rounded-2xl`, 작은 NFT 미리보기 이미지 우측 배치

### 3.2. 해당 숙소 발행 NFT 미리보기
- 최근 발행된 NFT 5개 미니 카드 가로 스크롤
- "이 숙소에서 47명이 Experience Badge를 받았어요"

---

## 4. 반응형 & 디자인 시스템 준수
- NFT 카드: `rounded-3xl`, `shadow-sm`, 호버 시 `scale-105` 트랜지션
- 등급 색상: Bronze `#CD7F32`, Silver `#C0C0C0`, Gold `#FFD700`, Platinum `#E5E4E2`
- 포인트 색상: Primary Green `#17cf54`
- 폰트: Plus Jakarta Sans
- 모바일: 하단 네비게이션에 "My NFTs" 탭 추가 검토

---

## 5. Related Documents
- **Foundation**: [Blockchain Vision](../01_Concept_Design/08_BLOCKCHAIN_VISION.md) - NFT/Gamification 전략
- **Prototype**: [Detail Page Review](./01_DETAIL_PAGE_REVIEW.md) - 숙소 상세 페이지 기존 UI
- **Logic**: [NFT Gamification Logic](../04_Logic_Progress/11_NFT_GAMIFICATION_LOGIC.md) - 포인트 규칙, 등급 알고리즘
- **Specs**: [Blockchain Infra Spec](../03_Technical_Specs/08_BLOCKCHAIN_INFRA_SPEC.md) - Metaplex/Bubblegum 스택
