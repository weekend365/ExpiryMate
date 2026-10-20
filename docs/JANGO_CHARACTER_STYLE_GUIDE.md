---
status: active
owner: design
last_reviewed: 2026-10-16
source_of_truth: true
---

# 장고 캐릭터 사용 가이드

[v18 활성 MASTER](../design/jango/style-master.json), [BIBLE](../design/jango/reference/JANGO-CHARACTER-BIBLE.md), [스타일 가이드](../design/jango/reference/JANGO-STYLE-GUIDE.md)가 신규 제작 정본이다. 2026-10-14 사용자가 지정한 source-originals 32종의 크레파스 선·불투명 무광 색면·민트·따뜻한 차콜·살구 볼터치·약한 종이 결을 기준으로 한다. [복원 범위와 과거 채택 기록](../design/jango/reference/STYLE-MASTER-ADOPTION.md)을 확인한다.

[v18 원본 32종](../design/jango/emoticons/kakao-32/v18/source-originals)이 활성 MASTER이며 [목록](../design/jango/master-set.json)의 경로·출처·해시·기존 검수를 보존한다. v19 교체는 중단했고 자동 재개하지 않는다. 현재 앱과 브랜딩 에셋은 기존 v18 파생 그대로다.

## 성격과 매체별 표현

장고는 **다정하지만 허당인 생활 친구**다. 남의 밥·휴식·기분을 챙기면서 자신은 멍해지거나 한입을 탐내는 작은 빈틈을 가진다. 따뜻한 외형과 잘 작동하는 원화·문구를 살리고, 장고 인지·보낼 상황·성격 전달을 기준으로 개선한다. [v21 제작 경험의 규칙 반영](../design/jango/reference/STYLE-MASTER-ADOPTION.md)에 따라 성격·표현 원칙은 [BIBLE](../design/jango/reference/JANGO-CHARACTER-BIBLE.md)을 따른다.

신규 이모티콘은 문구가 있어도 전신을 살리며, 눈·입·얼굴 배치·전신 동작을 감정에 맞게 설계한다. 기본형 재현의 좌표와 네 입 모드를 표현의 상한으로 삼지 않는다. 서체 비교·공통 글자 크기·짧은 대화 문구·감정별 레터링과 작은 출력 검토는 [스타일 가이드](../design/jango/reference/JANGO-STYLE-GUIDE.md)를 따른다. 이 표현 기준은 기존 앱의 mood 매핑·상태 안내·Pretendard UI 글꼴을 변경하지 않는다.

## 앱 사용

화면의 시각 표현·사용자 흐름·장고 반응은 [디자인 시스템](./design-system.md)이 정본이다.
작업 전에 변경 범위·보존 기준을 확인한다. 손그림 스타일은 캐릭터·배경 이미지에만 적용하며 카드·말풍선·버튼·제목·기능 아이콘·UI 글꼴로 확장하지 않는다. 기존 화면 구도·흐름을 유지하며 캐릭터 그림체 변경을 앱 구조 변경의 근거로 사용하지 않는다. 캐릭터 외형·제작은 위 MASTER·BIBLE·스타일 가이드를 따른다.

화면은 기존 `Mascot`와 `MascotSpeechBubble`을 사용한다. 직접 PNG import는 Mascot 내부로 제한한다. 기존 mood·size API는 유지한다. `JangoCompanion` 등을 포함한 이전 전체 개편은 철회했으며 자동 도입하지 않는다.

