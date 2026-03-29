import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.server";
import { listings, rwaTokens } from "../db/schema";
import { requireUser } from "../lib/auth.server";

// 예상 APY = pricePerNight × 365 × 점유율 × (1 - 운영비율) × 투자자배분 / 감정가
// 상세 근거: docs/04_Logic_Progress/16_APY_CALCULATION_SPEC.md
const OCCUPANCY_RATE = 0.55;       // 점유율 55%
const OPERATING_COST_RATIO = 0.45; // 운영비 45% (청소/관리/플랫폼수수료/유지보수/세금)
const INVESTOR_SHARE = 0.30;       // 투자자 배분 30% (SPV 수익 분배 구조)

function calcApyBps(pricePerNight: number, valuationKrw: number): number {
    if (valuationKrw <= 0) return 0;
    const annualGross = pricePerNight * 365 * OCCUPANCY_RATE;
    const noi = annualGross * (1 - OPERATING_COST_RATIO);
    const investorReturn = noi * INVESTOR_SHARE;
    return Math.round(investorReturn / valuationKrw * 10000);
}

import { SERVER_PROGRAM_ID } from "~/lib/constants.server";
import { TOTAL_SUPPLY } from "~/lib/constants";

interface SaveMintBody {
    listingId: string;
    tokenMint: string;
    valuationKrw: number;
    pricePerTokenUsdc: number;
    minFundingBps: number;
    fundingDeadlineTs: number; // Unix timestamp (seconds)
}

export async function action({ request }: { request: Request }) {
    await requireUser(request, ["host", "admin"]);

    const body = await request.json() as SaveMintBody;
    const { listingId, tokenMint, valuationKrw, pricePerTokenUsdc, minFundingBps, fundingDeadlineTs } = body;

    if (!listingId || !tokenMint) {
        return Response.json({ error: "listingId and tokenMint are required" }, { status: 400 });
    }

    const fundingDeadline = new Date(fundingDeadlineTs * 1000);

    const listing = await db
        .select({ pricePerNight: listings.pricePerNight })
        .from(listings)
        .where(eq(listings.id, listingId))
        .then((r) => r[0]);

    const estimatedApyBps = listing
        ? calcApyBps(listing.pricePerNight, valuationKrw)
        : 0;

    const existing = await db
        .select({ id: rwaTokens.id })
        .from(rwaTokens)
        .where(eq(rwaTokens.listingId, listingId));

    if (existing.length > 0) {
        await db
            .update(rwaTokens)
            .set({
                tokenMint,
                totalSupply: TOTAL_SUPPLY,
                tokensSold: 0,
                valuationKrw,
                pricePerTokenUsdc,
                minFundingBps,
                estimatedApyBps,
                fundingDeadline,
                status: "funding",
                updatedAt: new Date(),
            })
            .where(eq(rwaTokens.listingId, listingId));
    } else {
        await db.insert(rwaTokens).values({
            id: uuidv4(),
            listingId,
            tokenMint,
            totalSupply: TOTAL_SUPPLY,
            tokensSold: 0,
            valuationKrw,
            pricePerTokenUsdc,
            minFundingBps,
            estimatedApyBps,
            fundingDeadline,
            status: "funding",
            programId: SERVER_PROGRAM_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    return Response.json({ ok: true });
}
