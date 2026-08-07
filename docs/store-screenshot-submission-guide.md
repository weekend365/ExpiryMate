# 장고야 부탁해 · 스토어 스크린샷 촬영·제출 가이드

> 기준일: 2026-07-24  
> 대상: iOS App Store + Google Play, 한국어 기본 스토어 등록정보  
> 앱 표시명: **장고야 부탁해**

이 문서는 현재 앱의 실제 화면과 설정을 기준으로, 촬영 준비부터 업로드까지 한 번에 진행하기 위한 체크리스트입니다.

## 1. 이번 제출의 권장 결과물

### App Store

| 세트 | 권장 장수 | 권장 원본 크기 | 비고 |
|---|---:|---|---|
| iPhone 6.9형 | 6장 | `1320 × 2868` 또는 `1290 × 2796` 세로 | 6.9형을 올리면 더 작은 iPhone용은 자동 축소 가능 |

- 장치 크기별 최소 1장, 최대 10장
- JPEG/JPG/PNG, 투명도(alpha) 없음
- 가로·세로 모두 가능하지만 이 앱은 **세로 통일** 권장

현재 [`apps/mobile/app.json`](../apps/mobile/app.json)의
`ios.supportsTablet`과 네이티브 `TARGETED_DEVICE_FAMILY` 설정은 iPhone
전용입니다. 따라서 v1 제출에는 iPad 스크린샷이 필요하지 않습니다. 향후 iPad를
지원할 때는 설정을 바꾼 새 빌드에서 별도 레이아웃 QA와 iPad 스크린샷을 준비합니다.

### Google Play

| 세트 | 권장 장수 | 권장 최종 크기 | 비고 |
|---|---:|---|---|
| 휴대전화 | 6장 | `1080 × 1920` 세로, 9:16 | 추천 노출 요건까지 고려한 규격 |
| 7형/10형 태블릿 | 각 4장 | 세로 9:16, 짧은 변 1080px 이상 | 태블릿 배포와 UI QA를 할 때 추가 |

- 출시 최소 요건은 기기 유형 전체에서 스크린샷 2장
- 기기 유형별 최대 8장
- JPEG 또는 24-bit PNG, 투명도 없음
- 각 변 320~3840px, 긴 변은 짧은 변의 2배를 넘지 않아야 함
- 앱 추천 영역까지 고려하면 휴대전화용 **최소 4장, 1080px 이상, 세로 9:16** 권장
- Play 제출에는 스크린샷과 별도로 `1024 × 500` Feature Graphic도 필요

## 2. 최종 6장 구성

처음 3장이 검색·스토어 미리보기에서 가장 중요합니다. App Store와 Play 모두 아래 순서를 유지합니다.

| 순서 | 실제 화면 | 권장 캡션 | 촬영 상태 |
|---:|---|---|---|
| 1 | 홈 | **오늘 냉장고 상태를 한눈에** | 오늘 만료 1, 7일 이내 4, 보관 중 8~10개가 보이게 |
| 2 | 보관함 | **재료와 유통기한을 편하게** | 전체 보기, 임박순 카드 4~6개, 오류·선택 모드 없음 |
| 3 | 요리 추천 결과 | **임박 재료로 오늘 메뉴까지** | 실제 생성된 요리 카드 2개 이상, 생성 중·한도 오류 없음 |
| 4 | 바코드/유통기한 스캔 | **비추면 등록 준비가 빠르게** | 카메라 권한 허용 후 1/2 또는 2/2 가이드가 선명하게 |
| 5 | 공유 냉장고 상세 | **가족·동료와 같은 냉장고를 함께** | 가상 구성원 2~3명, 대기 중 이메일·초대 코드 노출 없음 |
| 6 | 재료 등록의 유통기한 단계 | **세 단계로 재료 등록도 가볍게** | 재료명이 채워진 상태, 빠른 날짜 선택지가 보이게 |

캡션 없는 원본 UI만 제출해도 됩니다. 캡션을 넣는다면 모든 이미지에서 위치, 크기, 배경색을 동일하게 하고 실제 앱 UI가 이미지 대부분을 차지하게 합니다.

