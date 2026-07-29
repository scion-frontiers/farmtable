# #194 round 9 (`label-write-scope-r9` @ `06f01d7`) — Correctness & Architecture Review

Reviewer leg: correctness/architecture. Tree `/workspace`, branch `label-write-scope-r9`,
commit `06f01d7d6555a311fcd0728eac40335e654c1de6`, merge-base `158c8ae` confirmed as the
base (clean descendant). Everything tagged `[MEASURED]` below I ran in this session on this
commit; everything tagged `[RELAYED]` I did not reproduce.

## Executive Summary

The round is high-quality work: the MUST 4 proof is mathematically correct, the property
sweeps have real vacuity guards, and the author self-corrected a genuine trap and reported
his own misses. **Risk level: MEDIUM**, driven by a single architectural finding — MUST 5(a)
makes the *write-side* authorization backstop depend on `github.labels.enabled`, which is
the exact thing the round-9 ruling says must never happen. It is provably inert today, but
it contradicts the ruling the round exists to implement and will mislead r10.

## Gate baseline `[MEASURED]`

| gate | result | matches briefed baseline? |
|---|---|---|
| `go build ./...` | exit 0 | yes |
| `go test ./...` | exit 0, zero FAIL lines | yes |
| `go vet ./...` | exit 1, the same 4 copylocks | yes — compared by **message and line**, not count |
| `git status --porcelain` | empty (before and after all probes) | yes |

No `TestWatchTasks` flake fired in either full-suite run I did. All probes were reverted by
snapshot restore from `/tmp/snap`; final `git status --porcelain` = 0 lines.

---

## Critical

None.

---

## Required

### R1 — MUST 5(a) makes the write-side backstop toggle-dependent, contradicting the ruling this round implements

**Where:** guard added at `internal/platform/github/terminal_label_stages.go:70-72`;
consumed at `internal/platform/github/passthrough.go:311` inside `assertStageWriteAllowed`.

**The ruling (from the brief):** *"the scope required to WRITE a lifecycle-prefixed label must
NEVER depend on `enabled`. Only the read/authorization-derivation side varies with the toggle;
the write side does not vary at all."*

`authorizationStage` is not a read-side predicate. It is used on **both** sides:

| call site | side | already `!m.enabled`-guarded before r9? |
|---|---|---|
| `labels.go:402` `StageLabelSwap` | write-computation | yes (`labels.go:393`) |
| `labels.go:689` `TerminalLabelStage` | read | yes (`labels.go:683`) |
| `terminal_label_stages.go:204` `AllTerminalLabelStages` | read | yes (`terminal_label_stages.go:198`) |
| `passthrough.go:311` `assertStageWriteAllowed` | **write authorization** | **no** |

MUST 5(a) therefore applies the toggle to the one write-authorization predicate in the store.

**Evidence `[MEASURED]`** — probe against `assertStageWriteAllowed` directly, both toggle arms,
`stageWriteForbidden`, label `ft:stage/completed`:

```
enabled=true   assertStageWriteAllowed(...) err = refusing to add lifecycle label
                 "ft:stage/completed" (stage "completed") from a code path that is not
                 authorized to move the lifecycle stage...
               authorizationStage("ft:stage/completed") = ("completed", true)
               labelToStage has key "completed" = true ; table size = 10

enabled=false  assertStageWriteAllowed(...) err = <nil>          <-- backstop disarmed
               authorizationStage("ft:stage/completed") = ("", false)
               labelToStage has key "completed" = true ; table size = 10
```

The last line is the load-bearing one: `NewLabelMapper` populates `labelToStage` in full
(10 entries) regardless of the toggle, so **the new guard is the sole cause** of the
disarm. Before `794bdce` this call refused; after it, it does not.

**Is it exploitable today? No, and I verified the author's reason rather than accepting it
`[MEASURED]`.** `assertStageWriteAllowed` is reached only from `writeLabelSwap`
(`passthrough.go:351`), which has exactly six call sites, of which only two pass
`stageWriteForbidden` — the priority arm (`:615`) and the type arm (`:626`). Both are fed by
`PriorityLabelSwap` / `TypeLabelSwap`, which short-circuit to `nil, nil` when disabled:

```
enabled=false  TypeLabelSwap     add=[] remove=[]
enabled=false  PriorityLabelSwap add=[] remove=[]
enabled=true   TypeLabelSwap     add=[feature]      remove=[ft:stage/duplicate bug]   (control)
enabled=true   PriorityLabelSwap add=[priority:low] remove=[ft:stage/completed]       (control)
```

