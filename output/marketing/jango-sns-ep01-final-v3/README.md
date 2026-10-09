# 장고툰 1화 · 승인된 대표 컷에서 이어진 4컷

`jango-ep01-v3-01.png`부터 `04.png`까지 1122×1402 PNG다. `02.png`는 사용자가 채택한 `../jango-sns-ep01-direction-v3/discovery-review-r1.png`의 바이트 동일 복사본이며, 기존 Library 항목 `libfile_977ef578050c81919b9bb32a1fe91811`을 유지한다. 1·3·4컷은 승인 장면과 v18 MASTER 24·01번을 실제 참조로 사용해 정식 내장 imagegen으로 새로 그렸다.

`jango-ep01-v3-overview.png`는 읽는 순서의 2×2 미리보기, `review-mobile-360.png`는 각 컷 폭 360px 검토본이다. 게시 문구는 `jango-ep01-v3-caption.txt`에 있다. 새 컷의 사용자 SNS 채택이나 게시 완료를 자동으로 주장하지 않는다.

그림·말풍선 원본은 `artwork/`, 한글 글자 레이어는 `lettering/`에 분리했다. 재렌더는 네트워크나 새 이미지 생성을 호출하지 않는다. 저장소 루트에서 `node output/marketing/jango-sns-ep01-final-v3/render.mjs`를 실행한다. macOS AppKit/CoreText와 기존 pngjs·리사이즈 코드를 사용한다.

실제 프롬프트는 `prompts/`, 참조 경로·SHA256·생성 원본·MASTER 계보는 `preparation.json`과 `production-record.json`에 기록했다. `visual-review.json`은 사람·장고·음식·조판 검토와 관찰 한계, `render-report.json`은 출력 크기·해시·승인 컷 보존, `validation.json`은 코드 검사, `delivery.json`은 파일별 Library 상태를 기록한다. Library 전달 전후에는 `delivery.json`의 확인된 상태를 따른다.

앱의 등록 재료 기반 추천과 임박 재료 우선 기능을 이야기로 표현했다. 두부·달걀·대파 요리는 이야기 속 예시이며 실제 AI 응답 캡처가 아니다. 생성된 앱 UI, 절약 수치, 식품 안전 보장, SNS 자동 게시를 포함하지 않는다. 앱 코드·기존 v1/v2·MASTER 원본은 수정하지 않았다.
