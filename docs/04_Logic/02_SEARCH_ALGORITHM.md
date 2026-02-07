# Search Algorithm Design
> Created: 2026-02-07 18:00
> Last Updated: 2026-02-07 19:00

## 1. Context
검색 알고리즘은 Rural Rest 플랫폼의 핵심 기능으로, 게스트가 원하는 조건(위치, 날짜, 인원수)에 맞는 숙소를 효율적으로 찾아주는 역할을 합니다. 특히 날짜 기반 가용성 필터링과 다양한 정렬 옵션을 제공합니다.

**관련 UI**: Landing Page (Quick Search) → Search Results Page → Property Detail Page

## 2. Business Rules
- [ ] **Rule 1**: 검색 결과는 선택한 날짜 범위에 예약 가능한 숙소만 표시
- [ ] **Rule 2**: 기본 정렬은 "인기도" (예약 수 + 평점 기반)
- [ ] **Rule 3**: 가격 필터는 선택한 범위 내의 숙소만 표시 (최소-최대)
- [ ] **Rule 4**: 위치 검색은 마을명 또는 주소 키워드로 부분 일치 검색
- [ ] **Rule 5**: 인원수 필터는 `max_guests >= 검색 인원수` 조건 적용

## 3. Data Flow & State

### Search Flow
```
User Input (Location, Dates, Guests)
    ↓
Zod Validation
    ↓
Query Database (with filters)
    ↓
Filter by Availability (Date Range)
    ↓
Apply Sorting & Pagination
    ↓
Return Results + Total Count
```

### Search State Management
```typescript
interface SearchState {
  location: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  guests: number;
  filters: {
    roomType: 'dorm' | 'private' | 'all';
    priceRange: [number, number] | null;
    amenities: string[];
  };
  sortBy: 'popularity' | 'price_low' | 'price_high' | 'rating';
  page: number;
  limit: number;
}
```

## 4. Algorithm / Pseudo-code

### 4.1. Main Search Function
```typescript
import { DateTime } from 'luxon';
import { z } from 'zod';

const searchSchema = z.object({
  location: z.string().optional(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guests: z.number().int().min(1).default(1),
  roomType: z.enum(['dorm', 'private', 'all']).default('all'),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  sortBy: z.enum(['popularity', 'price_low', 'price_high', 'rating']).default('popularity'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20)
});

async function searchListings(params: SearchParams) {
  // 1. Validate input with Zod
  const validated = searchSchema.parse(params);
  
  // 2. Parse dates with Luxon (timezone-aware)
  const checkIn = DateTime.fromISO(validated.checkIn);
  const checkOut = DateTime.fromISO(validated.checkOut);
  
  // 3. Build base query
  let query = db.select()
    .from(listings)
    .where(eq(listings.isActive, true));
  
  // 4. Apply location filter (if provided)
  if (validated.location) {
    query = query.where(
      or(
        like(listings.location, `%${validated.location}%`),
        like(listings.title, `%${validated.location}%`)
      )
    );
  }
  
  // 5. Apply guest capacity filter
  query = query.where(gte(listings.maxGuests, validated.guests));
  
  // 6. Apply price range filter
  if (validated.priceMin) {
    query = query.where(gte(listings.pricePerNight, validated.priceMin));
  }
  if (validated.priceMax) {
    query = query.where(lte(listings.pricePerNight, validated.priceMax));
  }
  
  // 7. Apply room type filter (if needed - requires room_types table join)
  // This is simplified - actual implementation may require join
  
  // 8. Execute query to get candidate listings
  const candidates = await query;
  
  // 9. Filter by availability (date range check)
  const availableListings = await filterByAvailability(
    candidates,
    checkIn,
    checkOut
  );
  
  // 10. Apply sorting
  const sortedListings = sortListings(availableListings, validated.sortBy);
  
  // 11. Apply pagination
  const start = (validated.page - 1) * validated.limit;
  const end = start + validated.limit;
  const paginatedListings = sortedListings.slice(start, end);
  
  return {
    listings: paginatedListings,
    totalCount: sortedListings.length,
    page: validated.page,
    totalPages: Math.ceil(sortedListings.length / validated.limit)
  };
}
```

