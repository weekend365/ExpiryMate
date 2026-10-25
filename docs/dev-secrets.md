---
status: active
owner: platform
last_reviewed: 2026-10-20
source_of_truth: true
---

# 환경변수 · 시크릿 설정 가이드

로컬·Cloud·EAS·Railway에서 **어디에 무엇을 넣는지**를 한곳에 정리합니다.  
상세 배포 절차는 [`PROJECT.md` §5](./PROJECT.md#5-배포--운영-런북), iOS 스토어는 [`ios-eas-production.md`](./ios-eas-production.md)를 보세요.

| 도구 | 역할 |
|------|------|
| **Doppler `dev`** | 로컬/Cursor Cloud 개발용 시크릿 정본 |
| **로컬 `.env` 파일** | Nest / Next / Expo가 실제로 읽는 디스크 캐시 |
| **EAS Environment variables** | 모바일 preview / production 빌드에 주입 |
| **Railway Variables** | API · Admin 운영 런타임 |
| **`.env.example`** | 키 목록 문서 (실값 없음 · git에 있음) |

---

## 0. 환경별 정본 (반드시 분리)

```text
┌─────────────────────┐
│  .env.example       │  키 이름·기본값 문서
└─────────┬───────────┘
          │ 키 추가 시 Doppler/EAS/Railway에도 반영
          ▼
┌─────────────────────┐     download      ┌──────────────────────┐
│ Doppler config=dev  │ ───────────────▶ │ apps/api/.env        │
│ api / admin / mobile│                  │ apps/admin/.env.local│
└─────────────────────┘                  │ apps/mobile/.env     │
                                         └──────────────────────┘
                                                  ▲
                                                  │ Cursor Cloud
                                         ┌────────┴────────┐
                                         │ DOPPLER_TOKEN   │
                                         │ 또는 Cursor Sec.│
                                         └─────────────────┘

운영 (dev와 섞지 말 것)
┌─────────────────────┐
│ EAS · production    │ ──▶ eas build --profile production
│ (mobile EXPO_PUBLIC_*)
└─────────────────────┘
┌─────────────────────┐
│ Railway Variables   │ ──▶ API / Admin 컨테이너
└─────────────────────┘
```

| 환경 | 정본 | 로컬 파일 | 대표 값 |
|------|------|-----------|---------|
| **로컬 개발** | Doppler `dev` | `apps/*/ .env*` | `localhost:4000` / `development` |
| **Cursor Cloud** | Doppler `dev` 또는 Cursor Secrets | 부팅 시 동일 경로에 생성 | 로컬과 동일 키 |
| **모바일 스토어/TestFlight** | **EAS** `production` (또는 `preview`) | 쓰지 않음 (빌드 워커에 주입) | Railway API URL / `production` |
| **API·Admin 운영** | **Railway** Variables | 쓰지 않음 | 공개 HTTPS · 실비밀 |

**금지:** 프로덕션 Railway/EAS 값을 Doppler `dev`에 그대로 복사해 일상 개발 `.env`로 쓰는 것.  
반대로 Doppler `dev`의 localhost 값을 EAS production에 넣으면 스토어 빌드가 깨집니다.

---

## 1. 로컬 개발 (Doppler → `.env`)

### 1-1. 설치 · 로그인 · 매핑

```bash
brew install dopplerhq/cli/doppler
doppler login
cd /path/to/ExpiryMate
doppler setup --no-interactive   # doppler.yaml 기준
```

| Doppler project | config | 로컬 경로 |
|-----------------|--------|-----------|
| `expirymate-api` | `dev` | `apps/api/.env` |
| `expirymate-admin` | `dev` | `apps/admin/.env.local` |
| `expirymate-mobile` | `dev` | `apps/mobile/.env` |

### 1-2. 평소: Doppler → 로컬

```bash
doppler secrets download -p expirymate-api -c dev --no-file --format env > apps/api/.env
doppler secrets download -p expirymate-admin -c dev --no-file --format env > apps/admin/.env.local
doppler secrets download -p expirymate-mobile -c dev --no-file --format env > apps/mobile/.env
```

그다음:

```bash
pnpm install
docker compose -f docker-compose.yml -f .cursor/compose.postgres.yml up -d postgres
pnpm db:generate && pnpm db:migrate
pnpm dev
```

### 1-3. 로컬에만 있던 실값을 Doppler에 올릴 때

```bash
# 실값이 채워진 파일만 upload (빈 .env.example 올리지 말 것)
doppler secrets upload apps/api/.env -p expirymate-api -c dev
doppler secrets upload apps/admin/.env.local -p expirymate-admin -c dev
doppler secrets upload apps/mobile/.env -p expirymate-mobile -c dev
```

단일 키:

```bash
doppler secrets set EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID="…" -p expirymate-mobile -c dev
```

### 1-4. mobile `dev`가 지켜야 할 값

| 키 | 권장 (로컬) |
|----|-------------|
| `EXPO_PUBLIC_APP_ENV` | `development` |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:4000` |
| `EXPO_PUBLIC_WEB_BASE_URL` | `http://localhost:3000` |
| OAuth client ID / Sentry | 실클라이언트 값 (빈 문자열이면 로그인·관측 불가) |

운영 API를 로컬 앱에서 치려면 **별도 파일**(예: gitignored `.env.production.local`)이나 임시 교체만 하고, Doppler `dev` 정본은 localhost로 유지하세요.

### 1-5. (선택) 파일 없이 프로세스 주입

```bash
cd apps/api && doppler run -- pnpm dev
cd apps/admin && doppler run -- pnpm dev
cd apps/mobile && doppler run -- pnpm dev
```

루트 `pnpm dev`와 같이 쓰려면 **§1-2 download**가 더 단순합니다.

---

## 2. `.env.example` 기준으로 Doppler 키 맞추기

레포 example이 **키 목록의 문서**입니다. example에만 있는 키는 Doppler에 추가하고, Doppler에만 남은 옛 키는 정리 후보입니다.

**주의:** `doppler secrets upload apps/*/.env.example` 금지 — 빈 값이 실비밀을 덮습니다.

### 2-1. diff (API 예)

```bash
doppler secrets download -p expirymate-api -c dev --no-file --format env \
  | sed -n 's/=.*//p' | grep -v '^DOPPLER_' | sort > /tmp/doppler-api-keys.txt

grep -E '^[A-Z_][A-Z0-9_]*=' apps/api/.env.example \
  | sed 's/=.*//' | sort > /tmp/example-api-keys.txt

echo "=== Doppler에만 있음(정리 후보) ==="
comm -23 /tmp/doppler-api-keys.txt /tmp/example-api-keys.txt

echo "=== example에만 있음(추가 필요) ==="
comm -13 /tmp/doppler-api-keys.txt /tmp/example-api-keys.txt
```

Admin / Mobile:

```bash
# admin: -p expirymate-admin · apps/admin/.env.example · /tmp/doppler-admin-keys.txt
# mobile: -p expirymate-mobile · apps/mobile/.env.example · /tmp/doppler-mobile-keys.txt
```

### 2-2. 빠진 키만 추가

example 기본값으로 `doppler secrets set KEY=value -p … -c dev` 하거나 대시보드에서 Add Secret.  
OAuth·Sentry·OpenAI 등 **실값은 메모장/기존 `.env`에서 채워** 빈 문자열로 두지 마세요.

### 2-3. download가 로컬 실값을 지운 경우

Doppler에 키가 있으나 **값이 빈 문자열**이면 download가 채워진 로컬 `.env`를 덮어씁니다.

1. 백업/메모장의 실값을 로컬 `.env`에 복구  
2. 같은 값을 `doppler secrets set`으로 Doppler에 다시 기록  
3. 그다음부터 download

---

## 3. EAS (모바일 빌드 환경)

`eas.json`의 프로필이 `"environment": "production"` 등이면, **Expo 대시보드 Environment variables**의 해당 환경이 빌드에 주입됩니다.  
로컬 `apps/mobile/.env` / Doppler `dev`와 **자동 동기화되지 않습니다.**

### 3-1. 대시보드 (권장)

1. [expo.dev](https://expo.dev) → 프로젝트 `@devnamu/expirymate`  
2. **Environment variables**  
3. Add / Edit — **Environment**에 `production` (또는 `preview`) 체크  

### 3-2. CLI

```bash
cd apps/mobile
eas env:create --name EXPO_PUBLIC_WEB_BASE_URL \
  --value https://jango.devnamu.com \
  --environment production \
  --visibility plaintext

eas env:list --environment production
```

### 3-3. production에 둘 핵심 키

| 키 | 예 |
|----|-----|
| `EXPO_PUBLIC_APP_ENV` | `production` |
| `EXPO_PUBLIC_API_BASE_URL` | Railway API `https://…up.railway.app` |
| `EXPO_PUBLIC_OAUTH_REDIRECT_URI` | `{API}/oauth/callback` |
| `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` | 실클라이언트 ID |
| `EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID` | 실클라이언트 ID |
| `EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID` | 실클라이언트 ID |
| `EXPO_PUBLIC_WEB_BASE_URL` | `https://jango.devnamu.com` |
| `EXPO_PUBLIC_SENTRY_DSN` | `jango-mobile` DSN |
| `SENTRY_AUTH_TOKEN` | Sentry 소스맵·dSYM 업로드용 secret (production 필수) |
| `EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED` | 기본 `true`; `false`/`0`/`off`로 진입점 비활성화 |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | AdMob 앱 ID (빌드 검증 필수) |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | 〃 |
| `EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID` | 리워드 유닛 |
| `EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID` | 〃 |

AdMob 4개가 비어 있으면 production EAS 빌드가 `validate-public-env`에서 실패할 수 있습니다.  
`EXPO_PUBLIC_*`는 앱 바이너리에 들어가므로 **비밀키·서버 시크릿을 넣지 마세요.**

production 프로필은 EAS의 `SENTRY_AUTH_TOKEN`으로 소스맵·dSYM을 자동 업로드합니다.
토큰이 없는 임시 빌드가 필요할 때만 `SENTRY_DISABLE_AUTO_UPLOAD=true`를 명시적으로
추가할 수 있으며, 이 경우 런타임 오류 수집은 유지되지만 심볼 업로드는 생략됩니다.

변수 변경 후 **새 빌드**를 돌려야 반영됩니다. 이미 끝난 IPA에는 적용되지 않습니다.

### 3-4. 빌드

```bash
cd apps/mobile
eas build --platform ios --profile production
# 로그에 App Version / env 로드 확인 후
eas submit --platform ios --profile production
```

iOS 마케팅 버전·native 정렬: [`ios-eas-production.md`](./ios-eas-production.md).

---

## 4. Railway (API · Admin 운영)

| 서비스 | 넣는 곳 | 참고 |
|--------|---------|------|
| API | Railway → API 서비스 → Variables | `DATABASE_URL`, `AUTH_*`, OAuth secret, `PRIVACY_*`, `SENTRY_DSN`, SMTP/Resend 등 |
| Admin | Railway → Admin → Variables (+ Build args) | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_ENV=production`, `PRIVACY_CONTACT_EMAIL` |

- Privacy/마케팅 URL을 `jango.devnamu.com`으로 쓸 때 API의 `PRIVACY_POLICY_URL` / `PRIVACY_CHOICES_URL` / `ADMIN_BASE_URL` / CORS도 맞출 것.  
- 전체 키 맵: [`apps/api/.env.production.example`](../apps/api/.env.production.example), [`PROJECT.md` §5](./PROJECT.md#5-배포--운영-런북).
- 영수증·냉장고 사진 파싱(`INVENTORY_PHOTO_PARSE_*`, 모바일
  `EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED`)은 코드상 기본 on이며,
  `false`/`0`/`off`를 명시하면 끌 수 있습니다. 2026-08-27 Doppler
  `dev`/`stg`/`prd`와 Railway API production에 넣어 둔 기존 명시값이
  `false`라면 새 기본값을 덮으므로, 실제 활성화 시 API·모바일 값을 함께
  `true`로 바꿔야 합니다. API migration 배포 후 스토어 빌드를 EAS에서
  재빌드합니다. 기록:
  [`archive/project-history-2026-08.md`](./archive/project-history-2026-08.md).

로컬에서 Railway DB를 건드릴 때는 **Public TCP** `DATABASE_URL`을 쓰고, 그 값을 Doppler `dev` 기본값으로 고정하지 마세요.

---

## 5. Cursor Cloud Agents

대시보드: [Cloud Agents](https://cursor.com/dashboard/cloud-agents)

| 방식 | 설정 | 결과 |
|------|------|------|
| **A. Cursor Secrets** | Runtime Secret / Environment Variable | `scripts/cursor-cloud-env.mjs`가 `.env` 생성 |
| **B. Doppler 토큰 (권장)** | Secret `DOPPLER_TOKEN` (dev 읽기) | 부팅·수동 download로 동일 파일 |

부팅: `install` → `start`(Docker → `cursor-cloud-env.mjs` → Postgres).  
Cloud에서는 API/Admin/테스트 위주. Expo 실기기는 로컬이 낫습니다.

이름 충돌 (`SENTRY_DSN` 등): `API_` / `ADMIN_` / `MOBILE_` 접두사.  
키 맵은 아래 [부록](#부록-cursor-secret--앱-env-키).

---

## 6. 새 머신 / 다른 PC 체크리스트

```bash
git clone <repo> && cd ExpiryMate
pnpm install

brew install dopplerhq/cli/doppler
doppler login
doppler setup --no-interactive

doppler secrets download -p expirymate-api -c dev --no-file --format env > apps/api/.env
doppler secrets download -p expirymate-admin -c dev --no-file --format env > apps/admin/.env.local
doppler secrets download -p expirymate-mobile -c dev --no-file --format env > apps/mobile/.env

# OAuth/Sentry 등이 비어 있으면 §2-3 복구 후 Doppler set
docker compose -f docker-compose.yml -f .cursor/compose.postgres.yml up -d postgres
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

시크릿 매니저 없이 example만:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env
# 값을 채운 뒤 §1-3 upload
```

스토어 빌드용 새 PC에서는 추가로:

1. `eas login`  
2. EAS production 변수 확인 (§3)  
3. native `MARKETING_VERSION` / `CFBundleShortVersionString`이 `app.json` version과 일치하는지 확인  

---

## 7. 하지 말 것

- `.env` / `.env.local` git 커밋  
- 프로덕션 Railway/EAS 시크릿을 Doppler `dev`에 그대로 복사  
- **빈 값이 들어 있는 Doppler로 `download`해 채워진 로컬 `.env` 덮어쓰기**  
- `doppler secrets upload …/.env.example`  
- 채팅·PR에 실키 붙여넣기  
- `AUTH_TOKEN_SECRET=replace-with-a-long-random-secret` 방치  
- EAS 변수만 바꾸고 **재빌드 없이** 스토어에 반영되길 기대하기  

노출했다면 해당 프로바이더에서 **즉시 로테이션**.

---

## Android 푸시 설정 — 2026-10-20 QA

Android 42의 실제 Play 설치본에서 권한 거부 동작은 정상이며, 허용 뒤에는 기기 연결
오류를 확인했다. 바이너리에 Firebase client 리소스가 없고 EAS 앱에도 FCM V1 서버키가
등록돼 있지 않았다. 기존 Google 프로젝트의 Firebase Management 읽기 요청은
`SERVICE_DISABLED`로 거부됐다. [실기기 증거](../design/reviews/store-qa-20261020/android-42-notification-allowed.png)와
[EAS 설정 상태](../design/reviews/store-qa-20261020/android-push-credential-status.json)를 구분해 보존한다.

클라이언트 설정은 EAS `preview`의 **file 변수 `GOOGLE_SERVICES_JSON`**에 넣는다.
값은 현재 Android package용 `google-services.json`의 경로다. 앱 설정이 이 파일을 Expo의
`android.googleServicesFile`로 연결하고 Prebuild가 native 리소스를 만든다.
`apps/mobile/google-services*.json`은 git에서 제외한다. 로컬 development 식별자는 별도
Firebase client 설정을 사용해야 하며 production package 설정을 그대로 쓰지 않는다.

검사기는 package·project number·Android app ID·client API key의 존재를 확인하고,
서비스 계정 private key가 섞인 파일을 거부한다. Android store QA 워커는 이 파일이
없으면 빌드를 중단한다. 기존 일반 production 빌드의 설정 필수값은 변경하지 않는다.

FCM 전송용 **서버 서비스 계정 JSON**은 클라이언트 file 변수에 넣지 않는다. 별도 EAS
FCM V1 credentials에 등록한다. 사용자 승인 후 기존 `jango-plz` 프로젝트에 Firebase와
`com.expirymate.mobile` Android client를 등록했다. Spark 무료 요금제를 유지하고
Google Analytics는 켜지 않았다. 전송 전용 `jango-mobile-push` 서비스 계정에
`roles/firebasecloudmessaging.admin`만 부여하고 기존 EAS 앱의 FCM V1 키로 등록했다.
기존 Play 구매 검증용 서비스 계정의 권한은 늘리지 않았다.

[등록 후 설정 상태](../design/reviews/store-qa-20261020/android-push-credential-status-after.json)와
[Android 43 바이너리 확인](../design/reviews/store-qa-20261020/android-43-artifact-verification.json)을
보존한다. 실제 Play 설치본 43에서 연결 확인·백그라운드 알림 수신·탭 후 해당 개인
보관함 이동을 확인했다. [검증과 중단 기록](../design/reviews/store-qa-20261020/README.md)을 따른다.
client 파일 검사나 토큰 등록만으로 수신 성공을 판정하지 않는다.

이번 client file 변수는 QA용 `preview` 환경에 등록했다. 향후 production Android 빌드에는
해당 EAS 환경의 client file 등록과 재검증이 필요하며, 이번 작업은 공개 배포를 포함하지
않는다. private server key 원본은 저장소에 넣지 않고 EAS 등록 후 로컬 임시 사본을 정리한다.
[Expo 공식 FCM 안내](https://docs.expo.dev/push-notifications/fcm-credentials/)를 따른다.

## 관련 파일

- [`doppler.yaml`](../doppler.yaml) — 앱 경로 ↔ Doppler project  
- [`.cursor/environment.json`](../.cursor/environment.json) — Cloud 부팅  
- [`scripts/cursor-cloud-env.mjs`](../scripts/cursor-cloud-env.mjs) — Cursor Secrets → `.env`  
- [`apps/mobile/eas.json`](../apps/mobile/eas.json) — EAS 프로필 ↔ environment  
- [`apps/*/ .env.example`](../apps/api/.env.example) — 키 목록  

---

## 부록: Cursor Secret ↔ 앱 env 키

### `apps/api/.env`

| env 키 | Cursor Secret (권장) |
|--------|----------------------|
| `DATABASE_URL` | `DATABASE_URL` |
| `AUTH_TOKEN_SECRET` | `AUTH_TOKEN_SECRET` 또는 `API_AUTH_TOKEN_SECRET` |
| `OPENAI_API_KEY` | `OPENAI_API_KEY` |
| `RESEND_API_KEY` / `SMTP_*` | 동명 또는 `API_*` |
| OAuth client/secret | 동명 |
| `SENTRY_DSN` | **`API_SENTRY_DSN`** |
| `PRIVACY_CONTACT_EMAIL` | `API_PRIVACY_CONTACT_EMAIL` 또는 동명 |

### `apps/admin/.env.local`

| env 키 | Cursor Secret |
|--------|---------------|
| `NEXT_PUBLIC_API_BASE_URL` | 동명 또는 `ADMIN_*` |
| `SENTRY_DSN` | **`ADMIN_SENTRY_DSN`** |
| `NEXT_PUBLIC_SENTRY_DSN` | 동명 또는 `ADMIN_*` |

### `apps/mobile/.env`

| env 키 | Cursor Secret |
|--------|---------------|
| `EXPO_PUBLIC_*` | 동명 (`MOBILE_` 접두사도 가능) |

로컬에서 materialize 미리보기:

```bash
AUTH_TOKEN_SECRET='…' OPENAI_API_KEY='…' node scripts/cursor-cloud-env.mjs
```
