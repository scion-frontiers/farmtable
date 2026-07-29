# review-xss-r2 — `url-scheme-validation-r2` @ `0bc9b72` (`d4c4e6b..0bc9b72`) — Review

Reviewer leg: code review (correctness / architecture / readability / self-description).
Tree: `/workspace`, HEAD `0bc9b721475dfe2fb24c5eba1034a071b842c45c` — verified.
Range reviewed: `d4c4e6b..0bc9b72`, 10 commits, 20 files, +2275/−93.

## Executive Summary

The round-1 CRITICAL is genuinely fixed and the three "tests that could not fail" are now
falsifiable — I mutated two of them and both went red. Risk level: **MEDIUM**. Three
Required findings, all of the same family the branch exists to eliminate: a control that
describes itself as closing a path it does not fully close (`remote_url` is dropped from
the typed field and re-emitted one line later inside `remote_data`), a test runner that
still has a silent-skip mode, and a production type boundary that this diff quietly
opened.

## My baseline — all `[MEASURED]`, this session, this tree

Established before attributing anything to the diff, per the shared block.

| gate | my exit | brief said (`[REPORTED — dev-xss-r2]`) | agree? |
|---|---|---|---|
| `npm ci` (in `web/`) | 0 | 0 | yes |
| `npm run build` | 0 | 0 | yes |
| `npm test` | 0, "PASS: 3 test file(s)" | 0, 3 files | yes |
| `go build ./...` | 0 (after `npm run build`) | 0 | yes |
| `go vet ./...` | 1 | 1 | yes |
| `go test ./...` | **0** | 1 (`TestWatchTasks_NoInitial` flake) | **no** |

`go vet` matched by MESSAGE, not count or line: four `assignment copies lock value to
ephReq` at `internal/server/server.go:1509 / 1619 / 1827 / 2004`, for
`GetReadyTasksRequest`, `GetBlockedTasksRequest`, `GetCriticalPathRequest`,
`GetBottlenecksRequest`. Same four the brief names, same lines. Pre-existing, not filed.

`go test ./...` exited **0** on my single run, with no `TestWatchTasks` failure anywhere in
the log. I did not run a matrix. This does not contradict the flake — it is the flake not
firing — but it does mean the brief's table row is not something I reproduced.

Base-state check confirming the r1 CRITICAL was real and is really fixed: at `d4c4e6b`,
`web/package.json` `devDependencies` is `{typescript, vite, vite-plugin-static-copy}` —
no `jsdom`, no `@types/jsdom`, no `@types/node` — while `web/src/util/safe-url.test.ts:11`
already did `import { JSDOM } from 'jsdom'` and `tsconfig.json` had `include: ["src"]`.
The mechanism is exactly as described. My `npm ci` from the manifests at HEAD then built
clean.

## Critical

None.

## Required

### R1. `taskToProto` drops the typed `remote_url` and ships the identical raw value one line later inside `remote_data`

`internal/server/convert.go:321-341`.

The new guard sets `pt.RemoteUrl` only when `validateURLField` passes. Then line 341 runs
unconditionally:

```go
pt.RemoteData, _ = structpb.NewStruct(t.RemoteData)
```

`t.RemoteData` still contains the rejected `remote_url`. Measured directly with a throwaway
probe in `package server` (since removed):

```
typed RemoteUrl = ""                                  (dropped as designed)
remote_data["remote_url"] on the wire = "javascript:alert(1)"
```

Three separate statements in this diff are false because of it:

**(a)** `passthrough_url_test.go:265-268` — "The whole point: the field is dropped, not
surfaced". It is dropped from one field and surfaced in another. The test asserts
`poisoned.GetRemoteUrl() != ""` and stops; it never looks at `GetRemoteData()`. This is
the "asserts a property it does not measure" shape the branch is here to remove.

**(b)** `internal/platform/github/testing.go:39-41` — "since `convert.go::taskToProto`
validates `remote_url` on the way out, a repointed endpoint cannot get a non-http(s) URL to
the client." It can. That sentence is the stated reason the `SetTestGraphQLClient` weakening
is judged acceptable, so a false premise is carrying weight.

**(c)** `convert.go:334-336` — "The field is simply omitted, and the dashboard renders
nothing for it, **which is the same degradation `safeHref` produces**." It is not the same.
`ft-inspector-meta.ts:628` is `${t.remoteUrl ? html\`<div class="row">…\` : nothing}` —
dropping the field makes the whole External Source row **vanish**. `safeHref` rejecting the
value renders a visible `<span class="external-source-unsafe" title="Unsupported URL: …">`.
Vanish vs. visible-inert is precisely the distinction the same author used to *justify*
deviation 3 (not validating `pr["url"]` on read). The two rationales contradict each other.

