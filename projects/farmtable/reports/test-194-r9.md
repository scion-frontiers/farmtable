# test-194-r9 — test-engineering review of `label-write-scope-r9` @ `06f01d7`

**Leg:** test-engineering (1 of 3 independent legs; code-review and security-audit ran in parallel and
their reports were not visible to me).
**Commit under review:** `06f01d7d6555a311fcd0728eac40335e654c1de6`, branch `label-write-scope-r9`.
**Tree:** `/workspace` (see brief-error B1).
**Axis:** *can this evidence fail?*

## Verdict: REQUEST CHANGES

This is the strongest evidence work in the #194 sequence. The MUST 2 remedy is a **perfect permutation
matrix under two independent mutation styles**; MUST 1's pin is a real pin and not coverage locality;
MUST 4's property is a genuine property and survives 200,000 triples drawn from an alphabet far outside
the fixture vocabulary; over-strictness is protected by 290 tests, not zero. **18 of 19 mutants were
killed.** I expected to find the evidence hollow on at least one MUST and it was not.

I am nevertheless requesting changes on two findings, one of which is a recurrence of the exact defect
class MUST 4 was written to eliminate:

- **F1 (Medium)** — MUST 4 replaced a *false* rationale with a rationale that is **true in structure but
  misdescribed in its operative detail**. The mutant named in-source produces the *opposite* of the
  documented result. A future engineer following the written instruction sees P4 silent and concludes
  the belt is dead code. That is precisely the deletion this file exists to prevent.
- **F2 (Medium)** — the vacuity census is **5 guarded / 17 total**, and the two brand-new MUST 1 server
  tables are both among the unguarded. The round's headline test asset cannot fail when emptied.

Both fixes are cheap (a corrected comment; two guard clauses). Neither touches production behaviour.
Nothing I found contradicts the round's substantive security claims.

---

## Method and baseline

Everything below tagged **[MEASURED]** was run by me this session against `06f01d7`. I reconstructed
the gate rather than accepting the handed baseline, per the standing warning.

**Gate reconstruction [MEASURED]** (final state, after all mutation work, tree clean):

| gate | exit | note |
|---|---|---|
| `go build ./...` | 0 | |
| `go vet ./...` | 1 | 4 copylocks, **matched by message** not just count — all four are `assignment copies lock value to ephReq` at `internal/server/server.go:{1782,1892,2100,2277}`. Pre-existing, out of scope. |
| `go test ./internal/platform/github/` | 0 | 619 subtests |
| `go test ./internal/server/ -skip 'TestWatchTasks'` | 0 | 894 subtests |
| `go test ./cmd/farmtable-server/` | 0 | |

**Flake containment [MEASURED].** Server cells were constrained with `-skip 'TestWatchTasks'`. I verified
against a `-v` baseline that the excluded tests match **zero lines** in the selected set (github: 0 lines;
server: 0 lines). A tripwire grepped every RED output for `TestWatchTasks`.
**The tripwire never fired — in any mutation cell, any matrix cell, or any census cell.**

**Revert discipline.** All reverts were snapshot restores (`cp` from `/tmp/r9/snap/`), never `git checkout`.
Exit codes were taken from the child process directly (`cmd > f 2>&1; echo $?`), never through a pipe.

**Dirty cells: 3 — and they were my bug, not the repo's.** My census harness's restore list omitted
`internal/platform/github/terminal_label_stages_test.go`, so the TS1 mutation persisted and contaminated
the dirty accounting for the TS1, AZ1 and AZ2 cells. Detected via `git status --porcelain`, repaired from
the tar snapshot, and confirmed clean. **The measured results for those three cells are unaffected** — only
the cleanliness bookkeeping was. I report this rather than quietly re-running because a harness that can
silently leak state between cells is exactly the failure mode this discipline exists to catch.

**Final state [MEASURED]:** `git status --porcelain` empty, `git diff HEAD` empty, HEAD still `06f01d7`.

