---
status: active
owner: product
last_reviewed: 2026-08-29
source_of_truth: true
---

# 장고 수익화 운영 기준

기준일: 2026년 8월 29일

이 문서는 현재 장고(ExpiryMate)의 수익화 범위와 운영 방법을 정리한 단일 기준입니다.
이미 출시된 앱의 다음 수익화 업데이트 범위는 **개인 플러스 자동 갱신 구독**입니다.
기존 **AdMob 보상형 광고**와 **쿠팡 파트너스**는 유지하며, 가족 플러스와 일회성
추천권은 판매하지 않습니다.

## 1. 현재 범위

| 모델 | 현재 상태 | 사용자 가치 | 수익 발생 시점 |
| --- | --- | --- | --- |
| 개인 플러스 | 출시 대상 | 광고 없는 AI 흐름, 폐기 예방 브리핑, 30/90일 추세와 실천 제안 | Apple/Google 자동 갱신 결제 |
| AdMob 보상형 광고 | 운영 대상 | 무료 AI 한도를 쓴 사용자가 광고를 보고 당일 사용량 1회 획득 | 서버가 검증한 광고 완료 |
| 쿠팡 파트너스 | 운영 대상 | 레시피의 부족 재료, 최근 소비 재료, 직접 검색 상품을 쿠팡에서 확인 | 제휴 링크 이후 쿠팡에서 인정된 구매 |
| 가족 플러스 | 이후 검토 | 현재 신규 판매하지 않음 | 해당 없음 |
| 일회성 추천권 판매 | 추후 검토 | 현재 신규 판매하지 않음 | 해당 없음 |
| 배너·전면·앱 오픈 광고 | 도입하지 않음 | 핵심 재고·요리 흐름을 방해할 가능성이 큼 | 해당 없음 |

운영 원칙은 다음과 같습니다.

- 광고 시청과 쿠팡 이동은 모두 사용자가 명시적으로 선택합니다.
- 광고 시청이나 쿠팡 구매를 재고 관리, 레시피 열람 등 기본 기능의 조건으로 삼지 않습니다.
- 쿠팡 클릭·구매에 앱 내 보상이나 추천 사용량을 지급하지 않습니다.
- 광고와 제휴 상품 실패가 레시피·재고 기능의 오류로 번지지 않게 합니다.
- 사용자 단위 쿠팡 구매 귀속은 시도하지 않습니다.
- 무료 재고·유통기한·공유·기본 알림·삭제·지원 기능은 구독 여부와 무관하게 유지합니다.
- 활성 구독자의 약정된 한도는 결제 기간 중 원가 상태에 따라 낮추지 않습니다.

## 2. 개인 플러스

### 상품과 사용자 가치

| 항목 | 무료 | 개인 플러스 |
| --- | --- | --- |
| 재고·유통기한·공유·기본 알림 | 현재 기능 유지 | 동일 |
| 요리 추천 | 1회/일 + 선택형 광고 최대 10회/일 | 광고 없이 60회/월, 최대 5회/일 |
| 사진 일괄 등록 | 1회/일 + 선택형 광고 최대 3회/일 | 광고 없이 30회/월, 최대 3회/일 |
| 소비·폐기 리포트 | 최근 30일 소비·폐기 개수 미리보기 | 30/90일 추세, 폐기율, 주간 비교, 상위 폐기 분류 |
| 폐기 예방 행동 | 기존 임박 재고 화면 | 홈 주간 브리핑, 임박 재료 추천과 재고 확인 제안 |
| 광고 | 무료 AI분 소진 후 사용자가 선택 | 요리·사진 흐름 모두 미노출 |

- 월 4,900원, 연 39,000원이며 무료 체험은 없습니다. 페이월 기본 선택은 월간입니다.
- 연간 할인율은 스토어가 반환한 현지 가격을 기준으로 계산하며 한국 가격에서는 월간
  12회 대비 약 34% 절약입니다.
- 스토어 가격, 결제 주기, 자동 갱신, 해지 위치, 이용약관·개인정보 링크와 무료 앱
  이용 가능 여부를 결제 전에 같은 화면에서 안내합니다.
- 페이월은 설정, 무료 AI 소진 후 대안, 준비된 리포트 미리보기에서만 진입합니다.
  가입·재고 등록·스캔 도중에는 표시하지 않습니다.

### 한도와 차감

