import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: typeof window !== "undefined" ? window.location.origin : (process.env.BETTER_AUTH_URL || "http://localhost:5173"),
    basePath: "/auth",
});

export const { signIn, signUp, signOut, useSession } = authClient;
