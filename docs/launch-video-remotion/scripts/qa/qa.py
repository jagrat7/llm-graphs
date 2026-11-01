"""QA gates for out/launch.mp4. Writes out/qa/ and prints a report.

- glitch scan: every frame against its neighbours; flags a frame whose difference from the
  previous frame is a spike (>4x the median of the surrounding 1 s and above a floor), and
  near-uniform frames (dropouts)
- WCAG 2.3.1 general flash: per region (a quarter of a 10-degree field at 1080p viewing,
  about 320x180 px), relative-luminance transitions of >= 10% where the darker state is
  below 0.8; a flash is a pair of opposing transitions; more than 3 in any 1 s fails
- seam sheets: for every transition on a bar line, frames at -0.25 s, -1 f, cut, +1 f, +0.25 s
- contact sheets: one frame a second at 640 px (out/contact-sheet.png), at 360 px (phone),
  and the same frames at full 1080p in out/qa/frames-1080/
- loudness: integrated LUFS, LRA and true peak of the muxed audio (ffmpeg ebur128)
Run: python -I scripts/qa/qa.py [--dark]
"""
import json
import os
import re
import subprocess

import numpy as np
from PIL import Image, ImageDraw

import sys

DARK = "--dark" in sys.argv
VIDEO = "out/launch-dark.mp4" if DARK else "out/launch.mp4"
OUT = "out/qa-dark" if DARK else "out/qa"
SHEET = "out/contact-sheet-dark.png" if DARK else "out/contact-sheet.png"
import shutil
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(f"{OUT}/frames-1080", exist_ok=True)
os.makedirs(f"{OUT}/seams", exist_ok=True)
FPS = 30
grid = json.load(open("data/beat-grid.json"))
BAR = grid["bar_seconds"] * FPS


def at(bar, beats=0):
    return round((bar + beats / 4) * BAR)


def probe_frames():
    out = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", VIDEO], capture_output=True, text=True).stdout
    return int(out.strip())


N = probe_frames()


def read_frames(width, height):
    cmd = ["ffmpeg", "-v", "error", "-i", VIDEO, "-vf", f"scale={width}:{height}:flags=area,format=rgb24", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, height, width, 3)


# ---- glitch + flash scan at 480x270 (regions of 80x45 = 320x180 at 1080p)
frames = read_frames(480, 270).astype(np.float32) / 255
lin = np.where(frames <= 0.04045, frames / 12.92, ((frames + 0.055) / 1.055) ** 2.4)
lum = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]

diff = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2, 3))
glitches = []
for i in range(len(diff)):
    window = diff[max(0, i - 15): i + 16]
    median = float(np.median(window))
    if diff[i] > max(4 * median, 0.012):
        glitches.append({"frame": i + 1, "seconds": round((i + 1) / FPS, 3), "diff": round(float(diff[i]), 4), "local_median": round(median, 4)})
# A dropout is a short blank: a near-uniform frame (or run of at most 3) between frames with
# content. Longer quiet stretches are holds on the bare sheet, listed separately.
blank = [frames[i].std() < 0.01 for i in range(len(frames))]
dropouts, quiet = [], []
i = 0
while i < len(blank):
    if blank[i]:
        j = i
        while j + 1 < len(blank) and blank[j + 1]:
            j += 1
        (dropouts if j - i + 1 <= 3 and i > 0 and j < len(blank) - 1 else quiet).extend(range(i, j + 1))
        i = j + 1
    else:
        i += 1

regions = lum.reshape(len(lum), 6, 45, 6, 80).mean(axis=(2, 4))  # frames x 6 x 6
worst = 0
flash_fail = []
for ry in range(6):
    for rx in range(6):
        series = regions[:, ry, rx]
        # transitions: monotone runs whose total change is >= 0.1 with darker end < 0.8
        events = []
        start = 0
        direction = 0
        for i in range(1, len(series)):
            d = np.sign(series[i] - series[i - 1])
            if d != 0 and direction != 0 and d != direction:
                lo, hi = sorted((series[start], series[i - 1]))
                if hi - lo >= 0.1 and lo < 0.8:
                    events.append((i - 1, direction))
                start = i - 1
            if d != 0:
                direction = d
        flashes = [events[k][0] for k in range(1, len(events)) if events[k][1] != events[k - 1][1]]
        for f in flashes:
            count = sum(1 for g in flashes if f <= g < f + FPS)
            worst = max(worst, count)
            if count > 3:
                flash_fail.append({"region": [rx, ry], "frame": f, "count": count})

# ---- loudness
ebur = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", VIDEO, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
summary = ebur[ebur.rfind("Summary:"):]
integrated = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
lra = float(re.search(r"LRA:\s+(-?[\d.]+) LU", summary).group(1))
true_peak = float(re.search(r"True peak:\s+Peak:\s+(-?[\d.]+) dBFS", summary, re.S).group(1))


def grab(frame, path, width=None):
    vf = f"select=eq(n\\,{frame})" + (f",scale={width}:-1:flags=lanczos" if width else "")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", VIDEO, "-vf", vf, "-frames:v", "1", path], check=True)


