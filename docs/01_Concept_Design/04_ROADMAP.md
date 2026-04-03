# Product Roadmap (Now/Next/Later)
> Created: 2026-02-07 16:45
> Last Updated: 2026-04-03 00:00

This roadmap defines the strategic execution plan for **Rural Rest**, prioritizing the most critical features for solving key problems first (e.g., transport barriers).

## 1. NOW (Short-term: 3-6 Months)
**(Focus: MVP Validation & Friction Removal)**

*   **Pilot Launch (5 Houses)**: Renovate and list 5 diverse empty houses as "Signature Stays".
*   **Essential Booking Flow**:
    *   Search/Filter by Room Type (Dorm/Private).
    *   **PayPal/Stripe Integration** for Global Payments.
    *   **Auto-Translation Chat**: The #1 barrier removal for foreign guests.
*   **Manual Concierge**: Provide a "Transport Request" feature (initially handled manually by admins) to solve the "Last Mile" problem.

## 2. NEXT (Mid-term: 6-12 Months)
**(Focus: Experience Deepening & Automation)**

*   **Expansion (20 Houses)**: Scale inventory based on pilot feedback.
*   **Local Experience Platform**:
    *   Allow guests to browse and book specific village activities (e.g., "Kimchi Making Class", "Village Walking Tour").
    *   Host-side "Activity Manager" dashboard.
*   **Transport Automation**: API integration with local taxi/shuttle services.
*   **Community Features**: Guest Lounge (Bulletin Board) for carpooling and meetups.
*   **Digital Key System (Optional)**:
    *   QR code-based smart lock integration for seamless check-in.
    *   Available as an optional upgrade for hosts with smart door locks.
    *   Maintains balance between convenience and hospitality (hybrid model).
    *   See [Digital Key System Design](../04_Logic_Progress/03_DIGITAL_KEY_SYSTEM.md) for details.

## 3. LATER (Long-term: 1-3 Years)
**(Focus: Ecosystem & Governance)**

*   **Network (100+ Houses)**: Establish a nationwide "Rural Stay Network".
*   **Gamification**: Introduce "Eco-Points" or "Rural Stamps" for sustainable travel behavior.
*   **Village Governance**: Empower local communities to manage bookings and reinvest profits directly.
*   **Global Expansion**: Replicate the model in other countries facing rural depopulation (e.g., Japan's Akiya).

---

## 5. Web3 Feature Decisions (Why)

### Solana Blinks (투자 + 거버넌스)

**배경**: RWA 투자자와 DAO 참여자는 웹 앱을 직접 방문하지 않더라도 지갑 앱(Phantom, Dialect) 내에서 액션을 취할 수 있어야 한다는 UX 요구에서 출발.

**결정**: Solana Actions/Blinks 규격을 채택해 다음 두 액션을 URL로 노출.
- `/api/actions/invest/:listingId` — RWA 토큰 구매 트랜잭션 반환
- `/api/actions/governance/:proposalId` — DAO 제안 투표(찬성/반대/기권) 트랜잭션 반환

**Why Blinks**:
1. **공유 가능성**: SNS/메신저에 URL을 붙여넣으면 지갑 앱이 바로 액션 UI를 렌더링 — 투자자 유입 경로 단축
2. **지갑 네이티브 UX**: 별도 dApp 방문 없이 Phantom에서 서명 → 트랜잭션 완료
3. **KYC 게이트 유지**: POST 핸들러 서버사이드에서 KYC 검증 후 트랜잭션 빌드 — 규정 준수와 UX 동시 달성

**구현 현황** (2026-04-03 기준):
- [x] Invest Blinks 구현 완료
- [x] Governance Blinks 구현 완료 (투자자 보유 포지션 서버사이드 조회 → `remaining_accounts` 자동 구성)
- [ ] 배포 후 `dial.to` 및 Phantom에서 E2E 검증 필요

## 4. Related Documents
- **Foundation**: [Vision & Core Values](./01_VISION_CORE.md) - 장기 목표 및 성공 지표
- **Foundation**: [Lean Canvas](./02_LEAN_CANVAS.md) - 비즈니스 모델 및 수익 구조
- **Foundation**: [Product Specs](./03_PRODUCT_SPECS.md) - MVP 기능 명세
- **Foundation**: [Admin Strategy](./06_ADMIN_STRATEGY.md) - 호스트 운영 전략 및 기능 우선순위
- **Foundation**: [Happy Path Scenarios](./07_HAPPY_PATH_SCENARIOS.md) - 단계별 기능이 구현되는 사용자 여정
- **Logic**: [Digital Key System](../04_Logic_Progress/03_DIGITAL_KEY_SYSTEM.md) - Phase 2 기능 상세 설계
