---
status: active
owner: engineering
last_reviewed: 2026-09-08
source_of_truth: true
---

# 리팩터링 실행 계획과 검증 기록

제품 범위와 정책은 [출시 범위](./product/release-scope.md),
[수익화 기준](./monetization.md), [저장소 규칙](../AGENTS.md)을 따른다.
이 문서는 2026-09-08 로컬 리팩터링의 범위·진행·검증만 관리한다.
운영 서비스 상태는 조회하지 않았다.

## 진단과 고정 범위

| 파일/심볼 | 확인된 문제 | 영향 | 개선안 | 우선순위 | 위험도 | 검증 방법 |
|---|---|---|---|---|---|---|
| mobile/admin `api.ts`, API `production-env.ts`의 hostname 검사 | 같은 금지 hostname 규칙이 세 곳에 복제됨 | 환경 검증 규칙 변경 시 누락 가능 | 순수 URL 유틸리티를 shared로 통합하고 앱별 production 판단 유지 | 1 | 낮음 | 허용·거부·개발환경 경계 테스트, 기존 production-env 테스트 |
| API `AdminService`, Admin `api.ts`의 응답 타입 | 재고 목록·수익화 보고 계약이 양쪽에 복제되고 문의 목록은 기존 shared 타입을 재정의 | 컴파일러가 서버와 소비자의 불일치를 탐지하기 어려움 | shared 타입을 양쪽에서 사용하고 기존 export 경로 유지 | 1 | 낮음 | shared 계약 타입 검사, shared ESM/CJS build, API/Admin typecheck |
| mobile `api.ts` | 네이티브 세션 저장·복원, HTTP 디코딩, 도메인 호출이 결합되고 JSON/multipart의 401·오류 처리가 복제됨 | 세션 또는 transport 수정의 영향 범위가 넓고 두 요청 방식이 달라질 위험 | transport와 session을 내부 모듈로 분리하고 인증 요청 흐름 통합, 기존 api.ts 공개 진입점 유지 | 2 | 중간 | 기존 세션 테스트, JSON/multipart 성공·재시도·거부·네트워크 경계 테스트 |
| API `AdminService.getMonetizationOverview` | 재고·대시보드 service가 수익 원장·AI 비용·제휴·retention 조회와 계산까지 담당 | 서로 다른 변경 이유와 의존성이 한 service에 집중 | 수익화 조회 service 및 계산 모듈 분리 | 3 | 중간 | 기존 집계 결과 테스트, 기간·빈 데이터·guardrail·retention 경계, controller guard·DI 검증 |
| Admin `request`의 JSON 타입 단언 | 응답을 런타임 검증 없이 신뢰 | 잘못된 서버 응답에 대한 오류 처리 불명확 | 후속: 전체 endpoint별 schema 적용 및 실패 UX 설계 | 후속 | 중간 | 이번에는 잘못된 응답의 동작을 변경하지 않음 |
| 모바일 session/cache 경계 | query key에 사용자·공간을 포함하고 로그아웃 정리와 관련 테스트가 이미 존재 | 경계 변경 시 기존 보호 동작 훼손 가능 | 이번에는 키·캐시 정책 유지, 회귀 테스트 실행 | 유지 | 높음 | session-boundary, query-cache, spaces 테스트 |
| 루트 `eas.json` | 추적 중인 중복 설정이 기존 build-entry 검사와 충돌 | docs:check와 CI 실패, 빌드 실행 위치 혼동 | 공식 pnpm 진입점이 apps/mobile 설정을 사용함을 확인 후 루트 중복 제거 | 검증 관문 | 낮음 | docs:check, 기존 모바일 설정 테스트 |

전체 파일 길이는 조사 우선순위에만 사용했다. 큰 subscription/auth service의 분리,
화면 개편, 의존성 삭제·업그레이드, DB schema와 migration, 정책 변경은 이번 범위에서 제외한다.
정적 검색에서 mobile/admin의 앱 HTTP 호출은 기존 API 진입점에 모여 있다.
순환 의존성과 사용하지 않는 코드는 검증한 근거 없이 삭제하지 않는다.

## 단계와 완료 조건

1. **공유 계약·URL 유틸리티 통합** — 완료.
   앱별 production 조건, 기본 localhost URL, trailing slash 처리, 응답 필드·null 의미를 보존한다.
   shared build·계약 테스트와 소비자 검증을 통과하면 완료한다.
   되돌릴 때는 shared 신규 export와 세 앱의 소비 변경을 함께 복구한다.
