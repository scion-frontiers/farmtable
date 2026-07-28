# markdown-sanitize round 9 — independent security audit, issue #195

Branch `markdown-sanitize-r9` at `13680c2`. Audit axis: **not** whether the guard is
correct — what the guard actually prevents in production.

Full report, with every measurement and script:
`/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r9.md`.

**Verdict: REQUEST CHANGES.** Round 9's diff is safe and I say so — it is test code plus
two comment corrections, and I tried and failed to falsify "round 9 introduced no runtime
risk." What I am blocking is closing #195 on the strength of a green suite.

## Baseline reproduced

`npm test` exit 0, **79 checks / 127 assertions**. `markdown.ts` is comment-only across
`3f6a695..13680c2` — verified with a stronger oracle than a diff filter: md5 of the file
with all comments and blank lines removed is `8339b6e052fe6808103bdc6a46dfdb12` at both
revisions, 22 executable lines each.

## The two findings that decide the verdict

**F1 (HIGH) — no path in this repository runs the guard.** Not just "no CI." Measured:
`Makefile:9` `test:` is `go test ./...` and does not run `npm test`; `Makefile:16` `web:`
is `npm ci && npm run build`, so `make dashboard` compiles and embeds the dashboard
without the guard ever executing; `web/package.json`'s `build` script has no test;
`CLAUDE.md`, `README.md` and `docs/architecture.md` document `go test ./...` only. Zero
workflow files, zero non-sample git hooks. **4,610 lines of guard run only when a human
types `cd web && npm test`, a command that appears nowhere in the repository.**
Owner: the build/release maintainer, not the #195 developer.

**F2 (HIGH) — two live sinks the guard cannot see.**
`ft-inspector-meta.ts:611` `href=${t.remoteUrl}` and `ft-inspector-code.ts:106`
`href=${pr.url}` take attacker-controlled data with no validation anywhere. Measured:
Lit writes the value verbatim (rendered a `javascript:` URI under JSDOM and read the
attribute back — verbatim, no sanitizer configured); protovalidate is never instantiated
in the Go tree, so the `(buf.validate.field).string.uri` annotations on
`proto/farmtable.proto:343` and `:265` are decoration; `server.go:654-661` and
`export_import.go:739` write the raw string. `BANNED_SINKS`
(`markdown.test.ts:2462-2479`) has eight patterns and none concerns a URL-bearing
attribute.

Mutation matrix, content-addressed harness, tree clean before and after, exit codes from
the child process. Predicted all four before running; 4/4 correct:

| id | mutation | result |
|---|---|---|
| M1 | `<a href=${this.description}>` in a REQUIRED_SINKS file | **GREEN 79/127**, tsc 0 |
| M3 | `<a href=${this.heading}>` in a non-sink component | **GREEN 79/127**, tsc 0 |
| M2 | positive control, `.innerHTML =` in the *same* non-sink component | **RED, 1 of 79**, correct attribution |
| M4 | `DOMParser().parseFromString` + `adoptNode`, non-sink component | **GREEN 79/127**, tsc 0 |

M2 is what makes M1/M3/M4 evidence rather than a broken harness.

Both anchors carry `target="_blank"`, which very likely blocks `javascript:` execution
in real engines — **I could not measure that; JSDOM has no navigation, and the finding
does not depend on it.** The point is that the mitigation is incidental and unpinned,
which is exactly the argument `markdown.ts:40-48` makes for forbidding `slot`.

## Also filed

- **F3 (MEDIUM)** — deny-list policy. Measured: DOMPurify 3.4.12's defaults allow 222 tags
  and 367 attributes; `FORBID_TAGS`/`FORBID_ATTR` subtract 8 and 6. Measured markdown's
  real output vocabulary over a full CommonMark+GFM corpus: **27 tags, 6 attributes**.
  ~8× the tags and ~60× the attributes the feature needs. 14 distinct non-markdown tags
  survived a 35-payload corpus. Collateral of inverting to an allow-list is measurably
  zero. Nothing in the 79 checks asserts "nothing outside the markdown vocabulary
  survives," so a DOMPurify default-list change inside `^3` ships unobserved.
