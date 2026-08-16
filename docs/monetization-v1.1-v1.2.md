# 장고 수익화 v1.1 · v1.2 출시 체크리스트

코드는 두 버전을 함께 포함하되 서버 기능 플래그로 단계적으로 공개합니다.
모든 날짜·사용량은 `Asia/Seoul` 기준이며 공유 냉장고에서도 실행한 개인 계정에
귀속됩니다.

## 배포 순서

1. DB migration `20260728110000_add_monetization_ledger`와 API를
   `REWARDED_ADS_ENABLED=false`, `SUBSCRIPTIONS_ENABLED=false`로 먼저 배포합니다.
2. v1.1 양 스토어 빌드에는 production AdMob 앱 ID·보상 광고 단위를 넣습니다.
3. App Store/Play 내부 테스트에서 SSV 콜백과 추천 예약·환불을 확인합니다.
4. 양 스토어 승인 뒤 `REWARDED_ADS_ENABLED=true`로 바꾸고 무료 한도를 1회로
   전환합니다. 장애 시 광고 플래그를 끄면 임시 무료 4회가 적용됩니다.
5. v1.0은 14일 동안 기존 정책을 유지한 뒤 최소 지원 버전을 v1.1로 올립니다.
6. v1.2 상품 승인과 양 플랫폼 구매 QA가 끝난 뒤
   `SUBSCRIPTIONS_ENABLED=true`로 바꿉니다.
7. 바코드 추천권 migration과 API를 플래그가 꺼진 상태로 먼저 배포한 뒤
   스테이징 100%, 프로덕션 10% → 50% → 100% 순으로 확대합니다.
8. (이후) 광고·구독 관문이 안정된 뒤 「쿠팡 파트너스 · 재료 구매 연동」
   Phase A(검색 딥링크) → Phase B(파트너스 API) 순으로 켭니다. 상세는 아래
   동명 절을 따릅니다.

## API 환경변수

```text
RECIPE_FREE_DAILY_LIMIT=1
RECIPE_REWARDED_DAILY_LIMIT=10
RECIPE_SUBSCRIBER_DAILY_LIMIT=30
RECIPE_ABSOLUTE_DAILY_LIMIT=30
RECIPE_ADS_DISABLED_FREE_DAILY_LIMIT=4
MONETIZATION_OFFER_MODE=core
MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED=false
MONETIZATION_GUARDRAIL_LOOKBACK_DAYS=30
MONETIZATION_GUARDRAIL_MIN_SAMPLES=50
MONETIZATION_GUARDRAIL_CACHE_SECONDS=300
REWARDED_AD_COST_COVERAGE_TARGET=1
PAID_CREDIT_COST_COVERAGE_TARGET=3
MONETIZATION_SUBSCRIBER_DAILY_AI_BUDGET_KRW=
MONETIZATION_HOUSEHOLD_DAILY_AI_BUDGET_KRW=
MONETIZATION_EXPERIMENT_SALT=replace-with-a-stable-secret
MONETIZATION_VALUE_FIRST_ROLLOUT_PERCENT=0
PERSONALIZED_MONETIZATION_OFFERS_ENABLED=false
PERSONALIZED_MONETIZATION_OFFERS_ROLLOUT_PERCENT=0
MONETIZATION_REVENUE_LEDGER_ENABLED=false
MONETIZATION_REVENUE_LEDGER_ROLLOUT_PERCENT=0
HOUSEHOLD_SUBSCRIPTIONS_ENABLED=false
HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT=0
RECIPE_VALUE_FIRST_FREE_DAILY_LIMIT=2
RECIPE_VALUE_FIRST_REWARDED_DAILY_LIMIT=2
RECIPE_HOUSEHOLD_DAILY_LIMIT=60
HOUSEHOLD_SUBSCRIPTION_MEMBER_LIMIT=5
BARCODE_REWARDS_ENABLED=false
BARCODE_REWARD_ROLLOUT_PERCENT=0
BARCODE_REWARD_DAILY_LIMIT=3
BARCODE_REWARD_BALANCE_LIMIT=10
BARCODE_REWARD_TOKEN_SECRET=replace-with-a-long-random-secret
BARCODE_CONTRIBUTION_EXTRA_BLOCKED_TERMS=
BARCODE_CONTRIBUTION_ALLOWED_TERMS=
PAID_RECOMMENDATION_CREDITS_ENABLED=false
RECOMMENDATION_CREDIT_PRODUCTS=expirymate_recipe_credits_5:5,expirymate_recipe_credits_15:15
REWARDED_ADS_ENABLED=false
SUBSCRIPTIONS_ENABLED=false
MINIMUM_MOBILE_APP_VERSION=

SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED=false
SUBSCRIPTION_RESYNC_INTERVAL_MINUTES=360
SUBSCRIPTION_RESYNC_BATCH_SIZE=50
SUBSCRIPTION_RESYNC_STALE_HOURS=6
SUBSCRIPTION_RESYNC_VOIDED_LOOKBACK_DAYS=7

ADMOB_IOS_REWARDED_AD_UNIT_ID=
ADMOB_ANDROID_REWARDED_AD_UNIT_ID=
ADMOB_SSV_USER_ID_SECRET=

IAP_ALLOWED_PRODUCT_IDS=expirymate_premium_monthly,expirymate_premium_yearly,jango_plus,expirymate_household_monthly,expirymate_household_yearly,jango_household
MONETIZATION_ESTIMATES_JSON=
APPLE_ROOT_CERTIFICATES_BASE64=
APPLE_APP_ID=
GOOGLE_RTDN_AUDIENCE=https://API_HOST/subscriptions/notifications/google
```

