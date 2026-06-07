# ExpiryMate MVP Monorepo

ExpiryMate is a Korean-first ingredient inventory, expiry reminder, and AI recipe recommendation MVP.

The current product assumption for this MVP is explicit:

- users register ingredients and household goods manually
- expiry date is entered separately
- registered inventory data is used for AI recipe recommendation
- future sources are reserved for `ocr_detected`

## Why This Monorepo Shape

This repository uses `pnpm` workspaces only.

- `apps/mobile` is the Korean user-facing product
- `apps/admin` is the internal operations tool for product and inventory data
- `apps/api` is the single REST backend for both clients
- `packages/shared` holds safe-to-share contracts and inventory/expiry utilities

This keeps the MVP simple while leaving a clean path for:

- improving recipe recommendation from registered inventory
- adding OCR-based expiry detection later
- adding auth, households, analytics, and subscriptions without a rewrite

## Folder Structure

```text
.
├── apps
│   ├── admin
│   │   ├── app
│   │   └── src
│   ├── api
│   │   ├── prisma
│   │   └── src
│   └── mobile
│       ├── app
│       ├── assets
│       └── src
├── packages
│   └── shared
│       └── src
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Stack

### Mobile

- Expo + React Native + TypeScript
- Expo Router
- Zustand
- TanStack Query
- React Hook Form + Zod
- AsyncStorage
- `expo-notifications` ready structure

### Admin

- Next.js App Router
- Tailwind CSS
- TanStack Query
- simple form-based internal tooling UX

### API

- Nest.js
- Prisma
- PostgreSQL
- OpenAI Responses API for recipe recommendations
- DTO validation
- REST API

### Shared

- shared enums
- shared types
- shared zod schemas
- expiry and dashboard utilities

## Root Scripts

- `pnpm dev:mobile`
- `pnpm dev:admin`
- `pnpm dev:api`
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:seed`

`pnpm dev` runs:

- shared package watch build
- Nest API
- Next admin
- Expo mobile

Each individual app `dev` script also prebuilds `packages/shared` so the app can run independently.

## Environment Layout

### Root reference

Use the root `.env.example` as a reference map only.

### API

Copy `apps/api/.env.example` to `apps/api/.env`

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/expirymate?schema=public"
PORT=4000
CORS_ORIGIN_ADMIN="http://localhost:3000"
CORS_ORIGIN_MOBILE="http://localhost:8081"
DEFAULT_OWNER_KEY="demo-user"
AUTH_TOKEN_SECRET="replace-with-a-long-random-secret"
AUTH_ALLOW_DEV_FALLBACK="true"
PRIVACY_POLICY_URL="http://localhost:3000/privacy"
PRIVACY_CHOICES_URL="http://localhost:3000/privacy/choices"
PRIVACY_CONTACT_EMAIL="privacy@expirymate.local"
AI_DATA_NOTICE_VERSION="ai-data-notice-v1"
OPENAI_API_KEY="sk-..."
RECIPE_AI_MODEL="gpt-5-mini"
```

`AUTH_TOKEN_SECRET` is required in production. `AUTH_ALLOW_DEV_FALLBACK=true` keeps local admin/dev tools usable without a bearer token; set it to `false` for production-like checks.

### Admin

Copy `apps/admin/.env.example` to `apps/admin/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"
PRIVACY_CONTACT_EMAIL="privacy@expirymate.local"
```

### Mobile

Copy `apps/mobile/.env.example` to `apps/mobile/.env`

```env
EXPO_PUBLIC_API_BASE_URL="http://localhost:4000"
EXPO_PUBLIC_APP_ENV="development"
```

For Expo Go on a real device, `localhost` points to the phone, not your Mac.
Use your Mac's current LAN IP instead:

```bash
ifconfig | rg "inet "
```

Example:

```env
EXPO_PUBLIC_API_BASE_URL="http://172.29.58.200:4000"
EXPO_PUBLIC_APP_ENV="development"
```

Restart Expo after changing `.env`:

```bash
pnpm --filter @expirymate/mobile exec expo start -c
```

## Running Locally

### 1. Install dependencies

```bash
pnpm install
```

If `pnpm` reports an unexpected store location, use the same store used by the existing `node_modules`:

```bash
pnpm --store-dir /Users/namu/Library/pnpm/store/v3 install
```

### 2. Prepare environment files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Then fill in:

- `apps/api/.env`: `DATABASE_URL`, `OPENAI_API_KEY`
- `apps/mobile/.env`: `EXPO_PUBLIC_API_BASE_URL`

### 3. Start PostgreSQL and migrate

PostgreSQL must be running and the `DATABASE_URL` user needs `CREATEDB` permission because Prisma `migrate dev` creates a shadow database.

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 4. Run the apps

In separate terminals:

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:mobile
```

URLs:

- API: `http://localhost:4000`
- Admin: `http://localhost:3000`
- Mobile: Expo QR from `pnpm dev:mobile`

## Privacy, Data Deletion, and AI Notice

Public pages for App Store review:

- Privacy Policy: `http://localhost:3000/privacy`
- Data Deletion Choices: `http://localhost:3000/privacy/choices`

Before submitting to the App Store, replace localhost URLs with the production
domain in `PRIVACY_POLICY_URL` and `PRIVACY_CHOICES_URL`.

Mobile users can manage privacy controls in `설정` → `개인정보 및 AI 데이터`.
The first AI recipe recommendation requires one-time AI data notice consent.

Account/data deletion immediately removes owned ingredients, recommendation
history, notification preferences, auth sessions, password credentials, and
social login links. AI recipe recommendation sends an inventory snapshot and
recommendation conditions from the API server to OpenAI; the mobile app never
receives or stores the OpenAI API key.

