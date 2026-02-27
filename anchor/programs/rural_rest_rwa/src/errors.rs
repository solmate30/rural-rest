use anchor_lang::prelude::*;

#[error_code]
pub enum RuralRestError {
    #[msg("토큰 매진: 구매 수량이 잔여 공급량을 초과합니다.")]
    SoldOut,

    #[msg("수익 배분 불가: 아직 판매된 토큰이 없습니다.")]
    NoTokensSold,

    #[msg("권한 없음: 풀 소유자만 수익을 추가할 수 있습니다.")]
    Unauthorized,

    #[msg("수령 불가: 보유 토큰이 없습니다.")]
    NoTokensOwned,

    #[msg("수령 불가: 현재 미수령 배당금이 없습니다.")]
    NoDividendsToClaim,

    #[msg("산술 오류: 정수 연산 중 오버플로우 또는 언더플로우가 발생했습니다.")]
    ArithmeticError,
}
