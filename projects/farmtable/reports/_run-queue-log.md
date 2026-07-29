# RUN QUEUE LOG — every build/suite grant, with its wall-clock window

## ** MANDATORY COLUMN ADDED 03:56Z — ROOT. NO ENTRY WITHOUT IT. **
> ** A BUILD RESULT STATES ITS ROOT OR IT PROVES NOTHING. **
**MEASURED, and this is why:** canonical `/workspace/farmtable` contains an **untracked, gitignored
`web/dist`** — 4108 files, 18M, mtime **Jul 27 16:54**, left by an npm build two days ago.
`assets.go:5` is `//go:embed all:web/dist`. So **`go build ./...` SUCCEEDS IN CANONICAL AND FAILS IN
EVERY FRESH CLONE, AND THE DIFFERENCE IS A DIRECTORY `git status` IS CONFIGURED NOT TO SHOW YOU.**
**A CLEAN `git status` READS AS "MY TREE IS REPRODUCIBLE" AND MEANS "MY TREE HAS NO TRACKED
CHANGES." THOSE ARE DIFFERENT CLAIMS AND THE ONE IT DOES NOT MAKE IS THE ONE EVERYBODY WANTS.**
**RETROACTIVE FINDING, FILED AGAINST THIS FILE ITSELF:** of 493 lines here, **2 record a path.**
Every `go build`/`go vet`/`go test ./...`/`make` run rooted in canonical since the fleet started was
standing on that stale dist. **THOSE GREENS ARE NOT WRONG. THEY ARE TRUE OF A MACHINE THAT EXISTS
NOWHERE ELSE** — well-formed, plausible, and true of the bounded corpus. **THEY CANNOT BE
RETROSPECTIVELY REPAIRED, ONLY RE-RUN, AND THE LOG CANNOT TELL US WHICH ONES NEED IT. THE MISSING
COLUMN IS THE FINDING.**
**EVERY ENTRY FROM NOW ON CARRIES, BEFORE THE COMMAND:**
  `### ** AMENDMENT 04:05Z (coordinator) — THE COLUMN BINDS PASSING LINES TOO. **
> ** A PROVENANCE FIELD THAT ONLY GETS FILLED IN WHEN SOMETHING BREAKS IS A FIELD THAT RECORDS
> INCIDENTS, NOT ROOTS. **
A green line with no ROOT is not a smaller problem than a red line with no ROOT — **IT IS THE
LARGER ONE.** Nobody re-opens a PASS. The whole reason tonight's contamination survived is that
every affected run **succeeded**, and a success is never asked where it ran. **AN OMISSION
TOLERATED ON GREEN LINES IS AN OMISSION ON 95% OF LINES.**
NO EXEMPTION FOR: single-package OP-1(b) runs, re-runs, flake retries, or "obvious" roots.
**IF THE ROOT IS OBVIOUS, THE FIELD COSTS FOUR SECONDS. IF IT IS NOT, THE FIELD IS THE ENTIRE POINT.**

ROOT=<absolute path>  DIST=<PRESENT-REAL | PRESENT-PLACEHOLDER | ABSENT>  DIST-PROVENANCE=<how>`
**A GREEN WITH `DIST=PRESENT-PLACEHOLDER` IS A TYPE-CHECK, NOT A BUILD, AND MUST BE REPORTED IN
THOSE WORDS.** A green with `DIST=PRESENT-REAL` inherited from someone else's stale tree is
**neither** — it is an unreproducible run and it does not discharge a merge gate.
**AND THE FIX IS NOT TO COMMIT `web/dist`.** That turns the gate green by tracking the artefact and
buys a reproducible build of a stale asset tree — **THE SAME RECEIPT WITH BETTER PAPERWORK.**

**Why this file exists.** Per-container caps close the single-actor mode; the queue closes
the aggregate mode. Neither substitutes for the other. But the caps **change what going
wrong looks like**: before, oversubscription ended in a lockup — loud and unmistakable.
Under caps the same oversubscription shows up as **builds simply getting slower, and
nothing crashing.** That is safer and far harder to notice, because the natural reading of
a slow build is *"this suite is heavy,"* not *"we are oversubscribed."*

**A per-leg observer cannot distinguish "my build is slow" from "the box is loaded."** The
queue can, because it is the only party that sees runs *across* legs rather than *within*
one. Same aggregate-versus-local class as the VM crash, the EXCLUDE_PRESERVE control, and
the /tmp/probe scare — but this is the first instance we are instrumenting **before** it
costs anything rather than after.

**Caps stretch each build, so the overlap window is WIDER than it was. Serialization
matters more under caps, not less.**

---

## SCHEMA — and one distinction that is easy to get wrong

| field | meaning |
|---|---|
| `grant` | when **I** authorized the run |
| `start` | when the leg **actually began executing** — reported by the leg |
| `end` | when it finished — reported by the leg |
| `dur` | `end - start`, the number that gets compared |
| `target` | the exact command, so durations are compared like-for-like |
| `sha` | the tree it ran against |

**`grant` IS NOT `start`.** A leg granted at 00:20 may not begin until 00:23. Overlap must
be computed from **[start, end]**, never from grant times — a queue that checked grant
times would report itself clean while two runs overlapped in fact. Legs are therefore
required to report start and end, not just "done."

## THE TWO SIGNALS

1. **A run materially slower than the same `target`'s previous run at a comparable SHA.**
   Not "slow" in the abstract — slower *than itself*. That is why `target` is recorded
   verbatim.
2. **Any two windows that overlap when the queue says they cannot.** This is the queue
   **self-checking**, and it is the closest thing to a positive control the queue can have.

## POSITIVE CONTROL — because a detector that has never fired is not known to work

A zero-overlap report from a detector that has never been shown to detect an overlap is
indistinguishable from a broken detector. Row `CTRL-1` below is a **deliberately seeded
overlapping pair**, marked `CONTROL`, retained permanently. The check must flag `CTRL-1`
on every run. **If a sweep reports zero overlaps AND does not name CTRL-1, the sweep is
broken and its zero means nothing.** Excluded from all real statistics.

---

## LOG

| id | leg | target | sha | grant | start | end | dur | notes |
|---|---|---|---|---|---|---|---|---|
| CTRL-1a | `__control__` | `synthetic` | — | — | 2026-07-29T00:00:00Z | 2026-07-29T00:00:30Z | 30s | **CONTROL — must be flagged as overlapping CTRL-1b** |
| CTRL-1b | `__control__` | `synthetic` | — | — | 2026-07-29T00:00:15Z | 2026-07-29T00:00:45Z | 30s | **CONTROL — must be flagged as overlapping CTRL-1a** |
| BASE-1 | `EM` | `make test` (sample 1) | `e6bda71` | — | 2026-07-28T23:45Z | 2026-07-28T23:45Z | ~2.4s uncached | baseline sample 1, pre-instrumentation, times approximate |
| BASE-2 | `EM` | `go test -count=1 ./...` (sample 2) | `e6bda71` | — | 2026-07-28T23:55Z | 2026-07-28T23:55Z | ~2.4s | baseline sample 2 |
| G-1 | `review-194-r11` | `go test ./internal/platform/github/ -run 'TestLabelWritePrice_IsMonotoneInThePredicate' -count=1` | `2cbbd92` | 2026-07-29T00:10Z | 2026-07-29T00:11:49Z | 2026-07-29T00:11:58Z | **9s** | C-1 re-reproduction (d). exit 1 = expected. Cold GOCACHE, first build in a fresh worktree. **9s vs ~15s reference = NOT-LOADED signal**, corroborating that nothing else ran in that window. Occupancy ~90s longer than execution (worktree add + cleanliness proof). |

| G-2 | `review-xss-r4` | `go test ./internal/server/ -run 'RemoteData\|Sanitize\|Import\|NoteDeclares\|URLBearing' -count=2` | `e6bda71` | 00:16Z | 00:17:02Z | 00:17:02Z | 00:18:32Z | 90s | exit 0. **90s wall, 0.133s execution, 29 of 30 lines `go: downloading`. COLD MODULE CACHE, NOT LOAD.** |
| G-3 | `review-xss-r4` | same package, `-run 'REVIEWXSSR4' -v -count=2` | `e6bda71` | 00:16Z | 00:19:23Z | 00:19:23Z | 00:19:26Z | 3s | exit 0. Warm. 5/5 pass ×2. 0 dirty cells. |
| G-4 | `audit-xss-r4` | `go test ./internal/server/ -run TestSanitizeAndImportAgreeAtEveryDepth -count=2` | `e6bda71`+probe | 00:24Z | 00:25:58Z | 00:26:09Z | 00:27:37Z | 88s | **exit 1 = RED, predicted.** Cold cache again — 29 downloads, 0.011s execution. Ran in `/var/tmp/scratch-audit-xss-r4/r1`, a `cp -a`; `/workspace` never touched. |
| G-5 | `audit-xss-r4` | `go test ./internal/server/ -run TestRemoteDataKeysWrittenByAdaptersAreClassified -v -count=2` | `e6bda71` clean | 00:24Z | 00:27:59Z | 00:27:59Z | 00:28:02Z | 3s | exit 0. Warm, 0 downloads. Cleanliness proven **before** start, not after. |
| G-6a | `test-xss-r4` | `cd web && npm test > _r0-web-suite-output.txt 2>&1` | `e6bda71` | 00:30Z | 00:33:09.987Z | 00:33:09.992Z→00:33:13.567Z | **3.575s** | exit 0 read from `$?` (redirect, not pipe). PASS 4 files / 380 assertions, split 9/204/157/10 — **identical to EM's 23:45Z and 23:55Z samples in a different clone.** |
| G-6b | `test-xss-r4` | `go build ./... > _r0-go-build-output.txt 2>&1` | `e6bda71` | 00:30Z | (same block) | 00:33:22.677Z→00:35:06.030Z | **103.4s** | exit 0. 55 lines, **all 55 `go: downloading`**, zero diagnostics. BUDGET, NOT SIGNAL — see normalisation below. Positive control on the zero: `go list ./...` = **32 packages**, so the build matched a real package set. Porcelain 0 before and after; 0 dirty cells. |
| G-7 | `test-xss-r4` | R1,R2,R6,R7,R8,R9,R10 — 7 mutation rows, `-count=1`, twice each | `e6bda71` | 00:36Z | 00:38:25Z | — | RUNNING | **Exclusive slot.** review-xss-r4 stopped running at 00:35Z; audit-xss-r4 reading only. Restores verified by `git diff e6bda71`, **not** by a green suite — R1/R2/R7/R8 are all predicted SURVIVORS. Predictions logged at 00:36Z, ahead of results. |

### THE COLD-CACHE CONFOUND — MEASURED TWICE, IN TWO CONTAINERS, AND IT NEARLY BECAME A BOX SIGNAL

`review-xss-r4` 90s→3s. `audit-xss-r4` 88s→3s. **In both cases ~99% of the first run's wall
clock was `go: downloading`, and test execution was 0.133s and 0.011s respectively.**

Each container has not only a cold `GOCACHE` but a cold **module** cache. A leg reporting its
first Go run honestly, against the reference table below, would report a 400× overshoot and
correctly escalate it as a box signal. **It would be wrong, and the queue would have chased a
phantom.** The reference durations below are all *warm*; they are not comparable to any leg's
first run.

**RULE: the first Go run in any container is ~90s of one-time module download and is NOT a
box signal. Compare a leg's run only against its OWN prior run of the same target.** Signal 1
already said "slower *than itself*" — this is why that wording was load-bearing rather than
stylistic, and it is the second time tonight a per-leg observer could not distinguish its own
condition from the box's.

**THIRD CONTAINER, 00:35Z — AND THE FIRST LEG TO BRING ITS OWN NORMALISATION.**
`test-xss-r4` measured 103.4s, materially worse than audit's 88s, and did **not** report it as a
box signal. Its reasoning, which is the correct one and which I would otherwise have had to do
myself:

> 55 downloading lines vs audit's 29. Per-line cost **1.88s (test) vs 3.03s (audit)**. My box-time
> per unit of work is LOWER than audit's, so if anything the box was quieter for me. The delta is
> **module count, not contention.**

**THE DISCRIMINATOR IS WALL CLOCK PER UNIT OF WORK, NOT WALL CLOCK.** A raw duration comparison
across containers with different module sets is not a load measurement at all. Add this to Signal
1: a run may only be compared against its own prior run of the same target, and where no prior run
exists, only against a per-unit rate.

### WHAT A GREEN ARTEFACT MAY AND MAY NOT BE LENT FOR — 00:35Z, RAISED BY THE PRODUCING LEG

I published G-6a to serve `audit-xss-r4`'s R3 as a cost saving: one run, two consumers.
`test-xss-r4` accepted, then drew a boundary I had not drawn, **against its own convenience**:

> **FINE** — consuming it as an OBSERVATION of what the tracer reports on a clean tree. That is
> stdout; the finding set at `e6bda71` is a fact about the code, not about who ran it.
> **NOT FINE** — citing it as a CONTROL, i.e. as evidence the tracer WORKS. A control drawn from
> the same run as its subject is not independent of it, and one green run of the instrument under
> review is not evidence the instrument functions.
> **"It is a GREEN run, so every count-neutral corruption in the tracer is invisible in it BY
> CONSTRUCTION. It shows what the tracer says when it has nothing to say. Reading a finding set
> out of it tells you which files the tracer REACHED, not whether it reached them for the right
> reason."**

**RULE, ADOPTED: an artefact may be shared as an OBSERVATION and never as a CONTROL. If a
consuming leg needs a positive control, it needs its own RED — a different run, not a different
reader of the same file.** Cost-sharing an observation and cost-sharing a control are different
transactions, and I blurred them twenty minutes after writing §V, which says exactly this.

### SCHEMA CHANGE, 00:15Z — `occupancy` ADDED, on the leg's own suggestion

`review-194-r11` pointed out a gap in the same direction as the grant-vs-start one, and it is
right: its 9 seconds is **execution only**. Between the grant and that start it spent ~90s on
`git worktree add` and the pre-run cleanliness proof — **which touches the disk and the git
object store even though it is not a build.** A `git worktree add` of this repo is not free.

**If the queue's purpose is detecting contention, the window that matters is OCCUPANCY, not
COMPILE.** Measuring only execution would have understated this grant's footprint by an order
of magnitude — 9s recorded against ~99s actually held. A queue that under-measures occupancy
will report headroom it does not have, which is precisely the slow-and-silent failure mode the
caps introduced.

New required field, effective now:

| field | meaning |
|---|---|
| `occupy` | when the leg began **ANY** filesystem or toolchain work under the grant |
| `start` | when the build/suite itself began executing |
| `end` | when it finished |

**Overlap is computed from `[occupy, end]`, not `[start, end]`.**

## PER-TARGET REFERENCE DURATIONS (uncached, EM baseline, unloaded box)

`cmd/farmtable-server` 0.009s · `internal/cli` 0.022s · `internal/decomposer` 0.009s ·
`internal/mcp` 0.010s · `platform/beads` 0.016s · `platform/github` 0.021s ·
`internal/server` 0.603s · `internal/serverapp` 0.031s · `internal/store` 0.778s ·
`internal/streaming` 0.910s · **whole suite ~2.4s uncached.**

**The expensive resource is COMPILATION, not test execution** — each container has its own
cold `GOCACHE`. A `platform/github` run reported at 15s is dominated by compile, so a
material slowdown there is a **box** signal, not a suite signal.

---

## LOG, CONTINUED — 00:36Z ONWARD

| id | leg | target | sha | grant | occupy | start | end | dur | notes |
|---|---|---|---|---|---|---|---|---|---|
| G-7 (close) | `test-xss-r4` | 7 mutation rows, `-count=1`, twice each | `e6bda71` | 00:36Z | 00:38:25Z | 00:38:25Z | **UNRECORDED** | **UNRECORDED** | **CLOSED, 0 RETRACTIONS.** Restores verified by `git diff e6bda71` = 0. I DID NOT COLLECT end/dur AND AM NOT RECONSTRUCTING THEM. |
| G-8 | `audit-xss-r4` | — | — | — | — | — | — | — | **NO SUCH GRANT WAS ISSUED.** Retained as a row so the gap in the id sequence is not read as a lost record. |
| G-9 | `test-xss-r4` | apparatus self-audit, read-only | `e6bda71` | ~00:52Z | — | — | 01:02Z | n/a | **NO BUILD, NO SUITE.** Zero toolchain. Closed 0 retractions, unestablished nulls 0. |
| G-9b | `test-xss-r4` | 4 mutant rows re-run, exit codes only | `e6bda71` | ~01:00Z | — | — | 01:06Z | **UNRECORDED** | 4 rows, 4 pre-declared predictions, 4 correct. **EXIT CODES VALID, INTERPRETATION NON-INDEPENDENT** — see contamination note below. |
| G-10 | `test-xss-r4` | mutant construction under a withheld mechanism | `e6bda71` | ~00:55Z | — | — | — | — | **GRANT DESIGN DEFECTIVE. SEE BELOW. THIS ROW IS THE INCIDENT.** |

### ⛔ G-10 IS A GRANT I DESIGNED WRONG, AND THE LEG PAID FOR IT

