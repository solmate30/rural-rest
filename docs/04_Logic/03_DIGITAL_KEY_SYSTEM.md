# Digital Key System Design (QR Code-Based)
> Created: 2026-02-07 18:30
> Last Updated: 2026-02-07 18:30

## 1. Context
디지털 키 시스템은 게스트가 스마트폰의 QR 코드를 통해 숙소에 직접 체크인할 수 있도록 하는 기능입니다. 이는 특히 글로벌 여행자들의 언어 장벽을 해소하고, 호스트의 운영 부담을 줄이며, 24시간 체크인을 가능하게 합니다.

**관련 UI**: My Trips Page (QR Code Display) → Property Entrance (QR Scanner) → Smart Lock Integration

**프로젝트 가치와의 관계**: 
- 편리함(Convenience)과 환대(Hospitality)의 균형을 맞추는 하이브리드 접근
- QR 코드 체크인으로 시간을 절약하고, 이후 호스트와의 소통 및 활동 참여로 "뜻밖의 환대" 경험 제공

## 2. Business Rules
- [ ] **Rule 1**: QR 코드는 예약 확정(confirmed) 후 체크인 1시간 전부터 활성화됨
- [ ] **Rule 2**: QR 코드는 일회성 토큰으로, 사용 후 즉시 만료되거나 체크아웃 시 자동 만료됨
- [ ] **Rule 3**: QR 코드 접근 시도는 모두 로그로 기록되며, 호스트에게 실시간 알림 전송
- [ ] **Rule 4**: 스마트 도어락이 없는 숙소는 전통적 체크인 방식(호스트 직접 또는 키박스) 사용
- [ ] **Rule 5**: QR 코드 스캔 실패 시 백업 키박스 코드 제공 또는 호스트 연락 옵션 제공
- [ ] **Rule 6**: 호스트는 관리 대시보드에서 스마트 도어락 활성화/비활성화 선택 가능

## 3. Data Flow & State

### QR Code Generation Flow
```
Booking Confirmed (status: 'confirmed')
    ↓
Generate Unique QR Token (UUID + Timestamp)
    ↓
Store in Database (qr_code_token, qr_code_expires_at)
    ↓
Display in "My Trips" Page (1 hour before check-in)
    ↓
Guest Scans QR Code at Property
    ↓
Validate Token (Expiry Check, Booking Status)
    ↓
Trigger Smart Lock API (Unlock Door)
    ↓
Log Access Event
    ↓
Notify Host
    ↓
QR Code Expires (After Check-out or Single Use)
```

### QR Code State Machine
```
[Generated] → [Active] → [Used] → [Expired]
                ↓
            [Failed] → [Backup Key Provided]
```

| State | Description | Trigger |
|-------|-------------|---------|
| `generated` | QR 코드 토큰 생성됨, 아직 활성화 전 | 예약 확정 시 |
| `active` | 체크인 1시간 전부터 사용 가능 | `check_in - 1 hour` |
| `used` | QR 코드 스캔 완료, 도어락 열림 | 스캔 성공 |
| `expired` | 만료됨 (체크아웃 후 또는 일회성 사용) | 체크아웃 시 또는 사용 후 |
| `failed` | 스캔 실패 또는 유효성 검사 실패 | 에러 발생 시 |

## 4. Algorithm / Pseudo-code

### 4.1. QR Code Generation
```typescript
import { DateTime } from 'luxon';
import { z } from 'zod';
import crypto from 'crypto';

const qrCodeSchema = z.object({
  bookingId: z.string().uuid(),
  guestId: z.string().uuid(),
  listingId: z.string().uuid(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  timestamp: z.number().int()
});

async function generateQRCode(bookingId: string) {
  // 1. Fetch booking details
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    with: { listing: true }
  });
  
  if (!booking || booking.status !== 'confirmed') {
    throw new Error("Booking not confirmed");
  }
  
  // 2. Check if listing has smart lock enabled
  if (!booking.listing.smartLockEnabled) {
    return null; // Fallback to traditional check-in
  }
  
  // 3. Generate unique token
  const token = crypto.randomBytes(32).toString('hex');
  const checkInTime = DateTime.fromSeconds(booking.checkIn);
  const activeAt = checkInTime.minus({ hours: 1 }); // 1 hour before check-in
  const expiresAt = DateTime.fromSeconds(booking.checkOut).plus({ hours: 2 }); // 2 hours after check-out
  
  // 4. Store QR code data
  await db.update(bookings)
    .set({
      qrCodeToken: token,
      qrCodeActiveAt: activeAt.toSeconds(),
      qrCodeExpiresAt: expiresAt.toSeconds()
    })
    .where(eq(bookings.id, bookingId));
  
  // 5. Generate QR code image (using qrcode library)
  const qrCodeData = {
    bookingId: booking.id,
    token: token,
    listingId: booking.listingId,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut
  };
  
  const qrCodeImage = await generateQRCodeImage(JSON.stringify(qrCodeData));
  
  return {
    token: token,
    qrCodeImage: qrCodeImage,
    activeAt: activeAt.toISO(),
    expiresAt: expiresAt.toISO()
  };
}
```

