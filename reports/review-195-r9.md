# #195 round 9 (`markdown-sanitize-r9` @ `13680c2`) — Independent Code Review

Reviewer: independent code-review leg. Working tree `/workspace`, branch
`markdown-sanitize-r9`, HEAD `13680c2b7d7fd64841573894e5bb1224924eefdd`, verified clean
before and after every experiment.

Every measurement below is **mine**, taken this session, with exit codes read from the
child process (`subprocess.run`), each mutation applied and reverted in a `finally` with a
`git status --porcelain` assertion on both sides. Predictions were written to
`/tmp/rev/predictions.md` before measuring and are reported next to the results, including
the two I got wrong. Where I agree with a claim from the brief or the developer report, I
say whose claim it is and show my own measurement.

## Executive Summary

The class fix is real: `literalBlindView` genuinely closes the template-literal-type arity
bypass, all five scanners have unique coverage at HEAD, and seven adversarial declaration
shapes I invented are all caught. Risk level **MEDIUM**, and it is not the sanitizer — it
is that the round's own central structural decision ("decide over the blinded view, report
from the raw view") is pinned by **nothing at any of its five sites**, and one of those
five is a one-word edit that silently re-creates the exact caller-masking `e3002b9` was
written to remove.

## Critical

None. No production behaviour changed and no live bypass survives my probes.

## Required

### R1 — The decide-blinded / report-raw split has zero coverage at all five sites, and one of them silently restores the r8 masking

`web/src/util/markdown.test.ts:2045`, `:1969`, `:2285`, `:2379`, `:2380`

The brief asks whether the work has "migrated to some other common ancestor that would
mask the same way", and whether there is "a new single point whose removal silently makes
several downstream checks vacuous." **Yes, and it is `balancedDeclarationParameterLists`'s
return value.**

`renderMarkdownArityViolation` no longer pre-blinds (good — that was `e3002b9`), but
`balancedDeclarationParameterLists` still *slices from the original* and hands the raw text
down. That is the only thing making `splitTopLevelParameters`' and `hasTopLevelDefault`'s
own blinding observable, and it is asserted by nothing:

| id | mutation | prediction | measured |
|---|---|---|---|
| M10 | `:2045` `out.push(code.slice(start, i - 1))` → `scan.slice(…)` | GREEN | **GREEN 79/127** |
| M10+M2 | M10 *plus* `splitTopLevelParameters` scanning raw | — | **GREEN 79/127** (M2 alone is RED) |
| M10+M3 | M10 *plus* `hasTopLevelDefault` scanning raw | — | **GREEN 79/127** (M3 alone is RED) |
| M11 | `:1969` `current += params[i]` → `scan[i]` | GREEN | **GREEN 79/127** |
| M12 | `:2285` `code.slice(…)` → `scan.slice(…)` | RED (**I was wrong**) | **GREEN 79/127** |
| M9 | `:2379` `extraArgument` reads `scan` instead of `t` | GREEN | **GREEN 79/127** |
| M8 | `:2380` trailing-text arm reads `scan` instead of `t` | GREEN | **GREEN 79/127** |

The comment at `:2130-2140` says each scanner "is load bearing on its own and C-4/C-5/C-6
are red individually." True today — I reproduced it (see Positive Feedback). But the
*invariant that makes it true* is unpinned, and M10+M2 / M10+M3 show the round-8 masking
returning with all 79 checks green.

Two of the five sites additionally carry rationales that are **measurably false**, so a
maintainer who checks the stated reason will find it wrong and has no test to stop them:

- `:2373-2377` — "blinding turns a string second argument into spaces, so
  `renderMarkdown(x, 'y')` would read as a trailing comma and pass."
  Measured with the file's own `literalBlindView`:
  `literalBlindView("renderMarkdown(x, 'y')")` → `"renderMarkdown(x, ' ')"`. **The quote
  delimiters survive blinding**, the slice is `' '` (3 chars, non-empty), and the call is
  still rejected. M9 GREEN confirms zero behavioural difference.
