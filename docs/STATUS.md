---
status: active
owner: product-release
last_reviewed: 2026-10-10
source_of_truth: true
data_as_of: 2026-10-10
---

# 프로젝트 현황

이미 스토어에 출시된 장고야 부탁해의 운영 단계, 업데이트 우선순위, 블로커를 관리하는 정본입니다. 구현 방향은
[`ROADMAP.md`](./ROADMAP.md), 배포 절차는
[`operations/deployment.md`](./operations/deployment.md)를 확인하세요.

> 최신 확인은 아래 2026-10-10 기록을 우선합니다. 8월 기록의 버전, 판매 플래그,
> 상품 승인 대기는 역사적 상태이며 현재 콘솔 상태로 해석하지 않습니다.

## 2026-10-10 · 1.4.3 출시 전 점검 진행

- App Store 공개 버전은 `1.4.2`(48), Google Play production은 `1.4.2`(35)입니다.
  Google Play에는 미게시 변경이나 조치가 필요한 정책 선언이 없습니다.
- Apple의 `Jango Plus` 그룹과 월간·연간 상품은 모두 **승인됨**입니다. 한국 가격은
  월 4,900원·연 39,000원이며 가족 공유와 신규 구독 특가는 꺼져 있습니다.
  첫 구독을 새 앱 버전과 함께 제출해야 한다는 아래 준비 기록은 현재 관문이 아닙니다.
- App Privacy의 15개 데이터 유형, 개인정보처리방침·개인정보 선택 URL을 확인했습니다.
  Google Play Data Safety의 전송 암호화·이메일/OAuth 계정 생성·계정/데이터 삭제 URL도
  확인했습니다. 다만 사진·구매 내역·충돌 로그·성능 데이터 신고가 빠져 있고 쿠팡 검색어
  공유가 신고되지 않았습니다. **콘솔의 정책 알림 없음은 이 대조의 통과를 뜻하지 않습니다.**
  [신고 수정안](../design/reviews/release-readiness-2026-10-10/store-corrections.json)은
  로컬 초안이며 콘솔 저장·심사 제출은 수행하지 않았습니다.
- Railway API·Admin은 `37bc4b3d` 소스로 배포되어 있습니다. `/health`, `/ready`와 공개
  정책 페이지는 정상이며, 운영 DB migration 45개가 모두 완료됐습니다. 이번 점검에서
  운영 데이터·migration·판매 플래그를 변경하지 않았습니다.
- 현재 운영의 개인 플러스 판매·원가 guardrail·purchase intent·resync는 **on**,
  가족 플러스·일회성 추천권·Sandbox 구매 허용은 **off**입니다. 설정 존재만으로
  구매·복원·실제 원가 검증을 통과했다고 판단하지 않습니다.
- 로컬 `release/1.4.3-preflight`의 `14d5669`에서 버전을 1.4.3으로 올리고 API 업로드
  크기·필드 제한 및 오류 응답, API/Sentry 소스 식별, 모바일 버전 헤더, iOS EAS 자산
  보존과 의존성 보안 패치를 반영했습니다. API·Admin의 이 수정은 아직 운영에 배포하지
  않았습니다. production 반영은 [운영 런북](./operations/deployment.md)을 따릅니다.
- 기본 테스트 1,309개, lint·typecheck·docs·브랜딩 audit, API·Admin 빌드와 양 플랫폼
  production Hermes export가 통과했습니다. 변경 전 격리 DB의 migration·통합 테스트
  6개도 통과했으며 Prisma 변경은 없습니다.
- npm 공식 advisory의 production/optional lockfile 그래프 검사에서 고유 GHSA가
  117개에서 65개로 줄고 critical은 5개에서 0개로 줄었습니다. 남은 high 45·moderate
  18·low 2는 실행 경로와 버전별 추가 검토 대상입니다. `pnpm audit` 자체는 메모리
  부족으로 완료하지 못했습니다. 근거는 [의존성 감사 기록](../design/reviews/release-readiness-2026-10-10/dependency-audit.json)입니다.
