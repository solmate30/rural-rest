/**
 * RwaConfig treasury 설정 스크립트
 *
 * 실행:
 *   devnet:
 *     ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *     ANCHOR_WALLET=~/.config/solana/id.json \
 *     npx ts-node scripts/set-treasury.ts
 *
 *   localnet:
 *     ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 \
 *     ANCHOR_WALLET=~/.config/solana/id.json \
 *     npx ts-node scripts/set-treasury.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { RuralRestRwa } from "../target/types/rural_rest_rwa";

const TREASURY_PUBKEY = new PublicKey("9uAQniNkxo4zvxLVgrardFUnJdrafMod76GJiNG5T3Zc");

async function main() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.RuralRestRwa as Program<RuralRestRwa>;

    const [rwaConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("rwa_config")],
        program.programId
    );

    console.log("RWA Program ID :", program.programId.toBase58());
    console.log("RwaConfig PDA  :", rwaConfigPda.toBase58());
    console.log("Authority      :", provider.wallet.publicKey.toBase58());
    console.log("Treasury       :", TREASURY_PUBKEY.toBase58());

    // 현재 상태 확인
    const before = await (program.account as any).rwaConfig.fetch(rwaConfigPda);
    console.log("\n[Before] treasury:", before.treasury.toBase58());

    const tx = await program.methods
        .setTreasury(TREASURY_PUBKEY)
        .accounts({
            rwaConfig: rwaConfigPda,
            authority: provider.wallet.publicKey,
        })
        .rpc();

    console.log("\nTx signature:", tx);

    const after = await (program.account as any).rwaConfig.fetch(rwaConfigPda);
    console.log("[After]  treasury:", after.treasury.toBase58());
    console.log("\nDone.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
