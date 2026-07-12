# 장고야 부탁해 (Jango) · 모바일 UI/UX 리디자인 지시 템플릿

`.cursorrules`와 `@expirymate/shared` 디자인 토큰을 기준으로 화면별 리디자인을 진행할 때 Cursor에 붙여 넣는 프롬프트 모음이다.

브랜드 표시명: **장고야 부탁해** (EN: **Jango**)  
캐릭터: **장고** (EN: **Jango**) — `@expirymate/shared`의 `appBrand`와 `apps/mobile/src/components/Mascot.tsx`를 단일 기준으로 쓴다.

## 사용 방법

1. **한 채팅 = 한 템플릿**으로 실행한다.
2. 각 템플릿 앞에 [공통 프롬프트 머리말](#0-공통-프롬프트-머리말-매번-붙이기)을 붙인다.
3. 권장 순서(1 → 14)대로 진행한다.
4. 범위 밖으로 나가면 다음처럼 후속 지시한다.

```text
범위 밖으로 나가지 말고, 방금 작업한 파일만 이어서 수정해줘.
```

## 실행 순서 요약

| 순서 | 템플릿           | 핵심 파일                                                           | 장고 포인트                          |
| ---- | ---------------- | ------------------------------------------------------------------- | ------------------------------------ |
| 1    | 공통 컴포넌트    | `apps/mobile/src/components/*`                                      | `Mascot` mood / EmptyState 연동      |
| 2    | BottomSheet/Step | `apps/mobile/src/components/` 신규                                  | 시트 상단·성공 피드백에 장고         |
| 3    | 재료 등록        | `apps/mobile/app/register.tsx`                                      | 성공 `happy`, empty `empty`          |
| 4    | 홈               | `apps/mobile/app/(tabs)/home.tsx`                                   | focus mood + 섹션 empty에 장고       |
| 5    | 재고 목록        | `apps/mobile/app/(tabs)/inventory.tsx`                              | 목록 empty `empty`                   |
| 6    | 재고 상세        | `apps/mobile/app/inventory/[id].tsx`                                | 삭제 확인 `worry`, 저장 성공 `happy` |
| 7    | 스캐너           | `apps/mobile/app/scanner.tsx`, `apps/mobile/src/features/scanner/*` | 결과 시트 성공/실패 표정             |
| 8    | 추천             | `apps/mobile/app/(tabs)/recommendations.tsx`                        | cooking / happy / empty              |
| 9    | 설정             | `apps/mobile/app/(tabs)/settings.tsx`                               | 앱 정보에 장고·브랜드명              |
| 10   | 온보딩           | `apps/mobile/app/index.tsx`, `apps/mobile/app/onboarding.tsx`       | 히어로 장고 + 브랜드명               |
| 11   | 인증             | `apps/mobile/app/auth/*`                                            | 로그인/가입 상단 idle (선택)         |
| 12   | 개인정보         | `apps/mobile/app/privacy/*`                                         | 문구에 앱명, 삭제 확인 `worry`       |
| 13   | 문구 전수        | mobile 전체 copy                                                    | 장고가 말하는 톤                     |
| 14   | Admin            | `apps/admin/*`                                                      | `appBrand` 표시명 동기화             |

---

## 장고 캐릭터 가이드 (모든 템플릿 공통)

### 정체성

- 장고는 **냉장고 셰프 메이트**다. 잔소리보다 먼저 손을 내민다.
- 사용자 문구는 장고가 옆에서 말하는 듯한 **대화형 한국어**로 쓴다.
- 표시명은 하드코딩하지 말고 `appBrand` (`appNameKo`, `characterNameKo` 등)를 쓴다.
- 에셋 경로: `apps/mobile/assets/characters/jango-{idle,happy,worry,cooking,empty}.png`
- 컴포넌트: `apps/mobile/src/components/Mascot.tsx` — `mood` / `size` prop만 사용한다. 화면에서 PNG를 직접 import하지 않는다.

### mood 매핑

| mood      | 언제 쓰나                     | 카피 톤 예                         |
| --------- | ----------------------------- | ---------------------------------- |
| `idle`    | 온보딩, 기본 안내, 설정 소개  | 오늘도 냉장고 잘 지켜볼게요        |
| `happy`   | 등록/저장 성공, 추천 완료     | 냉장고에 잘 넣어뒀어요             |
| `worry`   | 임박·만료, 삭제/위험 확인     | 이 재료, 곧 써야 해요              |
| `cooking` | 레시피 추천·생성 중           | 지금 있는 재료로 이 요리 어때요?   |
| `empty`   | 재고/목록/추천이 비어 있을 때 | 아직 비어 있어요. 하나 넣어볼까요? |

### 배치 규칙

- **한 화면(또는 한 카드/시트) = 장고 표정 1개.** 여러 mood를 동시에 두지 않는다.
- empty / 성공 / 경고 상태에는 Lucide 아이콘만 두지 말고, 가능하면 **`Mascot`를 주 비주얼**로 쓴다. (`EmptyState`의 `accessory` 또는 전용 슬롯)
- 프레임 박스(테두리 카드) 안에 가두지 말고, 배경 위에 캐릭터가 앉게 한다. (`Mascot` 기본 스타일 유지)
- 사이즈: 온보딩·풀 empty `large` / 카드 히어로 `medium` / 인라인·시트 상단 `small`
- 장고 아래(또는 옆)에는 **주 CTA 1개**만 둔다.
- 기능/API/상태관리/비즈니스 로직은 바꾸지 않는다. UI·카피·배치만.

### 금지

- `ExpiryMate` 등 구 브랜드명을 사용자 문구에 쓰지 말 것 (`appBrand` 사용)
- 캐릭터 PNG raw hex 배경·임의 크롭 프레임 추가 금지
- mood와 무관한 장식용 장고 난립 금지

---

## 0. 공통 프롬프트 머리말 (매번 붙이기)

```text
반드시 .cursorrules를 따를 것.
색상/간격/라운드/타이포는 @expirymate/shared 디자인 토큰만 사용할 것.
raw hex, off-grid spacing, 48px 미만 터치 타깃 금지.
버튼 radius 16, 카드/시트 radius 24.
화면당 주 CTA 1개.
사용자 문구는 자연스러운 한국어 대화체.
브랜드/캐릭터 표시는 @expirymate/shared의 appBrand와 Mascot(mood)만 사용할 것.
앱명: 장고야 부탁해 (Jango), 캐릭터: 장고.
empty·성공·경고·추천 상태에는 장고 mood를 녹여 낼 것 (한 블록당 mood 1개).
기능/API/상태관리/비즈니스 로직은 변경하지 말 것.
완료 후 typecheck와 lint 확인할 것.
```

---

## 1. 공통 컴포넌트 기반 정리 ✅

```text
장고야 부탁해 모바일 공통 UI 기반을 .cursorrules와 @expirymate/shared 디자인 토큰 기준으로 정리해줘.

범위:
- apps/mobile/src/components/Screen.tsx
- apps/mobile/src/components/Button.tsx
- apps/mobile/src/components/FormField.tsx
- apps/mobile/src/components/Pill.tsx
- apps/mobile/src/components/InventoryCard.tsx
- apps/mobile/src/components/StatCard.tsx
- apps/mobile/src/components/DatePickerField.tsx
- apps/mobile/src/components/QuantityStepper.tsx
- apps/mobile/src/components/Mascot.tsx
- apps/mobile/src/components/EmptyState.tsx
- apps/mobile/src/shared/theme.ts
- packages/shared/src/constants/brand.ts (읽기만)

요구사항:
- raw hex / 매직 spacing / 임의 borderRadius 제거
- Screen 기본 좌우 패딩 24px
- Button 최소 높이 48~56px, radius 16
- InventoryCard / StatCard radius 24
- FormField / DatePickerField / QuantityStepper 터치 영역 48px 이상
- Mascot는 mood(idle|happy|worry|cooking|empty) + size를 지원하고 jango-*.png만 사용
- EmptyState는 선택적으로 Mascot(mood)를 주 비주얼로 받을 수 있게 할 것 (아이콘만인 empty 지양)
- 기능 변경 없이 스타일/표현만 수정

완료 기준:
- 공통 컴포넌트가 토큰만 사용
- Mascot/EmptyState가 장고 연동 가능
- typecheck/lint 통과
- 후속 화면 리디자인에 재사용할 수 있는 상태
```

### 1~4 완료분 보완 메모 (장고)

| 템플릿 | 상태    | 내용                                                     |
| ------ | ------- | -------------------------------------------------------- |
| 1 공통 | ✅ 보완 | `EmptyState`에 `mood` 슬롯, `BottomSheet`에 `mascotMood` |
| 2 시트 | ✅ 보완 | 시트 헤더에 장고 선택 표시 가능                          |
| 3 등록 | ✅ 보완 | 성공 `happy`, 템플릿 empty `empty`, 추가정보 시트 `idle` |
| 4 홈   | ✅ 보완 | focus mood + 섹션 EmptyState 장고 연동                   |

---

## 2. BottomSheet + Step 시스템 추가 ✅

```text
.cursorrules의 One Thing Per Page 원칙에 맞는 BottomSheet + Step 컨테이너를 mobile 공통 컴포넌트로 추가해줘.

범위:
- apps/mobile/src/components/ 아래에 새 컴포넌트 추가
  예: BottomSheet.tsx, StepFlow.tsx, EmptyState.tsx, SectionHeader.tsx
- 필요 시 apps/mobile/src/shared/theme.ts
- apps/mobile/src/components/Mascot.tsx (재사용)

요구사항:
- Spring 애니메이션
- 진행 상태 표시 (n/m)
- 뒤로가기 항상 가능
- 토큰만 사용
- 카드/시트 radius 24
- BottomSheet 헤더/성공 영역에 Mascot(mood)를 선택적으로 둘 수 있게 할 것
- 이번 작업에서는 새 컴포넌트만 만들고, 기존 화면 전체 마이그레이션은 하지 말 것
- 사용 예시는 apps/mobile/app/register.tsx에만 최소 적용

완료 기준:
- 재사용 가능한 BottomSheet/Step 컴포넌트 존재
- register.tsx에 최소 1개 플로우 적용
- 장고를 시트에 붙일 수 있는 prop/슬롯이 있음
- typecheck/lint 통과
```

---

## 3. 재료 등록 표준 화면 (`register.tsx`) ✅

```text
apps/mobile/app/register.tsx 를 .cursorrules 기준의 표준 입력 플로우로 리디자인해줘.

범위:
- apps/mobile/app/register.tsx
- apps/mobile/src/features/registration/use-save-inventory-item.ts (읽기만, 로직 변경 금지)
- apps/mobile/src/components/* (재사용, Mascot/EmptyState 포함)

요구사항:
- 긴 폼을 Step으로 분리
  예: 1) 재료명 2) 보관 위치/수량 3) 유통기한 확인
- 각 단계는 한 결정만
- 주 CTA 1개
- 시스템 문구를 대화형으로 변경
  예: "저장" → "여기에 보관할까요?"
- 등록 성공 피드백에 장고 mood="happy" (장고가 말하는 톤의 성공 문구)
- 불러올 재료가 없을 때 EmptyState + mood="empty"
- 기존 API payload / mutation 유지
- BottomSheet/Step 공통 컴포넌트 재사용

완료 기준:
- 3단계 이상 Step UI
- 성공/empty에 장고가 보임
- 토큰만 사용
- typecheck/lint 통과
```

---

## 4. 홈 탭 ✅

```text
apps/mobile/app/(tabs)/home.tsx 를 .cursorrules 기준으로 UI/UX만 리디자인해줘.

범위:
- apps/mobile/app/(tabs)/home.tsx
- apps/mobile/src/components/StatCard.tsx
- apps/mobile/src/components/InventoryCard.tsx
- apps/mobile/src/components/Mascot.tsx
- apps/mobile/src/components/EmptyState.tsx
- apps/mobile/src/features/dashboard/use-dashboard-summary.ts (읽기만)

요구사항:
- 첫 화면에서 "지금 해야 할 한 가지"가 보이게
- 임박/만료는 danger 토큰, 안전은 primary/success 토큰
- focus 카드 장고 mood:
  - 임박/주의 → worry
  - 재고 없음 → empty
  - 그 외 → idle
- 섹션 empty(임박 목록/최근 재료)도 Lucide만 쓰지 말고 장고 empty 또는 idle을 함께 쓸 것
- empty state·CTA 문구는 장고가 말하는 대화형 한국어
- 주 CTA 1개 (예: 재료 추가 / 임박 재료 보기)
- 데이터 fetch/로직 변경 금지

완료 기준:
- 홈이 한 눈에 읽히는 구성
- focus + empty에 장고 mood가 일치
- 토큰/터치 규칙 준수
- typecheck/lint 통과
```

---

## 5. 재고 목록 탭 ✅

```text
apps/mobile/app/(tabs)/inventory.tsx 를 .cursorrules 기준으로 UI/UX만 리디자인해줘.

범위:
- apps/mobile/app/(tabs)/inventory.tsx
- apps/mobile/src/components/InventoryCard.tsx
- apps/mobile/src/components/Pill.tsx
- apps/mobile/src/components/Mascot.tsx
- apps/mobile/src/components/EmptyState.tsx
- apps/mobile/src/features/inventory/use-inventory-list.ts (읽기만)
- apps/mobile/src/features/inventory/filters.ts (필요 시 UI만 연결)

요구사항:
- 필터/정렬/일괄 정리는 BottomSheet로 분리
- 리스트 행 터치 높이 48px 이상
- 스와이프 삭제/정리 문구를 대화형으로
- 목록이 비면 중앙에 장고 mood="empty" + CTA 1개 ("재료 넣으러 가기")
- 화면 본문에는 목록 + 주 CTA만
- 비즈니스 로직/필터 로직 변경 금지

완료 기준:
- 필터 UI가 시트화됨
- empty에 장고가 보임
- 토큰/터치 규칙 준수
- typecheck/lint 통과
```

---

## 6. 재고 상세 ✅

```text
apps/mobile/app/inventory/[id].tsx 를 register.tsx와 같은 Step/BottomSheet 패턴으로 맞춰 리디자인해줘.

범위:
- apps/mobile/app/inventory/[id].tsx
- apps/mobile/src/components/FormField.tsx
- apps/mobile/src/components/DatePickerField.tsx
- apps/mobile/src/components/QuantityStepper.tsx
- apps/mobile/src/components/Mascot.tsx
- apps/mobile/src/features/inventory/use-discard-inventory-item.ts (읽기만)

요구사항:
- 상세 보기와 편집을 분리
- 편집은 BottomSheet 또는 Step으로
- 삭제/정리 확인 시트 상단에 장고 mood="worry" + 대화형 확인 문구
- 저장/정리 성공 피드백에 mood="happy"
- 주 CTA 1개
- API/mutation 유지

완료 기준:
- 한 화면에 입력 폼이 과다하게 나열되지 않음
- 위험/성공 피드백에 장고 mood가 맞음
- typecheck/lint 통과
```

---

## 7. 스캐너 ✅

```text
스캐너 화면을 .cursorrules 기준으로 UI/UX만 리디자인해줘.

범위:
- apps/mobile/app/scanner.tsx
- apps/mobile/src/features/scanner/ScannerScreen.tsx
- apps/mobile/src/features/scanner/useProductScanner.ts (읽기만)
- apps/mobile/src/features/scanner/parseExpirationDate.ts (읽기만)
- apps/mobile/src/components/Mascot.tsx

요구사항:
- 카메라 화면은 "한 가지 행동"에 집중
- 인식 결과 확인은 BottomSheet로
- 결과 시트: 성공 happy(또는 idle), 실패/못 찾음 worry — 과장된 연출 금지
- OCR은 미래 기능이므로 ocr_detected 예약만 유지, 과장된 OCR UX 추가 금지
- 성공/실패 문구를 대화형으로 (장고 톤)
- 스캔 로직 변경 금지

완료 기준:
- 결과 확인 시트 분리 + 장고 mood
- typecheck/lint 통과
```

---

## 8. 레시피 추천 탭 ✅

```text
apps/mobile/app/(tabs)/recommendations.tsx 를 .cursorrules 기준으로 UI/UX만 리디자인해줘.

범위:
- apps/mobile/app/(tabs)/recommendations.tsx
- apps/mobile/src/components/Mascot.tsx
- apps/mobile/src/features/recipes/use-recipe-recommendations.ts (읽기만)
- apps/mobile/src/features/recipes/recipe-generation-provider.tsx (읽기만)
- apps/mobile/src/features/subscriptions/use-subscription-entitlement.ts (읽기만)

요구사항:
- 생성 중 / 결과 / 한도 초과 / empty state를 명확히 분리
- 장고 mood:
  - 히어로·생성 중 → cooking
  - 추천 준비 완료 → happy
  - 결과 없음 → empty
  - 한도/구독 안내 → idle 또는 worry (과하지 않게)
- 주 CTA 1개 (예: 추천 받기)
- 구독/한도 안내는 대화형 한국어
- 생성 API/캐시/쿼터 로직 변경 금지

완료 기준:
- 상태별 UI가 친절하고 단순함
- 상태별 장고 mood가 일치
- typecheck/lint 통과
```

---

## 9. 설정 탭 ✅

```text
apps/mobile/app/(tabs)/settings.tsx 를 .cursorrules 기준으로 UI/UX만 리디자인해줘.

범위:
- apps/mobile/app/(tabs)/settings.tsx
- apps/mobile/app/(tabs)/_layout.tsx (탭 라벨/아이콘 톤만, 필요 시)
- apps/mobile/src/features/settings/use-notification-preferences.ts (읽기만)
- apps/mobile/src/features/auth/use-auth.ts (읽기만)
- packages/shared/src/constants/brand.ts (읽기만)

요구사항:
- 설정 항목은 ListRow 스타일, 터치 높이 48px 이상
- 알림 설정 변경은 즉시 반영 UX 유지하되 문구만 대화형
- 앱 정보 영역에 appBrand.appNameKo / appNameEn 표시 (ExpiryMate 금지)
- 선택: 작은 장고 idle을 앱 정보 근처에 두어 브랜드 리마인더
- 계정/개인정보/구독 진입점을 명확히
- 설정 API 로직 변경 금지

완료 기준:
- 설정 화면이 읽기 쉽고 터치하기 쉬움
- 브랜드명이 장고야 부탁해로 통일
- typecheck/lint 통과
```

---

## 10. 온보딩 + 진입 화면 ✅

```text
온보딩/진입 화면을 .cursorrules 기준으로 UI/UX만 리디자인해줘.

범위:
- apps/mobile/app/index.tsx
- apps/mobile/app/onboarding.tsx
- apps/mobile/app/_layout.tsx (테마/네비게이션 톤만, 필요 시)
- apps/mobile/src/components/Mascot.tsx
- packages/shared/src/constants/brand.ts (읽기만)

요구사항:
- 온보딩은 Step 슬라이드
- 한 화면 = 한 메시지 + 한 CTA
- 첫 뷰포트에 브랜드(장고야 부탁해) + 장고(large, idle→happy)가 히어로로 보이게
- 카피는 장고가 소개하는 톤 ("장고에게 냉장고를 맡겨볼까요?" 등)
- appBrand로 표시명 참조
- 라우팅/세션 분기 로직 변경 금지

완료 기준:
- 온보딩이 3~4 step 이내로 단순
- 브랜드·장고가 첫인상에서 약하지 않음
- typecheck/lint 통과
```

---

## 11. 인증 화면군

```text
인증 화면군을 .cursorrules 기준으로 UI/UX만 리디자인해줘. ✅

범위:
- apps/mobile/app/auth/login.tsx
- apps/mobile/app/auth/register.tsx
- apps/mobile/app/auth/verify-email.tsx
- apps/mobile/app/auth/forgot-password.tsx
- apps/mobile/app/auth/reset-password.tsx
- apps/mobile/src/features/auth/use-auth.ts (읽기만)
- apps/mobile/src/components/Mascot.tsx (선택)

요구사항:
- 한 화면에 입력 필드 과다 나열 금지
- 긴 가입 플로우는 Step으로 분리
- 에러/성공 문구를 대화형으로
  예: "오류" → "앗, 잠시 문제가 생겼어요"
- 로그인 상단에 작은 장고 idle + appBrand.appNameKo 배지 (선택, 과하지 않게)
- OAuth/세션/토큰 로직 변경 금지

완료 기준:
- auth 화면 톤 통일
- typecheck/lint 통과
```

---

## 12. 개인정보/계정 삭제 ✅

```text
개인정보 관련 화면을 .cursorrules 기준으로 UI/UX만 리디자인해줘.

범위:
- apps/mobile/app/privacy/index.tsx
- apps/mobile/app/privacy/ai-data-notice.tsx
- apps/mobile/app/privacy/account-delete.tsx
- apps/mobile/src/features/privacy/use-privacy.ts (읽기만)
- packages/shared/src/constants/brand.ts (읽기만)

요구사항:
- 설명은 짧고 친절하게
- 사용자 문구의 앱명은 appBrand.appNameKo (ExpiryMate 금지)
- 계정 삭제는 실수 방지 UX + 대화형 확인 문구 + 장고 mood="worry"
- 법적 고지 내용은 의미 변경 없이 가독성만 개선
- privacy API 로직 변경 금지

완료 기준:
- 삭제 플로우가 명확하고 무섭지 않음
- 브랜드명·장고 톤 일치
- typecheck/lint 통과
```

---

## 13. UX 라이팅 전수 정리 ✅

```text
mobile 앱의 사용자 노출 문구를 .cursorrules UX 라이팅 규칙과 장고 톤에 맞게 전수 점검해줘.

범위:
- apps/mobile/app/**/*.tsx
- apps/mobile/src/components/**/*.tsx
- apps/mobile/src/features/**/*.tsx

요구사항:
- "저장", "오류", "실패", "확인", "삭제", "제출" 같은 시스템 언어를 대화형으로 변경
- empty state / toast / alert / button label 포함
- ExpiryMate → appBrand.appNameKo (장고야 부탁해)
- 가능하면 장고가 말하는 1인칭/옆자리 톤 ("잘 넣어뒀어요", "곧 써야 해요")
- 코드 식별자, API 키, 서버 에러 코드, 테스트 assertion 문자열은 불필요하게 바꾸지 말 것
- UI copy만 수정

완료 기준:
- 주요 사용자 문구가 대화형 한국어·장고 톤으로 통일
- typecheck/lint 통과
- 변경된 문구 목록을 짧게 요약
```

---

## 14. Admin 동기화 (마지막)

```text
apps/admin UI를 shared 디자인 토큰과 globals.css 변수 기준으로 정리해줘. ✅

범위:
- apps/admin/app/globals.css
- apps/admin/src/components/app-shell.tsx
- apps/admin/src/components/page-header.tsx
- apps/admin/src/components/panel.tsx
- apps/admin/src/components/metric-card.tsx
- apps/admin/src/components/status-pill.tsx
- apps/admin/src/features/**/*.tsx
- apps/admin/app/**/*.tsx
- packages/shared/src/constants/brand.ts (읽기만)

요구사항:
- 하드코딩 hex 제거
- mobile과 같은 primary/danger/surface 톤
- 관리자 표시명은 appBrand.appNameKo + " Admin" (ExpiryMate Admin 금지)
- 기능 변경 없이 스타일·브랜드 표시만
- CSS 변수는 @expirymate/shared cssVariables와 동기화 유지

완료 기준:
- admin이 장고야 부탁해(Jango) 브랜드 톤과 일치
- typecheck/lint 통과
```

---

## 화면별 체크리스트

리디자인 PR마다 아래를 확인한다.

- [ ] 좌우 패딩 24px
- [ ] spacing이 8의 배수
- [ ] 버튼 높이 48px 이상
- [ ] 카드/시트 radius 24px
- [ ] primary가 민트 `#10B981` 계열
- [ ] 임박/만료가 danger `#EF4444` 계열
- [ ] 제목/본문 위계가 분명함
- [ ] 문구가 대화형 한국어 (장고 톤)
- [ ] 사용자 노출 브랜드명이 `장고야 부탁해` / `appBrand` 기준
- [ ] empty·성공·경고·추천에 장고 `mood`가 맞음 (한 블록당 1개)
- [ ] `Mascot`만 사용 (화면에서 캐릭터 PNG 직접 import 금지)
- [ ] 한 화면에 입력 폼이 과하지 않음
- [ ] 긴 입력은 바텀시트/스텝으로 분리됨
- [ ] typecheck / lint 통과
