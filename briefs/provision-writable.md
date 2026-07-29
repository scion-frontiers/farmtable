# BRIEF — provision-writable

## ONE QUESTION. READ-ONLY. NO BUILD TOKEN. NO COMMITS. NO PUSH.

**WHAT, IN THIS PRODUCT, IS SUPPOSED TO SET THE `writable` MARKER INSIDE A COLLECTION'S
`remote_data`?**

An operator has a GitHub-backed collection and wants editing turned on for it. **What do
they do?** Name the surface: an admin page, an API field, a config key, a CLI flag, a
migration, a seed file, a sync that infers it from the remote, anything. If there are
several, name all of them. If there are none, that is equally a result — but see the
control requirement in §4, because a zero here is the hardest kind of claim to make well.

That is the whole question. Everything below is about how to answer it so the answer can
be checked.

---

## 1. YOU ARE THE COLD LEG. THIS IS DELIBERATE AND IT IS THE POINT.

Another agent has already measured an adjacent question, and its report exists on disk.
**You are not being given it, and you should not go looking for it.** Specifically, do not
open `reports/writable-key-path.md`, `briefs/audit-writable-path.md`, or anything under
`briefs/` beginning `ptone-`.

This is not secrecy. It is a measured effect on this project, four times over: **the more
accurate the upstream artefact, the more completely it suppresses the independent search.**
An accurate prior answer is the most effective way to stop somebody looking. So the
standing form here is **COLD FIRST, THEN RECONCILE** — you answer from the tree, I reconcile
your answer against the other measurement afterwards, and **any place you two disagree is a
result for both of us**, not an error by one of you.

If you find yourself thinking "someone must have checked this already" — that thought is
the failure mode, not a shortcut.

---

## 2. THE TREE, BY SHA. DO NOT SUBSTITUTE A NEARBY TREE.

- **ROOT:** `/workspace/farmtable-provision-writable` — yours alone. No other leg is in it.
- **COMMIT:** `cc927355e5a23c45bfd983cd331eb540b0a61ad5`, detached HEAD.

This is **real `main`** as of tonight: Preston Holmes, 2026-07-28, merge of PR #205. 435
tracked files.

**Why this matters enough to say twice:** several trees on this machine carry a `main` ref
that is **twelve commits stale**. A conclusion measured against one of those is a
conclusion about a repository that no longer exists. **Absence is the claim staleness
breaks** — a file that is not there in a stale checkout may be there in the real one, and
your question is an absence question until proven otherwise. Cite the SHA on every
measurement. A branch name is a timestamped observation wearing a name; it is not an
identifier.

`main` is **RED** today for pre-existing reasons unrelated to this question
(`TestListUsers`, `TestWatchTasks_NoInitial`). You are not running tests, so it should not
reach you.

---

## 3. REPORT THE POPULATION BEFORE THE VERDICT. THIS IS MANDATORY AND IT IS NOT STYLE.

**What you searched comes first. What you concluded comes second.** A verdict whose
population arrives afterwards cannot be checked, and this project has produced several.

For every negative — every "nothing does X" — state **the command verbatim, with its ROOT
and its revision**, and state **the bound**: depth limits, `--include` filters, path
prefixes, case sensitivity, revision, time. **A bound on a search is part of its result.**
Two real instances from tonight: a `find -maxdepth` that undershot the true depth by two
returned clean and empty; a case-sensitive grep returned a false zero that the `-i` rerun
falsified.

**A truncated search does not look truncated. It looks clean.**

### 3a. TEN OR FEWER IS REPORTED AS THE LIST, NOT AS THE NUMBER.

Standing rule, adopted tonight, and it exists because a number is invisible to every
question except the one that produced it. **Any population of ten or fewer members is
written out in full — every member, by name.** Do not write "five files"; write the five
paths. Do not write "three call sites"; write the three, with line numbers. This costs you
one line and it is the difference between a finding somebody can re-use and a finding
somebody has to re-derive.

### 3b. EVERY CELL OF EVERY TABLE CARRIES ITS OWN ARM, IN THE CELL.

If you produce a table, each cell states **how that cell was obtained** — read, grepped,
inferred, run. A table is a claim that its cells are commensurable, and nothing in a normal
table states that claim anywhere it can be checked. A header does not travel; a cell does.

---

## 4. THE CONTROL REQUIREMENT. READ THIS ONE TWICE — YOUR ANSWER MAY WELL BE A ZERO.

**THE ARTEFACT OF A NEGATIVE RESULT IS A POSITIVE RESULT FROM THE SAME INVOCATION.**

A search that correctly finds nothing produces nothing to inspect. So a real zero and a
broken instrument are **indistinguishable in the output** — same empty result, same exit
code. The only thing that separates them is a **positive control inside the same
invocation**: the one command that returns your zero must also return a known non-zero, so
that a dead tool could not have produced your result.

A worked example of the good form, from tonight: a single sweep covering both Go and
TypeScript returned 11 TypeScript hits and 0 Go hits. The tool demonstrably ran and
demonstrably could match, so the Go-side zero is a real zero.

**A SECOND COMMAND IS NOT A CONTROL, BECAUSE A SECOND COMMAND IS A SECOND INSTRUMENT.** If
you can only manage a separate control run, that is acceptable — but label it as the weaker
form rather than letting it read as the strong one.

Disqualifying forms, all of which appeared in real work tonight:

- **`2> /dev/null` on a sweep** suppresses the exact channel that reports a broken tool.
- **`head -N`** makes truncation silent, which is fatal for a count or an absence.
- **`grep -c` over a pipeline** cannot distinguish *no matches* from *no input*.
- **`cmd 2>&1 > file`** sends only **stdout** to the file — the dup happens against the
  terminal, before the redirect. The correct order is **`cmd > file 2>&1`**. This was
  confirmed by experiment tonight, and it silently blinded a census to compile errors.

---

## 5. WHERE TO START. NOT A BOUNDARY, AND NOT A CHECKLIST TO SATISFY.

These are named only so you do not spend time rediscovering them. **Finding something
outside this list is a better outcome than confirming something inside it**, and exceeding
this brief will be read as compliance, not as scope creep.

- The write path for collections generally: create, update, and whatever the API exposes of
  `remote_data` as a whole.
- The Ent schema for collections — field definitions, defaults, and any migration that
  backfills.
- Config loading: is there a key that reaches a collection at all?
- The CLI surface. The admin surface, if one exists.
- Sync and passthrough: does anything derive this from the remote — a permissions probe, a
  repository field, a token scope?
- Seed data, fixtures, testdata, and any JSON or YAML in the tree.
- Docs, design documents, and the project log. **A design document that specifies a
  provisioning path nobody built is a finding**, and this project has already had one.

**Do not restrict yourself to Go.** The marker is consumed in the dashboard, so the
provisioning surface could be anywhere, including nowhere.

---

## 6. THE QUESTION BEHIND THE QUESTION, IF YOUR ANSWER IS "NOTHING".

Then say what that implies and how confident you are in each part:

- Has the marker **ever** been set, for anyone, by any route? Stored data and seed data
  count. Say what would settle it if you cannot.
- Is there a **design intent** on the record that a provisioning path should exist?
- Is the gap in the **write path**, the **schema**, the **API surface**, or the **docs**?
  These have different owners and different fixes.

And distinguish, explicitly, between:

- **Nothing sets it** — a claim about the world.
- **No line of code in this repository assigns it** — a claim about the code.

**These are different claims and only the second one is measurable from a tree.** If you
report the first, you have exceeded your evidence. Report the second and say plainly what
it does and does not license. That distinction is the single most valuable thing you can
get right in this brief.

---

## 7. WHAT YOU MAY AND MAY NOT DO

- **READ-ONLY.** Do not modify a line of production code. Do not commit. Do not push. Your
  independence is the deliverable.
- **NO BUILD TOKEN, AND THAT MEANS BOTH THE PERMISSION AND THE CAPABILITY.** You may not run
  `go build ./...`, `go vet ./...`, `go test ./...`, `npm test`, `npm run build`,
  `make build` or `make test`. One agent holds the only build token, project-wide, and it
  is not you.
- A single targeted `go test ./internal/<pkg>/ -run '^TestName$' -count=1` is permitted
  **only if it is the only way to settle the question**, and you must append a line to
  `reports/_run-queue-log.md` **before** running it, with ROOT and DIST columns, including
  on a line you expect to pass. **Prefer reading to running.**
- Do not contact any other agent. Report to me — `scion message farmtable-em-task-state-model-v2` — only.

---

## 8. SHELL FACTS. THESE HAVE COST US HOURS.

- The shell is **zsh 5.9, not bash.** An **unquoted glob matching nothing is a FATAL ERROR**
  that aborts the whole command and everything batched behind it. Write `--include='*.go'`,
  never `--include=*.go`.
- `${PIPESTATUS[0]}` is **empty**. The array is `$pipestatus` and it is **1-indexed**.
- `grep` is **ugrep 7.5.0**.
- A check whose success condition is *no match* **exits 1 when clean.** Never wrap it in
  `|| true` — that destroys the signal.
- **Never terminate a command with an echo of its own status.** Anything appended to a
  command in order to observe it becomes the thing observed. This cost us a false green on
  a failed build tonight, and it cost a merged CI step a false SUCCESS on a failing test.
- **Backticks in a `scion message` body EXECUTE.** Write your message to a file with a
  quoted heredoc and send it with a command substitution on `cat`. No backticks in messages
  to me.

---

## 9. DELIVERABLE — NAMED EXACTLY

Write your report to:

**`/scion-volumes/scratchpad/projects/farmtable/reports/provision-writable.md`**

In this order:

1. **POPULATION AND COMMANDS** — what you searched, with roots, revisions, bounds, and the
   within-invocation controls from §4.
2. **THE ANSWER** — what provisions the marker, or the precise scoped statement of what does
   not, per §6.
3. **CONFIDENCE, PER CLAIM** — not one overall number. Say which claims are read-and-quoted,
   which are swept, and which are inferred.
4. **WHAT YOU DID NOT CHECK** — a real section. It is read, every time.
5. **WHERE MY BRIEF WAS WRONG** — also a real section. Every leg tonight has found errors in
   my briefs, and the ones that found the most were the most useful. My framing above is a
   claim like any other. If the framing is wrong, **that is the finding**, and it outranks
   the answer.

Then write a project log entry to
`/scion-volumes/scratchpad/projects/farmtable/reports/provision-writable-project-log.md`.
**Not into the code repository** — this clone is disposable and a commit there would be
single-homed on one container's disk.

---

## 10. TERMINATION

**You MUST write `reports/provision-writable.md` and the project log entry, message me the
one-line answer, and then mark the task complete.** Do not stall after finishing the
analysis. Do not ask me whether to write the file — write it.

If the honest answer is "I cannot determine this from a tree," that is a **result**. File it
with what would settle it, and finish.
