# Security Audit Report — #195 `markdown-sanitize`, round 5

**SHA tested: `53296afe36b718a8664be5ab748879a18f289b66`** (`53296af`), branch
`markdown-sanitize`, tree clean before and after.

**VERDICT: APPROVE** — with one Medium architectural finding I want acted on
before this pattern is copied to a third sink, and four Low items.

No Critical and no High. I attacked the sanitizer with 69 vectors plus 10
dedicated mXSS vectors and **found no route to script execution**. The Medium is
hardening posture, not a live vulnerability.

> Note on the clone: the brief says my clone is `/workspace/farmtable-audit-195`.
> That path does not exist. `/workspace` *is* a checkout of `markdown-sanitize`
> at `53296af` with a clean tree and a single worktree, so I used it, and I
> restored it to clean after every mutation (verified below).

---

## Severity table

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 4 |
| Info | 2 |

| ID | Sev | Title |
|---|---|---|
| M1 | Medium | Subtractive forbid-list leaves 138 unnecessary tags; the security actually rests on DOMPurify defaults the config does not pin |
| L1 | Low | `slot` survives sanitization — latent UI-redressing primitive in the `sl-details` sink |
| L2 | Low | Guard suite does not catch `ALLOW_UNKNOWN_PROTOCOLS: true` |
| L3 | Low | Unproxied external subresource loading — viewer IP/UA disclosure and read receipts |
| L4 | Low | Presentational/behavioural attributes survive (`id`, `name`, `align`, `width`/`height`, `hidden`, `popover`, `draggable`, `tabindex`, `role`/`aria-*`) |
| I1 | Info | `data:` URI permitted on `img src` (non-executable) |
| I2 | Info | Forbid list is incomplete *as a form-control policy* (`optgroup`, `datalist`, `label`, `fieldset`, `legend`, `output`, `progress`, `meter` survive) |

---

## Gate run (BY EXECUTION)

`npm ci` then `npm test` in `web/`, exit code read directly from the child, not
through a pipe.

```
$ npm ci ; echo "NPM_CI_EXIT=$?"
NPM_CI_EXIT=0

$ npm test > /tmp/gate.log 2>&1; GATE_EXIT=$?; echo "GATE_EXIT_CODE_FROM_CHILD=$GATE_EXIT"
GATE_EXIT_CODE_FROM_CHILD=0

$ cat /tmp/gate.log
> farmtable-web@0.0.1 test
> tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js

markdown sanitizer: 61 checks passed

$ git status --porcelain
            <-- empty
$ git rev-parse HEAD
53296afe36b718a8664be5ab748879a18f289b66
```

**61 checks confirmed, exit 0, clean tree.** Installed versions BY EXECUTION:
`dompurify@3.4.12`, `marked@15.0.12`, `jsdom@26.1.0` (dev).

---

## Method, and its self-checks (bar 1, bar 3)

Bar 3 says a negative result across more than one step must first prove the
harness can express the state change, failing closed. My first harness ran each
vector down two paths — production `renderMarkdown` and a "weakened twin" with
the forbid lists removed — and returned **42 INCONCLUSIVE out of 69**. That was
the self-check working. The weakened twin still ran DOMPurify, so for any vector
that DOMPurify's *defaults* handle, both paths were clean and the harness could
not distinguish "the config blocked this" from "nothing here was ever
expressible". Had I reported that first run as a clean pass I would have filed
exactly the false negative bar 3 warns about.

I added a third path — `marked` output with **no DOMPurify at all** — which
turns the instrument into a three-way discriminator:

| detector(real) | detector(weak) | detector(raw) | verdict |
|---|---|---|---|
| true | — | — | **SURVIVES** |
| false | true | — | **BLOCKED-BY-CONFIG** — `FORBID_*` did it |
| false | false | true | **BLOCKED-BY-DEFAULTS** — DOMPurify's allow-list did it; config not load-bearing |
| false | false | false | **INCONCLUSIVE** — payload absent even unsanitized; *not* a pass |

Every detector is proven live against its own positive control before any vector
runs, and the run exits non-zero on any SURVIVES **or** any INCONCLUSIVE.

```
=== HARNESS CAPABILITY SELF-CHECK (must all be FIRE) ===
  FIRE  hasEventHandler  <- <img src=x onerror=alert(1)>
  FIRE  hasScriptUrl  <- <a href="javascript:alert(1)">x</a>
  FIRE  hasTag(script)  <- <script>alert(1)</script>
  FIRE  hasTag(iframe)  <- <iframe srcdoc="x"></iframe>
  FIRE  hasAttr(srcdoc)  <- <iframe srcdoc="x"></iframe>
  FIRE  hasAttr(style)  <- <p style="color:red">x</p>
  FIRE  hasAttr(class)  <- <p class="comment">x</p>
  FIRE  hasAttr(id)  <- <p id="x">x</p>
  FIRE  hasTag(style)  <- <style>a{}</style>
  FIRE  hasTag(form)  <- <form></form>
  FIRE  hasText  <- xx alert(1) xx
  all detectors demonstrably fire.
```

