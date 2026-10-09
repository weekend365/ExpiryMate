---
status: active
owner: mobile-design
last_reviewed: 2026-10-09
source_of_truth: true
---

# Mobile responsive QA matrix (Android font / display size)

Use an Android emulator or device. Settings path: **설정 → 디스플레이 → 글자 크기 / 표시 크기** (wording varies by OEM).

## Scale presets

| Preset | How to set |
| --- | --- |
| Default | Font size default, display size default |
| Font 1.3 | Font size one step above default (≈ `fontScale` 1.3) |
| Font max | Largest system font (expect capped at body / heading 2×, chrome 1.3×) |
| Display large | Display size enlarged (effective width shrinks; stacking should kick in ≤ 400pt) |

Automated Android profiles pair these presets as follows:

| Profile | Window / density | Font scale | Navigation |
| --- | --- | --- | --- |
| `small-three-button` | 720×1280 / 320 dpi | 1.0 | Three button |
| `modern-gesture` | 824×1830 / 320 dpi | 1.0 | Gesture |
| `small-large-text` | 720×1280 / 320 dpi | 2.0 | Three button |
| `large-display-large-text` | 824×1830 / 420 dpi | 2.0 | Gesture |
| `tablet-landscape` | 1600×1200 / 240 dpi | 1.0 | Gesture, sw600dp landscape |
| `foldable-portrait` | 1600×2560 / 240 dpi | 1.0 | Gesture, unfolded sw600dp portrait |

## Checklist

Mark each cell pass/fail after a visual pass (no clip, no overlap, primary CTA reachable, keyboard does not cover sticky footer).

| Screen / surface | Default | Font 1.3 | Font max | Display large |
| --- | --- | --- | --- | --- |
| Tab bar (labels remain visible; `minHeight` expands) | | | | |
| Home traffic lamps (`StatCard` traffic) | | | | |
| Inventory filters / search / swipe delete | | | | |
| Register StepFlow + summary rows | | | | |
| Scanner overlays + date / name fields | | | | |
| Login `EmailDomainInput` + password | | | | |
| BottomSheet + keyboard (date picker, space switcher) | | | | |
| Shopping list / completed items / add form / related product tab | | | | |
| Notification permission state / grouped delivery / time inputs | | | | |
| Opened date / check date / clear actions in expiry step | | | | |
| Space and item activity history / pagination | | | | |

## Expected policy

- Body / inputs scale up to **2×**
- Headings scale up to **2×** and downshift one type-ramp step at large text
- Chrome (tabs, badges, stepper ±, D-day) up to **1.3×**
- `fontScale ≥ 1.15` stacks dense toolbars/summary rows (`shouldStackDense`)
- `fontScale ≥ 1.3` or width `< 400` stacks general rows (`shouldStack`) and downshifts title variants

## Design token policy

- Product colors use semantic `colors` tokens; provider branding uses `oauthBrand` tokens.
- Text hierarchy uses `AppText` `variant` / `tone` instead of local numeric metrics or weights.
- Layout spacing and corner radii use `spacing` / `radius` tokens.

## Automated coverage

```bash
pnpm --filter @expirymate/mobile exec vitest run \
  src/shared/responsive-layout.test.ts \
  src/shared/font-scale.test.ts \
  src/shared/dynamic-type-contract.test.ts \
  src/shared/design-token-contract.test.ts
```

The `mobile-layout` CI matrix captures one canonical state for every user-facing
route plus the additional flow states declared in
`apps/mobile/scripts/layout-screenshot-manifest.mjs`. Pull requests compare them
with the latest successful `main` artifacts and upload current, baseline, diff,
JUnit, and JSON comparison evidence.

## Android live font-scale native validation

Cold launch and live changes are separate checks. Keep the activity and React
tree running while changing font scale **1.0 → 1.3 → 2.0 → 1.0**. Verify that
unchanged text is remeasured, the full message remains readable by scrolling,
and input values, focus/selection where supported, and operation state survive.
Do not lower the shared scaling caps or remount forms to hide stale bounds.

