use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    burn, mint_to, set_authority, transfer_checked,
    spl_token_2022::{
        self,
        extension::ExtensionType,
        instruction::AuthorityType,
    },
    Burn, Mint, MintTo, SetAuthority, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR");

const PRECISION: u128 = 1_000_000_000_000; // 1e12 (u64 overflow 방지, USDC 6자리 정밀도)

// =====================
// 에러 코드
// =====================
#[error_code]
pub enum RwaError {
    #[msg("Insufficient token supply remaining.")]
    InsufficientTokenSupply,        // 6000
    #[msg("Exceeds individual investor cap (30%).")]
    ExceedsInvestorCap,             // 6001
    #[msg("Math overflow.")]
    MathOverflow,                   // 6002
    #[msg("No pending dividend to claim.")]
    NoPendingDividend,              // 6003
    #[msg("Unauthorized.")]
    Unauthorized,                   // 6004
    #[msg("Invalid property status for this operation.")]
    InvalidStatus,                  // 6005
    #[msg("Funding deadline has passed.")]
    FundingExpired,                 // 6006
    #[msg("Refund conditions not met: goal was reached or deadline has not passed.")]
    RefundNotAvailable,             // 6007
    #[msg("This position has already been refunded.")]
    AlreadyRefunded,                // 6008
    #[msg("Deadline must be in the future.")]
    InvalidDeadline,                // 6009
    #[msg("Release conditions not met: not sold out and deadline not passed or goal not reached.")]
    ReleaseNotAvailable,            // 6010
    #[msg("The property authority cannot invest in their own property.")]
    AuthorityCannotInvest,          // 6011
    #[msg("Amount must be greater than zero.")]
    ZeroAmount,                     // 6012
    #[msg("Revenue must be greater than zero.")]
    ZeroRevenue,                    // 6013
    #[msg("Funds have already been released.")]
    FundsAlreadyReleased,           // 6014
    #[msg("Invalid funding bps: must be between 1 and 10000.")]
    InvalidFundingBps,              // 6015
    #[msg("Invalid price: must be greater than zero.")]
    InvalidPrice,                   // 6016
    #[msg("Deadline too far in the future (max 365 days).")]
    DeadlineTooFar,                 // 6017
    #[msg("Funding period is still open. Wait until deadline passes.")]
    FundingStillOpen,               // 6018
}

// =====================
// 상태 전환
// =====================
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum PropertyStatus {
    Funding, // 토큰 판매 중
    Funded,  // 완판 (구매 불가)
    Active,  // 숙박 운영 중 (배당 발생)
    Failed,  // 기간 종료 + 최소 판매율 미달 (환불 가능)
}

// =====================
// 상태 계정
// =====================
#[account]
#[derive(InitSpace)]
pub struct PropertyToken {
    pub authority: Pubkey,
    #[max_len(32)]
    pub listing_id: String,
    pub token_mint: Pubkey,
    pub usdc_mint: Pubkey,              // 가짜 mint 주입 방지용 저장
    pub total_supply: u64,
    pub tokens_sold: u64,
    pub valuation_krw: u64,             // 부동산 평가액 (KRW)
    pub price_per_token_usdc: u64,      // 토큰 1개당 가격 (micro-USDC, 1e-6)
    pub acc_dividend_per_share: u128,   // 누적 배당 per token (PRECISION 단위, 단조 증가)
    pub status: PropertyStatus,
    pub funding_deadline: i64,          // Unix timestamp
    pub min_funding_bps: u16,           // 최소 판매율 basis points (6000 = 60%)
    pub funds_released: bool,           // release_funds 중복 호출 방지
    pub funding_vault_bump: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct InvestorPosition {
    pub owner: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub reward_debt: u128,
    pub bump: u8,
}

// =====================
// initialize_property
// =====================
#[derive(Accounts)]
#[instruction(listing_id: String)]
pub struct InitializeProperty<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + PropertyToken::INIT_SPACE,
        seeds = [b"property", listing_id.as_bytes()],
        bump,
    )]
    pub property_token: Account<'info, PropertyToken>,

    // NonTransferable extension 적용을 위해 수동 초기화 (Anchor init은 이 extension 미지원)
    // 순서: create_account → initialize_non_transferable_mint → initialize_mint2
    #[account(mut)]
    pub token_mint: Signer<'info>,

    // 구매대금 에스크로 볼트 (펀딩 기간 동안 USDC 보관)
    #[account(
        init,
        payer = authority,
        seeds = [b"funding_vault", listing_id.as_bytes()],
        bump,
        token::mint = usdc_mint,
        token::authority = property_token,
        token::token_program = usdc_token_program,
    )]
    pub funding_vault: InterfaceAccount<'info, TokenAccount>,

    // 배당금 보관 USDC 볼트 (Active 상태에서 사용)
    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = property_token,
        associated_token::token_program = usdc_token_program,
    )]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,        // Token-2022 (RWA 민트용)
    pub usdc_token_program: Interface<'info, TokenInterface>,   // 표준 SPL Token (USDC용)
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// =====================
// open_position
// =====================
// investor_position을 최초 1회 생성하는 전용 instruction.
// purchase_tokens에서 init_if_needed를 제거하기 위해 분리 (재초기화 공격 방지).
#[derive(Accounts)]
#[instruction(listing_id: String)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        seeds = [b"property", listing_id.as_bytes()],
        bump = property_token.bump,
    )]
    pub property_token: Account<'info, PropertyToken>,

    #[account(
        init,
        payer = investor,
        space = 8 + InvestorPosition::INIT_SPACE,
        seeds = [b"investor", property_token.key().as_ref(), investor.key().as_ref()],
        bump,
    )]
    pub investor_position: Account<'info, InvestorPosition>,

    pub system_program: Program<'info, System>,
}

