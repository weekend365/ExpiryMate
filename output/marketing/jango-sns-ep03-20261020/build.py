"""Episode 3: official artwork + separate Korean lettering + gentle zoom/BGM.

Only typography, proportional layout, approved layer composition, and video
encoding are done here. Artwork/balloon originals stay byte-for-byte intact.
Run with /private/tmp/jango-cartoon-20261020-venv/bin/python.
"""
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
GAEGU = ROOT / "design/jango/emoticons/kakao-32/v18/fonts/Gaegu-Bold.ttf"
UI = ROOT / "apps/mobile/assets/fonts/Pretendard-Bold.otf"
UI_REG = ROOT / "apps/mobile/assets/fonts/Pretendard-Regular.otf"
INK, GREEN = "#514438", "#2D705D"
SIZE = (1080, 1920)
BOXES = []
SCENE = 0
SELECTED = {1: "scene-01-r2.png", 2: "scene-02-r4.png",
            3: "scene-03-r1.png", 4: "scene-04-r1.png"}


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def text(im, copy, center, size, *, font=GAEGU, color=INK,
         gap=16, width=760, role="dialogue", safe=True):
    draw = ImageDraw.Draw(im)
    face = ImageFont.truetype(str(font), size)
    lines = copy.split("\n")
    rendered = [s.replace("…", "...") if font == GAEGU else s for s in lines]
    bounds = [draw.textbbox((0, 0), s, font=face) for s in rendered]
    heights = [b[3] - b[1] for b in bounds]
    y = center[1] - (sum(heights) + gap * (len(lines) - 1)) / 2
    for original, s, b, height in zip(lines, rendered, bounds, heights):
        w = b[2] - b[0]
        assert w <= width, (SCENE, original, w, width)
        x = center[0] - w / 2
        bbox = [round(x), round(y), round(x + w), round(y + height)]
        assert min(bbox) >= 0 and bbox[2] <= im.width and bbox[3] <= im.height, bbox
        if safe:
            assert bbox[0] >= 96 and bbox[1] >= 280 and bbox[2] <= 900 and bbox[3] <= 1420, bbox
        draw.text((round(x - b[0]), round(y - b[1])), s, font=face, fill=color)
        BOXES.append({"scene": SCENE, "canonical": original, "rendered": s,
                      "font": str(font.relative_to(ROOT)), "size": size,
                      "bbox": bbox, "role": role, "fixedToFrame": safe})
        y += height + gap


def balloon(layer, xy, width, *, mirror=False):
    asset = Image.open(OUT / "source-art/balloon-r1.png").convert("RGBA")
    if mirror:
        asset = ImageOps.mirror(asset)
    height = round(asset.height * width / asset.width)
    layer.alpha_composite(asset.resize((width, height), Image.Resampling.LANCZOS), xy)


def project(im, layer, quad):
    a, b = [], []
    src = [(0, 0), (layer.width, 0), (layer.width, layer.height), (0, layer.height)]
    for (x, y), (u, v) in zip(quad, src):
        a += [[x, y, 1, 0, 0, 0, -u*x, -u*y],
              [0, 0, 0, x, y, 1, -v*x, -v*y]]
        b += [u, v]
    coeff = np.linalg.solve(np.asarray(a), np.asarray(b)).tolist()
    warped = layer.transform(im.size, Image.Transform.PERSPECTIVE, coeff,
                             Image.Resampling.BICUBIC)
    im.alpha_composite(warped)
    BOXES.append({"scene": SCENE, "role": "phone typography plane",
                  "quadInSource": quad, "layerSize": list(layer.size),
                  "fixedToFrame": False, "movesWithArtwork": True})


def phone_labels(im):
    screen = Image.new("RGBA", (320, 600))
    d = ImageDraw.Draw(screen)
    text(screen, "장고야 부탁해", (160, 40), 27, font=UI, color=GREEN,
         width=290, role="phone brand", safe=False)
    text(screen, "보관함", (160, 110), 52, font=UI, width=290,
         role="verified feature", safe=False)
    d.line((25, 160, 295, 160), fill="#B1CFC3", width=3)
    d.rounded_rectangle((77, 187, 243, 259), radius=20, fill="#DBF1E5")
    text(screen, "냉동", (160, 223), 47, font=UI, color=GREEN,
         width=150, role="selected real location", safe=False)
    text(screen, "냉동만두", (160, 330), 54, font=UI, width=280,
         role="example ingredient", safe=False)
    text(screen, "1봉", (160, 403), 54, font=UI, color=GREEN,
         width=280, role="example quantity", safe=False)
    text(screen, "이야기용\n예시", (160, 513), 32, font=UI_REG, gap=10,
         width=280, role="example disclosure", safe=False)
    screen.save(OUT / "layers/phone-labels.png")
    # Corners inspected on the selected 941x1672 source. Below notch, above glove.
    project(im, screen, [(185, 527), (451, 527), (455, 987), (186, 989)])


