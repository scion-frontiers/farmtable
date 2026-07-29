# Shared baseline block — xss round 4 review

**PART I of two.** Read this in full, first. It is your tree, your inputs, your
environment, your gates, your safety procedure and the dispatch policy — **facts only, by
design.**

The method rules and my targeting live in **PART II, `_xss-r4-method-block.md`**, which you
read **after** you have written your open pass. That split is new this round and there is a
measured reason for it; see "The method rules are in PART II" below.

---

## READ THIS FIRST — YOU ARE ON A SHARED MACHINE AND IT CRASHED TONIGHT

**BEFORE any other instruction in this document or your leg brief.**

At ~23:20Z the VM locked up. Root cause, confirmed at 23:49Z: **too many agents running
Go builds and test suites in parallel starved the host.** It was not a bug. It was
arithmetic, and I supplied the arithmetic — I had six review legs dispatched across two
rounds, and a test leg's whole job is to run the suite. **That crash is also what stranded
a live mutant in the dev tree** (see the stranded-mutant section below); the two facts you
are about to read are the same incident.

Resource guardrails have since been put on containers. **Per-container caps do not bound
an aggregate.** Eight containers capped at two cores each still demand sixteen on an
eight-core box, and a cap can *lengthen* each build, widening the window in which builds
overlap. So the cap is necessary and not sufficient. The rules below are the part that
closes it.

### BINDING DISPATCH POLICY

1. **AT MOST ONE AGENT PROJECT-WIDE MAY BE EXECUTING A BUILD OR A SUITE AT ANY MOMENT.**
   Not one per round. **One total.** You cannot observe this property about yourself, which
   is exactly why it is not left to your judgement.
2. **ASK ME BEFORE YOU RUN ANYTHING HEAVY.** `make test`, `npm test`, `go test`,
   `go build`, `go vet`, any mutation matrix, any container build. Message the EM
   (`farmtable-em-task-state-model-v2`), say what you want to run and roughly how long, and
   wait for my grant. **I am the run queue. Asking is cheap and I will almost always say
   yes** — I just have to grant one at a time. Batch your requests where you can: one
   message asking for four runs is better than four messages.
3. **THERE IS A SHARED BASELINE MEASUREMENT. CONSUME IT; DO NOT RE-RUN IT.** It is
   published at
   `/scion-volumes/scratchpad/projects/farmtable/reports/_xss-r4-baseline-measurement.md`,
   taken at SHA `e6bda71`, **run twice** (because of the flake — a single shared sample
   baked into three legs is worse than three independent single samples). Read it. Cite it.
   Do not reproduce it just to see the same number.
4. **TARGETED RE-RUNS ARE STILL ALLOWED AND ARE THE POINT.** If a specific claim needs its
   own run, ask for it and say which claim. I will grant it. This is not a rule about doing
   less work; it is a rule about doing it one at a time.
5. **An unannounced full-suite run is a resource incident, not a thoroughness win.** If you
   find yourself about to run the whole suite "just to be sure," that is the thing that
   took the machine down.

**Cheap work is unrestricted.** Reading, `git log`/`git diff`/`git show`, `grep`, source
inspection, AST reasoning by eye, writing your report — none of that needs to ask. **Front-
load all of it.** Do every piece of analysis that does not require an execution first, so
that when your run is granted you already know exactly what you want to measure.

**This does not cost us independence, and I want you to understand why rather than take my
word.** What must stay independent is **what you choose to test and how you interpret a
result.** A test run is a *measurement*, not an *analysis*; three legs sharing one
measurement of one fixed SHA does not converge their judgement. What *would* cost us
independence is a leg forbidden to demand its own run — which is why rule 4 exists and is
not optional. **If you think a specific check genuinely requires an unshared full run, say
so with the reason and I will escalate it as an exception.**

**One place this policy genuinely bites in THIS round, stated plainly rather than worked
around:** round 4 is the round that fixed `make test` so that it executes the web guard
suite at all. So the shared baseline is **a measurement produced by the instrument under
review**. *Nothing downstream of X can falsify X.* It is a fine baseline — "the gate is
green at `e6bda71`" is true and useful — but **it is not evidence that the gate WORKS**,
and no leg may cite it as such.

**So the gate was validated BEFORE the baseline was published, not after** — I broke a web
guard assertion, confirmed `make test` exits non-zero reading `$?` directly, restored, and
confirmed green again. **The validation is attached to the baseline artefact**, so you
cannot receive the green without also receiving the evidence it can go red. **An
unvalidated green and a validated green look identical; only the attachment distinguishes
them.** Read section V of the artefact, and read its stated limits — it does not establish
that a *new* test file is discovered, nor that a file failing to compile is distinguished
from one that passes. **Those remain open and they belong to the test leg.**

