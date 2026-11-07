#!/usr/bin/env bash
# Turns the downloaded stock clips (./fetch-assets.sh) into frame sequences the
# film page reads: 30 fps, 540x960 vertical. Ink clips become alpha mattes
# (black ink, transparent water) for transitions.
set -euo pipefail
cd "$(dirname "$0")/../assets/stock"
V=video; F=frames
rm -rf $F && mkdir -p $F/bokeh $F/rain $F/ink487
# Night avenue bokeh (vertical source), slowed to 0.5x for a dreamy drift.
ffmpeg -loglevel error -i $V/44694.mp4 -vf "setpts=2.0*PTS,fps=30,scale=540:960" -q:v 3 $F/bokeh/%04d.jpg
# Rain on a window: centre crop to vertical, slowed to 0.6x.
ffmpeg -loglevel error -t 4 -i $V/2846.mp4 -vf "setpts=1.6667*PTS,fps=30,crop=405:720:438:0,scale=540:960" -q:v 3 $F/rain/%04d.jpg
# Ink in water -> black ink with alpha (1 - luminance), centre crop.
for id in 487; do
  ffmpeg -loglevel error -t 6 -i $V/$id.mp4 -filter_complex \
    "[0:v]fps=30,crop=405:720:438:0,scale=540:960,split[x][y];[x]format=gray,negate,curves=all='0/0 0.25/0 0.75/1 1/1'[a];[y]lutrgb=r=0:g=0:b=0[b];[b][a]alphamerge,format=rgba" \
    $F/ink$id/%04d.png
done
for d in $F/*; do echo "$d $(ls $d | wc -l)"; done
