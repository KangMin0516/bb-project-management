# 기획서: 프로젝트 계정 관리 + TipTap 에디터 도입

## 요구사항 요약

### Feature A: 프로젝트 Credential 관리
- 프로젝트별 외부 서비스 계정/키를 저장 (AWS, DB, API 키 등)
- 간단 구현: 암호화 없이 DB 저장, UI에서 토글 마스킹
- ADMIN/PM만 등록/수정/삭제 가능

### Feature B: TipTap WYSIWYG 에디터
- 현재 textarea + react-markdown → TipTap 에디터로 교체
- 기본 기능: Bold, Italic, Strike, Heading, List, Code, Link
- 추가 기능: 이미지 업로드 (S3 연동), 테이블, 멘션

---

## Feature A: 프로젝트 Credential 관리

### 데이터 모델

```prisma
model ProjectCredential {
  id          String   @id @default(uuid())
  name        String                          // e.g. "AWS Production"
  serviceType String   @map("service_type")   // AWS, GCP, DB, SLACK, CUSTOM
  description String?
  url         String?
  entries     Json                            // [{ key: "Access Key", value: "AKIA...", sensitive: true }]

  projectId   String   @map("project_id")
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdById String   @map("created_by_id")
  createdBy   User     @relation(fields: [createdById], references: [id])

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("project_credentials")
}
```

`entries` JSON 구조:
```json
[
  { "key": "Access Key ID", "value": "AKIAIOSFODNN7EXAMPLE", "sensitive": true },
  { "key": "Secret Access Key", "value": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", "sensitive": true },
  { "key": "Region", "value": "ap-southeast-1", "sensitive": false },
  { "key": "Account ID", "value": "123456789012", "sensitive": false }
]
```

### API

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/projects/:projectId/credentials` | MEMBER | 목록 (sensitive 값 마스킹) |
| GET | `/projects/:projectId/credentials/:id` | MEMBER | 상세 (sensitive 값 마스킹) |
| GET | `/projects/:projectId/credentials/:id/reveal` | ADMIN/PM | 실제 값 반환 |
| POST | `/projects/:projectId/credentials` | ADMIN/PM | 생성 |
| PATCH | `/projects/:projectId/credentials/:id` | ADMIN/PM | 수정 |
| DELETE | `/projects/:projectId/credentials/:id` | ADMIN/PM | 삭제 |

### UI

- Settings 페이지에 **Credentials** 탭 추가
- 카드 형태 목록: 서비스 아이콘 + 이름 + 설명 + entry 수
- 카드 클릭 → 상세 보기 (키-값 테이블)
  - sensitive 항목: `••••••••` 마스킹 + 👁 토글 버튼 (reveal API 호출)
  - 복사 버튼 (클립보드)
- 추가/수정 모달: 서비스 타입 선택, 이름, URL, 키-값 쌍 동적 추가

### 영향 범위 (Feature A)

**신규 파일:**
- `packages/api/prisma/migrations/` — 마이그레이션
- `packages/api/src/credential/credential.module.ts`
- `packages/api/src/credential/credential.service.ts`
- `packages/api/src/credential/credential.controller.ts`
- `packages/api/src/credential/dto/`
- `packages/web/src/api/credentials.ts`
- `packages/web/src/components/settings/CredentialManager.tsx`

**수정 파일:**
- `packages/api/prisma/schema.prisma` — ProjectCredential 모델 추가
- `packages/api/src/app.module.ts` — CredentialModule 등록
- `packages/web/src/pages/SettingsPage.tsx` — Credentials 탭 추가

---

## Feature B: TipTap 에디터 도입

### 패키지

```
@tiptap/react
@tiptap/starter-kit          # Bold, Italic, Strike, Heading, List, Code, Blockquote, History
@tiptap/extension-link
@tiptap/extension-placeholder
@tiptap/extension-image       # 이미지 (S3 업로드 연동)
@tiptap/extension-table       # 테이블
@tiptap/extension-table-row
@tiptap/extension-table-cell
@tiptap/extension-table-header
@tiptap/extension-mention     # @멘션
@tiptap/extension-code-block-lowlight  # 코드 하이라이팅
```

### 구현 방안

1. **TipTapEditor 컴포넌트** 생성
   - StarterKit + 위 확장 기능
   - 툴바: Bold, Italic, Strike, H1-H3, BulletList, OrderedList, Code, CodeBlock, Link, Image, Table
   - 이미지: 드래그앤드롭 → S3 업로드 → URL 삽입
   - 출력: HTML 저장 (기존 Markdown과 호환성 유지를 위해 양방향 변환)

2. **기존 MarkdownEditor 교체**
   - `CreateIssueModal` — 이슈 설명
   - `IssueDetailPanel` — 이슈 설명 편집
   - `CommentInput` — 댓글 입력
   - `TemplateManager` — 템플릿 편집

3. **MarkdownViewer 유지**
   - 기존 저장된 Markdown 콘텐츠는 그대로 렌더링
   - 새 콘텐츠는 HTML로 저장, 뷰어에서 HTML도 렌더링 가능하도록

4. **Markdown ↔ HTML 호환**
   - 기존 데이터(Markdown)는 TipTap에서 로드 시 자동 변환
   - 새 데이터는 HTML로 저장
   - 뷰어(MarkdownViewer)를 RichContentViewer로 개선: HTML이면 그대로, MD면 react-markdown

### 영향 범위 (Feature B)

**신규 파일:**
- `packages/web/src/components/editor/TipTapEditor.tsx` — 에디터 컴포넌트
- `packages/web/src/components/editor/TipTapToolbar.tsx` — 툴바
- `packages/web/src/components/editor/extensions/` — 커스텀 확장
- `packages/web/src/components/editor/editor.css` — 에디터 스타일

**수정 파일:**
- `packages/web/package.json` — TipTap 패키지 추가
- `packages/web/src/components/issue/CreateIssueModal.tsx` — 에디터 교체
- `packages/web/src/components/issue/IssueDetailPanel.tsx` — 에디터 교체
- `packages/web/src/components/comment/CommentInput.tsx` — 에디터 교체
- `packages/web/src/components/template/TemplateManager.tsx` — 에디터 교체
- `packages/web/src/components/markdown/MarkdownViewer.tsx` — HTML 렌더링 지원 추가

---

## 리스크 및 고려사항

1. **Credential 보안**: 암호화 없이 DB 저장 — 프로덕션 DB 접근 권한 관리가 중요
2. **TipTap 번들 사이즈**: ~150KB gzip — 코드 스플리팅으로 lazy load 권장
3. **기존 Markdown 호환**: 기존에 Markdown으로 저장된 데이터를 TipTap에서 읽을 수 있도록 변환 필요
4. **이미지 업로드**: 기존 S3 업로드 API 재사용 가능

## 예상 작업량

| Feature | 파일 수 | 복잡도 |
|---------|---------|--------|
| A: Credential 관리 | ~10개 | 보통 |
| B: TipTap 에디터 | ~12개 | 보통 |
| 합계 | ~22개 | 보통 |

## 병렬 구현 전략

- **Agent 1**: Feature A (Credential) — 백엔드 + 프론트엔드
- **Agent 2**: Feature B (TipTap) — 프론트엔드 전용

두 Feature는 독립적이므로 완전 병렬 가능.
