FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS build
# Required build-args — no localhost/development defaults (P1-11).
# Local compose must pass development values explicitly; Railway must pass production.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_APP_ENV
ARG PRIVACY_CONTACT_EMAIL

# Fail fast before installing app sources when args are missing or unsafe for production.
# Mirrors apps/admin/next.config.mjs production checks (hostname-based).
RUN node <<'EOF'
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const appEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim() ?? "";
const privacyEmail = process.env.PRIVACY_CONTACT_EMAIL?.trim() ?? "";
const errors = [];

if (!apiBaseUrl) errors.push("NEXT_PUBLIC_API_BASE_URL build-arg is required");
if (!appEnv) errors.push("NEXT_PUBLIC_APP_ENV build-arg is required");
if (!privacyEmail) errors.push("PRIVACY_CONTACT_EMAIL build-arg is required");

if (appEnv === "production") {
  if (apiBaseUrl) {
    let url;
    try {
      url = new URL(apiBaseUrl);
    } catch {
      errors.push("NEXT_PUBLIC_API_BASE_URL must be a valid HTTPS URL");
      url = null;
    }
    if (url) {
      if (url.protocol !== "https:") {
        errors.push("NEXT_PUBLIC_API_BASE_URL must use https:// in production");
      }
      const host = url.hostname.toLowerCase();
      const unsafe =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.endsWith(".localhost") ||
        host.endsWith(".local") ||
        host.endsWith(".example") ||
        host.endsWith(".invalid") ||
        host.endsWith(".test") ||
        host.includes("your-domain");
      if (unsafe) {
        errors.push(
          "NEXT_PUBLIC_API_BASE_URL must not target a development host in production",
        );
      }
    }
  }
  if (privacyEmail) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(privacyEmail);
    if (!emailOk || privacyEmail.endsWith(".local")) {
      errors.push(
        "PRIVACY_CONTACT_EMAIL must be a real public email address in production",
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Invalid Admin Docker build-args:\n- " + errors.join("\n- "));
  process.exit(1);
}
EOF

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV PRIVACY_CONTACT_EMAIL=$PRIVACY_CONTACT_EMAIL
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/admin apps/admin
RUN pnpm --filter @expirymate/shared build
RUN pnpm --filter @expirymate/admin build

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

RUN apk add --no-cache curl

COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /app/apps/admin/public ./apps/admin/public

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/privacy || exit 1

CMD ["node", "apps/admin/server.js"]
