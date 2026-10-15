"""Typography overlays + unchanged source audio for the supplied promo video."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageOps

OUT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("followup_graphics", OUT / "build.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SOURCE = Path("/Users/namu/Downloads/dreamina-2026-09-15-6281-세로 9_16, 정확히 12초 길이의 한국어 앱 광고 영상을 제작한다. ....mp4")
EXPECTED_SHA = "8a684ade77c7549ad48dd7b35bfb80d5fefec1643041bd63c0c6b074976af9c1"
assert g.sha(SOURCE) == EXPECTED_SHA
POST = OUT / "03-reel-edit"
POST.mkdir(exist_ok=True)
WORK = Path("/private/tmp/jango-followup-video-20261015")
WORK.mkdir(exist_ok=True)


def plate(number, rect, lines):
    g.CURRENT = f"03-reel-edit/overlay-{number:02}.png"
    im = Image.new("RGBA", (1080, 1920))
    d = ImageDraw.Draw(im)
    rgb = tuple(bytes.fromhex(g.IVORY[1:]))
    d.rounded_rectangle(rect, radius=24, fill=(*rgb, 242))
    for xy, copy, size, weight, color in lines:
        g.text(im, xy, copy, size, color, weight)
        for line in copy.split("\n"):
            assert g.font(size, weight).getlength(line) <= rect[2]-xy[0]-30
    path = WORK / f"overlay-{number:02}.png"
    im.save(path, optimize=True)
    return path


overlays = [
    plate(1, (88, 1160, 992, 1400), [((126, 1203), "냉장고에 재료는 있는데,\n오늘 뭐 먹지?", 62, "Bold", g.INK)]),
    plate(2, (88, 130, 992, 265), [((126, 167), "재료와 유통기한을 챙기고", 62, "Bold", g.INK)]),
    plate(3, (88, 130, 992, 265), [((126, 167), "내 재료로 만들 요리 추천", 62, "Bold", g.INK)]),
    plate(4, (88, 1105, 900, 1399), [((126, 1145), "장고야 부탁해", 68, "Bold", g.GREEN), ((126, 1252), "프로필에서 iPhone · Android\n다운로드", 48, "SemiBold", g.INK)]),
]
output = POST / "jango-fridge-to-meal.mp4"
timeline = [(0, 2.4), (2.4, 5.8), (5.8, 9.6), (9.6, 12.1)]
cmd = [FFMPEG, "-hide_banner", "-y", "-i", str(SOURCE)]
for path in overlays:
    cmd += ["-loop", "1", "-framerate", "30", "-i", str(path)]
filters = ["[0:v]fps=30[base]"]
last = "base"
for i, (start, end) in enumerate(timeline, 1):
    tag = f"v{i}"
    filters.append(f"[{last}][{i}:v]overlay=0:0:enable='gte(t,{start})*lt(t,{end})'[{tag}]")
    last = tag
filters.append(f"[{last}]format=yuv420p[final]")
cmd += ["-filter_complex", ";".join(filters), "-map", "[final]", "-map", "0:a:0", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "copy", "-t", "12.1", "-movflags", "+faststart", str(output)]
p = subprocess.run(cmd, capture_output=True, text=True)
(WORK / "encode.log").write_text(p.stderr)
assert p.returncode == 0, p.stderr[-3000:]

# Dedicated graphic cover; existing full Jango derivative placed proportionally.
g.CURRENT = "03-reel-edit/cover.png"
cover = Image.new("RGB", (1080, 1920), g.IVORY)
d = ImageDraw.Draw(cover)
g.text(cover, (88, 310), "장고야 부탁해", 48, g.GREEN)
d.line((88, 407, 992, 407), fill=g.SOFT, width=3)
g.text(cover, (88, 535), "냉장고 속 재료로,", 83)
g.text(cover, (88, 658), "오늘의 한 끼", 102, g.GREEN)
g.text(cover, (88, 1009), "재료 관리부터\n요리 추천까지", 54, g.INK, "Medium")
g.mascot(cover, "cooking", (405, 889), 650)
d.line((88, 1630, 992, 1630), fill=g.SOFT, width=3)
g.text(cover, (88, 1690), "프로필에서 앱 다운로드", 48, g.GREEN)
cover.save(POST / "cover.png", optimize=True)
cover.save(POST / "cover.jpg", quality=98, subsampling=0)
ImageOps.fit(cover, (360, 480), Image.Resampling.LANCZOS).save(OUT / "review/03-reel-cover-grid.jpg", quality=96)

# Decode the whole video and verify preserved audio using decoded PCM bytes.
decode = subprocess.run([FFMPEG,"-v","error","-i",str(output),"-f","null","-"],capture_output=True,text=True)
assert decode.returncode == 0 and not decode.stderr.strip(), decode.stderr


def audio_hash(path):
    r = subprocess.run([FFMPEG,"-v","error","-i",str(path),"-map","0:a:0","-f","s16le","-acodec","pcm_s16le","-"],capture_output=True)
    assert r.returncode == 0, r.stderr
    return hashlib.sha256(r.stdout).hexdigest(), len(r.stdout)


audio_original = audio_hash(SOURCE)
audio_edited = audio_hash(output)
assert audio_original == audio_edited, (audio_original, audio_edited)

times = [0, 1.5, 2.4, 4.5, 5.8, 7.5, 9.6, 11.4]
sheet = Image.new("RGB", (360*4, (640+40)*2), "white")
for i,t in enumerate(times):
    target = WORK / f"review-{i:02}.png"
    r = subprocess.run([FFMPEG,"-v","error","-y","-ss",str(t),"-i",str(output),"-frames:v","1",str(target)],capture_output=True)
    assert r.returncode == 0
    frame = Image.open(target).convert("RGB").resize((360,640),Image.Resampling.LANCZOS)
    x=(i%4)*360;y=(i//4)*680
    sheet.paste(frame,(x,y))
    ImageDraw.Draw(sheet).text((x+12,y+650),f"{t:.1f}s",fill="black",font=g.font(22))
sheet.save(OUT / "review/03-reel-360.jpg",quality=97)

black = subprocess.run([FFMPEG,"-hide_banner","-i",str(output),"-vf","blackdetect=d=0.04:pix_th=0.06","-an","-f","null","-"],capture_output=True,text=True)
assert "black_start:" not in black.stderr
assert g.sha(SOURCE) == EXPECTED_SHA
record={"source":{"path":str(SOURCE),"sha256":EXPECTED_SHA,"bytes":SOURCE.stat().st_size,"originalPreserved":True},"output":{"file":output.name,"sha256":g.sha(output),"width":1080,"height":1920,"durationSeconds":12.1,"frameRate":30,"videoCodec":"H.264 High, CRF18, yuv420p","audio":"Original AAC stream copied"},"edit":"Original shot sequence and timing retained; direct Pretendard promotional text overlays; no scene redraw, speed change or new audio","timeline":[{"start":a,"end":b,"overlaySha256":g.sha(p)} for (a,b),p in zip(timeline,overlays)],"overlayTextBounds":g.TEXT_BOXES,"sources":g.SOURCES,"verification":{"fullVideoDecode":"passed","blackFrames":"none detected at >=0.04 seconds","sourceAndOutputPcmSha256":audio_original[0],"decodedPcmBytes":audio_original[1],"audioIdentical":True,"sampleTimes":times,"visualReview":"pending"},"cover":{"file":"cover.png","sha256":g.sha(POST/'cover.png')}}
record["cover"].update({"uploadFile":"cover.jpg","uploadSha256":g.sha(POST/'cover.jpg'),"conversion":"JPEG quality 98, subsampling 0; same 1080x1920 layout"})
(POST / "production-record.json").write_text(json.dumps(record,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"file":str(output),"audioIdentical":True,"fullDecode":True,"bytes":output.stat().st_size},ensure_ascii=False))
