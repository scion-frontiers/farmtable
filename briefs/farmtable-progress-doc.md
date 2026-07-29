# BRIEF: farmtable-progress-doc — write the project progress summary for the owner

## HARD RULES. READ THESE FIRST.

1. **NO CREDENTIAL VALUE, TOKEN, KEY, OR HASH-OF-A-TOKEN GOES IN THE DOCUMENT.** Not
   redacted, not partial, not a digest. This document goes to shared storage. Describe
   exposures in words only ("a configuration file in the repository checkout"), never by
   value and never by digest.
2. **NEVER RUN `git add -A`, `git add .`, `git add -u`, `git commit -a`, or any glob or
   directory pathspec.** There is an untracked, unignored file on this shared filesystem
   holding a live credential, inside a tree whose git object store is shared with a
   repository that can push. If you cannot name every file a command will touch, do not
   run the command. You should not need git at all for this task.
3. **NEVER PUT A CREDENTIAL ON A COMMAND LINE.** Arguments are permanently recorded here.
4. **DO NOT INVENT A DOCUMENT REFERENCE.** See section 2. If you cannot find a document,
   say you could not find it. A named gap is worth more than a plausible guess.

## 1. WHAT THIS IS

The project owner (ptone) has asked for the current progress report to be saved as a
document in the scratchpad, cross-referenced to the two documents that started this work.
His exact words:

  "can you save that all out as a progress summary doc in the scratchpad. please reference
   the c-phase decision doc and the task state refactor plan that started our work off"

**YOU ARE WRITING FOR HIM, NOT FOR US.** He has said twice, explicitly, that he cannot use
coded references into documents he does not have in front of him. So:

- **NO** finding IDs, ticket numbers, round numbers ("r6", "r9"), commit SHAs, agent names,
  or `file.go:1509` citations in the body.
- **YES** to plain descriptions of what is wrong and what it does to a user.
- Where a technical anchor genuinely helps a future reader, put it in a clearly-marked
  appendix at the end, NOT in the body.
- Write so that a competent person with no context can read it start to finish and
  understand where the project stands.

## 2. THE TWO DOCUMENTS YOU MUST FIND AND REFERENCE

Search `/scion-volumes/scratchpad/projects/farmtable/` and its subdirectories.

**(a) The task state refactor plan** — the original plan that kicked this work off. A
strong candidate is `analysis-task-state-model.md` in the project root, but **VERIFY BY
READING IT** rather than assuming from the filename. There may be a later or better
version. If several candidates exist, name them all and say which you used and why.

**(b) The "c-phase decision doc"** — a decision document, probably concerning a phase
named or lettered "C". **I DO NOT KNOW WHERE THIS IS OR WHAT IT IS CALLED, AND I AM NOT
GOING TO GUESS FOR YOU.** Search by content as well as filename. If you find nothing that
credibly matches, **SAY SO EXPLICITLY IN THE DOCUMENT** in a line the owner will see —
something like "I could not locate a document matching this description; the closest
candidates were X and Y." He knows what he meant and can point us at it. **DO NOT SILENTLY
OMIT IT AND DO NOT ATTACH THE LABEL TO SOMETHING THAT MERELY LOOKS SIMILAR.**

For each document you do find: give its full path, its actual title, its date if
determinable, and one or two sentences on what it committed the project to — then relate
current status back to that commitment. **The point of referencing them is to answer "are
we doing what we said we would?"** — not merely to cite them.

## 3. THE PROJECT STATUS CONTENT — USE THIS, IT IS ALREADY WRITTEN AND ALREADY APPROVED

The engineering manager produced the following for the owner earlier today. It has already
been sent to him. **Preserve its substance and its honesty.** You may restructure it to fit
the document, but do not soften it and do not drop the UNVERIFIED markers.

---BEGIN EM SUMMARY---
1. THE TASK STATE REFACTOR - WHAT IS ACTUALLY BUILT

The refactor gives tasks a real lifecycle state instead of inferring their status from
whatever labels happen to be attached. The first phase of that is finished, merged and
running in production. A user gets a genuine benefit from it today: task state is tracked
and displayed consistently, and tasks backed by GitHub issues keep their stage in step with
the issue rather than drifting.

