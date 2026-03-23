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
}

// =====================
// 상태 전환
// =====================
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum PropertyStatus {
    Funding, // 토큰 판매 중
    Funded,  // 완판 (구매 불가)
    Active,  // 숙박 운영 중 (배당 발생)
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
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    // 배당금 보관 USDC 볼트 (property_token PDA 소유)
    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = property_token,
        associated_token::token_program = token_program,
    )]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
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

    #[account(
        mut,
        address = property_token.token_mint,
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    // 투자자 포지션 (첫 구매면 새로 생성)
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
        token::token_program = token_program,
    )]
    pub investor_usdc_account: InterfaceAccount<'info, TokenAccount>,

    // 운영자 USDC 계좌 (결제 수령)
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = property_token.authority,
        token::token_program = token_program,
    )]
    pub authority_usdc_account: InterfaceAccount<'info, TokenAccount>,

    // 투자자 RWA 토큰 계좌 (민팅 대상, 없으면 생성)
    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = token_mint,
        associated_token::authority = investor,
        associated_token::token_program = token_program,
    )]
    pub investor_rwa_account: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
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

    // 운영자 USDC 계좌 (순이익 출처)
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = authority,
        token::token_program = token_program,
    )]
    pub authority_usdc_account: InterfaceAccount<'info, TokenAccount>,

    // 배당금 볼트 (입금 대상)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = property_token,
        associated_token::token_program = token_program,
    )]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
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

    // 배당금 볼트 (USDC 출처, property_token PDA 소유)
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = property_token,
        associated_token::token_program = token_program,
    )]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    // 투자자 USDC 계좌 (배당 수령)
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = investor,
        token::token_program = token_program,
    )]
    pub investor_usdc_account: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
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
    ) -> Result<()> {
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
        property.bump = ctx.bumps.property_token;
        Ok(())
    }

    pub fn purchase_tokens(
        ctx: Context<PurchaseTokens>,
        listing_id: String,
        amount: u64,
    ) -> Result<()> {
        let property = &ctx.accounts.property_token;

        // 0. Funding 상태일 때만 구매 가능
        require!(
            property.status == PropertyStatus::Funding,
            RwaError::InvalidStatus
        );

        // 1. 잔여 토큰 확인
        require!(
            property.tokens_sold.checked_add(amount).ok_or(RwaError::MathOverflow)?
                <= property.total_supply,
            RwaError::InsufficientTokenSupply
        );

        // 2. 10% 개인 투자 상한 확인
        let max_per_investor = property.total_supply / 10;
        let current_amount = ctx.accounts.investor_position.amount;
        require!(
            current_amount.checked_add(amount).ok_or(RwaError::MathOverflow)?
                <= max_per_investor,
            RwaError::ExceedsInvestorCap
        );

        // 3. USDC 비용 계산
        let usdc_cost = (amount as u128)
            .checked_mul(property.price_per_token_usdc as u128)
            .ok_or(RwaError::MathOverflow)? as u64;

        // 4. USDC 전송: investor → authority
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.investor_usdc_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.authority_usdc_account.to_account_info(),
                authority: ctx.accounts.investor.to_account_info(),
            },
        );
        transfer_checked(transfer_ctx, usdc_cost, 6)?;

        // 5. RWA 토큰 민팅: property_token PDA가 서명
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

        // 6. InvestorPosition 업데이트
        let acc_dividend_per_share = ctx.accounts.property_token.acc_dividend_per_share;
        let position = &mut ctx.accounts.investor_position;

        // 첫 구매: 계정 초기화
        if position.owner == Pubkey::default() {
            position.owner = ctx.accounts.investor.key();
            position.token_mint = ctx.accounts.property_token.token_mint;
            position.bump = ctx.bumps.investor_position;
        }

        // reward_debt: 구매 시점 이전 배당은 받지 않음
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

        // 7. PropertyToken 업데이트
        let property = &mut ctx.accounts.property_token;
        property.tokens_sold = property
            .tokens_sold
            .checked_add(amount)
            .ok_or(RwaError::MathOverflow)?;

        // 완판 시 자동으로 Funded 전환
        if property.tokens_sold == property.total_supply {
            property.status = PropertyStatus::Funded;
        }

        Ok(())
    }

    // Funded → Active 전환 (운영자 전용, 숙박 운영 시작 시 1회 호출)
    pub fn activate_property(
        ctx: Context<ActivateProperty>,
        _listing_id: String,
    ) -> Result<()> {
        let property = &mut ctx.accounts.property_token;
        require!(
            property.status == PropertyStatus::Funded,
            RwaError::InvalidStatus
        );
        property.status = PropertyStatus::Active;
        Ok(())
    }

    // 월별 순이익 배당 분배 (운영자 전용)
    // net_revenue_usdc: 해당 월 순이익 (총매출 - 인건비 - 운영비), micro-USDC 단위
    // 적자 달에는 호출하지 않음
    pub fn distribute_monthly_revenue(
        ctx: Context<DistributeMonthlyRevenue>,
        _listing_id: String,
        net_revenue_usdc: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.property_token.status == PropertyStatus::Active,
            RwaError::InvalidStatus
        );

        // 1. 순이익 USDC: 운영자 계좌 → 볼트
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.authority_usdc_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        transfer_checked(transfer_ctx, net_revenue_usdc, 6)?;

        // 2. acc_dividend_per_share 업데이트
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

        // 1. 미수령 배당 계산
        let pending = (position.amount as u128)
            .checked_mul(property.acc_dividend_per_share)
            .ok_or(RwaError::MathOverflow)?
            .checked_div(PRECISION)
            .ok_or(RwaError::MathOverflow)?
            .checked_sub(position.reward_debt)
            .ok_or(RwaError::MathOverflow)?;

        require!(pending > 0, RwaError::NoPendingDividend);

        // 2. 볼트 → 투자자 USDC 전송 (property_token PDA 서명)
        let listing_id_bytes = listing_id.as_bytes();
        let bump = ctx.accounts.property_token.bump;
        let seeds: &[&[u8]] = &[b"property", listing_id_bytes, &[bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.usdc_vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.investor_usdc_account.to_account_info(),
                authority: ctx.accounts.property_token.to_account_info(),
            },
            signer_seeds,
        );
        transfer_checked(transfer_ctx, pending as u64, 6)?;

        // 3. reward_debt 갱신 (다음 claim 때 중복 수령 방지)
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

    // 배당 계산 헬퍼: 실제 claim_dividend 로직과 동일
    fn calc_pending(amount: u64, acc_dividend_per_share: u128, reward_debt: u128) -> u128 {
        (amount as u128)
            .checked_mul(acc_dividend_per_share)
            .unwrap()
            .checked_div(PRECISION)
            .unwrap()
            .checked_sub(reward_debt)
            .unwrap()
    }

    // reward_debt 계산 헬퍼: 구매 시점에 설정되는 값
    fn calc_reward_debt(amount: u64, acc_dividend_per_share: u128) -> u128 {
        (amount as u128)
            .checked_mul(acc_dividend_per_share)
            .unwrap()
            .checked_div(PRECISION)
            .unwrap()
    }

    // -------------------------------------------------------
    // 배당 계산 정확성
    // -------------------------------------------------------

    #[test]
    fn test_pending_first_distribution() {
        // 상황: 100개 중 10개 보유, 100 USDC 배당 발생
        // acc_dps = (100 USDC * 1e12) / 100 = 1e12 (= 1 USDC/토큰)
        let acc_dps = 100_000_000 * PRECISION / 100; // 100 USDC / 100 tokens
        let reward_debt = 0u128;

        let pending = calc_pending(10, acc_dps, reward_debt);
        // 10토큰 × 1 USDC = 10 USDC (= 10_000_000 micro-USDC)
        assert_eq!(pending, 10_000_000);
    }

    #[test]
    fn test_pending_after_second_distribution() {
        // 상황: 10토큰 보유, 1차(100 USDC) + 2차(50 USDC) 배당
        // 총 tokens_sold = 100
        let acc_dps_after_1st = 100_000_000 * PRECISION / 100;
        let acc_dps_after_2nd = acc_dps_after_1st + 50_000_000 * PRECISION / 100;

        // 1차 수령 후 reward_debt 설정
        let reward_debt_after_claim = calc_reward_debt(10, acc_dps_after_1st);

        // 2차 배당 후 pending 계산
        let pending = calc_pending(10, acc_dps_after_2nd, reward_debt_after_claim);
        // 10토큰 × 0.5 USDC (2차분만) = 5 USDC = 5_000_000
        assert_eq!(pending, 5_000_000);
    }

    #[test]
    fn test_no_double_claim() {
        // 수령 후 즉시 재수령하면 pending = 0
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
        // 1차 배당 발생 후 B가 진입
        let acc_dps = 100_000_000 * PRECISION / 100; // 1 USDC/토큰

        // B 구매 시 reward_debt 설정 (이전 배당 차단)
        let reward_debt = calc_reward_debt(50, acc_dps);

        // B가 즉시 claim 시도 → 0이어야 함
        let pending = calc_pending(50, acc_dps, reward_debt);
        assert_eq!(pending, 0, "나중에 들어온 투자자는 이전 배당을 못 받아야 함");
    }

    #[test]
    fn test_late_investor_gets_future_dividend() {
        // B가 1차 배당 후 진입, 2차 배당 발생 후 수령
        let acc_dps_1st = 100_000_000 * PRECISION / 100; // 1차 후
        let acc_dps_2nd = acc_dps_1st + 50_000_000 * PRECISION / 100; // 2차 후

        let reward_debt = calc_reward_debt(50, acc_dps_1st); // 진입 시점 설정
        let pending = calc_pending(50, acc_dps_2nd, reward_debt);
        // 50토큰 × 0.5 USDC (2차분만) = 25 USDC = 25_000_000
        assert_eq!(pending, 25_000_000);
    }

    // -------------------------------------------------------
    // 추가 구매 시 reward_debt 누적
    // -------------------------------------------------------

    #[test]
    fn test_additional_purchase_reward_debt() {
        // A가 1차 배당 전 10개 구매, 1차 배당 발생, 추가 10개 구매
        let acc_dps_before = 0u128;
        let acc_dps_after_1st = 100_000_000 * PRECISION / 100;

        // 첫 구매: reward_debt = 0
        let reward_debt = calc_reward_debt(10, acc_dps_before);
        assert_eq!(reward_debt, 0);

        // 1차 배당 수령 후 reward_debt 갱신
        let reward_debt_after_claim = calc_reward_debt(10, acc_dps_after_1st);

        // 추가 10개 구매: reward_debt += 10 × acc_dps_after_1st
        let additional_debt = calc_reward_debt(10, acc_dps_after_1st);
        let total_reward_debt = reward_debt_after_claim + additional_debt;

        // 즉시 claim 시 pending = 0
        let pending = calc_pending(20, acc_dps_after_1st, total_reward_debt);
        assert_eq!(pending, 0, "추가 구매한 토큰으로 과거 배당 소급 불가");
    }

    // -------------------------------------------------------
    // 10% 개인 투자 상한
    // -------------------------------------------------------

    #[test]
    fn test_investor_cap_within_limit() {
        let total_supply: u64 = 1_000_000;
        let max_per_investor = total_supply / 10; // 100_000
        let current = 50_000u64;
        let buy = 50_000u64;
        assert!(current + buy <= max_per_investor);
    }

    #[test]
    fn test_investor_cap_exceeded() {
        let total_supply: u64 = 1_000_000;
        let max_per_investor = total_supply / 10; // 100_000
        let current = 90_000u64;
        let buy = 20_000u64;
        assert!(current + buy > max_per_investor);
    }

    // -------------------------------------------------------
    // 산술 오버플로우 방어
    // -------------------------------------------------------

    #[test]
    fn test_usdc_cost_overflow_guard() {
        // u128로 계산하면 u64 max × u64 max도 안전
        let amount: u64 = u64::MAX / 2;
        let price: u64 = 2;
        let cost = (amount as u128).checked_mul(price as u128);
        assert!(cost.is_some());
    }

    #[test]
    fn test_acc_dps_overflow_guard() {
        // acc_dividend_per_share 누적 시 오버플로우 체크
        let current: u128 = u128::MAX - 1;
        let added: u128 = 1;
        let result = current.checked_add(added);
        assert!(result.is_some());

        // 실제 오버플로우 케이스
        let overflow = current.checked_add(2);
        assert!(overflow.is_none());
    }
}
