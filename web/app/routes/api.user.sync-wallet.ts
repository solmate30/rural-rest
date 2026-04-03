/**
 * api.user.sync-wallet.ts
 * 로그인 후 Privy 임베디드 지갑이 생성되면 DB wallet_address 업데이트
 */
import { getSession } from "../lib/privy.server";
import { db } from "../db/index.server";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.user.sync-wallet";

function isValidSolanaAddress(addr: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function action({ request }: Route.ActionArgs) {
    const session = await getSession(request);
    if (!session) return Response.json({ error: "인증 필요" }, { status: 401 });

    const { walletAddress } = await request.json();
    if (!walletAddress || typeof walletAddress !== "string" || !isValidSolanaAddress(walletAddress)) {
        return Response.json({ error: "유효하지 않은 walletAddress" }, { status: 400 });
    }

    // 이미 저장된 경우 스킵
    if (session.user.walletAddress === walletAddress) {
        return Response.json({ ok: true, updated: false });
    }

    await db
        .update(schema.user)
        .set({
            walletAddress,
            walletConnectedAt: new Date().toISOString(),
            updatedAt: new Date(),
        })
        .where(eq(schema.user.id, session.user.id));

    return Response.json({ ok: true, updated: true });
}
