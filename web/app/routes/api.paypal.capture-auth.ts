import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { authorizePayPalOrder } from "~/lib/paypal.server";

/**
 * POST /api/paypal/capture-auth
 * Body: { bookingId, orderID, listingId, checkIn, checkOut, guests, totalPrice }
 *
 * PayPal 승인 완료 후 booking DB 기록 + authorizationId 저장.
 * (실제 청구는 호스트 승인 시 capture됨)
 */
export async function action({ request }: { request: Request }) {
    const user = await requireUser(request);

    const { bookingId, orderID, listingId, checkIn, checkOut, guests, totalPrice } = (await request.json()) as {
        bookingId: string;
        orderID: string;
        listingId: string;
        checkIn: string;
        checkOut: string;
        guests: number;
        totalPrice: number;
    };

    if (!bookingId || !orderID || !listingId || !checkIn || !checkOut) {
        return Response.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    // 멱등성: 이미 존재하면 ok
    const [existing] = await db
        .select({ id: bookings.id, guestId: bookings.guestId, paypalAuthorizationId: bookings.paypalAuthorizationId })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (existing) {
        if (existing.guestId !== user.id) return Response.json({ error: "권한 없음" }, { status: 403 });
        return Response.json({ ok: true });
    }

    try {
        const authorizationId = await authorizePayPalOrder(orderID);

        await db.insert(bookings).values({
            id: bookingId,
            listingId,
            guestId: user.id,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            totalPrice: totalPrice ?? 0,
            paypalAuthorizationId: authorizationId,
            status: "pending",
        });

        console.info(`[paypal/capture-auth] booking=${bookingId} authId=${authorizationId}`);
        return Response.json({ ok: true });
    } catch (err: any) {
        console.error("[paypal/capture-auth]", err?.message);
        return Response.json({ error: "PayPal 승인 처리 실패" }, { status: 500 });
    }
}
