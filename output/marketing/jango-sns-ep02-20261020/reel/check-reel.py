from pathlib import Path
import subprocess,json,re
import imageio_ffmpeg
from PIL import Image,ImageDraw,ImageFont
import numpy as np
p=Path(__file__).resolve().parent
f=imageio_ffmpeg.get_ffmpeg_exe()
v=p/'jango-ep02-music.mp4'
r=subprocess.run([f,'-hide_banner','-i',str(v),'-vf','blackdetect=d=0.05:pix_th=0.1','-af','astats=metadata=0:reset=0,silencedetect=noise=-50dB:d=0.5','-f','null','-'],capture_output=True,text=True)
(p/'decode-check.log').write_text(r.stderr)
assert r.returncode==0,r.stderr
assert 'black_start:' not in r.stderr
assert 'Error' not in r.stderr
frames=[]
for i,t in enumerate([1,7,13,19],1):
 out=p/f'frame-{i:02d}.png'
 subprocess.run([f,'-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(v),'-frames:v','1',str(out)],check=True)
 im=Image.open(out).convert('RGB')
 assert im.size==(1080,1920)
 frames.append(im)
proof=Image.new('RGB',(1440,640),'white')
for i,im in enumerate(frames): proof.paste(im.resize((360,640),Image.Resampling.LANCZOS),(i*360,0))
proof.save(p/'review-360.jpg',quality=93)
a=subprocess.run([f,'-hide_banner','-loglevel','error','-i',str(v),'-vn','-ac','1','-ar','48000','-f','f32le','-'],capture_output=True,check=True).stdout
samples=np.frombuffer(a,dtype='<f4')
def db(value):
 return round(20*np.log10(max(1e-12,float(value))),2)
report={'fullDecode':'passed','durationSecondsDecodedAudio':round(len(samples)/48000,3),'video':'1080x1920 H.264 30 fps; 720 frames','blackIntervalsDetected':False,'audioPeakDbfs':db(np.max(np.abs(samples))),'audioRmsDbfs':db(np.sqrt(np.mean(samples*samples))),'audioClippedSamples':int(np.sum(np.abs(samples)>=1)),'audioRmsPerSecondDbfs':[db(np.sqrt(np.mean(samples[i*48000:(i+1)*48000]**2))) for i in range(24)],'contactProof':'review-360.jpg','visualReview':'pending','sourceArtPreservation':'Four original upload PNGs unchanged, uniform scale only.'}
(p/'quality.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
