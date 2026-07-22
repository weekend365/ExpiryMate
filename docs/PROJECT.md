# 장고야 부탁해 (Jango) · 프로젝트 기준 문서

출시 진척도, 우선순위, 배포·운영을 **이 문서 하나**에 모았습니다.  
로컬 개발 온보딩은 [`README.md`](../README.md)를 보세요.

> **문서 기준일:** 2026-07-22  
> **제품 표시명:** 장고야 부탁해 (EN: Jango) · 마스코트: 장고  
> **기술 네임스페이스:** `@expirymate/*`, `com.expirymate.mobile` (의도적 레거시 ID)

---

## 1. 지금 어디인가

| 영역 | 완성도 | 한 줄 |
|------|--------|------|
| 모바일 핵심 UX | ~95% | 장고 UI 리디자인 완료 · 바코드/OCR 스캐너 iOS 실기기 검증 |
| 인증 | ~95% | **카카오·네이버·구글 + 이메일 실기기 E2E ✅** · Apple capability 반영 · TestFlight 검증 대기 |
| API 비즈니스 | ~85% | 재고·레시피·프라이버시·구독 검증·OAuth 콜백 |
| Admin | ~80% | Railway 배포 · shared 토큰·브랜드 동기화 |
| 배포/인프라 | ~90% | Railway · Resend · `/health` uptime ✅ · Sentry API/Admin ✅ |
| 스토어 출시 | ~55% | Android preview APK 있음 · iOS EAS·심사 자료 미착수 |
| 테스트/QA | ~90% | **실기기 QA·uptime ✅** · Sentry Mobile·Apple 로그인 후순위 |

**현재 Phase:** Phase 1 관문 대부분 완료 → **Phase 2 (스토어 제출 준비)**  
**최근 완료 (2026-07-21):** `/health` uptime · 실기기 QA 사인오프 (소셜·재고·AI·계정삭제·Admin·privacy)

### 프로덕션 URL

| 서비스 | URL |
|--------|-----|
| API | `https://api-production-1504.up.railway.app` (`/health`, `/ready`, `/oauth/callback`, `/auth/verify-email`) |
| Admin | `https://admin-production-da74.up.railway.app` (로그인, `/privacy`, `/privacy/choices`) |
| 메일 From | `noreply@mail.devnamu.com` (Resend · 도메인 `devnamu.com`) |
| Postgres | Railway internal |

> API/Admin 커스텀 도메인(예: `api.` / `admin.`)은 아직 `*.up.railway.app`. 메일 전용 서브도메인만 먼저 연결됨.

### 인증 현황

| 방식 | 상태 | 비고 |
|------|------|------|
| 카카오 | ✅ | `response_type=code` → API code 교환 |
| 네이버 | ✅ | code → API (`NAVER_OAUTH_*`) |
| 구글 | ✅ | code → API (`GOOGLE_OAUTH_CLIENT_ID` + **`GOOGLE_OAUTH_CLIENT_SECRET`**) |
| Apple | ⚠️ 설정 반영 · 실기기 대기 | Program 가입 완료 · entitlement/plugin/EAS production 프로파일 반영 → **TestFlight 검증** 남음 |
| 이메일 | ✅ 실기기 E2E | 가입·확인·재발송·비밀번호 재설정 통과. Resend HTTP + `mail.devnamu.com` |
| 익명 세션 | ❌ 제거 | 온보딩 → 로그인 → 앱. 비로그인 사용 불가 |

공통 Redirect URI (콘솔에 HTTPS만 등록):

`https://api-production-1504.up.railway.app/oauth/callback`  
→ 서버가 `exp://` / `expirymate://` deep link로 브릿지

모바일: `EXPO_PUBLIC_OAUTH_REDIRECT_URI` = 위 URL  
앱 복귀: `WebBrowser.openAuthSessionAsync`가 **앱 스킴**을 대기

