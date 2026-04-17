# Stage 3: 코드리뷰 통합 결과

## 작업명: MD 기획서 시각화 + 섹션별 코멘트 시스템

### 전체 요약
- **승인 여부**: 수정 필요 (Critical 3건 수정 후 진행 가능)
- **유지보수성 점수**: 7.5/10
- **Critical**: 3건 (중복 발견 통합)
- **Warning**: 7건
- **Info**: 5건

---

## Critical (반드시 수정)

### C1. `parentId` 미검증 — cross-spec 데이터 오염 가능 (보안)
**파일**: `specification.service.ts:184`
- `createComment`에서 `dto.parentId`를 검증 없이 Prisma에 전달
- 다른 Specification의 코멘트 ID를 부모로 지정 가능 → 데이터 무결성 파괴
- **수정**: parentId가 동일 specId에 속하는지 검증 추가

### C2. `syncSections` N+1 쿼리 + 트랜잭션 미적용 (성능/정합성)
**파일**: `specification.service.ts:52-58, 74-91, 143-161`
- 각 섹션마다 개별 `upsert` 호출 → 50개 헤딩이면 50회 roundtrip
- `create`/`update`에서 `syncSections`가 트랜잭션 밖에서 실행 → 실패 시 불일치 상태
- **수정**: `$transaction`으로 감싸기

### C3. 중복 `sectionId` slug 충돌 (데이터 무결성)
**파일**: `specification.service.ts:18-39`
- 동일 텍스트 헤딩 (`## API`, `## API`) → 같은 slug 생성 → 나중 것이 이전 것 덮어씀
- 코멘트가 잘못된 섹션에 연결될 수 있음
- **수정**: 중복 slug에 suffix 추가 (`api`, `api-1`, `api-2`)

---

## Warning (수정 권장)

### W1. `addingSectionId` 상태가 활용되지 않음 (기능 버그)
**파일**: `SpecCommentPanel.tsx:24`
- `addingSectionId`가 선언만 되고 값이 설정되지 않음 → 새 코멘트가 섹션에 연결 안 됨
- **수정**: `filterSection`을 직접 `sectionId`로 전달

### W2. `findComments`에서 `sectionId` 매칭 실패 시 전체 코멘트 반환
**파일**: `specification.service.ts:203-225`
- 존재하지 않는 섹션으로 필터 시 빈 결과 대신 전체 결과 반환
- **수정**: 섹션 미발견 시 빈 배열 반환

### W3. 답글(reply)에 MarkdownViewer 미적용 (일관성)
**파일**: `SpecCommentPanel.tsx:181`
- 부모 코멘트는 `<MarkdownViewer>`, 답글은 plain text
- **수정**: 답글에도 `<MarkdownViewer>` 적용

### W4. `rehypeSanitize`가 `rehypeHighlight` 이후 실행 (syntax highlighting 깨짐)
**파일**: `SpecContent.tsx:141`
- sanitize가 highlight의 CSS 클래스를 제거할 수 있음
- 단, 기존 `MarkdownViewer`도 동일 순서 → 프로젝트 전체 이슈로 기록

### W5. `findAll`에 pagination 없음
**파일**: `specification.service.ts:93-113`
- 기획서가 수백 개일 때 성능 문제
- 기존 `CommentService.findByIssue`는 pagination 구현 중

### W6. Specification 삭제 시 작성자 권한 검증 없음
**파일**: `specification.controller.ts:64-70`
- 프로젝트 멤버 누구나 삭제 가능 → 정책 결정 필요

### W7. `Record<string, unknown>` 타입 사용 (타입 안전성)
**파일**: `specification.service.ts:94`
- **수정**: `Prisma.SpecificationWhereInput` 사용

---

## Info (참고)

- I1. `ChevronRight` import 미사용 (`SpecificationsPage.tsx:11`)
- I2. `@ts-expect-error` dynamic tag (`SpecContent.tsx:79`) — `createElement` 사용 가능
- I3. `content` 필드에 `@MaxLength` 제한 없음 — 대용량 MD 업로드 가능
- I4. `create` 반환값에 sections/comments 미포함 — invalidateQueries로 재조회하므로 실제 문제 없음
- I5. headingComponents의 `String(children)` — React element 배열 시 slugify 불일치 가능

---

## 긍정적 사항

1. 기존 NestJS 모듈 패턴, ProjectMemberGuard, USER_SELECT 상수, TransformInterceptor 패턴 충실히 준수
2. Prisma 스키마 설계 견고 (적절한 인덱스, cascade/setNull, unique 제약)
3. RESTful API 설계 (nested resource 패턴 일관)
4. MarkdownEditor, MarkdownViewer 등 기존 컴포넌트 적절히 재활용
5. DTO class-validator 입력 검증 적용

---

## pitb-wireframe 비교 분석

### 기능 비교 요약

| 기능 | pitb-wireframe | PM App Specs |
|------|:-:|:-:|
| MD 렌더링 + TOC | O | O |
| 섹션별 코멘트 | O | O |
| 코멘트 Resolve/스레딩 | O | O |
| **Spec CRUD (생성/수정/삭제)** | X (읽기전용) | **O** |
| **상태 라이프사이클** | X | **O** (DRAFT→REVIEW→APPROVED→DEPRECATED) |
| **인증 기반 코멘트** | X (localStorage 이름) | **O** (JWT 사용자) |
| **서버 섹션 동기화** | X (클라이언트 slug) | **O** (DB 영속) |
| **Syntax Highlighting** | X | **O** |
| **멀티 프로젝트** | X | **O** |
| Comment Popover (헤딩 인라인) | **O** | X |
| Mermaid 다이어그램 | **O** | X |
| 사이드바 접기/검색 | **O** | X |
| All/Unresolved 필터 토글 | **O** | X (카운트만 표시) |
| 와이어프레임 임베드 | **O** | X |
| 다크 모드 | **O** | X |

### Phase 2 포팅 추천 (우선순위순)

1. **Comment Popover** — 헤딩 클릭 시 인라인 코멘트 폼. UX 마찰 크게 감소
2. **Mermaid 다이어그램** — 기술 기획서에 필수. pitb 구현체 63줄로 간단
3. **사이드바 검색** — 기획서 많을 때 필수. 구현 간단
4. **사이드바 접기** — 콘텐츠 영역 확보
5. **코멘트 패널 토글** — 리뷰 안 할 때 공간 확보
6. **Spec ↔ Issue 양방향 링크** — 기획→구현 추적성
