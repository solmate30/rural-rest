# Blockchain Security Audit Checklist
> Created: 2026-02-10 16:30
> Last Updated: 2026-02-10 16:30

## 1. Smart Contract (Anchor Program) Security

### 1.1. Account Validation
- [ ] 모든 인스트럭션에서 전달된 계정의 소유자(owner)가 예상 프로그램인지 검증
- [ ] `has_one`, `constraint` 매크로로 계정 관계 검증
- [ ] `Account<'info, T>` 타입으로 역직렬화 검증 보장
- [ ] 불필요한 `UncheckedAccount` 사용 최소화

### 1.2. Signer Verification
- [ ] 결제/릴리스/배당 등 민감한 인스트럭션에 `Signer` 제약 적용
- [ ] Authority 계정이 올바른 PDA 또는 지정된 공개키인지 검증
- [ ] 멀티시그 인스트럭션에서 서명 수 임계값 확인

### 1.3. PDA Seed Collision
- [ ] 모든 PDA seeds가 고유성을 보장하는지 확인
- [ ] booking_id, user_pubkey 등 유일 식별자를 seed에 포함
- [ ] bump seed를 canonical bump으로 고정 (재생성 방지)

### 1.4. Integer Overflow/Underflow
- [ ] 금액 계산에 `checked_add`, `checked_mul`, `checked_sub` 사용
- [ ] 배당 분배 시 나눗셈 잔여분 처리 (rounding dust)
- [ ] 토큰 수량 계산에 u64 범위 초과 가능성 검토

### 1.5. Reentrancy Attack
- [ ] CPI (Cross-Program Invocation) 호출 전후로 상태 변경 순서 확인
- [ ] "Checks-Effects-Interactions" 패턴 준수
- [ ] 에스크로 릴리스 시 잔액 변경 후 전송 수행

### 1.6. Arbitrary CPI
- [ ] CPI 대상 프로그램 ID를 하드코딩하여 검증
- [ ] System Program, Token Program 등 알려진 프로그램만 CPI 허용
- [ ] `invoke_signed`에서 서명 시드 노출 범위 확인

### 1.7. Close Account Drain
- [ ] 계정 닫기(close) 시 잔액이 지정된 수신자에게 전송되는지 확인
- [ ] `close = target` Anchor 매크로 활용
- [ ] 닫힌 계정의 재초기화 방지 (discriminator 체크)

---

## 2. Key Management

### 2.1. 서버 키페어 보안
- [ ] 서버 키페어가 환경 변수로만 관리 (코드에 하드코딩 없음)
- [ ] 프로덕션에서는 KMS (AWS KMS / GCP Cloud KMS) 또는 HSM 사용
- [ ] 키페어 파일이 `.gitignore`에 포함
- [ ] CI/CD 파이프라인에서 시크릿 매니저 활용

### 2.2. 프로그램 업그레이드 키 멀티시그
- [ ] Upgrade Authority가 단일 키가 아닌 멀티시그 (Squads Protocol)
- [ ] 최소 2/3 또는 3/5 서명 요구
- [ ] 업그레이드 전 코드 리뷰 + 테스트넷 검증 필수

### 2.3. Treasury 지갑 멀티시그
- [ ] Treasury Wallet이 멀티시그로 관리
- [ ] 대량 인출(임계값 초과) 시 추가 서명 요구
- [ ] 일일 인출 한도 설정

### 2.4. 사용자 지갑 키 서버 미저장
- [ ] 사용자의 개인키/시드 구문을 서버에 저장하지 않음
- [ ] 메시지 서명 검증으로 지갑 소유권만 확인
- [ ] Custodial 보관 시 별도 보안 인프라 운영

---

## 3. Client-Side Security

### 3.1. 트랜잭션 시뮬레이션
- [ ] 서명 전 `simulateTransaction`으로 결과 미리 확인
- [ ] 시뮬레이션 결과를 사용자에게 표시 (금액, 수수료, 변경 사항)
- [ ] 시뮬레이션 실패 시 서명 요청 차단

### 3.2. 피싱 방지
- [ ] 공식 도메인(ruralrest.com) 확인 안내 문구 표시
- [ ] 지갑 연결 시 "이 사이트를 신뢰하십니까?" 경고 활용
- [ ] 의심 URL 감지 로직 (homograph attack 방지)

### 3.3. 악의적 DApp 연결 방지
- [ ] Wallet Standard 준수 (표준 연결 프로토콜)
- [ ] `signTransaction` 시 인스트럭션 내용 검증 (예상과 다르면 차단)
- [ ] 자동 승인(Auto-approve) 기능 미사용

---

## 4. Infrastructure Security

### 4.1. RPC 엔드포인트 보안
- [ ] 전용 RPC 사용 (공유 노드 rate limit 회피)
- [ ] API 키 기반 인증
- [ ] Rate Limiting 설정 (분당 최대 요청 수)
- [ ] 서버사이드 RPC URL이 클라이언트에 노출되지 않음

