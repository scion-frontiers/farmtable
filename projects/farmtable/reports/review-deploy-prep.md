# PR #168: `fix(auth): deploy prep for auth-stage4 — adapter triage fixes and token CLI hardening` — Review

**Branch:** `auth-stage4-deploy-prep` → `main`
**Merge base:** `7fe2435` (PR #167 merge)
**Commits:** `ab6e4b7`, `de6be43`
**Diff:** 7 files, +182 / −65
**Reviewer:** code-reviewer
**Date:** 2026-07-26

---

## Executive Summary

**Risk level: LOW for the code, MEDIUM for the runbook.** The two adapter changes faithfully replicate the reviewed `StageTriage → StageBacklog` pattern already merged in PR #167 (`labels.go:401`), the sentinel-error wrapping is correct (`%w` + `errors.Is`, guard-rail ordering verified), build/vet/full test suite are green — but the new deploy runbook contains at least three commands that will not execute as written against the current CLI, which matters because operators will copy-paste it during the actual rollout.

**Verdict: REWORK** — scoped to `.design/project-log/auth-stage4-deploy-rollout.md` only. All Go changes are approved as-is.

---

## Critical Issues

None.

---

## High

### H1. Runbook step 3 uses a `--name` flag that does not exist on `ft user create`
`.design/project-log/auth-stage4-deploy-rollout.md:41`

```bash
ft user create --type reviewer --name "task-reviewer" --email reviewer@example.com
```

`newUserCreateCmd` (`internal/cli/user.go:32`) declares `Use: "create <name>"` with `Args: cobra.ExactArgs(1)` and registers only `--type` and `--email`. This invocation fails with `unknown flag: --name` **and** `accepts 1 arg(s), received 0`. The reviewer/orchestrator token path is the *recommended* rollout path, so this is the first command that breaks during deploy.

**Suggested fix:**
```bash
ft user create "task-reviewer" --type reviewer --email reviewer@example.com
```

Verified separately: `--type reviewer` is valid — `schema/user.go:19` stores `type` as a free-form string (default `agent`), and `server.DefaultScopesForUserType("reviewer")` returns exactly the six scopes the runbook claims (`task:read, task:write, task:claim, task:accept, task:close, collection:read`). That part of the doc is accurate.

### H2. Runbook verification steps read a `.scopes` field that `ft token list` never emits
`.design/project-log/auth-stage4-deploy-rollout.md:25, 60`

```bash
ft token list --output json | jq '.items[] | select(.name == "<agent-token>") | .scopes'
```

The JSON branch of `newTokenListCmd` (`internal/cli/token.go:272-291`) builds items with `id`, `name`, `user_id`, `created_at`, and conditionally `user_name`, `last_used_at`, `expires_at`. **`scopes` is never included**, so this filter silently returns `null` for every token — the post-deploy verification step will appear to succeed while verifying nothing. There is also no `ft token get` subcommand (`newTokenCmd` registers only `create`, `list`, `update`, `revoke`), so there is currently *no* CLI read path for a token's scopes.

**Suggested fix (preferred — 3 lines, makes the runbook executable):**
```go
// internal/cli/token.go, in the JSON branch of newTokenListCmd
if len(t.Scopes) > 0 {
    m["scopes"] = t.Scopes
}
```
Otherwise, rewrite the verification step to rely on the `new_scopes` field that `ft token update` already prints in its default JSON output, and drop the `.scopes` projection from step 1.

### H3. "Known Limitation" option 1 is not just wrong — it is destructive
`.design/project-log/auth-stage4-deploy-rollout.md:73`

> 1. Run `ft token update` with `FARMTABLE_DB_PATH` pointed at the production DB

`openDirectStore()` (`internal/cli/connect.go:258-273`) hardcodes `Dialect: "sqlite3"` with DSN `file:%s?_fk=1` and `Migrate: true`. Pointing `FARMTABLE_DB_PATH` at a PostgreSQL deployment cannot work; worse, because the store runs `MkdirAll` + `Migrate`, the operator will **silently create a brand-new empty SQLite file** at that path and then get a confusing `TOKEN_NOT_FOUND`, having believed they operated on production.

**Suggested fix:**
```markdown
## Known Limitation

`ft token update` is SQLite-only: it opens the embedded DB directly via
`openDirectStore()`, which hardcodes the sqlite3 dialect. It cannot target a
PostgreSQL server-mode deployment — pointing `FARMTABLE_DB_PATH` at one will
create a new empty SQLite file rather than failing.

For PostgreSQL deployments the operator must update scopes via SQL:

    UPDATE api_tokens SET scopes = '...' WHERE id = '...';

A server-mode `UpdateTokenScopes` RPC is tracked as follow-up work.
```

---

## Medium

### M1. The `mergeScopes` error → CLI error-code mapping is untested
`internal/cli/token.go:363-372`

The new `switch` inside `RunE` is the actual deliverable of S1 (scriptable error codes), but the tests only cover `mergeScopes` returning sentinel-wrapped errors — nothing asserts that `errUnscopedToken` produces the string `"UNSCOPED_TOKEN"`. A typo in a code literal would ship silently and break the bulk-rollout scripts this feature exists for. Extracting the mapping also removes logic from the closure, matching how the rest of the file keeps `RunE` thin.

**Suggested fix:**
```go
// scopeMergeErrorCode maps a mergeScopes guard-rail failure to the stable
// machine-readable code emitted to scripts.
func scopeMergeErrorCode(err error) string {
	switch {
	case errors.Is(err, errUnscopedToken):
		return "UNSCOPED_TOKEN"
	case errors.Is(err, errWildcardToken):
		return "WILDCARD_TOKEN"
	case errors.Is(err, errEmptyScopes):
		return "EMPTY_SCOPES"
	default:
		return "SCOPE_MERGE_ERROR"
	}
}
```
```go
// in RunE
if err != nil {
	return exitError(ExitValidation, scopeMergeErrorCode(err), err.Error())
}
```
Then add a table test over `{nil-current+add, wildcard+remove, remove-all, nil}` asserting the code strings, including the `SCOPE_MERGE_ERROR` default for an unwrapped error.

### M2. Mirrored sync unconditionally clobbers local stage on every poll — behaviour changed, not fixed
`internal/platform/github/github.go:187`, `internal/platform/beads/beads.go:123`

`IssueToUpdateParams` always sets `Stage` from remote state alone, and the sync loops call it for every existing task on every pass. For GitHub, `issueStateToPhaseStage("open")` has no label input, so a task an agent has claimed (`PhaseInProgress`/`StageWorking`) is reset to `PhaseOpen`/`StageBacklog` on the next sync.

This clobber is pre-existing (it previously reset to `StageTriage`), and the new value is strictly better than the old one, so **this is not a blocker for this PR**. But the failure mode changes character: previously the reset produced a loud `FailedPrecondition` on the next `ClaimTask`; now it produces a *silent* claim/reset thrash where an agent's ownership evaporates without an error. Worth a tracked follow-up rather than a fix here.

**Recommendation:** file a follow-up to make the mirrored update path preserve a locally-advanced stage (e.g. skip the `Stage` field when the local stage is in `stagesWorking`/`stagesHandoff` and the remote state is still `open`). Note that `beads` is less affected — it maps `in_progress → StageWorking` from the remote side.

### M3. Adapters now import external work as *accepted*, bypassing the `task:accept` gate
`internal/platform/github/github.go:243`, `internal/platform/beads/beads.go:312`

`ClaimTask` gates only on `existing.Stage == task.StageTriage` (`internal/server/server.go:688`), and `stagesAccepted = {StageBacklog, StageReady}` (`internal/server/transitions.go:16`). Defaulting adapters to `StageBacklog` therefore means anyone who can open an issue in a mirrored repo injects work that is immediately claimable, with no `task:accept`-scoped human or reviewer in the loop.

This is the deliberate, already-reviewed trade-off from PR #167 and is correctly applied here — flagging it only because the consequence is now repo-wide across all three adapters and is not written down anywhere in the auth design docs. The inline comments explain *why not triage*; they do not state the residual authz implication.

**Recommendation:** add one line to the auth-stage4 design doc (or this runbook) recording that mirrored/pass-through collections do not enforce the accept gate on intake, and that the gate applies only to natively-created tasks (`server.go:108` still defaults to `StageTriage` — correct and unchanged).

---

## Low

### L1. Sentinel prefix is duplicated into the human-facing message
`internal/cli/token.go:47-50, 57-60, 79-83`

`fmt.Errorf("%w: ...", errUnscopedToken)` yields `unscoped token: token has no stored scopes (legacy wildcard); ...`, so the operator sees `Error: unscoped token: token has no stored scopes ...`. The prefix restates what the `UNSCOPED_TOKEN` code already conveys, and the second clause already re-says "token has no stored scopes". Harmless, but if you want the machine tag without the prose duplication, a small typed error keeps `Error()` clean:

```go
type scopeGuardError struct {
	sentinel error
	msg      string
}

func (e *scopeGuardError) Error() string { return e.msg }
func (e *scopeGuardError) Unwrap() error { return e.sentinel }
```

`errors.Is` keeps working, the tests are unchanged, and the message stays operator-readable. Optional.

### L2. Wildcard literal still hardcoded in the error text
`internal/cli/token.go:58`

The comparison correctly moved to `server.ScopeWildcard`, but the message it produces still embeds `\"*\"` as a literal. Cosmetic only — no behavioural risk — but if the constant is the source of truth, `fmt.Errorf("%w: token holds the wildcard scope %q; ...", errWildcardToken, server.ScopeWildcard, ...)` closes the loop.

### L3. `--output quiet` on `token update` changed payload (scopes → token ID)
`internal/cli/token.go:389`

This is a wire-format change for anyone scripting `ft token update --output quiet`. It is the right call — `printQuiet(id)` is the convention in every other command (`user.go:60`, `task.go:159`, `collection.go:113`, …) — and `ft token update` was introduced in `059f36c` within this same unreleased auth-stage4 series, so real-world exposure is nil. Worth a changelog line nonetheless. Note the resulting scope list is still available on the default JSON path as `new_scopes`, so nothing is lost.

### L4. Runbook step 1 will silently truncate at 200 tokens
`.design/project-log/auth-stage4-deploy-rollout.md:20`

`newTokenListCmd` hardcodes `Limit: 200` with no pagination flag (`internal/cli/token.go:230`) and the envelope's `total_count` is printed but not acted on. Pre-existing code, not touched by this PR — but the runbook presents this command as a complete *inventory*. Add a caveat: "compare `.total_count` against the returned item count; `ft token list` caps at 200."

### L5. Runbook embeds development-machine specifics
`.design/project-log/auth-stage4-deploy-rollout.md:52-58`

`/workspace/.farmtable/farmtable.db`, `/workspace/.farmtable/bin/ft`, and "17 tokens" are point-in-time facts about one dev container being committed into a shared design doc. They will be wrong within a week and could mislead a future operator into thinking those paths are canonical. Suggest scoping the section explicitly, e.g. `## Current State (dev container as of 2026-07-26 — not applicable to other deployments)`. No secrets are exposed in the document.

---

## Positive Feedback

- **The adapter fix genuinely matches the reviewed #167 pattern.** I diffed the new defaults against `labels.go:401` (`IssueToPhaseStage`): same `StageBacklog` value, same reasoning, and the comments cite the concrete mechanism (`StageTriage` + accept gate → `ClaimTask` fails for all roles) rather than just restating the change. Both new comments are the kind that survive contact with a future reader who has forgotten auth-stage4.
- **Guard-rail ordering in `mergeScopes` is correct, and this is the subtle part.** The `len(set) > 0` short-circuit sits *before* the `len(current) == 0` check, so the documented `UNSCOPED_TOKEN` remediation ("use `--set-scopes`") actually works. Had those two blocks been ordered the other way, the runbook's Option B would have been an infinite loop for every legacy token. Worth calling out because nothing in the tests would have caught it.
- **Round-trip stability was preserved on both adapters.** `phaseStageToStatus(PhaseOpen, StageBacklog)` → `"open"` and `phaseToIssueState(PhaseOpen)` → `"open"`, so the new default does not introduce sync ping-pong that pushes spurious updates back to GitHub/Beads on every cycle. Easy thing to get wrong when changing a mapping default.
- **Sentinel wrapping is textbook.** `%w` verb, package-private sentinels, `errors.Is` in the tests, and the `SCOPE_MERGE_ERROR` fallback retained so unclassified failures still produce a code rather than an empty string.
- **Deleting the hand-rolled `containsSubstr`/`searchSubstr` in favour of `strings.Contains`** removes 13 lines of reimplemented stdlib from the test file. Good opportunistic cleanup, correctly scoped to a file the PR was already touching.
- **Flag validation was already right and stayed right:** `CONFLICTING_FLAGS` and `NO_CHANGES` are enforced in `RunE` before the store is opened, so the new Long help's mutual-exclusivity claim is actually backed by code.

---

## Test Coverage

| Area | Covered | Notes |
|---|---|---|
| `mergeScopes` sentinel wrapping | ✅ | 15 cases; `errors.Is` asserted on all three guard rails |
| `mergeScopes` → CLI error code | ❌ | **M1** — the switch in `RunE` has no test |
| Beads `statusToPhaseStage` default | ✅ | `TestStatusMapping` `{"open", PhaseOpen, StageBacklog}` |
| Beads sync end-to-end stage | ✅ | `TestBeadsSyncIntegration` `BEADS-002.stage` |
| GitHub `IssueToCreateParams` open | ✅ | `TestIssueToCreateParams_OpenIssue` |
| GitHub `IssueToUpdateParams` open | ⚠️ | Only the `closed` → `StageCompleted` case is asserted (`github_test.go:135`); the open→`StageBacklog` update path — the one that clobbers per M2 — is untested |
| `printQuiet` on `token update` | ❌ | No test; low value given the trivial change |

One deliberate test-quality note: the `wantErr` substrings were loosened (`"refusing to write an empty scope set"` → `"empty scope"`). Normally I'd push back on weakening an assertion, but here it is well-traded — the `errors.Is` check that replaced it is a far stronger contract than substring matching, and the looser string keeps the test from breaking on message rewording. Good call.

**Suggested addition** (closes the M2-adjacent gap, ~10 lines):
```go
func TestIssueToUpdateParams_OpenIssueDefaultsToBacklog(t *testing.T) {
	issue := &gh.Issue{Number: gh.Int(7), State: gh.String("open"),
		Title: gh.String("t"), Body: gh.String("b")}
	params := IssueToUpdateParams(issue, "acme/repo#7")
	if *params.Stage != task.StageBacklog {
		t.Errorf("Stage = %v, want StageBacklog", *params.Stage)
	}
	if *params.Phase != task.PhaseOpen {
		t.Errorf("Phase = %v, want PhaseOpen", *params.Phase)
	}
}
```

---

## Backward Compatibility

- **No wire-format changes.** No proto edits, no removed struct fields, no new required fields.
- **`--output quiet` on `ft token update`** changed payload (see L3) — acceptable, unreleased command, but changelog-worthy.
- **Stage-mapping change is data-affecting on the next sync.** Existing mirrored tasks sitting at `StageTriage` will be rewritten to `StageBacklog` the first time sync runs post-deploy. That is the intended fix, but it is a silent bulk mutation of existing rows and should be stated in the runbook's pre-deploy section so nobody is surprised by a dashboard full of moved cards.
- **No migration required for scopes.** Confirmed the runbook's claim: `RequireScope` treats nil scopes as wildcard (`scopes.go:83`), so the existing nil-scoped tokens keep working untouched.

---

## Verification Story

- **Tests reviewed:** yes — see table above. Tests were read before the implementation; they accurately encode the intent stated in the PR description.
- **Build verified:** yes — `go build ./...` exit 0.
- **Lint/static analysis:** yes — `go vet ./internal/cli/... ./internal/platform/...` clean.
- **Tests pass:** yes — `go test ./...` fully green; `internal/cli`, `internal/platform/beads`, `internal/platform/github` all `ok`.
- **Security checked:** yes — no secrets in the diff or the new doc; no new unsanitized input paths; the only authz-relevant change is the accept-gate intake semantics covered in M3, which is the already-approved #167 trade-off. `ValidateScopes` still runs on the merged set before any write (`token.go:378`), so the guard-rail refactor did not open a path to persisting an invalid scope.
- **Dependency signatures verified against base:** `server.ScopeWildcard` (`scopes.go:14` = `"*"`), `printQuiet(string)` (`output.go:24`), `exitError(int, string, string)` (`errors.go:98`) — all pre-existing on `main`, all new call sites valid.

---

## Final Verdict

**REWORK** — docs-only, roughly a 15-minute fix.

The Go changes are correct, well-commented, consistent with the PR #167 pattern, and fully green; I would approve them standing alone. The blocking items are H1–H3 in the deploy runbook: for a PR whose stated purpose is deploy preparation, shipping a runbook containing a command that cannot execute (H1), a verification step that silently checks nothing (H2), and a remediation that quietly creates a decoy database (H3) defeats the deliverable's purpose.

**Required before merge:** H1, H2, H3.
**Recommended for a cleanup pass (non-blocking):** M1 (error-code test), the `IssueToUpdateParams` open-issue test, L4, L5.
**Track as follow-ups:** M2 (sync stage clobber), M3 (document accept-gate intake semantics).
