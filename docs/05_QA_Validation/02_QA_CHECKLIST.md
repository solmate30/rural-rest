# QA Checklist & Release Criteria
> Created: 2026-02-07 18:00
> Last Updated: 2026-02-07 19:00

## 1. Definition of Done (DoD)

각 Phase를 완료하기 전 반드시 다음 조건을 모두 충족해야 합니다:

### 1.1. 기능 완성도
- [ ] 모든 신규 페이지 및 주요 기능 진입 가능 (No 404/White Screen)
- [ ] 데이터가 없는 상태(Empty State)와 있는 상태에서의 UI 깨짐 없음
- [ ] 에러 발생 시 사용자에게 적절한 피드백(Toast/Alert) 제공 확인
- [ ] 콘솔(Console) 창에 심각한 에러 로그(Red Errors) 부재 확인

### 1.2. 사용자 경험
- [ ] 모바일 반응형 레이아웃 정상 작동
- [ ] 로딩 상태 인디케이터 적절히 표시됨
- [ ] 폼 유효성 검사 즉시 피드백 제공
- [ ] 접근성(Accessibility) 기본 요구사항 충족

### 1.3. 성능
- [ ] 페이지 로드 시간 < 3초 (3G 네트워크 기준)
- [ ] 이미지 최적화 적용 (WebP, 자동 리사이즈)
- [ ] API 응답 시간 < 1초 (평균)

## 2. Phase별 QA 체크리스트

### Phase 1: Foundation & Prototype
**완료 조건**:
- [ ] 모든 Foundation 문서 작성 완료 (Vision, Lean Canvas, Product Specs, Roadmap, UI Design)
- [ ] 모든 주요 화면 프로토타입 완성 (Landing, Detail, Booking, Dashboard)
- [ ] 프로토타입 리뷰 완료 및 개선사항 반영

**검증 방법**:
- [ ] 프로토타입 링크 접근 가능
- [ ] 모든 화면 스크린샷 확인
- [ ] 디자인 시스템 일관성 검토

### Phase 2: Specs & Database Setup
**완료 조건**:
- [ ] 데이터베이스 스키마 문서 작성 완료
- [ ] API 명세서 작성 완료
- [ ] Storage Policy 문서 작성 완료
- [ ] Turso 데이터베이스 연결 성공
- [ ] Drizzle ORM 스키마 마이그레이션 완료

**검증 방법**:
- [ ] 데이터베이스 연결 테스트 통과
- [ ] 스키마 마이그레이션 성공 확인
- [ ] 샘플 데이터 삽입/조회 테스트 통과

### Phase 3: Core Features Implementation
**완료 조건**:
- [ ] 인증 시스템 구현 완료 (Sign Up/Login)
- [ ] 검색 기능 구현 완료
- [ ] 예약 생성 기능 구현 완료
- [ ] 호스트 대시보드 구현 완료

**검증 방법**:
- [ ] End-to-End 사용자 여정 테스트 통과
- [ ] 모든 테스트 케이스 실행 및 통과
- [ ] 브라우저 콘솔 에러 확인 (심각한 에러 없음)

### Phase 4: Payment & Integration
**완료 조건**:
- [ ] Stripe/PayPal 결제 연동 완료
- [ ] Cloudinary 이미지 업로드 구현 완료
- [ ] Auto-Translation Chat 구현 완료

**검증 방법**:
- [ ] 결제 테스트 모드에서 성공/실패 시나리오 테스트
- [ ] 이미지 업로드 및 최적화 확인
- [ ] 번역 기능 정확도 검증

## 3. 브라우저 호환성 체크리스트

### Desktop Browsers
- [ ] Chrome (최신 버전)
- [ ] Safari (최신 버전)
- [ ] Firefox (최신 버전)
- [ ] Edge (최신 버전)

### Mobile Browsers
- [ ] iOS Safari (최신 버전)
- [ ] Android Chrome (최신 버전)

**검증 항목**:
- [ ] 레이아웃 깨짐 없음
- [ ] 터치 인터랙션 정상 작동
- [ ] 반응형 디자인 정상 작동

## 4. 보안 체크리스트

### 인증 & 권한
- [ ] 비밀번호 해싱 적용 (Argon2 또는 유사)
- [ ] 세션 토큰 만료 시간 설정
- [ ] 권한 검사 로직 구현 (Guest/Host/Admin)
- [ ] CSRF 보호 적용

### 데이터 보안
- [ ] SQL Injection 방지 (Parameterized Queries)
- [ ] XSS 방지 (Input Sanitization)
- [ ] 환경변수 보안 관리 (.env 파일 Git 제외)
- [ ] API 엔드포인트 인증 검사

### 결제 보안
- [ ] 결제 정보 서버에 저장하지 않음
- [ ] PCI DSS 준수 (Stripe/PayPal 사용)
- [ ] 결제 실패 시 적절한 에러 처리

