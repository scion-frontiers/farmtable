#!/usr/bin/env bash
# test-194-r4-run-mutants.sh — mutation battery driver for the #194 round-4
# test review.
#
# Standing bars honoured:
#   * mutations are applied by CONTENT via test-194-r4-mutate.py, which aborts
#     if the anchor is not unique (rc=2);
#   * pristine copies live outside the repo in $BAK;
#   * exit codes are captured from the child process directly, never through a
#     pipe (`go test ... > log; rc=$?`);
#   * a non-zero rc with ZERO "--- FAIL" lines is reported INCONCLUSIVE, not
#     KILLED (a compile error is not a killed mutant);
#   * after every restore the file is verified byte-identical by sha256 AND
#     `git status --porcelain` is asserted empty.

set -u
REPO=${FT194_REPO:-/workspace/farmtable-test-194}
MUT=/scion-volumes/scratchpad/projects/farmtable/salvage/test-194-r4-mutate.py
LOGDIR=${LOGDIR:-/tmp/ft194mut}
mkdir -p "$LOGDIR"
cd "$REPO" || exit 1

MUTANTS=(
  M2-drop-enabled-guard
  M3-nondeterministic-tiebreak
  M4-reverse-terminal-precedence
  M5-drop-cancelled-from-tiebreak
  M6-terminal-first-in-stageprecedence
  M7-availability-reads-display-stage
  M8-claimgate-reads-display-stage
)

printf '%-42s %-6s %-6s %-8s %s\n' MUTANT RC FAILS VERDICT "TOP-LEVEL FAILING TESTS"
for m in "${MUTANTS[@]}"; do
  python3 "$MUT" apply "$m" > "$LOGDIR/$m.apply" 2>&1
  arc=$?
  if [ $arc -ne 0 ]; then
    printf '%-42s %-6s %-6s %-8s %s\n' "$m" - - ABORT "$(cat "$LOGDIR/$m.apply")"
    continue
  fi

  go test ./internal/platform/github/ ./internal/server/ -count=1 > "$LOGDIR/$m.log" 2>&1
  rc=$?
  fails=$(grep -cE '^--- FAIL' "$LOGDIR/$m.log")

  if [ "$rc" -eq 0 ]; then
    verdict=SURVIVED
  elif [ "$fails" -eq 0 ]; then
    verdict=INCONCL     # rc!=0 but no real test failure -> build/setup error
  else
    verdict=KILLED
  fi
  names=$(grep -E '^--- FAIL' "$LOGDIR/$m.log" | sed 's/^--- FAIL: //; s/ (.*//' | paste -sd, -)
  printf '%-42s %-6s %-6s %-8s %s\n' "$m" "$rc" "$fails" "$verdict" "${names:0:160}"

  # restore + verify
  python3 "$MUT" restore "$m" > /dev/null 2>&1
  python3 "$MUT" verify "$m"  > /dev/null 2>&1 || { echo "!!! RESTORE VERIFY FAILED for $m"; exit 3; }
  p=$(git status --porcelain)
  [ -z "$p" ] || { echo "!!! TREE NOT CLEAN after restoring $m: $p"; exit 3; }
done

echo
echo "--- final tree check ---"
git status --porcelain; echo "PORCELAIN_END"
