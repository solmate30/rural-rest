import { db } from "~/db/index.server";
import { rwaInvestments, user } from "~/db/schema";
import { and, eq } from "drizzle-orm";
import type { Route } from "./+types/api.rwa.my-investment";
import { getSession } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const rwaTokenId = url.searchParams.get("rwaTokenId");
    const wallet = url.searchParams.get("wallet");

    if (!rwaTokenId || !wallet) {
        return Response.json({ error: "rwaTokenId, wallet 필수" }, { status: 400 });
    }

    // 세션의 등록된 지갑과 일치하는지 검증
    const session = await getSession(request);
    if (!session) {
        return Response.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    const [dbUser] = await db
        .select({ walletAddress: user.walletAddress })
        .from(user)
        .where(eq(user.id, session.user.id));

    if (!dbUser?.walletAddress || dbUser.walletAddress !== wallet) {
        return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });
    }

    const rows = await db
        .select({
            investedUsdc: rwaInvestments.investedUsdc,
            refundTx: rwaInvestments.refundTx,
        })
        .from(rwaInvestments)
        .where(
            and(
                eq(rwaInvestments.rwaTokenId, rwaTokenId),
                eq(rwaInvestments.walletAddress, wallet)
            )
        );

    if (rows.length === 0) {
        return Response.json({ investedUsdc: null, refundTx: null });
    }

    // 동일 지갑이 여러 번 구매했을 경우 합산
    const totalMicroUsdc = rows.reduce((sum, r) => sum + r.investedUsdc, 0);
    const refundTx = rows.find(r => r.refundTx)?.refundTx ?? null;

    return Response.json({
        investedUsdc: totalMicroUsdc / 1_000_000, // micro-USDC → USDC
        refundTx,
    });
}
