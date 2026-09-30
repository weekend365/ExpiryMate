# 장고 제작·검수·최종 채택

규칙 정본은 [BIBLE](../reference/JANGO-CHARACTER-BIBLE-v1.md)과
[STYLE GUIDE](../reference/JANGO-STYLE-GUIDE-v1.md)다.
[rules.json](./rules.json)은 고정 MASTER의 경로·해시, 제작 불변 조건과 자동 검사 설정을 연결한다.
감정·동작 요청을 형태 규칙 예외로 해석하지 않는다. 명시적인 규칙 변경 요청은 문서·검사·검수 정책을
함께 검토해야 하며, 기존 후보를 통과시키려는 기준 완화는 허용하지 않는다.

## 1. 생성 전 준비

프로젝트 루트에서 다음 명령을 실행한다. 같은 작업 ID는 덮어쓰지 않는다.

```sh
pnpm jango:prepare 02-v12 design/jango/emoticons/kakao-32/v10/source-originals/02.png '손과 눈썹을 자연스럽게 정돈하고 MASTER 입선 유지'
```

`jobs/<id>/`에 MASTER 입 확대 이미지, 고정 규칙이 포함된 `prompt.txt`,
MASTER·문서·규칙·검사 코드·입력·프롬프트 해시를 담은 `preflight.json`이 생성된다.
에이전트는 MASTER와 편집 대상을 실제 이미지 참조로 첨부하고 준비된 프롬프트를 사용한다.
프롬프트·입력·규칙이 바뀌면 새 작업 ID로 다시 준비한다.
이 명령은 이미지 생성 도구를 호출하지 않는다. 직접 도구 호출을 OS 수준에서 차단하는 기능도 아니다.

## 2. 생성물 등록과 검사

이미지 생성 결과와 파생 파일은 새 버전 디렉터리에 저장한다. 과거 결과를 덮어쓰지 않는다.
`candidates/<id>.json`에 다음 정보를 기록한다.

```json
{
  "id": "02-v12",
  "directory": "design/jango/emoticons/kakao-32/v12",
  "source": "design/jango/emoticons/kakao-32/v12/source-originals/02.png",
  "sticker": "design/jango/emoticons/kakao-32/v12/stickers/02.png",
  "mouthRoi": [473, 519, 83, 51],
  "tiltDegrees": 0,
  "visibility": "clear",
  "preflight": "design/jango/quality/jobs/02-v12/preflight.json",
  "disposition": "candidate"
}
```

위 좌표는 MASTER의 예시이며 새 원화에 그대로 쓰면 안 된다. 원본 픽셀 기준으로 입 전체와 여백을
포함하는 `[x, y, width, height]`를 시각적으로 지정한다. ROI·각도·가림 여부도 외부 검수 대상이다.
검사를 통과시키려고 선 일부만 선택하거나 눈·다른 부위를 입으로 지정하면 안 된다.

```sh
pnpm jango:audit 02-v12
pnpm jango:check
```

- `audit`: 보고서를 재계산한다. 입 위반·규격 실패·미준비·오래된 준비·반려·측정 불확실성은 종료 코드 1.
- `check`: 보고서 최신성, 미등록 PNG, v10 보존, 최종본 서명을 검사한다. 반려 후보의 존재 자체는 허용한다.
  따라서 `check` 통과는 모든 후보의 디자인 통과를 뜻하지 않는다.
- 입 검사: 세 밝기 임계값에서 연결 성분, 닫힌 내부 영역, 검은 면적을 MASTER와 비교한다.
  `0.64` 절대 채움률·MASTER 대비 `1.4`배는 자동 선별용 보수적 경계이며 해부학적 정본 수치가 아니다.
  임계값별 결론 불일치·작은 검출·ROI 경계 접촉·복수 성분·가림·25도 초과 기울기는 재검토로 남긴다.
