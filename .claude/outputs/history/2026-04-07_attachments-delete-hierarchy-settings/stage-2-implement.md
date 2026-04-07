## 구현 보고서: 4가지 기능/버그 수정

### Phase 1: S3 파일 업로드 인프라
- `packages/api/prisma/schema.prisma` — Attachment 모델 추가 (Issue, Comment, User 관계)
- `packages/api/prisma/migrations/20260407060000_add_attachment/migration.sql` — 마이그레이션 SQL
- `packages/api/src/upload/upload.service.ts` — S3 업로드/삭제, Attachment CRUD
- `packages/api/src/upload/upload.controller.ts` — POST /upload, DELETE /upload/:id
- `packages/api/src/upload/upload.module.ts` — UploadModule
- `packages/api/src/app.module.ts` — UploadModule 등록
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer` 패키지 설치

### Phase 2: 이슈/댓글 첨부파일 연결
- `packages/api/src/issue/issue.service.ts` — findOne에 attachments include 추가
- `packages/api/src/comment/comment.service.ts` — 모든 include에 attachments 추가
- `packages/web/src/api/issues.ts` — Attachment 타입, uploadApi 추가
- `packages/web/src/pages/BoardPage.tsx` — 이슈 상세 패널에 첨부파일 섹션 추가
  - 파일 업로드 (클릭), 이미지/비디오 미리보기, 삭제 기능
  - AttachmentItem 컴포넌트

### Phase 3: 보드에서 이슈 삭제
- `packages/web/src/pages/BoardPage.tsx` — 이슈 상세 패널 헤더에 삭제 버튼 추가
  - confirm() 다이얼로그 후 삭제
  - deleteMutation으로 API 호출, 보드 refetch

### Phase 4: 부모 이슈 선택 로직 개선
- `packages/web/src/components/issue/CreateIssueModal.tsx` — parentOptions 필터 수정
  - SUB_TASK: 모든 non-SUB_TASK 이슈 표시
  - TASK/BUG: EPIC만 표시
  - 타입 변경 시 parentId 초기화

### Phase 5: 프로젝트 생성 후 Settings 이동
- `packages/web/src/pages/NewProjectPage.tsx` — navigate 대상을 /board → /settings로 변경

### 자체 점검
- [x] TypeScript 컴파일: API, Web 모두 에러 없음
- [x] import 경로 정확 (.js 확장자)
- [x] 기존 코드 패턴과 일관성 유지
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음

### 변경 파일 (13개)
| 파일 | 상태 |
|------|------|
| `packages/api/prisma/schema.prisma` | 수정 |
| `packages/api/prisma/migrations/20260407060000_add_attachment/migration.sql` | 신규 |
| `packages/api/src/upload/upload.service.ts` | 신규 |
| `packages/api/src/upload/upload.controller.ts` | 신규 |
| `packages/api/src/upload/upload.module.ts` | 신규 |
| `packages/api/src/app.module.ts` | 수정 |
| `packages/api/src/issue/issue.service.ts` | 수정 |
| `packages/api/src/comment/comment.service.ts` | 수정 |
| `packages/web/src/api/issues.ts` | 수정 |
| `packages/web/src/pages/BoardPage.tsx` | 수정 |
| `packages/web/src/components/issue/CreateIssueModal.tsx` | 수정 |
| `packages/web/src/pages/NewProjectPage.tsx` | 수정 |

### 환경변수 필요 (배포 시)
- `AWS_S3_BUCKET` — S3 버킷명
- `AWS_S3_REGION` — S3 리전 (기본: ap-northeast-2)
- `AWS_ACCESS_KEY_ID` — AWS 액세스 키
- `AWS_SECRET_ACCESS_KEY` — AWS 시크릿 키