The honest part is what happened next. Reviewing that first phase turned up security
problems in the surrounding code - not in the refactor itself, but in the paths it made
easier to reach. Essentially all engineering effort since has gone into those problems. The
remaining refactor work has not been touched in that time. If you were tracking this by
review activity it would look like steady progress on the refactor; it is not. It is steady
progress on defects found next to it.

2. WHAT IS MERGED AND WHAT IS NOT - AND THE GAP IS LARGE

Merged and live: the first phase, as above. That is the whole of it.

Not merged: three branches of security and correctness work, none of which has landed any
production change. The largest is sixty-seven commits ahead of main and twelve behind it.
Nothing from any of the three has reached a user. The gap between work done and work
shipped is currently the entire body of work from the last stretch, and I do not want that
read as nearly-done. Each branch has been through repeated review cycles and each cycle has
found something blocking. That pattern has not yet broken, and I would not forecast a merge
date from it.

3. WHY THE REVIEWS SAY DO NOT MERGE - IN TERMS OF WHAT IT DOES TO A USER

Two things, both real.

The first: text that arrives from outside - a task description, an imported document, data
pulled back from GitHub - can put a link into the dashboard that runs code instead of
navigating somewhere. If a user views a task containing such a link and clicks it, code
chosen by whoever wrote that text runs in their browser, in their logged-in session, on a
page that holds a long-lived API token. That is the defect the current cycle is trying to
close. Several fixes have been written for it. Each time, the review found a slightly
different way of spelling the same attack that the fix did not cover. The fix is getting
narrower each cycle, which is progress, but it is not closed.

The second: the permission checks around changing a task's lifecycle state can be bypassed.
Someone allowed to edit a task can, in certain configurations, change its lifecycle state -
including closing it - without holding the permission that is supposed to be required for
that. Nobody outside the organisation can reach it, because the whole service sits behind
the identity proxy, but inside that boundary it is a real hole.

Separately, because it is not on either branch and it is already live: there is an endpoint
in production that writes stored access tokens with no permission check on the caller at
all. It is behind the same proxy. It is not theoretical and it has not been fixed.
[UNVERIFIED since the crash restore.]

4. MAIN IS RED

The test suite on main does not pass reliably. The cause is understood: a piece of
background work is started without any way for the test that started it to wait for it to
finish, so tests can see data left behind by other tests. It is not a recent breakage and
it is not caused by any branch in review. [UNVERIFIED since the crash restore.]

What it costs us is worse than one failing test. When the baseline is unreliable, a failure
in new work cannot be distinguished from the existing noise, so every pass and every
failure we report from the test suite is weaker evidence than it looks.

5. CI

CI now exists. It landed on main yesterday evening.

The problem is that the branches in review were all created before it existed. The trigger
reads its instructions from the commit being pushed, so pushing one of those branches does
not produce a failing CI run - it produces no CI run at all. Silence is indistinguishable
from success. Every one of these branches has to be brought up to date with main before it
goes near a merge, or we will read an empty result as a green one.

A second version of the same trap: a freshly cloned copy of the repository cannot be built
at all, because some files the build needs are not stored in it. Any build that ever
succeeded did so on a machine that already had them lying around. [UNVERIFIED.] CI now
catches this case, which is the one genuinely good piece of news here.
---END EM SUMMARY---

## 4. THE OTHER THING THAT HAPPENED, AND IT MUST BE IN THE DOCUMENT HONESTLY

Roughly eleven hours of effort went into a credential-exposure investigation rather than
into the project. **Do not bury this and do not dress it up.** The facts:

- It was triggered by discovering that a live administrative GitHub credential belonging to
  the owner was sitting in plain text in several files on the shared machine.
- Five investigation agents swept the host. They found the credential in eight distinct
  places. One of those is a loose database file sitting inside a repository checkout that
  is configured to push to GitHub — meaning a single careless bulk `git add` would have
  published it. That specific risk is now guarded by a standing rule and remains guarded.
- **The credential was NOT rotated.** The owner instructed us to stop work on it. So the
  correct status line is: **ACCEPTED RISK BY OWNER INSTRUCTION — NOT RESOLVED.** Use those
  words. Do not write "handled", "addressed", "mitigated", or "closed".
- Known gaps deliberately left open, which must be listed as open: compressed storage
  inside the repository's history was never searched, and that search fails toward looking
  clean, so the count of eight is a floor and not a total.