**Impact before severity.** This is not currently exploitable. No web source reads
`task.remoteData` at all — `capabilities.ts:98` and `ft-app.ts:256` read
`collection.remoteData`, a different message. And a future binding that did render it
would have to get past `safeHref` or the `url-binding-scan` allow-list, which I verified
bites (Probes C/D below). So: **not Critical**. It is Required because the change ships
three assertions that a reader will rely on and that are false, and because it leaves an
identical unvalidated copy of the value sitting on the wire one field away from the field
it just cleaned.

Reinforcing detail: `graphql_queries.go:476-484` writes `issue.URL.String()` into **both**
`remote_url` and `html_url`. `urlBearingRemoteDataKeys` is `["remote_url"]`, and
`TestURLBearingRemoteDataKeysCoversConvertReads` only inspects keys `convert.go` *reads* —
so `html_url` is invisible to it while still riding out in `remote_data`.

**Suggested fix — makes the bad state unrepresentable rather than detected.** Sanitise the
map that is serialised, not just the typed field:

```go
if t.RemoteData != nil {
    // Copy so we never mutate the ent entity.
    rd := make(map[string]interface{}, len(t.RemoteData))
    for k, v := range t.RemoteData {
        rd[k] = v
    }
    if remoteID, ok := rd["remote_id"].(string); ok && remoteID != "" {
        pt.RemoteId = &remoteID
    }
    if u, ok := rd["remote_url"].(string); ok && u != "" {
        if err := validateURLField("remote_url", u); err == nil {
            pt.RemoteUrl = &u
        } else {
            delete(rd, "remote_url")   // no second copy for a future binding to find
        }
    }
    pt.RemoteData, _ = structpb.NewStruct(rd)
}
```

Then extend `TestPassthroughReadDropsUnsafeRemoteURL` with
`poisoned.GetRemoteData().GetFields()["remote_url"]` — one assertion, and it is the one
that would have caught this. Correct (b) and (c) in the same pass. Consider whether
`html_url` deserves the same treatment or an entry in `nonURLKeys` with a reason.

### R2. `run-tests.mjs` closes the tsconfig↔runner gap but not the naming-convention gap; a test file can still be silently skipped at exit 0

`web/scripts/run-tests.mjs:89-90`, `web/tsconfig.test.json:7`.

Both sides filter on the same literal suffix — `walk(srcDir, '.test.ts')` and
`"include": ["src/**/*.test.ts"]`. They therefore agree perfectly about a file neither can
see, and the cross-check is structurally incapable of noticing it.

Measured. `web/src/util/zz-probe.spec.ts` containing `process.exit(9)`:

```
$ npm test
Discovered 3 test file(s).
...
PASS: 3 test file(s).
EXIT=0
```

`tsc --noEmit` exits 0 too — the file *is* in the production build program (via
`include: ["src"]`), so it is type-checked and then never executed. Positive control for
the negative claim: the same probe named `src/probedir/zz-probe.test.ts` **was** discovered
and did fail the suite (Probe A). So the mechanism works, and the miss is specifically the
convention.

The runner's own docblock sets the standard I am holding it to: "A test suite that can
silently not run a test is the same class of defect as the one this branch exists to fix."
It still can. Current impact is zero — no such file exists today — but the brief describes
this file as the only thing standing between a test file and never running, and as the
mechanism at the centre of a known merge collision, which is exactly the situation where
someone lands a file under a different convention.

**Suggested fix.** Two lines, and the second is the one that generalises:

1. Widen both globs to `src/**/*.{test,spec}.{ts,tsx}` / a suffix list in `walk()`.
2. Better, because it covers conventions nobody has thought of yet: after discovery, walk
   `src` for anything matching `/\.(test|spec|steps)\.(ts|tsx|mts)$/` or under a
   `__tests__/` directory, and hard-fail on any file that is not in `sources`. That turns
   "we didn't know about that convention" from a silent pass into a red build, which is the
   same move `orphans`/`missing` already make one level down.

### R3. The production type-check now admits Node ambient globals in browser source files, and neither `tsc` nor `vite build` catches it

`web/tsconfig.json:18` (`"types": ["vite/client", "node"]`) + the new
`@types/node` / `@types/jsdom` devDependencies + deviation 4 (tests kept inside
`include: ["src"]`).

Measured. With this prepended to `web/src/util/format.ts` — an ordinary browser module:

```ts
export const PROBE_ENV = process.env.HOME ?? '';
export const PROBE_DIR = typeof __dirname;
export const PROBE_BUF = Buffer.from('x').toString();
```

