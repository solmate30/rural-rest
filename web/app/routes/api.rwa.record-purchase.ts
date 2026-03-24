import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.server";
import { rwaInvestments, rwaTokens } from "../db/schema";
import { getSession } from "../lib/auth.server";

interface RecordPurchaseBody {
    rwaTokenId: string;
    tokenAmount: number;
    investedUsdc: number; // micro-USDC
    purchaseTx: string;
    investorWallet: string; // Solana pubkey
}

export async function action({ request }: { request: Request }) {
    const body = await request.json() as RecordPurchaseBody;
    const { rwaTokenId, tokenAmount, investedUsdc, purchaseTx, investorWallet } = body;

    if (!rwaTokenId || !tokenAmount || !purchaseTx || !investorWallet) {
        return Response.json({ error: "rwaTokenId, tokenAmount, purchaseTx, investorWallet are required" }, { status: 400 });
    }

    // Better Auth 세션 있으면 userId도 함께 저장, 없으면 wallet 주소를 fallback으로 사용
    const session = await getSession(request);
    const userId = session?.user?.id ?? `wallet:${investorWallet}`;

    await db.insert(rwaInvestments).values({
        id: uuidv4(),
        walletAddress: investorWallet,
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
