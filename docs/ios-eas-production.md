# iOS · EAS production (P0-06)

Apple Developer Program 가입 이후 **Sign in with Apple · Push · TestFlight/App Store** 를 켜기 위한 체크리스트입니다.  
코드 쪽 설정은 `apps/mobile/app.json`, `app.config.js`, `eas.json`, `ios/ExpiryMate/ExpiryMate.entitlements`에 반영되어 있습니다.

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
- `EXPO_PUBLIC_IAP_PRODUCT_IDS`

선택:

- `EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID`
- `EXPO_PUBLIC_SENTRY_DSN` (없으면 Sentry 네이티브 플러그인 제외)

**금지:** production/preview에서 `EXPO_IOS_PERSONAL_TEAM=1`  
(`eas.json`은 이미 `0`으로 고정, `app.config.js`가 위반 시 빌드 실패)

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
- `docs/store-privacy-declarations.md` — 스토어 Privacy 선언 (다음 단계)
