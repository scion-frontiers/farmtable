# Review: feat/cli-integration-tests

**PR:** `feat/cli-integration-tests` vs `main`  
**Commit:** `48f9ef6` — feat: add CLI integration test scripts for task, collection, and export/import lifecycles  
**Reviewer:** Code Review Agent  
**Date:** 2026-07-20  

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This PR adds a well-structured set of shell-based CLI integration test scripts covering three core user journeys (task lifecycle, collection lifecycle, export/import). The scripts are clean, correctly use CLI commands verified against the Go source, follow good shell practices (`set -euo pipefail`, proper quoting), and isolate test data via timestamped disposable collections. There are no critical or blocking issues; the findings below are suggestions to improve robustness and hygiene.

---

### Critical Issues

None.

---

### Important Issues

**1. [test-export-import.sh:15] Export temp file is never cleaned up**

The script writes to `/tmp/test-export-${STAMP}.json` but never removes it, even on success. While `/tmp` is ephemeral on most systems, repeated runs accumulate files. More importantly, there is no `trap` to clean up on early exit (from `set -e` failures), so partial/failed runs also leak files.

**Recommended fix:** Add a trap at the top of the script, after `EXPORT_FILE` is defined:

```bash
cleanup() {
  rm -f "$EXPORT_FILE"
}
trap cleanup EXIT
```

This ensures cleanup on both success and failure paths. If the file is intentionally preserved for debugging, add a comment documenting that choice and consider gating cleanup on an env var (e.g., `KEEP_ARTIFACTS`).

---

### Suggestions

**2. [common.sh:28-29] `test_stamp` PID collision risk in parallel runs**

`test_stamp()` uses `date -u +%Y%m%d%H%M%S` plus `$$` (PID). If `run-all.sh` is invoked by two users simultaneously against the same server, and two processes happen to start in the same second with the same PID (possible in containers), collection names collide. This is unlikely in practice but the fix is trivial.

**Suggested improvement:** Append a random suffix:

```bash
test_stamp() {
  printf '%s-%s-%s' "$(date -u +%Y%m%d%H%M%S)" "$$" "$RANDOM"
}
```

**3. [common.sh:1] `common.sh` has a shebang but is sourced, not executed**

`common.sh` is a library sourced via `source "$SCRIPT_DIR/common.sh"` — the `#!/usr/bin/env bash` shebang is cosmetic. This is fine for documentation/convention, but some linting tools may flag a sourced file with a shebang. No change needed; this is just a note for awareness.

**4. [test-export-import.sh:79-88] Spot-check comparison may break if server adds fields**

The spot-check compares `{name, description, priority, type, labels}` extracted from source and imported task lists. If the server adds new fields (e.g., `status`) that `jq` projects away, the comparison remains valid. However, if import ever strips a field (e.g., `labels` becomes `null` instead of `[]`), the semantic comparison via `jq -S .` would correctly catch it, which is the right behavior. This is well-designed.

**5. [run-all.sh:17] `FARMTABLE_SERVER` is logged but token is not**

This is the correct behavior — the server address is logged for debugging but the token is never echoed. Good security practice. Noting as positive.

**6. [test-task-lifecycle.sh:60-73] Update test covers many mutations at once**

The update step changes priority, stage, description, assignee, add-label, and remove-label all in a single call. This is efficient but means if one of these mutations silently fails, others passing may mask it. Consider whether individual update calls per field would improve diagnostic value. However, the current approach is a pragmatic integration test — it tests the real-world usage pattern of batch updates.

**7. [run-all.sh:19-23] No `--` before script path in for loop execution**

The line `"$test_script"` is safe because the path starts with `/` (absolute path from `$(cd ... && pwd)`), so it won't be misinterpreted as a flag. No change needed.

**8. [test-collection-lifecycle.sh:48] `total_count | tostring` comparison**

The assertion `assert_json_eq "$TASK_LIST_JSON" '.total_count | tostring' "1"` converts numeric `total_count` to string for comparison. This is necessary because `assert_json_eq` uses `jq -r` which outputs raw strings, and the comparison operator is bash `[[ == ]]`. Verified correct.

