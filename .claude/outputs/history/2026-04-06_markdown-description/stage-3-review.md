# Code Review: Markdown Description 편집 기능

## 리뷰 대상 파일
- `packages/web/src/components/markdown/MarkdownViewer.tsx`
- `packages/web/src/components/markdown/MarkdownEditor.tsx`
- `packages/web/src/components/markdown/markdown.css`
- `packages/web/src/pages/BoardPage.tsx`
- `packages/web/src/components/issue/CreateIssueModal.tsx`

## 발견 이슈 및 수정 내역

### 1. [Warning] rehype 플러그인 실행 순서 오류 — 수정 완료

**파일**: `MarkdownViewer.tsx`

**문제**: `rehypePlugins`에서 `rehypeSanitize`가 `rehypeHighlight`보다 먼저 실행되고 있었음. rehype 플러그인은 배열 순서대로 실행되므로, sanitize가 먼저 돌면 highlight가 이후에 삽입하는 HTML class/속성이 sanitize를 우회하게 됨.

**수정**: 플러그인 순서를 `[rehypeHighlight, rehypeSanitize]`로 변경하여, highlight가 먼저 코드 블록을 처리한 뒤 sanitize가 최종 방어선으로 동작하도록 함.

### 2. [Warning] Description 비우기 불가 버그 — 수정 완료

**파일**: `BoardPage.tsx` (IssueDetailPanel)

**문제**: Save 버튼 클릭 시 `description: draftDescription || undefined`로 처리하고 있었음. 사용자가 description을 모두 지우고 저장하면 `draftDescription`이 빈 문자열이 되어 `undefined`로 변환되고, `UpdateIssuePayload`에서 `description` 필드가 누락되어 실제로는 업데이트가 발생하지 않음. 즉, description을 비울 수 없는 버그.

**수정**: `draftDescription || undefined` → `draftDescription`로 변경. 빈 문자열도 그대로 API에 전달하여 description 삭제가 가능하도록 함.

### 3. [Warning] 미사용 ref 및 import — 수정 완료

**파일**: `BoardPage.tsx` (IssueDetailPanel)

**문제**: `descriptionRef`가 선언만 되고 실제로 사용되지 않음. 이로 인해 `useRef` import도 불필요.

**수정**: `descriptionRef` 선언 제거, `useRef` import 제거.

### 4. [Warning] 플러그인 배열 매 렌더 재생성 — 수정 완료

**파일**: `MarkdownViewer.tsx`

**문제**: `remarkPlugins={[remarkGfm]}`과 `rehypePlugins={[...]}` 배열이 렌더마다 새로 생성되어 ReactMarkdown 내부에서 불필요한 재처리가 발생할 수 있음.

**수정**: 플러그인 배열을 모듈 레벨 상수(`REMARK_PLUGINS`, `REHYPE_PLUGINS`)로 추출.

## 이슈 없음 확인 항목

| 관점 | 결과 |
|------|------|
| XSS 방지 | rehype-sanitize 적용됨. 플러그인 순서 수정으로 sanitize가 최종 단계에서 동작 |
| 타입 안전성 | any 타입 없음. Props 인터페이스 적절함 |
| 인라인 편집 모드 전환 | 클릭→편집, Save/Cancel/ESC 동작 정상 |
| CreateIssueModal 에디터 | MarkdownEditor 정상 통합, 빈 description은 undefined로 전달 (생성 시에는 올바른 동작) |
| 빈 description | placeholder 표시 정상 |
| 매우 긴 description | textarea resize-y, overflow-y-auto로 처리됨 |
| 접근성 | role="dialog", aria-modal, aria-label 적절히 적용 |
| 기존 코드 패턴 일관성 | mutation/query 패턴, Tailwind 클래스 사용 기존 코드와 일관 |
| CSS 스타일 | markdown-body 클래스로 격리, 전역 오염 없음 |

## 타입 검증

```
npx tsc --noEmit → 오류 없음
```

## 수정하지 않은 항목 (Info)

- MarkdownEditor의 toolbar 아이콘에 emoji(`🔗`)가 하나 포함됨. 접근성 관점에서 aria-label이 `title` 속성으로 제공되고 있어 문제없음.
- MarkdownEditor 컴포넌트에 React.memo 미적용. 현재 사용처에서 부모 리렌더링 빈도가 낮아 실질적 영향 없음.
