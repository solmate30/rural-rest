/**
 * 기존 메시지 재번역 스크립트
 * 실행: cd web && npx tsx scripts/retranslate-messages.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";
process.env.TURSO_AUTH_TOKEN = "";

async function main() {
    const { db } = await import("../app/db/index.server");
    const { messages, bookings, listings, user } = await import("../app/db/schema");
    const { eq } = await import("drizzle-orm");
    const { translateText } = await import("../app/lib/translation.server");

    // 모든 메시지 + 예약 + 수신자 정보 조회
    const rows = await db
        .select({
            messageId: messages.id,
            senderId: messages.senderId,
            originalContent: messages.originalContent,
            bookingId: messages.bookingId,
            guestId: bookings.guestId,
            hostId: listings.hostId,
        })
        .from(messages)
        .innerJoin(bookings, eq(messages.bookingId, bookings.id))
        .innerJoin(listings, eq(bookings.listingId, listings.id));

    console.log(`메시지 ${rows.length}개 재번역 시작\n`);

    for (const row of rows) {
        const receiverId = row.senderId === row.guestId ? row.hostId : row.guestId;

        const receiver = await db
            .select({ preferredLang: user.preferredLang })
            .from(user)
            .where(eq(user.id, receiverId))
            .get();

        const targetLang = receiver?.preferredLang ?? "en";
        const { translated, success } = await translateText(row.originalContent, targetLang);

        await db
            .update(messages)
            .set({
                translatedContent: success ? translated : null,
                isTranslationSuccess: success,
            })
            .where(eq(messages.id, row.messageId));

        console.log(`  ✓ [→${targetLang}] "${row.originalContent.slice(0, 30)}..." → "${(translated ?? "").slice(0, 30)}..."`);
    }

    console.log(`\n✅ 완료`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
