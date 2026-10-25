---
status: active
owner: engineering
last_reviewed: 2026-10-20
source_of_truth: false
---

# AI 모델 비교 실행 안내

[개선안](ai-api-improvement-proposal.md)의 우선순위에 따라 원가 계측, 후보 분배, 시간 제한,
평가 도구를 구현했습니다. 기본 모델과 후보 비율 0을 유지합니다. 실제 계정의 모델 접근과
품질 검수가 끝나기 전에는 후보 비율을 올리지 않습니다. 운영 배포·DB 작업에는
[배포 절차](deployment.md)와 사용자의 명시적 요청이 필요합니다.

## 원가와 응답 시간 확인

관리자 권한의 `GET /admin/ai/metrics?days=7|30|90`를 사용합니다. 기존 API envelope와
`AdminGuard`를 따릅니다. 모델·promptVersion·variant·pricingVersion·사진 scene·레시피
requestClass(simple/complex/legacy)별로 집계하므로 같은 조건의 대조군과 후보를 비교합니다.

- 성공률과 첫 호출 성공률의 분모에는 최종 실패도 포함합니다.
- `costPerSuccessUsd`는 실패·보정 비용을 포함한 총비용을 성공 건수로 나눈 값입니다.
- `reported`는 검증된 공급자 usage, `estimated`는 추정값, `unavailable`은 미확인 호출,
  `partial`은 일부 호출의 비용만 확인됨, `legacy`는 이전 계측입니다. 이는 청구서와 대조한
  최종 결제 금액이 아니라 버전이 명시된 Standard 단가 계산입니다.
- 미확인·부분·이전 계측이 섞이면 평균·P95 비용과 성공당 비용은 `null`입니다.
  `knownCostUsd`는 확인된 부분만 나타냅니다. 비용 0으로 해석하지 않습니다.
- 토큰에는 일반 입력, 캐시 읽기, 캐시 쓰기, 출력, reasoning을 구분합니다. 캐시 쓰기는
  일반 입력을 대체하며 중복 가산하지 않습니다. 새 모델의 쓰기 수치가 없으면 남은 입력을
  모두 쓰기로 계산한 보수적 추정값으로 기록합니다.
- `p95RequestCostUsd`는 요청 비용 분포이며 `costPerSuccessUsd`와 구분합니다. 응답 시간은
  AI 생성 구간을 측정합니다. 전체 HTTP 요청 시간과 같다고 가정하지 않습니다.
- 기능별 최근 20,000개까지 집계합니다. `truncated=true`면 전체 기간 지표로 채택 판정하지
  않습니다. 원본 이벤트에는 요청별 호출 모델·비용·기간·실패 종류만 기록하며 입력·사진·
  생성 문장은 추가 저장하지 않습니다.

기존 수익화 overview와 구독 가드레일은 현재 정책을 유지합니다. 새 비교 지표는 실패 비용을
포함하므로 성공 기록 위주 지표와 직접 비교하지 않습니다. 이용권은 기존처럼 성공 시에만
차감하며 실패 예약은 해제합니다. 사진 원본 폐기와 결과 보관 기간도 기존 정책을 따릅니다.

## 환경 설정

| 키 | 기본/예시 | 동작 |
| --- | --- | --- |
| `RECIPE_AI_MODEL` | `gpt-5.4-mini` | 추천 대조군 |
| `RECIPE_AI_CANDIDATE_MODEL` | `gpt-6-luna` | 추천 비교 후보 |
| `RECIPE_AI_CANDIDATE_PERCENT` | `0` | 사용자별 고정 분배, 0~100 정수 |
| `RECIPE_AI_CANDIDATE_CONTROL_REPAIR` | `false` | 후보의 의미 보정을 대조군으로 수행하는 선택 실험 |
| `RECIPE_AI_REQUEST_TIMEOUT_MS` | `45000` | 추천 호출 하나의 최대 대기 시간 |
| `RECIPE_AI_DEADLINE_MS` | `60000` | 최초 추천과 모든 의미 보정의 합산 대기 시간 |
| `INVENTORY_PHOTO_PARSE_MODEL` | `gpt-5.6-luna` | 사진 대조군; 환경 실효값을 우선 |
| `INVENTORY_PHOTO_PARSE_CANDIDATE_MODEL` | `gpt-6-luna` | 사진 비교 후보 |
| `INVENTORY_PHOTO_PARSE_CANDIDATE_PERCENT` | `0` | 사용자·scene별 고정 분배 |
| `INVENTORY_PHOTO_PARSE_REQUEST_TIMEOUT_MS` | `30000` | 사진 호출 하나의 최대 대기 시간 |
| `INVENTORY_PHOTO_PARSE_DEADLINE_MS` | `45000` | 사진 AI 생성 구간의 합산 대기 시간 |

