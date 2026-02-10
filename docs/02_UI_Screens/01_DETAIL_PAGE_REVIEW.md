# 01. Property Detail Page Review (V2)
> Created: 2026-02-07 16:59
> Last Updated: 2026-02-09 15:00

## 1. Prototype Link/Screenshot
*   **Project Name**: Rural Rest V2
*   **Screen Name**: Grandma's Stone House Details
*   **Style**: Shadcn/UI Aesthetic (Clean & Floating)

## 2. Key User Flows (Demonstrated)
1.  **Immersive Hero**:
    *   **Full-width Image**: Immediately captures the "Modern Renovation" vibe.
    *   **Overlay Actions**: Back/Share buttons are placed over the image for max screen real estate.
2.  **Clear Info Hierarchy**:
    *   **Title**: Large Bold Inter font.
    *   **Host Trust**: Minimalist row with Avatar and "Superhost" badge.
3.  **Selection Cards (Shadcn Style)**:
    *   **Dormitory vs Private**: distinct cards with `rounded-xl` and `border-slate-200`.
    *   **Visual Cue**: Clear price difference and capacity.
4.  **Conversion Driver**:
    *   **Sticky Bottom Bar**: The "Reserve" button is always accessible, removing friction.
    *   **Color**: Warm Brown (#8D6E63) stands out against the white background.

### 2.5. Add-on: Gallery & Amenities Modal
Designed to address hygiene concerns common in rural stays.
*   **Layout**: Tab Navigation (Photos | Amenities) using Shadcn Tabs.
*   **Content**: Masonry Grid for photos (Bathroom focus), Icon List for Amenities (Bidet, WiFi).
*   **Goal**: Remove "Fear of the Unknown" (e.g., Is the toilet clean?).

## 3. Feedback & Improvements
### 3.1. Strengths (Keep)
*   **Consistency**: Perfectly matches the Landing Page's Floating Card aesthetic.
*   **Mobile-First**: The Sticky Bottom Bar is essential for mobile conversion.
*   **Whitespace**: Excellent use of spacing makes the dense text (descriptions, amenities) feel light.

### 3.2. Issues & To-Do (Fix before Logic)
*   [x] **Gallery View**: The hero image needs a "View All Photos" button or grid indicator. → 구현 완료 ("+N Photos" 버튼 + Gallery Modal)
*   [x] **Map Integration**: A small map snippet is still needed to show location context. → Mock 지도 구현 완료 (CSS 그라디언트 + SVG 등고선 + 주변 랜드마크). Kakao Map API 확보 시 실제 지도로 교체 예정. → [Property Detail Guide](../03_Technical_Specs/07_PROPERTY_DETAIL_IMPLEMENTATION_GUIDE.md) Section 4.7
*   [ ] **Review Summary**: Clicking the star rating should anchor down to the review section.

## 4. Next Step
*   Design the **Booking & Payment Page** maintaining this clean, trustworthy style.

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 프로퍼티 상세 페이지 사이트맵 및 사용자 플로우 (Section 3.A.3)
- **Foundation**: [UI Design](../01_Concept_Design/05_UI_DESIGN.md) - 디자인 시스템 및 컬러 팔레트 (#8D6E63 Warm Brown)
- **Foundation**: [Happy Path Scenarios](../01_Concept_Design/07_HAPPY_PATH_SCENARIOS.md) - 게스트 시나리오 Step 2 (Village Story 몰입)
- **Prototype**: [Landing Page Review](./00_LANDING_PAGE_REVIEW.md) - 이전 단계 프로토타입
- **Prototype**: [Booking Page Review](./02_BOOKING_PAGE_REVIEW.md) - 다음 단계 프로토타입
- **Specs**: [Database Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - `listings` 테이블 구조
- **Specs**: [Property Detail Guide](../03_Technical_Specs/07_PROPERTY_DETAIL_IMPLEMENTATION_GUIDE.md) - Section 4.7-4.8 Mock 지도 및 교통 안내 구현 상세
- **Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - Property Details API 엔드포인트 (Section 3.3)
- **Logic**: [Transport Concierge](../04_Logic_Progress/05_TRANSPORT_CONCIERGE_LOGIC.md) - 교통 컨시어지 로직 및 Mock 데이터 모델
