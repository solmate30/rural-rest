# Phase 3: Specs (Completed)
> Created: 2026-02-07 17:34
> Last Updated: 2026-02-07 17:34
> Archived: 2026-02-07 18:00

## Completed Documents
- [x] `01_DB_SCHEMA.md`: Turso + Drizzle ORM 데이터베이스 스키마 명세
- [x] `02_API_SPECS.md`: React Router v7 패턴 기반 API 엔드포인트 정의
- [x] `03_STORAGE_POLICY.md`: Cloudinary 이미지 저장 및 관리 정책

## Key Achievements
- 데이터베이스 스키마 설계 완료 (Users, Listings, Bookings, Reviews, Activities)
- API 엔드포인트 명세 완료 (Loader/Action 패턴)
- 이미지 저장 정책 수립 (Cloudinary Signed Uploads)
- 기술 스택 확정 (Turso, Drizzle, React Router v7, Zod, Luxon)

## Technical Decisions
- UUID 사용으로 Enumeration Attack 방지
- JSON 필드 활용 (amenities, images)으로 스키마 단순화
- Unix Epoch Timestamp 사용으로 타임존 독립성 확보
- Zod를 통한 스키마 검증 표준화
- Luxon을 통한 날짜/시간 처리 표준화

## Next Phase
→ Phase 4: Logic (비즈니스 로직 및 구현)