SDK 자동 재시도는 0회입니다. 레시피 의미 보정은 기존 최대 2회를 유지하며 남은 deadline
내에서 실행합니다. 호출이 시작되기 전 deadline이 끝나면 새 유료 호출로 집계하지 않습니다.
추천 후보는 알레르기·제외 재료·식단·매운맛 제한이 없고, 가열 장비에 stovetop을 포함하며,
재료 12개 이하·4인분 이하·시간 15분 이상인 요청에만 배정합니다. 이 범위는 초기 비교
범위이며 사용자의 안전 설정을 완화하지 않습니다.

v12 추천 입력과 보정 JSON은 공백을 줄입니다. 3개 전략, 4~8개 상세 조리 단계, 재고 ID·단위·
수량에 연결된 출력 schema와 안전 검증을 유지합니다. 동적 schema가 캐시 hit를 줄일 수 있어
명시적 캐시 설정은 실측 뒤 별도 실험합니다. 사진 해상도·출력 한도는 이번 변경에서 조정하지
않았습니다.

## 평가 실행

실행기는 DB나 앱 환경 파일을 자동으로 로딩하지 않습니다. 개인정보가 없는 합성 조건 또는
사용 승인이 끝난 로컬 자료를 사용합니다. 환경 키 값은 결과·로그·git에 기록하지 않습니다.

```sh
# 네트워크 호출 없이 합성 레시피 200개와 실행 건수 확인
pnpm --filter @expirymate/api ai:evaluate --feature recipe

# 합성 입력을 저장해 동일 datasetHash로 반복 비교
pnpm --filter @expirymate/api ai:evaluate --feature recipe --write-cases /tmp/recipe-cases.jsonl

# 서버 환경에 OPENAI_API_KEY를 설정한 뒤 명시적으로 실제 호출
pnpm --filter @expirymate/api ai:evaluate --run --feature recipe \
  --cases /tmp/recipe-cases.jsonl --models gpt-5.4-mini,gpt-6-luna,gpt-6.1-sol \
  --repetitions 3 --concurrency 6 --max-cost-usd 30 --output /tmp/recipe-results.jsonl

# 승인된 이미지 200장의 manifest: receipt 100장, fridge 100장
pnpm --filter @expirymate/api ai:evaluate --run --feature photo \
  --cases /tmp/photo-cases.jsonl --models gpt-4.1-mini,gpt-5.6-luna,gpt-6-luna \
  --repetitions 2 --max-cost-usd 10 --output /tmp/photo-results.jsonl

# 검수 후 대조군과 후보의 채택 기준 판정
pnpm --filter @expirymate/api ai:evaluate:report \
  /tmp/recipe-results.jsonl /tmp/recipe-grades.jsonl gpt-5.4-mini
```

위 예산은 실행 예시이며 실제 비용 예측이 아닙니다. `--concurrency`는 기본 1, 최대 6이며
모델 순서를 조건·반복별로 순환합니다. 호출별 오류 기록을 분리하고 결과 순서에 의존하지
않습니다. 각 호출 전에 보수적인 여유분을 확보하고 누적 usage 비용과 진행 중 호출의 예약
여유분을 함께 확인합니다. 비용이 미확인·추정·부분 집계이면 새 호출을 중단하고 이미 진행
중인 호출의 결과만 수집합니다. 기존 output 파일에 결과를 덮어쓰지 않습니다. 이미지 자체는 결과에 저장하지
않으며 결과 JSONL에는 검수에 필요한 생성 요리 또는 인식 항목을 담으므로 저장소 밖에서
검수하고 필요한 최소 근거만 보존합니다.

사진 manifest 한 줄의 예:

```json
{"id":"receipt-001","dataPolicy":"approved","feature":"photo","scene":"receipt","imagePath":"images/receipt-001.jpg","expectedNames":["우유","두부"]}
```