### 4.2. Availability Filter Function
```typescript
async function filterByAvailability(
  listings: Listing[],
  checkIn: DateTime,
  checkOut: DateTime
): Promise<Listing[]> {
  const availableListings: Listing[] = [];
  
  for (const listing of listings) {
    // Check if there are any overlapping bookings
    const overlappingBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.listingId, listing.id),
        eq(bookings.status, 'confirmed'), // Only check confirmed bookings
        or(
          // Check-in overlaps
          and(
            gte(bookings.checkIn, checkIn.toSeconds()),
            lt(bookings.checkIn, checkOut.toSeconds())
          ),
          // Check-out overlaps
          and(
            gt(bookings.checkOut, checkIn.toSeconds()),
            lte(bookings.checkOut, checkOut.toSeconds())
          ),
          // Booking spans entire search period
          and(
            lte(bookings.checkIn, checkIn.toSeconds()),
            gte(bookings.checkOut, checkOut.toSeconds())
          )
        )
      )
    });
    
    // If no overlapping bookings, listing is available
    if (overlappingBookings.length === 0) {
      availableListings.push(listing);
    }
  }
  
  return availableListings;
}
```

### 4.3. Sorting Functions
```typescript
function sortListings(
  listings: Listing[],
  sortBy: 'popularity' | 'price_low' | 'price_high' | 'rating'
): Listing[] {
  const sorted = [...listings];
  
  switch (sortBy) {
    case 'popularity':
      // Sort by: (booking_count * 0.6) + (avg_rating * 0.4)
      return sorted.sort((a, b) => {
        const scoreA = (a.bookingCount || 0) * 0.6 + (a.avgRating || 0) * 0.4;
        const scoreB = (b.bookingCount || 0) * 0.6 + (b.avgRating || 0) * 0.4;
        return scoreB - scoreA; // Descending
      });
      
    case 'price_low':
      return sorted.sort((a, b) => a.pricePerNight - b.pricePerNight);
      
    case 'price_high':
      return sorted.sort((a, b) => b.pricePerNight - a.pricePerNight);
      
    case 'rating':
      return sorted.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
      
    default:
      return sorted;
  }
}
```

### 4.4. Optimized SQL Query (Alternative Approach)
```sql
-- Single query with JOIN for better performance
SELECT 
  l.*,
  COUNT(DISTINCT b.id) as booking_count,
  AVG(r.rating) as avg_rating
FROM listings l
LEFT JOIN bookings b ON (
  b.listing_id = l.id 
  AND b.status = 'confirmed'
  AND (
    (b.check_in >= ? AND b.check_in < ?) OR
    (b.check_out > ? AND b.check_out <= ?) OR
    (b.check_in <= ? AND b.check_out >= ?)
  )
)
LEFT JOIN reviews r ON r.booking_id = b.id
WHERE 
  l.is_active = 1
  AND l.max_guests >= ?
  AND (? IS NULL OR l.location LIKE ?)
  AND (? IS NULL OR l.price_per_night >= ?)
  AND (? IS NULL OR l.price_per_night <= ?)
GROUP BY l.id
HAVING COUNT(DISTINCT b.id) = 0  -- No overlapping bookings
ORDER BY 
  CASE WHEN ? = 'popularity' THEN (booking_count * 0.6 + avg_rating * 0.4) END DESC,
  CASE WHEN ? = 'price_low' THEN l.price_per_night END ASC,
  CASE WHEN ? = 'price_high' THEN l.price_per_night END DESC,
  CASE WHEN ? = 'rating' THEN avg_rating END DESC
LIMIT ? OFFSET ?;
```

## 5. Performance Considerations
- **Caching**: 인기 검색어 결과는 Redis에 캐싱 (TTL: 1시간)
- **Indexing**: `listings.location`, `listings.max_guests`, `listings.price_per_night`에 인덱스 생성
- **Pagination**: 대량 결과 처리를 위한 커서 기반 페이지네이션 고려
- **Date Range Optimization**: 날짜 범위가 넓을 경우 배치 처리로 분할

## 6. Edge Cases
- **Empty Search**: 모든 필터 제거 시 인기 숙소 목록 반환
- **No Results**: 검색 결과 없을 때 유사한 대안 제안 (날짜 조정, 위치 확대)
- **Invalid Date Range**: checkOut이 checkIn보다 이전인 경우 에러 반환
- **Timezone Handling**: Luxon을 사용하여 사용자 타임존에 맞게 날짜 처리

## 7. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - 검색 기능 명세 및 사이트맵 (Section 3.A.2)
- **Prototype**: [Landing Page Review](../02_Prototype/00_LANDING_PAGE_REVIEW.md) - 검색 바 UI 프로토타입
- **Specs**: [Database Schema](../03_Specs/01_DB_SCHEMA.md) - `listings` 테이블 구조 및 인덱스 설계
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - Search Results API 엔드포인트 (Section 3.2)
- **Logic**: [Booking State Machine](./01_BOOKING_STATE_MACHINE.md) - 가용성 필터링 로직 참조
- **Test**: [Test Scenarios](../05_Test/01_TEST_SCENARIOS.md) - 검색 관련 테스트 케이스 (Section 2.1)
