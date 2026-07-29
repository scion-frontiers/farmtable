# Security Audit — #195 `markdown-sanitize`, round 3

**SHA reviewed:** `bae4fd0` (verified in `/workspace/farmtable-audit-195`; `git status --porcelain` empty before and after every mutation)
**Range weighted:** `5daace4..bae4fd0`
**Gate run:** `npm ci && npm test` → `markdown sanitizer: 54 checks passed`, `EXIT=0`
**jsdom actually run against: `26.1.0`** — measured in my clone with `require('jsdom/package.json').version`, and cross-checked against `package-lock.json` (`node_modules/jsdom 26.1.0`). **No drift in this clone.** I measured only my own clone; I make no claim about any other clone this round (that was the round-2 LOW-3 error and I am not repeating it).

## Verdict: **REQUEST CHANGES**

One High finding. It is the *same class of defect, in the same guard, at the same named sink* that the EM upheld a REQUEST CHANGES for in round 2 — the per-file check asserts a textual property that does not entail the semantic property written in its own docstring. I demonstrate it with three mutations that render attacker-controlled comment bodies completely raw at the real production sink while the suite reports `54 checks passed`, exit 0, with no new file and the sink count preserved.

### Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 2 |
| Info | 2 |

**No live vulnerability exists at `bae4fd0`.** Both real sinks are correctly wrapped. Every finding below is a regression-detection defect or a false-positive risk in the guard, not an exploitable bug in shipped code.

---

## Item 3 first, as instructed: production code

**Confirmed clean. Not Critical.**

```
$ git diff --name-status 5daace4..bae4fd0
A       .design/project-log/markdown-sanitize-cleanup-r3.md
M       web/src/util/markdown.test.ts
```

Two files, 338 insertions, 25 deletions. Zero production code. I reproduce the EM's finding exactly.

---

# Findings

## [HIGH-1] The per-file guard never binds `renderMarkdown` to the sanitizer module — an identity shadow passes at 54/54

- **Location:** `web/src/util/markdown.test.ts:671-681` (the `REQUIRED_SINKS` per-file check), docstring at `:545-555`
- **Status: BY EXECUTION** (three independent mutations)

### Description

The per-file check — the half of G1 that round 3 was written to add — asserts exactly two things:

```ts
if (!/unsafeHTML\(\s*renderMarkdown\(/.test(src)) { ... }
if (!/import \{ unsafeHTML \} from/.test(src)) { ... }
```

It binds **`unsafeHTML`** to an import. It never binds **`renderMarkdown`** to anything. The check's own name is `` `${rel} routes its markdown through renderMarkdown` `` and its docstring says these files "still route through `renderMarkdown`" — but the assertion cannot distinguish *the sanitizer* `renderMarkdown` from *any binding in scope named* `renderMarkdown`. Round 2's ruling was that a guard asserting a property weaker than its written specification is an unmet deliverable regardless of impact. That reasoning applies here unchanged.

### Impact

Any refactor — accidental or malicious — that introduces a local binding named `renderMarkdown` disables the sanitizer at the sink while leaving every check in the suite green. The guard actively provides *false assurance*: it is cited by name in reviews as proof the sinks are bound.

### Proof of concept — production wiring, not reconstruction

The sink is live. `src/index.ts:48` imports the component; `src/components/inspector/ft-inspector.ts:211` mounts `<ft-inspector-comments>`; `ft-inspector-comments.ts:128` populates `this.comments` from `client.listComments(this.taskId)` (gRPC); `Comment.body` is `string` (`src/gen/types.ts:289`) and is mirrored verbatim from third-party sources. Line 221 is `${unsafeHTML(renderMarkdown(c.body))}`. No reassembly — this is the shipped path.

**M-1 — identity shadow, sanitizer import retained under an alias** (content-addressed edit to `ft-inspector-comments.ts`):

```ts
import { renderMarkdown as _rmUnused } from '../../util/markdown.js';
const renderMarkdown = (s: string): string => s;
```

Sink text left byte-identical. Result:

```
markdown sanitizer: 54 checks passed
EXIT=0
```