`imagePath`는 manifest 위치를 기준으로 해석합니다. `photoExactNameF1`은 이름의 단순 정확
일치 참고 지표입니다. 별칭·중복·수량·날짜·확신도는 사람이 검수하여 quality에 반영합니다.
레시피는 실제 조리 가능성, 제한 재료, 미선언 재료, 수량, 단계 구체성을 검수합니다.
grade 한 줄은 결과와 같은 datasetHash·caseId·model·repeat를 사용합니다.

```json
{"datasetHash":"결과의 해시","caseId":"synthetic-recipe-001","model":"gpt-6-luna","repeat":0,"safetyPassed":true,"quality":0.95}
```

검수 없이 safetyPassed 또는 quality를 채우지 않습니다. 검수 없는 결과·서로 다른 조건·
미확인 비용·안전 실패·표본 부족은 통과하지 않습니다. 모델당 레시피 200조건×3회, 사진은
scene별 100장×2회 이상을 요구합니다. 성공당 총비용 30% 이상 개선, 성공률 하락 1%p 이하,
품질 하락 2%p 이하, P95 지연 악화 10% 이하를 모두 충족해야 합니다. 도구 통과는 운영 전환
승인이 아니며 운영 단계 5→25→50→100%의 관찰 기준은 개선안을 따릅니다.

## 현재 모델 기준선 실행

모델 채택 비교와 별도로 `ai:evaluate:baseline`을 사용한다. 현재 운영 환경의 유효 모델·
출력 한도·시간 제한과 출처를 먼저 확인해 서버 프로세스 환경에 전달한다. 이 명령도 `.env`와
운영 DB를 읽지 않는다. 저장된 레시피 조건의 앞 50건과 승인된 영수증 15장·냉장고 15장을
고정하고, 각 1회·동시성 1로 실행한다.

```sh
# 유료 호출 없는 manifest·이미지·실행 설정 확인
pnpm --filter @expirymate/api ai:evaluate:baseline \
  --runtime-source railway-production-settings-2026-10-20 \
  --usd-krw 1500 --photo-cases /tmp/photo-cases.jsonl \
  --max-cost-usd 5 --output-dir /tmp/jango-current-baseline

# 같은 인수에 --run을 추가해야 실제 호출한다. OPENAI_API_KEY는 서버 환경으로만 전달한다.
# 검수 후에는 추가 호출 없이 다시 보고한다.
pnpm --filter @expirymate/api ai:evaluate:baseline:report \
  --output-dir /tmp/jango-current-baseline --grades /tmp/baseline-grades.jsonl
```

두 기능은 총 $5 이하의 하나의 예산을 공유한다. 레시피 실패·의미 보정 비용을 먼저 정산하고
남은 금액만 사진 실행기에 넘긴다. 잔액 부족·공급자 usage 미확인·입력 해시 변경 시 후속
호출을 중단한다. 중단된 실행의 자동 재시도·재개·같은 출력 폴더 덮어쓰기는 허용하지 않는다.
manifest에는 모델, promptVersion, pricingVersion, 실효 출력 한도, 조건·이미지 해시를 기록한다.
조건 목록은 해시에 사용한 경로 문자열 그대로 보존하고 원래 manifest 위치는 로컬
`input-locations.json`에 남긴다. 사진 원본을 새 출력 폴더에 중복 복사하지 않는다.
온라인 사진은 저자·라이선스·원본 URL·수집일·원본 해시와 선정 기준을 함께 보존한다.

보고서는 성공률, 실패와 보정 비용을 포함한 성공당 비용, 비용·시간 중앙값과 p95를 제공한다.
공급자 사용량과 버전 단가로 계산한 비용이며 최종 청구서 금액과 구분한다. 원가 공식은 기존
성공 요청 모집단으로 `60 × 레시피 p95 + 30 × 사진 p95 ≤ 858원`을 계산한다. 성공 표본이
50·30보다 적거나 비용이 미확인이면 `incomplete`다. 모델 교체 기준·판매 정책은 변경하지 않는다.

검수 JSONL은 기존 grade 식별자·safetyPassed·quality에 다음 항목을 더할 수 있다.
사진은 `photoReview`에 expectedItems, omittedItems, misidentifiedItems, falsePositiveItems,
quantityErrors, inventedDates를 기록한다. 누락과 오인식은 서로 중복 집계하지 않는다.
레시피는 `recipeReview`의 constraintChecks·constraintViolations에 검수한 제한 조건 수와
위반 수를 남긴다. `notes`에는 구체적인 발견을 적는다. 미검수 값을 0 또는 통과로 채우지
않으며 항목별 검수 표본 수를 보고한다. 검수·표본·비용이 부족하면 완료로 표시하지 않는다.

