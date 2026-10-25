"""Build episode 9: selected original art + fixed Korean lettering + Investigations.

Run with the existing /private/tmp/jango-ep08-venv/bin/python: layout | encode.
The original art and historical preparation/approval records are read-only inputs.
"""
from datetime import datetime
from pathlib import Path
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
SIZE, FPS = (1080, 1920), 30
GAEGU = ROOT / 'design/jango/emoticons/kakao-32/v18/fonts/Gaegu-Bold.ttf'
PRETENDARD = ROOT / 'apps/mobile/assets/fonts/Pretendard-Regular.otf'
BALLOON = ROOT / 'output/marketing/jango-sns-ep03-20261020/source-art/balloon-r1.png'
MUSIC_RECORD = OUT / 'music/license.json'
INK, GREEN = '#514438', '#28674F'
DURATIONS = [4, 5, 5, 5, 5, 5, 8]
CUTS = [4, 9, 14, 19, 24, 29]
STATES = {
    1: [(0, '01w'), (2.3, '01j')],
    2: [(0, '02w'), (2.7, '02j')],
    3: [(0, '03w'), (2.1, '03j')],
    4: [(0, '04j'), (2.8, '04w')],
    5: [(0, '05w'), (1.5, '05j')],
    6: [(0, '06w'), (1.8, '06j')],
    7: [(0, '07w'), (2.2, '07j'), (5, '07end')],
}
COPY = {
    '01w': ('여성', '회 먹으러 가는데…\n이사 가?'),
    '01j': ('장고', '이 정도는 기본이지.'),
    '02w': ('여성', '회 한 접시 먹는데\n테이블도 필요해?'),
    '02j': ('장고', '준비는 과할수록\n좋은 거야.'),
    '03w': ('여성', '이제 진짜\n다 챙겼지?'),
    '03j': ('장고', '응. 빠진 게\n있을 수가 없어.'),
    '04j': ('장고', '봤지? 준비한 보람이\n있잖아.'),
    '04w': ('여성', '좋아. 이제 회 꺼내.'),
    '05w': ('여성', '……회는?'),
    '05j': ('장고', '잠깐. 분명 냉장고에\n넣어 놨는데.'),
    '06w': ('여성', '넣어 놓고?'),
    '06j': ('장고', '……꺼내지는 않았네.'),
    '07w': ('여성', '비상식량은 챙겼네?'),
    '07j': ('장고', '내가 준비성은\n좋잖아.'),
}
# x, y, width, height, text center x/y. Blank-balloon geometry is adjusted;
# artwork and glyphs always retain their proportions.
PLACEMENT = {
    1: (250, 210, 770, 320, 620, 370),
    2: (330, 220, 700, 330, 648, 382),
    3: (330, 220, 700, 330, 648, 382),
    4: (130, 246, 810, 405, 530, 412),
    5: (130, 246, 810, 405, 530, 412),
    6: (130, 246, 810, 405, 530, 412),
    7: (130, 246, 810, 405, 530, 412),
}
# Right-edge anchor preserves the complete Jango hat in the entryway shots.
ANCHORS = {1: (900, 1030), 2: (1080, 1030), 3: (1080, 1030),
           4: (350, 1030), 5: (460, 1070), 6: (450, 1030), 7: (450, 1030)}
TEXT_BOXES = []


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def centered_text(im, copy, center, size, role, *, color=INK, max_width=720,
                  gap=13, font_path=GAEGU, safe=True):
    draw = ImageDraw.Draw(im)
    font = ImageFont.truetype(str(font_path), size)
    logical = copy.split('\n')
    # Gaegu has no ellipsis glyph; three native periods preserve its handwritten look.
    rendered = [s.replace('…', '...') if font_path == GAEGU else s for s in logical]
    bounds = [draw.textbbox((0, 0), s, font=font) for s in rendered]
    heights = [b[3] - b[1] for b in bounds]
    y = center[1] - (sum(heights) + gap * (len(logical) - 1)) / 2
    for original, line, box, height in zip(logical, rendered, bounds, heights):
        width = box[2] - box[0]
        assert width <= max_width, (role, original, width, max_width)
        x = center[0] - width / 2
        rect = [round(x), round(y), round(x + width), round(y + height)]
        if safe:
            assert rect[0] >= 96 and rect[1] >= 280 and rect[2] <= 900 and rect[3] <= 1420, (role, rect)
        draw.text((round(x - box[0]), round(y - box[1])), line, font=font, fill=color)
        TEXT_BOXES.append({'role': role, 'text': original, 'renderedText': line,
                           'bbox': rect, 'font': str(font_path.relative_to(ROOT)),
                           'sizePx': size, 'fixedToFrame': True})
        y += height + gap


def selected_art(n):
    selection = json.loads((OUT / 'selected-artwork.json').read_text())
    source = ROOT / selection[n - 1]['file']
    assert sha(source) == selection[n - 1]['sha256']
    # 941x1672 is 0.0532% wider than exact 9:16: uniform cover fit removes
    # only sub-pixel background rounding, not a character or meaningful prop.
    return ImageOps.fit(Image.open(source).convert('RGBA'), SIZE, Image.Resampling.LANCZOS)


