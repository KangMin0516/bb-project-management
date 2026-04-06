# Project Configuration

이 파일은 프로젝트 환경 정보를 정의합니다.
모든 커맨드 파일은 이 파일을 참조하여 프로젝트별 설정을 가져옵니다.

## Project Info

- **project_name**: project-management
- **project_description**: (프로젝트 설명을 입력하세요)
- **project_root**: /Users/seonguk/Develop/project-management

## Services

### frontend
- **path**: frontend/
- **stack**: (미설정) <!-- 예: Vite, React, TypeScript, Tailwind CSS -->
- **port**: (미설정)
- **build_cmd**: (미설정)
- **lint_cmd**: (미설정)
- **typecheck_cmd**: (미설정)
- **test_cmd**: (미설정)
- **dev_cmd**: (미설정)

### backend
- **path**: backend/
- **stack**: (미설정) <!-- 예: FastAPI, Python, SQLAlchemy -->
- **port**: (미설정)
- **build_cmd**: (미설정)
- **lint_cmd**: (미설정)
- **dev_cmd**: (미설정)

### db
- **type**: (미설정) <!-- 예: PostgreSQL 16 -->
- **port**: (미설정)
- **managed_by**: (미설정) <!-- 예: Docker Compose -->

## Infrastructure

- **orchestration**: (미설정) <!-- 예: Docker Compose -->
- **dev_config**: (미설정)
- **prod_config**: (미설정)
- **start_cmd**: (미설정)
- **stop_cmd**: (미설정)
- **build_cmd**: (미설정)
- **prod_start_cmd**: (미설정)

## Auth

- **method**: (미설정) <!-- 예: JWT, Session, OAuth -->
- **login_endpoint**: (미설정)
- **login_content_type**: (미설정)
- **login_body**: (미설정)
- **default_account**: (미설정)

## API

- **base_url**: (미설정)
- **prefix**: (미설정)
- **frontend_url**: (미설정)

## CI/CD

- **enabled**: false
- **tool**: (미설정) <!-- GitHub Actions / GitLab CI / Jenkins / etc. -->
- **repo_url**: (미설정) <!-- https://github.com/org/repo -->
- **default_branch**: main
- **branch_strategy**: feature branch → PR → merge
- **branch_prefix**: feat/, fix/, refactor/, chore/
- **pr_base_branch**: main
- **deploy_trigger**: merge to main <!-- PR 머지 시 자동 배포 -->
- **pipeline_url**: (미설정) <!-- CI/CD 대시보드 URL -->
- **status_check_cmd**: (미설정) <!-- gh run list --limit 5 등 -->

> **NOTE**: `enabled: false`인 경우 `/5-deploy` 실행 시 CI/CD 미설정 경고가 표시되고 **배포가 중단됩니다.**
> CI/CD를 구성한 후 `enabled: true`로 변경하고 나머지 항목을 채워주세요.

### CI/CD 설정 예시

**GitHub Actions:**
```
- enabled: true
- tool: GitHub Actions
- repo_url: https://github.com/org/repo
- status_check_cmd: gh run list --limit 5
- pipeline_url: https://github.com/org/repo/actions
```

**GitLab CI:**
```
- enabled: true
- tool: GitLab CI
- repo_url: https://gitlab.com/org/repo
- status_check_cmd: glab ci list
- pipeline_url: https://gitlab.com/org/repo/-/pipelines
```

## E2E / Browser Automation

- **tool**: Claude in Chrome (MCP)
- **required**: true
- **e2e_entry_url**: (미설정)
- **login_flow**:
  1. `e2e_entry_url` 접속
  2. 로그인 페이지에서 Auth 섹션의 `default_account`로 로그인
  3. 대시보드 진입 확인
- **critical_paths**:
  - (프로젝트에 맞게 정의하세요)
- **console_error_policy**: 콘솔 에러 0건이어야 PASS
- **gif_recording**: true <!-- 주요 플로우를 GIF로 기록 -->

> **NOTE**: `required: true`이면 Stage 4(Test)에서 E2E 테스트를 반드시 수행합니다.
> Chrome extension이 연결되지 않은 경우 사용자에게 경고하고 테스트를 PASS로 처리하지 않습니다.

## Conventions

- **commit_prefix**: feat, fix, refactor, docs, style, test, chore
- **python_style**: snake_case functions/variables, PascalCase classes
- **typescript_style**: camelCase functions/variables, PascalCase components/types
- **backend_structure**: (프로젝트 구조에 맞게 정의하세요)
- **frontend_structure**: (프로젝트 구조에 맞게 정의하세요)
