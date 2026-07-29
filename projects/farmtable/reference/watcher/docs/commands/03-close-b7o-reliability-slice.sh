#!/usr/bin/env bash
# Run ON THE MAC HOST, from the watcher repo root:
#   bash docs/commands/03-close-b7o-reliability-slice.sh
#
# WHY THIS IS A SCRIPT (not run by the container agent):
# Container agents can't write bd (BEADS_DOLT_AUTO_START=false; the Mac host owns
# the single Dolt write lock). See /workspace/kb/container-living.md §2.
#
# WHAT THIS DOES:
# Records the implementation of the Phase 2 (watcher-b7o) RELIABILITY slice —
# b7o.2 (REL-02) and b7o.1 (REL-01) — creates a host verify/land task, and (when
# you run it after verification) closes the two issues. The CODE is already on
# disk under /workspace via the bind mount.
#
# VERIFY BEFORE RUNNING (this script closes issues):
#   flutter analyze          # container has NO Dart toolchain — this is host-only
#   flutter test
# (No Go changed in this slice, so no daemon rebuild is required.)
#
# Safe to re-run: comments may duplicate; bd close on an already-closed issue and
# bd create with a fixed --id both error harmlessly. Every line is guarded.
set -u
test -d .beads || { echo "Run from the watcher repo root on the Mac."; exit 1; }

ACTOR="implementation-agent"

echo "==> Creating host verify/land task for the b7o reliability slice"
bd create "Verify & land b7o reliability slice (REL-01, REL-02)" \
  --id watcher-b7o-verify-rel \
  --type task --priority 1 \
  --deps discovered-from:watcher-b7o \
  --description "A container agent implemented b7o.1 (REL-01) and b7o.2 (REL-02) in code. Files: lib/services/beads_service.dart, lib/state/app_state.dart, lib/screens/home_screen.dart, lib/widgets/{issue_inspector,kanban_column,tree_node}.dart, and NEW lib/utils/dialog_utils.dart. Container sanity: brace/paren balance OK; macos_ui 2.2.2 MacosAlertDialog/showMacosAlertDialog signature confirmed via pub.dev docs. Dart was NOT analyzable on the container (Flutter is host-only).
YOUR JOB (host), in order:
1. Review the diff (see docs/commands/03-*.sh comments for what each change does).
2. flutter analyze — MUST be clean. Watch especially: the new lib/utils/dialog_utils.dart (MacosAlertDialog requires appIcon,title,message,primaryButton — all provided), and the updateIssue/removeProject return-type change void->bool (all call sites updated; existing app_state_test still awaits and ignores the bool).
3. flutter test — existing suite must stay green.
4. Smoke test: (REL-01) with the daemon killed/failing, change an issue status/priority/owner in the Inspector, drag a card between Kanban columns, drag-reparent in the Tree, and remove a project — each failure should now pop a native alert instead of silently no-op'ing; (REL-02) simulate a hung daemon (e.g. SIGSTOP the watcher-daemon PID) and issue 2 requests — after the 2nd consecutive 15s timeout the daemon should be force-killed and the next action should respawn it and succeed.
5. ONLY IF all pass: run 'bash docs/commands/03-close-b7o-reliability-slice.sh' to post comments + close b7o.1/b7o.2 (idempotent). Commit (e.g. 'fix: b7o reliability slice — surface mutation failures (REL-01) and restart hung daemon (REL-02)') and push. Then close THIS task.
ACCEPTANCE: analyze+test pass, smoke tests pass, committed & pushed, b7o.1/b7o.2 closed. If any step fails, DO NOT run the close section — comment the failure here and hand back." || true

echo "==> b7o.2 REL-02 — daemon deadlock / timeout restart (FIXED)"
bd comment watcher-b7o.2 --actor "$ACTOR" \
  "FIXED. lib/services/beads_service.dart now tracks consecutive RPC timeouts and force-restarts a hung daemon. Added: int _consecutiveTimeouts + static const _maxConsecutiveTimeouts=2. On any matched response (success OR error) the counter resets to 0 (proves the daemon is alive). In _sendRpcRequest's onTimeout, the counter increments; at >= _maxConsecutiveTimeouts it calls new _restartDaemon(), which eagerly nulls _daemonProcess and kills the process — that triggers the existing exitCode.then handler (which nulls the process, fails any pending requests, clears _pendingRequests), so the NEXT request respawns a fresh daemon via _ensureDaemonRunning. Previously a deadlocked-but-alive daemon was reused forever and every request timed out indefinitely. FOLLOW-UP for reviewer: a unit test injecting a non-responding process (via the existing _processStart seam used by the RACE-01 test) and asserting kill() fires after the 2nd timeout." || true
bd close watcher-b7o.2 --reason "REL-02 fixed: consecutive-timeout tracking (_consecutiveTimeouts, threshold 2) force-restarts a hung daemon via _restartDaemon(); counter resets on any matched response so the next request respawns cleanly." || true

echo "==> b7o.1 REL-01 — fire-and-forget mutation failures now surfaced (FIXED)"
bd comment watcher-b7o.1 --actor "$ACTOR" \
  "FIXED per the validation scope. (a) AppState.removeProject now has try/catch around _saveProjects, ROLLS BACK the in-memory removal on failure (re-inserts at original index, restores prior error), records projectErrors, and returns Future<bool> (was the genuinely-unhandled path). (b) AppState.updateIssue now returns Future<bool> (true/false) while keeping its existing projectErrors+notifyListeners behavior. (c) New shared helper lib/utils/dialog_utils.dart DialogUtils.showError() using macos_ui showMacosAlertDialog/MacosAlertDialog. (d) Widget call sites now await + alert on failure: home_screen.dart removeProject (also fixed a latent bug where the projects.isEmpty->go('/settings') check ran before the async removal completed); issue_inspector.dart owner/assignee/status/priority via a new _mutate() helper; kanban_column.dart drag-to-status; tree_node.dart drag-reparent. All guarded with context.mounted / State.mounted after the await. FOLLOW-UP: widget tests asserting an alert shows when updateIssue/removeProject return false (inject a failing AppState/service)." || true
bd close watcher-b7o.1 --reason "REL-01 fixed: removeProject hardened with try/catch+rollback; updateIssue/removeProject return bool; new DialogUtils.showError; all 6 fire-and-forget call sites now await and show a native alert on failure." || true

echo
echo "==> Phase 2 remaining (still open): b7o.3 (A11Y-01), b7o.4 (A11Y-02), b7o.5 (SEC-04)."
echo "    Leave epic watcher-b7o OPEN until those + watcher-b7o-verify-rel are done."
echo
echo "==> Export source of truth + show for review"
bd export -o .beads/issues.jsonl
git status --short .beads/issues.jsonl
echo "Suggested: git add .beads/issues.jsonl && git commit -m 'bd: close b7o reliability slice (REL-01, REL-02)'"
