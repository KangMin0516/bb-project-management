# 구현 플랜 — Burningbros PM System

> PRD: `docs/PRD.md` 참조
> 기술 스택: NestJS + Prisma 7 + React 19 + Vite + pnpm monorepo
> 목표: 3개월 내 프로덕션 배포

---

## Phase 1 — MVP (Week 1~4)

핵심 목표: 로그인 → 프로젝트 선택 → 칸반 보드에서 이슈 생성/이동이 되는 상태

---

### Step 1.1 — 모노레포 & 인프라 세팅 (Week 1 전반)

#### 1.1.1 pnpm workspace 초기화
```
project-management/
├── pnpm-workspace.yaml          # packages: ["packages/*"]
├── package.json                 # private: true, scripts (dev, build, lint)
├── .gitignore
├── .env.example
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.web
└── packages/
    ├── api/
    ├── web/
    └── shared/
```

- `pnpm-workspace.yaml` → BB_YT_AUTOMATION 것 복사 후 수정
- 루트 `package.json` → 워크스페이스 스크립트 (dev:api, dev:web, build 등)

#### 1.1.2 Docker Compose (개발 환경)

| 서비스 | 이미지 | 포트 |
|--------|--------|------|
| db | postgres:16-alpine | 5432 |
| api | node:22-alpine (dev: volume mount) | 3000 |
| web | node:22-alpine (dev: vite) | 5173 |

- BB_YT_AUTOMATION의 `docker-compose.yml` 참고하여 구성
- PostgreSQL volume: `pgdata`
- 환경변수: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`

#### 1.1.3 shared 패키지 초기화

`packages/shared/src/constants/index.ts`:
- `IssueStatus` enum: BACKLOG, TODO, IN_PROGRESS, REVIEW_QA, DONE, CANCELED, RECHECK
- `IssuePriority` enum: HIGH, MEDIUM, LOW
- `IssueType` enum: EPIC, TASK, BUG, SUB_TASK
- `ProjectRole` enum: ADMIN, PM, DEVELOPER
- `STATUS_LABELS`, `PRIORITY_LABELS` 등 display용 맵

`packages/shared/src/types/index.ts`:
- `User`, `Project`, `Issue`, `Label`, `ProjectMember`, `Activity` 인터페이스
- API Response 래퍼 타입 (`ApiResponse<T>`, `PaginatedResponse<T>`)

---

### Step 1.2 — NestJS 백엔드 초기화 (Week 1 후반)

#### 1.2.1 NestJS 프로젝트 ����

```bash
cd packages/api
nest new . --skip-git --package-manager pnpm
```

주요 의존성:
```
# 핵심
@nestjs/core @nestjs/common @nestjs/platform-express
@nestjs/config @nestjs/swagger

# 인증
@nestjs/passport @nestjs/jwt passport passport-jwt bcryptjs

# DB
prisma @prisma/client

# WebSocket (Phase 2)
@nestjs/websockets @nestjs/platform-socket.io socket.io

