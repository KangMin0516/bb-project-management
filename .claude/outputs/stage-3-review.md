## Stage 3: 코드리뷰 종합 결과 — 글로벌 검색 + 알림 시스템

### 전체 요약
- **Critical**: 1건 → **수정 완료**
- **Warning**: 6건 → **5건 수정, 1건 보류 (FK relation)**
- **Info**: 2건
- **결론**: Critical 수정 완료, 주요 Warning 해결됨

---

### 수정 완료 항목

| 이슈 | 등급 | 수정 내용 |
|------|------|-----------|
| 알림 생성 await 누락 | Critical | `.catch(() => {})` fire-and-forget 패턴 적용 (3곳) |
| markAsRead 404 미반환 | Warning | `count === 0`일 때 `NotFoundException` throw |
| NotificationType 느슨한 타입 | Warning | union type `'ASSIGNED' | 'COMMENTED' | 'MENTIONED'` 적용 |
| 검색 2단계 쿼리 | Warning | `project.members.some` 서브쿼리로 단일 쿼리 최적화 |
| 검색/알림 보드로만 이동 | Warning | Issues 페이지 + `selectedIssueId` state로 이슈 상세 직접 오픈 |
| @멘션 정규식 느슨 | Warning | `/@([\w.]+)/g`로 개선 |

### 보류 항목

| 이슈 | 등급 | 사유 |
|------|------|------|
| Notification FK relation 누락 | Warning | 추가 마이그레이션 필요, 향후 개선으로 보류 |

### 긍정적 사항
- NestJS 모듈 패턴 일관성 우수
- 알림 자기 자신 제외 로직 적절
- 커맨드 팔레트 UX 완성도 높음 (디바운스, 키보드 탐색)
- Notification 인덱스 최적화 적절
- 폴링 30초 간격 합리적
