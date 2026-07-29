# test-195-r3 — #195 `markdown-sanitize` round-3 test review

**SHA reviewed:** `bae4fd0` (verified: `git rev-parse --short HEAD` → `bae4fd0`)
**Clone:** `/workspace/farmtable-test-195`
**Runner:** `npm ci && npm test` (node, not vitest — the vitest false-failure trap was avoided)
**jsdom actually run against: `26.1.0`** — matches the tree's `^26.1.0`. No version drift this round (round 2's 29.1.1 skew is not present in this clone). `lit` 3.3.2, `lit-html` 3.3.2 both installed and importable.
**Baseline:** `markdown sanitizer: 54 checks passed`, EXIT=0. Tree clean before and after every mutation.

## VERDICT: REQUEST CHANGES

One **High** finding: the sink-binding guard is still evadable, by the same attack shape as the round-2 High that was upheld, one indirection step along. Proven by mutation against the **real** sink with the sink count preserved — the M-G1-10 standard of evidence.

**No live vulnerability.** Both real sinks are correctly wrapped at `bae4fd0`. Everything below is regression-detection.

---

## Method

Backups `cp`'d to `/tmp/mut195/backup`, outside the repo. Every mutation applied **by content** through a helper that aborts unless the anchor string occurs **exactly once** (`ANCHOR ERROR` otherwise) — no line-addressed edits anywhere. `git status --porcelain` asserted empty after every restore; all restores clean. 40 mutations total.

---

## Findings

### HIGH-1 — Sink binding is evadable by value-aliasing; the ban covers only the three *import-syntax* forms
`web/src/util/markdown.test.ts:709-730` (indirection check), `:637-641` (`RAW_DIRECTIVES`), `:686` (call-site scan)
**BY EXECUTION.**

The guard bans `X as Y`, `import * as`, and `export … from`. All three are import-*syntax* forms. It does not see aliasing of the imported **value**, which needs no `as` keyword.

Mutation **MUT-B9**, against the real sink, with the sink count preserved and the required literal intact:

```
+const rawHtml = unsafeHTML;
+                        <span class="comment-preview">${rawHtml(c.body)}</span>
```
```
EXIT=0
markdown sanitizer: 54 checks passed
```