# 검증
class-validator class-transformer zod
```

#### 1.2.2 Prisma 스키마 작성

`packages/api/prisma/schema.prisma` — PRD Section 6 기반��로 전체 스키마 작성

순서:
1. datasource + generator 설정
2. User 모델
3. Project 모델
4. ProjectMember 모델 (User ↔ Project 다대다 + role)
5. Issue 모델 (self-relation: parent/children)
6. Label 모델
7. IssueLabel 모델 (Issue ↔ Label 다대다)
8. Activity 모델
9. ApiKey 모델

마이그레이션: `npx prisma migrate dev --name init`

#### 1.2.3 PrismaModule (Global)

`src/prisma/prisma.service.ts`:
- `onModuleInit` → `$connect()`
- `onModuleDestroy` → `$disconnect()`
- `enableShutdownHooks()`

`src/prisma/prisma.module.ts`:
- `@Global()` + `@Module({ providers: [PrismaService], exports: [PrismaService] })`

#### 1.2.4 공통 모듈 (common/)

`src/common/decorators/`:
- `@CurrentUser()` — req.user에서 사용자 추출
- `@Roles(...roles)` — 메타데이터 설정
- `@Public()` — JWT Guard ��킵

`src/common/guards/`:
- `JwtAuthGuard` — 글로벌 JWT 검증
- `RolesGuard` — `@Roles` 데코레이터 기반 역할 검증
- `ProjectMemberGuard` — 해당 프로젝트 멤버인지 검증 + 역할 체크

`src/common/filters/`:
- `HttpExceptionFilter` — 통일된 에러 응답 포맷
  ```json
  { "statusCode": 400, "message": "...", "error": "Bad Request" }
  ```

`src/common/dto/`:
- `PaginationDto` — page, limit, sort, order
- 각 도메인별 CreateDto, UpdateDto

`src/common/interceptors/`:
- `TransformInterceptor` — 응��을 `{ data, meta }` 형태로 래핑

---

### Step 1.3 — AuthModule (Week 2 전반)

#### 1.3.1 구현 파일

| 파일 | 역할 |
|------|------|
| `auth.module.ts` | PassportModule, JwtModule ���록 |
| `auth.controller.ts` | POST /login, POST /register, GET /me |
| `auth.service.ts` | 로그인 검증, 회원가입, JWT 발급 |
| `jwt.strategy.ts` | JWT payload → User 객체 변환 |
| `dto/login.dto.ts` | email, password (class-validator) |
| `dto/register.dto.ts` | email, password, name |

#### 1.3.2 로직 상세

**POST /auth/register**
1. 이메일 중복 체크
2. bcrypt로 비밀번호 해싱 (salt rounds: 12)
3. User 생성
4. JWT 토큰 반환

**POST /auth/login**
1. 이메일로 User 조회
2. bcrypt.compare로 비밀번호 검증
3. JWT payload: `{ sub: user.id, email: user.email }`
4. 토큰 반��: `{ access_token, user: { id, email, name, avatar } }`

**JWT Strategy**
- `jwtFromRequest`: ExtractJwt.fromAuthBearerToken()
- `validate(payload)` �� PrismaService로 User 조회 → req.user에 설정
- 만료: `JWT_EXPIRES_IN` (기본 8시간)

**글로벌 Guard 등록** (`app.module.ts`):
```typescript
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
]
```
- `@Public()` 데코레이터가 있는 엔드포인트만 JWT 스킵

#### 1.3.3 시드 데이터
- Admin 계정 1개 자동 생성 (환���변수 `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- `prisma/seed.ts`에 작성

---

### Step 1.4 — ProjectModule (Week 2 후반)

#### 1.4.1 구현 파일

| 파일 | 역할 |
|------|------|
| `projects.controller.ts` | CRUD 엔드포인트 |
| `projects.service.ts` | 비즈니스 로직 |
| `dto/create-project.dto.ts` | name, key, description? |
| `dto/update-project.dto.ts` | PartialType(CreateProjectDto) |

#### 1.4.2 로직 상세

**POST /projects** (프로젝트 생성)
1. key를 대문��� 변환 + 영숫자만 ��용 (2~10자)
2. key 중복 체크
3. Project 생성
4. 생성��를 ADMIN 역할로 ProjectMember 자동 추가
5. 반환: project + members

**GET /projects** (내 프로젝트 목록)
1. 현재 사용자가 멤버인 프로젝트만 조회
2. 각 ���로젝트의 이슈 수, 멤버 수 포함
3. updatedAt DESC 정렬

**GET /projects/:key** (프로젝트 상세)
- ProjectMemberGuard 적용
- 멤버 목록 + 이슈 통계(상태별 count) 포함

**PATCH /projects/:key** (수정)
- PM 이상만 가능

**DELETE /projects/:key** (삭제)
- Admin만 가능
- Cascade: 하위 이슈, 라벨, 멤버, 활동 이력 모두 삭제

---

### Step 1.5 — MemberModule (Week 2 후반)

#### 1.5.1 엔드포인트

