# PR #167: fix(auth): pre-deploy fixes for auth-stage4-scope-ext — Re-Review (v2)

**Branch:** `auth-stage4-predeploy-fixes` → `main`
**Head OID:** `d701613d5941a2d8348b2e54690cb31d06368ef5` (matches PR head)
**Merge base:** `50fd8e0`
**Commits:** `381900a`, `059f36c`, **`d701613` (fix commit under review)**
**Prior review:** `review-predeploy-fixes.md` — verdict REWORK (C1, H1, H2, H3)
**Reviewer:** code-reviewer agent
**Date:** 2026-07-26

## Executive Summary

The fix commit `d701613` extracts the scope arithmetic into a pure `mergeScopes()`
helper that **fails closed on all three escalation/demotion paths** flagged in the prior
review, and backs it with a 15-case table test plus two store round-trip tests. All
blocking findings (C1, H1, H2) are verified closed by inspection *and* by exhaustive
property check; risk on the token half drops from **HIGH to LOW**.

**Verdict: APPROVE** (with non-blocking suggestions and two carried-forward follow-ups).

---

## Verification of Prior Blocking Findings

### C1 — `--remove-scope` emptying the set escalates to wildcard → **CLOSED**

`internal/cli/token.go:78-84`. After the add/remove merge, the helper refuses an empty
result outright:

```go
if len(scopeSet) == 0 {
    return nil, fmt.Errorf(
        "refusing to write an empty scope set: an empty scope list is interpreted " +
            "as wildcard (full access). ...")
}
```

I did not accept this by inspection alone. I ran an exhaustive property check over the
Cartesian product of `{nil, [], ["*"], ["task:read"], ["task:read","task:write"],
["*","task:read"]}` across all four parameters (1296 combinations), asserting that every
non-error return is non-empty:

```
--- PASS: TestZZProp (0.00s)   // no EMPTY WRITE reported
```

There is no reachable input — from the CLI or from the helper's raw contract — that
produces a successful empty/nil write. The three guarded exits (`set` requires
`len(set) > 0`; nil-`current` errors; empty merge result errors) plus the pre-existing
`NO_CHANGES` guard at `token.go:317-319` fully partition the space. **C1 is structurally
closed, not just patched.** (Temp test file removed; working tree verified clean.)

### H1 — `--add-scope` on a legacy nil-scope token silently demotes → **CLOSED**

`internal/cli/token.go:48-53`. `len(current) == 0` now returns an error before any merge,
covering nil and `[]` identically. Verified by `H1: add on nil-scope token errors`,
`H1: add on empty-scope token errors`, and `H1: remove on nil-scope token errors`.
The error text names the remedy (`--set-scopes`), which matters because this fires on the
documented rollout command — see S6.

### H2 — `--remove-scope` on a `["*"]` token reports success but revokes nothing → **CLOSED**

`internal/cli/token.go:56-65`. The wildcard scan is correctly gated on `len(remove) > 0`,
so it does not block the legitimate `--add-scope`-only case. Verified by
`H2: remove on wildcard token errors`.

### H3 — No test coverage → **LARGELY CLOSED**

`internal/cli/token_test.go` (new, 154 lines) and `internal/store/identity_test.go:275-353`.
Against the prior review's requested coverage list:

| Requested | Status |
|---|---|
| add to existing set / remove / combined add+remove | Covered |
| remove-all → must error (C1) | Covered (2 cases, single- and multi-scope) |
| add on nil-scope token → must error (H1) | Covered (3 cases incl. `[]`) |
| remove on `["*"]` → must error (H2) | Covered |
| unknown scope → `INVALID_SCOPE` | **Not covered** (lives in `ValidateScopes`, called after merge) |
| `--set-scopes` mutually exclusive with add/remove | **Not covered** (guard is in `RunE`, not the helper) |
| store: `UpdateAPITokenScopes` round-trip + not-found | Covered, incl. persistence re-verified through `LookupToken` |
| store: what an empty slice reads back as | **Not covered** |
| `MultiStore` delegation | **Not covered** |

Extracting `mergeScopes` as a pure function was exactly the right call — it made the
security-relevant logic testable without a DB, which is why the C1/H1/H2 cases are cheap
and direct. The residual gaps are all in non-blocking wiring, not in the escalation logic.

### Other prior findings

| ID | Status |
|---|---|
| M1 gofmt on `token.go` | **Fixed** — `gofmt -l internal/` no longer flags it. Remaining hits (`scopes.go`, `store.go`, 12 others) confirmed already unformatted at `50fd8e0` |
| M2 ignores `--output` | **Fixed**, but non-idiomatically — see S2 |
| M5 hardcoded phase | **Fixed** — `labels.go:407` now `phaseForStage(task.StageBacklog)`; verified behaviour-identical (`labels.go:441` default arm → `PhaseOpen`) |
| L4 `sortScopes` wrapper | **Fixed** — removed, folded into `mergeScopes` |
| M3 non-atomic read-modify-write | Not addressed, no comment added — carried forward |
| M4 no audit record | Not addressed — carried forward as follow-up |
| M6 doc: accept-gating unenforceable on pass-through | Not addressed |
| L1 mirrored/beads adapters still map to triage | Not addressed — pre-existing, follow-up before #166 deploy |
| L3 unnecessary `.WithUser()` in `GetAPIToken` | Not addressed (`entstore.go:1412`) |
| L5, L6 | Not addressed — nits/follow-ups |