- 기술 검사: 360px 출력, 가시 픽셀, 투명 가장자리를 검사한다.
- 이 검사는 일반적인 U자 여부를 완벽하게 증명하지 못하며, 입의 위치·눈·손·모자·팔레트·
  소스와 출력의 일치·작은 화면 가독성은 서명된 시각 검수로 보완한다.
  기존 앱용 `mascot:anatomy:audit`를 대체하지 않는다.

보고서의 `binding`은 후보 설정(ROI 포함), 원본·출력 및 버전 디렉터리 전체 파일 해시,
MASTER·문서·규칙·검사 구현과 생성 전 준비에 연결된다. 어떤 항목이 바뀌어도 이전 승인은 무효다.

## 3. 최종 채택과 출력

`releases.json`만 최종 채택 목록이다. 현재 승인된 이모티콘은 없고 v10은 미승인 역사 기록,
v11 2번은 반려 기록이다. `approved: true`, 제작 기록의 PASS, 에이전트의 설명으로 채택할 수 없다.

외부 검수자는 보고서 binding, MASTER와 원화·출력·비교 이미지를 검토하고 다음 payload에
Ed25519 서명을 만든다. JSON을 재귀적으로 키 정렬한 UTF-8 문자열(`canonical` 함수)이 서명 대상이다.
`signature`는 그 서명의 base64다. 검수 내용은 [rules.json](./rules.json)의 `visualChecks` 전 항목이며
하나라도 미확인·실패면 승인하지 않는다. 에이전트는 검수 서명이나 사용자 승인을 생성하지 않는다.

```text
payload: { binding, decision: "approved", reviewer, reviewedAt, checks: { 각 visualChecks 항목: true } }
signature: base64 Ed25519 signature over canonical(payload)
```

신뢰 공개키는 검수자가 관리하고 로컬 환경 및 GitHub repository variable
`JANGO_REVIEW_PUBLIC_KEY`에 PEM 형식으로 설정한다. 비공개키는 저장소·에이전트 작업환경에 두지 않는다.
이번 구현에서 실제 승인 키나 가짜 승인을 만들지 않았다. 공개키 미설정 상태에서는 최종 채택·출력이 차단된다.

```sh
pnpm jango:promote 02-v12 design/jango/quality/reviews/02-v12.json
pnpm jango:export
```

`promote`는 현재 보고서를 다시 계산해 모든 자동 검사와 외부 서명을 확인한 뒤 목록에 등록한다.
`export`는 전체 채택 목록을 다시 검증한 뒤 `output/jango-approved/`에 PNG를 출력한다.
출력 경로가 이미 있으면 덮어쓰지 않는다. 후보 디렉터리에서 직접 배포하지 않는다.

## CI와 신뢰 경계

CI quality 작업에서 `jango:check`를 실행하고 `pnpm test`에 회귀 검사를 포함한다.
저장소 관리자는 quality 검사를 필수 상태 검사로 설정하고, 검사 코드·규칙·MASTER·워크플로 변경에
별도 리뷰를 요구해야 한다. 이 원격 보호 설정은 이번 로컬 구현으로 변경하지 않았다.
에이전트가 검사 코드와 CI를 임의로 바꾸거나 외부 검수 비공개키에 접근할 수 있다면 강제력이 사라진다.
직접 파일 복사를 막는 DRM이 아니라 준비·채택·출력·CI 경로에서 실패 시 차단하는 절차다.

## 회귀 증거

`pnpm jango:test`는 실제 MASTER의 열린 U자 선 통과, 실제 v11 검은 채움 입 실패,
[첫 시안](./fixtures/02-outlined-mouth.png)의 닫힌 테두리 실패를 확인한다.
해당 시안은 실패 재현 전용이며 생성 참조로 사용하지 않는다.
ROI 오류·가림·과한 회전·서명 위조·키 미설정·파일 변경·준비 변경·미등록 이미지도 거부하는지 확인한다.
픽셀 선별 통과와 전체 디자인 승인은 별도로 유지한다.
