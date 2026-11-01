"""Build the soundtrack: the music bed from its first useful downbeat, plus small paper and pen
sounds synthesised here, placed on the same frames the animation uses (src/theme.ts `at`).

Pitched sounds sit on notes shared by C# and G# major (C#, D#, F, G#, A#): librosa's key estimate is C# major, a chroma read of the full mix leans G# major.
Output: out/soundtrack.wav (48 kHz stereo, before loudness normalisation; mix.sh does that).
Run: python -I scripts/audio/mix.py
"""
import json

import librosa
import numpy as np
import soundfile as sf

SR = 48000
FPS = 30
grid = json.load(open("data/beat-grid.json"))
BAR_S = grid["bar_seconds"]
BAR = BAR_S * FPS
BARS = 20
DURATION_FRAMES = round(BARS * BAR)
LENGTH = DURATION_FRAMES / FPS
# Video frame 0 is the track's bar 4: the second chord of the intro, four bars before the bass.
MUSIC_START = grid["bars"][4]["start"]


def at(bar, beats=0):
    return round((bar + beats / 4) * BAR)


def sec(frame):
    return frame / FPS


rng = np.random.default_rng(7)
NOTE = {"C#5": 554.37, "D#5": 622.25, "F5": 698.46, "G#5": 830.61, "A#5": 932.33, "C#6": 1108.73, "G#4": 415.30, "C#4": 277.18}


def envelope(n, attack, decay):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / decay)


def bandpass_noise(n, low, high):
    spectrum = np.fft.rfft(rng.standard_normal(n))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    mask = (freqs > low) & (freqs < high)
    shaped = np.fft.irfft(spectrum * mask, n)
    return shaped / (np.max(np.abs(shaped)) + 1e-9)


def pen_tick(note, gain=1.0):
    """A felt-tip tap: a short dry click with a faint sine ring at the note."""
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    click = bandpass_noise(n, 2500, 7000) * envelope(n, 0.001, 0.008)
    ring = np.sin(2 * np.pi * NOTE[note] * t) * envelope(n, 0.003, 0.09)
    return gain * (0.5 * click + 0.25 * ring)


def paper_slide(duration, gain=1.0, low=900, high=5200):
    """Sheets sliding over each other: soft band-limited noise under a smooth swell."""
    n = int(duration * SR)
    shape = np.sin(np.linspace(0, np.pi, n)) ** 1.6
    return gain * bandpass_noise(n, low, high) * shape


def paper_grain(gain=1.0):
    """One sheet laid on another: a dry 60 ms paper contact, no swell."""
    n = int(0.06 * SR)
    return gain * bandpass_noise(n, 1500, 7000) * envelope(n, 0.0015, 0.012)


def paper_tap(gain=1.0, pitch=103.83):
    """A stack of paper squared on a desk: low thump (on G#2) plus a short soft rustle."""
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * pitch * t) * envelope(n, 0.002, 0.05)
    rustle = bandpass_noise(n, 600, 3000) * envelope(n, 0.002, 0.03)
    return gain * (0.8 * thump + 0.35 * rustle)


def pen_line(duration, gain=1.0):
    """A pen drawn along a ruler: fine scratch with a slow, slightly uneven pressure."""
    n = int(duration * SR)
    t = np.arange(n) / SR
    # The draw is eased in-out, so the pen is fastest mid-stroke: pressure follows that speed.
    speed = np.sin(np.pi * t / duration) ** 1.5
    pressure = speed * (0.8 + 0.2 * np.sin(2 * np.pi * 5.3 * t + 0.6))
    edge = np.minimum(1, np.minimum(t / 0.05, (duration - t) / 0.12))
    return gain * bandpass_noise(n, 3000, 9000) * pressure * np.clip(edge, 0, 1)


def stamp(gain=1.0, pitch=138.59):
    """The seal: a rubber stamp pressed once, its body on C#3."""
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * pitch * t) * envelope(n, 0.003, 0.07)
    contact = bandpass_noise(n, 300, 2400) * envelope(n, 0.001, 0.02)
    return gain * (0.9 * body + 0.4 * contact)


sfx = np.zeros(int(LENGTH * SR) + SR)


