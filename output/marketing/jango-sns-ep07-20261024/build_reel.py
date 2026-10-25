"""Compose episode 7 from preserved imagegen art, fixed Gaegu lettering and licensed BGM.

Run with Python + Pillow + numpy + imageio-ffmpeg: build_reel.py layout | encode.
Only lettering/layout, uniform resizing and video/audio editing occur here.
"""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
import json
import subprocess
import sys
import tempfile

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont, ImageOps

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SIZE = (1080, 1920)
GAEGU = ROOT / 'design/jango/emoticons/kakao-32/v18/fonts/Gaegu-Bold.ttf'
BALLOON = ROOT / 'output/marketing/jango-sns-ep03-20261020/source-art/balloon-r1.png'
LICENSE = ROOT / 'design/jango/audio/monkeys-spinning-monkeys/license.json'
MUSIC = json.loads(LICENSE.read_text())
INK, GREEN = '#514438', '#28674F'
DURATIONS = [3, 3, 4, 6, 4]
KEYS = ['01', '02', '03', '04a', '04b', '05']
TEXT_BOXES, BALLOONS = [], []


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def text(im, copy, center, size, *, color=INK, width=730, gap=12, role='dialogue'):
    draw = ImageDraw.Draw(im)
    font = ImageFont.truetype(str(GAEGU), size)
    lines = copy.split('\n')
    rendered_lines = [line.replace('…', '...') for line in lines]
    # Gaegu's ellipsis slot is empty. Render three period glyphs without
    # changing the logical storyboard copy or spacing of Korean syllables.
    for line in rendered_lines:
        assert all(ch.isspace() or font.getmask(ch).getbbox() for ch in line), (role, line)
    bounds = [draw.textbbox((0, 0), line, font=font) for line in rendered_lines]
    heights = [b[3] - b[1] for b in bounds]
    y = center[1] - (sum(heights) + gap * (len(lines) - 1)) / 2
    for logical, rendered, box, height in zip(lines, rendered_lines, bounds, heights):
        w = box[2] - box[0]
        assert w <= width, (role, logical, w)
        x = center[0] - w / 2
        rect = [round(x), round(y), round(x + w), round(y + height)]
        assert rect[0] >= 96 and rect[1] >= 280 and rect[2] <= 900 and rect[3] <= 1420, (role, rect)
        draw.text((round(x - box[0]), round(y - box[1])), rendered, font=font, fill=color)
        TEXT_BOXES.append({'role': role, 'text': logical, 'renderedText': rendered,
                           'sizePx': size, 'bbox': rect, 'inkHeightPx': height,
                           'fixedToFrame': True})
        y += height + gap


def balloon(im, xy, width, *, mirror=False, role):
    source = Image.open(BALLOON).convert('RGBA')
    if mirror:
        source = ImageOps.mirror(source)
    wh = (width, round(source.height * width / source.width))
    im.alpha_composite(source.resize(wh, Image.Resampling.LANCZOS), xy)
    BALLOONS.append({'role': role, 'xy': xy, 'size': wh, 'mirrored': mirror,
                     'tailDirection': 'down-left' if mirror else 'down-right'})


def scene_art(n):
    selection = json.loads((OUT / 'selected-artwork.json').read_text())
    source = Image.open(ROOT / selection['scenes'][n - 1]['file']).convert('RGBA')
    # 941x1672 differs from 9:16 by <1 native background pixel. Uniform fit
    # removes only ratio-rounding background; no nonuniform stretch.
    return ImageOps.fit(source, SIZE, Image.Resampling.LANCZOS)


