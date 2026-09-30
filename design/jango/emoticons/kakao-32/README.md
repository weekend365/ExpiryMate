# 장고 카카오 이모티콘 작업 리소스

2026-09-30에 외부 `JANGO-Character-Kit`의 필수 리소스만 가져왔다.
출처·파일 크기·SHA-256과 갱신 전 문서 해시는 [가져오기 기록](./import-manifest.json)에 있다.
외부 절대 경로는 출처 기록이며 프로젝트 작업이나 빌드 의존성이 아니다.

## 위치와 우선순위

- 형태와 입 표현은 최신 [BIBLE](../../reference/JANGO-CHARACTER-BIBLE-v1.md)과
  [STYLE GUIDE](../../reference/JANGO-STYLE-GUIDE-v1.md)를 따른다.
  두 문서의 2026-09-30 입 표현 정정이 과거 감정별 확장 지침보다 우선한다.
- [연기 가이드](../../reference/JANGO-ACTING-GUIDE-v1.md)와
  [이미지 프롬프트](../../reference/JANGO-IMAGE-PROMPTS-v1.md)는 제작 참고 자료다.
  과거 입 표현 지시는 최신 정정과 대조한 뒤 사용한다.
- `planning/`에는 초기 [32종 기획안](./planning/JANGO-KAKAO-EMOTICON-32-PLAN-v1.md)과
  [JSON](./planning/JANGO-KAKAO-EMOTICON-32-PLAN-v1.json)이 있다.
  현재 번호별 제목·대사·선택 원본은 [v10 manifest](./v10/manifest.json)를 우선 확인한다.
- `v10/`은 외부 최신 버전의 217개 파일을 가져온 기준 스냅샷이다.
  [갤러리](./v10/index.html), 생성 원본, 캐릭터·문구 분리 레이어, PNG 출력,
  프롬프트, 폰트와 OFL 라이선스, 제작·QA 기록을 포함한다.
  갤러리의 제외된 ZIP 다운로드 링크 2개만 로컬 미리보기·작업 안내로 바꿨다.
  나머지 파일은 외부 원본과 동일하며, 갤러리의 원본·변경 후 해시도 가져오기 기록에 남겼다.
  `v10/references/`의 문서 사본은 당시 제작 기록이며 이후 규칙의 별도 정본이 아니다.

## 다음 제작에서 유지할 기준

- 이모티콘 참조 MASTER는 [v10 원본](./v10/references/jango-idle-original.png)이다.
  앱의 `reference/bible-master-idle.png`와 파일 해시가 다르므로 동일 파일로 간주하거나
  덮어쓰지 않는다. 픽셀 동등성은 확인하지 않았다.
- v10을 보존하고 다음 수정은 새 버전에서 진행한다. 03번 승인본과
  [제작 기록](./v10/README.txt)에 명시된 12번의 선택된 1안, 기존 문구 레이어를 유지한다.
- [QA 기록](./v10/QA-report.json)의 미수정 입 표현 검토 대상은
  04·10·14·18·20·21·23·32번(색 채움·검은 경계)과 15·16번(O자 외곽선)이다.
  기술 PASS는 전체 디자인 승인이나 최신 입 규칙 준수 판정이 아니다.
- 가져오기 검증은 파일 무결성 확인이다. 새 시각·비례 검수 또는 제출 규격 검증을
  대신하지 않으며, 제출 전 플랫폼 최신 기준을 확인한다.

앱 mood·런타임 적용은 [활성 캐릭터 가이드](../../../../docs/JANGO_CHARACTER_STYLE_GUIDE.md)를 따른다.
이모티콘 원본·문구 레이어를 앱 런타임 자산으로 직접 사용하지 않는다.
기존 기본 포즈 6종, 이전 버전, ZIP, 외부 `work/` 코드, 광고 지침은 이번에 복사하지 않았다.
제작 도구 이식과 신규 이미지 생성은 후속 작업이다.
