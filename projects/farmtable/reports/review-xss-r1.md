# url-scheme-validation @ `d4c4e6b`: stored-XSS URL scheme fix — Code Review

**Leg:** code review (diff and structure). **Reviewer:** review-xss-r1.
**Repo:** `/workspace` (verified `git rev-parse --show-toplevel`), branch `url-scheme-validation`,
HEAD `d4c4e6b629ade1d0725bc303c0acf962838f03c9`, `git status --porcelain` empty at start and at end.
**Base:** `7a0f220`.

Tag convention: `[M]` = I ran it in this clone. `[M-sub]` = measured by my read-only investigation
subagent and then re-measured by me. Every negative claim below has a stated positive control.

---

## Executive Summary

The security *rule* in this change is correct and well-argued — I probed the scheme logic on both
sides and could not break it. The problem is everything holding the rule up: the change **breaks
`make web` and `make dashboard` on a clean checkout** (Critical), and the tree-wide scanner that is
the change's centrepiece has **two measured ways to be green while the property it asserts is
false** (Required). **Risk: HIGH** — not from the fix, from the controls around it.

**Verdict: REQUEST CHANGES.**

---

## Critical

### C1. The branch breaks `make web` and `make dashboard`: three packages are imported but declared nowhere

`web/src/util/safe-url.test.ts:11` imports `jsdom`. `safe-url.test.ts:8-10` and
`url-binding-scan.test.ts:22-24` import `node:fs` / `node:path` / `node:url`, which need
`@types/node`. None of `jsdom`, `@types/jsdom`, `@types/node` is in `web/package.json`, and none is
in `web/package-lock.json`.

- `grep -c jsdom web/package-lock.json` → **0**. Positive control: `grep -c '"node_modules/lit"'` on
  the same file → **1**. `[M]`
- `npm ls` reports `jsdom@26.1.0` and ~40 transitive packages as **`extraneous`** — i.e. present in
  `node_modules` only because someone ran `npm install jsdom` without `--save`. `[M]`

`web/tsconfig.json` has `"include": ["src"]`, so `tsc --noEmit` — the first half of
`npm run build` — compiles the `.test.ts` files. So this is not confined to `npm test`.

**Paired control, both in fresh temp clones, `npm ci` run for real, exit codes read from the child
process with no pipes `[M]`:**

| | `npm ci` | `tsc --noEmit` | `npm test` |
|---|---|---|---|
| base `7a0f220` | 0 | **0** | **0** |
| branch `d4c4e6b` | 0 | **2** (8 errors) | **2** |

```
src/util/safe-url.test.ts(8,42):  error TS2307: Cannot find module 'node:fs' ...
src/util/safe-url.test.ts(11,23): error TS2307: Cannot find module 'jsdom' ...
src/util/safe-url.test.ts(171,46): error TS7006: Parameter 'l' implicitly has an 'any' type.
src/util/url-binding-scan.test.ts(22,65): error TS2307: Cannot find module 'node:fs' ...
```

`Makefile:16-17` — `web: cd web && npm ci && npm run build`. `Makefile:21` — `dashboard: web`.
Both are red on this branch and green at base. **This is not the untouched-Makefile issue the EM
flagged and told me not to file — it is the opposite. The Makefile being untouched does not
insulate this branch from the build; the branch breaks a target the Makefile already has.**

The author's report §6 records `npm test`, `tsc --noEmit` and `npm run build` all measured 0. Those
measurements were taken in a `node_modules` polluted by the unsaved install, so they were true of
that directory and false of the repository. The declared positive control for the `tsc` gate
("injecting a deliberate type error made it exit 2 and name my file") proves `tsc` ran; it cannot
falsify "the dependency set is complete." It is a control aimed at the wrong proposition — the same
shape as R2 below.

**Suggested fix.** Add `@types/node` and either (`jsdom` + `@types/jsdom`) to `devDependencies` and
regenerate `package-lock.json`; fix the TS7006 at `safe-url.test.ts:171`; then re-measure from
`rm -rf node_modules && npm ci`. If you would rather not take a 40-package dev dependency for one
test, the JSDOM block (`safe-url.test.ts:108-154`) is pinning a render *shape*, not browser
behaviour, and a fifteen-line fake `document` would do the same job — but `@types/node` is still
required either way, because the scanner itself needs `node:fs`.

