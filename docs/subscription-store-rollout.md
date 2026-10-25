---
status: active
owner: product-release
last_reviewed: 2026-10-25
source_of_truth: true
data_as_of: 2026-10-25
---

# 개인 플러스 스토어 설정·출시 체크리스트

장고야 부탁해는 이미 iOS와 Android에 출시되어 있습니다. 이 문서는 신규 앱 등록이
아니라 **기존 앱에 첫 자동 갱신 구독을 추가하는 업데이트** 절차입니다.

## 2026-10-25 남은 iOS QA 결과·정리

사용자가 정리 완료 뒤 미완료 항목도 진행하도록 다시 요청했다. 새 격리 QA는 기존 비용
한도 안에서 **10월 25일 15:59 KST까지 최대 24시간** 진행했고 14:12 KST에 새 프로젝트를 삭제했다. 이전 QA 삭제·계정 복원과
기한 내 삭제 실패 이력은 그대로 보존한다. 새 환경·빌드 60과 실제 결과는
[10월 24일 QA 기록](../design/reviews/store-qa-20261024/README.md)을 따른다. 운영 설정과
판매 정책은 보존했으며 AI 유료 호출은 추가하지 않았다.

10월 25일 실제 iOS 60·61에서 월간 구매·갱신, 명시적 취소와 같은 Sandbox의 취소 기간 만료,
공유 권한 회수 후 개인 공간 복귀·5개 탭, 같은 계정 복원·타 계정 거부 안내 한 번,
정상 스케줄러 푸시 수신·개인 보관함 탭 이동을 확인했다. 연간 구매 뒤 네이티브 환불 요청을
접수했고, 만료 전 StoreKit 활성 거래가 사라진 뒤 정상 검증 API로 Apple에 재검증해
`revoked`·비활성을 확인했다. 동일 앱 프로세스도 무료 상태를 표시했고 유료 리포트는 403이었다.
이는 수동 정상 재검증 경로이며 자동 QA webhook 수신은 미검증이다. 취소·승인 대기 안내의
최소 수정 후 전체 테스트 1,457개와 docs·lint·typecheck가 통과했다. 빌드 64는 TestFlight에서
설치·실제 구매창 취소 재검증을 통과했다. 취소 뒤 실패 안내 없이 구매 버튼이 복귀하고 새 거래가
없었다. 같은 빌드의 실제 Sandbox 승인 대기에서도 Apple ‘허락 요청’ 뒤 기존 안내 한 번과
버튼 복귀, 활성 월간 거래·서버 권한 없음을 확인했다. 이는 Apple의 QA 전용 네이티브 옵션을
사용한 대기 진입 검증이며 승인·거절 해소는 Sandbox가 지원하지 않아 미검증이다.
가격의 SDK USD·네이티브 KRW 차이는 미통과로 남겼다.

[최종 정리](../design/reviews/store-qa-20261024/qa-cleanup-result.json)에서 QA 프로젝트·서비스·
볼륨 인스턴스 부재와 API 404, 운영 프로젝트 보존을 확인했다. USB 보조 앱·이번 QA 전용
App ID·개발 프로필·제어 프로세스를 제거했고 알림·접근성·구매 중단·QA 승인 대기 옵션을
원래 상태로 복원했다. QA 앱 계정·Sandbox는 로그아웃했고 원래 미디어 계정 복원은 사용자가
확인했다. 기존 앱·운영 서명·인증서·기기는 보존했다. 설치된 QA 64의 API는 종료 상태다.
이전 QA 포함 최종 계측 Railway 사용료는 $0.32423899이며 청구서는 미확정이다.
최종 소스의 새 로컬 DB에 migration 45개를 적용해 통합 테스트 6개를 skip 없이 재확인했고
임시 로컬 DB도 정리했다. 전체 테스트와 합산하거나 기본 실행의 제외 항목을 통과로 세지 않았다.
아래는 이전 종료 시점의 기록이다.

## 2026-10-20 격리 스토어 QA

**10월 24일:** 최초 72시간은 10월 23일 15:06 KST에 종료됐다. Railway OAuth 갱신 실패로
로컬 감시의 사용량 조회·자동 삭제가 실패했으며, 기한 내 정리를 충족하지 못했다.
10월 24일 사용자 로그인으로 인증을 복구한 뒤 15:47 KST에 해당 QA 프로젝트가 삭제됐다.
프로젝트 부재·QA API 404와 운영 프로젝트 보존을 확인했다. 이전 QA를 포함한 삭제 직전
계측 사용료는 $0.24882127이며 최종 청구액은 미확정이다. 새 QA 리소스는 만들지 않았다.

