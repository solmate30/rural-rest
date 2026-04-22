use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

// RWA 프로그램의 account 구조를 직접 역직렬화하기 위해 import
use rural_rest_rwa::{InvestorPosition, PropertyStatus, PropertyToken};

declare_id!("HUbLVSmSLfmrzQrecqq2HP6hpBc6jegZbfV4Kjrx8cqD");

// =====================
// Constants
// =====================
const MAX_TITLE_LEN: usize = 128;
const MAX_URI_LEN: usize = 256;
const BPS_DENOMINATOR: u64 = 10_000;
const MIN_VOTING_PERIOD: i64 = 86_400;      // 1일
const MAX_VOTING_PERIOD: i64 = 2_592_000;    // 30일

#[program]
pub mod rural_rest_dao {
    use super::*;

    /// DAO 초기화. DaoConfig PDA 생성 및 파라미터 설정.
    pub fn initialize_dao(
        ctx: Context<InitializeDao>,
        voting_period: i64,
        quorum_bps: u16,
        approval_threshold_bps: u16,
        voting_cap_bps: u16,
        rwa_program: Pubkey,
    ) -> Result<()> {
        // 파라미터 범위 검증
        require!(voting_period > 0, DaoError::InvalidVotingPeriod);
        require!(quorum_bps > 0 && quorum_bps <= 10_000, DaoError::InvalidQuorum);
        require!(
            approval_threshold_bps > 0 && approval_threshold_bps <= 10_000,
            DaoError::InvalidThreshold
        );
        require!(voting_cap_bps > 0 && voting_cap_bps <= 10_000, DaoError::InvalidVotingCap);

        let config = &mut ctx.accounts.dao_config;
        config.authority = ctx.accounts.authority.key();
        config.council_mint = ctx.accounts.council_mint.key();
        config.voting_period = voting_period;
        config.quorum_bps = quorum_bps;
        config.approval_threshold_bps = approval_threshold_bps;
        config.voting_cap_bps = voting_cap_bps;
        config.proposal_count = 0;
        config.rwa_program = rwa_program;
        config.bump = ctx.bumps.dao_config;

        Ok(())
    }

