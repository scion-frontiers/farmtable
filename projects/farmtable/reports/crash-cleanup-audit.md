> # ⛔ VOID — EVERY DELETION RECOMMENDATION BELOW IS COUNTERMANDED. DO NOT ACT ON THIS FILE.
>
> **PREPENDED 2026-07-29 09:31Z by the eng-manager, on the coordinator's order. Nothing below
> this banner has been altered: no row edited, no table changed, no line renumbered.** The
> document is preserved exactly as its author wrote it because it is evidence, and rewriting
> evidence to match current policy destroys the record.
>
> ## THE ORDER THAT OVERRIDES IT
>
> **A DURABILITY FREEZE IS IN FORCE PROJECT-WIDE, AND IT IS EXTENDED TO AGENT DELETION.**
> **NO CONTAINER MAY BE DELETED. NO AGENT MAY BE DELETED. NO WORKTREE, REVIEW CLONE, THROWAWAY
> CLONE OR SCRATCH CHECKOUT MAY BE DELETED, REMOVED, PRUNED OR TIDIED — INCLUDING ONES THAT LOOK
> OBVIOUSLY STALE, INCLUDING ONES WHOSE AGENT HAS FINISHED, INCLUDING ONES YOU CREATED YOURSELF.**
> No `git gc`, no `prune`, no `repack`, no `reflog expire`, no `git worktree prune`, no editing of
> anything under `.git/worktrees/`. The freeze will be lifted explicitly and in writing or not at
> all. **The 21 agents assessed in this document are not yours, and they are not anybody's.**
>
> This file is the **only** live SAFE-TO-DELETE recommendation left in the corpus. The 08:27–08:31Z
> disarming pass bannered all thirteen **briefs** — including the brief that commissioned this very
> table, the one that says in terms *"You produce a recommendation table. The coordinator
> executes."* — and missed this because it is a **report**. That is the whole reason this banner
> exists, and it is a general finding, not a clerical one:
>
> > **A BANNER IS A CONFESSION THAT A HAZARD WAS FOUND, AND ITS COUNTERPART DOCUMENT IS WHERE THE
> > HAZARD ACTUALLY LIVES.** (Credit: `farmtable-predicate-2`, the independent second predicate.)
>
> Measured, so the gap is on the record: **`grep -ric 'freeze' reports/crash-cleanup-audit.md`
> → `reports/crash-cleanup-audit.md:0`.** A 446-line operational recommendation naming 18
> containers for disposal, written under a deletion freeze, containing zero occurrences of the
> word. The author is not at fault — the freeze post-dates the document — but a reader cannot tell
> that from inside the file, which is exactly the property that makes it dangerous.
>
> ## THE SHARPEST SENTENCE IN THE CORPUS, QUOTED SO IT CANNOT BE MISSED, AND VOID
>
> The final two lines of this document, at **lines 445–446 of the 446-line original** (sha256
> `73773a544ec159119fbfe9e0eafc4a8fd59df4dd4c22cf2ec4a59368ee671c41`), read verbatim:
>
> > *"If the coordinator rules that stopped-container transcripts are unrecoverable,*
> > *this becomes **18 SAFE-TO-DELETE / 0 HARVEST-FIRST / 3 KEEP = 21.**"*
>
> **THAT CONDITIONAL IS VOID. ITS ANTECEDENT IS NOT A LICENCE, AND NO RULING WILL BE ISSUED THAT
> SATISFIES IT.**
>
> Read what it actually proposes. **It makes unrecoverability an argument FOR deletion.** The two
> agents held back as HARVEST-FIRST (`test-auth`, `phase-arch`) are held back precisely because
> their work has not been extracted; the sentence says that if extraction turns out to be
> *impossible*, they may be destroyed. And this same document already supplies the evidence for its
> own antecedent — it records that `scion look` does not work on a stopped container and that every
> harvest plan in it is therefore unexecutable. So a reader who follows the file end-to-end reaches
> the licence and the proof of its trigger in the same pass, and destroys **the only surviving
> record of what eighteen agents were asked to do.** The correct inference from "we cannot get it
> back" is *keep it*, not *it no longer matters.*
>
> ## ANCHORING NOTE — THIS BANNER MOVES THE LINE IT CITES
>
> Per `briefs/_BRIEF-RULES.md` §30, **an annotation instruction citing `file:NNN` is falsified by
> the act of obeying it.** Prepending this banner shifts the sentence above off line 446. The line
> number is therefore recorded **against the pre-banner sha256 named above, as history**; the
> durable anchor is the **quotation**, which does not move. If you are looking for the sentence,
> search the text, not the number — it is the last line of the file.
>
> ## WHAT THIS FILE IS STILL GOOD FOR
>
> Everything except its recommendation column. The per-agent inventory — worktree paths, dirty/
> untracked/ahead counts, and the report artefact each agent produced — is a genuine and useful
> census, and the 16/2/3 = 21 arithmetic is sound against its stated roster of 21 out of a
> population of 30. **Read it as an inventory. It is not a work order.** If you believe something
> here needs removing, say so to the eng-manager and leave it exactly where it is.
>
> — end of banner; the original document begins below, unmodified —

