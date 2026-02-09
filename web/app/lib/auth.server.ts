import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.server";
import * as schema from "../db/schema";
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
