# 코드리뷰 결과: Activity 탭 댓글 기능

## 리뷰 수행: 2-Step (기능 리뷰 + CTO 리뷰)

## 발견 및 수정 사항

### Critical (3건) — 모두 수정 완료

| # | 이슈 | 수정 내용 |
|---|------|-----------|
| 1 | IDOR 취약점: issueId 소속 검증 누락 | `verifyIssue()` 메서드 추가, update/remove에 issueId 검증 추가 |
| 2 | MaxLength 누락 | DTO에 `@MaxLength(10000)` 추가 |
| 3 | limit 상한 미검증 | `safeLimit = Math.min(100, ...)` 적용, ParseIntPipe 사용 |

### Warning (4건) — 모두 수정 완료

| # | 이슈 | 수정 내용 |
|---|------|-----------|
| 4 | create에서 issue 존재 미검증 | `verifyIssue()` 호출 추가 |
| 5 | Delete 확인 없음 | `window.confirm()` 추가 |
| 6 | @mention regex 과도한 매칭 | lookbehind/lookahead 활용한 regex로 교체 |
| 7 | User onDelete: Cascade | `onDelete: SetNull`, userId nullable로 변경 |

### Suggestion (3건) — 1건 수정, 2건 미수정

| # | 이슈 | 상태 |
|---|------|------|
| 8 | timeAgo 함수 중복 | 수정: `@/lib/time.ts`로 추출 |
| 9 | Activity 탭 카운트에 댓글 수 미포함 | 미수정 (minor) |
| 10 | 반복적 type assertion | 미수정 (minor) |

## 최종 판정: PASS — 모든 Critical/Warning 수정 완료