    /// 제안 생성. Council Token 보유자만 호출 가능.
    /// remaining_accounts: Active 상태 PropertyToken 계정들 (total_eligible_weight 스냅샷)
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        title: String,
        description_uri: String,
        category: ProposalCategory,
        custom_voting_period: i64,
    ) -> Result<()> {
        // 파라미터 검증
        require!(title.len() <= MAX_TITLE_LEN, DaoError::TitleTooLong);
        require!(
            description_uri.len() <= MAX_URI_LEN,
            DaoError::DescriptionUriTooLong
        );

        // Council Token 잔액 검증
        require!(
            ctx.accounts.creator_council_ata.amount >= 1,
            DaoError::InsufficientCouncilTokens
        );

        // remaining accounts에서 Active PropertyToken의 tokens_sold 합산
        let rwa_program_id = ctx.accounts.dao_config.rwa_program;
        let mut total_eligible_weight: u64 = 0;

        // 중복 PropertyToken 전달 방지
        let mut seen_keys: Vec<Pubkey> = Vec::with_capacity(ctx.remaining_accounts.len());

        for account_info in ctx.remaining_accounts.iter() {
            // 동일 계정 중복 전달 차단
            require!(
                !seen_keys.contains(&account_info.key()),
                DaoError::DuplicatePropertyAccount
            );
            seen_keys.push(account_info.key());

            // owner가 RWA 프로그램인지 검증
            require!(
                account_info.owner == &rwa_program_id,
                DaoError::InvalidPropertyAccount
            );

            let data = account_info.try_borrow_data()?;
            // Anchor discriminator(8바이트) 건너뛰고 역직렬화
            let property_token =
                PropertyToken::try_deserialize(&mut &data[..])?;

            require!(
                property_token.status == PropertyStatus::Active,
                DaoError::InvalidPropertyStatus
            );

            total_eligible_weight = total_eligible_weight
                .checked_add(property_token.tokens_sold)
                .ok_or(DaoError::MathOverflow)?;
        }

        let config = &mut ctx.accounts.dao_config;
        let proposal_id = config.proposal_count;
        config.proposal_count = config
            .proposal_count
            .checked_add(1)
            .ok_or(DaoError::MathOverflow)?;

        let now = Clock::get()?.unix_timestamp;
        // custom_voting_period > 0이면 커스텀 기간 사용, 아니면 기본값
        let effective_period = if custom_voting_period > 0 {
            require!(
                custom_voting_period >= MIN_VOTING_PERIOD,
                DaoError::VotingPeriodTooShort
            );
            require!(
                custom_voting_period <= MAX_VOTING_PERIOD,
                DaoError::VotingPeriodTooLong
            );
            custom_voting_period
        } else {
            config.voting_period
        };
        let voting_ends_at = now
            .checked_add(effective_period)
            .ok_or(DaoError::MathOverflow)?;

        let proposal = &mut ctx.accounts.proposal;
        proposal.id = proposal_id;
        proposal.creator = ctx.accounts.creator.key();
        proposal.title = title;
        proposal.description_uri = description_uri;
        proposal.category = category;
        proposal.status = ProposalStatus::Voting;
        proposal.votes_for = 0;
        proposal.votes_against = 0;
        proposal.votes_abstain = 0;
        proposal.voter_count = 0;
        proposal.total_eligible_weight = total_eligible_weight;
        proposal.voting_starts_at = now;
        proposal.voting_ends_at = voting_ends_at;
        proposal.created_at = now;
        proposal.bump = ctx.bumps.proposal;

        Ok(())
    }

    /// 투표. RWA 보유량 + Council Token 잔액 합산으로 가중치 계산, 10% 캡 적용.
    /// remaining_accounts: [PropertyToken_1, InvestorPosition_1, PropertyToken_2, InvestorPosition_2, ...]
    /// 각 쌍에서 PropertyToken.status == Active 검증 + token_mint 일치 검증
    pub fn cast_vote(ctx: Context<CastVote>, vote_type: VoteType) -> Result<()> {
        let proposal = &ctx.accounts.proposal;

        // 투표 기간 검증
        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= proposal.voting_starts_at,
            DaoError::VotingNotStarted
        );
        require!(now <= proposal.voting_ends_at, DaoError::VotingEnded);
        require!(
            proposal.status == ProposalStatus::Voting,
            DaoError::InvalidProposalStatus
        );

        // remaining accounts: [PropertyToken, InvestorPosition] 쌍으로 전달
        require!(
            ctx.remaining_accounts.len() % 2 == 0,
            DaoError::InvalidRemainingAccounts
        );

        let rwa_program_id = ctx.accounts.dao_config.rwa_program;
        let voter_key = ctx.accounts.voter.key();
        let mut raw_weight: u64 = 0;

        // 중복 방지
        let pair_count = ctx.remaining_accounts.len() / 2;
        let mut seen_property_keys: Vec<Pubkey> = Vec::with_capacity(pair_count);
        let mut seen_position_keys: Vec<Pubkey> = Vec::with_capacity(pair_count);

        for chunk in ctx.remaining_accounts.chunks(2) {
            let pt_info = &chunk[0];
            let ip_info = &chunk[1];

            // PropertyToken 중복 방지
            require!(
                !seen_property_keys.contains(&pt_info.key()),
                DaoError::DuplicatePropertyAccount
            );
            seen_property_keys.push(pt_info.key());

            // InvestorPosition 중복 방지
            require!(
                !seen_position_keys.contains(&ip_info.key()),
                DaoError::DuplicatePositionAccount
            );
            seen_position_keys.push(ip_info.key());

            // PropertyToken 검증: owner, status
            require!(
                pt_info.owner == &rwa_program_id,
                DaoError::InvalidPropertyAccount
            );
            let pt_data = pt_info.try_borrow_data()?;
            let property_token =
                PropertyToken::try_deserialize(&mut &pt_data[..])?;
            require!(
                property_token.status == PropertyStatus::Active,
                DaoError::InvalidPropertyStatus
            );

            // InvestorPosition 검증: owner (program), owner (voter)
            require!(
                ip_info.owner == &rwa_program_id,
                DaoError::InvalidPositionAccount
            );
            let ip_data = ip_info.try_borrow_data()?;
            let position =
                InvestorPosition::try_deserialize(&mut &ip_data[..])?;
            require!(
                position.owner == voter_key,
                DaoError::InvalidPositionOwner
            );

            // PropertyToken ↔ InvestorPosition 연결 검증 (동일 매물인지)
            require!(
                position.token_mint == property_token.token_mint,
                DaoError::PositionPropertyMismatch
            );

            raw_weight = raw_weight
                .checked_add(position.amount)
                .ok_or(DaoError::MathOverflow)?;
        }

        require!(raw_weight > 0, DaoError::NoVotingPower);

        // 10% 캡 적용 (최소 1 보장: 소규모 풀에서 정수 나눗셈으로 0이 되는 것 방지)
        let cap_raw = (proposal.total_eligible_weight as u128)
            .checked_mul(ctx.accounts.dao_config.voting_cap_bps as u128)
            .ok_or(DaoError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(DaoError::MathOverflow)? as u64;

        let cap = cap_raw.max(1);
        let weight = raw_weight.min(cap);

        // Proposal 투표수 업데이트
        let proposal = &mut ctx.accounts.proposal;
        match vote_type {
            VoteType::For => {
                proposal.votes_for = proposal
                    .votes_for
                    .checked_add(weight)
                    .ok_or(DaoError::MathOverflow)?;
            }
            VoteType::Against => {
                proposal.votes_against = proposal
                    .votes_against
                    .checked_add(weight)
                    .ok_or(DaoError::MathOverflow)?;
            }
            VoteType::Abstain => {
                proposal.votes_abstain = proposal
                    .votes_abstain
                    .checked_add(weight)
                    .ok_or(DaoError::MathOverflow)?;
            }
        }

        // VoteRecord 생성
        let vote_record = &mut ctx.accounts.vote_record;
        vote_record.proposal = proposal.key();
        vote_record.voter = voter_key;
        vote_record.vote_type = vote_type;
        vote_record.weight = weight;
        vote_record.raw_weight = raw_weight;
        vote_record.bump = ctx.bumps.vote_record;

        // 고유 투표자 수 증가
        proposal.voter_count = proposal
            .voter_count
            .checked_add(1)
            .ok_or(DaoError::MathOverflow)?;

        Ok(())
    }

    /// 투표 종료 후 결과 판정. 누구나 호출 가능 (permissionless).
    pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let proposal = &mut ctx.accounts.proposal;

        require!(now > proposal.voting_ends_at, DaoError::VotingNotEnded);
        require!(
            proposal.status == ProposalStatus::Voting,
            DaoError::InvalidProposalStatus
        );

        let total_voted = proposal
            .votes_for
            .checked_add(proposal.votes_against)
            .ok_or(DaoError::MathOverflow)?
            .checked_add(proposal.votes_abstain)
            .ok_or(DaoError::MathOverflow)?;

        let config = &ctx.accounts.dao_config;

        // 정족수: total_voted >= total_eligible_weight * quorum_bps / 10000
        let quorum_threshold = (proposal.total_eligible_weight as u128)
            .checked_mul(config.quorum_bps as u128)
            .ok_or(DaoError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(DaoError::MathOverflow)? as u64;

        let quorum_met = total_voted >= quorum_threshold;

        if !quorum_met {
            proposal.status = ProposalStatus::Defeated;
            return Ok(());
        }

        // 가결 판정: votes_for >= (votes_for + votes_against) * threshold / 10000
        // 기권은 정족수에 포함되지만 가결 판정에서 제외
        let votes_cast = proposal
            .votes_for
            .checked_add(proposal.votes_against)
            .ok_or(DaoError::MathOverflow)?;

        // votes_cast == 0인 경우 (전원 기권): 부결
        if votes_cast == 0 {
            proposal.status = ProposalStatus::Defeated;
            return Ok(());
        }

        // votes_for * 10000 >= votes_cast * threshold (오버플로우 방지를 위해 u128)
        let lhs = (proposal.votes_for as u128)
            .checked_mul(BPS_DENOMINATOR as u128)
            .ok_or(DaoError::MathOverflow)?;
        let rhs = (votes_cast as u128)
            .checked_mul(config.approval_threshold_bps as u128)
            .ok_or(DaoError::MathOverflow)?;

        if lhs >= rhs {
            proposal.status = ProposalStatus::Succeeded;
        } else {
            proposal.status = ProposalStatus::Defeated;
        }

        Ok(())
    }

    /// 제안 취소. creator 또는 authority만 호출 가능.
    pub fn cancel_proposal(ctx: Context<CancelProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        require!(
            proposal.status == ProposalStatus::Voting,
            DaoError::InvalidProposalStatus
        );

        let signer = ctx.accounts.signer.key();
        require!(
            signer == proposal.creator || signer == ctx.accounts.dao_config.authority,
            DaoError::Unauthorized
        );

        proposal.status = ProposalStatus::Cancelled;

        Ok(())
    }

    /// DaoConfig 파라미터 업데이트. authority(Squads multisig)만 호출 가능.
    /// 변경하지 않을 필드는 현재값 그대로 전달.
    pub fn update_dao_config(
        ctx: Context<UpdateDaoConfig>,
        voting_period: i64,
        quorum_bps: u16,
        approval_threshold_bps: u16,
        voting_cap_bps: u16,
    ) -> Result<()> {
        require!(voting_period > 0, DaoError::InvalidVotingPeriod);
        require!(quorum_bps > 0 && quorum_bps <= 10_000, DaoError::InvalidQuorum);
        require!(
            approval_threshold_bps > 0 && approval_threshold_bps <= 10_000,
            DaoError::InvalidThreshold
        );
        require!(voting_cap_bps > 0 && voting_cap_bps <= 10_000, DaoError::InvalidVotingCap);

        let config = &mut ctx.accounts.dao_config;
        config.voting_period = voting_period;
        config.quorum_bps = quorum_bps;
        config.approval_threshold_bps = approval_threshold_bps;
        config.voting_cap_bps = voting_cap_bps;

        Ok(())
    }

    /// Authority 이전. 현재 authority만 호출 가능.
    pub fn transfer_authority(
        ctx: Context<UpdateDaoConfig>,
        new_authority: Pubkey,
    ) -> Result<()> {
        ctx.accounts.dao_config.authority = new_authority;
        Ok(())
    }
}

