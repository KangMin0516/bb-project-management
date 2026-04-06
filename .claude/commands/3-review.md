# Stage 3: 코드리뷰 (2-Step Review Pipeline)

코드리뷰를 2단계 Task 에이전트로 수행합니다.

## 실행 모드: Task 에이전트 생성

**컨텍스트 분리를 위해 반드시 Task 에이전트를 생성하세요.**

### 실행 절차

1. `.claude/config.md`를 읽어서 프로젝트 정보를 파악하세요
2. `.claude/outputs/stage-2-implement.md`를 읽어서 구현 내용을 확인하세요

3. **Step 1: 기능 리뷰** — Task 에이전트 생성:
   ```
   Task(subagent_type=general-purpose)
   prompt: ".claude/agents/code-reviewer.md 파일을 읽고 그 역할에 따라 최근 변경사항을 리뷰하세요."
   ```

4. **Step 2: CTO 리뷰** — Task 에이전트 생성:
   ```
   Task(subagent_type=general-purpose)
   prompt: ".claude/agents/cto.md 파일을 읽고 그 역할에 따라 최근 변경사항을 리뷰하세요."
   ```

5. 두 리뷰 결과를 종합하여 사용자에게 보고하세요
6. 종합 결과를 `.claude/outputs/stage-3-review.md`에 저장하세요

### 주의사항
- 두 에이전트의 리뷰가 중복되면 CTO 리뷰 결과를 우선합니다
- 변경되지 않은 기존 코드에 대한 리뷰는 하지 않습니다

## 에러 복구

| 상황 | 복구 흐름 |
|------|-----------|
| Critical 1건 이상 | → `/2-implement`로 수정 → `/3-review` 재시작 |
| Warning만 있음 | → 사용자 판단: 수정(`/2-implement`) 또는 `/4-test` 진행 |
| Critical/Warning 없음 | → `/4-test` 진행 |

## 다음 단계

- 승인 → `/4-test`

---

최근 변경사항에 대한 2-Step 코드리뷰를 시작합니다.
