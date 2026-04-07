## 배포 보고

### 요약
- **배포 방식**: CI/CD (GitHub Actions)
- **브랜치**: `feat/attachments-delete-hierarchy-settings` → `main`
- **PR**: #3 (https://github.com/seo-burning/bb-project-management/pull/3)
- **CI 상태**: 전체 통과 (4m9s)
- **Run ID**: 24076906263

### 파이프라인 결과
| 단계 | 상태 | 소요 시간 |
|------|------|-----------|
| Deploy to Production | Pass | 4m9s |

### 배포 내용
1. S3 파일 업로드 인프라 (Attachment 모델, upload module)
2. 이슈/댓글 첨부파일 지원
3. 보드에서 이슈 삭제
4. 부모 이슈 선택 로직 개선
5. 프로젝트 생성 → Settings 이동
6. AWS S3 환경변수 배포 설정 추가
7. Nginx upload limit 55M 증가

### 환경변수 (GitHub Secrets 추가 필요)
- `AWS_S3_BUCKET` — S3 버킷명
- `AWS_S3_REGION` — S3 리전
- `AWS_ACCESS_KEY_ID` — AWS 액세스 키
- `AWS_SECRET_ACCESS_KEY` — AWS 시크릿 키

### 롤백 계획
- `git revert d7f71c0` → 새 PR → 머지로 롤백
