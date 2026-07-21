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
| 비례·파츠 마스터 (원형) | `apps/mobile/assets/characters/mate-fridge-chef.png` |
| 앱 사용 에셋 (mood) | `apps/mobile/assets/characters/jango-{mood}.png` |
| 기본 포즈 기준 | `jango-idle.png` (= `jango.png`) |

원형(`mate-fridge-chef`)의 **통통한 싱글도어 비율·파츠 구성**을 유지하고, 렌더는 플랫 2D로 통일한다.

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

---

## 5. 색 (Color)

캐릭터 팔레트는 **6색 이내**. UI 토큰과 맞춘다.

| 역할 | hex | 토큰 / 비고 |
| --- | --- | --- |
| Body White | `#FFFFFF` | `surface` / `neutral.0` |
| Soft Shadow | `#E8ECF0` ~ `#F1F3F5` | 셀 셰도우 1단. `background`/`neutral.100` 부근 |
| Mint | `#10B981` | `primary` / `brand.500` |
| Mint Soft | `#D1FAE5` | `primarySoft` / `brand.100` — 볼터치·땀방울 |
| Charcoal | `#1A1F27` | `text` / `neutral.900` — 선·눈·입 |
| Warm Wood | `#C4A574` | **cooking 소품만**. UI primary로 쓰지 않음 |
| Pineapple | 노랑 + 초록 | 자석 전용 악센트 |

### 칠하기

- Base → Soft Shadow → (필요 시) Mint Soft 포인트
- 그라데이션·메탈릭 실버 그라데이션·서브서피스 금지
- 경첩은 플랫 회색 1색
- 표정마다 몸통 색을 바꾸지 않음 (걱정이어도 회색 바디 X)
- Primary로 파란 계열 사용 금지

---

## 6. Mood · 포즈

앱 `MascotMood`: `idle` | `happy` | `worry` | `cooking` | `empty`

| mood | 얼굴 | 포즈 | 앱에서 쓸 때 | 카피 톤 예 |
| --- | --- | --- | --- | --- |
| `idle` | 점/타원 눈 + 부드러운 미소 | 팔 살짝 벌린 환영 포즈, 미세한 무게 이동 | 온보딩·기본 안내 | 오늘도 냉장고 잘 지켜볼게요 |
| `happy` | 휘어진 눈 + 열린 입 + 볼터치 optional | 한 팔 흔들기 등 | 등록/저장 성공 | 냉장고에 잘 넣어뒀어요 |
| `worry` | 눈썹 안쪽 올림 + 물결 입 + 땀 1방울 ok | 살짝 움츠림, 장갑이 볼 근처 | 임박·만료·삭제 확인 | 이 재료, 곧 써야 해요 |
| `cooking` | 살짝 치켜올린 눈썹 + 집중 미소 | 나무 거품기 **1개만** | 레시피 추천·생성 | 지금 있는 재료로 이 요리 어때요? |
| `empty` | 처진 눈 + 작은 입 (하이라이트 과다 금지) | 어깨 처짐, 시선 아래 | 빈 목록/추천 | 아직 비어 있어요. 하나 넣어볼까요? |

### 포즈 공통 규칙

- 풀바디, 캐릭터가 프레임의 **80~90%**
- **완전 대칭 정면 T포즈 금지.** 미세 3/4 또는 무게중심 비대칭
- 한 장에 행동 하나. 소품은 `cooking`만
- 냉장고 문을 열어 내부를 보여 주지 않음
- 별·하트·연기·말풍선 등 이펙트를 에셋에 넣지 않음
- 의상/모자는 mood마다 바꾸지 않음 — **얼굴·포즈만 변경**

---

## 7. 에셋 스펙

### 파일 (인앱 mood)

