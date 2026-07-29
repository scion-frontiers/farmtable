# _r7-COMMON — shared method for the xss round-7 three-way review

THIS FILE CONTAINS NO PER-LEG FACTS. It never says "your tree", "your report" or
"your scope" — those live only in your own role brief. A second-person fact in a
shared file was a defect found against me last round and this is the repair.

## THE OBJECT UNDER REVIEW

- Commit: **`e4e3d13`** on branch `url-scheme-validation-r6`.
- Round base (what r7 was built on): **`c108acb`**.
- Branch base (where the whole XSS line started from): **`d305391`**.
- Also preserved in canonical as `refs/preserve/xss-r7-fix-e4e3d13` — the fix
  leg never pushed, so for a while these commits existed on exactly one
  container's disk. A SHA THAT RESOLVES IN EXACTLY ONE CLONE IS NOT A SHA.

Cite commits by SHA in every artefact. A BRANCH TIP IS A TIMESTAMPED OBSERVATION
WEARING A NAME, NOT AN IDENTIFIER.

## ORDER OF WORK — THIS IS THE PART THAT IS MOST OFTEN VIOLATED

**COLD FIRST, THEN RECONCILE.**

1. Do your own unscoped pass over the diff and the surrounding code. Form your
   own findings. Write them down, in your report, before step 3.
2. THEN work whatever checklist your role brief gives you, and attribute each
   finding to whichever pass produced it. This attribution is a measurement of
   my briefing, not of you, and it is used.
3. THEN, and only then, open `_r7-PHASE-TWO.md`. It points at the prior round's
   artefacts and at things already known. Reading it earlier costs the cold pass
   and there is no way to get it back.

Rationale, measured on this project: **THE MORE ACCURATE THE UPSTREAM ARTEFACT,
THE MORE COMPLETELY IT SUPPRESSES THE INDEPENDENT SEARCH.** An accurate summary is
worse for this purpose than an inaccurate one, because it is not worth checking.

## POPULATION BEFORE VERDICT

Report what you searched before what you concluded. A verdict whose population
arrives afterwards cannot be checked.

**EVERY COUNT CARRIES THREE INTEGERS IN THE SAME PLACE AS THE COUNT:**

    ENUMERATED = FLAGGED + EXCLUDED

Three integers, and the arithmetic must close. Prose alongside is welcome; the
integers are the part that fires. This is not bureaucracy — it exists because
whoever builds a population and whoever reads the number are different agents,
and the handoff carries the number without the population, so neither end owns
it and neither end checks it. The rule's first draft asked only that the sets be
*described*, and that draft would have accepted the defect it was written for.

Two live cautions, both self-caught here within the last hour:

- **A FILTER THAT MATCHES NOTHING SILENTLY PASSES EVERYTHING**, and in the output
  it is indistinguishable from a filter that had nothing to remove. If you
  exclude, print the excluded count and satisfy yourself it is non-zero.
- **A CENSUS IS AS BOUNDED AS ITS MOST BOUNDED INSTRUMENT.** If two greps
  contribute to one population, say so, and state whether they overlap. Two
  instruments can each close their own arithmetic perfectly and still be blind
  to the member that decides the question.

For every negative — every "nothing does X" — give the command verbatim, with its
ROOT and its revision. **A NEGATIVE WITH NO EXECUTION EVIDENCE IS UNRESOLVED, NOT
CLEAN.** Report the bound with the finding; the bound does not travel separately.

## PRE-REGISTER YOUR OWN FALSIFIER

Before you write your headline finding, write the observation that would sink it,
and go and look for that observation. Put both in the report.

This is not a style note. The strongest single result I produced tonight was
wrong, and it was killed by a falsifier I had attached to it and handed to
someone else. **I COULD NOT FALSIFY MY OWN CLAIM; I COULD WRITE DOWN WHAT WOULD,
AND GIVE IT TO SOMEONE NOT INVESTED IN DEFENDING IT.**