---

## Deliverable 2 — the MUST 2 arm × restrictor matrix

`p2Violations` has **exactly one definition and exactly two call sites** [MEASURED] — the
"probe drives P2 itself" claim is structurally true, not just asserted.

I deleted each of the five arms in turn, under **two independent mutation styles**: `delete` (remove the
whole `case` clause) and `empty` (keep the `case` label, drop its body). The second style controls for the
possibility that deleting a clause changes control flow in some way that trips a different arm.

**Result: a clean permutation matrix, identical under both styles.** Exactly one subtest RED per arm,
and the RED subtest is the one named for that arm.

| arm deleted | restrictor that went RED | other arms' rows | pkg exit |
|---|---|---|---|
| A1 `gotAdd` / `k == ""` | `…RejectTheIdentityRestrictor/add_names_no_label` | all GREEN | 1 |
| A2 `gotAdd` / `present[k]` | `…/add_already_on_the_snapshot` | all GREEN | 1 |
| A3 `gotAdd` / `removeKeys[k]` (C-1) | `…/add_cancelled_by_the_remove_list` | all GREEN | 1 |
| A4 `gotRemove` / `k == ""` | `…/remove_names_no_label` | all GREEN | 1 |
| A5 `gotRemove` / `!present[k]` (A-4) | `…/remove_absent_from_the_snapshot` | all GREEN | 1 |

**No arms overlap.** No other test in the package moved in any of the ten cells. The failure messages name
the arm precisely (`gotAdd / removeKeys (C-1)`, `gotRemove / !present (A-4)`, etc.).

**The MUST 2 remedy is verified.** The round-8 defect — a multi-arm oracle read through a single-bit
result, where one arm masked another — is genuinely fixed, and fixed in the way claimed. Mutual exclusion
per entry is structural (the arms live in two `switch` statements, so at most one arm fires per label),
which is *why* the matrix is a permutation and not merely observed to be one.

### The two negative rows (brief item 2)

Asked directly: **no, the negative rows do not require a positive outcome** [MEASURED].

| probe mutation | 5 positive rows | 2 negative rows |
|---|---|---|
| `p2Violations` returns `nil` (arm population emptied) | all 5 RED | **both GREEN** |
| `p2Violations` objects to everything | — | **both RED** |

So the negative rows are discriminating **in their intended direction** (they catch a restrictor that
over-reports) but are structurally incapable of failing when the arm population is emptied — they assert
absence, and absence is what an empty population yields.

**I am not filing this as a defect.** The emptying direction is fully and precisely covered by the five
positive rows, which is the correct division of labour: positive rows pin the arms, negative rows pin
against over-reporting. The pairing is sound. It is worth stating explicitly in the report because the
brief asked, and because the *general* form of this observation is F2 below, where it is not benign.

---

## Deliverable 3 — vacuity census

Criterion applied: *a loop is non-vacuous exactly when some assertion **requires a positive outcome** from
it.* Every added/modified loop and fixture table in the diff was forced to iterate zero times and the
suite re-run.

**Repo-wide convention note, stated once as instructed:** Go reports a table test with zero subtests as
PASS by design. Every unguarded row below is an instance of that convention, not seventeen separate
authoring mistakes. The remedy is a `len(rows) == 0` / executed-counter guard, which this round already
demonstrates it knows how to write — three of the five guarded loops use exactly that pattern with a
named diagnostic (`SWEEP BROKEN: executed 0 triples`, `VACUOUS: no row was rejected`).

