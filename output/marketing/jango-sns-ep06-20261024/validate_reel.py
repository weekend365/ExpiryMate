"""Full decode, audio measurements, preservation checks and visual-review sheets.

This does not claim human listening or live Instagram playback.
"""
from pathlib import Path
from datetime import datetime
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
VIDEO = OUT / 'reel/jango-ep06-music.mp4'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FONT = ROOT / 'apps/mobile/assets/fonts/Pretendard-Regular.otf'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def db(value):
    return round(20 * math.log10(max(float(value), 1e-12)), 3)


def frame(t, size=(360, 640)):
    result = subprocess.run([FFMPEG, '-v', 'error', '-ss', f'{t:.9f}', '-i', str(VIDEO),
                             '-frames:v', '1', '-vf', f'scale={size[0]}:{size[1]}:flags=lanczos',
                             '-f', 'image2pipe', '-vcodec', 'png', '-'], check=True, capture_output=True)
    return Image.open(io.BytesIO(result.stdout)).convert('RGB')


def ui_simulation(im):
    """Conservative illustrative controls, explicitly not a platform screenshot."""
    overlay = Image.new('RGBA', im.size)
    draw = ImageDraw.Draw(overlay)
    small, label = ImageFont.truetype(str(FONT), 11), ImageFont.truetype(str(FONT), 14)
    for y in range(480, 640):
        draw.line((0, y, 360, y), fill=(0, 0, 0, round((y - 480) * .85)))
    draw.text((15, 25), '릴스 · UI 겹침 시뮬레이션', font=small, fill='white',
              stroke_width=1, stroke_fill='#302E2C')
    for y in [365, 410, 455, 500]:
        draw.ellipse((321, y, 344, y + 23), outline='white', width=2)
        draw.text((321, y + 25), '···', font=small, fill='white')
    draw.text((16, 549), 'jango_plz', font=label, fill='white')
    draw.text((16, 580), '안 나온다며?  🍊', font=small, fill='white')
    draw.text((16, 607), 'Monkeys Spinning Monkeys', font=small, fill='white')
    return Image.alpha_composite(im.convert('RGBA'), overlay).convert('RGB')