- **F4 (MEDIUM)** — `BANNED_SINKS` is a closed enumeration (M4).
- **F5 (MEDIUM)** — no CSP anywhere, on an origin that shares a port with the gRPC-web API
  and holds `localStorage['farmtable.token']`. `renderMarkdown` is not one layer of
  defence; it is the only one.
- **F6 (LOW)** — `web/dist` is gitignored but embedded by `assets.go`; the artifact path
  has no gate.
- **F7 (INFO)** — adjacent, surfaced for the manager to route: `FARMTABLE_OPEN_ACCESS=1`
  fails open through every scope gate; default bind is 0.0.0.0 while the CLI prints
  `localhost`; gRPC-web CORS accepts all origins; `scopes.go:83` treats empty scopes as
  wildcard; and protovalidate is inert schema-wide, not just for the two URL fields.

## What round 9 got right, measured independently

The private-DOMPurify fix is complete, and more complete than the brief assumed.
`setConfig` and `addHook` are **per-instance**, not process-global: poisoning the
singleton with `ADD_TAGS: ['script'], ADD_ATTR: ['onerror']`, installing an
`afterSanitizeElements` hook on it, and calling `setConfig` on a second private instance
all leave `renderMarkdown`'s output unchanged, while the singleton itself returns
`<img src="x" onerror="alert(1)"><script>alert(2)</script>`. The module exports only
`renderMarkdown`; the instance is unreachable by name.

Zero script-execution primitives survived 35 hostile payloads. Three in-tree rationales
reproduced by ablation against a scratch purifier without touching the tree:
`<svg><style>` passes when `style` is not forbidden (HTML-namespace `<style>` does not),
`<dialog>` passes when not forbidden, `class` passes when not forbidden. Every entry in
both lists is load-bearing and the comments explaining why are accurate.
`npm audit`: 0 vulnerabilities, 154 packages, lockfile committed, `npm ci` on the build
path.

## Where this brief was wrong

Four substantive errors, reported as a required deliverable:

1. "`setConfig` and `addHook` are process-global by nature" — **false**, measured above.
   The surface the brief sent me to audit is closed.
2. "There is no CI" — true but materially under-stated; it points at the wrong fix. See F1.
3. "markdown rendered into the Lit dashboard can execute script" over-claims for the tree
   as shipped: 0 of 35 payloads. The live script-execution risk is F2, not `renderMarkdown`.
4. The trust-boundary question is scoped to markdown fields only. Scoping it that way is
   what produced nine rounds on `renderMarkdown` and zero on the two `href` bindings in
   the same directories.

The brief's §3 hypothesis — that round 9's `templateText: true` blinding might hide a
hostile construct — did **not** pay out. Recorded as a green control rather than a pass:
`markdown.test.ts:3277` deliberately builds `BANNED_SINKS`'s view with strings **kept**,
which is why the indexed `["innerHTML"] =` pattern is still matchable. If that line is
ever switched to `codeNoStrings`, the pattern silently stops matching.

## Path to clearing the verdict

1. `npm test` on `Makefile:9` and `Makefile:16`, plus a CI workflow (~20 lines) — F1
2. Scheme allowlist on `remote_url`/`PullRequest.url` client- and server-side, plus an
   `href=${…}` rule in the guard (~60 lines) — F2
3. CSP + `nosniff` + `Referrer-Policy` on the asset handler (~15 lines) — F5
4. Invert `markdown.ts` to `ALLOWED_TAGS`/`ALLOWED_ATTR`, keep the deny-list as an
   assertion, add the vocabulary pin (~20 lines) — F3
5. Extend `BANNED_SINKS` with fixtures (~15 lines) — F4

Items 1 and 3 are about 35 lines together and do more for production risk than rounds 5
through 9 combined. That is not a criticism of those rounds; it is the point the audit
brief asked to be made plainly.

No production code was modified by this audit. Every mutation was reverted;
`git diff --quiet` clean.
