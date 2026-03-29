import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { rwaTokens, rwaInvestments, rwaDividends } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * POST /api/rwa/distribute-dividend
 *
 * 어드민이 특정 월의 배당을 전체 투자자에게 분배한다.
 * 투자 비율에 따라 dividendUsdc를 계산하고 rwa_dividends에 삽입한다.
 *
 * Body: { rwaTokenId: string, month: string, totalRevenueUsdc: number }
 *   totalRevenueUsdc: 이번 달 투자자 몫 배분액 (micro-USDC)
 */
export async function action({ request }: { request: Request }) {
    await requireUser(request, ["admin"]);

    const { rwaTokenId, month, totalRevenueUsdc } = await request.json() as {
        rwaTokenId: string;
        month: string;
        totalRevenueUsdc: number;
    };

    if (!rwaTokenId || !month || !totalRevenueUsdc || totalRevenueUsdc <= 0) {
        return Response.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    // 토큰 상태 확인 (active만 배당 가능)
    const [token] = await db
        .select({ status: rwaTokens.status, totalSupply: rwaTokens.totalSupply })
        .from(rwaTokens)
        .where(eq(rwaTokens.id, rwaTokenId));

    if (!token) return Response.json({ error: "토큰 없음" }, { status: 404 });
    if (token.status !== "active") {
        return Response.json({ error: "active 상태 토큰만 배당 가능" }, { status: 400 });
    }

    // 이미 해당 월 배당이 분배됐는지 확인
    const [existing] = await db
        .select({ id: rwaDividends.id })
        .from(rwaDividends)
        .where(and(eq(rwaDividends.rwaTokenId, rwaTokenId), eq(rwaDividends.month, month)));

    if (existing) {
        return Response.json({ error: `${month} 배당이 이미 분배됨` }, { status: 409 });
    }

    // 투자자별 보유량 집계
    const investments = await db
        .select({
            walletAddress: rwaInvestments.walletAddress,
            tokenAmount: sql<number>`sum(${rwaInvestments.tokenAmount})`,
        })
        .from(rwaInvestments)
        .where(eq(rwaInvestments.rwaTokenId, rwaTokenId))
        .groupBy(rwaInvestments.walletAddress);

    if (investments.length === 0) {
        return Response.json({ error: "투자자 없음" }, { status: 400 });
    }

    const totalSupply = token.totalSupply;

    // 각 투자자에게 배당 삽입
    const now = new Date();
    const rows = investments.map((inv) => ({
        id: `div-${rwaTokenId}-${month}-${inv.walletAddress.slice(0, 8)}`,
        walletAddress: inv.walletAddress,
        rwaTokenId,
        month,
        dividendUsdc: Math.floor((inv.tokenAmount / totalSupply) * totalRevenueUsdc),
        createdAt: now,
    }));

    await db.insert(rwaDividends).values(rows).onConflictDoNothing();

    return Response.json({ ok: true, distributed: rows.length });
}