`ADMOB_SSV_USER_ID_SECRET`, 구매 토큰, Apple 키, Google 서비스 계정 키는 로그나
저장소에 남기지 않습니다. Google 구매 토큰은 서버에 SHA-256 해시만 저장합니다.

`MONETIZATION_OFFER_MODE=core`는 초기 출시용입니다. 보상 광고와 개인 플러스만
신규 판매하며 추천권·가족 플러스 신규 판매는 숨깁니다. 이미 지급된 추천권과 활성
가족 플러스 권리는 모드 전환 뒤에도 유지됩니다. 충분한 전환 표본을 확보한 뒤
`expanded`로 바꿉니다.

`SUBSCRIPTIONS_ENABLED`는 **신규 구독 판매**만 제어합니다. 플래그를 꺼도 이미
검증된 개인·가족 플러스 entitlement는 할당량·광고 제거·리포트에 계속 적용되고,
같은 구매의 복원·갱신 동기화도 허용합니다. 신규 결제 검증만 거절합니다.

단위경제 자동 가드레일은 수익 원장 rollout 100%, 검토된
`MONETIZATION_ESTIMATES_JSON`, 개인·가족 일일 AI 예산을 설정한 뒤에만 켭니다.
최근 표본이 `MONETIZATION_GUARDRAIL_MIN_SAMPLES`에 도달하면 광고는 원가 1배,
추천권은 원가 3배 미만일 때 신규 공급을 멈춥니다. 최근 추천 p95 원가가 일일 AI
예산을 초과하지 않도록 구독 30회·가족 60회 한도도 자동으로 낮춥니다. 표본이
부족하거나 가드레일이 꺼져 있으면 기존 한도를 유지합니다.

## 바코드 기여 추천권

- Open Food Facts가 정상적으로 미등록을 확인한 유효 GTIN에만 15분 서명
  토큰을 발급합니다. 조회 장애나 위조·만료 토큰은 상품 등록만 허용합니다.
- 전역 최초 상품에 상품명과 브랜드 또는 카테고리가 있을 때 추천권 1회를
  지급합니다. 하루 최대 3회, 보유 최대 10회이며 만료·양도·현금화는 없습니다.
- 차감 순서는 구독 → 무료 → 광고 → 바코드 추천권입니다. 구독 중에는 적립만
  하고 추천권을 소비하지 않습니다.
