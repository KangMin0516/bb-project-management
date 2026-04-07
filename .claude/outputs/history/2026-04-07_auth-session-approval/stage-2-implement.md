## 구현 보고서: 로그인 유지 + 가입 승인 기능

### 구현 완료 항목

#### Phase 1: DB 스키마 변경
- `packages/api/prisma/schema.prisma` — UserStatus enum 추가, User 모델에 status/refreshToken 필드 추가
- `packages/api/prisma/migrations/20260407030000_add_user_status_and_refresh_token/migration.sql` — 마이그레이션 SQL (기존 유저 ACTIVE, 신규 PENDING)

#### Phase 2: Backend — 로그인 유지
- `packages/api/src/auth/auth.service.ts` — 완전 재작성
  - `register()`: PENDING 상태로 생성, 토큰 미발급, 안내 메시지 반환
  - `login()`: 상태 체크 (PENDING/REJECTED 에러), Access + Refresh 토큰 쌍 발급
  - `refresh()`: Refresh Token 검증 → 새 토큰 쌍 발급 (rotation)
  - `buildTokenResponse()`: UUID refresh token 생성, bcrypt 해시 DB 저장
- `packages/api/src/auth/auth.controller.ts` — `POST /auth/refresh` 엔드포인트 추가
- `packages/api/src/auth/dto/refresh.dto.ts` — RefreshDto 신규 생성
- `packages/api/src/auth/auth.module.ts` — JWT 만료시간 8h → 1h

#### Phase 3: Backend — 가입 승인
- `packages/api/src/user/user.service.ts` — `findPending()`, `approve()`, `reject()` 메서드 추가
- `packages/api/src/user/user.controller.ts` — `GET /users/pending`, `PATCH /:id/approve`, `PATCH /:id/reject` 엔드포인트 추가
- `packages/api/src/common/guards/superuser.guard.ts` — SuperuserGuard 신규 생성
- `packages/api/src/common/guards/index.ts` — SuperuserGuard 내보내기 추가

#### Phase 4: Frontend — 로그인 유지
- `packages/web/src/api/auth.ts` — AuthResponse에 refreshToken 추가, RegisterResponse 분리, `authApi.refresh()` 추가
- `packages/web/src/api/client.ts` — 401 인터셉터 완전 재작성
  - Refresh token으로 자동 재시도
  - 동시 요청 큐잉 (race condition 방지)
  - Refresh 실패 시 로그아웃
- `packages/web/src/stores/auth.ts` — refreshToken localStorage 저장/삭제, register 반환 타입 변경

#### Phase 5: Frontend — 가입 승인
- `packages/web/src/pages/RegisterPage.tsx` — 가입 성공 시 승인 대기 안내 메시지 + 로그인 링크
- `packages/web/src/pages/SettingsPage.tsx` — 사용자 승인 섹션 추가 (superuser만 표시)
  - 대기 중 유저 목록 (이름, 이메일, 가입일)
  - 승인/거절 버튼, 실시간 목록 갱신
- `packages/web/src/api/users.ts` — `listPending()`, `approve()`, `reject()` API 함수 추가

### 자체 점검 결과
- TypeScript 컴파일: web 패키지 에러 없음, api 패키지 에러 없음 (기존 test/ 파일 에러만 존재)
- 임포트 경로: 모두 .js 확장자 사용 (ESM 호환)
- 패턴 일관성: 기존 코드 스타일(guards, services, controllers) 준수
- 보안: Refresh token DB 해시 저장, rotation 적용, superuser guard로 승인 API 보호

### 변경된 파일 목록 (15개)
| 파일 | 상태 |
|------|------|
| `packages/api/prisma/schema.prisma` | 수정 |
| `packages/api/prisma/migrations/20260407030000_.../migration.sql` | 신규 |
| `packages/api/src/auth/auth.service.ts` | 수정 |
| `packages/api/src/auth/auth.controller.ts` | 수정 |
| `packages/api/src/auth/auth.module.ts` | 수정 |
| `packages/api/src/auth/dto/refresh.dto.ts` | 신규 |
| `packages/api/src/user/user.service.ts` | 수정 |
| `packages/api/src/user/user.controller.ts` | 수정 |
| `packages/api/src/common/guards/superuser.guard.ts` | 신규 |
| `packages/api/src/common/guards/index.ts` | 수정 |
| `packages/web/src/api/auth.ts` | 수정 |
| `packages/web/src/api/client.ts` | 수정 |
| `packages/web/src/api/users.ts` | 수정 |
| `packages/web/src/stores/auth.ts` | 수정 |
| `packages/web/src/pages/RegisterPage.tsx` | 수정 |
| `packages/web/src/pages/SettingsPage.tsx` | 수정 |
