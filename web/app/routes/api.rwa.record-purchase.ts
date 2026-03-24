import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.server";
import { rwaInvestments, rwaTokens } from "../db/schema";
import { requireUser } from "../lib/auth.server";

interface RecordPurchaseBody {
    rwaTokenId: string;
    tokenAmount: number;
    investedUsdc: number; // micro-USDC
    purchaseTx: string;
}

export async function action({ request }: { request: Request }) {
    const currentUser = await requireUser(request);

    const body = await request.json() as RecordPurchaseBody;
    const { rwaTokenId, tokenAmount, investedUsdc, purchaseTx } = body;

    if (!rwaTokenId || !tokenAmount || !purchaseTx) {
        return Response.json({ error: "rwaTokenId, tokenAmount, purchaseTx are required" }, { status: 400 });
    }

    await db.insert(rwaInvestments).values({
        id: uuidv4(),
        userId: currentUser.id,
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
