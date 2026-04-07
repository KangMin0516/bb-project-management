## 배포 보고

### 요약
- **배포 방식**: CI/CD (GitHub Actions)
- **브랜치**: feat/auth-session-and-user-approval → main
- **PR**: #2 (https://github.com/seo-burning/bb-project-management/pull/2)
- **CI 상태**: 전체 통과 (1m18s)

### 파이프라인 결과
| 단계 | 상태 | 소요 시간 |
|------|------|-----------|
| Deploy to Production | Pass | 1m18s |

### 배포 내용
- Sliding session auth (Access Token 1h + Refresh Token 72h)
- User registration approval (PENDING → ACTIVE/REJECTED)
- JWT_EXPIRES_IN 8h → 1h
- DB migration: UserStatus enum + refresh_token column

### 롤백 계획
- `git revert dacf3a6` → 새 PR → 머지로 롤백
