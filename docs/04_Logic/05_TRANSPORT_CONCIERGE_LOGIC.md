# Transport Concierge Logic Design
> Created: 2026-02-07 21:00
> Last Updated: 2026-02-07 21:00

## 1. Context
농촌 지역의 가장 큰 문제점인 '접근성(Accessibility)'을 해결하기 위한 기능입니다. 대중교통이 불편한 숙소를 위해 마을 입구(터미널/기차역)에서 숙소까지의 셔틀 서비스를 예약하거나 로컬 교통 정보를 제공합니다.

**관련 UI**: Booking Checkout Flow (Shuttle Add-on) → My Trips Page (Shuttle Status) → Admin Dashboard (Shuttle Schedule)

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
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - Section 2.2 교통 컨시어지 기획 근거
- **Foundation**: [Happy Path Scenarios](../01_Foundation/07_HAPPY_PATH_SCENARIOS.md) - 게스트 시나리오 Step 3, 4 (셔틀 예약 및 이용)
- **Prototype**: [Booking Page Review](../02_Prototype/02_BOOKING_PAGE_REVIEW.md) - 셔틀 추가 옵션 선택 UI
- **Prototype**: [Admin Dashboard Review](../02_Prototype/03_ADMIN_DASHBOARD_REVIEW.md) - 호스트용 도착 예정 내역 대시보드
- **Specs**: [Database Schema](../03_Specs/01_DB_SCHEMA.md) - 관련 테이블 확장 필요
- **Test**: [QA Checklist](../05_Test/02_QA_CHECKLIST.md) - 교통 정보 전달 도달률 체크
