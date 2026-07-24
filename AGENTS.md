# AGENTS.md

## Cursor Cloud specific instructions

This is a `pnpm` (9.15.0) workspace monorepo: `apps/api` (Nest.js REST API), `apps/admin`
(Next.js internal tool), `apps/mobile` (Expo/React Native), and `packages/shared` (shared
contracts/utilities). Standard commands live in the root `package.json` scripts and `README.md`;
prefer those. Below are only the non-obvious caveats for running this in Cursor Cloud.

### Services

| Service | Dir | Start | Port | Notes |
| --- | --- | --- | --- | --- |
| API | `apps/api` | `pnpm dev:api` | 4000 | Nest + Prisma. Health: `GET /ready` (DB) and `/health` (liveness). Needs PostgreSQL. |
| Admin | `apps/admin` | `pnpm dev:admin` | 3000 | Next.js. Reads `apps/admin/.env.local`. Public pages `/privacy`, `/privacy/choices`. |
| Mobile | `apps/mobile` | `pnpm dev:mobile` | 8081 | Expo/Metro. Needs a device/simulator or Expo Go; cannot be fully exercised headless. Barcode/expiry OCR scanner works only in a native dev build, not Expo Go. |

### PostgreSQL (not in the update script — start it each session)

There is no Docker in this environment. PostgreSQL 16 is installed via apt. If it is not running,
start it and ensure the dev DB exists:

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='expirymate'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE expirymate;"
```

This matches the default `DATABASE_URL` (`postgresql://postgres:postgres@localhost:5432/expirymate`).

### First-run setup (only if missing)

Env files are per-app and gitignored; create them from the examples if absent:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Apply migrations and seed:

```bash
pnpm --filter @expirymate/api exec prisma migrate deploy   # non-interactive; see gotcha below
pnpm db:seed
```

### Non-obvious gotchas

- **Build `@expirymate/shared` before `pnpm db:seed`.** The app `dev`/`typecheck` scripts auto-build
  shared via `predev`/`pretypecheck`, but `db:seed` does NOT. A cold `pnpm db:seed` fails with
  `Cannot find module '@expirymate/shared/dist/index.cjs'` until you run
  `pnpm --filter @expirymate/shared build` (the update script already does this on startup).
- **Do not use `prisma migrate dev` here.** It is interactive (and also triggers the seed, which
  fails without the shared build), so it hangs in a non-TTY agent. Use
  `pnpm --filter @expirymate/api exec prisma migrate deploy` to apply migrations. Prisma's AI-agent
  guard also blocks `prisma migrate reset`.
- **Re-seeding onto dirty data can fail.** `prisma/seed.ts` deletes `User` before some FK-dependent
  rows (e.g. `InventorySpace`), so a re-seed over partial data can hit an FK violation. Seed against
  a clean DB; if needed, `TRUNCATE` the public tables (except `_prisma_migrations`) first, then
  `pnpm db:seed`.

### Admin login / seeded data

Seed inserts an admin user and ~10 Korean sample products + mixed-state inventory. Admin logs in via
the API (`POST /auth/login`) with the credentials from `apps/api/.env`:
`ADMIN_EMAIL=admin@expirymate.local` / `ADMIN_PASSWORD=admin1234`.

### Lint / typecheck / test / build

Standard root scripts (see `package.json`): `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm validate:env-parity`, per-app `build`. These mirror `.github/workflows/ci.yml`. One API test
intentionally logs an `smtp down` error while asserting mail-failure handling — that is expected, not
a real failure.
