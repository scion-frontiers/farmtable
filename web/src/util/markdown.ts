import { Marked, type Tokens } from 'marked';
import DOMPurify from 'dompurify';

// Task descriptions and comment bodies are mirrored verbatim from third-party
// sources (see IssueToCreateParams in internal/platform/github), so the markdown
// reaching renderMarkdown is attacker-controlled. Interactive form controls are
// therefore stripped: a rendered <form action="https://evil.example"> with a
// password field is a working credential-phishing form on the dashboard's own
// origin. Both the tag and the attribute are forbidden so that neither rule is
// load-bearing on its own.
const FORBID_TAGS = ['form', 'input', 'button', 'select', 'textarea', 'option'];

// style: enables overlay and layout spoofing of the surrounding UI.
// formaction/action: redirect a submit to an attacker origin.
// download: lets a link rename attacker-hosted content to a trusted filename.
const FORBID_ATTR = ['style', 'formaction', 'action', 'download'];

// Task-list checkboxes are the only legitimate <input> in mirrored markdown, and
// FORBID_TAGS would strip them, leaving "- [x] done" indistinguishable from
// "- [ ] todo". Render them as inert glyphs so the state survives without
// allowing any form control past the sanitizer. A private Marked instance keeps
// this off the shared `marked` singleton.
const parser = new Marked({
  renderer: {
    checkbox: ({ checked }: Tokens.Checkbox): string =>
      `<span class="ft-task-checkbox">${checked ? '☑' : '☐'}</span>`,
  },
});

export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
  });
}
