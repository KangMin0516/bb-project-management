## Stage 3: 코드리뷰 종합 결과 — Warning 7건 수정 재검증

### 전체 요약
- **Critical**: 1건
- **Warning**: 4건
- **Info**: 2건

---

### Critical (1건)

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| C1 | `useCallback(onSelect, [])` stale closure | `useOpenIssueFromUrl.ts:13` | 빈 의존성 배열로 최초 렌더의 콜백만 캡처. `useRef` 패턴으로 교체 필요 |

### Warning (4건)

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| W1 | `as unknown as Issue` 잔존 | `IssueDetailPanel.tsx:179,400` | `IssueDetail extends Issue`이므로 캐스팅 불필요, 오히려 타입 안전성 약화 |
| W2 | Promise 에러 미처리 | `IssueDetailPanel.tsx:178,399` | `issueApi.get().then()` 에러 핸들러 없음, unhandled rejection 위험 |
| W3 | 불필요한 타입 캐스팅 | `ActivityTab.tsx:97` | discriminated union에서 `as Comment`/`as Activity` 불필요 |
| W4 | 쿼리 파라미터 전체 삭제 | `useOpenIssueFromUrl.ts:25` | `setSearchParams({})`가 `open` 외 모든 파라미터 삭제 |

### Info (2건)

| # | 이슈 | 설명 |
|---|------|------|
| I1 | IssueDetailPanel 430줄 | DetailsTab 추출 고려 (향후) |
| I2 | types.ts 단일 타입 | 현재는 과도한 분리일 수 있으나 유지 가능 |

### 긍정적 사항
- onCloseRef 패턴 적용 우수
- useOpenIssueFromUrl 훅 추출 DRY 원칙 준수
- ActivityTab/AttachmentItem 분리로 SRP 달성
- lucide 아이콘 전환으로 일관성 확보
- import 순서 일관성 유지