# Crash-Cleanup Harvest Audit

**Author:** farmtable-cleanup-audit (investigator)
**Date:** 2026-07-29 ~00:25 UTC
**Scope:** **21 agents in the assigned roster**, out of a **total agent
population of 30**. The roster is a subset — stopped agents only — comprising 19
from the error list plus `dev-xss-r4` and `dev-195-r10`. The 9 agents outside the
roster are the live agents (`coordinator`, `farmtable-em-task-state-model-v2`,
this auditor `farmtable-cleanup-audit`) and the six live review legs. **Every
count in this document is against the roster of 21, never against the population
of 30, and is labelled as such.**
**Mode:** read-only. No deletes, no stop/suspend/resume, no builds, no tests, no
`git gc`/`prune`/any destructive git. Every git call used `--no-optional-locks`.
`/workspace/farmtable-em-verify195` and the six live `-review`/`-test`/`-audit`
legs were never touched.

---

## Summary

All **21 agents in the assigned roster** (of a 30-agent population) were
assessed. **16 SAFE-TO-DELETE, 2 HARVEST-FIRST, 3 KEEP.**

The headline is reassuring: **no unmerged commits and no stashes exist in any
assessed agent clone.** Every commit on every assessed clone's local branches is
reachable from the canonical repo at `/workspace/farmtable` (788 reachable
commits, verified by set membership, not by inference). Exactly one dirty file
exists across all assessed trees, and it is the already-adjudicated `scopes.go`
whitespace change in `farmtable-xss-r4`.

The risk in this cleanup is therefore **not** lost code. It is three other
things, in descending order of importance:

1. **`scion look` does not work on a stopped container** (verified — see
   Blocker). Every "harvest the transcript before deleting" plan is currently
   *unexecutable* without resuming the agent first. This is a decision the
   coordinator must make explicitly; it is not a detail.
2. **Two agents produced nothing durable and have no recorded scope**
   (`test-auth`, `phase-arch`). Deleting them destroys the only record of what
   they were asked to do.
3. **Canonical `/workspace/farmtable` holds 14 stashes and 7 untracked paths**
   (~67 MB), none of it attributable to a single agent with confidence. It is
   not at risk from container deletion, but it is exactly the material `git gc`
   would harm, and it is unowned.

---

## Method, and why the clean results are trustworthy

The brief warns about the vacuous pass. Three concrete guards were applied, and
two of them actually fired:

- **Authoritative workdir mapping, not name inference.** Working directories
  were read from `/workspace/.scion/agents/<name>/scion-agent.json`,
  field `volumes[].source`. This caught a live instance of the trap: **dev-xss-r3
  maps to `/workspace/farmtable-xss-r2`, and `/workspace/farmtable-xss-r3` does
  not exist at all** (only `-audit`/`-review`/`-test` do). Guessing from the name
  would have produced a clean-looking result from a nonexistent path.
