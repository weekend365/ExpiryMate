# 장고야 부탁해 마케팅 최종본과 제작 입력

2026-09-21 정리 기준입니다. 최종 배포본과 재편집에 필요한 입력을 보존합니다.
파일별 보존·삭제 이유, 변경 전 SHA-256과 검증 결과는
[cleanup-manifest.json](cleanup-manifest.json)에 기록합니다. manifest의 파일 경로는
`output/marketing` 기준이며, `retained_counterparts`는 관련 보존 파일을 뜻합니다.
ZIP 검증 항목 외에는 삭제 파일과 바이트가 동일한 사본이라는 뜻이 아닙니다.

## 최종 배포본

- 앱 소개 영상: [v6 · 9:16 · 음성+음악](app-walkthrough-reel-v6-instagram916/jango-walkthrough-carefree-9x16.mp4)
- 15초 광고: [자막 v2 영상](final-ad-subtitled-v2/jango-ad-15s-subtitled-smooth.mp4),
  [SRT 자막](final-ad-subtitled-v2/jango-ad-15s-subtitled-smooth.srt)
- 엔드카드: [v2 이미지](endcard-v2/jango-endcard-app-screenshot.png),
  [3초 영상](endcard-v2/jango-endcard-app-screenshot-3s.mp4)
- [소개 카드뉴스 5장과 업로드 순서](jango-intro-carousel-v1/README.txt)
- [2026-09-19 확인한 App Store 게시 이미지 6장](app-store-published-2026-09-19/README.txt)
- [티스토리 원고·이미지·태그 패키지](tistory-jango-intro/README.txt)

카드뉴스와 티스토리는 독립적으로 사용할 수 있도록 필요한 이미지 사본을 유지합니다.
이번 정리에서 보존한 이미지·영상·음성의 내용과 경로는 변경하지 않았습니다.

## 제작 입력과 보존 이유

- **v6 앱 소개 영상:** v3 `jango-walkthrough-reel.mp4`가 영상 입력입니다.
  v5 `jango-narration.wav`와 `narration-cues.json`, v6 `music/Carefree.wav`가
  음성·배경음 합성 입력입니다. v5 원음 `voice/delicate-full.mp3`·WAV,
  음악 MP3와 출처, 각 제작 스크립트·설정도 보존합니다.
- **자막 광고 v2:** `final-ad-v1/jango-ad-15s.mp4`를 무자막 입력으로 유지합니다.
  `final-ad-subtitled-v2/render-preserving-frames.swift`가 자막을 합성합니다.
- **엔드카드 v2:** v1 `jango-endcard.png`는 이미지 편집의 원본입니다.
  v2 `app-screenshot-source.png`와 이미지 프롬프트, v1의 범용
  `render-video.swift`를 함께 보존합니다.
- **광고 레퍼런스:** `forgotten-tofu-12s`와 `tofu-mushroom-hotpot-12s-v2`를 유지합니다.
  새 전골 이미지 제작에도 이전 스토리보드가 참조되므로 구버전이라는 이유로 삭제하지 않습니다.
- **원본 추출 이미지:** v1의 `source-review`, `cut-review`, `inspect-recording.swift`를
  보존합니다. v3의 제작·검수 파일과 복구된 스토어 제작 이미지
  `recovered-app-store-screenshots`도 유지합니다.

최초 녹화 `ScreenRecording_09-17-2026 10-52-50_1.mov`는 기록된 Downloads 경로에
없습니다. v3에서 시작하는 v6 재제작 경로는 유지되지만, 최초 녹화의 HDR 색상·60fps 움직임이나
원본 녹화부터의 전체 편집을 복구할 수 있다고 보장하지 않습니다.

## 이번 정리 내역

총 **158개 파일, 186,958,343바이트(178.30MiB)**를 삭제했습니다.

- 앱 소개 v2·v4, 과거 화질 검토, 자막 광고 v1 폴더.
- v1의 이전 배포본·편집·검수 산출물. 위에 명시한 원본 추출 이미지와 추출 도구는 유지.
- v5 이전 완성 MP4와 미선택 `normal-sample.mp3`, 엔드카드 v1 MP4.
- 명시된 임시 `.sb-*` 파일 4개와 스토어·티스토리 ZIP 2개.
  ZIP은 각각 보존 폴더의 8개 파일과 SHA-256이 동일함을 확인한 뒤 삭제.

manifest에 기록한 214개 보존 파일은 변경 전후 SHA-256이 동일함을 확인했습니다.
이 안내 문서는 갱신 대상으로 별도 기록합니다. 앱 에셋과 소스코드, Git 이력은 정리 대상이 아닙니다.