// =====================
// purchase_tokens
// =====================
#[derive(Accounts)]
#[instruction(listing_id: String)]
pub struct PurchaseTokens<'info> {
    #[account(
        mut,
        constraint = investor.key() != property_token.authority @ RwaError::AuthorityCannotInvest,
    )]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"property", listing_id.as_bytes()],
        bump = property_token.bump,
    )]
    pub property_token: Account<'info, PropertyToken>,

    #[account(mut, address = property_token.token_mint)]
    pub token_mint: InterfaceAccount<'info, Mint>,

    // open_position으로 사전 생성 필수 (init 없음)
    #[account(
        mut,
        seeds = [b"investor", property_token.key().as_ref(), investor.key().as_ref()],
        bump = investor_position.bump,
        constraint = investor_position.owner == investor.key() @ RwaError::Unauthorized,
        constraint = investor_position.token_mint == property_token.token_mint @ RwaError::Unauthorized,
    )]
    pub investor_position: Account<'info, InvestorPosition>,

    // 투자자 USDC 계좌 (결제 출처)
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = investor,
        token::token_program = usdc_token_program,
    )]
    pub investor_usdc_account: InterfaceAccount<'info, TokenAccount>,

    // 에스크로 볼트 (USDC 수령, 펀딩 성공 전까지 보관)
    #[account(
        mut,
        seeds = [b"funding_vault", listing_id.as_bytes()],
        bump = property_token.funding_vault_bump,
        token::mint = usdc_mint,
        token::authority = property_token,
        token::token_program = usdc_token_program,
    )]
    pub funding_vault: InterfaceAccount<'info, TokenAccount>,

    // ATA에 대한 init_if_needed는 PDA가 결정론적이므로 재초기화 공격 불가 (안전)
    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = token_mint,
        associated_token::authority = investor,
        associated_token::token_program = token_program,
    )]
    pub investor_rwa_account: InterfaceAccount<'info, TokenAccount>,

    #[account(address = property_token.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,        // Token-2022 (RWA 민트용)
    pub usdc_token_program: Interface<'info, TokenInterface>,   // 표준 SPL Token (USDC용)
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// =====================
// release_funds
// =====================
#[derive(Accounts)]
#[instruction(listing_id: String)]
pub struct ReleaseFunds<'info> {
    #[account(
        mut,
        seeds = [b"property", listing_id.as_bytes()],
        bump = property_token.bump,
        has_one = authority,
    )]
    pub property_token: Account<'info, PropertyToken>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"funding_vault", listing_id.as_bytes()],
        bump = property_token.funding_vault_bump,
        token::mint = usdc_mint,
        token::authority = property_token,
        token::token_program = usdc_token_program,
    )]
    pub funding_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = authority,
        token::token_program = usdc_token_program,
    )]
    pub authority_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(address = property_token.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub usdc_token_program: Interface<'info, TokenInterface>,   // 표준 SPL Token (USDC용)
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// =====================
// refund
// =====================
#[derive(Accounts)]
#[instruction(listing_id: String)]
pub struct Refund<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"property", listing_id.as_bytes()],
        bump = property_token.bump,
    )]
    pub property_token: Account<'info, PropertyToken>,

    #[account(
        mut,
        seeds = [b"investor", property_token.key().as_ref(), investor.key().as_ref()],
        bump = investor_position.bump,
        constraint = investor_position.owner == investor.key() @ RwaError::Unauthorized,
    )]
    pub investor_position: Account<'info, InvestorPosition>,

    #[account(
        mut,
        seeds = [b"funding_vault", listing_id.as_bytes()],
        bump = property_token.funding_vault_bump,
        token::mint = usdc_mint,
        token::authority = property_token,
        token::token_program = usdc_token_program,
    )]
    pub funding_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = investor,
        token::token_program = usdc_token_program,
    )]
    pub investor_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(address = property_token.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub usdc_token_program: Interface<'info, TokenInterface>,   // 표준 SPL Token (USDC용)
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// =====================
// cancel_position
// =====================
// 펀딩 중(Funding) 투자자가 직접 포지션 취소 → RWA 토큰 소각 + USDC 반환
#[derive(Accounts)]
#[instruction(listing_id: String)]
pub struct CancelPosition<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"property", listing_id.as_bytes()],
        bump = property_token.bump,
    )]
    pub property_token: Account<'info, PropertyToken>,

    #[account(
        mut,
        seeds = [b"investor", property_token.key().as_ref(), investor.key().as_ref()],
        bump = investor_position.bump,
        constraint = investor_position.owner == investor.key() @ RwaError::Unauthorized,
        constraint = investor_position.token_mint == property_token.token_mint @ RwaError::Unauthorized,
    )]
    pub investor_position: Account<'info, InvestorPosition>,

    #[account(mut, address = property_token.token_mint)]
    pub token_mint: InterfaceAccount<'info, Mint>,

    // 투자자 RWA 토큰 계좌 (소각 대상)
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = investor,
        token::token_program = token_program,
    )]
    pub investor_rwa_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"funding_vault", listing_id.as_bytes()],
        bump = property_token.funding_vault_bump,
        token::mint = usdc_mint,
        token::authority = property_token,
        token::token_program = usdc_token_program,
    )]
    pub funding_vault: InterfaceAccount<'info, TokenAccount>,

    // 투자자 USDC 계좌 (환불 수령)
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = investor,
        token::token_program = usdc_token_program,
    )]
    pub investor_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(address = property_token.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,        // Token-2022 (RWA)
    pub usdc_token_program: Interface<'info, TokenInterface>,   // SPL Token (USDC)
    pub system_program: Program<'info, System>,
}

