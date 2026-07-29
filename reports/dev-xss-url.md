# dev-xss-url — report

Branch `url-scheme-validation`, base `7a0f220`. Three commits, not pushed.

| commit | scope |
|---|---|
| `4187910` | Server: scheme allow-list at the `UpdateTask` write boundary |
| `80cab87` | Server: same allow-list on the collection-import ingress |
| `f0ab53f` | Frontend: shared `safeHref()`, two site fixes, tree-wide scanner, `target="_blank"` pin |

---

## 1. What I measured, and what I am NOT claiming

Taking Addendum Correction 2 seriously, here is the line between the two.

**ESTABLISHED (measured by me at `7a0f220`):**

- Attacker-controlled text reaches an `href` attribute with no validation in Go, no validation
  in TypeScript, and no sanitizer in Lit. `setSanitizer` has zero occurrences in `web/src`.
- The two `uri = true` constraints on the live fields are inert. `protovalidate` appears in
  exactly one file (`api/farmtable/v1/farmtable.pb.go`) and only as a blank import; the runtime
  validator module is absent from `go.mod`/`go.sum`; `Validate(` has zero occurrences repo-wide.
- `javascript:`, `data:`, `vbscript:`, `blob:`, `file:` all pass through the pre-fix write path
  unmodified and are returned verbatim.

**NOT ESTABLISHED, and I did not test it:** that `javascript:` executes on click in a real
browser. I had no real browser engine available. Both anchors carry `target="_blank"`, and
engines block `javascript:` navigation into a new browsing context. I did not attempt a JSDOM
navigation test because JSDOM implements no navigation, so a negative result there would have
been an artefact of the harness, not a finding — the same trap the addendum describes.

**The harm I can defend on my own measurements** is the one that does not depend on the
contested payload: an arbitrary attacker-chosen URL rendered under first-party dashboard chrome.
`target="_blank"` is an incidental mitigation that nothing pinned — so I pinned it (see §4).

---

## 2. MUST 1 — the fix, and which paths it covers

`validateURLField` in the new file `internal/server/urlvalidate.go`. Allow-list `{http, https}`;
everything else rejected with `InvalidArgument` naming the field and the accepted schemes.
Empty is accepted and means "unset" (it lets callers clear the field; an empty `href` cannot
execute script).

**Why not an interceptor — and how I established the coverage claim.** There are 4 production
registration sites. I read all of them:

| site | interceptors |
|---|---|
| `cmd/farmtable-server/main.go:92` | unary + stream auth |
| `internal/cli/connect.go:163` (embedded) | unary + stream auth |
| **`internal/cli/connect.go:302` (CLI pass-through)** | **none — message sizes only** |
| `internal/cli/dashboard.go:87` (dashboard) | unary + stream auth |

All four call the same `server.NewFarmTableService(...)`. The check therefore lives in the
**service method body**, which every path reaches regardless of interceptors. An interceptor
would have covered three and silently missed the pass-through.

This is not merely argued, it is exercised: `testutil.NewTestServer` (used by my RPC pins)
registers with **no interceptors**, structurally identical to the pass-through. An
interceptor-based fix would not have been exercised by those tests at all.

**Parser behaviour, measured rather than assumed** (`net/url`, Go):

| input | result |
|---|---|
| `JaVaScRiPt:alert(1)`, `JAVASCRIPT:...` | parses, `Scheme == "javascript"` — **the parser already case-folds** |
| `HTTP://`, `HtTpS://` | `Scheme == "http"` / `"https"` |
| `\tjavascript:`, `\njavascript:`, `\x00javascript:`, `java\tscript:` | **parse error** |
| ` javascript:alert(1)` (leading space) | parse error |
| `//evil.com/x`, `/relative/path`, `not-a-url` | parse OK, empty scheme |
| `http:/\/\evil.com` | parse OK, `Scheme=="http"`, **`Host==""`** |

