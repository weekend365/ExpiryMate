"""Decode episode 9, measure its intentional audio pause, and save review frames."""
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

from build_reel import DURATIONS, CUTS, STATES, COPY, sheet

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
REVIEW = OUT / 'review/reel'
VIDEO = OUT / 'reel/jango-ep09-music.mp4'
PROXY = REVIEW / 'jango-ep09-360.mp4'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FONT = ROOT / 'apps/mobile/assets/fonts/Pretendard-Regular.otf'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def db(value):
    return round(20 * math.log10(max(float(value), 1e-12)), 3)


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def native_frame(t):
    result = subprocess.run([FFMPEG, '-v', 'error', '-ss', str(t), '-i', str(VIDEO),
                             '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
                            check=True, capture_output=True)
    return Image.open(io.BytesIO(result.stdout)).convert('RGB')


def ui_simulation(image):
    """Mobile control/caption stress test, not an actual Instagram screenshot."""
    overlay = Image.new('RGBA', image.size)
    draw = ImageDraw.Draw(overlay)
    font = ImageFont.truetype(str(FONT), 12)
    for y in range(480, 640):
        draw.line((0, y, 360, y), fill=(0, 0, 0, round((y - 480) * .85)))
    for y in [360, 405, 450, 495]:
        draw.ellipse((320, y, 344, y + 24), outline='white', width=2)
    draw.text((15, 550), 'jango_plz', font=font, fill='white')
    draw.text((15, 580), '장고랑 살아보니 09', font=font, fill='white')
    draw.text((15, 607), 'Investigations · Kevin MacLeod', font=font, fill='white')
    return Image.alpha_composite(image.convert('RGBA'), overlay).convert('RGB')


def main():
    before = json.loads((OUT / 'reel/preservation-before.json').read_text())
    for rel, digest in before['files'].items():
        assert sha(ROOT / rel) == digest, rel
    prep = json.loads((OUT / 'reel/preparation.json').read_text())
    for row in prep['sources']:
        assert sha(ROOT / row['file']) == row['sha256'], row['file']
    caption = (OUT / 'caption.txt').read_text()
    license_record = json.loads((OUT / 'music/license.json').read_text())
    assert license_record['requiredCredit'] in caption
    assert 'AI 작화를 사용한 카툰' in caption
    assert '영상 설명:' in caption

    episode = json.loads((OUT / 'episode.json').read_text())
    for scene in episode['storyboard']:
        n = scene['number']
        actual = [COPY[key][1].replace('\n', ' ') for _, key in STATES[n] if key != '07end']
        expected = [item['text'] for item in scene['dialogue']]
        assert actual == expected, (n, actual, expected)

    count, seconds = imageio_ffmpeg.count_frames_and_secs(str(VIDEO))
    assert count == 1110 and seconds == 37.0, (count, seconds)
    reader = imageio_ffmpeg.read_frames(str(VIDEO), pix_fmt='rgb24')
    metadata = next(reader)
    assert metadata['size'] == (1080, 1920) and metadata['fps'] == 30.0
    decoded = 0
    for pixels in reader:
        assert len(pixels) == 1080 * 1920 * 3
        decoded += 1
    assert decoded == 1110
    result = subprocess.run([FFMPEG, '-hide_banner', '-i', str(VIDEO),
                             '-vf', 'blackdetect=d=0.025:pix_th=0.08',
                             '-af', 'silencedetect=noise=-55dB:d=0.15',
                             '-f', 'null', '-'], check=True, capture_output=True, text=True)
    (REVIEW / 'decode.log').write_text(result.stderr)
    black = re.findall(r'black_start:[^\n]+', result.stderr)
    assert not black, black
    silence = re.findall(r'silence_(?:start|end):[^\n]+', result.stderr)
    pcm = subprocess.run([FFMPEG, '-v', 'error', '-i', str(VIDEO), '-vn',
                          '-ac', '2', '-ar', '48000', '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    audio = np.frombuffer(pcm, dtype='<f4').reshape(-1, 2)
    assert 37 * 48000 <= len(audio) <= 37.03 * 48000 and np.isfinite(audio).all()
    clipped = int((np.abs(audio) >= 1).sum())
    assert clipped == 0
    per_second = [db(np.sqrt(np.mean(audio[i*48000:(i+1)*48000] ** 2))) for i in range(37)]
    assert all(level > -48 for i, level in enumerate(per_second) if i != 19), per_second
    pause = audio[round(19.1*48000):round(19.6*48000)]
    pause_db = db(np.sqrt(np.mean(pause ** 2)))
    assert pause_db < -70, pause_db
    loud = subprocess.run([FFMPEG, '-hide_banner', '-i', str(VIDEO), '-vn',
                           '-af', 'loudnorm=I=-18:TP=-2:LRA=11:print_format=json',
                           '-f', 'null', '-'], check=True, capture_output=True, text=True)
    loudness = json.loads(re.findall(r'\{[\s\S]*?\}', loud.stderr)[-1])
    assert float(loudness['input_tp']) < -1.0, loudness

    # Sample every 0.5 seconds plus each exact state/cut endpoint from the
    # encoded 360x640 proxy. Preserve only compact review sheets and key frames.
    state_times, reading = [], []
    cursor = 0
    for n, duration in enumerate(DURATIONS, 1):
        for i, (start, key) in enumerate(STATES[n]):
            state_times.append((cursor + start, key))
            end = STATES[n][i+1][0] if i+1 < len(STATES[n]) else duration
            if key in COPY:
                chars = sum(c.isalnum() for c in COPY[key][1])
                reading.append({'key': key, 'seconds': round(end-start, 3),
                                'lettersAndDigits': chars,
                                'charactersPerSecond': round(chars/(end-start), 2)})
        cursor += duration
    times = [i / 2 for i in range(74)]
    endpoint_times = sorted(set([0, 1109/30, 34] + CUTS + [(t*30-1)/30 for t in CUTS]))
    indices = set(round(t*30) for t in times + endpoint_times + [t for t,_ in state_times])
    images = {}
    proxy_reader = imageio_ffmpeg.read_frames(str(PROXY), pix_fmt='rgb24')
    proxy_meta = next(proxy_reader)
    assert proxy_meta['size'] == (360, 640) and proxy_meta['fps'] == 30.0
    proxy_count = 0
    for index, pixels in enumerate(proxy_reader):
        if index in indices:
            images[index] = Image.frombytes('RGB', (360,640), pixels)
        proxy_count += 1
    assert proxy_count == 1110 and indices <= images.keys()
    for offset in range(0, len(times), 12):
        chosen = times[offset:offset+12]
        sheet([(f'{t:.1f}초', images[round(t*30)]) for t in chosen],
              REVIEW / f'timeline-{offset//12+1}.jpg', columns=4)
    for offset in range(0, len(state_times), 8):
        selected = state_times[offset:offset+8]
        sheet([(f'{t:.1f}초 · {key}', images[round(t*30)]) for t,key in selected],
              REVIEW / f'dialogue-states-{offset//8+1}.jpg', columns=4)
        sheet([(f'{t:.1f}초 · UI 예시', ui_simulation(images[round(t*30)])) for t,key in selected],
              REVIEW / f'ui-overlap-simulation-{offset//8+1}.jpg', columns=4)
    for offset in range(0, len(endpoint_times), 8):
        chosen = endpoint_times[offset:offset+8]
        sheet([(f'{t:.2f}초', images[round(t*30)]) for t in chosen],
              REVIEW / f'cuts-and-zoom-{offset//8+1}.jpg', columns=4)
    for t in [0, 4, 14, 19, 20.5, 34, 36.9]:
        native_frame(t).save(REVIEW / f'native-{t:.1f}.jpg', quality=95)
    report = {
        'checkedAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'technicalStatus': 'passed', 'fullVideoDecode': 'passed',
        'decodedFrames': decoded, 'proxyDecodedFrames': proxy_count,
        'seconds': seconds, 'metadata': metadata, 'sceneCuts': CUTS,
        'dialogueStateTimes': state_times, 'dialogueReadingTimes': reading,
        'dialogueMatchesApprovedStoryboard': True,
        'closingBrandAndCTATimes': [34,37], 'blackFrameIntervals': black,
        'detectedSilence': silence, 'intentionalSilenceSeconds': [19,19.7],
        'measuredPauseCoreRmsDbfs': pause_db,
        'audioDecodedSeconds': len(audio)/48000, 'audioChannelsMeasured': 'stereo',
        'audioPeakDbfs': db(np.max(np.abs(audio))), 'clippedSamples': clipped,
        'audioRmsPerSecondDbfs': per_second, 'loudness': loudness,
        'protectedFilesPreserved': len(before['files']),
        'productionInputsPreserved': len(prep['sources']),
        'captionIncludesMusicCredit': True, 'captionIncludesAiDisclosureAndSceneDescription': True,
        'humanListening': 'Not performed: no audio-perception tool is available. Technical audio checks are not listening approval.',
        'realTimePlaybackClaim': False,
        'visualMethod': 'Full decode plus every-0.5-second contact sheets, state starts, cut endpoints, 1080px key frames and cover crops for assistant visual inspection.',
        'instagramOverlap': 'Illustrative mobile controls/caption simulation only. Actual Instagram playback/profile crop remain for the separately authorized publication stage.',
        'videoSha256': sha(VIDEO), 'coverSha256': sha(OUT/'cover.jpg')}
    write(REVIEW/'technical-quality.json', report)
    print(json.dumps({k:report[k] for k in ['technicalStatus','decodedFrames','seconds',
          'audioPeakDbfs','clippedSamples','blackFrameIntervals','measuredPauseCoreRmsDbfs',
          'protectedFilesPreserved']},ensure_ascii=False,indent=2),flush=True)


if __name__ == '__main__':
    main()
