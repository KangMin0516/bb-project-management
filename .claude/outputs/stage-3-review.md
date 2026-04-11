# Stage 3: 코드리뷰 결과 — Timeline, Dependency Graph, Metrics Dashboard

## 리뷰 대상
- Timeline/Roadmap 뷰 (TimelinePage.tsx)
- Dependency Graph (DependencyGraph.tsx)
- 프로젝트 메트릭 대시보드 (BurndownChart, WorkloadChart, OverdueAlert, DashboardPage)
- 백엔드 서비스 (dashboard.service.ts, issue-link.service.ts)

---

## Critical Issues (수정 완료)

### C1: getBurndownData O(30×N) 성능 문제
- **위치**: `packages/api/src/dashboard/dashboard.service.ts` getBurndownData()
- **문제**: 30일 × N개 이슈를 매번 순회하는 O(30*N) 루프
- **수정**: 정렬된 이슈 + 이벤트 기반 sweep 알고리즘으로 O(N log N) 최적화

### C2: Burndown reopen 버그
- **위치**: `packages/api/src/dashboard/dashboard.service.ts` getBurndownData()
- **문제**: `earliest` DONE 활동만 기록하여 이슈가 재오픈된 경우에도 닫힌 것으로 처리
- **수정**: 전체 status 활동을 추적하여 reopen 시 closedDateMap에서 제거

---

## Warning Issues (수정 완료)

### W1: 중복 STATUS_BAR_COLORS 상수
- **위치**: WorkloadChart.tsx, TimelinePage.tsx
- **수정**: `@/lib/constants`에 통합 export, 두 파일에서 import로 변경

### W2: 중복 formatDate/formatWeek 함수
- **위치**: TimelinePage.tsx
- **문제**: formatDate와 formatWeek가 동일한 구현
- **수정**: formatWeek 제거, formatDate만 사용

### W3: findProjectDependencies 단방향 쿼리
- **위치**: `packages/api/src/issue-link/issue-link.service.ts`
- **문제**: sourceIssue.projectId만 검색하여 target이 프로젝트에 속하는 경우 누락
- **수정**: OR 조건으로 sourceIssue.projectId 또는 targetIssue.projectId 모두 검색

---

## 추가 개선 (수정 완료)

### Timeline 메뉴 숨김
- 사이드바 네비게이션에서 Timeline 항목 제거 (라우트는 유지)
- GanttChart 미사용 import 제거

### 대시보드 툴팁 추가
- 번다운 차트, 워크로드 분포, 의존성 그래프, 완료율, 오늘의 포커스, 마감초과 이슈

---

## 전체 결과: **수정 완료 — `/4-test` 진행 가능**