### 4.2. QR Code Validation & Door Unlock
```typescript
async function validateAndUnlockQRCode(scannedData: string) {
  // 1. Parse QR code data
  let qrData;
  try {
    qrData = JSON.parse(scannedData);
  } catch {
    throw new Error("Invalid QR code format");
  }
  
  // 2. Validate schema
  const validated = qrCodeSchema.parse(qrData);
  
  // 3. Fetch booking from database
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, validated.bookingId),
    with: { listing: true }
  });
  
  if (!booking) {
    throw new Error("Booking not found");
  }
  
  // 4. Verify token matches
  if (booking.qrCodeToken !== validated.token) {
    await logAccessAttempt(validated.bookingId, 'invalid_token');
    throw new Error("Invalid QR code token");
  }
  
  // 5. Check if QR code is active
  const now = DateTime.now();
  const activeAt = DateTime.fromSeconds(booking.qrCodeActiveAt);
  const expiresAt = DateTime.fromSeconds(booking.qrCodeExpiresAt);
  
  if (now < activeAt) {
    throw new Error(`QR code will be active at ${activeAt.toISO()}`);
  }
  
  if (now > expiresAt) {
    await db.update(bookings)
      .set({ qrCodeToken: null })
      .where(eq(bookings.id, validated.bookingId));
    throw new Error("QR code has expired");
  }
  
  // 6. Check if already used (for single-use tokens)
  if (booking.qrCodeUsed) {
    throw new Error("QR code has already been used");
  }
  
  // 7. Unlock smart lock via API
  const unlockResult = await unlockSmartLock({
    listingId: validated.listingId,
    lockType: booking.listing.smartLockType,
    apiKey: decrypt(booking.listing.smartLockApiKey)
  });
  
  if (!unlockResult.success) {
    await logAccessAttempt(validated.bookingId, 'lock_failure');
    throw new Error("Failed to unlock door. Please contact host.");
  }
  
  // 8. Mark QR code as used
  await db.update(bookings)
    .set({ qrCodeUsed: true })
    .where(eq(bookings.id, validated.bookingId));
  
  // 9. Log successful access
  await logAccessAttempt(validated.bookingId, 'success', {
    timestamp: now.toSeconds(),
    method: 'qr_code'
  });
  
  // 10. Notify host
  await notifyHost(booking.listing.hostId, {
    type: 'guest_checkin',
    bookingId: validated.bookingId,
    guestName: booking.guest.name,
    timestamp: now.toISO()
  });
  
  return {
    success: true,
    message: "Door unlocked successfully"
  };
}
```