So case-folding is done for me; I fold again anyway so the guarantee does not rest on a parser
detail. I reject control characters/whitespace **explicitly** rather than relying on the parse
error, because browsers strip tabs and newlines before acting on a URL, so `java\tscript:x`
navigates as `javascript:x`; leaving that to an incidental parser error would be fragile. I also
require a non-empty host, which is what rejects `http:/\/\evil.com`.

### The write-boundary denominator

I enumerated the writers rather than trusting the supplied list. **3 client-controlled ingress
paths for these fields; all 3 covered:**

| # | path | status |
|---|---|---|
| 1 | `server.go:643` `add_pull_requests[].url` → `store.PullRequestParam` | **guarded** |
| 2 | `server.go:660` `remote_url` → `RemoteData` map | **guarded** |
| 3 | `export_import.go:~740` `importedTask` — `PullRequests` + `RemoteData` copied verbatim from uploaded JSON | **guarded** |

Deliberately **not** guarded, with reasons:

- **Platform sync** (`internal/platform/github/*` writes `remote_url`/`html_url` from the GitHub
  API). Not client-controlled; values originate from the upstream platform. Adding a hard
  rejection here could break sync on upstream data I cannot inspect. The frontend guard covers
  the render side. Flagged as a judgement call.
- **`Collection.remote_data`** (`export_import.go:332`). Client-controlled, but it reaches no
  `href` — the toolbar uses `collection.remoteId` through a regex, not this map. Noted, not
  guarded, because `remote_data` is a documented arbitrary-payload escape hatch.
- **`taskExport` (`export_import.go:419`, lines 437-438)** is the **export** direction —
  store → JSON. Not an ingress. See §7.

For `RemoteData` I validate the keys `convert.go` actually surfaces as URL-typed proto fields
(`remote_url`), rather than guessing which other values in an untyped map look like URLs. That
list is a named constant next to a "keep in sync with convert.go" note.

---

## 3. MUST 3 — the sweep, with denominators

**Frontend URL-reaching sinks in `web/src`. Denominator: 51 non-test `.ts` files scanned,
4 findings, 4 inspected, 4 now approved.**

| # | file:line | binding | before | after |
|---|---|---|---|---|
| 1 | `inspector/ft-inspector-code.ts` | `href=${pr.url}` | **unguarded** | via `safeHref()` |
| 2 | `inspector/ft-inspector-meta.ts` | `href=${t.remoteUrl}` | **unguarded** | via `safeHref()` |
| 3 | `ft-toolbar.ts:465` | `href=${url}` | safe by construction | allow-listed w/ reason |
| 4 | `ft-toolbar.ts:496` | `a.href = url` | safe by construction | allow-listed w/ reason |

This count is corroborated: my scanner and an independent search agent arrived at 4 separately.

**Clean results — reported as required outcomes, each with a positive control:**

- **Zero `src=` bindings** in `web/src`. Positive control: the identical `grep -F` shape returns
  3 for `href=`, and finds `src=` in `web/index.html` outside `src/`.
- **Zero** occurrences of `window.open`, `location.assign/replace`, `<img`, `<iframe`,
  `<script`, `<link`, `formaction`, `xlink:href`, `url(`, `unsafeSVG`, `innerHTML`.
  Positive controls: each pattern matches under `node_modules` with the same shape;
  `location.reload` (same shape) matches 2 real sites in `web/src`.
- **Markdown is sanitized.** `renderMarkdown` = `DOMPurify.sanitize(marked.parse(md))` with no
  config, so DOMPurify's sealed default `IS_ALLOWED_URI` applies and strips a `javascript:`
  href. `[x](javascript:alert(1))` yields an `<a>` with the attribute removed. **Static reading
  of the config path; I did not execute it.** Out of scope — `markdown-sanitize` owns it.
- **`Attachment.url` is a dead field.** Zero references in any non-generated Go file; zero
  component references (only `attachments: []` in generated code). Positive controls:
  `PullRequest` returns 126 with the identical grep, and `Attachment` *does* appear in
  `farmtable.pb.go`, so the term is greppable. **There is no write boundary to fix.** See §7.