iOS 58에서 멤버의 초대 참여·공간 분리·탈퇴와 알림 권한 거부 안내를 추가 확인했다.
권한 회수 후 화면 로딩과 복원 502의 잘못된 계정 충돌 안내를 최소 수정했다. 관련 73개·
모바일 전체 621개 및 docs·lint·typecheck가 통과했다. QA 빌드 59는 완료했지만
TestFlight 제출·설치·실기기 재검증은 미완료다. 월간·갱신·자연 만료·환불·pending,
실제 푸시·탭·가격 일관성·취소 후 서버 반영은 통과로 처리하지 않는다.
QA Apple 프로필·App ID와 로컬 USB 제어 프로세스를 정리했고, 재연결한 iPhone에서 보조 앱
제거와 부재를 확인했다. 사용자는 새 QA를 만들지 않고 정리·계정 복원만 완료하도록 결정했다.
사용자가 원래 미디어 계정 복원과 QA Sandbox 로그아웃 완료를 확인해 정리를 마쳤다.
계정 상태는 사용자 확인이며 에이전트가 개인 계정 정보를 조회하지 않았다. 미검증 항목을
자동 재개하거나 통과로 처리하지 않는다. 자세한 현재 상태는
[QA 정리 기록](../design/reviews/store-qa-20261021/qa-cleanup-progress.json)을 따른다.

아래는 10월 21일 작업 당시의 기록이다.

10월 21일 새 격리 QA에서 Android 45의 연간 구매·복원·계정 충돌·취소·환불·푸시를 확인했다.
취소 응답 해석과 앱 복귀 시 구독 갱신 문제를 수정했고, Android 46의 실제 월간 구매·환불 후
동일 프로세스 복귀에서 무료 상태 갱신을 재검증했다. iOS 58은 내부 TestFlight에서 사용
가능하다. 실제 iPhone의 새 Sandbox 계정과 승인된 USB XCTest 연결로
연간 미청구 구매·같은 계정 복원·통제된 타 계정 복원 거부를 확인했다. 구매자는 연간
Sandbox 이용권 활성, 멤버는 비활성이고 최종 거부 안내는 한 번만 표시됐다.
스토어 계정 불일치로 거부되던 초기 시도는 사용자 인증과 별도 승인된 미디어 계정
로그아웃 후 해결됐다. Sandbox 연간 취소는 확인했으며, 자연 만료 예정은
10월 21일 17:43 KST다. 서버 취소 갱신·월간·공유·푸시와 스토어 전환 뒤 가격 일관성은
계속 검증한다. QA 종료 후 미디어 계정과 임시 보조 앱 정리를 확인해야 한다.
현재 `store-qa` origin은 새 QA 주소로 갱신했다. 기존 예산과 최초 72시간 종료 시점
(10월 23일 15:06 KST)을 유지한다. 최신 진행 상태는
[재개 기록](../design/reviews/store-qa-20261021/README.md)을 따른다. 아래는 10월 20일
중단 시점의 기록이다.

운영과 분리한 Railway `jango-qa-20261020`에 새 API·PostgreSQL과 가상 계정 두 개를
준비했다. 각 서비스는 0.5GB·1vCPU·1 replica로 제한했다. QA에서만 Sandbox 검증을
허용하고 AI 호출·SMTP 발송은 껐다. 기존 공개 앱·운영 DB·키·정책·워크스페이스 공통
비용 한도·운영 스토어 알림 연결은 변경하지 않았다.

`apps/mobile/eas.json`의 `store-qa` build/submit 프로필은 기존 앱 식별자·서명을 사용해
TestFlight와 Google internal에 전달한다. 공개 API와 OAuth callback은 명시한 QA origin과
일치해야 하고 설정이 빠지면 빌드가 실패한다. QA 주소는 임시 환경을 다시 만들 때 갱신한다.
QA iOS 이미지는 Expo SDK 54용 `macos-sequoia-15.6-xcode-26.0`으로 고정했다.
상속한 `latest`의 Xcode 27에서 기존 Pod 최소 OS 설정으로 빌드가 실패한 실제 결과에 따른
조치다. production 프로필의 `latest`는 별도 변경하지 않았다.

출시된 1.4.3 train은 Apple이 새 업로드를 거부했다(90062·90186). EAS 제출 성공은 Apple
처리 통과와 구분한다. QA에만 `JANGO_STORE_QA_APP_VERSION=1.4.4`를 적용하고
`app.json`의 기존 출시 버전보다 높아야 한다는 검사를 추가했다. production 버전과 기존
식별자·서명은 유지한다. 이후 QA 생성 시에도 Apple의 실제 train 상태를 확인한다.

사용자의 중단 요청으로 이번 QA 프로젝트는 증거와 사용량을 보존한 뒤 삭제했다.
**당시 프로필의 임시 QA 주소는 더 이상 사용할 수 없다.** 재개 시 새 격리 환경과 예산·기간을
확인하고 API·OAuth origin을 갱신한 다음 새 QA 바이너리를 만든다. 기존 비용·72시간 한도를
새 프로젝트 생성으로 자동 초기화하지 않는다.

