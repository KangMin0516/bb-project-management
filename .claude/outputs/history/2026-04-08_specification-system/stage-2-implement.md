# Stage 2: 구현 완료 보고

## 작업명: MD 기획서 시각화 + 섹션별 코멘트 시스템

## 자체 점검 체크리스트

- [x] 타입 오류 없음 (`tsc --noEmit` 통과 — api, web 모두)
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성 (NestJS 모듈 패턴, Prisma 컨벤션, TanStack Query 패턴)
- [x] 기획서의 모든 Phase 1 항목 구현 완료
- [x] 불필요한 변경 없음

## 변경 파일 목록

### Backend (packages/api)

- `prisma/schema.prisma` — Specification, SpecSection, SpecComment 모델 + SpecStatus enum 추가
- `prisma/migrations/20260408021345_add_specifications/` — 마이그레이션 적용 완료
- `src/specification/specification.module.ts` — NestJS 모듈 등록
- `src/specification/specification.controller.ts` — REST 엔드포인트 (Spec CRUD + Comment CRUD)
- `src/specification/specification.service.ts` — 비즈니스 로직 (MD 파싱, 섹션 동기화, 코멘트 스레딩)
- `src/specification/dto/create-specification.dto.ts` — 생성 DTO
- `src/specification/dto/update-specification.dto.ts` — 수정 DTO
- `src/specification/dto/create-spec-comment.dto.ts` — 코멘트 생성/수정 DTO
- `src/app.module.ts` — SpecificationModule import 추가

### Frontend (packages/web)

- `src/api/specifications.ts` — API 클라이언트 + 타입 정의
- `src/pages/SpecificationsPage.tsx` — 전체 페이지 (목록 + 상세 + 생성 모달)
- `src/components/spec/SpecContent.tsx` — MD 렌더링 + TOC + 섹션별 코멘트 배지
- `src/components/spec/SpecCommentPanel.tsx` — 코멘트 패널 (스레딩, resolve, 섹션 필터)
- `src/App.tsx` — `/projects/:projectId/specs` 라우트 추가
- `src/components/layout/AppLayout.tsx` — 사이드바 "Specs" 네비게이션 항목 추가

## 주요 구현사항

### 1. 데이터 모델 (Prisma)
- `Specification`: 프로젝트별 기획서 (title, content, category, status)
- `SpecSection`: MD 헤딩 기반 자동 추출 섹션 (sectionId = slugified heading)
- `SpecComment`: 섹션 앵커링 + 스레드 답글 + resolve 토글

### 2. Backend API
- `POST/GET /specifications` — 기획서 CRUD (카테고리/상태 필터)
- `GET /specifications/:id` — 상세 (섹션 + 코멘트 + 답글 중첩 포함)
- `PATCH/DELETE /specifications/:id` — 수정/삭제 (콘텐츠 변경 시 섹션 자동 재동기화)
- `POST/GET/PATCH/DELETE /specifications/:id/comments` — 코멘트 CRUD
- ProjectMemberGuard 적용

### 3. Frontend UI
- 3단 레이아웃: 좌측 목록 (카테고리 그룹) | 중앙 MD 렌더링 | 우측 코멘트
- react-markdown + remarkGfm + rehypeSanitize + rehypeHighlight
- TOC 사이드바 (IntersectionObserver 기반 활성 헤딩 추적)
- 헤딩 hover 시 코멘트 배지 (미해결 카운트)
- 인라인 편집 모드 (MarkdownEditor 재활용)
- 코멘트 섹션 필터링, 스레드 답글, resolve/reopen

## 기술적 결정

1. **섹션 동기화**: 콘텐츠 저장 시 `parseSections()` → `syncSections()` (upsert + orphan delete)
2. **slugify 일관성**: 백엔드와 프론트엔드에서 동일한 slugify 로직 사용
3. **기존 컴포넌트 재활용**: MarkdownEditor, MarkdownViewer 재사용
4. **API 응답 패턴**: 기존 TransformInterceptor 패턴 (`{ data: ... }`) 준수
