#!/usr/bin/env bash
# Interleaved paired measurement, per the coordinator's binding procedure.
#
# PRE-REGISTERED BEFORE THE FIRST RUN:
#   PAIRS = 10. Arms alternate unfixed -> fixed within each pair.
#   Command per run: go test ./... -count=1   (full suite, web/dist present)
#   Every run is reported individually with wall time and observed host load.
#   Both arms run every pair, or neither. No arm is re-run, extended or dropped.
#   If the arms split, the split is the result.
set -u
PAIRS=10
OUT=/tmp/mainred/paired2-results.tsv
: > "$OUT"
printf 'pair\tarm\texit\tsecs\tloadavg1\tfailing_tests\n' >> "$OUT"

run_arm() {
  local pair=$1 arm=$2 dir=$3
  local log=/tmp/mainred/run2.$arm.$pair.log
  local load; load=$(cut -d' ' -f1 /proc/loadavg)
  local t0; t0=$(date +%s.%N)
  ( cd "$dir" && go test ./... -count=1 ) > "$log" 2>&1
  local rc=$?
  local t1; t1=$(date +%s.%N)
  local secs; secs=$(echo "$t1 - $t0" | bc)
  local failing; failing=$(grep -E '^--- FAIL' "$log" | sed -E 's/^--- FAIL: ([^ ]+).*/\1/' | sort -u | paste -sd, -)
  [ -z "$failing" ] && failing="-"
  printf '%d\t%s\t%d\t%.1f\t%s\t%s\n' "$pair" "$arm" "$rc" "$secs" "$load" "$failing" >> "$OUT"
  printf 'pair %2d  %-7s exit=%d  %6.1fs  load=%s  %s\n' "$pair" "$arm" "$rc" "$secs" "$load" "$failing"
}

# Warm both arms so first-run compilation is not charged to pair 1.
( cd /tmp/mainred/unfixed && go build ./... ) >/dev/null 2>&1
( cd /tmp/mainred/fixed   && go build ./... ) >/dev/null 2>&1

for p in $(seq 1 $PAIRS); do
  run_arm "$p" unfixed /tmp/mainred/unfixed
  run_arm "$p" fixed   /tmp/mainred/fixed
done
echo "DONE"
