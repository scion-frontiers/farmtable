# DURABILITY RECORD — `dev-194-pricing`

2026-07-29. Repo `/workspace/farmtable-194-pricing`, branch
`dev/194-pricing-ruling`, tip `20b7525`. `SCION_WORKSPACE_MODE=shared-plain`,
`SCION_WORKSPACE_GIT` unset for `/workspace` itself.

**I had no prior bundle**, so nothing I previously reported as safe is
invalidated. This is a first bundle, run with the complete three-sweep recipe.
I made the naive bundle anyway, *before* sweeping, so the delta is measured on
this repo rather than assumed from another leg's numbers.

## THE DURABILITY PREDICATE — "absent from every store outside my container"

Tested with `git cat-file -e "<sha>^{commit}"` against `/workspace/farmtable`,
over the union of: fsck-unreachable tips, reflog tips, and my own branch commits.

```
distinct candidate commits ....... 366
PRESENT in /workspace/farmtable .. 363
ABSENT  (single-copy exposure) ...   3
```

**THE THREE, AND WHY THEY EXIST — THIS IS THE FINDING, NOT THE BUNDLE:**

```
1c48795  Pre-register arm L3b: break the departure vector
1253e12  #194: point the monotonicity pin at the REAL gate
20b7525  Project log: round 12 execution record + struck composition
```

I reported `0904a22` to `farmtable-em-ci` at 15:16Z and its sweep collected me at
that point. **I then made three more commits.** Everything up to and including
`0904a22` is two-copy; everything after it was single-copy until this bundle.

**A SNAPSHOT-BASED SALVAGE SWEEP IS STALE THE MOMENT THE REPORTING AGENT KEEPS
WORKING**, and the agent is the only party who knows it went stale. Reporting a
SHA is not a handoff; it is a handoff *as of* that SHA. This is the 204-tips
failure in miniature: the procedure ran correctly and the exposure reopened
behind it.

I did **not** run the ancestry question ("reachable from origin/main"). It
false-positives on every unmerged branch, which is the normal state of active
work, and I did not want a 100-ish number standing next to the real one. This
also means I never touched trap (a) — I did not `git fetch /workspace/farmtable`
and so never tested against canonical's HEAD (`task-state-web-ui-v2`) believing
it was main.

**SCOPE OF THE REFERENCE STORE, STATED SO IT IS NOT OVER-READ.** My comparison
store is `/workspace/farmtable` — **canonical, not GitHub.** I do not claim these
objects are on GitHub, and per the EM's withdrawn reference set I could not learn
that this way even if I tried: canonical's fetch refspec is heads-only.
"Two-copy on this host" is the whole of my claim.

**RESOLVED 15:53Z BY A PARTY WHO COULD ANSWER IT — `farmtable-em-ci`.** That
limit is now discharged, and **not by me**, which is the correct outcome for a
question my instrument could not reach. It fetched and pushed
`refs/salvage/farmtable-194-pricing/dev/194-pricing-ruling` = `20b7525` and
checked all four SHAs **against the network** in one invocation after a
prune-fetch:

```
1c48795 PRESENT   1253e12 PRESENT   20b7525 PRESENT   0904a22 PRESENT
negative arm (purpose-built never-pushed commit) ABSENT  -> instrument lit
```

The negative arm is the part that makes the four PRESENTs mean anything: without
it, "everything is present" is also what a broken check says. **The three commits
are now genuinely off-host.** The stopgap section below stands as written — it
was true when written, and it is why the fetch was requested rather than assumed.

### THE INSTRUMENT WAS RE-RUN WITH STDERR VISIBLE — trap (b)

My first pass used `2>/dev/null` on the `cat-file -e` loop. That is exactly the
shape that let another leg fabricate a clean ten-row table when `git` fell out of
`PATH`: every call errors, every item falls through the `else` into the at-risk
bucket, and the output looks fine. Re-run with an **absolute git path**
(`/usr/local/bin/git`, 2.54.0) and stderr **classified rather than discarded**,
distinguishing "absent" from "errored":

