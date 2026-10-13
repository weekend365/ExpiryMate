---
status: active
owner: platform
last_reviewed: 2026-10-13
source_of_truth: true
---

# 배포·운영 런북

ExpiryMate API, Admin, Mobile의 배포와 1차 장애 대응 기준입니다. 시크릿 값과 환경별
동기화 절차는 [`../dev-secrets.md`](../dev-secrets.md), iOS capability와 제출은
[`../ios-eas-production.md`](../ios-eas-production.md)가 정본입니다.

## 환경별 설정 정본

| 환경 | 정본 |
|---|---|
| 로컬·Cursor Cloud | Doppler `dev`에서 내려받은 gitignored `.env` |
| Mobile preview·production | Expo Environment variables |
| API·Admin 운영 | Railway Variables |
| 키 이름과 안전한 예시 | 루트 및 앱별 `.env.example` |

실제 시크릿을 저장소, 문서, 이슈, 로그에 기록하지 않습니다.

## 로컬 Docker

```bash
cp .env.docker.example .env.docker
pnpm docker:up
curl http://localhost:4000/health
curl http://localhost:4000/ready
pnpm docker:down
```

프로덕션에서는 테이블을 초기화할 수 있는 `pnpm db:seed`를 실행하지 않습니다.
바코드 데이터만 갱신할 때는 `pnpm db:seed:barcodes`를 사용합니다.

## Railway

API와 Admin은 각 Dockerfile로 배포합니다.

- API: `apps/api/Dockerfile`, 운영 `DATABASE_URL`과 인증·메일·OAuth 설정 필요
- Admin: `apps/admin/Dockerfile`, production build args를 명시적으로 전달
- Healthcheck Path: DB readiness를 확인하는 `/ready`
- 외부 uptime: 프로세스 liveness를 확인하는 `/health`

API entrypoint는 `prisma migrate deploy` 성공 후 애플리케이션을 시작합니다. Railway
Pre-deploy Command로 옮길 경우 중복 실행하지 않도록 한쪽만 유지합니다.

### migration 검증

```bash
pnpm db:migrate:deploy
npx prisma migrate status
curl https://api-production-1504.up.railway.app/ready
```

운영에서는 `prisma migrate dev`를 사용하지 않고 rollback보다 forward fix를 우선합니다.
공유 공간 migration 전후에는 DB 백업과 다음 누락 건수를 확인합니다.

```sql
SELECT COUNT(*) FROM "User" u
LEFT JOIN "InventorySpace" s ON s."id" = 'personal_' || u."id"
WHERE s."id" IS NULL;

SELECT COUNT(*) FROM "InventoryItem" WHERE "spaceId" IS NULL;
SELECT COUNT(*) FROM "UserStorageLocation" WHERE "spaceId" IS NULL;
SELECT COUNT(*) FROM "RecipeRecommendation" WHERE "spaceId" IS NULL;
```

### 개인 플러스 출시 migration

`20260829120000_add_personal_plus_launch`는 처분 이벤트·사진 구독 사용 출처·구매
의도를 추가하고 기존 소비/폐기 항목을 `backfill` 출처로 기록합니다. 적용 뒤 아래를
확인합니다.

```sql
SELECT "source", "outcome", COUNT(*)
FROM "InventoryDispositionEvent"
GROUP BY "source", "outcome";

SELECT COUNT(*) FROM "InventoryItem"
WHERE "status" IN ('consumed', 'discarded') AND "spaceId" IS NOT NULL;

SELECT COUNT(*) FROM "SubscriptionPurchaseIntent";
```

첫 두 집계의 차이는 migration 이후 생성된 이벤트와 과거 데이터 누락 여부를 고려해
조사합니다. 운영에서는 migration을 되돌려 이벤트 원장을 삭제하지 않고 forward fix를
사용합니다.

## Mobile EAS