- 일회성 추천권을 활성화하면 차감 순서는 구독 → 무료 → 이미 획득한 광고 추천권 →
  구매 추천권 → 바코드 추천권입니다. 구매 추천권을 보유해도 사용자가 광고를
  선택해 구매분을 보존할 수 있습니다. 구매 추천권은 만료되지 않으며 AI 생성 실패 시 사용
  예약이 해제됩니다.
- `BARCODE_REWARD_TOKEN_SECRET`과 `MONETIZATION_EXPERIMENT_SALT`는 출시 후
  변경하지 않습니다. 원본 바코드는 퍼널 이벤트 속성에 저장하지 않습니다.
- 기본 금지어 외에 운영 중 추가할 표현은
  `BARCODE_CONTRIBUTION_EXTRA_BLOCKED_TERMS=금지어1,금지어2`처럼 쉼표로
  구분합니다. 정상 상품명의 오탐 예외는
  `BARCODE_CONTRIBUTION_ALLOWED_TERMS=정상 상품명,정상 브랜드명`에 정확한 전체
  값을 넣고 API를 재시작해 반영합니다.

## 일회성 AI 추천권

- App Store와 Google Play에 `RECOMMENDATION_CREDIT_PRODUCTS`의 각 ID를
  소모성 상품으로 생성합니다. 상품별 지급량은 `product_id:credits` 형식으로
  서버에서만 결정하며 모바일 표시 가격은 스토어 응답을 사용합니다.
- 서버가 Apple 거래 ID 또는 Google 구매 토큰을 검증하고 원장에 한 번만 기록한
  뒤 모바일이 거래를 소비합니다. 같은 영수증 재전송은 추천권을 중복 지급하지
  않습니다.
- 계정 삭제 시 사용 가능한 추천권은 제거되지만, 처리한 소모성 영수증의
  해시·거래 식별자는 중복 지급 방지를 위해 익명화된 계정 셸에 보존합니다.
- Apple 환불·취소 알림과 Google 일회성 상품 취소 RTDN을 받으면 해당 구매를
  `revoked`로 전환하고 남은 잔액 계산에서 제외합니다.
- 마이그레이션과 양 스토어 샌드박스 QA가 끝날 때까지
  `PAID_RECOMMENDATION_CREDITS_ENABLED=false`를 유지합니다.
- 구독자는 추천권을 보유할 수 있지만 구독 중에는 플러스 사용량을 먼저
  사용합니다. 하루 절대 추천 상한 30회는 구매 추천권에도 동일하게 적용됩니다.

## 플러스 소비 리포트

- 활성 구독자는 최근 30일간 소비·폐기 완료 수, 폐기 비율, 7일 내 만료 수와
  주요 폐기 카테고리를 확인할 수 있습니다. 최근 7일과 직전 7일의 소비·폐기 및
  폐기 비율 변화도 함께 제공해 추천을 만들지 않은 주에도 관리 성과를 확인합니다.
- 리포트는 기존 재고 상태와 갱신 시각만 집계하며 별도 AI 호출을 만들지 않습니다.

## 개인화 오퍼와 가족 플러스

- 개인화 오퍼는 최근 7일 추천 화면 방문일과 완료 추천 수, 최근 30일 페이월
  닫기·결제 취소를 서버에서 계산합니다. 모바일은 서버가 선택한 주 CTA 하나와
  별도 `다른 방법` 시트만 표시합니다.
- 추천 화면을 2일 이상 방문하고 추천을 3회 이상 완료한 사용자는 무료 사용량이
  남아 있어도 추천을 방금 완료한 가치 체감 시점에 개인 플러스를 안내합니다.
  가족 공간 소유자는 두 번째 구성원이 참여한 뒤 가족 플러스를 우선 안내합니다.
- 구독을 두 번 이상 닫거나 취소한 사용자는 무료 사용량을 모두 쓴 뒤 일회성
  추천권을 우선 안내하고, 가벼운 사용자는 보상 광고를 우선 안내합니다.
