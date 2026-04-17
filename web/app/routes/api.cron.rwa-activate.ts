import { crankActivateFundedTokens } from "~/lib/rwa.server";

/**
 * GET /api/cron/rwa-activate
 *
 * Vercel Cron Job — 매일 03:00 UTC 실행
 * funded 상태 RWA 토큰을 crank_authority로 자동 releaseFunds + activateProperty.
 * Authorization: Bearer <CRON_SECRET> 헤더로 인증
 */
export async function loader({ request }: { request: Request }) {
    const auth = request.headers.get("authorization");
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await crankActivateFundedTokens();
        console.info(
            `[cron/rwa-activate] activated=${result.activated.length} failed=${result.failed.length}`,
        );
        return Response.json({ ok: true, ...result });
    } catch (err: any) {
        console.error("[cron/rwa-activate]", err?.message ?? err);
        return Response.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
    }
}
