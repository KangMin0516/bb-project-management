## 기획서: 어드민 유저 관리 + 내 정보 수정 페이지

### 요구사항 요약

**A. 어드민 유저 관리 (/admin)**
1. **전체 유저 목록 조회**: 상태별(ACTIVE/PENDING/REJECTED) 필터링 + 검색
2. **유저 비활성화/정지**: ACTIVE → REJECTED 상태 변경 (기존 REJECTED 재활용)
3. **유저 정보 수정**: 이름, 이메일, 슈퍼유저 권한 변경 + 비밀번호 초기화
4. **유저 삭제**: Soft delete (UserStatus에 DELETED 추가, 실제 DB 삭제 없음)
5. **기존 승인/거절 기능 통합**: SettingsPage의 User Approval 섹션을 Admin 페이지로 이전
6. **네비게이션**: 사이드바 글로벌 내비에 Admin 링크 추가 (슈퍼유저만 표시)

**B. 내 정보 수정 (/profile)**
7. **프로필 수정**: 이름 변경, 아바타 변경
8. **비밀번호 변경**: 기존 SettingsPage의 Change Password 섹션 이전
9. **네비게이션**: 사이드바 하단 유저 영역 클릭 시 /profile로 이동

### 영향 범위
- **서비스**: Backend (API), Frontend (Web)
- **수정 파일**:
  - `packages/api/prisma/schema.prisma` — UserStatus enum에 DELETED 추가
  - `packages/api/src/user/user.controller.ts` — 어드민 전용 엔드포인트 추가
  - `packages/api/src/user/user.service.ts` — 어드민 CRUD 로직 추가
  - `packages/api/src/common/constants.ts` — ADMIN_USER_SELECT 상수 추가
  - `packages/web/src/api/users.ts` — 어드민 API 클라이언트 함수 추가
  - `packages/web/src/App.tsx` — /admin 라우트 추가
  - `packages/web/src/components/layout/AppLayout.tsx` — 사이드바 Admin 링크 추가
  - `packages/web/src/pages/SettingsPage.tsx` — User Approval 섹션 + Change Password 섹션 제거
  - `packages/web/src/stores/auth.ts` — 프로필 업데이트 액션 추가
- **신규 파일**:
  - `packages/web/src/pages/AdminPage.tsx` — 어드민 유저 관리 페이지
  - `packages/web/src/pages/ProfilePage.tsx` — 내 정보 수정 페이지
  - `packages/api/src/user/dto/admin-user.dto.ts` — 어드민 유저 수정/삭제 DTO

### 구현 방안

#### 1단계: DB 스키마 변경
- `UserStatus` enum에 `DELETED` 추가
- Prisma migration 생성 및 적용
- 기존 `findAll` 쿼리에서 DELETED 유저 제외되도록 수정

#### 2단계: Backend API 추가
새로운 어드민 전용 엔드포인트 (모두 `@UseGuards(SuperuserGuard)`):

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/users/admin/all` | 전체 유저 목록 (상태별 필터, 검색, DELETED 제외) |
| PATCH | `/users/:id/admin/update` | 유저 정보 수정 (name, email, isSuperuser) |
| PATCH | `/users/:id/admin/reset-password` | 비밀번호 초기화 |
| PATCH | `/users/:id/admin/suspend` | 유저 비활성화 (ACTIVE → REJECTED) |
| PATCH | `/users/:id/admin/activate` | 유저 활성화 (REJECTED → ACTIVE) |
| DELETE | `/users/:id/admin` | Soft delete (status → DELETED) |

#### 3단계: Frontend 라우트 및 네비게이션
- `App.tsx`에 `/admin` 라우트 추가 (AuthGuard 내부)
- `AppLayout.tsx`의 `globalNavItems`에 Admin 항목 추가 (슈퍼유저 조건부)
- 아이콘: `Users` (lucide-react)

#### 4단계: AdminPage 구현
- **유저 테이블**: 이름, 이메일, 상태 배지, 슈퍼유저 배지, 가입일
- **상태 필터 탭**: All / Active / Pending / Rejected
- **검색바**: 이름/이메일 검색
- **행 액션**: 수정(모달), 비활성화/활성화 토글, 비밀번호 초기화, 삭제
- **Pending 유저**: 기존 승인/거절 버튼 통합
- UI 스타일: 기존 SettingsPage의 카드 스타일과 동일한 톤

#### 5단계: ProfilePage 구현
- `/profile` 라우트에 내 정보 수정 페이지 추가
- **프로필 섹션**: 이름 수정, 아바타 업로드 (기존 authApi.updateProfile + uploadAvatar 활용)
- **비밀번호 변경 섹션**: SettingsPage에서 이전 (기존 authApi.changePassword 활용)
- 사이드바 하단 유저 이름 클릭 시 /profile로 이동

#### 6단계: SettingsPage 정리
- User Approval 섹션 + Change Password 섹션 및 관련 쿼리/뮤테이션 제거

### API 변경사항

#### 신규 엔드포인트
```
GET    /users/admin/all?status=ACTIVE&search=keyword
PATCH  /users/:id/admin/update         { name?, email?, isSuperuser? }
PATCH  /users/:id/admin/reset-password  { newPassword }
PATCH  /users/:id/admin/suspend
PATCH  /users/:id/admin/activate
DELETE /users/:id/admin
```

#### 기존 엔드포인트 영향
- `GET /users` — DELETED 상태 유저 제외 필터 추가 (기존 ACTIVE 필터로 이미 제외됨)
- `POST /auth/login` — DELETED 상태 유저 로그인 차단 확인 필요

### 리스크 및 고려사항
- **자기 자신 삭제/비활성화 방지**: 현재 로그인한 슈퍼유저가 자기 자신을 삭제하거나 비활성화하지 못하도록 검증 필요
- **마지막 슈퍼유저 보호**: 유일한 슈퍼유저의 권한 해제 또는 비활성화 방지
- **이메일 중복 검증**: 유저 이메일 수정 시 기존 이메일과 중복되지 않도록 검증
- **DELETED 유저 로그인 차단**: auth.service.ts의 login에서 DELETED 상태 체크 필요

### 예상 작업량
- 파일 수: 수정 9개 + 신규 3개 = 12개
- 복잡도: 보통
- Migration: 1개 (UserStatus enum에 DELETED 추가)
