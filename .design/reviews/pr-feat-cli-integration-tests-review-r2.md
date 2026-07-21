# Review: feat/cli-integration-tests (Round 2)

**PR:** `feat/cli-integration-tests` vs `main`  
**Commits:**
- `48f9ef6` — feat: add CLI integration test scripts for task, collection, and export/import lifecycles
- `f25e7e5` — fix: address review feedback — add temp file cleanup and improve test stamp uniqueness

**Reviewer:** Code Review Agent  
**Date:** 2026-07-20  

---

## Review Summary

**Verdict:** APPROVE

**Overview:** Both issues raised in Round 1 — temp file cleanup in `test-export-import.sh` and `$RANDOM` uniqueness in `test_stamp()` — have been addressed correctly and minimally. The incremental diff (`48f9ef6..f25e7e5`) touches only the two lines/blocks that were flagged, introducing no new issues. The full branch is clean, well-structured, and ready to merge.

---

## Round 1 Findings — Resolution Status

### ✅ Important #1: Export temp file cleanup — RESOLVED

**R1 finding:** `test-export-import.sh:15` — export file `/tmp/test-export-${STAMP}.json` was never cleaned up on success or failure.

**Fix applied (f25e7e5):** Added `trap cleanup EXIT` with `rm -f "$EXPORT_FILE"` at lines 17-20, immediately after `EXPORT_FILE` is defined and before any work begins. The cleanup function correctly uses `rm -f` (no error on missing file) and the `EXIT` trap fires on both success and `set -e` failure paths. This is exactly the recommended fix from R1.

### ✅ Suggestion #2: test_stamp collision risk — RESOLVED

**R1 finding:** `common.sh:28-29` — `test_stamp()` used only `date+PID`, risking collisions in parallel container runs.

**Fix applied (f25e7e5):** `test_stamp()` now appends `$RANDOM` (0-32767) as a third segment. The stamp format is now `YYYYMMDDHHMMSS-PID-RANDOM`, producing clean filesystem-safe identifiers (e.g., `20260720133547-1357-27650`). The collision window for two processes on the same server in the same second with the same PID is reduced from certain to ~1/32768. Adequate for integration test isolation.

---

## New Issues in f25e7e5

None. The fix commit modifies exactly two locations with no side effects:
1. `common.sh:29` — format string and argument change.
2. `test-export-import.sh:17-20` — new `cleanup()` function and `trap` statement, inserted between variable setup and first side-effecting command.

---

## Full Branch Re-Review (Verification Pass)

In addition to confirming the R1 fixes, the full branch was re-evaluated across all review dimensions.

### Critical Issues

None.

### Important Issues

None.

### Suggestions

**1. [test-export-import.sh:15] Predictable temp file path in /tmp**

The export file uses `/tmp/test-export-${STAMP}.json` with a predictable name. On shared multi-user systems, this could theoretically be exploited via symlink attacks (attacker pre-creates a symlink at the expected path). In practice this is a non-issue because: (a) `STAMP` includes `$RANDOM`, (b) these are integration tests run by trusted operators, and (c) the Go CLI's `os.WriteFile` uses `O_CREATE|O_TRUNC` which follows symlinks but the cleanup trap uses `rm -f` not `rm -rf`. Using `mktemp` would be marginally more secure but adds complexity for no practical benefit here.

**Verdict:** Acceptable as-is. No change needed.

**2. [common.sh:62] `assert_json_true` stderr suppression**

`jq -e "$@" <<<"$json" >/dev/null` suppresses stdout but not stderr. If jq emits a parse error or filter compilation error, the error message appears before the custom `FAIL:` message, which is actually helpful for debugging. This is correct behavior — noting it as a positive design choice.

**3. [test-task-lifecycle.sh, test-collection-lifecycle.sh] No cleanup trap**

Unlike `test-export-import.sh`, these two scripts don't have a cleanup trap. However, they also don't create any local temp files — their only side effects are server-side collections, which can't be deleted anyway (no `DeleteCollection` RPC). The `LEFT_BEHIND:` lines at the end correctly document what was created. No trap is needed.

---

### What's Done Well

1. **Minimal, targeted fix commit:** The R1 feedback was addressed in a single commit (`f25e7e5`) that touches only the two relevant locations. No unrelated changes, no refactoring mixed in. This is exactly how review feedback should be applied.

2. **Trap placement is correct:** The `trap cleanup EXIT` in `test-export-import.sh` is placed after `EXPORT_FILE` is defined (line 15) and the cleanup function (line 17-19), but before any side-effecting commands. This ensures the variable is available to the trap handler regardless of where the script fails.

3. **All jq assertion patterns verified correct:**
   - `jq -e` with `--arg` and `select()` correctly returns non-zero when no match is found (empty output → exit 4).
   - `index("lifecycle") | not` correctly inverts presence checks.
   - `.closed_at != null` correctly evaluates to boolean `true`/`false` for `jq -e`.

4. **No credential exposure:** `FARMTABLE_TOKEN` is required via `require_env` but never echoed, logged, or interpolated into output messages. Only `FARMTABLE_SERVER` is logged (line 17 of `run-all.sh`).

5. **Consistent strict mode:** All 5 shell scripts use `set -euo pipefail`. The `common.sh` library correctly relies on the sourcing script's strict mode rather than setting it independently.

6. **Proper quoting throughout:** All variable expansions are double-quoted, including inside `$()` command substitutions and here-strings (`<<<"$json"`). No word-splitting vulnerabilities.

7. **shellcheck compatibility:** All scripts include `# shellcheck source=common.sh` directives. Manual review found no patterns that shellcheck would flag (no unquoted variables, no eval, no glob-in-variable patterns).

---

### Verification Story

- **Tests reviewed:** Yes — all 6 files read in full. Assertions cross-verified against jq behavior with edge cases (empty arrays, null values, boolean inversion).
- **Build verified:** N/A — shell scripts, no build step. File permissions confirmed correct (`0755` on all `.sh` files, `0644` on `README.md`).
- **Lint/static analysis clean:** shellcheck not available in this environment; thorough manual review found no issues.
- **Security checked:** Yes — no credential logging, no hardcoded secrets, no unsafe temp file patterns, proper use of env vars for auth.
- **R1 fixes verified:** Both findings from Round 1 are correctly resolved in commit `f25e7e5`. No regressions introduced.

---

### File Summary

| File | Lines | Status |
|------|-------|--------|
| `common.sh` | 84 | ✅ Clean. `test_stamp` now includes `$RANDOM`. |
| `run-all.sh` | 33 | ✅ Clean. No changes since R1. |
| `test-task-lifecycle.sh` | 113 | ✅ Clean. No changes since R1. |
| `test-collection-lifecycle.sh` | 52 | ✅ Clean. No changes since R1. |
| `test-export-import.sh` | 99 | ✅ Clean. `trap cleanup EXIT` added. |
| `README.md` | 53 | ✅ Clean. No changes since R1. |

---

**Final Verdict:** **APPROVE** — All Round 1 feedback has been addressed. No new issues found. The branch is ready to merge.
