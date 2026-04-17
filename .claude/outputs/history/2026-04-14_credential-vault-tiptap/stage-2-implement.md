# Stage 2: 구현 완료 보고

## Feature A: 프로젝트 Credential 관리

### 신규 파일
- `packages/api/prisma/migrations/20260412022528_add_project_credentials/` — DB 마이그레이션
- `packages/api/src/credential/credential.module.ts` — NestJS 모듈
- `packages/api/src/credential/credential.service.ts` — CRUD + sensitive 값 마스킹 서비스
- `packages/api/src/credential/credential.controller.ts` — REST 엔드포인트 (ProjectMemberGuard + Roles)
- `packages/api/src/credential/dto/create-credential.dto.ts` — 생성 DTO
- `packages/api/src/credential/dto/update-credential.dto.ts` — 수정 DTO
- `packages/api/src/credential/dto/index.ts` — DTO barrel export
- `packages/web/src/api/credentials.ts` — API 클라이언트
- `packages/web/src/components/settings/CredentialManager.tsx` — 카드 UI + 상세 + 모달

### 수정 파일
- `packages/api/prisma/schema.prisma` — ProjectCredential 모델 + Project/User 역관계 추가
- `packages/api/src/app.module.ts` — CredentialModule 등록
- `packages/web/src/pages/SettingsPage.tsx` — Credentials 섹션 추가

### API 엔드포인트
| Method | Endpoint | 권한 |
|--------|----------|------|
| GET | `/projects/:projectId/credentials` | MEMBER |
| GET | `/projects/:projectId/credentials/:id` | MEMBER |
| GET | `/projects/:projectId/credentials/:id/reveal` | ADMIN/PM |
| POST | `/projects/:projectId/credentials` | ADMIN/PM |
| PATCH | `/projects/:projectId/credentials/:id` | ADMIN/PM |
| DELETE | `/projects/:projectId/credentials/:id` | ADMIN/PM |

---

## Feature B: TipTap WYSIWYG 에디터

### 신규 패키지
`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/extension-image`, `@tiptap/extension-table`, `@tiptap/extension-mention`, `@tiptap/extension-code-block-lowlight`, `lowlight`, `dompurify`, `@types/dompurify`

### 신규 파일
- `packages/web/src/components/editor/TipTapEditor.tsx` — WYSIWYG 에디터 (StarterKit + Link/Image/Table/CodeBlock 확장)
- `packages/web/src/components/editor/TipTapToolbar.tsx` — 툴바 (Bold, Italic, Strike, Code, H1-H3, Lists, Blockquote, CodeBlock, Link, Image, Table, Undo/Redo)
- `packages/web/src/components/editor/editor.css` — 에디터 스타일

### 수정 파일
- `packages/web/src/components/markdown/MarkdownViewer.tsx` — HTML 콘텐츠 감지 + DOMPurify 렌더링 추가
- `packages/web/src/components/issue/CreateIssueModal.tsx` — MarkdownEditor → TipTapEditor
- `packages/web/src/components/issue/IssueDetailPanel.tsx` — MarkdownEditor → TipTapEditor
- `packages/web/src/components/comment/CommentInput.tsx` — MarkdownEditor → TipTapEditor + onSubmit
- `packages/web/src/components/template/TemplateManager.tsx` — MarkdownEditor → TipTapEditor

### 호환성
- 기존 Markdown 콘텐츠: MarkdownViewer가 자동 감지하여 ReactMarkdown으로 렌더링
- 새 콘텐츠: HTML로 저장, MarkdownViewer가 DOMPurify로 안전하게 렌더링
- 기존 MarkdownEditor.tsx 보존 (백업)

---

## 기타 수정
- `packages/web/src/hooks/useOpenIssueFromUrl.ts` — toast 타입 'warning' → 'error' (기존 빌드 에러 수정)

## 자체 점검
- [x] 타입 오류 없음 (tsc --noEmit 통과)
- [x] 빌드 성공 (npm run build 통과)
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음