def layout():
    global SCENE
    for folder in ["scenes", "layers", "review", "reel"]:
        (OUT / folder).mkdir(exist_ok=True)
    composites = []
    native_sizes = {}
    for n in range(1, 5):
        SCENE = n
        art = Image.open(OUT / "source-art" / SELECTED[n]).convert("RGBA")
        native_sizes[n] = list(art.size)
        if n == 2:
            phone_labels(art)
        # Native images are near 9:16. Cover trims <2 source px of background.
        art = ImageOps.fit(art, SIZE, Image.Resampling.LANCZOS)
        art.convert("RGB").save(OUT / f"scenes/{n:02}.png")
        layer = Image.new("RGBA", SIZE)
        if n in [1, 3]:
            balloon(layer, (96, 265), 804)
            copy = "꽉 찼는데…\n먹을 게 없네?" if n == 1 else "아! 여기 있었네!"
            text(layer, copy, (498, 438), 82, gap=20, width=680)
        elif n == 2:
            balloon(layer, (110, 205), 790)
            text(layer, "등록해 둔\n재료부터 볼까?", (505, 375), 82, gap=20, width=660)
        else:
            balloon(layer, (96, 305), 460, mirror=True)
            text(layer, "발견자에게\n한 입을!", (326, 406), 72, gap=12, width=370)
            balloon(layer, (492, 455), 408)
            text(layer, "찾은 건\n난데?", (696, 543), 72, gap=12, width=300)
        layer.save(OUT / f"layers/{n:02}-dialogue.png")
        composed = Image.alpha_composite(art, layer).convert("RGB")
        composed.save(OUT / f"review/{n:02}-start.png")
        composed.resize((360, 640), Image.Resampling.LANCZOS).save(OUT / f"review/{n:02}-360.png")
        composites.append(composed)
        if n == 4:
            cta = Image.new("RGBA", SIZE)
            balloon(cta, (96, 240), 804)
            text(cta, "장고야 부탁해", (498, 340), 96, color=GREEN, role="brand")
            text(cta, "냉동실 재료도,\n보관함에서 확인해요.", (498, 470), 64,
                 gap=18, width=760, role="single CTA")
            cta.save(OUT / "layers/04-cta.png")
            end = Image.alpha_composite(art, cta).convert("RGB")
            end.save(OUT / "review/04-end.png")
            end.resize((360, 640), Image.Resampling.LANCZOS).save(OUT / "review/04-end-360.png")
    SCENE = "cover"
    cover = Image.open(OUT / "scenes/03.png").convert("RGBA")
    cover_layer = Image.new("RGBA", SIZE)
    balloon(cover_layer, (96, 265), 804)
    text(cover_layer, "장고랑 살아보니 03", (498, 371), 48, color=GREEN,
         width=680, role="cover series")
    text(cover_layer, "냉동실 보물찾기", (498, 473), 100, color=GREEN,
         width=720, role="cover title")
    cover = Image.alpha_composite(cover, cover_layer).convert("RGB")
    cover_layer.save(OUT / "layers/cover.png")
    cover.save(OUT / "cover.png")
    cover.save(OUT / "cover.jpg", quality=97, subsampling=0)
    cover.resize((360, 640), Image.Resampling.LANCZOS).save(OUT / "review/cover-360.png")
    ImageOps.fit(cover, (360, 480), Image.Resampling.LANCZOS).save(OUT / "review/cover-profile-3x4.jpg", quality=95)
    ImageOps.fit(cover, (360, 360), Image.Resampling.LANCZOS).save(OUT / "review/cover-profile-square.jpg", quality=95)
    sheet = Image.new("RGB", (1440, 640), "#F7F0E3")
    for i, im in enumerate(composites):
        sheet.paste(im.resize((360, 640), Image.Resampling.LANCZOS), (i * 360, 0))
    sheet.save(OUT / "review/storyboard-360.jpg", quality=97, subsampling=0)
    write_json(OUT / "typography-report.json", {
        "method": "Official generated transparent balloon; Gaegu separate fixed dialogue/brand; Pretendard projected labels travel with phone artwork.",
        "ellipsis": "Gaegu source lacks visible U+2026; three period glyphs render the canonical ellipsis, as in episode 2.",
        "fonts": {str(p.relative_to(ROOT)): sha(p) for p in [GAEGU, UI, UI_REG]},
        "nativeSizesByScene": native_sizes, "output": list(SIZE),
        "framing": "Uniform proportional cover, less than 2 source pixels of background rounding crop; no stretched artwork.",
        "phoneCanonical": "보관함 / 냉동 / 냉동만두 · 1봉 / 이야기용 예시",
        "textBoxes": BOXES})
    print("Layout, cover, mobile proofs and typography measurements ready.", flush=True)