- 월간 한도는 KST 매월 1일, 일일 안전 상한은 KST 자정에 초기화합니다.
- 중간 가입자도 해당 KST 월의 전체 월간 한도를 받고, 가입 전 무료·광고 사용량은
  구독 월간 한도에서 빼지 않습니다.
- 개인 플러스 한도는 사용자 단위이며 사용자가 참여한 모든 공간에서 합산합니다.
- 성공한 AI 작업만 확정 차감합니다. 실패·취소·서버 오류는 예약량을 반환하고,
  동일 idempotency key 재시도는 중복 차감하지 않습니다.
- 원가 악화 시 `SUBSCRIPTIONS_ENABLED=false`로 신규 판매만 중단하고 이미 활성화된
  권리는 만료 또는 스토어 철회 시점까지 유지합니다.

### 인사이트와 처분 이벤트

소비·폐기 분석은 항목의 `updatedAt`을 추정값으로 사용하지 않습니다. 상태 전환과 같은
DB 트랜잭션에서 append-only 처분 이벤트를 기록하며 공간, 항목 snapshot, 분류,
소비/폐기 결과, 수행자, 발생 시각을 저장합니다. 기존 종료 상태 항목은 `updatedAt`으로
한 번 백필하되 `backfill` 출처로 구분합니다.

```text
GET /insights/preview?spaceId=…
GET /insights/overview?spaceId=…&windowDays=30|90
GET /subscriptions/plus-insights  # 한 버전 호환 위임
```

미리보기는 무료 사용자도 최근 30일 소비·폐기 개수와 준비 여부를 볼 수 있습니다.
선택 공간의 처분 이벤트가 5개 이상이면 홈에 CTA를 표시합니다. 전체 분석은 활성 개인
플러스와 선택 공간 멤버십을 모두 확인한 후 그 공간의 데이터를 반환합니다.

### 구매·복원·갱신

결제 전에 `POST /subscriptions/purchase-intents`로 짧은 수명의 결제 의도를 만들고,
Apple `appAccountToken` 또는 Google 난독화 계정 ID를 로그인 사용자와 결합합니다.
영수증 검증 요청은 `purchaseIntentId`를 포함하며 서버가 상품, 스토어 거래 식별자와
외부 계정 식별자를 대조합니다.

- 복원은 개인 플러스 상품만 다루며 다른 장고 계정에 연결된 구매를 자동 이전하지 않습니다.
- Google 신규 구매는 서버 검증 뒤 승인합니다.
- Apple Server Notification, Google RTDN과 주기적 재동기화를 함께 사용합니다.
- 취소 후 만료 전과 grace period에는 혜택을 유지합니다.
- 만료·pause/hold·환불·revocation은 서버 권한에 즉시 반영합니다.

## 3. AdMob 보상형 광고

### 사용자 흐름

1. 무료 사용자가 당일 무료 AI 추천을 모두 사용합니다.
2. 사용자가 `광고 보고 추천 1회 받기`를 선택합니다.
3. 앱이 서버에서 보상형 광고 세션과 SSV 값을 발급받습니다.
4. 앱은 비맞춤형, 콘텐츠 등급 `G` 광고를 표시합니다.
5. 광고 완료 후 Google의 Server-Side Verification 콜백이 성공해야 추천 1회를 지급합니다.
6. 앱의 완료 이벤트만 도착하고 SSV가 늦으면 `확인 중`으로 표시하고 복귀 시 다시 확인합니다.

광고 닫기, 로드 실패, 재생 오류에는 보상을 지급하지 않습니다. 클라이언트의
`EARNED_REWARD` 이벤트는 확인 시작 신호일 뿐이며, 지급의 단일 기준은 서버 SSV입니다.

현재는 보상형 광고만 사용합니다. 홈·재고·레시피 상세·장보기·조리 화면에는 배너를
넣지 않으며, 완료 화면 전면 광고와 앱 오픈 광고도 운영하지 않습니다. 특히 장보기
화면에는 쿠팡 상품과 경쟁하는 광고를 추가하지 않습니다.

### 설정 위치

EAS production 환경에는 공개 가능한 앱/광고 단위 ID를 설정합니다.

```text
EXPO_PUBLIC_ADMOB_IOS_APP_ID=
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=
EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID=
EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID=
```

Railway API에는 서버 검증과 기능 플래그를 설정합니다.

```text
REWARDED_ADS_ENABLED=true
RECIPE_FREE_DAILY_LIMIT=1
RECIPE_REWARDED_DAILY_LIMIT=10
ADMOB_IOS_REWARDED_AD_UNIT_ID=
ADMOB_ANDROID_REWARDED_AD_UNIT_ID=
ADMOB_SSV_USER_ID_SECRET=
```

