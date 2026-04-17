# 기획서: Epic Swimlanes on Board

## 요구사항 요약

Jira 스타일의 "Group by Epic" 기능을 칸반 보드에 추가한다.
- 보드 헤더에 "Group: Epic" 토글 버튼 추가
- 활성화 시, 각 Epic별로 수평 Swimlane을 표시
- 각 Swimlane 내에 상태별 컬럼(TODO, IN_PROGRESS 등)이 존재하고, 해당 Epic의 자식 이슈만 표시
- Epic이 없는 이슈는 "No Epic" Swimlane에 표시
- Swimlane은 접기/펼치기 가능
- 기존 보드(flat 모드)와 토글로 전환 가능

### 레퍼런스 (Jira 스크린샷)
- Epic 헤더: `⚡ D2-1603 Manual order on Admin (1 work item) TO DO` + expand/collapse
- 각 Swimlane 내부: 상태별 미니 컬럼 (TO DO, IN_PROGRESS, DONE 등)
- 카드에 Epic 라벨 배지 표시

## 영향 범위

- **서비스**: Frontend only (API 변경 없음)
- **수정 파일**:
  - `packages/web/src/pages/BoardPage.tsx` — Swimlane 모드 상태 추가, 조건부 렌더링
  - `packages/web/src/components/board/BoardColumn.tsx` — Swimlane 내부 컬럼 compact 모드
  - `packages/web/src/components/board/IssueCard.tsx` — Swimlane 모드에서 Epic 배지 표시
- **신규 파일**:
  - `packages/web/src/components/board/SwimlaneBoardView.tsx` — Swimlane 전체 레이아웃
  - `packages/web/src/components/board/SwimlaneRow.tsx` — 개별 Epic Swimlane (헤더 + 미니 컬럼들)

## 구현 방안

### 1단계: Swimlane 토글 UI

BoardPage 헤더에 "Group: Epic" 토글 버튼 추가.
- 상태: `groupByEpic: boolean` (기본 false)
- 버튼 위치: 필터 바 우측 (Clear 버튼 옆)
- 토글 시 보드 뷰 전체 전환 (flat ↔ swimlane)

### 2단계: Swimlane 데이터 가공

기존 board 데이터(`Record<string, Issue[]>`)를 Epic 기준으로 재구성:

```typescript
// Epic별로 이슈를 그룹핑
interface SwimlaneData {
  epic: Issue | null           // null = "No Epic" 그룹
  issues: Record<string, Issue[]>  // status -> issues (해당 Epic의 자식만)
  totalCount: number
  isCollapsed: boolean
}
```

가공 로직:
1. 모든 이슈를 순회하며 `parentId`로 Epic에 매핑
2. `type === 'EPIC'`인 이슈는 Swimlane 헤더가 됨
3. `parentId`가 null이고 `type !== 'EPIC'`인 이슈 → "No Epic" Swimlane
4. Epic 자체는 카드로 표시하지 않고 Swimlane 헤더로만 표시

### 3단계: SwimlaneRow 컴포넌트

각 Epic Swimlane의 구조:
```
┌─ ⚡ PROJ-42 Epic Title (N work items) STATUS ──── [▼ collapse] ─┐
│ TODO        │ IN_PROGRESS │ REVIEW_QA   │ DONE       │ ...      │
│ ┌─────────┐ │             │             │ ┌────────┐ │          │
│ │ Card    │ │             │             │ │ Card   │ │          │
│ └─────────┘ │             │             │ └────────┘ │          │
│ + Create    │             │             │            │          │
└─────────────┴─────────────┴─────────────┴────────────┴──────────┘
```

- 헤더: Epic 아이콘 + 번호 + 제목 + 작업 수 + Epic 상태 배지 + 진행률 바
- 접기 시: 헤더만 표시 (1줄), 펼치기 시: 헤더 + 미니 컬럼 그리드
- 각 미니 컬럼: 상태 헤더 + 카드 목록 (기존 IssueCard 재사용, compact 가능)
- Drag & Drop: 미니 컬럼 간 이동 지원 (기존 reorder API 재사용)

### 4단계: Drag & Drop 통합

- 각 SwimlaneRow 내부에 독립적인 DragDropContext 사용 (또는 droppableId에 epicId prefix)
- droppableId 형식: `{epicId}:{status}` (예: `epic-123:TODO`)
- handleDragEnd에서 epicId prefix 파싱 후 기존 reorder 로직 재사용

### 5단계: 필터 연동

- 기존 필터(assignee, label, component, search 등)가 Swimlane 모드에서도 동작
- Epic 필터는 Swimlane 모드에서 특정 Swimlane만 표시하는 것으로 자연스럽게 동작
- 필터 결과 이슈가 0인 Swimlane은 숨김

## 데이터 흐름

```
board API (Record<status, Issue[]>)
  ↓
groupByEpic === false → 기존 parentOnlyBoard → flat BoardColumn
groupByEpic === true  → swimlaneData (Epic별 그룹) → SwimlaneRow × N
```

- **API 변경 없음**: 기존 board 데이터를 클라이언트에서 재구성
- 기존 `childrenMap`, `parentOnlyBoard` 로직과 공존

## UI/UX 상세

### Swimlane 헤더
- 좌측: expand/collapse 화살표 + ⚡ 아이콘 + `PROJ-42` + Epic 제목
- 중앙: `(N work items)` 카운트
- 우측: Epic 상태 배지 (TODO/IN_PROGRESS/DONE) + 진행률 미니 바

### "No Epic" Swimlane
- 제목: "No Epic" (회색)
- Epic이 없는 독립 이슈 (parentId === null && type !== 'EPIC')
- 항상 마지막에 표시

### Swimlane 정렬
- Epic 상태 순: IN_PROGRESS → TODO → BACKLOG → DONE
- 같은 상태 내에서: 이슈 수 많은 순

### Responsive
- 미니 컬럼은 가로 스크롤 (기존 보드와 동일)
- Swimlane은 세로 스크롤

## 리스크 및 고려사항

- **성능**: Epic이 많을 경우 (10+) Swimlane × Status 컬럼 수만큼 DOM 증가 → collapsed 상태의 Swimlane은 내부 미렌더링으로 최적화
- **DnD 복잡도**: 여러 DragDropContext가 중첩되면 충돌 가능 → droppableId prefix 방식으로 단일 Context 유지
- **기존 기능 보존**: flat 모드(groupByEpic=false)는 현재 코드 그대로 유지, 새 코드는 분기로만 추가

## 예상 작업량

- 파일 수: 5개 (수정 3 + 신규 2)
- 복잡도: 보통