Android 42·43에서 월간 구매·복원·타 계정 거부, 공유 공간 참여·탈퇴·권한 회수와 실제
푸시 수신·탭 이동을 확인했다. 복원 실패 안내 중복을 수정해 재현 테스트 4개가 통과했지만
수정 후 실기기 재검증은 남았다. Android 44 빌드는 중단했고 iOS 1.4.4(56)는 Apple 처리와
내부 TestFlight 배포 가능 상태를 확인했다. 연간 결제창은 구매하지 않고 닫았고, pending·환불·
iPhone 실기기 검증은 미완료다. [상세 결과·재개 순서](../design/reviews/store-qa-20261020/README.md)를 따른다.

```sh
cd apps/mobile
eas build --platform all --profile store-qa
eas submit --platform ios --profile store-qa --id QA_BUILD_ID
eas submit --platform android --profile store-qa --id QA_BUILD_ID
```

[격리 환경](../design/reviews/store-qa-20261020/environment.json)과
[실제 HTTP 검증](../design/reviews/store-qa-20261020/api-checks.json)을 보존한다.
HTTP 확인·mock 스토어 자동 테스트·실제 스토어/기기 결과를 구분한다. 실제 기기 수명주기
시나리오는 증거가 있는 항목만 통과로 기록한다. QA 프로젝트 누적 사용료 $7 또는 생성 후
72시간에 도달하면 검증을 끝내고 증거를 보존한 뒤 이 QA 프로젝트만 정리한다.

## 현재 상태 — 2026-10-13 정식 출시 완료

[정식 출시 기록](../design/reviews/release-readiness-2026-10-13/full-public-release.json)이 최신 기준입니다.
iOS1.4.3(51)은21:22 KST 즉시 모든 사용자에게 출시했고 공개 한국 App Store에1.4.3이
표시됩니다. Android1.4.3(39)와 Data Safety는21:25 KST 게시됐으며 production 출시율100%·
Google Play에 제공됨을 확인했습니다. 사용자의 최종 요청으로 기존 iOS7일·Android5% 계획을
해제했습니다. 기존 iOS175개 국가·Android대한민국·서명·상품·키·개인정보 응답은 보존했습니다.

최종39의 실제 Play 설치·서명, 연간/yearly·ACK·갱신·복원과 재실행 후 플러스 유지가
확인됐습니다. iOS51의 월간 구매·복원과 구분합니다. 전체 테스트1,352개·타입·lint·문서가
통과했고 API 통합6개는 제외돼 있습니다. [수정·검증 기록](../design/reviews/release-readiness-2026-10-13/android-purchase-verification-fix.json)과
[Google 교체·재심사 기록](../design/reviews/release-readiness-2026-10-13/android-production-39.json)을 유지합니다.

사용자는 이번1.4.3의 iOS연간·타계정 복원·grace/hold/pause·환불/철회·재설치/오프라인·
전체RC 접근성/공유/푸시 실기기 QA 예외를 명시적으로 허용했습니다. PENDING 제외와 해당
예외를 실제 통과로 바꾸지 않습니다. 원가learning·개인 판매 원가 예외·AI 한도·guardrail은
유지합니다. 공개 전21:12 KST 새 보호 백업·격리 복구를 확인하고 Sandbox 허용을false로
원복·동일 API artifact 재배포·운영 검사13개를 완료했습니다.

## 2026-10-10 최종 심사 제출 이력

- [최종 제출·QA 기록](../design/reviews/release-readiness-2026-10-10/final-release-submission.json)이
  해당 날짜의 기준입니다. 당시 공개 버전은 iOS1.4.2(48), Android1.4.2(35)였습니다.
- 메뉴 수정 소스 `6da71d1`의 iOS 1.4.3(51)을 22:41 KST App Review에 제출했고
  **심사 대기 중**입니다. 빌드 51 연결·기존 6개 스크린샷·심사 로그인 정보 유지·새 심사 노트를
  확인했습니다. 수동 출시와 7일 단계적 업데이트를 설정했습니다.
- 같은 소스의 Android 1.4.3(37)을 production 심사에 제출했습니다. 기존 서명 AAB를
  라이브러리에서 연결했고 기존 대한민국 범위·5% 초기 rollout을 저장했습니다.
  관리형 게시가 켜졌으며 자동 사전 검사 완료 후 **검토 중**입니다. 비차단 경고는 다운로드
  20.2MB 증가(66.1MB)와 ReTrace 파일 미첨부이며 native debug symbols는 있습니다.
  서비스 계정의 production validate/commit 403은 권한을 늘리지 않고 비공개 edit를 삭제한 뒤
  사용자 콘솔로 완료했습니다. 실패한 API 시도는 외부 production 변경을 commit하지 않았습니다.
- [Play Data Safety](./store-privacy-declarations.md)는 누락·공유·임시 처리·필수 여부
  11개 응답을 수정해 12개 수집 유형·7개 공유 유형으로 저장하고 같은 심사에 포함했습니다.
  설치 GMA25.0.0에 대한 정확한 vendor 확인·전체 SDK 경로 QA와 보수적 신고는 구분합니다.