- 기존 v18 runtime 매핑(유지): idle 24, happy 02, worry 17, cooking 23, empty 20, speak 01, think 11, point 14.
- 2026-10-15 추가 매핑: encourage 07(첫 시작 응원), praise 08(재료 등록 완료), acknowledge 09(안내 확인), excited 10(추천 준비 완료), comfort 18(필터 결과 없음), enjoy 22(조리 완료), check 25(홈·보관함 확인), shopping 26(장보기 안내). 원본 32종 중 맥락이 맞는 16종을 사용하며 모든 원화를 억지로 노출하지 않는다. 기존 화면의 캐릭터 영역·문구·순서·동작과 경고/오류의 의미는 보존한다.
- 앱 mood 이름·원본 번호·접근성 표기는 [앱 포즈 목록](../apps/mobile/assets/characters/moods.json), 원본 해시·가공 설정은 [파생 목록](../design/jango/manifest.json)에서 관리한다. 기준 원본 목록의 appMoods는 기존 8종 기준으로 유지하며 신규 매핑은 앱 포즈 목록에서 확장한다. 변경 범위와 검수는 [추가 포즈 검토](../design/reviews/jango-app-poses-20261015/README.md)에 기록한다.
- 현행 앱 기본·아이콘·스플래시·알림 실루엣은 v18 24번에서 파생한다. 새 포즈 제작·검토·채택·매핑 변경은 별도 작업이다. 문구 없는 원화를 사용한다.
- 새 앱 작화는 모자·양팔과 장갑·앞치마·두 다리·두 신발이 모두 보이는 전신을 기본으로 한다. 하반신이 생략된 원본은 보존하고 확장은 전신 MASTER 구조·비율을 따른 별도 후보로 제작·검토한다.
- 원화 전체 가시 영역을 비율 유지해 1024px 안에 배치하고, full/small 및 1x·2x·3x를 만든다. 고정 얼굴 크롭이나 얼굴 늘이기를 하지 않는다.
- 현재 runtime의 캐릭터 팔레트는 `characterColors`다. 신규 작화는 v18 원화와 캐릭터 전용 팔레트를 참고한다. 원본을 재채색하거나 공유 토큰·UI semantic token을 바꾸지 않는다.
- 앱 UI는 Pretendard를 유지한다. 캐릭터·SNS·이모티콘 이미지의 레터링 기준을 UI 글꼴에 적용하지 않는다.
- 주 장고 안내는 화면당 하나다. 주요 작업의 성공 반응·중복 방지·맥락 전환·접근성은 디자인 시스템의 상호작용 규칙을 따른다.
- 배포는 별도 작업이다. 로컬 에셋 교체가 이미 설치된 앱이나 스토어 이미지를 자동 변경하지 않는다.

## 생성과 검사

[준비·검수](../design/jango/quality/README.md)를 따른다. 실제 참조와 파일 해시를 기록하고 MASTER의 이미지 바이트는 보존한다.

이모티콘의 새 입·표정은 BIBLE의 「이모티콘의 표현 확장」과 `--creative-brief` 준비 경로로 의도를 기록한다. `expressive-custom`의 입 진단은 항상 시각 재검토로 남긴다. 기존 원화를 재사용한 배치·레터링 파생과 실제 AI 작화의 출처를 구분하며, 사용자 선호나 규칙 반영으로 검수 결과·출시 서명을 대신하지 않는다.

SNS 카툰은 BIBLE의 「SNS 카툰의 표현 확장」을 따른다. 표정·입·포즈·소품·의상·비율 과장·좌우 반전·색 변형은 별도 후보로 검토·보정하고 사용자가 채택한 범위에서 재사용한다. 기본 입 네 모드는 SNS 표현의 절대 상한이 아니다. SNS 채택을 앱 에셋 교체나 서명된 이모티콘 출시로 해석하지 않으며, 위 앱 파생 기준과 기존 앱 말풍선 스타일은 유지한다.

연재의 장면·연출·대사·앱 효용·모바일 읽힘은 [승인 v6](../design/jango/cartoon-series.json)와
[SNS 카툰 제작·검수 기준](../design/jango/reference/SNS-CARTOON-GUIDE.md)을 따른다.
v18 원본은 캐릭터 MASTER로 유지하며 v6의 특정 여성·주방·메뉴·줄거리를 모든 회차에 강제하지 않는다.
철회된 v1/v2 단순 콜라주는 신규 기본값으로 재사용하지 않는다.

아래 명령은 현재 등록된 v18 앱·브랜딩 파생을 재현한다. 새 포즈의 재작화를 실행하지 않으며 SNS 후보의 채택·출력 명령도 아니다.

```sh
pnpm --filter @expirymate/shared build
pnpm --filter @expirymate/mobile mascot:sync
pnpm --filter @expirymate/mobile mascot:build
pnpm --filter @expirymate/mobile mascot:measure
pnpm --filter @expirymate/mobile branding:sync
pnpm --filter @expirymate/mobile store:sync
pnpm --filter @expirymate/mobile mascot:audit
pnpm --filter @expirymate/mobile branding:audit
pnpm --filter @expirymate/mobile store:audit
```

브랜딩·스토어 명령에는 Pillow가 설치된 Python 환경이 필요하다. 관찰 좌표·입 측정·실루엣 검사는 자동 디자인 승인이 아니다. 얼굴 ROI는 비교용이며 정밀 도어 경계 실측으로 주장하지 않는다. 20번의 제작 당시 입 재검토는 앱 파생 이후에도 남긴다.

화면 크기와 배치는 디자인 시스템과 [반응형 QA](./mobile-responsive-qa.md)에 따라 조정하되 원화 비율·safe area·큰 글자 대응을 유지한다. 대표 화면과 밝고 어두운 배경에서 얼굴·모자·장갑·소품을 확인한다.
