# 장고랑 살아보니 04 — 릴스 완성본

사용자 요청: “지금 원화 기준으로 앱 화면의 퀄리티를 신경써서 장고 카툰 릴스 생성해줘. 실제 장고야 부탁해 앱의 UI 디자인을 활용해도 좋아.”

- [최종 영상 — 음악 포함, 24초](reel/jango-ep04-music.mp4)
- [360×640 검토 영상](review/reel/jango-ep04-360.mp4)
- [커버 JPG](cover.jpg) · [커버 PNG](cover.png)
- [캡션·음악 크레딧·영상 설명](caption.txt)
- [최종 디코딩 장면표](review/reel/decoded-timeline.jpg)
- [UI 겹침 시뮬레이션](review/reel/ui-overlap-sheet.jpg)
- [로컬 검토 페이지](review/reel/index.html)

선택 원화 4장의 바이트를 보존하고 1080×1920, H.264, 30fps, AAC 영상으로 조립했다. 장면별 4·5·9·6초, 100→103% 확대, 고정 말풍선과 대사, 단순 컷 전환을 적용했다. 마지막 브랜드와 행동 안내는 21–24초에 표시한다.

휴대전화 화면은 현행 앱 코드의 디자인 토큰, Pretendard, 카드·입력창·버튼 및 기능 문구를 사용해 **영상용으로 확대·축약한 시연 UI**다. 실행 중인 앱의 스크린샷과 구분하며, 장면과 캡션에 시연·입력 과정 축약을 표시했다. 영수증 후보 목록 → 기한·보관 위치 확인 → 재료 추가 → 완료 순서다. 날짜·수량·가격은 예시이며 운영 API·계정·DB에 연결하지 않았다. 원화의 화면 기울기, 베젤, 노치, 손가락 가림을 유지하도록 투영했다.

음악은 Carefree — Kevin MacLeod (incompetech.com), CC BY 4.0이다. 첫 24초에 음량 조정과 시작 0.3초·끝 1초 페이드를 적용했다. [사용 근거](music/license.json), [공식 페이지 확인 이미지](music/source-license.png), 출처와 변경 고지를 보존했다.

원본 및 360px 화면의 한글·앱 핵심 정보, 확대 구간의 가림, 문구 전환, 커버의 3:4·정사각형 중앙 크롭을 검토했다. 두 영상 모두 QuickTime에서 0–24초 재생 완료를 확인했다. 전체 디코딩 오류·검은 프레임·0.1초 이상 비정상 무음은 검출되지 않았고, 실제 음량은 -18.1 LUFS, 최대 true peak는 -4.4 dBFS다. **직접 청취 완료로 기록하지 않았으며**, 실제 Instagram 게시 미리보기·플랫폼 음성 재생·커버 적용은 게시 단계에서 확인해야 한다. UI 겹침 이미지는 시뮬레이션이다.

## 재현과 기록

`render_ui.py` → `build_reel.py layout` → `build_reel.py encode` → `validate_reel.py` 순서로 실행한다. Python에 Pillow, NumPy, imageio-ffmpeg가 필요하다. 원화는 앞 단계에서 공식 built-in imagegen으로 생성했으며 [프롬프트](prompts)와 preparation/generation 기록을 그대로 보존했다. 이 단계에서는 새 작화를 생성하지 않고 UI·한글 조판과 영상 합성을 수행했다.

앱 디자인 근거·폰트·말풍선 출처와 해시는 [릴스 준비 기록](reel-preparation.json), 타임라인·인코딩 설정은 [영상 기록](reel/production.json), 최종 검수 범위와 제한은 [검수 기록](review/reel/visual-review.json)에 있다. [릴스 제작 기록](reel-production-record.json)과 [현재 산출물 해시](reel-file-hashes.json)를 함께 보관한다. 무음 중간 영상은 다른 음악으로 재편집할 때 사용할 수 있는 영상 마스터로 남겼다.

기존 `README.md`, `production-record.json`, `file-hashes.json`은 **원화 제작 단계의 과거 기록**이다. 이 요청의 제작·검수 기록은 `reel-*`와 `review/reel/`에 추가했다. 기존 원화·v18·승인 v6·3화 등 보존 대상 210개 파일의 해시가 유지됐다.

Instagram 게시, 커밋·푸시, 앱 코드·API·DB·MASTER 변경은 수행하지 않았다. 캡션은 게시용 초안이며 AI 작화 표시와 음악 크레딧을 포함한다.