Consequence for the other track: as written, when `dev-prod-hardening` wires `npm test` into the
Makefile, it will be wiring in a command that does not compile.

---

## Required

### R1. The scanner does not match `href="${...}"` — the more idiomatic Lit form. Its fixtures cannot find this.

`web/src/util/url-binding-scan.test.ts:35`:
`{ name: 'dynamic href/src attribute binding', pattern: /\b(?:href|src)\s*=\s*\$\{/ }` requires
`${` to follow `=` immediately. A quoted binding evades it.

**Measured in-tree, with a paired positive control `[M]`.** I added
`web/src/components/zz-probe.ts` containing a single binding, ran `npm test`, removed it, and
asserted `git status --porcelain` empty:

| probe file contents | `npm test` exit |
|---|---|
| ``html`<a href="${u}" target="_blank">x</a>` `` | **0 — scanner silent** |
| ``html`<a href=${u} target="_blank">x</a>` `` | **1 — scanner fires** (control green) |

This is the direct answer to *"what is its own oracle, and can that oracle falsify the thing it
checks?"* — **for this property, no.** All seven positive fixtures at `:142-150` are unquoted, so
they were written from the same mental model as the pattern and confirm it rather than test it.
Worse, negative fixture `:157` — `['static href', 'html`<a href="/docs">docs</a>`']` — actively
teaches a reader that quoted `href` is handled. It is: as a *static* string. The fixture set has no
case that distinguishes "quoted and static" from "quoted and interpolated", which is exactly the
distinction the rule turns on.

Other shapes I measured against the same matcher (`/tmp` probe, not in-tree) `[M]`:

- **Missed:** `href='${x}'` · `srcdoc=${x}` · `action=${x}` · `formaction=${x}` · `poster=${x}` ·
  `<object data=${x}>` · `srcset=${x}` · `el.setAttribute('href', x)` · `el['href'] = x` ·
  `window.open(x)` · `location.assign(x)`
- **Fires (correct):** bare `href=${x}`, `.href=${x}`, `<use href=${x}/>`, `xlink:href=${x}`,
  `anchor.href = x`
- **False positive:** `data-href=${x}` fires.

None of these shapes exists in the tree today (`grep` for quoted bindings returns 0; positive
control: the unquoted grep returns the 4 known bindings) — so this is not a live hole. It is a
chokepoint that fails open on the most likely next input, which defeats the entire reason the
chokepoint was built instead of a checklist.

**Suggested fix.** Minimum: `/\b(?:href|src)\s*=\s*["']?\$\{/`, plus both quoted forms added to the
positive-fixture list. Then: split `srcdoc|action|formaction|poster|data|srcset` into a second rule
and `setAttribute\(\s*['"](?:href|src|xlink:href)['"]` into a third, each with its own positive
fixture — the fixture is what makes the rule real. Anchor the alternation on `[\s.]` rather than
`\b` to drop the `data-href` false positive. And add a *meta*-fixture: assert that for each rule,
at least one fixture fires **only** for that rule, so a future widening of one pattern cannot make
another rule's fixture pass vacuously.

### R2. The `viaSafeHref` oracle checks an import, not a dataflow. The guard can be removed with the scanner staying green.

`url-binding-scan.test.ts:210-216` asserts only that the file contains
`from '../../util/safe-url.js'`. The field's own docblock at `:49-50` claims *"If set, the file must
import safeHref, so the entry cannot be a rubber stamp."* It can.

**Measured `[M]`.** In `web/src/components/inspector/ft-inspector-code.ts:22` I replaced
`const href = safeHref(url);` with `const href: string | undefined = url;`. The allow-listed
binding at `:27` is byte-identical, the import at `:5` is still present:

- `npm test` → **exit 0** (`safe-url: ok`, `url-binding-scan: ok`)
- `npx tsc --noEmit` → **exit 0** — `web/tsconfig.json` sets neither `noUnusedLocals` nor
  `noUnusedParameters`, so the now-dead import is not even flagged.

Reverted; `git status --porcelain` empty.

The scanner pins the *binding line* but nothing pins the *provenance of the value bound*. The two
`viaSafeHref: true` entries make a claim about dataflow and are checked by a claim about imports;
the two are independent, so the check cannot falsify the claim. The author's own RED experiment
(report §5, "Frontend pin B") restored the inline `href=${pr.url}` — the one disarm shape the
scanner does catch — which is why this was not found.

