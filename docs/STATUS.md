---
status: active
owner: product-release
last_reviewed: 2026-08-27
source_of_truth: true
data_as_of: 2026-07-24
---

# 프로젝트 현황

장고야 부탁해의 출시 단계, 우선순위, 블로커를 관리하는 정본입니다. 구현 방향은
[`ROADMAP.md`](./ROADMAP.md), 배포 절차는
[`operations/deployment.md`](./operations/deployment.md)를 확인하세요.

> 외부 콘솔과 운영 배포 상태는 2026-07-24 스냅샷을 기준으로 합니다. 출시 판단 전
> Railway, EAS, App Store Connect, Play Console의 실제 상태를 다시 확인해야 합니다.

## 현재 위치

| 영역 | 상태 | 남은 관문 |
|---|---|---|
| 모바일 핵심 UX | 구현 완료에 가까움 | 새 release candidate 회귀 QA |
| 인증 | 소셜 4종·이메일 실기기 검증 | 새 빌드에서 공유 초대 복귀 재검증 |
| API | 재고·공간·초대·추천 구현 | 운영 migration과 백필 확인 |
| Admin | Railway 배포 | 보안 하드닝과 운영 점검 |
| 스토어 | Phase 2 준비 | 공유 기능 포함 빌드·자료 확정·제출 |

**현재 단계:** Phase 2, 스토어 제출 준비

**출시 판단 주의:** 공유 기능은 코드와 자동 검증까지 완료됐으나, 운영 migration과
두 실계정 release QA가 끝나기 전에는 출시 완료로 보지 않습니다.

## P0 — 출시 전 필수

1. Railway production DB에 공유 공간 migration을 적용하고 백필 누락이 없는지 확인합니다.
2. 공유 기능이 포함된 iOS·Android production 빌드를 생성합니다.
3. 두 실계정으로 초대, 역할, 공간 전환, 재고 동기화, 알림, 계정 삭제를 검증합니다.
4. 스토어 개인정보 선언, 메타데이터, 스크린샷, 심사 노트를 실제 동작과 대조합니다.
5. App Store 제출 후 Android internal 및 production 제출을 진행합니다.

관련 문서:

- [스토어 메타데이터 초안](./store-metadata-draft.md)
- [스토어 개인정보 선언 대조표](./store-privacy-declarations.md)
- [스토어 스크린샷 가이드](./store-screenshot-submission-guide.md)
- [iOS·EAS production 런북](./ios-eas-production.md)

## P1 — 병행 또는 출시 직후

- 새 TestFlight와 Android internal 빌드에서 Mobile Sentry 수집 확인
- API·Admin 커스텀 도메인 연결
- Admin 권한, 쿠키, 감사 로그 보안 하드닝
- 푸시 스케줄러와 Expo receipt 처리 실수신 검증
- ProductMaster source-fields migration 적용 여부 확인

## 의도적으로 미룬 범위

- 구독·추천권 판매
- WebSocket/SSE 실시간 동기화와 공간 변경 이력
- 초대 QR·전화번호·공개 재사용 링크
- OCR·카탈로그 UX 고도화
- 영수증·냉장고 사진 일괄 등록: 2026-08-27 코드 완료, 플래그 기본 off.
  Doppler와 Railway API 변수는 반영됨. 운영 재배포·migration은 다음 API 배포 때.
  상세 [`archive/project-history-2026-08.md`](./archive/project-history-2026-08.md)

## 갱신 규칙

- Phase, P0, 블로커가 바뀌면 이 문서를 같은 변경에서 갱신합니다.
- 외부 서비스 상태를 확인한 날 `data_as_of`를 갱신합니다.
- 완료된 상세 기록은 [`archive/project-history-2026-08.md`](./archive/project-history-2026-08.md)처럼
  월별 아카이브로 이동합니다.

