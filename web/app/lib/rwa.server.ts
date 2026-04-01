import { db } from "~/db/index.server";
import { rwaTokens, listings } from "~/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { fetchPropertiesOnchain, tryAutoActivate } from "~/lib/rwa.onchain.server";

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

    let updated = 0;
    for (const token of fundingTokens) {
        const onchain = onchainMap.get(token.listingId);

        // 온체인 데이터 없으면:
        //  - funded 방향은 DB tokensSold로 fallback 허용 (잘못 funded → releaseFunds 실패로 끝남, 안전)
        //  - failed 방향은 skip (잘못 failed → 환불 오픈, 위험)
        const tokensSold = onchain?.tokensSold ?? token.tokensSold;
        const minRequired = Math.floor((token.totalSupply * token.minFundingBps) / 10000);

        if (!onchain && tokensSold < minRequired) {
            console.warn(`[syncFundingStatuses] 온체인 데이터 없음 + 미달성 — failed 전환 보류: ${token.listingId}`);
            continue;
        }
        if (!onchain) {
            console.warn(`[syncFundingStatuses] 온체인 데이터 없음 — DB 기준 funded 전환: ${token.listingId}`);
        }

        const newStatus = tokensSold >= minRequired ? "funded" : "failed";

        await db
            .update(rwaTokens)
            .set({
                status: newStatus,
                tokensSold: tokensSold,
                updatedAt: now,
            })
            .where(eq(rwaTokens.id, token.id));

        updated++;
    }

    return updated;
}

/**
 * funded 상태인 매물을 crank_authority로 자동 releaseFunds + activateProperty.
 * CRANK_SECRET_KEY 설정 시 온체인 트랜잭션 실행 후 DB 상태도 active로 갱신.
 * 반환: { activated: listingId[], failed: listingId[] }
 */
export async function crankActivateFundedTokens(): Promise<{ activated: string[]; failed: string[] }> {
    const funded = await db
        .select({ id: rwaTokens.id, listingId: rwaTokens.listingId })
        .from(rwaTokens)
        .where(eq(rwaTokens.status, "funded"));

    const activated: string[] = [];
    const failed: string[] = [];

    for (const token of funded) {
        const ok = await tryAutoActivate(token.listingId);
        if (ok) {
            await db
                .update(rwaTokens)
                .set({ status: "active", updatedAt: new Date() })
                .where(eq(rwaTokens.id, token.id));
            activated.push(token.listingId);
        } else {
            failed.push(token.listingId);
        }
    }

    return { activated, failed };
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