| 파일 | 용도 |
| --- | --- |
| `jango-idle.png` | 기본 · **풀바디 마스터** (splash·알림 실루엣 원본) |
| `jango-happy.png` | 기쁨 (idle 파츠 고정, 얼굴·포즈만) |
| `jango-worry.png` | 걱정 |
| `jango-cooking.png` | 요리 |
| `jango-empty.png` | 빈 상태 |
| `jango.png` | idle과 동일 마스터 카피 |
| `jango-icon-crop.png` | **아이콘 전용 포즈** (idle 마스터·윙크+엄지척, 투명 PNG). `branding:sync`가 `#F1F3F5` 불투명 `icon.png`로 합성 |
| `mate-fridge-chef.png` | 비례 레퍼런스 (앱 mood로 직접 쓰지 않음) |

경로: `apps/mobile/assets/characters/`

### 브랜딩 / 스토어 / 알림

재생성: `pnpm --filter @expirymate/mobile branding:sync`

| 파일 | 원본 | 용도 |
| --- | --- | --- |
| `assets/branding/icon.png` | `jango-icon-crop` | iOS/Android 앱 아이콘 (불투명 `#F1F3F5`) |
| `assets/branding/adaptive-icon.png` | `jango-icon-crop` | Android adaptive foreground (투명) |
| `assets/branding/splash-icon.png` | `jango-idle` | Expo splash |
| `assets/branding/notification-icon-192.png` | `jango-idle` 실루엣 마스터 | 알림용 고해상 실루엣 |
| `assets/branding/notification-icon.png` | 192→96 다운스케일 | Android 알림 아이콘 |
| `ios/.../AppIcon.appiconset/` | icon 동기화 | native App Icon |
| `ios/.../SplashScreenLogo.imageset/` | splash 동기화 | native splash |

`app.json`의 `expo-notifications.icon` / `color`(`#10B981`)가 `notification-icon.png`를 가리킨다.  
mood / icon-crop를 바꾼 뒤에는 **반드시 `branding:sync`** 후 native/EAS 빌드로 확인.

### 기술

- 포맷: **PNG · RGBA · 투명 배경**
- 권장 캔버스: **1024×1024**
- 앱 표시: `Mascot` → `Image` `resizeMode="contain"`
- 검수 크기: **64px / 120px**에서도 실루엣·표정이 읽혀야 함

### 배경 처리 (필수)

생성 모델이 흰 배경을 넣는 경우가 많다. 장고 몸도 흰색이므로 **단순 흰색 키잉 금지** (몸통이 뚫림).

권장:

1. 모서리에서 시작하는 **flood-fill**로 외곽에 연결된 배경만 투명화
2. 아웃라인 안쪽 흰색(몸·모자·앞치마)은 불투명 유지
3. 납품 전 `hasAlpha: yes`, 모서리 알파 `0` 확인

---

## 8. 앱 사용 규칙

- 화면에서 PNG를 직접 import하지 말고 **`Mascot`만** 사용
- **한 화면(또는 한 카드/시트) = mood 1개**
- empty / 성공 / 경고 상태에서는 가능하면 Lucide만 두지 말고 `Mascot`를 주 비주얼로
- 테두리 카드 프레임 안에 가두지 말고, 화면/시트 배경 위에 앉힌다
- 사이즈: 온보딩·풀 empty → `large` / 카드 히어로 → `medium` / 인라인·시트 → `small`
- 장고 아래(또는 옆) **주 CTA 1개**
- 사용자 문구는 대화형 한국어. 시스템 언어(“저장”, “오류”) 금지 → `.cursorrules` UX 라이팅 따름

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

- [ ] `mate-fridge-chef` 비례와 같은 통통한 싱글도어인가?
- [ ] 파인애플 자석 + 손잡이 왼쪽 + 경첩 2개 오른쪽인가?
- [ ] 플랫 2D + 손맛 선인가? (3D 토이 룩 아닌가?)
- [ ] 팔레트가 White / Mint / Charcoal 위주인가?
- [ ] mood에 맞는 얼굴·포즈인가? (의상은 동일한가?)
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
| 모바일 UX 규칙 | `.cursorrules` |
| 프로젝트 현황 | [`PROJECT.md`](./PROJECT.md) |
