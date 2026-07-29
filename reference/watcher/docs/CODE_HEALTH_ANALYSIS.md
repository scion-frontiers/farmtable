# Watcher — Code Health Analysis & Improvement Plan

_Generated: 2026-06-26. Snapshot review of the Flutter UI (`lib/`), Go daemon (`daemon/`),
build tooling, and CI. No code changes were made as part of this review._

## 1. Executive Summary

Watcher is a well-structured, single-purpose macOS desktop app (~7k LOC Dart + ~620 LOC Go).
The architecture is sound and well-documented (`GEMINI.md`, `docs/ARCHITECTURE.md`), the
hard-won macOS/PATH/sandbox quirks are captured, and `flutter analyze lib test` is essentially
clean (1 warning in generated code). The core risks are **not** correctness bugs but
**maintainability and testability gaps**:

- A global mutable singleton (`appState`) imported directly by services and widgets.
- A 883-line `AppState` god-object mixing persistence, file watching, networking, process
  orchestration, and AI calls.
- Near-zero automated test coverage (1 Dart test file, 1 Go test file) for a process-heavy app.
- Dead RPC handlers and an inconsistent data-mutation path (some via daemon RPC, some via
  direct CLI shell-out).
- Repo hygiene issues (committed debug artifact, duplicated PATH string literal ~15×, no CI
  for analyze/test/lint).

Overall grade: **B-** — ships and works, but accruing maintenance debt that will slow future
features (e.g., the planned Voice Mode epic).

---

## 2. What's Good

- **Clear architecture & docs.** `docs/ARCHITECTURE.md` records *why* decisions were made
  (file-watch vs. SQL polling, sandbox-off, symlink install). This is excellent.
- **Defensive daemon lifecycle.** `BeadsService` handles daemon crash, broken pipe,
  pending-request rejection, and 15s timeouts cleanly (`beads_service.dart:100-150`).
- **JSON-RPC framing** via `LineSplitter` is simple and robust.
- **Models** use `json_serializable` codegen — type-safe and low-boilerplate.
- **Linting** is enabled (`flutter_lints`) and the first-party code passes cleanly.
- **CI exists** for release automation (release-please + macOS build + daemon bundling).

---

## 3. Findings by Severity

### High

**H1 — Global singleton `appState` couples everything.**
`final appState = AppState();` in `main.dart:11` is imported directly by `beads_service.dart`,
`tmux_service.dart`, and `planner_service.dart` (14 files import `main.dart`). This:
- Makes services impossible to unit-test in isolation (they reach into global UI state for
  `customBdPath`).
- Hides dependencies (a service's needs aren't visible in its constructor).
- Risks ordering bugs (the singleton is constructed at import time, before `main()` runs).
Recommend dependency injection (constructor params or a `Provider`/`InheritedWidget`/`get_it`).

**H2 — `AppState` is an 883-line god-object.**
`lib/state/app_state.dart` owns: settings persistence (SharedPreferences), project CRUD,
two sets of file watchers, debounce + sync + heartbeat timers, daemon RPC orchestration,
HTTP calls to GitHub, AI summarization triggers, and Dolt server launching. This violates
single-responsibility and is the highest-churn / highest-risk file. Split into e.g.
`SettingsRepository`, `ProjectRepository`, `WatcherCoordinator`, and a thin `AppState`
view-model.

**H3 — Almost no test coverage for the riskiest code.**
Only `test/state/app_state_test.dart` (75 lines) and `daemon/main_test.go` (2 tests). None of
the process orchestration, JSON-RPC client framing, error/timeout paths, or
`IssueHierarchy` tree logic (`issue.dart:121-181`, the most algorithmically complex code) is
tested. This is the single biggest blocker to confidently refactoring H1/H2.

### Medium

**M1 — Inconsistent mutation path / dead daemon code.**
The Go daemon implements `create_issue` and `close_issue` RPC handlers
(`daemon/main.go:146,175`), but the Dart client never calls them — `createIssue` shells out to
`bd create` + `bd export` directly (`beads_service.dart:212-236`) and closing goes through
`update_issue`. So: (a) two handlers are dead code, and (b) creation bypasses the "prefer the
hot daemon over CLI shell-outs" rule from `GEMINI.md`. Pick one path and delete the other.

**M2 — Duplicated PATH literal (~15 occurrences).**
`'/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'` is hard-coded across Dart
(`app_state.dart`, `beads_service.dart`, `tmux_service.dart`, `planner_service.dart`) and Go
(`daemon/main.go` ~6×). Extract a single constant in each language. Today, changing the dev
PATH policy requires a 15-site edit.

**M3 — `flutter analyze` (unscoped) fails with 9000+ errors.**
The analyzer descends into `build/macos/SourcePackages/checkouts/flutterfire/...`. `build/` is
gitignored so CI on a clean checkout is unaffected, but local `flutter analyze` is unusable.
Add an `analyzer: exclude:` block to `analysis_options.yaml` (e.g. `build/**`) so the default
command is meaningful.

**M4 — No CI quality gate for first-party code.**
`.github/workflows/release.yml` only builds on release. There is no workflow running
`flutter analyze lib test`, `flutter test`, `go test ./...`, or `golangci-lint` on PRs/pushes.
Regressions (incl. the generated-code warning, future analyzer issues) can land silently.
`GEMINI.md` even states the daemon "must pass golangci-lint" — but nothing enforces it.

