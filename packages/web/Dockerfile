# syntax=docker/dockerfile:1.4
# =============================================================================
# BB Project Management - Frontend Dockerfile (React + Vite)
# =============================================================================
# Build context: project root (.)

FROM node:22-alpine AS development

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/web/package.json packages/web/
COPY packages/shared/package.json packages/shared/

# CLI flags pin pnpm fetch behaviour explicitly. Earlier attempts via .npmrc
# were silently ignored. The BuildKit cache mount keeps the pnpm store across
# builds so slow-registry pain is paid once, not per push.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    corepack enable pnpm && \
    pnpm install --frozen-lockfile \
      --config.fetch-timeout=600000 \
      --config.fetch-retries=5 \
      --config.fetch-retry-mintimeout=10000 \
      --config.fetch-retry-maxtimeout=60000 \
      --config.network-concurrency=4

COPY packages/shared packages/shared
COPY packages/web packages/web

EXPOSE 5173

CMD ["npx", "--prefix", "packages/web", "vite", "--host", "0.0.0.0", "--port", "5173"]

# =============================================================================
# Build stage
# =============================================================================
FROM development AS build

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN cd packages/web && npx vite build

# =============================================================================
# Production stage - Nginx
# =============================================================================
FROM nginx:alpine AS production

COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
