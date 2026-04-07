process.env.TURSO_DATABASE_URL = "file:./local.db";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

const RECIPIENT = process.argv[2];
if (!RECIPIENT) { console.error("사용법: npx tsx scripts/mint-council.ts <지갑주소>"); process.exit(1); }

const conn = new Connection("http://127.0.0.1:8899", "confirmed");
const crank = Keypair.fromSecretKey(bs58.decode(process.env.CRANK_SECRET_KEY!));
const councilMint = new PublicKey(process.env.VITE_COUNCIL_MINT!);
const recipient = new PublicKey(RECIPIENT);

console.log("Council Mint:", councilMint.toBase58());
console.log("Crank:       ", crank.publicKey.toBase58());
console.log("Recipient:   ", recipient.toBase58());

const ata = await getOrCreateAssociatedTokenAccount(
    conn, crank, councilMint, recipient, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID
);
await mintTo(conn, crank, councilMint, ata.address, crank, 1n, [], undefined, TOKEN_2022_PROGRAM_ID);
console.log("완료! Council Token 1개 → ATA:", ata.address.toBase58());
