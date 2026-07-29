# PRE-REGISTRATION — WHOLE-TREE GO BUILD, r8
# WRITTEN BEFORE ANY COMMAND WAS RUN. 2026-07-29 ~10:40Z.
# Author: farmtable-em-task-state-model-v2. Authorised: coordinator 10:32:57Z item 1.

## THE QUESTION

Does `url-scheme-validation-r8` at 901670e build, vet and test WHOLE-TREE? Nobody has run this
tonight against this branch. It is the largest unmeasured object on the project.

## WHY A BARE RUN WOULD PRODUCE A WRONG ANSWER, STATED BEFORE THE RUN

Task #100 [EM-MEASURED, pre-existing, repo-wide]: **`go build` / `go vet` / `go test` ALL fail on a
fresh clone**, because generated `web/dist` is untracked and something embeds it. Every Go gate this
project has ever reported was contingent on an untracked directory being present on disk.

**BOTH r8 REVIEW TREES ARE FRESH CLONES AND BOTH LACK `web/dist`** [MEASURED]:

    /workspace/farmtable-xss-r7-review  HEAD=e4e3d13  web/dist ABSENT
    /workspace/farmtable-review-r8      HEAD=901670e  web/dist ABSENT
    /workspace/farmtable                HEAD=633f8f2  web/dist PRESENT   (canonical, for contrast)

So a single run against 901670e is **GUARANTEED** to go RED for a reason that has nothing to do with
r8, and the RED would be filed against the branch. **THE ANSWER MUST BE A DIFFERENTIAL OR IT IS
WORTHLESS.**

## CONSTRUCTION

Two clones, **created by an identical command differing only in the ref**, so the only variable is
the diff under test:

    /workspace/farmtable-build-base   @ e4e3d13   (merge base)
    /workspace/farmtable-build-r8     @ 901670e   (subject)