`c.body` is attacker-controlled (comment bodies mirrored verbatim per this file's own header). The component is wired into production — `src/index.ts:48` imports it and `ft-inspector.ts:211` renders it — so this is reachability, not reconstruction. Line 221's legitimate `unsafeHTML(renderMarkdown(c.body))` is untouched, so the per-file check passes, `sinks.length` stays 2, and the count pin agrees. Every one of the 54 checks passes while attacker markdown renders raw into the shadow root.

Four further members of the class, each SURVIVED at exit 0 (`MUT-B1`–`B4`):

| form | why invisible |
|---|---|
| `const raw = unsafeHTML;` … `raw(b)` | no `as`; `unsafeHTML` never precedes a `(` |
| `const { unsafeHTML: raw } = await import(…)` | destructuring rename is not `as` |
| `const S = { raw: unsafeHTML }; S.raw(b)` | property bag |
| `unsafeHTML (b)` — one space | call scan is `unsafeHTML\(`, no `\s*` |

**Recommendation.** Ban use of the directive name in any position other than immediately-called. In the indirection check, after confirming the import, flag any occurrence of the name not followed by `(`:

```ts
new RegExp(`\\b${name}\\b(?!\\s*\\()`)   // applied outside the import statement
```

That kills `const raw = unsafeHTML`, the property bag and the destructuring rename in one rule. Separately widen the call scan at `:686` and `:674` to `unsafeHTML\s*\(` to close the whitespace variant. This is the sink-binding leg of the round, so it should not ship until the binding is genuine rather than merely more elaborate.

---

### HIGH-2 — The new-file guard is the file-count pin, not the sink logic, and its message instructs the update that disarms it
`web/src/util/markdown.test.ts:568` (`EXPECTED_SOURCE_FILES`), `:659-666` (message)
**BY EXECUTION.** This is the direct answer to scrutiny item 2.

Attribution matters here, and it is not what the fix brief assumes:

- **MUT-G1-3a** — new file, `import { unsafeHTML as raw }`: **2** checks fire (alias check *and* count pin). M-G1-3 as originally written **is** caught. The dev's claim is true.
- **MUT-G1-3b** — new file, `const raw = unsafeHTML` (HIGH-1's form): **only the count pin fires.** The sink-binding logic is blind to it.
- **MUT-G1-3c** — same file, plus `EXPECTED_SOURCE_FILES` 50 → 51:

```
EXIT=0
markdown sanitizer: 54 checks passed
```

The only thing standing between the tree and a raw sink in a new file is a developer declining to make an edit that the failure message explicitly tells them to make:

> `expected to scan exactly 50 source files, found 51 — update EXPECTED_SOURCE_FILES deliberately if a source file was added or removed`

For a developer who has just legitimately added a file — the overwhelmingly common case — bumping the number is the correct action, and the message confirms it. The word "deliberately" asks for care without naming the decision. **The message does not tell the next person what they are actually deciding.** This is precisely the rubber-stamp failure mode the EM asked about, and here it is load-bearing rather than cosmetic.

**Recommendation.** Two changes, both cheap:
1. Reword to name the decision: `…before bumping this number, confirm the added file contains no raw-HTML sink and no aliased raw directive.`
2. Fix HIGH-1 so the count pin stops being the guard and returns to being what its own docblock says it is — a vacuity check.

Note the contrast with `EXPECTED_CHECKS` (`:774`) and the `sinks.length` pin (`:695`), whose messages are fine: those numbers are derived from the suite's own structure, and a developer changing them has necessarily just changed the suite. `EXPECTED_SOURCE_FILES` is the odd one out because it moves for reasons unrelated to the suite.

---

### MEDIUM-1 — `.mts`, `.cts`, `.jsx` are invisible, and trip *no* pin at all
`web/src/util/markdown.test.ts:590` (`SCANNED_EXTENSIONS`), `:592-595`
**BY EXECUTION.**

`SCANNED_EXTENSIONS` was widened past `.ts` for exactly the right reason. It still misses three real module extensions, and `.mts`/`.cts` are ones TypeScript itself emits and consumes.

```
MUT-EXT-mts / -cts / -jsx : file containing BOTH unsafeHTML(b) and el.innerHTML = b
  -> EXIT=0   markdown sanitizer: 54 checks passed
MUT-EXT-js (control, .js IS listed): el.innerHTML = b
  -> EXIT=1   2 checks fail (count pin + banned-sink scan, naming the file)
```

This is strictly worse than the new-`.ts`-file case in HIGH-2. Because `isScannableSource` filters these out *before* `files` is built, the file count stays at 50 and **not even the count pin fires** — there is no signal of any kind.

**Recommendation.** Invert the predicate rather than extending the list. A denylist of known-inert extensions (`.css`, `.json`, `.svg`, `.md`) makes "scanned" the default for any extension the project adopts next, which is the property the docblock at `:586-589` says it wants. If the list is kept, add `.mts`, `.cts`, `.jsx`.

---

### MEDIUM-2 — The scan matches comments and string literals, so documenting the rule turns the suite red
`web/src/util/markdown.test.ts:709-730`, `:643-652`
**BY EXECUTION.** Relevant to scrutiny item 3's false-positive concern.

No source text is stripped before matching, so the guard fires on prose:

| mutation | content added to a source file | result |
|---|---|---|
| MUT-FP3 | `// SECURITY: never import unsafeHTML as something else - it defeats the scan.` | **EXIT=1** — "unsafeHTML renamed with 'as'" |
| MUT-FP4 | `// Do not use document.write( here; use lit templating.` | **EXIT=1** — "document.write" |
| MUT-FP5 | `const ADVICE = 'never do el.innerHTML = userInput';` | **EXIT=1** — "innerHTML/outerHTML assignment" |

The person most likely to trip this is the next developer writing a comment explaining this very guard. Per the EM's own bar — a guard that rejects legitimate code gets disabled — this is the realistic disablement path, more so than the `lit/static-html.js` control.

**Recommendation.** Strip line and block comments and string literals before matching, or support an explicit opt-out marker (`// raw-sink-scan: ignore-line`) and document it in the `BANNED_SINKS` docblock. The opt-out is the smaller change and keeps the scan honest, provided the marker itself is greppable in review.

---

### LOW-1 — The stated false-positive control is not in the tree
**BY EXECUTION.** `grep -rn "static-html\|lit-html" web/src --include='*.ts'` (excluding tests) returns **nothing**.

The control the brief describes as deliberate — `import { html } from 'lit/static-html.js'` — does not exist in the repository, so no run exercises it.

I verified the guard's behaviour by injecting it, and **the guard is correct**:

```
MUT-FP1  import { html } from 'lit/static-html.js';            -> EXIT=0  54 checks passed
MUT-FP2  import { html, literal } from 'lit/static-html.js';   -> EXIT=0  54 checks passed
```

So there is no defect in the guard — but there is also nothing in the repo that would catch a future widening that made it start firing.

**Recommendation.** Do not add production code to create a control. Add a negative case inside the suite instead: run the `RAW_DIRECTIVES` regexes over a small table of legitimate strings (`import { html } from 'lit/static-html.js'`, `import { html, literal } from …`, a comment mentioning the directive once MEDIUM-2 is fixed) and assert zero offenders. That pins the false-positive boundary under `EXPECTED_CHECKS`, using the same reasoning the dev correctly applied to T4.

---

### LOW-2 — `export\s+[^;]*from` spans newlines
`web/src/util/markdown.test.ts:722`
**BY EXECUTION.** `[^;]` matches newline, so the re-export rule is not line-bounded:

```
MUT-FP6:  export type Mode = 'a' | 'b'          (no semicolon)
          import { html } from 'lit/static-html.js';
  -> EXIT=1  "static-html.js re-exported"
```

Not live — this codebase uses semicolons — so it is latent, and it would present as a baffling false positive if the style ever changed.

**Recommendation.** Use `[^;\n]*`, or apply all three indirection regexes per-line.

---

### INFO-1 — Emptying `REQUIRED_SINKS` fails at `tsc`, not at a pin
`MUT-T3b` → `error TS7034: Variable 'REQUIRED_SINKS' implicitly has type 'any[]'`, EXIT=2. Still red, so the mutation is dead, but it dies at compile time rather than at an assertion. Adding an explicit `: string[]` annotation would remove that accident — the check-total pin would still catch it (52 ≠ 54), so no action is required; noted so the next reader does not mistake the compile error for the guard working.

### INFO-2 — Files outside `web/src/` are unscanned
`collectSourceFiles` is rooted at `join(root, 'src')`, so `web/index.html` (which contains an inline `<script>`) and `web/vite.config.ts` are out of scope. Neither is a markdown sink nor attacker-controlled. Noting the scope boundary only; no action.

---

## Verified sound — mutations confirmed DEAD by execution

I did not re-establish M-G1-10 (EM confirmed it independently). Everything else claimed was verified by content.

**T2 — all 11 raw-sink forms dead**, each naming the file *and* the specific sink:
`.innerHTML =` · `.innerHTML +=` (the form the old regex missed) · `.outerHTML =` · `['innerHTML'] =` · `["outerHTML"] +=` · `insertAdjacentHTML` · `document.write` · `setHTMLUnsafe` · `createContextualFragment` · `unsafeSVG(` · `unsafeStatic(`

**Both dev self-found bypasses closed, plus a deeper path I added** — all 8 dead:
`unsafeHTML as` from `lit/` · from `lit-html/` · **from `lit-html/development/directives/unsafe-html.js`** (I added this third path; suffix matching handles it correctly) · `unsafeSVG as` · `unsafeStatic as` · `import * as` · `export { … } from` · `export * from`

**T4 — the hoisting call is correct.** Deleting one of the three payloads:
```
EXIT=1  Error: 1 of 53 markdown sanitizer checks failed:
  - check total pinned: expected 54 checks to run, 53 did — a check was added or silently removed
```
**Endorse the dev's reasoning.** Reusing `EXPECTED_CHECKS` — a pin already proven to fire — instead of adding a second, unguarded length counter is the right trade. A second counter would itself have needed guarding, which is the regress the dev correctly declined.

**T3 narrowing — all dead.** Drop one `REQUIRED_SINKS` entry → 2 failures (sink-count pin + check-total). Remove the `sinkBinding()` call → check-total fires at 47. Rename a sink file on disk → `ENOENT` surfaced through the named per-file check, exactly as the docblock at `:545-555` promises. **T3 is a real improvement against narrowing, not a rubber stamp** — the criticism in HIGH-2 is specific to `EXPECTED_SOURCE_FILES`, not to the exact-pin approach.

**Check-count arithmetic — re-derived independently, correct.**
`grep -cE '^\s+check\(' → 53`. I listed all 53 matches; every one is a genuine `check(` call site and **none is the comment describing the grep** — that line begins at column 0 with `//`, so `^\s+` cannot match it. The self-confirming inflation in the first version is genuinely fixed. Line 672 is the sole loop site, `REQUIRED_SINKS.length` = 2, so runtime = 53 − 1 + 2 = **54**, matching the printed total. The comment's formula `53 + (REQUIRED_SINKS.length - 1) = 54` is right. (A wider pattern yields 56: the extra 3 are the `function check(` definition and two prose mentions — neither affects the dev's stated pattern.)

**Scope:** diff vs `5daace4` is `markdown.test.ts` + one project-log file. Zero production code. Independently confirmed.

---

## Defect classes I was asked to apply

**(a) Tests that disappear instead of failing — none found.** Both derived collections are pinned against totals: `files` against `EXPECTED_SOURCE_FILES`, `sinks` against `REQUIRED_SINKS.length`. `unbound` (`:733`) is filtered through the predicate under test, but it derives from `sinks`, which is independently pinned, so a sink cannot leave the case list silently. `checks` is pinned. Verified by execution: removing a check, a payload, a `REQUIRED_SINKS` entry, and the whole `sinkBinding()` call all go red. The T4 hoist specifically converted a disappearing case list into a pinned one.

**(b) The fifteenth self-built oracle — not found.** The positive cases (`:412-477`) compare against literal expected output, not recomputation. The static scan reads files named by explicit path and regexes them, which is a scan and not an oracle, as the brief notes.

But the brief's follow-up question — *have the regexes drifted into re-implementing what the module system already knows?* — has a **yes** answer, and HIGH-1 is the proof. The docblock at `:536-542` states the hazard precisely ("a hand-rolled stand-in for the TypeScript module graph… it disagrees with the real language semantics on aliasing, re-export and indirection") and then closes only the three import-syntax forms. The stand-in is still incomplete in exactly the dimension its own comment names. That is not a fifteenth oracle, but it is the same underlying error: a reimplementation trusted further than it has been verified.

**(c) Sink binding — more elaborate, not yet genuine.** The per-file binding (T1) is real and I could not evade it: it survived renaming, narrowing and every `as`-form. But the tree-wide half still identifies sinks by the *spelling* `unsafeHTML(`, and HIGH-1 shows that spelling is one assignment away from being avoidable inside the real sink file with the count intact.

---

## BY EXECUTION vs REASONED

**BY EXECUTION** (40 mutations, all content-addressed, all restored clean): HIGH-1 (MUT-B1–B4, B9), HIGH-2 (MUT-G1-3a/b/c), MEDIUM-1 (MUT-EXT ×4), MEDIUM-2 (MUT-FP3/4/5), LOW-1 (grep + MUT-FP1/2), LOW-2 (MUT-FP6), INFO-1 (MUT-T3b); all 11 T2 forms, all 8 alias forms, T4 deletion, all T3 narrowing forms, the check-count arithmetic, the scope diff, and the jsdom version.

**REASONED, not executed:**
- That HIGH-1 constitutes a *live* XSS if shipped. I proved the guard stays green and that the component is production-wired (`src/index.ts:48`, `ft-inspector.ts:211`); I did not render the component and fire a payload, which needs the Phase 2 harness. The regression-detection gap itself is executed fact.
- MEDIUM-2's likelihood argument (that a developer will write such a comment). The false positives themselves are executed fact.
- LOW-2's latency (that semicolon style will not change). The regex behaviour is executed fact.
- INFO-2 rests on reading `collectSourceFiles`' root argument, not on a mutation.

---

## Recommendation to the manager

**REQUEST CHANGES**, on HIGH-1 and HIGH-2. Both are narrow, mechanical fixes to the test file — the negative-lookahead rule for HIGH-1 and a reworded message for HIGH-2 — and neither touches production code.

The round did real work: T2, T4, T3's narrowing defence and the per-file binding are all genuinely dead under mutation, and the arithmetic self-confirmation is properly fixed. But the round's own thesis was sink-binding, and the binding is still one keyword away from evadable by the same attack shape that carried round 2.

Two notes for sequencing. First, the pattern from the fix brief holds again: each round has closed the *named* forms of the previous finding rather than the class behind it — `as`-aliasing was closed, value-aliasing was not. I would ask for the fix to be stated as a rule about how the directive may be *used*, not as another list of forms to ban, or round 4 will find a sixth spelling. Second, treat my HIGH-1 remedy as provisional for the same reason my round-2 snippet was partial: I verified the negative-lookahead idea against the four forms in the table above and did not implement and re-mutate it. It should be re-attacked after implementation, not accepted because it cites this report.

The code-review leg runs later at this same SHA. HIGH-1 is a test-suite defect with no production component, so I do not expect a contradiction, but the reflexive-update argument in HIGH-2 is a judgement call that a reviewer could reasonably weigh differently.
