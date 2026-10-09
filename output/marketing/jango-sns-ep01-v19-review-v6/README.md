# 장고 SNS 1화 v6 — 사용자 채택 완료

2026-10-09 사용자가 v6 확정과 카툰 연재 제작 규칙 반영에 동의했다.
현재 채택 상태와 정확한 파일·해시·Library ID/버전은
[채택 레지스트리](../../../design/jango/cartoon-series.json)가 정본이다.
[연재 제작·검수 기준](../../../design/jango/reference/SNS-CARTOON-GUIDE.md)을 후속 회차에 적용한다.
장고 캐릭터의 공통 정본은 계속 v19다.

- [전체 보기](jango-ep01-v6-overview.png), [컷당 360px 보기](review-mobile-360.png)
- [1컷](jango-ep01-v6-01.png), [2컷](jango-ep01-v6-02.png), [3컷](jango-ep01-v6-03.png), [4컷](jango-ep01-v6-04.png)
- [게시 문구](jango-ep01-v6-caption.txt), [제작 기록](production-record.json), [시각 검수](visual-review.json), [Library 저장 결과](delivery.json)

1·2컷은 기존 승인 바이트를 보존했다. 3컷은 등록 재료의 추천 메뉴 확인·선택,
4컷은 식사 결과·브랜드·효용 안내를 보여준다. 휴대전화 화면은 실제 기능을 간략히 표현했고 메뉴·기한은 예시다.

이 디렉터리의 기존 preparation/episode/production/validation/visual-review/delivery 기록은
제작·검수·저장 당시의 스냅샷이다. 그 안의 `candidate`, `userAdoption: null` 등은 승인 전 상태를
보존한 것이며 현재 상태는 위 채택 레지스트리에서 확인한다. 과거 준비·프롬프트·해시를 소급 변경하지 않는다.
과거 렌더러의 문서 해시 검사는 당시 환경에 대한 검사다. 현재 문서가 달라졌다고 준비 해시를 바꾸거나
원본을 재렌더링하지 않는다. 다음 회차는 새 명세·새 준비 기록으로 시작한다.

규칙과 자료를 다른 체크아웃으로 옮길 때는 레지스트리가 가리키는 승인 이미지와 제작 계보도 함께 보존한다.
이 승인에 새 카툰 제작, v19 교체, 앱/이모티콘 이관, 커밋·푸시·SNS 게시는 포함되지 않는다.
