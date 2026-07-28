# #195 markdown-sanitize — round 4 cleanup (make the closed world sound; relabel the open world)

**Branch:** `markdown-sanitize` · **Base:** `bae4fd0` · **Head:** `ca1a26e`
**Scope:** test-file-only. `web/src/util/markdown.test.ts` is the *only* file
changed on this round — 954 insertions, 87 deletions, zero production code.
**Gate:** `npm ci && npm test` → exit 0, `59 checks passed`. Also `tsc --noEmit`
exit 0 and `npm run build` exit 0.

**No live vulnerability existed at any point.** Both real sinks were correctly
wrapped before this round and still are. Everything here is regression
detection.

## Why this round existed

Both round-3 review legs returned REQUEST CHANGES, and — for the third round
running — **neither reviewer's proposed fix worked alone**. The EM measured the
2×2: the audit fix killed the `renderMarkdown` identity shadow but not the
`unsafeHTML` value alias; the test-leg fix did the reverse. Only the union
killed both.

That pattern is the actual finding of this round. Rounds 1–3 each banned the
*named spelling* of the previous round's bypass and were evaded by the next
spelling a week later:

| round | bypass | response |
|---|---|---|
| 1 | `unsafeHTML(c.body)` | banned the literal call shape |
| 2 | `import { unsafeHTML as raw }` | banned `as`-aliasing |
| 3 | `const raw = unsafeHTML` | (value alias — no `as` at all) |
| 3 | `const renderMarkdown = s => s` | (identity shadow) |

A list of forms cannot terminate. So this round split the guard in two and
treated the halves differently.

## The split

**Closed world** — the two files in `REQUIRED_SINKS`. Enumerated, so soundness
is achievable. Effort went here, and the fixes are stated as **rules about
permitted usage**, not as more banned spellings.

**Open world** — the tree-wide scan. Never complete, and now **relabelled as a
tripwire rather than a proof**, in the docblock and in every failure message
(`[tripwire: catches the listed indirection forms only, not all of them]`).
Calling it a proof was the thing that let three reviewers cite it as evidence.

## The closed-world rules

`sinkBindingViolations()` holds each `REQUIRED_SINKS` file to seven rules:

| | rule |
|---|---|
| R1 | the sanitized sink text `unsafeHTML(renderMarkdown(` is present |
| R2 | each identifier is imported **unaliased** from the one module allowed to provide it, by a value import (not `import type`) |
| R3 | neither identifier is re-bound by a local `const`/`let`/`var`/`function`/`class` |
| R4 | outside its import statement, neither identifier may appear in **any** position other than immediately called — `name(` |
| R5 | every `unsafeHTML(…)` argument **is** a `renderMarkdown(…)` call and nothing else |
| R6 | every relative import specifier resolves to a file this guard scans; every dynamic import specifier is a plain quoted literal |
| R7 | no unicode/hex escape appears in code — identifiers must be spelled literally |

R4 is the rule that generalises and is why this should not be round 5's problem.
`const raw = unsafeHTML`, `const S = { raw: unsafeHTML }`, `const { unsafeHTML:
raw } = await import(…)`, `unsafeHTML as unknown as F`, `export { unsafeHTML }`,
and a **parameter** named `renderMarkdown` shadowing the import are all the same
violation of R4 — and not one of them had to be foreseen to be caught. R3 is
strictly redundant against R4 and is kept only because it names the mistake in
the failure message.

R6 is the one worth remembering. R1–R5 all assume something they cannot
establish: that a name reaching the DOM came from a file we looked at. The
`*.test.ts` exclusion is load-bearing (this file must be able to name banned
spellings in prose), so it cannot be removed — R6 instead denies the excluded
region any path *into* the closed world. **An unscanned file is only safe while
nothing scanned imports it.**

## What changed

