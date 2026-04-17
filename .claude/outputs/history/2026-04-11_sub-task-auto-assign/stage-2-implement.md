# Stage 2: 구현 보고서 — Sub-task 자동 할당

## 구현 요약

부모 이슈의 assignee 변경 시, 미할당(assigneeId=null) 자식 이슈들에게 자동으로 같은 assignee를 설정하는 기능을 구현했습니다.

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `packages/api/src/issue/issue.service.ts` | update 메서드에 자식 자동 할당 로직 추가 |

## 핵심 구현 사항

### issue.service.ts update 메서드 확장

기존 assignee 변경 → notification 생성 로직 이후에:

1. `parentId = issueId AND assigneeId = null`인 자식 이슈 조회
2. `updateMany`로 일괄 assigneeId 설정
3. `activity.createMany`로 각 자식에 변경 이력 기록
4. 각 자식의 새 assignee에게 `notifyAssignment` 호출

### 동작 규칙

| 시나리오 | 동작 |
|----------|------|
| 부모 assignee 설정 → 미할당 자식 존재 | 자식들 자동 할당 |
| 부모 assignee 변경 → 이미 할당된 자식 | 변경 없음 |
| 부모 assignee를 null로 해제 | 자식들 변경 없음 |
| 부모 assignee 변경 → 자식 없음 | 추가 동작 없음 |

## 검증 결과

- TypeScript (API): 통과 (pre-existing e2e 에러만)
- ESLint (변경 파일): 통과 (pre-existing no-base-to-string만)

## 신규 파일
- 없음
