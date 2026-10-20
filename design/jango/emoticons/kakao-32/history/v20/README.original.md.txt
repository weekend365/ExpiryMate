# 장고 v20 · 전신·문구·Gaegu Bold 후보 32종

2026-10-15 사용자가 요청한 개선안을 구현한 **검토 후보**다. 문구가 있는 컷도 모자부터 두 신발까지 원화 전체를 배치하고, 문구와 서체를 다듬었다. 이불 등 자세에 따른 자연스러운 가림은 유지한다.

- [32종 갤러리](index.html) · [전체 밝은 배경](preview-light.png) · [전체 어두운 배경](preview-dark.png)
- [360px 문구 포함 PNG](stickers) · [360px 문구 없는 동일 배치](artwork-360) · [전신 원화](source-originals)
- [120px 밝은 배경](caption-120-light.png) · [120px 어두운 배경](caption-120-dark.png) · [80px 밝은 배경](caption-80-light.png) · [80px 어두운 배경](caption-80-dark.png)
- [360px 밝은 배경](caption-360-light.png) · [360px 어두운 배경](caption-360-dark.png) · [v18 전후 비교](comparison-v18.png)
- [문구 없는 표정 비교](expression-120-light.png) · [얼굴 비교](expression-faces.png) · [입 진단](mouth-contact.png)

## 적용 내용과 보존

원화 30종은 v18 바이트를 그대로 복사했다. 상반신 프레이밍을 해제해 전신을 배치하고 문구만 별도 조립했다. 10번 **잠깐만!**은 한 장갑을 앞으로 든 대기 요청, 15번 **난 패스!**는 두 팔과 장갑을 교차한 부드러운 거절로 새로 제작했다. [문구·제작 의도](creative-brief.json)와 [변경 기록](change-record.json)에 범위를 남겼다.

이 후보 세트는 사용자 요청에 따라 **Gaegu Bold**를 사용한다. 실제 잉크 높이 108px·흰 외곽선 약 9px를 1024px 조립 좌표로 지정해, 360px 출력에서 잉크 약 38px·외곽선 약 3px로 보이게 했다. 말줄임표는 본문 대비 55% 크기로 조판했다. 글자는 생성형 이미지에 포함하지 않았다. [폰트 출처·해시](fonts/provenance.json)와 [OFL](fonts/OFL.txt)을 보존했다.

기존 v18 MASTER·원화·스티커·레터링, 모바일 자산, 공유 디자인 토큰과 출시 목록은 변경하지 않았다. [396개 파일의 전후 해시](preservation-check.json)를 대조했다. 활성 MASTER는 계속 v18이다.

## 출처와 검수

- [조립 manifest](manifest.json) · [제작 기록](production-record.json) · [32종 조판 기록](lettering-record.json)
- [재사용 파생 기록 30종](derivation-records) · [실제 imagegen 작화 기록 2종](generation-records)
- 실제 생성에 사용한 준비 프롬프트: [10번](../../../quality/jobs/10-v20-r1/prompt.txt) · [15번](../../../quality/jobs/15-v20-r1/prompt.txt). 첨부 파일·역할·해시는 각 준비 및 생성 기록에 남겼다.
- [입 좌표·기울기 관찰](inspection.json) · [자동 검사 결과](inspection-status.json) · [시각 관찰·한계](visual-review.json)
- [프로젝트 검증 결과](../../../quality/v20-verification-20261015.json) · [공통 검수 절차](../../../quality/README.md)

기술 검사는 32종 모두 통과했다. 최소 여백 16px, 가장 큰 파일 91,980바이트이며, 문구·그림 충돌은 없다. 입 자동 검사는 **23종 통과·9종 재검토**다. 재검토 번호는 **05·12·15·20·21·28·29·31·32**다. 15번은 새 입선의 질감 입자가 진한 임계값에서 닫힌 영역으로 검출됐다. 다른 8종은 원화의 좌표·기울기·불확실성을 그대로 보존했다. 통과를 위해 ROI·임계값·신뢰 키를 변경하지 않았다.

360px 전체, 80·120px 밝고 어두운 배경, 문구 없는 배치와 손·소품을 관찰했다. 80px에서는 미세 격자·질감이 약해지며, 실제 카카오톡 기기 전송·읽기 속도·구매 선호는 검증하지 않았다. 에이전트의 관찰은 외부 시각 검수나 서명이 아니다.

## 재조립

기존 준비·작화 기록을 덮어쓰지 않고 다음 명령으로 조립·검토 자료를 재현한다.

```sh
pnpm jango:lettering design/jango/emoticons/kakao-32/v20
pnpm jango:build --base=design/jango/emoticons/kakao-32/v20
node scripts/build-jango-expression-review.mjs --base=design/jango/emoticons/kakao-32/v20
node scripts/register-jango-emoticon-review.mjs --base=design/jango/emoticons/kakao-32/v20
node scripts/build-jango-review-gallery.mjs --base=design/jango/emoticons/kakao-32/v20
pnpm jango:reports:refresh
pnpm jango:check
```

## 사용·출시 범위

이번 요청은 32종 후보 제작이다. MASTER 채택·앱 runtime 교체·카카오 업로드·제안·판매·서명된 출시는 수행하지 않았다. `jango:promote`·`jango:export`의 기존 서명 조건을 유지한다.

재사용 기록의 `imageGeneration: false`는 **이번 복사·배치 작업에서 새 생성이 없었다는 뜻**이다. 30종도 v18의 AI 제작 계보를 승계하며, 새 포즈 2종은 공식 imagegen으로 제작했다. [현재 카카오 운영 원칙](https://emoticonstudio.kakao.com/guideline)의 생성형 AI 제작 제안 제한은 해결되지 않았다. 이 묶음을 제출 가능·판매 승인된 상품으로 표시하지 않는다.
