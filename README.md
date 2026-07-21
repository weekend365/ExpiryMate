# 장고야 부탁해 (Jango) MVP Monorepo

**장고야 부탁해** (영문: **Jango**) is a Korean-first ingredient inventory, expiry reminder, and AI recipe recommendation MVP. The mascot character is **장고** (Jango).

> Technical package names and bundle IDs still use the legacy `expirymate` namespace (`@expirymate/*`, `com.expirymate.mobile`). User-facing brand strings live in `@expirymate/shared` → `appBrand`.

The current product assumption for this MVP is explicit:

- users must log in (Kakao → Naver → Google → Apple, or email)
- users register ingredients and household goods manually (or via barcode/OCR scanner on native builds)
- expiry date is entered separately (or OCR-assisted)
- registered inventory data is used for AI recipe recommendation

## Why This Monorepo Shape

This repository uses `pnpm` workspaces only.

- `apps/mobile` is the Korean user-facing product
- `apps/admin` is the internal operations tool for product and inventory data
- `apps/api` is the single REST backend for both clients
- `packages/shared` holds safe-to-share contracts and inventory/expiry utilities

This keeps the MVP simple while leaving a clean path for:

- improving recipe recommendation from registered inventory
- shipping barcode + OCR scanner in EAS/store builds (already verified on iOS dev builds)
- subscriptions, households, and analytics without a rewrite

## Project status & launch priorities

출시 진척도·우선순위·배포 런북은 **단일 기준 문서**를 보세요:

**[docs/PROJECT.md](./docs/PROJECT.md)**

### Current status (2026-07-20)

| Area | Status | Notes |
| ---- | ------ | ----- |
| **Phase** | 0 done → **1 (QA)** | [docs/PROJECT.md](./docs/PROJECT.md) |
| **Auth** | Kakao · Naver · Google · Email ✅ | Login required · mail domain `mail.devnamu.com` · Apple needs paid Apple Developer |
| **API / Admin** | Live on Railway | `api-production-1504` · `admin-production-da74` |
| **Scanner** | iOS device verified | Expo Go ❌ · EAS/dev build |
| **Next (P0)** | | `/health` uptime · remaining device QA · Mobile Sentry later ([docs/PROJECT.md](./docs/PROJECT.md)) |

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
│       │   └── scanner.tsx          # 바코드·유통기한 스캐너 라우트
│       ├── assets
│       └── src
│           └── features/scanner/    # ScannerScreen, useProductScanner, parseExpirationDate
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
Production examples live next to each app:

- `apps/api/.env.production.example`
- `apps/admin/.env.production.example`
- `apps/mobile/.env.production.example`

### API

