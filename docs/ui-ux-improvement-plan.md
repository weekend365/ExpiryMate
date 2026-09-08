---
status: active
owner: mobile-design
last_reviewed: 2026-09-08
source_of_truth: true
---

# 주요 사용자 흐름 개선 실행 기록

이 문서는 첫 UI/UX 개선 단계의 범위와 검증 기록이다. 제품 정책은
[출시 범위](./product/release-scope.md), [수익화](./monetization.md),
[디자인 시스템](./design-system.md), [반응형 QA](./mobile-responsive-qa.md),
[캐릭터 규칙](./JANGO_CHARACTER_STYLE_GUIDE.md)을 따른다. 기존
[홈 빠른 동작 초안](./product/home-quick-actions-ux-improvements.md)은 가설 자료이며,
이미 구현된 등록 방식 선택·빠른 저장·사진 초안 복원을 다시 만들지 않는다.

## 기준 상태와 검토 범위

- 시작 시 `git status --short`와 diff가 비어 있었다. 적용 규칙은 루트 `AGENTS.md`다.
- 변경 전 `pnpm --filter @expirymate/mobile test`: 81개 파일, 387개 테스트 통과.
- 변경 전 `pnpm docs:check`: 통과. 위 기준 검사에서 기존 실패 없음.
- 코드·테스트·활성 정본을 검토했다. 실제 사용자 관찰이나 실기기 검증 결과는 아니다.
- Windows 로컬에 adb, Android emulator, Maestro, Docker가 없고 기본 Android SDK 경로도
  존재하지 않는다. iOS simulator 실행 환경도 없다. 네이티브 전후 캡처는 미확보다.
- 운영 서비스, 스토어, production DB에 접근하지 않는다. 날짜가 있는 운영 기록은 현재 상태로
  재해석하지 않는다.

## 주요 흐름 지도

| 흐름 | 시작·목적과 정상 완료 | 취소·실패·재진입 경로 및 코드 근거 | 판단 |
|---|---|---|---|
| A 첫 사용 | 온보딩 4단계 → 로그인/가입 → 메일 확인 또는 OAuth → 홈에서 첫 등록 | `auth-routing.ts`, `oauth-return.ts`, `pending-invitation.tsx`가 인증·대기 초대 복귀를 담당한다. 인증 오류와 재전송·재설정 경로가 있다. | 현재 로그인 요구와 초대 복귀 유지. 안내 효과는 사용자 관찰 필요 |
| B 등록 | 홈·보관함·추천 → 방식 선택 → 수동/바코드/사진 → 확인·저장 → 추가 완료 또는 연속 등록 | `registration-return.ts`, `register.tsx`, `scanner-camera.tsx`, `register-photo.tsx`. 저장 실패 메시지, 카메라 권한 안내, 사진 초안·수동 전환 존재 | 추천 진입의 복귀 맥락과 사진 완료 문구 불일치 확인. 1단계 대상 |
| C 보관함 | 선택 공간 → 검색·기한 필터 → 상세 수정 → 소비/폐기 → 목록 반영 | `inventory-hero.ts`가 초기 오류·검색 빈 상태를 구분한다. `deferred-inventory-removal.ts`와 관련 hook이 지연 처리·되돌리기를 담당한다. 실패·공간 전환 경계 테스트 존재 | 처리·되돌리기 정책 유지. 큰 글자/필터 구별은 화면 확인 필요 |
| D 추천 | 재료·인원·시간·끼니 선택 → 동의/한도 확인 → 생성 → 결과·즐겨찾기·히스토리 | `use-recommendation-generate-flow.ts`, generation provider. 광고 검증 대기와 재시도, 재료 없음 등록 시트 존재 | 단순 등록 복귀로 새 생성이 일어나지 않아야 함. 옵션 보존 검증 대상 |
| E 조리 | 레시피 → 준비·단계·타이머 → 사용량 확인 → 재고 반영 | `use-cooking-session.ts`, `cooking/[recommendationId].tsx`, `pending-cooking-cleanup-card.tsx`. 초안 복원·저장 재시도·미완료 정리 재진입 존재 | 신규 복원 기능 불필요. 완료와 재고 반영 이해는 후속 관찰 |
| F 공유 | 초대 → 로그인 후 수락 → 공간 전환 → 공동 재고 사용 | `pending-invitation.tsx`, `spaces/invitations/*`, space provider. 만료·잘못된 코드 안내, 서버 역할 제한·계정별 캐시 경계 존재 | 두 계정 실기기 QA 미실행. 권한·저장 형식 유지 |
| G 지원·수익화 | 설정에서 알림·지원·개인정보 관리, 장보기에서 명시적 외부 이동, 구독 구매/복원 결과 확인 | `settings/notifications.tsx`, `settings/support.tsx`, `privacy/account-delete.tsx`, `ShoppingScreen.tsx`, `settings/subscription.tsx`. 결제 취소·복원 오류·기기 미지원 분기 존재 | 구독 미조회/오류를 확정 상태처럼 표시하는 문제는 2단계 대상 |

