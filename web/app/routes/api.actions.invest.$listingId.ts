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

// Blinks 필수 CORS 헤더
const BLINKS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept-Encoding",
    "X-Action-Version": "2.1.3",
    "X-Blockchain-Ids": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // devnet
};

async function getListingWithToken(listingId: string) {
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
        .where(eq(listings.id, listingId));

    return rows[0] ?? null;
}

// OPTIONS preflight
export async function loader({ params, request }: Route.LoaderArgs) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: BLINKS_HEADERS });
    }

    const token = await getListingWithToken(params.listingId);
    if (!token) {
        return Response.json({ message: "매물을 찾을 수 없습니다" }, { status: 404, headers: BLINKS_HEADERS });
    }

    const imgs = token.images as string[];
    const icon = imgs?.[0] ?? "https://rural-rest.vercel.app/logo.png";
    const available = (token.totalSupply ?? 0) - (token.tokensSold ?? 0);
    const priceUsdc = ((token.pricePerTokenUsdc ?? 0) / 1_000_000).toFixed(2);

    return Response.json(
        {
            title: token.title,
            icon,
            description: `${token.location} · 토큰 가격 $${priceUsdc} USDC · 잔여 ${available.toLocaleString()}개`,
            label: "투자하기",
            links: {
                actions: [
                    {
                        label: "1 토큰 구매",
                        href: `/api/actions/invest/${params.listingId}?tokens=1`,
                    },
                    {
                        label: "5 토큰 구매",
                        href: `/api/actions/invest/${params.listingId}?tokens=5`,
                    },
                    {
                        label: "10 토큰 구매",
                        href: `/api/actions/invest/${params.listingId}?tokens=10`,
                    },
                    {
                        label: "직접 입력",
                        href: `/api/actions/invest/${params.listingId}?tokens={tokens}`,
                        parameters: [
                            {
                                name: "tokens",
                                label: "구매할 토큰 수량",
                                required: true,
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

    const url = new URL(request.url);
    const tokenAmount = Number(url.searchParams.get("tokens") ?? "1");
    if (!tokenAmount || tokenAmount < 1 || tokenAmount > 100_000) {
        return Response.json({ message: "유효하지 않은 토큰 수량입니다" }, { status: 400, headers: BLINKS_HEADERS });
    }

    const { account } = (await request.json()) as { account: string };
    if (!account) {
        return Response.json({ message: "account 필드가 필요합니다" }, { status: 400, headers: BLINKS_HEADERS });
    }

    // KYC 인증된 등록 사용자만 투자 가능
    const [investor] = await db
        .select({ id: userTable.id, kycVerified: userTable.kycVerified })
        .from(userTable)
        .where(eq(userTable.walletAddress, account));

    if (!investor) {
        return Response.json(
            { message: "rural-rest.com에 회원가입 후 지갑을 연결해주세요." },
            { status: 403, headers: BLINKS_HEADERS }
        );
    }
    if (!investor.kycVerified) {
        return Response.json(
            { message: "KYC 인증이 필요합니다. rural-rest.com에서 인증 후 투자하세요." },
            { status: 403, headers: BLINKS_HEADERS }
        );
    }

    const token = await getListingWithToken(params.listingId);
    if (!token?.tokenMint) {
        return Response.json({ message: "매물 또는 토큰 정보를 찾을 수 없습니다" }, { status: 404, headers: BLINKS_HEADERS });
    }

    try {
        const connection = new Connection(RPC_URL, "confirmed");
        const userPubkey = new PublicKey(account);
        const programId = new PublicKey(PROGRAM_ID);
        const usdcMint = new PublicKey(USDC_MINT_ADDR);
        const tokenMintPubkey = new PublicKey(token.tokenMint);

        // PDA 계산
        const [propertyToken] = PublicKey.findProgramAddressSync(
            [Buffer.from("property"), Buffer.from(params.listingId)],
            programId
        );
        const [fundingVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("funding_vault"), Buffer.from(params.listingId)],
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
                    .openPosition(params.listingId)
                    .accounts({ investor: userPubkey, propertyToken, investorPosition })
                    .instruction()
            );
        }

        // purchase_tokens 트랜잭션 빌드 (미서명)
        const tx: Transaction = await (program.methods as any)
            .purchaseTokens(params.listingId, new BN(tokenAmount))
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

        return Response.json(
            {
                transaction: base64Tx,
                message: `${tokenAmount} RRT 토큰 구매 ($${priceUsdc} USDC)`,
            },
            { headers: BLINKS_HEADERS }
        );
    } catch (err: any) {
        console.error("[blinks/invest]", err?.message);
        return Response.json(
            { message: err?.message ?? "트랜잭션 생성 실패" },
            { status: 500, headers: BLINKS_HEADERS }
        );
    }
}
