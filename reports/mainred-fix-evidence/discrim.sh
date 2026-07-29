#!/usr/bin/env bash
# INTERLEAVED DISCRIMINATOR. Pre-registered before the first run:
#   PAIRS = 10, arms alternate armA -> armB inside each pair.
#   armA = 200ms sleep BEFORE eventBus.Subscribe; armB = same sleep AFTER it.
#   Base for both: cc92735, unfixed. Only the sleep POSITION differs.
#   Command: go test ./internal/server -run '^TestWatchTasks_NoInitial$' -count=1
#   Both arms every pair or neither. Every run reported with duration and load.
#   If the arms split, the split is the result.
set -u
OUT=/tmp/mainred/discrim-results.tsv
: > "$OUT"; printf 'pair\tarm\texit\tsecs\tloadavg1\n' >> "$OUT"
( cd /tmp/mainred/armA && go build ./... ) >/dev/null 2>&1
( cd /tmp/mainred/armB && go build ./... ) >/dev/null 2>&1
for p in $(seq 1 10); do
  for arm in armA armB; do
    load=$(cut -d' ' -f1 /proc/loadavg); t0=$(date +%s.%N)
    ( cd /tmp/mainred/$arm && go test ./internal/server -run '^TestWatchTasks_NoInitial$' -count=1 ) \
      > /tmp/mainred/d.$arm.$p.log 2>&1
    rc=$?; t1=$(date +%s.%N); secs=$(echo "$t1 - $t0" | bc)
    printf '%d\t%s\t%d\t%.1f\t%s\n' "$p" "$arm" "$rc" "$secs" "$load" >> "$OUT"
    printf 'pair %2d  %s  exit=%d  %5.1fs  load=%s\n' "$p" "$arm" "$rc" "$secs" "$load"
  done
done
echo DONE
