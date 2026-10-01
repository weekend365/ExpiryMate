---
status: active
owner: design
last_reviewed: 2026-10-01
source_of_truth: true
---

# 장고 캐릭터 사용 가이드

[MASTER 32종](../design/jango/master-set.json), [BIBLE](../design/jango/reference/JANGO-CHARACTER-BIBLE.md), [스타일 가이드](../design/jango/reference/JANGO-STYLE-GUIDE.md)가 정본이다. 유일한 스타일은 v18 손그림 크레파스형이며 대표는 24번 완성!이다.

## 앱 사용

화면은 기존 `Mascot`와 `MascotSpeechBubble`을 사용한다. 직접 PNG import는 Mascot 내부로 제한한다. 기존 mood·size API는 유지한다.

- idle 24, happy 02, worry 17, cooking 23, empty 20, speak 01, think 11, point 14.
- 앱 기본·아이콘·스플래시·알림 실루엣은 24번에서 파생한다. 문구 없는 원화를 사용한다.
- 원화 전체 가시 영역을 비율 유지해 1024px 안에 배치하고, full/small 및 1x·2x·3x를 만든다. 고정 얼굴 크롭이나 얼굴 늘이기를 하지 않는다.
- 캐릭터 팔레트는 `characterColors`이며 UI semantic token을 대체하지 않는다.
- 배포는 별도 작업이다. 로컬 에셋 교체가 이미 설치된 앱이나 스토어 이미지를 자동 변경하지 않는다.

## 생성과 검사

[준비·검수](../design/jango/quality/README.md)를 따른다. 실제 참조와 파일 해시를 기록하고 MASTER의 이미지 바이트는 보존한다.

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

화면에서는 기존 크기·safe area·큰 글자·반응형 동작을 유지한다. 대표 화면과 밝고 어두운 배경에서 얼굴·모자·장갑·소품을 확인한다.
