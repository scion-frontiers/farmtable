# Shared baseline block — #194 round 11 review

Read this in full before your leg brief. It is your tree, your inputs, your gates,
and your rules.

---

## Your tree

**Subject of review: commit `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`.**
Base `6d8f19e11f4ddbfdc313301199006d3f7c76eb1c` (the round-10 head).
Six commits. The differential range is `6d8f19e..2cbbd92`.

Branch `label-write-scope-r11`, in your clone checked out as
`label-write-scope-r11-<yourleg>`.

**Name the SHA, not the branch, in everything you write.** The branch name is not
an identifier; the SHA is. If a branch moves under you mid-round and you reported
against the branch, neither of us can tell afterwards what you actually reviewed.

**This brief deliberately does not tell you a filesystem path.** Confirm where you
are with `git rev-parse --show-toplevel`, and confirm what you are looking at with
`git rev-parse HEAD`. **If HEAD is not `2cbbd92…`, STOP and tell me.**

Your report path IS given absolutely, in your leg brief. Use it exactly as written.
A relative report path is only valid in the sender's container and has cost a leg
time before.

The six commits, oldest first:

```
d12a4de  Price the label write against a fixed BEFORE endpoint (#194 r11 B1, B5, B8, B9)
42f0322  Constrain push_prefix to the recognised delimiter class, correct six comments (B4, B7)
e993b4a  Make the write price monotone by construction, and pin it as a property
bc93200  Make the label-write harness able to fail, and pin the round-4 seam (B2, B6)
93ae124  Restore the r11 production files a differential probe reverted in bc93200
2cbbd92  Log the #194 round-11 work, and correct the round-10 arm citations
```

Diffstat `6d8f19e..2cbbd92`: 11 files, 2013 insertions, 135 deletions.

**`bc93200` IS A KNOWN-BROKEN COMMIT AND `93ae124` IS ITS REPAIR.** See "The dev
leg's own process defect" below. This is not a defect for you to re-find; it is
context you need so you do not mis-attribute anything, and it carries a live
question I do want answered.

---

## YOUR PRIMARY INPUT DOES NOT EXIST, AND HERE IS WHAT TO READ INSTEAD

**`reports/dev-194-r11.md` DOES NOT EXIST. It was lost in an infrastructure crash.**
Every previous round had one. This round does not. Do not go looking for it, do not
assume you have the wrong path, and — this is the important part — **do not silently
substitute a different document and review against that.** A leg that cannot find
its stated input and quietly reads something else is producing a correct answer to a
question nobody asked, and neither of us will be able to see that it happened.

**Read this instead, and cite it as your source:**

```
.design/project-log/label-write-scope-r11.md      (in your tree, committed in 2cbbd92)
```

451 lines. It is the dev leg's own account of the round, written by them, and it
covers all nine deliverables: the (self-declared contaminated) open pass, the
Deliverable-1 spelling-set measurement, the round-4 seam determination, B1–B9, the
differential, the gate set, and their required numbered list of nine places my brief
was wrong.

**Treat every sentence in it as a CLAIM, not as a description.** That is the standing
posture for a dev report and it applies at least as strongly here, because this
document is *inside the diff you are reviewing* — the leg wrote its own account into
the artefact under review. Nothing downstream of the diff can falsify the diff.

The dev leg's brief, if you want to see what they were asked to do, is
`briefs/dev-194-r11.md` in this directory. Their brief is not your specification.

---

## Environment — I BUILT IT, SO I AM TELLING YOU WHAT I DID TO IT

Your tree is a **fresh clone** of the dev tree at `2cbbd92`, made by me at 23:34Z.

**I copied `web/dist` into it by hand.** It is untracked, gitignored, 21M, and is
**not part of the diff**. I did this because of a defect I caused in an earlier round:
`assets.go` has `//go:embed all:web/dist`, so a clean clone fails `go build ./...`
**and** `go vet ./...` with exit 1 for a reason that has nothing to do with the code —
and two legs last round got a gate table that manufactured a false finding as a
result. If any Go gate fails complaining about `pattern all:web/dist`, **my copy
failed; tell me, do not work around it.**

`web/node_modules` is **absent** and I did not install it. **The diff touches zero
files under `web/`** — 11 files, all Go, all under `internal/`. npm gates are out of
scope this round. If you think you need them, say why rather than installing.

---

## Gates

Two of the three rows below I measured MYSELF in the `review` clone at 23:36Z. That
is unusual — normally I hand you the dev leg's numbers marked `[REPORTED]`. I measured
these because I built the environment and an environment I built is not something I
get to assert.