Copy `apps/api/.env.example` to `apps/api/.env`

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/expirymate?schema=public"
PORT=4000
CORS_ORIGIN_ADMIN="http://localhost:3000"
CORS_ORIGIN_MOBILE="http://localhost:8081"
DEFAULT_OWNER_KEY="demo-user"
AUTH_TOKEN_SECRET="replace-with-a-long-random-secret"
AUTH_ALLOW_DEV_FALLBACK="false"
PRIVACY_POLICY_URL="http://localhost:3000/privacy"
PRIVACY_CHOICES_URL="http://localhost:3000/privacy/choices"
PRIVACY_CONTACT_EMAIL="privacy@expirymate.local"
AI_DATA_NOTICE_VERSION="ai-data-notice-v1"
OPENAI_API_KEY="sk-..."
RECIPE_AI_MODEL="gpt-5.4-mini"
PUSH_REMINDER_SCHEDULER_ENABLED="false"
PUSH_REMINDER_SCHEDULER_INTERVAL_MINUTES=30
PUSH_REMINDER_DELIVERY_HOUR=9
PUSH_REMINDER_MAX_ATTEMPTS=3
PUSH_REMINDER_TIMEZONE_OFFSET_MINUTES=540
EXPO_PUSH_ACCESS_TOKEN=""
IAP_ALLOWED_PRODUCT_IDS="expirymate_premium_monthly,expirymate_premium_yearly"
APPLE_BUNDLE_ID="com.expirymate.mobile"
APPLE_APP_STORE_ENVIRONMENT="sandbox"
APPLE_APP_STORE_ISSUER_ID=""
APPLE_APP_STORE_KEY_ID=""
APPLE_APP_STORE_PRIVATE_KEY=""
GOOGLE_PLAY_PACKAGE_NAME="com.expirymate.mobile"
GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL=""
GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY=""
```

`AUTH_TOKEN_SECRET` is required in production. `AUTH_ALLOW_DEV_FALLBACK` defaults to disabled; set it to `true` only for local admin/dev fallback without a bearer token.
Set `PUSH_REMINDER_SCHEDULER_ENABLED=true` only on the server instance that should send remote expiry reminders. `EXPO_PUSH_ACCESS_TOKEN` is optional unless Expo push security is enabled for the EAS project.
Auth endpoints have built-in rate limits. Override a policy with `AUTH_RATE_LIMIT_<POLICY>_MAX` and `AUTH_RATE_LIMIT_<POLICY>_WINDOW_SECONDS` only when traffic patterns require it.

When `NODE_ENV=production`, the API fails fast if production-critical values are missing, unsafe, or still local:

- public HTTPS URLs: `CORS_ORIGIN_ADMIN`, `CORS_ORIGIN_MOBILE`, `ADMIN_BASE_URL`, `PRIVACY_POLICY_URL`, `PRIVACY_CHOICES_URL`
- auth: `AUTH_TOKEN_SECRET` with at least 32 characters and `AUTH_ALLOW_DEV_FALLBACK=false`
- OAuth: `APPLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `KAKAO_OAUTH_CLIENT_ID` (optional: `KAKAO_OAUTH_CLIENT_SECRET`, `NAVER_OAUTH_CLIENT_ID`, `NAVER_OAUTH_CLIENT_SECRET`)
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- IAP: `IAP_ALLOWED_PRODUCT_IDS`, Apple App Store server API keys, Google Play service account keys
- privacy contact: `PRIVACY_CONTACT_EMAIL`

### Admin

Copy `apps/admin/.env.example` to `apps/admin/.env.local`

```env
NEXT_PUBLIC_APP_ENV="development"
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"
PRIVACY_CONTACT_EMAIL="privacy@expirymate.local"
```

For production builds, set `NEXT_PUBLIC_APP_ENV=production`,
`NEXT_PUBLIC_API_BASE_URL` to the public HTTPS API URL, and
`PRIVACY_CONTACT_EMAIL` to the real support/privacy email. The Admin build
fails if production values still point to localhost or `.local`.

### Mobile

Copy `apps/mobile/.env.example` to `apps/mobile/.env`

```env
EXPO_PUBLIC_API_BASE_URL="http://localhost:4000"
EXPO_PUBLIC_APP_ENV="development"
EXPO_PUBLIC_IAP_PRODUCT_IDS="expirymate_premium_monthly,expirymate_premium_yearly"
```

For production EAS builds, configure the values from
`apps/mobile/.env.production.example` in EAS environment variables or secrets.
`EXPO_PUBLIC_API_BASE_URL` must be a public `https://` API URL, and the Google,
Kakao, and IAP public identifiers must be present. The Expo config fails the
production build when these values are missing or local.

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

**Barcode / expiry scanner (camera, ML Kit):** not available in Expo Go. Use a native dev build:

```bash
# Terminal 1
pnpm --filter @expirymate/mobile dev

# Terminal 2 (first time or after native dep changes)
pnpm --filter @expirymate/mobile exec expo run:ios --device "Your iPhone"
# or: expo run:android
```

See [docs/PROJECT.md](./docs/PROJECT.md) (scanner + Personal Team notes) for iOS signing and troubleshooting.

## App Store Build

Mobile App Store configuration lives in `apps/mobile/app.json` and
`apps/mobile/eas.json`. App icon / adaptive icon / splash / Android notification
icon are derived from `apps/mobile/assets/characters/jango-idle.png` into
`apps/mobile/assets/branding/` (regenerate with
`pnpm --filter @expirymate/mobile branding:sync`). Mood variants live beside
the source as `jango-{idle,happy,worry,cooking,empty}.png`. Character rules:
[`docs/JANGO_CHARACTER_STYLE_GUIDE.md`](./docs/JANGO_CHARACTER_STYLE_GUIDE.md).

Install and authenticate EAS CLI before building:

```bash
npm install --global eas-cli
eas login
```

Run App Store builds from the Expo project directory:

