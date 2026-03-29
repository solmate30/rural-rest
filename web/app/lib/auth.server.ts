import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.server";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "react-router";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "sqlite",
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
        }
    }),
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
        kakao: {
            clientId: process.env.KAKAO_CLIENT_ID as string,
            clientSecret: process.env.KAKAO_CLIENT_SECRET as string,
        },
    },
    emailAndPassword: {
        enabled: true,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "guest",
            },
            preferredLang: {
                type: "string",
                defaultValue: "en",
            },
        }
    },
    basePath: "/auth",
});

/**
 * requireUser Helper
 * Ensures the user is authenticated and has the required role.
 */
export async function requireUser(request: Request, allowedRoles: string[] = ["guest", "host", "admin"]) {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
        throw redirect("/auth");
    }

    const user = session.user;
    // Note: Better Auth adds the custom fields to user.
    // We cast it if necessary, but here we expect role to exist based on configuration.
    if (!allowedRoles.includes((user as any).role)) {
        throw new Response("Forbidden", { status: 403 });
    }

    return user;
}

/**
 * getSession Helper
 * Simple wrapper to get the current session.
 */
export async function getSession(request: Request) {
    return await auth.api.getSession({ headers: request.headers });
}

/**
 * requireWallet Helper
 * 세션 인증 + 등록된 지갑 주소를 반환한다.
 * body의 walletAddress와 일치 검증은 호출 측에서 수행.
 */
export async function requireWallet(request: Request): Promise<{ userId: string; walletAddress: string }> {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        throw Response.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const [row] = await db
        .select({ walletAddress: schema.user.walletAddress })
        .from(schema.user)
        .where(eq(schema.user.id, session.user.id));

    if (!row?.walletAddress) {
        throw Response.json({ error: "지갑이 등록되지 않았습니다" }, { status: 403 });
    }

    return { userId: session.user.id, walletAddress: row.walletAddress };
}
