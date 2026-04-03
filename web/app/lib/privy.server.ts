/**
 * privy.server.ts — Privy 서버사이드 인증 헬퍼
 *
 * - privy_token httpOnly 쿠키에서 Privy 액세스 토큰을 읽어 검증
 * - DB user 조회 + role 체크
 * - requireUser / getSession / requireWallet 인터페이스는 기존 auth.server.ts와 동일
 */

import { PrivyClient } from "@privy-io/server-auth";
import { db } from "../db/index.server";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "react-router";

export const privyClient = new PrivyClient(
    process.env.VITE_PRIVY_APP_ID!,
    process.env.PRIVY_APP_SECRET!,
);

function getPrivyToken(request: Request): string | null {
    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.match(/(?:^|;\s*)privy_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export async function requireUser(
    request: Request,
    allowedRoles: string[] = ["guest", "spv", "operator", "admin"],
) {
    const token = getPrivyToken(request);
    if (!token) throw redirect("/auth");

    let privyDid: string;
    try {
        const claims = await privyClient.verifyAuthToken(token);
        privyDid = claims.userId;
    } catch {
        throw redirect("/auth");
    }

    const [user] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.privyDid, privyDid));

    if (!user) throw redirect("/auth");

    if (!allowedRoles.includes(user.role)) {
        throw new Response("Forbidden", { status: 403 });
    }

    return user;
}

export async function getSession(request: Request) {
    const token = getPrivyToken(request);
    if (!token) return null;

    try {
        const claims = await privyClient.verifyAuthToken(token);
        const [user] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.privyDid, claims.userId));
        return user ? { user } : null;
    } catch {
        return null;
    }
}

export async function requireWallet(
    request: Request,
): Promise<{ userId: string; walletAddress: string }> {
    const user = await requireUser(request);
    if (!user.walletAddress) {
        throw Response.json({ error: "지갑이 등록되지 않았습니다" }, { status: 403 });
    }
    return { userId: user.id, walletAddress: user.walletAddress };
}
