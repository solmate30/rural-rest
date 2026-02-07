# Auto-Translation Chat Logic Design
> Created: 2026-02-07 20:59
> Last Updated: 2026-02-07 20:59

## 1. Context
글로벌 게스트와 로컬 호스트 간의 원활한 소통을 위해 채팅 메시지를 실시간으로 번역하는 시스템입니다. 언어 장벽을 낮추어 농촌의 '뜻밖의 환대'를 게스트가 온전히 경험하게 하는 것을 목표로 합니다.

**관련 UI**: Property Detail Page (Inquiry) → My Trips Page (Chat Tab) → Admin Dashboard (Messages Tab)

## 2. Business Rules
- [ ] **Rule 1**: 게스트가 메시지 전송 시, 호스트의 기본 설정 언어(Default: 한국어)로 자동 번역.
- [ ] **Rule 2**: 호스트가 응답 시, 게스트의 브라우저 언어 또는 프로필 언어로 자동 번역.
- [ ] **Rule 3**: 원문(Original)과 번역문(Translated)을 모두 DB에 저장하여 필요 시 '원문 보기' 제공.
- [ ] **Rule 4**: 번역 API 호출 실패 시 원문만 전송하고 에러 로그 기록.
- [ ] **Rule 5**: 번역 품질 향상을 위해 전문 용어(예: 숙소 용어, 농촌 체험명)에 대한 고정 용어집(Glossary) 활용 고려.

## 3. Data Flow & Integration

### Chat Flow Diagram
```
Client A (Source Lang) → Server → Translation API (DeepL/Google)
                                       ↓
Server (Save Original + Trans) ← Translation Result
     ↓
Client B (Target Lang) → UI Displays Translated Text (+ Original toggle)
```

## 4. Algorithm / Pseudo-code

### 4.1. Translation Process
```typescript
async function translateMessage(text: string, sourceLang: string, targetLang: string) {
  // 1. Check if languages are different
  if (sourceLang === targetLang) return text;

  try {
    // 2. Call Translation API (e.g., DeepL)
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang.toUpperCase()
      }),
      headers: { 'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}` }
    });
    
    const result = await response.json();
    return result.translations[0].text;
  } catch (error) {
    console.error("Translation failed:", error);
    return null; // Handle failure in caller
  }
}
```

### 4.2. Message Submission (Server Action)
```typescript
async function sendMessage(bookingId: string, senderId: string, content: string) {
  const booking = await db.query.bookings.findFirst(...);
  const targetUser = (senderId === booking.guestId) ? booking.listing.host : booking.guest;

  // Real-time Translation
  const translatedContent = await translateMessage(
    content,
    currentUser.preferredLang,
    targetUser.preferredLang
  );

  // Save to DB
  await db.insert(messages).values({
    bookingId,
    senderId,
    originalContent: content,
    translatedContent: translatedContent || "", // Null if failed
    isTranslationSuccess: !!translatedContent,
    createdAt: now()
  });

  // Push notification through Socket.io or Server-Sent Events
  notifyUser(targetId, { ... });
}
```

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - Section 2.2 자동 번역 채팅 기획 근거
- **Prototype**: [Detail Page Review](../02_Prototype/01_DETAIL_PAGE_REVIEW.md) - 채팅 진입점 UI
- **Prototype**: [Admin Dashboard Review](../02_Prototype/03_ADMIN_DASHBOARD_REVIEW.md) - 호스트 채팅 관리 UI
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - API 엔드포인트 참조
- **Test**: [Test Scenarios](../05_Test/01_TEST_SCENARIOS.md) - TC-G-012, 013 번역 테스트 케이스
