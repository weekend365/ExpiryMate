---
status: active
owner: product-release
last_reviewed: 2026-10-28
source_of_truth: true
data_as_of: 2026-10-28
---

# 프로젝트 현황

이미 스토어에 출시된 장고야 부탁해의 운영 단계, 업데이트 우선순위, 블로커를 관리하는 정본입니다. 구현 방향은
[`ROADMAP.md`](./ROADMAP.md), 배포 절차는
[`operations/deployment.md`](./operations/deployment.md)를 확인하세요.

> 최신 공개 확인은 아래 2026-10-28 기록을 우선합니다. 과거 기록의 버전, 판매 플래그,
> 상품 승인 대기는 역사적 상태이며 현재 콘솔 상태로 해석하지 않습니다.

## 2026-10-28 · 1.4.4 양대 스토어 전체 공개 확인

[최종 공개 기록](../design/reviews/release-1.4.4/full-public-release.json)에서 iOS `1.4.4(66)`의
공개 App Store 조회·`READY_FOR_SALE`, Android `1.4.4(47)`의 production `completed`(100%)를
확인했습니다. 장고 중심 디자인과 생활 공간 배경 6종·27개 화면을 포함합니다.
사용자의 10월 25일 즉시 전체 공개 요청으로 승인 후 자동 공개했고, 기존 가격·전체 기기
검증의 한계는 [출시 기록](../design/reviews/release-1.4.4/README.md)에 남겼습니다.
로컬 검사는 분리 실행으로 1,500개가 통과했고 기본 DB 6개는 제외됐습니다. CI 원화 재현
검사 1건의 20초 제한 초과는 통과로 기록하지 않습니다. 운영 health·ready는 200입니다.

## 2026-10-13 · 1.4.3 양 스토어 정식 출시 완료

[정식 출시 기록](../design/reviews/release-readiness-2026-10-13/full-public-release.json)은 당시 출시 이력입니다.
사용자의 **“그냥 정식 출시해 뭔 단계적으로 하냐”** 요청에 따라 단계 배포를 해제했습니다.
iOS1.4.3(51)은 모든 사용자 즉시 업데이트로 저장한 뒤21:22 KST 공개했고, 한국 App Store의
공개 lookup·제품 페이지에서1.4.3을 확인했습니다. Google1.4.3(39)와 Data Safety는
21:25 KST 게시했으며 production **Google Play에 제공됨·출시율100%**를 직접 확인했습니다.
기존 국가 범위(iOS175개·Android대한민국)는 보존했습니다.

최종 Android 소스 `d1c703f`의 전체 테스트1,352개(API589·mobile577·shared163·root23),
타입·lint·문서 검사가 통과했습니다(API 통합6개 제외). Galaxy의 실제39·Play 서명,
연간/yearly 권한·Google ACK·갱신·복원과 재실행 후 플러스 유지를 확인했습니다.
iOS51은 월간 구매·갱신·복원이 확인됐습니다. Android 기간 추정값 오류는 화면·전역 자동
복구 모두 서버의 검증된 기간을 사용하도록 보완했습니다. SDK 한계와 최초 실패의 정확한
인과관계는 구분하며 [수정 기록](../design/reviews/release-readiness-2026-10-13/android-purchase-verification-fix.json)을 유지합니다.

사용자는 이번1.4.3의 iOS연간·타계정 복원·grace/hold/pause·환불/철회·재설치/오프라인·
전체RC 접근성/공유/푸시 실기기 QA 예외를 명시적으로 허용했습니다. PENDING 제외와 함께
해당 항목을 통과로 바꾸지 않고 예외로 기록합니다. 원가 예외도 원가 합격으로 기록하지 않습니다.

21:12 KST 새 snapshot41개 테이블·45개 migration·449개 constraint·167개 index·격리 복구·
pg_amcheck·보호 백업 해시가 일치했습니다. 공개 전 `IAP_ALLOW_SANDBOX_PURCHASES=false`로
원복하고 동일 API9cabee4 artifact만 재배포했습니다. deployment `0d589013-7aff-49a2-ba9d-2543bd2de152`
SUCCESS·운영 검사13개 통과입니다. 개인 판매·원가 예외·키·AI 한도·guardrail·Admin·Prisma는
유지했고 원격 push나 새 Railway 소스 업로드는 없습니다. 원본 dump는 저장소 밖0600 보호
폴더에 보존했으며 보고서에는 계정·거래·토큰·비공개 키 원문을 넣지 않았습니다.

