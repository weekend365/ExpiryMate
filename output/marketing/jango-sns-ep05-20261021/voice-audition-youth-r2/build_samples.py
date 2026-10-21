"""Create younger-sounding character auditions with disclosed, reversible DSP.

Pitch/timbre are shifted together by resampling; atempo compensates duration.
All source takes and the previous audition are preserved. Perceived age and
acting quality remain a listening decision, not an automated technical pass.
"""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
import json
import math
import re
import subprocess
import wave
import numpy as np

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent
REPO = ROOT.parents[2]
FFMPEG = Path('/private/tmp/jango-cartoon-20261020-venv/lib/python3.13/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1')
SR = 44100
CASTING = {
    'woman': {'voice': 'F2', 'pitchSemitones': 3.0, 'bodyEqHz': 230,
              'bodyEqDb': -1.0, 'target': '밝고 가벼운 소녀 톤'},
    'jango': {'voice': 'F4', 'pitchSemitones': 5.0, 'bodyEqHz': 280,
              'bodyEqDb': -1.5, 'target': '장난기 있는 아이 톤'},
}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args):
    return subprocess.run([str(FFMPEG), '-hide_banner', '-nostdin', *args],
                          check=True, capture_output=True, text=True)


def measure(path):
    result = run(['-i', str(path), '-af', 'loudnorm=I=-18:TP=-2:LRA=7:print_format=json', '-f', 'null', '-'])
    return json.loads(re.findall(r'\{[\s\S]*?\}', result.stderr)[-1])


def normalize(source, target):
    measured = measure(source)
    filt = ('loudnorm=I=-18:TP=-2:LRA=7:linear=true'
            f':measured_I={measured["input_i"]}:measured_TP={measured["input_tp"]}'
            f':measured_LRA={measured["input_lra"]}:measured_thresh={measured["input_thresh"]}'
            f':offset={measured["target_offset"]}')
    run(['-n', '-i', str(source), '-af', filt, '-ar', str(SR), '-ac', '1', '-c:a', 'pcm_s16le', str(target)])
    return {'filter': filt, 'inputMeasurement': measured, 'outputMeasurement': measure(target)}


def read_wav(path):
    with wave.open(str(path)) as wav:
        assert wav.getframerate() == SR and wav.getnchannels() == 1 and wav.getsampwidth() == 2
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').copy()


def write_wav(path, samples):
    assert not path.exists(), f'Preserve existing output: {path}'
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(samples.astype('<i2').tobytes())


def sequence(path, items, gap_seconds):
    blocks = [np.zeros(round(.18 * SR), dtype=np.int16)]
    timeline = []
    cursor = .18
    for i, (label, text, source) in enumerate(items):
        data = read_wav(source)
        timeline.append({'speaker': label, 'text': text, 'startSeconds': cursor,
                         'endSeconds': cursor + len(data) / SR,
                         'file': str(source.relative_to(OUT))})
        blocks.append(data)
        cursor += len(data) / SR
        silence = gap_seconds if i < len(items) - 1 else .25
        blocks.append(np.zeros(round(silence * SR), dtype=np.int16))
        cursor += silence
    write_wav(path, np.concatenate(blocks))
    return timeline


