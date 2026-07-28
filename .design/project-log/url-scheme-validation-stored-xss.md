# URL Scheme Validation — Stored `javascript:` XSS In Task URL Fields

Date: 2026-07-28
Branch: `url-scheme-validation`
Base: `7a0f220dbd9332cb8db62138c841777432b4eda4`
Commits: `4187910`, `80cab87`, `f0ab53f`
Verdict: `FIXED`

## Scope

A caller holding only `task:write` could store a URL with an arbitrary scheme
(`javascript:`, `data:`, `vbscript:`, ...) in a task URL field. It was persisted
verbatim, returned verbatim, and interpolated directly into an `href` in the
dashboard. IAP does not cover this: the attacker and the victim are both already
inside that boundary, and the payload travels through content the attacker is
entitled to write.

## What was established, and what was not

**Established by measurement at this base:** attacker-controlled text reaches an
`href` attribute with no validation in Go, no validation in TypeScript, and no
sanitizer in Lit (`setSanitizer` has zero occurrences in `web/src`).

**Not established, and deliberately not claimed:** that `javascript:` executes on
click in a real browser. Both anchors carry `target="_blank"`, and engines block
`javascript:` navigation into a new browsing context. No real browser engine was
available; a JSDOM navigation test would have measured the harness, not the
browser. The defensible harm is an arbitrary attacker-chosen URL rendered under
first-party dashboard chrome. `target="_blank"` was an incidental mitigation that
nothing pinned, so it is now pinned.

## Root cause

The proto declares `(buf.validate.field).string.uri = true` on four fields and
**nothing ever invokes protovalidate**: it appears once, as a blank import in
generated code; the runtime validator module is not in `go.mod`/`go.sum`; and
`Validate(` has zero occurrences repo-wide. The constraint was decorative.

Wiring protovalidate up would not have been sufficient. `javascript:alert(1)` is
a well-formed URI under RFC 3986, so `uri = true` accepts it. The scheme has to be
constrained explicitly.

## Fix

**Server.** `validateURLField` in `internal/server/urlvalidate.go` allow-lists
`{http, https}` and rejects everything else with `InvalidArgument`. An allow-list,
not a denylist: the set of script-bearing schemes is open-ended, so enumerating
the dangerous ones fails open on whatever is missed.

It is called from **service method bodies, not a gRPC interceptor**. Of the four
production registration sites, `internal/cli/connect.go:302` (the CLI
pass-through) installs **no interceptors** while the other three install auth
interceptors. All four construct the same `FarmTableService`, so a check in the
method body is reached by all of them; an interceptor would have covered three.

Three client-controlled ingress paths, all covered:

1. `server.go:643` — `add_pull_requests[].url`
2. `server.go:660` — `remote_url` (into an untyped `RemoteData` map)
3. `export_import.go` `importedTask` — `PullRequests`/`RemoteData` copied verbatim
   out of caller-uploaded JSON, which bypassed a check placed only in `UpdateTask`

Not covered, deliberately: platform-sync writes (values originate from the
upstream GitHub API, not a client request) and `Collection.remote_data` (reaches
no `href`).

**Frontend.** One shared helper `web/src/util/safe-url.ts`, since a guard that is
a copy of another guard is this project's most-repeated defect. The two previously
unguarded bindings route through it; rejected URLs degrade to inert visible text
rather than disappearing. This is defence in depth for rows written before the
server check existed.

Two decisions taken on measurement:

- **No `mailto:`.** The server rejects it, so a client rendering it would be dead
  code. Client and server agree exactly on `{http, https}`.
- **No base argument to `new URL()`.** With one, `//evil.com/x` resolves to an
  *accepted* `https://evil.com/x`, laundering an attacker-chosen origin into an
  allowed scheme. Without it, that input throws and is rejected, matching the
  server.

**Chokepoint.** `web/src/util/url-binding-scan.test.ts` fails on any unapproved
dynamic `href`/`src` binding or `.href`/`.src` assignment, tree-wide. Allow-list
entries require a written justification, are checked to actually import `safeHref`
when they claim to, and fail when stale. Ships with 7 positive and 5 negative
fixtures, because a detection pattern with no fixture proving it fires is the same
defect it is meant to catch.

## Sweep result (denominator)

51 non-test `.ts` files scanned in `web/src`; **4** URL-reaching bindings found;
4 inspected; 4 now approved. Two were unguarded and are fixed; two were already
safe by construction and are allow-listed with reasons. Independently corroborated
by a separate search agent that arrived at the same 4.

Clean results, each with a positive control: zero `src=` bindings; zero
`window.open`/`location.assign`/`<iframe>`/`innerHTML`/`unsafeSVG`; markdown is
sanitized by DOMPurify's sealed default URI allow-list; and a URL-typed custom
field cannot reach an `href` because **nothing renders custom fields at all**.

`Attachment.url` is a **dead proto field** — no write path, no read path, no
renderer anywhere outside generated code. There is no write boundary to fix.

## Notable findings for future rounds

- **A green happy-path suite proves nothing here.** With validation entirely
  disabled, every "accepts valid URLs" test stayed green. The original defect had
  exactly that shape: a declared constraint that nothing invoked, with a green
  suite. Assertions must include the rejection case.
- **Go and browser URL parsers disagree.** `net/url` *errors* on
  `java\tscript:alert(1)`; the WHATWG parser strips the tab and yields
  `javascript:`. Only an allow-list on the *parsed* scheme makes the two agree on
  the outcome.
- **`net/url` already lowercases schemes**, so `JaVaScRiPt:` parses as
  `javascript:`. Case-folding is still applied explicitly so the guarantee does not
  depend on that detail.
- **`markdown.ts` ships in the production tree but `markdown.test.ts` does not** —
  it exists only on `markdown-sanitize`, which has not merged. The markdown guard
  is absent from the deployed tree entirely. Routed separately.
