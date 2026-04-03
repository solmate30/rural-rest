import { db } from "~/db/index.server";
import { rwaTokens, listings } from "~/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { fetchPropertiesOnchain, tryAutoActivate } from "~/lib/rwa.onchain.server";

/* ------------------------------------------------------------------ */
/*  Throttled sync — loader에서 호출용 (5분 간격)                        */
/* ------------------------------------------------------------------ */
let _lastSyncAt = 0;
let _lastCrankAt = 0;
const THROTTLE_MS = 5 * 60 * 1000;

/** DB 상태 동기화 (throttled) */
export async function throttledSync() {
    const now = Date.now();
    if (now - _lastSyncAt < THROTTLE_MS) return;
    _lastSyncAt = now;
    await syncFundingStatuses();
}

/** DB 동기화 + 온체인 crank 활성화 (throttled, admin용) */
export async function throttledSyncAndCrank() {
    await throttledSync();
    const now = Date.now();
    if (now - _lastCrankAt < THROTTLE_MS) return;
    _lastCrankAt = now;
    try {
        const result = await crankActivateFundedTokens();
        if (result.activated.length > 0) {
            console.log(`[crank] 자동 활성화: ${result.activated.join(", ")}`);
        }
    } catch (e: any) {
        console.warn("[crank] 자동 활성화 실패:", e?.message);
    }
}

/**
 * 모든 rwaToken의 DB 상태를 온체인 기준으로 보정한다.
 * 온체인이 source of truth — DB 상태가 뒤처졌으면 온체인에 맞춰 업데이트.
 * 온체인 조회 실패 시 해당 토큰은 skip.
 */
export async function syncFundingStatuses() {
    const now = new Date();

    // active가 아닌 모든 rwaToken 조회 (active는 최종 상태이므로 보정 불필요)
    const tokens = await db
        .select({
            id: rwaTokens.id,
            listingId: rwaTokens.listingId,
            status: rwaTokens.status,
            tokensSold: rwaTokens.tokensSold,
            totalSupply: rwaTokens.totalSupply,
            fundingDeadline: rwaTokens.fundingDeadline,
        })
        .from(rwaTokens)
        .where(sql`${rwaTokens.status} != 'active'`);

    if (tokens.length === 0) return 0;

    const listingIds = tokens.map(t => t.listingId);
    const onchainMap = await fetchPropertiesOnchain(listingIds);

    let updated = 0;
    for (const token of tokens) {
        const onchain = onchainMap.get(token.listingId);
        if (!onchain) continue; // 온체인 조회 실패 → skip

        // 온체인 상태와 DB 상태가 다르면 보정
        const updates: Record<string, any> = {};

        if (token.status !== onchain.status) {
            updates.status = onchain.status;
        }
        if (token.tokensSold !== onchain.tokensSold) {
            updates.tokensSold = onchain.tokensSold;
        }
        if (token.totalSupply !== onchain.totalSupply) {
            updates.totalSupply = onchain.totalSupply;
        }
        // fundingDeadline 보정 (온체인은 unix seconds)
        const onchainDeadline = new Date(onchain.fundingDeadline * 1000);
        const dbDeadlineMs = token.fundingDeadline instanceof Date
            ? token.fundingDeadline.getTime()
            : Number(token.fundingDeadline) * 1000;
        if (Math.abs(onchainDeadline.getTime() - dbDeadlineMs) > 60_000) {
            updates.fundingDeadline = onchainDeadline;
        }

        if (Object.keys(updates).length > 0) {
            updates.updatedAt = now;
            await db
                .update(rwaTokens)
                .set(updates)
                .where(eq(rwaTokens.id, token.id));
            console.log(`[syncDB] ${token.listingId}: ${token.status} → ${updates.status ?? token.status} (sold: ${updates.tokensSold ?? token.tokensSold})`);
            updated++;
        }
    }

    return updated;
}

/**
 * 조건 충족 매물을 crank_authority로 자동 releaseFunds + activateProperty.
 * 대상: funding(마감+목표달성) 또는 funded 상태.
 * CRANK_SECRET_KEY 설정 시 온체인 트랜잭션 실행 후 DB 상태도 active로 갱신.
 */
export async function crankActivateFundedTokens(): Promise<{ activated: string[]; failed: string[] }> {
    const now = new Date();

    // 1) funded 상태 (이미 release된 것)
    const funded = await db
        .select({ id: rwaTokens.id, listingId: rwaTokens.listingId })
        .from(rwaTokens)
        .where(eq(rwaTokens.status, "funded"));

    // 2) funding + 마감 지남 + 목표 달성 (release 필요)
    const fundingPastDeadline = await db
        .select({
            id: rwaTokens.id,
            listingId: rwaTokens.listingId,
            totalSupply: rwaTokens.totalSupply,
            tokensSold: rwaTokens.tokensSold,
            minFundingBps: rwaTokens.minFundingBps,
        })
        .from(rwaTokens)
        .where(
            and(
                eq(rwaTokens.status, "funding"),
                lt(rwaTokens.fundingDeadline, now),
            )
        );

    const eligibleFunding = fundingPastDeadline.filter((t) => {
        const minRequired = Math.floor((t.totalSupply * t.minFundingBps) / 10000);
        return t.tokensSold >= minRequired;
    });

    const targets = [
        ...funded.map((t) => ({ id: t.id, listingId: t.listingId })),
        ...eligibleFunding.map((t) => ({ id: t.id, listingId: t.listingId })),
    ];

    const activated: string[] = [];
    const failed: string[] = [];

    for (const token of targets) {
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
 * funding → funded DB 전환 (온체인 release_funds 성공 후 호출).
 */
export async function releaseFundsRwaToken(rwaTokenId: string) {
    const [existing] = await db
        .select({ status: rwaTokens.status })
        .from(rwaTokens)
        .where(eq(rwaTokens.id, rwaTokenId));

    if (!existing) throw new Error("rwaToken not found");
    if (existing.status === "funded" || existing.status === "active") return; // 이미 진행됨
    if (existing.status !== "funding") throw new Error(`Cannot release: current status is '${existing.status}'`);

    await db
        .update(rwaTokens)
        .set({ status: "funded", updatedAt: new Date() })
        .where(eq(rwaTokens.id, rwaTokenId));
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
