# dev-xss-r2 — fix round for the stored-XSS change, after a three-way independent review

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`. You are on branch
**`url-scheme-validation-r2`**, currently at **`d4c4e6b629ade1d0725bc303c0acf962838f03c9`** (the
reviewed commit). Commit on top of it. **Do NOT push. Do NOT create any directory named here.**

Three legs reviewed `d4c4e6b` in parallel on different axes and all three reports are on disk.
**Read all three before you write any code:**

- `/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r1.md` — REQUEST CHANGES
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r1.md` — REQUEST CHANGES
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r1.md` — APPROVE, 2 HIGH

The verdicts disagree. That is not a contradiction to resolve — they measured different things. The
audit could not fault the *implementation* (0/80 exploitable inputs, with 24/24 positive controls).
The other two faulted the *evidence* and the *packaging*. Both are true at once.

---

## THE BASELINE — read this before you run a single gate

I have repeatedly told legs that `cd web && npm test` exits 0 here. **That was wrong**, and it was
wrong in a way you must not reproduce. It was true only in clones carrying an unsaved
`npm install jsdom` that is in **neither** `package.json` **nor** `package-lock.json`.

`[MEASURED by me this session, fresh clones, both arms]`:

| arm | `npm ci` | `npm run build` | `npm test` |
|---|---|---|---|
| this branch @ `d4c4e6b` | 0 | **2** | **2** |
| base `7a0f220` (live in production) | 0 | **0** — `✓ built in 3.05s` | 0 |

**Anything you measure in a clone you did not reconstruct from the manifests is not a measurement.**
Use `git clone` + `npm ci` for every gate claim in your report.

Separately and unrelated: `assets.go:5` is `//go:embed all:web/dist`, and `web/dist` is gitignored
with zero tracked files. In a *fresh* clone `go build`, `go test` and `go vet` all exit 1 with
`assets.go:5:12: pattern all:web/dist: no matching files found`. **I have pre-built `web/dist` into
your clone** so the Go gates work. That is pre-existing (identical to production, and the release
container gets it right), it is tracked as task #100, and it is **not yours to fix**. Disclosed only
so your baseline is reproducible. In your clone: `go build ./...` 0, `go test ./...` 0,
`go vet ./...` 1 with exactly 4 pre-existing copylocks in `internal/server/server.go` (check the
messages, not the count).

Known flake: `TestWatchTasks_NoInitial`/`_Heartbeat`/`_ClosedEvent`, ~8% per full-suite run
(`watch_test.go:118: timed out waiting for event`). **Read failing test NAMES, never counts.**

---

# MUST FIX — all four are merge-blocking

## MUST 1 — C1 [CRITICAL]: the branch fails the production container build

**This is worse than any single leg reported, and I measured the difference.** review-xss-r1 scoped
it to `make web`/`make dashboard`; test-xss-r1 scoped it to the test suite. Neither ran
`npm run build`.

`web/package.json` → `"build": "tsc --noEmit && vite build"`. `tsc --noEmit` type-checks the
**whole project including `*.test.ts`**. Your new test files import `jsdom` and
`node:fs`/`node:path`/`node:url`; none is declared. Result: **8 TS errors, `vite build` never runs,
exit 2.**

```
src/util/safe-url.test.ts(8,42):          TS2307 Cannot find module 'node:fs'
src/util/safe-url.test.ts(11,23):         TS2307 Cannot find module 'jsdom'
src/util/safe-url.test.ts(171,46):        TS7006 Parameter 'l' implicitly has an 'any' type
src/util/url-binding-scan.test.ts(22,65): TS2307 Cannot find module 'node:fs'
... 8 total
```

`Dockerfile.server` line 4 `RUN npm ci`, line 6 `RUN npm run build`. **The release container build
fails.** This branch currently cannot be deployed.

**Fix:** declare `jsdom`, `@types/jsdom` and `@types/node` in `web` `devDependencies`, regenerate
`package-lock.json`, and fix the implicit-`any` at `safe-url.test.ts:171`.

**Acceptance, and you must demonstrate it in a FRESH clone, not in your working tree:**
`git clone` → `npm ci` 0 → `npm run build` **0** → `npm test` 0. Show the three exit codes.

**The generalisable lesson, which I want reflected in how you think about the rest of this round:**
I argued that because no Makefile target runs `npm test`, the new test files were inert and carried
no release blast radius. The premise was true and the inference was false — **the type-checker does
not care what the test runner runs.** To know a file's blast radius, ask what *reads* it, not what
*runs* it.

## MUST 2 — test F2 [CRITICAL]: `safeHref`'s scheme allow-list is pinned by nothing

Measured by test-xss-r1: the allow-list can be **deleted entirely**, or **widened to include
`javascript:`, `data:` and `vbscript:`**, and the suite stays green.

Root cause, and it is the project's unifying defect in its sharpest form: of the 21 rejection
fixtures, **0 are rejected by the scheme allow-list alone**. 16 are rejected by *both* the allow-list
and the `hostname === ''` check; 5 never reach either guard because the parse throws. Every
script-bearing scheme is a *non-special* scheme, so `new URL(...).hostname === ''` for all of them and
the host check silently double-covers the whole table. **The 21-row table has 21 inputs and zero
discriminating ones.**

