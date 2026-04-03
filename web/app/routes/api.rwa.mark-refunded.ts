import { db } from "~/db/index.server";
import { rwaInvestments } from "~/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireWallet } from "~/lib/auth.server";

/**
 * POST /api/rwa/mark-refunded
 * 온체인에서 이미 환불 완료됐지만 DB에 기록 안 된 경우 마킹.
 */
export async function action({ request }: { request: Request }) {
    const { walletAddress } = await requireWallet(request);
    const { rwaTokenId } = await request.json();

    if (!rwaTokenId) {
        return Response.json({ error: "rwaTokenId required" }, { status: 400 });
    }

    await db
        .update(rwaInvestments)
        .set({ refundTx: "already-refunded-onchain" })
        .where(
            and(
                eq(rwaInvestments.rwaTokenId, rwaTokenId),
                eq(rwaInvestments.walletAddress, walletAddress),
                isNull(rwaInvestments.refundTx),
            )
        );

    return Response.json({ ok: true });
}
