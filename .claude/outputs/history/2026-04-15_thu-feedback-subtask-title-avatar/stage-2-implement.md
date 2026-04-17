# 구현 완료 보고: 글로벌 대시보드

## 변경 파일 목록

### 신규 파일
- `packages/api/src/dashboard/global-dashboard.controller.ts` — `GET /dashboard/my` 엔드포인트
- `packages/web/src/pages/GlobalDashboardPage.tsx` — 글로벌 대시보드 페이지

### 수정 파일
- `packages/api/src/dashboard/dashboard.service.ts` — `getMyGlobalDashboard()` 메서드 추가
- `packages/api/src/dashboard/dashboard.module.ts` — GlobalDashboardController 등록
- `packages/web/src/api/dashboard.ts` — `GlobalDashboard` 타입 + `getMyDashboard()` API 추가
- `packages/web/src/App.tsx` — 라우트 변경 (`/` → GlobalDashboardPage, `/projects` → ProjectsPage)
- `packages/web/src/components/layout/AppLayout.tsx` — Home 링크 항상 표시, 사이드바 네비 구조 변경

## 주요 변경사항

1. **백엔드 API**: `GET /dashboard/my` — JWT 인증만으로 접근, 전체 프로젝트 통합 데이터 반환
   - 참여 프로젝트 목록 + 요약 (이슈수, 완료율, 내 이슈수)
   - 전체 프로젝트의 포커스 이슈 (Today's Focus)
   - 전체 프로젝트의 내 이슈 (미완료)
   - 전체 프로젝트의 오버듀 이슈

2. **글로벌 대시보드 페이지**: 포커스 중심 레이아웃
   - Today's Focus (Working Now / Planned Today)
   - Overdue Alert
   - My Issues (프로젝트별 그룹핑 + 필터 탭 + 정렬)
   - Project Summary Cards (진행률 바)

3. **라우트 변경**: `/` 루트를 글로벌 대시보드로 교체, 기존 ProjectsPage → `/projects`

4. **사이드바**: Home 링크가 항상 표시, 프로젝트 네비와 구분선으로 분리

## 자체 점검
- [x] 타입 오류 없음 (프론트엔드 tsc --noEmit 통과)
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성 (Tailwind, React Query, Prisma 패턴 동일)
- [x] 기획서 모든 항목 구현 완료
- [x] 불필요한 변경 없음
