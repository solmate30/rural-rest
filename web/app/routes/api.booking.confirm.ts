import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { Connection } from "@solana/web3.js";
import { RPC_URL } from "~/lib/constants.server";

/**
 * POST /api/booking/confirm
 *
 * 온체인 USDC 결제 완료 후 booking DB 기록 + confirmed 상태로 저장.
 * Body: { bookingId, escrowPda, txSignature, amountUsdc,
 *         listingId, checkIn, checkOut, guests, totalPrice }
 */
export async function action({ request }: { request: Request }) {
    const user = await requireUser(request);

    const body = await request.json() as {
        bookingId: string;
        escrowPda: string;
        txSignature: string;
        amountUsdc: number;
        listingId: string;
        checkIn: string;
        checkOut: string;
        guests: number;
        totalPrice: number;
    };
    const { bookingId, escrowPda, txSignature, amountUsdc,
            listingId, checkIn, checkOut, guests, totalPrice } = body;

    if (!bookingId || !escrowPda || !txSignature || !listingId || !checkIn || !checkOut) {
        return Response.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    if (typeof amountUsdc !== "number" || amountUsdc <= 0 || amountUsdc > 100_000_000_000) {
        return Response.json({ error: "amountUsdc 값이 유효하지 않습니다" }, { status: 400 });
    }

    // 온체인 TX 검증
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

    // 멱등성: 이미 존재하면 그냥 ok
    const [existing] = await db
        .select({ id: bookings.id, guestId: bookings.guestId })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (existing) {
        if (existing.guestId !== user.id) return Response.json({ error: "권한 없음" }, { status: 403 });
        return Response.json({ ok: true });
    }

    // 신규 insert (결제 완료 → confirmed)
    await db.insert(bookings).values({
        id: bookingId,
        listingId,
        guestId: user.id,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        totalPrice: totalPrice ?? 0,
        totalPriceUsdc: amountUsdc,
        escrowPda,
        onchainPayTx: txSignature,
        status: "confirmed",
    });

    return Response.json({ ok: true });
}
