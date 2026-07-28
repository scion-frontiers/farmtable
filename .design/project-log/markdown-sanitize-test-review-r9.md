# markdown-sanitize round 9 — independent test review (issue #195)

Branch `markdown-sanitize-r9` @ `13680c2`. Independent test-engineering leg.
No production code modified, nothing pushed.

**Verdict: REQUEST CHANGES** on the test-suite work. The security work is
approved on the merits — both blockers are genuinely closed and I re-derived
the evidence myself. The objection is to the round's own new control.

Full report, with every mutant and both recorded prediction misses:
`/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r9.md`.

## Method

107 mutants. 105 scoreable predictions filed **before** the first mutant ran
(`reports/test-195-r9-evidence/predictions.md`); 103 hit, 2 misses recorded and
kept. Content-addressed harness, child exit codes (never through a pipe), tree
restored in a `finally`, `git status --porcelain` asserted empty before and
after every case, `error TS` in a mutant's output flagged as *measured nothing*.
Historical artefacts extracted with `git show`, never retyped.

## The census the round was missing a denominator for

| population | exists | mutated | vacuous |
|---|---|---|---|
| loops | **49** | 49 | **26** |
| fixture tables / source constants | **25** | 25 | **0** |

The round scoped 6 loops and repaired 5. Measured against the class its own
definition names, that is **5 of 26 = 19%**. Every one of the 25 tables is
non-vacuous, including all 8 unguarded ones — the T-4 repair is complete at the
table level, and that is a clean result.

## The definition, corrected

The round's definition — *"a loop is non-vacuous exactly when something asserts
its result for an input whose answer is known in advance"* — is falsified by its
own census. All 23 fixture-consumption loops satisfy it and all 23 are vacuous.
The property that actually separates the one non-vacuous tree-wide loop from the
other 48:

> **A loop is non-vacuous under emptying exactly when some assertion requires a
> POSITIVE outcome from it.** A loop whose assertion only ever *permits* an
> empty result cannot fail when emptied, because empty is the expected answer.

`scanTreeWide` implements exactly this criterion for five loops. It is the right
shape; it just needs to reach the other 21.

## Why REQUEST CHANGES — the detector can itself be vacuous, three ways

`scanTreeWide` exists to prove other controls are not vacuous. It is unproven.

- **D-1 GREEN 79/127** — all five call sites fed 51 entries with real `rel`s and
  `view: ''`. The repair pins loop cardinality and predicate sensitivity, but
  **nothing about the content of the views**. A `stripInertText` regression that
  blanked everything — the exact bug class T-3..T-8 were about — ships green.
- **D-5 GREEN** — `treeWideScanViolation` replaced by `return null`. No
  self-test. Round 8 set the precedent by giving `fixtureTableViolation` one
  (`markdown.test.ts:3823`); round 9's analogue did not get it.
- **D-7 GREEN** — all five `if (vacuous !== null) throw` disarmed. A fixture
  asserts a predicate; nothing asserts the predicate is invoked.

Blocking items: **F1** (`markdown.test.ts:3156-3167`), **F2** (`:3178-3198`).
Non-blocking: F3 (`:3265,:3329,:3346,:3364,:3400`), F4 (21 loops),
F5 (`:3118`), F6 (`:3804`), F7 (`:1830`), F8 (`:3963`), F9 (`:109`).

## Things the round got right, verified independently

- **MUST 1** — A-D1/A-D4 GREEN **78/123** on the `3f6a695` test file, **RED 1 of
  79** on HEAD's. A-D2 (bare string) is RED both sides, which is why the
  template-type pair is the evidence that matters.
- **MUST 2** — reverting to the process-global singleton is RED, and the message
  quotes the exploit verbatim (`onerror`, `<script>`); `tsc` 0, so it compiled
  and really measured.
- **The units ruling holds.** I walked all 42 commits touching the file rather
  than sampling. `check()` call sites and checks-run coincided at 49 at
  `7084880` and have differed by exactly `REQUIRED_SINKS.length - 1 = 1` since
  `849a9da` — the commit that introduces the `REQUIRED_SINKS` loop. `61 → 69` is
  checks-run to checks-run; the unit switch is at `68 → 74`. Six in-tree unit
  markers, all on the right entries.
- **`EXPECTED_SOURCE_FILES` is not circular** — `markdown.test.ts:1201` is an
  independent literal, not derived from the enumeration it checks.
- **All three expected-clean checks are clean**: 0 assertions removed / 4 added
  (matching 123→127), 0 checks removed / 1 added (matching 77→78), no table
  shrank, no skip markers. `markdown.ts` is comment-only over the round.

## Two smaller notes worth carrying

- **The "probe appended LAST" rationale has an unreachable arm.** Probe-first and
  probe-last under a truncating mutation produce byte-identical failures — the
  `visited` arm always fires first. The position matters only once `visited` is
  also disabled. Defence in depth, stated as if load-bearing.
- **The fixture-table count recipe re-instantiated its own defect.** `1ec4a7b`
  corrected the recipe to note it is *off by one* because the comment contains
  the string it greps for — but the correction added a **second** occurrence.
  Measured at HEAD: 23 greppable lines, 17 real, naive recipe yields 19. Off by
  **two**. It was correctly off by one at `6108017`.

## Brief errors

Four, reported in full in the report: the `EXPECTED_CHECKS` "78→79" phrasing
(it is a derived value, not an edited constant — the same unit slip one level
up, in the section about unit slips); the two detector arms presented as
co-equal when one is unreachable; a `[MEASURED]` tag on a claim about the
developer's session that no commit can exhibit; and a 40%-complete estimate for
a scope that measures 19%.
