"""Build ep05 from existing source art, fixed Korean lettering and BGM only."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SIZE = (1080, 1920)
GAEGU = ROOT / 'design/jango/emoticons/kakao-32/v18/fonts/Gaegu-Bold.ttf'
BALLOON = ROOT / 'output/marketing/jango-sns-ep03-20261020/source-art/balloon-r1.png'
INK = '#514438'
GREEN = '#28674F'
DURATIONS = [2, 4, 4, 6, 4]
SELECTED = ['scene-01-r1.png', 'scene-02-r3.png', 'scene-03-r3.png',
            'scene-04-r2.png', 'scene-05-r2.png']
TEXT_BOXES = []
SIGN_QUAD = [(534, 724), (632, 710), (632, 791), (534, 804)]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def text(im, copy, center, size, *, color=INK, width=730, gap=15, role='dialogue'):
    draw = ImageDraw.Draw(im)
    font = ImageFont.truetype(str(GAEGU), size)
    lines = copy.split('\n')
    # Gaegu's U+2026 slot has no ink. Keep the logical script unchanged and
    # draw the ellipsis with three supported period glyphs from the same font.
    rendered_lines = [line.replace('…', '...') for line in lines]
    for line in rendered_lines:
        assert all(ch.isspace() or font.getmask(ch).getbbox() is not None for ch in line), (role, line)
    bounds = [draw.textbbox((0, 0), line, font=font) for line in rendered_lines]
    heights = [box[3] - box[1] for box in bounds]
    y = center[1] - (sum(heights) + gap * (len(lines) - 1)) / 2
    for line, rendered, box, height in zip(lines, rendered_lines, bounds, heights):
        w = box[2] - box[0]
        assert w <= width, (role, line, w, width)
        x = center[0] - w / 2
        rect = [round(x), round(y), round(x + w), round(y + height)]
        assert rect[0] >= 96 and rect[1] >= 280 and rect[2] <= 900 and rect[3] <= 1420, (role, rect)
        draw.text((round(x - box[0]), round(y - box[1])), rendered, font=font, fill=color)
        TEXT_BOXES.append({'role': role, 'text': line, 'sizePx': size,
                           'renderedText': rendered,
                           'bbox': rect, 'inkHeightPx': height,
                           'font': str(GAEGU.relative_to(ROOT)), 'fixedToFrame': True})
        y += height + gap


def balloon(im, xy, width, *, mirror=False):
    source = Image.open(BALLOON).convert('RGBA')
    if mirror:
        source = ImageOps.mirror(source)
    wh = (width, round(source.height * width / source.width))
    im.alpha_composite(source.resize(wh, Image.Resampling.LANCZOS), xy)


def project(im, layer, quad):
    src = [(0, 0), (layer.width, 0), (layer.width, layer.height), (0, layer.height)]
    a, b = [], []
    for (x, y), (u, v) in zip(quad, src):
        a.extend([[x, y, 1, 0, 0, 0, -u*x, -u*y],
                  [0, 0, 0, x, y, 1, -v*x, -v*y]])
        b.extend([u, v])
    coefficients = np.linalg.solve(np.asarray(a), np.asarray(b)).tolist()
    im.alpha_composite(layer.transform(im.size, Image.Transform.PERSPECTIVE,
                                      coefficients, Image.Resampling.BICUBIC))


def scene_art(n):
    art = Image.open(OUT / 'source-art' / SELECTED[n-1]).convert('RGBA')
    if n == 3:
        label = Image.new('RGBA', (120, 110))
        draw = ImageDraw.Draw(label)
        font = ImageFont.truetype(str(GAEGU), 38)
        for line, cy in [('11시', 34), ('오픈', 78)]:
            box = draw.textbbox((0, 0), line, font=font)
            draw.text((60-(box[2]-box[0])/2-box[0], cy-(box[3]-box[1])/2-box[1]),
                      line, font=font, fill=INK)
        label.save(OUT / 'layers/store-hours.png')
        project(art, label, SIGN_QUAD)
    # Native art is approximately 9:16. This removes <1 native background
    # pixel in total, with uniform scaling and no stretch of characters.
    return ImageOps.fit(art, SIZE, Image.Resampling.LANCZOS).convert('RGBA')


def fixed_layers():
    layers = {}
    for key in ['01', '02', '03', '04a', '04b', '05']:
        im = Image.new('RGBA', SIZE)
        if key == '01':
            balloon(im, (115, 205), 790, mirror=True)
            text(im, '장고가 이렇게\n빨랐어?', (510, 380), 84, role='01 woman')
        elif key == '02':
            balloon(im, (380, 245), 540)
            text(im, '늦으면\n끝이야!', (650, 375), 76, width=415, gap=12, role='02 Jango')
        elif key == '03':
            balloon(im, (125, 230), 720, mirror=True)
            text(im, '…찹쌀떡?', (485, 387), 92, width=620, role='03 woman')
        elif key == '04a':
            balloon(im, (120, 240), 760)
            text(im, '러닝 하자며?', (500, 405), 90, width=670, role='04 woman')
        elif key == '04b':
            balloon(im, (120, 240), 760, mirror=True)
            text(im, '오픈런도\n런이잖아.', (500, 405), 88, width=670, role='04 Jango')
        else:
            balloon(im, (115, 260), 790)
            text(im, '장고야 부탁해', (510, 347), 80, color=GREEN, role='05 brand')
            text(im, '너는 러닝파,\n오픈런파?', (510, 468), 84, width=690, role='05 single closing question')
            # A quiet series label on the sky, above both characters' faces.
            d = ImageDraw.Draw(im)
            d.rounded_rectangle((265, 624, 755, 686), radius=20, fill='#FFFCF7EB')
            text(im, '장고랑 살아보니 05', (510, 654), 43, width=450, color=GREEN, role='05 series')
        im.save(OUT / 'layers' / f'{key}.png')
        layers[key] = im
    return layers


def layer_key(n, local_time):
    if n == 4:
        return '04a' if local_time < 2.3 else '04b'
    return f'{n:02d}'


def layout():
    for directory in ['scenes', 'layers', 'review/reel', 'reel']:
        (OUT / directory).mkdir(parents=True, exist_ok=True)
    layers = fixed_layers()
    previews = []
    for n in range(1, 6):
        art = scene_art(n)
        art.save(OUT / 'scenes' / f'{n:02d}.png')
        for key in (['04a', '04b'] if n == 4 else [f'{n:02d}']):
            merged = Image.alpha_composite(art, layers[key]).convert('RGB')
            merged.save(OUT / 'review/reel' / f'layout-{key}.png')
            merged.resize((360, 640), Image.Resampling.LANCZOS).save(OUT / 'review/reel' / f'layout-{key}-360.png')
            previews.append((key, merged))
    sheet = Image.new('RGB', (1080, 1320), '#F8F3EA')
    for i, (_, im) in enumerate(previews):
        sheet.paste(im.resize((360, 640), Image.Resampling.LANCZOS), ((i % 3)*360, (i // 3)*660))
    sheet.save(OUT / 'review/reel/layout-overview.jpg', quality=96, subsampling=0)

    cover = Image.open(OUT / 'scenes/01.png').convert('RGBA')
    layer = Image.new('RGBA', SIZE)
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((110, 435, 930, 640), radius=44, fill='#FFFCF7F7')
    text(layer, '장고가 갑자기\n빨라졌다', (520, 535), 80, color=GREEN, width=745, gap=12, role='cover title')
    d.rounded_rectangle((425, 644, 940, 711), radius=21, fill='#FFFCF7EF')
    text(layer, '장고랑 살아보니 05', (680, 677), 44, color=GREEN, width=470, role='cover series')
    layer.save(OUT / 'layers/cover.png')
    cover = Image.alpha_composite(cover, layer).convert('RGB')
    cover.save(OUT / 'cover.png')
    cover.save(OUT / 'cover.jpg', quality=97, subsampling=0)
    cover.resize((360, 640), Image.Resampling.LANCZOS).save(OUT / 'review/reel/cover-360.png')
    for wh, label in [((360, 480), '3x4'), ((360, 360), 'square')]:
        ImageOps.fit(cover, wh, Image.Resampling.LANCZOS).save(OUT / f'review/reel/cover-profile-{label}.jpg', quality=96)
    write(OUT / 'reel/typography.json', {
        'nativeArtworkSize': [941, 1672], 'outputSize': list(SIZE),
        'uniformFraming': 'Cover fit, <1 native pixel of background removed in total for ratio rounding.',
        'fixedText': TEXT_BOXES,
        'balloon': {'source': str(BALLOON.relative_to(ROOT)), 'sha256': sha(BALLOON),
                    'method': 'Reused existing approved blank balloon, uniformly scaled and optionally mirrored.'},
        'font': {'file': str(GAEGU.relative_to(ROOT)), 'sha256': sha(GAEGU),
                 'license': 'design/jango/emoticons/kakao-32/v18/fonts/OFL.txt'},
        'storefront': {'exactText': '11시 오픈', 'lineBreak': ['11시', '오픈'],
                       'nativeQuad': SIGN_QUAD, 'movesWithArtwork': True,
                       'notAnAppScreen': True},
    })
    print('Composed five scenes, six fixed lettering states, cover and 360px layout proofs.', flush=True)


def command(args, name):
    write(OUT / 'reel' / f'{name}-command.json', args)
    with (OUT / 'reel' / f'{name}.log').open('w') as log:
        subprocess.run(args, check=True, stdout=log, stderr=log)


def encode():
    scenes = {n: Image.open(OUT / f'scenes/{n:02d}.png').convert('RGBA') for n in range(1, 6)}
    layers = {key: Image.open(OUT / f'layers/{key}.png').convert('RGBA')
              for key in ['01', '02', '03', '04a', '04b', '05']}
    cmd = [FFMPEG, '-hide_banner', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
           '-s', '1080x1920', '-r', '30', '-i', '-', '-an', '-c:v', 'libx264',
           '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
           '-movflags', '+faststart', str(OUT / 'reel/silent.mp4')]
    write(OUT / 'reel/silent-command.json', cmd)
    with (OUT / 'reel/silent.log').open('w') as log:
        process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=log, stderr=log)
        try:
            for n, duration in enumerate(DURATIONS, 1):
                frames = duration * 30
                for f in range(frames):
                    z = 1 + .03 * f / (frames - 1)
                    ax, ay = 540, 1030
                    affine = (1/z, 0, ax*(1-1/z), 0, 1/z, ay*(1-1/z))
                    art = scenes[n].transform(SIZE, Image.Transform.AFFINE, affine, Image.Resampling.BICUBIC)
                    fixed = layers[layer_key(n, f/30)]
                    frame = Image.alpha_composite(art, fixed).convert('RGB')
                    process.stdin.write(frame.tobytes())
                print(f'Rendered scene {n}/5, {sum(DURATIONS[:n])*30}/600 frames.', flush=True)
            process.stdin.close()
            if process.wait() != 0:
                raise RuntimeError('FFmpeg video encoding failed')
        finally:
            if process.poll() is None:
                process.terminate()
    credit = ('Carefree — Kevin MacLeod (incompetech.com), CC BY 4.0 '
              'https://creativecommons.org/licenses/by/4.0/ ; excerpt, level adjustment and fades.')
    command([FFMPEG, '-hide_banner', '-y', '-i', str(OUT / 'reel/silent.mp4'),
             '-i', str(OUT / 'music/Carefree.mp3'), '-map', '0:v:0', '-map', '1:a:0',
             '-c:v', 'copy', '-af',
             'atrim=0:20,asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:st=0:d=0.3,afade=t=out:st=19:d=1',
             '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '20',
             '-metadata', 'title=장고랑 살아보니 05 — 러닝인 줄 알았는데 오픈런',
             '-metadata', f'comment={credit}', '-movflags', '+faststart',
             str(OUT / 'reel/jango-ep05-music.mp4')], 'final')
    command([FFMPEG, '-hide_banner', '-y', '-i', str(OUT / 'reel/jango-ep05-music.mp4'),
             '-vf', 'scale=360:640:flags=lanczos', '-c:v', 'libx264', '-crf', '18',
             '-preset', 'fast', '-c:a', 'copy', '-movflags', '+faststart',
             str(OUT / 'review/reel/jango-ep05-360.mp4')], 'proxy')
    write(OUT / 'reel/production.json', {
        'format': 'MP4/H.264,1080x1920,30fps,600 frames,AAC 48kHz', 'seconds': 20,
        'sceneDurations': DURATIONS, 'sceneCuts': [2, 6, 10, 16],
        'dialogueChange': 12.3, 'closingBrandAndQuestionSeconds': [16, 20],
        'zoom': [1, 1.03], 'fixedLettering': True, 'narration': False,
        'auditionVoicesIncluded': False, 'musicSource': 'music/Carefree.mp3',
        'musicSourceSha256': sha(OUT / 'music/Carefree.mp3'),
        'musicExcerptSeconds': [0, 20], 'fadeInSeconds': .3, 'fadeOutSeconds': 1,
        'audioTargetLufs': -18, 'credit': credit,
        'videoSha256': sha(OUT / 'reel/jango-ep05-music.mp4'),
    })
    print('Encoded 20-second BGM-only Reel and 360x640 review copy.', flush=True)


if __name__ == '__main__':
    if len(sys.argv) == 1 or sys.argv[1] == 'layout':
        layout()
    elif sys.argv[1] == 'encode':
        encode()
    else:
        raise SystemExit('Use layout or encode.')