def sheet(items, path, columns=5):
    rows = math.ceil(len(items) / columns)
    result = Image.new('RGB', (columns * 360, rows * 670), '#F8F3EA')
    draw, font = ImageDraw.Draw(result), ImageFont.truetype(str(FONT), 17)
    for i, (stamp, im) in enumerate(items):
        x, y = (i % columns) * 360, (i // columns) * 670
        result.paste(im, (x, y))
        draw.text((x + 12, y + 645), stamp, font=font, fill='#302E2C')
    result.save(path, quality=95, subsampling=0)


def preservation():
    before = json.loads((OUT / 'reel/preservation-before-render.json').read_text())
    mutable = {'episode.json', 'selected-artwork.json', 'file-hashes.json', 'build_review.cjs'}
    for row in before['episodeFiles']:
        path = OUT / 'reel' / f'before-{row["file"]}' if row['file'] in mutable else OUT / row['file']
        if row['file'] == 'build_review.cjs':
            path = path.with_suffix('.cjs.txt')
        assert sha(path) == row['sha256'], str(path)
    for row in before['protectedFiles']:
        assert sha(ROOT / row['file']) == row['sha256'], row['file']
    prep = json.loads((OUT / 'reel/preparation.json').read_text())
    for row in prep['sources']:
        assert sha(ROOT / row['file']) == row['sha256'], row['file']
    assert sha(ROOT / prep['guide']['file']) == prep['guide']['sha256']
    return before, prep


def main():
    before, prep = preservation()
    count, seconds = imageio_ffmpeg.count_frames_and_secs(str(VIDEO))
    assert count == 600 and seconds == 20.0, (count, seconds)
    reader = imageio_ffmpeg.read_frames(str(VIDEO), pix_fmt='rgb24')
    metadata = next(reader)
    assert metadata['size'] == (1080, 1920) and metadata['fps'] == 30.0
    decoded = 0
    for pixels in reader:
        assert len(pixels) == 1080 * 1920 * 3
        decoded += 1
    assert decoded == 600
    result = subprocess.run([FFMPEG, '-hide_banner', '-i', str(VIDEO), '-vf',
                             'blackdetect=d=0.025:pix_th=0.08', '-af',
                             'silencedetect=noise=-55dB:d=0.2', '-f', 'null', '-'],
                            check=True, capture_output=True, text=True)
    (REVIEW / 'decode.log').write_text(result.stderr)
    black = re.findall(r'black_start:[^\n]+', result.stderr)
    silence = re.findall(r'silence_(?:start|end):[^\n]+', result.stderr)
    assert not black, black
    pcm = subprocess.run([FFMPEG, '-v', 'error', '-i', str(VIDEO), '-vn', '-ac', '2',
                          '-ar', '48000', '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    audio = np.frombuffer(pcm, dtype='<f4').reshape(-1, 2)
    assert len(audio) >= 20 * 48000 and np.isfinite(audio).all()
    clipped = int((np.abs(audio) >= 1).sum())
    assert clipped == 0
    loud = subprocess.run([FFMPEG, '-hide_banner', '-i', str(VIDEO), '-vn', '-af',
                           'loudnorm=I=-18:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'],
                          check=True, capture_output=True, text=True)
    loudness = json.loads(re.findall(r'\{[\s\S]*?\}', loud.stderr)[-1])
    assert float(loudness['input_tp']) < -1.0, loudness
    per_second = [db(np.sqrt(np.mean(audio[i*48000:(i+1)*48000]**2))) for i in range(20)]
    assert all(level > -45 for level in per_second), per_second
    # Every half second plus exact before/after each cut and zoom endpoints.
    for part in range(4):
        times = [part * 5 + j / 2 for j in range(10)]
        sheet([(f'{t:.1f}초', frame(t)) for t in times], REVIEW / f'timeline-{part+1}.jpg')
    endpoints = [0, 1, 59/30, 2, 4, 179/30, 6, 8, 299/30, 10,
                 359/30, 12, 14, 479/30, 16, 18, 599/30]
    for part in range(2):
        times = endpoints[part*10:(part+1)*10]
        sheet([(f'{t:.2f}초', frame(t)) for t in times], REVIEW / f'cuts-and-zoom-{part+1}.jpg')
    overlap_times = [59/30, 179/30, 299/30, 359/30, 479/30, 599/30]
    sheet([(f'{t:.2f}초 · 시뮬레이션', ui_simulation(frame(t))) for t in overlap_times],
          REVIEW / 'ui-overlap-sheet.jpg', columns=3)
    for t in [0, 2, 6, 10, 12, 16]:
        frame(t, (1080, 1920)).save(REVIEW / f'native-{t:02d}.jpg', quality=96)
    report = {
        'checkedAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'technicalStatus': 'passed', 'fullVideoDecode': 'passed',
        'decodedFrames': decoded, 'seconds': seconds, 'metadata': metadata,
        'sceneCuts': [2, 6, 10, 16], 'dialogueChange': 12,
        'closingQuestionAndBrandSeconds': [16, 20], 'blackFrameIntervals': black,
        'audioDecodedSeconds': len(audio) / 48000, 'audioChannelsMeasured': 'stereo',
        'audioPeakDbfs': db(np.max(np.abs(audio))), 'clippedSamples': clipped,
        'audioRmsPerSecondDbfs': per_second, 'loudness': loudness, 'detectedSilence': silence,
        'audioMaximumAdjacentSampleChange': float(np.max(np.abs(np.diff(audio, axis=0)))),
        'narration': False, 'musicSource': 'design/jango/audio/monkeys-spinning-monkeys/Monkeys Spinning Monkeys.mp3',
        'episodeFilesPreserved': len(before['episodeFiles']),
        'masterAndPriorEpisodeFilesPreserved': len(before['protectedFiles']),
        'productionInputHashesPreserved': len(prep['sources']),
        'humanListening': 'not performed: assistant has no audio perception tool',
        'realTimePlaybackClaim': False,
        'visualReviewEvidence': '40 half-second frames, every cut boundary and shot start/mid/end, six native frames and UI simulation; visual observations recorded separately.',
        'instagramOverlay': 'Illustrative overlay only. Live upload/profile verification requires a later authorized publication step.',
        'videoSha256': sha(VIDEO), 'coverSha256': sha(OUT / 'cover.jpg'),
    }
    write(REVIEW / 'technical-quality.json', report)
    print(json.dumps({k: report[k] for k in ['technicalStatus', 'decodedFrames', 'seconds',
          'audioPeakDbfs', 'clippedSamples', 'blackFrameIntervals', 'masterAndPriorEpisodeFilesPreserved']}, indent=2))


if __name__ == '__main__':
    main()
