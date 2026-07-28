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

## API 환경변수

```text
RECIPE_FREE_DAILY_LIMIT=1
RECIPE_REWARDED_DAILY_LIMIT=3
RECIPE_SUBSCRIBER_DAILY_LIMIT=30
RECIPE_ABSOLUTE_DAILY_LIMIT=30
RECIPE_ADS_DISABLED_FREE_DAILY_LIMIT=4
REWARDED_ADS_ENABLED=false
SUBSCRIPTIONS_ENABLED=false
MINIMUM_MOBILE_APP_VERSION=

ADMOB_IOS_REWARDED_AD_UNIT_ID=
ADMOB_ANDROID_REWARDED_AD_UNIT_ID=
ADMOB_SSV_USER_ID_SECRET=

IAP_ALLOWED_PRODUCT_IDS=expirymate_premium_monthly,expirymate_premium_yearly,jango_plus
APPLE_ROOT_CERTIFICATES_BASE64=
APPLE_APP_ID=
GOOGLE_RTDN_AUDIENCE=https://API_HOST/subscriptions/notifications/google
```

`ADMOB_SSV_USER_ID_SECRET`, 구매 토큰, Apple 키, Google 서비스 계정 키는 로그나
저장소에 남기지 않습니다. Google 구매 토큰은 서버에 SHA-256 해시만 저장합니다.

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
- iPhone, iPad, Android 내부 테스트 production-like 빌드.

## 운영 지표

서버 이벤트에는 원본 광고 거래 ID나 구매 토큰을 싣지 않고 내부 세션 ID와
집계값만 사용합니다. 무료 소진율, 광고 시작/완주/SSV 성공률, fill rate,
추천당 AI 비용, paywall 노출/구매/복원, 월간·연간 전환과 해지를 확인합니다.