## 5. 성능 체크리스트

### 페이지 로드
- [ ] First Contentful Paint (FCP) < 1.5초
- [ ] Largest Contentful Paint (LCP) < 2.5초
- [ ] Time to Interactive (TTI) < 3.5초

### API 응답
- [ ] 평균 응답 시간 < 1초
- [ ] 95th percentile 응답 시간 < 2초
- [ ] 에러율 < 1%

### 이미지 최적화
- [ ] WebP 포맷 자동 적용
- [ ] 이미지 리사이즈 적용 (최대 너비 1200px)
- [ ] Lazy Loading 적용

## 6. 접근성 체크리스트

### WCAG 2.1 Level AA 준수
- [ ] 키보드 네비게이션 지원
- [ ] 스크린 리더 호환성 (ARIA 레이블)
- [ ] 색상 대비 비율 4.5:1 이상
- [ ] 포커스 인디케이터 명확함

### 검증 도구
- [ ] Lighthouse Accessibility Score > 90
- [ ] axe DevTools 검사 통과
- [ ] 키보드만으로 모든 기능 사용 가능

## 7. 릴리스 전 최종 체크리스트

### 코드 품질
- [ ] 불필요한 주석 제거
- [ ] 디버깅 로그(console.log) 삭제
- [ ] 타입 정의 완료 (Any 사용 지양)
- [ ] 코드 리뷰 완료

### 문서화
- [ ] README.md 업데이트
- [ ] API 문서 최신화
- [ ] 배포 가이드 작성

### 배포 준비
- [ ] 환경변수 설정 완료 (Production)
- [ ] 데이터베이스 마이그레이션 계획 수립
- [ ] 롤백 계획 수립
- [ ] 모니터링 설정 완료

## 8. 배포 후 검증 체크리스트

### 즉시 검증 (배포 직후)
- [ ] 프로덕션 URL 접근 가능
- [ ] 주요 페이지 로드 정상
- [ ] 데이터베이스 연결 정상
- [ ] API 엔드포인트 응답 정상

### 24시간 모니터링
- [ ] 에러 로그 모니터링
- [ ] 성능 메트릭 모니터링
- [ ] 사용자 피드백 수집

## 9. QA 보고서 템플릿

### 테스트 실행 보고서
```
테스트 일시: [YYYY-MM-DD HH:mm]
테스트 환경: [Local/Staging/Production]
테스터: [이름]

총 테스트 케이스: [X]개
통과: [X]개
실패: [X]개
건너뜀: [X]개

발견된 이슈:
1. [이슈 제목]
   - 심각도: [Critical/High/Medium/Low]
   - 재현 단계: [단계별 설명]
   - 예상 수정 일정: [YYYY-MM-DD]

권장 사항:
- [권장 사항 1]
- [권장 사항 2]
```

## 10. 연속 개선 (Continuous Improvement)

### 정기 QA 사이클
- [ ] 주간 테스트 실행 (매주 금요일)
- [ ] 월간 성능 리뷰
- [ ] 분기별 보안 감사

### 피드백 수집
- [ ] 사용자 피드백 채널 운영
- [ ] 에러 리포트 자동 수집
- [ ] 성능 메트릭 대시보드 모니터링

## 11. Related Documents
- **Foundation**: [Roadmap](../01_Concept_Design/04_ROADMAP.md) - Phase별 완료 조건 및 우선순위
- **Foundation**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 기능 명세 및 사이트맵
- **Prototype**: [Landing Page Review](../02_UI_Screens/00_LANDING_PAGE_REVIEW.md) - Phase 1 프로토타입 검증 대상
- **Prototype**: [Property Detail Review](../02_UI_Screens/01_DETAIL_PAGE_REVIEW.md) - Phase 1 프로토타입 검증 대상
- **Prototype**: [Booking Page Review](../02_UI_Screens/02_BOOKING_PAGE_REVIEW.md) - Phase 1 프로토타입 검증 대상
- **Prototype**: [Admin Dashboard Review](../02_UI_Screens/03_ADMIN_DASHBOARD_REVIEW.md) - Phase 1 프로토타입 검증 대상
- **Specs**: [Database Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - Phase 2 데이터베이스 검증 대상
- **Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - Phase 2 API 검증 대상
- **Logic**: [Booking State Machine](../04_Logic_Progress/01_BOOKING_STATE_MACHINE.md) - Phase 3 비즈니스 로직 검증 대상
- **Logic**: [Search Algorithm](../04_Logic_Progress/02_SEARCH_ALGORITHM.md) - Phase 3 비즈니스 로직 검증 대상
- **Test**: [Test Scenarios](./01_TEST_SCENARIOS.md) - 상세 테스트 케이스 정의
