/**
 * POST /api/dev/faucet
 * Body: { walletAddress, sol?: number, usdc?: number }
 *
 * 로컬넷 전용 개발 faucet.
 * - SOL: connection.requestAirdrop
 * - USDC: authority(id.json) keypair로 mintTo
 *
 * RPC가 localhost를 가리킬 때만 동작. production에서는 403.
 */

import {
    Connection,
    PublicKey,
    Keypair,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { RPC_URL, SERVER_USDC_MINT } from "~/lib/constants.server";

const KEYPAIR_PATH = path.join(process.env.HOME ?? "~", ".config/solana/id.json");

function loadAdminKeypair(): Keypair | null {
    try {
        const raw = fs.readFileSync(KEYPAIR_PATH, "utf-8");
        return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    } catch {
        return null;
    }
}

export async function action({ request }: { request: Request }) {
    // localnet 전용 guard
    const isLocal = RPC_URL.includes("127.0.0.1") || RPC_URL.includes("localhost");
    if (!isLocal) {
        return Response.json({ error: "faucet은 localnet 전용입니다." }, { status: 403 });
    }

    const { walletAddress, sol = 2, usdc = 10_000 } = (await request.json()) as {
        walletAddress: string;
        sol?: number;
        usdc?: number;
    };

    if (!walletAddress) {
        return Response.json({ error: "walletAddress 필요" }, { status: 400 });
    }

    let wallet: PublicKey;
    try {
        wallet = new PublicKey(walletAddress);
    } catch {
        return Response.json({ error: "유효하지 않은 지갑 주소" }, { status: 400 });
    }

    if (!SERVER_USDC_MINT) {
        return Response.json({ error: "VITE_USDC_MINT 미설정 — setup-localnet.ts 먼저 실행하세요." }, { status: 500 });
    }

    const authority = loadAdminKeypair();
    if (!authority) {
        return Response.json({ error: `admin keypair 없음: ${KEYPAIR_PATH}` }, { status: 500 });
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const results: { sol?: string; usdc?: string } = {};

    // SOL airdrop
    if (sol > 0) {
        const sig = await connection.requestAirdrop(wallet, sol * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
        results.sol = sig;
    }

    // USDC mint
    if (usdc > 0) {
        const usdcMint = new PublicKey(SERVER_USDC_MINT);
        const ata = await getOrCreateAssociatedTokenAccount(
            connection,
            authority,
            usdcMint,
            wallet,
            false,
            "confirmed",
            undefined,
            TOKEN_PROGRAM_ID,
        );
        const sig = await mintTo(
            connection,
            authority,
            usdcMint,
            ata.address,
            authority,
            BigInt(usdc) * 1_000_000n,
            [],
            undefined,
            TOKEN_PROGRAM_ID,
        );
        results.usdc = sig;
    }

    console.info(`[dev/faucet] ${walletAddress.slice(0, 8)}... → ${sol} SOL + ${usdc} USDC`);
    return Response.json({ ok: true, ...results });
}
