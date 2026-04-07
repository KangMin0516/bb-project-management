## Stage 2: 구현 보고서 — 오버듀 이슈 강조 표시

### 구현 완료 항목

| # | 항목 | 파일 | 상태 |
|---|------|------|------|
| 1 | `isOverdue()` 헬퍼 | `packages/web/src/lib/time.ts` | 완료 |
| 2 | 오버듀 카드 border 강조 | `packages/web/src/components/board/IssueCard.tsx` | 완료 |
| 3 | 오버듀 행 배경 강조 | `packages/web/src/pages/IssuesPage.tsx` | 완료 |

### 변경 상세

#### 1. `lib/time.ts` — `isOverdue()` 추가
- `dueDate`를 받아 오늘 기준 과거인지 boolean 반환
- `null | undefined` 처리 포함
- 기존 `getDueBadge()`와 동일한 날짜 비교 로직 (시간 무시)

#### 2. `IssueCard.tsx` — 오버듀 카드 시각적 강조
- `status !== 'DONE' && status !== 'CANCELED'` 조건으로 완료/취소 이슈 제외
- 오버듀 카드: `border-red-300` + `border-l-4 border-l-red-500` (좌측 빨간 바)
- 정상 카드: 기존 `border-gray-200` 유지

#### 3. `IssuesPage.tsx` — 오버듀 행 강조
- 오버듀 행: `bg-red-50/50` 배경 + 타이틀 `text-red-700`
- 동일하게 DONE/CANCELED 제외

### 자체 점검

- [x] TypeScript 타입 체크 통과 (`tsc --noEmit`)
- [x] 기존 dueBadge 기능 유지
- [x] DONE/CANCELED 상태 이슈는 오버듀 스타일 미적용
- [x] API 변경 없음
- [x] 수정 파일 3개 (기획서 범위 일치)