- **Non-vacuity check on every clean verdict.** A clean `UNMERGED_COUNT: 0` is
  indistinguishable from "the commit list was empty." Every clone therefore also
  reports the number of commits actually walked. **The first run of this check
  returned 0 for all four batch-1 clones because of a shell-expansion bug** (`$G`
  holding a multi-word command). Had that been trusted, four clones would have
  been certified clean on a measurement that never ran. Re-run correctly: 303–361
  commits walked per clone.
- **Explicit `-C <path>` on every git call.** The `scion` CLI resets the shell
  cwd between calls, so ambient-cwd git would have been unreliable.
  Confirmed along the way that **`/workspace` is not a git repository**, which
  matters for the twelve root-mounted agents below.

"Reachable from canonical" means present in `git -C /workspace/farmtable rev-list
--all` — i.e. reachable from a ref, not merely present as an object. This
distinction matters because canonical demonstrably holds unreachable objects
(the measured `git gc` blast radius of 57 commits / 256 objects).

---

## Correction to a premise in the brief

The brief states most agents map to `/workspace/farmtable-<something>`. They do
not. **Twelve of twenty-one mount the project root**
(`/home/scion/.scion/projects/ft-2` → `/workspace`), which is not a git repo:

`anthropic-vertex-dev`, `c-phase`, `dev-195-r10`, `farmtable-architect-auth`,
`farmtable-scion-feature-request`, `flash-decomposer-v2`, `flash-tree-analyst`,
`gemma-decomposer-v2`, `phase-arch`, `prompt-variants-dev`, `test-auth`,
`tree-analyst`.

For these, "is its clone dirty" is undefined — they had no private clone. They
are assessed by **attribution** instead. Note this also means
`SCION_WORKSPACE_MODE=shared-plain` is *accurate* for these twelve, contrary to
the brief's blanket claim that the label is false; the label is false only for
the nine roster agents that do have private clones.

### The population is stratified 15 / 15, and that is a hard constraint

Confirmed by the coordinator against the full 30-agent population. My twelve are
the roster's share of a **15-agent shared stratum**; the three I could not see
are `coordinator`, `farmtable-em-task-state-model-v2`, and this auditor —
i.e. the two live agents excluded from the roster, plus me. 12 + 3 = 15, no
remainder. The other 15 are **private stratum**: every dev/review/test/audit
leg, one clone each, no source mounted twice.

**Attribution consequence, applied throughout the inventory below:** only
shared-stratum agents can physically write into `/workspace` or into canonical
`/workspace/farmtable`. A private-stratum leg mounts a different source and
*cannot*. This cuts the candidate set for every untracked file in canonical from
30 to 15 before a single mtime is considered. Evidence pointing at a
private-stratum leg as the author of something in canonical is a contradiction to
be reported, not a match to record — and one such collision did appear; see the
hotfix-179 row.

**One limit on that constraint, stated plainly:** it constrains the *current* 30
agents. Several untracked paths in canonical date from 21–23 July, and agents
deleted before this audit could have written them. So "unattributed" below means
"no current agent can be shown to own it," not "no agent ever did."

### Disclosure: this auditor is in the shared stratum

I mount the same `/workspace` as the coordinator and the EM. Accordingly:

- **What I created:** this file
  (`reports/crash-cleanup-audit.md`) on the shared scratchpad volume, and
  scratch files under my own private `/tmp` (`assess.sh`, `canon_sorted.txt`).
  **I created nothing in `/workspace` or in canonical**, and no file in the
  inventory below is mine.
- **Independently verified the shared mount** rather than taking it from config:
  `/workspace/_em-shared-mount-probe.txt` (119 B, Jul 29 00:23) written by the
  EM is readable from my container. It was *absent* from my 00:18 listing of
  `/workspace` and present at 00:26 — direct observation of the shared stratum
  changing under me mid-audit.
