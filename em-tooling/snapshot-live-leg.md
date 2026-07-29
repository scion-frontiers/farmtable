> # ⛔ SUSPENDED 2026-07-29 — THIS RUNBOOK CONTAINS `git add -A`, WHICH IS FORBIDDEN TONIGHT
>
> **STANDING ORDER, coordinator, ALL LEGS, IN FORCE — SUPERSEDED WORDING REPLACED 09:20Z:**
> **NO OPERATION THAT CAPTURES FILES INTO GIT BY ANY CRITERION OTHER THAN A PATH YOU TYPED IN
> FULL.** Covers, non-exhaustively, **and the non-exhaustiveness is the point**: `git add -A`,
> `git add .`, `git add -u`, `git add` with a glob or a directory, `git stash -u`, `git stash -a`,
> `git commit -a`, `git commit` with a pathspec broader than one file. **IF YOU CANNOT NAME EVERY
> FILE THE COMMAND WILL TOUCH BEFORE YOU RUN IT, DO NOT RUN IT.**
> Filed as `briefs/_BRIEF-RULES.md` §32.1.
>
> **THE ORIGINAL 09:02:36Z WORDING BANNED TWO SPELLINGS AND THEREBY PERMITTED EVERY CONSTRUCTION
> NOBODY THOUGHT OF.** `git stash -u` sweeps untracked files into commits and was untouched by
> it — and had already fired three times on this host. **AN ENUMERATION PRESENTED AS A RULE IS
> READ AS COMPLETE BY EVERYONE DOWNSTREAM.** The suspension of this runbook stands regardless:
> the procedure below is a bulk capture by construction, not by spelling.
>
> **THIS FILE IS THE ONLY LIVE `git add -A` INSTRUCTION IN THE CORPUS.** A sweep of
> `briefs/ reports/ em-tooling/` returned 9 hits across 7 files; 6 of them are
> *descriptions* of the hazard. The occurrence in the fenced block below, in the step
> commented `writes objects to the DB; updates ONLY the temp index`, is an *instruction*.
> **DO NOT RUN THIS PROCEDURE UNTIL THIS BANNER IS LIFTED IN WRITING.**
>
> **WHY A BANNER AND NOT AN EDIT.** The order arrived by message. Per the filed rule,
> *a control delivered by message protects the agents who were running when it was sent
> and nobody else* — and **no brief, report or tool doc references this file by name**
> (`grep -rl snapshot-live-leg` over all three directories: zero hits). Its only route to
> a reader is a directory listing, which is exactly the population a channel cannot reach.
> Rewriting the procedure under time pressure, at this hour, on the one runbook we use to
> rescue crash-interrupted work, is how the next defect gets in. **The banner disarms;
> it does not repair.** Per `_BRIEF-RULES.md` §29, disarm by prepending, never by deleting.
>
> **THE SUBSTITUTE IS NOT A DROP-IN, AND THAT IS THE FINDING.** The obvious compliant
> rewrite derives an explicit path list from this procedure's own step 0,
> `git ls-files --others --exclude-standard`. **That predicate and `git add -A` share one
> ignore mechanism**, so the rewrite inherits the same blindness rather than curing it —
> and as of 09:01:15Z an anchored line in the *common* `.git/info/exclude` (canonical,
> therefore **all linked worktrees**) subtracts a root-level `test-writethrough.db` from
> both. **A file this runbook would have captured yesterday, it silently drops today.**
> One edit moved the publication path and the preservation path together; only the
> publication path was intended. If you need that file preserved, name it explicitly and
> use `-f`, and decide *deliberately* whether a credential-bearing artefact should enter
> the object store at all — the answer may well be no, but it must be an answer.
>
> **MEASURED, not reasoned** (throwaway repo, `git init`, anchored exclude, discarded):
> `git add -A` → **rc=0, stages nothing, silent**. `git add <explicit path>` → **rc=1,
> names the file, stages nothing**. `git add -f <path>` → **rc=0, stages it**. So the
> mandated form is the *loudest* form, not a bypass; the charge that explicit-path
> `git add` ignores exclude rules is **false as stated**.

# Snapshotting a LIVE leg without disturbing it

**Status:** standard procedure, coordinator-directed 2026-07-28 after it was used
to rescue `dev-xss-r4`'s crash-interrupted work.