// =====================
// activate_property
// =====================
#[derive(Accounts)]
#[instruction(listing_id: String)]
pub struct ActivateProperty<'info> {
    #[account(
        mut,
        seeds = [b"property", listing_id.as_bytes()],
        bump = property_token.bump,
        has_one = authority,
    )]
    pub property_token: Account<'info, PropertyToken>,

    pub authority: Signer<'info>,

    #[account(mut, address = property_token.token_mint)]
    pub token_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>, // Token-2022
}

// =====================
// distribute_monthly_revenue
// =====================
#[derive(Accounts)]
#[instruction(listing_id: String)]
pub struct DistributeMonthlyRevenue<'info> {
    #[account(
        mut,
        seeds = [b"property", listing_id.as_bytes()],
        bump = property_token.bump,
        has_one = authority,
    )]
    pub property_token: Account<'info, PropertyToken>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = authority,
        token::token_program = usdc_token_program,
    )]
    pub authority_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = property_token,
        associated_token::token_program = usdc_token_program,
    )]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(address = property_token.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub usdc_token_program: Interface<'info, TokenInterface>,   // 표준 SPL Token (USDC용)
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// =====================
// claim_dividend
// =====================
#[derive(Accounts)]
#[instruction(listing_id: String)]
pub struct ClaimDividend<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"property", listing_id.as_bytes()],
        bump = property_token.bump,
    )]
    pub property_token: Account<'info, PropertyToken>,

    #[account(
        mut,
        seeds = [b"investor", property_token.key().as_ref(), investor.key().as_ref()],
        bump = investor_position.bump,
        constraint = investor_position.owner == investor.key() @ RwaError::Unauthorized,
    )]
    pub investor_position: Account<'info, InvestorPosition>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = property_token,
        associated_token::token_program = usdc_token_program,
    )]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = investor,
        token::token_program = usdc_token_program,
    )]
    pub investor_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(address = property_token.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub usdc_token_program: Interface<'info, TokenInterface>,   // 표준 SPL Token (USDC용)
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// =====================
// 프로그램
// =====================
#[program]
pub mod rural_rest_rwa {
    use super::*;

    pub fn initialize_property(
        ctx: Context<InitializeProperty>,
        listing_id: String,
        total_supply: u64,
        valuation_krw: u64,
        price_per_token_usdc: u64,
        funding_deadline: i64,
        min_funding_bps: u16,
    ) -> Result<()> {
        // 파라미터 범위 검증 — instruction 진입부 첫 번째
        require!(price_per_token_usdc > 0, RwaError::InvalidPrice);
        require!(min_funding_bps > 0 && min_funding_bps <= 10_000, RwaError::InvalidFundingBps);

        let clock = Clock::get()?;
        require!(funding_deadline > clock.unix_timestamp, RwaError::InvalidDeadline);
        require!(
            funding_deadline <= clock.unix_timestamp + 365 * 24 * 3600,
            RwaError::DeadlineTooFar
        );

        // ── Token-2022 Mint + NonTransferable extension 수동 초기화 ──
        // Anchor init은 Token-2022 extension을 지원하지 않으므로 3단계 CPI로 처리
        // 참고: https://solana.com/developers/guides/token-extensions/non-transferable
        let token_program_id = ctx.accounts.token_program.key();

        // 1) create_account — extension 포함 공간 할당
        let space = ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(
            &[ExtensionType::NonTransferable],
        ).map_err(|_| RwaError::MathOverflow)?;
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(space);

        system_program::create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.token_mint.to_account_info(),
                },
            ),
            lamports,
            space as u64,
            &token_program_id,
        )?;

        // 2) initialize_non_transferable_mint — extension 등록 (mint 초기화 전에 반드시)
        invoke(
            &spl_token_2022::instruction::initialize_non_transferable_mint(
                &token_program_id,
                &ctx.accounts.token_mint.key(),
            )?,
            &[ctx.accounts.token_mint.to_account_info()],
        )?;

        // 3) initialize_mint2 — decimals=0, mint_authority=property_token PDA
        invoke(
            &spl_token_2022::instruction::initialize_mint2(
                &token_program_id,
                &ctx.accounts.token_mint.key(),
                &ctx.accounts.property_token.key(),  // mint authority
                None,                                  // freeze authority 없음
                0,                                     // decimals
            )?,
            &[ctx.accounts.token_mint.to_account_info()],
        )?;

        let property = &mut ctx.accounts.property_token;
        property.authority = ctx.accounts.authority.key();
        property.listing_id = listing_id;
        property.token_mint = ctx.accounts.token_mint.key();
        property.usdc_mint = ctx.accounts.usdc_mint.key();
        property.total_supply = total_supply;
        property.tokens_sold = 0;
        property.valuation_krw = valuation_krw;
        property.price_per_token_usdc = price_per_token_usdc;
        property.acc_dividend_per_share = 0;
        property.status = PropertyStatus::Funding;
        property.funding_deadline = funding_deadline;
        property.min_funding_bps = min_funding_bps;
        property.funds_released = false;
        property.funding_vault_bump = ctx.bumps.funding_vault;
        property.bump = ctx.bumps.property_token;
        Ok(())
    }

    // investor_position 최초 생성 (purchase_tokens 호출 전 반드시 선행)
    pub fn open_position(
        ctx: Context<OpenPosition>,
        _listing_id: String,
    ) -> Result<()> {
        let position = &mut ctx.accounts.investor_position;
        position.owner = ctx.accounts.investor.key();
        position.token_mint = ctx.accounts.property_token.token_mint;
        position.amount = 0;
        position.reward_debt = 0;
        position.bump = ctx.bumps.investor_position;
        Ok(())
    }

    pub fn purchase_tokens(
        ctx: Context<PurchaseTokens>,
        listing_id: String,
        amount: u64,
    ) -> Result<()> {
        // 파라미터 범위 검증 — instruction 진입부 첫 번째
        require!(amount > 0, RwaError::ZeroAmount);

        let property = &ctx.accounts.property_token;
        let clock = Clock::get()?;

        require!(property.status == PropertyStatus::Funding, RwaError::InvalidStatus);
        require!(clock.unix_timestamp <= property.funding_deadline, RwaError::FundingExpired);

        require!(
            property.tokens_sold.checked_add(amount).ok_or(RwaError::MathOverflow)?
                <= property.total_supply,
            RwaError::InsufficientTokenSupply
        );

        // 구매 상한: 총발행량의 30% (의결권 캡 10%는 DAO 구현 시 별도 처리)
        let max_per_investor = property.total_supply * 3 / 10;
        let current_amount = ctx.accounts.investor_position.amount;
        require!(
            current_amount.checked_add(amount).ok_or(RwaError::MathOverflow)?
                <= max_per_investor,
            RwaError::ExceedsInvestorCap
        );

        let usdc_cost = (amount as u128)
            .checked_mul(property.price_per_token_usdc as u128)
            .ok_or(RwaError::MathOverflow)? as u64;

        // USDC: investor → funding_vault (에스크로)
        let transfer_ctx = CpiContext::new(
            ctx.accounts.usdc_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.investor_usdc_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.funding_vault.to_account_info(),
                authority: ctx.accounts.investor.to_account_info(),
            },
        );
        transfer_checked(transfer_ctx, usdc_cost, 6)?;

        let listing_id_bytes = listing_id.as_bytes();
        let bump = ctx.accounts.property_token.bump;
        let seeds: &[&[u8]] = &[b"property", listing_id_bytes, &[bump]];
        let signer_seeds = &[seeds];

        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.investor_rwa_account.to_account_info(),
                authority: ctx.accounts.property_token.to_account_info(),
            },
            signer_seeds,
        );
        mint_to(mint_ctx, amount)?;

        let acc_dividend_per_share = ctx.accounts.property_token.acc_dividend_per_share;
        let position = &mut ctx.accounts.investor_position;

        // 추가 구매 시 과거 누적 배당에 대한 reward_debt 반영
        position.reward_debt = position
            .reward_debt
            .checked_add(
                (amount as u128)
                    .checked_mul(acc_dividend_per_share)
                    .ok_or(RwaError::MathOverflow)?,
            )
            .ok_or(RwaError::MathOverflow)?;
        position.amount = position
            .amount
            .checked_add(amount)
            .ok_or(RwaError::MathOverflow)?;

        let property = &mut ctx.accounts.property_token;
        property.tokens_sold = property
            .tokens_sold
            .checked_add(amount)
            .ok_or(RwaError::MathOverflow)?;

        // 100% 달성해도 status는 Funding 유지
        // 데드라인까지 투자자 취소 가능 — release_funds에서 Funded로 전환

        Ok(())
    }

    // 펀딩 성공 시 에스크로 해제 → 운영자 계좌로 송금 (운영자 전용)
    // 조건: 완판(Funded) OR (deadline 경과 + 최소 판매율 달성)
    pub fn release_funds(
        ctx: Context<ReleaseFunds>,
        listing_id: String,
    ) -> Result<()> {
        let property = &ctx.accounts.property_token;

        // 중복 호출 방지
        require!(!property.funds_released, RwaError::FundsAlreadyReleased);

        let clock = Clock::get()?;

        // 펀딩 기간 중에는 release 불가 (투자자 취소 보장)
        let deadline_passed = clock.unix_timestamp > property.funding_deadline;
        require!(deadline_passed, RwaError::FundingStillOpen);

        let min_threshold = (property.total_supply as u128)
            .checked_mul(property.min_funding_bps as u128)
            .ok_or(RwaError::MathOverflow)?
            / 10_000;
        let goal_met = (property.tokens_sold as u128) >= min_threshold;

        require!(
            property.status == PropertyStatus::Funding && goal_met,
            RwaError::ReleaseNotAvailable
        );

        let amount = ctx.accounts.funding_vault.amount;
        let listing_id_bytes = listing_id.as_bytes();
        let bump = property.bump;
        let seeds: &[&[u8]] = &[b"property", listing_id_bytes, &[bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.funding_vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.authority_usdc_account.to_account_info(),
                authority: ctx.accounts.property_token.to_account_info(),
            },
            signer_seeds,
        );
        transfer_checked(transfer_ctx, amount, 6)?;

        let property = &mut ctx.accounts.property_token;
        property.funds_released = true;
        property.status = PropertyStatus::Funded;

        Ok(())
    }

    // 펀딩 중 투자자가 직접 포지션 취소 (Funding 상태에서만 호출 가능)
    // RWA 토큰 소각 → funding_vault에서 USDC 반환
    pub fn cancel_position(
        ctx: Context<CancelPosition>,
        listing_id: String,
    ) -> Result<()> {
        let property = &ctx.accounts.property_token;
        let clock = Clock::get()?;
        // funds_released = true이면 vault가 비어있어 취소 불가
        require!(!property.funds_released, RwaError::FundsAlreadyReleased);
        // Funding 또는 Funded 상태이고 deadline이 아직 지나지 않은 경우 취소 가능
        require!(
            (property.status == PropertyStatus::Funding || property.status == PropertyStatus::Funded)
                && clock.unix_timestamp <= property.funding_deadline,
            RwaError::InvalidStatus
        );

        let position = &ctx.accounts.investor_position;
        require!(position.amount > 0, RwaError::AlreadyRefunded);

        let cancel_amount = position.amount;
        let refund_usdc = (cancel_amount as u128)
            .checked_mul(property.price_per_token_usdc as u128)
            .ok_or(RwaError::MathOverflow)? as u64;

        // RWA 토큰 소각 (investor가 서명)
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.token_mint.to_account_info(),
                from: ctx.accounts.investor_rwa_account.to_account_info(),
                authority: ctx.accounts.investor.to_account_info(),
            },
        );
        burn(burn_ctx, cancel_amount)?;

        // USDC 반환: funding_vault → investor (property_token PDA 서명)
        let listing_id_bytes = listing_id.as_bytes();
        let bump = property.bump;
        let seeds: &[&[u8]] = &[b"property", listing_id_bytes, &[bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.funding_vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.investor_usdc_account.to_account_info(),
                authority: ctx.accounts.property_token.to_account_info(),
            },
            signer_seeds,
        );
        transfer_checked(transfer_ctx, refund_usdc, 6)?;

        let property = &mut ctx.accounts.property_token;
        property.tokens_sold = property.tokens_sold
            .checked_sub(cancel_amount)
            .ok_or(RwaError::MathOverflow)?;
        // Funded 상태에서 취소 시 → 토큰이 남았으므로 다시 Funding으로 복귀
        if property.status == PropertyStatus::Funded {
            property.status = PropertyStatus::Funding;
        }

        let position = &mut ctx.accounts.investor_position;
        position.amount = 0;
        position.reward_debt = 0;

        Ok(())
    }

    // 펀딩 실패 시 환불 (투자자 전용)
    // 조건: deadline 경과 + 최소 판매율 미달
    pub fn refund(
        ctx: Context<Refund>,
        listing_id: String,
    ) -> Result<()> {
        let property = &ctx.accounts.property_token;
        let clock = Clock::get()?;

        let deadline_passed = clock.unix_timestamp > property.funding_deadline;
        let min_threshold = (property.total_supply as u128)
            .checked_mul(property.min_funding_bps as u128)
            .ok_or(RwaError::MathOverflow)?
            / 10_000;
        let goal_failed = (property.tokens_sold as u128) < min_threshold;

        require!(deadline_passed && goal_failed, RwaError::RefundNotAvailable);

        let position = &ctx.accounts.investor_position;
        require!(position.amount > 0, RwaError::AlreadyRefunded);

        let refund_amount = (position.amount as u128)
            .checked_mul(property.price_per_token_usdc as u128)
            .ok_or(RwaError::MathOverflow)? as u64;

        let listing_id_bytes = listing_id.as_bytes();
        let bump = property.bump;
        let seeds: &[&[u8]] = &[b"property", listing_id_bytes, &[bump]];
        let signer_seeds = &[seeds];

        // funding_vault → investor (property_token PDA 서명)
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.funding_vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.investor_usdc_account.to_account_info(),
                authority: ctx.accounts.property_token.to_account_info(),
            },
            signer_seeds,
        );
        transfer_checked(transfer_ctx, refund_amount, 6)?;

        let property = &mut ctx.accounts.property_token;
        if property.status != PropertyStatus::Failed {
            property.status = PropertyStatus::Failed;
        }

        let position = &mut ctx.accounts.investor_position;
        position.amount = 0;
        position.reward_debt = 0;

        Ok(())
    }

    // Funded → Active 전환 (운영자 전용)
    pub fn activate_property(
        ctx: Context<ActivateProperty>,
        listing_id: String,
    ) -> Result<()> {
        let property = &mut ctx.accounts.property_token;
        require!(property.status == PropertyStatus::Funded, RwaError::InvalidStatus);
        property.status = PropertyStatus::Active;

        // mint authority 소각 — Active 이후 추가 토큰 발행 영구 불가
        let listing_id_bytes = listing_id.as_bytes();
        let bump = property.bump;
        let seeds: &[&[u8]] = &[b"property", listing_id_bytes, &[bump]];
        let signer_seeds = &[seeds];

        let set_auth_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                account_or_mint: ctx.accounts.token_mint.to_account_info(),
                current_authority: ctx.accounts.property_token.to_account_info(),
            },
            signer_seeds,
        );
        set_authority(set_auth_ctx, AuthorityType::MintTokens, None)?;

        Ok(())
    }

    // 월별 순이익 배당 분배 (운영자 전용)
    // net_revenue_usdc: 해당 월 순이익 (총매출 - 운영비), micro-USDC 단위
    pub fn distribute_monthly_revenue(
        ctx: Context<DistributeMonthlyRevenue>,
        _listing_id: String,
        net_revenue_usdc: u64,
    ) -> Result<()> {
        // 파라미터 범위 검증 — instruction 진입부 첫 번째
        require!(net_revenue_usdc > 0, RwaError::ZeroRevenue);
        require!(
            ctx.accounts.property_token.status == PropertyStatus::Active,
            RwaError::InvalidStatus
        );

        let transfer_ctx = CpiContext::new(
            ctx.accounts.usdc_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.authority_usdc_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        transfer_checked(transfer_ctx, net_revenue_usdc, 6)?;

        let property = &mut ctx.accounts.property_token;
        require!(property.tokens_sold > 0, RwaError::ZeroAmount);
        let added = (net_revenue_usdc as u128)
            .checked_mul(PRECISION)
            .ok_or(RwaError::MathOverflow)?
            .checked_div(property.tokens_sold as u128)
            .ok_or(RwaError::MathOverflow)?;

        property.acc_dividend_per_share = property
            .acc_dividend_per_share
            .checked_add(added)
            .ok_or(RwaError::MathOverflow)?;

        Ok(())
    }

    // 투자자 배당 수령
    pub fn claim_dividend(
        ctx: Context<ClaimDividend>,
        listing_id: String,
    ) -> Result<()> {
        // Active 상태에서만 클레임 가능
        require!(
            ctx.accounts.property_token.status == PropertyStatus::Active,
            RwaError::InvalidStatus
        );

        let property = &ctx.accounts.property_token;
        let position = &ctx.accounts.investor_position;

        let gross = (position.amount as u128)
            .checked_mul(property.acc_dividend_per_share)
            .ok_or(RwaError::MathOverflow)?
            .checked_div(PRECISION)
            .ok_or(RwaError::MathOverflow)?;

        // reward_debt > gross 는 정상적으로 발생 불가하지만,
        // 만약 발생하면 MathOverflow 대신 NoPendingDividend로 처리
        let pending = gross.checked_sub(position.reward_debt)
            .ok_or(RwaError::NoPendingDividend)?;

        require!(pending > 0, RwaError::NoPendingDividend);

        let listing_id_bytes = listing_id.as_bytes();
        let bump = ctx.accounts.property_token.bump;
        let seeds: &[&[u8]] = &[b"property", listing_id_bytes, &[bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.usdc_vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.investor_usdc_account.to_account_info(),
                authority: ctx.accounts.property_token.to_account_info(),
            },
            signer_seeds,
        );
        transfer_checked(transfer_ctx, pending as u64, 6)?;

        let property = &ctx.accounts.property_token;
        let position = &mut ctx.accounts.investor_position;
        position.reward_debt = (position.amount as u128)
            .checked_mul(property.acc_dividend_per_share)
            .ok_or(RwaError::MathOverflow)?
            .checked_div(PRECISION)
            .ok_or(RwaError::MathOverflow)?;

        Ok(())
    }
}

