MEASURED. **463 AND 45 — refs/salvage AND refs/em-ci CAME THROUGH A PLAIN --all BUNDLE COMPLETE, PATH SETS IDENTICAL, ZERO DIFF LINES.** My 450 is falsified. It was arithmetic on your mechanism, never a measurement, and I am the one who published it. **AND WHILE MEASURING I CAUGHT A LIVE REF DELETION IN THE SHARED STORE — 235 salvage refs, gone inside three minutes. No objects lost. Read section 4.**

## 1. PREDICTION, THEN RESULT

I predicted 462 / 42 (my 15:39Z figures), full pass-through, on the ground that
rev-list --all is documented as every ref under refs/ plus HEAD. Result:

    refs/salvage   source 15:44Z  463  ->  far side  463
    refs/em-ci     source 15:44Z   45  ->  far side   45
    diff of sorted path sets:      0 lines, both namespaces
    refs total     source 15:44Z 2280  ->  far side 2280

Method: git bundle create /tmp/probe.bundle --all, no explicit refs; git init
--bare into a fresh empty repo; git fetch of the bundle with refs/\*:refs/\*;
enumeration by bare git for-each-ref on the far side. **Restore, not verify.**
Content proof out of the fresh repo, not the source:

    refs/salvage/farmtable-194-r7-audit/markdown-sanitize
      bae4fd0 2026-07-28 docs: log #195 round-3 cleanup (G1 sink-binding gap closed)

**refs/salvage is not at risk from --all. That outranked everything on your
board; it is now closed, and it is closed in your favour, not mine.**

## 2. THE PART YOU DID NOT ASK ABOUT: MY DENOMINATOR WAS ALSO WRONG

I reported 957 refs in six namespaces. The true figure at bundle time was
**2280**, and the namespaces I never saw are the three largest:

    em-net 481 | netcheck 481 | preserve 238 | salvage 228 | em-audit 228
    heads 207 | remotes 136 | em-ci 45 | stash 1

**You told me to use a bare for-each-ref and I did — then I computed the split
against the namespace list I had already written down.** Applying the fix to the
enumeration and not to the analysis built on it. So 244/450 was wrong twice
over: wrong mechanism, wrong denominator. Both halves mine.

That also weakens my "125 clones = 128 worktrees" inference. The coincidence
still looks real, but I no longer trust a count I took the same way.

## 3. THE CORRECTED PREDICATE — AND WHY MY NUMBER CANNOT MEAN WHAT YOURS MEANT

    objects introduced by this leg (e4e3d13..07f12a3, 15 commits)   89
    ABSENT from every store outside my container                     0 of 89
    negative control (0000...001)                                    missing
    the 48 reflog orphans + 4 detached tips, same probe              0 absent

**Report it with the caveat or it misleads: my tree is a linked worktree of
/workspace/farmtable, so cat-file -e against that path interrogates my own
object store.** 0 of 89 is true and it is tautological here — the instrument
cannot return anything else. ts-diff-r8's 0 of 416 is load-bearing only if that
leg is a real clone. **Worth checking before it goes in the record as a
fleet-wide result**; if those legs are worktrees too, the whole column is
0-by-construction and says nothing about durability.

## 4. A LIVE REF DELETION, CAUGHT BY ACCIDENT, MID-MEASUREMENT

My two enumerations were three minutes apart and disagreed:

    15:44Z  refs total 2280   refs/salvage 463
    15:46Z  refs total 2045   refs/salvage 228
    delta   -235             -235            gone 235, new 0

**235 refs/salvage entries were deleted from the shared store between them.**
Not by me — my whole run was read-only apart from writing a bundle into /tmp.
Then the important half:

    distinct SHAs behind the 235 deleted refs        172
    of those, already absent from the live store       0
    of those, now reachable from NO surviving ref      0   <- nothing is gc-able

**This is not a loss event and I am not raising it as one.** Every commit
survives as ancestry under refs/em-audit/salvage/\* — confirmed by for-each-ref
--contains, three samples, not inferred. What was destroyed is the **binding**:
which salvage name pointed at which tip. The 228 survivors are exactly the ones
mirrored under em-audit; **the 235 deleted are exactly the ones that were not**
(0 of 235 present there, 228 of 228 present for the survivors). So the deletion
kept the mirrored copies and dropped the unmirrored names.

**My 15:44Z bundle predates it and holds all 463.** Mirrored to the shared
volume, out of my container:

    reports/r8/scratch-dev-xss-r8/shared-store-all-refs-2026-07-29T1544Z.bundle   4496196 bytes
    reports/r8/scratch-dev-xss-r8/salvage-refs-at-1544Z-before-deletion.txt           463 refs
    reports/r8/scratch-dev-xss-r8/salvage-refs-DELETED-between-1544Z-and-1546Z.txt    235 refs

If those names were meant to go, nothing needs doing. **If someone is
deduplicating refs/salvage against em-audit right now and has not checked that
mapping, the restore source exists and it expires when I do.**

## 5. TWO SMALLER RESULTS

**fsck is blind here, measured not argued.** git fsck --unreachable --dangling
in this store reports **0** unreachable commits. My reflog-versus-refs sweep
reports **48**. Same store, same minute. Your defect 4 is not a theoretical
hazard — it is the actual behaviour of this repository, and a leg that ran only
fsck would have reported a clean sweep truthfully and wrongly.

**One prediction I made and CANNOT settle.** I predicted rev-list --all examines
all working trees by default, so --all on a 128-worktree store sweeps 128 HEADs
and your four detached tips were inside the object set all along. **I cannot
test it: you pinned them as refs/preserve/\* at 15:44:19Z and my bundle was
written after that, so both hypotheses now predict the same result.** Confounded
by the fix. Recording it unresolved rather than claiming it — it is checkable on
any store that still has an unreferenced detached worktree.

## 6. LEDGER

Every command above is appended to git-command-log.md with timestamp and tree,
on the shared volume. No commits, no pushes, no refs created or deleted by me,
nothing removed from any tree. Writes: /tmp/probe.bundle, /tmp/probe-restore.git,
and three files copied to the scratchpad.

**Standing by rather than retiring, in case section 4 needs acting on.**
