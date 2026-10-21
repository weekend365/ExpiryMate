"""Run the unmodified VoiceStudio Supertonic-3 synthesis handler offline.

No VoiceStudio desktop installation or app/backend settings are modified.
The exact external source/model revisions are recorded in preparation.json.
"""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import base64
import hashlib
import importlib.metadata
import importlib.util
import io
import json
import os
import time
import wave

BASE = Path('/private/tmp/jango-voice-audition-20261021')
OUT = Path(__file__).resolve().parent
RAW = OUT / 'raw'
RAW.mkdir(exist_ok=True)
os.environ['HF_HOME'] = str(BASE / 'hf-cache')
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
os.environ['SUPERTONIC3_REVISION'] = '724fb5abbf5502583fb520898d45929e62f02c0b'

import numpy as np

sidecar_path = BASE / 'voicestudio/backend/engines/supertonic3/sidecar.py'
spec = importlib.util.spec_from_file_location('voicestudio_supertonic3_sidecar', sidecar_path)
sidecar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sidecar)
plan = json.loads((OUT / 'preparation.json').read_text())
records = []

for character, voices in plan['initialPresets'].items():
    for voice in voices:
        dest = RAW / f'{character}-{voice.lower()}-raw.wav'
        if dest.exists():
            raise FileExistsError(f'Preserve existing take; choose a new revision: {dest}')
        request = {
            'op': 'synthesize', 'text': plan['scripts'][character],
            'voice': voice, 'lang': 'ko', 'speed': 1.0, 'total_steps': 10,
        }
        # Deterministic numpy noise for this audition; engine source is unchanged.
        seed = 20261021 + len(records)
        np.random.seed(seed)
        stream = io.BytesIO()
        started = time.monotonic()
        sidecar._handle_synthesize(request, stream)
        elapsed = time.monotonic() - started
        stream.seek(0)
        frames = []
        while True:
            frame = sidecar._recv(stream)
            if frame is None:
                break
            frames.append(frame)
        audio_frames = [f for f in frames if f.get('op') == 'audio']
        assert len(audio_frames) == 1
        result = audio_frames[0]
        pcm = base64.b64decode(result['audio_pcm_b64'])
        assert len(pcm) == result['n_samples'] * 2
        with wave.open(str(dest), 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(result['sample_rate'])
            wav.writeframes(pcm)
        data = np.frombuffer(pcm, dtype='<i2').astype(np.float64) / 32768
        assert data.size > 0 and np.isfinite(data).all()
        peak = float(np.max(np.abs(data)))
        rms = float(np.sqrt(np.mean(data * data)))
        record = {
            'character': character, 'voice': voice, 'request': request,
            'numpySeed': seed, 'file': str(dest.relative_to(OUT)),
            'sampleRate': result['sample_rate'], 'samples': result['n_samples'],
            'durationSeconds': result['n_samples'] / result['sample_rate'],
            'peakDbfs': float(20 * np.log10(max(peak, 1e-12))),
            'rmsDbfs': float(20 * np.log10(max(rms, 1e-12))),
            'fullScaleSampleCount': int((np.abs(data) >= 32767/32768).sum()),
            'generationSeconds': elapsed,
            'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(),
        }
        records.append(record)
        (OUT / 'generation-progress.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({k:record[k] for k in ['character','voice','durationSeconds','peakDbfs','generationSeconds']},ensure_ascii=False), flush=True)

providers = {}
for name in ['dp_ort', 'text_enc_ort', 'vector_est_ort', 'vocoder_ort']:
    session = getattr(sidecar._tts.model, name)
    providers[name] = session.get_providers()
assert all(v == ['CPUExecutionProvider'] for v in providers.values()), providers
record = {
    'createdAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
    'sourceMethod': 'Unmodified VoiceStudio sidecar _handle_synthesize, using an in-memory protocol stream; no cloud generation.',
    'sourceFile': str(sidecar_path),
    'sourceSha256': hashlib.sha256(sidecar_path.read_bytes()).hexdigest(),
    'actualSessionProviders': providers,
    'packages': {n:importlib.metadata.version(n) for n in ['supertonic','onnxruntime','numpy','soundfile','huggingface-hub']},
    'takes': records, 'listeningReview': 'pending',
}
(OUT / 'generation-record.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
print('Generated and decoded seven raw audition takes; actual ONNX sessions use CPUExecutionProvider.', flush=True)
