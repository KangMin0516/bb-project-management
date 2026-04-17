## 구현 완료 보고: Slack 유저 Fetch + 멤버 선택 UI

### 변경 파일 목록
- `packages/api/src/slack/slack.service.ts` — getUsers 메서드 추가 (users.list API, 캐시, 봇/삭제 필터링)
- `packages/api/src/slack/slack.controller.ts` — GET /slack/users 엔드포인트 추가
- `packages/web/src/api/slack.ts` — SlackUser 타입 + getUsers API 클라이언트 추가
- `packages/web/src/pages/StandupSettingsPage.tsx` — MemberSelector 컴포넌트, ConfigForm/ConfigEditForm 멤버 선택 UI 변경

### 주요 변경사항
1. **API**: `SlackService.getUsers(integrationId)` — `users.list` 페이지네이션 + 5분 캐시, 봇/삭제/USLACKBOT 필터, realName 정렬
2. **Controller**: `GET /api/slack/users?integrationId=xxx` — getChannels와 동일 패턴
3. **MemberSelector 컴포넌트**: 검색 가능한 체크박스 리스트, 선택된 유저 태그 표시 (아바타 + 이름 + ×버튼)
4. **ConfigForm / ConfigEditForm**: comma-separated 텍스트 입력 → MemberSelector로 교체, username도 함께 저장

### 자체 점검
- [x] 타입 오류 없음 (API + Web tsc --noEmit 통과)
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성 (getChannels 패턴 복제)
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음
