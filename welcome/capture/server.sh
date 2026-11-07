#!/usr/bin/env bash
# Restart a local demo-mode server on :3200 with a fresh embedded database.
cd "$(dirname "$0")/../.."
for p in $(ps -eo pid,args | awk '/next-server|next start -p 3200/ && !/awk/ {print $1}'); do kill "$p" 2>/dev/null; done
sleep 2
rm -rf .data-welcome
DEMO_MODE=true DEMO_DATA_DIR=.data-welcome ANTHROPIC_API_KEY= nohup npx next start -p 3200 > /tmp/claude-0/yoru-welcome-server.log 2>&1 &
for i in $(seq 1 60); do curl -sf localhost:3200/api/health >/dev/null && break; sleep 1; done
curl -s localhost:3200/api/health | head -c 120; echo