- EAS와 Railway의 플랫폼별 보상형 광고 단위 ID는 같아야 합니다.
- `ADMOB_SSV_USER_ID_SECRET`은 충분히 긴 임의 문자열이며 모바일 환경변수에 넣지 않습니다.
- AdMob SSV 콜백 URL은 `https://API_HOST/monetization/admob/ssv`입니다.
- production 빌드는 Google 테스트 ID를 허용하지 않습니다. development/preview는 코드에서 테스트 광고 단위를 사용합니다.
- 개발자 웹사이트의 `/app-ads.txt`는 `ADMOB_PUBLISHER_ID`로 생성하며 외부에서 HTTP 200으로 조회돼야 합니다.
- 광고 긴급 중단은 Railway의 `REWARDED_ADS_ENABLED=false`로 처리합니다.

### 관측 지표

관리자 `/monetization`에서 최소 다음 값을 봅니다.

- 광고 요청 → 로드 → 열림 → 완료 → SSV 검증 퍼널
- SSV 성공률과 중복 지급 여부
- 지급된 광고 추천 중 실제 사용된 비율
- 검증 광고 1건당 추정 수익과 AI 추천 1회당 원가

초기 운영 판단 기준은 SSV 성공률 98% 이상, 중복 지급 0건입니다. 광고 수익 추정치는
실제 AdMob 정산액과 주기적으로 대조합니다.

## 4. 쿠팡 파트너스

### 노출 위치

- 레시피 상세: 있으면 좋은 선택 재료 최대 2개, 재료별 관련 상품 최대 3개
- 레시피 상세 고정 하단: `있으면 좋은 재료 n개 장보기`로 내부 장보기 검색 진입
- 장보기 탭 `/(tabs)/shop`: 상단 직접 검색
- 장보기 탭 `/(tabs)/shop`: 최근 30일 내 수량을 모두 소비한 재료 중 최근 3개, 재료별 상품 최대 3개
- 보관함: `전부 사용` 직후 해당 재료가 채워진 내부 장보기 검색 진입
- 조리 완료: 이번 요리에서 모두 사용한 재료 최대 3개 묶음 장보기
- 홈: 최근 완전 소비 또는 반복 소비 주기가 도래한 재료의 상품 1개 미리보기
- 하단 내비게이션: 장보기 탭 상시 진입

폐기한 재료, 부분 소비 재료, 허용하지 않은 상품군, 사용자 레시피 제외 조건과 충돌하는
재료는 자동 추천에서 제외합니다. 일반 골드박스, 무관한 베스트 상품, 다이나믹 배너는
사용하지 않습니다. CTA는 `쿠팡에서 보기`로 통일하며 앱 안에서 장바구니나 결제를
제공하지 않습니다.

각 상품 영역에는 다음 고지를 인접하게 표시합니다.

> 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.

결제, 배송, 환불은 쿠팡에서 이뤄지며 앱은 실물 상품 결제 금액을 직접 받지 않습니다.

### 서버 처리와 폴백

상품 검색과 HMAC 서명은 API 서버에서만 수행합니다. 모바일에는 상품 ID, 상품명,
이미지, 표시 가격, 로켓·무료배송 여부, 제휴 URL, 조회 시각, stale 여부만 전달합니다.

- 쿠팡 검색 상위 10개 중 상품명 관련성이 확인된 결과만 원래 순서대로 최대 3개 반환
- 상품 검색 동시 호출 최대 2개, 동일 검색어의 진행 중 요청은 하나로 통합
- 사용자 직접 검색은 사용자별 분당 10회
- 메모리 캐시: 30분 fresh, 이후 6시간까지 stale
- stale 상품은 가격을 숨기고 `쿠팡에서 가격 확인`으로 표시
- 오류·타임아웃·429·회로 차단 시 검색 딥링크로 강등
- 딥링크도 만들 수 없으면 설정된 고정 파트너 링크 사용
- 사용 가능한 제휴 URL이 없으면 상품 영역만 숨김
- 허용 URL은 HTTPS의 `coupang.com`, `link.coupang.com`, `coupa.ng` 계열로 제한

