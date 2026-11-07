#!/usr/bin/env bash
# Fresh local demo-mode server on :3200 (embedded database, never production),
# with the clock moved 25 days ahead so the app shows its normal, non-seasonal logo.
cd "$(dirname "$0")/../.."
fuser -k 3200/tcp 2>/dev/null || true
sleep 2
rm -rf .data-film04
export FAKE_DATE_SHIFT_MS=$((25 * 24 * 3600 * 1000))
NODE_OPTIONS="--require $(pwd)/never-background/capture/fakedate.cjs" DEMO_MODE=true DEMO_DATA_DIR=.data-film04 ANTHROPIC_API_KEY= \
  nohup npx next start -p 3200 > /tmp/yoru-film04-server.log 2>&1 &
for i in $(seq 1 60); do curl -sf localhost:3200/api/health >/dev/null && break; sleep 1; done
curl -s localhost:3200/api/health; echo