You can also run everything at once:

```bash
pnpm dev
```

### 5. Quick health checks

```bash
curl http://localhost:4000/dashboard/summary
curl http://localhost:4000/recipes/recommendations
```

To test AI recommendation generation, register at least one non-expired ingredient first, then call:

```bash
curl -X POST http://localhost:4000/recipes/recommendations \
  -H "Content-Type: application/json" \
  -d '{"servings":2,"maxCookingMinutes":30,"mealType":"any","useExpiringFirst":true}'
```

## Recommended Local Development Order

1. Start PostgreSQL
2. `pnpm install`
3. `cp apps/api/.env.example apps/api/.env`
4. `cp apps/admin/.env.example apps/admin/.env.local`
5. `cp apps/mobile/.env.example apps/mobile/.env`
6. `pnpm db:generate`
7. `pnpm db:migrate`
8. `pnpm db:seed`
9. `pnpm dev:api`
10. `pnpm dev:admin`
11. `pnpm dev:mobile`

For daily work after the first setup, `pnpm dev` is the simplest option.

## MVP Coverage

### Mobile

- onboarding
- home dashboard
- manual ingredient registration
- inventory list
- inventory detail and edit
- AI recipe recommendation tab
- consume/discard actions
- notification settings UI
- mascot asset for recipe-oriented empty and success states

### Admin

- dashboard
- product list and quick create
- product detail/edit
- inventory list
- seed status page

### API

- anonymous bearer session
- products
- inventory
- recipe recommendations
- dashboard summary
- settings/preferences

## Initial Database Design

### `Product`

- `id`
- `name`
- `brand`
- `category`
- `imageUrl`
- `createdAt`
- `updatedAt`

### `InventoryItem`

- `id`
- `ownerKey`
- `productId`
- `displayName`
- `brand`
- `category`
- `quantity`
- `unit`
- `storageLocation`
- `expiryDate`
- `expirySource`
- `status`
- `notes`
- `createdAt`
- `updatedAt`

### `NotificationPreference`

- `id`
- `ownerKey`
- `enabled`
- `reminderDaysBefore`
- `remindOnDayOf`
- `quietHoursStart`
- `quietHoursEnd`
- `createdAt`
- `updatedAt`

## API Response Convention

Successful responses are wrapped in:

```json
{
  "success": true,
  "data": {}
}
```

Errors are wrapped in:

```json
{
  "success": false,
  "error": {
    "code": "HTTP_400",
    "message": "Validation failed",
    "details": {}
  }
}
```

This is intentionally simple and easy for both mobile and admin clients.

## Main API Endpoints

### Products

- `GET /products`
- `GET /products/:id`
- `POST /products`
- `PATCH /products/:id`

### Inventory

- `GET /inventory`
- `GET /inventory/:id`
- `POST /inventory`
- `PATCH /inventory/:id`
- `POST /inventory/:id/consume`
- `POST /inventory/:id/discard`

Inventory, dashboard, recipe, and settings endpoints use the `Authorization: Bearer <token>` owner from `POST /auth/anonymous`. Client-supplied `ownerKey` query/body values are not trusted.

### Other

- `POST /auth/anonymous`
- `GET /dashboard/summary`
- `POST /recipes/recommendations`
- `GET /recipes/recommendations`
- `GET /recipes/recommendations/:id`
- `GET /settings/notification-preferences`
- `PATCH /settings/notification-preferences`
- `GET /auth/placeholder`

## Seed Data

The API seed includes at least 10 Korea-relevant example products:

- 서울우유 1L
- 계란 10구
- 두부
- 플레인 요거트
- 오렌지 주스
- 컵라면
- 샴푸
- 휴지
- 세제
- 냉동 만두

Inventory seed also includes mixed states:

- expired
- expiring today
- within 3 days
- within 7 days
- safe
- consumed

## What Is Real vs Mocked

### Real in this starter

- monorepo wiring
- shared contracts and expiry utilities
- Nest REST modules
- Prisma schema and seed
- mobile onboarding, register, inventory, settings flows
- AI recipe recommendation API and mobile recommendation tab
- admin product and inventory tooling
- recipe-oriented mascot asset

### Mocked or intentionally limited

- no OCR expiry extraction
- no email/social login or account recovery
- no real push token registration backend
- no scheduled reminder worker/cron
- no family/household model

## Recommended Production Replacements First

1. Upgrade anonymous bearer auth to account login, token refresh, and recovery.
2. Harden recipe recommendation quality, rate limits, caching, and feedback loops.
3. Add a reminder scheduler and push delivery pipeline.
4. Add image upload/storage instead of placeholder image URLs.
5. Add OCR-based expiry parsing after the registration flow is stable.

## Recommended Next Implementation Order

1. Harden API validation and add API tests.
2. Add recipe recommendation feedback and history UX.
3. Add admin create/edit validation feedback.
4. Add push token registration + scheduled reminder jobs.
5. Add multi-household data model.
6. Add analytics and subscription boundaries only after retention signals exist.

## Notes On Running

- `packages/shared` is built to `dist` and consumed as a workspace package
- root `dev` watches `packages/shared` so changes propagate during local development
- notification UI is real, but remote push delivery is not implemented yet
- recipe recommendation requires `OPENAI_API_KEY` in `apps/api/.env`

## Versioning Notes

This repo was shaped around current official docs for the main framework assumptions used here:

- Expo SDK reference and package docs: https://docs.expo.dev/versions/latest/
- Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
- Next.js App Router installation: https://nextjs.org/docs/app/getting-started/installation
- Next.js dynamic segments: https://nextjs.org/docs/15/app/api-reference/file-conventions/dynamic-routes
