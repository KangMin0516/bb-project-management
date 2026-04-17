## 기획서: Slack 유저 Fetch + 멤버 선택 UI + DABI 데이터 이전

### 요구사항 요약
1. Slack 워크스페이스 유저 목록을 가져오는 API 추가 (DABI의 "Fetch All Users"와 동일)
2. Config 생성/수정 시 comma-separated ID 입력 대신 유저 목록에서 체크박스로 선택하는 UI
3. DABI 시스템의 기존 데이터(Questions 8개, Config 2개, Members)를 API로 이전

### 영향 범위
- **서비스**: API (slack, standup), Web (StandupSettingsPage)

- **수정 파일**:
  - `packages/api/src/slack/slack.service.ts` — getUsers 메서드 추가 (getChannels 패턴 동일)
  - `packages/api/src/slack/slack.controller.ts` — GET /slack/users 엔드포인트 추가
  - `packages/web/src/api/slack.ts` — getUsers API 클라이언트 추가
  - `packages/web/src/pages/StandupSettingsPage.tsx` — 멤버 선택 UI 변경 (텍스트 입력 → 체크박스 리스트)

- **신규 파일**: 없음

### 구현 방안

**1. API: Slack 유저 목록 fetch**
- `SlackService.getUsers(integrationId)` — Slack `users.list` API 호출
- `getChannels`와 동일 패턴: 페이지네이션 + 캐시(5분)
- 봇/삭제된 유저 필터링 (`is_bot`, `deleted` 제외)
- 반환: `{ id: string, name: string, realName: string, avatar: string }[]`
- `SlackController` — `GET /slack/users?integrationId=xxx`

**2. Web: 멤버 선택 UI**
- `StandupSettingsPage`에서 `slackApi.getUsers()` useQuery 호출
- ConfigForm / ConfigEditForm의 members 입력:
  - 현재: comma-separated 텍스트 input
  - 변경: 검색 가능한 체크박스 리스트 (유저 이름 + 아바타)
- 선택된 유저 → `{ slackUserId, username }` 배열로 전달

**3. DABI 데이터 이전**
- 스크린샷에서 확인한 데이터를 API 호출로 직접 생성
- Questions 8개 → POST /api/standup/questions
- Config 2개 (Daily Standup _ Morning, Daily Sync) → POST /api/standup/configs
- 각 Config의 멤버는 Slack User ID로 매핑

### API 변경사항
- `GET /api/slack/users?integrationId=xxx` — 신규 (워크스페이스 유저 목록)

### 리스크 및 고려사항
- Slack `users.list`는 대규모 워크스페이스에서 응답이 느릴 수 있음 → 캐시로 해결
- `users:read` OAuth scope가 필요 (이미 설정 완료 확인 필요)

### 예상 작업량
- 파일 수: 4개
- 복잡도: 낮음 (기존 getChannels 패턴 복제)
