---
status: active
owner: design
last_reviewed: 2026-09-29
source_of_truth: true
---

# 장고(Jango) 캐릭터 스타일 가이드 v2

장고야 부탁해의 캐릭터 제작·앱 적용 정본이다. 형태는
[BIBLE v1](../design/jango/reference/JANGO-CHARACTER-BIBLE-v1.md), 표현은
[STYLE GUIDE v1](../design/jango/reference/JANGO-STYLE-GUIDE-v1.md), 적용 원본은
[production manifest](../design/jango/manifest.json)를 따른다.
[이전 가이드](./archive/JANGO_CHARACTER_STYLE_GUIDE_v1.md)는 현재 제작 기준으로 사용하지 않는다.

## 1. 정체성과 기준 원화

장고는 친절하고 약간 덤벙대는 냉장고 셰프 메이트다. 잔소리보다 챙김을 표현한다.
냉장고 얼굴 아래에 작은 앞치마 몸통과 짧은 팔다리가 연결되며 사람 머리·목을 추가하지 않는다.
표시명은 `appBrand.characterNameKo` / `characterNameEn`을 사용한다.

- **형태 측정 근거:** `design/jango/reference/bible-master-idle.png`. 기존 idle을 보존한 파일이며 런타임에서 사용하지 않는다.
- **현재 제작 세트:** `design/jango/kit-v3/`의 1254px 원본과 `design/jango/generated/`의 추가 포즈.
- **앱용 마스터:** 원본을 균일 축소한 `apps/mobile/assets/characters/jango-{mood}.png`.
- **새 제작:** v3 idle과 BIBLE·STYLE GUIDE를 함께 참조한다. 다른 mood의 우연한 편차를 기준으로 삼지 않는다.
- 외부 키트의 광고·연기·이모티콘 지침은 앱 기능이나 상태 정책을 변경하지 않는다.

## 2. 고정 형태와 표현

- 싱글도어, 왼쪽 민트 손잡이·파인애플, 오른쪽 회색 경첩 2개를 유지한다. 완성 이미지를 좌우 반전하지 않는다.
- 얼굴 **외곽** 비율은 중립 정면 기준 약 1.28:1 ±2%다. 회전은 물체 비율을 유지하며 투영한다. 기존 문 내부 밝은 영역 473×365 검사와 혼용하지 않는다.
- 모자는 중앙 봉우리가 높은 다섯 주요 볼륨과 민트 밴드를 유지한다. 문은 이중 테두리, 앞치마는 민트 테두리·중앙 포켓을 유지한다.
- 장갑은 둥근 주머니 하나·엄지 하나·커프스 하나다. 검지·손톱·손가락 마디를 추가하지 않는다. 가리키기는 주머니 전체의 방향으로 표현한다.
- 타원 눈의 크기·간격·입 중심은 BIBLE의 정규화 좌표를 따른다. 볼터치는 기본적으로 유지하며 가림만 허용한다.
- 손그림의 완만한 곡선과 약한 굵기 변화는 남기고 잔떨림·불필요한 질감은 줄인다. 기본색과 옅은 접촉 그림자를 사용한다.
- 3D·글로스·별도 흰자·반짝이는 눈·사람 얼굴·투도어·문 열기·임의 장식은 금지한다.

## 3. 색상과 UI의 관계

캐릭터 기본색의 기준은 BIBLE 7절이며 코드 표현은 `@expirymate/shared`의 `characterColors`다.
민트 하이라이트·파인애플 열매와 잎·경첩·봉제선까지 포함한다. 이 값은 재질별 대표색으로,
질감·명암·안티앨리어싱이 있는 래스터의 모든 픽셀이 같은 HEX여야 한다는 뜻은 아니다.
앱 UI 색상은 별도의 `palette`, `semanticColors`를 따른다.
캐릭터는 아이보리 몸체, 부드러운 민트, 따뜻한 차콜 외곽, 검정 계열 표정, 옅은 민트 볼터치를 사용한다.
부위별 민트·그림자·땀·혀 색은 `characterColors`를 따른다. 파인애플의 노랑·초록은 원본의 전용 악센트다.

UI는 `brandAccent`로 밝은 민트를, CTA·링크는 짙은 `actionPrimaryBackground`·`primaryForeground`를 사용한다.
캐릭터 민트를 흰 글자 버튼 배경으로 가져오지 않는다. 상태·유통기한·OAuth 색의 의미는 유지한다.
UI 행동·접근성은 [디자인 시스템](./design-system.md)을 우선한다.

## 4. 앱 mood 계약

기존 `MascotMood`와 컴포넌트 props는 유지한다.

- `idle`: v3 IDLE. 환영·기본 안내, 기본 타원 눈과 미소.
- `happy`: v3 HAPPY. 성공·완료, 웃는 눈과 한 발을 든 포즈.
- `think`: v3 THINKING. 생각·로딩, 볼에 장갑을 댄 기울어진 자세.
- `cooking`: v3 COOKING. 볼·거품기를 든 요리 포즈. 재고 변경을 암시하지 않는다.
- `empty`: v3 SAD 기반 수정. 눈썹을 덜고 짧은 약한 처진 입, 내려간 팔. 울음·과도한 낙담 금지.
- `worry`: SAD 기반, 작은 걱정 눈썹과 물색 땀방울 1개. 오류·권한 안내.
- `speak`: IDLE 기반, 작은 열린 입과 혀. 안내·스캔. 말풍선은 UI에서 렌더링한다.
- `point`: IDLE 기반, 짧은 팔과 장갑 전체로 오른쪽 방향을 안내한다.
- `icon-crop`: 윙크와 양손 엄지척의 별도 상반신 포즈. 두 장갑의 균형을 유지한다.