| Item | Commit | Change |
|---|---|---|
| B1 B2 B3 B4 B5 I6 I7 I8 | `615a355` | R1–R4; extension predicate inverted to a denylist; comment/string stripping + `// raw-sink-scan: ignore-line` opt-out; `EXPECTED_SOURCE_FILES` message rewritten to name the decision; tripwire relabelling; fixture tables replacing the vacuous static-HTML control; `[^;\n]` in the re-export pattern |
| R5 | `93bcd60` | Balanced-paren argument extraction; the `unsafeHTML` argument must *be* the sanitizer call, not merely start with it |
| scanner | `723cc95` | `stripInertText` made regex-literal aware |
| R6 R7 | `c087d7b` | Relative imports must resolve into the scanned set; no escapes in code |
| R6b | `ca1a26e` | Dynamic import specifiers must be plain quoted literals; R7 moved to a view that keeps import statements |

`EXPECTED_CHECKS` went 54 → 59; the arithmetic was re-derived from the literal
call sites rather than adjusted to fit (58 literal `check(` call sites, 62 total
occurrences of the token, 58 − 1 inside the `REQUIRED_SINKS` loop + 2 loop
iterations = 59).

## Mutation results

50 vectors: **44 dead, 6 false-positive controls correctly green, 0 survivors.**
Every mutation was content-addressed (aborting unless the anchor occurred
exactly once), restored from `cp` backups outside the repo, with
`git status --porcelain` asserted empty after each restore.

Six vectors **survived at 59/59 green** and were found by attacking my own
implementation after it had already passed everything the two reviewers asked
for. They are the useful part of this log:

| | mutation | why it survived |
|---|---|---|
| V10 | `unsafeHTML(renderMarkdown(c.body) + c.body)` | R1 tested whether the sanitizer call was a **prefix** of the argument, not whether it **was** the argument. A regex cannot distinguish `f(g(x))` from `f(g(x) + x)` — they share every prefix. |
| V11 | `unsafeHTML(renderMarkdown('') \|\| this.description)` | same defect, short-circuit form |
| V13 | `const proto = /^https:\/\//.source; const rawHtml = unsafeHTML;` | the scanner read the `//` inside a regex literal as a line comment and blanked the rest of the line, alias included |
| V16 | `const rawHtml = \u0075nsafeHTML;` | TypeScript resolves the escape to the imported binding; `\bunsafeHTML\b` does not |
| V17 | `export { unsafeHTML as rawHtml }` in `helper.test.ts`, imported by the sink | excluded by `isScannableSource`, and therefore uncounted by `EXPECTED_SOURCE_FILES` too — no signal of any kind |
| V18/V19 | template-literal dynamic import; escape hidden inside a second import statement | R6/R7's own first drafts |

Each is now pinned as a fixture case in the in-suite `SINK_EVASIONS` table, so
the mutation harness is not the only thing that remembers them.

### One reasoning error worth recording

The first version of the scanner did not track regex literals, and my own
docblock rationalised that as failing "toward blanking real code, i.e. toward a
missed detection rather than a false positive." That reasoning was wrong and
mutation testing proved it within the hour: **a missed detection was exactly the
attacker's goal, and blanking real code was the exploit.** "Fails safe" is not a
property you can assert about a security guard from the direction of its error;
it depends on who benefits.

## Deliberately not done

Capped by the brief, and still open:

- **Audit MEDIUM-2, the raw-write treadmill.** Only a one-line operator-class
  widening was taken (`.innerHTML +=`, `||=`, `&&=`, `??=`, and the
  `['innerHTML']` indexed form, with `(?!=)` so `===` does not trip). Chasing
  every raw-write spelling is the treadmill this round exists to get off.
- **CSP.** Untouched.
- **The component-rendering harness** (Phase 2) — the only thing that would test
  the sinks' *behaviour* rather than their *text*.
- **typescript-eslint / Trusted Types.** This is the real answer: a rule with a
  binding resolver does natively what R2–R7 approximate with regexes over
  derived views. The EM is filing it separately.

## Known residue in what shipped

Stated plainly because "not scanned" is indistinguishable from "clean" in the
results:

- `(0, eval)('unsafeHTML')`, `globalThis[k]`, `new Function(…)` — invisible to
  every rule here. Nothing short of a resolver catches these.
- Non-relative specifiers are not resolved. There are no `tsconfig` `paths` and
  no package `imports` field today, so a bare specifier is a `node_modules`
  package; if either is ever added, R6 has a hole.
- Template literals are deliberately not stripped (the sinks live inside `html`
  templates), so a rule cannot rely on their contents being inert.
- The tree-wide half remains a tripwire and is labelled as one.
