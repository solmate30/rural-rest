/**
 * api.admin.create-operator.ts
 *
 * POST — 마을운영자 계정 생성
 *
 * 이메일은 고유키. 이미 DB에 존재하면 409 에러 반환.
 * 1) DB email 중복 체크
 * 2) Privy importUser (이메일 계정 + Solana 임베디드 지갑)
 * 3) DB INSERT (role: "operator")
 *
 * OTP는 서버에서 발송하지 않음.
 * 운영자가 /auth에서 이메일 입력하면 Privy 클라이언트가 OTP를 자동 발송함.
 */

import type { User } from "@privy-io/server-auth";
import { privyClient } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "~/lib/auth.server";
import { issueCouncilToken } from "~/lib/council-token.server";
import type { Route } from "./+types/api.admin.create-operator";

export async function action({ request }: Route.ActionArgs) {
    await requireUser(request, ["admin"]);

    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // 입력 파싱
    let email: string;
    let name: string;
    try {
        const body = await request.json();
        email = String(body.email ?? "").trim().toLowerCase();
        name = String(body.name ?? "").trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return Response.json({ error: "유효한 이메일을 입력해주세요" }, { status: 400 });
        }
        if (!name) {
            return Response.json({ error: "이름을 입력해주세요" }, { status: 400 });
        }
    } catch {
        return Response.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
    }

    // DB 중복 체크 — 이메일은 고유키
    try {
        const [existing] = await db
            .select({ id: userTable.id, role: userTable.role })
            .from(userTable)
            .where(eq(userTable.email, email));

        if (existing) {
            return Response.json(
                { error: `이미 등록된 이메일입니다. (현재 역할: ${existing.role})` },
                { status: 409 },
            );
        }
    } catch (dbErr: any) {
        console.error("[create-operator] DB 조회 실패:", dbErr);
        return Response.json({ error: "DB 조회 실패: " + (dbErr?.message ?? "") }, { status: 500 });
    }

    // Privy 계정 생성
    let privyUser: User;
    try {
        privyUser = await privyClient.importUser({
            linkedAccounts: [{ type: "email", address: email }],
            createSolanaWallet: true,
        });
    } catch (e: any) {
        const msg: string = e?.message ?? "";
        if (msg.includes("already exists") || msg.includes("duplicate")) {
            return Response.json(
                { error: "이미 Privy에 등록된 이메일입니다." },
                { status: 409 },
            );
        }
        console.error("[create-operator] Privy importUser 실패:", e);
        return Response.json({ error: "Privy 계정 생성 실패: " + msg }, { status: 500 });
    }

    const privyDid = privyUser.id;
    const solanaWallet = (privyUser.linkedAccounts as any[]).find(
        (a) => a.type === "wallet" && a.chainType === "solana",
    );
    const walletAddress: string | null = solanaWallet?.address ?? null;

    // DB INSERT
    try {
        const now = new Date();
        const userId = crypto.randomUUID();
        await db.insert(userTable).values({
            id: userId,
            name,
            email,
            emailVerified: true,
            role: "operator",
            preferredLang: "ko",
            kycVerified: false,
            privyDid,
            walletAddress,
            walletConnectedAt: walletAddress ? now.toISOString() : null,
            createdAt: now,
            updatedAt: now,
        });

        // Council Token 자동 발급 (운영자 = 제안 생성 자격)
        if (walletAddress) {
            try {
                await issueCouncilToken(walletAddress, 1);
            } catch (e: any) {
                console.error("[create-operator] Council Token 발급 실패:", e?.message ?? e);
                // Council Token 실패는 운영자 생성을 막지 않음
            }
        }

        return Response.json({ ok: true, userId, created: true });
    } catch (dbErr: any) {
        console.error("[create-operator] DB INSERT 실패:", dbErr);
        return Response.json({ error: "DB 오류: " + (dbErr?.message ?? "") }, { status: 500 });
    }
}
