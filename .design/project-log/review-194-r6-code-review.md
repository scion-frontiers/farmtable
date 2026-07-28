# #194 round 6 — code review leg record

Reviewer: `review-194-r6`. Tree: `label-write-scope-r6` @ `6ced24e`, confirmed by
`git rev-parse HEAD` before any other command.
Charge: correctness, readability, architecture (R-1 … R-7), plus standing charges
C-A and C-B.

**Verdict: APPROVE.** 0 Critical, 0 Required, 4 Optional/Consider, 1 Nit, 2 FYI.
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r6.md`.

## Build remedy — established independently, not taken from the brief

`npm` and `node` are present in this container, so I ran the **real** `make web`
rather than stubbing `web/dist`. Exit 0, 4109 files. Every build/vet/test number
I reported comes from a genuine asset tree. Stubbing was available and I did not
use it; the round-5 failure mode was three legs reporting a build that had never
happened, and a real build is the only remedy immune to that.

Independently measured on this SHA:

```
go build ./...   before make web -> EXIT 1  assets.go:5:12: pattern all:web/dist: no matching files found
make web                         -> EXIT 0  4109 files
go build ./...   after  make web -> EXIT 0
go vet ./...                     -> EXIT 1  exactly 4, all "copies lock value to ephReq"
go test ./...                    -> EXIT 0  panics 0, setup-failed 0
go test ./... -v                 -> 625 top-level / 1825 results / 0 skipped / 0 failed
go test -race ./internal/server/ -> EXIT 0  0 data races (ran once, not 3x)
make race                        -> scoped to ./internal/platform/github/ only
```

**Positive control on "the 4 vet findings are pre-existing."** I did not take
this on faith. I built a `git worktree` at base `ea8ac390`, copied in the built
`web/dist`, and **recorded the prediction before measuring**: 4 findings, same
four request types, 0 in `platform/github`. Exactly that came back. Matched by
request type throughout, never by line number.

## Findings

No Critical. No Required. The production delta is 591 insertions across 8 files
of which 400 are comments — roughly 191 lines of executable change, carried by
3,716 lines of new tests.

- **O1** the validated chokepoint (`store.LifecycleStages`) is held by
  convention, not the type system. Verified there is no production bypass today;
  propose renaming the raw interface methods `…Unchecked`.
- **O2** `CreateTask`'s synthetic `&ent.Task{Stage: stage, …}` is inert on the
  pass-through path; `before` is the constant `{accepted}`. Not a bug, a
  comprehension trap in security-sensitive code.
- **O3** `computeBlocked` did not get the terminal withhold `computeReady` got.
  Reporting-only, no privilege impact.
- **O4** `Validate` is bypassed by programmatic config construction (the reason
  the sorted-key backstop exists); consider validating in `NewPassThroughStore`.
- **N1** known-open #6 confirmed still present (`passthrough.go:54` names
  functions that do not exist). Confirmation, not a new finding.
- **FYI** `labels(first: 20)` is pre-existing and outside the diff, but the new
  gates now make authorization decisions from a possibly-truncated label set.
  Deserves an issue.

## The seam — escalation question answered with evidence

The EM asked to be told loudly if the known-open stage-collapse seam enables
**escalation** rather than only label destruction.

Positive control first: confirmed the probe can see an authorization answer move
(unlabelled issue `Available=true`; `ft:stage/completed` issue `Available=false,
Reasons=[terminal]`). Prediction recorded before measuring. Result matched the
prediction exactly across all four terminal stages:

```
collapse removal:  permitted=true, stage unchanged, availability unchanged  (x4)
chained 2nd removal: DENIED at task:accept, task remains terminal           (x4)
```

**Destruction only. Not an escalation. Not worse than stated.** The mechanism is
self-limiting: the quantity the gate compares (the resolved stage set) is exactly
the quantity that must move for a privilege change, so any escalating write
necessarily changes the set and is charged.

Bounded: tested 2 spellings x 4 terminal stages at the default prefix. Did **not**
cover the `ft:priority/…` spellings (known-open #4), non-default `push_prefix`, or
configured aliases. I do not claim "no escalation exists" in general.

Both characterization tests are active, neither is `t.Skip`, both currently pass
(seam still open, as intended). `0 skipped` across the whole tree.

## R-7 — log entries checked against code

Checked the fragile assertions in both new entries: `transitions.go:124`,
`terminal_label_stages.go:176`, `reopen_test.go:336`, all 9 named tests, the
one-caller/two-consumers enumeration, and the transition matrix (by execution).
**No false factual claim found.** The round-6 entry actively *corrects* round 5's
false "callers on a privilege path use AllTerminalLabelStages" claim rather than
inheriting it.

## Disclosures — dead ends, void measurements, and where I was wrong

- **My first build measurement was confounded.** Initial `go build` exit 1 matched
  the brief, but the log was full of `go: downloading` — a cold module cache could
  have produced exit 1 without the embed ever being reached. Re-read the tail,
  found the real `all:web/dist` error, and only then counted it. Reporting the
  first run would have been a non-fact of exactly the C-A shape.
- **My restoration harness produced two false mismatches.** sha256 flagged
  `CLAUDE.md` and `GEMINI.md` while `git status` was clean. Chased the
  contradiction instead of the friendlier number: both are symlinks to
  `agents.md`, and `git show` returns the link target while `sha256sum` follows
  the link. Harness bug. Fixed to compare `readlink` for symlinks; re-ran clean at
  **0 mismatches / 466 files**.
- **Tripped standing bar 3 in my first three commands** — took an exit code
  through a pipe (`ls … | head; $?`) and got `EXIT_LS=0` for a nonexistent
  directory. Caught it, discarded the value, used `cmd > log 2>&1; E=$?`
  thereafter.
- **Two hypotheses formed and falsified**, both of which would have been findings
  had I stopped at plausible: (a) `TransitionScope("completed","wont_fix")` is
  `task:close`, not `task:write`, so `CreateTask`'s single-`from` shape is not a
  hole; (b) `treewalk.go:63-64`'s label overwrite is not lossy — both top-level
  and sub-issue selections are `labels(first: 20)`.
- **Not covered:** `-race` run once rather than 3x; TOCTOU window not exercised;
  the 3,716 new test lines read selectively (those bearing on my charges) rather
  than line-by-line; merge replay not performed.

## C-A — brief claims relied on without verification

Not verified: **the merge was clean/no conflicts** (I reviewed the merged result,
not the merge — the only claim whose failure mode is *missing* code, invisible to
my review, and the one I'd most want a second look at); known-open #2 (TOCTOU),
#4 (`ft:priority:completed`), #5 (deferred 12-cell matrix), #3 (A5 benignity
re-derivation); and all historical/process claims (eight defect instances, five
void harnesses, round-5's stubbed-build report, the 500-mapper 60/440 split).
The historical claims shaped my *method* — they are why I built a positive control
and predicted before measuring — but **no finding or severity in my report rests
on any of them**.

## C-B — least supported claim this round

That the two consumers of the single-answer `LifecycleStage` are safe because
neither branches on *which* terminal stage it is. Currently true (I checked both),
but it is a claim about the future enforced by a test whose scope is the set of
consumers that exist today — a newly added discriminating consumer would not
appear in it. That is adjacent to this branch's named defect class.
**Falsifier:** add a consumer that branches on the terminal stage (e.g. a distinct
denial reason for `wont_fix` vs `duplicate`) and run the suite; I predict it stays
green while an authorization answer becomes dependent on `terminalStagePrecedence`
ordering. I did not run it — it requires a production change I am barred from
making — so I name it as the falsifier rather than claiming the result.

## Tree hygiene

Three probe files created under `internal/server/` and all removed. Restoration
verified content-addressed: sha256 of all 466 tracked files against their HEAD
blobs, **0 mismatches**, 0 untracked non-ignored files. No production code
modified. Nothing pushed.