## 3. 촬영 계정과 데이터 준비

프로덕션 전체 DB에 개발 seed를 실행하지 않습니다. 촬영 전용 계정에서 앱 UI로 직접 데이터를 만들거나, 안전하게 범위가 제한된 별도 스크립트를 준비합니다.

### 권장 촬영 데이터

| 재료 | 수량 | 위치 | 촬영일 기준 기한 |
|---|---:|---|---|
| 우유 | 1팩 | 냉장 | 오늘 |
| 달걀 | 6개 | 냉장 | D-2 |
| 두부 | 2모 | 냉장 | D-4 |
| 시금치 | 1봉 | 냉장 | D-5 |
| 플레인 요거트 | 2개 | 냉장 | D-7 |
| 냉동 만두 | 1봉 | 냉동 | D-21 |
| 파스타면 | 1봉 | 실온 | D-60 |
| 토마토소스 | 1병 | 실온 | D-90 |

브랜드명과 메모는 비우거나 자체 제작한 가상 값만 사용합니다. 요리 추천은 위 재료를 넣은 뒤 앱에서 실제로 생성하고, 결과가 자연스러운지 확인한 후 촬영합니다.

### 가상 계정 표시 예시

- 공간 이름: `우리 집 냉장고`
- 구성원 표시명: `장고 사용자 1`, `장고 사용자 2`
- 이메일이 꼭 보여야 한다면: 소유한 도메인의 촬영 전용 alias 사용
- 실명, 개인 이메일, 전화번호, 실제 초대 코드, 푸시 토큰은 노출하지 않음

Apple 심사 지침도 실제 인물 정보 대신 가상 계정 정보를 사용하도록 요구합니다.

## 4. 촬영 직전 P0 체크

- [ ] 제출할 Release Candidate와 같은 커밋·환경의 빌드를 사용
- [ ] 홈과 설정에 임시 출시 안내·placeholder 기능이 남아 있지 않은지 확인
- [ ] 라이트 모드, 기본 글자 크기, 기본 화면 확대 설정
- [ ] 상태바 시간·배터리·통신 상태를 모든 장에서 동일하게
- [ ] 로딩, skeleton, 오류, 키보드, 권한 팝업, 알림 배너가 없는 상태
- [ ] 홈·보관함·추천의 공간이 모두 `우리 집 냉장고`로 동일
- [ ] 카메라 화면 배경에 얼굴, 집 내부, 주소, 상표가 보이지 않게
- [ ] 실제 제출 빌드에서 제공하지 않는 기능이나 결제 문구를 캡션에 넣지 않음

Apple은 로그인·스플래시·타이틀 화면만 보여주는 스크린샷을 허용하지 않습니다. 이 앱은 로그인 화면을 스토어 이미지에 넣지 않습니다.

## 5. iOS 촬영 방법

### 가장 안전한 방법: TestFlight 실기기

1. 제출 예정 production 빌드를 TestFlight에 올립니다.
2. iPhone 16 Pro Max 또는 15 Pro Max에 설치합니다.
3. 방해금지 모드, 라이트 모드, 기본 글자 크기를 설정합니다.
4. 각 화면에서 측면 버튼 + 음량 높이기 버튼으로 촬영합니다.
5. Mac으로 원본 파일을 옮기고 픽셀 크기를 확인합니다.

대표 허용 크기:

- iPhone 16 Pro Max: `1320 × 2868`
- iPhone 15 Pro Max: `1290 × 2796`

### 반복 촬영이 편한 방법: iOS Simulator

동일한 앱 커밋과 production API 설정을 사용합니다. 카메라 스캔 화면은 실기기에서 별도로 촬영하는 편이 낫습니다.

```bash
mkdir -p store-assets/screenshots/raw/ios/ko/iphone-6.9

xcrun simctl status_bar booted override \
  --time 9:41 \
  --batteryState charged \
  --batteryLevel 100 \
  --wifiBars 3 \
  --cellularBars 4

xcrun simctl io booted screenshot --type=png \
  store-assets/screenshots/raw/ios/ko/iphone-6.9/01-home.png
```

