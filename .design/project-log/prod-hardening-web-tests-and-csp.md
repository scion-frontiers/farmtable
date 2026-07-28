# prod-hardening: web tests on the release path, and a CSP for the dashboard

Branch `prod-hardening`, base `7a0f220`. Two independent fixes, two commits:
`128d5a6` (Makefile) and `5458c43` (CSP). Both from `audit-195-r9` HIGH findings.

## What changed

**`make test` and `make web` now run the web test suite.** `npm test` at this base was a
real, passing 10-assertion suite (`web/src/utils/task-ready.test.ts`) that no Makefile target
and no documented command invoked. The release path
`make dashboard` → `make web` → `npm ci && npm run build` → `go build` embedded `web/dist` via
`//go:embed` without ever running it. Added a `web-test` target; `make test` calls it after the
Go suite, and `make web` runs `npm test` before `npm run build` so a failing test blocks the
artifact that gets embedded.

**The dashboard now serves a Content-Security-Policy** (`internal/serverapp/unified.go`). The
SPA and the gRPC-web API share one mux, one port, one origin, and that origin keeps a
long-lived API token in `localStorage`, so script execution there is credential theft rather
than defacement. Full CSP on the asset handler; `nosniff` + `Referrer-Policy` on every mux
response including the API; the native gRPC short-circuit path left untouched.

## Findings worth keeping

**`npm ci` was deliberately kept out of `test:`.** The registry is reachable here
(`npm ping` → 178ms), so it would have passed. But `make test` is the documented way to run the
Go suite, and `npm ci` requires network on every invocation; making that command fail offline
is a worse regression than the bug. The clean install stays in `web:`, the release path.

**Three Makefile targets cannot run in this container at all.** `make generate`, `make build`
and `make lint` all exit 2 at `buf: No such file or directory`. Notably `make lint` therefore
never reaches `go vet`, and `make build` — a documented command in CLAUDE.md — never reaches
`go build`. This is the same "target nobody runs" pattern the Makefile fix addresses, and it
is wider than the web-test gap alone. Recorded, not fixed.

**`gofmt -l` reports 4 pre-existing unformatted files** in `internal/serverapp`
(`linkflows_test.go`, `oauth.go`, `tokenrefresh.go`, `unified_test.go`). No target runs gofmt.
Recorded, not fixed.

**The dashboard has exactly one inline script and it is not Vite's.** It is hand-authored in
`web/index.html` (a theme bootstrap that runs before first paint) and Vite copies it into
`dist` byte-identically. `script-src` covers it by **sha256 hash**, not `'unsafe-inline'` and
not a nonce — a nonce would require per-response HTML rewriting on top of an `embed.FS`
`FileServer`. Because a hash is invisible coupling,
`TestCSPCoversInlineScriptsInEmbeddedIndex` recomputes the hash from the embedded
`web/dist/index.html` and fails with the correct replacement hash if the script is ever
edited. Verified non-vacuous by mutating the script and watching it fail.

**No CDN allowance was needed** — a real possibility that turned out not to apply. Shoelace's
icon base path is set locally (`web/src/index.ts:54`) and its 2052 icons are vendored into
`dist` by `vite-plugin-static-copy`. The only external origins anywhere in source or bundle are
`https://github.com` link `href`s, which no directive in this policy governs.

**`connect-src 'self'` is sufficient.** The server enables grpc-web websockets
(`WithWebsockets(true)`) but nothing in `web/src` ever opens one — zero hits for
`WebSocket|ws://|wss://`. If a websocket client is added later, `connect-src` must be revisited.

**`img-src` keeps `https:` on purpose.** `web/src/util/markdown.ts` is
`DOMPurify.sanitize(marked.parse(md))` with the default config, which permits `<img>`. Task
descriptions render user markdown, so remote images are an existing legitimate feature.
`media-src 'none'` does newly block markdown-embedded `<audio>`/`<video>`; judged an acceptable
hardening trade and flagged to the EM.

## Trap for the next person

Writing a test that drives a gRPC-web route through the `responseRecorder` helper in
`unified_test.go` **panics** —
`SIGSEGV` in `grpc/internal/transport.(*serverHandlerTransport).HandleStreams` — because that
helper does not implement `http.Flusher`, which the transport requires. Use the
`startHTTPServer` helper and a real listener instead.

## Verification

`go build` 0 · `go test ./...` 0 with zero failing test names (10 ok) · `go vet` 1 with the same
4 pre-existing copylocks at `server.go` 1500/1610/1818/1995, `diff`-identical to baseline ·
`npm test` 0 · `npx tsc --noEmit` 0 · `npm run build` 0 · `make web-test`/`make test`/`make web`
all 0 end to end, including the destructive `npm ci`. Headers confirmed with `curl -i` against
a live `ft dashboard`.

**Not verified: that the dashboard renders.** No browser is available in this environment. The
argument that the CSP does not break the app is static — hashed inline script, all script `src`
same-origin, no CDN subresources, icons vendored, no websocket. Someone should load the
dashboard once with devtools open and confirm the console is free of CSP violations before this
reaches production users.

The known ~8% `TestWatchTasks_NoInitial` flake did not fire in any run during this work.
