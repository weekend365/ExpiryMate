# 장고 이모티콘 최종 32종 · v24

2026-10-20 사용자가 선택한 디자인을 한 폴더로 정리했습니다. v22의 31종과 v23의 새 29번 **지쳤어...**이며, 원화·문구·폰트·크기·배치·완성 PNG는 선택본과 바이트 단위로 같습니다. 새 이미지 생성은 없습니다.

- [전체 갤러리](index.html) · [전체 미리보기](review/preview-light.png) · [어두운 미리보기](review/preview-dark.png)
- [stickers](stickers): 문구 포함 360×360 투명 PNG 32장, 01–32 번호순
- [source-originals](source-originals): 선택된 원화 32장, 01-r1–32-r1 번호순
- [artwork-360](artwork-360): 완성 PNG와 같은 배치의 문구 없는 360px 이미지 32장
- [review](review): 밝고 어두운 80·120·360px 비교, 얼굴·입 진단, [29번 전후 비교](review/29-before-after.png)
- [artwork](artwork) · [lettering](lettering) · [lettering-calibration](lettering-calibration) · [fonts](fonts): 조립·검사·조판 재현에 필요한 작업 자산
- [collection.json](collection.json): 32종 선택 출처·원본 및 레이어 해시·전체 파일 목록
- [manifest.json](manifest.json) · [derivation-records](derivation-records): 컷별 출력·생성 없는 재사용 계보
- [inspection-status.json](inspection-status.json) · [visual-review.json](visual-review.json): 자동 검사와 이전 관찰 기록

v18 MASTER는 원래 경로에 보존합니다. v20~v23의 중복 원화는 v18·v24의 동일 바이트 보존본으로 연결하고 제작 기록은 [history](../history/README.md)로 옮겼습니다. 고유한 이전 시안은 삭제 사실과 해시만 남깁니다. v24의 그림·문구·폰트·배치 바이트는 유지했습니다. 이력 처리·문서 변경으로 현재 준비는 `stale`이며 원래 준비 기록과 기존 AI 제작 계보·입 재검토 상태를 보존합니다. 제출용 출력은 기존 jango:promote·jango:export 절차를 따릅니다.

정리본 검증: `pnpm jango:final:check`. 이 폴더의 완성 PNG를 직접 덮어쓰지 않습니다.