Final three-path result over 69 vectors:

```
=== SUMMARY ===
SURVIVES            : 17
BLOCKED-BY-CONFIG   : 10   <- FORBID_TAGS/FORBID_ATTR did this.
BLOCKED-BY-DEFAULTS : 36   <- DOMPurify's built-in allow-list did this. Config NOT load-bearing.
INCONCLUSIVE        : 6    <- payload absent even UNSANITIZED.
total               : 69
```

**None of the 17 survivors is a script-execution vector.** Every `on*` handler,
every `javascript:`/`vbscript:`/`data:text/html` href, `<script>`, `<iframe
srcdoc>`, `<object>`, `<embed>`, `<base>`, `<meta http-equiv=refresh>`, SVG
`<script>`/`<animate>`/`<set>`/`<foreignObject>`, and MathML
`<annotation-xml encoding="text/html">` was blocked. The 6 INCONCLUSIVE are
mXSS-shaped inputs where the payload sits inside an attribute value in the raw
stream so my element-walking detector correctly never fired; I inspected each
production output by hand and separately covered them with the round-trip test
below.

Harnesses and full outputs salvaged to
`/scion-volumes/scratchpad/projects/farmtable/salvage/audit-195-r5-*`.

---

## 1. The production sanitizer — `web/src/util/markdown.ts`

### mXSS / parse–reparse (BY EXECUTION)

This is the right test for this sink specifically: `unsafeHTML` assigns the
sanitized **string**, so the browser parses it a second time. If
serialize→reparse is not a fixed point, that delta *is* the primitive.

```
=== mXSS RE-PARSE STABILITY (idempotence + round-trip) ===
  inert  roundtripStable=true  idempotent=true   <svg></p><style><a id="</style><img src=1 onerror=alert(1)>">
  inert  roundtripStable=true  idempotent=true   <noscript><p title="</noscript><img src=x onerror=alert(1)>">
  inert  roundtripStable=true  idempotent=false  <form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>
  inert  roundtripStable=true  idempotent=true   <svg><p><style><img src=1 onerror=alert(1)></style></p></svg>
  inert  roundtripStable=true  idempotent=true   <math><mtext><table><mglyph><style><!--</style><img title="--></mglyph><img src=1 onerror=alert(1)>">
  inert  roundtripStable=true  idempotent=true   <table><caption><svg><foreignobject><math><mtext><table><mglyph><style><img src=x onerror=alert(1)>
  inert  roundtripStable=true  idempotent=true   <xmp><p title="</xmp><img src=x onerror=alert(1)>">
  inert  roundtripStable=true  idempotent=true   <listing><p title="</listing><img src=x onerror=alert(1)>">
  inert  roundtripStable=true  idempotent=true   <svg><animate onbegin=alert(1) attributeName=x dur=1s>
  inert  roundtripStable=true  idempotent=true   <template><style><a title="</style><img src=x onerror=alert(1)>">

  SELF-CHECK post-reparse handler detector fires on control: FIRE
  mXSS vectors checked: 10, yielding a live handler after reparse: 0
```

All 10 round-trip stable, zero live handlers after reparse. The one
`idempotent=false` case is `renderMarkdown(output) != output` because re-feeding
HTML through *marked* differs; both passes are inert, so it is not a security
property. **DOMPurify 3.4.12 holds here.**

### DOMPurify version vs known bypasses (BY EXECUTION)

Web search is blocked in this container, so I checked against the registry and
the advisory database via tooling rather than reasoning about DOMPurify in the
abstract:

```
$ npm view dompurify version dist-tags --json
{ "version": "3.4.12", "dist-tags": { "latest": "3.4.12" } }
$ node -p "require('./node_modules/dompurify/package.json').version"
3.4.12

$ npm audit --json  ->  vulnerabilities: {"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}
```

**The installed version is the latest published release, with zero known
advisories across the whole tree.** The historical 3.x bypasses (the 3.1.x
`<template>`/mXSS family, the 3.2.4 nesting bypass) are all fixed well below
3.4.12, and the nesting-family vectors above are in my mXSS corpus and inert.

