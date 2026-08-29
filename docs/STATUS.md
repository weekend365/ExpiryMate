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

## P0 — 개인 플러스 업데이트 전 필수

1. **완료:** Railway production DB에 개인 플러스 migration을 적용하고 처분 이벤트 백필
   수량을 기존 종료 재고와 대조했습니다.
2. 프로젝트 Owner 권한으로 Railway production Volume의 최신 백업을 생성합니다.
3. 공유 기능이 포함된 iOS·Android production 빌드를 생성합니다.
4. 두 실계정으로 초대, 역할, 공간 전환, 재고 동기화, 알림, 계정 삭제를 검증합니다.
5. 요리 50건·사진 30건의 실호출 p95 원가가 개인 플러스 월 원가 예산 858원을
   충족하는지 확인합니다. 충족하지 못하면 신규 판매를 열지 않습니다.
6. App Store Connect와 Play Console에 개인 플러스 월간·연간 상품, 서버 알림,
   가격, 약관·개인정보 선언을 실제 동작과 동일하게 설정합니다.
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
