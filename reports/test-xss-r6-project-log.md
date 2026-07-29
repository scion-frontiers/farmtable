# PROJECT LOG — test-xss-r6 (round six QA leg)

**Date:** 2026-07-29 · **SHA:** `c108acbcfa2357862576092469828709bb6c4090` ·
**ROOT:** `/workspace/farmtable-test-xss-r6` · **DIST:** present (copied)

Transferable lessons only. Findings live in `test-xss-r6.md`.

---

## 1. AN OVER-APPROXIMATING MATCHER IS NOT AN OVER-APPROXIMATING SCANNER

The B11 guard's correctness argument is that its *matcher* over-approximates: it counts mentions
in comments, strings and generated code, so *"there is no shape it can fail to recognise."* That
argument is sound and it is about **text**.

It says nothing about **reach**. The same file contains a five-entry directory prune keyed on
basename at arbitrary depth, and a literal `const rd = coll.remoteData;` in `web/src/build/`
is invisible — not because the matcher failed, but because the walk never opened the file.

> **A SCANNER HAS TWO POPULATIONS: WHAT ITS MATCHER CAN RECOGNISE, AND WHAT ITS TRAVERSAL CAN
> REACH. AN ARGUMENT ABOUT THE FIRST IS ROUTINELY WRITTEN AS THOUGH IT COVERED THE SECOND.**

The round's mutation matrix has axes for *spelling* and *file has declared entries*. Both
presuppose the census read the file. **A matrix cannot surface a defect in a variable it holds
fixed** — every one of the four planted mutations sat in a file the walk already reached.

> **WHEN YOU PLANT MUTATIONS TO CHARACTERISE A SCANNER, VARY THE LOCATION AS WELL AS THE SPELLING.
> LOCATION IS THE VARIABLE A CENSUS IS MOST LIKELY TO GET WRONG, AND THE ONE A MUTATION MATRIX IS
> LEAST LIKELY TO VARY.**

Corollary on the prune list itself: `dist`, `build`, `coverage` are *conventions* about top-level
directories, not facts about a path segment. Under `src/` — which `tsconfig.json` compiles
wholesale — they name ordinary source.

---

## 2. A RATE LIMITER IS AN AGGREGATE, AND AN AGGREGATE ERASES THE AXIS IT DOES NOT KEY ON

`logRemoteDataDropped` samples one line per minute across a **single** global window while
serving two call sites with different meanings: a high-volume, expected, benign task-path drop,
and a rare collection-path drop that the round's own comment calls the signal for a silent
write-authorization revocation.

The high-volume one holds the window open. The rare one — the only one anybody needed — is
silently absorbed into an integer that does not name it.

> **SAMPLING IS AN AGGREGATION. IF THE SAMPLER'S KEY IS COARSER THAN THE DISTINCTIONS THE LOG IS
> SUPPOSED TO CARRY, THE HIGH-FREQUENCY EVENT DELETES THE LOW-FREQUENCY ONE — AND THE
> LOW-FREQUENCY ONE IS ALWAYS THE ONE THAT MATTERED.**

The design comment defends *sampled vs unsampled* and *sample vs counter*, both well. The question
it never asks is **what the sampler is keyed on**. Both risks it argues about are volume risks; the
realised risk is a *resolution* risk.

> **WHEN A DIAGNOSTIC IS RATE-LIMITED, STATE ITS KEY IN THE SAME COMMENT THAT STATES ITS INTERVAL.
> AN INTERVAL WITHOUT A KEY IS HALF A SPECIFICATION.**

Cheap detector: the field was a **parameter** of the logging function but not of its state. Any
parameter that varies across call sites while the rate-limiting state does not is a suppression
bug waiting to happen.

---

## 3. A DEFENSIVE BRANCH THAT SAYS "THIS SHOULD NOT HAPPEN" IS A PREDICTION, AND IT IS TESTABLE

`unrepresentableKeys` has a fallback whose text calls itself *"a real finding about structpb"*
and *"should not happen."* It fires deterministically for any invalid-UTF-8 **key**, because
`NewStruct` validates keys and `NewValue` is only handed values. Ten lines of probe settled it.

> **"THIS SHOULD NOT HAPPEN" IS AN ASSERTION ABOUT A DEPENDENCY'S BEHAVIOUR. CHECK IT AGAINST THE
> DEPENDENCY, NOT AGAINST INTUITION — AND IF IT CAN HAPPEN, THE MESSAGE IS NOW MISDIRECTION
> SHIPPED AT THE WORST MOMENT.**

I had the mechanism right from memory and still wrote the probe. That was the correct call: the
value of the run was not learning the answer, it was making the answer citable.

---

## 4. `origin` WAS NOT THE REMOTE, AND THE BRIEF'S OWN HEURISTIC WALKED ME INTO A FALSE FINDING

The brief said *"`git ls-remote` is the only cheap read in git that cannot be stale."* True of a
remote. On these trees `origin` is `/workspace/farmtable` — another clone on the same host.
`ls-remote origin` returned `main = 7a0f220`, contradicting the brief's `cc927355…`. I had the
finding half-written.

`ls-remote` against the **URL** returned `cc927355…`. The brief's SHA was right; its method was
wrong.

