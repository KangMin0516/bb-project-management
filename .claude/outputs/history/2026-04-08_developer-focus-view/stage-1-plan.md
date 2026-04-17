# 기획서: 개발자 포커스 뷰 + 작업 하이라이트 + 완료 통계

## 요구사항 요약

Thu님 피드백 기반:
1. **개발자 일일 포커스 뷰** — 오늘 집중할 이슈를 우선순위별로 명확하게 보여주는 화면
2. **작업 하이라이트 (Working-On)** — 개발자가 "지금 작업 중" / "오늘 할 일"을 직접 표시하여 매니저가 물어볼 필요 없게
3. **담당자별 완료 통계** — 전체 이슈 중 개인별 완료 수/비율

## 영향 범위

### 서비스
- **Backend** (packages/api): Issue 모델에 `focusDate` 필드 추가, Dashboard API 확장
- **Frontend** (packages/web): DashboardPage 리디자인

### 데이터 모델 변경

Issue 모델에 1개 필드 추가:
```prisma
focusDate  DateTime? @map("focus_date")  // 해당 이슈를 이 날짜에 포커스로 설정
```

- `focusDate = today` → "오늘 할 일" (Planned Today)
- `status = IN_PROGRESS && focusDate = today` → "지금 작업 중" (Working Now)
- `focusDate = null` → 일반 이슈 (Upcoming)

> **설계 의도**: 별도 테이블 없이 Issue에 nullable date 하나 추가. 개발자가 이슈를 "오늘 포커스"로 설정하면 `focusDate = today`로 저장. 다음 날 자동으로 만료 (쿼리 시 날짜 비교).

### 수정 파일
- `packages/api/prisma/schema.prisma` — Issue에 `focusDate` 추가
- `packages/api/prisma/migrations/YYYYMMDD_add_focus_date/` — 마이그레이션
- `packages/api/src/issue/dto/update-issue.dto.ts` — `focusDate` 필드 추가
- `packages/api/src/issue/issue.service.ts` — update에 focusDate 처리, activity 추적
- `packages/api/src/dashboard/dashboard.service.ts` — 포커스 뷰 데이터 + 완료 통계 추가
- `packages/api/src/dashboard/dashboard.controller.ts` — (변경 없을 수 있음)
- `packages/web/src/api/dashboard.ts` — 타입 확장
- `packages/web/src/api/issues.ts` — Issue 타입에 focusDate 추가
- `packages/web/src/pages/DashboardPage.tsx` — 포커스 뷰 섹션 리디자인

### 신규 파일
- 없음 (기존 파일 확장만으로 충분)

## 구현 방안

### Phase 1: 데이터 모델 + API

1. **Prisma 스키마**: Issue에 `focusDate DateTime?` 추가
2. **마이그레이션**: `ALTER TABLE issues ADD COLUMN focus_date TIMESTAMP`
3. **Update DTO**: `focusDate` 필드 추가 (nullable DateTime)
4. **Issue Service**: update 시 `focusDate` 변경 activity 기록
5. **Dashboard Service 확장**:
   - `myFocusIssues`: `assigneeId = userId AND focusDate = today AND status NOT IN [DONE, CANCELED]`
   - `completionByAssignee`: 담당자별 `{ total, done, rate }` 배열 추가
   - 기존 `myIssues`는 유지 (포커스 아닌 나머지 이슈)

### Phase 2: Frontend — Dashboard 리��자인

기존 Dashboard의 "My Issues" 섹션을 **Today's Focus** 섹션으로 교체:

```
┌─ Dashboard ───────────────────────────────────────┐
│ [Summary Cards: Total | Members | Completion | My] │
│                                                     │
│ ┌─ Today's Focus ─────────────────────────────────┐ │
│ │ 🔴 Working Now (IN_PROGRESS + focusDate=today)  │ │
│ │   ┌────────────────────────���────────────────┐   │ │
│ │   │ 🐛 PROJ-42  Fix login bug     HIGH ⏰2h │   │ │
│ │   └─────────────────────────────────────────┘   │ │
│ │                                                  │ │
│ │ 📋 Planned Today (focusDate=today, not started) │ │
│ │   PROJ-45  Add dark mode          MEDIUM        │ │
│ │   PROJ-48  Review PR #12          LOW           │ │
│ │                                                  │ │
│ │ ⏳ Other Assigned (no focusDate, not done)       │ │
│ │   PROJ-50  API refactor           MEDIUM  Due 4/12│ │
│ │   PROJ-51  DB migration           LOW     Due 4/15│ │
│ └──────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Completion Stats ───┐  ┌─ By Status ───────────┐ │
│ │ 👤 Seonguk  12/20 60%│  │ BACKLOG    5          │ │
│ │ 👤 Thu       8/15 53%│  │ TODO       8          │ │
│ │ 👤 Dev3      5/10 50%│  │ IN_PROGRESS 4        │ │
│ └──────────────────────┘  │ DONE       12         │ │
│                           └───────────────────────┘ │
│ [By Priority]  [Recent Activity]                    │
└─────────────────────────────────────────────────────┘
```

### 인터랙션

- **포커스 설정**: 이슈 카드에 ⭐ 버튼 → 클릭 시 `focusDate = today` 설정 (toggle)
- **포커스 해제**: 같은 버튼 재클릭 → `focusDate = null`
- **자��� 만료**: focusDate가 오늘이 아니면 자동으로 "Other Assigned"로 이동 (쿼리 기반, cron 불필요)
- **이슈 클릭**: Board 페이지로 이동 (기존 동작 유지)

## API 변경사항

### 기존 API 수정

`PATCH /projects/:projectId/issues/:issueId`
- Body에 `focusDate?: string | null` 추가 (ISO 날짜 or null)

### Dashboard API 응답 확장

`GET /projects/:projectId/dashboard`
- 응답에 추가:
  - `myFocusIssues: Issue[]` — 오늘 포커스 이슈
  - `completionByAssignee: { user: { id, name, avatar }, total: number, done: number }[]`

## 리스크 및 고려사항

1. **focusDate 타임존**: 서버/클라이언트 타임존 차이로 "오늘"의 기준이 달라질 수 있음 → 클라이언트에서 로컬 날짜를 ISO string으로 전송, 서버는 날짜 부분만 비교
2. **기존 myIssues와 중복**: myFocusIssues와 myIssues가 겹칠 수 있음 → myIssues에서 focusDate=today인 이슈를 제외하여 중복 방지
3. **성능**: completionByAssignee 쿼리가 추가되지만 groupBy + count로 충분히 빠름

## 예상 작업량

- 파일 수: 9개 (수정 8 + 마이그레이션 1)
- 복잡도: **낮음** — 기존 패턴 확장, 신규 테이블 없음
