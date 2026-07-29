# Security Audit — url-scheme-validation-r2 @ 6805daa (round r3)

**Auditor:** security-auditor leg
**Tree HEAD:** `6805daa32aa67992bb26a4e66bd9d102bbf6fa53` — **[MEASURED]** `git rev-parse HEAD`, matches the brief.
**Review range:** `0bc9b72..6805daa`, 6 commits, 14 files, +2098 / −173 — **[MEASURED]** `git diff --stat`, matches.

---

## §0 — OPEN PASS (written before reading the item list)

### 0.0 Contamination disclosure

I did **not** read the item list in `audit-xss-r3.md` before doing this pass or before
writing this section. I have, however, been contaminated in one specific and
unavoidable way: **the dispatch message that delivered the brief named item A2 in
prose** — *"the concrete chain from 'a contributor defeats safeHref' to 'somebody is
told', with the break named."* I read that before I read the baseline block, because
it was the message body.

So §0 is not a clean-room result for that one question. I am flagging every finding
below with whether the dispatch prose could have steered me to it:

- **0.1 was steered.** I would very likely have found it anyway — "is this guard
  enforced?" is the first question a test-shaped security control invites — but I
  cannot prove that counterfactual, so score it as steered.
- **0.2 through 0.6 were not steered.** Nothing in the dispatch message points at
  the collection path, the read-path PR asymmetry, or the `structpb` swallow.

I read `safe-url.ts`, `urlvalidate.go`, `convert.go`, the three `href` bindings and
`run-tests.mjs` before writing this. I have not read the fix leg's report
(`dev-xss-r3.md`) at all, at any point.

### 0.1 The guard this diff adds is executed by nothing in the repository — [HIGH]

*Attribution: OPEN PASS (steered — see 0.0). Overlaps item A2.*

Not "there is no CI" (fenced, known). The stronger and separately-fixable fact:
**there is no target, script, hook, or container stage anywhere in this repo that
invokes `npm test`.** `npm test` is the sole executor of `url-binding-scan.test.ts`
and `safe-url.test.ts` — the entire client-side half of this branch's work.

**[MEASURED]** — `git grep` across the whole tree for `npm test` / `npm run test` /
`run-tests.mjs`. Every hit is either `web/package.json:9` (the definition itself),
a `.design/project-log/*` prose mention, or a doc comment. **Zero invocations.**

The enumerated release/verification surface, all **[MEASURED]** by reading the files:

| entry point | what it runs | runs the guard? |
|---|---|---|
| `Makefile: test` | `go test ./...` | **no** |
| `Makefile: build` | `buf generate` + `go build ./...` | **no** |
| `Makefile: lint` | `buf lint proto` + `go vet ./...` | **no** |
| `Makefile: web` | `cd web && npm ci && npm run build` | **no** |
| `Makefile: dashboard` | `make web` + `go build` + run | **no** |
| `Dockerfile` (ships `/ft`) | `npm ci` → `npm run build` → `go build` | **no** |
| `Dockerfile.server` (ships `/farmtable-server`) | `npm ci` → `npm run build` → `go build` | **no** |
| `.github/` | `ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md` only — no `workflows/` | **no** |
| `.git/hooks/` | empty but for `*.sample`; `core.hooksPath` unset | **no** |
| pre-commit / husky / lefthook | none present | **no** |
| `CLAUDE.md` (agent-facing dev commands) | `go test ./...`, `go build ./...` | **no** |

**Name the break.** It is *not* at "CI does not exist." It is one layer lower, at
**`make test`**. `make test` is Go-only. So:

> Even if CI were added tomorrow running the obvious `make lint && make test && make build`,
> **this diff's guard would still never execute.** Fixing the tracked CI item does
> not fix this. That is why it is in scope and why it is not a re-derivation.

The same gap swallows `CLAUDE.md`: the repo's own agent instructions tell a dev agent
to run `go build ./...` and `go test ./...`. An agent that follows the project's
documented workflow exactly is *guaranteed* not to run the guard.

**Proof of concept — the chain, end to end, measured.** Four ways to defeat the
control, each applied to the real tree and reverted by `cp` from a `/tmp` snapshot:

| mutant | what it does | `go build` | `go test ./...` / `make test` | `npm run build` | `npm test` |
|---|---|---|---|---|---|
| **M1** strip `safeHref` at the PR-link binding (`ft-inspector-code.ts`) | live `javascript:` href for legacy PR rows | 0 | **0 (green)** | **0 (green)** | **1 (red)** |
| **M2** add `'javascript:'` to `SAFE_SCHEMES` | guard allow-lists script scheme | — | — | **0 (green)** | **1 (red)** |
| **M3** new component file with a bare `href=${this.linkUrl}` | brand-new unguarded sink | — | — | **0 (green)** | **1 (red)** |
| **M4b** gut `safeHref` to `return raw`, call sites untouched | guard is a no-op | — | — | **0 (green)** | **1 (red)** |

All **[MEASURED]** this session. M1's Go columns measured explicitly (`make test`
exit 0, `go build` exit 0) rather than inferred, even though the mutant is a `.ts`
file, because "obviously Go can't see it" is exactly the kind of assumption this
project's brief history says to stop making.

**Read the table as a single sentence:** every arm that detects the defect is
`npm test`; `npm test` is invoked by nothing; therefore **each of these four
defects reaches a release image green.** The Docker stages run `npm run build`,
which was measured green under all four.

**Impact.** Stored XSS on the dashboard origin. The dashboard serves authenticated
task data and holds a session cookie (`gorilla/sessions` is in the dependency
graph); CSP is absent on that origin (fenced, but it is the reason this degrades
to full session compromise rather than a contained popup). The value is
attacker-controllable by anyone who can write a task's PR URL or `remote_url`, or
who can hand a victim a collection-import document.

**Recommendation.** Two lines, no new infrastructure, closes the *named* break
independently of the CI item:

```makefile
# Makefile
.PHONY: test test-go test-web

test: test-go test-web

test-go:
	go test ./...

test-web:
	cd web && npm test
```

and make the shipped artefact depend on it, so the guard cannot be bypassed by
building the image:

```dockerfile
# Dockerfile / Dockerfile.server, frontend stage
RUN npm ci
RUN npm test          # <-- add: the URL-binding guard runs here or nowhere
RUN npm run build
```

Also add `cd web && npm test` to the `CLAUDE.md` "Development commands" block, since
that is the only instruction file agents on this repo actually follow.

### 0.2 `collectionToProto` does not sanitize collection `remote_data` — [LOW]

*Attribution: OPEN PASS. Not steered.*

