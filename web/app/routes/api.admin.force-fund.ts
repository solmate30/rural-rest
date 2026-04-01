import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { rwaTokens } from "../db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/admin/force-fund
 * Body: { rwaTokenId }
 *
 * funding → funded 수동 전환 (어드민 전용).
 * 온체인 validator 없이도 강제 전환 가능.
 */
export async function action({ request }: { request: Request }) {
    await requireUser(request, ["admin"]);

    const { rwaTokenId } = await request.json() as { rwaTokenId: string };
    if (!rwaTokenId) {
        return Response.json({ error: "rwaTokenId 누락" }, { status: 400 });
    }

    const [token] = await db
        .select({ id: rwaTokens.id, status: rwaTokens.status })
        .from(rwaTokens)
        .where(eq(rwaTokens.id, rwaTokenId));

    if (!token) {
        return Response.json({ error: "토큰 없음" }, { status: 404 });
    }
    if (token.status !== "funding") {
        return Response.json({ error: `현재 상태가 funding이 아닙니다 (${token.status})` }, { status: 400 });
    }

    await db
        .update(rwaTokens)
        .set({ status: "funded", updatedAt: new Date() })
        .where(eq(rwaTokens.id, rwaTokenId));

    return Response.json({ ok: true });
}
