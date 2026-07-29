# Security Audit — `url-scheme-validation-r2` @ `0bc9b72`

**Axis:** threat modelling and exploitability.
**Tree:** `/workspace`, `git rev-parse HEAD` = `0bc9b721475dfe2fb24c5eba1034a071b842c45c` [MEASURED] — matches.
**Review range:** `d4c4e6b..0bc9b72`, 10 commits, 20 files [MEASURED].

Tags used throughout: `[MEASURED]` = I ran it, this session, in this tree.
`[REPORTED — <who>]` = relayed. `[INFERENCE]` = reasoned, not run.

---

## Verdict

**APPROVE the diff.**

It closes the stored `javascript:` XSS, and I could not construct a payload that
reaches a script-bearing scheme through either guarded binding. Every finding
below is either non-exploitable today or concerns a *new* defence-in-depth
control that is weaker than its own comments claim. None of them is a reason to
hold a strict security improvement over the base commit.

**Stated separately, as the brief asks:** I approve while holding one concern
that is inside the diff's scope but that I do not think should block it —
**three comments added by this diff assert security properties that I measured
to be false** (§F-3, §F-4, §F-6). In a codebase whose recurring failure mode is
"a declared constraint that nothing invoked, with a green suite", a confidently
wrong comment is the raw material for the next round's defect. I recommend the
comment text be corrected before merge (it is a text change, not a code change);
the code fixes can follow.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 3 |
| Low | 3 |
| Info | 2 |

---

## My own gate baseline [MEASURED, this tree, this session]

I established this before attributing anything to the diff, per the shared block.

| gate | my exit | brief's `[REPORTED — dev-xss-r2]` | agree? |
|---|---|---|---|
| `npm ci` (in `web/`) | 0 | 0 | yes |
| `npm run build` | 0 | 0 | yes |
| `npm test` | 0, "PASS: 3 test file(s)" | 0, 3 files | yes |
| `go build ./...` | 0 (after `npm run build`) | 0 | yes |
| `go vet ./...` | **1** | 1 | yes |
| `go test ./...` | **1** | 1 | yes, but see below |

`go vet`: exactly **4** occurrences of `assignment copies lock value to ephReq`,
at `internal/server/server.go:1509, 1619, 1827, 2004` — the four request types
and the four line numbers the brief names, matched by message. Control: the
string `copylock` appears **0** times in the output, exactly as the block warns.

`go test`: single failure, **`--- FAIL: TestWatchTasks_ClosedEvent (5.01s)`**.
The brief's table names `TestWatchTasks_NoInitial`. Same flake family, different
member — see brief-error #5.

**A control caught my own error.** My first Go-gate run was issued inside a
compound command that had already `cd`-ed into `web/`. `go build ./...` returned
**exit 0** with `go: warning: "./..." matched no packages`. Exit 0 on a build
that compiled nothing is precisely the "failed command reporting 0 matches" trap
in the shared block, and only the warning line distinguished it. I discarded
that run and re-ran from the repo root; the table above is the re-run.

---

## Claim-by-claim verdicts

### Claim 1 — "None of the 9 divergences is a scheme escalation." **CONFIRMED.**

I did not read their numbers off the fixture file. I built two independent
harnesses: a Go probe calling `validateURLField` directly, and a Node harness
calling the *compiled* `safeHref` from `web/.tmp-test/util/safe-url.js`. Both
carry positive controls (`javascript:alert(1)` must reject, `https://example.com/`
must accept) that fired before any row was recorded.

- **42 fixture rows, 42 exact reproductions. 0 mismatches** on either column.
  **9 divergences**, precisely the nine recorded. [MEASURED]
- I then went past their measurement: for every input I set it as a real `href`
  on a real anchor in a real JSDOM document and read back `a.protocol`.

| input | server | client | **DOM `a.protocol`** |
|---|---|---|---|
| `""` | accept | reject | `https:` (resolves to the page) |
| `http:/\/\evil.com` | reject | accept | `http:` |
| `http:/example.com` | reject | accept | `http:` |
| `http:example.com` | reject | accept | `http:` |
| `http://example.com/a b` | reject | accept | `http:` |
| `https://example.com/x\n` | reject | accept | `https:` |
| `http://example.com/%zz` | reject | accept | `http:` |
| `https://example.com:99999/x` | **accept** | **reject** | **`:`** (unparseable) |
| `https:///x` | reject | accept | `https:` |

Every one resolves to `http:`/`https:` or to nothing at all. **No divergence
yields a script-bearing scheme at the sink.** The "attacker-chosen host, not
attacker-chosen scheme" reading is correct for all nine.

