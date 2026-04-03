import { db } from "../app/db/index.server";
import { listings, rwaTokens } from "../app/db/schema";
import { eq } from "drizzle-orm";
import { fetchPropertyOnchain } from "../app/lib/rwa.onchain.server";

async function main() {
    const rows = await db.select({
        listingId: listings.id,
        title: listings.title,
        rwaId: rwaTokens.id,
        status: rwaTokens.status,
        fundingDeadline: rwaTokens.fundingDeadline,
        totalSupply: rwaTokens.totalSupply,
        tokensSold: rwaTokens.tokensSold,
        minFundingBps: rwaTokens.minFundingBps,
    }).from(rwaTokens).innerJoin(listings, eq(rwaTokens.listingId, listings.id));

    for (const r of rows) {
        const dl = r.fundingDeadline instanceof Date ? r.fundingDeadline : new Date(Number(r.fundingDeadline) * 1000);
        const minRequired = Math.floor((r.totalSupply * r.minFundingBps) / 10000);
        const deadlinePassed = Date.now() > dl.getTime();
        const goalFailed = r.tokensSold < minRequired;

        const onchain = await fetchPropertyOnchain(r.listingId);

        console.log(`\n[${r.rwaId}] ${r.title}`);
        console.log(`  listingId: ${r.listingId}`);
        console.log(`  DB status: ${r.status}`);
        console.log(`  DB deadline: ${dl.toISOString()} (passed: ${deadlinePassed})`);
        console.log(`  DB tokensSold: ${r.tokensSold} / ${r.totalSupply} (min: ${minRequired})`);
        if (onchain) {
            console.log(`  ONCHAIN status: ${onchain.status}`);
            console.log(`  ONCHAIN tokensSold: ${onchain.tokensSold}`);
            console.log(`  ONCHAIN deadline: ${new Date(onchain.fundingDeadline * 1000).toISOString()}`);
            console.log(`  ONCHAIN fundsReleased: ${onchain.fundsReleased}`);
        } else {
            console.log(`  ONCHAIN: not found`);
        }
    }
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
