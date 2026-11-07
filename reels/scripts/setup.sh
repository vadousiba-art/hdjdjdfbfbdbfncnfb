#!/bin/sh
# One-time machine setup (npm run setup): ffmpeg, whisper.cpp built in bin/whisper.cpp, and the
# base.en model. Safe to re-run; it skips what is already there. macOS uses Homebrew, Linux apt.
set -e
cd "$(dirname "$0")/.."

# the whisper.cpp commit scripts/transcribe.mjs was measured against (its DTW timing rule)
WHISPER_REV=4da27c41cebadb3cbbcd2563e9c7cbc8d84bdcad

need() {
  command -v "$1" >/dev/null 2>&1 && return
  echo "installing $1"
  if command -v brew >/dev/null 2>&1; then
    brew install "$1"
  elif command -v apt-get >/dev/null 2>&1; then
    if [ "$(id -u)" = 0 ]; then apt-get install -y "$1"; else sudo apt-get install -y "$1"; fi
  else
    echo "please install $1 and run this again" >&2
    exit 1
  fi
}
need ffmpeg
need cmake
need git

if [ ! -d bin/whisper.cpp/.git ]; then
  mkdir -p bin/whisper.cpp
  git -C bin/whisper.cpp init -q
  git -C bin/whisper.cpp remote add origin https://github.com/ggml-org/whisper.cpp.git
  git -C bin/whisper.cpp fetch -q --depth 1 origin "$WHISPER_REV"
  git -C bin/whisper.cpp checkout -q FETCH_HEAD
fi

if [ ! -x bin/whisper.cpp/build/bin/whisper-cli ]; then
  cmake -S bin/whisper.cpp -B bin/whisper.cpp/build -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF
  cmake --build bin/whisper.cpp/build -j --config Release --target whisper-cli
fi

if [ ! -f bin/whisper.cpp/models/ggml-base.en.bin ]; then
  sh bin/whisper.cpp/models/download-ggml-model.sh base.en
fi

bin/whisper.cpp/build/bin/whisper-cli --help >/dev/null 2>&1 && echo "whisper.cpp ready: bin/whisper.cpp ($(git -C bin/whisper.cpp rev-parse --short HEAD), base.en)"