---

## Your tree

**Subject of review: commit `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1`.**
Base `6805daa` (the head the round-3 review was run against).
**Six commits.** Differential range `6805daa..e6bda71`.

Branch `url-scheme-validation-r2`, in your clone checked out as
`url-scheme-validation-r2-<yourleg>`.

```
2f6500f  X1:  make test runs this branch's own URL guard; both Dockerfiles npm test before build
d12f572  X2/X4/X5/X7a: close the guard-tracer's universal, scope and walk-identity holes
4e58242  X6:  recover adapter remote_data keys by AST, not by regex (+X7b negation)
6551712  X3:  sanitize remote_data at every depth, and at every write site
e4316ae  docs: log the r4 fix round, its survivors, and the stranded-mutant incident
e6bda71  docs: name server.go:661's exemption, the contaminated ref, the scopes.go decision
```

**Name the SHA, not the branch.** The branch name is not an identifier; the SHA is.

**This brief deliberately does not tell you a filesystem path.** Confirm where you are
with `git rev-parse --show-toplevel` and what you are looking at with `git rev-parse
HEAD`. **If HEAD is not `e6bda71…`, STOP and tell me.** (I got a container path wrong in
a dispatch earlier tonight — an absolute path that was true in my container and
meaningless in the agent's. The leg caught it by confirming identity from content rather
than from the label. Do the same.)

Your report path IS given absolutely, in your leg brief. Use it exactly as written.

---

## What this round was, as facts

Round 3 returned REQUEST CHANGES from all three legs; nine blocking items produced this
single round-4 fix leg. The six commits above are its output.

Three of the six change **instrumentation** rather than production behaviour (`2f6500f`,
`d12f572`, `4e58242`). One changes production behaviour (`6551712`). Two are
documentation (`e4316ae`, `e6bda71`).

The branch's URL property is enforced by **five instruments**: a URL-binding source scanner,
an adapter-key source scanner, a guard tracer, an assertion-count pin, and the test-runner
wiring that makes them execute. The round changed instruments. **The dev leg's own account
is in the in-tree project log; treat every sentence in it as a claim, not as a finding.**

> **APPARATUS DEFECT, FOUND AND CORRECTED 00:27Z — recorded, not quietly patched.**
> The previous version of this paragraph named **two of the five instruments** as the ones
> the dev leg had found defects in. `audit-xss-r4` read that version, then filed two Mediums
> — one in each of the two named instruments — and reported, unprompted, that it therefore
> **could not claim its open pass was uncontaminated.** It was right, and it was right to
> refuse the claim even though both findings were independently reachable (it reached OPEN-1
> from `urlvalidate.go:221` in the diff and OPEN-2 by enumerating href sinks itself). *The
> ordering cannot distinguish those two histories from outside — which is the entire property
> the Part I/Part II split exists to provide.*
> **This is the FOURTH level of one defect:** dispatch-vs-brief → Part-I-vs-method →
> within-brief → now within-Part-I. Splitting documents has found it four times and has not
> stopped it once, because each split creates a new document that can leak.

### STANDING RULE FOR PART I — AND IT IS A REPORTABLE ITEM, NOT AN ASPIRATION

**Part I must contain no sentence that tells a leg where a defect is likely to be.**
Facts about the tree, the environment, the gates and the policy: yes. Anything of the form
*"the defects were over here"*: no — that belongs in Part II.

**If you find such a sentence in Part I, that is an apparatus defect and reporting it is a
REQUIRED deliverable.** Every leg is the detector for this rule; a fifth split is not.
(Rule proposed by `audit-xss-r4`, adopted verbatim in substance.)

Three lesser steers in Part I are acknowledged rather than removed, so you can discount them
deliberately: the commit partition just above (instrumentation / production / docs); the
fenced OUT-OF-SCOPE list, which is necessary but **is** negative targeting and is hereby
labelled as the one accepted steer; and the flake arithmetic below, which duplicates method
content from Part II.

---
## Your inputs

- **`.design/project-log/url-scheme-validation-r4-fix-round.md`** — in your tree,
  committed. The dev leg's own account. **Every sentence is a CLAIM, not a description.**
  It is *inside the artefact you are reviewing*; nothing downstream of the diff can
  falsify the diff.
- `reports/dev-xss-r4.md` — the log references this path. **I have not confirmed it
  exists.** A crash destroyed the equivalent file on the sibling branch tonight. If it is
  not there, use the in-tree log and **say in your report that the referenced report was
  absent** — do not silently substitute something else and do not treat a missing input
  as a formality.
