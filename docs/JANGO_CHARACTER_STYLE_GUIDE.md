---
status: active
owner: design
last_reviewed: 2026-10-14
source_of_truth: true
---

# 장고 캐릭터 사용 가이드

[v19 활성 MASTER](../design/jango/style-master.json), [BIBLE](../design/jango/reference/JANGO-CHARACTER-BIBLE.md), [스타일 가이드](../design/jango/reference/JANGO-STYLE-GUIDE.md)가 신규 제작 정본이다. 2026-10-09 승인된 갈색 연필 선·따뜻한 채색·차분한 민트·부드러운 명암·종이 질감을 앱·브랜딩·이모티콘·SNS·마케팅·영상에 공통 적용한다. [채택 기록과 마이그레이션 범위](../design/jango/reference/STYLE-MASTER-ADOPTION.md)를 확인한다.

[v18 32종](../design/jango/master-set.json)은 역사적 원본·포즈·구조 참고로 바이트를 보존한다. 장면 속 여성·배경·두부·대사는 필수 요소가 아니다. 기존 앱 에셋은 아직 v18 파생이며 이번 규칙 변경으로 이미 재작화됐다고 표시하지 않는다.

## 앱 사용

화면의 시각 표현·사용자 흐름·장고 반응은 [디자인 시스템](./design-system.md)이 정본이다.
작업 전에 변경 범위·보존 기준을 확인한다. 손그림 스타일은 캐릭터·배경 이미지에만 적용하며 카드·말풍선·버튼·제목·기능 아이콘·UI 글꼴로 확장하지 않는다. 기존 화면 구도·흐름을 유지하며 캐릭터 그림체 변경을 앱 구조 변경의 근거로 사용하지 않는다. 캐릭터 외형·제작은 위 MASTER·BIBLE·스타일 가이드를 따른다.

화면은 기존 `Mascot`와 `MascotSpeechBubble`을 사용한다. 직접 PNG import는 Mascot 내부로 제한한다. 기존 mood·size API는 유지한다. `JangoCompanion` 등을 포함한 이전 전체 개편은 철회했으며 자동 도입하지 않는다.

- 현재 v18 runtime 매핑: idle 24, happy 02, worry 17, cooking 23, empty 20, speak 01, think 11, point 14.
- 현행 앱 기본·아이콘·스플래시·알림 실루엣은 v18 24번에서 파생한다. 새 연필 스타일 투명 원화의 제작·검토·채택·매핑 변경은 별도 작업이다. 문구 없는 원화를 사용한다.
- 원화 전체 가시 영역을 비율 유지해 1024px 안에 배치하고, full/small 및 1x·2x·3x를 만든다. 고정 얼굴 크롭이나 얼굴 늘이기를 하지 않는다.
- 현재 runtime의 캐릭터 팔레트는 `characterColors`다. 새 스타일의 색은 승인 이미지로 검토하며 이번 변경에서 공유 토큰이나 UI semantic token을 바꾸지 않는다.
- 앱 UI는 Pretendard를 유지한다. 캐릭터·SNS·이모티콘 이미지의 레터링 기준을 UI 글꼴에 적용하지 않는다.
- 주 장고 안내는 화면당 하나다. 주요 작업의 성공 반응·중복 방지·맥락 전환·접근성은 디자인 시스템의 상호작용 규칙을 따른다.
- 배포는 별도 작업이다. 로컬 에셋 교체가 이미 설치된 앱이나 스토어 이미지를 자동 변경하지 않는다.

## 생성과 검사

[준비·검수](../design/jango/quality/README.md)를 따른다. 실제 참조와 파일 해시를 기록하고 MASTER의 이미지 바이트는 보존한다.

SNS 카툰은 BIBLE의 「SNS 카툰의 표현 확장」을 따른다. 표정·입·포즈·소품·의상·비율 과장·좌우 반전·색 변형은 별도 후보로 검토·보정하고 사용자가 채택한 범위에서 재사용한다. 기본 입 네 모드는 SNS 표현의 절대 상한이 아니다. SNS 채택을 앱 에셋 교체나 서명된 이모티콘 출시로 해석하지 않으며, 위 앱 파생 기준과 기존 앱 말풍선 스타일은 유지한다.

연재의 장면·연출·대사·앱 효용·모바일 읽힘은 [승인 v6](../design/jango/cartoon-series.json)와
[SNS 카툰 제작·검수 기준](../design/jango/reference/SNS-CARTOON-GUIDE.md)을 따른다.
v19는 캐릭터 정본으로 유지하며 v6의 특정 여성·주방·메뉴·줄거리를 모든 회차에 강제하지 않는다.
철회된 v1/v2 단순 콜라주는 신규 기본값으로 재사용하지 않는다.

아래 명령은 현재 등록된 v18 앱·브랜딩 파생을 재현한다. 최신 스타일의 재작화를 실행하지 않으며 SNS 후보의 채택·출력 명령도 아니다.

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
