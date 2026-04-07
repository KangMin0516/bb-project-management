## 기획서: 오버듀 이슈 강조 표시

### 요구사항 요약
보드(IssueCard)와 이슈 리스트(IssuesPage)에서 기한이 지난 이슈를 빨간색으로 시각적 강조 표시.

---

### 구현 방안

기존 `getDueBadge()` 함수가 이미 overdue를 감지하고 빨간 배지를 반환하지만, 카드/행 자체의 배경이나 테두리에는 적용되지 않음. 이를 확장.

#### 1. `lib/time.ts` — `isOverdue` 헬퍼 추가
```ts
export function isOverdue(dueDate: string | null): boolean
```
- DONE, CANCELED 상태가 아닌 이슈에서만 사용 (호출 측에서 판단)

#### 2. `IssueCard.tsx` — 오버듀 카드 강조
- 카드 border를 `border-red-300`으로 변경
- 좌측에 빨간 bar (border-left) 추가
- 기존 dueBadge는 유지

#### 3. `IssuesPage.tsx` — 오버듀 행 강조
- 테이블 행 배경을 `bg-red-50/50`으로 변경
- Due 컬럼 텍스트 빨간색 강조

#### 4. `BoardPage.tsx` — 보드 상세 패널에서도 오버듀 표시
- 이미 dueBadge가 표시되므로 추가 변경 불필요 (확인만)

---

### 영향 범위
- **서비스**: Web만 (API 변경 없음)
- **수정 파일**: 3개

| 파일 | 변경 사유 |
|------|-----------|
| `packages/web/src/lib/time.ts` | `isOverdue()` 헬퍼 추가 |
| `packages/web/src/components/board/IssueCard.tsx` | 오버듀 카드 border 강조 |
| `packages/web/src/pages/IssuesPage.tsx` | 오버듀 행 배경 강조 |

### 리스크
- 없음 (프론트엔드 CSS만 변경, API 변경 없음)

### 예상 작업량
- 파일 수: 3개
- 복잡도: 낮음
