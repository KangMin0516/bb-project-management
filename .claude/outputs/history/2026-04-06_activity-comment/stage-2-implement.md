# 구현 완료 보고: Activity 탭 댓글 기능

## 변경 파일 목록
- `packages/api/prisma/schema.prisma` — Comment 모델 추가, User/Issue에 comments 관계 추가
- `packages/api/src/app.module.ts` — CommentModule import 및 등록
- `packages/web/src/api/issues.ts` — Comment 타입 및 CRUD API 함수 추가
- `packages/web/src/pages/BoardPage.tsx` — Activity 탭을 통합 타임라인으로 교체, ActivityTab 컴포넌트 추가

## 신규 파일
- `packages/api/prisma/migrations/20260406133905_add_comment_model/` — DB 마이그레이션
- `packages/api/src/comment/comment.module.ts` — NestJS 모듈
- `packages/api/src/comment/comment.controller.ts` — CRUD 4개 엔드포인트 (POST/GET/PATCH/DELETE)
- `packages/api/src/comment/comment.service.ts` — 비즈니스 로직 (본인 댓글만 수정/삭제 권한 검증)
- `packages/api/src/comment/dto/create-comment.dto.ts` — 생성 DTO
- `packages/api/src/comment/dto/update-comment.dto.ts` — 수정 DTO
- `packages/api/src/comment/dto/index.ts` — DTO barrel export
- `packages/web/src/components/comment/CommentInput.tsx` — 댓글 입력 (MarkdownEditor + @멘션 자동완성)
- `packages/web/src/components/comment/CommentItem.tsx` — 댓글 표시 (마크다운 렌더링, 인라인 수정, 삭제)

## 주요 변경사항

### 1. DB 스키마
- `Comment` 모델: id, content(Text), createdAt, updatedAt, issueId, userId
- `comments` 테이블, issueId 인덱스
- 마이그레이션 실행 완료

### 2. Backend API
- `POST /projects/:pid/issues/:iid/comments` — 댓글 생성
- `GET /projects/:pid/issues/:iid/comments` — 댓글 목록 (페이지네이션)
- `PATCH /projects/:pid/issues/:iid/comments/:cid` — 댓글 수정 (본인만)
- `DELETE /projects/:pid/issues/:iid/comments/:cid` — 댓글 삭제 (본인만)
- ProjectMemberGuard 적용

### 3. Frontend
- **통합 타임라인**: 댓글과 Activity를 createdAt 기준 병합 정렬
- **CommentInput**: MarkdownEditor 래핑, @멘션 자동완성 드롭다운, Cmd+Enter 제출
- **CommentItem**: 마크다운 렌더링, @멘션 볼드 처리, 인라인 수정, 삭제, timeAgo 표시

## 자체 점검
- [x] 타입 오류 없음 (backend/frontend 모두 tsc --noEmit 통과)
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성 (guards, service/controller 구조, API client 패턴)
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음
