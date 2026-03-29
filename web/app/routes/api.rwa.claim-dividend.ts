import type { Route } from "./+types/api.rwa.claim-dividend";
import { db } from "~/db/index.server";
import { rwaDividends } from "~/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireWallet } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
    const { walletAddress } = await requireWallet(request);

    const { rwaTokenId, walletAddress: bodyWallet, claimTx } = await request.json();

    if (!rwaTokenId || !bodyWallet || !claimTx) {
        return Response.json({ error: "rwaTokenId, walletAddress, claimTx required" }, { status: 400 });
    }

    if (walletAddress !== bodyWallet) {
        return Response.json({ error: "세션 지갑과 요청 지갑이 일치하지 않습니다" }, { status: 403 });
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
