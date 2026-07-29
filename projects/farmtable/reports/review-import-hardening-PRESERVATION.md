# import-hardening review leg — preservation record

Written by the reviewer leg (`farmtable-reviewer`, branch `import-hardening`) at wind-down.
Everything below is measured, not asserted. Commands shown ran with **stderr visible**.

## 1. What this leg held that existed nowhere else

Two throwaway clones, both `git clone --no-local`, both detached:

| Clone | Tip | `HEAD^{tree}` | Reachable commits |
|---|---|---|---|
| `/tmp/rev-ih/ft` (round 1) | `2ff87d2` | `9657d01ea5af1e3e5b0accd20016465ca9064d25` | 471 |
| `/tmp/rev-ih2/ft` (round 2) | `f487dc5` | `a579ea929979472019fa80d3b4e0490bb8af4397` | 472 |

Their `origin` is the developer's clone `/workspace/farmtable-import-hardening`, which **has
no `main` ref**. Any recipe of the form `git merge-base origin/main HEAD` exits 128 here.

## 1b. Filesystem coordinates — both clones are container-local

```
stat -c '%d %n'
  1048590  /tmp/rev-ih/ft          <- overlay, CONTAINER-LOCAL
  1048590  /tmp/rev-ih2/ft         <- overlay, CONTAINER-LOCAL
  2049     /workspace/farmtable            (host-backed)
  2049     /scion-volumes/.../bundles      (host-backed)
```

**Do not fetch either clone by path from another container.** `/tmp/rev-ih/ft` is a generic name;
a fetch from elsewhere hits *that container's own* `/tmp`, can succeed against the wrong
repository, and **exits rc=0**. Use the bundles in §4. This is the name-collision failure at its
worst: two trees with *identical* paths on different filesystems, where no amount of reading the
string carefully distinguishes them. **st_dev is part of the coordinate.**

**The overlay device ID is per-container, not a constant.** This container is `1048590`; another
leg's was `1048612`. Hard-coding a magic overlay number gives a false clean. The portable test
compares against a known host-backed path in the same invocation:

```
HOST=$(stat -c %d /workspace/farmtable); MINE=$(stat -c %d <clonepath>)
test "${MINE}" = "${HOST}"
```

**Reachability between a container and a host mount is one-way, and that asymmetry is why §2 still
stands.** A sweep run *from* canonical outward cannot read `1048590`, so for a `/tmp` leg a
NOT-FOUND from such a sweep is indistinguishable from a leg with nothing to preserve — same output,
opposite meanings. The §2 measurement runs in the other direction: from inside this container *into*
the host-backed store, which is readable from here. "An outside sweep cannot see this leg" and
"this leg's objects are in canonical" are both true simultaneously; only the first is a hole.

## 2. Durability predicate — the one that actually bears on loss

Not "is this ref reachable from some other ref" but **"is this OBJECT absent from every store
outside my container?"** Tested with `git cat-file --batch-check` against `/workspace/farmtable`
directly — no refspec, no `--remotes`, no `origin` involved, so the canonical fetch refspec being
heads-only is irrelevant to the number:

```
0 of 471 commits absent from /workspace/farmtable   (round-1 clone)
0 of 472 commits absent from /workspace/farmtable   (round-2 clone)
```

Negative controls, both required, because a loop that has lost its argument returns a clean
uniform table: `cat-file -e 000...001` → rc=1; a nonsense sha through `--batch-check` → `missing`.
A sweep whose control cannot come back with the *other* answer is not a sweep.

## 2b. The population needs its own control — three spellings, re-measured

`0 absent` is only as good as the denominator that produced it, and **a zero over 1 and a zero over
672 are the same string**. Nothing downstream of a ratio can expose its denominator. Re-measured
with all three spellings:

| Spelling | rev-ih | rev-ih2 |
|---|---|---|
| `for-each-ref` | 7 refs | 7 refs |
| `rev-list --all` | 471 commits / 4216 objects | 472 / 4231 |
| `cat-file --batch-all-objects` | 471 commits / 4216 objects | 472 / 4231 |

