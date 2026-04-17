## 기획서: 이슈 일괄 작업 (Bulk Actions)

### 요구사항 요약
이슈 리스트(IssuesPage)에서 체크박스로 다중 선택 후, 인라인 액션바를 통해 상태/담당자/우선순위 일괄 변경 및 일괄 삭제.

---

### 구현 방안

#### 1. API — `PATCH /projects/:projectId/issues/bulk`
- 새 DTO: `BulkUpdateIssueDto` (issueIds[], status?, priority?, assigneeId?)
- issue.service에 `bulkUpdate()` 메서드 추가
- 각 이슈에 대해 activity log 생성 (기존 패턴 유지)
- 할당 변경 시 알림 생성 (기존 notification 트리거 재사용)

```
PATCH /projects/:projectId/issues/bulk
Body: { issueIds: string[], status?: string, priority?: string, assigneeId?: string | null }
Response: { updated: number }
```

#### 2. API — `POST /projects/:projectId/issues/bulk-delete`
- 새 DTO: `BulkDeleteIssueDto` (issueIds[])
- issue.service에 `bulkDelete()` 메서드 추가

```
POST /projects/:projectId/issues/bulk-delete
Body: { issueIds: string[] }
Response: { deleted: number }
```

#### 3. Web — IssuesPage 체크박스 + 선택 상태 관리
- 테이블 헤더에 전체 선택 체크박스 추가
- 각 행에 체크박스 추가
- `selectedIds: Set<string>` 상태 관리
- 체크박스 클릭 시 행 클릭 (이슈 상세 열기) 방지

#### 4. Web — BulkActionBar 컴포넌트
- 1개 이상 선택 시 필터바 영역에 오버레이로 표시
- "N selected" 카운터 + 액션 드롭다운들:
  - Status 드롭다운 (7개 상태)
  - Assignee 드롭다운 (프로젝트 멤버)
  - Priority 드롭다운 (HIGH/MEDIUM/LOW)
  - Delete 버튼 (확인 다이얼로그)
  - Cancel 버튼 (선택 해제)
- 액션 실행 후 선택 해제 + 이슈 목록 리패치

---

### 영향 범위

- **서비스**: API + Web

#### 신규 파일

| 파일 | 목적 |
|------|------|
| `packages/api/src/issue/dto/bulk-update-issue.dto.ts` | 일괄 수정 DTO |
| `packages/api/src/issue/dto/bulk-delete-issue.dto.ts` | 일괄 삭제 DTO |
| `packages/web/src/components/issue/BulkActionBar.tsx` | 인라인 액션바 |

#### 수정 파일

| 파일 | 변경 사유 |
|------|-----------|
| `packages/api/src/issue/issue.controller.ts` | bulk, bulk-delete 엔드포인트 추가 |
| `packages/api/src/issue/issue.service.ts` | bulkUpdate(), bulkDelete() 메서드 추가 |
| `packages/web/src/api/issues.ts` | bulkUpdate, bulkDelete API 클라이언트 추가 |
| `packages/web/src/pages/IssuesPage.tsx` | 체크박스 + 선택 상태 + BulkActionBar 통합 |

### 리스크
- 대량 이슈 일괄 수정 시 DB 부하 → `$transaction`으로 원자성 보장
- Activity log가 이슈 수만큼 생성됨 → 수용 가능 (기존 패턴과 동일)

### 예상 작업량
- 파일 수: 7개 (신규 3 + 수정 4)
- 복잡도: 보통