**M-1b — sanitizer import removed entirely:**

```ts
-import { renderMarkdown } from '../../util/markdown.js';
+const renderMarkdown = (s: string): string => s;
```
```
    3:import { unsafeHTML } from 'lit/directives/unsafe-html.js';
    7:const renderMarkdown = (s: string): string => s;
  221:                        ${unsafeHTML(renderMarkdown(c.body))}
markdown sanitizer: 54 checks passed
EXIT=0
```

**M-1c — the realistic form: a "helper moved" refactor.** `renderMarkdown` re-homed onto the existing `src/util/format.ts` (no new file, file count untouched), and the component's two imports merged into one:

```ts
// src/util/format.ts
export const renderMarkdown = (s: string): string => s;
// ft-inspector-comments.ts
import { renderMarkdown, formatTimestamp } from '../../util/format.js';
```
```
markdown sanitizer: 54 checks passed
EXIT=0
```

All three: comment bodies rendered fully raw, `unsafeHTML` call-site count preserved at 2, `EXPECTED_SOURCE_FILES` untouched, no new file. This is precisely the M-G1-10 shape the EM judged strictly stronger in round 2.

Note this is *not* caught by `tsc` either: `tsconfig.test.json` sets `"include": ["src/utils/task-ready.test.ts", "src/util/markdown.test.ts"]`, so component sources are never type-checked by the `npm test` gate.

### Recommendation

Bind the identifier, and forbid shadowing, in the same per-file loop:

