#!/usr/bin/env bash
# Downloads the free third-party assets this film uses (not committed: the
# Mixkit licenses don't allow redistributing the raw files on their own).
# Licenses and sources: see LICENSES.md.
set -euo pipefail
cd "$(dirname "$0")/assets/stock"
UA="Mozilla/5.0 (X11; Linux x86_64) Chrome/141"

# Mixkit Stock Video Free License (commercial use, no attribution required)
for id in 2846 44694 487; do
  [ -s video/$id.mp4 ] || curl -sSfL -A "$UA" -o video/$id.mp4 "https://assets.mixkit.co/videos/$id/$id-720.mp4"
done

# Mixkit Sound Effects Free License (commercial use, no attribution required)
for id in 444 1253 1393 1104 2380 490 494 784 788 759 1143 1492 1486 2350 2678; do
  [ -s sfx/$id.mp3 ] || curl -sSfL -A "$UA" -o sfx/$id.mp3 "https://assets.mixkit.co/active_storage/sfx/$id/$id-preview.mp3"
done

# VS Chamber Orchestra: Community Edition (CC0 1.0): piano, strings, harp, timpani
if [ ! -d samples/vsco ]; then
  git clone --filter=blob:none --no-checkout --depth 1 https://github.com/sgossner/VSCO-2-CE.git samples/vsco
  git -C samples/vsco sparse-checkout init --no-cone
  git -C samples/vsco sparse-checkout set "/Keys/Upright Piano/" "/Strings/Violin Section/susVib/" "/Strings/Viola Section/susvib/" \
    "/Strings/Cello Section/susvib/" "/Strings/Solo Contrabass/SusVib/" "/Strings/Harp/" "/Percussion/Timpani/" "/Percussion/Glock/" "/LICENSE"
  git -C samples/vsco checkout
fi
echo "assets ready"
