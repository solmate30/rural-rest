import type { Route } from "./+types/api.rwa.cancel-position";
import { db } from "~/db/index.server";
import { rwaInvestments, rwaTokens } from "~/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireWallet } from "~/lib/auth.server";
import { Connection } from "@solana/web3.js";
import { RPC_URL } from "~/lib/constants.server";

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

    // 온체인 TX 검증 — 실제로 성공한 트랜잭션인지 확인
    try {
        const conn = new Connection(RPC_URL, "confirmed");
        const txInfo = await conn.getTransaction(cancelTx, {
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

    // 중복 취소 방지: 동일 cancelTx가 이미 사용됐는지 확인
    const [existing] = await db
        .select({ refundTx: rwaInvestments.refundTx })
        .from(rwaInvestments)
        .where(eq(rwaInvestments.refundTx, cancelTx));

    if (existing) {
        return Response.json({ error: "이미 처리된 트랜잭션입니다" }, { status: 400 });
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

    if (!invested || invested.total <= 0) {
        return Response.json({ error: "취소할 투자 내역이 없습니다" }, { status: 400 });
    }

    const actualTokenAmount = invested.total;

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

    await db
        .update(rwaTokens)
        .set({
            tokensSold: sql`MAX(0, ${rwaTokens.tokensSold} - ${actualTokenAmount})`,
            updatedAt: new Date(),
        })
        .where(eq(rwaTokens.id, rwaTokenId));

    return Response.json({ ok: true });
}
