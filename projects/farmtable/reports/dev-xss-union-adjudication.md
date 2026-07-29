# The r8-vs-r9 adjudication record

Prepared for the quality gate on `xss-url-scheme-union` @ **`34ce4da`**.
Tree: `/workspace/farmtable-dev-xss-r9`. Re-runnable checker:
`/tmp/adj/adjudication-check.py`.

**This file is deliberately NOT committed.** `34ce4da` is in the gate; adding a
commit would move the tip under the reviewers mid-review. Say the word and I
will commit it, but I would rather the gate review a fixed SHA.

---

## 1. Scope: what actually had to be adjudicated

| | |
|---|---|
| files differing between the r8 and r9 tips | 8 |
| **files where BOTH sides moved since the common ancestor `901670e`** | **1** |
| merge conflicts git raised | 1 |

The one file:

```
.design/project-log/2026-07-29-dev-xss-r8-fix.md
  base   901670e  103 lines   5806 B
  r8 tip 07f12a3  199 lines  11676 B   (+98 / -2 vs base)
  r9 tip 74d9db2  154 lines   8838 B   (+59 / -8 vs base)
  UNION  34ce4da  327 lines  19887 B
```

The other seven are r9-only additions against an untouched r8 side, so there was
no second side to weigh. Unchanged since the union commit `a276a51`
(`git log a276a51..HEAD -- <file>` is empty), so what the gate reviews is what
was adjudicated.

*(Aside, since it recurs: r9's tip copy is the 8838-byte one. The addendum
attributed 8838 to `901670e`, which is 5806. The substantive point — that r9
inherited an absence rather than an error — was right.)*

---

## 2. The ruling, and how it was made falsifiable

> **UNION THE LOG CONTENT, NEVER TAKE A SIDE.** No r8 sentence may be lost,
> including r8's later self-corrections. Where the two sides assert
> contradictory things about the same fact, keep BOTH with an explicit dated
> note saying which measurement superseded which and why.

"I unioned it" is an assertion. The checker turns it into three claims that can
each be proven false:

1. **Containment** — every sentence on either parent tip is present in the
   union, except sentences belonging to a *declared* contradiction.
2. **No undeclared contradictions** — the number of unexplained misses is zero.
   An unexplained miss is a failure, not a note to write later.
3. **Both sides survive each contradiction** — for each one, the r8 wording,
   the r9 wording, *and* a dated supersession note are all present.

Claim 3 is the one that actually tests the ruling. **Claim 1 alone is
satisfiable by dropping a side and labelling it a contradiction** — which is
precisely the "take a side" failure the owner prohibited.

### Result at `34ce4da`

```
(1) CONTAINMENT
    r8 tip 07f12a3: 86 sentences, 1 not verbatim (1 explained, 0 UNEXPLAINED)
    r9 tip 74d9db2: 69 sentences, 1 not verbatim (1 explained, 0 UNEXPLAINED)
(2) NO UNDECLARED CONTRADICTIONS
    declared=2 unexplained=0 -> OK
(3) BOTH SIDES PRESENT FOR EACH CONTRADICTION, WITH A DATED NOTE
    F1 verdict word        r8-wording=YES r9-wording=YES dated-note=YES winner=r9 -> OK
    run-ledger cell range  r8-wording=YES r9-wording=YES dated-note=YES winner=r8 -> OK

VERDICT: RULING HONOURED -- no side taken, nothing dropped        EXIT=0
```

A containment check **cannot** come out at zero misses here, by construction:
where the sides use different words for the same fact, one survives as a
quotation inside the note and is not reproducible verbatim. The right result is
not "0 misses" but "**exactly the declared contradictions and nothing else**",
which is what the run shows.

---

## 3. The two contradictions, per side

### 3.1 The F1 verdict word — **r9 supersedes**

| | |
|---|---|
| r8 wrote | *"**F1 IS VERIFIED, AND THE INSTRUMENT THAT VERIFIED IT IS NOT THE OBVIOUS ONE.**"* |
| r9 wrote | *"**F1 IS TYPECHECK-VERIFIED, …**"* |
| union | r9's is **live** (line 139); r8's is preserved verbatim in the note (line 156) |

**Why r9 wins:** it ran an instrument r8 did not have — a behavioural revert of
`af9ea8c`, red across three interleaved pairs. r8's claim rested on a typecheck.

**Why r8's sentence is still there:** it is not false about what r8 measured. It
is too strong a *word* for it. Deleting it would erase the record of a claim
being narrowed, which is the most useful thing in a project log.

### 3.2 The run-ledger cell range — **r8 supersedes**

| | |
|---|---|
| r8 wrote | cells R8-01 … **R8-19**, plus a self-audit |
| r9 wrote | cells R8-01 … **R8-15** |
| union | r8's is live (line 307); r9's preserved in the note (lines 313–314) |