쿠팡 키, Authorization 헤더, 원문 API 응답은 로그나 분석 이벤트에 저장하지 않습니다.
상품 검색을 위해 쿠팡으로 전달될 수 있는 값은 정규화한 재료명 또는 사용자가 직접
입력한 검색어 한 건입니다. 계정 ID, 전체 재고 목록, 유통기한, 수량, 공간 정보는
전달하지 않습니다.

### API 계약

```text
GET  /recipes/recommendations/:id/dishes/:dishIndex/affiliate-offers
GET  /spaces/:spaceId/affiliate/shopping
GET  /spaces/:spaceId/affiliate/reorder-preview
POST /spaces/:spaceId/affiliate/product-search
     { "query": "두부", "placement": "shopping_search|inventory_consumed|cooking_complete|recipe_optional_entry|home_reorder_preview" }
```

모든 엔드포인트는 로그인이 필요합니다. 공간 단위 엔드포인트는 해당 공간 멤버십도
검증합니다. 레시피 응답의 구버전 `offers`는 호환을 위해 유지하고, 신버전은
`productGroups`와 `presentation`을 사용합니다.

### Railway 설정

```text
AFFILIATE_OFFERS_ENABLED=true
AFFILIATE_OFFERS_ROLLOUT_PERCENT=100
AFFILIATE_PLACEMENT_RECIPE_MISSING_ENABLED=true
AFFILIATE_PLACEMENT_RECIPE_MISSING_ROLLOUT_PERCENT=100
AFFILIATE_PLACEMENT_SHOPPING_RECENT_ENABLED=true
AFFILIATE_PLACEMENT_SHOPPING_RECENT_ROLLOUT_PERCENT=100
AFFILIATE_PLACEMENT_SHOPPING_SEARCH_ENABLED=true
AFFILIATE_PLACEMENT_SHOPPING_SEARCH_ROLLOUT_PERCENT=100
AFFILIATE_PLACEMENT_INVENTORY_CONSUMED_ENABLED=true
AFFILIATE_PLACEMENT_INVENTORY_CONSUMED_ROLLOUT_PERCENT=100
AFFILIATE_PLACEMENT_COOKING_COMPLETE_ENABLED=true
AFFILIATE_PLACEMENT_COOKING_COMPLETE_ROLLOUT_PERCENT=100
AFFILIATE_PLACEMENT_RECIPE_OPTIONAL_ENTRY_ENABLED=true
AFFILIATE_PLACEMENT_RECIPE_OPTIONAL_ENTRY_ROLLOUT_PERCENT=100
AFFILIATE_PLACEMENT_HOME_REORDER_ENABLED=true
AFFILIATE_PLACEMENT_HOME_REORDER_ROLLOUT_PERCENT=100
COUPANG_PARTNERS_ACCESS_KEY=
COUPANG_PARTNERS_SECRET_KEY=
COUPANG_PARTNERS_TRACKING_LINK=
COUPANG_PARTNERS_SUB_ID=
COUPANG_REPORT_SYNC_ENABLED=true
AFFILIATE_MAX_PRODUCTS_PER_INGREDIENT=3
AFFILIATE_OFFER_CACHE_SECONDS=1800
AFFILIATE_OFFER_STALE_SECONDS=21600
```

- Access/Secret은 Railway API secret에만 저장하고 EAS·모바일·Admin 빌드 변수에는 넣지 않습니다.
- Access/Secret은 반드시 한 쌍으로 설정합니다. 한쪽만 있으면 production 시작 검증이 실패합니다.
- `COUPANG_PARTNERS_TRACKING_LINK`는 본인 쿠팡 파트너스 콘솔에서 만든 고정 제휴 링크입니다. API·딥링크 장애 시 최종 폴백이므로 설정을 권장합니다.
- `COUPANG_PARTNERS_SUB_ID`는 쿠팡 파트너스에 실제 등록된 채널/하위 ID가 있을 때만 정확한 값을 넣습니다. 별도 등록값이 없거나 확실하지 않으면 비워 둡니다.
- placement별 `*_ENABLED`, `*_ROLLOUT_PERCENT`는 전체 제휴 기능을 끄지 않고 특정 노출 위치만 즉시 중단하거나 `5 → 25 → 100`으로 확대할 때 사용합니다.
- 리포트 동기화는 Access/Secret이 있을 때만 켭니다. 계정 권한이 리포트 API를 지원하는지 smoke test로 확인합니다.

### 리포트와 분석