| file | guarded / total | guarded loops | unguarded loops |
|---|---|---|---|
| `restrict_label_write_property_test.go` | **2 / 5** | RP2, RP5 (`SWEEP BROKEN: executed 0 triples`) | RP1, RP3, RP4 |
| `all_stages_test.go` | **2 / 4** | AS1, AS2 | AS3, AS4 |
| `lifecycle_key_collision_test.go` | **1 / 5** | LK3 (`VACUOUS: no row was rejected`) | LK1, LK2, LK4, LK5 |
| `terminal_label_stages_test.go` | **0 / 1** | — | TS1 |
| `authz_label_write_scope_test.go` | **0 / 2** | — | **AZ1, AZ2** |
| `cmd/farmtable-server/main_test.go` | **0 / 0** | — | no loops (three explicit `t.Run`s) |
| **total** | **5 / 17** | | |

**Method correction worth recording:** the `AS1_protoEnum_map` cell initially read as RED, but that RED was
a *build failure* — emptying the `pb.TaskStage_name` range left the `pb` import unused. I redid it
preserving `_ = pb.TaskStage_name` and confirmed a **genuine** RED. A build failure counted as a kill is a
false positive in exactly the direction that flatters the code under review, and I would have reported
6/17 if I had not checked. I recommend any future leg running a mutation harness against Go treat
`buildfail` as a distinct outcome from RED, as mine now does.

**AZ1 and AZ2 are the finding** — see F2.

---

## Deliverable 4 — mutation table, predictions stated before measurement

Predictions were written down before each cell was run. Score: **18 killed / 19 mutants**, **17 of 18
predictions correct**, **1 miss**. The miss produced the sharpest finding in this report, which is the
outcome the brief predicted it would be.

| # | mutant | prediction | measured | ✓ |
|---|---|---|---|---|
| 1–5 | delete arms A1–A5 | exactly one named restrictor RED each | permutation matrix, 5/5 | ✓ |
| 6–10 | empty arms A1–A5 | same as delete | identical | ✓ |
| 11 | `C1_unwire_perlist_filters` | new MUST 1 server test RED **in its own package** | server: `…CrossListCancelCannotApplyATerminalLabelForFree/absent_from_the_snapshot/{identical_spelling,case_split,pad_split}` RED | ✓ |
| 12 | `P3_revert_caller_spelling` | MUST 3 rows RED both layers | gh: 2 named rows + sweep; server: `…APricedRemovalLandsWhateverTheCallerSpelling/{padded_only,padded_and_recased}` | ✓ |
| 13 | `MUST4_delete_removeKeys_belt` | nothing RED (belt unreachable today) | **0 failures**, gh and server | ✓ |
| 14 | `MUST4_COMBINED` belt-deleted + drift **as described in-source** | P4 fails on 128 of 16384 | **P4 completely silent; belt states indistinguishable** | ✗ **MISS** |
| 15–16 | `driftB` belt present / deleted | (post-miss) belt becomes visible | P4 silent / **P4 = 256** | — |
| 17–18 | `driftC` belt present / deleted | (post-miss) reproduces 128 | P4 silent / **P4 = 128 of 16384** | — |
| 19 | `MUST5_delete_enabled_guard` | exactly one test RED | `TestAuthorizationStage_IsSilentWhenLabelMappingIsOff`, **and nothing else** | ✓ |
| 20 | `MUST5_validation_respects_toggle` | toggle test RED | `TestValidate_LifecycleKeyCollisionIgnoresTheEnabledToggle` + 3 rows | ✓ |
| 21 | `GREEN_allow_overwrite` | which-stage assertion RED, 200-run half silent | RED at line 434 naming `ft:stage/wont_fix`; **200-run half did not fire** | ✓ |
| 22 | `WIDENING_drop_labelToStage_source` | alias tests RED | 2 tests + 2 alias rows RED | ✓ |
| 23 | `EMPTYKEY_guard_removed` | all three empty-key rows RED | **only 1 of 3** RED (see F4) | ✓ (direction) |
| 24 | `OVERSTRICT_restrictor_returns_nothing` | some tests RED | 8 gh + **104 server** RED | ✓ |
| 25 | `OVERSTRICT_policy_refuses_allowed` | some tests RED | 16 gh + **186 server** RED | ✓ |
| 26 | `BANNER_drops_the_path` | banner test RED | `…BannerNamesTheConfigurationTheServerWillUse/{a_file_that_loads,a_file_that_does_not_exist}` | ✓ |
| 27 | `BANNER_leaks_on_error` | error-path row RED | `…/a_file_that_fails_validation` | ✓ |