def main():
    assert not (OUT / 'delivery.json').exists(), 'Make another revision instead of overwriting.'
    for folder in ['processed', 'preview']:
        (OUT / folder).mkdir(exist_ok=True)
    generated = json.loads((OUT / 'generation-record.json').read_text())
    processed = []
    lines = {}
    for character, choice in CASTING.items():
        for take in generated['takes']:
            if take['character'] != character or take['request']['voice'] != choice['voice']:
                continue
            src = OUT / take['file']
            key = f'{character}-{take["line"]:02d}'
            changed = OUT / 'processed' / f'{key}-pitch.wav'
            finished = OUT / 'processed' / f'{key}-level.wav'
            rate = round(SR * 2 ** (choice['pitchSemitones'] / 12))
            ratio = rate / SR
            # 120 ms of safety padding avoids time-stretch endpoint loss. The
            # resulting tail is silent; no lexical material is trimmed.
            filt = (f'apad=pad_dur=0.12,asetrate={rate},aresample={SR},atempo={1 / ratio:.9f},'
                    f'highpass=f=85,equalizer=f={choice["bodyEqHz"]}:t=q:w=0.7:g={choice["bodyEqDb"]},'
                    'afade=t=in:d=0.003')
            run(['-n', '-i', str(src), '-af', filt, '-ar', str(SR), '-ac', '1', '-c:a', 'pcm_s16le', str(changed)])
            level = normalize(changed, finished)
            record = {**choice, 'character': character, 'line': take['line'],
                      'text': take['request']['text'], 'source': take['file'],
                      'sourceSha256': digest(src), 'filter': filt,
                      'actualPitchSemitones': 12 * math.log2(ratio),
                      'tempoCompensation': 1 / ratio,
                      'normalization': level, 'file': str(finished.relative_to(OUT)),
                      'sha256': digest(finished)}
            processed.append(record)
            lines[(character, take['line'])] = (character, take['request']['text'], finished)
    outputs = []
    specifications = [
        ('woman-girl-r2', '여성 · 소녀 톤', [lines[('woman', 1)], lines[('woman', 2)]], .22),
        ('jango-playful-child-r2', '장고 · 장난꾸러기 아이 톤', [lines[('jango', 1)], lines[('jango', 2)]], .18),
        ('dialogue-youth-r2', '두 캐릭터 대화',
         [lines[('woman', 1)], lines[('jango', 1)], lines[('woman', 2)], lines[('jango', 2)]], .25),
    ]
    for key, title, items, gap in specifications:
        wav = OUT / 'preview' / f'{key}.wav'
        mp3 = OUT / 'preview' / f'{key}.mp3'
        timeline = sequence(wav, items, gap)
        run(['-n', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '128k',
             '-metadata', f'title={title}',
             '-metadata', 'comment=AI-generated Korean voice audition; stock voices with pitch/timbre/tempo processing', str(mp3)])
        run(['-v', 'error', '-i', str(mp3), '-f', 'null', '-'])
        outputs.append({'title': title, 'wav': str(wav.relative_to(OUT)), 'mp3': str(mp3.relative_to(OUT)),
                        'durationSeconds': len(read_wav(wav)) / SR, 'timeline': timeline,
                        'wavSha256': digest(wav), 'mp3Sha256': digest(mp3),
                        'loudness': measure(wav), 'mp3Loudness': measure(mp3)})
    write_json(OUT / 'processing-record.json', {
        'method': 'New synthesis, then pitch and spectral-envelope shift together via sample-rate conversion; duration compensated with atempo. Gentle low-mid EQ and two-pass loudness normalization.',
        'ffmpegVersion': run(['-version']).stdout.splitlines()[0], 'ffmpegSha256': digest(FFMPEG),
        'technicalReference': 'https://github.com/FFmpeg/FFmpeg/blob/n7.1/doc/filters.texi',
        'referenceSections': ['asetrate', 'aresample', 'atempo', 'loudnorm'],
        'voiceSelectionBasis': 'Different higher-register stock presets plus requested pitch/timbre targets; not a listening-based naturalness pass.',
        'lines': processed, 'outputs': outputs,
    })
    checks = []
    for path in sorted(OUT.rglob('*.wav')):
        run(['-v', 'error', '-i', str(path), '-f', 'null', '-'])
        data = read_wav(path).astype(np.float64) / 32768
        assert data.size and np.isfinite(data).all()
        peak = float(np.max(np.abs(data)))
        rms = float(np.sqrt(np.mean(data * data)))
        clips = int((np.abs(data) >= 32767 / 32768).sum())
        assert clips == 0 and rms > 1e-4, path
        checks.append({'file': str(path.relative_to(OUT)), 'decode': 'passed',
                       'durationSeconds': len(data) / SR, 'peakDbfs': 20 * math.log10(peak),
                       'rmsDbfs': 20 * math.log10(rms), 'fullScaleSamples': clips})
    prep = json.loads((OUT / 'preparation.json').read_text())
    for old in prep['previousFiles']:
        assert digest(ROOT / old['file']) == old['sha256'], old['file']
    baseline = json.loads((ROOT / 'preservation-baseline.json').read_text())
    for source in baseline['files']:
        assert digest(REPO / source['file']) == source['sha256'], source['file']
    for output in outputs:
        assert float(output['mp3Loudness']['input_tp']) <= -1.0, output['mp3']
    write_json(OUT / 'quality-record.json', {
        'createdAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'technical': {'status': 'passed', 'wavFiles': checks, 'mp3DecodeCount': len(outputs),
                      'previewTruePeakBelowDbtp': -1.0,
                      'previousAuditionFilesPreserved': len(prep['previousFiles']),
                      'masterAndReferenceHashesPreserved': len(baseline['files'])},
        'listening': {'status': 'not performed by assistant',
                      'reason': 'Audio input is unavailable in this environment. Decoding, waveform checks and pitch manipulation do not establish naturalness or perceived age.',
                      'pendingUserReview': ['소녀·아이로 들리는지', '장난기와 두 캐릭터 구분', '한국어 발음', '음색 보정의 자연스러움']},
        'notDone': ['final voice casting', 'full Reel rendering', 'Instagram publishing', 'commit/push'],
    })
    write_json(OUT / 'delivery.json', {
        'createdAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
        'status': 'regenerated audition; awaiting user listening and voice choice',
        'disclosure': 'AI로 합성하고 음높이·음색을 보정한 캐릭터 목소리 샘플입니다.',
        'castingTargets': CASTING, 'outputs': outputs,
        'modelAndLicense': '../voice-audition/preparation.json',
        'licenseCopies': '../voice-audition/licenses/',
        'modelAndVoiceHashes': '../voice-audition/model-source-hashes.json',
        'upstreamSourceHashes': '../voice-audition/voicestudio-source-hashes.json',
        'newGenerationRecord': 'generation-record.json', 'processing': 'processing-record.json',
        'quality': 'quality-record.json', 'previousAuditionUnchanged': True,
        'finalVoiceAdoption': False, 'music': None,
    })
    print(json.dumps({'outputs': [{'file': x['mp3'], 'seconds': round(x['durationSeconds'], 2)} for x in outputs],
                      'wavChecks': len(checks), 'previousAuditionUnchanged': True,
                      'referenceHashesPreserved': len(baseline['files'])}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