def fixed_layers():
    layers = {}
    for key in KEYS:
        im = Image.new('RGBA', SIZE)
        if key == '01':
            balloon(im, (438, 246), 500, mirror=True, role='01 woman')
            text(im, '딱 한 끼만\n만들자.', (688, 355), 76, width=410, role='01 woman')
        elif key == '02':
            balloon(im, (420, 242), 520, role='02 Jango')
            text(im, '이건 좀\n부족해 보여.', (680, 357), 76, width=440, role='02 Jango')
        elif key == '03':
            text(im, '잠시 후', (695, 324), 72, width=350, color=GREEN, role='03 time cue')
            balloon(im, (510, 361), 360, role='03 shared pause')
            text(im, '……', (690, 430), 82, width=260, role='03 shared pause')
        elif key == '04a':
            balloon(im, (416, 244), 530, mirror=True, role='04 woman')
            text(im, '우리 둘인데?', (681, 348), 74, width=450, role='04 woman')
        elif key == '04b':
            balloon(im, (407, 238), 540, role='04 Jango')
            text(im, '내일의 우리도\n있잖아.', (677, 359), 74, width=460, role='04 Jango')
        else:
            balloon(im, (360, 220), 630, role='05 shared ending')
            text(im, '장고야 부탁해', (675, 314), 76, width=480, color=GREEN, role='05 brand')
            text(im, '면 양 조절 실패담,\n댓글로!', (675, 410), 54, width=480, gap=6, role='05 single closing question')
        im.save(OUT / 'layers' / f'{key}.png')
        layers[key] = im
    return layers


def layer_key(scene, local_time):
    return ('04a' if local_time < 2 else '04b') if scene == 4 else f'{scene:02d}'


