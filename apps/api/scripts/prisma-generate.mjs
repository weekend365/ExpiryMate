import { spawnSync } from 'node:child_process';

/**
 * Prisma schema requires DATABASE_URL even for `prisma generate`.
 * CI quality/build jobs have no apps/api/.env, so provide a generate-only fallback.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@localhost:5432/expirymate?schema=public';
}

const result = spawnSync('pnpm', ['exec', 'prisma', 'generate'], {
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
