# BRIEF — WHAT INSTRUMENT PRODUCED EACH RECORDED NEGATIVE ON THE remote_data AXIS

**READ SECTIONS 0–3 IN FULL AND STOP. Do not skim to the checklist.**

---

## 0. TREE, AND WHAT YOU MAY DO

| | |
|---|---|
| Your working tree | your own clone; **do not touch** `/workspace/farmtable` or any `farmtable-*` leg tree |
| Build token | **YOU DO NOT HAVE IT.** No `go build`, no `go test`, no `npm test`, no `make`. |
| Runs of any kind | **NONE.** This task is answerable entirely by reading. If you think it is not, say so and stop. |
| Push | **NEVER.** Commit your project-log entry to your own branch only. |
| Tree modification | none, other than your report and project-log entry |

If answering properly would require running something, **that is a finding, not a failure** —
write it down and stop rather than requesting the token.

---

## 1. THE QUESTION, AND ONLY THIS

Over roughly six rounds this project searched for consumers of a protobuf field called
`remote_data` and repeatedly recorded a **negative** — "no sink", "no consumer", "nothing
reads it", "not rendered", or words to that effect.

Those negatives are now known to have been produced by instruments that were, at least
sometimes, **keyed on rendering**: they looked for the value being printed, interpolated,
or bound into a template. A consumer was later found that is **branched on** rather than
printed — a capability gate. A rendering-keyed search is structurally incapable of
finding one.

**FOR EVERY RECORDED NEGATIVE ON THIS AXIS, CLASSIFY THE INSTRUMENT THAT PRODUCED IT.**

This is not a re-search for consumers. **Do not go looking for sinks.** You are auditing
what the earlier searches were *able* to see, from what they wrote down.

---

## 2. THE CLASSIFICATION, PRE-REGISTERED BEFORE ANYONE LOOKED

Five cells. Three were registered by the coordinator; **two were added by the EM after
applying a check to the coordinator's own list**, and the reason is given so you can judge
whether the additions are sound rather than accepting them.

| Cell | Meaning |
|---|---|
| **R — RENDERING-KEYED** | the search looked for the value reaching a display/serialisation path |
| **C — CONSUMPTION-KEYED** | the search looked for the value being READ AT ALL, for any purpose |
| **U — UNDETERMINABLE FROM THE REPORT** | the report records a negative but does not say how it was obtained |
| **I — IDENTIFIER-KEYED** *(EM addition)* | the search was a name/token search over source text |
| **N — NO INSTRUMENT** *(EM addition)* | the negative was **inferred or derived**, not searched for at all |

**Why I was added.** A grep for an identifier is neither rendering-keyed nor
consumption-keyed; it is blind in a third, independent way. This project has already
measured that blindness: a token search for the field name **cannot match a setter
spelling of the same field, and a reference-type alias write contains no token at all.**
So `I` is a distinct failure mode and folding it into `R` or `C` would hide it.

**Why N was added.** `U` says *the report does not tell us*. `N` says *the report tells us,
and the answer is that nothing was run*. Those are opposite epistemic situations and the
second is the more alarming. Collapsing them lets the worst cell hide inside the cell that
sounds like a documentation gap. **N is the cell I would least like to find, which is
precisely why it is on the form.**

If you meet a negative that fits **none** of the five, **do not force it**. Add a sixth
cell, name it, and say what it is. A classification scheme that cannot fail to classify is
not measuring anything.

---

## 3. METHOD

1. **Enumerate the corpus yourself.** `reports/` — I count **24 files** matching
   `ls -1 reports/ | grep -iE 'xss|remote'` out of 255 total. **That count is mine and may
   be wrong or may be the wrong population.** Reproduce it, and widen it if the axis
   reaches files that pattern misses (project-log entries under `.design/project-log/`,
   briefs, in-tree comments). **Say what population you settled on and why.**
2. For each recorded negative: quote it, cite `file:line`, and classify.
3. **CITE OR IT DOES NOT COUNT.** A classification from memory or from the general sense
   of a report is worthless here. Every row carries a quotation.
4. Where a report describes its own method explicitly, prefer that over your inference —
   and say which you used.

---

## 4. HAZARDS, EACH ONE MEASURED ON THIS PROJECT

- **`U` is expected to be the most common answer.** It was pre-registered *before anyone
  looked* precisely so that it cannot later be quietly sorted into `R` or `C`. **Resist
  the pull to upgrade a `U` into a `C` because the round "obviously" would have caught a
  read.** That inference is unavailable to you.
- **A round may contain several negatives with different instruments.** Classify per
  negative, not per round. Do not average a round into one letter.
- **Do not credit a round for the capability sink being fail-closed.** Whether the missed
  consumer turned out to be harmless has no bearing on whether the instrument could see it.
- **The EM wrote most of the briefs that set these instruments.** If a report's method was
  narrow because the brief told it to be narrow, **say so and cite the brief.** That is the
  most useful thing you can find and it will not be held against any leg.
- **You will be tempted to conclude the axis was under-searched.** Maybe. But a `C` is a
  real result and a clean round is a real result. **A finding that the instruments were
  adequate is as valuable as the opposite** and will be reported unchanged.

---

## 5. DELIVERABLE

`reports/xss-instrument-classification.md`, containing:

1. **The population you settled on**, with the command that produced it.
2. **A table**: round · negative (quoted) · `file:line` · cell · basis (explicit-method vs
   your inference).
3. **Per-cell totals**, and the total number of negatives — an absolute count, not a floor.
4. **What you could not determine**, marked `[UNCHECKED]`, including anything that would
   have needed a run.
5. **Any sixth cell** you had to invent.

Also write a **project log entry**. Commit both to your own branch. **Do not push.**

**You MUST write `reports/xss-instrument-classification.md` and then mark the task
complete.** If you finish the analysis and do not write the file, the task is not done.

---

## 6. WHAT FIRES ON THE RESULT — pre-registered, not yours to change

> IF ANY ROUND'S RECORDED NEGATIVE ON THIS AXIS RESTS ON A RENDERING-KEYED INSTRUMENT,
> THEN THAT ROUND'S NEGATIVE IS **UNSIGNED** AND IS RE-MARKED AS SUCH.

The security ruling on the field is untouched either way. What shrinks — if anything — is
the **coverage claim**, to the rounds that survive. The sentence that will be said if it
fires: *some of what we recorded as looked-at-and-clean was never looked at.*

You are not being asked to apply this. You are being told it in advance so that you know
the stakes are on the coverage claim and **not on any leg's competence** — including
yours, and including the legs whose reports you are reading. Several of them flagged
their own blind spots in writing, which is why this is answerable at all.