Google 수집12개·공유7개 유형을 보존해 게시했습니다. 다운로드 증가·ReTrace 미첨부 경고와
전체SDK 실행 검증·GNU_RELRO 경계의 미완료 범위는 보존합니다. 이후 원가·실제 구매 검증·
복원·크래시/ANR 관측은 계속할 운영 항목이며 자동으로 미래 모니터링을 생성하지 않았습니다.

## 2026-10-10 · 1.4.3 최종 심사 제출 · 공개 대기

사용자의 **“최종 출시 진행해줘.”** 요청에 따라 두 스토어의 최종 심사를 제출했습니다.
[제출·검증 기록](../design/reviews/release-readiness-2026-10-10/final-release-submission.json)을
해당 날짜의 이력 기준으로 삼습니다.

- App Store `1.4.3`(51)은 22:41 KST 제출, **심사 대기 중**입니다.
  출시 방식은 수동이며 승인 후 업데이트를 7일간 단계적으로 배포하도록 설정했습니다.
- Google Play production `1.4.3`(37)과 Data Safety 수정을 함께 제출했습니다.
  자동 사전 검사가 완료됐고 콘솔은 **검토 중**입니다. 관리형 게시를 켰으며 승인 후
  기존 대한민국 대상의 5%부터 단계적으로 출시하도록 저장했습니다.
- 공개 버전은 아직 iOS `1.4.2`(48), Android `1.4.2`(35)입니다.
  심사 제출을 공개 출시 완료로 처리하지 않습니다.
- Google Play의 기존 테스트 계정 한 명을 라이선스 테스트에 연결했습니다. 두 기기의
  월 구독 Sandbox 영수증 승인·구매 의도 소비·복원 완료를 실제 서버 기록으로 확인했습니다.
  Google 결제 acknowledgement와 첫 테스트 갱신도 확인했습니다. 사용자는 두 기기에서
  **“장고 플러스가 시작됐어요”**, **“플러스 이용 중”** 표시를 확인했습니다.
  iPhone의 실제 영수증 소유자는 Apple 비공개 이메일 로그인 계정이어서 제공된 이메일만으로
  집계한 초기 누락을 바로잡았습니다. 검사 보고서에는 원문 계정·영수증·거래 식별자를 보존하지 않습니다.
- [Data Safety](./store-privacy-declarations.md)의 12개 수집 유형·7개 공유 유형을 저장하고
  11개 응답 수정(이름 선택 여부 포함)을 심사에 반영했습니다. Apple 15개 유형은 유지했습니다.
  최신 GMA 안내는 25.5.0, 설치 버전은 25.0.0이므로 보수적 신고와 전체 SDK 실행 검증은 구분합니다.
- QA·App Review 기간의 `IAP_ALLOW_SANDBOX_PURCHASES=true`를 런북에 따라 임시 적용했습니다.
  직전 일관된 snapshot의 41개 테이블·45개 migration·격리 복구·보호 백업 해시를 확인했습니다.
  기존 API `9cabee4`를 소스 업로드 없이 재배포했고 운영 상태·정책 URL·인증 거부 13개가
  통과했습니다. 서명·계정 결합·RTDN 인증·AI 한도·Admin은 유지했습니다.

공개 전에는 스토어 승인, 연 구독과 pending·계정 충돌·취소·grace·hold/pause·환불·철회 등
전체 수명주기 QA의 남은 항목, 새 RC의 전체 핵심 흐름·접근성·공간 권한·푸시 확인을 마쳐야 합니다.
공개 직전 새 백업·격리 복구를 확인하고 Sandbox 허용을 **false**로 복귀·재배포한 뒤 13개
운영 검사를 재확인합니다. 원가 정규 검증은 미완료이나 사용자가 승인한 개인 판매 예외가
적용되며 원가 `learning` 측정값을 통과로 바꾸지 않습니다.

## 2026-10-10 · 최종 제출 이전 점검 이력

아래 기록은 최종 심사 제출 이전의 진행 과정입니다. 판매 설정·구매 QA·개인정보 신고·
심사·공개 상태의 최신값은 위의 정식 출시 기록을 우선합니다.