- `PERSONALIZED_MONETIZATION_OFFERS_ENABLED`를 켠 뒤 rollout을 10% → 50% →
  100%로 확대합니다. 장애 시 플래그를 끄면 기존 우선순위로 즉시 복귀합니다.
- `MONETIZATION_REVENUE_LEDGER_ENABLED`와
  `HOUSEHOLD_SUBSCRIPTIONS_ENABLED`도 각각 독립된 rollout percentage를 사용합니다.
  두 단계 모두 동일 사용자에게 안정적으로 유지되는 버킷으로 10% → 50% → 100% 확대합니다.
  Household 판매 플래그를 꺼도 이미 활성화된 공간 권리는 만료 시까지 유지됩니다.
- 가족 플러스는 household 공간 소유자만 구매할 수 있고 최대 5명이 하루 60회
  추천을 공유합니다. 가격은 월 6,900원·연 59,000원이며 무료 체험은 없습니다.
- Apple 상품은 `expirymate_household_monthly`·`expirymate_household_yearly`,
  Google 상품은 `jango_household`의 `monthly`·`yearly` base plan입니다.
- `MONETIZATION_ESTIMATES_JSON`에는 `usdKrw`, `rewardedAdEcpmKrw`,
  `productNetProceedsKrw`를 넣습니다. 값이 없으면 관리자 금액 지표는 0원이 아닌
  `설정되지 않음`으로 표시합니다.

## 모바일 EAS 환경변수

```text
EXPO_PUBLIC_APP_VERSION=1.1.0
EXPO_PUBLIC_ADMOB_IOS_APP_ID=
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=
EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID=
EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID=
EXPO_PUBLIC_WEB_BASE_URL=https://DEVELOPER_WEBSITE
```

development/preview는 코드에서 Google 테스트 광고 단위를 사용합니다. production
빌드는 네 값 중 하나라도 없으면 실패합니다.

## 외부 콘솔

### AdMob

- iOS·Android 앱과 보상 광고 단위를 만들고 SSV URL을
  `https://API_HOST/monetization/admob/ssv`로 설정합니다.
- 보상 항목 `recipe_generation`, 수량 `1`, 콘텐츠 등급 `G`, 아동 대상 `false`.
- 관리자 서비스에 `ADMOB_PUBLISHER_ID=pub-…`를 넣고 스토어 개발자 웹사이트
  루트의 `/app-ads.txt`가 200으로 열리는지 확인합니다.
- App Store **마케팅 URL**(개발자 웹사이트)은 AdMob 크롤 기준입니다. Railway
  `*.up.railway.app` 다단계 호스트는 인증이 자주 실패하므로
  `https://jango.devnamu.com` 같은 1단 서브도메인을 권장합니다.
- 마케팅 URL 반영용 iOS `1.1.0` 빌드·Connect 절차는 집 Mac에서
  [`docs/ios-eas-production.md`](./ios-eas-production.md) **§0** 을 따릅니다.
- **모바일 빌드(지금):** EAS production에만
  `EXPO_PUBLIC_ADMOB_*` 앱 ID·보상형 유닛 ID 4개를 넣습니다. 광고 미노출은
  Railway `REWARDED_ADS_ENABLED=false`로 유지합니다.
- **Railway API (광고 ON 직전 · 나중에):**

  - [ ] `ADMOB_IOS_REWARDED_AD_UNIT_ID` / `ADMOB_ANDROID_REWARDED_AD_UNIT_ID`
        (EAS와 동일한 유닛 ID)
  - [ ] AdMob SSV 콜백 URL → `https://API_HOST/monetization/admob/ssv`
  - [ ] `ADMOB_SSV_USER_ID_SECRET` 설정
  - [ ] 스모크 후 `REWARDED_ADS_ENABLED=true` (그 전까지는 `false` 유지)

  덤프/마케팅 URL 빌드 단계에서는 Railway AdMob 변수를 넣지 않아도 됩니다.

### Apple

