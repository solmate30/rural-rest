# Transport Concierge Logic Design
> Created: 2026-02-07 21:00
> Last Updated: 2026-02-09 22:00

## 1. Context
농촌 지역의 가장 큰 문제점인 '접근성(Accessibility)'을 해결하기 위한 기능입니다. 대중교통이 불편한 숙소를 위해 마을 입구(터미널/기차역)에서 숙소까지의 셔틀 서비스를 예약하거나 로컬 교통 정보를 제공합니다.

**관련 UI**: Property Detail (Location & Map + Getting Here) → **Booking Page (Transport Concierge Section)** → My Trips Page (Shuttle Status) → Admin Dashboard (Shuttle Schedule)

## 1.1. 현재 구현 상태 (Mock)

Property Detail 페이지에 Mock 기반 교통 안내 UI가 구현되어 있다 (`web/app/routes/property.tsx`).

**구현된 Mock 데이터 모델** (`web/app/data/listings.ts`):

```typescript
interface Coordinates { lat: number; lng: number }

interface TransportOption {
  mode: "train" | "bus" | "taxi" | "shuttle";
  label: string;        // 표시명 (e.g., "KTX", "셔틀 서비스")
  routeName: string;    // 노선 (e.g., "서울역 → 신경주역")
  estimatedTime: string;
  estimatedCost: string;
  description: string;
}

interface PickupPoint {
  id: string;
  name: string;         // 픽업 포인트명 (e.g., "신경주역 동편 출구")
  description: string;
  estimatedTimeToProperty: string;
}
```

**지역별 Lookup Map**: 5개 지역(서울 근처, 부산 근처, 경주, 인천, 제주)에 대해 좌표, 랜드마크, 교통수단 4종(train/bus/taxi/shuttle), 셔틀 픽업 포인트가 사전 정의되어 있다.

**수동 5건**: 지역 맞춤 구체적 교통 데이터 포함.
**자동 45건**: Lookup Map 기반 + idx 오프셋 좌표.

## 1.2. Booking 페이지 내 Transport Concierge (구현 완료, 2026-02-09)

Booking Flow MVP (`web/app/routes/book.tsx`)에 Transport Concierge 섹션이 구현되었다. Property Detail의 Getting Here 섹션을 간략화한 형태로, 예약 폼 내에서 셔틀 서비스 정보를 제공한다.

**구현 내용:**
- 무료 셔틀 안내 배너 (`bg-primary/5 border-primary/10`)
- "예약 확정 후 셔틀 일정을 조율합니다" 안내 문구
- `listing.pickupPoints` 기반 픽업 포인트 목록 (이름, 설명, 숙소까지 소요 시간)
- `pickupPoints.length > 0`인 경우에만 섹션 표시

**현재 제약:**
- 픽업 포인트 선택 기능 미구현 (정보 안내만 제공)
- 도착 시간 입력 미구현 (예약 확정 후 별도 조율)

**향후 연동:**
- 예약 확정 시 선택한 픽업 포인트 + 도착 시간을 `transport_requests` 테이블에 저장
- 호스트 대시보드 Upcoming Arrivals에 셔틀 요청 표시

## 2. Business Rules
- [ ] **Rule 1**: 셔틀 서비스 제공 여부는 호스트가 숙소 설정에서 활성화/비활성화 가능.
- [ ] **Rule 2**: 셔틀 예약은 숙소 예약 시 부가 서비스(Add-on)로 함께 신청하거나 사후 신청 가능.
- [ ] **Rule 3**: 셔틀은 기본적으로 무료이나, 마을 공동체 운영 정책에 따라 소액의 이용료(Tip) 책정 가능.
- [ ] **Rule 4**: 예약 확정 시 호스트에게 셔틀 요청 내역(인원, 도착 예정 시간)이 즉시 전달됨.
- [ ] **Rule 5**: 로컬 지자체 협력 정류장 정보를 기반으로 정확한 픽업 위치 안내 (Google Maps/Kakao Maps 링크).

## 3. Data Flow

### Shuttle Booking Flow
```
Booking (Listing ID) → Check Transport Support
    ↓
Display Pickup Points (API or Manual Data)
    ↓
User Selects Point & Arrival Time
    ↓
Save to `transport_requests` table
    ↓
Sync with Host Dashboard (Upcoming Arrivals)
```

## 4. Algorithm / Pseudo-code

### 4.1. Shuttle Availability Check
```typescript
function getTransportOptions(listingId: string) {
  const listing = db.query.listings.findFirst({ where: eq(listings.id, listingId) });
  
  if (!listing.transportSupport) return null;

  return {
    shuttleAvailable: true,
    pickupPoints: listing.pickupPoints, // Array of strings or objects {name, lat, lng}
    operatingHours: listing.shuttleHours,
    contact: listing.hostPhone
  };
}
```

### 4.2. Pickup Scheduling
```typescript
async function schedulePickup(bookingId: string, pickupData: { point: string, arrivalTime: number }) {
  // Validate if arrival time is within operating hours
  // ...

  await db.insert(transportRequests).values({
    bookingId,
    pickupPoint: pickupData.point,
    arrivalTime: pickupData.arrivalTime,
    status: 'scheduled',
    createdAt: now()
  });

  // Notify host and village driver (if any)
  notifyShuttleService(bookingId);
}
```

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Concept_&_Design/03_PRODUCT_SPECS.md) - Section 2.2 교통 컨시어지 기획 근거
- **Foundation**: [Happy Path Scenarios](../01_Concept_&_Design/07_HAPPY_PATH_SCENARIOS.md) - 게스트 시나리오 Step 3, 4 (셔틀 예약 및 이용)
- **Prototype**: [Detail Page Review](../02_UI_Screens/01_DETAIL_PAGE_REVIEW.md) - Map Integration 이슈 (Mock으로 해결)
- **Prototype**: [Booking Page Review](../02_UI_Screens/02_BOOKING_PAGE_REVIEW.md) - 셔틀 추가 옵션 선택 UI
- **Prototype**: [Admin Dashboard Review](../02_UI_Screens/03_ADMIN_DASHBOARD_REVIEW.md) - 호스트용 도착 예정 내역 대시보드
- **Specs**: [Property Detail Guide](../03_Technical_Specs/07_PROPERTY_DETAIL_IMPLEMENTATION_GUIDE.md) - Section 4.7-4.8 Mock 지도 및 교통 안내 UI 구현 상세
- **Specs**: [Database Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - 관련 테이블 확장 필요
- **Logic**: [Future Roadmap Memo](./09_FUTURE_ROADMAP_MEMO.md) - Section 2 카카오맵 연동 및 Mock-to-Real 전환 계획
- **Test**: [QA Checklist](../05_QA_&_Validation/02_QA_CHECKLIST.md) - 교통 정보 전달 도달률 체크
