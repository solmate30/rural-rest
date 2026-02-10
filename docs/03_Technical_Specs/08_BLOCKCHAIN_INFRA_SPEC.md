# Blockchain Infrastructure Specification (Solana)
> Created: 2026-02-10 16:00
> Last Updated: 2026-02-10 16:00

## 1. Technology Stack

### 1.1. Solana 체인 선택 근거
- **TPS**: ~65,000 (숙박 완료 시 NFT 민팅 + 포인트 적립 동시 처리 가능)
- **수수료**: 트랜잭션당 ~$0.00025 (매 숙박마다 NFT 발행하는 모델에 필수)
- **확인 시간**: ~400ms (결제 UX에 적합)
- **Compressed NFT**: Bubblegum 지원으로 NFT 1개 민팅 비용 $0.0001 미만
- **개발자 생태계**: Anchor Framework, Metaplex, 풍부한 TypeScript SDK

### 1.2. 핵심 라이브러리

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@solana/web3.js` | ^2.0.0 | 트랜잭션 구성, RPC 통신 |
| `@solana/wallet-adapter-react` | ^0.15.35 | React 지갑 연결 |
| `@solana/wallet-adapter-react-ui` | ^0.9.35 | 지갑 선택 모달 UI |
| `@solana/wallet-adapter-wallets` | ^0.19.32 | Phantom, Solflare 등 어댑터 |
| `@solana/spl-token` | ^0.4.0 | SPL 토큰 조작 (USDC, RWA) |
| `@coral-xyz/anchor` | ^0.30.0 | 스마트 컨트랙트 클라이언트 |
| `@metaplex-foundation/mpl-token-metadata` | ^3.0.0 | NFT 메타데이터 |
| `@metaplex-foundation/mpl-bubblegum` | ^4.0.0 | Compressed NFT |
| `@metaplex-foundation/umi` | ^0.9.0 | Metaplex 통합 프레임워크 |
| `@metaplex-foundation/umi-bundle-defaults` | ^0.9.0 | Umi 기본 번들 |

### 1.3. 네트워크 전략

| 단계 | 네트워크 | 용도 |
|------|----------|------|
| 개발 | Devnet | 로컬 개발 + CI 테스트 |
| 스테이징 | Testnet | 통합 테스트, QA |
| 프로덕션 | Mainnet-Beta | 실서비스 |

---

## 2. Architecture Overview

### 2.1. 온체인 vs 오프체인 데이터 분리

| 데이터 | 저장 위치 | 이유 |
|--------|-----------|------|
| 결제 트랜잭션 | 온체인 | 불변성, 검증 가능성 |
| 토큰 소유권 | 온체인 | 소유권 증명 |
| NFT 메타데이터 URI | 온체인 (Arweave) | 영구 저장, 탈중앙화 |
| 사용자 프로필 | Turso DB | 빈번한 조회, 개인정보 |
| 예약 상세 | Turso DB | 복잡한 쿼리, 관계형 데이터 |
| NFT 이미지 | Arweave / IPFS | 영구 저장 |
| Eco-Points 잔액 | Turso DB (캐시) + 온체인 (정산) | 빈번한 조회 + 정합성 보장 |
| 배당 이력 | 온체인 + Turso DB (인덱스) | 온체인 진본 + 빠른 조회 |

### 2.2. RPC 엔드포인트 관리

| Provider | 용도 | 특징 |
|----------|------|------|
| Helius | 메인 RPC + 웹훅 | DAS API (NFT 조회 최적), 높은 안정성 |
| QuickNode | 백업 RPC | 빠른 응답, 멀티체인 지원 |

- 프로덕션에서는 전용 RPC 노드 사용 (공유 노드 rate limit 회피)
- RPC URL은 환경 변수로 관리, 서버/클라이언트 분리

### 2.3. 서버사이드 vs 클라이언트사이드 서명 분리

| 작업 | 서명 주체 | 위치 |
|------|-----------|------|
| 결제 트랜잭션 | 사용자 지갑 | 클라이언트 |
| NFT 민팅 (플랫폼 발행) | 서버 키페어 | 서버 |
| 배당 분배 | 서버 키페어 (Treasury) | 서버 |
| RWA 토큰 매수 | 사용자 지갑 | 클라이언트 |
| 포인트 적립 | 서버 키페어 | 서버 |
| 에스크로 릴리스 | 서버 키페어 (Authority) | 서버 |

---

## 3. Wallet Integration

### 3.1. Solana Wallet Adapter 설정
```typescript
// web/app/root.tsx 내 ClientOnly 래핑 필요
import { WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// SSR 환경이므로 typeof window !== 'undefined' 가드 필수
```

### 3.2. 지원 지갑 목록
| 지갑 | 우선순위 | 비고 |
|------|----------|------|
| Phantom | 1 | 가장 높은 시장 점유율 |
| Solflare | 2 | Solana 네이티브, Ledger 지원 |
| Backpack | 3 | xNFT 지원, 젊은 사용자층 |
| Ledger | 4 | 하드웨어 지갑 (고액 투자자) |

### 3.3. user 테이블 확장
```sql
ALTER TABLE user ADD COLUMN wallet_address TEXT;
ALTER TABLE user ADD COLUMN wallet_connected_at TEXT;
```
- `walletAddress`: Solana 공개키 (base58 인코딩, 32-44자)
- `walletConnectedAt`: ISO 8601 타임스탬프
- 1 user : 1 wallet (다중 지갑은 Phase 4 검토)

### 3.4. 지갑-계정 연결 플로우
```
1. 사용자가 Better Auth로 로그인 (기존 플로우)
2. 프로필 설정에서 "Connect Wallet" 클릭
3. Wallet Adapter 모달에서 지갑 선택 + 서명 요청
4. 서버에서 서명 검증 (메시지 서명으로 소유권 확인)
5. user.walletAddress 업데이트
```

---

## 4. Program (Smart Contract) Architecture

### 4.1. Payment Program (`rural-rest-payment`)
- **기능**: SOL/USDC 에스크로 결제, 호스트 정산, 환불
- **PDA**: `[booking_id, "escrow"]` -> 에스크로 계정
- **Instructions**:
  - `create_escrow(booking_id, amount, token_mint)` -- 결제 생성
  - `release_escrow(booking_id)` -- 호스트에게 릴리스 (체크인 완료 후)
  - `refund_escrow(booking_id, amount)` -- 환불 처리
- **Authority**: 플랫폼 서버 키페어 (릴리스/환불 권한)

### 4.2. NFT Program (Metaplex 활용, `rural-rest-nft`)
- **기능**: Experience Badge 컬렉션 관리, 자동 민팅
- **Collection**: "Rural Rest Experiences" (Metaplex Certified Collection)
- **메타데이터 표준**: Metaplex Token Metadata Standard v1.1
- **Compressed NFT**: Bubblegum Merkle Tree 활용 (대량 민팅 비용 최적화)
- **Instructions** (Metaplex SDK 래핑):
  - `create_collection()` -- 컬렉션 초기화 (1회)
  - `mint_experience_badge(booking_id, metadata_uri)` -- 배지 민팅
- **Merkle Tree**: 최대 깊이 20 (약 100만 개 NFT 수용)

### 4.3. RWA Token Program (Anchor, `rural-rest-rwa`)
- **기능**: 빈집 소유권 토큰 발행, 투자, 배당 분배
- **State Accounts**:
  - `PropertyToken` -- 빈집 토큰 정보 (mint, totalSupply, valuation, status)
  - `InvestorPosition` -- 투자자별 보유 현황 (user, amount, claimedDividends)
  - `DividendPool` -- 배당 풀 (period, totalAmount, distributed)
- **Instructions**:
  - `initialize_property(valuation, total_supply)` -- 빈집 토큰 생성
  - `purchase_tokens(amount)` -- USDC로 토큰 매수
  - `distribute_dividends(period, amount)` -- 배당 분배
  - `claim_dividend()` -- 투자자 배당금 수령
  - `redeem_tokens(amount)` -- 토큰 환매 (조건부)
- **PDA 구조**:
  - `[property_mint, "property"]` -> PropertyToken
  - `[property_mint, user_pubkey, "investor"]` -> InvestorPosition
  - `[property_mint, period, "dividend"]` -> DividendPool

### 4.4. Points Program (`rural-rest-points`)
- **전략**: Phase 2 초기에는 오프체인 DB로 구현, 안정화 후 온체인 전환 검토
- **오프체인 구현**: `eco_points`, `eco_point_transactions` 테이블
- **온체인 전환 시**: SPL Token 기반 포인트 토큰 또는 커스텀 Anchor 프로그램

---

## 5. Security Architecture

### 5.1. 키 관리 전략
| 키 | 저장 방식 | 용도 |
|----|-----------|------|
| 서버 키페어 (NFT Minter) | 환경 변수 (암호화) | NFT 민팅 Authority |
| Treasury 키페어 | KMS (AWS/GCP) 또는 멀티시그 | 에스크로 릴리스, 배당 분배 |
| Program Upgrade Authority | 멀티시그 (Squads Protocol) | 프로그램 업그레이드 |
| 사용자 지갑 키 | 사용자 관리 (서버 미저장) | 결제, 투자 서명 |

### 5.2. 프로그램 업그레이드 전략
- **개발 단계**: Upgradeable (빠른 버그 수정)
- **안정화 후**: Upgrade Authority를 멀티시그(3/5)로 전환
- **최종 단계**: RWA 프로그램은 감사 완료 후 Immutable 전환 검토

### 5.3. 멀티시그 관리자 키
- Squads Protocol v4 활용 (Solana 네이티브 멀티시그)
- Treasury: 3/5 멀티시그 (창업자 2명 + 외부 감사인 3명)
- Upgrade Authority: 2/3 멀티시그 (개발팀 리드 + CTO + 보안 담당)

---

## 6. Environment Variables

```env
# Solana Network
SOLANA_NETWORK=devnet                    # devnet | testnet | mainnet-beta
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=xxx

# Program IDs (배포 후 설정)
PROGRAM_ID_PAYMENT=xxxxxxxxxxxxxxxxxxxxx
PROGRAM_ID_RWA=xxxxxxxxxxxxxxxxxxxxx
NFT_COLLECTION_MINT=xxxxxxxxxxxxxxxxxxxxx

# Keys (서버사이드 전용)
SOLANA_MINTER_KEYPAIR=base58_encoded_private_key
TREASURY_WALLET_PUBKEY=xxxxxxxxxxxxxxxxxxxxx

# RPC Provider
HELIUS_API_KEY=xxxxxxxxxxxxxxxxxxxxx

# NFT Storage
IRYS_RPC_URL=https://node1.irys.xyz
```

---

## 7. DB Schema 확장

### 7.1. user 테이블 확장
```typescript
// 기존 user 테이블에 추가
walletAddress: text("wallet_address"),
walletConnectedAt: text("wallet_connected_at"),
```

### 7.2. 신규 테이블 목록

| 테이블명 | 용도 |
|----------|------|
| `wallet_transactions` | Solana 트랜잭션 기록 (결제, 환불, 배당) |
| `nft_mints` | NFT 민팅 기록 (bookingId, mintAddress, metadataUri) |
| `eco_points` | 사용자 포인트 잔액 및 등급 |
| `eco_point_transactions` | 포인트 적립/사용 이력 |
| `rwa_tokens` | 토큰화된 빈집 정보 (listingId, mintAddress, totalSupply) |
| `rwa_investments` | 투자자별 보유 현황 |
| `rwa_dividends` | 배당 분배 이력 |

### 7.3. Drizzle ORM 마이그레이션 계획
1. `schema.ts`에 새 테이블 정의 추가
2. `npx drizzle-kit generate` 로 마이그레이션 파일 생성
3. `npx drizzle-kit push` 로 스키마 적용
4. Phase별 점진적 추가 (Phase 1: wallet_transactions, Phase 2: nft/points, Phase 3: rwa)

---

## 8. SSR 호환성 처리

React Router 7은 SSR이 활성화되어 있으므로 Solana Wallet Adapter의 브라우저 의존성을 처리해야 한다:

```typescript
// 방법 1: ClientOnly 컴포넌트
function WalletWrapper({ children }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    return <WalletProvider wallets={wallets}>{children}</WalletProvider>;
}

// 방법 2: lazy import
const WalletProvider = lazy(() => import('@solana/wallet-adapter-react'));
```

- 서버사이드 트랜잭션 검증은 `@solana/web3.js`로 직접 RPC 호출 (지갑 어댑터 불필요)
- `loader`에서는 Solana RPC로 트랜잭션 상태 조회 가능

---

## 9. Related Documents
- **Foundation**: [Blockchain Vision](../01_Concept_&_Design/08_BLOCKCHAIN_VISION.md) - Solana 선택 근거
- **Foundation**: [Blockchain Roadmap](../01_Concept_&_Design/09_BLOCKCHAIN_ROADMAP.md) - Phase별 기술 도입 순서
- **Specs**: [Solana Payment Spec](./09_SOLANA_PAYMENT_SPEC.md) - 결제 프로그램 상세
- **Specs**: [RWA Token Spec](./10_RWA_TOKEN_SPEC.md) - RWA 프로그램 상세
- **Specs**: [DB Schema](./01_DB_SCHEMA.md) - 기존 DB 스키마 (확장 대상)
- **Test**: [Blockchain Security Audit](../05_QA_&_Validation/07_BLOCKCHAIN_SECURITY_AUDIT.md) - 보안 감사 체크리스트