- `:2335-2339` — "blinding replaces literal text with spaces, so `t.slice(i).trim()` over
  the blinded view would treat a trailing template as empty and accept `renderMarkdown(x)`
  followed by junk."
  Measured: ``literalBlindView("renderMarkdown(x) `junk`")`` → ``"renderMarkdown(x) `    `"``.
  **The backticks survive.** M8 GREEN.

The only construct that blinds to pure whitespace is a *comment*, and a trailing comment is
not junk reaching the DOM. The rationale that would be true — "a trailing comment would read
as empty" — is not the one written, and rejecting `renderMarkdown(x) /* c */` (which the
code does today, measured) is arguably the false positive this round elsewhere set out to
eliminate.

`callArguments`' rationale at `:2257-2262` ("the argument text is SLICED FROM THE ORIGINAL …
while `dynamicImportSpecifierOffenders` still sees the real specifier characters it has to
classify") is also imprecise: reading `dynamicImportSpecifierOffenders` at `:3054-3068`, the
*classification* regex `/^\s*['"][^'"]*['"]\s*$/` is unaffected by blinding (quotes survive;
`'dompur' + 'ify'` still fails it). What actually breaks under M12 is the **failure message
and its line number** — `code.indexOf(arg)` returns −1 and `lineOf` reports line 1. That is a
real reason, it is just not the stated one, and nothing pins it.

**Suggested fix — pick one per site, but make the comment match the measurement:**

1. *M10/M11 (message provenance).* Assert message content, not just null-vs-non-null, for
   at least one `ARITY_EVASIONS` entry: e.g. require that the violation string returned for
   C7-n contains the literal `` `)` ``. Blinded slices produce blanks and the assertion
   fails. One line in the existing `fixture: the arity pin …` check.
2. *M12.* Add a `DYNAMIC_IMPORT_EVASIONS` assertion on the reported `rel:line` and on the
   quoted specifier text, not merely on "an offender was produced."
3. *M8/M9.* Either add the discriminating fixture — a `SINK_EVASIONS` entry whose blinded
   form is whitespace (`unsafeHTML(renderMarkdown(this.body) /* x */)`, currently rejected)
   — **or**, if that rejection is itself unwanted, delete the "deliberately reads the
   ORIGINAL" claim and read the blinded view uniformly. Do not keep an undefended
   "deliberate" choice with a false defence.

### R2 — `run()` still asserts the ordering claim that `4341965` was written to retract, and it asserts it for both poisoners

`web/src/util/markdown.test.ts:4560-4566` (added this round by `c331abf`)

> "THE TWO GLOBAL POISONERS, LAST, AND THEY MUST STAY LAST. Neither `marked.use` nor
> `DOMPurify.setConfig` has an undo, and `setConfig` is sticky, **so either one running
> earlier would contaminate every rendering check after it.**"

