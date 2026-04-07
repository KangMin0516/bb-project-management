# 기획서: Assignee 아바타 필터

## 요구사항 요약

- 보드 헤더에 **assignee 아바타 아이콘 목록** 표시 (Jira 스타일)
- 실제 이슈에 배정된 멤버만 표시
- **토글 방식**: 클릭으로 on/off, 복수 선택 가능, 다시 클릭하면 해제
- 선택된 멤버: 파란 테두리로 강조
- 필터 적용 시 해당 assignee의 이슈만 각 컬럼에 표시

## 영향 범위

- **서비스**: frontend (Web)만 — 백엔드 변경 없음
- **수정 파일**:
  - `packages/web/src/pages/BoardPage.tsx` — 필터 상태 관리 + 아바타 필터 바 UI + 보드 데이터 필터링

## 구현 방안

### 1단계: 필터 상태 관리

BoardPage 컴포넌트에 `selectedAssignees: Set<string>` 상태 추가.
- 토글 로직: 클릭 시 Set에 추가/제거
- 빈 Set = 필터 없음 (전체 표시)

### 2단계: 배정된 멤버 추출

보드 데이터(`board`)에서 assignee가 있는 이슈들의 고유 멤버 목록을 추출.
`useMemo`로 board 데이터가 변경될 때만 재계산.

```typescript
const assignedMembers = useMemo(() => {
  const memberMap = new Map<string, { id, name, avatar }>()
  Object.values(board || {}).flat().forEach(issue => {
    if (issue.assignee) memberMap.set(issue.assignee.id, issue.assignee)
  })
  return [...memberMap.values()]
}, [board])
```

### 3단계: 아바타 필터 바 UI

보드 헤더 영역(프로젝트명 옆)에 아바타 아이콘 가로 나열.

```
DC Board                [A] [T] [?]  ← 클릭 가능한 아바타
DABI-CHAT                ○   ●   ○
```

- 아바타: 이니셜 원형 (28x28px)
- 선택 시: `ring-2 ring-primary-600 ring-offset-1` (파란 테두리)
- 미선택: `ring-1 ring-gray-200`
- hover: `opacity-80`

### 4단계: 보드 데이터 필터링

`BoardColumn`에 전달하는 issues를 필터링.

```typescript
const filteredBoard = useMemo(() => {
  if (selectedAssignees.size === 0) return board
  const filtered: typeof board = {}
  for (const [status, issues] of Object.entries(board || {})) {
    filtered[status] = issues.filter(issue =>
      issue.assigneeId && selectedAssignees.has(issue.assigneeId)
    )
  }
  return filtered
}, [board, selectedAssignees])
```

## API 변경사항

없음 — 프론트엔드 전용 변경.

## 리스크 및 고려사항

- 없음 (단순 프론트엔드 필터링)

## 예상 작업량

- 파일 수: 1개 (BoardPage.tsx)
- 복잡도: 낮음
