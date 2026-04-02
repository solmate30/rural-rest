import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

const NONCE_TTL_MS = 5 * 60 * 1000; // 5분

// POST /api/user/connect-wallet
// Body: { walletAddress: string, signature: number[], nonce: string }
export async function action({ request }: { request: Request }) {
    const session = await requireUser(request);

    const { walletAddress, signature, nonce } = await request.json() as {
        walletAddress: string;
        signature: number[];
        nonce: string;
    };

    if (!walletAddress || !signature || !nonce) {
        return Response.json({ error: "walletAddress, signature, nonce 필수" }, { status: 400 });
    }

    // DB에 저장된 nonce와 일치하는지 + 만료 여부 확인
    const [dbUser] = await db
        .select({ walletNonce: user.walletNonce, walletNonceIssuedAt: user.walletNonceIssuedAt })
        .from(user)
        .where(eq(user.id, session.id));

    if (!dbUser?.walletNonce || dbUser.walletNonce !== nonce) {
        return Response.json({ error: "nonce 불일치 또는 만료" }, { status: 400 });
    }

    // nonce 발급 시각 검증 (5분 TTL)
    if (dbUser.walletNonceIssuedAt) {
        const issuedAt = new Date(dbUser.walletNonceIssuedAt).getTime();
        if (Date.now() - issuedAt > NONCE_TTL_MS) {
            // 만료된 nonce 즉시 무효화
            await db.update(user)
                .set({ walletNonce: null, walletNonceIssuedAt: null })
                .where(eq(user.id, session.id));
            return Response.json({ error: "nonce가 만료되었습니다. 다시 시도해주세요." }, { status: 400 });
        }
    }

    // 서명 검증: 이 서명이 해당 지갑의 개인키로 서명된 것인지 확인
    const messageBytes = new TextEncoder().encode(nonce);
    const signatureBytes = new Uint8Array(signature);
    const publicKeyBytes = new PublicKey(walletAddress).toBytes();

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!isValid) {
        return Response.json({ error: "서명 검증 실패" }, { status: 401 });
    }

    // 검증 성공 → 저장, nonce 즉시 무효화 (재사용 방지)
    await db
        .update(user)
        .set({
            walletAddress,
            walletConnectedAt: new Date().toISOString(),
            walletNonce: null,
            walletNonceIssuedAt: null,
        })
        .where(eq(user.id, session.id));

    return Response.json({ ok: true });
}
