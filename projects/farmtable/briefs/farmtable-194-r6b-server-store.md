# #194 round 6 — leg B: the unguarded write path and the duplicated fallbacks

You are `dev-194-fixes-6b`. Your workspace is mounted at `/workspace`. Branch
`label-write-scope-r6b`, based on `ea8ac390dad3d2401d65608684e5d6623ab15ac5`.
Verify that with `git rev-parse HEAD` before you touch anything. If it does not
match, stop and tell me.

## Your domain — and the boundary you must not cross

You own **`internal/server/`** and **`internal/store/`**.

A second developer (`dev-194-fixes-6a`) is working in parallel on
**`internal/platform/github/`** and the label/prefix authorization surface. Do
not edit files there. If you conclude a fix of yours requires a change in
`internal/platform/github/`, do not make it — write it down and tell me, and I
will route it.

## Context you need before you start

Round 5 went through a full three-way independent review: code review requested
changes, security audit approved, test review approved with findings. Your leg
carries the single most important *behavioural* finding of the round (A-1) and
two structural ones.

The three reports are on disk. Read all three in full — at minimum read
`audit-194-r5.md` completely, since A-1 is yours:

- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r5.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r5.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r5.md`

## The defect class this whole workstream keeps producing

**A check that derives from the thing it is checking cannot falsify it.** Six
instances so far on this branch. Related forms, all of which have bitten us:

- **A fixture that cannot express the input.** The test passes because the
  harness cannot construct the breaking case.
- **A correct check answering a question nobody meant to ask.**
- **An expected value derived from the same configuration it is meant to verify.**

When you write a pin, ask: *what input would make this fail, and can my fixture
even build that input?* If it can't, the pin is decorative.

## Work items

### B1 — Audit A-1 [MEDIUM, the real defect]: `CreateTask` is an unguarded write path

Round 5 established the invariant that a caller cannot reach a terminal stage
without the close privilege. **Round 5 does not satisfy its own invariant 1.**
Measured on a bare `task:write` token:

```
CreateTask(stage=completed)                 -> DENIED
CreateTask(labels=[ft:stage/completed])     -> ALLOWED
   resulting stage = completed
   Available=false  Reasons=[terminal]
   undo (UpdateTask back to accepted)       -> DENIED, names task:accept
