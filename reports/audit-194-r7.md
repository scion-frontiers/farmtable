# Security Audit — #194 round 7 (combined)

- **Tree:** `/workspace`, branch `label-write-scope-r7`, HEAD `1d4442f1982b6e03233f1517106d0c369af1afe6`, working tree clean.
- **Base:** `6ced24e`. Ancestry asserted with `git merge-base --is-ancestor`: `6ced24e`, `cc953e4`, `4df2d1e`, `15b7247` all ancestors; negative control `633f8f2` correctly **not** an ancestor (rc=1).
- **Surface (excl. `.design/`):** 16 files, +1185 / −117 — matches the brief exactly.
- **Threat model applied as briefed:** privilege escalation *between authenticated principals* inside the IAP boundary. IAP is credited with nothing below, and nothing below is described as internet-exposed.

## Summary

> **SUPERSEDED IN PART — read ADDENDUM 1 and ADDENDUM 2 at the end of this file before citing
> anything here.**
> - A cross-list bypass (**C-1**, Critical) was withheld from my brief by design and disclosed
>   after I reported. It defeats the §1 negative claim below, which is valid **only** as scoped to
>   the single-label, single-list spelling axis. §2's conclusion is revised in Addendum 1.
> - The finding filed below as **HIGH is re-rated MEDIUM** in Addendum 2: it rested on the premise
>   that M-1 was live in production, which is **false** — M-1 is unmerged, and the deployment
>   structurally cannot mount a GitHub config file even after it merges.
> - Addendum 2 also **withdraws** my Addendum 1 claim that the proposed property test is vacuous.
>   It is not; it catches C-1 against the real implementation. I had never run it against the real
>   implementation.

| Severity | Count |
|---|---|
| Critical | **1** (C-1, Addendum 1 — not found by me) |
| High | 0 |
| Medium | **2** (cross-table collision, re-rated in Addendum 2; unvalidated `req.Type`) |
| Low | 1 |
| Info | 2 |

**Verdict as originally filed:** the A-4 fix holds on the axis I searched; §3's lead is
**CONFIRMED**, and one fix in this same diff (M-1) is what makes it reachable in the server binary
for the first time.

**Corrected verdict:** A-4's *reported* shape is closed, but the control is bypassable via a
cross-list request the gate prices at nothing (**C-1, Critical**). §3's lead remains **CONFIRMED**
but is **Medium**, dormant while M-1 is unmerged and no config can be mounted, and returns to High
on the first deployment that mounts one — so its fix is a **merge gate on M-1**, not sprint work.

**Top r8 item is C-1, not my finding:** C-1 needs no operator config and is reachable under
`DefaultConfig()`.

---

## Gates

| Gate | Result |
|---|---|
| `make web` | **0** |
| `go build ./...` | **0** |
| `go test ./...` | **0** (no `WatchTasks` flake observed on this run) |
| `go vet ./...` | **1** — exactly **4** `copylocks`, in exactly `GetReadyTasks` (:1737), `GetBlockedTasks` (:1847), `GetCriticalPath` (:2055), `GetBottlenecks` (:2232). Confirmed still 4, still those four RPCs. |
| `make race` | **0** — but it runs `go test -race ./internal/platform/github/` **only**, not the whole tree. It gives no race coverage of `internal/server` or `internal/store`, both of which this diff changes. Noted, not filed as a finding. |

---

## §1 — Does A-4's fix actually close A-4?

**Method.** A harness in-package (`internal/platform/github`) driving the real
`RestrictLabelWriteToSnapshot` and the real `labelNamesToIDs`/label-index lookup, with one
shared detector run in two modes: `restrict=false` reproduces the pre-fix path, `restrict=true`
is HEAD. A verdict differing between the two is attributable to the control and nothing else.
Harness preserved at `reports/audit-194-r7-harness.go.txt`; it was **deleted from the tree**
(`git status` clean — no production code modified).

**Positive controls (both fired, before any negative claim):**

```
POSITIVE CONTROL fired (pre-fix path):  UNPRICED REMOVE of ft:stage/wont_fix
POSITIVE CONTROL fired (re-add, pre-fix): UNPRICED RE-ADD of ft:stage/wont_fix
```

**Result: 19 evasion spellings × 2 directions (remove and re-add) = 38 attempts, 0 bypasses.**
Attempted: exact, upper, mixed case, leading/trailing/both spaces, tab, newline, NBSP, empty
string, whitespace-only, Turkish dotless ı, Turkish dotted İ, Kelvin sign, Cyrillic-о homoglyph,
fullwidth, combining accent, trailing NUL, zero-width space. Degenerate snapshots (`nil`, `[]`)
also fail closed on the remove side.

**Why it fails, specifically** — this is the load-bearing reason, not "looks correct":

A bypass needs one string that is simultaneously (a) matched by `labelMatchKey` against a label
the snapshot *does* carry, so the restrictor keeps it, and (b) resolved by `labelNameToID` to a
*different* label — the one to be destroyed. That requires the two normalisations to **diverge**.

They nearly do:

- `labelMatchKey` (passthrough.go:1061) = `strings.ToLower(strings.TrimSpace(x))`
- `labelNameToID` (passthrough.go:201) = `s.labelIndex[strings.ToLower(name)]`, and the index is
  built as `index[strings.ToLower(l.Name)]` (passthrough.go:166) — **no `TrimSpace`**.

