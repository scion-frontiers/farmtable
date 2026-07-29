# #194 round 7 (`label-write-scope-r7` @ `1d4442f`) — Code Review

Reviewer: independent code-review leg (correctness / readability / architecture / performance).
A security auditor and a test engineer reviewed the same SHA in parallel; I have not seen their work.

## Executive Summary

The A-4 fix reintroduces the exact privilege escalation #194 exists to close: a `task:write`-only
caller can set a terminal lifecycle stage on a GitHub-backed task for free, by naming the same
label in both `add_labels` and `remove_labels`. This is a **regression against the base** `6ced24e`,
where the identical request was a safe no-op. Risk: **CRITICAL**. Everything else in the diff —
M-1, M-2, the `writeLabelSwap` error propagation, and all of leg B — is sound and several parts of
it are notably good work.

## Verification performed

**Tree assertions (before anything else).** `git rev-parse --show-toplevel` = `/workspace`;
branch `label-write-scope-r7`; HEAD `1d4442f1982b6e03233f1517106d0c369af1afe6`; working tree clean.
Ancestry asserted independently with `git merge-base --is-ancestor`: `6ced24e`, `cc953e4`,
`4df2d1e`, `15b7247` all ANCESTOR; negative control `633f8f2` correctly reports not-ancestor.
Review surface `git diff --shortstat 6ced24e 1d4442f -- ':!.design'` = **16 files, +1185 / −117**,
matching the brief exactly. `git diff --name-only 15b7247 1d4442f -- ':!.design'` is **empty** —
confirmed no code changed after the merge was verified.

### Gates

| gate | expected | actual | result |
|---|---|---|---|
| `make web` | 0 | **0** | PASS |
| `go build ./...` | 0 | **0** | PASS |
| `go test ./...` | 0 | **0** | PASS — `WatchTasks` flake not hit; no re-runs needed |
| `make race` | 0 | **0** | PASS (`internal/platform/github` only, by Makefile design) |

`go vet ./...` exits 1 as the brief said. **Confirmed still exactly 4 `copylocks` findings, and
still exactly those four RPCs** (`GetReadyTasks` 1737, `GetBlockedTasks` 1847, `GetCriticalPath`
2055, `GetBottlenecks` 2232 — "assignment copies lock value to ephReq"). Pre-existing; not
introduced here. The brief's ruling stands.

**Note: all four gates pass and the whole suite is green while the Critical below is live.** The
gates are not evidence of correctness for this change.

---

## Critical

### C-1. A-4's narrowing diverges from the gate's own prediction when a label appears in BOTH `add_labels` and `remove_labels`, restoring the round-6 free terminal-stage write

`internal/platform/github/passthrough.go:1035` (`RestrictLabelWriteToSnapshot`), reached from
`internal/server/server.go:841`.

The authorization gate at `server.go:795-812` prices the edit by predicting the resulting label set
with `applyLabelDelta`, whose documented and implemented rule is **remove wins over add** for a
label named in both (`passthrough.go:978-979`, `985-1002`). `RestrictLabelWriteToSnapshot` does not
model that rule. It filters the two lists independently against the snapshot:

- `add`: keep entries **not** present on the snapshot.
- `remove`: keep entries **present** on the snapshot.

For a label `L` named in both lists and **absent** from the snapshot, that yields `add=[L]`,
`remove=[]` — so the write **adds** `L`, while the gate predicted `L` would end up absent and
therefore charged nothing.

**Exploit, on a GitHub-backed task not currently carrying the label, with a token holding only
`task:write`:**

```
UpdateTask{ add_labels: ["ft:stage/completed"], remove_labels: ["ft:stage/completed"] }
```

Gate: `before=[accepted]`, `after=[accepted]`, `SameStageSet` true → **no scope charged**.
Write: `ft:stage/completed` is applied → task is terminal to Farm Table, out of `ft ready`,
unclaimable, `Available=false Reasons=[terminal]`. Reversing it then costs `task:accept`, which the
caller does not hold. That is verbatim the escalation described in the round-6 comment at
`server.go:756-760` and pinned by
`TestUpdateTask_BothSelfServiceChainsAreDeniedAtStepOne/direction_2`.

**This is a regression, not a pre-existing hole.** I checked the base: `git show
6ced24e:internal/server/server.go` (lines 769-775) passed both lists through verbatim, and
`git show 6ced24e:internal/platform/github/passthrough.go` (lines 488-505) applied adds then
removes — so at `6ced24e` the same request resolved to "label absent" and gained the caller
nothing. A-4 turned a safe no-op into a free privilege grant.

