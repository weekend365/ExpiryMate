# ExpiryMate Deployment Guide

This document covers local Docker, staging/production deployment, and observability setup.

## Local Docker (full stack)

```bash
# Optional: copy docker env reference
cp .env.docker.example .env.docker

# Start Postgres + API + Admin
pnpm docker:up

# Verify
curl http://localhost:4000/health
curl http://localhost:4000/ready
curl -I http://localhost:3000/privacy
curl -I http://localhost:3000/privacy/choices

# Stop
pnpm docker:down
```

| Service  | URL |
|----------|-----|
| API      | http://localhost:4000 |
| Admin    | http://localhost:3000 |
| Privacy  | http://localhost:3000/privacy |
| Data deletion | http://localhost:3000/privacy/choices |

Health response includes release metadata:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "0.1.0",
    "gitSha": "local",
    "env": "development"
  }
}
```

## Database migrations

| Environment | Command |
|-------------|---------|
| Local dev   | `pnpm db:migrate` (`prisma migrate dev`) |
| Staging/prod | `pnpm db:migrate:deploy` (`prisma migrate deploy`) |

**Never run `pnpm db:seed` in production.** The seed script wipes all tables and is blocked when `NODE_ENV=production`.

## Staging / production deployment

### 1. Build container images

```bash
# API
docker build \
  -f apps/api/Dockerfile \
  --build-arg GIT_SHA=$(git rev-parse --short HEAD) \
  --build-arg APP_VERSION=0.1.0 \
  -t expirymate-api .

# Admin
docker build \
  -f apps/admin/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.staging.example.com \
  --build-arg NEXT_PUBLIC_APP_ENV=production \
  --build-arg PRIVACY_CONTACT_EMAIL=privacy@example.com \
  -t expirymate-admin .
```

Deploy images to your PaaS (Railway, Render, Fly.io, etc.) with a managed PostgreSQL instance.

### 2. Required API environment variables

See [`.env.example`](../.env.example) and [`apps/api/src/config/production-env.ts`](../apps/api/src/config/production-env.ts).

Minimum for production:

- `DATABASE_URL`
- `AUTH_TOKEN_SECRET` (32+ chars)
- `AUTH_ALLOW_DEV_FALLBACK=false`
- `CORS_ORIGIN_ADMIN`, `CORS_ORIGIN_MOBILE` (https)
- `SMTP_*` (email verification / password reset)
- `PRIVACY_POLICY_URL`, `PRIVACY_CHOICES_URL`
- OAuth and IAP vars as needed

### 3. Required Admin environment variables

- `NEXT_PUBLIC_API_BASE_URL` (https staging/production API)
- `NEXT_PUBLIC_APP_ENV=production`
- `PRIVACY_CONTACT_EMAIL` (public contact email)

### 4. Admin account (production)

Do **not** rely on `db:seed` in production. Create the first admin manually:

1. Register a user via the mobile app or API.
2. Promote the user to admin in the database: `UPDATE "User" SET role = 'admin' WHERE email = '...';`
3. Use a strong password; never use default credentials like `admin1234`.

## Mobile (EAS)

Set EAS secrets for preview/production builds:

```bash
cd apps/mobile
eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value https://api.staging.example.com
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value https://...@sentry.io/...
```

Build:

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Update `app.json` Sentry plugin `organization` / `project` to match your Sentry project before production builds with source map upload.

## Sentry (optional)

Sentry is disabled when DSN env vars are empty.

| App | Env var |
|-----|---------|
| API | `SENTRY_DSN` |
| Admin | `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` |
| Mobile | `EXPO_PUBLIC_SENTRY_DSN` (preview/production only) |

Create three Sentry projects (api, admin, mobile) and set DSNs per environment.

## Uptime monitoring

After deploying API, register an external monitor:

- URL: `GET https://api.staging.example.com/health`
- Alert on non-200 or timeout

## CI/CD

- **PR:** lint, typecheck, test (`.github/workflows/ci.yml`)
- **main push:** above + API/Admin production build

## Troubleshooting

| Issue | Check |
|-------|-------|
| API won't start in production | `validateProductionEnvironment()` errors in logs |
| Admin can't reach API in Docker | Browser uses `localhost:4000`; ensure API port is exposed |
| Migrations fail | DB connectivity, run `db:migrate:deploy` manually once |
| Sentry silent | Confirm DSN env is set and not empty |