- **`CUSTOM_FIELD_TYPE_URL` (Correction 1c): RESOLVED CLEAN**, by two independent methods, not
  one narrow grep. (a) The only non-generated `customField` reference in `web/src` is
  `customFields: []` in a test fixture; zero components import or render `CustomField`;
  `CUSTOM_FIELD_TYPE_URL` appears only in the generated descriptor JSON. Positive controls:
  `pullrequest` → 8 non-gen hits with the identical shape; `customfield` → 36 hits inside
  `gen/`. (b) Independently, the exhaustive `href`/`src` denominator is 4 and none is a custom
  field. A URL-typed custom field value cannot reach an `href`/`src` at this commit because
  **nothing renders custom fields at all.**

**Where I stopped:** at `href`/`src`/navigation/loadable sinks in `web/src` and at the Go write
paths for the four `uri`-constrained proto fields. I did not audit CSS-injection or
Shoelace-internal icon resolution beyond confirming icon names come from exhaustive enum
switches over literals.

---

## 4. MUST 2 — the frontend guard, and two decisions taken on evidence

One shared helper, `web/src/util/safe-url.ts`, not three copies.

**Decision A — no `mailto:`.** The auditor's proposed helper allowed it; the server allow-list
does not. The two fields are a pull-request URL and an external-source URL; both are http(s) by
nature and the GitHub adapter only ever writes https. A client rendering a scheme the server
rejects is dead code by the addendum's own criterion. **Client and server now agree exactly on
`{http, https}`.**

**Decision B — no base argument to `new URL()`.** This one is measured, and it argues against
the proposed helper:

| input | `new URL(raw)` | `new URL(raw, origin)` |
|---|---|---|
| `//evil.com/x` | throws → rejected | **`https://evil.com/x` → ACCEPTED** |
| `not-a-url` | throws → rejected | `https://<origin>/not-a-url` → accepted |
| `/relative/path` | throws → rejected | accepted |

With a base, a protocol-relative attacker URL is silently laundered into an allowed scheme, and
the client would accept three classes of input the server rejects. Without it, both agree.

**A cross-parser divergence worth recording.** Go's `net/url` **errors** on
`java\tscript:alert(1)`; the WHATWG parser used by browsers and by this helper **strips the tab**
and yields `protocol === 'javascript:'`. The two parsers disagree about what that string *is*.
Only an allow-list on the *parsed* scheme makes them agree on the *outcome* — a denylist applied
to the raw string would not have recognised it on either side.

**Degrade, don't drop (3b):** a rejected URL renders as inert visible text, not nothing.

**3c verified myself:** `ft-toolbar.ts:460-465` is confirmed good — but note it is **not a
reusable URL guard**. It is a GitHub repo-name regex plus a hardcoded `https://` literal prefix.
There was **no existing guard pattern to reuse**; I wrote `safeHref()` from scratch. See §7.

**`target="_blank"` pinned.** Both guarded anchors are now asserted to keep `target="_blank"`
and `rel="noopener"`, so the incidental mitigation stops being incidental.

**MUST 3d — the chokepoint rule.** `web/src/util/url-binding-scan.test.ts` fails on **any**
unapproved `href`/`src` binding or `.href`/`.src` assignment, tree-wide. Allow-list entries
carry a written justification; entries claiming to use `safeHref` are checked to actually import
it (so an entry cannot be a rubber stamp); and stale entries fail, so exemptions cannot outlive
the code they describe. Per 3e it ships with **7 positive fixtures** (including
`<a href=${this.description}>`, the exact shape the auditor planted) and **5 negative fixtures**.

**3d could not be done where I was told to do it** — see §7.

---

## 5. MUST 4 — RED-then-GREEN, by test name

Every pin was proven RED by a separate experiment; all experiments reverted; `git diff --quiet`
asserted clean after each.

**Server pin 1 — neutralise `validateURLField` to `return nil`:**

