# URL Scheme Validation — Security Audit (audit-xss-r1)

Date: 2026-07-28
Branch: `url-scheme-validation`
Commit audited: `d4c4e6b629ade1d0725bc303c0acf962838f03c9`
Base: `7a0f220dbd9332cb8db62138c841777432b4eda4`
Axis: production effect — does this close the hole for a real attacker, and what remains open?
Verdict: `APPROVE`

Full report: `reports/audit-xss-r1.md` (scratchpad).

## Headline

The change is correct and should merge. It closes the `javascript:`-class payload
completely and closes every client-controlled write ingress completely. It does
**not** close the harm it defends against.

**At `7a0f220` an attacker holding `task:write` could render an arbitrary
attacker-chosen URL under first-party dashboard chrome. At `d4c4e6b` they can
still do exactly that, by a different route:** the task description and comment
body are rendered through `unsafeHTML(renderMarkdown(...))`, which emits a real
`<a href>` under DOMPurify's default scheme policy — strictly wider than the
`{http, https}` allow-list this change installs — with no `target="_blank"` and
no `rel="noopener"`, and which also permits `<form action=>` and `<img src=>`.

## Measurements that settle open questions

**`javascript:` execution, settled in real Chromium** (`/usr/bin/chromium` is
installed in the dev environment; the change's own report states no engine was
available, which was not correct). Real anchors, real clicks:

| shape | result |
|---|---|
| no target / `target="_self"` | **EXECUTES** (positive control) |
| `target="_blank"`, with or without `rel="noopener"` | **DOES NOT EXECUTE** |
| named target | does not execute |

Confirmed with the popup blocker both on and off, so the block is the HTML
navigate algorithm, not the popup blocker. Chromium only; Firefox and WebKit
untested. Conclusion: the `target="_blank"` pin added by this change is genuinely
load-bearing — it is the difference between a phishing affordance and script
execution in the dashboard origin.

`data:`, `vbscript:` and `blob:` under `target="_blank"` also did not execute,
but without an independent control that such a popup could have reported back at
all, so that result is inferred rather than established.

**Go `net/url` vs WHATWG parser differential.** 80-input corpus run through the
real `validateURLField` and the real compiled `safeHref` inside Chromium, plus
live `<a>` resolution, under `file://` and `http://` bases:

- **Server-accepts + client-accepts + resolves to a dangerous scheme: 0 / 80.**
  No exploitable intersection.
- Positive control: 24 inputs that Blink resolves to `javascript:`/`data:`/`blob:`
  (including `java<TAB>script:`, `jAv<TAB>AsCrIpT:`, `javascript://%0aalert(1)`)
  — `safeHref` rejected **24 / 24**.
- 12 / 80 are rejected by the server but accepted by `safeHref`. All resolve to
  http(s), so none is a script path, but this disproves the "the two lists are
  identical, divergence is unreachable" claim in `web/src/util/safe-url.ts`.

Why the negative is structural rather than lucky: `validateURLField` rejects every
rune `<= 0x20` and `0x7f` *before* parsing, which removes exactly the inputs on
which the two tokenisers can disagree. The control-character pre-check is the
load-bearing part of the server fix.

## Findings