`internal/server/convert.go:530` — **[MEASURED]**, read directly:

```go
if c.RemoteData != nil {
    pc.RemoteData, _ = structpb.NewStruct(c.RemoteData)   // unsanitized
}
```

Compare the task path one function away, which this diff *did* fix
(`convert.go:358`): `structpb.NewStruct(sanitizeRemoteData(t.RemoteData))`.

The diff's own justification for `sanitizeRemoteData` is that an untyped map
serialised wholesale is a URL carrier. That argument is not task-specific. The
collection map is:

- **caller-controlled** — `export_import.go:332` copies `doc.Collection.RemoteData`
  verbatim out of an uploaded JSON document;
- **never validated** — `validateImportedTaskURLs` covers tasks only; there is no
  collection equivalent (**[MEASURED]**, grep for all validator call sites);
- **shipped to the browser** and read there — `web/src/components/ft-app.ts:255`
  and `web/src/capabilities.ts:98` both read `collection.remoteData`.

**Why LOW and not HIGH:** I enumerated every `href` binding in `web/src` rather than
grepping for the ones I expected (three exist, §0.4), and **none of them reads
`collection.remoteData`**. Both current readers consume a `writable` capability
flag, not a URL. So there is no sink today — this is an unguarded carrier waiting
for one, not a live vulnerability. It is a **[MEASURED]** negative on the sink side.

**Recommendation.** Make the two paths symmetric, so the next person to render a
collection field inherits the guard instead of having to remember it:

```go
if c.RemoteData != nil {
    pc.RemoteData, _ = structpb.NewStruct(sanitizeRemoteData(c.RemoteData))
}
```

and add the collection map to `validateImportedTaskURLs`' sibling at the import
boundary. The predicate is already generic over keys; nothing new is needed.

### 0.3 `PullRequest.url` is validated on write but not on read — [MEDIUM, and it is what makes 0.1 bite]

*Attribution: OPEN PASS. Not steered.*

`taskToProto` re-validates `remote_url` on the way out (`convert.go:345`) but copies
pull-request URLs through untouched (`convert.go:375-380`) — **[MEASURED]**, read.
`safe-url.ts` states this outright and correctly: for PR URLs written before
`urlvalidate.go` existed, `safeHref` is *the only control*, and legacy rows are not
migrated.

I am not filing the asymmetry itself as the defect — it is documented, deliberate,
and the write boundary is genuinely covered (`server.go:644` for `UpdateTask`,
`export_import.go:722` for import). I am filing the **composition**:

> The one field whose sole surviving control is client-side is guarded by a check
> that §0.1 measures as running nowhere.

M1 is precisely this exploit path: strip the guard on the PR binding, and legacy
rows fire. Server-side, nothing objects; `make test` is green.

**Recommendation.** Fixing 0.1 is the primary mitigation. Defence in depth, cheap
and symmetric with the `remote_url` treatment immediately above it:

```go
for _, pr := range t.PullRequests {
    if pr.URL != "" {
        if err := validateURLField("pull_request.url", pr.URL); err != nil {
            continue   // or emit with URL cleared, matching the remote_url degradation
        }
    }
    pt.CodeContext.PullRequests = append(...)
}
```

Note the degradation choice matters and the diff already learned this lesson once
(see the corrected comment at `convert.go:336-344`): dropping the PR makes the row
vanish, which is harsher than `safeHref`'s visible-inert-span. Prefer clearing the
URL and keeping the row.

### 0.4 Enumeration of URL sinks in `web/src` — green control, reported at equal weight

*Attribution: OPEN PASS. Not steered.*

