---
status: archived
owner: project
last_reviewed: 2026-08-27
source_of_truth: false
---

# 프로젝트 완료 기록 · 2026-08

2026년 8월 완료 작업 기록입니다. 현재 출시 판단에는 [`../STATUS.md`](../STATUS.md)를
사용하세요. v1 범위는 [`../product/release-scope.md`](../product/release-scope.md)입니다.

## 이달 요약

| 구분 | 항목 |
|---|---|
| 문서 | README·STATUS·ROADMAP·운영 런북 분리, `pnpm docs:check` |
| 접근성 | Dynamic Type 최대 2배, 디자인 토큰 계약, 레이아웃 스크린샷 CI |
| 수익화 | 쿠팡 파트너스 상품·고지·리포트, AdMob/Sentry 보강 |
| 레시피 | 추천 v4, 맞춤 설정·engagement |
| 재고 UX | 등록 단계·공간 컨텍스트, 요리 확인 후 차감·되돌리기 |
| 출시 이후 | 영수증·냉장고 사진 일괄 등록 (플래그 기본 off) |

## 2026-08-27

### 영수증·냉장고 사진 일괄 등록

v1 출시 범위가 아닙니다. 사진만으로 재고를 자동 저장하지 않습니다.
흐름은 촬영/앨범 → 서버 Vision 후보 → 사용자가 기한·위치를 채운 뒤 일괄 등록입니다.

- 계약: `packages/shared` parse 후보·`batch-create`(1–30, all-or-nothing)
- API: `POST /spaces/:spaceId/inventory/parse-photo`, `POST …/inventory/batch-create`
- 사진은 파싱 후 폐기. EXIF 제거. DB/S3에 원본 미보관. 비용 메타만 `InventoryPhotoParseEvent`
- Vision 한도는 레시피와 분리 (`INVENTORY_PHOTO_PARSE_*`). 구독 게이트 없음
- 모바일 `/register-photo`, 플래그 off면 진입 숨김. 기존 `/scanner` 바코드·OCR은 유지
- AI 고지 `ai-data-notice-v4`. Photos 경로를 기기 내 OCR과 문서·스토어 선언에서 분리
- 운영 migration `20260827120000_add_inventory_photo_parse_events`는 다음 API 배포 때 적용

플래그: API `INVENTORY_PHOTO_PARSE_ENABLED`, 모바일
`EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED`. 기본 `false`.

환경변수(2026-08-27):

| 위치 | 내용 |
|---|---|
| 로컬 `apps/api/.env`, `apps/mobile/.env` | 고지 v4, 파싱 키, 플래그 off |
| Doppler API·Mobile `dev` / `stg` / `prd` | 동일 |
| Railway `api` production | 동일. 재배포는 건너뜀(다음 API 배포 때 적용) |

기능을 켤 때는 API·모바일 플래그를 함께 켜고, 스토어/TestFlight는 EAS에
`EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED`를 넣은 뒤 다시 빌드합니다.
Admin 변수는 필요 없습니다.

개인정보·스토어 대조: [`../store-privacy-declarations.md`](../store-privacy-declarations.md),
[`../store-metadata-draft.md`](../store-metadata-draft.md).

### 같은 날 반영된 다른 작업 (이미 main)

- 요리 확인 후 재료 차감, 되돌리기, 소진 분은 장보기
- 이메일 인증 처리(데스크톱·모바일)
- 인증 오류 `CodedHttpException`
- 홈·재고·등록 화면을 공간 컨텍스트·단계 구조로 정리
- 쿠팡 CTA·고지 대비 토큰과 공통 컴포넌트
