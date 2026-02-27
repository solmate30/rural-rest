use anchor_lang::prelude::*;
use crate::constants::PRECISION;
use crate::errors::RuralRestError;
use crate::state::{InvestmentRecord, PropertyPool};

#[derive(Accounts)]
pub struct ClaimDividend<'info> {
    #[account(mut)]
    pub property_pool: Account<'info, PropertyPool>,

    #[account(
        mut,
        seeds = [b"investment", property_pool.key().as_ref(), investor.key().as_ref()],
        bump
    )]
    pub investment_record: Account<'info, InvestmentRecord>,

    #[account(mut)]
    pub investor: Signer<'info>,
}

pub fn handler(ctx: Context<ClaimDividend>) -> Result<()> {
    let pool = &mut ctx.accounts.property_pool;
    let record = &mut ctx.accounts.investment_record;

    require!(record.token_amount > 0, RuralRestError::NoTokensOwned);

    // CORE DEFI MATH: 미수령 배당금 계산
    // accumulated_reward = tokens * acc_dividend_per_share  (PRECISION 포함 단위)
    let accumulated_reward = (record.token_amount as u128)
        .checked_mul(pool.acc_dividend_per_share)
        .ok_or(error!(RuralRestError::ArithmeticError))?;

    // reward_debt가 accumulated_reward를 초과하는 엣지케이스를 NoDividendsToClaim 으로 안전 처리
    let pending_scaled = accumulated_reward
        .checked_sub(record.reward_debt)
        .ok_or(error!(RuralRestError::NoDividendsToClaim))?;

    // PRECISION 제거하여 실제 micro-USDC 단위로 변환
    let pending_usdc = (pending_scaled / PRECISION) as u64;

    require!(pending_usdc > 0, RuralRestError::NoDividendsToClaim);

    // reward_debt를 현재 누적값으로 갱신 (다음 claim 시 중복 수령 방지)
    record.reward_debt = accumulated_reward;

    // TODO: Transfer pending_usdc micro-USDC from pool treasury to investor (mocked for MVP)
    msg!("배당금 수령: {} micro-USDC", pending_usdc);

    Ok(())
}