Announced by full path, by name, to all legs AT CREATION, per the coordinator's condition. **These
buy ISOLATION, NOT DURABILITY** — two more copies of at-risk history on device 8:1, ~10 MB, and I
will not cite them as risk reduction (relocate's result, filed under its name).

**I am NOT building in any of the three live review trees.** `go build`/`go vet` write only to
GOCACHE, but `make test` may run a web build, which would **materialise `web/dist` in a tree a leg
is reading** — and `check-ignore` decides directory-ness *from disk*, so that would silently flip
the documented polarity trap under an active leg. **A BUILD IS A WRITE TO THE ENVIRONMENT EVEN WHEN
IT WRITES NO FILE TO THE TREE.**

## COMMANDS, EXACTLY, IN BOTH TREES

    go build ./...
    go vet ./...
    go test ./...

`make test` is **HELD** for the reason above, and because it is the one that can plant a fixture.
Exit codes captured with a bare `echo $?` immediately after each command — **NO WRAPPER**. Task #266
is the precedent: a wrapper written to *report* an exit code *replaced* it, and the harness said
EXIT 0 on a build that failed exit 2.

## PROVE THE INSTRUMENT CAN SAY YES — bulletin 14 item 1, and this is the first time I have owed it

> A NEGATIVE CONTROL CANNOT DISTINGUISH "CORRECTLY ABSENT" FROM "INCAPABLE OF FINDING ANYTHING".
> IT IS PASSED MOST EASILY BY A DEAD INSTRUMENT.

A build harness that reports RED for everything is indistinguishable from a broken harness, and I am
about to run one that I EXPECT to report RED. **BOTH ARMS, IN THE SAME SESSION, BEFORE I READ THE
WHOLE-TREE RESULT:**

  * **MUST GO GREEN:** a single package with no embed dependency. If this is RED, my harness is
    broken and every RED below is uninterpretable.
  * **MUST GO RED:** the whole tree, if #100 holds.

If the MUST-GO-GREEN arm fails, **I stop and report the harness, not the branch.**

## PREDICTION, COMMITTED NOW, BEFORE ANY COMMAND RUNS

**BOTH TREES GO RED ON `go build ./...` WITH THE SAME EMBED-RELATED ERROR NAMING `web/dist`, AND THE
DIFFERENTIAL IS ZERO.** I expect r8 to add no build defect.

## DECISION TABLE, FIXED IN ADVANCE

| e4e3d13 (base) | 901670e (r8) | reading |
|---|---|---|
| RED, same error | RED, same error | **#100 ONLY. r8 adds no whole-tree build defect.** This is a statement that **THE DIFFERENTIAL IS ZERO — IT IS NOT A CLEARANCE OF r8**, because neither side was ever compiled. |
| GREEN | RED | **r8 DEFECT. BLOCKING.** |
| RED | GREEN | r8 masks or accidentally fixes #100. **A MASKING IS NOT A FIX** — investigate before crediting. |
| GREEN | GREEN | #100 does not reproduce in this construction. **DO NOT read that as #100 being false** — re-measure #100's scope; the likeliest cause is that its trigger is narrower than "fresh clone". |

**FALSIFIER FOR MY OWN PREDICTION:** if the two failure texts differ in **anything other than the
tree path**, the "identical" reading is wrong and the difference is the finding. I will diff them,
not eyeball them.

## WHAT THIS RUN CANNOT ANSWER, STATED NOW SO THE ZERO CARRIES ITS SCOPE

  * It says nothing about `make test` or `npm test`.
  * A `go test ./...` result is confounded by the known flake population — **five tests at ~4.5% per
    sequential full-suite run**, load-sensitive, and **the load is my own parallelism** (task #156),
    with three review legs live right now. **ANY RED IN `go test` IS A CANDIDATE, NOT A FINDING**,
    until re-run.
  * Main itself is RED (task #230, `TestListUsers`, a detached goroutine on `context.Background()`).
    A test RED that reproduces at the merge base is **not r8's** and the differential is what says so.

---

# PHASE 1 RESULT, AND WHY IT IS NOT AN ANSWER

**PREDICTION HELD, EXACTLY.** [MEASURED, commands and rc pasted, no wrapper]

    positive control: cd /workspace/farmtable-build-base && go build ./internal/webguard
      PC_RC=0                                    <- HARNESS CAN SAY YES. Arm satisfied.

    base (e4e3d13):  go build ./...   rc=1     go vet ./...   rc=1
    r8   (901670e):  go build ./...   rc=1     go vet ./...   rc=1

    base.build.out:  assets.go:5:12: pattern all:web/dist: no matching files found
    r8.build.out:    assets.go:5:12: pattern all:web/dist: no matching files found
    diff (paths normalised): BUILD_DIFF_RC=0, VET_DIFF_RC=0   -> BOTH EMPTY

Row 1 of the decision table. **#100 ONLY. THE DIFFERENTIAL IS ZERO.**

## AND NOW THE PART THE DECISION TABLE WARNED ME ABOUT, WHICH IS THE ACTUAL FINDING

The failure is **ONE LINE**, at `assets.go:5:12`, and it is a **PATTERN-RESOLUTION** failure. `go
build` resolves `//go:embed` patterns **BEFORE IT COMPILES ANYTHING**. So:

> **NEITHER TREE WAS EVER COMPILED. NOT ONE PACKAGE. THE ZERO DIFFERENTIAL IS THE DIFFERENCE BETWEEN
> TWO NON-EVENTS, AND IT CARRIES NO INFORMATION ABOUT r8 WHATSOEVER.**

This is the shape the project has been filing all night, arriving in the largest instrument we have.
A RED that looks like a build result is a **refusal to start**. Worse, and this one generalises off
this branch:

> **`go vet ./...` RETURNED THE SAME SINGLE LINE AND rc=1, WHICH MEANS IT RAN ZERO ANALYZERS.**
> Any "vet is clean" or "vet found nothing new" ever reported from a fresh clone in this project was
> vet **not running**. A vet that cannot load a package reports the load error, not silence — but a
> reader who greps for analyzer diagnostics finds none and reads it as clean.

## PHASE 2 — PRE-REGISTERED BEFORE RUNNING. THIS IS THE RUN THAT ANSWERS THE QUESTION.

**INTERVENTION:** create a **STUB** `web/dist` containing one placeholder file, **IDENTICALLY IN BOTH
TREES**, purely to satisfy the embed pattern. The embedded *content* is irrelevant to whether Go code
compiles, and both sides get byte-identical treatment, so the differential is preserved.

**THIS IS A DECLARED FIXTURE AND I AM ANNOUNCING IT AS ONE**, per the rule that a correct number
obtained without discharging the disclosure is still an undisclosed fixture:

  * It is in **my two build trees only**. No leg tree is touched. No canonical tree is touched.
  * **THE RESULT WILL BE CONDITIONAL ON A STUB AND SAYS NOTHING ABOUT THE REAL ASSET PIPELINE.**
    It cannot clear the production container build (task #97) and must never be cited as doing so.
  * It does **not** fix #100 and must not be reported as fixing it. #100 is that the *committed*
    tree does not build; that remains true.

**PREDICTION, COMMITTED BEFORE THE RUN:**
  1. `go build ./...` **GREEN (rc=0) in BOTH** trees.
  2. `go vet ./...` — I do **not** predict clean. I predict **IDENTICAL** output in both.
  3. `go test ./...` **RED in BOTH**, dominated by known pre-existing failures (`TestListUsers`,
     task #230; the five-test ~4.5% flake population, task #156, **load-sensitive and the load is my
     own three live review legs**).

**THE ONLY CELL THAT IS r8's:** a package that compiles at e4e3d13 and does not at 901670e, or a
test that fails at 901670e and passes at e4e3d13 **and reproduces on re-run**. Anything symmetric is
inherited. **A SINGLE-RUN TEST RED IS A CANDIDATE, NOT A FINDING.**

**FALSIFIER FOR PREDICTION 1:** if `go build ./...` is still RED with a stub dist, my model of the
failure is wrong and the embed is not the only blocker — report that, do not iterate on the stub.

---
# RESULTS — PHASE 3 CLOSED, REACH CONTROL ADDED UNDER CHALLENGE

## THE CHARGE I CONCEDE FIRST

`farmtable-preserve-bundle`, 10:42:15Z: *"A DIFFERENTIAL BETWEEN TWO RUNS THAT BOTH ABORT UPSTREAM
OF THE CHANGE UNDER TEST RETURNS 'NO DIFFERENCE' AND HAS MEASURED NOTHING... Add the row now while
the prediction is still sealed; adding it afterwards is choosing an outcome."*

**THE CHARGE IS UPHELD AGAINST ME.** Phase 1 produced exactly that null, I diagnosed it correctly
(`//go:embed` resolves before compilation, so neither tree compiled a single package), and **I wrote
that reasoning into this file AFTER the run.** A NOT-REACHED row belonged in the sealed prediction.
It was not there. I do not get credit for diagnosing a hole that my pre-registration should have
made impossible to fall into. **Recorded as an error of my own apparatus, not as a save.**

## THE REMEDY, RUN RATHER THAN PROMISED — REACH CONTROL

Phase 2 removed the abort, but "it compiled" is not "it compiled *r8's changes*". Both arms below
use a **hand-typed literal marker** (bulletin 14: literal in the planter), never assembled.

| arm | file | marker | result |
|---|---|---|---|
| membership | all 4 changed `.go` files | — | **4 of 4** present in a compiled package file set (`go list`) |
| ARM 1 reach, production | `internal/server/convert.go` | `ZZQ_REACH_PROBE_7741` | build **rc=1**, `convert.go:1112:1: syntax error` — **NAMED THE FILE** |
| ARM 2 reach, r8 test file | `internal/webguard/remotedata_consumers_test.go` | `ZZQ_REACH_PROBE_8852` | vet **rc=1**, `remotedata_consumers_test.go:687:28` — **NAMED THE FILE** |
| ARM 3 revert | both | — | sha256 **identical to pre-probe**, `git status --porcelain` **0 lines**, build **rc=0** |

**THE INSTRUMENT CAN SAY YES ABOUT SOMETHING I ACTUALLY PLANTED, IN THE EXACT FILES r8 CHANGED.**
That is the arm bulletin 14 said nobody had ever been asked for. The Phase 2/3 zero differential is
therefore a **measured absence**, not a dead instrument.

## MEASURED RESULT

| phase | base `e4e3d13` | r8 `901670e` | differential |
|---|---|---|---|
| 1 `go build ./...` (no dist) | rc=1, 1 line | rc=1, 1 line | EMPTY — **NOT REACHED, measures nothing** |
| 2 `go build ./...` (stub dist) | **rc=0** | **rc=0** | EMPTY, and **reach-proven** |
| 2 `go vet ./...` | rc=1, **4 lines** | rc=1, **4 lines** | **EMPTY** |
| 3 `go test ./... ` | **rc=0** | **rc=0** | **EMPTY**, 33 identical lines |

**DECISION TABLE ROW 4 (GREEN/GREEN). r8 INTRODUCES NO Go BUILD, VET OR TEST REGRESSION.**

## MY PREDICTION 3 WAS FALSIFIED AND THE FALSIFICATION IS MINE, NOT THE SUITE'S

I predicted `go test ./...` **RED in both**. Measured **GREEN in both**, 4 seconds.

- Suite genuinely executed: **545 top-level RUN, 545 PASS, 0 FAIL, 0 SKIP** (`-count=1 -v`).
- Neither phase-3 run was a cache replay: `(cached)` count **0** in both.
- Gap to task #232 closes **exactly**: **595 declared Test funcs − 50 integration-tagged = 545**.
  No silent skip. **Task #232's "551 declared / 549 unique" is superseded at this SHA.**
- `TestListUsers` (task #230) and `TestWatchTasks` (#231) **were both in the population and passed.**

**THE PREDICTION WAS BAD ON EVIDENCE I ALREADY HELD.** Task #162 records the flake as **five tests
at ~4.5%**. P(all five clean in one run) ≈ **0.955⁵ ≈ 80%**. **GREEN WAS THE MODAL OUTCOME AND I
PREDICTED THE 20% TAIL, THEN TREATED THE 80% OUTCOME AS SUSPICIOUS.** A single green run does
**not** clear the flake population — it carries almost no information about it — and #230 is
**neither confirmed nor cleared** here.

## EM-314 — A PARTIAL READ OF A FILE STILL BEING WRITTEN IS INDISTINGUISHABLE FROM A TRUNCATED RESULT

I read `test.progress` while the background job was mid-write, saw the r8 start line with **no
`r8_TEST_RC=` and no `ALLDONE`**, and narrated it to the channel as an anomaly. The file now reads
`r8_TEST_RC=0 / ALLDONE`. **Nothing was wrong. I manufactured an anomaly out of read timing** — and
it is the same family as the silent zero, except it **fails toward ALARM** (EM-313's direction).
**A PROGRESS FILE IS NOT A RESULT FILE, AND ONLY THE SENTINEL SAYS WHICH ONE YOU ARE HOLDING.**

## THE FOUR VET DIAGNOSTICS — PRE-EXISTING, LIVE, AND NEW TO THIS PROJECT

Identical in both trees (VET2 differential EMPTY), therefore **NOT r8's**:

```
internal/server/server.go:1509:14  assignment copies lock value to ephReq: ...GetReadyTasksRequest
internal/server/server.go:1619:14  ... GetBlockedTasksRequest
internal/server/server.go:1827:13  ... GetCriticalPathRequest
internal/server/server.go:2004:13  ... GetBottlenecksRequest
```
all `contains protoimpl.MessageState contains sync.Mutex`.

**THEY HAVE NEVER BEEN SEEN BECAUSE VET HAS NEVER RUN.** On a fresh clone `go vet ./...` dies on the
embed and **runs zero analyzers** — so every "vet is clean" this project has recorded from a clean
checkout was **vet not running**. That is task #100 with a second consequence nobody had named.

## SCOPE LIMITS, UNCHANGED

Says **nothing** about `make test` or `npm test` (both HELD). Does **not** clear the production
container build (task #97). Conditional on a **stub** `web/dist/index.html` (70 bytes, declared as a
fixture at creation) — **this does not fix task #100.**
