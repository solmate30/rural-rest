# 18. Oracle Specification
> Created: 2026-04-07
> Updated: 2026-04-07

Rural Rest의 오라클 전략을 정의한다. 일반적인 코인 가격 오라클(Pyth)과 달리, **오프체인 부동산 데이터를 온체인에 신뢰 가능하게 연결**하는 것이 핵심 목표다.

---

## 1. 왜 오라클이 필요한가

Rural Rest는 실물 자산(빈집)을 토큰화하는 RWA 플랫폼이다. 토큰의 신뢰도는 두 가지에 달려있다:

1. **자산 가치**: "이 집이 5억짜리다" — 어드민이 타이핑한 숫자가 아닌 정부 공인 값
2. **수익 데이터**: "이번 달 수익이 300만원이다" — 어드민이 말하는 값이 아닌 검증된 실제 수익

오라클이 없으면 투자자는 루랄레스트의 말을 그냥 믿어야 한다. 오라클이 있으면 공공기관 데이터나 온체인 트랜잭션으로 검증된다.

---

## 2. 오라클이 필요한 순간 (3가지)

### 2-1. 숙소 등록 시 (1회)

| 항목 | 내용 |
|------|------|
| 시점 | `initialize_property` 실행 전 |
| 목적 | 공신력 있는 감정가를 온체인에 박기 |
| 데이터 소스 | 공공데이터포털 부동산 공시가격 API |
| 흐름 | 어드민이 주소 입력 → 서버에서 API 호출 → 공시지가 조회 → `valuation_krw` 에 포함 |
| 현재 상태 | 어드민 수동 입력 (`valuationKrw` 필드) |

**효과**: "루랄레스트가 말하는 5억" → "국토부 공시지가 기준 5억"

### 2-2. 연간 공시지가 갱신 (매년 1월, crank)

| 항목 | 내용 |
|------|------|
| 시점 | 매년 1월 (국토부 공시지가 갱신 시점) |
| 목적 | 토큰 기준가 자동 재산정 |
| 흐름 | crank 서버가 API 호출 → 변경 감지 → `update_valuation` instruction 실행 |
| Anchor | `update_valuation` instruction 추가 필요 (현재 미구현) |

### 2-3. 월간 수익 정산 (매달, crank)

| 항목 | 내용 |
|------|------|
| 시점 | 매월 말 |
| 목적 | 실제 수익 기반 3자 분배 |
| USDC 결제 | 이미 온체인 기록 → 자동 집계 가능 ✅ |
| 카드(PayPal) 결제 | 오프체인 → 어드민 수동 입력 (장기적으로 PayFi로 전환) |
| 현재 상태 | 어드민 수동 입력 후 `distribute_monthly_revenue` 실행 |

---

## 3. 구현 전략 (단계별)

```
[해커톤]
  어드민 수동 입력 → 데모 충분

[론칭 초기]
  등록 시: 공공데이터포털 API 연동 → 공시지가 자동 조회
  월간: USDC 수익 온체인 집계 자동화 (crank)
  Anchor: update_valuation instruction 추가

[성장 단계]
  카드 수익: PayFi 연동 → 즉시 온체인 기록
  분산화: Switchboard Custom Functions로 전환
           → 다수 노드가 공공데이터 API 검증
```

### 왜 Switchboard인가

Switchboard v3 Custom Functions는 특정 HTTP 엔드포인트(공공데이터포털 API)를 여러 노드가 각자 조회하고 합의한 값을 온체인에 쓴다. "루랄레스트 서버가 올린 값"이 아닌 "분산 검증된 값"이 되어 투자자 신뢰도가 높아진다.

---

## 4. Proof of Revenue (수익 오라클의 근본적 해결책)

오라클보다 더 깔끔한 방법: **모든 결제를 USDC로 유도**

```
USDC로 예약 결제
    ↓
온체인에 즉시 기록
    ↓
별도 오라클 없이 스마트 컨트랙트가 수익 집계
    ↓
distribute_monthly_revenue 자동 실행 가능
```

- **장점**: 오라클 신뢰 문제 자체가 사라짐. "Real-time Trustless Settlement" 피치 가능
- **현실**: 여행자 중 카드 결제 비율이 높음 → USDC 비율을 점진적으로 높여야 함
- **투자자는 이미 USDC** → 토큰 구매, 배당 claim 모두 USDC → 투자자 여정은 이미 해결

---

## 5. 공공데이터포털 API

### 신청
- URL: https://www.data.go.kr
- 필요한 API:
  - 국토교통부 부동산 공시가격 알리미 서비스
  - 건축물대장 정보 서비스 (주소 → 건물 정보 조회)
- 승인 기간: 1~2 영업일

### 주요 필드 (부동산 공시가격)
| 필드 | 설명 | 온체인 활용 |
|------|------|-----------|
| `pblntfPc` | 공시가격 (KRW) | `valuation_krw` |
| `stdDay` | 공시 기준일 | `valuation_updated_at` |
| `ldCode` | 법정동 코드 | 지역 검증 |

