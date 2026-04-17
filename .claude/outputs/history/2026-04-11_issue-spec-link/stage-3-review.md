# 코드리뷰 결과 (2차): 리뷰 피드백 수정 (R1~R3, C4~C5)

## 리뷰어
- Step 1: Code Reviewer (기능 리뷰)
- Step 2: CTO (아키텍처 리뷰)

## Critical: 없음

## Warning: 없음

## Info / 참고

### W1 — findBySpec에 projectId 검증 없음 (Reviewer)
- **파일**: `issue-spec-link.service.ts:86-94`
- **내용**: `findBySpec`는 엔드포인트 미노출 상태이므로 현재 문제 없음. 향후 노출 시 검증 필요.

### W2 — LinkSpecModal 이미 연결된 spec 미필터링 (Reviewer)
- **내용**: 이미 연결된 spec을 다시 클릭 시 P2002 → BadRequest 처리됨. UX 개선 사항.

### R1 — verifyIssue 헬퍼 추출 (CTO)
- **내용**: create/findByIssue에서 반복되는 projectId 검증 로직을 헬퍼로 추출 권장. 블로커 아님.

## 긍정 사항

- 이전 리뷰 피드백 R1~R3, C4~C5 모든 항목 정확히 반영
- IDOR 방지를 위한 projectId + issueId 이중 검증 적절
- P2002 try-catch 패턴 정확 (다른 예외 재전파 포함)
- 변경 범위 최소, 불필요한 수정 없음
- CTO 유지보수성 점수: 8/10

## 판정

- **Critical**: 0건
- **Warning**: 0건
- **승인** → `/4-test` 진행 가능