- `briefs/dev-xss-r4.md` — what the leg was asked to do. **Not your specification.**
- Prior round: `briefs/_xss-r3-baseline-block.md`, and the three `*-xss-r3.md` briefs.

---

## Environment — I BUILT IT, SO I AM TELLING YOU WHAT I DID TO IT

Your tree is a **fresh clone** of the dev tree at `e6bda71`, made by me at 23:44Z.

I hand-copied two untracked directories in: **`web/dist` (21M)** and
**`web/node_modules` (120M)**. Neither is part of the diff.

- `web/dist` because `assets.go` has `//go:embed all:web/dist`, so a clean clone fails
  `go build` **and** `go vet` with exit 1 for a reason that has nothing to do with the
  code. I caused a false gate table for two legs this way in an earlier round.
- `web/node_modules` because this round's whole X1 item is *making `make test` run the
  web half*, and a leg that cannot run the web half cannot assess X1.

**If a Go gate complains about `pattern all:web/dist`, or npm complains a package is
missing, my copy failed — tell me, do not work around it.**

---

## Gates

**I measured the first two myself** in the `review` clone at 23:45Z, because I built the
environment and an environment I built is not something I get to assert.

| gate | result | provenance |
|---|---|---|
| `go build ./...` | **0** | **[EM-MEASURED, review clone, 23:45Z]** |
| `make test` | **0**, `PASS: 4 test file(s), 380 assertions` | **[EM-MEASURED, review clone, 23:45Z]** |
| `go vet ./...` | 1 — four pre-existing copylocks at `server.go:{1509,1619,1827,2004}` | `[REPORTED — dev-xss-r4]` |
| `go test ./internal/server/` | ok | `[REPORTED — dev-xss-r4]` |
| `gofmt -l internal/server/ web/` | clean | `[REPORTED — dev-xss-r4]` |
| `git status --porcelain` | 0 lines in your clone | **[EM-MEASURED]** |

**Caveats on my own measurement:** I ran it in the `review` clone only; the three clones
came from one loop and verified to the same SHA with the same copied directories, but
"same procedure" is not "same result."

**In an earlier round I would have told you to re-measure. UNDER THE NEW DISPATCH POLICY,
DO NOT.** The rows above plus the twice-run shared baseline artefact are what you consume.
**If a row's reproducibility is load-bearing for one of your findings, ask me for that
specific run and say which finding depends on it** — I will grant it. What I do not want
is three legs independently re-confirming the same green.

**`go vet` copylocks are PRE-EXISTING and FENCED.** Match by MESSAGE, not count: the text
is `assignment copies lock value to ephReq`. **The literal string `copylock` does NOT
appear in the output** — grep for it and you will get zero and conclude vet is clean.
`server.go` is untouched by this round. Note the line numbers differ from the sibling
`#194` branch's; do not carry a number across branches.

**`internal/server/scopes.go` will be CLEAN in your clone** — see the standing decision
below. Do not be surprised that it differs from the dev tree.

**THE FLAKE, and my own contribution to it.** `TestWatchTasks_*` — **five tests at ~4.5%
each, Wilson CI [2.39%, 8.33%]**. A 27-row single-run mutation matrix is **~71% likely to
contain at least one spurious RED**, and **a spurious RED reads as "mutant killed", so
the bias flatters the suite.** The dev leg ran every row twice; match that or better.
Further confound I own: the flake is **load-sensitive and the load is my own
parallelism.** **Six legs are running right now** — three on this branch and three on
`#194`. Every flake rate this project has recorded is confounded by that, including the
4.5%. State how you controlled for it.

---

## The method rules are in PART II, deliberately

They used to be here. A leg measured that putting them here made an uncontaminated open
pass **impossible by construction**, because this document must be read first and in
full — the countermeasure was being defeated by the document announcing it. So they now
live in **`_xss-r4-method-block.md`**, which you read *after* your open pass.

Two of them are safety-critical rather than targeting, so they stay here and apply from
this moment:

- **`cmd | tail` reports the exit code of `tail`.** Never pipe a command whose exit code
  you intend to read.
- **Restore every probe cell, and verify the restore by `git diff` against the SHA** — not
  by running tests, and not by `git status` alone if you have committed anything. **Report
  the number of cells you left dirty**, stating 0 explicitly if it is 0. The next section
  is why.

---
## THE STRANDED MUTANT — read this before you run any mutation harness

Self-reported by the dev leg, verified independently by me and by the coordinator.

