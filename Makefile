# =============================================================================
# BB Project Management - Makefile
# =============================================================================

.PHONY: help dev dev-build dev-down prod prod-build prod-down logs shell clean migrate

help:
	@echo "BB Project Management - Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development server (DB + API + Web)"
	@echo "  make dev-build    - Rebuild and start development server"
	@echo "  make dev-down     - Stop development server"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production server"
	@echo "  make prod-build   - Rebuild and start production server"
	@echo "  make prod-down    - Stop production server"
	@echo ""
	@echo "Utilities:"
	@echo "  make logs         - View all container logs"
	@echo "  make logs-be      - View backend logs"
	@echo "  make logs-fe      - View frontend logs"
	@echo "  make shell        - Open shell in backend container"
	@echo "  make migrate      - Run database migrations"
	@echo "  make clean        - Remove containers and volumes"

# =============================================================================
# Development
# =============================================================================

dev:
	docker compose up -d
	@echo ""
	@echo "Development server started:"
	@echo "  Frontend: http://localhost:5173"
	@echo "  Backend:  http://localhost:3002/api"
	@echo "  Swagger:  http://localhost:3002/api/docs"
	@echo "  DB:       localhost:5433"

dev-build:
	docker compose build --no-cache
	docker compose up -d

dev-down:
	docker compose down

# =============================================================================
# Production
# =============================================================================

prod:
	@if [ -z "$$JWT_SECRET" ] && [ ! -f .env ]; then \
		echo "ERROR: JWT_SECRET is required. Set it in .env or as env var."; \
		exit 1; \
	fi
	docker compose -f docker-compose.prod.yml up -d
	@echo ""
	@echo "Production server started"

prod-build:
	docker compose -f docker-compose.prod.yml build --no-cache
	docker compose -f docker-compose.prod.yml up -d

prod-down:
	docker compose -f docker-compose.prod.yml down

# =============================================================================
# Utilities
# =============================================================================

logs:
	docker compose logs -f

logs-be:
	docker compose logs -f app

logs-fe:
	docker compose logs -f web

logs-db:
	docker compose logs -f db

shell:
	docker compose exec app sh

shell-db:
	docker compose exec db psql -U bbpm -d bbpm_db

migrate:
	docker compose exec app sh -c "cd /app/packages/api && npx prisma migrate deploy"

# =============================================================================
# Cleanup
# =============================================================================

clean:
	docker compose down -v --remove-orphans
	@echo "Cleaned up containers and volumes"

clean-all: clean
	docker compose -f docker-compose.prod.yml down -v --remove-orphans 2>/dev/null || true
	docker image prune -f
	@echo "Removed all containers, volumes, and dangling images"