**9. [common.sh:81-83] `list_leftover_test_collections` assumes `.items[]` array**

If the collection list returns zero results and `.items` is `null` or absent (instead of an empty array), jq will emit an error. Verified against the Go source: `printList` always emits `"items"` even when empty (Go `[]interface{}` marshals to `[]`), so this is safe.

**10. [README.md:17] Hardcoded server address and gcloud command**

The README includes a specific Cloud Run address and `gcloud secrets` command. This is documentation, not executable code, so it's fine — but consider whether the server address might rotate. If so, a pointer to where the current address is stored would be more durable. Minor.

---

### What's Done Well

1. **Excellent isolation:** Every script creates its own uniquely-named disposable collection with `test-integration-<stamp>-<purpose>`, ensuring no interference with existing data or between test runs.

2. **Proper `set -euo pipefail`:** All scripts use strict mode, catching undefined variables, failed commands, and pipe failures. This is exactly right for test scripts.

3. **`assert_json_eq` and `assert_json_true` helpers:** These provide clear diagnostics on failure — they print the expected value, actual value, and the full JSON payload. This makes debugging failed integration tests straightforward.

4. **Correct use of environment variables for auth:** The scripts rely on `FARMTABLE_SERVER` and `FARMTABLE_TOKEN` env vars, which the CLI correctly resolves (verified in `internal/cli/connect.go:33-48`). No credentials are hardcoded or logged.

5. **CLI command usage verified against source:** Every `ft` subcommand, flag, and expected JSON output field used in the scripts was cross-referenced against the Go CLI source (`internal/cli/task.go`, `collection.go`, `comment.go`, `graph.go`, `root.go`, `output.go`). All invocations are valid.

6. **Good coverage breadth:** The three journeys cover CRUD for tasks, collections, comments, relationships, dependency tree traversal, and export/import round-trip verification — the highest-value end-to-end paths.

7. **Known limitations documented honestly:** The README and inline comments clearly note that collections can't be deleted, that coverage isn't exhaustive, and that CI wiring is intentionally deferred. This prevents false expectations.

8. **shellcheck source directives:** The `# shellcheck source=common.sh` annotations demonstrate attention to static analysis compatibility.

---

### Verification Story

- **Tests reviewed:** Yes — the scripts *are* the tests; each was read in full and assertions cross-referenced against CLI source.
- **Build verified:** N/A — shell scripts, no build step. File permissions are correct (all `0755`).
- **Lint/static analysis clean:** shellcheck not available in this environment; manual review found no issues. Scripts include shellcheck source directives.
- **Security checked:** Yes — no credential logging, no hardcoded secrets in scripts, env var pattern is correct. Export file uses `0600` permissions (set by the Go CLI's `os.WriteFile`). Only concern is temp file cleanup (addressed above).

---

### Detailed File-by-File Notes

| File | Lines | Assessment |
|------|-------|------------|
| `common.sh` | 84 | Clean helper library. `require_env`, `require_command`, assertion helpers all well-implemented. `test_stamp` is adequate (see suggestion #2). |
| `run-all.sh` | 33 | Straightforward runner. Correctly validates prerequisites, runs all tests sequentially, reports leftovers. |
| `test-task-lifecycle.sh` | 113 | Comprehensive task journey: create, list, get, update (multi-field), comment add/list, relationship creation, tree verification, close. All assertions verified against CLI JSON output. |
| `test-collection-lifecycle.sh` | 52 | Focused collection journey: create, list, get, create-task-in-collection, list-with-scope. Platform assertion (`farmtable`) is a good detail. |
| `test-export-import.sh` | 93 | Thorough export/import round-trip: create source collection + tasks, export, validate JSON structure, import under new name, verify task count parity, spot-check field equality. The one gap is temp file cleanup (Important #1). |
| `README.md` | 53 | Clear usage documentation covering prerequisites, execution, coverage, and known limitations. |
