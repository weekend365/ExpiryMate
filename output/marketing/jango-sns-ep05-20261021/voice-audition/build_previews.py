"""Normalize audition playback levels and make listenable MP3 copies."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import shutil
from datetime import datetime
from zoneinfo import ZoneInfo

OUT = Path(__file__).resolve().parent
BASE = Path('/private/tmp/jango-voice-audition-20261021')
FFMPEG = Path('/private/tmp/jango-cartoon-20261020-venv/lib/python3.13/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1')
PREVIEW = OUT / 'preview'
PREVIEW.mkdir(exist_ok=True)

def run(args):
    return subprocess.run([str(FFMPEG), '-hide_banner', '-nostdin', *args], check=True, text=True, capture_output=True)

def loudness(path):
    r = run(['-i', str(path), '-af', 'loudnorm=I=-18:TP=-2:LRA=7:print_format=json', '-f', 'null', '-'])
    return json.loads(re.findall(r'\{[\s\S]*?\}', r.stderr)[-1])

generation = json.loads((OUT / 'generation-record.json').read_text())
entries = []
for take in generation['takes']:
    src = OUT / take['file']
    key = f'{take["character"]}-{take["voice"].lower()}'
    wav = PREVIEW / f'{key}.wav'
    mp3 = PREVIEW / f'{key}.mp3'
    measured = loudness(src)
    filt = (
        'loudnorm=I=-18:TP=-2:LRA=7:linear=true'
        f':measured_I={measured["input_i"]}:measured_TP={measured["input_tp"]}'
        f':measured_LRA={measured["input_lra"]}:measured_thresh={measured["input_thresh"]}'
        f':offset={measured["target_offset"]}'
    )
    run(['-n', '-i', str(src), '-af', filt, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', str(wav)])
    run(['-n', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '128k', '-metadata', 'comment=AI-generated voice audition / Supertonic 3', str(mp3)])
    run(['-v', 'error', '-i', str(mp3), '-f', 'null', '-'])
    entries.append({
        'character':take['character'], 'voice':take['voice'], 'text':take['request']['text'],
        'durationSeconds':take['durationSeconds'], 'wav':str(wav.relative_to(OUT)), 'mp3':str(mp3.relative_to(OUT)),
        'rawSha256':take['sha256'], 'wavSha256':hashlib.sha256(wav.read_bytes()).hexdigest(),
        'mp3Sha256':hashlib.sha256(mp3.read_bytes()).hexdigest(),
        'processing':'Two-pass loudness normalization toward -18 LUFS, -2 dBTP; no pitch/speed changes; no BGM.',
        'normalizationMeasurements':measured, 'verifiedWavLoudness':loudness(wav), 'mp3Decode':'passed',
    })

license_dir=OUT/'licenses'
license_dir.mkdir(exist_ok=True)
snapshot=json.loads((BASE/'model-snapshot.json').read_text())
shutil.copy2(Path(snapshot['snapshotPath'])/'LICENSE',license_dir/'Supertonic-3-OpenRAIL-M.txt')
shutil.copy2(BASE/'voicestudio/LICENSE',license_dir/'VoiceStudio-AGPL-3.0.txt')
shutil.copy2(BASE/'voicestudio/LICENSE-NOTICE.md',license_dir/'VoiceStudio-LICENSE-NOTICE.txt')
shutil.copy2(BASE/'voicestudio-sources.json',OUT/'voicestudio-source-hashes.json')
shutil.copy2(BASE/'model-snapshot.json',OUT/'model-source-hashes.json')
record={'createdAt':datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),'disclosure':'AI로 합성한 목소리 샘플입니다.','samples':entries,'engine':'VoiceStudio Supertonic-3, CPU, Korean ko','stage':'audition; not approved recurring character voices'}
(OUT/'preview-record.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'playableSamples':len(entries),'format':'44.1kHz mono WAV + 128kbps MP3','result':'all decoded successfully'},ensure_ascii=False))
