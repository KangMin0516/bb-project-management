# 공통 절차 (Shared Procedures)

여러 스테이지에서 반복 사용되는 공통 절차입니다.

## 인증 토큰 획득

config.md의 `Auth` 섹션 정보를 사용합니다:

```bash
TOKEN=$(curl -s -X POST [base_url][login_endpoint] \
  -H 'Content-Type: [login_content_type]' \
  -d '[login_body]' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

## 서비스 헬스체크

1. 컨테이너 상태: `docker compose ps`
2. HTTP 응답: config.md의 각 서비스 URL로 `curl -s -o /dev/null -w "%{http_code}"`
3. 에러 로그: `docker compose logs --tail=20 [서비스명]`

## 변경 범위 파악 (Git)

```bash
git diff --stat HEAD          # 변경 통계
git diff --name-only          # 변경 파일 목록
git status -s                 # 신규/삭제 파일
git log --oneline -5          # 최근 커밋
```

## 서비스 빌드/재빌드

config.md의 명령어를 사용합니다:
- 전체 빌드: Infrastructure의 `build_cmd`
- 개별 서비스: 해당 서비스의 `build_cmd`
- 재시작: `docker compose up -d [서비스명]`

## E2E 브라우저 테스트 (Chrome Extension)

Claude in Chrome MCP 도구를 사용하여 E2E 테스트를 수행합니다.

### 사전 준비

1. `mcp__claude-in-chrome__tabs_context_mcp`로 현재 브라우저 탭 상태 확인
2. `mcp__claude-in-chrome__tabs_create_mcp`로 새 탭 생성
3. `mcp__claude-in-chrome__navigate`로 config.md의 `e2e_entry_url` 접속

### 로그인 플로우

1. config.md의 `login_flow` 절차에 따라 로그인 수행
2. `mcp__claude-in-chrome__form_input`으로 입력 필드 채우기
3. `mcp__claude-in-chrome__computer`로 클릭/인터랙션
4. `mcp__claude-in-chrome__read_page`로 페이지 상태 확인

### 테스트 실행

1. config.md의 `critical_paths`를 순서대로 검증
2. 각 단계에서:
   - `read_page`로 렌더링 상태 확인
   - `read_console_messages`로 콘솔 에러 확인 (pattern 필터 활용)
   - `gif_recording: true`이면 `gif_creator`로 주요 플로우 기록
3. 변경된 기능에 대한 추가 검증 수행

### 판정 기준

- 모든 critical_path 정상 동작: PASS
- 콘솔 에러 0건 (config.md `console_error_policy` 참조)
- 페이지 렌더링 정상

### 실패 시

- 스크린샷: `mcp__claude-in-chrome__upload_image`로 증거 캡처
- 콘솔 로그: `read_console_messages`로 에러 수집
- 네트워크: `read_network_requests`로 실패 요청 확인

## 이전 스테이지 산출물 확인

`.claude/outputs/stage-N-[name].md` 파일을 읽습니다:
- 파일이 없으면 → 사용자에게 해당 스테이지 실행을 안내
- 파일이 있으면 → 내용을 읽고 결과 확인 후 진행