**Suggested fix — collapse the gap rather than widen the check.** Make the source text and the
property coincide: inline the call at the binding site, `href=${safeHref(url) ?? nothing}`, or keep
the helper but have the allow-list entry pin the *expression* rather than the line, and require
`viaSafeHref` entries to match `href=\$\{safeHref\(`. Either way the thing the regex sees becomes
the thing the reviewer is being asked to believe. Separately, turn on `noUnusedLocals` in
`web/tsconfig.json` so a dead guard import is at least visible — that is a cheap second signal, not
a substitute.

### R3. `urlBearingRemoteDataKeys` is kept correct by a comment, and drift means an unguarded URL reaching an `href`

`internal/server/urlvalidate.go:90-91`:
```go
// Keep this in sync with the RemoteData reads in convert.go.
var urlBearingRemoteDataKeys = []string{"remote_url"}
```

**The list is correct today `[M]`.** `internal/server/convert.go` reads exactly three `RemoteData`
keys — `"platform"` (`:259`), `"remote_id"` (`:318`), `"remote_url"` (`:321`) — and only
`remote_url` reaches a URL-typed proto field. Positive control: the same `grep -rn 'RemoteData\['`
shape returns the other nine reads across the tree.

But this is precisely the defect class the change exists to fix: a declared constraint with nothing
invoking it. Add a URL-typed key to `convert.go` (`html_url`, an avatar, a repo link) and
`validateImportedTaskURLs` silently stops guarding it, with no test failing. There is no Go-side
equivalent of `url-binding-scan.test.ts`.

This is sharpened by something the docblock does not record: `convert.go:324` ships the **entire
untyped map** to the client — `pt.RemoteData, _ = structpb.NewStruct(t.RemoteData)` `[M]` — and
`internal/platform/github/github.go:261` writes an `html_url` key into it. Nothing renders it today
(`[M-sub]`, re-verified: the only non-generated `remoteData` reads in `web/src` are
`capabilities.ts:98` and `ft-app.ts:256`, both reading a `writable` boolean), so there is no live
gap. But the safety of a Go-side constant currently depends on an unrecorded fact about the web
tree, and the frontend chokepoint would catch a future `href` binding on it while nothing would
catch a future `convert.go` promotion of it.

**Suggested fix.** Apply the change's own technique on the Go side: a test in `internal/server` that
reads `convert.go`, extracts every `t.RemoteData["..."]` key, and asserts that every key matching
`*_url` appears in `urlBearingRemoteDataKeys`. ~15 lines, uses the same source-scanning move the
frontend already uses, and converts the comment into a control. Add a positive fixture that the
extraction actually finds the three current keys, or the test is R2 again.

### R4. The `npm test` chain and `tsconfig.test.json` include list are two hand-maintained registries that fail *silently* in the direction that matters

`web/package.json:9` is a `&&`-joined chain of three explicit `node .tmp-test/...` invocations.
`web/tsconfig.test.json:7-11` lists the same three files by hand. The EM asked what happens when
someone adds the fourth test file:

- Forget `tsconfig.test.json` → `node` fails on a missing file → **loud**. Fine.
- Forget `package.json` → the file compiles and **never runs** → **silent**. The suite reports green
  having skipped the new test.

The asymmetry points the wrong way: the cheap mistake is the invisible one.

Second problem, live today: `&&` is fail-fast. `url-binding-scan.test.js` is **last** in the chain,
so any failure in `task-ready` or `safe-url` means the security chokepoint **does not run at all**
and the operator sees one error message about an unrelated test. A control that stops running when
its neighbours are red is not a gate.

**Suggested fix.** Delete both hand lists. `"include": ["src/**/*.test.ts"]` in
`tsconfig.test.json`, and `"test": "tsc -p tsconfig.test.json && node --test '.tmp-test/**/*.test.js'"`
— Node 20 (`v20.20.2` here `[M]`) supports `node --test` with globs, and it runs every file and
reports every failure rather than stopping at the first. If `node --test` is unwanted, a four-line
runner that globs and `Promise.all`s the imports gets the same two properties.

---

## Consider / Optional

### O1. Two implementations of one rule, no drift control — and the "agree exactly" claim is measurably false

