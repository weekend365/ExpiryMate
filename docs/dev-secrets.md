# 개발 시크릿 · Doppler & Cursor Cloud

로컬·원격에서 `apps/api/.env`, `apps/admin/.env.local`, `apps/mobile/.env`를 **git 없이** 맞추는 방법입니다.

| 도구 | 역할 |
|------|------|
| **Doppler** | 시크릿 소스 오브 트루스. 새 PC / 일상 개발에서 `.env` pull |
| **Cursor Cloud** | Cloud Agent VM. Secrets 또는 Doppler 토큰으로 동일 파일 생성 |

프로덕션(Railway / EAS) 값은 여기 `dev`와 **분리**하세요. 운영 env는 [`PROJECT.md` §5](./PROJECT.md#5-배포--운영-런북)를 보세요.

관련 파일:

- [`doppler.yaml`](../doppler.yaml) — 앱 경로 ↔ Doppler project 매핑
- [`.cursor/environment.json`](../.cursor/environment.json) — Cloud 부팅
- [`scripts/cursor-cloud-env.mjs`](../scripts/cursor-cloud-env.mjs) — Cursor Secrets → `.env` 파일
- [`.cursor/compose.postgres.yml`](../.cursor/compose.postgres.yml) — Cloud용 Postgres `5432` 노출

---

## 1. 한눈에 보기

```text
Doppler (expirymate-api / admin / mobile · config=dev)
        │  secrets download / upload
        ▼
apps/api/.env
apps/admin/.env.local
apps/mobile/.env
        ▲
        │  cursor-cloud-env.mjs 또는 DOPPLER_TOKEN + download
Cursor Cloud Secrets
```

Nest / Next / Expo는 **디스크의 `.env` 파일**을 읽습니다. Secrets만 process.env에 있고 파일이 없으면 앱이 키를 못 봅니다.

---

## 2. Doppler (일상 개발 · 권장)

### 2-1. 설치 · 로그인

```bash
brew install dopplerhq/cli/doppler
doppler login
```

### 2-2. 프로젝트 매핑

대시보드에 프로젝트 3개가 있어야 합니다.

| Doppler project | config | 로컬 경로 |
|-----------------|--------|-----------|
| `expirymate-api` | `dev` | `apps/api/` |
| `expirymate-admin` | `dev` | `apps/admin/` |
| `expirymate-mobile` | `dev` | `apps/mobile/` |

레포 루트 [`doppler.yaml`](../doppler.yaml):

```yaml
setup:
  - project: expirymate-api
    config: dev
    path: apps/api/
  - project: expirymate-admin
    config: dev
    path: apps/admin/
  - project: expirymate-mobile
    config: dev
    path: apps/mobile/
```

**레포 루트에서** (파일이 저장된 뒤):

```bash
doppler setup --no-interactive
```

`project must be specified...` 가 나오면:

1. cwd가 레포 루트인지 확인  
2. `doppler.yaml`이 저장됐는지 확인  
3. 프로젝트가 대시보드에 있는지 `doppler projects`로 확인  

스코프 확인:

```bash
cd apps/api && doppler configure
```

### 2-3. 최초: 로컬 → Doppler

로컬에 실값이 있는 `.env`가 있을 때 **한 번**:

```bash
# 레포 루트
doppler secrets upload apps/api/.env -p expirymate-api -c dev
doppler secrets upload apps/admin/.env.local -p expirymate-admin -c dev
doppler secrets upload apps/mobile/.env -p expirymate-mobile -c dev
```

대시보드에서 키를 직접 편집해도 됩니다. 키 이름은 각 앱 `.env.example`과 맞추세요.

### 2-4. 평소: Doppler → 로컬 파일

새 PC, 클론 직후, 또는 Cloud에서:

```bash
doppler secrets download -p expirymate-api -c dev --no-file --format env > apps/api/.env
doppler secrets download -p expirymate-admin -c dev --no-file --format env > apps/admin/.env.local
doppler secrets download -p expirymate-mobile -c dev --no-file --format env > apps/mobile/.env
```

그다음:

```bash
pnpm install
# Postgres (로컬 Docker 예)
docker compose -f docker-compose.yml -f .cursor/compose.postgres.yml up -d postgres
pnpm db:generate && pnpm db:migrate
pnpm dev
```

### 2-5. (선택) 파일 없이 프로세스 주입

```bash
cd apps/api && doppler run -- pnpm dev
cd apps/admin && doppler run -- pnpm dev
cd apps/mobile && doppler run -- pnpm dev
```

루트 `pnpm dev`(concurrently)와 같이 쓰려면 **§2-4 download**가 더 단순합니다.

### 2-6. 키 수정 후

1. 대시보드(또는 `doppler secrets set KEY value -p … -c dev`)에서 수정  
2. 다시 §2-4 download  
3. API/Admin/Expo 재시작  

---

## 3. Cursor Cloud Agents

대시보드: [Cloud Agents](https://cursor.com/dashboard/cloud-agents)

### 3-1. 환경 파일

| 파일 | 역할 |
|------|------|
| `.cursor/Dockerfile` | Node 22 + pnpm + Docker |
| `.cursor/environment.json` | `install` / `start` / ports |
| `AGENTS.md` | Cloud Agent용 짧은 지시 |

부팅 흐름:

1. `install` — `pnpm install`, shared build, `prisma generate`  
2. `start` — Docker → `node scripts/cursor-cloud-env.mjs` → Postgres compose  

### 3-2. 방식 A — Cursor Secrets만 (기본)

Secrets를 process.env로 넣고, `cursor-cloud-env.mjs`가 앱별 `.env`를 만듭니다.

**Secret 타입**

| 타입 | 용도 |
|------|------|
| Runtime Secret | API 키, OAuth secret, `AUTH_TOKEN_SECRET`, DB URL |
| Environment Variable | public URL, feature flag 등 비민감값 |

**최소 필수**

| 이름 | 비고 |
|------|------|
| `AUTH_TOKEN_SECRET` | 32자+ · placeholder 금지 |
| `DATABASE_URL` | Docker Postgres 쓰면 생략 가능(스크립트 기본값) |
| `OPENAI_API_KEY` | 레시피 테스트 시 |

**이름 충돌** (`SENTRY_DSN` 등): 접두사 사용

| Secret | 결과 파일 키 |
|--------|----------------|
| `API_SENTRY_DSN` | `apps/api/.env` → `SENTRY_DSN` |
| `ADMIN_SENTRY_DSN` | `apps/admin/.env.local` → `SENTRY_DSN` |
| `API_ENV_FILE` | `apps/api/.env` 통째로 덮어씀 (escape hatch) |

접두사: `API_` / `ADMIN_` / `MOBILE_`. 겹치지 않는 키는 접두사 없이 등록해도 됩니다.

상세 키 맵은 아래 [부록](#부록-cursor-secret--앱-env-키)을 보세요.

### 3-3. 방식 B — Doppler만 Cursor에 연결 (추천 장기)

Cursor Secrets에 **토큰만** 두고, 부팅 시 Doppler에서 pull:

| Cursor Secret | 값 |
|---------------|-----|
| `DOPPLER_TOKEN` | Service Token (`dev` 읽기) |

수동/스크립트 예:

```bash
doppler secrets download -p expirymate-api -c dev --no-file --format env > apps/api/.env
doppler secrets download -p expirymate-admin -c dev --no-file --format env > apps/admin/.env.local
doppler secrets download -p expirymate-mobile -c dev --no-file --format env > apps/mobile/.env
```

실제 앱 시크릿은 Doppler에만 두고, Cursor에는 토큰만 두면 로테이션이 쉽습니다.

### 3-4. Cloud에서 확인

```bash
test -f apps/api/.env && echo ok
pnpm db:migrate
pnpm test
pnpm dev:api
```

- Cloud에서는 **API · Admin · 단위 테스트** 위주. Expo 실기기는 로컬이 낫습니다.  
- Docker Postgres 실패 시 Runtime Secret `DATABASE_URL`을 공개 TCP URL로 설정.

---

## 4. 새 머신 체크리스트

```bash
git clone <repo> && cd ExpiryMate
pnpm install

brew install dopplerhq/cli/doppler   # 최초 1회
doppler login
doppler setup --no-interactive

doppler secrets download -p expirymate-api -c dev --no-file --format env > apps/api/.env
doppler secrets download -p expirymate-admin -c dev --no-file --format env > apps/admin/.env.local
doppler secrets download -p expirymate-mobile -c dev --no-file --format env > apps/mobile/.env

docker compose -f docker-compose.yml -f .cursor/compose.postgres.yml up -d postgres
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

example만으로 시작하려면 (시크릿 매니저 없이):

```bash
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env
# 값을 손으로 채운 뒤 §2-3 upload
```

---

## 5. 하지 말 것

- `.env` / `.env.local` git 커밋  
- 프로덕션 Railway/EAS 시크릿을 `dev`에 그대로 복사  
- 채팅·커밋 메시지에 실키 붙여넣기  
- `AUTH_TOKEN_SECRET=replace-with-a-long-random-secret` 방치  
- 빈 Doppler config로 `download` 후 기존 로컬 `.env`를 빈 파일로 덮어쓰기 (upload 전에 download 주의)

노출했다면 해당 프로바이더에서 **즉시 로테이션**.

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
