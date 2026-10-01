#!/usr/bin/env python3
"""Rebuild v18 application/branding contact sheets from generated assets (Pillow)."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / 'design/jango'
ASSETS = ROOT / 'apps/mobile/assets'
manifest = json.loads((DESIGN / 'manifest.json').read_text())
font_path = DESIGN / 'emoticons/kakao-32/v18/fonts/Gaegu-Regular.ttf'
font = ImageFont.truetype(str(font_path), 23)
small = ImageFont.truetype(str(font_path), 18)

def place(canvas, source, box):
    image = Image.open(source).convert('RGBA')
    image.thumbnail((box[2], box[3]), Image.Resampling.LANCZOS)
    canvas.alpha_composite(image, (box[0] + (box[2]-image.width)//2, box[1]+(box[3]-image.height)//2))

for theme, background, ink in [('light', '#FDF8F2', '#4A4038'), ('dark', '#24342E', '#FDF8F2')]:
    board = Image.new('RGBA', (1200, 560), background)
    draw = ImageDraw.Draw(board)
    draw.text((24, 14), 'v18 앱 적용 · 전체 비율 유지 · 실제 표시 크기 52 / 72 / 120px', font=font, fill=ink)
    for column, pose in enumerate(p for p in manifest['poses'] if p['mood'] != 'icon-crop'):
        x = column*150
        draw.text((x+12, 64), f"{pose['mood']} / {pose['masterNumber']:02d}", font=small, fill=ink)
        for row, size in enumerate([52, 72, 120]):
            variant = 'small' if size <= 72 else 'full'
            source = ASSETS / f"characters/runtime/{variant}/jango-{pose['mood']}@3x.png"
            place(board, source, (x+(150-size)//2, 106+row*140, size, size))
    board.convert('RGB').save(DESIGN / f'app-review-{theme}.png')
board = Image.new('RGBA', (1000, 370), '#FDF8F2')
draw = ImageDraw.Draw(board)
draw.text((24, 14), '대표 24번에서 생성 · 앱 아이콘 / 스플래시 / 알림 실루엣', font=font, fill='#4A4038')
for column, (name, label) in enumerate([('icon', '앱 아이콘'), ('splash-icon', '스플래시'), ('notification-icon-192', '알림 실루엣')]):
    x = 30+column*330
    if column == 2:
        draw.rounded_rectangle((x, 65, x+280, 345), 16, fill='#24342E')
    place(board, ASSETS / f'branding/{name}.png', (x, 65, 280, 280))
    draw.text((x+20, 40), label, font=small, fill='#4A4038')
board.convert('RGB').save(DESIGN / 'branding-review.png')
print('Built app light/dark and branding review sheets from current generated assets.')
