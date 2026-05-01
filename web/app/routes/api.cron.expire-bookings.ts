import { db } from "~/db/index.server";
import { bookings } from "~/db/schema";
import { and, eq, isNull, isNotNull, lte, or } from "drizzle-orm";
import { cancelBookingEscrow } from "~/lib/cancel-booking-escrow.server";

/**
 * GET /api/cron/expire-bookings
 *
 * Vercel Cron Job — 매일 05:00 UTC 실행
 * 만료된 pending 예약을 자동 취소:
 *   - onchainPayTx 없음 + 2시간 이상 경과: Blinks 서명 포기 건 (on-chain 에스크로 없음 → DB만 취소)
 *   - onchainPayTx 있음 + 48시간 이상 경과: 호스트 미승인 건 (on-chain 에스크로 환불 후 취소)
 *   - 체크인 날짜가 이미 지난 pending: 어느 경우든 취소
 * Authorization: Bearer <CRON_SECRET> 헤더로 인증
 */
export async function loader({ request }: { request: Request }) {
    if (!process.env.CRON_SECRET) {
        console.error("[cron/expire-bookings] CRON_SECRET 환경변수 미설정");
        return Response.json({ error: "서버 설정 오류" }, { status: 500 });
    }
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const stale = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
            and(
                eq(bookings.status, "pending"),
                or(
                    and(isNull(bookings.onchainPayTx), lte(bookings.createdAt, twoHoursAgo)),
                    and(isNotNull(bookings.onchainPayTx), lte(bookings.createdAt, fortyEightHoursAgo)),
                    lte(bookings.checkIn, now),
                ),
            ),
        );

    if (stale.length === 0) {
        return Response.json({ ok: true, processed: 0, succeeded: [], failed: [] });
    }

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const { id } of stale) {
        const result = await cancelBookingEscrow(id);
        if (result.ok) {
            succeeded.push(id);
        } else {
            failed.push({ id, error: result.error });
        }
    }

    console.info(
        `[cron/expire-bookings] 처리=${stale.length} 성공=${succeeded.length} 실패=${failed.length}`,
    );

    return Response.json({ ok: true, processed: stale.length, succeeded, failed });
}