- 공개 버전은 App Store `1.4.2`(48), Google Play production `1.4.2`(35)입니다.
  공개 출시·App Store 심사 제출은 수행하지 않았습니다.
- `6335e02` 소스의 iOS `1.4.3`(50)과 Android `1.4.3`(36) 서명 빌드가 완료됐습니다.
  [실제 IPA](../design/reviews/release-readiness-2026-10-10/ios-artifact-50.json)의 서명,
  SDK 26.5·버전·앱 ID·production push·Apple 로그인·PurchaseHistory를 확인했습니다.
  TestFlight 업로드와 iPhone의 실제 설치 버전 50을 직접 확인했으며, 사용자가 로그인·
  완전 종료/재실행·재고·사진 추가 화면을 정상으로 보고했습니다. 이후 두 플랫폼에서
  `장고 플러스` 메뉴 자체가 없다고 정정했으므로 가격 검사는 미완료로 되돌렸습니다.
  실제 결제·복원·사진 파싱·푸시 수신까지 검증한 결과는 아닙니다.
- [Android AAB](../design/reviews/release-readiness-2026-10-10/android-artifact-36.json)의
  서명 무결성·버전·target/compile SDK 36·AD_ID 제거·54개 LOAD와 ZIP 16KB 정렬을
  확인했습니다. 같은 AAB에서 만든 로컬 서명 APK는 공식 ARM64 16KB 이미지에서
  `PAGE_SIZE=16384`, `pageSizeCompat=0`으로 초기 화면·로그인 진입·프로세스 유지가
  통과했습니다. GNU_RELRO 끝 경계 44개는 추가 검토 대상이며 모든 SDK 실행 경로의
  호환성을 확정하지 않았습니다. production RN/Hermes는 공식 release AAR와 같고
  글자 크기 source 후보는 off입니다.
- 사용자 허용으로 Android 내부 테스트 36을 게시했고 Google이 요구한 내부 테스트
  자동 심사 범위만 허용받았습니다. production 35는 유지했습니다. 콘솔에 테스터 목록이
  없어 별도 허용 후 QA 계정 한 명을 등록해 트랙을 활성화했습니다. USB로 직접 읽은
  Galaxy의 앱은 당시 `1.4.2`(35)였으므로 그 정상 검사 보고를 RC 36의 통과로
  처리하지 않았습니다. 테스트 참여 자격과 기기를 확인하고 사용자의 Google 본인 인증
  후 무료 원격 설치를 진행했습니다. 현재 직접 읽은 버전은 `1.4.3`(36), 설치자는
  `com.android.vending`이며 APK 서명 검증과 Play Console 앱 서명 인증서 일치가
  통과했습니다. RC 36의 핵심 흐름 QA는 가격 메뉴 문제를 포함해 미완료입니다.
- 최신 운영 DB의 일관된 snapshot 백업과 로컬 격리 복구를 확인했습니다.
  41개 테이블의 행 수·catalog·45개 migration이 모두 일치했고 `pg_amcheck`도
  통과했습니다. 원본 dump는 저장소 밖의 권한 제한 백업 폴더에 보존했으며 격리 복구의
  사용자 데이터는 정리했습니다. [백업·설정 복구 기록](../design/reviews/release-readiness-2026-10-10/production-email-recovery.json)을 따릅니다.
  Railway volume의 자동 백업 일정은 별도로 미설정입니다.
- 사용자 허용으로 Google 구매 검증 서비스 계정의 **이메일만 수정**했습니다.
  기존 비공개 키와 다른 설정은 유지했고 재배포 후 실제 운영 설정으로 OAuth와
  `jango_plus` 상품 조회가 성공했습니다. [월·연 상품](../design/reviews/release-readiness-2026-10-10/google-subscription-config.json)은
  활성이고 한국 가격 4,900원·39,000원, grace 7일·14일입니다. 구매·복원은 미검증입니다.
- 사용자 허용으로 `6335e02`의 API·Admin 보안 수정을 운영에 배포했습니다.
  Multer 2.4.0·업로드 경계/안전한 400·Next 15.5.27이 반영됐고
  [운영 검증](../design/reviews/release-readiness-2026-10-10/server-security-deployment.json)에서
  `/health`의 소스 SHA 일치·`/ready`·공개 정책 페이지 200과 인증 없는 데이터
  GET 6경로 401을 확인했습니다. 운영 데이터·Prisma·판매 플래그·main push는 변경하지
  않았습니다. 새로운 실제 Sentry 이벤트의 수집 확인은 남습니다.
