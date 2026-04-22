import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings, listings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { releaseBooking } from "~/lib/escrow-release.server";

/**
 * POST /api/booking/release-escrow
 * Body: { bookingId }
 *
 * 체크아웃 후 예약을 completed 처리.
 * - USDC 예약: 온체인 releaseBookingEscrow → 90% listing_vault(월정산 대기) / 10% treasury
 * - 카드 예약: DB 상태만 completed 전환 (PayPal은 승인 시 이미 capture됨)
 * admin / spv / operator 만 호출 가능.
 */
export async function action({ request }: { request: Request }) {
    const currentUser = await requireUser(request, ["admin", "spv", "operator"]);

    const { bookingId } = (await request.json()) as { bookingId: string };
    if (!bookingId) return Response.json({ error: "bookingId 필요" }, { status: 400 });

    const [booking] = await db
        .select({
            id: bookings.id,
            status: bookings.status,
            checkOut: bookings.checkOut,
            listingId: bookings.listingId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return Response.json({ error: "예약 없음" }, { status: 404 });
    if (booking.status !== "confirmed") return Response.json({ error: "확정된 예약이 아닙니다" }, { status: 400 });
    if (booking.checkOut > new Date()) return Response.json({ error: "체크아웃 이후에 정산 가능합니다" }, { status: 400 });

    // operator는 자신이 담당하는 매물만 처리 가능
    if ((currentUser as any).role === "operator") {
        const [listing] = await db
            .select({ hostId: listings.hostId })
            .from(listings)
            .where(eq(listings.id, booking.listingId));

        if (!listing || listing.hostId !== currentUser.id) {
            return Response.json({ error: "담당 매물이 아닙니다" }, { status: 403 });
        }
    }

    const result = await releaseBooking(bookingId);

    if (!result.ok) {
        return Response.json({ error: result.error }, { status: 500 });
    }

    return Response.json({ ok: true, tx: result.tx });
}