## 2026-10-20 현재 모델 실측 결과

레시피 50건·공개 온라인 사진 30장을 각 1회 순차 평가했고 공급자 usage가 모두 보고됐다.
실패·의미 보정을 포함한 계산 비용은 **$0.884803**이다. 레시피는 35/50, 사진은 30/30
생성 성공이었다. 현재 성공 표본의 원가식 추정치는 2,500.56원으로 858원을 초과하며,
성공 레시피 표본 부족·품질 검수 미완료로 최종 원가 판정은 `incomplete`다.
사진 생성 성공과 인식 정확도는 구분한다. 모델·후보 비율·판매 정책은 유지했다.

[입력·출처·결과·품질 한계와 비용 기록](ai-evaluations/current-baseline-2026-10-20/README.md)을
보존한다. 검수하지 않은 항목은 점수나 통과로 채우지 않았다.

## 기존 모델 비교 검증 상태

사용자가 전체 평가 비용 상한 $30을 허용한 뒤 추가로 “다 쓰지 말고 적당히 끝내”라고
요청해 소규모 비교로 마무리했습니다. 1,800건 계획 중 레시피 80건(27조건, 1회 반복 일부)을
실행했고 응답 중단으로 usage가 완전하지 않은 요청이 나왔을 때 새 호출을 중단했습니다.
실행기는 이미 시작된 호출까지 정산한 뒤 종료했으며 이후 추가 유료 호출은 하지 않습니다.

레시피 비교에서 확인된 비용은 $1.039486, 앞선 연결 검증을 포함하면 **$1.072645**입니다.
6개 요청은 usage가 미확인 또는 부분 집계이므로 해당 호출의 추가 비용은 이 합계로 확정할
수 없습니다. 청구서와 대조한 최종 지출을 뜻하지 않습니다.

| 모델 | 요청 | 성공 | usage 보고 완료 | 확인된 비용(USD) |
| --- | --- | --- | --- | --- |
| GPT-5.4 mini | 27 | 20 | 25 | 0.354391 |
| GPT-6 Luna | 26 | 23 | 26 | 0.034147 |
| GPT-6.1 Sol | 27 | 22 | 23 | 0.650948 |

세 모델의 결과와 usage가 모두 확보된 동일 23조건만 따로 보면 다음과 같습니다. 실패·보정
비용도 성공당 비용에 포함합니다. 미확인 요청이 있는 조건 전체를 사후 제외한 참고 비교이며
실제 서비스의 대표 표본이나 정식 채택 판정으로 사용하지 않습니다.

| 모델 | 성공/23 | 성공당 비용(USD) | P50 생성 시간 | P95 생성 시간 |
| --- | --- | --- | --- | --- |
| GPT-5.4 mini | 19/23 | 0.016114 | 10.041초 | 29.300초 |
| GPT-6 Luna | 20/23 | 0.001513 | 11.538초 | 28.458초 |
| GPT-6.1 Sol | 22/23 | 0.028573 | 29.030초 | 52.939초 |

이 참고 비교에서 Luna의 성공당 비용은 mini보다 약 90.6% 낮았습니다. P50은 약 14.9%
길고 P95는 약 2.9% 짧아 일관된 속도 개선으로 판단하지 않습니다. Sol은 비용과 지연이 더
높았습니다. 최종 결정은 **현재 모델 유지, 후보 비율 0**입니다. 표본 부족·미확인 비용·
품질 미검수로 두 후보 모두 채택을 승인하지 않습니다. 품질 미검수는 품질 악화로 단정하지
않으며 비용이 미확인이면 절감 목표도 판정하지 않습니다.

[평가 요약](ai-evaluations/recipe-evaluation-2026-10-08.json),
[실제 결과 80건](ai-evaluations/recipe-pilot-2026-10-08.jsonl),
[합성 조건 200개](ai-evaluations/recipe-cases-2026-10-08.jsonl),
[채택 기준 판정](ai-evaluations/pilot-adoption-2026-10-08.json)을 보존합니다.

### 연결 검증 기록

