# 구현 완료 보고: Epic Swimlanes on Board

## 변경 파일 목록

- `packages/web/src/pages/BoardPage.tsx` — groupByEpic 상태, "Group: Epic" 토글 버튼, SwimlaneBoardView 조건부 렌더링, swimlane용 필터 로직 추가
- `packages/web/src/components/board/IssueCard.tsx` — `compact` prop 추가 (swimlane 모드에서 작은 카드)

## 신규 파일

- `packages/web/src/components/board/SwimlaneBoardView.tsx` — Swimlane 전체 레이아웃: board 데이터를 Epic별로 재그룹핑, DnD 컨텍스트, SwimlaneRow 렌더링
- `packages/web/src/components/board/SwimlaneRow.tsx` — 개별 Epic Swimlane: 헤더(Epic 정보 + 진행률) + 상태별 미니 컬럼 그리드

## 주요 변경사항

1. **"Group: Epic" 토글 버튼**: 보드 헤더 우측에 Rows3 아이콘과 함께 추가. 활성화 시 primary 색상으로 하이라이트
2. **SwimlaneBoardView**: board 데이터를 Epic 기준으로 재구성. Epic issue는 Swimlane 헤더로, 자식 이슈는 상태별 미니 컬럼에 배치. "No Epic" 그룹은 하단
3. **SwimlaneRow**: 접기/펼치기 지원. 헤더에 Epic 번호, 제목, 작업 수, 상태 배지, 진행률 바 표시. 내부 컬럼은 기존 IssueCard 재사용
4. **DnD 통합**: droppableId를 `{epicId}:{status}` 형식으로 사용. 단일 DragDropContext에서 처리
5. **필터 연동**: swimlane 모드에서도 기존 필터(assignee, label, search 등) 동작. Epic은 항상 헤더로 유지

## 자체 점검

- [x] 타입 오류 없음 (tsc --noEmit 통과)
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성 (memo, useMemo, useCallback 등 동일 패턴)
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음
- [x] 빌드 성공