```
present=363  absent=3  UNEXPECTED-ERRORS=0   (total 366)
absent set identical to the first pass: YES
```

Two-sided instrument check first: a SHA that must be present returned present,
and a bogus SHA returned `fatal: Not a valid object name` — **the control fires,
so a nonzero exit means absent rather than broken.** Note that 363 successful
lookups were themselves a positive control the first pass already carried: a
dead `git` cannot return 363 present. The number was sound; it was **not
defensibly sound until the errors were separated from the absences.**

## THREE BUNDLES, ONE VARIABLE AT A TIME — ALL LEFT ON DISK

The EM's defects 3 and 5 (namespace, and detached HEAD) were retracted after
three legs disproved them. **My data independently agrees, and isolates the real
variable**, because I happened to build a plain-`--all` bundle both BEFORE and
AFTER promoting unreachables to refs:

| bundle | command | bytes | refs | `refs/preserve/*` |
|---|---|---|---|---|
| `…-NAIVE-all.bundle` | `--all`, **pre-sweep** | 2,593,436 | 8 | 0 |
| `…-CONTROL-plain-all-postsweep.bundle` | `--all`, **post-sweep** | 3,447,889 | 374 | **366** |
| `…-CORRECTED-all-HEAD.bundle` | `--all HEAD`, post-sweep | 3,448,324 | 374 | **366** |

**Delta: 854,888 bytes and 366 refs.** Read the rows in order:

1. **`--all` DOES carry `refs/preserve/*` — 366 of them.** Defect 3 is false here
   too; this is a fourth independent disconfirmation.
2. **`--all HEAD` and plain `--all` produced IDENTICAL REF SETS** (`diff` empty).
   The explicit `HEAD` bought nothing. And **all three bundles, including the
   naive one, contain a `HEAD` ref.**
3. **The only thing that changed between row 1 and row 2 was PROMOTING
   UNREACHABLES TO REFS.** Same command, same repo, +854,888 bytes.

**REACHABILITY WAS THE VARIABLE. NAMESPACE NEVER WAS.** Naming refs explicitly
works only because writing the ref is what makes the object reachable.

**LIMIT — I CANNOT TEST DEFECT 5 AND DO NOT CLAIM TO.** `symbolic-ref HEAD`
returns `refs/heads/dev/194-pricing-ruling`: **my HEAD is ATTACHED**, so this repo
never exercises the detached-clone precondition. My "HEAD present in all three"
is therefore consistent with the retraction but is **not evidence for it**. A
repo that cannot reach the failure state cannot clear it.

Sweep yields: **(a) fsck-unreachable → 355 commits. (b) reflog → 11.** Both run;
complementary, neither subsumes the other. Consistent with the corrected
mechanism, since both sweeps do the same thing — make objects reachable.

## VERIFIED BY RESTORING, NOT BY `git bundle verify`

Probe commit `0054fda…`, taken from sweep (a) — exactly the class `--all` drops.
Each bundle cloned into a temp dir, then `git cat-file -e`:

| probe | from NAIVE | from CORRECTED |
|---|---|---|
| `0054fda…` (sweep-(a) commit) | **MISSING** | PRESENT |
| `1c48795`, `1253e12`, `20b7525` | PRESENT | PRESENT |

**And the deficient bundle passes verification.** Run on the naive bundle,
independently reproduced here:

```
The bundle records a complete history.
VERIFY-EXIT=0
```

A bundle demonstrably missing 355 commits reports a complete history and exits
zero. `git bundle verify` checks that prerequisites are satisfiable, not that
anything you care about is inside. **It cannot detect this defect and must not be
used as the check.**

## THE BUNDLE IS CROSS-CONTAINER BUT **NOT OFF-DEVICE** — CHECKED, NOT ASSUMED

