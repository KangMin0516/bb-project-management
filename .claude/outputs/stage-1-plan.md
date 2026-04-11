# 기획서: 스펙 섹션 강화 — 댓글 UX + 섹션 레벨 이슈 연결

## 요구사항 요약

1. **댓글 패널 필터 시각화**: 현재 적용 중인 섹션 필터를 댓글 패널 헤더에 칩(chip)으로 표시 + 해제 버튼
2. **댓글→섹션 스크롤**: 댓글 패널에서 섹션 뱃지 클릭 시 본문의 해당 섹션으로 스크롤
3. **이슈↔스펙 섹션 레벨 연결**: LinkSpecModal에서 스펙 선택 후 섹션까지 선택 가능
4. **스펙 본문 섹션에 연결 이슈 표시**: 각 헤딩 옆에 연결된 이슈 뱃지(번호+상태) 표시
5. **양방향 클릭 네비게이션**: 이슈 디테일→스펙 페이지(섹션 포커스), 스펙 섹션→이슈 디테일

## 현재 구현 상태 (이미 있는 것)

- SpecContent.tsx: TOC에 섹션별 미해결 댓글 수 뱃지 ✅
- SpecContent.tsx: 헤딩 hover → 댓글 아이콘 + 클릭 시 필터 토글 ✅
- SpecCommentPanel.tsx: filterSection prop으로 필터링 ✅
- SpecCommentPanel.tsx: "Clear filter" 텍스트 링크 ✅
- IssueSpecLink: sectionSlug 필드 존재 (DB/API) ✅
- IssueSpecLink: 프론트에서 sectionSlug 미사용 (항상 빈 문자열) ❌

## 영향 범위

- **서비스**: Web (프론트엔드)
- **수정 파일**:
  - `packages/web/src/components/spec/SpecContent.tsx` — 섹션에 연결 이슈 뱃지 추가
  - `packages/web/src/components/spec/SpecCommentPanel.tsx` — 필터 칩 UI, 섹션 클릭→본문 스크롤 콜백
  - `packages/web/src/pages/SpecificationsPage.tsx` — scrollToSection 콜백 전달, 네비게이션 핸들러
  - `packages/web/src/components/issue/LinkedIssues.tsx` — LinkSpecModal에 섹션 선택 단계 추가, 스펙 링크 클릭→네비게이션
- **신규 파일**: 없음

## 구현 방안

### 1단계: 댓글 패널 필터 시각화 + 스크롤

**SpecCommentPanel.tsx:**
- 헤더에 `filterSection`이 있을 때 섹션명 칩(chip) 표시 (배경색 + X 버튼으로 해제)
- 기존 "Clear filter" 텍스트를 칩으로 대체

**SpecificationsPage.tsx:**
- `scrollToSection` 콜백을 SpecCommentPanel에 전달
- 댓글의 섹션 뱃지 클릭 시: (1) 필터 적용 + (2) 본문 스크롤

**SpecContent.tsx:**
- `scrollToSection`을 외부에서 호출할 수 있도록 ref 또는 콜백 패턴 제공
- 현재 이미 `scrollToSection` 함수가 있으나 내부에서만 사용 → 부모로 노출

### 2단계: 이슈↔스펙 섹션 레벨 연결

**LinkedIssues.tsx (LinkSpecModal 수정):**
- 현재: 스펙 선택 → 바로 링크 생성
- 변경: 스펙 선택 → 해당 스펙의 섹션 목록 표시 → "전체 스펙" 또는 특정 섹션 선택 → 링크 생성
- 2단계 UI: Step 1(스펙 선택) → Step 2(섹션 선택, "Entire spec" 옵션 포함)
- `createSpecLink` 호출 시 `sectionSlug` 전달

**SpecLinkItem (LinkedIssues.tsx):**
- `sectionSlug`이 있으면 스펙 제목 옆에 `§ 섹션명` 표시
- 클릭 시 `/projects/:projectId/specs`로 이동 + 해당 스펙 선택 + 섹션 스크롤

**API 변경**: 없음 (sectionSlug 이미 지원, spec.sections 이미 include 가능)

단, LinkSpecModal에서 선택한 스펙의 섹션 목록이 필요 → `specApi.get(projectId, specId)`로 sections 조회

### 3단계: 스펙 본문 섹션에 연결 이슈 표시

**SpecContent.tsx:**
- props에 `issueLinks` 추가 (SpecDetail.issueLinks)
- sectionSlug별로 그룹핑하여 각 헤딩 옆에 이슈 뱃지 표시
- 이슈 뱃지: `[PITB-42]` 형식, 상태 색상 dot, 클릭 시 이슈 페이지로 이동

**SpecificationsPage.tsx:**
- `detail.issueLinks`를 SpecContent에 전달

### 4단계: 양방향 네비게이션

**이슈→스펙 (LinkedIssues.tsx):**
- SpecLinkItem 클릭 시 `react-router`의 `useNavigate`로 스펙 페이지 이동
- URL에 query param으로 섹션 지정: `/projects/:id/specs?specId=xxx&section=yyy`

**스펙→이슈 (SpecContent.tsx):**
- 이슈 뱃지 클릭 시 이슈 페이지로 이동: `/projects/:id/issues?issue=xxx`
- 또는 현재 보드 뷰에서 이슈 디테일 패널 열기

**SpecificationsPage.tsx:**
- URL query param에서 `specId`, `section` 파싱 → 자동 선택 + 스크롬

## API 변경사항

없음. 기존 API만 활용:
- `GET /specifications/:specId` — sections, issueLinks 이미 포함
- `POST /spec-links` — sectionSlug 이미 지원

## 리스크 및 고려사항

- **섹션 slug 변경**: 마크다운 헤딩을 수정하면 sectionSlug가 변경됨 → 기존 링크가 깨질 수 있음 (이미 설계 시 soft reference로 결정, 표시만 fallback)
- **성능**: LinkSpecModal에서 스펙 선택 후 섹션 조회를 위한 추가 API 호출 1회 → 이미 캐시된 경우 빠름

## 예상 작업량

- 파일 수: 4개 수정
- 복잡도: 보통
