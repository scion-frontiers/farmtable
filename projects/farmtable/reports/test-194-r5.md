# TEST REVIEW — #194 round 5, `label-write-scope` @ `ea8ac39`

**VERDICT: APPROVE WITH FINDINGS** (no blocking defect in the shipped controls;
two Medium coverage findings should be sequenced before round 6 closes the
prefix theme.)

The three controls (B1, B5, B6) do what the log says they do. I reproduced the
developer's headline mutation claims exactly, independently, and they hold. The
log is unusually honest — several of its disclosures are what let me find the
findings below, and one of them (the `shipped: completed` note) turned out to
understate its own consequence.

Nothing here argues the branch should not merge. The findings are about what the
~2300 new lines of test *cannot see*.

## Severity summary

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | T-1 configured terminal aliases are untested *and* the documented remediation is dead; T-2 `store.go` fallbacks are unreachable duplicates of `multistore.go`'s |
| Low | 3 | T-3 swap test never swaps; T-4 `identity_test.go` panic is a real latent flake that truncates runs; T-5 stale control-attribution comment |
| Info | 3 | T-6 REV9 has a live tripwire (charge refuted); T-7 B3 sweep is discriminating; T-8 gate reproduced |

## Charge-by-charge outcome

| Charge | Outcome |
|---|---|
| 1. Mutation-test B5/B6 yourself | **Claims CONFIRMED.** Kill sets matched exactly. 17 valid mutations run. |
| 2. What can the fixtures not express (PRIORITY) | **T-1.** `LabelConfig.Stages` still varied by zero tests; round-4 F-3 is not closed and B6 made it load-bearing. |
| 3. Deletable-green | **None found.** Every ablation-tested control is uniquely load-bearing. Two survivors traced to T-2, not to weak tests. |
| 4. Inverted tests preserved cells | **Yes — cells preserved and strengthened.** Count pin 6→12 is sound. Naming issue only (T-3). |
| 5. Dismissal of the panic | **Right about causation, wrong about consequence.** T-4. |
| 6. REV9 tripwire | **Refuted — REV9 has a live, uniquely load-bearing tripwire.** T-6. |
| 7. B3 sweep discriminating | **Yes.** T-7. |

---

## T-1 (Medium) — Configured terminal aliases: untested surface, and the documented remediation produces a dead alias

**BY EXECUTION.**

`internal/platform/github/labels.go:144`, `internal/platform/github/labels.go:542`,
`internal/platform/github/terminal_label_stages.go:46`

### The gap

My round-4 finding F-3 was that no test anywhere varies `LabelConfig.Stages`.
B6 varies `push_prefix`. **Nothing yet varies `Stages`.** I swept the tree:

```
grep -rn "Stages:" --include='*_test.go' internal/
```

Zero test sets `cfg.GitHub.Labels.Stages`. Every fixture in the repository
inherits the alias map from `DefaultConfig()`. Per shared-brief bar 5, a
configuration that exists only outside the tree is a fixture that cannot express
the input — and B6 just made that input decide authorization.

The developer disclosed the surface honestly:

> **Not covered by B6**: a deployment that configures custom terminal aliases in
> `LabelConfig.Stages` (e.g. `shipped: completed`) must now spell them with the
> prefix. No such configuration exists in-tree.

Both halves of that sentence are checkable. I checked them.

### Reproduction

Probe harness `zz_probe_r5test_test.go`
(sha256 `77feb051a6245435abb407a4438dd1c2654d71db6df38cf2da10bc0442fce19b`),
copied into `internal/server/`, run, deleted; tree verified clean before and
after. Full output: `salvage/r5-test-194/probe_rerun.txt`.

```
go test ./internal/server/ -run 'TestProbeA' -v -count=1
```

Measured, for `cfg.GitHub.Labels.Stages = {<key>: "completed"}`, `push_prefix="ft:"`:

```
key="shipped"     label="shipped"     | lifecycle="accepted"  available=true  reasons=[]         | display="completed",true | AllTerminalLabelStages=[]
key="shipped"     label="ft:shipped"  | lifecycle="completed" available=false reasons=[terminal] | display="completed",true | AllTerminalLabelStages=[completed]
key="ft:shipped"  label="ft:shipped"  | lifecycle="accepted"  available=true  reasons=[]         | display="",false         | AllTerminalLabelStages=[]
key="ft:shipped"  label="shipped"     | lifecycle="accepted"  available=true  reasons=[]         | display="",false         | AllTerminalLabelStages=[]
```