def layout():
    for directory in ['scenes', 'layers', 'review/reel', 'reel']:
        (OUT / directory).mkdir(parents=True, exist_ok=True)
    layers = fixed_layers()
    previews = []
    for n in range(1, 6):
        art = scene_art(n)
        art.save(OUT / f'scenes/{n:02d}.png')
        for key in (['04a', '04b'] if n == 4 else [f'{n:02d}']):
            merged = Image.alpha_composite(art, layers[key]).convert('RGB')
            previews.append(merged.resize((360, 640), Image.Resampling.LANCZOS))
    sheet = Image.new('RGB', (1080, 1320), '#F8F3EA')
    for i, im in enumerate(previews):
        sheet.paste(im, ((i % 3) * 360, (i // 3) * 660))
    sheet.save(OUT / 'review/reel/layout-overview.jpg', quality=96, subsampling=0)

    cover = scene_art(3)
    layer = Image.new('RGBA', SIZE)
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((460, 330, 910, 580), radius=40, fill='#FFFCF7F2')
    text(layer, '이게 한\n끼라고?', (685, 450), 90, color=GREEN, width=415, role='cover title')
    draw.rounded_rectangle((270, 1353, 810, 1424), radius=23, fill='#FFFCF7F2')
    text(layer, '장고랑 살아보니 07', (540, 1388), 46, color=GREEN, width=485, role='cover series')
    layer.save(OUT / 'layers/cover.png')
    cover = Image.alpha_composite(cover, layer).convert('RGB')
    cover.save(OUT / 'cover.jpg', quality=97, subsampling=0)
    cover.resize((360, 640), Image.Resampling.LANCZOS).save(OUT / 'review/reel/cover-360.jpg', quality=96)
    for size, label in [((360, 480), '3x4'), ((360, 360), 'square')]:
        ImageOps.fit(cover, size, Image.Resampling.LANCZOS).save(
            OUT / f'review/reel/cover-profile-{label}.jpg', quality=96)
    write(OUT / 'reel/typography.json', {
        'nativeArtworkSize': [941, 1672], 'outputSize': list(SIZE),
        'uniformFraming': 'Uniform cover fit; under one native background pixel removed for ratio rounding.',
        'fixedText': TEXT_BOXES, 'balloons': BALLOONS,
        'balloonSource': {'file': str(BALLOON.relative_to(ROOT)), 'sha256': sha(BALLOON)},
        'font': {'file': str(GAEGU.relative_to(ROOT)), 'sha256': sha(GAEGU),
                 'license': 'design/jango/emoticons/kakao-32/v18/fonts/OFL.txt'},
        'storyboardCopyPreserved': True, 'appScreen': None,
    })
    print('Composed five scenes, six fixed text states and cover.', flush=True)


def command(args, name):
    write(OUT / 'reel' / f'{name}-command.json', args)
    with (OUT / 'reel' / f'{name}.log').open('w') as log:
        subprocess.run(args, check=True, stdout=log, stderr=log)
    log_path = OUT / 'reel' / f'{name}.log'
    log_path.write_text('\n'.join(line.rstrip() for line in log_path.read_text().splitlines()).rstrip() + '\n')


def encode():
    prep = json.loads((OUT / 'reel/preparation.json').read_text())
    for source in prep['sources']:
        assert sha(ROOT / source['file']) == source['sha256'], source['file']
    assert sha(ROOT / MUSIC['file']) == MUSIC['sha256']
    scenes = {n: Image.open(OUT / f'scenes/{n:02d}.png').convert('RGBA') for n in range(1, 6)}
    layers = {key: Image.open(OUT / f'layers/{key}.png').convert('RGBA') for key in KEYS}
    with tempfile.TemporaryDirectory(prefix='jango-ep07-render-') as cache:
        silent = Path(cache) / 'silent.mp4'
        cmd = [FFMPEG, '-hide_banner', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
               '-s', '1080x1920', '-r', '30', '-i', '-', '-an', '-c:v', 'libx264',
               '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
               '-movflags', '+faststart', str(silent)]
        write(OUT / 'reel/video-command.json', cmd)
        with (OUT / 'reel/video.log').open('w') as log:
            process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=log, stderr=log)
            try:
                for n, duration in enumerate(DURATIONS, 1):
                    for f in range(duration * 30):
                        zoom = 1 + .03 * f / (duration * 30 - 1)
                        # Anchoring near the characters limits outward movement.
                        ax, ay = 540, 1040
                        affine = (1 / zoom, 0, ax * (1 - 1 / zoom),
                                  0, 1 / zoom, ay * (1 - 1 / zoom))
                        art = scenes[n].transform(SIZE, Image.Transform.AFFINE, affine, Image.Resampling.BICUBIC)
                        frame = Image.alpha_composite(art, layers[layer_key(n, f / 30)]).convert('RGB')
                        process.stdin.write(frame.tobytes())
                    print(f'Rendered scene {n}/5 ({sum(DURATIONS[:n])*30}/600 frames).', flush=True)
                process.stdin.close()
                if process.wait() != 0:
                    raise RuntimeError('FFmpeg video encoding failed')
            finally:
                if process.poll() is None:
                    process.terminate()
        command([FFMPEG, '-hide_banner', '-y', '-i', str(silent), '-i', str(ROOT / MUSIC['file']),
                 '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af',
                 'atrim=0:20,asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:st=0:d=0.3,afade=t=out:st=19:d=1',
                 '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '20',
                 '-metadata', 'title=장고랑 살아보니 07 — 한 끼만 만들랬잖아',
                 '-metadata', f'comment={MUSIC["requiredCredit"]}', '-movflags', '+faststart',
                 str(OUT / 'reel/jango-ep07-music.mp4')], 'final')
    command([FFMPEG, '-hide_banner', '-y', '-i', str(OUT / 'reel/jango-ep07-music.mp4'),
             '-vf', 'scale=360:640:flags=lanczos', '-c:v', 'libx264', '-crf', '18',
             '-preset', 'fast', '-c:a', 'copy', '-movflags', '+faststart',
             str(OUT / 'review/reel/jango-ep07-360.mp4')], 'proxy')
    write(OUT / 'reel/production.json', {
        'createdAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'format': 'MP4/H.264/yuv420p,1080x1920,30fps,600 frames,AAC 48kHz stereo',
        'seconds': 20, 'sceneDurations': DURATIONS, 'sceneCuts': [3, 6, 10, 16],
        'dialogueChange': 12, 'closingBrandAndQuestionSeconds': [16, 20],
        'zoom': [1, 1.03], 'zoomAnchor': [540, 1040], 'fixedLettering': True,
        'narration': False, 'newArtworkGenerated': False,
        'musicSource': MUSIC['file'], 'musicSourceSha256': MUSIC['sha256'],
        'musicLicenseRecord': str(LICENSE.relative_to(ROOT)), 'musicExcerptSeconds': [0, 20],
        'fadeInSeconds': .3, 'fadeOutSeconds': 1, 'audioTargetLufs': -18,
        'credit': MUSIC['requiredCredit'], 'videoSha256': sha(OUT / 'reel/jango-ep07-music.mp4'),
        'coverSha256': sha(OUT / 'cover.jpg'),
    })
    print('Encoded 20-second Reel and 360x640 review copy.', flush=True)


if __name__ == '__main__':
    if len(sys.argv) == 1 or sys.argv[1] == 'layout':
        layout()
    elif sys.argv[1] == 'encode':
        encode()
    else:
        raise SystemExit('Use layout or encode.')
