import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.server";
import { rwaInvestments, rwaTokens } from "../db/schema";
import { requireWallet } from "../lib/auth.server";
import { Connection } from "@solana/web3.js";
import { RPC_URL } from "~/lib/constants.server";

interface RecordPurchaseBody {
    rwaTokenId: string;
    tokenAmount: number;
    investedUsdc: number; // micro-USDC
    purchaseTx: string;
    investorWallet: string; // Solana pubkey
}

export async function action({ request }: { request: Request }) {
    const { userId, walletAddress } = await requireWallet(request);

    const body = await request.json() as RecordPurchaseBody;
    const { rwaTokenId, tokenAmount, investedUsdc, purchaseTx, investorWallet } = body;

    if (!rwaTokenId || !tokenAmount || !purchaseTx || !investorWallet) {
        return Response.json({ error: "rwaTokenId, tokenAmount, purchaseTx, investorWallet are required" }, { status: 400 });
    }

    if (walletAddress !== investorWallet) {
        return Response.json({ error: "세션 지갑과 요청 지갑이 일치하지 않습니다" }, { status: 403 });
    }

    // 온체인 TX 검증
    try {
        const conn = new Connection(RPC_URL, "confirmed");
        const txInfo = await conn.getTransaction(purchaseTx, {
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

    await db.insert(rwaInvestments).values({
        id: uuidv4(),
        walletAddress,
        userId,
        rwaTokenId,
        tokenAmount,
        investedUsdc,
        purchaseTx,
        createdAt: new Date(),
    });

    await db
        .update(rwaTokens)
        .set({ tokensSold: sql`${rwaTokens.tokensSold} + ${tokenAmount}` })
        .where(eq(rwaTokens.id, rwaTokenId));

    return Response.json({ ok: true });
}