```
npx tsc --noEmit   EXIT=0
npm run build      EXIT=0     # bundle produced, no warning
```

Both gates green on code that is a guaranteed `ReferenceError` in a browser. The
*imported* form (`import { readFileSync } from 'node:fs'`) is caught, but only by
rollup, not by the type-check — and bare globals have no import for rollup to externalise,
so nothing sees them.

I checked my own attribution before filing this. Reverting `"types"` to `["vite/client"]`
alone does **not** restore the error: `@types/jsdom`'s `/// <reference types="node" />`
pulls Node's ambient declarations into the program regardless, because the test files that
import jsdom are inside `include: ["src"]`. So the `"node"` line is honest documentation of
what was already happening, not the cause. The *diff* is still the cause: at `d4c4e6b`
neither `@types/jsdom` nor `@types/node` was declared, so a clean `npm ci` installed
neither and Node globals genuinely were not in scope.

This is the unstated half of deviation 4. The leg's argument ("type-checking the tests is
what made the original breakage loud instead of invisible") is correct and I agree with it.
But the benefit is available without the cost.

**Suggested fix — keeps everything the leg wanted, restores the browser type boundary:**

```jsonc
// tsconfig.json
"types": ["vite/client"],
"include": ["src"],
"exclude": ["src/**/*.test.ts"]
```
```jsonc
// package.json
"build": "tsc --noEmit && tsc --noEmit -p tsconfig.test.json && vite build"
```

`tsconfig.test.json` already exists, already globs the test files, and already has
`"types"` free to include `node`. The tests stay inside the build gate — a missing
`@types/jsdom` still fails `npm run build` loudly, which is the property deviation 4 was
protecting — and browser sources go back to being type-checked as browser sources.

## Verdict on each of the four deliberate deviations

### 1. `SetTestGraphQLClient` → `testing.TB` parameter instead of `export_test.go` — **uphold the refusal, overturn the replacement**

The compile finding is correct and I did not need to re-derive it: `export_test.go` is
compiled only into `package github`'s own test binary, and both callers are in
`package server_test`. Declining that instruction was right.

The `testing.TB` marker is a **speed bump, not a constraint.** The brief asked; measured:

```go
// package main, production build
var tb testing.TB = &testing.T{}
tb.Helper()
// → "OK: a production caller manufactured a testing.TB and called Helper() with no panic"
```

`testing.T` is an exported struct with all-unexported fields, so `&testing.T{}` is legal
from anywhere, and `Helper()` on a zero value does not panic. A production caller is one
line away.

The cost the brief did not ask about is larger than the benefit. `internal/platform/github/testing.go`
is a **non-test file**, so `import "testing"` is now a production dependency:

```
$ go list -deps ./cmd/ft | grep -x testing
testing            # linked into the shipped binary
```

**The move:** change the parameter type to a locally-declared interface. Same marker
strength, zero production import:

```go
// tb is satisfied by *testing.T and *testing.B and by essentially nothing a
// production caller would already have in hand.
type tb interface{ Helper() }

func SetTestGraphQLClient(t tb, s *GitHubPassThroughStore, client *githubv4.Client) {
	t.Helper()
	s.gql.v4 = client
}
```

Filed as **Optional** below, not Required — the honest reading is that this function was
already test-only surface in the production binary before the diff, and the diff makes that
*more* visible, not less. It does not make the codebase worse. But the docblock should stop
claiming the parameter is a barrier, and it must lose the third paragraph (see R1(b)).

### 2. Uniqueness assertion instead of pinned line numbers on `ALLOWED` — **uphold, and this is the best work in the diff**

The reasoning in the code comment (`url-binding-scan.test.ts:284-287`) is right: a pinned
line number churns on every edit above the binding, and buys nothing that uniqueness does
not. Uniqueness additionally closes a hole a line number would not have: one approved line
laundering a second identical line pasted beside it.

More importantly the *other* half of this commit — scoping `viaSafeHref` from file-level to
enclosing-block — is a real strengthening, and I verified it bites rather than taking it on
trust.

- **Probe C**: changed `const href = safeHref(url)` → `const href = url` in
  `ft-inspector-code.ts::renderPrLink`. Both `safe-url.test.ts` and
  `url-binding-scan.test.ts` went red, with the scanner reporting
  *"nothing in the enclosing block assigns href from safeHref()"*.
- **Probe D**: kept the mutation and added a decoy `const href = safeHref(url);` inside a
  *different* top-level function in the same file — i.e. the exact shape the old
  file-scoped check would have accepted. Still red. The scoping is real, not nominal.