- **Load-bearing measurements were re-checked at 00:26:45Z** before this table
  was finalised: canonical untracked paths still 7, stashes still 14,
  `.eng-manager-state.md` unchanged at 662,314 B / Jul 29 00:08:12,
  `decomposer` unchanged at 23,650,037 B / Jul 21 19:48:33. All figures below
  are as observed at that time.

`/workspace/farmtable-old-live-web` and similar stale trees were not assessed —
no roster agent maps to them.

---

## Main table

Dirty / unmerged / stash counts are for the agent's own clone. `n/a (root)`
means the agent had no private clone; see the attribution section.

| # | Agent | Working directory (verified) | Dirty | Unmerged | Stash | Deliverables (bytes) | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | audit-xss-r3 | `/workspace/farmtable-xss-r3-audit` | 0 | 0 | 0 | `reports/audit-xss-r3.md` 54,327 | SAFE-TO-DELETE |
| 2 | test-xss-r3 | `/workspace/farmtable-xss-r3-test` | 0 | 0 | 0 | `reports/test-xss-r3.md` 61,282 | SAFE-TO-DELETE |
| 3 | review-xss-r3 | `/workspace/farmtable-xss-r3-review` | 0 | 0 | 0 | `reports/review-xss-r3.md` 36,176 | SAFE-TO-DELETE |
| 4 | dev-xss-r3 | `/workspace/farmtable-xss-r2` ⚠ not `-xss-r3` | 0 | 0 | 0 | `reports/dev-xss-r3.md` 29,702 | SAFE-TO-DELETE |
| 5 | test-auth | `/workspace` (root, not a repo) | n/a (root) | n/a | n/a | **none attributable** | **HARVEST-FIRST** |
| 6 | audit-195-r10 | `/workspace/farmtable-195-r10-audit` | 0 | 0 | 0 | `reports/audit-195-r10.md` 23,767 | SAFE-TO-DELETE |
| 7 | test-195-r10 | `/workspace/farmtable-195-r10-test` | 0 | 0 | 0 | `reports/test-195-r10.md` 28,050 | SAFE-TO-DELETE |
| 8 | review-195-r10 | `/workspace/farmtable-195-r10-review` | 0 | 0 | 0 | `reports/review-195-r10.md` 23,033 | SAFE-TO-DELETE |
| 9 | dev-195-r10 | `/workspace` (root, not a repo) | n/a (root) | n/a | n/a | `reports/dev-195-r10.md` 24,758 | **KEEP** (running/stalled) |
| 10 | c-phase | `/workspace` (root) | n/a (root) | n/a | n/a | `notes/task-state-model-cphase-decisions.md` 6,507 | SAFE-TO-DELETE |
| 11 | phase-arch | `/workspace` (root) | n/a (root) | n/a | n/a | **uncertain** — see §11 | **HARVEST-FIRST** |
| 12 | flash-tree-analyst | `/workspace` (root) | n/a (root) | n/a | n/a | `analysis-flash-v1-vs-v2.md` 16,408 | SAFE-TO-DELETE |
| 13 | prompt-variants-dev | `/workspace` (root) | n/a (root) | n/a | n/a | branch `feat/prompt-variants` @994f801 (unpushed) | SAFE-TO-DELETE |
| 14 | tree-analyst | `/workspace` (root) | n/a (root) | n/a | n/a | `analysis-haiku-vs-flash-v2.md` 17,501 | SAFE-TO-DELETE |
| 15 | anthropic-vertex-dev | `/workspace` (root) | n/a (root) | n/a | n/a | branch `worktree-anthropic-vertex` @b8c43fc (unpushed) | SAFE-TO-DELETE |
| 16 | flash-decomposer-v2 | `/workspace` (root) | n/a (root) | n/a | n/a | server-side collection; analysed in `analysis-flash-v1-vs-v2.md` | SAFE-TO-DELETE |
| 17 | gemma-decomposer-v2 | `/workspace` (root) | n/a (root) | n/a | n/a | server-side collection only — no local doc found | SAFE-TO-DELETE ⚠ |
| 18 | farmtable-architect-auth | `/workspace` (root) | n/a (root) | n/a | n/a | `auth-current-state.md` 12,352; `design-iap-token-header.md` 8,693; `auth-task-breakdown-log.md` 7,782; `auth-tasks-refine-log.md` 6,356; `task-edit-specs.md` 20,244 | SAFE-TO-DELETE |
| 19 | farmtable-scion-feature-request | `/workspace` (root) | n/a (root) | n/a | n/a | `reports/scion-worktree-feature-request.md` 5,048; `worktree-experiment.md` 7,376 | SAFE-TO-DELETE |
| 20 | **dev-xss-r4** (suspended) | `/workspace/farmtable-xss-r4` | **1** | 0 | 0 | inventory only — see §20 | **KEEP** (policy) |
| 21 | **dev-194-r11** | `/workspace/farmtable-194-r11` | 0 | 0 | 0 | inventory only — see §21 | **KEEP** (policy) |