**POST /projects/:key/members** (멤버 추가)
1. 대상 유저 이메일��� 검색
2. 이미 멤버인지 확인
3. ProjectMember 생성 (���본 역할: DEVELOPER)

**PATCH /projects/:key/members/:userId** (역할 변경)
- Admin만 가능
- 자기 자신의 역할은 변경 불가

**DELETE /projects/:key/members/:userId** (멤버 제거)
- PM 이상만 가능
- 마지막 Admin은 제거 불가

---

### Step 1.6 — IssueModule (Week 3)

이 프로젝트의 핵심 모듈. 가장 복잡하므로 신중하게 구현.

#### 1.6.1 구현 파일

| 파일 | 역할 |
|------|------|
| `issues.controller.ts` | CRUD + 상태 변경 + 벌크 |
| `issues.service.ts` | 비즈니스 로직 |
| `dto/create-issue.dto.ts` | title, description?, status?, priority?, type, assigneeId?, parentId?, labelIds? |
| `dto/update-issue.dto.ts` | 각 필드 Optional |
| `dto/update-status.dto.ts` | status, order (D&D용) |
| `dto/query-issues.dto.ts` | 필터/정렬/페이지네이션 DTO |
| `dto/bulk-update.dto.ts` | issueIds[], 변경할 필드들 |

#### 1.6.2 로직 상세

**POST /projects/:key/issues** (이슈 생성)
1. 해당 프로젝트의 마지막 issue.number ���회
2. `number = lastNumber + 1` (프로젝트 내 자동 증가)
3. 해당 status 칼럼의 ���지막 order 조회 → `order = maxOrder + 1`
4. 타입 검증:
   - SUB_TASK는 반드시 parentId 필요
   - EPIC은 parentId 불가
   - TASK는 EPIC만 parent로 가능
5. labelIds가 ���으면 IssueLabel 일괄 생성
6. Activity 생성: `{ field: "created", newValue: title }`

**GET /projects/:key/issues** (이슈 목록)

쿼리 파라미터:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| status | string | 상태 필터 (복수: status=TODO,IN_PROGRESS) |
| priority | string | 우선순위 필터 |
| type | string | 이슈 타입 필터 |
| assigneeId | string | 담당자 필터 |
| parentId | string | 부모 이슈 필터 |
| search | string | 제목 검색 (ILIKE) |
| page | number | 페이지 (default: 1) |
| limit | number | 페이지당 개수 (default: 50) |
| sort | string | 정렬 필드 (default: order) |
| order | asc/desc | 정렬 방향 |

���답:
```json
{
  "data": [...issues],
  "meta": { "total": 120, "page": 1, "limit": 50, "totalPages": 3 }
}
```

**PATCH /issues/:id** (이슈 수정)
1. 변경된 필드만 업데이트
2. 각 변�� 필드마다 Activity 레코드 생성
   - 예: status 변경 → `{ field: "status", oldValue: "TODO", newValue: "IN_PROGRESS" }`
3. (Phase 2) WebSocket broadcast

**PATCH /issues/:id/status** (상태 변경 — D&D 전용)
1. 칸반에서 드래그&드롭 시 호출
2. `{ status: "IN_PROGRESS", order: 3 }` 형태
3. 같은 칼럼 내 다른 이슈들의 order 재정렬
4. Activity 생성
5. (Phase 2) WebSocket broadcast

**Order 재정렬 알고리즘:**
- 드롭 위치의 위/아래 이슈의 order 값 사이로 ��정
- 정수 간격이 부족하면 해당 칼럼 전체 order를 100 간격으로 재정렬
- 초기 order 값: 1000, 2000, 3000... (여유 확보)

**DELETE /issues/:id** (이슈 삭제)
- PM 이상만 가능
- 하위 이슈(children)의 parentId를 null로 설정 후 삭제

---

### Step 1.7 — React ���론트엔드 초기화 (Week 3 후반)

#### 1.7.1 프로젝트 생성

```bash
cd packages/web
pnpm create vite . --template react-ts
```

