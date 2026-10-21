"""Decode ep05 completely and produce honest technical and visual-review evidence."""
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
VIDEO = OUT / 'reel/jango-ep05-music.mp4'
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
                             '-f', 'image2pipe', '-vcodec', 'png', '-'],
                            check=True, capture_output=True)
    return Image.open(io.BytesIO(result.stdout)).convert('RGB')


def ui_simulation(im):
    """Conservative illustrative overlay; this is not a live Instagram screenshot."""
    overlay = Image.new('RGBA', im.size)
    d = ImageDraw.Draw(overlay)
    small = ImageFont.truetype(str(FONT), 11)
    label = ImageFont.truetype(str(FONT), 14)
    for y in range(480, 640):
        d.line((0, y, 360, y), fill=(0, 0, 0, round((y-480)*.85)))
    d.text((15, 25), '릴스 · UI 겹침 시뮬레이션', font=small, fill='white',
           stroke_width=1, stroke_fill='#302E2C')
    for y in [365, 410, 455, 500]:
        d.ellipse((321, y, 344, y+23), outline='white', width=2)
        d.text((321, y+25), '···', font=small, fill='white')
    d.text((16, 549), 'jango_plz', font=label, fill='white')
    d.text((16, 580), '러닝인 줄 알았는데 오픈런', font=small, fill='white')
    d.text((16, 607), 'Carefree — Kevin MacLeod', font=small, fill='white')
    return Image.alpha_composite(im.convert('RGBA'), overlay).convert('RGB')


