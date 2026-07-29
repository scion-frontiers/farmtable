# Brief: SIX COMMITS EXIST ON ONE DISK AND ON NO REMOTE. Produce a restore that you have proven restores.

## READ THIS FIRST — CONSTRAINTS

1. **NO BUILD TOKEN. DO NOT BUILD, TEST, VET, LINT, OR RUN THE APPLICATION.** Exactly one
   build token exists project-wide and another leg holds it. This host hard-locked on
   2026-07-28 from concurrent Go builds. Everything here is git plumbing and file copying.
2. **NO git gc. NO git prune. NO git repack. NOWHERE, NOT EVEN IN A TEMPORARY CLONE OF YOUR
   OWN.** Measured blast radius on this host: 57 commits, 256 objects.
3. **DO NOT PUSH. DO NOT COMMIT TO ANY BRANCH. DO NOT DELETE OR MOVE ANY REF.** You are
   read-only on every repository. You write only under the scratchpad path named below and
   under a throwaway directory in /tmp.
4. **DO NOT TOUCH /workspace/farmtable-em-verify195** — do not read into it, delete it, move
   it, or collect it.
5. **NEVER run bare git remote -v; never print, echo, log, or paste a token.** Remote URLs in
   these trees have credentials embedded. If you must inspect a remote, pipe through:
   sed -E 's#//[^@]*@#//REDACTED@#g'
6. **Contact the coordinator only** (agent name: coordinator). Not the eng-manager, not any
   other leg, not the user.

## THE ONE IDEA THIS TASK IS ABOUT

  **A BACKUP FILE IS A RECEIPT.** An artefact that records that a backup happened is
  indistinguishable, to every later reader, from the data being safe — and it is worse than no
  backup, because the absence of one invites someone to make one and its presence forecloses
  that.

So the deliverable is **not a bundle**. The deliverable is **a bundle you have restored from,
in a scratch directory, and verified by content hash**. A bundle that exists and does not
restore is the worst possible outcome of this task and it will look exactly like success.

## THE SITUATION — [M] measured by another leg, re-verify anything you rely on

A test suite is pinned as merge-blocking for work in flight:
`web/src/util/url-binding-scan.test.ts`, blob `c8cb6993581fa202c44cf702f41680fa96442a78`,
68066 bytes.

**Six commits touch it. ZERO REMOTE REFS CONTAIN ANY OF THEM.** It is present at these commits
and absent at every published one:

- PRESENT: `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1`, `d5e35a4869475cd79c3a46e791909a610d1ea8f2`
  (the pin), `d305391...` (r5 tip), `7cee4a6...` (r6 tip **at 06:19Z — this one is moving**),
  and it was created at `f0ab53f85eb4ee3686168bfcea3ee51a3dba3763`.
- ABSENT: `7a0f220` (origin/main), `6c0fcfb`, `633f8f2` (canonical tip).

Two refs are believed stable and are the intended anchors:
- `refs/preserve/dev-103-testlist/xss-pin-0256Z` = `d5e35a48...`
- `refs/preserve/xss-r4/final-e6bda71` = `e6bda716...`

**Do not trust this list. Re-derive the commit set yourself and report any disagreement with
it** — a disagreement is a finding, not an inconvenience.

## APPARATUS — EVERY ONE OF THESE COST A LEG REAL WORK IN THE LAST TWELVE HOURS

- **A GIT COMMAND CARRIES TWO POPULATION SELECTORS: THE ROOT AND THE REVISION.** A leg tonight
  ran a command with root = canonical and revision = an unpushed commit, then described what it
  had searched as "canonical." The root is where you were; the revision is an argument; **only
  the root travels into your memory of what you did.** State both, every time, in every claim.
- **ANY BOUND ON A SEARCH IS PART OF ITS RESULT** — depth, count, ref namespace, revision,
  time. A leg used `find -maxdepth 4` on a path at depth 6 and got exit 0 with no output.
  **A TRUNCATED FIND DOES NOT LOOK TRUNCATED. IT LOOKS CLEAN.** Report every bound you set.
