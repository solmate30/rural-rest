import { requireUser } from "~/lib/auth.server";
import { RPC_URL, COUNCIL_MINT, CRANK_SECRET_KEY } from "~/lib/constants.server";
import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
} from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";

/**
 * POST /api/admin/issue-council-token
 * Body: { walletAddress, amount? }
 *
 * Council Token을 지정된 지갑에 발급 (admin 전용).
 * 서버 keypair(CRANK_SECRET_KEY)가 mint authority여야 함.
 */
export async function action({ request }: { request: Request }) {
    const user = await requireUser(request, ["admin"]);

    const { walletAddress, amount = 1 } = (await request.json()) as {
        walletAddress: string;
        amount?: number;
    };

    if (!walletAddress) {
        return Response.json({ error: "walletAddress 필요" }, { status: 400 });
    }
    if (!CRANK_SECRET_KEY) {
        return Response.json({ error: "서버 키 미설정 (CRANK_SECRET_KEY)" }, { status: 500 });
    }

    let recipientPubkey: PublicKey;
    try {
        recipientPubkey = new PublicKey(walletAddress);
    } catch {
        return Response.json({ error: "유효하지 않은 지갑 주소" }, { status: 400 });
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const payer = Keypair.fromSecretKey(bs58.decode(CRANK_SECRET_KEY));
    const mintPubkey = new PublicKey(COUNCIL_MINT);

    const recipientAta = getAssociatedTokenAddressSync(
        mintPubkey,
        recipientPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const tx = new Transaction();

    // ATA가 없으면 생성
    const ataInfo = await connection.getAccountInfo(recipientAta);
    if (!ataInfo) {
        tx.add(
            createAssociatedTokenAccountInstruction(
                payer.publicKey,
                recipientAta,
                recipientPubkey,
                mintPubkey,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
            )
        );
    }

    // mint_to: amount × 10^9 (decimals=9)
    const mintAmount = BigInt(amount) * BigInt(1_000_000_000);
    tx.add(
        createMintToInstruction(
            mintPubkey,
            recipientAta,
            payer.publicKey,
            mintAmount,
            [],
            TOKEN_PROGRAM_ID,
        )
    );

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    console.info(`[council-token] issued ${amount} to ${walletAddress} | tx: ${sig}`);
    return Response.json({ ok: true, signature: sig, recipient: walletAddress, amount });
}
