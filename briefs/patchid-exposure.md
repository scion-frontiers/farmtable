# BRIEF: patchid-exposure

## READ THIS SECTION BEFORE ANYTHING ELSE

HARD PROHIBITIONS, IN FORCE FOR THE WHOLE TASK:

- DO NOT BUILD, TEST, VET, LINT, COMPILE OR RUN ANYTHING. No go build, no go test, no npm, no
  make. This host locked up earlier tonight from concurrent Go builds and the recovery is still
  in progress. Your task requires none of it. If you believe it does, stop and ask.
- DO NOT RUN git gc, git prune, git repack, git reflog expire, or any command that triggers
  auto-maintenance. Pass -c gc.auto=0 --no-auto-maintenance on every git invocation that could.
  A freeze is in force protecting objects that exist in exactly one place.
- DO NOT create, delete, move or update any ref anywhere. DO NOT commit. DO NOT push. DO NOT
  fetch into an existing tree. This task is READ-ONLY.
- DO NOT touch /workspace/farmtable-em-verify195 except with read-only queries. Reading is
  explicitly permitted. Writing, moving, deleting and collecting are not.
- NEVER echo, cat, print, log or paste any credential. Never run bare git remote -v; always pipe
  through sed -E 's#//[^@]*@#//REDACTED@#g'. Git remote URLs on this host contain a live token.
- NEVER TERMINATE A COMMAND WITH AN ECHO OF ITS OWN STATUS. VERIFY BY ARTEFACT, NEVER BY STATUS
  LINE. Four separate agents on this fleet have manufactured a false green this way tonight.

## THE OUTCOME I AM BUYING, WHICH IS NOT THE SAME AS THE ACTION I AM COMMISSIONING

OUTCOME: I need to know whether a set of at-risk commits represents WORK THAT WOULD BE LOST or
TOMBSTONES OF WORK THAT IS ALREADY SAFELY MERGED. That single fact decides whether this is an
incident requiring a human decision or a curiosity requiring none.

ACTION: compare each at-risk commit's patch-id against the patch-ids of commits reachable from
the real published main, and classify.

These are not the same. If partway through you find the action cannot settle the outcome - for
example because the commits are merges, or empty, or the patch-ids collide uselessly - then
REPORTING THAT THE ACTION DOES NOT BUY THE OUTCOME IS A COMPLETE AND SUCCESSFUL RESULT. Do not
manufacture a classification to fill the table.

## BACKGROUND, STATED AS FACTS YOU MAY RELY ON

126 commits on this host are reachable from no ref, contained in no bundle, present on no remote,
and held by nothing at all in 124 cases. They survive only because a garbage-collection freeze is
in force. A push cannot save them and a bundle cannot save them, because both carry only
ref-reachable objects.

Of those 126: 82 carry a tree matching no ref-reachable commit; 44 are amend or stash-index
debris. Of the 82, 39 are stash-shaped, 41 are ordinary feature commits dated 2026-07-19 to
2026-07-29, and 2 are DELIBERATE NEGATIVE CONTROLS planted by another agent whose commit subjects
read "On NO ref... DO NOT FETCH THIS". LEAVE THOSE TWO ALONE. Do not fetch them, do not rescue
them, do not include them in any rescue recommendation. Classify them and move on - destroying
another leg's experiment would be a worse outcome than losing them.

THE 41 ORDINARY FEATURE COMMITS ARE THE POPULATION THIS TASK EXISTS FOR. Their subjects cite
merged pull request numbers, which makes them PLAUSIBLY pre-squash originals of work that is
already in main. Plausibly is not measured. Measure it.

## A DELIBERATE RELAXATION OF OUR USUAL RULE, AND WHY

This project normally requires COLD-FIRST: a leg measures independently before reading prior work
on the same question. I am relaxing it here and I want you to know it is deliberate rather than
an oversight.

You MAY read the data file /scion-volumes/scratchpad/projects/farmtable/preserve/UNREACHABLE-EXPOSURE.tsv
(126 rows, commit + subject + author date). That is your input population.

You MUST NOT read /scion-volumes/scratchpad/projects/farmtable/reports/preserve-bundle.md or
/scion-volumes/scratchpad/projects/farmtable/preserve/MANIFEST.md. Those carry the previous leg's
interpretation and I want your classification uncontaminated by it.

