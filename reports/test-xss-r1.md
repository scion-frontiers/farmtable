# test-xss-r1 — test-engineering review of `url-scheme-validation` @ `d4c4e6b`

Clone: `/workspace` (`git rev-parse --show-toplevel` = `/workspace`), branch `url-scheme-validation`,
HEAD `d4c4e6b629ade1d0725bc303c0acf962838f03c9`, `git status --porcelain` empty before and after
all work. Everything below is `[MEASURED by me in this clone]` unless labelled otherwise.

## VERDICT: **REQUEST CHANGES**

The *implementation* is sound — I found no way to get a `javascript:`/`data:`/`vbscript:` URL past
either half of it. The *tests* are not. Three separate defects, each independently sufficient:

- **F1 (Critical).** The entire frontend test suite cannot run from a clean checkout. `jsdom`,
  `@types/jsdom` and `@types/node` are all required by the new test files and are in **neither**
  `package.json` **nor** `package-lock.json`. `make web` runs `npm ci`, which prunes them.
- **F2 (Critical).** `safeHref()`'s scheme allow-list — the whole point of the frontend change —
  can be **deleted entirely**, or **widened to include `javascript:`, `data:` and `vbscript:`**,
  and the suite stays green. **0 of 21** fixtures in the rejection table isolate it.
- **F3 (High).** The two production render functions can be made to **bypass `safeHref()`
  completely** and nothing goes red. The DOM test asserts against a *copy* of the guarded render
  shape declared inside the test file, not against `renderPrLink`/`renderExternalSourceLink`.

F2 and F3 are both instances of the brief's unifying defect, in the sharpest possible form.

The Go side is in much better shape and I would approve it on its own, with three noted gaps
(G4, G6/G7/G8, G11/G27).

---

## 0. Method, and the flake control (asked for explicitly)

**63 mutation cells** (24 Go + 39 web) plus 5 loop-emptying census cells and a 33-input
differential probe. Every cell: back up the files → apply an exact-string mutation via a script
that **aborts if its anchor text does not appear exactly N times** → run the suite as a child
process (exit code read directly, never through a pipe) → restore from the backup copy → assert
`git status --porcelain` is empty. `TREE_DIRTY_AFTER_RESTORE=0` on all 68 cells.

**I never used `git checkout` to revert.** Restores are `cp` from a `/tmp` snapshot taken before
each cell, and for `web/src` a wholesale `rm -rf` + `cp -a` of the whole directory (so injected
files are also removed). This is deliberate: the author's self-reported accident was a
`git checkout` on an uncommitted file, and a snapshot restore is immune to that failure mode
regardless of what is or is not committed.

### Flake control

`TestWatchTasks*` cannot fire in my Go matrix **by construction, not by luck**. Every Go cell runs:

```
go test ./internal/server/ -count=1 -v \
  -run 'TestValidateURLField|TestRPC_UpdateTask_RejectsScriptURL|TestRPC_UpdateTask_AcceptsHTTPURLs|TestRPC_ImportCollection_RejectsScriptURLs|TestRPC_ImportCollection_AcceptsHTTPURLs'
```

- Verified against the `-v` baseline that `TestWatchTasks` matches **0** lines in the selected set.
- The runner greps each RED output for `TestWatchTasks` and prints `!!! WATCHTASKS PRESENT` if
  found. It never fired across all 24 Go cells.
- **I read failing test NAMES and assertion messages for every RED cell**, never `grep -c`.
- Web cells are single-threaded Node with no timeouts — no flake surface at all.

Independently, on three sequential unrestricted `go test ./...` runs the flake fired **1 of 3**
(`--- FAIL: TestWatchTasks_NoInitial (5.01s)`, `watch_test.go:118: timed out waiting for event`);
runs 2 and 3 were clean at 10 ok packages / 22 no-test-files. So the flake is real and reproduced
here. n=3 is too small to contradict the 8% figure, but it is not evidence *for* it either.

---

## 1. Finding F1 — the frontend suite is unrunnable from the repository `[CRITICAL]`

**Reproduction:**

```bash
cd /workspace/web
grep -c jsdom package.json package-lock.json     # -> 0 and 0
grep -c '"@types/node"' package-lock.json        # -> only as vite's OPTIONAL peerDependency
npm ls jsdom @types/node @types/jsdom
#   ├─┬ @types/jsdom@28.0.3 extraneous
#   ├── jsdom@26.1.0 extraneous
```

`safe-url.test.ts` imports `jsdom` and `node:fs/path/url`; `url-binding-scan.test.ts` imports
`node:fs/path/url`. The pre-existing `task-ready.test.ts` imports **no** node builtins, so all
three packages are new requirements introduced by `f0ab53f`, and none was declared.

**Measured, by hiding each package in turn and re-running `npm test`:**

| hidden | exit | effect |
|---|---|---|
| `jsdom` only | **1** | compiles; `ERR_MODULE_NOT_FOUND` at runtime |
| `@types/node` only | **2** | 7 × `TS2307: Cannot find module 'node:fs'…` |
| `@types/jsdom` only | **2** | 8 × TS errors — *including* `node:fs`, because `@types/node` is only pulled into the program by `@types/jsdom`'s `/// <reference types="node" />` |
| all three | **2** | 8 TS errors |
| none (baseline) | **0** | `safe-url: ok`, `url-binding-scan: ok` |

`tsconfig.json` sets `"types": ["vite/client"]`, which excludes `@types/node` from automatic
inclusion; it is reaching the program **only** transitively through an undeclared, extraneous
package. `make web` is `cd web && npm ci && npm run build`. `npm ci` deletes `node_modules` and
reinstalls exactly the lockfile → all three vanish → `npm test` cannot compile.

The author's gate table reports `npm test` → **0**. That is true *in this container* and false
*in the repository*. It is a green result produced by state that is not under version control —
the exact shape of defect this review is looking for, in the evidence rather than the code.

