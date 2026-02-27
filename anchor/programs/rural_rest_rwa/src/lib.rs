use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod rural_rest_rwa {
    use super::*;

    pub fn initialize_property(
        ctx: Context<InitializeProperty>,
        total_supply: u64,
        token_price: u64,
    ) -> Result<()> {
        instructions::initialize_property::handler(ctx, total_supply, token_price)
    }

    pub fn invest(ctx: Context<Invest>, amount: u64) -> Result<()> {
        instructions::invest::handler(ctx, amount)
    }

    pub fn add_stay_revenue(ctx: Context<AddStayRevenue>, revenue: u64) -> Result<()> {
        instructions::add_stay_revenue::handler(ctx, revenue)
    }

    pub fn claim_dividend(ctx: Context<ClaimDividend>) -> Result<()> {
        instructions::claim_dividend::handler(ctx)
    }
}
