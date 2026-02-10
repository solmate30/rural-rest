# NFT & Gamification Business Logic
> Created: 2026-02-10 16:30
> Last Updated: 2026-02-10 16:30

## 1. Context

### 1.1. 기존 Roadmap 연계
기존 `04_ROADMAP.md` Section 3 (LATER)에 "Gamification: Eco-Points / Rural Stamps"로 예정되어 있던 기능을 Solana 온체인으로 구현한다.

### 1.2. Gamification 목표
- 재방문율 향상: NFT 컬렉션 동기 부여로 다른 숙소 방문 유도
- 브랜드 로열티: 등급 시스템으로 충성 고객 보상
- 바이럴 효과: 유니크한 NFT 공유로 자연스러운 마케팅

---

## 2. Experience Badge NFT

### 2.1. 발행 조건
```
트리거: booking.status === 'completed' (체크아웃 완료)
추가 조건:
  - 사용자에게 동일 숙소+동일 날짜의 NFT가 아직 없을 것
  - booking이 환불/취소되지 않았을 것
```

### 2.2. NFT 메타데이터 구조
Metaplex Token Metadata Standard 준수:
```json
{
    "name": "고성 한옥 스테이 Experience Badge",
    "symbol": "RRXP",
    "description": "2026년 1월, 강원도 고성의 전통 한옥에서 겨울 숙박을 완료했습니다.",
    "image": "https://arweave.net/xxx_generated_image",
    "external_url": "https://ruralrest.com/property/uuid-xxx",
    "attributes": [
        { "trait_type": "Location", "value": "강원도 고성군" },
        { "trait_type": "Stay", "value": "고성 한옥 스테이" },
        { "trait_type": "Check-in", "value": "2026-01-15" },
        { "trait_type": "Check-out", "value": "2026-01-17" },
        { "trait_type": "Season", "value": "Winter" },
        { "trait_type": "Duration", "value": "2 nights" },
        { "trait_type": "Badge Number", "value": "#47" }
    ],
    "properties": {
        "category": "image",
        "collection": { "name": "Rural Rest Experiences", "family": "Rural Rest" }
    }
}
```

### 2.3. Metaplex Collection 구조
- **Collection Name**: "Rural Rest Experiences"
- **Collection Mint**: 1개의 Certified Collection (Verified Creator)
- **NFT Type**: Compressed NFT (Bubblegum) -- 비용 최적화
- **Merkle Tree**: 깊이 20, 버퍼 64 (약 100만 개 수용)

### 2.4. 자동 민팅 트리거
```typescript
// 숙박 완료 처리 시 (스케줄러 또는 호스트 확인 후)
async function onBookingCompleted(booking: Booking) {
    // 1. 기존 로직 (리뷰 요청 이메일 등)
    await sendReviewRequestEmail(booking);

    // 2. NFT 민팅 (지갑 연결된 사용자만)
    const user = await getUser(booking.userId);
    if (user.walletAddress) {
        await mintExperienceBadge(booking, user);
    } else {
        // Custodial: DB에 미발행 기록, 지갑 연결 시 추후 민팅
        await db.insert(nftMints).values({
            id: uuidv4(),
            bookingId: booking.id,
            userId: user.id,
            mintAddress: null, // 미발행
            status: 'pending_wallet',
        });
    }

    // 3. Eco-Points 적립
    await earnEcoPoints(user.id, booking);
}
```

### 2.5. 가스비 처리 전략
| 방식 | 비용 | 채택 |
|------|------|------|
| Regular NFT | ~$0.01/mint | X (대량 발행 시 비효율) |
| **Compressed NFT (cNFT)** | ~$0.0001/mint | O (채택) |
| Merkle Tree 생성 | ~$1.5 (1회) | 깊이 20 기준 |

- Compressed NFT를 사용하여 민팅 비용을 100배 절감
- 가스비는 전액 플랫폼 부담 (서버 키페어로 서명)
- 연간 10,000건 민팅 시 가스비: ~$1 + Merkle Tree 생성비 $1.5

---

## 3. Eco-Points System

### 3.1. 포인트 획득 규칙

