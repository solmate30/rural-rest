import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import IDL from "~/anchor-idl/rural_rest_rwa.json";

import { RPC_URL, SERVER_PROGRAM_ID } from "~/lib/constants.server";

// Singleton connection — one per server process
let _connection: Connection | null = null;
function getConnection() {
    if (!_connection) _connection = new Connection(RPC_URL, "confirmed");
    return _connection;
}

// Read-only dummy wallet: AnchorProvider requires a Wallet interface,
// but read operations (account.fetch) never call signTransaction.
const dummyWallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
};

function getProgram() {
    const provider = new AnchorProvider(getConnection(), dummyWallet as any, {
        commitment: "confirmed",
    });
    return new Program(IDL as any, provider);
}

export type OnchainPropertyStatus = "funding" | "funded" | "active" | "failed";

export interface OnchainProperty {
    status: OnchainPropertyStatus;
    tokensSold: number;
}

function parseStatus(raw: any): OnchainPropertyStatus {
    // Anchor program.account.fetch() returns enum variants as { variantName: {} }
    if (raw?.funded !== undefined) return "funded";
    if (raw?.active !== undefined) return "active";
    if (raw?.failed !== undefined) return "failed";
    return "funding";
}

export async function fetchPropertyOnchain(listingId: string): Promise<OnchainProperty | null> {
    try {
        const program = getProgram();
        const programId = new PublicKey(SERVER_PROGRAM_ID);

        const [propertyToken] = PublicKey.findProgramAddressSync(
            [Buffer.from("property"), Buffer.from(listingId)],
            programId
        );

        const data = await (program.account as any).propertyToken.fetch(propertyToken);

        return {
            status: parseStatus(data.status),
            tokensSold: Number(data.tokensSold), // BN → number
        };
    } catch (err: any) {
        const msg = String(err?.message ?? "");
        if (
            msg.includes("Account does not exist") ||
            msg.includes("has no data") ||
            msg.includes("ECONNREFUSED")
        ) {
            return null; // PDA not initialized or localnet not running → fall back to DB
        }
        console.error("[rwa.onchain] fetchPropertyOnchain failed:", listingId, msg);
        return null;
    }
}

export async function fetchPropertiesOnchain(
    listingIds: string[]
): Promise<Map<string, OnchainProperty | null>> {
    const entries = await Promise.all(
        listingIds.map(async (id) => [id, await fetchPropertyOnchain(id)] as const)
    );
    return new Map(entries);
}
