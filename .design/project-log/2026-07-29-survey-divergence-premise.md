# Survey: the "discovered divergence" premise around url-scheme-cases.json

**Date:** 2026-07-29
**Task:** THE PREMISE SWEEP (read-only survey, dispatched by `farmtable-em-hardening`)
**Full findings:** `/scion-volumes/scratchpad/projects/farmtable/survey-divergence-premise.md`

## Why the sweep ran

We are adding a rule to `web/src/util/safe-url.ts` that rejects URLs with embedded credentials, and
flipping one row of `testdata/url-scheme-cases.json`. That file records server/client divergences that
were **discovered** — someone ran an input through both implementations and watched them disagree. Ours
was **legislated**. The sweep looked for artefacts written when the discovered kind was the only kind,
which may generalise over a category the new row violates.

Prior sweeps searched for the integer `9` and found seven count sentences. Those were already known.
This sweep looked for the **premise**, with or without a number, and counted **identifiers and symbol
names as hits**.

## Population

- Revision: `main` = `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f`. **Not** the working tree, which is at
  `633f8f26` with 138 tracked files differing.
- Method: `git grep -n <term> main -- .` / `git show main:PATH`. No bare filesystem paths.
- **478 tracked files.** No path scope, no file-type filter. 26 terms.

## The two results that change the plan

**1. The premise is compiled, not just written — and it coerces a false statement.**

`divergenceNoteProblems` in `internal/server/urlvalidate_differential_test.go` requires every divergent
row's note to name a client-side mechanism from `clientMechanismTerms = {"WHATWG", "new URL("}`. The
credentials divergence is caused by neither: `new URL('https://user:pass@example.com/x')` parses fine.
A green note must therefore attribute the rejection to a parser that did not make it.

The obvious escape — write a note naming only the side that actually changed — is closed:
`TestDivergenceNoteRuleRejectsANoteThatDescribesNothing` pins `"names only the client's mechanism"` and
`"names only the server's mechanism"` as **negatives that must be rejected**.

**There is no note text for this row that is both green and true.** This is not fixable by editing
prose or counts. Either the rule grows a concept of a legislated divergence, or the row is excluded
from it.

**2. The flip goes the opposite direction from the one assumed.**

Row `userinfo` (`https://user:pass@example.com/x`) is currently `server=accept`, `client=accept` — an
**agreeing** row with an empty note. Flipping `client` to `reject` **creates the 10th divergence**
(9→10), in the minority `server`-more-permissive direction, and pulls a previously note-free row *into*
the guarded set for the first time. Any migration planned around 9→8 is planning the wrong change.

## Sites found (13; full table in the scratchpad doc)

Highest-force first:

| # | Site | Kind |
|---|---|---|
| H1 | `serverMechanismTerms` / `clientMechanismTerms` + enforcement | IDENTIFIER + EXECUTABLE |
| H2 | `"the terms that appear when someone has actually looked at why the two parsers differ"` | PROSE, explicit |
| H3 | pinned negatives forbidding a single-sided note | EXECUTABLE |
| H4 | `TestSharedFixturesRecordRealDivergences` — `Real` = discovered | IDENTIFIER |
| H5 | README: `"Every divergence is recorded below with a measured reason."` | PROSE, explicit |
| H6 | README: `"PINNED AND SAMPLED — NOT BOUNDED"`, the 39-input audit, `"at least 19 shapes are known to diverge and this file pins 9 of them"` | PROSE, explicit |
| H7 | README `SECURITY READING`: `"broken-link and inconsistency bugs, not XSS"` — the new row is the inverse | PROSE, explicit |
| H8 | `safe-url.ts` `"Measured: 9 of 42"` — known count site, **premise in the paragraph** | PROSE |
| H9 | `safe-url.ts:149` `"a real client/server divergence"` | PROSE |
| H10 | `minDivergenceNoteLen`, `"a description of a parser divergence needs at least %d"` | IDENTIFIER + PROSE |
| H11 | `TestValidateURLFieldMatchesSharedFixtures` doc `"...decided differently, because..."` — known count site, **causal claim** | PROSE |
| H12 | `safe-url.test.ts` `"points here for the evidence"` | PROSE |
| H13 | all 9 existing notes are two-mechanism narratives; no precedent row for a decided reason | PROSE (data) |

H6 also strands arithmetic that a count edit cannot repair: after the flip the file pins 10
divergences, but only 9 are members of the "at least 19 known" empirically-found population.

Clean: `CLAUDE.md`, `README.md`, `docs/`, CI workflows, `scripts/` — no references to the family.
`internal/server/urlvalidate.go:226` (`"a deliberate divergence rather than agreement"`) is unrelated to
this family, but is the one place in the repo that already models a legislated divergence honestly, and
may be a useful precedent for the wording problem in H1.

## Control arms

- **Known-positive** `TestSharedFixturesRecordRealDivergences`: **surfaced** at three sites. Method sound.
- **Invented negatives** `zqxjflummoxbanana`, `frobnicatedWidgetPremise`: **0 hits each.**
- **Population printed:** 478 tracked files at `main`; 34 contain `divergen` or `disagree`.

## Closure

Within **478 tracked files at `main` = `2982ffd8`**, read as blobs, **no path scope, no file-type
filter**, over the **26-term list in the scratchpad doc**, counting identifiers and string literals as
hits — H1–H13 is the complete set surfaced. It does **not** cover untracked files, the `633f8f26`
working tree, git history, or premise claims phrased without any of those 26 terms.

## Scope

Read-only. No code changed. Deliverables are this log entry and the scratchpad survey only.
