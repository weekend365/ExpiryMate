# 장고 준비·검수·최종 출력

[v18 MASTER 목록](../master-set.json), [BIBLE](../reference/JANGO-CHARACTER-BIBLE.md), [스타일 가이드](../reference/JANGO-STYLE-GUIDE.md)가 정본이다. 정책 v5는 단일 handdrawn-crayon 스타일만 허용한다.

## 준비

`jango:prepare id input request [mouthMode] [reason] [expression.json]` 위치 인자와 `--style`·`--kind`·`--composition`·`--panel` 옵션을 유지한다. 구성 옵션은 등록된 v18 보드와 1–32 번호를 함께 사용한다.

```sh
pnpm jango:prepare 01-v19 design/jango/emoticons/kakao-32/v18/source-originals/01-r2.png '손인사 동작 변경' speak-open '먼저 인사' --style handdrawn-crayon --kind emoticon --composition design/jango/reference/v18-composition.png --panel 1
```

입은 idle-u·speak-open·neutral-line·sad-arc다. 기본 외 모드는 선택 이유가 필요하다. 표정 JSON은 family·intensity(1–3)·eyes·brows·pose를 기록한다. 실제 참조는 v18 MASTER 또는 생성 기록이 연결된 파생 후보여야 한다. 등록되지 않은 파일·변조·삭제된 파일·순환 계보는 거부한다.

형태·그림체는 24번, 입은 09/01/11/17번, 동작은 해당 컷을 첨부한다. 동일 파일을 한 번만 첨부하고 실제 배열 기준 imageIndex를 기록한다. 최대 5개, 입 확대는 진단 자료로 구분한다. 준비 기록을 덮어쓰지 않는다.

## MASTER와 후보

v18 32종은 사용자 지정 MASTER다. 새 준비를 소급 작성한 생성 후보가 아니다. 종료된 제작 기록은 history/v18-creation에 원문으로 보존하며 과거 이미지가 삭제되었음을 명시한다. 이력 속 경로는 활성 입력이 아니다.

`jango:audit v18-01`부터 `v18-32`까지 현재 정책으로 재측정할 수 있다. preparation은 master-adoption으로 명시한다. 과거 9종 재검토와 현재 입 측정을 별도 표시한다. MASTER 해시 변경을 자동 수용하지 않는다.

새 결과는 별도 버전에 개별 준비·생성 기록과 후보를 만든다. `record-jango-image.mjs <번호-v버전[-시도]> <실제 생성 파일>`로 도구 출력 바이트를 보존하고 `build-jango-emoticons.mjs --base=...`로 조립한다. v18 원화·스티커·레터링은 덮어쓰지 않는다.

## 검사와 출시

- jango:reports:refresh는 현재 증거만 재계산한다. 서명·준비·채택을 생성하지 않는다.
- jango:check는 MASTER 바이트, 보고서 최신성, 미등록 이미지, 서명된 출시 목록을 검사한다. 종료 이력은 활성 후보 검사에서 제외한다.
- 입 검사의 임계값·채움·연결·닫힌 영역·곡률·혀 기준은 유지한다. 기준 원화는 v18로 교체하며 기준 변화에 따른 결과를 숨기지 않는다.
- 가림·질감 불확실성·25도 초과 기울기는 재검토다. 원화 ROI를 거짓으로 바꾸지 않는다.
- 360px·최소 8px 여백·투명 가장자리·원화 잘림·문구 충돌을 검사한다. 작은 출력과 감정 구분은 별도 시각 관찰이다.

`jango:promote <id> <signed-review.json>`와 `jango:export`는 기술·입 검사 통과와 JANGO_REVIEW_PUBLIC_KEY로 검증한 Ed25519 외부 서명을 요구한다. 사용자 MASTER 채택이나 앱 사용 지시를 출시 서명으로 대신하지 않는다. 에이전트는 서명이나 검수용 개인키를 만들지 않는다.

서명 payload는 `{binding, decision:"approved", reviewer, reviewedAt, checks}`이며 rules.json의 공통·스타일 시각 검사 전 항목이 true여야 한다. 내용 변경은 binding을 변경해 이전 서명을 무효화한다. `releases.json`만 승인된 이모티콘 출력 목록이다.
