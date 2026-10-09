# 장고 크레파스 후속 적용 · 첫 등록과 저장 완료

2026-10-09 사용자가 기존 결과를 채택하고 커밋·우선순위에 따른 후속 작업을 요청했다.
기준은 홈 카드 적용 커밋 `c057084`이며 구현·검증 상태와 해시는 [manifest.json](./manifest.json)에 기록한다.

## 범위와 보존

- 기존 제목 강조 막대를 조사했다. `SectionHeader`에는 선택적인 막대 코드가 있지만 실제 호출부는
  `surface`·`accentColor`를 켜지 않는다. 홈 제목도 별도 `HomeSectionHeader`를 사용하며 막대가 없다.
  현재 구도에 새 막대나 구분선을 추가하지 않고 이 후보는 사용처 지정 전까지 보류한다.
- 빈 보관함의 첫 재료 안내에 `welcome`을 명시적으로 켠다. 화면의 성공적인 빈 데이터 판정과
  기존 `add_ingredient` 안내가 함께 충족되어야 한다. 검색·필터 결과 없음, 최초 로딩·오류,
  새로고침 오류, 선택 모드, 재료가 있는 상태에는 켜지 않는다.
- 등록 완료 캐러셀의 `put-away` 안내에만 `celebrate`를 켠다. 기존 저장 mutation의 성공을 기다린
  뒤 `done`에 진입하는 순서는 유지한다. 실제 저장된 재료가 없는 대체 안내와 추천·보상 안내에는
  켜지 않는다. 재시도·취소·복귀·재료 수정·이어서 등록의 동작은 변경하지 않는다.
- [Mascot](../../../apps/mobile/src/components/Mascot.tsx)의 옵션은 기본 꺼짐이다. mood는 자동으로
  장식을 켜지 않는다. [장식 레이어](../../../apps/mobile/src/components/CrayonMascotDecoration.tsx)는
  이미지 프레임의 투명한 오른쪽 위·아래 모서리에 정적 SVG만 추가한다. 기존 이미지·프레임 크기,
  말풍선의 흰 면·얇은 선·꼬리, 카드·문구·버튼·탭·배경·접근성 이름을 유지한다.
- 공유 장식 토큰의 민트 전경을 현재 두 안내의 밝은 면 위에서 사용한다. 다른 상태의 기능색을
  바꾸지 않는다. SVG 질감은 기존 카드의 고정 grain을 재사용하고 레이어마다 고유 ID를 사용한다.
  터치와 화면 읽기에서 제외하며 `fontScale >= 1.3`에서는 기호를 생략한다. 모션을 추가하지 않는다.
- 새 래스터·캐릭터 파생·MASTER 수정·이미지 동기화는 없다. 작은 v18 `empty`·`happy`의 64점
  contain 좌표에서 기호가 차지하는 두 모서리 영역의 alpha가 0인 것을 확인했다.

## 검수 자료와 한계

검토 화면은 제품 route가 아닌 [예시 컴포넌트 fixture](../../../apps/mobile/e2e/fixtures/crayon-review-scenes.tsx)다.
실제 `HomeHero`·`JangoHeroNoticeCarousel`·말풍선·등록 완료 행동·보관함/등록 카드 스타일과
제품의 안내 선택 함수를 사용한다. 저장 중·실패 예시는 상태 제외를 확인하기 위한 fixture이며
실제 등록 화면 캡처가 아니다. API·계정·구매·영속 store를 번들에 넣지 않는 guard를 둔다.
브라우저 글자 배율과 정지 모션은 기존 리뷰 adapter를 재사용하며 네이티브 결과로 간주하지 않는다.

자동 승인 검토의 시간 초과 후 사용자가 로컬 페이지 검수를 승인했고, 도구가 복구되어
Chrome에서 전후 비교를 수행했다. 글꼴·이미지 로딩 완료 후 13개 상태와 폭 320/360/768,
글자 1/1.3/2의 대표 조합 **22개**를 측정했다. 장식을 제외한 콘텐츠 크기·텍스트·이미지·
기존 접근성 이름·버튼 영역·스크롤 길이가 전후 동일했다. 첫 등록·저장된 재료의 완료 안내에서만
기호가 있고, 큰 글자에서는 생략된다. 기호는 캐릭터·말풍선을 덮지 않으며 브라우저 DOM에서
장식 하위 트리의 `aria-hidden=true`·`pointer-events=none`을 확인했다.