// =====================
// Enums
// =====================
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum ProposalCategory {
    Operations,
    Guidelines,
    FundUsage,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum ProposalStatus {
    Voting,
    Succeeded,
    Defeated,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum VoteType {
    For,
    Against,
    Abstain,
}

// =====================
// State Accounts
// =====================
#[account]
#[derive(InitSpace)]
pub struct DaoConfig {
    pub authority: Pubkey,
    pub council_mint: Pubkey,
    pub voting_period: i64,
    pub quorum_bps: u16,
    pub approval_threshold_bps: u16,
    pub voting_cap_bps: u16,
    pub proposal_count: u64,
    pub rwa_program: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub id: u64,
    pub creator: Pubkey,
    #[max_len(128)]
    pub title: String,
    #[max_len(256)]
    pub description_uri: String,
    pub category: ProposalCategory,
    pub status: ProposalStatus,
    pub votes_for: u64,
    pub votes_against: u64,
    pub votes_abstain: u64,
    pub total_eligible_weight: u64,
    pub voter_count: u32,
    pub voting_starts_at: i64,
    pub voting_ends_at: i64,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub vote_type: VoteType,
    pub weight: u64,
    pub raw_weight: u64,
    pub bump: u8,
}

// =====================
// Instruction Accounts
// =====================
#[derive(Accounts)]
pub struct InitializeDao<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + DaoConfig::INIT_SPACE,
        seeds = [b"dao_config"],
        bump,
    )]
    pub dao_config: Account<'info, DaoConfig>,

    /// Council Token Mint (Token-2022)
    pub council_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"dao_config"],
        bump = dao_config.bump,
    )]
    pub dao_config: Account<'info, DaoConfig>,

    #[account(
        init,
        payer = creator,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", dao_config.proposal_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub proposal: Account<'info, Proposal>,

    /// creator의 Council Token ATA (잔액 >= 1 검증)
    #[account(
        associated_token::mint = dao_config.council_mint,
        associated_token::authority = creator,
        associated_token::token_program = token_program,
    )]
    pub creator_council_ata: InterfaceAccount<'info, TokenAccount>,

    /// Council Token Mint (supply → total_eligible_weight 포함)
    #[account(address = dao_config.council_mint)]
    pub council_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(vote_type: VoteType)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        seeds = [b"dao_config"],
        bump = dao_config.bump,
    )]
    pub dao_config: Account<'info, DaoConfig>,

    #[account(
        mut,
        seeds = [b"proposal", proposal.id.to_le_bytes().as_ref()],
        bump = proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(
        init,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"vote", proposal.id.to_le_bytes().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub vote_record: Account<'info, VoteRecord>,

    /// Voter의 Council Token ATA (Optional — Council member가 아니면 None)
    pub voter_council_ata: Option<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    #[account(
        seeds = [b"dao_config"],
        bump = dao_config.bump,
    )]
    pub dao_config: Account<'info, DaoConfig>,

    #[account(
        mut,
        seeds = [b"proposal", proposal.id.to_le_bytes().as_ref()],
        bump = proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,
}

