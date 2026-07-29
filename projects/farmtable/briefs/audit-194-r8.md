# audit-194-r8 — independent security audit, #194 round 8

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `label-write-scope-r8` and commit **`158c8ae963faa5eef032e0857ecbc40d6a7c681a`**.
**Do NOT create any directory named in this brief.** `web/dist` is present — do not run
`make web`.

## How to treat this brief

Claims are tagged `[MEASURED]` (I ran it this session), `[MEASURED-BY-<x>]` (relayed, not
mine), `[BELIEVED]`, `[CARRIED]`.

**My briefs have contained at least one error in nine consecutive rounds.** The round-8
implementation report lists four errors in the brief I gave the developer, including one item
that contradicted another item of the same document. **Agreeing with a premise supplied in
this brief is worth ZERO, and from the outside it looks identical to genuine convergence. If
you confirm something I asserted, say that you are confirming MY claim and show your own
measurement.**

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
  0 failures in 12 sequential full-suite runs, 0 at 4-way concurrency, but **4 of 6** batches
  RED at 6-way concurrent `-count=20`; a control at base `1d4442f` gives an identical 4 of 6,
  so it is **pre-existing**. Re-run before concluding.

## What to read

`/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-r8.md` — the implementation
report. It is part of what you are auditing: **check its claims, do not inherit them.**

---

# Your axis: the ATTACKER and the INVARIANT

You are not reading this as a diff. You are reading it as a **trust boundary**, and asking what
a hostile or merely careless caller can make the server write to a third-party issue tracker.

## The invariant the round exists to defend

The server may write **only** the labels it priced. A caller-supplied label operation must never
cause a write outside the set the server's gate authorised, and no code path may quietly widen
that set. **State the invariant in your own words before you test it** — if your restatement
differs from mine, that difference is itself a finding.

## 1. The fix for the previous fix

Round 7 fixed defect **A-4** and, in doing so, **introduced C-1** — a restrictor that
reimplemented the gate's rule and drifted from it. Round 8's fix for C-1 is **substantially
larger than the fix it replaces**: nine commits, a new policy parameter threaded through six
call sites, a new config-validation pass, a changed config-loading API.

**A larger fix is a larger attack surface. What did round 8 introduce?** This is the primary
question of your audit. Treat "the round-8 change is itself a round-9 defect" as the default
hypothesis and try to confirm it.

## 2. Specific new surface, ranked by how much I distrust it

**(a) Removals are now emitted in the SNAPSHOT's spelling, not the caller's.** The stated
reason is that `labelNameToID` resolves via `s.labelIndex[strings.ToLower(name)]` and the index
is built with `strings.ToLower(l.Name)` and **no `TrimSpace`** `[MEASURED-BY-dev-194-r8]`, so a
padded caller spelling resolves to nothing and the removal silently evaporates. Verify the
underlying claim yourself in the code.

Then ask the security question the developer did not: **the snapshot is data that came back
from the remote platform.** What is in it, who controls it, and what happens if it contains a
label whose name is adversarial — unicode case-folding collisions, zero-width characters,
right-to-left overrides, a name that differs from the caller's only in normalisation form? Is
`strings.ToLower` the right fold for a security-relevant identity comparison?

**(b) The `stageWritePolicy` parameter.** Failure is by **error**, not panic, not silent skip.
What does the caller do with that error, and is the write actually prevented on every arm?
**A guard that returns an error the caller drops is not a guard.** Check the zero value of the
policy type: if a future call site omits the argument, does it fail open or closed?

**(c) `req.Type` validation and the config-collision check.** These reject inputs. Every
rejection is a potential denial of a legitimate operation, and every acceptance is a potential
injection. The developer's report says an allow-list for `req.Type` is **not** safely
implementable because Ent declares `field.String("type").Optional().Default("")` and the valid
set on a GitHub collection is operator configuration the server does not hold
`[MEASURED-BY-dev-194-r8]` — **that was a correction of an error in my brief. Verify it.** If
they are right, what is the residual risk of shape-only validation?

**(d) `LoadConfigWithSource` now reports an absolute path and whether an env override was
used, and `ConfigSource.Describe` renders it.** Where does that string go — logs, gRPC
responses, MCP output, the dashboard? **A path disclosed to a client is information
disclosure.** Trace every sink. This workstream has already shipped one HIGH-severity XSS that
a parallel audit caught and a code review missed; if any of this reaches the Lit dashboard,
treat rendering as in-scope for you.

## 3. Regression check on what previous rounds fixed

Earlier rounds on this branch closed A-4 and an XSS in the dashboard. **Confirm they are still
closed at `158c8ae`** — a nine-commit refactor is exactly how a closed hole reopens. I expect
these to be clean; **a clean result is a required reported outcome** (a ledger that records
only hits implies a 100% failure rate forever).

## 4. Deliberately unlisted

I am not going to enumerate every file for you. **The list above is my hypothesis about where
the risk is, and my hypotheses have been wrong every round.** Spend real budget outside it.

---

# Verification bars

- **A negative claim needs a positive control drawn from a DIFFERENT axis than the one you
  searched.** A same-axis control is non-evidence for the failure that matters.
- **If a control mirrors a function F, the oracle must BE F, never a reimplementation of F.**
- **Ask what your oracle can discriminate BEFORE asking what your inputs vary.** Exhausting
  inputs against a narrow oracle only stress-tests the hypothesis behind that oracle; it can
  never test whether the hypothesis is complete.
- **A green control is a finding, not a pass.** Write it down.
- **Predict counts before measuring**, and report the prediction next to the result.
- **Exit codes come from the child process, never through a pipe.**
- **Compare SHAs, never counts.**
- Your harness must **ABORT on a failed prerequisite**, never continue and report zero.

# Deliverables — you are not done until all four exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r8.md`**, with
   findings classified **Critical / High / Medium / Low / Informational**, each with `file:line`,
   an exploit path or a statement of why it is not exploitable, and a clear
   **APPROVE / REQUEST CHANGES** verdict. Say plainly whether anything blocks merge.
2. **A project log entry** in `.design/project-log/`, **committed** to `label-write-scope-r8`.
3. **An explicit list of every place this brief was wrong.** If nothing, say so and say what
   you checked.
4. **Do NOT push. Do NOT modify production code — your independence depends on it.** Probes and
   mutations for measurement are fine; revert them and assert `git diff --quiet` afterwards.

**You MUST produce all four deliverables and then mark the task complete.**