앱은 카드 면적의 절반 이상이 활성 화면에 300ms 이상 들어온 상품과 제휴 진입점만
노출로 한 번 기록합니다. 상품 클릭 이벤트에는
`placement`, `productId`, `source`만 기록하며 원문 검색어, 재고 ID, 공간 ID는 넣지
않습니다. 주요 이벤트는 다음과 같습니다.

```text
affiliate_shopping_opened
affiliate_entry_shown
affiliate_entry_tapped
affiliate_product_shown
affiliate_product_tapped
affiliate_fallback_tapped
```

쿠팡 리포트는 KST 15:30 이후 하루 한 번 동기화합니다. 최초에는 최근 90일을 30일
이하 구간으로 나누어 가져오고, 이후에는 취소·반품 보정을 위해 최근 35일을 upsert합니다.
여러 API 인스턴스가 떠 있어도 DB lease로 한 인스턴스만 실행합니다.

관리자 `/monetization`은 다음 두 종류를 분리해 보여 줍니다.

- 앱 지표: 진입점과 상품의 노출, 탭, CTR, placement별 성과
- 쿠팡 집계: 클릭, 주문, 취소, GMV, 실제 수수료, 클릭→주문 전환율, 클릭당 수익, 마지막 동기화 시각

앱 탭과 쿠팡 클릭은 집계 기준과 시차가 다르므로 같은 숫자로 가정하지 않습니다.

## 5. 운영 적용 순서

### 배포 전

- Railway DB에 `20260818130000_add_affiliate_report_daily`를 포함한 미적용 migration이 배포되는지 확인
- API 컨테이너 시작 시 `prisma migrate deploy` 성공 확인
- EAS production에 실제 AdMob 앱 ID·보상형 유닛 ID 4개 설정
- Railway에 AdMob 서버 변수와 쿠팡 키·폴백 링크 설정
- `/partners`, `/privacy`, 스토어 개인정보 선언과 실제 앱 동작 대조
- `20260829120000_add_personal_plus_launch` migration의 처분 이벤트 백필 건수와
  구매 의도 테이블을 확인
- App Store/Play 월간·연간 상품, Apple 알림, Google RTDN, 주기적 재동기화 설정
- 요리 50건·사진 30건의 평균/p50/p95 실원가 표본과 판매 No-Go 판정 확인
- 자동 갱신, 해지·환불, 계정 삭제 구분, 가격 표시와 다크패턴 금지 문구를 국내
  법률 검토로 확인. 가격 인상·무료 체험은 30일 전 동의·고지 기능을 별도 구현하기
  전까지 도입하지 않음

Railway만 데이터베이스를 운영한다면 로컬 `localhost:5432`를 대상으로
`pnpm db:migrate:deploy`할 필요가 없습니다. 현재 API Docker 시작 과정에서 production
DB migration을 실행하므로 Railway 배포 로그에서 성공 여부를 확인합니다.

### 활성화

1. `SUBSCRIPTIONS_ENABLED=false`로 DB migration, API, Admin과 법적 페이지를 먼저 배포합니다.
2. 개인 플러스 상품과 Apple/Google 서버 알림을 설정합니다.
3. iOS Sandbox와 Android License 계정으로 구매·pending·복원·갱신·취소·grace·
   pause/hold·만료·환불·revocation을 확인합니다.
4. production 앱 공개와 동시에 원가 No-Go 통과를 재확인하고 `SUBSCRIPTIONS_ENABLED=true`로 전환합니다.
5. 실제 빌드에서 AdMob 테스트 후 `REWARDED_ADS_ENABLED=true`로 전환합니다.
6. 쿠팡 상품 검색·딥링크·외부 열기 smoke test 후 `AFFILIATE_OFFERS_ENABLED=true`로 전환합니다.
7. 쿠팡은 가능하면 rollout `5 → 25 → 100` 순서로 확대합니다.
8. 상품 smoke test 뒤 `COUPANG_REPORT_SYNC_ENABLED=true`로 켜고 다음 집계 주기를 확인합니다.

### 장애 대응

| 상황 | 즉시 조치 | 앱 동작 |
| --- | --- | --- |
| AdMob SSV·광고 장애 | `REWARDED_ADS_ENABLED=false` | 광고 진입을 닫고 레시피·재고는 유지 |
| 결제 검증·스토어 알림 장애 | `SUBSCRIPTIONS_ENABLED=false` | 신규 판매만 닫고 기존 구독 혜택은 서버 권한 기준 유지 |
| 쿠팡 오류·429 증가 | 자동 회로 차단 확인, 필요 시 rollout 축소 | 딥링크 또는 고정 링크로 강등 |
| 잘못된 상품 노출 | `AFFILIATE_OFFERS_ENABLED=false` | 상품 영역만 숨김 |
| 리포트 권한·동기화 오류 | `COUPANG_REPORT_SYNC_ENABLED=false` | 사용자 상품 기능은 계속 동작 |
| 키 노출 의심 | 쿠팡 키 폐기·재발급 후 Railway secret 교체 | 모바일 재빌드 불필요 |

