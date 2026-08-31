---
status: active
owner: design
last_reviewed: 2026-08-29
source_of_truth: true
---

# 장고(Jango) 캐릭터 스타일 가이드

> **상태:** 최종 기준 (v1)  
> **기준일:** 2026-07-21  
> **제품:** 장고야 부탁해 (EN: Jango) · 마스코트: 장고  
> **앱 연동:** `apps/mobile/src/components/Mascot.tsx` · `appBrand` (`@expirymate/shared`)

이 문서는 장고 비주얼·에셋·앱 배치의 **단일 진실 공급원**이다.  
UI 리디자인 당시 초안은 [`archive/MOBILE_REDESIGN_PROMPTS.md`](./archive/MOBILE_REDESIGN_PROMPTS.md)에 남아 있으며, **비주얼 규칙은 이 문서를 우선**한다.

---

## 1. 정체성

| 항목 | 규칙 |
| --- | --- |
| 역할 | 냉장고 셰프 메이트. 잔소리보다 **챙김** |
| 구조 | 사람이 냉장고를 입은 느낌이 아니라, **냉장고 본체에 팔·다리가 달린** 형태 |
| 실루엣 | 큰 사각 몸통(문) + 큰 셰프모자 + 짧은 팔다리. 멀리서도 “네모 + 모자” |
| 성격 | 친절하고 약간 덤벙. 옆에서 말하는 듯한 톤 |
| 표시명 | 하드코딩 금지 → `appBrand.characterNameKo` / `characterNameEn` |

---

## 2. 비주얼 방향 (최종)

### 채택 스타일

**플랫 2D 일러스트 + 손맛 있는 선**

- 셀 셰도우 1단 이내
- 선에 의도적인 두께 변화·미세한 텍스처 허용
- Line Friends / 카카오 프렌즈류 플랫 마스코트 톤

### 레퍼런스

| 용도 | 파일 |
| --- | --- |
| 비례·파츠·렌더 마스터 | `apps/mobile/assets/characters/jango-idle.png` |
| 앱 사용 에셋 (mood) | `apps/mobile/assets/characters/jango-{mood}.png` |
| 아이콘 포즈 기준 | `apps/mobile/assets/characters/jango-icon-crop.png` |

`jango-idle`을 **유일한 캐릭터 마스터**로 사용한다. 신규 mood·브랜딩·스토어 이미지는 모두 이 파일의 통통한 싱글도어 비율, 파츠 구성, 선과 면의 표현을 함께 유지한다. 3D 원형을 별도의 비례 기준으로 사용하지 않는다.

### 의도적으로 버린 것

- 3D / 클레이 / 비닐 토이 / 블렌더 룩
- 균일 스튜디오 글로스·AO·패브릭 노이즈 베이크
- Midjourney식 “완벽한 대칭 정면 토이”

---

## 3. 디자인 록 (바꾸지 말 것)

전 mood에 **동일하게** 유지한다.

### 3-1. 본체

- **싱글도어만** — 냉동실 가로 분할선·투도어 금지
- 몸통 = 머리가 된 둥근 미니 냉장고 (통통한 비율, 키 큰 슬림 냉장고 금지)
- **손잡이:** 민트 세로 손잡이, 보는 이 기준 **왼쪽**
- **경첩:** 작은 회색/차콜 플랫 경첩 **2개**, 보는 이 기준 **오른쪽**

### 3-2. 시그니처

- **파인애플 마크 (브랜드 배지)**
  - 형태: 노란 타원 몸 + 교차 해치(또는 단순 다이아) + 초록 잎 스파이크 3~4개
  - 위치: 문 **왼쪽 상단**, 손잡이 **바로 위**
  - 크기: 문 가로폭의 **약 8~10%** (TINY 스티커·과장된 과일 금지)
  - 전 mood·아이콘 크롭에서 **동일 마크** 유지. 사과/하트 등으로 교체 금지
- 모자: 큰 셰프 토크 + 민트 밴드. 오른쪽이 살짝 더 부푼 비대칭 + 밴드에 실밥/스티치 힌트 허용
- 앞치마: 흰 면 + 민트 테두리 + **가운데** 민트 포켓 (아주 살짝 비뚤어짐 허용)
- 손: 항상 **민트 오븐장갑** (퀼팅은 마름모 선 몇 개만). 손가락 분리 금지
- 발: 짧은 다리 + 민트 둥근 슈즈
- 팔·다리는 **짧고 통통한 흰색** (가느다란 검정 막대팔 금지)

