import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings, user } from "~/db/schema";
import { eq } from "drizzle-orm";
import { voidPayPalAuth } from "~/lib/paypal.server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import IDL from "~/anchor-idl/rural_rest_rwa.json";
import { RPC_URL, SERVER_PROGRAM_ID, SERVER_USDC_MINT, CRANK_SECRET_KEY } from "~/lib/constants.server";

/**
 * POST /api/booking/guest-cancel
 * Body: { bookingId }
 *
 * 게스트가 pending 상태 예약을 직접 취소.
 * 카드: PayPal authorization void (자동 환불)
 * USDC: cancelBookingEscrow CPI (crank 서명으로 에스크로 해제)
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
            paypalAuthorizationId: bookings.paypalAuthorizationId,
            escrowPda: bookings.escrowPda,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return Response.json({ error: "예약 없음" }, { status: 404 });
    if (booking.guestId !== currentUser.id) return Response.json({ error: "본인 예약만 취소할 수 있습니다" }, { status: 403 });
    if (booking.status !== "pending") return Response.json({ error: "대기 중인 예약만 취소할 수 있습니다" }, { status: 400 });

    // 카드 결제 환불
    if (booking.paypalAuthorizationId) {
        try {
            await voidPayPalAuth(booking.paypalAuthorizationId);
        } catch (err) {
            console.error("[guest-cancel] paypal void", err);
            return Response.json({ error: "카드 환불 처리 실패" }, { status: 500 });
        }
    }

    // USDC 에스크로 환불
    if (booking.escrowPda) {
        if (!CRANK_SECRET_KEY) return Response.json({ error: "서버 crank 키 미설정" }, { status: 500 });
        if (!SERVER_USDC_MINT) return Response.json({ error: "USDC_MINT 미설정" }, { status: 500 });

        const [guestUser] = await db
            .select({ walletAddress: user.walletAddress })
            .from(user)
            .where(eq(user.id, booking.guestId));

        if (!guestUser?.walletAddress) {
            return Response.json({ error: "게스트 지갑 주소를 찾을 수 없습니다" }, { status: 400 });
        }

        try {
            const connection = new Connection(RPC_URL, "confirmed");
            const crank = Keypair.fromSecretKey(bs58.decode(CRANK_SECRET_KEY));
            const usdcMint = new PublicKey(SERVER_USDC_MINT);
            const guestUsdc = getAssociatedTokenAddressSync(usdcMint, new PublicKey(guestUser.walletAddress));

            const [rwaConfig] = PublicKey.findProgramAddressSync(
                [Buffer.from("rwa_config")],
                new PublicKey(SERVER_PROGRAM_ID),
            );

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
            const bookingIdSeed = bookingId.replace(/-/g, "");

            const tx = await (program.methods as any)
                .cancelBookingEscrow(bookingIdSeed)
                .accounts({
                    caller: crank.publicKey,
                    guestUsdc,
                    rwaConfig,
                    usdcMint,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            console.info(`[guest-cancel] USDC escrow cancelled booking=${bookingId} tx=${tx}`);
        } catch (err: any) {
            console.error("[guest-cancel] usdc cancel escrow", err);
            return Response.json({ error: "USDC 에스크로 환불 실패" }, { status: 500 });
        }
    }

    await db.update(bookings)
        .set({ status: "cancelled" })
        .where(eq(bookings.id, bookingId));

    return Response.json({ ok: true });
}