```ts
for (const rel of REQUIRED_SINKS) {
  check(`${rel} routes its markdown through renderMarkdown`, () => {
    const src = readFileSync(join(root, rel), 'utf8');
    if (!/unsafeHTML\(\s*renderMarkdown\(/.test(src)) {
      throw new Error(`${rel} no longer contains unsafeHTML(renderMarkdown(`);
    }
    if (!/import \{ unsafeHTML \} from/.test(src)) {
      throw new Error(`${rel} aliases or re-exports its unsafeHTML import`);
    }
    // NEW: bind renderMarkdown to the sanitizer module, not merely to a name.
    if (!/import \{[^}]*\brenderMarkdown\b[^}]*\} from ['"][^'"]*util\/markdown\.js['"]/.test(src)) {
      throw new Error(`${rel} does not import renderMarkdown from util/markdown.js`);
    }
    // NEW: a local binding of that name shadows the import and silently unwraps the sink.
    if (/\b(?:const|let|var|function|class)\s+renderMarkdown\b/.test(src)) {
      throw new Error(`${rel} shadows renderMarkdown with a local definition`);
    }
  });
}
```

Add tree-wide, alongside the existing indirection ban, a check that no file other than `src/util/markdown.ts` **exports** a binding named `renderMarkdown` — that is what closes M-1c:

```ts
if (rel !== 'src/util/markdown.ts' && /export\s+(?:const|let|var|function|\{[^}]*)\s*\brenderMarkdown\b/.test(src)) {
  offenders.push(`${rel}: exports a second binding named renderMarkdown`);
}
```

---

## [MEDIUM-1] Assignment aliasing defeats every name-based scan; only `as`-aliasing is banned

- **Location:** `web/src/util/markdown.test.ts:709-730` (`no file aliases, namespaces or re-exports a raw-HTML directive`), regex at `:716`
- **Status: BY EXECUTION**

`new RegExp(`\\b${name}\\s+as\\s+`)` only recognises **import-clause** renaming. Aliasing by assignment is invisible, and the docstring at `:704-708` claims the ban is "what makes those name-based scans meaningful".

**M-2** (`ft-inspector-desc.ts`, real sink left intact):

```ts
import { renderMarkdown } from '../../util/markdown.js';
const raw = unsafeHTML;
...
${unsafeHTML(renderMarkdown(this.description))}${raw(this.description)}
```
```
markdown sanitizer: 54 checks passed
EXIT=0
```

`const raw = unsafeHTML;` has no `(`, so the sink count stays at 2; `raw(` matches nothing in `BANNED_SINKS`. The same applies to destructuring rename, including from `await import(...)`, which renames via `:` rather than `as`.

**Recommendation** — add to the offender loop:

```ts
if (new RegExp(`(?:const|let|var)\\s+\\w+\\s*=\\s*${name}\\s*[;,\\n]`).test(src)) {
  offenders.push(`${rel}: ${name} aliased by assignment`);
}
if (new RegExp(`\\b${name}\\s*:\\s*\\w+`).test(src)) {
  offenders.push(`${rel}: ${name} renamed by destructuring`);
}
```

---

## [MEDIUM-2] `BANNED_SINKS` matches only literal `.innerHTML =`; three ordinary write forms pass

- **Location:** `web/src/util/markdown.test.ts:643-652`, patterns at `:644-645`
- **Status: BY EXECUTION**

All three below were added to `ft-inspector-desc.ts` and all three returned `54 checks passed`, `EXIT=0`:

| Mut | Payload | Why it slips `/\.(inner\|outer)HTML\s*\+?=/` |
|---|---|---|
| **M-3** | `Object.assign(el, { innerHTML: body });` | object-literal key, no `.` and no `=` |
| **M-4** | `const p = 'inner' + 'HTML'; (el as any)[p] = body;` | computed key is not a quoted literal, so the indexed pattern misses too |
| **M-5** | `el.innerHTML \|\|= body;` | `\s*\+?=` admits `+=` but not `\|\|=` / `??=` / `&&=` |

**Recommendation** — widen the operator class and add the object-literal form:

```ts
{ name: 'innerHTML/outerHTML assignment',
  pattern: /\.(inner|outer)HTML\s*(?:\+|\|\||&&|\?\?)?=[^=]/ },
{ name: 'innerHTML/outerHTML in an object literal',
  pattern: /\b(inner|outer)HTML\s*:/ },
{ name: 'computed element property write',
  pattern: /\)\s*\[\s*\w+\s*\]\s*=|\bel\w*\s*\[\s*[a-z]\w*\s*\]\s*=/i },
```

I flag deliberately that this recommendation is itself an instance of the treadmill described in the threat-model section below. Apply it, but do not read it as closure.

---

## [MEDIUM-3] `.jsx` is missing from `SCANNED_EXTENSIONS`, and unlike `.ts` it is invisible to the file-count pin too

- **Location:** `web/src/util/markdown.test.ts:590` (`SCANNED_EXTENSIONS`), rationale comment at `:586-589`
- **Status: BY EXECUTION** (survival); **REASONED** (that Vite would bundle it)

The comment states the list is "kept deliberately wider than what the tree contains today (all `.ts`)" so that the project's first `.tsx` or hand-written `.js` file is covered. `.tsx` is listed; **`.jsx` is not.**

**M-6** — `src/components/inspector/ft-evil.jsx` containing `el.innerHTML = body`:

```
markdown sanitizer: 54 checks passed
EXIT=0
```

This is worse than a plain list gap. A `.jsx` file is excluded from `files`, so it does **not** increment the count and `EXPECTED_SOURCE_FILES` does not fire either. Contrast the `.ts` control:

**M-8 (control)** — the identical file as `ft-evil.ts`:
```
Error: 2 of 54 markdown sanitizer checks failed:
  - sink scan actually reads the source tree: expected to scan exactly 50 source files, found 51 — update EXPECTED_SOURCE_FILES deliberately if a source file was added or removed
  - no raw-HTML sink other than unsafeHTML exists: raw-HTML sink outside renderMarkdown in: src/components/inspector/ft-evil.ts (innerHTML/outerHTML assignment)
EXIT=1
```

Caught twice over for `.ts`, not at all for `.jsx`. I did **not** execute a `vite build` to confirm a `.jsx` file reaches `dist`; I reason it would, since Vite/esbuild handles `.jsx` natively. The intent mismatch stands regardless of that.

**Recommendation:** `const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];`

---

## [MEDIUM-4] The indirection guard cries wolf: it fires on prose, on type assertions, and on legitimate re-exports of safe symbols

- **Location:** `web/src/util/markdown.test.ts:716` and `:722`
- **Status: BY EXECUTION**

This is the finding most likely to get the guard deleted rather than fixed. The regexes are not anchored to import/export syntax, and the re-export regex inspects only the **module path**, never *what* is re-exported.

**FP-1 (the required control) — GREEN, as demanded.** `import { html as staticHtml } from 'lit/static-html.js';` added to `ft-inspector-desc.ts` → `54 checks passed`, `EXIT=0`. ✅

But note: **this control is not encoded as a test anywhere.** No file in the tree imports `static-html.js` (`grep -rn "static-html" src/` returns only the three `markdown.test.ts` definition lines). It passes vacuously. It is a claim about the regex, not a pinned behaviour.

**FP-2 — a security comment fails the build:**

```ts
// Never reach for unsafeHTML as a shortcut; always route through renderMarkdown.
```
```
Error: 1 of 54 markdown sanitizer checks failed:
  - no file aliases, namespaces or re-exports a raw-HTML directive: raw-HTML directive obscured by indirection: src/components/inspector/ft-inspector-desc.ts: unsafeHTML renamed with 'as'
EXIT=1
```

Exactly the comment a security-conscious developer writes in response to this very work — and it turns the gate red. The irony is load-bearing: **the guard's own explanatory comment at `markdown.test.ts:538` contains the literal string `` `unsafeHTML as ` ``**, and escapes only because `isScannableSource` excludes `*.test.ts`. Move that sentence into any production file and the suite fails.

**FP-3 — legitimate barrel re-export of the *safe* symbol:**

```ts
export { html as staticHtml } from 'lit/static-html.js';
```
```
  - ...: static-html.js re-exported
EXIT=1
```

`html` is not a raw sink. The regex flagged it purely on the module path.

**FP-4 — an ordinary TypeScript type assertion:**

```ts
const d = unsafeHTML as unknown as (s: string) => unknown;
```
```
  - ...: unsafeHTML renamed with 'as'
EXIT=1
```

**Recommendation** — anchor to the import/export clause, and inspect clause contents rather than the module path:

```ts
// alias: only inside an import/export brace clause
if (new RegExp(`(?:import|export)\\s*(?:type\\s+)?\\{[^}]*\\b${name}\\s+as\\s+`).test(src)) {
  offenders.push(`${rel}: ${name} renamed with 'as'`);
}
// re-export: flag only when the banned NAME crosses the boundary
const reexport = new RegExp(`export\\s*(\\*|\\{[^}]*\\})\\s*from\\s*['"][^'"]*${mod}['"]`);
const m = reexport.exec(src);
if (m && (m[1] === '*' || new RegExp(`\\b${name}\\b`).test(m[1]))) {
  offenders.push(`${rel}: ${module} re-exports ${name}`);
}
```

(`export *` must still be flagged — it re-exports the banned name implicitly.)

---

## [LOW-1] `*.test.ts` under `src/` is neither scanned nor counted

- **Location:** `web/src/util/markdown.test.ts:592-595` (`isScannableSource`)
- **Status: BY EXECUTION**

**M-7** — `src/components/inspector/ft-evil.test.ts` with `el.innerHTML = body` → `54 checks passed`, `EXIT=0`, and the file count stays at 50.

Low because test files are not bundled into the production build, so there is no shipped-code impact. Worth recording because it is the mechanism by which the guard file exempts itself from its own rules (see FP-2), and because "not scanned" is indistinguishable from "clean" — the exact failure mode the comment at `:586-589` was written to prevent.

**Recommendation:** accept, but say so explicitly in the comment: note that the exclusion is what allows this file to discuss the banned identifiers in prose.

---

## [LOW-2] `EXPECTED_SOURCE_FILES` is the pin most exposed to reflexive bumping

- **Location:** `web/src/util/markdown.test.ts:568`, message at `:661-665`
- **Status: REASONED** (the pin's mechanics are executed; the human-behaviour claim is judgement)

Answering the brief's question 2 directly: **the exact pins are an improvement, not a rubber stamp — but unevenly.**

The **sink-count** pin (`:695-702`) is well designed: it compares against `REQUIRED_SINKS.length` rather than a magic number, so it fires only on changes to the very thing it guards, and its message names the decision. Keep as is.

The **file-count** pin is different in kind. It fires on *every* file added anywhere under `src/`, almost all of which is unrelated to raw-HTML sinks. On a dashboard under active development that is frequent, and a pin that mostly fires for unrelated reasons is the one that gets bumped without thought. Its message says "update deliberately if a source file was added or removed" — which describes *when* to update, not *what to verify* before updating.

I am **not** recommending removal: M-8 shows it is one of only two things catching a new-file sink, and it is the *only* thing catching a new file whose sink is an aliased `unsafeHTML`. Keep it. Improve the message so it names the actual decision:

```ts
`expected to scan exactly ${EXPECTED_SOURCE_FILES} source files, found ${files.length} — ` +
  'before bumping this number, open the added file(s) and confirm none introduces a raw-HTML ' +
  'sink or an aliased Lit directive; never bump it to make a red suite go green'
```

---

## [INFO-1] T4 verified: splitting the container payloads was the right call

- **Status: BY EXECUTION**

The dev hoisted the three svg-in-container payloads into three `check()` calls rather than pinning an array length. Deleting one payload now fails:

```
  - check total pinned: expected 54 checks to run, 53 did — a check was added or silently removed
EXIT=1
```

The reasoning in the comment at `:382-387` is sound: the payloads now sit under the single `EXPECTED_CHECKS` pin that is already proven to fire, instead of introducing a second counter that would itself need guarding. Agreed, and confirmed by execution.

## [INFO-2] Check arithmetic re-derived independently — the corrected note is right

- **Status: BY EXECUTION**

| Quantity | Value | How |
|---|---|---|
| Literal call sites | **53** | `grep -cE '^\s+check\(' markdown.test.ts` |
| All `check(` occurrences | 56 | `grep -oE 'check\(' \| wc -l` |
| Reconciliation | 56 = 53 + 1 + 2 | 1 declaration (`:34`), 2 prose mentions (`:382`, `:383`) |
| Runtime checks | **54** | gate output `markdown sanitizer: 54 checks passed` |
| Formula | 53 − 1 + `REQUIRED_SINKS.length` (2) = 54 | the `:672` call site is inside the loop |

The note at `:768-773` is accurate, and I specifically checked the failure mode that bit the first attempt: **the quoted pattern `^\s+check\(` does not self-match its own comment line**, because that line begins with `//`. `EXPECTED_SOURCE_FILES = 50` also verified independently against `find src -type f ... ! -name '*.test.*' | wc -l` → `50`. ✅

---

# Item 2 — is the threat model coherent, or a trailing blocklist?

**Both, and the split is the useful part of the answer.** The guard is two mechanisms with different epistemic status, and they should be judged separately rather than as one "G1".

**(a) The positive, per-file binding** — "these two named files route through the sanitizer." This is a **closed-world** claim over an enumerated set of two files. It is the right shape, it is cheap, and it can be made *correct*. Today it is not: HIGH-1 shows it asserts a textual property that does not entail its own docstring. Fixing it is two extra regexes over two named files — bounded work with an end state, not a treadmill.

**(b) The negative, tree-wide claim** — "no other raw sink exists anywhere." This is an **open-world** claim enforced by enumeration, and it will always trail by one idea. The evidence is not speculative:

- the banned list went 2 → 8 forms in a single commit (`fa41008`);
- the dev found two evasions in its **own** fix, *after* two reviewers and the EM had signed off on the approach;
- I found five more in one session (M-2, M-3, M-4, M-5, M-6), none requiring cleverness — they are the first five things on the brief's own candidate list.

That is the signature of a blocklist. **Say it plainly: (b) will never be complete, and no number of additional patterns will make it complete.** My MEDIUM-2 recommendation extends it by three more forms and I expect a sixth reviewer to find a ninth.

**But round 3 narrowed (b) more than it has been credited for.** `EXPECTED_SOURCE_FILES` converts "an attacker/developer adds a file containing a raw sink" from open-world into closed-world: you cannot add a scannable file without failing (M-8, caught twice). Combined with the exact sink-count pin, the residual surface of (b) is *modifications to the 50 existing files*. That is a genuine, defensible narrowing, and it is why my answer to "is it adequate until Phase 2" is **yes, for (b)**.

**So: is the current guard adequate until Phase 2?**

- For **(b)** — yes, as a *tripwire*, on one condition that the code already satisfies. The `BANNED_SINKS` docstring at `:611-614` says outright: "Do not read a green result as 'no raw sink exists' — read it as 'none of these eight forms exists'." That is honest, unusually so, and it is what makes a blocklist acceptable at a merge gate. Keep that comment verbatim; it is doing more work than any of the patterns.
- For **(a)** — **no.** (a) is the half that is supposed to be sound, is cited by reviewers as proof, and is currently weaker than its specification. That is the round-2 defect recurring one level along, exactly as the brief warned ("do not assume the current composition is complete either").

**What should replace (b) at Phase 2 — do not just extend the regexes.** The brief asks whether the regexes have "drifted into re-implementing what the module system already knows." **They have, and that is the diagnosis.** `RAW_DIRECTIVES` is a hand-rolled, lossy module resolver: it loses to aliasing, assignment, destructuring, dynamic import and re-export chains — all of which the TypeScript module graph resolves exactly. Two closed-world replacements, neither of which is this branch's job:

1. **Type-aware lint** — typescript-eslint with `no-restricted-imports` plus a `no-restricted-syntax` rule over resolved symbols. It answers "does any expression in this program evaluate to the `unsafeHTML` directive" using real scope and module resolution, which is the question the regex is failing to ask. This subsumes MEDIUM-1, MEDIUM-3 and MEDIUM-4 at once and eliminates the false positives, because it never looks at prose.
2. **Trusted Types** (`require-trusted-types-for 'script'`) — makes every *unenumerated* DOM XSS sink a runtime error in the browser. Closed-world by construction, with no list to maintain. This is out of scope here, but it is a concrete argument for why the deferred CSP work is the highest-value follow-up, which both round-2 reviewers already concluded.

I am not re-proposing the component-rendering harness; it is deferred with agreement and it addresses a different question (does the sink sanitize at runtime) than the one above (is the sink reachable under another name).

# Item 4 — the fifteenth self-built oracle

**I hunted the ~226 new lines and did not find one.** Recording the reasoning so the next reviewer need not repeat it:

- The static scan reads real files at real paths from the real tree and greps their bytes. The source tree is the system under test, not a model of it. Reading `REQUIRED_SINKS` by explicit path and regexing the contents is a static scan, as the brief says — correct.
- `check()`/`checks` is a plain counter, and the count is pinned and **proven to fire** (T4 above, and the `EXPECTED_CHECKS` mutation). A counter whose total is externally pinned is not an oracle.
- The closest candidate is `EXPECTED_SOURCE_FILES = 50` — a hand-maintained restatement of something the filesystem already knows. But it is deliberately a *pin*, its failure message says so, and I verified 50 independently with `find`. Not an oracle; see LOW-2 for its real weakness.

The genuine instance of "re-implementing what the platform already knows" in the new code is `RAW_DIRECTIVES` re-implementing module resolution — a different defect from a self-built oracle, and it is the substance of the threat-model section above.

---

# BY EXECUTION vs REASONED

### Verified BY EXECUTION (every mutation content-addressed, restored from `cp` backups in `/tmp/audit195-backups/`, `git status --porcelain` asserted empty after each)

- Clone at `bae4fd0`; baseline `54 checks passed`, `EXIT=0`; jsdom **26.1.0** measured in-clone and against the lockfile.
- Production diff `5daace4..bae4fd0` = 2 files, zero production code.
- `find`-derived source count = 50, matching `EXPECTED_SOURCE_FILES`.
- Literal check count 53; 56 total occurrences reconciled; runtime 54; the corrected note's grep does not self-match.
- **Survivors (bypasses):** M-1, M-1b, M-1c (identity shadow of `renderMarkdown`); M-2 (assignment alias); M-3 (`Object.assign`); M-4 (computed write); M-5 (`||=`); M-6 (`.jsx`); M-7 (`*.test.ts`).
- **Controls caught, as expected:** M-8 (new `.ts` file, 2 failures); M-9 (dev bypass 1, `lit-html/` path re-export); M-10 (dev bypass 2, `unsafeHTML as`). The dev's two self-found evasions are genuinely closed.
- **False positives:** FP-2 (prose), FP-3 (safe re-export), FP-4 (type assertion) all turn the gate red.
- **FP-1 control green:** `import { html as staticHtml } from 'lit/static-html.js'` → `54 checks passed`, `EXIT=0`.
- T4: deleting one split payload → caught by the check-total pin, `EXIT=1`.
- Production wiring of the comments sink (`index.ts:48` → `ft-inspector.ts:211` → `listComments` → `c.body`).
- `tsconfig.test.json` includes only the two test files, so component sources are not type-checked by the gate.

### REASONED, not executed

- That a `.jsx` file would be bundled into `dist` by Vite (I did not run `vite build`). The intent mismatch in `SCANNED_EXTENSIONS` is executed; the bundling consequence is inference.
- Severity calibration of HIGH-1, following the EM's round-2 rule that guard defects are rated on conformance to their written specification rather than on present-day impact.
- LOW-2's claim about reflexive bumping — a judgement about human behaviour, not a measurement.
- The Phase-2 replacement recommendations (type-aware lint, Trusted Types). Neither prototyped here.
- I measured **only my own clone's** jsdom. I make no claim about any other clone.

---

# Positive observations

1. **The dev self-audited its own fix and found two evasions after everyone had signed off.** That is the single best thing on this branch and it should be said plainly.
2. **The `BANNED_SINKS` docstring refuses to overclaim** — "read it as 'none of these eight forms exists'". Given that the list *is* a blocklist, this comment is what makes it safe to ship.
3. **The docstring at `:536-542` correctly predicts the exact failure class I exploited** — "a regex over source text is a hand-rolled stand-in for the TypeScript module graph, and it disagrees with the real language semantics on aliasing, re-export and indirection." HIGH-1 and MEDIUM-1 are that sentence coming true. The analysis was right; the implementation did not go far enough.
4. **The T6 comment at `:124-130`** — documenting that the `formaction` check asserts the tag rule and that the two `FORBID_ATTR` entries are untestable defence-in-depth — is exactly the sort of honesty that prevents a future reviewer from mistaking coverage for proof.
5. **Sink-count pinned against `REQUIRED_SINKS.length`** rather than a literal: the pin moves with the thing it guards.
6. **`findWebRoot()` throws rather than returning empty** — the vacuous-pass failure mode is genuinely closed.
7. Both real sinks remain correctly wrapped; the whole round is test-only, as claimed.

# Recommendations beyond the findings

- **Prioritise the CSP / Trusted Types follow-up.** Three rounds of reviewers have now converged on it independently. It is the only proposal on the table that closes the open-world half of this problem rather than lengthening it.
- **Consider splitting G1's two halves in the code and the docs**, naming them separately (e.g. `sinkBindingExact` and `rawSinkTripwire`). Reviewers keep citing "G1" as a single guarantee; they are two claims with very different strength, and the conflation is what let HIGH-1 through three sign-offs.
- **Add fixture-string unit checks for the regexes themselves.** FP-1 passes vacuously today because nothing in the tree exercises it. A handful of positive/negative string fixtures asserted directly against `RAW_DIRECTIVES` would pin both the control and the false-positive behaviour without depending on tree contents — and would sit under the existing `EXPECTED_CHECKS` pin.
- Not for this branch: the `npm test` gate never type-checks component sources. Worth an issue on its own.

---

**Verdict: REQUEST CHANGES** — on HIGH-1 (blocking) and MEDIUM-4 (a guard that fails on a security comment will be disabled). MEDIUM-1/2/3 should land in the same pass since they are all one-line additions to loops that are already being edited. LOW/INFO at the team's discretion.

*Reviewed independently at `bae4fd0`. I have not seen the code-review leg's report; per the brief it runs later at this same SHA.*
