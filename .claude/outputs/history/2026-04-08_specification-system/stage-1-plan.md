## 기획서: MD 기획서 시각화 + 섹션별 코멘트 시스템

### 요구사항 요약

pitb-wireframe 프로젝트의 "MD 파일 기반 기획서 시각화 + 요소별 코멘트" 기능을 현재 프로젝트 관리 앱에 통합하여, **기획 → 프로젝트 관리 일원화**를 달성한다.

**핵심 워크플로우:**
```
기획서(MD) 작성/업로드 → 시각화(렌더링+TOC) → 섹션별 코멘트/피드백
→ 코멘트에서 이슈 생성 → 보드/이슈에서 기획서 원문 참조
→ 이슈 완료 → 기획서 코멘트 해결
```

---

### 참조 프로젝트 분석 (pitb-wireframe)

| 항목 | 구현 방식 |
|------|-----------|
| MD 파싱/렌더링 | react-markdown + remarkGfm + rehypeRaw |
| 기획서 관리 | /public/docs/manifest.json → MD 파일 fetch |
| 섹션 코멘트 | Supabase DB, doc_id + section_id 기반 |
| 코멘트 스레드 | parent_id로 계층, resolved 상태 추적 |
| 코멘트 UI | 헤딩에 배지 표시 + CommentPopover(인라인) + CommentPanel(사이드) |
| TOC | IntersectionObserver로 활성 헤딩 추적 |

---

### 영향 범위

**서비스:** API (NestJS) + Web (React) 모두 변경

**신규 파일:**

| 파일 | 목적 |
|------|------|
| `api/prisma/migrations/.../add_specifications` | DB 마이그레이션 |
| `api/src/specification/specification.module.ts` | 기획서 모듈 |
| `api/src/specification/specification.controller.ts` | 기획서 CRUD API |
| `api/src/specification/specification.service.ts` | 기획서 비즈니스 로직 |
| `api/src/specification/dto/*.ts` | DTO (create, update, comment) |
| `web/src/api/specifications.ts` | API 클라이언트 |
| `web/src/pages/SpecificationsPage.tsx` | 기획서 페이지 (목록+상세) |
| `web/src/components/spec/SpecContent.tsx` | MD 렌더링 + TOC + 섹션 배지 |
| `web/src/components/spec/SpecCommentPanel.tsx` | 사이드 코멘트 패널 |
| `web/src/components/spec/SpecCommentPopover.tsx` | 인라인 코멘트 팝오버 |
| `web/src/components/spec/SpecLinkedIssues.tsx` | 기획서↔이슈 링크 UI |

**수정 파일:**

| 파일 | 변경 사유 |
|------|-----------|
| `api/prisma/schema.prisma` | Specification, SpecSection, SpecComment, SpecificationIssue 모델 추가 |
| `api/src/app.module.ts` | SpecificationModule 등록 |
| `web/src/App.tsx` | `/projects/:projectId/specifications` 라우트 추가 |
| `web/src/components/layout/AppLayout.tsx` | 사이드바에 "Specifications" 네비게이션 추가 |
| `web/src/components/issue/IssueDetailPanel.tsx` | "연결된 기획서" 섹션 추가 |

---

### DB 모델 설계

```prisma
model Specification {
  id        String     @id @default(uuid())
  projectId String
  title     String     @db.VarChar(200)
  content   String     @db.Text          // MD 본문 (DB 저장)
  category  String?    @db.VarChar(50)   // FRS, FLOW, DESIGN 등
  status    SpecStatus @default(DRAFT)
  order     Int        @default(0)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  creatorId String

  sections    SpecSection[]
  comments    SpecComment[]
  linkedIssues SpecificationIssue[]
}

enum SpecStatus { DRAFT, REVIEW, APPROVED, DEPRECATED }

model SpecSection {
  id        String @id @default(uuid())
  specId    String
  sectionId String @db.VarChar(100)  // slugified heading
  level     Int                       // h1=1, h2=2, ...
  title     String @db.VarChar(300)
  order     Int    @default(0)

  comments  SpecComment[]
  @@unique([specId, sectionId])
}

model SpecComment {
  id         String   @id @default(uuid())
  specId     String
  sectionId  String?                  // null = 문서 전체 코멘트
  content    String   @db.Text
  resolved   Boolean  @default(false)
  userId     String
  parentId   String?                  // 스레드 답글
  linkedIssueId String?               // 코멘트→이슈 링크
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model SpecificationIssue {
  specId   String
  issueId  String
  linkType SpecLinkType @default(IMPLEMENTS)
  @@id([specId, issueId])
}

enum SpecLinkType { IMPLEMENTS, REFERENCES }
```

