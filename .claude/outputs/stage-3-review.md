# Stage 3: 코드리뷰 종합 결과

## 리뷰 결과 요약: 모든 Critical/Warning 수정 완료

---

## 수정된 Critical 이슈 (4건)

### C1: CommentInput 멘션 시스템 HTML 비호환 → 수정 완료
- `CommentInput.tsx`의 `@` 감지를 `htmlToPlainText()` 유틸로 HTML→plain text 변환 후 수행하도록 변경
- `insertMention`에서 HTML 문자열 직접 슬라이싱 제거

### C2: 이미지 업로드 실패 시 Object URL fallback → 수정 완료
- `TipTapEditor.tsx:213-216`의 `URL.createObjectURL` fallback 제거
- 에러 시 toast 메시지로 사용자에게 알림

### C3: 에디터 submit 후 초기화 안 됨 → 수정 완료
- `TipTapEditor.tsx:189-197`의 useEffect에 `content === ''` 시 `editor.commands.clearContent()` 호출 추가

### C4: markdownToHtml 이미지/링크 regex 순서 버그 → 수정 완료
- 이미지 패턴(`![alt](url)`)을 링크 패턴(`[text](url)`)보다 먼저 배치

---

## 수정된 Warning 이슈 (4건)

### W1-W2: DTO entries 검증 부족 → 수정 완료
- `CredentialEntryDto.key`에 `@MaxLength(200)` 추가
- `CredentialEntryDto.value`에 `@MaxLength(5000)` 추가
- `CreateCredentialDto.entries`에 `@ArrayMaxSize(50)` 추가
- `description`에 `@MaxLength(1000)`, `url`에 `@MaxLength(2000)` 추가

### W3: `@tiptap/extension-mention` 데드 의존성 → 제거 완료

### W4: `credential.service.ts`의 `as any` 캐스팅 → 수정 완료
- `dto.entries as any` → `dto.entries as unknown as Prisma.InputJsonValue`

---

## 남은 Info 사항 (수정 불필요, 향후 개선)

- CredentialManager에 role 기반 UI 분기 없음 (서버 403으로 보호됨)
- TipTap CSS에 하드코딩 색상 (다크모드 미지원 상태이므로 무관)
- `window.prompt()` 사용 for Link 삽입 (향후 커스텀 인라인 입력 교체 권장)
- MarkdownViewer HTML 감지 로직 (향후 format 메타데이터 필드 추가 가능)

---

## 빌드 검증
- API: tsc --noEmit 통과
- Web: tsc -b && vite build 통과