None of the unaddressed items are blocking; M3/M4/L1 were explicitly flagged as follow-ups
in the prior review.

---

## Critical Issues

None.

---

## Observations

### S1. All three guard rails collapse into one error code
`internal/cli/token.go:338-341`. The prior review suggested distinct codes
(`EMPTY_SCOPES`, `UNSCOPED_TOKEN`, `WILDCARD_TOKEN`); the implementation maps all three to
`SCOPE_MERGE_ERROR`. The human-readable messages are excellent and self-remediating, but a
rollout script driving hundreds of tokens cannot branch on *which* guard fired — e.g.
auto-retrying legacy tokens with `--set-scopes` while hard-failing on the others. Since the
rollout doc contemplates bulk re-provisioning, this is worth the small change.

**Suggested fix** — return a typed error and map it:

```go
var (
	ErrUnscopedToken = errors.New("unscoped")
	ErrWildcardToken = errors.New("wildcard")
	ErrEmptyScopes   = errors.New("empty")
)
// ... wrap with %w at each return site, then:
switch {
case errors.Is(err, ErrUnscopedToken):
	return exitError(ExitValidation, "UNSCOPED_TOKEN", err.Error())
case errors.Is(err, ErrWildcardToken):
	return exitError(ExitValidation, "WILDCARD_TOKEN", err.Error())
case errors.Is(err, ErrEmptyScopes):
	return exitError(ExitValidation, "EMPTY_SCOPES", err.Error())
}
```

### S2. Quiet output deviates from the established CLI convention
`internal/cli/token.go:352-353`. M2 is fixed, but every other command emits the resource ID
via the `printQuiet` helper (`user.go:103`, `collection.go:259`, `output.go:24`). The new
code instead writes a scopes CSV with a raw `fmt.Fprintln(os.Stdout, ...)`. Also, `"table"`
falls through to the JSON `default` arm, whereas `token list` renders a table. Neither is
wrong, but scripts that `$(ft --output quiet <verb> ...)` expecting an ID will get scopes.

**Suggested fix:**

```go
case "quiet":
	printQuiet(updated.ID.String())
```

### S3. `--add-scope '*'` remains an unguarded escalation path
Verified empirically: `mergeScopes(["task:read"], ["*"], nil, nil)` → `["* task:read"]`, no
error, and `ValidateScopes` accepts `"*"` (`scopes.go:161`). This is *explicit* operator
intent, so it is categorically different from C1's silent escalation and I am not treating
it as a defect. But it is now the only way to widen a token to full access, and it produces
a stored value (`["*","task:read"]`) that reads as restricted while actually being wildcard
(`RequireScope` short-circuits on `"*"`, `scopes.go:88`). Consider either requiring
`--set-scopes` for the wildcard, or normalising a set containing `"*"` down to `["*"]` so
the stored row is not misleading.

### S4. Misleading test name
`internal/cli/token_test.go:98`. The case is named
`"H2: add on wildcard token without remove is still silently demoting"` but asserts
**success**, and its own inline comment says "This SHOULD succeed". The name asserts the
opposite of the test. Rename to something like
`"add on wildcard token succeeds and remains wildcard"`.

### S5. `--set-scopes` does not deduplicate
`internal/cli/token.go:41-46`. Verified: `--set-scopes task:read,task:read` persists
`["task:read","task:read"]`. The add/remove path dedupes via the map, so the two branches
are inconsistent and the duplicate lands in the DB. Harmless to authorization, but it is
stored garbage.

**Suggested fix** — route `set` through the same set-building logic, or dedupe in place
before returning.

### S6. Rollout doc not updated for the new failure mode
`.design/project-log/auth-stage4-predeploy-token-update.md`. The doc's recommended
command — `ft token update <agent-token-id> --add-scope task:close` — now hard-fails for
any token with nil/empty stored scopes (the H1 guard). Agent-typed tokens minted via
`DefaultScopesForUserType("agent")` carry four scopes and are unaffected, so the primary
path still works; but legacy tokens predating scope persistence will error, and the doc
gives the operator no forewarning. The error message itself names the remedy, which is why
this is a suggestion rather than an Important. Add a short "if you see UNSCOPED_TOKEN /
WILDCARD_TOKEN" subsection, and mirror it in the command's `Long` help
(`token.go:288-296`), which currently documents none of the guard rails.

