# Burningbros 내부 프로젝트 관리 시스템 - PRD

## 1. 개요

### 목적
Jira를 대체하는 내부 프로젝트 관리 시스템 구축

### 핵심 목표
- **비용 절감**: Jira 라이선스 비용 제거
- **업무 명확성**: 20명 규모, 4개 프로젝트(프로젝트당 4~5명)에서 업무 할당/진행 추적이 명확하게 되는 시스템
- **AI 시스템 연동**: 기존 AI 기반 업무 생성/기획 시스템과 REST API 연동

### 대상 사용자
- Burningbros 내부 PM / 개발자 (약 20명)

### 목표 일정
- 3개월 내 구축

---

## 2. 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| **Backend** | NestJS + TypeScript | 프로덕션 레벨: DI, Module, Guard, Interceptor |
| **ORM** | Prisma 7 | Type-safe, 마이그레이션 내장 |
| **Database** | PostgreSQL 16 | 자체 운영 |
| **인증** | JWT (Passport) + bcrypt | NestJS Guard 기반 역할 관리 |
| **Frontend** | React 19 + Vite + TypeScript | 기존 프로젝트 패턴 준용 |
| **UI** | Tailwind CSS + Radix UI + Lucide Icons | 커스텀 컴포넌트 |
| **상태관리** | Zustand + TanStack React Query | 클라이언트/서버 상태 분리 |
| **라우팅** | React Router DOM | SPA |
| **폼/검증** | React Hook Form + Zod | 프론트 검증 |
| **실시간** | WebSocket (Socket.io) | 칸반 보드 실시간 동기화 |
| **모노레포** | pnpm workspaces | BB_YT_AUTOMATION 패턴 준용 |
| **배포** | Docker Compose + 기존 인프라 | 프론트: nginx, 백: Node |

---

## 3. 프로젝트 구조 (pnpm 모노레포)

```
project-management/
├── packages/
│   ├── api/                          # NestJS 백엔드
│   │   ├── src/
│   │   │   ├── auth/                 # AuthModule
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── projects/             # ProjectModule
│   │   │   │   ├── projects.module.ts
│   │   │   │   ├── projects.controller.ts
│   │   │   │   └── projects.service.ts
│   │   │   ├── issues/               # IssueModule
│   │   │   │   ├── issues.module.ts
│   │   │   │   ├── issues.controller.ts
│   │   │   │   ├── issues.service.ts
│   │   │   │   └── issues.gateway.ts  # WebSocket (실시간 보드)
│   │   │   ├── labels/               # LabelModule
│   │   │   ├── members/              # MemberModule
│   │   │   ├── activities/           # ActivityModule
│   │   │   ├── common/               # 공통 (decorators, pipes, filters, dto)
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── roles.decorator.ts
│   │   │   │   │   └── current-user.decorator.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── http-exception.filter.ts
│   │   │   │   └── dto/
│   │   │   │       └── pagination.dto.ts
│   │   │   ├── prisma/               # PrismaModule (global)
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── web/                          # React + Vite 프론트엔드
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/               # 공통 UI (Button, Input, Card, Badge, Table 등)
│   │   │   │   ├── board/            # 칸반 보드 컴포넌트
│   │   │   │   ├── issue/            # 이슈 카드, 상세, 생성 모달
│   │   │   │   ├── project/          # 프로젝트 카드, 설정
│   │   │   │   └── layout/           # Sidebar, Header, Layout
│   │   │   ├── pages/                # 페이지 컴포넌트
│   │   │   ├── services/             # API 클라이언트 (Axios)
│   │   │   ├── stores/               # Zustand 스토어
│   │   │   ├── contexts/             # AuthContext
│   │   │   ├── hooks/                # useIssues, useProjects 등
│   │   │   ├── types/                # TypeScript 타입
│   │   │   ├── lib/                  # 유틸리티
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   └── package.json
│   │
│   └── shared/                       # 공유 타입/상수
│       ├── src/
│       │   ├── types/                # Issue, Project 등 공통 타입
│       │   └── constants/            # 상태값, 우선순위 등 enum/상수
│       └── package.json
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile.api
├── Dockerfile.web
├── pnpm-workspace.yaml
├── package.json
└── docs/
    └── PRD.md
```

---

## 4. 핵심 기능

### 4.1 프로젝트 관리
- 프로젝트 CRUD (생성/조회/수정/삭제)
- 프로젝트별 멤버 관리 (초대/역할변경/제거)
- 프로젝트 목록 및 요약 대시보드

### 4.2 이슈 관리

#### 이슈 타입
| 타입 | 설명 |
|------|------|
| Epic | 큰 단위의 기능/목표 그룹핑 |
| Task | 주요 작업 단위 (주력 이슈 타입) |
| Bug | 버그 리포트 |
| Sub-task | Task 하위 세부 작업 |

