import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { createPayPalOrder } from "~/lib/paypal.server";

/**
 * POST /api/paypal/create-order
 * Body: { bookingId }
 *
 * PayPal 주문 생성 (intent: AUTHORIZE). 이미 생성된 주문이 있으면 재사용.
 * Returns: { orderID }
 */
export async function action({ request }: { request: Request }) {
    const user = await requireUser(request);

    const { bookingId } = (await request.json()) as { bookingId: string };
    if (!bookingId) return Response.json({ error: "bookingId 필요" }, { status: 400 });

    const [booking] = await db
        .select({
            id: bookings.id,
            guestId: bookings.guestId,
            totalPrice: bookings.totalPrice,
            status: bookings.status,
            paymentIntentId: bookings.paymentIntentId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return Response.json({ error: "예약 없음" }, { status: 404 });
    if (booking.guestId !== user.id) return Response.json({ error: "본인 예약이 아닙니다" }, { status: 403 });
    if (booking.status !== "pending") return Response.json({ error: "대기 중인 예약이 아닙니다" }, { status: 400 });

    // 이미 생성된 PayPal 주문 재사용
    if (booking.paymentIntentId) {
        return Response.json({ orderID: booking.paymentIntentId });
    }

    try {
        const orderID = await createPayPalOrder(booking.totalPrice);

        await db.update(bookings)
            .set({ paymentIntentId: orderID })
            .where(eq(bookings.id, bookingId));

        return Response.json({ orderID });
    } catch (err: any) {
        console.error("[paypal/create-order]", err?.message);
        return Response.json({ error: "PayPal 주문 생성 실패" }, { status: 500 });
    }
}
