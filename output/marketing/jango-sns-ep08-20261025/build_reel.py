"""Compose episode 8 from selected original art, fixed Korean lettering and licensed BGM.

Run: python build_reel.py layout | encode
The seven imagegen originals are read-only inputs; no new character artwork is made here.
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
SIZE = (1080, 1920)
FPS = 30
GAEGU = ROOT / 'design/jango/emoticons/kakao-32/v18/fonts/Gaegu-Bold.ttf'
PRETENDARD = ROOT / 'apps/mobile/assets/fonts/Pretendard-Regular.otf'
BALLOON = ROOT / 'output/marketing/jango-sns-ep03-20261020/source-art/balloon-r1.png'
LICENSE = ROOT / 'design/jango/audio/monkeys-spinning-monkeys/license.json'
MUSIC = json.loads(LICENSE.read_text())
INK, GREEN = '#514438', '#28674F'
DURATIONS = [5, 5, 5, 6, 6, 6, 7]
CUTS = [5, 10, 15, 21, 27, 33]
STATES = {
    1: [(0, '01w'), (2.8, '01j')],
    2: [(0, '02w'), (1.3, '02ai'), (2.6, '02r')],
    3: [(0, '03j'), (2.6, '03w')],
    4: [(0, '04w'), (1.6, '04ai'), (3.0, '04r')],
    5: [(0, '05w'), (3.7, '05j')],
    6: [(0, '06w'), (4.0, '06j')],
    7: [(0, '07w'), (2.5, '07j'), (4.0, '07end')],
}
COPY = {
    '01w': ('여성', 'AI가 나를 한 단어로\n표현해 준대.\n나도 해볼까?'),
    '01j': ('장고', '좋아. 내가 옆에서\n확인해 줄게.'),
    '02w': ('여성', '내 장점은?'),
    '02ai': ('AI', '상상력.'),
    '02r': ('여성', '역시. 나 아이디어는\n진짜 많잖아.'),
    '03j': ('장고', '맞아. 냉장고 정리\n계획도 엄청 자세하지.'),
    '03w': ('여성', '그건 제대로 하려고\n준비 중인 거야.'),
    '04w': ('여성', '그럼 내 단점은?'),
    '04ai': ('AI', '미루기.'),
    '04r': ('여성', '잠깐. 이건 좀\n억울한데?'),
    '05w': ('여성', '할 일 순서를\n정하는 거랑 미루는 건\n다르지.'),
    '05j': ('장고', '그럼 그렇게\n설명해 봐.'),
    '06w': ('여성', '좋아. 아닌 이유\n세 가지로 딱 정리해서\n보내야겠다.'),
    '06j': ('장고', '언제?'),
    '07w': ('여성', '내일. 오늘은\n일단 좀 쉬고.'),
    '07j': ('장고', '…정확하네.'),
}
TEXT_BOXES = []


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def centered_text(im, lines, center, size, role, *, font_path=GAEGU, color=INK,
                  max_width=720, gap=12, safe=True):
    draw = ImageDraw.Draw(im)
    font = ImageFont.truetype(str(font_path), size)
    logical = lines.split('\n')
    rendered = [line.replace('…', '...') if font_path == GAEGU else line for line in logical]
    bounds = [draw.textbbox((0, 0), line, font=font) for line in rendered]
    heights = [box[3] - box[1] for box in bounds]
    y = center[1] - (sum(heights) + gap * (len(logical) - 1)) / 2
    for original, line, box, height in zip(logical, rendered, bounds, heights):
        width = box[2] - box[0]
        assert width <= max_width, (role, original, width, max_width)
        x = center[0] - width / 2
        rect = [round(x), round(y), round(x + width), round(y + height)]
        if safe:
            assert rect[0] >= 96 and rect[1] >= 280 and rect[2] <= 900 and rect[3] <= 1420, (role, rect)
        draw.text((round(x - box[0]), round(y - box[1])), line, font=font, fill=color)
        TEXT_BOXES.append({'role': role, 'text': original, 'bbox': rect,
                           'font': str(font_path.relative_to(ROOT)), 'sizePx': size,
                           'fixedToFrame': role != 'fictional phone UI'})
        y += height + gap


def selected_art(n):
    selection = json.loads((OUT / 'selected-artwork.json').read_text())
    source = ROOT / selection['scenes'][n - 1]['file']
    assert sha(source) == selection['scenes'][n - 1]['sha256']
    # 941x1672 differs from 9:16 by less than one input pixel. Uniform cover
    # fit trims ratio rounding in the background; no characters are stretched.
    return ImageOps.fit(Image.open(source).convert('RGBA'), SIZE, Image.Resampling.LANCZOS)


def balloon_layer(key, speaker, copy):
    layer = Image.new('RGBA', SIZE)
    source = Image.open(BALLOON).convert('RGBA')
    # The tail points toward the woman on the left or Jango on the right.
    if speaker == '여성':
        source = ImageOps.mirror(source)
    width = 810
    layer.alpha_composite(source.resize((width, round(source.height * width / source.width)),
                                        Image.Resampling.LANCZOS), (130, 246))
    centered_text(layer, copy, (530, 412), 72, f'{key} {speaker}', max_width=675, gap=13)
    return layer


def ai_layer(key, answer):
    layer = Image.new('RGBA', SIZE)
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((178, 280, 880, 540), radius=45, fill='#FFFDF6F4',
                           outline=GREEN, width=7)
    centered_text(layer, '이야기 속 AI 대화', (529, 346), 43, f'{key} fictional-chat label',
                  font_path=PRETENDARD, color=GREEN, max_width=550)
    centered_text(layer, answer, (529, 454), 91, f'{key} AI answer',
                  font_path=PRETENDARD, color=INK, max_width=520)
    return layer


def ending_layer():
    layer = Image.new('RGBA', SIZE)
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((175, 278, 885, 575), radius=52, fill='#FFFDF6F2',
                           outline=GREEN, width=7)
    centered_text(layer, '장고야 부탁해', (530, 378), 83, '07end brand', color=GREEN,
                  max_width=650)
    centered_text(layer, '장고의 다음 일상도\n함께해요', (530, 485), 57,
                  '07end single CTA', color=INK, max_width=660, gap=4)
    return layer


def phone_art(n, reveal):
    art = selected_art(n)
    draw = ImageDraw.Draw(art)
    if n == 2:
        x, top, width = 374, 1057, 176
        question, answer = '내 장점은?', '상상력'
        qy, ay = 1157, 1250
    else:
        x, top, width = 481, 1068, 133
        question, answer = '내 단점은?', '미루기'
        qy, ay = 1134, 1202
    # Text belongs to the physical prop, so it is enlarged with the artwork.
    # The leading label explicitly says this is story-only AI dialogue.
    centered_text(art, 'AI 대화', (x, top), 25, 'fictional phone UI',
                  font_path=PRETENDARD, color=GREEN, max_width=width, safe=False)
    centered_text(art, question, (x, qy), 27 if n == 2 else 24,
                  'fictional phone UI', font_path=PRETENDARD, max_width=width, safe=False)
    if reveal:
        draw.rounded_rectangle((x - width//2, ay - 38, x + width//2, ay + 44),
                               radius=18, fill='#D7F4E9')
        centered_text(art, answer, (x, ay), 43 if n == 2 else 35,
                      'fictional phone UI', font_path=PRETENDARD, color=GREEN,
                      max_width=width - 15, safe=False)
    return art


def active_state(n, local_time):
    return [key for start, key in STATES[n] if start <= local_time][-1]


def layout():
    for folder in ['scenes', 'layers', 'reel', 'review/reel']:
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    for n in range(1, 8):
        selected_art(n).save(OUT / f'scenes/{n:02d}.png')
        if n in (2, 4):
            phone_art(n, False).save(OUT / f'scenes/{n:02d}-question.png')
            phone_art(n, True).save(OUT / f'scenes/{n:02d}-answer.png')
    for key, (speaker, copy) in COPY.items():
        layer = ai_layer(key, copy) if speaker == 'AI' else balloon_layer(key, speaker, copy)
        layer.save(OUT / f'layers/{key}.png')
    ending_layer().save(OUT / 'layers/07end.png')

    previews = []
    for n in range(1, 8):
        for _, key in STATES[n]:
            if n in (2, 4):
                suffix = 'question' if key.endswith('w') else 'answer'
                photo = Image.open(OUT / f'scenes/{n:02d}-{suffix}.png').convert('RGBA')
            else:
                photo = Image.open(OUT / f'scenes/{n:02d}.png').convert('RGBA')
            layer = Image.open(OUT / f'layers/{key}.png').convert('RGBA')
            image = Image.alpha_composite(photo, layer).convert('RGB')
            image.resize((360, 640), Image.Resampling.LANCZOS).save(
                OUT / f'review/reel/{key}-360.jpg', quality=95)
            previews.append((key, image.resize((360, 640), Image.Resampling.LANCZOS)))
    sheet = Image.new('RGB', (4 * 360, 5 * 680), '#F8F3EA')
    draw = ImageDraw.Draw(sheet)
    label_font = ImageFont.truetype(str(PRETENDARD), 22)
    for i, (key, image) in enumerate(previews):
        x, y = (i % 4) * 360, (i // 4) * 680
        sheet.paste(image, (x, y))
        draw.text((x + 12, y + 645), key, font=label_font, fill=INK)
    sheet.save(OUT / 'review/reel/layout-overview.jpg', quality=95)

    cover = selected_art(7)
    overlay = Image.new('RGBA', SIZE)
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((180, 455, 880, 655), radius=45, fill='#FFFDF6F3',
                           outline=GREEN, width=6)
    centered_text(overlay, '장고랑 살아보니 08', (530, 500), 49, 'cover series',
                  color=GREEN, max_width=630)
    centered_text(overlay, 'AI한테 반박하려다가', (530, 570), 80, 'cover title',
                  max_width=650)
    overlay.save(OUT / 'layers/cover.png')
    cover = Image.alpha_composite(cover, overlay).convert('RGB')
    cover.save(OUT / 'cover.jpg', quality=97, subsampling=0)
    cover.resize((360, 640), Image.Resampling.LANCZOS).save(
        OUT / 'review/reel/cover-360.jpg', quality=96)
    for size, name in [((360, 480), '3x4'), ((360, 360), 'square')]:
        ImageOps.fit(cover, size, Image.Resampling.LANCZOS).save(
            OUT / f'review/reel/cover-profile-{name}.jpg', quality=96)

    source_rows = json.loads((OUT / 'selected-artwork.json').read_text())['scenes']
    extras = [(BALLOON, 'prior approved balloon'), (GAEGU, 'dialogue font'),
              (PRETENDARD, 'fictional phone UI font'), (ROOT / MUSIC['file'], 'default BGM'),
              (LICENSE, 'music license'),
              (ROOT / 'design/jango/reference/SNS-CARTOON-GUIDE.md', 'canonical guide')]
    sources = [{'file': row['file'], 'sha256': row['sha256'], 'role': f'scene {row["scene"]}'}
               for row in source_rows]
    sources.extend({'file': str(path.relative_to(ROOT)), 'sha256': sha(path), 'role': role}
                   for path, role in extras)
    write(OUT / 'reel/preparation.json', {
        'preparedAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'authority': {'quote': '릴스로 만들어서 인스타그램에 게시해줘.',
                      'scope': 'Adopt the seven selected episode-8 art scenes for one 40-second Reel and publish it on @jango_plz; no commit or push.'},
        'sources': sources, 'size': list(SIZE), 'fps': FPS,
        'durationSeconds': sum(DURATIONS), 'sceneDurations': DURATIONS,
        'cutSeconds': CUTS, 'dialogueStates': STATES,
        'music': MUSIC['requiredCredit'],
        'screenDisclosure': 'The AI chat and phone UI are fictional props, not a Jango app feature.',
        'method': 'Uniform 9:16 fit; per-scene gentle zoom of artwork/phone screen; fixed Gaegu speech balloons and CTA; hard cuts; licensed instrumental BGM.'
    })
    write(OUT / 'reel/typography.json', {'safeArea': [96, 280, 900, 1420],
                                        'textBoxes': TEXT_BOXES,
                                        'phoneUI': 'Pretendard text moves with physical phone',
                                        'balloonSha256': sha(BALLOON),
                                        'coverSha256': sha(OUT / 'cover.jpg')})
    print(f'Composed seven scenes, {len(previews)} timed text states and a cover.', flush=True)


def run_command(args, name):
    write(OUT / f'reel/{name}-command.json', args)
    with (OUT / f'reel/{name}.log').open('w') as log:
        subprocess.run(args, check=True, stdout=log, stderr=log)


def encode():
    prep = json.loads((OUT / 'reel/preparation.json').read_text())
    for row in prep['sources']:
        assert sha(ROOT / row['file']) == row['sha256'], row['file']
    art = {}
    for n in range(1, 8):
        art[(n, None)] = Image.open(OUT / f'scenes/{n:02d}.png').convert('RGBA')
        if n in (2, 4):
            for variant in ['question', 'answer']:
                art[(n, variant)] = Image.open(OUT / f'scenes/{n:02d}-{variant}.png').convert('RGBA')
    layers = {key: Image.open(OUT / f'layers/{key}.png').convert('RGBA')
              for states in STATES.values() for _, key in states}
    with tempfile.TemporaryDirectory(prefix='jango-ep08-render-') as cache:
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
                        state = active_state(n, f / FPS)
                        variant = None
                        if n in (2, 4):
                            variant = 'question' if state.endswith('w') else 'answer'
                        zoom = 1 + .03 * f / (duration * FPS - 1)
                        ax, ay = 540, 1040
                        affine = (1 / zoom, 0, ax * (1 - 1 / zoom),
                                  0, 1 / zoom, ay * (1 - 1 / zoom))
                        photo = art[(n, variant)].transform(SIZE, Image.Transform.AFFINE,
                                                            affine, Image.Resampling.BICUBIC)
                        frame = Image.alpha_composite(photo, layers[state]).convert('RGB')
                        process.stdin.write(frame.tobytes())
                    print(f'Rendered scene {n}/7 ({sum(DURATIONS[:n]) * FPS}/1200 frames).', flush=True)
                process.stdin.close()
                if process.wait() != 0:
                    raise RuntimeError('FFmpeg video encoder failed; inspect reel/video.log')
            finally:
                if process.poll() is None:
                    process.terminate()
        final = OUT / 'reel/jango-ep08-music.mp4'
        run_command([FFMPEG, '-hide_banner', '-y', '-i', str(silent),
                     '-i', str(ROOT / MUSIC['file']), '-map', '0:v:0', '-map', '1:a:0',
                     '-c:v', 'copy', '-af',
                     'atrim=0:40,asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:st=0:d=0.3,afade=t=out:st=39:d=1',
                     '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '40',
                     '-metadata', 'title=장고랑 살아보니 08 — AI한테 반박하려다가',
                     '-metadata', f'comment={MUSIC["requiredCredit"]}',
                     '-movflags', '+faststart', str(final)], 'final')
    run_command([FFMPEG, '-hide_banner', '-y', '-i', str(final),
                 '-vf', 'scale=360:640:flags=lanczos', '-c:v', 'libx264',
                 '-crf', '18', '-preset', 'fast', '-c:a', 'copy',
                 '-movflags', '+faststart', str(OUT / 'review/reel/jango-ep08-360.mp4')], 'proxy')
    write(OUT / 'reel/production.json', {
        'createdAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'format': 'MP4/H.264/yuv420p,1080x1920,30fps,1200 frames,AAC 48kHz stereo',
        'seconds': 40, 'sceneDurations': DURATIONS, 'sceneCuts': CUTS,
        'stateChanges': STATES, 'closingBrandAndCTASeconds': [37, 40],
        'zoom': [1, 1.03], 'fixedDialogueLettering': True,
        'phoneScreenMovesWithArt': True, 'narration': False,
        'newArtworkGenerated': False, 'musicSource': MUSIC['file'],
        'musicSourceSha256': MUSIC['sha256'], 'musicLicenseRecord': str(LICENSE.relative_to(ROOT)),
        'musicExcerptSeconds': [0, 40], 'fadeInSeconds': .3,
        'fadeOutSeconds': 1, 'audioTargetLufs': -18,
        'credit': MUSIC['requiredCredit'], 'videoSha256': sha(final),
        'coverSha256': sha(OUT / 'cover.jpg'),
    })
    print('Encoded 40-second Reel and 360×640 review copy.', flush=True)


if __name__ == '__main__':
    if len(sys.argv) == 1 or sys.argv[1] == 'layout':
        layout()
    elif sys.argv[1] == 'encode':
        encode()
    else:
        raise SystemExit('Use layout or encode.')