- 추가로 Google RTDN이 서명·audience만 확인하고 지정된 Push 계정 이메일과
  `email_verified`를 확인하지 않는 점을 발견했습니다. Google 콘솔에서 실제 Push 계정,
  endpoint/audience 일치·인증 on·payload unwrapping off를 확인했습니다.
  [수정 68bd324](../design/reviews/release-readiness-2026-10-10/google-rtdn-auth.json)는
  발신 계정을 제한하고 필수 설정 누락을 거부합니다. 추가 허용 후 새 snapshot 백업과
  격리 복구를 재확인하고 운영 API에 배포했습니다. `/health` SHA·`/ready`·공개 페이지·
  인증 거부 13개 확인이 통과했고 19:11 KST Google Push 테스트 알림의 확인 지표를
  관측했습니다. 기존 비공개 키·판매 플래그·Prisma는 유지했습니다.
- [플러스 메뉴 누락](../design/reviews/release-readiness-2026-10-10/subscription-entry-fix.json)은
  운영 원가 guardrail이 `subscriptionsEnabled=false`를 반환할 때 설정 진입점도 숨긴
  코드에서 발생했습니다. 수정 전 요리 4건·사진 1건으로 `learning`이며 유효 판매는 off였습니다.
  `ec4afd1`은 판매 중단·조회 대기/실패에도 설정 진입점과 구매 복원을 유지합니다.
  판매·원가 정책과 기존 위치·스타일은 보존했습니다. 수정 소스 `6da71d1`의 새 iOS
  `1.4.3`(51)의 [IPA 검사](../design/reviews/release-readiness-2026-10-10/ios-artifact-51.json)와
  TestFlight 처리·기존 내부 그룹 연결이 완료됐습니다. Android `1.4.3`(37)의
  [AAB 검사](../design/reviews/release-readiness-2026-10-10/android-artifact-37.json)도 통과했고
  기존 내부 테스트에 게시됐습니다. production 35·테스터는 유지했습니다. 사용자가 두
  플랫폼에서 메뉴 표시를 확인했습니다. Galaxy는 실제 설치 버전 37·Play 설치자·스토어
  인증서 일치를 직접 재확인했고 iOS 51의 직접 버전 읽기는 현재 불가합니다. 새 빌드의
  전체 핵심 흐름·화면·접근성 비교는 남습니다.
  EAS에는 비밀 파일·Git 이력·운영 자료·
  로컬 native 캐시를 제외한 905개 파일 38.3MB만 전송했습니다.
- 사용자가 **원가 검증 예외와 전체 개인 플러스 판매 열기**를 명시적으로 승인했습니다.
  [적용 기록](../design/reviews/release-readiness-2026-10-10/subscription-sales-unblock-plan.json)에
  따라 서버 `SUBSCRIPTION_COST_GATE_MODE=operator_override`를 적용합니다. 상품 표시·구매
  의도·새 영수증의 원가 조건에만 예외를 두고, 원가 측정·한도·다른 상품·Sandbox 거부를
  유지합니다. 기본 정책은 `required`, 긴급 판매 중단은 `SUBSCRIPTIONS_ENABLED=false`입니다.
  API `9cabee4`의 [운영 반영](../design/reviews/release-readiness-2026-10-10/subscription-sales-activation.json)이
  완료됐습니다. 새 snapshot의 41개 테이블·45개 migration·격리 복구·보호 백업을 확인했고,
  실제 health SHA 일치와 서버/인증 검사 13개, 유효 개인 판매 on을 확인했습니다.
  변경된 운영 변수는 예외 모드 하나뿐이며 Admin·키·원가 기준은 유지했습니다.
  사용자가 앱 종료·재실행 후 iPhone·Galaxy 모두 월 4,900원·연 39,000원 가격과
  가입 버튼 표시를 확인했습니다. 실제 결제·복원·원가 표본 검증과 공개 앱 업데이트
  출시는 별도 미완료입니다.