---

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/projects/:pid/specifications` | 기획서 목록 (카테고리/상태 필터) |
| POST | `/projects/:pid/specifications` | 기획서 생성 (MD 본문 포함) |
| GET | `/specifications/:id` | 기획서 상세 + 섹션 + 코멘트 수 |
| PATCH | `/specifications/:id` | 기획서 수정 (제목/본문/상태) |
| DELETE | `/specifications/:id` | 기획서 삭제 |
| GET | `/specifications/:id/comments` | 코멘트 목록 (섹션 필터 가능) |
| POST | `/specifications/:id/comments` | 코멘트 생성 |
| PATCH | `/specifications/:id/comments/:cid` | 코멘트 수정/해결 토글 |
| DELETE | `/specifications/:id/comments/:cid` | 코멘트 삭제 |
| POST | `/specifications/:id/link-issue` | 이슈 링크 |
| DELETE | `/specifications/:id/unlink-issue/:iid` | 이슈 언링크 |

---

### 구현 방안

#### Phase 1: MVP — 기획서 CRUD + 시각화 + 코멘트

1. **DB 스키마 + 마이그레이션** — Specification, SpecSection, SpecComment 모델
2. **백엔드 모듈** — SpecificationModule (CRUD + 코멘트)
   - 기획서 생성 시 MD를 파싱하여 SpecSection 자동 추출 (헤딩 기반)
   - 코멘트 생성 시 @mention 알림 (기존 패턴 재사용)
3. **프론트 페이지** — SpecificationsPage
   - 좌측: 기획서 목록 (카테고리별 그룹, 상태 배지)
   - 중앙: MD 렌더링 + TOC (IntersectionObserver) + 헤딩에 코멘트 수 배지
   - 우측: SpecCommentPanel (섹션 필터, 해결 상태 토글, 스레드)
4. **인라인 코멘트** — 헤딩 클릭 → SpecCommentPopover → 빠른 코멘트 추가
5. **네비게이션** — 사이드바에 "Specs" 메뉴 추가, 라우트 등록

#### Phase 2: 이슈 연결

6. **SpecificationIssue 링크** — 기획서↔이슈 N:N 관계
7. **기획서에서 이슈 생성** — 코멘트에서 "Create Issue" 버튼 → 기획서 제목/섹션 자동 채움
8. **이슈 상세에 기획서 참조** — IssueDetailPanel에 "Linked Specs" 섹션 추가
9. **코멘트→이슈 링크** — 코멘트 해결 시 연결된 이슈 참조

---

### 기존 컴포넌트 재사용

| 기존 컴포넌트 | 재사용 방식 |
|--------------|-------------|
| MarkdownEditor | 기획서 본문 편집 (그대로 사용) |
| MarkdownViewer | 기획서 렌더링 (커스텀 헤딩 컴포넌트 확장) |
| CommentInput | 기획서 코멘트 입력 (@mention 포함, 그대로 사용) |
| CommentItem | 기획서 코멘트 표시 (resolved 상태 추가 확장) |
| markdown.css | 스타일 그대로 사용 |

---

### 리스크 및 고려사항

| 리스크 | 대응 |
|--------|------|
| MD 본문이 DB에 저장되어 대용량 기획서 시 성능 | content를 lazy load, 목록에서는 제외 |
| 섹션 파싱 정확도 (헤딩 ID 생성) | slugify 라이브러리 사용, 중복 시 suffix 추가 |
| 기획서 수정 시 섹션 변경 → 기존 코멘트 고아화 | sectionId는 유지, 삭제된 섹션 코멘트는 "문서 전체"로 이동 |
| 코멘트 테이블 분리 (Issue Comment vs Spec Comment) | 의도적 분리 — 기획 피드백과 개발 피드백의 맥락이 다름 |

---

### 예상 작업량

- **신규 파일**: ~15개
- **수정 파일**: ~5개
- **DB 마이그레이션**: 1개 (4 테이블 + 2 enum)
- **복잡도**: 보통~높음
- **Phase 1 (MVP)**: 주요 구현
- **Phase 2 (이슈 연결)**: 확장
