## 기획서: 이슈 리스트 — 계층 트리 그룹핑 뷰

### 요구사항 요약

- 이슈 리스트 페이지에 **계층 트리 기반 그룹핑 뷰**를 추가
- Epic > Task > Sub_task 위계를 접이식 트리로 시각화
- 기존 테이블(List) 뷰와 **토글 버튼**으로 전환
- **뷰 토글은 2+개 뷰를 지원하는 공용 컴포넌트**로 설계
- 백엔드 변경 없이 프론트엔드에서 `parentId` 기반으로 트리 조립
- 기존 필터는 유지, 정렬은 계층 순서를 따름

### 영향 범위

- **서비스**: Frontend (Web)만 변경
- **수정 파일**:
  - `packages/web/src/pages/IssuesPage.tsx` — 뷰 전환 로직 + 트리 뷰 렌더링 추가
- **신규 파일**:
  - `packages/web/src/components/view/ViewToggle.tsx` — 공용 뷰 토글 컴포넌트
  - `packages/web/src/components/issue/IssueTreeView.tsx` — 계층 트리 뷰 컴포넌트

### 구현 방안

#### 1단계: 공용 뷰 토글 컴포넌트 (`ViewToggle.tsx`)

확장 가능한 설계로 2+개 뷰를 지원하는 공용 컴포넌트.

```tsx
// 타입 설계
interface ViewOption<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode  // lucide 아이콘 등
}

interface ViewToggleProps<T extends string> {
  options: ViewOption<T>[]
  value: T
  onChange: (value: T) => void
}

// 사용 예시 (IssuesPage)
<ViewToggle
  options={[
    { value: 'list', label: 'List', icon: <List /> },
    { value: 'grouped', label: 'Grouped', icon: <GitBranch /> },
    // 미래에 추가 가능: { value: 'kanban', label: 'Kanban', icon: <Columns /> }
  ]}
  value={viewMode}
  onChange={setViewMode}
/>
```

설계 원칙:
- 제네릭 `T`로 뷰 종류를 타입 안전하게 관리
- 아이콘 선택적 지원 (icon 있으면 아이콘+레이블, 없으면 레이블만)
- `localStorage`에 선택 상태 persist (페이지별 키)
- 필터 바 좌측에 배치, 기존 필터 컴포넌트들과 시각적 분리

UI 스타일:
```
[📋 List | 🌳 Grouped]  |  Search...  Status ▾  Priority ▾  ...
 ^^^^^^^^^^^^^^^^^^^^^^^^
 세그먼트 버튼 스타일 (선택된 버튼에 bg-white shadow, 비선택은 투명)
```

#### 2단계: 데이터 로딩 전략 — 페이지네이션 제거

실질적으로 프로젝트당 유효 이슈 수가 200개 미만이므로, **양쪽 뷰 모두 일괄 로드**로 통일:

```tsx
// 뷰 모드 관계없이 전체 로드
const params = { limit: '200' }
// + 기존 필터(status, priority, type, assignee, search)는 그대로 적용
```

변경점:
- List 뷰의 페이지네이션 UI 및 로직 제거
- 두 뷰가 동일한 `data.items`를 공유 → 뷰 전환 시 재요청 없음
- 정렬도 프론트엔드에서 완전 제어 (서버 sortBy/sortOrder 파라미터 제거 가능)
- 기존 서버 limit=30 → limit=200으로 변경

#### 3단계: 트리 조립 로직 (프론트엔드)

`parentId` 기반으로 클라이언트에서 계층 구조 조립:

```tsx
interface TreeNode {
  issue: Issue
  children: TreeNode[]
  depth: number // 0=Epic/Standalone, 1=Task under Epic, 2=Sub_task
}

function buildIssueTree(issues: Issue[]): TreeNode[] {
  // 1. parentId가 null인 최상위 이슈 추출
  // 2. Epic이면서 children이 있는 것 → 그룹 헤더
  // 3. parentId가 있는 이슈 → 해당 부모 아래 배치
  // 4. Epic이 아니고 parent도 없는 Task → "Standalone Tasks" 그룹
  // 5. depth 기반 들여쓰기 계산
}
```

그룹 순서:
1. Epic 그룹들 (order 기준 정렬)
2. Standalone Tasks 그룹 (Epic이 없는 Task/Bug)

#### 4단계: 트리 뷰 컴포넌트 (`IssueTreeView.tsx`)

```
▼ ⚡ User Auth System (3 tasks)         ← Epic 헤더 (접이식)
│  #12  ✅ Implement login     HIGH  Kim   D-3
│  #15  ✅ Add OAuth           MED   Lee
│    └ #16  📎 Google OAuth     LOW   Lee   ← Sub_task (추가 들여쓰기)
│    └ #17  📎 GitHub OAuth     LOW   -
│  #18  🐛 Fix token refresh   HIGH  Kim

▶ ⚡ Dashboard (2 tasks)                ← 접힌 상태

▼ 📝 Standalone Tasks (4)              ← Epic 없는 이슈들
│  #20  ✅ Setup CI           MED   Kim
│  #21  ✅ Update README      LOW   -
```

컴포넌트 구조:
- `IssueTreeView` — 전체 트리 뷰 컨테이너
- `TreeGroup` — 접이식 그룹 (Epic 또는 Standalone)
- `TreeRow` — 개별 이슈 행 (depth 기반 padding-left)

각 행은 기존 테이블과 동일한 정보 표시:
- Type 아이콘 + Title
- Status dot + label
- Priority badge
- Assignee 이름
- Due date badge (getDueBadge)
- 행 클릭 → IssueSlideOver 열기

접이식 상태:
- 각 그룹의 접힘/펼침 상태를 `Set<string>`으로 관리
- 기본: 모든 그룹 펼침
- `localStorage`에 persist (선택적 — 초기에는 세션 내만)

#### 5단계: IssuesPage 통합

```tsx
// IssuesPage에 추가될 상태
const [viewMode, setViewMode] = useState<'list' | 'grouped'>(() =>
  localStorage.getItem('issues-view-mode') as any || 'list'
)

// 렌더링 분기
{viewMode === 'list' ? (
  <table>...</table>  // 기존 테이블 뷰
) : (
  <IssueTreeView
    issues={displayItems}
    projectKey={project?.key || ''}
    onIssueClick={setSelectedIssue}
  />
)}

// 페이지네이션 제거 — 양쪽 뷰 모두 일괄 로드
```

### 리스크 및 고려사항

1. **대량 이슈 성능**: 양쪽 뷰 모두 limit=200 일괄 로드. 현재 프로젝트당 37개 수준으로 충분. 200개 초과 시 가상 스크롤 추가 검토
2. **고아 이슈**: parentId가 존재하지만 해당 부모가 필터에서 제외된 경우 — 부모가 목록에 없으면 최상위로 배치
3. **필터 적용 순서**: 필터 적용 후 트리 조립 (필터된 결과만으로 트리 구성)

### 예상 작업량

- 파일 수: 3개 (신규 2 + 수정 1)
- 복잡도: **보통** (프론트엔드만 변경, 트리 조립 로직이 핵심)
