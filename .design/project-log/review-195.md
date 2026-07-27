# review-195 — independent code review of markdown sanitizer hardening (#195)

Branch: `markdown-sanitize`. Range reviewed: `7a0f220..204af7e`
(fix `25bab77`, docs `204af7e`).
Full review: `scratchpad/projects/farmtable/reports/review-195.md`.

## Verdict

**APPROVE**, with two Medium findings recommended for a cleanup commit on this
branch before merge. No Critical or High findings. The reported vulnerability is
genuinely fixed and the security posture is strictly better than base.

## What was verified independently

The developer's report was read but not ratified. Every load-bearing claim was
re-executed against the committed tree.

- `npm test` → 32/32 pass. `tsc --noEmit` and `tsc -p tsconfig.test.json` clean.
  `npm run build` reproduces the report's bundle hash. `npm audit` → 0 vulns.
  `go build ./...` clean.
- **Both mutations reproduced exactly**: reverting the `FORBID_*` config fails
  8/32; deleting `DOMPurify.sanitize` fails 20/32. Two further mutations were
  added by the reviewer (drop the checkbox renderer; make the renderer ignore
  `checked`) — each fails 2/32, confirming the new task-list assertions are
  load-bearing rather than incidentally satisfied.
- **Singleton → private `Marked` instance is safe.** `marked` has exactly one
  importer repo-wide and there is no `marked.use()`/`setOptions()` anywhere, so
  no existing caller can be affected. A 23-case markdown corpus was run through
  both the old and new pipelines: output is byte-identical except the five
  task-list cases.
- **Nothing attacker-controlled reaches the checkbox renderer.** marked calls
  `this.checkbox({ checked: !!item.checked })` (`marked.cjs:1519`); the token has
  no other field and the renderer returns one of two constants. The
  `Tokens.Checkbox` object signature is correct for marked 15 (it was a bare
  boolean in ≤11, which would have silently rendered every box unchecked).
- **Sanitizer config probed with 24 independent bypass payloads** — uppercase
  tags/attributes, SVG `foreignObject`, MathML `annotation-xml`, `contenteditable`,
  `ping`, `xlink:href`. 23 blocked.
- **Collateral-damage claim confirmed structurally, not by eye.** All 21 `style="`
  occurrences in `web/src` are inside Lit `html` templates and never transit
  `renderMarkdown`, so `FORBID_ATTR` cannot reach the Shoelace attributes. Both
  sinks are shadow-DOM `LitElement`s with no `createRenderRoot()` override, which
  also limits attacker `class` spoofing to each component's own styles.
- Untrusted-input provenance confirmed at `internal/platform/github/github.go:163`
  (`Description: issue.GetBody()`).

## Findings

- **M1 (Medium)** — `<dialog>` is missing from `FORBID_TAGS` and survives
  sanitization. Per the HTML Standard's default rendering, a non-modal `dialog` is
  `position: absolute` with an opaque `Canvas` background, so it reopens the
  overlay-spoofing primitive that forbidding `style` was explicitly added to close
  (`markdown.ts:13`). One-word fix, verified effective; add `optgroup` alongside
  for consistency with `option`.
- **M2 (Medium)** — the glyph substitution drops the AT semantics the `<input
  type=checkbox checked disabled>` carried. Regression introduced by this PR.
  Fixable with `role="img"` + `aria-label`, which was verified to survive the
  file's own DOMPurify config.
- **L1–L5 (Low)** — `@types/jsdom@28` vs `jsdom@29` major skew; `☑`/`☐` emoji-vs-text
  presentation and font-fallback (add U+FE0E); `action`/`formaction` are
  unreachable-by-construction redundancy and the comment should say so; `label`/
  `datalist`/`progress`/`meter` survive (cosmetic only); three raw-substring
  assertions are brittle.

## Two claims in the developer's report are wrong

An EM correction notice was appended to `dev-markdown-sanitize.md` mid-review.
It was not adopted on trust; both claims were re-derived with discriminating
experiments, and **both corrections hold**.

1. **mXSS mechanism mis-attributed.** The report says the `<img>` vanishes on
   re-parse because `innerHTML` foster-parents it out of existence.
   `<table><img src=1></table>` → `<img src="1"><table></table>` proves
   foster-parenting *relocates* rather than deletes. The real cause is that marked
   escapes the payload's trailing `">` into `&quot;&gt;`, leaving `<img title="`
   unterminated to EOF so the tokenizer discards the tag — the `<img>` still
   disappears with all MathML/table context removed, and reappears the moment the
   quote is terminated. **This strengthens the report's own recommendation**: the
   false-negative hazard is a general property of re-parsing truncated markup, not
   a MathML quirk, so it applies to every structural assertion in the suite.
2. **DOMPurify no-DOM failure mode overstated.** The report claims that without a
   DOM, DOMPurify degrades to a pass-through and every assertion would pass
   vacuously. It does not — the default export is the uninvoked factory, so
   `DOMPurify.sanitize(...)` throws `TypeError: DOMPurify.sanitize is not a
   function`. The failure is loud. The jsdom setup is still required; the hazard it
   is credited with averting did not exist.

The reviewer's own first draft repeated claim 1 uncritically before testing it.
Neither correction affects the fix or the tests — only the report's account of why
they work. The report should not circulate as reference material until struck.

## Informational

- `go test ./...` fails `TestWatchTasks_Heartbeat`
  (`internal/server/watch_test.go:398`) reproducibly at `-count=3`. This branch
  changes zero `.go` files, so it is pre-existing, but the Go suite is red at this
  tip regardless of merge.
- Source maps in `dist/` — known, pre-existing, tracked separately, explicitly out
  of scope for this review.
- Recommend filing the missing CSP (`form-action 'self'` would independently kill
  this bug class) and the source-map disclosure as their own owned issues.
