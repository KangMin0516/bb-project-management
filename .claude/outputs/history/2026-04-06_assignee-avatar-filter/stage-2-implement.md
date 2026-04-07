# 구현 완료 보고: Assignee 아바타 필터

## 변경 파일 목록
- `packages/web/src/pages/BoardPage.tsx` — assignee 필터 상태, 아바타 바 UI, 보드 필터링 로직 추가

## 주요 변경사항

### 1. 필터 상태
- `selectedAssignees: Set<string>` — 선택된 assignee ID 집합
- `toggleAssignee()` — 클릭 시 Set에 추가/제거

### 2. 배정된 멤버 추출
- `assignedMembers` — board 데이터에서 assignee가 있는 이슈의 고유 멤버 목록 (useMemo)

### 3. 아바타 필터 바 UI
- 보드 헤더 우측에 멤버 아바타 아이콘 가로 나열
- 선택 시: `ring-2 ring-primary-600` 파란 테두리 + primary 배경
- 미선택: gray 배경
- Clear 버튼: 필터 선택 시 노출

### 4. 보드 필터링
- `filteredBoard` — selectedAssignees가 비어있으면 전체, 아니면 해당 assignee 이슈만 필터 (useMemo)
- BoardColumn에 `filteredBoard` 전달

## 자체 점검
- [x] 타입 오류 없음
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음
