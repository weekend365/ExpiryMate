from pathlib import Path
import json
import wave

import numpy as np

ROOT = Path(__file__).resolve().parent
VOICE_ROOT = ROOT.parent / 'app-walkthrough-reel-v5-natural-voice'


def read_pcm(path):
    with wave.open(str(path)) as f:
        assert f.getsampwidth() == 2 and f.getframerate() == 48000
        channels = f.getnchannels()
        return np.frombuffer(f.readframes(f.getnframes()), dtype='<i2').reshape(-1, channels).astype(np.float64) / 32768


def db(value):
    return float(20 * np.log10(max(float(value), 1e-12)))


rate = 48000
voice = read_pcm(VOICE_ROOT / 'jango-narration.wav')
assert len(voice) == 1568000 and voice.shape[1] == 1
music = read_pcm(ROOT / 'music/Carefree.wav')[:len(voice)]
assert music.shape == (len(voice), 2)
duration = len(voice) / rate
time = np.arange(len(voice)) / rate
cues = json.loads((VOICE_ROOT / 'narration-cues.json').read_text())['cues']

# Leave the approved narration's speed, pitch, timing, and level unchanged.
# Use smooth ramps around each complete phrase, so breaths do not cause pumping.
gap_rms_dbfs = -25.0
duck_db = 7.5
music_rms = np.sqrt(np.mean(music**2))
base_gain = 10 ** (gap_rms_dbfs / 20) / music_rms
duck_amount = np.zeros(len(voice))
for cue in cues:
    start, end = cue['start'], cue['end']
    attack_start, release_end = max(0.0, start - .18), min(duration, end + .42)
    curve = np.interp(time, [attack_start, start, end, release_end], [0, 1, 1, 0])
    if attack_start == 0:
        curve[:round(start * rate)] = 1
    duck_amount = np.maximum(duck_amount, curve)
gain = base_gain * 10 ** (-duck_db * duck_amount / 20)
gain *= np.minimum(time / .45, 1)
gain *= np.minimum(np.maximum((duration - time) / 1.1, 0), 1)
bed = music * gain[:, None]
mix = np.repeat(voice, 2, axis=1) + bed
peak = np.max(np.abs(mix))
assert peak < 10 ** (-1 / 20), 'Unexpected peak; lower the music before exporting'
assert np.isfinite(mix).all()
with wave.open(str(ROOT / 'jango-carefree-mix.wav'), 'wb') as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(rate)
    f.writeframes(np.round(mix * 32767).astype('<i2').tobytes())

report = {
    'music': 'Carefree — Kevin MacLeod', 'music_excerpt_seconds': [0, duration],
    'narration': 'User-selected delicate recording, existing alignment preserved',
    'duration_seconds': duration, 'sample_rate': rate, 'channels': 2,
    'music_nominal_gap_rms_dbfs': gap_rms_dbfs,
    'music_duck_during_narration_db': duck_db,
    'music_nominal_speech_rms_dbfs': gap_rms_dbfs - duck_db,
    'music_fade_in_seconds': .45, 'music_fade_out_seconds': 1.1,
    'voice_gain_db': 0, 'mix_peak_dbfs': db(peak),
    'mix_rms_dbfs': db(np.sqrt(np.mean(mix**2))),
    'clipped_samples': int(np.count_nonzero(np.abs(mix) >= 1)),
    'cues': cues,
}
(ROOT / 'audio-mix-settings.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
credit = '''Music: “Carefree” — Kevin MacLeod (incompetech.com)
https://incompetech.com/music/royalty-free/index.html?gt=&isrc=USUAN1400037
Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
영상 길이에 맞춰 발췌·음량 편집.
'''
(ROOT / 'music-credit.txt').write_text(credit)
print(json.dumps({k: v for k, v in report.items() if k != 'cues'}, ensure_ascii=False, indent=2))
