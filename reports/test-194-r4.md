# Farm Table #194 — Round 4 TEST REVIEW

**Leg:** test review (independent; did not read the other two legs' reports)
**Branch:** `close-label-swap` · **SHA reviewed:** `03ab6b6` (parent `651da26`)
**Clone:** `/workspace/farmtable-test-194`
**Date:** 2026-07-28

---

## VERDICT: **APPROVE**

The round-4 fix is genuinely bound to its tests. 14 of 15 content-addressed
mutants were KILLED; the single survivor is a test-side assertion, not
production behaviour. The count pins are honest, load-bearing, and — the thing
that mattered most this round — sit over a schema that **demonstrably can**
express the defect that rounds 1–3 could not see. Every self-check in the new
tests fails closed. The dev's disclosure of the 4-of-28 claim result was
accurate and its explanation verifies.

I am approving with **six findings**, none of which block. The most substantive
(F-1) is a factual error in the dev's own project log that overstates the bug
by 4 cells; the most useful for round 5 is F-3, an entire input dimension that
no test in the repository varies.

Two things I want to state up front, because this workstream has been burned by
both:

- **I could not find a new false pass.** I looked for the charge-5 shape (a
  dimension held constant such that a row is invisible) in three places and
  measured each. Details in §5.
- **I did not re-file R-A or R-B.** I confirmed R-B by execution and measured
  it so round 5 can be sized, and I have one substantive comment on whether the
  proposed round-5 control is *sufficient* (§7).

---

## Method and standing-bar compliance

All mutations were applied **by content**, never by line number, via a purpose-
built applier that **aborts (rc=2) unless the anchor string occurs exactly
once** in the target file, and that always mutates from a pristine backup held
**outside the repo** (`/scion-volumes/.../salvage/r4-backup/`) so mutations
cannot silently stack. After every restore the file was verified byte-identical
by **sha256** and `git status --porcelain` was asserted empty. Exit codes were
captured **from the child process directly** (`go test ... > log; rc=$?`),
never through a pipe. A non-zero rc with **zero** `--- FAIL` lines was
classified INCONCLUSIVE, not KILLED. `make race` exits 2 on failure, noted.
The tree was committed before every driver run.

**Deviation to disclose:** the briefed clone `/workspace/farmtable-test-194` did
not exist at session start. `/workspace` itself was the repo at `03ab6b6`,
clean, with `origin` pointing at a nonexistent path. I created the briefed clone
with `git clone --shared /workspace /workspace/farmtable-test-194` and worked
there. Side effect: the parent `/workspace` porcelain now shows
`?? farmtable-test-194/`. I kept the briefed path because the project-log commit
was required to land there.

**Second deviation:** `go build ./...` fails at rc=1 out of the box with
`assets.go:5:12: pattern all:web/dist: no matching files found` (this is
round-3's F6, still open). I created a stub `web/dist/index.html` to build at
all. Verified gitignored (`.gitignore:17: dist/`), so porcelain stays empty.

### Gate reproduction at `03ab6b6` — BY EXECUTION

Matches the EM's stated baseline in the shared brief exactly.

```
BUILD_RC=0            (with the web/dist stub; rc=1 without it)
TEST_RC=0             --- FAIL count: 0
RACE_RC=0             --- FAIL / DATA RACE count: 0
  go test -race ./internal/platform/github/
  ok  	github.com/farmtable-io/farmtable/internal/platform/github	1.204s
VET_RC=1              exactly 4 findings, all pre-existing copies-lock:
internal/server/server.go:1516:14: assignment copies lock value to ephReq: ...GetReadyTasksRequest contains ...protoimpl.MessageState contains sync.Mutex
internal/server/server.go:1626:14: assignment copies lock value to ephReq: ...GetBlockedTasksRequest contains ...protoimpl.MessageState contains sync.Mutex
internal/server/server.go:1834:13: assignment copies lock value to ephReq: ...GetCriticalPathRequest contains ...protoimpl.MessageState contains sync.Mutex
internal/server/server.go:2011:13: assignment copies lock value to ephReq: ...GetBottlenecksRequest contains ...protoimpl.MessageState contains sync.Mutex
```

Final tree state after all mutation work, with positive restore assertions:

```
HEAD: 03ab6b63287b29b079afac30f7a0fb345052a521
--- porcelain ---
PORCELAIN_END                                    <- empty
--- positive restore assertions ---
4                                                <- occurrences of terminalStagePrecedence
513:			present[stage] = true                 <- round-4 set-based body present
672:	return lifecycleStage != task.StageAccepted || <- claim gate first arm intact
(no matches found: internal/server/zz_r4_*)      <- probes removed
```

---

## 1. Charge 1 — IS THE FIX BOUND TO ITS TESTS?

**Mutation M1** reverts `TerminalLabelStage` (`internal/platform/github/labels.go:505-521`)
to the round-3 delegation form by content, anchored on the whole function body
(anchor verified unique).

### Result — BY EXECUTION

| Sink | Dev's log claims | I measured | Match? |
|---|---|---|---|
| Authorization | 104 / 140 fail | **104 / 140** | ✅ exact |
| Availability | **28 / 28** fail | **24 / 28** | ❌ **off by 4** |
| Claim | 4 / 28 fail | **4 / 28** | ✅ exact |

```
M1 authz       FAIL=104  PASS=36   TOTAL=140
M1 avail       FAIL=24   PASS=4    TOTAL=28
M1 claim       FAIL=4    PASS=24   TOTAL=28
```

### The 4 availability cells that do NOT fail — accounted for

```
--- M1 avail: which 4 PASSED ---
ft:stage/wont_fix
ft:stage/duplicate
ft:stage/cancelled
ft:stage/completed
```

These are precisely the four **unmasked** controls (mask `""`). They are
**correctly unaffected**: a single terminal label with no mask is the case
round 3 already handled, so reverting to the round-3 body cannot break them.
This is the good kind of survivor. But it means the dev's log table is wrong —
see **F-1**.

### The 36 authorization cells that do NOT fail — every one accounted for

Decomposition (BY EXECUTION, from `/tmp/m1_authz.log`):

- **20 cells** = 4 terminals × 5 destinations × mask `""` — the unmasked
  controls. **Correctly unaffected**, same reason as above.
- **16 cells** = 4 terminals × 4 destinations `{accepted, in_review, in_qa,
  deploying}` × mask `ft:stage/triage`. These pass under M1 **for a reason that
  has nothing to do with the fix**: with the terminal label masked, the
  round-3 body resolves the source stage to `triage`, and `TransitionScope`
  (`internal/server/transitions.go`) charges `task:accept` for *leaving triage*
  independently of any terminal consideration. The denial is real but
  coincidental.

The remaining 4 triage-masked cells — destination `triage` — **did** fail under
M1. That is the charge-5 row, and it is covered. See §5.

So: 140 = 104 killed + 20 correctly-unaffected + 16 passing-for-an-unrelated-
reason. Nothing unexplained.

### Wider mutation battery — BY EXECUTION

```
MUTANT                                 FAILS  VERDICT TOP-LEVEL FAILING TESTS
M2-drop-enabled-guard                  1      KILLED  TestTerminalLabelStage_DisabledMapperDeclines
M3-nondeterministic-tiebreak           1      KILLED  TestTerminalLabelStage_Cardinality
M4-reverse-terminal-precedence         2      KILLED  TestTerminalLabelStage_Cardinality,TestWatchTasks_NoInitial*
M5-drop-cancelled-from-tiebreak        8      KILLED  TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable,TestTerminalLabelStage_MaskedByEveryNonTerminalLabel,...
M6-terminal-first-in-stageprecedence   1      KILLED  TestStagePrecedence_IsADisplayRuleTerminalStagesRankLast
M7-availability-reads-display-stage    3      KILLED  TestAudit_ReopenAfterCloseIsDisplayedOpenButNotScheduled,TestPassThroughStore_OpenTerminalLabelledIssueIsDisplayed...
M8-claimgate-reads-display-stage       2      KILLED  TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable,TestClaimTask_MaskedTerminalLabelIsNotClaimable
M10-claim-gate-drop-lifecycle-arm      3      KILLED  TestIssueUnavailableForClaim,TestPassThroughClaimTask_...,TestClaimTask_MaskedTerminalLabelIsNotClaimable
M11-neuter-updatetask-scope-gate       9      KILLED  TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen,...
M12-nonstateful-mock-add               2      KILLED  TestUpdateTask_AcceptScopedCallerCanReopen...,TestUpdateTask_SelfServiceLabelAddition...
M13-collapse-mask-dimension            4      KILLED  (all four count pins) — see §3
M14-drop-label-state-after-refusal     0      SURVIVED — see F-5
M15-claim-swap-before-gate             3      KILLED  TestPassThroughClaimTask_ClosedIssueIsNotClaimable,...
```

`*` `TestWatchTasks_NoInitial` is a **pre-existing timing flake**, not a
mutation kill. It timed out at 5.01s under M4 and once during an unrelated run;
3 isolated re-runs and a full suite re-run all came back rc=0. Informational
only — **F-6**.

**Mutation score: 14 KILLED / 15.**

---

## 2. Charge 2 — the 4-of-28 claim result

### The dev's explanation, verified — BY EXECUTION

The claim gate's first arm (`internal/platform/github/passthrough.go:672`) is:

```go
return lifecycleStage != task.StageAccepted ||
```

a **positive whitelist**, not an `IsTerminalStage` check. Under M1 the masked
terminal resolves to the mask's stage; for 24 of the 28 cells that stage is not
`accepted`, so the claim is still refused — **for a reason unrelated to the
fix**. The 4 cells that fail are exactly the four `mask = ft:stage/accepted`
rows:

```
--- M1 claim: which 4 FAILED ---
accepted
accepted
accepted
accepted
```

The dev's explanation is **correct**.

### Are those 24 cells worth keeping? — BY EXECUTION, and yes

I tested the exact rewrite the dev's comment predicts. **M9** replaces the arm
with `store.IsTerminalStage(lifecycleStage)` on top of the round-4 fix:

```
M9 alone claim     FAIL=0    PASS=28   TOTAL=28   <- rewrite is safe today
M1+M9 claim        FAIL=24   PASS=4    TOTAL=28   <- and the 24 are its regression net
```

This is the answer to the charge. Today the 24 cells pass for the wrong reason.
But they are **live latent detectors** for precisely the refactor a future
reader would perform before pruning them: rewrite the arm to `IsTerminalStage`
and the cells still pass (M9 = 0 fails), so the rewrite looks safe — and if that
rewrite ever lands alongside a regression of the mapper, 24 of them light up.
Keeping them is correct.

**Is the documentation sufficient to stop a future reader pruning them?** Yes,
narrowly. The comment names the whitelist arm and says the cells are retained
against a rewrite to `IsTerminalStage`. I would have liked it to state the M9
result (that the rewrite is currently a no-op for the suite), because a reader
who tries the rewrite, sees green, and prunes is the realistic failure path.
That is a nit, not a finding.

---

## 3. Charge 3 — are the count pins honest?

### Does the fixture genuinely take a label SET? — BY EXECUTION

Yes, and I want to be explicit that I did **not** establish this by reading the
signature, because reading the signature is what round 3 did. I established it
from the mutation arithmetic: **M1 produces 104 authorization failures. That is
arithmetically impossible under a single-label schema**, where at most 4 rows
(one per terminal) can exist per destination. The fixture is
`newTerminalLabelledService(t *testing.T, labels ...string)` and the variadic
genuinely reaches the mock as a multi-element set — proven because the masked
rows behave differently from the unmasked ones.

Corroborated independently by the **step-1 fixture self-check** at
`internal/server/authz_terminal_reopen_test.go:596`, which asserts the issue
actually carries **both** labels after `AddLabels`. Under **M12** (non-stateful
mock) it fires:

```
authz_terminal_reopen_test.go:596: fixture is not stateful: after AddLabels the issue
carries [ft:stage/wont_fix], want both the terminal and the added label. Without the
mask actually landing, step 2 below would be testing the single-label case and passing
for the wrong reason
```

That is the round-3 defect, named in the assertion text, and it fails closed.

### Are the pins load-bearing, or tautological? — BY EXECUTION

The pins are hard-coded literals (`const wantCells = 4 * 5 * 7`) compared
against `len()` products, not computed from the same loop bounds — so they are
not tautological. **M13** collapses `maskLabels()` back to the round-3 `{""}`
schema. All four pins fire:

```
authz_terminal_reopen_test.go:346: matrix covers 20 cells, want 140 (4 terminal labels x 5
  destinations x 1 masks). A dimension was changed without updating the pin — and note that
  pinning the count alone is not enough: the mask dimension is what lets these rows express
  the multi-label bypass at all
authz_terminal_reopen_test.go:501: matrix covers 4 cells, want 28 (4 terminal stages x 1 masks)
authz_terminal_reopen_test.go:631: matrix covers 4 cells, want 28
authz_terminal_reopen_test.go:730: matrix covers 4 cells, want 28
```

The `:346` message satisfies bar 3 in full: it states the factorisation **and**
states what the dimension buys. Note that `:631` and `:730` state the number but
**not** the factorisation or the expressiveness caveat — minor inconsistency,
folded into **F-4**.

**140 = 4 terminals × 5 destinations × 7 masks is honest**, and the schema
expresses the defect.

---

## 4. Charge 4 — input-domain variation the dev did NOT do

I built `test-194-r4-inputdomain_probe_test.go` (salvaged) covering 15 label
surface forms × {alone, +mask, mask-first}, stock GitHub label sets, scale and
burial, the config dimension, and closed-issue interaction.

### Robust (no finding), but untested — REASONED from BY EXECUTION results

`stripForMatch` (`labels.go:530`) handles case, surrounding whitespace, the
`ft:` push prefix, `stage/`, `priority/` and `priority:` prefixes. Every form I
tried resolved correctly, and **mask-invariance held in both label orders for
every form**. Duplicate identical labels, labels naming a nonexistent stage,
very large label sets (200 labels with the terminal buried last), and the
empty-string label all behaved. The set-based `present` map makes order and
duplication structurally irrelevant, which is the right design.

**But none of these forms appears in any fixture.** Every test uses the canonical
`ft:stage/x` form via `stageLabel()`. The code is robust; the tests do not know
it. That is a real gap, though a low-severity one — **F-4**.

### The input class the dev did not vary — **the mapper configuration itself**

This is my answer to "find the input class it did NOT vary", and it is not on
the brief's candidate list. **No test anywhere in the repository varies
`LabelConfig.Stages`.** Every test constructs the mapper from `DefaultConfig()`.
The label→stage map is an *input* to `TerminalLabelStage`, and it is pinned to
one value across the entire suite. See **F-3**.

### Stock GitHub labels — an asymmetry worth recording

BY EXECUTION: GitHub's stock `duplicate` label **does** match (bare stage name),
but GitHub's stock **`wontfix`** (no underscore, no separator) **does not** —
`stripForMatch` produces `wontfix`, which is not a key. The deferred stock-label
item is therefore **narrower than it reads**: only `duplicate` is affected, and
only `duplicate` is pinned by a characterisation test
(`authz_terminal_reopen_test.go:813`). **F-2**.

### What this fixture still cannot express

1. Any non-default `LabelConfig` (F-3).
2. Any non-canonical label surface form (F-4).
3. **A mask that is itself a second terminal label** — masks are non-terminal by
   construction. Disclosed by the dev, but the disclosure understates it (§5, F-4).
4. A terminal *destination* — `reopenDestinations()` lists only non-terminal
   stages. Silently omitted; I verified the omitted row is safe (§5).

---

## 5. Charge 5 — the triage-mask lesson, applied

### The four triage-mask cells

**BY EXECUTION: the dev's matrix does see them.** All four
`*_to_triage_masked_by_ft:stage/triage` cells **failed** under M1. The audit's
round-3 PoC held the destination fixed at `accepted` and was structurally
incapable of seeing the `from == to` short-circuit; the round-4 matrix varies
the destination across all 5 values and therefore covers the row. The dev's
claim on this point is correct and the round-3 blind spot is closed.

### Looking for the same shape elsewhere — three candidates, all measured

I wrote `test-194-r4-heldconstant_probe_test.go` (salvaged) to test the three
dimensions the round-4 matrix holds constant.

**R1 — destination `working` is excluded.** The stated justification is that
`UpdateTask` rejects it up front. **Verified BY EXECUTION**, and it holds for
multi-label sets too:

```
labels=[ft:stage/wont_fix] -> working : code=InvalidArgument
  msg="stage=working starts execution; use ClaimTask so availability and self-assignment are enforced"
  labels-after=[ft:stage/wont_fix]
labels=[ft:stage/wont_fix ft:stage/accepted] -> working : code=InvalidArgument ...
  labels-after=[ft:stage/wont_fix ft:stage/accepted]
```

The rejection at `internal/server/server.go:531` fires **before** the scope gate,
labels are untouched, and the behaviour is independently pinned by
`lifecycle_evidence_test.go:74`. **Exclusion is justified. No finding.**

**R2 — a TERMINAL destination is excluded, silently.** `reopenDestinations()`
lists only non-terminal stages and the doc comment does not say terminal
destinations were considered. This is the exact charge-5 shape. **I measured the
omitted row and it is safe** — BY EXECUTION:

```
labels=[ft:stage/wont_fix] -> completed              : code=PermissionDenied msg="missing required scope \"task:close\""
labels=[ft:stage/wont_fix ft:stage/accepted] -> completed : code=PermissionDenied msg="missing required scope \"task:close\""
labels=[ft:stage/wont_fix ft:stage/working] -> completed  : code=PermissionDenied msg="missing required scope \"task:close\""
```

Correct: moving to a different terminal costs `task:close` regardless of mask.
No defect — but the row is uncovered and undisclosed, which is what the standing
bar is about. Folded into **F-4**.

**R3 — the mask is never itself terminal.** This is where the omitted row is
*not* benign. See §7.

---

## 6. Charge 6 — did the dev's new tests earn their place?

**The self-service chain's step-0 hard-fail precondition — YES.** Under **M11**
(neutered scope gate) it fires with the right message, and so does the positive
control's differential precondition at `:449`:

```
authz_terminal_reopen_test.go:449: precondition failed: [ft:stage/wont_fix] was reopened
  without task:accept, so this control proves nothing
authz_terminal_reopen_test.go:449: precondition failed: [ft:stage/wont_fix ft:stage/triage] ...
```

**The false-pass fix — VERIFIED, and it cannot regress.** The dev disclosed that
its first claim probe was a false pass which laundered a bypass as a denial,
fixed by asserting `errors.Is(claimErr, store.ErrUnavailable)` specifically.
**M10** drops the lifecycle arm from `issueUnavailableForClaim` and the
assertion kills it (3 top-level failures including
`TestClaimTask_MaskedTerminalLabelIsNotClaimable`). I separately confirmed the
assertion is bound to *this* gate arm and not laundered by the three other
`ErrUnavailable` sources in `entstore.go`. **The permanent test cannot regress
to the false-pass form.**

**The positive control's did-it-actually-do-anything check — YES.** Under **M12**
(non-stateful mock) it fires:

```
authz_terminal_reopen_test.go:464: reopen was permitted but the issue did not gain the
  accepted label; labels now []. The call succeeded while doing nothing
```

**The claim matrix's label-state-after-refusal assertion — YES.** **M15**
reorders `ClaimTask` so the label swap precedes the gate:

```
authz_terminal_reopen_test.go:774: ClaimTask was refused for [ft:stage/wont_fix] but mutated
  the issue's labels: [ft:stage/wont_fix] -> [ft:stage/working]. A refused claim must not stamp anything
```

That is a refused call erasing its own evidence, caught exactly. Good assertion.

**The authorization matrix's label-state-after-refusal assertion — SURVIVED.**
**M14** removes it and the suite stays green (rc=0, 0 failures). See **F-5**.

---

## 7. R-B: measured, not re-filed

`TestProbeR4_MultiTerminalFromEqualsTo` — BY EXECUTION:

```
[wont_fix completed] -> completed with task:write only: err=<nil> labels-after=[ft:stage/completed]
R-B CONFIRMED (disclosed residual): the tiebreak picked `completed`, from == to short-circuited
  to task:write, and the maintainer's wont_fix label was swapped away by the write.
after AddLabels: [ft:stage/wont_fix ft:stage/completed]
step 2 (wont_fix+completed -> completed, task:write only): err=<nil> labels-after=[ft:stage/completed]
```

**Not a round-4 regression.** I re-ran this probe under M1 (round-3 body) and got
byte-identical behaviour, confirming the dev's "unchanged from round 3" claim.

**Two observations for round 5, offered as commentary, not as findings:**

1. **The proposed round-5 control is necessary but may not be sufficient.**
   Recomputing the lifecycle stage of the post-mutation label set on
   `AddLabels` closes the *self-service* form above (step 1 would become a
   `wont_fix → completed` transition costing `task:close`, and would be denied).
   It does **not** close the form where the second terminal label arrives on
   GitHub directly, never passing through Farm Table's API. The `from == to`
   short-circuit at `transitions.go:124` still returns `ScopeTaskWrite`.

2. **The short-circuit itself is the deeper issue, and it is in tension with a
   deliberate round-2 fix.** Restamping `completed → completed` must stay
   `task:write` (otherwise you reintroduce the denial-of-work regression that
   `TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite` guards). But
   `[wont_fix, completed] → completed` must **not** be `task:write`, because it
   is a `task:write` token performing a `task:close`-scoped transition *and*
   erasing a maintainer's label. The distinguisher is **cardinality of the
   terminal set**: short-circuit only when the source label set names at most
   one terminal stage. Worth putting in the round-5 brief explicitly.

---

## Findings

### F-1 — Dev's project log overstates the availability sink by 4 cells · **Medium**
`.design/project-log/close-label-swap-r4-multilabel-bypass.md` (sink table)

The log states availability fails **28/28** under the round-3 revert. It fails
**24/28** (BY EXECUTION, §1). The 4 non-failing cells are the unmasked controls,
which round 3 already handled correctly. Authorization (104/140) and claim
(4/28) are exact.

This matters more than a typo. The log is the artefact the next reader uses to
size the blast radius, and it is the only one of the three figures that claims a
sink was *totally* broken. Overstating the bug you fixed is the mirror image of
the failure this workstream keeps hitting. **Recommend:** correct to 24/28 and
name the 4 survivors as the pre-existing single-label controls.

### F-2 — The stock-GitHub-label residual is narrower than recorded, and only half of it is pinned · **Low**
`internal/platform/github/labels.go:530` (`stripForMatch`); characterisation test at `internal/server/authz_terminal_reopen_test.go:813`

BY EXECUTION: stock `duplicate` matches; stock **`wontfix` does not** (no
underscore ⇒ no key). The deferred item reads as though stock labels broadly
collide. Only `duplicate` does. **Recommend:** add a one-line
characterisation row asserting `wontfix` does *not* resolve, so that if someone
later "helpfully" adds a `wontfix` alias the deferred decision is revisited
rather than silently changed.

### F-3 — The mapper-configuration dimension is held constant across the entire repository · **Medium**
`internal/platform/github/labels.go` (`LabelConfig.Stages`); no test file varies it

BY EXECUTION: no test anywhere constructs a mapper from anything but
`DefaultConfig()`. The label→stage map is a genuine input to the function under
test and it has cardinality 1 in the suite. With
`cfg.Stages = {"wont_fix": "accepted"}`, all three gates are blinded while
`StageToLabel(wont_fix)` still emits `"ft:stage/wont_fix"` — so `CloseTask`
writes a label the gate cannot read.

**This is pre-existing, not a round-4 regression**, and I am filing it as a test
gap rather than a defect. But it is the direct answer to charge 4's "what input
class did the dev not vary", and it is the same *shape* as the round-3 failure:
a dimension nobody thought of as an input. **Recommend:** one test that
round-trips `StageToLabel` against `TerminalLabelStage` under a non-default
config, asserting they cannot disagree.

### F-4 — Uncovered/undisclosed rows in the matrix schema comment · **Low**
`internal/server/authz_terminal_reopen_test.go:346, 501, 631, 730` (`reopenDestinations()`)

Three sub-items:

- **Terminal destinations** are excluded from `reopenDestinations()` with no
  mention in the doc comment. I verified the row is safe (§5 R2), but bar 3 asks
  the pin to say what it cannot express, and this omission is unstated.
- **The "mask is never terminal" disclosure understates its consequence.** The
  SCHEMA comment says the matrix cannot express "which terminal stage wins when
  several are present", which reads cosmetic. What it actually cannot express is
  a `task:write` token performing a `task:close`-scoped transition (§7).
  **Recommend** rewording to name the authorization consequence.
- **Pins at `:631` and `:730`** state the number but not the factorisation or the
  expressiveness caveat, unlike the exemplary one at `:346`. Make them consistent.

### F-5 — The authorization matrix's label-state-after-refusal assertion is not load-bearing · **Low**
`internal/server/authz_terminal_reopen_test.go` (authz matrix; cf. the claim-matrix twin at `:774`)

**M14 SURVIVED** — removing the assertion leaves the suite green (rc=0, 0
failures). This is the one assertion in the round-4 diff I could not demonstrate
as load-bearing.

**It is explicable and I am not asking for its removal:** `RequireScope` returns
before `p.Stage` is set and before any store call, so on the refusal path there
is no code that *could* mutate labels today. It is a guard against a future
reordering — exactly the class of bug M15 caught in `ClaimTask`, where the twin
assertion *is* load-bearing. **Recommend:** a one-line comment saying it is a
forward guard with no live mutation path, so a future reader doesn't mistake
green for coverage. Per rule 7, an assertion that cannot fail should at least
declare why it is there.

### F-6 — `TestWatchTasks_*` is a pre-existing timing flake · **Informational**
`internal/server` (`TestWatchTasks_NoInitial`, `TestWatchTasks_CreatedEvent`)

Both timed out at 5.01s under load during the mutation battery. 3 isolated
re-runs and a full-suite re-run: rc=0. **Unrelated to this diff** — flagged only
so a future bisect does not misattribute it. Not a round-4 regression.

---

## Priority summary

- **Critical:** none.
- **High:** none.
- **Medium:** F-1 (log accuracy), F-3 (untested config dimension).
- **Low:** F-2, F-4, F-5.
- **Informational:** F-6.

---

## Salvaged artefacts

All under `/scion-volumes/scratchpad/projects/farmtable/salvage/`:

- `test-194-r4-mutate.py` — content-addressed mutation applier. Aborts rc=2 on
  non-unique anchor; always mutates from an out-of-repo pristine copy; restore
  verified by sha256 (rc=3 on mismatch). M1–M15 defined.
- `test-194-r4-run-mutants.sh` — battery driver. Captures rc from the child
  process; classifies SURVIVED / INCONCLUSIVE / KILLED; restores, verifies, and
  asserts porcelain empty after each mutant.
- `test-194-r4-inputdomain_probe_test.go` — charge-4 probe (package `github`).
  Carries `//go:build ignore_in_salvage`; strip the tag to run.
- `test-194-r4-heldconstant_probe_test.go` — charge-5 probe (package
  `server_test`). Same build-tag convention.
