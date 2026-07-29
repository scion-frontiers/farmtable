# #194 round 5 — SHARED review brief (all three legs)

**Target:** branch `label-write-scope`, SHA
`ea8ac390dad3d2401d65608684e5d6623ab15ac5`. Verify with `git rev-parse HEAD`
before you start. **The branch name is not the identifier; the SHA is.**

You are one of **three independent legs** running in parallel: a code review, a
security audit, and a test review. **Do not read the other legs' reports or
working files.** Your value is that you did not.

## Isolation — READ THIS, IT CHANGED THIS ROUND

Last round the shared salvage directory caused a real independence failure: one
leg's harness file was overwritten by another leg mid-read, and the new header
carried that leg's conclusions about a charge the reading leg had not yet
answered. That was my briefing defect, not theirs.

So, this round:

- **Your clone is yours alone.** Do not touch any other `/workspace/farmtable-*`.
- **Write scratch artifacts ONLY to your own salvage subdirectory**, named in
  your leg brief. Do not write to
  `/scion-volumes/scratchpad/projects/farmtable/salvage/` directly.
- If you want to reuse a harness from a previous round, **copy it into your own
  directory first and record its sha256 in your report.** Do not read it in
  place.
- If you find yourself reading a file whose header discusses this round's
  findings and you did not write it, **stop, close it, and disclose it.**

## What landed

Round 4 (already reviewed) made `TerminalLabelStage` scan the whole label set
instead of a precedence-collapsed winner. Round 5 adds three controls, all
converging on `UpdateTask`:

- **B1** — a label edit (`add_labels`/`remove_labels`) that moves the lifecycle
  stage now costs what the equivalent stage change costs. Previously label-only
  requests never reached the transition gate at all.
- **B5** — authorization reads the **set** of terminal stages a task names, not
  the one a tiebreak selects.
- **B6** — a label may feed an authorization or terminal-stage answer **only if
  it carries the configured push prefix**.

Stated as invariants (the developer's words, and the form I asked for):

1. If authorization reads a value, every write path to that value must be
   guarded by the same authorization.
2. An authorization decision must not depend on which of several equally present
   values a tiebreak happens to select.
3. A label may contribute to an authorization determination only if it carries
   the configured push prefix; prefix-tolerant matching is a display affordance.

Commits: `806b164`, `b37269c`, `a98d162`, `7ae69ff`, `ea8ac39`.
The developer's log entry is at
`.design/project-log/close-label-swap-r5-label-write-scope.md`. **Read it — and
treat it as a claim to be checked, not as a finding.**

## My gate, reproduced independently — agree or disagree with it

```
GO_BUILD_EXIT=0        (after `mkdir -p web/dist && echo ... > web/dist/index.html`
                        — a clean checkout cannot build; see below)
GO_VET_EXIT=1          exactly 4 pre-existing copies-lock findings, no others:
                       server.go:1601, :1711, :1919, :2096
GO_TEST_EXIT=0
MAKE_RACE_EXIT=0
```

Two notes so you do not waste time:

- `go build ./...` fails on a clean checkout with
  `assets.go:5:12: pattern all:web/dist: no matching files found`. `web/dist` is
  an npm artifact, gitignored, never committed. Stub it or run `make web`.
- The vet line numbers **moved** from the round-4 report (1516/1626/1834/2011)
  because `server.go` grew by 93 lines. They are the same four findings — I
  verified by request type, not by line number. A stale line number has produced
  a false negative on this workstream before.

`make race` exits **2**, not 1, on failure, and is scoped to
`./internal/platform/github/` only.

## Standing bars for this workstream

These are not style preferences. Every one of them exists because something got
through.

1. **A check that derives from the thing it is checking cannot falsify it.**
   This is the unifying defect of this entire branch. It has now appeared four
   times, most recently *inside a test written to catch other instances of it*.
2. **Every negative claim needs a control that fails closed.** A sweep that
   returns "0 bypasses" from a probe that cannot express success proves nothing.
   Pin vacuity explicitly (`sawTrue`/`sawFalse`, allow/deny non-uniformity).
3. **"Clean" is not "unchanged."** Verify by sha256 against an out-of-repo
   pristine copy, not by `git status` alone.
4. **Mutations are content-addressed, never line-addressed.** Abort if the
   anchor is not unique. Capture exit codes from the child, never through a pipe.
5. **A fixture that cannot express the input is not evidence.** Ask what inputs
   your fixtures *cannot* express. The two highest-value findings of the last two
   rounds — the label-set cardinality bypass and the `renderMarkdown` arity
   bypass — were both found this way and neither was reachable by asking "what
   mutation survives."
6. **Verify that a mutation actually weakens the thing before filing it green.**
   A green mutation that is a genuine no-op is not a finding.
7. **Costly disclosure is the trust signal.** If your own first probe was wrong,
   say so. Several findings this workstream depended on exactly that.
8. **Report a narrower true claim over a broader unverified one.**

## What is DELIBERATELY out of scope — do not re-file

All of these are already found, triaged and sequenced. Re-filing them costs
review capacity and buries new findings.

- **The fourth sink**: `ft ready` scheduling, `GetReadyTasks` → `buildIssueTree`
  → `MapLabelsToStage` (`treewalk.go:36`) → `computeReady` (`:92`, `:105`).
  Known, round 6, deliberately untouched this round.
- **`hasExternalUnavailableLabel`** (`treewalk.go:153-164`) hardcoding `"ft:"`
  and ignoring `m.enabled` — known, round 6. Same prefix theme as B6; still not
  this round.
- **The fail-open tiebreak loop** in `TerminalLabelStage` (a terminal stage
  absent from `terminalStagePrecedence` is silently dropped) — known, round 6.
  I verified the round-5 edits did not touch it.
- **Enum drift / vacuous guard**: hand-maintained `allStages`, guard draws its
  universe from the list it guards — known, round 6.
- **No audit trail on GitHub-backed tasks** — known, tracked.
- **`CreateTask` accepting a terminal label ungated** — disclosed and pinned by
  the developer this round; tracked.
- **F7**: `StageLabelSwap` still deletes a human's bare stock label. The
  developer measured it, reported it **unfixed**, and pinned it. Correct
  behaviour on their part; do not file it as new.
- **The 12 newly-denied cells** (a task carrying only a stock label now reads as
  live/available). This is a **ruled and accepted** safe-direction cost.

**If you believe any of the above is materially worse than recorded, say so** —
that is a finding. Restating it at its known severity is not.

## Deliverable

Write your report to the exact path in your leg brief. Structure:

- **VERDICT: APPROVE** or **REQUEST CHANGES**, up front.
- Severity summary table (Critical / High / Medium / Low / Info).
- Findings with `file:line`, evidence, and a recommended fix.
- Mark each finding **BY EXECUTION** or **REASONED**. Do not blur them.
- A methodology / disclosures / limitations section: what you did **not**
  establish, what your harness could not express, and anything that compromised
  your independence.
- Also commit a short project-log entry in your clone (`.design/project-log/`).
  **Commit locally. Do not push. Do not modify production code** — your
  independence depends on it.

You MUST write the report file and then mark the task complete.
