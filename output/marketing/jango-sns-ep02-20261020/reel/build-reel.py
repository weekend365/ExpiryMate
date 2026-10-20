from pathlib import Path
import subprocess,json,hashlib
from datetime import datetime,timezone
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parents[4]
PACK=Path(__file__).resolve().parents[1]
OUT=PACK/'reel'
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()
FONT=ROOT/'design/jango/emoticons/kakao-32/v18/fonts/Gaegu-Bold.ttf'
UI=ROOT/'apps/mobile/assets/fonts/Pretendard-Bold.otf'
(OUT/'series.txt').write_text('장고툰 02',encoding='utf-8')
(OUT/'title.txt').write_text('1+1인데, 집에도 1',encoding='utf-8')
for i in range(1,5):
 (OUT/f'index-{i}.txt').write_text(f'{i} / 4',encoding='utf-8')
cmd=[FFMPEG,'-hide_banner','-y']
for i in range(1,5):
 cmd += ['-loop','1','-framerate','30','-t','6','-i',str(PACK/f'panels/{i:02d}.png')]
cmd+=['-i',str(PACK/'music/Carefree.mp3')]
filters=[]
for i in range(4):
 f=(f'[{i}:v]scale=928:1160:flags=lanczos,setsar=1,'
    f'pad=1080:1920:76:300:color=0xF5F0E5,'
    f'drawtext=fontfile={FONT}:textfile={OUT}/series.txt:fontsize=52:fontcolor=0x497666:x=(w-text_w)/2:y=219,'
    f'drawtext=fontfile={UI}:textfile={OUT}/index-{i+1}.txt:fontsize=32:fontcolor=0x497666:x=(w-text_w)/2:y=1518,'
    f'trim=duration=6,setpts=PTS-STARTPTS,format=yuv420p[v{i}]')
 filters.append(f)
filters.append('[v0][v1][v2][v3]concat=n=4:v=1:a=0[v]')
filters.append('[4:a]atrim=start=0:end=24,asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:st=0:d=0.3,afade=t=out:st=23:d=1[a]')
cmd += ['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-preset','medium','-crf','18','-r','30','-c:a','aac','-b:a','192k','-ar','48000','-t','24','-movflags','+faststart',str(OUT/'jango-ep02-music.mp4')]
(OUT/'ffmpeg-command.json').write_text(json.dumps(cmd,ensure_ascii=False,indent=2)+'\n')
subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=(OUT/'encode.log').open('w'))
record={'createdAt':datetime.now(timezone.utc).isoformat(),'format':'1080x1920, 30 fps H.264/AAC, 24 seconds','sequence':[{'panel':f'panels/{i:02d}.png','start':(i-1)*6,'end':i*6} for i in range(1,5)],'artwork':'Uniformly scaled to 928x1160, fully preserved without crop, placed at x76 y300 on ivory; original PNGs unchanged. Separate episode header/page typography; original first-panel title retained. Hard cuts avoid text ghosting.','music':'Carefree by Kevin MacLeod, CC BY 4.0, first 24 seconds, normalized to -18 LUFS target, 0.3s fade-in and 1s fade-out.','sourceLicense':'music/license.json','software':subprocess.run([FFMPEG,'-version'],capture_output=True,text=True).stdout.splitlines()[0],'sha256':hashlib.sha256((OUT/'jango-ep02-music.mp4').read_bytes()).hexdigest()}
(OUT/'production.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'file':str(OUT/'jango-ep02-music.mp4'),'bytes':(OUT/'jango-ep02-music.mp4').stat().st_size,'sha256':record['sha256']}))