#### 이슈 필드
| 필드 | 타입 | 필수 |
|------|------|------|
| 제목 (Title) | text | O |
| 설명 (Description) | rich text | X |
| 상태 (Status) | enum | O |
| 우선순위 (Priority) | enum | O |
| 담당자 (Assignee) | user | X |
| 라벨 (Labels) | tag[] | X |
| 이슈 타입 (Type) | enum | O |
| 부모 이슈 (Parent) | relation | X |

#### 이슈 계층
```
Epic
 └── Task
      └── Sub-task
```

### 4.3 워크플로우 (통일)

```
Backlog → To Do → In Progress → Review/QA → Done
                  │                          │
                  └──── CANCELED              │
                  │                          │
                  └──── RECHECK ─────────────┘
```

| 상태 | 카테고리 | 설명 |
|------|---------|------|
| Backlog | To Do | 아직 계획되지 않은 이슈 |
| To Do | To Do | 할 일로 확정됨 |
| In Progress | In Progress | 작업 진행 중 |
| Review/QA | In Progress | 리뷰 또는 QA 진행 중 |
| Done | Done | 완료 |
| Canceled | Done | 취소됨 |
| Recheck | In Progress | 재확인 필요 (QA → 다시 작업) |

- 모든 상태 간 자유 전환 가능 (Jira 현재 방식 유지)

### 4.4 뷰

#### 칸반 보드
- 상태별 칼럼으로 이슈 표시
- 드래그 & 드롭으로 상태 변경
- **실시간 동기화** (WebSocket: 다른 사용자의 변경이 즉시 반영)
- 필터: 담당자, 라벨, 우선순위, 이슈 타입
- WIP(Work In Progress) 개수 표시

#### 리스트 뷰
- 테이블 형태로 이슈 목록 표시
- 정렬: 상태, 우선순위, 생성일, 수정일
- 필터: 칸반과 동일
- 벌크 액션 (상태 변경, 담당자 할당 등)

### 4.5 권한/역할 (3단계)

| 역할 | 권한 |
|------|------|
| Admin | 시스템 전체 설정, 프로젝트 생성/삭제, 멤버 초대 |
| PM | 프로젝트 설정, 이슈 생성/수정/삭제, 멤버 관리 |
| Developer | 이슈 생성/수정, 자기 이슈 상태 변경 |

NestJS 구현: `@Roles('ADMIN')` 데코레이터 + `RolesGuard`로 엔드포인트별 제어

### 4.6 AI 시스템 연동 (REST API)
- REST API 제공으로 외부 AI 시스템에서 이슈 CRUD 가능
- API Key 기반 인증 (Bearer JWT와 별도 `X-API-Key` 헤더)

---

## 5. API 설계 (v1)

Base URL: `/api/v1`

### 인증
| Method | Endpoint | 설명 | Guard |
|--------|----------|------|-------|
| POST | `/auth/login` | 로그인 (JWT 발급) | Public |
| POST | `/auth/register` | 회원가입 | Public |
| GET | `/auth/me` | 현재 사용자 정보 | JWT |

### 프로젝트
| Method | Endpoint | 설명 | Guard |
|--------|----------|------|-------|
| GET | `/projects` | 내 프로젝트 목록 | JWT |
| POST | `/projects` | 프로젝트 생성 | JWT |
| GET | `/projects/:key` | 프로젝트 상세 | JWT + Member |
| PATCH | `/projects/:key` | 프로젝트 수정 | JWT + PM↑ |
| DELETE | `/projects/:key` | 프로젝트 삭제 | JWT + Admin |

### 프로젝트 멤버
| Method | Endpoint | 설명 | Guard |
|--------|----------|------|-------|
| GET | `/projects/:key/members` | 멤버 목록 | JWT + Member |
| POST | `/projects/:key/members` | 멤버 추가 | JWT + PM↑ |
| PATCH | `/projects/:key/members/:userId` | 역할 변경 | JWT + Admin |
| DELETE | `/projects/:key/members/:userId` | 멤버 제거 | JWT + PM↑ |

### 이슈
| Method | Endpoint | 설명 | Guard |
|--------|----------|------|-------|
| GET | `/projects/:key/issues` | 이슈 목록 (필터/페이지네이션) | JWT + Member |
| POST | `/projects/:key/issues` | 이슈 생성 | JWT + Member |
| GET | `/issues/:id` | 이슈 상세 | JWT |
| PATCH | `/issues/:id` | 이슈 수정 | JWT |
| DELETE | `/issues/:id` | 이슈 삭제 | JWT + PM↑ |
| PATCH | `/issues/:id/status` | 상태 변경 (D&D용, WebSocket broadcast) | JWT |
| PATCH | `/issues/bulk` | 벌크 수정 | JWT + PM↑ |