### 3-3. 마스터 고정 · 얼굴 문법

- **마스터:** `jango-idle.png` — 몸·모자·앞치마·손잡이·경첩·파인애플 마크·선 스타일의 기준
- 나머지 mood는 위 파츠를 공유하고 **얼굴·포즈·(cooking만) 소품**만 변경
- 선 위주. **유리알 눈 + 이중 하이라이트** 금지 (idle과 같은 단색 눈 문법)
- 기본: 점/타원 단색 눈 + 작은 입
- 볼터치: 기본 없음. `happy`에서만 Mint Soft를 아주 작게
- 코·귀·사람 얼굴형으로 진화 금지

### 3-4. 비례 록 (`jango-idle` 기준)

아래 비례에서 **머리**는 셰프모자가 아니라 얼굴이 배치된 냉장고 문, **하단 몸통**은 문 아래의 앞치마·다리 영역을 뜻한다.

| 구간 | 전체 캐릭터 높이 대비 | 관계 규칙 |
| --- | ---: | --- |
| 셰프모자(밴드 포함) | 29~32% | 문 너비의 105~112%. 문보다 살짝 넓게 |
| 냉장고 문(머리) | 38~41% | 가장 큰 단일 덩어리. 하단 몸통 높이의 1.25~1.35배 |
| 하단 몸통(앞치마·다리) | 29~32% | 문 높이의 80%를 넘기지 않음 |

- 캐릭터 전체 바운딩 박스는 1024px 캔버스 높이의 **약 93~96%**, 기본 포즈 너비의 **약 50~60%**를 사용한다.
- 문 너비는 캔버스의 **약 48~52%**, 앞치마 너비는 문 너비의 **약 58~65%**를 유지한다.
- mood 포즈 때문에 팔·소품이 좌우로 넓어져도 모자·문·앞치마의 기본 비율은 바꾸지 않는다.
- 하단 몸통을 키우거나 다리를 늘여 사람형 체형으로 만들지 않는다. 모든 mood는 `jango-idle`의 문 중심 좌표와 발 기준선을 우선 맞춘다.
- 픽셀 검수 기준: 문 내부 warm-white 연결 영역은 전신 **473×365 (1.296:1)**, 고정 크롭으로 파생한 소형은 약 **583×450 (1.296:1)**. 두 버전의 종횡비는 동일해야 하며 가로·세로 각각 `±1.5%`를 넘는 결과는 반영하지 않는다.
- 검수: `node apps/mobile/scripts/audit-mascot-proportions.mjs --check`


---

## 4. 선 (Line)

| 위계 | 용도 | 기준 (1024px 캔버스) |
| --- | --- | --- |
| 굵게 | 외곽 실루엣 (모자·몸통·장갑) | 상대적으로 가장 두껍게 |
| 중간 | 손잡이·경첩·앞치마 가장자리 | 중간 |
| 얇게 | 표정·스티치·퀼팅·자석 | 가장 얇게 |

- 아웃라인 색: 차콜 `#1A1F27` 계열 (`semanticColors.text`). 순수 `#000000` 지양
- 선 끝은 둥글게. 칼끝 마감 금지
- 완벽히 균일한 벡터 스트로크만으로 전체를 감싸지 말 것
- 입체감은 선 해칭이 아니라 **면색 Soft Shadow 1단**으로
- 소형 에셋의 외곽선을 별도로 다시 그리거나 굵게 만들지 않는다. 해당 mood 전신 마스터의 선을 지정 상반신 크롭으로 그대로 파생하며, `audit-mascot-small-fidelity.mjs`의 outline mismatch가 반드시 `0`이어야 한다.

---

## 5. 색 (Color)

캐릭터 기본 팔레트는 **6색 이내**로 유지한다. 파인애플·cooking 소품·상태 표현은 아래에 정의된 전용 악센트만 예외로 허용한다.

