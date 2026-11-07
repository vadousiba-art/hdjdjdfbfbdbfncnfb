#!/usr/bin/env bash
# Web delivery files for the welcome film, from the masters in out/.
#   bash encode.sh   -> ../public/welcome/v1/{full,short}-{land,port}.{webm,mp4}, posters, og.jpg
# WebM: VP9 + Opus (Chrome, Firefox, Edge, Android). MP4: H.264 + AAC (Safari, iOS).
# A light temporal denoise takes the film grain down to what the bitrate can carry.
set -euo pipefail
cd "$(dirname "$0")"
V=$(node -e 'console.log(require("../src/lib/welcome/cues.json").version)')
DEST="../public/welcome/v$V"
mkdir -p "$DEST"
VF_LAND="scale=1920:1080:flags=lanczos,hqdn3d=3:3:9:9"
VF_PORT="scale=1080:1920:flags=lanczos,hqdn3d=3:3:9:9"
for cut in full short; do
  for o in land port; do
    src="out/yoru-welcome-$cut-$o.mp4"
    [ -f "$src" ] || { echo "missing $src"; exit 1; }
    vf=$([ "$o" = land ] && echo "$VF_LAND" || echo "$VF_PORT")
    ffmpeg -v error -y -i "$src" -vf "$vf" -c:v libvpx-vp9 -crf 40 -b:v 0 -row-mt 1 -deadline good -cpu-used 4 -g 120 \
      -c:a libopus -b:a 96k "$DEST/$cut-$o.webm"
    ffmpeg -v error -y -i "$src" -vf "$vf" -c:v libx264 -preset slow -crf 27 -profile:v high -level 4.1 -pix_fmt yuv420p -g 120 \
      -c:a aac -b:a 128k -movflags +faststart "$DEST/$cut-$o.mp4"
    echo "encoded $cut-$o"
  done
done
# Posters: the logo lockup with the tagline (12.6 s into the full film).
ffmpeg -v error -y -ss 12.6 -i out/yoru-welcome-full-land.mp4 -frames:v 1 -q:v 3 "$DEST/poster-land.jpg"
ffmpeg -v error -y -ss 12.6 -i out/yoru-welcome-full-port.mp4 -frames:v 1 -q:v 3 "$DEST/poster-port.jpg"
# Link preview image (1200x630) for shared links.
ffmpeg -v error -y -ss 12.6 -i out/yoru-welcome-full-land.mp4 -frames:v 1 -vf "scale=1200:675:flags=lanczos,crop=1200:630" -q:v 3 "$DEST/og.jpg"
ls -la "$DEST"