def balloon_layer(key, speaker, copy):
    n = int(key[:2])
    layer = Image.new('RGBA', SIZE)
    source = Image.open(BALLOON).convert('RGBA')
    # At the park, Jango is on the left and the woman is on the right.
    speaker_left = (speaker == '여성') if n <= 3 else (speaker == '장고')
    if speaker_left:
        source = ImageOps.mirror(source)
    x, y, width, height, cx, cy = PLACEMENT[n]
    layer.alpha_composite(source.resize((width, height), Image.Resampling.LANCZOS), (x, y))
    centered_text(layer, copy, (cx, cy), 72, f'{key} {speaker}', max_width=675)
    return layer


def ending_layer():
    layer = Image.new('RGBA', SIZE)
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((155, 282, 885, 575), radius=50, fill='#FFFDF6F5',
                           outline=GREEN, width=6)
    centered_text(layer, '장고야 부탁해', (520, 383), 83, '07end brand',
                  color=GREEN, max_width=650)
    centered_text(layer, '내 재료로 오늘 메뉴 찾기', (520, 484), 54,
                  '07end single CTA', max_width=660)
    return layer


def active_state(n, local_time):
    return [key for start, key in STATES[n] if start <= local_time][-1]


def zoom_art(art, n, fraction):
    zoom = 1 + .03 * fraction
    ax, ay = ANCHORS[n]
    affine = (1 / zoom, 0, ax * (1 - 1 / zoom), 0, 1 / zoom, ay * (1 - 1 / zoom))
    return art.transform(SIZE, Image.Transform.AFFINE, affine, Image.Resampling.BICUBIC)


def sheet(items, path, columns=4):
    rows = (len(items) + columns - 1) // columns
    canvas = Image.new('RGB', (columns * 360, rows * 680), '#F8F3EA')
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(str(PRETENDARD), 21)
    for i, (name, im) in enumerate(items):
        x, y = i % columns * 360, i // columns * 680
        canvas.paste(im.resize((360, 640), Image.Resampling.LANCZOS), (x, y))
        draw.text((x + 12, y + 646), name, font=font, fill=INK)
    canvas.save(path, quality=95, subsampling=0)


def layout():
    TEXT_BOXES.clear()
    for folder in ['scenes', 'layers', 'reel', 'review/reel']:
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    for n in range(1, 8):
        selected_art(n).save(OUT / f'scenes/{n:02d}.png')
    for key, (speaker, copy) in COPY.items():
        balloon_layer(key, speaker, copy).save(OUT / f'layers/{key}.png')
    ending_layer().save(OUT / 'layers/07end.png')
    previews, ends = [], []
    for n, states in STATES.items():
        art = Image.open(OUT / f'scenes/{n:02d}.png').convert('RGBA')
        for start, key in states:
            overlay = Image.open(OUT / f'layers/{key}.png').convert('RGBA')
            im = Image.alpha_composite(zoom_art(art, n, start / DURATIONS[n-1]), overlay).convert('RGB')
            im.resize((360, 640), Image.Resampling.LANCZOS).save(OUT / f'review/reel/{key}-360.jpg', quality=95)
            previews.append((key, im))
        ends.append((f'{n:02d} · 103%', Image.alpha_composite(zoom_art(art, n, 1), overlay).convert('RGB')))
    sheet(previews, OUT / 'review/reel/layout-overview.jpg')
    sheet(ends, OUT / 'review/reel/zoom-endpoints.jpg')

    # Campsite frame reveals the elaborate setup without spoiling the noodle payoff.
    cover = selected_art(4)
    overlay = Image.new('RGBA', SIZE)
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((160, 426, 900, 668), radius=45,
                           fill='#FFFDF6F5', outline=GREEN, width=6)
    centered_text(overlay, '장고랑 살아보니 09', (530, 478), 48,
                  'cover series', color=GREEN, max_width=680)
    centered_text(overlay, '이 짐에서\n딱 하나 빠짐', (530, 576), 78,
                  'cover hook', max_width=650, gap=0)
    overlay.save(OUT / 'layers/cover.png')
    cover = Image.alpha_composite(cover, overlay).convert('RGB')
    cover.save(OUT / 'cover.jpg', quality=97, subsampling=0)
    cover.resize((360, 640), Image.Resampling.LANCZOS).save(OUT / 'review/reel/cover-360.jpg', quality=95)
    for size, name in [((360, 480), '3x4'), ((360, 360), 'square')]:
        ImageOps.fit(cover, size, Image.Resampling.LANCZOS).save(OUT / f'review/reel/cover-profile-{name}.jpg', quality=95)
    write(OUT / 'reel/typography.json', {
        'safeArea': [96, 280, 900, 1420], 'textBoxes': TEXT_BOXES,
        'dialogueSizePx': 72, 'ellipsisRendering': 'One U+2026 is rendered as three Gaegu periods; spoken wording unchanged.',
        'balloonSource': str(BALLOON.relative_to(ROOT)), 'balloonSha256': sha(BALLOON),
        'balloonPlacements': PLACEMENT, 'speakerSidesReverseAfterScene3': True,
        'coverSha256': sha(OUT / 'cover.jpg')})
    print('Prepared fixed text layers, seven scenes, cover and 360px layout previews.', flush=True)