2. **모바일 transport/session 분리** — 완료.
   공개 API export, 저장 키, SecureStore/AsyncStorage 처리 순서, 단일 refresh,
   재시도 1회 제한, JSON/multipart 헤더, timeout, 오류 문구를 보존한다.
   공개 API를 통한 동작 테스트와 mobile typecheck 통과가 완료 조건이다.
   되돌릴 때는 api.ts 변경과 내부 모듈을 한 묶음으로 복구한다.
3. **Admin 수익화 조회 분리** — 완료.
   endpoint/guard, 쿼리·기간·정렬·반올림·원가 계산과 반환 계약을 보존한다.
   기존 집계 테스트, 새 경계 테스트와 API build 통과가 완료 조건이다.
   되돌릴 때는 service·metrics·controller·module 등록과 테스트 연결을 함께 복구한다.
4. **통합 검증·기록 갱신** — 로컬 품질 검사 완료, 환경 의존 검증 잔여.
   docs/lint/typecheck/test, 환경 키 parity, 관련 build와 diff를 확인한다.
   실행 불가능한 외부·네이티브 검증을 별도로 남긴다.
   기존 CI 실패 원인이던 루트 EAS 중복 설정도 제거했다. 이 정리만 되돌리면
   기존 build-entry 실패가 다시 발생하므로 apps/mobile 정본을 함께 확인한다.

실제 되돌림은 이후 사용자 변경을 보존하며 해당 단계의 diff만 역적용한다.
단계 구분은 검토 단위이며 커밋·배포는 실행하지 않는다.

## 변경 전 기준

- 시작 기준은 `7e58df1`이며 `git status --short`와 `git diff --stat`가 비어 있었다.
- PowerShell의 `pnpm.ps1` 실행 제한은 동일 명령의 `pnpm.cmd` 진입점으로 해결했다.
- `pnpm.cmd lint`: 통과.
- `pnpm.cmd test`: 통과. Mobile 80 files / 371 tests, API 54 files / 415 tests.
  shared 17 files / 106 tests. 총 892 tests. Admin에는 test script가 없어 루트 test에서 제외된다.
- `pnpm.cmd docs:check`: 문서 메타데이터·링크 검사는 통과했으나,
  루트의 추적 중인 `eas.json`을 mobile build entry 검사가 거부했다.
  추가 확인에서 로컬 임시 파일이 아닌 중복 설정임을 확인했다. 정본 경로는 apps/mobile이다.
- `pnpm.cmd typecheck`: shared esbuild가 상위 디렉터리 읽기 제한으로 실패했다.
  같은 shared build를 샌드박스 밖에서 재실행하면 ESM/CJS/DTS 모두 통과했다.
  코드 결함과 환경 제한을 구분했다. 변경 전 전체 typecheck도 같은 방식으로 통과했다.
- 로컬 Node 24.19.0, CI Node 22이므로 CI와 런타임 버전 차이가 있다.

## 구현 결과와 동작 보존 근거

- [shared Admin 계약](../packages/shared/src/types/admin.ts)을 API와 Admin이 함께 사용한다.
  기존 Admin API 타입 export 경로와 문의 목록의 shared 정본을 유지한다.
- [shared URL 유틸리티](../packages/shared/src/utils/api-url.ts)는 환경값을 직접 읽지 않는다.
  세 앱의 hostname 검사와 두 클라이언트의 URL 해석을 통합했다. 빌드 도구가 shared 생성
  이전에도 읽을 수 있어야 하는 Next/Expo 설정 스크립트는 이번 통합 범위에 넣지 않았다.
- [모바일 API](../apps/mobile/src/services/api.ts)의 공개 export 91개가 변경 전과 같다.
  [세션](../apps/mobile/src/services/api-session.ts)과
  [전송](../apps/mobile/src/services/api-transport.ts)을 내부 모듈로 분리했다.
  JSON/multipart가 동일한 인증·재시도·오류 처리를 사용한다. UI 소비자는 기존 api.ts만 참조한다.
- [Admin 보고서 service](../apps/api/src/modules/admin/admin-monetization.service.ts)와
  [계산 모듈](../apps/api/src/modules/admin/admin-monetization-metrics.ts)을 분리했다.
  AdminService는 재고 목록과 대시보드 집계에 집중한다. controller의 경로·AdminGuard는 유지한다.
- 이동 전후 AST에서 함수 본문을 비교했다. Admin 22개와 모바일 106개가 동일했다.
  모바일의 의도적인 요청 통합·URL 위임·이메일 인증 분기 접근 변경은 이 비교에서 제외하고
  공개 API 동작 테스트로 확인했다.
- Admin 보고서 전체 반환값 2개를 **service 분리 전** snapshot으로 기록했다.
  분리 후 snapshot 갱신 없이 일치했다. 기간·빈 데이터·오류 전파와 관리자 접근 경계도 검증했다.
