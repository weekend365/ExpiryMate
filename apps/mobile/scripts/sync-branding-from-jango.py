#!/usr/bin/env python3
"""Derive branding + native iOS/Android icons from Jango character masters.

Sources:
  - assets/characters/jango-icon-crop.png
      → app icon / adaptive (dedicated icon pose; transparent source)
      → final icon.png is opaque on shared ivory background (iOS-safe)
  - generated app icon
      → compact rounded splash icon
  - assets/characters/jango-idle.png
      → notification silhouette

Does NOT overwrite jango-icon-crop.png (v18 representative 24 derived pose).

Requires: pip install pillow

Usage (from apps/mobile):
  python3 scripts/sync-branding-from-jango.py
"""

from __future__ import annotations

import sys
import io
import json
import subprocess
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
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
ANDROID_RES = ROOT / "android/app/src/main/res"
ANDROID_MONOCHROME_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

# Read the built shared package: no Python-specific duplicate color constants.
TOKENS = json.loads(subprocess.check_output(
    ["node", "--input-type=module", "-e",
     "import {semanticColors} from '@expirymate/shared'; console.log(JSON.stringify(semanticColors))"],
    cwd=ROOT, text=True,
))
CHECK = "--check" in sys.argv

def save_image(image, destination, format=None, **options):
    buffer = io.BytesIO()
    image.save(buffer, format or ("WEBP" if destination.suffix == ".webp" else "PNG"), **options)
    if CHECK:
        if not destination.exists():
            raise SystemExit(f"Missing branding derivative: {destination}")
        with Image.open(destination) as actual, Image.open(io.BytesIO(buffer.getvalue())) as expected:
            if actual.size != expected.size or actual.convert("RGBA").tobytes() != expected.convert("RGBA").tobytes():
                raise SystemExit(f"Stale branding derivative: {destination}")
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(buffer.getvalue())

def rgb(hex_color: str) -> tuple[int, int, int]:
    return tuple(int(hex_color[i:i+2], 16) for i in (1, 3, 5))
BG_RGB = rgb(TOKENS["background"])
ICON_BORDER_RGB = rgb(TOKENS["border"])
SPLASH_LOGICAL_SIZE = 88
ANDROID_SPLASH_CANVAS_SIZE = 288

def android_splash(splash: Image.Image, scale: float) -> Image.Image:
    """Match Expo's 288dp Android canvas; retain the configured 88dp launch mark.

    Android 12 masks the canvas. Supplying an 88dp full-bleed drawable makes
    the OS enlarge and clip the character instead of preserving imageWidth.
    """
    size = round(ANDROID_SPLASH_CANVAS_SIZE * scale)
    content_size = round(SPLASH_LOGICAL_SIZE * scale)
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.alpha_composite(splash.resize((content_size, content_size), Image.Resampling.LANCZOS),
                           ((size-content_size)//2, (size-content_size)//2))
    return output


def build_splash_app_icon(icon: Image.Image, size: int = 1024) -> Image.Image:
    """Derive a compact rounded launch mark from the shipped app icon."""
    source = icon.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    radius = int(size * 0.22)
    border_width = max(1, int(size * 0.01))

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1),
        radius=radius,
        fill=255,
    )
    source.putalpha(mask)

    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        (
            border_width // 2,
            border_width // 2,
            size - 1 - border_width // 2,
            size - 1 - border_width // 2,
        ),
        radius=radius,
        outline=(*ICON_BORDER_RGB, 255),
        width=border_width,
    )
    source.alpha_composite(border)
    return source


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


def to_white_alpha_glyph(im: Image.Image) -> Image.Image:
    """Reuse an approved foreground alpha mask as a pure-white themed glyph."""
    glyph = Image.new("RGBA", im.size, (255, 255, 255, 255))
    glyph.putalpha(im.getchannel("A"))
    return glyph


