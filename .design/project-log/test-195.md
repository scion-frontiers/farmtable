# test-195 — independent test review of the markdown sanitizer suite (#195)

Branch: `markdown-sanitize`. Range reviewed: `7a0f220..204af7e`.
Reviewer: test-engineer. Full report:
`/scion-volumes/scratchpad/projects/farmtable/reports/test-195.md`.

## Verdict

**APPROVE.** No blocking defect. `web/src/util/markdown.test.ts` (32 checks) is a
genuine regression pin on the real security boundary.

## What was verified

**Self-built oracle — absent.** The suite imports the real exported
`renderMarkdown` via `await import('./markdown.js')` and never mentions `marked`
or `dompurify` outside comments. Confirmed against the compiled artifact, and
behaviourally: mutating `markdown.ts` changes the result, which a re-implemented
oracle could not do.

**DOMPurify binding — live.** Under the test's ordering, `isSupported = true` and
`renderMarkdown('<script>alert(1)</script>') === ''`. Verified the negative too by
inverting the ordering in the compiled test: it crashes on the first check rather
than passing.

**Mutations — reproduced exactly.** Mutation 1 (drop `FORBID_*`) → 8 of 32 failed.
Mutation 2 (drop `DOMPurify.sanitize`) → 20 of 32 failed. Both match the
developer's reported counts and failure text line for line. Source restored, tree
clean, baseline re-verified. `tsc --noEmit` and `tsc -p tsconfig.test.json
--noEmit` clean; `npm audit` 0 vulnerabilities.

## Two corrections to the developer's report

1. **DOMPurify's no-DOM failure mode is a crash, not a silent pass-through.** On
   the pinned dompurify 3.4.12 the unsupported path early-returns from the factory
   before `sanitize` is assigned, so a mis-ordered test throws `TypeError:
   DOMPurify.sanitize is not a function`. The "32 vacuously passing assertions"
   scenario is not reachable. The mitigation is still correct; the stated reason
   overstates the risk.

2. **The mXSS `<img>` disappears because of an unterminated attribute value, not
   foster-parenting.** Foster-parenting relocates nodes (verified: a plain `img`
   inside `math/mtext/table` survives as `MGLYPH IMG TABLE`); it does not delete
   them. Stripping all MathML context and leaving just the two `<img>` tags still
   yields `img=null`, and terminating the `title="` quote makes the `img`
   reappear. The developer's *conclusion* — that a DOM-query-only test reports the
   unsanitized payload as clean, so both structural and raw-string assertions are
   needed — is correct and was reproduced. But the hazard is general to any
   truncated markup re-parse, not a MathML quirk, so it applies to every
   structural assertion in the suite.

## Coverage gaps recorded (no live vulnerability found; all probed empirically)

- **High** — Nothing binds the two `unsafeHTML` sinks to `renderMarkdown`. Both
  are correct today, but dropping the wrapper at `ft-inspector-desc.ts:233` or
  `ft-inspector-comments.ts:221` reintroduces the bug class with all 32 checks
  green.
- **High** — Zero SVG coverage. `<svg>` passes the allowlist intact; `animate`,
  `set`, `foreignObject` and `xlink:href` vectors are neutralised today but
  unpinned.
- **Medium** — `FORBID_TAGS` case-normalisation unpinned; raw-HTML
  `javascript:`/`vbscript:`/`data:image/svg+xml` hrefs untested (only the markdown
  link path is covered); nil input throws (`marked(): input parameter is undefined
  or null`) and only `''` is tested.
- **Low** — Two checks are DOM-query-only with no raw-string backstop; the check
  total (32) is not asserted, so deleting a check passes silently; `srcset`
  untested; jsdom is not Chromium.

## Out of scope

`find dist -name '*.map' | wc -l` returns 1. Pre-existing on `origin/main`,
tracked separately, not a defect of this branch.
