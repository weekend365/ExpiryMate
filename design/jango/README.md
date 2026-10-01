# 장고 v18 MASTER

[32종 MASTER](./master-set.json) · [BIBLE](./reference/JANGO-CHARACTER-BIBLE.md) · [스타일 가이드](./reference/JANGO-STYLE-GUIDE.md) · [검수](./quality/README.md)

대표는 24번 완성!이다. 신규 제작과 앱은 선택된 v18 원화만 사용한다. [갤러리](./emoticons/kakao-32/v18/index.html)에서 32종을 비교한다. 앱 파생은 manifest.json과 기존 sync/build 명령으로 재현한다.

사용자 MASTER 채택과 외부 서명된 이모티콘 출시는 별도다. 종료된 제작 기록과 삭제 목록은 quality 아래에 보존한다.

앱 에셋을 sync/build한 뒤 `pnpm jango:app-review`로 밝고 어두운 배경의 크기별 비교와 브랜딩 비교 화면을 재생성한다(Python Pillow 필요). 실제 기기 화면은 `app-review/`에 별도로 기록한다.
