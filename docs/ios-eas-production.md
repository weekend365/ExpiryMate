---
status: active
owner: mobile-release
last_reviewed: 2026-10-08
source_of_truth: true
---

# iOS · EAS production (P0-06)

Apple Developer Program 가입 이후 **Sign in with Apple · Push · TestFlight/App Store** 를 켜기 위한 체크리스트입니다.  
코드 쪽 설정은 `apps/mobile/app.json`, `app.config.js`, `eas.json`에 반영됩니다. iOS EAS worker에서는 패키지 `postinstall`이 tracked native 프로젝트를 `expo prebuild`로 다시 동기화하며, 이후 EAS가 CocoaPods를 설치합니다.

## 출시 앱과 개발 앱 함께 사용하기

출시 앱은 `장고야 부탁해` / `com.expirymate.mobile` / `expirymate`를 유지합니다.
개발 앱은 `장고 QA` / `com.expirymate.mobile.crayonqa` / `jango-crayonqa`로 분리합니다.
앱 설치 공간과 URL scheme이 달라 App Store 앱을 지우지 않고 함께 사용할 수 있습니다.
계정과 서버 데이터의 분리는 API 환경 설정에 따릅니다. 앱 식별자 변경만으로 별도 서버가 생기지는 않습니다.

처음 한 번 iPhone을 연결하고 QA 개발 클라이언트를 빌드·설치합니다.

```sh
pnpm --filter @expirymate/mobile ios:dev
```

이후 QA 앱을 실행한 상태에서 다음 명령의 QR을 엽니다.

```sh
pnpm --filter @expirymate/mobile dev:client:tunnel
```

`ios:dev`는 전용 생성기를 통해 `ExpiryMateQA` scheme과 `Debug-QA`/`Release-QA` 구성을
동기화한 뒤 Xcode의 `xcodebuild`로 `Debug-QA`를 빌드하고 `xcrun devicectl`로 실물 iPhone에 설치합니다.
현재 Expo CLI의 실물 기기 실행에서도 Simulator 설치를 검사하는 문제를 피하는 경로이며,
Simulator 앱이나 시뮬레이터 런타임을 요구하지 않습니다. USB 연결·기기 신뢰·Developer Mode와
QA bundle ID에 맞는 개발 서명은 필요합니다. 설치 후 터널은 별도 명령으로 실행합니다.
QA 빌드에는 앱 정본의 iOS 최소 버전을 모든 의존성 타깃에 전달하여 새 Xcode가 오래된 Pod의
최소 버전을 거부하는 문제를 피합니다. Pod 원본이나 출시용 빌드 설정은 바꾸지 않습니다.
기본 `ExpiryMate` scheme의 출시 식별자는 유지합니다.
`native:variants:sync`로 동일한 네이티브 설정만 다시 생성할 수도 있습니다.

빌드·서명·설치 없이 실물 기기 선택과 QA 설정만 확인하려면 `ios:dev --check`를 사용합니다.
여러 iPhone이 페어링되어 있으면 `ios:dev --device "기기 이름"` 또는 UDID로 하나를 지정합니다.
일반 `expo start --dev-client --tunnel`은 QA 선택을 보장하지 않으므로 위 전용 명령을 사용합니다.
App Store 앱에는 Metro 연결 기능이 없으며 QA 앱을 실제로 다시 설치해야 연결이 복구됩니다.

EAS의 `development`와 `development-device`도 QA scheme/식별자를 사용하고,
`preview`와 `production`은 기존 출시 식별자를 사용합니다. `APP_VARIANT`의 미등록 값과
QA 식별자에 production/preview 환경을 조합한 요청은 거부합니다.
Android 개발 프로필에도 같은 QA package ID가 적용됩니다.

