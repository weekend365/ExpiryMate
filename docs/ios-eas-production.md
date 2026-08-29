---
status: active
owner: mobile-release
last_reviewed: 2026-08-29
source_of_truth: true
---

# iOS · EAS production (P0-06)

Apple Developer Program 가입 이후 **Sign in with Apple · Push · TestFlight/App Store** 를 켜기 위한 체크리스트입니다.  
코드 쪽 설정은 `apps/mobile/app.json`, `app.config.js`, `eas.json`, `ios/ExpiryMate/ExpiryMate.entitlements`에 반영되어 있습니다.

## 0. 개인 플러스 `1.4.0` 업데이트 빌드

장고야 부탁해는 App Store에 `1.3.0`까지 공개되어 있습니다. 개인 플러스와 인사이트를
추가하는 다음 업데이트는 `1.4.0`으로 제출합니다. 첫 자동 갱신 구독이므로 새 앱 버전,
구독 그룹, 월간·연간 상품을 같은 App Review 제출에 포함합니다.

> **일정:** production EAS 빌드는 2026-09-01에 생성합니다. 2026-08-29에는 버전·Pods·
> 타입 검사·모바일 테스트까지만 완료했으며 App Store Connect의 빌드 연결과 구독 심사
> 추가는 의도적으로 대기 중입니다. 최신 준비 상태는
> [`subscription-store-rollout.md`](./subscription-store-rollout.md)의 진행 스냅샷을 따릅니다.
> 2026-08-29에 확인한 EAS remote iOS buildNumber는 `35`입니다. 9월 1일 빌드 직전에
> 다시 조회하고, 값이 그대로라면 production `autoIncrement` 결과는 `36`이어야 합니다.

### 버전 기준

- `apps/mobile/app.json`의 `expo.version`: `1.4.0`
- `ios/ExpiryMate/Info.plist`의 `CFBundleShortVersionString`: `1.4.0`
- Xcode Debug/Release `MARKETING_VERSION`: `1.4.0`
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

3. **버전 문자열과 원격 빌드 번호 확인** (Connect에는 **`1.4.0`** 사용):

```bash
# remote buildNumber만 확인 (다운그레이드 금지)
pnpm dlx eas-cli@21.2.0 build:version:get -p ios
```

native 수정 (또는 `npx expo prebuild`로 동기화한 뒤 검수):

- `ios/ExpiryMate/Info.plist` → `CFBundleShortVersionString` = `1.4.0`
- `ios/ExpiryMate.xcodeproj/project.pbxproj` → `MARKETING_VERSION = 1.4.0`
- `app.json` → `"version": "1.4.0"` 유지
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

- 기존 앱에 새 iOS 버전 **`1.4.0`** 생성
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
4. (선택) Railway `PUSH_REMINDER_SCHEDULER_ENABLED=true` 후 만료 알림 수신

## 5. 관련 파일

- `apps/mobile/app.json` — `usesAppleSignIn`, entitlements, `expo-apple-authentication` plugin
- `apps/mobile/app.config.js` — Personal Team 시 plugin/entitlement 제거 + production 가드
- `apps/mobile/eas.json` — profile별 `EXPO_IOS_PERSONAL_TEAM`
- `apps/mobile/ios/ExpiryMate/ExpiryMate.entitlements` — 커밋된 native 프로젝트 동기화
- `apps/mobile/scripts/validate-public-env.cjs` — production EAS 공개 env 검사
- `docs/store-privacy-declarations.md` — 스토어 Privacy 선언 (다음 단계)
- `docs/monetization.md` — 현재 AdMob·쿠팡 파트너스 운영 기준