*Caveat, REASONED:* `web/package.json:17` declares `"dompurify": "^3.0.0"`. The
lockfile pins 3.4.12 and CI uses `npm ci`, so the built artefact is
deterministic — but the declared range would accept any 3.x, and 3.0.0 itself
has known bypasses. Tightening to `^3.4.12` costs nothing.

### Checkbox renderer (BY EXECUTION)

`markdown.ts:57-64`. The charge was to verify the emitted markup is inert and
that no input can influence what it emits.

```
  in : "- [x] done"
  out: "<ul>\n<li><span role=\"img\" aria-label=\"Completed\">☑︎</span> done</li>\n</ul>\n"
  in : "- [ ] todo"
  out: "<ul>\n<li><span role=\"img\" aria-label=\"Not completed\">☐︎</span> todo</li>\n</ul>\n"
  in : "- [x] <img src=x onerror=alert(1)>"
  out: "<ul>\n<li><span role=\"img\" aria-label=\"Completed\">☑︎</span> <img src=\"x\"></li>\n</ul>\n"
  in : "- [X] UPPER"
  out: "<ul>\n<li><span role=\"img\" aria-label=\"Completed\">☑︎</span> UPPER</li>\n</ul>\n"
  in : "- [x] \"><script>alert(1)</script>"
  out: "<ul>\n<li><span role=\"img\" aria-label=\"Completed\">☑︎</span> \"&gt;</li>\n</ul>\n"
  in : "- [x] ‮rtl-override"
  out: "<ul>\n<li><span role=\"img\" aria-label=\"Completed\">☑︎</span> ‮rtl-override</li>\n</ul>\n"
```

**Clean.** The renderer's only input is `Tokens.Checkbox.checked`, a boolean, so
the sole attacker influence is *which of two fixed literals* is chosen. Neither
literal interpolates anything. The item text is a sibling, escaped by marked and
then sanitized (`"><script>` → `"&gt;`). The `U+FE0E` escape is present in the
output as documented. This renderer is not an injection point.

I did check the one thing that would break that: whether the string literals
could be reached with a non-boolean `checked`. They cannot — `checked` is
produced by marked's own tokenizer, not by the payload, and the ternary is total.

---

## 2. M1 [MEDIUM] — the forbid-list posture is wrong for this threat model

- **Location:** `web/src/util/markdown.ts:26-40` (the two lists) and `:66-71`
  (the `sanitize` call)
- **Description (BY EXECUTION):** `FORBID_TAGS`/`FORBID_ATTR` are *subtractive*
  over DOMPurify's default allow-list. I enumerated what actually gets through
  the production config by probing every HTML/SVG/MathML element name:

```
=== TAGS PERMITTED THROUGH THE PRODUCTION CONFIG ===
HTML  (97): a abbr acronym address area article aside audio b bdi bdo big blink blockquote br canvas
center cite code content data datalist dd decorator del details dfn dir div dl dt element em fieldset
figcaption figure font footer h1 h2 h3 h4 h5 h6 header hgroup hr i img ins kbd label legend li main map
mark marquee menu menuitem meter nav nobr ol optgroup output p picture pre progress q rp rt ruby s samp
section shadow small source spacer span strike strong sub summary sup table time track tt u ul var video
wbr slot
SVG   (31): svg a circle defs desc ellipse filter font g glyph hkern image line marker mask metadata
mpath path pattern polygon polyline rect stop switch symbol text title tref tspan view vkern
MathML(29): math menclose merror mfenced mfrac mglyph mi mlabeledtr mmultiscripts mn mo mover mpadded
mphantom mroot mrow ms mspace msqrt mstyle msub msup msubsup mtable mtd mtext mtr munder munderover
TOTAL PERMITTED: 157

=== TAGS MARKED ACTUALLY EMITS FROM MARKDOWN SYNTAX (22) ===
a blockquote code del em h1 h2 hr img li ol p pre span strong table tbody td th thead tr ul

=== EXCESS SURFACE: permitted but never emitted by markdown (138) ===
... abbr acronym address ... marquee ... math menclose merror mfenced mfrac mglyph ... svg switch symbol
text ... video view vkern wbr    [full list in salvage]
```

  **157 tags permitted; markdown emits 22; 138 are pure excess.** The entire SVG
  and MathML namespaces are reachable from a GitHub issue body, and those two
  namespaces are where essentially every DOMPurify bypass of the last five years
  has lived — including the `<svg><style>` case this file already had to
  special-case by hand.

  The second measurement is the sharper one. Of 46 vectors that were blocked,
  **36 were blocked by DOMPurify's defaults and only 10 by the reviewed
  configuration.** The security of this boundary is overwhelmingly a property of
  DOMPurify's default allow-list — a list this file neither states nor pins, and
  which is a moving target across DOMPurify releases.

