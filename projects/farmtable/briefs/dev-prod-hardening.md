# dev-prod-hardening — run the tests on the release path, and put a CSP behind the dashboard

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `prod-hardening` and commit **`7a0f220dbd9332cb8db62138c841777432b4eda4`**.
**Do NOT create any directory named in this brief.**

**This base is `origin/main` — the code that is LIVE IN PRODUCTION.** That is deliberate: both
fixes must be mergeable and deployable on their own, without waiting on two in-flight
workstreams that have not merged in nine and ten rounds respectively. **Do not merge, rebase
onto, or cherry-pick from any other branch.**

`web/dist` and `web/node_modules` are present and gitignored. **Leave them.** `go build` fails
with `pattern all:web/dist: no matching files found` without `web/dist`.

## Baseline `[MEASURED by me at 7a0f220 in this exact clone]`

| check | result |
|---|---|
| `go build ./...` | exit 0 |
| `go test ./...` | exit 0, **10 packages ok, 0 failing tests** |
| `go vet ./...` | exit 1, **exactly 4** copylocks in `internal/server/server.go` at **1500, 1610, 1818, 1995**, all `assignment copies lock value to ephReq: …contains sync.Mutex` |
| `cd web && npm test` | exit 0 — `tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js` |
| `cd web && npm run build` | exit 0 |
| `git status --porcelain` | empty |

Those 4 vet findings are pre-existing and expected. **Compare messages and line numbers, not
the count** — the line numbers differ between branches, the messages do not.

### A live demonstration of the measurement hazard, from my own baseline run

**My first `go test ./...` in this clone exited 1.** `grep -c '^FAIL'` said **3**. Both
numbers were misleading and I nearly wrote them into this brief as your baseline.

- The `3` was **output lines**, not tests: a bare `FAIL`, the `FAIL github.com/…/internal/server`
  package line, and another bare `FAIL`. Counting the wrong noun.
- The actual content was **one** test: `--- FAIL: TestWatchTasks_NoInitial (5.01s)`,
  `watch_test.go:118: timed out waiting for event`.
- I re-ran `./internal/server/` **five times: 5/5 exit 0, zero failing tests.** Full suite
  re-run: exit 0, 10 ok, 0 failing.

This is the known flake, independently measured at roughly **8% per full-suite run**
`[MEASURED-BY-test-194-r8]`, and it fired on my very first run here. **If you see a
`TestWatchTasks*` failure, re-run before believing it.** And always read failing test
**names**, never counts. **There is no CI on this project** — see MUST 1, that is the point of
this task — so nothing downstream catches what you miss.

## How to treat this brief

Tags: `[MEASURED]` = I ran it this session, in this clone. `[MEASURED-BY-<leg>]` = relayed,
**re-measure against YOUR base before relying on it**. `[BELIEVED]` = neither.

**My briefs have contained at least one error in twelve consecutive rounds.** Listing every
place this brief is wrong is a **required deliverable**.

**Tonight's error is the one to learn from:** I relayed a leg's `[MEASURED]` fact about a file
into a brief for a different base — where that file **does not exist at all**. A measurement is
indexed to a tree. Every relayed claim below is tagged; re-base it before you trust it.

---

# Where this task came from

`audit-195-r9`, an independent security audit, returned REQUEST CHANGES on a workstream whose
diff it found safe. Its two HIGH findings were both **outside** that diff. You have the two
that belong to the build and serving layer. The coordinator approved both; one of them they
explicitly waived pre-review on because it is small and low-risk.

---

# MUST 1 — no path in this repository runs the web tests

## The finding `[MEASURED-BY-audit-195-r9; every line below re-measured by me at 7a0f220]`

```
.github/workflows            does not exist. 0 files.
.git/hooks (non-sample)      0 files.
Makefile:9   test:           go test ./...              <- does NOT run npm test
Makefile:16  web:            cd web && npm ci && npm run build
Makefile:19  dashboard: web  go build -o bin/ft ./cmd/ft && ./bin/ft dashboard
web/package.json build:      tsc --noEmit && vite build  <- no test
CLAUDE.md / README.md / docs/architecture.md   document `go test ./...` only.
```

So the release path is `make dashboard` → `make web` → `npm ci && npm run build` → `go build`,
assets embedded via `//go:embed all:web/dist` — **and the web test suite is never executed.**
`make test` runs the Go suite and stops.

**A point the auditor did not make, which I measured and which makes this concrete today:**
`npm test` at this base is **not a placeholder**. It is
`tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js` and it **passes, exit 0**
`[MEASURED by me]`. So there is a real, working, passing web test suite at `main` right now
that **no Makefile target and no documented command invokes.** This is not preparation for a
future guard — it is an existing suite that is already unrun. (It becomes far more important
when #195's 4,610-line sanitizer guard lands, but you do not need that to justify the fix, and
**that branch is not yours — do not reference or depend on it**.)

## What to do

Wire `npm test` into both the verification target and the release target:

```makefile
test:
	go test ./...
	cd web && npm ci && npm test

web:
	cd web && npm ci && npm test && npm run build
```

That is the auditor's recommendation and the coordinator approved it. **Treat it as a
direction, not a specification** — you are closer to the file than either of us. In particular:

- **Decide whether `npm ci` belongs in `test:`.** It is in `web:` already. `npm ci` deletes and
  reinstalls `node_modules` and **requires network**. If `make test` becomes network-dependent,
  a developer offline can no longer run the Go tests through the documented command — that
  would be a regression, and arguably a worse one than the bug you are fixing. Consider `npm
  test` alone in `test:`, with a comment, or a separate `web-test:` target that `test:` depends
  on. **Measure, decide, and justify the choice in your report.**
- **Ordering in `web:`** — test before or after `npm run build`? Before means a broken test
  blocks the artifact, which is the point. Say why you chose what you chose.
- Keep `.PHONY` accurate if you add a target.

## Known hazards, measure rather than assume

1. **`npm ci` may not work in your container** (no network). If it does not, **say so
   explicitly and report exactly which targets you could and could not execute end to end.**
   Do not report a target as working because it looks right. A brief that claims an unrun
   command works is the defect class this whole project is about.
2. **`make lint` already exits 1 at this base** `[MEASURED by me]` — it runs `go vet ./...`,
   which has the 4 pre-existing copylocks. **Report this, do not fix it.** It is a third
   instance of the same pattern (a target nobody runs, because it has been failing long enough
   that everyone stopped) and I want it recorded, not bundled into your change.
3. **`web/dist` is gitignored but embedded.** Do not add it to git and do not change
   `.gitignore`.

## Out of scope for MUST 1