### 라벨
| Method | Endpoint | 설명 | Guard |
|--------|----------|------|-------|
| GET | `/projects/:key/labels` | 라벨 목록 | JWT + Member |
| POST | `/projects/:key/labels` | 라벨 생성 | JWT + PM↑ |
| PATCH | `/labels/:id` | 라벨 수정 | JWT + PM↑ |
| DELETE | `/labels/:id` | 라벨 삭제 | JWT + PM↑ |

### 활동 이력
| Method | Endpoint | 설명 | Guard |
|--------|----------|------|-------|
| GET | `/issues/:id/activities` | 이슈 변경 이력 | JWT |

### WebSocket Events (Socket.io)
| Event | Direction | 설명 |
|-------|-----------|------|
| `join-project` | Client → Server | 프로젝트 룸 참여 |
| `leave-project` | Client → Server | 프로젝트 룸 퇴장 |
| `issue-updated` | Server → Client | 이슈 변경 브로드캐스트 |
| `issue-created` | Server → Client | 이슈 생성 브로드캐스트 |
| `issue-deleted` | Server → Client | 이슈 삭제 브로드캐스트 |

---

## 6. 데이터 모델 (Prisma Schema)

### ER 다이어그램
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│    users     │────▶│ project_members  │◀────│  projects   │
│              │     │  (role: enum)    │     │             │
└──────┬──────┘     └──────────────────┘     └──────┬──────┘
       │                                            │
       │ assignee_id                                │ project_id
       ▼                                            ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   issues     │◀───│  issue_labels    │───▶│   labels    │