I also reproduced both of the author's mutation claims exactly: deleting the guard and running
`go test ./...` turns **exactly one** test red — `TestAuthorizationStage_IsSilentWhenLabelMappingIsOff`
— and nothing else.

**Impact.** Not a live vulnerability. It is a latent one, and specifically it makes the
already-ruled open finding *harder* to fix, which is the question the brief asked:

- The natural r10 remedy for the open finding is to price or refuse caller-supplied
  lifecycle-label writes regardless of the toggle. If r10 implements that at the store layer
  using `authorizationStage` — which `assertStageWriteAllowed`'s own comment
  (`passthrough.go:296-300`) actively *instructs* the next author to do, on pain of adding "a
  FIFTH answer to which labels are lifecycle labels" — the new control is born disarmed at
  `enabled=false`. That is the ruled defect reintroduced through the fix for it.
- The comment at `terminal_label_stages.go:63-68` frames toggle-following as settled doctrine
  ("the next caller added to this function inherits the rule"). For a read-side caller that is
  right. For a write-side caller it is precisely backwards, and the comment does not say so.

**Recommendation.** Split the predicate along the axis the ruling already draws. Keep
`authorizationStage` toggle-respecting for authority derivation, and give the write side a
toggle-blind sibling:

```go
// lifecycleLabelClaim reports whether raw is a label THIS DEPLOYMENT would treat as a
// lifecycle assertion, independent of github.labels.enabled. The write side must use this:
// a write creates durable state in GitHub, which never hears about the toggle.
func (m *LabelMapper) lifecycleLabelClaim(raw string) (task.Stage, bool) {
    if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(raw)), m.matchPrefix()) {
        return "", false
    }
    stage, ok := m.labelToStage[m.stripForMatch(raw)]
    return stage, ok
}

func (m *LabelMapper) authorizationStage(raw string) (task.Stage, bool) {
    if !m.enabled {
        return "", false
    }
    return m.lifecycleLabelClaim(raw)
}
```

`assertStageWriteAllowed` calls `lifecycleLabelClaim`; the three read-side sites keep
`authorizationStage`. This is one shared body, so it does **not** create the fifth
disagreeing answer the existing comment warns about — the two differ only by the toggle, which
is exactly the divergence the ruling mandates. Add a test asserting
`assertStageWriteAllowed` still refuses at `enabled=false`; that test fails on today's tree,
which is what makes it worth adding.

---

## Nit / Optional

### O1 — MUST 4's mutant recipe is not reproducible as written `[MEASURED]`

**Where:** `internal/platform/github/passthrough.go:1265-1273`.

The comment states: *"Deleting it against an applyLabelDelta mutated to drop labels whose name
is not already trimmed makes property P4 ... fail on 128 of 16384 triples, where with the
clause present P4 is silent."*

Taking that description literally — add `|| l != strings.TrimSpace(l)` to `applyLabelDelta`'s
skip condition, belt deleted — **P4 does not fail at all** (0 of 16384; the whole sweep passes).
The reason is structural: `PropertiesHoldExhaustively`'s `snapVocab`
(`restrict_label_write_property_test.go:493`) contains no untrimmed entry, so that mutant can
never drop a snapshot label, which is the only way to invent a removal.

A mutant that *does* drop snapshot labels (`|| l != labelMatchKey(l)`, i.e. also case-sensitive,
which reaches `strings.ToUpper(completed)` in `snapVocab`) reproduces the **qualitative** claim
cleanly:

| arm | P1 | P4 |
|---|---|---|
| belt deleted + mutant | 256/16384 | **256/16384** |
| belt present + mutant | 256/16384 | **silent** |

So **the substantive claim is TRUE and I verified it by independent construction**: P4 is the
only property that separates belt-present from belt-deleted, and the belt does buy real
protection against a future `applyLabelDelta`. But the specific numbers (128) and the
accompanying claim that P1/P2/P3 see nothing do not hold for either mutant I could derive from
the prose — under mine, P1 fails identically in both arms.

This matters more than a normal comment nit because the paragraph's entire purpose is to make
the belt's rationale *falsifiable*, and a recipe that does not reproduce is not falsifiable.

