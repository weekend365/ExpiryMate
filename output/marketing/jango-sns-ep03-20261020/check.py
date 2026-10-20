"""Decode and inspect the exported media; keep visual/listening review separate."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
FF = imageio_ffmpeg.get_ffmpeg_exe()
VIDEO = OUT / "reel/jango-ep03-music.mp4"
result = subprocess.run(
    [FF, "-hide_banner", "-i", str(VIDEO), "-vf", "blackdetect=d=0.03:pix_th=0.08",
     "-af", "astats=metadata=0:reset=0,silencedetect=noise=-50dB:d=0.5",
     "-progress", "pipe:1", "-f", "null", "-"], capture_output=True, text=True)
(OUT / "review/decode.log").write_text(result.stderr)
assert result.returncode == 0, result.stderr
assert "black_start:" not in result.stderr
frames = [int(n) for n in re.findall(r"^frame=(\d+)$", result.stdout, re.M)]
assert frames[-1] == 720, frames
assert "1080x1920" in result.stderr and "30 fps" in result.stderr
audio = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-i", str(VIDEO),
                        "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"],
                       capture_output=True, check=True).stdout
samples = np.frombuffer(audio, dtype="<f4")
def db(x):
    return round(20 * np.log10(max(1e-12, float(x))), 2)
times = [0, 3, 5.96, 6, 9, 11.96, 12, 15, 17.96, 18, 19.5, 20.96, 21, 22.5, 23.96]
stills = []
for i, t in enumerate(times):
    target = OUT / f"review/playback-{i:02}.jpg"
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(t),
                    "-i", str(VIDEO), "-frames:v", "1", "-pix_fmt", "yuvj420p",
                    "-q:v", "2", str(target)], check=True)
    frame = Image.open(target).convert("RGB")
    assert frame.size == (1080, 1920)
    stills.append(frame)
font = ImageFont.truetype(str(ROOT / "apps/mobile/assets/fonts/Pretendard-Regular.otf"), 20)
for group in range(3):
    sheet = Image.new("RGB", (1800, 678), "#FFFFFF")
    draw = ImageDraw.Draw(sheet)
    for col in range(5):
        i = group * 5 + col
        sheet.paste(stills[i].resize((360, 640), Image.Resampling.LANCZOS), (col * 360, 38))
        draw.text((col * 360 + 10, 7), f"{times[i]:.3f}s", font=font, fill="#333333")
    sheet.save(OUT / f"review/playback-sheet-{group+1}.jpg", quality=96, subsampling=0)
subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", str(VIDEO),
                "-vn", "-c:a", "libmp3lame", "-b:a", "96k", "-ac", "1",
                str(OUT / "review/audio-review.mp3")], check=True)
baseline = json.loads((OUT / "preservation-baseline.json").read_text())
changed = [p for p, h in baseline.items()
           if hashlib.sha256((ROOT / p).read_bytes()).hexdigest() != h]
assert not changed, changed
report = {
    "fullDecode": "passed", "videoFrames": frames[-1], "videoSeconds": frames[-1] / 30,
    "dimensions": [1080, 1920], "fps": 30, "blackFrameIntervals": [],
    "audioDecodedSecondsIncludingAACPadding": round(len(samples) / 48000, 3),
    "audioPeakDbFS": db(np.max(np.abs(samples))),
    "audioRMSDbFS": db(np.sqrt(np.mean(samples * samples))),
    "clippedSamples": int(np.sum(np.abs(samples) >= 1)),
    "audioRMSPerSecondDbFS": [db(np.sqrt(np.mean(samples[i*48000:(i+1)*48000]**2))) for i in range(24)],
    "silenceIntervalsReported": re.findall(r"silence_(?:start|end):[^\n]+", result.stderr),
    "frameReviewTimes": times, "visualReview": "pending", "fullListening": "pending",
    "protectedFilesChecked": len(baseline), "protectedFilesChanged": changed,
    "videoSHA256": hashlib.sha256(VIDEO.read_bytes()).hexdigest(),
    "coverSHA256": hashlib.sha256((OUT / "cover.png").read_bytes()).hexdigest(),
}
assert report["clippedSamples"] == 0
(OUT / "review/technical-quality.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(report, ensure_ascii=False))