That is the claim the developer measured false in the very next commit and corrected at the
section header (`:895-907`: "move this call to the TOP of run() and the suite is GREEN at
79/127 … The contamination argument is circular"). The correction was applied at one of the
two places the claim is written. My measurements:

| id | mutation | measured |
|---|---|---|
| J3 | `privateDOMPurifyInstance()` moved to the top of `run()` | **GREEN, 79 checks / 127 assertions**, exit 0 |
| J4 | `sharedMarkedSingleton()` moved to the top of `run()` | **GREEN, 79 checks / 127 assertions**, exit 0 |

So the sentence is false for **both** halves. J3 confirms the developer's finding (their
claim, my measurement, and it also confirms that the brief's original rationale was wrong).
J4 is new: the `marked` half was never re-measured by anyone and still carries the
unmeasured contamination rationale, now in a comment added this round.

This is an instance fix of a two-instance class, shipped inside the round whose thesis is
"fix the class, not the instance," in a commit that immediately follows the one that
identified the class. That is why it is Required rather than a nit: it is the third
consecutive round in which a "correct the false rationale" commit ships a false rationale.

**Suggested fix.** Replace the causal clause with the measurement, e.g.:

> Both poisoners are measured order-independent on today's tree — moving either to the top
> of `run()` is green at 79/127 — because every rendering check reaches its globals through
> `renderMarkdown`, which owns private instances. They run last so that the property stays
> unconditional if a future check reads `marked` or `DOMPurify` directly. `setConfig` and
> `marked.use` have no undo.

## Nit / Optional

### N1 — the count-recipe correction is itself off by two

`web/src/util/markdown.test.ts:3804-3811`, and `.design/project-log/markdown-sanitize-cleanup-r9.md:101-104`

The comment says the superseded recipe "is off by one because THIS COMMENT contains the
string it greps for." Measured across the three relevant revisions:

| revision | `grep -c "fixtureTableViolation('"` | naive recipe (−4 `'X'` calls) | anchored recipe `^␣␣␣␣␣␣fixtureTableViolation('` |
|---|---|---|---|
| `469694a` (before the fix) | 22 | 18 | 17 → off by **one** ✓ |
| `1ec4a7b` (the fix) | 23 | 19 | 17 → off by **two** |
| `13680c2` (HEAD) | 23 | 19 | 17 → off by **two** |

`1ec4a7b` added a *second* occurrence of the grepped string (`:3806`, which quotes the old
recipe) in the act of describing the first. The anchored recipe is correct and is what the
comment tells you to use, so practical harm is near zero — but the diagnostic sentence is
false as committed. Fix: say "off by two", or stop spelling the grepped string in prose
(e.g. write `fixtureTableViolation` and the quote separately).

### N2 — `code` names opposite views in the two scopes the new T-8 comment compares

`web/src/util/markdown.test.ts:2691` vs `:2600` and `:3277-3278`

In `sinkBindingViolations`, `code = stripInertText(src, { strings: true })` (strings
**blanked**) and `withStrings = stripInertText(src, { strings: false })` (strings kept).
In the `scanned` map, `code` is `{ strings: false }` (strings **kept**) and `codeNoStrings`
is `{ strings: true }`. The new comment at `:2691` reads

> "the TREE-WIDE half over `code` (strings KEPT) -> RED"

which is true of the tree-wide `code` and directly contradicts the local `code` a reader has
in scope four lines earlier. Given that the entire T-8 finding was a mislabelled view, the
collision is worth removing. Suggested fix: rename the `scanned` field `code` → `withStrings`
so the two scopes agree, or qualify the reference as `scanned[].code`.

### N3 — the "three of five had no unique coverage" finding undercounts itself; it was five of five

I ran the five scanner-blinding deletions against the intermediate commits in a throwaway
worktree (removed; `git worktree list` shows only `/workspace`):

| revision | M1 `balancedDecl…` | M2 `splitTopLevel…` | M3 `hasTopLevelDefault` | M4 `callArguments` | M5 `sinkArgumentIsSanitized` |
|---|---|---|---|---|---|
| `affa615` ("class fix") | GREEN | GREEN | GREEN | GREEN | GREEN |
| `e3002b9` (pre-blinding removed) | RED | RED | RED | GREEN | GREEN |
| `13680c2` (HEAD) | RED | RED | RED | RED | RED |

At `affa615` the class fix had unique coverage at **none** of its five sites, not three. The
two sink-side sites were covered later and by a *different* commit for a *different* reason
— `6103b9a`, whose `SINK_CALL_LEGITIMATE` template-argument entries are what make M4/M5 red
— not by removing the caller pre-blinding. Consequences for two in-tree claims:

- `:1526-1529` "each of the five has a fixture in this file that moves when its use of this
  helper is removed, **and those fixtures are named in the mutation table in the round-9
  report**" — first clause TRUE (I measured it, M1–M5 all RED at HEAD, each with distinct
  attribution). Second clause FALSE: the report's table names C-4/C-5/C-6 only, three of
  five. There is no mutation entry for `callArguments` or `sinkArgumentIsSanitized`.
- `dev-195-r9.md:125-136` and the project log's "three of the five" should read five of
  five, with the two sink-side sites attributed to `6103b9a`.

### N4 — C7-p's "fixture-only" status applies identically to C7-m, which is not recorded that way

Planting each declaration into the real `web/src/util/markdown.ts` and taking `tsc --noEmit`
from the child process:

| entry | shape | `tsc --noEmit` | `npm test` |
|---|---|---|---|
| C7-n | `` md: string \| `)` `` | 0 | RED (caught) |
| C7-o | `` md: string \| `(` `` | 0 | RED (caught) |
| C7-q | `md: string \| ")"` | 0 | RED (caught) |
| C7-l | `md: string \| ((x: string) => string)` | 0 | RED (caught) |
| **C7-m** | `md: (x: string) => string` | **2, TS2345** | n/a |
| **C7-p** | `` md: (x: string) => string \| `)` `` | **2, TS2345** | n/a |

C7-p's non-compilation is confirmed (developer's claim, my measurement). But C7-m — an entry
that predates this round — has exactly the same property for exactly the same reason
(`md` is passed a `string` at both live call sites and inside the test file). Applying the
round's own criterion consistently reclassifies C7-m as fixture-only too. Either record both,
or record neither and say the criterion is "does it survive `tsc` in the live tree" as a
property of the table rather than of one entry.

## FYI

- **`.length` read-back, independently reproduced.** I extracted `ARITY_EVASIONS` from the
  compiled test module (the real table, not a transcription), compiled all seventeen with
  the project's own `tsc` (exit 0), imported the emitted JS and read `renderMarkdown.length`.
  Result: 17 parsed, 17 compiled, **exactly three off 1 — C7-d → 2, C7-j → 0, C7-k → 0.**
  The new sentences at `markdown.ts:176-181` and `markdown.test.ts:644-651` are TRUE. One
  precision point: "seventeen compiled" holds with a neutral body; with
  `ARITY_SOUND_SOURCE`'s own `DOMPurify.sanitize(md)` body, four of the seventeen (C7-j,
  C7-l, C7-m, C7-p) fail `tsc` with TS2345. The sentence does not say which body, and the
  distinction is the same one N4 is about.
- **P10 confirmed open, and deferring it is the right call.** Measured against the real
  function: `sinkArgumentIsSanitized("renderMarkdown({ md: this.body, inline: true })")`
  → `true`. It is not a live hole: the declaration-side scan rejects a destructured sole
  parameter explicitly (`:2177-2183`, fixture C7-i), so both layers would have to be
  defeated by unrelated means, and the two do not share a failure mode here. Closing it
  needs an expression parser. Deferring it with the in-tree note at `:2109-2114` is
  proportionate. I would ask only that the note be repeated at `sinkArgumentIsSanitized`
  itself — the report says it is "documented in-tree at the function", and it is documented
  at the *other* function.
- **The P1 trailing-comma rewrite is correct as new logic.** I exercised it directly:
  `renderMarkdown(this.body,)` → accepted; `renderMarkdown(this.body, { inline: true })`,
  `renderMarkdown(this.body, 'y')`, `` renderMarkdown(`)`, { inline: true }) ``,
  `renderMarkdown(this.body) + this.body` → all rejected. The `topLevelCommas` + "something
  follows before the close paren" formulation also handles `renderMarkdown(a, b,)`
  (rejected — the first comma has `b,` after it). No off-by-one found.
- **`scanTreeWide` runs each tree-wide predicate twice over 51 files ×5 rules.** `npm test`
  still completes in a few seconds. No action; noting it so nobody is surprised later.
- **"Nothing was pushed" is not verifiable from this clone, and the brief asked for it
  anyway.** `remote.origin.url` is `/workspace/farmtable-195-r8`, which does not exist
  (`git ls-remote` fails). `refs/remotes/origin/markdown-sanitize-r9` already equals HEAD,
  and `refs/remotes/origin/HEAD` equals HEAD, purely because this workspace was cloned from
  the developer's tree at 08:01 (`git reflog`: a single `clone:` entry). A reviewer could
  read that ref as proof of a push or the dead remote as proof of no push; neither is
  evidence. **Reported as unverifiable, not as clean.** There is no network remote and no
  GitHub remote, so `gh pr` is not usable on this change.

## Positive Feedback

Not manufactured — these are things I tried to break and could not.

- **The class fix holds.** Seven adversarial declaration shapes of my own, run through the
  real `renderMarkdownArityViolation`, all **caught**: `` `${')'}` `` (interpolated string
  literal type), `` `${`)`}` `` (nested template type), `` `)` ``, `` `\`` `` (escaped
  backtick), `` `${string})` ``, `` Uppercase<`)`> ``, and `md /* ) */: string, opts = {}`.
  The `${…}`-preserving design does not leak a structural paren, because a paren reachable
  inside a type-position interpolation has to come through a string-literal type, which
  `strings: true` blanks.