**Recommendation.** State the mutant as an exact diff line in the comment or, better, park it
as a `t.Skip`-ed mutation test next to P4 so it cannot rot. Do not weaken the claim — it is
correct; just make it re-runnable.

### O2 — `stageWritePolicy` sentinels moved from `const` to `var`

**Where:** `internal/platform/github/passthrough.go:274-290`.

I confirmed the win `[MEASURED]`: `writeLabelSwap(ctx, id, add, remove, false)` is now a compile
error (`cannot use false (untyped bool constant) as stageWritePolicy value`), and was not
before. The zero value is `stageWriteForbidden`, so the control fails closed by construction —
good design.

The cost, which the comment does not mention: `stageWriteForbidden` and `stageWriteAllowed` are
now **mutable package-level variables**. Go cannot express a struct constant, so this is forced
rather than a mistake, but a single stray in-package assignment (including from a test in the
same package) would silently disarm every `assertStageWriteAllowed` call. Worth one sentence in
the comment acknowledging the trade, since the surrounding prose presents the change as strictly
safer.

---

## FYI

### F1 — "removes lifecycle-label AUTHORITY entirely" is overstated `[MEASURED]`

`terminal_label_stages.go:46-48` asserts that `github.labels.enabled=false` *"removes
lifecycle-label AUTHORITY entirely, not merely lifecycle-label WRITES."* There is a
counterexample in the same package:

```
enabled=true   hasExternalUnavailableLabel([ft:stage/blocked]) = true
enabled=false  hasExternalUnavailableLabel([ft:stage/blocked]) = true
```

`hasExternalUnavailableLabel` (`treewalk.go:217`) has no `enabled` guard and does not delegate
to any guarded accessor, so with the toggle off an `ft:stage/blocked` label still drives task
availability. This is **pre-existing, outside the diff, and fail-closed** (the function can only
withhold work, never grant it), so it is not a defect in this change and I am not asking for it
to be fixed. But the absolute phrasing is new in this diff and is false as written; the next
author will believe it. Suggest narrowing to "removes lifecycle-label authority from every
privilege decision", or naming the availability path as the known exception.

### F2 — answer to brief item 2: no further accessor carries an unaccounted `enabled` guard

Enumerated below. The residual risk in this package is the opposite shape from the one the brief
asked about — an accessor with **no** guard (F1), not one with its own.

### F3 — minor asymmetry, harmless

`applyLabelDelta`'s `removed` map (`passthrough.go:1113-1116`) does **not** filter the empty key,
while `RestrictLabelWriteToSnapshot`'s `removeKeys` (`:1274-1279`) does. Harmless, because both
loops short-circuit on `key == ""` before consulting either map. Noting it only because the MUST 4
proof reasons about empty keys and a future reader may check this correspondence.

---

## Deliverable 2 — enumeration for brief item 1, with method

**Question:** the complete set of call sites whose behaviour now varies with `enabled`.

**Denominator: 4 production call sites of `authorizationStage`, of which exactly 1 can change
behaviour, and it cannot be reached with a non-empty argument today.** Plus 1 site that moved in
the opposite direction.

| # | site | changes behaviour? | why |
|---|---|---|---|
| 1 | `labels.go:402` (`StageLabelSwap`) | no | caller returns at `labels.go:393` when disabled |
| 2 | `labels.go:689` (`TerminalLabelStage`) | no | caller returns at `labels.go:683` when disabled |
| 3 | `terminal_label_stages.go:204` (`AllTerminalLabelStages`) | no | caller returns at `:198` when disabled |
| 4 | `passthrough.go:311` (`assertStageWriteAllowed`) | **yes** | no guard; see R1 |
| 5 | `config.go:325` (`checkLifecycleKeyCollisions`) | **yes, inverted** | now forces `Enabled = true` into a local copy, so validation stops varying with the toggle |

**Method.** (a) `grep -rn "authorizationStage" internal/ cmd/ --include="*.go"` filtered to
non-test files, giving the raw call-site set; (b) for each, read the enclosing function and
check for a preceding `!m.enabled` return; (c) `grep -rn "m\.enabled"` across non-test package
files to find every guard independently of the call graph, then diff that against the full
`LabelMapper` method list (`grep "^func (m \*LabelMapper)"`) to find methods with *no* guard;
(d) for site 4, enumerate `writeLabelSwap`'s six call sites and classify each by policy
argument; (e) execute a probe on the two toggle arms with a positive control on each, rather
than concluding from the read.