This leg never used the ref count as a population, so the factor-of-two error another leg hit was
not available here. **The load-bearing number is that store == `rev-list` exactly, to the object.**
That means zero unreachable objects, which re-confirms the empty fsck sweep *from a different
instrument* — the first evidence for that claim that does not route through fsck itself.

It also retires a live worry: `git write-tree` was run repeatedly to prove arm restoration, and
**`write-tree` writes tree objects into the store**. They hashed identical to existing trees, so the
population did not move. Had any revert been imperfect, a stray tree would appear here as
store > rev-list. **Store == rev-list is therefore a second, accidental proof that every arm
reverted cleanly.**

Probe result, bare spelling, rc bucketed into three visible classes, buckets summed against the
population as an arithmetic check that the loop visited every row:

```
rev-ih   population 471   PRESENT(rc=0) 471   ABSENT(rc=1) 0   OTHER 0   sum 471
rev-ih2  population 472   PRESENT(rc=0) 472   ABSENT(rc=1) 0   OTHER 0   sum 472
```

Controls, rc printed unconditionally rather than via a branch that may never fire:

```
canonical main 2982ffd8   -> rc=0
branch base 43bd206       -> rc=0
fabricated sha            -> rc=1     ABSENT
"notahexstring"           -> rc=128   MALFORMED, a different bucket from ABSENT
```

The fourth row matters: **under the `^{commit}` peel, absent and malformed collapse into the same
128**, so no code means "your question was broken" any more and a typo presents as an inflated
ABSENT count — which reads as a finding rather than as an instrument fault. Corollary, free:
**a peeled probe can only return 0 or 128; rc=1 from a peeled probe proves git never ran.**

**The object-typed gate is already cleared, and the typed breakdown is above:** the probe covered
all object types, not just commits — `rev-ih` 1646 blob + 471 commit + 2099 tree, `rev-ih2` 1653 +
472 + 2106, 0 missing in both, negative arm inline returning exactly 1 missing. Another leg's entire
final yield was 11 trees and 7 blobs with **zero commits** — conflict-resolution states and
superseded report revisions — which no commit-shaped enumerator of any spelling could return. The
structural reason that class cannot exist here is one number: **store == `rev-list --all` exactly**.
Those objects were loose, with no commit above them; a store equal to its reachable set contains
none by definition.

## 2c. Stashes — zero, reported with its population

A stash is two or three commit objects hanging off `refs/stash` and its reflog; `for-each-ref` shows
one ref and `rev-list --all` typically walks none of the parents. On another track, 15 of 17
recovered commits were stash-type.

`git stash list` → rc=0, 0 lines, in both clones — **and that alone is worthless**, because rc=0
with no output is what an empty stash and a broken invocation both produce. The discriminating
evidence is three further instruments, two of them loud:

```
ls .git/refs/stash        -> No such file or directory
rev-parse --verify refs/stash -> rc=128
log -g refs/stash             -> rc=128, "unknown revision"
```

Mechanism: these are fresh `clone --no-local` trees, `git stash` was never run in them, and arm
reverts were done by checkout rather than stash. That is luck rather than judgement — this class
would not have been checked unprompted.

## 2d. No second object store behind either clone

```
absolute-git-dir  /tmp/rev-ih/ft/.git , /tmp/rev-ih2/ft/.git
git-common-dir    .git                  (NOT linked worktrees)
.git              a real directory, not a gitfile
objects/info/alternates   ABSENT in both
objects dir st_dev        1048590       (overlay, consistent with the clone; no split)
```

A worktree on `2049` can still keep objects on the overlay via a gitfile or `alternates`, so the
directory you were handed is not sufficient — check `--absolute-git-dir`, `alternates`, and
`.git/objects`.

## 3. Prune-proofing, which is a stronger claim than "a second copy exists"

A second copy in canonical is worthless if a routine maintenance command can collect it. All three
tips are **ref-pinned** in `/workspace/farmtable`:

| Tip | Refs *containing* it (the gc-relevant relation) | Refs *pointing at* it |
|---|---|---|
| `2ff87d2` | 25 | 2 |
| `f487dc5` | 23 | 3 |
| `633f8f2` | 354 | — |