def run_command(cmd, name):
    write(OUT / f'reel/{name}-command.json', cmd)
    with (OUT / f'reel/{name}.log').open('w') as log:
        subprocess.run(cmd, check=True, stdout=log, stderr=log)


def encode():
    music = json.loads(MUSIC_RECORD.read_text())
    assert sha(ROOT / music['file']) == music['sha256']
    art = {n: Image.open(OUT / f'scenes/{n:02d}.png').convert('RGBA') for n in range(1, 8)}
    layers = {key: Image.open(OUT / f'layers/{key}.png').convert('RGBA')
              for states in STATES.values() for _, key in states}
    with tempfile.TemporaryDirectory(prefix='jango-ep09-render-') as cache:
        silent = Path(cache) / 'silent.mp4'
        cmd = [FFMPEG, '-hide_banner', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
               '-s', '1080x1920', '-r', '30', '-i', '-', '-an', '-c:v', 'libx264',
               '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
               '-movflags', '+faststart', str(silent)]
        write(OUT / 'reel/video-command.json', cmd)
        with (OUT / 'reel/video.log').open('w') as log:
            process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=log, stderr=log)
            try:
                for n, duration in enumerate(DURATIONS, 1):
                    for f in range(duration * FPS):
                        photo = zoom_art(art[n], n, f / (duration * FPS - 1))
                        state = active_state(n, f / FPS)
                        frame = Image.alpha_composite(photo, layers[state]).convert('RGB')
                        process.stdin.write(frame.tobytes())
                    print(f'Rendered scene {n}/7 ({sum(DURATIONS[:n]) * FPS}/1110 frames).', flush=True)
                process.stdin.close()
                if process.wait() != 0:
                    raise RuntimeError('Inspect reel/video.log')
            finally:
                if process.poll() is None:
                    process.terminate()
        # Smooth 80ms fade into the gag pause, 0.7s silence, 100ms return at
        # -8dB, then 200ms recovery on the noodle reveal. No narration.
        gain = ('if(lt(t,18.92),1,if(lt(t,19),(19-t)/0.08,'
                'if(lt(t,19.7),0,if(lt(t,19.8),0.398107*(t-19.7)/0.1,'
                'if(lt(t,29),0.398107,if(lt(t,29.2),'
                '0.398107+(1-0.398107)*(t-29)/0.2,1))))))')
        af = ("atrim=0:37,asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=11,"
              "aresample=48000,asetnsamples=n=480:p=0,volume='" + gain + "':eval=frame,"
              "afade=t=in:st=0:d=0.3,afade=t=out:st=36:d=1")
        final = OUT / 'reel/jango-ep09-music.mp4'
        run_command([FFMPEG, '-hide_banner', '-y', '-i', str(silent),
                     '-i', str(ROOT / music['file']), '-map', '0:v:0', '-map', '1:a:0',
                     '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '192k',
                     '-ar', '48000', '-ac', '2', '-t', '37',
                     '-metadata', 'title=장고랑 살아보니 09 — 준비성은 좋은 편',
                     '-metadata', f'comment={music["requiredCredit"]}',
                     '-movflags', '+faststart', str(final)], 'final')
    run_command([FFMPEG, '-hide_banner', '-y', '-i', str(final),
                 '-vf', 'scale=360:640:flags=lanczos', '-c:v', 'libx264',
                 '-crf', '18', '-preset', 'fast', '-c:a', 'copy', '-movflags', '+faststart',
                 str(OUT / 'review/reel/jango-ep09-360.mp4')], 'proxy')
    write(OUT / 'reel/production.json', {
        'createdAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'format': 'MP4/H.264/yuv420p,1080x1920,30fps,1110 frames,AAC 48kHz stereo',
        'seconds': 37, 'sceneDurations': DURATIONS, 'sceneCuts': CUTS,
        'stateChanges': STATES, 'closingBrandAndCTASeconds': [34, 37],
        'zoom': [1, 1.03], 'zoomAnchors': ANCHORS, 'fixedDialogueLettering': True,
        'narration': False, 'newArtworkGenerated': False,
        'musicSource': music['file'], 'musicSourceSha256': music['sha256'],
        'musicLicenseRecord': str(MUSIC_RECORD.relative_to(ROOT)),
        'musicExcerptSeconds': [0, 37], 'fadeInSeconds': .3, 'fadeOutSeconds': 1,
        'audioTargetLufsBeforeGagEnvelope': -18, 'intentionalSilenceSeconds': [19, 19.7],
        'reducedMusicSeconds': [19.8, 29], 'reducedMusicDb': -8,
        'credit': music['requiredCredit'], 'videoSha256': sha(final),
        'coverSha256': sha(OUT / 'cover.jpg'), 'published': False,
    })
    print('Encoded the 37-second Reel and 360×640 review copy.', flush=True)


if __name__ == '__main__':
    {'layout': layout, 'encode': encode}[sys.argv[1] if len(sys.argv) > 1 else 'layout']()
