---
status: active
owner: product-release
last_reviewed: 2026-08-29
source_of_truth: true
data_as_of: 2026-08-29
---

# 프로젝트 현황

이미 스토어에 출시된 장고야 부탁해의 운영 단계, 업데이트 우선순위, 블로커를 관리하는 정본입니다. 구현 방향은
[`ROADMAP.md`](./ROADMAP.md), 배포 절차는
[`operations/deployment.md`](./operations/deployment.md)를 확인하세요.

> 앱의 스토어 출시 상태는 2026-08-29 확인을 기준으로 합니다. 개인 플러스 업데이트 전
> Railway, EAS, App Store Connect, Play Console의 실제 상태를 다시 확인해야 합니다.

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
- **사용자 확인 완료:** App Store Connect 저작권을 `2026 devnamu`로 수정했고,
  화면 공유 과정에서 노출된 심사 계정 비밀번호와 App Store Connect 로그인 정보를
  갱신했습니다.
- `SUBSCRIPTIONS_ENABLED=false`, `IAP_ALLOW_SANDBOX_PURCHASES=false`를 유지합니다.
  9월 1일 TestFlight/Sandbox QA 직전에만 Sandbox 구매 허용 범위를 다시 결정합니다.

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