## 진단과 우선순위

| 흐름·파일 | 재현 조건 | 사실 또는 가설 | 사용자 영향 | 개선안 | 우선순위·위험 | 검증 |
|---|---|---|---|---|---|---|
| 추천 `recommendations.tsx`, `registration-return.ts` | 추천에서 재료 추가 후 완료 | **사실:** 등록 진입이 기본 경로 또는 `from=home`; 복귀 계약은 home/inventory만 지원 | 원래 추천 화면 대신 홈으로 이동 | 새 내부 복귀 맥락을 전달하고 기존 추천 화면으로 복귀 | P1·중간 | 기존 링크 파싱, 등록 방식 간 전달, 기존 화면 유지·자동 생성 없음 |
| 사진 `register-photo.tsx` | 홈에서 사진 저장 후 완료 | **사실:** 버튼은 ‘보관함으로 이동’, 실제 목적지는 홈 | 누르는 행동과 결과 불일치 | 실제 복귀 목적지에 맞는 완료 문구 | P1·낮음, 1단계에 포함 | 목적지별 문구·이동, 전후 캡처 |
| 구독 `settings/subscription.tsx` | 최초 조회 중 또는 실패, access 데이터 없음 | **사실:** entitlement 미조회도 ‘무료 이용’, access 미조회도 ‘신규 가입 중단’ 분기 | 유료 사용자 상태나 판매 가능 여부 오해, 재시도 경로 부재 | 미확인·오류·확정 상태 분리, 해당 조회 재시도 제공 | P1·중간 | 미조회·오류·캐시 갱신 실패·활성/무료·판매 활성/중단 조합 |
| 구독 같은 파일 | 신규 판매 비활성 응답 | **사실:** ‘원가 검증 또는 운영 점검’이라고 원인을 안내 | 현재 가능한 행동보다 내부 용어 노출 | 확인된 이용 상태와 무료 기능·복원 안내 | P2·낮음, 2단계에 포함 | 문구와 실제 동작·정책 대조 |
| 홈·등록 방식 시트 | 안내·미완료 정리 공존, 최근 방식 변경 | **가설:** 등록 CTA 도달성 또는 동적 순서 예측성이 낮을 수 있음 | 추가 탐색 가능성 | 화면·사용성 관찰 후 판단 | 후속 | 작은 화면/큰 글자 캡처·과업 관찰 |
| 사진·추천·요리 | 동의·광고 대기·복원·재고 반영 실패 | **가설:** 안내가 여러 상태에 걸쳐 이해하기 어려울 수 있음 | 중단·중복 시도 가능성 | 기존 회복 경로를 관찰한 뒤 개선 | 후속 | 실패·중단 시나리오와 사용자 이해 확인 |

## 단계와 완료 조건

### 1. 등록 후 원래 작업 복귀

