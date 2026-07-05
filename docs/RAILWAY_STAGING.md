# Railway 스테이징 배포 가이드

Step A 결정 사항:

- **호스팅:** Railway
- **도메인:** 없음 → Railway 기본 URL 사용 (`*.up.railway.app`)

## 사전 준비

1. [Railway](https://railway.app) 계정 생성
2. Railway CLI 설치 (선택, 대시보드만으로도 가능)

```bash
# macOS
brew install railway

# 또는
npm i -g @railway/cli

railway login
```

3. 강한 API secret 생성 (로컬에서 1회)

```bash
openssl rand -base64 48
```

---

## 1. Railway 프로젝트 생성

1. Railway 대시보드 → **New Project**
2. 프로젝트 이름: `expirymate-staging`

---

## 2. PostgreSQL 추가

1. 프로젝트 → **Add Service** → **Database** → **PostgreSQL**
2. 서비스 이름: `postgres`
3. **Variables** 탭에서 `DATABASE_URL` 복사 (API 서비스에서 참조)

---

## 3. API 서비스 배포

### 3-1. 서비스 생성

1. **Add Service** → **GitHub Repo** → `ExpiryMate` 저장소 선택
   - 또는 **Empty Service** → Docker 이미지 수동 배포
2. 서비스 이름: `api`
3. **Settings** → **Build**:
   - Builder: **Dockerfile**
   - Dockerfile Path: `apps/api/Dockerfile`
   - Root Directory: `/` (monorepo 루트)

### 3-2. Build Args (Settings → Build 또는 Variables)

| Variable      | 값                                       |
| ------------- | ---------------------------------------- |
| `GIT_SHA`     | `$RAILWAY_GIT_COMMIT_SHA` (Railway 내장) |
| `APP_VERSION` | `0.1.0`                                  |

### 3-3. Environment Variables

`docs/env.staging.example`를 참고해 **api** 서비스 Variables에 설정.

**반드시 Admin URL 확정 후 아래 3개를 맞춰야 합니다** (Admin 배포 후 2차 업데이트):

- `CORS_ORIGIN_ADMIN` = `https://<admin-service>.up.railway.app`
- `PRIVACY_POLICY_URL` = `https://<admin-service>.up.railway.app/privacy`
- `PRIVACY_CHOICES_URL` = `https://<admin-service>.up.railway.app/privacy/choices`

**DATABASE_URL:** Postgres 서비스 Variable Reference 사용

```
${{postgres.DATABASE_URL}}
```

(Railway UI에서 Postgres → Connect → Variable Reference)

### 3-4. Networking

1. **Settings** → **Networking** → **Generate Domain**
2. 생성된 URL 예: `https://expirymate-api-staging.up.railway.app`
3. 이 URL을 메모 → Admin 빌드·모바일 EAS secret에 사용

### 3-5. 검증

```bash
curl https://<api-domain>/health
curl https://<api-domain>/ready
```

기대 응답:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "0.1.0",
    "gitSha": "...",
    "env": "production"
  }
}
```

---

## 4. Admin 서비스 배포

Admin은 `NEXT_PUBLIC_*` 값이 **빌드 타임**에 고정됩니다. API Railway URL을 먼저 확정하세요.

### 4-1. 서비스 생성

1. **Add Service** → 동일 GitHub repo
2. 서비스 이름: `admin`
3. **Settings** → **Build**:
   - Dockerfile Path: `apps/admin/Dockerfile`

### 4-2. Build Args (중요)

| Build Arg                  | 값                                          |
| -------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://<api-domain>` (3-4에서 메모한 URL) |
| `NEXT_PUBLIC_APP_ENV`      | `production`                                |
| `PRIVACY_CONTACT_EMAIL`    | 실제 연락 가능 이메일                       |

Railway에서 Build Args 설정 위치: Service → Variables → **Add Variable** → "Add to Build" 체크

### 4-3. Runtime Variables

| Variable              | 값           |
| --------------------- | ------------ |
| `NODE_ENV`            | `production` |
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `PORT`                | `3000`       |

### 4-4. Networking

1. **Generate Domain** → 예: `https://expirymate-admin-staging.up.railway.app`
2. **API Variables 업데이트** (3-3의 CORS/PRIVACY URL을 Admin URL로)
3. API 서비스 **Redeploy** (CORS 변경 반영)

### 4-5. 검증

```bash
curl -I https://<admin-domain>/privacy
curl -I https://<admin-domain>/privacy/choices
```

브라우저에서 Admin 로그인 → 상품 CRUD 확인

---

## 5. API env 2차 업데이트 (Admin URL 반영)

Admin 도메인 확정 후 API 서비스 Variables 수정:

```env
CORS_ORIGIN_ADMIN=https://<admin-domain>
ADMIN_BASE_URL=https://<admin-domain>
PRIVACY_POLICY_URL=https://<admin-domain>/privacy
PRIVACY_CHOICES_URL=https://<admin-domain>/privacy/choices
```

→ API **Redeploy**

---

## 6. 스테이징 관리자 계정

`db:seed`는 사용하지 않습니다.

1. 모바일 앱 또는 API로 일반 회원가입
2. Railway Postgres → **Data** → Query:

```sql
UPDATE "User" SET role = 'admin' WHERE email = 'your-email@example.com';
```

3. Admin `/login`에서 해당 계정으로 로그인

---

## 7. 다음 단계 (Step C 이후)

| Step | 작업                         | 문서                         |
| ---- | ---------------------------- | ---------------------------- |
| C-1  | SMTP 설정 (이메일 인증)      | `docs/OPERATIONS_STEP_C.md`  |
| C-2  | EAS preview + API URL secret | `docs/DEPLOYMENT.md`         |
| C-3  | Sentry DSN 3종               | `docs/DEPLOYMENT.md`         |
| C-4  | Uptime monitor (`/health`)   | Better Stack, UptimeRobot 등 |

---

## 트러블슈팅

| 증상                | 원인                            | 해결                                                      |
| ------------------- | ------------------------------- | --------------------------------------------------------- |
| API 부팅 실패       | `validateProductionEnvironment` | Railway Logs 확인, `docs/env.staging.example` 전체 채우기 |
| Admin API 호출 실패 | Build Arg URL 오류              | `NEXT_PUBLIC_API_BASE_URL` 재설정 후 **Rebuild**          |
| CORS 에러           | Admin URL 불일치                | `CORS_ORIGIN_ADMIN` = Admin Railway URL                   |
| Migration 실패      | DB 연결                         | `DATABASE_URL` Variable Reference 확인                    |

---

## 비용 참고 (2026 기준 대략)

- Railway Hobby: $5/월 크레딧 포함
- Postgres + API + Admin ≈ 소규모 스테이징 월 $5~20 (트래픽에 따라)
