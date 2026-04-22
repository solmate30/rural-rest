import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings, listings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { capturePayPalAuth } from "~/lib/paypal.server";

const PLATFORM_FEE_RATE = 0.1;

export async function action({ request }: { request: Request }) {
    const currentUser = await requireUser(request, ["admin", "spv", "operator"]);

    const { bookingId } = (await request.json()) as { bookingId: string };
    if (!bookingId) return Response.json({ error: "bookingId 필요" }, { status: 400 });

    const [booking] = await db
        .select({
            id: bookings.id,
            status: bookings.status,
            totalPrice: bookings.totalPrice,
            paypalAuthorizationId: bookings.paypalAuthorizationId,
            listingId: bookings.listingId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return Response.json({ error: "예약 없음" }, { status: 404 });
    if (booking.status !== "pending") return Response.json({ error: "대기 중인 예약이 아닙니다" }, { status: 400 });

    // operator는 자신이 담당하는 매물의 예약만 승인 가능
    if ((currentUser as any).role === "operator") {
        const [listing] = await db
            .select({ hostId: listings.hostId })
            .from(listings)
            .where(eq(listings.id, booking.listingId));

        if (!listing || listing.hostId !== currentUser.id) {
            return Response.json({ error: "담당 매물이 아닙니다" }, { status: 403 });
        }
    }

    // PayPal authorization capture (카드 결제인 경우)
    let platformFeeKrw: number | null = null;
    let paypalCaptureId: string | null = null;
    if (booking.paypalAuthorizationId) {
        try {
            paypalCaptureId = await capturePayPalAuth(booking.paypalAuthorizationId);
            platformFeeKrw = Math.round(booking.totalPrice * PLATFORM_FEE_RATE);
            const hostPayout = booking.totalPrice - platformFeeKrw;
            // PayPal Commerce Platform 파트너 승인 전까지 수수료는 DB에만 기록
            // 실제 차감은 추후 파트너 계정 활성화 후 capturePayPalAuth에 payment_instruction.platform_fees 추가
            console.info(
                `[approve] booking=${bookingId} total=₩${booking.totalPrice} platformFee=₩${platformFeeKrw} hostPayout=₩${hostPayout}`
            );
        } catch (err) {
            console.error("[paypal capture]", err);
            return Response.json({ error: "결제 capture 실패" }, { status: 500 });
        }
    }

    // PayPal capture 성공 후 DB 업데이트는 별도 try/catch.
    // DB 실패 시 capture는 이미 완료됐으므로 ok:true 반환해야 재승인 시 PayPal 이중 capture 시도를 막는다.
    try {
        await db.update(bookings)
            .set({
                status: "confirmed",
                ...(platformFeeKrw !== null && { platformFeeKrw }),
                ...(paypalCaptureId !== null && { paypalCaptureId }),
            })
            .where(eq(bookings.id, bookingId));
    } catch (dbErr: any) {
        console.error(
            `[approve] CRITICAL: paypalCaptureId=${paypalCaptureId} 성공이나 DB status 업데이트 실패. 수동 처리 필요. booking=${bookingId}`,
            dbErr?.message ?? dbErr,
        );
    }

    return Response.json({ ok: true });
}