**What this method would miss.**
- Behaviour that varies with `enabled` **without** passing through `authorizationStage` or a
  literal `m.enabled` token — e.g. a helper that branches on `m.config.Enabled` directly, or
  any indirection through a function value or interface. I grepped `.enabled` and `m.enabled`
  only; a `cfg.Enabled` read inside a non-`LabelMapper` type would not appear.
- Dynamic dispatch. `authorizationStage` is unexported and not on any interface, so this is
  nil here, but the method would not detect it if that changed.
- Cross-package callers. Impossible for an unexported method, so the denominator is genuinely
  closed *for this predicate* — that is the one strong guarantee this method gives.
- **It does not bound future reachability.** My "unobservable today" result is a statement about
  the six `writeLabelSwap` call sites that exist at `06f01d7`, exactly as the author scoped his
  own negative claim. It says nothing about the seventh.

**Is "authority follows the toggle, validation ignores it" the split that got implemented, or
only the one described?** Partly the latter. The *validation* half is implemented exactly as
described and is clean (site 5). The *authority* half is implemented as "**everything that goes
through `authorizationStage`** follows the toggle", which is a strictly larger set than
"authority" — it swept in the write-side backstop at site 4. That gap is R1.

## Deliverable 3 — verdict on the ruling

**The ruling is right, and R1 is a consequence of it rather than an objection to it.** Its
rationale is sound and is the strongest reasoning in the round: a write creates durable state in
a system that never hears about the toggle, so the write's future consequence is identical
whatever `enabled` was at write time, and gating the write on `enabled` therefore banks privilege
now to be cashed out later on a config change nobody would classify as a privilege grant — which
is precisely what the measured differential in the open finding demonstrates end to end. I would
add one clarification for r10, because the round-9 implementation shows the ruling's two-way
split is under-specified in one place: "the write side" must be read to include the *predicate
that decides which labels are lifecycle labels for the purpose of refusing a write*, not merely
the scope lookup. `authorizationStage` is currently a single function serving both sides, so the
ruling cannot be satisfied without splitting it (or accepting that the store-layer backstop is
toggle-dependent). Nothing in the ruling is wrong; it just needs that one sentence to be
mechanically actionable.

## Deliverable 5 — every place the brief is wrong

1. **"Your working tree is `/workspace`"** — correct for this leg. `git rev-parse --show-toplevel`
   returned `/workspace` at the right SHA. The mid-flight correction warning that it might not be
   a repository **did not apply here**; it corrected something that was not wrong on this leg.
2. **The follow-up correction's point 1** — "the reports directory referenced in your brief is NOT
   inside the repository" — the brief already gave the correct absolute path
   (`/scion-volumes/scratchpad/projects/farmtable/reports/`) at line 111. Also not wrong.
3. **"Six commits."** `158c8ae..HEAD` contains **seven**. The table lists six and silently omits
   `06f01d7`, the project-log commit — which is nonetheless counted in the "+1663 / −97 across 12
   files" totals (it is 149 of those insertions).
4. **The per-file `+N` figures are `--stat` totals, not additions.** Actual `--numstat`:
   `config.go` +69/−9, `passthrough.go` +75/−11, `main.go` +24/−2. Only
   `terminal_label_stages.go` (+26/−0) is a true "+26". Minor, but I checked it because the brief
   asked for counts to be verified.
5. **"MUST 5 is the only real behavioural change in the round."** Not quite. `3675bb9` also changes
   production code in `passthrough.go` — `stageWritePolicy` from named `bool` to a struct, and two
   sentinels from `const` to `var`. That changes what compiles (verified: literal `false` is now a
   compile error) and introduces mutable package state. The brief is right that `a08addc`'s
   `passthrough.go` change is comment-only; I verified that.
6. **Item 3's pointer, "`passthrough.go` +86 is where to look" for MUST 4.** Conflates two commits:
   MUST 4 (`a08addc`) accounts for ~+66 of that file's change; the remaining ~20 is `3675bb9`'s
   policy-type change, which is a different item.
7. **Item 2's framing** — "further accessors ... with their own independent `enabled` guard that
   neither the constructor nor this round accounts for". Every `LabelMapper` accessor that *has* a
   guard is accounted for. The unaccounted risk has the opposite shape: an accessor with **no**
   guard (F1). The question as posed would have found nothing.
