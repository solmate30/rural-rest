import type { Route } from "./+types/api.rwa.refund";
import { db } from "~/db/index.server";
import { rwaInvestments, rwaTokens } from "~/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function action({ request }: Route.ActionArgs) {
    const { rwaTokenId, walletAddress, refundTx } = await request.json();

    if (!rwaTokenId || !walletAddress || !refundTx) {
        return Response.json({ error: "rwaTokenId, walletAddress, refundTx required" }, { status: 400 });
    }

    // 토큰 상태 확인 — failed 아니면 거부
    const [token] = await db
        .select({ status: rwaTokens.status })
        .from(rwaTokens)
        .where(eq(rwaTokens.id, rwaTokenId));

    if (!token || token.status !== "failed") {
        return Response.json({ error: "환불 가능한 상태가 아닙니다" }, { status: 400 });
    }

    // 미환불 투자 내역 전부 환불 처리
    await db
        .update(rwaInvestments)
        .set({ refundTx })
        .where(
            and(
                eq(rwaInvestments.rwaTokenId, rwaTokenId),
                eq(rwaInvestments.walletAddress, walletAddress),
                isNull(rwaInvestments.refundTx),
            )
        );

    return Response.json({ ok: true });
}