## 6. 출시 인수 기준

### 개인 플러스

- 월 4,900원·연 39,000원 실제 지역화 가격, 월간 기본 선택, 무료 체험 문구 없음
- 신규 구매, pending, 중복 콜백, 복원, 타 계정 충돌, 갱신, 취소, grace,
  billing retry, pause/hold, 만료, 환불·철회 검증
- KST 일/월 경계, 중간 가입 전체 월 한도, 동시 요청, 실패 반환, 공간 간 사용자 합산
- 처분 이벤트 백필, 무료 미리보기, 30/90일 분석과 공간 권한 검증
- 구매 검증·복원 성공률 98% 이상, 중복 권한·미승인 Google 구매 0건
- 환불 비중 5% 미만, AI 원가 순매출의 25% 이하
- `60 × 요리 p95 + 30 × 사진 p95 ≤ 858원`; 미충족 시 판매 활성화 금지

### 광고

- iOS·Android production 빌드에서 실제 광고 단위 로드
- 광고 닫기·실패에는 보상 없음
- 완료 후 SSV 성공 시에만 추천 1회 지급
- 같은 콜백·세션의 중복 지급 0건
- 앱 백그라운드 복귀와 지연 SSV 재확인
- `REWARDED_ADS_ENABLED=false`일 때 광고 CTA 비활성

### 쿠팡

- 한글·공백·특수문자 검색 HMAC 서명 성공
- 레시피·최근 소비·직접 검색에서 관련 상품 최대 3개
- stale 캐시에서는 가격 숨김
- 잘못된 JSON, 401, 403, 429, 5xx, 타임아웃에서 안전하게 폴백
- 타 공간 접근 차단, 최근 30일·완전 소비·중복 제거·폐기 제외 확인
- 상품 노출 중복 방지와 외부 URL 열기 실패 처리
- 리포트 최초 90일 백필, 최근 35일 보정 upsert, scheduler lease 확인
- 원문 검색어·재고 ID·공간 ID·비밀값이 분석/로그에 남지 않음

## 7. 추후 검토 항목

다음 항목은 현재 출시 범위가 아니며 별도 사업성·스토어 심사·QA 결정 후 진행합니다.

- 가족 플러스 신규 판매
- 일회성 AI 추천권 판매
- 바코드 기여 보상 확대
- 배너, 전면, 앱 오픈 광고
- 다른 쇼핑몰 제휴 또는 가격 비교

개인 플러스 외 상품 관련 스키마, API, 화면이 저장소에 남아 있어도 판매 승인을
의미하지 않습니다. 개인 플러스 첫 production 판매는 아래 값을 유지합니다.

```text
SUBSCRIPTIONS_ENABLED=true  # 앱 공개와 원가 No-Go 통과 전에는 false
PAID_RECOMMENDATION_CREDITS_ENABLED=false
HOUSEHOLD_SUBSCRIPTIONS_ENABLED=false
BARCODE_REWARDS_ENABLED=false
SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED=true
MONETIZATION_REVENUE_LEDGER_ENABLED=true
MONETIZATION_OFFER_MODE=core
```

가족 플러스나 추천권 판매를 검토할 때에는 가격·AI 원가, 상품 승인, 권한 범위,
구매 복원, 환불·취소와 스토어 개인정보 선언을 별도 출시 계획으로 작성합니다.

## 8. 관련 문서

- 개인정보 선언 대조: [`store-privacy-declarations.md`](./store-privacy-declarations.md)
- 스토어 메타데이터 초안: [`store-metadata-draft.md`](./store-metadata-draft.md)
- iOS/EAS production: [`ios-eas-production.md`](./ios-eas-production.md)
- 개발·운영 시크릿: [`dev-secrets.md`](./dev-secrets.md)
- 공개 쿠팡 안내 페이지: `apps/admin/app/partners/page.tsx`
- 과거 수익화 설계: [`archive/monetization-v1.1-v1.2.md`](./archive/monetization-v1.1-v1.2.md)