- **Impact:** This is a hardening/maintainability finding, not a live exploit.
  The concrete risk is *change over time*: any tag or attribute DOMPurify adds
  to its defaults, and any new element the HTML/SVG/MathML specs land, is
  automatically permitted into a shadow root rendering third-party content, with
  no diff in this repo and no test going red. `<dialog>` is the worked example
  already in the file — a tag that became dangerous *after* the allow-list was
  written, caught only because a human happened to reason about UA default
  styles. That catch does not scale, and the file's own comments are effectively
  an admission of it: three of the eight forbidden tags needed a paragraph of
  bespoke justification each.

- **Proof of concept:** not applicable — no current exploit. The evidence is the
  157-vs-22 measurement above, reproducible via
  `salvage/audit-195-r5-surface.mjs`.

- **Recommendation:** invert to an allow-list. Markdown's output is a closed,
  known set, so this is cheap and low-risk:

```ts
// Markdown emits a closed set of elements. Enumerate it, rather than
// subtracting from DOMPurify's ~250-tag default which spans SVG and MathML —
// namespaces this pipeline never needs and where the bypasses live.
const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'span',
  'strong', 'em', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];
const ALLOWED_ATTR = ['href', 'title', 'alt', 'src', 'role', 'aria-label', 'colspan', 'rowspan'];

export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(parser.parse(md) as string, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Keep the forbid lists too: FORBID_* wins over ALLOW_* in DOMPurify, so
    // they stay effective as a second, independent barrier if the allow-list is
    // ever widened. (Verified: FORBID_ATTR beats ADD_ATTR — see L2 workings.)
    FORBID_TAGS,
    FORBID_ATTR,
  });
}
```

  This also dissolves L1, L4, I1 and I2 as a side effect, and it makes the
  `<svg><style>` and `<dialog>` reasoning in the docblock defensive depth rather
  than the primary control. **Keep both lists** — I verified BY EXECUTION that
  `FORBID_*` takes precedence over `ADD_*` in 3.4.12, so retaining them costs
  nothing and preserves the "neither rule is load-bearing on its own" property
  the file already values.

  I recognise this means production changes on a branch that has had none in
  three rounds. I am not blocking the merge on it — the branch is a large net
  security improvement as it stands. But it should be a tracked follow-up, and
  it should land **before this pattern is copied to a third sink**.

---

## 3. Low findings

### L1 [LOW] — `slot` survives; latent UI-redressing primitive
- **Location:** `web/src/util/markdown.ts:40` (`FORBID_ATTR`);
  sink at `web/src/components/inspector/ft-inspector-comments.ts:194-222`
- **Description:** `slot` is not forbidden and survives (vector G15). It matters
  here because the comments sink renders sanitized markdown *inside*
  `<sl-details>` (line 194) — a Shoelace element with its own shadow root and a
  named `summary` slot. An attacker-supplied `slot="summary"` that got assigned
  would let a GitHub issue author write into the component's header chrome.
- **BY EXECUTION:** this is a negative claim across more than one step, so per
  bar 3 the harness proves it can express a *successful* assignment first:

```
=== SELF-CHECK: can this harness express a SUCCESSFUL slot assignment? ===
  direct child with slot="summary" assigned nodes: ["<span slot=\"summary\">HIJACKED-HEADER</span>"]
  harness CAN express slot assignment.

=== ACTUAL SINK SHAPE (ft-inspector-comments.ts:194-222) ===
  <sl-details> > div.comment > div.comment-body > [sanitized markdown]
  attacker markup at real depth, assigned to summary slot: []
  RESULT: summary slot hijacked from real depth? NO

=== COUNTERFACTUAL: what if markdown were ever a DIRECT child of sl-details? ===
  assigned: ["<span slot=\"summary\">HIJACKED-HEADER</span>","<p slot=\"summary\" id=\"x\">also tries</p>"]
  RESULT: hijacked if rendered as direct child? YES
```

  **Not exploitable today** — slot assignment only considers direct children of
  the host, and the markdown lands two levels deeper. It is exploitable the
  moment anyone flattens that nesting or renders markdown directly into a
  Shoelace component.
- **Impact:** none today; header/chrome forgery if the DOM nesting changes.
- **Recommendation:** add `'slot'` to `FORBID_ATTR` — markdown never emits it,
  so the collateral is zero, and it converts a nesting-dependent invariant into
  an unconditional one. This is the same argument the file already makes for
  `class`.

