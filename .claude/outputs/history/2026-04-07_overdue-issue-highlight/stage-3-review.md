## Stage 3: 코드리뷰 종합 결과 — 오버듀 이슈 강조 표시

### 전체 요약
- **Critical**: 0건
- **Warning**: 2건
- **Info**: 2건
- **결론**: Critical 없음, Warning은 DRY 관련으로 수정 권장

---

### Warning

**W1. 날짜 비교 로직 중복 (DRY 위반)**
- `isOverdue()`와 `getDueBadge()` 내부에 동일한 날짜 정규화 로직 중복
- 권장: `dueDiff()` 내부 헬퍼 추출하여 재사용

**W2. 오버듀 판정 조건 중복 (Shotgun Surgery 위험)**
- `issue.status !== 'DONE' && issue.status !== 'CANCELED'` 조건이 IssueCard.tsx, IssuesPage.tsx에 반복
- 권장: `isIssueOverdue(issue)` 통합 함수로 한 곳에서 관리

---

### Info

**I1. useMemo 전략 불일치**
- `dueBadge`는 useMemo로 감싸져 있으나 `overdue`는 인라인 계산
- 성능 영향 미미하나 일관성 측면에서 통일 권장

**I2. hover 배경색 충돌**
- 오버듀 행의 `bg-red-50/50`이 hover 시 `hover:bg-gray-50`으로 덮어씌워짐
- 기능 이슈 아님, UX 개선 시 `hover:bg-red-100/50` 고려

---

### 긍정적 사항
1. SRP 준수 — `isOverdue()` 순수 함수 분리
2. DONE/CANCELED 제외 비즈니스 로직 정확
3. 변경 범위 최소 (3파일, API 변경 없음)
4. 보안 이슈 없음
5. 기존 dueBadge 기능 완전 보존
