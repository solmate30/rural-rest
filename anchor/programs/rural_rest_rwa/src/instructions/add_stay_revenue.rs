use anchor_lang::prelude::*;
use crate::constants::PRECISION;
use crate::errors::RuralRestError;
use crate::state::PropertyPool;

#[derive(Accounts)]
pub struct AddStayRevenue<'info> {
    /// has_one = authority 로 풀 소유자만 수익을 추가할 수 있음을 보장
    #[account(mut, has_one = authority @ RuralRestError::Unauthorized)]
    pub property_pool: Account<'info, PropertyPool>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddStayRevenue>, revenue: u64) -> Result<()> {
    let pool = &mut ctx.accounts.property_pool;

    require!(pool.tokens_sold > 0, RuralRestError::NoTokensSold);

    // CORE DEFI MATH: 글로벌 DPS 업데이트 (O(1) - 투자자 수와 무관)
    // DPS += (revenue * PRECISION) / tokens_sold
    let dps_increase = (revenue as u128)
        .checked_mul(PRECISION)
        .ok_or(error!(RuralRestError::ArithmeticError))?
        .checked_div(pool.tokens_sold as u128)
        .ok_or(error!(RuralRestError::ArithmeticError))?;

    pool.acc_dividend_per_share = pool
        .acc_dividend_per_share
        .checked_add(dps_increase)
        .ok_or(error!(RuralRestError::ArithmeticError))?;

    pool.total_dividend_distributed = pool
        .total_dividend_distributed
        .checked_add(revenue)
        .ok_or(error!(RuralRestError::ArithmeticError))?;

    // TODO: Transfer USDC from authority to pool treasury (mocked for MVP)

    Ok(())
}
