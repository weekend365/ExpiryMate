---
status: active
owner: product-release
last_reviewed: 2026-08-29
source_of_truth: true
data_as_of: 2026-08-29
---

# 개인 플러스 스토어 설정·출시 체크리스트

장고야 부탁해는 이미 iOS와 Android에 출시되어 있습니다. 이 문서는 신규 앱 등록이
아니라 **기존 앱에 첫 자동 갱신 구독을 추가하는 업데이트** 절차입니다.

## 0. 진행 스냅샷 — 2026-08-29

### 완료

- 유료 앱 계약·세금·은행 상태 `Active`
- `Jango Plus` 그룹과 월간 `expirymate_premium_monthly`, 연간
  `expirymate_premium_yearly` 상품 생성
- 월 4,900원·연 39,000원, 전체 판매 지역, 같은 구독 등급, 가족 공유 끔,
  무료 체험·Offer 없음
- 한국어 그룹·상품 현지화 등록
- App Store Server Notifications V2 production·Sandbox URL 등록 및 테스트 알림
  API `201` 성공
- App Store Server API 인앱 구입 키와 Apple Root CA를 Railway production에 등록하고
  신규 배포 `/ready` 200 확인
- Billing Grace Period를 Sandbox only·16일·Paid to Paid로 설정
- Privacy·Privacy Choices URL과 App Privacy 15개 데이터 유형 게시, Tracking `No`
- iOS 1.4.0 메타데이터와 Support·Marketing URL 저장, 수동 출시 선택
- 저장소 버전 1.4.0, EAS remote auto-increment 설정, iOS Pods 동기화 검증
- 2026-08-29 기준 모바일 타입 검사, 테스트 255개, CocoaPods deployment 검증 통과
- EAS production 환경에서 API·OAuth·AdMob·Sentry 공개 환경값 로드 확인
- EAS remote iOS buildNumber `35` 확인. 9월 1일 auto-increment 예상 번호는 `36`

### 2026-09-01 빌드 전에 남은 수동 조치

- [x] App Store Connect 저작권을 `2026 devnamu`로 수정
- [x] 외부에 노출된 기존 심사 계정 비밀번호를 교체하고 App Store Connect 로그인 정보 갱신
- [x] 심사 전용 계정 로그인, 홈 정상 표시, 설정의 `함께 쓰는 냉장고` 진입점 확인
- [x] 심사 계정 소유의 `Apple 심사 냉장고` 생성과 활성 공간 상태 확인
- [x] 두 번째 구성원의 1회용 코드 수락과 소유자 화면의 `2명이 함께 써요` 확인
- [x] 소유자 계정이 등록한 활성 재고 5개가 두 번째 계정에 동기화되는지 확인
- [x] 두 번째 계정의 양파 수량 수정이 소유자 계정에 동기화되는지 확인
- [ ] 심사용 처분 데이터를 준비
- [ ] 9월 1일 빌드에서 설정 → 장고 플러스 진입과 실제 지역화 가격 재확인
- [ ] 월간·연간 상품의 Review Information에 넣을 실제 페이월 스크린샷 준비
- [ ] 심사 노트는 [`store-metadata-draft.md`](./store-metadata-draft.md)의 정본을 사용하되
  실제 심사 계정과 빌드 번호만 제출 직전에 채움

### 2026-09-01 이후 순서

1. EAS remote iOS buildNumber가 여전히 `35`인지 확인하고 production 빌드를 생성합니다.
   다른 빌드가 먼저 생성됐다면 해당 최신 번호에서 자동 증가하도록 두며 `36`을 강제로
   덮어쓰지 않습니다.
2. TestFlight 처리 완료 후 1.4.0 버전에 빌드를 연결합니다.
3. 필요한 기간에만 `IAP_ALLOW_SANDBOX_PURCHASES=true`를 적용하고 월간·연간 구매,
   취소, 갱신, grace, 만료, 복원, 타 계정 충돌을 검증합니다.
4. 구독 상품 두 개의 Review Information과 심사 스크린샷을 완성합니다.
5. 1.4.0 앱 버전과 첫 구독 두 개를 같은 심사 제출에 추가합니다.
6. 원가 No-Go와 release QA가 통과하기 전에는 수동 출시하지 않고
   `SUBSCRIPTIONS_ENABLED=false`를 유지합니다.

