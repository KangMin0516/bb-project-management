# 구현 완료 보고: 이슈 마감일(Due Date) 기능

## 변경 파일 목록
- `packages/api/prisma/schema.prisma` — Issue 모델에 `dueDate DateTime?` 추가
- `packages/api/prisma/migrations/20260406150145_add_issue_due_date/` — 마이그레이션
- `packages/api/src/issue/dto/create-issue.dto.ts` — `@IsDateString() dueDate?` 추가
- `packages/api/src/issue/dto/update-issue.dto.ts` — `@IsDateString() dueDate?: string | null` 추가 (ValidateIf로 null 허용)
- `packages/api/src/issue/issue.service.ts` — TRACKED_FIELDS에 `'dueDate'` 추가
- `packages/web/src/api/issues.ts` — Issue에 `dueDate`, payload에 `dueDate` 추가
- `packages/web/src/pages/BoardPage.tsx` — Details 탭에 DatePicker + Clear 버튼 추가
- `packages/web/src/components/board/IssueCard.tsx` — D-day 배지 렌더링

## 주요 변경사항

### 1. 스키마 + 마이그레이션
- `dueDate DateTime? @map("due_date")` — nullable, 기존 데이터 영향 없음

### 2. DTO
- CreateIssueDto: `@IsDateString()` optional
- UpdateIssueDto: `@ValidateIf((o) => o.dueDate !== null) @IsDateString()` — null로 마감일 제거

### 3. Activity 추적
- `TRACKED_FIELDS`에 `'dueDate'` 추가 — 기존 패턴 그대로

### 4. 상세 패널 DatePicker
- 네이티브 `<input type="date">` 사용
- `d.dueDate.slice(0, 10)`으로 YYYY-MM-DD 포맷
- Clear 버튼(✕)으로 `null` 설정

### 5. 보드 카드 배지
- `getDueBadge()` 함수로 D-day 계산
- 빨강(지남/당일), 주황(1~3일), 노랑(4~7일), 회색(7일+)
- 카드 헤더 우측에 `ml-auto`로 배치

## 자체 점검
- [x] 타입 오류 없음
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음