### L2 [LOW] — the guard suite does not catch `ALLOW_UNKNOWN_PROTOCOLS: true`
- **Location:** `web/src/util/markdown.ts:67`; suite `web/src/util/markdown.test.ts`
- **BY EXECUTION.** I mutation-tested whether the 61 checks pin the sanitizer
  *configuration* or only the routing. Driver proven live by a self-check
  (bar 3), content-addressed anchors with a uniqueness assert (bar 5), backup
  outside the repo with a clean-tree assert after every restore (bar 6), run
  against an already-committed tree (bar 4):

```
=== SELF-CHECK: gut the sanitizer entirely, suite MUST go red ===
[SELFCHECK-return-input-unsanitized] suite red     (exit 1) - caught
driver is live.

=== CONFIG-WEAKENING MUTATIONS ===
[drop 'style' from FORBID_TAGS] suite red     (exit 1) - caught
[drop 'dialog' from FORBID_TAGS] suite red     (exit 1) - caught
[drop 'option' from FORBID_TAGS] suite red     (exit 1) - caught
[drop 'select' from FORBID_TAGS] suite red     (exit 1) - caught
[empty FORBID_TAGS entirely] suite red     (exit 2) - caught
[drop 'class' from FORBID_ATTR] suite red     (exit 1) - caught
[drop 'style' attr from FORBID_ATTR] suite red     (exit 1) - caught
[drop 'download' from FORBID_ATTR] suite red     (exit 1) - caught
[empty FORBID_ATTR entirely] suite red     (exit 1) - caught

=== FINAL STATE ===
git status --porcelain: ''
HEAD: 53296af
```

  Then permissive *additions* rather than deletions:

```
[SELFCHECK bypass sanitize] suite red (exit 1) - caught
[ADD_TAGS script + ADD_ATTR onerror] suite red (exit 1) - caught
[ADD_ATTR style (re-permit forbidden attr)] SUITE GREEN <-- NOT caught
[WHOLE_DOCUMENT true] suite red (exit 1) - caught
[ALLOW_UNKNOWN_PROTOCOLS true] SUITE GREEN <-- NOT caught
[SAFE_FOR_TEMPLATES off + ADD_ATTR srcdoc/iframe] suite red (exit 1) - caught
final git status: '' HEAD: 53296af
```

  **Two greens — and only one of them is a gap.** I checked whether each
  mutation actually weakens the sanitizer before reporting it, because a green
  on a security no-op is the *correct* answer:

```
=== VERDICT PER MUTATION ===
  ADD_ATTR:[style]: SECURITY NO-OP (output identical on all 6 probes).
     -> suite staying green is CORRECT. NOT a guard gap.
  ALLOW_UNKNOWN_PROTOCOLS:true: WEAKENS the sanitizer on 1 probe(s): unknown proto href
     -> suite staying green IS a guard gap.
```

  `ADD_ATTR: ['style']` is inert because `FORBID_ATTR` wins — a genuinely good
  property of the current design, and had I not tested it I would have filed a
  false finding. `ALLOW_UNKNOWN_PROTOCOLS: true` really does change behaviour:
  `<a href="evilproto:payload">` survives where it is otherwise dropped.
  `javascript:`, `vbscript:` and `data:` remain blocked even under it, so this is
  not an XSS — the exposure is exotic scheme handlers (`intent:`, `ms-msdt:`,
  registered desktop protocol handlers).
- **Impact:** a security-relevant config weakening that ships green. Low, because
  the weakening itself is narrow.
- **Recommendation:** add one check pinning the URI policy:

```ts
check('unknown URL schemes are dropped', () => {
  assertNotContains(renderMarkdown('<a href="evilproto:payload">x</a>'), 'evilproto:',
    'unknown protocol survived — has ALLOW_UNKNOWN_PROTOCOLS been enabled?');
});
```

  Credit where due: **9 of 9 forbid-list deletions were caught individually.**
  Every entry in both lists is separately pinned. That is better than I expected
  and it is the single strongest thing the guard suite does.

### L3 [LOW] — unproxied external subresources leak viewer IP/UA
- **Location:** `web/src/util/markdown.ts:66-71` (no restriction on `img src`,
  `srcset`, or `background`)
- **BY EXECUTION** (vectors G7, G11, G12, G13):
```
[SURVIVES] G11  external img beacon
           real: "<p><img src=\"https://evil.example/track.png\" alt=\"x\"></p>\n"
[SURVIVES] G12  srcset beacon
           real: "<img src=\"a\" srcset=\"https://evil.example/t.png 1x\">"
[SURVIVES] G7   background attr url
           real: "<table background=\"https://evil.example/p.png\"><tbody>..."
[SURVIVES] G13  loading=eager
           real: "<img src=\"https://evil.example/t.png\" loading=\"eager\">"
```
- **Impact:** merely *opening* a mirrored GitHub task discloses the viewer's IP,
  User-Agent and view timestamp to any origin the issue author chooses — a read
  receipt and a coarse deanonymisation primitive against internal dashboard
  users. `loading="eager"` defeats lazy-loading as a partial mitigation.
