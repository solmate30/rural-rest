# 10. 성능 감사 (Performance Audit)

- **작성일**: 2026-04-12 17:00
- **갱신일**: 2026-04-12 17:00
- **대상 URL**: https://rural-rest.vercel.app/
- **측정 도구**: Lighthouse (Chrome DevTools)

---

## 기준 점수 (2026-04-12 측정)

| 항목 | 점수 | 목표 |
|------|------|------|
| Performance | 58 | 90+ |
| Accessibility | 79 | 90+ |
| Best Practices | 77 | 90+ |
| SEO | 82 | 90+ |

### 핵심 메트릭

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| FCP (First Contentful Paint) | 7.2 s | < 1.8 s |
| LCP (Largest Contentful Paint) | 9.0 s | < 2.5 s |
| TBT (Total Blocking Time) | 0 ms | < 200 ms |
| CLS (Cumulative Layout Shift) | 0.002 | < 0.1 |
| Speed Index | 7.2 s | < 3.4 s |

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
- [ ] 수정 후 Lighthouse 재측정 — FCP 개선 확인

---

## P-2. 대용량 이미지 (CRITICAL)

**원인**: `/public/` 에 저장된 PNG 파일들이 비압축 상태로 서빙.

| 파일 | 현재 크기 |
|------|----------|
| gangreung.png | 9.2 MB |
| angang.png | 8.3 MB |
| hwango.png | 8.0 MB |
| dongcheon.png | 7.0 MB |
| geoncheon.png | 6.8 MB |
| seonggon.png | 5.8 MB |
| hero.png | 96 KB |
| house.png | 113 KB |

6개 매물 이미지 합계 약 45 MB — LCP 9.0 s의 주요 원인.

**수정 방법**:
- PNG → WebP 변환 (동일 품질 기준 60~80% 용량 절감)
- Cloudinary 이미지 변환 파라미터 적용 (`f_auto,q_auto,w_800`)
- `<img>` 태그에 `loading="lazy"` 추가 (히어로 이미지 제외)
- `width`/`height` 명시로 CLS 방지 (현재 0.002으로 양호하나 명시 권장)

**수정 위치**:
- `web/public/` — 이미지 파일 WebP 변환 또는 Cloudinary URL 사용
- 매물 이미지를 표시하는 컴포넌트들

- [ ] 6개 대용량 PNG를 WebP로 변환하거나 Cloudinary `f_auto,q_auto` URL로 교체
- [ ] 매물 카드/상세 페이지 `<img>`에 `loading="lazy"` 추가
- [ ] 히어로 이미지(LCP 대상)에 `fetchpriority="high"` 추가
- [ ] 수정 후 이미지 총 전송 크기 확인

---

## P-3. 과도한 초기 JS 번들 (HIGH)

**원인**: `root.tsx`에서 PrivyProvider, RwaWalletProvider, Solana Kit, KycProvider 등
무거운 Web3 의존성이 모든 페이지에 동기 로드됨.

추정 주요 번들:
- `@privy-io/react-auth` — 수백 KB (Wagmi, Viem, SIWE 포함)
- `@solana/kit`, `@solana/web3.js` — 수백 KB
- `@solana/wallet-adapter-*` — 다수 지갑 어댑터 포함

**수정 방법**:
- Web3 Provider들을 `/invest`, `/governance` 등 필요한 라우트에서만 로드
- `React.lazy` + `Suspense`로 PrivyProvider 지연 로드 검토
- Vite의 `build.rollupOptions.output.manualChunks`로 청크 분리

- [ ] `react-router` code splitting 현황 확인 (route별 lazy loading 여부)
- [ ] PrivyProvider를 필요한 라우트로만 범위 축소 가능 여부 검토
- [ ] Vite bundle analyzer 실행 (`npx vite-bundle-visualizer`) 후 큰 청크 확인
- [ ] 개선 후 TBT 및 JS 파싱 시간 재측정

---

## P-4. i18n 번역 파일 전체 eager 로드 (MODERATE)

**원인**: `root.tsx`에서 10개 네임스페이스 × 2개 언어(ko/en) = 20개 JSON 파일을
모든 페이지 초기 로드 시 번들에 포함.

```ts
// root.tsx — 현재: 20개 JSON 정적 import
import koCommon from "../public/locales/ko/common.json";
import enCommon from "../public/locales/en/common.json";
// ... (18개 더)
```

**수정 방법**:
- 현재 페이지의 언어에 해당하는 네임스페이스만 서버에서 내려줌
- 라우트별 필요한 네임스페이스만 loader에서 선택적으로 포함

- [ ] 라우트별 필요한 네임스페이스 목록 정리
- [ ] root loader에서 현재 언어에 해당하는 네임스페이스만 전달하도록 수정
- [ ] 번들 크기 변화 확인

---

## A-1. 접근성 개선 (Accessibility 79 → 90+)

Lighthouse 접근성 항목 주요 의심 원인:

- [ ] 모든 `<img>`에 `alt` 속성 확인 및 보완
- [ ] 버튼/아이콘에 `aria-label` 누락 여부 확인
- [ ] 색상 대비율 (Warm Beige 배경 + 연한 텍스트 조합) 확인
- [ ] `<html lang>` 속성 동적 설정 확인 (현재 root.tsx에서 locale로 설정 중 — 확인 필요)
- [ ] 폼 요소 `<label>` 연결 확인

---

## B-1. Best Practices 개선 (77 → 90+)

- [ ] 콘솔 에러/경고 제거 확인 (Privy, Solana 관련 경고 포함)
- [ ] `http://` 혼합 콘텐츠 없음 확인
- [ ] 지원 중단(deprecated) API 사용 여부 확인
- [ ] `document.write()` 사용 없음 확인

---

## S-1. SEO 개선 (82 → 90+)

- [ ] 각 페이지에 고유한 `<meta name="description">` 추가
- [ ] Open Graph 태그 (`og:title`, `og:description`, `og:image`) 추가
- [ ] `robots.txt` 존재 여부 확인
- [ ] sitemap.xml 존재 여부 확인
- [ ] 구조화 데이터 (JSON-LD) 검토 — 숙박 매물 페이지에 `LodgingBusiness` 스키마

---

## 작업 우선순위

| 우선순위 | 항목 | 예상 점수 향상 |
|---------|------|--------------|
| 1 | P-1 렌더 블로킹 폰트 | Performance +15~20 |
| 2 | P-2 대용량 이미지 최적화 | Performance +10~15 |
| 3 | A-1 접근성 | Accessibility +10 |
| 4 | S-1 SEO 태그 | SEO +8 |
| 5 | B-1 Best Practices | Best Practices +5~10 |
| 6 | P-3 JS 번들 분리 | Performance +5~10 |
| 7 | P-4 i18n lazy load | Performance +3~5 |