- Apple 월·연 구독은 승인, 한국 가격은 4,900원·39,000원이고 가족 공유·할인은 off입니다.
  Google 월·연 base plan은 활성, 같은 한국 가격·grace7일/14일이며 기존 키를 유지한
  구매 검증 이메일 복구·RTDN 지정 발신자 인증·실제 테스트 알림 확인을 마쳤습니다.
- 기존 QA 한 명의 라이선스 테스트 목록을 활성화했습니다. iPhone TestFlight51과
  Galaxy Play 내부37에서 월 구독 Sandbox 승인·구매 의도 소비·복원 완료를 서버 기록으로
  확인했습니다. Google acknowledgement와 첫 테스트 갱신도 확인했습니다. 사용자는 두
  기기에서 “장고 플러스가 시작됐어요”와 “플러스 이용 중”을 확인했습니다. Apple 영수증의
  비공개 이메일 로그인 소유자와 Play 결제 계정/앱 계정 차이는 메모리에서 대조했습니다.
  검사 보고서에는 원문 계정·거래·토큰을 기록하지 않습니다. Galaxy37 버전·Play 서명은 직접 확인했으며
  iOS51 설치는 사용자 확인으로 직접 버전 읽기와 구분합니다.
- API `9cabee4`에 승인한 `SUBSCRIPTION_COST_GATE_MODE=operator_override`가 적용돼
  개인 판매는 on입니다. 원가 `learning`, legacy 요리4·사진1, 정책50·30·858원과 운영
  10·3·2,000원 기준을 통과로 바꾸지 않았습니다. 가족·유료 추천권은 off, AI 한도·
  guardrail·구매 의도·서명/계정 검증은 유지합니다. 유료 모델 평가를 새로 실행하지 않았습니다.
- **현재 `IAP_ALLOW_SANDBOX_PURCHASES=true`는 QA·App Review용 임시 설정입니다.**
  직전 새 snapshot41개 테이블·45개 migration·격리 복구·보호 해시를 확인하고 기존 API
  artifact만 재배포했습니다. 운영 검사13개 통과·Admin 유지입니다.

공개 전 스토어 승인과 남은 연 구독·pending·계정 충돌·취소/grace/hold/pause/환불/철회
수명주기 QA, 새 RC 전체 흐름·공간·접근성·푸시 확인을 완료합니다. 공개 직전 새 백업·격리
복구를 확인하고 Sandbox 허용을 **false**로 되돌려 재배포·운영 검사한 뒤 수동/관리형
게시를 실행합니다. 승인 대기와 공개 완료를 구분하며 원가 예외를 원가 합격으로 기록하지 않습니다.

## 2026-09-12 준비 이력

- App Store Connect 현재 출시 버전: `1.4.0`(45)
- Jango Plus 구독 그룹: 심사 준비됨. 월간·연간 상품: 제출 준비 중
- 첫 구독 그룹만 들어 있는 심사 초안은 제출 불가: 새 앱 버전과 두 구독 상품이 함께 필요
- 가격 조회 무한 대기 수정 버전 `1.4.1`(46)의 EAS production 빌드 및 Apple 업로드 성공
- App Store Connect에 `1.4.1` 제출 준비 중 버전 생성 확인
- App Store Connect의 `1.4.1` 버전에 빌드 `46` 연결 및 저장 완료
- 이 작업은 빌드 업로드까지이며 App Review 제출·상품 승인·출시는 아직 완료하지 않음
- TestFlight 가격 조회·구매·복원 QA 및 실제 페이월 심사 스크린샷을 확인한 뒤 함께 제출

아래 8월 29일 체크리스트는 준비 이력이며 현재 완료 상태는 위 기록을 우선합니다.

## 0. 진행 스냅샷 — 2026-08-29

### 완료

- 유료 앱 계약·세금·은행 상태 `Active`
- `Jango Plus` 그룹과 월간 `expirymate_premium_monthly`, 연간
  `expirymate_premium_yearly` 상품 생성
- 월 4,900원·연 39,000원, 전체 판매 지역, 같은 구독 등급, 가족 공유 끔,
  무료 체험·Offer 없음
- 한국어 그룹·상품 현지화 등록
- App Store Server Notifications V2 production·Sandbox URL 등록 및 테스트 알림
  API `201` 성공
- App Store Server API 인앱 구입 키와 Apple Root CA를 Railway production에 등록하고
  신규 배포 `/ready` 200 확인
- Billing Grace Period를 Sandbox only·16일·Paid to Paid로 설정
- Privacy·Privacy Choices URL과 App Privacy 15개 데이터 유형 게시, Tracking `No`
- iOS 1.4.0 메타데이터와 Support·Marketing URL 저장, 수동 출시 선택
- 저장소 버전 1.4.0, EAS remote auto-increment 설정, iOS Pods 동기화 검증
- 2026-08-29 기준 모바일 타입 검사, 테스트 255개, CocoaPods deployment 검증 통과
- EAS production 환경에서 API·OAuth·AdMob·Sentry 공개 환경값 로드 확인
- EAS remote iOS buildNumber `35` 확인. 9월 1일 auto-increment 예상 번호는 `36`