| 활동 | 기본 EP | 보너스 조건 | 보너스 |
|------|---------|-----------|--------|
| 숙박 완료 | 1,000 | 7일 이상 장기 체류 | 2x (2,000) |
| 리뷰 작성 | 300 | 사진 3장 이상 포함 | +200 |
| 체험 활동 참여 | 500 | - | - |
| 연속 방문 (3개월 내 재예약) | - | 기본 보상에 추가 | 1.5x |
| 첫 예약 | 500 | 신규 가입 보너스 | 1회 |
| 친구 초대 (추천인) | 1,000 | 피추천인 첫 숙박 완료 시 | 양쪽 지급 |

### 3.2. 포인트 사용 규칙

| 보상 | 필요 EP | 설명 |
|------|---------|------|
| 숙박 할인 쿠폰 10,000원 | 10,000 | 다음 예약 시 적용 |
| 숙박 할인 쿠폰 30,000원 | 25,000 | 다음 예약 시 적용 |
| 체험 활동 무료 1회 | 5,000 | 숙박 중 사용 가능 |
| 한정판 아트 NFT | 25,000 | 시즌별 아트워크 |
| 등급 업그레이드 부스트 | 3,000 | 일시적 보너스 EP 추가 |

### 3.3. 포인트 만료 정책
- 획득일로부터 **12개월** 후 자동 소멸
- 만료 30일 전 알림 (이메일 + 인앱)
- 숙박 또는 포인트 사용 시 만료일 자동 연장 (활동 기반)

### 3.4. 온체인 vs 오프체인 저장 전략

| 데이터 | 저장 위치 | 이유 |
|--------|-----------|------|
| 포인트 잔액 (실시간) | Turso DB | 빈번한 조회, 빠른 응답 |
| 포인트 적립/사용 이력 | Turso DB | 관계형 쿼리, 통계 |
| 월간 정산 결과 | 온체인 (Phase 4) | 투명성, 감사 가능성 |
| 등급 정보 | Turso DB | 빠른 조회, 할인 적용 |

초기에는 오프체인(DB)으로 구현하고, 안정화 후 온체인 정산을 추가한다.

---

## 4. 등급 시스템 (Tier System)

### 4.1. 등급 정의

| 등급 | 필요 EP | 할인율 | 추가 혜택 |
|------|---------|--------|-----------|
| Bronze | 0 - 2,999 | 0% | 기본 서비스 |
| Silver | 3,000 - 9,999 | 5% | 우선 고객 지원 |
| Gold | 10,000 - 29,999 | 10% | 우선 예약 + 무료 체험 1회/분기 |
| Platinum | 30,000+ | 15% | VIP 체험 초대 + 전용 호스트 매칭 |

### 4.2. 등급 산정 알고리즘
```typescript
function calculateTier(totalEcoPoints: number): Tier {
    if (totalEcoPoints >= 30000) return 'platinum';
    if (totalEcoPoints >= 10000) return 'gold';
    if (totalEcoPoints >= 3000) return 'silver';
    return 'bronze';
}

function calculateProgress(currentEP: number, currentTier: Tier): TierProgress {
    const thresholds = { bronze: 0, silver: 3000, gold: 10000, platinum: 30000 };
    const nextTier = getNextTier(currentTier);

    if (!nextTier) return { percent: 100, remaining: 0, nextTier: null };

    const currentThreshold = thresholds[currentTier];
    const nextThreshold = thresholds[nextTier];
    const range = nextThreshold - currentThreshold;
    const progress = currentEP - currentThreshold;

    return {
        percent: Math.min(100, Math.round((progress / range) * 100)),
        remaining: Math.max(0, nextThreshold - currentEP),
        nextTier,
    };
}
```

### 4.3. 등급 유지 조건
- 연간 최소 1회 숙박 완료 필요
- 12개월간 숙박 없으면 한 단계 강등 (Platinum -> Gold 등)
- 강등 30일 전 경고 알림
- Bronze는 최하 등급이므로 강등 없음

---

## 5. NFT Minting Flow