def contact_sheet(items, path, columns=5):
    rows = math.ceil(len(items)/columns)
    sheet = Image.new('RGB', (columns*360, rows*670), '#F8F3EA')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(str(FONT), 17)
    for i, (stamp, im) in enumerate(items):
        x, y = (i % columns)*360, (i // columns)*670
        sheet.paste(im, (x, y))
        draw.text((x+12, y+645), stamp, font=font, fill='#302E2C')
    sheet.save(path, quality=95, subsampling=0)


def check_preserved_inputs():
    baseline = json.loads((OUT / 'reel/preservation-before-render.json').read_text())
    cleanup_path = OUT / 'cleanup.json'
    removed = {row['file']: row for row in json.loads(cleanup_path.read_text())['removed']} if cleanup_path.exists() else {}
    checked = []
    metadata_snapshots = []
    removed_history = []
    for row in baseline['files']:
        if Path(row['file']).name == '.DS_Store':
            continue
        path = OUT / row['file']
        if row['file'] in removed:
            # User-requested archive cleanup is explicit historical deletion,
            # not a successful byte-preservation check of a missing file.
            assert not path.exists(), str(path)
            assert removed[row['file']]['sha256'] == row['sha256'], row['file']
            removed_history.append(row['file'])
            continue
        if row['file'] in ['episode.json', 'production-record.json', 'selected-artwork.json']:
            # Current pointers advance after rendering; preserve and verify
            # their original bytes in the pre-render snapshots instead.
            path = OUT / 'reel' / f'before-{row["file"]}'
            metadata_snapshots.append(str(path.relative_to(OUT)))
        assert sha(path) == row['sha256'], str(path)
        checked.append(row['file'])
    master = json.loads((OUT / 'preservation-baseline.json').read_text())
    for row in master['files']:
        assert sha(ROOT / row['file']) == row['sha256'], row['file']
    prep = json.loads((OUT / 'reel/preparation.json').read_text())
    for row in prep['sources']:
        assert sha(ROOT / row['file']) == row['sha256'], row['file']
    return checked, metadata_snapshots, removed_history, master, prep


def main():
    checked, metadata_snapshots, removed_history, master, prep = check_preserved_inputs()
    REVIEW.mkdir(parents=True, exist_ok=True)
    count, seconds = imageio_ffmpeg.count_frames_and_secs(str(VIDEO))
    assert count == 600 and seconds == 20.0, (count, seconds)
    reader = imageio_ffmpeg.read_frames(str(VIDEO), pix_fmt='rgb24')
    metadata = next(reader)
    assert metadata['size'] == (1080, 1920) and metadata['fps'] == 30.0, metadata
    decoded = 0
    for pixels in reader:
        assert len(pixels) == 1080*1920*3
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
    pcm = subprocess.run([FFMPEG, '-v', 'error', '-i', str(VIDEO), '-vn', '-ac', '1',
                          '-ar', '48000', '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    audio = np.frombuffer(pcm, dtype='<f4')
    assert audio.size >= 20*48000 and np.isfinite(audio).all()
    clips = int((np.abs(audio) >= 1).sum())
    assert clips == 0
    loud = subprocess.run([FFMPEG, '-hide_banner', '-i', str(VIDEO), '-vn', '-af',
                           'loudnorm=I=-18:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'],
                          check=True, capture_output=True, text=True)
    loudness = json.loads(re.findall(r'\{[\s\S]*?\}', loud.stderr)[-1])
    assert float(loudness['input_tp']) < -1.0, loudness
    per_second = [db(np.sqrt(np.mean(audio[i*48000:(i+1)*48000]**2))) for i in range(20)]
    assert all(level > -45 for level in per_second), per_second
    timeline = []
    for t in range(20):
        im = frame(t)
        im.save(REVIEW / f'second-{t:02d}.jpg', quality=95)
        timeline.append((f'{t}초', im))
    contact_sheet(timeline[:10], REVIEW / 'timeline-00-09.jpg')
    contact_sheet(timeline[10:], REVIEW / 'timeline-10-19.jpg')
    # Include before/after every scene/dialogue cut and zoom start/mid/end.
    endpoints = [0, 1, 59/30, 2, 4, 179/30, 6, 8, 299/30,
                 10, 12.2666667, 12.3, 13, 479/30, 16, 18, 599/30]
    end_items = []
    for t in endpoints:
        im = frame(t)
        im.save(REVIEW / f'endpoint-{t:05.2f}.jpg', quality=95)
        end_items.append((f'{t:.2f}초', im))
    for part in range(2):
        contact_sheet(end_items[part*10:(part+1)*10], REVIEW / f'cuts-and-zoom-{part+1}.jpg')
    overlap = []
    for i, t in enumerate([59/30, 179/30, 299/30, 12.2666667, 479/30, 599/30], 1):
        im = ui_simulation(frame(t))
        im.save(REVIEW / f'ui-overlap-{i:02d}.jpg', quality=95)
        overlap.append((f'{t:.2f}초 · 시뮬레이션', im))
    contact_sheet(overlap, REVIEW / 'ui-overlap-sheet.jpg', columns=3)
    for t in [0, 2, 6, 12.3, 16, 599/30]:
        frame(t, (1080, 1920)).save(REVIEW / f'native-{t:05.2f}.jpg', quality=96)
    for script in [OUT / 'build_reel.py', Path(__file__)]:
        compile(script.read_text(), str(script), 'exec')
    report = {
        'checkedAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'fullVideoDecode': 'passed', 'decodedFrames': decoded, 'seconds': seconds,
        'metadata': {k: str(v) if isinstance(v, bytes) else v for k, v in metadata.items()},
        'sceneCuts': [2, 6, 10, 16], 'dialogueChange': 12.3,
        'closingQuestionAndBrandSeconds': [16, 20], 'blackFrameIntervals': black,
        'audioDecodedSeconds': len(audio)/48000, 'audioPeakDbfs': db(np.max(np.abs(audio))),
        'audioRmsDbfs': db(np.sqrt(np.mean(audio*audio))), 'clippedSamples': clips,
        'audioRmsPerSecondDbfs': per_second, 'loudness': loudness,
        'detectedSilence': silence, 'narration': False,
        'audioOnlySource': 'music/Carefree.mp3', 'auditionFilesUsed': [],
        'pcmMeasurementChannels': '48kHz mono downmix; loudness/true-peak measurement uses original stereo',
        'priorEpisodeFilesPreserved': len(checked), 'masterAndReferenceFilesPreserved': len(master['files']),
        'priorEpisodeFilesRemovedByCleanup': removed_history,
        'priorMetadataPreservedAsSnapshots': metadata_snapshots,
        'productionInputHashesPreserved': len(prep['sources']),
        'technicalStatus': 'passed', 'humanListening': 'not performed: assistant audio input unavailable',
        'visualReviewEvidence': 'Complete timeline via one frame each second, plus all cut/zoom endpoints and native-resolution frames. See visual-review.json.',
        'realTimePlaybackClaim': False,
        'instagramOverlay': 'Conservative illustrative control overlay, not a live platform preview. Current live upload/profile verification is deferred until publication.',
        'videoSha256': sha(VIDEO), 'coverSha256': sha(OUT / 'cover.jpg'),
    }
    write(REVIEW / 'technical-quality.json', report)
    print(json.dumps({key: report[key] for key in ['decodedFrames', 'seconds', 'audioPeakDbfs',
                     'clippedSamples', 'blackFrameIntervals', 'priorEpisodeFilesPreserved',
                     'masterAndReferenceFilesPreserved', 'technicalStatus']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
