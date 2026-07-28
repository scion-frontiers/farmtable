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

---

# Addendum — R8/R9: the sanitizer's exclusive ownership of its own configuration

**Appended after EM review of `0c60d15`. Head is now `716bb8f`.** Still
test-file-only, still zero production code. Gate: `npm ci && npm test` → exit 0,
**61 checks passed**; `tsc --noEmit` = 0; `npm run build` = 0.

The EM accepted round 4, verified the gate independently at `0c60d15`, re-killed
the three vectors originally measured at `bae4fd0` — and then hunted a fifth
against the shipped implementation and found a survivor.

## V23: a new axis

```ts
// ft-inspector-comments.ts, alongside the COMPLETELY UNTOUCHED real sink
import { renderMarkdown } from '../../util/markdown.js';
import DOMPurify from 'dompurify';
DOMPurify.addHook('uponSanitizeElement',   (_n, d) => { d.allowedTags[d.tagName] = true; });
DOMPurify.addHook('uponSanitizeAttribute', (_n, d) => { d.forceKeepAttr = true; });
```

`59 checks passed`, exit 0. Every one of R1–R7 satisfied: `renderMarkdown`
imported unaliased from the one permitted module, appearing nowhere but
immediately called, the sole argument to `unsafeHTML`. Nothing about the
*binding* is wrong. Measured runtime effect:

```
payload:      <img src=x onerror="alert(1)"><script>alert(2)</script>
BEFORE HOOKS: "<p><img src=\"x\"></p><p></p>\n"
AFTER  HOOKS: "<p><img src=\"x\" onerror=\"alert(1)\"><script>alert(2)</script></p><p></p>\n"
```

It is a module-level side effect in a component the app imports, so it runs on
load. The behavioural checks never see it: they import `util/markdown.js`
directly and never load the component.

**Why this is an axis and not a seventh spelling.** R1–R7 are all rules about
identifiers and call shape. V23 touches neither. It corrupts the shared mutable
configuration of the sanitizer that the binding correctly points at. The guard
proves the sink *calls* the sanitizer; it does not prove the sanitizer still
*sanitizes*. Same defect class as everything else on this issue, in a new dress:
**a check derived from the thing it is checking cannot falsify it.** The guard
reads the call graph, and the call graph is exactly what the attack leaves
intact.

The codebase already understood the sibling hazard — `util/markdown.ts` says "A
private `Marked` instance keeps this off the shared `marked` singleton" — and
simply had no equivalent for DOMPurify, whose default export *is* the singleton.

## R8 and R9

| | rule |
|---|---|
| R8 | across the scanned set, `dompurify` and `marked` may be imported by exactly one file, `src/util/markdown.ts` |
| R9 | no scanned file may import from outside the scanned set |

R8 matches on the **specifier**, not on import syntax, so static, side-effect,
namespace, re-export, `require` and dynamic forms — including the
template-literal specifier that defeated R6's first draft — are one rule rather
than six, and subpaths count (`dompurify/dist/purify.es.mjs` is the same
singleton). It is deliberately **not** written as a ban on `addHook`:
`setConfig`, `removeHook`, `removeAllHooks` and direct property assignment are
equivalent spellings. A file that cannot name the module cannot reach its
configuration by any method name, present or future. Read from a view with no
`raw-sink-scan: ignore-line` opt-out.

R9 came from hunting R8 (my V24b). R8 matches the specifier, so an unscanned
file is a laundering point for it: `export { default as P } from 'dompurify'` in
a `*.test.ts` file, imported by any scanned component, reaches the singleton
without any scanned file naming either dependency. Round 4 had already written
the correct sentence — *an unscanned file is only safe while nothing scanned
imports it* — and then scoped it to the two `REQUIRED_SINKS` files, which is
exactly the gap V24b routed through. **The statement was right and the scope was
wrong.** R8 is not sound without R9.

Inert assets are accepted without resolving: a `.css` or `.json` cannot hold
code, which is the same argument that keeps them out of the scan. The tree has
exactly two, both pinned as false-positive fixture cases.