새 QA bundle ID에 맞는 개발 서명이 필요합니다. 무료 Personal Team의 Apple 로그인·Push 제한은
기존과 동일합니다. 소셜 로그인은 개발 서버의 `OAUTH_APP_RETURN_URIS`에
`jango-crayonqa://oauth`를 명시적으로 허용해야 합니다. 출시 서버의 허용 목록을 완화하지 않습니다.
인증 메일 등 서버가 발행하는 링크도 해당 개발 환경의 앱 주소 설정을 확인합니다.
QA 앱 설치·실제 터널 연결·새 bundle ID의 외부 인증/알림 자격 증명은 설정 검사와 별도로 검증합니다.

2026-10-08 검증: 실제 Xcode QA workspace에서 `Debug-QA`, `DEBUG=1`, QA 이름·bundle ID·scheme을
확인했습니다. 출시 `Release` 설정의 기존 이름·bundle ID·scheme도 확인했습니다.
CocoaPods 생성 및 deployment 재현 검사, 분리·멱등성·OAuth 콜백 테스트, 문서·lint·typecheck와
전체 테스트를 통과했습니다.

같은 날 실물 경로 검증: Simulator 없이 `Debug-QA` 빌드·개발 서명·iPhone 설치를 완료했습니다.
실제 바이너리의 이름은 `장고 QA`, 식별자는 `com.expirymate.mobile.crayonqa`,
URL scheme은 `jango-crayonqa`와 QA bundle ID, 최소 iOS는 `16.4`입니다.
기기가 잠겨 있어 원격 실행은 거부됐으므로 잠금을 해제한 뒤 QA 앱을 열어야 합니다.
QR 연결과 출시 앱의 동시 설치 확인은 미검증입니다.
빌드와 전체 테스트 병행 시 기존 이미지 측정 2종이 시간 제한에 걸렸으며,
빌드 종료 후 같은 제한으로 모바일 전체 551개를 재실행해 모두 통과했습니다.
실물 설치 경로·실패 시 설치 차단 회귀 검사 5개도 포함합니다.

## 0. 개인 플러스 `1.4.1` 업데이트 빌드

2026-09-12 App Store Connect에서 확인한 현재 출시 버전은 `1.4.0`(45)입니다.
구독 가격 조회의 무한 대기·오류 안내를 수정한 다음 버전은 `1.4.1`입니다.
첫 자동 갱신 구독이므로 새 앱 버전, 구독 그룹, 월간·연간 상품을 같은 App Review
제출에 포함해야 합니다. 빌드 업로드와 App Review 제출은 별개 단계입니다.

- EAS production 빌드: `6c6de756-73a4-4507-b9d8-157b7a21d671`, `1.4.1`(46)
- EAS 빌드 및 App Store Connect 업로드 성공. 다운로드한 최종 앱의 `1.4.1`(46)과 수정 코드 포함 확인
- App Store Connect에서 `1.4.1` 버전에 빌드 `46` 연결 및 저장 완료
- 원격 buildNumber `45`를 확인한 뒤 production `autoIncrement`로 `46` 생성
- 문서 검사, 린트, 전체 타입 검사, 테스트 1,027개 통과
- 구독 가격 조회·재연결은 최대 15초로 제한하고, 상품 없음·부분 누락·오류에 재시도 제공
- 로컬 화면 캡처 비교는 Maestro 미설치로 미실행. TestFlight 화면·구매·복원 확인 필요
- 상품 상태 및 이후 심사 단계는 [`subscription-store-rollout.md`](./subscription-store-rollout.md) 참고

### 버전 기준

- `apps/mobile/app.json`의 `expo.version`: `1.4.1`
- 생성되는 iOS 프로젝트의 `CFBundleShortVersionString`: `1.4.1`
- 실제 번들 버전은 Info.plist의 `CFBundleShortVersionString`으로 검증합니다.
- `eas.json`은 `appVersionSource: "remote"`, production `autoIncrement: true`이므로
  iOS build number와 Android versionCode는 EAS의 현재 원격 값에서 증가시킵니다.
- 로컬 `buildNumber: "1"`, `versionCode: 1`은 원격 버전 정본이 아닙니다.