**On the direction the brief flagged as most interesting** — server accepts,
client rejects (`https://example.com:99999/x`): it is the *least* interesting of
the nine, and I would have predicted otherwise. The port is out of range, so the
WHATWG parser refuses it; at the sink `a.protocol` is `':'` and `a.href` returns
the raw attribute unchanged. A browser cannot navigate it. Even if this value
reached an *unguarded* href it would be an inert link, not a redirect. The
asymmetry is real; the surprise is not there. It is in the other direction (§F-4).

### Claim 2 — "`remote_url` read-path validation is not attacker-reachable today." **CONFIRMED on all three legs, but the control it describes is only half-installed.** See §F-1.

- **No webhook receiver.** `webhook` appears 55× in Go, **all** in
  `api/farmtable/v1/farmtable.pb.go` as a data-only `WebhookSource` enum. Zero
  occurrences under `internal/` or `cmd/`. Positive control for that grep: the
  same tooling finds 72 non-test hits for `graphql`. No inbound HTTP route in
  `internal/serverapp/` accepts platform payload — the registered handlers are
  OAuth login/callback, session, and the GitHub/Jira/Linear *link* callbacks.
  [MEASURED]
- **No configurable API base URL.** Production builds the client with
  `githubv4.NewClient(httpClient)` (`internal/platform/github/graphql.go:26`),
  which hardcodes `api.github.com`. `NewEnterpriseClient` appears exactly once,
  in `graphql_test.go:96`. [MEASURED]
- **`issue.URL` genuinely GitHub-generated.** `"remote_url"` is written in
  exactly one place outside the validated server paths:
  `internal/platform/github/graphql_queries.go:480`, from `issue.URL.String()`
  off the GraphQL response. No other adapter writes it — `beads`'
  `buildRemoteData` has no URL key at all. The only other unvalidated source is
  legacy rows, which the leg named. [MEASURED]

So the leg was right to call this a missing control rather than an open hole,
and right not to write it up as exploitable. I agree, at equal weight.

### Claim 3 — "`safeHref` is a sufficient control for legacy `pr["url"]` on every path to the DOM." **CONFIRMED for the current tree, with the caveat that this is a snapshot property, not a structural one.**

`pullRequests` reaches the DOM through exactly one route:
`ft-inspector-code.ts:122` → `renderPrLink(pr.url, pr.id)` → `safeHref`. There is
no second consumer of `pr.url` anywhere under `web/src` [MEASURED]. The rejected
branch renders the raw URL into a `title` attribute, which is a text sink, not a
URL sink.

