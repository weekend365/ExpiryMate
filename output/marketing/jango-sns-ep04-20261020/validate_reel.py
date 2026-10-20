"""Non-mutating source checks and review images decoded from the final MP4."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import io
import json
import subprocess

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
REVIEW=OUT/"review/reel"
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()
FONT=ROOT/"apps/mobile/assets/fonts/Pretendard-Regular.otf"


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write(path,data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")


def frame(t):
    result=subprocess.run(
        [FFMPEG,"-v","error","-ss",str(t),"-i",str(OUT/"reel/jango-ep04-music.mp4"),
         "-frames:v","1","-vf","scale=360:640:flags=lanczos",
         "-f","image2pipe","-vcodec","png","-"],
        check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    return Image.open(io.BytesIO(result.stdout)).convert("RGB")


def ui_simulation(im):
    """Illustrative conservative controls, never presented as a platform screenshot."""
    im=im.convert("RGBA")
    overlay=Image.new("RGBA",im.size)
    d=ImageDraw.Draw(overlay)
    small=ImageFont.truetype(str(FONT),11)
    label=ImageFont.truetype(str(FONT),14)
    for y in range(484,640):
        d.line((0,y,360,y),fill=(0,0,0,round((y-484)*.8)))
    d.text((18,25),"릴스 · UI 겹침 시뮬레이션",font=small,fill="white",stroke_width=1,stroke_fill="#302E2C")
    for y in [375,425,475,525]:
        d.ellipse((321,y,343,y+22),outline="white",width=2)
        d.text((319,y+25),"···",font=small,fill="white")
    d.text((18,554),"jango_plz",font=label,fill="white")
    d.text((18,581),"이걸 언제 다 입력해?",font=small,fill="white")
    d.text((18,605),"Carefree — Kevin MacLeod",font=small,fill="white")
    return Image.alpha_composite(im,overlay).convert("RGB")


def main():
    baseline=json.loads((OUT/"preservation-baseline.json").read_text())
    baseline.update(json.loads((OUT/"reel-source-baseline.json").read_text())["files"])
    mismatches=[]
    for name,digest in baseline.items():
        path=ROOT/name
        if not path.exists() or sha(path)!=digest:
            mismatches.append(name)
    assert not mismatches,mismatches
    selected=json.loads((OUT/"reel-preparation.json").read_text())["artworkAdoptionForThisReel"]
    for item in selected:
        assert sha(ROOT/item["file"])==item["sha256"]

    times=[0,4,8.2,9,12,15,18,21]
    sheet=Image.new("RGB",(1440,1344),"#FDF8F2")
    font=ImageFont.truetype(str(FONT),18)
    for i,t in enumerate(times):
        im=frame(t)
        im.save(REVIEW/f"decoded-{t:04.1f}.jpg",quality=95)
        x,y=(i%4)*360,(i//4)*672
        sheet.paste(im,(x,y))
        ImageDraw.Draw(sheet).text((x+12,y+646),f"{t:g}초",font=font,fill="#302E2C")
    sheet.save(REVIEW/"decoded-timeline.jpg",quality=95)
    overlap=Image.new("RGB",(1440,640),"#FDF8F2")
    for i,t in enumerate([3.9666667,8,17.9666667,23.9666667]):
        im=ui_simulation(frame(t))
        im.save(REVIEW/f"ui-overlap-{i+1:02}.jpg",quality=95)
        overlap.paste(im,(i*360,0))
    overlap.save(REVIEW/"ui-overlap-sheet.jpg",quality=95)

    frames,duration=imageio_ffmpeg.count_frames_and_secs(str(OUT/"reel/jango-ep04-music.mp4"))
    assert (frames,duration)==(720,24.0)
    for p in [OUT/"render_ui.py",OUT/"build_reel.py",Path(__file__)]:
        compile(p.read_text(),str(p),"exec")
    report={
        "checkedAt":datetime.now(timezone.utc).isoformat(),
        "preservedFiles":len(baseline),"preservationMismatches":mismatches,
        "selectedOriginalsUnchanged":len(selected),
        "decodedFrames":frames,"duration":duration,
        "uiSimulation":"Illustrative right-side controls and bottom caption; not a live Instagram screenshot. Actual publishing preview remains a publishing-stage check.",
        "decodedReviewTimes":times,
        "motionEndReviewTimes":[3.9666667,8,17.9666667,23.9666667],
        "pythonSyntax":"pass",
        "finalVideoSHA256":sha(OUT/"reel/jango-ep04-music.mp4"),
        "coverSHA256":sha(OUT/"cover.jpg"),
    }
    write(REVIEW/"preservation-and-frame-check.json",report)
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
