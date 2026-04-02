import { requireUser } from "~/lib/auth.server";
import { createPayPalOrder } from "~/lib/paypal.server";

/**
 * POST /api/paypal/create-order
 * Body: { bookingId, totalPrice }
 *
 * PayPal 주문 생성 (intent: AUTHORIZE).
 * DB booking은 capture-auth 완료 시 생성.
 * Returns: { orderID }
 */
export async function action({ request }: { request: Request }) {
    await requireUser(request);

    const { totalPrice } = (await request.json()) as { bookingId: string; totalPrice: number };
    if (!totalPrice || totalPrice <= 0) return Response.json({ error: "totalPrice 필요" }, { status: 400 });

    try {
        const orderID = await createPayPalOrder(totalPrice);
        return Response.json({ orderID });
    } catch (err: any) {
        console.error("[paypal/create-order]", err?.message);
        return Response.json({ error: "PayPal 주문 생성 실패" }, { status: 500 });
    }
}