### 4.2. 웹훅/이벤트 리스너 인증
- [ ] Helius 웹훅에 인증 토큰 설정
- [ ] 웹훅 수신 시 발신자 IP 화이트리스트 또는 서명 검증
- [ ] 웹훅 재전송(replay) 방지 (타임스탬프 + nonce)

### 4.3. 환경 분리
- [ ] Devnet/Testnet/Mainnet 환경 변수가 엄격히 분리
- [ ] 프로덕션에서 Devnet 프로그램 ID 사용 불가 검증
- [ ] `SOLANA_NETWORK` 환경 변수 기반 자동 전환
- [ ] 프로덕션 배포 전 환경 변수 체크 스크립트 실행

---

## 5. Compliance & Privacy

### 5.1. GDPR 고려
- [ ] 지갑 주소와 개인정보(이름, 이메일) 연결 시 동의 수집
- [ ] "잊힐 권리" 요청 시 오프체인 데이터 삭제 (온체인은 불변이므로 연결 해제)
- [ ] 개인정보처리방침에 블록체인 데이터 처리 조항 추가

### 5.2. 온체인 데이터 최소화
- [ ] 온체인에는 필수 데이터만 저장 (금액, 주소, 상태)
- [ ] 개인 식별 정보(PII)는 절대 온체인에 저장하지 않음
- [ ] NFT 메타데이터에 개인정보 포함 여부 검토

### 5.3. KYC 데이터 관리
- [ ] KYC 데이터는 인가된 제3자(Sumsub 등)에게만 위탁
- [ ] 서버 DB에 KYC 원본 미저장 (인증 결과만 저장)
- [ ] KYC 데이터 보존 기간 설정 (법적 요구 기간 + 삭제)

---

## 6. 감사 도구 및 프로세스

### 6.1. 자동화 감사
| 도구 | 용도 | 단계 |
|------|------|------|
| `anchor test` | 유닛 테스트 + 통합 테스트 | 개발 |
| Soteria | Anchor 프로그램 정적 분석 | CI/CD |
| Sec3 (X-ray) | 취약점 자동 스캔 | 스테이징 |

### 6.2. 외부 보안 감사
| 업체 | 특징 | 시기 |
|------|------|------|
| OtterSec | Solana 전문, 다수 주요 프로토콜 감사 | Mainnet 배포 전 |
| Neodyme | Rust/Solana 보안 전문 | 선택적 2차 감사 |
| Trail of Bits | 범용 블록체인 감사 | RWA 프로그램 전용 |

- 감사 범위: 모든 Anchor 프로그램 + 클라이언트 서명 로직
- 감사 보고서 공개 (투자자 신뢰 확보)

### 6.3. Bug Bounty 프로그램
- Mainnet 배포 후 운영
- 플랫폼: Immunefi (Web3 전문 버그 바운티)
- 보상 범위:
  - Critical (자금 손실): $5,000 - $50,000
  - High (데이터 노출): $1,000 - $5,000
  - Medium (기능 장애): $500 - $1,000

---

## 7. 감사 실행 체크리스트 (배포 전 최종)

### Phase 1 (결제) 배포 전
- [ ] Payment Program 코드 프리즈
- [ ] Anchor 테스트 전체 통과
- [ ] Soteria 정적 분석 경고 0건
- [ ] 외부 감사 완료 + 지적 사항 수정
- [ ] Devnet 2주간 무장애 운영
- [ ] 키 관리 체계 확인 (멀티시그 설정)
- [ ] 비상 정지(pause) 기능 테스트

### Phase 2 (NFT) 배포 전
- [ ] NFT Program 코드 프리즈
- [ ] Merkle Tree 생성 + Compressed NFT 민팅 테스트
- [ ] 메타데이터 영구 저장 검증 (Arweave)
- [ ] 서버 키페어 권한 최소화 확인

### Phase 3 (RWA) 배포 전
- [ ] RWA Program 외부 감사 완료 (별도 전문 감사)
- [ ] 법률 검토 완료, STO 요건 충족
- [ ] KYC 시스템 통합 테스트
- [ ] 멀티시그 Treasury 운영 테스트
- [ ] 배당 분배 시뮬레이션 (12개월 시나리오)
- [ ] Bug Bounty 프로그램 시작

---

## 8. Related Documents
- **Specs**: [Blockchain Infra Spec](../03_Technical_Specs/08_BLOCKCHAIN_INFRA_SPEC.md) - 키 관리, 프로그램 아키텍처
- **Specs**: [Solana Payment Spec](../03_Technical_Specs/09_SOLANA_PAYMENT_SPEC.md) - 결제 에러 핸들링
- **Specs**: [RWA Token Spec](../03_Technical_Specs/10_RWA_TOKEN_SPEC.md) - 법률/컴플라이언스
- **Test**: [Blockchain Test Scenarios](./06_BLOCKCHAIN_TEST_SCENARIOS.md) - 기능 테스트 케이스
- **Test**: [QA Checklist](./02_QA_CHECKLIST.md) - 기존 QA 체크리스트