*(Cells 15–18 were diagnostic follow-ups to the miss and carried no prior prediction, so they are excluded
from the score denominator rather than scored as free wins.)*

---

## Findings

### F1 — Medium — MUST 4's in-source proof names a mutant that does not produce its documented result

**Where:** `internal/platform/github/passthrough.go`, lines 1266–1274 (the `removeKeys` belt rationale).

**The claim in source:** *"Deleting it against an applyLabelDelta mutated to drop labels whose name is not
already trimmed makes property P4 … fail on 128 of 16384 triples, where with the clause present P4 is
silent."*

**Reproduction [MEASURED].** Three readings of "drop labels whose name is not already trimmed", each run
with the belt present and the belt deleted, against `go test ./internal/platform/github/ -count=1 -v`:

| drift predicate in `applyLabelDelta` | belt present | belt deleted | distinguishes? |
|---|---|---|---|
| `l != strings.TrimSpace(l)` — **the literal reading of the comment** | P4 silent | **P4 silent** | **no** |
| `l != labelMatchKey(l)` (case + padding) | P4 silent | P4 = **256** of 16384 | yes |
| `l != strings.ToLower(l)` (case only) | P4 silent | P4 = **128** of 16384 | **yes — the author's number** |

**Root cause.** The exhaustive sweep's snapshot vocabulary is
`{completed, ToUpper(completed), "bug", "ft:stage/accepted"}` — it contains **no padded entry**. A
trim-based drift therefore can never drop a snapshot label, so the belt is never reached and P4 is silent
in both states. The author's 128 is real and I reproduced it exactly, but it comes from a **case-only**
drift, not a trim-based one.

**Why this is Medium and not Low.** MUST 4's entire purpose was to replace a *false* rationale for this
belt with a verifiable one. The replacement is true in structure — the belt *is* load-bearing under drift,
and P4 *is* the property that sees it — but the operative detail is wrong in the one direction that
matters. An engineer doing exactly what the comment says will observe P4 silent, conclude the belt is
unprotected dead code, and delete it. That is the same class of outcome the commit was written to prevent,
reached by following the commit's own instructions.

**Confirming the author's secondary claim [MEASURED]:** under driftC, P1 fires at 384 in *both* belt
states, so the suite is RED either way; **P4 is the only property that distinguishes the belt states.**
The "P1/P2/P3 could not see it" claim is correct.

**Remedy (cheap, comment-only):** change "not already trimmed" to "not already lower-case", or add a padded
entry to `snapVocab` so the trim reading also reaches the belt. I have deliberately not chosen between
these — that is the developer's call.

### F2 — Medium — both new MUST 1 server tables are vacuous when emptied

**Where:** `internal/server/authz_label_write_scope_test.go` — AZ1 (`for _, row := range absent`) and AZ2
(`for _, sp := range spellings`).

**Reproduction [MEASURED]:** replace with `absent[:0]` / `spellings[:0]`; run
`go test ./internal/server/ -count=1 -skip 'TestWatchTasks'` → **exit 0, GREEN**.

**Why it matters here specifically.** MUST 1 is +173 lines whose stated purpose is to give C-1 a
server-layer pin. The pin itself is real — F-positive below — but the *table that drives it* cannot report
its own disappearance. If a future refactor drops a row (or the whole slice) from `absent`, the suite stays
green and the C-1 pin silently degrades. This is the round's headline test asset and it is the least
guarded loop in the diff.

Note this is a strictly different claim from the negative-rows observation above: there, the emptying
direction was covered by five sibling positive rows. Here **nothing** covers it.