The pinned React Native 0.81.5 patch in `patches/react-native@0.81.5.patch`
adds Fabric root layout invalidation, enables that path for Android's stable
Fabric/bridgeless host, and requests surface measurement after display metrics
refresh. The candidate also invalidates a paragraph clone when its state's font
multiplier differs from previously measured content, and synchronizes display
metrics before surface measurement. The clone measurement callback receives the
original node so it can compare prior content against the new state. These are
validation candidates: an earlier
root/host-only build enlarged glyphs inside stale text bounds and failed the
live-change check. The final candidate passed the live/cold comparison on an
API 33 ARM64 emulator at 360×640dp: measured text heights were
72 → 94.5 → 240 → 72dp at 1.0 → 1.3 → 2.0 → 1.0. The React instance,
counter, input, focus and selection stayed the same. Actual inventory search
also retained its query and focus through the cycle. These are focused
emulator results, not OEM, iOS, release or screen-reader approval.
Expo SDK 54 and package versions are unchanged. The
published ReactAndroid AAR does not contain the C++ change; verification builds
must compile the installed patched source explicitly:

```bash
cd apps/mobile
pnpm exec expo prebuild --platform android --no-install
pnpm branding:sync
cd android
./gradlew :app:assembleDebug -PjangoFontScaleNativePatch=true \
  -PreactNativeArchitectures=arm64-v8a --max-workers=2
```

`ANDROID_HOME` must point to the local SDK. This validation option is **off by
default**; it does not silently change normal or release builds. The Expo plugin
preserves autolinking and performs dependency substitution only when enabled.
The same flag adds `fontScale` to the activity's existing `configChanges` so
React receives the change without recreating the form. Without the flag, the
merged manifest retains the SDK template's exact configuration handling.
Source builds require the RN template's NDK/CMake and SDK command-line tools.
Run branding sync after Prebuild to restore the existing native splash sizing;
its Python generator requires Pillow. Do not hand-edit the generated images.
`prepare-android-font-scale-source.cjs` copies installed source to an ignored,
content-hashed cache because Prefab rejects `=` in pnpm patch store paths even
through canonicalized symlinks. Generated files are excluded; codegen is linked
from the installed dependency. No generated native file is edited manually.
Patched pnpm peer paths also affect normal Prefab builds. Their generated output
directories are relocated in both modes; native inputs and source substitution
remain controlled by the verification flag. Reanimated's Worklets reference
follows the relocated output.

