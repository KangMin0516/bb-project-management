# 기획서: 이슈 마감일(Due Date) 기능

## 요구사항 요약

- 이슈에 `dueDate` 필드 추가
- 이슈 상세 패널 Details 탭에서 날짜 선택/수정/삭제 가능
- 보드 카드에 마감 임박 배지 표시 (D-day 스타일)
- 반복 일정은 **제외**

## 영향 범위

- **서비스**: Backend (API) + Frontend (Web)
- **수정 파일**:
  - `packages/api/prisma/schema.prisma` — Issue 모델에 `dueDate DateTime?` 추가
  - `packages/api/src/issue/dto/create-issue.dto.ts` — `dueDate` 필드 추가
  - `packages/api/src/issue/dto/update-issue.dto.ts` — `dueDate` 필드 추가
  - `packages/api/src/issue/issue.service.ts` — `dueDate` activity 추적에 추가
  - `packages/web/src/api/issues.ts` — `Issue` 인터페이스 + payload에 `dueDate` 추가
  - `packages/web/src/pages/BoardPage.tsx` — Detail 패널에 DatePicker UI 추가
  - `packages/web/src/components/board/IssueCard.tsx` — 마감 배지 렌더링
- **신규 파일**: 없음 (네이티브 `<input type="date">` 사용)

## 구현 방안

### 1단계: 스키마 + 마이그레이션

Issue 모델에 추가:
```prisma
dueDate DateTime? @map("due_date")
```

### 2단계: DTO 업데이트

CreateIssueDto, UpdateIssueDto에 추가:
```typescript
@IsOptional()
@IsDateString()
dueDate?: string;
```

UpdateIssueDto는 `null` 허용 (마감일 제거용):
```typescript
@ValidateIf((o) => o.dueDate !== null)
dueDate?: string | null;
```

### 3단계: Activity 추적

`issue.service.ts`의 `TRACKED_FIELDS`에 `'dueDate'` 추가 — 기존 패턴 그대로.

### 4단계: 프론트엔드 타입

`Issue` 인터페이스에 `dueDate: string | null` 추가.
`UpdateIssuePayload`에 `dueDate?: string | null` 추가.
`CreateIssuePayload`에 `dueDate?: string` 추가.

### 5단계: 이슈 상세 패널 — DatePicker

Details 탭의 `Creator` 필드 아래에 추가:
```
Due Date
[2026-04-10]  [×]
```
- 네이티브 `<input type="date">` 사용 (추가 라이브러리 없음)
- 값 변경 시 `updateMutation.mutate({ dueDate: value })` 호출
- Clear 버튼(`×`)으로 `null` 설정 가능

### 6단계: 보드 카드 — 마감 배지

IssueCard에 D-day 배지 추가:
- **계산**: `daysLeft = diffInDays(dueDate, today)`
- **표시 규칙**:
  - 마감 지남 (`daysLeft < 0`): 빨간 배지 `D+N`
  - 오늘 (`daysLeft === 0`): 빨간 배지 `D-Day`
  - 1~3일 남음: 주황 배지 `D-N`
  - 4~7일 남음: 노란 배지 `D-N`
  - 7일 초과: 회색 텍스트로 날짜만 표시 (예: `4/15`)
  - `dueDate === null`: 표시 없음

## API 변경사항

- `POST /projects/:id/issues` — body에 `dueDate` 필드 (optional)
- `PATCH /projects/:id/issues/:issueId` — body에 `dueDate` 필드 (optional, nullable)
- 응답의 Issue 객체에 `dueDate` 포함

## 리스크 및 고려사항

- 없음 (nullable 필드 추가만, 기존 데이터 영향 없음)

## 예상 작업량

- 파일 수: 7개
- 복잡도: 낮음
