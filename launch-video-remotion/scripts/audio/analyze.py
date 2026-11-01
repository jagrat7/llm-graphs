"""Measure the track's beat grid and write data/beat-grid.json.

Beats come from librosa's tracker (tight tempo prior at the track's ~118 BPM); a straight line
fitted through them gives the grid. The downbeat phase is the beat-in-four with the largest
harmonic (chroma) change, which is where this track's chords move.
Run: python -I scripts/audio/analyze.py audio/serene-view-arulo-mixkit-443.mp3
"""
import json
import sys

import librosa
import numpy as np

path = sys.argv[1]
y, sr = librosa.load(path, sr=44100, mono=True)
hop = 256
onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beats = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, start_bpm=117, tightness=400)
times = librosa.frames_to_time(beats, sr=sr, hop_length=hop)
k = np.arange(len(times))
period, offset = np.polyfit(k, times, 1)
residual_ms = float(1000 * np.std(times - (period * k + offset)))

chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
def frame(t):
    return int(t * sr / hop)
change = []
for phase in range(4):
    values = []
    for i in range(phase, len(times) - 1, 4):
        f = frame(times[i])
        values.append(np.linalg.norm(chroma[:, f:f + 20].mean(1) - chroma[:, max(0, f - 20):f].mean(1)))
    change.append(float(np.mean(values)))
phase = int(np.argmax(change))
first_downbeat = times[phase]
while first_downbeat - 4 * period > 0:
    first_downbeat -= 4 * period

# Per-bar loudness, to find where the bass enters and where the track fades.
rms = librosa.feature.rms(y=y, hop_length=441)[0]
rt = np.arange(len(rms)) * 441 / sr
bars = []
t = first_downbeat
while t + 4 * period < len(y) / sr:
    m = (rt >= t) & (rt < t + 4 * period)
    bars.append({"start": round(float(t), 4), "rms_db": round(float(20 * np.log10(rms[m].mean() + 1e-9)), 1)})
    t += 4 * period

grid = {
    "file": path,
    "bpm": round(60 / period, 3),
    "beat_seconds": round(float(period), 6),
    "bar_seconds": round(float(4 * period), 6),
    "first_downbeat": round(float(first_downbeat), 4),
    "beat_fit_residual_ms": round(residual_ms, 2),
    "downbeat_phase_chroma_change": [round(c, 3) for c in change],
    "bars": bars,
}
json.dump(grid, open("data/beat-grid.json", "w"), indent=2)
print(json.dumps({k: v for k, v in grid.items() if k != "bars"}, indent=2))
for i, bar in enumerate(bars[:12]):
    print(i, bar)