### 2026-09-01 빌드 전에 남은 수동 조치

- [x] App Store Connect 저작권을 `2026 devnamu`로 수정
- [ ] 최신 캡처에 다시 노출된 심사 계정 비밀번호를 재교체하고 App Store Connect 로그인
      정보를 재갱신
- [x] 심사 전용 계정 로그인, 홈 정상 표시, 설정의 `함께 쓰는 냉장고` 진입점 확인
- [x] 심사 계정 소유의 `Apple 심사 냉장고` 생성과 활성 공간 상태 확인
- [x] 두 번째 구성원의 1회용 코드 수락과 소유자 화면의 `2명이 함께 써요` 확인
- [x] 소유자 계정이 등록한 활성 재고 5개가 두 번째 계정에 동기화되는지 확인
- [x] 두 번째 계정의 양파 수량 수정이 소유자 계정에 동기화되는지 확인
- [x] 소비 3건·폐기 2건을 기록해 홈 브리핑 준비 조건 충족
- [x] 앱 강제 종료·재실행 후 심사 계정 세션, 선택 공간, 재고·브리핑 상태 유지 확인
- [ ] 9월 1일 빌드에서 설정 → 장고 플러스 진입과 실제 지역화 가격 재확인
- [ ] 월간·연간 상품의 Review Information에 넣을 실제 페이월 스크린샷 준비
- [ ] 심사 노트는 [`store-metadata-draft.md`](./store-metadata-draft.md)의 정본을 사용하되
  실제 심사 계정과 빌드 번호만 제출 직전에 채움
- [x] 대한민국 연령 등급 `4+` 표시 확인
- [ ] 수출 규정 응답 최종 확인

### 2026-09-01 이후 순서

1. EAS remote iOS buildNumber가 여전히 `35`인지 확인하고 production 빌드를 생성합니다.
   다른 빌드가 먼저 생성됐다면 해당 최신 번호에서 자동 증가하도록 두며 `36`을 강제로
   덮어쓰지 않습니다.
2. TestFlight 처리 완료 후 1.4.0 버전에 빌드를 연결합니다.
3. 필요한 기간에만 `IAP_ALLOW_SANDBOX_PURCHASES=true`를 적용하고 월간·연간 구매,
   취소, 갱신, grace, 만료, 복원, 타 계정 충돌을 검증합니다.
4. 구독 상품 두 개의 Review Information과 심사 스크린샷을 완성합니다.
5. 1.4.0 앱 버전과 첫 구독 두 개를 같은 심사 제출에 추가합니다.
6. 원가 No-Go와 release QA가 통과하기 전에는 수동 출시하지 않고
   `SUBSCRIPTIONS_ENABLED=false`를 유지합니다.

### 별도 남은 범위

- Railway production Volume 최신 백업
- 요리 50건·사진 30건 실제 원가 표본과 p95 No-Go 판정
- Google Play 판매자/API 권한, `jango_plus` base plan, RTDN, Data Safety 설정
- Android internal AAB와 License Tester 결제 QA

## 1. 코드와 콘솔에서 반드시 일치할 값

| 항목 | 값 |
|---|---|
| 현재 공개 앱 버전 | `1.4.3` (iOS51·Android39) |
| iOS Bundle ID | `com.expirymate.mobile` |
| Android package | `com.expirymate.mobile` |
| Apple 월간 Product ID | `expirymate_premium_monthly` |
| Apple 연간 Product ID | `expirymate_premium_yearly` |
| Google subscription Product ID | `jango_plus` |
| Google 월간 Base plan ID | `monthly` |
| Google 연간 Base plan ID | `yearly` |
| 한국 월간 가격 | 4,900원 |
| 한국 연간 가격 | 39,000원 |
| 무료 체험·도입 할인 | 없음 |
| production Apple 알림 | `https://api-production-1504.up.railway.app/subscriptions/notifications/apple` |
| production Google push | `https://api-production-1504.up.railway.app/subscriptions/notifications/google` |

Product ID와 Base plan ID는 코드 계약입니다. 오타가 난 상품을 만든 경우 코드를
그 오타에 맞추지 말고, 판매 전에 올바른 ID로 새 상품 또는 base plan을 만듭니다.

## 2. 공통 선행 조건

- 실제 콘솔의 최신 iOS build number와 Android versionCode를 확인하고 다음 빌드에서
  각각 더 큰 값이 생성되는지 확인합니다. 저장소 `app.json`의 로컬 `1`을 콘솔의
  실제 최신 번호로 오해하지 않습니다. EAS remote version이 정본입니다.
- Railway migration과 API·Admin·법적 페이지를 먼저 배포하되
  `SUBSCRIPTIONS_ENABLED=false`로 신규 구매 진입을 닫아 둡니다.
- `https://jango.devnamu.com/privacy`, `/privacy/choices`, `/terms`가 로그인 없이
  열리고 인앱 페이월의 링크와 같은 문서인지 확인합니다.
