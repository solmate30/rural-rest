# 17. Solana Actions & Blinks Specification

> Created: 2026-04-03
> Last Updated: 2026-04-03

본 문서는 Rural Rest 플랫폼에서 제공하는 **Solana Actions (Blinks)** 기능의 명세서입니다. 소셜 미디어 플랫폼(X 등)이나 지갑 위젯 상에서 사용자가 dApp에 별도로 접속하지 않고 바로 온체인 상호작용할 수 있도록 지원합니다.

---

## 1. 개요 (Overview)

Solana Blinks는 플랫폼 밖에서도 사용자가 쉽게 제안 투표에 참여하거나, RWA 토큰화를 통해 부동산 지분에 투자할 수 있는 통로를 제공합니다.

*   **엔드포인트 지원**: `/api/actions/*` 경로로 요청을 라우팅하여 Solana Actions 스펙(GET, POST, OPTIONS)에 맞춘 응답을 제공합니다.
*   **지원 환경**: Dialect, Phantom 지갑, X(Twitter) 확장 프로그램 등.

---

## 2. 지원되는 Actions (Supported Actions)

### 2.1. DAO Governance Voting (`/api/actions/governance/:proposalId`)

- **목적**: 커뮤니티 투표(예: DAO 제안)에 대해 찬성(For) 또는 반대(Against)를 즉시 투표합니다.
- **경로**: `/api/actions/governance/$proposalId` (Remix Route)
- **GET Response**:
  제안의 제목, 설명, 대표 이미지 및 버튼들(For, Against 등)의 스펙 및 페이로드를 포함합니다.
- **POST 처리 흐름**:
  1. 클라이언트(지갑)가 사용자가 선택한 Vote Type 전달.
  2. 서버는 투자자의 보유 포지션을 조회하고, `remaining_accounts` 등의 데이터를 준비.
  3. KYC가 완료된 유효한 유저인지 서버에서 확인 (KYC Gate).
  4. Anchor `cast_vote` 트랜잭션을 조립하여 base64 직렬화(Serialize) 후 반환.
  5. 지갑이 트랜잭션 서명 및 메인넷/데브넷에 전송.

### 2.2. RWA Investment (`/api/actions/invest/:listingId`)

- **목적**: 특정 빈집 RWA 토큰을 지갑에서 바로 투자(매수)합니다.
- **경로**: `/api/actions/invest/$listingId` (Remix Route)
- **GET Response**:
  부동산 대표 이미지, 예상 APY, 진행 상황 등의 메타데이터와 수량(Quantity) 입력 폼 렌더링.
- **POST 처리 흐름**:
  1. 클라이언트가 대상 토큰의 구매 수량(USDC 기준 등)을 파라미터로 전송.
  2. 지정된 토큰화 부동산(listing_id)의 유효성 검사.
  3. Anchor `purchase_tokens` 트랜잭션 전송을 위한 직렬화 페이로드 반환.

---

## 3. 보안 및 검증 모델 (Security & Validation)

1.  **CORS & OPTIONS Preflight**: `/api/actions/*` 라우트는 Solana 표준 헤더(`X-Action-Version`, `X-Blockchain-Ids`) 및 CORS 허용 등 필수 사양을 준수합니다.
2.  **KYC 게이트웨이**: 투표나 RWA 투자와 같이 사전 승인된 지갑만 가능한 액션에 대해, POST 메서드에서 지갑의 권한 유무를 검사합니다.
3.  **트랜잭션 빌더**: 서버단에서 Node RPC를 통해 최신 `blockhash`를 가져와 Versioned Transaction 폼으로 안전하게 조립합니다.

---

## 4. Related Documents
- **DAO Spec**: [08_DAO_IMPLEMENTATION_SPEC.md](./08_DAO_IMPLEMENTATION_SPEC.md) - 투표 및 거버넌스 구현
- **RWA Spec**: [09_RWA_ISSUANCE_SPEC.md](./09_RWA_ISSUANCE_SPEC.md) - RWA 토큰 생성 단