- **Recommendation:** this is inherent to rendering markdown images and is
  properly fixed at the network layer, not in the sanitizer. GitHub solves it
  with the `camo` image proxy. Cheapest useful step here is a CSP
  `img-src 'self' data:` on the dashboard; failing that, route `img src` through
  a proxy in the renderer. Worth a tracked issue rather than a branch blocker.

### L4 [LOW] — presentational/behavioural attributes survive
- **Location:** `web/src/util/markdown.ts:40`
- **BY EXECUTION**, these all survive: `id`, `name`, `align`, `width`/`height`,
  `hidden`, `popover`, `draggable`, `tabindex`, `role`, `aria-*`.
```
[SURVIVES] G1  <p id="section-title">x</p>
[SURVIVES] G5  <img src="..." width="9999" height="9999">
[SURVIVES] G8  <p align="center">x</p>
[SURVIVES] G9  <p hidden="">x</p>
[SURVIVES] G10 <div popover="manual">x</div>
[SURVIVES] G20 <p role="button" aria-label="Approve">x</p>
```
- **Description:** the file forbids `class` with an explicit forgery rationale —
  "attacker-chosen class names resolve against real component CSS ... and can
  forge a comment header". That reasoning is sound but it stops one step short.
  `width="9999" height="9999"` disrupts layout, `hidden`/`popover` conceal
  content, and `role="button" aria-label="Approve"` forges *interactive* UI to
  assistive technology — all without `style` or `class`. Screen-reader users get
  the worst of it, and the file's own checkbox renderer depends on
  `role`/`aria-label` being trustworthy.
- **DOM clobbering specifically is NOT exploitable here (BY EXECUTION):**
```
$ grep -rn "getElementById\|querySelector('#\|querySelector(\"#\|getElementsByName" --include="*.ts" web/src
  (no matches)
```
  No id-based DOM lookup anywhere in the app, and no `#id` selectors in either
  sink's stylesheet, so surviving `id`/`name` clobber nothing.
- **Recommendation:** subsumed by M1's `ALLOWED_ATTR`. If M1 is deferred, add
  `'id'`, `'name'`, `'align'`, `'width'`, `'height'`, `'hidden'`, `'popover'`,
  `'draggable'`, `'tabindex'` to `FORBID_ATTR` — but note that this list is
  exactly the enumerate-the-bad treadmill M1 argues against, which is the point.

---

## 4. Info

**I1 — `data:` URI permitted on `img src`.** BY EXECUTION vector C7:
`![x](data:text/html,<script>...)` survives as
`<img src="data:text/html,%3Cscript%3E...">`. REASONED: not exploitable —
`<img>` decodes as an image, `text/html` simply fails to render, and SVG loaded
via `<img>` is a non-scripted resource document by spec in all engines. It also
makes no network request, so it is *less* exposing than L3. Noted only because
`data:` on `img` is a documented DOMPurify default (`DATA_URI_TAGS`) that a
reader of this file would not otherwise know is in effect.

**I2 — the forbid list is incomplete as a form-control policy.** BY EXECUTION,
`optgroup`, `datalist`, `label`, `fieldset`, `legend`, `output`, `progress` and
`meter` all survive while `form`/`input`/`button`/`select`/`textarea`/`option`/
`dialog` are stripped. All are inert without a form control, so there is no
current exposure. It is direct evidence for M1: eight hand-picked exclusions did
not manage to express "no form controls" completely, and no reviewer noticed
across five rounds.

---

## 5. The five disclosed survivors — is accepting them correct?

I did not re-test V25, R-eval, R-globalThis, R-newFunction or R-bareSpecifier as
findings. The question put to me was whether the *acceptance* is correct, and
specifically whether there is a route to V25's effect that does **not** require
commit access — with the dependency tree flagged as checked only at the direct
level.

**I checked the full transitive tree. The acceptance is correct.**

Scanner self-check first (bar 3): a decoy package containing the literal V25
construct is planted and must be found, or the scan aborts rather than report a
negative.