Supporting measurements: commits walked per clone — xss-r3 leg and
`farmtable-xss-r2`: 303 each; 195-r10 leg: 354 each; `farmtable-xss-r4`: 309;
`farmtable-194-r11`: 361. All non-zero, so every `0 unmerged` above is a real
measurement rather than an empty set.

---

## Blocker that affects every harvest recommendation

**`scion look` fails on all stopped containers.** Verified against `test-auth`,
`c-phase`, and `phase-arch`; each returns:

```
Error response from daemon: container <id> is not running
```

Consequence: for any agent whose only remaining value is its transcript — which
is precisely the HARVEST-FIRST category — **the harvest cannot be performed with
the read-only tools available.** The options are (a) resume the agent to read it,
which contradicts the no-resume constraint and re-introduces load on a box that
crashed six hours ago, (b) read the transcript from the container filesystem via
docker directly, or (c) accept the loss.

I did not attempt any of these. This is a coordinator decision and it gates
agents #5 and #11. If the answer is (c), both become SAFE-TO-DELETE and the
final counts are 18 / 0 / 3.

---

## HARVEST-FIRST detail

### §5 — test-auth

- **Working directory:** `/workspace` (project root, not a git repo). Nothing to
  commit or stash.
- **What to save:** its transcript, and only its transcript.
- **Where it should go:** `/scion-volumes/scratchpad/projects/farmtable/salvage/test-auth-transcript.md`
- **Why it is not SAFE-TO-DELETE:** `prompt.md` is **empty**, so its assigned
  scope was never written down. No scratchpad file, branch, or report can be
  attributed to it. Its config was created 2026-07-27 18:22 UTC, inside the
  window of the container-auth incident documented in
  `reports/2026-07-27-infra-blocker-*.md`, and its name suggests it was a
  provisioning probe for that investigation — but **I could not confirm this and
  am not asserting it.** If the coordinator independently knows test-auth was a
  throwaway probe, downgrade it to SAFE-TO-DELETE without further work; that
  single fact is all that stands between it and deletion.
- **Cost of being wrong:** low. It produced no artifacts, so the worst case is
  losing the record of a probe.

### §11 — phase-arch

- **Working directory:** `/workspace` (project root, not a git repo).
- **What to save:** its transcript, plus confirmation of which design document
  it authored.
- **Where it should go:** `/scion-volumes/scratchpad/projects/farmtable/salvage/phase-arch-transcript.md`
- **Why it is not SAFE-TO-DELETE:** its `prompt.md` reads, in full, that the
  coordinator *was not given scope for this agent* and that it should contact
  ptone@google.com on Discord thread `1530561937409052805` to receive its
  assignment. **Its task therefore exists only in a Discord thread and in its own
  transcript — not in any brief, prompt, or file on this volume.** That is the
  textbook definition of context not reconstructible from artifacts.
