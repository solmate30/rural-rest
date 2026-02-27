use anchor_lang::prelude::*;
use crate::errors::RuralRestError;
use crate::state::{InvestmentRecord, PropertyPool};

#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)]
    pub property_pool: Account<'info, PropertyPool>,

    #[account(
        init_if_needed,
        payer = investor,
        space = InvestmentRecord::LEN,
        seeds = [b"investment", property_pool.key().as_ref(), investor.key().as_ref()],
        bump
    )]
    pub investment_record: Account<'info, InvestmentRecord>,

    #[account(mut)]
    pub investor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Invest>, amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.property_pool;
    let record = &mut ctx.accounts.investment_record;

    // 공급량 초과 방지
    let new_tokens_sold = pool
        .tokens_sold
        .checked_add(amount)
        .ok_or(error!(RuralRestError::ArithmeticError))?;
    require!(new_tokens_sold <= pool.total_supply, RuralRestError::SoldOut);

    // TODO: Transfer USDC from investor to pool treasury (mocked for MVP)

    if record.token_amount == 0 {
        record.investor = ctx.accounts.investor.key();
        record.property_pool = pool.key();
    }

    pool.tokens_sold = new_tokens_sold;
    record.token_amount = record
        .token_amount
        .checked_add(amount)
        .ok_or(error!(RuralRestError::ArithmeticError))?;

    // CORE DEFI MATH: 신규 토큰 수량만큼의 reward_debt를 추가하여 이전 배당금 청구를 방지
    // reward_debt += amount * current_acc_dividend_per_share (PRECISION 포함 값)
    let new_debt = (amount as u128)
        .checked_mul(pool.acc_dividend_per_share)
        .ok_or(error!(RuralRestError::ArithmeticError))?;

    record.reward_debt = record
        .reward_debt
        .checked_add(new_debt)
        .ok_or(error!(RuralRestError::ArithmeticError))?;

    Ok(())
}
