# =============================================================================
# BB Project Management - Frontend Dockerfile (React + Vite)
# =============================================================================

FROM node:22-alpine AS development

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]

# =============================================================================
# Build stage
# =============================================================================
FROM development AS build

RUN npx vite build

# =============================================================================
# Production stage - Nginx
# =============================================================================
FROM nginx:alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