LOVE는 키트 참고 자산으로만 보존하며 앱 mood에 추가하지 않는다. 에셋 자체에 글자·말풍선·별을 넣지 않는다.

## 5. 원본과 결정적 생성

[원본 관리 안내](../design/jango/README.md)에 가져오기 위치, 도구, 프롬프트와 해시를 기록한다.
외부 절대 경로는 출처 설명일 뿐 빌드 의존성이 아니다.

```bash
pnpm --filter @expirymate/shared build
pnpm --filter @expirymate/mobile mascot:sync
pnpm --filter @expirymate/mobile mascot:build
pnpm --filter @expirymate/mobile branding:sync
pnpm --filter @expirymate/mobile store:sync
```

브랜딩·스토어 생성에는 Python과 Pillow 11.3.0이 필요하다. 격리된 가상환경의 `python3`를 PATH에 둔다.

- `mascot:sync`: manifest의 해시·규격을 검증한 뒤 1254px 정사각형을 1024px로 균일 축소한다. 늘이기·회전 보정·포즈별 임의 재구도는 하지 않는다.
- 생성 원본에 남은 1/255 알파 먼지만 manifest의 `alphaFloor: 1`에 따라 제거한다. 원본 파일은 보존하며 몸체의 흰색을 키잉하지 않는다.
- `mascot:build`: 프리멀티플라이드 알파 필터로 전신 160/320/480px와 소형 72/144/216px, 총 48개를 생성한다.
- 소형은 공통 좌표 `(97, 0, 830, 830)` 크롭이다. 독립적으로 선·표정·색을 수정하지 않는다. 작은 출력용 디테일 생략은 이번 세트에서 적용하지 않는다.
- `runtime/`, 앱용 마스터, 브랜딩·스토어 PNG는 직접 편집하지 않는다. 원본 변경과 manifest 검토 후 생성 명령을 사용한다.
- 이전 절대 비례 정규화 스크립트는 사용하지 않는다. 기울어진 자세나 한 발 들기를 idle의 얼굴 중심·발 높이에 맞추면 안 된다.

## 6. 브랜딩·스토어

아이콘은 새 `icon-crop`, 알림은 새 `idle`에서 파생한다. iOS 아이콘은 불투명 아이보리,
Android adaptive는 투명 foreground, monochrome은 같은 알파의 순백 glyph를 사용한다.
알림은 모자·머리 실루엣의 192px 마스터와 96px 배포본이며 흰색·완전 투명만 사용한다.

스플래시는 아이보리 배경 중앙의 88pt 소형 아이콘을 유지한다. 초기 로드는 장고 말풍선 대신 기존 스켈레톤을 사용한다.
`branding:sync`는 Expo 색상과 tracked iOS splash 색상·아이콘을 함께 갱신한다. Android native 리소스는 Expo Prebuild로 동기화한다.

`store:sync`는 원본 해상도의 idle·speak, shared 토큰, Pretendard와 기존 한국어 카피를 합성한다.
Google Play 1024×500과 App Store 세로 캠페인 1242×2688은 RGB PNG다.
캠페인 이미지는 실제 앱 스크린샷을 대체하지 않으며 [스토어 촬영 가이드](./store-screenshot-submission-guide.md)를 따른다.
이전 제출본·SNS·영상은 보존한다.

## 7. 화면 사용과 검수

화면에서 PNG를 직접 import하지 않고 `Mascot`을 사용한다. 한 화면·카드·시트의 상태에 맞는 mood 하나를 선택한다.
large는 온보딩·전체 빈 상태, medium은 히어로, small은 인라인·시트에 쓴다. 캐릭터와 함께 주요 CTA 하나를 명확히 한다.
한국어 카피·접근성 라벨·상태의 의미를 유지하고 장식용 장고를 난립시키지 않는다.

```bash
pnpm --filter @expirymate/mobile mascot:audit
pnpm --filter @expirymate/mobile mascot:anatomy:audit
pnpm --filter @expirymate/mobile branding:audit
pnpm --filter @expirymate/mobile store:audit
```

자동 검사는 원본 해시, 포즈별 bounds, 균일 파생, 투명 여백, 48개 런타임의 재현성,
소형 픽셀 일치, 아이콘 안전 영역과 장갑 균형을 확인한다. 해시 일치와 해부학적 수치 준수는 별개다.
추가 제작 5종은 [수치 검수 기록](../design/jango/measurements/README.md)으로 얼굴 외곽·표정 배치를 확인한다.
`mascot:measure`로 원본에서 측정값·선택 영역·검수 이미지를 생성하며, `mascot:anatomy:audit`는
재계산 결과의 최신성과 BIBLE 범위를 확인한다. 이 검사는 `mascot:audit`에도 포함된다.
아이콘의 얼굴 비율·윙크 눈 폭은 미달이고 다른 포즈에도 재검토 항목이 있어 현재 전체 통과 상태가 아니다.
원화는 자동 수정하지 않으며 실패·미측정·재검토 필요 항목을 통과로 취급하지 않는다.
장갑 구조·모자 등 수치 검사 범위 밖의 형태는 별도 시각 검토하고 그 기록을 manifest에 남긴다.

64/72/112/160px, 밝은·어두운 배경, 실제 화면에서 표정·크롭·색·잘림을 확인한다.
[반응형 QA](./mobile-responsive-qa.md)의 화면·글자 크기 조합과 변경 전후 캡처를 유지한다.
시각 변경은 이유와 캡처를 검토한 뒤에만 `approve-mobile-layout-change` 라벨을 적용한다.
