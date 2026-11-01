# 생활 공간 배경 품질 개선 — 2026-11-01

사용자가 승인한 「생활 공간 배경 6종 재생성 및 선명도 개선」을 적용한다.
작업 시작 시 working tree에는 직전 장고 크기 복원이 포함돼 있으며 이를 비교 기준으로 보존한다.
HEAD는 `cf37517d81d63ffea70c6235c6324a74bc4ead8b`다. 커밋·푸시·스토어 배포는 작업 범위에 없다.

## 원인과 적용 기준

기존 배경 5종과 추가 배경 6종은 모두 1024×1536 불투명 PNG이며 contain으로 표시한다.
규격 축소나 cover 크롭 오류는 확인되지 않았다. 추가 배경의 크림색 덮개가 84%로,
기존 홈 12%·추천 16%·장보기 12%보다 강해 원화의 선·색·질감이 희미해지는 차이가 있었다.
설정 등의 기존 원화에는 주요 소품이 가장자리에서 잘리는 구도도 있었다.

6종을 기본 **image_gen**으로 새로 생성했다. 기존 홈·주방은 그림체 참조로만 사용하고
좁은 화면에서도 전체 가구·주요 소품을 인식할 수 있도록 시점을 넓혔다. 단순 확대·크롭·
후처리 리사이즈를 이용하지 않았다. 모두 도구가 생성한 원본 바이트를 그대로 보존한다.
중앙은 밝고 넓게 비우며 캐릭터·문자·숫자·기능 아이콘은 넣지 않는다.

- 환영 공간: [원본](../../backgrounds/welcome-room-crayon-v2.png) · [실제 프롬프트](../../backgrounds/welcome-room-crayon-v2.prompt.txt) · [출처](../../backgrounds/welcome-room-crayon-v2.json)
- 재료 준비 공간: [원본](../../backgrounds/ingredient-prep-crayon-v2.png) · [실제 프롬프트](../../backgrounds/ingredient-prep-crayon-v2.prompt.txt) · [출처](../../backgrounds/ingredient-prep-crayon-v2.json)
- 조리 공간: [원본](../../backgrounds/cooking-workspace-crayon-v2.png) · [실제 프롬프트](../../backgrounds/cooking-workspace-crayon-v2.prompt.txt) · [출처](../../backgrounds/cooking-workspace-crayon-v2.json)
- 설정 공간: [원본](../../backgrounds/settings-study-crayon-v2.png) · [실제 프롬프트](../../backgrounds/settings-study-crayon-v2.prompt.txt) · [출처](../../backgrounds/settings-study-crayon-v2.json)
- 기록 공간: [원본](../../backgrounds/insights-journal-crayon-v2.png) · [실제 프롬프트](../../backgrounds/insights-journal-crayon-v2.prompt.txt) · [출처](../../backgrounds/insights-journal-crayon-v2.json)
- 공유 공간: [원본](../../backgrounds/shared-table-crayon-v2.png) · [실제 프롬프트](../../backgrounds/shared-table-crayon-v2.prompt.txt) · [출처](../../backgrounds/shared-table-crayon-v2.json)

각 출처에 생성 파일·참조·이전 원화와 SHA-256을 기록한다. 주요 소품 잘림이 남은 초안 4종과
노출 본문의 대비가 부족했던 후보 4개는 채택하지 않고 다시 생성·보정했다.
[미채택 기록](rejected-generations.json)에 실제 프롬프트·원본 경로·
해시·판단을 남겼으며 초안을 runtime으로 사용하지 않는다.

설정·환영 공간은 큰 글자의 안내 문구와 겹치는 소품을 밝은 안료로 다시 그렸다. 설정의 마지막
명도 보정은 기본 image_gen 편집이며 입력 원본·입력 생성 프롬프트를 iterations에 보존하고
v2 출처의 generationInputs로 해시를 연결한다. 덮개는 승인된 16%를 유지하며 글자색·배치는
바꾸지 않는다. source/runtime에 결정론적 밝기 보정·확대·리사이즈를 적용하지 않았다.

## 적용·보존

일반 베일은 16%, 현재 reading 처리 화면은 97%를 사용한다. Screen의 선택적 배경 프리셋,
기본값·고정 레이어·contain·크림색 바탕·터치와 접근성 제외 처리는 유지한다. 설정 하위 화면은
현재 상속을 이어받으며 화면 구성·본문·버튼·입력 단계·장고 프리셋·서비스 동작은 유지한다.

동기화 스크립트가 6종의 v2를 선택하고 기존 runtime 경로로 배포한다. 기존 v1과 배경 5종은
보존한다. 동기화 전에 11개 원본의 해시·실제 PNG 규격·불투명도와 프롬프트·참조·v2의 이전
원화 해시를 검증한다. 과거 기록의 문자열 previousArtwork와 v2의 해시 포함 기록을 구분한다.

## 화면 검증 방식

설정·알림 설정·첫 시작·비밀번호 찾기·이메일 확인 대기·개인정보·AI 안내·공유 냉장고 목록·
변경 내역·리포트는 실제 route를 React Native Web으로 렌더한다. 등록·조리·결제·사진 검토는
실제 공통 컴포넌트를 예시 데이터와 조합한다. 14개 화면 × 320·360·780 폭 × 글자 1·1.3·2배를
전후 비교하며, 전후 모두 직전 장고 크기 복원과 현재 화면 소스를 사용한다. 차이는 6개 이미지와
일반 베일뿐이다. 이미지 v1과 84% 베일을 검토 빌드에서만 복원해 전후를 비교한다.

