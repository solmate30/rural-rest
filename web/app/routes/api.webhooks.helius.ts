/**
 * POST /api/webhooks/helius
 *
 * Helius Enhanced Transaction webhook.
 * Blinks로 purchaseTokens 트랜잭션이 온체인에 기록되면 Helius가 이 엔드포인트를 호출.
 * 클라이언트가 record-purchase를 호출하지 않아도 DB에 자동 기록됨.
 */
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { db } from "~/db/index.server";
import { rwaInvestments, rwaTokens, user as userTable } from "~/db/schema";
import IDL from "~/anchor-idl/rural_rest_rwa.json";

const RWA_PROGRAM_ID = process.env.VITE_RWA_PROGRAM_ID ?? "BAJ2fSZGZMkt6dFs4Rn5u8CCSsaVtgKbr5Jfca659iZr";
const HELIUS_WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;

const coder = new BorshInstructionCoder(IDL as any);

export async function action({ request }: { request: Request }) {
    // Helius authorization 검증
    if (HELIUS_WEBHOOK_SECRET) {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== HELIUS_WEBHOOK_SECRET) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    let transactions: any[];
    try {
        transactions = await request.json();
        if (!Array.isArray(transactions)) transactions = [transactions];
    } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    let recorded = 0;
    for (const tx of transactions) {
        try {
            const result = await processTransaction(tx);
            if (result) recorded++;
        } catch (err) {
            console.error("[helius-webhook] tx 처리 실패:", tx?.signature, err);
        }
    }

    return Response.json({ ok: true, recorded });
}

async function processTransaction(tx: any): Promise<boolean> {
    const signature: string = tx.signature;
    if (!signature) return false;

    // 실패한 트랜잭션 무시
    if (tx.transactionError) return false;

    const instructions: any[] = tx.instructions ?? [];

    for (const ix of instructions) {
        if (ix.programId !== RWA_PROGRAM_ID) continue;

        let decoded: any;
        try {
            // Helius는 instruction data를 base58로 인코딩
            const dataBuffer = Buffer.from(bs58.decode(ix.data));
            decoded = coder.decode(dataBuffer);
        } catch {
            continue;
        }

        if (!decoded || decoded.name !== "purchaseTokens") continue;

        const listingId: string = (decoded.data as any).listingId;
        const tokenAmount: number = Number((decoded.data as any).tokenAmount);
        const investorWallet: string = ix.accounts[0]; // investor = 첫 번째 계정

        if (!listingId || !tokenAmount || !investorWallet) continue;

        // 중복 방지 (idempotent)
        const existing = await db
            .select({ id: rwaInvestments.id })
            .from(rwaInvestments)
            .where(eq(rwaInvestments.purchaseTx, signature));

        if (existing.length > 0) {
            console.info(`[helius-webhook] 이미 기록된 tx: ${signature}`);
            return false;
        }

        // rwaToken 조회
        const [rwaToken] = await db
            .select({ id: rwaTokens.id, pricePerTokenUsdc: rwaTokens.pricePerTokenUsdc })
            .from(rwaTokens)
            .where(eq(rwaTokens.listingId, listingId));

        if (!rwaToken) {
            console.warn(`[helius-webhook] rwaToken 없음: listingId=${listingId}`);
            continue;
        }

        // 투자자 조회 (KYC는 Blinks POST에서 이미 검증됨)
        const [investor] = await db
            .select({ id: userTable.id })
            .from(userTable)
            .where(eq(userTable.walletAddress, investorWallet));

        const investedUsdc = (rwaToken.pricePerTokenUsdc ?? 0) * tokenAmount;

        await db.insert(rwaInvestments).values({
            id: uuidv4(),
            walletAddress: investorWallet,
            userId: investor?.id ?? null,
            rwaTokenId: rwaToken.id,
            tokenAmount,
            investedUsdc,
            purchaseTx: signature,
            createdAt: new Date(),
        });

        await db
            .update(rwaTokens)
            .set({ tokensSold: sql`${rwaTokens.tokensSold} + ${tokenAmount}` })
            .where(eq(rwaTokens.id, rwaToken.id));

        console.info(`[helius-webhook] 투자 기록 완료: ${investorWallet} → ${listingId} × ${tokenAmount} (tx: ${signature})`);
        return true;
    }

    return false;
}
