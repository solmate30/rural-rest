# Tech Demo Script
> Created: 2026-04-28 00:00
> Last Updated: 2026-05-06 00:00

---

## English Script v2 (~2:50)

### [0s - 15s] Hook

"In rural Korea, there are hundreds of thousands of vacant houses.
The government fixes them — but with no one to run them, they go dark again.
Homeowners want to act, but don't know where to start.
Investors want in, but there's no way in.

The houses exist. The demand exists. But the operating infrastructure doesn't.

Rural Rest builds that missing layer."

`[화면: 홈 — 숙소 리스트]`

### [15s - 35s] Issuance

`[화면: /admin/tokenize/:id]`

"An admin registers a property and hits tokenize.

A Property Vault is created on-chain, and ownership rights are split into fractional RWA tokens.

These tokens cannot be transferred. Code blocks unauthorized secondary trading — that's what makes this RWA, not just a token."

### [35s - 55s] Investment

`[화면: /invest/:id → 구매 폼]`

"The investor signs in with email. No wallet setup. No seed phrase.

They enter the number of tokens they want — live pricing is calculated automatically. The funds are locked in a funding escrow until 60% of the goal is reached.

Goal met — escrow releases automatically, the property opens. If the goal is missed, one click on the refund button gets the full amount back — on-chain."

### [55s - 1:10] Booking

`[화면: /book/:id → 결제]`

"Guests book the property like a normal stay. Card and USDC payments are both supported.

Real booking revenue flows directly into the on-chain Property Vault."

### [1:10 - 1:20] Settlement

`[화면: /admin/settlements]`

"The operator clicks the settle button. Revenue is split automatically between the local government, the operator, and investors — in one transaction."

### [1:20 - 1:55] Tech Challenge — Dividend Claim

`[화면: slide_01_dividend.html]`

"Thousands of investors. Each joined at a different time. How do you calculate everyone's fair share — fast, with no mistakes?

Each settlement updates every investor's earnings automatically. Late investors can't take past dividends. No double-claiming.

`[화면: /my/portfolio → Claim 버튼]`

Investors just click the claim button — USDC goes into their wallet."

### [2:00 - 2:15] Chat Translation

`[화면: /my/messages/:bookingId]`

"Rural stays attract global guests. But local operators often don't speak the same language.

Messages are translated in real time inside the platform. 7 languages. No setup. No third-party app. Just seamless communication between global guests and local operators."

### [2:15 - 2:35] Blinks — Social Investing UX

`[화면: X Blink 카드]`

"Someone shares a Rural Rest property on X.

The investment interface appears directly inside the feed.

No wallet app. No address copying. No app switching.

This turns social media itself into an investment distribution channel.

No crypto knowledge needed. Just discover, click, and invest."

### [2:35 - 2:50] Closing

`[화면: 데브넷 실제 구동]`

"Everything you've seen is running live on devnet. 62 tests, all passing.

We're building the infrastructure that turns vacant houses into operating real-world assets.

Thank you."

---

## 한국어 스크립트 v2 (~2:50)

### [0s - 15s] 도입 & 후크

"안녕하세요, Rural Rest의 한수연입니다.

한국 농촌에는 수십만 채의 빈집이 있습니다.
정부가 예산을 들여 고쳐도, 운영할 사람이 없어 다시 폐가가 됩니다.
집주인은 고치고 싶어도, 엄두가 나지 않습니다.
투자자는 들어올 창구가 없습니다.

집은 있습니다. 수요도 있습니다. 그런데 운영 인프라가 없습니다.

Rural Rest가 그 빠진 연결고리를 만듭니다."

`[화면: 홈 — 숙소 리스트]`

### [15s - 35s] 토큰 발행

`[화면: /admin/tokenize/:id]`

"관리자가 숙소를 등록하고 토큰화를 누릅니다.

온체인에 숙소 금고(Property Vault)가 생성되고, 소유권이 분할된 RWA 토큰으로 발행됩니다.

이 토큰은 전송이 불가능합니다. 무단 2차 거래를 코드가 막습니다 — 단순한 토큰이 아니라 RWA인 이유입니다."

### [35s - 55s] 투자

`[화면: /invest/:id → 구매 폼]`

"투자자는 이메일로 로그인합니다. 지갑 설정도, 니모닉도 필요 없습니다.

구매할 토큰 수를 입력하면 실시간 가격이 자동으로 계산됩니다. 펀딩 목표 60% 달성까지 펀딩 에스크로에 잠깁니다.

목표가 달성되면 자동으로 에스크로가 해제되고, 숙소 운영이 시작됩니다. 실패 시엔 환불 버튼 하나로 전액 돌려받습니다."

### [55s - 1:10] 예약

`[화면: /book/:id → 결제]`

"게스트는 일반 숙소처럼 날짜를 고르고 결제합니다. 카드와 USDC 모두 지원합니다.

실제 예약 수익이 숙소의 Property Vault로 직접 흘러들어갑니다."

### [1:10 - 1:20] 정산

`[화면: /admin/settlements]`

"운영자가 정산 버튼을 클릭합니다. 지자체, 운영자, 투자자에게 자동으로 분배됩니다 — 단 하나의 트랜잭션에서."

### [1:20 - 1:55] 기술 챌린지 — 배당 클레임

`[화면: slide_01_dividend.html]`

"수천 명의 투자자, 각자 다른 진입 시점. 모두의 몫을 어떻게 정확하고 빠르게 계산할까요? 하나라도 잘못되면 안 됩니다.

정산이 일어날 때마다 각 투자자의 수익이 자동으로 업데이트됩니다. 늦게 들어온 투자자가 이전 수익을 가져가는 것도, 중복 클레임도 구조적으로 불가능합니다.

`[화면: /my/portfolio → Claim 버튼]`

투자자는 클레임 버튼 하나만 클릭하면 USDC가 지갑에 들어옵니다."

### [2:00 - 2:15] 채팅 번역

`[화면: /my/messages/:bookingId]`

"농촌 숙소에는 글로벌 게스트가 찾아옵니다. 그런데 현지 운영자는 언어가 다릅니다.

메시지는 플랫폼 안에서 실시간으로 번역됩니다. 7개 언어, 설정도, 별도 앱도 없습니다. 글로벌 게스트와 현지 운영자 사이의 소통이 끊기지 않습니다."

### [2:15 - 2:35] Blinks — 소셜 투자 UX

`[화면: X Blink 카드]`

"누군가 X에 Rural Rest 숙소를 공유합니다.

투자 인터페이스가 피드 안에 바로 나타납니다.

지갑 앱도, 주소 복사도, 앱 전환도 없습니다.

소셜 미디어 자체가 투자 유통 채널이 됩니다.

크립토를 몰라도, 발견하고, 클릭하고, 투자할 수 있습니다."

### [2:35 - 2:50] 클로징

`[화면: 데브넷 실제 구동]`

"지금 데브넷에서 돌아가고 있습니다. 62개 테스트, 전부 통과했습니다.

저희는 빈집을 운영 가능한 실물자산으로 바꾸는 인프라를 만들고 있습니다.

감사합니다."