8. **Item 4's excluded-axis list** cites "empty string, duplicate keys" as candidates the sentence
   might quietly exclude. Both are in fact explicitly handled and swept — `vocab` includes `""`,
   `snapVocab` carries a duplicate-key pair, and both have self-checks that `t.Fatalf` if the shape
   stops being reachable (`restrict_label_write_property_test.go:499-510`).
9. **Item 5, "`main.go` +26 is small enough to read completely"** — true, and I did; but the
   testability concern it raises ("widen any production API") is answered by a different file.
   The only production-shape change worth the question is in `passthrough.go` (see #5).

**On item 4's Unicode question, per instruction to name it and stop:** the sentence *"caller
spelling and snapshot spelling can differ ONLY in case and padding"* is false in the strict
codepoint sense. `[MEASURED]` `labelMatchKey("ft:stage/worKing")` with U+212A KELVIN SIGN
collides with `labelMatchKey("ft:stage/working")` — the two strings differ by a codepoint that
is not an ASCII case variant, and `"working"` is a real stage name containing `k`. This is the
known open Unicode case-folding item. **Naming it and stopping.** (For completeness, the other
axes the brief listed are *not* collision sources: U+200B does not collide — measured, it
survives `TrimSpace` and yields a distinct key — and NFC/NFD likewise produce distinct keys, so
they fail closed rather than open.)

---

## Positive Feedback

Not manufactured — these are specific and I checked each one.

- **The MUST 4 proof is correct.** I verified `keys(snapshot) \ keys(after) ⊆ keys(removeLabels)`
  line by line against `applyLabelDelta`'s body (`passthrough.go:1112-1129`), including the
  duplicate-key case, and it holds. Replacing a false rationale with a discharged proof, while
  *keeping* the code and explaining that it is now a hedge against a contract that does not exist
  yet, is exactly the right call — and rarer than it should be.
- **P4 is a genuine property, not a fixture re-spelling** (the brief's form (7)). It quantifies
  over the restrictor's *output* across 16384 exhaustively-enumerated triples, and I confirmed by
  construction that it separates belt-present from belt-deleted where P1/P2/P3 cannot.
- **The vacuity guards are real.** `dupSnapshots == 0` and `realDrops == 0` both `t.Fatalf`, and
  the sweep asserts its own case count. This is the correct response to round 8's failure mode.
- **The author's self-correction is recorded accurately.** "Reading the constructor is not reading
  the accessor" is a true and transferable lesson, and he caught it by running the test rather
  than by re-reading — the right instinct.
- **The `strings.TrimSuffix(field, "s")` → explicit noun fix** (`config.go:373`) quietly repairs a
  diagnostic that read *"Every prioritie change"*. Small, but it is the kind of thing that gets
  left.

## Test Coverage

New paths are covered, and the coverage is unusually load-bearing for this codebase. The one gap
relevant to my axis: **there is no test asserting `assertStageWriteAllowed`'s behaviour at
`enabled=false`.** Today such a test would encode the R1 defect if written to match current
behaviour, and would fail if written to match the ruling — which is exactly why it should be
added as part of R1's fix. Mutation-adequacy of the round's tests is the test leg's axis and I
deliberately did not build a matrix; where I did mutate, it was to check a specific claim in a
comment (R1, O1, O2), and all three mutations were reverted by snapshot restore with
`git status --porcelain` verified empty afterwards.

## Backward Compatibility

No wire-format change, no proto change, no exported-API change — I checked the production diff
for new exported identifiers and there are none (`loadGitHubConfig` is unexported;
`stageWritePolicy` and both sentinels are unexported). One **operator-visible behaviour change**:
`checkLifecycleKeyCollisions` now rejects four config shapes it previously accepted and accepts
two it previously rejected. The author enumerated all six with intent labels and I regard the
list as the right thing to have produced; a release note is warranted, since a config that loaded
yesterday can refuse to start today. That is the intended direction and I am not objecting to it.

## Final Verdict

**REQUEST CHANGES** — on R1 alone.

R1 is not a live vulnerability and I want that on the record: I measured it as unreachable
through every production path that exists at `06f01d7`. It blocks because it silently inverts the
governing ruling on the write side, in the one round whose subject is that ruling, and because
the code comment adjacent to it instructs the next author to propagate the inversion. The fix is
small and local (split the predicate; ~10 lines plus one test). O1, O2 and F1 are non-blocking and
can ride with the R1 pass or go to r10 — they should not be dropped, particularly F1, which is a
false statement in a comment that a future author will rely on.
