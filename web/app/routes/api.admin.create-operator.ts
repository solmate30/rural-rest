/**
 * api.admin.create-operator.ts
 *
 * POST — 마을운영자 계정 생성
 *
 * 1) Privy importUser로 이메일 계정 생성 (+ Solana 임베디드 지갑 발급)
 * 2) DB user INSERT (role: "operator")
 *
 * 이미 동일 이메일로 Privy 계정이 존재하면 에러 반환 (Privy 중복 방지).
 * 이미 DB에 존재하는 경우 role을 operator로 업데이트.
 */

import { privyClient } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/api.admin.create-operator";

export async function action({ request }: Route.ActionArgs) {
    await requireUser(request, ["admin"]);

    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    let email: string;
    let name: string;
    try {
        const body = await request.json();
        email = String(body.email ?? "").trim().toLowerCase();
        name = String(body.name ?? "").trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("유효한 이메일을 입력해주세요");
        }
        if (!name) throw new Error("이름을 입력해주세요");
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 });
    }

    // Privy importUser — 이메일 계정 생성 + Solana 임베디드 지갑 발급
    let privyUser: Awaited<ReturnType<typeof privyClient.importUser>>;
    try {
        privyUser = await privyClient.importUser({
            linkedAccounts: [{ type: "email", address: email }],
            createSolanaWallet: true,
        });
    } catch (e: any) {
        const msg = e?.message ?? "";
        if (msg.includes("already exists") || msg.includes("duplicate")) {
            return Response.json(
                { error: "이미 Privy에 등록된 이메일입니다. 해당 계정의 role을 직접 변경해주세요." },
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

    // DB upsert
    const [existing] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.privyDid, privyDid));

    if (existing) {
        // 이미 DB에 있으면 role만 operator로 올림
        await db
            .update(userTable)
            .set({ role: "operator", name, updatedAt: new Date() })
            .where(eq(userTable.privyDid, privyDid));
        return Response.json({ ok: true, userId: existing.id, created: false });
    }

    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(userTable).values({
        id,
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

    return Response.json({ ok: true, userId: id, created: true });
}
