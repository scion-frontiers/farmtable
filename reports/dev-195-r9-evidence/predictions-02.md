# dev-195-r9 — predictions for T-8 and T-9, written BEFORE the mutations

Tree at `6108017` (branch `markdown-sanitize-r9`), green: `npm test` 0,
`79 checks passed (127 assertions)`, `tsc` 0.

## T-8 — the ":2551-2554 narrower view" sentence

The sentence claims the per-file R7 "keeps its own narrower view (`code`, strings
blanked, imports NOT stripped)". Read off the tree:

- per-file, `sinkBindingViolations`: `const code = stripInertText(src, { strings: true })`
- tree-wide, the `scanned` map: `codeNoStrings: stripInertText(src, { strings: true })`

Same expression, same `readFileSync(…, 'utf8')` bytes. So "narrower" is false and
"imports NOT stripped" is not a distinction either — neither view strips imports
any more. Predicted: both sub-claims FALSE, confirming test-195-r8's T-8.

The real defect this exposes is not the sentence: it is that the SAME predicate
is written out TWICE over the SAME view, and only one copy is the shared
function. R6b already solved this ("both call sites share so that the two scopes
cannot drift apart"). Predicted repair: the per-file R7 delegates to
`escapeInCodeOffenders`.

| id | mutation | prediction |
|---|---|---|
| T8-1 | BEFORE the repair: delete the per-file R7 block | RED — V8/V8b in SINK_EVASIONS. The tree-wide copy cannot cover them: those fixtures are synthetic strings handed to `sinkBindingViolations`, never on disk, so the `scanned` loop never sees them. If GREEN, the per-file half has no unique coverage and should be deleted, not shared. |
| T8-2 | AFTER the repair: delete the delegated call | RED, same fixtures, same count. Anything else means the repair moved coverage. |
| T8-3 | view control, different axis: tree-wide R7 reads `code` (strings KEPT) instead of `codeNoStrings` | RED — `markdown.ts` contains `'☑︎'`, an escape inside a string literal, so a strings-kept view false-positives on the real tree. This is the positive control that the view choice is load-bearing even though the two views are equal. |
| T8-4 | per-file R7 reads `withStrings` instead of `code` | GREEN predicted — neither sink file has an escape inside a string. If GREEN it is a coverage gap on the per-file side, and it is the mirror of T8-3, i.e. one axis covered and one not. |

Counts predicted unchanged: 79 checks / 127 assertions, tsc 0, build 0.

## T-9 — both promoted tree-wide tripwires are vacuous

The two promoted checks each open with a hand-written
`for (const … of scanned) offenders.push(...predicate(…))`. The PREDICATES are
fixtured (`ESCAPE_EVASIONS`, and the dynamic-import table); the LOOPS are not.
Same shape as T-4: the harness cannot express a wrong input for the loop, so the
loop has no positive control.

| id | mutation | prediction |
|---|---|---|
| T9-H1 | tree-wide R7: iterate `[]` instead of `scanned` | GREEN (vacuous) — reproduces test-195-r8's H1 |
| T9-H2 | tree-wide R6b: iterate `[]` instead of `scanned` | GREEN (vacuous) — reproduces H2 |
| T9-H3 | contrast control, different axis: iterate `[]` in the mechanism-(c) ownership loop | RED predicted — that loop already has the round-9 hoisted-table pins behind it. If GREEN, three loops are vacuous, not two. |

Repair: one shared `scanTreeWide(entries, predicate)` used by BOTH the real scan
and, in the same check, a positive control that appends ONE poisoned entry and
requires exactly one offender naming `<probe>`. A mutation to the loop then hits
the control too, which is precisely what T-4 did for the arrays.

| id | mutation, AFTER the repair | prediction |
|---|---|---|
| T9-1 | `scanTreeWide` returns `[]` unconditionally | RED in BOTH promoted tripwires, with the probe message |
| T9-2 | `scanTreeWide` iterates only `entries[0]` | RED in both — the probe entry is appended last, deliberately |
| T9-3 | delete the probe entry from the R7 control | RED via the `!== 1` arm of the control itself |

Counts predicted unchanged: 79 / 127. No assert helper is added (these controls
throw, like every other control in this file), so `EXPECTED_ASSERTIONS` must not
move. If it moves, one of my edits used an assert helper by accident.