RED (24 failures): `TestValidateURLField_RejectsScriptBearingSchemes` and all 22 subtests
(`/javascript`, `/javascript_exfiltration`, `/javascript_mixed_case`, `/javascript_upper_case`,
`/data_html`, `/data_base64`, `/vbscript`, `/blob`, `/file`, `/leading_tab`, `/leading_newline`,
`/leading_space`, `/embedded_tab`, `/embedded_newline`, `/embedded_carriage_return`,
`/leading_NUL`, `/trailing_whitespace`, `/scheme_relative`, `/relative_path`, `/bare_word`,
`/http_without_host`, `/backslash_host_confusion`), plus
`TestRPC_UpdateTask_RejectsScriptURLInPullRequest` and
`TestRPC_UpdateTask_RejectsScriptURLInRemoteURL`.

**Server pin 2 — remove the `validateImportedTaskURLs` call:**

RED: `TestRPC_ImportCollection_RejectsScriptURLs`, subtests `/pull_request_url` and
`/remote_data_remote_url`.

**Frontend pin A — make `safeHref` return the raw value unchecked:**

RED: `safe-url` — `safeHref("javascript:alert(1)") should be undefined for "javascript"`.

**Frontend pin B — restore the original unguarded `href=${pr.url}`:**

RED: `url-binding-scan` — `Unapproved URL-bearing binding(s) found ...
components/inspector/ft-inspector-code.ts:119`. Note `safe-url: ok` **still passed** here: the
scanner, not the unit tests, is what caught the regressed site. That is the chokepoint doing the
job the checklist could not.

**Frontend pin C — drop `target="_blank"` from a guarded anchor:**

RED: `safe-url` — `ft-inspector-meta.ts: guarded anchor lost target="_blank"`.

### Green controls — recorded as findings

In **every** server experiment, `TestValidateURLField_AcceptsHTTPAndHTTPS`,
`TestRPC_UpdateTask_AcceptsHTTPURLs` and `TestRPC_ImportCollection_AcceptsHTTPURLs` **stayed
green with the validation entirely disabled.** A happy-path-only suite would have detected none
of this — which is precisely the shape of the original defect: a declared constraint that nothing
invoked, with a green suite.

---

## 6. Final gates (child-process exit codes, no pipes)

| gate | predicted | measured |
|---|---|---|
| `go build ./...` | 0 | **0** |
| `go test ./...` | 0, 10 ok, 0 FAIL | **0, 10 ok, 0 FAIL** |
| `go vet ./...` | 1, same 4 copylocks | **1, same 4** |
| `npm test` (web) | 0 | **0** |
| `tsc --noEmit` (web) | 0 | **0** |
| `npm run build` (web) | 0 | **0** |
| `git status --porcelain` | empty | **empty** |

**Vet detail as required (messages and line numbers, not the count):** the 4 messages are
character-identical to baseline. Line numbers moved `1500→1506`, `1610→1616`, `1818→1824`,
`1995→2001` — a uniform **+6**, exactly the six lines I added to `server.go` (two 3-line
validation blocks). No new finding, none resolved.

`tsc` got its own positive control: injecting a deliberate type error made it exit 2 and name my
file, so its exit 0 is a real pass and not a misdirected invocation.

No `TestWatchTasks*` flake was observed in any run.

---

## 7. Deliverable 4 — every place the brief was wrong

Corrections 1, 1b, 1c and 2 were self-reported by the EM; I confirmed each and will not re-list
them. **New errors I found:**

1. **`web/src/util/markdown.test.ts` does not exist at this base — MUST 3d was not executable as
   written.** `BANNED_SINKS`: zero occurrences repo-wide including `node_modules`. The only
   `*.test.ts` under `web/` is `src/utils/task-ready.test.ts`. A ref scan shows the file exists
   only on `markdown-sanitize`. The `[MEASURED-BY-audit-195-r9]` measurement was true on *their*
   branch and was relayed to me for a different base. Positive controls: `find` with the
   identical shape locates `task-ready.test.ts`; `grep -rlF 'renderMarkdown'` returns 3 files.
   *Resolved:* built the rule as a self-contained file. The EM confirmed independently, withdrew
   the coordination constraint, and there is now zero shared-file conflict surface with #195.

