#!/usr/bin/env bash
# Render the film end to end: data -> silent picture -> soundtrack -> loudness -> BT.709 master.
# Needs: bun (or npm), ffmpeg, and a Python venv with librosa, soundfile, numpy, pyloudnorm
# (set PY to its python; default /tmp/lv-venv/bin/python).
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PY:-/tmp/lv-venv/bin/python}

node scripts/derive-data.mjs
[ -f audio/serene-view-arulo-mixkit-443.mp3 ] || scripts/audio/fetch-music.sh
[ -f data/beat-grid.json ] || "$PY" -I scripts/audio/analyze.py audio/serene-view-arulo-mixkit-443.mp3

# One timeline, two pads: the light master and the dark one (src/Root.tsx).
for comp in Launch LaunchDark; do
  suffix=$([ "$comp" = LaunchDark ] && echo -dark || true)
  npx remotion render src/index.ts "$comp" "out/video-silent$suffix.mp4" \
    --codec h264 --crf 14 --pixel-format yuv420p --color-space bt709 --concurrency 8
done

"$PY" -I scripts/audio/mix.py

# Two-pass EBU R128 normalisation to -15 LUFS integrated, true peak -1.5 dBTP.
measure=$(ffmpeg -hide_banner -nostats -i out/soundtrack.wav -af loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$measure" | jq -r .input_i); mtp=$(echo "$measure" | jq -r .input_tp)
mlra=$(echo "$measure" | jq -r .input_lra); mth=$(echo "$measure" | jq -r .input_thresh)
off=$(echo "$measure" | jq -r .target_offset)
ffmpeg -y -hide_banner -loglevel error -i out/soundtrack.wav \
  -af "loudnorm=I=-15:TP=-1.5:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true,aresample=48000" \
  -c:a pcm_s24le out/soundtrack-norm.wav

# Mux. The picture is copied as rendered: Remotion encodes BT.709 (--color-space bt709) and
# tags it limited range; h264_metadata writes the same flags into the stream's VUI as well.
for suffix in "" -dark; do
  ffmpeg -y -hide_banner -loglevel error -i "out/video-silent$suffix.mp4" -i out/soundtrack-norm.wav \
    -map 0:v:0 -map 1:a:0 -c:v copy \
    -bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0 \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
    -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "out/launch$suffix.mp4"
done

for f in out/launch.mp4 out/launch-dark.mp4; do echo "$f"; ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,pix_fmt,color_range,color_space,color_transfer,color_primaries,r_frame_rate -of default=nw=1 "$f"; done