- 화면, 스타일, query key, Prisma schema/migration, 상품·한도·feature flag는 변경하지 않았다.
  성능 향상 수치는 주장하지 않는다.

## 검증 결과

| 검사 | 결과 | 근거·범위 |
|---|---|---|
| `pnpm.cmd docs:check` | 통과 | metadata 26개, 링크 검사 30개 파일, mobile build-entry 정본 확인 |
| `pnpm.cmd lint` | 통과 | ESLint 및 디자인 시스템 검사 |
| `pnpm.cmd typecheck` | 통과 | shared build, Prisma client generate, 세 앱과 shared 타입 검사; esbuild에 한해 sandbox 밖 실행 |
| `pnpm.cmd test` | 통과 | shared 121 + Mobile 387 + API 437 = **945 tests**, 156 files; 기존 892개에서 53개 증가 |
| `pnpm.cmd validate:env-parity` | 통과 | 환경 키 목록 정합성 |
| shared build | 통과 | ESM, CJS, DTS 생성 |
| API build | 통과 | Nest production 컴파일; DB 접속·migration 없음 |
| Nest DI smoke | 통과 | 컴파일된 AdminModule의 provider 목록으로 controller → 보고서 service 연결 검증, Prisma는 메모리 stub |
| Android Expo export | 통과 | 로컬 Hermes 번들·asset 생성, dotenv 읽기·네트워크·Sentry 업로드 비활성화 |
| iOS Expo export | 통과 | 로컬 Hermes 번들·asset 생성, 동일한 격리 환경값 사용 |
| Admin production build | 부분 통과 / 최종 실패 | 컴파일·타입 검사·정적 페이지 16개 생성 성공, Windows `symlink EPERM`으로 standalone 패키징 실패 |
| `git diff --check` | 통과 | 공백 오류 없음 |

Admin에는 test script가 없어 루트 test에 Admin 브라우저 동작 테스트가 포함되지 않는다.
이번 변경의 Admin 소비자 검증은 공통 URL 테스트, 타입 검사와 Next 컴파일·페이지 생성까지다.
Admin build에는 기존 OpenTelemetry 동적 require와 Next ESLint plugin 경고도 출력됐다.
전체 빌드 성공으로 표시하지 않는다.

변경 전 docs 실패는 루트 중복 EAS 제거로 해결했다. 변경 전 typecheck 실패는 sandbox 읽기
제약이 원인이었으며 같은 명령의 허용된 실행으로 해결했다. 구현 중 발견한 import 누락 등은
수정 후 관련 테스트·타입 검사·lint를 통과했다. 현재 남은 코드 검사 실패는 없다.

## 남은 검증과 후속 후보

- **Admin 패키징:** Linux CI 또는 symlink 생성 권한이 있는 Windows 환경에서 동일 production
  build 재실행이 필요하다. 이번 환경에는 Docker가 PATH에 없으며 OS 권한·Next standalone
  설정을 바꿔 검사를 우회하지 않았다. 기존 브랜치를 별도로 빌드하지 않았으므로 이 패키징
  오류를 변경 전부터 재현한 결함이라고 단정하지 않는다.
- **네이티브 QA:** Android/iOS 네이티브 빌드, 실기기 로그인·사진 업로드·권한 QA와 screenshot
  비교는 실행하지 않았다. 화면·스타일 변경이 없고 기존 레이아웃 계약 테스트는 통과했지만
  JS/Hermes export가 실기기 QA를 대체하지 않는다. iOS simulator는 Windows에서 실행할 수 없다.
- **CI 전용 검사:** Docker production 이미지와 깨끗한 DB migration job은 실행하지 않았다.
  schema/migration/Dockerfile 변경은 없다. 운영 배포·데이터 수정도 실행하지 않았다.
- **후속 계약 검증:** Admin endpoint별 응답 schema 적용 및 브라우저 테스트 추가.
- **후속 정책 검토:** `resolveConfiguredProductRevenue`는 basePlanId가 null이면 첫 후보 키가
  `store:product`로 축약되어 billingPeriod 키보다 먼저 선택된다. 이번에는 기존 순서를
  테스트로 고정했다. 우선순위를 바꾸려면 수익 추정 정책과 함께 별도 검토한다.
- **추가 분리 후보:** 인증·구독 service와 Admin 보고서 내부 조회/조합의 추가 분리는 실제
  변경 요구가 생길 때 다룬다. 이번 범위를 넘어 기계적으로 파일을 나누지 않았다.

선정한 세 단계의 코드 구현과 로컬 품질 검사는 끝났지만, Admin standalone 패키징과
환경 의존 QA가 남아 있어 전체 release 검증 완료를 의미하지 않는다. 이 기록은 그 검증이
끝날 때까지 active로 유지한다.
