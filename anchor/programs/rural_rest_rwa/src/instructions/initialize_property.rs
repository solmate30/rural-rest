use anchor_lang::prelude::*;
use crate::state::PropertyPool;

#[derive(Accounts)]
pub struct InitializeProperty<'info> {
    #[account(
        init,
        payer = authority,
        space = PropertyPool::LEN,
    )]
    pub property_pool: Account<'info, PropertyPool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeProperty>,
    total_supply: u64,
    token_price: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.property_pool;
    pool.authority = ctx.accounts.authority.key();
    pool.total_supply = total_supply;
    pool.tokens_sold = 0;
    pool.token_price = token_price;
    pool.acc_dividend_per_share = 0;
    pool.total_dividend_distributed = 0;

    Ok(())
}
