#!/usr/bin/env python3
"""Derive branding + native iOS icons from Jango character masters.

Sources:
  - assets/characters/jango-icon-crop.png
      → app icon / adaptive (dedicated icon pose; transparent source)
      → final icon.png is opaque on #F1F3F5 (iOS-safe)
  - assets/characters/jango-idle.png
      → splash, notification silhouette

Does NOT overwrite jango-icon-crop.png (hand-authored icon pose).

Requires: pip install pillow

Usage (from apps/mobile):
  python3 scripts/sync-branding-from-jango.py
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:
    print("Pillow is required: python3 -m pip install pillow", file=sys.stderr)
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[1]
IDLE = ROOT / "assets/characters/jango-idle.png"
CROP = ROOT / "assets/characters/jango-icon-crop.png"
BRAND = ROOT / "assets/branding"
APPICON = (
    ROOT
    / "ios/ExpiryMate/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
)
SPLASH_DIR = ROOT / "ios/ExpiryMate/Images.xcassets/SplashScreenLogo.imageset"

BG_RGB = (241, 243, 245)  # semanticColors.background


def build_icon_crop_from_idle(idle: Image.Image, size: int = 1024) -> Image.Image:
    """Deterministic bust crop from idle master — no AI redraw drift."""
    bbox = idle.getbbox()
    if not bbox:
        raise SystemExit(f"{IDLE} has no opaque pixels")
    content = idle.crop(bbox)
    cw, ch = content.size
    slice_img = content.crop((0, 0, cw, min(ch, int(ch * 0.70))))
    sw, sh = slice_img.size
    side = max(sw, sh)
    pad = int(side * 0.06)
    canvas_side = side + pad * 2
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    x = (canvas_side - sw) // 2
    y = max(pad // 2, (canvas_side - sh) // 2 - int(canvas_side * 0.02))
    canvas.alpha_composite(slice_img, (x, y))
    final = canvas.resize((size, size), Image.Resampling.LANCZOS)
    pixels = final.load()
    w, h = final.size
    for yy in range(h):
        for xx in range(w):
            r, g, b, a = pixels[xx, yy]
            if a < 16:
                pixels[xx, yy] = (r, g, b, 0)
            elif a > 240:
                pixels[xx, yy] = (r, g, b, 255)
    return final


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
        raise SystemExit("source has no opaque pixels")
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


def simplified_silhouette(
    character: Image.Image, master: int = 192, final: int = 96
) -> tuple[Image.Image, Image.Image]:
    """White silhouette: simplify edges at high res, save 192 master, downscale to 96."""
    bbox = character.getbbox()
    if not bbox:
        raise SystemExit("source has no opaque pixels")
    cropped = character.crop(bbox)

    work_size = master * 2
    work = Image.new("RGBA", (work_size, work_size), (0, 0, 0, 0))
    max_side = int(work_size * 0.78)
    cw, ch = cropped.size
    ratio = min(max_side / cw, max_side / ch)
    new_w = max(1, int(cw * ratio))
    new_h = max(1, int(ch * ratio))
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

    mask = resized.split()[3].point(lambda a: 255 if a >= 48 else 0)
    mask = mask.filter(ImageFilter.MaxFilter(5))
    mask = mask.filter(ImageFilter.MinFilter(3))
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    mask = mask.point(lambda a: 255 if a >= 128 else 0)

    layer = Image.new("RGBA", (new_w, new_h), (255, 255, 255, 255))
    layer.putalpha(mask)
    work.alpha_composite(layer, ((work_size - new_w) // 2, (work_size - new_h) // 2))

    master_scaled = work.resize((master, master), Image.Resampling.LANCZOS)
    master_alpha = master_scaled.split()[3].point(lambda v: 255 if v >= 100 else 0)
    master_out = Image.new("RGBA", (master, master), (255, 255, 255, 255))
    master_out.putalpha(master_alpha)

    final_scaled = master_out.resize((final, final), Image.Resampling.LANCZOS)
    final_alpha = final_scaled.split()[3].point(lambda v: 255 if v >= 90 else 0)
    final_out = Image.new("RGBA", (final, final), (255, 255, 255, 255))
    final_out.putalpha(final_alpha)
    return master_out, final_out


def harden_rgba_alpha(im: Image.Image, low: int = 40, high: int = 200) -> Image.Image:
    """Binary-ize soft alpha fringe from resize (noise on transparent areas)."""
    out = im.convert("RGBA")
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or a == 255:
                continue
            if a < low:
                px[x, y] = (0, 0, 0, 0)
            elif a > high:
                px[x, y] = (r, g, b, 255)
            else:
                # Mid fringe → drop (prevents speckles on adaptive FG)
                px[x, y] = (0, 0, 0, 0)
    return out


def main() -> None:
    if not IDLE.exists():
        raise SystemExit(f"missing source: {IDLE}")
    if not CROP.exists():
        raise SystemExit(
            f"missing icon pose: {CROP} (create wink/thumbs-up icon crop first)"
        )

    idle = Image.open(IDLE).convert("RGBA")
    crop = Image.open(CROP).convert("RGBA")
    BRAND.mkdir(parents=True, exist_ok=True)

    # App icon must be opaque; adaptive FG keeps transparency.
    icon = to_opaque_rgb(
        fit_on_canvas(crop, 1024, scale=0.90, background=(*BG_RGB, 255))
    )
    icon.save(BRAND / "icon.png", optimize=True)

    adaptive = fit_on_canvas(crop, 1024, scale=0.72, background=None)
    adaptive = harden_rgba_alpha(adaptive)
    adaptive.save(BRAND / "adaptive-icon.png", optimize=True)

    # Splash: full-body idle
    splash = fit_on_canvas(idle, 1024, scale=0.88, background=None)
    splash.save(BRAND / "splash-icon.png", optimize=True)

    # Notification: 192 master → 96
    notif_192, notif_96 = simplified_silhouette(idle, 192, 96)
    notif_192.save(BRAND / "notification-icon-192.png", optimize=True)
    notif_96.save(BRAND / "notification-icon.png", optimize=True)

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

    print("synced branding from jango-idle + jango-icon-crop:")
    for path in sorted(BRAND.glob("*.png")):
        im = Image.open(path)
        print(f"  {path.relative_to(ROOT)}  {im.mode} {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main()
