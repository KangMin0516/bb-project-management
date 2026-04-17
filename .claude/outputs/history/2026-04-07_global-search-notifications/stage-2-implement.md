## Stage 2: 구현 보고서 — 글로벌 이슈 검색 + 알림 시스템

### 신규 파일 (12개)

| 파일 | 목적 |
|------|------|
| `packages/api/src/search/search.module.ts` | 검색 모듈 |
| `packages/api/src/search/search.controller.ts` | `GET /search/issues` API |
| `packages/api/src/search/search.service.ts` | 크로스 프로젝트 검색 로직 |
| `packages/api/src/search/dto/search-query.dto.ts` | 검색 쿼리 DTO |
| `packages/api/src/notification/notification.module.ts` | 알림 모듈 |
| `packages/api/src/notification/notification.controller.ts` | 알림 CRUD API |
| `packages/api/src/notification/notification.service.ts` | 알림 생성/조회/읽음 처리 |
| `packages/api/prisma/migrations/...add_notification/` | Notification 테이블 마이그레이션 |
| `packages/web/src/api/search.ts` | 검색 API 클라이언트 |
| `packages/web/src/api/notifications.ts` | 알림 API 클라이언트 |
| `packages/web/src/components/search/CommandPalette.tsx` | Cmd+K 커맨드 팔레트 |
| `packages/web/src/components/notification/NotificationBell.tsx` | 벨 아이콘 + 드롭다운 |

### 수정 파일 (6개)

| 파일 | 변경 내용 |
|------|-----------|
| `packages/api/prisma/schema.prisma` | Notification 모델 + User/Issue relation 추가 |
| `packages/api/src/app.module.ts` | SearchModule, NotificationModule 등록 |
| `packages/api/src/issue/issue.module.ts` | NotificationModule import |
| `packages/api/src/issue/issue.service.ts` | 이슈 할당 변경 시 ASSIGNED 알림 생성 |
| `packages/api/src/comment/comment.module.ts` | NotificationModule import |
| `packages/api/src/comment/comment.service.ts` | 댓글 생성 시 COMMENTED + @멘션 MENTIONED 알림 |
| `packages/web/src/components/layout/AppLayout.tsx` | CommandPalette + NotificationBell + Search 버튼 |

### 주요 구현사항

**기능 A: 글로벌 검색**
- `GET /search/issues?q=keyword` — 사용자 소속 프로젝트 전체 이슈 검색
- Cmd+K / Ctrl+K로 커맨드 팔레트 토글
- 디바운스 300ms, 방향키 탐색, Enter 이동, ESC 닫기
- 최대 20건 반환, 최신 수정순

**기능 B: 알림 시스템**
- Notification 모델 (type, message, isRead, userId, issueId, projectId, actorId)
- 3가지 이벤트: ASSIGNED, COMMENTED, MENTIONED
- 자기 자신에게는 알림 미생성 (actorId === userId 체크)
- @멘션: `@username` 패턴 파싱 후 해당 유저에게 알림
- 30초 폴링으로 unread count 갱신
- 벨 아이콘 (사이드바 하단) + 드롭다운 + unread 배지

### 자체 점검

- [x] API 타입 오류 없음 (`tsc --noEmit`)
- [x] Web 타입 오류 없음 (`tsc --noEmit`)
- [x] import 경로 정확
- [x] 기존 코드 패턴 일관성 (NestJS 모듈/서비스/컨트롤러 패턴 동일)
- [x] DB 마이그레이션 생성 및 적용 완료
- [x] 기획서 모든 항목 구현 완료
- [x] 불필요한 변경 없음
