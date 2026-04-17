# Stage 2: 구현 보고서 — Developer Focus View + Completion Stats

## 구현 요약

기획서(`stage-1-plan.md`)를 기반으로 개발자 일일 포커스 뷰, 작업 하이라이트, 담당자별 완료 통계 기능을 구현했습니다.

## 변경 파일 목록

### Backend (packages/api)

| 파일 | 변경 내용 |
|------|-----------|
| `prisma/schema.prisma` | Issue 모델에 `focusDate DateTime? @map("focus_date") @db.Date` 추가 |
| `prisma/migrations/20260408034207_add_issue_focus_date/` | focusDate 컬럼 마이그레이션 |
| `src/issue/dto/update-issue.dto.ts` | `focusDate?: string \| null` 필드 + 유효성 검증 추가 |
| `src/issue/dto/create-issue.dto.ts` | (변경 없음 — focusDate는 생성 시 불필요) |
| `src/issue/dto/query-issue.dto.ts` | (변경 없음) |
| `src/issue/issue.service.ts` | `TRACKED_FIELDS`에 `focusDate` 추가 (activity 추적) |
| `src/dashboard/dashboard.service.ts` | completionByAssignee 통계 + myFocusIssues/myOtherIssues 분리 |
| `src/dashboard/dashboard.controller.ts` | (변경 없음 — 기존 엔드포인트 그대로 사용) |

### Frontend (packages/web)

| 파일 | 변경 내용 |
|------|-----------|
| `src/api/issues.ts` | Issue 인터페이스에 `focusDate` 추가, UpdateIssuePayload에 `focusDate` 추가 |
| `src/api/dashboard.ts` | `CompletionStat` 타입, DashboardStats에 `completionByAssignee`, `myFocusIssues` 추가 |
| `src/pages/DashboardPage.tsx` | 포커스 뷰 섹션 리디자인 (Working Now / Planned Today / Other Assigned + Completion by Member) |

## 핵심 구현 사항

### 1. focusDate 필드 (Date Only)
- `@db.Date`로 날짜만 저장 (시간 무시)
- 개발자가 이슈를 "오늘 포커스"로 설정하면 `focusDate = today`
- 다음 날 자동 만료 (쿼리 시 날짜 비교)

### 2. Dashboard API 확장
- `completionByAssignee`: `groupBy(['assigneeId', 'status'])` → 담당자별 total/done 집계
- `myFocusIssues`: focusDate가 오늘인 이슈 (Working Now + Planned Today)
- `myIssues`: focusDate가 오늘이 아닌 나머지 이슈 (중복 방지)

### 3. Frontend Today's Focus 섹션
- **Working Now**: IN_PROGRESS + focusDate=today (Zap 아이콘, 노란 하이라이트)
- **Planned Today**: focusDate=today, IN_PROGRESS 아닌 것 (Clock 아이콘)
- **Other Assigned**: focusDate 없는 나머지 (정렬: dueDate/priority 토글)
- **Star 토글**: 각 이슈에 포커스 설정/해제 버튼
- **Completion by Member**: 프로그레스 바 + 완료율 표시

## 검증 결과

- TypeScript (API): 통과 (pre-existing e2e test 에러만 존재)
- TypeScript (Web): 통과
- ESLint (변경 파일): 통과 (prettier auto-fix 적용)
- 마이그레이션: 적용 완료

## 신규 파일
- `packages/api/prisma/migrations/20260408034207_add_issue_focus_date/migration.sql`
