import type { Route } from "./+types/api.rwa.claim-dividend";
import { db } from "~/db/index.server";
import { rwaDividends } from "~/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function action({ request }: Route.ActionArgs) {
    const { rwaTokenId, walletAddress, claimTx } = await request.json();

    if (!rwaTokenId || !walletAddress || !claimTx) {
        return Response.json({ error: "rwaTokenId, walletAddress, claimTx required" }, { status: 400 });
    }

    const now = new Date();

    // 해당 지갑의 미수령(claimTx = null) 배당 전부 수령 처리
    await db
        .update(rwaDividends)
        .set({ claimTx, claimedAt: now })
        .where(
            and(
                eq(rwaDividends.rwaTokenId, rwaTokenId),
                eq(rwaDividends.walletAddress, walletAddress),
                isNull(rwaDividends.claimTx),
            )
        );

    return Response.json({ ok: true });
}