- 월간·연간 상품은 기존 앱이 판매 중인 국가/지역과 맞춥니다. 한국 가격을 정확히
  입력한 뒤 다른 통화의 자동 환산 가격도 과도하게 어긋나지 않는지 검토합니다.
- 실호출 원가 기준 `60 × 요리 p95 + 30 × 사진 p95 ≤ 858원`을 통과하지 못하면
  상품을 활성화했더라도 앱의 판매 플래그를 열지 않습니다.

## 3. App Store Connect

### 3.1 계약·세금·은행

1. App Store Connect → **Business → Agreements**로 이동합니다.
2. Account Holder가 **Paid Apps Agreement**를 수락하고 상태가 `Active`인지 봅니다.
3. Banking과 Tax 양식의 누락·검증 대기가 없는지 확인합니다.
4. 앱과 IAP tax category는 실제 서비스에 맞게 검토합니다. 별도 판단 근거가 없다면
   기본 `App Store software`를 유지하고, 세무 판단이 필요하면 전문가 확인 후 바꿉니다.

### 3.2 구독 그룹과 상품

1. **Apps → 장고야 부탁해 → Monetization → Subscriptions**로 이동합니다.
2. 구독 그룹 하나를 만듭니다.
   - Reference Name: `Jango Plus`
   - 한국어 Display Name: `장고 개인 플러스`
   - 월간과 연간을 다른 그룹으로 나누지 않습니다.
3. 같은 그룹에 월간 상품을 만듭니다.
   - Reference Name: `Jango Plus Monthly`
   - Product ID: `expirymate_premium_monthly`
   - Duration: `1 Month`
   - 한국어 Display Name: `개인 플러스 월간`
   - 설명: `광고 없는 AI 추천과 폐기 예방 리포트`
   - 대한민국 가격: `₩4,900`
4. 같은 그룹에 연간 상품을 만듭니다.
   - Reference Name: `Jango Plus Yearly`
   - Product ID: `expirymate_premium_yearly`
   - Duration: `1 Year`
   - 한국어 Display Name: `개인 플러스 연간`
   - 설명: `개인 플러스 1년 이용, 월간 대비 약 34% 절약`
   - 대한민국 가격: `₩39,000`
5. 두 상품은 혜택이 같고 기간만 다르므로 같은 subscription level에 둡니다.
6. Availability는 현재 앱 판매 지역과 맞추고, Family Sharing은 이번 범위에서 끕니다.
7. Introductory Offer, Promotional Offer, Offer Code는 만들지 않습니다.
8. 각 상품의 Review Information에 실제 페이월 스크린샷과 심사 메모를 넣습니다.

### 3.3 첫 구독 심사

이 앱에서 처음 제출하는 자동 갱신 구독이므로 새 앱 버전이 반드시 필요합니다.

1. 기존 앱에 새 iOS 버전을 만듭니다. 버전 문자열은 빌드와 정확히 맞춥니다.
2. TestFlight를 통과한 새 빌드를 선택합니다.
3. 월간 상품, 연간 상품, 구독 그룹에서 각각 **Add for Review**를 누릅니다.
4. 새 앱 버전, 구독 그룹, 두 구독 상품이 **같은 draft submission**에 들어 있는지
   확인한 뒤 Submit for Review 합니다.
5. 심사 노트에는 설정 → 개인 플러스 진입 경로, 복원 버튼, 무료 체험 없음, 데모 계정,
   무료 기능 유지, 월/일 한도와 타 계정 구매 충돌 처리 방법을 적습니다.

### 3.4 App Store Server Notifications V2

1. **Apps → 장고야 부탁해 → General → App Information**으로 이동합니다.
2. App Store Server Notifications의 Production Server URL에 다음을 입력합니다.
   `https://api-production-1504.up.railway.app/subscriptions/notifications/apple`
3. Version은 **V2**를 선택합니다.
4. Sandbox Server URL은 안정적인 staging API가 있으면 staging의 같은 경로를 넣습니다.
   staging을 운영하지 않으면 production URL을 같이 사용하되, QA·심사 기간에만
   `IAP_ALLOW_SANDBOX_PURCHASES=true`로 둡니다. 공개 직전 백업·격리 복구를 확인한 뒤
   `false`로 내리고 재배포·운영 검사를 마칩니다.
5. App Store Connect에서 test notification을 보내 API 2xx와 로그를 확인합니다.

### 3.5 Grace period와 개인정보

1. **Subscriptions → Billing Grace Period**에서 먼저 Sandbox only로 켭니다.
2. 무료 체험이 없으므로 `Only Paid to Paid Renewals`, 16일을 권장 시작값으로 둡니다.
3. Sandbox에서 grace 진입·회복·만료 권한을 확인한 뒤 Production and Sandbox로 바꿉니다.
4. **App Privacy**에서 `Purchases`를 추가하고 다음처럼 답합니다.
   - 목적: App Functionality
   - 사용자에게 연결됨: Yes
   - Tracking: No
   - 결제 카드번호는 앱이 직접 받지 않으므로 수집한다고 표시하지 않음
