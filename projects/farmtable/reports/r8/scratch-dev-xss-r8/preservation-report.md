# dev-xss-r8 — preservation sweep, 15:40Z

**Result: NO UNREACHABLE REFS AND NO ORPHANED COMMITS, established by the method
below.** No bundle written, and the reason is measured rather than assumed.

## Canonical SHA tested against

    canonical main = 2982ffd8f3f6e231d8855b9cae7c448c2bd3144f
    resolved by: git -C /workspace/farmtable rev-parse main

**My `origin/main` was NOT stale — it read the same SHA.** I verified that
rather than assuming it, because defect 1 runs in both directions.

## POSITIVE CONTROL ON THE ANCESTRY TEST — same command, two outcomes

    e4e3d13 (my base)          -> rc=0
    07f12a3 (my tip)           -> rc=0
    4fb7f43 (a detached tip)   -> rc=1

The test discriminates. "All my refs are unreachable" and "my command is broken"
are distinguishable here.

## My refs

    refs/heads/url-scheme-validation-r8 = 07f12a3

Reachable, and in fact **already merged into canonical main**, by three routes:
`merge-base --is-ancestor` rc=0; `git log origin/main | grep -c ^07f12a3` = 1;
`git branch -a --contains 07f12a3` lists `main` and `origin/HEAD`.

**HEAD is attached** (`symbolic-ref HEAD` = `refs/heads/url-scheme-validation-r8`),
so the defect-5 detached-HEAD exposure does not apply to this leg.

## Orphan sweep (defect 4)

    git reflog --all --format=%H | sort -u        -> 518 distinct SHAs
    reachable from all 957 refs                   -> 1129 commits
    reflog SHAs reachable from NO ref             -> 48
    of those, absent from the object store        -> 0   (cat-file -e, stderr shown)
    of those, belonging to this leg               -> 0

The 48 are dated 07-19 … 07-24 plus one 07-29 02:43; mostly `WIP on …` stash
tips and pre-squash tips. **None is mine** — grep over their subjects for
`r8|url-scheme|xss|webguard|capabilit` returns nothing, and my leg's work is all
07-29 09:00+ and all on refs. They are somebody's, though, and they are
gc-able — see the hazard section.

## Arms and mutations: NO COMMITS, and here is where the recoverable form lives

`/tmp/r8-mutation/{pristine,mutated,pristine-v2,mutated-v2}` are working-tree
copies **with no `.git`** (verified). They produced no objects, so their absence
from any bundle is not a gap. **The recoverable form is the arm definitions and
pre-registered expectations, which are already on the shared volume** in
`_run-queue-log.md` cells R8-03 / R8-04 / R8-05 — each row carries the arm, the
exact command, the prediction and the falsifier, which is enough to rebuild both
arms from scratch.

## What WAS container-only, and is not any more

`/tmp/r8-work/` — 57 files, 656K — mirrored by `cp -a` to
`reports/r8/scratch-dev-xss-r8/`. It held the raw cell outputs `R8-01…R8-06.txt`,
the `git-command-log.md` verification-is-a-write ledger **which existed in no
other place**, `ft-app.ts.PRISTINE-BACKUP` (the out-of-repo restore source for
the F1 red-arm control), and the census scripts. Every `/tmp/r8-work/<name>`
citation in the ledger now resolves under that directory; a pointer to that
effect is committed in `_run-queue-log.md` beside the cells that cite it.

**This was the only real loss exposure in my leg, and it was not refs.**
