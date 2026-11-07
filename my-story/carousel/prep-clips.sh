#!/usr/bin/env bash
# Trims and treats the clips from photos/lost into 1080x1920 30 fps frame
# sequences (photos/clips/<name>/0001.jpg…). Licence plates, addresses and the
# people in the haze clips are never readable: the scooter and tow clips are
# trimmed to the wide parts, the desk and haze clips are heavily blurred.
set -euo pipefail
cd "$(dirname "$0")/.."
L=photos/lost
C=photos/clips
COVER="scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920"
BLUR="gblur=sigma=44:steps=4,eq=saturation=0.3:brightness=-0.09:contrast=0.92"
clip() {  # name, ffmpeg -filter_complex graph ending in [v]
  rm -rf "$C/$1" && mkdir -p "$C/$1"
  ffmpeg -loglevel error -y "${@:3}" -filter_complex "$2" -map "[v]" -r 30 -q:v 3 "$C/$1/%04d.jpg"
  echo "$1: $(ls "$C/$1" | wc -l) frames"
}
# the scooter, only while it's far away (plate unreadable), a touch slower
clip scooter "[0:v]trim=0.6:1.55,setpts=PTS-STARTPTS[a];[0:v]trim=3.45:4.4,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1[c];[c]setpts=1.25*PTS,$COVER[v]" -i $L/scooter.mp4
# the wrecked car, before the shop's address comes into view
clip tow "[0:v]trim=0.35:3.55,setpts=PTS-STARTPTS,$COVER[v]" -i $L/tow.mp4
# the haze: nobody identifiable, nothing legible
clip haze "[0:v]setpts=1.3*PTS,$COVER,$BLUR[v]" -i $L/haze.mp4
clip desk "[0:v]trim=0.3:4.6,setpts=PTS-STARTPTS,setpts=1.1*PTS,$COVER,$BLUR[v]" -i $L/desk.mp4
