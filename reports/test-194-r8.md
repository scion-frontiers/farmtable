# test-194-r8 — independent test review, #194 round 8

**Verdict: REQUEST CHANGES.**

The round's mutation matrices are, where they are reproducible at all, accurate — I
re-derived them from the real artefacts and the numbers land exactly. The code is not my
axis and I am not disputing it. But on my axis — *if someone reverts this tomorrow, does the
suite notice?* — three things are wrong:

- the round's **Critical (C-1) is pinned in exactly one file** and has no independent
  backstop, where the older A-4 defect has two;
- the test that is *designated* to detect that pin degrading **cannot fail from any
  production change at all**;
- the report's headline "unkillable equivalent mutant" (**M6c**) **is killable**, and the
  test written to compensate for it carries the identical fixture defect the report itself
  diagnosed in M6e one section earlier.

Two further behaviours the report presents as fixes — the snapshot-spelling removal (F-2)
and the `removeKeys` safety belt — have **zero** coverage; one of them the report explicitly
claims is covered.

Everything below is my own measurement on my own harness at
`158c8ae963faa5eef032e0857ecbc40d6a7c681a`, branch `label-write-scope-r8`.

---

## 0. Environment, baseline, and harness

### 0.1 The workspace arrived with a destroyed git object store (resolved mid-session)

`.git/objects/info/alternates` held the **host** path
`/workspace/farmtable-194-combine-r7/.git/objects`, which does not resolve inside this
container; `.git/objects` was empty. Every object-touching git command failed. The EM
repaired it mid-session (objects localised, alternates removed). I re-verified after the
repair rather than accepting it:

| check | result |
|---|---|
| `git fsck --connectivity-only` | exit 0 |
| `git rev-parse HEAD` | `158c8ae963faa5eef032e0857ecbc40d6a7c681a` |
| `git rev-list --count 1d4442f..HEAD` | 9 |
| `git show 1d4442f:<path>` | works |

**Verifying the EM's `[MEASURED-BY-EM]` claim about 53edc46 vs 158c8ae** (their instruction
was to check it, not accept it):

```
$ git merge-base --is-ancestor 53edc46 HEAD   # exit 0
$ git rev-list --count 53edc46..HEAD          # 1
$ git diff --stat 53edc46..HEAD
 .design/project-log/label-write-scope-r8.md | 232 ++++++++++++++++++++++++++++
 1 file changed, 232 insertions(+)
```

**The EM's claim is correct in every particular**: one commit, plain descendant (not a
rebase or amend), docs-only, 232 lines, in `.design/project-log/`. I am confirming *their*
claim with *my* measurement.

**Their second question — does `go build ./...` really need `-buildvcs=false`?** It does
not. My original exit-1 was an artefact of the broken `.git` (VCS stamping calls git).
Re-measured after the repair with no flags and a clean environment: **`go build ./...` →
exit 0**. The brief's baseline stands; my earlier finding was environmental and is withdrawn.

### 0.2 Baseline at 158c8ae — confirming the brief's `[MEASURED]` claims with my own runs

| check | brief's claim | my measurement | verdict |
|---|---|---|---|
| `go build ./...` | exit 0 | exit 0 | brief confirmed |
| `go test ./...` | exit 0, zero FAIL lines | exit 0, `grep -c '^FAIL'` = **0**, 10 `ok` packages | brief confirmed |
| `go vet ./...` | exit 1, exactly 4 copylocks | exit 1, exactly 4 | brief confirmed |
| vet line numbers | 1782 / 1892 / 2100 / 2277 | 1782 / 1892 / 2100 / 2277 | brief confirmed |
| vet messages | `assignment copies lock value to ephReq: …contains sync.Mutex` ×4 | byte-identical; `diff` against my post-experiment run is empty | brief confirmed |
| `gofmt -l` touched dirs | (report) clean except `internal/server/scopes.go` | exactly `internal/server/scopes.go` | report confirmed |

Exit codes are the child process's (`subprocess.run(...).returncode`), never read through a
pipe. FAIL lines counted separately from exit codes throughout.

### 0.3 Harness

`/tmp/mut.py`. Per mutation: (1) assert the whole tree matches a pristine sha256 manifest of
all 243 `.go` files, **ABORT** otherwise; (2) assert every anchor matches **exactly once**,
restore and ABORT otherwise; (3) assert the file actually changed; (4) `go build` and
`go test -count=1` as separate child processes; (5) restore from a tar snapshot; (6)
re-verify sha256 **and** `git diff --quiet`, ABORT on either. A mutant is scored
`COMPILE-FAIL (measures nothing)` if the build fails or any package reports
`[build failed]` — the trap the report's own first M7a fell into.

Nothing was committed before mutating because nothing needed to be: the harness never runs
`git checkout`, and the tree is verified clean after every single run. 30 mutant runs, zero
restore failures.