이메일 인증 링크: `AUTH_LINK_BASE_URL` → HTTPS 브릿지(`/auth/verify-email`) → `expirymate://auth/verify-email?token=…`  
프로덕션: `AUTH_LINK_BASE_URL=https://api-production-1504.up.railway.app` (실기기 E2E로 확인됨) · 로컬: `http://localhost:4000`

---

## 2. 서비스 전 우선순위 (지금 당장)

기능·실기기 QA·uptime·Sentry(API/Admin)까지 갖춰졌습니다. **출시 블로커는 “EAS production 빌드·TestFlight 검증·심사 자료”** 쪽입니다.

### P0 — 스토어 직전 (Phase 2 관문)

| # | 작업 | 왜 |
|---|------|-----|
| 1 | ~~**Apple Developer Program 등록**~~ ✅ | Sign in with Apple · Push · TestFlight · App Store 공통 전제 |
| 2 | **EAS iOS/Android production 빌드** (스캐너 포함) | Capability는 코드 반영됨 → Railway API env로 archive · TestFlight 검증. 런북: [`docs/ios-eas-production.md`](./ios-eas-production.md) |
| 3 | **스토어 메타·심사용 자료** | Privacy Nutrition Label / Play Data Safety · 스크린샷 · Support URL · AI·계정삭제 심사 노트 |

### P1 — 병행 / 후순위

| # | 작업 | 왜 |
|---|------|-----|
| 4 | **Sentry Mobile** preview 스모크 | API·Admin ✅. Android preview는 Sentry 업로드 설정 정리 후 |
| 5 | API/Admin 커스텀 도메인 | Privacy·Support URL·브랜드 일관성 |
| 6 | Admin 보안 하드닝 | admin client role 거부 · refresh cookie Path=/auth · inventory pagination/mask · AdminAuditLog |
| 7 | 푸시 스케줄러 ON + receipt 처리 | `PUSH_REMINDER_SCHEDULER_ENABLED` · DB lease · receipt poll · stale pending 재시도 |
| 8 | ProductMaster source-fields migration 배포 확인 | 바코드 적재는 완료 — migration 잔여분만 |

### 의도적으로 미룸 (v1.1+ / Phase 4)

- 네이티브 IAP 구매 UI (서버 verify API만 있음)
- 가족/공유 보관함
- E2E 자동화 (Detox/Maestro)
- OCR·카탈로그 UX 고도화

---

## 3. Phase 로드맵

```mermaid
flowchart LR
  P0[Phase 0 인프라 ✅] --> P1[Phase 1 QA·관측성]
  P1 --> P2[Phase 2 스토어 제출]
  P2 --> P3[Phase 3 운영 안정화]
  P3 --> P4[Phase 4 수익화·성장]
```

| Phase | 목표 | Done Criteria (요약) |
|-------|------|----------------------|
| **0** ✅ | 외부 접속 가능 | Railway API/Admin/DB · health · CI · AUTH 하드닝 |
| **1** ✅ | 실사용 검증 | 실기기 QA · uptime · Sentry API/Admin ✅ (Mobile Sentry 후순위) |
| **2** 👈 | 스토어 공개 | Apple 계정 ✅ · capability/EAS 설정 ✅ · **production 빌드·심사 자료** · iOS/Android 승인 |
| **3** | 안정 운영 | 알림·백업·비용 한도·런북 |
| **4** | 수익화 | IAP UI · 카탈로그 · 분석 · 공유 |

### Phase 1 Done Criteria