**M5 — Unbounded busy-wait polling for AI completion.**
`PlannerService.pollForCompletion` (`planner_service.dart:60-67`) loops forever on a 1s delay
waiting for `.beads/ai_done` with no timeout and no cancellation. If the user closes the
terminal or `gemini` dies, the future never completes. Add a max-timeout and a cancel path.

**M6 — Shell-injection / escaping risk in AppleScript + tmux paths.**
`TmuxService.attachInTerminal` interpolates `sessionName` straight into AppleScript strings
(`tmux_service.dart:134-162`), and `PlannerService.executeScript` runs AI-generated bash
verbatim (`planner_service.dart:86-121`). Session names are derived/sanitized, but the
AI-script execution is by-design arbitrary code execution. At minimum: surface a confirmation
diff to the user before running, and quote/escape interpolated values.

### Low

**L1 — Committed debug artifact.** `debug.json` (34 KB) is tracked at repo root and looks like
a one-off dump. Remove and gitignore.

**L2 — Generated-code analyzer warning.** `lib/models/interaction.g.dart:12` "Unnecessary
cast". Regenerate with current `json_serializable`/`build_runner` to clear it.

**L3 — Magic strings for status/type/priority.** `'closed'`, `'epic'`, `'parent-child'`,
priorities `0-4` appear as bare literals across daemon and UI. Introduce enums/consts to avoid
typo drift between the Go and Dart sides.

**L4 — Duplicated AI-orchestration boilerplate.** The three `PlannerService` methods repeat the
write-prompt / clean-lockfiles / ensure-session / send-keys / attach sequence verbatim. Extract
a single `_runGeminiPrompt(prompt, ...)` helper.

**L5 — `Future.delayed` as a sync primitive.** `createIssue` waits a fixed 500ms hoping the
export finished (`app_state.dart:769`); `_ensureDaemonRunning` recurses on a 100ms delay
(`beads_service.dart:27-31`). These work but are race-prone; prefer awaiting the actual
operation / a proper init `Completer`.

**L6 — Dead/placeholder code.** `getGraph()` returns dummy `GraphNode` wrappers that the UI
doesn't use (`beads_service.dart:187-193`); the optimistic-update branch in `updateIssue` is an
empty comment block (`app_state.dart:706-712`). Remove to reduce noise.

**L7 — `print`-style logging via `debugPrint`.** Errors are swallowed to `debugPrint` in many
catch blocks; there's an open bd issue (`watcher-p5j`) to design a logging strategy. A real
logger with levels would help diagnose the process-heavy failure modes.

---

## 4. Prioritized Action Plan

### Phase 0 — Hygiene (hours, low risk)
1. Add `analyzer: exclude: [build/**]` to `analysis_options.yaml` (M3).
2. Remove `debug.json`; add to `.gitignore` (L1).
3. Regenerate codegen to clear the `.g.dart` warning (L2).
4. Extract the PATH constant in Dart and Go (M2).

### Phase 1 — CI Quality Gate (half-day, high leverage)
5. Add a CI workflow on push/PR: `flutter pub get`, `flutter analyze lib test`,
   `flutter test`, and (with icu4c) `go test ./daemon/...` + `golangci-lint run` (M4).
   This locks in every subsequent improvement.

### Phase 2 — Test the Core (1-2 days)
6. Unit-test `IssueHierarchy` extension (`issue.dart`) — pure logic, no I/O, high value (H3).
7. Unit-test `BeadsService` JSON-RPC framing/timeouts/crash handling by injecting a fake
   process stream (requires H1 seam) (H3).
8. Expand `daemon/main_test.go` to cover `check_health` diagnostics and error responses (H3).

### Phase 3 — Decouple & Split (2-4 days, do after tests exist)
9. Remove the global `appState` import from services; pass dependencies via constructors (H1).
10. Decide the single mutation path (daemon RPC vs CLI) and delete the dead handlers (M1).
11. Carve `AppState` into focused units (settings / projects / watch-coordinator) (H2).

### Phase 4 — Robustness Polish
12. Add timeout + cancellation to `pollForCompletion` (M5).
13. Add a user confirmation/preview before executing AI-generated bash; escape AppleScript
    interpolation (M6).
14. Deduplicate `PlannerService` orchestration; introduce status/type enums (L3, L4).

---

## 5. Suggested bd Issues

These map cleanly to trackable work (priorities are suggestions):

| Priority | Title |
|---|---|
| P1 | CI: add analyze/test/lint workflow for lib, test, and daemon |
| P1 | Decouple services from global `appState` singleton (enable unit tests) |
| P2 | Split `AppState` god-object into focused repositories/coordinators |
| P2 | Add unit tests for `IssueHierarchy` and `BeadsService` RPC framing |
| P2 | Unify issue-mutation path; remove dead `create_issue`/`close_issue` daemon handlers |
| P2 | Extract shared dev-PATH constant (Dart + Go) |
| P3 | Add timeout/cancellation to PlannerService.pollForCompletion |
| P3 | Confirm/preview before executing AI-generated bash; escape AppleScript args |
| P3 | Exclude build/** from analyzer; remove committed debug.json |
| P3 | Introduce status/type/priority enums shared in intent across Go and Dart |
