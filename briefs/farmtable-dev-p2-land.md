# dev-p2-land — land phase 2 onto current main

STATUS: **LIVE. Start now.** The base SHA is in section 4. The floor number is NOT yours -
section 5 has been rewritten to remove it from your scope. Do not wait for it.

## 0. What already happened, so you do not redo it

Phase 2 (contract phases 1-2 are already on main; this is the WEB UI half) was assembled by
`dev-p2-assemble` onto base `cc92735` as branch `phase2-web-ui-r5`, tip `61ca67e`. That
rebase was clean, zero conflicts.

The r5 fix delta was reviewed by `review-p2-r6`: **APPROVE**, zero Critical, zero Required,
12 of 13 targeted mutants killed. Report at `reports/review-p2-r6.md`. Read it before you
touch anything - sections FYI-1 through FYI-3 tell you which assertions are load-bearing
and which are not, and you are about to edit one of the not-load-bearing ones.

**You are not re-opening the review.** Four blocking items are fixed and pinned. Your job is
a rebase, three small cleanups the reviewer raised as non-blocking, and one CI floor change.

## 1. Constraints - these are not negotiable

1. **Never stage with a directory or glob pathspec. Name every file.** No `git add -A`,
   `git add .`, `git add -u`, `git commit -a`, `git stash -u`. Anywhere. This repo has lost
   work to exactly this.
2. Never print, log, commit or echo a credential. No bare `git remote` listing.
3. **Do not delete `/workspace/farmtable/web/dist`, and do not build a frontend anywhere.**
4. **Do not run `npm run build`.** It is `tsc --noEmit && vite build`, and the vite half
   writes `web/dist`, which violates constraint 3. `npx tsc --noEmit` on its own is fine and
   is what you should use. `npm test` is fine.
5. Clone your working tree from the local path, not the network remote.
6. **Do not push.** Commit locally. The EM pushes.

## 2. Where to work

Clone `/workspace/farmtable` to your own directory and work only there. `/workspace` is
SHARED with a dozen other agents; do not edit it in place. Note that `git clone` does NOT
copy `refs/preserve/*`, so if you need a preserve ref, fetch it explicitly by name.

## 3. Deliverable

A single branch, based on the SHA the EM gives you in section 4, containing the phase 2 web
UI work plus the changes in sections 5 and 6, committed, not pushed. Plus a project log
entry (section 7).

## 4. The base SHA is `43bd206`, and I have already measured the conflict surface

`farmtable-em-ci` landed the suite-membership fix. Main is green at **`43bd206`**; the
membership gate now runs 501 package-qualified entries. Rebase `61ca67e` onto `43bd206`.

I re-measured the merge rather than reusing the earlier zero-conflict result, which was
taken against a tip that no longer exists:

    git merge-base phase2-web-ui-r5 origin/main  -> cc92735   (unchanged: no divergence)
    git rev-list --count cc92735..origin/main    -> 19        (was 8)

**Expect exactly two conflicted files.** Main touched 20, you touch 74, and the
intersection is `web/package.json` and `web/tsconfig.test.json`. Both are test-list files.
Report the conflict count you actually get - if it is not 2, stop and tell me, because
that means one of us measured the wrong tree.

### 4a. `web/package.json` - take YOUR side. I have already checked what that costs.

Main rewrote the `test` script to add `rm -rf .tmp-test` and `node --test`. You replace the
script wholesale with `npm run test:node && npm run test:components`.

