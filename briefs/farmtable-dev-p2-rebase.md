# dev-p2-rebase — rebase p2-land onto the new main

## 1. What this is

Branch `p2-land` carries phase 2 of the task-state contract: 40 commits replayed onto base
`43bd206`, tip `a036807`, working tree clean. Main has since moved to `aa08f1a` and now contains
two things the branch predates:

  f94dfa2  the shared Node test runner at web/scripts/run-node-tests.mjs
  373ff49  scripts/ci-suite-manifest.mjs teaches the membership checker to expand glob runners

Your job is to rebase `p2-land` onto `aa08f1a` and leave it merge-ready. This is a
conflict-resolution task, not a design task. Do not improve anything you are not asked to.

## 2. Set up your tree

Clone from the LOCAL path, not the network remote:

    git clone /workspace/farmtable /workspace/dev-p2-rebase

Fetch the branch from the dev tree that holds it:

    git -C /workspace/dev-p2-rebase remote add p2 /workspace/farmtable-dev-p2-land
    git -C /workspace/dev-p2-rebase fetch p2 p2-land

Confirm before you start: `p2/p2-land` resolves to `a036807`, and `origin/main` to `aa08f1a`.
If either differs, STOP and report. Do not rebase a tip you did not expect.

## 3. The rebase

    git checkout -b p2-land p2/p2-land
    git rebase aa08f1a

### Conflict resolution policy — read all of it before resolving anything

**`web/scripts/run-node-tests.mjs` — TAKE MAIN'S, VERBATIM.** The branch's copy is the ancestor
of main's; main's is a rewrite of it and is the shared runner for all four tracks. Do not merge
the two. Do not port anything from the branch's copy into it. Do not fork it.

  Verify the resolution by BLOB HASH, not by eye:
      git rev-parse ${YOUR_TIP}:web/scripts/run-node-tests.mjs
  must equal `21637266...`, which is `git rev-parse aa08f1a:web/scripts/run-node-tests.mjs`.
  Brace the parameter. An unbraced `$sha:path` in zsh returns the COMMIT sha, in the right
  format, silently wrong (EM-349).

**`scripts/ci-suite-manifest.mjs` — TAKE MAIN'S, VERBATIM,** same blob check against `aa08f1a`.
The branch never edited this file (blob `13a913b` at both `43bd206` and `a036807`), so a conflict
here means the rebase machinery is confused, not that there is a decision to make.

**`web/tsconfig.test.json`** — the `include` sets are already identical on both sides (the four
`{test,spec}.{ts,tsx}` patterns). Take main's. `outDir` must remain `.tmp-test`.

**`web/package.json`** — this one is a REAL conflict and needs judgement. The branch changed it
(`3143599` at base to `ac89df7` at the tip) and main's test script now invokes the shared runner.
Keep main's `test` script. Keep the branch's phase 2 additions to every other field. If those two
instructions ever collide on the same line, STOP and report rather than picking one.

**Anything else** — resolve on the merits, phase 2's side where it is phase 2's file, and write
down in your report every file you resolved and which side you took.

**`MIN_TEST_FILES` in `scripts/ci-suite-manifest.mjs` MUST NOT BE RAISED.** em-ci owns that
integer and is reconciling it set-wise. If a gate fails because of the floor, report it; do not
edit around it. This is not negotiable and it is the same constraint that was on the last leg.

## 4. Do not

- Do not delete or regenerate `/workspace/farmtable/web/dist`, or build a frontend anywhere.
- Do not run `npm run build`. It is `tsc --noEmit && vite build` and the vite half writes
  `web/dist` (EM-340). `npx tsc --noEmit` and `npm test` are both fine and are what you want.
- Do not stage with a directory or a glob. Name every file in every `git add`. No `git add -A`,
  no `git add .`, no `git add -u`, no `git commit -a`, no `git stash -u`. Anywhere, for any
  reason, including "just to check something".
- Do not print, log, echo or commit a credential, and do not list git remotes bare.

## 5. Acceptance — what "done" means

On the rebased tip, all of these, each with the command that produced it pasted into your report:

  a. `git status --porcelain` is ZERO lines.
  b. The runner blob equals main's `21637266`; the manifest blob equals main's.
  c. `node scripts/ci-suite-manifest.mjs` EXITS 0.
  d. `npx tsc --noEmit` in `web/` exits 0.
  e. `npm test` in `web/` passes, and you quote the runner's own line reporting how many test
     files it ran.
  f. The commit count from `aa08f1a` to your tip, and confirmation that no commit was dropped
     relative to the 40 on `a036807`.

## 6. THE CONTROL ON (c) — do not skip this, and do not accept a bare exit 0

A green membership gate has two very different causes and the exit code cannot tell them apart:
the gate saw all of phase 2's test files and they all check out, OR the gate discovered almost
nothing and vacuously agreed with itself. Main's own population is ONE test file. Phase 2's is
around 26. A pass at `enumerated=1` would mean the runner is not discovering phase 2's tests at
all, and it would look exactly like success.

So: **quote the gate's `enumerated=N executed=N missing=0` line.** State N. If N is 1, or any
small number, that is a FINDING and you stop and report it, not a pass.

Then run the discriminating arm, and note in advance what each outcome means:

  Create one throwaway file that is compiled but not discoverable — the divergence case. Run the
  gate. It must go **RED and name the offending file**. Then delete the throwaway and re-run; it
  must go **GREEN again at the same N as before**.

  - If the gate is working: RED-naming-the-file, then GREEN at N. Two different outcomes.
  - If the gate is blind: GREEN both times. One outcome, and (c) proves nothing.

Report both runs. A control you ran and did not report is a control I cannot use. If the
throwaway leaves ANY residue in the tree or the index, say so — (a) is measured after this, not
before.

## 7. Measurement discipline

Measure the COMMIT, not your working tree. Prefer blob hashes out of the object store and a
fresh checkout over "I looked at the file and it seemed right". Where you genuinely cannot, a
statement about tree state is a fallback and you must label it as one — it is a confession, not
a certificate. The guarantee wanted here is not that you wrote nothing; it is that nothing
uncommitted was READ.

And state the ARTEFACT in the same sentence as every result. "The gate passes" is not a claim.
"The gate passes at `<sha>`" is.

## 8. Out of scope, hard

Auth architecture is parked project-wide. If any resolution you are about to make would change
WHO IS AUTHENTICATED, WHAT THEY MAY DO, or HOW THAT IS DECIDED — stop and report it to me
instead of resolving it. Reading an existing auth decision for display is fine; changing what
the decision is, or adding a permission check, is not.

## 9. If my brief is wrong

It has been, in each of the last three rounds, and twice it was not jointly satisfiable — two
instructions that could not both be obeyed. If you find that here, REPORT IT rather than
silently picking the one you like. Section 5's prohibitions win over anything else I have
written. Telling me my brief is broken is a deliverable, not a complaint.

## 10. Deliverables — all three, none optional

1. The rebased branch `p2-land`, committed, in `/workspace/dev-p2-rebase`.
2. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-p2-rebase.md`
   covering section 5 item by item, section 6's two arms, and every conflict you resolved with
   the side you took.
3. A project log entry under `.design/project-log/`, committed. Name the file explicitly when
   you stage it.

You MUST write the report file to that exact path, commit the branch and the log entry, and
then mark the task complete. Do not stop after the analysis.
