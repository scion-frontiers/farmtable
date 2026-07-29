# LEG BRIEF — code review, #195 round 6

Read the shared brief first:
`/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-195-r6-review-shared.md`

- **Your clone is mounted AT `/workspace`.** Branch `markdown-sanitize`, verify
  `git rev-parse HEAD` == `86f30bcdc699367681ccffbc4fde1e40006fd754`.
- **Scratch dir (yours alone):**
  `/scion-volumes/scratchpad/projects/farmtable/salvage/r6-review-195/`
- **Report to:** `/scion-volumes/scratchpad/projects/farmtable/reports/review-195-r6.md`

Range: `53296af..86f30bc`, 814 insertions / 95 deletions across 5 files.
Three commits: `fc2b947` (fix), `febc655` (F1 mirror test), `86f30bc` (log).

## Charges

**1. THE PRIORITY CHARGE — the arity fix is now three-sided. Is each side
load-bearing, and is any side itself self-derived?**

I briefed `renderMarkdown.length === 1` as a complete one-line fix for T1. **It
is insufficient and the developer caught it**, which is a correction against me,
not against them: `Function.length` stops counting at the first defaulted or
rest parameter, so `renderMarkdown(md, opts = {})` reports 1 and walks straight
past the check — and that is the most natural way anyone would actually add an
options parameter. They closed it from three sides instead: `Function.length`,
a scan of the declaration text, and `sinkArgumentIsSanitized` rejecting a
top-level comma.

Review all three. For each: what spelling does it catch that the other two miss,
and what spelling does it still miss? Specifically probe `(md, ...rest)`,
`(md, opts = {})`, `(md, {inline} = {})`, a trailing comma in the declaration, a
comma inside a default value or a type annotation (`(md: string, o: Record<string,
string>)`), and a comment containing a comma. The declaration-text scan is a
regex over source; regexes over source are how F1 got here.

**2. `EXPECTED_CHECKS` is now derived in code** from
`EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1)`. This is the exact
shape of this workstream's unifying defect: *a check that derives from the thing
it is checking cannot falsify it.* Is this derivation a genuine invariant, or has
the count pin been converted into a tautology that moves whenever the thing it
pins moves? If adding a sink silently raises the expected count, the pin no
longer pins. State which edits it can still catch and which it now cannot.

**3. T3 deleted `IGNORE_MARKER` entirely.** The developer took this with an
accepted, documented cost: "a production string literal naming a banned form now
has no in-file escape." Confirm by sweep that nothing in the real tree needs it
today, and assess the failure mode when someone does — does the guard fail with a
comprehensible message pointing at the right remedy, or does it just go red with
no route forward? A removed escape hatch is fine; a removed escape hatch with no
documented successor is a trap for the next author.

**4. The production diff — first change to `markdown.ts` since round 2.** Four
items: `slot` added to `FORBID_ATTR`, a non-string guard (`typeof md !== 'string'
→ ''`), `dompurify` range tightened `^3.0.0`→`^3.4.12` in `package.json` +
lockfile, and a URI-policy pin. For each, separately: is it correct, is it
minimal, and **is it actually tested by something that would go red if it were
reverted?** The non-string guard in particular changes behaviour for callers —
`renderMarkdown(undefined)` used to throw and now returns `''`. Is silently
swallowing a type error the right call at a security boundary, or does it hide a
caller bug? Argue it either way, but argue it.

**5. F1's fix and its mirror.** `stripImportStatements` used `[^;]`, which
matches newlines, so one import swallowed the next. Check the replacement against
the real grammar it is approximating: multi-line imports, `import type`, side-
effect imports (`import './x'`), `export ... from`, dynamic `import()`, a
semicolon inside a string literal in the specifier, and ASI style with no
semicolons at all. `febc655` pins the mirror — a correct ASI-style file must be
*accepted*. Verify the mirror is discriminating, not just green.

**6. Comment and claim accuracy across the whole diff.** Same sweep as #194: this
workstream's signature defect is a property that holds for one consumer stated as
if it held for all. Read the new security comment on `renderMarkdown` ("THIS
FUNCTION TAKES EXACTLY ONE PARAMETER, AND THAT IS A SECURITY PROPERTY") and every
other comment the round touched, and check each against the code rather than the
intent. Include the developer's log "what this closes" table.

**7. C1 and C2 — the exit criterion and the sunset clause.** C1 restated the exit
criterion in artifact terms; C2 added a sunset clause. Are these written so that
a future reader can tell, mechanically, whether they have been satisfied or
expired — or are they prose that will be read as satisfied by whoever wants to
ship? Related standing problem, which you may treat as in scope: a correctly-
reasoned disclosed survivor whose justification has no tripwire is *an assumption
with an expiration date nobody set*. Does C2 set one?

Report per the shared brief's structure. Mark findings **BY EXECUTION** or
**REASONED**. **Commit locally, do not push, do not modify production code.**
You MUST write `review-195-r6.md` and then mark the task complete.
