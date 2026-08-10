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

## API 환경변수

```text
RECIPE_FREE_DAILY_LIMIT=1
RECIPE_REWARDED_DAILY_LIMIT=3
RECIPE_SUBSCRIBER_DAILY_LIMIT=30
RECIPE_ABSOLUTE_DAILY_LIMIT=30
RECIPE_ADS_DISABLED_FREE_DAILY_LIMIT=4
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

### Apple

- 구독 그룹 `jango_plus`, 동일 등급, Family Sharing 끔, 무료 체험 없음.
- `expirymate_premium_monthly` 월 3,900원,
  `expirymate_premium_yearly` 연 29,000원.
- App Store Server Notifications V2 URL:
  `https://API_HOST/subscriptions/notifications/apple`.
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

## 실기기 QA

- KST 23:59/00:00 경계, 무료 1회, 광고 최대 3편, 구독 총 30회.
- 같은 `Idempotency-Key` 재전송, 동시 탭, AI 실패 시 예약 해제.
- 광고 로드 실패·닫기·완주·10초 지연·백그라운드 복귀.
- 구독 계정에서 Google Mobile Ads 네트워크 요청이 없는지 프록시로 확인.
- 월간·연간 구매, Android pending, 복원, 관리, 취소 후 만료, 유예·환불.
- 활성 구독 계정 삭제 화면의 별도 스토어 해지 경고.
- 바코드 토큰 만료·위조·OFF 장애, 하루 3회·잔액 10회, 동시 최초 등록.
- 바코드 추천권 추천 실패 복구와 구독 중 잔액 보존.
- iPhone, iPad, Android 내부 테스트 production-like 빌드.

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
