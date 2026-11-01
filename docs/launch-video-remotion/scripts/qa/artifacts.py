"""Write out/qa/artifacts.md: a facts-only index for reviewers (no intentions).
Run after build.sh and qa.py (both themes): python -I scripts/qa/artifacts.py <round>
"""
import json
import subprocess
import sys

round_no = sys.argv[1]
g = json.load(open("data/beat-grid.json"))
c = json.load(open("out/cues.json"))
bar = g["bar_seconds"]


def probe(path):
    return subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height,pix_fmt,color_range,color_space,color_transfer,color_primaries,r_frame_rate,sample_rate,channels:format=duration", "-of", "default=nw=1", path],
        capture_output=True, text=True,
    ).stdout.strip()


def ebur(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    s = out[out.rfind("Summary:"):]
    return " ".join(line.strip() for line in s.splitlines() if line.strip().startswith(("I:", "LRA:", "Peak:")))


L = [f"# Review artifacts (round {round_no})", "", "All paths are relative to the project folder, launch-video-remotion/.", ""]
for name, video, qa, sheet in [("Light master", "out/launch.mp4", "out/qa", "out/contact-sheet.png"), ("Dark master (same timeline, dark theme)", "out/launch-dark.mp4", "out/qa-dark", "out/contact-sheet-dark.png")]:
    r = json.load(open(f"{qa}/report.json"))
    L += [f"## {name}", "", f"- Video: {video}", f"- Contact sheet, 1 frame/s at 640 px: {sheet}", f"- Contact sheet at 360 px (phone width): {qa}/contact-sheet-360.png",
          f"- Full-res 1080p frames, 1/s: {qa}/frames-1080/fNNNN.png (NNNN = frame number, 30 fps)", f"- Seam sheets (-8f, -1f, transition, +1f, +8f): {qa}/seams/seam-*.png; loop seam: {qa}/seams/seam-loop.png",
          f"- Motion frame strips: {qa}/strips/strip-*.png", f"- QA report: {qa}/report.json", "", "```", probe(video), "```", "",
          f"- Frames: {r['frames']} ({r['duration_seconds']} s, 30 fps)",
          f"- Glitch candidates (frame-diff spike > 4x local median): {len(r['glitch_candidates'])}; dropouts (blank runs of <= 3 frames): {len(r['dropouts'])}; near-uniform holds: {len(r.get('near_uniform_holds', []))}",
          f"- WCAG 2.3.1 general flash, max flashes in any 1 s per region: {r['flash_max_per_second']}",
          f"- Loudness (ebur128): {ebur(video)}", f"- First vs last frame mean abs diff (0-1): {r['first_vs_last_frame_mean_abs_diff']}", ""]
L += ["## Music", "", f"- \"Serene View\" by Arulo (Mixkit Stock Music Free License). librosa: {g['bpm']} BPM, 4/4, bar = {bar:.4f} s. Key: librosa C# major; a chroma read leans G# major.",
      f"- Video t=0 is track time {c['music_start_seconds']} s (a downbeat). The track's bass enters at track 16.28 s = video {16.2837 - c['music_start_seconds']:.3f} s (bar 4).",
      "- Music fades (cos^2) from bar 18 to the end; 200 ms fade-in at the head.", "", "## Bar grid in video time", "", "| bar | seconds | frame |", "|---|---|---|"]
for n in range(21):
    L.append(f"| {n} | {n * bar:.3f} | {round(n * bar * 30)} |")
L += ["", "## Transitions in the picture (each starts on the listed frame)", "", "| transition | frame | seconds |", "|---|---|---|"]
for t in json.load(open("out/qa/report.json"))["transitions"]:
    L.append(f"| {t['transition']} | {t['frame']} | {t['seconds']} |")
L += ["", "## Synthesised SFX cues (out/cues.json; synthesis in scripts/audio/mix.py)", ""]
for q in c["cues"]:
    L.append(f"- {q['cue']}: frame {q['frame']} ({q['seconds']} s)")
L += ["", "## Audio stems before the final -15 LUFS normalisation", "", f"- Music stem: {ebur('out/stem-music.wav')}", f"- SFX stem: {ebur('out/stem-sfx.wav')}", ""]
open("out/qa/artifacts.md", "w").write("\n".join(L) + "\n")
print("\n".join(L[:40]))