### Mac에서 순서대로

1. 저장소 pull 후:

```bash
cd apps/mobile
pnpm install
eas login
```

2. EAS **production** environment에 아래가 **비어 있지 않은지** 확인
   ([Expo dashboard](https://expo.dev) → Project → Environment variables).
   없으면 AdMob 콘솔 값으로 추가한 뒤 저장:

```text
EXPO_PUBLIC_ADMOB_IOS_APP_ID
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID
EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID
EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID
```

iOS 앱이 AdMob에서 아직 “미인증”이어도 **앱 ID·광고 단위 ID**는 발급되면 넣을 수
있습니다. 값이 없으면 production 빌드는 `app.config.js` →
`scripts/validate-public-env.cjs` 에서 바로 실패합니다.

기존 OAuth/API 값도 그대로인지 확인:

```text
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_API_BASE_URL
EXPO_PUBLIC_OAUTH_REDIRECT_URI
EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID
EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID
```

3. **버전 문자열과 원격 빌드 번호 확인** (Connect에는 **`1.4.1`** 사용):

```bash
# remote buildNumber만 확인 (다운그레이드 금지)
pnpm dlx eas-cli@21.2.0 build:version:get -p ios
```

필요할 때 `npx expo prebuild --platform ios --clean`으로 생성 결과를 검수:

- 생성된 `ios/ExpiryMate/Info.plist` → `CFBundleShortVersionString` = `1.4.1`
- native 프로젝트가 있는 경우에도 EAS build metadata와 최종 IPA 버전이 `1.4.1`인지 확인
- `app.json` → `"version": "1.4.1"` 유지
- `CFBundleVersion` / `CURRENT_PROJECT_VERSION` 은 production
  `autoIncrement` 가 remote에서 올리므로 로컬 `"1"`에 집착하지 않아도 됨

4. production 빌드:

```bash
pnpm eas:build:ios
# 또는
pnpm dlx eas-cli@21.2.0 build --platform ios --profile production
```

성공하면 Expo 빌드 페이지에서 IPA / buildNumber(예: 26+)를 확인합니다.

5. **App Store Connect (수동)**

- 기존 앱에 새 iOS 버전 **`1.4.1`** 생성
- 방금 빌드 연결
- **마케팅 URL:** `https://jango.devnamu.com`
- **지원 URL:** `https://jango.devnamu.com/privacy/choices`
- (권장) Privacy: `https://jango.devnamu.com/privacy`
- 제출 → 공개 App Store 페이지 하단에 **개발자 웹사이트**가 새 호스트인지 확인
- AdMob에서 **업데이트 확인** (최대 24시간)

6. 도메인 사전 확인 (빌드와 무관, AdMob용):

```text
https://jango.devnamu.com/app-ads.txt
```

한 줄이 보여야 합니다:

```text
google.com, pub-3601739589819576, DIRECT, f08c47fec0942fa0
```

Admin Railway에 `ADMOB_PUBLISHER_ID=pub-3601739589819576`, 커스텀 도메인
`jango.devnamu.com`(Cloudflare CNAME · **DNS only**)이 Active여야 합니다.

---

## 1. Apple Developer Console (수동)

Bundle ID: `com.expirymate.mobile`

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → App ID 선택/생성
2. Capabilities 활성화
   - **Sign in with Apple**
   - **Push Notifications**
3. (선택) App Store Connect에 앱 레코드 생성 — TestFlight/제출용
4. EAS가 쓸 Team이 **유료 Program team**인지 확인 (Personal Team이 아님)

로컬 Xcode의 `DEVELOPMENT_TEAM`은 예전 Personal Team ID일 수 있습니다.  
**EAS Build는 `eas credentials` / Apple 로그인으로 서명 자격 증명을 다시 맞춥니다.** 로컬 `expo run:ios --device`도 유료 팀으로 서명되도록 Xcode Signing을 한 번 확인하세요.

## 2. EAS 환경 변수 (production)

`apps/mobile/.env.production.example` 값을 EAS **production** environment / secrets에 넣습니다.

필수:

- `EXPO_PUBLIC_APP_ENV=production`
- `EXPO_PUBLIC_API_BASE_URL` (공개 HTTPS, 현재 Railway면 `https://api-production-1504.up.railway.app`)
- `EXPO_PUBLIC_OAUTH_REDIRECT_URI` (같은 origin + `/oauth/callback`)
- `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`
- `EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID`
- `EXPO_PUBLIC_ADMOB_IOS_APP_ID`
- `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`
- `EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID`
- `EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID`

선택:

- `EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID`
- `EXPO_PUBLIC_SENTRY_DSN` (없으면 Sentry 네이티브 플러그인 제외)

**금지:** production/preview에서 `EXPO_IOS_PERSONAL_TEAM=1`  
(`eas.json`은 이미 `0`으로 고정, `app.config.js`가 위반 시 빌드 실패)

production 빌드 시 `EAS_BUILD=true` 이면
`apps/mobile/scripts/validate-public-env.cjs` 가 위 필수 키를 검사합니다.
비어 있으면 **Read app config** 단계에서 실패합니다.

Sentry 소스맵·dSYM 업로드는 EAS production 환경의 `SENTRY_AUTH_TOKEN` secret을 사용합니다.
토큰이 없는 임시 빌드가 필요할 때만 `SENTRY_DISABLE_AUTO_UPLOAD=true`를 명시할 수 있지만,
그 경우 심볼 업로드가 생략되어 Sentry 스택 추적이 제한됩니다.

## 3. 프로파일 구분

| Profile | 용도 | Personal Team | Apple / Push |
|---------|------|---------------|--------------|
| `development` | 시뮬레이터 | `0` | 포함 |
| `development-device` | 무료 Personal Team 실기기 | `1` | **제외** |
| `preview` | 내부 배포 (유료 팀) | `0` | 포함 |
| `production` | App Store / TestFlight | `0` | 포함 |

```bash
cd apps/mobile
eas login
eas credentials   # iOS → production → Push key / distribution cert 확인
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

또는 monorepo 루트에서:

```bash
pnpm --filter @expirymate/mobile eas:build:ios
pnpm --filter @expirymate/mobile eas:submit:ios
```

## 4. 빌드 후 검증

1. Archive / IPA entitlements에 다음이 있는지 확인  
   - `com.apple.developer.applesignin` = `Default`  
   - `aps-environment` = `production` (스토어 서명 시; 개발 entitlements 파일 기본값은 `development`)
2. TestFlight에서 **Apple 로그인** 신규·재로그인
3. 설정 → 알림 허용 후 **푸시 토큰 등록** (API `push-tokens`)
4. 바코드 스캔으로 상품 등록 후 OCR 영수증/라벨 인식까지 실제 기기에서 확인
5. 구독 상품 조회·구매·복원과 추천 크레딧 구매 완료 후 권한 반영 확인
6. (선택) Railway `PUSH_REMINDER_SCHEDULER_ENABLED=true` 후 만료 알림 수신

## 5. 관련 파일

- `apps/mobile/app.json` — `usesAppleSignIn`, entitlements, `expo-apple-authentication` plugin
- `apps/mobile/app.config.js` — Personal Team 시 plugin/entitlement 제거 + production 가드
- `apps/mobile/eas.json` — profile별 `EXPO_IOS_PERSONAL_TEAM`
- `apps/mobile/scripts/eas-sync-native-config.cjs` — EAS iOS 패키지 설치 직후, CocoaPods 설치 전에 entitlement·privacy manifest·config plugin 동기화
- `apps/mobile/scripts/validate-public-env.cjs` — production EAS 공개 env 검사
- `docs/store-privacy-declarations.md` — 스토어 Privacy 선언 (다음 단계)
- `docs/monetization.md` — 현재 AdMob·쿠팡 파트너스 운영 기준