- [첫 등록 · 폭 360](./screens/inventory-empty-360.jpg)
- [저장 완료 · 폭 360](./screens/registration-done-360.jpg)
- [큰 글자 · 폭 320·배율 2](./screens/inventory-empty-320-font-2.jpg)

첫 등록, 큰 글자의 추가 완료, 추천 안내를 각각 눌렀을 때 검토용 callback은 한 번씩 실행됐다.
캐러셀은 양쪽 모두 가로 스크롤 위치 0→246으로 두 번째 안내에 도달했고 다시 첫 안내로
돌아가 추천을 눌렀다. Web adapter에서는 `onMomentumScrollEnd`로 바뀌는 점·접근성 순번이
갱신되지 않아 네이티브 캐러셀 검증으로 간주하지 않는다. 폭 320·배율 2에서는 기존 말풍선이
짧게 줄바꿈되며 이 현상도 전후 동일하다. 이번 표현 변경은 이 배치를 수정하지 않는다.

문서 검사·lint·typecheck·공유 장식 계약·관련 14개 테스트와 Android/iOS 앱 번들이 통과했다.
기본 병렬 전체 실행은 변경하지 않은 API와 캐릭터 검수 테스트에서 각각 5000ms 시간 초과가
있었다. API 파일 단독 19개가 통과했고, 테스트·제한값을 변경하지 않고 다음 전체 범위를
차례로 실행해 **1,287개 통과·기존 API 6개 skip**을 확인했다.

```sh
pnpm jango:test
pnpm -r --workspace-concurrency=1 --if-present run test --maxWorkers=2
```

Android 네이티브 fixture 번들도 컴파일했고 API·Query 영속화·등록 store가 포함되지 않는 것을
source map으로 확인했다. 개발 서버 8096과 manifest adapter 8097을 시작해 manifest 응답과
fixture 진입 URL을 확인했다. 사용자는 Android 검수 기기를 준비 중이며 네이티브 캡처,
VoiceOver/TalkBack·터치·캐러셀·실제 화면의 전체 반응형 검증은 대기 중이다.

## 로컬 재현

```sh
node design/reviews/jango-crayon-followup-v1/preview.mjs
```

[브라우저 전후 비교](http://127.0.0.1:4181/)는 외부 Web 의존성 설치가 필요하다.
설치 조건은 [첫 시안의 재현 안내](../home-card-crayon-point-v1/README.md)를 따른다.

기기에서 예시 컴포넌트를 확인하려면 다음 개발 서버와 manifest adapter를 각각 실행한다.
실제 API를 쓰지 않고 환경 파일을 로드하지 않는다.

```sh
cd apps/mobile
EXPO_NO_DOTENV=1 APP_VARIANT=development EXPO_PUBLIC_APP_ENV=development SENTRY_DISABLE_AUTO_UPLOAD=true pnpm exec expo start --dev-client --localhost --port 8096 --scheme jango-crayonqa --max-workers 2
node e2e/serve-crayon-fixture.cjs
```

USB로 연결한 전용 Android 검수 기기에 `adb reverse tcp:8096 tcp:8096`와
`adb reverse tcp:8097 tcp:8097`을 설정하고, **장고 QA** 개발 앱의 URL 입력에서
`http://127.0.0.1:8097`을 연다. 새 manifest를 쓰므로 기존 8081 개발 서버나 실제 앱 route를
바꾸지 않는다. iOS adapter는 `JANGO_QA_PLATFORM=ios`를 지정한다. 기기에서 상태·전후를
바꿔 크기·화면 읽기·버튼·캐러셀·동작 줄이기를 확인한다. 로컬 예시 검수와 실제 화면 검수는
별도로 기록한다.

장고 QA APK는 [EAS development profile](../../../apps/mobile/eas.json)로 만든다.
`pnpm dlx eas-cli@21.2.0 build --platform android --profile development`의 결과 링크를 폰에서
열어 설치한다. 개발 앱 ID는 `com.expirymate.mobile.crayonqa`다. 기존 로컬 debug APK는
`com.expirymate.mobile`이므로 일반 앱과 충돌할 수 있어 이 안내에서 배포하지 않는다.
APK 빌드·배포 및 기기 설치는 이 후속 작업에서 실행하지 않았다.
APK 다운로드·설치 절차는 [Expo 공식 안내](https://docs.expo.dev/build-reference/apk/)를 따른다.
