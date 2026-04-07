## 실행 상태 보고

| 서비스 | 상태 | URL | 비고 |
|--------|------|-----|------|
| PostgreSQL (DB) | UP (healthy) | localhost:5433 | Docker: project-management-db-1 |
| Backend API (NestJS) | UP | http://localhost:3002/api | Swagger: http://localhost:3002/api/docs |
| Frontend (Vite) | UP | http://localhost:5173 | HMR 활성 |

### 시작 과정 메모

- Docker Desktop이 내려가 있었으나 `open -a Docker`로 재시작 → DB 컨테이너 자동 복구 (healthy)
- `pnpm dev`로 프론트엔드/shared 시작됨, API는 `dev` 스크립트가 없어 `start:dev`로 별도 실행
- Prisma Client에서 `dueDate` 필드 미인식 에러 → `npx prisma generate`로 재생성 후 해결
- 인증 확인: admin@burningb.com 로그인 성공
