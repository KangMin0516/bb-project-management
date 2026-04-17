# Stage 5: 배포 보고서 — Thu's 3 Bug/Feature Requests

## 배포 정보

| 항목 | 내용 |
|------|------|
| PR | #26 (`feat/thu-feedback-subtask-title-avatar` → `main`) |
| 커밋 | `feat: subtask inherits parent status, inline title edit, avatar upload` |
| CI/CD | GitHub Actions — Deploy workflow |
| Run ID | 24381817797 |
| 소요 시간 | 1m 25s |
| 상태 | **Success** |
| 배포 시각 | 2026-04-14 05:00:52 UTC |
| 대상 서버 | pm.burningbros.kr (160.191.46.156) |

## 변경 파일 요약 (13개)

| 파일 | 변경 유형 |
|------|-----------|
| `packages/api/src/auth/dto/update-profile.dto.ts` | 신규 |
| `packages/api/src/auth/dto/index.ts` | 수정 |
| `packages/api/src/auth/auth.controller.ts` | 수정 (PATCH /auth/profile) |
| `packages/api/src/auth/auth.service.ts` | 수정 (updateProfile 메서드) |
| `packages/api/src/upload/upload.controller.ts` | 수정 (POST /upload/avatar) |
| `packages/api/src/upload/upload.service.ts` | 수정 (uploadAvatar 메서드) |
| `packages/web/src/api/auth.ts` | 수정 (updateProfile, uploadAvatar API) |
| `packages/web/src/stores/auth.ts` | 수정 (uploadAvatar action) |
| `packages/web/src/components/layout/AppLayout.tsx` | 수정 (아바타 업로드 UI) |
| `packages/web/src/components/filter/FilterBar.tsx` | 수정 (아바타 이미지 표시) |
| `packages/web/src/components/board/IssueCard.tsx` | 수정 (아바타 이미지 표시) |
| `packages/web/src/components/issue/IssueDetailPanel.tsx` | 수정 (subtask status + 타이틀 편집) |
| `packages/web/src/pages/SettingsPage.tsx` | 수정 (멤버 아바타 표시) |

## 기능 요약

1. **Subtask 상태 상속**: 부모 Task의 현재 status를 subtask 생성 시 자동 적용
2. **타이틀 인라인 편집**: 클릭 → input 전환, Enter/blur 저장, Escape 취소
3. **아바타 업로드**: 사이드바에서 클릭 업로드 + 앱 전체 아바타 이미지 표시

## 다음 단계

`/6-verify` — 프로덕션 환경에서 기능 검증
