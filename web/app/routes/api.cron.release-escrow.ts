import { db } from "~/db/index.server";
import { bookings } from "~/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { releaseBooking } from "~/lib/escrow-release.server";

/**
 * GET /api/cron/release-escrow
 *
 * Vercel Cron Job — 매일 02:00 UTC 실행
 * 체크아웃 날짜가 지났으나 아직 confirmed 상태인 예약을 일괄 completed 처리.
 * Authorization: Bearer <CRON_SECRET> 헤더로 인증
 */
export async function loader({ request }: { request: Request }) {
    const auth = request.headers.get("authorization");
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    const overdueBookings = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
            and(
                eq(bookings.status, "confirmed"),
                lte(bookings.checkOut, now),
            ),
        );

    if (overdueBookings.length === 0) {
        return Response.json({ ok: true, processed: 0, succeeded: [], failed: [] });
    }

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const { id } of overdueBookings) {
        const result = await releaseBooking(id);
        if (result.ok) {
            succeeded.push(id);
        } else {
            failed.push({ id, error: result.error });
        }
    }

    console.info(
        `[cron/release-escrow] 처리=${overdueBookings.length} 성공=${succeeded.length} 실패=${failed.length}`,
    );

    return Response.json({ ok: true, processed: overdueBookings.length, succeeded, failed });
}
