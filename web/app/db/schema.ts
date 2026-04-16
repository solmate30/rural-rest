import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const user = sqliteTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    role: text("role", { enum: ["guest", "spv", "operator", "admin"] }).notNull().default("guest"),
    preferredLang: text("preferred_lang").notNull().default("en"),
    walletAddress: text("wallet_address"), // Solana 지갑 주소
    walletConnectedAt: text("wallet_connected_at"), // 지갑 연결 시간
    kycVerified: integer("kyc_verified", { mode: "boolean" }).notNull().default(false),
    kycVerifiedAt: text("kyc_verified_at"),
    walletNonce: text("wallet_nonce"),               // SIWS 서명 챌린지용 일회성 nonce
    walletNonceIssuedAt: text("wallet_nonce_issued_at"), // nonce 발급 시각 (5분 TTL)
    privyDid: text("privy_did").unique(),            // Privy DID (did:privy:xxx)
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id),
});

export const account = sqliteTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const listings = sqliteTable("listings", {
    id: text("id").primaryKey(), // UUID v4
    hostId: text("host_id").notNull().references(() => user.id), // SPV 계정 (법적 주체)
    operatorId: text("operator_id").references(() => user.id),   // 마을 운영자 계정 (실제 운영·정산)
    title: text("title").notNull(),
    description: text("description").notNull(),
    pricePerNight: integer("price_per_night").notNull(), // Stored in KRW/USD base unit (e.g., Won)
    valuationKrw: integer("valuation_krw"),             // 매물 감정가 (KRW), 토큰 발행 전 admin 설정
    maxGuests: integer("max_guests").notNull(),
    location: text("location").notNull(),
    region: text("region").notNull().default("기타"), // "경상" | "경기" | "강원" | "충청" | "전라" | "제주" | "기타"
    amenities: text("amenities", { mode: "json" }).notNull().default("[]"), // Array of strings
    images: text("images", { mode: "json" }).notNull().default("[]"), // Array of URLs
    lat: real("lat"),  // GPS 위도 (nullable)
    lng: real("lng"),  // GPS 경도 (nullable)
    renovationHistory: text("renovation_history", { mode: "json" }).default("[]"), // [{ date: "2025.06", desc: "..." }]
    transportSupport: integer("transport_support", { mode: "boolean" }).notNull().default(false),
    smartLockEnabled: integer("smart_lock_enabled", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const bookings = sqliteTable("bookings", {
    id: text("id").primaryKey(), // UUID v4
    listingId: text("listing_id").notNull().references(() => listings.id),
    guestId: text("guest_id").notNull().references(() => user.id),
    checkIn: integer("check_in", { mode: "timestamp" }).notNull(), // Unix timestamp
    checkOut: integer("check_out", { mode: "timestamp" }).notNull(), // Unix timestamp
    totalPrice: integer("total_price").notNull(),
    totalPriceUsdc: integer("total_price_usdc"),       // micro-USDC (결제 후 저장)
    escrowPda: text("escrow_pda"),                      // BookingEscrow PDA pubkey
    onchainPayTx: text("onchain_pay_tx"),               // 결제 tx 서명
    status: text("status", { enum: ["pending", "confirmed", "cancelled", "completed"] }).notNull().default("pending"),
    paymentIntentId: text("payment_intent_id"),             // PayPal Order ID
    paypalAuthorizationId: text("paypal_authorization_id"), // PayPal Authorization ID (capture/void용)
    platformFeeKrw: integer("platform_fee_krw"),            // 플랫폼 수수료 10% (KRW, 카드 결제 시 기록)
    qrCodeToken: text("qr_code_token"),
    qrCodeExpiresAt: integer("qr_code_expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const reviews = sqliteTable("reviews", {
    id: text("id").primaryKey(), // UUID v4
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    authorId: text("author_id").notNull().references(() => user.id),
    rating: integer("rating").notNull(), // 1-5
    comment: text("comment"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const activities = sqliteTable("activities", {
    id: text("id").primaryKey(), // UUID v4
    listingId: text("listing_id").notNull().references(() => listings.id),
    title: text("title").notNull(),
    description: text("description"),
    price: integer("price").notNull(),
    maxParticipants: integer("max_participants"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const messages = sqliteTable("messages", {
    id: text("id").primaryKey(), // UUID v4
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    senderId: text("sender_id").notNull().references(() => user.id),
    originalContent: text("original_content").notNull(),
    translatedContent: text("translated_content"),
    isTranslationSuccess: integer("is_translation_success", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const transportRequests = sqliteTable("transport_requests", {
    id: text("id").primaryKey(), // UUID v4
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    pickupPoint: text("pickup_point").notNull(),
    arrivalTime: integer("arrival_time", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["scheduled", "completed", "cancelled"] }).notNull().default("scheduled"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const aiChatThreads = sqliteTable("ai_chat_threads", {
    id: text("id").primaryKey(), // UUID v4 or Custom Thread ID
    userId: text("user_id").notNull().references(() => user.id),
    title: text("title"),
    metadata: text("metadata", { mode: "json" }).default("{}"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const aiChatMessages = sqliteTable("ai_chat_messages", {
    id: text("id").primaryKey(), // UUID v4
    threadId: text("thread_id").notNull().references(() => aiChatThreads.id),
    role: text("role", { enum: ["system", "user", "assistant", "tool"] }).notNull(),
    content: text("content").notNull(),
    metadata: text("metadata", { mode: "json" }).default("{}"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// =====================
// RWA 토큰화
// =====================

// 매물별 RWA 토큰 정보 (온체인 PropertyToken 계정과 1:1 대응)
export const rwaTokens = sqliteTable("rwa_tokens", {
    id: text("id").primaryKey(), // UUID v4
    listingId: text("listing_id").notNull().references(() => listings.id),
    tokenMint: text("token_mint").unique(), // SPL Token Mint 주소 (null = 온체인 미초기화)
    symbol: text("symbol").unique(),       // 토큰 심볼 (RURAL-3000, RURAL-3001, ...)
    totalSupply: integer("total_supply").notNull(),
    tokensSold: integer("tokens_sold").notNull().default(0),
    valuationKrw: integer("valuation_krw").notNull(),
    pricePerTokenUsdc: integer("price_per_token_usdc").notNull(), // micro-USDC (6자리)
    status: text("status", {
        enum: ["draft", "funding", "funded", "active", "failed"],
    }).notNull().default("draft"),
    fundingDeadline: integer("funding_deadline", { mode: "timestamp" }).notNull(),
    estimatedApyBps: integer("estimated_apy_bps").notNull().default(0), // 예상 연수익률 (basis points, 820 = 8.2%)
    minFundingBps: integer("min_funding_bps").notNull().default(6000), // 60%
    programId: text("program_id").notNull(), // Anchor 프로그램 ID
    lastSettlementAt: integer("last_settlement_at", { mode: "timestamp" }), // 마지막 정산 시각
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// 투자자별 투자 내역 (온체인 InvestorPosition과 동기화)
export const rwaInvestments = sqliteTable("rwa_investments", {
    id: text("id").primaryKey(), // UUID v4
    walletAddress: text("wallet_address").notNull(), // Solana pubkey (primary identity)
    userId: text("user_id").references(() => user.id), // nullable — Better Auth 연동 시에만
    rwaTokenId: text("rwa_token_id").notNull().references(() => rwaTokens.id),
    tokenAmount: integer("token_amount").notNull(),
    investedUsdc: integer("invested_usdc").notNull(), // micro-USDC
    purchaseTx: text("purchase_tx"), // Solana 트랜잭션 서명
    refundTx: text("refund_tx"), // 환불 트랜잭션 서명
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// 월별 배당 내역
export const rwaDividends = sqliteTable("rwa_dividends", {
    id: text("id").primaryKey(), // UUID v4
    walletAddress: text("wallet_address").notNull(), // Solana pubkey
    userId: text("user_id").references(() => user.id), // nullable
    rwaTokenId: text("rwa_token_id").notNull().references(() => rwaTokens.id),
    month: text("month").notNull(), // "2026-03" 형식
    dividendUsdc: integer("dividend_usdc").notNull(), // micro-USDC
    claimTx: text("claim_tx"), // Solana 트랜잭션 서명 (null = 미수령)
    claimedAt: integer("claimed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// =====================
// 정산 (운영자 / 지자체)
// =====================

// 월별 운영자 정산 내역 (영업이익의 30% → 마을 운영자)
// 어드민이 직접 전송(push)하고 tx 서명을 기록 — 클레임 불필요
export const operatorSettlements = sqliteTable("operator_settlements", {
    id: text("id").primaryKey(), // UUID v4
    operatorId: text("operator_id").notNull().references(() => user.id),
    listingId: text("listing_id").notNull().references(() => listings.id),
    month: text("month").notNull(),                          // "2026-03" 형식
    grossRevenueKrw: integer("gross_revenue_krw").notNull(), // 해당 월 숙박 매출 합계
    operatingCostKrw: integer("operating_cost_krw").notNull().default(0), // 운영비 (청소, 공과금, 소모품 등)
    operatingProfitKrw: integer("operating_profit_krw").notNull(), // 영업이익 = 매출 - 운영비
    settlementUsdc: integer("settlement_usdc").notNull(),    // 운영자 몫 micro-USDC (영업이익 × 30%)
    payoutTx: text("payout_tx"),                             // Solana 전송 tx 서명 (null = 미전송)
    paidAt: integer("paid_at", { mode: "timestamp" }),       // 자동 지급 시각
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// 월별 지자체 분배 내역 (영업이익의 40% → 지자체 고정 지갑)
// 어드민이 고정 지갑으로 직접 전송(push) — 클레임 불필요
export const localGovSettlements = sqliteTable("local_gov_settlements", {
    id: text("id").primaryKey(), // UUID v4
    listingId: text("listing_id").notNull().references(() => listings.id),
    month: text("month").notNull(),                           // "2026-03" 형식
    grossRevenueKrw: integer("gross_revenue_krw").notNull(),
    operatingProfitKrw: integer("operating_profit_krw").notNull(),
    settlementUsdc: integer("settlement_usdc").notNull(),     // 지자체 몫 micro-USDC (영업이익 × 40%)
    govWalletAddress: text("gov_wallet_address"),             // 지자체 수령 지갑 (환경변수로 관리)
    payoutTx: text("payout_tx"),                             // Solana 전송 tx 서명
    paidAt: integer("paid_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});