Per §3 of the baseline block ("enumerate what survived; do not grep for what you
expected"), I swept `web/src` for sinks by category rather than by expected name.
**[MEASURED]**, all 58 files under `web/src`:

| sink class | hits (non-test) | status |
|---|---|---|
| `href=` bindings | 3 | all safe — see below |
| `src=`, `action=`, `formaction=`, `xlink:href` | 0 | — |
| `window.open`, `location.assign/replace`, `location.href =` | 0 | 6 hits are all `new URL(window.location.href)` **reads** for query-param routing |
| `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` | 0 | — |
| `eval`, `Function(` | 0 | — |
| `unsafeHTML` | 2 | both `renderMarkdown()` → `DOMPurify.sanitize(marked.parse(...))`; **fenced** (#195) |

The three `href` bindings:

1. `ft-inspector-code.ts:34` — `renderPrLink()`, guarded by `safeHref`, degrades to
   an inert `<span class="pr-link-unsafe">`.
2. `ft-inspector-meta.ts:27` — `renderExternalSourceLink()`, guarded by `safeHref`,
   degrades to an inert span.
3. `ft-toolbar.ts:465` — **not** `safeHref`-guarded, and correctly so: the URL is a
   template literal `` `https://github.com/${collection.remoteId}` `` where
   `remoteId` is gated by `GITHUB_REPO_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/`.
   The scheme is a literal and the anchored character class admits no `:`, `/`
   beyond the single separator, `@`, `?`, `#`, or whitespace. **I could not construct
   an escape**, including `..%2f`-style traversal (`%` is not in the class) or
   `a/b@evil.com` (`@` is not in the class). Recording this as a green control.

All three carry `target="_blank" rel="noopener"` — reverse-tabnabbing is closed.

**No fourth carrier found.** This is a **count**, not a lower bound, for the sink
classes listed: the sweep was over the full file enumeration, not a keyword guess.

### 0.5 `structpb.NewStruct`'s error is discarded, and on the GitHub passthrough path it always fires — [INFO, but it makes the diff's headline control inert on its own motivating path]

*Attribution: OPEN PASS. Not steered.*

`convert.go:358` discards the error with `_`. I measured what that hides.

`issueBuildRemoteData` (`graphql_queries.go:476`) always writes
`"labels": issueLabels(issue)`, and `issueLabels` returns `make([]string, ...)` — a
`[]string`, non-nil even when empty (**[MEASURED]**, read at
`graphql_queries.go:468-474`). `structpb.NewStruct` has no case for `[]string`.

**[MEASURED]** with a standalone probe under `/tmp` (outside the repo — no tree
modification):

```
labels as []string (issueBuildRemoteData shape)   err=proto: invalid type: []string   struct==nil? true
labels as []any                                   err=<nil>                            struct==nil? false
no labels key at all                              err=<nil>                            struct==nil? false
int(number) as in issueBuildRemoteData            err=<nil>                            struct==nil? false
```

So on the GitHub passthrough path, `NewStruct` **always** errors and
`pt.RemoteData` is **always nil**. `sanitizeRemoteData` runs, does its work, and its
output is then thrown away in full by the very next call.

This confirms the claim the baseline block flagged as unverified. Two consequences
worth stating precisely, because they cut opposite ways:

- **Not a vulnerability.** The failure is fail-*closed*: nil, not partial. And the
  typed `pt.RemoteUrl` is validated independently at `convert.go:345`, so the
  passthrough path's `remote_url` is still guarded.
- **But `sanitizeRemoteData` is inert on the exact path its own docblock cites as
  the motivation.** `convert.go:351-357` argues for the change by pointing at the
  GitHub adapters writing `html_url` — and `html_url` never reaches the client from
  passthrough at all, because the whole struct is dropped. Where
  `sanitizeRemoteData` *does* have observable effect is the persisted/imported path,
  where JSON decoding yields `[]any` and `NewStruct` succeeds.

I flag this as a **claim-accuracy** issue, not a security one: the docblock will
mislead the next reader about which path the control protects. Also, a silently
discarded error means an operator loses the entire `remote_data` field for every
passthrough task with no signal at all.

**Recommendation.** Do not swallow it:

```go
st, err := structpb.NewStruct(sanitizeRemoteData(t.RemoteData))
if err != nil {
    slog.Warn("dropping remote_data: not representable as structpb",
        "task_id", t.ID, "err", err)
}
pt.RemoteData = st
```

and correct `convert.go:351-357` to say which path the sanitizer is observable on.

### 0.6 Green controls and positive observations from the open pass

- **The binding scanner has real recall.** M3 — a brand-new file
  (`ft-mutant-probe.ts`) containing an `href` binding the scanner had never seen —
  was caught: *"Unapproved URL-bearing binding(s) found."* This is a **positive
  outcome**, not just an oracle-can-fire result: the scanner is allow-list shaped,
  so an unknown sink fails closed rather than being ignored. **[MEASURED]**
- **The allow-list entries are not rubber stamps.** M1's failure message shows the
  scanner requires a whole-initialiser match within the enclosing block and
  explicitly rejects `href = safeHref(x) || x`. It named the file, line, and the
  offending binding text. **[MEASURED]**
- **`safeHref`'s own unit pins are non-vacuous in the positive direction.** M2 was
  caught by the `javascript://evil.com/%0aalert(1)` fixture — the authority-form
  case, i.e. the *hard* one that the docblock documents as defeating the hostname
  backstop, not just the easy `javascript:alert(1)`. M4b was caught too. **[MEASURED]**
- **The comments in `safe-url.ts` and `urlvalidate.go` are unusually honest.** They
  document where the previous version of the same comment was *wrong* (the hostname
  check described as fail-closed when it is partial; the `http:/\/\evil.com` claim;
  the "unreachable" divergence claim). This is the opposite of the failure mode this
  branch keeps hitting and it should be said plainly.
- **Baseline gates reproduce exactly.** **[MEASURED]**, all from the repo root, none
  piped: `go build` 0 · `go vet` 1 with exactly 4 `copies lock value` at
  `server.go:1509,1619,1827,2004` and **0** `web/dist` messages (provisioning
  confirmed — the quiet trap did not fire) · `go test ./...` 0 with 0 `FAIL` lines ·
  `npm run build` 0 · `npm test` 0, `PASS: 4 test file(s), 315 assertions`.

### 0.7 A control that caught my own error

My first attempt at M4 inserted `return raw;` immediately after the `typeof` guard.
It failed `tsc` with `TS2345`/`TS2322` — inserting the early return destroyed the
narrowing the rest of the function relied on, so the mutant was **type-invalid**,
not a valid weakening. Exit 2 from both `npm run build` and `npm test`.

Had I recorded that as "npm run build catches a gutted `safeHref`," I would have
credited the build gate with a detection it does not have. The correct reading is
that `tsc` rejected *my probe*, not the vulnerability. I rewrote it as M4b —
replacing the function body wholesale, type-clean — and M4b passes `npm run build`
**green** and is caught only by `npm test`. The M4b row is the one in the 0.1 table.

### 0.8 Did the open pass find anything the item list would have missed?

Recorded here before reading the item list, so the answer is falsifiable. I will
not revise this paragraph after reading it; any correction goes in a later section.

My prediction: **0.2 (collection path) and 0.5 (`structpb` swallow as a docblock
accuracy defect) are the candidates for genuinely-new.** 0.1 is named in my dispatch
prose, and the baseline block tells me 0.5's *mechanism* is on an item list already —
but it frames it as "is the fix leg's claim true?", which is a different question
from "does that make the sanitizer inert on its motivating path?" 0.3 and 0.4 I
expect are covered.

---
## §0.9 — Scoring the open pass (written AFTER reading the item list)

Per §0 of the baseline block, I am not editing §0.8; the correction goes here.

**My prediction in §0.8 was half right.**

| §0 finding | item list coverage | genuinely new? |
|---|---|---|
| 0.1 guard runs nowhere | **A2**, directly | no — but see below |
| 0.2 collection `remote_data` unsanitized | **not covered.** A4 is scoped to *task* `remote_data`; A1 asks which paths populate it, but names only the task path | **YES** |
| 0.3 `PullRequest.url` no read-path check | **not covered.** I predicted it was, and I was wrong | **YES** |
| 0.4 sink enumeration | implied by A5 | no (green control) |
| 0.5 `structpb` swallow | **A1**, directly | no |
| 0.7 my own probe error | not covered | procedural |

**So the open pass returned two findings the item list would have missed** (0.2, 0.3),
and I mispredicted one of them as covered. Both are Low/Medium, not Criticals — so
this is not a repeat of the round the baseline block describes. But it is not a null
result either, and the honest score is **2 for 6**.

The item list also found things the open pass did not: I had not attacked the scanner
(A5) or probed the key-name predicate (A4) before reading it. **The two are
complementary, not redundant** — the open pass found *paths*, the item list found
*control weaknesses*. If you are deciding whether to keep the practice, that split is
the argument for keeping it: they fail in different directions.

One process note, said plainly because it degrades the experiment: **the dispatch
message named A2 before I read anything.** If you want a clean §0 measurement next
round, the dispatch should carry the tree SHA and the report path and nothing about
the items.

---

# §1 — Findings

Severity per the role's rubric. Attribution per §0 of the baseline block.

## [HIGH] F1 — This diff's security guard is executed by nothing; the break is `make test`, not CI

**Attribution: BOTH** (OPEN PASS §0.1, steered by dispatch prose; item A2).
**Location:** `Makefile:9-10`, `Dockerfile:1-6`, `Dockerfile.server:1-6`, `web/package.json:9`.

Full measurement in §0.1 — the enumeration table, the four-mutant table, and the
recommendation. Not repeated here. The one-line statement:

> `npm test` is the sole executor of `url-binding-scan.test.ts` and
> `safe-url.test.ts`. **[MEASURED]** `git grep` finds zero invocations of it anywhere
> in the repository. `make test` is Go-only, so even adding CI that runs
> `make lint && make test && make build` would not execute this diff's guard.

**Sharpened by A3's findings.** The two headline rejection fixtures this round adds —
`javascript://evil.com/%0aalert(1)` and `data://evil.com/x` — live only in
`web/src/util/safe-url.test.ts:108-109,210-211`. Unlike the shared fixtures in
`testdata/url-scheme-cases.json`, which at least run on the Go side under
`go test ./...`, **these two run nowhere at all.** The commit that added them
(`b06121f`) is the commit whose stated purpose is replacing false claims with
measurements; the measurements it adds are unexecuted.

## [MEDIUM] F2 — Five scanner fail-open shapes; the computed-name ban was applied to `setAttribute` but not to property assignment

**Attribution: ITEM LIST (A5).**
**Location:** `web/src/util/url-binding-scan.test.ts:110-114` (the property rule),
`:135-142` (the computed-name bans it *does* have).

A5 says "find the third — assume one exists." **[MEASURED]** — I planted a probe file
(`web/src/components/ft-scanprobe.ts`, since removed) containing five candidate shapes
plus a known-caught control. Result: **only the control fired.**

```
Unapproved URL-bearing binding(s) found:
  components/ft-scanprobe.ts:41 [dynamic URL attribute binding] return html`<a href=${this.evilUrl}>x</a>`;
```

The control firing is what makes the five negatives non-vacuous: the probe file *was*
walked, scanned and reported on. The five that evaded:

| # | shape | why it evades |
|---|---|---|
| 1 | `a['href'] = this.evilUrl` | rule is `\.(?:href\|src\|…)\s*=`, requires a literal dot |
| 2 | `href=` and `${…}` on separate lines | `scanText` is line-by-line (`:302`) |
| 3 | `'<a href="' + url + '">'` | concatenation, no `${` |
| 4 | `const set = a.setAttribute.bind(a); set('href', url)` | call is not `.setAttribute(` at the call site |
| 5 | `const prop = 'href'; a[prop] = url` | bracket access with a computed name |

**Shapes 1 and 5 are the sharp ones**, and they name a coherent omission rather than
a random gap. The scanner already bans computed *attribute* names outright —
`.setAttribute(` not followed by a literal is a finding (`:135-138`), with the
justification "whatever the name turns out to be, this scanner cannot read it." That
reasoning applies verbatim to `el[expr] = value`, and the rule was not extended there.
`el['href'] = url` is ordinary JavaScript and the exact semantic twin of the
`el.href = url` the scanner does ban.

**Severity reasoning.** Not itself exploitable — it requires a contributor to write
the bypassing code, and there is no such code in the tree today (**[MEASURED]**: my
independent sink enumeration in §0.4 found three `href` bindings, all accounted for).
This is control efficacy, not a live vulnerability. Medium.

**Recommendation.** Add a bracket-assignment rule mirroring the existing computed-name
ban:

```ts
// Bracket-notation property write: el['href'] = x, el[prop] = x.
// Mirrors the computed-name ban on setAttribute: a name this scanner cannot
// read must not be a silent pass.
{
  name: 'URL property written via bracket access',
  pattern: new RegExp(`\\[\\s*(?:['"\`](?:${PROP_ALT})['"\`]|(?!['"\`]))[^\\]]*\\]\\s*=\\s*(?!=)`, 'i'),
},
```

For shape 2, scan a joined-and-blanked text with a multi-line-tolerant pattern rather
than per line. Shapes 3 and 4 I would document as accepted precision/recall trades in
the same style as the existing `URL_PROPS` note at `:79-91` — that note is good
practice and the new gaps deserve the same treatment rather than silence.

## [MEDIUM] F3 — `PullRequest.url` is the one field with no server-side read-path check, and its only guard is the one F1 shows is unenforced

**Attribution: OPEN PASS.** Not in the item list.
**Location:** `internal/server/convert.go:375-380` vs. `:345`.

Detail in §0.3. The composition is the finding: `remote_url` gets belt-and-braces
(write boundary at `server.go:666` **and** read-path re-validation at
`convert.go:345`); `PullRequest.url` gets the write boundary only
(`server.go:644`, `export_import.go:722`), and `safe-url.ts:9-13` correctly states
that for pre-`urlvalidate.go` rows `safeHref` is the *only* control. Legacy rows are
not migrated. Mutant M1 is exactly this path and `make test` stayed green.

**Recommendation** in §0.3 — re-validate PR URLs in `taskToProto`, clearing the URL
rather than dropping the PR.

## [LOW] F4 — `collectionToProto` does not sanitize; collection `remote_data` is unvalidated on import

**Attribution: OPEN PASS.** Not in the item list.
**Location:** `internal/server/convert.go:529-531`; `internal/server/export_import.go:332`.

Detail and recommendation in §0.2. Low because **[MEASURED]** no `href` binding reads
`collection.remoteData` — the two readers (`ft-app.ts:255`, `capabilities.ts:98`)
consume a capability flag. Unguarded carrier, no sink.

## [LOW] F5 — Collection export emits `remote_data` and `pull_requests` unsanitized, bypassing the read-path scrub

**Attribution: ITEM LIST (A1, "which paths DO populate `remote_data` on the wire?").**
**Location:** `internal/server/export_import.go:437-438` (and `:742-743` on re-import).

`taskExport` copies `PullRequests` and `RemoteData` **verbatim from the ent entity**
into the export document. It does not call `sanitizeRemoteData`. So a legacy
`javascript:` `remote_url`, or an `html_url` the dashboard read path would have
dropped at `convert.go:358`, rides out intact through `ft collection export`
(`internal/cli/collection.go:198-208` writes it raw to stdout or a file).

This is a **third wire path for `remote_data`**, alongside the gRPC read path and the
CLI. It is the one path in the tree that reaches a caller without passing the scrub.

Low, not higher: the export document is JSON at rest, not a render context, and
re-import is guarded by `validateImportedTaskURLs` for URL-named keys. But it is a
straightforward asymmetry — the read path was hardened this round and the export path,
which serialises the same map from the same source, was not.

**Recommendation.** `RemoteData: sanitizeRemoteData(t.RemoteData)` at `:438`, and
apply `validateURLField` to `t.PullRequests` there, so export and read agree.

## [LOW] F6 — Key-name predicate misses URL-carrying keys that are not named like URLs

**Attribution: ITEM LIST (A4).**
**Location:** `internal/server/urlvalidate.go:113-141`.

**[MEASURED]** by extracting `urlBearingRemoteDataKey` and `keySegments` verbatim into
a standalone probe (no transcription — the functions were sliced out of the source
programmatically):

```
in-tree adapter keys
  URL-BEARING : remote_url, html_url
  not matched : remote_id, node_id, number, created_at, updated_at, labels,
                state_reason, milestone, parent, platform, status, priority,
                issue_type, external_ref, source_system, owner, created_by, design

GitHub API URL vocabulary (not written in-tree)
  URL-BEARING : avatar_url, patch_url, diff_url, issue_url, comments_url,
                events_url, labels_url, repository_url
  not matched : homepage, blog, website, docs, download, asset, image, icon, logo,
                src, attachment, location, redirect, callback, webhook, endpoint,
                target, origin, source, repository, ref, path, commit, tree, blob,
                pull_request, issue

predicate edge cases
  URL-BEARING : url, URL, Url, htmlUrl, HTMLUrl, HTMLURL, CURL, url_, _url, urls,
                URI, href, permalink, deep.nested.url, a/b/url, myURL, my_url_field
  not matched : curl, curls, u-r-l, urlish, url2, 2url, URL2, unfurl, hurl, burlap, swirl
```

**The gap A4 asks me to construct:** `homepage` is a real, user-editable URL field in
GitHub's REST repository object. `redirect`, `callback`, `webhook`, `endpoint`,
`location`, `src`, `download`, `attachment`, `image`, `icon`, `logo` are all ordinary
names for URL-valued fields and none matches. Beads writes `external_ref` and
`design` (`internal/platform/beads/beads.go:394,408`), neither matched.

**Why Low.** Two independent brakes, both **[MEASURED]**:
1. No web binding renders `remote_data` at all (§0.4), so there is no sink.
2. `TestRemoteDataKeysWrittenByAdaptersAreClassified`
   (`urlvalidate_differential_test.go:506-530`) enumerates the keys in-tree adapters
   actually write and forces each to be classified or justified. That bounds the
   *in-tree* set, which is the enforceable half, and the docblock at `:104-110` says
   so accurately.

So the gap is latent and the design honestly documents itself. Worth recording, not
worth blocking.

**Also measured (`url2`, `URL2`, `2url` not matched):** a digit adjacent to the word
defeats both the segment match and the all-caps suffix fallback. Marginal, but if you
touch the predicate, `url2` is a plausible key name and `curl` is not the only edge.

## [LOW] F7 — The scanner's anti-vacuity floor admits a walk that misses whole directories

**Attribution: ITEM LIST (A5).**
**Location:** `web/src/util/url-binding-scan.test.ts:715-735`.

`MIN_FILES = 40`; the tree has **52** (**[MEASURED]**:
`find web/src -name '*.ts' ! -name '*.test.ts' | wc -l` → 52, matching the comment
exactly). Witnesses are `components/inspector/`, `components/dependency/`, `util/`.

So a walk may drop **12 files** and still pass, provided it reaches those three
directories. Not covered by any witness: `components/kanban/` (4),
`components/tree/` (3), `components/minimap/`, `components/ready-queue/`, `store/`,
`utils/`, and top-level `components/`. A recursion bug dropping `store/` and
`components/kanban/` clears both the floor and the witnesses.

This is A5's hypothesis confirmed — "a walk that hits the witnesses and the count
while missing the code that matters." It is a check on a check, hence Low.

**Recommendation.** Cheapest real fix: assert on the set of *directories* reached
rather than three file paths, e.g. require every immediate subdirectory of `src/` to
contribute at least one scanned file. That scales with the tree instead of drifting
from it.

## [INFO] F8 — `structpb.NewStruct`'s discarded error makes `sanitizeRemoteData` inert on the path its own docblock cites

**Attribution: BOTH** (OPEN PASS §0.5; item A1).
**Location:** `internal/server/convert.go:358`; `graphql_queries.go:468-486`.

Measurement, probe output and recommendation in §0.5. **A1's question answered
directly: I confirm the fix leg's claim, and I confirm it is unconditional** —
`issueLabels` returns `make([]string, len(...))`, non-nil even for an issue with zero
labels, so `NewStruct` fails on *every* passthrough task, not only ones with labels.
The relayed quote in the brief (`"labels": []string{...}`) does not carry that detail
and it is the detail that makes the claim absolute rather than conditional.

## [INFO] F9 — Over-matching silently deletes non-string values under URL-named keys

**Attribution: ITEM LIST (A4).**
**Location:** `internal/server/urlvalidate.go:200-206`.

`sanitizeRemoteData` drops a URL-bearing key whose value is not a string:
`s, ok := v.(string); if !ok { continue }`. So `{"links": 5}` (a count),
`{"labels_url": ["a","b"]}` (a list), or `{"permalink": null}` are **removed from the
payload entirely**, silently. Combined with `CURL`-style all-caps false positives, the
over-match direction has a real if small data-integrity cost. The docblock at
`:190-192` states the behaviour honestly ("nothing in this tree writes one"), which
is currently true. Recording it so the next person adding a `links` counter knows.

## [INFO] F10 — Credentials-in-authority URLs are accepted by both guards

**Attribution: OPEN PASS (A3 neighbourhood).**

`https://user:pass@evil.com/` is accepted by `safeHref` and by `validateURLField`, and
resolves to host `evil.com` at a real anchor (**[MEASURED]**, both). Rendered as
"Open External Source", it is a plausible phishing/spoofing presentation — the visible
text suggests one destination and the authority is another. Not XSS, not a divergence
(both sides agree), and arguably out of scope for a *scheme* allow-list. Noted only
because A3 asked for the neighbourhood.

---

# §2 — Verdict on each item, agreements stated at equal weight

## A1 — reachability of the carrier that was fixed: **CONFIRMED, and the r2 HIGH was LATENT**

- **The fix leg's claim is correct and I confirm it independently** (F8). Mechanism
  probe **[MEASURED]** in `/tmp`: `structpb.NewStruct` returns
  `proto: invalid type: []string` and a nil struct for the `issueBuildRemoteData`
  shape; `[]any` and the no-labels shape both succeed. Combined with `issueLabels`
  returning a non-nil slice unconditionally, `remote_data` is **always** nil on the
  GitHub passthrough path.

- **Was the r2 HIGH live or latent? LATENT.** The `html_url` carrier could not reach a
  client through the passthrough path, because the whole struct failed to serialise.
  **The finding was not wrong** — it correctly identified an unvalidated carrier — but
  the exploit chain it described was severed by an unrelated bug that nobody had
  noticed, and severity should have been Medium, not High, on the evidence then
  available. That is a retrospective judgement and I want to be fair about it: nobody
  in r2 knew about the `[]string` bug, and reasoning from the code as written to
  "attacker-controlled `html_url` reaches the client" was sound. **Downgrading it now
  is only possible because r3 did the work.**

- **Severity now: INFO.** The carrier is scrubbed on the read path; on the passthrough
  path it never serialised in the first place. Both halves closed.

- **Which paths DO populate `remote_data` on the wire?** Enumerated rather than
  grepped, **[MEASURED]**, four:
  1. gRPC read path, ent-stored or imported tasks (`convert.go:358`) — **sanitized**.
  2. gRPC read path, GitHub passthrough (`convert.go:358`) — **always nil** (F8).
  3. Collection export document (`export_import.go:438`) — **NOT sanitized** (F5).
  4. Collection `remote_data`, a separate map (`convert.go:530`) — **NOT sanitized** (F4).
  The CLI hard-nulls task `remote_data` (`internal/cli/output.go:62`) and MCP omits it
  entirely (`internal/mcp/server.go:863-891`), so neither is a carrier. Paths 3 and 4
  are new this report.

- **Is the `nil` pin load-bearing, and does fixing the `[]string` bug re-open the
  leak?** The pin is load-bearing and **the leak does not re-open**.
  `TestTaskToProtoScrubsRemoteDataURLCarriers`
  (`urlvalidate_differential_test.go:603-639`) drives the *real* `taskToProto` with a
  `[]any`-shaped map — the shape a JSON round-trip produces — so it exercises the
  post-fix world today. If someone changes `issueLabels` to `[]any`, `remote_data`
  starts serialising and `sanitizeRemoteData` is already in the path. **Agreeing
  explicitly and at equal weight:** that test carries an anti-vacuity-by-identity
  check (`remote_id` must survive, `:634-638`) written precisely to defeat "absence
  assertions pass on a nil struct." That is the count-neutral discipline applied
  correctly and unprompted, and it is the single best-constructed test in the diff.

## A2 — delivery vs consumption: **BREAK CONFIRMED at `make test`** — see F1

- **The chain, named link by link.** Contributor defeats `safeHref` → writes code →
  (no pre-commit hook: `.git/hooks/` empty, `core.hooksPath` unset, no
  husky/lefthook/pre-commit config) → commits → (no CI: `.github/` has templates only)
  → runs `make test` or `go test ./...` per `CLAUDE.md` → **GREEN** → `make build` /
  `make web` → **GREEN** → Docker image (`npm ci` → `npm run build` → `go build`, no
  test stage) → **GREEN** → ships. **Nobody is told, at any link.**
- **The break is `make test`, one layer below the tracked CI item.** Adding CI that
  runs the obvious targets would not close it. That is the answer I most want on the
  record, because it means the tracked item and this one are not the same item.
- **Is `d92ae5e` a real improvement, or an improvement upstream of a severed chain?**
  **Measured answer: it is a real and well-built improvement to a severed chain.** The
  runner genuinely closes the naming gap and the consumption gap — I read the
  implementation (`run-tests.mjs:96-152`, `:225-250`) and it does what it claims. It
  makes `npm test` a much stronger oracle. It does not make `npm test` run. Both
  halves are true and the second dominates.
- **"Does `npm run build` transitively invoke any part of this guard?" — NO.**
  **[MEASURED]** four ways: mutants M1, M2, M3 and M4b all pass `npm run build` with
  exit 0 while failing `npm test`. `build` is `tsc --noEmit && vite build`; neither
  reads `url-binding-scan.test.ts`, and `tsconfig.test.json` (the config that compiles
  test files) is not used by `build`. **No guard runs anywhere in the release path.**
  The brief called the answer to this "the most valuable single fact you can return
  this round"; the fact is that the answer is no, in all four directions I could
  attack it from.

## A3 — scheme policy: **CONFIRMED; no escalation found in 66 inputs**

- **Both named fixtures confirmed against the shipped `safeHref`.**
  `javascript://evil.com/%0aalert(1)` → rejected; `data://evil.com/x` → rejected.
  Both are present as rejection fixtures at `safe-url.test.ts:108-109` and `:210-211`.
- **66 inputs probed** (case folding, C0/whitespace including NUL/VT/FF/CRLF, HTML
  entity and percent-encoded `j`, fullwidth `ｊ`, `data:` html/base64/SVG, and bare +
  authority forms of `blob`, `filesystem`, `about`, `vbscript`, `view-source`,
  `intent`, `file`, `mailto`, `ws`, `wss`, `ftp`, `tel`, `chrome`, `moz-extension`,
  plus protocol-relative and four backslash confusions). **57 rejected, 9 allowed.**
  **All 9 allowed are http(s).** This is a **count** over the input set I constructed,
  and a **lower bound** on the true rejection set — the input space is not enumerable.
- **The end-to-end property, which is stronger than testing `safeHref` alone.** I
  resolved every input at a **real JSDOM anchor at two document bases**
  (`http://dash.internal/app/` and `https://dash.internal/app/`) and asserted the
  property that matters at the sink:
  > **No input that `safeHref` allows yields a non-`http(s)` protocol at the anchor,
  > at either base.** **[MEASURED]: holds, zero exceptions.**
  The two base-dependent hosts (`http:/example.com`, `https:/example.com`) reproduce
  exactly what `safe-url.ts:72-77` documents, in both directions.
- **Where my evidence comes from, stated plainly as the brief demands.** Node 20's
  `URL` and JSDOM, **not a browser**. I have observed **no real browser behaviour** and
  claim none. The residual divergence risk: Node and JSDOM both implement WHATWG URL,
  as do Chrome/Firefox/Safari, so for the **scheme** — the property this guard exists
  to protect, and the one that is simplest and most stable in the spec — divergence is
  unlikely but unproven. **Host** parsing is where implementations have historically
  drifted, and `safe-url.ts` already disclaims host reasoning explicitly, which is the
  right call. **A real-browser pass over the 9 allowed inputs is the one piece of
  evidence this branch does not have and cannot get from its current harness.** I would
  not block on it; I would record it.
- **Agreeing at equal weight:** the `javascript://evil.com/%0aalert(1)` fixture is the
  *hard* case, not the easy one, and mutant M2 died on it specifically. The authors
  chose the fixture that catches the failure mode their own earlier comment got wrong.

## A4 — is the scrub fail-closed, and is a name predicate right? **Fail-closed where it matters; the predicate is the weak half but currently sinkless**

- **Unknown key → not matched → passes through unvalidated.** That is fail-*open* on
  classification, and it is the F6 gap. The design accepts this deliberately and says
  so; the compensating control is the adapter-key enumeration test.
- **Nested map → not walked.** Pinned by `urlvalidate_differential_test.go:521-530`,
  which forbids any nested key from being URL-bearing and tells you to flatten it or
  teach the sanitizer. **Agreeing at equal weight: this is the right shape of pin** —
  it converts an unhandled case into a build error rather than leaving it undocumented.
- **Array of strings / nil / non-string under a URL key → dropped** (F9). Fail-closed
  for safety, with a small integrity cost.
- **Do the two guards agree on what is safe?** **No, and the disagreement is
  characterised rather than assumed empty** — which is exactly what the brief asked
  for and what the tree already does. **[MEASURED]: 9 of 42 shared fixtures diverge**,
  matching the docblock's claim precisely. Directions: 7 server-rejects/client-accepts,
  2 server-accepts/client-rejects (`""` and `https://example.com:99999/x`). The
  server-accepts/client-rejects direction is the "client load-bearing alone" case and
  both instances are inert (empty string; an out-of-range port that a real anchor
  cannot even parse — **[MEASURED]**, protocol resolves to `:` with no host). **No
  divergence is a scheme escalation.**

## A5 — the scanner as a control: **five fail-opens found (F2); anti-vacuity attackable (F7); blanker is NOT the weak link**

- **The third fail-open exists — there are five** (F2). A5's instruction to "assume one
  exists" was correct and productive.
- **`blankNonCode` pressure points: I attacked this and came away with a green
  control, which is worth as much as the finding.** Detection runs on **raw** file text
  — `testNoUnapprovedBindings` passes `readFileSync(file,'utf8')` to `scanText`
  (`:693`), which splits the *unblanked* string (`:302`). `blankNonCode` is used only
  in `enclosingBlock`, `scanObjectAssign` and the `viaSafeHref` check. **Therefore the
  blanker cannot create a detection false negative** — it can only affect *approval*.
  And a mis-blank that hid a `safeHref(` call would make the `viaSafeHref` assertion
  go **red**, not green. String blanking also stops at newline (`:351`), so a stray
  apostrophe in template HTML is line-local damage. To exploit the blanker at all you
  must *already* have an `ALLOWED` entry — at which point you did not need the blanker.
  **[INFERENCE]** from a code read, not a constructed exploit; I did not build a
  working blanker attack and do not claim one exists.
- **Anti-vacuity attackable: yes** (F7), in precisely the shape hypothesised.
- **Who can change the allow-list?** Anyone, in one line. `ALLOWED` requires a `reason`
  string, and `viaSafeHref: true` entries are genuinely verified against the code
  (`:774-786`) — **agreeing at equal weight, that verification is real and mutant M1
  proved it fires, with a message naming file, line and binding text**. But an entry
  *without* `viaSafeHref` is an unchecked free-text justification, and `ft-toolbar.ts`
  already has two. Is the bypass visible in review? Only if a human reads the diff —
  and per F1, no automated gate will ever mention it. **The allow-list is exactly as
  strong as this project's code review, which is currently the only control in the
  chain.**

## A6 — the seam: **this diff makes it BETTER, and the brief's premise is wrong**

- **The brief says `b06121f` "rewrites the README." It does not.** **[MEASURED]**:
  `b06121f` touches four files —
  `internal/server/urlvalidate_differential_test.go`, `testdata/url-scheme-cases.json`,
  `web/src/util/safe-url.test.ts`, `web/src/util/safe-url.ts`. The whole range
  `0bc9b72..6805daa` touches **no** `README.md` and nothing under `docs/`.
- **I nearly filed that as a finding and it dissolved on checking**, which is worth
  recording. The commit message's phrase *"The README says so and names them"* refers
  to the `_README` **string field inside `testdata/url-scheme-cases.json`**, not to a
  `README.md`. That artefact exists and is substantial.
- **And its central claim checks out.** The `_README` says an audit found **10 more
  divergent shapes** outside the 42 and that "the set is NOT closed." I verified this
  independently: I reimplemented `validateURLField`'s decision in a standalone Go probe
  and **validated the reimplementation by replaying all 42 pinned fixtures — 42/42
  server columns reproduced, 0 mismatches** — then ran the 10 named shapes through both
  it and the shipped `safeHref`, and through a JSDOM anchor at two bases.
  **[MEASURED]: all 10 diverge, exactly as claimed, and none reaches a non-http(s)
  protocol at the anchor.** The `_README`'s security reading is accurate.
- **Does the diff make the seam better or worse? Better, clearly.** It replaced the
  word "bounded" with "PINNED AND SAMPLED — NOT BOUNDED," named the ten shapes it does
  not pin, and stated the security reading. A document that says "this set is not
  closed and here is what I know is outside it" does not go false when a third policy
  lands; it is already written to survive that. **The one sentence that will need
  editing** is `safe-url.ts:21-24` — "the scheme set is deliberately identical to the
  server's allow-list" — which becomes "identical to the server's, and a third policy
  governs markdown links" after #195. That is a small, locatable edit, not a trap.
- **Impression, outside my lane and labelled as such:** the durable statement of URL
  policy now lives in the `_README` of a test fixture. That is an odd home for the
  project's security policy — nobody reads `testdata/*.json` — and when the third
  policy lands there will be no obvious place to describe all three together. A short
  `docs/url-policy.md` would be the natural home. Not a security finding.

---

# §3 — Where this brief is wrong

Nineteen rounds of precedent say to expect 5–11. I found **eight**. Resolved against
the tree, as §5 of the baseline block requires.

1. **A6: "`b06121f` rewrites the README and the `safe-url.ts` docblock."** The docblock
   half is right; the README half is wrong. **[MEASURED]** `b06121f` touches four
   files, none a README; `0bc9b72..6805daa` touches no `README.md` and no `docs/`.
   The artefact meant is the `_README` field inside `testdata/url-scheme-cases.json`.
   Per the standing corollary — resolve citations against the tree — this is item 1.

2. **A6: "the only in-tree statement of policy describes two."** There are at least
   five: `web/src/util/safe-url.ts`, `internal/server/urlvalidate.go`,
   `web/src/components/inspector/ft-inspector-code.ts`, `web/src/util/safe-url.test.ts`
   and the fixture `_README`. **[MEASURED]** by grep for
   `SAFE_SCHEMES|allowedURLSchemes|scheme allow-list`. "The only" is wrong and the
   count is wrong; the *substance* — that no single document will describe all three
   policies after the merge — is right.

3. **A1: the relayed quote says `issueBuildRemoteData` writes `"labels": []string{...}`.**
   It writes `issueLabels(issue)`. Same type, but the quote omits the fact that makes
   the claim absolute: `issueLabels` returns `make([]string, len(...))`, which is
   **non-nil even for zero labels**, so `NewStruct` fails on *every* passthrough task
   rather than only on labelled ones. A leg checking the quote as written might have
   concluded "fails when labels are present."

4. **A2: "The production container build runs `npm run build`."** There are **two**
   production container builds — `Dockerfile` (ships `/ft`) and `Dockerfile.server`
   (ships `/farmtable-server`). Both do, identically. The singular understates the
   surface, though not the conclusion.

5. **A2 frames the CI absence as the thing not to re-derive, which risks steering a
   leg past the actual break.** "There is no CI" and "`make test` does not run
   `npm test`" are different defects with different fixes. A leg that accepted the
   fence at face value could reasonably have written "the chain breaks at the missing
   CI, which is tracked" and stopped — missing that the break survives fixing CI. The
   fence's own closing sentence saved this; the framing nearly cost it.

6. **Baseline §7: "the scanner fixes are complete for the two fail-open shapes it
   confirmed."** Accurate as literally written, but "complete" invites the reading
   that the scanner is now sound. **[MEASURED]: five further fail-open shapes** (F2).
   The brief flagged this as an unverified claim, which was the right call — I am
   recording that the verification came back negative.

7. **A4: "GitHub's own API vocabulary is a good source of candidates."** Good advice,
   but the framing implies the gap is reachable. It is not, today: **[MEASURED]** no
   `href` binding in `web/src` reads `remote_data` at all. A leg that constructed the
   key-name gap without checking for a sink would have over-severitised it. The
   instruction to enumerate sinks is in the baseline block, not in A4 — worth pulling
   into the item.

8. **Process, in the dispatch rather than the brief: the dispatch message named item
   A2 in prose before I read the baseline block.** §0's whole purpose is to measure
   what an unsteered pass finds. For A2 that measurement is contaminated and I have
   said so in §0.0. The dispatch should carry the SHA, the report path and the
   instruction to read the baseline block — nothing about the items.

**Green on the brief, at equal weight:** every gate row in §2 of the baseline block
reproduced exactly, including the 4 copylocks at the four stated line numbers and the
315-assertion count. The `web/dist` provisioning was correct and the quiet trap did
not fire — **[MEASURED]** 0 `web/dist` messages in `go vet` output. The `go test`
correction to green was accurate; I saw no flake in two full-suite runs. After the
last three rounds of counts being wrong, that is worth saying.

---

# §4 — Verdict

## **REQUEST CHANGES** — one blocking item, narrowly scoped

I want to be precise about what I am and am not asking for, because the security logic
in this diff is good and I do not want it churned.

**Blocking (F1).** Wire the guard into something that runs. Three lines in the
`Makefile` and one in each Dockerfile, as specified in §0.1. I am blocking on this and
not on anything else, for one reason: **this branch's signature failure mode is a
declared constraint that nothing invokes, r2 was sent back for exactly that, and r3
fixes the guard's *quality* without fixing its *execution*.** Approving would ship a
third round of the same defect one level up. The fix is small, it is in this tree, and
it belongs with the commit that wrote the guard.

**Not blocking, and I would merge them as follow-ups:** F2 (scanner bracket-notation
gap — Medium, but the scanner does not run, so fixing F1 first is the right order),
F3, F4, F5, F6, F7, F8, F9, F10.

**Explicitly approving, at equal weight** — this is not a diff with a problem in it,
it is a good diff that nothing executes:

- `sanitizeRemoteData` and the segment predicate are a sound design, fail-closed in the
  direction that matters, honest about the direction they are not.
- `TestTaskToProtoScrubsRemoteDataURLCarriers` is the best-built test in the change:
  it drives the real `taskToProto` and carries an anti-vacuity-by-identity check
  written to defeat exactly the nil-struct trap that the passthrough path falls into.
- The scanner's recall is real — a brand-new file with a bare `href` was caught
  (**[MEASURED]**, M3) — and its allow-list entries are verified against the code, not
  rubber-stamped (**[MEASURED]**, M1).
- `run-tests.mjs` genuinely closes the naming and consumption gaps.
- The core security property holds end to end: **no input `safeHref` allows reaches a
  non-http(s) protocol at a real anchor, at either document base**, over 66 probed
  inputs.
- The comments are unusually honest — they document where their own previous versions
  were wrong. `b06121f` is a commit whose purpose is deleting false claims, and it
  did that. The `_README`'s "NOT BOUNDED" caveat checked out at 10/10.

**The open concern I am holding separately, per the brief's instruction:** even after
F1 is fixed, the entire enforcement chain for URL bindings terminates in human code
review — the `ALLOWED` list is a one-line bypass with a free-text justification, and
CSP is absent on the dashboard origin (fenced, tracked, not mine). Fixing F1 makes the
guard *run*; it does not make it *unbypassable*. That is a reasonable place for this
control to sit, but it should be a decision, not an accident.

---

# §5 — Dirty cells

**Zero.** All mutants and probes were reverted by `cp` from a `/tmp/audit-r3/` snapshot
taken before any modification, never by `git checkout`.

Touched and restored: `web/src/components/inspector/ft-inspector-code.ts` (M1),
`web/src/util/safe-url.ts` (M2, M4, M4b), `internal/server/urlvalidate.go` and
`internal/server/convert.go` (snapshotted, never modified),
`web/src/components/inspector/ft-inspector-meta.ts` and `web/src/components/ft-toolbar.ts`
(snapshotted, never modified). Created and deleted:
`web/src/components/ft-mutant-probe.ts` (M3), `web/src/components/ft-scanprobe.ts` (F2).
Probes written outside the repo: `/tmp/audit-r3/*`, `/tmp/structprobe/`,
`/tmp/keyprobe/`, `/tmp/serverprobe/`.

```
$ git status --porcelain
$ git rev-parse HEAD
6805daa32aa67992bb26a4e66bd9d102bbf6fa53
```

Empty. Nothing committed, nothing pushed, no production code modified in the delivered
tree. Post-restore gate re-verification **[MEASURED]**: `go build ./...` exit 0;
`npm test` → `PASS: 4 test file(s), 315 assertions`.
