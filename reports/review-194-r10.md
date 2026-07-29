# #194 round 10 — `label-write-scope-r10` @ `6d8f19e` — Code Review

Range reviewed: `06f01d7..6d8f19e` (4 commits, 9 files, +1076/−38).
Tree confirmed: `git rev-parse HEAD` = `6d8f19e11f4ddbfdc313301199006d3f7c76eb1c`,
`git rev-parse --show-toplevel` = `/workspace`.
Axis: correctness, architecture, readability, truthfulness of self-description.

## Executive Summary

The diff reopens the exact privilege-escalation class #194 exists to close. **A principal
holding only `task:write` can mark an ordinary open, available task terminal and
unavailable, for free, provided the issue already carries one extra label of a shape the
diff newly recognises.** Measured end to end through `UpdateTask` at `6d8f19e` and refused
at `06f01d7`. Risk: **CRITICAL**.

The root cause is a reasoning error the diff states explicitly and the brief endorses:
`lifecycleStageClaim` really is a strict superset of `authorizationStage` (verified over
8400 cells), but `lifecycleStagesForLabels` computes a **difference** of two evaluations,
and widening a predicate on *both* endpoints of a difference is not conservative — it
merges states that were previously distinguishable, and a merged pair prices at nothing.

---

## Critical

### C-1. Widening the BEFORE endpoint makes the terminal-conversion class free again

`internal/platform/github/passthrough.go:1100-1108`, `lifecycle_claim.go:184-211`.

**Measured, HEAD vs base, same probe, `internal/server` fixture, real store, real
`UpdateTask`:**

| fixture (issue labels) | issue state | narrow principal adds | `06f01d7` | `6d8f19e` |
|---|---|---|---|---|
| `["ft2:stage/completed"]` | CLOSED / `not_planned` | `ft:stage/completed` | **DENIED** `task:close` | **ALLOWED** |
| `["ft2:stage/completed"]` | OPEN | `ft:stage/completed` | **DENIED** `task:close` | **ALLOWED** |
| `["completed"]` | OPEN | `ft:stage/completed` | **DENIED** `task:close` | **ALLOWED** |
| `["shipped-it:completed"]` | OPEN | `ft:stage/completed` | **DENIED** `task:close` | **ALLOWED** |

Narrow principal = `{task:read, task:write}` — the same `narrowPrincipal` the diff's own
new matrix test uses. Config = `DefaultConfig()`, i.e. `Enabled=true`, `push_prefix: "ft:"`.
No config change, no toggle, no operator edit is involved.

Observed consequence on the OPEN rows, read through the production seams
(`store.LifecycleStages`, `ms.ComputeAvailability`):

```
before:  stages=[accepted]   available=true
after :  stages=[completed]  available=false      err=<nil>
```

That is verbatim the harm the diff's neighbouring comment (`server.go:803-807`) describes
as the thing this control exists to prevent: *"add_labels=[ft:stage/completed] marked ANY
task terminal to Farm Table — out of `ft ready`, unclaimable, Available=false
Reasons=[terminal] — with reversing it then costing task:accept, which the caller does not
hold."* It is now free.

**Mechanism.** `LabelDeltaLifecycleStages` charges only when
`!SameStageSet(before, after)`. Both endpoints go through `lifecycleStagesForLabels`, and
the diff widened both. On the `["completed"]` row:

- base: `AllTerminalLabelStages(["completed"])` → `nil` (no `ft:` prefix, `authorizationStage`
  refuses) → `IssueToPhaseStage` demotes the open issue → `before = [accepted]`.
  `after = [completed]`. Differ → `accepted→completed` → `task:close` → refused.
- HEAD: `canonicalLifecycleLabels(["completed"])` → `["ft:stage/completed"]` →
  `AllTerminalLabelStages` → `before = [completed]`. `after = [completed]`.
  `SameStageSet` → **no charge at all**.

The widened predicate pulled the before-endpoint *up to* the after-endpoint. The read side
was deliberately left unwidened, so the read side still reports `accepted` before and
`completed` after — the value the gate is supposed to protect changed, and the gate did not
see it, because the gate is now measuring a different quantity than the one it protects.

**Precondition reachability.** The masking label is any label whose *suffix* names a stage:
a bare `completed`, a legacy `ft2:stage/…` left over from a `push_prefix` change (the exact
scenario this round was commissioned for), or an innocuous third-party label such as
`shipped-it:completed`. Applying it needs no Farm Table privilege — the diff's own comment
at `server.go:814-819` concedes that a maintainer with GitHub triage rights edits labels
outside this process entirely. Note the attacker does not even need the label to be
plausible: it is not displayed as a lifecycle label by the read side, so it is invisible in
the UI.