```
/workspace                 -> /dev/root  (st_dev 2049)
/scion-volumes/scratchpad  -> /dev/root  (st_dev 2049)
SAME DEVICE
```

A shared volume survives **my container** dying. It does **not** survive the
**host device**. I nearly wrote "off-device copy secured", which would have been
false in exactly the way that only matters on the day it matters.

**So this bundle is a stopgap, not the durability answer.** The three commits are
still one device from gone. **`farmtable-em-ci` must fetch `20b7525` into
canonical off-host storage**; that is the only real remedy and it is requested.

### CORRECTION TO THE SECTION ABOVE — RIGHT FACTS, WRONG FRAME

**Both sentences above are true and the EMPHASIS is wrong, in the direction that
overstated my urgency.** Recorded at 15:55Z after the EM's exchange with
`dev-safeurl-union`, which supplied the frame I was missing.

I evaluated the `st_dev 2049` collision against **HOST loss**, where it is
disqualifying. **The live risk today is CONTAINER loss**, and against that risk
**the device split cuts the other way**: on a leg whose clone sits on a
container-local overlay, the bundle is on `/dev/root` and the clone is not, so
**THE BUNDLE OUTLIVES THE CONTAINER AND THE CLONE DOES NOT.** For such a leg the
scratchpad bundle is not a stopgap at all — it is the only surviving copy, and
"not a real copy" would have argued it away.

I wrote both halves and then led with the one that raised my urgency. Erring
toward more caution is the safer direction and it is **still a wrong frame**, and
a wrong frame propagates further than a wrong number because it reads as
judgement rather than as data. `dev-safeurl-union` made the same correction *in
the direction that reduced its own urgency*, which is the harder direction to
argue and worth more than this note.

**For THIS clone the distinction is moot** — measured 15:55Z, `/workspace/farmtable-194-pricing`,
its `.git`, and its `.git/objects` are all `st_dev 2049`, no gitfile indirection,
`objects/info/alternates` absent. Host-backed on every path an object could
actually live on. The correction is recorded because the framing left this
document and should not go on being reused.

**Portability note:** `/tmp` measured `st_dev 204` here versus `1048612` on
`dev-safeurl-union`. **Overlay device IDs differ per container**, so no specific
number is a signature; `st_dev != 2049` is the only portable form of the test.

### THE SCRATCHPAD SNAPSHOT IS **NOT** DURABILITY — DO NOT CITE IT AS SUCH

`farmtable-em-ci` pushed a snapshot of this scratchpad
(`refs/salvage/scratchpad/projects-farmtable/20260729T1615Z` = `b9636d0`) and
verified **my two files by identity, not presence**, using the hash-plus-grep
probe above: ruling doc `03cf2db…` MATCH (30564 B), durability record `0e2265b…`
MATCH (11334 B), backlog DIFFER exactly as I pre-registered. Freshness probe
two-sided: real string → 1, fabricated control → 0.

**And it is still not durability, by its own author's ruling and the
coordinator's, which I accept.** It is **one edit stale by construction** — em-ci
edited the backlog after pushing it, inside the hour, which is my own S21 turned
back on me from the other side. **These two files are safe as of `b9636d0` and
not one keystroke later.** This section is already outside it.

**And what it captures is narrower than "the files".** em-ci reproduced the
nested-`.git` hazard rather than arguing it: working tree **captured in full**,
but everything not currently checked out **dropped silently** — history, other
branches, stashes, a file deleted in HEAD but alive earlier. **A snapshot that
preserves the files and destroys the account of them, in a directory that looks
complete.** My own filing (A11-a) called this "the entire repository is
invisible"; that was wrong and **understated it**, and is struck in place there.

### RESOLVED — the fetch happened

`farmtable-em-ci`, 15:53Z: `refs/salvage/farmtable-194-pricing/dev/194-pricing-ruling`
= `20b7525`, all four SHAs verified against the network, negative arm lit. **The
requested remedy was carried out; this section's demand is discharged.**

## NON-REF ARTEFACTS

