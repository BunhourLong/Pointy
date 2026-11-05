#!/usr/bin/env bash
# Run one opencode agent as a VISIBLE job: once the run is producing a session,
# a cmux split opens beside this one and attaches to the live run. The split and
# the per-job server wind down when the script exits.
# Usage: scripts/battery.sh <scout|builder|reviewer|pentester|quality|test-auditor> <prompt-file>
# Run from the repo root, inside cmux, from a session started with `opencode serve`? No:
# each job starts its own serve. Works fine from any terminal that is a cmux pane.
set -euo pipefail

role="${1:-}"
prompt_file="${2:-}"
agent="$role"
model="opencode/glm-5.3-flash-free"
case "$role" in
  scout|builder|reviewer|pentester|quality|test-auditor) ;;
  *) echo "Usage: scripts/battery.sh <scout|builder|reviewer|pentester|quality|test-auditor> <prompt-file>" >&2; exit 2 ;;
esac
[ -s "$prompt_file" ] || { echo "Prompt file is missing or empty: $prompt_file" >&2; exit 1; }

repo="$(git rev-parse --show-toplevel)"
scan="$repo/scan"
events="$scan/ai-$role.jsonl"
errors="$scan/ai-$role.err"
reply="$scan/ai-$role.txt"
mkdir -p "$scan"

url=""
surface=""
server=""
run=""
session=""
work="$(mktemp -d)"
cleanup() {
  [ -z "$surface" ] || cmux close-surface --surface "$surface" --force > /dev/null 2>&1 || true
  [ -z "$server" ] || kill "$server" 2> /dev/null || true
  [ -z "$run" ] || kill "$run" 2> /dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

# opencode hangs at provider rate limits instead of exiting; a surviving alarm stops it.
opencode_run() {
  local timeout="${AI_TIMEOUT:-600}"
  perl -e 'alarm shift; exec @ARGV or die' "$timeout" opencode run "$@"
}

# Graceful fallback: outside cmux the job runs unseen but still runs.
watch_job() {
  local waited=0
  openssl rand -hex 16 > "$work/password"
  export OPENCODE_SERVER_PASSWORD="$(cat "$work/password")"
  (cd "$repo" && exec opencode serve > "$work/serve.log" 2>&1 < /dev/null) &
  server=$!
  disown "$server"
  until [ -n "$url" ] || [ "$waited" -ge 20 ]; do
    sleep 1; waited=$((waited + 1))
    url="$(grep -oE 'http://127\.0\.0\.1:[0-9]+' "$work/serve.log" | head -n 1 || true)"
  done
  [ -n "$url" ] || { echo "opencode serve didn't start; job runs headless." >&2; return 0; }
}

watch_job

# Live view: poll the streaming events for the session id while the run is in
# flight, then attach a cmux split to it. `opencode attach` replays what already
# happened and follows the rest live; nothing to watch if the run already died.
open_split() {
  command -v cmux > /dev/null 2>&1 || return 0
  local waited=0
  while [ "$waited" -lt "${AI_SPLIT_WAIT:-15}" ]; do
    session="$(grep -m1 -oE '"sessionID":"[^"]+"' "$events" | head -n1 | cut -d'"' -f4 || true)"
    [ -n "$session" ] && break
    kill -0 "$run" 2> /dev/null || return 0
    sleep 1; waited=$((waited + 1))
  done
  [ -n "$session" ] || return 0
  surface="$(cmux new-split right --command "OPENCODE_SERVER_PASSWORD=$(cat "$work/password") opencode attach $url --dir $repo -s $session" 2> /dev/null \
    | grep -oE '^OK surface:[0-9]+' | cut -d ' ' -f 2 || true)"
  [ -n "$surface" ] || echo "Couldn't open a cmux split; the job runs unseen." >&2
}

status=0
if [ -n "$url" ]; then
  opencode_run --attach "$url" --dir "$repo" -m "$model" --agent "$agent" --format json "$(cat "$prompt_file")" \
    > "$events" 2> "$errors" < /dev/null &
  run=$!
  open_split
  wait "$run" || status=$?
  run=""
else
  opencode_run --dir "$repo" -m "$model" --agent "$agent" --format json "$(cat "$prompt_file")" \
    > "$events" 2> "$errors" < /dev/null || status=$?
fi

if [ "$status" -eq 142 ]; then
  echo "Stopped after ${AI_TIMEOUT:-600}s (provider stall). Check $errors" >&2
  exit 1
fi
api_error="$(grep -m1 '"type":"error"' "$events" 2>/dev/null | jq -r '.error.data.message // .error.name // empty' 2>/dev/null || true)"
if [ "$status" -ne 0 ] || [ -n "$api_error" ]; then
  echo "opencode failed: ${api_error:-exit $status}" >&2
  tail -n 5 "$errors" >&2 || true
  exit 1
fi

jq -r 'select(.type=="text") | .part.text' "$events" > "$reply" 2>/dev/null || true
[ -s "$reply" ] || { echo "opencode returned nothing" >&2; exit 1; }
jq -r --arg role "$role" 'select(.type=="step_finish") | .part | [now | todate, $role, .cost, .tokens.input, .tokens.output] | @tsv' \
  "$events" >> "$scan/ai-usage.tsv" 2> /dev/null || true
cat "$reply"