**Remedy:** an executed-counter guard with a named diagnostic, matching the pattern already used at RP2,
RP5 and LK3 in this same diff.

### F3 — Low — 12 of 17 added/modified loops are unguarded against vacuity

The full census is Deliverable 3. Filing once, as a single finding, per the brief's instruction not to
file per-table. Beyond AZ1/AZ2 (F2), the ones I would guard next are RP1 and RP3 — the
`NamedDefectShapes` and identity-probe row tables — because they are the fixtures that carry the named
defect shapes C-1 and A-4.

### F4 — Low — two of the three empty-key rows do not pin the empty-key guard

**Reproduction [MEASURED]:** remove the `if key == "" { return }` guard in `checkLifecycleKeyCollisions`.
Only `TestValidate_StillAcceptsLegitimateConfigs/empty_keys_in_the_stages_and_types_tables_at_once` goes
RED. The rows *"an empty types key"* and *"a whitespace-only priorities key"* both survive.

**Root cause:** with `enabled` forced true via `asIfEnabled`, the write side never yields an empty key;
only an empty key in the **`stages`** table reaches `owned`. The two surviving rows are therefore testing a
path that cannot produce the condition they are named for. They are not wrong, but they are not pinning
what their names promise.

---

## Positive findings — claims I tried to break and could not

These are recorded because a review that only lists defects misrepresents the round.

- **F-positive 1 — MUST 1's pin is a real pin, not coverage locality.** The brief warned that coverage
  firing only from another package is not a pin. `C1_unwire_perlist_filters` turns
  `TestUpdateTask_CrossListCancelCannotApplyATerminalLabelForFree/absent_from_the_snapshot/{identical_spelling,
  case_split,pad_split}` RED with the **server package run on its own** [MEASURED]. It is the new test, not
  a sibling.

- **F-positive 2 — MUST 4's property is genuine, not a fixture restatement.** Form (7) does **not** apply.
  A 200,000-triple randomised probe over an alphabet deliberately outside the fixture vocabulary
  (`"日本語ラベル"`, `"Ünïcøde"`, `"emoji🏷️label"`, `strings.Repeat("x",300)`, mixed padding/case, empty and
  whitespace-only entries) produced **47,177 duplicate-key snapshots, 27,316 real drops, 0 violations**
  [MEASURED]. A parallel probe over the same 200,000 triples gave **P1=0 P2=0 P3=0 P4=0**. Both probes
  carried their own vacuity guards, and the non-zero drop and duplicate counts are the positive control
  proving the probe could have seen a violation. Probe file removed; tree verified clean.

- **F-positive 3 — the green control was fixed correctly and is honestly labelled.**
  `GREEN_allow_overwrite` turns **only** `TestLifecycleKeyCollision_DiagnosticNamesTheDeploymentsOwnStage`
  RED, and specifically at the **which-stage assertion** (line 434, naming `ft:stage/wont_fix`). The
  retained 200-run determinism half **did not fire** [MEASURED]. So: the new assertion is discriminating,
  and the 200-run half is a genuine green control that is labelled in-source as exactly that and is not
  claiming to do work it cannot do. This is the correct way to retain a control that cannot fail.

- **F-positive 4 — over-strictness is heavily protected. The answer to brief item 8 is emphatically not
  "none."** `OVERSTRICT_restrictor_returns_nothing` → 8 github + **104 server** RED.
  `OVERSTRICT_policy_refuses_allowed` → 16 github + **186 server** RED, including a test literally named
  `TestStageWritePolicy_StageMovingPathsAreStillAllowed` and several explicit positive controls
  (`TestAuditR5_PositiveControl_TheProbeCanObserveAnAllow`). A legitimate `task:close` holder being denied
  would be caught immediately and loudly.

- **F-positive 5 — MUST 5's "and nothing else" claim is exact.** Deleting the `!m.enabled` guard turns
  exactly one test RED, matching the in-source claim verbatim [MEASURED].