- **Arm definitions and their expected red targets: COMMITTED, not just prose.**
  `99d5df8` (L1/L2/L3), `598014c` (L2b), `1c48795` (L3b) — each results-free and
  written before its run. Also mirrored on scratchpad in
  `reports/dev-194-pricing-ruling.md` §13.2 with predicted *and* observed.
- **My arms did produce commits** — stated explicitly rather than reported as
  "nothing to bundle".
- The ruling and this record live on `/scion-volumes/scratchpad`, so they are
  outside the repo and no sweep or bundle carries them. Same device caveat above.
  **THIS IS NOW THE LARGEST REMAINING EXPOSURE ON THIS TRACK AND IT IS FILED AS
  BACKLOG A11, NOT FOLLOWED.** Every durability mechanism in play — both sweeps,
  three bundles, salvage refs, `em-ci`'s 133-tree re-sweep — is a **git object**
  mechanism. The track's primary deliverables are **not git objects**. The git
  side is now measured to several decimal places and the document side is not
  measured at all; **a well-measured mechanism standing next to an unmeasured one
  reads as coverage.** That is the same defect class as everything else today:
  the signal exists and carries no information about the thing you care about.
- **Untracked files in my clone: NONE.** `git status --porcelain -uall` is empty
  at `20b7525`.

## HOW TO READ EVERY REF COUNT IN THIS DOCUMENT — DEFECT 12

**`for-each-ref` treats `*` as NOT crossing `/`. `ls-remote` treats the same `*`
as crossing it.** Reproduced here on my own namespace at 16:15Z:

```
git for-each-ref 'refs/preserve/*'   ->     0     rc=0, no stderr, no complaint
git for-each-ref  refs/preserve/     ->   366
```

My refs are `refs/preserve/reflog/<sha>` — two levels deep, squarely the failing
case. **Every ref count in this document survives, and not because I was careful:**
the 366 came from a refname prefix match and the 371 from `for-each-ref` with **no
pattern at all**. I avoided the idiom rather than validated it. Had I written the
natural glob, my headline "366 preserve refs" would have read **0**, and 0 preserve
refs is precisely the SMALL number in my three-bundle table — **the silent zero
would have looked like my own hypothesis being confirmed.**

**SHARPENED BY `farmtable-em-ci`, AND ITS VERSION IS THE ONE TO CARRY.** The
failure is not reliably a zero. On a namespace with both flat and nested members:

```
for-each-ref 'refs/heads/*'  ->  96        for-each-ref refs/heads/  ->  207
```

**53% dropped, silently, and 96 LOOKS LIKE AN ANSWER.** My case and the fleet
broadcast's both returned 0, which at least invites suspicion. **A plausible
number does not.** And because the same asterisk *does* cross slashes in
`ls-remote`, the idiom can be validated in one tool and carried into the other
still believing it was checked.

**RULE: bare prefix ending in `/`, never a glob, and never transfer a validated
glob between git tools.**

## THIS TRACK IS DURABLE AS OF 16:20Z — A TIMESTAMP, NOT A STATE

`refs/salvage/farmtable-194-pricing/dev/194-pricing-ruling` = `47b3bc60`
(`20b75258 → 47b3bc60`), verified by `ls-remote` **at the remote URL, not against
the name `origin`**; `754dc16` and `9cc9430` ride along as ancestors. em-ci's
phrasing is the right one and belongs here rather than a claim of safety.

**KNOWN INSTRUMENT BOUNDARY, OPEN, NOT MINE:** the salvage enumerator is
**commit-shaped by construction**, so trees and blobs are invisible to it by every
spelling. My object-typed run measured 15 missing objects against 3 missing
commits in one repo — 5×, though all 15 were carried here, measured not assumed.
The coordinator independently found 11 trees and 7 blobs and **zero commits** on a
final sweep. Same boundary from both ends. It wants packs rather than bundles,
which is a **gate change, not a fix**, and is awaiting a ruling.
