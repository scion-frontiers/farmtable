# #194 round 8 (`label-write-scope-r8` @ `158c8ae`) — independent code review

Axis: **the diff and the structure**. Reviewed `git diff 1d4442f..HEAD`, 9 commits,
14 files, +2468/−39.

## Executive Summary

The central claim of the round — that `RestrictLabelWriteToSnapshot` now agrees with
`applyLabelDelta` **by construction** — is **true**, and I proved it independently rather
than accepting it: a closed-form argument plus a 524,288-triple round-trip sweep with zero
failures, and a positive control (reinstating the round-7 two-per-list restrictor) that
goes RED. The call-site partition the EM's brief got wrong is now **complete and correct**,
and each classification is load-bearing under an over-reach mutant. Risk level: **MEDIUM**.

What blocks merge is not the fix — it is that **three of the round's own stated guarantees
are unpinned or falsely documented**, and one new config check does not do what its first
sentence says. All four are cheap to fix and none require redesign.

**Verdict: REQUEST CHANGES.**

---

## Critical

None. I actively looked for one and did not find it. Evidence in the FYI section.

---

## Required

### R1 — P2, the sole pin for the A-4 class, is itself completely unpinned

`internal/platform/github/restrict_label_write_property_test.go:96-140` (definition) and
`:396-455` (the probe that claims to guard it).

The file's own docblock says: *"DO NOT delete either property because 'the other one covers
it'"*, and `TestRestrictLabelWriteToSnapshot_PropertiesRejectTheIdentityRestrictor` says
*"If this test ever fails, P2 has stopped discriminating and the A-4 class is unpinned
again."*

That probe does not call `restrictProperties`. It **reimplements P2 inline** at lines
413-435. So it cannot observe P2 changing.

**Measured** (each mutant applied alone, reverted, `git diff --quiet` asserted):

| mutant to the P2 *definition* | predicted | `go test ./...` |
|---|---|---|
| M-R1: delete the `case removeKeys[k]:` (C-1) arm, l.117-119 | GREEN | **exit 0, 0 failures** |
| M-R2: delete the `case !present[k]:` (A-4) arm, l.127-129 | GREEN | **exit 0, 0 failures** |
| M-R3: gut P2 entirely (`bad` can never populate) | GREEN | **exit 0, 0 failures** |

P2 can be deleted outright and the repository stays green. The reason is structural: the
exhaustive sweep and the named rows run P2 against the *correct* restrictor, which never
violates it, so P2's discriminating arms are never exercised — the probe is the only thing
that exercises them, and it exercises a copy.

This is the exact mistake the same file condemns 300 lines earlier (l.71-76): *"any
hand-rolled model of applyLabelDelta here would be free to drift in the same direction the
production code drifted and would report agreement anyway."*

**Fix.** Extract the P2 body into a shared helper and call it from both places:

```go
func p2Violations(snapshot, addLabels, removeLabels, gotAdd, gotRemove []string) []string
```

`restrictProperties` calls it with the production restrictor's output; the probe calls it
with `gotAdd, gotRemove := row.add, row.remove`. Then M-R1/M-R2/M-R3 all become RED.

---

### R2 — the F-2 fix (removals in the snapshot's spelling) is unpinned

`internal/platform/github/passthrough.go:1199-1225`.

The dev report leads with this as a deliberate design decision that "closes F-2 as a side
effect". The hazard is real: `labelNameToID` (`passthrough.go:201`) looks up
`s.labelIndex[strings.ToLower(name)]` with **no `TrimSpace`**, so a padded caller spelling
resolves to nothing and a priced removal silently evaporates. I confirmed that by reading
the code, not by accepting the claim.

**Measured.** M-S: rewrite the remove loop to iterate `removeLabels` and emit the *caller's*
spelling, keeping the same filtering:

```
go build ./...  exit 0   (compiled — it measured something)
go test ./...   exit 0   0 failing tests
```

Nothing in the tree can see it. P1 cannot: `sameLabelSet` → `labelKeySet` compares
normalised **key sets**, so spelling is invisible to it by construction. P2 cannot:
`!present[k]` is a key test too. This is precisely the spot the brief flagged as "where a
simplification would land", and a simplification lands there for free.