```

So a `task:write` caller can create a born-terminal task, and **cannot undo it.**
It is one-way. The front door is locked and the label spelling walks in.

It is Medium rather than High because the blast radius is the caller's own new
task, and a born-terminal child does **not** unblock a parent: `hasOpenSubIssue`
(`passthrough.go:640`) and `computeReady` (`treewalk.go:84`) both key off issue
STATE, not label stage. Do not let that reasoning talk you out of fixing it —
it is load-bearing on two facts in another package that nobody has pinned.

Do: route creation-time labels through the same lifecycle-delta authorization
the update path uses, so `CreateTask` satisfies invariant 1. The auditor sketched
a fix using `store.LabelDeltaLifecycleStages`; that function is in your domain,
so you may change it — but see B4 first, because its fallback is fail-open.

Note the auditor **withdrew** a related finding about `InsertTasksAfter` after
measuring that it returns `Unimplemented`. Don't re-file it.

Also note the auditor's own declared limit: their server probe **reuses the
developer's fixture helpers**, and the mock **conflates create with update**.
Build your test on a fixture that can tell those two apart, or you will be
pinning the mock rather than the server. Their custom-prefix `CreateTask` cell
measured nothing and they renamed it `..._FIXTURE_CANNOT_EXPRESS_THIS` rather
than let it read as a pass — that honesty is the standard here.

**Also unexcluded by anything round 5 did:** the TOCTOU window between
`LabelDeltaLifecycleStages` and the actual label write. You are not required to
close it. You **are** required to not write any comment or test implying it is
closed. If you can cheaply narrow it, do; otherwise record it precisely.

### B2 — Test T-2 [MEDIUM]: unreachable duplicated fallbacks

`store.go:133` and `store.go:152` are unreachable duplicates of
`multistore.go:250` and `multistore.go:263`. Evidence: `MUT_DELTA_FALLBACK` and
`MUT_NATIVE_SPURIOUS` both survived with **0 failures**, while the control
`MUT_MS_NATIVE_SPURIOUS` on the multistore copy killed 1 test. Note the shape of
that evidence — the control is what makes the negative result mean something.

This is drift risk, not an untested control. Two copies of a rule is one copy
plus a future bug. Collapse them, or make the `store.go` pair provably
unreachable (and then say so with a tripwire, not a comment).

### B3 — Test T-4 [LOW but do it first]: the `identity_test.go:250` panic

A real latent flake, and it **corrupts every measurement taken on this tree**.
Fault injection measured **215 tests clean vs 115 under fault — 100 tests
silently never executed.** Any kill count or coverage number measured on a
panicking run is unreliable, including ones the parallel leg is taking right now.

It is a one-line fix. Land it early and tell me the moment it is committed so I
can relay it to leg A.

### B4 — Review F7 [INFO, upgraded]: the fail-open fallback

`LabelDeltaLifecycleStages`' `(current, current)` fallback is fail-**OPEN** for a
second implementer. The security audit (A-3) then found it is **RPC-reachable
today**, and materially worse than F7 recorded: `UpdateTask(stage=wont_fix)` on
`[ft:stage/wont_fix, duplicate]` is ALLOWED and destroys the human's stock
`duplicate` label.

Leg A owns the caller-side fix in `internal/platform/github/`. **You own making
the fallback itself fail closed.** Coordinate through me, not directly — and be
aware that leg A has been told to stop and ask if their fix needs to change this
function's behaviour. If you change its semantics, tell me immediately so I can
relay it.

### B5 — Review F6 [INFO]: no compile-time assertion for `LifecycleStageSetStager`

Add one. The interface is satisfied by accident today.

### B6 — Test T-3 [LOW]: a "swap" test that never swaps

`TestUpdateTask_SwappingOneTerminalLabelForAnotherRequiresClose` never performs a
swap — every cell only calls `f.addLabels`. A genuine single-request swap
(one call that both adds and removes) is **unexpressed suite-wide.** This is the
fixture-cannot-express-the-input class in its purest form: the test is named for
the case it cannot construct.

Make the fixture able to express a real swap, then assert on it. If the real
swap turns out to behave differently from the add-only approximation, that is a
finding — report it loudly rather than adjusting the assertion to match.

### B7 — Salvage: 1167 lines of probe tests already written

The round-5 auditor's preserved log commit `00755260c42e14e9dac7d0f7041f60ea55085b32`
also carries `audit_r5_prefix_probe_test.go` (457 lines) and
`audit_r5_probe_test.go` (710 lines). Some of it is throwaway probing; some of it
is coverage we should keep. Fetch that commit, read those two files, and land
**selectively** — the parts that pin real behaviour, renamed and cleaned to suit
the suite. Do not bulk-import them. Say in your log which parts you kept and
which you dropped and why.

## Standing bars — these are not optional

1. **Positive control before any negative claim.** If you report "X is not
   reachable" or "this mutation is caught," first demonstrate your harness can
   detect the thing when it *is* present. A green result from a harness you have
   never seen go red is worth nothing. An auditor on the parallel #195 workstream
   produced a complete, clean, entirely fictitious table of eight caught
   mutations this way — the script was erroring before it ever ran the suite, and
   it was caught only because someone went to quote a failure reason and found
   the logs empty.
2. **Mutations content-addressed, never line-addressed.** Anchor on unique
   surrounding text; **abort if the anchor is not unique.**
3. **"Clean" is not "unchanged."** Verify restoration with sha256 against an
   out-of-repo pristine copy, not `git status`.
4. **Verify a green mutation actually weakens the thing** before concluding
   anything. Two mutations last round were invalid — compile errors from unused
   imports — and would have been two false findings judged on exit code alone.
5. **Exit codes from the child, never through a pipe.**
6. **Read the logs, not the summary JSON.** Last round's `result_MUT_*.json`
   files undercounted.
7. **Costly disclosure is the trust signal.** Report dead ends, voided runs, and
   places you were wrong. A narrower true claim beats a broader unverified one.

## Your gate

Run and record, each with the exit code taken directly from the child process:

```
go build ./...          # expect 0
go vet ./...            # expect 1 — 4 PRE-EXISTING copies-lock findings.
                        # Verify BY REQUEST TYPE that these are the same four.
go test ./...           # expect 0
make race               # expect 0 (scoped to ./internal/platform/github/)
```

Also report the total test count — after B3 lands it should be near 215, not
115. A silent skip must not hide in a green run.

There is **no CI**. Nothing runs these but you.

## Deliverables — all four are required

1. Code and tests committed to `label-write-scope-r6b`, in coherent commits with
   clear messages.
2. **A project log entry** at `.design/project-log/`. Not optional. State what
   you fixed, what you deliberately did not fix, and — for every claim about
   reachability or coverage — the command or execution that establishes it. Be
   explicit about the TOCTOU window's status.
3. A short summary message to me (`scion message farmtable-em-task-state-model-v2`) with: the four
   gate exit codes, the test count before and after B3, one line per work item
   B1–B7 with its status, and anything you were forced to leave for leg A or me.
   **Message me about B3 as soon as it is committed, ahead of the rest.**
4. **Do not push.** Commit locally only. I am the only agent permitted to push.

If any item turns out to be wrong, or the fix is bigger than the finding
suggests, say so rather than forcing it — a report that an item was mis-scoped
is a useful result, not a failure.

You MUST commit your work, write the project log entry, send me the summary, and
then mark the task complete.
