FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG GIT_SHA=unknown
ARG APP_VERSION=0.1.0
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @expirymate/shared build
RUN pnpm --filter @expirymate/api exec prisma generate
RUN pnpm --filter @expirymate/api build

FROM base AS runner
ARG GIT_SHA=unknown
ARG APP_VERSION=0.1.0
ENV NODE_ENV=production
ENV GIT_SHA=$GIT_SHA
ENV APP_VERSION=$APP_VERSION
WORKDIR /app

RUN apk add --no-cache curl

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

WORKDIR /app/apps/api
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && npx prisma generate

EXPOSE 4000
# Use /ready (DB check), not /health (liveness only). Railway: set Healthcheck Path to /ready.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4000/ready || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
