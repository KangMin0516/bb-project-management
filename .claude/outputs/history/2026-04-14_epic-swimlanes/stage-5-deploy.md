# Stage 5: 배포 보고서 — Epic Swimlanes Board View

## 배포 정보

| 항목 | 내용 |
|------|------|
| PR | #25 (`feat/epic-swimlanes` → `main`) |
| 커밋 | `feat: add Epic Swimlanes board view with drag-and-drop support` |
| CI/CD | GitHub Actions — Deploy workflow |
| Run ID | 24376951349 |
| 소요 시간 | 2m 15s |
| 상태 | **Success** |
| 배포 시각 | 2026-04-14 02:02:37 UTC |
| 대상 서버 | pm.burningbros.kr (160.191.46.156) |

## 변경 파일 요약

| 파일 | 변경 유형 |
|------|-----------|
| `packages/web/src/components/board/SwimlaneBoardView.tsx` | 신규 |
| `packages/web/src/components/board/SwimlaneRow.tsx` | 신규 |
| `packages/web/src/components/board/types.ts` | 신규 |
| `packages/web/src/components/board/IssueCard.tsx` | 수정 (compact prop) |
| `packages/web/src/pages/BoardPage.tsx` | 수정 (swimlane 통합) |
| `packages/web/src/lib/constants.ts` | 수정 (상수 추가) |

## 기능 요약

- Board 페이지에 "Group: Epic" 토글 버튼 추가
- Epic별 Swimlane 행으로 이슈를 그룹화하여 표시
- 각 Swimlane 내 상태별 컬럼 + 드래그앤드롭 지원
- Epic 진행률 프로그레스 바 (Done/Total)
- Swimlane 접기/펼치기
- 기존 필터(담당자, 라벨, 컴포넌트, 검색 등)와 완전 호환
- 크로스 Epic 드래그 차단 (데이터 정합성 보장)

## 다음 단계

`/6-verify` — 프로덕션 환경에서 기능 검증