**Fix:** add fixtures using schemes that are *special* (so they parse **with** a host) but not
allow-listed — `ftp://evil.com/x`, `ws://evil.com/x`, `wss://evil.com/x`. Each is rejected only by
the allow-list.

**Acceptance:** demonstrate RED for all three of these mutations independently — (a) delete the
scheme check, (b) delete the hostname check, (c) add `javascript:` to `SAFE_SCHEMES`. Report the
failing assertion **name and message** for each. Note this also requires the hostname check to have
its own discriminating fixture (`http:/\/\evil.com`), or you will merely have swapped which guard is
unpinned.

## MUST 3 — test F3 [HIGH]: no test exercises the real render path

`safe-url.test.ts::testPayloadNeverReachesHrefAttribute` declares its own `renderGuarded()` **inside
the test file** and asserts against that. The production functions —
`ft-inspector-code.ts::renderPrLink` and `ft-inspector-meta.ts::renderExternalSourceLink` — are never
imported, never called, never asserted on.

Measured: changing `const href = safeHref(url)` to `const href = url` in **either** production
function ships **green**. The only thing that catches it is deleting the now-unused import.

The test carries an explicit positive control and that control is real — **but it controls the copy,
not the product.** A check that derives from the thing it is checking.

**Fix:** export the two render functions (or the module's render entry) and drive the JSDOM
assertions through them.

**Acceptance:** with the fix in place, the one-token bypass in each function must go RED. Name the
assertion. Keep the existing positive control and relabel it so the next reader knows what it
controls.

## MUST 4 — audit F1 [HIGH]: the stated exclusion for platform sync describes **dead code**

The design doc and report exclude platform sync because "values originate from the upstream GitHub
API, not a client request". That justification describes
`internal/platform/github/github.go` (`buildRemoteData`, line 257) — **which has no production
caller**; every constructor of that adapter is in a `_test.go`.

The code that actually runs in production is the **passthrough store**:
`graphql_queries.go:476-487` (`"remote_url": issue.URL.String()`) → `passthrough.go:147` →
`convert.go:321-323` → `ft-inspector-meta.ts:627`, wired at `main.go:61`
`s.SetResolver(github.NewPlatformResolver())`. It is a **read-through, not a sync**: `remote_url` is
synthesised on **every `ListTasks`/`GetTask`**, never persisted, so **no write-boundary guard can
ever cover it**. Worse, `GitHubPassThroughStore.UpdateTask` (`passthrough.go:315-459`) **ignores
`p.RemoteData` entirely** — the value the server validated at `server.go:663` is discarded.

Consequence: for every GitHub-platform collection, `safeHref()` is **not defence in depth, it is the
only control** — and the comment at `safe-url.ts:5-8` says the opposite, so a future reader could
remove it.

**Not attacker-reachable today** — the auditor looked hard and the trusted-upstream argument
survives (no webhook receiver, no GHE base-URL config, no URL-extracting regex anywhere). Do not
write this up as exploitable. Fix it because the documented reason is factually wrong and the next
reader will re-derive a wrong safety argument.

**Fix** — validate on the way **out**, at the single convergence point, degrading rather than
erroring (a bad URL from upstream must not fail the whole read):

```go
// internal/server/convert.go, replacing lines 321-323
if remoteURL, ok := t.RemoteData["remote_url"].(string); ok && remoteURL != "" {
    // Not all values here are client-written: the GitHub passthrough store synthesises
    // remote_url on every read (platform/github/graphql_queries.go:480), so no
    // write-boundary check covers it. Drop rather than error.
    if err := validateURLField("remote_url", remoteURL); err == nil {
        pt.RemoteUrl = &remoteURL
    }
}
```

Also: move `SetTestGraphQLClient` out of `internal/platform/github/testing.go` (a non-`_test.go`
file, so it compiles into the production binary) into an `export_test.go`; and **correct the design
doc** so it names `passthrough.go`, not `github.go`. Update the `safe-url.ts:5-8` comment to state
its real role.

**Acceptance:** a test that drives the passthrough read path with a `javascript:` `remote_url` from a
stubbed GraphQL response and asserts the field is dropped. This one **will actually run** —
`make test` is `go test ./...`.

---

# SHOULD FIX — same round if you can, and say so if you cannot

- **audit F3 [MEDIUM]** — `urlBearingRemoteDataKeys` is a closed enumeration guarding an open set,
  coupled to `convert.go` by **a comment and nothing else** (`grep` returns 3 hits, all inside
  `urlvalidate.go`; no test). And the drift is not hypothetical: `graphql_queries.go:482` **already
  writes `html_url`** into the same map. Replace the comment with a source-reading test — the
  auditor sketched one in their F3. Give it a positive control.
- **scanner recall [MEDIUM, both review-xss-r1 R1/R2 and test/audit F4/F5]** — the chokepoint's
  rules miss, measured: `setAttribute('href', x)`; the **quoted** form `href="${...}"` (which is
  the *idiomatic* style in this codebase, ~36 existing sites); case (`HREF=`); bindings split
  across lines; `.js`/`.mjs`/`.tsx` files; `srcset`/`action`/`formaction`/`poster`/`ping`;
  `location.assign` / `window.open`. **At minimum add `setAttribute` and the quoted form.**
  Also: `viaSafeHref` checks that the **file** imports `safeHref`, not that the **binding** uses it —
  a rubber-stamp entry with a false reason passes today (measured). And `ALLOWED` keys on
  `{file, trimmed line}` with **no line number**, so a byte-identical line elsewhere in the same file
  is auto-approved.
- **test F6 [MEDIUM]** — the server and client decision sets diverge on 8 of 33 inputs (audit
  measured 12 of 80), which **falsifies the invariant asserted in `safe-url.ts:10-19`**. Three
  diverge in the silent-breakage direction (server stores, client refuses to link). Add the
  differential test: emit the corpus + Go verdicts from a Go test to a fixture, read it in
  `safe-url.test.ts`, assert agreement. If you would rather amend the comment than build the test,
  argue for it — but the comment as written is false.
- **Low items** — test F7/F8/F9/F10: control-char, case-fold and bare-space branches unpinned
  (one fixture, `https://example.com/a b`, kills two); prefix-vs-membership (`httpx://evil.com/x`);
  list-position blindness (give an accept-path test **two** PRs); and the import test cannot
  attribute its rejection (assert on the message and that the payload was not persisted).

---

# EXPLICITLY NOT YOURS — do not fix, do not scope, do not file

- **audit F2 [HIGH] — the markdown/comment route.** `unsafeHTML(renderMarkdown(...))` still emits
  attacker-chosen `<a href>`, `<form action>` and `<img src>` with a **wider** scheme policy than
  this change installs and **no `target="_blank"`**. It is the honest answer to "can the attacker do
  the same thing by another route", and the answer is yes. **It belongs to the #195 markdown-sanitize
  track and I am routing it there.** Mention it in your report if it affects your reasoning; open no
  code for it.
- **CSP** (tasks #85/#91), the **`web/dist` clean-checkout defect** (#100), and the five
  auth/CORS/scope findings. All separately owned.

# THINGS THE AUDIT ESTABLISHED THAT YOU MUST NOT REGRESS

- **`target="_blank"` is load-bearing, now measured in real Chromium**: `javascript:` in an anchor
  with no target or `target="_self"` **executes**; with `target="_blank"` it **does not** (positive
  control: popups genuinely opened with the blocker disabled, so this is the navigate algorithm, not
  the popup blocker). The pin at `safe-url.test.ts:157-183` is the difference between a phishing
  affordance and script execution. Keep it and keep it fail-closed.
- **The control-character pre-check at `urlvalidate.go:53-58` is what makes the allow-list sound** —
  it removes exactly the inputs where Go's and WHATWG's tokenisers can diverge, which is why the
  exploitable intersection is empty. Do not "simplify" it into `net/url`.
- **Decision B (no base argument to `new URL()`) is correct** — a base would launder `//evil.com/x`
  into an accepted `https://evil.com/x`.
- Degrade-don't-drop rendering (inert text + `title` with the raw value) is the right call.

# Method rules

- **Do not push.** Commit locally with clear messages, one logical change per commit.
- **RED-then-GREEN for every pin you add**: show the test failing before the fix and passing after,
  and quote the **failing assertion's name and message**, not a count.
- **A negative claim needs a positive control.** Every one.
- **Predict before you measure, and report your misses.** The most valuable finding of the review
  round came from a wrong prediction its author chased.
- **Revert probes by snapshot restore (`cp` from `/tmp`), never `git checkout`** — a previous leg
  lost uncommitted work that way.
- **Exit codes from the child process, never through a pipe.**
- **Separate observation from inference and tag them differently.** A correct fact carrying a wrong
  inference is more dangerous than a wrong fact, because the fact survives verification and the
  inference rides in behind it. That is precisely how MUST 1 got missed.
- `web/.tmp-test/` is a persistent build dir that `npm test` overwrites but never cleans; a failed
  `tsc` leaves the **previous** build in place and you can measure a stale artifact. Consider adding
  `rm -rf .tmp-test` to the `test` script.

# Deliverables — you are not done until all five exist

1. All MUST items fixed, committed on `url-scheme-validation-r2`.
2. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-r2.md`** covering:
   each MUST/SHOULD with RED→GREEN evidence and named assertions; the **fresh-clone gate table**
   (`npm ci` / `npm run build` / `npm test` / `go build` / `go test` / `go vet`); what you did not
   fix and why.
3. **A project log entry** in `.design/project-log/`, committed.
4. **An explicit list of every place this brief is wrong** — counts, line numbers, paths, claims.
   My briefs have contained at least one error in every round for fifteen-plus consecutive rounds;
   this one relays findings from three separate reports and is more likely to be wrong, not less.
5. `git status --porcelain` empty, and state it.

**You MUST produce all five deliverables and then mark the task complete.**
