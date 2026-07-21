#!/usr/bin/env python3
"""Derive branding + native iOS icons from jango-idle.png.

Requires: pip install pillow

Usage (from apps/mobile):
  python3 scripts/sync-branding-from-jango.py
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required: python3 -m pip install pillow", file=sys.stderr)
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/characters/jango-idle.png"
BRAND = ROOT / "assets/branding"
APPICON = (
    ROOT
    / "ios/ExpiryMate/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
)
SPLASH_DIR = ROOT / "ios/ExpiryMate/Images.xcassets/SplashScreenLogo.imageset"

BG_RGB = (241, 243, 245)  # semanticColors.background


def fit_on_canvas(
    character: Image.Image,
    size: int,
    *,
    scale: float,
    background: tuple[int, int, int, int] | None,
    y_bias: float = 0.0,
) -> Image.Image:
    bbox = character.getbbox()
    if not bbox:
        raise SystemExit(f"{SRC} has no opaque pixels")
    cropped = character.crop(bbox)
    max_side = int(size * scale)
    cw, ch = cropped.size
    ratio = min(max_side / cw, max_side / ch)
    new_w = max(1, int(cw * ratio))
    new_h = max(1, int(ch * ratio))
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

    if background is None:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (size, size), background)

    x = (size - new_w) // 2
    y = (size - new_h) // 2 + int(size * y_bias)
    canvas.alpha_composite(resized, (x, y))
    return canvas


def to_opaque_rgb(im: Image.Image, bg: tuple[int, int, int] = BG_RGB) -> Image.Image:
    base = Image.new("RGB", im.size, bg)
    base.paste(im, mask=im.split()[3])
    return base


def make_notification_monochrome(character: Image.Image, size: int = 96) -> Image.Image:
    bbox = character.getbbox()
    if not bbox:
        raise SystemExit(f"{SRC} has no opaque pixels")
    cropped = character.crop(bbox)
    max_side = int(size * 0.72)
    cw, ch = cropped.size
    ratio = min(max_side / cw, max_side / ch)
    new_w = max(1, int(cw * ratio))
    new_h = max(1, int(ch * ratio))
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    alpha = resized.split()[3]
    mask = alpha.point(lambda a: 255 if a >= 40 else 0)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    white = Image.new("RGBA", (new_w, new_h), (255, 255, 255, 255))
    white.putalpha(mask)
    out.alpha_composite(white, ((size - new_w) // 2, (size - new_h) // 2))
    return out


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing source: {SRC}")

    src = Image.open(SRC).convert("RGBA")
    BRAND.mkdir(parents=True, exist_ok=True)

    icon = to_opaque_rgb(fit_on_canvas(src, 1024, scale=0.82, background=(*BG_RGB, 255), y_bias=0.02))
    icon.save(BRAND / "icon.png", optimize=True)

    adaptive = fit_on_canvas(src, 1024, scale=0.66, background=None, y_bias=0.02)
    adaptive.save(BRAND / "adaptive-icon.png", optimize=True)

    splash = fit_on_canvas(src, 1024, scale=0.88, background=None)
    splash.save(BRAND / "splash-icon.png", optimize=True)

    notif = make_notification_monochrome(src, 96)
    notif.save(BRAND / "notification-icon.png", optimize=True)

    if APPICON.parent.exists():
        icon.save(APPICON, optimize=True)
    else:
        print(f"skip AppIcon (missing {APPICON.parent})")

    if SPLASH_DIR.exists():
        for name, dim in [("image.png", 220), ("image@2x.png", 440), ("image@3x.png", 660)]:
            splash.resize((dim, dim), Image.Resampling.LANCZOS).save(
                SPLASH_DIR / name, optimize=True
            )
    else:
        print(f"skip SplashScreenLogo (missing {SPLASH_DIR})")

    print("synced branding from jango-idle.png:")
    for path in sorted(BRAND.glob("*.png")):
        im = Image.open(path)
        print(f"  {path.relative_to(ROOT)}  {im.mode} {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main()