So there is a real asymmetry, but it is **oriented the safe way**. Padding a name makes the
restrictor *more* likely to match (it trims) and the writer *less* likely to resolve (it does
not), so padding can only cause a label to be dropped, never redirected. Both sides share
`strings.ToLower`, so every Unicode case-fold — including the Kelvin-sign and Turkish-İ folds —
moves both in lockstep. Homoglyphs fold in neither, so they miss `present` and, on the remove
side, are discarded.

The remove side fails **closed** (unmatched ⇒ dropped); the add side fails **open** (unmatched ⇒
kept), but an add that misses `present` is by definition one the gate *did* price. The asymmetry
is correctly chosen.

**Disable-by-omission (leg A's stated bar): no.** The control takes no caller-supplied parameter.
Its only inputs are the server-side snapshot and the lists it filters. There is nothing to omit,
send empty, or re-case. Leg A's rejection of `p.Version` was correct and the replacement does not
reintroduce the property it was rejected for.

---

## §2 — Where the control is BOUND

Path-by-path, with the gate named. All eight sites are in `internal/platform/github/passthrough.go`;
**the store layer has no authorization of its own** — every gate is in `internal/server/server.go`.

| # | Site | Reached by | Gate | `task:write` alone? |
|---|---|---|---|---|
| 1 | :477 `StageLabelSwap` | `UpdateTask` | `RequireScope(ScopeTaskWrite)` :590, `RequireCollectionAccess` :604, **`TransitionScope`+`RequireScope` :679/:680** | **Yes**, for transitions the table prices at `task:write` (e.g. `accepted→in_review`, and every `from==to` short-circuit) |
| 2 | :488 `PriorityLabelSwap` | `UpdateTask` | :590, :604 only — **no `TransitionScope`**; only `validateDefinedEnum` :690 | **Yes, unconditionally** |
| 3 | :499 `TypeLabelSwap` | `UpdateTask` | :590, :604 only — **no `TransitionScope`, no validation at all** | **Yes, unconditionally** |
| 4/5 | :513/:521 add/remove labels | `UpdateTask` | :590, :604, `TransitionScope`+`RequireScope` :804/:808, **plus `RestrictLabelWriteToSnapshot` :840** | Yes, for edits leaving the stage set unchanged — but then narrowing empties the lists and the site is not reached |
| 6 | :662 `StageLabelSwap`→working | `ClaimTask` | `RequireScope(**ScopeTaskClaim**)` :942, `RequireCollectionAccess` :956 | **No** |
| 7/8 | :764/:772 raw `gql` | `CloseTask` | `RequireScope(**ScopeTaskClose**)` :997, `RequireCollectionAccess` :1008 | **No** |

**So "the other paths are ungated" is NOT the finding, exactly as the brief predicted.** Sites 6–8
are gated by strictly stronger scopes than `task:write`. Site 1 is gated by the transition table.

**The narrower question — could the control live in `writeLabelSwap`?**

**No, not as the code is currently shaped, and the reason is substantive rather than stylistic.**
`RestrictLabelWriteToSnapshot` must narrow against *the snapshot authorization was evaluated
against* — `existing`, read in the server at server.go:600. `writeLabelSwap` is a store-internal
helper whose only view of issue state is `currentLabels := issueLabels(target)`, a **fresh read**
taken inside the store call. Narrowing against that fresh read is precisely the defect the fix's
own doc comment rules out ("Consulting a fresh read here would be the defect again with a shorter
window"). To bind at `writeLabelSwap` you would have to thread the authorized snapshot from the
server, through `store.UpdateTaskParams`, into every store implementation and down to the helper.

**Cost of doing it properly:** a new field on `UpdateTaskParams` carrying the authorized snapshot;
a contract that every `Store` must populate and honour it; and the risk that a store which forgets
it silently gets no narrowing — a fail-open default, which is the failure mode #194 keeps
rediscovering. **Binding at the server, where the snapshot and the gate already sit together, is
the correct call.** I would not change it.

**But there is a real consequence, and it is §3.** Because the control cannot live at the narrow
point, sites 2 and 3 — reachable with bare `task:write`, with no transition gate at all — are
covered by nothing. Under the default configuration that is harmless. Under a plausible
configuration it is not. That is the finding below.

**Where the brief is wrong on this point:** see WHERE THIS BRIEF IS WRONG, item 1.

---

## §3 — Confirm or kill leg A's UNCONFIRMED lead: **CONFIRMED**

Leg A could not build a colliding config. **I built one, and then built a much more plausible one.**

**Mechanism.** `stripForMatch` (labels.go:677) lowercases, strips the push prefix, then strips
`stage/`, `priority/`, `priority:`. So `ft:stage/wont_fix` → **`wont_fix`** — the bare stage name,
which is exactly the key the default stage table uses (labels.go:135). `PriorityLabelSwap`
(labels.go:435) and `TypeLabelSwap` (labels.go:484) decide what to *remove* by testing that same
stripped key against `labelToPriority` / `labelToType`. **Nothing prevents a key from being in two
tables at once:** `GitHubConfig.Validate` (config.go:102) calls `checkAliasKeyCollisions` once per
table, **separately** (config.go:129-140) — it never compares keys *across* tables.

**Default config: no collision — the lead is killed for the shipped defaults.** Priorities are
`urgent/high/normal/low`; types are `bug/feature/task/design`; no stage name appears in either.
Measured: `PriorityLabelSwap` removes `[priority:low]`, `TypeLabelSwap` removes `[bug]` — no stage
label touched.

**Plausible operator config: confirmed.** `duplicate` is simultaneously a Farm Table lifecycle
stage **and** a label GitHub creates in every new repository. An operator mapping their stock
GitHub labels onto Farm Table types writes this, mentioning no stage anywhere:

```yaml
github:
  labels:
    enabled: true
    types:
      duplicate: chore
```

Measured at HEAD:

```
Validate ACCEPTS types:{duplicate: chore}
TypeLabelSwap(feature) on ["ft:stage/duplicate","bug"]
    add=[feature]  remove=[ft:stage/duplicate  bug]
```

**A maintainer's `ft:stage/duplicate` is destroyed by `UpdateTask(type=feature)` — a request that
costs bare `task:write` and is priced by nothing.** `RestrictLabelWriteToSnapshot` does not apply:
it is invoked only on `req.AddLabels`/`req.RemoveLabels` at server.go:840, whereas this write is
generated inside the store from the `p.Type` arm.

A more contrived config confirms the same in all three directions, including **forging**:

```
types:      {"ft:stage/wont_fix": bug}     -> TypeLabelSwap(bug) on a clean issue ADDS ft:stage/wont_fix
priorities: {"ft:stage/completed": high}   -> PriorityLabelSwap(low) REMOVES ft:stage/completed
```

This is A-4's primitive exactly — free, blind, retryable, unpriced — through a door the new
control does not cover.

---

## Findings

### [HIGH] Lifecycle-stage labels are destroyed and forged via the ungated `priority`/`type` arms of `UpdateTask`, under a plausible operator config

- **Location:** `internal/platform/github/labels.go:435` (`PriorityLabelSwap`), `:484`
  (`TypeLabelSwap`); reached from `internal/server/server.go:689-698`; config gap at
  `internal/platform/github/config.go:129-140`.
- **Description:** `Validate` checks alias-key collisions *within* each of `stages`, `priorities`,
  `types`, never *across* them. `stripForMatch` maps a stage label onto its bare stage name, so a
  `types` or `priorities` key equal to a stage name (e.g. `duplicate`, a stock GitHub label) makes
  the priority/type swaps treat lifecycle labels as their own to rewrite. Those two arms of
  `UpdateTask` carry no transition gate and are not covered by `RestrictLabelWriteToSnapshot`.
- **Impact:** A principal holding only `task:write` erases or forges the label that *is* the
  authoritative lifecycle stage for a GitHub-backed task — revoking a maintainer's `duplicate`/
  `wont_fix` decline, or marking any task terminal. Reversal costs `task:accept`, which the caller
  does not hold. Same escalation A-4 described.
- **Proof of concept:** measured above; harness at `reports/audit-194-r7-harness.go.txt`,
  `TestAudit_StockGitHubLabelCollision`.
- **Newly reachable *because of this diff*:** before M-1, `NewPlatformResolver()` hardcoded
  `nil` cfg (`resolver.go:26` at `6ced24e`), so the **server binary always ran `DefaultConfig()`**
  and a custom `types` map never reached the server store — the collision was unreachable
  server-side. M-1 (shipped, live in production) correctly starts honouring operator config, and
  in doing so opens this path for the first time. **A security fix in this diff enables this
  finding.** That interaction is the reason I rate it High rather than Medium.
- **Recommendation:** reject cross-table key collisions in `Validate`, and refuse any
  `types`/`priorities` key that normalises onto a lifecycle stage:

```go
// in Validate, after the per-table checks
stageKeys := map[string]bool{}
for _, s := range allStages {
    stageKeys[strings.ToLower(s.String())] = true
}
for _, tbl := range []struct{ field string; entries map[string]string }{
    {"priorities", labels.Priorities}, {"types", labels.Types},
} {
    for _, key := range sortedKeys(tbl.entries) {
        if n := m.stripForMatch(key); stageKeys[n] {
            return fmt.Errorf(
                "github.labels.%s key %q normalises to %q, which is a lifecycle stage. "+
                    "A %s entry on a stage key makes UpdateTask(%s=...) rewrite the label that "+
                    "carries the authoritative stage, with no transition scope charged. "+
                    "Rename the key or remove the entry",
                tbl.field, key, n, tbl.field, strings.TrimSuffix(tbl.field, "ies")+"y")
        }
    }
}
```

  Defence in depth (independent of config): make the swaps refuse to emit a lifecycle label they
  do not own, by testing `authorizationStage` — the same predicate `StageLabelSwap` already uses at
  labels.go:402 — and skipping any such label in the priority/type remove loops.

### [MEDIUM] `UpdateTask(type=<arbitrary string>)` strips type labels with no validation

- **Location:** `internal/server/server.go:696-698`; `internal/platform/github/labels.go:475-505`.
- **Description:** `req.Type` is an open-ended caller-supplied string assigned with **no
  validation whatsoever** (contrast `stage` and `priority`, which both get `validateDefinedEnum`).
  For an unknown type `TypeToLabel` returns `""`, so nothing is added — **but the remove loop still
  runs**, stripping every type label on the issue. Measured under default config:
  `TypeLabelSwap("totally-unknown-type")` removes `[bug]`.
- **Impact:** a `task:write` caller silently destroys triage metadata on any GitHub-backed issue,
  repeatably, with a value that names nothing. Not a stage label under default config, so not an
  authorization bypass on its own — but it is the same free-blind-retryable shape, and it is the
  amplifier for the High above.
- **Recommendation:** when `newLabel == ""` because the type is unknown, return `nil, nil` rather
  than a remove-everything list, and reject unknown types at the RPC boundary.

### [LOW] `CloseTask` does not validate that `req.Stage` is terminal

- **Location:** `internal/server/server.go:1013-1026`, reaching `passthrough.go:757`.
- **Description:** `CloseTask` passes `req.Stage` straight through without checking it is a
  terminal stage. A caller holding `task:close` can close an issue and stamp it with a
  *non-terminal* stage label.
- **Impact:** limited — `task:close` is already the strongest scope in this area, so this is
  misuse by an authorized principal, not escalation. But it produces a closed issue carrying e.g.
  `ft:stage/working`, exactly the state `ComputeAvailability`'s `ClosedAt` arm exists to paper
  over, and it is written *by Farm Table* rather than by drift.
- **Recommendation:** validate `phaseForStage(stage) == task.PhaseClosed` in `CloseTask` and
  reject otherwise.

### [INFO] `ft connect` pass-through runs with every gate disabled

- **Location:** `internal/cli/connect.go:299-306`.
- **Description:** this in-process gRPC server is built **without** `server.TokenAuthInterceptor`,
  unlike connect.go:166, `cmd/farmtable-server/main.go:116` and `cli/dashboard.go:90`. So
  `authEnforcedKey` is never set and *every* gate enumerated in §2 — including
  `RequireCollectionAccess` — returns nil.
- **Why Info:** pre-existing, untouched by this diff (connect.go's only change here is the
  `DefaultConfigPath` constant), and the listener is a `bufconn`, so it is process-local and not
  network-reachable. Recording it because the §2 table is otherwise easy to over-read as
  describing all deployments.

### [INFO] Unwired adapters call `UpdateTask` with no scope check

- **Location:** `internal/platform/github/github.go:94`, `internal/platform/beads/beads.go:124`.
- Both call `store.UpdateTask(..., uuid.Nil)` with params that set `Stage` **and** `AddLabels`
  (github.go:203-208), with no authorization. I could find **no production constructor** for
  either — `github.New`/`NewWithConfig` are referenced only from `github_test.go:274`. Dead today;
  a live wiring would be a Critical. Worth a comment saying so.

---

## §4 — What in this diff silently depends on scopes being non-empty?

Taking the fail-open branch two as given and not re-filing it.

**Nothing in this diff is silently *broken* by it, and one thing is notably robust to it.**

- **`RestrictLabelWriteToSnapshot` (the A-4 fix) is not a scope check.** It is an unconditional
  narrowing that runs identically whatever the credential's scopes are. **It is the one control
  added by #194 that does not evaporate under the live NULL-scopes credential.** That is a genuine
  and under-stated merit of this design over a scope-based fix.
- **M-2's `InsertTasksAfter` rejection is not a scope check either** — it returns
  `InvalidArgument` (server.go:345-353) regardless of scopes. Also live under the live credential.
- **Everything else in the label area *is* computed and discarded** for that credential: the
  transition gate (server.go:678-684) and the label-delta gate (server.go:801-809) both terminate
  in `RequireScope`.
- **`RequireCollectionAccess` still works** under the live credential. Branch two is
  `len(scopes) == 0`; the collection-access fail-open is the *open-access* branch, which the
  coordinator measured as inactive. Cross-collection isolation is intact.

**The correctness that does quietly depend on non-empty scopes is the diff's own narrative.**
`RestrictLabelWriteToSnapshot` is documented throughout as "the second half of the round-5
invariant" — the half that narrows an edit *the gate already priced*. Under the live credential
the gate prices **nothing**: every `RequireScope` returns nil, so no label edit is ever refused,
and the narrowing is not the second half of the invariant, it is the **whole** of it. A reader of
store.go:199-215 or server.go:815-838 would conclude two independent controls are in force where
there is currently one. That is the load-bearing risk: not a broken control, but a comment set
that will be cited in a future review to justify relaxing something.

**Recommendation:** add one sentence to the `SnapshotLabelWriteRestrictor` doc noting that the
pricing it complements is only in force for a credential with non-empty scopes.

**Remediation order, as requested:** **grant scopes to the live dashboard credential → verify
traffic under the properly-scoped token → only then remove branch two.** Removing branch two first
breaks the live dashboard immediately.

---

## What I could not verify

- **No live GitHub API access.** Every §1/§3 result is measured against the real
  `RestrictLabelWriteToSnapshot`, `labelNamesToIDs`, `LabelMapper` and `Validate`, with the label
  index populated directly. I did **not** confirm that GitHub's own label-name matching agrees
  with `strings.ToLower` for the Unicode cases (Kelvin sign, Turkish İ). If GitHub folds
  *differently* from Go, a divergence could exist that my harness cannot see. This is the single
  largest gap in the §1 negative result and I flag it as such.
- **No end-to-end gRPC exploit.** §3 is confirmed at the `LabelMapper`/`Validate` layer and traced
  to the RPC by reading, not by driving a real `UpdateTask` against a live pass-through store.
  The gate enumeration backing that trace is reported per-line in §2.
- **`make race` covers one package.** It passed (0), but it only race-tests
  `internal/platform/github`. The `MultiStore.RestrictLabelWriteToSnapshot` routing added at
  `multistore.go:302` and the `server.go` call site got **no race coverage** from the briefed
  gates. I did not independently race-test them.
- I did not evaluate the r8 known-open items as categories, per the brief.

## Void runs

- **1 void run.** First harness compile failed: I imported
  `github.com/farmtable-io/farmtable/internal/task`, which does not exist (correct path is
  `internal/store/ent/task`). Caught by the compiler, no numbers produced.
- **1 near-void, caught by a prerequisite.** My first §3 colliding config reported
  `PriorityLabelSwap add=[] remove=[]` and I nearly recorded it as a partial kill. It was vacuous:
  I had requested the value the issue already carried, so both swaps short-circuited on
  `raw == newLabel`, and my `priorities` key (`completed`) did not match the issue's label
  (`wont_fix`). I added explicit `t.Fatalf` prerequisites asserting the colliding keys are actually
  present in `labelToType`/`labelToPriority` and that the requested value differs, then re-ran.
  **The corrected run is the CONFIRMED result.** Recording this because the void version would
  have read as a clean, confident kill of §3.
- One harness assertion (`go test` exit 1) is an intentional `t.Errorf` — it is the confirmed
  finding, not a failure of the harness.

## WHERE THIS BRIEF IS WRONG

1. **§2 calls `writeLabelSwap` "the narrowest point every path must traverse". It is not, and the
   brief contradicts itself two lines earlier.** The same section correctly records **2 raw
   `gql.addLabels`/`removeLabels` calls outside the helper, both in `CloseTask`**. Those two sites
   (passthrough.go:764, :772) never enter `writeLabelSwap`. It is traversed by **6 of 8** sites.
   Binding the control there would therefore *not* have covered every path even if the snapshot
   had been available — a fact that materially weakens the premise the section asks me to test.
   (It happens not to matter, because `CloseTask` requires `task:close`; but the stated reason for
   preferring `writeLabelSwap` is wrong as written.)
2. **§4 says `RequireScope` has two fail-open branches and frames branch two as the live exposure.
   Accurate for `RequireScope`, but it omits that the *first* branch's condition
   (`authEnforcedKey == nil`) also disables `RequireCollectionAccess` (scopes.go:102) — the
   cross-collection isolation control.** This does not change the production picture, since
   open-access is measured inactive and the live credential trips only branch two. But the brief's
   framing invites the reader to think the open-access branch costs only scope checks, when it also
   costs tenant isolation. Relevant to whoever drafts the remediation.
3. **Minor:** §2 gives the binding as `server.go:840`. The identifier is on :840 and the call
   expression spans :840-841; the assigned results are consumed at :842-847. Not an error, noted
   only so the next leg's grep does not "fail" to reproduce a one-line match.

Items measured by the brief that I independently **confirmed correct**: the 16-file / +1185 / −117
surface; ancestry including the negative control; 6 `writeLabelSwap` call sites; 2 raw `gql` calls,
both in `CloseTask`; 1 `RestrictLabelWriteToSnapshot` in the request path; exactly 4 `copylocks`
findings in exactly the four named RPCs; `make web` required before `go build`.

## Positive observations

- **The fix is bound at the only layer that holds both the gate and the snapshot**, and the
  decision not to consult a fresh read is correct and correctly justified. This is the right call
  and I would not move it.
- **The remove side fails closed and the add side's fail-open is sound** — the asymmetry is not
  accidental and holds under every evasion I could construct.
- **`writeLabelSwap` propagating ten previously-discarded errors is a real security improvement**,
  not just hygiene: silent write failure is what made A-4 invisible.
- **The A-4 fix is scope-independent**, so it survives the live NULL-scopes credential — the only
  control in #194 that does.
- **M-2 rejects rather than prices**, and reuses `LabelDeltaLifecycleStages` so it follows the
  operator's prefix instead of hardcoding `ft:`. Refusing is the right choice for an endpoint with
  no stage to authorize, and it is a control a future implementer trips over.
- **M-1 is a genuine fix** — a gate that was silently disarmed for exactly the operators who
  customised their prefix was worse than no gate. The finding above is not an argument against it.
- The `labels.go` comment retracting round 6's false guarantee, with the measurement showing the
  old test stayed green while 27 others went red, is exactly the right way to handle a control
  discovered to be vacuous.

## Recommendations

1. Fix the cross-table collision in `Validate` (High, code above) — and pair it with the
   `authorizationStage` ownership check in the priority/type swaps, so correctness does not depend
   solely on config validation.
2. Validate `req.Type` at the RPC boundary and stop `TypeLabelSwap` stripping labels when it has
   no label to add.
3. Grant scopes to the live dashboard credential, verify, **then** close fail-open branch two —
   in that order.
4. Add the "pricing only applies with non-empty scopes" caveat to the
   `SnapshotLabelWriteRestrictor` doc.
5. Consider a `Store`-level invariant test asserting that no code path outside
   `RestrictLabelWriteToSnapshot`'s coverage can emit a label matching `authorizationStage` — that
   would have caught this round's High mechanically.

---
---

# ADDENDUM — C-1 cross-list bypass, withheld counterexample

Added after the coordinator disclosed a counterexample deliberately withheld from the brief.
Verified independently from source at `1d4442f`; the coordinator's account is **correct in every
particular**. Tree clean, no production code modified. Harness updated in place at
`reports/audit-194-r7-harness.go.txt`.

**My §1 negative claim was wrong.** It should have read: no bypass *on the single-label,
single-list spelling axis*. I stated it unqualified. That is the error, and it is mine.

## 1. What the UNMODIFIED harness reports: **nothing**

Fed `add=["ft:stage/completed"], remove=["ft:stage/completed"]` with the detector untouched:

```
ORIGINAL DETECTOR on cross-list input: exploit=false detail=""
REAL GATE: before=[ft:stage/accepted bug] after=[ft:stage/accepted bug] (equal -> charged nothing)
RESTRICTOR returns add=[ft:stage/completed] remove=[]
STATE AFTER WRITE:  [ft:stage/accepted bug ft:stage/completed]
CONFIRMED C-1: gate charged nothing, write changed state
```

**It says nothing — silently.** Note carefully: it is *not* that the harness could not express the
input. `detect(...)` already took both lists; I passed the counterexample with zero changes and it
returned `exploit=false`. The same line, with the real gate substituted as oracle, fires
immediately. **The input space was adequate. The oracle was not.**

Mechanism confirmed at source: `applyLabelDelta` (passthrough.go:986-989) builds `removed` from the
remove list *first* and skips any key in it — remove wins — so `before == after` and nothing is
charged. `RestrictLabelWriteToSnapshot` (passthrough.go:1030) filters the two lists in two
independent loops with no cross-list test, so the add survives and the remove is dropped.

## 2. Why I missed it — I think your diagnosis is right in outcome and wrong in mechanism

You proposed form (8): a closed enumeration bound to the axis where the bug was last found. **The
conclusion is correct. The causal story is not, and the difference changes the remedy.**

Your account is that my enumeration *could not express* the input. It could, and did, and still
reported clean — I demonstrated exactly that above. So "widen the input space" would not have
saved me.

**The actual defect: I hand-rolled a proxy oracle instead of using the real gate.** My detector
encoded "what did the gate charge?" as `present[labelMatchKey(l)]` — a test that is *per-label and
per-list*. The real gate's pricing is *joint across both lists*. Any defect living in the
interaction between the lists is structurally invisible to a per-label oracle **regardless of how
many spellings I enumerate**. Nineteen or nineteen thousand, same result.

That inverts the causality in your diagnosis. The one-dimensionality of my search was a *symptom*,
not the cause: I enumerated spellings because **spellings were the only thing my oracle could
discriminate**. The oracle silently defined the reachable search space, and then I mistook
saturation of that space for coverage. Turkish dotless ı and the Kelvin sign are what
thoroughness looks like when it is aimed down the only axis your instrument can read.

The sharpest version, and it is not flattering: **the production docblock says "It is exactly the
complement of applyLabelDelta ... The two must agree."** I quoted the surrounding docblock in my
report — and then built a verification oracle that independently reimplemented the very function
the docblock said must agree. **I committed inside my harness the identical error the code
committed.** The bug and the audit that missed it have the same shape.

Generalisable rule, which I would apply to r8: **when auditing a control whose contract is
"mirrors function F", the oracle must BE F. Never a reimplementation of F.** With `applyLabelDelta`
as oracle, a two-element input space catches C-1.

**A limit of the standing "positive control" bar, worth surfacing.** Both my positive controls
fired — and both were drawn from the *old bug's* axis. A positive control proves the detector is
not dead; **it does not calibrate the detector's oracle, only the axis the control is drawn from.**
Mine licensed a negative claim far broader than what they actually validated. Stronger practice:
draw positive controls from a *different* axis than the one being searched, or mutation-test the
control (break it N ways, require the harness to catch all N). A single positive control from the
axis under test is exactly how a one-dimensional search acquires the appearance of exhaustiveness.

## 3. The proposed fix and pin — fix is sound, **pin is vacuous**

### Fix: sound, no residual found

`fixedRestrict` = drop from `add` any entry whose `labelMatchKey` also appears in `remove`, before
the present/absent test. Closes C-1 (`add=[] remove=[]`). Eight attempts to break the fixed form,
**0 residual** — including case-split across lists (`add:"ft:stage/completed"` /
`remove:"FT:STAGE/COMPLETED"`), pad-split, duplicate-in-add, empty-key entries, and legitimate
priced edits which correctly pass through unchanged.

**One implementation caveat, load-bearing:** the cross-list test **must** use `labelMatchKey`, not
`==`. With string equality the case-split and pad-split rows above both bypass it. The proposal as
worded says "labelMatchKey", which is right — flagging it because it is the one place a reviewer
could "simplify" it into a live vulnerability.

### Pin: **vacuous — it cannot fail for the bug it exists to catch**

Proposed: `applyLabelDelta(snap, Restrict(snap, add, remove)) == applyLabelDelta(snap, add, remove)`.

**The identity function satisfies it.** Substituting `Restrict = identity` makes both sides
literally the same expression. Identity is not a hypothetical — **it is precisely the pre-fix A-4
code**, in which both lists went through verbatim. Measured:

```
A-4 original (remove absent)  identity(pre-fix) -> P1(proposed)=true
A-4 re-add   (add present)    identity(pre-fix) -> P1(proposed)=true
C-1 cross-list                identity(pre-fix) -> P1(proposed)=true
```

**P1 was `true` in all 8 rows of the matrix — it never discriminated anything.** A property test
that goes green on the exact defect the round exists to fix is worse than no test: it is precisely
the round-6 false guarantee this very diff retracts in `labels.go` ("A guarantee a maintainer
budgets against, and which cannot fail, is worse than none"). **Shipping it would re-commit, in
r8, the error r7 spent a comment block apologising for.**

Why it is empty: the proposed property states only *safety* — narrowing breaks no authorized
behaviour. It says nothing about *efficacy* — that narrowing actually removes the unpriced
primitive. Doing nothing is maximally safe.

### The missing half — measured, not asserted

Add a minimality property: every entry the restrictor **returns** must be non-vacuous against the
snapshot.

```go
// P2: no returned entry may be a no-op against the snapshot.
for _, a := range add {
    k := labelMatchKey(a)
    if k == "" || present[k] || removeKeys[k] { return false } // already there, or cancelled by remove
}
for _, r := range remove {
    k := labelMatchKey(r)
    if k == "" || !present[k] { return false }                 // never carried it
}
```

Measured, `P1 && P2`:

| input | pre-fix impl | fixed impl |
|---|---|---|
| A-4 original | **REJECTED** | accepted |
| A-4 re-add | **REJECTED** | accepted |
| C-1 cross-list | **REJECTED** | accepted |
| legitimate priced edit | accepted | accepted |

**Ship both properties, not P1 alone.** P1 is the no-regression half and is worth keeping; P2 is
the half that has any security content. P2 alone catches all three defects with no false positive
on the legitimate edit.

**Structural alternative, stronger than either.** The root cause is that the restrictor *mirrors*
`applyLabelDelta` by hand, so the two can always drift again — C-1 is that drift, and the docblock
asserting they agree is what made the drift invisible. Derive rather than mirror: compute
`after := applyLabelDelta(snapshot, add, remove)`, then emit the minimal `(add, remove)` carrying
`snapshot → after`. Agreement then holds by construction, no property test required, and no future
change to `applyLabelDelta` can desynchronise them.

## 4. Interaction with my HIGH: **two findings, one root cause — and it revises my §2**

**Your reading is correct: C-1's fix does not touch my HIGH.** Confirmed by tracing:

| | C-1 | my HIGH |
|---|---|---|
| Label origin | caller's `req.AddLabels`/`RemoveLabels` | generated **inside the store** from the `p.Type`/`p.Priority` arms |
| Snapshot used | server's authorized snapshot | store's **fresh read** (`issueLabels(target)`) |
| Passes the restrictor? | yes, server.go:840 | **never** |
| Fixed by the cross-list filter? | yes | **no — untouched** |

They are **two findings and must be tracked separately.** Both are r8 blockers on independent
paths; fixing C-1 leaves my HIGH fully live, and vice versa.

But they share one root cause worth naming, because it predicts the *next* instance: **"which
labels are lifecycle labels, and what did the gate charge for them" is answered in four places by
four different predicates** — `applyLabelDelta` (labelMatchKey, joint); `RestrictLabelWriteToSnapshot`
(labelMatchKey + present, per-list — C-1 lives here); `StageLabelSwap` (`authorizationStage`
ownership); `PriorityLabelSwap`/`TypeLabelSwap` (`labelToType`/`labelToPriority` key membership — my
HIGH lives here). Every round of #194 has found a fresh disagreement among these four. There will
be a fifth.

### This partially revises my §2 answer, and I want that on the record

I concluded that the control **could not** live at `writeLabelSwap`. That is correct **only for
snapshot narrowing**, which genuinely requires the server's snapshot. I over-generalised it to
"nothing can bind there".

**A different and weaker invariant can bind there, and it needs only the mapper `writeLabelSwap`
already holds:** refuse to write any label `authorizationStage` claims, unless the caller is a
path entitled to move the stage. Concretely, give `writeLabelSwap` an explicit
`stageWriteAllowed bool` set only by the stage arm, `ClaimTask` and `CloseTask`, and have it drop —
or better, error on — any owned stage label otherwise.

That is a genuine single-point control at the narrow seam, and **it fixes my HIGH structurally**:
the priority/type arms become *incapable* of touching a lifecycle label whatever the operator's
config says, so the cross-table collision degrades from privilege escalation to a cosmetic config
error. It is defence in depth for C-1 too. I would rate it above the config-validation fix I
proposed in the main report, and I now think it is the single highest-value change available for
r8. My original §2 answer should be read as scoped to snapshot narrowing only.

## Corrected verdict

- **C-1 is a Critical** on the round-7 diff: unpriced terminal-label application under bare
  `task:write`, retryable, reversal costs `task:accept`. Regression introduced this round — at
  `6ced24e` both lists went through verbatim and the request netted to nothing.
- My **HIGH stands, unaffected**, on an independent path.
- My §1 "0 bypasses" result stands **only** as scoped to the single-label single-list spelling
  axis, and should be cited nowhere without that qualifier.
- The proposed **pin must not ship as specified**.

---

# ADDENDUM 2 — corrected M-1 premise, severity re-rate, and a correction to MY OWN addendum

## A. I was wrong about the pin. It is not vacuous.

**Before the severity question, a correction that is mine and that I found by testing the thing
you asked me to test.** In Addendum 1 I wrote "PIN IS VACUOUS ... it never discriminates anything."
**That is false, and your reading is correct: the property catches both C-1 and the case-folding
gap.** Measured against the **real HEAD implementation**, which I had never run it against:

| input | REAL HEAD impl | identity (pre-fix A-4) | case-blind mutant | fixed |
|---|---|---|---|---|
| C-1 cross-list | **P1=false** ✅ | P1=true | **P1=false** | P1=true |
| A-4 remove-absent | P1=true | **P1=true** ❌ (P2=false) | P1=true | P1=true |
| A-4 re-add-present | P1=true | **P1=true** ❌ (P2=false) | P1=true | P1=true |
| case-variant remove | P1=true | P1=true | **P1=false** ✅ | P1=true |
| legit priced edit | P1=true | P1=true | P1=true | P1=true |

**P1 fails on C-1 against the real implementation, and fails on the case-blind mutant.** Your
cost/benefit read is right and mine was wrong.

**How I got it wrong, because the shape matters more than the correction.** I evaluated P1 against
only two implementations — `identity` and my `fixed` form — neither of which exhibits a
snapshot-visible divergence. Observing "P1=true in all 8 rows" I concluded the property never
discriminates. But that was a property of **the implementation set I happened to enumerate**, not
of the property. **I committed, inside the addendum, the identical error I had just finished
diagnosing in the main report** — a conclusion silently bounded by a set I chose, presented as a
general claim. Twice in one audit, on the same axis. That is worth more to r8 than the finding.

**The property's actual blind spot, stated precisely.** P1 quantifies over outcomes *against the
snapshot only*. So it catches every defect where the narrowed write applied to the snapshot differs
from the gate's prediction — C-1 and case-folding are both of that kind. It cannot catch a
narrowing failure that is a **no-op against the snapshot** but not against drifted remote state.
That is exactly the A-4 class, which is why `identity` sails through. **The property misses the
bug the function was written for, and catches the regression introduced while fixing it.** The
blind spot is structural, not a matter of missing inputs: no additional test case closes it,
because the quantifier itself is snapshot-relative.

**Revised recommendation: ship P1 — it is worth well more than its price — and ship P2 alongside
it.** P1 covers over-/mis-narrowing, P2 (no returned entry may be a no-op against the snapshot)
covers under-narrowing. Measured, P2 rejects `identity` on both A-4 shapes with no false positive
on a legitimate edit. Neither alone is sufficient; together they cover all four known defect
shapes. My "must not ship as specified" verdict in Addendum 1 is **withdrawn** — it should read
"must not ship *alone*".

## B. Question 5 — re-rating with the corrected facts: **HIGH → MEDIUM**

Thank you for the correction; and for what it is worth, the brief's sentence read naturally as
"the fix is live", and I hardened it into a load-bearing premise without going to `origin/main` to
check a fact I was relying on for a severity rating. I should have verified it. That is a real
lesson for me independent of who wrote the ambiguous sentence: **a fact doing rating work has to be
measured, not inherited.**

**I land on Medium.** Not reflexively — your HOLD argument is the strongest one available and I
want to say exactly where I think it succeeds and where it does not.

**Where your argument fully succeeds.** "Unreachable in this deployment" and "M-1 does nothing in
this deployment" *are* the same fact. The exposure and the benefit genuinely do arrive in one act.
It follows that the Validate fix **must ship with M-1, not after it** — I accept that completely
and it is now recorded as a merge gate below. Your argument is decisive about **ordering**.

**Where I do not think it reaches severity.** It is an argument about *coupling*, and coupling is a
scheduling property. Severity in the rubric I am working to is exploitability × impact **in the
system as it would be deployed**. Rating it as if merged today: still not exploitable, because the
deployment structurally cannot express the precondition — no `.farmtable/` at any Dockerfile layer,
`FARMTABLE_GITHUB_CONFIG` absent, volumeMounts null. That is three independent things that must
change, one of which is infrastructure that does not exist.

I also want to resist a specific temptation: **holding it at High to force sequencing would be
using severity as a scheduling lever.** Downstream, "High" is read as "exploitable now", and this
is not. Corrupting the label to carry an ordering signal degrades every other High in the queue.
The correct instrument for "must not merge without its fix" is a merge gate, which costs nothing
and says the thing precisely.

**One argument for High I considered and rejected, but which is better than the one you put:** for
a *pre-merge* audit, everything in the branch is "not live" by definition, so discounting for
non-liveness would make a High impossible to ever file. That is sound — and it is why "M-1 is
unmerged" is **not** part of my reasoning for lowering. The mitigator that actually bites is the
**deployment shape**, which is an infrastructure fact, not a branch fact, and which persists
unchanged after merge.

**Rating: MEDIUM — returning to HIGH on the first deployment that mounts a GitHub config file.**
The trigger is objective and someone should be able to act on it without re-reading this report.

## C. Does the order change? Yes — and not only the label

The corrected facts **reorder the top of the queue**, which the severity label alone would not have
conveyed:

1. **C-1 (Critical) — first, and now unambiguously so.** It needs **no operator config at all**; it
   is reachable under `DefaultConfig()` on any GitHub pass-through collection. Previously I had my
   cross-table finding as the top r8 item. It is not. C-1 is.
2. **Ship P1 ∧ P2 with C-1's fix** (§A above).
3. **`writeLabelSwap` ownership assertion** — still high value: it fixes my finding *structurally*,
   independent of any config validation, and is defence in depth for C-1.
4. **Validate cross-table check — gated to the M-1 merge.** Not "next sprint": a blocking condition
   on the commit that makes operator config reach the server store.

**One knock-on worth flagging:** my MEDIUM (`req.Type` unvalidated, strips type labels) needs **no
config file** and is reachable under `DefaultConfig()` today. With the cross-table finding correctly
lowered to Medium, that unvalidated-`req.Type` finding is now the **more immediately reachable** of
my two, despite both sitting at Medium. If only one of my findings gets r8 budget, it should be
that one.

**What does not change:** the M-1-interaction observation itself remains correct and is the reason
the merge gate exists — I would only restate it as "M-1 *will* open this path when it merges" rather
than "has opened it". The mechanism was right; the tense was wrong.
