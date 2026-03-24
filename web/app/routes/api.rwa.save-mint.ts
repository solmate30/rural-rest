import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.server";
import { listings, rwaTokens } from "../db/schema";
import { requireUser } from "../lib/auth.server";

// 예상 APY = pricePerNight × 365 × 55% 점유율 × 30% 순수익률 / 감정가
function calcApyBps(pricePerNight: number, valuationKrw: number): number {
    return Math.round((pricePerNight * 365 * 0.55 * 0.30) / valuationKrw * 10000);
}

const PROGRAM_ID = process.env.RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
const TOTAL_SUPPLY = 100_000_000;

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
            programId: PROGRAM_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    return Response.json({ ok: true });
}