| # | sev | finding |
|---|---|---|
| F1 | HIGH | The **live** GitHub path is `GitHubPassThroughStore`, a read-through that synthesises `remote_url` from the GraphQL response on **every read** and never writes. No write-boundary check can cover it, and `UpdateTask` there discards `RemoteData` entirely. So `safeHref()` is the **sole** control on that path, not defence in depth. The exclusion rationale in the design doc describes `platform/github/github.go` (`buildRemoteData`), which has **no production caller**. Not attacker-reachable today — no webhook receiver exists, no GHE base-URL override is configurable, no URL-extraction regex exists anywhere — but the assumption is narrower than stated and written down nowhere. Fix: validate on the way out in `convert.go`, dropping rather than erroring. |
| F2 | HIGH | The markdown/comment route above. Measured over 21 cases with the real `marked` + DOMPurify. `javascript:`/`data:`/`blob:`/`vbscript:` are stripped, but `mailto:`/`tel:`/`ftp:`/`sms:`/`cid:`/`xmpp:` survive, as do `<img src>` and a complete `<form action="https://attacker/">`. Same `task:write` precondition as the fixed vulnerability. Owned by another track; no fix opened here. |
| F3 | MEDIUM | `urlBearingRemoteDataKeys` is a closed enumeration over an open map, coupled to `convert.go` only by a comment. Measured: the constant is referenced **nowhere outside its own file**. `html_url` is already written into that map by the GitHub adapter and needs only a `convert.go` read to become an unguarded import ingress. Fails open on the next change. A source-reading Go test would close it and would actually run, since `make test` is `go test ./...`. |
| F4 | MEDIUM | `url-binding-scan` has enumerable evasions: quoted `href="${...}"` (already the idiomatic style in ~36 places here), attribute-name case, line splits, `action`/`srcdoc`/`poster`/`srcset`, `setAttribute`, `Object.assign` (already used in three components), `window.open`, `unsafeHTML` (i.e. F2), anything outside `web/src/**/*.ts`, and an allow-list keyed on file+line-text with no line number. |
| F5 | LOW | Server and client **decisions** are not equivalent (12/80), contradicting the invariant asserted in `safe-url.ts`. Latent trap: `https://evil.com\@good.com/` — Go reads host `good.com`, Blink navigates to `evil.com`. |
| F6 | LOW | `safeHref` parses with no base but returns the raw string, so for same-scheme opaque forms (`http:evil.com`) it judges a URL the DOM will not resolve to. Diverges in the safe direction; the no-base choice is right; the invariant is just undocumented and false. |
| F7 | INFO | GitHub clients have no `CheckRedirect` and `oauth2.Transport` re-injects `Authorization` per hop, so a cross-host redirect would carry the token. TLS verification is intact everywhere (zero `InsecureSkipVerify` repo-wide). Surfaced, not chased. |

## Ingress denominator

The change's report says 3 client-controlled ingress paths, all guarded. Verified
and agreed for that question. Working sink-first instead — start at the rendered
`href` sinks and walk backwards to every writer — the denominator is **4**:
`server.go:641`, `server.go:663`, `export_import.go:722` (all guarded), and the
live GitHub passthrough writer (unguarded, F1).

Positively excluded, each with a control: `github.go:257` (no production caller),
the beads adapter (writes no URL key), `CreateTask`/`InsertTasksAfter`/collection
writes (no URL field exists in those messages), `Collection.remote_data` (reaches
no href — its only two consumers read a `writable` boolean), and `Attachment.url`
(dead field: appears only in the two proto lines, no ent schema, no renderer).

What this method misses: sinks that do not exist yet; writers reaching the ent
field by an untraced path (raw SQL, migrations, ent hooks); values reaching an
anchor by a mechanism other than an `href=` binding — which is exactly what F2 is,
and it was caught only by enumerating all DOM sinks rather than grepping for
`href`; and non-dashboard renderers (`internal/cli/output.go:46` emits
`remote_url`; MCP tool output carries task payloads to agents).

## Effect of the surrounding trust boundary on severity

- **Nothing runs `npm test`** (confirmed: `make test` is `go test ./...`; zero hits
  for `npm test` in Makefile/yml/sh). This is another track's fix and is not a
  defect in this change, but it **raises F1 to HIGH**: on the passthrough path
  `safeHref` is the only control and its regression test never runs automatically.
  It also reduces the scanner to documentation, which defeats the change's own
  "chokepoint, not checklist" design argument. It does not affect F2.
- **No CSP** raises F2: a `form-action`/`img-src`/`connect-src` policy would blunt
  all three of its sub-findings, and there is none.
- **`FARMTABLE_OPEN_ACCESS` / unset `FARMTABLE_TOKEN`** collapses the `task:write`
  precondition and so raises blast radius for both F1 and F2.

## Done well

Allow-list over denylist with correct reasoning about `uri = true` not helping.
The control-character pre-check, which is what makes the allow-list sound.
Method-body placement over a gRPC interceptor (the CLI pass-through registers no
interceptors, so an interceptor would have covered three of four paths). No base
argument to `new URL()`. Degrade-don't-drop rendering, keeping the evidence
visible. The `target="_blank"` pin, now quantified. And the change author's
green-control observation — that the accept-path test stayed green with validation
entirely disabled — is the most transferable finding in their report.

## Residuals

R1 markdown route open (HIGH). R2 passthrough read path (HIGH). R3 no migration
for poisoned rows (MEDIUM) — warranted as a one-off **read-only audit query**, not
a schema migration, and it must examine four things, not the obvious two:
`remote_data->>'remote_url'`, `pull_requests[*].url`, **any** string in
`remote_data` with a non-http(s) scheme, and **`description`/`comment.body` for
embedded `<a href=`/`<form action=`/`<img src=`**, which is where a payload is now
most likely to be. R4 key-list drift (MEDIUM). R5 frontend pins not in CI
(MEDIUM). R6/R7 as above (LOW). "Execution untested" is now **resolved**.
