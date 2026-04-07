## 기획서: 로그인 유지 + 가입 승인 기능

### 요구사항 요약

**기능 1 — 로그인 유지 (Sliding Session)**
- Access Token (1h) + Refresh Token (72h) 이중 토큰 체계
- API 호출 시 Access Token 만료되면 Refresh Token으로 자동 갱신
- Refresh Token 사용 시마다 72h 슬라이딩 연장
- 72시간 무활동 시 (주말 등) 자동 만료 → 재로그인
- 별도 로그아웃 버튼 불필요 (유지해도 됨)

**기능 2 — 가입 승인 (Admin Approval)**
- 회원가입 → PENDING 상태로 생성 (로그인 불가)
- isSuperuser 권한 가진 관리자만 승인/거절 가능
- PENDING 유저 로그인 시도 → "관리자 승인 대기 중" 에러 메시지
- 관리자 UI: 기존 Settings 페이지에 "사용자 승인" 탭 추가

### 영향 범위

- **서비스**: Backend (API), Frontend (Web), Database (Prisma)
- **수정 파일**:
  - `packages/api/prisma/schema.prisma` — User 모델에 status, refreshToken 필드 추가
  - `packages/api/src/auth/auth.service.ts` — refresh token 로직, 가입 시 PENDING, 로그인 시 상태 체크
  - `packages/api/src/auth/auth.controller.ts` — refresh endpoint 추가
  - `packages/api/src/auth/dto/login.dto.ts` — (변경 없음)
  - `packages/api/src/auth/strategies/jwt.strategy.ts` — (변경 없음)
  - `packages/api/src/user/user.service.ts` — 승인/거절/대기목록 메서드 추가
  - `packages/api/src/user/user.controller.ts` — 승인/거절 endpoint 추가
  - `packages/web/src/api/client.ts` — 401 시 refresh 자동 시도 인터셉터
  - `packages/web/src/api/auth.ts` — refresh API 함수 추가
  - `packages/web/src/stores/auth.ts` — refresh token 저장/관리
  - `packages/web/src/pages/RegisterPage.tsx` — 가입 후 "승인 대기" 안내
  - `packages/web/src/pages/LoginPage.tsx` — PENDING 에러 메시지 처리
  - `packages/web/src/pages/SettingsPage.tsx` — 사용자 승인 탭 추가
- **신규 파일**:
  - `packages/api/prisma/migrations/XXXXXX_add_user_status_and_refresh_token/` — DB 마이그레이션
  - `packages/api/src/auth/dto/refresh.dto.ts` — refresh token DTO
  - `packages/web/src/api/users.ts` — 승인/거절 API 함수 (기존 파일 확장)

### 구현 방안

#### Phase 1: DB 스키마 변경

User 모델에 필드 추가:
```
status        UserStatus  @default(PENDING)  // PENDING, ACTIVE, REJECTED
refreshToken  String?     @map("refresh_token")
```

enum UserStatus:
```
PENDING   — 가입 후 승인 대기
ACTIVE    — 승인 완료, 로그인 가능
REJECTED  — 거절됨
```

기존 유저(admin 포함)는 마이그레이션 시 ACTIVE로 설정.

#### Phase 2: 로그인 유지 (Backend)

1. **로그인 응답 변경**: `{ accessToken, refreshToken, user }` 반환
2. **Access Token**: JWT, 1시간 만료, payload `{sub, email}`
3. **Refresh Token**: crypto.randomUUID(), 72시간 만료, DB에 해시 저장
4. **`POST /auth/refresh`**: refreshToken 수신 → DB 검증 → 새 accessToken + 새 refreshToken 발급 (rotation) → 72h 슬라이딩 갱신
5. **보안**: Refresh Token은 사용 시 rotation (기존 것 폐기, 새 것 발급)

#### Phase 3: 가입 승인 (Backend)

1. **register()** 수정: 유저 생성 시 `status: PENDING`, accessToken 발급하지 않음
2. **login()** 수정: `status !== ACTIVE`이면 에러 메시지 반환
   - PENDING → "관리자 승인 대기 중입니다"
   - REJECTED → "가입이 거절되었습니다"
3. **신규 endpoint**:
   - `GET /users/pending` — isSuperuser만, 대기 중 유저 목록
   - `PATCH /users/:id/approve` — isSuperuser만, 상태를 ACTIVE로 변경
   - `PATCH /users/:id/reject` — isSuperuser만, 상태를 REJECTED로 변경

#### Phase 4: 프론트엔드 — 로그인 유지

1. **auth store**: refreshToken을 localStorage에 별도 저장
2. **API 인터셉터 수정**:
   - 401 응답 수신 → refresh API 호출 → 새 토큰으로 원래 요청 재시도
   - refresh도 실패하면 로그아웃
   - 동시 다중 요청 시 refresh 중복 방지 (큐잉)
3. **로그인 응답 처리**: accessToken + refreshToken 모두 저장

#### Phase 5: 프론트엔드 — 가입 승인

1. **RegisterPage**: 가입 성공 시 "가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다." 안내 → 로그인 페이지로 이동
2. **LoginPage**: PENDING/REJECTED 에러 메시지 구분 표시
3. **SettingsPage**: "사용자 승인" 탭 추가 (isSuperuser만 노출)
   - 대기 중 유저 리스트 (이름, 이메일, 가입일)
   - 승인/거절 버튼
   - 승인 시 즉시 목록에서 제거

### API 변경사항

| Method | Endpoint | Auth | 설명 |
|--------|----------|------|------|
| POST | `/auth/register` | Public | 변경: accessToken 미반환, status=PENDING |
| POST | `/auth/login` | Public | 변경: status 체크 추가, refreshToken 반환 |
| POST | `/auth/refresh` | Public | 신규: refreshToken으로 토큰 갱신 |
| GET | `/users/pending` | Superuser | 신규: 승인 대기 유저 목록 |
| PATCH | `/users/:id/approve` | Superuser | 신규: 유저 승인 |
| PATCH | `/users/:id/reject` | Superuser | 신규: 유저 거절 |

### 리스크 및 고려사항

1. **기존 admin 계정**: 마이그레이션 시 기존 유저 전부 `ACTIVE`로 설정 → 영향 없음
2. **register 응답 변경**: 기존에는 가입 즉시 accessToken 반환 → 더 이상 반환하지 않음 → 프론트엔드 register 로직 수정 필요
3. **Refresh Token 보안**: DB에 해시 저장, rotation 적용으로 탈취 시 위험 최소화
4. **동시 refresh 요청**: 프론트엔드에서 refresh 큐잉으로 race condition 방지
5. **Settings 탭**: 프로젝트별 Settings가 아닌 글로벌 기능이므로, 프로젝트 컨텍스트 외부에 배치 고려 필요 → 우선 Settings에 배치, 필요 시 분리

### 예상 작업량

- 파일 수: 약 13개 (수정 11 + 신규 2)
- 복잡도: **보통**
- 핵심 난이도: API 인터셉터의 refresh 큐잉 로직
