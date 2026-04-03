import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import bs58 from "bs58";
import IDL from "~/anchor-idl/rural_rest_rwa.json";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings, listings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { RPC_URL, SERVER_PROGRAM_ID, SERVER_USDC_MINT, CRANK_SECRET_KEY } from "~/lib/constants.server";

/**
 * POST /api/booking/release-escrow
 * Body: { bookingId }
 *
 * USDC 에스크로 릴리스 — 체크아웃 후 crank_authority가 서명.
 * 에스크로 USDC → crank(operator) USDC ATA 전송.
 * admin / spv 만 호출 가능. (crank 서명은 서버 내부에서 처리)
 */
export async function action({ request }: { request: Request }) {
    const currentUser = await requireUser(request, ["admin", "spv", "operator"]);

    if (!CRANK_SECRET_KEY) {
        return Response.json({ error: "서버 crank 키 미설정" }, { status: 500 });
    }
    if (!SERVER_USDC_MINT) {
        return Response.json({ error: "USDC_MINT 미설정" }, { status: 500 });
    }

    const { bookingId } = (await request.json()) as { bookingId: string };
    if (!bookingId) return Response.json({ error: "bookingId 필요" }, { status: 400 });

    const [booking] = await db
        .select({
            id: bookings.id,
            status: bookings.status,
            checkOut: bookings.checkOut,
            escrowPda: bookings.escrowPda,
            listingId: bookings.listingId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return Response.json({ error: "예약 없음" }, { status: 404 });
    if (booking.status !== "confirmed") return Response.json({ error: "확정된 예약이 아닙니다" }, { status: 400 });
    if (!booking.escrowPda) return Response.json({ error: "USDC 에스크로가 없는 예약입니다 (카드 결제)" }, { status: 400 });

    // 체크아웃 후에만 릴리스 가능 (온체인도 동일하게 체크)
    if (booking.checkOut > new Date()) {
        return Response.json({ error: "체크아웃 이후에 정산 가능합니다" }, { status: 400 });
    }

    // operator는 자신이 담당하는 매물만 릴리스 가능
    if ((currentUser as any).role === "operator") {
        const [listing] = await db
            .select({ operatorId: listings.operatorId })
            .from(listings)
            .where(eq(listings.id, booking.listingId));

        if (!listing || listing.operatorId !== currentUser.id) {
            return Response.json({ error: "담당 매물이 아닙니다" }, { status: 403 });
        }
    }

    try {
        const connection = new Connection(RPC_URL, "confirmed");
        const crank = Keypair.fromSecretKey(bs58.decode(CRANK_SECRET_KEY));
        const programId = new PublicKey(SERVER_PROGRAM_ID);
        const usdcMint = new PublicKey(SERVER_USDC_MINT);

        // booking_id seed: UUID 하이픈 제거 (createBookingEscrow와 동일)
        const bookingIdSeed = bookingId.replace(/-/g, "");

        // rwaConfig PDA
        const [rwaConfig] = PublicKey.findProgramAddressSync(
            [Buffer.from("rwa_config")],
            programId
        );

        // crank의 USDC ATA — 없으면 생성
        const operatorUsdcAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            crank,       // payer
            usdcMint,
            crank.publicKey,
            false,
            "confirmed",
            undefined,
            TOKEN_PROGRAM_ID
        );

        const crankProvider = new AnchorProvider(
            connection,
            {
                publicKey: crank.publicKey,
                signTransaction: async (tx: any) => { tx.sign(crank); return tx; },
                signAllTransactions: async (txs: any[]) => { txs.forEach((t) => t.sign(crank)); return txs; },
            } as any,
            { commitment: "confirmed" }
        );
        const crankProgram = new Program(IDL as any, crankProvider);

        const tx = await (crankProgram.methods as any)
            .releaseBookingEscrow(bookingIdSeed)
            .accounts({
                operator: crank.publicKey,
                operatorUsdc: operatorUsdcAccount.address,
                rwaConfig,
                usdcMint,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        await db.update(bookings)
            .set({ status: "completed" })
            .where(eq(bookings.id, bookingId));

        console.info(`[release-escrow] booking=${bookingId} tx=${tx}`);
        return Response.json({ ok: true, tx });

    } catch (err: any) {
        const msg = String(err?.message ?? err);
        console.error("[release-escrow]", msg);

        if (msg.includes("CheckInNotPassed")) {
            return Response.json({ error: "온체인: 체크아웃 전입니다" }, { status: 400 });
        }
        if (msg.includes("BookingNotPending")) {
            return Response.json({ error: "온체인: 이미 처리된 에스크로입니다" }, { status: 400 });
        }
        return Response.json({ error: "에스크로 릴리스 실패" }, { status: 500 });
    }
}