| 역할 | hex | 토큰 / 비고 |
| --- | --- | --- |
| Body White | `#FFFFFF` | `surface` / `neutral.0` |
| Soft Shadow | `#E8ECF0` ~ `#F1F3F5` | 셀 셰도우 1단. `background`/`neutral.100` 부근 |
| Mint | `#10B981` | `primary` / `brand.500` |
| Mint Soft | `#D1FAE5` | `primarySoft` / `brand.100` — `happy` 볼터치 |
| Charcoal | `#1A1F27` | `text` / `neutral.900` — 선·눈·입 |
| Warm Wood | `#C4A574` | **cooking 소품만**. UI primary로 쓰지 않음 |
| Water Blue | `#BFE8F5` | **worry 땀방울 1개만**. 민트·청록 금지 |
| Tongue Pink | `#F2A7B5` | **speak의 작은 혀만**. 볼터치·의상·소품에 사용 금지 |
| Pineapple | 노랑 + 초록 | 자석 전용 악센트 |

### 칠하기

- Base → Soft Shadow → (필요 시) Mint Soft 포인트
- 그라데이션·메탈릭 실버 그라데이션·서브서피스 금지
- 경첩은 플랫 회색 1색
- 표정마다 몸통 색을 바꾸지 않음 (걱정이어도 회색 바디 X)
- Primary로 파란 계열 사용 금지. `Water Blue`는 땀방울 상태 표현에만 사용

---

## 6. Mood · 포즈

앱 `MascotMood`: `idle` | `happy` | `worry` | `cooking` | `empty` | `speak` | `think` | `point`

| mood | 얼굴 | 포즈 | 앱에서 쓸 때 | 카피 톤 예 |
| --- | --- | --- | --- | --- |
| `idle` | 점/타원 눈 + 부드러운 미소 | 팔 살짝 벌린 환영 포즈, 미세한 무게 이동 | 온보딩·기본 안내 | 오늘도 냉장고 잘 지켜볼게요 |
| `happy` | 휘어진 눈 + 열린 입 + 볼터치 optional | 한 팔 흔들기 등 | 등록/저장 성공 | 냉장고에 잘 넣어뒀어요 |
| `worry` | 눈썹 안쪽 올림 + **작고 단순한 아래쪽 곡선 입** + Water Blue 땀 1방울 | 살짝 움츠림, 장갑이 볼 근처 | 임박·만료·삭제 확인 | 이 재료, 곧 써야 해요 |
| `cooking` | 살짝 각진 집중 눈썹 + 단색 타원 눈 + 작은 닫힌 미소 (볼터치 없음) | 나무 거품기 **1개만** | 레시피 추천·생성 | 지금 있는 재료로 이 요리 어때요? |
| `empty` | 얼굴 아래쪽에 둔 단색 타원 눈 + 작은 아래쪽 곡선 입 (볼터치·하이라이트 없음) | 어깨 처짐, 시선 아래 | 빈 목록/추천 | 아직 비어 있어요. 하나 넣어볼까요? |
| `speak` | 타원 눈 + **열린 입 + 작은 Tongue Pink 혀** | 한 장갑만 살짝 들어 설명하고 반대 장갑은 몸 가까이 내린 자세 | 안내·팁·말풍선 UI와 함께 | 이 재료부터 살펴볼까요? |
| `think` | `idle`과 같은 높이의 단색 타원 눈 + 작은 다문 입 (볼터치·눈 하이라이트 없음) | 한 장갑은 턱 근처, 반대 장갑은 몸 가까이 내린 자세로 생각하는 상태를 표현 | 로딩·추천 생성 중 | 잠깐만요, 요리를 고르는 중이에요 |
| `point` | `idle` 높이의 단색 타원 눈 + 작은 미소 | 어깨에서 자연스럽게 이어진 짧고 통통한 팔을 뻗고, 둥근 오븐 장갑의 짧은 돌출부 1개로 **옆/아래 CTA 방향**을 가리킴 | 다음 행동·주 CTA 유도 | 여기 눌러 이어가 볼까요? |

### 포즈 공통 규칙