- **The eleven hours were a cost to delivery that nobody put to the owner as a choice until
  he asked.** That is the honest framing and it is the coordinator's fault, not the
  engineering manager's. Say it plainly in one or two sentences. Do not editorialise
  further and do not apologise at length — state it and move on.

There is also a large body of methodology findings from that work (roughly a hundred, about
measurement tools silently returning wrong answers). **DO NOT SUMMARISE THEM IN THIS
DOCUMENT.** One sentence noting they exist, that they are recorded separately, and where.
This document is about project progress.

## 5. SOURCE MATERIAL

Read these — they are the investigation legs' own final write-ups, all in
`/scion-volumes/scratchpad/projects/farmtable/reports/`:
- `relocate-offhost-final.md`
- `reconcile-urlbindingscan-final.md`
- `predicate-2-final.md`
- `preserve-bundle-final.md`
- any file matching `*-final.md` you find alongside them

Also available if useful: `HANDOFF-METHODOLOGY.md` in the project root, and
`analysis-task-state-model.md`.

**Do NOT read `/workspace/.coordinator-state.md`.** It is 1.3 MB of raw working notes and
it will exhaust your context for very little gain. Everything you need is above.

## 6. SUGGESTED SHAPE (adapt if you find better)

1. What this document is, and the date/time it reflects.
2. The two founding documents — path, title, what each committed us to.
3. Where the refactor actually stands against that plan.
4. What is shipped vs what is stuck, and why.
5. The defects blocking merge, in user terms.
6. Build and test health — main, CI, and what both mean for confidence in our own results.
7. The credential investigation: what it cost, what it found, what remains accepted-not-
   resolved.
8. What happens next, and the one decision currently with the owner (whether security
   hardening stays in front of the refactor, or the refactor is split out to ship
   independently — his answer is outstanding as of writing).
9. Appendix: technical anchors, if you judge any are worth keeping.

Length: aim for something a person will actually read end to end. Two to four pages.
Prefer short paragraphs and plain sentences over bullets-of-bullets.

## 7. DIRECT CONTACT

Questions about the refactor's technical content, the branches, or CI go to the engineering
manager `farmtable-em-task-state-model-v2` directly:
`scion message farmtable-em-task-state-model-v2 "..."`.
Do not route questions through the coordinator. Do not message the owner directly.

## 8. DELIVERABLES

1. `/scion-volumes/scratchpad/projects/farmtable/PROGRESS-SUMMARY-20260729.md` — the
   document itself.
2. A short message back to the coordinator stating: the file path, its byte size, which two
   founding documents you referenced with their full paths, and — if you could not find the
   c-phase decision document — that fact stated plainly so it can be relayed to the owner.

**Before you write the file, check the output path is not already occupied.** If it exists,
do not overwrite it; pick an adjacent name and report what you found.

## 9. TERMINATION

You MUST produce the document at the path above and send the summary message to the
coordinator, then mark the task complete. If you cannot find one of the referenced
documents, produce the document anyway with the gap stated in it, and mark complete.

## 10. AMENDMENT — ARRIVED AFTER SECTION 3 WAS WRITTEN. IT OVERRIDES PART OF IT.

The engineering manager's summary in section 3 says, of the fact that a freshly cloned copy
of the repository cannot be built: **"[UNVERIFIED.]"**

**IT IS NOW VERIFIED. REMOVE THAT MARKER AND STATE IT AS FACT.** It was measured directly:
the build, the vet step, and the test run all fail outright, and four packages including the
main server cannot be compiled at all. The cause is that the web frontend's built output is
not stored in the repository, and the Go build is wired to require it.

Two consequences the owner should see, both in plain words:

- **This is not cosmetic and it is not "nobody got round to it".** Any whole-tree build or
  static-analysis check of this project is currently *impossible*, not merely pending. It has
  presumably been impossible for some time.
- **Every clean test result this project has ever recorded was produced on a machine that
  happened to have that built output lying around from earlier work, and none of them said
  so.** So our historical confidence in the test suite is weaker than the record implies.
  This compounds the unreliable-main problem already described — say so.

Related, and worth one line: an outstanding count of static-analysis warnings that had been
carried in our notes cannot have come from a clean checkout, since the tool cannot run in
one. Treat that number as unreliable rather than quoting it.

**Do not present this as a new disaster.** It is a real defect that was previously mislabelled
as trivial, and it was caught by careful work. Frame it that way.