Both probes also incidentally confirmed the runner's "report every file" property: it
reported two failing files where the old `&&` chain would have stopped at the first.

### 3. No read-path validation for `pr["url"]` — **uphold the decision, reject the stated reason**

The decision is right, and for a reason the leg did not give: `PullRequest.url` is
structurally different from `remote_url`. Every path that writes it crosses a validating
boundary (`UpdateTask`, `ImportCollection`), whereas `remote_url` is synthesised on read and
crosses none. The asymmetry is principled.

The stated reason — a silent drop "would make legacy rows *vanish* rather than degrade to
visible inert text" — is a false dichotomy. Dropping the *element* would make it vanish;
blanking `Url` while keeping the element degrades exactly like the client does:
`safeHref('')` returns `undefined` (pinned as the `"empty"` fixture, `client: reject`), so
`renderPrLink` emits `<span class="pr-link pr-link-unsafe" title="Unsupported URL: ">${id}</span>`
and the PR is still listed with its id. Both options were available.

And per R1, the treatment `remote_url` actually received is the *less* graceful of the two,
not the more graceful one — the External Source row disappears entirely. The comment at
`convert.go:334-336` has it backwards.

### 4. Test files kept inside `tsconfig.json`'s type-check surface — **overturn**

See **R3**. The stated benefit is real and I would not want it given up. But it is
obtainable with a second `tsc --noEmit -p tsconfig.test.json` in the build script, and as
shipped the deviation buys loudness for the test files at the price of silence for every
browser file in the tree. Presented in the brief as a one-sided trade; measured, it is not.

## Answer to the `run-tests.mjs` question (brief item 2)

Three sub-questions, answered in the order asked.

**"Would `run-tests.mjs` discover an arbitrary new `src/**/*.test.ts` with no configuration
edit?" — YES, measured.** Created `web/src/probedir/zz-probe.test.ts` (a brand-new
directory, no edit to `package.json` or `tsconfig.test.json`), containing
`process.exit(3)`:

```
Discovered 4 test file(s).
--- src/probedir/zz-probe.test.ts
zz-probe: discovered and executed
...
FAIL: 1 of 4 test file(s) failed:
  src/probedir/zz-probe.test.ts (exit 3)
EXIT=1
```

Discovered, executed, non-zero child exit propagated, and the three other files still ran
after it failed. That is the property you need, and it holds. Stated without reference to
the other branch: **any** file placed at `web/src/**/*.test.ts` runs with zero
configuration. Files under a different suffix do not — see R2, which is the caveat that
matters for a merge where the incoming branch may not share the convention. The collision
does not disappear entirely either: `package.json`'s `test` script is still a single line
two branches can both edit, but it is now a one-line conflict with an obviously correct
resolution rather than two mutually-exclusive lists.

**"Does the two-way cross-check actually close both directions?" — YES, and it is what
provides the guarantee, not `rm -rf .tmp-test`.** Measured both directions with the `rm`
deliberately skipped:

- Renamed the source, ran `node scripts/run-tests.mjs` against the stale tree:
  `FAIL: these test sources produced no compiled output… src/probedir/zz-probe2.test.ts`, exit 1.
- Ran `tsc -p tsconfig.test.json` *without* the `rm`, then the runner:
  `FAIL: these compiled tests have no source, so .tmp-test is stale: .tmp-test/probedir/zz-probe.test.js`, exit 1.

So the answer to **"does `rm -rf .tmp-test` reliably prevent a renamed test leaving a stale
passing `.js`"** is that the question credits the wrong mechanism. Removing the `rm` from
`package.json` would not reopen the hole; the `missing`/`orphans` cross-check catches it
from both sides. The `rm` is belt-and-braces. (The `rm` is also the only reason the two
checks cannot *both* be needed at once, which is a mild readability win — keep it.)

**"Does reading exit codes off the child process hold everywhere in that script?" — yes.**
`spawnSync(process.execPath, [file], { stdio: 'inherit' })` reads `result.status` directly
off the child with no pipe. Signal-killed children give `status === null`, which
`result.status !== 0` correctly treats as a failure; spawn failures set `result.error`,
which is also checked. Every error path calls `process.exit(1)`. The anti-vacuity guards
(`!existsSync(outDir)`, `sources.length === 0`) are both present and both correct.

One residual, filed as a Nit: `spawnSync` has no `timeout`, so a hanging test hangs the
suite instead of failing it. The `&&` chain had the same property, so this is not a
regression.

One thing the design gets right that is worth naming: `tsc` infers `rootDir` from the
program, so a test file that imported something from outside `src/` would shift every
emitted path and the `stem()` comparison would break. It breaks *loudly* — as `missing`,
a hard error — not silently. That is the correct failure direction and it appears to be
by construction.

