# 기획서: Markdown Description 편집 기능

## 요구사항 요약

- 이슈의 description 필드를 Markdown으로 작성/편집/렌더링할 수 있도록 한다
- Jira/Linear처럼 클릭하면 인라인 편집 모드로 전환되는 UX
- 생성 모달의 textarea도 Markdown 에디터로 교체
- GFM(GitHub Flavored Markdown) 전체 지원: 테이블, 체크리스트, 코드블록 등

## 영향 범위

- **서비스**: Frontend only (BE는 이미 string으로 저장하므로 변경 없음)
- **수정 파일**:
  - `packages/web/package.json` — Markdown 관련 의존성 추가
  - `packages/web/src/pages/BoardPage.tsx` — IssueDetailPanel description 영역을 인라인 편집 가능한 Markdown 에디터/렌더러로 교체
  - `packages/web/src/components/issue/CreateIssueModal.tsx` — textarea를 Markdown 에디터로 교체
- **신규 파일**:
  - `packages/web/src/components/markdown/MarkdownEditor.tsx` — Write/Preview 탭 전환 Markdown 에디터 (툴바 포함)
  - `packages/web/src/components/markdown/MarkdownViewer.tsx` — Markdown → HTML 렌더러
  - `packages/web/src/components/markdown/markdown.css` — Markdown 렌더링 스타일 (prose 기반)

## 기술 선택

### 라이브러리

| 패키지 | 용도 | 사이즈 |
|--------|------|--------|
| `react-markdown` | Markdown → React 렌더링 | ~12KB |
| `remark-gfm` | GFM 확장 (테이블, 체크리스트, 취소선) | ~3KB |
| `rehype-sanitize` | XSS 방지 HTML 정제 | ~5KB |
| `rehype-highlight` | 코드블록 구문 강조 | ~2KB (+highlight.js) |

**선택 이유**: react-markdown은 React 생태계 표준, AST 기반으로 안전(dangerouslySetInnerHTML 없음), remark/rehype 플러그인으로 확장 용이.

## 구현 방안

### 1단계: 의존성 설치

```bash
cd packages/web
pnpm add react-markdown remark-gfm rehype-sanitize rehype-highlight
```

### 2단계: MarkdownViewer 컴포넌트

- `react-markdown` + `remark-gfm` + `rehype-sanitize`로 안전한 렌더링
- Tailwind의 `prose` 클래스 기반 타이포그래피
- 코드블록 구문 강조 (highlight.js)
- 체크리스트, 테이블 스타일링

### 3단계: MarkdownEditor 컴포넌트

- **Write / Preview 탭** 전환 UI
- Write 모드: textarea + 간단 툴바 (Bold, Italic, Code, Link, List, Heading)
- Preview 모드: MarkdownViewer로 실시간 렌더링
- 툴바는 텍스트 선택 → 마크다운 문법 삽입 방식
- Ctrl+B(Bold), Ctrl+I(Italic) 키보드 단축키

### 4단계: BoardPage IssueDetailPanel 인라인 편집

- 기존 `whitespace-pre-wrap` 텍스트 → MarkdownViewer로 교체
- 클릭 시 MarkdownEditor로 전환 (인라인 편집 모드)
- blur 또는 저장 버튼 클릭 시 API 호출 → 뷰 모드로 복귀
- ESC 키로 편집 취소
- description이 비어있을 때 "Add description..." 플레이스홀더

### 5단계: CreateIssueModal 교체

- 기존 textarea → MarkdownEditor 컴포넌트로 교체
- 생성 모달에서도 동일한 Write/Preview 경험

## 상세 UX 흐름

### 이슈 상세 패널 (인라인 편집)

```
[뷰 모드]                          [편집 모드]
┌─────────────────────┐            ┌─────────────────────┐
│ Description         │   click    │ Write | Preview     │
│                     │  ------→   ├─────────────────────┤
│ ## 버그 설명        │            │ B I ~ 🔗 `` ```    │
│ `userId`가 **null** │            ├─────────────────────┤
│ 일 때 에러 발생     │            │ ## 버그 설명        │
│                     │            │ `userId`가 **null** │
│                     │            ├─────────────────────┤
│   ✏️ hover 시 표시  │            │ [Save] [Cancel]     │
└─────────────────────┘            └─────────────────────┘
```

## API 변경사항

없음. BE는 이미 description을 String?으로 저장하며 변경 불필요.

## 리스크 및 고려사항

- **XSS**: `rehype-sanitize`로 HTML 정제. 사용자 입력을 렌더링하므로 필수.
- **번들 사이즈**: react-markdown + remark-gfm + rehype-sanitize ≈ ~20KB gzip. highlight.js는 필요한 언어만 등록하여 최소화.
- **기존 데이터 호환**: 기존 plain text description은 markdown으로 해석해도 동일하게 보임 (마크다운은 plain text의 상위 집합).
- **Activity 로그**: description 변경은 이미 activity에 기록됨. Markdown raw text가 저장되므로 diff 표시는 기존과 동일.

## 예상 작업량

- 파일 수: 6개 (신규 3, 수정 3)
- 복잡도: 보통
