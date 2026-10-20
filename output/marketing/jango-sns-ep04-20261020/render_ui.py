"""Offline promotional UI, using current app tokens, fonts and verified copy.

This is an enlarged/abridged illustration of the app, not a runtime screenshot.
No API, accounts or production data are involved.
"""
from pathlib import Path
import json
import re
from PIL import Image, ImageDraw, ImageFont, ImageOps

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TOKENS = json.loads((OUT / "ui/design-tokens.json").read_text())
C = TOKENS["colors"]
S = 3
FONT = ROOT / "apps/mobile/assets/fonts"
METRICS = []


class Screen:
    def __init__(self, name, size=(360, 700), color=None):
        self.name = name
        self.size = size
        self.im = Image.new("RGBA", (size[0]*S, size[1]*S),
                            color or C["background"])
        self.d = ImageDraw.Draw(self.im)

    def box(self, rect, color, radius=0, outline=None, stroke=1):
        xy = tuple(round(v*S) for v in rect)
        if isinstance(color, str) and color.startswith("rgba"):
            r, g, b, a = map(float, re.findall(r"[\d.]+", color))
            layer = Image.new("RGBA", self.im.size)
            ImageDraw.Draw(layer).rounded_rectangle(
                xy, radius=radius*S, fill=(int(r), int(g), int(b), round(a*255)))
            self.im.alpha_composite(layer)
            self.d = ImageDraw.Draw(self.im)
            return
        self.d.rounded_rectangle(xy, radius=radius*S, fill=color,
                                 outline=outline, width=stroke*S)

    def line(self, pts, color, width=2):
        self.d.line([(round(x*S), round(y*S)) for x, y in pts],
                    fill=color, width=width*S, joint="curve")

    def text(self, copy, xy, size, bold=False, color=None, anchor="lt",
             max_width=None, line_gap=8):
        font = ImageFont.truetype(str(FONT / (
            "Pretendard-Bold.otf" if bold else "Pretendard-Regular.otf")), size*S)
        for line_n, line in enumerate(copy.split("\n")):
            x, y = xy[0]*S, (xy[1]+line_n*(size+line_gap))*S
            b = self.d.textbbox((0, 0), line, font=font)
            w, h = b[2]-b[0], b[3]-b[1]
            if max_width is not None:
                assert w <= max_width*S, (self.name, line, w/S, max_width)
            if anchor.startswith("m"):
                x -= w/2
            elif anchor.startswith("r"):
                x -= w
            self.d.text((round(x-b[0]), round(y-b[1])), line, font=font,
                        fill=color or C["text"])
            METRICS.append({"screen": self.name, "copy": line, "size": size,
                            "bbox": [x/S, y/S, (x+w)/S, (y+h)/S]})

    def button(self, label, y, disabled=False):
        self.box((20, y, 340, y+72),
                 C["disabled"] if disabled else C["actionPrimaryBackground"],
                 radius=TOKENS["radius"]["lg"])
        self.text(label, (180, y+20), 36, bold=True,
                  color=C["disabledText"] if disabled else C["actionPrimaryForeground"],
                  anchor="mt", max_width=288)

    def icon(self, kind, center, size, color, width=2):
        # Small code-native control pictograms, matching existing outline UI.
        x, y = center
        r = size/2
        if kind == "check":
            self.line([(x-r*.65, y), (x-r*.15, y+r*.5),
                       (x+r*.75, y-r*.6)], color, width)
        elif kind == "close":
            self.line([(x-r*.5, y-r*.5), (x+r*.5, y+r*.5)], color, width)
            self.line([(x+r*.5, y-r*.5), (x-r*.5, y+r*.5)], color, width)
        elif kind == "camera":
            self.box((x-r, y-r*.65, x+r, y+r*.65), None, 4, color, width)
            self.box((x-r*.4, y-r*.95, x+r*.4, y-r*.62), color, 2)
            self.d.ellipse(((x-r*.38)*S, (y-r*.38)*S,
                            (x+r*.38)*S, (y+r*.38)*S), outline=color, width=width*S)
        elif kind == "calendar":
            self.box((x-r*.8, y-r*.7, x+r*.8, y+r*.85), None, 3, color, width)
            self.line([(x-r*.8,y-r*.2),(x+r*.8,y-r*.2)],color,width)
            for dx in [-.4,.4]:
                self.line([(x+r*dx,y-r),(x+r*dx,y-r*.45)],color,width)
        elif kind == "trash":
            self.line([(x-r*.55,y-r*.4),(x-r*.45,y+r*.7),
                       (x+r*.45,y+r*.7),(x+r*.55,y-r*.4)],color,width)
            self.line([(x-r*.75,y-r*.55),(x+r*.75,y-r*.55)],color,width)
            self.line([(x-r*.25,y-r*.8),(x+r*.25,y-r*.8)],color,width)

    def save(self):
        path = OUT / "ui" / f"{self.name}.png"
        self.im.save(path)
        return path


