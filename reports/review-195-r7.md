# #195 markdown-sanitize round 7 (`86f30bc..7b4f6dd`) — Code Review

**Reviewer leg:** review-195-r7 · **Tree:** `/workspace` (NOT the path in the brief) at `7b4f6dd`
**Range reviewed:** `git diff 86f30bc 7b4f6dd` — 3 files, `+1379/-69`
**Gates run by me, every exit code read from the child process (no pipes):**

| Gate | Exit |
|---|---|
| `npm test` (in `web/`) | **0** — `markdown sanitizer: 75 checks passed (122 assertions)` |
| `npx tsc --noEmit` | **0** |
| `npm run build` | **0** |
| `go build ./...` | **0** |
| `go test ./...` | **0** (10 packages ok) |

`web/node_modules` was absent; I ran `npm ci` (exit 0, 105 packages, 0 vulnerabilities)
before any gate. All mutation work was done in a copy at `/tmp/mut/web`. **No file in
`/workspace` was modified; `git status` is clean.**

---

## Executive Summary

Risk: **MEDIUM**. The round's mechanisms are real — I independently reproduced every
red-on-revert it claims (W1, W3, W4, T-4, T-6, T-8, audit LOW-2), and the whole
production delta is comments, so there is no behavioural change to review. The problem is
in the claims, which is this round's actual deliverable: **three statements added in this
diff are false, and one of them describes a guard hole I demonstrated is still open —
GREEN at 75 checks with `tsc` exit 0, in a real non-sink source file.**

Verdict: **REQUEST CHANGES** (3 Required, all cheap; none is a live vulnerability).

---

## Critical

**None.** Both enumerated sinks are correctly wrapped. No mutation I ran produced
unsanitized markdown reaching the DOM.

---

## Required

### R7-REQ-1 — `stripImportStatements` still swallows across `import(<non-literal>)`, and the new docblock says it does not

**Where:** `web/src/util/markdown.test.ts:1392-1396` (function) and the docblock added at
`:1375-1401`.

The W2 fix added `(?!\s*\.)` so that `import.meta` no longer starts a statement match. The
docblock added alongside it concludes:

> *"`import` has three (statement, `import(…)` expression, `import.meta` expression) and
> this function now names all three."*

It names two. The `import(…)` expression production with a **non-literal specifier** still
starts a statement match, and `[^;'"]` has no quote to stop against, so the match runs
forward to the next `from '…'` and blanks everything in between — the identical swallow W2
closed for `import.meta`.

**Measured, with attribution.** All four runs on the same tree, exit codes from the child
process:

| # | Mutation | Result |
|---|---|---|
| M2a | append to real `web/src/util/format.ts` (a **non-sink** scanned file):<br>`import { unsafeHTML } from 'lit/directives/unsafe-html.js'`<br>`const spec: string = './priority-utils.js'`<br>`const dev = import(spec)`<br>`export const rawHtml = unsafeHTML`<br>`export { html as _html } from 'lit';` | **GREEN, 75 checks / 122 assertions, `tsc --noEmit` exit 0** |
| M2b | *identical block*, `import(spec)` → `import.meta.env.DEV` | **RED** — `src/util/format.ts:29: unsafeHTML used in a non-called position` |
| M2d | *identical block* placed in `ft-inspector-desc.ts` (a **REQUIRED_SINKS** file) | **RED** — via **R6b** (`a dynamic import specifier must be a plain quoted literal`) |
| — | standalone diff of the r6 and r7 regexes over the same three inputs | `import(expr)`: alias hidden under **both**; `import.meta`: hidden under r6, visible under r7 |

Attribution is one token wide: M2a and M2b differ only in `import(spec)` vs
`import.meta.env.DEV`.

**Two things follow, and they should not be conflated.**

1. **The hole is pre-existing, and this round does not make it worse.** Per brief item 3,
   I am explicitly *not* invoking the "escape this round makes worse" trigger. r6 had the
   identical behaviour.