### 별도 남은 범위

- Railway production Volume 최신 백업
- 요리 50건·사진 30건 실제 원가 표본과 p95 No-Go 판정
- Google Play 판매자/API 권한, `jango_plus` base plan, RTDN, Data Safety 설정
- Android internal AAB와 License Tester 결제 QA

## 1. 코드와 콘솔에서 반드시 일치할 값

| 항목 | 값 |
|---|---|
| 업데이트 앱 버전 | `1.4.0` (기존 공개 버전 `1.3.0`) |
| iOS Bundle ID | `com.expirymate.mobile` |
| Android package | `com.expirymate.mobile` |
| Apple 월간 Product ID | `expirymate_premium_monthly` |
| Apple 연간 Product ID | `expirymate_premium_yearly` |
| Google subscription Product ID | `jango_plus` |
| Google 월간 Base plan ID | `monthly` |
| Google 연간 Base plan ID | `yearly` |
| 한국 월간 가격 | 4,900원 |
| 한국 연간 가격 | 39,000원 |
| 무료 체험·도입 할인 | 없음 |
| production Apple 알림 | `https://api-production-1504.up.railway.app/subscriptions/notifications/apple` |
| production Google push | `https://api-production-1504.up.railway.app/subscriptions/notifications/google` |

Product ID와 Base plan ID는 코드 계약입니다. 오타가 난 상품을 만든 경우 코드를
그 오타에 맞추지 말고, 판매 전에 올바른 ID로 새 상품 또는 base plan을 만듭니다.

## 2. 공통 선행 조건

- 실제 콘솔의 최신 iOS build number와 Android versionCode를 확인하고 다음 빌드에서
  각각 더 큰 값이 생성되는지 확인합니다. 저장소 `app.json`의 로컬 `1`을 콘솔의
  실제 최신 번호로 오해하지 않습니다. EAS remote version이 정본입니다.
- Railway migration과 API·Admin·법적 페이지를 먼저 배포하되
  `SUBSCRIPTIONS_ENABLED=false`로 신규 구매 진입을 닫아 둡니다.
- `https://jango.devnamu.com/privacy`, `/privacy/choices`, `/terms`가 로그인 없이
  열리고 인앱 페이월의 링크와 같은 문서인지 확인합니다.
- 월간·연간 상품은 기존 앱이 판매 중인 국가/지역과 맞춥니다. 한국 가격을 정확히
  입력한 뒤 다른 통화의 자동 환산 가격도 과도하게 어긋나지 않는지 검토합니다.
- 실호출 원가 기준 `60 × 요리 p95 + 30 × 사진 p95 ≤ 858원`을 통과하지 못하면
  상품을 활성화했더라도 앱의 판매 플래그를 열지 않습니다.

## 3. App Store Connect

### 3.1 계약·세금·은행

1. App Store Connect → **Business → Agreements**로 이동합니다.
2. Account Holder가 **Paid Apps Agreement**를 수락하고 상태가 `Active`인지 봅니다.
3. Banking과 Tax 양식의 누락·검증 대기가 없는지 확인합니다.
4. 앱과 IAP tax category는 실제 서비스에 맞게 검토합니다. 별도 판단 근거가 없다면
   기본 `App Store software`를 유지하고, 세무 판단이 필요하면 전문가 확인 후 바꿉니다.

### 3.2 구독 그룹과 상품

1. **Apps → 장고야 부탁해 → Monetization → Subscriptions**로 이동합니다.
2. 구독 그룹 하나를 만듭니다.
   - Reference Name: `Jango Plus`
   - 한국어 Display Name: `장고 개인 플러스`
   - 월간과 연간을 다른 그룹으로 나누지 않습니다.
3. 같은 그룹에 월간 상품을 만듭니다.
   - Reference Name: `Jango Plus Monthly`
   - Product ID: `expirymate_premium_monthly`
   - Duration: `1 Month`
   - 한국어 Display Name: `개인 플러스 월간`
   - 설명: `광고 없는 AI 추천과 폐기 예방 리포트`
   - 대한민국 가격: `₩4,900`
