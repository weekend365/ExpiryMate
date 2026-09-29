#!/usr/bin/env python3
"""Deterministic typography + approved Jango assets, with shared color inputs.

Requires Pillow 11.3.0. --check renders in memory and rejects stale deliverables.
"""
import argparse
import hashlib
import io
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TOKENS = json.loads(subprocess.check_output([
    "node", "--input-type=module", "-e",
    "import {semanticColors} from '@expirymate/shared'; console.log(JSON.stringify(semanticColors))"
], cwd=ROOT, text=True))
FONT_DIR = ROOT / "assets/fonts"

def font(size, weight="Bold"):
    return ImageFont.truetype(str(FONT_DIR / f"Pretendard-{weight}.otf"), size)

def text(draw, xy, value, size, color, weight="Bold", center=False):
    f = font(size, weight)
    if center:
        width = draw.textlength(value, font=f)
        xy = (xy[0] - width / 2, xy[1])
    draw.text(xy, value, fill=color, font=f, stroke_width=0)

def mascot(canvas, mood, size, xy):
    source_root = ROOT.parents[1] / "design/jango"
    manifest = json.loads((source_root / "manifest.json").read_text())
    entry = next(pose for pose in manifest["poses"] if pose["mood"] == mood)
    source_path = source_root / entry["source"]
    if hashlib.sha256(source_path.read_bytes()).hexdigest() != entry["sha256"]:
        raise ValueError(f"Unreviewed source change: {mood}")
    source = Image.open(source_path).convert("RGBA")
    if size > source.width:
        raise ValueError("Store artwork must not upscale its production source")
    source = source.resize((size, size), Image.Resampling.LANCZOS)
    canvas.paste(source, xy, source)

def feature():
    canvas = Image.new("RGB", (1024, 500), TOKENS["background"])
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((610, 48, 972, 456), radius=96, fill=TOKENS["primarySoft"])
    text(draw, (46, 98), "장고야 부탁해", 24, TOKENS["primaryForeground"])
    text(draw, (44, 175), "냉장고 속 식재료,", 46, TOKENS["text"])
    text(draw, (44, 239), "잊기 전에 챙겨드려요", 46, TOKENS["text"])
    mascot(canvas, "idle", 484, (540, 8))
    return canvas

def campaign():
    canvas = Image.new("RGB", (1242, 2688), TOKENS["background"])
    draw = ImageDraw.Draw(canvas)
    text(draw, (621, 174), "장고야 부탁해", 38, TOKENS["primaryForeground"], center=True)
    text(draw, (621, 407), "이제부터 지구에", 76, TOKENS["text"], center=True)
    text(draw, (621, 515), "버려지는 식재료는 없다!", 76, TOKENS["text"], center=True)
    text(draw, (621, 694), "남은 재료도 알뜰하게,", 44, TOKENS["subtext"], "Medium", True)
    text(draw, (621, 759), "장고가 맛있는 한 끼로 이어드릴게요.", 44, TOKENS["subtext"], "Medium", True)
    draw.rounded_rectangle((72, 958, 1170, 2486), radius=190, fill=TOKENS["primarySoft"])
    mascot(canvas, "speak", 1242, (0, 1150))
    return canvas

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = {
        "google-play-feature-graphic.png": feature(),
        "jango-appstore-space-copy-ko-1242x2688.png": campaign(),
    }
    for name, image in outputs.items():
        destination = ROOT / "assets/store" / name
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        expected = buffer.getvalue()
        if args.check:
            if not destination.exists():
                raise SystemExit(f"Missing {name}; run store:sync")
            with Image.open(destination) as actual:
                if actual.mode != "RGB" or actual.size != image.size or actual.tobytes() != image.tobytes():
                    raise SystemExit(f"Stale or edited {name}; run store:sync")
        else:
            destination.write_bytes(expected)
        print(f'{"PASS" if args.check else "SYNC"} {name}: {image.size}, RGB, shared tokens + approved mascot + Pretendard')

if __name__ == "__main__":
    main()