def receipt():
    s = Screen("receipt", (240, 450), "#FFFCF7")
    s.text("장보기 내역", (120, 30), 28, bold=True, anchor="mt")
    s.text("시연용 영수증", (120, 75), 17, anchor="mt", color=C["subtext"])
    s.line([(20,110),(220,110)],C["borderControl"],1)
    rows = [("두부","1개","2,900"),("달걀","6개","4,200"),("요거트","1개","1,200")]
    for i,(name,qty,price) in enumerate(rows):
        y=142+i*57
        s.text(name,(20,y),25,bold=True)
        s.text(qty,(117,y+4),17)
        s.text(price,(220,y+4),17,anchor="rt")
    s.line([(20,326),(220,326)],C["borderControl"],1)
    s.text("합계",(20,354),22,bold=True)
    s.text("8,300원",(220,354),22,bold=True,anchor="rt")
    s.text("예시 데이터",(120,408),16,anchor="mt",color=C["subtext"])
    return s.save()


def review(ready):
    s=Screen("ready" if ready else "candidates")
    s.box((20,28,204,64),C["primarySoft"],12)
    s.text("2/2 결과 확인",(32,36),23,bold=True,color=C["primaryForeground"])
    s.text("이 재료들이\n맞나요?",(22,90),42,bold=True,line_gap=8,max_width=316)
    if ready:
        s.text("바로 저장 3개",(24,195),25,bold=True,color=C["primaryForeground"])
    else:
        s.text("내용을 확인해 주세요",(24,195),24,color=C["subtext"])
    rows=[("두부","1개","10/25"),("달걀","6개","11/02"),("요거트","1개","10/28")]
    for i,(name,qty,date) in enumerate(rows):
        y=239+i*94
        s.box((20,y,340,y+84),C["surface"],20,
              C["borderSubtle"] if ready else C["warningAccent"],1)
        s.text(name,(36,y+13),39,bold=True)
        if ready:
            s.icon("trash",(316,y+28),18,C["mutedText"],1)
            s.text(f"{qty} · 냉장 · {date}",(36,y+58),21,color=C["subtext"],max_width=285)
        else:
            s.box((224,y+15,323,y+43),C["warningSoft"],8)
            s.text("확인 필요",(274,y+20),19,bold=True,
                   color=C["warningForeground"],anchor="mt",max_width=92)
            s.text(f"{qty} · 기한 확인 필요",(36,y+58),21,
                   color=C["subtext"],max_width=285)
    if ready:
        s.button("재료 추가",540)
        s.text("입력·확인 과정 축약",(180,638),21,anchor="mt",color=C["subtext"])
    else:
        s.box((20,540,340,622),C["disabled"],16)
        s.text("확인이 필요한\n재료가 있어요",(180,555),27,bold=True,
               anchor="mt",line_gap=8,color=C["disabledText"],max_width=290)
        s.text("인식 결과는 직접 확인해요",(180,648),20,anchor="mt",color=C["subtext"])
    return s.save()


def details():
    s=Screen("details")
    s.box((148,22,212,28),C["borderSubtle"],3)
    s.text("이 재료를\n고칠까요?",(22,61),41,bold=True,line_gap=8)
    s.text("재료 이름",(24,174),23,color=C["subtext"])
    s.box((20,211,340,276),C["surface"],16,C["borderControl"])
    s.text("두부",(36,226),35,bold=True)
    s.text("수량",(24,301),23,color=C["subtext"])
    s.box((136,292,340,345),C["surface"],16,C["borderControl"])
    s.text("−",(161,306),25,anchor="mt")
    s.text("1개",(238,305),28,bold=True,anchor="mt")
    s.text("+",(312,306),25,anchor="mt")
    s.text("보관 위치",(24,372),23,color=C["subtext"])
    for i,label in enumerate(["냉장","냉동","실온"]):
        x=20+i*108
        s.box((x,407,x+104,462),C["primarySoft"] if i==0 else C["surface"],
              12,C["primaryForeground"] if i==0 else C["borderControl"])
        s.text(label,(x+52,421),28,bold=i==0,anchor="mt",
               color=C["primaryForeground"] if i==0 else C["subtext"])
    s.text("유통기한",(24,487),23,color=C["subtext"])
    s.box((20,522,340,581),C["surface"],16,C["borderControl"])
    s.text("2026.10.25",(36,537),32,bold=True,max_width=250)
    s.icon("calendar",(310,551),24,C["primaryForeground"])
    s.button("내용 확인",604)
    return s.save()