**Final state: `git status --porcelain` empty, `git diff --quiet` exit 0, `go build ./...`
exit 0, `go test ./...` exit 0 / 0 FAIL, `go vet ./...` output `diff`-identical to the
pre-experiment baseline.** No production file was modified. All temporary probe tests were
removed; their source is reproduced in this report instead, per the "don't fix it yourself"
rule.

---

## 1. Re-derived RED evidence — the report's numbers

Predictions were made before each run and are recorded next to the results.

### 1.1 M-C1a and M-C1d — reproduced exactly

The round-7 implementation was **extracted with `git show 1d4442f:internal/platform/github/passthrough.go`
and substituted programmatically**. Not retyped, not reconstructed.

| mutant | my prediction | build | test rc | failing tests | sweep P1 | sweep P2 | report says |
|---|---|---|---|---|---|---|---|
| **M-C1a** round-7 impl | RED, ≥5 tests, P1>0 and P2>0 | 0 | 1 | **5** | **3768 / 8192** | **3768 / 8192** | 3768 / 3768 ✅ |
| **M-C1d** identity restrictor | RED, P1=0, P2>0 | 0 | 1 | **13** | **0** (no line emitted) | **8064 / 8192** | 0 / 8064 ✅ |

Both reproduce to the digit. The pairing argument the report makes from them is sound and I
verify it: under M-C1d the sweep emits no P1 line at all, so P1 alone would have shipped the
pre-A-4 bug; the C-1 named rows fail under M-C1d via P2's remove-list-cancellation arm, not
via P1.

### 1.2 M-C1b and M-C1c — **not reproducible from the report**

The report tables these as mutants "over `RestrictLabelWriteToSnapshot`". The shipped
function has **no cross-list equality test and no raw-string comparison** — it derives from
`applyLabelDelta` — so there is no line in it corresponding to either description. These are
mutants of *hypothetical alternative implementations*, and the report does not say which.

I ran the closest shipped-code analogue of "case-blind": `applyLabelDelta`'s
`removed[labelMatchKey(l)] = true` → `removed[l] = true` (`passthrough.go:1103`).

| mutant | build | test rc | failing tests | sweep P1 | sweep P2 |
|---|---|---|---|---|---|
| my case-blind analogue | 0 | 1 | 7 | 0 | **1344** |
| report's M-C1c | — | — | — | **1536** | **0** |

**The pattern is inverted** (mine: P1 blind, P2 fires; theirs: P1 fires, P2 blind). That is
not a contradiction — they are different mutants — but it means **two of the four rows in
the report's headline matrix cannot be re-derived by a reader**, which is the property a
mutation table exists to have.

*Finding P-1 [LOW, process]:* mutation tables should carry the exact diff or an anchor
string. `dev-194-r8.md` §"Pin mutation matrix" rows M-C1b/M-C1c.

### 1.3 Item 8 — the round-7 test, extracted not reconstructed

I extracted the genuine round-7 `TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel` with
`git show 1d4442f:internal/platform/github/stage_label_swap_scope_test.go`, renamed it, and
ran both versions under both defects.

| defect (mutated in `labels.go` `StageLabelSwap`) | round-7 test | round-8 test | report claims |
|---|---|---|---|
| F7: ownership ignored on removal (`ours` → `ours \|\| true`) | **RED** | **RED** | RED / RED ✅ |
| stage swap emits nothing (`!m.enabled` → `!m.enabled \|\| true`) | **GREEN** | **RED** | GREEN / RED ✅ |

Both rows confirmed. The brief's item-8 premise ("vacuous — it cannot fail") is false as
stated, and the report's correction of it is correct. Deleting that test on the brief's
wording would have removed live F7 coverage.

### 1.4 Everything else in the report's matrices — reproduced

Each row is one mutant, full `go test ./...`, exit code from the child process.

| mutant | my prediction | build | rc | failing tests | report | verdict |
|---|---|---|---|---|---|---|
| M-P1 policy check neutered | RED ≥3 | 0 | 1 | **4** | 3 | RED; **4 not 3** (see below) |
| M5a store guard removed | RED 2 | 0 | 1 | **2** | 2 | ✅ |
| M5b blank-type check neutered | RED ~6 | 0 | 1 | **7** (6 rows + parent) | 6 rows | ✅ |
| M5c length bound neutered | RED ~3 | 0 | 1 | **4** (3 rows + parent) | 3 rows | ✅ |
| M5d `CreateTask` site dropped | RED 3 | 0 | 1 | **4** (3 rows + parent) | 3 rows | ✅ |
| M5e `InsertTasksAfter` site dropped | RED 3 | 0 | 1 | **4** (3 rows + parent) | 3 rows | ✅ |
| **M5x `UpdateTask` site dropped** | RED | 0 | 1 | **4** | *absent from report* | RED — pinned |
| M6a check removed entirely | RED ~9 | 0 | 1 | **10** | 9 | ✅ (± parent row) |
| M7a AbsolutePath left relative | RED 1 | 0 | 1 | **1** | 1 | ✅ |
| M7b `Found` never set | RED 1 | 0 | 1 | **2** (1 + a WatchTasks flake) | 1 | ✅ |
| M7d found/not-found wording collapsed | RED 1 | 0 | 1 | **1** | 1 | ✅ |
| M7e `FromEnv` never set | RED 1 | 0 | 1 | **1** | 1 | ✅ |
| M7g wrapper drops `Validate` | RED 1 | 0 | 1 | **2** | 1 | ✅ (± a second test) |

