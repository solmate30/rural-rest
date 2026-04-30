/**
 * cancel-booking-escrow.server.ts
 * 예약 취소 핵심 로직 — Cron에서 만료 pending 건 자동 정리 시 사용
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import bs58 from "bs58";
import IDL from "~/anchor-idl/rural_rest_rwa.json";
import { db } from "~/db/index.server";
import { bookings, user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import {
    RPC_URL,
    SERVER_PROGRAM_ID,
    SERVER_USDC_MINT,
    CRANK_SECRET_KEY,
} from "~/lib/constants.server";

export type CancelResult = { ok: true; tx?: string } | { ok: false; error: string };

/**
 * 단일 예약 취소 및 에스크로 환불
 * - onchainPayTx 없음(Blinks 서명 포기 등): on-chain 에스크로 미생성 → DB만 cancelled 처리
 * - onchainPayTx 있음: 온체인 cancelBookingEscrow → escrow_vault 전액 게스트 환불
 */
export async function cancelBookingEscrow(bookingId: string): Promise<CancelResult> {
    const [booking] = await db
        .select({
            onchainPayTx: bookings.onchainPayTx,
            guestId: bookings.guestId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking) return { ok: false, error: "예약 없음" };

    // onchainPayTx 없음 → on-chain 에스크로 미생성, DB만 취소
    if (!booking.onchainPayTx) {
        await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, bookingId));
        return { ok: true };
    }

    if (!CRANK_SECRET_KEY) return { ok: false, error: "CRANK_SECRET_KEY 미설정" };
    if (!SERVER_USDC_MINT) return { ok: false, error: "SERVER_USDC_MINT 미설정" };

    const [guest] = await db
        .select({ walletAddress: userTable.walletAddress })
        .from(userTable)
        .where(eq(userTable.id, booking.guestId));

    if (!guest?.walletAddress) return { ok: false, error: "게스트 지갑 주소 없음" };

    try {
        const connection = new Connection(RPC_URL, "confirmed");
        const crank = Keypair.fromSecretKey(bs58.decode(CRANK_SECRET_KEY));
        const programId = new PublicKey(SERVER_PROGRAM_ID);
        const usdcMint = new PublicKey(SERVER_USDC_MINT);
        const bookingIdSeed = bookingId.replace(/-/g, "");
        const guestPubkey = new PublicKey(guest.walletAddress);

        const [bookingEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("booking_escrow"), Buffer.from(bookingIdSeed)],
            programId,
        );
        const escrowVault = getAssociatedTokenAddressSync(
            usdcMint, bookingEscrowPda, true, TOKEN_PROGRAM_ID,
        );
        const guestUsdc = getAssociatedTokenAddressSync(
            usdcMint, guestPubkey, false, TOKEN_PROGRAM_ID,
        );
        const [rwaConfig] = PublicKey.findProgramAddressSync(
            [Buffer.from("rwa_config")],
            programId,
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
            .cancelBookingEscrow(bookingIdSeed)
            .accounts({
                caller: crank.publicKey,
                bookingEscrow: bookingEscrowPda,
                escrowVault,
                guestUsdc,
                rwaConfig,
                usdcMint,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        // 온체인 성공 — DB 업데이트 실패해도 ok:true 반환 (크론 재시도 루프 방지)
        try {
            await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, bookingId));
        } catch (dbErr: any) {
            console.error(
                `[cancel-booking] CRITICAL: tx=${tx} 성공이나 DB 업데이트 실패. 수동 처리 필요. booking=${bookingId}`,
                dbErr?.message ?? dbErr,
            );
        }

        console.info(`[cancel-booking] booking=${bookingId} tx=${tx}`);
        return { ok: true, tx };

    } catch (err: any) {
        const error = String(err?.message ?? err);
        console.error(`[cancel-booking] booking=${bookingId}`, error);
        return { ok: false, error };
    }
}