def place(sound, frame, pan=0.0):
    start = int(sec(frame) * SR)
    end = min(len(sfx), start + len(sound))
    sfx[start:end] += sound[: end - start]


cues = []


def cue(name, frame, sound):
    place(sound, frame)
    cues.append({"cue": name, "frame": frame, "seconds": round(sec(frame), 3)})


# Opening: ten sheets land on the pad (src/Scraps.tsx arrival, frames 4-21).
cue("sheets land", 1, paper_slide(0.55, 0.16, 1200, 6000))
# The focus model's row marked on six leaderboards, two beats apart (HUNT in Scraps.tsx).
for i, (bar, beat) in enumerate([(1, 0), (1, 2), (2, 0), (2, 2), (3, 0), (3, 2)]):
    cue(f"row marked {i + 1}", at(bar, beat), pen_tick(["G#4", "C#5", "D#5", "F5", "G#5", "C#5"][i], 0.13))
# Bar 4: the sheets slide into one stack, the last squaring up on the bar-5 downbeat.
# Each sheet touches the stack as it lands (Scraps.tsx: order k squares at bar 5 - 18 + 2k frames).
for k in range(10):
    cue(f"sheet lands {k + 1}", at(5) - 18 + 2 * k, paper_grain(0.05 + 0.004 * k))
cue("stack squared", at(5), paper_tap(0.10, 103.83))
# Bar 5: points land left to right; a quiet pentatonic rise on sixteenth notes.
scale = ["C#5", "D#5", "F5", "G#5", "A#5", "C#6", "D#5", "F5", "G#5"]
for i in range(9):
    cue(f"points {i + 1}", round(at(5) + 2 + i * BAR / 16), pen_tick(scale[i], 0.06))
# Bars 7-9: the benchmark switches.
for bar in (7, 8, 9):
    cue(f"source switch {bar}", at(bar), paper_slide(0.36, 0.14, 1500, 6500))
# Bar 10: the frontier drawn like a pen along a ruler, 46 frames, loudest where the pen is fastest.
cue("frontier drawn", at(10), pen_line(46 / FPS, 0.12))
# Bar 12 beat 3: the readout opens.
cue("readout", at(12, 2), pen_tick("C#6", 0.10))
# Bar 16: the link typed; one soft tick per segment of the address (host, ?x, &y, &z, &ySource).
URL = "llm-graphs.jr7.dev/?x=cost&y=score&z=duration&ySource=deepswe"
for i in [0] + [k for k, ch in enumerate(URL) if ch in "?&"]:
    cue(f"key {i}", at(16) + 14 + round(i * FPS / 46), pen_tick("G#5", 0.08))
# Bar 18: the seal, pressed once on the downbeat.
cue("seal", at(18), stamp(0.155, 138.59))

# Music: from MUSIC_START for the film's length, faded over the last two bars.
music, _ = librosa.load("audio/serene-view-arulo-mixkit-443.mp3", sr=SR, mono=False, offset=MUSIC_START, duration=LENGTH + 0.5)
if music.ndim == 1:
    music = np.stack([music, music])
music = music[:, : int(LENGTH * SR)]
n = music.shape[1]
t = np.arange(n) / SR
fade_in = np.clip(t / 0.2, 0, 1)
fade_start = sec(at(18))
fade = np.where(t < fade_start, 1.0, np.cos(np.clip((t - fade_start) / (LENGTH - fade_start), 0, 1) * np.pi / 2) ** 2)
music = music * fade_in * fade

stereo_sfx = np.stack([sfx[:n], sfx[:n]])
mix = music + stereo_sfx
sf.write("out/soundtrack.wav", mix.T, SR, subtype="FLOAT")
sf.write("out/stem-music.wav", music.T, SR, subtype="FLOAT")
sf.write("out/stem-sfx.wav", stereo_sfx.T, SR, subtype="FLOAT")
json.dump({"music_start_seconds": MUSIC_START, "length_seconds": LENGTH, "cues": cues}, open("out/cues.json", "w"), indent=2)
print(f"soundtrack {LENGTH:.3f}s, music from {MUSIC_START}s, {len(cues)} cues")