- 사용자가 EAS 소스 전송과 두 플랫폼 서명 빌드를 허용했습니다. iOS `1.4.3`(49)
  [서명 빌드](https://expo.dev/accounts/devnamu/projects/expirymate/builds/a1543fd4-d748-4989-9589-f5363a912972)는 완료됐고 서명·버전·권한을 확인했습니다.
  실제 IPA에서 구매 내역 manifest 누락을 발견해 Expo 설정과 생성된 네이티브 manifest에
  추가했습니다. 이 수정이 포함된 다음 IPA로 교체해야 합니다.
- Galaxy A34(Android 16)의 opt-in 글자 크기 후보에서 본문 live/cold 재측정과 입력·초점·
  선택·React 인스턴스 보존은 확인했지만 JS Dimensions 배율은 갱신되지 않았습니다.
  [실기기 기록](../design/reviews/release-readiness-2026-10-10/android-font-scale-qa.json)에
  실패를 남기고 DeviceInfoModule의 configuration 갱신을 추가한 두 번째 후보를 빌드 중입니다.
  일반·production 기본값은 계속 off이며 후보의 출시 채택은 하지 않았습니다.

출시 판정은 **보류**입니다. Android 글자 크기 live/cold 검증과 release 로그인 저장,
새 두 플랫폼 RC 실기기 회귀·푸시·구매/복원, 최종 바이너리 SDK/권한/버전 대조와
운영 보안 수정 반영이 남아 있습니다. 스토어 심사 제출·공개 출시까지 허용된 것은 아닙니다.

## 현재 위치

| 영역 | 상태 | 남은 관문 |
|---|---|---|
| 모바일 핵심 UX | 구현 완료에 가까움 | 새 release candidate 회귀 QA |
| 인증 | 소셜 4종·이메일 실기기 검증 | 새 빌드에서 공유 초대 복귀 재검증 |
| API | 재고·공간·초대·추천·개인 플러스 구현, 운영 migration·처분 이벤트 백필 완료 | 스토어 구매 검증 확인 |
| Admin | Railway 배포 | 보안 하드닝·플랜별 원가/수익 지표 운영 점검 |
| 스토어 | iOS·Android 앱 운영 중 | 개인 플러스 상품·서버 알림·업데이트 빌드 제출 |

**현재 단계:** 출시 앱 안정 운영과 개인 플러스 업데이트 준비

**상태 판단 주의:** 앱 자체는 이미 출시됐습니다. 개인 플러스 업데이트는 코드와 자동 검증,
운영 migration·처분 이벤트 백필까지 완료됐으나, 최신 운영 백업, 실제 AI 원가 표본,
스토어 결제 Sandbox/License QA와 두 실계정 release QA가 끝나기 전에는 판매를 시작하지 않습니다.

### 2026-08-29 운영 공통 준비 확인

- production API의 개인 플러스 migration 적용 완료
- 기존 종료 재고 90건을 append-only 처분 이벤트로 백필 완료
  (`consumed` 13건, `discarded` 77건, `source=backfill`)
- API `/ready`, Admin 개인정보처리방침·개인정보 선택권·이용약관 공개 URL 응답 확인
- `SUBSCRIPTIONS_ENABLED=false`, 가족 플러스·일회성 추천권·Sandbox 구매·재동기화
  scheduler 비활성화, `MONETIZATION_OFFER_MODE=core`, 수익 원장과 결제 의도 필수화 확인
- Railway Volume의 기존 백업은 2026-08-16 생성본입니다. 현재 연결 계정은 새 백업 생성 API에
  `Not Authorized`가 반환되므로, 프로젝트 Owner 권한으로 최신 백업을 생성하기 전에는 추가
  운영 스키마 변경을 진행하지 않습니다.

### 2026-08-29 App Store Connect 준비 현황

- 유료 앱 계약, 대한민국 세금 양식, KRW 은행 계좌가 모두 `Active`인 것을 확인했습니다.
- `Jango Plus` 구독 그룹에 개인 플러스 월간·연간 상품을 같은 등급으로 등록했습니다.
  월간은 4,900원, 연간은 39,000원이며 전 지역 판매, 가족 공유 끔, 무료 체험·프로모션
  없음으로 설정했습니다.
- App Store Server Notifications V2의 production·Sandbox URL을 production API로
  등록했고, Apple 테스트 알림이 API `201`로 성공했습니다.
- App Store Server API용 인앱 구입 키와 Apple Root CA를 Railway production에 등록한 뒤
  `/ready` 200을 확인했습니다. 비공개 `.p8` 파일은 저장소에 넣지 않았습니다.
- Billing Grace Period는 `Sandbox only`, 16일, `Paid to Paid`로 설정했습니다.
- Privacy·Privacy Choices URL과 App Privacy 15개 데이터 유형을 실제 SDK·앱 동작에 맞춰
  게시했습니다. Tracking은 `No`입니다.
- iOS 1.4.0 버전의 프로모션 문구, 설명, 업데이트 내용, Support·Marketing URL을 저장하고
  출시 방식은 **수동 출시**로 선택했습니다.
- iOS production 빌드 생성은 **2026-09-01**에 진행합니다. 그전에는 빌드 연결, 첫 구독
  심사 추가, Sandbox 구매 QA, 심사 제출을 하지 않습니다.
- EAS production 설정이 필수 API·OAuth·AdMob·Sentry 공개 환경값을 모두 읽는 것을
  확인했습니다. 2026-08-29 원격 iOS buildNumber는 `35`이므로 auto-increment가 정상
  동작하면 9월 1일 production 빌드는 `36`이 됩니다.
- **사용자 확인 완료:** App Store Connect 저작권을 `2026 devnamu`로 수정했습니다.
  심사 계정 비밀번호는 한 차례 교체했지만 2026-08-29 추가 캡처에서 다시 노출되어,
  제출 전 재교체와 App Store Connect 로그인 정보 재갱신이 필요합니다.
- **사용자 확인 완료:** App Store Connect 대한민국 연령 등급이 `4+`로 표시되는 것을
  확인했습니다. 수출 규정 응답은 별도로 최종 확인해야 합니다.
- **사용자 확인 완료:** 심사 전용 계정으로 production 앱에 로그인했으며 홈이 정상적으로
  열리고 설정에 `함께 쓰는 냉장고` 진입점이 표시됩니다.
- **사용자 확인 완료:** 심사 계정이 소유자인 `Apple 심사 냉장고`를 만들었고
  `1명이 함께 써요 · 지금 보는 중` 상태를 확인했습니다.
- **사용자 확인 완료:** 1회용 코드를 두 번째 테스트 계정에서 수락했고, 소유자 계정에서
  `Apple 심사 냉장고`가 `2명이 함께 써요`로 표시되는 것을 확인했습니다.
- **사용자 확인 완료:** 소유자 계정에서 심사용 활성 재고 5개를 등록했고, 두 번째 계정에서
  같은 공간을 선택해 새로고침했을 때 5개가 모두 표시됐습니다.
- **사용자 확인 완료:** 두 번째 계정에서 양파 수량을 3개에서 2개로 수정했고, 소유자
  계정 새로고침 후 2개로 표시되어 반대 방향 재고 동기화도 확인했습니다.
- **사용자 확인 완료:** 별도 샘플 재료로 소비 3건·폐기 2건을 기록해 홈의 최근 30일
  브리핑 준비 조건을 충족했습니다. 기존 활성 재고 5개는 유지했습니다.
- **사용자 확인 완료:** 앱을 강제 종료 후 재실행해도 심사 계정 세션, `Apple 심사 냉장고`
  선택 상태, 활성 재고와 `소비 3개 · 폐기 2개` 브리핑이 유지됐습니다.
- `SUBSCRIPTIONS_ENABLED=false`, `IAP_ALLOW_SANDBOX_PURCHASES=false`를 유지합니다.
  9월 1일 TestFlight/Sandbox QA 직전에만 Sandbox 구매 허용 범위를 다시 결정합니다.

### 2026-08-29 Google Play Console·RTDN 준비 현황

- Google Cloud 프로젝트 `jango-plz`에 RTDN topic `jango-play-billing`을 만들고
  `google-play-developer-notifications@system.gserviceaccount.com`에 `Pub/Sub Publisher`
  권한을 부여했습니다.
- Pub/Sub 서비스 에이전트 `service-634350291976@gcp-sa-pubsub.iam.gserviceaccount.com`에
  Push 인증용 서비스 계정 `jango-rtdn-push@jango-plz.iam.gserviceaccount.com`의
  `Service Account Token Creator` 권한을 부여했습니다.
- `jango-play-rtdn-push` 인증 Push 구독을 생성했습니다. 엔드포인트와 Audience는
  `https://api-production-1504.up.railway.app/subscriptions/notifications/google`이며,
  페이로드 래핑 해제는 끕니다.
- Play Console `Monetization setup`에서 RTDN을 켜고
  `projects/jango-plz/topics/jango-play-billing`을 등록했습니다. 현재 알림 유형은
  구독·무효화 구매 범위로 유지합니다.
- Railway production에 `GOOGLE_RTDN_AUDIENCE`를 저장하고 API 재시작 후
  `/subscriptions/notifications/google` 라우트 등록을 확인했습니다. 실제 테스트
  메시지의 2xx 응답과 Pub/Sub 미승인 메시지 0은 구매 QA 기록에서 최종 확인합니다.

## P0 — 개인 플러스 업데이트 전 필수

1. **완료:** Railway production DB에 개인 플러스 migration을 적용하고 처분 이벤트 백필
   수량을 기존 종료 재고와 대조했습니다.
2. 프로젝트 Owner 권한으로 Railway production Volume의 최신 백업을 생성합니다.
3. 공유 기능이 포함된 iOS·Android production 빌드를 생성합니다.
4. 두 실계정으로 초대, 역할, 공간 전환, 재고 동기화, 알림, 계정 삭제를 검증합니다.
5. 요리 50건·사진 30건의 실호출 p95 원가가 개인 플러스 월 원가 예산 858원을
   충족하는지 확인합니다. 충족하지 못하면 신규 판매를 열지 않습니다.
6. **iOS 부분 완료:** App Store Connect의 개인 플러스 상품, 가격, 서버 알림,
   약관·개인정보 선언을 설정했습니다. 상품 심사 스크린샷·빌드 연결·심사 추가와
   Play Console 설정은 남아 있습니다.
7. iOS Sandbox와 Android License 계정으로 구매·복원·갱신·취소·환불을 검증합니다.
8. 기존 앱의 새 iOS 버전과 첫 자동 갱신 구독을 같은 심사에 넣고, Android는 internal
   검증 후 production 업데이트를 제출합니다.

관련 문서:

- [스토어 메타데이터 초안](./store-metadata-draft.md)
- [스토어 개인정보 선언 대조표](./store-privacy-declarations.md)
- [스토어 스크린샷 가이드](./store-screenshot-submission-guide.md)
- [iOS·EAS production 런북](./ios-eas-production.md)
- [개인 플러스 스토어 설정·출시 체크리스트](./subscription-store-rollout.md)

## P1 — 병행 또는 출시 직후

- 새 TestFlight와 Android internal 빌드에서 Mobile Sentry 수집 확인
- API·Admin 커스텀 도메인 연결
- Admin 권한, 쿠키, 감사 로그 보안 하드닝
- 푸시 스케줄러와 Expo receipt 처리 실수신 검증
- ProductMaster source-fields migration 적용 여부 확인
- 개인 플러스 구매 검증·복원 성공률, 환불률, AI 원가와 한도 도달률 운영 대시보드 확인

## 의도적으로 미룬 범위

- 가족 플러스·일회성 추천권 판매
- WebSocket/SSE 실시간 동기화와 공간 변경 이력
- 초대 QR·전화번호·공개 재사용 링크
- OCR·카탈로그 UX 고도화
- 영수증·냉장고 사진 일괄 등록: 2026-08-27 코드 완료, 플래그 기본 on
  (필요하면 API·모바일에 `false`/`0`/`off`를 함께 설정해 중단).
  운영 API migration과 환경값 반영은 다음 API/모바일 배포 때 확인.
  상세 [`archive/project-history-2026-08.md`](./archive/project-history-2026-08.md)

## 갱신 규칙

- Phase, P0, 블로커가 바뀌면 이 문서를 같은 변경에서 갱신합니다.
- 외부 서비스 상태를 확인한 날 `data_as_of`를 갱신합니다.
- 완료된 상세 기록은 [`archive/project-history-2026-08.md`](./archive/project-history-2026-08.md)처럼
  월별 아카이브로 이동합니다.
