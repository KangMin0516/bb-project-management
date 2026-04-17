# 기획서: Sub-task 자동 할당

## 요구사항 요약

Thu님 피드백 기반:
- **부모 이슈의 assignee가 변경되면**, 할당되지 않은(assigneeId=null) 자식 이슈들에게 자동으로 같은 assignee를 설정
- 이미 할당된 자식 이슈는 변경하지 않음 (개별 할당 우선)
- 매니저가 EPIC/TASK에 담당자를 지정하면 미할당 SUB_TASK들이 자동으로 따라감

## 영향 범위

### 서비스
- **Backend** (packages/api): issue.service.ts의 update 로직 확장

### 데이터 모델 변경
- **없음** — 기존 parent/children 관계와 assigneeId 필드만 활용

### 수정 파일
- `packages/api/src/issue/issue.service.ts` — update 메서드에서 assigneeId 변경 시 미할당 자식 자동 할당 + activity 기록

### 신규 파일
- 없음

## 구현 방안

### issue.service.ts update 메서드 확장

assigneeId가 변경된 경우, 기존 notification 생성 로직 이후에:

1. 현재 이슈의 children 중 `assigneeId = null`인 이슈 조회
2. 해당 이슈들의 assigneeId를 새 assigneeId로 일괄 업데이트
3. 각 자식 이슈에 대해 activity 기록 (`field: 'assigneeId'`, oldValue: null, newValue: 새 assignee)
4. 각 자식 이슈의 새 assignee에게 notification 생성

```typescript
// assigneeId 변경 시 미할당 자식 자동 할당
if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
  const unassignedChildren = await this.prisma.issue.findMany({
    where: { parentId: issueId, assigneeId: null },
    select: { id: true },
  });

  if (unassignedChildren.length > 0 && data.assigneeId) {
    await this.prisma.issue.updateMany({
      where: { id: { in: unassignedChildren.map(c => c.id) } },
      data: { assigneeId: data.assigneeId },
    });

    // Activity + Notification for each child
    await this.prisma.activity.createMany({
      data: unassignedChildren.map(c => ({
        issueId: c.id,
        userId,
        field: 'assigneeId',
        oldValue: null,
        newValue: data.assigneeId,
      })),
    });
  }
}
```

### 동작 규칙

| 시나리오 | 동작 |
|----------|------|
| 부모 assignee 변경 → 미할당 자식 존재 | 자식들 자동 할당 |
| 부모 assignee 변경 → 이미 할당된 자식 | 변경 없음 (개별 할당 우선) |
| 부모 assignee를 null로 해제 | 자식들 변경 없음 (할당 해제는 전파하지 않음) |
| 부모 assignee 변경 → 자식 없음 | 추가 동작 없음 |

## API 변경사항

- 기존 `PATCH /projects/:projectId/issues/:issueId` 동작 확장
- 요청/응답 스키마 변경 없음
- 자동 할당된 자식 수를 응답에 포함하지 않음 (내부 동작)

## 리스크 및 고려사항

1. **성능**: 자식 이슈가 매우 많은 경우 → `updateMany` + `createMany`로 bulk 처리하므로 문제 없음
2. **동시성**: 부모 할당 + 자식 업데이트가 트랜잭션 내에 있지 않음 → 현재 update 메서드 전체가 단일 요청이므로 실용적 문제 없음
3. **재귀적 전파**: 손자 이슈까지 전파할지 → 직접 자식만 (1단계) 전파. 현재 계층 구조가 2단계(parent → child)까지만 허용되므로 충분

## 예상 작업량

- 파일 수: 1개 (issue.service.ts)
- 복잡도: **낮음** — 기존 update 로직에 조건부 블록 추가
