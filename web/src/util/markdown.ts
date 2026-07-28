import { Marked, type Tokens } from 'marked';
import DOMPurify from 'dompurify';

// Task descriptions and comment bodies are mirrored verbatim from third-party
// sources (see IssueToCreateParams in internal/platform/github), so the markdown
// reaching renderMarkdown is attacker-controlled. Interactive form controls are
// therefore stripped: a rendered <form action="https://evil.example"> with a
// password field is a working credential-phishing form on the dashboard's own
// origin. Both the tag and the attribute are forbidden so that neither rule is
// load-bearing on its own.
//
// dialog is not a form control. It is here because the HTML Standard's default
// rendering gives a non-modal <dialog> `position: absolute` with an opaque
// `background-color: Canvas` — an absolutely-positioned opaque overlay obtained
// with no style attribute at all, which is exactly what forbidding style below
// is meant to deny.
//
// style is not a form control either. DOMPurify strips <style> in the HTML
// namespace by default but allows it in the SVG one, so `<svg><style>` passes
// arbitrary CSS straight into the shadow root that both sinks render into. That
// is strictly more powerful than the inline style attribute forbidden below —
// arbitrary rules rather than one element's — and `@import url(...)` and
// `url()` in an attribute-selector rule also reach an attacker origin with no
// user interaction. Forbidding the tag covers both namespaces; markdown never
// emits <style>, so there is no collateral.
const FORBID_TAGS = [
  'form', 'input', 'button', 'select', 'textarea', 'option', 'dialog', 'style',
];

// style: enables overlay and layout spoofing of the surrounding UI.
// class: both sinks inject this HTML inside the Lit shadow root that carries the
//   component's own stylesheet, so attacker-chosen class names resolve against
//   real component CSS (.comment, .comment-header, .comment-author, ...) and can
//   forge a comment header with no inline style. Nothing in this pipeline needs
//   class: no stylesheet consumes marked's language-* and the repo has no syntax
//   highlighter, so it is dead weight here and a forgery primitive for an
//   attacker.
// formaction/action: redirect a submit to an attacker origin.
// download: lets a link rename attacker-hosted content to a trusted filename.
// slot: not exploitable today — slot assignment considers only the DIRECT
//   children of the shadow host, and both sinks render the markdown two levels
//   deeper (inside <sl-details>), so an attacker-chosen slot name currently
//   matches nothing. It is forbidden anyway because that is an invariant of the
//   surrounding template's nesting, not of this sanitizer: flatten the markup by
//   one level in either component and `slot="…"` becomes a way to project
//   attacker content into a named slot of the host's own UI. Forbidding it
//   converts a nesting-dependent property into an unconditional one at zero
//   cost — markdown never emits slot. Same argument as class above.
const FORBID_ATTR = ['style', 'class', 'formaction', 'action', 'download', 'slot'];

// Task-list checkboxes are the only legitimate <input> in mirrored markdown, and
// FORBID_TAGS would strip them, leaving "- [x] done" indistinguishable from
// "- [ ] todo". Render them as inert glyphs so the state survives without
// allowing any form control past the sanitizer.
//
// role/aria-label carry the checked state that the real <input type=checkbox>
// announced to assistive technology; both survive FORBID_ATTR. U+FE0E
// (VARIATION SELECTOR-15) forces text presentation so the two glyphs render
// consistently — without it U+2611 can come out as a colour emoji beside U+2610
// as a thin outline (or as tofu on font stacks that lack it). It is written as
// an escape rather than the literal character because the literal is invisible
// in source and would be trivially deleted by accident. No class is set:
// FORBID_ATTR strips class, and nothing styles these glyphs.
//
// A private Marked instance keeps this off the shared `marked` singleton. That
// is a security property and it now has a pin that observes it BY EFFECT rather
// than by name: `sanitizerIndependence` in markdown.test.ts calls `marked.use`
// with a malicious checkbox renderer on the shared singleton and asserts this
// function's output is unaffected. Swapping `new Marked({…})` for
// `marked.use({…})` was green at 69 checks before that pin existed.
const parser = new Marked({
  renderer: {
    checkbox: ({ checked }: Tokens.Checkbox): string =>
      checked
        ? '<span role="img" aria-label="Completed">☑\uFE0E</span>'
        : '<span role="img" aria-label="Not completed">☐\uFE0E</span>',
  },
});

// THIS FUNCTION TAKES EXACTLY ONE PARAMETER, AND THAT IS A SECURITY PROPERTY,
// not a style preference. A second parameter is a configuration channel into the
// sanitizer opened from the call site: `renderMarkdown(body, { inline: true })`
// reads as an ordinary feature and can reopen the whole bug class from a sink
// file without renaming anything. If a variant renderer is genuinely needed,
// export a second named function that also ends in a DOMPurify.sanitize call and
// add it to the guard, rather than making this one configurable.
//
// WHAT ACTUALLY PINS IT, stated narrowly because the previous wording here was
// measured and found false. It said the arity was pinned "from both ends —
// behaviourally via `renderMarkdown.length` and by reading this declaration",
// and round 6's review and test legs independently defeated both ends with one
// natural spelling. `Function.length` stops counting at the first defaulted
// parameter, so `(md, opts = {})` still reports 1; the declaration scan used
// `.exec`, which stops at the first match, so an overload signature — or merely
// a COMMENT above this line quoting the old signature — satisfied it while the
// implementation took a second parameter. Both were green at 69/69.
//
// The pin is now:
//   * `renderMarkdownArityViolation` in markdown.test.ts reads THIS FILE over a
//     comment-and-string-blanked view, requires exactly ONE declaration to
//     match, and counts TOP-LEVEL parameters. That is the load-bearing half, and
//     it is fixtured against every spelling above.
//   * `sinkArgumentIsSanitized` rejects a top-level comma in the sanitizer's own
//     argument list, so a second argument at either enumerated sink is caught
//     independently of anything in this file.
//   * `renderMarkdown.length === 1` covers only SOURCE/ARTIFACT DIVERGENCE — a
//     stale build, a bundler transform, a re-export from another module. There
//     is no measured arity SPELLING for which it is the falsifier: a required
//     second parameter is rejected by `tsc` before the suite runs, and every
//     form that survives `tsc` leaves `.length` at 1 by definition.
//
// Non-string input returns '' instead of throwing. This is DEFENCE IN DEPTH FOR
// A FUTURE THIRD CALLER, not a fix for a live outage — the previous wording here
// claimed the latter and neither call site can reach it:
//   * ft-inspector-comments.ts passes `c.body`, which `stringField()` at
//     gen/grpc-client.ts:660-662 has already coerced to a string at the wire
//     boundary;
//   * ft-inspector-desc.ts passes `this.description` below an
//     `if (!this.description)` early return at ft-inspector-desc.ts:209.
// It is kept anyway because it is one line at a security boundary, TS types are
// erased at runtime, the data is wire-sourced, and a throw inside a Lit
// `render()` takes down the whole component rather than the one field. The
// trade-off, on the record: a future caller passing `42` or `{}` now gets a
// blank field instead of a throw, which is harder to diagnose. '' cannot carry a
// payload, and every non-empty string still goes through the sanitizer.
export function renderMarkdown(md: string): string {
  if (typeof md !== 'string') return '';
  return DOMPurify.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
  });
}
