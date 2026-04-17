# 구현 완료 보고: 스펙 섹션 강화

## 변경 파일 목록

- `packages/web/src/components/spec/SpecContent.tsx` — forwardRef 전환, issueLinks prop, 섹션별 이슈 뱃지, scrollToSection 노출
- `packages/web/src/components/spec/SpecCommentPanel.tsx` — 필터 칩 UI, filterSectionTitle/onClearFilter/onScrollToSection props
- `packages/web/src/pages/SpecificationsPage.tsx` — URL params(specId/section), SpecContent ref, 네비게이션 핸들러
- `packages/web/src/components/issue/LinkedIssues.tsx` — LinkSpecModal 2단계 UI, SpecLinkItem 클릭 네비게이션, sectionSlug 표시

## 주요 변경사항

### 1. 댓글 필터 시각화 + 스크롤
- 댓글 패널 헤더에 필터 칩(chip) 표시: 섹션명 + X 해제 버튼
- 댓글의 섹션 뱃지 클릭 → 필터 적용 + 본문 해당 섹션으로 스크롤
- SpecContent를 forwardRef로 전환, scrollToSection을 imperative handle로 노출

### 2. 이슈↔스펙 섹션 레벨 연결
- LinkSpecModal: Step 1(스펙 선택) → Step 2(섹션 선택) 2단계 UI
- "Entire specification" 옵션 + 개별 섹션 목록 (레벨별 들여쓰기)
- createSpecLink 호출 시 sectionSlug 전달

### 3. 스펙 본문 섹션에 연결 이슈 표시
- issueLinks를 sectionSlug별 그룹핑
- 각 헤딩 옆에 이슈 뱃지(#번호 + 상태 dot) 표시
- 뱃지 클릭 → 이슈 페이지로 이동

### 4. 양방향 클릭 네비게이션
- SpecLinkItem 클릭 → `/projects/:id/specs?specId=xxx&section=yyy`
- 이슈 뱃지 클릭 → `/projects/:id/issues?issue=xxx`
- URL params에서 specId/section 파싱 → 자동 선택 + 스크롤

## 자체 점검

- [x] 타입 오류 없음 (Web 통과)
- [x] import 경로 정확
- [x] 기존 코드 패턴과 일관성
- [x] 기획서의 모든 항목 구현 완료
- [x] 불필요한 변경 없음
- [x] API 변경 없음 (기존 API만 활용)