def tile(paths, labels, out, cols, width):
    ims = [Image.open(p).convert("RGB") for p in paths]
    h = int(width * ims[0].height / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    pad, cap = 6, 18
    sheet = Image.new("RGB", (cols * (width + pad) + pad, rows * (h + cap + pad) + pad), (34, 34, 34))
    draw = ImageDraw.Draw(sheet)
    for i, (im, label) in enumerate(zip(ims, labels)):
        r, c = divmod(i, cols)
        x, y = pad + c * (width + pad), pad + r * (h + cap + pad)
        draw.text((x + 2, y + 2), label, fill=(225, 225, 225))
        sheet.paste(im.resize((width, h), Image.LANCZOS), (x, y + cap))
    sheet.save(out)


# ---- contact sheets: one frame per second, plus the last frame
picks = list(range(0, N, FPS)) + [N - 1]
paths = []
for f in picks:
    p = f"{OUT}/frames-1080/f{f:04d}.png"
    if not os.path.exists(p):
        grab(f, p)
    paths.append(p)
labels = [f"{f / FPS:5.2f}s  f{f}" for f in picks]
tile(paths, labels, SHEET, 6, 640)
tile(paths, labels, f"{OUT}/contact-sheet-360.png", 6, 360)

# ---- seams: every transition on a bar line, and the loop seam
transitions = {
    "opening sheets": 0,
    "headline 2 (bar 2)": at(2),
    "collapse (bar 4)": at(4),
    "chart lands (bar 5)": at(5),
    "headline 4 (bar 6)": at(6),
    "switch TB (bar 7)": at(7),
    "switch ARC (bar 8)": at(8),
    "back to DeepSWE (bar 9)": at(9),
    "frontier (bar 10)": at(10),
    "punch-in (bar 12)": at(12),
    "readout (bar 12, beat 3)": at(12, 2),
    "share (bar 14)": at(14),
    "shared image (bar 15)": at(15) + 6,
    "image settles (bar 17)": at(17) - 14,
    "cube (bar 17)": at(17),
    "end card (bar 20)": at(20),
}
seam_rows = []
for name, cut in transitions.items():
    offsets = [-8, -1, 0, 1, 8]
    frames_at = [min(N - 1, max(0, cut + o)) for o in offsets]
    ps = []
    for f in frames_at:
        p = f"{OUT}/seams/f{f:04d}.png"
        if not os.path.exists(p):
            grab(f, p, 640)
        ps.append(p)
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    tile(ps, [f"{name}  {o:+d}f (f{f})" for o, f in zip(offsets, frames_at)], f"{OUT}/seams/seam-{slug}.png", 5, 380)
    seam_rows.append({"transition": name, "frame": cut, "seconds": round(cut / FPS, 3), "bar_line_seconds": round(cut / FPS, 3)})
# Loop seam: last frames into the first ones.
loop = [N - 8, N - 1, 0, 1, 8]
ps = []
for f in loop:
    p = f"{OUT}/seams/f{f:04d}.png"
    if not os.path.exists(p):
        grab(f, p, 640)
    ps.append(p)
tile(ps, [f"loop f{f}" for f in loop], f"{OUT}/seams/seam-loop.png", 5, 380)
# ---- motion strips: each move sampled every few frames, start to settle
os.makedirs(f"{OUT}/strips", exist_ok=True)
moves = {
    "01-sheets-arrive": (0, 24, 3),
    "02-row-marks": (at(1) - 2, at(1) + 14, 2),
    "03-collapse": (at(4), at(4) + 64, 8),
    "04-points-land": (at(5), at(5) + 56, 7),
    "05-switch-to-TB": (at(7), at(7) + 32, 4),
    "06-frontier-draw": (at(10), at(10) + 42, 6),
    "07-punch-in": (at(12), at(12) + 32, 4),
    "08-readout": (at(12, 2) - 2, at(12, 2) + 14, 2),
    "09-pull-back-share": (at(14), at(15) + 24, 8),
    "09b-image-lands": (at(15), at(15) + 32, 4),
    "09c-image-settles": (at(17) - 16, at(17) + 4, 4),
    "10-turn-cube": (at(17), at(18) + 4, 8),
    "10b-orbit": (at(18), at(20), 30),
    "11-end-card": (at(20) - 12, at(20) + 40, 6),
}
for name, (a, b, step) in moves.items():
    ps = []
    fs = list(range(a, min(b, N - 1) + 1, step))
    for f in fs:
        p = f"{OUT}/strips/f{f:04d}.png"
        if not os.path.exists(p):
            grab(f, p, 640)
        ps.append(p)
    tile(ps, [f"{name} f{f} ({f / FPS:.2f}s)" for f in fs], f"{OUT}/strips/strip-{name}.png", 3, 420)

first_last = float(np.abs(frames[0] - frames[-1]).mean())

report = {
    "frames": N,
    "duration_seconds": round(N / FPS, 3),
    "glitch_candidates": glitches,
    "dropouts": dropouts,
    "near_uniform_holds": quiet,
    "flash_max_per_second": worst,
    "flash_failures": flash_fail[:10],
    "loudness": {"integrated_lufs": integrated, "lra_lu": lra, "true_peak_dbfs": true_peak},
    "first_vs_last_frame_mean_abs_diff": round(first_last, 4),
    "transitions": seam_rows,
}
json.dump(report, open(f"{OUT}/report.json", "w"), indent=2)
print(json.dumps({k: v for k, v in report.items() if k != "transitions"}, indent=2))

# Glitch candidates include intended fades and are for review; dropouts and flashes fail the gate.
if dropouts or flash_fail:
    sys.exit(1)
