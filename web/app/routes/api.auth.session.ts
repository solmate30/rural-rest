/**
 * api.auth.session.ts
 *
 * POST  — Privy 액세스 토큰 검증 → privy_token httpOnly 쿠키 발급 + DB user upsert
 * DELETE — privy_token 쿠키 삭제 (로그아웃)
 */
import { privyClient } from "../lib/privy.server";
import { db } from "../db/index.server";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.auth.session";

const COOKIE_MAX_AGE = 60 * 60 * 6; // 6시간 (Privy 토큰 기본 만료)

function isValidSolanaAddress(addr: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function action({ request }: Route.ActionArgs) {
    // DELETE: 로그아웃 — 쿠키 삭제
    if (request.method === "DELETE") {
        return Response.json(
            { ok: true },
            {
                headers: {
                    "Set-Cookie": "privy_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
                },
            },
        );
    }

    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    let token: string;
    let clientWalletAddress: string | null = null;
    try {
        const body = await request.json();
        token = body?.token;
        const raw = body?.walletAddress ?? null;
        clientWalletAddress = raw && isValidSolanaAddress(raw) ? raw : null;
        if (!token) throw new Error("token missing");
    } catch {
        return Response.json({ error: "token이 필요합니다" }, { status: 400 });
    }

    // Privy 토큰 검증
    let privyDid: string;
    try {
        const claims = await privyClient.verifyAuthToken(token);
        privyDid = claims.userId;
    } catch {
        return Response.json({ error: "유효하지 않은 토큰" }, { status: 401 });
    }

    // Privy에서 사용자 정보 조회
    let privyUser: Awaited<ReturnType<typeof privyClient.getUser>>;
    try {
        privyUser = await privyClient.getUser(privyDid);
    } catch (e) {
        console.error("[session] getUser failed:", e);
        return Response.json({ error: "Privy 사용자 조회 실패" }, { status: 500 });
    }
    const emailAddr =
        privyUser.email?.address ??
        (privyUser.linkedAccounts.find((a) => a.type === "google_oauth") as any)?.email ??
        null;
    const displayName =
        (privyUser.linkedAccounts.find((a) => a.type === "google_oauth") as any)?.name ??
        emailAddr?.split("@")[0] ??
        "사용자";

    // 지갑 주소: 클라이언트 전달값 우선, 없으면 Privy 서버 조회값 사용
    const serverSolanaWallet = privyUser.linkedAccounts.find(
        (a: any) => a.type === "wallet" && a.chainType === "solana" && a.walletClientType === "privy",
    ) as any;
    const walletAddress: string | null = clientWalletAddress ?? serverSolanaWallet?.address ?? null;

    // DB user upsert
    const [existing] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.privyDid, privyDid));

    let dbUser = existing;

    if (!dbUser) {
        const newId = crypto.randomUUID();
        const now = new Date();
        await db.insert(schema.user).values({
            id: newId,
            name: displayName,
            email: emailAddr ?? `${newId}@privy.local`,
            emailVerified: true,
            role: "guest",
            preferredLang: "ko",
            kycVerified: false,
            privyDid,
            walletAddress,
            walletConnectedAt: walletAddress ? now.toISOString() : null,
            createdAt: now,
            updatedAt: now,
        });
        const [inserted] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.privyDid, privyDid));
        dbUser = inserted;
    } else if (walletAddress && !dbUser.walletAddress) {
        // 재로그인 시 지갑이 새로 생성된 경우 업데이트
        await db
            .update(schema.user)
            .set({ walletAddress, walletConnectedAt: new Date().toISOString(), updatedAt: new Date() })
            .where(eq(schema.user.privyDid, privyDid));
        dbUser = { ...dbUser, walletAddress };
    }

    return Response.json(
        {
            ok: true,
            user: {
                id: dbUser!.id,
                name: dbUser!.name,
                role: dbUser!.role,
            },
        },
        {
            headers: {
                "Set-Cookie": `privy_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
            },
        },
    );
}
