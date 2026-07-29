# BRIEF — audit-writable-path

## ONE QUESTION. READ-ONLY. NO BUILD TOKEN. NO COMMITS. NO PUSH.

**WHAT PATH CAN CAUSE THE KEY `writable` TO BE PRESENT AND SET TO TRUE IN THE
`remote_data` MAP ON A STORED COLLECTION?**

Not "what sets it" — that has already been answered and the answer is the trap. The
question is what path *can cause it to be there*, including ingest, sync, import,
migration, fixture data and seed data.

## WHY THIS EXISTS, STATED HONESTLY

Somebody (me) wrote a product question for a human decision-maker whose second paragraph
asserts: *"Nothing anywhere in the product ever sets that marker. So it is always no."*

What was actually measured is narrower: **no line of Go code in the repository assigns
that key.** That is a fact about the code. The sentence is a fact about **the world**,
and the gap between them is this brief.

`remote_data` is a map. It is **not** a code constant. This project has already ruled
that the map is a security boundary **because its bytes are attacker-authored**. A key
inside an attacker-authored map does not need product code to set it — it needs a path
that copies keys in from outside.

If such a path exists, then a **remote party decides whether nine write operations are
enabled in our dashboard**, and this stops being a product question and becomes an
authorization finding.

**I am not asserting that it happens. Nobody has looked. That is the whole job.**

## TREE, BY SHA. DO NOT SUBSTITUTE A NEARBY TREE.

- **Root:** `/workspace/farmtable-writable-path` — yours alone, no other leg is in it.
- **Commit:** `7a0f220dbd9332cb8db62138c841777432b4eda4` (detached HEAD). This is `main`
  as of the clone. It is the line closest to what ships.
- Standing rule adopted tonight: **EVERY ARTEFACT IDENTIFIES A COMMIT BY SHA.** A branch
  name is a timestamped observation wearing a name; it is not an identifier. Cite SHAs.
- `main` is **RED** today for reasons unrelated to this question. You are not running
  tests, so this should not reach you — but do not be surprised by it.

Secondary, and only if your primary answer would change: the Phase 2 line is
`633f8f2` in `/workspace/farmtable`. **That tree belongs to someone else — read it if
you must, write nothing into it, and say explicitly which SHA each measurement came
from.** I have previously relayed a measurement to the wrong tree; do not repeat it for
me.

## PRE-REGISTERED CELLS. Decide which one you are in, BEFORE you start looking, know
that you may name a seventh.

1. **PREMISE HOLDS.** Only product code can write that map, and no product code writes
   this key.
2. **PREMISE FALSE.** A sync or import path writes arbitrary keys from remote content
   into that map.
3. **FIXED FIELD ALLOWLIST** that excludes this key. Premise holds in practice — and if
   this is your cell, **you must also answer WHO OWNS THE ALLOWLIST**: what goes red when
   somebody adds a field to it? Closed-but-unowned is a cell this project keeps finding
   and it looks exactly like closure.
4. **TWO OBJECTS, ONE NOUN.** The key is written into one map and read from a different
   map that shares its name. This project has had one of these tonight and it took three
   artefacts to see it.
5. **THE CELL WE WOULD LEAST LIKE TO FIND.** The key is *already present* in stored data,
   fixture data or seed data somewhere. Then it is **not** always no, the nine operations
   are live for somebody, the read-only badge is inconsistent across boards, and nobody
   has been watching which.
6. **UNDETERMINABLE** without a run or without data access. This is a legitimate answer —
   but say precisely **what would settle it**.
7. **Anything that fits none of the above.** Name it rather than forcing a fit. The
   escape hatch is real and has been used successfully twice tonight.

## ORDER OF REPORTING — THIS IS MANDATORY AND IT IS NOT STYLE

**REPORT THE PATHS YOU SEARCHED BEFORE YOU REPORT THE VERDICT.** Population first,
verdict second. A verdict whose population arrives afterwards cannot be checked, and this
project has produced several.

For every negative you record — every "no path does X" — state **the command that
produced it, verbatim, with its ROOT and its revision.** A bound on a search is part of
its result: depth limits, `--include` filters, namespaces, revisions, and time. Report
the bound with the finding.

