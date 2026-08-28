---
status: active
owner: api-mobile
last_reviewed: 2026-08-28
source_of_truth: true
---

# 사진 일괄 등록 사용량·광고 정책

## 사용자 정책

- 한도는 저장공간이 아니라 로그인 사용자 기준입니다.
- KST 기준 매일 첫 분석 1회는 무료입니다.
- 무료 사용 후에는 보상형 광고의 서버 측 검증(SSV) 1건당 분석 1회를 제공합니다.
- 사진 분석용 광고는 하루 최대 3회이며 총 분석 한도는 하루 4회입니다.
- 광고 크레딧은 검증된 당일에만 유효하고 사진 분석에만 사용할 수 있습니다.
- 추천 생성용 광고 크레딧과 사진 분석용 광고 크레딧은 서로 사용할 수 없습니다.

## 공개 API

- `GET /spaces/:spaceId/inventory/photo-parse-access`: 오늘의 무료·광고 사용량, 사용 가능한 크레딧, 다음 KST 초기화 시각을 반환합니다.
- `POST /monetization/rewarded-ad-sessions`: 사진 광고는 `purpose: "inventory_photo_parse"`를 보냅니다. 목적을 생략한 구버전 앱은 `recipe_generation`으로 처리됩니다.
- `POST /spaces/:spaceId/inventory/parse-photo`: `Idempotency-Key`를 지원합니다. 성공 결과는 24시간 보관되어 같은 키 재시도에서 AI를 다시 호출하지 않습니다.

파일 형식·크기 검증 및 AI 데이터 고지 동의가 끝난 뒤에만 사용권을 예약합니다. AI 호출이 실패하면 무료 횟수 또는 광고 크레딧은 반환하지만 실제 발생 비용은 운영 집계에 남습니다.

## 운영 환경변수

```env
INVENTORY_PHOTO_PARSE_FREE_DAILY_LIMIT=1
INVENTORY_PHOTO_PARSE_REWARDED_DAILY_LIMIT=3
INVENTORY_PHOTO_PARSE_REWARDED_ADS_ENABLED=true
INVENTORY_PHOTO_PARSE_DAILY_COST_LIMIT_USD=0.20
INVENTORY_PHOTO_PARSE_GLOBAL_DAILY_COST_LIMIT_USD=10
```

사진 광고 플래그가 `true`여도 전체 `REWARDED_ADS_ENABLED`가 꺼져 있으면 광고 경로는 열리지 않습니다. 기존 AdMob 광고 단위와 외부 `reward_item=recipe_generation` 값을 재사용하며, 권한 판정은 서버에 저장한 세션 `purpose`를 기준으로 합니다.

## 배포와 확인

1. Prisma migration을 API보다 먼저 적용합니다.
2. 하위 호환 API를 배포합니다.
3. 개발 빌드에서 Google 테스트 광고와 실제 SSV 콜백을 확인합니다.
4. 모바일을 배포한 뒤 사진 광고 플래그를 활성화합니다.

Expo Go에는 광고 네이티브 모듈이 없으므로 무료 1회까지만 시험합니다. 개발용 가짜 크레딧은 사용하지 않습니다.

출시 후 사진 분석 성공률, 요청당 비용, 검출 항목당 비용, 사진 목적 광고 eCPM, SSV 실패율, 일일 한도 도달률을 목적별로 모니터링합니다.
