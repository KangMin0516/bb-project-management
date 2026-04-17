## 배포 보고

### 요약
- **배포 방식**: CI/CD (GitHub Actions)
- **브랜치**: feat/standup-bot → main
- **PR**: #30 (https://github.com/seo-burning/bb-project-management/pull/30)
- **커밋**: 5892be0
- **CI 상태**: 전체 통과

### 파이프라인 결과
| 단계 | 상태 | 소요 시간 |
|------|------|-----------|
| Deploy to Production | Pass | 1m 31s |

### 배포 후 필요 작업
1. GitHub Secrets에 `SLACK_SIGNING_SECRET` 추가
2. Slack App 설정:
   - Event Subscriptions URL: `https://{DOMAIN}/api/webhooks/slack/events`
   - Interactivity URL: `https://{DOMAIN}/api/webhooks/slack/interactions`
   - OAuth scopes: `im:write`, `im:history`, `users:read`
3. DB 마이그레이션 확인 (`20260416030130_add_standup_bot`)

### 롤백 계획
- `git revert` → 새 PR → 머지로 롤백