```bash
cd apps/mobile
eas build --platform android --profile preview
eas build --platform ios --profile preview
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

production 빌드 전에 공개 API URL, OAuth callback, 웹 URL, OAuth client ID, Sentry,
AdMob 값이 Expo의 production 환경에 들어 있는지 확인합니다. 로컬 `.env`를 production
설정의 정본으로 사용하지 않습니다.

## 개인 플러스 출시 순서

1. DB migration → API·Admin·약관/개인정보 페이지를 `SUBSCRIPTIONS_ENABLED=false`로 배포
2. App Store와 Play Console에 개인 플러스 상품만 등록하고 Apple Server Notification,
   Google RTDN을 API webhook에 연결
3. `MONETIZATION_OFFER_MODE=core`, `HOUSEHOLD_SUBSCRIPTIONS_ENABLED=false`,
   `PAID_RECOMMENDATION_CREDITS_ENABLED=false`를 확인
4. 요리 50건·사진 30건 실호출 원가에서
   `60 × 요리 p95 + 30 × 사진 p95 ≤ 858원` 확인
5. iOS Sandbox·Android License QA에서 구매·pending·복원·타 계정 충돌·갱신·취소·
   grace·pause/hold·만료·환불·revocation 확인
6. production 앱 공개와 동시에 `SUBSCRIPTIONS_ENABLED=true`,
   `SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED=true`, 수익 원장 활성화

장애 시 `SUBSCRIPTIONS_ENABLED=false`로 신규 판매만 중단합니다. 기존 권한 검증,
스토어 알림, 재동기화는 유지해 결제 기간 중 활성 사용자의 혜택을 보존합니다.

2026-10-10 사용자는 개인 플러스 전체 판매의 **원가 검증 예외**를 명시적으로 승인했습니다.
`SUBSCRIPTION_COST_GATE_MODE=operator_override`는 개인 플러스 상품 표시·구매 의도·새 영수증
승인의 원가 조건만 면제합니다. 측정값·예산·다른 상품·AI 사용 한도·Sandbox 거부를
유지하며 결제 QA 통과를 뜻하지 않습니다. 적용 전에 최신 snapshot 백업·격리 복구·
보호된 백업의 해시를 확인하고 API만 배포합니다. 예외 철회는 `required`로 복귀하고,
즉시 판매 중단은 `SUBSCRIPTIONS_ENABLED=false`로 수행합니다. 기존 권한은 유지합니다.

## 2026-10-10 스토어 심사 기간의 운영 설정

[최종 심사 제출 기록](../../design/reviews/release-readiness-2026-10-10/final-release-submission.json)에
따라 QA·App Review 동안만 `IAP_ALLOW_SANDBOX_PURCHASES=true`를 사용합니다. 22:24 KST
새 snapshot의 41개 테이블·45개 migration·격리 복구·`pg_amcheck`·보호 백업 해시를 확인했고,
API `9cabee4` 기존 artifact를 소스 업로드 없이 재배포했습니다. deployment
`5378178a-2ba4-4700-a246-3f7f9288f1bc`는 SUCCESS이며 운영 검사 13개가 통과했습니다.
설정 변경은 이 변수 하나이고 비공개 키·Admin·Prisma·인증/서명·원가 예외는 유지했습니다.
원본 dump는 저장소 밖에 보관하며 SHA-256은
`fb9e37b6ea0f1a1aa7604c168d0146bf44edd4ec6810a8576e65b57ef076a680`입니다.

iOS는 수동 출시, Google은 관리형 게시로 승인 후 자동 공개를 막아 두었습니다.
공개 직전 새 일관된 백업·격리 복구·보호 해시를 확인하고 변수를 **false**로 되돌린 뒤
동일 API artifact를 재배포합니다. `/health` SHA·`/ready`·정책 URL·인증 거부 13개와
Sandbox 거부 설정을 재확인한 뒤 승인된 iOS 7일 단계적 업데이트·Android 5% 출시를 게시합니다.
현재의 심사 제출은 공개 완료가 아니며 재배포에 `--from-source`를 사용하지 않습니다.

## 2026-10-13 Android39 재심사 중

[최신 공개 준비 기록](../../design/reviews/release-readiness-2026-10-13/release-publication.json)의
Android39는 실제 Play 설치·서명, 연간·ACK·갱신·재실행·복원을 확인하고 production
재심사에 접수됐습니다. iOS51은 승인·수동 출시 대기입니다. 공유 API는 QA·재심사용
`IAP_ALLOW_SANDBOX_PURCHASES=true`를 유지하며 이 날짜에는 서버 재배포·Prisma 변경이
없습니다. 10월13일 최초 백업·격리 복구 기록은 보존하되 공개 시점의 새 백업을 대체하지
않습니다. 남은 필수 QA 또는 명시적 범위 예외와 Google 승인을 확인한 뒤 공개 직전15분
이내의 새 검증·보호 백업으로 위 원복 절차를 실행합니다.

## Sentry

| App | 환경변수 | 배포 위치 |
|---|---|---|
| API | `SENTRY_DSN` | Railway API |
| Admin | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Railway Admin |
| Mobile | `EXPO_PUBLIC_SENTRY_DSN` | Expo preview·production |

Mobile development 환경은 Sentry 전송을 건너뜁니다. 배포 후 각 앱에서 스모크 이벤트를
1건 확인하고 테스트 이슈는 resolve합니다. 임시 캡처 코드를 넣었다면 즉시 제거합니다.

## 장애 1차 확인

| 증상 | 확인 순서 |
|---|---|
| API 5xx·기동 실패 | Railway logs → `/ready` → Sentry → DB와 production env 검증 |
| migration 실패 | 대상 DB URL, Railway 내부/외부 주소, 네트워크, Prisma status |
| 모바일 크래시 | EAS build·release → Mobile Sentry environment |
| 인증 메일 미도착 | Resend 로그, DNS, 발신 주소, `AUTH_LINK_BASE_URL` |
| OAuth 복귀 실패 | provider callback URL, client secret, `/oauth/callback`, 앱 스킴 |
| Push 중복 | `SchedulerLease`, scheduler 활성 replica 수, Expo receipt |
| 구매·복원 실패 | purchase intent → Apple/Google 검증 응답 → 계정 결합 ID → entitlement → 서버 알림/재동기화 |

## 배포 완료 조건

- migration과 백필 검사 통과
- `/ready`와 `/health` 정상
- API/Admin/Mobile release 식별 가능
- 핵심 스모크와 두 계정 공유 QA 통과
- 스토어 개인정보 선언과 실제 수집·전송 동작 일치
- 개인 플러스 실제 가격·자동 갱신·해지·약관 고지와 상품 설정 일치
- 구매 검증·복원 성공률 98% 이상, 중복 권한·미승인 Google 구매 0건
