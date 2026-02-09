import type { Config } from "drizzle-kit";

export default {
    schema: "./app/db/schema.ts",
    out: "./drizzle",
    dialect: "sqlite",
    dbCredentials: {
        url: process.env.TURSO_DATABASE_URL || "file:./local.db",
        token: process.env.TURSO_AUTH_TOKEN,
    },
} satisfies Config;
