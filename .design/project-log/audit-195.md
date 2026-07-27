# audit-195 — security audit of the markdown sanitizer hardening (#195)

Branch: `markdown-sanitize`. Range audited: `7a0f220..204af7e`
(fix `25bab77`, docs `204af7e`).

**Verdict: APPROVE.** 0 Critical, 0 High, 0 Medium, 3 Low, 4 Info. All three
Low findings are pre-existing conditions that this branch neither introduced
nor was scoped to fix.

## What was audited

Four questions, answered independently rather than by reading the
implementation report:

1. Is the `<form action>` phishing vector actually closed, including via
   mutation-XSS, namespace confusion, malformed markup, entity encoding, and
   markdown constructs that emit raw HTML?
2. Did the new `FORBID_TAGS`/`FORBID_ATTR` config reopen anything on the
   script-execution side? (Regression check.)
3. Is the jsdom devDependency legitimate, dev-only, and unable to reach the
   binary via `//go:embed all:web/dist`?
4. Can the new checkbox renderer be reached with attacker-controlled data?

## Method

Three harnesses were built against the real exported `renderMarkdown`
(compiled from source, not a replica), with `DOMPurify.isSupported` asserted
true — dompurify 3.4.12, marked 15.0.12, jsdom 29.1.1:

- **Bypass harness** — 110 payloads across 9 classes.
- **A/B differential** — a 117-payload corpus run through both the pre-change
  pipeline (verbatim from `7a0f220`) and the new one, comparing resulting
  tag/attribute/URL sets. This is the load-bearing evidence for question 2:
  it does not depend on the payload set being exhaustive, because it compares
  both configurations against identical inputs.
- **Context-reparse harness** — sanitized output re-parsed the way Lit's
  `unsafeHTML` actually does it (inside a `<template>`) as well as in a
  `<div>`, to catch mXSS from the parse-context change at the sink.

## Results

- **Phishing vector closed.** 110/110 payloads neutralized, zero form-control
  survivors. `<form>` inside SVG/MathML — including at the HTML integration
  points `foreignObject`, `desc`, `title`, `annotation-xml` — is removed;
  `FORBID_TAGS` matching is namespace-independent and case-folded. Sanitizing
  is a fixed point after one pass, so nothing is revived on reparse.
- **No script-execution regression.** A/B result: `corpus=117, identical=81,
  tighter=36, REGRESSIONS=0`. Not one payload produced a tag, attribute, or
  URL under the new pipeline absent from the old. Every difference is a
  removal, and all 36 are the intended ones.
- **Belt-and-braces verified, not assumed.** `action` survives the old
  pipeline and is removed by the new, so forbidding both tag and attribute is
  genuinely non-redundant. `formaction` is confirmed redundant (DOMPurify
  strips it by default), as the implementation report stated.
- **Supply chain clean.** jsdom 29.1.1 and @types/jsdom 28.0.3 both exist and
  are authentic. The 28-vs-29 mismatch is unavoidable — no @types/jsdom 29/30
  exists, jsdom ships no bundled types, and types are erased at compile time.
  All 43 added lock entries are `"dev": true`, resolve to registry.npmjs.org
  over HTTPS, carry sha512 hashes that byte-match the live registry, and
  declare no install scripts (which matters, since `make web` runs `npm ci`).
  Verified by building: 276 sources in the production sourcemap, zero matching
  `/\.test\./` or `/jsdom/`. The one `JSDOM` string in `dist` is a code comment
  inside dompurify's own bundled source, not the jsdom package.
- **Checkbox renderer is safe.** `marked.cjs:1519` calls
  `this.checkbox({ checked: !!item.checked })` — the `!!` coercion happens in
  marked before the override runs, so the renderer admits exactly two constant
  outputs. Probed across 10 task-list shapes including a task item whose body
  is a phishing form. Smuggling is impossible for a second reason too: the
  renderer runs before DOMPurify.

## Findings carried forward (none block merge)

- **LOW-1 — `class` reuse UI spoofing.** `class` is not forbidden, and both
  sinks inject inside the Lit shadow root carrying the component's own CSS, so
  attacker-chosen class names resolve against real component styles. A forged
  comment header with fake author and timestamp round-trips byte-identically.
  Pre-existing (identical under the old pipeline) and Low because there is no
  in-page credential capture. This is the residual half of the spoofing
  surface that removing `style` did not cover. Track separately.
- **LOW-2 — no Content-Security-Policy.** `form-action 'self'` would have made
  this entire bug class structurally impossible regardless of sanitizer
  config. Highest-value follow-up. Belongs with deploy config.
- **LOW-3 — 2.47 MB production source map.** Pre-existing, owned elsewhere,
  explicitly out of scope here and deliberately not fixed on this branch.
  Concur with Low severity. Confirmed this branch does not worsen it.
- **INFO** — brittle substring assertions in the suite; no pinned foreign-
  content or malformed-markup cases (worth adding before the next dompurify or
  marked major bump); checkbox output is injected pre-escaped in marked's
  loose-list path so the renderer must never interpolate token data;
  `FORBID_*` arrays could be frozen.

## Noted as good practice

The change fixes the right defect — it treats this as phishing rather than
XSS. Substituting the checkbox glyph in marked instead of relaxing
`FORBID_TAGS` behind a DOMPurify hook keeps the allowlist un-widened, which is
why the task-list checks correctly did not fail under the config-revert
mutation. Using `new Marked({...})` avoids mutating the shared singleton.
Mutation testing was genuinely performed, and the report correctly identified
that the mXSS case passes a DOM-query assertion even when unsanitized because
foster-parenting removes the `<img>` on reparse — the dual raw-string plus
structural assertion is the right response and should not be simplified. The
source-map gate failure was disclosed rather than quietly passed.

## Limitation on the guarantee

Tests run under jsdom, so they pin jsdom's parser behaviour, not Chromium's,
and mXSS is parser-specific. This matches the original audit and the repo has
no browser test harness, so it is acceptable — but it bounds the strength of
the mXSS guarantee and should be stated wherever that guarantee is relied on.

Full report: `reports/audit-195.md` (scratchpad).
