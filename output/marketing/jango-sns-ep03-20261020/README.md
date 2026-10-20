# 장고랑 살아보니 03 — 냉동실 보물찾기

2026-10-20, 승인된 콘티를 제작·보정해 `@jango_plz`에 릴스 1건을 게시했다.

- 게시 주소: https://www.instagram.com/jango_plz/reel/DetNFmvyZM3/
- 최종 영상: [jango-ep03-music.mp4](reel/jango-ep03-music.mp4)
- 별도 커버: [cover.jpg](cover.jpg)
- 게시 화면: [reel-posted.jpg](publication/reel-posted.jpg)
- 프로필 썸네일: [profile-thumbnail.jpg](publication/profile-thumbnail.jpg)
- 수정한 두 번째 컷: [360px 보기](review/02-360.png)
- 게시 검증: [publication.json](publication/publication.json)

## 제작과 보정

1080×1920, H.264/AAC, 30fps, 24초, 4장면이다. 각 장면은 6초 동안 100→103%로
확대하고 단순 컷으로 전환한다. 대사와 말풍선은 고정하며 휴대전화의 Pretendard 문구는
기기와 함께 움직인다. 마지막 21–24초에는 브랜드와 행동 안내를 표시한다.

공식 imagegen으로 글자 없는 장면과 투명 말풍선을 제작했다. 장고 외형은 v18 24번,
장면 통합은 승인 v6, 여성의 얼굴·의상은 2화를 참조했다. 실제 입력 순서·역할·해시,
프롬프트 및 파생 관계는 [asset-provenance.json](asset-provenance.json)에 기록했다.
원화는 비례 변환했으며 인물이나 글자를 비균일하게 늘이지 않았다.

사용자가 두 번째 컷의 긴 몸통을 지적한 뒤 `scene-02-r3`를 공식 imagegen으로 보정했다.
선택한 `scene-02-r4`는 짧은 몸통·앞치마와 두 신발을 명확히 보여준다. 휴대전화와
가리키는 동작은 유지했다. 수정본으로 재출력하고 이전 업로드 초안을 닫은 뒤 게시했다.
초기 준비 기록의 두 번째 컷 하반신 크롭 계획은 이 보정으로 대체된다.

## 검수

- 원본, 360×640 장면별 시작·중간·끝 프레임, 휴대전화 문구 정렬과 확대 중 잘림을 확인했다.
- 전체 디코딩: 720프레임·24초, 오류·검은 프레임·클리핑·중간 무음 구간 없음.
- 마지막 대사와 21초 브랜드 전환을 확인했다. 커버는 실제 프로필에서도 제목·장고·만두 봉지가 보인다.
- 게시된 영상에서 보정 컷, AI 콘텐츠 표시, 캡션·음악 크레딧, 0–24초 재생과 음소거 해제를 확인했다.
- Instagram이 제공한 재생본은 720×1280이며 업로드 원본은 1080×1920이다.
- 이미지별 대체 텍스트 입력란이 없는 릴스이므로 캡션에 한국어 영상 설명을 넣었다.
- 프로필의 App Store·Google Play 링크를 게시 후 다시 확인했다.

세부 근거는 [시각 검수](review/visual-review.json),
[기술 검사](review/technical-quality.json), [재생 기록](publication/posted-playback.json)에 있다.
실제 UI 검수는 Chrome의 Instagram 화면에서 수행했으며 모바일 기기 직접 검수로 기록하지 않는다.

## 음악과 청취 한계

**Carefree — Kevin MacLeod**, [원곡 출처](https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1400037),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
첫 24초를 사용하고 음량을 조정했으며 시작 0.3초·끝 1초 페이드를 적용했다.
출처·라이선스·변경 고지는 실제 캡션에 포함했다. 원음과 사용 근거는 `music/`에 보존했다.

이 실행 환경에서는 에이전트가 소리를 직접 듣는 입력을 사용할 수 없어 주관적 전체 청취 완료를
주장하지 않는다. 전체 디코딩·연속성·클리핑 검사, 게시된 2화와 디코딩 PCM이 정확히 같다는
[음원 비교](review/audio-comparison.json), Instagram의 음소거 해제 재생을 별도로 확인했다.

## 기록과 재현

- [production-record.json](production-record.json): 승인 범위, 보정 이유, 최종 파일 해시
- [preparation.json](preparation.json): 확정 콘티, 기능 근거, 당시 참조·정책 해시
- [caption.txt](caption.txt): 승인 문구 그대로 게시한 캡션
- [build.py](build.py): 별도 한글 레이어·커버·영상 합성
- [check.py](check.py): 전체 디코딩, 음향 기술 검사, 시점별 프레임과 보존 검사
- [repository-checks.json](review/repository-checks.json): 저장소 검사 결과
- [file-hashes.json](file-hashes.json): 보존 산출물의 SHA-256

재현 환경은 `/private/tmp/jango-cartoon-20261020-venv/bin/python`에 설치한 Pillow,
NumPy, imageio-ffmpeg다. `build.py layout`, `build.py encode`, `check.py` 순서로 실행한다.
수동 시각 검수와 Instagram 게시 확인은 스크립트 실행으로 대체되지 않는다.

이 회차 제작·보정·게시 요청을 승인 근거로 기록했으며 사용자 검수 서명을 만들지 않았다.
v18 MASTER와 기존 승인·회차 파일 127개의 바이트를 보존했다. 변경 범위는 본 폴더이며
앱 코드·공개 API·DB·기존 게시물·MASTER는 변경하지 않았다.
커밋은 게시 완료 후 사용자의 별도 요청에 따라 수행하며 푸시는 포함하지 않는다.
