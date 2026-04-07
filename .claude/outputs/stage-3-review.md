## 코드리뷰 종합 결과: 로그인 유지 + 가입 승인 기능

### 리뷰어
- Step 1: 기능 리뷰어 (code-reviewer)
- Step 2: CTO 리뷰 (cto)

### Critical (수정 완료)

| # | 이슈 | 조치 |
|---|------|------|
| 1 | refresh() 전체 유저 스캔 O(N) bcrypt | refresh token을 `userId:uuid` 형식으로 변경, O(1) 조회 + 단일 bcrypt compare |
| 2 | 미사용 변수 `hashedToken` | 제거 |

### Warning (수정 완료)

| # | 이슈 | 조치 |
|---|------|------|
| 3 | findAll()이 PENDING/REJECTED 유저 반환 | `status: 'ACTIVE'` 필터 추가 |
| 4 | approve/reject DRY 위반 | `changeStatus()` private 메서드로 통합 |
| 5 | 토큰 관리 로직 분산 | store에 `setTokens()` 액션 추가, client.ts에서 호출 |
| 6 | RefreshDto 검증 부족 | `@IsNotEmpty()` 추가 |

### Warning (미수정 — 의도적 보류)

| # | 이슈 | 사유 |
|---|------|------|
| 7 | Refresh token 만료 시간 없음 | rotation으로 이전 토큰 자동 무효화됨. 별도 만료 필드는 추후 필요 시 추가 |
| 8 | 로그아웃 시 서버측 무효화 없음 | 별도 로그아웃 불필요 요구사항. rotation으로 리스크 최소화 |
| 9 | 에러 메시지 한/영 혼재 | 한국어 메시지는 사용자 대면 메시지. 영어는 시스템 에러. 현재 규모에서 i18n 과도 |

### Info (참고)

| # | 이슈 | 상태 |
|---|------|------|
| 10 | 유저 거절 시 확인 다이얼로그 없음 | 추후 UX 개선 시 반영 |
| 11 | SettingsPage God Component 경향 | 추후 리팩토링 시 분리 |

### TypeScript 컴파일
- web: 에러 없음
- api: 에러 없음 (기존 test/ 파일 제외)

### 결론
- **Critical 0건** (모두 수정 완료)
- **Warning 3건** (의도적 보류)
- **승인**: `/4-test` 진행 가능