- [x] Android/iOS 내부 빌드에서 Railway API 핵심 플로우 QA 통과 (소셜·재고·AI·계정삭제)
- [x] Sentry DSN · 스모크 — **API·Admin** (`sentry-smoke-api` / `sentry-smoke-admin`)
- [ ] Sentry Mobile preview 스모크 (`jango-mobile`) — 후순위
- [x] `/health` uptime monitor 등록
- [x] Resend 도메인 인증 (`mail.devnamu.com`) — 임의 수신자 메일
- [x] 프로덕션 `AUTH_LINK_BASE_URL` = Railway API HTTPS
- [x] **이메일 가입·메일 확인·로그인** 실기기 E2E
- [x] **미확인 재발송 · 비밀번호 재설정** 실기기 E2E
- [x] Privacy / Data Deletion URL 심사용으로 재확인
- [x] 소셜 로그인 3종 실기기 재검증

### Phase 1 수동 QA 체크리스트

```
[x] 온보딩 → 로그인(필수) → 탭 진입
[x] 카카오 / 네이버 / 구글 로그인 (HTTPS 콜백 → 앱 복귀)
[x] 이메일 가입 → 인증 메일 수신 → 링크/딥링크로 확인 → 홈 진입
[x] 이메일 로그인 · 미확인 계정 → verify-pending · 재발송
[x] 비밀번호 재설정 메일 → 새 비밀번호로 로그인
[ ] Apple 로그인 — TestFlight/유료 팀 서명 빌드에서 신규·재로그인
[x] 재료 수동 등록 → 홈·보관함 반영
[x] 홈 → 바코드 등록 → 워터폴 조회 → 유통기한 OCR → prefill (dev/EAS 빌드)
[x] AI 추천: 동의 → 생성 → 히스토리
[ ] 푸시 토큰 등록 (+ 스케줄러 ON 시 만료 알림) — capability 반영됨 · 실기기 수신 확인
[x] 계정 삭제 → 데이터 제거 확인
[x] Admin 로그인 → 상품 CRUD
[x] /privacy, /privacy/choices 접근
```

### Phase 2 Done Criteria (요약)

- [ ] iOS/Android production 빌드 + 실제 API
- [ ] App Store Privacy Label / Play Data Safety (`docs/store-privacy-declarations.md` 대조)
- [ ] Support URL · 스크린샷 · 앱 설명 · 심사 노트(AI·계정 삭제·OAuth)
- [ ] Sign in with Apple TestFlight 검증 + 스토어 정책 충족

---

## 4. 완료된 주요 작업

| 구분 | 항목 |
|------|------|
| 인프라 | Railway API·Admin·Postgres · Docker · `GET /health` `/ready` · helmet · seed 가드 |
| CI | GitHub Actions lint/typecheck/test · Prisma migrate deploy · API/Admin production build |
| 메일·도메인 | `devnamu.com` 구입 · Resend에 `mail.devnamu.com` 인증 · Resend HTTP API (Railway SMTP 포트 우회) · `SMTP_FROM=noreply@mail.devnamu.com` |
| 이메일 인증 | 가입/로그인 UI · `EmailDomainInput` · verify-pending/verify-email · HTTPS 브릿지 → 딥링크 · 재발송·비밀번호 재설정 · **실기기 E2E 전부 ✅** |
| 관측성 | Sentry API·Admin DSN 주입·스모크 ✅ · Mobile DSN은 EAS에 있음 · preview 빌드/스모크 후순위 |
| 모바일 빌드 | EAS Android preview APK · monorepo shared 훅 · Reanimated 정렬 |
| 스캐너 | 바코드 → ProductMaster/OFF → OCR → 등록 prefill (iOS 실기기 ✅) |
| 바코드 DB | `ProductMaster` + 식품안전나라 적재 · lookup/contribute API |
| 브랜드 UI | 리디자인 템플릿 1→14 ✅ · 장고 mood PNG · Admin 토큰 동기화 |
| 소셜 인증 | 로그인 필수 · 카카오→네이버→구글→Apple · OAuth HTTPS 콜백 · 구글 code+secret |

상세 프롬프트 기록(완료): [`archive/MOBILE_REDESIGN_PROMPTS.md`](./archive/MOBILE_REDESIGN_PROMPTS.md)

