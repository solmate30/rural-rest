use anchor_lang::prelude::*;

#[account]
pub struct PropertyPool {
    pub authority: Pubkey,
    pub total_supply: u64,
    pub tokens_sold: u64,
    /// micro-USDC 단위 토큰 1개당 가격 (1 USDC = 1_000_000)
    pub token_price: u64,
    /// 누적 주당 배당액 (acc_dividend_per_share); PRECISION 배수가 적용된 값으로 저장
    pub acc_dividend_per_share: u128,
    pub total_dividend_distributed: u64,
}

impl PropertyPool {
    // 8 (discriminator) + 32 (authority) + 8 + 8 + 8 (token_price) + 16 (u128) + 8
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 16 + 8;
}

#[account]
pub struct InvestmentRecord {
    pub investor: Pubkey,
    pub property_pool: Pubkey,
    pub token_amount: u64,
    /// PRECISION 배수가 적용된 수령 부채 (tokens * acc_dividend_per_share)
    pub reward_debt: u128,
}

impl InvestmentRecord {
    // 8 (discriminator) + 32 + 32 + 8 + 16 (u128)
    pub const LEN: usize = 8 + 32 + 32 + 8 + 16;
}