**Problem it solves.** An agent leg has uncommitted work on disk. You need that
work to exist somewhere other than one directory — a crash, a `scion delete` with
uncharacterised worktree semantics, or a stray `rm -rf` currently costs you the
whole thing. But you must **not** change what the leg finds when it resumes.
Committing the dirty tree is the obvious move and it is wrong: it rewrites the
leg's idea of its own state mid-task.

**The property that matters.** After the snapshot, the leg's **working tree, real
index and HEAD are provably byte-identical** — verified *by hash*, not by
eyeballing `git status`.

---

## The procedure

```bash
set -eu
cd /workspace/<leg-tree>

# 0. PRE-REGISTER (see caveat below -- do not skip, do not copy the number)
git status --porcelain > /tmp/leg_porcelain_before
sha256sum < /tmp/leg_porcelain_before        # record this
git diff --shortstat                          # tracked-modified only
git ls-files --others --exclude-standard      # untracked, NOT in the line above

# 1. Snapshot through a TEMPORARY index
cp .git/index /tmp/legsnap.index
export GIT_INDEX_FILE=/tmp/legsnap.index
git add -A                       # writes objects to the DB; updates ONLY the temp index
TREE=$(git write-tree)
SNAP=$(git commit-tree "$TREE" -p HEAD -m "WIP SNAPSHOT (not authored by the leg): ...")
unset GIT_INDEX_FILE

# 2. Anchor it on a ref so it is fetchable (refs/preserve/, NEVER a branch)
git update-ref refs/preserve/wip-snapshot "$SNAP"

# 3. Copy into CANONICAL's object store
cd /workspace/farmtable
git fetch --no-tags /workspace/<leg-tree> \
  'refs/heads/<leg-branch>:refs/preserve/<name>/branch' \
  'refs/preserve/wip-snapshot:refs/preserve/<name>/wip-snapshot'

# 4. VERIFY BY READING CANONICAL -- never the fetch command's own output
git diff --stat 'refs/preserve/<name>/branch' 'refs/preserve/<name>/wip-snapshot'
git show 'refs/preserve/<name>/wip-snapshot:<the new file>' | wc -l

# 5. Prove the leg is undisturbed
git -C /workspace/<leg-tree> status --porcelain > /tmp/leg_porcelain_after
diff -q /tmp/leg_porcelain_before /tmp/leg_porcelain_after
git -C /workspace/<leg-tree> rev-parse HEAD    # unchanged
```

## Why the temporary index works

`GIT_INDEX_FILE` redirects *only the index*. `git add -A` still writes blob and
tree objects into the repository's object database — which is exactly what you
want, since that is what makes the content recoverable — but the staging record
lands in `/tmp`. The real `.git/index`, the working tree and `HEAD` are never
written.

`git add -A` **respects `.gitignore`**, so `web/dist` and `node_modules` stay out.
Confirm this by checking the snapshot's file count against your pre-registered
number; a wildly larger diff means an ignore rule is missing.

## Non-negotiables

- **Into canonical, never into `farmtable-em-verify195`.** That clone is itself in
  the GC-able population (task #170). Preserving a fragile artefact into the store
  that has the fragility defect reproduces the defect.
- **`refs/preserve/`, never a branch.** A branch invites a merge. This is a
  preservation artefact, not a proposal.
- **Say so in the commit message.** State plainly that the commit was created by
  the eng-manager during recovery, is *not* authored by the leg, and is on no
  branch. Otherwise a later reader — including a review leg — will read it as the
  leg's own work and attribute the content to them.
- **Never rewrite history to tidy this up.** A known-broken commit in a branch's
  history may be an open merge-time decision (e.g. `bc93200`, task #167). Copying
  objects preserves that decision; squashing forecloses it.

## The caveat that nearly cost us the whole point (see `_BRIEF-RULES.md` §25)

**Re-derive the pre-registered number from the artefact. Never copy it from a
prior report — including your own.**

On the night this procedure was written I had reported *"641 insertions across 7
files."* That conflated the tracked-modified diff (641 across **six** files) with
a separate 581-line untracked file. The number had been quoted back to me and
relayed onward, so it looked corroborated. Pre-registering `641` and observing
`641` would have passed — while silently preserving the snapshot **minus** its
most valuable artefact.

What caught it was re-measuring rather than copying: `641 tracked + 581 untracked
= 1222`, registered *before* the run. So:

- `git diff --shortstat` **does not include untracked files.** Count them
  separately and add them, every time.
- Derive the expectation by a **different route** than the check will use.
- A number that has circulated is the *most* dangerous input, not the safest.
