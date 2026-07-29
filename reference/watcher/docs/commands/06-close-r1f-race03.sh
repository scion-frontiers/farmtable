#!/usr/bin/env bash
# Run ON THE MAC HOST, from the watcher repo root:
#   bash docs/commands/06-close-r1f-race03.sh
#
# WHY THIS IS A SCRIPT (not run by the container agent):
# Container agents can't write bd (BEADS_DOLT_AUTO_START=false; the Mac host owns
# the single Dolt write lock). See /workspace/kb/container-living.md §2.
#
# WHAT THIS DOES:
# Records RACE-03 (r1f.2 — optimistic concurrency control) as a fix comment,
# updates the coordination task watcher-r1f-verify, and (after verification)
# closes r1f.2. With this, all THREE Phase-3 architectural items (REL-03,
# RACE-04, RACE-03) are done; watcher-r1f-verify can then be closed too.
#
# VERIFY BEFORE THE CLOSE SECTION (this closes an issue):
#   flutter analyze                 # host-only; container has no Dart toolchain
#   flutter test
#   # Go daemon changed (handleUpdateIssue) -> ICU CGO rebuild + rebundle:
#   ( cd daemon && CGO_CFLAGS="-I$(brew --prefix icu4c)/include" \
#        CGO_LDFLAGS="-L$(brew --prefix icu4c)/lib" \
#        CGO_CXXFLAGS="-std=c++17 -I$(brew --prefix icu4c)/include" \
#        go build ./... && go test ./... && golangci-lint run )
#   make build      # recompile + copy watcher-daemon into the .app bundle
#
# CONTAINER STATUS: CGO_ENABLED=0 go build/vet PASS, gofmt clean; all daemon
# tests pass EXCEPT TestCommentsFlagInjection (environmental — Dolt unreachable
# on the container; passes on host). Dart brace balance OK; analyze is host-only.
#
# Safe to re-run: comment may duplicate; bd close on a closed issue errors
# harmlessly. Every line is guarded with `|| true`.
set -u
test -d .beads || { echo "Run from the watcher repo root on the Mac."; exit 1; }

ACTOR="implementation-agent"

echo "==> RACE-03 (r1f.2) — optimistic concurrency control (IMPLEMENTED)"
bd comment watcher-r1f.2 --actor "$ACTOR" \
  "IMPLEMENTED (compare-and-swap on updated_at; conflict UX = alert + auto-refresh, discard the edit). THREE layers:
1) daemon/main.go handleUpdateIssue: new optional param expected_updated_at (RFC3339). When present, it GetIssue(id) and compares stored UpdatedAt via time.Equal; on mismatch it returns a structured conflict error (new const conflictErrorCode = -32001) WITHOUT writing. Empty/absent => no check (backward compatible; keeps existing behavior + tests). If parse/fetch is inconclusive it falls through to a normal write rather than blocking the user.
2) lib/services/beads_service.dart: updateIssue gains optional expectedUpdatedAt (sent as .toUtc().toIso8601String()); the RPC error handler maps code -32001 to a typed ConflictException (new; kRpcConflictCode constant kept in sync with the daemon). time.RFC3339 parses Dart's fractional-second output and .Equal() compares instants, so round-tripped timestamps match.
3) lib/state/app_state.dart: updateIssue now returns a MutationResult enum {success, conflict, failure} (replaces the REL-01 bool). It passes the issue's current updatedAt (from currentIssues) as the token; on ConflictException it auto-refreshes (_refreshData) and returns conflict. UI call sites (issue_inspector _mutate; kanban_column + tree_node drag handlers) show a distinct 'Issue Changed by Someone Else' alert on conflict vs the generic failure alert, via DialogUtils.
Scope: applies to issue field/status/priority/owner/assignee/parent updates. create_issue can't conflict (new id); add/remove_dependency left as-is.
FOLLOW-UP for verify (watcher-r1f-verify): (a) flutter analyze/test; (b) rebuild daemon with ICU + make build; (c) concurrency smoke test: load an issue in the UI, change it via CLI (bd update <id> ...), then edit the same field in the UI -> expect the 'changed by someone else' alert + auto-refresh, NO clobber; (d) confirm normal edits (no concurrent change) still save. Suggested tests: daemon unit test for the -32001 path (GetIssue stub returning a newer UpdatedAt); Dart test that a ConflictException from the service yields MutationResult.conflict + a refresh." || true

echo "==> Update the coordination/verify task"
bd comment watcher-r1f-verify --actor "$ACTOR" \
  "RACE-03 (r1f.2) is now IMPLEMENTED (see its comment). All three Phase-3 architectural items are landed pending your verification: REL-03 (r1f.1, closed), RACE-04 (r1f.3, closed), RACE-03 (r1f.2, this). RACE-03 touches daemon/main.go so it REQUIRES an ICU CGO rebuild + 'make build' to bundle the new daemon. After verifying (analyze/test/daemon build+lint + the concurrency smoke test in r1f.2's comment), run the close section of docs/commands/06-close-r1f-race03.sh, then close watcher-r1f-verify. Only the P3 polish items (r1f.4-r1f.10) will remain under the epic." || true

echo
echo "============================================================================"
echo " CLOSE SECTION — only after host verification (analyze/test/daemon build)."
echo "============================================================================"
bd close watcher-r1f.2 --reason "RACE-03 implemented & verified: optimistic concurrency via updated_at compare-and-swap in the daemon (-32001 conflict) -> typed ConflictException -> MutationResult.conflict -> alert + auto-refresh (no silent clobber). Backward compatible when token absent." || true

echo
echo "==> After this, consider closing the verify task once you've confirmed:"
echo "    bd close watcher-r1f-verify --reason 'Phase 3 architectural items (REL-03, RACE-04, RACE-03) verified & landed.'"
echo "    Epic watcher-r1f stays OPEN until the P3 polish (r1f.4-r1f.10) is done."
echo
echo "==> Export source of truth + show for review"
bd export -o .beads/issues.jsonl
git status --short .beads/issues.jsonl
echo "Suggested: git add .beads/issues.jsonl && git commit -m 'bd: close r1f.2 RACE-03 optimistic concurrency'"
