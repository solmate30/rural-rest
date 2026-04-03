import type { Route } from "./+types/api.rwa.claim-dividend";
import { db } from "~/db/index.server";
import { rwaDividends } from "~/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireWallet } from "~/lib/auth.server";
import { Connection } from "@solana/web3.js";
import { RPC_URL } from "~/lib/constants.server";

export async function action({ request }: Route.ActionArgs) {
    const { walletAddress } = await requireWallet(request);

    const { rwaTokenId, walletAddress: bodyWallet, claimTx } = await request.json();

    if (!rwaTokenId || !bodyWallet || !claimTx) {
        return Response.json({ error: "rwaTokenId, walletAddress, claimTx required" }, { status: 400 });
    }

    if (walletAddress !== bodyWallet) {
        return Response.json({ error: "세션 지갑과 요청 지갑이 일치하지 않습니다" }, { status: 403 });
    }

    // 온체인 TX 검증 — 실제로 성공한 트랜잭션인지 확인
    try {
        const conn = new Connection(RPC_URL, "confirmed");
        const txInfo = await conn.getTransaction(claimTx, {
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

    // 중복 수령 방지: 동일 claimTx가 이미 사용됐는지 확인
    const [existing] = await db
        .select({ claimTx: rwaDividends.claimTx })
        .from(rwaDividends)
        .where(eq(rwaDividends.claimTx, claimTx));

    if (existing) {
        return Response.json({ error: "이미 처리된 트랜잭션입니다" }, { status: 400 });
    }

    // 해당 지갑의 미수령(claimTx = null) 배당 전부 수령 처리
    await db
        .update(rwaDividends)
        .set({ claimTx, claimedAt: new Date() })
        .where(
            and(
                eq(rwaDividends.rwaTokenId, rwaTokenId),
                eq(rwaDividends.walletAddress, walletAddress),
                isNull(rwaDividends.claimTx),
            )
        );

    return Response.json({ ok: true });
}
