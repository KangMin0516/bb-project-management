# 기획서: 이슈 리스트 강화 + 대시보드 "내 이슈"

## 요구사항 요약

- 기존 IssuesPage 테이블에 **정렬**, **타입/담당자 필터**, **마감일 컬럼**, **행 클릭 디테일 패널** 추가
- DashboardPage에 **"내 이슈" 섹션** 추가 (나에게 할당된 진행 중 이슈)
- 백엔드: 정렬 파라미터 추가 + 대시보드 API에 내 이슈 데이터 포함

## 영향 범위

- **서비스**: Backend (API) + Frontend (Web)
- **수정 파일**:
  - `packages/api/src/issue/dto/query-issue.dto.ts` — `sortBy`, `sortOrder` 파라미터 추가
  - `packages/api/src/issue/issue.service.ts` — `findAll`에 정렬 로직 추가
  - `packages/api/src/dashboard/dashboard.service.ts` — 내 이슈 조회 추가
  - `packages/web/src/api/dashboard.ts` — `DashboardStats`에 `myIssues` 필드 추가
  - `packages/web/src/pages/IssuesPage.tsx` — 정렬, 추가 필터, 마감일 컬럼, 행 클릭 디테일
  - `packages/web/src/pages/DashboardPage.tsx` — "내 이슈" 카드 섹션 추가

## 구현 방안

### 1단계: 백엔드 — 정렬 파라미터

`QueryIssueDto`에 추가:
```typescript
@IsOptional()
@IsString()
sortBy?: string; // 'number' | 'title' | 'status' | 'priority' | 'createdAt' | 'dueDate'

@IsOptional()
@IsEnum(['asc', 'desc'])
sortOrder?: 'asc' | 'desc'; // default: 'desc'
```

`findAll` 메서드에서 `orderBy`를 동적으로 구성:
```typescript
orderBy: sortBy ? { [sortBy]: sortOrder || 'desc' } : { createdAt: 'desc' },
```

### 2단계: 백엔드 — 대시보드 내 이슈

`dashboard.service.ts`의 stats 응답에 `myIssues` 추가:
```typescript
myIssues: await this.prisma.issue.findMany({
  where: {
    projectId,
    assigneeId: userId,
    status: { notIn: ['DONE', 'CANCELED'] },
  },
  include: issueInclude,
  orderBy: { dueDate: 'asc' },
  take: 10,
})
```

### 3단계: 프론트엔드 — IssuesPage 강화

**추가 필터:**
- Type 필터 (EPIC / TASK / BUG / SUB_TASK)
- Assignee 필터 (프로젝트 멤버 목록 select)

**정렬:**
- 테이블 헤더 클릭으로 정렬 토글 (asc ↔ desc)
- 정렬 활성 컬럼에 화살표 아이콘 표시
- 정렬 가능 컬럼: ID(number), Status, Priority, Due Date, Created

**마감일 컬럼:**
- Due Date 컬럼 추가 (D-day 배지와 동일한 색상 로직 재사용)

**행 클릭 디테일:**
- 행 클릭 시 BoardPage와 동일한 `IssueDetailPanel` 표시
- IssueDetailPanel을 BoardPage에서 분리하지 않고, 해당 컴포넌트를 공유 (이미 BoardPage 내 inline 함수이므로 일단 동일 패턴으로 IssuesPage에도 인라인 구현, 또는 간단히 selectedIssue state + slide-over)

### 4단계: 프론트엔드 — 대시보드 "내 이슈"

DashboardPage에 섹션 추가:
```
My Issues (N)
┌──────────┬───────────┬──────────┬──────┐
│ DC-12    │ Fix login │ D-2      │ HIGH │
│ DC-15    │ Add API   │ 4/20     │ MED  │
└──────────┴───────────┴──────────┴──────┘
```
- Summary cards 바로 아래에 배치
- 마감일 임박 순으로 정렬
- 각 행 클릭 시 해당 이슈 보드 페이지로 이동

## API 변경사항

- `GET /projects/:id/issues` — query에 `sortBy`, `sortOrder` 추가
- `GET /projects/:id/dashboard` — 응답에 `myIssues: Issue[]` 추가

## 리스크 및 고려사항

- IssueDetailPanel이 BoardPage에 인라인으로 정의되어 있어 공유가 어려움 → IssuesPage에서는 행 클릭 시 간단한 디테일 패널로 대응 (추후 컴포넌트 분리 가능)
- 정렬 파라미터의 허용 필드를 백엔드에서 화이트리스트로 제한 필요

## 예상 작업량

- 파일 수: 6개
- 복잡도: 보통
