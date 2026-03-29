import { db } from "~/db/index.server";
import { rwaTokens } from "~/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { fetchPropertiesOnchain } from "~/lib/rwa.onchain.server";

/**
 * funding 상태인 rwaTokens를 검사해 deadline 기준으로 상태를 전환한다.
 * - deadline 초과 + 목표 달성: funding → funded
 * - deadline 초과 + 목표 미달: funding → failed
 *
 * 온체인 tokensSold를 우선 사용한다. RPC 실패 시 DB 값으로 fallback.
 */
export async function syncFundingStatuses() {
    const now = new Date();

    const fundingTokens = await db
        .select({
            id: rwaTokens.id,
            listingId: rwaTokens.listingId,
            totalSupply: rwaTokens.totalSupply,
            tokensSold: rwaTokens.tokensSold,
            minFundingBps: rwaTokens.minFundingBps,
            fundingDeadline: rwaTokens.fundingDeadline,
        })
        .from(rwaTokens)
        .where(
            and(
                eq(rwaTokens.status, "funding"),
                lt(rwaTokens.fundingDeadline, now),
            )
        );

    if (fundingTokens.length === 0) return 0;

    // 온체인 tokensSold 일괄 조회
    const listingIds = fundingTokens.map(t => t.listingId);
    const onchainMap = await fetchPropertiesOnchain(listingIds);

    for (const token of fundingTokens) {
        const onchain = onchainMap.get(token.listingId);
        const tokensSold = onchain?.tokensSold ?? token.tokensSold;

        const minRequired = Math.floor((token.totalSupply * token.minFundingBps) / 10000);
        const newStatus = tokensSold >= minRequired ? "funded" : "failed";

        await db
            .update(rwaTokens)
            .set({
                status: newStatus,
                tokensSold: tokensSold,
                updatedAt: now,
            })
            .where(eq(rwaTokens.id, token.id));
    }

    return fundingTokens.length;
}

/**
 * funded 상태인 토큰을 active로 전환한다 (호스트/어드민 수동 트리거).
 */
export async function activateRwaToken(rwaTokenId: string) {
    const [existing] = await db
        .select({ status: rwaTokens.status })
        .from(rwaTokens)
        .where(eq(rwaTokens.id, rwaTokenId));

    if (!existing) throw new Error("rwaToken not found");
    if (existing.status !== "funded") throw new Error(`Cannot activate: current status is '${existing.status}'`);

    await db
        .update(rwaTokens)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(rwaTokens.id, rwaTokenId));
}