## Nit / Optional

- **O1 (Optional).** `SetTestGraphQLClient`'s `testing` import puts the `testing` package in
  `go list -deps ./cmd/ft`. Replace `testing.TB` with a local `interface{ Helper() }` (code
  above); same marker, no production dependency. And delete the "no longer load-bearing"
  paragraph — per R1(b) it is false.
- **O2 (Optional).** `passthrough_url_test.go:78` and the project log both state
  `platform/github/github.go::buildRemoteData` "has no production caller". It has two, at
  `github.go:169` and `github.go:200`. The *conclusion* survives — `github.New` /
  `NewWithConfig` have no non-test callers, so `GitHubAdapter` is never constructed outside
  tests and `SyncCollection` is unreachable — but a reader who greps the name finds two
  callers in production files and has no way to tell whether the comment is stale or wrong.
  Reword to name the actual reason. Note also that nothing keeps it true: wiring
  `github.New(...)` anywhere makes the sentence false with nothing going red. (The new
  read-path check in `convert.go` would in fact cover that case — the comment undersells
  its own change.)
- **N1 (Nit).** `enclosingBlock`'s docblock claims the crude scan can only ever *widen*
  ("Widening is the safe direction"). The backward scan is `/^\S/.test(line) && line.includes('{')`,
  which also matches a top-level `import { html } from 'lit';`. For a binding placed near
  the top of a file the block would start at an import line — *narrower* than intended, i.e.
  a false failure, which the docblock says cannot happen. Not triggered by any current file.
  Either exclude `^import\b` from the scan or soften the claim.
- **N2 (Nit).** The rule set treats `xlink:href` inconsistently: the two template rules and
  the `setAttribute` rule cover it, the property-assignment rule
  (`/\.(?:href|src)\s*=\s*(?!=)/`) does not. Harmless today (`el['xlink:href'] =` is not a
  thing) but the asymmetry will read as an oversight.
- **N3 (Nit, outside the diff — flagging only because comment accuracy is this round's
  theme).** `url-binding-scan.test.ts:13-20` still says "the only other `*.test.ts` under
  `web/` is `src/utils/task-ready.test.ts`". There are now three. Unmodified by this diff,
  so out of scope for the merge, but it is a measurement written as a standing fact and it
  has already gone stale.
- **N4 (Nit).** No `timeout` on `spawnSync` in `run-tests.mjs`; a hanging test hangs CI
  rather than failing it. Not a regression.

## FYI

- `web/`'s test suite now reads a file *outside* `web/` (`testdata/url-scheme-cases.json`,
  located by walking up to `go.mod`). This is a deliberate and, I think, correct call — a
  shared fixture is the only way to make the two halves unable to drift independently — but
  it does mean `npm test` is no longer runnable against a standalone copy of `web/`. It
  fails loudly if it cannot find the root, so no silent-skip risk. `Dockerfile.server` runs
  `npm run build`, not `npm test`, so the container is unaffected.
- `src/utils/task-ready.test.ts` produces no output at all under the new runner. The runner
  verifies a file *ran* (exit 0), not that it *asserted* anything. Out of scope; noting
  because the runner is being relied on as the anti-vacuity mechanism and this is the one
  thing it does not check.
- I verified the fixture file against both implementations rather than reading it: 42 cases,
  0 duplicate names, 0 duplicate inputs, exactly 9 server/client divergences, and both
  halves green. The "9 of 42" claim in `safe-url.ts`, in the Go test docblock and in the
  `_README` is accurate.
- I spot-checked the scheme-classification claim in `safe-url.ts:691-694` independently:
  `javascript: data: vbscript: blob: mailto: file:` all yield `hostname === ''`;
  `ftp: ws: wss:` all throw. Every claim in that comment holds.
- `graphql_queries.go:480` is exactly `"remote_url": issue.URL.String()`. The line citation
  in the `convert.go` comment is correct.
- `GitHubPassThroughStore.UpdateTask` does indeed contain no reference to `RemoteData`.
  Claim verified.
- `validateURLField` echoes the caller's raw URL back in the `url.Parse` error path
  (`"invalid %s: %v"`). Pre-existing, out of the diff, and it reflects the caller's own
  input back to that caller, so not a leak of anyone else's data. Mentioning only because
  the brief asked me to check the error message for leaks and the answer for the *new* code
  is "nothing new".

## Positive Feedback

Specific, not manufactured.