- 풀바디, 캐릭터가 프레임의 **80~90%**
- **완전 대칭 정면 T포즈 금지.** 미세 3/4 또는 무게중심 비대칭
- 한 장에 행동 하나. 소품은 `cooking`만
- `worry` 입에 물결·지그재그를 반복하지 않음. 한 번 굽은 짧은 곡선으로 표현
- `cooking`은 최초 바리에이션의 집중 표정을 기준으로 한다. 유리알 눈·열린 입·한쪽 입꼬리 등 별도 얼굴 문법을 추가하지 않음
- `empty` 눈을 뾰족한 눈꺼풀·화난 눈으로 만들지 않음. 단순한 타원 위치와 처진 자세로 공허함을 표현
- `point` 팔은 몸통과 분리되거나 문 중앙에서 시작하지 않는다. 어깨에서 자연스럽게 연결하고 문 너비 절반보다 짧게 유지하며, 직선 튜브처럼 늘이지 않는다.
- `point` 장갑은 둥근 퀼팅 오븐 장갑 본체 + 짧고 굵은 방향 돌출부 1개만 사용한다. 사람 검지·분리된 손가락·두 손가락 제스처 금지
- 냉장고 문을 열어 내부를 보여 주지 않음
- 별·하트·연기·말풍선 등 이펙트를 에셋에 넣지 않음
- 의상/모자는 mood마다 바꾸지 않음 — **얼굴·포즈만 변경**

---

## 7. 에셋 스펙

### 파일 (인앱 mood)

| 파일 | 용도 |
| --- | --- |
| `jango-idle.png` | 기본 · **풀바디 마스터** (알림 실루엣 원본) |
| `jango-happy.png` | 기쁨 (idle 파츠 고정, 얼굴·포즈만) |
| `jango-worry.png` | 걱정 |
| `jango-cooking.png` | 요리 |
| `jango-empty.png` | 빈 상태 |
| `jango-speak.png` | 말하기 (안내·말풍선 UI와 함께). **에셋에 말풍선 금지** |
| `jango-think.png` | 생각·로딩 |
| `jango-point.png` | 가리키기 (CTA 유도) |
| `jango-icon-crop.png` | **아이콘 전용 포즈** (idle 마스터·윙크+양손 엄지척, 투명 PNG). 양손은 같은 크기·높이로 맞추고 얼굴보다 시각적으로 무겁지 않게 유지. `branding:sync`가 `#F1F3F5` 불투명 `icon.png`로 합성 |

경로: `apps/mobile/assets/characters/`

### 소형 UI 전용 에셋

`Mascot size="small"`은 해당 mood의 전신 마스터에서 결정적으로 파생한 상반신 에셋을 자동 선택한다. 소형을 독립적으로 생성·재디자인하지 않는다.

- 파생 소스: `assets/characters/jango-{mood}.png` (1024×1024 RGBA 전신 마스터)
- 파생 결과: `assets/characters/runtime/small/jango-{mood}{,@2x,@3x}.png` (72/144/216px RGBA)
- 고정 크롭: 전신 좌표 `(x: 97, y: 0, width: 830, height: 830)`을 1024×1024로 확대한다. mood별 임의 크롭·재구도 금지
- 디자인: 얼굴·모자·문·손잡이·경첩·자석·의상·장갑·소품을 전신 마스터와 픽셀 수준으로 동일하게 유지한다.
- 색: Mint·Charcoal·Body White·Soft Shadow를 전신 마스터에서 그대로 샘플링한다. 소형 전용 채도·명도 보정 금지
- 선: 전신 마스터의 선화를 크롭과 함께 확대할 뿐 별도 외곽선 추가·굵기 보정 금지
- 표정·제스처: 해당 mood 전신 마스터의 표정과 포즈를 그대로 유지한다. 소형 전용 재해석 금지
- 사용 범위: 72px 인라인·배너·시트 전용. `medium`과 `large`는 기존 전신 에셋 유지
- 재생성: `pnpm --filter @expirymate/mobile mascot:build` (`mascot:small:build`는 호환 명령)
- 자동 검수: `pnpm --filter @expirymate/mobile mascot:audit` — 풀바디에서 메모리상으로 직접 파생한 기준과 비교해 outline·mint·alpha·전체 픽셀 불일치가 모두 `0`이어야 한다. 1024px 소형 중간 파일은 저장하지 않는다.

### 브랜딩 / 스토어 / 알림

재생성: `pnpm --filter @expirymate/mobile branding:sync`

