import type { Route } from "./+types/api.rwa.crank-activate";
import { requireUser } from "~/lib/auth.server";
import { crankActivateFundedTokens } from "~/lib/rwa.server";

/**
 * POST /api/rwa/crank-activate
 *
 * funded 상태 매물을 crank_authority로 자동 releaseFunds + activateProperty.
 * admin만 호출 가능. CRANK_SECRET_KEY 미설정 시 빈 결과 반환.
 *
 * 응답:
 *   { activated: string[], failed: string[] }
 */
export async function action({ request }: Route.ActionArgs) {
    await requireUser(request, ["admin"]);

    try {
        const result = await crankActivateFundedTokens();
        console.log(
            `[crank-activate] 완료 — activated: ${result.activated.length}, failed: ${result.failed.length}`
        );
        return Response.json({ ok: true, ...result });
    } catch (e: any) {
        console.error("[crank-activate] 오류:", e?.message ?? e);
        return Response.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
    }
}