2026-10-08 키 갱신 후 세 모델 모두 실제 접근과 생성이 성공했습니다. 같은 합성 레시피
1조건에서 각 모델을 1회 호출했으며 보정은 없었습니다. usage가 보고된 세 요청의 계산 비용은
합계 $0.031470입니다. 키 갱신 전의 설정 오류 1건은 usage 미확인으로 별도 기록합니다.
이는 청구서 확인 또는 전체 운영 원가를 뜻하지 않습니다.

| 모델 | 계산 비용(USD) | 생성 시간 | 최종 결과 |
| --- | --- | --- | --- |
| GPT-5.4 mini | 0.008262 | 7.940초 | 구조·재고·의미 검증 통과 |
| GPT-6 Luna | 0.001099 | 12.741초 | 구조·재고·의미 검증 통과 |
| GPT-6.1 Sol | 0.022109 | 24.706초 | 구조·재고·의미 검증 통과 |

이 1조건에서 Luna 비용은 약 86.7% 낮지만 생성 시간은 약 60.5% 길었습니다.

사진은 개인정보가 없는 합성 영수증 1장을 모델당 1회 비교했습니다. 세 모델 모두 우유 2개,
두부 1개, 사과 3개를 추출했고 합계·할인·포인트를 제외했습니다. 날짜를 임의로 정하지
않았으며 모든 항목은 사용자 확인이 필요한 `needsReview=true`를 유지했습니다.

| 모델 | 계산 비용(USD) | 생성 시간 | 이름 정확 일치 F1 |
| --- | --- | --- | --- |
| GPT-4.1 mini | 0.000896 | 2.939초 | 1.0 |
| GPT-5.6 Luna | 0.000543 | 3.579초 | 1.0 |
| GPT-6 Luna | 0.000250 | 3.875초 | 1.0 |

이 영수증에서 GPT-6 Luna는 GPT-5.6 Luna 대비 비용이 약 54.0% 낮고 생성 시간이 약 8.3%
길었습니다. 공급자 usage로 계산한 성공 호출 6건의 비용 합계는 $0.033159입니다.
GPT-4.1 mini의 첫 호출은 지원하지 않는 `text.verbosity` 때문에 HTTP 400으로 실패했습니다.
GPT-4.x에 해당 옵션을 보내지 않도록 수정한 뒤 재호출이 성공했고 회귀 테스트도 추가했습니다.
옵션 오류와 키 설정 오류는 usage가 보고되지 않아 위 성공 호출 비용 합계에 포함하지 않습니다.

합성 1조건의 결과는 실제 영수증·냉장고 사진 품질, 대표 표본의 성공률·P95·조리 가능성을
입증하지 않습니다. 모델 채택 기준을 통과한 것으로 처리하지 않으며 후보 비율은 0입니다.
정식 평가에는 승인된 사진 자료, 평가 예산과 검수 결과가 필요합니다.

[요약·usage 기록](ai-evaluations/smoke-2026-10-08.json)과
[검수용 합성 결과 3건](ai-evaluations/smoke-2026-10-08.jsonl)을 보존합니다. 입력은
`syntheticRecipeCases()`의 `synthetic-recipe-007`이며 개인정보·사진 원본·환경 키는 없습니다.

사진의 [요약·usage 기록](ai-evaluations/photo-smoke-2026-10-08.json),
[검수용 결과 3건](ai-evaluations/photo-smoke-2026-10-08.jsonl),
[manifest](ai-evaluations/photo-smoke-cases.jsonl),
[합성 영수증](ai-evaluations/jango-ai-synthetic-receipt.png)을 보존합니다. manifest와 이미지
바이트를 유지하면 같은 datasetHash로 다시 실행할 수 있습니다. 요약에는 결과와 이미지의
SHA-256을 기록했습니다.

로컬 검증에서는 전체 workspace 테스트가 통과했습니다(shared 162, API 536, mobile 556,
캐릭터 도구 20). 이후 모델 옵션·평가 스케줄러 수정 후 API 전체 541개와 채택 판정 검사가
통과했고 API 타입·린트 검사와 문서 검사도 통과했습니다. 새 migration은 운영 DB와
분리된 임시 PostgreSQL의 깨끗한 DB에 전체 45개 migration을 적용해 검증했습니다.
해당 DB에서 원가 계측·관리자 집계 2개와 재고 흐름 4개 통합 테스트가 통과했습니다.
임시 서버는 검증 후 종료했으며 운영 migration·배포는 실행하지 않았습니다.
