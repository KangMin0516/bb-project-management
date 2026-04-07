## 기획서: 이슈 템플릿 + 대시보드 My Work 강화

### 요구사항 요약
1. **이슈 템플릿**: 글로벌(전체 공용) 템플릿 관리. 프로젝트 목록(/) 레벨에 탭 추가. 템플릿 필드: 이름 + 타입 + description. 이슈 생성 시 타입 선택하면 description 자동 채움.
2. **My Work 강화**: 현재 프로젝트 대시보드의 My Issues 섹션 확장 — 오버듀 표시, 정렬 옵션, 전체 이슈 표시 (10개 제한 해제).

---

### Phase 1: 이슈 템플릿

#### DB 모델
```prisma
model IssueTemplate {
  id          String    @id @default(uuid())
  name        String    @db.VarChar(100)
  type        IssueType @default(TASK)
  description String?   @db.Text
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  creatorId   String    @map("creator_id")
  creator     User      @relation(fields: [creatorId], references: [id], onDelete: Cascade)

  @@map("issue_templates")
}
```

#### API 엔드포인트
- `GET    /templates` — 전체 목록 조회
- `POST   /templates` — 생성 (name, type, description)
- `PATCH  /templates/:id` — 수정
- `DELETE /templates/:id` — 삭제

#### Backend 파일
- `packages/api/prisma/schema.prisma` — IssueTemplate 모델 + User relation 추가
- `packages/api/prisma/migrations/YYYYMMDDHHMMSS_add_issue_template/migration.sql` — 마이그레이션
- `packages/api/src/template/template.service.ts` — CRUD 서비스
- `packages/api/src/template/template.controller.ts` — REST 컨트롤러
- `packages/api/src/template/template.module.ts` — NestJS 모듈
- `packages/api/src/template/dto/create-template.dto.ts` — 생성 DTO
- `packages/api/src/template/dto/update-template.dto.ts` — 수정 DTO
- `packages/api/src/app.module.ts` — TemplateModule 등록

#### Frontend 파일
- `packages/web/src/api/templates.ts` — API 클라이언트 + 타입
- `packages/web/src/pages/ProjectsPage.tsx` — 탭 UI 추가 (Projects | Templates)
- `packages/web/src/components/template/TemplateManager.tsx` — 템플릿 CRUD 관리 컴포넌트
- `packages/web/src/components/issue/CreateIssueModal.tsx` — 타입 변경 시 해당 타입의 템플릿 description 자동 채움

#### 동작 흐름
1. ProjectsPage에서 "Templates" 탭 클릭 → TemplateManager 표시
2. TemplateManager: 템플릿 리스트 + 생성/수정/삭제 인라인 UI
3. CreateIssueModal: 타입(type) 변경 → 해당 타입의 템플릿 조회 → description이 비어있으면 자동 채움
   - 이미 description을 입력한 경우 덮어쓰지 않음
   - 해당 타입에 템플릿이 여러 개면 첫 번째 사용 (추후 선택 UI 확장 가능)

---

### Phase 2: 대시보드 My Work 강화

#### Backend 변경
- `packages/api/src/dashboard/dashboard.service.ts` — myIssues 쿼리 수정:
  - `take: 10` 제한 해제 → 전체 이슈 반환
  - 정렬 기준: dueDate(null은 뒤로) → priority → createdAt

#### Frontend 변경
- `packages/web/src/pages/DashboardPage.tsx` — My Issues 섹션 확장:
  - 오버듀 이슈 빨간 표시 (기존 `getDueBadge` 활용, 강조 스타일 추가)
  - 정렬 토글: "마감일순" / "우선순위순"
  - 전체 이슈 표시 (접기/펼치기 — 기본 펼침)
  - 이슈 클릭 시 해당 이슈 보드로 이동 (현재는 보드 홈으로만 이동)

---

### 영향 범위
- **서비스**: API, Web
- **신규 파일**: 8개 (API 6 + Web 2)
- **수정 파일**: 5개

| 파일 | 상태 | 변경 사유 |
|------|------|-----------|
| `packages/api/prisma/schema.prisma` | 수정 | IssueTemplate 모델 추가 |
| `packages/api/src/app.module.ts` | 수정 | TemplateModule 등록 |
| `packages/web/src/pages/ProjectsPage.tsx` | 수정 | Templates 탭 추가 |
| `packages/web/src/components/issue/CreateIssueModal.tsx` | 수정 | 템플릿 자동 채움 |
| `packages/web/src/pages/DashboardPage.tsx` | 수정 | My Work 강화 |
| `packages/api/src/dashboard/dashboard.service.ts` | 수정 | myIssues 제한 해제 |

### API 변경사항
- `GET /templates` — 신규
- `POST /templates` — 신규
- `PATCH /templates/:id` — 신규
- `DELETE /templates/:id` — 신규
- `GET /projects/:id/dashboard` — 기존 (myIssues 응답 변경: 전체 이슈 반환)

### 리스크 및 고려사항
- 템플릿은 글로벌이므로 별도 권한 없이 로그인 사용자 누구나 CRUD 가능 (추후 admin 전용으로 제한 가능)
- myIssues 제한 해제 시 이슈가 많은 프로젝트에서 응답 크기 증가 → 현재 규모에서는 문제 없음

### 예상 작업량
- 파일 수: 14개 (신규 8 + 수정 6)
- 복잡도: 낮음
