/**
 * Solana Blinks — 숙소 예약
 *
 * GET  /api/actions/book/:listingId  → Action 메타데이터
 * POST /api/actions/book/:listingId  → 미서명 createBookingEscrow 트랜잭션
 *
 * Blinks spec: https://docs.dialect.to/documentation/actions/specification
 */
import {
    Connection,
    PublicKey,
    Transaction,
    Keypair,
    SystemProgram,
} from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import { db } from "~/db/index.server";
import { listings, bookings, user as userTable } from "~/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { RPC_URL, SERVER_PROGRAM_ID, SERVER_USDC_MINT } from "~/lib/constants.server";
import { parseLocalDate, parseLocalDateToUnix } from "~/lib/date-utils";
import IDL from "~/anchor-idl/rural_rest_rwa.json";
import type { Route } from "./+types/api.actions.book.$listingId";

const PROGRAM_ID = SERVER_PROGRAM_ID;
const USDC_MINT_ADDR = SERVER_USDC_MINT;
const PYTH_USD_KRW_FEED = process.env.VITE_PYTH_USD_KRW_FEED ?? "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD";
const KRW_PER_USDC_FALLBACK = 1350;

function isKo(request: Request) {
    const lang = new URL(request.url).searchParams.get("lang");
    if (lang === "en") return false;
    if (lang === "ko") return true;
    return (request.headers.get("Accept-Language") ?? "").toLowerCase().startsWith("ko");
}

function auditLog(event: Record<string, unknown>) {
    console.log("[AUDIT]", JSON.stringify({ ...event, ts: new Date().toISOString() }));
}

const BLINKS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids",
    "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
    "X-Action-Version": "2.4",
    "X-Blockchain-Ids": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // devnet
};

async function getListing(param: string) {
    const isNumeric = /^\d+$/.test(param);
    const rows = await db
        .select({
            id: listings.id,
            title: listings.title,
            location: listings.location,
            images: listings.images,
            pricePerNight: listings.pricePerNight,
            maxGuests: listings.maxGuests,
        })
        .from(listings)
        .where(isNumeric ? eq(listings.nodeNumber, Number(param)) : eq(listings.id, param));
    return rows[0] ?? null;
}