### Two distinct problems

**(a) Row 1 is a display/authorization divergence on a supported surface.** A
deployment that configures `shipped: completed` and applies the label `shipped`
gets a task that **renders as `completed` in the UI but authorizes as
`accepted` — available and claimable.** This is not the ruled-and-accepted
stock-label cost: `duplicate` is GitHub's label with no Farm Table meaning,
whereas `shipped` is a Farm Table alias the operator deliberately configured.
The operator's own configuration is silently half-honoured.

**(b) Row 3 is worse: the developer's stated remediation yields a completely
dead alias.** Following "must now spell them with the prefix" literally on the
config *key* gives `display="",false` — the alias stops working for display
*as well as* authorization. Root cause:

- `buildLabelMapper` (`labels.go:144`) stores the config key **verbatim**:
  `m.labelToStage[strings.ToLower(label)] = stage`
- `stripForMatch` (`labels.go:542`) strips `matchPrefix()` **before** the
  `labelToStage` lookup

So a prefixed key can never be hit by a stripped lookup. The remediation in the
log cannot be followed as written. An operator who reads the log entry and acts
on it turns a half-working alias into a fully broken one.

### Recommended fix

Not a code change from me (collecting, not fixing). Two things belong in round 6:

1. Correct the log entry's remediation sentence — the working spelling is a
   **bare config key with a prefixed label** (row 2), not a prefixed key.
2. Add a test that varies `LabelConfig.Stages` and pins all four cells above.
   Row 2 is the intended-working cell and is the one with no coverage at all.
   Closing F-3 for real requires the config to become a fixture input.

---

## T-2 (Medium) — `store.go`'s fallbacks are unreachable duplicates of `multistore.go`'s

**BY EXECUTION.**

`internal/store/store.go:133`, `:152` — duplicated at
`internal/store/multistore.go:250`, `:263`

Charge 1 asked me to mutate "the `store.go` fallback that wraps a singular
answer in a one-element set." I did. Two mutations survived:

| Mutation | File | Top-level failures |
|---|---|---|
| `MUT_DELTA_FALLBACK` | `store.go:152` | **0** |
| `MUT_NATIVE_SPURIOUS` | `store.go:133` | **0** |

Per bar 6 I did not file these as weakened controls until I established *why*
they survived. `MultiStore` carries its own copies of both fallbacks, and the
production object graph wraps a `MultiStore`, so `store.go`'s copies are
shadowed and never execute in test.

Confirming control — the same mutation applied to the `multistore.go` copy:

| Mutation | File | Top-level failures |
|---|---|---|
| `MUT_MS_NATIVE_SPURIOUS` | `multistore.go:250` | **1** (`TestUpdateTask_LabelWritesAreInertOnNativeTasks`) |

So the logic *is* covered — exactly once, in the copy that runs. The narrow true
claim (bar 8): **this is duplicated logic with only one copy covered, not an
untested control.** The risk is drift — a future fix applied to one copy and not
the other would be invisible to the suite.

**Recommended fix:** have `MultiStore` delegate to the `store.go` package-level
helpers rather than reimplementing them, or add a direct unit test on the
`store.go` copies. Either collapses the drift risk.

---

## T-3 (Low) — `TestUpdateTask_SwappingOneTerminalLabelForAnotherRequiresClose` never swaps

**BY EXECUTION.** `internal/server/authz_label_write_scope_test.go:800`

The test is well built — it has an `executed != 12` non-vacuity pin, a
`task:close` differential so it cannot pass by denying everything, and it checks
label state *after* refusal. The count pin is sound and I corroborated its stated
regression signature: `MUT_B5` drove exactly this test to 6 of 12, which is what
the pin's message says six means.

But every cell only calls `f.addLabels(...)`. No cell removes the start label.
So `before={start}`, `after={start,dest}` — cardinality 1→2. **A genuine
single-request swap (`add_labels=[dest]`, `remove_labels=[start]`, cardinality
1→1) is unexpressed suite-wide.** The name asserts a shape the rows cannot
express, which is precisely what the charge warned a count pin must not do.

