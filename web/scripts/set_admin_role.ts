import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
}

const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const email = "admin@rural-rest.dev";
await db.execute({ sql: "UPDATE user SET role='admin', name='admin', kyc_verified=1 WHERE email=?", args: [email] });
const r = await db.execute({ sql: "SELECT id, email, role, kyc_verified FROM user WHERE email=?", args: [email] });
console.table(r.rows);
console.log("완료.");
