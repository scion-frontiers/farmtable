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
const FORBID_ATTR = ['style', 'class', 'formaction', 'action', 'download'];

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
// A private Marked instance keeps this off the shared `marked` singleton.
const parser = new Marked({
  renderer: {
    checkbox: ({ checked }: Tokens.Checkbox): string =>
      checked
        ? '<span role="img" aria-label="Completed">☑\uFE0E</span>'
        : '<span role="img" aria-label="Not completed">☐\uFE0E</span>',
  },
});

export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
  });
}