5. 구매 이력 외 기존 SDK·사진·사용자 콘텐츠 선언은
   [`store-privacy-declarations.md`](./store-privacy-declarations.md)와 대조한 뒤 Publish 합니다.

## 4. Google Play Console

### 4.1 판매자·API 권한

1. **Developer account → Payments profile**에서 merchant payments profile과 은행·세금
   상태를 확인합니다.
2. Google Cloud에서 Google Play Developer API를 활성화합니다.
3. 구매 검증 전용 service account를 만들고 Play Console **Users and permissions**에
   초대합니다.
4. 해당 앱에 최소한 다음 권한을 부여합니다.
   - View financial data, orders, and cancellation survey responses
   - Manage orders and subscriptions
5. service account 이메일과 private key를 Railway의
   `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`에
   저장합니다. 키 파일은 저장소나 EAS public env에 넣지 않습니다.

### 4.2 Subscription과 base plans

1. **Monetize with Play → Products → Subscriptions**로 이동합니다.
2. subscription을 하나 만듭니다.
   - Product ID: `jango_plus`
   - Name: `장고 개인 플러스`
   - Benefits 예시: `광고 없는 AI 추천`, `30/90일 소비·폐기 추세`,
     `주간 폐기 예방 브리핑`, `재고 기반 실천 제안`
   - 혜택 칸에 가격이나 무료 체험 문구를 넣지 않습니다.
3. 자동 갱신 base plan `monthly`를 만듭니다.
   - Billing period: Monthly
   - 대한민국 가격: `₩4,900`
   - Auto-renewing: On
4. 자동 갱신 base plan `yearly`를 만듭니다.
   - Billing period: Yearly
   - 대한민국 가격: `₩39,000`
   - Auto-renewing: On
5. 두 base plan 모두 현재 앱 판매 국가와 맞추고 Activate 합니다.
6. Offer는 만들지 않습니다. 특히 free trial phase를 추가하지 않습니다.
7. Resubscribe는 켜고, grace period는 활성화합니다. account hold는 2025년 12월 이후의
   Google 자동 계산 기본값을 권장합니다. pause는 서버가 paused 상태를 무권한으로
   처리하는지 QA한 뒤에만 켭니다.

### 4.3 RTDN과 인증된 Pub/Sub push

1. Google Cloud Pub/Sub API를 켜고 topic 하나를 만듭니다. 예:
   `projects/PROJECT_ID/topics/jango-play-billing`
2. topic IAM에
   `google-play-developer-notifications@system.gserviceaccount.com`을 추가하고
   `Pub/Sub Publisher` 역할을 부여합니다.
3. Pub/Sub push 인증용 user-managed service account를 준비합니다.
4. push subscription을 다음처럼 만듭니다.
   - Delivery type: Push
   - Endpoint:
     `https://api-production-1504.up.railway.app/subscriptions/notifications/google`
   - Enable authentication: On
   - Audience: 위 endpoint와 **문자 하나까지 동일**
   - Payload unwrapping: Off. API는 `message.data` wrapper를 기대합니다.
5. Pub/Sub service agent
   `service-PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com`에
   `Service Account Token Creator` 역할을 부여합니다.
6. Railway `GOOGLE_RTDN_AUDIENCE`도 동일한 endpoint 문자열로 설정합니다.
   `GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL`에는 3단계 push 인증 계정의 정확한 이메일을
   설정합니다. API는 Google 서명·audience 검증 뒤 해당 이메일과
   `email_verified=true`를 확인하며, 설정이 없거나 다른 발신자이면 처리를 거부합니다.
7. Play Console **Monetize with Play → Monetization setup → Real-time developer
   notifications**에서 RTDN을 켭니다.
8. Topic name에 전체 `projects/…/topics/…` 이름을 넣고, subscriptions와 voided
   purchases를 포함하는 알림 유형을 선택합니다.
9. **Send Test Message**를 눌러 push 응답 2xx와 API 로그를 확인합니다. RTDN 자체에는
   완전한 권한 상태가 없으므로 서버가 Play Developer API를 다시 조회하는지도 봅니다.

### 4.4 Data safety와 앱 콘텐츠

1. **Policy and programs → App content → Data safety**를 수정합니다.
2. Financial info의 `Purchase history`를 수집으로 선언합니다.
   - 목적: App functionality, Fraud prevention/security 중 실제 사용 목적만 선택
   - 사용자에게 연결됨: Yes
   - 공유 여부: 서버 수탁자와 Play 정의를 대조해 실제대로 답변
3. Google Play 결제창이 직접 받는 카드번호는 앱·서버가 접근하지 않으므로 앱의
   `User payment info` 수집으로 신고하지 않습니다.
4. 계정 삭제 URL, Privacy Policy URL, 광고 ID 미사용, 사진 처리 선언을 현재 빌드와
   다시 대조합니다.