- **THE POPULATION MOVES WHILE YOU MEASURE IT.** The r6 branch advanced during the previous
  leg's investigation. **Record the SHA of every ref at the moment you capture it, and bundle
  by SHA, not by branch name.** A branch tip is a timestamped observation wearing a name.
- **THIS IS zsh, NOT bash. AN UNQUOTED GLOB THAT MATCHES NOTHING KILLS THE ENTIRE COMMAND
  LINE**, including inside a for-list. Quote every glob.
- **`${PIPESTATUS[0]}` IS EMPTY HERE.** The zsh array is `$pipestatus` and it is **1-indexed**.
  It is **clobbered by any command that runs between the pipeline and the capture**, and the
  clobber does not blank it — it replaces it with a zero. Capture immediately, print later.
- **NEVER redirect stderr to /dev/null on an exploratory command.** A leg tonight muted a
  diagnostic and filed its own silence as a finding. An unread diagnostic is recoverable; a
  silenced one is destroyed at capture.
- **Absolute paths always** — the harness resets the working directory between calls.
- **Mark every claim [M] MEASURED, [D] DERIVED, or [U] UNCHECKED, in the sentence itself.**

## WHAT TO DO

**STAGE 1 — THE TARGETED BUNDLE. This is the urgent part; land it before anything else.**

1. Find which repository's object store actually holds these objects. The `refs/preserve/*`
   refs are believed to live in `/workspace/farmtable`, but **verify it rather than assume it**;
   there are many worktrees on this host and objects may be shared or may not be.
2. Create `/scion-volumes/scratchpad/projects/farmtable/preserve/` and write a bundle there
   containing every ref needed to reach all six commits, plus the two `refs/preserve` anchors
   and the r5 and r6 tips as of your capture. Name it for its content, not for a date alone.
3. **PROVE THE RESTORE.** In a throwaway directory under /tmp: clone or init-and-fetch from the
   bundle, then confirm the file is really there and really intact —
   `git hash-object` on the restored file must equal `c8cb6993581fa202c44cf702f41680fa96442a78`
   and the byte count must equal 68066. **Hash the restored content. Do not hash the bundle.**
4. Run `git bundle verify` as well, and report its output — but note that it checks
   prerequisites, not that your file survived. Step 3 is the real proof and step 4 is not a
   substitute for it.
5. Write a manifest next to the bundle recording: every ref name with the SHA it had **at
   capture time**, the capture timestamp, the sha256 of the bundle file, and **the exact
   restore command you actually ran and that actually worked** — copy-pasteable, no placeholders.

**STAGE 2 — MEASURE, DO NOT YET CREATE.** The targeted bundle protects one suite. There are
reportedly ~205 local heads and ~94 preserve refs on this host and no remote contains much of
it. **Measure what a bundle of all local refs would cost** — object count and estimated bytes,
via plumbing, not by building it — and report the number to the coordinator. **Do not create it
without being told to.** If it is small, we will just take it.

## DELIVERABLES

1. The bundle and its manifest under
   `/scion-volumes/scratchpad/projects/farmtable/preserve/`.
2. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/preserve-bundle.md` containing: what
   you verified about where the objects live; the commit set you derived and any disagreement
   with the list above; the restore proof with the hash you actually computed; the Stage 2
   size measurement; and a **NOT REACHED** section naming every bound you did not measure, each
   with the specific observation that would settle it.
3. **One line, stated plainly: has a restore been performed and verified, yes or no.** If no,
   say no. A clean "no, and here is what stopped me" is a complete and correct result.

## DIRECT CONTACT

Coordinator, agent name **coordinator**, via scion message. If any instruction here looks wrong
to you, **say so rather than quietly doing something else** — a disagreement voiced is useful,
a substitution made silently is the failure mode this whole project has been fighting.

## TERMINATION

You MUST produce the bundle, the manifest, and the report at the paths above, answer the
one-line restore question, and then mark the task complete.
