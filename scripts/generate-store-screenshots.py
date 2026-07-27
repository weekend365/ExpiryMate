#!/usr/bin/env python3
"""Generate Korean App Store and Google Play screenshots for ExpiryMate."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT: Final = Path(__file__).resolve().parents[1]
RAW_DIR: Final = (
    ROOT / "store-assets/screenshots/raw/ios/ko/iphone-6.9"
)
APP_STORE_DIR: Final = (
    ROOT / "store-assets/screenshots/final/app-store/ko/iphone-6.9"
)
GOOGLE_PLAY_DIR: Final = (
    ROOT / "store-assets/screenshots/final/google-play/ko/phone"
)
FONT_DIR: Final = ROOT / "apps/mobile/assets/fonts"

BRAND_SOFT: Final = "#D1FAE5"
BRAND_DARK: Final = "#064E3B"
BRAND_BORDER: Final = "#A7F3D0"

SOURCE_SIZE: Final = (1206, 2622)
CROP_TOP: Final = 136
CROP_BOTTOM: Final = 64


@dataclass(frozen=True)
class ScreenshotSpec:
    filename: str
    caption: str


@dataclass(frozen=True)
class StoreLayout:
    size: tuple[int, int]
    screen_width: int
    screen_y: int
    screen_radius: int
    shadow_blur: int
    shadow_offset: int
    label_top: int
    label_font_size: int
    label_height: int
    label_padding_x: int
    title_top: int
    title_font_size: int


SPECS: Final = (
    ScreenshotSpec("01-home.png", "오늘 냉장고 상태를 한눈에"),
    ScreenshotSpec("02-inventory.png", "재료와 유통기한을 편하게"),
    ScreenshotSpec("03-recommendations.png", "임박 재료로 오늘 메뉴까지"),
    ScreenshotSpec("04-scanner.png", "비추면 등록 준비가 빠르게"),
    ScreenshotSpec("05-shared-space.png", "가족·동료와 냉장고를 함께"),
    ScreenshotSpec("06-register-expiry.png", "단계별로 재료 등록도 가볍게"),
)

LAYOUTS: Final = {
    "app-store": StoreLayout(
        size=(1290, 2796),
        screen_width=1136,
        screen_y=400,
        screen_radius=56,
        shadow_blur=30,
        shadow_offset=20,
        label_top=62,
        label_font_size=30,
        label_height=58,
        label_padding_x=30,
        title_top=154,
        title_font_size=74,
    ),
    "google-play": StoreLayout(
        size=(1080, 1920),
        screen_width=790,
        screen_y=270,
        screen_radius=44,
        shadow_blur=22,
        shadow_offset=14,
        label_top=34,
        label_font_size=24,
        label_height=48,
        label_padding_x=24,
        title_top=104,
        title_font_size=50,
    ),
}

OUTPUTS: Final = {
    "app-store": APP_STORE_DIR,
    "google-play": GOOGLE_PLAY_DIR,
}


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    path = FONT_DIR / name
    if not path.is_file():
        raise FileNotFoundError(f"Font not found: {path}")
    return ImageFont.truetype(str(path), size)


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    canvas_width: int,
    top: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str,
) -> tuple[int, int, int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (canvas_width - text_width) // 2
    draw.text((x - bbox[0], top - bbox[1]), text, font=font, fill=fill)
    return (x, top, x + text_width, top + text_height)


def create_background(size: tuple[int, int]) -> Image.Image:
    width, height = size
    start = (236, 253, 245)
    end = (247, 251, 249)
    colors = []
    for y in range(height):
        ratio = y / max(height - 1, 1)
        colors.append(tuple(
            round(start[channel] * (1 - ratio) + end[channel] * ratio)
            for channel in range(3)
        ))
    gradient_column = Image.new("RGB", (1, height))
    gradient_column.putdata(colors)
    gradient = gradient_column.resize(size, Image.Resampling.NEAREST)

    background = gradient.convert("RGBA")
    decorations = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(decorations)
    draw.ellipse(
        (width - round(width * 0.33), -round(width * 0.18),
         width + round(width * 0.18), round(width * 0.33)),
        fill=(209, 250, 229, 150),
    )
    draw.ellipse(
        (-round(width * 0.18), height - round(width * 0.30),
         round(width * 0.26), height + round(width * 0.14)),
        fill=(228, 249, 239, 170),
    )
    return Image.alpha_composite(background, decorations)


def prepare_screen(source_path: Path, layout: StoreLayout) -> Image.Image:
    with Image.open(source_path) as source:
        source = source.convert("RGB")
        if source.size != SOURCE_SIZE:
            raise ValueError(
                f"{source_path.name}: expected {SOURCE_SIZE}, got {source.size}"
            )
        cropped = source.crop(
            (0, CROP_TOP, source.width, source.height - CROP_BOTTOM)
        )
        target_height = round(cropped.height * layout.screen_width / cropped.width)
        return cropped.resize(
            (layout.screen_width, target_height),
            Image.Resampling.LANCZOS,
        )


def compose_screenshot(
    source_path: Path,
    caption: str,
    layout: StoreLayout,
) -> Image.Image:
    canvas = create_background(layout.size)
    width, height = layout.size
    draw = ImageDraw.Draw(canvas)

    label_font = load_font("Pretendard-SemiBold.otf", layout.label_font_size)
    title_font = load_font("Pretendard-ExtraBold.otf", layout.title_font_size)
    label = "장고야 부탁해"
    label_bbox = draw.textbbox((0, 0), label, font=label_font)
    label_width = (
        label_bbox[2] - label_bbox[0] + layout.label_padding_x * 2
    )
    label_left = (width - label_width) // 2
    label_box = (
        label_left,
        layout.label_top,
        label_left + label_width,
        layout.label_top + layout.label_height,
    )
    draw.rounded_rectangle(
        label_box,
        radius=layout.label_height // 2,
        fill=BRAND_SOFT,
    )
    label_text_height = label_bbox[3] - label_bbox[1]
    label_text_top = (
        layout.label_top + (layout.label_height - label_text_height) // 2
    )
    draw_centered_text(
        draw,
        width,
        label_text_top,
        label,
        label_font,
        BRAND_DARK,
    )

    title_bbox = draw_centered_text(
        draw,
        width,
        layout.title_top,
        caption,
        title_font,
        BRAND_DARK,
    )
    if title_bbox[0] < 32 or title_bbox[2] > width - 32:
        raise ValueError(f"Caption does not fit: {caption}")

    screen = prepare_screen(source_path, layout)
    screen_x = (width - screen.width) // 2
    screen_y = layout.screen_y
    if screen_y + screen.height > height - 24:
        raise ValueError(
            f"{source_path.name}: screen exceeds canvas "
            f"({screen_y + screen.height} > {height - 24})"
        )

    shadow = Image.new("RGBA", layout.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (
            screen_x,
            screen_y + layout.shadow_offset,
            screen_x + screen.width,
            screen_y + layout.shadow_offset + screen.height,
        ),
        radius=layout.screen_radius,
        fill=(6, 78, 59, 58),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(layout.shadow_blur))
    canvas = Image.alpha_composite(canvas, shadow)

    mask = Image.new("L", screen.size, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        (0, 0, screen.width - 1, screen.height - 1),
        radius=layout.screen_radius,
        fill=255,
    )
    canvas.paste(screen, (screen_x, screen_y), mask)

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(
        (
            screen_x,
            screen_y,
            screen_x + screen.width - 1,
            screen_y + screen.height - 1,
        ),
        radius=layout.screen_radius,
        outline=BRAND_BORDER,
        width=2,
    )
    return canvas.convert("RGB")


def generate_all() -> list[Path]:
    generated: list[Path] = []
    for output_dir in OUTPUTS.values():
        output_dir.mkdir(parents=True, exist_ok=True)

    for store_name, layout in LAYOUTS.items():
        output_dir = OUTPUTS[store_name]
        for spec in SPECS:
            source_path = RAW_DIR / spec.filename
            if not source_path.is_file():
                raise FileNotFoundError(f"Source image not found: {source_path}")
            output_path = output_dir / spec.filename
            image = compose_screenshot(source_path, spec.caption, layout)
            image.save(output_path, "PNG", optimize=True)
            generated.append(output_path)
            print(f"generated {output_path.relative_to(ROOT)}")
    return generated


def validate_outputs() -> None:
    expected_names = [spec.filename for spec in SPECS]
    failures: list[str] = []

    for store_name, output_dir in OUTPUTS.items():
        expected_size = LAYOUTS[store_name].size
        actual_names = sorted(path.name for path in output_dir.glob("*.png"))
        if actual_names != expected_names:
            failures.append(
                f"{store_name}: expected {expected_names}, got {actual_names}"
            )
            continue

        for filename in expected_names:
            path = output_dir / filename
            with Image.open(path) as image:
                if image.format != "PNG":
                    failures.append(f"{path}: expected PNG, got {image.format}")
                if image.size != expected_size:
                    failures.append(
                        f"{path}: expected {expected_size}, got {image.size}"
                    )
                if image.mode != "RGB":
                    failures.append(f"{path}: expected RGB, got {image.mode}")
                if "A" in image.getbands():
                    failures.append(f"{path}: unexpected alpha channel")

    if failures:
        raise RuntimeError("Output validation failed:\n" + "\n".join(failures))
    print("validated 12 opaque RGB PNG files")


def create_contact_sheet(
    source_dir: Path,
    output_path: Path,
    thumb_width: int,
) -> None:
    paths = [source_dir / spec.filename for spec in SPECS]
    margin = 28
    gap = 24
    columns = 3
    rows = 2
    with Image.open(paths[0]) as sample:
        thumb_height = round(sample.height * thumb_width / sample.width)
    sheet_width = margin * 2 + thumb_width * columns + gap * (columns - 1)
    sheet_height = margin * 2 + thumb_height * rows + gap * (rows - 1)
    sheet = Image.new("RGB", (sheet_width, sheet_height), "#E8EBEE")

    for index, path in enumerate(paths):
        with Image.open(path) as image:
            thumb = image.convert("RGB").resize(
                (thumb_width, thumb_height),
                Image.Resampling.LANCZOS,
            )
        column = index % columns
        row = index // columns
        x = margin + column * (thumb_width + gap)
        y = margin + row * (thumb_height + gap)
        sheet.paste(thumb, (x, y))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, "PNG", optimize=True)
    print(f"generated review sheet {output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--review-dir",
        type=Path,
        help="Optional directory for App Store and Google Play contact sheets.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generate_all()
    validate_outputs()
    if args.review_dir:
        create_contact_sheet(
            APP_STORE_DIR,
            args.review_dir / "app-store-contact-sheet.png",
            thumb_width=300,
        )
        create_contact_sheet(
            GOOGLE_PLAY_DIR,
            args.review_dir / "google-play-contact-sheet.png",
            thumb_width=300,
        )


if __name__ == "__main__":
    main()
