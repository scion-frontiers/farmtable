# 2026-07-29 — F4: pinning the two stored-content XSS render sinks

Leg: `test-xss-r8` (test/QA). Track: `farmtable-em-hardening`.
Validated at `901670e` (`url-scheme-validation-r8`). Delivery target: r9's union branch.

## What this adds

`web/src/components/inspector/render-sink-xss.test.ts` — seven named tests pinning the two
places in `web/src` that push server-supplied text through `unsafeHTML`:

- `ft-inspector-desc.ts:233` — `${unsafeHTML(renderMarkdown(this.description))}`
- `ft-inspector-comments.ts:221` — `${unsafeHTML(renderMarkdown(c.body))}`

Both route through `renderMarkdown`, which is one line — `DOMPurify.sanitize(marked.parse(md))`
in `web/src/util/markdown.ts:5`.

`web/scripts/run-tests.mjs` — `EXPECTED_ASSERTIONS` 380 → 417, in this commit, as that file
requires.

## Why it matters more than the eight preceding rounds of `href` work

Measured at `faf1c8c` (main), independently re-confirmed by EM-hardening:

- **There is no Content-Security-Policy anywhere in this repository.** Zero occurrences across
  `.go`/`.ts`/`.html`/`.yaml`, and no `<meta>` CSP in `web/index.html`. Positive control: the same
  sweep finds `Header().Set` at ten-plus sites, so the zero discriminates.
- The dashboard is served by `serverapp.UnifiedHandler` → `internal/serverapp/unified.go:101`,
  a bare `http.FileServer` that sets no headers. The only response header set anywhere in the
  serving path is `Content-Type: application/json` at `internal/serverapp/session.go:286`.
- IAP does not cover this. IAP authenticates the **request**; it does nothing about a script that
  a legitimate, authenticated user's own browser executes from content another user stored.

So that one line is the only control, and nothing was asserting on it.

## The state of the control itself: correct today

Measured against the production chain with a real DOM, 20 attack vectors:

| arm | real bypasses |
|---|---|
| production — `sanitize(parse(md))` | **0 / 20** |
| sanitiser removed | **15 / 20** |
| order reversed — `parse(sanitize(md))` | 2 / 20 |

Ordering is correct as written, and it is load-bearing: reversed, `[click](javascript:alert(1))`
renders a live `href="javascript:alert(1)"`, because sanitising the markdown *source* leaves it as
plain text for `marked` to build an anchor from afterwards.

`DOMPurify.sanitize` is called with no config object, i.e. defaults, which strip `script`/`iframe`/
`base`, every event-handler attribute, and `javascript:`/`data:` URIs in `href`.

**The finding is not "a live vector". It is: the control is correct, it is the only one, and
nothing would have gone red if someone deleted it.** These tests are that missing red.

## Mutation evidence

Every assertion added here is killed by a named mutation. Fixed N=2 per arm, interleaved by round,
no arm re-run to agreement, both rounds identical.

| arm | mutation | result | tests turned red |
|---|---|---|---|
| baseline | none | GREEN ×2 | — |
| M-A | `sanitize` call removed | RED ×2 | vector sweep, order pin, **both sink tests** |
| M-B | config bypass: `ADD_TAGS:['script']`, `ADD_ATTR:['onerror','onload']` | RED ×2 | vector sweep, **both sink tests** |
| M-C | order reversed | RED ×2 | vector sweep, order pin |
| M-D | **no-op refactor** (extract local, same semantics) | **GREEN ×2** | — (negative control) |
| M-E | `ALLOWED_TAGS: []` — strips everything | RED ×2 | benign-preservation, both sink tests |
| M-F | sink 1 rewritten to `unsafeHTML(this.description)` | RED ×2 | desc sink, locality pin |
| M-G | jsdom global setup deleted | RED ×2 | 6 of 7 |

M-D is the control that matters: it proves the reds above are caused by the semantic change and
not by the file having been touched.

## Two defects this work found in itself

1. **The first oracle was a regex** over the sanitised HTML. It reported three "leaks" against the
   correct production chain — a `<form>` whose `action` had already been stripped, a CSS
   `url(javascript:…)` that no current browser executes, and the word `onerror` sitting in a text
   node. All three were false, and all three pointed the same way: alarm on correct code. The
   assertions now parse the output and ask the DOM what is an attribute, what is an element and
   what is text. **Grep is not an oracle.**

2. **The locality pin was vacuous, and mutation arm M-F is what proved it.** It asserted
   `includes('unsafeHTML') && includes('renderMarkdown')`. Rewriting the sink to
   `unsafeHTML(this.description)` left the now-unused `renderMarkdown` import in the emitted file,
   so both substrings were still present and the assertion stayed green while the sink was
   unsanitised. It now asserts the composition `unsafeHTML(renderMarkdown(`, and additionally
   enumerates the component tree so that a *third* `unsafeHTML` call site fails rather than
   passing unnoticed.

## Note for whoever adds the next web test

The test program is not the typecheck program. `npm run typecheck` compiles all of `src/`, so it
picks up Shoelace's `HTMLElementTagNameMap` augmentation via `src/index.ts`. `tsconfig.test.json`
compiles only the transitive closure of `*.test.ts`, so importing a component into a test can fail
with `TS2339` on a file the test does not touch. Fixed here with a type-only import of the
Shoelace declaration; the alternative — importing the real component — would drag Shoelace into
jsdom.

## Not done, deliberately

No fix is included. No CSP is added. Both are separate scoped work.

**CSP sizing, requested by EM-hardening:** the app has exactly one inline `<script>` — a
theme-flash IIFE at `web/index.html:17–28` — and no `eval`/`new Function` in our source or in any
shipped runtime dependency. So a `script-src` strict enough to mitigate this sink is small: hash
or nonce that one block, or move it to a module. `style-src` is the messier half — one inline
`<style>` block plus ~20 inline `style=` attributes in lit templates — but `style-src` is not what
mitigates a script sink, and the two can be scoped separately.
