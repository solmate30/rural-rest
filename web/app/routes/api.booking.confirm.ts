import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { Connection } from "@solana/web3.js";
import { RPC_URL } from "~/lib/constants.server";

/**
 * POST /api/booking/confirm
 *
 * 온체인 USDC 결제 완료 후 booking 상태 업데이트.
 * Body: { bookingId, escrowPda, txSignature, amountUsdc }
 */
export async function action({ request }: { request: Request }) {
    const user = await requireUser(request);

    const body = await request.json() as {
        bookingId: string;
        escrowPda: string;
        txSignature: string;
        amountUsdc: number;
    };
    const { bookingId, escrowPda, txSignature, amountUsdc } = body;

    if (!bookingId || !escrowPda || !txSignature) {
        return Response.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    // amountUsdc 기본 범위 검증 (0 이하 또는 비정상적으로 큰 값 차단)
    if (typeof amountUsdc !== "number" || amountUsdc <= 0 || amountUsdc > 100_000_000_000) {
        return Response.json({ error: "amountUsdc 값이 유효하지 않습니다" }, { status: 400 });
    }

    // 온체인 TX 검증: 실제로 성공한 트랜잭션인지 확인
    try {
        const conn = new Connection(RPC_URL, "confirmed");
        const txInfo = await conn.getTransaction(txSignature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });
        if (!txInfo) {
            return Response.json({ error: "트랜잭션을 찾을 수 없습니다" }, { status: 400 });
        }
        if (txInfo.meta?.err !== null) {
            return Response.json({ error: "트랜잭션이 실패했습니다" }, { status: 400 });
        }
    } catch {
        return Response.json({ error: "트랜잭션 검증 중 오류가 발생했습니다" }, { status: 500 });
    }

    // 본인 예약인지 확인
    const [booking] = await db
        .select({ id: bookings.id, guestId: bookings.guestId, status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return Response.json({ error: "예약 없음" }, { status: 404 });
    if (booking.guestId !== user.id) return Response.json({ error: "권한 없음" }, { status: 403 });
    if (booking.status !== "pending") {
        return Response.json({ error: "이미 처리된 예약입니다" }, { status: 400 });
    }

    await db
        .update(bookings)
        .set({
            status: "confirmed",
            escrowPda,
            onchainPayTx: txSignature,
            totalPriceUsdc: amountUsdc,
        })
        .where(eq(bookings.id, bookingId));

    return Response.json({ ok: true });
}
