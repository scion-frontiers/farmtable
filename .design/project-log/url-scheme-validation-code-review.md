# URL Scheme Validation — Code Review (review-xss-r1)

Date: 2026-07-28
Branch: `url-scheme-validation`
Reviewed commit: `d4c4e6b629ade1d0725bc303c0acf962838f03c9`
Base: `7a0f220`
Axis: diff and structure (correctness, readability, architecture, abstractions)
Verdict: **REQUEST CHANGES** — 1 Critical, 4 Required. Risk: HIGH.

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r1.md`

One of three independent legs on this commit (test-engineering and security-audit legs ran in
parallel, unseen by this one).

## Summary

The security rule is sound. I probed the scheme logic on both sides and could not break it. Every
blocking finding is in the scaffolding around the rule: the dependency set, the scanner's regex, the
scanner's oracle, a comment used as a control, and the test runner.

## Blocking findings

**C1 (Critical). The branch breaks `make web` and `make dashboard` on a clean checkout.**
`safe-url.test.ts` imports `jsdom`; both new test files import `node:fs`/`node:path`/`node:url`.
Neither `jsdom`, `@types/jsdom` nor `@types/node` is in `web/package.json` or `web/package-lock.json`
(`npm ls` reports jsdom and ~40 transitive packages as `extraneous`). `web/tsconfig.json` has
`"include": ["src"]`, so `tsc --noEmit` — the first half of `npm run build` — compiles the test files.
Measured with a paired control in fresh temp clones: at base, `npm ci` → `tsc --noEmit` → `npm test`
all exit 0; on the branch, `npm ci` exits 0 and both `tsc --noEmit` and `npm test` exit **2**.

**R1 (Required). The tree-wide scanner misses the quoted Lit binding `href="${...}"`.**
`/\b(?:href|src)\s*=\s*\$\{/` requires `${` to follow `=` immediately. Measured in-tree with a paired
control: a probe file with `href="${u}"` passes `npm test` (exit 0); the same file with `href=${u}`
fails (exit 1). All seven positive fixtures are unquoted, so the oracle was written from the same
mental model as the pattern and confirms it rather than tests it. Also missed: `srcdoc`, `action`,
`formaction`, `poster`, `object data`, `srcset`, `setAttribute('href', …)`, `el['href'] =`,
`window.open`, `location.assign`.

**R2 (Required). The scanner's `viaSafeHref` oracle checks an import, not a dataflow.**
It asserts only that the file contains the `safe-url.js` import string, while claiming the entry
"cannot be a rubber stamp." Measured: replacing `const href = safeHref(url)` with
`const href = url` in `ft-inspector-code.ts` leaves the allow-listed binding line byte-identical and
the import present; `npm test` exits 0 and `tsc --noEmit` exits 0 (`noUnusedLocals` is off). The
scanner pins the binding line but nothing pins the provenance of the value bound.

**R3 (Required). `urlBearingRemoteDataKeys` is kept in sync with `convert.go` by a comment.**
The list is correct today (convert.go reads `platform`, `remote_id`, `remote_url`; only the last is
URL-typed). Drift means an unguarded URL reaching an `href`, with no test failing. `convert.go:324`
also ships the whole untyped map to the client, including an `html_url` key written by the GitHub
adapter — no live gap, but the Go constant's safety currently rests on an unrecorded fact about the
web tree.

**R4 (Required). The `npm test` chain and `tsconfig.test.json` include list fail silently.**
Adding a test file and forgetting `tsconfig.test.json` fails loudly; forgetting `package.json` means
it compiles and never runs. The `&&` chain is also fail-fast with the security scanner **last**, so
any unrelated test failure means the chokepoint does not run at all.

## Claims verified TRUE (recorded because a green control is a finding)

`Attachment.url` is genuinely dead (proto-only, no Ent schema, no renderer). Four gRPC registration
sites, exactly one without interceptors. Platform-sync `remote_url` comes from `githubv4.URI` and is
not client-controlled. `urlBearingRemoteDataKeys` is correct at this commit. Empty-means-unset is
correct. `ft-toolbar.ts:460-465` is a GitHub-repo regex plus a literal prefix, not a reusable guard.
Exactly four `uri`-constrained proto fields, and no ingress outside `UpdateTask` and
`ImportCollection`. The `remote_url` guard cannot be skipped. Sweep denominator 51 is exact.

## Non-blocking, but worth carrying forward

- **The "client and server agree exactly" docblock is measurably false.** `"https://exa\tmple.com"`
  is rejected by Go (control-character filter) and accepted by `safeHref` (WHATWG strips the tab).
  Safe direction, but nothing detects real drift between the two allow-lists — they are two literals
  in two languages joined by prose.
- **What actually makes the two-implementation design safe is composition, not parser agreement.**
  A value reaches an `href` only if both allow-lists accept it, so drift costs a feature or is
  unreachable, never a breach. That argument holds for the whole input space; the report's
  "the allow-list makes the parsers agree on the outcome" does not.
- **The frontend got a chokepoint; the Go side got a checklist.** The real write boundary is the
  store, which platform sync reaches directly, below the guard. The placement decision is right; the
  stated reason (an interceptor would have missed the CLI pass-through) does not carry the weight —
  the pass-through store never touches `RemoteData` or `AddPullRequests`, so that path could not
  persist these fields anyway.
- A second `internal/server` flake exists beyond `TestWatchTasks*`: `rbac_test.go:767` "database
  table is locked". Pre-existing.

## Ship-alone recommendation

Ship **together** with the Makefile track, once C1/R1/R2 are fixed. `web/package.json` needs edits
from both tracks; R1 and R2 are far cheaper to fix before the scanner becomes a trusted CI gate than
after; and landing alone leaves the other track debugging a red `make web`. If shipped alone anyway,
C1 is still mandatory and the docs must describe the scanner as *staged* rather than active — a
control documented as live but invoked by nothing is a trap for the next reviewer.

## Recurring failure mode, still recurring

This project's standing defect is a docblock's account of what a line is for, believed instead of
measured. Three separate instances in this change: the scanner's `viaSafeHref` docblock ("cannot be a
rubber stamp" — it can), `safe-url.ts`'s "client and server agree exactly" (they do not), and
`urlvalidate.go`'s "keep in sync with convert.go" (nothing does). Each is a comment standing where a
control should be. Notably the same change also contains the best counter-example in the tree —
`safe-url.test.ts:143-153`, a negative assertion with a positive control wrapped around it — sixty
lines from the oracle that lacks one.
