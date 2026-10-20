"""Typeset approved episode-2 dialogue onto preserved official imagegen artwork.

Run with Pillow 13; only lettering, phone lettering, and proportional exports.
No character/background drawing or asset replacement is performed by this script.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
GAEGU = ROOT / "design/jango/emoticons/kakao-32/v18/fonts/Gaegu-Bold.ttf"
UI = ROOT / "apps/mobile/assets/fonts/Pretendard-Bold.otf"
INK = "#514438"
GREEN = "#2D705D"
IVORY = "#FFFBEF"
BOXES: list[dict] = []
PANEL = 0


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def centered(im, copy, center, size, *, face=GAEGU, color=INK, gap=10,
             max_width=None, role="dialogue"):
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(str(face), size)
    lines = copy.split("\n")
    # Gaegu's U+2026 glyph is empty in this preserved font file. Use three
    # visible period glyphs for the same ellipsis; retain canonical copy in records.
    displayed = [line.replace("…", "...") if face == GAEGU else line for line in lines]
    metrics = [d.textbbox((0, 0), line, font=f) for line in displayed]
    heights = [b[3] - b[1] for b in metrics]
    y = center[1] - (sum(heights) + gap * (len(lines) - 1)) / 2
    for line, rendered, b, height in zip(lines, displayed, metrics, heights):
        width = b[2] - b[0]
        if max_width is not None:
            assert width <= max_width, (PANEL, line, width, max_width)
        x = center[0] - width / 2
        assert 0 <= x and x + width < im.width and y >= 0 and y + height < im.height
        d.text((round(x - b[0]), round(y - b[1])), rendered, font=f, fill=color)
        BOXES.append({"panel": PANEL, "text": line, "role": role,
                      "renderedText": rendered,
                      "fontSize": size, "font": str(face.relative_to(ROOT)),
                      "bbox": [round(x), round(y), round(x + width), round(y + height)]})
        y += height + gap


def solve(a, b):
    rows = [list(row) + [v] for row, v in zip(a, b)]
    for i in range(len(b)):
        k = max(range(i, len(b)), key=lambda k: abs(rows[k][i]))
        rows[i], rows[k] = rows[k], rows[i]
        divisor = rows[i][i]
        assert abs(divisor) > 1e-10
        rows[i] = [x / divisor for x in rows[i]]
        for j in range(len(b)):
            if j != i:
                factor = rows[j][i]
                rows[j] = [x - factor * y for x, y in zip(rows[j], rows[i])]
    return [row[-1] for row in rows]


def place_lettering(im, layer, quad, role):
    """Project only a transparent typography layer onto the illustrated plane."""
    a, b = [], []
    source = [(0, 0), (layer.width, 0), (layer.width, layer.height), (0, layer.height)]
    for (x, y), (u, v) in zip(quad, source):
        a.extend([[x, y, 1, 0, 0, 0, -u*x, -u*y],
                  [0, 0, 0, x, y, 1, -v*x, -v*y]])
        b.extend([u, v])
    transformed = layer.transform(im.size, Image.Transform.PERSPECTIVE,
                                  solve(a, b), Image.Resampling.BICUBIC)
    im.alpha_composite(transformed)
    BOXES.append({"panel": PANEL, "role": role, "projectedQuad": quad,
                  "layerSize": list(layer.size)})


def build_panel(number):
    global PANEL
    PANEL = number
    source = OUT / f"source-art/panel-{number:02}-r1.png"
    generation = json.loads((OUT / f"generation-{number:02}-r1.json").read_text())
    assert sha(source) == generation["sha256"]
    im = Image.open(source).convert("RGBA")
    assert im.size == (1122, 1402)
    if number == 1:
        centered(im, "장고랑 살아보니  02", (561, 21), 31, color=GREEN, role="series")
        centered(im, "1+1인데, 집에도 1", (561, 68), 68, color=GREEN,
                 max_width=950, role="title")
        centered(im, "하나 사면\n하나 더?!", (360, 225), 84, max_width=470)
        centered(im, "두 개나!", (865, 309), 84, max_width=355)
        label = Image.new("RGBA", (280, 170))
        centered(label, "1+1", (140, 85), 112, face=UI, max_width=260, role="offer")
        place_lettering(im, label, [(884, 643), (1053, 614), (1046, 733), (875, 757)], "offer projection")
    elif number == 2:
        centered(im, "아.\n어제 샀지.", (340, 184), 84, max_width=465)
        centered(im, "우리 둘 다\n신났네…", (847, 278), 78, max_width=375)
        screen = Image.new("RGBA", (280, 540))
        centered(screen, "장고야 부탁해", (140, 51), 31, face=UI, color=GREEN,
                 max_width=250, role="illustrative app brand")
        centered(screen, "보관함", (140, 114), 48, face=UI, max_width=240,
                 role="illustrative inventory heading")
        ImageDraw.Draw(screen).line((25, 160, 255, 160), fill="#AACABF", width=3)
        centered(screen, "등록한 재료", (140, 212), 33, face=UI, max_width=245,
                 role="illustrative inventory context")
        centered(screen, "우유", (140, 293), 68, face=UI, max_width=240,
                 role="essential sample ingredient")
        centered(screen, "1개", (140, 376), 66, face=UI, color=GREEN,
                 max_width=240, role="essential sample quantity")
        centered(screen, "이야기용 예시", (140, 480), 25, face=UI,
                 max_width=250, role="illustrative UI disclosure")
        place_lettering(im, screen, [(387, 817), (594, 791), (676, 1255), (446, 1280)],
                        "simplified phone typography; not a screenshot")
    elif number == 3:
        centered(im, "오늘은 집에 있는\n것부터 먹자.", (344, 166), 76, max_width=500)
        centered(im, "시리얼도\n있었지?", (879, 207), 78, max_width=350)
    elif number == 4:
        centered(im, "난\n맛만 볼게.", (318, 179), 84, max_width=425)
        centered(im, "그릇은 왜\n네 게 더 커?", (827, 229), 78, max_width=420)
        centered(im, "장고야 부탁해", (561, 1240), 88, color=GREEN,
                 max_width=980, role="brand")
        centered(im, "장보기 전, 장고 보관함부터.", (561, 1320), 57,
                 max_width=980, role="cta")
    native = im.convert("RGB")
    native.save(OUT / f"review/native-{number:02}.jpg", quality=97, subsampling=0)
    # Uniform scaling with at most one pixel of padding: never stretch source artwork.
    fit = ImageOps.contain(native, (1080, 1350), Image.Resampling.LANCZOS)
    final = Image.new("RGB", (1080, 1350), IVORY)
    final.paste(fit, ((1080-fit.width)//2, (1350-fit.height)//2))
    final.save(OUT / f"panels/{number:02}.png", optimize=True)
    final.resize((360, 450), Image.Resampling.LANCZOS).save(OUT / f"review/{number:02}-360.png")
    return final


def main():
    panels = [build_panel(n) for n in range(1, 5)]
    overview = Image.new("RGB", (1104, 1374), IVORY)
    mobile = Image.new("RGB", (744, 924), IVORY)
    for i, im in enumerate(panels):
        overview.paste(im.resize((540, 675), Image.Resampling.LANCZOS),
                       (8 + (i % 2)*548, 8 + (i // 2)*683))
        mobile.paste(im.resize((360, 450), Image.Resampling.LANCZOS),
                     (8 + (i % 2)*368, 8 + (i // 2)*458))
    overview.save(OUT / "review/overview.jpg", quality=96, subsampling=0)
    mobile.save(OUT / "review/mobile-360.png")
    grid = ImageOps.fit(panels[0], (360, 480), Image.Resampling.LANCZOS)
    grid.save(OUT / "review/profile-thumbnail.jpg", quality=96)
    report = {"method": "Pillow 13 separate Gaegu dialogue/brand, Pretendard illustrative phone labels and offer digits, transparent perspective lettering only, uniform export.",
              "sourceNativeSize": [1122, 1402], "outputSize": [1080, 1350],
              "fonts": {str(p.relative_to(ROOT)): sha(p) for p in [GAEGU, UI]},
              "textBoxes": BOXES,
              "outputHashes": {f"panels/{n:02}.png": sha(OUT / f"panels/{n:02}.png") for n in range(1, 5)}}
    (OUT / "typography-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("Rendered four panels and native/360px/grid proofs.")


if __name__ == "__main__":
    main()