### 5.1. mintExperienceBadge 전체 흐름
```typescript
async function mintExperienceBadge(booking: Booking, user: User) {
    // 1. 메타데이터 생성
    const metadata = buildNFTMetadata(booking);

    // 2. 메타데이터 업로드 (Irys -> Arweave)
    const metadataUri = await uploadMetadata(metadata);

    // 3. Compressed NFT 민팅
    const mintResult = await mintCompressedNFT({
        merkleTree: EXPERIENCE_MERKLE_TREE,
        collectionMint: EXPERIENCE_COLLECTION_MINT,
        recipient: new PublicKey(user.walletAddress),
        metadataUri,
        name: metadata.name,
        symbol: 'RRXP',
        creators: [{ address: PLATFORM_PUBKEY, share: 100, verified: true }],
    });

    // 4. DB 기록
    await db.insert(nftMints).values({
        id: uuidv4(),
        bookingId: booking.id,
        userId: user.id,
        mintAddress: mintResult.assetId,
        metadataUri,
        collection: 'experience',
        status: 'minted',
        mintedAt: new Date().toISOString(),
    });

    // 5. 사용자 알림
    await notifyUser(user.id, {
        type: 'nft_minted',
        title: 'Experience Badge를 받았어요!',
        body: `${booking.listingTitle} 숙박 NFT가 지갑에 도착했습니다.`,
    });
}
```

### 5.2. Compressed NFT 비용 최적화
- Bubblegum `mintV1` 인스트럭션 사용
- Merkle Tree는 1회 생성 후 재사용 (약 100만 개 수용)
- 민팅 트랜잭션: 서버 키페어로 서명 (사용자 서명 불필요)

### 5.3. 메타데이터 업로드 (Irys)
```typescript
async function uploadMetadata(metadata: NFTMetadata): Promise<string> {
    const irys = new Irys({ url: IRYS_RPC_URL, token: 'solana', key: minterKeypair });
    const receipt = await irys.upload(JSON.stringify(metadata), {
        tags: [{ name: 'Content-Type', value: 'application/json' }],
    });
    return `https://arweave.net/${receipt.id}`;
}
```

---

## 6. DB Schema

### 6.1. `nft_mints` 테이블
```typescript
export const nftMints = sqliteTable("nft_mints", {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    userId: text("user_id").notNull().references(() => user.id),
    mintAddress: text("mint_address"),              // cNFT asset ID (null if pending)
    metadataUri: text("metadata_uri"),
    collection: text("collection", { enum: ["experience", "art", "special"] }).notNull(),
    status: text("status", { enum: ["pending_wallet", "minting", "minted", "failed"] }).notNull(),
    mintedAt: text("minted_at"),
    createdAt: text("created_at").default(sql`(current_timestamp)`),
});
```

### 6.2. `eco_points` 테이블
```typescript
export const ecoPoints = sqliteTable("eco_points", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().unique().references(() => user.id),
    balance: integer("balance").default(0),
    totalEarned: integer("total_earned").default(0),
    totalSpent: integer("total_spent").default(0),
    tier: text("tier", { enum: ["bronze", "silver", "gold", "platinum"] }).default("bronze"),
    lastActivityAt: text("last_activity_at"),
    updatedAt: text("updated_at"),
});
```

### 6.3. `eco_point_transactions` 테이블
```typescript
export const ecoPointTransactions = sqliteTable("eco_point_transactions", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id),
    type: text("type", { enum: ["earn", "spend", "expire"] }).notNull(),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),       // "booking_complete", "review", "coupon_exchange" 등
    bookingId: text("booking_id"),
    expiresAt: text("expires_at"),          // 획득일 + 12개월
    createdAt: text("created_at").default(sql`(current_timestamp)`),
});
```

---

## 7. Related Documents
- **Foundation**: [Blockchain Vision](../01_Concept_Design/08_BLOCKCHAIN_VISION.md) - NFT/Gamification 전략
- **Foundation**: [Blockchain Roadmap](../01_Concept_Design/09_BLOCKCHAIN_ROADMAP.md) - Phase 2 마일스톤
- **Prototype**: [NFT Gallery Review](../02_UI_Screens/07_NFT_GALLERY_REVIEW.md) - NFT/포인트 UI
- **Specs**: [Blockchain Infra Spec](../03_Technical_Specs/08_BLOCKCHAIN_INFRA_SPEC.md) - Metaplex/Bubblegum 스택
- **Test**: [Blockchain Test Scenarios](../05_QA_Validation/06_BLOCKCHAIN_TEST_SCENARIOS.md) - TC-BC-020~034
