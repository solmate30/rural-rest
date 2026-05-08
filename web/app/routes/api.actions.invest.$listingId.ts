/**
 * Solana Blinks — RWA 투자 참여
 *
 * GET  /api/actions/invest/:listingId  → Action 메타데이터
 * POST /api/actions/invest/:listingId  → 미서명 purchase_tokens 트랜잭션
 *
 * Blinks spec: https://docs.dialect.to/documentation/actions/specification
 */
import {
    Connection,
    PublicKey,
    Transaction,
    Keypair,
} from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import { db } from "~/db/index.server";
import { listings, rwaTokens, user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import { RPC_URL, SERVER_PROGRAM_ID, SERVER_USDC_MINT } from "~/lib/constants.server";
import IDL from "~/anchor-idl/rural_rest_rwa.json";
import type { Route } from "./+types/api.actions.invest.$listingId";
const PROGRAM_ID = SERVER_PROGRAM_ID;
const USDC_MINT_ADDR = SERVER_USDC_MINT;

function auditLog(event: Record<string, unknown>) {
    console.log("[AUDIT]", JSON.stringify({ ...event, ts: new Date().toISOString() }));
}

// Blinks 필수 CORS 헤더
const BLINKS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids",
    "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
    "X-Action-Version": "2.4",
    "X-Blockchain-Ids": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // devnet
};

async function getListingWithToken(param: string) {
    // param은 nodeNumber(숫자) 또는 UUID — 양쪽 지원
    const isNumeric = /^\d+$/.test(param);
    const rows = await db
        .select({
            id: listings.id,
            title: listings.title,
            location: listings.location,
            images: listings.images,
            valuationKrw: listings.valuationKrw,
            tokenId: rwaTokens.id,
            tokenMint: rwaTokens.tokenMint,
            pricePerTokenUsdc: rwaTokens.pricePerTokenUsdc,
            totalSupply: rwaTokens.totalSupply,
            tokensSold: rwaTokens.tokensSold,
            status: rwaTokens.status,
        })
        .from(listings)
        .innerJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
        .where(isNumeric ? eq(listings.nodeNumber, Number(param)) : eq(listings.id, param));

    return rows[0] ?? null;
}

function isKo(request: Request) {
    const lang = new URL(request.url).searchParams.get("lang");
    if (lang === "en") return false;
    if (lang === "ko") return true;
    return (request.headers.get("Accept-Language") ?? "").toLowerCase().startsWith("ko");
}

// OPTIONS preflight
export async function loader({ params, request }: Route.LoaderArgs) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: BLINKS_HEADERS });
    }

    const token = await getListingWithToken(params.listingId);
    if (!token) {
        const msg = isKo(request) ? "매물을 찾을 수 없습니다" : "Property not found";
        return Response.json({ message: msg }, { status: 404, headers: BLINKS_HEADERS });
    }

    const ko = isKo(request);
    const reqUrl = new URL(request.url);
    const proto = request.headers.get("x-forwarded-proto") ?? reqUrl.protocol.replace(":", "");
    const origin = `${proto}://${reqUrl.host}`;

    const imgs = token.images as string[];
    const iconPath = imgs?.[0] ?? "/ruralrest-logo.png";
    const icon = iconPath.startsWith("http") ? iconPath : `${origin}${iconPath}`;
    const available = (token.totalSupply ?? 0) - (token.tokensSold ?? 0);
    const pricePerTokenMicro = token.pricePerTokenUsdc ?? 0;
    const priceUsdc = (pricePerTokenMicro / 1_000_000).toFixed(6);

    // USDC 금액 → 토큰 수 변환 (소수점 가격이라 큰 토큰 수량 필요)
    function usdcToTokens(usd: number): number {
        if (pricePerTokenMicro <= 0) return 0;
        return Math.round((usd * 1_000_000) / pricePerTokenMicro);
    }
    const presetUsd = [50, 250, 1000];
    const presets = presetUsd
        .map(usd => ({ usd, tokens: usdcToTokens(usd) }))
        .filter(p => p.tokens > 0 && p.tokens <= available);

    return Response.json(
        {
            type: "action",
            title: token.title,
            icon,
            description: ko
                ? `${token.location} · 토큰 단가 $${priceUsdc} USDC · 잔여 ${available.toLocaleString()}개`
                : `${token.location} · Unit price $${priceUsdc} USDC · ${available.toLocaleString()} remaining`,
            label: ko ? "투자하기" : "Invest",
            links: {
                actions: [
                    ...presets.map(p => ({
                        type: "transaction" as const,
                        label: ko ? `$${p.usd} 투자` : `Invest $${p.usd}`,
                        href: `${origin}/api/actions/invest/${params.listingId}?tokens=${p.tokens}`,
                    })),
                    {
                        type: "transaction",
                        label: ko ? "직접 입력" : "Custom amount",
                        href: `${origin}/api/actions/invest/${params.listingId}?tokens={tokens}`,
                        parameters: [
                            {
                                name: "tokens",
                                type: "number",
                                label: ko ? "구매할 토큰 수량" : "Number of tokens to buy",
                                required: true,
                                min: 1,
                            },
                        ],
                    },
                ],
            },
        },
        { headers: BLINKS_HEADERS }
    );
}

