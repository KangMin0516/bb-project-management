## 구현 완료 보고: 이슈 리스트 — 계층 트리 그룹핑 뷰

### 신규 파일
- `packages/web/src/components/view/ViewToggle.tsx` — 공용 뷰 토글 컴포넌트 (제네릭, 2+개 뷰 지원)
- `packages/web/src/components/issue/IssueTreeView.tsx` — 계층 트리 뷰 (Epic > Task > Sub_task)

### 변경 파일
- `packages/web/src/pages/IssuesPage.tsx` — 뷰 전환 통합, 페이지네이션 제거, 일괄 로드

### 주요 변경사항

1. **ViewToggle 공용 컴포넌트**
   - 제네릭 `<T extends string>` 설계로 뷰 종류 타입 안전
   - 세그먼트 버튼 UI (선택: bg-white + shadow, 비선택: 투명)
   - 아이콘 선택적 지원
   - `localStorage`에 선택 상태 persist (IssuesPage에서 관리)

2. **IssueTreeView 계층 트리 뷰**
   - `buildTree()`: parentId 기반으로 Issue[] → TreeGroup[] 계층 조립
   - Epic 그룹: 접이식(collapsible) 섹션, ChevronRight/Down 토글
   - Standalone Tasks: Epic이 없는 Task/Bug를 별도 그룹으로 표시
   - TreeNodeRow: depth 기반 들여쓰기 (24px 단위), 재귀 렌더링
   - 각 행: Type 아이콘 + Title + Status dot + Priority badge + Assignee + Due badge

3. **IssuesPage 수정**
   - ViewToggle 추가 (필터 바 좌측, FilterDivider로 분리)
   - `viewMode` 상태: 'list' | 'grouped', localStorage persist
   - 페이지네이션 제거 → `limit=200` 일괄 로드
   - `page` 상태 제거, 하단에 이슈 건수만 표시
   - 정렬: list 모드에서만 서버 sortBy/sortOrder 적용

### 자체 점검
- [x] 타입 오류 없음 (`npx tsc --noEmit` 통과)
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성 (cn, STATUS_COLORS, getDueBadge 등 재사용)
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음