- **The shared fixture file is the right shape.** Two tables that can both be green while
  contradicting each other is a real failure mode, and one file read from both sides with
  an anti-vacuity control on the divergence count (`TestSharedFixturesRecordRealDivergences`,
  checking *both* `divergent == 0` and `agreeing == 0`) is the correct chokepoint. The
  `_README`'s security reading — that all 9 divergences resolve to attacker-chosen *host*,
  already reachable via `https://evil.com/`, not attacker-chosen *scheme* — is the right
  analysis and correctly bounds the finding instead of inflating it.
- **The `viaSafeHref` block-scoping actually works.** I tried to defeat it twice (Probes C
  and D, including the decoy-in-another-function case that the old file-scoped check would
  have accepted) and could not. That is the difference between a rule and a rule that holds.
- **`TestURLBearingRemoteDataKeysCoversConvertReads` is the best structural idea in the
  diff.** A hand-maintained list whose comment says "keep in sync" is a promise; reading the
  other file's source and failing on an unclassified key is a mechanism. The positive
  control on the extractor (`if !slices.Contains(found, "remote_url") { t.Fatalf(...) }`) is
  exactly right — without it a reformat of `convert.go` would make the whole test pass
  vacuously. The reverse-direction check for stale entries is a nice touch.
- **Reporting every failing test file instead of stopping at the first** is a small change
  that paid off immediately during my own probing.
- **The `add_pull_requests[%d].url` fix** (`server.go:640-644`) is correct, matches the
  import path's existing convention, and the accompanying test change is the right one: it
  moves the payload to index 1 *and* asserts the field name appears in the message, so the
  status code alone is no longer the oracle. Leaks nothing — the index is derived from the
  caller's own request shape.

## Test Coverage

Good, and materially better than what it replaced. New paths and their pins:

| new/changed code | pinned by | falsifiable? |
|---|---|---|
| `convert.go` typed `remote_url` drop | `TestPassthroughReadDropsUnsafeRemoteURL` (6 payloads, positive control on a second issue in the same response) | yes |
| `convert.go` `remote_data` copy | **nothing** | **R1** |
| `server.go` indexed field name | `TestRPC_UpdateTask_RejectsScriptURLInPullRequest` message assertion | yes |
| `safeHref` scheme allow-list | `ftp:/ws:/wss:/httpx:` fixtures (special schemes, non-empty host) | yes — this was the r1 "cannot fail" case and it is genuinely fixed |
| `safeHref` host guard | `testHostGuardIsAFailClosedBackstop` | it pins the *reachability precondition*, which is the honest thing to do for unreachable code, and it says so |
| real render functions | `testPayloadNeverReachesHrefAttribute` via lit + JSDOM | yes — verified by mutation (Probe C) |
| list iteration | `testGuardHoldsForEveryItemInAList`, both orderings | yes |
| scanner `viaSafeHref` | block-scoped assignment check | yes — verified by mutation (Probes C, D) |
| test discovery | the runner's own cross-check | partially — R2 |

The one gap I would call out beyond R1: `testHostGuardIsAFailClosedBackstop` asserts the
guard's *precondition*, which is correct and well-argued, but nothing pins the claim that
the client and server **scheme sets** are identical. In practice the fixture table covers it
indirectly — adding `mailto:` to `SAFE_SCHEMES` turns the `mailto` fixture's client column
red — so per impact-before-severity this is covered and not a finding. Noting it so the
coverage claim is honest.

## Backward Compatibility

No wire-format changes. No proto edits. No removed fields, no new required fields.

One **behaviour** change worth stating plainly for release notes: any task whose stored
`remote_url` fails `validateURLField` now returns with `remote_url` unset, and the dashboard
drops the External Source row entirely for it. For a legacy row holding a merely *malformed*
(not malicious) URL — and note the fixture table records six inputs the server rejects but
the client accepts, e.g. `http:/example.com`, `https://example.com/x\n`,
`http://example.com/%zz` — the user loses a link they could previously click, with no
indication anything was there. That is the degradation-vs-drop point from R1(c) again, and
it is an argument for the fix there rather than a separate finding.

`add_pull_requests.url` → `add_pull_requests[0].url` in error text is a message-format
change. `grep`-based clients would notice; the two in-repo tests were updated. Low risk.

## Everywhere this brief is wrong

Required deliverable. Ten, and I stopped looking rather than ran out.

1. **The gate table's `go test ./...` row.** Tagged `[REPORTED — dev-xss-r2]`, exit 1 with
   the `TestWatchTasks_NoInitial` flake. My run exited **0** with no `TestWatchTasks`
   failure. Not a contradiction — it is a flake not firing — but the table states a
   deterministic exit code for a gate the shared block *itself* says is "probabilistic, not
   a flat 0". The table and the prose disagree; the prose is right and the table is what a
   reader anchors on. Put "0 or 1" in the cell.

