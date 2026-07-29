# #194 `close-label-swap` — round-4 independent review (shared context)

**SHA under review: `03ab6b6`** on branch `close-label-swap`, parent `651da26`.
Your clone is already checked out there, clean. **The SHA is the identifier; the
branch name is not.**

Three legs run in parallel and independently: code review, test review, security
audit. **You are one of them. Do not read the other legs' reports and do not
coordinate.** Earlier in this workstream a coordinator relayed only the code
review's findings and missed a HIGH XSS in a parallel report. That is why all
three run every round.

---

## What this branch is, and what round 4 fixed

Farm Table can mirror GitHub issues as tasks. Lifecycle stage is carried in
`ft:stage/*` labels. A **terminal** stage (`completed`, `wont_fix`, `duplicate`,
`cancelled`) is an authorization boundary: moving a task out of one requires
`task:accept`, not the blanket `task:write` every agent token holds.

**Round 3 shipped a fix that was incomplete, and the incompleteness was
Critical.** `TerminalLabelStage` delegated to `MapLabelsToStage`, which collapses
a label set to a single highest-precedence winner. `stagePrecedence` ranks every
non-terminal stage **above** every terminal one — correct for a display, because
live work should never render as finished, and catastrophic for a privilege
check. One extra ordinary label hid the terminal one before the question was
asked.

Measured consequences, all verified by execution:

- **12 of 16** label combinations bypassed the accept gate.
- The **availability** gate and the **claim** gate inherited the same blindness.
- **Self-service**: `add_labels` is guarded only by blanket `task:write` (the
  transition-scope check fires only when `req.Stage != nil`). One token, two
  ordinary API calls, no second actor, no GitHub access, no partial failure.
- **The escalation erases its own evidence.** The successful transition runs the
  normal label swap and removes the terminal label. Afterwards the issue looks
  like ordinary accepted work. Treat that as a forensic property in its own
  right, not merely a severity multiplier.

Round 4's production change is small — `labels.go` and `passthrough.go` only:

- `TerminalLabelStage` now **scans the label set directly** for any terminal
  stage, resolving ties with a **separately declared `terminalStagePrecedence`**.
  The dev deliberately did *not* implement this by filtering `stagePrecedence`,
  on the grounds that filtering leaves the privilege answer coupled to the
  display rule.
- `!m.enabled` added to the guard, because the scan reads `m.labelToStage`
  directly and `NewLabelMapper` populates that regardless of `Enabled`.
- A false comment in `ComputeAvailability` corrected.

Everything else is tests.

## What I verified myself at `03ab6b6`, so you do not have to re-derive it

```
go build ./...   rc=0
go test ./...    rc=0, 0 failures
make race        rc=0, 0 data races      (note: this target exits 2, not 1, on failure)
go vet ./...     rc=1 — exactly 4 copies-lock findings, ALL in internal/server/server.go
                 (:1516 :1626 :1834 :2011), pre-existing, none in a touched file
git status --porcelain  empty
```

Direct measurement of the fixed function, mapper enabled:

| labels | terminal | display |
|---|---|---|
| `[wont_fix]` | `wont_fix` | accepted |
| `[wont_fix, accepted]` | `wont_fix` | accepted |
| `[accepted, wont_fix]` | `wont_fix` | accepted |
| `[duplicate, working]` | `duplicate` | working |
| `[cancelled, triage]` | `cancelled` | triage |
| `[completed, in_review, deploying]` | `completed` | in_review |
| `[duplicate, wont_fix, completed, cancelled]` | `completed` | accepted |
| `[accepted]` | — (false) | accepted |
| `[]` | — (false) | accepted |
| `[wont_fix]`, mapper **disabled** | — (false) | — |

Order-independent, non-vacuous (nine inputs, six distinct answers), and the
disabled control declines.

---

## KNOWN RESIDUALS — already found, already sequenced. Do not re-report as new.

**R-A. `add_labels` / `remove_labels` are unguarded at `task:write`.**
`server.go:621-625` pass them through; the transition-scope check at
`server.go:552-557` lives inside the `if req.Stage != nil` arm. So a caller can
rewrite the very label set authorization reads. **The round-4 fix makes the
lifecycle read the labels correctly; it does not make the labels trustworthy.**