│              │     └──────────────────┘     └─────────────┘
│ parent_id ──┐│
│             ││
│  (self-ref) ◀┘
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ activities   │
└─────────────┘
```

### 테이블 상세

#### users
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK, @default(uuid()) |
| email | String | @unique |
| name | String | |
| password_hash | String | bcrypt |
| avatar | String? | nullable |
| is_superuser | Boolean | default false |
| created_at | DateTime | @default(now()) |
| updated_at | DateTime | @updatedAt |

#### projects
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| name | String | |
| key | String | @unique, 영문 대문자 2~10자 |
| description | String? | nullable |
| created_at | DateTime | |
| updated_at | DateTime | |

#### project_members
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| project_id | UUID | FK → projects |
| role | Enum | ADMIN / PM / DEVELOPER |
| created_at | DateTime | |
| | | @@unique([user_id, project_id]) |

#### issues
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| number | Int | 프로젝트 내 자동 증가 |
| title | String | max 500자 |
| description | String? | nullable |
| status | Enum | BACKLOG / TODO / IN_PROGRESS / REVIEW_QA / DONE / CANCELED / RECHECK |
| priority | Enum | HIGH / MEDIUM / LOW |
| type | Enum | EPIC / TASK / BUG / SUB_TASK |
| order | Int | 칸반 칼럼 내 정렬 순서 |
| project_id | UUID | FK → projects |
| assignee_id | UUID? | FK → users, nullable |
| creator_id | UUID | FK → users |
| parent_id | UUID? | FK → issues (self), nullable |
| created_at | DateTime | |
| updated_at | DateTime | |
| | | @@unique([project_id, number]) |
| | | @@index([project_id, status]) |

#### labels
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| name | String | max 50자 |
| color | String | hex (#RRGGBB) |
| project_id | UUID | FK → projects |
| | | @@unique([project_id, name]) |

#### issue_labels
| 컬럼 | 타입 | 비고 |
|------|------|------|
| issue_id | UUID | FK → issues |
| label_id | UUID | FK → labels |
| | | @@id([issue_id, label_id]) |

#### activities
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| issue_id | UUID | FK → issues |
| user_id | UUID | FK → users |
| field | String | 변경된 필드명 |
| old_value | String? | |
| new_value | String? | |
| created_at | DateTime | |
| | | @@index([issue_id]) |

#### api_keys (AI 시스템 연동용)
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| key | String | @unique, 64자 해시 |
| name | String | 키 설명 |
| user_id | UUID | FK → users |
| last_used | DateTime? | |
| created_at | DateTime | |

---

## 7. 페이지 구조 (프론트엔드 라우팅)

```
/login                     → 로그인 페이지
/                          → 홈 → /projects 리다이렉트
/projects                  → 프로젝트 목록
/projects/:key/board       → 칸반 보드 (메인 뷰)
/projects/:key/list        → 리스트 뷰
/projects/:key/settings    → 프로젝트 설정 (멤버/라벨 관리)
/settings                  → 시스템 설정 (Admin)
/settings/members          → 전체 멤버 관리
```

### 주요 화면 설명

#### 로그인
- 이메일/비밀번호 → JWT 발급 → AuthContext 저장

#### 프로젝트 목록
- 카드 형태 (이름, 키, 이슈 수, 멤버 아바타)
- 프로젝트 생성 모달

#### 칸반 보드 (핵심 화면)
- 7개 상태 칼럼 (접기/펼치기 가능)
- 이슈 카드: 타입 뱃지, 우선순위 아이콘, 제목, 담당자, 라벨
- 드래그 & 드롭 → 상태 변경 + WebSocket 브로드캐스트
- 상단 필터바 (담당자, 이슈 타입, 우선순위, 검색)
- 카드 클릭 → 이슈 상세 사이드패널/모달

#### 리스트 뷰
- 테이블: #, 타입, 제목, 상태, 우선순위, 담당자
- 정렬/필터
- 체크박스 + 벌크 액션 (상태 변경, 담당자 할당)

#### 이슈 상세 (모달/사이드패널)
- 제목 인라인 편집
- 상태/우선순위/담당자 드롭다운
- 설명 마크다운 편집
- 부모 이슈 링크
- 하위 이슈 목록
- 라벨 태그
- Activity 로그 (변경 이력 타임라인)

---

## 8. 개발 로드맵

### Phase 1 - MVP (1개월차)
- [ ] 모노레포 세팅 (pnpm workspaces)
- [ ] NestJS 프로젝트 초기화 + Prisma 스키마 + 마이그레이션
- [ ] AuthModule (로그인/회원가입/JWT Guard/Role Guard)
- [ ] ProjectModule (CRUD + 멤버 관리)
- [ ] IssueModule (CRUD + 상태 변경)
- [ ] React 프론트 초기화 + 라우팅 + AuthContext
- [ ] 칸반 보드 (드래그 & 드롭)
- [ ] Docker Compose 개발 환경

### Phase 2 - 완성도 (2개월차)
- [ ] 리스트 뷰
- [ ] 이슈 필터링 & 검색 (쿼리 파라미터)
- [ ] LabelModule + UI
- [ ] ActivityModule (변경 이력 자동 기록)
- [ ] WebSocket 실시간 보드 동기화
- [ ] API Key 인증 (AI 시스템 연동)
- [ ] 벌크 액션
- [ ] 이슈 상세 사이드패널

### Phase 3 - 안정화 & 확장 (3개월차)
- [ ] 프로젝트 대시보드 (진행률, 상태별 통계)
- [ ] 프로덕션 Docker 빌드 최적화
- [ ] E2E 테스트 (Playwright)
- [ ] Jira 데이터 마이그레이션 스크립트
- [ ] 스프린트 기능 (옵션)
- [ ] 실사용 피드백 반영

---

## 9. Jira 현재 사용 대비 변경점

| 항목 | Jira (현재) | 새 시스템 |
|------|------------|----------|
| 워크플로우 | 프로젝트마다 다름 (4~9단계) | 통일 7단계 |
| 이슈 타입 | Story 포함 5종 | 4종 (Story 제거) |
| 방법론 | 스크럼/칸반 혼용 | 칸반 우선 → 스프린트 확장 |
| 라벨 | 자유 입력 | 프로젝트별 라벨 관리 |
| 우선순위 | 5단계 (사실상 3단계만 사용) | 3단계 (High, Medium, Low) |
| 알림 | 이메일 | 1차 없음 (추후 검토) |
| 뷰 | 보드/백로그/타임라인 등 | 칸반 + 리스트 |
| 실시간 | 없음 | WebSocket 보드 동기화 |

---

## 10. 기존 프로젝트 재활용 목록

### BB_YT_AUTOMATION에서 (Node.js/TS 패턴)
| 모듈 | 재활용 내용 |
|------|-----------|
| pnpm-workspace.yaml | 모노레포 설정 |
| Prisma 설정 | schema.prisma 구조, 마이그레이션 패턴 |
| Docker 구성 | multi-stage build, docker-compose |
| JWT 미들웨어 | 인증 패턴 참고 (→ NestJS Guard로 전환) |

### BB_DEVTEAM / CP에서 (프론트엔드)
| 모듈 | 재활용 내용 |
|------|-----------|
| components/ui/ | Button, Input, Card, Badge, Table 등 공통 컴포넌트 |
| AuthContext | 인증 컨텍스트 패턴 |
| services/ | Axios 인스턴스 + 인터셉터 패턴 |
| Tailwind 설정 | CSS 변수, 테마 구성 |
| Zustand 스토어 | 상태관리 패턴 |