def camera(receipt_path):
    s=Screen("camera",(360,720),"#544C42")
    # The receipt sits on the same warm table as the scene. This preview is a
    # deliberately illustrated example; no photo-analysis API was called.
    bg=Image.open(OUT/"source-art/scene-02-r1.png").convert("RGBA")
    bg=bg.crop((420,1180,930,1672))
    bg=ImageOps.fit(bg,s.im.size,Image.Resampling.LANCZOS)
    s.im.alpha_composite(bg)
    shade=Image.new("RGBA",s.im.size,(22,30,24,95));s.im.alpha_composite(shade)
    s.d=ImageDraw.Draw(s.im)
    s.box((102,25,258,66),C["cameraControl"],20)
    s.text("1/2 사진",(180,37),24,bold=True,color="#FFFFFF",anchor="mt")
    s.icon("close",(34,46),25,"#FFFFFF",3)
    s.text("영수증 전체가\n보이게 맞춰 주세요",(180,88),27,bold=True,
           color="#FFFFFF",anchor="mt",line_gap=8,max_width=320)
    paper=Image.open(receipt_path).convert("RGBA")
    paper=paper.resize((160*S,300*S),Image.Resampling.LANCZOS)
    s.im.alpha_composite(paper,(100*S,168*S));s.d=ImageDraw.Draw(s.im)
    for x,y,sx,sy in [(83,154,1,1),(277,154,-1,1),(83,480,1,-1),(277,480,-1,-1)]:
        s.line([(x,y+sy*28),(x,y),(x+sx*28,y)],"#FFFFFF",3)
    s.box((0,504,360,720),C["surfaceWarm"],24)
    s.text("무엇을 담고 있나요?",(180,521),21,anchor="mt",color=C["subtext"])
    for x,label,selected in [(18,"영수증",True),(187,"냉장고",False)]:
        s.box((x,560,x+155,611),C["primarySoft"] if selected else C["surface"],
              12,C["primaryForeground"] if selected else C["borderControl"])
        s.text(label,(x+77,573),28,bold=True,anchor="mt",
               color=C["primaryForeground"] if selected else C["subtext"])
    s.d.ellipse((148*S,633*S,212*S,697*S),fill=C["actionPrimaryBackground"])
    s.icon("camera",(180,665),30,"#FFFFFF",2)
    s.text("앨범",(52,657),23,anchor="mt",color=C["subtext"])
    return s.save()


def analysis():
    s=Screen("analysis",(360,720))
    s.text("사진 분석",(180,125),44,bold=True,anchor="mt")
    for start in [0,90,180,270]:
        s.d.arc((135*S,254*S,225*S,344*S),start,start+60,
                fill=C["primaryForeground"],width=8*S)
    s.text("글자와 재료를\n천천히 읽고 있어요.",(180,410),29,
           anchor="mt",line_gap=14,max_width=310)
    return s.save()


def complete():
    s=Screen("complete",(360,700))
    s.text("냉장고에\n넣어 뒀어요",(180,83),43,bold=True,anchor="mt",line_gap=12)
    s.text("3가지를 잘 넣어 뒀어요.",(180,215),24,anchor="mt",
           color=C["subtext"],max_width=320)
    mascot=Image.open(ROOT/"apps/mobile/assets/characters/jango-praise.png").convert("RGBA")
    mascot=ImageOps.contain(mascot,(240*S,280*S),Image.Resampling.LANCZOS)
    s.im.alpha_composite(mascot,((360*S-mascot.width)//2,287*S))
    s.button("보관함으로",594)
    return s.save()


if __name__=="__main__":
    rp=receipt()
    files=[camera(rp),analysis(),review(False),details(),review(True),complete()]
    (OUT/"ui/typography.json").write_text(json.dumps({
        "method":"Current app semantic colors and Pretendard; enlarged/abridged offline illustration, not a runtime screenshot.",
        "renderScale":S,"metrics":METRICS,
        "coreReadableLabels":["두부","달걀","요거트","재료 추가"],
        "secondaryDetails":"Dates, quantity and optional controls support the story; fixed dialogue carries the main instruction."
    },ensure_ascii=False,indent=2)+"\n")
    print("Rendered six clean app UI states and a consistent example receipt.")