주요 의존성:
```
# 라우팅/상��
react-router-dom zustand @tanstack/react-query axios

# UI
tailwindcss @radix-ui/react-dialog @radix-ui/react-select
@radix-ui/react-popover @radix-ui/react-checkbox
lucide-react class-variance-authority clsx tailwind-merge

# 폼
react-hook-form zod @hookform/resolvers

# 드래그앤드롭
@hello-pangea/dnd

# 공유 타입
@bb-pm/shared (workspace:*)
```

#### 1.7.2 기본 구조 세팅

**services/api.ts** (Axios 인스턴스)
- baseURL: `/api/v1` (Vite proxy 설정)
- 요청 인터셉터: localStorage에서 토큰 → Authorization 헤더
- 응답 인터셉터: 401 → 토큰 삭제 + /login 리다이렉트
- BB_DEVTEAM의 Axios 패턴 참고

**contexts/AuthContext.tsx**
- `user`, `token`, `login()`, `logout()`, `isLoading` 제공
- 앱 마운트 시 GET /auth/me로 세션 검증
- BB_DEVTEAM 패턴 그대로 참고

**App.tsx 라우팅**
```
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<ProtectedRoute />}>
    <Route element={<DashboardLayout />}>
      <Route path="/" element={<Navigate to="/projects" />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:key/board" element={<BoardPage />} />
      <Route path="/projects/:key/list" element={<ListPage />} />
      <Route path="/projects/:key/settings" element={<ProjectSettingsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/members" element={<MembersPage />} />
    </Route>
  </Route>
</Routes>
```

**vite.config.ts proxy**:
```typescript
server: {
  proxy: { '/api': 'http://localhost:3000' }
}
```

#### 1.7.3 UI 컴포넌트 복사

BB_DEVTEAM/BB_YT_AUTOMATION에서 가져올 컴포넌트:
- `Button.tsx`, `Input.tsx`, `Card.tsx`, `Badge.tsx`, `Table.tsx`
- `cn()` 유틸리티 (clsx + tailwind-merge)
- Tailwind 설정 (색상 팔레트, 폰트 등)

새로 만들 컴포넌트:
- `Select.tsx` (Radix Select)
- `Dialog.tsx` (Radix Dialog — 모달 기반)
- `DropdownMenu.tsx` (Radix DropdownMenu)

---

### Step 1.8 — 핵심 페이지 구현 (Week 4)

#### 1.8.1 LoginPage
- 이메일/비밀번호 폼 (React Hook Form + Zod)
- login API 호출 → 토큰 저장 → /projects 이동
- 에러 메시지 표시

#### 1.8.2 DashboardLayout
- 좌측 Sidebar (���로젝트 목록 + 설정 링크)
- 상단 Header (���재 사용자 + 로그아웃)
- 메인 콘텐츠 영역 (Outlet)

#### 1.8.3 ProjectsPage
- 프로젝트 카드 그리드 (이름, 키, 이슈 수, 멤버 아바타)
- "New Project" 버튼 → ��성 모달 (Dialog)
- TanStack Query: `useQuery(['projects'], fetchProjects)`

#### 1.8.4 BoardPage (핵심)

**데이터 흐름:**
```
useQuery(['issues', projectKey, filters])
  → GET /projects/:key/issues
  → issues를 status별로 그룹핑
  → 각 칼럼에 렌더링
```

**컴포넌트 구조:**
```
BoardPage
├── BoardHeader (필터바 + "New Issue" 버튼)
├── KanbanBoard (@hello-pangea/dnd DragDropContext)
│   ├── KanbanColumn (Droppable) × 7
│   │   ├── ColumnHeader (상태��� + 이슈 수)
│   │   └── IssueCard (Draggable) × N
│   │       ├── TypeBadge
│   │       ├── PriorityIcon
│   │       ├── Title
│   │       ├── Labels
│   │       └── AssigneeAvatar
├── IssueCreateModal (Dialog)
└── IssueDetailPanel (��이드 패널 or Dialog)
```

