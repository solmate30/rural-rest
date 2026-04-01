import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import bs58 from "bs58";
import IDL from "~/anchor-idl/rural_rest_rwa.json";

import { RPC_URL, SERVER_PROGRAM_ID, SERVER_USDC_MINT, CRANK_SECRET_KEY } from "~/lib/constants.server";

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

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

/**
 * funded 상태 매물을 crank_authority 키로 자동 releaseFunds + activateProperty.
 * CRANK_SECRET_KEY 미설정 시 silent skip → false 반환.
 * 성공 시 true, 실패 시 false.
 */
export async function tryAutoActivate(listingId: string): Promise<boolean> {
    if (!CRANK_SECRET_KEY) return false;
    if (!SERVER_USDC_MINT) {
        console.warn("[rwa.onchain] USDC_MINT 미설정 — tryAutoActivate 건너뜀");
        return false;
    }

    try {
        const connection = getConnection();
        const programId = new PublicKey(SERVER_PROGRAM_ID);

        // crank 키페어 로드
        const crank = Keypair.fromSecretKey(bs58.decode(CRANK_SECRET_KEY));

        // propertyToken 조회
        const [propertyTokenPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("property"), Buffer.from(listingId)],
            programId
        );
        const readProgram = getProgram();
        const ptData = await (readProgram.account as any).propertyToken.fetch(propertyTokenPda);

        if (!ptData.status?.funded) {
            console.warn(`[rwa.onchain] tryAutoActivate: ${listingId} 상태가 funded 아님 — skip`);
            return false;
        }

        const tokenMint = ptData.tokenMint as PublicKey;
        const authority = ptData.authority as PublicKey;
        const usdcMint = new PublicKey(SERVER_USDC_MINT);

        // rwaConfig PDA
        const [rwaConfig] = PublicKey.findProgramAddressSync(
            [Buffer.from("rwa_config")],
            programId
        );

        // crank이 rwaConfig에 등록돼 있는지 확인
        const rwaConfigData = await (readProgram.account as any).rwaConfig.fetch(rwaConfig);
        if (rwaConfigData.crankAuthority.toBase58() !== crank.publicKey.toBase58()) {
            console.warn("[rwa.onchain] CRANK_SECRET_KEY가 rwaConfig.crankAuthority와 불일치");
            return false;
        }

        // fundingVault PDA
        const [fundingVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("funding_vault"), Buffer.from(listingId)],
            programId
        );

        // authority USDC ATA (SPV에게 자금 전송)
        const authorityUsdcAccount = getAssociatedTokenAddressSync(
            usdcMint, authority, false, TOKEN_PROGRAM_ID
        );

        // crank provider
        const crankProvider = new AnchorProvider(
            connection,
            {
                publicKey: crank.publicKey,
                signTransaction: async (tx: any) => { tx.sign(crank); return tx; },
                signAllTransactions: async (txs: any[]) => { txs.forEach(t => t.sign(crank)); return txs; },
            } as any,
            { commitment: "confirmed" }
        );
        const crankProgram = new Program(IDL as any, crankProvider);

        // releaseFunds
        await (crankProgram.methods as any)
            .releaseFunds(listingId)
            .accounts({
                operator: crank.publicKey,
                propertyToken: propertyTokenPda,
                rwaConfig,
                fundingVault,
                authorityUsdcAccount,
                usdcMint,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        // activateProperty
        await (crankProgram.methods as any)
            .activateProperty(listingId)
            .accounts({
                operator: crank.publicKey,
                propertyToken: propertyTokenPda,
                rwaConfig,
                tokenMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .rpc();

        console.log(`[rwa.onchain] tryAutoActivate 성공: ${listingId}`);
        return true;
    } catch (err: any) {
        console.error("[rwa.onchain] tryAutoActivate 실패:", listingId, String(err?.message ?? err));
        return false;
    }
}
