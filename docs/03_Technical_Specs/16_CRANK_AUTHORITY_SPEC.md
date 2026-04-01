# 16. Crank Authority 설계 명세

- 작성일: 2026-04-01 00:00
- 상태: 구현 완료

---

## 개요

서버에서 `releaseFunds` + `activateProperty`를 자동 호출하려면 서명 키가 필요하다.
기존 `authority`(SPV/운영자) 키를 서버에 두면 탈취 시 프로토콜 전체 권한이 노출된다.
**제한된 권한의 `crank_authority`를 도입해 자동화 전용 키로 분리**한다.

---

## 온체인 구조

### RwaConfig PDA
- seeds: `["rwa_config"]`
- 필드:
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | `authority` | Pubkey | 프로그램 권한자 (SPV/운영자) |
  | `crank_authority` | Pubkey | 자동화 전용 키 (`Pubkey::default()` = 비활성) |
  | `bump` | u8 | PDA bump |

### 명령어

| 명령어 | 권한 | 설명 |
|---|---|---|
| `initialize_config` | 1회성, 누구나 | RwaConfig 초기화, authority 설정 |
| `set_crank_authority(new_crank)` | authority만 | crank 키 변경 |
| `release_funds` | authority 또는 crank | 펀딩 vault → SPV USDC ATA |
| `activate_property` | authority 또는 crank | 상태 Active, Mint authority 소각 |
| `distribute_monthly_revenue` | authority만 | USDC 배당 — crank 불가 |

### operator 검증 로직 (Rust)
```rust
let op = ctx.accounts.operator.key();
require!(
    op == ctx.accounts.property_token.authority
        || op == ctx.accounts.rwa_config.crank_authority,
    RwaError::Unauthorized
);
```

---

## 서버 자동화 구현

### 환경 변수 (`.env`)
```
CRANK_SECRET_KEY=<base58 인코딩 private key>
USDC_MINT=<USDC mint address>
```

### 흐름
```
funded 상태 매물 감지 (DB: rwa_tokens.status = 'funded')
  ↓
tryAutoActivate(listingId)              — rwa.onchain.server.ts
  1. CRANK_SECRET_KEY로 Keypair 로드
  2. rwaConfig.crankAuthority == crank 키 확인
  3. releaseFunds (USDC → property_token.authority ATA)
  4. activateProperty (상태 Active, Mint authority 소각)
  ↓
DB 업데이트: rwa_tokens.status = 'active' — rwa.server.ts
```

### API 엔드포인트
```
POST /api/rwa/crank-activate
권한: admin 세션 필요
응답: { ok: true, activated: string[], failed: string[] }
```

---

## CRON 자동화 계획 (미구현)

현재는 관리자가 수동으로 `/api/rwa/crank-activate`를 POST해야 한다.
아래 방법 중 하나로 자동화 예정:

### 옵션 A: 서버 내 setInterval (간단)
```typescript
// app/entry.server.tsx 또는 server.ts
if (process.env.NODE_ENV === "production") {
    setInterval(async () => {
        await fetch("/api/rwa/crank-activate", {
            method: "POST",
            headers: { "x-cron-secret": process.env.CRON_SECRET! },
        });
    }, 5 * 60 * 1000); // 5분마다
}
```
- 장점: 별도 인프라 불필요
- 단점: 서버 재시작 시 타이머 리셋, 멀티 인스턴스 시 중복 실행

### 옵션 B: 외부 Cron 서비스 (권장)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs), [Upstash QStash](https://upstash.com/docs/qstash), GitHub Actions scheduled workflow 등
- 별도 `CRON_SECRET` 헤더로 인증 (admin 세션 불필요하게 변경 필요)
- 5분 간격 권장

### 옵션 C: OS cron (로컬/VPS)
```bash
# crontab -e
*/5 * * * * curl -s -X POST https://your-domain.com/api/rwa/crank-activate \
  -H "x-cron-secret: $CRON_SECRET"
```

### CRON_SECRET 인증 방식으로 변경 시
현재 `requireUser(request, ["admin"])` 대신:
```typescript
const secret = request.headers.get("x-cron-secret");
if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

## 보안 고려사항

- `CRANK_SECRET_KEY`는 `releaseFunds` + `activateProperty`만 가능 — 배당 분배·설정 변경 불가
- crank 키 탈취 시: `set_crank_authority(Pubkey::default())`로 즉시 비활성화
- `distribute_monthly_revenue`는 authority(SPV)만 가능 — crank로 자금 탈취 불가
- USDC는 `property_token.authority` ATA로만 전송 (crank 계좌로 우회 불가)

```
