# 구현 완료 보고: TC-003 수정 (sectionSlug NULL 중복 버그)

## 변경 파일 목록

- `packages/api/prisma/schema.prisma` — sectionSlug를 non-nullable + default("") 변경
- `packages/api/prisma/migrations/20260411064110_make_section_slug_non_nullable/migration.sql` — 기존 NULL 값 backfill + ALTER
- `packages/api/src/issue-spec-link/issue-spec-link.service.ts` — `dto.sectionSlug ?? null` → `dto.sectionSlug || ''`
- `packages/web/src/api/issues.ts` — IssueSpecLink.sectionSlug 타입: `string | null` → `string`
- `packages/web/src/api/specifications.ts` — SpecIssueLink.sectionSlug 타입: `string | null` → `string`

## 주요 변경사항

1. **DB 스키마**: `section_slug` 컬럼을 `NOT NULL DEFAULT ''`로 변경하여 PostgreSQL unique constraint가 정상 작동하도록 수정
2. **마이그레이션**: 기존 NULL 값을 빈 문자열로 backfill 후 NOT NULL 적용
3. **서비스**: `sectionSlug` 저장 시 null 대신 빈 문자열 사용
4. **프론트엔드 타입**: nullable 제거로 타입 일치

## 자체 점검

- [x] 타입 오류 없음 (API + Web 모두 통과)
- [x] Lint 통과 (prettier 자동 수정 적용)
- [x] 기존 코드 패턴과 일관성
- [x] 마이그레이션 적용 성공
- [x] 불필요한 변경 없음
