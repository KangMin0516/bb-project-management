## 기획서: 글로벌 이슈 검색 + 알림 시스템

---

## 기능 A: 글로벌 이슈 검색 (Cmd+K 커맨드 팔레트)

### 요구사항 요약
사용자가 속한 모든 프로젝트의 이슈를 Cmd+K 단축키로 검색. 제목/번호/설명 통합 검색.

### 구현 방안

#### 1. API — `GET /search/issues?q=keyword`
- 새 `SearchModule` 생성 (NestJS)
- 사용자가 멤버인 프로젝트의 이슈만 검색 (권한 필터링)
- Prisma `contains` + `insensitive` 모드 사용 (기존 issue.service 패턴 동일)
- 검색 대상: title, description, project.key + number (예: "PRJ-12")
- 최대 20건 반환, 최신순 정렬

```
GET /search/issues?q=login
Response: { items: [{ id, number, title, status, priority, project: { id, key, name } }] }
```

#### 2. Web — CommandPalette 컴포넌트
- `Cmd+K` (Mac) / `Ctrl+K` (Windows) 로 토글
- 모달 오버레이 + 검색 입력 + 결과 리스트
- 디바운스 300ms 적용
- 방향키 탐색 + Enter로 이슈 상세 이동 (`/projects/:projectId/board`)
- ESC로 닫기
- AppLayout에 마운트 (전역)

#### 신규 파일

| 파일 | 목적 |
|------|------|
| `packages/api/src/search/search.module.ts` | 검색 모듈 |
| `packages/api/src/search/search.controller.ts` | `GET /search/issues` |
| `packages/api/src/search/search.service.ts` | 검색 로직 |
| `packages/api/src/search/dto/search-query.dto.ts` | 쿼리 DTO |
| `packages/web/src/api/search.ts` | 검색 API 클라이언트 |
| `packages/web/src/components/search/CommandPalette.tsx` | 커맨드 팔레트 UI |

#### 수정 파일

| 파일 | 변경 사유 |
|------|-----------|
| `packages/api/src/app.module.ts` | SearchModule 등록 |
| `packages/web/src/components/layout/AppLayout.tsx` | CommandPalette 마운트 |

---

## 기능 B: 알림 시스템 (인앱)

### 요구사항 요약
이슈 할당, 댓글 작성, @멘션 시 인앱 알림 생성. 사이드바에 벨 아이콘 + 드롭다운.

### 알림 생성 이벤트

| 이벤트 | 수신자 | 메시지 예시 |
|--------|--------|-------------|
| 이슈 할당 | 새 담당자 | "PRJ-12가 나에게 할당되었습니다" |
| 댓글 작성 | 이슈 담당자 (작성자 제외) | "홍길동이 PRJ-12에 댓글을 남겼습니다" |
| @멘션 | 멘션된 사용자 | "홍길동이 PRJ-12에서 나를 멘션했습니다" |

### 구현 방안

#### 1. DB — Notification 모델

```prisma
model Notification {
  id        String   @id @default(uuid())
  type      String   // ASSIGNED, COMMENTED, MENTIONED
  message   String
  isRead    Boolean  @default(false)
  userId    String   // 수신자
  user      User     @relation(fields: [userId], references: [id])
  issueId   String?
  issue     Issue?   @relation(fields: [issueId], references: [id])
  projectId String?
  actorId   String?  // 발생시킨 사용자
  createdAt DateTime @default(now())

  @@index([userId, isRead, createdAt])
}
```

#### 2. API — NotificationModule
- `GET /notifications` — 내 알림 목록 (최신 50건, unread 우선)
- `PATCH /notifications/:id/read` — 읽음 처리
- `PATCH /notifications/read-all` — 전체 읽음 처리
- `GET /notifications/unread-count` — 읽지 않은 알림 수

#### 3. 알림 생성 트리거
- `issue.service.ts` — `update()` 에서 assigneeId 변경 시 알림 생성
- `comment.service.ts` — `create()` 에서 담당자에게 알림 + @멘션 파싱
- `NotificationService.create()` 를 각 서비스에서 호출

#### 4. Web — 알림 UI
- 사이드바 하단 (유저 프로필 위)에 벨 아이콘 + unread 배지
- 클릭 시 드롭다운 리스트 (최근 알림)
- 클릭 시 해당 이슈로 이동 + 읽음 처리
- 30초 폴링으로 unread count 갱신

#### 신규 파일

| 파일 | 목적 |
|------|------|
| `packages/api/src/notification/notification.module.ts` | 알림 모듈 |
| `packages/api/src/notification/notification.controller.ts` | 알림 API |
| `packages/api/src/notification/notification.service.ts` | 알림 CRUD + 생성 로직 |
| `packages/api/prisma/migrations/...add_notification/` | Notification 테이블 |
| `packages/web/src/api/notifications.ts` | 알림 API 클라이언트 |
| `packages/web/src/components/notification/NotificationBell.tsx` | 벨 아이콘 + 드롭다운 |

#### 수정 파일

| 파일 | 변경 사유 |
|------|-----------|
| `packages/api/prisma/schema.prisma` | Notification 모델 추가 |
| `packages/api/src/app.module.ts` | NotificationModule 등록 |
| `packages/api/src/issue/issue.service.ts` | 할당 변경 시 알림 생성 |
| `packages/api/src/comment/comment.service.ts` | 댓글/멘션 시 알림 생성 |
| `packages/web/src/components/layout/AppLayout.tsx` | 벨 아이콘 + CommandPalette 추가 |

---

## 전체 영향 범위

- **서비스**: API + Web
- **신규 파일**: 12개
- **수정 파일**: 6개 (일부 중복)
- **DB 마이그레이션**: 1건 (Notification 테이블)

### 리스크
- @멘션 파싱: 댓글 내 `@username` 패턴 매칭 필요 → 단순 정규식으로 처리
- 폴링 부하: 30초 간격 + unread count만 조회하므로 부하 최소

### 예상 작업량
- 파일 수: ~18개 (신규 12 + 수정 6)
- 복잡도: 보통
