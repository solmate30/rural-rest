/**
 * 01_generate_keypairs.ts  —  [STEP 1]
 *
 * ┌─ 로컬넷 테스트 전체 순서 ─────────────────────────────────────────────────────┐
 * │  STEP 0. npx tsx scripts/00_seed_listing.ts --listing-id <id>              │
 * │          DB에 매물(user + listings + rwa_tokens) 레코드 생성 (최초 1회)       │
 * │                                                                             │
 * │  STEP 1. npx tsx scripts/01_generate_keypairs.ts                           │
 * │          테스트에 필요한 키페어 파일 생성 (최초 1회)                            │
 * │                                                                             │
 * │  STEP 2. npx tsx scripts/02_setup_localnet.ts --setup                      │
 * │          테스트 USDC 민트 생성 + SPV 지갑에 잔액 충전                          │
 * │                                                                             │
 * │  STEP 3. npx tsx scripts/03_tokenize_property.ts --listing-id <id>         │
 * │          SPV 키페어로 매물 온체인 토크나이즈                                    │
 * │                                                                             │
 * │  STEP 4. npx tsx scripts/04_invest.ts --listing-id <id> --count 5          │
 * │          투자자 N명 자동 생성 + RWA 토큰 구매 + DB 기록                        │
 * │                                                                             │
 * │  STEP 5. npx tsx scripts/05_release_funds.ts --listing-id <id>             │
 * │          완판 or 데드라인 경과 후 SPV가 에스크로 자금 수령                      │
 * │                                                                             │
 * │  STEP 6. npx tsx scripts/06_activate_property.ts --listing-id <id>         │
 * │          매물 활성화 (mint authority 소각, 배당 분배 가능 상태로 전환)           │
 * │                                                                             │
 * │  STEP 7. npx tsx scripts/07_distribute_revenue.ts --listing-id <id>        │
 * │                                      --revenue-usdc 333                    │
 * │          월 영업이익 3자 분배 (지자체 40% + 운영자 30% + 투자자 30%)           │
 * │                                                                             │
 * │  STEP 8. npx tsx scripts/08_claim_dividend.ts --listing-id <id>            │
 * │                                   --investor-index 0                       │
 * │          투자자가 누적 배당금 수령                                              │
 * │                                                                             │
 * │  언제든: npx tsx scripts/99_check_state.ts --listing-id <id>               │
 * │          온체인 상태 + 투자자 포지션 전체 조회                                  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * 생성되는 파일:
 *   scripts/test-payer.json      트랜잭션 수수료 지불 + 테스트 USDC 민팅 권한
 *   scripts/test-usdc-mint.json  테스트용 가짜 USDC 민트 키페어
 *   scripts/spv-wallet.json      SPV authority 키페어 (토크나이즈 + 수익 분배 주체)
 *
 * 이미 파일이 존재하면 덮어쓰지 않습니다.
 */

import { Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KEYPAIRS = [
    { file: "test-payer.json",              label: "test-payer             (트랜잭션 수수료 + USDC 민팅 권한)" },
    { file: "test-usdc-mint.json",          label: "test-usdc-mint         (테스트 USDC 민트 keypair)" },
    { file: "spv-wallet.json",              label: "spv-wallet             (SPV authority — 토크나이즈 + 수익 분배)" },
    { file: "government-wallet.json",       label: "government-wallet      (지자체 — 영업이익 40% 수령)" },
    { file: "village-operator-wallet.json", label: "village-operator-wallet (마을운영자 — 영업이익 30% 수령)" },
];

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  [STEP 1] 키페어 생성");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

for (const { file, label } of KEYPAIRS) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        const kp = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf8")))
        );
        console.log(`  [재사용] ${label}`);
        console.log(`           pubkey: ${kp.publicKey.toBase58()}\n`);
    } else {
        const kp = Keypair.generate();
        fs.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)));
        console.log(`  [신규생성] ${label}`);
        console.log(`             pubkey: ${kp.publicKey.toBase58()}`);
        console.log(`             파일: scripts/${file}\n`);
    }
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  완료! 다음 단계:");
console.log("  npx tsx scripts/02_setup_localnet.ts --setup");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
