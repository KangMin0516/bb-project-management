# 기획서: Issue ↔ Specification 연결 (Requirement Traceability)

## 요구사항 요약

- 이슈에서 관련 FRS 문서(Specification)를 연결/해제할 수 있어야 한다
- 1단계: 문서 전체 레벨 연결 (섹션 레벨은 sectionSlug 문자열로 준비만)
- FRS 뷰어에서 연결된 이슈 목록을 확인할 수 있어야 한다
- 기존 Links 탭에 통합 표시

## 영향 범위

- **서비스**: API (NestJS), Web (React)

- **수정 파일**:
  - `packages/api/prisma/schema.prisma` — IssueSpecLink 모델 추가, Issue/Specification에 relation 추가
  - `packages/api/src/issue/issue.service.ts` — issue detail 조회 시 specLinks include
  - `packages/web/src/api/issues.ts` — IssueSpecLink 타입 + API 함수 추가
  - `packages/web/src/components/issue/LinkedIssues.tsx` — Spec Links 섹션 추가 (기존 Issue Links 아래)
  - `packages/web/src/components/issue/IssueDetailPanel.tsx` — Links 탭에 specLinks 전달
  - `packages/web/src/pages/SpecificationsPage.tsx` — FRS 뷰어에 연결된 이슈 뱃지 표시

- **신규 파일**:
  - `packages/api/src/issue/dto/create-issue-spec-link.dto.ts` — DTO
  - `packages/api/src/issue/issue-spec-link.controller.ts` — 컨트롤러 (CRUD endpoints)

## 데이터 모델

```prisma
model IssueSpecLink {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now()) @map("created_at")

  issueId     String        @map("issue_id")
  issue       Issue         @relation(fields: [issueId], references: [id], onDelete: Cascade)

  specId      String        @map("spec_id")
  spec        Specification @relation(fields: [specId], references: [id], onDelete: Cascade)

  sectionSlug String?       @db.VarChar(100) @map("section_slug")

  @@unique([issueId, specId, sectionSlug])
  @@index([issueId])
  @@index([specId])
  @@map("issue_spec_links")
}
```

- `sectionSlug`: FK가 아닌 문자열. 섹션 헤딩 slug를 저장. null이면 문서 전체 참조
- 마크다운 편집으로 섹션이 변경되어도 링크가 깨지지 않음 (soft reference)
- 1단계에서는 sectionSlug = null (문서 전체 연결)만 사용

## API 변경사항

### 신규 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/projects/:projectId/issues/:issueId/spec-links` | 이슈에 FRS 연결 |
| `DELETE` | `/projects/:projectId/issues/:issueId/spec-links/:linkId` | 연결 해제 |

### POST body
```json
{
  "specId": "uuid",
  "sectionSlug": null
}
```

### 기존 엔드포인트 변경

- `GET /projects/:projectId/issues/:issueId` — 응답에 `specLinks` 필드 추가
  ```json
  {
    "specLinks": [
      {
        "id": "link-uuid",
        "sectionSlug": null,
        "spec": { "id": "spec-uuid", "title": "FRS D: 로그인시스템", "status": "APPROVED", "category": "FRS" }
      }
    ]
  }
  ```

- `GET /projects/:projectId/specifications/:specId` — 응답에 `linkedIssues` 필드 추가
  ```json
  {
    "linkedIssues": [
      {
        "id": "link-uuid",
        "sectionSlug": null,
        "issue": { "id": "issue-uuid", "number": 12, "title": "카카오 로그인", "status": "IN_PROGRESS", "priority": "HIGH" }
      }
    ]
  }
  ```

## 구현 방안

### 1단계: DB 모델 + 마이그레이션
- `schema.prisma`에 IssueSpecLink 모델 추가
- Issue 모델에 `specLinks IssueSpecLink[]` relation 추가
- Specification 모델에 `issueLinks IssueSpecLink[]` relation 추가
- `npx prisma migrate dev` 실행

### 2단계: API (issue-spec-link)
- `create-issue-spec-link.dto.ts` — specId(required), sectionSlug(optional) 검증
- `issue.service.ts`에 createSpecLink / deleteSpecLink 메서드 추가
- `issue-spec-link.controller.ts` — POST, DELETE 엔드포인트
- issue.module에 controller 등록
- issue detail 조회 시 specLinks include 추가

### 3단계: Specification 서비스 수정
- `specification.service.ts`의 findOne에 linkedIssues include 추가

### 4단계: 프론트엔드 — 이슈 디테일
- `issues.ts` API 타입에 IssueSpecLink 추가 + createSpecLink, deleteSpecLink 함수
- `LinkedIssues.tsx`에 "Spec References" 섹션 추가:
  - 연결된 스펙 목록 표시 (문서 제목 + 상태 뱃지)
  - "Add Spec" 버튼 → 모달 (스펙 검색 + 선택)
  - Remove 버튼
- `IssueDetailPanel.tsx`에서 Links 탭으로 specLinks 전달

### 5단계: 프론트엔드 — FRS 뷰어
- `SpecificationsPage.tsx` 헤더 영역에 연결된 이슈 뱃지 표시
- 각 이슈 클릭 시 해당 프로젝트의 이슈로 이동 (또는 패널 열기)

## 리스크 및 고려사항

- **sectionSlug soft reference**: 섹션 이름 변경 시 slug가 달라져 연결 매칭이 안 될 수 있음 → 1단계에서는 문서 전체 연결만 사용하므로 해당 없음
- **중복 방지**: `@@unique([issueId, specId, sectionSlug])`로 동일 연결 중복 차단
- **Cascade 삭제**: 이슈 또는 스펙 삭제 시 링크도 자동 삭제
- **권한**: 기존 ProjectMemberGuard 재사용 — 프로젝트 멤버만 연결 가능

## 예상 작업량

- 파일 수: 8개 (수정 6 + 신규 2)
- 복잡도: 낮음 (기존 IssueLink 패턴과 거의 동일)