2. **The covering message's report path is relative and does not resolve.** "You MUST write
   your report to `reports/review-xss-r2.md`". There is no `reports/` under `/workspace` —
   the very root you asked me to verify. The brief body has the correct absolute path. This
   is the same class as the filesystem-path error you say you have made four times: you
   fixed it for the *tree* and reintroduced it for the *report*.

3. **§5: "its docblock at 17-19 states a two-list invariant between the client and server
   guards."** Wrong twice. (a) Lines 17-19 of `safe-url.ts` are the tail of the per-binding
   weight discussion plus "Either way: do not remove this on the grounds that 'the server
   validates'." The scheme-set text begins at line 21. (b) Far more importantly, the
   docblock does not *state* a two-list invariant — it explicitly **retracts** one:
   *"The scheme SETS match. The DECISIONS do not, and a previous version of this comment
   claimed they did."* This is your failure mode #1: a question carrying a false premise,
   framed so that the expected answer is "check whether the invariant holds", when the code
   has already conceded it does not. I answered the question I could measure instead: the
   surviving claim (scheme sets identical) is true and is indirectly pinned by the fixture
   table.

4. **§1, deviation 3: the stated reason for not validating `pr["url"]` on read is a false
   dichotomy.** "A silent server-side drop would make legacy rows *vanish* rather than
   degrade to visible inert text" — only if the drop removes the list element. Blanking
   `Url` and keeping the element degrades identically to the client, because `safeHref('')`
   returns `undefined` and `renderPrLink` emits the inert span with the PR id. You relayed
   the leg's reason without testing it. The deviation is still correct; the reason is not.

5. **§4: "It drops the field rather than erroring."** Half true, and the missing half is my
   largest finding. The typed field is dropped; the identical raw string is re-emitted
   unconditionally one line later inside `remote_data` (measured). Your sentence, the code
   comment, and the test all describe a drop that does not happen at the wire level.

6. **§4: the chokepoint question was aimed in the wrong direction.** You wrote *"That is the
   load-bearing claim and it is the kind of 'this is *the* chokepoint' statement I have
   personally gotten wrong twice this week by naming one site when there were three."*
   Measured: it is genuinely one site. `&pb.Task{` occurs exactly once in non-test Go
   (`convert.go:264`); `pt.RemoteUrl` is assigned exactly once; `&pb.PullRequest{` occurs
   exactly once. The chokepoint claim is correct. The defect is *inside* the chokepoint, not
   beside it — being the only convergence point does not help when the convergence point
   emits the value twice. Your prior was well-founded and would have caused a leg reasoning
   from the brief to hunt for site #2 and #3 and report "none found, claim holds".

7. **§2: "does `rm -rf .tmp-test` reliably prevent a renamed test leaving a stale passing
   `.js`"** — leading, and it credits the wrong mechanism. Measured with the `rm` skipped:
   both directions still fail loudly. The guarantee comes from the `missing`/`orphans`
   cross-check, not the `rm`. A leg answering your question as asked would have audited the
   `rm` and reported on the wrong component.

8. **§2: "This is now the only thing standing between a test file and never running."**
   False as stated. Both the tsconfig glob and the runner's `walk()` filter on the literal
   `.test.ts` suffix, so the *naming convention* is a second, unguarded gate that the
   cross-check cannot see past. Measured: a `.spec.ts` that would `process.exit(9)` is never
   run and `npm test` prints `PASS: 3 test file(s)` at exit 0. Relevant to the #103 merge
   collision you raised, and I established it without looking at the other branch.

9. **§3: "check whether the error message now leaks anything it should not"** points at the
   place where there is nothing and away from the place where there is something. The new
   code leaks nothing — the index comes from the caller's own request. But
   `validateURLField` already echoes the caller's raw URL back via `"invalid %s: %v"` on the
   `url.Parse` path. Pre-existing, out of my range, and benign (self-reflected input), so
   not filed — but the question as framed would have produced "no leak" with no mention of
   the echo at all.

10. **§1, deviation 4 is presented as a one-sided trade.** "Excluding them would also have
    made `npm run build` pass. Stated reason: type-checking the tests is what made the
    original breakage loud instead of invisible." That benefit is real. The cost is not
    mentioned anywhere in the brief: the same decision drags `@types/node` into the
    production type-check program, and `process.env` / `Buffer` / `__dirname` in a browser
    source file now pass both `tsc --noEmit` and `vite build` at exit 0 (measured). You
    asked me to judge four deviations on their merits while describing one of them with only
    its merits.