**Fix.** Add P3 to `restrictProperties`: every entry of `gotRemove` must be **verbatim** an
element of `t.Labels`. I measured that this property holds today across all 524,288 triples
of my sweep (including snapshots with padded and upper-cased spellings), so it is safe to
assert. Add one named row whose caller spelling is padded relative to the snapshot's, e.g.
`snapshot: ["ft:stage/wont_fix"], remove: ["  FT:Stage/Wont_Fix "]`.

---

### R3 — the `removeKeys` "safety belt" comment states a hazard that cannot occur

`internal/platform/github/passthrough.go:1206-1210`.

> *"ent.Task.Labels is a plain slice and two entries sharing a match key would make
> applyLabelDelta's dedup drop one, which without this test would emit a removal the caller
> never asked for."*

That is false. `applyLabelDelta` dedups *elements*; `afterKeys` is a set of **keys**, and
the remove loop tests the key. A duplicated key is still in `afterKeys`, so the loop skips
both entries and no removal is emitted — with or without the belt.

**Proof.** `applyLabelDelta` skips a current label only when `key == ""`, `removed[key]`, or
`seen[key]`. If `seen[key]`, the key is already in `after`. Therefore
`keys(S) \ keys(after) ⊆ keys(R)` unconditionally, so `!removeKeys[key]` is never true at
that point.

**Measured.** 524,288 triples, comparing the shipped function against an identical copy with
`!removeKeys[key]` deleted. Snapshot vocabulary was chosen to contain **three spellings of
one match key** — the exact case the comment names — plus empties and whitespace entries.

```
PROBE1 cases=524288 diffs=0
```

Zero. The clause is unreachable as a discriminator.

The dev report additionally claims the belt is *"covered by a named row"*. It is not: no
named row and no sweep vocabulary in
`restrict_label_write_property_test.go` contains a snapshot with two entries sharing a match
key (`snapVocab` at l.320 is three distinct keys; all 11 named `snapshot:` literals are
distinct-key).

**Fix.** The clause is not worthless — it is a hedge against a future `applyLabelDelta` that
drops a label for a reason *other than the remove list*. That is a different and honest
rationale, and stating it also supplies the qualification the docblock's absolute claim
(l.1147, *"NO FUTURE CHANGE TO applyLabelDelta CAN DESYNCHRONISE THEM"*) currently lacks —
the belt exists precisely because that sentence is slightly too strong. Replace the
paragraph with the invariant proof plus that rationale, **or** delete the clause and the
`removeKeys` map and state the invariant. Either is fine; leaving the current text is not,
because on this workstream a comment asserting a property the code does not have is the
declared defect class.

---

### R4 — `checkLifecycleKeyCollisions` misses a case in the class its own first sentence defines

`internal/platform/github/config.go:262-330`.

Sentence one: *"rejects a priorities or types key that captures one of this deployment's own
lifecycle labels."* A **prefixed stages-table alias** is one of this deployment's own
lifecycle labels — `authorizationStage` accepts it — and the check does not see it, because
`owned` is seeded only from `stripForMatch(StageToLabel(stage))`, i.e. the bare stage names.

**Measured**, with `stages: {"ft:mydone": completed}` and `types: {"ft:mydone": bug}`:

```
authorizationStage("ft:mydone")                    = ("completed", true)   <- privilege-bearing
cfg.Validate()                                     = <nil>                 <- config layer ACCEPTS
TypeLabelSwap([ft:mydone bug], "feature") remove   = [ft:mydone bug]       <- type change destroys it
assertStageWriteAllowed(remove, forbidden)         = error (refuses)       <- runtime layer CATCHES it
```

