/**
 * 클라이언트 컴포넌트용 Anchor 유틸리티.
 * dynamic import 사용 — 번들 사이즈 최적화.
 */
import type { Connection } from "@solana/web3.js";
import { PROGRAM_ID, USDC_MINT } from "~/lib/constants";
import type { PrivyAnchorWallet } from "~/lib/privy-wallet";

/**
 * Anchor Program 인스턴스 생성 (클라이언트 전용)
 */
export async function getProgram(connection: Connection, wallet: PrivyAnchorWallet) {
    const { Program, AnchorProvider } = await import("@coral-xyz/anchor");
    const { default: IDL } = await import("~/anchor-idl/rural_rest_rwa.json");

    const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
    // IDL에 address가 없을 수 있으므로 PROGRAM_ID로 주입
    const idl = { ...IDL, address: PROGRAM_ID };
    return new Program(idl as any, provider);
}

/**
 * 공통 PDA 파생
 */
export async function derivePdas(listingId: string, investor: { toBuffer: () => Uint8Array }): Promise<{ propertyToken: import("@solana/web3.js").PublicKey; fundingVault: import("@solana/web3.js").PublicKey; investorPosition: import("@solana/web3.js").PublicKey; programId: import("@solana/web3.js").PublicKey }>;
export async function derivePdas(listingId: string): Promise<{ propertyToken: import("@solana/web3.js").PublicKey; fundingVault: import("@solana/web3.js").PublicKey; investorPosition: null; programId: import("@solana/web3.js").PublicKey }>;
export async function derivePdas(listingId: string, investor?: { toBuffer: () => Uint8Array }) {
    const { PublicKey } = await import("@solana/web3.js");
    const programId = new PublicKey(PROGRAM_ID);

    const [propertyToken] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(listingId)],
        programId
    );
    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(listingId)],
        programId
    );

    let investorPosition: InstanceType<typeof PublicKey> | null = null;
    if (investor) {
        [investorPosition] = PublicKey.findProgramAddressSync(
            [Buffer.from("investor"), propertyToken.toBuffer(), investor.toBuffer()],
            programId
        );
    }

    return { propertyToken, fundingVault, investorPosition, programId };
}

/**
 * USDC Mint PublicKey
 */
export async function getUsdcMint() {
    const { PublicKey } = await import("@solana/web3.js");
    return new PublicKey(USDC_MINT);
}

/**
 * BookingEscrow PDA (seeds: ["booking_escrow", bookingId_no_dashes])
 * UUID 하이픈 제거 → 36 chars → 32 bytes (Solana 최대 seed 길이)
 */
export async function deriveBookingEscrowPda(bookingId: string) {
    const { PublicKey } = await import("@solana/web3.js");
    const programId = new PublicKey(PROGRAM_ID);
    const seedId = bookingId.replace(/-/g, ""); // 36 → 32 bytes
    const [pda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("booking_escrow"), Buffer.from(seedId)],
        programId
    );
    return { pda, bump };
}

/**
 * BookingEscrow USDC vault (ATA of booking_escrow PDA)
 */
export async function deriveBookingEscrowVault(escrowPda: import("@solana/web3.js").PublicKey, usdcMint: import("@solana/web3.js").PublicKey) {
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    return getAssociatedTokenAddressSync(usdcMint, escrowPda, true);
}

/**
 * RwaConfig PDA (seeds: ["rwa_config"])
 */
export async function deriveRwaConfigPda() {
    const { PublicKey } = await import("@solana/web3.js");
    const programId = new PublicKey(PROGRAM_ID);
    const [rwaConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from("rwa_config")],
        programId
    );
    return rwaConfig;
}

/**
 * 공통 Anchor 에러 메시지 파싱
 * componentErrors로 컴포넌트별 에러 메시지를 추가할 수 있음.
 */
const COMMON_ERRORS: Record<string, string> = {
    "User rejected": "지갑에서 거절되었습니다",
    "rejected": "지갑에서 거절되었습니다",
    "cancelled": "지갑에서 거절되었습니다",
    "canceled": "지갑에서 거절되었습니다",
    "AccountNotInitialized": "온체인 데이터가 없습니다. 네트워크 상태를 확인하세요.",
    "Account does not exist": "온체인 데이터가 없습니다. 네트워크 상태를 확인하세요.",
    "has no data": "온체인 데이터가 없습니다. 네트워크 상태를 확인하세요.",
    "InvalidStatus": "현재 상태에서 실행할 수 없습니다",
    "MathOverflow": "수량 계산 오류",
    "InsufficientTokenSupply": "잔여 토큰이 부족합니다",
    "ExceedsInvestorCap": "인당 구매 상한을 초과합니다",
    "ConstraintHasOne": "권한이 없습니다",
    "has_one": "권한이 없습니다",
    "0x1": "USDC 잔액이 부족합니다",
    "Attempt to debit an account but found no record of a prior credit": "USDC 잔액이 부족합니다. 지갑에 USDC를 충전하세요.",
    "no record of a prior credit": "USDC 잔액이 부족합니다. 지갑에 USDC를 충전하세요.",
    "StalePythPrice": "환율 데이터가 오래되었습니다. 잠시 후 다시 시도하세요.",
    "PythConfidenceTooWide": "현재 환율이 불안정합니다. 잠시 후 다시 시도하세요.",
    "InvalidPythPrice": "환율 오라클 오류. 잠시 후 다시 시도하세요.",
    "BookingNotPending": "이미 처리된 예약입니다",
    "CheckInNotPassed": "체크아웃 후 정산이 가능합니다",
    "VotingPeriodTooShort": "투표 마감일은 최소 1일 이후로 설정해야 합니다",
};

export function parseAnchorError(err: any, componentErrors?: Record<string, string>): string {
    const msg = err?.message ?? String(err) ?? "";
    const allErrors = { ...COMMON_ERRORS, ...componentErrors };

    for (const [key, value] of Object.entries(allErrors)) {
        if (msg.includes(key)) return value;
    }

    return msg.slice(0, 200) || "트랜잭션 실패";
}
