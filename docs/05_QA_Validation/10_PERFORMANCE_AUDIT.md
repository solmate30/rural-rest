# 10. 성능 감사 (Performance Audit)

- **작성일**: 2026-04-12 17:00
- **갱신일**: 2026-04-12 19:30
- **대상 URL**: https://rural-rest.vercel.app/
- **측정 도구**: Lighthouse (Chrome DevTools)

---

## 기준 점수 (2026-04-12 측정)

| 항목 | 1차 기준 | 2차 재측정 | 목표 |
|------|---------|-----------|------|
| Performance | 58 | 60 (+2) | 90+ |
| Accessibility | 79 | 82 (+3) | 90+ |
| Best Practices | 77 | 77 (-) | 90+ |
| SEO | 82 | **100 (+18)** ✅ | 90+ |

### 핵심 메트릭

| 메트릭 | 1차 기준 | 2차 재측정 | 목표 |
|--------|---------|-----------|------|
| FCP (First Contentful Paint) | 7.2 s | 6.0 s ✅ | < 1.8 s |
| LCP (Largest Contentful Paint) | 9.0 s | 49.8 s ⚠️ (회귀 수정 완료) | < 2.5 s |
| TBT (Total Blocking Time) | 0 ms | 0 ms | < 200 ms |
| CLS (Cumulative Layout Shift) | 0.002 | 0.002 | < 0.1 |
| Speed Index | 7.2 s | 6.0 s | < 3.4 s |

> LCP 회귀 원인: 홈 첫 번째 카드 이미지에 `loading="lazy"` 전체 적용 → 수정 완료 (index===0 eager + fetchPriority=high)

---

## P-1. 렌더 블로킹 폰트 (CRITICAL) — 예상 절감 2,100 ms

**원인**: `root.tsx` links 함수에서 두 개의 Google Fonts CSS를 `<link rel="stylesheet">`로 동기 로드.
- `Noto Sans KR` — 한글 폰트, 파일 크기 큼
- `Material Symbols Outlined` — 아이콘 폰트, variable font (수백 KB)

두 CSS가 HTML 파싱을 차단하여 FCP 7.2 s의 주요 원인.

**수정 방법**:
- `rel="preload"` + `onload` 패턴으로 비동기 로드 전환
- `&display=swap` 쿼리 파라미터 확인 (Noto Sans KR은 이미 포함, Material Symbols는 미포함)
- Material Symbols: 사용하는 아이콘만 subset으로 로드하거나 SVG 아이콘으로 교체 검토

**수정 위치**: `web/app/root.tsx` — `links()` 함수

- [x] Noto Sans KR을 비동기 로드로 전환 (`rel="preload"` + noscript fallback)
- [x] Material Symbols Outlined를 비동기 로드로 전환
- [x] 두 폰트에 `display=swap` 적용 확인
- [x] 수정 후 Lighthouse 재측정 — FCP 7.2s → 6.0s 개선 확인

---

## P-2. 대용량 이미지 (CRITICAL)

**원인**: `/public/` 에 저장된 PNG 파일들이 비압축 상태로 서빙.

| 파일 | 원본 크기 | WebP 변환 후 |
|------|----------|------------|
| gangreung.png | 9.2 MB | 670 KB |
| angang.png | 8.3 MB | 848 KB |
| hwango.png | 8.0 MB | 777 KB |
| dongcheon.png | 7.0 MB | 554 KB |
| geoncheon.png | 6.8 MB | 510 KB |
| seonggon.png | 5.8 MB | 320 KB |
| hero.png | 96 KB | (PNG 유지 — WebP가 더 큼) |
| house.png | 113 KB | (PNG 유지 — WebP가 더 큼) |

**수정 위치**:
- `web/public/` — 이미지 파일 WebP 변환 또는 Cloudinary URL 사용
- 매물 이미지를 표시하는 컴포넌트들

- [x] 6개 대용량 PNG를 WebP로 변환 (45MB → 3.7MB, 92% 절감)
- [x] 매물 카드/상세 페이지 `<img>`에 `loading="lazy"` 추가 (첫 번째 제외)
- [x] 홈 첫 번째 카드(LCP 대상)에 `loading="eager"` + `fetchPriority="high"` 적용
- [x] property 페이지 메인 이미지에 `fetchPriority="high"` 적용
- [ ] 2차 Lighthouse에서 "Improve image delivery 8,546 KiB" 경고 잔존 — 실 DB 매물 이미지가 Cloudinary `f_auto,q_auto` 미적용 가능성 확인 필요

---

## P-3. 과도한 초기 JS 번들 (HIGH)

**원인**: `root.tsx`에서 PrivyProvider, RwaWalletProvider, Solana Kit, KycProvider 등
무거운 Web3 의존성이 모든 페이지에 동기 로드됨.

