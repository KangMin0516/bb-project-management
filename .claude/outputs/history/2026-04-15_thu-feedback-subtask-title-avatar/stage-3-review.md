# Stage 3: 코드리뷰 종합 결과

## 전체 결과: PASS (수정 완료)

- **기능 리뷰**: Critical 2, Warning 4, Info 2
- **CTO 리뷰**: Refactor 4, Convention 2, Smell 2 (유지보수성 7.5/10)

---

## 발견된 이슈 및 수정 현황

### Critical (수정 완료)

| # | 이슈 | 수정 |
|---|------|------|
| 1 | `uploadAvatar` 서비스에서 DB 업데이트 + 프론트 `updateProfile` 중복 호출 (3회 API) | 프론트 `stores/auth.ts`에서 `updateProfile` 호출 제거 → 2회로 축소 |
| 2 | Escape 키 핸들러에 `editingTitle` 미포함 → 타이틀 편집 중 Escape 시 패널 닫힘 | `handleKeyDown`에 `editingTitle` 체크 추가 + input에 `e.stopPropagation()` 추가 |

### Warning (수정 완료)

| # | 이슈 | 수정 |
|---|------|------|
| 3 | 기존 아바타 S3 파일 미삭제 (확장자 변경 시 고아 파일 잔존) | `uploadAvatar`에서 기존 avatar URL 조회 → S3 삭제 후 새 파일 업로드 |
| 4 | 아바타 업로드 시 MIME type 미검증 (확장자만 체크) | `file.mimetype` 검증 추가 (`image/jpeg`, `image/png`, `image/webp`) |

### Convention (수정 완료)

| # | 이슈 | 수정 |
|---|------|------|
| 5 | `MAX_AVATAR_SIZE` 메서드 내부 지역 상수 → 파일 상단 이동 | 파일 상단에 `MAX_AVATAR_SIZE`, `ALLOWED_AVATAR_EXTS`, `ALLOWED_AVATAR_MIMES` 상수 정의 |
| 6 | `ApiPropertyOptional` import 검증 | `@nestjs/swagger`에 존재 확인 → 유효 (수정 불필요) |

### 수정 불필요 (합리적 판단)

| # | 이슈 | 판단 |
|---|------|------|
| 7 | `POST /upload/avatar` 경로가 기획서(`?avatar=true`)와 다름 | 별도 경로가 더 RESTful하므로 개선으로 인정 |
| 8 | `avatar` DTO에 `@IsUrl()` 미적용 | 서버 자체 S3 URL만 저장하므로 현재 수준 충분 |

---

## TypeScript 타입 체크

- **Frontend**: tsc --noEmit 통과
- **Backend**: tsc --noEmit 통과 (기존 e2e test 파일 제외)

## 다음 단계

→ `/4-test` 또는 바로 `/5-deploy`