def run(cmd, name):
    write_json(OUT / "reel" / (name + "-command.json"), cmd)
    with (OUT / "reel" / (name + ".log")).open("w") as log:
        subprocess.run(cmd, check=True, stdout=log, stderr=log)


def encode(start_scene=1):
    for n in range(start_scene, 5):
        cmd = [FFMPEG, "-hide_banner", "-y", "-loop", "1", "-framerate", "30",
               "-i", str(OUT / f"scenes/{n:02}.png"), "-loop", "1", "-framerate", "30",
               "-i", str(OUT / f"layers/{n:02}-dialogue.png")]
        if n == 4:
            cmd += ["-loop", "1", "-framerate", "30", "-i", str(OUT / "layers/04-cta.png")]
        graph = ("[0:v]scale=2160:3840:flags=lanczos,"
                 "zoompan=z='min(1.03,1+0.03*on/179)':x='(iw-iw/zoom)*0.6':"
                 "y='ih-ih/zoom':d=1:s=1080x1920:fps=30,format=rgba[bg];")
        if n == 4:
            graph += "[bg][1:v]overlay=0:0:enable='lt(t,3)'[speech];[speech][2:v]overlay=0:0:enable='gte(t,3)'[v]"
        else:
            graph += "[bg][1:v]overlay=0:0[v]"
        cmd += ["-filter_complex", graph, "-map", "[v]", "-an", "-frames:v", "180",
                "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart",
                str(OUT / f"reel/scene-{n:02}.mp4")]
        run(cmd, f"scene-{n:02}")
        print(f"Encoded scene {n}/4.", flush=True)
    (OUT / "reel/concat.txt").write_text("".join(f"file 'scene-{n:02}.mp4'\n" for n in range(1, 5)))
    cmd = [FFMPEG, "-hide_banner", "-y", "-f", "concat", "-safe", "0",
           "-i", str(OUT / "reel/concat.txt"), "-i", str(OUT / "music/Carefree.mp3"),
           "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
           "-af", "atrim=0:24,asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:st=0:d=0.3,afade=t=out:st=23:d=1",
           "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", "24",
           "-movflags", "+faststart", str(OUT / "reel/jango-ep03-music.mp4")]
    run(cmd, "final")
    run([FFMPEG, "-hide_banner", "-y", "-i", str(OUT / "reel/jango-ep03-music.mp4"),
         "-vf", "scale=360:640:flags=lanczos", "-c:v", "libx264", "-crf", "18",
         "-preset", "fast", "-c:a", "copy", "-movflags", "+faststart",
         str(OUT / "review/jango-ep03-360.mp4")], "proxy")
    write_json(OUT / "reel/production.json", {
        "format": "MP4/H.264, 1080x1920, 30fps, 720 video frames, AAC 48kHz",
        "seconds": 24, "selectedArtwork": SELECTED, "zoomEachScene": [1, 1.03],
        "zoomAnchorNormalized": [0.6, 1.0], "transition": "hard cuts at 6, 12, 18 seconds",
        "lettering": "Fixed speech overlays, scene 4 switched to fixed brand/CTA at 21 seconds; phone labels move with underlying art.",
        "music": {"track": "Carefree", "artist": "Kevin MacLeod", "license": "CC BY 4.0",
                  "source": "music/license.json", "segment": [0, 24], "targetLUFS": -18,
                  "truePeakLimit": -2, "fades": [0.3, 1]},
        "software": subprocess.run([FFMPEG, "-version"], capture_output=True, text=True).stdout.splitlines()[0],
        "videoSHA256": sha(OUT / "reel/jango-ep03-music.mp4")})
    print("Final 24-second Reel and 360px review video ready.", flush=True)


if __name__ == "__main__":
    if len(sys.argv) == 1 or sys.argv[1] == "layout":
        layout()
    elif sys.argv[1] == "encode":
        encode(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
