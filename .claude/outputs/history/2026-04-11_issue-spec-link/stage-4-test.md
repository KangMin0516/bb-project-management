# Stage 4: 테스트 통합 결과

## 전체 요약
- **전체 결과**: 통과
- **정적 분석/빌드/단위 테스트**: 통과
- **API/E2E 테스트**: 통과 (TC-003 수정 후 재검증 PASS)

---

## Part A: 정적 분석 / 빌드 / 단위 테스트

| 항목 | 결과 | 비고 |
|------|------|------|
| API typecheck | PASS | - |
| Web typecheck | PASS | - |
| API build | PASS | - |
| Web build | PASS | - |
| API lint (issue-spec-link) | PASS | prettier 자동 수정 적용 |
| Web lint (변경 파일) | PASS | 기존 에러(targetLinks 미사용, useMemo 의존성)는 이번 변경과 무관 |

---

## Part B: API / E2E 테스트

### API 테스트

| ID | 시나리오 | 기대 | 실제 | 결과 |
|----|----------|------|------|------|
| TC-001 | Create spec link | 201 | 201 | PASS |
| TC-002 | Create with sectionSlug | 201 | 201 | PASS |
| TC-003 | Duplicate (null sectionSlug) | 400 | 400 | **PASS** (수정 후) |
| TC-004 | Get by issue | 200 | 200 | PASS |
| TC-005 | Invalid specId | 400 | 400 | PASS |
| TC-006 | Non-existent specId | 404 | 404 | PASS |
| TC-007 | Missing specId | 400 | 400 | PASS |
| TC-008 | Wrong projectId (R1) | 403 | 403 | PASS |
| TC-009 | Non-existent issueId | 404 | 404 | PASS |
| TC-010 | Delete link | 200 | 200 | PASS |
| TC-011 | Delete non-existent | 404 | 404 | PASS |
| TC-012 | Wrong projectId (R2) | 403 | 403 | PASS |
| TC-013 | Wrong issueId (S6) | 404 | 404 | PASS |
| TC-014 | No auth (POST) | 401 | 401 | PASS |
| TC-015 | No auth (GET) | 401 | 401 | PASS |
| TC-016 | sectionSlug maxLength | 400 | 400 | PASS |

**API Total: 16 | PASS: 16 | FAIL: 0**

### E2E 테스트

| ID | 시나리오 | 결과 |
|----|----------|------|
| TC-E01 | Issue detail Links tab | PASS |
| TC-E02 | Spec references display | PASS |
| TC-E03 | Remove spec link | PASS |
| TC-E04 | Add Spec modal | PASS |
| TC-E05 | Search filter | PASS |
| TC-E06 | Add spec link | PASS |
| TC-E07 | SPEC_STATUS_COLORS renders | PASS |
| TC-E08 | Console errors | PASS (0 errors) |

**E2E Total: 8 | PASS: 8 | FAIL: 0**

---

## TC-003 수정 내역

**근본 원인**: PostgreSQL에서 NULL != NULL이므로 `@@unique([issueId, specId, sectionSlug])`이 NULL 값에 대해 무효.

**수정**:
1. `schema.prisma`: sectionSlug를 `String @default("")` (non-nullable)로 변경
2. 마이그레이션: 기존 NULL 값 backfill + NOT NULL 적용
3. 서비스: `dto.sectionSlug || ''` 저장
4. P2002 catch: `error instanceof Error && 'code' in error` 패턴으로 ESM/CJS 모듈 경계 안전하게 처리
5. 프론트엔드 타입: `sectionSlug: string` (nullable 제거)

---

## 판정: 전체 통과 → `/5-deploy` 진행 가능
