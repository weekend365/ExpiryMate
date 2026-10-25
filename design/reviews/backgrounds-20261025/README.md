# 생활 공간 배경 적용 — 2026-10-25

사용자가 승인한 계획에 따라 크레파스 생활 공간 6종을 새로 생성하고 일반 화면 27개에 적용했다.
기준은 작업 시작 시의 working tree이며, 직전 장고 중심 변경을 포함한다. HEAD는 `822e2fe3`다.
이번 작업은 배경 연결과 장식 레이어에 한정한다. 기존 장고·문구·카드·버튼·탭·입력 단계·
조작 위치·서비스 정책을 보존했다.

## 원본과 생성 기록

기본 **image_gen** 도구로 각각 생성했다. 모두 1024×1536 불투명 PNG이며 캐릭터·글자·숫자·
기능 아이콘이 없는 생활 공간이다. 기존 홈·주방 원본은 그림체 참조로만 사용했다.
각 JSON에 원본·프롬프트·참조의 SHA-256과 runtime 경로, 도구의 생성 파일 경로를 기록했다.

- 환영 공간: [원본](../../backgrounds/welcome-room-crayon-v1.png) · [최종 프롬프트](../../backgrounds/welcome-room-crayon-v1.prompt.txt) · [출처·해시](../../backgrounds/welcome-room-crayon-v1.json)
- 재료 준비 공간: [원본](../../backgrounds/ingredient-prep-crayon-v1.png) · [최종 프롬프트](../../backgrounds/ingredient-prep-crayon-v1.prompt.txt) · [출처·해시](../../backgrounds/ingredient-prep-crayon-v1.json)
- 조리 공간: [원본](../../backgrounds/cooking-workspace-crayon-v1.png) · [최종 프롬프트](../../backgrounds/cooking-workspace-crayon-v1.prompt.txt) · [출처·해시](../../backgrounds/cooking-workspace-crayon-v1.json)
- 생활 설정 공간: [원본](../../backgrounds/settings-study-crayon-v1.png) · [최종 프롬프트](../../backgrounds/settings-study-crayon-v1.prompt.txt) · [출처·해시](../../backgrounds/settings-study-crayon-v1.json)
- 기록 공간: [원본](../../backgrounds/insights-journal-crayon-v1.png) · [최종 프롬프트](../../backgrounds/insights-journal-crayon-v1.prompt.txt) · [출처·해시](../../backgrounds/insights-journal-crayon-v1.json)
- 함께 쓰는 공간: [원본](../../backgrounds/shared-table-crayon-v1.png) · [최종 프롬프트](../../backgrounds/shared-table-crayon-v1.prompt.txt) · [출처·해시](../../backgrounds/shared-table-crayon-v1.json)

`backgrounds:sync`로 `apps/mobile/assets/backgrounds`에 배포했다. 원본과 runtime은 같은 바이트다.
동기화 검사는 신규 원본뿐 아니라 최종 프롬프트와 두 그림체 참조의 해시도 검증한다.
[에셋 검사](./artwork-checks.json)에 규격·불투명도·출처 검사 결과를 남겼다.

## 적용 범위와 보존 확인

- `welcome` 6개: 첫 시작, 가입, 비밀번호 찾기·재설정, 이메일 확인·확인 대기.
- `ingredients` 3개: 직접 등록, 사진 분석·검토·완료, 재료 상세 수정.
- `cooking` 1개: 조리 준비·진행·완료와 로딩·오류 분기.
- `settings` 11개: 설정 메인과 계정·알림·추천 맞춤·보관 위치·문의·구독·추천권, 개인정보 3개.
- `records` 2개: 리포트, 냉장고·재료 변경 내역.
- `sharing` 4개: 냉장고 목록·상세, 초대 코드 입력·초대 수락.

[경로·분기 검사](./scope-audit.json)에서 27개 경로의 `Screen`/`SettingsScreen` 41개 분기를 확인했다.
각 경로는 배경 속성을 제거한 TypeScript AST가 작업 전과 같다. 적용 대상 밖의 route 파일 9개와
사진 촬영·스캐너·인증 전환 컴포넌트도 작업 전 바이트와 같다. 사진 등록의 `choose`는 기존
`PhotoCaptureScreen`을 유지하고 분석 이후에만 배경을 표시한다. 기존 5개 배경 해시도 동일하다.

`Screen`은 배경을 지정하지 않으면 기존처럼 이미지가 없다. `SettingsScreen`은 생활 설정 공간을
기본으로 상속하며 공유 냉장고만 장면을 바꾼다. 배경은 SafeAreaView 안에서 키보드·스크롤·푸터의
형제인 고정 레이어다. `contain`으로 전체 원화를 유지하고 크림색 바탕을 사용한다.
터치·포커스·접근성 트리에서 제외했으며 opacity는 배경 위의 베일에만 적용한다.

가독성 검사에서 가장자리의 진한 크레파스 선과 보조 문구가 겹쳐 베일을 보강했다.
공유 `sceneVeil`과 `sceneReadingVeil`을 사용하며 기존 색·글자·UI 토큰 값은 바꾸지 않았다.
개인정보·계정 삭제·결제 외에도 작은 보조 문구가 노출되는 가입·이메일 확인 대기·변경 내역·
조리 안내에는 `reading`을 적용했다. 원본은 밝기 보정 없이 그대로 보존한다.

## 화면 비교와 접근성

