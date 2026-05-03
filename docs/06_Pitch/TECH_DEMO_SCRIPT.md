# Tech Demo Script
> Created: 2026-04-28 00:00
> Last Updated: 2026-04-28 00:00

---

## English Final Script (2:55)

### [0s - 20s] Introduction

"Hey, I'm Su-yeon Han, lead developer of Rural Rest. We've built the 'Regeneration OS', a system that transforms abandoned rural properties into on-chain RWA assets to solve the regional extinction crisis. Today, I'll walk you through the core technical logic of Rural Rest—from issuance to investment management and automated settlement."

### [20s - 55s] Issuance & Compliance

"The first step is property tokenization. When an admin registers a listing, a Listing Vault is created, and the asset is minted into 100 million SPL tokens. Our priority here is 'Compliance.' We utilize Solana's Token-2022 Non-transferable extension to programmatically prevent unauthorized transfers of revenue rights. You can verify these transfer restrictions on Solscan, which serves as a foundational security layer for our RWA assets."

### [55s - 1:35s] Access & Escrow

"Next is user accessibility. Through Privy, users onboard instantly via social login without complex wallet setups. With Solana Blinks, they can view project details and enter the investment flow directly from their SNS feed. We've achieved a balance between Blinks' convenience and strict RWA compliance; while Blinks offers instant entry, the final investment is secured through our internal compliance engine. All funds are held in a program-owned escrow, which only activates upon reaching the funding goal—otherwise, the on-chain system triggers an automatic refund to minimize investor risk."

### [1:35s - 2:15s] Tech Challenge #1: Atomic Settlement

"The technical highlight of Rural Rest is the 'Atomic 3-party Settlement.' When booking revenue is generated, the operator calls the settle_listing_monthly instruction. This logic chains four CPIs to distribute funds to the local government, the operator, and the investors in a single transaction. If even one transfer fails, the entire settlement reverts. This ensures zero inconsistent states, providing all parties with a transparent, code-guaranteed revenue stream."

### [2:15s - 2:40s] Tech Challenge #2: Efficiency & Safety

"Distributed revenue is managed using the DeFi Masterchef pattern. By utilizing an accumulated dividend per share accumulator, we calculate precise dividends with O(1) efficiency, even with tens of thousands of investors. When an investor clicks 'Claim,' the system cross-references their holdings with their reward debt to trigger the USDC transfer. The entire process is protected by checked arithmetic operations at the program level, ensuring financial-grade stability."

### [2:40s - 2:55s] Architecture & Closing

"Rural Rest is built on a robust full-stack architecture using React Router v7, Drizzle ORM, and the Anchor framework. Our code, verified by 62 unit tests, is live on devnet for you to explore. We are building the standard infrastructure to revitalize the future of rural areas through technology. Thank you."

---

## 한국어 스크립트

### [0s - 15s] 도입 및 후크 (Introduction & Hook)

안녕하세요, Rural Rest의 리드 빌더 한수연입니다. 전 세계에는 수백만 채의 빈집이 방치되어 있습니다. 일본의 아키야, 이탈리아의 1유로 주택, 한국의 농촌 폐가까지 — 이는 단순한 부동산 문제가 아니라 지역 소멸의 문제입니다. Rural Rest는 이러한 유휴 자산을 온체인 RWA(실물자산) 투자 수단으로 전환합니다. 누구나 USDC로 농촌 재생에 투자하고, 매월 배당을 받으며, 자신이 지분을 가진 집에서 머무를 수 있습니다.

---

## [15s - 40s] 핵심 제품 플로우 (UX 및 토큰화)

Rural Rest의 핵심은 매끄러운 RWA 흐름입니다. 관리자가 숙소를 등록하면 리스팅 볼트(Listing Vault)가 생성되고, 하나의 숙소는 1억 개의 SPL 토큰이 됩니다. 저희는 규제 준수를 위해 솔라나의 Token-2022 '전송 불가(Non-transferable)' 익스텐션을 사용합니다. 투자자가 USDC를 납입하고 펀딩 목표 60%를 달성하면, 에스크로가 해제되고 숙소가 오픈됩니다. 만약 실패한다면? 모든 투자자는 온체인에서 자동으로 전액 환불받습니다.

---

## [40s - 1:10s] 기술 챌린지 #1: 원자적 3자 정산 (Atomic 3-party Settlement)

저희의 주요 기술적 과제는 '원자적 3자 정산'이었습니다. 매달 발생하는 숙박 수익은 지자체(40%), 운영자(30%), 투자자(30%)에게 단일 트랜잭션 내에서 나뉘어야 합니다. 이를 위해 settle_listing_monthly 명령어를 구축했습니다. 이 로직은 4개의 CPI를 체이닝하여 운영비를 회수하고 각 주체의 트레저리로 자금을 보냅니다. 단 하나의 전송이라도 실패하면 전체 정산이 롤백됩니다. 저희는 데이터의 불일치 상태가 발생하지 않도록 보장합니다.

---

## [1:10s - 1:30s] 기술 챌린지 #2: 마스터셰프 배당 패턴 (Masterchef Dividend Pattern)

배당금 분배를 위해 저희는 디파이(DeFi)의 마스터셰프 패턴을 도입했습니다. 단조 증가하는 acc_dividend_per_share(주당 누적 배당금) 축적자를 사용합니다. 각 투자자의 reward_debt(보상 부채)는 구매 시점에 기록됩니다. 클레임 시 공식은 미지급금 = 보유량 × 주당 누적 배당금 - 보상 부채입니다. 이를 통해 늦게 들어온 투자자가 과거의 배당금을 건드리는 것을 방지하며, 중복 클레임을 구조적으로 불가능하게 만듭니다.

---

## [1:30s - 1:55s] 풀스택 아키텍처 (Full-Stack Architecture)

Rural Rest 스택은 확장을 위해 구축되었습니다. 프론트엔드는 React Router v7, 오프체인 상태 관리는 Drizzle ORM을 사용하며, 솔라나 프로그램은 Rust와 Anchor로 작성되었습니다. 18개의 명령어를 구현했으며, 모든 산술 연산에는 체크드 오퍼레이션(checked operations)을 적용했습니다. Cron Jobs가 매일 밤 에스크로 해제를 처리하고, Helius 웹훅은 Blinks 투자 트랜잭션을 실시간으로 데이터베이스와 동기화합니다.

---

## [1:55s - 2:20s] 대중화의 열쇠: Blinks 및 AI (Mass Adoption Unlock)

대중화를 위해 솔라나 Blinks와 Privy를 통합했습니다. 투자자는 별도 앱 설치나 니모닉 없이 이메일 하나로 지갑을 생성하고, SNS에서 공유된 링크를 통해 바로 투자 페이지에 진입할 수 있습니다. 진입 장벽을 크립토 네이티브 수준에서 일반 소비자 수준으로 낮추는 것이 목표입니다. 또한 글로벌 게스트를 위해 AI 컨시어지를 출시했습니다. Google Gemini와 LangGraph를 기반으로 한 다국어 어시스턴트가 실시간 한국 관광 데이터를 제공하여, 언어 장벽 없는 농촌 여행을 돕습니다.

---

## [2:20s - 2:35s] 로드맵 및 클로징 (Roadmap & Closing)

저희의 로드맵에는 메인넷 권한 관리를 위한 Squads 멀티시그 전환이 포함되어 있습니다. 저희는 단순한 플랫폼이 아니라 농촌 자산을 위한 '재생 OS(Regeneration OS)'를 만들고 있습니다. 저희 레포지토리를 확인하고 데브넷에서 직접 체험해 보세요. 감사합니다.
