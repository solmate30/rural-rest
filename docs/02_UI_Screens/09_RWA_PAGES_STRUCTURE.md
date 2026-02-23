# 09. RWA Pages UI Structure
> Created: 2026-02-20
> Last Updated: 2026-02-20

본 문서는 솔라나 기반의 빈집 소유권 공동투자 기능을 위해 설계된 RWA(Real World Asset) 전용 웹 페이지들의 아키텍처와 라우팅 구조를 정의합니다.

## 1. 아키텍처 원칙 (Separation of Concerns)

투자자(Investor)와 일반 숙박객(Guest)의 목적이 명확히 다르므로, 기존 예약 플로우(`/book`)와 혼재되지 않도록 독립된 `/invest` 라우트 하위로 모든 RWA 플로우를 격리합니다. 이를 통해 컴플라이언스(위험 고지, KYC 등) 요소가 일반 고객의 숙박 경험을 저해하지 않도록 합니다.

## 2. 주요 페이지 및 라우팅

### 2.1. RWA 탐색 허브 (`/invest`)
- **목적**: 토큰화된 빈집 자산들을 한눈에 보고 필터링하는 메인 투자 로비
- **주요 UI 요소**:
  - **페이지 헤더**:
    - 타이틀: "Invest in Rural Korea"
    - 서브타이틀: "빈집의 재탄생에 함께하세요"
    - 우측 상단: [Filter] 버튼
  - **RWA 카드 리스트** (그리드 레이아웃):
    - 이미지: 빈집 리모델링 사진
    - 제목: 숙소명 (예: "양평 돌담 고택")
    - 위치: 📍 지역명 (예: "경기도 양평군")
    - **토큰 가격**: ₩50,000 / token
    - **예상 수익률**: 8.2% annually (상단에 trending_up 아이콘과 함께 배지 형태)
    - **모집률 프로그레스 바**: 78% (Primary Green 배경, `rounded-full`)
    - **CTA 버튼**:
      - 지갑 연결 상태: `[Invest Now →]` (Primary Green `#17cf54`)
      - 지갑 미연결: `[Connect Wallet to Invest]` (지갑 연결 모달 트리거)
      - KYC 미완료: `[Complete KYC to Invest]` (KYC 페이지 이동)
  - **필터 옵션** (Filter 모달/패널):
    - **지역**: 전체 / 경기 / 강원 / 충청 / 전라 / 경상 / 제주
    - **정렬**: 수익률순 / 최신순 / 가격순
    - **펀딩 상태**: 모집 중 / 모집 완료 / 운영 중
    - **예상 수익률(APY)**: 슬라이더 (예: 8% 이상)
    - **토큰 가격대**: 슬라이더 (예: 5만 원 이하)
    - **숙소 테마**: "한옥", "오션뷰", "숲속 오두막" 등 체크박스

### 2.2. 빈집 RWA 상세 및 투자 페이지 (`/invest/:listingId`)
- **목적**: 특정 빈집에 투자를 결정하고 실제로 지갑을 통해 USDC 결제(서명)를 진행
- **주요 UI 요소**:
  - **상단 갤러리 섹션**:
    - 이미지 갤러리 (리모델링 전/후 사진 포함)
    - 숙소명 (예: "양평 돌담 고택")
    - 위치: 📍 상세 주소 (예: "경기도 양평군 서종면")
  - **빈집 상세 정보** (좌측 컬럼):
    - **리모델링 이력**:
      - 2025.06 구조 보강 및 지붕 교체
      - 2025.08 인테리어 리모델링 완료
      - 2025.10 Rural Rest 등록 및 운영 시작
    - **숙소 스펙**: 방 2개, 욕실 1개, 최대 6인
    - **운영 지표**: 월 평균 예약률 72%
    - **편의시설**: 아이콘 + 라벨 그리드
    - **호스트 정보**: 프로필, 슈퍼호스트 배지, 호스팅 경력
  - **토큰 정보 패널** (우측 Sticky):
    - **Token Information** 카드:
      - Token Name: YANG-001
      - Total Supply: 10,000 tokens
      - Price/Token: ₩50,000 (≈33.5 USDC)
      - Valuation: ₩500,000,000
      - Holders: 127 investors
      - Sold: 7,800 / 10,000 (78%) - 프로그레스 바
      - Annual Yield: 8.2% (est.)
      - Last Dividend: ₩4,100/token (Jan)
    - **토큰 매수 인터페이스**:
      - Amount: [ 10 ] tokens (입력 필드)
      - Total: 335 USDC (≈ ₩500,000) (자동 계산)
      - Est. Annual Return: ₩41,000
      - `[Buy with USDC →]` 버튼 (Primary Green)
      - ⚠️ **투자 위험 고지**: "투자 원금 손실 가능성이 있습니다. 투자 전 리스크를 충분히 검토하세요." (Amber 배경 Alert 박스)
  - **수익 분배 이력 차트** (하단 전체 너비):
    - 월별 배당금 막대 차트 (최근 12개월)
    - 누적 배당금 라인 차트 오버레이
    - 호버 시 상세 정보: 총 수익, 운영비, 플랫폼 수수료, 순 배당

