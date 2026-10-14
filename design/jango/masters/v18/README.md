# 활성 v18 원본 MASTER

2026-10-14 사용자 지시로 [원본 32종](../../emoticons/kakao-32/v18/source-originals)을
장고의 공통 제작 MASTER로 복원했다. 대표는 24번이며 [등록 기록](./master.json)에 실제
경로·해시·사용자 지시와 범위를 기록했다. [활성 참조](../../style-master.json)가 이 기록을 가리킨다.

- [BIBLE](../../reference/JANGO-CHARACTER-BIBLE.md)·[STYLE GUIDE](../../reference/JANGO-STYLE-GUIDE.md)·
  [복원 범위](../../reference/STYLE-MASTER-ADOPTION.md), AGENTS와 자동 적용 규칙을 v18로 정리했다.
- 신규 준비는 `handdrawn-crayon`을 사용한다. v19 연필 스타일은 과거 감사용이다.
- 새 앱 작화는 모자부터 두 신발까지 전신을 기본으로 한다. 원본의 하반신 프레이밍은 보존한다.
- 손그림은 캐릭터·배경 이미지에 한정하고 기존 UI·Pretendard·공유 토큰·접근성을 유지한다.
- 기존 앱 캐릭터·브랜딩·배경·원본 PNG는 변경하지 않았다. v19 교체는 중단했고
  [종료 기록](../../quality/history/app-v19-cancelled-20261014/decision.json)을 남겼다.
- v19의 과거 채택·승인 이미지와 SNS v6의 제작 계보는 보존한다. SNS의 표현 확장·연출·
  한글·검수 기준은 유지하며 신규 캐릭터는 현재 v18 MASTER를 따른다.

[검증 기록](./restoration-verification.json): 장고 계약 23개, 전체 테스트 1,348개 통과
(기존 API 6개 skip). docs·lint·typecheck/shared build·jango:check와 캐릭터·브랜딩·배경
감사가 통과했다. 캐릭터 57개·브랜딩 6개·보호 원본/배경/토큰 274개 파일의 해시가 같고
runtime 매핑, 입 측정·재검토, 기존 검수/출시 기록도 유지했다. 보고서의 바인딩·활성 MASTER
설명과 관찰 기록의 BIBLE 해시만 갱신했다.

이번 작업은 규칙·참조·검증만 반영했다. 새 기기 캡처·화면 읽기 검증은 미실시이며 UI나 이미지의
변경은 없었다. 앱 빌드·스토어 업로드·배포·이모티콘 서명 출시는 수행하지 않았다.
