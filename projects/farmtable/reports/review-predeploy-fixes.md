# PR #167: fix(auth): pre-deploy fixes for auth-stage4-scope-ext — Review

**Branch:** `auth-stage4-predeploy-fixes` → `main`
**Merge base:** `50fd8e0`
**Commits:** `381900a` (pass-through triage default + empty-type warning), `059f36c` (`ft token update`)
**Reviewer:** code-reviewer agent
**Date:** 2026-07-26

## Executive Summary

The `StageTriage` → `StageBacklog` fallback is correct, minimal, and unblocks the
pass-through backend as intended; the design-doc updates are thorough and honest about the
breaking migration. The new `ft token update` command, however, contains a scope-arithmetic
bug that **silently escalates a restricted token to full wildcard** when the last remaining
scope is removed, plus two related silent-failure modes around legacy nil-scope and `"*"`
tokens — risk level **HIGH** for the token half, LOW for the stage half.

**Verdict: REWORK** (one Critical, two High; all confined to `internal/cli/token.go`).

---

## Critical Issues

### C1. `--remove-scope` that empties the scope set escalates the token to wildcard
`internal/cli/token.go:285-300` (+ `internal/store/entstore.go:1456`, `internal/server/scopes.go:81-83`)

`newScopes` is declared as `var newScopes []string` and only appended to from the surviving
scope set. If the operator removes every scope the token currently holds, the set is empty,
`newScopes` stays **nil**, `server.ValidateScopes(nil)` passes vacuously (empty loop), and
`UpdateAPITokenScopes(ctx, id, nil)` persists JSON `null`.

On the read side this is unambiguous:

```go
// internal/server/scopes.go:81-83
// nil/empty scopes = wildcard (backward compatible with existing tokens)
if len(scopes) == 0 {
    return nil
}
```

So `ft token update <id> --remove-scope task:read --remove-scope task:write --remove-scope
task:claim --remove-scope collection:read` on a default agent token turns that token into a
**full-wildcard admin token**, and the command prints `"new_scopes": null` next to a success
message. This is the exact inverse of operator intent and the most likely way an operator
would try to neuter a compromised token in a hurry. (Verified end-to-end: ent marshals
`SetScopes(nil)` to the literal `null`, which unmarshals back to a nil slice; SQL NULL and
`[]` behave identically.)

The `--set-scopes` path is accidentally protected by the `NO_CHANGES` guard at
`token.go:257-259`, so this is reachable only through `--remove-scope`.

**Suggested fix** — fail closed on an empty result, and make the wildcard semantics explicit:

```go
			// Validate all scopes before writing.
			if err := server.ValidateScopes(newScopes); err != nil {
				return exitError(ExitValidation, "INVALID_SCOPE", err.Error())
			}
			if len(newScopes) == 0 {
				return exitError(ExitValidation, "EMPTY_SCOPES",
					"refusing to write an empty scope set: an empty scope list is interpreted "+
						"as wildcard (full access). Use --set-scopes task:read to restrict the "+
						"token, or `ft token revoke` to disable it")
			}
```