5. Financial features declaration은 일반 디지털 구독을 금융 서비스로 오인해 체크하지
   말고, 앱에 금융 기능이 없다면 `My app doesn't provide any financial features`를 유지합니다.

## 5. 테스트와 rollout

### 5.1 iOS Sandbox/TestFlight

- App Store Connect → Users and Access → Sandbox에서 새 tester를 만듭니다.
- 월간·연간 구매, 사용자 취소, 갱신, billing retry/grace, 만료, 환불/revocation,
  구매 복원, 앱 재설치, 오프라인 복귀를 확인합니다.
- 다른 장고 계정으로 같은 Apple 구매를 복원할 때 자동 이전되지 않고 지원 안내가
  나오는지 확인합니다.
- 상품 메타데이터 변경은 Sandbox 반영에 최대 약 1시간 걸릴 수 있습니다.

### 5.2 Android license/internal testing

- Play Console → Settings → License testing에 테스트 Google 계정을 추가합니다.
- 같은 계정을 internal testing 트랙 tester에도 포함하고 Play 링크로 설치합니다.
- 성공 구매뿐 아니라 `Test card, always approves/declines`, slow 승인·취소 pending,
  grace, account hold, pause, 갱신, 만료, 환불, revoke를 확인합니다.
- 최초 구매는 `PURCHASED` 확인 후 서버가 acknowledge하고, `PENDING`에는 권한을
  부여하거나 acknowledge하지 않는지 확인합니다.

### 5.3 배포 순서

1. migration → API/Admin/법적 페이지 배포, `SUBSCRIPTIONS_ENABLED=false`
2. Apple/Google 상품과 알림 설정, Sandbox/License QA
3. 원가 No-Go와 복원·타 계정 충돌 QA 통과
4. iOS는 첫 구독과 새 앱 버전을 같은 심사에 제출
5. Android는 internal → staged production rollout
6. 양 스토어에서 새 앱 버전과 상품 사용 가능 상태를 확인한 뒤
   `SUBSCRIPTIONS_ENABLED=true`, `SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED=true`,
   `MONETIZATION_REVENUE_LEDGER_ENABLED=true`
7. 5% → 20% → 50% → 100% 단계 배포를 권장하며 각 단계에서 구매 검증 성공률,
   복원 성공률, 중복 권한, 미승인 구매, 환불률, AI 원가를 확인합니다.

## 6. 출시 직전 Railway 값

```text
SUBSCRIPTIONS_ENABLED=false  # 스토어 승인·원가 검증 후 true
HOUSEHOLD_SUBSCRIPTIONS_ENABLED=false
PAID_RECOMMENDATION_CREDITS_ENABLED=false
MONETIZATION_OFFER_MODE=core
IAP_ALLOWED_PRODUCT_IDS=expirymate_premium_monthly,expirymate_premium_yearly,jango_plus
APPLE_BUNDLE_ID=com.expirymate.mobile
APPLE_APP_STORE_ENVIRONMENT=production
GOOGLE_PLAY_PACKAGE_NAME=com.expirymate.mobile
GOOGLE_RTDN_AUDIENCE=https://api-production-1504.up.railway.app/subscriptions/notifications/google
SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED=false  # 유료 판매 시작과 함께 true
MONETIZATION_REVENUE_LEDGER_ENABLED=true
```

App Review/TestFlight·라이선스 QA가 production API를 사용하는 동안만
`IAP_ALLOW_SANDBOX_PURCHASES=true`로 설정합니다. 공개 직전 신선한 백업·격리 복구를
확인하고 `false`로 되돌려 재배포·운영 검사를 마친 뒤 production 앱을 게시합니다.

## 7. 장애 시

- 구매 검증 또는 스토어 알림 장애: `SUBSCRIPTIONS_ENABLED=false`로 **신규 판매만** 닫습니다.
- 기존 entitlement 검증, Apple/Google 알림, resync scheduler, 수익 원장은 끄지 않습니다.
- 이미 결제한 사용자의 한도를 낮추거나 무료 기능을 막지 않습니다.
- Google에서 base plan을 비활성화하거나 Apple 상품 판매를 중단하는 조치는 신규 판매
  플래그만으로 통제되지 않는 긴급 상황에서만 사용합니다.

## 공식 참고

- [Apple: 자동 갱신 구독 생성](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/)
- [Apple: 첫 IAP/구독 심사 제출](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)
- [Apple: Server Notifications URL](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/enter-server-urls-for-app-store-server-notifications)
- [Apple: Billing Grace Period](https://developer.apple.com/help/app-store-connect/manage-subscriptions/enable-billing-grace-period-for-auto-renewable-subscriptions/)
- [Google Play: 구독과 base plan 생성](https://support.google.com/googleplay/android-developer/answer/140504)
- [Google Play Billing: RTDN 준비](https://developer.android.com/google/play/billing/getting-ready)
- [Google Cloud: 인증된 Pub/Sub push](https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions)
- [Google Play: Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