I verified by probe that real swaps behave correctly (`PROBE_B swap_in_one_request`),
so **this is a naming and coverage finding, not a bug.** Recommend either
renaming to reflect what it measures, or adding the true-swap row.

---

## T-4 (Low) — The `identity_test.go` panic is a real latent flake that silently truncates runs

**BY EXECUTION.** `internal/server/identity_test.go:250`

The developer called the `TestUpdateTask_PropagatesActorID` nil-pointer panic a
run artefact. **They are right about causation and wrong about consequence.**

Root cause confirmed: five ignored errors in that test. Line 244 does
`u, _ := s.CreateUser(...)`; line 250 dereferences `u.ID`. `EntStore.CreateUser`
(`entstore.go:1743`) returns `nil, err` on failure, so any `CreateUser` error is
an immediate nil deref.

Natural reproduction **failed** — 200 runs at `ulimit -n 256`, then 300 runs at
`ulimit -n 64` with `-parallel 16`, all green. So I used fault injection, which
reproduced the **exact** signature at `identity_test.go:250`.

The consequence is the part that matters:

| Run | Test results observed |
|---|---|
| Clean | **215** |
| Under injected `CreateUser` fault | **115** |

**100 tests silently never executed.** A Go panic aborts the test binary and
truncates the remainder of the package run. So *any kill-count measured on a run
that panicked is unreliable* — the missing tests cannot be distinguished from
passing ones.

This does not invalidate the developer's numbers: I independently reproduced
their MUT-B5 kill set in runs that did **not** panic. But the dismissal reasoning
("it passes 3/3 clean") does not establish what they used it to establish, and if
this fires in CI during a future mutation run it will produce a confidently wrong
measurement.

**Recommended fix:** check the five ignored errors in that test. One-line change,
removes a whole class of silently-truncated runs.

---

## T-5 (Low) — Stale control-attribution comment after the inversion

**REASONED.** `internal/platform/github/reopen_test.go:272-275`

`TestPassThroughClaimTask_ClearingTheStaleLabelRestoresClaimability` is
documented as "positive control for the test above ... Without this, a claim gate
that refused everything would satisfy the test above."

After the inversion, "the test above" is
`..._BareStockLabelIsNotATerminalSignal`, which asserts a claim **succeeds**. A
gate that refused everything would *fail* that test, not satisfy it. The comment
still describes the pre-inversion neighbour. The control itself is fine and still
valuable; only its stated justification is now attached to the wrong test. Worth
a line-edit given this round's theme is controls that cannot falsify what they check.

---

## T-6 (Info) — REV9 has a live tripwire; the charge's suspicion is refuted

**BY EXECUTION.** `internal/server/authz_label_write_scope_test.go:1206`

Charge 6 asked whether REV9 is "a green assertion aimed at its own future" with
no live mutation path — the round-4 F-5 shape. It is not.

`MUT_REV9_PHASE` produces exactly **1** top-level failure:
`TestUpdateTask_RestampingATerminalStageOnAnOpenIssueIsAGenuineNoOp` — REV9
itself, and nothing else. It is uniquely load-bearing: no other test in the suite
catches that mutation. The round-4 F-5 shape does not recur here.

---

## T-7 (Info) — The B3 sweep is discriminating

**BY EXECUTION.** `MUT_B3_PHASE_DERIV` on `internal/server/convert.go`

With `phaseForStage` no longer closing terminal stages, **9 of 13** subtests in
`TestNativeTask_TerminalStageAlwaysCarriesAClosedPhase` die. The sweep would fail
if phase derivation broke; it is not passing because every path returns the same
thing.

The 4 surviving `close_*` cells survive for a legitimate structural reason:
`CloseTask` delegates to `s.store.CloseTask` and derives phase in the store
layer, never routing through `convert.phaseForStage`. That is a real second
derivation path, not a coverage hole in this test — but it is worth knowing that
the B3 answer rests on two independent derivations and this mutation only
exercises one.

---

## T-8 (Info) — Gate reproduced independently; I agree with the coordinator

**BY EXECUTION.**

```
GO_BUILD_EXIT=0   (after mkdir -p web/dist && echo ... > web/dist/index.html)
GO_VET_EXIT=1     exactly 4 pre-existing copies-lock findings, no others:
                  server.go:1601, :1711, :1919, :2096
GO_TEST_EXIT=0
```

Verified by request type, not by line number, per the shared brief's warning.