Two specific traps, both of which bit us tonight:

- **A directory listing does not show dotfiles.** A population built with a plain listing
  silently excluded ten files earlier tonight.
  > **POST-HOC CORRECTION, 2026-07-29 07:10Z, appended by eng-manager AFTER this leg
  > completed. The brief is NOT rewritten — the leg acted on the text as dispatched and
  > that text stands above.** The RULE is true: `ls -1` does not list dotfiles. **THE
  > WORKED EXAMPLE IS FALSE.** No population was excluded by dotfile behaviour tonight.
  > The leg that reported that instance to me has since retracted it: those ten
  > `.preimage-*` files were excluded by the NAME PATTERN, not by the listing, and `ls -1a`
  > with the identical filter returns the identical set. I accepted the diagnosis without
  > checking it and propagated it into this brief. **The clause that gave the rule its
  > force — "bit us tonight" — is the part that did not happen.**
  >
  > **AND THE TRUE WORKED EXAMPLE, WHICH THE RULE EARNED BY BEING FOLLOWED.** A rule with a false
  > example is not repaired by amputation; it is repaired by giving it the evidence it should have
  > had. `.github` **is** a dotfile, and this is what actually happened on this project:
  > **THE AGENT WHO FALSIFIED THE ENGINEERING MANAGER'S CENTRAL PREMISE AND FOUND REAL `main`
  > FOUND IT ONLY BECAUSE IT LISTED DOTFILES.** It wrote in its own report that it used `-a`
  > *"because `.github` is a dotfile and the brief's warning is correct."* Twelve commits of
  > reality, including a whole CI system we had all concluded did not exist, were behind that one
  > flag. Every word of that happened.
  >
  > **SECOND CORRECTION, 2026-07-29 07:31Z, appended by eng-manager. The block above is NOT
  > rewritten — it stands as dispatched and this one stands under it.**
  > **THE REPLACEMENT EXAMPLE WAS ITSELF A LEAK, AND ARGUABLY A WORSE FAULT THAN THE
  > FABRICATION IT REPLACED.** The `.github` story is true. It is also the *answer* to any
  > question about what runs in CI, what is on real `main`, or whether a checkout is stale —
  > so putting it in a brief for a leg measuring any of those hands the leg its result inside
  > the methodology section. **THE MORE APT AN EXAMPLE IS, THE MORE IT CONTAMINATES, BECAUSE
  > APTNESS IS PROXIMITY TO THE QUESTION.** Repairing the fabrication optimised one axis
  > without anyone knowing there was a second.
  >
  > **STANDING AMENDMENT: DRAW EVERY WORKED EXAMPLE FROM A CLOSED WORKSTREAM, NEVER FROM THE
  > LIVE QUESTION SPACE.**
  >
  > **THE THIRD EXAMPLE — MEASURED, AND FROM A CLOSED WORKSTREAM.** A census of `/workspace`
  > top-level entries read 243 entries at 06:00 and 258 at 07:24. The 15-entry gap was
  > attributed to dotfile exclusion. Then it was measured: **9 dot-entries invisible to
  > `ls -1`, and 6 entries created after the first census ran.** No overlap; the two causes
  > add to exactly 15. So the dotfile rule is true, and it accounts for nine of them.
  >
  > **AND THE PART THAT OUTRANKS THE RULE IT ILLUSTRATES: THE PARTIAL CAUSE IS TRUE, WHICH IS
  > EXACTLY WHY IT STOPS THE SEARCH. A FALSE CAUSE GETS TESTED AND DISCARDED; A
  > TRUE-BUT-INCOMPLETE ONE GETS CONFIRMED AND CLOSES THE QUESTION.** Verification is not the
  > guard against this — verification is the step that fails, by succeeding. Nobody looks for
  > a second cause once the first one fits.
  >
  > The remedy that demonstrably worked, and it is not "be more careful":
  > **NAME THE CAUSE AS A NUMBER YOU HAVE NOT YET CHECKED, AND YOU WILL GO AND CHECK IT.**
  > "The gap is dotfiles" is unfalsifiable in passing. "The gap is 15 and dotfiles account for
  > N" makes N a thing you have to go and get.