Not Critical, because item 3's `assertStageWriteAllowed` closes it at runtime — that is
defence-in-depth working as designed, and worth saying explicitly. But the docblock's
*"Scope is deliberately narrow"* enumeration lists two exclusions and reads as exhaustive.
It does not mention this one, and the reason it gives for skipping the `stages` table
(aliasing one stage spelling onto another is that table's purpose) does not cover a stages
key that a *types* key also captures. `lifecycle_key_collision_test.go:28-30` claims the two
layers are independent; for this input only one of them holds.

**Fix.** Also seed `owned` from `m.labelToStage` — its keys are already `stripForMatch`
-normalised, so it is a direct merge:

```go
for label, stage := range m.labelToStage {
    owned[label] = stage
}
```

Then, per the M6e lesson the dev learned this round, add a positive-control row measuring
which currently-loading configs the widened check newly rejects (a config with the same
bare key in both `stages` and `types` would now be refused; decide deliberately whether
that is intended).

---

## Nit / Optional

### O1 (Consider) — both defence layers fail open through one untested hand-maintained list

`internal/platform/github/config.go:289-291`. `checkLifecycleKeyCollisions` derives its
entire protected set from `allStages` (`labels.go:66`), a hand-written slice. So does
`labelToStage`, and therefore `authorizationStage`, and therefore the item-3 runtime
backstop. A stage added to the ent enum but not to `allStages` is invisible to **both**
layers.

**Measured**: `allStages` = 10, ent `StageValidator` accepts 10 — total today. No test in the
tree pins it (`grep allStages internal/platform/github/*_test.go` returns only consumers).
Related: `StageToLabel`'s fallback branch (`labels.go:325`) is dead — I replaced it with a
`panic` and `go test ./...` still exited 0 with zero panics — so nothing exercises the
missing-stage path either.

**Fix.** One test asserting every value `task.StageValidator` accepts appears in `allStages`.
Cheap, and it converts a silent fail-open into a build-time failure. Flagged as Optional
only because the list is correct today.

### O2 (Consider) — the R-1 wiring is untested, which is the same shape as the item-5 defect

`cmd/farmtable-server/main.go:81-88`. `ConfigSource` and `Describe` have five tests. The one
line that makes any of it reach an operator — `log.Println(ghSrc.Describe(ghCfg))` — has
none, and a refactor that drops it restores the exact silence R-1 exists to end.

This is the argument `TestLoadConfig_RejectsALifecycleCapturingKey` makes for `Validate`
(*"Validate being right is worth nothing if the loader does not call it"*), not applied here.
It is also the same two-of-three-write-paths shape the dev's own item-5 pin caught mid-round.
`main()` is conventionally untested, so the fix is to extract the two lines into a small
helper that a test can drive.

### N1 (Nit) — `stageWritePolicy` is a `bool`, so a bare literal compiles

`internal/platform/github/passthrough.go:261`. The docblock says passing the constant
"asserts that; it does not merely permit", but the type does not force the constant to be
named. **Measured**: `s.writeLabelSwap(ctx, issueID, add, remove, true)` builds cleanly
(`go build ./...` exit 0). A one-field struct or an unexported enum type over a non-bool
would make the constant the only spelling.

---

## FYI

**The central claim is true, and here is my own evidence for it.** For every input,
`applyLabelDelta(S, Restrict(S, A, R)) == applyLabelDelta(S, A, R)`:

- *Argument.* `keys(after) = (keys(S) ∪ keys(A)) \ keys(R)`. The emitted adds are
  `keys(after) \ keys(S)`; the emitted removes are `keys(S) \ keys(after)` (the `removeKeys`
  clause never narrows this — see R3). Replaying gives
  `(keys(S) ∪ (keys(after)\keys(S))) \ (keys(S)\keys(after)) = keys(after)`. Spellings line
  up because `after` iterates `S` before `A`, so a key present in both keeps the snapshot's
  spelling and is excluded from the adds by `present[key]`.
- *Sweep.* 524,288 triples over a vocabulary containing three spellings of one label,
  duplicate-key snapshots, empty and whitespace-only entries: **0 round-trip failures, 0
  spelling violations**.
- *Positive control.* Reinstating the round-7 two-per-list-filter restrictor in production:
  `go build` exit 0 (it compiled, so it measured something), `go test ./...` **exit 1, 5 FAIL
  lines**, `TestRestrictLabelWriteToSnapshot_NamedDefectShapes` and
  `..._PropertiesHoldExhaustively` both RED. The pins are live.

**The call-site partition is complete, correct, and fails safe.** Six sites, enumerated from
the code, not from the report:

| # | site | policy | why it is right |
|---|---|---|---|
| 1 | `passthrough.go:583` UpdateTask stage arm | Allowed | priced by `TransitionScope` |
| 2 | `:603` priority arm | Forbidden | bare `task:write`, no scope charged |
| 3 | `:614` type arm | Forbidden | bare `task:write`, no scope charged |
| 4 | `:628` `p.AddLabels` | Allowed | priced by the label-delta gate, `server.go:843-863` |
| 5 | `:636` `p.RemoveLabels` | Allowed | same gate, then narrowed at `server.go:885` |
| 6 | `:777` ClaimTask | Allowed | requires `task:claim` |

- *Completeness is compile-enforced*, not defaulted: `policy` is a required positional
  parameter, so a seventh call site that omits it does not build. The brief's framing ("a
  missed site defaults to whichever value the zero value gives") presumes a defaultable
  field that does not exist. The zero value only applies to `var p stageWritePolicy`, and it
  is `stageWriteForbidden` — fail-safe, deliberately (`:266`).
- *Each classification is load-bearing.* Over-reach mutants, measured by me:
  stage arm → Forbidden = **12 tests RED**; both caller-supplied arms → Forbidden = **15
  tests RED**; policy check neutered = **4 tests RED**; `TypeLabelSwap` guard removed = **2
  tests RED**. All compiled first (`go build` exit 0).
- `CloseTask`'s inline best-effort swap (`:875-892`) genuinely does bypass `writeLabelSwap`,
  as the code says. It is a stage-moving path requiring `task:close`, so it would be
  `stageWriteAllowed` anyway. No gap.

**M6c is a genuine equivalent mutant, and the pin does expire loudly.** Both checked against
a wider space than the dev used:

- Equivalence: 9 push prefixes × 4 stage tables (including `{"ft:mydone": completed}` and
  `{"ft:stage/completed": wont_fix}`) × 10 stages → **0 divergences**. It holds because
  `NewLabelMapper` overwrites `stageToLabel[stage]` with the canonical
  `prefix + "stage/" + stage` even for custom stages entries (`labels.go:186`), so no config
  can separate the derived and hardcoded forms. The dev's structural argument is correct.
- Expiry: changing the real spelling (`labels.go:136`) to `"lifecycle/"` →
  `TestLifecycleKeyCollision_OracleIsStructurallyEquivalentToday` **exit 1, 40 divergence
  messages**. Yes, the code notices.
- One caveat worth recording: my *first* attempt at that control mutated `StageToLabel`'s
  fallback (`labels.go:325`) and the pin stayed **GREEN** — because that branch is dead (see
  O1). A future maintainer editing the fallback will get no warning from the pin. The pin
  guards the live path only.

**Expected-clean checks (rule 18 — reported either way, all three clean):**

1. *No push, no remote refs moved.* No `push` entries in any reflog. All
   `refs/remotes/origin/*` are the EM's local-clone refs; `origin` is a filesystem path and
   there is no GitHub upstream (`farmtable-io/farmtable` and `ptone/farmtable` both 404).
2. *No generated or vendored file hand-edited.* `git diff --name-only 1d4442f..HEAD` filtered
   for `ent/`, `.pb.go`, `vendor/`, `web/dist`, `api/` → **NONE**. All 14 files are
   hand-authored source, tests, or the project log.
3. *`LoadConfig`'s public API is unchanged.* `func LoadConfig(path string) (*GitHubConfig,
   error)` at both `1d4442f:config.go:61` and `HEAD:config.go:105`. See brief-error #4 for a
   behavioural nuance the phrase "API unchanged" hides.

**Build / vet / test, measured here with child-process exit codes (never through a pipe):**

| check | result |
|---|---|
| `go build ./...` | **exit 0** |
| `go test ./...` | **exit 0**, 0 `FAIL` lines |
| `go vet ./...` | **exit 1**, exactly 4 copylocks at `server.go:1782/1892/2100/2277`, messages checked |
| `gofmt -l cmd internal` | 7 files, **none in this diff** (`internal/server/scopes.go` + 6 under `serverapp`/`streaming`) |

**Vet control from a different axis.** I did not just count. I checked out `1d4442f` in a
separate worktree (copying `web/dist` in, without which `go vet` dies on `assets.go:5:12`
before reaching `server.go`) and measured the baseline: **1737 / 1847 / 2055 / 2232**, same
four messages, same four RPCs. HEAD is 1782 / 1892 / 2100 / 2277 — a uniform **+45**,
matching the +45 lines this diff adds to `server.go`. Baseline intact, no new findings.

---

## Positive Feedback

Specific, not manufactured:

- **`RestrictLabelWriteToSnapshot`'s rewrite is the right fix and it is well executed.** It
  replaces "two implementations that must agree" with "one implementation and a derivation",
  which removes a whole class rather than patching an input. The `// THE ORACLE. Not a model
  of the gate's rule — the gate's rule.` line at `:1175` is the sentence that makes the
  design legible in one read.
- **`stageWritePolicy`'s zero value is `stageWriteForbidden`.** That is a deliberate,
  correct, and easy-to-get-wrong choice, and it is documented as a choice at `:266`.
- **`assertStageWriteAllowed` reuses `authorizationStage` rather than a fifth prefix test**
  (`:286-289`), and says why. On a codebase with four competing answers to "which labels are
  lifecycle labels", declining to add a fifth is the whole game.
- **The item-8 rewrite is better than the review that prompted it.** The dev measured the
  round-7 test against the real file from git, found the review's "vacuous" verdict false,
  said so, and shipped a narrower and true diagnosis plus the `removeCalls != 0` assertion
  that was actually missing. Refusing to delete a test on a wrong premise is the behaviour
  this workstream needs more of.
- **M6c is reported as a survivor rather than dressed up as a kill**, and M7a is reported as
  a mutant that did not compile and therefore measured nothing. Both cost the author
  something to write down.

---

## Test Coverage

New paths are covered thoroughly — 939 lines across five new test files plus 455 for the
property pins, with prerequisite assertions, positive controls, and named-row rationales
throughout. This is well above the project's median.

The gaps are the three named above, and they share one shape: **each is a place where the
guard on the guard is a copy rather than the thing itself.**

| claimed guarantee | pinned? |
|---|---|
| restrictor agrees with `applyLabelDelta` (P1) | yes — verified RED under M-C1a |
| restrictor emits nothing unpriced (P2) | **no — P2 itself is deletable, R1** |
| removals use the snapshot's spelling (F-2) | **no — R2** |
| `removeKeys` belt is load-bearing | **no — it cannot be, R3** |
| priority/type arms cannot write a stage label | yes — 4 RED |
| stage / claim / caller-label arms still work | yes — 12 and 15 RED |
| unknown type strips nothing | yes — 2 RED |
| config rejects a lifecycle-capturing key | partly — **misses prefixed aliases, R4** |
| server logs which config it loaded | mechanism yes, **wiring no — O2** |

**`TestWatchTasks` flake, re-run as instructed.** 6 concurrent batches of
`go test ./internal/server/ -run TestWatchTasks -count=20` at `158c8ae`, exit codes taken per
child: **5 of 6 batches RED** (batch3 green). 29 `--- FAIL` lines, all within `TestWatchTasks*`
— `NoInitial` 8, `UpdatedEvent` 6, `Heartbeat` 4, `ClaimEvent` 3, `CreatedEvent` 2,
`ClosedEvent` 1. The brief's relayed figure was 4 of 6; I got 5 of 6, which is within the noise
of a genuine timing flake and does not change the conclusion. Confirmed pre-existing on the
brief's own control logic — nothing in this diff touches `internal/streaming` or the watch
path — and it does not gate this verdict.

---

## Backward Compatibility

No wire-format change. No proto touched, no field removed, no new required field.

Two behavioural changes worth calling out, both intended and both documented:

1. **`UpdateTask(type=<unrepresentable>)` is now a silent no-op on the GitHub path**
   (`labels.go:479-481`) where it previously stripped the issue's type labels. The caller
   gets `OK` for an update that did not take effect on the remote. That is the correct side
   to err on and the doc comment argues it well, but it is an observable change for any
   client that was relying on the destructive behaviour to clear a type — such a client
   should use `type: ""`, which still clears.
2. **`LoadConfig`'s error text now names the absolute path**, not the caller's relative one
   (`config.go:139/146/150`). Signature identical; message different. See brief-error #4.

`LoadConfig` remains a pure delegation to `LoadConfigWithSource` with no behaviour change on
the success path — verified by reading both, and `TestLoadConfig_StillBehavesIdentically`
pins it.

---

## Where this brief was wrong

Required deliverable. Four items, plus five in the implementation report.

### Brief

1. **§Setup, "Your working tree is `/workspace`… verify branch and commit."** At launch the
   workspace had no usable git object store: the clone was made with `--shared` and
   `.git/objects/info/alternates` carried a **host** path that does not resolve inside the
   container. `.git/objects` was 16K with an empty pack directory; `git log`, `git diff`,
   `git status` and `git show` all failed with `bad object HEAD`. The EM has since fixed
   this and correctly identified it as a check that could not falsify what it checked. Two
   consequences worth recording: (a) **`go build ./...` exited 1** under the breakage, with
   `error obtaining VCS status: exit status 128`, which is almost certainly what
   test-194-r8 reported as a build failure — re-measured after the repair, **`go build ./...`
   exits 0 with no `-buildvcs=false` flag**; (b) my own first build measurement showed exit
   0 only because I had piped it through `tail`, which is the exact trap the brief's own
   verification bar warns about. I caught it on the re-run.

2. **§2, "A missed site defaults to whichever value the zero value gives."** The premise does
   not hold. `policy` is a required positional parameter of `writeLabelSwap`, so a call site
   that omits it is a **compile error**, not a defaulted one. The zero value is real and is
   `stageWriteForbidden`, but it only applies to a `var` declaration, and nothing in the tree
   makes one. The question as posed cannot be answered because the failure mode it assumes
   is unreachable.

3. **§1, the `removeKeys` safety belt.** The brief relays the developer's rationale — "two
   entries sharing a match key, which `applyLabelDelta`'s dedup would collapse" — as an
   established `[MEASURED-BY-dev-194-r8]` fact. It is false: measured 0/524,288, with the
   named case explicitly in the vocabulary. See R3. The brief was right to send me at it.

4. **§5, "the public API of `LoadConfig` is unchanged."** True as written and confirmed, but
   it invited the wrong conclusion. The *signature* is byte-identical; the *behaviour* is not
   — three error paths now interpolate `src.AbsolutePath` where they previously interpolated
   the caller's `path`. Any caller matching on the error string sees a different message.
   "Public API unchanged" and "no observable change" are not the same claim, and the
   expected-clean item was phrased as the first while implying the second.

**Where the brief was right and I am confirming *its* claim with my own measurement**
(worth zero as agreement, stated for the ledger): the `go vet` baseline is exactly 4
copylocks findings at 1782 / 1892 / 2100 / 2277 in the four named RPCs with the stated
message — I reproduced all four and additionally established the base at `1d4442f` is
1737 / 1847 / 2055 / 2232, which the brief did not give me.

### Implementation report (`dev-194-r8.md`) — also under review

5. **"8 commits off `1d4442f`."** There are **9**; the report predates the project-log commit.
   The EM's `[MEASURED-BY-EM]` claim that `53edc46` → `158c8ae` is docs-only and a plain
   descendant is **correct, and I verified it rather than accepting it**:
   `git diff --stat 53edc46 158c8ae` = one file, `.design/project-log/label-write-scope-r8.md`,
   +232; `git rev-list --parents -n1 158c8ae` shows `53edc46` as the sole parent;
   `git merge-base --is-ancestor` exits 0. Not a rebase, not an amend.

6. **The vet table contradicts itself.** It reports `GetBottlenecks` as brief `~2277` → HEAD
   `2277` while concluding "Uniform +45 shift". Measured at `1d4442f`: **2232**. The
   conclusion is right and the row is wrong; the shift is uniformly +45 across all four.

7. **"The `removeKeys` safety belt … is covered by a named row."** No such row exists. All 11
   named `snapshot:` literals and the sweep's `snapVocab` consist of distinct match keys.
   Nothing in the tree constructs the duplicate-key snapshot the belt claims to guard, and
   per R3 such a row would not discriminate anyway.

8. **M-P1 is reported as "3 (all three negative tests)".** I measure **4** failing tests —
   the three `TestStageWritePolicy_*` negatives plus
   `TestLifecycleKeyCollision_IsTheHarmTheCheckClaims`.

9. **M-P2 is reported as "positive control + 10 server tests".** I measure **15** failing
   tests. Both 8 and 9 are undercounts; both conclusions stand and are strengthened.

**Discipline note.** Every mutant above was applied one at a time by a script asserting its
anchor matched exactly once, reverted with `git checkout --`, and followed by
`git diff --quiet`. Each was compiled before being trusted (`go build` exit 0 recorded per
mutant), because a mutant that does not build measures nothing. Two temporary probe test
files were created and deleted. The tree is clean: `git diff --quiet` → exit 0,
`git status --porcelain` → empty. **No production code was modified and nothing was pushed.**

---

## Final Verdict

**REQUEST CHANGES** — R1, R2, R3, R4.

The fix at the centre of this round is correct and I could not break it. What I could break,
trivially and silently, is the machinery that is supposed to stop it breaking later: P2 is
deletable, the F-2 spelling decision is unpinned, one comment justifies a clause with a
hazard that cannot happen, and one config check is narrower than its own opening sentence.
On a workstream where the last five Criticals all came from a guarantee that was asserted in
prose and not in a test, those four are the review.

None of them requires redesign. R1 is an extract-function. R2 is one property and one row.
R3 is a comment. R4 is a four-line map merge plus a control row. I would expect a clean
re-review after one pass.