A defence-in-depth companion fix (out of this PR's scope, worth a follow-up task): have
`UpdateAPITokenScopes` reject a nil/empty slice at the store layer, so no future caller can
mint a wildcard by omission.

---

## High

### H1. `--add-scope` on a legacy nil-scope (wildcard) token silently *demotes* it
`internal/cli/token.go:285-296`

`scopeSet` is seeded from `tok.Scopes`. For a legacy token, an admin/human/service_account
session token, or the `local-embedded` CLI token (`internal/cli/connect.go:215-218`) — all of
which carry **no** stored scopes and are therefore wildcard — the seed set is empty. Running
the documented rollout command:

```bash
ft token update <id> --add-scope task:close
```

produces `scopes = ["task:close"]`, i.e. the token goes from *all permissions* to *exactly
one*. The Long help text says "grant additional scopes"; for the wildcard population it
revokes nearly everything, and the breakage will surface as scattered `PermissionDenied`
errors on an already-authenticated session rather than at the point of the CLI call.

**Suggested fix** — treat "no stored scopes" as a distinct state and refuse to guess:

```go
			} else {
				if len(tok.Scopes) == 0 {
					return exitError(ExitValidation, "UNSCOPED_TOKEN",
						"token has no stored scopes (legacy wildcard token); --add-scope/--remove-scope "+
							"would silently restrict it. Use --set-scopes to state the full intended set")
				}
				...
```

### H2. `--remove-scope` against a `"*"` token reports success but revokes nothing
`internal/cli/token.go:285-300`

Tokens minted for `admin`, `human`, and `service_account` carry the literal `["*"]`
(`internal/server/scopes.go:124,141,145`). `--remove-scope task:close` on such a token deletes a
key that isn't in the set, leaves `["*"]` intact, and prints `Token abcd1234 scopes updated.`
The operator reasonably concludes the permission is gone; it isn't. Same class of failure as
C1 (silent no-op on a security-relevant operation), different trigger.

**Suggested fix** — detect the wildcard explicitly before applying removals:

```go
				if len(removeScopes) > 0 && scopeSet[server.ScopeWildcard] {
					return exitError(ExitValidation, "WILDCARD_TOKEN",
						"token holds the wildcard scope \"*\"; removing individual scopes has no effect. "+
							"Use --set-scopes to replace the wildcard with an explicit scope list")
				}
```

### H3. No test coverage for any of the new code
`internal/store/entstore.go:1409,1456`, `internal/store/multistore.go:414,418`, `internal/cli/token.go:226-325`

The only test change in the PR is the two-line expectation flip in `labels_test.go`. There is
no test for `GetAPIToken`, `UpdateAPITokenScopes`, or the add/remove/set scope arithmetic —
which is precisely where C1, H1, and H2 live. `internal/store/identity_test.go` already has a
create/lookup/revoke harness to extend.

**Minimum coverage to add before merge:**
- store: `UpdateAPITokenScopes` round-trip (set → `LookupToken` returns the same slice), not-found → `ErrNotFound`, and an explicit assertion of what an empty slice reads back as.
- CLI (table-driven over the scope-merge logic, extracted into a small pure helper so it is testable without a DB):
  - add to an existing set; remove from an existing set; combined add+remove
  - remove-all → must error (C1)
  - add on a nil-scope token → must error (H1)
  - remove on a `["*"]` token → must error (H2)
  - `--set-scopes` mutually exclusive with `--add-scope`/`--remove-scope`
  - unknown scope → `INVALID_SCOPE`

---

## Medium

### M1. `internal/cli/token.go` is no longer gofmt-clean
`internal/cli/token.go:307-310` — the new map literal is over-aligned by one space. Verified
against the merge base: `token.go` was clean at `50fd8e0` and is flagged by `gofmt -l` now.
(`internal/server/scopes.go` and `internal/store/store.go` are also flagged, but both were
already unformatted at the base commit — not this PR's doing.)

```go
			m := map[string]interface{}{
				"id":         updated.ID.String(),
				"name":       updated.Name,
				"old_scopes": tok.Scopes,
				"new_scopes": updated.Scopes,
			}
```

### M2. The command ignores the global `--output` flag
`internal/cli/token.go:226,306-312`. `newTokenCreateCmd`, `newTokenListCmd`, and every other
CLI command call `resolveOutput(globals.output)` and branch on `quiet`/`table`/default;
`newTokenUpdateCmd` accepts `globals` and never reads it, unconditionally calling `printJSON`.
Scripts driving `ft --output quiet token update ...` get unexpected JSON on stdout. Either
honour `resolveOutput` or drop the unused `globals` parameter and document the deviation.

### M3. Scope update is a non-atomic read-modify-write
`internal/cli/token.go:277-305`. `GetAPIToken` then `UpdateAPITokenScopes` are two separate
statements with no transaction, version check, or CAS. Two concurrent `--add-scope` calls
against the same token lose one of the additions. Practical risk is low (single-operator
admin CLI on a local SQLite file), but the rest of the codebase does use optimistic
concurrency for tasks (`ClaimTask`'s `version` parameter). Worth a comment acknowledging the
choice, or a `WithTx` wrapper if `EntStore` exposes one.

### M4. No audit record for a privileged scope change
`internal/store/entstore.go:1456`. Scope escalation is now the least-audited privileged
operation in the system: task field edits go through `recordChanges`
(`internal/store/entstore.go:1261`), while a token going from `task:read` to `*` leaves nothing
behind but the operator's terminal output. `openDirectStore` carries no identity so a proper
actor cannot be recorded today, but a `log.Printf` of `{token id, old scopes, new scopes}` in
`UpdateAPITokenScopes` would at least land in server/CLI logs. Recommend filing as a
follow-up rather than blocking this PR.

### M5. The fallback hardcodes the phase instead of deriving it
`internal/platform/github/labels.go:407`. The two label-matched return paths above it use
`phaseForStage(stage)` (`labels.go:387,398`); the new fallback returns a literal
`task.PhaseOpen`. The value is correct today — `phaseForStage(StageBacklog)` reaches the
`default: return task.PhaseOpen` arm at `labels.go:441` — but a future regrouping of
`backlog` would silently desync this one line.

```go
	return phaseForStage(task.StageBacklog), task.StageBacklog
```

### M6. Rollout notes should state that accept-gating is unenforceable on pass-through
`.design/project-log/auth-stage4-predeploy-passthrough.md`. The doc explains why backlog is
safe but not what is given up: after this change an unlabelled GitHub issue can never be in
triage, so the `task:accept` gate — the whole point of PR #166 — simply does not apply to
pass-through collections. Anything holding `task:claim` can start work on any unlabelled
issue. That is a defensible trade-off (the alternative bricks the backend entirely), but it
should be written down alongside the decision rather than discovered later.

---

## Low

### L1. Root cause of the triage block is untouched and still bites two other adapters
`internal/server/server.go:688-691` hard-blocks `ClaimTask` on `StageTriage` for *every*
caller — wildcard admin included, and even in open-access mode, since the check sits outside
any auth-mode branch (confirmed by `internal/server/rbac_test.go:838-867`). This PR routes
*unlabelled* pass-through issues around the block, but:
- natively created tasks still default to `StageTriage` (`internal/server/server.go:108`),
- the mirrored (non-pass-through) GitHub sync adapter still maps every open issue to triage
  and rewrites it on each sync (`internal/platform/github/github.go:237-243`), as does the
  beads adapter (`internal/platform/beads/beads.go:312`).

Those paths remain unclaimable-without-a-separate-`UpdateTask` after this merge. Not a defect
in this diff — but the PR/design doc frames the pass-through fix as *the* pre-deploy blocker,
and mirrored collections are still broken. Recommend a follow-up task before the #166 deploy.

### L2. Kanban column shift for pass-through issues
Triage and Backlog are distinct columns (`web/src/components/kanban/ft-kanban-view.ts:29-30`).
Unlabelled GitHub issues will visibly move from Triage to Backlog on deploy, and `native_label`
changes from `"triage"` to `"backlog"` (`internal/platform/github/passthrough.go:131-141`).
Worth a release-note line. Related minor side effect: any client that echoes the full task
back on edit will now send `stage=backlog`, causing an `ft:stage/backlog` label to be pushed
to a previously-unlabelled issue (`passthrough.go:343-348`).

### L3. Unnecessary eager load in `GetAPIToken`
`internal/store/entstore.go:1409-1414` uses `.WithUser()`, but the only caller
(`internal/cli/token.go:280`) reads `tok.Scopes` and nothing from `Edges.User`. Harmless, but
it is an extra join on every call; `ListAPITokens` needs the edge, this does not.

### L4. `sortScopes` is a one-line wrapper used once
`internal/cli/token.go:19,303`. `sort.Strings(newScopes)` at the call site is clearer than the
indirection, and the helper's package-level name invites accidental reuse.

### L5. Error-code granularity on lookup failure
`internal/cli/token.go:279-282` maps every `GetAPIToken` failure to `ExitGeneral` /
`TOKEN_NOT_FOUND`, so a DB-level failure is reported to scripts as "token not found".
`ExitNotFound` (4) exists. This matches the existing convention in `newTokenRevokeCmd`
(`token.go:343-345`), so it is a consistency-preserving nit, not a defect.

### L6. Logging is not a fix for the empty-user-type wildcard
`internal/server/scopes.go:147-156`. Removing the `if userType != ""` guard is a strict
improvement and correctly framed — but the underlying behaviour is unchanged: a user row with
an empty `Type` still mints a 24-hour **wildcard** session token
(`internal/serverapp/provisioning.go:139-148`). Newly provisioned users get `"human"`
(`provisioning.go:89-92`), so exposure is limited to pre-existing rows. Suggest a follow-up to
fail closed (or default to `viewer`) for unrecognized types once the legacy population is
audited.

---

## Positive Feedback

- **The `StageBacklog` choice is correct and well-reasoned.** `stagesAccepted` is
  `{Backlog, Ready}` (`internal/server/transitions.go:16`), so backlog is claimable with plain
  `task:claim`, and `backlog → working` resolves to `task:claim` in the transition table
  rather than laundering anything out of triage. `phaseForStage(StageBacklog)` agrees with the
  hardcoded `PhaseOpen`, and `GetReadyTasks` already included both triage and backlog under
  `IncludeUnblockedOpen` (`internal/store/entstore.go:2052-2053`), so ready-work results are
  unchanged. Option A really was the smallest blast radius.
- **The doc comment on the fallback explains the *why*, not the *what*** — the next reader
  will not "simplify" it back to `StageTriage`.
- **The `auth-stage4-scope-extension.md` backward-compatibility update is genuinely good
  engineering hygiene.** Explicitly calling the change "a data migration, not a config flip",
  and naming `agents.md` step 5 and the skill doc as now-describing-an-unauthorized-operation,
  is the kind of honesty that prevents a bad deploy.
- **Store interface extension follows the established pattern exactly**: interface declaration,
  `EntStore` implementation with `ent.IsNotFound` → `ErrNotFound` translation, `MultiStore`
  primary delegation, and `ErrNotImplemented` stubs on `GitHubPassThroughStore` matching the
  surrounding methods verbatim. All three implementations were updated; no other implementors
  exist (test doubles embed `store.Store`), and the compile-time assertions still hold.
- **Flag-conflict handling in the CLI is done right** — `--set-scopes` vs
  `--add-scope`/`--remove-scope` mutual exclusion and the `NO_CHANGES` guard are both checked
  *before* the store is opened, and `server.ValidateScopes` is called before the write rather
  than after.

---

## Test Coverage

| Path | Covered |
|---|---|
| `IssueToPhaseStage` fallback → backlog | Yes — `TestIssueToPhaseStage_Fallback`, `TestLabelMapper_Disabled` updated correctly |
| `DefaultScopesForUserType("")` warning | No — log-only change, no assertion added (acceptable) |
| `EntStore.GetAPIToken` | **No** |
| `EntStore.UpdateAPITokenScopes` | **No** |
| `MultiStore` delegation | **No** |
| `ft token update` scope arithmetic | **No** — this is where C1/H1/H2 live |

Verification performed for this review:
- `go build ./...` — clean (exit 0)
- `go test ./internal/platform/github/ ./internal/store/ ./internal/cli/ ./internal/server/` — all pass
- `gofmt -l internal/` — `internal/cli/token.go` newly unformatted (M1); other hits pre-date the merge base
- `go vet` — 4 `copies lock value` findings in `internal/server/server.go`, all pre-existing and outside the diff

## Backward Compatibility

- **`store.Store` gains two methods.** Breaking for any out-of-tree implementor, but the
  interface is `internal/`, all three in-repo implementations are updated, and test doubles
  embed the interface. No action needed.
- **No wire-format change.** No proto edits; no new RPCs. `ft token update` is direct-DB only,
  consistent with the rest of `ft token`.
- **Data-visible change:** unlabelled open GitHub issues on pass-through collections change
  `stage` and `native_label` from `triage` to `backlog` (L2). No stored data is rewritten.
- **The `apitoken.scopes` column can now be written to `null` by an operator command** — see C1.
  Nothing distinguishes "legacy unrestricted" from "explicitly emptied", which is why C1 is a
  Critical rather than a nit.

## Final Verdict

**REWORK.**

C1 must be fixed before merge — the command shipped to *repair* over-restricted tokens can
convert a scoped token into a wildcard token with no warning, and the failure mode is
invisible in the success output. H1 and H2 are the same defect class against the wildcard and
legacy-nil token populations, and both are on the documented rollout path in
`auth-stage4-predeploy-token-update.md`. H3 (tests for the scope arithmetic) should land with
the fixes; extracting the merge logic into a pure helper makes all three cheap to cover.

The pass-through half of the PR (`381900a`) is sound and could be merged independently if the
deploy is time-critical. M4 (audit logging) and L1 (mirrored/beads adapters still map to
triage) are recommended follow-ups, not blockers.