The five libraries that use generated JNI (AsyncStorage, DateTimePicker,
Sentry, Gesture Handler and Worklets) also need autolinking to reference those
relocated outputs. `apps/mobile/react-native.config.js` supplies their supported
`platforms.android.cmakeListsPath` overrides, relative to each Android source
directory, only when its canonical path contains `=`. Libraries with source
CMake files (Safe Area, Screens and SVG) use content-hashed, byte-identical source
copies; their relative `android/build` symlink points to the relocated output.
The source directories themselves are real copies so CMake's `../../../build`
does not resolve back through a directory symlink to the installed package.
Their installed CMake and C++ files are not rewritten. The source build
flag remains off by default. See the
[React Native CLI dependency configuration](https://github.com/react-native-community/cli/blob/main/docs/dependencies.md).

Switching between source and published-AAR builds can leave Expo's incremental
Kotlin outputs inconsistent. In this validation, the first normal build failed;
`./gradlew :expo-modules-core:clean` followed by the normal build succeeded.
Both libraries in that normal debug APK matched the published RN/Hermes AARs
byte for byte. Do not enable the source flag to work around a normal build failure.

The regression fixture uses the real `AppText`, `AppTextInput`, `Button` and
`MascotSpeechBubble` with example text and no application API calls. It is not
a runtime route. After installing the opt-in APK, run Metro and the local
manifest adapter in separate terminals:

```bash
cd apps/mobile
EXPO_NO_DOTENV=1 EXPO_PUBLIC_APP_ENV=development pnpm exec expo start \
  --dev-client --localhost --clear --port 8093
# In another terminal, from apps/mobile:
node e2e/serve-font-scale-fixture.cjs
adb reverse tcp:8093 tcp:8093
adb reverse tcp:8095 tcp:8095
adb shell am start -a android.intent.action.VIEW \
  -d 'exp+expirymate://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8095' \
  com.expirymate.mobile
```

Use the dedicated QA device's serial with `adb -s` if multiple devices are
connected. Set an input and increment the counter before changing scale.
The `qa-diagnostics` accessibility label records the instance, measured height,
line metrics, input and selection. Change the QA device's `font_scale` in the
cycle above without restarting the app, then compare with cold launches at
1.3 and 2.0. Preserve the full text and restore the original scale after testing.
Dismissed or transient system overlays are not accepted as app captures.
Actual-app QA must additionally verify the API address used by Expo's virtual
environment module; a shell environment value alone is insufficient evidence.

Native results and unresolved environments are recorded in
[`verification.json`](../design/reviews/crayon-expression-rollout-v1/verification.json).
Build success alone is not live layout, accessibility, or release verification.
The source build must be validated before considering adoption in normal builds.

References: [open root-invalidation proposal](https://github.com/react/react-native/pull/57124),
[upstream surface-layout change](https://github.com/react/react-native/commit/417e0682203d70bd5ca510f7999a7f6c6990566f),
[original font-change implementation](https://github.com/react/react-native/commit/c008604e0a05460b440fcfaded70498594465916),
[official source-build workflow](https://reactnative.dev/contributing/how-to-build-from-source).

## iOS native generation after the pnpm patch

The pnpm patch changes native dependency paths even though package versions stay
the same. Regenerate CocoaPods linkage rather than retaining old store paths.
`expo-build-properties` in `apps/mobile/app.json` pins the existing
GoogleDataTransport 10.1.0 and four GoogleUtilities 8.1.2 subspecs through
`ios.extraPods`; ordinary regeneration must not silently update those versions.
The generated native lock now matches the already installed Expo 54.0.37 and
RN 0.81.5 packages. The configured app minimum remains iOS 16.4.

```bash
cd apps/mobile/ios
pod install --no-repo-update
pod install --deployment --no-repo-update
```

The second command verifies the resulting lock without changing it. Generate
native properties from Expo configuration when that configuration changes; do
not edit `Pods/Manifest.lock` or native store paths by hand. Current iOS QA uses
the official prebuilt React, ReactNativeDependencies and Hermes device slices,
whose bytes were verified against the installed Pods. The separate unsigned QA
build used a CLI-only 15.1 target to diagnose the current Xcode toolchain; this
does not change the app's configured 16.4 minimum. Successful compilation is
separate from signing, installation, actual screenshots and VoiceOver checks.

## Google Scanner manifest note

`expo-camera` currently packages Google Code Scanner's delegate activity. The
delegate's portrait declaration is vendor-owned, so this project intentionally
does not override it with a manifest merge rule. Revisit it after an upstream
`expo-camera` or Google Code Scanner update, while keeping the large-screen
profiles above as the compatibility check.

## Google Play release quality checks

- Android release builds currently disable R8 minification and resource shrinking
  through `expo-build-properties` in `apps/mobile/app.json` after the 1.4.1
  SecureStore login failure described below. The
  `with-android-release-optimization` config plugin selects
  `proguard-android-optimize.txt` during Prebuild; the SDK 54 template's legacy
  default disables code optimization. Do not edit generated Android files.
- Before re-enabling R8, retain `app/build/outputs/mapping/release/mapping.txt`
  for crash deobfuscation and inspect `configuration.txt` for global
  `-dontoptimize`, `-dontshrink`, or `-dontobfuscate` rules. Exercise login,
  camera/OCR, notifications, ads, purchase and restore on the optimized build.
- Play Console's affected bundle details remain the acceptance check for DEX
  optimization, shrinking and obfuscation percentages. Enabling R8 alone does
  not prove that all three reach the 25% threshold.
- SDK 54 already enables edge-to-edge. The app does not request a navigation bar
  background color; test both gesture and three-button navigation with safe
  areas and keyboard visible. Deprecated calls can still exist in native
  dependencies (including `react-native-screens`); match the exact classes in
  Play Console to the dependency before choosing an upgrade.
- The main activity uses unrestricted orientation. Recheck the final merged
  manifest for library activities as well as the tablet/foldable profiles above.
  Do not force a vendor scanner activity into an unsupported orientation.

References: [Expo SDK 54 build properties](https://docs.expo.dev/versions/v54.0.0/sdk/build-properties/),
[Android R8 setup](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization),
[Google Play technical quality requirements](https://support.google.com/googleplay/android-developer/answer/17492799).

### 2026-10-08 Android 로그인 저장 오류 대응

- 1.4.1 실기기 사진의 오류는 `ExpoSecureStore.setValueWithKeyAsync`의 세 번째 인자인
  `SecureStoreOptions` 변환 중 발생한 `NullPointerException`이다. 현재 이메일·소셜 로그인,
  이메일 인증과 토큰 갱신도 같은 저장 경로를 사용한다. 옵션 생략은 Expo의 정상 API 사용법이며
  로그인 API 거부나 잘못된 비밀번호를 나타내는 오류가 아니다.
- SDK 54의 옵션 변환은 Kotlin 리플렉션을 사용한다. 1.4.1에서 활성화한 R8 설정이 현재
  코드에도 남아 있고 [Expo 저장소의 같은 유형 보고](https://github.com/expo/expo/discussions/43567)와
  일치해 릴리스 최적화 영향을 우선 의심한다. 사진만으로 정확한 네이티브 실패 지점이나 R8의
  인과관계가 확정된 것은 아니다. 검증되지 않은 keep 규칙 대신 코드·리소스 축소를 함께
  비활성화하는 보수적인 완화책을 적용한다. 앱 크기 증가와 Play 최적화 지표 하락이 가능하다.
- 저장 실패는 기존 진단 경로에 원인을 남기고 사용자에게 한국어 재시도 안내를 반환한다.
  저장 실패 후 메모리 세션과 부분 저장을 정리하는 동작, SecureStore 암호화 저장,
  저장 키·인증 정책, 기존 로그인 화면·조작·입력 단계·접근성 설정은 보존한다.
- 자동 회귀 검증은 정상 로그인, 사진과 같은 옵션 변환 거부·재시도, 부분 저장 실패,
  잘못된 비밀번호 거부, 저장 시간 초과와 빌드 축소 설정을 다룬다. 화면 구조·스타일은
  변경하지 않았으며 새 한국어 안내의 실기기 큰 글자·스크린리더 확인은 별도 QA다.
- `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`가 통과했다. 전체 테스트는
  1,257개 통과, 기존 opt-in DB 통합 테스트 4개 생략이다. Expo Android Prebuild로 생성된
  Gradle 설정에서도 코드·리소스 축소의 `false` 반영을 확인했다.
- 로컬 `:app:assembleRelease`는 SDK 경로 지정과 누락 의존성 확보 후에도
  `:app:configureCMakeRelWithDebInfo[arm64-v8a]`에서 실패했다. 생성된 autolinking CMake가
  AsyncStorage·Sentry·Gesture Handler·Worklets의 존재하지 않는 codegen JNI 경로를
  참조했다. 새 릴리스 APK 생성과 실기기 로그인 재검증은 미완료이며, 네이티브 생성 경로를
  정리한 환경에서 다시 확인해야 한다. 자동 테스트 통과를 실기기 오류 해소로 간주하지 않는다.
- 이 대응은 네이티브 빌드 설정 변경이므로 Android 앱을 다시 빌드해야 한다. 출시 전 릴리스
  APK/AAB에서 이메일·소셜 로그인 → 앱 재실행·세션 복원 → 토큰 갱신 → 로그아웃과
  초대 링크 로그인 복귀를 실기기로 확인한다. R8 재활성화는 같은 흐름의 최적화 빌드 검증과
  네이티브 실패 지점 확인 후 별도 변경으로 진행한다.

### 2026-10-09 Android 개발 빌드 codegen 경로 수정

- Android EAS `development` 빌드 두 건이 Gradle 단계에서 실패했다. 최신 빌드
  `b4cc2053-11b9-4c05-a0d3-60b92d8c26f7`의 `configureCMakeDebug[arm64-v8a]` 로그에서
  AsyncStorage·DateTimePicker·Sentry·Gesture Handler·Worklets의 JNI 경로 누락을 확인했다.
  기존 플러그인이 pnpm `=` 경로를 피하려고 생성물을 Android 루트 build 아래로 옮겼지만,
  autolinking은 의존성 내부의 기본 `android/build` 경로를 계속 참조한 것이 원인이다.
- 생성된 Gradle·CMake 파일을 직접 수정하지 않고 React Native의 프로젝트 설정에서
  해당 5개 참조를 실제 출력 경로에 연결한다. 깨끗한 Android Prebuild 후 누락됐던 5개
  CMake 파일의 실제 생성과 앱 CMake 설정 단계 통과를 확인했다. 후속 C++ 컴파일에서
  Safe Area의 생성 헤더 누락이 드러났고, 자체 CMake를 쓰는 Safe Area·Screens·SVG의 내부
  상대 경로도 같은 출력 이동을 따라야 함을 확인했다. 원본 native 파일의 content-hashed
  복사본과 relocated build symlink를 함께 제공해 원본 CMake·C++ 바이트를 보존한다.
  소스 디렉터리를 symlink로 연결하면 `..`가 원본 패키지로 되돌아가므로 실제 복사본을 사용한다.
  cache 바이트가 달라지면 빌드를 중단하며 설치된 의존성의 소스·기존 build 경로는 수정하지 않는다.
- 설치된 Expo autolinker의 의존성 JSON 비교에서 이 8개 CMake 참조만 달라졌고 의존성
  목록·소스 경로·패키지 등록 정보는 같았다. QA Prebuild가 선택한 별도 앱 식별자는 예상한
  변경이다. 생성 경로·symlink·원본 보존과 실제 autolinker 통합을 다루는 관련 테스트는
  9개 통과했다.
- `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`가 통과했다. 기존 동시 실행의 자원 경합을
  피하고 같은 전체 테스트를 workspace 순차 실행·worker 2개로 확인했다. 장고 21개,
  shared 163개, API 541개가 통과했고, 후속 헤더 경로 회귀 테스트를 포함한 mobile 전체
  565개도 통과해 총 1,290개 통과, 기존 API opt-in 6개 생략이다. 기존 테스트의 내용·제한
  시간·통과 기준은 바꾸지 않았으며 추가 수정 뒤 관련 native 설정 테스트 9개를 재검증했다.
- 로컬 QA `assembleDebug`가 성공했다. APK는 Android 7 이상 ARM64용 약 101MiB이며,
  `aapt`로 앱 이름 **장고 QA**, 패키지 `com.expirymate.mobile.crayonqa`, 버전 `1.4.2`를
  확인했다. `apksigner`의 v2 서명 검증도 통과했다. APK의 React Native·Hermes 라이브러리가
  published 0.81.5 debug AAR과 바이트 단위로 같아 source opt-in을 우회 활성화하지 않았음을
  확인했다. APK SHA-256은
  `364d82d5b3a3b5f87a58c7c7d0a38a460c1ea365f839c8689f5a6c980c360f58`이다.
  USB 실기기 설치·큰 글자·TalkBack·캐러셀 검수는 별도 진행한다.
- 검증용 앱은 `APP_VARIANT=development`의 **장고 QA**
  (`com.expirymate.mobile.crayonqa`)다. 기존 앱과 별도 설치되며 버전·SDK·RN source opt-in,
  인증·알림·광고·구독 정책과 화면 구성을 바꾸지 않는다. APK 빌드와 실기기 화면·TalkBack
  검수 결과는 구분한다. 이 변경으로 production 릴리스 검수를 통과한 것으로 처리하지 않는다.

```bash
cd apps/mobile
APP_VARIANT=development EXPO_PUBLIC_APP_ENV=development \
  pnpm exec expo prebuild --clean --platform android --no-install
pnpm branding:sync
cd android
ANDROID_HOME=/path/to/android-sdk ./gradlew :app:assembleDebug \
  -PreactNativeArchitectures=arm64-v8a --max-workers=2
```

EAS로 설치 링크를 만들 때는 저장소에 수정 내용을 포함한 뒤 `apps/mobile`에서
`pnpm dlx eas-cli@21.2.0 build --platform android --profile development`를 실행한다.
폰에 APK 설치 후 같은 디렉터리에서 `pnpm dev:client:tunnel`을 실행하고 개발 서버에 연결한다.

## 2026-09-29 feature verification

The shopping tab now starts on the persisted list; the smoke flow explicitly
opens the related products tab before searching. The manifest also includes
`inventory-activity.png` and `inventory-opened.png`. The seed supplies an opened
milk item with a stable ID and sample activity records.

Android native verification passed on an API 33 ARM64 debug emulator with
Maestro 2.10.0 for `small-three-button`, `small-large-text` (font scale 2.0), and
`tablet-landscape`. The feature pass covered the shopping list, add form and
keyboard, notification permission state and delivery-time field, expiry/opened
fields and clear actions, activity history, and the inventory history entry.
This is a focused feature pass, not a completed full-route matrix above.

The pass found and fixed two layout issues: modal sheets now shrink within the
keyboard's available height and respect the top safe area; stacked step headers
stretch their guide card so its copy remains visible on compact screens.
The login smoke flow now expands the email section and uses the current single
email field. Activity captures wait for the initial data load.

There are 27 current feature captures and 12 before/after comparison pairs
against `b730753`. Local artifacts are under
`apps/mobile/e2e/screenshots/{current,baseline,diff}/feature-update/`; flow logs,
capture flows, and `comparison.json` are under
`apps/mobile/e2e/results/feature-update/`. Differences for the new default list,
notification controls, activity entry, and corrected guide width were reviewed
as intentional. Raw pixel differences also include system chrome, image loading,
and refresh indicators; they are evidence, not a zero-diff CI pass. No canonical
baseline or visual-approval bypass was used. Preserve the intentional layout
change review requirement when preparing a PR.

The debug APK built with installed NDK 28.2 through a temporary local Gradle
override; repository native configuration was not changed. Current and baseline
JavaScript ran from separate temporary source copies without environment files,
against an isolated local API and PostgreSQL database. The emulator has no Play
Store billing connection; only the known Expo-IAP development overlay was hidden
in the temporary entry point. This pass does not verify purchases, actual push
delivery, or the optimized release build. At that verification date the local
Xcode license was not accepted. The user has since accepted it. Current iOS
execution limits are recorded in the linked rollout verification report;
the historical license block is resolved.

Validation also passed: 1,170 general tests, four opt-in PostgreSQL integration
tests, authenticated HTTP workflow checks, and 50 related tests after the layout
fixes. Lint/design-token checks and type checking passed after the final UI changes.
