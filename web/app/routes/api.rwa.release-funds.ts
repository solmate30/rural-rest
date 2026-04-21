import { requireUser } from "~/lib/auth.server";
import { releaseFundsRwaToken, activateRwaToken } from "~/lib/rwa.server";
import { tryAutoActivate } from "~/lib/rwa.onchain.server";
import { db } from "~/db/index.server";
import { rwaTokens, listings } from "~/db/schema";
import { eq } from "drizzle-orm";

export async function action({ request }: { request: Request }) {
    await requireUser(request, ["spv", "admin"]);

    const { rwaTokenId } = await request.json() as { rwaTokenId: string };
    if (!rwaTokenId) {
        return Response.json({ error: "rwaTokenId required" }, { status: 400 });
    }

    // listingId 조회
    const [token] = await db
        .select({ listingId: rwaTokens.listingId, status: rwaTokens.status })
        .from(rwaTokens)
        .where(eq(rwaTokens.id, rwaTokenId));

    if (!token) {
        return Response.json({ error: "rwaToken not found" }, { status: 404 });
    }

    try {
        // 1) 온체인: CRANK_SECRET_KEY로 releaseFunds + activateProperty 실행
        const onchainOk = await tryAutoActivate(token.listingId);

        if (onchainOk) {
            // 2) DB: funding → active (중간 상태 건너뜀)
            await activateRwaToken(rwaTokenId).catch(async () => {
                // funded → active가 안 되면 funding → funded → active 순서로
                await releaseFundsRwaToken(rwaTokenId);
                await activateRwaToken(rwaTokenId);
            });
            return Response.json({ ok: true, activated: true });
        } else {
            return Response.json({ ok: false, activated: false, error: "온체인 활성화 실패 — 서버 로그를 확인하세요" }, { status: 500 });
        }
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 });
    }
}
