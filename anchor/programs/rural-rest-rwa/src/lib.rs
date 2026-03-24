use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    mint_to, transfer_checked, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR");

// =====================
// 에러 코드
// =====================
#[error_code]
pub enum RwaError {
    #[msg("Insufficient token supply remaining.")]
    InsufficientTokenSupply,
    #[msg("Exceeds individual investor cap (10%).")]
    ExceedsInvestorCap,
    #[msg("Math overflow.")]
    MathOverflow,
    #[msg("No pending dividend to claim.")]
    NoPendingDividend,
    #[msg("Unauthorized.")]
    Unauthorized,
    #[msg("Invalid property status for this operation.")]
    InvalidStatus,
    #[msg("Funding deadline has passed.")]
    FundingExpired,
    #[msg("Refund conditions not met: goal was reached or deadline has not passed.")]
    RefundNotAvailable,
    #[msg("This position has already been refunded.")]
    AlreadyRefunded,
    #[msg("Deadline must be in the future.")]
    InvalidDeadline,
    #[msg("Release conditions not met: not sold out and deadline not passed or goal not reached.")]
    ReleaseNotAvailable,
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
    #[max_len(50)]
    pub listing_id: String,
    pub token_mint: Pubkey,
    pub total_supply: u64,
    pub tokens_sold: u64,
    pub valudation_krw: u64,
    pub price_per_token_usdc: u64,
    pub acc_dividend_per_share: u128,
    pub status: PropertyStatus,
    pub funding_deadline: i64, // Unix timestamp (세일 기간 종료 시각)
    pub min_funding_bps: u16,  // 최소 판매율 basis points (6000 = 60%)
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

    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = property_token,
        mint::token_program = token_program,
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

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
// purchase_tokens
// =====================
#[derive(Accounts)]
#[instruction(listing_id: String)]
pub struct PurchaseTokens<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"property", listing_id.as_bytes()],
        bump = property_token.bump,
    )]
    pub property_token: Account<'info, PropertyToken>,

    #[account(mut, address = property_token.token_mint)]
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = investor,
        space = 8 + InvestorPosition::INIT_SPACE,
        seeds = [b"investor", property_token.key().as_ref(), investor.key().as_ref()],
        bump,
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

    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = token_mint,
        associated_token::authority = investor,
        associated_token::token_program = token_program,
    )]
    pub investor_rwa_account: InterfaceAccount<'info, TokenAccount>,

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

    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub usdc_token_program: Interface<'info, TokenInterface>,   // 표준 SPL Token (USDC용)
    pub associated_token_program: Program<'info, AssociatedToken>,
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
        valudation_krw: u64,
        price_per_token_usdc: u64,
        funding_deadline: i64,
        min_funding_bps: u16,
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(funding_deadline > clock.unix_timestamp, RwaError::InvalidDeadline);

        let property = &mut ctx.accounts.property_token;
        property.authority = ctx.accounts.authority.key();
        property.listing_id = listing_id;
        property.token_mint = ctx.accounts.token_mint.key();
        property.total_supply = total_supply;
        property.tokens_sold = 0;
        property.valudation_krw = valudation_krw;
        property.price_per_token_usdc = price_per_token_usdc;
        property.acc_dividend_per_share = 0;
        property.status = PropertyStatus::Funding;
        property.funding_deadline = funding_deadline;
        property.min_funding_bps = min_funding_bps;
        property.funding_vault_bump = ctx.bumps.funding_vault;
        property.bump = ctx.bumps.property_token;
        Ok(())
    }

    pub fn purchase_tokens(
        ctx: Context<PurchaseTokens>,
        listing_id: String,
        amount: u64,
    ) -> Result<()> {
        let property = &ctx.accounts.property_token;
        let clock = Clock::get()?;

        require!(property.status == PropertyStatus::Funding, RwaError::InvalidStatus);
        require!(clock.unix_timestamp <= property.funding_deadline, RwaError::FundingExpired);

        require!(
            property.tokens_sold.checked_add(amount).ok_or(RwaError::MathOverflow)?
                <= property.total_supply,
            RwaError::InsufficientTokenSupply
        );

        let max_per_investor = property.total_supply / 10;
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

        if position.owner == Pubkey::default() {
            position.owner = ctx.accounts.investor.key();
            position.token_mint = ctx.accounts.property_token.token_mint;
            position.bump = ctx.bumps.investor_position;
        }

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

        if property.tokens_sold == property.total_supply {
            property.status = PropertyStatus::Funded;
        }

        Ok(())
    }

    // 펀딩 성공 시 에스크로 해제 → 운영자 계좌로 송금 (운영자 전용)
    // 조건: 완판(Funded) OR (deadline 경과 + 최소 판매율 달성)
    pub fn release_funds(
        ctx: Context<ReleaseFunds>,
        listing_id: String,
    ) -> Result<()> {
        let property = &ctx.accounts.property_token;
        let clock = Clock::get()?;

        let is_sold_out = property.status == PropertyStatus::Funded;
        let deadline_passed = clock.unix_timestamp > property.funding_deadline;
        let min_threshold = (property.total_supply as u128)
            .checked_mul(property.min_funding_bps as u128)
            .ok_or(RwaError::MathOverflow)?
            / 10_000;
        let goal_met = (property.tokens_sold as u128) >= min_threshold;

        require!(is_sold_out || (deadline_passed && goal_met), RwaError::ReleaseNotAvailable);

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

        // deadline 달성 케이스(아직 Funding 상태)면 Funded로 전환
        let property = &mut ctx.accounts.property_token;
        if property.status == PropertyStatus::Funding {
            property.status = PropertyStatus::Funded;
        }

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
        _listing_id: String,
    ) -> Result<()> {
        let property = &mut ctx.accounts.property_token;
        require!(property.status == PropertyStatus::Funded, RwaError::InvalidStatus);
        property.status = PropertyStatus::Active;
        Ok(())
    }

    // 월별 순이익 배당 분배 (운영자 전용)
    // net_revenue_usdc: 해당 월 순이익 (총매출 - 운영비), micro-USDC 단위
    pub fn distribute_monthly_revenue(
        ctx: Context<DistributeMonthlyRevenue>,
        _listing_id: String,
        net_revenue_usdc: u64,
    ) -> Result<()> {
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

        const PRECISION: u128 = 1_000_000_000_000;
        let property = &mut ctx.accounts.property_token;
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
        const PRECISION: u128 = 1_000_000_000_000;

        let property = &ctx.accounts.property_token;
        let position = &ctx.accounts.investor_position;

        let pending = (position.amount as u128)
            .checked_mul(property.acc_dividend_per_share)
            .ok_or(RwaError::MathOverflow)?
            .checked_div(PRECISION)
            .ok_or(RwaError::MathOverflow)?
            .checked_sub(position.reward_debt)
            .ok_or(RwaError::MathOverflow)?;

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
    const PRECISION: u128 = 1_000_000_000_000;

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
    // 10% 개인 투자 상한
    // -------------------------------------------------------

    #[test]
    fn test_investor_cap_within_limit() {
        let total_supply: u64 = 1_000_000;
        let max_per_investor = total_supply / 10;
        assert!(50_000u64 + 50_000u64 <= max_per_investor);
    }

    #[test]
    fn test_investor_cap_exceeded() {
        let total_supply: u64 = 1_000_000;
        let max_per_investor = total_supply / 10;
        assert!(90_000u64 + 20_000u64 > max_per_investor);
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
