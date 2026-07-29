# Salvage — #195 code-review leg, round 5 (SHA 53296af)

Runnable artefacts from the code-review leg. All were executed against
`web/` at 53296af with `npm ci` already run.

## `mutation-driver.sh`
Content-addressed mutation driver for `web/src/util/markdown.test.ts`.
Aborts if the anchor does not occur exactly once; restores via
`git checkout --`; asserts `git status --porcelain` empty AND byte-equality
against an out-of-repo backup at `/tmp/markdown.test.ts.bak`.
Usage: `cd web && /path/to/mutation-driver.sh "<label>" "<find>" "<replace>"`
Take the backup BEFORE the first run:
`cp web/src/util/markdown.test.ts /tmp/markdown.test.ts.bak`

## `probe-guard.sh`
Rebuilds an importable copy of the compiled guard (the test module exports
nothing) and drives `sinkBindingViolations` / `directiveIndirectionOffenders` /
`stripInertText` / `stripImportStatements` directly against a case matrix.
This is what found the `stripImportStatements` semicolon defect (F1).

## `probe-sanitizer.sh`
Runtime probes of `renderMarkdown` itself: private-Marked-instance isolation
in both directions, checkbox renderer output and attribute survival,
U+FE0E codepoint survival through DOMPurify + serialisation, and a residual
allowed-tag/attribute sweep.