### 2026-07-20 작업 메모 (도메인 · 이메일 로그인)

| 항목 | 내용 |
|------|------|
| 도메인 | `devnamu.com` 구입 · 발송용 `mail.devnamu.com`을 Resend에 DNS 인증 |
| From | `noreply@mail.devnamu.com` |
| 발송 | Railway에서 SMTP 대신 Resend HTTP(`api.resend.com`) 사용 · 타임아웃·에러 메시지 정리 |
| 모바일 UX | 로그인/가입/비밀번호 찾기에 이메일 경로 노출 · 국내 도메인 칩(`EmailDomainInput`) |
| 메일 확인 | 미확인 계정은 `auth-gate`가 `verify-pending`으로 보냄 · 폴링·재발송·딥링크 확인 |
| 브릿지 | 메일 본문 HTTPS 링크 → API HTML 브릿지 → `expirymate://auth/verify-email` |
| 관련 env | `SMTP_*` / `RESEND_API_KEY` · `AUTH_LINK_BASE_URL` · `APP_BASE_URL=expirymate://` |

### 스캐너 (요약)

```
홈 → 바코드로 바로 등록
  → [1/2] 바코드 스캔
  → ProductMaster → OFF → 수동
  → [2/2] 유통기한 OCR
  → 등록 화면 prefill (expirySource: ocr_detected)
```

- Expo Go 불가 → `expo run:ios|android` 또는 EAS 빌드
- Personal Team 실기기만: `EXPO_IOS_PERSONAL_TEAM=1` 또는 EAS `development-device` (Push/Apple 제외)
- 유료 팀 · preview/production: entitlement 포함 — [`docs/ios-eas-production.md`](./ios-eas-production.md)

### 알려진 제약

| 제약 | 대응 |
|------|------|
| API/Admin 커스텀 도메인 미연결 | 당분간 `*.up.railway.app` · Privacy URL도 Admin Railway 호스트 |
| 로컬 vs 프로덕션 `AUTH_LINK_BASE_URL` | 로컬 `http://localhost:4000` · 프로덕션 Railway API(실기기 E2E로 검증됨) |
| iOS Personal Team | `development-device`만 · Push · Sign in with Apple 불가 |
| Railway Postgres internal URL | 로컬 migrate/seed는 Public TCP URL |
| OAuth 콘솔 | Redirect는 `http(s)`만 · 앱 스킴 직접 등록 불가 |

---

## 5. 배포 · 운영 런북

### 로컬 Docker

```bash
cp .env.docker.example .env.docker   # 선택
pnpm docker:up
curl http://localhost:4000/health
curl http://localhost:4000/ready
pnpm docker:down
```

| 서비스 | URL |
|--------|-----|
| API | http://localhost:4000 |
| Admin | http://localhost:3000 |
| Privacy | http://localhost:3000/privacy |

**프로덕션에서 `pnpm db:seed` 금지** (테이블 wipe). 바코드만 upsert: `pnpm db:seed:barcodes`.

### Railway (현재 운영)

이미 구축됨. 재구성·신규 환경 시:

1. Railway 프로젝트 + PostgreSQL
2. API 서비스: Dockerfile `apps/api/Dockerfile`, `DATABASE_URL` 등 env
3. Admin 서비스: Dockerfile `apps/admin/Dockerfile`. **Build args 필수** (기본값 없음): `NEXT_PUBLIC_APP_ENV=production`, `NEXT_PUBLIC_API_BASE_URL`(공개 HTTPS API), `PRIVACY_CONTACT_EMAIL`(실제 메일). 누락·localhost 시 이미지 빌드가 실패한다.
4. `prisma migrate deploy` (API 기동 또는 one-off)
5. 메일: Resend 도메인 `mail.devnamu.com` + `SMTP_FROM` / API 키  
6. (선택) API·Admin에 `devnamu.com` 커스텀 도메인 연결 — 현재는 `*.up.railway.app`

