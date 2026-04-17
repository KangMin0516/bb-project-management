## 구현 완료 보고 — 자동 아카이브 (DONE/CANCELED 3일 후)

### 변경 파일 목록
| 파일 | 변경 내용 |
|------|-----------|
| `packages/api/prisma/schema.prisma` | Issue 모델에 `archivedAt DateTime?` 필드 + 복합 인덱스 추가 |
| `packages/api/src/issue/issue.service.ts` | `findAll()`, `findByStatus()` 아카이브 필터, `update()`, `reorder()` 상태 변경 시 archivedAt 리셋 |
| `packages/api/src/issue/issue.controller.ts` | board 엔드포인트에 `includeArchived` 쿼리 파라미터 |
| `packages/api/src/issue/dto/query-issue.dto.ts` | `includeArchived` boolean 필드 추가 |
| `packages/api/src/issue/issue.module.ts` | ArchiveScheduler 등록 |
| `packages/web/src/api/issues.ts` | Issue 타입에 `archivedAt`, board API에 params 추가 |
| `packages/web/src/pages/BoardPage.tsx` | "Archived" 토글 버튼 추가 |
| `packages/web/src/pages/IssuesPage.tsx` | "Archived" 토글 버튼 추가 |
| `packages/web/src/components/board/IssueCard.tsx` | 아카이브된 이슈 opacity 스타일 |

### 신규 파일
| 파일 | 내용 |
|------|------|
| `packages/api/src/issue/archive.scheduler.ts` | 매일 03:00 크론잡 — DONE/CANCELED 3일 경과 이슈 자동 아카이브 |
| `packages/api/prisma/migrations/20260417093739_add_issue_archived_at/` | DB 마이그레이션 |

### 주요 변경사항
1. **DB**: `archivedAt` nullable DateTime 컬럼 + `(status, archivedAt)` 복합 인덱스
2. **크론 스케줄러**: 매일 03:00 실행, `updatedAt < 3일 전` && `status IN (DONE, CANCELED)` && `archivedAt IS NULL` → 아카이브
3. **API 필터**: 기본값 `archivedAt = null`만 조회, `includeArchived=true` 파라미터로 아카이브 포함 가능
4. **상태 복구**: 아카이브된 이슈를 DONE/CANCELED 외 상태로 변경하면 `archivedAt = null` 자동 리셋
5. **프론트엔드**: Board/List 양쪽에 "Archived" 토글 버튼, 아카이브된 이슈는 `opacity-50`

### 자체 점검
- [x] Backend typecheck 통과 (`npx tsc --noEmit`)
- [x] Frontend build 통과 (`npx vite build`)
- [x] Prisma 마이그레이션 적용 완료
- [x] 기존 코드 패턴 일관성 유지
- [x] 불필요한 변경 없음
