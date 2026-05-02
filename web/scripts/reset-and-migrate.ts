import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as dotenv from "dotenv";
import * as path from "path";

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

    console.log("Connected to", url);

    // 1. Drop all tables
    console.log("Dropping all existing tables...");
    await client.execute("PRAGMA foreign_keys=OFF;");
    const tablesRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
    for (const row of tablesRes.rows) {
        const tableName = row.name as string;
        if (tableName !== "sqlite_sequence") {
            console.log(`Dropping table ${tableName}...`);
            await client.execute(`DROP TABLE IF EXISTS \`${tableName}\`;`);
        }
    }
    console.log("All tables dropped successfully.");

    // 2. Apply migrations sequentially
    const migrations = [
        "drizzle/0000_regular_hemingway.sql",
        "drizzle/0001_loose_cloak.sql"
    ];

    for (const migrationFile of migrations) {
        console.log(`\nApplying migration: ${migrationFile}`);
        const sql = fs.readFileSync(migrationFile, "utf-8");
        const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);

        for (const statement of statements) {
            console.log("Executing:", statement.substring(0, 50).replace(/\n/g, ' ') + "...");
            try {
                await client.execute(statement);
            } catch (err: any) {
                // In 0001 we added INSERT INTO user ... FROM users
                // But since we just dropped everything, `users` is empty or doesn't exist when trying to select from it
                // Wait! If `users` is created in 0000, then in 0001 it WILL exist! So the INSERT INTO user FROM users will just copy 0 rows, which is perfectly fine.
                console.error(`Error executing statement: ${statement.substring(0, 100)}`);
                throw err;
            }
        }
        console.log(`Migration ${migrationFile} applied successfully.`);
    }

    console.log("\nAll migrations applied successfully! Database is now clean and up-to-date.");
}

run().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