---

## 6. 온체인 데이터 구조 (PropertyToken PDA)

`PropertyToken` 계정에 오라클 필드를 직접 추가한다. 별도 Oracle PDA 불필요.

### 현재 구조
```rust
pub struct PropertyToken {
    pub valuation_krw: u64,          // 부동산 평가액 (KRW) ← 이미 있음
    pub listing_id: String,
    pub token_mint: Pubkey,
    // ... 기타 필드
}
```

### 추가 필요 필드
```rust
pub vacant_house_id: String,         // 지자체 빈집 등록번호 (추가 필요)
pub valuation_updated_at: i64,       // 마지막 공시지가 갱신 시각 Unix timestamp (추가 필요)
```

### 전체 오라클 흐름

```
[오프체인]
  공공데이터포털 API (공시지가, 건축물대장)
  지자체 빈집 등록 DB
          ↓
  Rural Rest 백엔드 서버 (crank)
  주기적으로 읽고 서명해서 푸시
          ↓
[온체인] PropertyToken PDA
  valuation_krw        ← 국토부 공시지가 (KRW)
  vacant_house_id      ← 지자체 빈집 등록번호
  valuation_updated_at ← 마지막 갱신 시각
          ↓
  RWA 토큰 → PropertyToken PDA 참조
          ↓
[장기]
  Rural Rest 서버 역할을 Switchboard Custom Functions로 대체
  → 다수 노드가 공공데이터 API 각자 조회 후 합의 → 완전 탈중앙화
```

### 단계별 신뢰 구조
| 단계 | 데이터 출처 | 신뢰 모델 |
|------|-----------|---------|
| 해커톤 | 어드민 수동 입력 | "루랄레스트 말만 믿어" |
| 론칭 초기 | Rural Rest 서버 → crank | "루랄레스트 서버가 공공데이터 읽어서 서명" |
| 성장 단계 | Switchboard 노드 네트워크 | "여러 검증자가 합의한 값" |

---

## 7. Anchor 프로그램 변경 필요 사항

| Instruction | 상태 | 내용 |
|-------------|------|------|
| `initialize_property` | ✅ 있음 | `valuation_krw` 필드에 공시지가 입력 받도록 UI 연동 필요 |
| `update_valuation` | ❌ 없음 | 연간 공시지가 갱신용, 추가 필요 |
| `distribute_monthly_revenue` | ✅ 있음 | 자동 crank로 트리거 변경 필요 (현재 어드민 수동) |

---

## 7. 공공데이터포털 API (건축물대장)

### 건축물대장이란?
한국의 모든 건물에 발급되는 공식 등록 서류. 주소, 건축연도, 면적, 용도, 소유자, 주택가격이 모두 기록되어 있다. 이 대장에 없으면 법적으로 존재하지 않는 건물.

### 신청 API
| API | 제공기관 | 용도 |
|-----|---------|------|
| 건축HUB_건축물대장정보 서비스 | 국토교통부 | 주소 → 건물 존재 확인 + 면적/연도/주택가격 조회 |

- 신청처: https://www.data.go.kr
- 신청 목적: 부동산 RWA 토큰화 플랫폼 개발
- 승인 기간: 1~2 영업일

### 엔드포인트
| 엔드포인트 | 설명 | 활용 |
|-----------|------|------|
| `/getBrTitleInfo` | 표제부 조회 | 건물명, 주소, 용도, 층수, 면적 → 숙소 기본정보 자동입력 |
| `/getBrHsprcInfo` | 주택가격 조회 | `valuation_krw` 자동입력 (핵심) |
| `/getBrBasisOuInInfo` | 기본개요 조회 | 건축연도, 구조, 면적 |
| `/getBrJijiguInfo` | 지역지구구역 조회 | 농촌 여부 검증 |

### 경주 빈집 데이터 현황
- 공공데이터포털에 경주시 전용 빈집 데이터 없음 (전국 138건 중 경상북도 없음)
- 한국농어촌공사 농촌빈집: API 없이 파일 다운로드만 가능
- **장기**: 경주시와 직접 MOU → 데이터 해자
- **단기 데모**: 실제 경주 숙소 수동 등록 + 건축물대장 API로 검증

---

## 8. 관련 문서

| 문서 | 내용 |
|------|------|
| [16_CRANK_AUTHORITY_SPEC.md](./16_CRANK_AUTHORITY_SPEC.md) | Crank 권한 구조 |
| [09_RWA_ISSUANCE_SPEC.md](./09_RWA_ISSUANCE_SPEC.md) | RWA 토큰 발행 스펙 |
| [11_ANCHOR_PROGRAM_SPEC.md](./11_ANCHOR_PROGRAM_SPEC.md) | Anchor instruction 상세 |
