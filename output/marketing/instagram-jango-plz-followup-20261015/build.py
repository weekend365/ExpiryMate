"""Deterministic Instagram follow-up graphics; original assets stay unchanged."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
FONT_DIR = ROOT / "apps/mobile/assets/fonts"
PALETTE_FILE = ROOT / "packages/shared/src/design/palette.ts"
PALETTE = PALETTE_FILE.read_text()
SIZE = (1080, 1350)
TEXT_BOXES = []
SOURCES = {}
CURRENT = ""


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def token(scale, level):
    group = re.search(rf"export const {scale}(?:: ColorScale)? = \{{(.*?)\}}", PALETTE, re.S)[1]
    return re.search(rf'\b{level}: "(#[0-9A-Fa-f]{{6}})"', group)[1]


IVORY = token("cream", 50)
INK = token("neutral", 900)
GREEN = token("brand", 700)
FOREST = token("brand", 900)
MINT = token("brand", 500)
SOFT = token("brand", 100)
PALE = token("brand", 50)


def font(size, weight="Bold"):
    path = FONT_DIR / f"Pretendard-{weight}.otf"
    SOURCES[str(path.relative_to(ROOT))] = sha(path)
    return ImageFont.truetype(str(path), size)


def text(im, xy, value, size, color=INK, weight="Bold", leading=1.28, essential=True):
    d = ImageDraw.Draw(im)
    y = xy[1]
    f = font(size, weight)
    for line in value.split("\n"):
        bounds = d.textbbox((xy[0], y), line, font=f, anchor="lt")
        if essential:
            assert size >= 48, (CURRENT, line, size)
            assert bounds[0] >= 88 and bounds[2] <= im.width - 88, (CURRENT, line, bounds)
            assert bounds[1] >= 88 and bounds[3] <= im.height - 88, (CURRENT, line, bounds)
        else:
            assert bounds[0] >= 60 and bounds[2] <= im.width - 60, (CURRENT, line, bounds)
        d.text((xy[0], y), line, font=f, fill=color, anchor="lt")
        TEXT_BOXES.append({"file": CURRENT, "text": line, "fontSize": size,
                           "bbox": list(bounds), "essential": essential, "color": color})
        y += round(size * leading)
    return y


def base(series, page, dark=False):
    im = Image.new("RGB", SIZE, FOREST if dark else IVORY)
    fg, low = (IVORY, SOFT) if dark else (INK, GREEN)
    d = ImageDraw.Draw(im)
    text(im, (88, 88), "장고야 부탁해", 32, fg, essential=False)
    text(im, (794, 91), "@jango_plz", 28, low, "Medium", essential=False)
    d.line((88, 151, 992, 151), fill=GREEN if dark else SOFT, width=2)
    text(im, (88, 188), series, 29, low, "SemiBold", essential=False)
    text(im, (894, 188), f"{page:02}/04", 27, low, "Medium", essential=False)
    d.line((88, 1220, 992, 1220), fill=GREEN if dark else SOFT, width=2)
    text(im, (88, 1253), "내 재료로 오늘의 한 끼", 28, low, "Medium", essential=False)
    text(im, (807, 1253), "장고에게 부탁해", 27, low, "Medium", essential=False)
    return im


def mascot(im, mood, xy, side):
    manifest_path = ROOT / "design/jango/manifest.json"
    manifest = json.loads(manifest_path.read_text())
    p = next(p for p in manifest["poses"] if p["mood"] == mood)
    original = ROOT / "design/jango" / p["source"]
    assert sha(original) == p["sha256"]
    source = ROOT / f"apps/mobile/assets/characters/jango-{mood}.png"
    for path in (manifest_path, original, source):
        SOURCES[str(path.relative_to(ROOT))] = sha(path)
    # Whole existing app derivative, uniform scale, no crop or repaint.
    art = Image.open(source).convert("RGBA")
    art.thumbnail((side, side), Image.Resampling.LANCZOS)
    im.paste(art, xy, art)


def save(im, post, n):
    folder = OUT / post
    folder.mkdir(parents=True, exist_ok=True)
    im.save(folder / f"{n:02}.png", optimize=True)


def shopping_cards():
    global CURRENT
    post = "01-shopping-check"
    CURRENT = f"{post}/01.png"
    im = base("장보기 전 체크리스트", 1)
    text(im, (88, 275), "마트 가기 전,", 66)
    text(im, (88, 379), "냉장고에서", 96)
    text(im, (88, 503), "확인할 3가지", 96, GREEN)
    for y, n, label in [(745, "01", "이미 있는 재료"), (871, "02", "남은 양"), (997, "03", "먼저 쓸 재료")]:
        text(im, (88, y), n, 40, GREEN, essential=False)
        text(im, (181, y - 6), label, 49)
    mascot(im, "check", (450, 618), 625)
    save(im, post, 1)

    CURRENT = f"{post}/02.png"
    im = base("CHECK 01 · 중복 구매 전에", 2)
    text(im, (88, 276), "01", 124, GREEN)
    text(im, (88, 461), "이미 있는 재료", 86)
    text(im, (88, 608), "같은 재료를 또 사기 전에,\n보관함부터 확인해요.", 49, INK, "Medium")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((88, 825, 992, 1146), radius=32, fill=SOFT)
    text(im, (128, 874), "냉장 · 냉동 · 팬트리", 48, FOREST, "SemiBold")
    d.line((128, 957, 952, 957), fill=MINT, width=2)
    text(im, (128, 1000), "우리 집 재료, 한 번 더 확인.", 48, FOREST)
    save(im, post, 2)

    CURRENT = f"{post}/03.png"
    im = base("CHECK 02 · 살 양을 정하기 전에", 3)
    text(im, (88, 276), "02", 124, GREEN)
    text(im, (88, 461), "남은 양", 86)
    text(im, (88, 608), "얼마나 남았는지 살펴보고,\n이번에 살 양을 정해요.", 49, INK, "Medium")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((88, 825, 992, 1155), radius=32, fill=PALE)
    text(im, (128, 860), "남은 양 예시", 30, GREEN, "SemiBold", essential=False)
    for y, label, amount in [(925, "두부", "½모"), (1023, "달걀", "2개")]:
        text(im, (128, y), label, 61)
        text(im, (788, y), amount, 61, GREEN)
    save(im, post, 3)

    CURRENT = f"{post}/04.png"
    im = base("CHECK 03 · 이번 식사에 활용하기", 4, dark=True)
    text(im, (88, 276), "03", 124, SOFT)
    text(im, (88, 461), "먼저 쓸 재료", 86, IVORY)
    text(im, (88, 608), "기한이 가까운 재료부터,\n이번 식사에 활용해 보세요.", 49, IVORY, "Medium")
    text(im, (88, 891), "장보기 전,\n장고 보관함부터.", 58, IVORY)
    text(im, (88, 1111), "프로필에서 앱 다운로드", 48, SOFT, "SemiBold")
    mascot(im, "shopping", (635, 766), 440)
    save(im, post, 4)


def screen_crop(im, name, bounds, xy, width=904):
    path = OUT / "app-demo" / f"{name}-browser.jpg"
    SOURCES[str(path.relative_to(ROOT))] = sha(path)
    crop = Image.open(path).convert("RGB").crop(bounds)
    height = round(crop.height * width / crop.width)
    crop = crop.resize((width, height), Image.Resampling.LANCZOS)
    im.paste(crop, xy)
    ImageDraw.Draw(im).rectangle((xy[0], xy[1], xy[0]+width-1, xy[1]+height-1), outline=SOFT, width=2)


def feature_cards():
    global CURRENT
    post = "02-expiring-first"
    CURRENT = f"{post}/01.png"
    im = base("오늘의 장고 사용법", 1, dark=True)
    text(im, (88, 287), "오늘 저녁", 92, IVORY)
    text(im, (88, 408), "고민될 땐,", 92, IVORY)
    text(im, (88, 538), "‘임박 우선’", 109, SOFT)
    text(im, (88, 816), "기한이 가까운 재료로\n메뉴 고르기", 51, IVORY, "Medium")
    text(im, (88, 1102), "현재 앱 UI · 예시 데이터 시연", 48, IVORY)
    mascot(im, "cooking", (611, 724), 456)
    save(im, post, 1)

    CURRENT = f"{post}/02.png"
    im = base("STEP 01 · 조건 확인", 2)
    text(im, (88, 284), "추천 화면에서\n조건을 확인해요.", 79)
    screen_crop(im, "overview", (48, 427, 792, 691), (88, 615))
    text(im, (88, 1000), "재료 · 인원 · 시간 · 끼니까지\n추천 조건을 살펴보세요.", 48, INK, "Medium")
    text(im, (88, 1170), "현재 앱 UI · 예시 데이터", 30, GREEN, "Medium", essential=False)
    save(im, post, 2)

    CURRENT = f"{post}/03.png"
    im = base("STEP 02 · 설정 확인", 3)
    text(im, (88, 284), "‘임박 우선’이", 83)
    text(im, (88, 399), "켜져 있는지 확인해요.", 73)
    text(im, (88, 582), "켜짐", 56, GREEN)
    screen_crop(im, "options", (48, 1337, 792, 1538), (88, 684))
    text(im, (88, 1009), "기한이 가까운 재료를\n먼저 활용하도록 선택해요.", 48, INK, "Medium")
    text(im, (88, 1170), "현재 앱 UI 일부 · 예시 데이터", 30, GREEN, "Medium", essential=False)
    save(im, post, 3)

    CURRENT = f"{post}/04.png"
    im = base("STEP 03 · 메뉴 선택", 4)
    text(im, (88, 284), "마음에 드는\n요리를 골라요.", 79)
    screen_crop(im, "overview", (50, 823, 790, 1023), (88, 508))
    screen_crop(im, "detail", (48, 562, 792, 930), (88, 760))
    save(im, post, 4)


TAGS = "#장고야부탁해 #자취생활 #냉장고털이 #유통기한관리 #오늘뭐먹지"
CTA = "프로필에서 iPhone · Android 앱을 다운로드하고, 자주 남기는 재료 하나부터 등록해 보세요."
CAPTIONS = {
    "01-shopping-check": "장 보러 갔다가, 집에 있는 재료를 또 산 적 있나요?\n\n장보기 전 장고 보관함에서 이미 있는 재료와 남은 양, 유통기한을 확인해 보세요.",
    "02-expiring-first": "먼저 쓸 재료는 보이는데, 메뉴가 떠오르지 않는다면.\n\n추천 조건에서 ‘임박 우선’이 켜져 있는지 확인하고, 마음에 드는 요리를 골라 보세요.\n\n현재 앱 UI에 예시 재료와 메뉴를 적용한 시연 화면입니다.",
    "03-reel-edit": "잊고 있던 재료도, 오늘의 한 끼로.\n\n재료와 유통기한을 관리하고, 내 재료로 만들 요리를 추천받아 보세요.\n\nAI로 제작한 영상을 편집했습니다. 영상 속 메뉴와 앱 화면은 연출 예시입니다.",
}
ALTS = {
    "01-shopping-check": [
        "장보기 전 체크리스트 표지. ‘마트 가기 전, 냉장고에서 확인할 3가지’. 이미 있는 재료, 남은 양, 먼저 쓸 재료를 확인하라고 안내하며 체크리스트를 든 민트색 냉장고 캐릭터 장고가 보입니다.",
        "첫 번째 확인 항목은 이미 있는 재료입니다. 같은 재료를 또 사기 전에 보관함부터 확인하라고 안내하며 냉장·냉동·팬트리의 우리 집 재료를 한 번 더 확인하라고 적혀 있습니다.",
        "두 번째 확인 항목은 남은 양입니다. 얼마나 남았는지 살펴보고 이번에 살 양을 정하라고 안내합니다. 남은 양의 예시로 두부 반 모와 달걀 두 개를 보여줍니다.",
        "세 번째 확인 항목은 먼저 쓸 재료입니다. 기한이 가까운 재료부터 이번 식사에 활용하라고 안내합니다. 장보기 전 장고 보관함을 확인하고 프로필에서 앱을 다운로드하라고 적혀 있으며 장고가 장바구니를 밀고 있습니다.",
    ],
    "02-expiring-first": [
        "장고야 부탁해 기능 소개 표지. ‘오늘 저녁 고민될 땐, 임박 우선’. 기한이 가까운 재료로 메뉴를 고르는 방법을 소개하며 요리 접시를 든 장고가 보입니다. 현재 앱 UI에 예시 데이터를 적용한 시연임을 표시합니다.",
        "첫 단계, 추천 화면에서 조건을 확인해요. 현재 앱의 추천 화면 일부에 ‘이번 추천 설정’, 재료 자동, 2인, 30분, 끼니 무관, 임박 우선이 보입니다. 예시 데이터로 촬영한 시연 화면입니다.",
        "두 번째 단계, ‘임박 우선’이 켜져 있는지 확인해요. 현재 앱 설정의 ‘임박 재료를 먼저 쓸까요?’ 영역과 켜진 스위치를 확대해 보여줍니다. 기한이 가까운 재료를 먼저 활용하도록 선택하라는 안내이며 예시 데이터 시연입니다.",
        "마지막 단계, 마음에 드는 요리를 골라요. 예시 추천 메뉴 두부버섯볶음은 20분, 2인분, 쉬움으로 표시됩니다. 요리 상세의 사용할 재료에는 두부 200그램과 D-1, 버섯 100그램과 D-2, 달걀 2개와 D-5가 보입니다. 메뉴와 날짜는 예시 데이터입니다.",
    ],
}


def write_records():
    SOURCES[str(PALETTE_FILE.relative_to(ROOT))] = sha(PALETTE_FILE)
    previous_path = OUT / "production-record.json"
    record = json.loads(previous_path.read_text()) if previous_path.exists() else {}
    record.update({"id": OUT.name, "account": "jango_plz", "authorization": "User explicitly requested implementation and upload of all three planned follow-up posts.",
                   "method": "Direct Pretendard typography/geometric layouts, whole existing v18 app derivatives; no new character drawing.",
                   "sources": {**record.get("sources", {}), **SOURCES},
                   "textBoxes": [t for t in record.get("textBoxes", []) if t["file"] not in {x["file"] for x in TEXT_BOXES}] + TEXT_BOXES,
                   "originalsPreserved": True})
    previous_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    posts = []
    for post, body in CAPTIONS.items():
        folder = OUT / post
        folder.mkdir(exist_ok=True)
        caption = body + "\n\n" + CTA + "\n\n" + TAGS
        (folder / "caption.txt").write_text(caption + "\n")
        slides = []
        for i, alt in enumerate(ALTS.get(post, []), 1):
            f = folder / f"{i:02}.png"
            if f.exists():
                slides.append({"file": str(f.relative_to(OUT)), "alt": alt, "sha256": sha(f), "width": 1080, "height": 1350})
        posts.append({"id": post, "caption": caption, "slides": slides})
    (OUT / "content.json").write_text(json.dumps({"account": "jango_plz", "publishOrder": list(CAPTIONS), "posts": posts}, ensure_ascii=False, indent=2) + "\n")


def review(post):
    folder = OUT / "review"
    folder.mkdir(exist_ok=True)
    files = sorted((OUT / post).glob("[0-9][0-9].png"))
    contact = Image.new("RGB", (360 * len(files), 450), "white")
    thumbs = Image.new("RGB", (270 * len(files), 360), "white")
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGB")
        assert im.size == SIZE
        contact.paste(im.resize((360, 450), Image.Resampling.LANCZOS), (360 * i, 0))
        thumbs.paste(ImageOps.fit(im, (270, 360), Image.Resampling.LANCZOS), (270 * i, 0))
    contact.save(folder / f"{post}-360.jpg", quality=95)
    thumbs.save(folder / f"{post}-grid.jpg", quality=95)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("part", choices=["shopping", "feature"])
    args = parser.parse_args()
    if args.part == "shopping":
        shopping_cards()
        review("01-shopping-check")
    if args.part == "feature":
        feature_cards()
        review("02-expiring-first")
    write_records()
