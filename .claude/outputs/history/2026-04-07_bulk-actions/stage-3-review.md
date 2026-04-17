## Stage 3: 코드리뷰 종합 결과 — 이슈 일괄 작업 (Bulk Actions)

### 전체 요약
- **Critical**: 0건
- **Warning**: 4건
- **Info**: 3건

---

### Warning

| # | 항목 | 파일 | 출처 |
|---|------|------|------|
| W1 | `displayItems` useMemo 선언을 `toggleSelectAll` 위로 이동 (가독성) | IssuesPage.tsx | 양쪽 |
| W2 | activity 추적 + 알림 로직이 단건 update와 중복 → `buildActivities()`, `notifyAssignment()` 헬퍼 추출 | issue.service.ts | CTO |
| W3 | Priority 옵션 하드코딩 → 상수 참조로 변경 | BulkActionBar.tsx | CTO |
| W4 | bulkUpdate에서 요청/실제 이슈 수 불일치 시 무시됨 | issue.service.ts | 양쪽 |

### Info

| # | 항목 |
|---|------|
| I1 | bulkDelete에 @Post vs @Delete — 현행 POST 유지 가능 (프록시 호환성) |
| I2 | confirm() 대신 커스텀 모달 권장 — 기존 단건 삭제와 동일 패턴이므로 현행 유지 가능 |
| I3 | ArrayMaxSize 상한 추가 권장 |

### 긍정적 사항
- 라우트 순서 올바르게 배치 (bulk 엔드포인트 → :issueId 파라미터)
- 트랜잭션으로 원자적 처리
- DTO 유효성 검증 세밀함
- 체크박스 stopPropagation 처리
- BulkActionBar 컴포넌트 분리로 복잡도 관리