4. 같은 그룹에 연간 상품을 만듭니다.
   - Reference Name: `Jango Plus Yearly`
   - Product ID: `expirymate_premium_yearly`
   - Duration: `1 Year`
   - 한국어 Display Name: `개인 플러스 연간`
   - 설명: `개인 플러스 1년 이용, 월간 대비 약 34% 절약`
   - 대한민국 가격: `₩39,000`
5. 두 상품은 혜택이 같고 기간만 다르므로 같은 subscription level에 둡니다.
6. Availability는 현재 앱 판매 지역과 맞추고, Family Sharing은 이번 범위에서 끕니다.
7. Introductory Offer, Promotional Offer, Offer Code는 만들지 않습니다.
8. 각 상품의 Review Information에 실제 페이월 스크린샷과 심사 메모를 넣습니다.

### 3.3 첫 구독 심사

이 앱에서 처음 제출하는 자동 갱신 구독이므로 새 앱 버전이 반드시 필요합니다.

1. 기존 앱에 새 iOS 버전을 만듭니다. 버전 문자열은 빌드와 정확히 맞춥니다.
2. TestFlight를 통과한 새 빌드를 선택합니다.
3. 월간 상품, 연간 상품, 구독 그룹에서 각각 **Add for Review**를 누릅니다.
4. 새 앱 버전, 구독 그룹, 두 구독 상품이 **같은 draft submission**에 들어 있는지
   확인한 뒤 Submit for Review 합니다.
5. 심사 노트에는 설정 → 개인 플러스 진입 경로, 복원 버튼, 무료 체험 없음, 데모 계정,
   무료 기능 유지, 월/일 한도와 타 계정 구매 충돌 처리 방법을 적습니다.

### 3.4 App Store Server Notifications V2

1. **Apps → 장고야 부탁해 → General → App Information**으로 이동합니다.
2. App Store Server Notifications의 Production Server URL에 다음을 입력합니다.
   `https://api-production-1504.up.railway.app/subscriptions/notifications/apple`
3. Version은 **V2**를 선택합니다.
4. Sandbox Server URL은 안정적인 staging API가 있으면 staging의 같은 경로를 넣습니다.
   staging을 운영하지 않으면 production URL을 같이 사용하되, QA·심사 기간에만
   `IAP_ALLOW_SANDBOX_PURCHASES=true`로 두고 출시 후 다시 `false`로 내립니다.
5. App Store Connect에서 test notification을 보내 API 2xx와 로그를 확인합니다.

### 3.5 Grace period와 개인정보

1. **Subscriptions → Billing Grace Period**에서 먼저 Sandbox only로 켭니다.
2. 무료 체험이 없으므로 `Only Paid to Paid Renewals`, 16일을 권장 시작값으로 둡니다.
3. Sandbox에서 grace 진입·회복·만료 권한을 확인한 뒤 Production and Sandbox로 바꿉니다.
4. **App Privacy**에서 `Purchases`를 추가하고 다음처럼 답합니다.
   - 목적: App Functionality
   - 사용자에게 연결됨: Yes
   - Tracking: No
   - 결제 카드번호는 앱이 직접 받지 않으므로 수집한다고 표시하지 않음
5. 구매 이력 외 기존 SDK·사진·사용자 콘텐츠 선언은
   [`store-privacy-declarations.md`](./store-privacy-declarations.md)와 대조한 뒤 Publish 합니다.

## 4. Google Play Console

### 4.1 판매자·API 권한

1. **Developer account → Payments profile**에서 merchant payments profile과 은행·세금
   상태를 확인합니다.
2. Google Cloud에서 Google Play Developer API를 활성화합니다.
3. 구매 검증 전용 service account를 만들고 Play Console **Users and permissions**에
   초대합니다.
4. 해당 앱에 최소한 다음 권한을 부여합니다.
   - View financial data, orders, and cancellation survey responses
   - Manage orders and subscriptions
5. service account 이메일과 private key를 Railway의
   `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`에
   저장합니다. 키 파일은 저장소나 EAS public env에 넣지 않습니다.

### 4.2 Subscription과 base plans

