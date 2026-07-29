PRESERVATION SWEEP COMPLETE, ALL SIX DEFECTS APPLIED. **NO UNREACHABLE REFS AND NO ORPHANED COMMITS** — method below. NO BUNDLE. BUT THE PREMISE IS WRONG FOR THIS LEG, AND DEFECT 3 IS FAR LARGER THAN YOUR SAMPLE SHOWED.

## 1. THE REQUIRED ANSWER, WITH THE METHOD

**Canonical SHA tested against: `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f`**,
resolved by `git -C /workspace/farmtable rev-parse main`. **My `origin/main` was
NOT stale — it read the same SHA — and I verified that rather than assuming it.**

**POSITIVE CONTROL, same command, two outcomes:**

    e4e3d13 (my base)        -> rc=0
    07f12a3 (my tip)         -> rc=0
    4fb7f43 (a detached tip) -> rc=1

**My one ref, `refs/heads/url-scheme-validation-r8` = 07f12a3, is not merely
reachable — it is already merged into canonical main.** Three routes:
`is-ancestor` rc=0; `git log origin/main | grep -c ^07f12a3` = 1;
`branch -a --contains` lists `main` and `origin/HEAD`. **HEAD is attached**, so
defect 5's detached-HEAD case does not apply here.

**ORPHAN SWEEP (defect 4):** 518 distinct reflog SHAs; 1129 commits reachable
from all 957 refs; **48 reflog SHAs reachable from no ref**; of those, 0 absent
from the store (`cat-file -e`, stderr shown) and **0 belonging to this leg**
— they date 07-19…07-24 plus one 07-29 02:43, mostly `WIP on …` stash tips, and
none matches `r8|url-scheme|xss|webguard|capabilit`.

**No bundle written, because nothing of mine is unreachable.** Restore-verify was
therefore not applicable; had there been a bundle I would have restored it.

## 2. YOUR PREMISE IS WRONG FOR THIS LEG — IT IS A WORKTREE, NOT A CLONE

You wrote that my object store "exists in exactly one place — your container."

    $ cat .git
    gitdir: /workspace/farmtable/.git/worktrees/farmtable-xss-r8
    $ git rev-parse --git-common-dir     -> /workspace/farmtable/.git
    $ echo $SCION_WORKSPACE_MODE         -> shared-plain

**My objects were never in my container.** This reconciles your two conflicting
measurements: at 13:49Z you found my tip from canonical, at 15:33Z you could not
reach it — **same store, and the earlier reading was right.**

    worktrees sharing /workspace/farmtable/.git   128
    refs in that shared store                     957

**125 clones and 128 worktrees is unlikely to be coincidence.** If the sweep
treated linked worktrees as independent clones, they were never separate object
stores. Worth checking before more per-container effort.

## 3. DEFECT 3 IS MUCH BIGGER THAN YOUR SAMPLE — 450 REFS, NOT SIX

Your bare-enumeration fix is right and it changes the scale. Namespaces present:

    refs/salvage 462 | refs/heads 207 | refs/remotes 133
    refs/preserve 112 | refs/em-ci 42 | refs/stash 1        = 957

Unreachable from canonical main: **694 ref entries / 273 distinct SHAs.** Split
by what `git bundle --all` actually covers:

    covered by --all (heads/tags/remotes)   244
    SILENTLY DROPPED by --all               450   <- salvage 318, preserve 98, em-ci 33, stash 1

**A `--all` bundle of this store would drop 450 unreachable ref entries and pass
`git bundle verify`.** `refs/salvage/*` is the largest namespace in the
repository and is invisible to `--all` — and it is, by its name, the output of
the recovery effort this instruction exists to support. **Your fix must list
`refs/salvage/*` and `refs/em-ci/*`, not just `refs/preserve/*`.**

## 4. FOUR TIPS AT LIVE RISK, AND THE HAZARD POINTS THE OPPOSITE WAY

Branch refs survive worktree deletion; **detached HEADs do not.** Ten worktrees
are detached, six are covered by a ref or by main, **four are protected by
nothing but their directory's continued existence:**

    4fb7f43  /workspace/farmtable-f61-rename
    91aa668  /workspace/farmtable-f61-review
    ef4bbf8  /workspace/farmtable-f63-review
    045a0c2  /workspace/farmtable-f66-review

Plus the 48 ref-unreachable reflog commits, which survive only while reflogs do.

**`git worktree prune` then `git gc` destroys both sets permanently, and the
freeze on gc and prune was lifted at 13:29Z.** The exposure is not container
deletion — **it is a routine maintenance command run in canonical**, and it is
larger than the one this instruction addresses.

I did not preserve them myself: bare SHAs will not bundle —
`fatal: Refusing to create empty bundle` — so it needs refs written into a store
128 worktrees share, which is not mine to do unilaterally mid-teardown. **Say
the word and it is one command.**

## 5. MY ACTUAL LOSS EXPOSURE WAS NOT REFS

Mutation copies `/tmp/r8-mutation/*` are working-tree copies with **no `.git`** —
**no commits, nothing to bundle, and that absence is not a gap.** The recoverable
form is the arm definitions and pre-registered expectations, already on the
shared volume in `_run-queue-log.md` cells R8-03/04/05, each carrying arm,
command, prediction and falsifier — enough to rebuild both arms from the row.

**`/tmp/r8-work/` was genuinely container-only and is now mirrored** to
`reports/r8/scratch-dev-xss-r8/` (57 files, 656K, `cp -a`, contents verified).
It held the raw cell outputs, `ft-app.ts.PRISTINE-BACKUP` (the out-of-repo
restore source for the F1 red arm), the census scripts, and `git-command-log.md`
— **the verification-is-a-write ledger, which existed in exactly one place on
earth.** Your ledger's `/tmp/r8-work/<name>` citations now resolve to that
directory and I have committed a pointer beside the cells that cite them. Full
write-up at `reports/r8/scratch-dev-xss-r8/preservation-report.md`.

**Your instruction found a real loss in my leg. It was prose, not objects.**

## 6. TWO TRAPS IN THE FIXES THEMSELVES

**(a) `git fetch /workspace/farmtable` fetches canonical's HEAD, not its main.**
Canonical is currently checked out on `task-state-web-ui-v2`, so my FETCH_HEAD
came back `633f8f2` — a feature branch. **A leg following the fix literally
tests ancestry against the wrong branch and gets a clean exit either way**, which
is defect 1 wearing the fix's clothes. Resolve `main` explicitly.

**(b) An instrument failure caught only by your stderr rule.** My first orphan
pass reported **all ten** detached tips as AT RISK. `git` had dropped out of
`PATH` inside a process-substitution loop; every call errored and every tip fell
through the `else` into the at-risk bucket. **A broken loop produced a clean,
plausible, entirely fabricated table and I would have sent it.** I caught it only
because the errors were interleaved and visible. Re-run with absolute
`/usr/local/bin/git`: 6 covered, 4 at risk. *(Also: `... | tail -5; echo $?`
reports `tail`'s status — it printed `exit=0` over a `fatal:`.)*

**Keep "do not suppress stderr" in the instruction verbatim. It is the single
line that stopped me filing fiction.**

## STATE

Tree `/workspace/farmtable-xss-r8` untouched, preserved as audit trail. No
commits, no pushes, no refs created, nothing deleted. Ready to be retired — or
to create those four preserve refs first if you want them.
