"""Generate four separate dialogue lines through the pinned VoiceStudio sidecar."""
from pathlib import Path
import base64
import hashlib
import importlib.util
import io
import json
import os
import wave

BASE = Path('/private/tmp/jango-voice-audition-20261021')
OUT = Path(__file__).resolve().parent
os.environ['HF_HOME'] = str(BASE / 'hf-cache')
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
os.environ['SUPERTONIC3_REVISION'] = '724fb5abbf5502583fb520898d45929e62f02c0b'
import numpy as np
import onnxruntime as ort
ort.disable_telemetry_events()

script = BASE / 'voicestudio/backend/engines/supertonic3/sidecar.py'
spec = importlib.util.spec_from_file_location('voicestudio_supertonic3_sidecar', script)
sidecar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sidecar)
lines = [
    ('woman', 'F3', '장고가 이렇게 빨랐어?'),
    ('jango', 'M3', '늦으면 끝이야!'),
    ('woman', 'F3', '러닝 하자며?'),
    ('jango', 'M3', '오픈런도 런이잖아.'),
]
requests = [{'character':c,'voice':v,'text':t,'lang':'ko','speed':1.0,'total_steps':10,'numpySeed':20261100+i} for i,(c,v,t) in enumerate(lines)]
(OUT/'dialogue-preparation.json').write_text(json.dumps({'requests':requests,'scope':'short audio audition; no Reel timing commitment'},ensure_ascii=False,indent=2)+'\n')
records = []
for i,request in enumerate(requests):
    np.random.seed(request['numpySeed'])
    stream = io.BytesIO()
    sidecar._handle_synthesize({'op':'synthesize',**request}, stream)
    stream.seek(0)
    result = None
    while True:
        f = sidecar._recv(stream)
        if f is None: break
        if f.get('op') == 'audio': result = f
    assert result is not None
    dest = OUT/'raw'/f'dialogue-{i+1:02d}-{request["character"]}.wav'
    assert not dest.exists()
    pcm=base64.b64decode(result['audio_pcm_b64'])
    with wave.open(str(dest),'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(result['sample_rate']); wav.writeframes(pcm)
    records.append({'request':request,'file':str(dest.relative_to(OUT)),'durationSeconds':result['n_samples']/result['sample_rate'],'sampleRate':result['sample_rate'],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
    print(json.dumps({'line':i+1,'voice':request['voice'],'seconds':records[-1]['durationSeconds']},ensure_ascii=False),flush=True)
(OUT/'dialogue-generation.json').write_text(json.dumps({'source':str(script),'sourceSha256':hashlib.sha256(script.read_bytes()).hexdigest(),'lines':records},ensure_ascii=False,indent=2)+'\n')
