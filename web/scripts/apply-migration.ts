import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        throw new Error("TURSO_DATABASE_URL is not set");
    }

    const client = createClient({
        url,
        authToken,
    });

    console.log("Applying migration 0001_loose_cloak.sql to", url);
    const sql = fs.readFileSync("drizzle/0001_loose_cloak.sql", "utf-8");
    const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);

    for (const statement of statements) {
        console.log("Executing:", statement.substring(0, 50).replace(/\n/g, ' ') + "...");
        await client.execute(statement);
    }

    console.log("Migration applied successfully!");
}

run().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