// =====================
// 단위 테스트 (cargo test)
// =====================
#[cfg(test)]
mod tests {
    use super::PRECISION;

    fn calc_pending(amount: u64, acc_dividend_per_share: u128, reward_debt: u128) -> u128 {
        (amount as u128)
            .checked_mul(acc_dividend_per_share)
            .unwrap()
            .checked_div(PRECISION)
            .unwrap()
            .checked_sub(reward_debt)
            .unwrap()
    }

    fn calc_reward_debt(amount: u64, acc_dividend_per_share: u128) -> u128 {
        (amount as u128)
            .checked_mul(acc_dividend_per_share)
            .unwrap()
            .checked_div(PRECISION)
            .unwrap()
    }

    fn calc_refund(amount: u64, price_per_token: u64) -> u64 {
        (amount as u128)
            .checked_mul(price_per_token as u128)
            .unwrap() as u64
    }

    fn min_threshold(total_supply: u64, min_funding_bps: u16) -> u128 {
        (total_supply as u128) * (min_funding_bps as u128) / 10_000
    }

    // -------------------------------------------------------
    // 배당 계산 정확성
    // -------------------------------------------------------

    #[test]
    fn test_pending_first_distribution() {
        let acc_dps = 100_000_000 * PRECISION / 100;
        let pending = calc_pending(10, acc_dps, 0);
        assert_eq!(pending, 10_000_000);
    }

