import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";

// GET /api/user/kyc-status
export async function loader({ request }: { request: Request }) {
    const session = await requireUser(request);

    const [row] = await db
        .select({ kycVerified: user.kycVerified, walletAddress: user.walletAddress })
        .from(user)
        .where(eq(user.id, session.id));

    return Response.json({
        kycVerified: row?.kycVerified ?? false,
        walletAddress: row?.walletAddress ?? null,
    });
}
