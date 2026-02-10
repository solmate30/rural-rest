# 05. Host Property Editor Review
> Created: 2026-02-07 21:08
> Last Updated: 2026-02-07 21:08

## 1. Prototype Overview
호스트가 자신의 숙소 콘텐츠와 운영 정책을 직접 관리할 수 있는 '상세 편집 화면'에 대한 리뷰입니다. [Admin Management Spec](../03_Technical_Specs/04_ADMIN_MANAGEMENT_SPEC.md)의 요구사항을 시각화하여, 복잡한 관리 기능을 직관적이고 프리미엄하게 구성했습니다.

*   **Screen Name**: Host Property Editor
*   **Aesthetic**: Warm Heritage Minimalism (Warm Beige context, Primary Green highlights).
*   **Device Context**: Desktop (Management-focused).

## 2. Key UI Components (Demonstrated)

### 2.1. Advanced Photo Manager
*   **Drag & Drop Zone**: 상단에 큰 점선 형태의 업로드 영역 배치로 직관적인 진입점 제공.
*   **Grid Layout**: 업로드된 사진들을 갤러리 형태로 보여주며, 첫 번째 사진에 'Representative(대표)' 배지 부여.
*   **Interaction**: 각 사진마다 삭제(X) 버튼이 있으며, 드래그 앤 드롭으로 출력 순서 변경을 암시하는 UI 구성.

### 2.2. Content Rich Editor
*   **Formatting**: 숙소 개요 작성 시 굵게, 기울임꼴, 리스트 등 리치 텍스트 툴바를 제공하여 호스트의 스토리텔링 강화.
*   **Amenities Grid**: 아이콘과 체크박스가 결합된 정돈된 그리드 구조. (WiFi, 주방, 불멍, 텃밭 체험 등 시골 숙소 특화 항목 포함)

### 2.3. Operational Controllers
*   **Dynamic Pricing**: 기본 요금(KRW) 설정과 함께 미니멀한 달력 뷰 제공.
*   **Status Toggle**: 달력 날짜를 클릭하여 '예약 차단(Blocked)' 또는 '특수 요금(Special Price)' 설정을 직관적으로 수행 가능.
*   **Rule Set**: 최대 인원수 조절(Stepper), 체크인/아웃 시간 선택기, 반려동물 동반 여부 토글.

### 2.4. Global Action Bar
*   **Sticky Footer**: 화면 하단에 항상 고정된 액션 바.
*   **Dual Buttons**: `Preview`(게스트 화면 미리보기 - 아웃라인 버튼)와 `Save Changes`(변경사항 저장 - 솔리드 그린 버튼)로 명확한 보조/주요 액션 구분.

## 3. Feedback & Improvements
### 3.1. Strengths (Keep)
*   **Trustworthy Layout**: Shadcn/UI의 정갈한 스타일을 채택하여 비즈니스용 도구로서의 신뢰성 확보.
*   **Visual Hierarchy**: 가장 중요한 사진 관리를 상단에 배치하고, 하단으로 갈수록 상세 설정(규칙, 시간)으로 이어지는 자연스러운 흐름.

### 3.2. Issues & To-Do
*   [ ] **In-line Validation**: 가격이나 최대 인원수 입력 시 실시간으로 유효성 검사 결과(Zod 연동)를 보여주는 UI 피드백 필요.
*   [ ] **Mobile Check**: 호스트가 현장에서 폰으로 사진을 찍어 바로 올릴 수 있도록 모바일 전용 반응형 레이아웃 추가 검토.
*   [ ] **Unsaved Changes Alarm**: 저장하지 않고 페이지를 나갈 때를 대비한 경고 모달 로직 연동.

## 4. Related Documents
- **Foundation**: [Admin Strategy](../01_Concept_&_Design/06_ADMIN_STRATEGY.md) - 호스트 운영 효율화 전략 (Section 3.1)
- **Foundation**: [Product Specs](../01_Concept_&_Design/03_PRODUCT_SPECS.md) - Section 3.B.2 숙소 관리 사이트맵
- **Prototype**: [Admin Dashboard Review](./03_ADMIN_DASHBOARD_REVIEW.md) - 상위 대시보드 화면
- **Specs**: [Admin Management Spec](../03_Technical_Specs/04_ADMIN_MANAGEMENT_SPEC.md) - 상세 기능 및 데이터 명세
- **Specs**: [Storage Policy](../03_Technical_Specs/03_STORAGE_POLICY.md) - Cloudinary 업로드 보안 정책
- **Logic**: [Booking State Machine](../04_Logic_&_Progress/01_BOOKING_STATE_MACHINE.md) - 예약 상태 관리 로직
