import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings, listings, user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import { refundPayPalCapture } from "~/lib/paypal.server";
import { calcRefundBps } from "~/lib/refund-policy";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import bs58 from "bs58";
import IDL from "~/anchor-idl/rural_rest_rwa.json";
import {
    RPC_URL,
    SERVER_PROGRAM_ID,
    SERVER_USDC_MINT,
    CRANK_SECRET_KEY,
} from "~/lib/constants.server";
import { fetchPythKrwRate } from "~/lib/pyth";

/**
 * POST /api/booking/cancel-confirmed
 * Body: { bookingId }
 *
 * confirmed 예약 취소 + 취소 정책 기반 환불
 *   체크인 7일 전 이상: 100% 환불
 *   체크인 3~7일 전:   50% 환불
 *   체크인 3일 이내:    0% 환불 (에스크로 → 운영자 정상 릴리스)
 *
 * USDC: 온체인 cancelBookingEscrow(100%) / cancelBookingEscrowPartial(50%) / releaseBookingEscrow(0%)
 * 카드:  PayPal Refund API (capture ID 필요)
 *
 * 게스트 본인 또는 admin만 호출 가능
 */
export async function action({ request }: { request: Request }) {
    const currentUser = await requireUser(request);

    const { bookingId } = (await request.json()) as { bookingId: string };
    if (!bookingId) return Response.json({ error: "bookingId 필요" }, { status: 400 });

    const [booking] = await db
        .select({
            id: bookings.id,
            status: bookings.status,
            guestId: bookings.guestId,
            listingId: bookings.listingId,
            checkIn: bookings.checkIn,
            totalPrice: bookings.totalPrice,
            escrowPda: bookings.escrowPda,
            paypalCaptureId: bookings.paypalCaptureId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return Response.json({ error: "예약 없음" }, { status: 404 });
    if (booking.status !== "confirmed") return Response.json({ error: "확정된 예약이 아닙니다" }, { status: 400 });

    const role = (currentUser as any).role;
    if (role !== "admin" && currentUser.id !== booking.guestId) {
        return Response.json({ error: "본인 예약 또는 어드민만 취소할 수 있습니다" }, { status: 403 });
    }

    // 취소 정책: 체크인까지 남은 일수로 환불율 결정
    const now = new Date();
    const refundBps = calcRefundBps(booking.checkIn, now);

    // USDC 에스크로 처리
    if (booking.escrowPda) {
        if (!CRANK_SECRET_KEY) return Response.json({ error: "CRANK_SECRET_KEY 미설정" }, { status: 500 });
        if (!SERVER_USDC_MINT) return Response.json({ error: "SERVER_USDC_MINT 미설정" }, { status: 500 });

        const [guestUser] = await db
            .select({ walletAddress: userTable.walletAddress })
            .from(userTable)
            .where(eq(userTable.id, booking.guestId));

        if (!guestUser?.walletAddress) {
            return Response.json({ error: "게스트 지갑 미연결" }, { status: 400 });
        }

        try {
            const connection = new Connection(RPC_URL, "confirmed");
            const crank = Keypair.fromSecretKey(bs58.decode(CRANK_SECRET_KEY));
            const programId = new PublicKey(SERVER_PROGRAM_ID);
            const usdcMint = new PublicKey(SERVER_USDC_MINT);
            const bookingIdSeed = bookingId.replace(/-/g, "");

            const [rwaConfig] = PublicKey.findProgramAddressSync([Buffer.from("rwa_config")], programId);
            const guestUsdc = getAssociatedTokenAddressSync(usdcMint, new PublicKey(guestUser.walletAddress), false, TOKEN_PROGRAM_ID);

            const crankProvider = new AnchorProvider(
                connection,
                {
                    publicKey: crank.publicKey,
                    signTransaction: async (tx: any) => { tx.sign(crank); return tx; },
                    signAllTransactions: async (txs: any[]) => { txs.forEach((t) => t.sign(crank)); return txs; },
                } as any,
                { commitment: "confirmed" },
            );
            const program = new Program(IDL as any, crankProvider);

            if (refundBps === 10000) {
                // 100% 환불: cancelBookingEscrow
                await (program.methods as any)
                    .cancelBookingEscrow(bookingIdSeed)
                    .accounts({ caller: crank.publicKey, guestUsdc, rwaConfig, usdcMint, usdcTokenProgram: TOKEN_PROGRAM_ID })
                    .rpc();

            } else if (refundBps === 5000) {
                // 50% 환불: cancelBookingEscrowPartial
                const [listingRow] = await db
                    .select({ hostId: listings.hostId })
                    .from(listings)
                    .where(eq(listings.id, booking.listingId));
                const [hostUser] = listingRow
                    ? await db.select({ walletAddress: userTable.walletAddress }).from(userTable).where(eq(userTable.id, listingRow.hostId))
                    : [];
                if (!hostUser?.walletAddress) return Response.json({ error: "호스트 지갑 미연결" }, { status: 400 });

                const hostUsdc = await getOrCreateAssociatedTokenAccount(
                    connection, crank, usdcMint,
                    new PublicKey(hostUser.walletAddress),
                    false, "confirmed", undefined, TOKEN_PROGRAM_ID,
                );

                const [bookingEscrowPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("booking_escrow"), Buffer.from(bookingIdSeed)],
                    programId,
                );
                const escrowVault = getAssociatedTokenAddressSync(usdcMint, bookingEscrowPda, true, TOKEN_PROGRAM_ID);

                await (program.methods as any)
                    .cancelBookingEscrowPartial(bookingIdSeed, 5000)
                    .accounts({
                        caller: crank.publicKey,
                        bookingEscrow: bookingEscrowPda,
                        escrowVault,
                        guestUsdc,
                        hostUsdc: hostUsdc.address,
                        rwaConfig,
                        usdcMint,
                        usdcTokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .rpc();

            } else {
                // 0% 환불: releaseBookingEscrow (listing_vault 90% + treasury 10%)
                const { releaseBooking } = await import("~/lib/escrow-release.server");
                const result = await releaseBooking(bookingId);
                if (!result.ok) return Response.json({ error: result.error }, { status: 500 });
            }

        } catch (err: any) {
            console.error("[cancel-confirmed] USDC", err?.message ?? err);
            return Response.json({ error: "USDC 에스크로 처리 실패" }, { status: 500 });
        }
    }

    // 카드 결제 환불
    if (booking.paypalCaptureId && refundBps > 0) {
        try {
            if (refundBps === 10000) {
                await refundPayPalCapture(booking.paypalCaptureId);
            } else {
                // 50% 부분 환불: USD 금액 계산
                const krwPerUsd = await fetchPythKrwRate();
                const refundKrw = Math.floor(booking.totalPrice * 0.5);
                const refundUsd = (refundKrw / krwPerUsd).toFixed(2);
                await refundPayPalCapture(booking.paypalCaptureId, refundUsd);
            }
        } catch (err: any) {
            console.error("[cancel-confirmed] PayPal refund", err?.message ?? err);
            return Response.json({ error: "카드 환불 처리 실패" }, { status: 500 });
        }
    }

    // 0% 환불: 플랫폼/호스트가 전액 수익 인식 → completed
    // 100% / 50% 환불: cancelled
    const finalStatus = refundBps === 0 ? "completed" : "cancelled";
    await db.update(bookings)
        .set({ status: finalStatus })
        .where(eq(bookings.id, bookingId));

    return Response.json({ ok: true, refundBps });
}