| gate | result | provenance |
|---|---|---|
| `go build ./...` | **0** | **[EM-MEASURED, 23:36Z, review clone]** |
| `go vet ./...` | **1**, exactly four copylocks | **[EM-MEASURED, 23:36Z, review clone]** |
| `go test ./... -count=1 -skip 'TestWatchTasks'` | 0 | `[REPORTED — dev-194-r11]`, NOT measured by me |
| `go test -race ./internal/platform/github/ ./internal/server/ -count=1` | 0, no DATA RACE | `[REPORTED — dev-194-r11]` |
| `git status --porcelain` | empty | `[EM-MEASURED]` — 0 lines in all three clones |

**Two caveats on my own measurement, because a measurement without its limits is a
claim:** I ran it in the `review` clone only, not in yours — the three clones were
made by the same loop from the same source and verified to the same SHA with the same
21M `web/dist`, but "same procedure" is not "same result". And I did not run the test
suites at all. **Re-measure before you attribute anything to this diff.** If a row does
not reproduce for you, that disagreement is a finding and I want it in your report.

**`go vet` exits 1 on PRE-EXISTING copylocks, not on anything this diff did.** Match
them by MESSAGE, not by count. The text is `assignment copies lock value to ephReq`,
at `internal/server/server.go:{1782, 1892, 2100, 2277}` — four request types, four
sites. **The literal string `copylock` does NOT appear in the output**; if you grep for
it you will get zero and conclude the vet is clean. Anything vet says beyond those four
is attributable to this diff.

**`TestWatchTasks` and the flake, and the number is worse than you have been told.**
It was characterised as one test at ~8% per sequential full-suite run. It has since been
re-measured as **five tests at ~4.5% each [2.39–8.33]**, which makes a 27-row single-run
mutation matrix roughly **71% likely to contain at least one spurious RED**. There is a
further confound I own: the flake is **load-sensitive, and the load is my own
parallelism** — three of you are running at once, so every flake rate this project has
recorded is confounded by how many legs I was running when it was taken. Practical
consequences: read failing test **NAMES**, never counts; re-run a single RED before you
report it; and if you build a mutation matrix, state how you controlled for this.

---

## The rules that keep producing findings

**Every zero needs a positive control.** The single most productive rule we have; it has
caught at least four instances in this workstream, two of them mine. A grep that returns
0 because the shell ate the glob, and a `go build ./...` that returns **exit 0** with
`matched no packages` because it was issued from a subdirectory, are indistinguishable
from clean results. Before you record any zero, establish that the same command returns
non-zero for a case you know is present.

**`cmd | tail` reports the exit code of `tail`.** Do not pipe a command whose exit code
you intend to read. The dev leg explicitly confirmed they did not.

**Predict before you measure, and report every miss.** The misses have consistently been
more informative than the hits. One leg went perfect on predictions and correctly flagged
that as *weak* evidence, because both of its real findings came from exploration. Report
accuracy as a fraction; do not treat a good score as a result.

**Assert which arm fired.** Overlapping oracle arms mask each other. A differential going
RED tells you something reacted; it does not tell you what. This round's differential is
unusually good on this point — B1's arm and B2's arm fire in **opposite directions** in
the same run — which is exactly why an unlabelled RED here would be worthless.

**A count-pin is not evidence of non-vacuity unless a COUNT-NEUTRAL corruption is also
RED.** Holding the count fixed and corrupting identity must go red. We measured the
failing case: 8 of 14 entries replaced with junk, count held, GREEN. This bar now reaches
the fixture corpus and the assertion harness too, and the regress does not terminate —
so pin an absolute total at the outermost level and say where you stopped.

**A gate that reads a COUNT is structurally blind to a count-neutral corruption of the
thing it counts.** An instrument cannot be checked through itself.

**If a mutation looks RED, check it is not a build failure.** A build failure counted as
a kill is a false positive in the direction that flatters the code. The dev leg hit this
honestly: their github-package property test *cannot* be differentiated by reverting
production files, because it uses unexported helpers the fix introduced and the package
then fails to build. **A build failure is not a measurement.** Watch for anywhere they
counted one as evidence — and watch for anywhere I do.

**Report the number of mutation cells you left dirty after restore.** It is a real
number and I want it. See the next section for why the obvious way of checking is not
sufficient.

---

## THE DEV LEG'S OWN PROCESS DEFECT — read this before you design any differential

Self-reported, and it is the most useful thing in their log.

`bc93200` was meant to carry test-side work only. It also carried `config.go`,
`lifecycle_claim.go` and `passthrough.go` **still reverted to round-10 content**,
because a differential probe was running at the time and `git commit` swept it up.
The leg checked for dirty cells exactly the way the round-10 log prescribes — restore,
then `git status --porcelain` — and it came back clean, **because the restore had
already run. The check looked at the WORKTREE and the dirty cell was in the COMMIT.**