- 구독 그룹 `jango_plus`, 동일 등급, Family Sharing 끔, 무료 체험 없음.
- `expirymate_premium_monthly` 월 3,900원,
  `expirymate_premium_yearly` 연 29,000원.
- App Store Server Notifications V2 URL:
  `https://API_HOST/subscriptions/notifications/apple`.
- 거래 조회는 production StoreKit API를 먼저 호출하고, `4040010`(또는 404)이면
  sandbox로 한 번 더 조회합니다(TestFlight·App Review). 샌드박스 환경의
  entitlement 부여는 `IAP_ALLOW_SANDBOX_PURCHASES` 정책으로 별도 통제합니다.
- Apple 알림은 구독·추천권 핸들러를 독립적으로 처리해, 한쪽 실패가 다른 쪽
  환불 처리를 막지 않습니다.
- 첫 자동 갱신 구독은 v1.2 앱 버전의 In-App Purchases 섹션에 함께 추가합니다.
- 심사 노트에는 바코드 추천권이 기존 무료 AI 추천의 비구매 보너스 사용량이며
  구매·양도·현금화되지 않고 구독의 광고 제거 기능을 열지 않는다고 설명합니다.

### Google Play

- 상품 `jango_plus`, 자동 갱신 base plan `monthly`, `yearly`, 무료 체험 없음.
- 가격 월 3,900원, 연 29,000원.
- RTDN Pub/Sub push endpoint:
  `https://API_HOST/subscriptions/notifications/google`.
- Push OIDC service account와 audience를 API의 `GOOGLE_RTDN_AUDIENCE`와
  정확히 맞춥니다.
- **구매 승인·소비의 SSOT는 API**입니다. 구독은 권한 부여 직후
  `purchases.subscriptions.acknowledge`를, 일회성 추천권은 지급 직후
  `purchases.products.consume`을 서버에서 호출합니다. 모바일
  `finishTransaction`은 스토어 큐 정리용으로 유지하되, 3일 자동 환불 방지는
  서버 승인에 의존합니다. `linkedPurchaseToken`으로 토큰이 바뀌면 기존
  entitlement 행을 찾아 `purchaseTokenHash`를 갱신합니다.

## 쿠팡 파트너스 · 재료 구매 연동 (계획)

IAP(구독·추천권)·보상 광고와 **겹치지 않는 제3 수익**으로, 요리/재료 맥락에서
「부족한 재료를 사기」로 자연스럽게 이어지게 합니다. **코어 수익화(광고·구독)
출시 관문을 통과한 뒤** 단계적으로 붙입니다. 코드·플래그는 아직 없으며 아래는
제품·기술 계획입니다.

### 원칙

- **신뢰 우선:** 홈·임박 알림에 상시 쇼핑 배너를 두지 않습니다. 노출은
  「부족한 재료」「레시피 재료 목록」 등 **구매 의가 분명한 곳**만.
- **구독과 분리:** 장고 플러스는 광고 제거·추천 한도. 제휴 쇼핑은 선택 편의이며
  구독 혜택과 묶지 않습니다.
- **고지:** 제휴 링크는 앱·웹에서 광고·제휴임을 짧게 안내합니다.
- **외부 결제:** 결제는 쿠팡(또는 이후 몰)에서 이뤄지며 App Store/Play IAP가
  아닙니다. 딥링크/브라우저로 엽니다.

### 단계

#### Phase A — API 없이 MVP (먼저)

1. 재료명·정규화된 검색어로 쿠팡 검색/딥링크 URL 생성 (+ 파트너스 추적 파라미터).
2. CTA 카피 예: 「쿠팡에서 찾아보기」(대화형·강요하지 않는 톤).
3. 서버/퍼널에 `affiliate_offer_shown` / `affiliate_offer_tapped` 만 기록
   (상품 ID·영수증·개인 식별 구매 내역은 저장하지 않음).
4. 플래그 예: `AFFILIATE_OFFERS_ENABLED=false`,
   `AFFILIATE_OFFERS_ROLLOUT_PERCENT=0`,
   `AFFILIATE_PROVIDER=coupang_partners` (구현 시).