로컬에서 Railway DB 작업 시 **Public Networking URL** 사용 (`postgres.railway.internal`은 외부에서 안 됨).

### 필수 프로덕션 env (요지)

**API:** `DATABASE_URL`, `AUTH_TOKEN_SECRET`(32+), `AUTH_ALLOW_DEV_FALLBACK=false`, CORS/Privacy HTTPS URL, OpenAI, Resend/SMTP, **`AUTH_LINK_BASE_URL`**, OAuth(사용 중인 provider), IAP 키(구독 검증 시)

**메일 (현재):**

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_...          # 또는 RESEND_API_KEY
SMTP_FROM=noreply@mail.devnamu.com
AUTH_LINK_BASE_URL=https://api-production-1504.up.railway.app
APP_BASE_URL=expirymate://
```

**OAuth (현재 사용):**

```env
KAKAO_OAUTH_CLIENT_ID=
NAVER_OAUTH_CLIENT_ID=
NAVER_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
# Apple: APPLE_OAUTH_CLIENT_ID — 유료 개발자 계정 이후
```

**Mobile (EAS secrets):**

```env
EXPO_PUBLIC_API_BASE_URL=https://api-production-1504.up.railway.app
EXPO_PUBLIC_OAUTH_REDIRECT_URI=https://api-production-1504.up.railway.app/oauth/callback
EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID=
EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=
EXPO_PUBLIC_SENTRY_DSN=   # 권장
```

전체 맵: 루트 [`.env.example`](../.env.example), [`apps/api/.env.production.example`](../apps/api/.env.production.example)

### Admin 계정 (프로덕션)

seed 의존 금지. 사용자 가입 후 DB에서 `role = 'admin'` 승격. 기본 비밀번호(`admin1234`) 사용 금지.

### EAS

```bash
cd apps/mobile
eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value https://api-production-1504.up.railway.app
eas build --platform android --profile preview
eas build --platform ios --profile preview
# production 제출 시
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

### Sentry

SDK는 이미 연결됨. DSN이 비어 있으면 no-op.

| App | SDK 진입점 | Env | 배포 위치 |
|-----|-----------|-----|----------|
| API | `apps/api/src/instrument.ts` | `SENTRY_DSN` | Railway API 서비스 |
| Admin | `apps/admin/instrumentation.ts` | `SENTRY_DSN` (서버) · `NEXT_PUBLIC_SENTRY_DSN` (클라이언트, 동일 DSN 권장) | Railway Admin 서비스 |
| Mobile | `apps/mobile/src/services/sentry.ts` | `EXPO_PUBLIC_SENTRY_DSN` | EAS secret (preview/production) |

Mobile는 `EXPO_PUBLIC_APP_ENV === "development"`이면 Sentry를 건너뜀. **preview / production** 빌드에서만 전송.

#### 1) Sentry 프로젝트 생성 순서

