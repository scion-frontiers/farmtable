# Brief — test-195-r8: independent TEST REVIEW of #195 round 8

## Your working tree

**Your working tree is `/workspace`.** Confirm with `git rev-parse --show-toplevel`, then
verify BOTH branch and SHA:

- branch `markdown-sanitize-r8`, **HEAD `3f6a695ed450718316b50303975621bbb725e4f8`**
- base `7b4f6dd`

**Do NOT create any directory named in this brief.** If a path here does not exist, the
brief is wrong; tell me.

**[MEASURED by me]** `7b4f6dd` is an ancestor of `3f6a695`; negative control `1d4442f` is
not. Surface excluding `.design/`: `markdown.ts` **+79/−34**, `markdown.test.ts`
**+514/−59**.

A code reviewer and a security auditor are on the same SHA in parallel. **You will not see
their reports and they will not see yours.** Do not cover their ground.

## The one thing to internalise before you plan anything

**A GREEN CONTROL IS A FINDING, NOT A PASS.**

The dev leg this round set out to fix a cosmetic false-positive in the arity fixtures.
It added the fixture, expected RED, **got GREEN** — and that green control is the only
reason anyone discovered that the scanner's capture regex had been silently truncating for
three rounds. Its exact words: *"my first control failed to go red, which is what exposed
the truncation."*

The mechanism is worth naming, because it is new: **two defects that mask each other.**
The false-positive spellings the fix targeted were *unreachable* through the truncating
regex, so the `hasTopLevelDefault` bug and the truncation bug each made the other
invisible — and each made the other's fix look unnecessary. Fixing either one alone leaves
the suite green and looks like the fix was pointless.

**Hunt for more pairs of that shape.** That is the highest-value thing you can do here.
Wherever this suite has two independent guards over the same property, ask whether one's
fixtures are reachable given the other's behaviour.

## What round 8 changed

B1 the arity rule restated in both directions · B2 a positive control for
`fixtureTableViolation` (the single function guarding **eleven** fixture tables, which had
none) · B3a a private DOMPurify instance · B3b both remaining `import(...)` productions ·
B3c `R6b` promoted tree-wide · B4 a `69 -> 73` annotation on a constant of 74, corrected
to `68 -> 74` · B5a/B5b two corrected rationales · six non-blocking items ·
**C7-l / C7-m, a live bypass of the arity pin.**

## 1. The pinned totals — recompute them, do not read them

**[MEASURED-BY-dev-195-r8]** `npm test` → exit 0, **78 checks, 123 assertions**; the leg
derives `EXPECTED_CHECKS = 77 call sites + (2 − 1) = 78`, and predicted every intermediate
count before measuring: 75/122 → 77/122 → 78/122 → 78/122 → 78/123, all exact.

Last round's test leg established the right method for this and it is the method I want:
**derive all five pinned totals from a STATIC READ OF THE SOURCE, never from the runner's
output.** A total computed from the run it is supposed to pin is a post-hoc tally, which is
one of the catalogued defect forms here. Last round that method proved the tally sub-form
was *absent*, which was the round's strongest single result — a clean negative, honestly
obtained, is a real finding.

`EXPECTED_CHECKS`, `EXPECTED_CHECK_CALL_SITES`, `EXPECTED_ASSERTIONS`,
`EXPECTED_SOURCE_FILES`, `EXPECTED_REQUIRED_SINKS`. Predict each before you measure.

## 2. Can the NEW code fail? `balancedDeclarationParameterLists` is the target

It is new this round (`markdown.test.ts:1700`), it replaced a control that was silently
broken for three rounds, and **it is itself unpinned by anything except the fixtures it
scores.** That is the exact configuration that produced C7-l.

- Mutate it. Does anything notice? The leg reports reverting it reddens C7-l and C7-m by
  name — reproduce that, then go past it: what mutations of it does **nothing** catch?
- Feed it declarations with parens inside string literals, template literals, regex
  literals, and comments. Depth counting handles nesting; it does not automatically handle
  quoting.