관문: 노출 대비 클릭률·이탈·부정 피드백을 보고 Phase B 진행 여부 결정.

#### Phase B — 쿠팡 파트너스 API

1. 파트너스 승인·API 키는 서버만 보유 (`COUPANG_PARTNERS_*`). 모바일에 비밀키 금지.
2. 재료 쿼리 → 상품 검색 → **상위 1~2개** (가격·썸네일·제휴 URL) 서버 응답.
3. 품절·매칭 실패 시 Phase A 검색 링크로 폴백.
4. 캐시·레이트 리밋·금칙어(비식품·성인 등) 필터.
5. 관리자에서 클릭·추정 수익(파트너스 리포트 대조) 조회.

#### Phase C — 확장 (선택)

- 네이버 쇼핑 등 **검색 링크 병행**으로 특정 몰 종속·불신 완화.
- 가격 비교·장보기 리스트 공유는 제휴보다 UX 우선 과제로 둘 수 있음.

### 노출 UX (초안)

| 위치 | 동작 |
| --- | --- |
| 레시피 재료 중 재고에 없거나 부족한 항목 | 「쿠팡에서 찾아보기」 |
| 추천 결과 하단 (옵션) | 부족 재료만 묶은 장보기 CTA |
| 임박 D-day 카드 | **구매 CTA 금지** (소비·레시피 유도 유지) |

### 예정 환경변수 (미구현)

```text
AFFILIATE_OFFERS_ENABLED=false
AFFILIATE_OFFERS_ROLLOUT_PERCENT=0
AFFILIATE_PROVIDER=coupang_partners
COUPANG_PARTNERS_ACCESS_KEY=
COUPANG_PARTNERS_SECRET_KEY=
COUPANG_PARTNERS_TRACKING_CODE=
AFFILIATE_OFFER_CACHE_SECONDS=300
AFFILIATE_MAX_PRODUCTS_PER_INGREDIENT=2
```

### 출시 전제

- [ ] `REWARDED_ADS` / `SUBSCRIPTIONS` 등 코어 관문이 안정적일 것.
- [ ] Phase A 클릭·신뢰 지표가 기준을 넘길 것.
- [ ] 제휴 고지 카피·스토어 심사 노트(외부 구매·제휴) 준비.
- [ ] 파트너스 약관·상품 카테고리 화이트리스트 확정.

## 실기기 QA · 스토어 E2E

아래는 유료 플래그를 켜기 전에 production-like 빌드(TestFlight · Play 내부 테스트)에서
통과해야 하는 시나리오입니다. 각 항목은 **앱 UI 결과**와 **서버 entitlement /
추천권 원장**이 일치해야 합니다.

### 공통

- [ ] KST 23:59/00:00 경계, 무료 1회, 광고 최대 3편, 구독 총 30회.
- [ ] 같은 `Idempotency-Key` 재전송, 동시 탭, AI 실패 시 예약 해제.
- [ ] 광고 로드 실패·닫기·완주·10초 지연·백그라운드 복귀.
- [ ] 구독 계정에서 Google Mobile Ads 네트워크 요청이 없는지 프록시로 확인.
- [ ] 활성 구독 계정 삭제 화면의 별도 스토어 해지 경고.
- [ ] 바코드 토큰 만료·위조·OFF 장애, 하루 3회·잔액 10회, 동시 최초 등록.
- [ ] 바코드 추천권 추천 실패 복구와 구독 중 잔액 보존.
- [ ] iPhone, iPad, Android 내부 테스트 production-like 빌드.

### Apple (TestFlight · App Review)

- [ ] 월간·연간 구매 후 서버 `hasActiveEntitlement=true`, 광고 제거.
- [ ] 복원(restore)으로 다른 테스트 계정에 동일 거래가 붙지 않음(충돌 거절).
- [ ] 구독 취소 후 만료일까지 유지, 만료 뒤 무료 등급.
- [ ] 환불/REVOKE ASSN 수신 시 entitlement `revoked` · 추천권 회수.
- [ ] 일회성 추천권 구매·REFUND가 구독 웹훅과 독립적으로 처리됨.
- [ ] App Review 샌드박스: 아래 「App Review 샌드박스 운영」 절차로 임시 허용 후
      심사 결제 검증 성공, 심사 종료 후 플래그 OFF.

