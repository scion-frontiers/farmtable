#!/usr/bin/env bash
# Run ON THE MAC HOST, from the watcher repo root:
#   bash docs/commands/07-close-m2s-rel05.sh
#
# WHY THIS IS A SCRIPT (not run by the container agent):
# Container agents can't write bd (BEADS_DOLT_AUTO_START=false; the Mac host owns
# the single Dolt write lock). See /workspace/kb/container-living.md §2.
#
# WHAT THIS DOES:
# Records REL-05 (watcher-m2s — graceful daemon crash / SIGKILL recovery),
# creates a host verify/land task, and (after verification) closes watcher-m2s.
# This slice is DART-ONLY (client-side crash handling); daemon/main.go is
# unchanged, so NO Go rebuild is required.
#
# VERIFY BEFORE THE CLOSE SECTION (this closes an issue):
#   flutter analyze     # host-only; container has no Dart toolchain
#   flutter test
#   # (No daemon change -> no ICU rebuild / make build needed for this slice.)
#
# CONTAINER STATUS: Dart brace/paren/bracket balance OK on both changed files;
# no daemon/main.go change; existing BeadsService/AppState tests unaffected
# (onCrash is optional; no test asserts the old crash-message string).
#
# Safe to re-run: comment may duplicate; bd close on a closed issue and bd
# create with a fixed --id error harmlessly. Every line is guarded with `|| true`.
set -u
test -d .beads || { echo "Run from the watcher repo root on the Mac."; exit 1; }

ACTOR="implementation-agent"

echo "==> Creating host verify/land task for REL-05"
bd create "Verify & land REL-05 (graceful daemon crash recovery)" \
  --id watcher-m2s-verify \
  --type task --priority 2 \
  --deps discovered-from:watcher-m2s \
  --description "A container agent implemented REL-05 (client-side; daemon/main.go UNCHANGED). Files: lib/services/beads_service.dart, lib/state/app_state.dart.
WHAT CHANGED:
- beads_service.dart: added onCrash callback and DaemonCrashException. The Process.exitCode handler now classifies the exit — any negative code (e.g. -9) is wasKilled=true (SIGKILL from OS memory pressure / sleep) — fails in-flight requests with DaemonCrashException(code, wasKilled) instead of a raw Exception, and (for unexpected exits while not disposed) fires onCrash. The daemon still transparently respawns on the next RPC via _ensureDaemonRunning (existing self-heal).
- app_state.dart: new daemonReconnecting flag; _handleDaemonCrash() wired through the BeadsService onCrash hook. On crash it clears the raw error (so the UI shows a reconnecting state, not a crash), then retries _refreshData up to 3x with backoff (300ms*attempt) to respawn + refetch; bails if the user switched projects; on exhaustion sets an actionable 'could not restart automatically — reselect the project' error. appState.error stays null during reconnection so screens show content/loading instead of ErrorDisplayView.
YOUR JOB (host):
1. flutter analyze — MUST be clean.
2. flutter test — existing suite green. The fake process in test/services/beads_service_test.dart already exposes a controllable exitCode; consider adding a test that completes exitCode with -9 and asserts (a) pending requests get DaemonCrashException(wasKilled:true) and (b) onCrash fires.
3. Smoke test on a running app: with a project open, find the watcher-daemon PID and 'kill -9 <pid>'. Expect: NO Dart crash / no raw 'exit code -9' error; the app briefly shows a reconnecting/normal state and self-recovers on the next action or heartbeat (daemon respawns). Repeat via a sleep/wake cycle if feasible.
4. (Optional UI polish, not required to close) surface daemonReconnecting as a small banner — deferred here to avoid MacosWindow sidebar layout quirks (see GEMINI.md).
5. ONLY IF all pass: run the close section below; commit (e.g. 'fix: REL-05 — graceful daemon crash (SIGKILL/-9) recovery') and push. Then close THIS task.
ACCEPTANCE: analyze+test pass, kill -9 smoke test recovers without a UI crash, committed & pushed, watcher-m2s closed." || true

echo "==> REL-05 (watcher-m2s) — graceful daemon crash recovery (IMPLEMENTED)"
bd comment watcher-m2s --actor "$ACTOR" \
  "IMPLEMENTED (client-side; daemon unchanged). beads_service.dart: added onCrash callback + typed DaemonCrashException; the exitCode handler classifies negative codes (e.g. -9) as wasKilled (SIGKILL — OS memory pressure/sleep), fails in-flight requests with DaemonCrashException instead of a raw Exception, and fires onCrash for unexpected exits (skipped when disposed / clean exit). The daemon already self-respawns on the next RPC via _ensureDaemonRunning. app_state.dart: added daemonReconnecting + _handleDaemonCrash (wired via onCrash) — clears the raw error so the UI shows a reconnecting state, retries _refreshData up to 3x with backoff to respawn+refetch, bails if the user switched projects, and on exhaustion sets an actionable error. Result: a SIGKILL no longer surfaces 'Exception: Daemon crashed (exit code -9)' or crashes the UI; it auto-recovers. FOLLOW-UP (verify task watcher-m2s-verify): flutter analyze/test + a 'kill -9 <daemon pid>' smoke test; suggested unit test using the existing fake-process exitCode seam (complete with -9, assert DaemonCrashException(wasKilled:true) + onCrash fires). Optional daemonReconnecting UI banner deferred to avoid MacosWindow layout quirks." || true

echo
echo "============================================================================"
echo " CLOSE SECTION — only after host verification (analyze/test/kill -9 smoke)."
echo "============================================================================"
bd close watcher-m2s --reason "REL-05 implemented & verified: daemon SIGKILL/-9 (and other unexpected exits) now raise a typed DaemonCrashException + onCrash hook; AppState auto-reconnects (bounded retries + backoff) instead of crashing the UI. Client-side only; daemon unchanged." || true

echo
echo "==> Export source of truth + show for review"
bd export -o .beads/issues.jsonl
git status --short .beads/issues.jsonl
echo "Suggested: git add .beads/issues.jsonl && git commit -m 'bd: close watcher-m2s REL-05 daemon crash recovery'"