**Fix:** add `jsdom`, `@types/jsdom` and `@types/node` to `devDependencies` and regenerate the
lockfile. (Do **not** conflate this with the Makefile track — this defect exists even after a
`npm test` target is added.)

---

## 2. Finding F2 — `safeHref`'s scheme allow-list is not pinned by anything `[CRITICAL]`

`safeHref()` has two rejection guards:

```ts
if (!SAFE_SCHEMES.has(parsed.protocol)) return undefined;   // the allow-list
if (parsed.hostname === '') return undefined;               // the host check
```

**Each can be deleted individually and the suite stays green.**

| cell | mutation | result |
|---|---|---|
| **W31** | delete the scheme allow-list check entirely | **GREEN — survived** |
| **W4** | delete the hostname check entirely | **GREEN — survived** |
| **W29** | `SAFE_SCHEMES = {http:, https:, javascript:, data:, vbscript:}` | **GREEN — survived** |
| **W30** | `SAFE_SCHEMES += ftp:` | **GREEN — survived** |
| **W28** | `SAFE_SCHEMES += mailto:` | **GREEN — survived** |
| W45 | delete **both** guards (positive control) | RED ✔ `safeHref("javascript:alert(1)") should be undefined` |

**Root cause, measured.** I evaluated every one of the 21 rejection fixtures against the WHATWG
parser and classified which guard actually rejects it:

```
DENOMINATOR: 21 rejection fixtures
  parse-throws, neither guard reached:    5   (//evil.com/x, /relative/path, not-a-url, http://, '')
  rejected by BOTH guards independently: 16
  rejected ONLY by the scheme allow-list: 0   <-- nothing pins it
  rejected ONLY by the hostname check:    0
```

Every script-bearing scheme in the table (`javascript:`, `data:`, `vbscript:`, `blob:`, `file:`,
`mailto:`) is a *non-special* scheme, so `new URL(...).hostname === ''` for all of them. The
hostname check — which exists for a completely different reason (`http:/\/\evil.com`) — silently
double-covers the entire table. Widening the allow-list to include `javascript:` therefore changes
no observable behaviour *for any fixture in the file*.

**The 21-row table has one oracle and 21 inputs that all exercise the same redundant path.** The
row count is not the measurement; the number of rows that discriminate is, and it is 0.

**Missing fixtures that would fix this** — a scheme that is *special* (so it parses with a host)
but not allow-listed:

```ts
['ftp',  'ftp://evil.com/x'],
['ws',   'ws://evil.com/x'],
['wss',  'wss://evil.com/x'],
```

Each of these is rejected only by the allow-list. Adding any one kills W29/W30/W31.

---

## 3. Finding F3 — no test exercises the real render path `[HIGH]`

`safe-url.test.ts::testPayloadNeverReachesHrefAttribute` declares its own `renderGuarded()` inside
the test file and asserts against that. The production functions are
`ft-inspector-code.ts::renderPrLink` and `ft-inspector-meta.ts::renderExternalSourceLink`. They are
never imported, never called, never asserted on.

| cell | mutation | prediction | result |
|---|---|---|---|
| **W39** | `renderPrLink`: `const href = safeHref(url)` → `const href = url` | GREEN | **GREEN — survived** |
| **W40** | `renderExternalSourceLink`: same bypass | GREEN | **GREEN — survived** |
| W41 | W39 **and** delete the `import { safeHref }` line | RED | RED ✔ `…allow-listed as using safeHref but does not import it` |

So: a one-token change that removes the client-side XSS guard from *both* live render paths ships
green. The only thing that catches it is deleting the now-unused `import`, which a linter would
prompt you to do but nothing forces.

The test's own comment says the harness has a positive control "without this, an assertion of *no
href* would pass even if `renderGuarded` were silently broken". That control is real and correct —
but it controls the *copy*, not the product. It is a check that derives from the thing it is
checking.

