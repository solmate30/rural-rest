import type { Route } from "./+types/api.rwa.cancel-position";
import { db } from "~/db/index.server";
import { rwaInvestments, rwaTokens } from "~/db/schema";
import { and, eq, isNull, sum } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireWallet } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
    const { walletAddress } = await requireWallet(request);

    const { rwaTokenId, walletAddress: bodyWallet, cancelTx } = await request.json();

    if (!rwaTokenId || !bodyWallet || !cancelTx) {
        return Response.json({ error: "rwaTokenId, walletAddress, cancelTx required" }, { status: 400 });
    }

    if (walletAddress !== bodyWallet) {
        return Response.json({ error: "세션 지갑과 요청 지갑이 일치하지 않습니다" }, { status: 403 });
    }

    const [token] = await db
        .select({ status: rwaTokens.status })
        .from(rwaTokens)
        .where(eq(rwaTokens.id, rwaTokenId));

    if (!token || token.status !== "funding") {
        return Response.json({ error: "취소 가능한 상태가 아닙니다" }, { status: 400 });
    }

    // DB에서 실제 투자 수량 조회 (프론트가 보낸 값을 믿지 않음)
    const [invested] = await db
        .select({ total: sql<number>`COALESCE(SUM(${rwaInvestments.tokenAmount}), 0)` })
        .from(rwaInvestments)
        .where(
            and(
                eq(rwaInvestments.rwaTokenId, rwaTokenId),
                eq(rwaInvestments.walletAddress, walletAddress),
                isNull(rwaInvestments.refundTx),
            )
        );

    const actualTokenAmount = invested?.total ?? 0;

    await db
        .update(rwaInvestments)
        .set({ refundTx: cancelTx })
        .where(
            and(
                eq(rwaInvestments.rwaTokenId, rwaTokenId),
                eq(rwaInvestments.walletAddress, walletAddress),
                isNull(rwaInvestments.refundTx),
            )
        );

    if (actualTokenAmount > 0) {
        await db
            .update(rwaTokens)
            .set({
                tokensSold: sql`MAX(0, ${rwaTokens.tokensSold} - ${actualTokenAmount})`,
                updatedAt: new Date(),
            })
            .where(eq(rwaTokens.id, rwaTokenId));
    }

    return Response.json({ ok: true });
}
