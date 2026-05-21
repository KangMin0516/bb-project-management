# 기획서: 팀 대시보드에 스탠드업 섹션 추가

## 요구사항 요약

- 팀 대시보드(TeamDashboardPage)에 "오늘의 스탠드업" 섹션을 추가
- StandupReport / StandupAnswer DB 데이터를 활용
- 오늘의 스탠드업 참여율, 미응답자, 각 팀원 답변 요약 표시
- 기존 팀 대시보드 데이터(이슈 메트릭)와 스탠드업 데이터를 한 화면에서 확인

## 영향 범위

- **서비스**: API (백엔드), Web (프론트엔드)
- **수정 파일**:
  - `packages/api/src/dashboard/dashboard.service.ts` — getTeamDashboard()에 스탠드업 데이터 추가
  - `packages/web/src/api/dashboard.ts` — TeamDashboard 타입에 standup 필드 추가
  - `packages/web/src/pages/TeamDashboardPage.tsx` — 스탠드업 섹션 UI 추가
- **신규 파일**: 없음

## 구현 방안

### 1단계: 백엔드 — getTeamDashboard()에 스탠드업 데이터 추가

`dashboard.service.ts`의 `getTeamDashboard()` 메서드에서 오늘의 스탠드업 데이터를 조회하여 응답에 포함.

**추가 쿼리:**
```typescript
// 오늘 생성된 StandupReport + 답변 조회
const todayReports = await this.prisma.standupReport.findMany({
  where: {
    createdAt: { gte: todayStart, lte: todayEnd },
  },
  include: {
    answers: {
      include: { question: true },
      orderBy: { order: 'asc' },
    },
    config: {
      select: { name: true, channelName: true },
    },
  },
  orderBy: { createdAt: 'desc' },
});
```

**응답 형태:**
```typescript
standup: {
  total: number          // 오늘 예정된 총 멤버 수
  answered: number       // 응답 완료 수
  unanswered: number     // 미응답 수
  reports: {
    slackUsername: string
    status: 'ANSWERED' | 'ACTIVE' | 'UNANSWERED' | 'AWAY'
    configName: string
    completedAt: string | null
    answers: {
      question: string
      answer: string
    }[]
  }[]
}
```

### 2단계: 프론트엔드 타입 업데이트

`packages/web/src/api/dashboard.ts`의 `TeamDashboard` 인터페이스에 `standup` 필드 추가.

### 3단계: 프론트엔드 UI — 스탠드업 섹션

TeamDashboardPage에 KPI 카드 아래, 멤버 카드 위에 접이식(collapsible) 스탠드업 섹션 추가.

**UI 구성:**
```
┌─────────────────────────────────────────────┐
│ 📋 Today's Standup  (5/7 answered)    [▼]   │
├─────────────────────────────────────────────┤
│ ✅ 김철수 — 09:12 완료                       │
│    Q: What did you do yesterday?            │
│    A: PM-42 로그인 버그 수정 완료             │
│    Q: What will you do today?               │
│    A: PM-58 결제 연동 시작                    │
│                                             │
│ ✅ 이영희 — 09:25 완료                       │
│    Q: What did you do yesterday?            │
│    A: 코드리뷰 3건 완료                      │
│    ...                                      │
│                                             │
│ ⏳ 박민수 — 미응답                            │
│ 🏖️ 최지은 — Away                             │
└─────────────────────────────────────────────┘
```

**상태별 표시:**
- `ANSWERED` → ✅ 초록, 완료 시간 + 답변 내용 표시
- `ACTIVE` → ⏳ 노랑, "응답 중..." 표시
- `UNANSWERED` → ❌ 빨강, "미응답" 표시
- `AWAY` → 🏖️ 회색, "Away" 표시

**인터랙션:**
- 섹션 전체 접기/펼치기 (기본: 펼침)
- 각 멤버 답변 접기/펼치기 (기본: 접힘, 클릭으로 펼침)
- 미응답자는 항상 하단에 표시

## API 변경사항

- `GET /dashboard/team` — 기존 응답에 `standup` 필드 추가 (하위 호환)

## 리스크 및 고려사항

- **StandupConfigMember에 userId가 없음**: 현재 slackUserId + username만 저장. 팀 대시보드의 User와 직접 매칭 불가 → slackUsername으로 표시하거나, 이메일 기반 매칭 고려
- **스탠드업 미설정 시**: standup 데이터가 비어있으면 섹션 자체를 숨김
- **여러 스탠드업 설정**: 같은 날 여러 config가 실행될 수 있음 → configName별 그룹핑
- **성능**: 스탠드업 데이터 조회는 오늘 날짜 필터링이므로 부담 적음

## 예상 작업량

- 파일 수: 3개
- 복잡도: 낮음