### Google Play (라이선스 테스터)

- [ ] 월간·연간 구매 후 서버 acknowledge 호출(Play Console / API 로그).
- [ ] Android pending 결제 → 완료 시 자동 반영.
- [ ] 앱 강제 종료 직후 재실행해도 3일 내 미승인 환불이 나지 않음(서버 acknowledge).
- [ ] 플랜 변경·재구독으로 `linkedPurchaseToken`이 바뀌어도 동일 계정 entitlement 유지.
- [ ] 추천권 consume 후 재구매 가능, RTDN/voided 목록으로 환불 회수.
- [ ] 복원으로 purchaseToken이 서버에 다시 검증됨(Google은 토큰 원문을 DB에 두지 않음).

## App Review 샌드박스 운영

프로덕션 API는 항상 `APPLE_APP_STORE_ENVIRONMENT=production`을 유지합니다.
StoreKit 조회는 production → `4040010` 시 sandbox 폴백이지만, **샌드박스
entitlement 부여**는 `IAP_ALLOW_SANDBOX_PURCHASES=true`일 때만 허용됩니다.

1. 심사 제출 직전에 API에 `IAP_ALLOW_SANDBOX_PURCHASES=true`를 배포합니다.
2. 심사·TestFlight 결제 검증이 끝나는 즉시 `false`로 되돌립니다.
3. 스테이징/로컬만 `APPLE_APP_STORE_ENVIRONMENT=sandbox`를 사용합니다.
4. 프로덕션에서 Apple 환경을 sandbox로 바꾸지 마세요(부트 검증이 거절합니다).

## 구독 재동기화(웹훅 유실 대비)

`SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED=true`이면 API가 주기적으로:

- Apple: `verifiedAt`이 오래된 entitlement를 StoreKit으로 재검증해 상태를 맞춥니다.
- Google: Voided Purchases API로 환불·차지백을 조회해 entitlement·추천권을
  회수합니다. (토큰 원문을 저장하지 않으므로 갱신 동기화는 RTDN + 앱 복원에
  의존합니다.)

```text
SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED=false
SUBSCRIPTION_RESYNC_INTERVAL_MINUTES=360
SUBSCRIPTION_RESYNC_BATCH_SIZE=50
SUBSCRIPTION_RESYNC_STALE_HOURS=6
SUBSCRIPTION_RESYNC_VOIDED_LOOKBACK_DAYS=7
```

유료 판매를 연 뒤에는 스케줄러를 켜고, 실패 로그·revoked 급증을 경보하세요.

## 단위경제 가드레일 켜기 전 체크리스트

1. `MONETIZATION_REVENUE_LEDGER_ENABLED=true` 및 rollout 100%.
2. 재무 검토된 `MONETIZATION_ESTIMATES_JSON` 예:

```json
{
  "usdKrw": 1350,
  "rewardedAdEcpmKrw": 12000,
  "productNetProceedsKrw": {
    "apple_app_store:expirymate_premium_monthly": 2730,
    "apple_app_store:expirymate_premium_yearly": 20300,
    "google_play:jango_plus:monthly": 2730,
    "google_play:jango_plus:yearly": 20300
  }
}
```

3. 구독 판매 시 `MONETIZATION_SUBSCRIBER_DAILY_AI_BUDGET_KRW`,
   `MONETIZATION_HOUSEHOLD_DAILY_AI_BUDGET_KRW` 설정.
4. 표본이 `MONETIZATION_GUARDRAIL_MIN_SAMPLES` 이상일 때
   `MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED=true`.

## 스토어 콘솔 · 롤아웃 대조

