import type { Config } from "drizzle-kit";
import fs from "fs";

// drizzle-kit은 .env 자동 로드 안 하므로 수동 파싱
if (fs.existsSync(".env")) {
    for (const line of fs.readFileSync(".env", "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
}

const url = process.env.TURSO_DATABASE_URL || "file:./local.db";
const isLocal = url.startsWith("file:");

export default {
    schema: "./app/db/schema.ts",
    out: "./drizzle",
    dialect: isLocal ? "sqlite" : "turso",
    dbCredentials: isLocal
        ? { url }
        : { url, authToken: process.env.TURSO_AUTH_TOKEN },
} satisfies Config;