Every mutant compiled (`build_rc=0`, zero `[build failed]` packages), so every one measures
something. No `COMPILE-FAIL` results.

**M-P1 discrepancy:** I count 4, not 3. The fourth is
`TestLifecycleKeyCollision_IsTheHarmTheCheckClaims`, added in the later item-6 commits — the
report's "3 (all three negative tests)" was measured before it existed and was not
re-measured at HEAD. Harmless, but it is a stale number in a table presented as HEAD state.

**M5x is a gap in the report, not in the tree.** The report's matrix covers the `CreateTask`
and `InsertTasksAfter` call sites but not `UpdateTask`'s. It is pinned (RED, 4 tests). Worth
saying because the report's own narrative is that the validator was originally wired into
the *wrong two of three* sites — an unmeasured third site is the same shape.

### 1.5 The six `stageWritePolicy` call sites — all pinned, individually

Each site flipped on its own; anchors asserted unique.

| site | `passthrough.go` | mutation | build | rc | failing tests |
|---|---|---|---|---|---|
| stage arm | :583 | allowed → forbidden | 0 | 1 | **80** |
| priority arm | :603 | forbidden → allowed | 0 | 1 | **1** |
| type arm | :614 | forbidden → allowed | 0 | 1 | **3** |
| `add_labels` arm | :628 | allowed → forbidden | 0 | 1 | **65** |
| `remove_labels` arm | :636 | allowed → forbidden | 0 | 1 | **64** |
| `ClaimTask` | :777 | allowed → forbidden | 0 | 1 | **9** |

All six RED. The two `stageWriteForbidden` sites are the load-bearing ones and are pinned by
exactly the three negative tests written for them (`stage_write_policy_test.go`) plus
`TestLifecycleKeyCollision_IsTheHarmTheCheckClaims`. The report's brief-error #1 (the brief
named the wrong call sites) is **independently confirmed**: flipping `add_labels` or
`remove_labels` to `stageWriteForbidden` breaks 65 and 64 tests respectively, so the brief's
instruction would have been caught, loudly, had the developer followed it.

---

## 2. Findings

### F-1 [HIGH] — C-1, this round's Critical, is pinned in exactly one file, with no backstop

`internal/platform/github/restrict_label_write_property_test.go`

M-C1a (round-7 implementation) goes RED with `failing_pkgs=1`. **All five failing tests are
in that one file.** Nothing at the server layer notices C-1.

The decisive measurement, and the reason this is HIGH rather than a note:

| experiment | edits | result |
|---|---|---|
| **MX3** neuter both oracles in `restrictProperties` (`:84` `if !sameLabelSet(...)` → `if false && ...`; `:132` `if len(bad) > 0` → `if false && ...`) **+ round-7 C-1 implementation restored** | 2 test lines + 1 production function | **`go test ./...` exit 0, 0 failing tests — FULLY GREEN** |
| **MX2** the same P2 neutering **+ pre-A-4 identity restrictor** (A-4, not C-1) | 1 test line + 1 production function | **RED, 2 tests**: `internal/server/authz_label_write_scope_test.go:2357` and `:2419` |

**That contrast is the finding, and it is a positive control drawn from a different axis
than the one I searched.** A-4 survives the destruction of the property file because it has
two independent server-layer pins. C-1 does not: destroy one 60-line helper function and the
Critical this entire round exists to close ships green.

This is not "the test is bad" — the property file is the best-argued test in the round. It
is that the Critical has **no redundancy at all**, on a path the report itself describes as
an authorization bypass, in a codebase where the same class of defect has now recurred
across eight rounds.