촬영 후 상태바 override 해제:

```bash
xcrun simctl status_bar booted clear
```

## 6. Android 촬영 방법

가장 신뢰할 수 있는 원본은 Play 내부 테스트 트랙의 release 빌드입니다. 다만 대부분의 최신 실기기 원본은 9:16보다 길기 때문에, Google 추천 노출 규격까지 맞추려면 아래 중 하나를 사용합니다.

1. Android Emulator의 화면을 `1080 × 1920`으로 맞춰 직접 캡처
2. 실기기 원본을 찌그러뜨리지 않고 `1080 × 1920` 캔버스에 배치

Emulator 예시:

```bash
mkdir -p store-assets/screenshots/raw/android/ko/phone

adb shell wm size 1080x1920
adb exec-out screencap -p \
  > store-assets/screenshots/raw/android/ko/phone/01-home.png

adb shell wm size reset
```

해상도를 바꾼 뒤 앱을 완전히 종료·재실행하고, 하단 탭·safe area·키보드가 잘리지 않는지 확인합니다. iOS 캡처를 Play에 재사용하지 않습니다.

## 7. 캡션·후가공 규칙

권장 스타일은 **굵은 2줄 상단 캡션 + 얇은 아이폰 베젤 + 크게 보이는 실제 UI**입니다.

### 캡션 디자인

- `장고야 부탁해` 같은 앱 이름, 로고, eyebrow 배지를 캡션 위에 반복하지 않음
- 캡션 영역은 전체 높이의 약 12~18%로 유지하되 불필요한 위·아래 여백을 만들지 않음
- 한 이미지에 핵심 문장 하나만 사용하고, 의미 단위로 최대 2줄까지 줄바꿈
- 첫 줄은 핵심 기능을 설명하고 두 번째 줄은 가장 중요한 결과나 효익을 짧게 강조
  - 예: `오늘 냉장고 상태를` / `한눈에`
- 가운데 정렬한 `Pretendard ExtraBold`를 사용하고 작은 스토어 미리보기에서도 먼저 읽히는 크기로 설정
- 첫 줄은 진한 에메랄드 `#064E3B`, 강조 줄은 브랜드 에메랄드 `#10B981`의 **완전한 단색**으로 렌더링
- 글자 내부에 그라데이션, 반투명도, 그림자, 광택, 노이즈, 색 번짐, 얼룩처럼 보이는 명암 차이를 사용하지 않음
- 캡션 배경은 `#ECFDF5` 단색을 기본으로 하며 캡션과 겹치는 장식·질감·광원 효과를 넣지 않음

### 아이폰 베젤 디자인

- App Store iPhone 이미지에는 실제 화면을 감싸는 얇은 그래파이트 베젤을 일관되게 사용
- 베젤 색상은 `#1A1F27`, 두께는 캔버스 짧은 변의 약 1.5~2%로 설정
- 화면은 캔버스 너비의 약 82~86%를 차지하게 하여 베젤 때문에 앱 UI가 지나치게 작아지지 않게 함
- 모서리는 실제 iPhone에 가까운 연속 곡률로 처리하고 상단 중앙에 작고 절제된 Dynamic Island를 배치
- Dynamic Island가 원본 캡처의 상태바나 앱 콘텐츠와 중복·충돌하지 않도록 화면 시작 위치를 조정
- 외곽 그림자는 기기와 배경이 구분되는 정도로만 약하게 적용
- Apple 로고, 측면 버튼, 반사광, 금속성 3D 측면, 두꺼운 하드웨어 장식은 사용하지 않음
- Google Play 이미지에는 아이폰 베젤을 사용하지 않음

### 공통 후가공

- 앱 화면은 자르더라도 핵심 버튼·탭·날짜 의미가 보이게
- 원본 종횡비를 늘이거나 압축하지 않음
- `최고`, `1위`, `무료`, `다운로드`, `지금 설치` 같은 순위·가격·CTA 문구 금지
- 존재하지 않는 자동 인식률, 절감 효과, AI 정확도 수치 금지
- Google Play는 캡션이 전체 이미지의 20%를 넘지 않도록 권장
- 다른 스토어 로고, 기기 제조사 로고, 타사 캐릭터·상품 로고 사용 금지
- 한국어 외 스토어 등록정보를 만들 때는 캡션도 해당 언어로 별도 제작

