# Stage 3: 코드리뷰 결과 — Team Dashboard

## Step 1: 기능 리뷰

### 요약
- **승인 여부**: 수정 필요 → **수정 완료 후 승인**
- **심각도**: 보통
- **검토 파일 수**: 8개

### [Critical] — 수정 완료
1. **React Hook 규칙 위반** (`TeamDashboardPage.tsx:32-34`) — 조건부 return 이후 `useQuery` 호출
   - `useQuery`를 early return 전으로 이동, `enabled: !!currentUser?.isSuperuser` 추가
   - **✅ 즉시 수정 완료**

### [Warning] 수정 권장 (다음 이터레이션)
1. DB 캐싱 없음 — 10개 병렬 쿼리에 대한 서버 측 캐싱 고려
2. 히트맵 프로젝트 목록이 멤버십 기반으로만 수집됨 — 멤버십 없이 할당된 프로젝트 누락 가능
3. `member.user.name`이 null일 때 `.charAt(0)` crash 가능

### [Info] 참고
- `refetchInterval`에 `refetchIntervalInBackground: false` 추가 권장
- `getMemberStatus()` sort 내 재계산 — 멤버 수 적어 현재는 문제 없음

### 긍정적 사항
- Promise.all 10개 쿼리 병렬화, Map 기반 O(1) lookup
- SuperuserGuard + 프론트엔드 이중 보호
- 타입 안전성, 빈 상태 처리 적절

---

## Step 2: CTO 리뷰

### 유지보수성 점수: 7/10
- 가독성: 7/10
- 일관성: 8/10
- 확장성: 6/10
- 테스트 용이성: 5/10

### [Refactor] 리팩토링 필요 (다음 이터레이션)
1. `getTeamDashboard()` 207줄 → 서브 메서드 분할 권장 (`fetchTeamRawData`, `buildTeamLookups` 등)
2. `todayStart`/`todayEnd` 날짜 계산 DRY 위반 (3곳 중복) → `getTodayRange()` 추출
3. `KpiCard`, `MemberCard`, `Stat` 컴포넌트 별도 파일 분리 권장

### [Convention] 컨벤션 위반
1. **React Hook 규칙 위반** — ✅ 즉시 수정 완료
2. 이모지(`🔄`, `✅`, `⚠️`) vs Lucide 아이콘 혼용 — 다음 이터레이션에서 통일

### [Smell] 코드 스멜
1. `getMemberStatus()` 내 매직 넘버 (15, 2) → 상수 추출 권장
2. 프론트/백 타입 수동 동기화 — 기존 패턴과 동일한 기술 부채

### [Good] 잘된 점
1. Promise.all 10개 쿼리 병렬 — N+1 없음
2. 기존 컨벤션(컨트롤러 구조, import 순서) 잘 준수
3. WorkloadHeatmap 별도 컴포넌트 분리
4. useMemo 활용한 검색/정렬 최적화
5. 빈 상태/엣지 케이스 적절히 처리

### 종합 의견
기존 패턴을 잘 따르며 기능적 완성도가 높음. Critical 1건(Hook 위반)은 즉시 수정 완료. Warning/Refactor 항목들은 다음 이터레이션에서 점진적 개선 가능.

---

## 판정: ✅ `/4-test` 진행 가능
- Critical 0건 (1건 수정 완료)
- Warning만 남아 있으며, 모두 다음 이터레이션에서 개선 가능한 수준
