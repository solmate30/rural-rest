import { requireUser } from "~/lib/auth.server";
import { createPayPalOrder } from "~/lib/paypal.server";
import { checkRateLimit, rateLimitResponse } from "~/lib/rate-limit.server";

/**
 * POST /api/paypal/create-order
 * Body: { bookingId, totalPrice }
 *
 * PayPal 주문 생성 (intent: AUTHORIZE).
 * DB booking은 capture-auth 완료 시 생성.
 * Returns: { orderID }
 */
export async function action({ request }: { request: Request }) {
    const user = await requireUser(request);

    // Rate limit: 사용자당 10분에 10회
    const rl = checkRateLimit(`paypal:${user.id}`, 10, 10 * 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const body = (await request.json()) as { bookingId: string; totalPrice: number };
    const { totalPrice, bookingId } = body;

    if (!bookingId || typeof bookingId !== "string" || bookingId.trim() === "") {
        return Response.json({ error: "bookingId 필요" }, { status: 400 });
    }
    if (!totalPrice || typeof totalPrice !== "number" || totalPrice <= 0 || totalPrice > 50_000_000) {
        return Response.json({ error: "totalPrice는 0 초과 5천만원 이하여야 합니다" }, { status: 400 });
    }

    try {
        const orderID = await createPayPalOrder(totalPrice);
        return Response.json({ orderID });
    } catch (err: any) {
        console.error("[paypal/create-order]", err?.message);
        return Response.json({ error: "PayPal 주문 생성 실패" }, { status: 500 });
    }
}
