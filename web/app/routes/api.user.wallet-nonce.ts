import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";

// GET /api/user/wallet-nonce
// 지갑 연결 서명 챌린지용 nonce 발급
export async function loader({ request }: { request: Request }) {
    const session = await requireUser(request);

    const nonce = `Rural Rest wants you to sign in with your Solana account.\n\nBy signing, you confirm wallet ownership.\nNonce: ${crypto.randomUUID()}\nIssued At: ${new Date().toISOString()}`;

    await db
        .update(user)
        .set({ walletNonce: nonce })
        .where(eq(user.id, session.id));

    return Response.json({ nonce });
}