| 파일 | 원본 | 용도 |
| --- | --- | --- |
| `assets/branding/icon.png` | `jango-icon-crop` | iOS/Android 앱 아이콘 (불투명 `#F1F3F5`) |
| `assets/branding/adaptive-icon.png` | `jango-icon-crop` | Android adaptive foreground (투명) |
| `assets/branding/monochrome-icon.png` | `adaptive-icon` 알파 | Android 13+ 테마 아이콘 (순백 단색·투명) |
| `assets/branding/splash-icon.png` | `icon.png` 라운드 파생 | Expo splash용 88pt 소형 앱 아이콘 |
| `assets/branding/notification-icon-192.png` | `jango-idle` 실루엣 마스터 | 알림용 고해상 실루엣 |
| `assets/branding/notification-icon.png` | 192→96 다운스케일 | Android 알림 아이콘 |
| `ios/.../AppIcon.appiconset/` | icon 동기화 | native App Icon |
| `ios/.../SplashScreenLogo.imageset/` | splash 동기화 | native splash |

알림 아이콘은 `jango-idle` 전신 알파 바운드의 상단 70%에서 **요리사 모자와 냉장고 머리 실루엣만** 결정적으로 파생한다. 192px 마스터에서 96px 배포본을 만들며, 흰색과 완전 투명 픽셀만 사용한다. 전체 실루엣은 캔버스 높이의 74~82%, 너비의 60~70%를 채워 24dp에서도 식별 가능해야 한다. 전신·다리·앞치마를 축소해 넣거나 생성형 모델로 윤곽을 다시 그리지 않는다.

초기 로드는 캐릭터가 설명하는 제품 상태가 아니므로 장고 말풍선을 사용하지 않는다. 네이티브 splash는 `#F1F3F5` 배경 중앙에 88pt 소형 앱 아이콘만 표시하고, 앱 내부에서 로드가 이어지면 홈 구조 스켈레톤으로 전환한다.

Android 테마 아이콘은 승인된 `adaptive-icon.png`의 알파 채널을 그대로 복사한다. RGB는 순백으로 고정하고 OS가 배경화면과 테마에 맞춰 색을 입히도록 하며, 포즈·비율·안전 영역을 별도로 재해석하지 않는다.

스토어 대표 이미지 역시 `jango-idle`의 플랫 2D 언어를 따른다.

| 파일 | 역할 |
| --- | --- |
| `assets/store/google-play-feature-graphic.png` | Google Play 공식 2D 피처 그래픽. 실제 Pretendard와 `jango-idle` 원본을 합성한 1024×500 불투명 PNG |
| `assets/store/jango-appstore-space-copy-ko-1242x2688.png` | App Store 공식 2D 세로 캠페인 이미지 |

스토어 이미지에서도 장고만 2D로 두고 배경을 3D 또는 실사로 합성하지 않는다. 배경은 캐릭터와 같은 차콜 외곽선, 제한된 면색, 1단 이하의 그림자를 사용한다.
Google Play 공식 파일 검수: `pnpm --filter @expirymate/mobile store:sync` / `store:audit`.

`app.json`의 `expo-notifications.icon` / `color`(`#10B981`)가 `notification-icon.png`를 가리킨다.  
mood / icon-crop를 바꾼 뒤에는 **반드시 `branding:sync`** 후 native/EAS 빌드로 확인.
아이콘 자동 검수: `pnpm --filter @expirymate/mobile branding:audit` — 1024px RGBA 소스, 투명 모서리, 양손 균형, iOS 인셋, Android adaptive safe zone, native iOS 동기화를 검사한다.

### 기술

- 포맷: **PNG · RGBA · 투명 배경**
- 소스 마스터 캔버스: **1024×1024**
- 앱 표시: `Mascot` → `Image` `resizeMode="contain"`
- 검수 크기: **64px / 120px**에서도 실루엣·표정이 읽혀야 함

### 런타임 밀도 에셋

재생성: `pnpm --filter @expirymate/mobile mascot:build`

| 구분 | 1x | 2x | 3x | 경로 |
| --- | ---: | ---: | ---: | --- |
| 전신 (`medium`·`large`) | 160px | 320px | 480px | `assets/characters/runtime/full/` |
| 상반신 (`small`) | 72px | 144px | 216px | `assets/characters/runtime/small/` |