Negative arm, same invocation: a fabricated sha returns 0 refs **and** `error: no such commit` on
stderr — note it does so while still exiting **rc=0**, so an rc-only guard scores it as a legitimate
zero. The stderr line is the only thing distinguishing "no refs contain this" from "this is not a
commit."

### Withdrawn: the "single thread" alarm on `2ff87d2`

An earlier revision of this record, and three messages to the EM, claimed `2ff87d2` was pinned by
**exactly one** ref and asked that the namespace be pruned with care. **That warning is withdrawn.**
Two errors produced it, and the larger one is not a spelling problem:

1. **Wrong relation.** For gc-safety the question is *"is this object reachable from any ref"* —
   `--contains`. I reported `--points-at`, *"does a ref sit exactly on it"*. **`--points-at` is the
   sharper relation and the irrelevant one:** an object reachable from 25 refs is prune-proof
   regardless of how many point at it. **A correct spelling of the wrong question is still the wrong
   answer.**
2. **`for-each-ref`'s `*` does not cross `/`.** Measured on canonical:
   ```
   for-each-ref 'refs/preserve/*'  ->    3      for-each-ref refs/preserve/  -> 2836
   for-each-ref 'refs/salvage/*'   ->    0      for-each-ref refs/salvage/   ->  368
   ```
   A clean, confident zero over 368 real refs — no error, no stderr, rc=0. The trap inside the trap:
   the glob spelling works perfectly on a namespace exactly one level deep, so an idiom can be
   validated once, correctly, and silently return nothing the next time it is pointed somewhere
   deeper. **Use a bare prefix ending in `/`, never a glob.** (`rev-list --glob` *is* recursive,
   which is why the two instruments disagree at all.)

Related, reproduced accidentally in the same run: an **unquoted** `--glob=refs/preserve/*` was eaten
by zsh — `no matches found`, git never ran, 0 lines out. Loud here only because `nomatch` is set;
with it unset the unexpanded pattern passes through and the failure is silent.

**Over-alarming is a defect on the same footing as under-reporting** — it spends someone else's
attention. The root cause is worth more than the correction: **that first pinning measurement had no
control arm at all**, which is exactly why it survived an hour of being restated in three messages.
**An unarmed measurement does not become armed by being repeated confidently.** Every other figure
in this record carries an arm that had to come back *different*.

Figures in this record **not** at risk from the glob defect, checked rather than assumed: the
7-refs-per-clone count came from a **bare** `for-each-ref` with no pattern, and cross-checks against
`git bundle list-heads` showing 7 refs + HEAD = 8 per bundle; populations came from `rev-list --all`
and `cat-file --batch-all-objects`, neither of which takes a ref pattern.

The tips are also inside the bundles below, so ref-pinning was redundancy, not a dependency.

## 4. Bundles left on disk (both generations, deliberately)

`/scion-volumes/scratchpad/projects/farmtable/bundles/`

| File | Bytes | Refs |
|---|---|---|
| `farmtable-reviewer-rev-ih-round1.bundle` | 2610825 | 7 |
| `farmtable-reviewer-rev-ih-round1-complete.bundle` | 2610928 | 8 |
| `farmtable-reviewer-rev-ih2-round2.bundle` | 2616232 | 7 |
| `farmtable-reviewer-rev-ih2-round2-complete.bundle` | 2616335 | 8 |

Both generations are kept so the delta is **auditable rather than asserted**. The `-complete`
bundles add the fsck-unreachable and reflog sweeps promoted to refs.

**The delta is +103 bytes, and the size is the finding.** 103 bytes is one refname and its
metadata — *no new history*. That is positive evidence that this leg had orphaned nothing: had
there been unreachable work, the delta would have been history-sized. Another leg on this project
saw ~1MB on the same operation, and that leg really had lost commits to `--all`.

Verified by **restoring into an empty repo**, not by `git bundle verify`:
`git init` in a fresh dir → `git fetch <bundle> 'refs/*:refs/*'` → tips present, trees match.
Positive control: the expected tip resolves. Negative control: a sha not in the bundle does not.

## 5. Two traps, and the cheap detector for the first

