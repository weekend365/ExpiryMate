# 장고야 부탁해 앱 소개 영상 제작물

## 보존 범위

각 버전의 완성 영상과 엔드카드, 편집 설정, 자막, 음성 원본·편집본,
제작·검증 스크립트, 검증 JSON을 함께 보존합니다.

- v1~v3: `app-walkthrough-reel-v*/jango-walkthrough-reel.mp4`
- v4: `app-walkthrough-reel-v4-narrated/jango-walkthrough-narrated.mp4`
- v5: `app-walkthrough-reel-v5-natural-voice/jango-walkthrough-delicate.mp4`
- v6: `app-walkthrough-reel-v6-instagram916/jango-walkthrough-carefree-9x16.mp4`
- 화질 검토 기록: [quality-review.md](app-walkthrough-quality-review/quality-review.md)
- v6 음악 출처 표시: [music-credit.txt](app-walkthrough-reel-v6-instagram916/music-credit.txt)

원본 화면 녹화 `ScreenRecording_09-17-2026 10-52-50_1.mov`는 정리 당시
기록된 Downloads 경로에 없었습니다. 원본에서 추출한 `source-review`,
`cut-review`, `layout-preview`, `render-review`는 다시 만들 수 있다고
가정하지 않고 보존합니다. v1~v3 전체 편집을 재실행하려면 원본 녹화가 필요합니다.
완성 영상만으로 원본 HDR 색상이나 60fps 움직임을 복구할 수는 없습니다.

## 정리한 파일

- `encoded-frames`, `final-review`, v6 `expected`의 PNG 91개:
  보존 영상이나 v3 완성본에서 재생성할 수 있습니다. 검증 JSON은 남겼습니다.
- v4 `voice/01-hook.wav`부터 `09-cta.wav`까지 9개:
  각 AIFF를 48kHz·16비트·모노 PCM으로 변환한 데이터와 동일함을 확인했습니다.
  AIFF, 문장별 TXT, `*-trimmed.wav` 및 합성 음성은 보존합니다.
- v6 `video-9x16.mp4`: 음성 합성 전 중간 영상입니다. 압축 영상 샘플 980개가
  최종 영상과 동일함을 확인했습니다. `render916.swift`와 v3 완성본으로 다시 만듭니다.

보존한 v5 `voice/delicate-full.wav`와 v6 `music/Carefree.wav`는 후속 편집의
입력입니다. 파일 확장자만 보고 다른 음성의 중복으로 취급하지 않습니다.

## 재생성 준비

macOS의 Swift·AVFoundation·AppKit, Xcode 라이선스 동의, `afconvert`가 필요합니다.
아래 Python 이미지 명령에는 Pillow가 필요합니다. 기존 스크립트는 검증 JSON도
작성하므로, 저장소 루트에서 작업용 복사본을 만든 뒤 아래 명령을 순서대로 실행합니다.

```bash
walkthrough_tmp="$(mktemp -d "${TMPDIR:-/tmp}/jango-walkthrough.XXXXXX")"
cp -R output/marketing "$walkthrough_tmp/marketing"
walkthrough_work="$walkthrough_tmp/marketing"
```

기존 JSON의 절대 경로는 제작 당시 기록입니다. 다른 위치의 체크아웃에서는
원본 기록을 수정하지 말고 작업용 복사본의 경로나 재생성 결과를 사용합니다.

### 1. v4 변환 WAV

기존 AIFF에서 변환하므로 음성을 다시 합성할 필요가 없습니다.

```bash
for walkthrough_aiff in "$walkthrough_work/app-walkthrough-reel-v4-narrated/voice/"*.aiff; do
  afconvert -f WAVE -d LEI16@48000 -c 1 \
    "$walkthrough_aiff" "${walkthrough_aiff%.aiff}.wav"
done
```

### 2. v1~v3 완성 영상 캡처

남겨 둔 `final-review/metadata.json`의 시각 목록으로 프레임과 모아보기 이미지를 만듭니다.

```bash
python3 - "$walkthrough_work" <<'PY'
import json
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1])
for version in (1, 2, 3):
    folder = root / f'app-walkthrough-reel-v{version}'
    metadata = json.loads((folder / 'final-review/metadata.json').read_text())
    times = ','.join(str(value) for value in metadata['sample_times'])
    subprocess.run([
        'swift', str(folder / 'inspect-recording.swift'),
        str(folder / 'jango-walkthrough-reel.mp4'),
        str(folder / 'final-review'), '5', times,
    ], check=True)
PY
```

### 3. 화질 비교용 디코딩 프레임

v4 완성 영상과 보존한 v3 `render-review`를 사용합니다. 원본 녹화가 없으면
스크립트의 원본 트랙 정보는 건너뛰지만, 완성 영상의 비교용 프레임은 추출할 수 있습니다.
`sample-pairs.json`도 작업용 복사본의 경로로 갱신됩니다.

```bash
swift "$walkthrough_work/app-walkthrough-quality-review/extract-audit.swift" \
  "$walkthrough_work/app-walkthrough-quality-review"
```

### 4. v6 중간 영상과 검토 이미지

첫 명령은 보존한 v3 영상에서 `video-9x16.mp4`와 `expected` 이미지를 만듭니다.
두 번째 명령은 보존한 v6 완성본을 검사하고 `final-review` 프레임을 만듭니다.
인코더·OS 버전에 따라 재생성한 파일의 바이트는 기존 파일과 달라질 수 있습니다.

```bash
swift "$walkthrough_work/app-walkthrough-reel-v6-instagram916/render916.swift" \
  "$walkthrough_work/app-walkthrough-reel-v6-instagram916"
swift "$walkthrough_work/app-walkthrough-reel-v6-instagram916/verify-layout.swift" \
  "$walkthrough_work/app-walkthrough-reel-v6-instagram916"
python3 - "$walkthrough_work" <<'PY'
import sys
from pathlib import Path
from PIL import Image

folder = Path(sys.argv[1]) / 'app-walkthrough-reel-v6-instagram916/final-review'
sheet = Image.new('RGB', (1080, 1920), '#fffcf5')
for index, path in enumerate(sorted(folder.glob('frame-*.png'))):
    with Image.open(path) as frame:
        preview = frame.convert('RGB')
        preview.thumbnail((360, 640))
        sheet.paste(preview, ((index % 3) * 360, (index // 3) * 640))
sheet.save(folder / 'contact-sheet.png')
PY
```

모아보기 이미지는 검토용으로 새로 구성합니다. 기존 완성 영상이나 검증 기록을
덮어쓰지 않고 작업용 복사본에서 결과를 확인하세요.

## 음악 출처

v6의 음악은 Kevin MacLeod의 “Carefree”입니다. 게시할 때 보존한
`music-credit.txt`의 저작자·출처·라이선스·편집 안내를 함께 사용합니다.
원본 MP3의 출처와 SHA-256은 `music/source.json`에 기록되어 있습니다.