The container crashed mid-run with the mutation harness active. The harness mutates
tracked source in place and restores only at end of run; `/tmp` was wiped, taking both its
snapshot directory and its output log. **One mutant was live in the working tree:**
`validateRemoteDataValue`'s generic map branch held `validateRemoteDataURLs(path, tv, 0)`
— mutant `P5cn`, the depth-counter reset. Caught by **inspection**, reverted.

Three things follow, and the third is the one that should change how you work:

1. The recovery snapshot `27e0ee0` **contains that mutant**. I verified it by reading
   canonical: `urlvalidate.go:430` reads `…, 0)` in the snapshot and `…, depth+1)` in the
   tree. The ref has been **renamed** to
   `refs/preserve/xss-r4/wip-snapshot-CONTAMINATED-live-mutant-P5cn-urlvalidate-L430` so
   the warning travels with the object. `refs/preserve/xss-r4/branch` (`d12f572`) is clean
   by construction. **Your clone is from the live tree at `e6bda71` and is clean** — I
   checked line 430 at that head.
2. **`P5cn` had SURVIVED the suite.** A green test run would not have caught it. A
   recovery procedure that verified by running tests would have adopted it silently.
3. **The wider pattern — third instance on this project, second in one night: a probe's
   state escaping into a durable artefact through a channel the probe's own cleanup does
   not cover.** The `#194` leg had a differential probe's revert swept into a commit by
   `git commit`, and its post-hoc worktree check came back clean *because the restore had
   already run — the check looked at the WORKTREE and the dirty cell was in the COMMIT.*
   Mine is a third channel: a recovery snapshot copies whatever is on disk, and its
   verification proves only that the snapshotter did not *disturb* the tree, which is
   exactly blind to whether what it copied was work or scaffolding.

   **For you: after any harness run, a green suite is not evidence the tree is clean, and
   it is LEAST evidence precisely for the mutants that survived.** Verify your restore by
   `git diff` against the SHA, not by running tests, and not by `git status` alone if you
   have committed anything.

---

## THE ORDERING, AND WHY IT IS NOT CEREMONY

**DO YOUR OWN OPEN, UNSCOPED PASS FIRST. WRITE IT DOWN IN YOUR REPORT. ONLY THEN read
`_xss-r4-method-block.md` and your leg brief's checklist.** Attribute every finding
`[OPEN]` or `[CHECKLIST]` so the countermeasure is falsifiable.

My targeting has steered a round away from the defect with every sentence true. Your open
pass is the control on my brief — but only if it happens before you know what I am
looking for.

**THE DISPATCH MESSAGE IS PART OF THE APPARATUS.** In an earlier round my dispatch said
"read the brief in full before anything else" while the brief said "write your open pass
first." They conflict; the leg followed the dispatch; its open pass was contaminated.
**If anything I send you contradicts this document, THIS DOCUMENT WINS — and tell me
about the conflict.**

**A numbered list of everywhere the briefs are wrong is a REQUIRED deliverable.** Legs
have found errors in every round for 20+ consecutive rounds. Assume there is something.

**One standing decision, given to you as a FACT now** because withholding it would make
you read a deliberate choice as an unfinished handoff: `internal/server/scopes.go` was
left dirty in the dev tree **on purpose** — six lines of pure gofmt alignment in a `const`
block, no semantic content, pre-existing before the leg started, explicitly fenced out of
the round baseline. I checked the diff; the account is accurate. **It is a declared
decision, not an incomplete handoff, and it is not present in your clone.** You may still
argue with the disposition.

---
## Independence

There are three of you: `review-xss-r4`, `test-xss-r4`, `audit-xss-r4`. **Do not read each
other's reports and do not coordinate.** Everything routes through me.

Label impressions outside your axis as impressions and name the axis. **I will not treat
your approval of something outside your axis as corroboration** — a leg once approved a
mechanism another leg had measured broken, and both were right, because the first was
fenced out of the lane where the defect lived.

**Divergence between legs is a RESULT.** Two legs disagreeing on a wire fact told us more
than either report did. Do not soften a finding to pre-empt disagreement.

---

## Fenced OUT OF SCOPE — do not file these as defects of this diff

The four `go vet` copylocks; the `web/dist` clean-checkout defect; CSP absence; the `#195`
markdown/DOMPurify branch and its two `unsafeHTML(renderMarkdown(...))` sinks; the `#194`
branch; the absence of CI; and the three-URL-policy merge seam. All known, all tracked,
all untouched. **Do flag it if this diff CLAIMS to handle any of them.**

`ft-inspector-desc.ts` in this diff is a **comment-only** change; the sink is unchanged.
Verify that, then leave it.

