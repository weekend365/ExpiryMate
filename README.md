# ExpiryMate MVP Monorepo

ExpiryMate is a Korean-first barcode inventory and expiry reminder MVP for food and household goods.

The product assumption for this MVP is explicit:

- barcode is used for product identification
- expiry date is entered separately
- future sources are reserved for `barcode_decoded` and `ocr_detected`

## Why this monorepo shape

This repository uses `pnpm` workspaces only.

- `apps/mobile` is the Korean user-facing product
- `apps/admin` is the internal operations tool for barcode and product mapping
- `apps/api` is the single REST backend for both clients
- `packages/shared` holds safe-to-share contracts and inventory/expiry utilities

This keeps the MVP simple while leaving a clean path for:

- replacing the seeded barcode mapping with a real external product source
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
- `expo-camera`
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
```

### Admin

Copy `apps/admin/.env.example` to `apps/admin/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"
```

### Mobile

Copy `apps/mobile/.env.example` to `apps/mobile/.env`

```env
EXPO_PUBLIC_API_BASE_URL="http://localhost:4000"
EXPO_PUBLIC_APP_ENV="development"
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
- barcode scan flow
- product lookup by barcode
- manual/semi-automatic registration
- inventory list
- inventory detail and edit
- consume/discard actions
- notification settings UI

### Admin

- dashboard
- product list and quick create
- product detail/edit
- barcode lookup page
- inventory list
- seed status page

### API

- auth placeholder
- products
- inventory
- dashboard summary
- settings/preferences
- scan logs

## Initial Database Design

### `Product`

- `id`
- `barcode`
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
- `barcode`
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

### `ScanLog`

- `id`
- `ownerKey`
- `barcode`
- `matched`
- `note`
- `createdAt`

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
- `GET /products/barcode/:barcode`
- `POST /products`
- `PATCH /products/:id`

### Inventory

- `GET /inventory`
- `GET /inventory/:id`
- `POST /inventory`
- `PATCH /inventory/:id`
- `POST /inventory/:id/consume`
- `POST /inventory/:id/discard`

### Other

- `GET /dashboard/summary`
- `GET /settings/notification-preferences`
- `PATCH /settings/notification-preferences`
- `GET /scan-logs`
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
- barcode lookup against stored product mappings
- mobile onboarding, scan, register, inventory, settings flows
- admin product/inventory/barcode tooling

### Mocked or intentionally limited

- no real external barcode product API
- no OCR expiry extraction
- no real multi-user auth
- no real push token registration backend
- no scheduled reminder worker/cron
- no family/household model

## Recommended Production Replacements First

1. Replace internal seeded barcode lookup with a real product data source and fallback cache strategy.
2. Add authentication and real user ownership instead of `ownerKey="demo-user"`.
3. Add a reminder scheduler and push delivery pipeline.
4. Add image upload/storage instead of placeholder image URLs.
5. Add OCR-based expiry parsing after the registration flow is already stable.

## Recommended Next Implementation Order

1. Harden API validation and add API tests
2. Add mobile date picker and better input UX for expiry dates
3. Add admin create/edit validation feedback
4. Add push token registration + scheduled reminder jobs
5. Add unmatched barcode triage workflow
6. Add auth and multi-household data model
7. Add analytics and subscription boundaries only after retention signals exist

## Notes On Running

- `packages/shared` is built to `dist` and consumed as a workspace package
- root `dev` watches `packages/shared` so changes propagate during local development
- mobile barcode scanning uses Expo camera and product lookup is API-ready
- notification UI is real, but remote push delivery is not implemented yet

## Versioning Notes

This repo was shaped around current official docs for the main framework assumptions used here:

- Expo SDK reference and package docs: https://docs.expo.dev/versions/latest/
- Expo Camera: https://docs.expo.dev/versions/latest/sdk/camera/
- Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
- Next.js App Router installation: https://nextjs.org/docs/app/getting-started/installation
- Next.js dynamic segments: https://nextjs.org/docs/15/app/api-reference/file-conventions/dynamic-routes
# ExpiryMate
