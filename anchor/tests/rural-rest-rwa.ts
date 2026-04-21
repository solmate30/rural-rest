// Anchor 프레임워크: Solana 프로그램을 TypeScript에서 호출하는 인터페이스 제공
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
// 빌드 후 자동 생성되는 타입 정의 (IDL 기반) — 프로그램 메서드에 타입 자동완성 제공
import { RuralRestRwa } from "../target/types/rural_rest_rwa";
// SPL Token 유틸: 민트 생성, ATA(Associated Token Account) 생성, 토큰 발행 등
import {
  createMint,                    // 새 토큰 민트(발행처) 생성
  createAssociatedTokenAccount,  // ATA 생성 (민트+소유자 조합으로 결정론적 주소)
  mintTo,                        // 토큰 발행 (민트 권한 보유자만 가능)
  getAssociatedTokenAddressSync, // ATA 주소 계산 (계좌 생성 없이 주소만)
  TOKEN_PROGRAM_ID,              // 표준 SPL Token 프로그램 (USDC 등에 사용)
  TOKEN_2022_PROGRAM_ID,         // Token-2022 확장 프로그램 (RWA 토큰에 사용, 추가 기능 지원)
  ASSOCIATED_TOKEN_PROGRAM_ID,   // ATA 생성을 담당하는 프로그램
} from "@solana/spl-token";
// Solana 기본 타입: Keypair(지갑), PublicKey(주소), LAMPORTS_PER_SOL(단위 변환 상수)
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
// 테스트 단언(assertion) 라이브러리 — assert.equal, assert.include 등
import { assert } from "chai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("rural-rest-rwa", () => {
  // provider: Anchor.toml의 [provider] wallet을 사용하는 로컬넷 연결 객체
  // 트랜잭션 서명 + 전송, 계좌 조회 등을 담당한다
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  // program: IDL 기반 타입이 붙은 프로그램 인스턴스
  // program.methods.xxx()로 각 instruction을 타입 안전하게 호출할 수 있다
  const program = anchor.workspace.RuralRestRwa as Program<RuralRestRwa>;
  const connection = provider.connection;

  // localnet에서 airdrop 대신 provider 지갑(SOL이 충분히 있음)에서 직접 이체한다.
  // 이유: localnet airdrop은 속도가 느리거나 rate limit에 걸릴 수 있어 테스트가 불안정해진다.
  const fundAccount = async (publicKey: PublicKey, lamports: number) => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: publicKey,
        lamports,
      })
    );
    await provider.sendAndConfirm(tx);
  };

  // 테스트 전용 Keypair: 실제 브라우저 지갑 대신 코드에서 생성한 지갑
  // authority = 매물 등록자 (운영자), investor = 투자자
  // provider.wallet.payer를 authority로 사용.
  // rural-rest-dao.ts도 같은 키를 쓰므로, 두 테스트 파일이 같은 validator에서
  // 순차 실행될 때 rwaConfig.authority가 항상 동일하게 유지된다.
  const authority = (provider.wallet as any).payer as Keypair;
  const investor = Keypair.generate();

  // before()에서 생성할 가짜 USDC 민트 주소 (실제 mainnet USDC 불필요)
  let usdcMint: PublicKey;

  // -------------------------------------------------------
  // 시나리오 A: gyeongju-001 (완판 → 배당)
  // -------------------------------------------------------
  const listingId = "gyeongju-001";
  const TOTAL_SUPPLY = new anchor.BN(10);           // 총 발행 토큰 수
  const PRICE_PER_TOKEN = new anchor.BN(1_000_000); // 1 USDC (소수점 6자리 → 1_000_000 = 1.0 USDC)
  const VALUATION_KRW = new anchor.BN(500_000_000); // 부동산 평가액 5억원
  const MIN_FUNDING_BPS = 6000;                      // 최소 판매율 60% (basis points: 6000/10000)

  // 아래 변수들은 before()에서 주소가 채워지는 PDA / ATA 주소들이다.
  // Solana에서 데이터를 저장하거나 토큰을 보관하려면 별도의 "계좌(account)"가 필요하다.
  let tokenMintKeypair: Keypair;    // RWA 토큰 민트용 keypair (init 시 서명 필요)
  let propertyToken: PublicKey;     // PDA: 매물 상태 데이터 저장 [seeds: "property", listingId]
  let investorPosition: PublicKey;  // PDA: 투자자별 보유량 저장 [seeds: "investor", propertyToken, investor]
  let fundingVault: PublicKey;      // PDA 토큰 계좌: 펀딩 기간 중 투자자 USDC를 에스크로로 보관
  let usdcVault: PublicKey;         // ATA: Active 상태에서 배당금(USDC)을 보관하는 볼트
  let authorityUsdcAccount: PublicKey; // authority의 USDC 계좌 (release_funds 수령처)
  let investorUsdcAccount: PublicKey;  // investor의 USDC 계좌 (구매 결제 + 배당 수령)
  let investorRwaAccount: PublicKey;   // investor의 RWA 토큰 계좌 (구매한 토큰이 들어옴)

  // -------------------------------------------------------
  // 시나리오 B: gyeongju-002 (deadline 3초, 환불)
  // 목표: 펀딩 기간 만료 + 최소 판매율 미달 시 환불 흐름 검증
  // -------------------------------------------------------
  const listingId2 = "gyeongju-002";
  const TOTAL_SUPPLY2 = new anchor.BN(100); // 100개 중 1개만 판매 → 1% < 60% (목표 미달)

  let tokenMintKeypair2: Keypair;
  let propertyToken2: PublicKey;
  let investorPosition2: PublicKey;
  let fundingVault2: PublicKey;
  let usdcVault2: PublicKey;
  let investorRwaAccount2: PublicKey;

  // RwaConfig PDA (crank authority 관리)
  let rwaConfig: PublicKey;

  // -------------------------------------------------------
  // 시나리오 C: gyeongju-003 (AuthorityCannotInvest)
  // 목표: 매물 등록자(authority)가 자기 매물에 투자할 수 없음을 검증
  // -------------------------------------------------------
  const listingId3 = "gyeongju-003";
  let tokenMintKeypair3: Keypair;
  let propertyToken3: PublicKey;
  let authorityPosition3: PublicKey; // authority가 만든 포지션 (open_position은 허용, purchase는 차단)
  let fundingVault3: PublicKey;
  let usdcVault3: PublicKey;
  let authorityRwaAccount3: PublicKey;

  // -------------------------------------------------------
  // 시나리오 D: gyeongju-004 (ZeroAmount, RefundNotAvailable, open_position 중복)
  // 목표: 엣지 케이스 에러 처리 검증 (0개 구매, 조기 환불 요청, 중복 포지션)
  // -------------------------------------------------------
  const listingId4 = "gyeongju-004";

  let tokenMintKeypair4: Keypair;
  let propertyToken4: PublicKey;
  let investorPosition4: PublicKey;
  let fundingVault4: PublicKey;
  let usdcVault4: PublicKey;
  let investorRwaAccount4: PublicKey;

  // -------------------------------------------------------
  // 시나리오 E: gyeongju-005 (deadline 3초, 60% goal 달성 → release_funds)
  // 목표: 완판이 아니더라도 목표치(60%) 달성 + deadline 경과 시 release_funds 가능함을 검증
  // -------------------------------------------------------
  const listingId5 = "gyeongju-005";
  let tokenMintKeypair5: Keypair;
  let propertyToken5: PublicKey;
  let investorPosition5: PublicKey;
  let fundingVault5: PublicKey;
  let usdcVault5: PublicKey;

  // -------------------------------------------------------
  // 시나리오 F: BookingEscrow (create / release / cancel / partial-cancel)
  // 목표: 예약 에스크로 생성 및 취소 정책별 USDC 분배 검증
  // -------------------------------------------------------
  const bookingId  = "bkg-f001-0000-0000-000000000001"; // 32바이트 이하
  const bookingId2 = "bkg-f002-0000-0000-000000000002";
  const bookingId3 = "bkg-f003-0000-0000-000000000003";
  const listingIdF = "gyeongju-f01";

  let guest: Keypair;
  let host: Keypair;
  let guestUsdcAccount: PublicKey;
  let hostUsdcAccount: PublicKey;
  let bookingEscrowPda: PublicKey;
  let bookingEscrowPda2: PublicKey;
  let bookingEscrowPda3: PublicKey;
  let escrowVault: PublicKey;
  let escrowVault2: PublicKey;
  let escrowVault3: PublicKey;
  let propertyTokenF: PublicKey; // F 시나리오: host가 authority인 propertyToken PDA
  let listingVaultF: PublicKey;
  let listingVaultAtaF: PublicKey;
  const ESCROW_AMOUNT_KRW = new anchor.BN(100_000); // 10만원 → skip-oracle: 74 USDC(1350 KRW/USD)

  // ── before(): 모든 it() 테스트 실행 전 딱 1번 실행되는 전역 셋업 ──────────────
  before(async () => {
    // 트랜잭션 수수료(gas)와 계좌 렌트(rent: 데이터 저장 비용)를 위해 SOL이 필요하다.
    // 1 LAMPORT = 0.000000001 SOL, LAMPORTS_PER_SOL = 1_000_000_000
    await fundAccount(authority.publicKey, 0.5 * LAMPORTS_PER_SOL);
    await fundAccount(investor.publicKey, 0.5 * LAMPORTS_PER_SOL);

    // 테스트용 가짜 USDC 민트 생성 (decimals=6 → 1_000_000 = 1.0 USDC)
    // 두 번째 인자(authority)는 트랜잭션 수수료 납부자, 세 번째는 민트 권한자
    usdcMint = await createMint(connection, authority, authority.publicKey, null, 6);

    // authority의 USDC ATA 생성 후 1000 USDC 발행 (1_000_000_000 = 1000.0 USDC)
    authorityUsdcAccount = await createAssociatedTokenAccount(
      connection, authority, usdcMint, authority.publicKey
    );
    await mintTo(connection, authority, usdcMint, authorityUsdcAccount, authority, 1_000_000_000);

    // investor의 USDC ATA 생성 후 1000 USDC 발행
    investorUsdcAccount = await createAssociatedTokenAccount(
      connection, investor, usdcMint, investor.publicKey
    );
    await mintTo(connection, authority, usdcMint, investorUsdcAccount, authority, 1_000_000_000);

    // ── 시나리오 A PDAs 주소 계산 ──────────────────────────────────────────────
    // findProgramAddressSync: seed 배열로 PDA 주소를 오프체인에서 결정론적으로 계산한다.
    // 실제 계좌 생성은 프로그램이 init할 때 일어남 — 여기서는 주소만 미리 파악해두는 것.
    [propertyToken] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingId)], // seeds: ["property", "gyeongju-001"]
      program.programId
    );
    [investorPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("investor"), propertyToken.toBuffer(), investor.publicKey.toBuffer()],
      program.programId
    );
    [fundingVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from(listingId)],
      program.programId
    );
    // usdcVault: propertyToken PDA가 소유자인 ATA (배당금 USDC 보관용, Active 상태에서 사용)
    // fundingVault와 구분: fundingVault는 펀딩 기간 에스크로, usdcVault는 배당금 전용
    usdcVault = getAssociatedTokenAddressSync(usdcMint, propertyToken, true, TOKEN_PROGRAM_ID);
    tokenMintKeypair = Keypair.generate(); // RWA 토큰 민트 keypair (init 시 서명 필요)

    // 시나리오 B PDAs
    [propertyToken2] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingId2)],
      program.programId
    );
    [investorPosition2] = PublicKey.findProgramAddressSync(
      [Buffer.from("investor"), propertyToken2.toBuffer(), investor.publicKey.toBuffer()],
      program.programId
    );
    [fundingVault2] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from(listingId2)],
      program.programId
    );
    usdcVault2 = getAssociatedTokenAddressSync(usdcMint, propertyToken2, true, TOKEN_PROGRAM_ID);
    tokenMintKeypair2 = Keypair.generate();

    // 시나리오 C PDAs
    [propertyToken3] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingId3)],
      program.programId
    );
    [authorityPosition3] = PublicKey.findProgramAddressSync(
      [Buffer.from("investor"), propertyToken3.toBuffer(), authority.publicKey.toBuffer()],
      program.programId
    );
    [fundingVault3] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from(listingId3)],
      program.programId
    );
    usdcVault3 = getAssociatedTokenAddressSync(usdcMint, propertyToken3, true, TOKEN_PROGRAM_ID);
    tokenMintKeypair3 = Keypair.generate();
    authorityRwaAccount3 = getAssociatedTokenAddressSync(
      tokenMintKeypair3.publicKey, authority.publicKey, false, TOKEN_2022_PROGRAM_ID
    );

    // 시나리오 D PDAs
    [propertyToken4] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingId4)],
      program.programId
    );
    [investorPosition4] = PublicKey.findProgramAddressSync(
      [Buffer.from("investor"), propertyToken4.toBuffer(), investor.publicKey.toBuffer()],
      program.programId
    );
    [fundingVault4] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from(listingId4)],
      program.programId
    );
    usdcVault4 = getAssociatedTokenAddressSync(usdcMint, propertyToken4, true, TOKEN_PROGRAM_ID);
    tokenMintKeypair4 = Keypair.generate();
    investorRwaAccount4 = getAssociatedTokenAddressSync(
      tokenMintKeypair4.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID
    );

    // 시나리오 E PDAs
    [propertyToken5] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingId5)],
      program.programId
    );
    [investorPosition5] = PublicKey.findProgramAddressSync(
      [Buffer.from("investor"), propertyToken5.toBuffer(), investor.publicKey.toBuffer()],
      program.programId
    );
    [fundingVault5] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from(listingId5)],
      program.programId
    );
    usdcVault5 = getAssociatedTokenAddressSync(usdcMint, propertyToken5, true, TOKEN_PROGRAM_ID);
    tokenMintKeypair5 = Keypair.generate();

    // 시나리오 F: 게스트 / 호스트 계좌 셋업
    guest = Keypair.generate();
    host  = Keypair.generate();
    await fundAccount(guest.publicKey, 0.5 * LAMPORTS_PER_SOL);
    await fundAccount(host.publicKey,  1.0 * LAMPORTS_PER_SOL); // initializeProperty 렌트 비용 포함

    guestUsdcAccount = await createAssociatedTokenAccount(
      connection, guest, usdcMint, guest.publicKey
    );
    await mintTo(connection, authority, usdcMint, guestUsdcAccount, authority, 500_000_000); // 500 USDC

    hostUsdcAccount = await createAssociatedTokenAccount(
      connection, host, usdcMint, host.publicKey
    );

    // 예약 PDA 주소 사전 계산 (UUID 하이픈 제거 버전이 seed)
    const bookingSeed  = Buffer.from(bookingId.replace(/-/g, ""));
    const bookingSeed2 = Buffer.from(bookingId2.replace(/-/g, ""));
    const bookingSeed3 = Buffer.from(bookingId3.replace(/-/g, ""));

    [bookingEscrowPda]  = PublicKey.findProgramAddressSync([Buffer.from("booking_escrow"), bookingSeed],  program.programId);
    [bookingEscrowPda2] = PublicKey.findProgramAddressSync([Buffer.from("booking_escrow"), bookingSeed2], program.programId);
    [bookingEscrowPda3] = PublicKey.findProgramAddressSync([Buffer.from("booking_escrow"), bookingSeed3], program.programId);

    escrowVault  = getAssociatedTokenAddressSync(usdcMint, bookingEscrowPda,  true, TOKEN_PROGRAM_ID);
    escrowVault2 = getAssociatedTokenAddressSync(usdcMint, bookingEscrowPda2, true, TOKEN_PROGRAM_ID);
    escrowVault3 = getAssociatedTokenAddressSync(usdcMint, bookingEscrowPda3, true, TOKEN_PROGRAM_ID);

    // 시나리오 F: propertyTokenF 초기화 (host를 authority로 사용)
    // create_booking_escrow가 property_token 계좌를 요구하므로 사전에 초기화 필요.
    // host = authority → booking_escrow.host = host.publicKey → F-3의 host_usdc.owner 검증 통과
    const tokenMintKeypairF = Keypair.generate();
    [propertyTokenF] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingIdF)], program.programId
    );
    const [fundingVaultF] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from(listingIdF)], program.programId
    );
    const usdcVaultF = getAssociatedTokenAddressSync(usdcMint, propertyTokenF, true, TOKEN_PROGRAM_ID);
    const deadlineF = new anchor.BN(Math.floor(Date.now() / 1000) + 30 * 24 * 3600);
    try {
      await program.methods
        .initializeProperty(listingIdF, new anchor.BN(10), VALUATION_KRW, PRICE_PER_TOKEN, deadlineF, MIN_FUNDING_BPS)
        .accounts({
          authority: host.publicKey,
          propertyToken: propertyTokenF,
          tokenMint: tokenMintKeypairF.publicKey,
          fundingVault: fundingVaultF,
          usdcVault: usdcVaultF,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([host, tokenMintKeypairF])
        .rpc();
    } catch (err: any) {
      // "already in use" → 이전 테스트 실행에서 생성된 계좌. 무시.
      if (!err.toString().includes("already in use") && !err.toString().includes("0x0")) {
        throw err;
      }
    }

    // 시나리오 F: listing_vault 주소 계산
    [listingVaultF] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing_vault"), Buffer.from(listingIdF)],
      program.programId
    );
    listingVaultAtaF = getAssociatedTokenAddressSync(usdcMint, listingVaultF, true, TOKEN_PROGRAM_ID);

    // RwaConfig PDA
    [rwaConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("rwa_config")],
      program.programId
    );

    // RwaConfig 초기화 (멱등: 이미 존재하면 스킵)
    try {
      await program.methods
        .initializeConfig()
        .accounts({
          authority: authority.publicKey,
          rwaConfig,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    } catch (err: any) {
      // "already in use" → 이전 테스트 실행에서 생성된 계좌. 무시.
      if (!err.toString().includes("already in use") && !err.toString().includes("0x0")) {
        throw err;
      }
    }

    // 시나리오 F용 listing_vault 초기화 (rwaConfig 초기화 이후)
    try {
      await program.methods
        .initializeListingVault(listingIdF)
        .accounts({
          authority: authority.publicKey,
          rwaConfig,
          listingVault: listingVaultF,
          listingVaultAta: listingVaultAtaF,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    } catch (err: any) {
      if (!err.toString().includes("already in use") && !err.toString().includes("0x0")) {
        throw err;
      }
    }
  });

  // -------------------------------------------------------
  // 1. 매물 등록 → propertyToken PDA 생성, status=Funding
  // -------------------------------------------------------
  it("1. initialize_property", async () => {
    // Date.now()는 밀리초 단위이므로 /1000으로 초로 변환 (Solana 타임스탬프는 Unix 초 단위)
    // 8초: 완판 후 deadline 경과를 기다려 release_funds 테스트 가능
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 8);

    await program.methods
      .initializeProperty(listingId, TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, deadline, MIN_FUNDING_BPS)
      .accounts({
        authority: authority.publicKey,
        propertyToken,          // 이 PDA에 매물 상태가 저장됨 (프로그램이 init)
        tokenMint: tokenMintKeypair.publicKey,
        fundingVault,
        usdcVault,
        usdcMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,       // RWA 토큰 민트용 (Token-2022)
        usdcTokenProgram: TOKEN_PROGRAM_ID,        // USDC 계좌용 (표준 SPL Token)
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      // authority: 트랜잭션 제출자 + 매물 등록자
      // tokenMintKeypair: 새 민트 계좌를 init할 때 해당 keypair의 소유권 증명이 필요
      .signers([authority, tokenMintKeypair])
      .rpc();

    // initialize_property 호출 후에야 tokenMint 주소가 확정되므로 ATA 주소 계산을 여기서 한다
    investorRwaAccount = getAssociatedTokenAddressSync(
      tokenMintKeypair.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID
    );

    // 온체인 계좌 데이터를 읽어 초기화가 올바르게 됐는지 단언
    const account = await program.account.propertyToken.fetch(propertyToken);
    assert.equal(account.listingId, listingId);
    assert.equal(account.totalSupply.toNumber(), 10);
    // Anchor enum은 { 변형이름: {} } 형태의 객체로 직렬화된다 (예: { funding: {} })
    assert.deepEqual(account.status, { funding: {} });
    console.log("    status =", JSON.stringify(account.status));
  });

  // -------------------------------------------------------
  // 2. investor가 1개 구매 → investorPosition.amount=1, 1 USDC fundingVault 입금
  // -------------------------------------------------------
  it("2. purchase_tokens — 1토큰 구매 성공", async () => {
    // openPosition을 먼저 호출해야 한다: InvestorPosition PDA를 최초 1회 생성.
    // purchaseTokens에서 init_if_needed를 쓰지 않고 분리한 이유:
    //   init_if_needed는 재초기화 공격에 취약하므로, 별도 instruction으로 분리해 보안 강화.
    await program.methods
      .openPosition(listingId)
      .accounts({
        investor: investor.publicKey,
        propertyToken,
        investorPosition,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    // new anchor.BN(1): JS의 number는 64비트 정수(u64)를 정확히 표현할 수 없으므로
    // BN(BigNumber) 라이브러리를 사용한다.
    await program.methods
      .purchaseTokens(listingId, new anchor.BN(1))
      .accounts({
        investor: investor.publicKey,
        propertyToken,
        tokenMint: tokenMintKeypair.publicKey,
        investorPosition,
        investorUsdcAccount,
        fundingVault,           // investor USDC → fundingVault (에스크로)
        investorRwaAccount,     // RWA 토큰이 여기로 민트됨
        usdcMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    // InvestorPosition.amount가 1로 기록됐는지 확인
    const pos = await program.account.investorPosition.fetch(investorPosition);
    assert.equal(pos.amount.toNumber(), 1);
    console.log("    InvestorPosition.amount =", pos.amount.toNumber());
  });

  // -------------------------------------------------------
  // 3. 30% 상한 초과 → 실패
  // -------------------------------------------------------
  it("3. purchase_tokens — 30% 상한 초과 시 실패", async () => {
    // 현재 상태: investor가 1개 보유, 총 10개, 상한 = 10 * 3 / 10 = 3개
    // 3개 더 구매하면 1+3 = 4개 = 40% > 30% → ExceedsInvestorCap 에러
    //
    // 에러 테스트 패턴: 성공하면 assert.fail로 테스트 실패, 실패하면 예상 에러인지 확인
    try {
      await program.methods
        .purchaseTokens(listingId, new anchor.BN(3))
        .accounts({
          investor: investor.publicKey,
          propertyToken,
          tokenMint: tokenMintKeypair.publicKey,
          investorPosition,
          investorUsdcAccount,
          fundingVault,
          investorRwaAccount,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("ExceedsInvestorCap 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "ExceedsInvestorCap");
      console.log("    ExceedsInvestorCap 에러 정상 발생");
    }
  });

  // -------------------------------------------------------
  // 4. Funding 상태에서 activate → 실패
  // -------------------------------------------------------
  it("4. activate_property — Funding 상태에서 호출 시 실패", async () => {
    try {
      await program.methods
        .activateProperty(listingId)
        .accounts({
          propertyToken,
          operator: authority.publicKey,
          rwaConfig,
          tokenMint: tokenMintKeypair.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
      assert.fail("InvalidStatus 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "InvalidStatus");
      console.log("    InvalidStatus 에러 정상 발생");
    }
  });

  // -------------------------------------------------------
  // 5. 완판 → Funded 자동 전환
  // -------------------------------------------------------
  it("5. purchase_tokens — 완판 시 Funded 자동 전환", async () => {
    // 이미 investor가 1개 구매했으므로 3명이 3개씩 더 사면 총 1+9 = 10개 = 완판
    // 30% 상한(=3개)까지 구매 가능하므로 3명으로 충분 (기존 10% 상한 때는 9명 필요했음)
    for (let i = 0; i < 3; i++) {
      // 임시 투자자 keypair 생성 (각자 지갑을 갖고 있는 별개의 사람)
      const kp = Keypair.generate();
      // SOL: 트랜잭션 수수료 + 계좌 렌트 비용
      await fundAccount(kp.publicKey, 0.1 * LAMPORTS_PER_SOL);

      // 10_000_000 = 10 USDC (1개 구매에 필요한 금액 + 여유분)
      const kpUsdc = await createAssociatedTokenAccount(connection, authority, usdcMint, kp.publicKey);
      await mintTo(connection, authority, usdcMint, kpUsdc, authority, 10_000_000);

      const [kpPos] = PublicKey.findProgramAddressSync(
        [Buffer.from("investor"), propertyToken.toBuffer(), kp.publicKey.toBuffer()],
        program.programId
      );
      const kpRwa = getAssociatedTokenAddressSync(
        tokenMintKeypair.publicKey, kp.publicKey, false, TOKEN_2022_PROGRAM_ID
      );

      await program.methods
        .openPosition(listingId)
        .accounts({
          investor: kp.publicKey,
          propertyToken,
          investorPosition: kpPos,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([kp])
        .rpc();

      await program.methods
        .purchaseTokens(listingId, new anchor.BN(3))
        .accounts({
          investor: kp.publicKey,
          propertyToken,
          tokenMint: tokenMintKeypair.publicKey,
          investorPosition: kpPos,
          investorUsdcAccount: kpUsdc,
          fundingVault,
          investorRwaAccount: kpRwa,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([kp])
        .rpc();
    }

    const property = await program.account.propertyToken.fetch(propertyToken);
    assert.equal(property.tokensSold.toNumber(), 10);
    // 완판해도 deadline 경과 전까지 Funding 유지 (투자자 취소 보장)
    assert.deepEqual(property.status, { funding: {} });
    console.log("    tokens_sold = 10/10, status = Funding (deadline 대기 중)");
  });

  // -------------------------------------------------------
  // 6. release_funds — 완판 + deadline 경과 후 에스크로 해제
  // -------------------------------------------------------
  it("6. release_funds — 완판 후 운영자 계좌로 송금", async () => {
    // deadline(8초) 경과 대기
    await sleep(9000);

    // before/after 패턴: 호출 전후의 잔액 차이로 실제 이체 금액을 검증한다
    const before = await connection.getTokenAccountBalance(authorityUsdcAccount);

    // release_funds: fundingVault(에스크로)에 보관된 USDC를 authority에게 이체
    // 조건: 완판(tokens_sold == total_supply) 또는 deadline 경과 + 목표율 달성
    await program.methods
      .releaseFunds(listingId)
      .accounts({
        propertyToken,
        operator: authority.publicKey,
        rwaConfig,
        fundingVault,            // 에스크로 볼트 (USDC 출처)
        authorityUsdcAccount,    // authority 수령 계좌
        usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const after = await connection.getTokenAccountBalance(authorityUsdcAccount);
    const received = Number(after.value.amount) - Number(before.value.amount);
    assert.equal(received, 10_000_000, "10토큰 × 1 USDC = 10 USDC 수령");
    console.log("    운영자 수령:", received / 1_000_000, "USDC");
  });

  // -------------------------------------------------------
  // 7. Funded → Active
  // -------------------------------------------------------
  it("7. activate_property — Funded → Active", async () => {
    // activate_property: Funded → Active 상태 전환
    // 내부적으로 tokenMint의 민트 authority를 null로 set_authority → 추가 발행 영구 불가
    // 이 시점부터 숙박 수익 배당이 시작될 수 있다
    await program.methods
      .activateProperty(listingId)
      .accounts({
        propertyToken,
        operator: authority.publicKey,
        rwaConfig,
        tokenMint: tokenMintKeypair.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    const property = await program.account.propertyToken.fetch(propertyToken);
    assert.deepEqual(property.status, { active: {} });
    console.log("    status = Active");
  });

  // -------------------------------------------------------
  // 8. 숙박 수익 10 USDC 입금 → acc_dividend_per_share 증가 (토큰 1개당 1 USDC 적립)
  // -------------------------------------------------------
  it("8. distribute_monthly_revenue — 10 USDC 분배", async () => {
    // 10_000_000 micro-USDC = 10.0 USDC (숙박 수익)
    // 내부 수학: acc_dividend_per_share += revenue * PRECISION / total_supply
    //   = 10_000_000 * 1e12 / 10 = 1_000_000_000_000_000_000 (= 1e18)
    // PRECISION = 1e12: 정수 연산에서 소수점 정밀도를 유지하기 위한 스케일 팩터
    await program.methods
      .distributeMonthlyRevenue(listingId, new anchor.BN(10_000_000))
      .accounts({
        propertyToken,
        authority: authority.publicKey,
        authorityUsdcAccount,   // USDC 출처 (운영자가 수익을 입금)
        usdcVault,              // USDC 입금 목적지 (배당금 보관 볼트)
        usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const property = await program.account.propertyToken.fetch(propertyToken);
    // acc_dividend_per_share가 0보다 커야 한다 (배당이 쌓였음을 확인)
    assert.isTrue(property.accDividendPerShare.gtn(0));
    console.log("    acc_dividend_per_share =", property.accDividendPerShare.toString());
  });

  // -------------------------------------------------------
  // 9. 배당 수령 (1토큰 → 1 USDC)
  // -------------------------------------------------------
  it("9. claim_dividend — 1 USDC 수령 확인", async () => {
    // 수령 예상 금액: investor 보유 1토큰 × (10 USDC / 10토큰) = 1 USDC
    // 수학: pending = amount * acc_dps / PRECISION - reward_debt
    //      = 1 * 1e18 / 1e12 - 0 = 1_000_000 micro-USDC = 1 USDC
    // claim 후 reward_debt가 acc_dps * amount로 갱신되어 중복 수령 방지
    const before = await connection.getTokenAccountBalance(investorUsdcAccount);

    await program.methods
      .claimDividend(listingId)
      .accounts({
        investor: investor.publicKey,
        propertyToken,
        investorPosition,
        usdcVault,            // 배당금 출처
        investorUsdcAccount,  // 수령 계좌
        usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    const after = await connection.getTokenAccountBalance(investorUsdcAccount);
    const received = Number(after.value.amount) - Number(before.value.amount);
    // 1_000_000 micro-USDC = 1.0 USDC
    assert.equal(received, 1_000_000);
    console.log("    수령 배당:", received / 1_000_000, "USDC");
  });

  // -------------------------------------------------------
  // 10. 배당 수령 후 재시도 → NoPendingDividend 에러 (reward_debt로 중복 차단)
  // -------------------------------------------------------
  it("10. claim_dividend — 중복 수령 시 NoPendingDividend 에러", async () => {
    try {
      await program.methods
        .claimDividend(listingId)
        .accounts({
          investor: investor.publicKey,
          propertyToken,
          investorPosition,
          usdcVault,
          investorUsdcAccount,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("NoPendingDividend 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "NoPendingDividend");
      console.log("    NoPendingDividend 에러 정상 발생");
    }
  });

  // ================================================================
  // 시나리오 B: gyeongju-002 — 펀딩 실패 → 환불
  // 설정: 총 100개, deadline=3초, 1개만 판매(1% < 60% 목표 미달)
  //
  // 검증 내용:
  //   11. 매물 등록 (deadline=3초)
  //   12. 1개 구매 → tokens_sold=1 (목표 미달 상태 유지)
  //   13. deadline 경과 후 추가 구매 시도 → FundingExpired 에러
  //   14. refund 호출 → 1 USDC 환불, status=Failed로 전환
  //   15. 환불 완료 후 재시도 → AlreadyRefunded 에러
  // ================================================================

  it("11. initialize_property (gyeongju-002, deadline = 3초 후)", async () => {
    // deadline을 3초 후로 설정: 테스트에서 실제 시간을 흘려보내 만료 상태를 시뮬레이션
    // Solana 블록체인 시간은 실제 시간과 동일하게 흐르므로 sleep(4000)으로 대기 가능
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 3);

    await program.methods
      .initializeProperty(listingId2, TOTAL_SUPPLY2, VALUATION_KRW, PRICE_PER_TOKEN, deadline, MIN_FUNDING_BPS)
      .accounts({
        authority: authority.publicKey,
        propertyToken: propertyToken2,
        tokenMint: tokenMintKeypair2.publicKey,
        fundingVault: fundingVault2,
        usdcVault: usdcVault2,
        usdcMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, tokenMintKeypair2])
      .rpc();

    investorRwaAccount2 = getAssociatedTokenAddressSync(
      tokenMintKeypair2.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID
    );

    const account = await program.account.propertyToken.fetch(propertyToken2);
    assert.deepEqual(account.status, { funding: {} });
    console.log("    status = Funding, deadline = 3초 후");
  });

  it("12. purchase_tokens (gyeongju-002, 1토큰 — 60% 미달)", async () => {
    await program.methods
      .openPosition(listingId2)
      .accounts({
        investor: investor.publicKey,
        propertyToken: propertyToken2,
        investorPosition: investorPosition2,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    await program.methods
      .purchaseTokens(listingId2, new anchor.BN(1))
      .accounts({
        investor: investor.publicKey,
        propertyToken: propertyToken2,
        tokenMint: tokenMintKeypair2.publicKey,
        investorPosition: investorPosition2,
        investorUsdcAccount,
        fundingVault: fundingVault2,
        investorRwaAccount: investorRwaAccount2,
        usdcMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    const property = await program.account.propertyToken.fetch(propertyToken2);
    assert.equal(property.tokensSold.toNumber(), 1); // 1% < 60%
    console.log("    tokens_sold = 1/100 (1%, 60% 미달)");
  });

  it("13. purchase_tokens — deadline 경과 후 FundingExpired 에러", async () => {
    // sleep(4000): 3초 deadline이 확실히 지나도록 4초 대기
    // 프로그램은 Clock::get()?.unix_timestamp로 현재 시간을 확인한다
    await sleep(4000); // deadline 대기

    try {
      await program.methods
        .purchaseTokens(listingId2, new anchor.BN(1))
        .accounts({
          investor: investor.publicKey,
          propertyToken: propertyToken2,
          tokenMint: tokenMintKeypair2.publicKey,
          investorPosition: investorPosition2,
          investorUsdcAccount,
          fundingVault: fundingVault2,
          investorRwaAccount: investorRwaAccount2,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("FundingExpired 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "FundingExpired");
      console.log("    FundingExpired 에러 정상 발생");
    }
  });

  it("14. refund — 펀딩 실패 시 투자자 환불", async () => {
    const before = await connection.getTokenAccountBalance(investorUsdcAccount);

    await program.methods
      .refund(listingId2)
      .accounts({
        investor: investor.publicKey,
        propertyToken: propertyToken2,
        investorPosition: investorPosition2,
        fundingVault: fundingVault2,
        investorUsdcAccount,
        usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    const after = await connection.getTokenAccountBalance(investorUsdcAccount);
    const refunded = Number(after.value.amount) - Number(before.value.amount);
    assert.equal(refunded, 1_000_000, "1토큰 × 1 USDC = 1 USDC 환불");

    const property = await program.account.propertyToken.fetch(propertyToken2);
    assert.deepEqual(property.status, { failed: {} });
    console.log("    환불액:", refunded / 1_000_000, "USDC, status = Failed");
  });

  it("15. refund — 이미 환불 후 재시도 시 AlreadyRefunded 에러", async () => {
    try {
      await program.methods
        .refund(listingId2)
        .accounts({
          investor: investor.publicKey,
          propertyToken: propertyToken2,
          investorPosition: investorPosition2,
          fundingVault: fundingVault2,
          investorUsdcAccount,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("AlreadyRefunded 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "AlreadyRefunded");
      console.log("    AlreadyRefunded 에러 정상 발생");
    }
  });

  // ================================================================
  // 시나리오 A 연장 (gyeongju-001, Active 상태 유지)
  //
  // 검증 내용:
  //   16. 수익 0 USDC 배당 시도 → ZeroRevenue 에러 (0원 배당은 허용하지 않음)
  //   17. 2차 배당 20 USDC 분배 후 claim
  //       → reward_debt 누적으로 이미 수령한 1 USDC는 제외하고 2 USDC만 수령되는지 확인
  //   18. release_funds 재호출 → FundsAlreadyReleased 에러 (중복 자금 인출 차단)
  // ================================================================

  it("16. distribute_monthly_revenue(0) — ZeroRevenue 에러", async () => {
    try {
      await program.methods
        .distributeMonthlyRevenue(listingId, new anchor.BN(0))
        .accounts({
          propertyToken,
          authority: authority.publicKey,
          authorityUsdcAccount,
          usdcVault,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      assert.fail("ZeroRevenue 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "ZeroRevenue");
      console.log("    ZeroRevenue 에러 정상 발생");
    }
  });

  it("17. 2차 배당 분배 후 claim — reward_debt 누적 검증", async () => {
    // ── 배당 수학 (마스터셰프 알고리즘) ───────────────────────────────────────
    // 현재 상태 (1차 배당 후):
    //   acc_dps = 10_000_000 * 1e12 / 10 = 1_000_000_000_000_000_000 (= 1e18)
    //   investor reward_debt = 1 * 1e18 / 1e12 = 1_000_000 (1 USDC 기수령 처리됨)
    //
    // 2차 분배: 20 USDC (20_000_000 micro-USDC)
    //   acc_dps += 20_000_000 * 1e12 / 10 = 2e18
    //   새 acc_dps = 1e18 + 2e18 = 3e18
    //
    // investor 수령 가능액:
    //   pending = amount * acc_dps / PRECISION - reward_debt
    //           = 1 * 3e18 / 1e12 - 1_000_000
    //           = 3_000_000 - 1_000_000 = 2_000_000 (= 2 USDC)
    //
    // reward_debt 개념: 내가 이미 수령했거나 내 구매 이전에 쌓인 배당을 추적해
    //                   이중 수령을 방지하는 장치
    await program.methods
      .distributeMonthlyRevenue(listingId, new anchor.BN(20_000_000))
      .accounts({
        propertyToken,
        authority: authority.publicKey,
        authorityUsdcAccount,
        usdcVault,
        usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const prop = await program.account.propertyToken.fetch(propertyToken);
    // (10M + 20M) micro-USDC × 1e12 / 10 tokens = 3_000_000 × 1e12 = 3e18
    const expectedAccDps = new anchor.BN("3000000000000000000");
    assert.equal(prop.accDividendPerShare.toString(), expectedAccDps.toString());
    console.log("    acc_dividend_per_share =", prop.accDividendPerShare.toString());

    const before = await connection.getTokenAccountBalance(investorUsdcAccount);
    await program.methods
      .claimDividend(listingId)
      .accounts({
        investor: investor.publicKey,
        propertyToken,
        investorPosition,
        usdcVault,
        investorUsdcAccount,
        usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    const after = await connection.getTokenAccountBalance(investorUsdcAccount);
    const received = Number(after.value.amount) - Number(before.value.amount);
    assert.equal(received, 2_000_000, "2차 배당 2 USDC 수령");
    console.log("    2차 배당 수령:", received / 1_000_000, "USDC");
  });

  it("18. release_funds 재호출 — FundsAlreadyReleased 에러", async () => {
    try {
      await program.methods
        .releaseFunds(listingId)
        .accounts({
          propertyToken,
          operator: authority.publicKey,
          rwaConfig,
          fundingVault,
          authorityUsdcAccount,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      assert.fail("FundsAlreadyReleased 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "FundsAlreadyReleased");
      console.log("    FundsAlreadyReleased 에러 정상 발생");
    }
  });

  // ================================================================
  // initialize_property 파라미터 검증 — 잘못된 입력 시 에러 발생 확인
  //
  // 검증 내용:
  //   19. price=0 입력 → InvalidPrice 에러
  //   20. min_funding_bps=0 입력 → InvalidFundingBps 에러
  //   21. min_funding_bps=10001 입력 (100% 초과) → InvalidFundingBps 에러
  //   22. deadline=현재+366일 입력 (최대 365일 초과) → DeadlineTooFar 에러
  // ================================================================

  it("19. initialize_property — price=0 → InvalidPrice 에러", async () => {
    const tempMint = Keypair.generate();
    const [tempPt] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from("invalid-price")],
      program.programId
    );
    const [tempVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from("invalid-price")],
      program.programId
    );
    const tempUsdcVault = getAssociatedTokenAddressSync(usdcMint, tempPt, true, TOKEN_PROGRAM_ID);
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 24 * 3600);

    try {
      await program.methods
        .initializeProperty("invalid-price", TOTAL_SUPPLY, VALUATION_KRW, new anchor.BN(0), deadline, MIN_FUNDING_BPS)
        .accounts({
          authority: authority.publicKey,
          propertyToken: tempPt,
          tokenMint: tempMint.publicKey,
          fundingVault: tempVault,
          usdcVault: tempUsdcVault,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority, tempMint])
        .rpc();
      assert.fail("InvalidPrice 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "InvalidPrice");
      console.log("    InvalidPrice 에러 정상 발생");
    }
  });

  it("20. initialize_property — min_funding_bps=0 → InvalidFundingBps 에러", async () => {
    const tempMint = Keypair.generate();
    const [tempPt] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from("invalid-bps-0")],
      program.programId
    );
    const [tempVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from("invalid-bps-0")],
      program.programId
    );
    const tempUsdcVault = getAssociatedTokenAddressSync(usdcMint, tempPt, true, TOKEN_PROGRAM_ID);
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 24 * 3600);

    try {
      await program.methods
        .initializeProperty("invalid-bps-0", TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, deadline, 0)
        .accounts({
          authority: authority.publicKey,
          propertyToken: tempPt,
          tokenMint: tempMint.publicKey,
          fundingVault: tempVault,
          usdcVault: tempUsdcVault,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority, tempMint])
        .rpc();
      assert.fail("InvalidFundingBps 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "InvalidFundingBps");
      console.log("    InvalidFundingBps(0) 에러 정상 발생");
    }
  });

  it("21. initialize_property — min_funding_bps=10001 → InvalidFundingBps 에러", async () => {
    const tempMint = Keypair.generate();
    const [tempPt] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from("invalid-bps-hi")],
      program.programId
    );
    const [tempVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from("invalid-bps-hi")],
      program.programId
    );
    const tempUsdcVault = getAssociatedTokenAddressSync(usdcMint, tempPt, true, TOKEN_PROGRAM_ID);
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 24 * 3600);

    try {
      await program.methods
        .initializeProperty("invalid-bps-hi", TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, deadline, 10001)
        .accounts({
          authority: authority.publicKey,
          propertyToken: tempPt,
          tokenMint: tempMint.publicKey,
          fundingVault: tempVault,
          usdcVault: tempUsdcVault,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority, tempMint])
        .rpc();
      assert.fail("InvalidFundingBps 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "InvalidFundingBps");
      console.log("    InvalidFundingBps(10001) 에러 정상 발생");
    }
  });

  it("22. initialize_property — deadline > now+365일 → DeadlineTooFar 에러", async () => {
    const tempMint = Keypair.generate();
    const [tempPt] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from("too-far-dead")],
      program.programId
    );
    const [tempVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from("too-far-dead")],
      program.programId
    );
    const tempUsdcVault = getAssociatedTokenAddressSync(usdcMint, tempPt, true, TOKEN_PROGRAM_ID);
    const tooFar = new anchor.BN(Math.floor(Date.now() / 1000) + 366 * 24 * 3600);

    try {
      await program.methods
        .initializeProperty("too-far-dead", TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, tooFar, MIN_FUNDING_BPS)
        .accounts({
          authority: authority.publicKey,
          propertyToken: tempPt,
          tokenMint: tempMint.publicKey,
          fundingVault: tempVault,
          usdcVault: tempUsdcVault,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority, tempMint])
        .rpc();
      assert.fail("DeadlineTooFar 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "DeadlineTooFar");
      console.log("    DeadlineTooFar 에러 정상 발생");
    }
  });

  // ================================================================
  // 시나리오 C: gyeongju-003 — 운영자 자기 매물 투자 차단
  // 설정: 총 10개, deadline=30일
  //
  // 검증 내용:
  //   23. 매물 등록
  //   24. authority가 자기 매물에 open_position(허용) 후 purchase_tokens 시도
  //       → AuthorityCannotInvest 에러 (이해충돌 방지)
  // ================================================================

  it("23. initialize_property (gyeongju-003)", async () => {
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 30 * 24 * 3600);
    await program.methods
      .initializeProperty(listingId3, TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, deadline, MIN_FUNDING_BPS)
      .accounts({
        authority: authority.publicKey,
        propertyToken: propertyToken3,
        tokenMint: tokenMintKeypair3.publicKey,
        fundingVault: fundingVault3,
        usdcVault: usdcVault3,
        usdcMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, tokenMintKeypair3])
      .rpc();

    const account = await program.account.propertyToken.fetch(propertyToken3);
    assert.deepEqual(account.status, { funding: {} });
    console.log("    gyeongju-003 initialized");
  });

  it("24. purchase_tokens — authority가 자기 매물 투자 시도 → AuthorityCannotInvest 에러", async () => {
    // openPosition은 authority도 호출 가능하다 (InvestorPosition 계좌 생성만 함, 아직 구매 아님)
    // purchaseTokens에서 constraint로 차단: investor.key() != property_token.authority
    await program.methods
      .openPosition(listingId3)
      .accounts({
        investor: authority.publicKey,
        propertyToken: propertyToken3,
        investorPosition: authorityPosition3,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // 이제 authority로 purchaseTokens 시도 → AuthorityCannotInvest 에러
    try {
      await program.methods
        .purchaseTokens(listingId3, new anchor.BN(1))
        .accounts({
          investor: authority.publicKey,
          propertyToken: propertyToken3,
          tokenMint: tokenMintKeypair3.publicKey,
          investorPosition: authorityPosition3,
          investorUsdcAccount: authorityUsdcAccount,
          fundingVault: fundingVault3,
          investorRwaAccount: authorityRwaAccount3,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      assert.fail("AuthorityCannotInvest 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "AuthorityCannotInvest");
      console.log("    AuthorityCannotInvest 에러 정상 발생");
    }
  });

  // ================================================================
  // 시나리오 D: gyeongju-004 — 엣지 케이스 에러 처리
  // 설정: 총 10개, deadline=30일 (충분히 길게)
  //
  // 검증 내용:
  //   25. 매물 등록
  //   26. open_position 후 0개 구매 시도 → ZeroAmount 에러
  //   27. 1개 구매 후 deadline 미경과 상태에서 환불 요청 → RefundNotAvailable 에러
  //   28. open_position 중복 호출 → 계좌 이미 존재 에러 (재초기화 불가 확인)
  // ================================================================

  it("25. initialize_property (gyeongju-004, 30일 deadline)", async () => {
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 30 * 24 * 3600);
    await program.methods
      .initializeProperty(listingId4, TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, deadline, MIN_FUNDING_BPS)
      .accounts({
        authority: authority.publicKey,
        propertyToken: propertyToken4,
        tokenMint: tokenMintKeypair4.publicKey,
        fundingVault: fundingVault4,
        usdcVault: usdcVault4,
        usdcMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, tokenMintKeypair4])
      .rpc();

    const account = await program.account.propertyToken.fetch(propertyToken4);
    assert.deepEqual(account.status, { funding: {} });
    console.log("    gyeongju-004 initialized");
  });

  it("26. open_position (gyeongju-004) + purchase_tokens(0) — ZeroAmount 에러", async () => {
    await program.methods
      .openPosition(listingId4)
      .accounts({
        investor: investor.publicKey,
        propertyToken: propertyToken4,
        investorPosition: investorPosition4,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    try {
      await program.methods
        .purchaseTokens(listingId4, new anchor.BN(0))
        .accounts({
          investor: investor.publicKey,
          propertyToken: propertyToken4,
          tokenMint: tokenMintKeypair4.publicKey,
          investorPosition: investorPosition4,
          investorUsdcAccount,
          fundingVault: fundingVault4,
          investorRwaAccount: investorRwaAccount4,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("ZeroAmount 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "ZeroAmount");
      console.log("    ZeroAmount 에러 정상 발생");
    }
  });

  it("27. purchase_tokens(1) 성공 후 refund — deadline 미경과 → RefundNotAvailable 에러", async () => {
    await program.methods
      .purchaseTokens(listingId4, new anchor.BN(1))
      .accounts({
        investor: investor.publicKey,
        propertyToken: propertyToken4,
        tokenMint: tokenMintKeypair4.publicKey,
        investorPosition: investorPosition4,
        investorUsdcAccount,
        fundingVault: fundingVault4,
        investorRwaAccount: investorRwaAccount4,
        usdcMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    try {
      await program.methods
        .refund(listingId4)
        .accounts({
          investor: investor.publicKey,
          propertyToken: propertyToken4,
          investorPosition: investorPosition4,
          fundingVault: fundingVault4,
          investorUsdcAccount,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("RefundNotAvailable 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "RefundNotAvailable");
      console.log("    RefundNotAvailable 에러 정상 발생");
    }
  });

  it("28. open_position 중복 호출 — 실패", async () => {
    // Anchor의 init 제약: 이미 존재하는 PDA 주소로 다시 init을 시도하면
    // System Program이 "account already in use" 에러를 반환한다.
    // 이를 통해 재초기화 공격(동일 PDA를 덮어쓰는 공격)이 원천 차단된다.
    try {
      await program.methods
        .openPosition(listingId4)
        .accounts({
          investor: investor.publicKey,
          propertyToken: propertyToken4,
          investorPosition: investorPosition4,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("중복 open_position이 실패해야 함");
    } catch (e: any) {
      // 에러 메시지를 여러 패턴으로 검사하는 이유:
      // localnet 버전이나 Anchor 버전에 따라 메시지 표현이 다를 수 있음
      assert.isTrue(
        e.message.includes("already in use") || e.message.includes("0x0") || e.message.includes("custom program error"),
        `예상치 못한 에러: ${e.message}`
      );
      console.log("    open_position 중복 호출 정상 실패");
    }
  });

  // ================================================================
  // 추가 에러 케이스: deadline 및 release_funds 조건 검증
  //
  // 검증 내용:
  //   29. deadline=현재 시각 이전으로 매물 등록 시도 → InvalidDeadline 에러
  //   30. deadline 미경과 + 목표 미달 상태에서 release_funds 시도
  //       → ReleaseNotAvailable 에러 (gyeongju-003 재활용, tokens_sold=0)
  // ================================================================

  it("29. initialize_property — deadline이 현재 시각 이전 → InvalidDeadline 에러", async () => {
    const tempMint = Keypair.generate();
    const [tempPt] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from("past-deadline")],
      program.programId
    );
    const [tempVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from("past-deadline")],
      program.programId
    );
    const tempUsdcVault = getAssociatedTokenAddressSync(usdcMint, tempPt, true, TOKEN_PROGRAM_ID);
    const pastDeadline = new anchor.BN(Math.floor(Date.now() / 1000) - 1);

    try {
      await program.methods
        .initializeProperty("past-deadline", TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, pastDeadline, MIN_FUNDING_BPS)
        .accounts({
          authority: authority.publicKey,
          propertyToken: tempPt,
          tokenMint: tempMint.publicKey,
          fundingVault: tempVault,
          usdcVault: tempUsdcVault,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority, tempMint])
        .rpc();
      assert.fail("InvalidDeadline 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "InvalidDeadline");
      console.log("    InvalidDeadline 에러 정상 발생");
    }
  });

  it("30. release_funds — deadline 미경과 → FundingStillOpen 에러", async () => {
    // gyeongju-003: 30일 deadline, tokens_sold=0 (authority position만 있고 구매 없음)
    // deadline 미경과 시 FundingStillOpen이 먼저 체크됨
    try {
      await program.methods
        .releaseFunds(listingId3)
        .accounts({
          propertyToken: propertyToken3,
          operator: authority.publicKey,
          rwaConfig,
          fundingVault: fundingVault3,
          authorityUsdcAccount,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      assert.fail("FundingStillOpen 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "FundingStillOpen");
      console.log("    FundingStillOpen 에러 정상 발생 (deadline 미경과)");
    }
  });

  // ================================================================
  // 시나리오 E: gyeongju-005 — 목표 달성(완판 아님) + deadline 경과 → release_funds
  // 설정: 총 10개, deadline=3초, 6개 판매(60% = 목표치 정확히 달성)
  //
  // 검증 내용:
  //   31. 매물 등록 (deadline=3초)
  //   32. 6명이 1개씩 구매 → tokens_sold=6, status=Funding 유지 (완판 아님)
  //   33. 잔여(4개) 초과인 5개 구매 시도 → InsufficientTokenSupply 에러
  //   34. deadline 경과 후 release_funds → 6 USDC 수령, status=Funded, fundsReleased=true
  // ================================================================

  it("31. initialize_property (gyeongju-005, deadline = 15초 후)", async () => {
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 15);
    await program.methods
      .initializeProperty(listingId5, TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, deadline, MIN_FUNDING_BPS)
      .accounts({
        authority: authority.publicKey,
        propertyToken: propertyToken5,
        tokenMint: tokenMintKeypair5.publicKey,
        fundingVault: fundingVault5,
        usdcVault: usdcVault5,
        usdcMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, tokenMintKeypair5])
      .rpc();

    const account = await program.account.propertyToken.fetch(propertyToken5);
    assert.deepEqual(account.status, { funding: {} });
    console.log("    gyeongju-005 initialized, deadline = 15초 후");
  });

  it("32. purchase_tokens (gyeongju-005) — 6토큰 판매 (60% 달성)", async () => {
    for (let i = 0; i < 6; i++) {
      const kp = Keypair.generate();
      await fundAccount(kp.publicKey, 0.1 * LAMPORTS_PER_SOL);
      const kpUsdc = await createAssociatedTokenAccount(connection, authority, usdcMint, kp.publicKey);
      await mintTo(connection, authority, usdcMint, kpUsdc, authority, 5_000_000);

      const [kpPos] = PublicKey.findProgramAddressSync(
        [Buffer.from("investor"), propertyToken5.toBuffer(), kp.publicKey.toBuffer()],
        program.programId
      );
      const kpRwa = getAssociatedTokenAddressSync(
        tokenMintKeypair5.publicKey, kp.publicKey, false, TOKEN_2022_PROGRAM_ID
      );

      await program.methods
        .openPosition(listingId5)
        .accounts({
          investor: kp.publicKey,
          propertyToken: propertyToken5,
          investorPosition: kpPos,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([kp])
        .rpc();

      await program.methods
        .purchaseTokens(listingId5, new anchor.BN(1))
        .accounts({
          investor: kp.publicKey,
          propertyToken: propertyToken5,
          tokenMint: tokenMintKeypair5.publicKey,
          investorPosition: kpPos,
          investorUsdcAccount: kpUsdc,
          fundingVault: fundingVault5,
          investorRwaAccount: kpRwa,
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([kp])
        .rpc();
    }

    const property = await program.account.propertyToken.fetch(propertyToken5);
    assert.equal(property.tokensSold.toNumber(), 6);
    assert.deepEqual(property.status, { funding: {} }); // 60%지만 완판 아님
    console.log("    tokens_sold = 6/10 (60%), status = Funding");
  });

  it("33. purchase_tokens — 잔여 초과 구매 시도 → InsufficientTokenSupply 에러", async () => {
    // 현재 상태: tokens_sold=6, total_supply=10, 잔여=4
    // 5개 구매 시도: 잔여(4) < 요청(5) → InsufficientTokenSupply
    // 참고: 5개는 50%라 ExceedsInvestorCap(30%)도 위반하지만,
    //       lib.rs에서 공급량 부족을 먼저 체크하므로 InsufficientTokenSupply가 발생한다
    await program.methods
      .openPosition(listingId5)
      .accounts({
        investor: investor.publicKey,
        propertyToken: propertyToken5,
        investorPosition: investorPosition5,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    try {
      await program.methods
        .purchaseTokens(listingId5, new anchor.BN(5))
        .accounts({
          investor: investor.publicKey,
          propertyToken: propertyToken5,
          tokenMint: tokenMintKeypair5.publicKey,
          investorPosition: investorPosition5,
          investorUsdcAccount,
          fundingVault: fundingVault5,
          investorRwaAccount: getAssociatedTokenAddressSync(
            tokenMintKeypair5.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID
          ),
          usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("InsufficientTokenSupply 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "InsufficientTokenSupply");
      console.log("    InsufficientTokenSupply 에러 정상 발생");
    }
  });

  it("34. deadline 경과 + 60% 달성 → release_funds 성공 (Funding→Funded)", async () => {
    // 15초 deadline이 지나도록 16초 대기
    await sleep(16000); // deadline 대기

    const before = await connection.getTokenAccountBalance(authorityUsdcAccount);

    // release_funds 조건 (OR):
    //   1. 완판 (tokens_sold == total_supply) → 즉시 가능
    //   2. deadline 경과 + tokens_sold >= total_supply * min_funding_bps / 10000
    // 여기서는 조건 2: 3초 경과 + 6/10 = 60% >= min_funding_bps(60%)
    await program.methods
      .releaseFunds(listingId5)
      .accounts({
        propertyToken: propertyToken5,
        operator: authority.publicKey,
        rwaConfig,
        fundingVault: fundingVault5,
        authorityUsdcAccount,
        usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const after = await connection.getTokenAccountBalance(authorityUsdcAccount);
    const received = Number(after.value.amount) - Number(before.value.amount);
    // 6 USDC = 6_000_000 micro-USDC (6토큰 × 1 USDC)
    assert.equal(received, 6_000_000, "6토큰 × 1 USDC = 6 USDC 수령");

    const property = await program.account.propertyToken.fetch(propertyToken5);
    // status가 Funded로 전환됐는지, funds_released 플래그가 true인지 확인
    // (funds_released=true → 이후 재호출 시 FundsAlreadyReleased 에러)
    assert.deepEqual(property.status, { funded: {} });
    assert.isTrue(property.fundsReleased);
    console.log("    수령:", received / 1_000_000, "USDC, status = Funded, fundsReleased = true");
  });

  // -------------------------------------------------------
  // 35. NonTransferable — RWA 토큰 전송 차단 확인
  // -------------------------------------------------------
  it("35. NonTransferable — RWA 토큰 다른 지갑으로 전송 시도 → 실패", async () => {
    // investor가 gyeongju-004에서 1토큰 보유 중 (테스트 27에서 구매)
    // 새 지갑에 ATA를 만들고 전송 시도 → NonTransferable 에러 확인
    const recipient = Keypair.generate();
    await fundAccount(recipient.publicKey, 0.1 * LAMPORTS_PER_SOL);

    const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
    const recipientRwa = getAssociatedTokenAddressSync(
      tokenMintKeypair4.publicKey, recipient.publicKey, false, TOKEN_2022_PROGRAM_ID
    );

    // 수신자 ATA 생성
    const createAtaIx = createAssociatedTokenAccountInstruction(
      investor.publicKey,
      recipientRwa,
      recipient.publicKey,
      tokenMintKeypair4.publicKey,
      TOKEN_2022_PROGRAM_ID,
    );

    const { createTransferCheckedInstruction } = await import("@solana/spl-token");
    const investorRwa4 = getAssociatedTokenAddressSync(
      tokenMintKeypair4.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID
    );
    const transferIx = createTransferCheckedInstruction(
      investorRwa4,
      tokenMintKeypair4.publicKey,
      recipientRwa,
      investor.publicKey,
      1,  // 1토큰
      0,  // decimals
      [],
      TOKEN_2022_PROGRAM_ID,
    );

    const tx = new anchor.web3.Transaction().add(createAtaIx, transferIx);
    try {
      await provider.sendAndConfirm(tx, [investor]);
      assert.fail("NonTransferable 토큰 전송이 성공하면 안 됨");
    } catch (err: any) {
      // Token-2022 NonTransferable extension에 의해 전송 시뮬레이션 실패
      assert.include(err.toString(), "Simulation failed");
      console.log("    NonTransferable 전송 차단 정상 확인");
    }
  });

  // ===============================================================
  // Crank Authority 테스트
  // ===============================================================

  const crankKeypair = Keypair.generate();

  it("36. set_crank_authority -- authority가 crank 등록 성공", async () => {
    await fundAccount(crankKeypair.publicKey, 0.1 * LAMPORTS_PER_SOL);

    await program.methods
      .setCrankAuthority(crankKeypair.publicKey)
      .accounts({
        rwaConfig,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    const config = await program.account.rwaConfig.fetch(rwaConfig);
    assert.equal(config.crankAuthority.toBase58(), crankKeypair.publicKey.toBase58());
    console.log("    crank_authority 등록:", crankKeypair.publicKey.toBase58().slice(0, 16) + "...");
  });

  it("37. set_crank_authority -- 비권한자 실패", async () => {
    try {
      await program.methods
        .setCrankAuthority(investor.publicKey)
        .accounts({
          rwaConfig,
          authority: investor.publicKey,
        })
        .signers([investor])
        .rpc();
      assert.fail("비권한자가 crank 설정에 성공하면 안 됨");
    } catch (e: any) {
      // rwaConfig.authority != investor → has_one constraint 실패
      // Anchor ConstraintHasOne = 2000, 또는 커스텀 Unauthorized 에러
      assert.isTrue(
        e.toString().includes("Unauthorized") ||
        e.toString().includes("ConstraintHasOne") ||
        e.toString().includes("2000"),
        `예상치 못한 에러: ${e.toString()}`
      );
      console.log("    비권한자 crank 설정 차단 확인");
    }
  });

  it("38. crank으로 release_funds 성공 (시나리오 E 매물)", async () => {
    // listingId5는 이미 release_funds 되었으므로, 새 매물을 생성하여 crank 테스트
    const listingCrank = "crank-test-001";
    const tokenMintCrank = Keypair.generate();
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 3);

    const [ptCrank] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingCrank)], program.programId
    );
    const [fvCrank] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from(listingCrank)], program.programId
    );
    const uvCrank = getAssociatedTokenAddressSync(usdcMint, ptCrank, true, TOKEN_PROGRAM_ID);

    await program.methods
      .initializeProperty(listingCrank, new anchor.BN(10), VALUATION_KRW, PRICE_PER_TOKEN, deadline, 1000)
      .accounts({
        authority: authority.publicKey,
        propertyToken: ptCrank,
        tokenMint: tokenMintCrank.publicKey,
        fundingVault: fvCrank,
        usdcVault: uvCrank,
        usdcMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, tokenMintCrank])
      .rpc();

    // investor 2토큰 구매 (20% >= min 10%)
    const [posCrank] = PublicKey.findProgramAddressSync(
      [Buffer.from("investor"), ptCrank.toBuffer(), investor.publicKey.toBuffer()], program.programId
    );
    await program.methods.openPosition(listingCrank)
      .accounts({ investor: investor.publicKey, propertyToken: ptCrank, investorPosition: posCrank, systemProgram: anchor.web3.SystemProgram.programId })
      .signers([investor]).rpc();

    const investorRwaCrank = getAssociatedTokenAddressSync(tokenMintCrank.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID);
    await program.methods.purchaseTokens(listingCrank, new anchor.BN(2))
      .accounts({
        investor: investor.publicKey, propertyToken: ptCrank, investorPosition: posCrank,
        tokenMint: tokenMintCrank.publicKey, investorUsdcAccount, fundingVault: fvCrank,
        investorRwaAccount: investorRwaCrank, usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID, tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor]).rpc();

    // deadline 대기
    await sleep(4000);

    // crank이 release_funds 호출
    await program.methods
      .releaseFunds(listingCrank)
      .accounts({
        propertyToken: ptCrank,
        operator: crankKeypair.publicKey,
        rwaConfig,
        fundingVault: fvCrank,
        authorityUsdcAccount,
        usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([crankKeypair])
      .rpc();

    const property = await program.account.propertyToken.fetch(ptCrank);
    assert.deepEqual(property.status, { funded: {} });
    assert.isTrue(property.fundsReleased);
    console.log("    crank release_funds 성공: status=Funded");
  });

  it("39. crank으로 activate_property 성공", async () => {
    const listingCrank = "crank-test-001";
    const [ptCrank] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingCrank)], program.programId
    );
    // tokenMint 주소를 온체인에서 가져옴
    const ptData = await program.account.propertyToken.fetch(ptCrank);

    await program.methods
      .activateProperty(listingCrank)
      .accounts({
        propertyToken: ptCrank,
        operator: crankKeypair.publicKey,
        rwaConfig,
        tokenMint: ptData.tokenMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([crankKeypair])
      .rpc();

    const property = await program.account.propertyToken.fetch(ptCrank);
    assert.deepEqual(property.status, { active: {} });
    console.log("    crank activate_property 성공: status=Active");
  });

  it("40. 랜덤 키로 release_funds 실패 (Unauthorized)", async () => {
    // 새 매물 생성
    const listingUnauth = "unauth-test-001";
    const tokenMintUnauth = Keypair.generate();
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 3);
    const randomKey = Keypair.generate();
    await fundAccount(randomKey.publicKey, 0.1 * LAMPORTS_PER_SOL);

    const [ptU] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingUnauth)], program.programId
    );
    const [fvU] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from(listingUnauth)], program.programId
    );
    const uvU = getAssociatedTokenAddressSync(usdcMint, ptU, true, TOKEN_PROGRAM_ID);

    await program.methods
      .initializeProperty(listingUnauth, new anchor.BN(10), VALUATION_KRW, PRICE_PER_TOKEN, deadline, 1000)
      .accounts({
        authority: authority.publicKey, propertyToken: ptU, tokenMint: tokenMintUnauth.publicKey,
        fundingVault: fvU, usdcVault: uvU, usdcMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID, usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, tokenMintUnauth]).rpc();

    // investor 2토큰 구매
    const [posU] = PublicKey.findProgramAddressSync(
      [Buffer.from("investor"), ptU.toBuffer(), investor.publicKey.toBuffer()], program.programId
    );
    await program.methods.openPosition(listingUnauth)
      .accounts({ investor: investor.publicKey, propertyToken: ptU, investorPosition: posU, systemProgram: anchor.web3.SystemProgram.programId })
      .signers([investor]).rpc();

    const investorRwaU = getAssociatedTokenAddressSync(tokenMintUnauth.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID);
    await program.methods.purchaseTokens(listingUnauth, new anchor.BN(2))
      .accounts({
        investor: investor.publicKey, propertyToken: ptU, investorPosition: posU,
        tokenMint: tokenMintUnauth.publicKey, investorUsdcAccount, fundingVault: fvU,
        investorRwaAccount: investorRwaU, usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID, tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor]).rpc();

    await sleep(4000);

    try {
      await program.methods
        .releaseFunds(listingUnauth)
        .accounts({
          propertyToken: ptU,
          operator: randomKey.publicKey,
          rwaConfig,
          fundingVault: fvU,
          authorityUsdcAccount,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([randomKey])
        .rpc();
      assert.fail("랜덤 키로 release_funds가 성공하면 안 됨");
    } catch (e: any) {
      assert.include(e.message, "Unauthorized");
      console.log("    랜덤 키 release_funds 차단: Unauthorized");
    }
  });

  it("41. crank으로 distribute_monthly_revenue 실패 (has_one = authority)", async () => {
    // distribute_monthly_revenue는 authority만 가능
    try {
      await program.methods
        .distributeMonthlyRevenue(listingId, new anchor.BN(1_000_000))
        .accounts({
          propertyToken,
          authority: crankKeypair.publicKey,
          authorityUsdcAccount,
          usdcVault,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([crankKeypair])
        .rpc();
      assert.fail("crank으로 distribute가 성공하면 안 됨");
    } catch (e: any) {
      // propertyToken.authority != crankKeypair → has_one = authority constraint 실패
      // Anchor ConstraintHasOne = 2000
      assert.isTrue(
        e.toString().includes("ConstraintHasOne") ||
        e.toString().includes("2000") ||
        e.toString().includes("has_one"),
        `예상치 못한 에러: ${e.toString()}`
      );
      console.log("    crank distribute_monthly_revenue 차단 확인");
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 시나리오 F: BookingEscrow — 예약 에스크로 생성 및 취소 정책
  // ═══════════════════════════════════════════════════════════

  it("F-1. create_booking_escrow — 게스트 USDC → 에스크로 볼트 이체", async () => {
    const guestBefore = BigInt((await connection.getTokenAccountBalance(guestUsdcAccount)).value.amount);

    const checkIn  = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 10); // 10일 후
    const checkOut = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 12); // 12일 후

    await (program.methods as any)
      .createBookingEscrow(listingIdF, bookingId.replace(/-/g, ""), ESCROW_AMOUNT_KRW, checkIn, checkOut)
      .accounts({
        guest: guest.publicKey,
        guestUsdc: guestUsdcAccount,
        bookingEscrow: bookingEscrowPda,
        escrowVault,
        usdcMint,
        // skip-oracle 모드에서도 IDL이 계좌를 요구 → 더미 pubkey 전달 (검증 우회됨)
        pythPriceFeed: anchor.web3.SystemProgram.programId,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([guest])
      .rpc();

    const guestAfter = BigInt((await connection.getTokenAccountBalance(guestUsdcAccount)).value.amount);
    const vaultAfter = BigInt((await connection.getTokenAccountBalance(escrowVault)).value.amount);

    // 게스트 잔액 감소, 에스크로 볼트 증가
    assert.isTrue(guestBefore > guestAfter, "게스트 USDC 감소 확인");
    assert.isTrue(vaultAfter > 0n, "에스크로 볼트에 USDC 입금 확인");
    // skip-oracle: 100_000 KRW / 1350 = 74.07 USDC → 74_074_074 micro-USDC (floor)
    assert.equal(vaultAfter, 74_074_074n, "74,074,074 micro-USDC (floor)");

    const escrowAccount = await (program.account as any).bookingEscrow.fetch(bookingEscrowPda);
    assert.equal(escrowAccount.status.pending !== undefined, true, "status = Pending");
    assert.equal(escrowAccount.guest.toBase58(), guest.publicKey.toBase58());
    console.log("    에스크로 생성 완료, 볼트 잔액:", vaultAfter.toString(), "micro-USDC");
  });

  it("F-2. cancel_booking_escrow — 100% 환불 (체크인 전, 게스트 본인 호출)", async () => {
    // F-1과 별개의 bookingId2 사용
    const checkIn  = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14); // 14일 후
    const checkOut = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 16);

    await (program.methods as any)
      .createBookingEscrow(listingIdF, bookingId2.replace(/-/g, ""), ESCROW_AMOUNT_KRW, checkIn, checkOut)
      .accounts({
        guest: guest.publicKey,
        guestUsdc: guestUsdcAccount,
        bookingEscrow: bookingEscrowPda2,
        escrowVault: escrowVault2,
        usdcMint,
        pythPriceFeed: anchor.web3.SystemProgram.programId,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([guest])
      .rpc();

    const guestBefore = BigInt((await connection.getTokenAccountBalance(guestUsdcAccount)).value.amount);
    const vaultBefore = BigInt((await connection.getTokenAccountBalance(escrowVault2)).value.amount);

    // 게스트 본인이 취소 (체크인 전이므로 허용)
    await (program.methods as any)
      .cancelBookingEscrow(bookingId2.replace(/-/g, ""))
      .accounts({
        caller: guest.publicKey,
        bookingEscrow: bookingEscrowPda2,
        escrowVault: escrowVault2,
        guestUsdc: guestUsdcAccount,
        rwaConfig,
        usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([guest])
      .rpc();

    const guestAfter = BigInt((await connection.getTokenAccountBalance(guestUsdcAccount)).value.amount);
    const refunded = guestAfter - guestBefore;

    assert.equal(refunded, vaultBefore, "100% 환불 확인: 볼트 전액 반환");

    const escrowAccount = await (program.account as any).bookingEscrow.fetch(bookingEscrowPda2);
    assert.equal(escrowAccount.status.refunded !== undefined, true, "status = Refunded");
    console.log("    100% 환불 완료, 환불액:", refunded.toString(), "micro-USDC");
  });

  it("F-3. cancel_booking_escrow_partial — 50% 게스트 환불, 50% listing_vault 귀속", async () => {
    // F-1의 bookingEscrowPda 재사용 (이미 생성됨, status=Pending)
    const vaultBefore      = BigInt((await connection.getTokenAccountBalance(escrowVault)).value.amount);
    const guestBefore      = BigInt((await connection.getTokenAccountBalance(guestUsdcAccount)).value.amount);
    const listingVaultBefore = BigInt((await connection.getTokenAccountBalance(listingVaultAtaF)).value.amount);

    await (program.methods as any)
      .cancelBookingEscrowPartial(bookingId.replace(/-/g, ""), 5000)
      .accounts({
        caller: authority.publicKey,
        bookingEscrow: bookingEscrowPda,
        escrowVault,
        guestUsdc: guestUsdcAccount,
        listingVault: listingVaultF,
        listingVaultAta: listingVaultAtaF,
        rwaConfig,
        usdcMint,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    const guestAfter        = BigInt((await connection.getTokenAccountBalance(guestUsdcAccount)).value.amount);
    const listingVaultAfter = BigInt((await connection.getTokenAccountBalance(listingVaultAtaF)).value.amount);

    const guestReceived  = guestAfter - guestBefore;
    const vaultReceived  = listingVaultAfter - listingVaultBefore;

    assert.equal(guestReceived + vaultReceived, vaultBefore, "총합 = 볼트 전액");
    const diff = guestReceived > vaultReceived ? guestReceived - vaultReceived : vaultReceived - guestReceived;
    assert.isTrue(diff <= 1n, "게스트/listing_vault 각 50% (±1 micro-USDC 오차 허용)");

    const escrowAccount = await (program.account as any).bookingEscrow.fetch(bookingEscrowPda);
    assert.equal(escrowAccount.status.refunded !== undefined, true, "status = Refunded");
    console.log(`    50% 분배 — 게스트: ${guestReceived}, listing_vault: ${vaultReceived} micro-USDC`);
  });

  it("F-4. cancel_booking_escrow_partial — bps=0 → InvalidRefundBps 에러", async () => {
    // bookingId3 새로 생성
    const checkIn  = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 5);
    const checkOut = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7);

    await (program.methods as any)
      .createBookingEscrow(listingIdF, bookingId3.replace(/-/g, ""), ESCROW_AMOUNT_KRW, checkIn, checkOut)
      .accounts({
        guest: guest.publicKey,
        guestUsdc: guestUsdcAccount,
        bookingEscrow: bookingEscrowPda3,
        escrowVault: escrowVault3,
        usdcMint,
        pythPriceFeed: anchor.web3.SystemProgram.programId,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([guest])
      .rpc();

    try {
      await (program.methods as any)
        .cancelBookingEscrowPartial(bookingId3.replace(/-/g, ""), 0) // bps=0 → 에러
        .accounts({
          caller: authority.publicKey,
          bookingEscrow: bookingEscrowPda3,
          escrowVault: escrowVault3,
          guestUsdc: guestUsdcAccount,
          listingVault: listingVaultF,
          listingVaultAta: listingVaultAtaF,
          rwaConfig,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
      assert.fail("bps=0 시 에러가 발생해야 함");
    } catch (err: any) {
      assert.include(err.toString(), "InvalidRefundBps");
      console.log("    bps=0 → InvalidRefundBps 정상 차단");
    }
  });

  it("F-5. cancel_booking_escrow_partial — bps=10000 → InvalidRefundBps 에러", async () => {
    try {
      await (program.methods as any)
        .cancelBookingEscrowPartial(bookingId3.replace(/-/g, ""), 10000) // bps=10000 → 에러
        .accounts({
          caller: authority.publicKey,
          bookingEscrow: bookingEscrowPda3,
          escrowVault: escrowVault3,
          guestUsdc: guestUsdcAccount,
          listingVault: listingVaultF,
          listingVaultAta: listingVaultAtaF,
          rwaConfig,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
      assert.fail("bps=10000 시 에러가 발생해야 함");
    } catch (err: any) {
      assert.include(err.toString(), "InvalidRefundBps");
      console.log("    bps=10000 → InvalidRefundBps 정상 차단");
    }
  });

  it("F-6. cancel_booking_escrow_partial — 비권한자 호출 → 에러", async () => {
    const stranger = Keypair.generate();
    await fundAccount(stranger.publicKey, 0.1 * LAMPORTS_PER_SOL);

    try {
      await (program.methods as any)
        .cancelBookingEscrowPartial(bookingId3.replace(/-/g, ""), 5000)
        .accounts({
          caller: stranger.publicKey,
          bookingEscrow: bookingEscrowPda3,
          escrowVault: escrowVault3,
          guestUsdc: guestUsdcAccount,
          listingVault: listingVaultF,
          listingVaultAta: listingVaultAtaF,
          rwaConfig,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      assert.fail("비권한자 호출이 성공하면 안 됨");
    } catch (err: any) {
      // Anchor constraint 또는 Unauthorized 에러
      assert.isTrue(
        err.toString().includes("Unauthorized") || err.toString().includes("ConstraintRaw") || err.toString().includes("2003"),
        "비권한자 접근 차단 확인"
      );
      console.log("    비권한자 → 접근 차단 정상 확인");
    }
  });

  // =====================================================
  // 시나리오 G: settle_listing_monthly (월정산 배분)
  // 목표: listing_vault 잔액의 40/30/30 배분 및 에러 처리 검증
  // 전제: 시나리오 A (gyeongju-001)이 Active 상태로 완료된 후 실행
  // =====================================================
  describe("G: settle_listing_monthly", () => {
    const listingIdG = "gyeongju-001"; // 시나리오 A의 Active propertyToken 재사용

    let listingVaultG: PublicKey;
    let listingVaultAtaG: PublicKey;
    let govKey: Keypair;
    let govUsdcAccount: PublicKey;
    let operatorUser: Keypair;
    let operatorUsdcAccount: PublicKey;

    const VAULT_AMOUNT = 1_000_000; // 1 USDC

    before(async () => {
      govKey = Keypair.generate();
      operatorUser = Keypair.generate();
      await fundAccount(govKey.publicKey, 0.1 * LAMPORTS_PER_SOL);
      await fundAccount(operatorUser.publicKey, 0.1 * LAMPORTS_PER_SOL);

      [listingVaultG] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing_vault"), Buffer.from(listingIdG)],
        program.programId
      );
      listingVaultAtaG = getAssociatedTokenAddressSync(usdcMint, listingVaultG, true, TOKEN_PROGRAM_ID);

      govUsdcAccount = await createAssociatedTokenAccount(
        connection, govKey, usdcMint, govKey.publicKey
      );
      operatorUsdcAccount = await createAssociatedTokenAccount(
        connection, operatorUser, usdcMint, operatorUser.publicKey
      );

      try {
        await program.methods
          .initializeListingVault(listingIdG)
          .accounts({
            authority: authority.publicKey,
            rwaConfig,
            listingVault: listingVaultG,
            listingVaultAta: listingVaultAtaG,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
      } catch (err: any) {
        if (!err.toString().includes("already in use") && !err.toString().includes("0x0")) {
          throw err;
        }
      }

      // listing_vault_ata에 USDC 직접 충전 (예약 수익 시뮬레이션)
      await mintTo(connection, authority, usdcMint, listingVaultAtaG, authority, VAULT_AMOUNT);
    });

    it("G-1. 정상 분배 — authority 호출, 운영비 100_000 차감 후 40/30/30", async () => {
      const OPERATING_COST = 100_000; // 0.1 USDC
      const PROFIT = VAULT_AMOUNT - OPERATING_COST; // 900_000
      const GOV_EXPECTED    = Math.floor(PROFIT * 4000 / 10_000); // 360_000
      const OPERATOR_EXPECTED = Math.floor(PROFIT * 3000 / 10_000); // 270_000
      const INVESTOR_EXPECTED = PROFIT - GOV_EXPECTED - OPERATOR_EXPECTED; // 270_000

      const usdcVaultBefore = Number((await connection.getTokenAccountBalance(usdcVault)).value.amount);

      await program.methods
        .settleListingMonthly(listingIdG, 202501, new anchor.BN(OPERATING_COST), 4000, 3000, 3000)
        .accounts({
          operator: authority.publicKey,
          rwaConfig,
          listingVault: listingVaultG,
          listingVaultAta: listingVaultAtaG,
          propertyToken,
          govUsdc: govUsdcAccount,
          operatorUsdc: operatorUsdcAccount,
          usdcVault,
          authorityUsdc: authorityUsdcAccount,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      const govBalance      = Number((await connection.getTokenAccountBalance(govUsdcAccount)).value.amount);
      const operatorBalance = Number((await connection.getTokenAccountBalance(operatorUsdcAccount)).value.amount);
      const usdcVaultAfter  = Number((await connection.getTokenAccountBalance(usdcVault)).value.amount);
      const vaultBalance    = Number((await connection.getTokenAccountBalance(listingVaultAtaG)).value.amount);

      assert.equal(govBalance, GOV_EXPECTED, "지자체 40% 수령 확인");
      assert.equal(operatorBalance, OPERATOR_EXPECTED, "운영자 30% 수령 확인");
      assert.equal(usdcVaultAfter - usdcVaultBefore, INVESTOR_EXPECTED, "투자자 배당풀 30% 입금 확인");
      assert.equal(vaultBalance, 0, "listing_vault 잔액 소진 확인");
      console.log(`    분배 완료: gov=${GOV_EXPECTED}, op=${OPERATOR_EXPECTED}, inv=${INVESTOR_EXPECTED}`);
    });

    it("G-2. AlreadySettled — 같은 달(202501) 재호출 차단", async () => {
      try {
        await program.methods
          .settleListingMonthly(listingIdG, 202501, new anchor.BN(0), 4000, 3000, 3000)
          .accounts({
            operator: authority.publicKey,
            rwaConfig,
            listingVault: listingVaultG,
            listingVaultAta: listingVaultAtaG,
            propertyToken,
            govUsdc: govUsdcAccount,
            operatorUsdc: operatorUsdcAccount,
            usdcVault,
            authorityUsdc: authorityUsdcAccount,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();
        assert.fail("AlreadySettled 에러가 발생해야 함");
      } catch (err: any) {
        assert.include(err.toString(), "AlreadySettled");
        console.log("    같은 달 재호출 → AlreadySettled 정상 차단");
      }
    });

    it("G-3. InsufficientVaultBalance — 운영비 > 잔액(0)", async () => {
      try {
        await program.methods
          .settleListingMonthly(listingIdG, 202502, new anchor.BN(1), 4000, 3000, 3000)
          .accounts({
            operator: authority.publicKey,
            rwaConfig,
            listingVault: listingVaultG,
            listingVaultAta: listingVaultAtaG,
            propertyToken,
            govUsdc: govUsdcAccount,
            operatorUsdc: operatorUsdcAccount,
            usdcVault,
            authorityUsdc: authorityUsdcAccount,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();
        assert.fail("InsufficientVaultBalance 에러가 발생해야 함");
      } catch (err: any) {
        assert.include(err.toString(), "InsufficientVaultBalance");
        console.log("    운영비 > 잔액 → InsufficientVaultBalance 정상 차단");
      }
    });

    it("G-4. Unauthorized — 무관한 서명자 호출 차단", async () => {
      const stranger = Keypair.generate();
      await fundAccount(stranger.publicKey, 0.1 * LAMPORTS_PER_SOL);

      try {
        await program.methods
          .settleListingMonthly(listingIdG, 202502, new anchor.BN(0), 4000, 3000, 3000)
          .accounts({
            operator: stranger.publicKey,
            rwaConfig,
            listingVault: listingVaultG,
            listingVaultAta: listingVaultAtaG,
            propertyToken,
            govUsdc: govUsdcAccount,
            operatorUsdc: operatorUsdcAccount,
            usdcVault,
            authorityUsdc: authorityUsdcAccount,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([stranger])
          .rpc();
        assert.fail("Unauthorized 에러가 발생해야 함");
      } catch (err: any) {
        assert.include(err.toString(), "Unauthorized");
        console.log("    무관한 서명자 → Unauthorized 정상 차단");
      }
    });

    it("G-5. InvalidBpsSum — bps 합계 != 10000 차단", async () => {
      try {
        await program.methods
          .settleListingMonthly(listingIdG, 202502, new anchor.BN(0), 4000, 3000, 2999) // 합계 9999
          .accounts({
            operator: authority.publicKey,
            rwaConfig,
            listingVault: listingVaultG,
            listingVaultAta: listingVaultAtaG,
            propertyToken,
            govUsdc: govUsdcAccount,
            operatorUsdc: operatorUsdcAccount,
            usdcVault,
            authorityUsdc: authorityUsdcAccount,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();
        assert.fail("InvalidBpsSum 에러가 발생해야 함");
      } catch (err: any) {
        assert.include(err.toString(), "InvalidBpsSum");
        console.log("    bps 합계 9999 → InvalidBpsSum 정상 차단");
      }
    });
  });
});
