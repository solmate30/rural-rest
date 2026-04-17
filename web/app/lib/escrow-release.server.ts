/**
 * escrow-release.server.ts
 * 에스크로 릴리스 핵심 로직 — 수동 API와 Cron 양쪽에서 공유
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import bs58 from "bs58";
import IDL from "~/anchor-idl/rural_rest_rwa.json";
import { db } from "~/db/index.server";
import { bookings, listings, user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import {
    RPC_URL,
    SERVER_PROGRAM_ID,
    SERVER_USDC_MINT,
    CRANK_SECRET_KEY,
    TREASURY_PUBKEY,
} from "~/lib/constants.server";

export type ReleaseResult = { ok: true; tx?: string } | { ok: false; error: string };

/**
 * 단일 예약 에스크로 릴리스
 * - 카드 결제: DB status만 completed 전환 (플랫폼이 PayPal로 전액 수령 중, 운영자 몫은 월정산에서 지급)
 * - USDC 결제: 온체인 releaseBookingEscrow → 90% 운영자 / 10% treasury 자동 분배
 *
 * 전제: 호출 전에 status=confirmed, checkOut < now 검증 완료
 */
export async function releaseBooking(bookingId: string): Promise<ReleaseResult> {
    const [booking] = await db
        .select({ escrowPda: bookings.escrowPda, listingId: bookings.listingId })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return { ok: false, error: "예약 없음" };

    // 카드 결제: DB 상태만 전환
    if (!booking.escrowPda) {
        await db.update(bookings).set({ status: "completed" }).where(eq(bookings.id, bookingId));
        return { ok: true };
    }

    // USDC 결제: 온체인 릴리스
    if (!CRANK_SECRET_KEY) return { ok: false, error: "CRANK_SECRET_KEY 미설정" };
    if (!SERVER_USDC_MINT) return { ok: false, error: "SERVER_USDC_MINT 미설정" };

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

    if (!hostUser?.walletAddress) return { ok: false, error: "호스트 지갑 미연결" };

    try {
        const connection = new Connection(RPC_URL, "confirmed");
        const crank = Keypair.fromSecretKey(bs58.decode(CRANK_SECRET_KEY));
        const programId = new PublicKey(SERVER_PROGRAM_ID);
        const usdcMint = new PublicKey(SERVER_USDC_MINT);
        const bookingIdSeed = bookingId.replace(/-/g, "");

        const [bookingEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("booking_escrow"), Buffer.from(bookingIdSeed)],
            programId,
        );
        const escrowVault = getAssociatedTokenAddressSync(
            usdcMint, bookingEscrowPda, true, TOKEN_PROGRAM_ID,
        );
        const [rwaConfig] = PublicKey.findProgramAddressSync(
            [Buffer.from("rwa_config")],
            programId,
        );

        const hostUsdcAccount = await getOrCreateAssociatedTokenAccount(
            connection, crank, usdcMint,
            new PublicKey(hostUser.walletAddress),
            false, "confirmed", undefined, TOKEN_PROGRAM_ID,
        );
        const treasuryUsdcAccount = await getOrCreateAssociatedTokenAccount(
            connection, crank, usdcMint,
            new PublicKey(TREASURY_PUBKEY),
            false, "confirmed", undefined, TOKEN_PROGRAM_ID,
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

        const tx = await (program.methods as any)
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

        // 온체인 CPI 성공 — USDC 이체 완료.
        // DB 업데이트는 별도 try/catch: 여기서 실패해도 ok:true 반환해야 함.
        // 이유: catch 블록이 ok:false → 크론 재시도 → 온체인 BookingNotPending 에러로 영구 루프.
        try {
            await db.update(bookings).set({ status: "completed" }).where(eq(bookings.id, bookingId));
        } catch (dbErr: any) {
            console.error(
                `[release-booking] CRITICAL: tx=${tx} 성공이나 DB status 업데이트 실패. 수동 처리 필요. booking=${bookingId}`,
                dbErr?.message ?? dbErr,
            );
        }

        console.info(`[release-booking] booking=${bookingId} tx=${tx}`);
        return { ok: true, tx };

    } catch (err: any) {
        const error = String(err?.message ?? err);
        console.error(`[release-booking] booking=${bookingId}`, error);
        return { ok: false, error };
    }
}