1. [sentry.io](https://sentry.io) 가입 · 조직 1개 생성 (무료 플랜 OK)
2. 아래 **프로젝트 3개**를 각각 만든다 (이름 권장값):

| 프로젝트 | Platform | 복사할 DSN → |
|----------|----------|-------------|
| `jango-api` | NestJS / Node | Railway API `SENTRY_DSN` |
| `jango-admin` | Next.js | Railway Admin `SENTRY_DSN` (+ `NEXT_PUBLIC_SENTRY_DSN`) |
| `jango-mobile` | React Native | EAS `EXPO_PUBLIC_SENTRY_DSN` |

3. 각 프로젝트 **Settings → Client Keys (DSN)** 에서 DSN 문자열 복사  
4. (권장) Alerts → 새 이슈/회귀 시 이메일 또는 Slack  
5. DSN 3개를 채팅으로 전달하거나, 아래 위치에 직접 넣은 뒤 이 문서 Phase 1 Done의 Sentry 항목을 ☑로 바꾼다

> **상태 (2026-07-20):** `jango-api` / `jango-admin` 스모크 ✅ · `jango-mobile`은 EAS preview 빌드 실패로 후순위 (DSN은 EAS에 설정됨)

#### 2) Railway / EAS에 넣기

Railway UI → 각 서비스 Variables, 또는 CLI:

```bash
# API (Railway 프로젝트에서 해당 서비스 선택 후)
# SENTRY_DSN=https://...@....ingest.sentry.io/...
# GIT_SHA=<배포 커밋>   # release 태깅용, 선택

# Admin
# SENTRY_DSN=https://...@....ingest.sentry.io/...
# NEXT_PUBLIC_SENTRY_DSN=https://...@....ingest.sentry.io/...   # Admin 프로젝트 DSN과 동일
```

EAS (mobile, `apps/mobile`에서):

```bash
cd apps/mobile
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value 'https://...@....ingest.sentry.io/...' --type string
# 이미 있으면:
# eas secret:update --name EXPO_PUBLIC_SENTRY_DSN --value 'https://...'
eas build --platform android --profile preview   # EXPO_PUBLIC_APP_ENV=preview → Sentry ON
```

로컬 `apps/*/.env`에 넣어도 되지만, Mobile development는 전송하지 않음. **비밀은 git에 커밋하지 말 것.**

#### 3) 주입 후 스모크 검증

| App | 방법 | 확인 |
|-----|------|------|
| API | 배포 후 의도적 5xx 1회, 또는 임시로 `Sentry.captureException(new Error("sentry-smoke-api"))` | `jango-api` Issues · environment=`production` |
| Admin | 런타임 오류 1건 또는 Admin Issues에 smoke 이벤트 | `jango-admin` Issues |
| Mobile | preview 빌드에서 테스트 캡처/크래시 1건 | `jango-mobile` Issues · environment=`preview` |

검증 후 테스트 이슈는 Resolve. DSN·Issues 확인되면 Phase 1 Done Criteria의 **Sentry DSN 설정**을 ☑로 갱신.

#### 4) DSN 수령 후 체크리스트 (값 넣은 뒤)

```
[x] jango-api / jango-admin / jango-mobile 프로젝트 생성
[x] Railway API ← SENTRY_DSN (jango-api)
[x] Railway Admin ← SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN (jango-admin)
[x] EAS ← EXPO_PUBLIC_SENTRY_DSN (jango-mobile)
[x] API / Admin smoke (`sentry-smoke-api` / `sentry-smoke-admin`)
[ ] Mobile preview 빌드 + smoke (`sentry-smoke-mobile`) — 후순위
[ ] smoke 임시 captureMessage 제거 후 API·Admin 재배포 · Issues Resolve
```

Mobile 재시도 시: `SENTRY_DISABLE_AUTO_UPLOAD=true` 또는 `SENTRY_AUTH_TOKEN` + plugin `organization`/`project`를 `jango-mobile`에 맞춘 뒤 Android preview 재빌드.

#### 5) 트러블슈팅

| 증상 | 확인 |
|------|------|
| 이벤트가 안 옴 | 해당 서비스에 DSN이 실제로 들어갔는지 · 재배포 여부 |
| Mobile만 안 옴 | preview/production인지 (`development`면 skip) · EAS secret이 빌드에 포함됐는지 |
| Admin만 서버/클라 한쪽만 | `SENTRY_DSN`과 `NEXT_PUBLIC_SENTRY_DSN` 둘 다 넣었는지 |
| release가 unknown | API/Admin에 `GIT_SHA` 배포 시 주입 |

### Uptime

`GET https://api-production-1504.up.railway.app/health` → Better Stack / UptimeRobot 등, non-200·타임아웃 알림 (프로세스 liveness).

Railway **트래픽/배포 Healthcheck Path**는 `/ready`로 둔다 (DB 연결 확인). Docker `HEALTHCHECK`도 `/ready`를 사용한다. `/health`만 보면 DB 장애 컨테이너가 healthy로 남을 수 있다.

### 장애 1차 확인

| 상황 | 확인 |
|------|------|
| API 5xx | Railway logs · Sentry · DB |
| 모바일 크래시 | Sentry release · EAS build |
| 메일 미도착 | Resend 대시보드 · `mail.devnamu.com` DNS · `SMTP_FROM` · `AUTH_LINK_BASE_URL` |
| OAuth 실패 | Redirect URI 일치 · client secret · `/oauth/callback` |
| Push 중복 | `SchedulerLease`가 replica 중복 실행을 막음 · 가능하면 worker 1대만 `PUSH_REMINDER_SCHEDULER_ENABLED=true` |

마이그레이션: `prisma migrate deploy` · destructive seed 금지 · rollback보다 forward fix.

### 트러블슈팅

| 증상 | 확인 |
|------|------|
| API 기동 실패 | `validateProductionEnvironment()` 로그 |
| migrate 실패 | Public DB URL · 네트워크 |
| Sentry 무반응 | §5 Sentry · DSN 주입·재배포 · Mobile는 preview/production만 |
| 구글 “거의 다 됐어요” 정지 | code 플로우 + `GOOGLE_OAUTH_CLIENT_SECRET` (해시 토큰 방식 폐기) |
| 인증 메일이 앱을 안 엶 | `AUTH_LINK_BASE_URL`이 프로덕션 API인지 · 브릿지 HTML · 앱 스킴 `expirymate://` |

---

## 6. v1 출시 범위

| 기능 | v1 | v1.1+ |
|------|----|-------|
| 소셜 로그인 (카카오·네이버·구글) | ✅ | |
| 이메일 가입·로그인·메일 확인 | ✅ | |
| Apple 로그인 | capability ✅ · TestFlight 검증 | |
| 수동 재고·유통기한 | ✅ | |
| 바코드·OCR 등록 | EAS 빌드 포함 권장 | 인식률 고도화 |
| AI 레시피 | ✅ | |
| IAP 구매 UI | ❌ | ✅ |
| 가족 공유 | ❌ | ✅ |

---

## 7. 문서 유지

- **출시·운영 단일 기준:** 본 문서 (`docs/PROJECT.md`)
- **장고 캐릭터 비주얼 기준:** [`docs/JANGO_CHARACTER_STYLE_GUIDE.md`](./JANGO_CHARACTER_STYLE_GUIDE.md)
- **iOS capability / EAS production:** [`docs/ios-eas-production.md`](./ios-eas-production.md)
- **README:** 로컬 온보딩 + 진척 요약만. 상세·우선순위는 여기로 링크
- Phase 완료·블로커 발견 시 이 파일의 §1·§2·체크리스트를 갱신

### 통합으로 대체된 문서

| 이전 | 처리 |
|------|------|
| `docs/PRODUCTION_LAUNCH_ROADMAP.md` | 본 문서로 통합 |
| `docs/DEPLOYMENT.md` | §5로 통합 |
| `docs/RAILWAY_STAGING.md` | §5로 통합 |
| `docs/MOBILE_REDESIGN_PROMPTS.md` | `docs/archive/` (완료 기록). 캐릭터 비주얼은 `JANGO_CHARACTER_STYLE_GUIDE.md`가 우선 |

---

## 8. 한 줄 결론

**Phase 1(실기기 QA·uptime·Sentry API/Admin)은 통과했다.**  
다음 관문은 **EAS production 빌드(TestFlight) → Apple/푸시 실기기 검증 → 스토어 메타·심사 제출**이다.  
iOS capability 런북: [`docs/ios-eas-production.md`](./ios-eas-production.md)  
Mobile Sentry·푸시·커스텀 도메인·IAP는 병행하거나 출시 직후로 미뤄도 된다.
