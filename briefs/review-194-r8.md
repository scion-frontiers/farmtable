# review-194-r8 — independent code review, #194 round 8

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `label-write-scope-r8` and commit **`158c8ae963faa5eef032e0857ecbc40d6a7c681a`**.
**Do NOT create any directory named in this brief.** `web/dist` is present — do not run
`make web`.

## How to treat this brief

Claims are tagged `[MEASURED]` (I ran it this session), `[MEASURED-BY-<x>]` (relayed, not
mine), `[BELIEVED]`, `[CARRIED]`.

**My briefs have contained at least one error in nine consecutive rounds.** The round-8
implementation report lists four in the brief I gave the developer, including one where item 3
contradicted item 4 of the same document. **Agreeing with a premise I supply here is worth
ZERO, and from the outside it is indistinguishable from genuine convergence.** If you end up
confirming something I assert, say explicitly that you are confirming *my* claim, and show
your own measurement.

Reporting every place this brief is wrong is a **required deliverable**, not a courtesy.

## Known-good baseline `[MEASURED by me at 158c8ae this session]`

- `go build ./...` → exit 0
- `go test ./...` → exit 0, zero FAIL lines
- `go vet ./...` → **exit 1**, exactly **4** pre-existing copylocks findings, all in
  `internal/server/server.go` at lines **1782 / 1892 / 2100 / 2277**, all reading
  `assignment copies lock value to ephReq: …contains sync.Mutex`, in `GetReadyTasks`,
  `GetBlockedTasks`, `GetCriticalPath`, `GetBottlenecks`.
  **Check the messages, not just the count** — same count with different messages is a new bug.
- `TestWatchTasks*` is genuinely flaky under CPU contention `[MEASURED-BY-dev-194-r8]`:
  0 failures in 12 sequential full-suite runs, 0 in 12 at 4-way concurrency, but **4 of 6**
  batches RED at 6-way concurrent `-count=20`. A control at base `1d4442f` gives an identical
  4 of 6, so it is **pre-existing and not this round's doing**. Re-run before concluding.

## What to read

`/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-r8.md` — the implementation
report. It is part of what you are reviewing: **check its claims, do not inherit them.**

---

# Your axis: the DIFF and the structure

You are the leg reading the change as *code* — correctness of the transformation, the shape of
the abstractions, what a future maintainer will do to it. Read `git diff 1d4442f..HEAD`.

## 1. The central claim of the round — is "by construction" actually true?

`RestrictLabelWriteToSnapshot` (in `internal/platform/github/passthrough.go`) was rewritten to
**derive from `applyLabelDelta` rather than mirror it**: it computes
`after := applyLabelDelta(snapshot, add, remove)` and emits the minimal `(add, remove)` that
carries `snapshot -> after`. The claim is that gate and restrictor **cannot** drift, because
there is only one implementation of the rule left.

That claim is the entire security argument of the round. **Test it as a claim about the code,
not as a slogan.** Does the emitted minimal edit provably reproduce `after` when replayed
through `applyLabelDelta` for *every* input, or only for the inputs someone thought of? Where
does the derivation still contain a hand-written decision, and is each one load-bearing?

Two specific spots the developer flagged as deliberate — audit both, they are where a
"simplification" would land:

- **removals are emitted in the *snapshot's* spelling, not the caller's**, because
  `labelNameToID` looks up `s.labelIndex[strings.ToLower(name)]` and the index is built with
  `strings.ToLower(l.Name)` and **no `TrimSpace`** `[MEASURED-BY-dev-194-r8]`;
- a **`removeKeys` safety belt** guarding the case where `ent.Task.Labels` carries two entries
  sharing a match key, which `applyLabelDelta`'s dedup would collapse.

## 2. The partition I got wrong — and nobody has checked the correction

`writeLabelSwap` now takes an explicit `stageWritePolicy`. **My brief told the developer to set
it from three call sites. That was wrong twice** `[MEASURED-BY-dev-194-r8]`: `CloseTask` does
not route through `writeLabelSwap` at all, and I omitted `UpdateTask`'s caller-supplied
`add_labels`/`remove_labels` arms, which *are* priced by the server's label-delta gate. The
developer shipped **six** call sites instead: stage arm, `ClaimTask`, and both caller-supplied
label arms as `stageWriteAllowed`; priority and type arms as `stageWriteForbidden`.

**The correction to my error has not itself been reviewed by anyone.** Enumerate the call sites
yourself from the code. Is the partition **complete** (every caller classified) and **correct**
(each on the right side)? A missed site defaults to whichever value the zero value gives — say
what that is and whether it fails safe.

## 3. The equivalent mutant the developer could not kill

For the config-collision check, mutant **M6c** — replacing the `StageToLabel`/`stripForMatch`
oracle with a hardcoded `"ft:stage/"` literal — **passes every test**, and the developer reports
it as a genuine equivalent mutant rather than dressing it up as a kill
`[MEASURED-BY-dev-194-r8]`. They added
`TestLifecycleKeyCollision_OracleIsStructurallyEquivalentToday` to pin the equivalence.

Is the equivalence argument sound? Is the pin the right instrument, or does it just relocate
the assumption? **A test named "…Today" is a claim with an expiry date — say whether the code
will notice when it expires.**

## 4. Ordinary code review

The remaining commits — `req.Type` validation split across two layers, `checkLifecycleKeyCollisions`,
`LoadConfigWithSource`, the instance-#11 test rewrite. Readability, naming, error handling, API
compatibility, dead code, comments that state things the code does not do. **A comment
asserting a property the code does not guarantee is a defect on this workstream** — we have
found several, including one written in a commit whose message was "correct two false rationales".

## 5. Expected-clean checks (report the result either way — rule 18)

I expect these to come back clean. **A clean result is a required reported outcome**, because a
ledger that only records hits implies a 100% failure rate forever:

- no `git push` was run, no remote refs moved;
- no generated or vendored file was hand-edited;
- the public API of `LoadConfig` is unchanged (the report claims a delegating wrapper).

---

# Verification bars

- **A negative claim needs a positive control drawn from a DIFFERENT axis than the one you
  searched.** A same-axis control is non-evidence for the failure that matters.
- **A green control is a finding, not a pass.** Write it down.
- **Predict counts before measuring**, and report the prediction next to the result.
- **Exit codes come from the child process, never through a pipe.**
- **Compare SHAs, never counts.**
- If a mutant does not compile, it measured nothing — check that failures are non-zero, not
  merely that the exit code is.

# Deliverables — you are not done until all four exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r8.md`**,
   with a clear verdict (**APPROVE** or **REQUEST CHANGES**), each finding severity-rated with
   `file:line`, and your evidence per finding.
2. **A project log entry** in `.design/project-log/`, **committed** to `label-write-scope-r8`.
3. **An explicit list of every place this brief was wrong.** If nothing, say so and say what
   you checked.
4. **Do NOT push. Do NOT modify production code — your independence depends on it.** Mutations
   for measurement are fine; revert them and assert `git diff --quiet` afterwards.

**You MUST produce all four deliverables and then mark the task complete.**