**드래그 & 드롭 로직:**
1. `onDragEnd(result)` 호출
2. `result.destination.droppableId` → 새 status
3. `result.destination.index` → 새 order 계산
4. Optimistic update: 즉시 UI ���영
5. `PATCH /issues/:id/status` 호출
6. 실패 시 롤백 (이전 상태 복원)

**필터 상태 (Zustand store):**
```typescript
interface BoardFilterStore {
  assigneeId: string | null;
  type: IssueType | null;
  priority: IssuePriority | null;
  search: string;
  setFilter: (key, value) => void;
  resetFilters: () => void;
}
```

#### 1.8.5 IssueCreateModal
- React Hook Form + Zod 검증
- 필드: 제목*, 설명, ��입, 우선순위, 상태(초기), 담당자, 부모이슈
- 담당자 Select: 프로젝트 멤버 목록에서 선택
- 부모이슈 Select: 프로젝트의 Epic/Task 목록에서 선택
- 생성 성공 → TanStack Query invalidate → 보드 자동 갱신

#### 1.8.6 IssueDetailPanel
- 이슈 카드 클릭 시 우측 사이드 패널 또는 모달로 열림
- 제��: 클릭하면 인라인 편집 → blur/Enter 시 PATCH 호출
- 상태/우선순위/담당자: Radix Select → 변경 시 즉시 PATCH
- 설명: textarea → blur 시 PATCH
- 하위 이슈 목록 (읽기 전용, 클릭하면 해당 이슈로 ���환)
- 라벨 표시
- Activity 타임라인 (최근 50건)

---

### Step 1.9 — Phase 1 마무리 체크리스트

- [ ] docker-compose up으로 전체 환경 실��� 가능
- [ ] 회원가입 → 로그인 → 토큰 저장
- [ ] 프로젝트 생성 → 목록에 표시
- [ ] 이슈 생성 → 칸반 보드에 표시
- [ ] 이슈 드래그&드롭 → 상태 변경 반영
- [ ] 이슈 카드 클릭 → 상세 보기/수정
- [ ] 멤버 추가/역할 관리
- [ ] 역할별 권한 동작 확인

---

## Phase 2 — 완���도 (Week 5~8)

---

### Step 2.1 — ListPage (Week 5 전반)

**컴포넌트 구조:**
```
ListPage
├── ListHeader (필터바 + 정렬 + "New Issue" 버튼)
├── IssueTable
│   ├── TableHeader (컬럼명 + 정렬 화살표)
│   ├── TableRow × N
│   │   ├── Checkbox (벌크 선택)
│   │   ├── Number (#)
│   │   ├─��� TypeBadge
│   │   ├── Title
│   │   ├── StatusBadge
│   │   ├── PriorityBadge
│   │   └── AssigneeAvatar
│   └���─ Pagination
├���─ BulkActionBar (선택된 이슈가 있을 때 하단에 표시)
│   ├── "N items selected"
│   ├── StatusSelect (벌크 상태 변경)
│   ├── AssigneeSelect (벌크 담당자 변경)
│   └── DeleteButton (PM+)
└── IssueDetailPanel
```

**벌크 액션:**
- 체크박스��� 다수 이슈 선택
- 하단 ��션바에서 일괄 변경
- `PATCH /issues/bulk` → `{ issueIds: [...], status?: ..., assigneeId?: ... }`

---

### Step 2.2 — LabelModule (Week 5 후반)

**백엔드:**
- `GET /projects/:key/labels` — 프로젝트 라벨 목록
- `POST /projects/:key/labels` — 라벨 생성 (name, color)
- `PATCH /labels/:id` — 라벨 수정
- `DELETE /labels/:id` — 라벨 삭제 (연결된 IssueLabel도 cascade)

**프론트엔드:**
- ProjectSettingsPage에 라벨 관리 탭 추가
- 라벨 생성: name 입력 + 색상 피커 (프리셋 8색 + 커스텀)
- 이슈 생성/수정 모달에 라벨 멀티 셀렉트 추가
- 칸반 카드/리스트 행에 라벨 뱃지 표시

