import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { listings, bookings, rwaTokens, rwaInvestments, rwaDividends, operatorSettlements, localGovSettlements, user } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { v4 as uuidv4 } from "uuid";

import { KRW_PER_USDC } from "~/lib/constants";

// 지자체 고정 수령 지갑 (환경변수 미설정 시 devnet 테스트 지갑)
const LOCAL_GOV_WALLET = import.meta.env?.VITE_LOCAL_GOV_WALLET ?? "GovWa11etXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

// base58 솔라나 tx 서명 형식 검증 (87-90자, base58 문자셋)
function isValidSolanaTx(sig: unknown): sig is string {
    if (typeof sig !== "string") return false;
    if (sig.length < 86 || sig.length > 90) return false;
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(sig);
}

/**
 * POST /api/admin/monthly-settlement
 *
 * 월 정산: operator 정산 + investor 배당 동시 처리
 * Body: { listingId, month, operatingCostKrw, dryRun? }
 *
 * dryRun: true  → 계산만 하고 DB 미기록 (미리보기)
 * dryRun: false → DB 기록 실행 (default)
 */
export async function action({ request }: { request: Request }) {
    await requireUser(request, ["admin"]);

    const body = await request.json() as {
        listingId: string;
        month: string;
        operatingCostKrw: number;
        dryRun?: boolean;
        distributeTx?: string | null;
        opPayoutTx?: string | null;
        govPayoutTx?: string | null;
    };
    const { listingId, month, operatingCostKrw, dryRun = false } = body;

    if (!listingId || !month) {
        return Response.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const currentMonth = DateTime.now().toFormat("yyyy-MM");
    if (month >= currentMonth) {
        return Response.json({ error: "정산은 해당 월이 종료된 이후에만 가능합니다." }, { status: 400 });
    }

    // 매물 정보
    const [listing] = await db
        .select({ operatorId: listings.operatorId })
        .from(listings)
        .where(eq(listings.id, listingId));
    if (!listing) return Response.json({ error: "매물 없음" }, { status: 404 });

    // 운영자 지갑 주소 조회
    let operatorWalletAddress: string | null = null;
    if (listing.operatorId) {
        const [operator] = await db
            .select({ walletAddress: user.walletAddress })
            .from(user)
            .where(eq(user.id, listing.operatorId));
        operatorWalletAddress = operator?.walletAddress ?? null;
    }

    // RWA 토큰 정보
    const [token] = await db
        .select({ id: rwaTokens.id, status: rwaTokens.status, totalSupply: rwaTokens.totalSupply })
        .from(rwaTokens)
        .where(eq(rwaTokens.listingId, listingId));

    // 해당 월 숙박 매출 자동 계산 (bookings)
    const [y, m] = month.split("-").map(Number);
    const startTs = DateTime.local(y, m, 1).startOf("month").toUnixInteger();
    const endTs = DateTime.local(y, m, 1).endOf("month").toUnixInteger();

    const [revenueRow] = await db
        .select({
            sum: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)`,
            count: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(
            and(
                eq(bookings.listingId, listingId),
                sql`${bookings.status} in ('confirmed', 'completed')`,
                sql`${bookings.checkIn} >= ${startTs}`,
                sql`${bookings.checkIn} <= ${endTs}`,
            )
        );

    const grossRevenueKrw = Number(revenueRow?.sum ?? 0);
    const bookingCount = Number(revenueRow?.count ?? 0);
    const cost = operatingCostKrw ?? 0;
    const operatingProfitKrw = Math.max(0, grossRevenueKrw - cost);

    // 분배 계산 (지자체 40% push, 운영자 30% push, 투자자 30% pull/claim)
    const localGovUsdc = Math.floor((operatingProfitKrw * 0.4 / KRW_PER_USDC) * 1_000_000);
    const operatorUsdc = Math.floor((operatingProfitKrw * 0.3 / KRW_PER_USDC) * 1_000_000);
    const investorUsdc = Math.floor((operatingProfitKrw * 0.3 / KRW_PER_USDC) * 1_000_000);

    // 투자자 수 조회
    let investorCount = 0;
    if (token && token.status === "active") {
        const investors = await db
            .select({ walletAddress: rwaInvestments.walletAddress })
            .from(rwaInvestments)
            .where(eq(rwaInvestments.rwaTokenId, token.id))
            .groupBy(rwaInvestments.walletAddress);
        investorCount = investors.length;
    }

    // dryRun이면 계산 결과 + 운영자 지갑 주소 반환
    if (dryRun) {
        return Response.json({
            ok: true,
            dryRun: true,
            grossRevenueKrw,
            operatingCostKrw: cost,
            operatingProfitKrw,
            bookingCount,
            localGovUsdc,
            operatorUsdc,
            investorUsdc,
            investorCount,
            hasOperator: !!listing.operatorId,
            hasActiveToken: !!(token && token.status === "active"),
            operatorWalletAddress,
        });
    }

    // 운영자가 있는데 지갑 미등록이면 차단
    if (listing.operatorId && !operatorWalletAddress) {
        return Response.json({ error: "운영자 지갑 미등록 — 운영자 대시보드에서 먼저 지갑을 등록해야 합니다" }, { status: 400 });
    }

    const { distributeTx, opPayoutTx, govPayoutTx } = body;

    if (operatingProfitKrw === 0) {
        return Response.json({ error: "영업이익이 0원입니다" }, { status: 400 });
    }

    const now = new Date();
    const results: Record<string, unknown> = {
        grossRevenueKrw,
        operatingCostKrw: cost,
        operatingProfitKrw,
        bookingCount,
        localGovUsdc,
        operatorUsdc,
        investorUsdc,
    };

    // 1. 지자체 분배 (영업이익 40%) — 어드민 push, 고정 지갑으로 자동 전송
    const existingGov = await db
        .select({ id: localGovSettlements.id })
        .from(localGovSettlements)
        .where(and(eq(localGovSettlements.listingId, listingId), eq(localGovSettlements.month, month)));

    if (existingGov.length === 0) {
        const validGovTx = isValidSolanaTx(govPayoutTx) ? govPayoutTx : null;
        await db.insert(localGovSettlements).values({
            id: uuidv4(),
            listingId,
            month,
            grossRevenueKrw,
            operatingProfitKrw,
            settlementUsdc: localGovUsdc,
            govWalletAddress: LOCAL_GOV_WALLET,
            payoutTx: validGovTx,
            paidAt: validGovTx ? now : null,
        });
        results.localGovSettlement = `${(localGovUsdc / 1_000_000).toFixed(2)} USDC${validGovTx ? ` (${validGovTx.slice(0, 16)}...)` : ""}`;
    } else {
        results.localGovSettlement = "이미 존재";
    }

    // 2. 운영자 정산 (영업이익 30%) — 어드민 push, 운영자 지갑으로 자동 전송
    if (listing.operatorId) {
        const existing = await db
            .select({ id: operatorSettlements.id })
            .from(operatorSettlements)
            .where(and(eq(operatorSettlements.listingId, listingId), eq(operatorSettlements.month, month)));

        if (existing.length === 0) {
            const validOpTx = isValidSolanaTx(opPayoutTx) ? opPayoutTx : null;
            await db.insert(operatorSettlements).values({
                id: uuidv4(),
                operatorId: listing.operatorId,
                listingId,
                month,
                grossRevenueKrw,
                operatingCostKrw: cost,
                operatingProfitKrw,
                settlementUsdc: operatorUsdc,
                payoutTx: validOpTx,
                paidAt: validOpTx ? now : null,
            });
            results.operatorSettlement = `${(operatorUsdc / 1_000_000).toFixed(2)} USDC${validOpTx ? ` (${validOpTx.slice(0, 16)}...)` : ""}`;
        } else {
            results.operatorSettlement = "이미 존재";
        }
    }

    // 2. 투자자 배당 (영업이익 30%, active 토큰만)
    if (token && token.status === "active") {
        const existing = await db
            .select({ id: rwaDividends.id })
            .from(rwaDividends)
            .where(and(eq(rwaDividends.rwaTokenId, token.id), eq(rwaDividends.month, month)));

        if (existing.length === 0) {
            const investments = await db
                .select({
                    walletAddress: rwaInvestments.walletAddress,
                    tokenAmount: sql<number>`sum(${rwaInvestments.tokenAmount})`,
                })
                .from(rwaInvestments)
                .where(eq(rwaInvestments.rwaTokenId, token.id))
                .groupBy(rwaInvestments.walletAddress);

            if (investments.length > 0) {
                const rows = investments.map((inv) => ({
                    id: `div-${token.id}-${month}-${inv.walletAddress.slice(0, 8)}`,
                    walletAddress: inv.walletAddress,
                    rwaTokenId: token.id,
                    month,
                    dividendUsdc: Math.floor((inv.tokenAmount / token.totalSupply) * investorUsdc),
                    createdAt: now,
                }));
                await db.insert(rwaDividends).values(rows).onConflictDoNothing();
                results.dividends = `${investments.length}명 배당 완료`;
                results.investorCount = investments.length;
                if (isValidSolanaTx(distributeTx)) {
                    results.distributeTx = distributeTx;
                }
            }
        } else {
            results.dividends = "이미 존재";
        }
    }

    return Response.json({ ok: true, ...results });
}
