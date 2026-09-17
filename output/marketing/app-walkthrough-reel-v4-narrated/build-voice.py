from pathlib import Path
import array
import json
import math
import subprocess
import sys
import wave

root = Path(__file__).resolve().parent
cues = json.loads((root / 'narration-cues.json').read_text())
sample_rate = 48000
report = []
for cue in cues:
    rate = 175
    budget = cue['end'] - cue['start']
    aiff = root / 'voice' / (cue['id'] + '.aiff')
    wav = root / 'voice' / (cue['id'] + '.wav')
    trimmed = root / 'voice' / (cue['id'] + '-trimmed.wav')
    for attempt in range(4):
        subprocess.run(['/usr/bin/say', '-v', 'Yuna', '-r', str(rate), '-f', str(root / 'voice' / (cue['id'] + '.txt')), '-o', str(aiff)], check=True)
        subprocess.run(['/usr/bin/afconvert', '-f', 'WAVE', '-d', 'LEI16@48000', str(aiff), str(wav)], check=True)
        with wave.open(str(wav), 'rb') as reader:
            assert reader.getnchannels() == 1 and reader.getsampwidth() == 2
            samples = array.array('h', reader.readframes(reader.getnframes()))
        if sys.byteorder != 'little':
            samples.byteswap()
        active = [i for i, value in enumerate(samples) if abs(value) > 55]
        assert active, f'Silent voice output: {cue["id"]}'
        begin = max(0, active[0] - int(0.035 * sample_rate))
        end = min(len(samples), active[-1] + int(0.08 * sample_rate))
        samples = samples[begin:end]
        duration = len(samples) / sample_rate
        if duration <= budget - 0.03:
            break
        rate = math.ceil(rate * duration / (budget - 0.09)) + 2
    assert duration <= budget, f'Voice exceeds scene: {cue["id"]}, {duration} > {budget}'
    # Short fades prevent clicks at each independent voice cue.
    fade = min(240, len(samples) // 2)
    for i in range(fade):
        samples[i] = round(samples[i] * i / fade)
        samples[-1-i] = round(samples[-1-i] * i / fade)
    with wave.open(str(trimmed), 'wb') as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(sample_rate)
        writer.writeframes(samples.tobytes())
    report.append({**cue, 'voice': 'macOS Yuna (Korean built-in synthetic voice)', 'rate': rate, 'duration': duration, 'file': str(trimmed)})
    print(cue['id'], 'seconds', round(duration, 3), 'rate', rate, flush=True)

total_frames = round((980 / 30) * sample_rate)
mix = array.array('h', [0]) * total_frames
for cue in report:
    with wave.open(cue['file'], 'rb') as reader:
        data = array.array('h', reader.readframes(reader.getnframes()))
    start = round(cue['start'] * sample_rate)
    assert start + len(data) <= total_frames
    mix[start:start + len(data)] = data
peak = max(abs(value) for value in mix)
target_peak = round(32767 * 10 ** (-3 / 20))
gain = target_peak / peak
mix = array.array('h', (round(value * gain) for value in mix))
with wave.open(str(root / 'jango-narration.wav'), 'wb') as writer:
    writer.setnchannels(1)
    writer.setsampwidth(2)
    writer.setframerate(sample_rate)
    writer.writeframes(mix.tobytes())
(root / 'voice-timing.json').write_text(json.dumps({'duration': total_frames / sample_rate, 'sample_rate': sample_rate, 'normalized_peak_dbfs': -3, 'gain': gain, 'cues': report}, ensure_ascii=False, indent=2))
(root / 'narration-script.txt').write_text('\n'.join(f'{cue["start"]:.2f}s — {cue["text"]}' for cue in report) + '\n')
print('VOICE_COMPLETE', total_frames / sample_rate, flush=True)
