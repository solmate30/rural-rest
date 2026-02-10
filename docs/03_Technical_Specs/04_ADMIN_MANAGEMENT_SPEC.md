# 04. Admin Management Specification (Host Operations)
> Created: 2026-02-07 20:36
> Last Updated: 2026-02-10 12:00

## 1. Overview
호스트가 자신의 숙소를 효율적으로 관리하고 운영할 수 있는 실질적인 도구들에 대한 상세 명세입니다. 단순히 지표를 보는 것을 넘어, 콘텐츠를 생산하고 수정하는 기능에 집중합니다.

### 1.1. 구현 상태 (Implementation Status)
| 기능 | 상태 | 비고 |
|------|------|------|
| Admin Dashboard (지표·숙소 목록) | 완료 | `admin.dashboard.tsx` loader, `admin-dashboard.server.ts` (매출/투숙률/대기 예약/오늘 체크인/호스트 숙소 목록) |
| Admin Edit (숙소 편집 UI) | UI만 | Cloudinary 업로드 연동, 폼 필드 표시. **DB 저장(create/update) 미구현** |
| Listing Create/Update to DB | 미구현 | 폼 제출 시 `listings` 테이블 insert/update 필요 |
| 예약 승인/거절 Action | 미구현 | [API Specs](./02_API_SPECS.md) Section 3.5 Action 참조 |

## 2. Listing Content Management (숙소 콘텐츠 관리)

### 2.1. Photo Manager (멀티미디어 업로드)
*   **기능**: 숙소 사진 업로드, 삭제 및 순서 변경.
*   **동작 방식**: 
    *   **Drag & Drop**: 여러 장의 사진을 한 번에 업로드 영역으로 끌어다 놓기.
    *   **Signed Upload**: [Storage Policy](./03_Storage_Policy.md)에 따라 서버 서명을 받아 Cloudinary에 직접 업로드.
    *   **Thumbnail Preview**: 업로드된 사진들을 격자(Grid) 형태로 보여주며, 첫 번째 사진을 'Representative(대표)'로 자동 설정.
    *   **Sorting**: 드래그 앤 드롭으로 사진 출력 순서 변경 가능.

### 2.2. Listing Editor (기본 정보 편집)
*   **상세 설명**: 리치 텍스트 또는 텍스트 영역을 통해 숙소의 '스토리'와 특징 입력.
*   **편의시설(Amenities)**: 아이콘과 텍스트로 구성된 체크리스트 (예: WiFi, 주방, 불멍, 텃밭 체험 등).
*   **이용 규칙**: 체크인/아웃 시간, 반려동물 동반 가능 여부, 최대 인원수 설정.

## 3. Pricing & Calendar (가격 및 예약 관리)

### 3.1. Pricing Logic
*   **Base Price**: 기본 주중 1박 요금 설정.
*   **Dynamic Pricing**: 주말(금/토) 및 성수기/비성수기 가중치 설정 가능성 열어둠.
*   **Currency**: 원화(KRW) 기준 정수 저장 (예: 180,000).

### 3.2. Calendar Interaction
*   **Month View**: 달력에서 날짜별 예약 상태(예약됨/대기중/비어있음) 표시.
*   **Manual Block**: 호스트가 개인 용도로 공간을 사용하거나 수리가 필요할 때 특정 날짜를 '예약 불가'로 강제 전환.
*   **Price Override**: 특정 날짜(예: 명절)에만 일시적으로 가격을 다르게 책정하는 기능.

## 4. Operational Tools (운영 도구)

### 4.1. Booking Request Management
*   **Pending Approval**: 게스트가 예약을 요청했을 때 '수락(Accept)' 또는 '거절(Reject)' 수행.
*   **Status Sync**: 호스트가 수락 시 게스트에게 이메일/알림 연동 (Logic 단계에서 상세화).

### 4.2. Experience & Activities
*   숙소와 연계된 체험 상품(예: 삼겹살 파티, 불멍 키트)의 활성화 여부 및 수량 관리.

## 5. UI/UX Requirements
*   **Form Validation**: Zod를 사용하여 가격(숫자), 제목(최소 5자 이상), 설명(필수) 등 데이터 정합성 검증.
*   **Loading States**: 이미지 업로드 중 프로그레스 바 또는 스피너 표시.
*   **Optimistic Updates**: 상태 변경(예: 예약 수락) 시 UI에서 먼저 반영하고 서버 통신 결과에 따라 보정.

## 6. Related Documents
- **Foundation**: [Admin Strategy](../01_Concept_Design/06_ADMIN_STRATEGY.md) - 호스트 운영 전략 및 기능 우선순위
- **Foundation**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - Host (Admin) Side 사이트맵
- **Prototype**: [Admin Dashboard Review](../02_UI_Screens/03_ADMIN_DASHBOARD_REVIEW.md) - 대시보드 UI 및 Loader 구현 상태
- **Prototype**: [Host Property Editor Review](../02_UI_Screens/05_ADMIN_EDITOR_REVIEW.md) - 상세 편집기 UI 리뷰 (Listing Create/Update 연동 대상)
- **Specs**: [Database Schema](./01_DB_SCHEMA.md) - `listings` 및 `activities` 테이블 참조
- **Specs**: [API Specs](./02_API_SPECS.md) - Admin Dashboard API 엔드포인트 (Section 3.5)
- **Specs**: [Storage Policy](./03_STORAGE_POLICY.md) - 사진 업로드 보완 정책
- **Logic**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - Admin Dashboard 데이터 연동 완료, Listing Create/Update 및 예약 승인 미구현 (Section 2)
