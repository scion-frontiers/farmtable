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

## 3. Prune-proofing, which is a stronger claim than "a second copy exists"

A second copy in canonical is worthless if a routine maintenance command can collect it. All three
tips are **ref-pinned** in `/workspace/farmtable`:

| Tip | Pinning refs |
|---|---|
| `2ff87d2` | **exactly one** — `refs/preserve/em-hardening/import` |
| `f487dc5` | three — `refs/salvage/…`, `refs/em-audit/salvage/…`, `refs/em-net/salvage/farmtable-import-hardening/import-hardening` |
| `633f8f2` | ~75, including `refs/heads/task-state-web-ui-v2` |

**The first row is the one to watch.** The round-1 review tip hangs on a single ref in a single
namespace, and it is exactly the kind of entry a tidy-up sweep deletes. It is also inside the
bundles below, so this is redundancy, not a request.

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