## Do not

- **Do not push.** Ever. Pushing is the manager's job, exclusively.
- **Do not modify production code. Your independence depends on it.** Restore every probe
  cell; verify the restore by `git diff` against the SHA; report the count you left dirty.
- **Do not commit** to your branch. Your deliverable is a report file.
- **Do not touch `/workspace/farmtable`** or **`/workspace/farmtable-em-verify195`** —
  those are in my container, not yours, but if you can see them, leave them alone.
- **Phase 1 is merged, deployed and LIVE IN PRODUCTION.** Do not touch it.
- **Impact before severity.**

---

## ADDENDUM 00:12Z — YOUR SCRATCH PATH IS ASSIGNED. DO NOT CHOOSE ONE.

**Use exactly this path for every probe worktree, temp checkout, or scratch file:**

| leg | assigned scratch root |
|---|---|
| `review-xss-r4` | `/var/tmp/scratch-review-xss-r4/` |
| `test-xss-r4`   | `/var/tmp/scratch-test-xss-r4/` |
| `audit-xss-r4`  | `/var/tmp/scratch-audit-xss-r4/` |

**Not `/tmp/probe`. Not any path you pick yourself.** Tonight two legs on the sibling round
independently created a probe worktree at `/tmp/probe` — the obvious name, which is exactly
why both chose it. It turned out to be harmless (see below), but for ninety minutes I could
not tell whether a reported **Critical** was a real defect or one leg reading another leg's
deliberately injected mutation, and I could not adjudicate it in either direction. The cost
was not corruption; it was **an unfalsifiable finding**.

**A leg-named path makes the artefact self-identifying exactly when someone is reading
across legs under pressure.** One token per invocation.

### What the sibling round proved, because you should use the argument, not just the rule

`/tmp` is **per-container**, established three independent ways: a named artefact of one leg
was not visible from the other; the hostnames differ; and — the strongest of the three —
**`git worktree add /tmp/probe` SUCCEEDED for both legs, and git refuses an existing
non-empty path, so a shared filesystem would have produced a hard failure in whichever went
second.** That last one is a **creation-time** property. It holds no matter what either leg
did afterwards, which is why it beats any post-hoc cleanliness scan: a state check can only
tell you about the moment you ran it.

### A LABELLED ENVIRONMENT FACT THAT IS UNINFORMATIVE — DO NOT TRUST IT

**CORRECTED 00:25Z. The previous version of this section said the label was FALSE. That was
my error, from a sample of two, and two legs then confirmed it back to me — from the same
stratum. Read the correction; it is more useful than the claim it replaces.**

`SCION_WORKSPACE_MODE=shared-plain`, documented as *"every agent shares this one directory."*
`SCION_WORKSPACE_GIT` is **UNSET** while `/workspace` *is* a git repo, so presence-testing it
(which some global instructions tell you to do) also gives the wrong answer.

**MEASURED, whole population, 30 agent configs under `/workspace/.scion/agents/*/`:**

| stratum | n | mount source → target |
|---|---|---|
| **SHARED** | 15 | `…/projects/ft-2` → `/workspace` — *one source, fifteen agents* |
| **PRIVATE** | 15 | `…/projects/ft-2/farmtable-<leg>` → `/workspace` — one agent each |

Every dev/review/test/audit **leg is in the PRIVATE stratum — including you.** Verified from
config, not assumed. The coordinator and the EM are in the SHARED stratum.

**So the label is not false. It is USELESS: it reads `shared-plain` in BOTH strata**, and
discriminating the two is the only reason anyone would ever consult it.

WHAT THIS MEANS FOR YOU, concretely:
- Your clone, `/tmp`, `/var/tmp` and branch are yours alone. `/tmp` and `/var/tmp` are
  container filesystems, not volumes, so they are per-container in **both** strata.
- **"You cannot see other agents' files, so absence is not evidence"** — correct **for you**,
  and I am scoping it rather than stating it universally, because it has an exception and the
  exception is my own container. If you find a file on `/scion-volumes` you did not write,
  that is normal; it is shared by design.

**MEASURE THE TOPOLOGY; DO NOT READ IT OFF A LABEL. And note the shape of how this section
went wrong, because it is the most transferable thing in it: I generalised from 2 samples to
"every agent", two legs independently confirmed it, and all three observations were drawn from
the same stratum. INDEPENDENT CONFIRMATION WITHIN A BIASED SAMPLING FRAME IS THE SAME SAMPLE
TAKEN THREE TIMES. Concordance is not coverage. If you catch me doing this again, say so.**