- **F-positive 6 — the SHOULD banner extraction is pinned on both arms.** Dropping the path and leaking on
  error each turn a distinct named subtest RED [MEASURED]. (This cell initially failed to build because my
  mutant left `src` unused; redone with `src` consumed. Recorded so the result is not mistaken for a
  first-try kill.)

- **F-positive 7 — `stageWritePolicy` is a struct, not a named bool**, so `false` / `true` / `0` are
  compile errors and the zero value is `stageWriteForbidden`. Fail-closed by construction.

---

## Deliverable 6 — every place the brief is wrong

| # | brief statement | actual |
|---|---|---|
| B1 | *"Your working tree is /workspace"* — later self-corrected to *"if /workspace is not a repository, your tree is /workspace/farmtable-194-r9-test"* | **Both halves wrong for me.** `/workspace` **is** a git repository here and `git rev-parse --show-toplevel` succeeds; `/workspace/farmtable-194-r9-test` does not exist. The correction's own fallback would have sent me nowhere. Self-reported by the coordinator, and it still counts — but the *fallback* is a second, unreported error. |
| B2 | reports/briefs paths implied relative to the tree | They are absolute, outside the repo, at `/scion-volumes/scratchpad/projects/farmtable/`. Self-reported. |
| B3 | baseline block states `go test ./...` = exit 0 as flat fact | **Probabilistic, not a fact.** My *first* full-suite run failed on `TestWatchTasks_NoInitial` (`watch_test.go:118: timed out waiting for event`, exit 1). Second run exit 0. A baseline stated as a flat fact is the exact "handed vs built" trap the coordinator warned about — a leg that ran it once and trusted the brief would have reported a phantom regression. |
| B4 | *"flakes at ~8% per full-suite run"* | I observed **1 failure in 2** sequential full-suite runs. Small sample, so I do not claim 50% is the true rate — but 8% stated without a confidence interval understates the risk to a single-run matrix, which is the whole reason containment is mandated. |
| B5 | item 1 frames arm overlap as a live risk needing detection (*"if it is not a permutation matrix, say which arms overlap"*) | It **is** a permutation matrix, and necessarily so: the arms sit in two `switch` statements, so at most one arm can fire per label. The brief treats as an empirical question something that is structurally guaranteed. Worth measuring anyway — I did — but the framing overstates the risk. |
| B6 | item 5 asks *"Mutate the diagnostic to name a different stage and confirm RED"* | The available production mutation is the `owned` no-overwrite rule, not a direct "name a different stage" edit; the diagnostic's stage is derived, not literal. I achieved the brief's *intent* via `GREEN_allow_overwrite`, but the mutation as literally specified is not applicable to this code. |
| B7 | item 8 hypothesises the answer may be *"none"*, and calls that a finding | Not merely non-zero — **290 tests** across two packages fail under over-strictness mutants. The brief's suspicion is inverted for this round. |
| B8 | *(not a brief error — flagged for the record)* | The **in-source** MUST 4 comment is wrong; that is F1, a code finding, not a brief finding. Listed here only so it is not double-counted as both. |

---

## What I would want the next round to check

1. Whether F1's corrected mutant description is reproducible **by someone who did not write the fix** —
   the failure mode here was a description that only its author could follow.
2. Whether the vacuity guards added for F2/F3 are themselves non-vacuous (a guard that cannot fire is the
   same defect one level up).
3. The `enabled=false` write-authorization finding already ruled into r10. My mutation work did not
   sharpen it beyond what is already recorded, and per the brief I designed no fix for it.

## Scope discipline

Excluded as instructed and **not** filed as defects: the 4 pre-existing vet copylocks; the `web/dist`
clean-checkout condition (#100); the `enabled=false` write-authorization finding (ruled, r10).
I did not scope around what I assumed the other two legs would cover.