    #[test]
    fn test_pending_after_second_distribution() {
        let acc_dps_after_1st = 100_000_000 * PRECISION / 100;
        let acc_dps_after_2nd = acc_dps_after_1st + 50_000_000 * PRECISION / 100;
        let reward_debt_after_claim = calc_reward_debt(10, acc_dps_after_1st);
        let pending = calc_pending(10, acc_dps_after_2nd, reward_debt_after_claim);
        assert_eq!(pending, 5_000_000);
    }

    #[test]
    fn test_no_double_claim() {
        let acc_dps = 100_000_000 * PRECISION / 100;
        let reward_debt = calc_reward_debt(10, acc_dps);
        let pending = calc_pending(10, acc_dps, reward_debt);
        assert_eq!(pending, 0);
    }

    // -------------------------------------------------------
    // 구매 시점 reward_debt: 이전 배당 소급 차단
    // -------------------------------------------------------

    #[test]
    fn test_late_investor_gets_no_past_dividend() {
        let acc_dps = 100_000_000 * PRECISION / 100;
        let reward_debt = calc_reward_debt(50, acc_dps);
        let pending = calc_pending(50, acc_dps, reward_debt);
        assert_eq!(pending, 0);
    }

    #[test]
    fn test_late_investor_gets_future_dividend() {
        let acc_dps_1st = 100_000_000 * PRECISION / 100;
        let acc_dps_2nd = acc_dps_1st + 50_000_000 * PRECISION / 100;
        let reward_debt = calc_reward_debt(50, acc_dps_1st);
        let pending = calc_pending(50, acc_dps_2nd, reward_debt);
        assert_eq!(pending, 25_000_000);
    }