`EXPECTED_CHECKS` 59 → 61: one tree-wide check plus one `fixture:` check. The
fixture is not optional — exactly one file imports each dependency today, so R8
is satisfied *vacuously* by the tree, and without a table the rule would pass
without ever being exercised. That is the same defect as the old static-HTML
control this branch already removed once. R9 is folded into both, because R8's
specifier matching is not a meaningful property without it.

## V25 — the axis has a sibling, and it is not closable this way

The EM asked for one more hunt on the new axis and said plainly that he did not
know whether V23 had siblings. It does.

```ts
// ft-inspector-comments.ts — NO import of dompurify or marked, nothing for R8 to match
const origRemoveAttribute = Element.prototype.removeAttribute;
Element.prototype.removeAttribute = function (name: string): void {
  if (String(name).startsWith('on')) return;
  origRemoveAttribute.call(this, name);
};
const origRemoveChild = Node.prototype.removeChild;
Node.prototype.removeChild = function <T extends Node>(child: T): T {
  if (child && child.nodeName === 'SCRIPT') return child;
  return origRemoveChild.call(this, child) as T;
};
```

`61 checks passed`, exit 0. Verified at runtime against the compiled
`.tmp-test/util/markdown.js` under the same jsdom bootstrap the suite uses:

```
before: "<p><img src=\"x\"></p>\n"
after : "<p><img src=\"x\" onerror=\"alert(1)\"><script>alert(2)</script></p>\n"
```

DOMPurify strips attributes with `removeAttribute` and nodes with
`removeChild`. Neutralise those two on the global prototypes and the sanitizer
runs to completion and returns the payload intact.

**This survives deliberately, and the reason is recorded here rather than
patched over.** Three closures were considered:

1. *Ban `.prototype` assignment in the scanned set.* This is a spelling, and the
   equivalents are unbounded: `Object.defineProperty`, `Object.assign`,
   `Reflect.defineProperty`, `Object.setPrototypeOf`, `__proto__`, plus
   non-prototype globals like `document.implementation.createHTMLDocument`. It is
   the exact treadmill this whole round exists to get off, and it would give a
   false impression of coverage.
2. *A runtime canary — import the two sink modules, then re-assert the sanitizer
   on a payload.* This is the right shape: it observes the **effect**, so it
   kills V23, V25 and every unforeseen sibling regardless of spelling. It needs
   `tsconfig.test.json` widened to compile the components, which is shared build
   infrastructure and is in substance the deferred Phase-2 harness. Not taken
   without an explicit assignment.
3. *Freeze the globals in `markdown.ts`.* Production code. Out of scope by the
   standing constraint.

So the honest statement is: **the exit criterion — "no mutation of the two
`REQUIRED_SINKS` files can leave them rendering unsanitized while the suite is
green" — is met for every binding-shaped and specifier-shaped mutation, and is
NOT met for global-state mutation, which no static scan of these files can
reach.** V23 was closable because the attack had to *name* something. V25 does
not name anything the guard could own.

## Mutation results for the addendum

54 vectors: **47 dead, 6 false-positive controls correctly green, 1 deliberate
survivor (V25, above).** V23 → DEAD. V24 (laundering via a sink file) → DEAD via
R6. V24b (laundering via a non-sink scanned component) → DEAD via R9.

The `cp`-backup restore checker fired once more, correctly: V24b was the first
vector to touch `inspector-shared-styles.ts`, which was not in the backup set,
and the run aborted with `DIRTY AFTER RESTORE` rather than continuing against a
polluted tree.

## Residue after the addendum

Everything stated in round 4 still stands, plus:

- **Global mutable state reachable from a scanned file** — V25's class. DOM
  prototypes, `Object.prototype`, and the built-ins DOMPurify uses internally.
  Only an effect-observing check closes this.
- R9 makes the scanned set closed under relative imports, but non-relative
  specifiers are still unresolved (no `tsconfig` `paths`, no package `imports`
  field today).