- `authorship note`: `renderMarkdownArityViolation` runs BEFORE the `.length` check and
  throws, so `.length === 1` is not the reporter for most spellings. The leg established
  `.length`'s real unique coverage **by ablation** — blinding the scan and emptying both
  arity tables — and found it uniquely catches `opts?: T` and nothing else. **Reproduce
  that ablation independently.** If `.length === 1` has no unique coverage at all, the
  round-8 sentence is the fifth false sentence in this chain and I want to know now.

## 3. B2's positive control — check that it controls the right thing

`fixtureTableViolation` guards eleven fixture tables. Before this round, neutering it left
the suite **GREEN at 75/122** with all the tables emptied. B2 adds the control.
Verify: (a) the control goes RED when the function is neutered; (b) it goes RED for the
*right reason*; (c) it does not go red for a reason that would also fire on a healthy
tree. A control that reddens on everything is as useless as one that reddens on nothing.

## 4. Three things the leg explicitly took ON TRUST — one of them is yours

Its own list, quoted so you do not have to guess my summary:

- the round-6 "GREEN at 69 checks" figures quoted throughout the docblocks — *"historical
  narrative, not load-bearing on any current predicate"*;
- the claim in the r7 log that round 6 landed three production changes, not four;
- the CVE/advisory attribution behind the dompurify 3.4.12 floor.

The third is the security auditor's. **The first two are yours, and only if they are
cheap.** If a docblock figure is quoted as history it needs an anchor to the tree it was
measured on; if it has none, that is a Low, not a blocker. Do not spend your budget here.

## 5. An anti-instruction, because my hypotheses keep being the error

Last round I told a test leg "the danger is 1060 lines of tests that cannot fail." It
measured **103 of 105** mutations landing exactly as predicted. My hypothesis was wrong,
and its most useful sentence was: *"a leg that had spent its budget looking for inert tests
would have found F-1 and missed F-2 entirely."*

So do **not** assume these tests are inert. The failure mode in this suite has consistently
been **the one guard nobody guards** — the shared helper, the single predicate, the
function every fixture table routes through. Neuter *those*.

## Gates — exit codes from the child, never through a pipe

Run in `web/`. **`npm ci`, not `npm install`.**
`npm test` → 0 (78 checks, 123 assertions) · `npx tsc --noEmit` → 0 · `npm run build` → 0.
**There is no CI anywhere in this repo**; `make test` and `make web` never run these
checks. Tracked and deferred — not a finding.

## Known-open — tracked, do not re-litigate the category

**F-4** (a Vite plugin injecting a script into `dist/index.html`; adding the build config to
`EXTRA_SCANNED_FILES` would **not** catch it) — open, out of scope, assigned to the audit
leg. Also: inverting `markdown.ts` to an allow-list; the `#204` lint rule rescoped to the
regex-shaped subset. **New instances are still findings.**

## Standing bars

- **Positive control before any negative claim**, and **verify a green mutation actually
  weakened the thing** — see the top of this brief for why that one is not boilerplate.
- **Predict counts BEFORE measuring**, written to a file first, derived from a static read.
- **Mutations content-addressed, never line-addressed; ABORT if the anchor is not unique.**
  The dev leg had two of its own mutations abort on anchors that matched its own docblock
  prose — the discipline worked on the person who wrote it.
- **Any harness ABORTS on a failed prerequisite** — 0 checks parsed, 0 files scanned, a RED
  baseline. Fourteen void harnesses on this workstream; every one printed a clean,
  confident, wrong number, and **the only detector that has ever caught one is a number
  contradicting something visible.**
- Exit codes from the child. **Quote every glob** (`--include='*.ts'`).
- Finish with `git status --porcelain` empty. **Do not push.**

## Deliverables

1. `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r8.md` — verdict; your
   mutation table with **predicted vs actual for every scored mutation**; the five
   recomputed totals with their derivations; the §2 ablation result; **what you could not
   verify**; **your void runs, in full**; and a **WHERE THIS BRIEF IS WRONG** section. The
   last leg found **four** errors in my brief, one of which would have installed a new
   false sentence in the commit fixing the old one. Assume there is one here.
2. Your prediction file, written **before** the corresponding measurement.
3. A project-log entry committed in `.design/project-log/`.

**You MUST write the report file, commit the project-log entry, and then mark the task
complete.**
