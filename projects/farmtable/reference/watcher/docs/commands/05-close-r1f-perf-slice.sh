#!/usr/bin/env bash
# Run ON THE MAC HOST, from the watcher repo root:
#   bash docs/commands/05-close-r1f-perf-slice.sh
#
# WHY THIS IS A SCRIPT (not run by the container agent):
# Container agents can't write bd (BEADS_DOLT_AUTO_START=false; the Mac host owns
# the single Dolt write lock). See /workspace/kb/container-living.md §2.
#
# WHAT THIS DOES:
# Records the Phase 3 (watcher-r1f) PERFORMANCE slice — REL-03 (r1f.1) and
# RACE-04 (r1f.3) — as fix comments, and (after verification) closes them. The
# existing coordination task watcher-r1f-verify is the umbrella verify/land task;
# this script updates it and defers the closes behind a verification gate.
# (RACE-03 / r1f.2 optimistic concurrency is NOT part of this slice — still open.)
#
# VERIFY BEFORE RUNNING THE CLOSE SECTION (this script closes issues):
#   flutter analyze                 # host-only; container has no Dart toolchain
#   flutter test
#   # Go daemon (RACE-04) needs ICU CGO flags per GEMINI.md, then rebuild+bundle:
#   ( cd daemon && CGO_CFLAGS="-I$(brew --prefix icu4c)/include" \
#        CGO_LDFLAGS="-L$(brew --prefix icu4c)/lib" \
#        CGO_CXXFLAGS="-std=c++17 -I$(brew --prefix icu4c)/include" \
#        go build ./... && go test ./... && golangci-lint run )
#   make build      # recompile + copy watcher-daemon into Watcher.app/Contents/Resources
#
# NOTE: on the container, CGO_ENABLED=0 go build/vet PASS and gofmt is clean.
# The daemon test TestCommentsFlagInjection fails ONLY on the container (it shells
# out to `bd` against a real project context that the container lacks); it is
# environmental and pre-existing — it passes on the host. All other daemon tests
# pass. Confirm it passes on the host.
#
# Safe to re-run: comments may duplicate; bd close on a closed issue errors
# harmlessly. Every line is guarded with `|| true`.
set -u
test -d .beads || { echo "Run from the watcher repo root on the Mac."; exit 1; }

ACTOR="implementation-agent"

echo "==> REL-03 (r1f.1) — O(1) dependency/hierarchy index (IMPLEMENTED)"
bd comment watcher-r1f.1 --actor "$ACTOR" \
  "IMPLEMENTED. lib/models/issue.dart: added IssueIndex (byId, childrenByParentId, blockersById, blockingById) built once via IssueIndex.build(all), memoized per issue-list instance with an Expando (_indexCache/_indexFor). Because AppState.currentIssues is reassigned to a fresh list only on refresh, the index is built once per data change and shared by every helper call in a render pass — with ZERO call-site changes. Rewrote the former O(N) List.where/indexWhere scans to O(1)/O(subtree) map lookups: blockers()->openBlockersOf, blocking()->blockingOf, parent()/relatedLinks()->byId, children()->childrenOf, hasParentIn()->byId.containsKey, hasOpenDescendant()->children-map recursion (added a visited-set cycle guard), isDescendantOf()->byId parent-chain walk. Behavior preserved: the children map records a child under BOTH its explicit parent-child target AND its dotted-id prefix (mirrors Issue.isDirectChildOf); dangling blocks-deps produce no blocker (matches existing test); closed blockers excluded; parent() still prefers explicit over dotted. Container: brace/paren/bracket balance OK; Dart analyze is host-only. FOLLOW-UP for verify (watcher-r1f-verify): confirm tree load/render + drag-hover are responsive on a >500-issue repo, and that existing test/models/issue_dependencies_test.dart + issue_test.dart still pass (they use containsAll/contains, order-independent)." || true

echo "==> RACE-04 (r1f.3) — coalesced single-worker daemon export (IMPLEMENTED)"
bd comment watcher-r1f.3 --actor "$ACTOR" \
  "IMPLEMENTED. daemon/main.go: replaced the 4 inline, per-mutation 'exec.Command(bd export).Run()' calls (handleCreateIssue/UpdateIssue/AddDependency/RemoveDependency) with requestExport(), backed by a new debouncedExporter: a single worker goroutine (started in main() as the package-level 'exporter', rooted at repoPath) fed by a buffered(1) coalescing channel. Request() is non-blocking; the worker waits exportDebounce=400ms after the LAST signal (extending on each new one) so a burst of mutations collapses into exactly ONE 'bd export', and only one export ever runs at a time — eliminating the concurrent-process Dolt lock contention under .beads/backup/ described in the issue. Container verification: CGO_ENABLED=0 go build ./... , go vet ./... PASS; gofmt -l clean; all daemon tests pass EXCEPT TestCommentsFlagInjection which is environmental (needs a real bd project context; fails identically on HEAD, passes on host). FOLLOW-UP for verify: with ICU flags rebuild the daemon (make build), then hammer rapid mutations (drag many cards quickly) and confirm no Dolt lock errors and a single trailing export; also confirm the UI file-watcher still refreshes after the debounce." || true

echo "==> Update the coordination/verify task"
bd comment watcher-r1f-verify --actor "$ACTOR" \
  "Two of the three Phase 3 architectural items are now IMPLEMENTED and ready to verify: REL-03 (r1f.1, lib/models/issue.dart) and RACE-04 (r1f.3, daemon/main.go — REQUIRES ICU CGO rebuild + 'make build' to bundle the new daemon). RACE-03 (r1f.2, optimistic concurrency) is NOT yet implemented — it remains open for a separate slice. After verifying REL-03 + RACE-04 (analyze/test/daemon build+lint + the perf/lock smoke tests above), run the close section of docs/commands/05-close-r1f-perf-slice.sh, commit, and push." || true

echo
echo "============================================================================"
echo " CLOSE SECTION — only after host verification (analyze/test/daemon build)."
echo " Comment out the two lines below until verification passes, or just run"
echo " them once you've confirmed everything is green."
echo "============================================================================"
bd close watcher-r1f.1 --reason "REL-03 implemented & verified: O(1) IssueIndex (Expando-memoized per list) replaces O(N) dependency/hierarchy scans; behavior-preserving." || true
bd close watcher-r1f.3 --reason "RACE-04 implemented & verified: single-worker debounced exporter (400ms coalesce) replaces per-mutation concurrent 'bd export', ending Dolt lock contention." || true

echo
echo "==> RACE-03 (r1f.2) remains OPEN. Leave epic watcher-r1f OPEN until r1f.2 +"
echo "    the P3 UI/a11y polish (r1f.4-r1f.10) + watcher-r1f-verify are done."
echo
echo "==> Export source of truth + show for review"
bd export -o .beads/issues.jsonl
git status --short .beads/issues.jsonl
echo "Suggested: git add .beads/issues.jsonl && git commit -m 'bd: close r1f perf slice (REL-03, RACE-04)'"