Two things follow for you:

1. **Method warning, and take it seriously for your own work:** when you run a
   differential by reverting production files in the working tree, any `git commit`
   during that window is unsafe, and a post-hoc worktree check cannot detect the
   mistake. Run differentials in a **separate worktree**, or diff the *commit* against
   the last good commit for the files the probe touched. You are not committing to this
   branch at all, so your exposure is lower — but the same shape applies to any scratch
   state you leave behind.
2. **A live question I am not answering for you:** the leg says `93ae124` restores the
   three files to their `e993b4a` content **byte-for-byte**, checked per file with
   `git diff e993b4a -- <file>` empty, and that no new work was smuggled into the repair.
   That is a checkable claim and I have not checked it. A repair commit is the single
   easiest place to hide an unreviewed change, and it is the one commit in this series
   whose stated content is "nothing new."

---

## Three failure modes of MY briefs, all measured, all recent

1. **I supply an input together with a wrong expected result.** Has now happened
   repeatedly across branches. The input is real and the stated consequence is wrong.
   In one case I warned about this failure mode in the same document where I then
   committed it. **Take the input; measure the result yourself.**

2. **I state the shape of a causal set I have not measured.** I have named one gate
   where there were three necessary contributors, named one decisive verification cell
   where two fail, and warned a leg to expect multiplicity where there was genuinely one
   site. The direction of the error is not predictable, so a correction in either
   direction is unsafe. **Where this brief states a count or names a single locus, treat
   it as unmeasured unless it carries a measurement.** I have tried to mark these; assume
   I missed some.

3. **MY TARGETING CAN STEER A ROUND AWAY FROM THE DEFECT, AND A LEG THAT CHECKS ONLY
   WHAT I ASKED WILL APPROVE.** This is worse than 1 and 2 because every sentence I wrote
   can be true and the round still misses. It happened last round: I named
   `lifecycle_claim.go:166` as *the* locus for B2, and narrowing to that function would
   have produced a fix that broke the superset invariant on 40 of 80 cells. The
   countermeasure is structural and it is the shape of your leg brief:

   **DO YOUR OWN OPEN, UNSCOPED PASS FIRST. Write it down. THEN read my checklist.**

   Your leg brief puts my checklist SECOND for exactly this reason, and asks you to
   attribute each finding to "open pass" or "checklist" so the countermeasure is
   falsifiable rather than merely well-intentioned.

   **AND NOTE WHAT WENT WRONG WITH THAT LAST TIME, BECAUSE IT WAS MY FAULT:** my dispatch
   message said "read the brief in full before anything else" while the brief said "do
   not consult my item list until you have written your open pass down." Those conflict,
   the dev leg followed the dispatch, and its open pass was contaminated — it said so,
   which is the only reason we know. **The dispatch message is part of the apparatus.**
   If anything I send you outside this document contradicts this instruction, **this
   document wins, and tell me about the conflict.**

**A numbered list of everywhere this brief is wrong is a REQUIRED deliverable for every
leg.** The running ledger is at 21+ rounds and legs have found errors in every single
one, several of which changed what they measured. Two green controls have appeared once,
in twenty-odd rounds. Assume there is something here.

---

## Independence

**Do not read the other legs' reports and do not coordinate with the other legs.** There
are three of you: `review-194-r11`, `test-194-r11`, `audit-194-r11`. You do not talk to
each other; everything routes through me.

Where you form an impression outside your own axis, **label it as an impression rather
than a finding**, and say which axis it belongs to.

**I will not treat your approval of something outside your axis as corroboration**, and
you should not offer it as one. This has bitten twice: a leg approved a mechanism another
leg had measured broken, and both were right, because the first was fenced out of the
lane where the defect lived.

**Divergence between legs is a RESULT, not a problem to pre-empt.** Two legs disagreeing
on a wire fact told us more than either report did. Do not soften a finding because you
suspect another leg will read it differently.

---

## Do not

- **Do not push.** Under any circumstances. Pushing is the manager's job, exclusively.
- **Do not modify production code. Your independence depends on it.** Probes and
  mutations are expected; restore every cell and report the count you left dirty.
- **Do not commit** to `label-write-scope-r11-<yourleg>`. Your deliverable is a report
  file, not a commit.
- **Do not touch `/workspace/farmtable`** (the canonical store) or
  **`/workspace/farmtable-em-verify195`** (under separate protection). Work only in your
  own clone.
- **Do not touch anything relating to Phase 1.** It is merged, deployed, and LIVE IN
  PRODUCTION.
- Do not rate a finding before you have established whether it is covered indirectly.
  **Impact before severity.**