- `runtime/` 파일은 직접 편집하지 않고 1024px 마스터를 수정한 뒤 재생성한다.
- 기본 파일과 같은 폴더의 `@2x`·`@3x` 형식으로 두어 Metro가 기기 픽셀 밀도에 맞는 파일을 선택하게 한다.
- 파생 시 캔버스 좌표를 유지해 mood 간 앵커·기준선이 흔들리지 않게 한다.
- 프리멀티플라이드 알파 영역 필터를 사용해 투명 경계의 흰색/검은색 번짐과 계단 현상을 줄인다.

### 배경 처리 (필수)

생성 모델이 흰 배경을 넣는 경우가 많다. 장고 몸도 흰색이므로 **단순 흰색 키잉 금지** (몸통이 뚫림).

권장:

1. 모서리에서 시작하는 **flood-fill**로 외곽에 연결된 배경만 투명화
2. 아웃라인 안쪽 흰색(몸·모자·앞치마)은 불투명 유지
3. 납품 전 `hasAlpha: yes`, 모서리 알파 `0` 확인

체크무늬가 실제 픽셀로 생성된 경우 이미지 생성 도구의 `background-extraction` 단계로 외곽만 다시 제거한다. 비정사각형 투명 결과는 리사이즈 후 `scripts/pad-transparent-square.mjs`로 중앙 정렬한다.

---

## 8. 앱 사용 규칙

- 화면에서 PNG를 직접 import하지 말고 **`Mascot`만** 사용
- **한 화면(또는 한 카드/시트) = mood 1개**
- empty / 성공 / 경고 상태에서는 가능하면 Lucide만 두지 말고 `Mascot`를 주 비주얼로
- 테두리 카드 프레임 안에 가두지 말고, 화면/시트 배경 위에 앉힌다
- 사이즈: 온보딩·풀 empty → `large` / 카드 히어로 → `medium` / 인라인·시트 → `small` (소형 상반신 에셋 자동 적용)
- 장고 아래(또는 옆) **주 CTA 1개**
- 사용자 문구는 대화형 한국어. 시스템 언어(“저장”, “오류”) 금지 → `.cursor/rules/mobile-ux.mdc` UX 라이팅 따름

---

## 9. 금지사항

1. 3D·클레이·비닐·과도한 글로스 렌더
2. 투도어 / 냉동실 가로 분할
3. 파인애플이 아닌 시그니처 자석
4. 유리알 눈·핑크 볼터치·하트눈
5. 검정 막대팔 / 사람 손가락
6. 파란 Primary·임의 네온·메탈릭 그라데이션
7. 불투명 흰 사각 배경으로 앱에 넣기
8. mood와 무관한 장식용 장고 난립
9. 사용자 문구에 `ExpiryMate` 등 구 브랜드명
10. 에셋에 반짝이·별·말풍선·냄비 풀세트 과다 연출

---

## 10. 신규 에셋 제작 체크리스트

- [ ] `jango-idle`과 같은 통통한 싱글도어 비례인가?
- [ ] 문(머리)이 가장 큰 덩어리이며 하단 몸통 높이가 문 높이의 80% 이하인가?
- [ ] 파인애플 자석 + 손잡이 왼쪽 + 경첩 2개 오른쪽인가?
- [ ] 플랫 2D + 손맛 선인가? (3D 토이 룩 아닌가?)
- [ ] 팔레트가 White / Mint / Charcoal 위주인가?
- [ ] mood에 맞는 얼굴·포즈인가? (의상은 동일한가?)
- [ ] 소형 에셋이 전신 마스터의 고정 크롭 파생본이며 outline·mint·alpha·전체 픽셀 mismatch가 모두 0인가?
- [ ] **투명 배경 PNG**인가?
- [ ] 64px에서도 “모자 쓴 냉장고”로 읽히는가?
- [ ] `Mascot` mood 키와 파일명이 일치하는가?

---

## 11. 관련 코드·토큰

| 대상 | 위치 |
| --- | --- |
| 마스코트 컴포넌트 | `apps/mobile/src/components/Mascot.tsx` |
| 브랜드 표시명 | `packages/shared/src/constants/brand.ts` → `appBrand` |
| 색 토큰 | `packages/shared/src/design/tokens.ts` → `semanticColors` |
| 모바일 UX 규칙 | `.cursor/rules/mobile-ux.mdc` |
| 프로젝트 현황 | [`PROJECT.md`](./PROJECT.md) |