```
=== SCANNER SELF-CHECK (must FIND the planted V25 decoy) ===
  HIT .../decoy_modules/evil-pkg/index.js:4  Element.prototype.removeAttribute =
  HIT .../decoy_modules/evil-pkg/index.js:5  Node.prototype.removeChild =
  HIT .../decoy_modules/evil-pkg/index.js:4  prototype.removeAttribute =
  HIT .../decoy_modules/evil-pkg/index.js:5  prototype.removeChild =
  scanner found 4 hits in the decoy -> scanner is live.

=== FULL TRANSITIVE SCAN of /workspace/web/node_modules ===
total pattern hits: 34 across 2 packages

  nwsapi  (24 hits)
      nwsapi/src/nwsapi.js:1804  Element.prototype.closest =
      nwsapi/src/nwsapi.js:1810  Element.prototype.matches =
      nwsapi/src/nwsapi.js:1816  Element.prototype.querySelector =
      ... 18 more
  jsdom  (10 hits)
      jsdom/lib/jsdom/level3/xpath.js:1866  Document.prototype.createExpression =
      jsdom/lib/jsdom/living/generated/Attr.js:198  Object.defineProperties(Attr.prototype
      ... 4 more
```

154 packages in the lockfile. Exactly two patch DOM prototypes, and both are
**dev-only**:

```
$ node -e "... who depends on nwsapi ..."
node_modules/jsdom -> nwsapi | dev: true
node_modules/jsdom  dev=true version=26.1.0
node_modules/nwsapi dev=true version=2.2.24
```

`nwsapi` is jsdom's selector engine and is reachable *only* through jsdom.
Neither is in `dependencies`, so neither ships in the browser bundle. **No
runtime dependency — direct or transitive — patches a DOM prototype.** The
manager's spot-check of the direct dependencies holds at full depth. `npm audit`
is also clean (0 vulnerabilities of any severity).

So: **V25 requires commit access, and that adversary can equally edit the guard.
Accepting it is correct.** The same holds for R-eval, R-globalThis,
R-newFunction and R-bareSpecifier — all four require landing code in a scanned
file, which is the same adversary. Asserting the five stay green so the
disclosure cannot silently rot is the right mechanism.

**One qualification, and it is the useful part of this section.** The acceptance
rationale rests on a property of the dependency tree — "no runtime dep patches
DOM prototypes" — that is true today and **enforced by nothing**. A future
transitive dependency of `lit`, `shoelace`, `dagre`, `grpc-web` or `protobufjs`
could introduce one in a routine `npm update`, at which point V25's effect
becomes reachable without any commit to this repo, and the documented reason for
accepting V25 quietly stops being true. That is a supply-chain risk the
disclosure does not currently name.

**Recommendation:** promote the scan I wrote into CI. It is ~40 lines, runs in
seconds over `node_modules`, has a working self-check, and turns an unstated
assumption into a tested one. Salvaged at
`salvage/audit-195-r5-protoscan.mjs`. Scope it to production dependencies so
jsdom/nwsapi do not trip it.

---

## 6. The guard suite as a security control, and the amended claim

**Does the amended claim overstate what the guard delivers? No — and the
amendment is legitimate, not defining the problem down.**