### 2.3. 내 투자 수익 대시보드 (`/my-investments`)
- **목적**: 사용자가 투자한 모든 빈집 RWA의 자산 가치 변동 및 배당금을 통합 관리
- **주요 UI 요소**:
  - **Summary KPI 위젯** (상단):
    - Total Invested: 2,500 USDC
    - Current Value: 2,680 USDC (+7.2%) (수익률 Primary Green 표시)
    - Total Dividends: 180 USDC
  - **보유 토큰 카드 리스트**:
    - 각 카드 구조:
      - 숙소명 + Token Name (예: "양평 돌담 고택 YANG-001")
      - 보유 수량: 50 tokens | 투자금: ₩2,500,000
      - Dividend: ₩205,000 (claimed) 또는 ₩45,000 (pending)
      - 액션 버튼: `[View]` `[Claim Dividend]` (Claim은 Primary Green)
  - **배당금 수령 이력 테이블** (하단):
    - 컬럼: 날짜 / 숙소명 / 배당금 / 트랜잭션 / 상태
    - Solana Explorer 링크 (온체인 검증)
    - CSV 다운로드 버튼 (세금 신고용)

## 3. 재사용 가능한 UI 컴포넌트 (Shadcn 기반)
본 프로젝트의 기존 디자인 미학을 유지하기 위해 다음 컴포넌트들을 적극 재활용합니다.

- **`Card`**: 빈집 리스트 뷰 및 투자 상세의 정보 블록으로 사용. 
  - 모서리: `rounded-3xl` (투자 카드), `rounded-xl` (정보 패널)
  - 그림자: `shadow-sm` 기본, 호버 시 `shadow-md` 트랜지션
- **`Badge`**: '모집 중', '배당 완료', '인기' 등의 상태값을 표시할 때 테두리 없는(outline) 뱃지로 활용.
- **`Button`**: 
  - 기본 숙박 버튼은 Warm Brown (`#8D6E63`) 계열 유지. 
  - 단, **지갑 연동 및 암호화폐 결제 버튼**은 사용자에게 동작의 차이를 무의식적으로 인지시키기 위해 **Primary Green (`#17cf54`)** 사용.
- **`Progress`**: 모집률/펀딩 진행률 표시용. Primary Green 배경, `rounded-full`.
- **`Alert`**: 투자 위험 고지용. Amber 톤 배경 (`bg-amber-50 border-amber-200 text-amber-800`).
- **`Chart`**: 배당금 이력 차트용. Recharts 또는 Chart.js 사용 권장.

## 4. 디자인 시스템 적용 지침
- **수익률 색상**:
  - 양수 (수익): `text-green-600`
  - 음수 (손실): `text-red-600`
- **반응형**:
  - 데스크톱: 2-3열 그리드
  - 태블릿: 2열
  - 모바일: 1열
- **토큰 가격 표시**: ₩50,000 (KRW) + ≈33.5 USDC 병기
- **진행률 인디케이터**: Primary Green 원(●)은 진행 중, Gray 원(○)은 미진행

## 5. 기존 페이지와의 연결 고리
일반 사용자가 숙소를 탐색하다가 RWA 투자로 자연스럽게 유입될 수 있도록 훅(Hook)을 추가합니다.

- **`/trips/:id` (일반 숙소 상세)**: 만약 해당 숙소가 RWA 토큰화된 숙소라면, 요금표 아래에 옅은 배너 알림을 띄웁니다.
  - "이 숙소는 Rural Rest를 통해 공동 소유(RWA)가 가능한 공간입니다. [수익 구조 알아보기 →]" 클릭 시 `/invest/:id`로 이동.

## Related Documents
- **Dashboard Review**: [8. RWA Dashboard Review](./08_RWA_DASHBOARD_REVIEW.md) - 화면 스크린 설계
- **Booking Review**: [2. Booking Page Review](./02_BOOKING_PAGE_REVIEW.md) - 예약 폼과 차별화되는 지점 확인