- 대상: 등록 경로 helper, 추천 진입, 수동·스캐너·사진 완료/취소/방식 전환.
- 변경: 추천에서 등록한 경우 추천 화면으로 돌아간다. 사진 완료 버튼은 실제 목적지를 말한다.
- 보존: 기존 `from=home/inventory`, 누락·잘못된 `from`의 홈 기본값, 연속 추가, 저장 API와
  중복 제출 제어, 세션/공간별 초안, 명시적으로 선택하는 기존 추천 생성 동작.
- 새 복귀 맥락은 URL의 추가 파라미터로 전달한다. 서버 상태나 사용자 선택을 새 전역 store에
  복제하지 않는다. 추천 화면이 스택에 있으면 기존 인스턴스로 돌아가 로컬 옵션을 유지한다.
- 완료 조건: 세 방식 모두 복귀 맥락 전달, 완료·취소·수동 전환 검증, 기존 링크 회귀 없음,
  단순 복귀가 새 `autoGenerateAt`을 만들지 않음. 네이티브 상호작용과 캡처는 별도 관문이다.
- 되돌리기: 이 단계의 등록 helper·소비 화면·테스트 변경만 역패치한다. DB/로컬 저장 migration 없음.
- 상태: 구현 완료. 등록·스캐너·추천 관련 59개 테스트 및 모바일 TypeScript 검사 통과.
  스캐너 저장 항목 수정 경유도 복귀 맥락을 유지한다. 새 `returnTo=recommendations`를 사용하고
  기존 `from=recommendations`는 그대로 홈으로 해석한다. 네이티브 스택·선택 유지 확인은 미실행.

### 2. 구독 상태와 다음 행동을 정확히 안내

- 대상: 구독 화면의 조회 상태 표시와 신규 판매 안내.
- 변경: 상태 확인 중, 최초 조회 실패, 마지막 확인 상태와 갱신 실패를 구별한다.
  구독·판매 가능 상태를 확인할 수 없으면 구매 UI 대신 조회 상태와 안전한 재시도를 제공한다.
- 보존: 가격·월간 기본 선택·무료 기능·법적 고지·스토어 상품·결제/복원 처리·서버 권한·feature flag.
- 완료 조건: 데이터 없음이 무료/판매 중단으로 단정되지 않음, 오류 후 재시도,
  확인된 상태에 따른 판매 UI, 기존 활성 혜택·복원 동작 회귀 없음.
- 되돌리기: 구독 표시 관련 helper·화면·조회 상태 노출·테스트 변경만 역패치한다.
- 상태: 구현 완료. 구독 표시·수익화·디자인 계약 66개 테스트 및 모바일 TypeScript 검사 통과.
  조회 상태 판단 18개, 기능 UI의 표시·재시도 연결 9개 테스트를 추가했다.
  기능 UI 테스트는 공통 네이티브 컴포넌트를 대체한 반환 트리 검사이며 실제 layout 검사가 아니다.

## 검증과 미완료 관문

단계별 관련 테스트 → 전체 docs/lint/typecheck/test → 관련 build와 CI 검사를 실행한다.
전체 검사 결과는 아래에 갱신한다. 정책·API·DB·저장 키·브랜딩 에셋은 변경하지 않는다.

### 네이티브 재검증 준비

- `.maestro/registration-return.yaml`을 추가했다. 격리된 로컬/테스트 API에 로그인하고
  쓰기 가능한 공간을 선택한 네이티브 앱에서 실행한다. 재료 1건을 저장하므로 운영 환경에서는
  실행하지 않는다. 사진 초안이 없는 테스트 계정을 사용한다.
- `apps/mobile`에서 `SCREENSHOT_DIR`를 별도 증거 디렉터리로 지정한 뒤
  `maestro test .maestro/registration-return.yaml`을 실행한다. 4인·60분 선택 → 수동 등록 →
  추천 복귀와 선택 유지, 스캐너·사진 닫기 복귀를 확인한다. 새 흐름은 아직 실행하지 않았다.