#[derive(Accounts)]
pub struct CancelProposal<'info> {
    pub signer: Signer<'info>,

    #[account(
        seeds = [b"dao_config"],
        bump = dao_config.bump,
    )]
    pub dao_config: Account<'info, DaoConfig>,

    #[account(
        mut,
        seeds = [b"proposal", proposal.id.to_le_bytes().as_ref()],
        bump = proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,
}

#[derive(Accounts)]
pub struct UpdateDaoConfig<'info> {
    #[account(
        constraint = authority.key() == dao_config.authority @ DaoError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"dao_config"],
        bump = dao_config.bump,
    )]
    pub dao_config: Account<'info, DaoConfig>,
}

// =====================
// Errors
// =====================
#[error_code]
pub enum DaoError {
    #[msg("Voting period must be positive.")]
    InvalidVotingPeriod, // 6000
    #[msg("Quorum BPS must be <= 10000.")]
    InvalidQuorum, // 6001
    #[msg("Approval threshold BPS must be <= 10000.")]
    InvalidThreshold, // 6002
    #[msg("Voting cap BPS must be <= 10000.")]
    InvalidVotingCap, // 6003
    #[msg("Title exceeds 128 bytes.")]
    TitleTooLong, // 6004
    #[msg("Description URI exceeds 256 bytes.")]
    DescriptionUriTooLong, // 6005
    #[msg("Creator must hold at least 1 Council Token.")]
    InsufficientCouncilTokens, // 6006
    #[msg("Voting has not started yet.")]
    VotingNotStarted, // 6007
    #[msg("Voting period has ended.")]
    VotingEnded, // 6008
    #[msg("Voting period has not ended yet.")]
    VotingNotEnded, // 6009
    #[msg("Proposal is not in the expected status.")]
    InvalidProposalStatus, // 6010
    #[msg("Voter has no voting power (0 RWA tokens and 0 Council tokens).")]
    NoVotingPower, // 6011
    #[msg("InvestorPosition owner does not match voter.")]
    InvalidPositionOwner, // 6012
    #[msg("PropertyToken is not in Active status.")]
    InvalidPropertyStatus, // 6013
    #[msg("Arithmetic overflow.")]
    MathOverflow, // 6014
    #[msg("Only creator or authority can cancel.")]
    Unauthorized, // 6015
    #[msg("Account is not owned by the RWA program.")]
    InvalidPropertyAccount, // 6016
    #[msg("Position account is not owned by the RWA program.")]
    InvalidPositionAccount, // 6017
    #[msg("Duplicate PropertyToken account in remaining accounts.")]
    DuplicatePropertyAccount, // 6018
    #[msg("Duplicate InvestorPosition account in remaining accounts.")]
    DuplicatePositionAccount, // 6019
    #[msg("Council Token ATA mint does not match dao_config.council_mint.")]
    InvalidCouncilAta, // 6020
    #[msg("Council Token ATA owner does not match voter.")]
    InvalidCouncilAtaOwner, // 6021
    #[msg("Voting period must be at least 1 day (86400 seconds).")]
    VotingPeriodTooShort, // 6022
    #[msg("Voting period must be at most 30 days (2592000 seconds).")]
    VotingPeriodTooLong, // 6023
    #[msg("Remaining accounts must be [PropertyToken, InvestorPosition] pairs (even count).")]
    InvalidRemainingAccounts, // 6024
    #[msg("InvestorPosition.token_mint does not match PropertyToken.token_mint.")]
    PositionPropertyMismatch, // 6025
}