The reason for the split: cold-first buys independence of MEASUREMENT, and the 126-row list is a
mechanically derived input that has already been re-run under assertion. Re-deriving it would cost
an fsck across many stores and buy almost nothing. What I need independent is the JUDGEMENT about
what those commits are. So you inherit the data and not the conclusions. Cold-first has been right
four times tonight and it is not free; this is me paying for it deliberately in one direction.

## STALENESS WARNING - THIS WILL BITE YOU IF YOU IGNORE IT

REAL MAIN ON THE SERVER IS TWELVE COMMITS AHEAD OF WHAT EVERY LOCAL TREE ON THIS HOST CALLS MAIN.
At least two agents have already drawn wrong conclusions from the stale value.

Your comparison is against PUBLISHED work. If you compare against a stale main you will classify
commits as unpublished that are in fact published, and the whole answer inverts in the dangerous
direction - it will look like MORE is at risk than really is, and I will escalate something I
should not.

Get the server's main. A fetch into a THROWAWAY clone under /tmp is permitted and is not a write
to any existing tree; use -c gc.auto=0 --no-auto-maintenance. Prefer git ls-remote to resolve what
  > **CORRECTED 2026-07-29 07:12Z: `ls-remote` IS ONLY AS FRESH AS THE REMOTE IT NAMES.**
  > In this topology most trees' `origin` is `/workspace/farmtable`, a LOCAL CLONE pinned
  > at `7a0f220` and twelve commits behind real `main` (`cc92735`). Naming a stale
  > intermediary inherits its staleness, confidently. `ls-remote` the GitHub URL, not `origin`.
the server actually has. STATE IN YOUR REPORT WHICH SHA YOU COMPARED AGAINST AND HOW YOU OBTAINED
IT. If you cannot reach the server, say so and stop - do not silently fall back to a local ref.

## WHAT TO ACTUALLY DO

1. Resolve real published main from the server. Record the SHA and the method.
2. Build the patch-id index of published history: git log --no-merges <main> then git patch-id
   --stable over the diffs. Decide and STATE whether you bounded the history by date or depth; if
   you bounded it, that bound is part of your result and belongs in the artefact, not in a note.
3. For each of the 126, compute a patch-id where one is meaningful. Merges and empty commits have
   no useful patch-id - report those as their own category rather than forcing them.
4. Classify every one of the 126 into exactly one of:
   - DUPLICATE: patch-id matches a published commit. The content is safe; the commit object is a
     tombstone. Losing it loses nothing but history shape.
   - UNIQUE: no published patch-id matches. The content exists nowhere published.
   - INDETERMINATE: cannot be settled by patch-id. Say why, per commit.
5. For anything you classify UNIQUE, go one step further and say what it appears to be from its
   diff - a source change, a test, a lockfile, generated output, a scratch experiment. I need to
   know whether unique means valuable.

## HOW TO REPORT

- ANY POPULATION COUNT OF TEN OR FEWER IS REPORTED AS THE LIST, NOT AS THE NUMBER. Give the SHAs
  and subjects. A number cannot be recognised by a reader holding a different question.
- Report the DISTINCT CATEGORIES YOU FOUND, not only the ones I asked for. If a fifth kind of
  thing is in there, name it.
- A NEGATIVE IS A RESULT. If all 41 are duplicates, that is the best possible news and I want it
  stated plainly and early, not softened.
- Every count carries whether it is deduped.
- State every bound on your search inside the artefact that carries the finding. A bound recorded
  only in a chat message does not travel with the result.

## DELIVERABLES

1. /scion-volumes/scratchpad/projects/farmtable/reports/patchid-exposure.md - the classification,
   the method, the main SHA compared against, and every bound.
2. /scion-volumes/scratchpad/projects/farmtable/preserve/PATCHID-CLASSIFICATION.tsv - one row per
   commit: sha, classification, matched-published-sha if any, short reason.
3. A summary message to the coordinator whose FIRST LINE answers only this: of the 41 ordinary
   feature commits, how many are unique content.

## DIRECT CONTACT

Questions you cannot resolve from this brief go to the coordinator agent named coordinator, by
scion message. Do not contact the user. Do not contact other agents about this task; several are
running measurements that must stay independent of yours.

## TERMINATION

You MUST produce both artefacts above and send the summary message, and then mark the task
complete. If the action turns out not to buy the outcome, produce the artefacts saying exactly
that, send the message, and mark complete.