// POST — 미서명 트랜잭션 반환
export async function action({ params, request }: Route.ActionArgs) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: BLINKS_HEADERS });
    }

    const ko = isKo(request);

    const url = new URL(request.url);
    const tokenAmount = Number(url.searchParams.get("tokens") ?? "1");
    if (!tokenAmount || tokenAmount < 1 || tokenAmount > 100_000) {
        return Response.json(
            { message: ko ? "유효하지 않은 토큰 수량입니다" : "Invalid token amount" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }

    const { account } = (await request.json()) as { account: string };
    if (!account) {
        return Response.json({ message: "account field is required" }, { status: 400, headers: BLINKS_HEADERS });
    }

    // KYC 인증된 등록 사용자만 투자 가능
    const [investor] = await db
        .select({ id: userTable.id, kycVerified: userTable.kycVerified })
        .from(userTable)
        .where(eq(userTable.walletAddress, account));

    if (!investor) {
        auditLog({ action: "blinks_invest_rejected", reason: "unregistered", wallet: account, listingId: params.listingId, tokens: tokenAmount });
        return Response.json(
            { message: ko ? "rural-rest.com에 회원가입 후 지갑을 연결해주세요." : "Please sign up at rural-rest.com and connect your wallet." },
            { status: 403, headers: BLINKS_HEADERS }
        );
    }
    if (!investor.kycVerified) {
        auditLog({ action: "blinks_invest_rejected", reason: "kyc_required", userId: investor.id, wallet: account, listingId: params.listingId, tokens: tokenAmount });
        return Response.json(
            { message: ko ? "KYC 인증이 필요합니다. rural-rest.com에서 인증 후 투자하세요." : "KYC verification required. Please verify at rural-rest.com before investing." },
            { status: 403, headers: BLINKS_HEADERS }
        );
    }

    const token = await getListingWithToken(params.listingId);
    if (!token?.tokenMint) {
        return Response.json(
            { message: ko ? "매물 또는 토큰 정보를 찾을 수 없습니다" : "Property or token info not found" },
            { status: 404, headers: BLINKS_HEADERS }
        );
    }

    try {
        const connection = new Connection(RPC_URL, "confirmed");
        const userPubkey = new PublicKey(account);
        const programId = new PublicKey(PROGRAM_ID);
        const usdcMint = new PublicKey(USDC_MINT_ADDR);
        const tokenMintPubkey = new PublicKey(token.tokenMint);

        // PDA seed: UUID 하이픈 제거 (36 → 32 bytes)
        // params.listingId가 nodeNumber(3001)일 수도 있으므로 token.id(UUID)를 사용
        const seedId = token.id.replace(/-/g, "");

        // PDA 계산
        const [propertyToken] = PublicKey.findProgramAddressSync(
            [Buffer.from("property"), Buffer.from(seedId)],
            programId
        );
        const [fundingVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("funding_vault"), Buffer.from(seedId)],
            programId
        );
        const [investorPosition] = PublicKey.findProgramAddressSync(
            [Buffer.from("investor"), propertyToken.toBuffer(), userPubkey.toBuffer()],
            programId
        );

        // ATA 계산
        const investorUsdcAccount = getAssociatedTokenAddressSync(
            usdcMint, userPubkey, false, TOKEN_PROGRAM_ID
        );
        const investorRwaAccount = getAssociatedTokenAddressSync(
            tokenMintPubkey, userPubkey, false, TOKEN_2022_PROGRAM_ID
        );

        // Anchor 프로그램 (더미 지갑 — 트랜잭션 빌드용)
        const dummyWallet = new Wallet(Keypair.generate());
        const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        const program = new Program(IDL as any, provider);

        const preIxs = [
            // USDC ATA (idempotent)
            createAssociatedTokenAccountIdempotentInstruction(
                userPubkey, investorUsdcAccount, userPubkey, usdcMint, TOKEN_PROGRAM_ID
            ),
            // RWA ATA (idempotent)
            createAssociatedTokenAccountIdempotentInstruction(
                userPubkey, investorRwaAccount, userPubkey, tokenMintPubkey, TOKEN_2022_PROGRAM_ID
            ),
        ];

        // investor_position이 없으면 open_position 추가
        const positionInfo = await connection.getAccountInfo(investorPosition);
        if (!positionInfo) {
            preIxs.push(
                await (program.methods as any)
                    .openPosition(seedId)
                    .accounts({ investor: userPubkey, propertyToken, investorPosition })
                    .instruction()
            );
        }

        // purchase_tokens 트랜잭션 빌드 (미서명)
        const tx: Transaction = await (program.methods as any)
            .purchaseTokens(seedId, new BN(tokenAmount))
            .accounts({
                investor: userPubkey,
                propertyToken,
                tokenMint: tokenMintPubkey,
                investorPosition,
                investorUsdcAccount,
                fundingVault,
                investorRwaAccount,
                usdcMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
            })
            .preInstructions(preIxs)
            .transaction();

        tx.feePayer = userPubkey;
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        const serialized = tx.serialize({ requireAllSignatures: false });
        const base64Tx = Buffer.from(serialized).toString("base64");

        const priceUsdc = ((token.pricePerTokenUsdc ?? 0) / 1_000_000 * tokenAmount).toFixed(2);

        auditLog({
            action: "blinks_invest_tx_built",
            userId: investor.id,
            wallet: account,
            listingId: params.listingId,
            tokens: tokenAmount,
            amountUsdc: priceUsdc,
        });

        const successMsg = ko
            ? `${tokenAmount} RRT 토큰 구매 ($${priceUsdc} USDC)`
            : `Buy ${tokenAmount} RRT token${tokenAmount > 1 ? "s" : ""} ($${priceUsdc} USDC)`;

        return Response.json(
            { type: "transaction", transaction: base64Tx, message: successMsg },
            { headers: BLINKS_HEADERS }
        );
    } catch (err: any) {
        auditLog({ action: "blinks_invest_error", userId: investor.id, wallet: account, listingId: params.listingId, error: err?.message });
        console.error("[blinks/invest]", err?.message);
        return Response.json(
            { message: err?.message ?? "Failed to build transaction" },
            { status: 500, headers: BLINKS_HEADERS }
        );
    }
}
