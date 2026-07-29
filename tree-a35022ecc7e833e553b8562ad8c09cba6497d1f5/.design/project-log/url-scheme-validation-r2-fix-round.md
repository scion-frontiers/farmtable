# URL Scheme Validation — R2 Fix Round

Date: 2026-07-28
Branch: `url-scheme-validation-r2`
Base: `d4c4e6b`
Commits: `158f9b0`, `e5ea360`, `b34c44c`, `5f948c9`, `a582a75`, `5c65382`, `ba79b04`, `859a54d`, `cedef7b`
Verdict: `FIXED`

Follow-up to `url-scheme-validation-stored-xss.md`, after a three-way independent
review. The three verdicts disagreed, and the disagreement was informative: the
audit could not fault the *implementation*, while the other two faulted the
*evidence* and the *packaging*. Both were right.

## The one that mattered most was not a security finding

**The branch failed the production container build.** `web/package.json`'s
`build` script is `tsc --noEmit && vite build`; `tsconfig.json` includes `src`,
which covers `*.test.ts`; the new test files import `jsdom` and `node:*`, and
none of `jsdom`, `@types/jsdom`, `@types/node` was declared. Eight TS errors,
`vite build` never runs, exit 2 — at `Dockerfile.server:6`.

It worked in the authoring environment because `node` types arrived
*transitively*, through `@types/jsdom`'s `/// <reference types="node" />`. It
broke the moment the package set was reinstalled from the manifests.

