import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { authorizePayPalOrder } from "~/lib/paypal.server";

/**
 * POST /api/paypal/capture-auth
 * Body: { bookingId, orderID }
 *
 * 사용자가 PayPal에서 결제 승인 후 호출.
 * OrderID → authorize → authorization ID를 DB에 저장.
 * (실제 청구는 호스트가 예약 승인할 때 capture됨)
 */
export async function action({ request }: { request: Request }) {
    const user = await requireUser(request);

    const { bookingId, orderID } = (await request.json()) as {
        bookingId: string;
        orderID: string;
    };
    if (!bookingId || !orderID) {
        return Response.json({ error: "bookingId, orderID 필요" }, { status: 400 });
    }

    const [booking] = await db
        .select({
            id: bookings.id,
            guestId: bookings.guestId,
            status: bookings.status,
            paypalAuthorizationId: bookings.paypalAuthorizationId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking || booking.guestId !== user.id) {
        return Response.json({ error: "예약 없음" }, { status: 404 });
    }

    // 이미 authorization 완료된 경우 멱등성 처리
    if (booking.paypalAuthorizationId) {
        return Response.json({ ok: true });
    }

    if (booking.status !== "pending") {
        return Response.json({ error: "이미 처리된 예약입니다" }, { status: 400 });
    }

    try {
        const authorizationId = await authorizePayPalOrder(orderID);

        await db.update(bookings)
            .set({ paypalAuthorizationId: authorizationId })
            .where(eq(bookings.id, bookingId));

        console.info(`[paypal/capture-auth] booking=${bookingId} authId=${authorizationId}`);
        return Response.json({ ok: true });
    } catch (err: any) {
        console.error("[paypal/capture-auth]", err?.message);
        return Response.json({ error: "PayPal 승인 처리 실패" }, { status: 500 });
    }
}