    // -------------------------------------------------------
    // 추가 구매 시 reward_debt 누적
    // -------------------------------------------------------

    #[test]
    fn test_additional_purchase_reward_debt() {
        let acc_dps_after_1st = 100_000_000 * PRECISION / 100;
        let reward_debt_after_claim = calc_reward_debt(10, acc_dps_after_1st);
        let additional_debt = calc_reward_debt(10, acc_dps_after_1st);
        let total_reward_debt = reward_debt_after_claim + additional_debt;
        let pending = calc_pending(20, acc_dps_after_1st, total_reward_debt);
        assert_eq!(pending, 0);
    }

    // -------------------------------------------------------
    // 30% 개인 투자 상한
    // -------------------------------------------------------

    #[test]
    fn test_investor_cap_within_limit() {
        let total_supply: u64 = 1_000_000;
        let max_per_investor = total_supply * 3 / 10; // 30%
        assert!(100_000u64 + 200_000u64 <= max_per_investor);
    }

    #[test]
    fn test_investor_cap_exceeded() {
        let total_supply: u64 = 1_000_000;
        let max_per_investor = total_supply * 3 / 10; // 30%
        assert!(200_000u64 + 150_000u64 > max_per_investor);
    }

    // -------------------------------------------------------
    // 환불 로직
    // -------------------------------------------------------