And the reason it needed killing: it was TRUE, just not all of the truth.
**THE PARTIAL CAUSE IS TRUE, WHICH IS EXACTLY WHY IT STOPS THE SEARCH.** A false
cause gets tested and discarded; a true-but-incomplete one gets confirmed and
closes the question. The remedy that has actually worked, twice, is mechanical:
**NAME THE CAUSE AS A NUMBER YOU HAVE NOT YET CHECKED, AND YOU WILL GO AND CHECK IT.**

## BUILD FENCE — READ THIS BEFORE YOU RUN ANYTHING

**EXACTLY ONE BUILD TOKEN EXISTS AND THE ENGINEERING MANAGER HOLDS IT.** At most one
agent on this project executes a build or a suite at any moment.

TOKEN REQUIRED, do not run without asking:
`go build ./...`, `go vet ./...`, `go test ./...`, `npm test`, `npm run build`,
`make build`, `make test`.

NO TOKEN NEEDED: reading; `git fetch`; running a read-only node script; and a
single targeted `go test ./internal/<pkg>/ -run '^TestName' -count=1`. For the
targeted run you must append a line to
`/scion-volumes/scratchpad/projects/farmtable/reports/_run-queue-log.md`
**before** running, with the **ROOT and DIST columns filled in, including on lines
you expect to pass.** Every green build this project has rooted in a shared
checkout has been suspect for exactly this reason.

If you need a wide run, ASK. You may well get it — but one leg at a time, and the
instruction is not final until you request it.

## WHAT YOU MAY NOT DO

- **Do not push.** Not ever, from any leg, for any reason.
- **Do not modify production code.** Your independence is the deliverable.
- **Do not talk to another leg.** Report to `eng-manager` and nobody else. If you
  believe another leg needs something, tell me and I relay it.
- Do not contact the coordinator or any human.

## APPARATUS — THESE HAVE EACH COST HOURS

- Shell is **zsh 5.9, not bash**. An **unquoted glob matching nothing is a FATAL
  ERROR** that aborts the whole command and everything batched behind it. Write
  `--include='*.go'`, never bare.
- `${PIPESTATUS[0]}` is **empty**. The array is `$pipestatus`, **1-indexed**.
- `grep` is **ugrep 7.5.0**.
- A check whose success condition is *no match* **exits 1 when clean.** Never wrap
  it in `|| true`; that destroys the signal.
- `cmd 2>&1 > file` sends only stdout to the file. The correct order is
  `cmd > file 2>&1`.
- **TAB IS IFS-WHITESPACE.** `while IFS=$'\t' read` collapses consecutive tabs and
  shifts every later field left — empty field, no error, correct row count, wrong
  columns. Use awk and assert the field count per row.
- **BACKTICKS IN A `scion message` BODY EXECUTE.** Write the message to a file with
  a quoted heredoc and send it as `"$(cat file)"`. Never put backticks in a
  message to me.
- A wrapper written to *report* an exit code has already once *replaced* it here.
  If you wrap a build, prove the wrapper can report a failure.

## WORKED EXAMPLES

Any worked example in any brief of mine is **drawn from a closed workstream, never
from the live question space**, because **THE MORE APT AN EXAMPLE IS, THE MORE IT
CONTAMINATES — APTNESS IS PROXIMITY TO THE QUESTION.** If you find an example in
this round's briefs that is about this round's question, that is a defect in my
brief and I want it in your report.

## YOUR REPORT MUST END WITH TWO SECTIONS

- **WHAT I DID NOT CHECK.** A real section. It is read, and it is the one most
  often used.
- **WHERE THIS BRIEF WAS WRONG.** Also real. Every leg on this project has found
  errors in my briefs; the legs that found the most were the most useful. My
  framing is a claim like any other. If the framing is wrong, THAT is the finding,
  and it outranks anything on my checklist.