The original criterion ("no mutation of the two `REQUIRED_SINKS` files can leave
them rendering unsanitized while the suite is green") is genuinely
unsatisfiable, and not for want of effort. The guard lives in a file the
postulated adversary can edit in the same commit. No amount of work on the guard
escapes that: it is a self-reference limitation, not a coverage gap. Amending a
criterion to exclude an adversary you cannot bind is sound; it would only be
"defining the problem down" if the excluded adversary were the one you actually
face, and it is not — the threat model here is an **attacker-supplied GitHub
issue body**, not a Farm Table committer. The amended claim excludes precisely
the adversary who is out of scope and keeps precisely the one who is in scope.

The docblock is also unusually honest in ways that cost its author something:
it states that the regex approach "is asking the wrong question", that
type-aware lint is the right answer, that the boundary is "rules can own a NAME,
they cannot own an EFFECT", and it prints V25's working exploit verbatim. That is
the costly disclosure this workstream says it trusts, and it should be read that
way.

I do have **two qualifications**:

1. **The compensating controls named in the claim do not exist yet.** The claim
   discharges the arbitrary-committer adversary onto "code review, CSP and
   Trusted Types". Code review exists. **CSP and Trusted Types do not** — the
   brief lists them as explicitly out of scope for this branch, and I confirmed
   there is no CSP anywhere in the web app. So the sentence is accurate about
   the guard but describes a defence-in-depth posture that is currently
   one-third built. That is not a reason to block this branch; it *is* a reason
   the CSP work should be scheduled rather than left as a rhetorical backstop in
   a docblock. Recommend landing a CSP with at least `script-src 'self'` and
   `img-src` restrictions (which also mitigates L3) as a tracked follow-up.

2. **The guard's real security value is narrower than the routing story, and
   better than advertised in one respect.** Five rounds went into proving the
   two sinks still *call* `renderMarkdown`. That is worth something, but the
   measurement in L2 shows the suite's most valuable property is one the
   docblock barely claims: **it pins the sanitizer configuration itself**, 9/9
   on individual forbid-list deletions. For a config whose every entry is a
   hand-reasoned special case (`dialog` for UA styling, `style` for the SVG
   namespace), that is the regression most likely to actually happen — far more
   likely than someone re-homing an import. I would state that in the docblock
   explicitly; right now it is an emergent property rather than a stated
   guarantee, which means a future refactor could drop it without anyone
   noticing it was load-bearing.

On the brief's invitation to say whether the whole static-scan approach should
have been #204 from the start: **yes, and the docblock already says so.** Given
that, rounds 3-5 spent adversarial effort extending a technique its own author
had documented as asking the wrong question, while the 71-line file that is the
actual XSS boundary went unreviewed since round 2. The manager's own read that
this was a misallocation of attention is correct. The remedy is not more work on
the guard — it is #204 and the Phase 2 effect-observing harness, both already
routed.

---

## Positive observations

- **No XSS.** 69 vectors plus 10 mXSS vectors, none reaching script execution.
  This is a real, well-built security boundary.
- **DOMPurify is at the latest published version (3.4.12) with zero advisories
  across 154 packages.** Lockfile committed, `npm ci` used in the gate.
- **The `<svg><style>` reasoning in the docblock is correct and load-bearing,
  verified BY EXECUTION.** HTML-namespace `<style>` is blocked by DOMPurify's
  defaults (F5, BLOCKED-BY-DEFAULTS) but SVG-namespace `<style>` is blocked
  *only* by the `FORBID_TAGS` entry (D1, BLOCKED-BY-CONFIG). Removing it is a
  live regression. The same entry also covers MathML `<mtext><style>` (D8),
  which the comment does not claim but does deliver.
- **`target` is stripped by DOMPurify's defaults** (G3), so reverse tabnabbing is
  not reachable even though `rel` survives.
- **Every entry in both forbid lists is individually pinned by a test** — 9/9
  deletions caught.
- **`FORBID_*` correctly takes precedence over `ADD_*`**, so the forbid lists
  remain effective as an independent second barrier. This validates the file's
  stated intent that "neither rule is load-bearing on its own".
- **The checkbox renderer is a clean design** — attacker influence is reduced to
  a single boolean selecting between two constant literals, and the accessibility
  state is preserved without letting a form control through.
- **The docblock discloses its own worst case with a working exploit.** Rare and
  correct.

## Recommendations (priority order)

1. **M1** — invert to `ALLOWED_TAGS`/`ALLOWED_ATTR`, keeping the forbid lists as
   a second barrier. Before this pattern reaches a third sink.
2. Add `'slot'` to `FORBID_ATTR` now (**L1**) — one word, zero collateral, closes
   a nesting-dependent invariant.
3. Add the unknown-protocol check (**L2**) and state the config-pinning property
   in the docblock as an intended guarantee.
4. Promote the prototype-patcher scan into CI over production deps — makes the
   V25 acceptance rationale a tested property instead of an assumption.
5. Tighten `"dompurify": "^3.0.0"` to `"^3.4.12"`.
6. Schedule the CSP work (**L3**, and the compensating control the amended claim
   already relies on).

## Reproduction

All harnesses carry fail-closed self-checks and are salvaged to
`/scion-volumes/scratchpad/projects/farmtable/salvage/`:

| file | what it does |
|---|---|
| `audit-195-r5-poc.mjs` | three-path differential over 69 vectors |
| `audit-195-r5-surface.mjs` | allow-list surface measurement, mXSS round-trip, checkbox probe |
| `audit-195-r5-protoscan.mjs` | transitive DOM-prototype-patcher scan with decoy self-check |
| `audit-195-r5-slotprobe.mjs` | slot-assignment probe with positive control |
| `audit-195-r5-greenprobe.mjs` | discriminates real guard gaps from security no-ops |
| `audit-195-r5-config-mutation.sh`, `audit-195-r5-addtags2.py` | config mutation drivers |
| `audit-195-r5-*-output.txt` | captured output for everything above |

Tree state after all mutation work: `git status --porcelain` empty, `HEAD`
`53296af`. No production code was modified.

---

*Audited by the security-audit leg, round 5. Independent — no other leg's report
was read.*