**Evidence.** I ran a throwaway differential harness in `internal/platform/github` comparing, for
an unchanged snapshot (no race at all), the gate's predicted label set against the set the narrowed
write produces. Result: **5 of 7 cases agreed, 2 diverged** — the positive control fires, so the
detector is not stuck-at-fail, and the two failures are exactly the both-lists shape:

```
both, label ABSENT from snapshot   snapshot=[bug] add=[ft:stage/completed] remove=[ft:stage/completed]
    narrowed  add=[ft:stage/completed] remove=[]
    gate predicted labels=[bug]                  stages before=[accepted] after=[accepted] (charged=false)
    write produced labels=[bug ft:stage/completed]  actual stages after=[completed]     AGREE=false

both, absent, case-differing spellings  add=[FT:Stage/Completed] remove=[ft:stage/completed]
    ... same divergence (labelMatchKey normalises both, so case does not save it)  AGREE=false
```

The harness was deleted after the run; `git status --porcelain` is empty and I made no production
change.

Note this also falsifies two claims in the new doc comments:
`passthrough.go:1011` ("It is exactly the complement of `applyLabelDelta` and shares its matching
semantics deliberately … The two must agree") and `store.go:203`
("It must only ever narrow"). The *lists* narrow; the resulting *label set* does not — it gains a
label the gate predicted would be absent.

**Recommended fix.** Apply `applyLabelDelta`'s remove-wins rule inside the restrictor, before the
present/absent test — drop from `add` any entry whose `labelMatchKey` also appears in `remove`:

```go
removing := make(map[string]bool, len(removeLabels))
for _, l := range removeLabels {
    if key := labelMatchKey(l); key != "" {
        removing[key] = true
    }
}
for _, l := range addLabels {
    key := labelMatchKey(l)
    if key == "" || removing[key] || present[key] {
        continue // remove wins, matching applyLabelDelta
    }
    add = append(add, l)
}
```

That restores agreement in both directions: label absent → both sides dropped, net nothing (gate
said nothing); label present → `add` dropped, `remove` kept, net removed (gate said removed).
Rejecting such requests with `InvalidArgument` is a defensible alternative but is a behaviour
change for existing clients; the above is the minimal correct fix.

**Recommended test — pin the invariant, not the case.** The existing A-4 tests
(`TestUpdateTask_FreeRemovalCannotDestroyALabelTheGateNeverSaw`,
`TestUpdateTask_FreeAdditionCannotRestoreALabelTheGateNeverSaw`) are well built, with real harness
self-checks, but both are single-sided and neither can see this. The 7-case matrix in
`TestUpdateTask_LabelEditsThatInduceNoStageChangeStayTaskWrite`
(`authz_label_write_scope_test.go:1316-1380`) asserts `wantEnd` and **would** have caught it — it
simply has no row naming one label in both lists. Add the row, but more importantly add a property
test asserting the seam directly:

> for every (snapshot, add, remove), `applyLabelDelta(snapshot, RestrictLabelWriteToSnapshot(...))`
> must equal `applyLabelDelta(snapshot, add, remove)`.

That is the invariant the gate's soundness rests on, it would have caught this defect, and it
catches future drift between the two functions — which is the failure mode this file keeps
rediscovering.

---

## Required

### R-1. M-1's config load is CWD-relative and logs nothing, so the failure mode M-1 exists to fix survives

`cmd/farmtable-server/main.go:76-82`, `internal/platform/github/config.go:56`.

The wiring itself is **correct end to end** — I traced it: `LoadConfig(DefaultConfigPath)` →
`NewPlatformResolver(ghCfg)` → closure captures `cfg` → `NewPassThroughStore(token, owner, repo,
cfg, &cid)` (`passthrough.go:73-88`) → `NewLabelMapper(cfg.GitHub.Labels)` **and**
`newGraphQLClient(token, owner, repo, cfg)`. `NewPlatformResolver` has exactly one non-test caller
and it was updated. No defect in the threading.

The gap is in how the config is *located*. `DefaultConfigPath` is the **relative** path
`.farmtable/github.yaml`, and `LoadConfig` treats a missing file as "use defaults, no error"
(`config.go:67-74`). A server started by systemd/Docker with a working directory that is not the
deployment root therefore silently gets `DefaultConfig()` — an operator with a custom `push_prefix`
still has the label-write gate disarmed, and `log.Fatalf` never fires because nothing errored.

That is precisely the outcome the comment three lines above says it is preventing: *"a security
parameter that quietly reverts to a value the operator did not write is how a disarmed control
looks like a working one."* The `log.Fatalf` only covers malformed/invalid config, not
not-found-because-wrong-CWD. Note also that every other setting in this binary is env-configured
(`FARMTABLE_DB_URL`, `FARMTABLE_TOKEN`, `FARMTABLE_ENCRYPTION_KEY`), which makes a relative file
path the odd one out.

**Recommended fix.** Log the outcome unconditionally, mirroring the `"Credential encryption
enabled"` line 30 lines above that this block otherwise models itself on — state the **resolved
absolute path**, whether a file was found, and the effective `push_prefix`:

```go
log.Printf("GitHub config: path=%s found=%v push_prefix=%q", resolved, found, prefix)
```

`LoadConfig` currently cannot report `found`, so either return it or add a
`LoadConfigVerbose`/`ResolveConfigPath` helper. An operator can then confirm from the startup log
that the control is armed. Consider additionally honouring an absolute-path env var as the
documented deployment mechanism, but the log line is the part that closes the "looks like a working
one" gap and is what I am requiring.

---

## Nit / Optional

### O-1. `store.LabelDeltaLifecycleStages` is called once per step inside the `InsertTasksAfter` loop, though `collID` is loop-invariant

`internal/server/server.go:341-360`.

`collID` is parsed once at line 288 and never changes, but the M-2 check sits inside
`for i, step := range req.GetSteps()`, so each step with labels re-enters
`MultiStore.storeForCtx`. For a **native** collection `lazyResolve` issues a `GetCollection` query
and returns `nil` **without caching** (`multistore.go:107-119`), so this is one extra DB round trip
per step — a real, if small, N+1 on the common path. (GitHub collections cache in `m.platforms`
after the first call, so they pay it once.)

Resolve the store once before the loop, or hoist a single `storeForCtx`-backed check. The per-step
error message can still name `i`. Same one-extra-`GetCollection` cost applies to the new
`RestrictLabelWriteToSnapshot` call in `UpdateTask` (`server.go:841`), which now makes a second
`storeForCtx` trip after the gate's; folding both through one resolution would remove it.

### O-2. Redundant env-var handling in `connect.go`

`internal/cli/connect.go:288-289` sets `cfgPath = github.DefaultConfigPath` and then applies
`FARMTABLE_GITHUB_CONFIG` itself — but `LoadConfig` already applies that same override internally
(`config.go:62-65`). Same result, so no bug, but the duplication invites the two from drifting.
Drop lines 289-291 and let `LoadConfig` own the override. The constant swap itself (the actual
+1/−1) is a clear improvement.

### O-3. The `27 top-level tests` figure would benefit from a measurement anchor

`internal/platform/github/labels.go:367`, `stage_label_swap_scope_test.go:158`.

**I agree with your ruling: these are not stale.** Both sentences sit inside "WHAT THE PREVIOUS
VERSION DID" paragraphs and are explicitly scoped to the deleted test, so `27` is correct history.
I also agree with your residual concern, and I would spend the line: the sentence reads as a
present-tense property of the package ("turned 27 top-level tests **in this package** RED"), and a
maintainer who re-runs the mutation today gets 29 and concludes the doc is wrong. `MEASURED at
6ced24e:` costs three words and removes that. **Low, non-blocking** — your call, but I would not
drop it.

---

## FYI

### F-1. Answering brief item 2 — the ten un-discarded errors are a fix, not a regression

I traced all six `writeLabelSwap` call sites. **No caller fails where it previously succeeded in a
way a user would experience as a regression.** Specifically:

- Labels the repository does not have are dropped by `labelNamesToIDs` and are **not** an error
  (`passthrough.go:229-241`), so the most common "nothing happened" case still does not fail. This
  is what keeps the blast radius narrow, and the doc comment calls it out correctly.
- The only newly-surfaced failures are genuine mutation failures (network, permission, rate limit)
  and response-decode failures. Previously these returned success describing a state GitHub was
  never put into — including to the event `UpdateTask`'s callers publish. Surfacing them is
  strictly better.
- `ClaimTask` (`passthrough.go:659`): the label swap is the only write on that path, so an error
  means the claim genuinely did not take effect. Consistent.
- `UpdateTask`: `s.gql.updateIssue` (title/description) runs at line 466, **before** the label
  swaps, so an error now returns after a partial write. Both halves are idempotent, so a
  whole-request retry is safe. Low risk, but worth knowing.
- `writeLabelSwap` is itself non-atomic — remove runs before add, so a failure between them leaves
  the issue with no stage label. That non-atomicity is pre-existing; only its *visibility* changed.

The ordering reasoning is also correct: `p.AddLabels` and `p.RemoveLabels` deliberately stay two
separate `writeLabelSwap` calls (`passthrough.go:507-522`) so adds still precede removes, matching
`applyLabelDelta`. The comment explaining why is accurate. **Ironically, C-1 breaks the very
agreement this comment is protecting — via the restrictor rather than via the call order.**

### F-2. The mock change in `authz_terminal_reopen_test.go` is a real signal, not churn

`authz_terminal_reopen_test.go:118,125` had to switch from `clientMutationId` to
`labelable.labels.nodes` because `addLabels`/`removeLabels` decode that shape
(`graphql_queries.go:369-404`). The old mock response was producing a decode error that the `_ =`
discards swallowed. That the mock *had* to change is direct evidence the error propagation is real
and exercised. Real GitHub returns the correct shape, so this does not indicate production risk.

### F-3. Brief item 1 — the `SnapshotLabelWriteRestrictor` interface is the right call

Leg A's stated reasoning holds. The GitHub store must match case-insensitively via `labelMatchKey`
to agree with `applyLabelDelta`, while `EntStore.mergeLabels` is exact-string; a single shared
helper would be wrong for one of the two. More decisively, the *predicate itself* is
store-specific — "which parts of this edit did the gate's answer depend on?" is only answerable by
the store that knows whether labels are privileged at all. The optional-interface-plus-package-
helper shape matches `LifecycleStageSetStager` exactly, routes through `MultiStore` identically,
and the no-op default for non-implementers is correct rather than a stub. I would have done the
same. I have no alternative to propose.

The one thing I would tighten is not the interface but the contract: `store.go:203` states "It must
only ever narrow" as prose. C-1 shows prose is not enough. The property test proposed in C-1 makes
that contract executable and belongs with the interface.

---

## Positive Feedback

- **Leg B's work is the strongest part of this diff.** `ownershipTruthTable`
  (`stage_label_swap_scope_test.go:179-194`) replaces a function compared to itself with a
  hand-written literal plus `requireOwnershipTableIsTotal` and a `wantOwnershipRows` size pin —
  it catches reader/writer divergence *and* a change that moves both together, which the round-6
  version could not see. The T-F5 note in `lifecycle_stage_set_test.go:300-310` volunteering that
  the defect cost **less** than T-F5 assumed ("the second clause DID pin the value") is exactly the
  honesty this workstream needs; it would have been easy to overstate the find.
- The T-F4 correction in `lifecycle_stage_consumers_test.go` — re-attributing precedence coverage
  to `TestTerminalLabelStage_Cardinality` and explicitly telling the next maintainer *not* to add a
  redundant assertion — is unusually good comment maintenance.
- **M-2's reasoning is right.** Rejecting rather than pricing is correct: every step is created in
  `triage` and there is no `req.Stage` to authorize against, so no legitimate request is refused.
  Reusing `LabelDeltaLifecycleStages` so the check follows the operator's `push_prefix` instead of
  hardcoding `"ft:"` is the correct instinct and avoids rebuilding M-1 in a new place. It also
  matches the existing `CreateTask` pattern at `server.go:167`.
- The candour about reachability ("harmless by accident and not by design") is the right framing
  for a defence-in-depth control.

## Test Coverage

New paths are well covered with one decisive exception. `resolver_test.go` (+187) covers M-1
properly — including a test that goes through `NewPlatformResolver` rather than
`NewPassThroughStore` specifically to pin the threading. The A-4 tests exercise the real
service-over-MultiStore-over-store-over-GraphQL-mock stack with genuine harness self-checks
(`interleaves() != 1` aborts before any conclusion), which is the right construction.

**The gap is C-1**: no test names the same label in both `add_labels` and `remove_labels`. The
matrix at `authz_label_write_scope_test.go:1316-1380` is the natural home and asserts the right
thing (`wantEnd`); it is one row short. See C-1 for the row and the property test.

## Backward Compatibility

No wire-format changes; no proto changes; no fields removed or added. `NewPlatformResolver`'s
signature change is source-breaking for external callers, but it is an internal package
(`internal/...`) with one in-tree caller, already updated. `nil` remains accepted and still means
`DefaultConfig()`. Behavioural changes are the three intended ones (M-1 config now honoured, M-2
now rejects lifecycle labels, label-write errors now propagate) plus the unintended C-1.

---

## What I could not verify

- **No live GitHub.** All GitHub behaviour was verified against the in-repo GraphQL mocks. C-1's
  exploit is proven at the seam between `applyLabelDelta` and `RestrictLabelWriteToSnapshot`, and
  through the store's write ordering, but I did not fire it at a real repository. The one
  assumption it rests on is that `ft:stage/completed` exists as a repo label (otherwise
  `labelNamesToIDs` drops it) — true for any repo Farm Table has pushed to, and an attacker can
  pick any label that does exist.
- **Postgres-backed integration tests** (`-tags integration`) were not run; no live Postgres.
- **Actual deployment CWD** for R-1 — I established that the path is relative and that a miss is
  silent, not that any specific deployment misses it.
- I did not evaluate the round-8 known-open items and found no new instance of any of them.
- Test-quality and security-specific depth are the other two legs' ground by design; F-1/F-3 are my
  own findings on my axes and are not an attempt to cover theirs.

## Void runs, disclosed

- **Two void harness compilations.** My differential harness first failed to build twice: once on
  a bogus `sameStages` helper I stubbed as `return false`, and once on the module path (I wrote
  `farmtable/internal/store`; the module is `github.com/farmtable-io/farmtable`). Both were
  compile failures, not green-but-wrong runs — no conclusion was drawn from either. The
  `return false` stub is the dangerous one and is exactly the shape the standing bar warns about:
  had it compiled, it would have mislabelled the "charged" column in every log line. It was
  replaced with `store.SameStageSet` before the run that produced the evidence above.
- The scoring run carried an explicit positive control (`agreed == 0` → `t.Fatalf("VOID
  HARNESS")`). It reported 5/7 agreement, so the detector demonstrably can report "no problem" and
  the 2 failures are signal.
- No other runs were discarded. The scratch file `zz_reviewer_tmp_test.go` was deleted;
  `git status --porcelain` is empty.

## WHERE THIS BRIEF IS WRONG

1. **The framing of item 1 vs item 2 inverted the risk.** You wrote that item 2 (the ten
   un-discarded errors) "is the change in this diff most likely to have an unintended behavioural
   consequence, and it is the reason it is item 2 rather than item 6." It isn't. Item 2 is clean —
   the unknown-label case is explicitly not an error, which caps the blast radius, and every
   newly-surfaced failure replaces a silent lie. The unintended behavioural consequence is in
   **item 1**, the A-4 seam, which you framed as a design question ("is a store interface the right
   home for this?"). The interface is the right home; the *implementation inside it* is the
   Critical. Asking the architectural question invited an architectural answer and steered attention
   away from the semantics. This is the one I would most want changed for round 8: ask "does the
   new narrowing agree with the gate's own prediction function on every input?" — that question
   finds C-1 in about ten minutes.

2. **"Narrowing costs no legitimate behaviour" is repeated from the code into the brief without
   challenge.** The brief accepts leg A's premise that dropped entries "are no-ops BY DEFINITION".
   That is true for each list *considered independently*, which is exactly the reasoning error
   behind C-1: the gate's prediction is computed on the two lists **jointly**, via
   `applyLabelDelta`, with remove-wins. A brief that had asked for the joint property rather than
   restating the per-list one would have caught this.

3. **Minor, on your `go vet` instruction.** You said "Verify the count is still exactly 4 and still
   those four RPCs — that is the usable signal, not the exit code." Verified, and both hold. But
   the count alone is not sufficient either: 4 findings in those 4 functions would also be the
   output if a new `copylocks` were introduced in one of them while another was fixed. I checked
   the messages are all still "assignment copies lock value to ephReq", which pins it. Worth
   folding into the instruction.

4. **Not wrong, confirmed.** The `27 top-level tests` ruling, the ancestry set (including the
   negative control), the 16-file / +1185 / −117 surface, the empty post-merge code delta, and the
   `go vet` characterisation all check out exactly as stated. The `make web`-first note is correct
   and saved a wasted cycle.

---

## Final Verdict

**REQUEST CHANGES**

C-1 (Critical) and R-1 (Required) both block merge. C-1 in particular must not land: it reopens
the exact escalation this PR series exists to close, and it does so in the fix intended to close
the last remnant of it, with a green test suite. O-1/O-2/O-3 are non-blocking and can be dispositioned
in a cleanup pass.

Given that C-1 is an authorization bypass reachable from an ordinary RPC, I recommend the
dispatching agent route the fix — and specifically the proposed
`applyLabelDelta(snapshot, narrowed...) == applyLabelDelta(snapshot, raw...)` property test —
past the security auditor before round 8 closes. That is a recommendation; the escalation decision
is yours.
