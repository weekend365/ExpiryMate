# ExpiryMate Agent Notes

## Cursor Cloud specific instructions

Secrets & Doppler: [`docs/dev-secrets.md`](docs/dev-secrets.md).

Boot flow (see `.cursor/environment.json`):

1. `install` — `pnpm install`, shared build, `prisma generate`
2. `start` — Docker daemon → `node scripts/cursor-cloud-env.mjs` → Postgres via compose

Prefer Doppler when `DOPPLER_TOKEN` is set:

```bash
doppler secrets download -p expirymate-api -c dev --no-file --format env > apps/api/.env
doppler secrets download -p expirymate-admin -c dev --no-file --format env > apps/admin/.env.local
doppler secrets download -p expirymate-mobile -c dev --no-file --format env > apps/mobile/.env
```

After env files exist:

```bash
pnpm db:migrate
pnpm db:seed   # optional
pnpm test
pnpm typecheck
pnpm dev:api   # and/or pnpm dev:admin
```

- Env files are gitignored; never commit them.
- Prefer API/unit tests and Admin over Expo in Cloud VMs.
- If Postgres container fails, set Runtime Secret `DATABASE_URL` to a reachable hosted Postgres URL.
- Overlapping Cursor Secret keys (`SENTRY_DSN`, etc.): use `API_*` / `ADMIN_*` / `MOBILE_*` prefixes.
