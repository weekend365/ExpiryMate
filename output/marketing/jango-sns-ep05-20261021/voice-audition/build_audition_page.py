"""Build a short dialogue mix and an accessible local audition player."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
import html
import json
import re
import subprocess
import wave

OUT = Path(__file__).resolve().parent
FFMPEG = '/private/tmp/jango-cartoon-20261020-venv/lib/python3.13/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
def run(args):
    return subprocess.run([FFMPEG, '-hide_banner', '-nostdin', *args], check=True, capture_output=True, text=True)
def measure(path):
    r=run(['-i',str(path),'-af','loudnorm=I=-18:TP=-2:LRA=7:print_format=json','-f','null','-'])
    return json.loads(re.findall(r'\{[\s\S]*?\}',r.stderr)[-1])
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

generation=json.loads((OUT/'dialogue-generation.json').read_text())
sample_rate=44100
chunks=[b'\0'*(int(.20*sample_rate)*2)]
cursor=.20
timeline=[]
for i,line in enumerate(generation['lines']):
    raw=OUT/line['file']
    dest=OUT/'preview'/f'dialogue-line-{i+1:02d}.wav'
    m=measure(raw)
    filt=('loudnorm=I=-18:TP=-2:LRA=7:linear=true'
          f':measured_I={m["input_i"]}:measured_TP={m["input_tp"]}'
          f':measured_LRA={m["input_lra"]}:measured_thresh={m["input_thresh"]}'
          f':offset={m["target_offset"]}')
    run(['-n','-i',str(raw),'-af',filt,'-ar','44100','-ac','1','-c:a','pcm_s16le',str(dest)])
    with wave.open(str(dest),'rb') as w:
        assert w.getframerate()==44100 and w.getnchannels()==1 and w.getsampwidth()==2
        pcm=w.readframes(w.getnframes()); duration=w.getnframes()/44100
    chunks.append(pcm)
    timeline.append({'start':cursor,'end':cursor+duration,'character':line['request']['character'],'voice':line['request']['voice'],'text':line['request']['text'],'raw':line['file'],'normalized':str(dest.relative_to(OUT)),'normalizedSha256':sha(dest)})
    cursor+=duration
    chunks.append(b'\0'*(int(.35*sample_rate)*2));cursor+=.35

wav=OUT/'preview/dialogue-f3-m3.wav'
mp3=OUT/'preview/dialogue-f3-m3.mp3'
with wave.open(str(wav),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100);w.writeframes(b''.join(chunks))
run(['-n','-i',str(wav),'-c:a','libmp3lame','-b:a','128k','-metadata','comment=AI-generated character voice audition / Supertonic 3',str(mp3)])
run(['-v','error','-i',str(mp3),'-f','null','-'])
with wave.open(str(wav),'rb') as w:duration=w.getnframes()/w.getframerate()
mix={'wav':'preview/dialogue-f3-m3.wav','mp3':'preview/dialogue-f3-m3.mp3','durationSeconds':duration,'timeline':timeline,'wavSha256':sha(wav),'mp3Sha256':sha(mp3),'editing':'Individually normalized dialogue; 0.20s lead-in and 0.35s gaps/tail; no BGM, pitch shift, speed change or spoken labels.','loudness':measure(wav),'mp3Decode':'passed'}
(OUT/'dialogue-mix.json').write_text(json.dumps(mix,ensure_ascii=False,indent=2)+'\n')

samples=json.loads((OUT/'preview-record.json').read_text())['samples']
def card(s):
    default=s['voice'] in ('F3','M3')
    return f'''<article class="voice"><div class="card-head"><h3>{s['voice']}</h3>{'<span class="badge">기본 후보</span>' if default else ''}<span class="duration">{s['durationSeconds']:.1f}초</span></div>
<p class="script">{html.escape(s['text'])}</p><audio controls preload="metadata" aria-label="{('여성' if s['character']=='woman' else '장고')} {s['voice']} 음성 샘플"><source src="{s['mp3']}" type="audio/mpeg"></audio>
<div class="links"><a href="{s['mp3']}" download>MP3 저장</a><a href="{s['wav']}" download>WAV 저장</a></div></article>'''
woman=''.join(card(s) for s in samples if s['character']=='woman')
jango=''.join(card(s) for s in samples if s['character']=='jango')
transcript=''.join(f'<li data-start="{x["start"]}" data-end="{x["end"]}"><strong>{"여성" if x["character"]=="woman" else "장고"}</strong><span>{html.escape(x["text"])}</span></li>' for x in timeline)
page='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>장고 5화 · 목소리 샘플</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f8f3e9;color:#273c34;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;line-height:1.6}main{max-width:1040px;margin:auto;padding:44px 24px 52px}a{color:#236c54}header{margin-bottom:26px}.eyebrow{font-size:13px;letter-spacing:.06em;color:#597665;font-weight:700}h1{font-size:clamp(26px,5vw,38px);line-height:1.3;margin:8px 0 12px}header p{max-width:700px;margin:0;color:#53675b}.duet{background:#fffdf7;border:1px solid #d3dfd0;border-radius:20px;padding:24px;margin:22px 0 32px;box-shadow:0 8px 28px #24493308}h2{font-size:23px;margin:0 0 12px}.muted{color:#63746a;font-size:14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}.voice{background:#fffdf7;border:1px solid #dce4d5;border-radius:16px;padding:20px}.card-head{display:flex;align-items:center;gap:10px}.card-head h3{margin:0;font-size:21px}.badge{background:#dceedd;color:#24533f;border-radius:20px;padding:2px 9px;font-size:12px;font-weight:700}.duration{margin-left:auto;font-size:13px;color:#718174}.script{font-size:16px;min-height:52px;margin:14px 0}audio{width:100%;height:44px;display:block}.links{display:flex;gap:16px;font-size:13px;margin-top:12px}section{margin:30px 0}ol{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:6px}li{display:flex;gap:14px;border-radius:8px;padding:7px 10px}li strong{min-width:32px;font-size:13px;color:#5d7868}li.active{background:#e2efdf}footer{font-size:13px;color:#647569;border-top:1px solid #dce4d5;padding-top:20px;margin-top:34px}@media(max-width:500px){main{padding:26px 16px}.duet{padding:18px}.grid{grid-template-columns:1fr}.voice{padding:18px}}</style></head><body><main>
<header><div class="eyebrow">장고랑 살아보니 05 · VOICE AUDITION</div><h1>두 캐릭터의 목소리를 들어보세요</h1><p>AI로 합성한 목소리 샘플입니다. 같은 대사로 음색을 비교할 수 있게 음량을 맞췄습니다. BGM 없이 목소리만 들려드립니다.</p></header>
<div class="duet"><h2>짧은 대화 · 여성 F3 + 장고 M3</h2><p class="muted">기본 후보 조합 · DURATION초 · 최종 목소리는 아직 확정하지 않았습니다.</p><audio id="dialogue" controls preload="metadata" aria-label="여성 F3와 장고 M3 대화"><source src="preview/dialogue-f3-m3.mp3" type="audio/mpeg"></audio><ol>TRANSCRIPT</ol><div class="links"><a href="preview/dialogue-f3-m3.mp3" download>대화 MP3 저장</a><a href="preview/dialogue-f3-m3.wav" download>대화 WAV 저장</a></div></div>
<section><h2>여성 · 3가지 후보</h2><div class="grid">WOMAN</div></section><section><h2>장고 · 4가지 후보</h2><div class="grid">JANGO</div></section>
<footer>VoiceStudio의 Supertonic 3 엔진 · 한국어 · 고정 프리셋 음성. 각 후보는 약 3초입니다.<br>파일 재생·디코딩·음량 검사를 완료했습니다. 발음·말투·캐릭터 적합성은 직접 들으며 비교해 주세요.<br><a href="../review/index.html">원화 보기</a> · <a href="licenses/Supertonic-3-OpenRAIL-M.txt">모델 이용 조건</a> · <a href="preview-record.json">제작 기록</a></footer>
</main><script>const players=[...document.querySelectorAll('audio')];players.forEach(p=>p.addEventListener('play',()=>players.forEach(q=>{if(q!==p)q.pause()})));const d=document.getElementById('dialogue');d.addEventListener('timeupdate',()=>document.querySelectorAll('li[data-start]').forEach(li=>li.classList.toggle('active',d.currentTime>=Number(li.dataset.start)&&d.currentTime<Number(li.dataset.end))));</script></body></html>'''
page=page.replace('DURATION',f'{duration:.1f}').replace('TRANSCRIPT',transcript).replace('WOMAN',woman).replace('JANGO',jango)
(OUT/'index.html').write_text(page)
print(json.dumps({'dialogueSeconds':duration,'candidatePlayers':len(samples),'page':str(OUT/'index.html')},ensure_ascii=False))
