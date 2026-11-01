#!/usr/bin/env bash
# "Serene View" by Arulo, Mixkit Stock Music Free License (https://mixkit.co/license/#musicFree).
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p audio
curl -fsSL -A "Mozilla/5.0" -o audio/serene-view-arulo-mixkit-443.mp3 https://assets.mixkit.co/music/443/443.mp3
