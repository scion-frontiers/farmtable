#!/usr/bin/env bash
# Mutation battery for issue #191 (terminal-predicate).
# Run from the repo root. Applies each mutation, runs the relevant package
# tests, reports KILLED/SURVIVED, and restores the file.
#
# Expected results:
#   M1-M7  KILLED   (verified at d5db8c4, pre-fix)
#   M8     SURVIVED at d5db8c4; must become KILLED once the exhaustiveness
#          assertion from review finding 2 lands. This is the whole point of
#          that finding: the classification table can silently lose coverage.

set -u
fails=0

run_mut () {
  local name="$1" file="$2" old="$3" new="$4" pkg="$5" expect="$6"
  if [ ! -f "$file" ]; then echo "### $name : SKIPPED (missing $file)"; return; fi
  cp "$file" /tmp/mut.bak
  if ! python3 - "$file" "$old" "$new" <<'EOF'
import sys
p, o, n = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p).read()
if s.count(o) != 1:
    sys.stderr.write("anchor matched %d times\n" % s.count(o)); sys.exit(1)
open(p, 'w').write(s.replace(o, n))
EOF
  then echo "### $name : SKIPPED (anchor drifted - code changed, re-derive)"; cp /tmp/mut.bak "$file"; return; fi

  local out result
  out=$(go test "$pkg" 2>&1)
  if echo "$out" | grep -q "^ok"; then result=SURVIVED; else result=KILLED; fi
  cp /tmp/mut.bak "$file"

  if [ "$result" = "$expect" ]; then
    echo "### $name : $result (as expected)"
  else
    echo "### $name : $result  <-- EXPECTED $expect"
    echo "$out" | grep -E '^--- FAIL|^    --- FAIL' | head -4
    fails=$((fails+1))
  fi
}

echo "=== #191 mutation battery ==="

run_mut "M1 drop PhaseClosed arm (multistore fallback)" \
  internal/store/multistore.go \
  "IsTerminalStage(t.Stage) || t.Phase == task.PhaseClosed" \
  "IsTerminalStage(t.Stage)" ./internal/store/ KILLED

run_mut "M2 drop open+accepted conjunction (multistore fallback)" \
  internal/store/multistore.go \
  "len(reasons) == 0 && t.Phase == task.PhaseOpen && t.Stage == task.StageAccepted" \
  "len(reasons) == 0" ./internal/store/ KILLED

run_mut "M3 IsTerminalStage drops Cancelled" \
  internal/store/entstore.go \
  "case task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
		return true" \
  "case task.StageCompleted, task.StageWontFix, task.StageDuplicate:
		return true" ./internal/store/ KILLED

run_mut "M4 IsTerminalStage always false" \
  internal/store/entstore.go \
  "func IsTerminalStage(stage task.Stage) bool {
	switch stage {" \
  "func IsTerminalStage(stage task.Stage) bool {
	if true { return false }
	switch stage {" ./internal/store/ KILLED

run_mut "M5 passthrough terminal arm never fires" \
  internal/platform/github/passthrough.go \
  "if store.IsTerminalStage(t.Stage) {" \
  "if false && store.IsTerminalStage(t.Stage) {" ./internal/platform/github/ KILLED

run_mut "M6 server basicAvailability terminal arm never fires" \
  internal/server/convert.go \
  "if store.IsTerminalStage(t.Stage) {" \
  "if false && store.IsTerminalStage(t.Stage) {" ./internal/server/ KILLED

run_mut "M7 IsTerminalStage always true" \
  internal/store/entstore.go \
  "func IsTerminalStage(stage task.Stage) bool {
	switch stage {" \
  "func IsTerminalStage(stage task.Stage) bool {
	if true { return true }
	switch stage {" ./internal/store/ KILLED

# M8 mutates the TEST, not production: it drops a row from the classification
# table, simulating a stage that was never added. Pre-fix nothing notices.
run_mut "M8 classification table silently loses a stage" \
  internal/store/terminal_availability_test.go \
  "		{task.StageCancelled, true}," \
  "" ./internal/store/ SURVIVED

echo "=== done; $fails unexpected result(s) ==="
exit $fails