- 기본 테스트 1,345개(장고 23·shared 163·API 588·mobile 571)가 통과했습니다.
  API opt-in DB 6개는 기본 실행에서 생략했으며 변경 전 깨끗한 격리 DB의 45개 migration·
  통합 6개는 통과했습니다. lint·docs·각 workspace typecheck·환경 예시 parity·API 빌드가
  통과했습니다. Google SDK의 overloaded mock 타입 오류는 수정 후 API 타입 검사로
  재확인했습니다. 기존 Admin 빌드·양 플랫폼 production Hermes export·브랜딩 audit와
  iOS EAS worker prebuild도 통과했습니다.
- Google Play Data Safety의 사진·구매 내역·충돌·성능 신고와 쿠팡/SDK 공유 응답에
  불일치가 있습니다. [신고 수정안](../design/reviews/release-readiness-2026-10-10/store-corrections.json)은
  로컬 초안이며 콘솔 반영은 하지 않았습니다. App Privacy 15개 데이터 유형과 정책 URL,
  Apple 구독 승인·한국 가격은 확인했습니다.
- [운영 원가·구독·푸시 집계](../design/reviews/release-readiness-2026-10-10/runtime-aggregates.json)는
  요리 4건·사진 1건 legacy 표본입니다. 정책 50건·30건·월 858원과 운영 10건·3건·
  월 2,000원 설정이 다릅니다. 현재 모델의 p95 관문을 충족하지 않으며 수동 screenshot
  권한은 실제 결제 근거가 아닙니다. 판매 플래그·guardrail·purchase intent·resync는 on이나
  원가 판정은 여전히 `learning`·미통과입니다. 위의 명시적 승인에 따른 개인 판매 예외로
  유효 신규 판매는 on이며 Sandbox·가족 플러스·추천권은 off입니다.
  과거 푸시 100건의 receipt 오류는 없지만 새 RC의 실제 수신은 별개입니다.
- Galaxy 글자 크기 후보 2는 debug fixture의 live/cold 배율·측정과 입력·초점·선택·
  counter·React 인스턴스 보존을 통과했습니다. [집중 QA 기록](../design/reviews/release-readiness-2026-10-10/android-font-scale-qa.json)의
  source release·전체 앱·스크린리더 검증은 남으며 출시 채택은 하지 않았습니다.
- [의존성 감사](../design/reviews/release-readiness-2026-10-10/dependency-audit.json)의 고유
  GHSA는 117→65, critical 5→0입니다. 남은 high 45·moderate 18·low 2는 실행 경로별
  검토 대상이며 모든 권고를 안전으로 판정하지 않았습니다. `pnpm audit` 자체는 메모리
  부족으로 완료하지 못했습니다.

이 시점의 출시 판정은 **보류**였습니다. 메뉴 수정 RC 51·37의 실제 설치·화면·회귀, 새 RC 푸시·
구매/복원·권한/공간 QA, 개인정보 신고 반영·원가 관문이 남습니다. RTDN 발신자 제한의
운영 반영과 결제 없는 실제 테스트 알림 확인은 완료했습니다. opt-in 글자 크기 후보는
기본 off이며 이번 출시 채택 범위가 아닙니다.

## 현재 위치

| 영역 | 상태 | 남은 관문 |
|---|---|---|
| 모바일 핵심 UX | 구현 완료에 가까움 | 새 release candidate 회귀 QA |
| 인증 | 소셜 4종·이메일 실기기 검증 | 새 빌드에서 공유 초대 복귀 재검증 |
| API | 개인 판매 예외 운영·Sandbox 거부 원복·운영 검사13개 통과 | 원가·실제 구매/복원 관측 |
| Admin | Railway 배포 | 보안 하드닝·플랜별 원가/수익 지표 운영 점검 |
| 스토어 | iOS66·Android47의 1.4.4 전체 공개 확인 | 실제 업데이트·구매·크래시 관측 |

**현재 단계:** 1.4.4 전체 공개 완료와 운영 관측

**상태 판단 주의:** 앱 자체는 이미 출시됐습니다. 개인 판매는 명시적으로 승인한 원가 예외로
열렸고 양 플랫폼의 월 구독·복원이 확인됐습니다. 1.4.4는 디자인·배경 업데이트이며 이번 버전의
즉시 공개 요청에 따라 전체 공개했습니다. 기존 원가 예외와 미완료 QA를 검증 통과로 해석하지 않습니다.

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