- **Attribution attempt:** `analysis-task-state-model.md` (77,576 B, Jul 25
  15:52) and `design-task-state-model-contract.md` (32,206 B, Jul 27 01:02) both
  fall plausibly after phase-arch's config timestamp (Jul 25 13:07) and match an
  architect's output. **I could not confirm either is its work** and am recording
  this as unattributed rather than forcing a match. If phase-arch did author
  `analysis-task-state-model.md`, its output is durable and it drops to
  SAFE-TO-DELETE.
- **Cost of being wrong:** moderate. If it holds an assignment never captured
  elsewhere, that scope is unrecoverable.

---

## KEEP detail

### §9 — dev-195-r10 (PHASE=running, stalled ~2h)

Mounted at `/workspace` root; no private clone, so no dirty/unmerged/stash
measurement applies. Its report `reports/dev-195-r10.md` (24,758 B, Jul 28
09:38) is durable and substantial. **KEEP because it is still running** — it was
not stopped by the crash and is outside the cleanup's remit. Its stall is a
separate operational question I did not investigate and is not a deletion
decision. I did not signal, message, or otherwise disturb it.

### §20 — dev-xss-r4 (PHASE=suspended)

**KEEP by policy** — subject of an open review round. Inventory as requested:

- **Verified toplevel:** `/workspace/farmtable-xss-r4`
- **Branch:** `url-scheme-validation-r2` @ `e6bda716`
- **Unmerged commits: 0** of 309 walked — all work is reachable from canonical.
- **Stashes: 0**
- **Dirty: exactly 1 file**, `internal/server/scopes.go`.

Independent verification of that diff, as requested — it is what you were told
it is. `1 file changed, 6 insertions(+), 6 deletions(-)`; 12 changed lines by
`--numstat`, 6 logical lines. The entire change adds one space to the `=`
alignment of six `Scope*` constants (`ScopeWildcard`, `ScopeTaskRead`,
`ScopeTaskWrite`, `ScopeTaskClaim`, `ScopeTaskAccept`, `ScopeTaskClose`) so they
align with the longer `ScopeCollectionWrite` in the same `const` block. **All
string values are byte-identical; there is no semantic change.** Consistent with
pure gofmt alignment.

**Nothing else is dirty in this tree** — no untracked files, no other
modifications. The loud finding you asked for is that there is nothing loud.

### §21 — dev-194-r11

**KEEP by policy** — subject of an open review round. Crash victim, as stated.

- **Verified toplevel:** `/workspace/farmtable-194-r11`
- **Branch:** `label-write-scope-r11` @ `2cbbd928` (also holds
  `label-write-scope-r10`)
- **Unmerged commits: 0** of 361 walked. HEAD `2cbbd928` matches
  `refs/preserve/194-r11/branch` exactly, so the r11 work is preserved in
  canonical.
- **Stashes: 0. Dirty: 0. Untracked: 0.**

The tree currently under review is fully durable in canonical. Deleting the
container would cost only dev-194-r11's transcript.

---

## Attribution inventory: unowned content in the shared root and canonical

Per the coordinator's instruction, this inventories what the twelve root-mounted
agents may have left in shared space. **Nothing here was moved, cleaned, or
deleted.** Canonical `/workspace/farmtable` untracked paths:

| Path | Size / count | mtime | Attribution |
|---|---|---|---|
| `.eng-manager-state.md` | 662,314 B | **2026-07-29 00:08** | **Live eng-manager** (`farmtable-em-task-state-model-v2`, running). NOT a crashed agent's output. Do not touch. |
| `.claude/worktrees/` | 1,607 files, 43.9 MB | 2026-07-23 15:31 | **Unattributed.** Claude Code worktree scratch. Predates all Jul 24+ agents. |
| `decomposer` | 23,650,037 B (binary) | 2026-07-21 19:48 | **Unattributed.** A compiled binary. Predates flash-/gemma-decomposer-v2 (Jul 24), and both were instructed to build to `/tmp`, so it is *not* theirs. Likely from the Jul 21 decomposer-extras work. |
| `.scratchpad/pr-reviews/` | 7 files, 48,737 B | 2026-07-21 15:22–20:26 | **Unattributed.** Predates every roster agent. |
| `tasks/todo.md`, `tasks/plan.md` | 4,502 B | 2026-07-27 03:56 | **Unattributed.** No roster agent was active at that timestamp. |
| `.design/project-log/task-state-hotfix-179-code-review.md` | 1,788 B | 2026-07-27 06:37 | **Attribution collision — see below.** |
| `.design/project-log/task-state-hotfix-179-r3-code-review.md` | 1,562 B | 2026-07-27 06:53 | **Attribution collision — see below.** |

### The one collision, reported rather than resolved away

The two hotfix-179 files are the case the coordinator asked me to flag loudly.
**Their content points at a private-stratum author, which the mount constraint
says is impossible.**

What the evidence actually shows, after checking rather than assuming:

- They are **not** copies of leg output. The private leg clone
  `/workspace/farmtable-task-state-hotfix-179-r2/.design/project-log/` holds
  *different* documents — `-r2-security-audit.md`, `-r2-test-review.md`,
  `-r3-security-audit.md`, `-r3-test-review.md`. Both canonical files are
  **absent from the leg clone entirely** (verified by direct comparison).
- So these two `code-review` documents exist **only** as untracked files in
  canonical. They are unique content, not a mirror.
- The mount constraint therefore holds: a private leg did not write them. A
  **shared-stratum agent did** — and at 06:37 on Jul 27 the only shared-stratum
  agent demonstrably alive was `coordinator`. The alternative is a shared-mounted
  reviewer that has since been deleted.

**Resolution: not attributable to any of the 19 deletion candidates**, so this
cleanup does not endanger them. But they are unique, unowned, untracked copies
sitting in the one repo where `git gc` has a measured 57-commit / 256-object
blast radius. They deserve a home; they do not currently have one.

**Honest bottom line on attribution: I could not tie any of this content to any
of the twelve root-mounted roster agents.** Applying the 15/15 constraint
sharpens the picture in the cleanup's favour — the plausible authors of nearly
all of it are `coordinator` and the live EM, **neither of which is being
deleted**, plus shared-mounted agents that no longer exist. Every item either
predates the roster agent that might have owned it, belongs to a round outside
the roster, or belongs to a live agent. Six of the seven are genuinely unowned. I
am reporting them unattributed rather than manufacturing owners.

**Net effect on the deletion decision: none of the seven untracked paths is at
risk from deleting any of the 19 candidates.** The exposure here is to
`gc`/`clean`, not to this cleanup.

### Canonical also holds 14 stashes

`git -C /workspace/farmtable stash list` returns 14 entries spanning
`stash@{0}` (WIP on main @5d197fe, IAP session-token work) through `stash@{13}`
(WIP on main @36ae463, LinkedAccount schema). They are old — the branch names
(`feat/extstore-*`, `fix/passthrough-spinner`, `feat/f35-inspector-title-constant`)
are from the extstore and passthrough eras, not from any roster agent.

They are **not at risk from container deletion**, so they do not change any
verdict. They are flagged for one reason: **they are exactly what `git gc` in
canonical would endanger**, and they are unowned, so no agent is going to claim
them. Worth a deliberate keep-or-drop decision at some point, made by a human,
not swept up in a cleanup.

---

## Delivery-without-consumption flags

Per the brief: these deliverables are durable, but show no sign of having been
picked up. Deleting the agent removes the last chance to ask what they meant.

- **`reports/audit-195-r10.md`, `test-195-r10.md`, `review-195-r10.md`** (Jul 28
  ~10:00). The 195 line stops at r10 — there is no r11 leg and no
  `farmtable-195-r11` tree, while the 194 line went on to r11 and xss to r4. The
  195-r10 round produced three substantial reports and then the line simply
  ended six hours before the crash. Whether that was a deliberate stop or the
  round was dropped, I could not determine.