Taking your side is safe, and I verified it by reading `web/scripts/run-node-tests.mjs`
rather than assuming: the runner already does `rmSync(outDir, {recursive:true,
force:true})` (main's fix, derived independently), still runs `tsc -p tsconfig.test.json`,
and globs `src/**/*.test.ts` - so main's `web/src/utils/task-ready.test.ts` is picked up
automatically. **Confirm that by name after you rebase**: run the node suite and check
`task-ready` appears in the output. Do not infer it from a green exit.

Main's `node --test` is not carried over. That is deliberate and it costs nothing today:
`task-ready.test.ts` uses a hand-rolled `assertEqual` that throws, not the `node:test` API,
so bare `node` still exits non-zero on failure. Do not add `--test`.

### 4b. `web/tsconfig.test.json` - **DO NOT UNION THIS ONE NAIVELY. THIS IS THE TRAP.**

My standing instruction is *resolve test-list conflicts as a UNION*, and it is **wrong
here**. I am qualifying it rather than letting you follow it into a defect.

    main    ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.spec.ts", "src/**/*.spec.tsx"]
    yours   ["src/**/*.test.ts"]

Your runner is **coupled** to this file by a fail-closed check: it compares its own
`sources` walk against what `tsc` emitted and exits 1 when
`compiled.length !== sources.length`. That walk globs `.test.ts` only. So the naive union -
main's four patterns in the tsconfig, your one-pattern walk in the runner - makes `tsc`
compile files the runner never counted, the counts diverge, and CI goes red pointing at
nothing obvious.

**CORRECTION TO MY OWN COUNT, AND IT CHANGES THE WORK: there are THREE coupled patterns
here, not two.** I read the `sources` walk and the compare, and did not read two lines
further. Measured at `61ca67e`:

    line 20   sources  = walk(src)     matching `.test.ts`
    tsconfig  include  = src/**/*.test.ts
    line 33   compiled = walk(outDir)  matching `.test.js`
    line 35   compare  = sources.length vs compiled.length
    line 45   THE EXECUTION LOOP ITERATES `compiled`, NOT `sources`

The execution set is `compiled`. A `.spec.js` is therefore not merely uncounted - it is
**unrunnable**. All three patterns move together or none of them do.

It would not go red today. I measured the population of the three extra patterns on both
sides: **0, 0, 0** (positive control: `web/src` has 53 files at main, 59 on your branch, so
the walk ran). Zero population is exactly why this merges green and detonates on the first
`.spec.ts` anyone writes.

**Take MAIN's side of the tsconfig - all four patterns - AND widen BOTH walks in
`web/scripts/run-node-tests.mjs`: `sources` to those same four, and `compiled` to
`.test.js` + `.spec.js` (`.tsx` emits `.js`, so two extensions cover all four sources).**
All three surfaces of the coupled set move together. `farmtable-em-ci` has reviewed this resolution and endorsed it explicitly, and
wants the resulting runner upstreamed as shared infrastructure, so write it to be adopted.

There is an independent reason main's four patterns are the right side: the CI manifest's
own `TEST_FILE_RE` already matches `test|spec` across `ts|tsx|mts|cts|js|mjs|cjs`. Main's
include is a subset of that; your one-pattern include is the outlier. Widening moves you
toward the gate's predicate, not away from it.

**Then positive-control it, because a glob change you did not exercise is not a fix. And
the control I originally specified was a FALSE control - here is why, because you need to
understand the trap to avoid rebuilding it.**

If you widen only the tsconfig and `sources`, then add a failing `foo.spec.ts`:
`sources` +1, `tsc` emits `foo.spec.js`, `compiled` matches `.test.js` so **+0**, the
compare trips, **exit 1, RED**. You would see red and tick the control - but the spec file
never executed. **The arm goes red under both hypotheses, so it cannot attribute a cause**
(task #199), and you would ship a runner that still cannot run a `.spec.ts`.

**So the control must DISCRIMINATE.** The red arm counts only if the output carries your
spec file's **own assertion failure text**. If it instead carries the runner's own
`Expected N compiled test script(s), found M`, the control has fired on the count check,
the widening is NOT proven, and you must stop rather than commit. **Report which of the two
red messages you got, verbatim.** A bare "it went red" is not a result.

Then remove the spec file and confirm green. Report both arms.

**Where the control runs, under the replacement rule in section 7.** Do not dirty your
landing tree to make the red. Clone the branch to a scratch path **from the local tree,
not the network remote** (permanent rule 4), add the throwaway spec there, take both arms
in the clone, and discard it. The control is a measurement of the INSTRUMENT, not of the
commit, and running it that way keeps those two results from ever being confused. Your
landing tree stays clean throughout and the green you report for the commit is taken from
a fresh checkout of the commit, which is what section 7 now requires.

**DO NOT CHANGE `outDir`.** It is `web/.tmp-test`, which is gitignored at `.gitignore:46`,
and that is load-bearing for reasons outside this file: the manifest's `TEST_FILE_RE` also
matches `.js/.mjs/.cjs`, so compiled test output would be counted as source test files if
it were ever visible to git. Moving `outDir` anywhere tracked roughly DOUBLES the manifest's
count - every test counted twice - which satisfies the floor while being wrong in the
direction that still looks safe. If anything you do touches `outDir`, stop and tell me.

**One thing you MUST verify by name, not by exit code:** after the rebase, run the node
suite and confirm `task-ready` appears in the printed output. That is main's only web test
file and the whole safety of taking your side of `package.json` rests on the walk picking
it up. A green exit does not prove it ran; the printed filename does.

## 5. THE MANIFEST FLOOR IS NOT YOURS. DO NOT TOUCH `scripts/ci-suite-manifest.mjs`.

**Do not edit that file at all - not `MIN_TEST_FILES`, not any other line.** It reads
`const MIN_TEST_FILES = 1` at line 35 and it will still read 1 when you are done. That is
correct for now and it is deliberate.

Ownership was settled while this brief was being written: the coordinator assigned the
shared web test runner *and its number* to `farmtable-em-ci`, on the reasoning that the
runner has to be readable by the manifest checker and the checker is theirs. `ci-22-setup`
is doing a set-wise reconciliation against your branch's population and em-ci will hand over
a single integer with its evidence. **The merge is blocked on that number. Your commit is
not.** Build everything else and let me hold the merge.

Do not derive the number yourself, do not run the checker to find it, and do not put 26 in
even though 22 vitest + 4 node = 26 and that is probably right. Arithmetic agreement between
two independently-derived counts is exactly the weak evidence this project keeps getting
burned by, and a fabricated figure in a gate whose entire job is exactness is worse than a
floor left honestly low.

For context only, so you recognise the number when it arrives and can object if it looks
wrong: one unit is **one git-visible file path** under pathspec `web`, matching
`TEST_FILE_RE`, excluding `web/dist/` and `node_modules/`. It is runner-blind - a file counts
once whether vitest or node runs it. It is NOT manifest entries, NOT executed suites, NOT
`test()` calls.

Line 533's own failure text coaches the reader to *lower* `MIN_TEST_FILES` - the guard
telling someone who just deleted a suite how to silence the alarm. em-ci has accepted that as
a real defect and routed it to `ci-22-setup`. **Do not fix it, and do not follow it.**

## 6. The three cleanups - small, and one of them is subtle

**6a. N-1, stale count in a docblock (`web/src/util/task-state-utils.ts:277-283`).**
The `ATTENTION` header still says *"One phrase, four places: the card badge, the
Availability filter option, the active-filter chip, and the dashboard tile."* This delta
made the inspector callout the fifth. Say five and name the callout. It is a wrong count in
the first thing the next author reads.

**6b. FYI-3, a decorative assertion (`web/test/ft-app.write-error-seam.test.ts`, around
:345).** The `globalThis.__xss` assertion **cannot fail**: jsdom does not load subresources,
so `<img onerror>` never fires whether the sink is safe or not. The assertions that actually
killed the mutant are `alert.querySelector('img')` being null and the verbatim-text check.

Two things wrong with it: it reads as coverage and is not, and it writes a key onto
`globalThis` with no cleanup.

**Do NOT simply delete it and call the test stronger.** Either (i) delete it AND confirm by
mutation that the test still dies - re-apply `createTextNode` -> `insertAdjacentHTML` - or
(ii) keep it, add the cleanup, and comment it explicitly as intent-documentation that is not
coverage. Say which you chose and why.

**CORRECTION TO OPTION (i), MINE, AND IT IS THE SAME DEFECT AS THE ONE IN SECTION 4b.** I
originally wrote "show it still kills 1". **That is a count, and a count cannot tell you
WHICH test died.** The mutation could kill a different test, or trip a suite-level error,
and the tally reads `1` in every one of those worlds - red under hypotheses that have
nothing to do with whether this test still pins the behaviour. Apply the standing test:
name what the control does when the thing it tests is broken, and confirm it differs from
what it does when the thing works. A tally of 1 does not differ.

So if you take (i), report **the name of the killed test and the text of the failing
assertion** - I expect `alert.querySelector('img')` being null, or the verbatim-text check,
because those are the two that were actually doing the work. If the mutation instead
produces a suite-level error, a transform failure, or the death of some other test, the
control has NOT fired and the deletion is NOT justified: keep the assertion and take (ii).

**6c. N-2, a comment that overstates its assertion
(`web/test/ft-ready-queue-view.rank.test.ts:225-227`).** The comment claims the assertion
proves `ranksForMove` took the single-write path. `expect(client.updateTaskCalls)
.toHaveLength(1)` only proves the loop made one call before the rejection threw - it would
read `1` even if `writes.length` were 3. No false pass is possible today. Either soften the
comment to what the assertion actually shows, or assert the emitted write count the way the
sibling test does. Prefer the second if it is cheap.

## 7. Verification, and what it is allowed to claim

Run and report, each with the command shown and its real output:

- `npx vitest run` - expect 422 passed / 22 files
- `node scripts/run-node-tests.mjs` - expect 4 scripts passed
- `npx tsc --noEmit` - expect clean, exit 0

If you change 6b, also run the mutation check named there and report killed-count.

**Report numbers you actually saw.** If a command fails, report the failure; do not report
the expectation. A green you did not run is worth less than a red you did.

**MEASURE THE COMMIT, NOT THE TREE.** Project-wide rule, and it has just been **replaced**,
not sharpened. This is the current primary text and it supersedes every earlier version you
were given, including the declare-your-tree-state version that was in this brief an hour
ago:

> MEASURE THE COMMIT, NOT THE TREE. Any result that will be reported, cited or merged on is
> produced from a FRESH CHECKOUT OF THE COMMIT, or from a separate module that can only READ
> the target. Do not make the instrument trustworthy - make it INCAPABLE of seeing what the
> commit does not contain.
>
> The tree-state declaration survives ONLY as a fallback where that is genuinely
> impractical, and it is then a confession, not a certificate.

Why it was replaced, because it changes how you should read every other instruction here:
the old rule asked you to *declare* your tree state. That is a diligence remedy for a
structural problem. Four false greens across the four tracks today shared one cause - the
tree had something the commit did not - and **not one of the four legs was careless.** Each
measured accurately; the instrument answered a question about a TREE and every reader took
the answer to be about a COMMIT. A leg on the CI track then demonstrated the remaining hole
inside the hour by being clean before, clean after, and dirty at the instant that mattered:
truthful declaration, still misleading.

**So for this leg, concretely:** commit first, then take your reported greens from a fresh
checkout of the landing commit - clone from the local path, not the network remote
(permanent rule 4). Do not report a green taken from the tree you did the merge resolution
in. If some check genuinely cannot be run that way, say so in that result's line and treat
the tree-state statement as a confession about that one result.

This matters here for two reasons, and the second one is not obvious.

**First, the ordinary one:** you will have just resolved two conflicts by hand, which is
exactly the state in which a stray uncommitted file is easiest to miss.

**Second, and I want you to check it rather than assume it: PORCELAIN-EMPTY DOES NOT MEAN
UNMUTATED HERE.** `node scripts/run-node-tests.mjs` writes compiled output into
`web/.tmp-test/`, and that path is gitignored at `.gitignore:46`. So the node suite
materially mutates the tree every time it runs, and `git status --porcelain` reports clean
anyway - a truthful answer that hides a real mutation. That is the same hole the rule just
closed, in a different spelling: there the leg made the dirt, here the instrument makes it
and `.gitignore` conceals it.

So for the node-suite result specifically, **also run `git status --porcelain --ignored`
once and report what the run created.** I am not asking you to stop it from happening -
`.tmp-test` being ignored is load-bearing for the CI floor count and must not change. I am
asking you not to report "tree clean" as though nothing was written.

And note what the new rule does and does not fix here: a fresh checkout of the commit is
**dirty the instant this instrument runs**, because running it *is* writing `.tmp-test`.
The fresh checkout still buys you the thing that matters - the compiled input came only
from committed sources - but "measure the commit" does not mean "nothing was written". It
means nothing UNCOMMITTED was READ. Say it that way when you report it.

## 8. Termination criteria

You MUST:

1. Commit the rebased branch with the section 4a/4b, 5 and 6 changes, naming every file you
   stage.
2. Write a project log entry under `.design/project-log/` describing what you rebased, what
   you changed, the floor value you set and where it came from, and your 6b decision.
3. Report to the EM, and these are the fields I will check for:
   - the base SHA and the conflict count (I predict 2 - tell me if it is not)
   - `task-ready` present by name in the node suite output
   - the spec.ts positive control: BOTH arms, **and for the red arm, WHICH failure text**
     (your spec's own assertion, or the runner's count-mismatch message - only the first
     one counts, see section 4b)
   - the floor N as READ from the manifest header, plus BOTH canary arms (N+1 red, N green),
     **and for the N+1 arm, the floor's own rejection message quoted.** A non-zero exit is
     not the result; a non-zero exit that names the floor is.
   - your three verification results, each with its command
   - **the SHA you measured at, and WHICH ARTEFACT each result is about**, for every result.

     Track-wide rule, three clauses, current as of now and replacing everything earlier:
     (1) Measure the commit, not the tree - fresh checkout, or a module that can only read
     the target. (2) The guarantee is not that nothing was written; it is that **nothing
     uncommitted was READ**. (3) A fresh checkout guarantees you measured THE COMMIT, not
     that you measured THE RIGHT THING - so **state the artefact in the same sentence as the
     result**. "The suite is green" is not a claim. "The suite is green at <SHA>, in a fresh
     checkout, for the web node suite" is.

     And the standing test for every control above: **say what the control does when the
     thing it tests is BROKEN, and confirm that differs from what it does when the thing
     WORKS.** If you cannot name two different outcomes, you have an arm, not a control -
     which is exactly the defect that made me rewrite 4b and 6b.
   - your 6b choice and why
4. **Send me the final `web/scripts/run-node-tests.mjs` as a file**, not a description.
   `farmtable-em-ci` is landing it in main as the shared runner for all three tracks and
   would rather inherit your implementation than have a second one written. Write it to be
   read by someone who did not do this rebase.
4. Do NOT push. Do NOT run `npm run build`. Do NOT change `outDir`. Do NOT edit any line of
   `scripts/ci-suite-manifest.mjs` except `MIN_TEST_FILES`.

Then mark the task complete.

**If any single item in 3 cannot be produced, report that item as NOT MEASURED rather than
omitting it.** An absent field reads as a pass here, and that is the failure this whole
brief is built around.

## 9. Push back if

- The base SHA you are given does not contain the glob-runner fix (check that CI step 6 can
  pass before you spend time on the rest).
- The floor number you are given is larger than the number of test files actually present -
  that would make the gate fail closed on a true tree, and it means the reconciliation was
  wrong. Say so rather than committing it.
- Anything in section 6 turns out to be larger than described. These are cleanups. If 6c
  needs a new helper on `RecordingClient`, that is fine; if it needs a test rewrite, stop
  and tell me.
