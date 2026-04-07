# 구현 완료 보고: 이슈 리스트 강화 + 대시보드 "내 이슈"

## 변경 파일 목록
- `packages/api/src/issue/dto/query-issue.dto.ts` — `sortBy`, `sortOrder` 파라미터 추가
- `packages/api/src/issue/issue.service.ts` — `findAll`에 동적 정렬 로직
- `packages/api/src/dashboard/dashboard.controller.ts` — `CurrentUser` 데코레이터 추가
- `packages/api/src/dashboard/dashboard.service.ts` — `myIssues` 조회 로직 추가
- `packages/web/src/api/dashboard.ts` — `DashboardStats`에 `myIssues` 필드
- `packages/web/src/pages/IssuesPage.tsx` — 전면 개편 (필터/정렬/마감일/디테일)
- `packages/web/src/pages/DashboardPage.tsx` — "My Issues" 섹션 추가

## 주요 변경사항

### 1. 백엔드 정렬
- `sortBy` 화이트리스트: number, title, status, priority, createdAt, dueDate
- `sortOrder`: asc/desc (기본 desc)
- 정렬 미지정 시 기존 동작 유지 (status asc, order asc)

### 2. 대시보드 내 이슈
- `getProjectStats(projectId, userId)` — userId 추가
- DONE/CANCELED 제외, dueDate asc → priority asc, 최대 10건

### 3. IssuesPage 강화
- Type, Assignee 필터 추가
- 테이블 헤더 클릭 정렬 (ID, Status, Priority, Due, Created)
- Due Date 컬럼 (D-day 배지)
- Created 컬럼 (날짜 표시)
- 행 클릭 시 IssueSlideOver 디테일 패널
- Delete 버튼 e.stopPropagation() 처리

### 4. DashboardPage "My Issues"
- Summary cards 아래에 배치
- 마감일 임박 순 정렬, D-day 배지
- 행 클릭 시 보드 페이지로 이동

## 자체 점검
- [x] 타입 오류 없음
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음