실제 컴포넌트의 React Native Web 비교로 **14개 대표 화면 × 폭 320·360·780 × 글자 1·1.3·2배,
총 126개**를 확인했다. AppText의 기존 글자 확대 상한과 반응형 분기를 사용한다.
전후 모두 Pretendard 5개 굵기를 미리 로드한 뒤 렌더해 폰트 교체 순간의 차이를 제외했다.
[측정 원자료](./layout-matrix.json), [배치 결과](./layout-summary.json)에 결과를 남겼다.
126개 모두 가로 넘침이 없고, 전후 텍스트·컨트롤 수와 위치·크기가 같다. 모든 장면 이미지가
로드됐고 장식 레이어는 `aria-hidden`·`pointer-events: none`이다.

설정·첫 시작·비밀번호 찾기·가입·메일 확인 대기·개인정보·AI 안내·냉장고 목록·알림·변경 내역은
실제 route 컴포넌트를 렌더했다. 직접 등록·조리·리포트·결제의 4개 비교는 실제 공통 컴포넌트에
예시 데이터를 넣은 조합 화면이다. 전체 27개 경로의 모든 상태를 네이티브로 재생한 결과가 아니다.
API·인증·구매·권한·라우팅은 로컬 fixture로 대체했고 실제 계정이나 결제 동작을 실행하지 않았다.

본문 경계 상자 1,148개에 대해 원본 PNG의 `contain` 좌표, 실제 베일 opacity와 불투명/반투명 UI
표면을 합성해 대비를 추정했다. [대비 결과](./contrast-summary.json)는 모두 4.5:1 이상이며 최솟값은
약 4.565:1이다. [개별 계산](./text-contrast.json)을 보존한다. 이는 선택한 Web 상태의 보수적인
영역 검사이며, 네이티브 글리프·안티앨리어싱·모든 스크롤 위치의 인증을 대신하지 않는다.

알림 화면을 스크롤해 본문이 746px 이동해도 배경과 하단 저장 버튼의 위치는 같았다.
[스크롤 원자료](./scroll-check.json), [입력·오류 복구](./interactions.json)에 확인 결과를 기록했다.
비밀번호 찾기는 입력 전 비활성 → 유효한 예시 이메일 입력 후 활성으로 바뀌며 배경이 입력을
가로채지 않는다. 개인정보는 오류 → 조회 중 → 8건 확인 뒤에도 같은 배경을 유지한다.
기존 Web Switch의 작은 시각 요소와 일부 chip 크기는 그대로이며 네이티브 터치 영역의 합격을
이 비교로 선언하지 않는다.

## 대표 전후 캡처

왼쪽은 배경 적용 전, 오른쪽은 적용 후다. 입력·재시도·스크롤 캡처는 오른쪽에서만 해당 동작을 했다.

- [설정](./screens/settings-360-1.jpg), [첫 시작·320폭·큰 글자](./screens/onboarding-320-2.jpg)
- [재료 등록 조합](./screens/ingredients-320-2.jpg), [조리 조합](./screens/cooking-360-1.3.jpg)
- [리포트 조합](./screens/records-360-1.jpg), [공유 냉장고](./screens/sharing-360-1.3.jpg)
- [개인정보·큰 글자](./screens/privacy-320-2.jpg), [결제 조합](./screens/payment-360-1.3.jpg)
- [AI 안내·780폭](./screens/ai-notice-780-1.3.jpg), [변경 내역·780폭·큰 글자](./screens/activity-780-2.jpg)
- [가입 약관](./screens/signup-360-1.jpg), [메일 확인 대기](./screens/verify-pending-360-1.3.jpg)
- [인증 입력](./screens/auth-input-320-2.jpg), [알림 스크롤·고정 푸터](./screens/notifications-scrolled-360-1.3.jpg)
- [개인정보 오류](./screens/privacy-error-360-1.3.jpg), [재시도 후 조회 완료](./screens/privacy-recovered-360-1.3.jpg)

## 검사 결과와 남은 확인

- `backgrounds:sync`·`backgrounds:audit`: 기존 5종 + 신규 6종, 총 11종 통과.
- `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`: 통과. shared build와 공유 계약 검사 포함.
- `pnpm -r --if-present test`: shared 162 + API 618 + mobile 678 = **1,458개 통과**, 기존 API 6개 건너뜀.
- 배경 레이어·기본값·설정 상속·푸터 보존 테스트 5개 추가. 반응형·큰 글자 관련 검사와 함께 38개 통과.
- `pnpm test`: 선행 장고 원화 검사 41개 중 39개 통과, 기존 2개 실패. 아래 원인 참조.

원화 실패는 `Unregistered artwork: design/jango/emoticons/unregistered-test.png`와 후보 수
`33 !== 32`로 기존 기록과 같다. 테스트가 삭제한 추적 PNG는 실행 전에 보관한 바이트로 복원했다.
HEAD와 SHA-256이 같고 `design/jango`에는 최종 diff가 없다. 원화·검수·서명·허용치는 바꾸지 않았다.
초기 병렬 검사 중 원화 측정의 기존 20초 제한에 걸린 1건은 부하가 줄어든 재실행에서 통과했다.
최종 workspace 전체 검사도 통과했다.

네이티브 환경을 조회했을 때 Android 연결 기기는 0대였고 실행 중인 iOS 시뮬레이터도 없었다.
설치된 도구와 종료 상태의 시뮬레이터는 있으나 새 네이티브 빌드·실행 세션은 시작하지 않았다.
Web fixture는 safe-area를 0으로 두고 애니메이션을 정적으로 처리한다. 실제 키보드·safe-area·
VoiceOver/TalkBack·카메라·스캐너·제스처·타이머·스토어 결제와 live font-scale 통합은 미검증이다.
이 기록을 네이티브 인수나 사용자 사용성 검증으로 간주하지 않는다.

결과 파일의 [해시 목록](./evidence-hashes.json)과 [검사 명령·결과](./verification.json)을 함께 보존한다.
