# =============================================================================
# BB Project Management - Backend Dockerfile (NestJS)
# =============================================================================

FROM node:22-alpine AS base

WORKDIR /app

# =============================================================================
# Dependencies stage
# =============================================================================
FROM base AS deps

# Install dependencies (including shared workspace package)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

RUN corepack enable pnpm && pnpm install --frozen-lockfile

# =============================================================================
# Builder stage
# =============================================================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

COPY packages/shared packages/shared
COPY packages/api packages/api
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

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
RUN addgroup --gid 1000 appgroup && \
    adduser --uid 1000 --ingroup appgroup --shell /bin/sh --disabled-password appuser

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

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api || exit 1

CMD ["node", "dist/main.js"]

# =============================================================================
# Development stage
# =============================================================================
FROM base AS development

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

COPY packages/shared packages/shared
COPY packages/api packages/api
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

RUN corepack enable pnpm && \
    cd packages/shared && pnpm build && \
    cd ../api && npx prisma generate

WORKDIR /app/packages/api

EXPOSE 3000

CMD ["npx", "nest", "start", "--watch"]
