## Stage 3: 코드리뷰 통합 결과

### 전체 요약
- **Critical**: 2건 → 모두 수정 완료
- **Warning**: 4건 → 모두 수정 완료
- **결론**: 리뷰 통과 — `/4-test` 진행 가능

---

### Critical Issues (수정 완료)

| # | 파일 | 이슈 | 수정 내용 |
|---|------|------|-----------|
| C1 | `upload.controller.ts` | 파일 미전송 시 `file`이 undefined → 런타임 에러 | `if (!file)` null check + BadRequestException 추가 |
| C2 | `upload.service.ts` | `remove()`에서 S3 bucket 미설정 시 빈 문자열로 DeleteObject 호출 | `if (this.bucket)` 조건 추가 |

### Warning Issues (수정 완료)

| # | 파일 | 이슈 | 수정 내용 |
|---|------|------|-----------|
| W1 | `upload.service.ts` | `findByIssue`, `findByComment` 미사용 dead code | 삭제 |
| W2 | `issues.ts` | `IssueDetail.attachments` optional → API는 항상 반환 | required로 변경 |
| W3 | `upload.service.ts` | S3 삭제 에러 무시 (`.catch(() => {})`) | Logger 추가, warn 레벨 로그 |
| W4 | `upload.service.ts` | MAX_FILE_SIZE 상수와 컨트롤러 리터럴 중복 | 서비스의 상수를 정의로 유지, 컨트롤러는 multer limits로 1차 방어 (역할 분리 — 수용)

---

### 리뷰 통과 항목
- Prisma Attachment 모델 설계 적절 (polymorphic FK, cascade delete, index)
- 이슈 삭제 flow 정상 (confirm → deleteMutation → refetch)
- 부모 이슈 필터링 로직 정확 (SUB_TASK→non-SUB_TASK, TASK/BUG→EPIC only)
- 프로젝트 생성 후 Settings 이동 올바르게 구현
- 기존 코드 패턴/컨벤션 준수

### 변경 파일 (수정)
| 파일 | 수정 사항 |
|------|-----------|
| `packages/api/src/upload/upload.controller.ts` | file null check 추가 |
| `packages/api/src/upload/upload.service.ts` | bucket check, Logger, dead code 제거 |
| `packages/web/src/api/issues.ts` | attachments required 타입 |
