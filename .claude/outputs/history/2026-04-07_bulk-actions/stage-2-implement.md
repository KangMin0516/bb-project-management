## Stage 2: 구현 보고서 — 이슈 일괄 작업 (Bulk Actions)

### 구현 완료 항목

#### Backend (packages/api)

| 파일 | 변경 내용 |
|------|-----------|
| `src/issue/dto/bulk-update-issue.dto.ts` | 신규 — issueIds[], status?, priority?, assigneeId? 검증 |
| `src/issue/dto/bulk-delete-issue.dto.ts` | 신규 — issueIds[] 검증 |
| `src/issue/issue.controller.ts` | `@Patch('bulk')`, `@Post('bulk-delete')` 엔드포인트 추가 (`:issueId` 앞에 배치) |
| `src/issue/issue.service.ts` | `bulkUpdate()` — 트랜잭션 내 개별 activity log + 알림 생성, `bulkDelete()` — deleteMany |

#### Frontend (packages/web)

| 파일 | 변경 내용 |
|------|-----------|
| `src/api/issues.ts` | `bulkUpdate`, `bulkDelete` API 메서드 추가 |
| `src/components/issue/BulkActionBar.tsx` | 신규 — 선택 개수 표시, Status/Priority/Assignee 드롭다운, Delete, Cancel 버튼 |
| `src/pages/IssuesPage.tsx` | 체크박스 컬럼 추가 (전체 선택/개별 선택), selectedIds 상태, BulkActionBar 조건부 렌더링 |

### 주요 구현 결정

1. **라우트 순서**: NestJS에서 `bulk`, `bulk-delete` 엔드포인트를 `:issueId` param 라우트 앞에 배치하여 충돌 방지
2. **Activity log**: bulkUpdate 시 각 이슈별로 변경된 필드만 activity 기록 (기존 단건 update 패턴 유지)
3. **알림**: 담당자 일괄 변경 시 각 이슈에 대해 개별 알림 생성 (fire-and-forget `.catch(() => {})`)
4. **UI 상호작용**: 체크박스 클릭 시 `stopPropagation`으로 이슈 상세 패널 열림 방지
5. **필터바 교체**: 선택된 이슈가 있으면 필터바 대신 BulkActionBar 표시 (삼항 연산자)
6. **선택 상태 시각화**: 선택된 행에 `bg-primary-50` 배경색 적용

### 타입 체크 결과

- **web**: 에러 없음
- **api**: 기존 e2e 테스트 파일의 import 에러만 존재 (본 변경과 무관)