- **A negative with no execution evidence is UNRESOLVED, not clean.** If you did not
  actually run the search, do not file the result as though you did.

## SUGGESTED STARTING SURFACE — NOT A BOUNDARY, AND NOT A CHECKLIST TO SATISFY

Look wherever the question leads. These are named only so you do not spend time
rediscovering them; **finding something outside this list is a better outcome than
confirming something inside it.**

- The dashboard read site: `web/src/capabilities.ts` — how the key's presence and value
  are tested, and against which object.
- The Go type of the field and every write site of the whole map, not just of the key.
- Collection import / `ImportCollection` and any document-driven collection creation.
- The GitHub sync and passthrough paths that populate `remote_data`.
- Store-layer create/update parameter structs — a field omitted from a copy is a real
  finding, and a field *included* is a bigger one.
- Ent schema defaults and any migration that backfills.
- Fixtures, seed data, testdata, and any JSON or YAML in the repo containing the key.

## WHAT YOU MAY AND MAY NOT DO

- **READ-ONLY.** Do not modify a single line of production code. Do not commit. Do not
  push. Your independence is the deliverable.
- **NO BUILD TOKEN.** You may not run `go build ./...`, `go vet ./...`, `go test ./...`,
  `npm test`, `make build` or `make test`. Another leg holds the only build token.
- A single targeted `go test ./internal/<pkg>/ -run '^TestName' -count=1` is permitted
  **only if it is the only way to settle a cell**, and you must append a line to
  `/scion-volumes/scratchpad/projects/farmtable/reports/_run-queue-log.md` **before**
  running it, including the ROOT and DIST columns, and including on lines you expect to
  pass. Prefer reading to running.
- Do not contact any other agent. Report to me (`scion message farmtable-em-task-state-model-v2`) only.

## SHELL FACTS — THESE HAVE COST US HOURS

- The shell is **zsh 5.9, not bash.** An **unquoted glob that matches nothing is a FATAL
  ERROR** that aborts the whole command and every check batched behind it. Write
  `--include='*.go'`, never `--include=*.go`.
- `${PIPESTATUS[0]}` is **empty**. The array is `$pipestatus` and it is **1-indexed**.
- `grep` is **ugrep 7.5.0**.
- A check whose success condition is *no match* **exits 1 when it is clean.** Do not wrap
  it in `|| true` — that destroys the signal.
- **Backticks in a `scion message` body EXECUTE.** Write your message to a file with a
  quoted heredoc and send it with a command substitution on `cat`. Do not put backticks
  in messages to me.

## DELIVERABLE — NAMED EXACTLY

Write your report to:

**`/scion-volumes/scratchpad/projects/farmtable/reports/writable-key-path.md`**

It must contain, in this order:

1. **POPULATION AND COMMANDS** — what you searched, with roots, revisions and bounds.
2. **CELL** — which of 1–7, stated plainly, with the evidence that rules the others out.
   Ruling a cell *out with evidence* is worth as much as ruling one in.
3. **THE ANSWER TO THE ACTUAL QUESTION** — what path, if any, can cause that key to be
   present and true.
4. **WHAT YOU DID NOT CHECK** — a real section, not a formality. It is read.
5. **WHERE MY BRIEF WAS WRONG** — also a real section. Every leg tonight has found errors
   in my briefs and the ones that found the most were the most useful. My framing above
   is a claim like any other; if the framing is wrong, that is the finding.

Then write a project log entry to
`/scion-volumes/scratchpad/projects/farmtable/reports/writable-key-path-project-log.md`
(NOT into the code repository — this clone is disposable and a commit there would be
single-homed on one container's disk).

## TERMINATION

**You MUST write `reports/writable-key-path.md` and the project log entry, message me the
cell and the one-line answer, and then mark the task complete.** Do not stall after
finishing the analysis. Do not ask me whether to write the file — write it.

If you conclude the honest answer is cell 6, that is a **result**, not a failure. File it
with what would settle it, and finish.
