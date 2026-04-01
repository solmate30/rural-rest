import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";

// GET /api/user/wallet-nonce
// 지갑 연결 서명 챌린지용 nonce 발급
export async function loader({ request }: { request: Request }) {
    const session = await requireUser(request);

    const url = new URL(request.url);
    const lang = url.searchParams.get("lang");
    const uuid = crypto.randomUUID();
    const issuedAt = new Date().toISOString();

    const nonce = lang === "ko"
        ? `Rural Rest에서 솔라나 지갑 연결을 요청합니다.\n\n서명을 통해 지갑 소유권을 확인합니다.\nNonce: ${uuid}\nIssued At: ${issuedAt}`
        : `Rural Rest wants you to sign in with your Solana account.\n\nBy signing, you confirm wallet ownership.\nNonce: ${uuid}\nIssued At: ${issuedAt}`;

    await db
        .update(user)
        .set({ walletNonce: nonce })
        .where(eq(user.id, session.id));

    return Response.json({ nonce });
}