보존된 검증 JSON·음성 출처 JSON의 파일명·절대 경로는 **과거 제작 기록**입니다.
삭제한 v5 배포본, 미선택 음성 샘플, 이미 정리된 검수 프레임을 가리킬 수 있으며,
현재 존재하는 파일 목록이나 이번 재렌더 검증 결과로 해석하지 않습니다.
현재 보존·삭제 상태는 cleanup manifest를 기준으로 확인합니다.

## 정리 후 검증

- 보존 파일 214개의 SHA-256 일치, 삭제 파일 158개의 부재, 배포본과 제작 입력의 존재를 확인했습니다.
- 스토어 이미지 6장과 음악 원본의 해시는 기존 출처 JSON 기록과도 일치합니다.
- 앱 코드·제작 스크립트·활성 안내에서 삭제 파일을 필수 입력으로 참조하지 않는지 확인했습니다.
- `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `git diff --check`가 통과했습니다.
  테스트는 shared 139개·API 484개·모바일 500개, 총 1,123개입니다.
- 영상 재렌더·외부 게시·커밋·Git 이력 변경은 실행하지 않았습니다.

## 작업용 복사본에서 재제작

macOS Swift·AVFoundation·AppKit과 동의된 Xcode 라이선스가 필요합니다.
음악 믹싱에는 Python 3와 NumPy가 필요합니다. 인코더·OS 버전 차이로
새 출력의 바이트가 보존 최종본과 같지 않을 수 있습니다.
아래 절차는 보존한 제작 입력을 연결하는 안내이며 이번 정리에서 영상을 재렌더하지 않았습니다.

저장소 루트에서 먼저 작업용 복사본을 만듭니다. 이후 모든 출력은 복사본에 생성합니다.

```bash
marketing_repo="$PWD"
walkthrough_tmp="$(mktemp -d "${TMPDIR:-/tmp}/jango-marketing.XXXXXX")"
cp -R output/marketing "$walkthrough_tmp/marketing"
walkthrough_work="$walkthrough_tmp/marketing"
```

### v6 앱 소개 영상

복사본의 기존 배포 영상과 인코딩 음성을 이동해 스크립트의 덮어쓰기 방지 조건을 지킵니다.
`video-9x16.mp4`는 보존 필수 입력이 아닌 재생성 출력입니다.

```bash
walkthrough_v6="$walkthrough_work/app-walkthrough-reel-v6-instagram916"
mkdir -p "$walkthrough_v6/previous-output"
mv "$walkthrough_v6/jango-walkthrough-carefree-9x16.mp4" "$walkthrough_v6/previous-output/"
mv "$walkthrough_v6/jango-carefree-mix.m4a" "$walkthrough_v6/previous-output/"
if [ -f "$walkthrough_v6/video-9x16.mp4" ]; then
  mv "$walkthrough_v6/video-9x16.mp4" "$walkthrough_v6/previous-output/"
fi
swift "$walkthrough_v6/render916.swift" "$walkthrough_v6"
python3 "$walkthrough_v6/mix-audio.py"
swift "$walkthrough_v6/mux-final.swift" "$walkthrough_v6"
swift "$walkthrough_v6/verify-layout.swift" "$walkthrough_v6"
```

순서는 v3 영상 → 9:16 영상, v5 음성+음악 → 믹스 WAV, 영상+음성 → 최종 MP4입니다.
검증 JSON과 `expected`·`final-review` 프레임도 작업용 복사본에 생성됩니다.

### 15초 자막 광고 v2

보존한 무자막 광고와 실제 폰트 파일을 사용해 새 출력 폴더에 생성합니다.
SRT 자막은 배포본 옆에 별도로 보존되어 있습니다.

```bash
mkdir -p "$walkthrough_work/rebuilt-ad"
swift "$walkthrough_work/final-ad-subtitled-v2/render-preserving-frames.swift" \
  "$walkthrough_work/final-ad-v1/jango-ad-15s.mp4" \
  "$walkthrough_work/rebuilt-ad/jango-ad-15s-subtitled-smooth.mp4" \
  "$marketing_repo/apps/mobile/assets/fonts/Pretendard-Bold.otf"
```

### 엔드카드 v2 영상

v1 폴더의 스크립트는 입력 이미지·출력 경로를 인자로 받는 범용 도구이므로 유지합니다.

```bash
swift "$walkthrough_work/endcard-v1/render-video.swift" \
  "$walkthrough_work/endcard-v2/jango-endcard-app-screenshot.png" \
  "$walkthrough_work/endcard-v2/jango-endcard-app-screenshot-rebuilt.mp4"
```

## 음악 출처

v6 음악은 Kevin MacLeod의 “Carefree”입니다. 게시 시
[music-credit.txt](app-walkthrough-reel-v6-instagram916/music-credit.txt)의
저작자·출처·라이선스·편집 안내를 함께 사용합니다.
원본 MP3의 출처와 SHA-256은
[music/source.json](app-walkthrough-reel-v6-instagram916/music/source.json)에 보존합니다.