**Why r8 wins, and why this is not really a disagreement:** these are not two
competing measurements. r9's text is the older revision, frozen at `901670e`
before r8 registered four more cells. Same fact, later reading. **This is
exactly the "r9 is not a superset" case the ruling warned about** — the one
place where taking r9 wholesale would have silently rolled back four ledger
entries.

Both directions are represented, one each way. That is the check on myself: had
every contradiction resolved toward r9, I would have been taking a side and
calling it adjudication.

---

## 4. Union-only content: three additions that are neither side's

Marked `UNION NOTE, 2026-07-29`. Flagged explicitly because a reviewer comparing
against both parents will find text in neither.

1. **`git clean -ndx`** added to r8's `check-ignore` warning as the instrument
   that escapes the trap r8 described, plus the two already-ignored directories
   as a positive control needing no manufactured artefact.
2. **Clause (f)** — records that r9 *inherited an absence, not an error*, and
   that r9 independently hit the same shape (mutant M4, killed by `tsc` rather
   than by the suite). Clause (f) is retained by name, per the ruling.
3. **`faf1c8c` characterised the `TestWatchTasks` red** that r8's void
   differential was about: a lost-event race, ~15%/run. Recorded as *"the r8
   leg's instinct was right and its procedure was still void."* Both halves are
   load-bearing — being right by luck is not a method, and the log should not
   read as though it were.

Also confirmed: `url-scheme-validation-r5-fix-round.md` survives. Blob
`102d9f3d`, 24323 B, 447 lines, **identical at `901670e`, `07f12a3` and
`74d9db2`** — common ancestor, so no merge was possible or required. It was
never at risk.

---

## 5. The checker is load-bearing — mutation-tested

A checker that has only ever been green proves nothing.

| mutant | what it breaks | diff lines | result |
|---|---|---|---|
| control | — | 0 | **green**, EXIT=0 |
| M-A2 | removes r8's preserved F1 wording | 4 | **KILLED** — `r8-wording=NO` |
| M-B | deletes 6 lines of r8-only `check-ignore` content | 7 | **KILLED** — 4 unexplained misses |
| M-C | removes the r9 side of the ledger contradiction | 4 | **KILLED** — `r9-wording=NO` |
| M-D | keeps all content, strips the dated notes | 16 | **KILLED** — `dated-note=NO` |

M-D matters most: it proves the checker enforces the *dated note*, not just the
text. A union that quietly kept both wordings with no note would pass claim 1
and fail the ruling.

**A FIFTH MUTANT WAS VACUOUS AND I NEARLY REPORTED IT AS A SURVIVOR.** My first
M-A did a literal string replace on text that is line-wrapped in the union, so
it changed nothing — `diff` = **0 lines** — and the checker was green because
there was no mutation, not because it was blind. I read "survived" as "the
checker is weak" for about a minute. Every mutant in the table above now carries
its diff-line count, and a zero voids the run.

This is the third instance on this axis of the same defect: **a null result that
means "nothing happened", read as "no difference found."** The others were an
interleaved differential run in a clone that predated the test, and a base arm
that had silently stayed on the branch tip.

---

## 6. Instrument sensitivity — measured, because it changes the answer

Three checkers over the same two files:

| instrument | misses reported | real |
|---|---|---|
| line-level exact match | 10 | 0 — all rewrap artefacts |
| sentence-level, raw | 4 | 0 — emphasis/quote punctuation added when a sentence is quoted inside a note; splitter joining across headings |
| sentence-level, normalised + declared contradictions | 2, both declared | 0 unexplained |

Fourteen "misses", every one inspected by hand, every one an artefact. **A
containment checker's raw output is not a finding until each miss is looked
at** — the naive instrument would have had me "fixing" ten losses that never
happened, editing a log to satisfy a bad grep.

---

## 7. What a reviewer should push on

Three places where I would attack this if I were reviewing it:

1. **The contradiction list is hand-declared.** The checker proves the two
   declared ones are handled and that nothing else is unexplained — but a
   contradiction where both sides happen to be *verbatim-containable* would not
   be detected as a contradiction at all. I do not believe one exists here (I
   read the full 327 lines), but the checker cannot prove it.
2. **Sentence splitting is heuristic.** Boundaries are `.!?`, blank lines and
   headings, with a 25-character floor. A contradiction expressed inside a
   single long sentence containing both claims would be checked as one unit.
3. **"Winner" is my judgement, not a measurement.** The two supersession
   directions are argued in §3, and both arguments turn on which instrument was
   run. If the gate disagrees with either direction, only the note text changes
   — no content moves, because both sides are already present.