- **`reports/dev-xss-r3.md`, `audit-xss-r3.md`, `test-xss-r3.md`,
  `review-xss-r3.md`** (Jul 28 11:39–12:19) were superseded by the r4 round,
  which is live now. Normal supersession, noted for completeness.
- **`branch feat/prompt-variants` @994f801 and `worktree-anthropic-vertex`
  @b8c43fc** exist only as *local* branches in canonical — there is no
  `origin/` counterpart for either. They are durable because canonical survives
  container deletion, but they were never pushed, so they are one bad
  `git gc`/branch-prune away from loss and nobody upstream can see them.
- **`gemma-decomposer-v2` (#17)** is the weakest SAFE-TO-DELETE in this table.
  Unlike `flash-decomposer-v2`, whose run is analysed in
  `analysis-flash-v1-vs-v2.md`, I found **no local document analysing or even
  recording the gemma run**. Its output should exist as a collection on the Cloud
  Run server — durable, but *not on this volume* and I could not verify it from
  here. If the gemma run matters, confirm the server-side collection exists
  before deleting the container.

---

## Evidence that these agents finished before the crash

The roster's `PHASE=error` is the crash signature, not a work status, so
completion evidence must come from outside it. For the eight agents of the
xss-r3 and 195-r10 legs it does, and it is clean:

- The crash was ~18:15 UTC on 2026-07-28.
- All eight leg reports were written **Jul 28 09:38–12:19 UTC** — six or more
  hours *before* the crash.
- All eight clones are clean, with zero unmerged commits and zero stashes.

An agent killed mid-sentence does not leave a clean tree, a fully-merged branch,
and a 20–60 KB report finished six hours earlier. These eight were idle when the
crash arrived.

---

## Open questions

1. **Can transcripts be recovered from stopped containers?** Gates #5 and #11.
   `scion look` cannot do it. If the answer is no, both become SAFE-TO-DELETE.
2. **Was `test-auth` a throwaway provisioning probe?** Its empty `prompt.md`
   means only the coordinator or ptone can answer. One sentence resolves it.
3. **Did `phase-arch` author `analysis-task-state-model.md`?** If yes, it is
   SAFE-TO-DELETE. Its assignment lives in Discord thread
   `1530561937409052805`.
4. **Was the 195 line stopped deliberately at r10?** Affects whether the r10
   reports are finished work or a dropped thread.
5. **Is the gemma-decomposer-v2 server-side collection still present?** Not
   checkable from this container without network calls I did not make.

None of these block the 16 SAFE-TO-DELETE verdicts.

---

## Final count

**Agents assessed: 21 — the full assigned roster.**
**Denominator: 21 of a 30-agent population.** The 9 not assessed are
`coordinator`, `farmtable-em-task-state-model-v2`, this auditor, and the six
live review legs (`audit`/`test`/`review`-`xss-r4` and `-194-r11`), all excluded
as live. 21 + 9 = 30, no remainder.

| Verdict | Count | Agents |
|---|---|---|
| SAFE-TO-DELETE | **16** | audit-xss-r3, test-xss-r3, review-xss-r3, dev-xss-r3, audit-195-r10, test-195-r10, review-195-r10, c-phase, flash-tree-analyst, prompt-variants-dev, tree-analyst, anthropic-vertex-dev, flash-decomposer-v2, gemma-decomposer-v2, farmtable-architect-auth, farmtable-scion-feature-request |
| HARVEST-FIRST | **2** | test-auth, phase-arch |
| KEEP | **3** | dev-195-r10, dev-xss-r4, dev-194-r11 |

**16 + 2 + 3 = 21.** Matches the number assessed.

If the coordinator rules that stopped-container transcripts are unrecoverable,
this becomes **18 SAFE-TO-DELETE / 0 HARVEST-FIRST / 3 KEEP = 21.**
