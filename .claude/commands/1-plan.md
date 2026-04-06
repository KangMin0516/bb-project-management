# Stage 1: 기획 (Planning)

요구사항을 분석하고 구현 계획을 수립합니다.

## 실행 모드: 직접 실행

현재 컨텍스트에서 시스템 기획자로 작업합니다.

0. **워크로그 아카이브**: `.claude/outputs/stage-1-plan.md`가 이미 존재하면, 기존 산출물을 아카이브합니다.
   - 기존 `stage-1-plan.md`의 첫 줄에서 작업명을 추출 (없으면 `unknown`)
   - `.claude/outputs/history/{YYYY-MM-DD}_{slug}/` 디렉토리를 생성
   - `.claude/outputs/stage-*.md` 파일을 모두 해당 디렉토리로 **복사**한 후 원본 삭제
   - Bash로 실행: `mkdir -p .claude/outputs/history/$(date +%Y-%m-%d)_{slug} && cp .claude/outputs/stage-*.md .claude/outputs/history/$(date +%Y-%m-%d)_{slug}/ && rm .claude/outputs/stage-*.md`
1. `.claude/agents/planner.md`를 읽고 페르소나를 적용하세요
2. 에이전트의 수행 절차에 따라 `$ARGUMENTS`에 대한 기획을 수행하세요
3. 기획서를 `.claude/outputs/stage-1-plan.md`에 저장하세요
4. **사용자 승인을 받은 후** 다음 단계로 안내하세요

## 에러 복구

- 요구사항이 불명확하면 사용자에게 질문으로 해결합니다.

## 다음 단계

- 계획 승인 → `/2-implement`

---

$ARGUMENTS 에 대한 기획을 시작합니다.