### 4.3. Smart Lock API Integration
```typescript
interface SmartLockConfig {
  lockType: 'august' | 'yale' | 'schlage' | 'generic';
  apiKey: string;
  deviceId: string;
}

async function unlockSmartLock(config: SmartLockConfig): Promise<{ success: boolean }> {
  switch (config.lockType) {
    case 'august':
      return await unlockAugustLock(config);
    case 'yale':
      return await unlockYaleLock(config);
    case 'schlage':
      return await unlockSchlageLock(config);
    default:
      // Generic HTTP API call
      return await unlockGenericLock(config);
  }
}

async function unlockAugustLock(config: SmartLockConfig) {
  const response = await fetch(`https://api-production.august.com/locks/${config.deviceId}/unlock`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    return { success: false };
  }
  
  return { success: true };
}
```

### 4.4. Access Logging
```typescript
async function logAccessAttempt(
  bookingId: string,
  status: 'success' | 'invalid_token' | 'expired' | 'lock_failure',
  metadata?: Record<string, any>
) {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId)
  });
  
  const accessLogs = JSON.parse(booking.accessLogs || '[]');
  
  accessLogs.push({
    timestamp: DateTime.now().toSeconds(),
    status: status,
    metadata: metadata || {}
  });
  
  await db.update(bookings)
    .set({ accessLogs: JSON.stringify(accessLogs) })
    .where(eq(bookings.id, bookingId));
}
```

## 5. Database Schema Extensions

### 5.1. Bookings Table Additions
```typescript
// Add to bookings table
qr_code_token: Text [Nullable] // Unique token for QR code
qr_code_active_at: Integer [Nullable] // When QR code becomes active (timestamp)
qr_code_expires_at: Integer [Nullable] // When QR code expires (timestamp)
qr_code_used: Integer (Boolean 0/1) [Default: 0] // Single-use flag
access_logs: Text (JSON Array) [Default: '[]'] // Access attempt logs
```

### 5.2. Listings Table Additions
```typescript
// Add to listings table
smart_lock_enabled: Integer (Boolean 0/1) [Default: 0]
smart_lock_type: Text [Nullable] // 'august', 'yale', 'schlage', 'generic'
smart_lock_api_key: Text [Nullable] // Encrypted API key
smart_lock_device_id: Text [Nullable] // Device identifier
backup_keybox_code: Text [Nullable] // Fallback keybox code
```

## 6. User Experience Flow

### Guest Side
1. **예약 확정 후**: "My Trips" 페이지에서 예약 상세 확인
2. **체크인 1시간 전**: QR 코드가 활성화되어 표시됨
3. **숙소 도착**: QR 코드를 스캔하여 문 열기
4. **실패 시**: 백업 키박스 코드 표시 또는 호스트 연락 옵션

### Host Side
1. **설정**: Property Management에서 스마트 도어락 활성화 및 API 키 입력
2. **모니터링**: Dashboard에서 실시간 체크인 알림 확인
3. **로그 확인**: Access Logs에서 모든 접근 시도 기록 확인

## 7. Edge Cases & Error Handling

### 7.1. QR Code Failure Scenarios
- **인터넷 연결 없음**: 오프라인 모드에서 QR 코드 데이터 저장, 네트워크 복구 시 자동 동기화
- **스마트 도어락 오류**: 백업 키박스 코드 제공 또는 호스트 직접 연락
- **QR 코드 만료**: 체크인 시간 지연 시 호스트에게 연락하여 재생성 요청

### 7.2. Security Considerations
- **토큰 암호화**: QR 코드 토큰은 암호화되어 저장
- **재사용 방지**: 일회성 토큰 또는 시간 기반 만료
- **접근 로그**: 모든 접근 시도 기록으로 보안 감사 가능
- **API 키 보안**: 스마트 도어락 API 키는 암호화되어 저장

## 8. Implementation Phases

### Phase 1: MVP (현재)
- 전통적 체크인 방식 유지
- Auto-Translation Chat으로 언어 장벽 해소

### Phase 2: Digital Key Option (6-12개월)
- 선택적 기능으로 도입
- 스마트 도어락이 있는 숙소만 활성화
- 기본값은 전통적 방식, 필요 시 업그레이드

### Phase 3: Hybrid Model (확장 단계)
- QR 코드 체크인 + 호스트 환대 프로그램 결합
- 체크인은 QR 코드, 이후 활동은 호스트와 소통
- "편리함"과 "환대"의 균형

## 9. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - 체크인 프로세스 명세
- **Foundation**: [Roadmap](../01_Foundation/04_ROADMAP.md) - 단계적 도입 전략
- **Logic**: [Booking State Machine](./01_BOOKING_STATE_MACHINE.md) - 예약 상태 관리
- **Specs**: [Database Schema](../03_Specs/01_DB_SCHEMA.md) - 스키마 확장 사항

## 10. Success Metrics
- **QR 코드 사용률**: 전체 체크인 중 QR 코드 사용 비율
- **체크인 성공률**: QR 코드 스캔 성공률 (목표: 95% 이상)
- **호스트 만족도**: 스마트 도어락 도입 후 호스트 운영 부담 감소 정도
- **게스트 만족도**: 체크인 편의성에 대한 게스트 피드백