I did not stop at "the guard is called". Per the method note, I rendered the
**real** production functions through lit into JSDOM and **enumerated every node
and every attribute** that survived, rather than grepping for `href`. Payload
set deliberately included six strings `safeHref` **accepts** — because
`safeHref` returns the *raw* input, not a normalised URL, so its output can
legitimately contain `"`, `<`, `` ` ``, `${` and newlines.

Harness control: a benign URL must produce `<a href="https://github.com/o/r/pull/1">`.
It did; without that the "inert" verdicts below would be vacuous.

Result across 20 render cases (2 functions × 10 payloads):
**0 event attributes, 0 injected elements, 0 non-http(s) resolved hrefs.**
`https://example.com/" onmouseover="alert(1)` lands in the attribute *value*
verbatim and stays inert, because lit's attribute parts go through
`setAttribute`. Confirmed by enumeration, not assumed.

### Claim 4 — The chokepoint scanner's recall. **Materially incomplete, and the re-scoping does not do what it says.** See §F-2 and §F-3. Answer to "is there a formulation that makes the bad state unrepresentable" in §R-1.

---

## Findings

### [MEDIUM] F-1 — The `remote_url` read-path drop removes the value from the typed field but still ships it to the client in `remote_data`

- **Location:** `internal/server/convert.go:321-341`
- **Description:** The new guard drops the bad URL from `pt.RemoteUrl`, then the
  very next line — `pt.RemoteData, _ = structpb.NewStruct(t.RemoteData)`, line
  341, unchanged by this diff — serialises the **whole map**, including the
  `remote_url` key that was just rejected. The same GitHub adapter also writes
  the identical URL under a second key, `html_url`
  (`graphql_queries.go:482`, and `github.go:261` in the non-passthrough
  adapter), which no validator has ever looked at.
  `urlBearingRemoteDataKeys` (`urlvalidate.go:91`) is documented "Keep this in
  sync with the RemoteData reads in convert.go" — but line 341 *is* a read of
  every key, so the list is out of sync by construction.
- **Impact:** The passthrough hole the comment says it closes is closed for one
  of two carriers of the same string. Not exploitable today: no `web/src` code
  reads task `remoteData` (the two `remoteData` reads,
  `capabilities.ts:98` and `ft-app.ts:256`, are on `Collection`, and neither
  reaches a URL sink) [MEASURED]. It becomes exploitable the first time any
  component reads `task.remoteData.html_url` — which is the more natural key
  name of the two, and is the one a developer adding a "view on GitHub" link
  would reach for.
- **Proof of concept** [MEASURED, probe since removed]:
  ```
  task.RemoteData = {"remote_url": "javascript:alert(1)", "html_url": "javascript:alert(1)"}
  taskToProto(task) ->
    typed  RemoteUrl              = ""  (nil=true)          <- dropped, good
    untyped remote_data.remote_url = "javascript:alert(1)"  <- still shipped
    untyped remote_data.html_url   = "javascript:alert(1)"  <- never validated
  ```
  Control in the same probe: a good URL survives as `RemoteUrl`, so the branch
  was genuinely exercised.
- **Recommendation:** Scrub the map, not just the typed field, and cover both
  keys:
  ```go
  // urlvalidate.go
  var urlBearingRemoteDataKeys = []string{"remote_url", "html_url"}

  // convert.go, replacing line 341
  if t.RemoteData != nil {
      clean := make(map[string]any, len(t.RemoteData))
      for k, v := range t.RemoteData {
          if slices.Contains(urlBearingRemoteDataKeys, k) {
              s, ok := v.(string)
              if !ok || (s != "" && validateURLField(k, s) != nil) {
                  continue // drop, same degradation as the typed field
              }
          }
          clean[k] = v
      }
      pt.RemoteData, _ = structpb.NewStruct(clean)
  }
  ```
  No test currently asserts anything about `GetRemoteData()` on this path
  [MEASURED], so this needs a pin.

### [MEDIUM] F-2 — Scanner recall: 16 of 25 additional sink shapes are undetected, and at least one is already idiomatic in this tree

- **Location:** `web/src/util/url-binding-scan.test.ts:33-53`
- **Method:** I transcribed the four `RULES` regexes verbatim and ran a
  **fidelity control first**: my copy must reproduce all 14 of the scanner's own
  positive fixtures and all 9 of its negatives. It did, exactly — so the
  results below are about the real matcher, not my paraphrase of it. I then
  tested 25 shapes the scanner has not been shown. [MEASURED]
- **Confirmed green:** the three shapes the leg identified now fire
  (`href="${raw}"`, `setAttribute('href', …)`, `setAttributeNS(XLINK, 'xlink:href', …)`),
  as do `.href=${x}` lit property bindings, `ifDefined()` wrappers, `<base href>`,
  `innerHTML`/`outerHTML`/`insertAdjacentHTML` with a quoted `href="${…}"`, and —
  usefully — multi-line formatting, because the value stays on the same physical
  line as the attribute name in every Prettier output I could construct.
- **Not detected**, ordered by exploitability:

  | shape | why it matters |
  |---|---|
  | `html\`<iframe srcdoc=${x}>\`` | full HTML injection — strictly worse than an `href` |
  | `html\`<form action=${x}>\`` | `javascript:` in a form action executes on submit |
  | `html\`<button formaction=${x}>\`` | same, per-button |
  | `window.open(x)` | `javascript:` URL runs in the opener's context |
  | `location.assign(x)` / `location.replace(x)` | navigation, not a property write |
  | `Object.assign(el, { href: x })` | **already used 3× in this tree** |
  | `el.setAttribute(attrName, x)` | dynamic attribute *name* defeats rule 4 |
  | `html\`<a href="/x" ping=${x}>\`` | exfiltration sink |
  | `html\`<object data=${x}>\`` | loads a document |
  | `html\`<img srcset=${x}>\`` | URL sink |
  | `style=${\`background:url(${x})\`}` / `el.style.backgroundImage` | CSS URL sink |
  | `html\`<a ${unsafeStatic(attr)}=${x}>\`` | attribute name itself dynamic |

- **The one that changes the severity** is `Object.assign`. I predicted it would
  be a hypothetical; it is not. The pattern
  `Object.assign(document.createElement('sl-alert'), {...})` already appears at
  `ft-dependency-view.ts:1378`, `ft-toolbar.ts:701` and `ft-app.ts:766`
  [MEASURED]. It is house style here. `Object.assign(document.createElement('a'),
  { href: url, download: name })` is the natural next step from the existing
  `ft-toolbar.ts:496` download code, and the scanner would not see it.
- **Recommendation:** the brief is right that this is an open set and a
  checklist over it will always be incomplete. Two things worth doing anyway:
  1. Add the high-value shapes as rules — `srcdoc`, `action`, `formaction`,
     `ping`, `data`, `srcset`, plus `window.open(` / `location.assign(` /
     `location.replace(`:
     ```ts
     { name: 'other URL-bearing attribute binding',
       pattern: /\b(?:srcdoc|formaction|action|ping|srcset|poster|data)\s*=\s*["'`]?\s*\$\{/ },
     { name: 'imperative navigation with a dynamic URL',
       pattern: /\b(?:window\.open|location\.(?:assign|replace))\s*\(\s*(?!['"`])/ },
     { name: 'URL property set through Object.assign',
       pattern: /Object\.assign\s*\([^)]*\b(?:href|src)\s*:/ },
     ```
  2. Add a rule that flags `setAttribute` with a **non-literal** first argument,
     since that shape is unanalysable by text and should be banned outright
     rather than scanned.
  3. Change the anti-vacuity assertion. It is currently
     `findings.length >= ALLOWED.length`, which is satisfied by 4 findings for 4
     allow-list entries — it cannot detect a walk that only reaches the two
     inspector files. Assert the file count instead (e.g. `files.length > 50`,
     measured: the walk sees the whole tree today).

### [MEDIUM] F-3 — `viaSafeHref` accepts a poisoned guard, and is class-scoped, not binding-scoped

- **Location:** `web/src/util/url-binding-scan.test.ts:170-187` (`enclosingBlock`),
  `:322-330` (the assignment regex)
- **Description:** two independent fail-opens in the check this diff added.

  **(a) The assignment regex matches a defeated guard.** The check is
  `new RegExp("\\b" + id + "\\s*=\\s*safeHref\\s*\\(")`. Measured, all of these
  are ACCEPTED as "guarded":
  ```
  ACCEPTED  const href = safeHref(url);                                  <- correct
  ACCEPTED  const href = safeHref(url) ?? url;                           <- guard defeated
  ACCEPTED  const href = safeHref(url) || url;                           <- guard defeated
  ACCEPTED  const href = safeHref(url) ?? "javascript:alert(1)";         <- guard inverted
  ACCEPTED  // const href = safeHref(url);                               <- commented out
  rejected  const href = url;
  ```
  `safeHref(url) ?? url` is not a contrived shape — it is the single most likely
  thing a developer writes when they want "the link should still work if the
  guard is being fussy", and it turns the control into a no-op while leaving the
  scanner green.

  **(b) The scope is the enclosing top-level block, which for a Lit component is
  the whole class.** The comment says the check "is now scoped to the binding"
  and that the old file-scope was wrong because "a file can guard one binding
  and leave the next one bare, which is the defect this scanner exists to
  catch". Measured, with a control (a genuinely guarded binding must pass, and
  it did):
  ```
  class FtThing extends LitElement {
    renderGuarded() { const href = safeHref(this.a); return html`<a href=${href}>`; }
    renderBare()    { const href = this.b;           return html`<a href=${href}>`; }   // PASSES
  }
  ```
  `enclosingBlock` walks back to the nearest column-0 line containing `{` — the
  `export class` line — and forward to the first column-0 `}` — the class close.
  The unguarded sibling method is laundered by the guarded one. That is the same
  hole, one level narrower.

  The comment defends the widening as "the safe direction — it can only make the
  check more permissive than intended, never wrongly fail a guarded binding".
  That reasoning is on the wrong axis: for a security scanner, *more permissive*
  is the failure mode, and *wrongly failing* is the acceptable cost.
- **Impact:** Not exploitable today. Both current allow-list entries are
  module-level functions (`renderPrLink`, `renderExternalSourceLink`), so
  today's scope really is tight. It stops being tight the moment someone inlines
  either function back into its component class — which is the obvious
  refactor, and which the `ft-inspector-code.ts` comment explicitly asks people
  not to do, i.e. it is already anticipated as likely.
- **Recommendation:**
  ```ts
  // (a) require the whole initialiser to be the guard, and reject comments
  const assignment = new RegExp(
    `^\\s*(?:const|let|var)?\\s*${id}\\s*=\\s*safeHref\\s*\\([^)]*\\)\\s*;?\\s*$`,
  );
  const block = enclosingBlock(lines, finding.lineNo)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
  ```
  ```ts
  // (b) scope to the nearest enclosing brace-balanced block, not the nearest
  // column-0 one. Walk backwards from the binding accumulating brace depth and
  // stop at depth -1; that is the real function body in both the module-level
  // and the class-method case.
  ```
  And correct the comment: "scoped to the enclosing top-level block, which for a
  class method is the whole class" is the accurate description of the current
  code.

### [LOW] F-4 — `safeHref` decides on a base-less parse; the sink always resolves against the document base, and for 4 of the 9 divergences they disagree about the host

- **Location:** `web/src/util/safe-url.ts:52-63, 70-78`
- **Description:** `safeHref` calls `new URL(raw)` with **no base**, and the
  comment argues at length that this is deliberate and "matches the server
  exactly". But the sink is an `<a>` in a document, which *always* resolves with
  the document's base URL. Under WHATWG rules, a special-scheme input whose
  scheme **equals the base's scheme** is parsed as a *relative* reference. So
  the two parses differ. [MEASURED, with a control confirming the anchor
  resolves against the base at all]

  | input | `new URL(raw)` host | host on an **https** dashboard | host on an **http** dashboard |
  |---|---|---|---|
  | `http:/example.com` | example.com | example.com | **localhost:8080** |
  | `http:example.com` | example.com | example.com | **localhost:8080** |
  | `https:/example.com` | example.com | **dash.internal.test** | example.com |
  | `https:example.com` | example.com | **dash.internal.test** | example.com |
  | `http:/\/\evil.com` | evil.com | evil.com | evil.com |
  | `https:///x` | x | x | x |

  Confirmed at the real sink too: rendering `renderExternalSourceLink('https:/example.com')`
  through lit into a JSDOM page based at `https://dash.internal.test/app/`
  produces an anchor that resolves to **`https://dash.internal.test`**.
- **Impact:** **No scheme escalation, in either direction** — the base is always
  http(s), so a base-relative resolution can only ever yield http(s). The
  base-less parse is therefore *conservative with respect to scheme*, which is
  the property that matters, and `//evil.com/x` is correctly rejected because it
  throws without a base. So the control is sound. What is not sound is the
  *reasoning recorded around it*: `testdata/url-scheme-cases.json` states hosts
  as facts ("WHATWG normalises to `http://example.com/` (host "example.com")",
  "the browser navigates there") when the host is base-dependent for four of
  them. Anyone who later reasons about open-redirect risk from those notes will
  reason from the wrong host.
- **Recommendation:** Keep the code. Add a sentence to `safe-url.ts` saying what
  the no-base parse *does* guarantee and what it does not:
  > No base means the decision is made on a different URL than the browser will
  > resolve. That is safe for the SCHEME (a base-relative resolution inherits
  > the page's http(s) scheme, so it can never escalate) but it is NOT accurate
  > for the HOST: `https:/example.com` is host `example.com` here and the
  > dashboard's own origin at the sink. Do not use this function's parse to
  > reason about open-redirect targets.

  And add a `note_base_dependent: true` marker to the four affected fixtures.

### [LOW] F-5 — The divergence set is sampled, not bounded, and the fixture file's framing says otherwise

- **Location:** `testdata/url-scheme-cases.json` `_README`
- **Description:** The README says "the point is that the disagreement is pinned
  and **bounded**". The 42 cases pin 9 divergences. I ran 39 further inputs of
  my own through both validators and found **10 more divergent shapes** outside
  the fixture set [MEASURED], including:
  `http:\\evil.com`, `https:/\evil.com`, `http:\/\/evil.com`,
  `http://example.com\@evil.com/`, `https://ex%41mple.com/` (percent-encoded
  host; `net/url` errors, WHATWG decodes to `example.com`),
  `https:example.com/x`, `https:/example.com/x`, `https:////x`, `https://///x`,
  and `https://example.com:65536/x`.
- **Impact:** None directly — all ten resolve to `http:`/`https:` or are inert,
  so Claim 1's conclusion survives being tested on a wider set, which is itself
  the useful result. The risk is only that "bounded" invites a future reader to
  treat the 9 as exhaustive.
- **Recommendation:** change "pinned and bounded" to "pinned and sampled; the
  divergence set is not closed — at least 19 shapes are known to diverge and the
  file records 9 of them as regression pins".

### [LOW] F-6 — The `hostname === ''` backstop's stated justification is false

- **Location:** `web/src/util/safe-url.ts:89-111`, test at
  `web/src/util/safe-url.test.ts:146-183`
- **Description:** The comment justifies keeping the line with:
  > every script-bearing scheme (`javascript:`, `data:`, `vbscript:`, `blob:`,
  > `mailto:`) is NON-special and parses with `hostname === ''`, so if one is
  > ever added to the allow-list by mistake this line still refuses it.

  I predicted before measuring that this holds only for the opaque-path
  spelling, because a non-special scheme followed by `//` *does* get an
  authority parsed. Confirmed [MEASURED]:
  ```
  hostname   protocol      input
  ''         javascript:   "javascript:alert(1)"
  evil.com   javascript:   "javascript://evil.com/%0aalert(1)"   <- backstop would NOT refuse
  %0aalert(1) javascript:  "javascript://%0aalert(1)"            <- backstop would NOT refuse
  x          data:         "data://x/,<script>alert(1)</script>" <- backstop would NOT refuse
  x          vbscript:     "vbscript://x/msgbox(1)"              <- backstop would NOT refuse
  ```
  `javascript://evil.com/%0aalert(1)` is a working XSS payload — the `//` opens a
  JS line comment, `%0a` ends it, `alert(1)` runs. JSDOM confirms a real anchor
  reports `protocol === 'javascript:'` for it. 5 of my 10 probes would slip the
  backstop.
- **Impact:** **Not exploitable.** `javascript:` is not in `SAFE_SCHEMES`, and I
  verified the widening tripwire actually works: `new URL('mailto://')`,
  `'blob://'`, `'data://'` and `'javascript://'` all parse rather than throw, so
  adding any of them to `SAFE_SCHEMES` turns
  `testHostGuardIsAFailClosedBackstop()` red [MEASURED]. That is a genuinely
  good control and I want to credit it. The problem is purely that the *stated
  reason* for the line is wrong, and the test that backs it uses only
  `javascript://` — the one spelling where the property holds. A maintainer who
  reads the comment could conclude the hostname check makes widening safe and
  relax the test on that basis.
- **Recommendation:** replace the claim with what is true:
  > This line is a backstop against a NON-special scheme in its opaque-path
  > spelling only. It does NOT catch `javascript://evil.com/%0aalert(1)`, which
  > parses with hostname `evil.com`. The thing that actually makes widening
  > `SAFE_SCHEMES` fail closed is `testHostGuardIsAFailClosedBackstop()`, which
  > goes red for any non-special scheme added to the set. Do not weaken that
  > test on the strength of this line.

  Add `javascript://evil.com/%0aalert(1)` as an explicit fixture, so the
  authority-bearing spelling is pinned as rejected-by-scheme.

### [INFO] F-7 — `SetTestGraphQLClient` remains exported in the production binary

The leg documented this honestly and the read-path check now makes it
non-load-bearing for the URL property, which I confirm. Noting only that the
brief's three legs for Claim 2 omit it: repointing the GraphQL endpoint requires
writing Go, not sending data, so it is not attacker-reachable, but it is a
fourth leg of the same argument. The `testing.TB` parameter is a reasonable
signal short of the package move.

### [INFO] F-8 — Positive observations

- Both allow-list justifications in the scanner check out under measurement.
  `GITHUB_REPO_RE` is `^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$` — anchored, no `:`,
  no `%`, exactly one `/`, so `https://github.com/${remoteId}` cannot leave the
  github.com origin even with `../..`. The `a.href = url` entry really is a
  locally minted `createObjectURL` blob.
- `validateURLField`'s control-character pre-check runs *before* `url.Parse`,
  with a comment explaining why the guarantee must not depend on `net/url`'s
  incidental behaviour. That is the right order and the right reason.
- Rejecting rather than dropping at the write boundary, and dropping rather than
  erroring on the read path, is the correct asymmetry: a bad write should be
  told about; a bad read should not take down the whole list.
- Degrade-to-visible-text rather than drop, on both guarded bindings, is the
  right UX call for a security control and is pinned by tests.
- The `run-tests.mjs` discovery rewrite closes a genuine silent-skip class, and
  its source↔output cross-check plus anti-vacuity guard are better than what it
  replaced.
- The shared fixture file is the right shape for this problem, and my
  independent reproduction of all 42 rows says the *measurements* in this round
  are trustworthy. Where I disagree with the leg, it is with inferences layered
  on top of correct measurements — never with a measurement.

---

## R-1 — "Is there a formulation that makes the bad state unrepresentable?"

This is the question the brief most wanted answered, so I want to answer it
precisely, including where the obvious answer fails.

**The obvious answer does not work.** The instinct is a branded type —
`type SafeUrl = string & { readonly __safe: unique symbol }` — and typing the
binding so only a `SafeUrl` can be interpolated. That fails for Lit, because
`tsc` does not type-check the interpolations inside a `html\`…\`` tagged
template against the attribute they land in. `html\`<a href=${anyString}>\``
compiles. A branded type applied at the *sink* buys nothing without
`ts-lit-plugin`/`lit-analyzer` in the build, and even then it checks properties,
not attributes. Answering the brief's question as framed would produce a control
that looks structural and is not — which is the exact failure mode this project
keeps hitting.

**The formulation that does work is at the decode boundary, not the sink.**
Make the unsafe string not *exist* in the component layer:

1. `web/src/gen/grpc-client.ts` already has a single decode chokepoint. Every
   task the UI ever sees passes through `toTask()` at line 436 — including the
   watch stream, via `toTaskEvent` → `toTask` — and every pull request through
   `toCodeContext`. [MEASURED: 4 call sites, all routed through `toTask`.]
2. Sanitize there, once, and change the type so the raw value is gone:
   ```ts
   // util/safe-url.ts
   declare const SAFE: unique symbol;
   export type SafeUrl = string & { readonly [SAFE]: true };
   export function asSafeUrl(raw: string | null | undefined): SafeUrl | undefined {
     return safeHref(raw) as SafeUrl | undefined;
   }

   // gen/grpc-client.ts (or a hand-written adapter over it)
   remoteUrl: asSafeUrl(optionalString(record.remoteUrl)),
   remoteUrlRaw: optionalString(record.remoteUrl),   // display-only, never an href
   ```
   ```ts
   // gen/types.ts
   interface Task    { remoteUrl?: SafeUrl; remoteUrlRaw?: string; }
   interface PullRequest { url?: SafeUrl; urlRaw?: string; }
   ```
3. Now `renderPrLink(pr.url, …)` receives a `SafeUrl | undefined`. A component
   *cannot* put an unsafe URL in an href because it never holds one — there is
   no `string` in scope that came from the server as a URL. The `…Raw` field
   carries the degrade-to-text value and is typed `string`, so it is obviously
   not an href.

This is enforced by `tsc` at the *read* site (`task.remoteUrl` has a type), which
`tsc` does check, rather than at the *interpolation* site, which it does not.
That is the whole trick.

**What it does not cover, and why the scanner still earns its place.** It makes
the *data* safe by construction, but it cannot stop someone constructing a URL
locally and passing it to `window.open`, `el.setAttribute`, or `srcdoc`. Those
are the shapes in F-2. So the honest architecture is:

- **Unrepresentable** for server-supplied URLs → the decode-boundary brand.
- **Detected** for locally-constructed URLs and imperative sinks → the scanner,
  with the F-2 rules added.

The `gen/` directory is generated, so step 2 needs either a codegen change or a
thin hand-written adapter module that the components import instead of `gen/`.
I would put the adapter in front, since it is reversible and does not fight the
generator.

*(Labelled per the scope fence: this is architecture, which is the review leg's
axis. I am offering it because the brief asked for it directly; treat the
architectural trade-offs as an impression and the measured facts inside it —
the single decode chokepoint, and `tsc` not checking lit interpolations — as
findings.)*

---

## Predictions and misses

Recorded because the brief says the misses are usually the finding.

| prediction | outcome |
|---|---|
| The `hostname === ''` backstop's justification would be false for the `scheme://host` spelling | **HIT** → F-6 |
| The scanner would miss `srcdoc` and `formaction` | **HIT** → F-2 |
| The fixture file would contain at least one wrong expected result (the EM told me to assume one) | **MISS.** All 42 rows reproduced exactly, both columns. This is the single most reassuring result in the audit and I am recording it as a miss rather than burying it: the leg's *measurements* are accurate. Every disagreement I have is with an inference sitting on top of a correct measurement. |
| `Object.assign(el, {href})` would be a hypothetical shape | **MISS.** It is already used 3× in this tree. That miss is what moved F-2 from Low to Medium. |
| The server-permissive divergence (`:99999`) would hold the surprise, as the brief primed me to expect | **MISS.** It is the most inert of the nine. I spent real time there because the brief pointed at it. The surprise was in the client-permissive direction (F-4), which the brief framed as the boring one. |
| Legacy `pr["url"]` would have a second unguarded path to the DOM | **MISS.** There is exactly one path. Claim 3 is green. |

---

## Where this brief is wrong

Required deliverable. Numbered, measured where possible.

1. **§31/§33 — the fixture file's path is wrong.** The brief says
   `web/testdata/url-scheme-cases.json`. It is `testdata/url-scheme-cases.json`,
   at the **repo root**; `web/testdata/` does not exist. Both halves of the
   differential resolve it by walking up to the repo root, so anyone who
   scripted the brief's path would have got ENOENT. [MEASURED]

2. **§68 — "re-scoped `viaSafeHref` from file-scoped to binding-scoped" is not
   what the code does.** It is scoped to the nearest enclosing *top-level*
   block. For any binding inside a class — the normal case for a Lit component —
   that is the entire class, and a sibling method's `safeHref` call satisfies an
   unguarded binding. The brief relays the leg's label without qualification.
   [MEASURED, with control] → F-3(b).

3. **§46-48 is a leading question that supplies its own answer.** "The one that
   most interests me is the direction where the *server* accepts and the client
   rejects… a policy written down as symmetric but measured asymmetric is where
   I would expect a surprise to live." Measured, that direction is the *least*
   interesting of the nine: `https://example.com:99999/x` is unparseable at the
   sink (`a.protocol === ':'`) and inert even in an unguarded href. The question
   I could actually answer, and did, is *which* direction carries the surprise —
   and it is the client-permissive one, via base-relative resolution (F-4).

4. **§40-43 — the brief inherits a base-independence assumption from the fixture
   notes, and this is the second instance of your established "fixture plus
   wrong expected result" failure mode.** The brief lists `http:/example.com`
   and `http:example.com` as divergences resolving to an attacker-chosen host,
   quoting the fixture note "WHATWG normalises to `http://example.com/`". On a
   dashboard served over **http**, both resolve to the **dashboard's own
   origin**, not to `example.com` — and `https:/example.com` inverts it. The
   supplied input is right; the stated result is right only under one of the two
   deployment schemes. [MEASURED, under both bases, with a control] → F-4.

5. **Shared block, gate table — the `go test` failure is named wrong.** The
   table says `TestWatchTasks_NoInitial`. I measured
   `--- FAIL: TestWatchTasks_ClosedEvent`. Same family, different member. The
   block's own rule — "read failing test NAMES, never counts" — is what caught
   it, applied to the block's own table. [MEASURED]

6. **§66-67 — the fixture counts are right but the rule count is incomplete.**
   "added two rules plus 7 positive and 4 negative fixtures": I measure exactly
   7 positive and 4 negative added, and 2 rules added. But rule 1 was also
   *widened* in the same diff (`xlink:href` added to the existing pattern), so
   three rule-level changes shipped, not two. [MEASURED]

7. **§54 — Claim 2's three legs are missing a fourth that the leg's own code
   comment raises.** "no webhook receiver, no configurable API base URL,
   `issue.URL` genuinely GitHub-generated" — all three confirmed, but
   `SetTestGraphQLClient` is exported from a non-`_test.go` file and is
   therefore in the production binary. It is not attacker-reachable (it takes
   code, not data), and the leg says so in the diff. The brief's enumeration
   should include it, because a reader checking three legs and finding them
   green will conclude the argument is complete.

8. **§60 — the question about `pr["url"]` is the right question asked about the
   wrong field.** "Is `safeHref` genuinely a sufficient control for legacy rows,
   on every path a legacy `pr["url"]` can reach the DOM?" Answer: yes, one path,
   fully guarded. But the *symmetric* question about `remote_url` — whose
   read-path control this same diff added — has a real gap, because the raw
   value is still shipped in `remote_data` and its twin `html_url` was never
   validated at all (F-1). The brief asks the safe version of the question and
   not the unsafe one.

9. **§72-73 — "is there a formulation that makes the bad state unrepresentable
   rather than detected?" carries a false premise about where the type would
   go.** The framing implies typing the sink. That cannot work in Lit, because
   `tsc` does not type-check tagged-template interpolations against the
   attribute they land in — a branded `SafeUrl` on an `href=${…}` binding
   compiles happily with a plain `string`. A leg that implemented the question
   as framed would ship a control that looks structural and is inert. The
   formulation that works puts the brand at the decode boundary instead (R-1).

10. **§58 — line range slightly off.** `pr["url"]` is at `convert.go:361`; the
    loop runs 358-364, not 358-363. Trivial, listed for completeness.

11. **Covering message — the report path was relative and does not resolve.**
    The covering message said "write your report to `reports/audit-xss-r2.md`".
    There is no `reports/` directory under the repo root [MEASURED]. The brief
    body (§5-6) had the correct absolute path and that is what I used, so this
    cost nothing here. Recording it because it is the *inverse* of the failure
    mode the covering message was written to avoid: the tree path was correctly
    left unstated and made checkable via the SHA, and in the same message the
    report path was stated in a form that is only valid in the sender's
    container. Self-reported by the EM mid-round; I confirm the diagnosis and
    that my report was unaffected.

12. **Shared block §31, method rather than fact.** The gate table is tagged
    `[REPORTED — dev-xss-r2]` and every row of it reproduced in my tree. That is
    not an error and I am noting it deliberately: the tag was honest, the
    re-measurement was cheap, and the relay turned out accurate. Three of the
    six rows would have been indistinguishable from a broken run without the
    message-level matching the block insisted on (`go vet` exit 1 for the right
    reason; `go build` exit **0** for the wrong reason in my first attempt).

---

## Housekeeping

- **Dirty cells left: 0.** I created two untracked Go probe files
  (`internal/server/zz_audit_probe_test.go`, `zz_audit_probe2_test.go`) and
  removed both. `git diff --name-only` and `git diff --cached --name-only` were
  **empty at all times** — no tracked file was ever modified, so no snapshot
  restore was needed. Final `git status --porcelain` is empty and
  `git rev-parse HEAD` is still `0bc9b72`. [MEASURED]
- Build artifacts created and left in place, all gitignored and all required for
  `go build` to succeed at all: `web/node_modules/`, `web/dist/`,
  `web/.tmp-test/`. `web/dist` is task #100 and out of scope.
- Harnesses live outside the repo at `/tmp/audit/` (`ts-side.mjs`,
  `base-sensitivity.mjs`, `render-enumerate.mjs`, `scanner-recall.mjs`,
  `enclosing-scope.mjs`, `backstop.mjs`, plus `go-side.json` and `matrix.json`).
  Every one of them carries a positive control that runs before any result is
  recorded.
- Nothing pushed. No production code modified.
