import { requireUser } from "~/lib/auth.server";
import { issueCouncilToken } from "~/lib/council-token.server";
import { PublicKey } from "@solana/web3.js";

/**
 * POST /api/admin/issue-council-token
 * Body: { walletAddress, amount? }
 *
 * Council Token 수동 발급 (admin 전용).
 * 운영자 생성 시 자동 발급되므로, 재발급이 필요한 경우에만 사용.
 */
export async function action({ request }: { request: Request }) {
    await requireUser(request, ["admin"]);

    const { walletAddress, amount = 1 } = (await request.json()) as {
        walletAddress: string;
        amount?: number;
    };

    if (!walletAddress) {
        return Response.json({ error: "walletAddress 필요" }, { status: 400 });
    }

    try {
        new PublicKey(walletAddress);
    } catch {
        return Response.json({ error: "유효하지 않은 지갑 주소" }, { status: 400 });
    }

    try {
        const sig = await issueCouncilToken(walletAddress, amount);
        console.info(`[council-token] issued ${amount} to ${walletAddress} | tx: ${sig}`);
        return Response.json({ ok: true, signature: sig, recipient: walletAddress, amount });
    } catch (e: any) {
        console.error("[council-token]", e?.message ?? e);
        return Response.json({ error: e?.message ?? "발급 실패" }, { status: 500 });
    }
}
