# syntax=docker/dockerfile:1.4
# =============================================================================
# BB Project Management - Backend Dockerfile (NestJS)
# =============================================================================

FROM node:22-alpine AS base

WORKDIR /app

# Let corepack download the pinned pnpm version without prompting in CI.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# =============================================================================
# Dependencies stage
# =============================================================================
FROM base AS deps

# Install dependencies (including shared workspace package)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

# Fetch tuning lives in .npmrc (copied above). The BuildKit cache mount keeps
# the pnpm store across builds so slow-registry pain is paid once, not per push.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    corepack enable pnpm && \
    pnpm install --frozen-lockfile

# =============================================================================
# Builder stage
# =============================================================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

COPY packages/shared packages/shared
COPY packages/api packages/api
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Build shared package first, then API
RUN corepack enable pnpm && \
    cd packages/shared && pnpm build && \
    cd ../api && npx prisma generate && pnpm build

# =============================================================================
# Production stage
# =============================================================================
FROM base AS production

RUN apk add --no-cache curl

# Create non-root user
RUN addgroup --gid 1001 appgroup && \
    adduser --uid 1001 --ingroup appgroup --shell /bin/sh --disabled-password appuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/generated ./packages/api/generated
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/api/package.json packages/api/
COPY packages/api/prisma packages/api/prisma
COPY packages/api/prisma.config.ts packages/api/

USER appuser

WORKDIR /app/packages/api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/api/docs || exit 1

CMD ["node", "dist/src/main.js"]

# =============================================================================
# Development stage
# =============================================================================
FROM base AS development

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

COPY packages/shared packages/shared
COPY packages/api packages/api
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN corepack enable pnpm && \
    cd packages/shared && pnpm build && \
    cd ../api && npx prisma generate

WORKDIR /app/packages/api

EXPOSE 3000

CMD ["npx", "nest", "start", "--watch"]