**Impact before severity, as required.** Not covered indirectly. `assertStageWriteAllowed`
does not fire — the caller-supplied `add_labels` arm is `stageWriteAllowed` by design.
`RestrictLabelWriteToSnapshot` does not fire — the label is genuinely absent from the
snapshot, so the addition is a real change and is passed through. There is no other gate
between `UpdateTask` and the mutation. This is a straight regression against `06f01d7`.

**Suggested fix.** Do not widen a difference symmetrically. The price must be monotone in
the predicate, and there are two shapes that give you that:

1. *Minimal, matches the round's intent.* Evaluate the endpoints **twice** — once under the
   read predicate (`authorizationStage`, today's config) and once under the claim predicate
   — and charge the strongest scope implied by **either** evaluation, treating "the sets
   differ" as "they differ under either view". This can only ever refuse more than base, by
   construction, because the base behaviour is one of the two arms. It is about six lines in
   `LabelDeltaLifecycleStages`.
2. *Structural, and what I would rather see.* Keep the AFTER endpoint config-blind and pin
   the BEFORE endpoint to the read side's own answer. The invariant a write gate wants is
   "the value the read side will report must not change without payment", so the before
   endpoint should be *the read side's value*, full stop — not a hypothetical.

Whichever is chosen, the test that must ship with it is the one the new matrix is missing:
a row whose **fixture already carries** an unrecognised lifecycle-shaped label. Every axis
in `configBlindAxes()` starts from an empty label set, which is precisely why the matrix is
green on a tree that has this hole.

---

## Required

### R-1. Data race: `LabelMapper.writeView` is lazily mutated on a shared, cached mapper

`labels.go:110-114`, `lifecycle_claim.go:172-181`.

`writeViewMapper()` writes `m.writeView` under no lock. Before this diff `LabelMapper` was
immutable after `NewLabelMapper`, which is why there is no mutex to reach for; this is the
first mutable field.

The mapper is not per-request. `MultiStore.lazyResolve` (`internal/store/multistore.go:107-153`)
**caches** the `GitHubPassThroughStore` in `m.platforms[collectionID]` and hands the same
pointer to every subsequent request, and every gRPC handler runs on its own goroutine. Two
concurrent `UpdateTask` calls against the same collection at `enabled=false` both reach
`canonicalLifecycleLabels` → `writeViewMapper` → the unsynchronised store.

**Measured:** `go test -race` on eight goroutines calling `canonicalLifecycleLabels` on one
`enabled=false` mapper reports `WARNING: DATA RACE` (5 distinct reports, read at
`lifecycle_claim.go` `m.writeView == nil` racing the write at `m.writeView = …`). Not
currently caught because no existing test drives the mapper concurrently.

**Suggested fix.** Delete the laziness rather than lock it. Build the view eagerly in
`NewLabelMapper`:

```go
if !cfg.Enabled {
    asIfEnabled := cfg
    asIfEnabled.Enabled = true
    m.writeView = NewLabelMapper(asIfEnabled)   // terminates: that one has Enabled=true
}
```

The field becomes write-once-at-construction and the struct is immutable again. This is
strictly better than a `sync.Once`: it removes the concept rather than guarding it, and it
also deletes the "Termination:" paragraph the current comment needs in order to be
readable. Cost is one small mapper per disabled-mapping store, built once.

### R-2. "axis 2 … CLOSED" is false. The claim is blind to prefix *value* only for colon-delimited, slash-free prefixes

`lifecycle_claim.go:55-59`, `stripAnyLifecyclePrefix` at `:196-209`; log D3 line 166.

`stripAnyLifecyclePrefix` strips one leading `<segment>:` where `<segment>` contains no `/`,
plus one leading `stage/`. Anything else is not namespaced and returns `false`.

**Measured claim boundary** (`m.lifecycleStageClaim`, `Enabled=true`, default config):

```
"ft2:stage/completed"        -> (completed, true)     "ft-stage/completed"       -> ("", false)
"anything:stage/completed"   -> (completed, true)     "ft.stage/completed"       -> ("", false)
"completed"                  -> (completed, true)     "team/ft:stage/completed"  -> ("", false)
":completed"                 -> (completed, true)     "x:y:completed"            -> ("", false)
```

And these are not hypothetical prefixes. `GitHubConfig.Validate()` rejects only a
whitespace-only `push_prefix`. **Measured:** `Validate()` returns `nil` for `push_prefix:
"ft-"` and for `push_prefix: "team/ft:"`, and under `push_prefix: "ft-"` the label
`ft-stage/completed` **is** authoritative — `LifecycleStages` reports `[completed]`.
End to end at `6d8f19e` under today's default config, the narrow principal adding
`ft-stage/completed`, `ft.stage/completed` or `team/ft:stage/completed` is charged nothing,
while `ft2:stage/completed` is charged `task:close`.

So the mechanism is neither a prefix allow-list nor a suffix property (see the brief-errors
list, item 3): it is a **syntactic delimiter rule**, and it silently assumes every
`push_prefix` a deployment will ever adopt ends in `:` and contains no `/`. That assumption
is not enforced anywhere.

**Suggested fix.** Pick one and say which:
- Enforce the assumption — `Validate()` requires `push_prefix` to match
  `^[^/:]+:$` — and then the axis-2 claim becomes true by construction and the delimiter
  rule becomes a checked invariant rather than a hope. This is the "make the bad state
  unrepresentable" move, and the mechanism that makes it bite is `Validate`, which the
  server binary does reach via `LoadConfigWithSource`.
- Or downgrade the comment from "CLOSED" to "closed for colon-delimited prefixes", and add
  the un-covered shapes to the open-finding list.

Note this is not the same defect as C-1 and does not go away when C-1 is fixed.

### R-3. The C1 correction installs a new false sentence in the opposite direction

`terminal_label_stages.go:73-74`:

> "So the true scope of the toggle is narrower than round 9 stated: it governs what a label
> MEANS to the read path, **and it governs nothing else**."

**Measured false.** At `enabled=false`, with no other change:

```
enabled=true   StageToLabel(working)="ft:stage/working"  StageLabelSwap add=[ft:stage/working] rm=[ft:stage/accepted]
                                                         PriorityLabelSwap add=[priority:high] rm=[priority:low]
                                                         TypeLabelSwap add=[feature] rm=[bug]
enabled=false  StageToLabel(working)=""                  StageLabelSwap add=[] rm=[]
                                                         PriorityLabelSwap add=[] rm=[]  TypeLabelSwap add=[] rm=[]
```

The toggle governs label **emission** as well as read meaning — six guards' worth, which the
diff's own project-log table (D2 rows 4-9) classifies as WRITE-SUPPRESSION in the same
commit. The corrected comment therefore contradicts the diff's own analysis, and it is the
exact failure mode the brief flagged: a correction that over-rotates. Round 9 said the
toggle governs *everything*; round 10 says it governs *only reads*; the truth is it governs
reads-meaning and writes-emission and does not govern write-*authorization*, which is the
distinction the whole round turns on.

**Suggested fix.** Replace the sentence with the three-way statement the D2 table already
supports: the toggle governs (a) what a label means to the read path and (b) whether this
deployment emits labels at all; it does not and must not govern (c) what a label write
costs.

### R-4. "…so this substitution can only ever refuse more, never allow more" is a non-sequitur, and it is false where it matters

`passthrough.go:304-306`, restated in `lifecycle_claim.go:72-76` and log D3 line 135.

The antecedent is **true** and I verified it as a property, not on examples: an 8400-cell
sweep over 7 push-prefix values × 3 `Stages` configs × both toggle settings × all 10 stages
× 5 spellings, asserting `authorizationStage(l) = (s, true) ⟹ lifecycleStageClaim(l) = (s, true)`.
Zero violations; 720 cells where both fire and 4480 where only the claim fires, so the
sweep is not vacuous.

The consequent does not follow. "Refuses more labels" implies "refuses more writes" only for
a gate that is a *filter over labels* — which `assertStageWriteAllowed` is, and there the
claim holds. `lifecycleStagesForLabels` is not a filter; it is one half of a difference, and
C-1 is the counterexample. Leaving this sentence in place is worse than leaving it out,
because it is the sentence that will stop the next reader from checking.

**Suggested fix.** Scope the claim to `assertStageWriteAllowed` explicitly, and state the
pricing property separately and only once it is actually true — i.e. after C-1 is fixed, as
"the price is monotone in the predicate because it is a max over both evaluations", with
the reason named.

---

## Nit / Optional

- **N-1 (Optional).** `canonicalLifecycleLabels` computes the claim on `m` and the
  replacement spelling on `view`. It is correct — `labelToStage` is identical in both
  because `NewLabelMapper` builds it before consulting `Enabled` — but the reader has to go
  verify that to know it. Use `view` for both, or say in one line why the receiver differs.
- **N-2 (Nit).** The matrix row named `axis3_configured_alias_while_disabled` is not axis 3.
  It sets `Enabled=false` with an alias the operator has **already** configured, which the
  file's own header correctly calls axis 1 behaviour ("Current aliases ARE honoured"). Axis 3
  is a *future* alias and is declared not closable. The name will make the next reader
  believe axis 3 has a passing row. Rename to `axis1_enabled_false_with_configured_alias`.
- **N-3 (Nit).** `executed++` in the two new counter guards is incremented in the loop body
  rather than inside `t.Run`, so it counts table rows rather than executed subtests. It
  catches the emptied-table case it was written for, so this is not blocking, but
  incrementing inside the closure would make the counter mean what its name says.

## FYI

- **F-1.** Project log D1 (lines 23 and 36) attributes `labels.go:393` to `MapLabelsToStage`.
  At the base SHA `labels.go:393` is `StageLabelSwap`'s guard; `MapLabelsToStage`'s guard is
  at `labels.go:249`, which is what the same document's D2 table row 1 says. `StageLabelSwap`
  is not on the `LabelDeltaLifecycleStages` path at all, so arm E almost certainly unguarded
  the right function and cited the wrong line. A false sentence on a correct measurement —
  and it propagated verbatim into the review brief.
- **F-2.** Separation of read and write is clean at the call-site level, as claimed. Grep
  confirms `lifecycleStageClaim`, `writeViewMapper`, `canonicalLifecycleLabels` and
  `writeView` are consumed only by `assertStageWriteAllowed` and `lifecycleStagesForLabels`;
  nothing on the read path touches them. C-1 is not a leak — it is the write side being
  wrong on its own terms.
- **F-3.** The widening of `assertStageWriteAllowed` to bare stage names is in the
  fail-closed direction and I found no denial-of-legitimate-work from it. The new
  `TestLabelWriteScope_PriorityAndTypeAxesDoNotPriceStages` covers that direction with a
  real positive control.

## Positive Feedback

- The four-cell matrix in `authz_config_blind_write_scope_test.go` is the best test artefact
  this workstream has produced. Naming the wildcard column as a positive control, and stating
  in the file which single cell can falsify, makes the suite interpretable by someone who was
  not there. It is genuinely unlucky that the fixture shape it standardised on is the one
  shape that cannot see C-1.
- C2 is exemplary: the leg found a comment whose named mutant proved the opposite of the
  claim, and **fixed the sweep rather than the prose**, then wrote down that the padded
  `snapVocab` entry and the `removeKeys` paragraph are one artefact in two files. The
  16384→32768 count is self-consistent with a 4→5 vocabulary entry, so the arithmetic checks
  out from the outside.
- Refusing the READ/WRITE/UNREACHABLE vocabulary was correct, and I checked it on its merits
  rather than taking it: the write-suppression category is real and measured (see R-3's
  table). Making those six guards config-blind, as the supplied vocabulary instructed, would
  have made a deployment with label mapping off start pushing `ft:stage/…` labels to its
  issues.

## Test Coverage

New code paths are covered, but the coverage has a shape-shaped hole. Every fixture in
`configBlindAxes()` starts from an issue with **no labels**, so the suite only ever exercises
deltas where the before-endpoint is derived from state, not from a label. C-1 lives entirely
in the case where the before-endpoint is derived from a label the diff newly recognises. The
missing rows:

1. Fixture carries an unrecognised lifecycle-shaped label; narrow principal adds the
   deployment's own label for the *same* stage. Must be refused. (Currently allowed.)
2. Same, on a CLOSED / `not_planned` issue, so the state-reason default and the label claim
   disagree. Must be refused. (Currently allowed.)
3. A monotonicity property, not an example: for a sweep of (labels, add, remove) triples,
   `scope_HEAD ≥ scope_base` pointwise. That is the property the diff claims and it is
   mechanically checkable; it would have caught C-1 without anyone guessing the fixture.
4. `go test -race` over concurrent `LabelDeltaLifecycleStages` on one cached store, for R-1.

`TestExternalUnavailableLabel_IsToggleBlind` is well constructed and non-vacuous. The two
new `executed` counters do what they claim.

## Backward Compatibility

No proto, wire-format or field changes. Behaviour changes for `enabled=false` deployments
(the write side now prices labels the read side ignores) are intended and documented. The
read side is byte-identical. The new `writeView` field is unexported and unserialised.

## Gates

Re-measured at `6d8f19e`, not taken from the brief.

| gate | brief says | measured, clean checkout | measured, with `web/dist` |
|---|---|---|---|
| `go build ./...` | 0 | **1** — `assets.go:5:12: pattern all:web/dist: no matching files found` | 0 |
| `go vet ./...` | 1, four copylocks | 1, **but the sole message is the `web/dist` error** | 1, exactly the four `assignment copies lock value to ephReq` at `server.go:{1782,1892,2100,2277}` |
| `go test ./... -count=1 -skip TestWatchTasks` | 0 | (blocked) | **0**, no FAIL lines |

`web/dist` is untracked and `.gitignore`d (`dist/`), so materialising it leaves
`git status --porcelain` empty. With it present all three rows reproduce exactly as the
brief reports, and `go vet` says nothing attributable to this diff.

**Re-measured with genuine assets after the EM's correction arrived** (see Addendum). My
first pass satisfied the `//go:embed all:web/dist` pattern with a placeholder
`index.html`; the EM proposed a real `npm ci && npm run build`. Both work and both give
identical Go results, which is expected — no Go code under test reads the *content* of
the embedded FS, so the embed only needs the directory to be non-empty. For the record,
against a real Vite build (`npm ci` exit 0, 59 packages; `npm run build` exit 0,
`dist/index.html` + `assets/` + 2053 copied items):

```
go build ./...                              exit 0, zero output lines
go vet ./...                                exit 1, exactly the four ephReq copylocks
                                            at server.go:{1782,1892,2100,2277}, nothing else
go test ./... -count=1 -skip TestWatchTasks exit 0, 32 ok/no-test-files, zero FAIL lines
```

`npm ci` and `npm run build` both succeed in this container, so the EM's proposed remedy
is available to other legs. `web/dist` and `web/node_modules` were both removed afterwards
to leave the tree exactly as found.

Two traps worth recording. First, `go build ./... | tail` reports `$?` from `tail`, not from
`go` — my first measurement read exit 0 and was wrong, which is the "every zero needs a
positive control" rule biting on the exact command the baseline block warns about. Second,
the vet row is more dangerous than a non-reproduction: on a clean checkout `go vet` still
exits **1**, so a leg checking the exit code alone would tick the row as reproduced while
the four copylock messages were never emitted.

---

## Deliverable 2 — suffix vs prefix, and `Priorities` / `Types`

**Suffix vs prefix: neither, and the third option is the answer.** The shipped code is not
a prefix allow-list and not a suffix match. It is a **delimiter rule**: strip at most one
leading `<segment>:` in which `<segment>` contains no `/`, then at most one leading
`stage/`, then require what remains to be a key in `labelToStage`. Within that rule the
prefix *value* is genuinely irrelevant — `ft:`, `ft2:`, `anything:` and even a bare `:` all
price identically, and it is a property rather than an enumeration, so it does not become
incomplete as new prefixes appear. It fails outside that rule: a prefix with any other
delimiter (`ft-`, `ft.`), a prefix containing a slash (`team/ft:`), or two namespace
segments (`x:y:`) are all invisible to it, and all three are legal `push_prefix` values
today that produce authoritative labels. Measured; see R-2.

Against the restated bound — "price by suffix regardless of prefix" — the code **meets it
for colon-delimited prefixes and misses it otherwise**. So the restatement and the leg's own
reading largely coincide, contrary to what the brief expects, but they coincide on a
sub-domain neither of them names.

**`Priorities` and `Types`: considered, ruled not-applicable, and pinned.** This is a fourth
option the brief did not offer, and I checked it rather than taking it. `TransitionScope`
prices stages only; a `Priorities` or `Types` key cannot make a label name a stage; the
cross-table capture (a priority/type key aimed at a lifecycle label) is refused at load time
by `checkLifecycleKeyCollisions`, which the server binary does reach via
`LoadConfigWithSource` → `Validate`; and it is backstopped structurally at `writeLabelSwap`
for the two arms that could otherwise reach it. `TestLabelWriteScope_PriorityAndTypeAxesDoNotPriceStages`
carries a real positive control for the negative claim. **The defect does not reproduce on
them**, and I could not construct a case where it does. This part of the round is correct.

## Deliverable 3 — the strict-superset claim

**The property is TRUE. The safety conclusion drawn from it is FALSE.**

Superset verified as a property over 8400 cells (7 prefixes × 3 `Stages` configs × 2 toggle
settings × 10 stages × 5 spellings + fixed extras), zero violations, non-vacuous at 720
agreeing and 4480 widening cells. It holds by construction, and the construction is visible:
`lifecycleStageClaim`'s first branch is exactly the lookup `authorizationStage` performs
after its two extra guards, so the claim cannot refuse anything the read predicate accepts.

The conclusion — "so this substitution can only ever refuse more, never allow more" — is a
non-sequitur, and C-1 is the measured counterexample. It holds for `assertStageWriteAllowed`,
which is a filter over labels. It fails for `lifecycleStagesForLabels`, which is one half of
a difference. See R-4.

## Deliverable 4 — three-cause collapse: patch or converge

**Symptom, not property — and the diff made it worse rather than converging it.**

The three "necessary contributors" are three evaluations of one question ("is this label
lifecycle-authoritative?") sitting on one call path: `AllTerminalLabelStages` →
`authorizationStage` for the terminal scan, and `MapLabelsToStage` for the
`IssueToPhaseStage` fallback. Nothing about the *defect* requires three sites. The defect
requires that the path consult the question three times and that all three answers be
suppressed together, which is a fact about the path, not about the hazard.

The diff's response was to add a fourth evaluation (`lifecycleStageClaim`) plus a
translation layer (`canonicalLifecycleLabels`) that rewrites the input so the existing three
evaluations return the desired answer. That is the opposite of convergence: the codebase
previously had four answers to "which labels are lifecycle labels" — a number
`assertStageWriteAllowed`'s own deleted comment was worried about — and now has five, with
the fifth reached through a rewriting step. C-1 is a direct consequence: the rewriting is
applied uniformly to both endpoints of a difference, which nobody would do if the question
were answered once.

**The convergence I would rather see.** One predicate, returning both bits:

```go
func (m *LabelMapper) labelClaim(raw string) (stage task.Stage, authoritativeNow, couldBeAuthoritative bool)
```

Read paths consume `authoritativeNow`. The write gate consumes both: it charges the strongest
scope over the transition computed under *each* bit, which is monotone by construction and
makes C-1 unrepresentable rather than detected. The mechanism that makes it bite is that the
two-arm max is a single function with a single test, not a discipline every caller must
remember — the same argument the diff correctly makes for `asIfEnabled` over twelve
toggle-blind accessor variants, applied one level up.

I do not think this diff should have shipped three patches. I do not think it should have
shipped the rewriting layer either.

## Deliverable 5 — splitting the config flag (labelled: DESIGN OPINION)

**Yes, split it — and note that splitting it deletes the mechanism that carries R-1 and
half the reasoning that carries C-1.**

`github.labels.enabled` currently means two things: *do not emit our labels* (six guards:
`StageToLabel`, `PriorityToLabel`, `TypeToLabel`, and the three `*LabelSwap`s — measured in
R-3) and *do not honour anyone's labels* (six guards: the three `MapLabelsTo*`,
`TerminalLabelStage`, `authorizationStage`, `AllTerminalLabelStages`). Those are independent
operator intentions. "Farm Table should stop stamping labels on my issues" and "Farm Table
should stop believing labels on my issues" are different requests, and an operator today
cannot express either one without also expressing the other.

Concretely: `github.labels.push` and `github.labels.honour`. The emission guards key on
`push`; the read-meaning guards key on `honour`; and the write-**authorization** question
keys on neither, because what a label could cost is not a display preference.

The payoff is not tidiness. The whole `asIfEnabled` / `writeViewMapper` / `writeView`
apparatus exists only to reconstruct a mapper in which the *read-meaning* guards are off
while the operator has asked for the *emission* guards to be on. Split the flag and that
reconstruction has nothing to reconstruct: the write path just asks the mapper it already
holds. `writeView` disappears, R-1's data race disappears with it, and one of the two
premises behind C-1 — "the write side must see something the read side does not" — is
narrowed to the genuine residue, which is prefix-value blindness.

Three rounds of this defect are downstream of the conflation. I would fix the flag before
building anything else on top of the reconstruction.

## Deliverable 6 — where this brief is wrong

1. **The gate table's `go build ./...` = 0 does not reproduce**, and the `go vet` row
   reproduces its *exit code* for the wrong reason. On a clean checkout of `6d8f19e`, build
   exits 1 and vet exits 1 emitting only `assets.go:5:12: pattern all:web/dist: no matching
   files found` — zero copylock messages. The baseline block pre-empts the *build* row
   ("pre-existing, task #100") but the vet row is the more dangerous one, because a leg
   checking exit codes gets a match while the four messages the block tells it to verify by
   text were never produced. All three rows reproduce exactly once `web/dist` exists.
   **The EM self-corrected this after I had filed** (see Addendum) and asked that it stay in
   the ledger, which it does — but their correction and I differ on the failure mode, and
   mine is the worse one. They describe a leg that finds no copylocks and "would reasonably
   conclude something is badly wrong." That is the *loud* failure; it self-announces. The
   quiet one is that `go vet` **still exits 1** with `web/dist` absent, so a leg checking the
   exit code the table hands it records the row as reproduced and never reads the message.
   The block's own "match by MESSAGE, not by count" rule is the thing that saves you, and it
   only fires if you apply it to a row that already looks green.
2. **The central safety framing has a false converse baked in.** "If it is not a strict
   superset, the fix can *allow* a write that was previously refused." The predicate **is** a
   strict superset (8400 cells, zero violations) and the fix **does** allow a write that was
   previously refused. Checking the property the brief named, and only that, produces an
   APPROVE on a tree carrying C-1. This is the single most consequential error in the brief:
   it named a necessary condition and treated it as sufficient.
3. **"Suffix regardless of prefix" vs "a bounded set of prefixes" is a false dichotomy.**
   The shipped mechanism is a third thing — a syntactic delimiter rule — and it has the
   failure mode of neither: it is a property rather than an enumeration, so it does not go
   stale, but it is a property of the label's *shape* rather than of its suffix, so it has a
   silent domain restriction (R-2). The brief's two options both had me looking for the
   wrong kind of bug.
4. **`labels.go:393` is not `MapLabelsToStage` and is not reached via the `IssueToPhaseStage`
   fallback.** At the base SHA `labels.go:393` is `StageLabelSwap`'s guard, which is not on
   the `LabelDeltaLifecycleStages` path at all; `MapLabelsToStage`'s guard is at
   `labels.go:249`. Inherited from the leg's log, which contradicts itself between D1 and D2
   (see F-1). The measurement behind the three-cause finding is fine; the citation is not.
5. **"The leg implemented against its own reading, not against this one" is only half right.**
   For colon-delimited prefixes the shipped code implements the restated suffix bound
   exactly, including bare suffixes with no prefix at all. Where it departs from the
   restatement is a case the restatement does not anticipate either. The two readings mostly
   coincide, which the brief explicitly says it has not measured — so this is a correction,
   not a gotcha.
6. **"Judging the diff against the new bound is the single most valuable thing you can do in
   this round."** Measured: it was not. Judging the diff against the new bound yields R-2, a
   Required. The Critical came from asking a question the brief did not pose — whether the
   *price* is monotone in the predicate, as distinct from whether the predicate is monotone.
   Directing the round's attention at `lifecycleStageClaim` steered it away from
   `lifecycleStagesForLabels`, which is where the money is.
7. **The `Priorities` / `Types` question offers three options and the answer is a fourth.**
   Not "in scope", not "out of scope by deliberate decision", not "not considered" — but
   *considered, ruled not-applicable on a stated and checkable argument, and pinned by a
   test with a positive control*. The distinction matters because the third option would
   warrant follow-up work and the actual state does not.
8. **The guard partition is not a partition.** The brief says six guards are
   write-suppression and one is dual. I confirm six write-suppression (measured, R-3) and
   count six read-meaning, totalling twelve — but `AllTerminalLabelStages`, the "dual" one,
   is inside the read-meaning six rather than beside the two groups. The categories overlap;
   they do not tile.
9. **`axis3_configured_alias_while_disabled` is not an axis-3 row.** The brief tells me not
   to file the absence of an axis-3 write-time control as a defect, which is right, and then
   points me at a diff whose test table appears to contain an axis-3 row. It does not — that
   row is axis 1 with a pre-configured alias. A reader following the brief will conclude
   axis 3 is covered. Filed as N-2.
10. **"`AllTerminalLabelStages` and `IssueToPhaseStage` are called UNCHANGED, with their
    guards intact … verify the inheritance is real."** The inheritance *is* real at the level
    the brief asks about — same functions, same guards, nothing restated — and verifying it
    passes. But the question is the wrong one: what changed is not the rules, it is the
    **routing**. Canonicalisation moves newly-claimed terminal labels out of the
    `IssueToPhaseStage` fallback and into the terminal-first branch, so the demotion rule
    stops applying to them. The rule was inherited; the set it governs was silently shrunk.
    That re-routing is the mechanism of C-1, and "are these the same code paths with the
    same guards" cannot see it.

## Method notes

**Predictions: 7 stated before measuring, 7 confirmed, 0 missed.** P1 (before-endpoint
masking → free write), P1c (open-issue instance), P2/P3 (non-colon and slash-containing
prefixes unpriced), P4 (data race), P5 (superset holds as a property), P6 (claim boundary),
P7 (toggle governs emission).

Per the standing rule, I am reporting this as **weak evidence and treating it with
suspicion, not as a result.** A perfect score means my predictions were not adventurous
enough to be informative. The one that mattered — P1 — came from noticing that
`LabelDeltaLifecycleStages` computes a difference while the diff's safety argument is about
a single evaluation; everything else was confirmation. If I had predicted only what the
brief asked me to check, I would have gone 3-for-3 and approved the change.

**Which arm fired.** Every C-1 cell was differentially attributed: the same probe file was
run against a `git worktree` at `06f01d7` and against `6d8f19e`, and the base run returns
`PermissionDenied … "task:close"` where HEAD returns `<nil>`. The label is observed to land
(`labels AFTER = [ft2:stage/completed ft:stage/completed]`) and availability is observed to
flip, so the refusal is a scope refusal and the allowance is a real write, not a
no-op. Neither run is a build failure: both compile and both report `ok`/`PASS` on the
non-asserting probes in the same binary.

**Mutation cells left dirty: ZERO.** Three temporary `zz_review_probe*_test.go` files
(two in `internal/server`, one in `internal/platform/github`) and one `git worktree` at
`/tmp/base194` were created and all removed. The `web/dist` placeholder was removed, and in
the later re-measurement pass so were the real `web/dist` and `web/node_modules`. No
production file was modified at any point. Final state verified: `git status --porcelain`
empty, `git rev-parse HEAD` = `6d8f19e11f4ddbfdc313301199006d3f7c76eb1c`,
`git worktree list` shows only `/workspace`.

**Impressions outside my axis** (labelled as impressions, offered as neither corroboration
nor challenge):
- *Test axis.* The monotonicity property in Test Coverage item 3 looks mechanically
  checkable and would have caught C-1 without guessing a fixture. The test leg is better
  placed than I am to say whether the existing property harness can carry it.
- *Audit axis.* C-1's precondition is a label an unprivileged GitHub actor can apply, and
  the masking label is invisible to the Farm Table read side, so the setup step leaves no
  trace in the product. Whether that changes the threat rating is the audit leg's call.

---

## Final Verdict

**REQUEST CHANGES.**

Blocking: **C-1** (Critical), **R-1**, **R-2**, **R-3**, **R-4**.

C-1 alone is disqualifying: the change makes a `task:write` holder able to close a task for
free under the default shipped configuration, which is a strict regression against
`06f01d7` in the class the whole workstream exists to close. It should be fixed with the
monotone two-arm pricing in C-1's suggested fix, and it must ship with a regression test
whose fixture already carries a masking label.

Recommend a **second review pass after the fix**, not a re-review of the whole diff: the
matrix test, the C2 correction and the guard classification are good work and should not be
re-litigated. I would also recommend the dispatching agent consider a **test-engineer pass**
for the monotonicity property and a **security-auditor pass** on C-1's reachability. I am
not invoking either.

---

## Addendum — EM gate correction, received after filing

At 11:17Z, after this report was written, the EM sent an unprompted correction stating that
the baseline block's gate table is wrong for this tree: `web/dist` is absent because the
tree was created as a clone and the directory is untracked, so `go build ./...` exits 1 and
`go vet ./...` emits only the embed error with zero copylocks. They flagged that their own
instruction — "match them by MESSAGE, not by count" combined with "anything else vet says is
attributable to this diff" — would point the embed error at the diff and manufacture a false
finding. They asked that it still be counted against them in the brief-errors list.

**This corroborates a measurement I had already made and filed independently** (brief error
1). Nothing in the correction changes a finding, a severity, a deliverable or the verdict,
and no other leg's work was relayed to me. Recording it for three reasons:

1. **Timeline, so the corroboration is not mistaken for a shared premise.** My gate row was
   measured before the correction arrived, from the tree, not from the EM. The two are
   independent measurements that agree. Had I taken the table on trust I would have recorded
   a green vet row and never looked.
2. **One divergence, and it runs against the EM.** Their correction describes the risk as a
   leg *alarmed* by missing copylocks. The likelier and more damaging path is the reverse:
   vet exits 1 either way, so exit-code checking silently confirms the row. Folded into
   brief error 1.
3. **Their proposed remedy works, and I re-verified on it.** `npm ci` (exit 0) and
   `npm run build` (exit 0) both succeed in this container. Against genuine built assets all
   three gate rows reproduce exactly — build 0, vet 1 with precisely the four ephReq
   copylocks and nothing else, test 0 with zero FAIL lines. This also retires a small
   methodological worry of my own: my first pass used a placeholder `index.html` to satisfy
   the embed, and the real build confirms the placeholder was not hiding anything. Both are
   valid because no Go code under test reads the embedded content.

Tree restored afterwards: `web/dist` and `web/node_modules` removed, `git status --porcelain`
empty, HEAD `6d8f19e11f4ddbfdc313301199006d3f7c76eb1c`, one worktree. Dirty cells still zero.

**Verdict unchanged: REQUEST CHANGES**, on C-1 and R-1 through R-4. The gate rows were never
load-bearing for any of them — every blocking finding rests on differential measurement
through `UpdateTask` and on `-race`, not on the gate table.