**Fix:** export `renderPrLink`/`renderExternalSourceLink` (or the module's render entry) and drive
the JSDOM assertions through them. That single change kills W39, W40 and W47 together.

---

## 4. Finding F4 — the scanner's allow-list can be rubber-stamped `[MEDIUM]`

The author claims (report §4): *"entries claiming to use `safeHref` are checked to actually import
it (so an entry cannot be a rubber stamp)"*. **Disproven.** The check is
`text.includes("from '../../util/safe-url.js'")` — it is **file-scoped**, not line-scoped.

**W35** (survived GREEN): added a genuinely unsafe binding to `ft-inspector-code.ts` —

```ts
export function renderRawLink(url: string) {
  return html`<a href=${url} class="raw">raw</a>`;
}
```

— plus an `ALLOWED` entry for that exact line with `viaSafeHref: true` and the reason
`'href comes from safeHref(), which allow-lists http/https.'`. **Suite green.** The claim in the
entry is false, the binding is unguarded, the file happens to import `safeHref` for an unrelated
function, and the check passes.

The author's *other* two allow-list claims **do** hold:

| cell | claim | result |
|---|---|---|
| W46 | stale entries fail | RED ✔ (message is *"Unapproved binding"*, not *"stale ALLOWED entry"* — see F8) |
| W15 | emptying `ALLOWED` fails | RED ✔ 4 unapproved bindings named |

---

## 5. Finding F5 — detector blind spots in the chokepoint `[MEDIUM]`

The scanner is the change's only *prospective* protection, so its recall matters more than
anything else in the diff. I injected six new sinks into `web/src` one at a time:

| cell | injected sink | prediction | result |
|---|---|---|---|
| W32 | `` html`<a href=${x}>evil</a>` `` | RED | **RED ✔** — `components/ft-probe.ts:3 … Unapproved` |
| **W33** | `el.setAttribute('href', x)` | GREEN | **GREEN — MISSED** |
| **W34** | binding split across lines (`href=\n  ${x}`) | GREEN | **GREEN — MISSED** |
| **W42** | `window.location.assign(x)` | GREEN | **GREEN — MISSED** |
| **W43** | `el.href = x` in a **`.js`** file under `src/` | GREEN | **GREEN — MISSED** |
| **W44** | `` html`<img srcset=${x}>` `` | GREEN | **GREEN — MISSED** |

Also out of scope by construction: `web/index.html` and `web/vite.config.ts` (the walk starts at
`web/src`), and any `.tsx`/`.mts`/`.html` file.

`setAttribute('href', …)` is the one I would fix first: it is the single most common way this
binding gets written, it is what `safe-url.test.ts` itself uses on line 122, and the two existing
rules were clearly meant to cover exactly it. Recommended rule additions:

```ts
{ name: 'setAttribute href/src',   pattern: /\.setAttribute\s*\(\s*['"`](?:href|src|srcset|xlink:href|formaction|action|data)['"`]/ },
{ name: 'navigation assignment',   pattern: /\b(?:location\s*=|location\.(?:assign|replace)\s*\(|window\.open\s*\()/ },
{ name: 'other url attributes',    pattern: /\b(?:srcset|xlink:href|formaction|action|poster|data)\s*=\s*\$\{/ },
```

…plus extending `sourceFiles` to `.js`/`.mjs`/`.tsx` and matching against the joined text rather
than line-by-line (or at least flagging a lone `href=` / `src=` at end of line).

---

## 6. Finding F6 — client and server disagree on 8 of 33 inputs, and nothing tests it `[MEDIUM]`

`safe-url.ts` states as a design invariant: *"Any divergence between the two lists is a bug in one
of them."* There is no test that compares them. I built one: dumped `validateURLField` decisions
for a 33-input corpus from a throwaway Go test (deleted; tree clean), then evaluated `safeHref`
over the same corpus.

```
corpus size: 33   agree: 25   DIVERGE: 8
```

| input | Go | TS | direction |
|---|---|---|---|
| `http://1.2.3.4.5/x` | accept | reject | **SERVER ACCEPTS / CLIENT REJECTS — broken feature** |
| `http://999.999.999.999/x` | accept | reject | **broken feature** |
| `http://example.com:99999/x` | accept | reject | **broken feature** |
| `http:/\/\evil.com` | reject | **accept** | client misses the case the Go host check exists for |
| `https://example.com\evil.com/` | reject | accept | unreachable via ingress; legacy rows only |
| `https://example.com/a b` | reject | accept | unreachable via ingress |
| `http:@evil.com` | reject | accept | unreachable via ingress |
| `https://example.com/%zz` | reject | accept | unreachable via ingress |

None is a scheme escalation, so none is an XSS. But three are the *silent-breakage* direction the
brief asked about in item 3: a URL the server happily stores that the dashboard then refuses to
link. And `http:/\/\evil.com` is precisely the "backslash host confusion" case the Go table pins
(`TestValidateURLField_RejectsScriptBearingSchemes/backslash_host_confusion`) — the TS table has no
equivalent fixture, and the client accepts it, so the defence-in-depth layer does **not** cover the
legacy-row case it was written for.

**Recommended:** a differential test. Emit the corpus + Go decisions to a fixture file from a Go
test, read it in `safe-url.test.ts`, assert agreement. That is the only construction that can
falsify the "identical allow-lists" claim, and it is ~20 lines.

---

## 7. The Go side — findings, all lower severity

**F7 (Low) — three implementation branches are unpinned.**

| cell | mutation | result |
|---|---|---|
| **G6** | delete the control-character rejection loop entirely | **GREEN — survived** |
| **G7** | delete `strings.ToLower` case folding | **GREEN — survived** |
| **G8** | control-char check no longer rejects a bare space (`r < ' '`) | **GREEN — survived** |

All three are branches the code comments explicitly defend as *deliberately not relying on
`net/url`'s behaviour* — and all three are, in fact, fully shadowed by `net/url` for every fixture
in the table. The reasoning is right; the test that would keep it true does not exist. A fixture
that isolates the control-char check needs a character `net/url` accepts but browsers strip in a
position that still yields an allowed scheme, e.g. `{"space in path", "https://example.com/a b"}`
(currently rejected by the guard, accepted by `url.Parse`). One row kills G6 and G8.

**F8 (Low) — allow-list membership is not distinguished from prefix matching.**

**G4** (`allowedURLSchemes[s]` → `strings.HasPrefix(s, "http")`) **survived GREEN.** No fixture uses
a scheme that merely starts with `http`. Not exploitable today (no script-bearing scheme starts
with `http`), but it is the same "the table cannot express this" class. One row —
`{"httpx scheme", "httpx://evil.com/x"}` — closes it.

**F9 (Low) — list-position blindness on both write boundaries.**

| cell | mutation | result |
|---|---|---|
| **G11** | import guard validates only `pull_requests[0]` | **GREEN — survived** |
| **G27** | `UpdateTask` validates only `add_pull_requests[0]` | **GREEN — survived** |

Every URL fixture in the suite sits at index 0 of a one-element list. A guard that silently stops
after the first element regresses invisibly. Fix: give the accept-path RPC test **two** PRs, or add
one reject case with a clean PR at index 0 and the payload at index 1.

**F10 (Low) — `TestRPC_ImportCollection_RejectsScriptURLs` cannot attribute the rejection.**

Its only oracle is `status.Code(err) != codes.InvalidArgument`. `export_import.go:366` re-wraps
**every** `importedTask` failure as `status.Error(codes.InvalidArgument, err.Error())`. Proved by
**G25**: changing the guard's status code to `PermissionDenied` turned 22 internal subtests and both
`UpdateTask` RPC tests RED, and left **both import subtests GREEN**. So the import test would also
pass if the document were rejected for a completely unrelated reason. It also, unlike its
`UpdateTask` siblings, never asserts the payload was not persisted. Add
`strings.Contains(st.Message(), "pull_requests[0].url")` and a `GetTask`/list-collections check.

**F11 (Informational) — the stale-entry and floor assertions are mutually redundant.** W16 (drop
`findings.length >= ALLOWED.length`) and W17 (drop the stale-entry loop) **both survived GREEN**;
each is only ever killed by the other. In every scenario I could construct (W11, W46, W52) the
*floor* or the *unapproved* assertion fires first and the stale-entry message is never the one
emitted. Not a defect — belt and braces is fine — but the author's report presents "stale entries
fail" as an independently demonstrated property and it is not one.

---

## 8. Answer to brief item 3 — are the happy-path tests load-bearing or decorative?

**Load-bearing, and measurably so.** Seven over-strictness mutations, seven kills, no survivors:

| cell | over-strict mutation | killed by | severity of what it protects |
|---|---|---|---|
| G20 | reject **every** non-empty URL | 8 accept subtests + `TestRPC_UpdateTask_AcceptsHTTPURLs` + `TestRPC_ImportCollection_AcceptsHTTPURLs` | total product breakage |
| G2 | allow-list narrowed to `{http}` | 6 accept subtests + both happy-path RPCs | all `https://` links die |
| G3 | narrowed to `{https}` | `/http`, `/http_upper_case_scheme`, `TestRPC_UpdateTask_AcceptsHTTPURLs` | all `http://` links die |
| G24 | require TLS (reject `http:`) | same 3 | same |
| G21 | reject userinfo | `/credentials` **only** | `https://user:pass@host/x` dies |
| G22 | reject non-default port | `/port` **only** | `https://host:8443/x` dies |
| G23 | reject percent-encoding | `/encoded_space` **only** | any escaped URL dies |
| G9 | reject empty (can no longer clear the field) | `/empty` **only** | field cannot be unset |
| W1 | client narrowed to `{http}` | `testAcceptsHTTPAndHTTPS` | dashboard stops linking |
| W2b | client rejects everything | `testAcceptsHTTPAndHTTPS` | dashboard stops linking |
| W8 | client returns `URL.href` instead of the raw input | `testAcceptsHTTPAndHTTPS` (`HtTpS://…` → `https://…/`) | silent URL rewriting |

Four of these (G21, G22, G23, G9) are killed by **exactly one row each**. The accept tables are thin
but every row in them is carrying weight — there is no dead row in `TestValidateURLField_AcceptsHTTPAndHTTPS`.

**The blind spots I found on the over-strictness axis** (URL shapes a legitimate user or the GitHub
adapter could produce, that no test covers):

- IPv6 literal hosts — `https://[::1]:8443/x`
- `localhost` / bare-hostname URLs — `http://localhost:3000/x`
- IDN and punycode hosts — `https://例え.jp/x`, `https://xn--r8jz45g.jp/x`
- hosts with underscores — `https://exa_mple.com/x`
- a literal space in the path — `https://example.com/a b` (**currently rejected by the server**,
  accepted by the client; that behaviour is undocumented and untested in either direction)

Note the asymmetry: the Go accept table has 9 rows, the TS one has 6, and neither covers any of the
above. Since the two implementations use different parsers, over-strictness in one and not the
other is exactly how F6 arises.

---

## 9. Brief item 4 — are the three ingress paths individually pinned?

**Yes, all three, verified by unwiring each call site separately.** No path is covered only by a
sibling's coverage.

| # | path | call site | unwire cell | killed by |
|---|---|---|---|---|
| 1 | `UpdateTask` → `add_pull_requests[].url` | `server.go:641` | **G16** | `TestRPC_UpdateTask_RejectsScriptURLInPullRequest` (and *only* that) |
| 2 | `UpdateTask` → `remote_url` | `server.go:663` | **G17** | `TestRPC_UpdateTask_RejectsScriptURLInRemoteURL` (and *only* that) |
| 3 | `ImportCollection` → `importedTask` | `export_import.go:722` | **G15** | `…RejectsScriptURLs/pull_request_url` **and** `/remote_data_remote_url` |

Path 3 is further decomposed and both halves are independently pinned:

| cell | mutation | killed by |
|---|---|---|
| G12 | import guard skips `PullRequests` | `/pull_request_url` only |
| G13 | import guard skips `RemoteData` | `/remote_data_remote_url` only |
| G14 | `urlBearingRemoteDataKeys` drifts empty (the "keep in sync with convert.go" risk) | `/remote_data_remote_url` only |

G14 is worth calling out as a **positive** result: the constant most likely to rot silently is the
one thing here with a dedicated pin.

I independently confirmed the denominator of 3: `CreateTaskRequest` has no URL-typed field (grep of
`proto/farmtable.proto`), and `beads_import.go` constructs `exportTask` with
`PullRequests: []map[string]string{}` and never sets `remote_data`, so it carries no URL ingress.
The only unguarded writer of `remote_url` is `internal/platform/github/graphql_queries.go:480`
(`issue.URL.String()`), which is the deliberate platform-sync exemption.

---

## 10. Loop / fixture census, **with denominators**

Criterion as instructed: *a loop is non-vacuous exactly when some assertion **requires a positive
outcome** from it. A loop whose assertion only ever **permits** an empty result cannot fail when
emptied.* Every row below is **measured** by forcing the loop to iterate zero times, not reasoned.

### `web/src/util/url-binding-scan.test.ts` — **9 loops, 5 survive emptying (4/9 = 44% guarded)**

| # | loop | assertion shape | cell | emptied ⇒ |
|---|---|---|---|---|
| 1 | `sourceFiles`: `for (entry of readdirSync(dir))` | `assert(files.length > 0)` — **requires positive** | W10 | **RED ✔** |
| 2 | `scanText`: `text.split('\n').forEach(…)` | positive fixtures `findings.length > 0` | W9 | **RED ✔** |
| 3 | `scanText`: `for (rule of RULES)` | positive fixtures | W14 | **RED ✔** |
| 4 | `for ([name, fixture] of shouldFire)` (7) | *inside* the loop — nothing requires the array be non-empty | W12 | **GREEN — vacuous** |
| 5 | `for ([name, fixture] of shouldNotFire)` (5) | `findings.length === 0` — **permits empty**, twice over | W13 | **GREEN — vacuous** |
| 6 | `testNoUnapprovedBindings`: `for (file of files)` | `findings.length >= ALLOWED.length` — requires positive | W52 | **RED ✔** |
| 7 | `findings.filter(...)` → `unapproved` | `unapproved.length === 0` — **permits empty** | W53 | **GREEN — vacuous** |
| 8 | `for (a of ALLOWED)` stale check | requires positive *per entry*, but nothing requires `ALLOWED` be non-empty | W17 | **GREEN — vacuous** |
| 9 | `for (a of ALLOWED.filter(viaSafeHref))` | same | W18 | **GREEN — vacuous** |

**Authored fixture tables: 4. Guarded against being emptied: 2 of 4.**

| table | size | cell | emptied ⇒ |
|---|---|---|---|
| `RULES` | 2 | W14 | **RED ✔** (positive fixtures) |
| `ALLOWED` | 4 | W15 | **RED ✔** (all 4 real bindings become unapproved) |
| `shouldFire` | **7** ✔ (brief's count confirmed) | W12 | **GREEN** |
| `shouldNotFire` | **5** ✔ (brief's count confirmed) | W13 | **GREEN** |

**Direct answer to the brief's question:** *yes, the scanner has a self-test.* Replacing the
detector with an empty result (W9), removing its rules (W14), or handing it an empty file list
(W10, W52) all go **RED**, with named, accurate messages. It is **not** blind to its own input. The
oracle is `assert(findings.length >= ALLOWED.length)` plus the per-entry stale check — a genuine
positive requirement. This is a **green control that is a finding in the author's favour**, and it
is the strongest single piece of engineering in the change.

What it does **not** have is a self-test for its *recall* (F5) or for the honesty of its allow-list
entries (F4).

### `web/src/util/safe-url.test.ts` — **4 loops, 3 survive emptying (1/4 = 25% guarded)**

| # | loop | assertion shape | cell | emptied ⇒ |
|---|---|---|---|---|
| 1 | `for ([name, input] of rejected)` (21) | `=== undefined` — **permits empty** | W49 | **GREEN — vacuous** |
| 2 | `for (input of accepted)` (6) | `=== input` — requires positive per item, nothing requires the array | W50 | **GREEN — vacuous** |
| 3 | `for (rel of files)` (2) | nothing requires the array | W51 | **GREEN — vacuous** |
| 4 | `for (line of anchors)` | `assert(anchors.length > 0)` — **requires positive** | (W47) | **RED ✔** |

**Authored fixture tables: 3 (`rejected` 21, `accepted` 6, `files` 2). Guarded: 0 of 3.**

`testPayloadNeverReachesHrefAttribute` is loop-free and carries its own explicit positive control —
correct in form, but see F3 for what it is controlling.

### Go tables — 3 tables, **0 of 3** guarded (G28, G29, G30 all GREEN when emptied)

`rejected[:0]`, `accepted[:0]` and the import `tests[:0]` all leave the suite green. I record this
for completeness but I am **not** filing it as a defect: `go test` reports a table test with zero
subtests as PASS by design, this is universal to every table test in the repository, and the fix
(`if len(rejected) == 0 { t.Fatal }`) is a convention change, not a change to this diff.

---

## 11. Brief item 5 — which of the author's evidence I can rely on

**I re-measured all five of the author's RED/GREEN experiments from the committed tree at
`d4c4e6b`.** Four reproduce exactly. One does not.

| author's experiment | my cell | verdict |
|---|---|---|
| Server pin 1 — `validateURLField` → `return nil` | G1 | **Reproduces**, but the count is stale — see below |
| Server pin 2 — remove `validateImportedTaskURLs` call | G15 | **Reproduces exactly** — `/pull_request_url`, `/remote_data_remote_url` |
| Frontend pin A — `safeHref` returns raw unchecked | W45 | **Reproduces exactly** — `safeHref("javascript:alert(1)") should be undefined for "javascript"` |
| Frontend pin B — restore unguarded `href=${pr.url}` | W48 | **Reproduces exactly**, down to the line number: `ft-inspector-code.ts:119 … Unapproved` |
| Frontend pin C — drop `target="_blank"` | W20/W21 | **Reproduces exactly** |

So the `git checkout` accident did **not** silently corrupt the report's conclusions. Two
qualifications, both of which are the *stale-tree-state* problem rather than the wipe:

**(a) The "24 failures" figure is from an intermediate commit, not the shipped tree.** Measured at
`d4c4e6b`, G1 produces **28 `--- FAIL` lines = 24 subtests + 4 top-level functions = 26 distinct
test identities**:

```
22 × TestValidateURLField_RejectsScriptBearingSchemes/*
 2 × TestRPC_ImportCollection_RejectsScriptURLs/{pull_request_url,remote_data_remote_url}
 1 × TestRPC_UpdateTask_RejectsScriptURLInPullRequest
 1 × TestRPC_UpdateTask_RejectsScriptURLInRemoteURL
```

The author's list omits the two `ImportCollection` subtests, which is exactly what you would expect
if pin 1 was measured at `4187910`, before the import guard (`80cab87`) existed. Their own
enumeration also sums to 25, not 24. Harmless as to the conclusion; a real signal that the report's
numbers were taken at different tree states.

**(b) One reported *side observation* is false at `d4c4e6b`.** Under pin B the author writes:
*"Note `safe-url: ok` **still passed** here: the scanner, not the unit tests, is what caught the
regressed site."* At `d4c4e6b` that depends entirely on *how* you regress it:

| cell | regression shape | what fires first |
|---|---|---|
| W48 | revert the call site, leave `renderPrLink` in place (author's shape) | `url-binding-scan` — `safe-url` passes ✔ author correct |
| **W47** | inline the unguarded anchor and delete `renderPrLink` | **`safe-url` fires first** (`expected a guarded href=${href} anchor, found none`); `url-binding-scan` never runs, because `npm test` is `&&`-chained |
| **W39** | keep everything, just make `renderPrLink` not call `safeHref` | **nothing fires** |

The author's framing ("the scanner is what catches this class") is right for W48 and wrong for both
W47 and W39. The general claim it is used to support does not hold.

**(c) A methodology hazard I hit myself and am recording as a warning.** `web/.tmp-test/` is a
persistent build directory that `npm test` overwrites but never cleans. My first differential run
read a **stale** `safe-url.js` left behind by the immediately preceding mutation cell and reported
14 divergences including `safeHref('javascript:alert(1)') === accepted`. Caught by the result being
implausible; re-measured after `rm -rf .tmp-test` and got the real answer, 8. Any future agent
reading `.tmp-test` directly, or any developer running `npm test` after a crashed run, is exposed to
this. It also means a `tsc` failure leaves the previous build in place — worth an `rm -rf .tmp-test`
in the `test` script.

---

## 12. Mutation table — full, with predictions stated before measurement

Predictions were written to `/tmp/xssqa/predictions_go.md` before any Go cell ran, and stated
in-conversation before each web batch. **Direction** = did I correctly predict GREEN vs RED.
**Killers** = did I correctly predict *which* tests would fail.

### Go — 24 cells

| cell | mutation | pred | result | killed by (measured) | dir | killers |
|---|---|---|---|---|---|---|
| G1 | `validateURLField` → `return nil` | RED | RED | 22 reject subtests + 2 import subtests + 2 UpdateTask RPCs | ✔ | ✔ |
| G2 | allow-list → `{http}` | RED | RED | `/https /https_mixed_case_scheme /port /query_and_fragment /credentials /encoded_space` + both happy-path RPCs | ✔ | ✔ |
| G3 | allow-list → `{https}` | RED | RED | `/http /http_upper_case_scheme` + `UpdateTask_AcceptsHTTPURLs` | ✔ | ✔ |
| **G4** | scheme by `HasPrefix("http")` | **GREEN** | **GREEN** | — | ✔ | ✔ |
| G5 | drop host-non-empty check | RED | RED | `/http_without_host /backslash_host_confusion` | ✔ | ✔ |
| **G6** | drop control-char loop | **GREEN** | **GREEN** | — | ✔ | ✔ |
| **G7** | drop `strings.ToLower` | **GREEN** | **GREEN** | — | ✔ | ✔ |
| **G8** | control-char check allows bare space | **GREEN** | **GREEN** | — | ✔ | ✔ |
| G9 | empty no longer accepted | RED | RED | `/empty` only | ✔ | ✔ |
| **G11** | import guard: only `pull_requests[0]` | **GREEN** | **GREEN** | — | ✔ | ✔ |
| G12 | import guard skips `PullRequests` | RED | RED | `/pull_request_url` | ✔ | ✔ |
| G13 | import guard skips `RemoteData` | RED | RED | `/remote_data_remote_url` | ✔ | ✔ |
| G14 | `urlBearingRemoteDataKeys` empty | RED | RED | `/remote_data_remote_url` | ✔ | ✔ |
| G15 | unwire import call site | RED | RED | both import subtests | ✔ | ✔ |
| G16 | unwire `add_pull_requests.url` | RED | RED | `…RejectsScriptURLInPullRequest` | ✔ | ✔ |
| G17 | unwire `remote_url` | RED | RED | `…RejectsScriptURLInRemoteURL` | ✔ | ✔ |
| G20 | reject every non-empty URL | RED | RED | 8 accept subtests + both happy-path RPCs | ✔ | ✔ |
| G21 | over-strict: reject credentials | RED | RED | `/credentials` only | ✔ | ✔ |
| G22 | over-strict: reject non-default port | RED | RED | `/port` only | ✔ | ✔ |
| G23 | over-strict: reject `%` escapes | RED | RED | `/encoded_space` only | ✔ | ✔ |
| G24 | over-strict: require TLS | RED | RED | `/http /http_upper_case_scheme` + `UpdateTask_Accepts` | ✔ | ✔ |
| G25 | status code → `PermissionDenied` | RED | RED | 22 reject subtests + 2 UpdateTask RPCs — **import subtests stayed GREEN** | ✔ | ✘ |
| G26 | error message drops the field name | RED | RED | 22 reject subtests only | ✔ | ✔ |
| **G27** | `UpdateTask`: only `add_pull_requests[0]` | **GREEN** | **GREEN** | — | ✔ | ✔ |

Census cells G28/G29/G30 (emptying each Go table): predicted GREEN, all **GREEN**.

### Web — 39 cells

| cell | mutation | pred | result | dir |
|---|---|---|---|---|
| W1 | `SAFE_SCHEMES = {http:}` | RED | RED (`testAcceptsHTTPAndHTTPS`) | ✔ |
| W2 | reject-everything (v1) | RED | **inconclusive** — my mutation broke TS narrowing (2 × TS errors) | – |
| W2b | reject-everything (retry, `return undefined`) | RED | RED (`testAcceptsHTTPAndHTTPS`) | ✔ |
| W3 / W3b | accept-everything (2 attempts) | RED | **inconclusive** — same TS narrowing problem, twice | – |
| **W4** | drop `hostname === ''` check | **GREEN** | **GREEN** | ✔ |
| W5 | add a base argument to `new URL()` | RED | RED (`protocol relative`) | ✔ |
| **W6** | drop the `raw === ''` early return | **GREEN** | **GREEN** | ✔ |
| W8 | return `parsed.href` not `raw` | RED | RED (`HtTpS://…` → `https://…/`) | ✔ |
| W9 | `scanText` returns `[]` | RED | RED (positive fixture 1) | ✔ |
| W10 | `sourceFiles` returns `[]` | RED | RED (`no source files -- the walk is broken`) | ✔ |
| W11 | `sourceFiles` stops recursing | RED | RED — but via the **floor** assertion, not the stale-entry one I predicted | ✔ / ✘ |
| **W12** | empty `shouldFire` | **GREEN** | **GREEN** | ✔ |
| **W13** | empty `shouldNotFire` | **GREEN** | **GREEN** | ✔ |
| W14 | empty `RULES` | RED | RED | ✔ |
| W15 | empty `ALLOWED` | RED | RED (all 4 bindings named) | ✔ |
| **W16** | drop the floor assertion | **GREEN** | **GREEN** | ✔ |
| **W17** | drop the stale-entry loop | **GREEN** | **GREEN** | ✔ |
| **W18** | drop the `viaSafeHref` import check | **GREEN** | **GREEN** | ✔ |
| W20 | drop `target="_blank"` (code) | RED | RED | ✔ |
| W21 | drop `rel="noopener"` (meta) | RED | RED | ✔ |
| **W28** | `SAFE_SCHEMES += mailto:` | **RED** | **GREEN** | **✘ MISS** |
| **W29** | `SAFE_SCHEMES += javascript:, data:, vbscript:` | GREEN | **GREEN** | ✔ |
| **W30** | `SAFE_SCHEMES += ftp:` | GREEN | **GREEN** | ✔ |
| **W31** | delete the scheme check | GREEN | **GREEN** | ✔ |
| W32 | inject a Lit `href=${x}` binding | RED | RED | ✔ |
| **W33** | inject `setAttribute('href', x)` | GREEN | **GREEN** | ✔ |
| **W34** | inject a multi-line binding | GREEN | **GREEN** | ✔ |
| **W35** | rubber-stamp allow-list entry | GREEN | **GREEN** | ✔ |
| **W39** | `renderPrLink` bypasses `safeHref` | GREEN | **GREEN** | ✔ |
| **W40** | `renderExternalSourceLink` bypasses | GREEN | **GREEN** | ✔ |
| W41 | W39 + drop the import | RED | RED | ✔ |
| **W42** | inject `location.assign(x)` | GREEN | **GREEN** | ✔ |
| **W43** | inject `el.href = x` in a `.js` file | GREEN | **GREEN** | ✔ |
| **W44** | inject `srcset=${x}` | GREEN | **GREEN** | ✔ |
| W45 | delete **both** `safeHref` guards | RED | RED | ✔ |
| W46 | make one `ALLOWED.line` stale | RED | RED — via *unapproved*, not the stale message | ✔ / ✘ |
| W47 | inline unguarded anchor, delete helper | RED | RED — via **`safe-url`**, not the scanner as predicted | ✔ / ✘ |
| W48 | author's pin B, exact shape | RED | RED — `url-binding-scan`, line 119, `safe-url` passes | ✔ |
| W49–W53 | loop-emptying census (5 cells) | 4 GREEN, 1 RED | as predicted | ✔ |

### Score, including misses

- **68 cells attempted. 65 conclusive, 3 inconclusive** (W2, W3, W3b — my own mutations tripped
  TypeScript's null-narrowing; I did not anticipate that deleting a guard would change the *type*
  of `raw`. Superseded by W31 + W4 + W2b, which measure the same properties without the type break).
- **Direction: 64 correct / 65 conclusive.** One outright miss: **W28**. I predicted the `mailto`
  fixture pinned the allow-list; it does not. Chasing that miss is what produced F2, the most serious
  finding in this review. Worth stating plainly: **the single most important finding here came from
  a wrong prediction, not a right one.**
- **Killer set: 4 wrong out of 41 RED cells** — G25, W11, W46, W47. In all four the mutant died, but
  a different assertion did the killing than I expected. Three of the four (W11, W46, W47) revealed
  assertion-ordering/redundancy facts I would otherwise have missed (F11, and §11(b)).
- **One anchor miss:** my first G25 spec asserted 5 occurrences of `codes.InvalidArgument` in
  `urlvalidate.go`; there are 4. The runner refused to apply it rather than silently patching a
  subset — which is the point of building the anchor count into the harness.
- **Zero flake contamination:** `TestWatchTasks` was excluded from all 24 Go cells by construction
  and the runner's tripwire never fired.

---

## 13. Deliverable 4 — which added tests are load-bearing enough that shipping them unrun is a mistake?

Ranked. The Go tests all run under `make test`, so the question only bites the four frontend
concerns — and F1 means "shipped unrun" is currently the **default**, not a hypothetical.

**MUST run — losing these loses real protection:**

1. **`url-binding-scan.test.ts` (whole file).** The only test in the change with *prospective* value:
   it protects code that does not exist yet. W32 and W48 prove it fires on a real new sink, with an
   accurate file:line message. Every other test in the change protects a line someone already wrote.
   If exactly one frontend test gets wired into CI, this is it.
2. **`safe-url.test.ts::testExternalAnchorsKeepTargetBlank`.** Sole pin on `target="_blank"` /
   `rel="noopener"` (W20, W21), which the author's own §1 identifies as the *only* thing currently
   standing between this bug and script execution. It is also — unexpectedly — the only test that
   notices the guarded anchor being inlined away (W47).
3. **`safe-url.test.ts::testAcceptsHTTPAndHTTPS`.** Sole guard against the client silently refusing
   to render legitimate links (W1, W2b, W8). A security control that can break the product with no
   test between it and a regression is the risk the brief named; on the client this six-row table is
   that test, and it is doing the job.

**Should run, but weak as written:**

4. **`safe-url.test.ts::testRejectsUnsafeSchemes`.** Twenty-one rows, and per F2 **zero** of them can
   falsify the scheme allow-list. It only fires when *both* guards are gone (W45). Fix it (three
   rows: `ftp:`, `ws:`, `wss:`) and it moves to the top group.

**Decorative with respect to production code:**

5. **`safe-url.test.ts::testPayloadNeverReachesHrefAttribute`.** It is the most carefully constructed
   test in the change — explicit positive control, reads the attribute back off a real DOM node
   rather than asserting on a string — and per F3 it protects nothing, because it drives a copy of
   the render logic. Point it at the real components and it becomes the most valuable test here.

---

## 14. Deliverable 6 — every place this brief was wrong

**Errors:**

1. **"neutralising `validateURLField` turns 24 tests red … 22 of those 24 are subtests of a SINGLE
   table."** Measured at `d4c4e6b`: **26 distinct test identities** (24 subtests + 2 standalone RPC
   test functions), across 4 top-level functions, from 28 `--- FAIL` lines. The correct decomposition
   is **22 of 26**, and the 2 non-table items in the author's own list are the *ImportCollection*
   subtests, not the two `UpdateTask` RPC tests. The brief inherits a figure the author measured at
   an intermediate commit and restates it as established. (§11a)

2. **"…so they may all be killed by one assertion."** They are not. The 22-row table has **three**
   independent oracles, and I isolated each: the non-nil-error check (G1), the
   `codes.InvalidArgument` check (G25), and the "message names the field" check (G26). The
   structural worry behind the question is entirely correct — *for the frontend table*, where the
   count really does collapse to one discriminating fixture, and that number is zero (F2). It just
   does not apply to the Go table you asked about.

3. **"Does the scanner have a self-test? … or does the whole suite stay green because the scan finds
   nothing?"** and **"Is the scanner blind to its own input?"** — both framed as open suspicions;
   both are **already handled** in the file, and I have positive controls proving it: W9 (detector
   emptied) RED, W14 (rules emptied) RED, W10 and W52 (file list emptied) RED, all with accurate
   named messages. Reporting this as instructed: **a green control is a finding**, and this one is in
   the author's favour. The scanner's real gaps are recall (F5) and allow-list honesty (F4), neither
   of which the brief anticipated.

4. **Brief item 3's premise is the wrong way round for the Go side.** *"if the guard became too
   strict … which test fails? Establish whether they are load-bearing or decorative."* Measured:
   **load-bearing, 11 for 11** (§8). Four over-strictness mutations are killed by exactly one row
   each, so the tables are thin but contain no dead rows. The live over-strictness risk is not that
   the happy-path tests are decorative; it is that the Go and TS accept-tables cover *different*
   shapes and neither covers IPv6/IDN/localhost/ports (§8, F6).

5. **The brief says the author reports "7 positive fixtures and 5 negative fixtures" and asks me to
   verify — that count is right (7 and 5), but the brief then asks for the fixture census as though
   fixture count were the interesting number.** It is not, and the file proves it: **both** fixture
   arrays are vacuous when emptied (W12, W13 GREEN), so 7 and 5 could be 0 and 0 with no change in
   suite outcome. The load-bearing structure in that file is the three positive-requirement
   assertions, not the twelve fixtures.

**Checked and confirmed correct (listing these so the negative claim has a denominator):**

- `go build ./...` exit 0 ✔; `npm test` exit 0 with `safe-url: ok` and `url-binding-scan: ok` ✔;
  `git status --porcelain` empty ✔.
- `go test ./...` exit 0, **10** ok packages ✔ (plus 22 no-test-files).
- The Makefile is **untouched** on this branch (`git diff 7a0f220..HEAD -- Makefile` = 0 lines) ✔;
  `test:` is `go test ./...`, `web:` is `npm ci && npm run build`, and **no target runs `npm test`** ✔
  (the only repo-wide mention is a prose line in an older project-log entry).
- New test file line counts: 92 / 210 / 194 / 225 — **all four exact** ✔.
- Commit-to-scope mapping (`4187910` / `80cab87` / `f0ab53f` / `d4c4e6b`) ✔.
- The `TestWatchTasks` flake is real and fired for me too (1 of 3 full-suite runs,
  `TestWatchTasks_NoInitial`, `watch_test.go:118: timed out waiting for event`) ✔.
- **`go vet` at the base: could not independently verify.** I created a throwaway worktree at
  `7a0f220` to check the 1500/1610/1818/1995 line numbers; `go vet` there fails earlier with
  `assets.go:5:12: pattern all:web/dist: no matching files found` (no built `web/dist` in a fresh
  worktree), so the copylock check never runs. What I *can* confirm at `d4c4e6b` is **exactly 4**
  copylocks in `internal/server/server.go` at **1506/1616/1824/2001** — a uniform **+6** from the
  brief's figures, matching the 6 lines `4187910` adds to that file. Consistent, not verified.
  Worktree removed; tree clean.

---

## 15. What I would require before merge

| # | finding | severity | required? |
|---|---|---|---|
| F1 | `jsdom` / `@types/jsdom` / `@types/node` undeclared and unlocked | **Critical** | **Yes** — one-line fix, the suite is otherwise fiction |
| F2 | 0/21 fixtures isolate the client scheme allow-list | **Critical** | **Yes** — add `ftp:`/`ws:`/`wss:` rows |
| F3 | no test drives the real render functions | **High** | **Yes** — export them and point the JSDOM test at them |
| F4 | `viaSafeHref` is file-scoped, so entries can be rubber stamps | Medium | Recommended |
| F5 | scanner misses `setAttribute`, multi-line, `.js`, `srcset`, navigation | Medium | Recommended — at least `setAttribute` |
| F6 | 8/33 client-server divergences, 3 in the breaking direction, untested | Medium | Recommended — a differential fixture |
| F7 | control-char / case-fold / space branches unpinned (G6, G7, G8) | Low | Optional — one fixture row covers two |
| F8 | prefix-vs-membership indistinguishable (G4) | Low | Optional — one fixture row |
| F9 | list-position blindness on both write boundaries (G11, G27) | Low | Optional — two PRs in one existing test |
| F10 | import test cannot attribute its rejection (G25) | Low | Optional — assert on the message |
| F11 | stale-entry / floor assertions mutually redundant | Info | No |

None of these is a hole in the *fix*. Every one is a hole in the evidence that the fix will still be
there next month. F2 and F3 together mean the client-side guard could be removed by a one-token edit
and shipped green — which, given that the guard exists precisely to neutralise rows already in the
production database, is not a theoretical concern.

**Final state:** `git status --porcelain` empty, `go build ./...` 0, `go test ./...` 0 (10 ok),
`npm test` 0. No production code modified. Nothing pushed.