- [ ] AdMob iOS·Android 앱 ID·보상형 유닛 생성 (콘솔).
- [ ] EAS production `EXPO_PUBLIC_ADMOB_*` 4개 (마케팅 URL용 `1.1.0` 빌드 전).
- [ ] **(나중 · 광고 ON 직전)** Railway API:
      `ADMOB_IOS_REWARDED_AD_UNIT_ID`, `ADMOB_ANDROID_REWARDED_AD_UNIT_ID`,
      SSV 콜백, `ADMOB_SSV_USER_ID_SECRET` → 그다음 `REWARDED_ADS_ENABLED=true`.
- [ ] App Store: 구독·추천권 상품, ASSN V2 URL
      `https://API_HOST/subscriptions/notifications/apple`.
- [ ] Play Console: `jango_plus` base plan, 추천권 상품, RTDN →
      `GOOGLE_RTDN_AUDIENCE` 일치.
- [ ] 관문 통과 후 `REWARDED_ADS_ENABLED` → `SUBSCRIPTIONS_ENABLED` →
      (`expanded`) 추천권·가족. 10% → 50% → 100%.
- [ ] (이후) 쿠팡 파트너스 Phase A 딥링크 → 지표 통과 시 Phase B API.

## 운영 지표

서버 이벤트에는 원본 광고 거래 ID나 구매 토큰을 싣지 않고 내부 세션 ID와
집계값만 사용합니다. 무료 소진율, 광고 시작/완주/SSV 성공률, fill rate,
추천당 AI 비용, paywall 노출/구매/복원, 월간·연간 전환과 해지를 확인합니다.
갱신 결정 성공률은 갱신·해지 이벤트 중 갱신 비중, 구독자 해지율은 기간 시작
구독자 중 해지 사용자 비중, 환불 이벤트 비중은 결제·갱신·환불 이벤트 중 환불
비중으로 서로 분리해 계산합니다.
관리자 `/monetization` 화면에서 7·30·90일 추천 출처, 추정 AI 비용, 실험군별
퍼널, 추천권 판매량을 조회합니다. 실제 스토어 매출·수수료는 App Store Connect와
Play Console의 재무 보고서를 기준으로 대조합니다.

- 추천 1회당 p95 AI 원가와 추천권 노출→구매 전환율을 함께 확인합니다.
- 보상 광고는 검증 광고당 추정 순수익이 해당 출처의 추천당 AI 원가 1배 이상,
  구매 추천권은 추천권당 추정 순수익이 3배 이상일 때 `운영 가능`으로 표시합니다.
- D7·D30과 기간 활성 사용자는 수익화 이벤트뿐 아니라 재고 등록·수정과 완료된
  추천도 핵심 활동으로 포함합니다.
- `MONETIZATION_ESTIMATES_JSON`이 없거나 표본이 부족하면 가드레일을 억지로 0으로
  계산하지 않고 각각 `추정값 미설정`, `데이터 부족`으로 표시합니다.

프로덕션 rollout은 다음 관문을 모두 만족할 때만 10% → 50% → 100%로 확대합니다.

- 최근 검증 광고 500건의 SSV 성공률 98% 이상, 중복 보상 지급 0건.
- iOS·Android의 구매·복원·취소 후 만료·환불 시나리오를 production-like 빌드에서
  모두 통과하고 서버 권한과 스토어 상태가 일치할 것.
- 실험군 D7 유지율이 control 대비 2%p 넘게 하락하지 않고 광고·추천권 단위경제
  가드레일이 `운영 가능`일 것. 표본 미달이면 확대하지 않습니다.

`MONETIZATION_VALUE_FIRST_ROLLOUT_PERCENT`는 사용자 ID를 안정적인 해시 버킷에
배정합니다. 운영을 시작한 뒤에는 `MONETIZATION_EXPERIMENT_SALT`를 변경하지
않아야 동일 사용자가 같은 실험군을 유지합니다. 퍼널 이벤트는 허용된 이름과
짧은 문자열 속성만 저장하며 영수증·구매 토큰·광고 거래 ID는 받지 않습니다.