```bash
cd apps/mobile
eas config
eas build --platform ios --profile production
eas submit --platform ios --profile production
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

Recipe generation is protected by configurable server-side limits:
`RECIPE_RATE_LIMIT_MAX`, `RECIPE_RATE_LIMIT_WINDOW_SECONDS`,
`RECIPE_DAILY_QUOTA`, `RECIPE_CACHE_TTL_SECONDS`,
`RECIPE_DAILY_COST_LIMIT_USD`, and `RECIPE_AI_MAX_OUTPUT_TOKENS`. Cost
estimates use the model token rates in `RECIPE_AI_INPUT_COST_PER_1M_TOKENS`,
`RECIPE_AI_CACHED_INPUT_COST_PER_1M_TOKENS`, and
`RECIPE_AI_OUTPUT_COST_PER_1M_TOKENS`.

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
- mascot **장고** (Jango) for recipe-oriented empty and success states

### Admin

- dashboard
- product list and quick create
- product detail/edit
- inventory list
- seed status page

### API

- registered auth (email + Kakao/Naver/Google/Apple OAuth) — login required on mobile
- products / inventory / dashboard
- recipe recommendations
- privacy & account deletion
- product-masters lookup (barcode waterfall)
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
- `expiryDate` (`YYYY-MM-DD` date-only, KST calendar date)
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
- `GET /subscriptions/entitlement`
- `POST /subscriptions/verify`
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

> Authoritative launch status: [docs/PROJECT.md](./docs/PROJECT.md).

### Real in this starter

- monorepo wiring
- shared contracts and expiry utilities
- Nest REST modules
- Prisma schema and seed
- mobile onboarding, register, inventory, settings flows
- **login required** · Kakao → Naver → Google → Apple iOS, plus email register/login/verify
- **product scanner:** barcode → ProductMaster/OFF → expiry OCR → register prefill
- AI recipe recommendation API and mobile recommendation tab
- subscription entitlement API with App Store and Google Play server verification
- admin product and inventory tooling
- recipe-oriented mascot asset (장고)
- Resend mail via `mail.devnamu.com` (domain verified)

### Mocked or intentionally limited

- OCR/scanner: **dev/native builds only** (not Expo Go); Android + EAS production QA pending
- Apple Sign In: code ready; needs paid Apple Developer Program
- API/Admin custom hostnames still on `*.up.railway.app` (mail subdomain only on `devnamu.com`)
- no native IAP purchase sheet yet (entitlement status only)
- no family/household model

## Recommended next work

See **[docs/PROJECT.md §2](./docs/PROJECT.md#2-서비스-전-우선순위-지금-당장)** for the live priority list.

1. `/health` uptime monitor
2. Remaining device QA (social · inventory · AI · account delete) — email E2E ✅ · Sentry API/Admin ✅
3. Mobile Sentry preview smoke (deferred) · Apple Developer · EAS iOS · store submission
4. Post-launch: custom API/Admin domains, IAP UI, catalog UX, analytics, households

## Notes On Running

- `packages/shared` is built to `dist` and consumed as a workspace package
- root `dev` watches `packages/shared` so changes propagate during local development
- remote push delivery requires an EAS project with push credentials and
  `PUSH_REMINDER_SCHEDULER_ENABLED=true` on one API server
- recipe recommendation requires `OPENAI_API_KEY` in `apps/api/.env`
- recommendation rate limit, quota, cache TTL, output token cap, and daily cost
  cap are controlled with the `RECIPE_*` environment variables
- subscription server verification requires App Store Server API or Google Play
  Developer API credentials in `apps/api/.env`
- App Store/EAS build config is in `apps/mobile/app.json` and
  `apps/mobile/eas.json`; EAS CLI is not bundled with this repo

## Versioning Notes

This repo was shaped around current official docs for the main framework assumptions used here:

- Expo SDK reference and package docs: https://docs.expo.dev/versions/latest/
- Expo app config reference: https://docs.expo.dev/versions/latest/config/app/
- EAS Build config: https://docs.expo.dev/build/eas-json/
- Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
- Expo Push Service sending API: https://docs.expo.dev/push-notifications/sending-notifications/
- Next.js App Router installation: https://nextjs.org/docs/app/getting-started/installation
- Next.js dynamic segments: https://nextjs.org/docs/15/app/api-reference/file-conventions/dynamic-routes
