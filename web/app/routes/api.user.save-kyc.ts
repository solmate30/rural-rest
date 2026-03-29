import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";

export async function action({ request }: { request: Request }) {
    const session = await requireUser(request);

    await db
        .update(user)
        .set({
            kycVerified: true,
            kycVerifiedAt: new Date().toISOString(),
        })
        .where(eq(user.id, session.id));

    return Response.json({ ok: true });
}
