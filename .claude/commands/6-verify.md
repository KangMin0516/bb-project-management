# Stage 6: 검증 (Verification)

배포 후 서비스 상태 및 기능을 최종 검증합니다.

## 실행 모드: Task 에이전트 생성

**컨텍스트 분리를 위해 반드시 Task 에이전트를 생성하세요.**

### 실행 절차

1. `.claude/config.md`를 읽어서 프로젝트 정보를 파악하세요

2. **검증 에이전트** — Task 에이전트 생성:
   ```
   Task(subagent_type=general-purpose)
   prompt: ".claude/agents/verifier.md 파일을 읽고 그 역할에 따라 배포된 변경사항을 검증하세요."
   ```

3. 검증 결과를 사용자에게 보고하세요
4. 결과를 `.claude/outputs/stage-6-verify.md`에 저장하세요

## 에러 복구

| 상황 | 복구 흐름 |
|------|-----------|
| 서비스 다운 | → `/0-run`으로 재시작 → `/6-verify` 재시작 |
| 기능 이상 발견 (경미) | → `/2-implement`로 수정 → `/4-test` → `/5-deploy` → `/6-verify` |
| 심각한 이상 발견 | → 즉시 롤백 → `/2-implement`부터 전체 파이프라인 재시작 |
| 회귀 버그 발견 | → `/2-implement`로 수정 → `/3-review` → `/4-test` → `/5-deploy` → `/6-verify` |

## 다음 단계

- 검증 완료 → 파이프라인 종료

---

배포된 변경사항에 대한 검증을 시작합니다.
