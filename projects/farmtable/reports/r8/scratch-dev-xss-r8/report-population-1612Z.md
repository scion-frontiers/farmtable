**POPULATION 1378 COMMITS (17194 objects) / ABSENT 0 / STASHES 14, NOT ZERO / all three rc buckets fired: 0, 1, 128.** I had NOT used --batch-all-objects before — my previous population was 89. Your check found a real gap in my method. It did not change my answer, which is exactly your point.

## THE THREE SPELLINGS ON THIS STORE

    for-each-ref                       8546 refs
    rev-list --objects --all          16932 objects
    cat-file --batch-all-objects      17194 objects   <- 10487 blob / 5329 tree / 1378 commit

    commits reachable from all refs     1369
    commits in the STORE, unreachable      9

**The gap is 9 commits, and all 9 are other legs' negative controls.** Subjects:
negarm3, negarm5, negarm6, negarm7, "neg arm 17853400370...", "local-only probe
for network guard, not for merge", "local-only probe r8tmp". **They are supposed
to be unreachable and supposed to be off-network.** A leg probing its store-level
population and reporting these as ABSENT would be filing its own control as a
finding — worth a line in the ledger before someone rescues nine deliberate
negatives onto the network.

## ABSENT COUNT, WITH A POPULATION-SCALE CONTROL

    probe 1  1378 commits vs /workspace/farmtable       PRESENT 1378  ABSENT   0
    probe 2  SAME command vs /workspace/dev-scopedeny-93 PRESENT 1074  ABSENT 304

**Probe 2 is the control you are owed and it is not a zero.** Same command, same
population, same invocation shape, 304 different — so the instrument does
discriminate at population scale and my 0 is not a stuck needle.

**But read my 0 as structural, not as evidence of durability.** My tree is a
worktree of /workspace/farmtable, so probe 1 asks my store about itself. It
cannot return anything else. The load-bearing fact is upstream of the probe:
**the store is /workspace/farmtable/.git, st_dev 2049, host-backed** — my
objects were never on the overlay. That is what makes me safe, not the 0.

## RC BUCKETS, BARE SPELLING, CONTROLS RUN FIRST

    rc=0    PRESENT     07f12a3...          (real commit)
    rc=1    ABSENT      0000...0001         (well-formed, nonexistent)
    rc=128  MALFORMED   not-a-sha-at-all    (fatal printed, unsuppressed)

All three visible. No peel used anywhere, so your free rule had nothing to catch.

## STASHES — 14, AND I HAD ALREADY SEEN THEM WITHOUT COUNTING THEM

    git stash list          14
    git log -g refs/stash   14

**At 15:39Z I reported 48 ref-unreachable reflog commits and described them as
"mostly WIP on ... stash tips". I wrote the word and did not treat it as a
class.** That is your point landing on me directly: I had the observation and no
category to put it in, so it went into the report as texture.

Good news on the substance: **no stash commit is unreachable in this store.** The
9 unreachable commits are the negarm probes and nothing else, so every stash
commit and every stash parent is ref-reachable and gc-safe.

## ONE NUMBER THAT MOVED, AND WHY

My 48 orphans at 15:39Z are 9 now. Refs went 2045 -> 8546 in the same window —
**your refs/preserve pinning absorbed 39 of my 48.** Not drift in my measurement;
the store changed underneath it. Recording it so the two figures do not look
like a contradiction later.

**0 absent over a store-level population of 1378. Ready to retire.**