**Recommend** (developer's call, not mine to write): a server-layer C-1 pin beside the two
A-4 ones — a `task:write`-only caller issuing
`add_labels=[ft:stage/completed], remove_labels=[ft:stage/completed]` against a snapshot
lacking the label must not end up with the terminal label on the issue.

---

### F-2 [HIGH] — the designated capability probe for P2 cannot fail from any production change

`internal/platform/github/restrict_label_write_property_test.go:396-455`,
`TestRestrictLabelWriteToSnapshot_PropertiesRejectTheIdentityRestrictor`

Its docblock (`:394-395`) states the guarantee:

> *"If this test ever fails, P2 has stopped discriminating and the A-4 class is unpinned again."*

**The test never calls `RestrictLabelWriteToSnapshot`, and never calls `restrictProperties`.**
Line 411 sets `gotAdd, gotRemove := row.add, row.remove` and lines 413-435 **hand-reimplement
P2's predicate** and check the copy against itself. It is a test of a 22-line duplicate of
the oracle, not of the oracle.

Measured:

| experiment | result |
|---|---|
| **MX1** disable P2 in `restrictProperties` only (`:132`) | **suite GREEN, exit 0, 0 failing tests** — the probe does not fire |
| **MX2** disable P2 **and** revert production to the identity restrictor | the probe **still passes**; the only RED is at the server layer |

So the stated contrapositive is false in both directions: P2 stopped discriminating and the
probe stayed green; the A-4 class became unpinned in this package and the probe stayed green.

This is the brief's §3 rule — *"where a control's contract is 'mirrors function F', the
oracle must BE F, never a reimplementation of F"* — violated **inside the file whose whole
thesis is that rule**. The file's own header (`:24-30`) diagnoses the round-7 audit for
exactly this: *"it built a verification oracle that REIMPLEMENTED applyLabelDelta by hand,
which is the identical mistake the production code made."*

Severity HIGH because it is load-bearing in argument: this test is the stated reason P2 is
allowed to exist alongside P1, and the stated tripwire against someone deleting P2 as
redundant. It provides neither.

**Recommend:** make it call `restrictProperties` against an identity restrictor (inject via
a small interface or a package-level test hook) and assert `p2Fail != ""`.

---

### F-3 [MEDIUM] — "M6c survives and cannot be killed" is false; here is the kill

`internal/platform/github/config.go` (`checkLifecycleKeyCollisions`),
`internal/platform/github/lifecycle_key_collision_test.go:213-233`

The report states M6c is *"an equivalent mutant rather than a killed row"*, *"equivalent by
construction"*, *"There is no config that separates them, so no test can."*

**There is, and I wrote one.**

The separating axis is `github.labels.enabled: false` — a real YAML field
(`config.go:25-26`). `StageToLabel` returns `""` when the mapper is disabled
(`labels.go:315-317`), so:

```
enabled=false, derived oracle    owned keys = map[:true]
enabled=false, hardcoded oracle  owned keys = map[accepted completed cancelled deploying
                                                  duplicate in_qa in_review triage
                                                  wont_fix working]
```

Observable at the public boundary:

| config | shipped (`derived`) | M6c mutant (`hardcoded "ft:stage/"`) |
|---|---|---|
| `enabled: false`, `types: {duplicate: chore}` | `Validate()` → **nil** | `Validate()` → **error** |

A nine-line test asserting the shipped behaviour kills M6c. Measured:

```go
func TestLifecycleKeyCollision_DisabledMappingOwnsNoStageLabel(t *testing.T) {
	cfg := DefaultConfig()
	cfg.GitHub.Labels.Enabled = false
	cfg.GitHub.Labels.Types = map[string]string{"duplicate": "chore"}
	if err := cfg.Validate(); err != nil {
		t.Errorf("Validate() = %v, want nil: with labels.enabled=false this deployment "+
			"writes no stage labels, so a types key cannot capture one", err)
	}
}
```

| run | result |
|---|---|
| this test on HEAD | **PASS** |
| this test + M6c mutant (`owned[strings.TrimPrefix(strings.ToLower("ft:stage/"+stage.String()), "ft:stage/")] = stage`) | **RED, `failing_tests=1`** |

**And the compensating test has the M6e defect.**
`TestLifecycleKeyCollision_OracleIsStructurallyEquivalentToday` (`:213-233`) loops over four
`PushPrefix` values and nothing else; line 215 rebuilds `DefaultConfig().GitHub.Labels`
every iteration, which hardcodes `Enabled: true`. **Its fixture cannot express the input
that breaks the equivalence it exists to pin.** That is precisely the shape the report
diagnosed one section earlier in M6e — *"the control rows used keys that never exercised the
exemption they were supposed to protect… the fixture table itself was the defect"* — recurring
in the test written to compensate for M6c.

The report's methodological framing was right (*"reporting a mutation-matrix row as killed
when it is not is how this project has produced fourteen confidently wrong harnesses"*). The
conclusion — *"no test can"* — was a claim about all possible tests derived from the fixtures
that existed, which is the exact inference the report warns against elsewhere.

---

### F-4 [MEDIUM] — `checkLifecycleKeyCollisions` emits a nonsense rejection when label mapping is off, and enabled/disabled are inverted

`internal/platform/github/config.go`, `checkLifecycleKeyCollisions`, the `owned` build loop

Found while killing M6c. Measured directly:

| config | `Validate()` |
|---|---|
| `enabled: false`, `types: {"": "chore"}` | **error** — see below |
| `enabled: true`, `types: {"": "chore"}` | **nil** |

The error:

```
github.labels.types: key "" captures this deployment's own lifecycle label ""
(stage "cancelled"). …
```

It names **stage "cancelled"**, which the operator never mentioned. `cancelled` is simply
the last element of `allStages` to win the collapse of all ten stages onto the single key
`""`. The remedy the message gives ("Rename the key") is not wrong but the diagnosis is
fabricated.

Root cause: the `owned` loop does not guard `m.StageToLabel(stage)` returning `""`. Semantics
are inverted — an empty types key is rejected exactly when label mapping is **off** (when it
cannot possibly capture anything) and accepted when it is **on**.

Unpinned: no test in the round exercises `enabled: false` through this check.

Severity MEDIUM rather than LOW because it is an operator-facing authorization-config error
message that asserts a specific stage; an operator who acts on it acts on noise.

---

### F-5 [MEDIUM] — the snapshot-spelling removal (report: "closes F-2") has zero coverage

`internal/platform/github/passthrough.go:1199-1225`

Report, MUST 1: *"Removals are now emitted in the snapshot's spelling, not the caller's.
**This closes F-2 as a side effect.**"*

| mutant | result |
|---|---|
| **MF2** revert to the caller's spelling (emit the matching `removeLabels` entry instead of the `t.Labels` entry) | **suite GREEN, exit 0, 0 failing tests** |

**Why the shipped tests structurally cannot see it — brief §3, asked in the brief's order:**
*what can this oracle report?* Both P1 and P2 in `restrictProperties` compare through
`labelMatchKey`, which is `strings.ToLower(strings.TrimSpace(raw))` (`passthrough.go:1234`).
Caller-spelling versus snapshot-spelling differ **only** in case and padding — precisely the
two things the oracle normalises away. The failure is outside the oracle's range by
construction, and no number of added inputs can bring it in. 8192 triples against that oracle
answer a different question.

**The harm is real, not theoretical.** `labelNameToID` (`passthrough.go:198-203`) looks up
`s.labelIndex[strings.ToLower(name)]`, and the index is built with `strings.ToLower` and
**no `TrimSpace`**. A padded caller spelling therefore resolves to nothing,
`labelNamesToIDs` silently drops it, `writeLabelSwap` sees an empty ID list and returns
`nil` — so a **priced** removal does not land while `UpdateTask` reports success. That is
the same "a write that says nothing about what it did not do" shape the report identifies as
what kept A-4 invisible for five rounds.

A killing test (passes on HEAD; **RED, `failing_tests=1`** under MF2):

```go
func TestRestrict_PricedRemovalIsEmittedInAResolvableSpelling(t *testing.T) {
	fake := newFakeIssueRepo(t, "ft:stage/wont_fix", "bug")
	s := fake.storeWithLabelConfig(DefaultConfig().GitHub.Labels)
	if err := s.ensureLabelIndex(t.Context()); err != nil {
		t.Fatalf("ensureLabelIndex: %v", err)
	}
	tk := &ent.Task{Labels: []string{"ft:stage/wont_fix", "bug"}}
	_, remove := s.RestrictLabelWriteToSnapshot(t.Context(), tk, nil,
		[]string{"  ft:stage/wont_fix\t"})
	if len(remove) != 1 {
		t.Fatalf("PREREQUISITE BROKEN: remove = %v, want one entry", remove)
	}
	if _, ok := s.labelNameToID(remove[0]); !ok {
		t.Errorf("the narrowed removal %q does not resolve to a label ID, so the priced "+
			"removal is dropped by labelNamesToIDs and the write silently does nothing "+
			"while reporting success", remove[0])
	}
}
```

**My own error, recorded.** My first version of this probe omitted `ensureLabelIndex` and
reported RED against the *correct* tree. I caught it only because the shipped code failed
too, which is the same class as the report's own M7a self-correction. A probe that fails on
HEAD measures the probe.

---

### F-6 [LOW] — the `removeKeys` safety belt is unreachable, and the report's coverage claim for it is false

`internal/platform/github/passthrough.go:1206-1220`

Report, MUST 1: *"The `removeKeys[key]` safety belt prevents that; it is documented in the
code and **covered by a named row**."*

**There is no such row.** No entry in the named table (`restrict_label_write_property_test.go:188-286`)
has a snapshot carrying two entries that share a match key. Nor can the sweep produce one:
`snapVocab` (`:320`) is three labels with three distinct keys, so **all 8192 triples exclude
the input the belt exists for**. This is the brief's §2(b) shape — a fixture that cannot
express the input — in the round's flagship property file.

Measured:

| experiment | result |
|---|---|
| **M-SB** delete `!removeKeys[key]` from the remove-loop condition (`:1220`) | **suite GREEN, exit 0, 0 failing tests** |
| my own 32768-triple sweep with duplicate-match-key snapshots (`snapVocab` = 3 spellings of one label + 2 others), against **both** shipped and mutant | **both GREEN** |
| direct probe: `Labels: ["ft:stage/completed", "FT:STAGE/COMPLETED", "bug"]`, `add=["chore"]`, `remove=nil` | `remove = []` on both |

And a proof, not just a sweep: `after = applyLabelDelta(current, add, remove)` keeps the
**first** occurrence of each key, so a duplicated snapshot key is always present in
`afterKeys`. Therefore `!afterKeys[k] ⟹ k ∈ removed ⟹ removeKeys[k]`, and the belt can never
change the answer. The docblock's stated hazard — *"two entries sharing a match key would
make applyLabelDelta's dedup drop one, which without this test would emit a removal the
caller never asked for"* — describes a situation that cannot occur.

Low severity: the code is harmless. The finding is the **false assurance** — a documented,
named "safety belt" that no test pins and that no input reaches. Either drop it with its
paragraph, or keep it and add a test that can express the input; but the report's claim of
coverage should be withdrawn either way.

---

### F-7 [LOW] — `ConfigSource.Describe` is pinned as a function; its wiring is not

`cmd/farmtable-server/main.go:89`

| mutant | result |
|---|---|
| **M7h** replace `log.Println(ghSrc.Describe(ghCfg))` with `_ = ghSrc` | **SURVIVOR — suite GREEN** |

Seven mutants (M7a–M7g) pin the string `Describe` builds. Zero pin that it is ever emitted.
R-1's entire content is *"the server says which configuration it loaded"*; delete the one
line that says it and the suite is silent. `cmd/farmtable-server/main_test.go` has five
tests, none touching config loading.

Low because it is a diagnostic, not a control — but R-1 was filed precisely because a silent
diagnostic gap let the label-write gate run disarmed.

---

### F-8 [LOW] — doc rot

`internal/platform/github/stage_write_policy_test.go:33` points readers at
`TestValidate_RejectsATypesKeyThatNormalisesOntoAStage`. No such test exists. The actual name
is `TestValidate_RejectsAPrioritiesOrTypesKeyThatCapturesALifecycleLabel`
(`lifecycle_key_collision_test.go:34`). The two-layer argument in that header is correct;
only the pointer is stale.

---

## 3. §4 — pinned / unpinned table

Every behaviour the brief enumerated, plus three it did not. "Pinned" means I demonstrated a
compiling mutant going RED with a non-zero count of failing **tests**.

| # | behaviour | file:line | verdict | evidence |
|---|---|---|---|---|
| 1 | stage arm → `stageWriteAllowed` | `passthrough.go:583` | **pinned** | RED 80 |
| 2 | priority arm → `stageWriteForbidden` | `passthrough.go:603` | **pinned** | RED 1 |
| 3 | type arm → `stageWriteForbidden` | `passthrough.go:614` | **pinned** | RED 3 |
| 4 | `add_labels` arm → `stageWriteAllowed` | `passthrough.go:628` | **pinned** | RED 65 |
| 5 | `remove_labels` arm → `stageWriteAllowed` | `passthrough.go:636` | **pinned** | RED 64 |
| 6 | `ClaimTask` → `stageWriteAllowed` | `passthrough.go:777` | **pinned** | RED 9 |
| 7 | `assertStageWriteAllowed` fires at all | `passthrough.go:290` | **pinned** | M-P1 RED 4 |
| 8 | `assertStageWriteAllowed` runs *before* any mutation | `passthrough.go:339` | **pinned** | `stage_write_policy_test.go:84` asserts `addCalls==removeCalls==0` |
| 9 | C-1 fix: restrictor derives from `applyLabelDelta` | `passthrough.go:1167` | **pinned, single point of failure** | **F-1** — RED 5, all in one file; MX3 fully green |
| 10 | P2 capability probe | `restrict_label_write_property_test.go:396` | **UNPINNED / non-functional** | **F-2** — MX1 green |
| 11 | snapshot-spelling removal path (F-2 closure) | `passthrough.go:1199-1225` | **UNPINNED** | **F-5** — MF2 green |
| 12 | `removeKeys` safety belt | `passthrough.go:1211-1220` | **UNPINNED (and unreachable)** | **F-6** — M-SB green |
| 13 | `req.Type` shape — blank check | `server.go:101` | **pinned** | M5b RED 7 |
| 14 | `req.Type` shape — length bound | `server.go:105` | **pinned** | M5c RED 4 |
| 15 | `req.Type` wired at `CreateTask` | `server.go:219` | **pinned** | M5d RED 4 |
| 16 | `req.Type` wired at `InsertTasksAfter` | `server.go:401` | **pinned** | M5e RED 4 |
| 17 | `req.Type` wired at `UpdateTask` | `server.go:739` | **pinned** *(untabled in report)* | M5x RED 4 |
| 18 | `req.Type` **not** applied to `ListTasks` (read filter) | `server.go:577` | **unpinned, correct** | no mutant; deliberate per report — but nothing would catch a re-add |
| 19 | store guard: unknown type strips nothing | `labels.go` `TypeLabelSwap` | **pinned** | M5a RED 2 |
| 20 | `checkLifecycleKeyCollisions` exists and is called | `config.go` | **pinned** | M6a RED 10 |
| 21 | …its oracle is `StageToLabel`/`stripForMatch` | `config.go` | **UNPINNED** | **F-3** — M6c survives shipped suite, killable |
| 22 | …its behaviour under `enabled: false` | `config.go` | **UNPINNED + defective** | **F-4** |
| 23 | `LoadConfigWithSource.AbsolutePath` | `config.go` | **pinned** | M7a RED 1 |
| 24 | `.Found` | `config.go` | **pinned** | M7b RED |
| 25 | `.FromEnv` | `config.go` | **pinned** | M7e RED 1 |
| 26 | `LoadConfig` wrapper still validates | `config.go` | **pinned** | M7g RED 2 |
| 27 | `ConfigSource.Describe` found/not-found wording | `config.go` | **pinned** | M7d RED 1 |
| 28 | `Describe` is actually logged at startup | `cmd/farmtable-server/main.go:89` | **UNPINNED** | **F-7** — M7h green |
| 29 | item 8: swap declines third-party labels | `stage_label_swap_scope_test.go:412` | **pinned** | F7 mutant RED |
| 30 | item 8: a removal was *attempted* | `stage_label_swap_scope_test.go:441` | **pinned** | no-op mutant RED (r7 test GREEN) |

**Six unpinned rows (10, 11, 12, 21, 22, 28); two of them — 11 and 12 — are presented in the
report as delivered behaviour, one of those with an explicit claim of coverage.**

---

## 4. §5 — expected-clean checks (all reported, hits and misses)

| check | result | evidence |
|---|---|---|
| any test deleted? | **CLEAN** | `git diff 1d4442f..HEAD -- '*_test.go' \| grep '^-func Test'` → empty |
| any test skipped? | **CLEAN** | `grep -E '^[+-].*(t\.Skip\|SkipNow\|testing.Short)'` over the whole diff → empty |
| any assertion removed to make the round pass? | **CLEAN** | 1 removed `t.Errorf` vs **105 added**. The one removal is `stage_label_swap_scope_test.go`'s *"our own stage label went missing"*, replaced in the same hunk by *"our own stage label was not stamped"* plus the new `removeCalls != 0` assertion. Strictly stronger. |
| wall-clock dependence introduced? | **CLEAN** | no `time.Sleep` / `time.Now` / `time.After` / `rand.` added in any test file this round |
| map-iteration-order dependence introduced? | **CLEAN, with a note** | one `range` over a map literal, `lifecycle_key_collision_test.go:91`. It is a prerequisite loop that `t.Fatalf`s if *any* of three tables errors, so the pass/fail outcome is order-independent. Only the *message* could vary, and only if two tables failed at once. Not a defect. |
| `t.Parallel` shared-state races in new tests? | **CLEAN** | **no `t.Parallel` anywhere in `internal/platform/github`**, and none in `internal/server/task_type_validation_test.go`. Note for the future: `config_source_test.go` uses `t.Setenv` at :27/:60/:113/:154, which is process-global — adding `t.Parallel` to *any* test in that package later would be a real race. Worth a comment in the file. |
| `gofmt -l` on touched dirs | **CLEAN** | only pre-existing `internal/server/scopes.go`; report's claim confirmed |
| `go vet` unchanged | **CLEAN** | post-experiment output `diff`-identical to baseline |

**Green controls are findings and here they are written down**: the round did not weaken
anything to go green. Every one of the eight checks above came back clean. The problems in
this report are gaps in what was added, not damage to what existed.

---

## 5. Every place this brief was wrong

Required deliverable. I checked all nine `[MEASURED]`/`[MEASURED-BY]` claims in the brief.
**Four are confirmed exactly; one is contradicted; two framing errors; one scope gap.**

### 5.1 Contradicted — the `TestWatchTasks*` flake rate

> `[MEASURED-BY-dev-194-r8]`: 0 failures in 12 sequential full-suite runs

**Not reproducible here.** Across **26 sequential full-suite `go test ./...` runs** during
mutation work (no concurrency applied by me), `TestWatchTasks_CreatedEvent` failed **twice**
— in `MC1d` and `M7b_found_never_set`, both mutants confined to `internal/platform/github`
and `internal/platform/github/config.go` respectively, i.e. incapable of affecting
`internal/server`'s streaming tests.

So the flake **does** appear in ordinary sequential runs, at roughly 8% per full-suite run on
this machine — consistent with the brief's own earlier "2 of 9" figure and **inconsistent
with the report's "0 of 12 sequential"**. The brief relays the report's number and treats the
pre-existing-ness as settled; the pre-existing-ness I do not dispute, but the *rate* claim is
wrong and it is the operationally important one. At an 8% per-run rate, **a single-run
mutation matrix has roughly a 1-in-12 chance of scoring a spurious RED on any given row**.
Two of my own rows (M-C1d, M7b) carry exactly that contamination and I have flagged them
inline. Anyone reading a mutation table on this project should be told the row count includes
a flake.

### 5.2 Framing error — §1's table attributes four mutants to one function

The brief says *"a mutation matrix of 8192 triples per run over `RestrictLabelWriteToSnapshot`,
with four mutants"*, and instructs me to re-derive them. **Two of the four (M-C1b, M-C1c) are
not mutants of `RestrictLabelWriteToSnapshot`** — that function contains neither a cross-list
equality test nor a raw-string comparison, because it derives from `applyLabelDelta`. They are
mutants of hypothetical alternative implementations that the report does not specify. The
instruction as written is not executable for half the table. See §1.2; my closest analogue
produces the *inverted* P1/P2 pattern.

### 5.3 Framing error — §1's "confirm the suite goes RED" is the wrong bar for two rows

The brief's bar is "for each pin the round added, apply a mutation that should break it and
confirm RED". Applied literally to rows 11 and 12 of my §3 table, there is no mutation to
apply, because there is no pin — the bar silently passes over exactly the two behaviours the
report claims as delivered and the suite does not cover. The productive question, which I
took from §2(b) instead, is "what input can this fixture not represent?". Both F-5 and F-6
came from that question and neither would have come from the §1 bar.

### 5.4 Scope gap — §4's enumeration omits the three places the round is actually weakest

§4 lists seven behaviours to classify. It does not list: the C-1 derivation's *single point
of failure* (F-1), `restrictProperties` as a **load-bearing test helper with no self-test**
(F-2), or the `enabled: false` path through `checkLifecycleKeyCollisions` (F-3/F-4). Three of
my four highest-severity findings sit outside the brief's enumeration. Not a factual error —
but a checklist that enumerates production behaviours and never asks "what pins the pins?"
will keep missing F-2-shaped defects, and F-2 is the second one of that shape this workstream
has produced.

### 5.5 Confirmed exactly — recorded so the ledger is not built only from hits

- `go build ./...` → exit 0 ✅ (my initial contrary result was the broken `.git`, withdrawn)
- `go test ./...` → exit 0, zero FAIL lines ✅
- `go vet ./...` → exit 1, exactly 4 copylocks ✅
- vet **messages and line numbers** 1782/1892/2100/2277, checked as text not count ✅
- `make race` covers only `internal/platform/github`; no CI ✅ (read `Makefile`)
- the brief's self-declared error #2 (item 8 "vacuous") **is** an error — re-derived against
  the real `1d4442f` artefact, both rows ✅
- the brief's premise that the report's mutation tables should not be inherited ✅ — one
  stale row found (M-P1: 3 vs 4) and two unreproducible rows

### 5.6 On the EM's mid-session claims

Both checked, both correct: the `53edc46..HEAD` delta is one docs-only descendant commit
(§0.1), and the `-buildvcs=false` requirement was an artefact of the broken object store, not
a property of the code (§0.1). I am confirming *their* measurements with *mine*; neither is a
brief error.

---

## 6. Severity summary

| id | severity | one line | file:line |
|---|---|---|---|
| **F-1** | **HIGH** | C-1 pinned in one file; neuter one helper and the Critical ships green | `restrict_label_write_property_test.go:77` |
| **F-2** | **HIGH** | the P2 capability probe reimplements P2 and cannot fail from production | `restrict_label_write_property_test.go:396` |
| **F-3** | MEDIUM | M6c is killable; the compensating test has the M6e fixture defect | `lifecycle_key_collision_test.go:213` |
| **F-4** | MEDIUM | fabricated collision error under `enabled: false`; semantics inverted | `config.go` `checkLifecycleKeyCollisions` |
| **F-5** | MEDIUM | snapshot-spelling removal (claimed F-2 closure) has zero coverage | `passthrough.go:1199` |
| **F-6** | LOW | `removeKeys` belt unreachable; report claims a covering row that does not exist | `passthrough.go:1211` |
| **F-7** | LOW | `Describe` never asserted to be logged | `cmd/farmtable-server/main.go:89` |
| **F-8** | LOW | stale test-name reference | `stage_write_policy_test.go:33` |
| **P-1** | LOW | mutation tables not reproducible from the report (M-C1b/M-C1c) | `dev-194-r8.md` |
| **P-2** | LOW | M-P1 row stale at HEAD (3 vs 4) | `dev-194-r8.md` |

**Blocking for merge:** F-1 and F-2. Both are cheap — one server-layer test and one rewrite
of an existing test's plumbing. F-3/F-4/F-5 are strongly recommended in the same pass; each
has a measured killing test in this report.

---

## 7. Artefacts

- harness: `/tmp/mut.py`; specs `/tmp/specs/*.json`; per-mutant full logs `/tmp/mut_*.log` (30)
- probe source (removed from the tree before finishing): `/tmp/probes_kept.go`
- pristine manifest: `/tmp/pristine/go.sha256` (243 files), snapshot `/tmp/pristine/src.tar`
- final tree state: `git status --porcelain` empty; `git diff --quiet` exit 0; no production
  file modified
