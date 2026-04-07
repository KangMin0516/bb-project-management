# Stage 4: QA Engineer 보고서
- **작성 일시**: 2026-04-07
- **대상 서비스**: packages/api (auth, user), packages/web (auth, register, settings)
- **이전 스테이지**: stage-2-implement.md, stage-3-review.md
- **테스트 환경**: 로컬 (localhost:3002)

## 테스트 케이스

| ID | Section | Scenario | Type | Expected |
|----|---------|----------|------|----------|
| TC-001 | Auth/Login | Login with valid credentials returns tokens | Happy | 201 + accessToken, refreshToken, user |
| TC-002 | Auth/Login | Login response structure validation | Happy | Response has accessToken, refreshToken, user fields |
| TC-003 | Auth/Login | Login with wrong password | Error | 401 Unauthorized |
| TC-004 | Auth/Login | Login with non-existent email | Error | 401 Unauthorized |
| TC-005 | Auth/Refresh | Refresh with valid token returns new pair | Happy | 201 + new accessToken, refreshToken |
| TC-006 | Auth/Refresh | Old refresh token invalid after rotation | Edge | 401 (token rotation enforced) |
| TC-007 | Auth/Refresh | Refresh with invalid token format (no colon) | Error | 401 Unauthorized |
| TC-008 | Auth/Refresh | Refresh with empty refreshToken | Validation | 400 Bad Request |
| TC-009 | Auth/Profile | GET /auth/me with valid token | Happy | 200 + user profile |
| TC-010 | Auth/Profile | GET /auth/me without token | Auth | 401 Unauthorized |
| TC-011 | Auth/Register | Register new user returns pending message | Happy | 201 + message |
| TC-012 | Auth/Register | Login as PENDING user | Edge | 403 Forbidden |
| TC-013 | Auth/Register | Register with duplicate email | Validation | 409 Conflict |
| TC-014 | User/Pending | List pending users (superuser) | Happy | 200 + array |
| TC-015 | User/Approve | Approve pending user | Happy | 200 + status=ACTIVE |
| TC-016 | User/Approve | Login as newly approved user | Happy | 201 + tokens |
| TC-017 | User/Reject | Reject pending user | Happy | 200 + status=REJECTED |
| TC-018 | User/Reject | Login as rejected user | Edge | 403 Forbidden |
| TC-019 | User/Approve | Approve already-active user | Edge | 400 Bad Request |
| TC-020 | User/List | GET /users excludes non-ACTIVE users | Happy | 200 + rejected user not in list |
| TC-021 | User/Auth | Non-superuser cannot list pending users | Auth | 403 Forbidden |
| TC-022 | User/Auth | Non-superuser cannot approve users | Auth | 403 Forbidden |
| TC-023 | Auth/Refresh | Refresh token format is userId:uuid | Validation | colon-separated, two non-empty parts |
| TC-024 | Auth/JWT | Access token expiry configuration | Info | exp-iat check |
| TC-025 | User/Reject | Reject non-existent user | Error | 404 Not Found |

## API 테스트 결과

| ID | Result | HTTP | Note |
|----|--------|------|------|
| TC-001 | PASS | 201 | |
| TC-002 | PASS | 201 | |
| TC-003 | PASS | 401 | |
| TC-004 | PASS | 401 | |
| TC-005 | PASS | 201 | |
| TC-006 | PASS | 401 | Token rotation 정상 동작 |
| TC-007 | PASS | 401 | |
| TC-008 | PASS | 400 | @IsNotEmpty 검증 정상 |
| TC-009 | PASS | 200 | |
| TC-010 | PASS | 401 | |
| TC-011 | PASS | 201 | |
| TC-012 | PASS | 403 | PENDING 상태 차단 정상 |
| TC-013 | PASS | 409 | |
| TC-014 | PASS | 200 | |
| TC-015 | PASS | 200 | status=ACTIVE 확인 |
| TC-016 | PASS | 201 | |
| TC-017 | PASS | 200 | status=REJECTED 확인 |
| TC-018 | PASS | 403 | REJECTED 상태 차단 정상 |
| TC-019 | PASS | 400 | 이미 ACTIVE인 유저 재승인 방지 |
| TC-020 | PASS | 200 | rejected 유저 목록 미포함 확인 |
| TC-021 | PASS | 403 | SuperuserGuard 정상 동작 |
| TC-022 | PASS | 403 | SuperuserGuard 정상 동작 |
| TC-023 | PASS | 201 | userId:uuid 형식 확인 |
| TC-024 | PASS | 201 | exp-iat=28800s (.env에서 8h 설정) |
| TC-025 | PASS | 404 | |

**API Total: 25 | PASS: 25 | FAIL: 0**

## E2E 테스트 결과

**E2E 미수행** - Chrome extension이 연결되지 않아 E2E 브라우저 테스트를 수행할 수 없었습니다.

> Chrome extension 연결 후 E2E 테스트를 재실행해야 합니다.

**E2E Total: 0 | PASS: 0 | FAIL: 0 | SKIP: ALL**

## 콘솔 에러

- 에러 수: 확인 불가 (E2E 미수행)

## 참고 사항 (Info)

1. **JWT 만료 시간**: auth.module.ts의 기본값은 `1h`이나, `.env`에서 `JWT_EXPIRES_IN="8h"`로 오버라이드됨. 구현 보고서에서 "8h -> 1h"로 변경했다고 기술되어 있으나, 실제 환경변수가 8h로 남아 있음. 의도된 설정인지 확인 필요.
   - 심각도: Minor
   - 관련 파일: `.env` (JWT_EXPIRES_IN), `packages/api/src/auth/auth.module.ts:21`

2. **Login/Refresh HTTP 상태 코드**: NestJS의 기본 POST 동작으로 201을 반환. 일반적으로 login은 200이 관례이나, 동작에는 문제 없음.
   - 심각도: Minor (Info)

## 종합 판정

- **API 테스트**: PASS (25/25)
- **E2E 테스트**: 미수행 (Chrome extension 미연결)
- **전체 판정**: **CONDITIONAL PASS** - API 기능은 모두 정상 동작하나, E2E 테스트 미수행으로 최종 PASS 처리 불가. Chrome extension 연결 후 E2E 재실행 필요.