2. **The false completeness claim is new in this diff**, and it is the same class of
   defect the round exists to eliminate. The round-7 log states the general lesson —
   *"every token this function keys on must be checked against the OTHER grammatical
   productions"* — and then does not apply it to the production it names.

**This is precisely the W3 asymmetry, one rule over.** `R6b` already exists and already
treats a non-literal dynamic specifier as a violation — but only in the two
`REQUIRED_SINKS` files. The tree-wide half has no equivalent. W3 promoted R7 tree-wide for
exactly this reason ("the only per-file rule the shrink removed that the tree-wide half
did not already carry"); R6b is a second one, and it went unnoticed.

**Suggested fix (measured; pick one):**

- *Minimal, one character.* `(?!\s*\.)` → `(?!\s*[.(])`.
  Measured: suite stays **GREEN 75/122** on the clean tree, and M2a flips to **RED**
  (`src/util/format.ts:30: unsafeHTML used in a non-called position`). No other check
  moves. Add the M2a text to `INDIRECTION_EVASIONS` (bump the table pin 16 → 17) so it
  cannot regress.
- *Structural, consistent with W3.* Promote R6b to the tree-wide scan the way R7 was
  promoted this round.

If the owner decides "mechanism (b) is a tripwire, not proof" already covers this and no
code change is wanted, then **the docblock sentence must still be corrected** and the case
added to the log's Residue section. What is not acceptable is the sentence as written.

---

### R7-REQ-2 — `markdown.ts` asserts a `Function.length` property that is false, and contradicts an error message in the same round

**Where:** `web/src/util/markdown.ts:140-144`, repeated in
`.design/project-log/markdown-sanitize-cleanup-r7.md:43-46`.

> *"`renderMarkdown.length === 1` covers only SOURCE/ARTIFACT DIVERGENCE … **There is no
> measured arity SPELLING for which it is the falsifier**: a required second parameter is
> rejected by `tsc` before the suite runs, and **every form that survives `tsc` leaves
> `.length` at 1 by definition**."*

Measured in node:

```
(md)            -> 1      (md, ...rest)   -> 1      (md, opts = {}) -> 1
(...md)         -> 0      (md = '')       -> 0
```

`(...md: string[])` is **C7-j** and `(md: string = '')` is **C7-k** — both are in this
round's own `ARITY_EVASIONS`, both survive `tsc`, and both take `.length` to **0**. So
`.length` *is* a falsifier for two measured spellings, and "at 1 by definition" is wrong.

The file contradicts itself 500 lines away, in a message added in this same round
(`markdown.test.ts:672-677`):

> *"`(md: string = '')` … **takes Function.length to 0**, which this suite cannot tell
> apart from the source/artifact divergence that assertion exists to catch. To allow it,
> relax the `.length` assertion to `<= 1` in the same commit."*

**Why this is Required rather than a nit.** The sentence tells a future maintainer that
`renderMarkdown.length === 1` has no unique coverage against any declaration form. Acting
on that — deleting the assertion as redundant — removes one of the two detectors for C7-j
and C7-k. The round's stated thesis is that an over-broad claim is worse than a narrow
true one; this is an over-broad claim inside the text that replaced the last one.

**Suggested fix:** narrow to what is true, e.g. *"no measured arity spelling for which it
is the **only** falsifier — C7-j and C7-k take it to 0, but the declaration scan rejects
both independently."* Drop "by definition". Correct the same sentence in the r7 log entry.

---

### R7-REQ-3 — the `EXPECTED_CHECK_CALL_SITES` provenance line is wrong on both numbers and omits two of the six checks added

**Where:** `web/src/util/markdown.test.ts:3221-3225`.

```
// Moved 69 -> 73 in round 7: the tree-wide escape tripwire (R7 promoted out of
// the two sink files), the fixture for the arity pin, the shared-marked-singleton
// pin, and the DOM-clobbering pin. ...
const EXPECTED_CHECK_CALL_SITES = 74;
```

Measured (`grep -c "^ *check("`, positive control: the same grep returns 68 at the base):

- base `86f30bc`: **68** call sites, constant `= 68`
- head `7b4f6dd`: **74** call sites, constant `= 74`
- six checks added, not four. The two omitted are both in the new `dependencyPolicy()`:
  the **T-6 dompurify floor pin** and the **O3 sunset clause**.

So the line is wrong three ways: start value (68, not 69), end value (74, not 73), and the
enumeration. The convention set by the three lines above it (`54 -> 59: five check() calls
were added`) is unambiguously call-site counts, so "69" is not a different-units reading —
it is the check *total* at the base (68 + 1 from the `REQUIRED_SINKS` loop) substituted for
the call-site count.

**Note, outside my delta:** the round-6 line immediately above (`Moved 61 -> 69 in round 6`)
is inconsistent with the base constant of 68 by the same one. Round 7 chained off it. I did
not trace round 5's value to determine which of the two round-6 numbers is the wrong one —
see C-A.

**Suggested fix:** `// Moved 68 -> 74 in round 7:` and add the two `dependencyPolicy()`
checks to the list. Reconciling the round-6 line is optional and out of this delta.

---

## Nit / Optional

- **[Optional] The O3 sunset clause fires on bare `eslint`, which its own docblock and
  message say it does not.** `markdown.test.ts:1274-1276` matches
  `d === 'eslint' || d.startsWith('@typescript-eslint/') || d === 'typescript-eslint'`,
  but the docblock says *"#204 is a typescript-eslint rule, and it cannot be enforcing
  without typescript-eslint being a declared dependency."* Measured: adding
  `"eslint": "^9.0.0"` alone turns the suite **RED** with the message *"typescript-eslint
  tooling is now declared (eslint)"* — false, and it makes an ordinary lint-adoption
  commit break a security test. The log's positive control used `prettier`, which does not
  cover this. Either drop the bare `eslint` term, or reword to "eslint tooling". The
  escape-hatch sentence in the message does mitigate it.
- **[Optional] `splitTopLevelDefault` is misnamed and has a measured false positive.** It
  returns a boolean, so `hasTopLevelDefault` is the name. More substantively, measured:
  `md: (x: string) => string` returns `true` — the `>` of `=>` closes depth, then `=` reads
  as a top-level default. Fail-closed, and no realistic spelling for this function, but the
  docblock says *"True if `param` carries an `=` default"* and it does not. No
  `ARITY_LEGITIMATE` fixture covers a function-typed sole parameter.
- **[Optional] The marked-singleton check's positional invariant is the one unpinned
  invariant in the file.** `markdown.test.ts:735-737` documents *"deliberately LAST in
  `taskLists()`"* because `marked.use` has no undo, and then relies on a comment to hold
  it. Everywhere else this file refuses to accept that. Move the check into its own
  function invoked last in `run()`, so ordering is enforced by the call list rather than by
  position inside a group that keeps growing.
- **[Nit] Near-vacuous assertion.** `markdown.test.ts:263` —
  `assertContains(out, 'a', 'text content should be preserved')`. The output is
  `<a>a</a><a>b</a>…`; the letter `a` cannot be absent unless the output is empty. The
  sibling checks use distinctive tokens (`overlay`, `farmtable-admin`). Use `>a<` or a
  distinctive payload word.
- **[Nit] Typo in the delta:** `markdown.test.ts:3199` — `undeirvably` → `underivably`.
- **[Nit] Loop-invariant computed per iteration.** `markdown.test.ts:1168` —
  `const occurrences = ARITY_SOUND_SOURCE.split(ARITY_DECL).length - 1;` does not depend on
  the fixture; hoist it. Also, the `ARITY_LEGITIMATE` loop has no equivalent anchor guard,
  so a future edit to `ARITY_DECL` would silently make those six fixtures no-op
  substitutions — the exact "fixture that cannot express its input" defect class this round
  named.

---

## FYI

- **The entire production delta is comments.** `markdown.ts` is `+81/-13` and every changed
  line is a comment; `const parser`, the `FORBID_*` arrays, and `renderMarkdown` are
  byte-identical to `86f30bc`. This reframes brief item 2 — see *Where This Brief Is Wrong*.
- **`fixtureTableViolation` call sites are themselves silently droppable**, the same shape
  as the honestly-disclosed `ABL-scope-callsite` residue: delete the
  `fixtureTableViolation(...)` line from a check body and no rule fires, the check total
  does not move, and the assertion pin does not see it (these do not route through
  `assert*`). Consistent with the round's own stated residue; recording it so the list is
  complete.
- **`statSync` in `sinkBinding()` throws outside any `check()`**, aborting the suite with a
  stack trace rather than a counted failure. That is fail-closed and better than the
  alternative; noting it so nobody "tidies" it into a `check()`.
- **`stripInertText` now runs twice per scanned file** (`code` + `codeNoStrings`) across 51
  files. No measurable effect on suite runtime.
- **INFO-2's measured claim in `markdown.ts:90-106` is exactly right.** I reproduced it:
  after `DOMPurify.setConfig({FORBID_TAGS: [], FORBID_ATTR: []})`, `renderMarkdown('# hi
  <form><input></form>')` returns `<h1>hi <form><input></form></h1>` where it otherwise
  returns `<h1>hi </h1>`, and `<script>alert(1)</script>` still returns `''`. Policy
  bypass, not script execution — as stated. My R7-REQ-1 does **not** undermine the
  mitigation argument: R8/R9 run on the un-stripped `code` view, so the `import(expr)`
  swallow does not reach them.

---

## Positive Feedback

Not manufactured — these are things I tried to break and could not.

- **Every red-on-revert this round claims, I reproduced independently.** W1 (the arity
  pin fires on a real `(md, opts = {})` in `markdown.ts`, and the comment-blanked view
  works against the real 150-line docblock); W3 (scope shrink → RED naming the scope pin);
  W4 (emptying `ESCAPE_EVASIONS` → RED); T-4 (hollowing a check body + reverting `slot` →
  RED at 120/122, the exact scenario the round says was green at 69); T-6 (`^3.0.0` →
  RED); T-8 (`new Marked` → `marked.use` → RED, and **exactly one** check red, as claimed);
  audit LOW-2 (an `innerHTML` injected into `index.html` → RED).
- **T-8 is the right shape.** Poisoning the singleton, asserting the poisoning *took* as an
  inline positive control, then asserting the function is unaffected, is a genuine
  by-effect observation in a file that had been defeated repeatedly on by-name scans. The
  `assertNotContains(out, '<img')` was load-bearing: DOMPurify strips `onerror`, so the
  first assertion alone would have passed.
- **Correction 2 is precisely right and I verified it three ways.** `-S
  ALLOW_UNKNOWN_PROTOCOLS` on `markdown.ts` returns nothing across all history (positive
  control: `-S FORBID_ATTR` on the same path returns three commits); it appears only in
  `fc2b947`, in the test file; and `fc2b947`'s production diff is exactly the three changes
  the correction names.
- **W5's call-site references are exact.** `stringField` is at `grpc-client.ts:660-662`;
  `body: stringField(record.body)` at `:553`; the early return is at
  `ft-inspector-desc.ts:209` and the sink at `:233` is below it. Four line references, four
  correct — unusual.
- **The Residue and Costly-disclosure sections are the most valuable part of the log entry**
  and are what let me target this review. Reporting one's own harness scoring aborted cases
  as passes is the kind of disclosure that makes the rest of the numbers credible.

---

## Test Coverage

New production code paths: **none** (comments only). New *guard* coverage is substantial and
I verified it fires. Gaps I found:

- No fixture for the `import(<non-literal>)` swallow (R7-REQ-1). Adding it is part of that
  fix.
- No `ARITY_LEGITIMATE` fixture for a function-typed sole parameter; measured false positive.
- The assertion pin covers behavioural checks only; rule fixtures throw directly. Disclosed
  in the log's Residue, correctly.
- `fixtureTableViolation` has no positive control of its own (no `±1` fixture the way
  `sourceFileCountViolation` and `requiredSinkScopeViolation` have). Low risk — the function
  is four lines — but it is the one new rule this round added without one.

## Backward Compatibility

No wire-format change, no proto change, no Go change, no exported-API change.
`renderMarkdown`'s signature and behaviour are byte-identical to `86f30bc`.
`web/package.json` was not modified in this range. Nothing to flag.

---

## C-A — Claims I could not verify

Each with what would falsify it.

1. **The out-of-repo specs** (`/scion-volumes/.../salvage/r7-dev-195/spec-w*.json`,
   `spec-t*.json`, `spec-o23.json`, `spec-low2*.json`) — I did not read them. I re-derived
   the load-bearing results independently instead, which is stronger for the ones I
   re-derived and says nothing about the ones I did not (`ABL-r7-view`, `INVERT-1`,
   `INVERT-CTRL`, `C2-e-nonsink`, `ABL-low2-innerHTML`). *Falsifier:* run those cases.
2. **Which of round 6's two numbers is wrong** in `Moved 61 -> 69 in round 6` vs
   `EXPECTED_CHECK_CALL_SITES = 68` at `86f30bc`. Outside my delta; I did not trace it.
   *Falsifier:* `grep -c "^ *check("` at round-5 head and at round-6 head.
3. **The security rationale for the `^3.4.12` floor** — that DOMPurify releases below it
   carry mXSS bypasses of `sanitize()`. I verified the *pin* fires; I did not check the
   advisories. *Falsifier:* the GHSA list for `dompurify`.
4. **The ~2,300 unchanged lines of `markdown.test.ts`.** My R7-REQ-1 rests on "no tree-wide
   rule carries R6b's property," which I established by reading the tree-wide rule list —
   not by exhausting it. *Falsifier:* a tree-wide rule I missed that rejects a non-literal
   dynamic specifier. (Mitigated: M2a was measured GREEN end-to-end, so *no* rule caught it
   in fact. The unverified part is only my explanation of why.)
5. **R7-REQ-1 stops at "the guard is silent," not at a rendered XSS.** I demonstrated a raw
   directive exported under an alias from a non-sink file with the suite green; I did not
   carry it through to unsanitized markdown in the DOM. That is the property the guard
   claims, so it is the right stopping point — but the finding is a guard-completeness
   finding, not a demonstrated vulnerability, and should not be escalated as one.
   *Falsifier:* wire the alias into a sink file and render.
6. **Pre-existing comments outside the delta** — e.g. `slot` assignment considering only
   direct children of the shadow host; the `<dialog>` default-rendering argument. Taken on
   faith; out of scope.
7. **CI.** There is none for `npm test` per the audit and the log; I did not confirm that
   independently. Every gate number here is from my own local run.

---

## C-B — The finding I am least sure about

**R7-REQ-1's severity — specifically, whether the tree-wide half is *meant* to catch this
at all.**

The facts are not in doubt: M2a is GREEN with `tsc` clean, M2b is RED, and the difference
is one token. What I am unsure about is the **standard**. This file states plainly that
mechanism (b) is *"a tripwire, not proof"* and that *"extending (b) with more patterns is
not a route to (a)"*. Read strictly, an uncaught indirection form in a non-sink file is
in-spec, and the correct remedy is documentation only — fix the "names all three" sentence
and add the case to Residue — with the regex change deferred to #204 alongside the other
tokenizer work.

My reasons for asking for the code change anyway are inferences about intent, not
measurements: (a) R6b exists per-file, so the project already treats a non-literal dynamic
specifier as a violation rather than as acceptable tripwire slack; (b) W3 in this very round
promoted R7 tree-wide on the argument that a per-file-only rule is a scope-shrink hazard, and
R6b is a second instance of that argument; (c) the fix is one character and I measured it as
green with no collateral.

**What a second pair of eyes should check:** whether R6b's per-file-only scope is a
deliberate scoping decision (in which case documentation-only is right) or an oversight of
the same kind W3 fixed (in which case promote it). The owner of the #204 boundary should
make this call, not me. My Required label attaches unconditionally only to the **false
sentence**; the code change is my recommendation, and I would accept documentation-only
with the case recorded in Residue.

---

## Where This Brief Is Wrong

Four things. One matters.

1. **Tree path — wrong.** `/workspace/farmtable-195-r7-review` does not exist in this
   container; the tree is `/workspace` itself. Caught before doing any work; the EM sent a
   mid-review correction confirming it. No impact.

2. **Ancestry claim — CORRECT, and I verified it rather than taking it.**
   `git merge-base --is-ancestor 86f30bc 7b4f6dd` → exit 0.
   `git merge-base --is-ancestor 89306d0 7b4f6dd` → exit 1.
   `git merge-base 89306d0 7b4f6dd` → `86f30bc`. `89306d0` is the r6 code-review leg's log
   commit. The brief was right; noting the verification because the brief asked for it.

3. **The `[MEASURED]` line counts are mislabelled.** `git diff --numstat 86f30bc 7b4f6dd`:
   `markdown.ts +81/-13`, `markdown.test.ts +1004/-56`, project log `+294/-0`. The brief's
   "+94" and "+1060" are *total changed lines*, presented as insertions. Trivial in effect,
   but it is tagged `[MEASURED]`.

4. **Item 2's framing is wrong, and this is the one that matters.** The brief says
   *"`markdown.ts` gained ~94 lines … the interesting question is whether the **production
   changes** are adequately motivated by the tests, or whether tests were written to fit the
   code."*

   **There are no production changes.** All 94 changed lines in `markdown.ts` are comments;
   the executable body is byte-identical to `86f30bc`. A reviewer who took item 2 at face
   value would spend the round looking for a behavioural change that does not exist, and
   would treat the comment block as background rather than as the artifact.

   The correct question is the inverse: **are the comments true?** Two of my three Required
   findings are in text this brief implicitly framed as commentary — R7-REQ-2 is a false
   `Function.length` claim in `markdown.ts`, and R7-REQ-1 is a false completeness claim in
   `markdown.test.ts`. Both sit in the part of the diff item 2 pointed away from.

5. **A note on item 3, so it is not over-read.** I found a concrete escape in the
   regex-based guard, but I measured it as **NOT made worse by this round** — r6's regex
   hides the same alias. Item 3's trigger ("an escape this round makes worse") is therefore
   **not** met, and I am not invoking it. R7-REQ-1 is filed on the false claim, not on the
   hole. The AST-rule follow-up (#204) and the allow-list inversion (M1) were correctly left
   out of scope and I am not requesting either.

---

## Final Verdict

**REQUEST CHANGES**

Three Required findings, all documentation-or-one-character, none a live vulnerability:

| ID | Summary | Minimum acceptable resolution |
|---|---|---|
| R7-REQ-1 | `import(<non-literal>)` swallow still open; docblock claims all three `import` productions are handled | Correct the sentence **and** either apply `(?!\s*[.(])` + an `INDIRECTION_EVASIONS` fixture, or record the case in Residue as a deliberate tripwire limit |
| R7-REQ-2 | `markdown.ts` claims `.length` stays at 1 for every `tsc`-clean form; C7-j and C7-k give 0 | Narrow the sentence in `markdown.ts` and in the r7 log entry |
| R7-REQ-3 | `Moved 69 -> 73` annotates a constant of 74 and lists 4 of 6 added checks | `68 -> 74`, add the two `dependencyPolicy()` checks |

The mechanisms this round built are sound and I verified them individually. The round's
declared product, though, is *claims that can be trusted*, and three of them cannot be. Fix
those and this is a clear approve.