- 기존 layout smoke의 등록 방식 3곳이 현재와 다른 과거 버튼 문구를 사용하고 있었다.
  해당 선택자를 기존 `ingredient-entry-*-button` test ID로 교체했다. 실행 시 관찰한 실패가 아닌
  코드 대조로 확인한 기존 검증 문제다. 캡처 목록·baseline·비교 허용치는 변경하지 않았다.
- 바코드 실제 인식·빠른 저장·항목 수정 경유, 사진 분석·저장·초안 복원,
  조회 실패·재시도 시 구독 화면은 네이티브 환경의 수동/통합 QA에도 포함한다.
- 새 흐름의 선택 유지 assertion은 Maestro의
  [선택 상태 selector](https://docs.maestro.dev/reference/selectors/state-selectors)를 사용한다.
  두 YAML은 구문·문서 구조 검사만 통과했으며 Maestro 실행 통과를 의미하지 않는다.

### 최종 자동 검증 결과

| 검사 | 결과 | 범위·한계 |
|---|---|---|
| `pnpm docs:check` | 통과 | 메타데이터·정본 연결·모바일 빌드 진입점 |
| `pnpm lint` | 통과 | ESLint 및 디자인 시스템 검사 |
| `pnpm typecheck` | 재실행 통과 | 최초 shared esbuild가 샌드박스 상위 폴더 접근 제한으로 실패. 제한 밖에서 동일 명령으로 shared ESM/CJS/DTS 빌드와 전체 TypeScript 검사 통과 |
| `pnpm test` | 159개 파일, 989개 테스트 통과 | shared 121, mobile 431, API 437. 모바일 기준 44개 추가. Admin은 test script가 없어 이 명령에 독립 테스트가 포함되지 않음 |
| `pnpm validate:env-parity` | 통과 | 환경 키 목록만 비교. 외부 서비스나 비밀값 검증 아님 |
| Android Expo export | 통과 | `--platform android --output-dir dist/ui-ux-android`, Hermes 번들. APK 빌드/설치 검증 아님 |
| iOS Expo export | 통과 | `--platform ios --output-dir dist/ui-ux-ios`, Hermes 번들. Xcode 빌드/서명 검증 아님 |
| `git diff --check` | 통과 | 공백 오류 없음 |
| Maestro YAML 구조 검사 | 통과 | 기존 layout 148개 명령, 신규 복귀 흐름 33개 명령. 네이티브 실행 아님 |
| `e2e:layout`, `e2e:layout:ios` | 환경 차단 | 두 명령 모두 Bash 실행 단계에서 `The system cannot execute the specified program`. 네이티브 검사 시작 전 실패 |
| `screenshots:compare` | 미실행 | 전후 네이티브 PNG와 main baseline 부재. 새 캡처로 baseline을 덮어쓰지 않음 |
| 과업별 5회·5초 이해도·접근성 사용자 관찰 | 미실행 | 기기·참여자 없음. 과업 시간/성공률/이탈률 개선 수치 주장 없음 |

실행 로그는 gitignored `apps/mobile/e2e/results/ui-ux-2026-09-08/`의
`test.log`, `lint.log`, `typecheck.log`, `typecheck-retry.log`, `export-android.log`,
`export-ios.log`, `layout-android.log`, `layout-ios.log`에 남겼다.
로컬 Node는 24.19.0이며 CI의 Node 22 실행 결과로 대신 표시하지 않는다.
Expo export는 offline·dotenv 로딩 없음·Sentry upload 비활성·로컬 API URL로 실행했다.

기준 모바일 테스트·문서 검사의 기존 실패는 없었다. 구현 중 누락된 아이콘 import는 수정했고
최종 코드 검사 실패는 없다. shared 빌드의 최초 접근 제한은 환경 문제로 해결됐으며,
네이티브 layout 환경 차단과 미실행 검증은 여전히 남아 있다.

## 변경 전후와 인수 상태

| 상황 | 변경 전 | 변경 후 |
|---|---|---|
| 추천 → 수동/스캔/사진 등록 → 완료 | 홈으로 이동 | ‘추천으로 돌아가기’로 기존 추천 화면 복귀. 새 자동 생성 파라미터 없음 |
| 추천 → 스캔 → 수동 전환 또는 저장 항목 수정 | 등록 복귀 맥락이 전달되지 않음 | 추가 `returnTo`가 등록 방식 전환·수정 경유에도 전달됨 |
| 홈 → 사진 저장 | ‘보관함으로 이동’ 버튼이 홈으로 이동 | ‘홈으로 돌아가기’로 목적지와 문구 일치 |
| 구독 최초 조회 중/실패 | 미조회 상태가 ‘무료 이용’처럼 표시 | 상태 확인 중 또는 재시도 안내 |
| 구독 조회 캐시의 갱신 실패 | 캐시가 확정 상태처럼 표시 | ‘마지막 확인’ 표시와 재조회 안내, 구매 노출 보류 |
| 판매 가능 여부 미조회/실패 | 신규 가입 중단 안내 | 확인 중 또는 해당 조회 재시도 |
| 서버가 신규 판매 비활성 응답 | 내부 원가·운영 사유 안내 | 신규 구독 불가, 무료 기능과 기존 구매 복원 안내 |

위 차이는 코드·자동 테스트 기준이다. 전후 화면 캡처가 없으므로 시각적 완성도와 실제
내비게이션·접근성 인수 완료를 주장하지 않는다. **두 단계의 구현과 가능한 자동 검증은 완료,
네이티브·사용성 QA는 미완료**다. 변경은 로컬 diff로 남겼고 배포·스토어·원격 설정을 변경하지 않았다.

## 단계별 되돌리기 상세

추가된 사용자 변경을 함께 되돌리지 않도록 아래 파일의 **이번 단계 diff만** 역적용한다.
DB·API·로컬 저장 데이터의 복구나 migration은 필요하지 않다.

1. 등록 복귀: `registration-return.ts`와 테스트, `registration-completion-actions.tsx`,
   `recommendations.tsx`, `register.tsx`, `register-photo.tsx`, `inventory/[id].tsx`,
   `scanner-camera.tsx`, `scanner-confirm-sheet.tsx`, `scanner-permission.tsx`의 이번 변경을 역적용하고
   새 `registration-navigation.ts`/테스트와 `.maestro/registration-return.yaml`을 제거한다.
   기존 layout 선택자 수정도 되돌리려면 `.maestro/layout-smoke.yaml`의 3개 선택자만 역적용한다.
   관련 등록·스캐너 테스트와 모바일 typecheck를 실행한다.
2. 구독 안내: `settings/subscription.tsx`와 `monetization-provider.tsx`의 이번 변경을 역적용하고
   새 `subscription-screen-state.ts`/테스트와 `subscription-status.tsx`/테스트를 제거한다.
   기존 구매·복원 코드는 변경하지 않았으므로 별도 결제 상태 복구는 없다.
   수익화 테스트와 모바일 typecheck를 실행한다.
3. 되돌린 범위를 이 문서에 반영하고 `pnpm docs:check`를 실행한다. 모든 변경을 되돌리면
   이 실행 문서와 `docs/README.md`의 연결 행도 함께 제거한다.

- 네이티브 layout: 환경 부재로 미실행. `.maestro/layout-smoke.yaml`과 layout manifest,
  `e2e:layout`, `e2e:layout:ios`, `screenshots:compare`가 기존 검증 진입점이다.
- 의도적인 시각 변화: 사진 완료 문구와 구독 상태/오류 안내. 전후 캡처·차이 검토 전에는
  시각 검증 완료로 표시하지 않는다. baseline·비교 허용치·승인 라벨을 우회하지 않는다.
- 과업별 5회 사용성 비교, 5초 후 다음 행동 설명, 화면 읽기/큰 글자 사용자 관찰: 참여자·기기
  부재로 미실행. 자동 테스트를 사용자 이해나 완료율 개선의 근거로 대신하지 않는다.
- 기능 구현 및 가능한 자동 검증과 네이티브/사용성 인수 완료를 구분해서 보고한다.