**What the brief got right, since convergence is only evidence if the misses are also
reported:** the copylock guidance was exactly correct — four, matched by the message string
`assignment copies lock value to ephReq`, at `1509/1619/1827/2004`, and `grep copylock`
does indeed return nothing. The `origin/main` warning holds. The `d4c4e6b..0bc9b72` range,
the "last code commit is `cedef7b`" claim, and the docs-only nature of HEAD all check out.
The `web/dist` / `assets.go:5` ordering trap is real and I hit it in the ordering you
specified, not by accident.

## Predictions I made before measuring, and my misses

Per the shared block. Four predictions, four wrong, and three of them became findings.

1. **Predicted: `testing.TB` is a hard barrier**, because `testing.TB` has an unexported
   `private()` method and cannot be implemented outside `package testing`. That part is
   true and irrelevant — `&testing.T{}` is directly constructible and `Helper()` on a zero
   value does not panic. **Miss**, and the miss is the answer to the brief's question.
2. **Predicted: the `run-tests.mjs` cross-check has a hole in one direction.** It does not;
   both directions fail loudly under deliberate abuse. **Miss.** The hole is one level up,
   in the suffix convention — which I only looked for *because* I had failed to find the one
   I expected.
3. **Predicted: `"types": ["vite/client", "node"]` is what opened the type boundary.** The
   counterfactual says no — `@types/jsdom`'s transitive `/// <reference types="node" />` is
   sufficient on its own. **Miss.** The diff is still the cause, but not via the line I
   assumed, and I would have filed a wrong remedy if I had skipped the counterfactual.
4. **Predicted: `taskToProto` is not the single convergence point** — I took your "one site
   when there were three" warning at face value and went looking for sites two and three.
   There is one. **Miss.** The defect turned out to be inside it, which I found only after
   the search for siblings came up empty and I read the function body line by line instead.

## Probe hygiene

Ten probe cells, **0 left dirty.**

Probes run: (A) new `.test.ts` in a new directory; (B1) renamed source against a stale
`.tmp-test`; (B2) `tsc` without the `rm`; (C) `safeHref` removed from `renderPrLink`;
(D) C plus a decoy `safeHref` assignment in another top-level function; (E) throwaway Go
test in `package server` reading `remote_data` off `taskToProto`; (F) `node:fs` import in
`src/util/format.ts`; (G) bare Node globals in `src/util/format.ts`; (H) a `.spec.ts` test
file; (I) `tsconfig.json` `types` counterfactual.

Snapshots taken to `/tmp/snap` before touching anything; every revert was `cp` from the
snapshot or `rm` of a file I created — no `git checkout` anywhere. `web/dist` was rebuilt
from clean sources after the last probe and contains no probe symbols. Final state:

```
$ git status --porcelain
$ npm run build   # EXIT=0
$ npm test        # EXIT=0, "PASS: 3 test file(s)."
```

No production code was modified in the committed tree. Nothing pushed.

## Final Verdict

**REQUEST CHANGES**

Blocking: **R1** (the `remote_data` re-emission plus the three false statements that rest on
it), **R2** (`run-tests.mjs` silent-skip on any non-`.test.ts` convention), **R3** (Node
ambient types in the production type-check).

None of the three is a security defect and I want to be explicit about that, because the
temptation on an XSS branch is to read every finding as one. R1 is not exploitable today —
no client renders `task.remoteData`, and the client-side chokepoint would catch one that
tried. R2 and R3 are build-infrastructure regressions with zero current impact. What makes
all three blocking is that each one is a mechanism whose self-description overstates what it
does, on a branch whose entire thesis is that a declared constraint nothing enforces is
worse than no constraint. R1 in particular ships a test asserting a property it does not
measure — the exact defect class round 1 found three of.

Everything else is Optional/Nit and can go to a cleanup pass. The four deviations:
**#1 refusal upheld, replacement overturned** (Optional, cheap fix); **#2 upheld and it is
the strongest work in the diff**; **#3 decision upheld, reason rejected**; **#4 overturned**
(this is R3).

The underlying change is a clear improvement to code health and I expect to approve it once
R1–R3 land. R1 and R3 are each a handful of lines. R2 is two.

**Scope note per my role brief:** mutation adequacy is the test leg's axis and threat
modelling is the audit leg's. Probes C, D and E are mine only because I was verifying
mechanisms in my own lane (does the scanner's scoping hold; does the chokepoint emit the
value once) and needed a measurement rather than a reading. Where I formed an impression
outside my lane — the "9 divergences are host-choice not scheme-choice, therefore not XSS"
reasoning in the fixture `_README` looks sound to me — that is an **impression**, not a
finding, and it should not be counted as corroboration of the audit leg.