**DO NOT add a GitHub Actions workflow or any CI configuration.** The auditor recommends one
and they are right, but CI was previously deferred as a product decision by the repository
owner, and the coordinator is re-routing it to him with the changed premise ("no CI was
tolerable if the release path ran the tests; it doesn't"). That decision is not yours or mine
to pre-empt. **Makefile only.**

---

# MUST 2 — no Content-Security-Policy on an origin that holds a long-lived API token

## Why this is worth more than it looks

The auditor's trust-boundary trace, `[MEASURED-BY-audit-195-r9]` — **verify the ones your fix
depends on; I have not re-measured these myself**:

- Web assets and the gRPC-web API are served from **one mux, one port, one origin**
  (`internal/serverapp/unified.go:97-99`).
- That origin holds a **long-lived API token in `localStorage`**
  (`web/src/gen/grpc-client.ts:419`, `localStorage.getItem('farmtable.token')`).
- Authorization is coarse: `internal/server/scopes.go:83`, `if len(scopes) == 0 { return nil }`
  — empty scopes is a wildcard.
- Default bind is `:PORT`, i.e. **0.0.0.0** (`internal/cli/dashboard.go:124`), while the CLI
  prints `http://localhost:%d`.
- gRPC-web CORS accepts **every** origin (`unified.go:46-48`, `WithOriginFunc` returns `true`).
- **No CSP anywhere** — no meta tag in `web/index.html`, no Go handler setting the header.
  `[MEASURED-BY-audit-195-r9: zero occurrences tree-wide outside an unrelated test name]`

So script execution in the dashboard origin is not defacement — it is **theft of a credential
with write access to every task in every collection**. And there is nothing behind the markdown
sanitizer: it is not one layer of defence, it is the only one.

`script-src 'self'` alone makes every `javascript:` and inline-handler vector that a
nine-round sanitizer workstream has been chasing **non-exploitable**. `form-action 'none'`
independently kills the phishing form that the sanitizer's `FORBID_TAGS` exists to prevent.

## What to do

Add security headers to the **asset handler** in `internal/serverapp/unified.go`. The
auditor's starting point:

```go
func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Security-Policy",
            "default-src 'self'; "+
            "script-src 'self'; "+
            "style-src 'self' 'unsafe-inline'; "+   // Lit adoptedStyleSheets / Shoelace
            "img-src 'self' data: https:; "+
            "media-src 'none'; object-src 'none'; base-uri 'none'; "+
            "frame-ancestors 'none'; form-action 'none'; connect-src 'self'")
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("Referrer-Policy", "no-referrer")
        next.ServeHTTP(w, r)
    })
}
```

**This policy is a HYPOTHESIS, not a specification. Do not ship it unmeasured.** A CSP that
breaks the dashboard is far worse than no CSP, because it will be reverted wholesale and take
the good part with it.

## The three specific ways this can break, all measurable

1. **Inline scripts in the built bundle.** Vite can emit an inline module-preload polyfill and
   inline bootstrap script depending on config and target. If `web/dist/index.html` contains
   any inline `<script>` without a nonce or hash, **`script-src 'self'` will block it and the
   app will not boot.** *Measure this directly:* build, then inspect `web/dist/index.html` and
   every emitted asset for inline script content. If present, your options are a hash-based
   `script-src`, a nonce, or a Vite config change — **report which you chose and why**.
2. **Shoelace icons and any other CDN asset.** Shoelace's default icon library resolves from a
   CDN unless a local base path is registered. Under `default-src 'self'` those requests are
   blocked and icons silently disappear. *Measure:* grep the source and the built bundle for
   external origins (`https://cdn.`, `jsdelivr`, `unpkg`, `fonts.googleapis`, etc.), and check
   whether a Shoelace base path is set. If anything legitimately loads cross-origin, the policy
   must permit exactly that origin — **name it, do not widen the directive**.
3. **`connect-src 'self'` and gRPC-web.** The dashboard talks to the API on the same origin, so
   this should be fine — **but confirm it, including any websocket** (`ws:`/`wss:` are not
   covered by `connect-src 'self'` in all engines' interpretations when the scheme differs).
   `unified.go:46-48` mentions a websocket origin func, so a websocket path plausibly exists.

**Scope the middleware correctly.** These headers belong on the **asset/SPA handler**, not
necessarily on the gRPC-web API routes — check what the mux actually routes and say what you
wrapped. A CSP on an API response is harmless but pointless; **`nosniff` on API responses is
worth having.** Decide deliberately.

## Verification bar for MUST 2 — be honest about the ceiling

You almost certainly cannot run a real browser here. So:

- **What you CAN do:** start the server, `curl -i` the SPA route and an API route, and show the
  actual response headers. Assert the exact header values. Inspect the built `index.html` and
  assets for inline scripts and cross-origin references. Add a Go test that asserts the headers
  are present on the routes you wrapped — **that test is the deliverable that keeps this from
  rotting**, and per this project's standing rule it must be RED without your change.
- **What you CANNOT do:** confirm the dashboard actually renders. **Say so explicitly.** Do not
  imply end-to-end verification you did not perform.
- If your static analysis finds anything that *would* be blocked, **do not paper over it by
  widening the policy to `'unsafe-inline'` for scripts.** That would silently discard the
  entire benefit. Report it and stop; I will route it.

---

# Sequencing and scope boundaries

- **Two separate commits**, one per MUST. They are independent fixes to different layers and
  should be reviewable and revertable separately.
- **Another leg (`dev-xss-url`) is working from this same base** on branch
  `url-scheme-validation`. It owns `internal/server/server.go`,
  `internal/server/export_import.go`, and the `web/src/components/**` inspector components.
  **Do not touch those files.** Your files are `Makefile` and `internal/serverapp/unified.go`
  plus whatever test files you add. There should be **zero** overlap; if you find yourself
  needing to edit one of theirs, **stop and report to me** rather than proceeding.
- **DO NOT** add CI config, invert the markdown sanitizer to an allow-list, touch
  `web/src/util/markdown.*`, or act on the auth/CORS/scopes findings (`FARMTABLE_OPEN_ACCESS`,
  0.0.0.0 bind, permissive CORS, empty-scopes wildcard, inert protovalidate). All are filed and
  routed; an investigator is being stood up to verify them. **Not yours.**

---

# Verification bars

- **Exit codes come from the child process, never through a pipe.** A prior round in this
  project measured a build wrong because it piped through `tail`.
- **A negative claim needs a positive control** — including mine. My own baseline run in this
  clone produced a misleading number and I only caught it by re-running and reading names.
- **Predict before measuring**, and report the prediction next to the result.
- **A green control is a finding.** If a hazard I named above does not materialise — no inline
  scripts, no CDN references — **that is a result, report it as one.** I expect at least one of
  my three CSP hazards to be a false alarm; I do not know which.
- Revert every experiment; assert `git status --porcelain` empty afterwards.

# Final gates — child-process exit codes

`go build ./...` = 0 · `go test ./...` = 0 with **zero failing test names** (re-run any
`TestWatchTasks*` failure before believing it) · `go vet ./...` = 1 with the **same 4**
copylocks and the **same messages** · `cd web && npm test` = 0 · `cd web && npx tsc --noEmit`
= 0 · `cd web && npm run build` = 0 · `git status --porcelain` empty.

# Deliverables — you are not done until all five exist

1. **Two commits on `prod-hardening`.** Clear messages. **Never push.**
2. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/dev-prod-hardening.md`**
   — for MUST 1: which targets you executed end to end and which you could not, and why; your
   `npm ci` decision with its justification. For MUST 2: the exact headers measured off a live
   response, your findings on all three breakage hazards, the RED-then-GREEN evidence for the
   header test with the failing test **name**, and an explicit statement of what you could not
   verify.
3. **A project log entry** in `.design/project-log/`, **committed**.
4. **An explicit list of every place this brief was wrong.** If nothing, say so and say what
   you checked. Twelve consecutive rounds; assume there are more.
5. **A statement of anything you deliberately did not do, and why.**

**You MUST produce all five deliverables and then mark the task complete.**

**Do NOT push.** Pushing is the manager's job and mine alone.
