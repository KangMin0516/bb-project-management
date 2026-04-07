# 기획서: Activity 탭 댓글 기능

## 요구사항 요약

- 이슈 상세 패널의 Activity 탭에 **댓글 CRUD** 기능 추가
- 댓글과 변경 이력을 **통합 타임라인**으로 시간순 표시 (GitHub Issues 스타일)
- **@멘션** 지원: 프로젝트 멤버를 태그, 하이라이트 링크로 표시 (알림 시스템 미포함)
- **마크다운** 지원: 기존 MarkdownEditor 컴포넌트 재사용
- **권한**: 댓글 수정/삭제는 작성자 본인만 가능

## 영향 범위

- **서비스**: backend (API), frontend (Web)

### 수정 파일
- `packages/api/prisma/schema.prisma` — Comment 모델 추가
- `packages/api/src/app.module.ts` — CommentModule 등록
- `packages/web/src/api/issues.ts` — 댓글 API 함수 및 Comment 타입 추가
- `packages/web/src/pages/BoardPage.tsx` — Activity 탭에 통합 타임라인 + 댓글 입력 UI

### 신규 파일
- `packages/api/src/comment/comment.module.ts` — NestJS 모듈
- `packages/api/src/comment/comment.controller.ts` — CRUD 엔드포인트
- `packages/api/src/comment/comment.service.ts` — 비즈니스 로직
- `packages/api/src/comment/dto/` — CreateCommentDto, UpdateCommentDto
- `packages/web/src/components/comment/CommentItem.tsx` — 댓글 표시 컴포넌트
- `packages/web/src/components/comment/CommentInput.tsx` — 댓글 입력 컴포넌트 (MarkdownEditor 래핑)

## 구현 방안

### 1단계: DB 스키마 — Comment 모델 추가

```prisma
model Comment {
  id        String   @id @default(uuid())
  content   String   @db.Text
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  issueId String @map("issue_id")
  issue   Issue  @relation(fields: [issueId], references: [id], onDelete: Cascade)

  userId String @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([issueId])
  @@map("comments")
}
```

- Issue, User 모델에 `comments Comment[]` 관계 추가
- 마이그레이션 실행

### 2단계: Backend API — Comment 모듈

기존 Activity 모듈 패턴을 따라 구현.

**엔드포인트:**

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/projects/:projectId/issues/:issueId/comments` | 댓글 생성 |
| `GET` | `/projects/:projectId/issues/:issueId/comments` | 댓글 목록 조회 |
| `PATCH` | `/projects/:projectId/issues/:issueId/comments/:commentId` | 댓글 수정 (본인만) |
| `DELETE` | `/projects/:projectId/issues/:issueId/comments/:commentId` | 댓글 삭제 (본인만) |

- `ProjectMemberGuard` 적용 (기존 패턴)
- 수정/삭제 시 `userId === req.user.id` 검증
- 댓글 생성 시 Activity 레코드도 함께 생성 (`field: 'comment'`)

### 3단계: Frontend — 통합 타임라인 UI

**타임라인 구조:**
1. 상단: 댓글 입력 폼 (MarkdownEditor 재사용, Write/Preview 탭)
2. 하단: 댓글 + Activity를 `createdAt` 기준 역순(최신 위) 통합 표시

**CommentInput 컴포넌트:**
- MarkdownEditor 래핑
- @멘션 시 프로젝트 멤버 자동완성 드롭다운
- Submit 버튼 + Cmd/Ctrl+Enter 단축키

**CommentItem 컴포넌트:**
- 작성자 아바타, 이름, 시간
- 마크다운 렌더링된 본문
- 본인 댓글에만 Edit/Delete 버튼 표시
- 인라인 수정 모드 (Edit 클릭 시 MarkdownEditor로 전환)

**@멘션 표시:**
- 댓글 본문 내 `@username` 패턴을 파란색 하이라이트 링크로 렌더링
- 멘션 자동완성: 입력 중 `@` 입력 시 프로젝트 멤버 목록 드롭다운

### 4단계: 통합 타임라인 데이터 병합

- 프론트엔드에서 comments와 activities를 각각 fetch
- `createdAt` 기준으로 병합 정렬하여 하나의 타임라인으로 렌더링
- 타입으로 구분: `type: 'comment' | 'activity'`

## API 변경사항

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `POST` | `/api/projects/:pid/issues/:iid/comments` | `{ content: string }` | `{ data: Comment }` |
| `GET` | `/api/projects/:pid/issues/:iid/comments` | — | `{ data: { items: Comment[], total: number } }` |
| `PATCH` | `/api/projects/:pid/issues/:iid/comments/:cid` | `{ content: string }` | `{ data: Comment }` |
| `DELETE` | `/api/projects/:pid/issues/:iid/comments/:cid` | — | `{ data: { success: true } }` |

```typescript
interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  user: { id: string, email: string, name: string, avatar: string | null }
}
```

## 리스크 및 고려사항

- **멘션 자동완성**: 프로젝트 멤버 목록 API가 이미 존재하는지 확인 필요. 없으면 추가 엔드포인트 필요
- **XSS 방지**: 마크다운 렌더링 시 sanitize 처리 필수 (기존 MarkdownRenderer가 처리하는지 확인)
- **성능**: 댓글이 많아질 경우 페이지네이션 고려 (초기엔 전체 로드로 시작)

## 예상 작업량

- 파일 수: ~12개 (신규 6 + 수정 4 + 마이그레이션 2)
- 복잡도: 보통