2. **The brief's `MUST 1` field list would have fixed a dead field and missed a live one.**
   It named `PullRequest.url` and `Attachment.url`. `Attachment` has **no write path, no read
   path and no renderer** — proto-only. The genuinely live second field is `remote_url`. So the
   original two-field instruction would have delivered one real fix, one no-op, and left the
   `ft-inspector-meta.ts` sink's ingress unguarded. (I found this before Addendum 1 arrived; the
   addendum's Correction 1 identifies the same gap but still lists `Attachment.url` as something
   to fix — **there is nothing there to fix**.)

3. **The chain table's ingress line number is wrong.** The brief cites
   `internal/server/server.go:922-928` for `store.PullRequestParam{URL: pr.GetUrl()}`. Lines
   922-928 are `GetCollection`/`GetComment` code. The real site is **`server.go:640-645`**, in
   `UpdateTask`.

4. **Addendum Correction 1b's second import line number is wrong, and in a way that matters.**
   It cites `export_import.go:740` *and* `:438` as ingress paths. Line 438 is inside
   `taskExport(t *ent.Task) exportTask` — the **export** direction, store → JSON. It is not a
   write boundary and adding a rejection there would break exporting data already stored. Only
   `:740` (`importedTask`) is an ingress. I guarded `:740` only.

5. **`ft-toolbar.ts:461-465` is not a reusable guard, so "reuse the pattern" was not possible.**
   The brief says to verify it and reuse it. It is a GitHub repo-name regex over an opaque
   identifier plus a hardcoded `https://` prefix — safe by construction, with no URL-parsing or
   scheme-checking logic to lift. `safeHref()` is new code.

6. **`origin/main` does not exist in this clone.** `git rev-parse origin/main` fails; the only
   remote branch is `origin/markdown-sanitize`. Further, `markdown-sanitize` **contains**
   `7a0f220` as an ancestor, so `origin/HEAD` is ahead of my base rather than a sibling.
   *Per the EM's instruction, recorded as attributed rather than as my finding:* 7a0f220 is
   origin/main and is the commit the EM has been treating as live in production
   `[MEASURED-BY-EM, from a different clone that has the origin/main ref]`. I did not verify
   this and cannot from here.

7. **The three-`href` table in MUST 2 is complete for `href=` but the sweep's true denominator is
   4**, because `ft-toolbar.ts:496` assigns `a.href` imperatively. Benign (a `blob:` URL from
   `URL.createObjectURL`), but a scanner matching only `href=${` would miss that shape entirely,
   so my scanner covers property assignment too.

**Process errors I made, recorded because the brief's bars are the right ones:**

- My first `grep -rn "href=\${"` returned **zero** — reproducing the EM's exact failure mode. The
  positive control caught it immediately. Every negative in this report has one.
- I reported `BUILD_EXIT=0` once from a command piped into `head`. That was `head`'s exit code,
  not `go build`'s — the precise hazard the brief names. Re-measured without the pipe.
- I reverted a RED experiment with `git checkout` on a file whose real fix was **not yet
  committed**, wiping the fix. Caught by the immediately-following test run. Afterwards I
  committed before experimenting so revert was always safe.

---

## 8. Residual risk

- **Malicious rows already in the database are not cleaned up.** The frontend guard neutralises
  them at render; no data migration was in scope. If you want them purged, that is a follow-up.
- **Platform-sync writes are unvalidated** (deliberate, §2).
- **Whether `javascript:` actually executes on click is still untested** (§1). It does not affect
  the fix, but if anyone wants the severity settled it needs a real browser engine.
- **`markdown.ts` ships at this base but `markdown.test.ts` does not** — the markdown guard is
  not in the production tree at all. Not mine; the EM is routing it. It is the reason shipping
  this chokepoint independently at main was the right call.
