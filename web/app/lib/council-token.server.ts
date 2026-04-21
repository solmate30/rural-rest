import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { RPC_URL, COUNCIL_MINT, CRANK_SECRET_KEY } from "~/lib/constants.server";

export async function issueCouncilToken(walletAddress: string, amount = 1): Promise<string> {
    if (!CRANK_SECRET_KEY) throw new Error("CRANK_SECRET_KEY 미설정");
    if (!COUNCIL_MINT) throw new Error("COUNCIL_MINT 미설정");

    const connection = new Connection(RPC_URL, "confirmed");
    const payer = Keypair.fromSecretKey(bs58.decode(CRANK_SECRET_KEY));
    const mintPubkey = new PublicKey(COUNCIL_MINT);
    const recipientPubkey = new PublicKey(walletAddress);

    const recipientAta = getAssociatedTokenAddressSync(
        mintPubkey, recipientPubkey, false,
        TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const tx = new Transaction();

    const ataInfo = await connection.getAccountInfo(recipientAta);
    if (!ataInfo) {
        tx.add(createAssociatedTokenAccountInstruction(
            payer.publicKey, recipientAta, recipientPubkey, mintPubkey,
            TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ));
    }

    tx.add(createMintToInstruction(
        mintPubkey, recipientAta, payer.publicKey, BigInt(amount), [], TOKEN_2022_PROGRAM_ID,
    ));

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
}
