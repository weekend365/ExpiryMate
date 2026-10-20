# 장고 v23 — 29번 지쳤어...

2026-10-16 요청에 따라 **29번만** 공식 built-in imagegen으로 새로 생성했습니다. 털썩 주저앉아 두 발을 앞으로 내밀고, 양 장갑·어깨를 낮춘 자세와 반쯤 감긴 눈·힘없는 입을 적용했습니다. 기존 v22의 나머지 31종은 그대로 사용합니다.

## 결과

- [문구 포함 360px PNG](stickers/29.png) · [글자 없는 동일 배치](artwork-360/29.png) · [생성 원화](source-originals/29-r1.png)
- [29번 비교 갤러리](index.html) · [v22 전후 비교](comparison-v22.png): 왼쪽이 v22, 오른쪽이 새 후보
- [29번을 바꾼 전체 32종 미리보기](preview-light.png) · [어두운 배경](preview-dark.png)
- [32종 구성·해시 목록](review-set.json): 새 29번 1장과 기존 v22 PNG 31장을 참조하며 기존 파일을 복제·덮어쓰지 않습니다. 전체 미리보기의 다른 31칸은 v22와 픽셀 단위로 동일합니다.
- [80px 밝은 배경](caption-80-light.png) · [80px 어두운 배경](caption-80-dark.png) · [120px 어두운 배경](caption-120-dark.png)

문구는 **지쳤어...**로 세 마침표를 유지했습니다. 글자는 생성 원화에 넣지 않고 v22와 같은 감자꽃 서체·공통 기준 높이 30px·진한 차콜·1.8px 흰 외곽선으로 별도 조립했습니다. ASCII 세 마침표는 폰트의 자연 점 크기를 사용했습니다. 전신과 문구의 충돌은 0픽셀이며 바깥 여백 17px, 파일 크기 93,399바이트의 투명 360×360 PNG입니다.

## 제작·검토

[준비 프롬프트](../../../quality/jobs/29-v23-r1/prompt.txt)와 실제 참조 3장을 해시로 기록한 뒤 생성했습니다. 연결 실패 2회 후 같은 공식 도구의 세 번째 요청이 성공했습니다. CLI/API 대체 경로는 쓰지 않았습니다. [생성 기록](generation-records/29-v23-r1.json)·[시도 기록](generation-attempts.json)·[원화 관찰 좌표](inspection.json)·[시각 검토](visual-review.json)·[자동 검사](inspection-status.json)에 근거가 있습니다. 실제 생성 파일의 바이트를 원화로 그대로 보존했습니다.

모자·손잡이·파인애플·경첩·앞치마·장갑·신발의 연결과 80·120px 읽힘을 관찰했습니다. 작은 출력의 마침표·문구·질감 세부는 약해집니다. 새 입 표현은 expressive-custom이며 자동 통과로 만들지 않고 재검토 상태를 유지했습니다. 이는 검토 후보이며 MASTER·앱 교체·카카오 제출·서명된 출시는 포함하지 않습니다.

[보존 기록](preservation-check.json)의 기존 v18·v20·v21·v22·앱과 과거 준비/출처/이력 1,968개 파일이 변경 전후 일치합니다.

29번 부분 제작 명령은 `pnpm jango:lettering design/jango/emoticons/kakao-32/v23 --only=29`, `pnpm jango:build --base=design/jango/emoticons/kakao-32/v23 --only=29 --partial`입니다. 32행 plan은 전체 명부를 유지하되 실제 산출·선택·생성·검사 기록은 29번 1종이며 31종의 새 작화를 주장하지 않습니다.