**경과**:
- Vite `manualChunks`로 vendor 청크 분리 시도 → Vercel SSR에서 FUNCTION_INVOCATION_FAILED 발생으로 롤백
- 2차 Lighthouse: "Reduce unused JavaScript 1,715 KiB" 잔존

- [x] `react-router` code splitting 현황 확인
- [x] Vite manualChunks 시도 → Vercel SSR 크래시로 롤백 (2026-04-12)
- [ ] PrivyProvider를 필요한 라우트로만 범위 축소 검토 (구조 변경 필요, 장기 과제)
- [ ] Vercel SSR 호환 청크 분리 방법 재검토

---

## P-4. i18n 번역 파일 전체 eager 로드 (MODERATE)

**원인**: `root.tsx`에서 10개 네임스페이스 × 2개 언어(ko/en) = 20개 JSON 파일을
모든 페이지 초기 로드 시 번들에 포함.

**수정 방법**:
- 현재 페이지의 언어에 해당하는 네임스페이스만 서버에서 내려줌
- 라우트별 필요한 네임스페이스만 loader에서 선택적으로 포함

- [x] root loader에서 현재 언어에 해당하는 네임스페이스만 전달하도록 수정
- [x] 초기 HTML 페이로드 ~50% 감소

---

## A-1. 접근성 개선 (Accessibility 79 → 82, 목표 90+)

2차 Lighthouse 구체 항목:
- **Buttons do not have an accessible name** — 아이콘 전용 버튼 aria-label 누락
- **Form elements do not have associated labels** — 폼 input label 연결 누락
- **Links do not have a discernible name** — 텍스트 없는 링크
- **Color contrast** — 배경/전경 색상 대비율 미달

- [x] 모든 `<img>`에 `alt` 속성 확인 — 전체 보유 확인
- [x] `<html lang>` 속성 동적 설정 확인 — root.tsx에서 locale로 설정 중
- [ ] 아이콘 전용 버튼 `aria-label` 추가 (Header, property 갤러리 버튼 등)
- [ ] 폼 요소 `<label>` 연결 (검색 필터, 예약 폼 등)
- [ ] 텍스트 없는 `<a>` 태그 `aria-label` 추가
- [ ] 색상 대비율 개선 (muted-foreground 텍스트 계열)

---

## B-1. Best Practices 개선 (77, 목표 90+)

2차 Lighthouse 구체 항목:
- **Uses third-party cookies (6개)** — Privy, Google OAuth 쿠키 (구조적 제한)
- **Missing source maps** — 대형 first-party JS 청크 소스맵 없음
- **CSP not effective against XSS** — Content-Security-Policy 헤더 미설정
- **COOP not set** — Cross-Origin-Opener-Policy 헤더 미설정
- **XFO/CSP clickjacking 방어** — X-Frame-Options 미설정

- [ ] Vercel 응답 헤더에 보안 헤더 추가 (`vercel.json` headers 설정)
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Cross-Origin-Opener-Policy: same-origin`
- [ ] CSP 헤더 설정 (Privy/Google 도메인 허용 포함)
- [ ] 서드파티 쿠키 — Privy 의존성 특성상 근본 해결 불가, 문서화로 갈음
- [x] `document.write()` 사용 없음 확인

---

## S-1. SEO (82 → 100 ✅ 달성)

- [x] 각 페이지에 고유한 `<meta name="description">` 추가 (home/search/invest/property)
- [x] Open Graph 태그 (`og:title`, `og:description`, `og:image`) 추가
- [x] `robots.txt` 추가 (/admin, /api/, /book/, /kyc 차단)
- [x] sitemap.xml 동적 라우트 추가 (/sitemap.xml)
- [ ] 구조화 데이터 (JSON-LD) — 숙박 매물 페이지 `LodgingBusiness` 스키마 (장기 과제)

---

## 작업 우선순위 (갱신)

| 우선순위 | 항목 | 상태 | 예상 점수 향상 |
|---------|------|------|--------------|
| 1 | P-1 렌더 블로킹 폰트 | ✅ 완료 | FCP -1.2s |
| 2 | P-2 대용량 이미지 WebP 변환 | ✅ 완료 | 45MB → 3.7MB |
| 3 | S-1 SEO 태그 + robots + sitemap | ✅ 완료 | SEO 100점 |
| 4 | P-4 i18n lazy load | ✅ 완료 | 페이로드 -50% |
| 5 | P-2 LCP 회귀 수정 | ✅ 완료 | LCP 회귀 해소 |
| 6 | A-1 aria-label / label 연결 | 진행 필요 | Accessibility +8 |
| 7 | B-1 보안 헤더 추가 | 진행 필요 | Best Practices +5~10 |
| 8 | P-3 JS 번들 분리 (SSR 호환) | 장기 과제 | Performance +5~10 |
| 9 | P-2 Cloudinary f_auto 적용 확인 | 확인 필요 | LCP 개선 |
