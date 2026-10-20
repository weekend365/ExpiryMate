# 장고 v21 · 다정하지만 허당인 생활 친구

2026-10-15 사용자가 요청한 개선안을 반영한 **32종 검토 후보**다. 기존 민트 냉장고 얼굴·요리 모자와 앞치마·크레파스 질감·통통한 장갑과 신발을 살리고, 여덟 컷의 연출과 여덟 문구를 바꿨다. 모든 컷은 전신 배치이며 문구를 별도 조판했다.

- [32종 갤러리](index.html) · [전체 밝은 배경](preview-light.png) · [전체 어두운 배경](preview-dark.png)
- [360px 문구 포함 PNG 32종](stickers) · [문구 없는 동일 배치 32종](artwork-360) · [원화](source-originals)
- [v20 전후 비교](comparison-v20.png) · [120px 밝은 배경](caption-120-light.png) · [120px 어두운 배경](caption-120-dark.png) · [80px 밝은 배경](caption-80-light.png) · [80px 어두운 배경](caption-80-dark.png)
- [문구 없는 감정 비교](expression-120-light.png) · [얼굴 확대](expression-faces.png) · [입 진단](mouth-contact.png)

## 무엇을 바꿨나

03 최고야!는 앞으로 내민 엄지, 08 잘했어!는 작은 박수, 11 멍…은 반눈과 살짝 열린 빈 냉장고 문, 12 어라?는 작은 O형 입과 비대칭 눈썹, 16 축하해!는 점프, 18 괜찮아는 포옹, 21 한 입만은 음식을 향한 조심스러운 손, 31 나도 껴줘는 문틀 옆 참여 요청으로 새로 작화했다.

문구는 11 멍… / 19 좀 쉬자 / 21 한 입만 / 23 내가 할게! / 24 다 됐어! / 29 절전 중… / 31 나도 껴줘 / 32 내 맘 받아!로 변경했다. 다른 24개 문구는 v20과 같다.

Gaegu Bold의 실제 글자 높이·흰 외곽선·말줄임표를 측정하여 조립하고, 문구마다 위치와 기울기를 달리했다. 360px 기준 일반 문구의 회전 전 잉크 높이는 약 42–45px, 큰 감탄 13번은 약 51px, 조용한 17·30번은 약 38–39px를 시작값으로 사용했다. 너비 제한이 적용되면 실제 높이는 더 작아질 수 있으며 정확한 수치는 [조판 기록](lettering-record.json)에 남겼다. 흰 외곽선은 약 2.5px, 말줄임표는 본문 대비 55%다.

## 출처와 표현 확장

24종은 v20에서 선택한 원화 바이트를 그대로 복사했으며 생성 작업이 아니다. [재사용 기록](derivation-records)은 v20과 v18까지 원본 경로·해시를 추적한다. 새 8종은 공식 built-in image_gen으로 각각 제작했고 [생성 기록](generation-records)에 실제 출력·프롬프트·첨부 참조와 해시를 남겼다. 생성 원본은 별도로 보존하며 한글을 이미지 생성에 맡기지 않았다.

사용자가 이번 계획에서 허용한 눈·입·얼굴 배치·포즈와 문 열기는 [표현 의도](creative-intents)로 제작 전에 기록했다. `expressive-custom`은 네 가지 기존 입 형태로 오분류하지 않으며, 자동 측정값과 별도로 항상 시각 재검토 상태다. 원본 ROI·임계값·출시 서명을 조작하지 않는다.

- [32종 계획](plan.json) · [창작 의도](creative-brief.json) · [변경 기록](change-record.json) · [제작 기록](production-record.json)
- [관찰한 입·얼굴 좌표](inspection.json) · [자동 검사](inspection-status.json) · [시각 검토](visual-review.json)
- [보호 자산 해시 대조](preservation-check.json) · [프로젝트 검증 결과](../../../quality/v21-verification-20261015.json)
- 실제 프롬프트: [03](../../../quality/jobs/03-v21-r1/prompt.txt), [08](../../../quality/jobs/08-v21-r1/prompt.txt), [11](../../../quality/jobs/11-v21-r1/prompt.txt), [12](../../../quality/jobs/12-v21-r1/prompt.txt), [16](../../../quality/jobs/16-v21-r1/prompt.txt), [18](../../../quality/jobs/18-v21-r1/prompt.txt), [21](../../../quality/jobs/21-v21-r1/prompt.txt), [31](../../../quality/jobs/31-v21-r1/prompt.txt)

## 검토 범위와 재현

문구 포함·제외, 360·120·80px의 밝고 어두운 배경, v20 전후 비교와 얼굴·입 진단을 관찰했다. 32종 모두 투명 360×360 PNG이며 최대 91,492바이트, 최소 여백 15px, 문구와 그림의 불투명 픽셀 충돌 0이다. 보호 자산 720개는 변경 전후 해시가 같다.

입 자동 검사는 18종 통과·14종 재검토다. 새 표현 8종은 의도적으로 재검토를 유지하며 재사용 05·15·20·28·29·32의 불확실성도 승계했다. 80px에서는 작은 입·선반·음식 세부가 약해지고 어두운 배경의 글자 외곽선이 가늘게 보인다. 11번 문 원근, 12번 땀방울 수, 21번 독립 음식 소품은 시각 기록에 명시했다. 에이전트 시각 관찰은 독립 사용자 평가나 외부 서명이 아니다. 실제 카카오톡 기기 전송·읽기 속도·구매 선호는 측정하지 않았다.

```sh
pnpm jango:lettering design/jango/emoticons/kakao-32/v21
pnpm jango:build --base=design/jango/emoticons/kakao-32/v21
node scripts/build-jango-expression-review.mjs --base=design/jango/emoticons/kakao-32/v21
node scripts/register-jango-emoticon-review.mjs --base=design/jango/emoticons/kakao-32/v21
node scripts/build-jango-review-gallery.mjs --base=design/jango/emoticons/kakao-32/v21
pnpm jango:reports:refresh
pnpm jango:check
```

이번 결과는 후보 제작이다. v18·v20 원본과 기존 채택 이력을 보관하며 MASTER 교체·앱 반영·카카오 제출·서명된 출시는 수행하지 않는다. 24개 재사용 컷도 기존 AI 제작 계보를 승계한다. AI 제작 이력과 기존 제출 제한은 해결된 것으로 표시하지 않는다. `jango:check`는 기록 무결성 검사이며 표현 확장 후보의 출시 승인이 아니다.
