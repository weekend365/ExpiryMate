"""Build the approved Instagram launch pack without altering original artwork.

Run with Python + Pillow. Only typography, geometric layout, and proportional
placement/conversion of existing approved assets are used; no new Jango drawing.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
SIZE = (1080, 1350)
FONT_DIR = ROOT / "apps/mobile/assets/fonts"
PALETTE_PATH = ROOT / "packages/shared/src/design/palette.ts"
PALETTE = PALETTE_PATH.read_text()


def token(scale: str, step: int) -> str:
    section = re.search(rf"export const {scale}(?:: ColorScale)? = \{{(.*?)\}}", PALETTE, re.S)
    assert section is not None, scale
    match = re.search(rf"\b{step}: \"(#[0-9A-Fa-f]{{6}})\"", section[1])
    assert match is not None, (scale, step)
    return match[1]


IVORY = token("cream", 50)
INK = token("neutral", 900)
MINT = token("brand", 500)
SOFT = token("brand", 100)
PALE = token("brand", 50)
FOREST = token("brand", 900)
GREEN = token("brand", 700)
MUTED = token("sage", 600)
TEXT_BOXES: list[dict] = []
CURRENT = ""


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size: int, weight: str = "Bold") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / f"Pretendard-{weight}.otf"), size)


def text(image: Image.Image, xy: tuple[int, int], lines: str, size: int,
         fill: str = INK, weight: str = "Bold", leading: float = 1.24) -> int:
    draw = ImageDraw.Draw(image)
    x, y = xy
    face = font(size, weight)
    for line in lines.split("\n"):
        bbox = draw.textbbox((x, y), line, font=face, anchor="lt")
        assert bbox[0] >= 48 and bbox[2] <= 1032, (CURRENT, line, bbox)
        assert bbox[1] >= 40 and bbox[3] <= 1320, (CURRENT, line, bbox)
        draw.text((x, y), line, font=face, fill=fill, anchor="lt")
        TEXT_BOXES.append({"file": CURRENT, "text": line, "fontSize": size,
                           "bbox": list(bbox), "essential": size >= 44})
        y += round(size * leading)
    return y


def line(image: Image.Image, y: int, color: str = SOFT) -> None:
    ImageDraw.Draw(image).line((88, y, 992, y), fill=color, width=2)


def base(label: str, page: int, total: int, *, dark: bool = False,
         background: str | None = None) -> Image.Image:
    image = Image.new("RGB", SIZE, background or (FOREST if dark else IVORY))
    fg, secondary = (IVORY, SOFT) if dark else (INK, MUTED)
    text(image, (88, 75), "장고야 부탁해", 34, fg)
    text(image, (800, 80), "@jango_plz", 28, secondary, "Medium")
    line(image, 143, GREEN if dark else SOFT)
    text(image, (88, 177), label, 28, SOFT if dark else GREEN, "SemiBold")
    text(image, (895, 177), f"{page:02} / {total:02}", 26, secondary, "Medium")
    line(image, 1243, GREEN if dark else SOFT)
    text(image, (88, 1273), "내 재료로 오늘의 한 끼", 28, secondary, "Medium")
    text(image, (820, 1273), "장고에게 부탁해", 27, secondary, "Medium")
    return image


def save(image: Image.Image, post: str, number: int) -> str:
    directory = OUT / post
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{number:02}.png"
    image.save(target, optimize=True)
    return str(target.relative_to(OUT))


def build_cards() -> None:
    global CURRENT
    CURRENT = "01-intro/01.png"
    im = base("남은 재료로, 오늘의 메뉴까지", 1, 3)
    text(im, (88, 276), "재료는 있는데,", 91)
    text(im, (88, 405), "오늘 뭐 먹지?", 104, GREEN)
    text(im, (88, 592), "냉장고 속 재료로\n오늘의 한 끼를 찾아요.", 50, INK, "Medium")
    # Existing transparent source of the approved app icon, whole image,
    # uniform scale. No character edit, recrop, or recoloring.
    icon = Image.open(ROOT / "apps/mobile/assets/characters/jango-icon-crop.png").convert("RGBA")
    icon.thumbnail((454, 454), Image.Resampling.LANCZOS)
    im.paste(icon, (568, 746), icon)
    text(im, (88, 885), "재료 관리부터\n요리 추천까지", 55, GREEN)
    text(im, (88, 1115), "장고야 부탁해", 43)
    save(im, "01-intro", 1)

    CURRENT = "01-intro/02.png"
    im = base("기억 대신, 기록해요", 2, 3)
    text(im, (88, 287), "뭐가 있는지,\n언제까지인지.", 96)
    text(im, (88, 567), "냉장 · 냉동 · 팬트리 재료를\n한곳에 기록하고 살펴보세요.", 49, INK, "Medium")
    ImageDraw.Draw(im).rectangle((0, 797, 1080, 1170), fill=SOFT)
    text(im, (88, 869), "장보기 전에\n냉장고부터 확인해요.", 74, FOREST)
    save(im, "01-intro", 2)

    CURRENT = "01-intro/03.png"
    im = base("오늘은, 재료 하나부터", 3, 3, dark=True)
    text(im, (88, 292), "내 재료로\n오늘의 요리 추천", 88, IVORY)
    text(im, (88, 563), "마음에 드는 메뉴를 고르고\n한 끼를 시작해 보세요.", 48, SOFT, "Medium")
    ImageDraw.Draw(im).rounded_rectangle((72, 812, 1008, 1090), radius=28, fill=IVORY)
    text(im, (112, 865), "오늘은 자주 남기는\n재료 하나부터\n등록해 보세요.", 55, FOREST, leading=1.2)
    text(im, (88, 1154), "프로필에서 앱 다운로드", 42, IVORY, "SemiBold")
    save(im, "01-intro", 3)

    CURRENT = "03-howto/01.png"
    im = base("처음 쓰는 장고 안내서", 1, 4, background=SOFT)
    text(im, (88, 280), "장고 처음이라면,", 89)
    text(im, (88, 408), "딱 3단계", 112, GREEN)
    for y, n, title in [(661, "01", "재료 등록"), (778, "02", "기한 확인"), (895, "03", "메뉴 선택")]:
        text(im, (88, y), n, 50, GREEN)
        text(im, (230, y - 3), title, 58)
        ImageDraw.Draw(im).line((88, y + 82, 992, y + 82), fill=MINT, width=2)
    text(im, (88, 1090), "한 번에 다 정리하지 않아도 괜찮아요.\n재료 하나로 가볍게 시작해요.", 44, FOREST, "Medium")
    save(im, "03-howto", 1)

    CURRENT = "03-howto/02.png"
    im = base("STEP 01 · 재료 등록", 2, 4)
    text(im, (88, 277), "01", 157, GREEN)
    text(im, (88, 507), "재료와 기한을\n등록해요.", 96)
    text(im, (88, 803), "재료 이름 · 수량 · 유통기한을\n입력해 두세요.", 49, INK, "Medium")
    ImageDraw.Draw(im).rounded_rectangle((72, 1011, 1008, 1192), radius=24, fill=PALE)
    text(im, (108, 1053), "자주 남기는 재료 하나로\n시작해도 괜찮아요.", 47, GREEN, "SemiBold")
    save(im, "03-howto", 2)

    CURRENT = "03-howto/03.png"
    im = base("STEP 02 · 기한 확인", 3, 4)
    text(im, (88, 277), "02", 157, GREEN)
    text(im, (88, 507), "기한이 가까운\n재료를 확인해요.", 87)
    text(im, (88, 795), "보관함에서 남은 재료와\n유통기한을 살펴보세요.", 49, INK, "Medium")
    line(im, 999, MINT)
    text(im, (88, 1052), "잊고 있던 재료부터,\n오늘의 한 끼로.", 57, GREEN)
    save(im, "03-howto", 3)

    CURRENT = "03-howto/04.png"
    im = base("STEP 03 · 메뉴 선택", 4, 4, dark=True)
    text(im, (88, 277), "03", 157, MINT)
    text(im, (88, 509), "‘임박 우선’을 켜고\n메뉴를 골라요.", 79, IVORY)
    text(im, (88, 757), "기한이 가까운 재료를 먼저 활용하도록\n추천 조건을 선택해 보세요.", 45, SOFT, "Medium")
    line(im, 942, GREEN)
    text(im, (88, 993), "마음에 드는 요리를 골라\n‘이 요리 시작’을 눌러 보세요.", 48, IVORY, "SemiBold")
    text(im, (88, 1163), "프로필에서 앱 다운로드", 40, SOFT, "Medium")
    save(im, "03-howto", 4)


def prepare_cartoon(registry: dict) -> None:
    directory = OUT / "02-cartoon"
    directory.mkdir(exist_ok=True)
    for panel in registry["approvedPanels"]:
        source = ROOT / panel["file"]
        assert digest(source) == panel["sha256"], source
        original = Image.open(source).convert("RGB")
        # Contain rather than stretch the approved 1122x1402 original.
        resized = ImageOps.contain(original, SIZE, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", SIZE, IVORY)
        canvas.paste(resized, ((1080 - resized.width) // 2, (1350 - resized.height) // 2))
        canvas.save(directory / f"{panel['number']:02}.png", optimize=True)


def write_content() -> dict:
    tags = "#장고야부탁해 #자취생활 #냉장고털이 #유통기한관리 #오늘뭐먹지"
    cta = "프로필에서 iPhone · Android 앱을 다운로드하고, 자주 남기는 재료 하나부터 등록해 보세요."
    captions = {
        "01-intro": "재료는 있는데, 오늘 뭐 먹지?\n\n장고야 부탁해는 냉장고 속 재료와 유통기한을 기록하고, 내 재료로 만들 요리를 추천받는 앱이에요.\n장보기 전에는 남은 재료를 확인하고, 메뉴가 고민될 땐 마음에 드는 요리를 골라 보세요.\n\n냉장고를 한 번에 모두 정리하지 않아도 괜찮아요.\n오늘은 자주 남기는 재료 하나부터 등록해 보세요.\n\n" + cta + "\n\n" + tags,
        "02-cartoon": "장도 봤는데, 또 배달 앱을 켰다면.\n잊고 있던 두부로 오늘 저녁을 골라봤어요.\n\n장고야 부탁해에 재료를 등록해 두고, 내 재료로 오늘 메뉴를 찾아보세요.\n‘임박 우선’을 켜면 유통기한이 가까운 재료를 먼저 활용하는 요리를 추천받을 수 있어요.\n추천된 메뉴를 살펴보고 마음에 드는 요리를 골라 시작해 보세요.\n\n만화 속 두부달걀부침과 기한은 이야기용 예시입니다. 휴대전화 화면은 실제 요리 상세 기능의 일부를 간략히 표현했습니다.\n\n" + cta + "\n\n" + tags + " #장고툰",
        "03-howto": "장고 처음이라면, 재료 하나로 가볍게 시작해요.\n\n① 재료 이름과 수량, 유통기한을 등록해요.\n② 보관함에서 남은 재료와 기한을 확인해요.\n③ 추천 조건에서 ‘임박 우선’을 켜고, 마음에 드는 메뉴를 골라요.\n\n마음에 드는 요리를 찾았다면 ‘이 요리 시작’을 눌러 보세요.\n다음 장보기 전에도 남은 재료를 살펴볼 수 있어요.\n\n" + cta + "\n\n" + tags,
    }
    alts = {
        "01-intro": [
            "장고야 부탁해 앱 소개 첫 장. 아이보리 바탕에 ‘재료는 있는데, 오늘 뭐 먹지?’라고 적혀 있고, 요리 접시를 든 민트색 냉장고 캐릭터 장고가 보입니다. 냉장고 속 재료로 오늘의 한 끼를 찾는 앱을 소개합니다.",
            "앱 소개 두 번째 장. ‘뭐가 있는지, 언제까지인지.’ 냉장·냉동·팬트리 재료를 한곳에 기록하고 살펴보며 장보기 전에 냉장고 재료를 확인하라고 안내합니다.",
            "앱 소개 마지막 장. 짙은 초록 바탕에 내 재료로 오늘의 요리를 추천받고 마음에 드는 메뉴로 한 끼를 시작하라고 안내합니다. 오늘은 자주 남기는 재료 하나부터 등록해 보세요. 프로필에서 앱을 다운로드할 수 있습니다.",
        ],
        "02-cartoon": [
            "장고툰 1컷. 주방에 앉아 휴대전화를 보는 여성이 ‘냉장고에 뭐 있더라… 그냥 배달 시킬까?’라고 고민하고 작은 냉장고 캐릭터 장고가 옆에 서 있습니다.",
            "장고툰 2컷. 열린 냉장고 앞에서 장고가 두부를 들고 ‘두부, 내일까지예요.’라고 말합니다. 여성은 ‘맞다. 저걸 또 잊었네.’라고 답합니다. 두부와 기한은 이야기용 예시입니다.",
            "장고툰 3컷. 여성이 장고야 부탁해의 요리 상세를 간략히 그린 휴대전화 화면에서 두부달걀부침과 사용할 재료, ‘이 요리 시작’을 확인합니다. ‘등록한 재료로 추천해 주네. 오늘은 두부달걀부침!’이라고 말합니다. 메뉴와 기한은 이야기용 예시입니다.",
            "장고툰 4컷. 여성과 장고가 식탁에서 두부달걀부침을 먹으며 ‘오늘 저녁은 냉장고 안에 있었네!’라고 말합니다. 아래에는 ‘장고야 부탁해, 내 재료로 오늘 메뉴 찾기’가 적혀 있습니다.",
        ],
        "03-howto": [
            "장고야 부탁해 처음 쓰는 법 표지. ‘장고 처음이라면, 딱 3단계.’ 재료 등록, 기한 확인, 메뉴 선택의 세 단계를 안내하며 한 번에 다 정리하지 않고 재료 하나부터 시작해도 된다고 설명합니다.",
            "첫 번째 단계, 재료 등록. 재료 이름과 수량, 유통기한을 입력합니다. 자주 남기는 재료 하나로 시작해도 괜찮다고 안내합니다.",
            "두 번째 단계, 기한 확인. 보관함에서 남은 재료와 유통기한을 살펴보고 기한이 가까운 재료를 확인하라고 안내합니다. ‘잊고 있던 재료부터, 오늘의 한 끼로.’라고 적혀 있습니다.",
            "세 번째 단계, 메뉴 선택. 추천 조건에서 ‘임박 우선’을 켜 기한이 가까운 재료를 먼저 활용하도록 선택하고, 마음에 드는 요리의 ‘이 요리 시작’을 누르라고 안내합니다. 프로필에서 앱을 다운로드할 수 있습니다.",
        ],
    }
    posts = []
    for directory, caption in captions.items():
        (OUT / directory / "caption.txt").write_text(caption + "\n")
        posts.append({"id": directory, "caption": caption, "slides": [
            {"file": f"{directory}/{i:02}.png", "alt": alt,
             "sha256": digest(OUT / directory / f"{i:02}.png"), "width": 1080, "height": 1350}
            for i, alt in enumerate(alts[directory], 1)
        ]})
    data = {
        "account": "jango_plz", "displayName": "장고야 부탁해", "audience": "자취·1인 가구",
        "bio": "냉장고 속 재료, 잊기 전에 한 끼로 🥕\n유통기한 관리 · 내 재료로 요리 추천\n자취 식재료 고민은 장고에게 부탁해\n👇 iPhone · Android 다운로드",
        "links": [{"title": "iPhone 다운로드", "url": "https://apps.apple.com/kr/app/id6793375883"},
                  {"title": "Android 다운로드", "url": "https://play.google.com/store/apps/details?id=com.expirymate.mobile"}],
        "publishOrder": ["03-howto", "02-cartoon", "01-intro"], "posts": posts,
    }
    assert len(data["bio"]) <= 150
    (OUT / "content.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    (OUT / "profile-bio.txt").write_text(data["bio"] + "\n")
    return data


def reviews(data: dict) -> None:
    directory = OUT / "review"
    directory.mkdir(exist_ok=True)
    # Review each slide at a true width of 360px, not a scaled whole comic sheet.
    sheet = Image.new("RGB", (4 * 372 + 12, 3 * 488 + 12), "#FFFFFF")
    draw = ImageDraw.Draw(sheet)
    n = 0
    for post in data["posts"]:
        for slide in post["slides"]:
            small = Image.open(OUT / slide["file"]).resize((360, 450), Image.Resampling.LANCZOS)
            x, y = 12 + (n % 4) * 372, 12 + (n // 4) * 488
            sheet.paste(small, (x, y))
            draw.text((x, y + 458), slide["file"], font=font(16, "Medium"), fill=INK)
            n += 1
    sheet.save(directory / "all-slides-360.png", optimize=True)
    grid = Image.new("RGB", (1080, 535), IVORY)
    icon = Image.open(OUT / "profile-icon.png").convert("RGB").resize((120, 120), Image.Resampling.LANCZOS)
    mask = Image.new("L", icon.size)
    ImageDraw.Draw(mask).ellipse((0, 0, 119, 119), fill=255)
    grid.paste(icon, (24, 16), mask)
    gd = ImageDraw.Draw(grid)
    gd.text((170, 35), "jango_plz  |  장고야 부탁해", font=font(30), fill=INK)
    gd.text((170, 86), "소개  →  장고툰  →  사용법", font=font(24, "Medium"), fill=MUTED)
    for i, post in enumerate(data["posts"]):
        thumb = ImageOps.fit(Image.open(OUT / post["slides"][0]["file"]), (356, 380), Image.Resampling.LANCZOS)
        grid.paste(thumb, (i * 362, 155))
    grid.save(directory / "profile-grid-preview.png", optimize=True)


def main() -> None:
    registry = json.loads((ROOT / "design/jango/cartoon-series.json").read_text())
    source_files = [ROOT / "apps/mobile/assets/branding/icon.png",
                    ROOT / "apps/mobile/assets/characters/jango-icon-crop.png",
                    ROOT / "design/jango/emoticons/kakao-32/v18/source-originals/24-r2.png",
                    ROOT / "design/jango/masters/v18/master.json",
                    ROOT / "design/jango/cartoon-series.json", PALETTE_PATH,
                    *[FONT_DIR / f"Pretendard-{weight}.otf" for weight in ["Bold", "SemiBold", "Medium"]],
                    *[ROOT / p["file"] for p in registry["approvedPanels"]]]
    before = {str(p.relative_to(ROOT)): digest(p) for p in source_files}
    shutil.copyfile(ROOT / "apps/mobile/assets/branding/icon.png", OUT / "profile-icon.png")
    build_cards()
    prepare_cartoon(registry)
    data = write_content()
    reviews(data)
    assert all(digest(ROOT / p) == sha for p, sha in before.items())
    record = {
        "id": "instagram-jango-plz-20261015", "dateKst": "2026-10-15",
        "authorization": "User explicitly requested implementation of the complete profile and three-post plan in this conversation.",
        "method": "Pillow typography/geometric layout and uniform placement/conversion of existing assets. No new character drawing or generative image edits.",
        "characterMaster": "v18 original 24; unchanged existing app icon derivative",
        "cartoon": "Previously user-adopted v6, approved panels 1–4, unchanged source bytes; proportional 1080x1350 distribution copies",
        "sources": before, "originalsUnchanged": True,
        "profileIcon": {"file": "profile-icon.png", "sha256": digest(OUT / "profile-icon.png"), "identicalToAppIcon": True},
        "featureEvidenceCheckedAt": "2026-10-15",
        "featureEvidence": ["docs/product/release-scope.md", "apps/mobile/app/register.tsx", "apps/mobile/app/(tabs)/inventory.tsx", "apps/mobile/app/(tabs)/recommendations.tsx", "apps/mobile/src/features/recipes/recipe-detail-sheet.tsx"],
        "layout": {"size": [1080, 1350], "font": "Pretendard", "essentialMinimumFontPx": 44,
                   "reviewWidthPx": 360, "textBoxes": TEXT_BOXES},
        "publication": {"status": "not-yet-published", "mobileDownloadLinks": "awaiting-user-addition"},
    }
    (OUT / "production-record.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"slides": sum(len(p["slides"]) for p in data["posts"]), "bioCharacters": len(data["bio"]), "originalsUnchanged": True, "output": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