1. **Monetize with Play → Products → Subscriptions**로 이동합니다.
2. subscription을 하나 만듭니다.
   - Product ID: `jango_plus`
   - Name: `장고 개인 플러스`
   - Benefits 예시: `광고 없는 AI 추천`, `30/90일 소비·폐기 추세`,
     `주간 폐기 예방 브리핑`, `재고 기반 실천 제안`
   - 혜택 칸에 가격이나 무료 체험 문구를 넣지 않습니다.
3. 자동 갱신 base plan `monthly`를 만듭니다.
   - Billing period: Monthly
   - 대한민국 가격: `₩4,900`
   - Auto-renewing: On
4. 자동 갱신 base plan `yearly`를 만듭니다.
   - Billing period: Yearly
   - 대한민국 가격: `₩39,000`
   - Auto-renewing: On
5. 두 base plan 모두 현재 앱 판매 국가와 맞추고 Activate 합니다.
6. Offer는 만들지 않습니다. 특히 free trial phase를 추가하지 않습니다.
7. Resubscribe는 켜고, grace period는 활성화합니다. account hold는 2025년 12월 이후의
   Google 자동 계산 기본값을 권장합니다. pause는 서버가 paused 상태를 무권한으로
   처리하는지 QA한 뒤에만 켭니다.

### 4.3 RTDN과 인증된 Pub/Sub push

1. Google Cloud Pub/Sub API를 켜고 topic 하나를 만듭니다. 예:
   `projects/PROJECT_ID/topics/jango-play-billing`
2. topic IAM에
   `google-play-developer-notifications@system.gserviceaccount.com`을 추가하고
   `Pub/Sub Publisher` 역할을 부여합니다.
3. Pub/Sub push 인증용 user-managed service account를 준비합니다.
4. push subscription을 다음처럼 만듭니다.
   - Delivery type: Push
   - Endpoint:
     `https://api-production-1504.up.railway.app/subscriptions/notifications/google`
   - Enable authentication: On
   - Audience: 위 endpoint와 **문자 하나까지 동일**
   - Payload unwrapping: Off. API는 `message.data` wrapper를 기대합니다.
5. Pub/Sub service agent
   `service-PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com`에
   `Service Account Token Creator` 역할을 부여합니다.
6. Railway `GOOGLE_RTDN_AUDIENCE`도 동일한 endpoint 문자열로 설정합니다.
7. Play Console **Monetize with Play → Monetization setup → Real-time developer
   notifications**에서 RTDN을 켭니다.
8. Topic name에 전체 `projects/…/topics/…` 이름을 넣고, subscriptions와 voided
   purchases를 포함하는 알림 유형을 선택합니다.
9. **Send Test Message**를 눌러 push 응답 2xx와 API 로그를 확인합니다. RTDN 자체에는
   완전한 권한 상태가 없으므로 서버가 Play Developer API를 다시 조회하는지도 봅니다.

### 4.4 Data safety와 앱 콘텐츠

1. **Policy and programs → App content → Data safety**를 수정합니다.
2. Financial info의 `Purchase history`를 수집으로 선언합니다.
   - 목적: App functionality, Fraud prevention/security 중 실제 사용 목적만 선택
   - 사용자에게 연결됨: Yes
   - 공유 여부: 서버 수탁자와 Play 정의를 대조해 실제대로 답변
3. Google Play 결제창이 직접 받는 카드번호는 앱·서버가 접근하지 않으므로 앱의
   `User payment info` 수집으로 신고하지 않습니다.
4. 계정 삭제 URL, Privacy Policy URL, 광고 ID 미사용, 사진 처리 선언을 현재 빌드와
   다시 대조합니다.
5. Financial features declaration은 일반 디지털 구독을 금융 서비스로 오인해 체크하지
   말고, 앱에 금융 기능이 없다면 `My app doesn't provide any financial features`를 유지합니다.

## 5. 테스트와 rollout

### 5.1 iOS Sandbox/TestFlight

- App Store Connect → Users and Access → Sandbox에서 새 tester를 만듭니다.
- 월간·연간 구매, 사용자 취소, 갱신, billing retry/grace, 만료, 환불/revocation,
  구매 복원, 앱 재설치, 오프라인 복귀를 확인합니다.
