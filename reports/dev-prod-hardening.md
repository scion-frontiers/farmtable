# dev-prod-hardening — report

Branch `prod-hardening`, base `7a0f220dbd9332cb8db62138c841777432b4eda4`, tree `/workspace`.
Two commits, not pushed.

| commit | subject |
|---|---|
| `128d5a6` | build: run the web test suite on the verification and release paths |
| `5458c43` | security: serve a Content-Security-Policy with the dashboard |

---

## Headline

Both MUSTs are done and measured. Two things worth your attention before the detail:

1. **One of your three CSP hazards was real, two were false alarms** — and the real one was
   real for a *different reason than you gave*, which changes the fix. There is no
   Vite-emitted polyfill. The inline script is hand-authored in `web/index.html`. I covered
   it by sha256 hash; I did not widen `script-src`.
2. **Your `make lint` measurement is wrong in this container, and in a way that matters.**
   `make lint` does not exit 1 on the copylocks. It exits **2** at `buf: No such file or
   directory`, before `go vet` ever runs. `make build` and `make generate` fail identically.
   Three of the eight Makefile targets cannot execute here at all.

---

## MUST 1 — web tests on the release path

### The change

```makefile
.PHONY: generate build test web-test lint web web-dev dashboard decomposer

test:
	go test ./...
	$(MAKE) web-test

# Web unit tests. Deliberately does NOT run `npm ci`: it reuses the node_modules
# already in the tree so that `make test` stays runnable without network access.
# `make web` does the clean install for release builds.
web-test:
	cd web && npm test

# Release build of the web assets. Tests run before `npm run build` so a failing
# web test blocks production of the artifact that gets embedded via //go:embed.
web:
	cd web && npm ci && npm test && npm run build
```

### The `npm ci` decision, and its justification

**`npm ci` is not in `test:`.** I measured the tradeoff rather than assuming it:

- `npm ping` → **exit 0, PONG 178ms**. The registry *is* reachable in this container, so I
  could have put `npm ci` in `test:` and it would have passed here.
- I did not, because passing *here* is the wrong bar. `npm ci` deletes and reinstalls
  `node_modules` (111 MB, 59 packages) and requires network on every invocation. `make test`
  is the command CLAUDE.md, README.md and docs/architecture.md all point developers at. Making
  the documented way to run the **Go** suite fail on a plane is a worse regression than the bug
  being fixed, and it is the kind of regression that gets the whole change reverted.
- The clean install stays in `web:`, which is the release path, is already network-dependent
  via `npm ci`, and is where reproducibility actually matters.

I used a separate `web-test` target rather than inlining `cd web && npm test` into `test:` so
the web suite has a name you can invoke on its own, and so there is exactly one definition of
how to run it. `$(MAKE) web-test` keeps that single definition while letting the Go suite run
first (Go is the larger suite and the primary one; a prerequisite would have inverted the
order). `.PHONY` updated.

**Ordering in `web:`** — `npm test` runs **before** `npm run build`. The artifact that
`//go:embed all:web/dist` bakes into the binary should not be produced from a tree whose tests
fail. Testing after the build would still report the failure but would leave a shippable
`web/dist` on disk for a later `go build` to pick up.

### Positive control: can the newly-wired suite actually fail?

Wiring in a suite that cannot fail is theatre, so I checked. I replaced `isReady` in
`web/src/utils/task-ready.ts` with `return true`:

```
CONTROL_EXIT=1
Error: fallback excludes assigned accepted tasks: expected false, got true
    at assertEqual (file:///workspace/web/.tmp-test/utils/task-ready.test.js:6:15)
```

Reverted; `git status --porcelain` empty afterwards. The suite is 10 real assertions and it
exits non-zero on a named failure. **Note it prints nothing at all on success** — exit code is
the only signal, which is fine for `make` but is why nobody noticed it was never running.

### Targets I executed end to end, and targets I could not

