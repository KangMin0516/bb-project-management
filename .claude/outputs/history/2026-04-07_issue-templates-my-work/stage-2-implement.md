## 구현 보고서: 이슈 템플릿 + 대시보드 My Work 강화

### Phase 1: 이슈 템플릿

#### 신규 파일
- `packages/api/prisma/migrations/20260407104939_add_issue_template/migration.sql` — 마이그레이션
- `packages/api/src/template/template.service.ts` — CRUD 서비스
- `packages/api/src/template/template.controller.ts` — REST 컨트롤러 (GET/POST/PATCH/DELETE /templates)
- `packages/api/src/template/template.module.ts` — NestJS 모듈
- `packages/api/src/template/dto/create-template.dto.ts` — 생성 DTO (name, type, description)
- `packages/api/src/template/dto/update-template.dto.ts` — 수정 DTO
- `packages/web/src/api/templates.ts` — API 클라이언트 + 타입
- `packages/web/src/components/template/TemplateManager.tsx` — 템플릿 CRUD 관리 UI

#### 수정 파일
- `packages/api/prisma/schema.prisma` — IssueTemplate 모델 + User relation 추가
- `packages/api/src/app.module.ts` — TemplateModule 등록
- `packages/web/src/pages/ProjectsPage.tsx` — Projects | Templates 탭 추가
- `packages/web/src/components/issue/CreateIssueModal.tsx` — 타입 변경 시 템플릿 description 자동 채움

### Phase 2: 대시보드 My Work 강화

#### 수정 파일
- `packages/api/src/dashboard/dashboard.service.ts` — myIssues: take:10 제한 해제, dueDate nulls last 정렬
- `packages/web/src/pages/DashboardPage.tsx` — My Issues 섹션 확장:
  - 오버듀 이슈 빨간 배경 + 빨간 텍스트 강조
  - 정렬 토글 (Due Date / Priority)
  - 전체 이슈 표시 (10개 제한 해제)
  - My Issues 카운트 카드 추가 (오버듀 수 포함)

### 자체 점검
- [x] TypeScript 컴파일: API, Web 모두 에러 없음
- [x] Vite 빌드 성공
- [x] import 경로 정확 (.js 확장자)
- [x] 기존 코드 패턴과 일관성 유지
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음

### 변경 파일 (14개)
| 파일 | 상태 |
|------|------|
| `packages/api/prisma/schema.prisma` | 수정 |
| `packages/api/prisma/migrations/20260407104939_add_issue_template/` | 신규 |
| `packages/api/src/template/template.service.ts` | 신규 |
| `packages/api/src/template/template.controller.ts` | 신규 |
| `packages/api/src/template/template.module.ts` | 신규 |
| `packages/api/src/template/dto/create-template.dto.ts` | 신규 |
| `packages/api/src/template/dto/update-template.dto.ts` | 신규 |
| `packages/api/src/app.module.ts` | 수정 |
| `packages/api/src/dashboard/dashboard.service.ts` | 수정 |
| `packages/web/src/api/templates.ts` | 신규 |
| `packages/web/src/components/template/TemplateManager.tsx` | 신규 |
| `packages/web/src/pages/ProjectsPage.tsx` | 수정 |
| `packages/web/src/components/issue/CreateIssueModal.tsx` | 수정 |
| `packages/web/src/pages/DashboardPage.tsx` | 수정 |
