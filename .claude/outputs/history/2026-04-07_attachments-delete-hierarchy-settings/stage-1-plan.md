## 기획서: 4가지 기능/버그 수정

### 요구사항 요약

**기능 1 — 파일 첨부 (이미지/비디오/모든 파일)**
- AWS S3에 파일 저장 (최대 50MB, 모든 파일 타입)
- 이슈 설명 + 댓글 모두에 첨부 가능
- 이미지/비디오는 인라인 미리보기, 기타 파일은 다운로드 링크

**기능 2 — 보드에서 이슈 삭제**
- 이슈 상세 패널에 삭제 버튼 추가
- 확인 다이얼로그 후 삭제 (백엔드 API는 이미 구현됨)

**기능 3 — 부모 이슈 선택 로직 개선**
- SUB_TASK 선택 시: 모든 이슈(EPIC, TASK, BUG)를 부모로 선택 가능
- TASK/BUG 선택 시: EPIC만 부모로 선택 가능
- EPIC 선택 시: 부모 선택 불가 (이미 구현됨)

**기능 4 — 프로젝트 생성 후 Settings 자동 이동**
- 프로젝트 생성 완료 후 Settings 페이지로 자동 이동하여 멤버 추가 유도

---

### 영향 범위

- **서비스**: Backend (API), Frontend (Web), Database (Prisma), AWS S3
- **수정 파일**:
  - `packages/api/prisma/schema.prisma` — Attachment 모델 추가
  - `packages/api/src/issue/issue.controller.ts` — 파일 업로드 엔드포인트
  - `packages/api/src/issue/issue.service.ts` — 첨부파일 CRUD
  - `packages/api/src/comment/comment.controller.ts` — 댓글 첨부파일 엔드포인트
  - `packages/api/src/comment/comment.service.ts` — 댓글 첨부파일 CRUD
  - `packages/web/src/pages/BoardPage.tsx` — 삭제 버튼 추가
  - `packages/web/src/components/issue/CreateIssueModal.tsx` — 부모 선택 필터 수정
  - `packages/web/src/pages/NewProjectPage.tsx` — 생성 후 Settings로 이동
- **신규 파일**:
  - `packages/api/src/upload/upload.module.ts` — S3 업로드 모듈
  - `packages/api/src/upload/upload.service.ts` — S3 업로드 서비스
  - `packages/api/src/upload/upload.controller.ts` — 업로드 엔드포인트
  - `packages/api/prisma/migrations/XXXXXX_add_attachment/` — 마이그레이션

---

### 구현 방안

#### Phase 1: S3 파일 업로드 인프라

1. `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` 설치
2. Prisma Attachment 모델 추가:
   ```
   model Attachment {
     id         String   @id @default(uuid())
     fileName   String
     fileSize   Int
     mimeType   String
     url        String
     issueId    String?
     commentId  String?
     uploaderId String
     createdAt  DateTime @default(now())
   }
   ```
3. Upload 모듈/서비스/컨트롤러 생성:
   - `POST /upload` — multer로 파일 수신, S3 업로드, Attachment 레코드 생성
   - Presigned URL 또는 직접 업로드 방식
4. S3 환경변수: `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

#### Phase 2: 이슈/댓글에 첨부파일 연결

1. 이슈 상세 조회 시 attachments 포함
2. 댓글 조회 시 attachments 포함
3. 프론트엔드 파일 업로드 UI:
   - 드래그&드롭 또는 클릭으로 파일 선택
   - 업로드 진행률 표시
   - 이미지/비디오 인라인 미리보기
   - 기타 파일 아이콘 + 다운로드 링크

#### Phase 3: 보드에서 이슈 삭제

1. 이슈 상세 패널에 삭제 버튼 추가 (Trash2 아이콘)
2. `confirm()` 다이얼로그로 확인
3. `issueApi.delete()` 호출 후 보드 데이터 refetch
4. 백엔드 삭제 API는 이미 존재 (`DELETE /projects/:projectId/issues/:issueId`)

#### Phase 4: 부모 이슈 선택 로직 개선

현재: 모든 non-SUB_TASK 이슈를 부모 옵션으로 표시
변경:
1. `type === 'SUB_TASK'`: 부모 옵션에 EPIC, TASK, BUG 모두 표시 (현재와 동일)
2. `type === 'TASK' || type === 'BUG'`: 부모 옵션에 **EPIC만** 표시
3. `type === 'EPIC'`: 부모 선택 불가 (이미 구현됨)

수정 위치: `CreateIssueModal.tsx`의 부모 필터링 로직

#### Phase 5: 프로젝트 생성 후 Settings 이동

1. `NewProjectPage.tsx`에서 생성 완료 후 `/projects/${id}/settings`로 navigate
2. 현재 `/projects/${id}/board`로 이동하는 부분 수정

---

### API 변경사항

| Method | Endpoint | Auth | 설명 |
|--------|----------|------|------|
| POST | `/upload` | Bearer | 파일 업로드 (multipart/form-data), issueId/commentId 옵션 |
| DELETE | `/upload/:id` | Bearer | 첨부파일 삭제 |
| GET | `/projects/:pid/issues/:iid` | Bearer | 변경: attachments 포함 |
| GET | `/projects/:pid/issues/:iid/comments` | Bearer | 변경: comment.attachments 포함 |

---

### 리스크 및 고려사항

1. **AWS S3 설정 필요**: 버킷 생성, IAM 권한, CORS 설정. 환경변수를 deploy.yml과 docker-compose에 추가해야 함
2. **파일 크기 제한**: 50MB까지 허용하므로 Nginx/Traefik의 client_max_body_size 확인 필요
3. **Phase 3 (삭제)**: 자식 이슈가 있는 경우 cascade 삭제됨 — 사용자 경고 필요
4. **Phase 4 (부모 선택)**: 이슈 생성 모달에서만 수정. 이슈 수정 시에도 동일 로직 적용 필요

### 예상 작업량

- 파일 수: 약 15개 (수정 8 + 신규 7)
- 복잡도: **보통~높음** (S3 인프라가 핵심 난이도)