**The lesson is about measurement, not about types.** A gate measured in a
working tree that was never reconstructed from `package.json` + `package-lock.json`
is not a measurement of the gate. Every gate claim in the r2 report was taken
from `git clone` + `npm ci`, and two arms were measured separately where the
ordering changes the answer (`go build` needs `web/dist`, which only exists after
`npm run build` — task #100).

Test files stay inside the build's type-check. Excluding them would also have
made the build pass, and it is the tempting fix; it is the wrong one, because
type-checking the tests is what made this loud instead of invisible.

## Three tests that could not fail

1. **The rejection table could not see the allow-list.** All 21 fixtures were
   rejected by the parse throwing or by the host check. Deleting the scheme check
   outright, or adding `javascript:` to `SAFE_SCHEMES`, left the suite green.
   Fixed by adding WHATWG **special** schemes (`ftp:`, `ws:`, `wss:`), which parse
   successfully *and* yield a non-empty hostname, so only the allow-list can
   refuse them.

2. **The JSDOM test asserted against its own copy of the code.** It declared a
   local `renderGuarded()`. Replacing `safeHref(url)` with `url` in either real
   render function shipped green, because neither was ever imported. A check
   derived from the thing it checks cannot falsify it. Now driven through the
   real `renderPrLink` / `renderExternalSourceLink`.

3. **Every URL fixture sat at index 0 of a one-element list.** A guard that
   stopped after the first element regressed invisibly, on both write boundaries
   and in the frontend. Payloads now sit at index 1, and the frontend test
   renders the real `<ft-inspector-code>` element with two PRs in **both**
   orderings — only one ordering catches an index-0-only guard.

## The exclusion was justified against dead code

The base log excluded platform-sync writes because "values originate from the
upstream GitHub API". That describes `platform/github/github.go::buildRemoteData`,
which has **no production caller**.

The live path is the passthrough *read*: `graphql_queries.go:476-487` →
`passthrough.go:147` → `convert.go` → `ft-inspector-meta.ts`, wired at
`main.go:61`. It synthesises `remote_url` on every `ListTasks`/`GetTask` and
never persists it, so **no write-boundary check can structurally reach it** —
and `GitHubPassThroughStore.UpdateTask` ignores `RemoteData` entirely, so a value
validated there is discarded.

Fixed by validating on the way **out**, in `convert.go::taskToProto`, the single
convergence point for every read, degrading (dropping the field) rather than
erroring. Not attacker-reachable today — `issue.URL` is GitHub-generated, there
is no webhook receiver and no configurable API base URL. A missing control, not
an open hole.

**Generalisable:** a write-boundary check only covers fields that are *written*.
Synthesised-on-read fields need a read-boundary check, and "where does this value
come from" has to be answered against the caller graph, not against a function
with the right-looking name.

## Two guards that were claimed to agree, and do not

`safe-url.ts` asserted that the client allow-list and the server's
`validateURLField` agreed, and concluded "a scheme the client allows and the
server rejects is unreachable". The scheme **sets** agree. The **decisions** do
not: measured over 42 shared inputs, **33 agree and 9 diverge**, because the
server applies a control-character pre-check and Go's `net/url` while the client
uses the browser's WHATWG parser. Examples: `http:/\/\evil.com` yields
`hostname === "evil.com"` in a browser and `Host == ""` in Go; `https:///x`
promotes the path segment to the host in a browser.

None is a scheme escalation — every divergence resolves to an http(s) URL, i.e.
an attacker-chosen **host**, already reachable through a plainly accepted
`https://evil.com/`, not an attacker-chosen **scheme**. Broken-link and
inconsistency bugs, not XSS.

They are pinned in `testdata/url-scheme-cases.json`, read by **both**
`internal/server/urlvalidate_differential_test.go` and
`web/src/util/safe-url.test.ts`. Two independent tables can both be green while
disagreeing with each other — which is exactly the state this branch shipped in —
so there is only one table, and an anti-vacuity test refuses both a file with
zero divergences (someone rewriting a column) and one with zero agreements (a
broken measurement).

## A test suite that could silently not run a test

A web test file had to be registered in **two** hand-maintained places
(`tsconfig.test.json` `include`, and the `&&` chain in `package.json`).
Forgetting either produced exit 0 and no output. The `&&` chain also stopped at
the first failure, hiding every later result.

This is the same defect class as the original bug — a declared constraint that
nothing invoked, with a green suite. `tsconfig.test.json` now globs
`src/**/*.test.ts` and `scripts/run-tests.mjs` discovers the emitted tree,
cross-checks it against the sources in both directions, and runs everything.

## Unkillable code, kept deliberately

Two branches cannot be pinned by any fixture, and saying so is better than
adding a test that appears to cover them:

- **`safeHref`'s `hostname === ''` guard is unreachable.** Both allow-listed
  schemes are WHATWG *special* schemes, whose empty-host forms **throw** rather
  than yielding an empty hostname. It is kept because it is what makes widening
  `SAFE_SCHEMES` fail **closed**: every script-bearing scheme (`javascript:`,
  `data:`, `vbscript:`, `blob:`, `mailto:`) is **non-special** and parses with
  `hostname === ''`. What *is* pinnable is the reachability precondition, and
  `testHostGuardIsAFailClosedBackstop()` pins that: it goes red the moment a
  non-special scheme is allow-listed.
- **`strings.ToLower` on the server scheme is redundant**, because `net/url`
  already lowercases. The code comment already said so; the test cannot.

Related measured correction: the control-character pre-check is **not** what
makes the allow-list sound. `net/url` independently rejects every
control-character scheme-confusion input tried (`java\tscript:`, leading tab,
leading newline, leading space). Its unique contribution across 42 fixtures is
`http://example.com/a b`, which is not a security case. Kept as parser-drift
insurance, which is what its own comment claims — no more.

## Smaller things worth carrying forward

- **A scanner's recall needs its own fixtures.** The URL-binding scanner missed
  `href="${raw}"` (quoted — the form most people write) and
  `el.setAttribute('href', raw)` entirely, i.e. the two likeliest routes back to
  the original defect.
- **A file-scoped guard check is not a guard check.** `viaSafeHref` asserted the
  *file* imports `safeHref` somewhere, which a file that guards one binding and
  leaves the next one bare satisfies. Now scoped to the binding.
- **An allow-list entry keyed only on text approves every identical line.** Each
  entry must now match exactly one.
- **A status code is not an oracle.** `export_import.go` re-wraps every
  `importedTask` failure as `InvalidArgument`, so asserting the code alone also
  passes for a document rejected for an unrelated reason. Asserting the *message
  names the field* exposed a real defect: `UpdateTask` reported
  `invalid add_pull_requests.url` with **no index**, while the import path
  already included one.
- **Test-only surface in a non-`_test.go` file cannot always be moved.**
  `SetTestGraphQLClient` cannot go into an `export_test.go` because its callers
  are in `package server_test`; measured, not assumed. Marked with a `testing.TB`
  parameter and the measurement recorded in the file.
