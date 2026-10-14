# 장고 v18 원본 MASTER

[v18 활성 MASTER](./style-master.json) · [복원 범위와 과거 이력](./reference/STYLE-MASTER-ADOPTION.md) · [원본 32종](./emoticons/kakao-32/v18/source-originals) · [MASTER 목록](./master-set.json) · [BIBLE](./reference/JANGO-CHARACTER-BIBLE.md) · [스타일 가이드](./reference/JANGO-STYLE-GUIDE.md) · [검수](./quality/README.md)

2026-10-14 사용자 지시로 v18 source-originals 32종을 공통 제작 MASTER로 복원했다. 대표는 24번이다.
신규 장고는 해당 원화의 형태·표정·포즈와 크레파스 선·불투명 색면·민트·차콜·살구 볼터치·약한 종이 결을 따른다.
새 앱 작화는 전신을 기본으로 하며, 하반신이 생략된 원본의 프레이밍과 바이트는 그대로 보존한다.
현재 앱 runtime과 브랜딩은 기존 v18 파생을 유지한다. v19 교체는 중단했고 당시 채택·후보는 이력으로 남겼다.

[갤러리](./emoticons/kakao-32/v18/index.html)는 원본 32종의 기존 검토 스냅샷이다. 과거 상태 설명보다 위 활성 정본을 우선한다.
앱 파생은 manifest.json과 기존 sync/build 명령으로 재현한다. 손그림은 캐릭터·배경 이미지로 한정하며 UI를 재설계하지 않는다.

사용자 MASTER 채택과 외부 서명된 이모티콘 출시는 별도다. 기존 입 재검토와 종료된 제작 기록은 quality 아래에 보존한다.
앱 에셋을 sync/build한 뒤 `pnpm jango:app-review`로 크기별·밝고 어두운 배경·브랜딩 비교를 재생성한다(Python Pillow 필요).
실제 기기 화면은 `app-review/`에 별도로 기록한다. 이번 규칙 정리는 에셋 재생성·앱 교체·배포를 수행하지 않는다.