**Trap (a): `git fetch /workspace/farmtable` fetches canonical's HEAD, not its main.** Canonical is
checked out on `refs/heads/task-state-web-ui-v2`, so `FETCH_HEAD` comes back `633f8f2` — a feature
branch — and the ancestry test **exits clean against the wrong branch**.

This leg was not bitten, because it used an explicit refspec
`git fetch --no-tags /workspace/farmtable main:refs/canonical/main-fresh`, yielding `2982ffd8` ==
`git -C /workspace/farmtable rev-parse main`, ≠ canonical HEAD `633f8f2`.

But "I dodged it" is a claim, so the trap was run deliberately. Fetching HEAD the trap's way and
re-running the ancestry sweep against it:

```
633f8f2 (task-state-web-ui-v2) -> REACHABLE     <-- a real unmerged tip, reported SAFE
f487dc5                        -> UNREACHABLE
43bd206 (branch base)          -> UNREACHABLE   <-- the positive control FAILS
2982ffd8 (main)                -> UNREACHABLE
```

**The detector, free to anyone already running a control:** assert that the **branch base** is an
ancestor of whatever you fetched. Correct fetch → rc=0. HEAD-fetch trap → rc=1 and the run stops.
The trap is silent only for someone who ran no control. (Counterfactual ref deleted afterwards;
clones back to 7 refs; bundles predate it and are unaffected.)

**Trap (b): a broken loop produces a clean, plausible, entirely fabricated table.** Mitigated only
by visible stderr plus controls with *two different outcomes*. Related: `cmd | tail -5; echo $?`
reports **tail's** status, not `cmd`'s.

## 6. Shell hazards this leg actually hit, both loudly

- **zsh does not word-split unquoted `${refs}`.** Six refnames arrived as one argument and
  `git bundle create` died `ambiguous argument`. It failed loudly and did **not** overwrite the
  existing bundles. Fixed with `xargs -a /tmp/reflist.txt`.
- **`:` after an unbraced parameter starts a history modifier.** Always brace `"${rev}:${path}"`
  and echo the constructed argument before using it.
- **`&&` chains truncate on `grep -c` with zero matches** (exit 1), silently dropping later steps.
- **The peel syntax changes the failure code, not just the message.** `git cat-file -e <fabricated>`
  returns **rc=1**; `git cat-file -e <fabricated>^{commit}` returns **rc=128** with
  `fatal: Not a valid object name`. Both are non-zero, so a control written as `test $? -ne 0`
  fires either way — but one written as `test $? -eq 1` reads 128 as neither-present-nor-absent and
  falls through to its default branch. Same class as `cmd | head -1 || echo ABSENT`, where the `||`
  binds to `head` (always rc=0) and the negative control silently never fires: **the control
  existed, and the thing consuming its result was reading a different number than the author
  thought.** Probe unpiped and unpeeled.

## 7. Mechanism vs remedy

`--all` *does* carry HEAD and *does* carry non-standard namespaces such as `refs/preserve/*`
(git 2.54.0, shown by direct probe: a ref at a commit no branch pointed to came through with its
correct refname). What `--all` does **not** do is pack **unreachable** objects. Namespace was never
the variable; **reachability** was.

This matters beyond git: the bundling fix worked, and the explanation attached to it was wrong.
**A fix that works is not evidence that its explanation is right** — and an untested explanation
propagates into the next recipe. It is the same shape as this branch's round-1 finding, where the
developer's measurements were all correct and the sentence built on top of them was false.

## 8. Non-ref artefacts

The mutation arms were working-tree edits, never committed. No ref, no fsck sweep, no reflog sweep
and no bundle can carry them. Prose is the only recoverable form:
`review-import-hardening-ARM-DEFINITIONS.md` (arms M7–M11 with exact file:line, before/after,
numstat, and the specific test **and subcase** each must redden).

Also on this volume: `review-import-hardening.md` (the full round-2 review) and
`COPY-of-untracked-project-log-2026-07-29-review-import-hardening.md` (sha256-identical copy of the
project log, which is deliberately left untracked in `/workspace/farmtable` for the EM to commit).