    #[test]
    fn test_refund_amount_correct() {
        // 10개 보유, 개당 1 USDC (1_000_000 micro-USDC)
        let refund = calc_refund(10, 1_000_000);
        assert_eq!(refund, 10_000_000); // 10 USDC
    }

    #[test]
    fn test_min_threshold_60pct() {
        // 총 100개, 최소 60% = 60개
        let threshold = min_threshold(100, 6000);
        assert_eq!(threshold, 60);
    }

    #[test]
    fn test_funding_failed_condition() {
        // 59개 판매, 최소 60개 필요 → 실패
        let threshold = min_threshold(100, 6000);
        assert!(59u128 < threshold);
    }

    #[test]
    fn test_funding_success_condition() {
        // 60개 판매, 최소 60개 필요 → 성공
        let threshold = min_threshold(100, 6000);
        assert!(60u128 >= threshold);
    }

    // -------------------------------------------------------
    // 산술 오버플로우 방어
    // -------------------------------------------------------

    #[test]
    fn test_usdc_cost_overflow_guard() {
        let amount: u64 = u64::MAX / 2;
        let price: u64 = 2;
        let cost = (amount as u128).checked_mul(price as u128);
        assert!(cost.is_some());
    }

    #[test]
    fn test_acc_dps_overflow_guard() {
        let current: u128 = u128::MAX - 1;
        let result = current.checked_add(1);
        assert!(result.is_some());
        let overflow = current.checked_add(2);
        assert!(overflow.is_none());
    }
}
