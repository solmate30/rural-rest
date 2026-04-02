import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings, listings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { voidPayPalAuth } from "~/lib/paypal.server";

export async function action({ request }: { request: Request }) {
    const currentUser = await requireUser(request, ["admin", "spv", "operator"]);

    const { bookingId } = (await request.json()) as { bookingId: string; reason?: string };
    if (!bookingId) return Response.json({ error: "bookingId 필요" }, { status: 400 });

    const [booking] = await db
        .select({
            id: bookings.id,
            status: bookings.status,
            paypalAuthorizationId: bookings.paypalAuthorizationId,
            listingId: bookings.listingId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return Response.json({ error: "예약 없음" }, { status: 404 });
    if (booking.status !== "pending") return Response.json({ error: "대기 중인 예약이 아닙니다" }, { status: 400 });

    // operator는 자신이 담당하는 매물의 예약만 거절 가능
    if ((currentUser as any).role === "operator") {
        const [listing] = await db
            .select({ operatorId: listings.operatorId })
            .from(listings)
            .where(eq(listings.id, booking.listingId));

        if (!listing || listing.operatorId !== currentUser.id) {
            return Response.json({ error: "담당 매물이 아닙니다" }, { status: 403 });
        }
    }

    // PayPal authorization void (자동 전액 환불)
    if (booking.paypalAuthorizationId) {
        try {
            await voidPayPalAuth(booking.paypalAuthorizationId);
        } catch (err) {
            console.error("[paypal void]", err);
            return Response.json({ error: "환불 처리 실패" }, { status: 500 });
        }
    }

    await db.update(bookings)
        .set({ status: "cancelled" })
        .where(eq(bookings.id, bookingId));

    return Response.json({ ok: true });
}