// OPTIONS preflight
export async function loader({ params, request }: Route.LoaderArgs) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: BLINKS_HEADERS });
    }

    const listing = await getListing(params.listingId);
    if (!listing) {
        const ko = isKo(request);
        return Response.json(
            { message: ko ? "매물을 찾을 수 없습니다" : "Property not found" },
            { status: 404, headers: BLINKS_HEADERS }
        );
    }

    const ko = isKo(request);
    const reqUrl = new URL(request.url);
    const proto = request.headers.get("x-forwarded-proto") ?? reqUrl.protocol.replace(":", "");
    const origin = `${proto}://${reqUrl.host}`;
    const imgs = listing.images as string[];
    const iconPath = imgs?.[0] ?? "/ruralrest-logo.png";
    const icon = iconPath.startsWith("http") ? iconPath : `${origin}${iconPath}`;
    const priceKrw = listing.pricePerNight.toLocaleString("ko-KR");
    const priceUsdc = (listing.pricePerNight / KRW_PER_USDC_FALLBACK).toFixed(2);

    return Response.json(
        {
            type: "action",
            title: listing.title,
            icon,
            description: ko
                ? `${listing.location} · 1박 ₩${priceKrw} (≈ $${priceUsdc} USDC) · KYC 인증 필요`
                : `${listing.location} · ₩${priceKrw}/night (≈ $${priceUsdc} USDC) · KYC required`,
            label: ko ? "예약하기" : "Book Now",
            links: {
                actions: [
                    {
                        type: "transaction",
                        label: ko ? "예약하기" : "Book Now",
                        href: `${origin}/api/actions/book/${params.listingId}?checkIn={checkIn}&checkOut={checkOut}&guests={guests}`,
                        parameters: [
                            {
                                name: "checkIn",
                                type: "date",
                                label: ko ? "체크인" : "Check-in",
                                required: true,
                            },
                            {
                                name: "checkOut",
                                type: "date",
                                label: ko ? "체크아웃" : "Check-out",
                                required: true,
                            },
                            {
                                name: "guests",
                                type: "number",
                                label: ko ? `인원 (최대 ${listing.maxGuests}명)` : `Guests (max ${listing.maxGuests})`,
                                required: true,
                                min: 1,
                                max: listing.maxGuests,
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
    const checkIn = url.searchParams.get("checkIn") ?? "";
    const checkOut = url.searchParams.get("checkOut") ?? "";
    const guests = Number(url.searchParams.get("guests") ?? "0");

    const ko = isKo(request);

    const { account } = (await request.json()) as { account: string };
    if (!account) {
        return Response.json({ message: "account field is required" }, { status: 400, headers: BLINKS_HEADERS });
    }

    // 날짜·인원 유효성 검증
    if (!checkIn || !checkOut || !guests) {
        return Response.json(
            { message: ko ? "checkIn, checkOut, guests 파라미터가 필요합니다" : "checkIn, checkOut, and guests are required" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
        return Response.json(
            { message: ko ? "날짜는 YYYY-MM-DD 형식이어야 합니다" : "Dates must be in YYYY-MM-DD format" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }
    const checkInDate = parseLocalDate(checkIn);
    const checkOutDate = parseLocalDate(checkOut);
    if (checkInDate >= checkOutDate) {
        return Response.json(
            { message: ko ? "체크아웃은 체크인 이후 날짜여야 합니다" : "Check-out must be after check-in" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }
    if (checkInDate <= new Date()) {
        return Response.json(
            { message: ko ? "오늘 이후 날짜를 선택해주세요" : "Please select a future date" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }
    if (guests < 1 || guests > 100) {
        return Response.json(
            { message: ko ? "인원은 1~100명 사이여야 합니다" : "Guests must be between 1 and 100" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }

    // KYC 게이트
    const [guest] = await db
        .select({ id: userTable.id, kycVerified: userTable.kycVerified })
        .from(userTable)
        .where(eq(userTable.walletAddress, account));

    if (!guest) {
        auditLog({ action: "blinks_book_rejected", reason: "unregistered", wallet: account, listingId: params.listingId });
        return Response.json(
            { message: ko ? "rural-rest.com에 회원가입 후 지갑을 연결해주세요." : "Please sign up at rural-rest.com and connect your wallet." },
            { status: 403, headers: BLINKS_HEADERS }
        );
    }
    if (!guest.kycVerified) {
        auditLog({ action: "blinks_book_rejected", reason: "kyc_required", userId: guest.id, wallet: account, listingId: params.listingId });
        return Response.json(
            { message: ko ? "KYC 인증이 필요합니다. rural-rest.com에서 인증 후 예약하세요." : "KYC verification required. Please verify at rural-rest.com before booking." },
            { status: 403, headers: BLINKS_HEADERS }
        );
    }

    const listing = await getListing(params.listingId);
    if (!listing) {
        return Response.json(
            { message: ko ? "매물을 찾을 수 없습니다" : "Property not found" },
            { status: 404, headers: BLINKS_HEADERS }
        );
    }

    if (guests > listing.maxGuests) {
        return Response.json(
            { message: ko ? `최대 ${listing.maxGuests}명까지 예약 가능합니다` : `Maximum ${listing.maxGuests} guests allowed` },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }

    // 날짜 중복 예약 체크
    const checkInSec = parseLocalDateToUnix(checkIn);
    const checkOutSec = parseLocalDateToUnix(checkOut);
    const overlapping = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
            and(
                eq(bookings.listingId, listing.id),
                sql`${bookings.status} IN ('pending', 'confirmed')`,
                sql`${bookings.checkIn} < ${checkOutSec}`,
                sql`${bookings.checkOut} > ${checkInSec}`,
            )
        );
    if (overlapping.length > 0) {
        return Response.json({ message: "선택한 날짜에 이미 예약이 있습니다. 다른 날짜를 선택해주세요." }, { status: 400, headers: BLINKS_HEADERS });
    }

    try {
        const connection = new Connection(RPC_URL, "confirmed");
        const guestPubkey = new PublicKey(account);
        const programId = new PublicKey(PROGRAM_ID);
        const usdcMint = new PublicKey(USDC_MINT_ADDR);
        const pythPriceFeed = new PublicKey(PYTH_USD_KRW_FEED);

        // bookingId 생성 (UUID → 하이픈 제거 → 32 bytes seed)
        const bookingId = crypto.randomUUID();
        const bookingIdSeed = bookingId.replace(/-/g, "");

        // PDA 계산
        const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("booking_escrow"), Buffer.from(bookingIdSeed)],
            programId
        );

        // ATA 계산
        const guestUsdc = getAssociatedTokenAddressSync(usdcMint, guestPubkey, false, TOKEN_PROGRAM_ID);
        const escrowVault = getAssociatedTokenAddressSync(usdcMint, escrowPda, true, TOKEN_PROGRAM_ID);

        // 총 금액
        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        const totalPrice = listing.pricePerNight * nights;
        const totalPriceUsdc = Math.round((totalPrice / KRW_PER_USDC_FALLBACK) * 1_000_000);

        // Anchor 프로그램 (더미 지갑 — 트랜잭션 빌드용)
        const dummyWallet = new Wallet(Keypair.generate());
        const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        const program = new Program(IDL as any, provider);

        const preIxs = [
            createAssociatedTokenAccountIdempotentInstruction(
                guestPubkey, guestUsdc, guestPubkey, usdcMint, TOKEN_PROGRAM_ID
            ),
        ];

        const tx: Transaction = await (program.methods as any)
            .createBookingEscrow(
                listing.id,
                bookingIdSeed,
                new BN(totalPrice),
                new BN(checkInSec),
                new BN(checkOutSec),
            )
            .accounts({
                guest: guestPubkey,
                bookingEscrow: escrowPda,
                escrowVault,
                guestUsdc,
                usdcMint,
                pythPriceFeed,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .preInstructions(preIxs)
            .transaction();

        tx.feePayer = guestPubkey;
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        const serialized = tx.serialize({ requireAllSignatures: false });
        const base64Tx = Buffer.from(serialized).toString("base64");

        // DB pre-insert: 슬롯 선점 (onchainPayTx는 Helius webhook이 채움)
        // 서명 포기 또는 tx 드롭으로 onchainPayTx가 null인 채 방치되는 건은
        // /api/cron/expire-bookings (매일 KST 02:00)가 2시간 후 자동 취소
        await db.insert(bookings).values({
            id: bookingId,
            listingId: listing.id,
            guestId: guest.id,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            totalPrice,
            totalPriceUsdc,
            escrowPda: escrowPda.toBase58(),
            status: "pending",
        });

        const priceUsdcDisplay = (totalPriceUsdc / 1_000_000).toFixed(2);

        auditLog({
            action: "blinks_book_tx_built",
            userId: guest.id,
            wallet: account,
            listingId: listing.id,
            bookingId,
            nights,
            totalPrice,
            totalPriceUsdc: priceUsdcDisplay,
        });

        const nightsLabel = ko ? `${nights}박` : `${nights} night${nights > 1 ? "s" : ""}`;
        return Response.json(
            {
                type: "transaction",
                transaction: base64Tx,
                message: `${listing.title} · ${checkIn} ~ ${checkOut} · ${nightsLabel} · $${priceUsdcDisplay} USDC`,
            },
            { headers: BLINKS_HEADERS }
        );
    } catch (err: any) {
        auditLog({ action: "blinks_book_error", userId: guest.id, wallet: account, listingId: params.listingId, error: err?.message });
        console.error("[blinks/book]", err?.message);
        return Response.json(
            { message: err?.message ?? "Failed to build transaction" },
            { status: 500, headers: BLINKS_HEADERS }
        );
    }
}