| target | exit | notes |
|---|---|---|
| `make web-test` | **0** | ran fully |
| `make test` | **0** | ran fully — Go suite + web suite |
| `make web` | **0** | ran fully, **including the destructive `npm ci`** (`added 59 packages`, `✓ built in 3.04s`) |
| `make generate` | **2** | `buf: No such file or directory` — buf is not on PATH |
| `make build` | **2** | depends on `generate`; dies at `buf generate`, never reaches `go build` |
| `make lint` | **2** | dies at `buf lint proto`, **never reaches `go vet`** |
| `make dashboard` | not run to completion | depends on `web` (verified); its final step `./bin/ft dashboard` starts a long-lived server, so there is no terminating exit code to report. I built and ran the equivalent binary manually for MUST 2. |
| `make web-dev` | not run | starts a long-lived vite dev server |
| `make decomposer` | not run | untouched by this change |

I probed the registry with `npm ping` *before* running `npm ci`, specifically so that a network
failure would not destroy `node_modules` and leave me unable to satisfy the final gates.

### Pre-existing problems found and deliberately NOT fixed

- **`make lint` exits 2, not 1, and never runs `go vet`** (see errata #1).
- **`make build` and `make generate` are equally unrunnable here** — same missing `buf`. This
  is a third and fourth instance of the pattern you wanted recorded: `make build` is in
  CLAUDE.md as a documented command and it cannot execute in this environment.
- **`gofmt -l` reports 4 pre-existing unformatted files**: `internal/serverapp/linkflows_test.go`,
  `internal/serverapp/oauth.go`, `internal/serverapp/tokenrefresh.go`,
  `internal/serverapp/unified_test.go`. None are files I authored; both files I touched are
  clean. No Makefile target runs `gofmt`. Recorded, not fixed.

---

## MUST 2 — Content-Security-Policy

### The three hazards: one red, two green

#### Hazard 1 — inline scripts. **REAL, but not for the reason given.**

*Prediction before measuring:* real, via Vite's `modulePreload.polyfill` (defaults to true).
*Result:* real, but **that prediction was wrong about the cause.**

`web/dist/index.html` contains exactly one inline `<script>` with no `src`. It is **not**
Vite-generated. It is hand-authored in the source `web/index.html` and Vite copies it through
verbatim — I confirmed the inline bodies are **byte-identical between `web/index.html` and
`web/dist/index.html`**. It is a theme bootstrap that reads `localStorage['ft-theme']` and
toggles `sl-theme-dark` before first paint.

This changes the fix. A Vite config change — one of the three options you offered — would have
done nothing, because Vite is not generating it.

**Correction to the brief's severity claim.** You wrote that `script-src 'self'` would block it
and *"the app will not boot."* That is not correct for this script. The app bootstrap is the
**external** module `/assets/index-*.js`, which `'self'` permits. `<html>` already carries
`class="sl-theme-dark"` statically in the markup. Blocking the inline script would have cost a
light-theme user their theme preference and nothing else — a cosmetic regression, not a boot
failure. Worth knowing, because it means this hazard was never going to take the dashboard down.

**What I chose: a sha256 hash, not a nonce, not `'unsafe-inline'`.**

```
script-src 'self' 'sha256-aOXoiAodnrqbksBDmExDnXDeZYSJn1hg9f3uU5NUqgs='
```

- A **nonce** requires per-response HTML templating. Assets are served by `http.FileServer`
  over an `embed.FS`; adding nonce injection means intercepting and rewriting the HTML on every
  request. Large change, new failure modes, for one static script.
- A **hash** needs no change to any file outside my scope, and is exact.
- **`'unsafe-inline'` was never on the table** — you said don't, and it would discard the whole
  benefit.

**The hash's one weakness, and how I closed it.** A hash is invisible coupling: edit that
script by one byte and the CSP stays syntactically valid while the browser silently blocks it.
So `TestCSPCoversInlineScriptsInEmbeddedIndex` recomputes the sha256 of *every* inline script
in the **actually-embedded** `web/dist/index.html` and asserts each is present in `script-src`.
On mismatch it prints the correct replacement hash.

I verified that guard is not vacuous. Mutating 8 bytes of the inline script in `web/dist/index.html`:

```
--- FAIL: TestCSPCoversInlineScriptsInEmbeddedIndex
    need: 'sha256-txk3rQ2A1GltTsrckQfE0hss1nOqlNsxwfDtvdD2QJ0='
    have: script-src 'self' 'sha256-aOXoiAodnrqbksBDmExDnXDeZYSJn1hg9f3uU5NUqgs='
```

Restored; test green again. The test also `t.Fatal`s if it finds zero inline scripts, so it
cannot pass by finding nothing.

The hash is **stable across rebuilds** — I recomputed it after a full `npm ci && npm run build`
and it was unchanged. (The *external* asset filename did change, `index-0X1Hw_8G.js` →
`index-YVwUln1D.js`, across the `npm ci`; that is covered by `'self'` and does not affect the
hash. It does suggest the build is not byte-reproducible across dependency reinstalls — noted,
not in scope.)

#### Hazard 2 — Shoelace icons / CDN. **GREEN CONTROL. False alarm.**

*Prediction:* false alarm, because `vite-plugin-static-copy` is in devDependencies.
*Result:* confirmed false alarm.

- `web/src/index.ts:54` — `setBasePath(import.meta.env.BASE_URL + 'shoelace')`. The base path
  **is** registered, so Shoelace never reaches for its CDN default.
- `vite.config.ts` copies `@shoelace-style/shoelace/dist/assets/**/*` into `dist/shoelace/assets`.
  **2052 icons** are present in the built output; the last build logged `Copied 2053 items`.
- Tree-wide grep of `web/src` and the built bundle for external origins: the **only** hits are
  `https://github.com` (twice in source, three times in dist) and `http://www.apache.org` (a
  licence string). Zero `cdn.`, `jsdelivr`, `unpkg`, `fonts.googleapis`.
- The `github.com` hits are **not subresource loads**. One is
  `<a href=${url} target="_blank" rel="noopener">` in `ft-toolbar.ts`; one is a mock-data URL
  string in `service.ts`. Link navigation is not governed by any directive in this policy
  (there is no `navigate-to`). No allowance needed.

`TestEmbeddedIndexLoadsNoCrossOriginScripts` pins this: it fails if any `<script src>` in the
embedded index ever becomes cross-origin.

One subtlety in favour of the policy: Shoelace `<sl-icon>` fetches its SVGs via `fetch()`, so
they are governed by **`connect-src`**, not `img-src`. They are same-origin (`/shoelace/...`),
so `connect-src 'self'` covers them.

#### Hazard 3 — `connect-src` and websockets. **GREEN CONTROL. False alarm.**

*Prediction:* false alarm on the client despite the server enabling websockets.
*Result:* confirmed false alarm.

The server does enable them — `unified.go:47-48`, `grpcweb.WithWebsockets(true)` and
`WithWebsocketOriginFunc`. So your inference that "a websocket path plausibly exists" was
reasonable. But **the client never uses it**: grepping `web/src` for
`WebSocket|ws://|wss://|websocket` returns **zero** hits. The server-side capability is
enabled and unused. `connect-src 'self'` is sufficient; no `ws:`/`wss:` allowance is needed,
and adding one speculatively would have widened the policy for nothing.

(If a websocket client is ever added, `connect-src 'self'` will need revisiting — the same-origin
`ws://` case is exactly the engine-dependent grey area you flagged. Worth a note wherever that
work lands.)

### Two further measurements that shaped the policy

- **`img-src` keeps `https:`.** `web/src/util/markdown.ts` is
  `DOMPurify.sanitize(marked.parse(md))` with the **default** config, which permits `<img>`.
  Task descriptions render user markdown, so remote images are a legitimate existing feature.
  Tightening to `img-src 'self' data:` would have broken real content. I kept the auditor's
  `'self' data: https:`.
- **`media-src 'none'` is a deliberate, small behaviour change.** Default DOMPurify also permits
  `<audio>`/`<video>`, so markdown-embedded media will now be blocked. I judged this an
  acceptable hardening trade (it is not a dashboard break, and it is an edge case), but I am
  flagging it rather than letting you discover it. Say the word and I'll drop the directive.
- **The blob download still works.** `ft-toolbar.ts:494` does
  `URL.createObjectURL` → `a.href` → `a.download` → `a.click()`. That is a download, not a
  subresource fetch or a form submission, and no directive in this policy governs it.

### Scoping: what I wrapped, and why

The mux (`unified.go:153-155` post-change) routes `/farmtable.v1/` and
`/farmtable.v1.FarmTableService/` to gRPC-web and `/` — the catch-all — to the asset
`FileServer`. Session/OAuth/link-flow routes are conditionally registered on the same mux.

- **Full CSP on the asset handler only.** A CSP governs documents and the subresources they
  load; it is meaningful on the SPA and inert on a gRPC-web response.
- **`nosniff` + `Referrer-Policy` on every mux response**, API routes included — you asked me to
  decide deliberately, and nosniff on the API is worth having.
- **The native gRPC path is untouched.** `unified.go` short-circuits to `grpcServer.ServeHTTP`
  before the mux when `ProtoMajor == 2` and the content-type is `application/grpc` but not
  `application/grpc-web`. That response carries protocol metadata, not a browser-interpreted
  body; injecting HTTP headers there would surface as gRPC metadata. I return before setting
  anything.

A test asserts the API route has **no** CSP, so this scoping decision fails loudly if reversed
by accident.

### RED → GREEN evidence

The first RED was only a **compile** failure (`undefined: cspPolicy`), which is weak evidence.
So I implemented the policy and middleware, then removed **only the two wiring call sites**,
leaving everything compiling, to get a behavioural RED with names:

```
--- FAIL: TestSecurityHeadersOnDashboardSPA (0.00s)
        Content-Security-Policy = "" want "default-src 'self'; script-src 'self' 'sha256-...'"
        X-Content-Type-Options = "", want "nosniff"
        Referrer-Policy = "", want "no-referrer"
--- PASS: TestCSPPinsCredentialTheftDirectives
--- FAIL: TestSecurityHeadersOnGRPCWebAPI (0.00s)
--- PASS: TestCSPCoversInlineScriptsInEmbeddedIndex
--- PASS: TestEmbeddedIndexLoadsNoCrossOriginScripts
RED_EXIT=1
```

**The two failing test names are `TestSecurityHeadersOnDashboardSPA` and
`TestSecurityHeadersOnGRPCWebAPI`.** The three that pass in the RED state are the policy-content
and asset-inspection guards, which correctly do not depend on the wiring. Wiring restored:

```
--- PASS: TestSecurityHeadersOnDashboardSPA
--- PASS: TestCSPPinsCredentialTheftDirectives
--- PASS: TestSecurityHeadersOnGRPCWebAPI
--- PASS: TestCSPCoversInlineScriptsInEmbeddedIndex
--- PASS: TestEmbeddedIndexLoadsNoCrossOriginScripts
GREEN_EXIT=0
```

One implementation note: the API-route test drives a **real listener** rather than the package's
existing `responseRecorder` helper. My first attempt panicked —
`SIGSEGV` in `grpc/internal/transport.(*serverHandlerTransport).HandleStreams` — because that
helper does not implement `http.Flusher`, which the gRPC-web transport requires. Using
`startHTTPServer` (already in `unified_test.go`) avoids it and is closer to production anyway.
**That is a latent trap for anyone else writing gRPC-web tests in this package.**

### Headers measured off a live server

`go build -o /tmp/ft-csp ./cmd/ft` then `ft-csp dashboard --port 18099`, then `curl -i`:

**`GET /` (SPA):**
```
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-aOXoiAodnrqbksBDmExDnXDeZYSJn1hg9f3uU5NUqgs='; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; connect-src 'self'
Content-Type: text/html; charset=utf-8
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

**`GET /assets/index-YVwUln1D.js`:** same three headers.

**`POST /farmtable.v1.FarmTableService/GetVersion`** (`Content-Type: application/grpc-web+proto`):
```
HTTP/1.1 200 OK
Grpc-Status: 2
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Vary: Origin
```
No `Content-Security-Policy`, as intended. (grpc-web additionally echoed the two new headers
into `Access-Control-Expose-Headers`; harmless.)

Server stopped, temp binary and temp DB removed.

### What I could NOT verify — read this before shipping

- **I did not confirm the dashboard renders.** There is no browser in this environment. I ran
  no headless Chrome, no Playwright, no page load. **Nothing in this report is end-to-end
  verification of the UI.**
- Consequently I have **not** observed zero CSP violations in a devtools console. My evidence
  that the policy does not break the app is *static*: the built bundle's inline scripts are
  hashed, every script `src` is same-origin, there are no CDN subresources, Shoelace's base path
  is local with 2052 icons vendored, and no websocket is used. That is a strong argument. It is
  not a page load.
- **Recommendation: someone should load the dashboard once with devtools open** and confirm the
  console is free of CSP violations before this reaches production users. The one thing I would
  watch for is a runtime-injected `<style>` or a dynamically-created script from a dependency
  that static inspection cannot see.
- I did not test any auth mode other than the default. OAuth/IAP/link-flow routes get the base
  headers by construction (they are on the same mux) but I exercised none of them.
- I did not run the integration suite (`-tags integration`); no Postgres available.

---

## Final gates

Every exit code below is from the child process directly, never through a pipe.

| gate | required | measured |
|---|---|---|
| `go build ./...` | 0 | **0** |
| `go test ./...` | 0, zero failing names | **0**, 10 ok, **zero** `--- FAIL` lines |
| `go vet ./...` | 1, same 4 copylocks | **1**, `diff` against my baseline capture: **identical** |
| `cd web && npm test` | 0 | **0** |
| `cd web && npx tsc --noEmit` | 0 | **0** |
| `cd web && npm run build` | 0 | **0** |
| `git status --porcelain` | empty | **empty** |

Vet lines: `internal/server/server.go` at **1500, 1610, 1818, 1995**, all
`assignment copies lock value to ephReq: … contains sync.Mutex`. Messages and line numbers both
match your baseline exactly.

**On the `TestWatchTasks_NoInitial` flake:** it did **not** fire in any of my runs. I ran the
full suite twice and `./internal/serverapp/` several more times; zero failures, and I read
`--- FAIL` **names** rather than counting `FAIL` lines every time. So I cannot confirm the ~8%
rate from my own data — I simply never saw it. It remains unfixed and unaddressed by this work.

---

## Deliverable 4 — every place the brief was wrong

Thirteen consecutive rounds, then. Five items, roughly in descending order of consequence.

1. **`make lint` does not exit 1, and does not run `go vet`.** You wrote, tagged
   **`[MEASURED by me]`**: *"`make lint` already exits 1 at this base — it runs `go vet ./...`,
   which has the 4 pre-existing copylocks."* Measured here: **exit 2**, output
   `buf lint proto` / `make: buf: No such file or directory` /
   `make: *** [Makefile:20: lint] Error 127`. The `lint` target runs **`buf lint proto` first**,
   and `buf` is not on PATH in this container, so `go vet` is never reached. The target is
   broken, but not for the reason you recorded and not with the exit code you recorded.
   The same missing `buf` also breaks **`make generate`** and **`make build`** (exit 2 each) —
   `make build` depends on `generate`. Your point stands and is in fact *stronger* than you
   made it: it is not one unrun target, it is three, one of which is a documented command in
   CLAUDE.md.

2. **The inline-script hazard is real but your diagnosis and severity are both wrong.** You
   attributed it to Vite (*"Vite can emit an inline module-preload polyfill and inline bootstrap
   script"*) and offered *"a Vite config change"* as a remedy. There is no Vite-emitted inline
   script; the single inline script is hand-authored in `web/index.html` and passed through
   byte-identically, so a Vite config change would have fixed nothing. You also wrote
   `script-src 'self'` would mean *"the app will not boot"* — it would not have. The bootstrap
   is the external module script, and the theme class is already in the static markup; the cost
   would have been a lost theme preference. Right hazard, wrong cause, overstated severity.

3. **`unified.go:97-99` is off by two.** The one-mux/one-origin claim cites lines 97-99. At
   `7a0f220` the three `mux.Handle` lines are **99, 100, 101** (verified with
   `git show 7a0f220:internal/serverapp/unified.go`). Lines 97-98 are the closing brace of the
   link-flow block and a blank line. Trivial, but this is the class of error you flagged in your
   own preamble — a location relayed without re-indexing to the tree.

4. **"This base is `origin/main`" — there is no `main` ref in this clone.** `git rev-parse
   origin/main` → `fatal: ambiguous argument 'origin/main': unknown revision`. The only refs are
   `markdown-sanitize` (local + remote) and `prod-hardening`; `origin/HEAD` points at
   `origin/markdown-sanitize`, and `origin` is a local path (`/workspace/farmtable-em-verify195`),
   not a hosted remote. `7a0f220` **is** the merge-base of `prod-hardening` and
   `origin/markdown-sanitize`, so your *intent* — "the common base both branches came from" — is
   correct and I proceeded on it. But I could not verify the claim "the code that is LIVE IN
   PRODUCTION" from anything in this clone, and I want to be clear I took it on trust rather
   than confirming it.

5. **Minor: `.github` does exist.** Your table says `.github/workflows  does not exist. 0 files.`
   — correct as written, and I confirmed it. But `.github/` itself is present with
   `ISSUE_TEMPLATE/` and `PULL_REQUEST_TEMPLATE.md`. Anyone acting on the table alone might
   conclude the directory is absent and create it. Not an error, a readability trap.

**Claims I re-measured and found CORRECT** (a negative claim needs a positive control, including
for your brief):

- Baseline table: `go build` 0, `go test` 0 / **10 ok / 0 failing**, `npm test` 0,
  `npm run build` 0, `git status` empty — all exactly as stated.
- `go vet`: **exactly 4** copylocks at **1500, 1610, 1818, 1995**, messages identical. Correct.
- `.github/workflows` absent; `.git/hooks` non-sample **0 files**. Correct.
- Makefile line refs `:9 test:`, `:16 web:`, `:19 dashboard:`. All correct.
- `web/package.json` `build: tsc --noEmit && vite build`, no test. Correct.
- `npm test` is a real passing suite, not a placeholder. Correct — and I went further and proved
  it can fail.
- `web/src/gen/grpc-client.ts:419` holds `localStorage.getItem('farmtable.token')`. **Correct,
  exact line.**
- `internal/server/scopes.go:83` is `if len(scopes) == 0 {` with `return nil`. **Correct, exact line.**
- `internal/cli/dashboard.go:124` is `listenAddr := fmt.Sprintf(":%d", port)` — 0.0.0.0 bind
  while the CLI prints `http://localhost:%d` (line 166). **Correct.**
- `unified.go:46-48` `WithOriginFunc` returning `true` for every origin. **Correct, exact lines.**
- No CSP anywhere in the tree before this change. Correct.

---

## Deliverable 5 — what I deliberately did not do

- **No CI config.** No `.github/workflows`, nothing. Explicitly out of scope; it is the repo
  owner's product decision and you are re-routing it.
- **Did not fix `make lint`** — you asked for it recorded, not bundled. I also did not fix the
  four `go vet` copylocks, the missing `buf`, or the four `gofmt -l` files.
- **Did not touch another leg's files.** Zero edits to `internal/server/server.go`,
  `internal/server/export_import.go`, or `web/src/components/**`. I *read* `ft-toolbar.ts` and
  `web/src/util/markdown.ts` to measure the blob download and the sanitizer's image handling;
  read-only, no edits. **No overlap with `dev-xss-url` occurred and I never needed one of their
  files.** My diff is exactly `Makefile`, `internal/serverapp/unified.go`, and the new
  `internal/serverapp/security_headers_test.go`.
- **Did not edit `web/index.html`**, even though it holds the inline script driving the hash
  decision. It is outside the file scope you set. The hash approach let me stay inside it —
  but note that a future maintainer's cleaner fix is to move that script into a module, which
  would let the hash be dropped entirely. Someone with scope over `web/` should consider it.
- **Did not widen `script-src`.** No `'unsafe-inline'`, no nonce infrastructure.
- **Did not act on the auth/CORS/scopes findings** — `FARMTABLE_OPEN_ACCESS`, the 0.0.0.0 bind,
  permissive CORS (`WithOriginFunc` → always true), the empty-scopes wildcard, inert
  protovalidate. All confirmed present; all filed to the investigator, none touched. I note that
  the permissive CORS and the 0.0.0.0 bind materially raise the value of this CSP, and lower it
  if they are ever "fixed" by tightening only one of them.
- **Did not add `X-Frame-Options: DENY`.** `frame-ancestors 'none'` covers every browser that
  supports CSP, and I kept to the auditor's header set rather than expanding scope.
- **Did not merge, rebase, or cherry-pick** from `markdown-sanitize` or any other branch.
- **Did not push.** Both commits are local on `prod-hardening`.
- **Did not add `web/dist` to git or modify `.gitignore`.**
