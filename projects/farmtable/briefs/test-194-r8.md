# test-194-r8 — independent test review, #194 round 8

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `label-write-scope-r8` and commit **`158c8ae963faa5eef032e0857ecbc40d6a7c681a`**.
**Do NOT create any directory named in this brief.** `web/dist` is present — do not run
`make web`.

## How to treat this brief

Claims are tagged `[MEASURED]` (I ran it this session), `[MEASURED-BY-<x>]` (relayed, not
mine), `[BELIEVED]`, `[CARRIED]`.

**My briefs have contained at least one error in nine consecutive rounds.** The round-8
implementation report lists four errors in the brief I gave the developer — including one where
I asserted an existing test was "vacuous — it cannot fail", which was **false**: the test
catches the defect it was written for, and had the developer obeyed my wording and deleted it,
real coverage would have gone with it. **Agreeing with a premise supplied in this brief is
worth ZERO, and from the outside it looks identical to genuine convergence. If you confirm
something I asserted, say that you are confirming MY claim and show your own measurement.**

Reporting every place this brief is wrong is a **required deliverable**, not a courtesy.

## Known-good baseline `[MEASURED by me at 158c8ae this session]`

- `go build ./...` → exit 0
- `go test ./...` → exit 0, zero FAIL lines
- `go vet ./...` → **exit 1**, exactly **4** pre-existing copylocks findings, all in
  `internal/server/server.go` at lines **1782 / 1892 / 2100 / 2277**, all reading
  `assignment copies lock value to ephReq: …contains sync.Mutex`, in `GetReadyTasks`,
  `GetBlockedTasks`, `GetCriticalPath`, `GetBottlenecks`.
  **Check the messages, not just the count** — same count with different messages is a new bug.
- `TestWatchTasks*` flake `[MEASURED-BY-dev-194-r8]`: 0 failures in 12 sequential full-suite
  runs, 0 at 4-way concurrency, but **4 of 6** batches RED at 6-way concurrent `-count=20`, all
  5.00–5.02s timeouts; a control at base `1d4442f` gives an identical **4 of 6**, so it is
  **pre-existing**. This control is the model for what I want from you elsewhere.
- `make race` covers **only** `internal/platform/github`. There is **no CI** on this project.

## What to read

`/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-r8.md` — the implementation
report, including its mutation tables. **The tables are the thing you are reviewing. Do not
inherit their numbers; re-derive them.**

---

# Your axis: do the PINS actually hold, and would they have gone RED?

The other question — "is the code correct?" — is not yours. Yours is: **if someone reverts this
change tomorrow, does the suite notice?** These sound like one question and are two, and
rounding them together is how a real finding gets dropped on this workstream.

## 1. Re-derive the RED evidence, do not accept it

The report claims a mutation matrix of **8192 triples per run** over
`RestrictLabelWriteToSnapshot`, with four mutants `[MEASURED-BY-dev-194-r8]`:

| mutant | what it changes | reported result |
|---|---|---|
| M-C1a | the round-7 implementation | 3768 / 3768 caught |
| M-C1b | `==` instead of `labelMatchKey` | 1920 / 1920 caught |
| M-C1c | case-blind comparison | 1536 / **0** |
| M-C1d | identity restrictor | **0** / 8064 |

**Reconstructing the artefact you are measuring is the same error class as reimplementing the
function you are checking** — the developer hit exactly this and self-reported it (their
"instance #11": a first measurement used a *reconstruction* of a round-7 test and reported
GREEN; extracting the real file showed **RED**). So: extract real files with `git show`, never
retype them.

For each pin the round added, apply a mutation that should break it and **confirm the suite
goes RED with a non-zero count of FAILING tests** — not merely a non-zero exit code. **A mutant
that does not compile measures nothing.** The developer burned one attempt on exactly this: a
mutant exited 1 with **zero** failing tests because removing `filepath.Abs` left an unused
import.

## 2. The two soft spots the developer flagged themselves

**(a) M6c is reported as an unkillable equivalent mutant** — replacing the
`StageToLabel`/`stripForMatch` oracle with a hardcoded `"ft:stage/"` literal passes everything.
They added `TestLifecycleKeyCollision_OracleIsStructurallyEquivalentToday` to pin it. **Is it
genuinely equivalent, or merely unkilled by the fixtures that exist?** These are different
claims and the second is much weaker. Try to kill it.

**(b) M6e survived its first version** because the control rows used keys (`"doing"`,
`"shipped"`) that **never exercised the exemption they were supposed to protect**. That is a
**fixture that cannot express the input** — the fixture table itself was the defect, not the
assertion. **Sweep the round's other fixture tables for the same shape.** For each table, ask
what input it *cannot* represent, and whether the property under test lives in that gap.

## 3. Ask what the oracle can discriminate BEFORE asking what the inputs vary

For every new test in this round, answer in this order:

1. **What can this oracle possibly report, and is the failure we care about inside that range?**
2. Only then: what do the inputs vary, and what do they hold constant?

An oracle is a hypothesis about what could go wrong. Exhausting 8192 inputs against a narrow
oracle stress-tests that hypothesis exhaustively and **can never test whether the hypothesis is
complete**. Where a control's contract is "mirrors function F", **the oracle must BE F, never a
reimplementation of F.**

## 4. Coverage gaps — what should have a pin and does not

Enumerate behaviour this round introduced or changed, and mark each **pinned / unpinned**:
the six `stageWritePolicy` call sites, the snapshot-spelling removal path, the `removeKeys`
safety belt, `req.Type` shape validation at both layers, `checkLifecycleKeyCollisions`,
`LoadConfigWithSource` and `ConfigSource.Describe`. **An unpinned behaviour on a
security-relevant path is a finding even if the code is correct today.**

## 5. Expected-clean checks (report the result either way)

I expect these to be clean, and **a clean result is a required reported outcome** — a ledger
built only from hits implies a 100% failure rate forever:

- no test was weakened, skipped, or had an assertion removed to make the round pass;
- no test depends on wall-clock timing or map iteration order introduced this round;
- `t.Parallel` usage did not create shared-state races in the new tests.

---

# Verification bars

- **A negative claim needs a positive control drawn from a DIFFERENT axis than the one you
  searched.** A same-axis positive control is **non-evidence** for the failure that matters.
- **A green control is a finding, not a pass.** Write it down.
- **Predict counts BEFORE measuring**, and report the prediction next to the result.
- **Exit codes come from the child process, never through a pipe.** Count FAIL lines too.
- **Compare SHAs, never counts.**
- Your harness must **ABORT on a failed prerequisite**, never continue and report zero.
- **Commit or stash before running any mutation experiment.** The developer lost uncommitted
  work this round to a `git checkout --` inside their own mutation script.

# Deliverables — you are not done until all four exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r8.md`**, with a
   clear **APPROVE / REQUEST CHANGES** verdict, a pinned/unpinned table for §4, your own RED
   evidence per pin, and each gap severity-rated with `file:line`.
2. **A project log entry** in `.design/project-log/`, **committed** to `label-write-scope-r8`.
3. **An explicit list of every place this brief was wrong.** If nothing, say so and say what
   you checked.
4. **Do NOT push. Do NOT modify production code — your independence depends on it.** You may
   add tests and you may mutate for measurement; revert every mutation and assert
   `git diff --quiet` on non-test files afterwards.

**You MUST produce all four deliverables and then mark the task complete.**