---

## Charge 1 in full — mutation results

Harness `mutate.py`, sha256 `26ebcfb91a5b722ef2940b40573f0186274898d56f0a714999c4b9318fe778d5`.
Content-addressed anchors (abort if not unique), backups outside the repo, exit
codes captured from the child not through a pipe, and after **every** mutation
`git status --porcelain` empty **and** sha256 verified against an out-of-repo
pristine copy. All 19 runs reported
`git_status_porcelain_empty=True sha256_matches_pristine=True`.

### The developer's two claims — CONFIRMED

`MUT_B5` (collapse the set readers to a single tiebreak winner) produced exactly
the reported kill set: **6 of 12** in each of the two named tests, and **2 of 3**
in the third, with the stock-label cell surviving — which independently confirms
their disclosure that B5 never runs on it. `MUT_B6` killed exactly the **7** tests
they listed, no more and no fewer.

### Full kill table

| Mutation | Target | Top-level failures |
|---|---|---|
| `MUT_B5` | set readers → tiebreak winner | 3 parents / 14 subtests |
| `MUT_B6` | prefix predicate | 7 |
| `MUT_B1_GATE` | label-delta gate | 6 |
| `MUT_SAMESET_ALWAYS_TRUE` | `SameStageSet` → always true | 6 |
| `MUT_SAMESET_LEN_ONLY` | `SameStageSet` → length only | 6 |
| `MUT_STORE_FALLBACK` | `LifecycleStages` fallback | 5 |
| `MUT_ALLTERM_ISTERMINAL2` | `IsTerminalStage(s) \|\| true` | 4 |
| `MUT_B3_PHASE_DERIV` | `phaseForStage` | 2 |
| `MUT_PREFIX_IGNORES_CONFIG` | `matchPrefix` ignores config | 2 |
| `MUT_ISSUESTATE` | `taskIssueState` | 2 |
| `MUT_STATEREASON` | `taskStateReason` | 2 |
| `MUT_ALLTERM_SORT2` | sort ascending → descending | 1 |
| `MUT_ALLTERM_NILGUARD` | nil/enabled guard | 1 |
| `MUT_MS_NATIVE_SPURIOUS` | `multistore.go:250` | 1 |
| `MUT_REV9_PHASE` | REV9's assumption | 1 |
| `MUT_DELTA_FALLBACK` | `store.go:152` | **0 — see T-2** |
| `MUT_NATIVE_SPURIOUS` | `store.go:133` | **0 — see T-2** |

Two further mutations, `MUT_ALLTERM_SORT` and `MUT_ALLTERM_ISTERMINAL`, produced
**compile errors** (unused import after the edit), so `CHILD_EXIT=1` with zero
test failures. Per bar 6 these are **not findings** and are excluded from the
table above; I redid both in forms that keep the import live (`_SORT2`,
`_ISTERMINAL2`) and both were killed.

---

## Charge 3 in full — ablation

No deletable-green test found in the new file.

Ablation needs *over*-restriction mutations, not just under-restriction ones, or
a redundant test looks load-bearing. Run that way:

- `MUT_STATEREASON` and `MUT_ISSUESTATE` are each killed by the closed-issue-floor
  pin **and** the seam-agreement pin — two different tests, so neither is
  redundant with the other.
- `MUT_MS_NATIVE_SPURIOUS` is killed **solely** by
  `TestUpdateTask_LabelWritesAreInertOnNativeTasks`. Unique coverage; deleting it
  would open a hole.

The only two survivors are T-2, and they are a production-code duplication issue
rather than a weak test.

---

## Charge 4 in full — the inversions preserved their cells

**Verified at cell level, not by test name, as instructed.**

**Inversion 1** — `..._IsHonouredToday` → `..._IsNoLongerHonoured`
(`internal/server/authz_terminal_reopen_test.go:818`):

| Cell | Before | After |
|---|---|---|
| bare `"duplicate"` | expect denial | **retained, assertion inverted** |
| `"bug"` non-stage-label control | present | **retained** |
| prefixed `ft:stage/duplicate` | — | **NEW positive control**, asserts `PermissionDenied` naming `ScopeTaskAccept` |

The `maskLabels()` doc comment was updated in the same commit. Coverage
increased, not decreased.

