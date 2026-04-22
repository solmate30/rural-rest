import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings, listings, user } from "~/db/schema";
import { eq } from "drizzle-orm";
import { voidPayPalAuth } from "~/lib/paypal.server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import IDL from "~/anchor-idl/rural_rest_rwa.json";
import { RPC_URL, SERVER_PROGRAM_ID, SERVER_USDC_MINT, CRANK_SECRET_KEY } from "~/lib/constants.server";

export async function action({ request }: { request: Request }) {
    const currentUser = await requireUser(request, ["admin", "spv", "operator"]);

    const { bookingId } = (await request.json()) as { bookingId: string; reason?: string };
    if (!bookingId) return Response.json({ error: "bookingId 필요" }, { status: 400 });

    const [booking] = await db
        .select({
            id: bookings.id,
            status: bookings.status,
            paypalAuthorizationId: bookings.paypalAuthorizationId,
            escrowPda: bookings.escrowPda,
            guestId: bookings.guestId,
            listingId: bookings.listingId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return Response.json({ error: "예약 없음" }, { status: 404 });
    if (booking.status !== "pending") return Response.json({ error: "대기 중인 예약이 아닙니다" }, { status: 400 });

    // operator는 자신이 담당하는 매물의 예약만 거절 가능
    if ((currentUser as any).role === "operator") {
        const [listing] = await db
            .select({ hostId: listings.hostId })
            .from(listings)
            .where(eq(listings.id, booking.listingId));

        if (!listing || listing.hostId !== currentUser.id) {
            return Response.json({ error: "담당 매물이 아닙니다" }, { status: 403 });
        }
    }

    // PayPal authorization void (자동 전액 환불)
    if (booking.paypalAuthorizationId) {
        try {
            await voidPayPalAuth(booking.paypalAuthorizationId);
        } catch (err) {
            console.error("[paypal void]", err);
            return Response.json({ error: "환불 처리 실패" }, { status: 500 });
        }
    }

    // USDC 에스크로 환불 — cancelBookingEscrow CPI (crank 서명)
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
            const guestPubkey = new PublicKey(guestUser.walletAddress);
            const guestUsdc = getAssociatedTokenAddressSync(usdcMint, guestPubkey);

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

            // booking_id seed: UUID 하이픈 제거 (createBookingEscrow와 동일)
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

            console.info(`[reject] USDC escrow cancelled booking=${bookingId} tx=${tx}`);
        } catch (err: any) {
            console.error("[usdc cancel escrow]", err);
            return Response.json({ error: "USDC 에스크로 환불 실패" }, { status: 500 });
        }
    }

    await db.update(bookings)
        .set({ status: "cancelled" })
        .where(eq(bookings.id, bookingId));

    return Response.json({ ok: true });
}