**On the EM's item 1: is the argument sound, and for the whole input space?**

The *conclusion* is sound, and for a broader reason than the report gives. The report argues the
allow-list "makes the two parsers agree on the outcome despite disagreeing on the parse." That is
not what makes it safe, and it is not true as stated. What makes it safe is **composition**: a
stored value reaches an `href` only if the Go allow-list *and* `safeHref` both accept it. XSS
therefore requires simultaneous failure of two independent allow-lists, and drift in either
direction is fail-safe — server-accepts/client-rejects degrades a link to inert text (broken
feature), server-rejects/client-accepts is unreachable. That argument does hold for the whole input
space, because it does not depend on the parsers agreeing at all.

The report's narrower claim — `safe-url.ts:10-19`, *"The scheme set is deliberately identical to the
server's allow-list… Client and server now agree exactly on {http, https}"* — **is false, and I have
a concrete counter-example `[M]`, both sides measured**:

| input | Go `validateURLField` | `safeHref` |
|---|---|---|
| `"https://exa\tmple.com"` | **rejected** — `URL must not contain whitespace or control characters` (`urlvalidate.go:53-58`) | **accepted** — `new URL()` strips the tab, `protocol='https:'`, `hostname='example.com'` |
| `"https://example.com"` | accepted (control) | accepted (control) |

This is the safe direction and only reachable via a legacy row, so it is not a vulnerability. It is a
docblock asserting an invariant that measurement contradicts — the exact failure mode this project
keeps recording. Note also that `safeHref` returns the **raw** string (`safe-url.ts:69`), so for this
input the attribute the browser holds is not the string that was checked; they happen to resolve to
the same place because the browser strips the tab too, but the docblock at `:42-45` should say so
rather than leaving it implicit.

**What would detect real drift: nothing does.** `urlvalidate.go:25-28` and `safe-url.ts:21` are two
literals in two languages joined by prose. Cheapest fix, again using the change's own technique: in
`safe-url.test.ts`, read `internal/server/urlvalidate.go`, extract the keys of
`allowedURLSchemes`, and assert set equality with `SAFE_SCHEMES` modulo the trailing colon. Ten
lines. Not blocking, because the composition argument means drift costs a feature and not a breach —
but the docblocks currently read as though something holds this, and nothing does.

**What would settle the whole-input-space question properly** is a differential test: generate
inputs, run both implementations, assert they agree on accept/reject and log disagreements. I probed
the boundary by hand (ASCII control range, non-ASCII whitespace U+00A0/U+FEFF, backslash host
confusion, mixed case, no-host) and found only the divergence above, all in the safe direction — but
hand-probing is not a proof. Recommended as follow-on, not required for merge.

### O2. The frontend got a chokepoint; the Go side got a checklist

The change's own standing rule — open-set hazard ⇒ chokepoint, not checklist — is applied on one
side only. The Go guard is three hand-placed calls (`server.go:641`, `server.go:663`,
`export_import.go:722`). The enumeration is **complete today** (see FYI), but nothing keeps it
complete: no test fails if a fifth writer appears.