Pretendard 5종은 마운트 전에 로드한다. 폰트 배율·상한은 Web 어댑터로 재현한다.
인증·쿼리·API·스토어·라우터·아이콘·모션·native inset은 대역이며 실제 API 요청은 차단한다.
읽기용 처리·스크롤 중 배경 고정·푸터와 입력 접근을 확인한다. 텍스트를 투명·검정·흰색으로
각각 렌더하고 글자별 식별 색상 마스크를 추가해 실제 노출 글리프 내부 픽셀 위치를 추정한다.
고정 푸터에 가려진 본문은 푸터 글자로 잘못 세지 않으며, 원래 전경색과 글자를 숨긴 배경을 합성해
대비를 계산한다. 비활성 컨트롤은 별도로 구분한다. 이는 선택한 Web 화면의 추정 검사이며
네이티브 글리프·모든 스크롤 위치·OS 키보드·화면 읽기의 인증을 대신하지 않는다.

Android 연결 기기와 실행 중인 iOS 시뮬레이터는 없다. CUA 브라우저 호스트도 사용 불가여서
별도 headless Chromium의 로컬 렌더로 검증한다. 네이티브 키보드·safe area·화면 읽기·카메라·
타이머·스토어 통합은 미검증으로 남긴다. 생성한 원본과 선택한 전후 캡처·검사 결과만 보존하고
중복 임시 자료는 참조·해시 확인 후 정리한다.

## 최종 화면 결과

126쌍의 전후 비교에서 본문·컨트롤의 내용·글자 크기·좌표·크기가 유지됐고 가로 넘침이 없다.
배경은 일반 화면 16%·reading 화면 97%를 사용하며 실제 원본이 모두 로드됐다.
노출된 본문·제목·행동 문구 1,219개 측정의 최소 대비는 **4.7141:1**로 모두 4.5:1 이상이다.
비활성 컨트롤, 가려진 본문과 글리프 중심 픽셀이 없는 항목은 대비 표본에 포함하지 않는다.

알림 설정·개인정보·리포트의 로딩·오류 6개 상태에서 같은 배경을 확인했다. 설정·알림·개인정보는
중간·마지막 스크롤에서 배경 좌표가 유지됐고 공유·리포트는 이 예시 데이터에서 스크롤이 필요하지
않았다. 비밀번호 찾기는 유효한 예시 이메일 입력·포커스·480 높이 뷰포트에서 고정 버튼 접근을
확인했다. 이 축소 뷰포트는 실제 OS 키보드가 아니다.

- [설정](settings-360-1.jpg) · [알림 설정](notifications-360-1.3.jpg) · [알림 하단 스크롤](notifications-scrolled-360-1.3.jpg)
- [첫 시작](onboarding-360-1.jpg) · [비밀번호 찾기·큰 글자](forgot-320-2.jpg) · [입력·키보드 대역](forgot-keyboard-360-1.3.jpg)
- [재료 등록 조합](ingredients-320-2.jpg) · [사진 검토 조합](photo-review-360-1.jpg) · [조리 완료 조합](cooking-360-1.3.jpg)
- [공유 냉장고](sharing-360-1.3.jpg) · [리포트](records-360-1.jpg) · [개인정보·큰 글자](privacy-320-2.jpg)

쌍으로 된 이미지는 왼쪽 변경 전·오른쪽 최종 변경 후다. 원본 6종의 출처·프롬프트는 위 링크에,
기술 검증은 [원화 규격·해시](artwork-checks.json), [27개 경로·보존](source-audit.json),
[126쌍 배치](layout-checks.json), [대비](contrast-checks.json), [로딩·오류](state-checks.json),
[스크롤·입력](interactions.json), [대비 보정 과정](contrast-iterations.json)에 둔다.

## 자동 검사와 제한

shared build, 배경 동기화·규격·출처 검사 11종, 관련 화면·반응형·글자·토큰 검사 38개,
문서·린트·전체 타입 검사가 통과했다. 초기 `pnpm test`는 원화 41개와 workspace 1,458개가
통과했지만 원화 측정의 `rejects a stretched door and compressed eye spacing` 1건이
기본 5초를 초과했다(6,065ms). 이 루트 명령 자체를 통과로 기록하지 않는다.

같은 소스·제한으로 해당 파일 11개를 별도 실행해 모두 통과했다(해당 항목 551ms).
이후 `pnpm -r --if-present run test --maxWorkers=1`에서 shared 162 + API 618 + mobile 679 =
1,459개가 통과하고 기존 API 6개는 건너뛰었다. 원화 41개와 합쳐 1,500개 검사 항목을 검증했다.
동시 작업 수만 줄였으며 검사 수치·서명·ROI·5초/20초 제한·기존 테스트는 수정하지 않았다.
기존 CI의 별도 20초 재현 초과와 이번 5초 초과를 구분한다. 새 CI는 실행하지 않았다.

[검사 명령·결과](validation.json)와 [네이티브 환경](native-environment.json)을 보존한다.
연결 가능한 실제 iPhone도 없으며, 알려진 물리 기기는 unavailable 상태였다.
실행 가능한 네이티브 환경이 없으므로 이 Web 결과로 OS 키보드·inset·화면 읽기·카메라·
타이머·스토어 통합을 승인하지 않는다. 검토 도구 원문은 `*.cjs.txt`로 보존하며 앱 번들에는
포함하지 않는다. [캡처 해시](capture-hashes.json)와 최종 증거 목록은 같은 디렉터리에 둔다.