**R-B. The `from == to` short-circuit.** `TransitionScope` returns
`ScopeTaskWrite` when source equals destination, and the source is now an
attacker-influenceable terminal label. Under any fixed tiebreak an attacker can
name the terminal stage matching their destination.

Both are being measured right now by a separate leg and are sequenced as **round
5**, under one candidate control: when `AddLabels`/`RemoveLabels` are present,
compute the lifecycle stage of the **post-mutation** label set and require the
corresponding transition scope — treat a label edit that changes lifecycle stage
as the transition it actually is.

**You may and should tell me if you think round 5 is wrong, insufficient, or
should have been round 4.** What is not useful is rediscovering R-A or R-B and filing
them as an oversight.

### Other disclosed, deferred items

`#203` (move the authoritative stage off labels entirely) · `#202` (make `ft
ready` and MCP `task_ready` inherit one availability answer) · audit **F4**
(unprefixed stage-named labels are authoritative) · **F5** (availability
degrades to stage-only on error) · **F7** (4 pre-existing `go vet` copies-lock) ·
bare stock `duplicate` label handling · `passthrough.go:424-431` remove-then-add
ordering · `UpdateTask` builds its response proto from the issue **before** the
label swap, so the returned stage can disagree with the final label state.

---

## Standing bars — these apply to YOUR method, not only to the code

1. **Measure, do not assert.** Label every claim **BY EXECUTION** or **REASONED**
   and paste the output.
2. **Measure regardless of whether the first answer is the one you would want to
   be true.** A diagnosis that makes you the lone clear-eyed observer earns the
   same skepticism as one that confirms your fear.
3. **A harness that cannot express an input cannot test it.** This has now bitten
   three different legs tonight, each in a different way:
   - a security audit's **stateless mock** returned a clean pass on a two-call
     chain — the chain was *inexpressible, not disproven*, and it nearly filed a
     confident false negative against a true finding;
   - a test suite's fixture took a **single label string** rather than a set, so
     no mutation of it could ever express the input that triggered the Critical;
   - the audit's PoC **fixed the destination** to `accepted`, so four `triage`
     cells were invisible and *both* review legs recorded them as safe.

   **Any claim of a NEGATIVE result across more than one step must first prove
   the harness can express the state change**, with a self-check that fails
   closed. Mutation testing proves your tests are bound to your code; **only
   input-domain variation proves they are bound to reality.** For predicates over
   collections the axis is cardinality: **zero, one, TWO, conflicting.**
4. **A count pin must state what its rows can and cannot express.** A cardinality
   assertion over a foreclosed schema is a vacuous assertion wearing a number,
   and it is *worse* than no pin, because it makes the blind spot look
   deliberate and verified.
5. **State targets as invariants, not as deltas.** "Restore pre-F2 behaviour" was
   the target for three rounds and could never have found this, because a hole
   that predates the diff has no diff pointing at it. The canonical form here is
   the auditor's: **"Authorization must never read a precedence-collapsed label
   projection."**
6. **Content-addressed mutations only**, never line-numbered; abort if the anchor
   does not occur exactly once. Back up **outside** the repo, and after every
   restore assert `git status --porcelain` is empty **and** positively assert the
   property you wanted restored.
7. **"Clean" is not "unchanged."** A tree-cleanliness assertion measures agreement
   with HEAD, so it is structurally blind to work that was never in HEAD. Commit
   before running any mutation driver.
8. **Capture the real exit code from the child process, never through a pipe.**
   `go test ./... 2>&1 | tail -3; echo $?` reports `tail`'s status.
9. **Costly disclosure is the signal we trust here.** Three legs tonight have
   disclosed something that made their own prior work look worse: a test review
   retracted "the fix is sound"; a security audit reported its own false
   negative; the developer reported that its first claim-gate probe was a **false
   pass** that had laundered a bypass as a denial. All three were right to. If
   your own method turns out to be flawed, lead with it — it raises your report's
   standing.

## Rules

- **Do not push. Ever.**
- **Do not modify production code.** Your independence depends on it. Delete
  scratch files; leave `git status --porcelain` empty.
- Salvage anything valuable to
  `/scion-volumes/scratchpad/projects/farmtable/salvage/` as a **real file** —
  that directory is shared and outlives your container; your `/tmp` does not, and
  a prose description of a harness is not a salvaged harness.
- You may commit a project-log entry to your own clone. Report the SHA; I
  preserve reviewer commits at merge time.