**기본 라벨 프리셋** (프로젝트 생성 시 자동 생성):
- frontend (#3B82F6), backend (#10B981), mobile (#8B5CF6), bug (#EF4444), infra (#6B7280), qa (#F59E0B)

---

### Step 2.3 — ActivityModule (Week 6 전반)

**백엔드:**
- `ActivityService.log(issueId, userId, field, oldValue, newValue)` 헬퍼
- IssueService의 update/updateStatus 메서드에서 ���동 호출
- 필드별 포맷팅:
  - status: enum → display label 변환 ("TODO" → "To Do")
  - assigneeId: userId → 사용자 이름 변환
  - priority: enum → display label
- `GET /issues/:id/activities` — 최근 100건, 최신순

**프론트엔드:**
- IssueDetailPanel 하단에 Activity 타임라인
- 각 항목: `[사용자] changed [필드] from [이전] to [이후] — [시간]`
- 상대 시간 표시 (date-fns `formatDistanceToNow`)

---

### Step 2.4 — 검색 & 필터 고도��� (Week 6 후반)

**이슈 검색:**
- 제목 검색: Prisma `contains` (mode: insensitive)
- 필터 조합: status + priority + type + assignee + label + search 동시 적용
- URL 쿼리 파라미터와 동기�� (뒤로가기/새로고침 시 필터 유지)

**프론트엔드:**
- 필터바 컴포넌트를 보드/리���트 공용으로 분리
- Zustand store에 필터 상태 저장
- URL searchParams와 양방향 동기화 (`useSearchParams` + Zustand)

---

### Step 2.5 — WebSocket 실시간 동기화 (Week 7)

#### 백엔드: IssuesGateway

`src/issues/issues.gateway.ts`:
```
@WebSocketGateway({ namespace: '/board', cors: true })
```

**이벤트 플로우:**
1. 클라이언트가 보드 ��이지 진입 → `join-project` (projectId) 전송
2. 서버: 소켓을 `project:${projectId}` 룸에 join
3. 이슈 변경(생성/수정/삭제/상태변경) 시:
   - IssueService에서 변경 처리
   - IssuesGateway를 통해 해당 프로젝트 룸에 broadcast
4. 클라이언트: 이벤트 수신 → TanStack Query 캐시 업데이트

**이벤트 페이���드:**
```typescript
// issue-updated
{ issueId: string, changes: Partial<Issue>, updatedBy: string }

// issue-created
{ issue: Issue, createdBy: string }

// issue-deleted
{ issueId: string, deletedBy: string }
```

#### 프론트엔드: useSocket 훅

```typescript
function useProjectSocket(projectKey: string) {
  // Socket.io 연결 + 룸 참여
  // issue-updated → queryClient.setQueryData 로 캐시 직접 업데이트
  // issue-created → queryClient.invalidateQueries
  // issue-deleted → queryClient.setQueryData 에서 제거
}
```

**주의사항:**
- 본인이 발생시킨 변경은 무시 (optimistic update와 중복 방지)
- 소켓 연결 실패 시 폴링 fallback (30초 간격)

---

### Step 2.6 — API Key 인증 (Week 7 후반)

**백엔드:**
- `ApiKeyGuard`: `X-API-Key` 헤더 검증
- `JwtAuthGuard` 수정: JWT 없을 때 API Key fallback 시도
- `POST /api/v1/auth/api-keys` — API Key 생성 (Admin만)
- `GET /api/v1/auth/api-keys` — 내 API Key 목록
- `DELETE /api/v1/auth/api-keys/:id` — API Key 삭제

**키 생성:**
- `crypto.randomBytes(32).toString('hex')` → 64자
- DB에��� 해시값 저장, 응답에만 ���본 반환 (1회만)

**사용 예시 (AI 시스템에서):**
```bash
curl -H "X-API-Key: bb_pk_abc123..." \
     -H "Content-Type: application/json" \
     -d '{"title": "New feature", "type": "TASK"}' \
     POST /api/v1/projects/GOOB/issues
```

---

### Step 2.7 — 이슈 상세 사이드패널 고도화 (Week 8)

Phase 1에서 기본형을 만들었다면, Phase 2에서 고도화:

- 설명: 마크다운 에디터 (react-markdown으로 미리보기)
- 부모 이슈: Select로 변경 가능
- 하위 이슈: + 버튼으로 바로 Sub-task 생성
- 라벨: 멀티 셀렉트 + 색상 뱃지
- 담당자: 아바타 + 이름으로 표시, Select로 변경
- 생성자/생성일/수정일 메타 정보
- 삭제 버튼 (PM+, 확인 Dialog)

---

### Step 2.8 — Phase 2 마무리 체크리스트

- [ ] 리스트 뷰 동작 (정렬/필터/페이지네이션)
- [ ] 벌크 액션 (상��/담당자 일괄 변경)
- [ ] 라벨 CRUD + 이슈에 라벨 연결
- [ ] Activity 자동 기록 + ���임라인 표시
- [ ] WebSocket 실시간 동기화 (��른 탭/사용자 변경 반영)
- [ ] API Key 생성 + 외부 API 호출 검증
- [ ] 이슈 상세 패널 모든 필드 편집 가능
- [ ] URL 기반 필터 유지 (뒤로가기/새로고침)

---

## Phase 3 — 안정화 & 확장 (Week 9~12)

---

### Step 3.1 — 프로젝트 대시보드 (Week 9)

**GET /projects/:key/stats** 엔드포인트:
```json
{
  "statusCounts": { "BACKLOG": 12, "TODO": 8, "IN_PROGRESS": 5, ... },
  "priorityCounts": { "HIGH": 10, "MEDIUM": 15, "LOW": 3 },
  "typeCounts": { "EPIC": 3, "TASK": 20, "BUG": 5 },
  "assigneeCounts": [{ "userId": "...", "name": "...", "count": 8 }, ...],
  "recentActivity": [...],
  "completionRate": 0.65,
  "createdThisWeek": 12,
  "completedThisWeek": 8
}
```

**프론트엔드:**
- 프로젝트 메인(보드 상단 또는 별도 탭)에 통계 카드
- 상태별 도넛 차트 (Recharts)
- 담당자별 이슈 수 바 차트
- 주간 생성/완료 추이 (간단한 라인 차트)
- 최근 활동 피드

---

### Step 3.2 — 프로덕션 Docker & 배포 (Week 9~10)

#### Dockerfile.api (multi-stage)
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/api/package.json packages/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/api packages/api
RUN pnpm --filter @bb-pm/shared build
RUN pnpm --filter @bb-pm/api build
RUN pnpm --filter @bb-pm/api exec prisma generate

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

#### Dockerfile.web
```dockerfile
FROM node:22-alpine AS builder
# ... build
RUN pnpm --filter @bb-pm/web build

FROM nginx:alpine
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

#### docker-compose.prod.yml
- db: PostgreSQL 16 + volume + healthcheck
- api: built image + 환경변수 + depends_on db
- web: nginx + api upstream proxy
- (optional) redis: WebSocket adapter용 (다중 인스턴스 시)

#### nginx.conf
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://api:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";  # WebSocket 지원
  }

  location / {
    try_files $uri $uri/ /index.html;  # SPA fallback
  }
}
```

---

### Step 3.3 — 테스트 (Week 10~11)

#### 백엔드 유닛/통합 테스트 (Jest)
- AuthService: 로그인/회원가입/토큰검증
- IssueService: CRUD + 상��변경 + order 재정렬
- ProjectService: CRUD + 멤버 관리
- Guard 테스트: 권한별 접근 제어
- E2E 테스트: Supertest로 API 흐름 검증

#### 프론트엔드 E2E 테스트 (Playwright)
- 로그인 → 프로젝트 생성 → 이슈 생성 → 보드에서 D&D → 이슈 수정 → 삭제
- 역할��� 권한 테스트 (Developer가 삭제 시도 → ���패)
- 리스트 뷰 필터/정렬 동작 확인

---

### Step 3.4 — Jira 데이터 마이그레이션 (Week 11)

���이그레이션 스크립트 (`scripts/migrate-from-jira.ts`):

**대상 프로젝트** (��성 프로젝트만):
- D2, PLAYIN, GOOB, EC

**마이그레이션 순서:**
1. Jira 프로젝트 → Project 생성 (key 유지)
2. Jira 멤버 → User 생성 + ProjectMember 연결
3. Jira Epic → Issue (type: EPIC) 생성
4. Jira Task/Story/Bug → Issue 생성 (parentId로 Epic 연결)
5. Jira Sub-task → Issue (type: SUB_TASK) 생성
6. Jira 라벨 → Label + IssueLabel 매핑

**상태 매핑:**
| Jira | 새 시스템 |
|------|----------|
| Backlog | BACKLOG |
| Selected for Development / To Do | TODO |
| In Progress | IN_PROGRESS |
| UI / API Ready / READY TO TEST / FINAL TESTING | REVIEW_QA |
| Done | DONE |
| CANCEL / CANCELED | CANCELED |
| RECHECK / RE-CHECK | RECHECK |

**Jira API 호출:** Atlassian MCP 또는 REST API로 데이터 추출

---

### Step 3.5 — 스프린트 기능 (Week 12, 옵션)

Phase 3에서 시간이 남으면 추가. 아니면 이후 확장.

**DB 추가:**
- `Sprint` 테이블: id, name, projectId, startDate, endDate, status(PLANNING/ACTIVE/COMPLETED)
- `Issue`에 `sprintId` 필드 추가

**API 추가:**
- `/projects/:key/sprints` — CRUD
- `/sprints/:id/start` — 스프린트 시작
- `/sprints/:id/complete` — 스프린트 완료 (미완료 이슈 → ��로그 이동)

**UI 추가:**
- 보드 상단에 스프린트 선택 드롭다운
- 백로그 뷰: 스프린트 미할당 이슈 → 스프린트로 ��래그

---

### Step 3.6 — Phase 3 마무리 체크리스트

- [ ] 프로덕션 Docker 빌드 성공
- [ ] docker-compose.prod.yml로 전체 서비스 실행
- [ ] 프로젝트 대시보드 통계 표시
- [ ] 백엔드 테스트 커버리지 70%+
- [ ] Playwright E2E 핵심 플로우 통과
- [ ] Jira 데이터 마이그레이션 스크립트 동작 확인
- [ ] 20명 동시 접속 부하 테스트 통과
- [ ] 프로덕션 환경 배포 완료

---

## 부록: 주요 의존성 버전 목록

### packages/api
```json
{
  "@nestjs/core": "^11",
  "@nestjs/common": "^11",
  "@nestjs/config": "^4",
  "@nestjs/swagger": "^8",
  "@nestjs/passport": "^11",
  "@nestjs/jwt": "^11",
  "@nestjs/websockets": "^11",
  "@nestjs/platform-socket.io": "^11",
  "prisma": "^7",
  "@prisma/client": "^7",
  "passport": "^0.7",
  "passport-jwt": "^4",
  "bcryptjs": "^2",
  "class-validator": "^0.14",
  "class-transformer": "^0.5",
  "socket.io": "^4"
}
```

### packages/web
```json
{
  "react": "^19",
  "react-dom": "^19",
  "react-router-dom": "^7",
  "zustand": "^5",
  "@tanstack/react-query": "^5",
  "axios": "^1",
  "tailwindcss": "^4",
  "@radix-ui/react-dialog": "^1",
  "@radix-ui/react-select": "^2",
  "@radix-ui/react-popover": "^1",
  "lucide-react": "^0.400",
  "class-variance-authority": "^0.7",
  "clsx": "^2",
  "tailwind-merge": "^2",
  "react-hook-form": "^7",
  "zod": "^3",
  "@hookform/resolvers": "^3",
  "@hello-pangea/dnd": "^17",
  "date-fns": "^3",
  "recharts": "^2",
  "socket.io-client": "^4"
}
```