**Inversion 2** — bare `duplicate` relocated out of
`TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable`
(`internal/platform/github/reopen_test.go:197`) into
`..._BareStockLabelIsNotATerminalSignal` (`:254`):

- Successor uses **exactly the old input state** — open issue, `"duplicate"`, nothing else.
- Assertion inverted, **plus** a second assertion the old row did not have
  (`hasLabel("ft:stage/working")`, i.e. the claim actually stamped).
- The four prefixed rows remain in the original table and are explicitly
  documented as the positive control for the inversion.
- `..._ClearingTheStaleLabelRestoresClaimability` (`:276`) remains as the
  non-vacuity control (comment attribution is stale — T-5).

**The developer's claim "no test was deleted, and none has no successor" is
accurate.**

**Count pin 6→12:** sound, and corroborated — see T-3 for the one caveat.

---

## Methodology, disclosures, limitations

### Method

Independent gate reproduction; 19 content-addressed mutations across
`internal/server/`, `internal/store/`, `internal/platform/github/`; ablation
pairing with over-restriction mutations; fault injection where natural
reproduction failed; and a config-varying probe for the priority charge.
Artifacts in `salvage/r5-test-194/` (`run_MUT_*.txt`, `result_*.json`,
`probe_rerun.txt`, `gate-gotest.txt`, `flake_lowfd.txt`, `flake_fd64.txt`,
`mutations.json`, `mutate.py`, `pristine/`).

### Disclosures (bar 7 — costly disclosure is the trust signal)

- **My first probe was wrong.** I hypothesised that `applyLabelDelta`
  (gate prediction) and `mergeLabels` / the passthrough write path disagreed on
  add-vs-remove ordering, which would have been a gate/write divergence. I
  verified all three resolve **remove wins**, consistently. No finding. I spent
  real time on this and it produced nothing.
- **Two of my mutations were invalid** (compile errors from unused imports),
  initially looked like green survivors, and would have been two false findings
  had I filed on exit code alone. Caught by bar 6, redone, both killed.
- **My harness aborted correctly once**, refusing to mutate `convert.go` because
  no pristine copy existed. I extended the pristine set and re-ran; repo verified
  clean before and after.
- **One baseline run was invalid** — shell cwd had reset out of `/workspace`,
  giving `go: cannot find main module` and a bogus comparison. Re-run from the
  right directory gave the real 215-vs-115 figure in T-4.
- **My first test-name extraction was buggy** (top-level `--- FAIL:` lines have
  no leading whitespace, subtests have four), collapsing names to `---`. The
  kill table above is rebuilt from raw logs with corrected parsing.
- **The `result_MUT_*.json` files undercount.** They only tally subtests under
  pre-declared parents, so several killed mutations show `n_failed=0` there. The
  authoritative record is the `run_MUT_*.txt` logs, which is what the kill table
  is built from. Anyone auditing my artifacts should read the logs, not the JSON.
- **Probe output was not preserved on first run.** I re-ran the probe to put the
  T-1 measurement on record (`probe_rerun.txt`); it reproduced identically.
- One-line note per the coordinator's instruction: my leg brief named a clone
  path that does not exist in my container (`/workspace` is the clone). Confirmed
  and corrected by the coordinator before I began; no impact on findings.

### What I did NOT establish

- **I did not establish that T-1 is exploitable**, only that it is a
  display/authorization divergence on a configuration surface with zero test
  coverage. Whether any real deployment configures `Stages` is outside what I can
  see from the tree.
- **I did not reproduce the `identity_test.go` panic naturally** (500 attempts
  across two fd-pressure regimes). T-4's consequence claim rests on fault
  injection, which proves the *shape* of the failure, not its likelihood in CI.
- **I did not audit the second phase-derivation path** (`store.CloseTask`) that
  the 4 surviving `close_*` cells in T-7 exercise.
- **I did not measure `make race`.**
- `TestWatchTasks_NoInitial` — the known pre-existing timing flake — fired once,
  during `MUT_SAMESET_LEN_ONLY`. Consistent with the documented flake; I did not
  investigate further and it did not affect any kill count.

### Independence

I did not read the other legs' reports or working files, and did not touch any
directory outside `/workspace` and my own salvage subdirectory. I encountered no
file whose header discussed this round's findings. No production code was
modified: every mutation was restored and sha256-verified against an out-of-repo
pristine copy, and the working tree is clean at `ea8ac39`.
