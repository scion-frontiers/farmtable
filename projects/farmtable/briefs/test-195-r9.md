# test-195-r9 — independent test review, #195 round 9

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `markdown-sanitize-r9` and commit **`13680c2b7d7fd64841573894e5bb1224924eefdd`**.
**Do NOT create any directory named in this brief.** `web/node_modules` and `web/dist` are
present — do not reinstall or rebuild them.

## How to treat this brief

Claims are tagged `[MEASURED]` (I ran it this session), `[MEASURED-BY-<x>]` (relayed, not mine),
`[BELIEVED]`, `[CARRIED]`.

**My briefs have contained at least one error in ten consecutive rounds.** The round-9 report
lists **eight** in the brief I gave the developer, and two of them are yours to care about: I
relayed a list of **two** vacuous tripwires and the true number was **five**, and I asserted an
ordering rationale that was measured false *and circular*. **Agreeing with a premise supplied in
this brief is worth ZERO, and from the outside it looks identical to genuine convergence. If you
confirm something I asserted, say that you are confirming MY claim and show your own
measurement.**

Reporting every place this brief is wrong is a **required deliverable**, not a courtesy.

## Known-good baseline `[MEASURED by me at 13680c2 this session]`

- `npm test` → exit 0, **79 checks passed (127 assertions)**
- `npx tsc --noEmit` → exit 0; `npm run build` → exit 0; tree clean
- `markdown.ts` changed **comment-only** `[MEASURED]`; all executable change is in
  `markdown.test.ts`.
- **There is no CI on this project.**

## What to read

`/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-r9.md` and
`reports/dev-195-r9-evidence/predictions-01.md` / `predictions-02.md`. **The mutation tables are
the thing you are reviewing. Do not inherit their numbers; re-derive them.** Extract historical
files with `git show`, never by retyping — reconstructing the artefact you are measuring is the
same error class as reimplementing the function you are checking.

---

# Your axis: vacuity, and the instrument that detects it

This round's sharpest result is a definition, and I want you to attack it:

> **A loop is non-vacuous exactly when something asserts its result for an input whose answer is
> known in advance.**

The developer emptied each tree-wide loop (`scanned` → `scanned.slice(0, 0)`) one at a time.
**Five of six loops stayed GREEN — vacuous. Only the one loop whose output is checked against a
known count went RED** `[MEASURED-BY-dev-195-r9]`. Two of those five had been filed; **three were
unfiled instances of the filed class**, including one I relayed as a list of two.

## 1. Re-run the vacuity sweep yourself, and widen it

Re-derive the six-row table. Then **extend the same mutation to every loop, table and scanner in
the file, not just the tree-wide ones.** The lesson of this round is that the filed list was 40%
complete; assume mine is too. Report a full census with a denominator: how many
loops/tables/scanners exist, how many you mutated, how many were vacuous. **A count without a
denominator is a confirmed lower bound wearing a measurement's clothes.**

## 2. Audit the vacuity detector itself

The repair is `scanTreeWide(entries, probe, predicate)`: it runs the same loop twice — once over
the real tree, once over the real tree with **one poisoned entry appended last** — and
`treeWideScanViolation` requires the visit count to equal `EXPECTED_SOURCE_FILES` and the planted
entry to produce exactly one offender prefixed `<tree-wide-probe>`. Attribution is by the probe's
own `rel`, not a bare count.

**This is a control that exists to prove other controls are not vacuous. Can IT be vacuous?**
That is the rule-15 shape — *when you fix a check, the fix needs its own independent oracle.*
Specifically: the probe is appended **last**; does anything depend on that position? If a
predicate short-circuits, does the visit count still reach `EXPECTED_SOURCE_FILES`? Is
`EXPECTED_SOURCE_FILES` itself derived from the same enumeration it is checking?

## 3. Two admitted gaps — confirm or close them

- **T8-4**: running the per-file R7 over the strings-KEPT view is **GREEN**, because neither sink
  file has an escape inside a string, so the per-file half cannot distinguish the two views on
  today's tree. A real gap, recorded in-tree rather than hidden `[MEASURED-BY-dev-195-r9]`.
  **A pin that only discriminates because of an accident of today's content is a pin with an
  expiry date.** Can you make it discriminate on purpose?
- **C7-p** is a fixture-only shape: planted in `markdown.ts` it fails `tsc` (TS2345). So one
  `ARITY_EVASIONS` row has **no live-tree counterpart**. Is that honest bookkeeping or a fixture
  that cannot express the input it claims to represent?

## 4. The count pins

`EXPECTED_CHECK_CALL_SITES` 77→78, `EXPECTED_CHECKS` 78→79 (derived as
`+ (REQUIRED_SINKS.length - 1)`), `EXPECTED_ASSERTIONS` 123→127, guarded fixture tables 13→17.
The check-total pin **fired** at 79-vs-78 when the B3a check was added, and both totals were
updated in the same commit with provenance entries.

**Two units are in play in that provenance series — "checks run" and "check() call sites" — and
they coincided at 49 and diverge afterwards.** That is *coincidental equality at an origin*: once
two things share a name and coincide at a series' origin, true and false sentences about them
become indistinguishable by surface form. Verify the unit markers the round added are on the
right entries. A prior leg read this series as an error; the ruling was that it is not; **the
ruling could be wrong and you are allowed to say so.**

## 5. Expected-clean checks (report either way)

I expect these clean, and **a clean result is a required reported outcome**:

- no test was weakened, skipped, or had an assertion removed to make the round pass;
- no fixture table shrank;
- every new control throws (so `EXPECTED_ASSERTIONS` accounting stays honest).

---

# Verification bars

- **A negative claim needs a positive control drawn from a DIFFERENT axis than the one you
  searched.** A same-axis positive control is **non-evidence** for the failure that matters.
- **Ask what your oracle can discriminate BEFORE asking what your inputs vary.**
- **A green control is a finding, not a pass.** Write it down.
- **Predict counts BEFORE measuring**, and report the prediction next to the result. The
  developer did this and recorded a miss (predicted `SURVIVED: C7-n, C7-o`; got C7-n and C7-p) —
  that recorded miss is *why* a branch got its own direct assertion. **Do the same.**
- **Exit codes come from the child process, never through a pipe.** A mutant that does not
  compile measured nothing — check that failures are non-zero, not merely that the exit code is.
- **Commit or stash before any mutation experiment**, and revert every mutation.

# Deliverables — you are not done until all four exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r9.md`**, with a
   clear **APPROVE / REQUEST CHANGES** verdict, the §1 vacuity census **with its denominator**,
   your own RED evidence per pin, and each gap severity-rated with `file:line`.
2. **A project log entry** in `.design/project-log/`, **committed** to `markdown-sanitize-r9`.
3. **An explicit list of every place this brief was wrong.** If nothing, say so and say what you
   checked.
4. **Do NOT push. Do NOT modify production code — your independence depends on it.** You may add
   tests and mutate for measurement; revert every mutation and assert `git diff --quiet` on
   non-test files afterwards.

**You MUST produce all four deliverables and then mark the task complete.**
