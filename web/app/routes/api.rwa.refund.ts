import type { Route } from "./+types/api.rwa.refund";
import { db } from "~/db/index.server";
import { rwaInvestments, rwaTokens } from "~/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireWallet } from "~/lib/auth.server";
import { Connection } from "@solana/web3.js";
import { RPC_URL } from "~/lib/constants.server";

export async function action({ request }: Route.ActionArgs) {
    const { walletAddress } = await requireWallet(request);

    const { rwaTokenId, walletAddress: bodyWallet, refundTx } = await request.json();

    if (!rwaTokenId || !bodyWallet || !refundTx) {
        return Response.json({ error: "rwaTokenId, walletAddress, refundTx required" }, { status: 400 });
    }

    if (walletAddress !== bodyWallet) {
        return Response.json({ error: "세션 지갑과 요청 지갑이 일치하지 않습니다" }, { status: 403 });
    }

    // 토큰 존재 확인 (온체인에서 환불 성공했으면 DB 기록 허용)
    const [token] = await db
        .select({ status: rwaTokens.status })
        .from(rwaTokens)
        .where(eq(rwaTokens.id, rwaTokenId));

    if (!token) {
        return Response.json({ error: "토큰을 찾을 수 없습니다" }, { status: 404 });
    }

    // 온체인 TX 검증 — 실제로 성공한 트랜잭션인지 확인
    try {
        const conn = new Connection(RPC_URL, "confirmed");
        const txInfo = await conn.getTransaction(refundTx, {
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

    // 중복 환불 방지: 동일 refundTx가 이미 사용됐는지 확인
    const [existing] = await db
        .select({ refundTx: rwaInvestments.refundTx })
        .from(rwaInvestments)
        .where(eq(rwaInvestments.refundTx, refundTx));

    if (existing) {
        return Response.json({ error: "이미 처리된 트랜잭션입니다" }, { status: 400 });
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
