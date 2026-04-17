# Stage 5: 배포 보고 — Sub-task 자동 할당

## 요약
- **배포 방식**: CI/CD (GitHub Actions → SSH → Docker Compose)
- **브랜치**: feat/sub-task-auto-assign → main
- **PR**: #14 (https://github.com/seo-burning/bb-project-management/pull/14)
- **CI 상태**: 성공 (run #24118659688)

## 변경 파일 (1개)
- `packages/api/src/issue/issue.service.ts` — autoAssignUnassignedChildren 메서드 추가

## 롤백 계획
- `git revert a91a569` → 새 PR → 머지로 롤백