Sharper: the service method is not actually the write boundary. The **store** is, and it is reached
directly, below the guard, by `internal/platform/github/github.go:94` and
`internal/platform/beads/beads.go:124` (`a.store.UpdateTask(...)`) `[M-sub, re-verified]`. The author
is right that those values are not client-controlled today
(`internal/platform/github/graphql_queries.go:480` sets `remote_url` from `issue.URL.String()`, a
`githubv4.URI` returned by GitHub's own API), but "not client-controlled" is a fact about today's
callers, not a property of the boundary.

I am not asking for the guard to move in this change — moving it to the store would be a larger
change with real risk of breaking sync on upstream data, and the author's reasoning for not doing so
is sound. I am asking that the asymmetry be **recorded as a known gap** in the project log rather
than left implicit, because the log currently presents the Go coverage as settled.

### O3. The interceptor rationale is true but is not carrying the weight put on it

`urlvalidate.go:36-42` and commit `4187910`'s message both justify method-body placement by: the CLI
pass-through registers with no interceptors, so an interceptor would have covered three sites and
missed the fourth.

**The four-site count is correct `[M]`** — `cmd/farmtable-server/main.go:98`,
`internal/cli/connect.go:169` (embedded), `internal/cli/connect.go:306` (pass-through, whose
`grpc.NewServer` at `:302` takes message-size options only), `internal/cli/dashboard.go:93`. All four
construct `server.NewFarmTableService`. The MCP server reaches `UpdateTask` through a gRPC *client*
(`internal/mcp/server.go:472`), so it is covered too.

**But the missed fourth path cannot store either field.** The pass-through server's store is
`github.NewPassThroughStore` (`internal/cli/connect.go:299`), and
`GitHubPassThroughStore.UpdateTask` (`internal/platform/github/passthrough.go:315`) handles
`Title, Description, Stage, Priority, Type, AddLabels, RemoveLabels, AssigneeID, ClearParent,
ParentTaskID` and **never touches `p.RemoteData` or `p.AddPullRequests`** `[M-sub, re-verified by
reading the function body]`. So the interceptor argument is factually accurate and does not support
the conclusion — the one interceptor-less server is precisely the one with no sink for these fields.

The decision is still right; the *real* reason is O2's: the store is bypassed by platform sync, so
the closer to the store the check sits the more it covers, and the method body is the closest point
that is still on every client-controlled path. Not blocking — but this is a rationale a future
reader will act on, and it is the wrong rationale. Rewrite the comment at `urlvalidate.go:36-42` to
the reason that actually holds.

### O4. Credentials-in-URL are pinned as *desired* behaviour

`safe-url.test.ts:91` and `urlvalidate_internal_test.go:78` both pin
`https://user:pass@example.com/x` as accepted. Both sides agree, so it is not drift, and it is not a
scheme issue. But `user:pass@` is a recognised host-spoofing shape in a rendered link, and pinning it
in a test converts "we didn't think about it" into "we decided this." Worth deciding on purpose.

---

## Nit

- `url-binding-scan.test.ts:35` fires on `data-href=${x}` (measured false positive). Harmless today,
  but the first person who hits it will add a rubber-stamp allow-list entry rather than fix the
  regex. Anchoring on `[\s.]` fixes it as part of R1.
- `safe-url.test.ts:171` couples the `target="_blank"` pin to the literal text `href=${href}`, so it
  breaks if the local is renamed. It has a positive control (`anchors.length > 0`) so it fails loudly
  rather than silently — acceptable, but note it is a source grep, not a behavioural pin.

---

## FYI — load-bearing claims I checked and found TRUE

A green control is a finding. Each of these was flagged as unverified; each holds.

1. **`Attachment.url` is a dead field — TRUE `[M]`.** Declared at `proto/farmtable.proto:241`,
   reachable only via `Comment.attachments` (`:411`). Zero occurrences of `Attachment` in any
   non-generated `.go` or `.ts` file. No Ent schema, no migrate column. `AddCommentRequest`
   (`:682-685`) is `{task_id, body}`. Positive control: the identical grep shape returns 200 hits for
   `PullRequest`. There is genuinely nothing there to guard.
2. **Four registration sites, one without interceptors — TRUE `[M]`.** Listed in O3. (The architectural
   conclusion survives; the reasoning does not — see O3.)
3. **Platform-sync writes are not client-controlled — TRUE, and stronger than claimed `[M-sub]`.**
   The only non-server `remote_url` writer is `graphql_queries.go:480` from `githubv4.URI`, and its
   sole caller (`passthrough.go:147`) synthesizes an in-memory task and persists nothing. The REST
   adapter's `buildRemoteData` (`github.go:255-269`) writes `html_url`, not `remote_url`.
4. **`urlBearingRemoteDataKeys` is correct today — TRUE `[M]`.** See R3 for why that is not enough.
5. **Empty means unset — TRUE and correct `[M]`.** `urlvalidate.go:44-46`. An empty `href` resolves
   to the current document; it is inert.
6. **`ft-toolbar.ts:460-465` is not a reusable guard — TRUE `[M]`.** It is
   `GITHUB_REPO_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/` applied to an opaque `collection.remoteId`
   plus a hardcoded `https://github.com/` prefix. There is no scheme logic to lift; `safeHref()` is
   correctly new code.
7. **No other URL ingress — TRUE `[M]`.** Exactly four `uri`-constrained proto fields:
   `Attachment.url` (:241, dead), `PullRequest.url` (:265, guarded via
   `UpdateTaskRequest.add_pull_requests`), `Task.remote_url` (:343, response-only),
   `UpdateTaskRequest.remote_url` (:633, guarded). `CreateTaskRequest`, `NewTaskSpec`,
   `CreateCollection`, `UpdateCollection` carry no URL field.
8. **The `remote_url` guard cannot be skipped — TRUE `[M-sub]`.** `server.go:659`'s outer condition is
   a disjunction including `req.RemoteUrl != nil`, so the sole assignment at `:666` is unconditionally
   dominated by the check at `:663`. Both guards `return` rather than `continue`, so a rejected
   element cannot be silently dropped.
9. **Sweep denominator 51 — TRUE `[M]`.** `find web/src -name '*.ts' ! -name '*.test.ts' | wc -l` → 51.

---

## Positive Feedback

Genuine, not manufactured.

- **`safe-url.ts:29-40`, the no-base decision.** Recording the measured counter-example
  (`new URL('//evil.com/x', origin)` → `https://evil.com/x`, accepted) in the docblock is exactly the
  right weight of comment, because "why isn't there a base argument here?" is the question that gets
  a helpful future contributor to break this.
- **`urlvalidate.go:48-58`, rejecting control characters explicitly** rather than leaning on `net/url`
  happening to error. That is the single most likely place a future Go release would have silently
  opened a hole, and the comment says so.
- **`safe-url.test.ts:143-153`.** The positive control *inside* the negative assertion — proving the
  same harness does produce an `href` for a good URL — is precisely the discipline that makes
  "no `href` was emitted" mean something. It is the model the `viaSafeHref` oracle in R2 should have
  followed, which is a little painful given they are 60 lines apart.
- **Commit hygiene.** I read all four commits separately. Each functional commit is coherent alone,
  each file list matches its message, and each message says what changed *and why*. `80cab87`'s note
  that `taskExport` is the egress direction and deliberately not guarded will save the next reader an
  hour. `d4c4e6b` is docs-only and correctly separated.
- **Reaching for a chokepoint at all.** R1 and R2 are defects in the execution, not the instinct. A
  scanner with a fixable regex is a far better starting point than two fixed call sites.

---

## Test Coverage

Go side is good. `urlvalidate_internal_test.go` has 22 rejection cases and 9 acceptance cases
including the empty-string control; `urlvalidate_rpc_test.go` covers all three ingress paths at the
RPC level with a legitimate-URL control on each, and correctly notes that `testutil.NewTestServer`
registers without interceptors, making the RPC pins structurally exercise the pass-through shape.
`go test ./...` on the branch: **10 packages ok** (base: 8; the +2 is `internal/server` splitting and
the new test files) `[M]`.

Frontend coverage of `safeHref` itself is thorough (21 rejections, 6 acceptances, a JSDOM render pin
with its own control). The gaps are all in the *scanner*, and they are R1 and R2.

**The single largest coverage gap is that the frontend suite does not run anywhere** — and, per C1,
currently cannot compile. The EM has correctly ruled the Makefile wiring out of scope for this
review; C1 is a separate defect owned by this change.

Flake characterisation `[M]`: my first full `go test ./...` produced `FAIL: TestWatchTasks_Heartbeat`
(`watch_test.go:398 timed out`) **and** a second, distinct failure — `rbac_test.go:767: creating
user: database table is locked`. Three subsequent runs of `./internal/server/` were clean. The brief
warns only about `TestWatchTasks*`; the SQLite lock contention in `rbac_test.go` appears to be a
second, unnamed flake in the same package. Pre-existing, not caused by this diff, out of scope — but
someone should know it exists, because "re-run any `TestWatchTasks*` failure" will not cover it.

`go vet ./...` exits 1 with the same 4 pre-existing copylocks, messages character-identical to base,
line numbers `1500/1610/1818/1995` → `1506/1616/1824/2001`, a uniform +6 matching the six lines added
to `server.go`. Verified at base in a scratch worktree, now removed `[M]`. No new vet findings.

---

## Backward Compatibility

No wire-format change; no field added, removed, or renamed. The behavioural change is that
`UpdateTask` and `ImportCollection` now return `InvalidArgument` for inputs they previously accepted.

Two things to be aware of, neither blocking:

- **Existing rows are not migrated.** A stored `javascript:` URL stays in the database and is
  neutralised only at render, only at the two guarded call sites. The author flags this in report §8.
  Agreed as a follow-up, not a blocker — but it means the frontend guard is load-bearing indefinitely,
  which raises the cost of R1 and R2.
- **Collection import becomes stricter.** Any existing export document containing a non-http(s) task
  URL will now fail to re-import. `TestRPC_ImportCollection_AcceptsHTTPURLs` is the control for the
  happy path; there is no test for round-tripping an *existing* export that contains a legacy bad URL.
  That is arguably correct behaviour (refusing to re-ingest a payload), but it is a behaviour change
  in a data-migration path and nobody has decided it on purpose.

---

## Deliverable 2 — Ship alone, or ship with the Makefile fix?

**Neither, as currently posed. It cannot ship in its present form at all** — C1 turns `make web` and
`make dashboard` red, and those targets are invoked today, independently of anything the
`dev-prod-hardening` track does.

Once C1, R1 and R2 are fixed, my recommendation is **ship together**, for three reasons:

1. **The fix for C1 lives in the same file the Makefile track will touch.** `web/package.json` needs
   a `devDependencies` change from this track and a `scripts` change from that one (and R4 rewrites
   the `test` script entirely). Two tracks editing that file independently is an avoidable conflict
   for zero gain.
2. **R1 and R2 are much cheaper to fix before the scanner gates than after.** The moment `npm test`
   becomes a CI gate, `url-binding-scan` becomes a control that reviewers and CI *trust*. Landing it
   with two known green-while-false paths and fixing them later means some window where the project
   believes it has a chokepoint it does not have. That is worse than having no scanner, because a
   missing control gets noticed and a lying one does not.
3. **Order of failure.** If this lands alone with C1 unfixed, the Makefile track lands on top of a red
   `make web` and spends its budget debugging someone else's dependency problem.

**If you decide to ship alone anyway** (which is defensible — three-quarters of this change stands on
its own: the two Go guards run under `make test`, and the two call-site fixes ship in the bundle via
`vite build` and execute in the browser regardless of whether any test runs), then C1 is still
mandatory, and I would add one condition: **the project log and the author's report must stop
describing the scanner as an active chokepoint and record it as *staged*, pending the Makefile
track.** A control documented as live but invoked by nothing is a trap for the next reviewer, and
this codebase's recorded failure mode is precisely believing a docblock's account of what a line is
for.

---

## Deliverable 3 — Escalation to a further specialist?

Scoped as instructed: this is about **follow-on** work. I make no recommendation about the
test-engineering and security-audit legs running in parallel on this commit — I cannot see them,
cannot cancel them, and will not assume their content.

**Yes, escalate to test engineering as follow-on.** Not for coverage of the Go guards, which is
good — for ownership of the `web/` test harness *as infrastructure*. Two of my three highest-leverage
findings (C1, R4) and both scanner findings (R1, R2) are defects in the harness, not in the fix. The
general question underneath them — *what makes a source-scanning test trustworthy, and how do you
write fixtures that can falsify their own pattern rather than confirm it?* — is going to recur every
time this project builds a chokepoint, and it deserves an owner rather than a per-PR rediscovery.

**Recommend one specific piece of follow-on work regardless of who does it:** a differential test
between `validateURLField` and `safeHref` (generate inputs, run both, assert agreement on
accept/reject). It is the only thing that settles O1's whole-input-space question, and I found one
real divergence by hand already.

**On a further security pass I take no position**, and I want to be explicit about why rather than
leave it as silence. My review found no exploitable hole in the scheme rule itself, and the
composition argument in O1 holds as far as I could probe it — but I probed the parser boundary by
hand and did not fuzz it, and my Critical and Required findings are all about the *durability* of the
controls rather than the correctness of the rule. Those are different questions and my axis only
answers one of them. If the security leg reports findings in the rule, weight theirs over my silence.

---

## Deliverable 5 — Every place the brief was wrong

1. **The web baseline is an artefact of a polluted working directory, and it hid the Critical.**
   The brief's baseline table records `cd web && npm test` → exit 0 and presents it as the branch's
   web baseline. It did not run `npm ci` first and did not measure `npm run build` or `make web` at
   all. Both `npm test` and `npm run build` are green in this clone only because `node_modules`
   contains an unsaved `npm install jsdom` — 41 packages that `npm ls` reports as **extraneous** and
   that appear nowhere in `package-lock.json`. From a clean `npm ci`, the branch is red. See C1.

2. **"The scanner is wired into a command nothing invokes" is true, but the inference drawn from it
   is wrong.** The framing — and the explicit instruction that the Makefile gap is the only build-
   related issue and is not mine to file — implies the change is inert with respect to invoked build
   commands. It is not: it breaks `make web` and, transitively, `make dashboard`. The untouched
   Makefile does not insulate this branch from the build; it is the reason the breakage has not been
   noticed. This is the error I would most want corrected, because it is the one that nearly caused
   me to scope C1 out.

3. **`origin/main` does not exist in this clone.** The brief states "Base of the branch is `7a0f220`
   = `origin/main` = live in production." `git rev-parse origin/main` → `fatal: ambiguous argument`.
   `origin` is `/workspace/farmtable-xss-url` and carries only `origin/url-scheme-validation` and
   `origin/markdown-sanitize`; `origin/HEAD` → `origin/url-scheme-validation`. I could not verify
   from here that `7a0f220` is production and carried it as `[MEASURED-BY-EM]`. (The author's report
   §7 item 6 reports the same thing, so this is a repeat that survived into the next brief rather
   than a new one — which is arguably worse.)

4. **The brief restates the scanner's own claim as fact, in the same breath as asking me to test it.**
   Item 2 says it "fails on any unapproved `href`/`src` binding or `.href`/`.src` assignment
   anywhere in the tree." It does not — quoted bindings are missed (R1) and `.test.ts` files are
   excluded from the walk by `url-binding-scan.test.ts:104`. I flag this because a declarative
   sentence in a brief is exactly the kind of thing a leg under time pressure carries forward
   unexamined, which is the failure mode the brief itself warns about. Ask the question without
   asserting the answer first.

5. **The flake warning is incomplete.** The brief names `TestWatchTasks*` and says to re-run any
   `TestWatchTasks*` failure. My first full-suite run produced `FAIL: TestWatchTasks_Heartbeat` **and**
   a second, distinct failure in the same package: `rbac_test.go:767: creating user: database table is
   locked` — SQLite lock contention, not a WatchTasks timeout. Following the brief's rule literally
   ("re-run any `TestWatchTasks*` failure") would not have covered it. The advice should be "re-run
   any `internal/server` failure and read names."

6. **Item 3's diffstat is unfilled, not wrong.** "`web/tsconfig.test.json` changed (+6/−?)" — actual is
   +6/−1. Noting only because I checked it.

**Things I checked that the brief got right,** since a green control is a finding: the diffstat
(13 files, +1079/−14) is exact; all six new-file line counts (121/92/210/70/194/225) are exact; the
base-commit `go vet` copylock line numbers (1500/1610/1818/1995) are exact, verified in a scratch
worktree at `7a0f220`; `make test` is `go test ./...` and `make web` is `cd web && npm ci && npm run
build`; and no Makefile target or documented command runs `npm test`.

**Discipline check.** No production code modified. Three probe experiments (a temporary
`web/src/components/zz-probe.ts`, a disarmed `ft-inspector-code.ts`, a temporary
`internal/server/zz_probe_test.go`), all reverted; one scratch git worktree at `7a0f220`, removed;
two temp clones under `/tmp`, outside the repo. `git status --porcelain` empty and
`git rev-parse HEAD` = `d4c4e6b` at the end. Nothing pushed.

---

## Final Verdict

**REQUEST CHANGES** — 1 Critical, 4 Required.

Blocking: **C1** (undeclared `jsdom`/`@types/jsdom`/`@types/node` break `make web` and
`make dashboard` from a clean `npm ci`), **R1** (scanner misses quoted `href="${...}"`; its fixtures
cannot falsify it), **R2** (`viaSafeHref` oracle checks an import, not a dataflow; the guard is
removable while the suite stays green), **R3** (`urlBearingRemoteDataKeys` held in sync by a comment,
with a security consequence on drift), **R4** (hand-maintained test registries that fail silently,
and a fail-fast chain that stops the chokepoint running when an unrelated test is red).

The underlying security fix is sound and I recommend keeping every design decision in it. The five
blocking items are all in the scaffolding: the dependency set, the scanner's regex, the scanner's
oracle, one Go-side comment-as-control, and the test runner. None requires rethinking the approach;
together they are perhaps half a day.