> **STALENESS IS A PROPERTY OF THE THING YOU ASKED, NOT OF THE VERB YOU USED. `git ls-remote` IS
> FRESH WITH RESPECT TO WHATEVER `origin` POINTS AT — AND `origin` IS OFTEN NOT THE REMOTE.**

> **RESOLVE THE REMOTE URL BEFORE TREATING ANY REF AS AUTHORITATIVE. ONE `git remote -v` IS
> CHEAPER THAN ONE RETRACTED FINDING.**

General form, and this one recurred all round: **a freshness guarantee is scoped to an endpoint,
and endpoints get substituted by provisioning.** Same class as the `web/dist` and `node_modules`
lessons — an instrument measured at one scope, a conclusion written at another.

---

## 5. THE MERGE BLOCKER WAS CHEAPER TO CONFIRM THAN TO ARGUE ABOUT

It was predicted but unverified. Confirming it cost three commands: fetch real main, extract
`scripts/ci-suite-manifest.mjs` to `/tmp`, run it with cwd inside the branch tree. Exit 1, full
membership report, no ambiguity — and no need to merge anything.

> **A CROSS-BRANCH GATE CAN USUALLY BE RUN AGAINST THE OTHER BRANCH'S TREE WITHOUT PERFORMING THE
> MERGE. CHECKER FROM ONE SIDE, WORKING TREE FROM THE OTHER.**

Running it from `/tmp` kept my tree clean; the script self-locates via
`git rev-parse --show-toplevel`, so cwd was the only thing that needed to be right.

Attribution mattered as much as the result: `web/package.json` and `web/scripts/run-tests.mjs` are
**untouched** by `d305391..c108acb`. The blocker is inherited from dev-xss-r2/r4 and its fix
belongs to a file on **main**. Reporting it as "this round is blocked" without that would have
sent the r6 developer after a file they cannot fix.

> **RUN `git log` ON THE PATH BEFORE ATTRIBUTING A BLOCKER. "IT BLOCKS THIS BRANCH" AND "THIS
> BRANCH CAUSED IT" ARE DIFFERENT CLAIMS WITH DIFFERENT OWNERS.**

---

## 6. THE COLD-PASS PROTOCOL WAS DEFEATED BY THE COVERING MESSAGE

COMMON §5 fences §7 behind *"do not read until Phase One is on disk"*, and argues — correctly, at
length — that an accurate upstream artefact is the *mechanism* of suppression. The dispatch
message then said *"read these two files, in this order, before you do anything else."*

Both mandatory, both capitalised, mutually exclusive. The dispatch arrived first and was more
specific about ordering, so I followed it and read §7 immediately.

> **A PROTOCOL THAT LIVES INSIDE A DOCUMENT CANNOT DEFEND ITSELF AGAINST THE INSTRUCTION THAT
> DELIVERS THE DOCUMENT. IF READ-ORDER IS LOAD-BEARING, ENFORCE IT WITH FILE BOUNDARIES, NOT WITH
> A HEADING.**

Worse than one contaminated leg: if all three got the same dispatch, the round lost the
measurement **for every leg at once**, which is precisely the correlated failure independent legs
are meant to prevent.

> **REPORT THE CONTAMINATION RATHER THAN THE CLEAN NARRATIVE. A LEG THAT CLAIMS A COLD PASS IT DID
> NOT PERFORM CORRUPTS THE ONE MEASUREMENT THE THREE-LEG STRUCTURE EXISTS TO PRODUCE.**

---

## 7. GATE ARITHMETIC: THE INVOKER ANSWER FLIPPED ON THE MERGE TARGET

At `c108acb`, nothing automated runs the new guard: no `.github/workflows`, and both Dockerfiles
run `npm test` only. `doc.go` says so, honestly and in detail.

On the merge target `cc927355`, CI runs `go test ./... -v` directly, on push to **any** branch.
The guard acquires a real invoker the moment it merges.

> **"NOTHING RUNS THIS" IS A CLAIM WITH A TIMESTAMP AND A REF. CHECK IT AGAINST THE BRANCH THE
> CODE IS GOING TO, NOT ONLY THE BRANCH IT IS ON.**

The round's placement rationale is built on a premise that expires on merge — not wrong when
written, but stale before it lands.

And the sting: **the branch cannot reach that CI**, because the first CI step fails closed on it
(§5). A gate the code cannot get to is not enforcement.

> **ENFORCEMENT IS A PATH, NOT A PROPERTY. A CHECK THAT WOULD RUN, ON A PIPELINE THE CHANGE CANNOT
> ENTER, RUNS ZERO TIMES.**

---

## 8. MECHANICAL NOTES

- Every plant was in my own tree, reverted, with the baseline re-confirmed green after each
  revert. `git status --porcelain` empty at start and finish.
- Greens re-run at `-count=5` to have evidence rather than an argument. All rows are targeted
  single-package runs over a filesystem census or a pinned clock — no network, no goroutines, no
  wall-clock dependence — so the ~4.5% full-suite flake warning does not apply to them. **I did
  not run the full suite and claim nothing about it.**
- I never terminated a command with an echo of its own status. Build/test outcomes were read from
  their own output text (`ok` / `FAIL` / the checker's membership report), never from a reported
  exit code.
- Populations of ten or fewer are reported as lists throughout: the four web test files, the
  single occurrence of `"collection.remote_data"`, the two `.github` template files, the three
  commits authoring `run-tests.mjs`.