I asked `test-xss-r4` to build mutants against a mechanism I deliberately withheld (review's C7), to
keep it uncontaminated. It could not build them without the definitions, so it did the only thing
available: `grep -rn "P2cn\|P11 " reports/ .design/`. That returned **12 lines from review's report
and 6 from audit's, including review's verdicts, its qualifiers, and the exact C7 mechanism I was
withholding.** In its words: *"THAT IS NOT HEADINGS. THAT IS THE REASONING."*

> **WITHHOLDING INFORMATION FROM A LEG WHILE ASKING IT TO ACT ON THAT INFORMATION DOES NOT PRODUCE
> IGNORANCE. IT PRODUCES A SEARCH, AND THE SEARCH IS UNBOUNDED.** A grant that withholds context must
> carry everything needed to execute without it, **or it is not a withholding, IT IS A SCAVENGER HUNT.**

This is also the origin of **ROUTE 6**, which is mine and not the platform's: `reports/` is a flat
directory holding every leg's conclusions, a recursive grep over it is not a `Read` and trips no
disclosure, and `grep -n` returns **body lines, not filenames**. I built that directory.

Remedy, adopted as the leg proposed it against its own interest: **G-9b's EXIT CODES ARE VALID**
(mechanical, and cannot be biased by having read an argument); **ITS INTERPRETATION IS
NON-INDEPENDENT** and is recorded that way permanently.

### AND A GRANT I CALLED A CONTROL THAT WAS ENTAILED

The P2cn row. `test-xss-r4` established that P2cn is an **EQUIVALENT MUTANT** — unkillable by any
suite — so its landing-verified GREEN was **a mathematical necessity, not a measurement.**
**Taxonomy form (1), committed by the person broadcasting the taxonomy, inside a grant justified as
a control.** No mutator can settle P2cn; the review prediction it was meant to test HELD, but the
P2cn half was **unfalsifiable by construction** and must never be cited as evidence.

### THE HOLD, 01:0xZ ONWARD

All six legs are read-only and **HELD**: no builds, no suites, project-wide. The queue is empty by
policy, not by chance. Withdrawals accepted this hour, **all filed by the legs against themselves**:

| leg | withdrawn | why |
|---|---|---|
| `audit-194-r11` | S2, S5 | **vacuous** — S2's `-run` names a probe that no longer exists *because the restore rule required deleting it*; S5 matches 0 of 206 tests |
| `audit-194-r11` | the C-1 run | a **control on a derivation**, filed as a promotion |
| `review-194-r11` | Run 4 | same — "converts §4A from SUSPECTED to MEASURED", but §4A is a source derivation |
| `test-194-r11` | R0, R1-as-promotion | same; R1 **re-filed** as a control on its own apparatus, which is legitimate |

> **A RUN CANNOT MAKE A DERIVATION MORE TRUE; IT CAN ONLY CONTROL THE DERIVATION.** Four withdrawals
> in one hour, none of which I asked for individually.

**AND THE COUNTERPART, WHICH IS THE MORE USEFUL HALF:** the runs that survived this filter are the
ones aimed at **apparatus facts no derivation can reach** — what a *past invocation actually
executed* (`test-194-r11`'s `-v` PASS-line count), and whether the round-10 defect was **real at
6d8f19e** (the `bc93200` detached-worktree reproduction). That second one is currently the
**best-justified queued item in the project** and it is still held.

### THE FIRST HAZARD IN THIS FILE THAT THE QUEUE ITSELF CREATED

**A ZSH GLOB ABORT KILLS EVERY CHECK BATCHED BEHIND `&&`.** `test-xss-r4` lost two queued checks that
way and never saw them fail.

> **ON A ONE-SLOT POLICY THAT FORCES BATCHING, THE COST OF THIS BUG SCALES WITH HOW WELL A LEG
> COMPLIED WITH THE POLICY.**

The serialization policy is not withdrawn — the resource constraint is real and measured. But the
policy has a **measured side effect on measurement quality**, and that belongs in this file rather
than in a leg's report, because no per-leg observer can see it. Mitigation, mandatory: `;` not `&&`,
and **a sentinel at the end of every batch that is actually read** — `test-xss-r4` had written one
and did not look at it. *"A CONTROL YOU DO NOT LOOK AT IS DECORATION."*

---

## G-11 — test-194-r11, R5 bc93200 differential (THE SINGLE-TOKEN GRANT)

| field | value |
|---|---|
| holder | `test-194-r11` |
| grant | R5 only, one run, serialised, token returned before anything else compiles |
| occupy | 01:27:14Z (EM clock; leg read 01:27:15Z — **EM clock is authoritative, stated at grant**) |
| start | 01:27:27Z |
| end | 01:28:24Z |
| **run wall time** | **10s** |
| queue depth at grant | 6 legs, 1 token |
| retractions | 0 |
| restore | 5 channels, 0 cells dirty (incl. `git worktree list` = main only) |

**PRECONDITION DISCHARGED MORE STRONGLY THAN I WROTE IT.** I asked for a zero-line diff across the
npm test lists. The leg returned a **blob content hash identical on both arms** —
`e49c3ede5c16fe7c239e480069580be54c66a8bc` at both `bc93200` and `2cbbd92` for the seam pin test.
Rule extracted and adopted: **BEFORE RUNNING A DIFFERENTIAL, PROVE THE INSTRUMENT IS THE SAME OBJECT
ON BOTH ARMS, BY CONTENT HASH, NOT BY INSPECTION.**

### THE COLD-CACHE FIGURE WAS WRONG AND IS WITHDRAWN

I have been budgeting **~90s** for the first Go run in any container and warning legs about it. The
measured figure here is **10s**. Mechanism: **the Go build cache is CONTENT-keyed, not
directory-keyed, so a detached worktree of an already-built tree inherits the entire cache.**

The warning still cost nothing and its absence would have cost a false abort, so issuing it was
right. But **~90s must not be carried into the next round's slot sizing as a measured figure.** It
was measured on a *cold container*, and I generalised it to *a new directory* — a point-in-time
measurement restated as a standing property. **Fifth instance of that error class by me** (see #184).
Corrected in the xss-r4 fix brief before dispatch.

### RESULT (recorded here because the queue log is where grant VALUE is judged, not just grant cost)

12 run / 8 pass / 4 fail; all three failures at the *price* assertion, `BASELINE BROKEN` count = 0.
**The round-10 Critical is MEASURED against genuinely broken production code, not against a mutation
the leg chose.** 10 seconds of token time retired a self-certifying claim that had survived a full
round of review. **This is the strongest argument in the log for the queue existing at all: the
scarce resource was spent on the one item that could not be settled by reading.**

Counter-entry, in the same grant: the leg **self-demoted F10** from Required-candidate to Suggested,
because the reproduction falsified F10's own unstated premise. **A grant that weakens the grantee's
own report is the grant most worth having made.**

### ONE GAP THE LEG DECLINED TO CLOSE, AND DECLINED CORRECTLY

`bc93200` reverts the whole github package; the leg's M2 mutated `currentLifecycleStages` alone, a
strict subset. Whether the seam pin fires under **M2 alone** — the realistic future-refactor shape —
is **DERIVED, NOT MEASURED.** The leg did not run it: *"I will not exceed a grant to strengthen my
own report."* ~10s in the same shape. **Queued, not granted.**

---

## TOKEN LEDGER

- **FREE since 01:28:24Z.**
- Next holder: **`dev-xss-r5`** (xss-r4 fix leg) — coordinator ruling, xss-r4 is the older round and
  all three legs have filed REQUEST CHANGES.
- Then: the sanitizer fix.
- **Token returns to me between holders. Nothing compiles in the gap.**
2026-07-29T02:19:08Z | TOKEN -> dev-xss-r5 (scanner re-spec, spec amended §6 pre-compile)

---

2026-07-29T03:2xZ | dev-xss-r5 | **CLASS (b), NO TOKEN, LOGGED BEFORE RUNNING** per PART 6 §6.1(c).

**Commands to be run** (exactly these, nothing else; no `npm test`, no `go build`, no `./...`):

```
go test ./internal/server/ -count=1 -v -run '<named alternation of the pins for this branch>'
```

**Classification argument, since §6.1(d) says an unclear command is (a).** One package, not
`./...`; `-run` names the tests; the package is `internal/server`, which is where all six changed
files live (`git diff --name-only e6bda71..HEAD` — zero files outside it, zero under `web/`). It
compiles one package, not the whole module. **If the EM reads this as (a), say so and I will stop
— the run is not urgent enough to be worth guessing on.**

**Anti-vacuity for the Go side, which has the same silent-drop hazard the JS runner does.**
`go test -run` with a regex matching nothing prints `ok` at exit 0. So the run is `-v` and the
result reported is the **`--- PASS:` line count per named test**, checked against the number of
tests requested. Exit code is not the evidence and is not being reported as such.

**Web suites: not applicable to this branch, and stated rather than assumed.** `safe-url` and
`url-binding-scan` are named as at-risk under one of the live merge resolutions. This branch
changes **zero** files under `web/` (measured above), so those suites are not this fix's pins.
No web run is requested or performed.

**OUTCOME, appended after the run. 2026-07-29T03:27Z | dev-xss-r5 | class (b).**

Command actually run, verbatim:

```
go test ./internal/server/ -count=1 -v -run '^(TestRemoteDataAssignmentSeesEveryShape|TestRemoteDataFuncIdentSeparatesMethodsFromFunctions|TestScannedServerPackageRemoteDataWriteSitesSanitize|TestRemoteDataKeyClassification|TestRemoteDataKeysWrittenByAdaptersAreClassified|TestMapStringStringStaysUnrepresentable_GuardsO1|TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident|TestSanitizeAndImportAgreeAtEveryDepth)$'
```

Observed: 8 tests named, **8 top-level `--- PASS:` lines**, 0 `--- FAIL:` lines, 84 indented
subtest PASS lines. Anti-vacuity satisfied: requested count == observed count, so the
silent-drop mode (`-run` matching nothing, `ok` at exit 0) did not occur. Exit code observed but
deliberately not reported as the evidence. Per-test breakdown is in the message to the EM.

One defect in my own measurement, found and fixed before reporting: the first `awk` I used to
attribute subtests to parents keyed on `=== RUN` lines, which include subtest RUN lines, so it
labelled three rows with subtest names. Corrected by keying on the `--- PASS:` name field and
truncating at the first `/`. Totals were unaffected (84 either way); the labels were wrong.

---

## 2026-07-29 | dev-scopedeny-93 | REQUESTED BEFORE RUNNING

**Command to be run, verbatim, one package, no `./...`:**

```
go test ./internal/server/ -count=1
```

**Why the whole package and not a `-run` selection.** This run's purpose is to compare against a
baseline that was itself a whole-package run: at commit `160e211` this package reported
**12 failures in 0.817s, deterministic**. A `-run` subset cannot show that the count went to
zero — it can only show that the tests I remembered to name pass, which is the same enumeration
error that produced the 12 in the first place. The measurement I need is the *complement* of my
own list, so the selection has to be the package.

**Class.** Single package. Does not resolve `./...`, so it does not reach `internal/assets` and
the `web/dist` embed failure (§6.4) is not in scope for this command. Compilation of one package
only. If the EM reads a whole-package run as class (a) rather than (b), **say so and I will stop**
— I will fall back to a named `-run` alternation and accept the weaker claim.

**Anti-vacuity.** Not applicable in the `-run`-matches-nothing sense, since there is no `-run`
filter to silently match zero tests. The evidence reported will be the **`FAIL`/`ok` line and the
failure count**, compared against the 12-failure baseline. Exit code is expected to be non-zero if
anything fails and is not by itself the evidence.

**Known flake in range.** `TestWatchTasks_*` flakes at ~4.5% (EM, 03:22:31Z). If one fails, I will
re-run **that test alone** before reporting anything about it, and will not report a flake as a
regression.

**OUTCOME: appended below after the run.**

**ADDENDUM, requested before running — third command.** The package run tells me the failure
count went to zero, but "nothing failed" is not the same evidence as "the tests I changed ran and
passed", and a `-run` typo or a rename would show up as the former. Naming them explicitly with
anti-vacuity counting:

```
go test ./internal/server/ -count=1 -v -run '^(TestWhoAmI|TestClaimTask_PropagatesUserID|TestAddComment_PropagatesUserID|TestListUsers|TestGetUser|TestUpdateTask_PropagatesActorID|TestAuthInterceptor_ValidTokenAccessesNonExemptRPC|TestAuthInterceptor_RecordUsageHasDeadline|TestIdentity_WatchTasksAcceptsValidAuth|TestCreateAPIToken_NoScopes|TestRequireScope_NilScopesDenied|TestRequireScope_EmptyScopesDenied|TestScopedToken_ExistingTokenNilScopesDenied|TestScopedToken_LegacyNilScopesLoseLifecycleAccess|TestScopedToken_WildcardAllowsEverything)$'
```

15 tests named; the evidence is **15 top-level `--- PASS:` lines**, not the exit code.

**ADDENDUM 2, requested before running — fourth command.** I have changed four files in
`internal/cli` (`token.go`, `connect.go`, `dashboard.go`, `user.go`) and have **zero compile
evidence for any of them**, because `internal/cli` reports `[setup failed]` under the `web/dist`
embed (§6.4). Attempting a single-package build to find out whether that is the *only* thing
wrong with it:

```
go build ./internal/cli/
```

Per §6.4 the evidence is **the error text, not the exit code** — this command is expected to exit
non-zero either way. What I am reading for is whether the error set is exactly the `web/dist`
embed or whether it also contains a type error of mine.

### OUTCOME — 2026-07-29T03:41Z | dev-scopedeny-93

**Command 1** `go test ./internal/server/ -count=1` — run twice on the finished repair.
Deterministic failures **12 → 0**. Both runs' only failure was a `TestWatchTasks_*`, and it was a
**different one each time** (`ClaimEvent`, then `Heartbeat`) on code that only became more correct
in between. That is the signature of the known flake, not a regression.

**Command 2, the flake re-run, as pre-committed** — each alone, `-count=5`:
`TestWatchTasks_Heartbeat` **5/5 PASS**, `TestWatchTasks_ClaimEvent` **5/5 PASS**. Requested 5,
observed 5 `--- PASS:` lines each, so anti-vacuity holds. Neither is reported as a regression.

**Command 3, the 15 named tests** — **15 requested, 15 `--- PASS:`, 0 `--- FAIL:`.** Requested
count == observed count, so the `-run`-matches-nothing silent-drop did not occur. This includes
the mandatory over-denial control: `TestScopedToken_WildcardAllowsEverything`, `TestGetUser`,
`TestListUsers` and `TestClaimTask_PropagatesUserID` are all legitimate callers that still succeed.

**Command 4** `go build ./internal/cli/` — **exit 1, sole error
`assets.go:5:12: pattern all:web/dist: no matching files found`.** Reading the text and not the
code (§6.4): the embed aborts loading of `internal/assets`, which `internal/cli` imports, so
`internal/cli` is **never type-checked at all**. This is not a clean result — it is *no* result.
**Four changed files in `internal/cli` have zero compile evidence** and that goes in the report's
NOT REACHED section, not in its results. No `web/dist` workaround was attempted, per the
coordinator. Partial substitutes actually performed, which are weaker and are not a replacement:
`gofmt -e` parses all four clean (PRE=0 POST=0 against the 633f8f2 pre-image), and each changed
call was checked by hand against its callee's real signature — `exitError(int, string, string)`,
`DefaultScopesForUserType(string) ([]string, error)`, `ValidateUserType(string) error`,
`KnownUserTypes() []string`. Imports verified present; `user.go` is the only file where the
`internal/server` import is new, and `internal/server` imports `internal/cli` **zero** times, so
no cycle. **Syntax and signatures are not a type-check and I am not claiming they are.**

**ADDENDUM 3, requested before running — fifth command. THE `internal/cli` TYPE-CHECK.**

The coordinator relayed two claims as DERIVED and told me to verify rather than trust them.
**Verified, all three, before creating anything:**

- `//go:embed all:web/dist` lives at **`./assets.go` (repo ROOT)**, not `internal/assets/assets.go`
  as I had written in earlier notes. The embed pattern therefore resolves relative to the repo
  root. My earlier citation was wrong; the build error prints a bare filename and I inferred a
  path from it. Corrected here.
- `web/` exists (`README.md`, `index.html`, `package.json`, `src/`, `public/`, `scripts/`);
  **`web/dist` does not.** The embed fails on an absent directory, not on bad contents.
- `.gitignore:17` is `dist/`; `git ls-files web/dist` returns **0**; `git check-ignore -v`
  confirms `.gitignore:17:dist/` matches `web/dist/PROBE.txt`. The placeholder cannot enter a
  commit even by accident. (Probe directory removed immediately after the check.)

```
go build ./internal/cli/          # with a single placeholder file under web/dist
```

**THE BOUND, STATED BEFORE THE RESULT SO IT CANNOT BE ATTACHED AFTERWARDS.** A placeholder
proves the package **TYPE-CHECKS**. It proves **NOTHING** about the shipped binary, which under
this placeholder would embed an empty asset tree. **This is being run as a type-check and will be
reported in those words.** A green build over a fake asset directory reported as "the build
passes" is precisely tonight's recurring pattern — an artefact that looks like a result. It is
not a build result and I will not report it as one. Placeholder is in my worktree only; not
canonical, not verify195.

**ADDENDUM 4, requested before running — sixth command.** The type-check came back **exit 0**,
which means `internal/cli`'s *tests* can now compile too — they were `[setup failed]` for the
same reason, not for a reason of their own. Running them:

```
go test ./internal/cli/ -count=1
```

Same bound as addendum 3: this exercises CLI *logic* over an empty embedded asset tree. Any test
that asserts on served dashboard assets would be measuring the placeholder, not the product. I
will read the failure text for that possibility rather than assuming a green means the CLI is
sound. Still one package, not `./...`.

### OUTCOME — addenda 3 & 4 | dev-scopedeny-93

**`go build ./internal/cli/` with placeholder → exit 0.** The package type-checks. All four
changed files compile.

**`go test ./internal/cli/ -count=1` → `ok`, 0.015s.** `ok` at 0.015s is *also* what a package
with zero tests prints, so this was re-run with `-v` and the passes counted: **13 `--- PASS:`,
0 `--- FAIL:`.** `TestMergeScopes` and `TestEnsureLocalUserStoresConfiguredToken` additionally
run by name — both PASS. Not vacuous.

**REPORTED AS A TYPE-CHECK, NOT A BUILD.** A binary over that placeholder embeds an empty asset
tree. Nothing here supports a shipped-binary claim.

**Placeholder containment, verified after the fact:** `git status --short` is **empty** — zero
tracked changes and git does not see the placeholder at all. Canonical `/workspace/farmtable`
still `633f8f2`, zero tracked modifications.

**INCIDENTAL FINDING FOR WHOEVER OWNS THE `web/dist` EDGE.** Canonical `/workspace/farmtable`
**has** a populated `web/dist` (`favicon.svg`, `index.html`, `assets/`, `shoelace/`) dated
**Jul 27 16:54** — untracked, gitignored, left by an earlier npm build. So **`go build ./...`
succeeds in canonical and fails in every fresh clone, and the difference is an untracked
directory that `git status` cannot show you.** That is the same defect `ci-22-setup` measured on
a cold runner, found from the opposite side. I did **not** copy canonical's real `dist` into my
clone: depending on another agent's two-day-old local state would make the run unreproducible and
would make the green mean less, not more.

---

2026-07-29T04:3xZ | dev-xss-r5 | **CLASS (b), NO TOKEN, LOGGED BEFORE RUNNING** per PART 6 §6.1(c).
Ledger #226 (second structpb carrier). EM ruling 04:34Z: "THE BUILD TOKEN IS NOT YOURS AND I AM
NOT ISSUING IT. Nothing here needs go build ./... ." Agreed — nothing here does.

`ROOT=/workspace/farmtable-dev-xss-r5  DIST=PRESENT-REAL  DIST-PROVENANCE=` see below.

**DIST field, stated even though this run cannot touch it.** `web/dist` exists in my root: 4109
files, hashed bundle `assets/index-CGjn0ICC.js` plus a `.map`, i.e. a real Vite build and not a
placeholder. It is gitignored (`.gitignore:17`). **Provenance, marked honestly:** mtime 02:23,
and I ran `make test` at approximately 02:23Z under the pre-03:12Z fence, so I believe I built
it myself in this root. `[DERIVED from mtime + my own run log, NOT independently verified]` —
I did not observe the build command's output attributing the directory. At 01:49:20Z this root
had NO `web/dist`, which is consistent.
**This run is Go-only and reads nothing under `web/`, so DIST cannot influence its result.**
Recording it anyway because the rule says a green with no ROOT is the worse case, not the
smaller one.

**Command to be run** (exactly this):
```
go test ./internal/server/ -count=1 -v -run '^TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident$'
```
One package, one named test, no `./...`, no build, no npm.

**Anti-vacuity.** `-run` matching nothing prints `ok` at exit 0, so the evidence is the
`--- PASS:`/`--- FAIL:` line for the named test, not the exit code. 1 test requested, 1 top-level
result line expected.

**Mutation plan, because a new assertion that has never failed is not a pin.** The two new
carrier assertions will each be inverted (`err == nil` -> `err != nil`) and re-run, and each must
go RED. An assertion that has only ever been observed agreeing has been observed agreeing, not
firing.

2026-07-29T04:4xZ | dev-xss-r5 | **CLASS (b), NO TOKEN, LOGGED BEFORE RUNNING.** Ledger #227
(metadata reason string) + regression check over the full pin set after #226 and #227.

`ROOT=/workspace/farmtable-dev-xss-r5  DIST=PRESENT-REAL  DIST-PROVENANCE=` as in the 04:3xZ
entry above (4109 files, hashed bundle + sourcemap, gitignored, believed self-built at 02:23Z,
`[DERIVED from mtime, not independently verified]`). **Go-only run; reads nothing under `web/`.**

**Command to be run** (exactly this — the same 8-way alternation used at 03:27Z, so the two runs
are comparable):
```
go test ./internal/server/ -count=1 -v -run '^(TestRemoteDataAssignmentSeesEveryShape|TestRemoteDataFuncIdentSeparatesMethodsFromFunctions|TestScannedServerPackageRemoteDataWriteSitesSanitize|TestRemoteDataKeyClassification|TestRemoteDataKeysWrittenByAdaptersAreClassified|TestMapStringStringStaysUnrepresentable_GuardsO1|TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident|TestSanitizeAndImportAgreeAtEveryDepth)$'
```
**Anti-vacuity:** 8 requested; evidence is 8 top-level result lines and the subtest census, not
the exit code. Baseline to compare against is the 03:27Z run: 8 PASS / 0 FAIL / 84 subtests.
#227 edits a reason STRING inside the exemption map, which
`TestRemoteDataKeysWrittenByAdaptersAreClassified` logs — so its logged line count must stay 29
top-level + 1 nested line, and any change there is a real signal, not noise.

---

## 2026-07-29 — dev-xss-r5 — LEDGER #228 (Path 12 pin), PRE-RUN

`ROOT=/workspace/farmtable-dev-xss-r5`
`DIST=PRESENT-PLACEHOLDER`
`DIST-PROVENANCE=ls -la web/dist -> assets/ + favicon.svg (168 bytes), no index.html; dated 02:23,
predating this worktree's edits. NOT rebuilt by me and NOT verified as a real product of a vite
build. Per the standing rule, a green under this DIST is a type-check, not a build. Irrelevant
here in any case: this is a Go-only run that reads nothing under web/.`

**Category:** (b) selective — a single named test in the one package I edited
(`internal/server/graph_routing_test.go`). NOT `go test ./...`, NOT `make test`, NOT a whole-module
compile. THE BUILD TOKEN REMAINS UNSPENT AND IS NOT REQUESTED.

**Command to be run:**
```
go test ./internal/server/ -count=1 -v -run '^TestEphemeralGraphRouteDropsRemoteData$'
```

**Anti-vacuity:** 1 test requested; the evidence is exactly 1 `--- PASS:` line naming
`TestEphemeralGraphRouteDropsRemoteData`, never the exit code. A non-matching `-run` regex prints
`ok` at exit 0, so a zero-line result is a FAILED run, not a green one.

**Also to be run (mutation proof):** the same command with `taskToCreateParams` in
`graph_routing.go` temporarily assigning `RemoteData: t.RemoteData`, which must produce
`--- FAIL:` for the same test. The production file is then restored and `git diff --stat` must
report it unchanged (byte-identical).

### 2026-07-29 — dev-xss-r5 — #228 REGRESSION CHECK, PRE-RUN (same ROOT/DIST as above)

`ROOT=/workspace/farmtable-dev-xss-r5`  `DIST=PRESENT-PLACEHOLDER`  `DIST-PROVENANCE=unchanged
since the entry above; not rebuilt; Go-only run reads nothing under web/.`

**Why this run is NOT optional despite #228 being a test-only change.** My new test contains the
literal assignments `withRemote.RemoteData = src.RemoteData` and a `RemoteData:` composite-literal
key, in a file inside `package server`. `TestRemoteDataAssignmentSeesEveryShape`,
`TestScannedServerPackageRemoteDataWriteSitesSanitize` and
`TestRemoteDataFuncIdentSeparatesMethodsFromFunctions` are AST walks over the server package's
source. IF THEY WALK `_test.go` FILES, MY PIN IS ITSELF A NEW WRITE SITE AND THE FAIL-CLOSED
REGISTRY SHOULD REJECT IT. That is a designed-in outcome of H-1, not a surprise, and I would
rather discover it here than have a reviewer discover it.

**Command:** the identical 8-way alternation used at 03:27Z and after #227, so all three runs are
comparable:
```
go test ./internal/server/ -count=1 -v -run '^(TestRemoteDataAssignmentSeesEveryShape|TestRemoteDataFuncIdentSeparatesMethodsFromFunctions|TestScannedServerPackageRemoteDataWriteSitesSanitize|TestRemoteDataKeyClassification|TestRemoteDataKeysWrittenByAdaptersAreClassified|TestMapStringStringStaysUnrepresentable_GuardsO1|TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident|TestSanitizeAndImportAgreeAtEveryDepth)$'
```
**Anti-vacuity:** 8 requested; evidence is 8 top-level result lines and the subtest census against
the baseline 8 PASS / 0 FAIL / 84 subtests. Not the exit code.

**POST-RUN #228.**
- Pin: 1 requested, `--- PASS: TestEphemeralGraphRouteDropsRemoteData` x1. GREEN.
- Mutant A (prod `taskToCreateParams` assigns `RemoteData: t.RemoteData`): `--- FAIL:` on the
  property assertion. Prod file restored; `md5sum -c` OK and `git diff --stat` empty.
- Mutant B (fixture's `RemoteData` literal deleted): `--- FAIL:` on the vacuity guard.
- Mutant C (`withRemote.RemoteData = src.RemoteData` deleted): `--- FAIL:` on control 2.
  Test file restored; `md5sum -c` OK.
- Regression 8-way: 8 PASS / 0 FAIL / 84 subtests. Per-parent census 15 / 6 / 63, identical to the
  03:27Z baseline and to the post-#227 run.
- WHY THE AST WALKS DID NOT SEE MY NEW `RemoteData` ASSIGNMENTS, measured rather than assumed:
  `remotedata_depth_test.go:1166` skips any entry whose name ends `_test.go`. The scanners never
  read my file. Green here means "not scanned", NOT "scanned and classified" — recorded so nobody
  later reads this row as evidence the registry covers test sources.

---

## OP-1(b) SINGLE-PACKAGE RUNS — leg `test` (xss-r5-test), filed BEFORE execution

| field | value |
|---|---|
| leg | `xss-r5-test` (test review leg, R5 three-way) |
| ROOT | `/workspace/farmtable-xss-r5-test` |
| DIST | **ABSENT** |
| DIST-PROVENANCE | fresh `git clone --no-hardlinks` of `/workspace/farmtable-dev-xss-r5` at 05:0xZ. `git clone` does not copy untracked/gitignored paths, so `web/dist` is **not** inherited. `assets.go` (`//go:embed all:web/dist`) is in the **root** package, which `internal/server` does not import, so single-package runs here are unaffected. **No `go build ./...` will be attempted from this root — it would fail, correctly.** |
| SHA | `d305391ee6dc473f5e7bf202167221e15cf52e10` |
| token | NOT HELD, NOT REQUESTED. Every command below is `go test ./internal/<pkg>/ -run '^(...)$' -count=1`. |

**Purpose: mutation testing. Every mutation is restored and the restore verified by `md5sum -c`
against `/tmp/xss-r5-test-baseline.md5`, taken before the first mutation.**

| # | command (all `-count=1`) | mutation | PRE-REGISTERED PREDICTION |
|---|---|---|---|
| T-R1 | `go test ./internal/server/ -run '^(TestEphemeralGraphRouteDropsRemoteData\|TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident\|TestMapStringStringStaysUnrepresentable_GuardsO1\|TestScannedServerPackageRemoteDataWriteSitesSanitize\|TestRemoteDataAssignmentSeesEveryShape\|TestRemoteDataWriteIsSanitized\|TestRemoteDataFuncIdentSeparatesMethodsFromFunctions\|TestRemoteDataKeyClassification\|TestRemoteDataKeysWrittenByAdaptersAreClassified\|TestSanitizeAndImportAgreeAtEveryDepth)$' -v` | none — BASELINE | 10 PASS. Establishes my own baseline; I do **not** inherit anyone else's green. |
| T-R2 | same alternation | **M1**: delete `"labels": issueLabels(issue),` from `internal/platform/github/graphql_queries.go` | **SURVIVES (green).** The carrier pin uses hand-written literals and never calls the builder. |
| T-R3 | same alternation | **M2**: delete the `log.Printf` from `structOrNilLoggingErr` in `convert.go` | **SURVIVES (green).** No test in `internal/` captures log output. |
| T-R4 | `-run '^TestRemoteDataAssignmentSeesEveryShape$'` | **M3**: delete one `* `-starred row | **SURVIVES.** 6 starred rows against a floor of 5 = one unit of slack. |
| T-R5 | `-run '^TestRemoteDataAssignmentSeesEveryShape$'` | **M4**: count-neutral — replace a starred row's body with a duplicate of another | **SURVIVES.** Floor is count-shaped. |
| T-R6 | `-run '^TestEphemeralGraphRouteDropsRemoteData$'` | **M5 POSITIVE CONTROL**: `taskToCreateParams` assigns `RemoteData: t.RemoteData` | **DIES (red).** If this survives, my instrument is broken and T-R2..T-R5 mean nothing. |
| T-R7 | T-R1 alternation | none — RESTORE VERIFICATION | 10 PASS, identical to T-R1, `md5sum -c` clean, `git diff --stat` empty. |

**Anti-vacuity for this block:** T-R6 is a mutant I could actually have failed to kill. A block of
all-surviving mutants is indistinguishable from a block where I never actually ran anything.

**ADDENDUM, leg `xss-r5-test`, filed before execution.** ROOT=`/workspace/farmtable-xss-r5-test`
DIST=ABSENT DIST-PROVENANCE=fresh clone, never built.
T-R2b: `go test ./internal/platform/github/ -run '^(TestIssueBuildRemoteData|TestPassthrough.*)$' -count=1`
with **M1 still applied**. Purpose: M1 survived `internal/server`; before I report the carrier as
unpinned **tree-wide** I must check the package that OWNS the builder, or my absence claim is
bounded by a search space I never stated. PREDICTION: survives there too (grep found no test that
calls `issueBuildRemoteData` anywhere).
T-R2c: `go test ./internal/platform/github/ -run '.' -count=1` with **M1 still applied**. Still one
package, still `-count=1`. T-R2b returned "no tests to run", which is not the same as "no test
catches it" — the filter was my own guess at a name. This removes the filter so the absence claim is
bounded by THE PACKAGE and not by my naming intuition. PREDICTION: survives (green).

---

## LEG: `xss-r5-review` (code review leg, R5 three-way)

| field | value |
|---|---|
| leg | `xss-r5-review` |
| ROOT | `/workspace/farmtable-xss-r5-review` |
| DIST | **ABSENT** (`ls -d web/dist` -> No such file or directory). [MEASURED] |
| DIST-PROVENANCE | `git clone --no-checkout --local /workspace/farmtable then git checkout d305391...`. A clone copies tracked content only, so the gitignored `web/dist` is not inherited. `assets.go` (`//go:embed all:web/dist`) is in the ROOT package; `internal/server` does not import it, so single-package runs in `internal/server` are unaffected. **I will not attempt `go build ./...` from this root.** |
| SHA | `d305391ee6dc473f5e7bf202167221e15cf52e10` (`git rev-parse HEAD`, detached) |
| token | NOT HELD, NOT REQUESTED at time of writing. All commands below are single-package `go test ./internal/server/ -run '^...$' -count=1`. |

**Purpose: falsification of four pre-registered hypotheses.** All four live in ONE
added file, `internal/server/zz_reviewer_probe_test.go`, which is NOT part of the tree.
It is deleted after the run and the deletion verified with `git status --short` (expected:
empty) and `git rev-parse HEAD` (expected: unchanged).

**No production file is touched. No mutation is performed. There is nothing to restore.**

| # | command (all `-count=1`) | hypothesis | PRE-REGISTERED PREDICTION / REFUTER |
|---|---|---|---|
| RV-1 | `go test ./internal/server/ -run '^TestProbeH1DepthAccountingParity$' -count=1 -v` | **H1** `sanitizeRemoteData` charges 2 depth units per `[]map[string]any` hop, `validateRemoteDataValue` charges 1, so near `maxRemoteDataDepth` the two disagree. | PREDICT: at some chain length the `[]map[string]any` row shows `dropped=true errored=false`. **REFUTER: `dropped == errored` at every length 1..40 for all three hop shapes.** If refuted I report the negative result and withdraw the depth half of the finding. |
| RV-2 | `go test ./internal/server/ -run '^TestProbeH1bAgreementSweepMaxDepth$' -count=1 -v` | **H1b** the shipped `TestSanitizeAndImportAgreeAtEveryDepth` never reaches the depth bound, so its name overclaims. | PREDICT: deepest shipped fixture is depth 3 against `maxRemoteDataDepth`=32. REFUTER: any fixture at depth >= 32. |
| RV-3 | `go test ./internal/server/ -run '^TestProbeH2RawMessageRoundTrip$' -count=1 -v` | **H2/H3** measures the step the shipped `metadata` reason marks `[REASONED, NOT MEASURED]` (a `json.RawMessage` in a `field.TypeJSON` column decodes back to generic types), and the `collectionToProto` claim that `Create().Save()` returns the ORIGINAL in-memory map. | PREDICT H2: read-back type is `map[string]any`. REFUTER: `[]byte`/`string`/`json.RawMessage`. PREDICT H3: created entity still holds `json.RawMessage` + `[]string` and is NOT representable. REFUTER: created entity is representable. |
| RV-4 | `go test ./internal/server/ -run '^TestProbeH4StructpbErrorText$' -count=1 -v` | **H4** the new `log.Printf` in `structOrNilLoggingErr` echoes a `structpb` error that may contain attacker-influenced key or value text (log-injection / disclosure surface). | PREDICT: the error names the offending KEY and the Go TYPE but not the value. REFUTER: the error text contains the payload string. |

**Anti-vacuity for this block:** RV-1's `map hop` row is a control I could actually have
failed -- if the instrument were broken it would show `dropped != errored` on the plain-map
chain too, where I claim no divergence exists.
T-R8 / T-R9, leg `xss-r5-test`, filed before execution. ROOT=`/workspace/farmtable-xss-r5-test`
DIST=ABSENT DIST-PROVENANCE=fresh clone, never built.
Two ADDITIONAL positive controls beyond the T-R6 one. Four of my five mutants so far survived, and
a block of all-survivors is indistinguishable from a block where the instrument was never connected.
- T-R8 **M6**: gut `sanitizeRemoteData` to `return rd`. PREDICTION: **DIES.**
- T-R9 **M8**: remove the `map[string]any` recursion arm from `sanitizeRemoteValue` — i.e. undo the
  headline feature of the round. PREDICTION: **DIES.** If it survives, the round's central claim is
  unpinned and that outranks everything else in my report.
Command for both: `go test ./internal/server/ -run '^(TestSanitizeRemoteDataRecursesThroughEveryCarrier|TestSanitizeAndImportAgreeAtEveryDepth|TestTaskToProtoScrubsRemoteDataURLCarriers|TestSanitizeRemoteDataScrubsEveryURLCarrier)$' -count=1`
T-R10 **M9**, leg `xss-r5-test`, filed before execution. ROOT=`/workspace/farmtable-xss-r5-test`
DIST=ABSENT. Behaviour-preserving refactor: extract `taskToProto`'s wire-path write into a helper
`taskRemoteDataStruct`, so the RHS inside `taskToProto` no longer contains `sanitizeRemoteData(`.
Runtime behaviour is IDENTICAL — nothing is unsanitized. PREDICTION: **DIES**, on both the
unsanitized-site enumeration and the OUTBOUND membership check, naming `taskToProto`. This tests the
registry's central claim AND measures its false-positive profile in one run.
Command: `go test ./internal/server/ -run '^TestScannedServerPackageRemoteDataWriteSitesSanitize$' -count=1 -v`
T-R7 RESTORE VERIFICATION + ORDER CHECK, leg `xss-r5-test`. ROOT=`/workspace/farmtable-xss-r5-test`
DIST=ABSENT. T-R1 alternation, unmutated, run twice: once plain, once `-shuffle=on`. The shuffle is
because the brief warns a green here may be a property of test ordering; a pass under shuffle does
not prove independence but a FAILURE would prove dependence, and I would rather have looked.

**RV-1 AMENDED, AND WHY (leg `xss-r5-review`).** The first RV-1 instrument used a BAD URL at
the leaf. That makes `dropped=true` and `errored=true` at EVERY chain length -- URL rejection
when shallow, depth truncation when deep -- so the two thresholds are invisible and the probe
**could not have failed**. Recorded rather than quietly replaced: the run happened, it returned
`dropped==errored` at 1..40 for all three hop shapes, and **that green was worthless**. RV-1 is
re-run with a GOOD URL at the leaf, which keeps both sides quiet until the bound bites and makes
each side's flip point directly comparable. Same command, same predictions, same refuter.

**UNPLANNED LINE, DISCLOSED:** I also ran `go vet ./internal/server/` (single package, to read a
compile error out of the probe file). The fence names `go vet ./...`; this was one package. Logging
it rather than deciding for myself that it did not count.

**POST-RUN, leg `xss-r5-test`.** ROOT=`/workspace/farmtable-xss-r5-test` DIST=ABSENT throughout.
No token requested or held; every line was a single-package `-run`-filtered `-count=1` run.
**8 mutants, 8 pre-registered predictions, 8 correct. 4 survived, 4 died.**

| # | mutant | predicted | observed |
|---|---|---|---|
| T-R1 | none (BASELINE) | 10 PASS | **10 PASS** |
| T-R2 | M1 `"labels"` removed from `issueBuildRemoteData` | survive | **SURVIVED** (`ok`) |
| T-R2b | M1, `internal/platform/github -run '^TestIssueBuildRemoteData...'` | survive | **"no tests to run"** — filter was my own guess; NOT a result, superseded by T-R2c |
| T-R2c | M1, `internal/platform/github -run '.'` | survive | **SURVIVED** (`ok`) |
| T-R3 | M2 `log.Printf` removed from `structOrNilLoggingErr` | survive | **SURVIVED** (`ok`) |
| T-R4 | M3 one `*`-starred row deleted (6→5 vs floor 5) | survive | **SURVIVED** (`ok`) |
| T-R5 | M4 count-neutral: starred row replaced by duplicate of another | survive | **SURVIVED** (`ok`) |
| T-R6 | M5 `taskToCreateParams` assigns `RemoteData` | **die** | **DIED** — correct message, reproduces author's Mutant A independently |
| T-R8 | M6 `sanitizeRemoteData` → `return rd` | **die** | **DIED ×4** |
| T-R9 | M8 recursion arm removed from `sanitizeRemoteValue` | **die** | **DIED ×4** — the round's headline property IS pinned |
| T-R10 | M9 behaviour-preserving extraction out of `taskToProto` | **die** | **DIED** — named `taskToProto` + OUTBOUND |
| T-R7 | none (RESTORE VERIFY, plain + `-shuffle=on`) | 10 PASS | **10 PASS both** |

**RESTORE:** `md5sum -c` all 7 files **OK**; `git status --porcelain` empty; `git diff --stat` empty;
`url-scheme-validation-r5` still at `d305391`. Project-log committed on `leg/xss-r5-test` only.
**T-R2b is left on the record deliberately** — "no tests to run" is not "no test catches it", and
reporting it as the latter would have been a weaker claim wearing a stronger one's clothes.

**RV-5 (leg `xss-r5-review`), pre-registered before running.** Same probe-file protocol:
one added `internal/server/zz_reviewer_probe2_test.go`, deleted after, `git status --short`
verified empty. No production file touched.

| # | command | hypothesis | PREDICTION / REFUTER |
|---|---|---|---|
| RV-5 | `go test ./internal/server/ -run '^TestProbeH6H7AssignmentBlindSpots$' -count=1 -v` | **H6** `remoteDataAssignment` splits at the FIRST top-level separator, so a single-line composite literal `p := store.CreateTaskParams{RemoteData: rd}` splits at `:=`, the LHS is `p`, and the site is a SILENT MISS. **H7** `firstTopLevelSeparator` counts brackets per line, so a line beginning with a closer drives depth negative and the `:` arm (`if depth != 0 {continue}`) skips a real composite-literal field -- also a silent miss. | PREDICT both return `ok=false`. **REFUTER: either returns `ok=true`.** Either way this contradicts the shipped claim on `remoteDataAssignment` that "shapes nobody has thought of are all visible without being predicted". CONTROL: the two shapes the table already covers must still return `ok=true`, or my instrument is broken. |

---

## T-R11 — B-1 ADJUDICATION RUN, leg `xss-r5-test`, filed BEFORE execution

| field | value |
|---|---|
| ROOT | `/workspace/farmtable-xss-r5-test` |
| DIST | **ABSENT** (fresh clone, never built) |
| DIST-PROVENANCE | unchanged since T-R1; no build has been run from this root at any point |
| SHA | `b9ada87` = `d305391` **+ one markdown file** (`.design/project-log/2026-07-29-test-xss-r5.md`). `git diff --name-only d305391 b9ada87` returns that one path. **No `.go` file differs.** |
| token | NOT REQUESTED. Single package, single test. |

**Command:** `go test ./internal/server/ -run 'TestPassthroughReadDropsUnsafeRemoteURL' -count=1`
with **M1 re-applied** (delete `"labels": issueLabels(issue),` from
`internal/platform/github/graphql_queries.go`).

**MY PRE-REGISTERED PREDICTION: RED.** I read the test before predicting and I think the eng-manager
is right. It stands up a mock GraphQL server, goes through a real gRPC `ListTasks`, and asserts
`len(poisoned.GetRemoteData().GetFields()) != 0`. `issueBuildRemoteData` therefore **executes** even
though no test names it. With `labels` deleted and the fixture's `subIssues.nodes` empty, the
conditional `sub_issues` carrier is never set, and every remaining value (strings, ints,
`map[string]any`) is representable — so `NewStruct` should succeed and the field count should jump
to roughly 13.

**What I do under each outcome, written down first:**
- **RED** → the eng-manager's hypothesis holds. **My B-1 conclusion was an overreach and I say so in
  those words.** The narrow claim (no test *names* the builder) stays true; the wide claim (nothing
  goes red) was never measured at the boundary. B-1 drops to non-blocking.
- **GREEN** → two people who read the source predicted otherwise and were wrong; B-1 gets stronger.
- **THIRD EXPLANATION** → outranks both, and I report it ahead of either.

**Anti-vacuity:** the test must be observed to actually RUN. `ok` with "no tests to run" is not a
green — I made that exact mistake at T-R2b and will check the run count this time.

**POST-RUN T-R11.** ROOT=`/workspace/farmtable-xss-r5-test` DIST=ABSENT.
- Anti-vacuity control (unmutated): the test **RAN** — 8 `=== RUN`/`--- PASS` lines, not "no tests
  to run". `ok`. This is the check I failed to make at T-R2b.
- **M1 applied → RED.** `--- FAIL: TestPassthroughReadDropsUnsafeRemoteURL` on **all 6 subtests**.
- **PREDICTION CORRECT (RED).** The eng-manager's hypothesis holds. My original M1 run's `-run`
  string was anchored `^(...)$` over ten names and **did not include this test.**
- **UNPREDICTED DETAIL — the field list.** Both the eng-manager and I expected ~13 fields. Observed
  **7**: `[created_at node_id number platform remote_id sub_issues_summary updated_at]`.
  **`remote_url` and `html_url` are ABSENT — `sanitizeRemoteData` stripped them on a real decode
  path.** See amendment A-3 in `xss-r5-test.md`.
- **RESTORE:** `md5sum -c` all 7 **OK**, `git status --porcelain` empty, test green again,
  `url-scheme-validation-r5` still `d305391`.

---

## T-R12 — PRE-RUN (test leg) — INSTRUMENTED RE-RUN OF THE B-1 ARBITRATION

**Logged BEFORE the run.** Requested by eng-manager addendum (05:25Z), which arrived *after* T-R11
had already executed. T-R11 gave a bare red/green; this run adds the error-string instrumentation
the audit leg proposed, so the four hypotheses separate in one shot.

- **ROOT:** `/workspace/farmtable-xss-r5-test` @ `b9ada87` (differs from `d305391` by one
  markdown file, `.design/project-log/2026-07-29-test-xss-r5.md` — no `.go` file differs)
- **DIST:** ABSENT
- **Command:** `go test ./internal/server/ -run 'TestPassthroughReadDropsUnsafeRemoteURL' -count=1 -v`
  with **M1 re-applied**, full stdout+stderr captured, then grepped for `invalid type` and for the
  `structOrNilLoggingErr` message. Single-package, `-run`-filtered: **token-free.**
- **M1 target (confirmed by inspection this run, not from memory):**
  `internal/platform/github/graphql_queries.go`, the line `"labels":     issueLabels(issue),` inside
  the **unconditional** map literal of `issueBuildRemoteData`. **NOT** `internal/platform/github/github.go`.

### Pre-registered predictions, against the EM's four branches

1. **`invalid type: []string`** → mutant did not take. **I PREDICT THIS WILL NOT APPEAR.**
2. **Some other type named (third carrier, e.g. `node_id`)** → **I PREDICT THIS WILL NOT APPEAR.**
   `node_id` is a `githubv4.ID` = `interface{}` holding a `string` at runtime; strings are
   representable. The only other non-representable carrier is `sub_issues` (`[]map[string]any`) and
   this fixture sets `subIssues.nodes: []`, so that key is never written.
3. **`NewStruct` returns nil error → test MUST be red.** **I PREDICT THIS BRANCH.** Expect *no*
   `invalid type` line and *no* `structOrNilLoggingErr` log line anywhere in the output, because
   the sanitized map becomes fully representable once `labels` is gone.
4. **Subtest-level confirmation:** expect 6 named `--- FAIL:` subtest lines, not just a parent line.

**Anti-vacuity:** T-R11 already established the unmutated test emits 8 RUN/PASS lines, so the
assertion is not skipped. Re-confirmed by the `-v` output below.

**Falsifier that would overturn my A-3 amendment:** if the output *does* contain `invalid type:`
naming any type, then `remote_data` was dropped by the structpb accident after all, the 7-field
observation was misread, and A-3 must be withdrawn.


### T-R12 — RESULT

**All four predictions correct.**

- **Mutant took:** verified by `diff` against a pre-edit copy (`486d485 < "labels": issueLabels(issue),`)
  and by re-printing the literal. Target confirmed `graphql_queries.go`, **not** `github.go`.
- **`-count=1`:** used. **`-v`:** used. **7 `=== RUN` lines** (parent + 6 subtests) → not vacuous.
- **6 named `--- FAIL:` SUBTEST lines**, not merely a parent line.
- **`invalid type`: ABSENT.** **`not structpb-representable`: ABSENT.** **`dropped`: ABSENT.**
  → **EM branch 3 fired: `NewStruct` returned a nil error and the test went red.**
  Branches 1 and 2 are excluded by measurement: the mutant took, and there is **no third carrier**.
- Failure text: `remote_data unexpectedly carries 7 field(s) ... [created_at node_id number platform
  remote_id sub_issues_summary updated_at]`.

**RESTORE:** `md5sum -c` all 7 **OK**; `git status --porcelain` empty; `url-scheme-validation-r5`
still `d305391`.

---

## T-R13 — PRE-RUN — SELF-AUDIT OF M2 FOR THE EM's DEAD-CODE HAZARD

The EM's addendum raises a hazard that applies to my own table: *a mutant that deletes a branch the
fixture never enters is a no-op, not a survivor.* Auditing my four survivors:

| survivor | branch conditional? | at risk? |
|---|---|---|
| **M1** `"labels"` in `issueBuildRemoteData` | **No** — unconditional map-literal entry | No. And now proven live (T-R11/T-R12 red). |
| **M3** delete a `*`-starred shape-table row | n/a — test *data*, not a branch; the count demonstrably moved 6→5 | No |
| **M4** count-neutral starred-row substitution | n/a — same | No |
| **M2** delete `log.Printf` from `structOrNilLoggingErr` | **YES** — fires only when `NewStruct` returns non-nil err | **AT RISK. Measuring now.** |

- **ROOT:** `/workspace/farmtable-xss-r5-test` @ `b9ada87` · **DIST:** ABSENT
- **Command:** the original ten-test filter, **UNMUTATED**, `-count=1 -v`, grepped for the
  `structOrNilLoggingErr` message. Token-free (single package, `-run`-filtered).

**PREDICTION:** the log line **DOES** execute at baseline (via
`TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident`, whose whole premise is that `NewStruct`
fails on `[]string`). So M2 is a **genuine survivor**: the line runs, and no assertion observes it.

**FALSIFIER, PRE-REGISTERED:** if `not structpb-representable` is **absent** from the unmutated
output, then M2 deleted a line no test executes, **M2 is a no-op and not a survivor, and B-2 must be
downgraded exactly as B-1 was.** I will report that outcome as loudly as the other.


### T-R13 — RESULT: **FALSIFIER DID NOT FIRE. M2 IS A GENUINE SURVIVOR.**

Unmutated ten-test filter, `-count=1 -v`, 94 `=== RUN` lines, `ok`. The log line **executes exactly
once** at baseline:

```
task.remote_data dropped: sanitized remote_data is not structpb-representable: proto: invalid type: map[string]string
```

Driver, confirmed by subtest interleaving: **`TestMapStringStringStaysUnrepresentable_GuardsO1`**
(not `TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident`, which emits nothing — my prediction
named the right outcome for the **wrong reason**; recorded as a partial miss).

So M2 deletes a line that **does** execute and that **no assertion observes**. **B-2 stands.**

**Dead-code hazard audit, all 8 mutants: 0 no-ops found.** The four that died are live by
construction. Of the four survivors, M1 is unconditional and now proven live; M3/M4 are test-data
edits whose effect on the count was directly observed; M2 is measured live above.

### T-R14 — DEFINITIVE B-1 RUN, PATH + SHA + MUTANT + TEST IN ONE COMMAND

Eliminates EM candidate 5 (mutant edited into a different tree than the one tested) with evidence
internal to the run rather than from memory.

| field | value |
|---|---|
| `pwd -P` | `/workspace/farmtable-xss-r5-test` |
| `git rev-parse HEAD` | `b9ada87857a933baa34d906581dd5c9358d2114f` |
| `git diff --name-only d305391 HEAD -- '*.go'` | **empty** |
| mutant proof, same command | `git diff --stat` → 1 file, 1 deletion; `-		"labels":     issueLabels(issue),` |
| flags | `-count=1 -v` |
| result | **RED, 6 named subtests** |

**Candidate elimination, complete:**

| # | candidate | status |
|---|---|---|
| 1 | mutant did not take | **excluded** — `git diff` in the run command |
| 2 | test cache | **excluded** — `-count=1` on every run |
| 3 | third carrier | **excluded** — no `invalid type` printed (T-R12); audit leg's decoder read agrees |
| 4 | assertion never executed | **excluded** — 6 named subtest FAIL lines, `-v` |
| 5 | wrong tree | **excluded** — path + SHA + diff printed in the same command as the run |

**Nothing remains but: the mutant is caught. B-1's wide claim is refuted.**

Audit leg predicted ~9 fields, minus `remote_url`/`html_url` stripped by `sanitizeRemoteData` on the
poisoned fixture = **7. Exactly the observed 7.** Its derivation is confirmed to the field.

**RESTORE:** `md5sum -c` all 7 **OK**; tree clean; `url-scheme-validation-r5` still `d305391`;
test green again unmutated.


---

# LEG: xss-r6-fix (DEV / FIX LEG). Branch `url-scheme-validation-r6`.

**Standing environment for every row below unless a row overrides it:**

| | |
|---|---|
| **ROOT** | `/workspace/farmtable-xss-r6-fix` |
| **DIST** | **PRESENT** (`web/dist/` copied in by the eng-manager before handover; `assets.go`'s embed is in the ROOT package, which `internal/server` does not import, so it is irrelevant to every single-package run below — recorded because the column is mandatory) |
| base SHA | `d305391ee6dc473f5e7bf202167221e15cf52e10` |
| token | **NOT REQUESTED, NOT HELD.** Every row is a single-package `-run`-filtered run. |

## R6-1 — BASELINE, pre-registered BEFORE running

**Prediction: all named tests PASS at unmutated `d305391`.** If any is already red, every later
red in this leg is ambiguous and I must say so rather than attribute it to my own change.

| | |
|---|---|
| command | `go test ./internal/server/ -run '^(TestRemoteDataAssignmentSeesEveryShape\|TestScannedServerPackageRemoteDataWriteSitesSanitize\|TestRemoteDataWriteIsSanitized\|TestRemoteDataFuncIdentSeparatesMethodsFromFunctions\|TestEphemeralGraphRouteDropsRemoteData\|TestPassthroughReadDropsUnsafeRemoteURL\|TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident\|TestMapStringStringStaysUnrepresentable_GuardsO1)$' -count=1 -v` |
| ROOT | `/workspace/farmtable-xss-r6-fix` |
| DIST | PRESENT |
| SHA printed in same command | yes |
| result | *(filled in below)* |

**R6-1 RESULT: `ok github.com/farmtable-io/farmtable/internal/server 0.033s` — GREEN, prediction
confirmed.** `pwd -P`, `git rev-parse HEAD` (`d305391…`) and `git status --porcelain` (**empty**)
were printed in the SAME command as the run. Module cache was cold; the `go: downloading` lines are
a dependency fetch, not a fenced build. **Baseline established: every test I am about to touch is
green before I touch it, so any red I produce below is mine.**

## R6-2 — B4 RED STEP. Pre-registered BEFORE running.

I am adding the review leg's four shapes to `TestRemoteDataAssignmentSeesEveryShape` as rows
expected to be SITES, against the **unchanged** line scanner.

**Prediction: RED, and specifically 4 subtest failures of the form `site = false, want true`.**
The failure mode I am testing for is a SILENT MISS, so the interesting outcome is not "red" but
"red in the miss direction". If instead the rows pass, the review leg's R4 measurement is wrong and
I must report that in WHERE MY BRIEF WAS WRONG rather than proceed with the rewrite.

| | |
|---|---|
| command | `go test ./internal/server/ -run '^TestRemoteDataAssignmentSeesEveryShape$' -count=1 -v` |
| ROOT | `/workspace/farmtable-xss-r6-fix` |
| DIST | PRESENT (irrelevant; `internal/server` does not import the root package) |
| result | *(below)* |

**R6-2 RESULT: RED, exactly as predicted.** 4 subtest FAILs, all
`site = false, want true` — the MISS direction, not the false-positive direction:
`*_single-line_composite`, `*_composite_in_a_call_argument`, `*_composite_in_a_return`,
`*_line_begins_with_a_closer`. The other 15 rows PASS. **The r5 review leg's R4 measurement is
independently reproduced in a different tree at the same SHA.**

## R6-3 — B4 GREEN STEP + B6. Pre-registered BEFORE running.

Scanner rewritten over `go/ast`: `maskGoLiterals`, `remoteDataAssignment`,
`firstTopLevelSeparator` and the `remoteDataEnclosingFunc` regex all DELETED, replaced by
`remoteDataWriteSites` + `isRemoteDataFieldWrite` + an AST `remoteDataFuncIdent`. Count floors
in two tables replaced by membership + row-body distinctness.

**Predictions, and the second is the one I actually care about:**
1. The four shapes go MISS -> SEEN and the whole shape table is GREEN.
2. **`TestScannedServerPackageRemoteDataWriteSitesSanitize` stays GREEN with the SAME six sites
   and the SAME four registry function names.** A parser sees strictly more than a line scanner,
   so if it now reports UNDECLARED functions in `internal/server`, that is a real finding about
   the tree and **I must report it, not silence it by editing the registry.**
   Pre-measured by hand: the population is convert.go x2 (AssignStmt), export_import.go x4
   (composite-literal fields), server.go x3 (exempt). I predict exactly that and no more.

| | |
|---|---|
| command | `go test ./internal/server/ -run '^(TestRemoteDataWriteSitesSeesEveryShape\|TestScannedServerPackageRemoteDataWriteSitesSanitize\|TestRemoteDataWriteIsSanitized\|TestRemoteDataFuncIdentSeparatesMethodsFromFunctions)$' -count=1 -v` |
| ROOT | `/workspace/farmtable-xss-r6-fix` |
| DIST | PRESENT (irrelevant to this package) |
| result | *(below)* |

**R6-3 RESULT: GREEN.** Both predictions confirmed. `ok … 0.016s`. The four shapes are SEEN, and
the registry walk reports **no** undeclared functions — the parser found the same six sites and the
same four names as the line scanner, so the rewrite added no unexplained population. **A green from
a freshly rewritten instrument is worth nothing on its own; R6-4 and R6-5 are the liveness proof.**

## R6-4 — MUTANT: is the AST scanner still able to FAIL? Pre-registered.

Production mutation of `internal/server/convert.go`, `taskToProto`:
`structOrNilLoggingErr(sanitizeRemoteData(t.RemoteData), …)` -> `structOrNilLoggingErr(t.RemoteData, …)`.

**Prediction: RED, naming `taskToProto` and OUTBOUND.** Falsifier pre-registered: if this stays
green the rewritten scanner is not reading the real file and every green above is worthless.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

## R6-5 — MUTANT: does the rewrite actually buy the missed shapes? Pre-registered.

This is the one the line scanner CANNOT pass. Change convert.go's `taskToProto` write from a
statement into a **single-line composite literal** — a behaviour-preserving shape change of the
exact class that was a SILENT MISS. Under the line scanner the site would VANISH (membership red,
"site went missing"). Under the AST scanner it must remain SEEN and remain sanitized.

**Prediction: GREEN under the AST scanner** (site still found, still sanitized, still attributed to
`taskToProto`). If it goes red on "OUTBOUND coverage lost", the rewrite did not close the class.

**R6-4 RESULT: RED, as predicted.** Fired on BOTH axes, which is more than I predicted:
the sanitization assertion named `convert.go:420 in taskToProto`, AND the per-file OUTBOUND
membership assertion reported `OUTBOUND coverage lost`. Also incidentally confirms the denominator:
`5 of 6 RemoteData write site(s)`. The rewritten scanner reads the real file and can still fail.

**R6-5 RESULT: GREEN, as predicted.** With `taskToProto`'s write reshaped into a single-line
composite literal (`*pt = pb.Task{RemoteData: structOrNilLoggingErr(sanitizeRemoteData(...), ...)}`),
the site stayed SEEN, stayed sanitized, and stayed attributed to `taskToProto`. **Under the line
scanner this exact mutant would have gone MISSING and tripped OUTBOUND coverage lost.** That is the
silent-miss class demonstrably closed against the real file, not just against table rows.
`convert.go` reverted; `git status --porcelain` shows only `M internal/server/remotedata_depth_test.go`.

## R6-6 — execution evidence for the four ex-miss rows (hazard 4.2). Pre-registered.

A row that does not fail has not necessarily run. Re-run R6-3's shape table with `-v` and require
the four ex-miss subtests to appear BY NAME in the output as `--- PASS`.
**Prediction: all four named subtests appear and pass.** If a name is absent, that row is
UNRESOLVED, not fixed.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-6 RESULT: GREEN, prediction held.** All 21 rows appear as `--- PASS` by name, including all
four ex-miss rows: `*_single-line_composite`, `*_composite_in_a_call_argument`,
`*_composite_in_a_return`, `*_line_begins_with_a_closer`. They EXECUTED; they are not
silently-absent rows. B4 red-to-green target met with execution evidence.

## R6-7 — B1/B2/B10 comment-only sanity. Pre-registered.

Edits are comment-only in `convert.go` and `urlvalidate_differential_test.go`. **Prediction: GREEN,
unchanged.** A red here means I broke a comment block's syntax, not a behaviour. Named low-value
deliberately: a comment-only edit that goes red is the cheapest possible signal and I want it now
rather than mixed into a later run.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-7 RESULT: GREEN**, as predicted, at 1362bed.

## R6-8 — B8 + B10 producer-side pin, new file. Pre-registered.

New `internal/platform/github/remotedata_representability_test.go`. First structpb import in that
package. **Predictions, all four rows and three subtests:**
1. `both carriers present` / `labels deleted, sub_issues present` / `labels present, sub_issues
   absent` -> ERROR from NewStruct (wantErr true).
2. `both carriers deleted` -> **NO error**. This is the positive control. If it errors, there is a
   THIRD unnamed carrier and the two-carrier account of C-1 is incomplete — **that is a finding to
   report, not an expectation to edit.**
3. sync `buildRemoteData` zero-label -> representable (the B10 asymmetry); with a label ->
   unrepresentable; passthrough zero-label -> STILL unrepresentable.

Falsifier: if row 2 errors, or if the sync zero-label row errors, my B10 commit message is wrong
and I must say so in the report.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-8 RESULT: GREEN, all seven subtests PASS by name.** Every prediction held.
The `both carriers deleted` **positive control passed**, i.e. NewStruct ACCEPTED the map once
`labels` and `sub_issues` were removed. That is the non-vacuity evidence for this whole file:
the three wantErr rows are failing for the named carriers and not for some ambient third reason,
and the two-carrier account of C-1 is confirmed COMPLETE rather than merely unfalsified.
`sync buildRemoteData` zero-label is representable — the B10 asymmetry is measured, not reasoned.

## R6-9 — B7 end-to-end sub-issues fixture + B9 absence assertions. Pre-registered.

**Predictions:**
1. All 8 rows GREEN, including the 2 new `with sub-issues` rows. remote_data stays 0 fields — the
   sub_issues carrier does not rescue representability, it reinforces it.
2. The two new absence loops pass VACUOUSLY (fields map empty). I am recording that as vacuous IN
   THE TEST'S OWN COMMENT rather than claiming coverage I do not have.
3. The `withSubs == 0 || withoutSubs == 0` table guard does not fire.

Falsifier: if a `with sub-issues` row reports non-zero fields, C-1 is weaker than the two-carrier
account says and I must report it.

Also re-running convert.go's package after the EM's THIRD correction (capability-downgrade wording
walked back to "unreadable flag, indistinguishable today, revoked if ever set"). Comment-only.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-9 RESULT: GREEN**, all 8 rows including both new `with sub-issues` rows; 0 fields throughout.

**BUT THIS GREEN IS NOT YET EVIDENCE.** remote_data is nil whether or not the sub_issues branch
executed, so "the fixture reached carrier 2" and "my JSON did not decode into SubIssues.Nodes at
all" are INDISTINGUISHABLE from the proto. Per hazard 4.2 a row without execution evidence is
UNRESOLVED, not passing. R6-10 supplies it.

## R6-10 — did the sub_issues branch ACTUALLY execute end-to-end? Pre-registered.

Temporary panic inside `if len(issue.SubIssues.Nodes) > 0` in graphql_queries.go.
**Prediction: the 2 `with sub-issues` rows FAIL and the other 6 PASS.** A clean differential proves
the fixture reaches carrier 2 through the real GraphQL decode. If ALL 8 pass, my fixture never
decoded and the two new rows are vacuous — a finding to report, and I would have banked exactly the
lucky green B7 warns about.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-10 RESULT: DIFFERENTIAL CLEAN, prediction confirmed by a better instrument than I registered.**

First attempt used `panic` and was a BAD PROBE: a panic tears down the whole test binary, so all 8
rows died together and the differential was destroyed. Recorded rather than quietly replaced —
`FAIL ... 0.017s` with a single probe hit and no per-row breakdown. Replaced with a counting
`fmt.Fprintln(os.Stderr, ...)`.

Second attempt: **exactly 2 probe hits across the 8 rows, all 8 rows PASS.** Two hits = the two
`with sub-issues` rows; the six without produced none. So the fixture reaches
`issueBuildRemoteData`'s `len(issue.SubIssues.Nodes) > 0` branch through the REAL GraphQL decode,
and the green in R6-9 is a measurement rather than a lucky pass. **Carrier 2 is now exercised
end-to-end for the first time in this suite's history.** Probe reverted;
`git status --porcelain` clean for that file.

## R6-11 — B3 sampled logger + its instrument. Pre-registered.

**Predictions:** all 3 tests GREEN. 50-task page -> exactly 1 line; a drop below the interval -> no
new line; past the interval -> a 2nd line reporting **50** suppressed (49 from the page + 1 below
the interval). Representable map -> 0 lines.

The suppressed-count `50` is a NUMBER IN AN ASSERTION and I am pre-committing to the reasoning
rather than to the value: 50 calls, the 1st prints, 49 counted, then 1 more counted below the
interval. **If it comes out different I will work out why before touching the expectation, and say
so in the report either way** — this is exactly the pattern hazard 4.1 warns about.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-11 RESULT: GREEN, all three.** The suppressed count came out **50**, matching the
pre-registered reasoning exactly. No expectation was edited.

## R6-12 — RE-RUN r5's SURVIVING MUTANT M2. Pre-registered.

M2 (delete the `log.Printf` from the drop path) SURVIVED in r5 — the whole suite stayed green.
This is the direct test of whether B3's instrument fixed that. **Prediction: M2 now DIES**, with
`TestRemoteDataDropIsLoggedWithOffendingKeys` and `TestRemoteDataDropLogIsSampled` both RED.
If it survives again, B3 is not done and I must say so rather than claiming the instrument works.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-12 RESULT: M2 DIES. Prediction confirmed.** Both
`TestRemoteDataDropIsLoggedWithOffendingKeys` and `TestRemoteDataDropLogIsSampled` go RED when the
log emission is suppressed. The r5 mutant that SURVIVED against the whole suite is now killed by
two independent assertions. `TestRemoteDataRepresentableMapLogsNothing` correctly stayed GREEN —
it asserts the ABSENCE of a line, so it must not react to this mutant, and a mutant that killed
all three would have meant the positive control was measuring the wrong thing.
Mutant reverted.

## R6-13 — B5 route-level pin + rename. Pre-registered.

**Predictions:** `TestTaskToCreateParamsOmitsRemoteData` (renamed, body unchanged) GREEN.
New `TestEphemeralGraphRouteDropsRemoteData` GREEN, with both controls passing: source retains
RemoteData, exactly 1 task mirrored. Fixture deliberately uses `[]any` not `[]string` so the drop
under test is the ROUTE's choice and not structpb refusing it — if I had used []string the test
could pass for the wrong reason.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-13 RESULT: GREEN, both.** Controls pass: source retains RemoteData, exactly 1 task mirrored.

## R6-14 — DOES THE ROUTE TEST CATCH WHAT THE COPY TEST CANNOT? Pre-registered.

This is the entire justification for adding a second test, so it needs a POSITIVE outcome and not
an argument. Mutant: a SECOND population path inside `loadEphemeralStore` — a post-creation
`UpdateTask` setting RemoteData — which leaves `taskToCreateParams` completely untouched.

**Prediction: `TestTaskToCreateParamsOmitsRemoteData` stays GREEN and
`TestEphemeralGraphRouteDropsRemoteData` goes RED.** A split result is the proof. If BOTH go red
the mutant leaked into the copy; if BOTH stay green the new test is decorative and I must say so.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-14 RESULT: CLEAN SPLIT, prediction confirmed.** With a second population path planted inside
`loadEphemeralStore` (post-creation `UpdateTask`, `taskToCreateParams` untouched):
`TestTaskToCreateParamsOmitsRemoteData` **PASSED**, `TestEphemeralGraphRouteDropsRemoteData`
**FAILED**. That is a positive demonstration that the route-level test catches a class the
copy-level test is structurally blind to — which was B5's entire complaint. The old test could not
have failed if `loadEphemeralStore` acquired a second way to populate RemoteData, and now
something can. Mutant reverted.

## R6-15 — B11 web consumption census, first run. Pre-registered.

New package `internal/webguard`. **Predictions:**
1. `TestWebRemoteDataConsumersAreDeclared` GREEN — the 12 measured mentions all match allowlist
   entries, with exact multiplicities (types.ts 2, grpc-client.ts 2, farmtable.json 2+2, plus 4
   singletons).
2. `TestWebRemoteDataCensusIsNonVacuous` GREEN — both named capability consumers seen.

Falsifier: any undeclared mention means my baseline census was incomplete and the EM's
"count is two" is wrong in a direction neither of us measured.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-15 RESULT: GREEN, both.** All 12 mentions matched declared entries with exact multiplicities.
The EM's estimate of "two consumers" is right about CONSUMERS and the total mention count is 12.

## R6-16 — B11 POSITIVE CONTROL. THE REQUIRED RED. Pre-registered.

Constraint 2 of B11: non-vacuity requires a POSITIVE outcome. Plant a reference, watch it fail,
remove it. Planted reference is deliberately a SERIALISATION sink
(`JSON.stringify(collection.remoteData)`) — NOT a render sink and NOT a capability branch, i.e. a
consumption class NEITHER the EM nor I enumerated. If the guard only caught the classes we thought
of, it would reproduce the original failure.

**Prediction: RED**, naming the file, line, and text, under "UNDECLARED".

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-16 RESULT: RED, as required. THE POSITIVE CONTROL IS SATISFIED WITH A POSITIVE OUTCOME.**
Planted `const cacheKey = JSON.stringify(collection.remoteData);` in capabilities.ts. Guard failed
with:
`src/capabilities.ts:99: const cacheKey = JSON.stringify(collection.remoteData);`
under UNDECLARED, with the full "work out what it is used for first / do not relax to a category"
diagnostic. **The planted sink was a SERIALISATION sink — neither a render sink nor a capability
branch, i.e. a class neither the EM nor I enumerated — and the guard caught it anyway.** That is
the property that matters: it is keyed on consumption, not on a taxonomy of sink kinds. Reverted.

## R6-17 — the OTHER direction: a declared site vanishing. Pre-registered mid-run.

Replaced the capabilities.ts read with dynamic access `(collection as any)['remote'+'Data']`.
**Prediction: RED on the STALE branch**, because the mention disappears.

**R6-17 RESULT: RED on both tests.** `want 1 occurrence(s) of "const rd = collection.remoteData;",
found 0`, plus the non-vacuity control firing independently.

**AND THIS IS THE MORE INTERESTING RESULT OF THE TWO.** Dynamic property access is a DOCUMENTED
BLIND SPOT of the census — the mutated line contains neither identifier, so it is invisible as a
mention. It is caught anyway, as a DISAPPEARANCE. The stale-direction assertion is therefore not
bookkeeping; it is the only thing standing between this guard and a trivial evasion, and the
evasion is the one an attacker-minded developer would actually reach for. Reverted.

## R6-18 — doc.go prose correction, re-verify webguard still green. Pre-registered.

Measured that `.github` has NO workflows directory and that Dockerfile and Dockerfile.server each
run `npm test` and NOT `go test`. That falsifies the sentence I had already committed in
webguard/doc.go claiming this package's runner is "invoked by every build, every CI job". Rewrote
the paragraph to state the measured executor set and the two-sided trade.

**Prediction: GREEN, unchanged.** The edit is prose in doc.go only; no test file touched, no
identifier renamed. Falsifier: any red at all means the edit was not prose-only, or that doc.go
prose is load-bearing for the census (it is not — the census walks web/, not Go source).

Secondary check: doc.go is Go source inside internal/, NOT under web/, so it cannot itself add a
`remoteData` mention to the census. If the census counted it, that would be a scope bug.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT |
|---|---|---|---|

**R6-18 RESULT: GREEN, both, as predicted.** Prose-only edit confirmed. Census unaffected by Go
source under internal/, as expected — its root is the web tree.

## R6-19 — THE WIDE RUN. TOKEN GRANTED BY EM. Pre-registered BEFORE execution.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

HEAD at pre-registration: `b3300964d38c81ff3cd1408e1f973113d1be617f`, tree clean.

### PRE-EXISTING FAILURE SET, supplied by the EM, recorded BEFORE the run
A baseline written after the result is not a baseline. These are NOT my branch:

1. **main is RED today**, independent of `url-scheme-validation-r6`.
2. **TestListUsers** — root-caused: a detached goroutine on a background context that
   nothing can wait for. Cross-test row visibility.
3. **TestWatchTasks_NoInitial** — a LOST EVENT, not a timeout. No deadline value fixes it.
4. **Flake set: FIVE tests at ~4.5% each**, measured project-wide. A single full-suite run
   has meaningful odds of containing a spurious RED.

### COMMAND, and why it is the Go half only
**Running `go test ./... -count=1`, i.e. `make test-go`.** NOT `make test`.

**Measured, before running: `web/node_modules` is ABSENT.** `make test-web` is
`cd web && npm test`, so the web half CANNOT execute in this container regardless of the
token. `make test` would therefore have spent the grant on a test-go run plus a guaranteed
dependency-missing error, and with `make -k` it would still not have produced a web result.
Installing node_modules is a network operation and new work; the EM said do not start any.
So the grant buys the Go half, which is exactly what I requested it for (cross-package
compilation) and exactly what was granted.

`-count=1` on purpose: cached PASS results would defeat the measurement I want. The open
question is whether packages I did NOT touch still compile, and I want that answered by an
actual compile+run, not by a cache key.

### PREDICTIONS
1. **COMPILATION: clean, everywhere.** This is the claim the token was requested to test.
   Falsifier: any build error, in any package, touched or untouched. If it appears it is
   MINE and I will say so plainly — it is precisely the risk I flagged as UNCHECKED.
2. **My four touched packages GREEN**: `internal/server`, `internal/platform/github`,
   `internal/webguard`, and anything depending on them.
3. **Some RED expected, from the pre-existing set above.** A red inside that set proves
   nothing on one observation and gets a targeted re-run (no token, per the grant).
4. Falsifier that would change the round verdict: **a test failure OUTSIDE the set that is
   not a compile error.** Per the grant I REPORT it and DO NOT FIX it.

### NOTED IN PASSING, not acted on
The Makefile comment above `test:` states that an audit found `git grep "npm test"` returned
"only prose in project-log markdown". That is stale as of this HEAD: `Dockerfile:9` and
`Dockerfile.server:9` are each `RUN npm test`. Does not affect my measurement (image builds
run the web suite, not the Go suite — which is what I claimed), and it is not my item.

**R6-19 RESULT: GREEN. EXIT=0. ZERO failures, ZERO build errors, across all 11 test packages.**
Wall clock 06:26:20Z -> 06:26:44Z (24s incl. module downloads). HEAD `b330096`.

```
ok  cmd/farmtable-server 0.009s   ok  internal/cli 0.014s        ok  internal/decomposer 0.008s
ok  internal/mcp 0.008s           ok  internal/platform/beads 0.012s
ok  internal/platform/github 0.016s   ok  internal/server 0.650s ok  internal/serverapp 0.056s
ok  internal/store 0.333s         ok  internal/streaming 0.909s  ok  internal/webguard 0.008s
```

**Prediction 1 CONFIRMED: compilation clean everywhere, touched and untouched.** The risk I
flagged as UNCHECKED is now MEASURED and it was not real. 22 further packages report
`[no test files]` — they still COMPILED, since `go test ./...` builds them.

**Prediction 2 CONFIRMED:** all four touched packages green.

**PREDICTION 3 FALSIFIED, AND THIS IS THE RESULT THAT NEEDS CARE.** I predicted some red from
the EM's pre-registered set. There was NONE. `TestListUsers` and `TestWatchTasks_NoInitial` are
BOTH in packages that ran (`internal/server`, `internal/store`), NEITHER carries a build tag,
and the suite exited 0 — so they ran and PASSED. Going to R6-20 for per-test execution
evidence rather than inferring it from a package-level `ok`, per hazard 4.2: a green without
execution evidence is UNRESOLVED, not passed.

**Prediction 4: not triggered.** No failure inside or outside the set, so nothing to report as
verdict-changing and nothing to refrain from fixing.

**Flake arithmetic, stated so the green is not over-read:** five tests at ~4.5% each gives
P(at least one spurious red) = 1 - 0.955^5 = about 20.6%. Observing zero reds is the ~79%
outcome and is therefore WEAK evidence about flakiness. This run says the suite CAN be green.
It does not say the flake set is gone, and I am not claiming that.

## R6-20 — per-test execution evidence for the two named baseline tests. Pre-registered.

Targeted single-test runs. Per the EM grant these need no token and do not consume R6-19.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

**Prediction: all three report an explicit `--- PASS` line with a name.** Falsifier: any of them
reporting `no tests to run`, `SKIP`, or not appearing at all — which would mean R6-19's green
was partly vacuous on exactly the tests the EM flagged, and the package-level `ok` misled me.

**R6-20 RESULT: all three PASS, with named execution evidence.**

```
internal/server: === RUN TestListUsers            --- PASS: TestListUsers (0.01s)
internal/server: === RUN TestWatchTasks_NoInitial --- PASS: TestWatchTasks_NoInitial (0.01s)
internal/store:  === RUN TestListUsers            --- PASS: TestListUsers (0.00s)
```

**BUT THE TARGETED PASS FOR TestListUsers IS NEARLY VACUOUS, AND I AM NOT GOING TO PRESENT IT
AS EVIDENCE.** The EM root-caused it as CROSS-TEST ROW VISIBILITY — it fails because of rows
another test leaves behind. A `-run` filter runs it ALONE, which removes the exact condition
that makes it fail. The instrument is structurally incapable of detecting the defect, which is
the same failure shape as a render-keyed search looking for a capability sink. Recording it
because it proves the test EXECUTED and was not skipped or filtered away; NOT because it proves
anything about the defect.

**The load-bearing observation for TestListUsers is R6-19**, the full-suite run, where it ran
alongside everything else and still passed. `TestWatchTasks_NoInitial` (a lost event) is less
order-dependent, so its targeted pass carries a little more weight, but not much.

**WHAT I AM CLAIMING, EXACTLY:** at HEAD `b330096`, in this container, on one full-suite run,
the Go suite was entirely green including both tests the EM named as failing.
**WHAT I AM NOT CLAIMING:** that they are fixed, that the flake set is gone, or anything at all
about `main`. I never ran `main`, and doing so would need a second wide run and a second tree.
The EM's statement was "main is RED today, this is not your branch" — consistent with my branch
(base `d305391`) being green. Environment is stated per §10.25: my tree, this container, this
SQLite DB state; a suite whose failures are cross-test and order-dependent is environment-
sensitive by definition, and one green is the ~79% outcome, not a proof.

## R6-21 — B11 MUTANT 3: THE PURE-ADDITION EVASION. Pre-registered BEFORE running.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

HEAD `b3300964d38c81ff3cd1408e1f973113d1be617f`, tree clean at pre-registration.

**Requested by the EM, approved upstream, and it targets a hole in the guard I built.**

My two earlier mutants both tested **SUBSTITUTION**: R6-16 replaced nothing (pure addition, but
using a LITERAL identifier, so it added a mention and was caught as UNDECLARED); R6-17 replaced
a declared literal read with dynamic access, so a mention DISAPPEARED and it was caught as
STALE. Neither tests the evasion in its pure form.

**THE PURE FORM: ADDITION VIA DYNAMIC ACCESS, in a file that currently declares no mention.**
No mention is added (the line contains neither `remoteData` nor `remote_data`), and no declared
site changes, so there is no disappearance either. Both of the guard's two directions are
silent by construction.

**EM PREDICTION: GREEN.** `[DERIVED]`, pre-registered, unrun at time of writing.
**MY PREDICTION: GREEN, same**, and I can see why by inspection — `censusRemoteDataMentions`
matches with `strings.Contains(line, id)` over the two literal identifiers only, so a line that
spells the field by concatenation is not a mention at all. Inspection is not measurement, so it
gets run.

Falsifier: RED. That would mean the guard catches something I cannot account for from reading
it, the EM's prediction was wrong, and my own documented limit ("Dynamic access.
`coll['remote' + 'Data']` is invisible") is wrong too.

**Target:** `web/src/components/ft-collection-list.ts` — chosen because it currently has ZERO
mentions and because a collection list gating a write affordance on the collection's
remote_data is a REALISTIC consumer, not a contrived one. An artificial target would make a
green easier to dismiss.

Mutant to plant (dynamic access, plus a branch so it is a real capability consumer and not a
dead read):

    const rd = (collection as any)['remote' + 'Data'];
    if (rd && rd.writable === true) { return true; }

Revert afterwards and show the tree clean, as with R6-16 and R6-17.

**R6-21 RESULT: GREEN. THE EM'S PREDICTION IS CONFIRMED AND THE HOLE IS REAL.**

Planted in `web/src/components/ft-collection-list.ts` (a file with ZERO prior mentions):

```
  private canWrite(collection: Collection): boolean {
    const rd = (collection as any)['remote' + 'Data'];
    if (rd && rd.writable === true) { return true; }
    return false;
  }
```

`go test ./internal/webguard/ -run '^TestWebRemoteData' -count=1` -> **ok, 0.008s. GREEN.**
Corroborating measurement: `grep -c 'remoteData\|remote_data'` on the mutated file returns **0**,
exit 1. The line is not a mention, so the census has nothing to see. Reverted;
`git status --porcelain` empty; guard green again at `b330096`.

**This is a live capability consumer of attacker-authored data, doing the same job as the two
declared ones, and the guard I built does not notice it.** Both directions are silent by
construction: nothing added to the census, nothing removed from it.

### AND IT IMPLICATES MY OWN PROSE, BY THE EM'S NEW MECHANISM

The EM's replacement mechanism for the r1-r5 negatives is: *a negative's conclusion was written
at a WIDER SCOPE than its own evidence, inside the same document.* R6-21 shows I did exactly
that in B11, one round after being warned about it.

I wrote, in the commit message and in the report: *"The stale-direction assertion is therefore
not bookkeeping; it is THE ONLY THING standing between this guard and THE EVASION SOMEONE WOULD
ACTUALLY REACH FOR."*

My evidence was R6-17, which is a **substitution** — a declared read REPLACED by dynamic access.
The conclusion I drew was about **dynamic access as a class**. That is wider than the evidence
by exactly one case, and it is the case that matters: **addition**. The stale assertion defends
substitution only, because substitution is the sole variant that makes a declared mention
disappear. Against pure addition it is inert.

The guard's own limits block does say "Dynamic access. `coll['remote' + 'Data']` is invisible."
So the LIMIT was documented. What was wrong was the neighbouring claim that the stale-direction
check substantially mitigates it. Documented limit, overstated mitigation, in the same file.
Correcting the sentence in the report rather than leaving the stronger version standing.

## R6-22 — B11 MUTANT 4: THE LITERAL ADDITION. THE CELL THAT DECIDES THE ROUND.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

HEAD `6bbd056b3cccbc72880ae1bd4361e17f93c4c6f7`, tree clean at pre-registration.

Same consumer, same file, written the obvious way: plain literal member access, no string
arithmetic, no cast trick — the way a developer adding a feature would actually type it.

**MY PREDICTION, WRITTEN BEFORE RUNNING: RED.** Confident, and here is the mechanism I am
betting on so that a wrong call is diagnosable rather than just wrong. `censusRemoteDataMentions`
matches with `strings.Contains(line, id)` over the literal identifiers `remoteData` and
`remote_data`. A line reading `const rd = collection.remoteData;` CONTAINS `remoteData`, so it
IS a mention. Its key is `{file: "src/components/ft-collection-list.ts", text: ...}`, which is
absent from `webRemoteDataConsumers` — that file has no allowlist entry at all. The undeclared
branch therefore fires.

**Prior evidence pointing the same way:** R6-16 planted a literal `JSON.stringify(collection.remoteData)`
and got RED. But R6-16 landed in `capabilities.ts`, a file that ALREADY has declared entries, so
it does not by itself settle a file with no entries. That gap is exactly why this cell is being
run, and I should not have treated R6-16 as covering it.

**The EM holds a DERIVED belief and is deliberately withholding it** so that an accurate specific
expectation does not make my own check feel redundant. Noted, and correct — that is the same
dynamic that made a name search feel sufficient twice tonight.

### WHY THIS CELL DECIDES THE ROUND
- **RED** => the guard's true property is: catches the ACCIDENTAL addition, blind to the
  DELIBERATE one. Defensible, worth shipping, and the only defect was the prose (already fixed).
- **GREEN** => nothing goes red when anyone adds a sink by ANY spelling. The guard would detect
  only removals and renames, and **the deliverable this round was commissioned to produce would
  not have been produced.** Same artefact, same prior evidence, opposite disposition.

Falsifier for my prediction: GREEN. If it is green I will say so plainly and the round verdict
changes; the disposition is the EM's to adjudicate, not mine to soften.

**R6-22 RESULT: RED. MY PRE-REGISTERED PREDICTION WAS CORRECT, AND THE ROUND'S DELIVERABLE STANDS.**

Planted in `web/src/components/ft-collection-list.ts` (no allowlist entry, no prior mention):

```
  private canWrite(collection: Collection): boolean {
    const rd = collection.remoteData;
    if (rd && rd.writable === true) { return true; }
    return false;
  }
```

Guard output:

```
--- FAIL: TestWebRemoteDataConsumersAreDeclared (0.00s)
    UNDECLARED remote_data MENTION(S) IN THE WEB TREE:
      src/components/ft-collection-list.ts:256: const rd = collection.remoteData;
```

...followed by the full diagnostic, including the "do not relax this to a permitted category"
clause. Reverted; `git status --porcelain` empty; guard green again at `6bbd056`.

### THE DECIDING CELL, RESOLVED
The 2x2 on the web guard is now complete, and every cell has execution evidence:

| | in a file WITH declared entries | in a file with NONE |
|---|---|---|
| **literal spelling** | RED (R6-16, serialisation sink) | **RED (R6-22)** |
| **computed spelling** | RED as a disappearance (R6-17, substitution) | GREEN (R6-21, addition) |

**THE GUARD'S TRUE PROPERTY, now measured rather than asserted: it catches the ACCIDENTAL
addition and is blind to the DELIBERATE one.** A developer adding a consumer the way a developer
actually types it is stopped, by name, at the line. Someone who deliberately spells the field by
concatenation to get past the census is not.

That is a real and defensible property. It is also EXACTLY the property a guard of this kind can
have without a TypeScript parse, and it is worth shipping — the threat model that matters here is
the unwitting sixth consumer, not an adversary with commit rights who is already inside every
other boundary in this system. The only thing that was ever wrong was my prose, which claimed
more, and which is now corrected in both the report and the in-tree log.

**Why R6-16 did not already settle this, and why I should not have implied it did:** R6-16 landed
in `capabilities.ts`, a file that ALREADY carries allowlist entries. A file with no entries is a
different code path through the undeclared check, and treating one as covering the other is the
same scope drift this round is about. The EM was right to demand the cell.

**On the EM withholding their prediction:** correct call, and I want it on record as a method
note. An accurate specific expectation handed over in advance is precisely what makes a check
feel redundant, and "it felt redundant" is how a name search passed for sufficient twice tonight.

## R6-23 — B11 MUTANT 5: THE BYTE-IDENTICAL DUPLICATE. THE COPY-PASTE CASE.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

HEAD `c108acbcfa2357862576092469828709bb6c4090`, branch `url-scheme-validation-r6`, tree clean at
pre-registration.

The EM read the guard source directly rather than take my summary, and found a path nothing has
exercised. The census key is FILE + EXACT TRIMMED TEXT and the count is an EXACT MULTIPLICITY
under strict equality, so a literal addition into a file that already carries declarations has
TWO fates, not one:

  A. text differs from every declared entry -> unmatched key -> UNDECLARED arm -> RED.
     Measured in R6-16. Done.
  B. text is BYTE-IDENTICAL to a declared entry in the same file -> the key MATCHES, it is never
     undeclared, and only the multiplicity arm can catch it.

Nobody has run B. Everything known about it is read off the source, including by the EM, and
reading is not running.

**MY PREDICTION, WRITTEN BEFORE RUNNING: RED, VIA THE STALE/MULTIPLICITY ARM. NOT THE UNDECLARED
ARM.** Naming the arm because a RED from the wrong arm is a different result from a RED.

Mechanism I am betting on, traced through the code:
1. `censusRemoteDataMentions` emits one `mention` per line containing `remoteData`. The duplicate
   line contains it, so the census yields TWO mentions with identical `{file, text}`.
2. In `TestWebRemoteDataConsumersAreDeclared` the lookup is `declared[key{m.file, m.text}]`. Both
   mentions HIT, because the text is byte-identical to the declared entry. So `undeclared` stays
   EMPTY and the first `t.Errorf` does NOT fire. Both mentions fall through to `actual[k]++`.
3. `actual[{src/capabilities.ts, "const rd = collection.remoteData;"}] == 2`.
4. The stale loop compares `got` against `c.count == 1`. `2 != 1`, so it appends
   `want 1 occurrence(s) ... found 2` and the SECOND `t.Errorf` fires.

Expected message, verbatim prefix: `DECLARED remote_data SITE(S) NO LONGER MATCH:` — which is
awkward wording for a count that is too HIGH rather than absent, and I will note that as a
readability defect if the run confirms the arm. The body does cover it: "a count that is too HIGH
is as much a failure as one that is too low, because a second copy of a consumer line is a second
consumer."

Both arms are `t.Errorf`, not `t.Fatalf`, so neither arm can mask the other in the output. That
matters: it means "RED from the stale arm" is directly observable rather than inferred from the
absence of the other.

**FALSIFIERS, pre-registered:**
- GREEN => the exact-multiplicity design does nothing and the guard misses copy-paste, which is
  how a second consumer actually gets written. WORSE than the computed-access hole, because
  computed access takes intent and this takes none.
- RED from the UNDECLARED arm => my model of the key is wrong; the text is not matching the way I
  think it is, and every claim in this round that rests on file+text keying needs re-examining.

**PLANT.** A second `getCapabilities`-style gate in `src/capabilities.ts` whose body line is
byte-identical after trimming. Placed in a SEPARATE function so the file stays valid TypeScript
(two `const rd` in one scope is a TS error) — the guard does not compile TS, but a plant that
could not exist in real code is not the copy-paste case it claims to model.

Both-ways control: revert, re-run, confirm green returns.

**R6-23 RESULT: RED, VIA THE STALE/MULTIPLICITY ARM. PREDICTION CORRECT, INCLUDING THE ARM.**

Planted in `web/src/capabilities.ts` (pure addition, nothing removed, every declared site intact):

```
/** R6-23 MUTANT: copy-pasted gate, body line byte-identical to the declared entry. */
export function canBulkEdit(collection: Collection): boolean {
  const rd = collection.remoteData;
  return !!(rd && typeof rd === 'object' && 'writable' in rd && rd.writable === true);
}
```

Byte-identity confirmed before running: the identifier grep returned the declared site at line 98
and the plant at line 109, same trimmed text.

Guard output, arm identified by source line:

```
--- FAIL: TestWebRemoteDataConsumersAreDeclared (0.00s)
    remotedata_consumers_test.go:359: DECLARED remote_data SITE(S) NO LONGER MATCH:
      src/capabilities.ts: want 1 occurrence(s) of "const rd = collection.remoteData;", found 2
```

`:359` is the STALE arm. The UNDECLARED arm is the `t.Errorf` at `:330` and it did NOT fire —
directly observable rather than inferred, because both arms are `t.Errorf` and neither can mask
the other. The message carried the full "exact multiplicities, not floors" clause and the
declared reason for the site it collided with.

Both-ways control: reverted, `git status --porcelain` EMPTY, guard re-run GREEN (`ok ... 0.005s`,
exit 0) at `c108acb`. The red stops when the cause is removed.

**WHAT THIS SETTLES.** The exact-multiplicity choice with strict equality is doing real work, and
it is the ONLY thing that catches this case. A count FLOOR (`>= 1`), which is the idiom this
round removed elsewhere, would have gone green here: one required occurrence, two found, floor
satisfied. The copy-paste consumer — which is how a second consumer actually gets written — would
have been invisible. That is a direct, measured vindication of the design choice, and it is the
first time this round that an anti-floor argument has been backed by an execution rather than by
reasoning.

**ONE READABILITY DEFECT, FLAGGED NOT FIXED (freeze):** the header reads `DECLARED ... SITE(S) NO
LONGER MATCH`, which describes absence and misdescribes this case, where the site matches TWICE.
A reader hitting this red is told a site went missing when in fact one was duplicated. The body
paragraph does explain it, but the header is what gets read first and it points the wrong way.
Cheap fix (`NO LONGER MATCH` -> `DO NOT MATCH THEIR DECLARED COUNT`), not applied under the
freeze. Fix-round candidate.

## R6-24 — B11 MUTANT 6: COMPUTED ACCESS AS A PURE ADDITION. THE CELL THE MATRIX HID.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

HEAD `c108acbcfa2357862576092469828709bb6c4090`, tree clean at pre-registration (verified after
the R6-23 revert).

The EM was asked a question my 2x2 could not answer: in the computed / file-with-declared-entries
cell, was R6-17 an ADDITION or a SUBSTITUTION? It was a SUBSTITUTION — I labelled it that way at
the time, which is the only reason the distinction is recoverable. A disappearance fires because
something was REMOVED. R6-17 replaced a declared literal read with a computed one, so the
declared entry stopped matching and the stale arm fired on the REMOVAL. **That cell is RED about
deletion. It never tested addition.**

So the computed row currently reads: one cell GREEN, one cell red for a different question, and
NO CELL ANYWHERE has shown this guard catching a deliberate ADDITION. The matrix's own layout hid
that, because ADDITION and SUBSTITUTION both land in a box labelled RED. That is a defect in my
presentation, not in my labelling, and it is the same family as the scope drift this round is
about: two different events collapsed into one cell by the shape of the table.

**MY PREDICTION, WRITTEN BEFORE RUNNING: GREEN. NO ARM FIRES.**

Mechanism:
1. The plant's text contains neither `remoteData` nor `remote_data` as a literal substring — the
   spelling is split across a concatenation, so `strings.Contains` matches neither identifier.
2. Therefore the census emits NO mention for the planted line. Nothing enters `undeclared`.
3. It is a PURE ADDITION: every declared site is untouched, so every `actual[k]` still equals its
   declared `count`. The stale arm has nothing to report.
4. Both arms silent => GREEN.

This is the R6-21 mechanism (which went green, as the EM predicted) transplanted into a file that
DOES carry declarations. My expectation is that the declarations are irrelevant to the outcome,
because they are only consulted for lines the census already emitted, and this line produces
none. If that is right, the file-has-entries axis does not exist for the computed row at all.

**FALSIFIER: RED.** Then the guard has a property neither I nor the EM has modelled, and the
mechanism matters more than the red does.

**DISPOSITION, PRE-COMMITTED BY THE EM BEFORE THE RUN, so neither of us chooses after seeing it:**
- GREEN => shipping sentence becomes CATCHES THE ACCIDENTAL ADDITION; NEVER OBSERVED CATCHING A
  DELIBERATE ONE. In-tree bound amended to match. IT STILL SHIPS; it does not cost a round.
- RED => mechanism in one sentence, wanted more than the red itself.

Naming discipline for the plant: no identifier or comment in it may contain either spelling, or I
would get a red for the wrong reason and mistake it for the cell.

Both-ways control: revert, confirm green returns.

**R6-24 RESULT: GREEN. PREDICTION CORRECT. NO ARM FIRED. SAYING SO PLAINLY.**

Planted in `web/src/capabilities.ts`:

```
/** R6-24 MUTANT: pure addition, computed spelling, nothing removed or substituted. */
export function canBulkEdit(collection: Collection): boolean {
  const gate = (collection as unknown as Record<string, unknown>)['remote' + 'Data'];
  return !!(gate && typeof gate === 'object' && (gate as Record<string, unknown>).writable === true);
}
```

Pre-conditions verified BEFORE the run, so the green cannot be explained away afterwards:
- `git diff --numstat` = `6  0` — SIX ADDED, ZERO REMOVED. Pure addition, mechanically confirmed,
  not asserted. This is the exact property R6-17 lacked.
- The declared site `const rd = collection.remoteData;` still occurs exactly ONCE.
- An identifier grep over the whole mutated file returns ONE line: the original declared site at
  :98. The plant contributes no mention in either spelling, by name or by comment.

Guard: `ok ... 0.005s`, exit 0. Whole package after revert: both tests PASS, exit 0, tree clean at
`c108acb`.

**WHY THIS GREEN IS NOT AN INSTRUMENT FAILURE.** The strongest possible control was run minutes
earlier, in the SAME FILE, with the SAME COMMAND: R6-23 made this guard go red on
`src/capabilities.ts`. So the instrument is demonstrably live on this exact target, and the green
is a property of the mutant rather than of a dead check. This is the paired-mutant discipline
that B4 established, and it is the reason this green can be reported as a measurement instead of
as an absence.

**THE ROW IS NOW HONESTLY COMPLETE, AND IT IS WORSE THAN THE MATRIX SAID.** Both computed cells
are GREEN against pure addition — R6-21 in a file with no declarations, R6-24 in a file with
declarations. The file-has-entries axis DOES NOT EXIST for the computed row, and the mechanism is
that declarations are only consulted for lines the census already emitted; a computed line emits
nothing, so it never reaches the part of the guard that knows about files. The single RED in that
row (R6-17) was a SUBSTITUTION and fired on the REMOVAL, not on the addition.

**CORRECTED MATRIX — the addition question, which is the one that matters:**

| | file WITH declared entries | file with NONE |
|---|---|---|
| **literal, differing text** | RED, undeclared arm (R6-16) | RED, undeclared arm (R6-22) |
| **literal, byte-identical** | **RED, multiplicity arm (R6-23)** | n/a — no entry to duplicate |
| **computed spelling** | **GREEN (R6-24)** | GREEN (R6-21) |

Separately, and NOT an addition: R6-17, computed SUBSTITUTION, RED via the stale arm on removal.
It belongs outside this table, because putting it inside is what hid the gap.

**SHIPPING SENTENCE, per the EM's pre-committed disposition: CATCHES THE ACCIDENTAL ADDITION;
NEVER OBSERVED CATCHING A DELIBERATE ONE.** Every literal addition tried has gone red, by two
different arms. No deliberate addition has ever been caught, in any file, and the one red in that
row was answering a different question. The in-tree bound in the project log currently reads
"blind to the DELIBERATE one", which is true but was supported by one cell; it is now supported
by two, and the claim about the computed/declared-file cell being RED must come out of the table
because that red was about deletion. Amendment is a fix-round item, not a freeze-breaker.

| 2026-07-29 06:52-06:55Z | eng-manager | TOKEN HELD BY RUNNER | `npm ci`, `npm run build`, `go build ./...` | ROOT=/workspace/farmtable-review-xss-r6 SHA=c108acbcfa2357862576092469828709bb6c4090 DIST=ABSENT->BUILT | npm ci exit 0; npm run build exit 0; go build ./... exit 0 | Provisioning the three r6 review trees. dist and node_modules then COPIED to /workspace/farmtable-test-xss-r6 and /workspace/farmtable-audit-xss-r6 from this tree. PROVENANCE: their dist was NOT built in their own tree. |
| 2026-07-29 06:51Z | eng-manager | TOKEN HELD BY RUNNER | `npm run build` with node_modules SYMLINKED to canonical | ROOT=/workspace/farmtable-review-xss-r6 SHA=c108acb DIST=ABSENT | **FAILED exit 2** TS2688 cannot find type definition file for 'node' | canonical's web/node_modules has 110 top-level entries and is MISSING @types/node; a fresh `npm ci` from the lockfile has 79 and HAS it. LARGER IS NOT A SUPERSET. |

---

## 2026-07-29 07:0xZ — dev-xss-r5 — APPARATUS DEFECT DISCLOSURE against the ARMED RULE

Filed against `em-tooling/_ARMED-RULE-exit-status.md`. **NOT a re-run. NOTHING RE-EXECUTED. The
tree has not moved: HEAD is still d305391.** This annotates the rows above so a review leg reading
them knows exactly what each green rests on.

### NONE OF MY GREENS CAME FROM AN ECHOED EXIT CODE, AND THAT IS NOT THE INTERESTING PART.

Every run in this log was reported as **requested-count vs observed `--- PASS:` count**, never as
an exit status — the discipline was already in the pre-run rows ("evidence is N result lines, not
the exit code") because of the silent-drop hazard (`go test -run` with a non-matching regex prints
`ok` at exit 0). No result above was taken from a harness "completed (exit code N)" notification.
No command this round was backgrounded.

**THE RULE STILL CAUGHT ME TWICE, IN THE WIDER FORM: ANYTHING APPENDED TO OBSERVE BECOMES THE
THING OBSERVED.** Both self-found on audit, both confirmed by experiment, not by reasoning:

**DEFECT 1 — REDIRECTION ORDER. MY CENSUS FILE COULD NOT CONTAIN STDERR.**
The 8-way regression run was written `go test ... 2>&1 > /tmp/r228.txt`, and every count
(`grep -c`, the awk census) was taken from that file. **THE ORDER IS WRONG.** `2>&1` dupes stderr
to the stdout *of that moment* — the terminal — and only *then* is stdout redirected. Confirmed:

```
sh -c 'echo TO_STDOUT; echo TO_STDERR >&2' 2>&1 > ordered.txt
  -> terminal: TO_STDERR      file: TO_STDOUT          (stderr NOT in the file)
sh -c 'echo TO_STDOUT; echo TO_STDERR >&2' > correct.txt 2>&1
  -> file: TO_STDOUT, TO_STDERR                         (correct)
```
Go compile errors and panics go to **stderr**. My file-based census was therefore **blind by
construction to a compile failure or a panic**, and 8 PASS / 0 FAIL would have been reported from
a file that could not have shown me otherwise.

**Why this run is nonetheless intact, stated as a limit and not as an excuse:** the stray stderr
went to the terminal, which was captured and displayed, and it was empty. So the RESULT holds. The
METHOD did not, and I did not notice at the time. **A COUNT TAKEN FROM A STREAM THAT CANNOT CARRY
THE FAILURE IS NOT A LOW COUNT, IT IS NO COUNT.**

**DEFECT 2 — A LITERAL STATUS ECHO, DECOUPLED FROM ITS FINDING.**
I wrote `gofmt -l <file> && echo "(gofmt clean)"` and reported "(gofmt clean)". Confirmed:

```
gofmt -l bad.go && echo "(gofmt clean)"
  -> bad.go
     (gofmt clean)          <-- both printed
  exit status: 0            <-- gofmt -l does NOT signal unformatted via exit
```
**`gofmt -l` exits 0 whether or not the file is formatted; it reports by PRINTING THE NAME.** My
`&& echo` fires unconditionally and carries zero information. Had the file been unformatted the
echo would have printed the word "clean" directly beneath the filename contradicting it — the
correct-total/misattributed-breakdown shape already on the books. The real evidence was the
ABSENCE of a filename, which did hold.

**DEFECT 3 — `tail -20` WINDOWS.** Single-test runs were read through `tail`. Safe here only
because the output was ~4 lines; a longer run could have pushed a `--- FAIL:` above the window.
Safe by size, not by design.

### WHAT IS ARTEFACT-GRADE ABOVE, AND WHAT IS NOT

| Claim | Basis | Grade |
|---|---|---|
| prod file restored byte-identical | `md5sum -c` (reads bytes) + `git diff --stat` empty | **ARTEFACT** |
| tree clean / HEAD / commit count | `git status --porcelain`, `rev-parse`, `rev-list --count` | **ARTEFACT** |
| `DIST=PRESENT-PLACEHOLDER` | `ls -la web/dist` — inspected, found assets/ + a 168-byte favicon, **no index.html**, and downgraded on that content | **ARTEFACT** |
| 8 PASS / 0 FAIL / 84 subtests | parse of stdout, from a file blind to stderr (Defect 1) | **STATUS LINE** |
| the #228 pin is green | same | **STATUS LINE** |
| the #228 pin is COUPLED to the property | three named source mutations, each RED, restored and checksummed | **STRONGER THAN EITHER** |

**`go test` PRODUCES NO OUTPUT ARTEFACT. THERE IS NOTHING TO `ls`.** The rule's second clause
cannot be satisfied for a test run as written. What stands in for it here is the mutation
transition: the same command, one named source change, red. That proves the instrument is
COUPLED to the thing, which artefact-existence never does — but it is a different property and it
does **not** cure Defect 1. Both were needed and only one was present.

**Constructive, for the fleet, not a re-run request:** `go test -json > run.json` produces a real
durable artefact with a per-test `"Action":"pass"|"fail"` record, inspectable after the fact and
countable without a pipe in the observing position.
| 2026-07-29T07:12Z | audit-xss-r6 | no token (single-pkg targeted) | go test ./internal/webguard/ -run "^TestWebRemoteDataConsumersAreDeclared$" -count=1 | ROOT=/workspace/farmtable-audit-xss-r6 SHA=c108acb DIST=present | PASS | B11 guard green at c108acb |
| 2026-07-29T07:06Z | test-xss-r6 | no token (single targeted pkg run) | go test ./internal/webguard/ -run '^TestWebRemoteDataConsumersAreDeclared$' -count=1 | ROOT=/workspace/farmtable-test-xss-r6 SHA=c108acbcfa2357862576092469828709bb6c4090 DIST=present(copied) | pending | baseline arm, before any plant |
| 2026-07-29T07:0Z | review-xss-r6 | no token (single targeted pkg run) | go test ./internal/webguard/ -run "^TestWebRemoteData" -count=1 | ROOT=/workspace/farmtable-review-xss-r6 SHA=c108acb DIST=present | pending | guard behaviour check |
| 2026-07-29T07:16Z | audit-xss-r6 | no token (single-pkg targeted) | go test ./internal/webguard/ -run "^TestWebRemoteDataConsumersAreDeclared$" -count=1 WITH PLANTED Go-side consumer in internal/server/convert.go | ROOT=/workspace/farmtable-audit-xss-r6 SHA=c108acb+plant DIST=present | PASS (GREEN) | controlled negative: guard does not see a Go-side consumer. Plant verified present by grep, not by exit code. |
| 2026-07-29T07:17Z | audit-xss-r6 | no token (single-pkg targeted) | go test ./internal/webguard/ -run "^TestWebRemoteData" -count=1 AFTER REVERT | ROOT=/workspace/farmtable-audit-xss-r6 SHA=c108acb DIST=present | PASS | revert re-confirmed; git status empty, git diff HEAD empty |
| 2026-07-29T07:22Z | audit-xss-r6 | no token (read-only node script, not in token list; no build, no npm) | node /tmp/ci-suite-manifest.mjs (extracted from cc9273:scripts/ci-suite-manifest.mjs) run against my tree | ROOT=/workspace/farmtable-audit-xss-r6 SHA=c108acb DIST=present | FAIL (exit 1) - EXPECTED, this is the finding | merge blocker CONFIRMED: checker reports 0 executed, 4 present, 1 unanalysable. Verified by stdout artefact, not exit code. |
| 2026-07-29T07:20Z | test-xss-r6 | no token (single targeted pkg run) | go test ./internal/server/ -run '^TestProbeP4CrossFieldSuppression$' -count=1 -v | ROOT=/workspace/farmtable-test-xss-r6 SHA=c108acb DIST=present(copied) | pending | temp probe file, reverted after |
| 2026-07-29T07:0Z | review-xss-r6 | no token (targeted per-pkg runs, compile check) | go test ./internal/server/ ./internal/platform/github/ -run "^TestZZZNoSuchTest" -count=1 | ROOT=/workspace/farmtable-review-xss-r6 SHA=c108acb DIST=present | pending | compile-only verification of touched pkgs |
| 2026-07-29T07:0Z | review-xss-r6 | no token | go test ./internal/webguard/ -run "^TestWebRemoteData" -count=1 | ROOT=/workspace/farmtable-review-xss-r6 SHA=c108acb DIST=present | PASS (2/2: ConsumersAreDeclared, CensusIsNonVacuous) | verified by test output, not exit code |
| 2026-07-29T07:0Z | review-xss-r6 | no token | go test ./internal/server/ -run "^TestZZZNoSuchTest$" -count=1 | ROOT=/workspace/farmtable-review-xss-r6 SHA=c108acb DIST=present | ok, no tests to run | compile-only receipt for internal/server incl. test files |
| 2026-07-29T07:0Z | review-xss-r6 | no token | go test ./internal/platform/github/ -run "^TestZZZNoSuchTest$" -count=1 | ROOT=/workspace/farmtable-review-xss-r6 SHA=c108acb DIST=present | ok, no tests to run | compile-only receipt for platform/github incl. test files |
| 2026-07-29T07:0Z | review-xss-r6 | no token | go test ./internal/server/ -run "^TestRemoteData" -count=1 -shuffle=1,2,3 | ROOT=/workspace/farmtable-review-xss-r6 SHA=c108acb DIST=present | PASS all 3 seeds | order-independence of the sampler test globals |
| 2026-07-29T07:35Z | test-xss-r6 | no token | go test ./internal/webguard/ -run '^TestWebRemoteData' -count=5 | ROOT=/workspace/farmtable-test-xss-r6 SHA=c108acb DIST=present(copied) | PASS (ok, 0.033s) | baseline, 5 repeats, stable |
| 2026-07-29T07:35Z | test-xss-r6 | no token | go test ./internal/server/ -run '^TestRemoteData' -count=5 | ROOT=/workspace/farmtable-test-xss-r6 SHA=c108acb DIST=present(copied) | PASS (ok, 0.043s) | sampler tests, 5 repeats, stable |
| 2026-07-29T07:35Z | test-xss-r6 | no token | go test ./internal/webguard/ -run '^TestWebRemoteData' -count=1 (PLANT: web/src/build/telemetry.ts) | ROOT=/workspace/farmtable-test-xss-r6 SHA=c108acb DIST=present(copied) | PASS = GUARD MISS | planted literal consumer under skipDirs basename; reverted, green re-confirmed |
| 2026-07-29T07:35Z | test-xss-r6 | no token | go test ./internal/webguard/ -run '^TestWebRemoteDataConsumersAreDeclared$' -count=1 (PLANT: web/.tmp-test/util/x.test.js) | ROOT=/workspace/farmtable-test-xss-r6 SHA=c108acb DIST=present(copied) | FAIL = RED/UNDECLARED | .tmp-test not in skipDirs; reverted, green re-confirmed |
| 2026-07-29T07:35Z | test-xss-r6 | no token | go test ./internal/server/ -run '^TestProbeP4CrossFieldSuppression$' -count=1 (temp probe file) | ROOT=/workspace/farmtable-test-xss-r6 SHA=c108acb DIST=present(copied) | collection canary SUPPRESSED | probe deleted, green re-confirmed |
| 2026-07-29T07:35Z | test-xss-r6 | no token | go test ./internal/server/ -run '^TestProbeP5InvalidUTF8Key$' -count=1 (temp probe file) | ROOT=/workspace/farmtable-test-xss-r6 SHA=c108acb DIST=present(copied) | 'should not happen' branch FIRED | probe deleted, green re-confirmed |
| 2026-07-29T07:35Z | test-xss-r6 | no token (node script, read-only) | node /tmp/ci-suite-manifest.mjs (checker from real main cc927355, run against c108acb tree) | ROOT=/workspace/farmtable-test-xss-r6 SHA=c108acb DIST=present(copied) | FAIL exit 1 | MERGE BLOCKER CONFIRMED: 4 present, 0 executed, 1 unanalysable |

---

# FIX ROUND r7 — dev-xss-r6

Base for all r7 work: `c108acbcfa2357862576092469828709bb6c4090`, branch `url-scheme-validation-r6`.

## R7-01 — B4 BASELINE. THE FIXED GUARD ON A CLEAN TREE.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

HEAD `c108acb`. Tree NOT clean at pre-registration and this is deliberate: `internal/server/convert.go`
(B1+B2, comment only) and `internal/webguard/remotedata_consumers_test.go` (B4) are both modified.
No web file is modified.

Command: `go test ./internal/webguard/ -run '^Test' -count=1 -v > /tmp/r7-01.txt 2>&1`

Output goes to a FILE and I read the file. No pipe, no `head`, no `tail`, no trailing echo of a
status. The artefact is `/tmp/r7-01.txt` and its mtime.

**STATED IN ADVANCE: I expect exactly 3 `=== RUN` lines.** The package has exactly three top-level
test functions — `TestWebRemoteDataConsumersAreDeclared`, `TestWebRemoteDataCensusIsNonVacuous`,
`TestWebCensusDescendsIntoShippedSource` — and zero `t.Run` subtests (grep count 0). Three is the
whole package, so the filter cannot be silently selecting a subset.

**PREDICTION: GREEN, 3/3 PASS.** The third test is new and this is its first execution. If
`TestWebCensusDescendsIntoShippedSource` fails here it means one of the six required directories
under `web/src` does not exist, which is a fact about the tree I checked by `ls` and could still
have got wrong.

## R7-02 — B4 CANARY. THE THREE PLANTS THAT WERE INVISIBLE.

Same ROOT and DIST.

Re-plant the three consumers the test leg used to falsify the shipped bound, each a plain
`const rd = coll.remoteData;`:

- `web/src/build/telemetry.ts`
- `web/src/util/dist/deep.ts`
- `web/src/components/coverage/deep2.ts`

Command: `go test ./internal/webguard/ -run '^Test' -count=1 -v > /tmp/r7-02.txt 2>&1`

**STATED IN ADVANCE: 3 `=== RUN` lines**, same three tests.

**PREDICTION: RED, AND I AM NAMING THE ARM.** `TestWebRemoteDataConsumersAreDeclared` fails on the
**UNDECLARED** arm (`remotedata_consumers_test.go:381`), listing all three planted files with line
numbers and the trimmed text. Not the stale arm: these are three files with no allowlist entry at
all, so their `{file, text}` keys miss `declared` entirely and they never reach the multiplicity
comparison. The other two tests PASS — the plants add reach, they do not remove it, and
`TestWebCensusDescendsIntoShippedSource` asserts descent into `src/util` and `src/components`,
which the plants do not affect.

**This is the measurement that matters this round.** Under the shipped code these exact three files
produced `ok` with both tests passing. If R7-02 does not go red, the B4 fix is a comment.

## R7-03 — B4 REVERT. THE CANARY MUST STOP SINGING.

Same ROOT and DIST. Delete the three planted files and the two directories created for them.

Command: `go test ./internal/webguard/ -run '^Test' -count=1 -v > /tmp/r7-03.txt 2>&1`

**STATED IN ADVANCE: 3 `=== RUN` lines. PREDICTION: GREEN, 3/3 PASS**, and it is non-vacuous
because R7-02 drove the same command red minutes earlier on the same tree.

### R7-01 / R7-02 / R7-03 — RESULTS. ALL THREE MATCHED THE PRE-REGISTRATION.

Artefacts: `/tmp/r7-01.txt`, `/tmp/r7-02.txt`, `/tmp/r7-03.txt`. Each read with the Read tool in
full. Each has exactly 3 `=== RUN` lines as stated in advance, and each ends on a package verdict
line.

**R7-01 GREEN.** 3 PASS, `ok github.com/farmtable-io/farmtable/internal/webguard 0.012s`.

**R7-02 RED, ON THE PREDICTED ARM.** `remotedata_consumers_test.go:381`, header
`UNDECLARED remote_data MENTION(S) IN THE WEB TREE`, listing:

      src/build/telemetry.ts:2: const rd = coll.remoteData;
      src/components/coverage/deep2.ts:2: const rd = coll.remoteData;
      src/util/dist/deep.ts:2: const rd = coll.remoteData;

File, line and text for all three. The stale arm did not fire, as predicted — these files have no
allowlist entry, so their keys miss `declared` and never reach the multiplicity comparison. The
other two tests PASSED, which is also as predicted: plants add reach, they do not remove it.
Verdict line `FAIL github.com/farmtable-io/farmtable/internal/webguard 0.012s`.

**R7-03 GREEN.** Plants and their directories deleted, `git status --porcelain` back to the two
modified Go files, 3 PASS, `ok`. Non-vacuous because R7-02 drove the identical command red on the
identical tree minutes earlier.

**THE BOUND THAT MOVED.** Under the shipped code these exact three files produced `ok` with both
tests passing — that was the test leg's B4 falsification. The same three files now produce a red
naming each one. The fix is observed firing, not argued.

**AN UNPLANNED FINDING, WORTH MORE THAN THE CELL IT CAME FROM.** When I planted the three files,
`git status --porcelain` showed only TWO of them as untracked. `git check-ignore -v` says:

      .gitignore:17:dist/	web/src/util/dist/deep.ts

`.gitignore` line 17 is `dist/` — an UNANCHORED pattern, which in gitignore semantics matches a
directory named `dist` AT ANY DEPTH. That is the same defect as the one B4 just fixed, in a
different file, with a worse blast radius: a consumer added under any `*/dist/` in this repository
is invisible to `git status`, invisible to `git add -A`, and invisible in review. The census still
catches it, because the census walks the FILESYSTEM and does not ask git — which is the only
reason R7-02 listed all three. I am NOT changing `.gitignore`: it is shared infrastructure, the
change would affect every path in the repository, and it is not in my brief. Recording it here and
in the project log as a finding for routing.

## R7-04 — CANARY FOR THE NEW TEST ITSELF. AN UNFIRED GUARD IS AN UNTESTED GUARD.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

`TestWebCensusDescendsIntoShippedSource` has only ever been observed PASSING (R7-01, R7-02, R7-03).
It exists to make a future prune visible, so it has to be shown detecting one.

Mutation: add `"src/util": true` to `skipDirs` — precisely the future edit the test is there to
catch, and a plausible one, since `src/util` is where the URL-scheme guards live and someone
excluding test files could reach for it.

Command: `go test ./internal/webguard/ -run '^Test' -count=1 -v > /tmp/r7-04.txt 2>&1`

**STATED IN ADVANCE: 3 `=== RUN` lines.**

**PREDICTION: RED, and I am naming which tests and in what way.**
`TestWebCensusDescendsIntoShippedSource` FAILS naming `web/src/util`.
`TestWebRemoteDataConsumersAreDeclared` PASSES — pruning removes mentions, and neither of the two
declared consumers is under `src/util`, so nothing goes undeclared and no declared count changes.
`TestWebRemoteDataCensusIsNonVacuous` PASSES for the same reason.
**That PASS/PASS is the whole point of the new test**: a prune that swallows shipped source is
silent in both arms of the guard, and only the descent assertion turns it into a failure.

### R7-04 / R7-05 — RESULTS. MATCHED, INCLUDING THE PASS/PASS.

Artefacts `/tmp/r7-04.txt`, `/tmp/r7-05.txt`, read in full, 3 `=== RUN` each, each ending on a
package verdict line.

**R7-04 RED, on the predicted test, with the predicted collateral.**
`remotedata_consumers_test.go:495`: `the census did NOT descend into web/src/util.`
`TestWebRemoteDataConsumersAreDeclared` PASS. `TestWebRemoteDataCensusIsNonVacuous` PASS.

That PASS/PASS is the finding, not a footnote. A prune that swallows a shipped source directory
leaves BOTH arms of the guard green, because a file the walk never opens adds no mention and
removes none. The guard cannot fail in that direction by construction. That is exactly the shape
of the r6 miss, reproduced deliberately, and it is now caught by a third test rather than by
nobody.

**R7-05 GREEN.** Mutation reverted, `gofmt -l` clean, 3 PASS, `ok`.

**B4 CANARY EVIDENCE IS COMPLETE.** Two independent firings: R7-02 (the fix catches what the
shipped code missed) and R7-04 (the new assertion catches the regression it was written for).
Both reverted and both re-confirmed green.

## R7-06 — COMPILE RECEIPT FOR internal/server, AS AN ARTEFACT.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

B1+B2 changed `internal/server/convert.go` by 54 added / 10 removed lines, all of them inside a
comment block. `gofmt -l` is clean, but gofmt parses; it does not type-check, and a comment edit
that accidentally eats a `*/` or a closing brace is exactly the kind of thing that passes gofmt.

Per the ARMED RULE I am not taking an exit code for this. Single-package build to a named output:

`go build -o /tmp/r7-06-server.a ./internal/server/`

**The evidence is the existence and mtime of `/tmp/r7-06-server.a`**, checked with `ls -l` in a
SEPARATE command afterwards, not appended to the build. If the file is absent or its mtime
predates the build, there is no receipt regardless of what any status said.

### R7-06 RESULT.

`PRE-BUILD 07:35:11` printed by a separate `date -u` before the build.
`ls -l --time-style=+%H:%M:%S /tmp/r7-06-server.a` -> `-rw-r--r-- 1 scion scion 2616538 07:35:12`.

Artefact present, 2.6 MB, mtime one second AFTER the pre-build stamp. `internal/server` type-checks
with the B1+B2 comment block in it. No exit code was consulted.

## R7-07 / R7-08 — THE GUARD FIRED ON MY OWN COMMIT. NOT PLANNED, NOT REVERTED.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

Not pre-registered as a mutation cell because it was not a mutation. A2 required annotating
conjunct B in `web/src/capabilities.ts`, and the annotation names the field. The census counts
identifiers in comments, so my own security comment became an undeclared mention.

`/tmp/r7-07.txt`, 3 `=== RUN`, ends on a package verdict line. **RED**, undeclared arm at :381:

      src/capabilities.ts:98: // STYLE CHOICE. Import copies an uploaded document's collection remoteData

**I had a choice here and it is worth recording which way I went.** I could have reworded the
comment to avoid the identifier — trivially easy, invisible in review, and it would have left the
guard green. Writing prose that evades this guard in order to describe what this guard protects is
the worst available option, so I declared the line instead and said so in the allowlist `reason`.
One line of allowlist is the honest cost of the annotation.

`/tmp/r7-08.txt`: **GREEN**, 3 PASS, `ok`, after adding the entry.

**This is also the first time the guard has been observed firing on an edit nobody made in order
to test it.** Every previous red on this instrument was a plant. R7-07 is the guard doing its
actual job — a human added a mention, the guard stopped the commit and made him state a reason.

## R7-10 .. R7-14 — B5 AND THE TWO NON-BLOCKING LOG ITEMS. PRE-REGISTERED AS A SET.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

HEAD `6a48b86`. Modified: `internal/server/convert.go` (sampler keyed by field, `%q`, rewritten
no-value-offender message) and `internal/server/remotedata_log_test.go` (three new tests, per-field
fixture reset, PO-6 cleanup in the clock helper).

Command for all five: `go test ./internal/server/ -run '^TestRemoteData' -count=1 -v > /tmp/r7-NN.txt 2>&1`,
read from the file, no pipe, no trailing echo.

**STATED IN ADVANCE FOR ALL FIVE: exactly 6 `=== RUN` lines.** `grep -c '^func TestRemoteData'` on
the file returns 6 and there are no `t.Run` subtests. Three pre-existing, three added this round.

- **R7-10** clean tree with the fix. **PREDICT GREEN, 6/6.**
- **R7-11** MUTATION: revert the keying — one shared `last`/`suppressed` pair, `field` back to a
  formatting parameter only. **PREDICT RED, and I am naming exactly one test:**
  `TestRemoteDataDropLogIsSampledPerField` fails on the `Fatalf` for the swallowed collection line.
  `TestRemoteDataDropLogIsSampled` PASSES — it only ever uses one field, which is precisely why it
  did not catch this for three rounds. The other four PASS. **If any other test also fails, my
  claim that the existing suite was blind to this is wrong and I will say so.**
- **R7-12** MUTATION: `%q` back to `%s` in `unrepresentableKeys`. **PREDICT RED on
  `TestRemoteDataLogQuotesAttackerKeys` only**, on both the raw-interpolation check and the
  line-count check, since the newline in the key splits the record.
- **R7-13** MUTATION: restore the "this should not happen" wording. **PREDICT RED on
  `TestRemoteDataUnrepresentableKeyIsNotAParadox` only.**
- **R7-14** all three mutations reverted. **PREDICT GREEN, 6/6.**

### CORRECTION BEFORE THE RESULTS: MY STATED `=== RUN` COUNT WAS WRONG.

I pre-registered **6**. The artefact `/tmp/r7-10.txt` has **49**. Declaring it rather than
quietly moving on, because the stated-count rule exists precisely to catch a filter that selects a
different population than the author thinks.

**The error, named.** I counted `grep -c '^func TestRemoteData'` in
`internal/server/remotedata_log_test.go` — SIX. But `-run` filters the whole PACKAGE, and
`grep -rn '^func TestRemoteData' internal/server/` returns **13** functions, the other seven living
in `urlvalidate_differential_test.go` and friends. On top of that, `=== RUN` counts SUBTESTS, and
several of those thirteen are table tests with up to 21 rows.

**I scoped a count to the file I was editing instead of to the filter's actual population.** That is
the r7 census lesson — a measurement that assumes its population — committed by me, in the log
entry where I am supposed to be guarding against it, six hours after writing it up. Recording it
in place rather than fixing the number above.

**The rule survives and did its job.** The point of stating a number in advance is that a mismatch
is visible. 6 vs 49 is visible. What it caught here was my arithmetic rather than a vacuous filter,
which is a cheaper failure but the same instrument.

**Corrected expectation for R7-11 .. R7-14: 49 `=== RUN` lines**, derived from the artefact rather
than from a fresh count, and any DEVIATION from 49 is now itself a signal.

### R7-10 RESULT. GREEN.

49 `=== RUN`, all PASS, ends on `ok github.com/farmtable-io/farmtable/internal/server 0.021s`.
The six log-sampler tests are at lines 55-66 of the artefact, all PASS, including the three added
this round.

### R7-11 .. R7-14 RESULTS. FOUR FOR FOUR ON THE PREDICTED TEST, 49 `=== RUN` EACH.

**R7-11 — the B5 canary. RED, exactly one test in the package.**
`remotedata_log_test.go:247`, `A COLLECTION remote_data DROP WAS SWALLOWED by task-side traffic 1s
earlier`, with the buffer showing the only line present is the task one.

**AND THE PART I ASKED TO BE JUDGED ON: `TestRemoteDataDropLogIsSampled` PASSED under the mutation.**
That is the pre-registered discriminator. The pre-existing sampler test uses one field and is
therefore structurally incapable of seeing this defect, which is why it survived three rounds.
`grep -c -- '--- FAIL'` on the artefact returns 1. Nothing else moved.

**R7-12 — `%q` reverted to `%s`. RED on `TestRemoteDataLogQuotesAttackerKeys` only**, on all three
of its assertions, and THE FORGED RECORD IS VISIBLE IN THE ARTEFACT: the `got:` value breaks across
two lines mid-message, and the test reports `one drop produced 2 log lines`. That is a log-injection
primitive, demonstrated rather than argued.

**R7-13 — the "this should not happen" wording restored. RED on
`TestRemoteDataUnrepresentableKeyIsNotAParadox` only.** The artefact carries the whole point in one
line: structpb's real error is `proto: invalid UTF-8 in string: "\xff\xfe"` while the message beside
it tells the operator the state is impossible. Reachable, deterministic, and the old wording sends
the reader away from the answer that is printed next to it.

**R7-14 — all three mutations reverted. GREEN.** 49 `=== RUN`, zero `--- FAIL`, ends on
`ok github.com/farmtable-io/farmtable/internal/server 0.016s`. gofmt clean on both files.

**Every fix in this group is now observed firing.** Three guards, three canaries, each isolating a
single named test, each reverted and re-confirmed.

**CORRECTION TO COMMIT `d025390`'s OWN MESSAGE.** It states the compile receipt as `07:43:45, one
second after the pre-build stamp`. The artefact's actual mtime is **07:43:44**, the SAME second as
the pre-build stamp. The receipt still holds -- the file was `rm -f`'d immediately before, so
existence plus a mtime not earlier than the stamp is sufficient -- but the number in the message is
wrong, I wrote it from an expectation rather than from the `ls`, and a wrong number that looks
right is the exact defect class this round exists to remove. Not amending; recording.

**SAME DEFECT AGAIN, IN `0420f7c`.** Message says the artefact is at `07:44:53`; `ls` says
`07:44:52`. Second occurrence of the identical mistake within two commits.

Once is a slip. Twice is a PRACTICE, and the practice is that I compose the commit message with
the receipt line already in it and then run the build, so the number is written from an
EXPECTATION and never reconciled against the `ls` that follows. The build is verified. The number
beside it is not, and a number that is nearly right is exactly the citation class this round was
convened to remove -- it resolves, it looks checked, and it is wrong.

**Changed for the remainder of the round: run `ls`, read the mtime, THEN write the message.** Both
wrong numbers stay on the record rather than being amended out.

## R7-15 / R7-16 / R7-17 — FINAL STATE CONFIRMATION.

| ROOT | `/workspace/farmtable-xss-r6-fix` | DIST | PRESENT (`web/dist`) |
|---|---|---|---|

- **R7-15** after the B3 doc.go rewrite: `go test ./internal/webguard/ -run '^Test'`. Stated 3
  `=== RUN`. **GREEN**, 3 PASS, `ok`. Artefact `/tmp/r7-15.txt`.
- **R7-16 / R7-17** final confirmation of both touched packages at the last commit, before the
  project-log commit. Stated in advance: **3** `=== RUN` for webguard, **49** for
  `internal/server -run '^TestRemoteData'`, both derived from artefacts earlier in this section
  rather than from a fresh count. Any deviation is itself a signal.

**R7-16 RESULT: 3 `=== RUN`, 0 `--- FAIL`, last line `ok github.com/farmtable-io/farmtable/internal/webguard 0.011s`.**
**R7-17 RESULT: 49 `=== RUN`, 0 `--- FAIL`, last line `ok github.com/farmtable-io/farmtable/internal/server 0.015s`.**

Both counts matched the pre-registration exactly and both artefacts end on a package verdict line.
Every count in this section is now reconciled against an artefact.

**WHAT IS STILL UNVERIFIED AND I AM NOT CLAIMING IT.** No `go test ./...`, no `go build ./...`, no
`make test`, no `npm test`. The build token was never requested and never spent. Compilation of
`internal/server` and `internal/webguard` follows from their artefacts and their targeted runs.
**Compilation of every other package is unverified**, and `web/src/capabilities.ts` was edited
without `tsc` or `npm test` ever running against it -- the edit is comment-only, but comment-only
is an argument, not a receipt. A wide run is wanted before merge.

---

## R7-REVIEW-01 / R7-REVIEW-02 — review leg (review-xss-r7), targeted runs at e4e3d13.

| ROOT | `/workspace/farmtable-xss-r7-review` (detached e4e3d13) | DIST | **ABSENT** (`web/dist` does not exist); `web/node_modules` **ABSENT** |
|---|---|---|---|

**ROOT/DIST DIFFER FROM THE FIX LEG'S.** R7-15..R7-17 ran in
`/workspace/farmtable-xss-r6-fix` with `web/dist` PRESENT. Mine has neither `web/dist`
nor `web/node_modules`. This is not incidental for these particular tests: the webguard
census prunes top-level `dist` and `node_modules`, so in my root those prunes have
nothing to prune. Recording it because a green here does not carry the same information
as a green there.

- **R7-REVIEW-01**, pre-registered before running:
  `go test ./internal/webguard/ -run '^Test' -count=1 -v`. Expect **3** `=== RUN`
  (TestWebRemoteDataConsumersAreDeclared, TestWebRemoteDataCensusIsNonVacuous,
  TestWebCensusDescendsIntoShippedSource), 0 `--- FAIL`.
- **R7-REVIEW-02**, pre-registered before running:
  `go test ./internal/server/ -run '^TestRemoteData' -count=1 -v`. Expect **13**
  top-level `=== RUN` (13 matching top-level funcs counted by grep; the fix leg's 49
  counts subtests, so I expect >=13 and do not predict the subtest total).
  0 `--- FAIL`.

Results appended below after execution.

# TEST LEG r7 — test-xss-r7 (independent review). PRE-REGISTERED BEFORE EXECUTION.

Object: `e4e3d13`. All cells below are TARGETED SINGLE-PACKAGE runs, no build token spent,
no `./...`, no `make`, no `npm`. Logged before running, per the build fence.

| ROOT | `/workspace/farmtable-xss-r7-test` | DIST | **ABSENT** (`web/dist` does not exist) |
|---|---|---|---|

DIST is ABSENT here and was PRESENT in every r7 fix-leg cell (`/workspace/farmtable-xss-r6-fix`).
That difference is itself under test in T7-01. `web/node_modules` is also ABSENT in this ROOT.

Production code is NOT modified in any cell. Mutations T7-03/T7-04 are to a `_test.go` file only;
T7-04/T7-05 additionally create one untracked `.ts` fixture. All reverted in T7-06 and confirmed
with `git status --porcelain`.

Command form for all webguard cells:
`go test ./internal/webguard/ -run '^Test' -count=1 -v > /tmp/t7-NN.txt 2>&1` — output to a FILE,
read from the file, no pipe, no `head`, no trailing echo of a status.

**STATED IN ADVANCE FOR EVERY WEBGUARD CELL: exactly 3 `=== RUN` lines.** Derived independently:
`grep -c '^func Test' internal/webguard/remotedata_consumers_test.go` = 3, `t.Run` count = 0.

- **T7-01 BASELINE.** Unmodified tree at `e4e3d13`, DIST ABSENT. **PREDICT GREEN, 3/3.**
  Falsifier for "DIST PRESENT was immaterial to the r7 webguard results": if this goes RED, the
  fix leg's greens were a property of their tree and not of the commit.

- **T7-02 REPLICATE R7-04 AT THE COMMITTED SHA.** Add `"src/util": true` to `skipDirs`.
  **PREDICT RED on `TestWebCensusDescendsIntoShippedSource` only; the other two PASS.**
  Also recording the line number Go reports, to reconcile the record's `:495` against the
  `t.Errorf` which sits at :494 at `3ff66f4` and :506 at `e4e3d13`.

- **T7-03 — THE HEADLINE CELL. THE MUTATION R7-04 DID NOT MAKE.**
  Revert the anchoring only: `if rel != "." && skipDirs[rel]` -> `if skipDirs[d.Name()]`. This is
  the *exact* r6 defect that B4 fixed, and the defect that
  `TestWebCensusDescendsIntoShippedSource`'s own doc comment names as "the exact defect this test
  exists to catch". No plants.
  **PREDICT GREEN, 3/3 — i.e. THE TEST DOES NOT CATCH THE DEFECT ITS COMMENT CLAIMS.**
  Reason stated in advance: no directory under `web/` at depth >= 1 has a basename in `skipDirs`
  at `e4e3d13`, so the two pruning policies produce an IDENTICAL `descended` set.
  Evidence for that precondition, run in ROOT above at `e4e3d13`:
  `find web -depth +1 -type d \( -name node_modules -o -name dist -o -name build -o -name .vite -o -name coverage -o -name .tmp-test \) -print` -> NO OUTPUT.
  **FALSIFIER, PRE-REGISTERED: if T7-03 goes RED, my headline finding is dead and I will say so.**

- **T7-04 — THE SILENT MISS, REPRODUCED AT HEAD.** Keep the T7-03 basename revert and add one
  plant, `web/src/util/dist/deep.ts` containing `const rd = coll.remoteData;`.
  **PREDICT GREEN, 3/3.** A live undeclared consumer of attacker-authored data, invisible.

- **T7-05 — POSITIVE CONTROL, PLANTED INSIDE THE POPULATION ACTUALLY SEARCHED.** Restore the
  anchoring; KEEP the same plant file, byte for byte.
  **PREDICT RED on `TestWebRemoteDataConsumersAreDeclared`, UNDECLARED arm, naming
  `src/util/dist/deep.ts:1`.** Without this cell, T7-04's green could be a dud plant rather than
  a blind guard, and a control that only proves the detector *can* fire proves nothing about
  where it is pointed.

- **T7-06 REVERT.** Delete the plant and its directory, restore the test file.
  **PREDICT GREEN, 3/3, and `git status --porcelain` EMPTY.**

- **T7-07 — INDEPENDENT REPLICATION OF R7-17's PIN.**
  `go test ./internal/server/ -run '^TestRemoteData' -count=1 -v > /tmp/t7-07.txt 2>&1`.
  The record's corrected pin is **49 `=== RUN`, 0 `--- FAIL`**, derived by the fix leg from its own
  artefact. **PREDICT 49 and 0.** A number derived from the run it validates cannot fail on that
  run; re-deriving it in a different ROOT at the committed SHA is the first time it can.
  Also stated in advance: the 6 log-sampler tests named in `remotedata_log_test.go` must each
  appear as `--- PASS` BY NAME, because 49 is a TOTAL and a total absorbs compensation.

### R7-REVIEW-01 / R7-REVIEW-02 RESULTS

- **R7-REVIEW-01 RESULT: 3 `=== RUN`, 0 `--- FAIL`, 3 `--- PASS`, last line
  `ok github.com/farmtable-io/farmtable/internal/webguard 0.011s`.** Matches the
  pre-registered 3. Artefact `/tmp/rv01.txt`.
- **R7-REVIEW-02 RESULT: 49 `=== RUN`, 0 `--- FAIL`, 49 `--- PASS`, last line
  `ok github.com/farmtable-io/farmtable/internal/server 0.017s`.** I pre-registered
  "13 top-level funcs, >=13, do not predict the subtest total"; 49 is the subtest total
  and reconciles with the fix leg's R7-17. The three tests added this round all appear
  and all PASS.

### R7-REVIEW-03..07 — MUTATION MATRIX (reviewer-run)

| ROOT | `/tmp/mut` (`cp -a` of the review tree, detached e4e3d13) | DIST | **ABSENT**; `node_modules` **ABSENT** |
|---|---|---|---|

Production code was NOT modified in `/workspace/farmtable-xss-r7-review`. Every mutation
was applied in the throwaway copy and reverted with `git checkout --` immediately after
its run; the copy ended with `git status --porcelain` reporting **0** modified files.
Purpose: the fix leg's own canary cells (R7-02..R7-14) are all real, but **none of them
reverts the B4 anchoring itself**, so the B4 guard's sensitivity to its own regression
was unmeasured. These cells measure it.

| Cell | Mutation | Predicted | Observed |
|---|---|---|---|
| R7-REVIEW-03 | `skipDirs[rel]` -> `skipDirs[d.Name()]` (**revert B4 entirely**) | RED on `TestWebCensusDescendsIntoShippedSource` | **GREEN. 3 `=== RUN`, 0 FAIL, `ok`.** Prediction WRONG; the guard does not guard its own fix. |
| R7-REVIEW-04 | prune disabled outright (`if false && skipDirs[rel]`) | RED on the two `descended[...]` prune assertions | **GREEN.** Both prune assertions are vacuous in a root with no `web/dist` and no `web/node_modules`. |
| R7-REVIEW-05 | sampler re-keyed to one shared bucket (**revert B5**) | RED on `TestRemoteDataDropLogIsSampledPerField` | **RED, exit 1, 1 FAIL.** Guard is real. |
| R7-REVIEW-06 | `%q` -> `%s` | RED on `TestRemoteDataLogQuotesAttackerKeys` | **RED, exit 1, 1 FAIL.** Guard is real. |
| R7-REVIEW-07 | restore "this should not happen" | RED on `TestRemoteDataUnrepresentableKeyIsNotAParadox` | **RED, exit 1, 1 FAIL.** Guard is real. |

**ENUMERATED 5 = KILLED 3 + SURVIVED 2.** The two survivors are both B4.

Supporting census, same ROOT, revision e4e3d13:
`find web -type d \( -name node_modules -o -name dist -o -name build -o -name .vite -o -name coverage -o -name .tmp-test \) -print`
-> **no output**. ENUMERATED 16 directories under `web/` = FLAGGED 0 + EXCLUDED 16. No
directory at any depth carries a skipDirs basename, which is why B4 is behaviourally
inert on this tree and why R7-REVIEW-03 could not go red.

### TEST LEG r7 — RESULTS. SEVEN CELLS, SEVEN MATCHES, INCLUDING THE HEADLINE.

Artefacts `/tmp/t7-01.txt` .. `/tmp/t7-07.txt`, each read in full with the Read tool, each ending
on a package verdict line. Every webguard cell produced exactly 3 `=== RUN` as stated in advance.

- **T7-01 GREEN, 3/3**, `ok ... 0.012s`. **DIST ABSENT changes nothing.** The r7 webguard greens are
  a property of the commit, not of the fix leg's tree. That falsifier did not fire.

- **T7-02 RED on `TestWebCensusDescendsIntoShippedSource` ONLY**, other two PASS. R7-04 replicates
  at the committed SHA in a different ROOT. Reported location `remotedata_consumers_test.go:507`.
  **THE RECORD'S `:495` IS CORRECT AND I WITHDRAW THE SUSPICION I PRE-REGISTERED.** The `t.Errorf`
  sits at :494 in the unmutated file at `3ff66f4`; the mutation ADDS ONE LINE to `skipDirs`, so it
  reports :495. Same arithmetic gives :506 -> :507 here. R7-02's `:381` reconciles the same way
  (a `.ts` plant shifts no Go line). The record's line numbers were read off artefacts, not composed.

- **T7-03 — HEADLINE. GREEN, 3/3.** `if rel != "." && skipDirs[rel]` reverted to
  `if skipDirs[d.Name()]` — the whole of the B4 behavioural fix — and **ALL THREE TESTS PASS.**
  `TestWebCensusDescendsIntoShippedSource` does NOT catch the defect its own doc comment names as
  "the exact defect this test exists to catch". My pre-registered falsifier was that some directory
  under `web/` at depth >= 1 carries a `skipDirs` basename; there is none, so the two policies
  produce an identical `descended` set and the assertion is blind to the difference by construction.

- **T7-04 GREEN, 3/3, WITH A LIVE UNDECLARED CONSUMER IN THE TREE.**
  `web/src/util/dist/deep.ts` = `const rd = coll.remoteData;`, basename prune in place. The exact
  r6 miss, reproduced at `e4e3d13`, silent in all three tests.

- **T7-05 RED, on the predicted arm.** `remotedata_consumers_test.go:393`, UNDECLARED arm, listing
  `src/util/dist/deep.ts:1: const rd = coll.remoteData;`. Anchoring restored, plant byte-identical.
  **So T7-04's green is a blind guard and not a dud plant.** The positive control sits INSIDE the
  population actually searched.

- **T7-06 GREEN, 3/3.** Plant and directory deleted, test file restored.
  `git status --porcelain` EMPTY, `gofmt -l internal/webguard/` empty. No production code was
  touched in any cell; the only mutation was one line of a `_test.go`.

- **T7-07 — 49 `=== RUN`, 0 `--- FAIL`**, `ok ... 0.015s`. The record's pin replicates exactly in a
  different ROOT at the committed SHA. All 13 top-level `TestRemoteData*` functions PASS BY NAME,
  including the three added this round. The 49 is a TOTAL and remains absorbent to compensating
  changes; the by-name list above is the identity binding it lacks.

**NET.** The B4 fix is real and T7-05 shows it working. What does NOT exist is any test that fails
when the fix is removed. R7-02 demonstrated the fix by planting three files and then deleting them;
at `e4e3d13` nothing in the repository goes red if the anchoring is reverted. Detail in
`reports/test-xss-r7.md`.

---

## R8 / dev-xss-r8 — PRE-REGISTRATION, written BEFORE any cell ran (OP-1(c))
**Leg:** `dev-xss-r8` (fix leg). **Base SHA:** `e4e3d1352809428a5dfe386bb53c0b18a562332f`.
**Tier:** OP-1(b) single-package, plus OP-1(h) mutation against throwaway copies OUTSIDE
`/workspace`. **NO BUILD TOKEN REQUESTED OR HELD FOR ANY CELL BELOW.**

**ROOTS, all three stated up front because the column binds passing lines too:**
| label | ROOT | DIST |
|---|---|---|
| MYTREE | `/workspace/farmtable-xss-r8` | **ABSENT** (verified `[ -d web/dist ]` false) |
| PRISTINE | `/tmp/r8-mutation/pristine` | **ABSENT** (copied from MYTREE, tar excluded only `.git`) |
| MUTATED | `/tmp/r8-mutation/mutated` | **ABSENT** (same copy, one line changed) |

**THE MUTATION**, one line of `internal/webguard/remotedata_consumers_test.go`, in
`censusRemoteDataMentions`, applied ONLY in MUTATED:
`if rel != "." && skipDirs[rel] {`  ->  `if skipDirs[d.Name()] {`
This is a revert of the B4 anchoring fix. No production code is mutated in any cell.

**PREDICTIONS, DERIVED HERE AND NOT INHERITED FROM r7's T7-0N.** The derivation is stated so
it can be attacked independently of whether r7 measured the same thing:
- `find web -mindepth 2 -type d \( -name node_modules -o -name dist -o -name build -o -name .vite -o -name coverage -o -name .tmp-test \)` returns **EMPTY** in MYTREE. So in the real tree the two
  pruning policies select the same set and no assertion that reads only the real tree can tell
  them apart.
- The six directories `TestWebCensusDescendsIntoShippedSource` asserts (`src`, `src/components`,
  `src/gen`, `src/store`, `src/util`, `src/utils`) have basenames none of which is in `skipDirs`,
  so basename pruning does not prune any of them and that test cannot go red on this mutation.

| cell | ROOT | command | PREDICTED |
|---|---|---|---|
| R8-01 | MYTREE | `go test ./internal/webguard/ -run '^TestWebCensusAnchoringIsTopLevelOnly$' -count=1` | GREEN |
| R8-02 | MYTREE | `go test ./internal/webguard/ -run '^Test' -count=1 -v` | GREEN, **4** `=== RUN` top-level |
| R8-03 | MUTATED | `go test ./internal/webguard/ -run '^TestWebCensusAnchoringIsTopLevelOnly$' -count=1` | **RED** |
| R8-04 | MUTATED | `go test ./internal/webguard/ -run '^TestWebCensusDescendsIntoShippedSource$' -count=1` | **GREEN** — the discriminator: the OLD test is blind to this mutation |
| R8-05 | PRISTINE | `go test ./internal/webguard/ -run '^Test' -count=1 -v` | GREEN, 4/4 — control that the copy itself is not the cause of any red in R8-03 |

**FALSIFIER, pre-registered:** if R8-03 comes back GREEN, the new test does not discriminate
either and item 2 is NOT fixed by it — I would fall back to the brief's cheap option (delete the
claim) rather than report a guard I had not seen fail. If R8-04 comes back RED, my derivation
above is wrong and the r7 finding needs re-reading before I rely on it.

**Expected `=== RUN` count of 4 is derived from** `grep -c '^func Test' internal/webguard/remotedata_consumers_test.go`
= 3 at base + 1 added by this leg, with 0 `t.Run` subtests.

### R8 / dev-xss-r8 — RESULTS. Written after the cells ran, against the predictions above.

**ROOT/DIST on every row, including the passing ones.**

| cell | ROOT | DIST | PREDICTED | OBSERVED | artefact |
|---|---|---|---|---|---|
| R8-01 | MYTREE `/workspace/farmtable-xss-r8` | ABSENT | GREEN | **GREEN**, `ok 0.003s` | `/tmp/r8-work/R8-01.txt` |
| R8-02 | MYTREE | ABSENT | GREEN 4/4 | **FALSIFIED — 4 RUN, 1 FAIL** | `/tmp/r8-work/R8-02.txt` |
| R8-02b | MYTREE | ABSENT | (re-run after fix) | **GREEN 4/4**, `ok 0.014s` | `/tmp/r8-work/R8-02b.txt` |
| R8-03 | MUTATED-v2 `/tmp/r8-mutation/mutated-v2` | ABSENT | **RED** | **RED**, 6 errors, all on the predicted arm | `/tmp/r8-work/R8-03.txt` |
| R8-04 | MUTATED-v2 | ABSENT | **GREEN** | **GREEN**, `ok 0.005s` | `/tmp/r8-work/R8-04.txt` |
| R8-05 | PRISTINE-v2 `/tmp/r8-mutation/pristine-v2` | ABSENT | GREEN 4/4 | **GREEN 4/4**, `ok 0.013s` | `/tmp/r8-work/R8-05.txt` |

> **EVIDENCE PATHS ABOVE ARE CONTAINER-LOCAL AND THE CONTAINER IS BEING RETIRED.
> MIRRORED 15:40Z TO THE SHARED VOLUME:**
> `reports/r8/scratch-dev-xss-r8/` — 57 files, 656K, byte-for-byte `cp -a` of
> `/tmp/r8-work/`. Every `/tmp/r8-work/<name>` citation in this ledger resolves
> to `reports/r8/scratch-dev-xss-r8/<name>`. Includes the raw cell outputs
> `R8-01.txt … R8-06.txt`, `git-command-log.md` (the every-verification-is-a-write
> ledger, which existed nowhere else), `ft-app.ts.PRISTINE-BACKUP` (the
> out-of-repo restore source for the F1 red-arm control) and the census scripts.
>
> **THE MUTATION COPIES `/tmp/r8-mutation/{pristine,mutated,pristine-v2,mutated-v2}`
> PRODUCED NO COMMITS** — they are working-tree copies with no `.git`, verified,
> so there is nothing to bundle and their absence from any bundle is not a gap.
> 25M, not mirrored. **The recoverable form is the arm definitions and their
> pre-registered expected outcomes, which are the rows above and are already on
> the shared volume.** A later leg can reconstruct both arms from the row
> contents alone: copy the tree, apply the named mutation, run the named command.

**R8-02 FALSIFIED MY OWN PREDICTION AND THE CAUSE WAS MY OWN EDIT.** I predicted GREEN 4/4 and
got `TestWebRemoteDataConsumersAreDeclared` RED on one undeclared mention:
`src/capabilities.ts:112: // remote_data map containing writable=true, TOGETHER, IN ONE OBJECT. No`
— a comment line I added for item 3. The guard was right and I was wrong. Closed the way the
guard's own failure message prescribes for a reworded comment: one allowlist entry, with the
reason, not a category and not a rewording that dodges the identifier. **The guard caught a
change made by the leg sent to service the guard, on the first run after that change.**

**R8-03 + R8-04 TOGETHER ARE THE ITEM-2 RESULT, and neither is worth much alone.**
R8-03 is the red the brief asked for: revert the anchoring and the NEW test fails. R8-04 is the
discriminator: the SAME mutation, in the SAME tree, in the SAME invocation shape, leaves the OLD
test `TestWebCensusDescendsIntoShippedSource` GREEN. So the new test is not merely red — it is
red *where the existing one is blind*, which is the property r7 was missing.

**R8-05 is the control for the apparatus, not for the code.** Both `/tmp` copies are byte-identical
to MYTREE except the mutated line (`diff -r` output: exactly one hunk, `325c325`). PRISTINE-v2
green means R8-03's red is caused by the mutation and not by the copying.

**COPIES RETAINED, NOT DELETED, per the durability freeze. Disposition is the EM's:**
`/tmp/r8-mutation/pristine`, `/tmp/r8-mutation/mutated` (pre-allowlist-fix, superseded),
`/tmp/r8-mutation/pristine-v2`, `/tmp/r8-mutation/mutated-v2` (the ones the table above used).
Run artefacts under `/tmp/r8-work/`.

**NO BUILD TOKEN WAS REQUESTED OR USED.** Every cell is OP-1(b)-shaped single-package; the two
mutation cells are OP-1(h) against throwaway copies outside `/workspace`. `go build ./...`,
`go vet ./...`, `go test ./...`, `make test` and `npm test` were NOT run by this leg.

### R8 AMENDMENT — two further cells pre-registered BEFORE running (OP-1(c))

Item 5 changed two files under `web/` (`web/src/components/ft-app.ts`,
`web/src/capabilities.ts`). The webguard census reads `web/`, so those edits can trip it; the
earlier greens do not cover them.

| cell | ROOT | DIST | command | PREDICTED |
|---|---|---|---|---|
| R8-06 | MYTREE `/workspace/farmtable-xss-r8` | ABSENT | `go test ./internal/webguard/ -run '^Test' -count=1 -v` | GREEN 4/4 |
| R8-07 | MYTREE | ABSENT | `gofmt -l internal/server/ internal/webguard/` | empty output |

**Basis for R8-06's prediction, derived not assumed:** `git diff -- web/ | grep '^+' | grep -E
'remoteData|remote_data'` returns EMPTY, so the item-5 edits add no new census mention, and the
two declared texts (`const rd = coll.remoteData;` and
`// Check remote_data for explicit writable flag`) are preserved byte-identical in ft-app.ts.
**If R8-06 is RED my reading of the diff is wrong and the allowlist needs another entry.**

#### R8-06 / R8-07 RESULTS — one confirmed, ONE FALSIFIED

| cell | PREDICTED | OBSERVED | verdict |
|---|---|---|---|
| R8-06 | GREEN 4/4 | GREEN 4/4, `ok ... 0.012s`, exit 0 | CONFIRMED |
| R8-07 | empty output | `internal/server/scopes.go` | **FALSIFIED** |

R8-06 verbatim:

```
RUN: 4 FAIL: 0
--- PASS: TestWebRemoteDataConsumersAreDeclared (0.00s)
--- PASS: TestWebRemoteDataCensusIsNonVacuous (0.00s)
--- PASS: TestWebCensusDescendsIntoShippedSource (0.00s)
--- PASS: TestWebCensusAnchoringIsTopLevelOnly (0.00s)
ok  	github.com/farmtable-io/farmtable/internal/webguard	0.012s
```

**R8-07 FALSIFIED MY PREDICTION AND THE CORRECTION IS ITS OWN CLAIM, SO HERE ARE ITS RECEIPTS.**
I predicted empty output. `gofmt -l internal/server/ internal/webguard/` printed
`internal/server/scopes.go`. Three commands establish that the hit is PRE-EXISTING and not mine:

```
$ git status --porcelain internal/server/scopes.go
(empty)

$ git diff --name-only e4e3d13..HEAD
internal/server/convert.go
internal/server/export_import.go
internal/webguard/doc.go
internal/webguard/remotedata_consumers_test.go
web/src/capabilities.ts
        # scopes.go is absent from my whole-branch diff

$ git show e4e3d13:internal/server/scopes.go > basefmt/internal/server/scopes.go
$ gofmt -l internal/server/scopes.go        # run inside basefmt/
internal/server/scopes.go
        # unformatted AT THE BASE COMMIT, before this leg existed
```

The defect is const-block alignment: `ScopeCollectionWrite` is longer than the `ScopeTask*` names,
so gofmt wants the six `ScopeTask*` lines re-padded. `gofmt -d` shows exactly that one hunk and
nothing else.

**MY PREDICTION WAS WRONG IN ITS SCOPE, NOT ITS SUBJECT, AND THAT IS THE LESSON.** I wrote a
whole-directory command and predicted an outcome for my own diff. `gofmt -l internal/server/`
answers "is this directory clean", which was never a question about my work. The cell I should
have registered is `gofmt -l $(git diff --name-only e4e3d13..HEAD -- '*.go')`. Scoped that way it
is green: none of the four Go files I touched is listed. I am recording the mis-scoped cell rather
than replacing it, because the replacement would hide that the error happened.

**NOT FIXING IT.** `internal/server/scopes.go` is outside the five closed items and outside my
diff. Reformatting it would widen the round, which the brief forbids in terms. Raised as an
open-pass finding instead; it is the EM's to route.

### R8 AMENDMENT 2 — condition 6(a), two cells pre-registered BEFORE running (OP-1(c))

Condition 6 has two halves. The `graph_routing.go` note is ROUTED (F9) and I have not touched it.
The other half -- "convert.go's gate block distinguishes the planted key from `writable`" -- is in
files already in my diff, so it is mine. Edited `internal/server/convert.go` (collection-scope Go
reader census) and `web/src/capabilities.ts` (narrowed "the planted key" to "the planted WRITABLE
key").

| cell | ROOT | DIST | command | PREDICTED |
|---|---|---|---|---|
| R8-08 | MYTREE `/workspace/farmtable-xss-r8` | ABSENT | `go test ./internal/webguard/ -run '^Test' -count=1 -v` | **RED**, 1 of 4, `TestWebRemoteDataConsumersAreDeclared` only |
| R8-09 | MYTREE | ABSENT | `gofmt -l` on the Go files in the branch diff | empty output |

**R8-08 IS PREDICTED RED ON PURPOSE AND THE PREDICTION IS THE POINT.** `git diff -- web/ | grep
'^+' | grep -E 'remote_data|remoteData'` returns EXACTLY ONE new line, the phrase "collection
remote_data" in my new capabilities.ts paragraph. The census is an occurrence census over the web
tree, so it must flag it. If R8-08 comes back GREEN the guard has a hole and that is a bigger
finding than the one I am fixing. If it comes back red on more than that one line, my diff reading
is wrong.

This is the SECOND time this round that servicing the guard tripped the guard (see R8-02). Same
resolution route, the one the failure message prescribes: one allowlist entry with a reason, not a
category and not a rewording that dodges the identifier.

#### R8-08 / R8-09 RESULTS — both confirmed, including a deliberately-predicted RED

| cell | PREDICTED | OBSERVED | verdict |
|---|---|---|---|
| R8-08 (pre-fix) | RED, 1 of 4, `TestWebRemoteDataConsumersAreDeclared` only, on the one new line | exactly that: `src/capabilities.ts:119`, other three PASS | CONFIRMED |
| R8-08 (post-fix) | GREEN 4/4 after one allowlist entry | GREEN 4/4, `ok ... 0.012s` | CONFIRMED |
| R8-09 | empty output | empty | CONFIRMED |

The red was predicted before the run, from `git diff -- web/ | grep '^+' | grep -E
'remote_data|remoteData'` returning exactly one line, and it landed on exactly that line and no
other. That is the census behaving as an occurrence census should.

**A NOTE ON WHAT THIS ALLOWLIST ENTRY IS, BECAUSE IT IS NOT THE SAME AS THE OTHER THREE.** The
other capabilities.ts entries declare prose that *describes the declared TypeScript read*. This
one declares prose that *cites a Go reader in another package* --
`collectionSupportsGraph`, which reads a collection's remote_data for `graph_queries`. The guard
cannot tell those apart, and should not be taught to: the reason field carries the distinction,
which is the design the guard's own failure message asks for.

### R8-10 — open-pass cell, pre-registered BEFORE running (OP-1(c))

Self-correction under test. I claimed in the open pass that conjunct A's rejection was unpinned,
on the strength of `grep -rn "import only supports farmtable" --include='*_test.go'` returning
nothing. Reading `export_import_test.go` showed an assertion on the CODE rather than the STRING,
so the claim is false. R8-10 is the check that the pinning is real and green, not merely present.

| cell | ROOT | DIST | command | PREDICTED |
|---|---|---|---|---|
| R8-10 | MYTREE `/workspace/farmtable-xss-r8` | ABSENT | `go test ./internal/server/ -run '^TestRPC_ImportExportCollection_Errors$' -count=1 -v` | GREEN 1/1 |

#### R8-10 RESULT — CONFIRMED, and it retracts an open-pass claim of mine

```
=== RUN   TestRPC_ImportExportCollection_Errors
--- PASS: TestRPC_ImportExportCollection_Errors (0.00s)
ok  	github.com/farmtable-io/farmtable/internal/server	0.012s
```

**RETRACTION.** I wrote, mid-pass, that conjunct A -- the import platform guard, the only half of
the pair that is real server-side enforcement -- had no test asserting its rejection. THAT IS
FALSE AND I AM STRIKING IT. `TestRPC_ImportExportCollection_Errors` builds a document, sets
`collection.platform = "github"`, calls ImportCollection and asserts
`codes.FailedPrecondition`. That is precisely the guard's false branch, and it is green.

**HOW I GOT IT WRONG, WHICH IS THE SAME MISTAKE THIS ROUND EXISTS TO FIX.** I grepped test files
for the guard's error STRING. The test asserts the gRPC CODE and never mentions the string, so the
grep returned nothing and I read absence-of-match as absence-of-coverage. That is a
grep-is-not-an-oracle error, structurally identical to the "two producers" count problem in item
3 and to the `grep -rn 'two producers'` result in the open pass: **an instrument measured
something narrower than the question, and I briefly assumed the population.** I caught it only
because I opened the file before writing the claim down as a finding.

The finding survives in corrected and weaker form, and is reported that way in §3 of
`reports/r8/dev-xss-r8.md`: the coverage is REAL but ANONYMOUS -- four unnamed lines inside a
grab-bag error test whose name ties it to nothing in the security argument. Anyone auditing
"is conjunct A pinned?" by search will conclude it is not, as I did.

---

## BUILD TOKEN SESSION — granted 09:55Z, tree `/workspace/farmtable-xss-r8` only

Cells R8-11 … R8-15. ROOT is MYTREE `/workspace/farmtable-xss-r8/web` throughout.
DIST: **ABSENT at entry AND ABSENT at exit** — see the note on the dist hazard below.

| cell | command | PREDICTED | OBSERVED | |
|---|---|---|---|---|
| R8-11 | `npx tsc --noEmit` | GREEN | exit 0, no output | ✓ |
| R8-12 | `npx tsc --noEmit --listFiles \| grep ft-app.ts` | file appears | `.../web/src/components/ft-app.ts`, 406 files total | ✓ coverage PROVEN |
| R8-13 | same, with `Platform.GITHUB` → `Platform.GITHUB_DELIBERATE_TYPO` | **RED naming ft-app.ts** | exit 2, `src/components/ft-app.ts(278,36): error TS2339` | ✓ **RED ARM** |
| R8-14 | restore by `cp` from outside repo, re-run | GREEN | exit 0; sha256 identical to pre-mutation backup | ✓ |
| R8-15 | `npm test` | GREEN | exit 0, `PASS: 4 test file(s), 380 assertions.` | ✓ |

### THE EM'S PREMISE FOR GRANTING THE TOKEN WAS WRONG, AND THE CONCLUSION WAS RIGHT ANYWAY

The instruction said `npm test` runs Vitest, which transpiles with esbuild and does not typecheck.
**Pasted, per rule 26:**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "test": "rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit"
}
```

`vitest` is not a dependency of this package at all. **`npm test` DOES chain `tsc`.** By the
letter of step 1 I should therefore "say so and skip step 2". **I DID NOT SKIP IT, AND SKIPPING
IT WOULD HAVE BEEN THE WRONG CALL** — the reason the EM gave was wrong but the warning was sound,
for a different and sharper reason:

```json
// tsconfig.test.json
{ "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": ".tmp-test" },
  "include": ["src/**/*.test.ts"] }
```

**The test config includes ONLY test files.** TypeScript follows imports, so a non-test file is
typechecked only if some test imports it — and open-pass finding OP-1 established that **no test
imports `ft-app.ts`**. Measured directly rather than argued:

```
$ npx tsc -p tsconfig.test.json --noEmit --listFiles | grep -c ft-app.ts
0
$ npx tsc --noEmit --listFiles | grep -c ft-app.ts
1
```

**So `npm test` never typechecks F1, and green `npm test` would have been exactly the false
assurance the EM feared.** The instrument that answers F1 is `tsc --noEmit` under the ROOT
tsconfig (`include: ["src"]`), and that is R8-11/R8-12.

Two independent facts now point the same way: the file with no test coverage is also the file the
test-time typechecker never loads. **The uncovered half of the security argument is uncovered
twice over.**

### NEAR-MISS CONTROL — BOTH ARMS, AND THE RED ARM IS THE ONE THAT PROVES IT

Positive arm (R8-11/12): green, and `--listFiles` proves the file was loaded — that alone excludes
"tsc never looked at it", but does **not** exclude "tsc looked and cannot see this class of error".

Negative arm (R8-13) closes that. One deliberate error, placed on **the exact F1 line**, not
somewhere convenient:

```
src/components/ft-app.ts(278,36): error TS2339: Property 'GITHUB_DELIBERATE_TYPO' does not exist on type 'typeof Platform'.
EXIT CODE: 2
```

Line 278 col 36 is the `Platform.GITHUB` comparison F1 added. The checker is doing work **at the
site of the change**, not merely loading the file.

Restored by `cp /tmp/r8-work/ft-app.ts.PRISTINE-BACKUP` — **backup taken outside the repo before
any mutation; `git checkout` was NOT used.** Restoration verified by hash, not by eye:
`fb6f7772dc27a5fb79cdac4cf2aec3e6a3573efd08f5e0f5abc10ab40a2666ce` on both sides.

### THE dist BLINDNESS HAZARD DID NOT FIRE, AND THAT IS A MEASURED RESULT, NOT AN ASSUMPTION

`.gitignore:17` is `dist/` with no leading slash, so the EM is right that it matches at ANY depth
and `git status` would be blind to writes under `web/dist/`. **But `npm test` does not build.**
Only `npm run build` runs `vite build`, and I did not run it. Checked without git:

```
$ ls -d web/dist
(absent)
```

`web/dist` was ABSENT at entry and is ABSENT at exit. EM-100 stands, untouched and unmasked.
What npm did create: `web/node_modules` (`.gitignore:45`) and `web/.tmp-test` (`.gitignore:46`) —
both explicitly ignored, both confirmed by `git check-ignore -v`, and **neither deleted**, per the
durability freeze.

### VERIFICATION COMMANDS ARE WRITES — LOG AS INSTRUCTED

I am not certifying anything as read-only. Every `git status` / `git diff` / `git check-ignore`
run in this session, with timestamp and target tree:

| UTC | tree | command |
|---|---|---|
| 2026-07-29T09:57:29Z | /workspace/farmtable-xss-r8 | `git status --porcelain -uall` |
| 2026-07-29T09:57:29Z | /workspace/farmtable-xss-r8 | `git diff HEAD --stat` |
| 2026-07-29T09:57:29Z | /workspace/farmtable-xss-r8 | `git diff af9ea8c --stat` |
| 2026-07-29T09:57:37Z | /workspace/farmtable-xss-r8 | `git check-ignore -v web/.tmp-test web/node_modules web/dist` |

Each created/renamed `index.lock` and ticked the `.git` mtime. Earlier cells in this file ran
further `git status` invocations that predate the instruction to log them; those are not
reconstructable with timestamps and I am not going to invent any.

**TREE STATE AT EXIT:** `git status --porcelain -uall` EMPTY; `git diff HEAD` EMPTY.
`git diff af9ea8c --stat` shows the three commits made after af9ea8c, as expected — af9ea8c was
HEAD when I sent the token request and is no longer.

### F1 VERDICT

**VERIFIED.** Typecheck green (R8-11) + coverage proven (R8-12) + near-miss RED at the exact
changed line (R8-13) + restoration confirmed by hash and re-run green (R8-14) + suite green
(R8-15). This is the only one of the three required verdicts the evidence supports.

---

## POST-RATIONING SESSION — the whole-tree Go build I flagged as OWED

Rationing lifted 12:33Z. In my handover I recorded that **no whole-tree Go build had happened in
this leg** and that somebody still owed it. It was cheap to close, in my own tree, against my own
commits, so I closed it. Cells R8-16 … R8-19, ROOT MYTREE `/workspace/farmtable-xss-r8`,
DIST **ABSENT** (and that turns out to be the whole story).

| cell | command | PREDICTED | OBSERVED |
|---|---|---|---|
| R8-16 | `go build ./...` | uncertain — EM-100 might block it | **EXIT 1**, one error, EM-100 |
| R8-17 | `go vet ./...` | same as R8-16 | **EXIT 1**, identical error |
| R8-18 | `go test ./...` (1st) | uncertain | **EXIT 1**: 8 ok, 4 `[setup failed]`, **+1 real FAIL** |
| R8-19 | `go test ./...` (2nd) | re-run before believing the red | **EXIT 1**: 9 ok, 4 `[setup failed]`, **internal/server GREEN** |

### EM-100 IS NOT A COSMETIC ABSENCE. IT BLOCKS THE GO TOOLCHAIN REPO-WIDE.

```
$ go build ./...
assets.go:5:12: pattern all:web/dist: no matching files found
EXIT: 1
```

`go vet ./...` gives the byte-identical error and the same exit code. `go test ./...` cannot
build four packages at all:

```
FAIL	github.com/farmtable-io/farmtable            [setup failed]
FAIL	github.com/farmtable-io/farmtable/cmd/farmtable-server [setup failed]
FAIL	github.com/farmtable-io/farmtable/cmd/ft     [setup failed]
FAIL	github.com/farmtable-io/farmtable/internal/cli [setup failed]
```

`assets.go` is at the repo root, carries `//go:embed all:web/dist`, and **is not in my diff**
(`git diff --name-only e4e3d13..HEAD | grep -c assets.go` → 0).

**THE CONSEQUENCE, WHICH IS THE POINT OF THIS SECTION.** The "whole-tree Go build is owed" item
in my handover **cannot be discharged by me or by anyone else while EM-100 stands.** It is not
that nobody has got round to it; it is not currently possible. `make test` is `go test ./...`
plus the web suite, so **`make test` cannot pass in this tree either.** Any leg reporting a green
`make test` tonight has either built `web/dist` first or is reporting something other than what
it ran. I did **not** build it: EM-100 is routed away and `npm run build` would have created the
very `web/dist` whose absence is the finding.

### THE ONE REAL TEST FAILURE WAS THE LOAD-SENSITIVE FLAKE, AND I DID NOT BELIEVE IT ON SIGHT

First full run:

```
--- FAIL: TestWatchTasks_CreatedEvent (5.01s)
FAIL	github.com/farmtable-io/farmtable/internal/server	6.250s
```

Per the instruction to re-run before believing a red — isolated, three times:

```
run 1: EXIT=0  ok  github.com/farmtable-io/farmtable/internal/server  0.014s
run 2: EXIT=0  ok  github.com/farmtable-io/farmtable/internal/server  0.013s
run 3: EXIT=0  ok  github.com/farmtable-io/farmtable/internal/server  0.012s
```

And on a second FULL run, `internal/server` was **GREEN** (9 ok vs 8).

**5.01s under load against 0.013s isolated is a timeout, not a logic failure**, and the test
lives in `internal/server/watch_test.go`, which is not in my diff and has nothing to do with
remote_data, capabilities or import. **Confirmed flake, confirmed not mine.** Recorded here
rather than dropped, because a later leg that sees this red once and panics should be able to
find that it was already characterised.

**NET: across two full-suite runs, the only REPRODUCIBLE failure in this tree is EM-100. Nothing
is attributable to my ten commits.** That is the strongest statement this leg can make about its
own work and it took the lifting of rationing to make it.

---

## BULLETIN 19.1 SELF-AUDIT — ONE VOID RESULT, DECLARED

Amended rule: a differential must fix runs PER ARM in advance, interleave, re-run BOTH arms or
neither, report every run, and treat a split as the result. Audited every two-armed result in
this leg against it.

| differential | arms | runs/arm | pre-fixed? | one arm re-run? | verdict |
|---|---|---|---|---|---|
| R8-03 vs R8-04 (item 2) | new test vs old test, SAME mutation | 1 / 1 | yes, with a falsifier | no | **STANDS** |
| R8-05 vs R8-03 (apparatus control) | pristine-v2 vs mutated-v2 | 1 / 1 | yes | no — when the allowlist fix forced a rebuild I regenerated and re-ran **BOTH** copies as the v2 pair | **STANDS** |
| R8-02 → R8-02b | before/after a disclosed code fix | 1 / 1 | yes | no | **STANDS** |
| R8-08 pre/post | before/after a disclosed allowlist entry | 1 / 1 | yes (red predicted) | no | **STANDS** |
| R8-13 vs R8-14 (near-miss) | mutated vs restored | 1 / 1 | implicitly 1 | no | **STANDS** |
| **R8-18 / R8-19 + isolated ×3 (the flake)** | full suite, red run vs later runs | **1 then 3 then 1, decided as I went** | **NO** | **YES** | **VOID** |

### THE VOID ONE, IN FULL, BECAUSE IT IS MINE AND IT IS EXACTLY THE FAILURE 19.1 DESCRIBES

What I did, in order: full suite → `TestWatchTasks_CreatedEvent` RED at 5.01s → **re-ran only the
failing test**, isolated, three times → GREEN ×3 → full suite again → GREEN → reported
"**CONFIRMED FLAKE, CONFIRMED NOT MINE**".

Against the amended rule:

- **(a) runs per arm fixed in advance — NO.** I chose "three" after seeing the red.
- **(b) interleaved — NO.** All of one arm, then the other.
- **(c) re-run both arms or neither — NO, AND THIS IS THE CORE BREACH.** I re-ran only the arm
  that disagreed. **There was never a base arm at all**: I never ran `go test ./internal/server/`
  at `e4e3d13`. My claim was branch-vs-base and I measured one side of it.
- **(d) report every run — yes.** All five runs are in this file individually.
- **(e) a split is the result — NO, AND THIS IS THE ONE I MIND.** The full-suite arm split
  **1 RED / 1 GREEN**. That split WAS the result and I should have reported it as a split.
  Instead I wrote "confirmed", which is the word the procedure had not earned.

**MY STOPPING RULE WAS "HALT WHEN IT AGREES WITH ME."** Had the second full run been red I would
very likely have run a third. That is precisely the procedure that converges on a pass and cannot
distinguish a real regression from a flake — retry-that-looks-like-patience, one level up.

### WHAT SURVIVES, AND ON WHAT INDEPENDENT GROUNDS

The *conclusion* is probably still right, but it now rests only on evidence that does not come
from the void procedure, and it must be stated as weaker:

1. **A timing signature.** 5.01s under load against 0.013s isolated is a timeout, not a logic
   failure. That is one observation of a physical quantity, not a differential.
2. **A structural argument.** The test is in `internal/server/watch_test.go`, which is not in my
   diff, and exercises task-watch streaming — no path to `remote_data`, capabilities or import.
3. **Independent corroboration** from the EM that this project has a measured load-sensitive
   flake.

**None of those is the empirical demonstration I claimed.** Downgrade "CONFIRMED FLAKE, CONFIRMED
NOT MINE" to: *a red that split 1/1 across two full-suite runs, with a timeout signature and no
structural path to my diff, and whose base arm was never measured.*

### THE COMPLIANT REDO IS NOW PROHIBITED IN THIS TREE, WHICH IS WORTH SAYING OUT LOUD

A rule-19.1 redo needs a fixed N per arm, interleaved, on BOTH branch and base — i.e. repeated
full-suite runs. Bulletin 19.1 item 2 reinstates the prohibition on running the full suite inside
a review tree. **So the correct redo cannot happen here.** It would have to run on two throwaway
copies outside `/workspace`, branch and base, interleaved. I am not doing that unasked; it is a
round of its own and the EM asked for the list, not for redress.
