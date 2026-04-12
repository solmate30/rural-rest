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
import { bookings, listings, user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import { RPC_URL, SERVER_PROGRAM_ID, SERVER_USDC_MINT, CRANK_SECRET_KEY, TREASURY_PUBKEY } from "~/lib/constants.server";

/**
 * POST /api/booking/release-escrow
 * Body: { bookingId }
 *
 * 체크아웃 후 예약을 completed 처리.
 * - USDC 예약: 온체인 releaseBookingEscrow CPI → crank가 에스크로 수령
 * - 카드 예약: DB 상태만 completed로 전환 (PayPal은 승인 시 이미 capture됨)
 * admin / spv / operator 만 호출 가능.
 */
export async function action({ request }: { request: Request }) {
    const currentUser = await requireUser(request, ["admin", "spv", "operator"]);

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

    // 체크아웃 후에만 완료 처리 가능
    if (booking.checkOut > new Date()) {
        return Response.json({ error: "체크아웃 이후에 정산 가능합니다" }, { status: 400 });
    }

    // operator는 자신이 담당하는 매물만 처리 가능
    if ((currentUser as any).role === "operator") {
        const [listing] = await db
            .select({ operatorId: listings.operatorId })
            .from(listings)
            .where(eq(listings.id, booking.listingId));

        if (!listing || listing.operatorId !== currentUser.id) {
            return Response.json({ error: "담당 매물이 아닙니다" }, { status: 403 });
        }
    }

    // 카드 결제: DB 상태만 업데이트
    if (!booking.escrowPda) {
        await db.update(bookings)
            .set({ status: "completed" })
            .where(eq(bookings.id, bookingId));
        console.info(`[release-escrow] card booking=${bookingId} → completed`);
        return Response.json({ ok: true });
    }

    // USDC 결제: 온체인 에스크로 릴리스 (90% → host, 10% → treasury)
    if (!CRANK_SECRET_KEY) {
        return Response.json({ error: "서버 crank 키 미설정" }, { status: 500 });
    }
    if (!SERVER_USDC_MINT) {
        return Response.json({ error: "USDC_MINT 미설정" }, { status: 500 });
    }

    // 호스트 지갑 주소 조회 (listing → hostId → user.walletAddress)
    const [listingRow] = await db
        .select({ hostId: listings.hostId })
        .from(listings)
        .where(eq(listings.id, booking.listingId));

    const [hostUser] = listingRow
        ? await db
            .select({ walletAddress: userTable.walletAddress })
            .from(userTable)
            .where(eq(userTable.id, listingRow.hostId))
        : [];

    if (!hostUser?.walletAddress) {
        return Response.json({ error: "호스트 지갑 주소를 찾을 수 없습니다 (지갑 미연결)" }, { status: 400 });
    }

    try {
        const connection = new Connection(RPC_URL, "confirmed");
        const crank = Keypair.fromSecretKey(bs58.decode(CRANK_SECRET_KEY));
        const programId = new PublicKey(SERVER_PROGRAM_ID);
        const usdcMint = new PublicKey(SERVER_USDC_MINT);

        // booking_id seed: UUID 하이픈 제거 (createBookingEscrow와 동일)
        const bookingIdSeed = bookingId.replace(/-/g, "");

        // booking_escrow PDA
        const [bookingEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("booking_escrow"), Buffer.from(bookingIdSeed)],
            programId
        );

        // escrow_vault: booking_escrow PDA의 USDC ATA
        const escrowVault = getAssociatedTokenAddressSync(
            usdcMint, bookingEscrowPda, true, TOKEN_PROGRAM_ID
        );

        // rwaConfig PDA
        const [rwaConfig] = PublicKey.findProgramAddressSync(
            [Buffer.from("rwa_config")],
            programId
        );

        // host_usdc ATA — 없으면 crank가 생성 (수수료 부담)
        const hostPubkey = new PublicKey(hostUser.walletAddress);
        const hostUsdcAccount = await getOrCreateAssociatedTokenAccount(
            connection, crank, usdcMint, hostPubkey, false, "confirmed", undefined, TOKEN_PROGRAM_ID
        );

        // treasury_usdc ATA — 없으면 crank가 생성
        const treasuryPubkey = new PublicKey(TREASURY_PUBKEY);
        const treasuryUsdcAccount = await getOrCreateAssociatedTokenAccount(
            connection, crank, usdcMint, treasuryPubkey, false, "confirmed", undefined, TOKEN_PROGRAM_ID
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
                bookingEscrow: bookingEscrowPda,
                escrowVault,
                hostUsdc: hostUsdcAccount.address,
                treasuryUsdc: treasuryUsdcAccount.address,
                rwaConfig,
                usdcMint,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        await db.update(bookings)
            .set({ status: "completed" })
            .where(eq(bookings.id, bookingId));

        console.info(`[release-escrow] booking=${bookingId} tx=${tx} host=${hostUser.walletAddress}`);
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