def simplified_silhouette(
    character: Image.Image,
    master: int = 192,
    final: int = 96,
    upper_crop_ratio: float = 1.0,
) -> tuple[Image.Image, Image.Image]:
    """White notification glyph from the entire v18 representative, retaining the plate."""
    bbox = character.getbbox()
    if not bbox:
        raise SystemExit("source has no opaque pixels")
    content_height = bbox[3] - bbox[1]
    crop_bottom = bbox[1] + int(content_height * upper_crop_ratio)
    cropped = character.crop((bbox[0], bbox[1], bbox[2], crop_bottom))

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
            f"missing icon pose: {CROP} (run mascot:sync for v18 representative 24 first)"
        )

    idle = Image.open(IDLE).convert("RGBA")
    crop = Image.open(CROP).convert("RGBA")
    BRAND.mkdir(parents=True, exist_ok=True)

    # App icon must be opaque; adaptive FG keeps transparency.
    icon = to_opaque_rgb(
        fit_on_canvas(crop, 1024, scale=0.90, background=(*BG_RGB, 255))
    )
    save_image(icon, BRAND / "icon.png", optimize=True)

    # Keep the entire pose inside the central Android adaptive-icon safe circle.
    adaptive = fit_on_canvas(crop, 1024, scale=0.60, background=None)
    adaptive = harden_rgba_alpha(adaptive)
    save_image(adaptive, BRAND / "adaptive-icon.png", optimize=True)

    # Android 13+ themed icon: exact adaptive silhouette, tinted by the OS.
    monochrome = to_white_alpha_glyph(adaptive)
    save_image(monochrome, BRAND / "monochrome-icon.png", optimize=True)

    if ANDROID_RES.exists():
        for density, dim in ANDROID_MONOCHROME_SIZES.items():
            destination = (
                ANDROID_RES / f"mipmap-{density}" / "ic_launcher_monochrome.webp"
            )
            destination.parent.mkdir(parents=True, exist_ok=True)
            save_image(monochrome.resize((dim, dim), Image.Resampling.LANCZOS),
                destination,
                "WEBP",
                lossless=True,
                method=6,
            )

    # Splash: compact rounded derivative of the shipped app icon.
    splash = build_splash_app_icon(icon, 1024)
    save_image(splash, BRAND / "splash-icon.png", optimize=True)

    # Notification: 192 master → 96
    notif_192, notif_96 = simplified_silhouette(idle, 192, 96)
    save_image(notif_192, BRAND / "notification-icon-192.png", optimize=True)
    save_image(notif_96, BRAND / "notification-icon.png", optimize=True)

    if ANDROID_RES.exists():
        for density, scale in {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}.items():
            mipmap = ANDROID_RES / f"mipmap-{density}"
            drawable = ANDROID_RES / f"drawable-{density}"
            for name, art, dim in [("ic_launcher.webp", icon, round(48*scale)), ("ic_launcher_round.webp", splash, round(48*scale)), ("ic_launcher_foreground.webp", adaptive, round(108*scale))]:
                save_image(art.resize((dim, dim), Image.Resampling.LANCZOS), mipmap/name, "WEBP", lossless=True, method=6)
            save_image(android_splash(splash, scale), drawable/"splashscreen_logo.png", optimize=True)
            for name, art, dim in [("notification_icon.png", notif_192, round(24*scale))]:
                save_image(art.resize((dim, dim), Image.Resampling.LANCZOS), drawable/name, optimize=True)

    if APPICON.parent.exists():
        save_image(icon, APPICON, optimize=True)
    else:
        print(f"skip AppIcon (missing {APPICON.parent})")

    if SPLASH_DIR.exists():
        for name, dim in [
            ("image.png", SPLASH_LOGICAL_SIZE),
            ("image@2x.png", SPLASH_LOGICAL_SIZE * 2),
            ("image@3x.png", SPLASH_LOGICAL_SIZE * 3),
        ]:
            save_image(splash.resize((dim, dim), Image.Resampling.LANCZOS),
                SPLASH_DIR / name, optimize=True
            )
    else:
        print(f"skip SplashScreenLogo (missing {SPLASH_DIR})")

    print("verified" if CHECK else "synced", "v18 24 branding and all native derivatives:")
    for path in sorted(BRAND.glob("*.png")):
        im = Image.open(path)
        print(f"  {path.relative_to(ROOT)}  {im.mode} {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main()