### S7. Literal `"*"` instead of `server.ScopeWildcard`
`internal/cli/token.go:59`. `server.ScopeWildcard` (`scopes.go:15`) is already imported and
used elsewhere in this file's package dependencies. Minor consistency nit.

### S8. Hand-rolled substring search in tests
`internal/cli/token_test.go:143-154`. `containsSubstr`/`searchSubstr` reimplement
`strings.Contains` (~12 lines for a stdlib one-liner), and `containsSubstr`'s length guard
is redundant with the loop bound. Replace both with `strings.Contains`.

---

## Positive Feedback

- **The extraction to a pure `mergeScopes()` is the right architectural response, not just
  the minimum patch.** Moving the security-relevant arithmetic out of the cobra `RunE`
  closure is what made C1/H1/H2 directly testable and what let me property-check the whole
  input space in seconds. This is materially better than inlining three `if` guards, which
  is what the prior review literally suggested.
- **The guard rails fail closed and explain themselves.** Each error message names both the
  hazard ("an empty scope list is interpreted as wildcard (full access)") and the remedy
  ("Use `--set-scopes` ... or `ft token revoke`"). An operator hitting these at 3am under
  incident pressure — exactly the C1 scenario — gets told what to do instead of a bare
  refusal.
- **The doc comment on `mergeScopes` (`token.go:18-26`) records the *why* for all three
  refusals.** This is the single most important thing preventing a future contributor from
  "simplifying" the guards away, since every one of them looks like an unnecessary
  restriction in isolation.
- **The H2 check is correctly scoped to `len(remove) > 0`.** A less careful fix would have
  rejected all operations on `["*"]` tokens, breaking the legitimate add-only case. The test
  suite pins that distinction explicitly.
- **The store tests verify persistence through a second read path** (`LookupToken` after
  `UpdateAPITokenScopes`) rather than trusting the value echoed back by the writer — that is
  the difference between testing the ORM builder and testing the round trip.
- **The M5 fix is behaviour-preserving and future-proofing, correctly identified as such.**
  `phaseForStage(StageBacklog)` resolves to `PhaseOpen` today (verified at `labels.go:441`),
  so the change is a no-op now and a desync-preventer later.
- **New tests follow the file's established conventions** — the `u, _ := s.CreateUser(...)`
  setup idiom matches `TestGetUser` (`identity_test.go:45`) rather than inventing a new
  style.

---

## Verification Performed

| Check | Result |
|---|---|
| Head OID matches PR #167 | Yes — `d701613` |
| `go build ./...` | Clean (exit 0) |
| `go test ./internal/cli/ ./internal/store/ ./internal/server/ ./internal/platform/github/` | All pass |
| `TestMergeScopes` (15 subtests) | All pass; C1/H1/H2 cases confirmed present and meaningful |
| `gofmt -l internal/` | `token.go`, `token_test.go`, `identity_test.go` clean; remaining hits confirmed pre-existing at `50fd8e0` |
| `go vet ./internal/cli/ ./internal/store/ ./internal/platform/github/` | Clean |
| Exhaustive property check: no empty scope write reachable | Pass (1296 combinations) |
| Working tree clean after review | Yes (temp test file removed) |

---

## Carried-Forward Follow-Ups (not blocking this merge)

1. **Store-layer defence in depth (M4 + C1 companion):** `UpdateAPITokenScopes`
   (`entstore.go:1456`) still accepts nil/empty and will happily write JSON `null`. The CLI
   is now safe, but the invariant is enforced only at the call site. Reject empty at the
   store layer so no future caller can mint a wildcard by omission.
2. **Audit logging for privileged scope changes (M4):** a scope change remains the
   least-audited privileged operation in the system.
3. **Mirrored + beads adapters still map to `StageTriage` (L1):** `github.go:237-243`,
   `beads.go:312`, and natively created tasks (`server.go:108`) remain unclaimable-without-
   `UpdateTask` after this merge. Should be resolved before the #166 deploy.
4. **M3 (non-atomic read-modify-write)** and **L3 (`.WithUser()` eager load)** — cheap
   cleanups whenever `token.go` is next touched.
5. **M6 / L2** — release-note items for the pass-through stage shift.

---

## Final Verdict

**APPROVE.**

The three blocking findings from the prior review are closed, and closed well: the fix is
structural (a pure, documented, exhaustively-tested helper) rather than a spot patch, and I
was able to prove the C1 invariant across the full input space rather than accept it by
inspection. Build, vet, gofmt, and the full relevant test suite are green.

Eight non-blocking suggestions are recorded above. **S1** (distinct error codes for bulk
rollout scripting), **S2** (`printQuiet` convention), and **S6** (rollout doc + `Long` help
do not mention the new failure modes) are the three worth folding into a cleanup pass before
the #166 deploy, since all three affect operators executing the token migration. S3–S5, S7,
S8 are polish. The follow-ups listed above should be filed as separate tasks — item 3 (L1)
in particular is a genuine deploy blocker for #166, though not for this PR.