- **All five shared call sites are individually load-bearing at HEAD**, each with distinct
  attribution — confirming the developer's claim with my own runs:
  M1 → `SURVIVED: C7-n, C7-p, C7-q`; M2 → false positives on the in-list comment and
  `` `a,b` ``; M3 → false positive on `` `a=b` ``; M4 → false positive on
  `` unsafeHTML(renderMarkdown(`a)b`) ``; M5 → false positives on `` `a,b` `` and `` `a)b` ``.
  I predicted M4 would be GREEN. **I was wrong**, and `SINK_CALL_LEGITIMATE` is why.
  M6 (`templateText: false`) → RED, 2 checks; M7 (`strings: false`) → RED, `SURVIVED: C7-q`
  **only**, which is a genuine cross-axis control.
- **The B3a pin is the best-built check in the file.** Poison the global, *assert the
  poisoning took* before asserting anything else, then assert `renderMarkdown` is
  unaffected. The positive control is what stops it degrading into a vacuous pass, and it is
  the pattern the rest of the file should copy.
- **`scanTreeWide` is a real level-out.** Attribution by the probe's own `rel` rather than
  by a bare offender count is the right call, and reading the mechanism-(c) probe out of
  `SANITIZER_DEPENDENCIES[0]` so that emptying the array reddens the control rather than
  quietly disarming it is a nice touch.
- **The false-positive tables are the right instinct.** "A guard that rejects legal code
  gets deleted" is the correct threat model for a guard nobody is forced to keep, and P1
  (a live false positive on prettier's own output) proves the point.

## Test Coverage

New paths are well covered on the axes the round targeted and uncovered on the axis it
introduced.

- Covered: `literalBlindView` and both of its option flags (M6, M7 red with distinct
  attribution); all five scanners' use of it (M1–M5 red); the unterminated-list branch (the
  developer's C-9, and the direct assertion at `:2143-2151`); the tree-wide loops (five
  previously-vacuous loops now have positive controls); the four hoisted fixture arrays;
  B3a.
- **Not covered: every "slice from the original" pairing** — five sites, M8–M12 all green.
  That is R1 and it is the coverage gap of this round.
- Not covered, and correctly declared rather than hidden: T8-4 (the per-file R7 cannot
  distinguish its two candidate views on today's tree) and P10.
- Fixture tables: 13 → 17 guarded, no table removed, no pinned size reduced (I diffed the
  `fixtureTableViolation('NAME', TABLE, n)` triples at `3f6a695` vs `13680c2`;
  `ARITY_EVASIONS` 13→17, `ARITY_LEGITIMATE` 8→11, `SINK_EVASIONS` 24→27, four new tables,
  everything else unchanged). **"No fixture table shrank" — confirmed.**

## Backward Compatibility

No wire-format, proto, or exported-API change. `web/src/util/markdown.ts` is **comment-only**
— I verified at line granularity, not by eyeballing the hunks:
`git diff -U0 3f6a695..13680c2 -- web/src/util/markdown.ts` filtered to lines that are
neither `//`-prefixed nor blank returns **nothing**. `renderMarkdown`'s signature, body and
`Function.length` are untouched. **This confirms the brief's claim, by my own measurement.**

## Gates (my runs, exit code from the child process)

| gate | result |
|---|---|
| `npm test` | exit 0 — `markdown sanitizer: 79 checks passed (127 assertions)` |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `git status --porcelain` | empty, before and after every experiment |
| `git rev-parse HEAD` | `13680c2b7d7fd64841573894e5bb1224924eefdd` |
| CI | none configured — no `.github/workflows`, no `.gitlab-ci.yml`, no `.circleci`. **Confirmed.** |

---

# Every place the brief was wrong

The brief asked for this as a required deliverable. Reporting hits *and* the checks that
came back clean, because a ledger of hits only implies a 100% failure rate forever.

1. **The brief asked for an expected-clean check its own environment cannot support.**
   §5 lists "nothing was pushed, no remote ref moved" as an expected-clean outcome. In this
   workspace that is unverifiable in either direction: `origin` is a path that does not
   exist, and `origin/markdown-sanitize-r9` already equals HEAD because the workspace is a
   clone of the developer's tree. Both of the obvious readings are non-evidence. See FYI.

2. **§3's C7-p framing licensed a single-instance treatment of a two-instance class.**
   The brief presents "does not compile when planted in `markdown.ts` (tsc exit 2, TS2345)"
   as the distinguishing property of C7-p. Measured: **C7-m has the identical property.**
   The brief's own class-vs-instance rule applies to its own list. See N4.

3. **§1's relayed number is an undercount.** The brief relays "three of the five shared call
   sites had no unique coverage at all `[MEASURED-BY-dev-195-r9]`". Measured at `affa615`:
   **five of five.** The brief inherited the developer's count instead of the developer's
   method, which is the second-order failure mode the brief itself names. See N3.

4. **§4's list of correction commits is incomplete in a way that matters.** It names
   `4341965`, `1ec4a7b` and `469694a` and asks me to verify their replacement sentences.
   The false rationale `4341965` retracts was *introduced* one commit earlier, at
   `c331abf`, in a second location that `4341965` did not touch and that the brief does not
   point at. Verifying only the three named commits misses R2. (Recorded as an incompleteness
   in the brief's scoping, not as a false claim.)

## Checks where the brief was right — reported because a clean result is an outcome

Each of these is **the brief's claim, confirmed by my own measurement**, not agreement:

- Baseline at `13680c2`: `npm test` exit 0 at **79 checks / 127 assertions**, `tsc --noEmit`
  exit 0, `npm run build` exit 0, `git status --porcelain` empty. All four reproduced.
- Files changed `3f6a695..13680c2`: exactly `web/src/util/markdown.test.ts`,
  `web/src/util/markdown.ts`, and `.design/project-log/markdown-sanitize-cleanup-r9.md`.
- **`markdown.ts` is comment-only** — verified at line granularity, see Backward
  Compatibility. No finding against the brief's verification here.
- **No CI on this project** — confirmed by inspection of `.github/`, and absence of
  `.gitlab-ci.yml` / `.circleci`.
- **No fixture table shrank** — confirmed by diffing the pinned triples, see Test Coverage.
- §1's core instruction ("look for the next caller doing the callees' work, not for a repeat
  of the exact same caller") is what found R1. It was the right question.

## My own predictions, including the wrong ones

Written to `/tmp/rev/predictions.md` before measuring.

| id | predicted | measured | |
|---|---|---|---|
| M1, M2, M3 | RED | RED | ✓ |
| **M4** | **GREEN** | **RED** | ✗ — `SINK_CALL_LEGITIMATE` covers it; I had not read the table |
| M5 | RED (low confidence) | RED | ✓ |
| M6, M7 | RED | RED | ✓ |
| M8, M9 | GREEN | GREEN | ✓ |
| M10, M11 | GREEN | GREEN | ✓ |
| **M12** | **RED** | **GREEN** | ✗ — I assumed the docblock's `dynamicImportSpecifierOffenders` rationale was load-bearing for classification; it is only load-bearing for the message |

Both of my errors were in the same direction as this workstream's standing failure mode:
believing a docblock's account of what a line is for.

## Final Verdict

**REQUEST CHANGES** — on R1 and R2. R1 is the substantive one: the round's central
structural decision is undefended at five sites and one of them re-creates the masking the
round exists to remove. R2 is a one-paragraph edit but it is the third consecutive round in
which a rationale-correcting commit ships a false rationale, and the sentence in question
is the one already retracted elsewhere in the same file.

Neither is a security regression, and I want that on the record: the arity bypass is
genuinely closed, `markdown.ts` is untouched, and I could not break the fix. This is a
"finish the class fix" request, not a "start over" one. N1–N4 are non-blocking; N3 and N4
are corrections to claims in the report and project log rather than to code.

**This change should NOT be escalated to a security specialist.** The security surface is
unchanged and was probed directly this round. What it needs is five fixtures.
