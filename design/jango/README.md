# 장고 v19 MASTER와 과거 원본 참조

[v19 활성 MASTER](./style-master.json) · [채택·마이그레이션 범위](./reference/STYLE-MASTER-ADOPTION.md) · [v18 원본 32종](./master-set.json) · [BIBLE](./reference/JANGO-CHARACTER-BIBLE.md) · [스타일 가이드](./reference/JANGO-STYLE-GUIDE.md) · [검수](./quality/README.md)

활성 기준은 [v19 MASTER](./masters/v19/master.json)이며 v18을 대체한다. 신규 제작은 v19의 승인된 연필 스타일을 따른다. v19는 기준이미지와 사양만 등록했고 32포즈와 앱 파생물은 미전환이다. v18의 24번 완성!은 구조 대표이며 32종 원본은 역사적/포즈 참조로 보존한다. 현재 앱 runtime은 아직 v18 파생이고 최신 스타일로 교체하지 않았다. [갤러리](./emoticons/kakao-32/v18/index.html)에서 32종을 비교한다. 앱 파생은 manifest.json과 기존 sync/build 명령으로 재현한다.

사용자 MASTER 채택과 외부 서명된 이모티콘 출시는 별도다. 종료된 제작 기록과 삭제 목록은 quality 아래에 보존한다.

앱 에셋을 sync/build한 뒤 `pnpm jango:app-review`로 밝고 어두운 배경의 크기별 비교와 브랜딩 비교 화면을 재생성한다(Python Pillow 필요). 실제 기기 화면은 `app-review/`에 별도로 기록한다.