- 다른 장고 계정으로 같은 Apple 구매를 복원할 때 자동 이전되지 않고 지원 안내가
  나오는지 확인합니다.
- 상품 메타데이터 변경은 Sandbox 반영에 최대 약 1시간 걸릴 수 있습니다.

### 5.2 Android license/internal testing

- Play Console → Settings → License testing에 테스트 Google 계정을 추가합니다.
- 같은 계정을 internal testing 트랙 tester에도 포함하고 Play 링크로 설치합니다.
- 성공 구매뿐 아니라 `Test card, always approves/declines`, slow 승인·취소 pending,
  grace, account hold, pause, 갱신, 만료, 환불, revoke를 확인합니다.
- 최초 구매는 `PURCHASED` 확인 후 서버가 acknowledge하고, `PENDING`에는 권한을
  부여하거나 acknowledge하지 않는지 확인합니다.

### 5.3 배포 순서

1. migration → API/Admin/법적 페이지 배포, `SUBSCRIPTIONS_ENABLED=false`
2. Apple/Google 상품과 알림 설정, Sandbox/License QA
3. 원가 No-Go와 복원·타 계정 충돌 QA 통과
4. iOS는 첫 구독과 새 앱 버전을 같은 심사에 제출
5. Android는 internal → staged production rollout
6. 양 스토어에서 새 앱 버전과 상품 사용 가능 상태를 확인한 뒤
   `SUBSCRIPTIONS_ENABLED=true`, `SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED=true`,
   `MONETIZATION_REVENUE_LEDGER_ENABLED=true`
7. 5% → 20% → 50% → 100% 단계 배포를 권장하며 각 단계에서 구매 검증 성공률,
   복원 성공률, 중복 권한, 미승인 구매, 환불률, AI 원가를 확인합니다.

## 6. 출시 직전 Railway 값

```text
SUBSCRIPTIONS_ENABLED=false  # 스토어 승인·원가 검증 후 true
HOUSEHOLD_SUBSCRIPTIONS_ENABLED=false
PAID_RECOMMENDATION_CREDITS_ENABLED=false
MONETIZATION_OFFER_MODE=core
IAP_ALLOWED_PRODUCT_IDS=expirymate_premium_monthly,expirymate_premium_yearly,jango_plus
APPLE_BUNDLE_ID=com.expirymate.mobile
APPLE_APP_STORE_ENVIRONMENT=production
GOOGLE_PLAY_PACKAGE_NAME=com.expirymate.mobile
GOOGLE_RTDN_AUDIENCE=https://api-production-1504.up.railway.app/subscriptions/notifications/google
SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED=false  # 유료 판매 시작과 함께 true
MONETIZATION_REVENUE_LEDGER_ENABLED=true
```

App Review/TestFlight가 production API를 사용하는 동안만
`IAP_ALLOW_SANDBOX_PURCHASES=true`로 설정하고, production 판매 시작 직후
`false`로 되돌립니다.

## 7. 장애 시

- 구매 검증 또는 스토어 알림 장애: `SUBSCRIPTIONS_ENABLED=false`로 **신규 판매만** 닫습니다.
- 기존 entitlement 검증, Apple/Google 알림, resync scheduler, 수익 원장은 끄지 않습니다.
- 이미 결제한 사용자의 한도를 낮추거나 무료 기능을 막지 않습니다.
- Google에서 base plan을 비활성화하거나 Apple 상품 판매를 중단하는 조치는 신규 판매
  플래그만으로 통제되지 않는 긴급 상황에서만 사용합니다.

## 공식 참고

- [Apple: 자동 갱신 구독 생성](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/)
- [Apple: 첫 IAP/구독 심사 제출](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)
- [Apple: Server Notifications URL](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/enter-server-urls-for-app-store-server-notifications)
- [Apple: Billing Grace Period](https://developer.apple.com/help/app-store-connect/manage-subscriptions/enable-billing-grace-period-for-auto-renewable-subscriptions/)
- [Google Play: 구독과 base plan 생성](https://support.google.com/googleplay/android-developer/answer/140504)
- [Google Play Billing: RTDN 준비](https://developer.android.com/google/play/billing/getting-ready)
- [Google Cloud: 인증된 Pub/Sub push](https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions)
- [Google Play: Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
