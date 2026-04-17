# 기획서: Thu's 3 Bug/Feature Requests

## 요구사항 요약

Thu가 보고한 3건의 버그/기능 요청:
1. **Subtask 상태 상속**: Subtask 생성 시 부모 Task의 현재 status를 기본값으로 설정
2. **타이틀 인라인 편집**: IssueDetailPanel에서 제목 클릭 시 인라인 편집 가능
3. **아바타 업로드**: 프로필 아바타 이미지 업로드 + 전체 앱에서 아바타 표시

---

## Feature 1: Subtask 상태 상속

### 현재 동작
- `IssueDetailPanel.tsx:515` — subtask 생성 시 `{ title, type: 'SUB_TASK', parentId }` 만 전송
- 백엔드 `issue.service.ts:216` — `status: data.status ?? 'BACKLOG'` → 항상 BACKLOG

### 구현 방안
- `IssueDetailPanel.tsx:515, 521` 두 곳에서 `status: d.status`를 payload에 추가

### 수정 파일
- `packages/web/src/components/issue/IssueDetailPanel.tsx` — `createSubtaskMutation` 호출 시 status 추가

### 예상 작업량
- 파일 수: 1개
- 복잡도: **낮음**

---

## Feature 2: 타이틀 인라인 편집

### 현재 동작
- `IssueDetailPanel.tsx:231` — `<h2>{d.title}</h2>` 읽기 전용
- `UpdateIssuePayload`에 `title?: string` 이미 존재
- 백엔드 `update()` 메서드에서 title 업데이트 지원 + activity 로깅 처리 완료

### 구현 방안
1. `editingTitle` + `draftTitle` 상태 추가
2. `<h2>` 클릭 시 `<input>` 으로 전환 (인라인 편집)
3. Enter 또는 blur 시 `updateMutation.mutate({ title })` 호출
4. Escape 시 취소
5. 빈 title 방지 (trim 후 빈 문자열이면 저장하지 않음)

### 수정 파일
- `packages/web/src/components/issue/IssueDetailPanel.tsx` — 상태 추가 + title 영역 수정

### 예상 작업량
- 파일 수: 1개
- 복잡도: **낮음**

---

## Feature 3: 아바타 업로드

### 현재 동작
- DB: `User.avatar: String?` 필드 존재
- API: `GET /auth/me` → avatar 반환, `USER_SELECT` 상수에서 `avatar: true`
- 프론트엔드: `UserProfile.avatar: string | null` 인터페이스 존재
- UI: 모든 곳에서 이니셜(첫 글자)만 표시, 실제 avatar 이미지 미사용
- 업로드/수정 엔드포인트 없음

### 구현 방안

#### Backend (API)

**1. 프로필 업데이트 엔드포인트 추가**
- `PATCH /auth/profile` — name, avatar 업데이트
- `UpdateProfileDto`: `{ name?: string, avatar?: string }`
- `AuthService.updateProfile(userId, dto)` 메서드 추가

**2. 아바타 업로드 엔드포인트 추가**
- `POST /upload?avatar=true` — 기존 upload 엔드포인트에 avatar 옵션 추가
- S3 경로: `avatars/${userId}${ext}` (사용자당 1개, 덮어쓰기)
- 응답에 URL 반환 → 프론트에서 `PATCH /auth/profile { avatar: url }` 호출

#### Frontend (Web)

**3. authApi 확장**
- `authApi.updateProfile(data)` 추가 — `PATCH /auth/profile`

**4. 사이드바 프로필 영역에 아바타 업로드 UI**
- `AppLayout.tsx` 사이드바 하단 프로필 영역
- 아바타 영역 클릭 시 파일 선택 → 업로드 → 프로필 업데이트 → auth store 갱신
- 아바타 존재 시 `<img>` 표시, 없으면 기존 이니셜 fallback

**5. 앱 전체 아바타 표시 적용**
- `FilterBar.tsx` `AssigneeAvatars` — avatar 이미지 우선, fallback 이니셜
- `IssueCard.tsx` — assignee avatar 표시
- `IssueDetailPanel.tsx` — assignee avatar 표시
- `SettingsPage.tsx` — 멤버 목록 avatar 표시

### 수정 파일

**신규:**
- `packages/api/src/auth/dto/update-profile.dto.ts` — DTO

**수정:**
- `packages/api/src/auth/auth.controller.ts` — `PATCH /auth/profile` 엔드포인트
- `packages/api/src/auth/auth.service.ts` — `updateProfile()` 메서드
- `packages/api/src/upload/upload.controller.ts` — avatar 업로드 옵션
- `packages/api/src/upload/upload.service.ts` — avatar 전용 S3 경로 처리
- `packages/web/src/api/auth.ts` — `updateProfile()` API 추가
- `packages/web/src/stores/auth.ts` — `updateProfile` action 추가
- `packages/web/src/components/layout/AppLayout.tsx` — 아바타 업로드 UI + 이미지 표시
- `packages/web/src/components/filter/FilterBar.tsx` — AssigneeAvatars에 이미지 표시
- `packages/web/src/components/board/IssueCard.tsx` — assignee avatar
- `packages/web/src/components/issue/IssueDetailPanel.tsx` — assignee avatar
- `packages/web/src/pages/SettingsPage.tsx` — 멤버 avatar

### API 변경사항
- `PATCH /auth/profile` — 프로필(name, avatar) 업데이트 (신규)
- `POST /upload?avatar=true` — 아바타 전용 업로드 (기존 확장)

### 예상 작업량
- 파일 수: 12개 (신규 1 + 수정 11)
- 복잡도: **중간~높음**

---

## 리스크 및 고려사항

| 리스크 | 대응 |
|--------|------|
| 아바타 파일 크기/형식 | 이미지만 허용 (jpeg, png, webp), 최대 5MB |
| S3 비용 | avatars/ 경로에 사용자당 1파일만 유지 (교체 시 기존 삭제) |
| 기존 데이터 호환 | avatar=null인 기존 사용자는 이니셜 fallback 유지 |
| 타이틀 빈 문자열 저장 | 프론트엔드에서 빈 title 저장 차단 |

---

## 전체 요약

| # | 기능 | 파일 수 | 복잡도 |
|---|------|---------|--------|
| 1 | Subtask 상태 상속 | 1 | 낮음 |
| 2 | 타이틀 인라인 편집 | 1 | 낮음 |
| 3 | 아바타 업로드 | 12 | 중간~높음 |
| **합계** | | **14** | |
