## Stage 2: 구현 보고서 — 코드리뷰 C1 + W1~W4 수정

### 수정 대상: `/3-review` Critical 1건 + Warning 4건

| # | 등급 | 이슈 | 수정 내용 |
|---|------|------|-----------|
| C1 | Critical | `useCallback(onSelect, [])` stale closure | `useRef` 패턴으로 교체 |
| W1 | Warning | `as unknown as Issue` 잔존 | `IssueDetail extends Issue`이므로 캐스팅 제거 |
| W2 | Warning | Promise 에러 미처리 | `.then(onSuccess, onError)` 패턴으로 에러 핸들링 추가 |
| W3 | Warning | 불필요한 `as Comment`/`as Activity` | discriminated union narrowing으로 캐스팅 제거 |
| W4 | Warning | `setSearchParams({})` 전체 삭제 | `prev.delete('open')` 방식으로 `open`만 제거 |

### 수정 파일 (3개)

| 파일 | 변경 내용 |
|------|-----------|
| `useOpenIssueFromUrl.ts` | C1(`useRef` 패턴), W4(`prev.delete('open')`) |
| `IssueDetailPanel.tsx` | W1(캐스팅 제거), W2(에러 핸들링) — parent/child 네비게이션 2곳 |
| `ActivityTab.tsx` | W3(`as Comment`/`as Activity` 제거) |

### 자체 점검

- [x] Web 타입 오류 없음 (`tsc --noEmit` 통과)
- [x] Critical 1건 + Warning 4건 모두 수정 완료
- [x] 기존 기능 유지
- [x] 불필요한 변경 없음
