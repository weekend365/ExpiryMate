"""Decode and inspect the episode-8 Reel; report measurements and review frames."""
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import hashlib
import io
import json
import math
import re
import subprocess

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
REVIEW = OUT / 'review/reel'
VIDEO = OUT / 'reel/jango-ep08-music.mp4'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FONT = ROOT / 'apps/mobile/assets/fonts/Pretendard-Regular.otf'
CUTS = [5, 10, 15, 21, 27, 33]
STATES = [0, 2.9, 5, 6.4, 7.8, 10, 12.7, 15, 16.7, 18.1,
          21, 24.8, 27, 31.1, 33, 35.6, 37.2, 39.9]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def db(value):
    return round(20 * math.log10(max(float(value), 1e-12)), 3)


def frame(t, size=(360, 640)):
    result = subprocess.run([FFMPEG, '-v', 'error', '-ss', f'{t:.9f}', '-i', str(VIDEO),
                             '-frames:v', '1', '-vf', f'scale={size[0]}:{size[1]}:flags=lanczos',
                             '-f', 'image2pipe', '-vcodec', 'png', '-'],
                            check=True, capture_output=True)
    return Image.open(io.BytesIO(result.stdout)).convert('RGB')


def sheet(items, path, columns=4):
    result = Image.new('RGB', (columns * 360, math.ceil(len(items) / columns) * 675), '#F8F3EA')
    draw = ImageDraw.Draw(result)
    font = ImageFont.truetype(str(FONT), 19)
    for i, (stamp, image) in enumerate(items):
        x, y = (i % columns) * 360, (i // columns) * 675
        result.paste(image, (x, y))
        draw.text((x + 10, y + 645), stamp, font=font, fill='#302E2C')
    result.save(path, quality=95, subsampling=0)


def ui_simulation(image):
    """Illustrative overlap only, explicitly not an Instagram screenshot."""
    overlay = Image.new('RGBA', image.size)
    draw = ImageDraw.Draw(overlay)
    font = ImageFont.truetype(str(FONT), 12)
    for y in range(485, 640):
        draw.line((0, y, 360, y), fill=(0, 0, 0, round((y - 485) * 0.85)))
    for y in [365, 410, 455, 500]:
        draw.ellipse((320, y, 344, y + 24), outline='white', width=2)
    draw.text((15, 550), 'jango_plz', font=font, fill='white')
    draw.text((15, 580), '장고랑 살아보니 08', font=font, fill='white')
    draw.text((15, 607), 'Monkeys Spinning Monkeys', font=font, fill='white')
    return Image.alpha_composite(image.convert('RGBA'), overlay).convert('RGB')


def main():
    before = json.loads((OUT / 'preservation-before.json').read_text())
    for row in before['files']:
        assert sha(ROOT / row['file']) == row['sha256'], row['file']
    prep = json.loads((OUT / 'reel/preparation.json').read_text())
    for row in prep['sources']:
        assert sha(ROOT / row['file']) == row['sha256'], row['file']
    caption = (OUT / 'caption.txt').read_text()
    credit = json.loads((ROOT / 'design/jango/audio/monkeys-spinning-monkeys/license.json').read_text())['requiredCredit']
    assert credit in caption
    assert '앱의 기능 화면이 아닙니다' in caption
    count, seconds = imageio_ffmpeg.count_frames_and_secs(str(VIDEO))
    assert count == 1200 and seconds == 40.0, (count, seconds)
    reader = imageio_ffmpeg.read_frames(str(VIDEO), pix_fmt='rgb24')
    metadata = next(reader)
    assert metadata['size'] == (1080, 1920) and metadata['fps'] == 30.0
    decoded = 0
    for pixels in reader:
        assert len(pixels) == 1080 * 1920 * 3
        decoded += 1
    assert decoded == 1200
    result = subprocess.run([FFMPEG, '-hide_banner', '-i', str(VIDEO),
                             '-vf', 'blackdetect=d=0.025:pix_th=0.08',
                             '-af', 'silencedetect=noise=-55dB:d=0.2',
                             '-f', 'null', '-'], check=True, capture_output=True, text=True)
    (REVIEW / 'decode.log').write_text(result.stderr)
    black = re.findall(r'black_start:[^\n]+', result.stderr)
    assert not black, black
    silence = re.findall(r'silence_(?:start|end):[^\n]+', result.stderr)
    pcm = subprocess.run([FFMPEG, '-v', 'error', '-i', str(VIDEO), '-vn',
                          '-ac', '2', '-ar', '48000', '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    audio = np.frombuffer(pcm, dtype='<f4').reshape(-1, 2)
    assert len(audio) >= 40 * 48000 and np.isfinite(audio).all()
    clipped = int((np.abs(audio) >= 1).sum())
    assert clipped == 0
    per_second = [db(np.sqrt(np.mean(audio[i*48000:(i+1)*48000] ** 2)))
                  for i in range(40)]
    assert all(level > -45 for level in per_second), per_second
    loud = subprocess.run([FFMPEG, '-hide_banner', '-i', str(VIDEO), '-vn',
                           '-af', 'loudnorm=I=-18:TP=-2:LRA=11:print_format=json',
                           '-f', 'null', '-'], check=True, capture_output=True, text=True)
    loudness = json.loads(re.findall(r'\{[\s\S]*?\}', loud.stderr)[-1])
    assert float(loudness['input_tp']) < -1.0, loudness
    sheet([(f'{t:.1f}초', frame(t)) for t in STATES], REVIEW / 'all-dialogue-states.jpg')
    for part in range(4):
        times = [part * 10 + j / 2 for j in range(20)]
        sheet([(f'{t:.1f}초', frame(t)) for t in times],
              REVIEW / f'timeline-{part+1}.jpg')
    endpoints = [0, 149/30, 5, 299/30, 10, 449/30, 15, 629/30,
                 21, 809/30, 27, 989/30, 33, 36.9, 37, 1199/30]
    sheet([(f'{t:.2f}초', frame(t)) for t in endpoints], REVIEW / 'cuts-and-zoom.jpg')
    sheet([(f'{t:.1f}초 · 예시', ui_simulation(frame(t))) for t in STATES],
          REVIEW / 'ui-overlap-simulation.jpg')
    for t in [0, 6.5, 16.8, 27.5, 37.2]:
        frame(t, (1080, 1920)).save(REVIEW / f'native-{t:.1f}.jpg', quality=95)
    report = {
        'checkedAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'technicalStatus': 'passed', 'fullVideoDecode': 'passed',
        'decodedFrames': decoded, 'seconds': seconds, 'metadata': metadata,
        'sceneCuts': CUTS, 'dialogueStateTimes': STATES,
        'closingBrandAndCTATimes': [37, 40],
        'blackFrameIntervals': black, 'detectedSilence': silence,
        'audioDecodedSeconds': len(audio) / 48000,
        'audioChannelsMeasured': 'stereo',
        'audioPeakDbfs': db(np.max(np.abs(audio))), 'clippedSamples': clipped,
        'audioRmsPerSecondDbfs': per_second, 'loudness': loudness,
        'audioMaximumAdjacentSampleChange': float(np.max(np.abs(np.diff(audio, axis=0)))),
        'protectedFilesPreserved': len(before['files']),
        'productionInputsPreserved': len(prep['sources']),
        'captionIncludesMusicCredit': True,
        'captionDisclosesFictionalAIChat': True,
        'humanListening': 'not performed: assistant has no audio perception tool',
        'realTimePlaybackClaim': False,
        'instagramOverlap': 'Illustrative simulation only; live Reel playback and UI to be checked after publication.',
        'videoSha256': sha(VIDEO), 'coverSha256': sha(OUT / 'cover.jpg'),
    }
    (REVIEW / 'technical-quality.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['technicalStatus', 'decodedFrames', 'seconds',
                      'audioPeakDbfs', 'clippedSamples', 'blackFrameIntervals',
                      'protectedFilesPreserved']}, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