## 8. 파일 구조와 검수

권장 보관 구조:

```text
store-assets/
  screenshots/
    raw/
      ios/ko/iphone-6.9/
      android/ko/phone/
    final/
      app-store/ko/iphone-6.9/
      google-play/ko/phone/
```

파일명:

```text
01-home.png
02-inventory.png
03-recommendations.png
04-scanner.png
05-shared-space.png
06-register-expiry.png
```

macOS에서 픽셀과 alpha 확인:

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha \
  store-assets/screenshots/final/app-store/ko/iphone-6.9/*.png
```

alpha가 있으면 JPEG로 변환하거나 이미지 편집기에서 투명도를 제거합니다.

```bash
sips -s format jpeg input.png --out output.jpg
```

최종 육안 검수:

- [ ] 6장의 순서와 캡션이 동일
- [ ] 앱 이름과 실제 UI가 현재 빌드와 일치
- [ ] 개인정보·초대 코드·실제 이메일 없음
- [ ] 오류·로딩·빈 화면 없음
- [ ] 작은 글자도 휴대전화에서 읽힘
- [ ] 잘린 CTA, 탭, safe area 없음
- [ ] 이미지가 흐리거나 늘어나지 않음
- [ ] App Store 파일은 허용 픽셀 크기와 정확히 일치
- [ ] Play 파일은 9:16이며 최소 1080px

## 9. 제출 순서

### App Store Connect

1. **Apps → 장고야 부탁해 → 제출할 iOS 버전**
2. 오른쪽 위 언어를 **한국어**로 선택
3. **App Previews and Screenshots → iPhone**
4. 6.9형 세트에 6장을 순서대로 업로드
5. iPad 지원을 유지했다면 **iPad → 13형**에도 실제 iPad 캡처 6장 업로드
6. **View All Sizes in Media Manager**에서 자동 축소 결과와 누락 장치 확인
7. 저장 후 첫 3장의 작은 미리보기에서 캡션 가독성 확인

승인된 버전의 스크린샷을 바꾸려면 일반적으로 새 앱 버전이 필요하므로 제출 전에 확정합니다.

### Google Play Console

1. **Grow users → Store presence → Main store listing**
2. 기본 언어가 한국어인지 확인
3. **Graphics → Phone screenshots**에 6장 업로드
4. 태블릿을 지원·홍보한다면 7형/10형 섹션에 각 4장 이상 업로드
5. 별도로 `1024 × 500` Feature Graphic 업로드
6. 각 이미지에 140자 이내 대체 텍스트 입력
7. 저장 후 휴대전화 미리보기에서 첫 3장 순서 확인

## 10. Google Play 대체 텍스트 초안

| 파일 | 대체 텍스트 |
|---|---|
| `01-home` | 오늘 만료, 7일 이내, 보관 중 재료 수를 보여주는 장고 홈 화면 |
| `02-inventory` | 유통기한이 가까운 순서로 식재료와 보관 위치를 보여주는 보관함 |
| `03-recommendations` | 냉장고의 임박 재료로 만든 요리 추천 카드와 추천 조건 |
| `04-scanner` | 바코드와 유통기한을 두 단계로 읽는 카메라 스캔 화면 |
| `05-shared-space` | 가족이나 동료 구성원과 함께 쓰는 냉장고 관리 화면 |
| `06-register-expiry` | 빠른 날짜 선택으로 식재료 유통기한을 입력하는 등록 화면 |

## 11. 공식 기준 링크

- [Apple · Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Apple · Upload app previews and screenshots](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/)
- [Apple · App Review Guidelines 2.3 Accurate Metadata](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play · Add preview assets to showcase your app](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)

스토어 콘솔은 규격을 수시로 바꿀 수 있으므로 실제 업로드 직전에 위 공식 링크와 콘솔의 현재 안내를 마지막으로 대조합니다.
