"""Episode 4: preserve artwork, project clean UI, typeset fixed Korean, encode."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageChops, ImageFilter

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()
SIZE=(1080,1920)
GAEGU=ROOT/"design/jango/emoticons/kakao-32/v18/fonts/Gaegu-Bold.ttf"
UI=ROOT/"apps/mobile/assets/fonts/Pretendard-Bold.otf"
UI_REG=ROOT/"apps/mobile/assets/fonts/Pretendard-Regular.otf"
BALLOON=ROOT/"output/marketing/jango-sns-ep03-20261020/source-art/balloon-r1.png"
INK="#514438"
GREEN="#28674F"
SELECTED={1:"scene-01-r2.png",2:"scene-02-r1.png",
          3:"scene-03-r2.png",4:"scene-04-r1.png"}
DURATIONS=[4,5,9,6]
SCREEN_QUADS={
    2:[(185,766),(386,770),(366,1204),(158,1193)],
    3:[(210,599),(526,577),(575,1205),(252,1232)],
    4:[(466,768),(547,749),(572,911),(489,926)],
}
RECEIPT_QUADS={
    1:[(689,1085),(749,1076),(805,1156),(734,1171)],
    2:[(451,808),(537,811),(544,1019),(443,1013)],
    4:[(759,1157),(830,1150),(898,1242),(812,1255)],
}
BOXES=[]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, obj):
    Path(path).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")


def text(im, copy, center, size, *, font=GAEGU, color=INK, gap=18,
         width=760, role="dialogue", safe=True):
    draw=ImageDraw.Draw(im)
    face=ImageFont.truetype(str(font),size)
    lines=copy.split("\n")
    bounds=[draw.textbbox((0,0),line,font=face) for line in lines]
    heights=[b[3]-b[1] for b in bounds]
    y=center[1]-(sum(heights)+gap*(len(lines)-1))/2
    for line,b,h in zip(lines,bounds,heights):
        w=b[2]-b[0]
        assert w<=width,(role,line,w,width)
        x=center[0]-w/2
        box=[round(x),round(y),round(x+w),round(y+h)]
        if safe:
            assert box[0]>=96 and box[1]>=280 and box[2]<=900 and box[3]<=1420,(role,box)
        draw.text((round(x-b[0]),round(y-b[1])),line,font=face,fill=color)
        BOXES.append({"role":role,"copy":line,"font":str(font.relative_to(ROOT)),
                      "size":size,"bbox":box,"fixedToFrame":True})
        y+=h+gap


def balloon(layer, xy, width, mirror=False):
    original=Image.open(BALLOON).convert("RGBA")
    if mirror:
        original=ImageOps.mirror(original)
    size=(width,round(original.height*width/original.width))
    layer.alpha_composite(original.resize(size,Image.Resampling.LANCZOS),xy)


def project(im, layer, quad, mask):
    src=[(0,0),(layer.width,0),(layer.width,layer.height),(0,layer.height)]
    a,b=[],[]
    for (x,y),(u,v) in zip(quad,src):
        a.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]])
        b.extend([u,v])
    coeff=np.linalg.solve(np.asarray(a),np.asarray(b)).tolist()
    warped=layer.transform(im.size,Image.Transform.PERSPECTIVE,coeff,Image.Resampling.BICUBIC)
    # Original foreground fingertips, screen corners and camera notch are kept.
    warped.putalpha(ImageChops.multiply(warped.getchannel("A"),
                    mask.filter(ImageFilter.GaussianBlur(.35))))
    im.alpha_composite(warped)


def compose_scene(n,state):
    art=Image.open(OUT/"source-art"/SELECTED[n]).convert("RGBA")
    if n in RECEIPT_QUADS:
        project(art,Image.open(OUT/"ui/receipt.png").convert("RGBA"),
                RECEIPT_QUADS[n],Image.open(OUT/f"ui/receipt-mask-{n:02}.png").convert("L"))
    if state:
        project(art,Image.open(OUT/f"ui/{state}.png").convert("RGBA"),
                SCREEN_QUADS[n],Image.open(OUT/f"ui/screen-mask-{n:02}.png").convert("L"))
    # Uniform cover resampling trims less than one native pixel of background.
    return ImageOps.fit(art,SIZE,Image.Resampling.LANCZOS).convert("RGB")


def disclosure(layer, copy="앱 디자인 기반 시연 · 예시 데이터"):
    d=ImageDraw.Draw(layer)
    d.rounded_rectangle((155,573,855,626),radius=20,fill="#FFFCF7E8")
    text(layer,copy,(505,599),29,font=UI_REG,color="#515B55",
         width=670,role="screen disclosure")


def overlays():
    result={}
    for key in ["01","02","03a","03b","04","cta"]:
        im=Image.new("RGBA",SIZE)
        if key=="01":
            balloon(im,(105,190),790)
            text(im,"이걸 하나씩\n다 입력해?",(500,373),84,width=680,role="scene 1 dialogue")
        elif key=="02":
            balloon(im,(105,202),790)
            text(im,"영수증부터\n찍어 봐!",(500,390),84,width=680,role="scene 2 dialogue")
            disclosure(im)
        elif key in ["03a","03b"]:
            balloon(im,(105,173),790,mirror=key=="03a")
            copy="재료 이름이\n쭉 나왔네!" if key=="03a" else "내용 확인하고,\n함께 넣자!"
            text(im,copy,(500,365),82,width=690,role=f"scene 3 dialogue {key}")
            disclosure(im,"앱 디자인 기반 시연 · 입력 과정 축약")
        elif key=="04":
            balloon(im,(105,180),790)
            text(im,"여러 개를\n한 번에 넣었네!",(500,366),76,width=680,role="scene 4 dialogue")
        else:
            balloon(im,(105,190),790)
            text(im,"장고야 부탁해",(500,330),88,width=690,color=GREEN,role="brand")
            text(im,"영수증으로 재료 등록해 보세요.",(500,425),54,
                 width=700,role="single CTA")
        im.save(OUT/f"layers/{key}.png")
        result[key]=im
    return result


def layout():
    states={1:[None],2:["camera","analysis"],
            3:["candidates","details","ready"],4:["complete"]}
    layers=overlays()
    previews=[]
    for n,choices in states.items():
        for state in choices:
            name=f"{n:02}-{state or 'base'}"
            art=compose_scene(n,state)
            art.save(OUT/f"scenes/{name}.png")
            key=f"{n:02}"
            if n==3:
                key="03a" if state=="candidates" else "03b"
            composed=Image.alpha_composite(art.convert("RGBA"),layers[key]).convert("RGB")
            composed.save(OUT/f"review/reel/{name}.png")
            composed.resize((360,640),Image.Resampling.LANCZOS).save(OUT/f"review/reel/{name}-360.png")
            if state in [None,"camera","ready","complete"]:
                previews.append(composed)
    art=Image.open(OUT/"scenes/04-complete.png").convert("RGBA")
    final=Image.alpha_composite(art,layers["cta"]).convert("RGB")
    final.save(OUT/"review/reel/04-cta.png")
    final.resize((360,640),Image.Resampling.LANCZOS).save(OUT/"review/reel/04-cta-360.png")
    sheet=Image.new("RGB",(1440,640),"#FDF8F2")
    for i,im in enumerate(previews):
        sheet.paste(im.resize((360,640),Image.Resampling.LANCZOS),(i*360,0))
    sheet.save(OUT/"review/reel/storyboard-360.jpg",quality=96,subsampling=0)

    # Separate cover keeps title and Jango in central 1:1 and 3:4 crop areas.
    cover=Image.open(OUT/"scenes/03-ready.png").convert("RGBA")
    cover_layer=Image.new("RGBA",SIZE)
    ImageDraw.Draw(cover_layer).rounded_rectangle(
        (83,405,930,653),radius=44,fill="#FFFCF7FA")
    text(cover_layer,"장고랑 살아보니 04",(498,443),44,color=GREEN,role="cover series")
    text(cover_layer,"재료 등록,\n하나씩 입력하고 있나요?",(498,555),76,
         gap=15,width=770,color=GREEN,role="cover title")
    cover=Image.alpha_composite(cover,cover_layer).convert("RGB")
    cover.save(OUT/"cover.png")
    cover.save(OUT/"cover.jpg",quality=97,subsampling=0)
    cover.resize((360,640),Image.Resampling.LANCZOS).save(OUT/"review/reel/cover-360.png")
    for wh,name in [((360,480),"3x4"),((360,360),"square")]:
        ImageOps.fit(cover,wh,Image.Resampling.LANCZOS).save(OUT/f"review/reel/cover-profile-{name}.jpg",quality=96)
    write(OUT/"reel-typography.json",{
        "nativeArtworkSize":[941,1672],"videoSize":list(SIZE),
        "framing":"Uniform scaling; less than 1 native pixel background crop for ratio rounding.",
        "fonts":{str(p.relative_to(ROOT)):sha(p) for p in [GAEGU,UI,UI_REG]},
        "balloon":{"source":str(BALLOON.relative_to(ROOT)),"sha256":sha(BALLOON)},
        "phoneUI":"Offline enlarged/abridged current app design, not runtime screenshots. Precise perspective projection; original hands, bezel and notch retained.",
        "screenQuads":SCREEN_QUADS,"receiptQuads":RECEIPT_QUADS,"fixedText":BOXES})
    print("Composed all phone states, fixed Korean overlays, cover and 360px proofs.",flush=True)


def choose(n,t):
    if n==1: return "01-base","01"
    if n==2: return ("02-camera" if t<4.2 else "02-analysis"),"02"
    if n==3:
        return ("03-candidates" if t<3 else "03-details" if t<6 else "03-ready"),("03a" if t<3 else "03b")
    return "04-complete",("04" if t<3 else "cta")


def run(cmd,name):
    write(OUT/"reel"/f"{name}-command.json",cmd)
    with (OUT/"reel"/f"{name}.log").open("w") as log:
        subprocess.run(cmd,check=True,stdout=log,stderr=log)


def encode():
    scenes={p.stem:Image.open(p).convert("RGBA") for p in (OUT/"scenes").glob("*.png")}
    layers={p.stem:Image.open(p).convert("RGBA") for p in (OUT/"layers").glob("*.png")}
    cmd=[FFMPEG,"-hide_banner","-y","-f","rawvideo","-pix_fmt","rgb24","-s","1080x1920",
         "-r","30","-i","-","-an","-c:v","libx264","-preset","medium","-crf","18",
         "-pix_fmt","yuv420p","-r","30","-movflags","+faststart",str(OUT/"reel/silent.mp4")]
    write(OUT/"reel/silent-command.json",cmd)
    with (OUT/"reel/silent.log").open("w") as log:
        process=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=log,stderr=log)
        try:
            for n,duration in enumerate(DURATIONS,1):
                count=duration*30
                for f in range(count):
                    state,layer=choose(n,f/30)
                    z=1+.03*f/(count-1)
                    # Continuous subpixel zoom across UI state changes.
                    ax,ay=540,1050
                    affine=(1/z,0,ax*(1-1/z),0,1/z,ay*(1-1/z))
                    moving=scenes[state].transform(SIZE,Image.Transform.AFFINE,
                                                  affine,Image.Resampling.BICUBIC)
                    frame=Image.alpha_composite(moving,layers[layer]).convert("RGB")
                    process.stdin.write(frame.tobytes())
                    if f in [0,count//2,count-1]:
                        stamp=sum(DURATIONS[:n-1])+f/30
                        frame.resize((360,640),Image.Resampling.LANCZOS).save(
                            OUT/f"review/reel/frame-{stamp:05.2f}.jpg",quality=95)
                print(f"Rendered scene {n}/4 ({sum(DURATIONS[:n])*30}/720 frames).",flush=True)
            process.stdin.close()
            if process.wait()!=0: raise RuntimeError("FFmpeg video encoding failed")
        finally:
            if process.poll() is None: process.terminate()
    music=OUT/"music/Carefree.mp3"
    credit="Carefree — Kevin MacLeod (incompetech.com), CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ ; excerpt, volume adjustment and fades."
    run([FFMPEG,"-hide_banner","-y","-i",str(OUT/"reel/silent.mp4"),"-i",str(music),
         "-map","0:v:0","-map","1:a:0","-c:v","copy",
         "-af","atrim=0:24,asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:st=0:d=0.3,afade=t=out:st=23:d=1",
         "-c:a","aac","-b:a","192k","-ar","48000","-t","24",
         "-metadata","title=장고랑 살아보니 04 — 이걸 언제 다 입력해?",
         "-metadata",f"comment={credit}","-movflags","+faststart",
         str(OUT/"reel/jango-ep04-music.mp4")],"final")
    run([FFMPEG,"-hide_banner","-y","-i",str(OUT/"reel/jango-ep04-music.mp4"),
         "-vf","scale=360:640:flags=lanczos","-c:v","libx264","-crf","18","-preset","fast",
         "-c:a","copy","-movflags","+faststart",str(OUT/"review/reel/jango-ep04-360.mp4")],"proxy")
    write(OUT/"reel/production.json",{
        "format":"MP4/H.264,1080x1920,30fps,720 frames,AAC 48kHz","seconds":24,
        "sceneDurations":DURATIONS,"sceneCuts":[4,9,18],"uiCuts":[8.2,12,15],
        "zoom":[1,1.03],"fixedLettering":True,"brandCTASeconds":[21,24],
        "musicSource":str(music.relative_to(ROOT)),"musicSourceSHA256":sha(music),
        "musicSegmentSeconds":[0,24],"fadesSeconds":[.3,1],"targetLUFS":-18,
        "maxTruePeakDB":-2,"credit":credit,
        "videoSHA256":sha(OUT/"reel/jango-ep04-music.mp4")})
    print("Final 24-second Reel and 360px proxy encoded.",flush=True)


if __name__=="__main__":
    if len(sys.argv)==1 or sys.argv[1]=="layout": layout()
    elif sys.argv[1]=="encode": encode()
