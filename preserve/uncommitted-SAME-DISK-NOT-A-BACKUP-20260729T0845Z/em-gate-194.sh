#!/usr/bin/env bash
# EM gate verification for #194 @ ea8ac39 — discharges brief-template rule R1.
#
# v2. v1 WAS VOID: it wrapped `make web` and `make race` in /usr/bin/time, which
# does not exist in this container. Both returned 127 without ever running the
# thing under test, and the script sailed on and printed downstream numbers that
# looked exactly like measurements. Same failure as audit-195-r6's guardmut.sh.
# The fix is not "be careful with wrappers" — it is the PREREQ ASSERTIONS below,
# which abort the run instead of letting it produce a plausible table.
set -u
R=/workspace/farmtable-em-gate194
L=$R/_gate
mkdir -p "$L"

say() { printf '\n===== %s =====\n' "$1"; }
die() { printf '\n!!!!! ABORT: %s\n' "$1"; exit 90; }

# --- harness self-check: every external tool this script depends on ---
say "HARNESS SELF-CHECK"
for t in go make git npm node; do
  p=$(command -v "$t") || die "required tool not found: $t"
  printf '%-6s %s\n' "$t" "$p"
done
grep -qE '^web:' "$R/Makefile" || die "no 'web:' target in Makefile — v1 assumed one"
echo "make web target:"; grep -nE '^web:' -A3 "$R/Makefile"

cd "$R" || die "cannot cd $R"
say "IDENTITY"
git rev-parse HEAD
printf 'porcelain_empty=%s\n' "$([ -z "$(git status --porcelain | grep -v '^?? _gate')" ] && echo yes || echo NO)"

say "PRE-BUILD (no make web) — the R1 claim under test"
go build ./... >"$L/build_pre.log" 2>&1; E=$?
echo "GO_BUILD_PRE_EXIT=$E"
tail -3 "$L/build_pre.log"
printf 'web_dist_exists=%s\n' "$([ -d web/dist ] && echo yes || echo no)"
[ $E -eq 0 ] && die "pre-build SUCCEEDED — leg A's finding and my correction are both wrong, stop and rethink"

say "MAKE WEB"
T0=$(date +%s)
make web >"$L/makeweb.log" 2>&1; E=$?
echo "MAKE_WEB_EXIT=$E"
echo "make_web_seconds=$(( $(date +%s) - T0 ))"
tail -8 "$L/makeweb.log"
[ $E -ne 0 ] && die "make web failed — every downstream number would be void (this is exactly how v1 lied)"
N=$(find web/dist -type f 2>/dev/null | wc -l)
echo "web_dist_files=$N"
[ "$N" -lt 1 ] && die "make web exited 0 but produced no files — exit code disagreed with the artifact"

say "GO BUILD (post make web)"
go build ./... >"$L/build.log" 2>&1; E=$?
echo "GO_BUILD_EXIT=$E"
tail -3 "$L/build.log"
[ $E -ne 0 ] && die "build still failing after make web — downstream vet/test numbers would be void"

say "GO VET — characterise findings BY TYPE, not by count"
go vet ./... >"$L/vet.log" 2>&1
echo "GO_VET_EXIT=$?"
echo "--- findings verbatim:"
grep -E '\.go:[0-9]+' "$L/vet.log" | sort
echo "--- count: $(grep -cE '\.go:[0-9]+' "$L/vet.log")"
echo "--- TYPES (what 'the same four' must actually mean):"
grep -oE 'passes [^ ]+ (lock|mutex) by value|copies lock value[^,]*|call of [^ ]+ copies lock value' "$L/vet.log" | sort | uniq -c
echo "--- packages implicated:"
grep -oE '^[^ ]*/[^ :]*\.go' "$L/vet.log" | xargs -r -n1 dirname 2>/dev/null | sort | uniq -c

say "GO TEST ./... (non-verbose)"
go test ./... >"$L/test.log" 2>&1
echo "GO_TEST_EXIT=$?"
echo "PANIC_COUNT=$(grep -c 'panic:' "$L/test.log")"
echo "SETUP_FAILED=$(grep -c 'setup failed' "$L/test.log")"
grep -E '^(FAIL|--- FAIL)' "$L/test.log" | head -20

say "GO TEST -v — counts, with panic/setup truncation checks"
go test ./... -v >"$L/testv.log" 2>&1
echo "GO_TEST_V_EXIT=$?"
echo "TOP_LEVEL_TESTS=$(grep -cE '^=== RUN   Test[^/]*$' "$L/testv.log")"
echo "TOTAL_RESULT_LINES=$(grep -cE '^\s*--- (PASS|FAIL|SKIP)' "$L/testv.log")"
echo "PANIC_COUNT_V=$(grep -c 'panic:' "$L/testv.log")"
echo "SETUP_FAILED_V=$(grep -c 'setup failed' "$L/testv.log")"
echo "--- failures:"; grep -E '^\s*--- FAIL' "$L/testv.log" | head -20

say "MAKE RACE — scope printed from the Makefile, not asserted"
grep -nE '^race:' -A3 Makefile
T0=$(date +%s)
make race >"$L/race.log" 2>&1
echo "MAKE_RACE_EXIT=$?"
echo "make_race_seconds=$(( $(date +%s) - T0 ))"
echo "RACE_DETECTED=$(grep -c 'DATA RACE' "$L/race.log")"
tail -4 "$L/race.log"

say "GO TEST -race ./internal/server/ x3 — NEVER race-tested in this repo; heartbeat flake is intermittent"
for i in 1 2 3; do
  go test -race -count=1 ./internal/server/ >"$L/race_server_$i.log" 2>&1
  echo "RUN$i exit=$? dataraces=$(grep -c 'DATA RACE' "$L/race_server_$i.log") failures=$(grep -cE '^\s*--- FAIL' "$L/race_server_$i.log")"
  grep -E '^\s*--- FAIL|DATA RACE' "$L/race_server_$i.log" | head -5
done

say "FINAL CLEANLINESS"
printf 'porcelain_empty_ignoring_gate=%s\n' "$([ -z "$(git status --porcelain | grep -v -e '^?? _gate' -e '^?? web/dist')" ] && echo yes || echo NO)"
git status --porcelain | grep -v '^?? _gate' | head
say "DONE — all prereq assertions passed, so the numbers above are load-bearing"
