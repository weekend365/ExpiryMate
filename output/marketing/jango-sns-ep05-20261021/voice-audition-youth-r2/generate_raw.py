"""Regenerate short audition lines using the pinned, unmodified VoiceStudio handler.

Offline stock voices only; no voice cloning, full Reel, or publication.
Run with /private/tmp/jango-voice-audition-20261021/venv/bin/python.
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
import wave

OUT = Path(__file__).resolve().parent
BASE = Path('/private/tmp/jango-voice-audition-20261021')
PRIOR = OUT.parent / 'voice-audition'
REVISION = '724fb5abbf5502583fb520898d45929e62f02c0b'
os.environ.update({
    'HF_HOME': str(BASE / 'hf-cache'), 'HF_HUB_OFFLINE': '1',
    'HF_HUB_DISABLE_TELEMETRY': '1', 'HF_HUB_DISABLE_IMPLICIT_TOKEN': '1',
    'SUPERTONIC3_REVISION': REVISION,
})
import numpy as np
import onnxruntime as ort
ort.disable_telemetry_events()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, content):
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n')


def main():
    raw = OUT / 'raw'
    raw.mkdir(exist_ok=True)
    assert not (OUT / 'generation-record.json').exists(), 'Preserve completed takes.'
    original = json.loads((PRIOR / 'preparation.json').read_text())
    requests = []
    for character, voices, lines, speed in [
        ('woman', ['F1', 'F2'], ['장고가 이렇게 빨랐어?', '러닝 하자며?'], 1.03),
        ('jango', ['F4', 'F5'], ['늦으면 끝이야!', '오픈런도 런이잖아.'], 1.08),
    ]:
        for voice in voices:
            for line, text in enumerate(lines, 1):
                requests.append({
                    'character': character, 'line': line,
                    'request': {'op': 'synthesize', 'voice': voice, 'text': text,
                                'lang': 'ko', 'speed': speed, 'total_steps': 12},
                    'numpySeed': 20261200 + len(requests),
                })
    preparation = {
        'createdAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'authorization': '여성은 소녀 목소리였으면 좋겠고 장고는 장난꾸러기 아이같은 목소리로 재생성해줘.',
        'scope': 'Regenerated two-character short voice audition only.',
        'creativeTargets': {'woman': '밝고 가벼운 소녀', 'jango': '빠르고 장난기 있는 아이'},
        'feedbackOnPrevious': 'User found woman too mature and Jango adult-male sounding.',
        'method': 'Fresh stock female-voice synthesis plus transparent pitch/timbre and tempo processing. No real person or child voice clone.',
        'limitation': 'This Supertonic engine uses stock presets; it has no age or acting-direction prompt control. Perceived age and performance require user listening.',
        'software': original['software'], 'model': original['model'],
        'previousAudition': '../voice-audition/delivery.json',
        'requests': requests,
        'previousFiles': [{'file': str(p.relative_to(OUT.parent)), 'sha256': digest(p)}
                          for p in sorted(PRIOR.rglob('*')) if p.is_file()],
    }
    write_json(OUT / 'preparation.json', preparation)
    script = BASE / 'voicestudio/backend/engines/supertonic3/sidecar.py'
    spec = importlib.util.spec_from_file_location('voicestudio_supertonic3_sidecar', script)
    sidecar = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sidecar)
    records = []
    for entry in requests:
        request = entry['request']
        dest = raw / f'{entry["character"]}-{request["voice"].lower()}-{entry["line"]:02d}.wav'
        assert not dest.exists(), f'Preserve existing take: {dest}'
        np.random.seed(entry['numpySeed'])
        stream = io.BytesIO()
        sidecar._handle_synthesize(request, stream)
        stream.seek(0)
        frames = []
        while (frame := sidecar._recv(stream)) is not None:
            frames.append(frame)
        results = [f for f in frames if f.get('op') == 'audio']
        assert len(results) == 1, frames
        result = results[0]
        pcm = base64.b64decode(result['audio_pcm_b64'])
        assert len(pcm) == result['n_samples'] * 2
        with wave.open(str(dest), 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(result['sample_rate'])
            wav.writeframes(pcm)
        record = {**entry, 'file': str(dest.relative_to(OUT)),
                  'sampleRate': result['sample_rate'],
                  'durationSeconds': result['n_samples'] / result['sample_rate'],
                  'sha256': digest(dest)}
        records.append(record)
        print(json.dumps({'file': dest.name, 'seconds': record['durationSeconds']}, ensure_ascii=False), flush=True)
    providers = {key: getattr(sidecar._tts.model, key).get_providers()
                 for key in ['dp_ort', 'text_enc_ort', 'vector_est_ort', 'vocoder_ort']}
    write_json(OUT / 'generation-record.json', {
        'createdAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'source': str(script), 'sourceSha256': digest(script),
        'modelRevision': REVISION, 'providers': providers,
        'packages': {name: importlib.metadata.version(name)
                     for name in ['supertonic', 'onnxruntime', 'numpy']},
        'takes': records, 'listeningReview': 'not performed; user audition pending',
    })


if __name__ == '__main__':
    main()
