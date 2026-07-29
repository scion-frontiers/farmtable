# audit-xss-r4 — security audit

**Subject:** `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1`
**Range:** `6805daa..e6bda71` (6 commits)
**Axis:** threat modelling, reachability, privilege boundaries, and whether a stated
mitigation actually removes the harm it names.
**Leg:** `audit-xss-r4`. Scratch: `/var/tmp/scratch-audit-xss-r4/`.

---

## STATUS

**PART 1 — OPEN PASS — FILED.** Everything below this line and above the
`[CHECKLIST]` divider was written before reading `_xss-r4-method-block.md` (Part II)
and before receiving `audit-xss-r4-checklist.md`. Every finding in it is tagged
`[OPEN]`.

Verdict is deliberately withheld until the checklist pass is complete.

### Identity confirmed from content, not from the label

```
git rev-parse --show-toplevel   /workspace
git rev-parse HEAD              e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1   ✓ matches brief
git rev-parse --abbrev-ref HEAD url-scheme-validation-r2-audit
git status --porcelain          0 lines
```

### Input availability

- `.design/project-log/url-scheme-validation-r4-fix-round.md` — **present**, in tree.
- **`reports/dev-xss-r4.md` — ABSENT.** Confirmed by directory listing: `reports/`
  contains `_xss-r4-baseline-measurement.md` and the four `*-xss-r3.md` files, and no
  `dev-xss-r4.md`. Reporting it as absent per Part I rather than substituting the
  in-tree log silently. I have not yet read the in-tree log either — deliberately, so
  the open pass is not steered by the dev leg's own account of what it did. I will read
  it in the checklist phase and reconcile.
- Shared baseline `reports/_xss-r4-baseline-measurement.md` — not yet consumed at the
  time of writing this pass (it is a measurement, not a threat model; deferred to the
  checklist phase so the open pass rests on source only).

### Execution budget used in this pass

**Zero builds, zero suites, zero `go test`, zero `npm test`.** All of the below is
reading, grepping, and one `node -e` one-liner that evaluates five regexes against five
string literals (Finding XSS-R4-O4). That is not a build, a compile, or a suite; it
allocates no toolchain and takes milliseconds. Disclosed rather than assumed-permitted.
If the EM's line is that even this needed a grant, that is a rule I will follow going
forward and the measurement can be re-taken under the queue.

**Probe cells left dirty: 0.** No file in the repository was modified, created, or
deleted by this leg. Nothing was committed. Verified: `git status --porcelain` is 0
lines and no `git diff` against `e6bda71` exists to take. The only writes this leg has
made anywhere are this report and `/var/tmp/scratch-audit-xss-r4/`, neither of which is
in the tree.

---

# PART 1 — OPEN PASS `[OPEN]`

## Threat model I built before looking at what the round claims to have fixed

**Asset:** the dashboard origin. **Harm:** script execution in it, via a URL-scheme
sink (`javascript:`, `data:`), or navigation to an attacker origin.

**Untrusted sources that can reach a URL-shaped value in storage:**

| # | Source | Who can drive it | Gate on the path |
|---|---|---|---|
| S1 | `UpdateTask` RPC `remote_url` / `add_pull_requests[].url` | any authenticated API caller | `validateURLField` at `server.go:{644,666}` |
| S2 | `ImportCollection` uploaded JSON document | any caller who can import | `validateImportedTaskURLs` (tasks) / nothing (collection) |
| S3 | GitHub / beads platform adapters | **anyone who can file an issue in a synced repo** — the widest source | no write gate; read-path sanitizer only |
| S4 | GitHub passthrough store | as S3, and never persisted at all | read-path sanitizer only, by necessity |
| S5 | Legacy rows written before `urlvalidate.go` existed | historical | client-side `safeHref` only |

**S3 is the interesting one and it is the one this round is about.** An attacker who can
open an issue on a repo a Farm Table collection syncs controls issue title, body, labels,
and — through the adapter — a slice of `remote_data`. That is a *pre-auth-equivalent*
position relative to the dashboard: no Farm Table credential required.

**Sinks I enumerated independently, by grepping for the sink rather than trusting the
scanner's own allow-list:**

`grep -rn "href=" web/src --include=*.ts` → exactly 3 non-test bindings, all guarded:

- `ft-inspector-code.ts:34` — `safeHref(url)`, degrades to `<span>`. ✓
- `ft-inspector-meta.ts:27` — `safeHref(remoteUrl)`, degrades to `<span>`. ✓
- `ft-toolbar.ts:465` — literal `https://github.com/` prefix + `remoteId` matched
  against `/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/`. I checked the regex myself: anchored,
  admits no `:`, no `%`, and exactly one `/`. The claim is **true today**. Host and
  scheme are both literal, so no open redirect either.
- `ft-toolbar.ts:496` — `a.href = URL.createObjectURL(blob)` with
  `type: 'application/json'` and `a.download = filename` set two lines later. Blob URLs
  inherit the creating origin, so a `text/html` blob without `download` would be a
  same-origin XSS; neither condition holds. The allow-list reason is **accurate**.

**Reachability result that governs several severities below, established before I read
any of the round's own claims:**

`grep -rn "remote_data\|remoteData" web/src` returns **five** non-generated hits:
`capabilities.ts:98` and `ft-app.ts:256` (both read a boolean writability flag),
`gen/types.ts` (type decls), `gen/grpc-client.ts` (`structToRecord`, generic decode),
`store/task-store.ts:120` (a comment). **Nothing in the web client renders `remote_data`
into an `href`, or into markup at all.**

So: **every `remote_data` finding in this round, the dev leg's included, is LATENT, not
LIVE.** `remote_data` reaches the wire and stops at a boolean read. This does not make
the X3 work unnecessary — `remote_data` is a documented open-set escape hatch and the
sanitizer is the right shape for it — but it does mean the correct severity ceiling for
a `remote_data` traversal gap is bounded by "a future binding", and I have rated
accordingly. Part I told me severity has gone wrong on this project *in both directions*;
this is the direction I am guarding against here.

I also confirmed the wire surface is closed at the top: `grep "&pb.Task{\|&pb.Collection{"`
across all non-test, non-generated Go returns **exactly two** sites, `convert.go:264` and
`convert.go:516`, and both now route `RemoteData` through `sanitizeRemoteData`. There is
no second serialiser, no REST handler marshalling ent entities directly, and
`internal/mcp` does not touch `RemoteData` at all. The read-path chokepoint is real.

---

## Findings

### [MEDIUM] `[OPEN]` XSS-R4-O1 — The enforcing test still asserts, and still *justifies*, a rule whose premise this same round deleted. The production comment claims an agreement that is not in the artefact.

- **Location:** `internal/server/urlvalidate_differential_test.go:532`, `:621`, `:626-629`
  vs. `internal/server/urlvalidate.go:218-221`
- **Label:** INTRODUCED BY THIS DIFF (as a contradiction; neither half existed in this
  combination at `6805daa`)
- **Reachability:** not a runtime path. Reachable by the next maintainer, which is the
  exposure that matters for a guard.

**What is there.** X3 (`6551712`) made `sanitizeRemoteData` recurse. The round then
corrected the "walks only the top level" sentence in **one** of the four places that
file states it — line 820, changed to the past tense *"before this round
sanitizeRemoteData walked only the top level"*. The three it did not correct are the
three attached to the **live enforcement rule and its operator-facing failure message**:

```
:532  // be URL-bearing AT ALL, because sanitizeRemoteData walks only the top level.
:621  // the top level. This is a real invariant, not bookkeeping -- a URL under
:622  // remote_data["parent"]["html_url"] would reach the wire unvalidated.
:626  "sanitizeRemoteData walks only the top level of the map, so this value "+
:627  "is serialised into pb.Task.remote_data without ever being validated. "+
:628  "Either flatten it to a top-level key or teach sanitizeRemoteData to "+
:629  "recurse.", key
```

Line 622 is the exact scenario X3 fixed. It is now false. Line 629's second remedy —
*"or teach `sanitizeRemoteData` to recurse"* — **has already been performed in this same
commit range.**

Meanwhile `urlvalidate.go:218-221`, added by the same round, asserts the reconciliation
as done:

> `TestRemoteDataKeysWrittenByAdaptersAreClassified` holds nested keys to a stricter rule
> precisely because this function could not see them. **It can now, so the two agree.**

They do not agree. The test still enforces the stricter rule and still gives the removed
limitation as its whole reason.

- **Impact.** The nested rule is now a hard `t.Errorf` on a condition the production code
  handles correctly. GitHub's sub-issue payload genuinely carries `parent.html_url`; an
  adapter that starts writing it would go red on a *safe* tree. A maintainer who hits
  that reads the failure message, sees a remedy that is already implemented, checks
  `sanitizeRemoteData`, finds it recursing, and concludes the assertion is stale — and
  deletes it. That is the rational response to the message as written.
- **Why it is Medium and not Low.** The harm is not the false sentence; it is that the
  diff **certifies the reconciliation in production source** (`"so the two agree"`) while
  leaving the counter-evidence in the test. Anyone auditing this later will read
  `urlvalidate.go`, take the agreement as established, and not open the test. That is
  the "true-measurement-false-sentence" failure the file's own line 826 says the round
  exists to remove, reproduced inside the fix for it.
- **Recommendation.** Decide the rule's post-X3 purpose and say so, in both files. It is
  defensible to *keep* it as defence-in-depth (a nested URL carrier is still worth a
  human look) — but then it must be justified by that, not by a limitation that is gone:

```go
// Nested keys are held to a stricter rule than top-level ones: they may not be
// URL-bearing at all. Since X3 (6551712) sanitizeRemoteData DOES recurse, so such a
// key would in fact be validated -- this rule is now defence in depth, not the only
// gate. It is kept because a nested URL carrier is a shape worth a human decision,
// and because the recursion is one commit old. It is NOT kept because the value
// would otherwise reach the wire unvalidated; that was true before this round and
// is not true now.
```

and correspondingly delete `"or teach sanitizeRemoteData to recurse"` from the failure
message, and reword `urlvalidate.go:221` from `"so the two agree"` to state what is
actually true: the recursion now makes the nested rule redundant-but-retained.

---

### [MEDIUM] `[OPEN]` XSS-R4-O2 — Two of the four scanner allow-list entries carry no enforceable arm at all. Their safety depends on a line nothing pins.

- **Location:** `web/src/util/url-binding-scan.test.ts:256-267` (`ALLOWED` entries 3 and 4)
- **Label:** LATENT (pre-existing shape; this round hardened the *other* two and left
  these untouched, which is what makes the asymmetry newly visible)
- **Reachability:** by a future source edit. This is a guard gap, not a live bug.

**What is there.** The round drove `viaSafeHref` through four successively tighter
versions — the `Allowed` interface documents all four, ending at *"(3) as the positive
arm, plus a UNIVERSAL negative arm over the whole file"*. That is genuinely strong work.
It applies to **two** of the four entries. The other two have `viaSafeHref` absent, so
`checkViaSafeHref` is never called for them, and the *only* thing enforced is that the
approved line still exists verbatim and exactly once.

Both of those entries' stated reasons are claims about a **different line**:

```js
{ file: 'components/ft-toolbar.ts',
  line: '<a href=${url} target="_blank" rel="noopener" class="external-link" ...>',
  reason: 'url is built from the literal prefix https://github.com/ plus a remoteId
           already matched against GITHUB_REPO_RE, ...' },
{ file: 'components/ft-toolbar.ts',
  line: 'a.href = url;',
  reason: 'url is a locally minted blob: URL from URL.createObjectURL, ...' },
```

- **Proof of concept.** In `ft-toolbar.ts`, change line 463 from
  `const url = \`https://github.com/${collection.remoteId}\`;` to
  `const url = collection.remoteUrl ?? '';`, or delete the `GITHUB_REPO_RE.test(...)`
  conjunct on line 462. The allow-listed line 465 is **byte-identical** afterwards. The
  entry is not stale (the line is present), not ambiguous (it matches once), and has no
  `viaSafeHref` arm to run. `testNoUnapprovedBindings` passes. The scanner reports a
  clean tree.
  Same shape for `a.href = url;`: move the assignment above `URL.createObjectURL`, or
  point `url` at `result.downloadUrl` from the server, and the approved line is
  unchanged.
- **Impact.** Exactly the class the round was convened to close, one level up: an
  approval whose justification nothing checks. The file's own history shows this pattern
  being fixed four times for `viaSafeHref` bindings while these two sat at level zero.
- **Why not High.** It needs a source-code change by someone with commit access, and a
  reviewer looking at that diff would plausibly catch it. But that is exactly the
  argument the scanner exists to reject — the file's opening paragraph says *"Fixing the
  two `href=${...}` bindings that an audit happened to trace is a checklist. A checklist
  does not stop the next binding someone adds."*
- **Recommendation.** Give every allow-list entry an arm, even a weak one. A second
  discriminated arm alongside `viaSafeHref` costs little and can be driven by
  `testViaSafeHrefConsumption` the same way:

```ts
/**
 * The interpolated identifier must be initialised, in the innermost enclosing
 * block, from a template literal whose first character is not `${` -- i.e. the
 * scheme is a source literal, not data. Universal-negative arm as for viaSafeHref:
 * no other assignment to the identifier anywhere in the file.
 */
readonly viaLiteralPrefix?: string;   // e.g. 'https://github.com/'

/**
 * The identifier must be initialised from URL.createObjectURL(...) in the
 * innermost enclosing block, and a `.download =` assignment on the same object
 * must appear within N lines -- a blob: href without `download` NAVIGATES, and
 * a blob inherits this origin.
 */
readonly viaObjectURLDownload?: boolean;
```

The second one is worth having on its own merits: it pins the `download` attribute,
which is currently the only thing standing between a same-origin blob navigation and a
download, and which no test mentions.

---

### [LOW] `[OPEN]` XSS-R4-O3 — A second, undocumented sanitize/import asymmetry, on the *only* list shape JSON can produce. The test that pins "the one documented disagreement" cannot generate the shape.

- **Location:** `internal/server/urlvalidate.go:262-271` vs `:395-402`;
  `internal/server/remotedata_depth_test.go:307-423`
- **Label:** INTRODUCED BY THIS DIFF
- **Reachability:** S2 (import). Not exploitable — see Impact.

**What is there.** Under a URL-bearing key holding a `[]any`, the two traversals do
different things with a **non-string element**:

```go
// sanitizeRemoteValue, URL-bearing key, case []any:
s, ok := e.(string)
if !ok || validateURLField(key, s) != nil { continue }   // element DROPPED, not walked

// validateRemoteDataValue, URL-bearing key, case []any:
s, ok := e.(string)
if !ok { continue }                                       // element ACCEPTED, not walked
```

So for `remote_data.links = [ { "html_url": "javascript:alert(1)" } ]`:
`sanitizeRemoteData` **drops** the element; `validateRemoteDataURLs` returns **nil**.
`dropped=true, errored=false` — a disagreement.

The pinning test declares exactly one permitted asymmetry and says so explicitly:

> `asym` marks **the one** documented disagreement ... Pinned here so it cannot silently
> become **two** disagreements.

It has already become two. The table cannot see it: its seven `wrappers` put the leaf
inside `[]any` only under `"sub_issues"` and `"kids"` — both **non**-URL-bearing, which
routes through the generic walk that handles this correctly — and none of its nine
`leaves` places a map inside a list under a URL-bearing key.

**The sharper half.** The table *does* prove agreement for `[]map[string]any`
(`{"sub_issues": []map[string]any{in}}`). But `RemoteData` is `map[string]any` decoded
from JSON, and `encoding/json` **never** produces `[]map[string]any` — it produces
`[]any`. So the list shape the test proves agreement on is one the primary threat source
cannot construct, and the list shape it can construct is the one that diverges. The
coverage and the reachable surface are close to disjoint here.

Note also the direction inversion this creates: naming a key `"parent"` gets its subtree
**walked**; naming it `"links"` gets the same subtree **skipped**. Announcing that a key
holds URLs buys it *less* scrutiny.

- **Impact.** Not exploitable. `sanitizeRemoteData` is the stricter side, and X3 added it
  at the import write site (`export_import.go:743`, `:332`) as well as the read path
  (`convert.go:358`, `:534`), so the value is dropped before it is stored and again
  before it ships. Nothing dangerous reaches a client. The harm is (a) a false stated
  invariant that a future change will be reasoned against, and (b) silent data loss — a
  legitimate `remote_data.parent.links = [{...}]` is now deleted in full where before
  this round it shipped untouched, because the recursion reaches it and the URL-bearing
  `[]any` arm cannot keep a map.
- **Recommendation.** Make the URL-bearing `[]any` arm walk non-string elements instead
  of discarding them, which removes the asymmetry *and* the data loss:

```go
case []any:
    out := make([]any, 0, len(tv))
    for _, e := range tv {
        if s, ok := e.(string); ok {
            if validateURLField(key, s) == nil { out = append(out, s) }
            continue
        }
        // A container inside a list under a URL-bearing key is not a URL, but its
        // own keys still classify. Walk it with an empty key, exactly as the
        // generic []any arm does -- otherwise "links" is scanned LESS thoroughly
        // than "parent", and the import check silently accepts what this drops.
        if ne, keep := sanitizeRemoteValue("", e, depth+1); keep {
            out = append(out, ne)
        }
    }
    return out, true
```

and the mirror in `validateRemoteDataValue`. Then add to `wrappers`:
`{"inside a []any under a URL-BEARING key", func(in map[string]any) map[string]any {
return map[string]any{"links": []any{in}} }}` — which is the row that would have caught
this, and which also raises `len(wrappers)` in the two anti-vacuity counts at the bottom
of the test.

---

### [LOW] `[OPEN]` XSS-R4-O4 — Measured recall hole in the binding scanner: a newline between `=` and `${` is invisible, and it is not on the file's own "what it does not see" list.

- **Location:** `web/src/util/url-binding-scan.test.ts:96-150` (`RULES`), `:360-371`
  (`scanText`)
- **Label:** LATENT

`scanText` splits on `\n` and applies each regex per line, so no rule can match across a
line break. I measured the five shapes rather than reasoning about them:

| probe | result |
|---|---|
| `return html\`<a href=${raw}>x</a>\`;` | CAUGHT |
| `<a` / `href=${raw}` / `>x</a>` (attr and value together) | CAUGHT |
| `<a href=` / `${raw}>x</a>` | **MISSED** |
| `<a href="` / `${raw}">x</a>` | **MISSED** |
| `el.href =` / `raw;` | CAUGHT |

The two missed shapes need the break to fall between `=` and `${`. That is unusual to
write by hand, which is why I am rating this Low and not Medium — but the file's
`WHAT IT STILL DOES NOT SEE` paragraph enumerates five specific boundaries (CSS `url()`,
`unsafeStatic`, `unsafeHTML`, attribute spread, `<object>.data`) and **line wrapping is
not among them**, so a reader takes line-based matching as complete.

Two things make it worth fixing rather than just documenting. First, `setAttribute` is
*already* fail-closed against this — `/\.setAttribute\s*\(\s*(?!['"]|`[^`$]*`)/` fires
on a bare `.setAttribute(` at end of line, because the lookahead succeeds against
end-of-string — so the file demonstrably knows the shape and handles it inconsistently.
Second, the fix is nearly free.

- **Recommendation.** Either scan a newline-joined buffer and map offsets back to lines
  (the `scanObjectAssign` helper already computes line-from-offset with
  `code.slice(0, o).split('\n').length`, so the machinery exists), or add the cheap
  fail-closed rule that mirrors the `setAttribute` treatment:

```ts
// A URL attribute whose value is wrapped onto the next line. scanText is
// line-based, so `href=` + newline + `${expr}` matches no rule above. Fail closed
// on the dangling `=`, as the setAttribute rules already do on a dangling `(`.
{ name: 'URL attribute assignment continued on the next line',
  pattern: new RegExp(`\\b(?:${ATTR_ALT})\\s*=\\s*["'\`]?\\s*$`, 'i') },
```

and, whichever is chosen, add line wrapping to the `WHAT IT STILL DOES NOT SEE` list if
it is not closed.

---

### [LOW] `[OPEN]` XSS-R4-O5 — This diff's `RUN npm test` sits downstream of a `COPY` that can replace the toolchain it depends on. There is no `.dockerignore`.

- **Location:** `Dockerfile:5-9`, `Dockerfile.server:5-9`; absence of `/.dockerignore`
- **Label:** INTRODUCED BY THIS DIFF (the gate is new; the `COPY` ordering is not)

```dockerfile
COPY web/package.json web/package-lock.json ./
RUN npm ci                 # lockfile-pinned, integrity-checked
COPY web/ .                # <-- merges the BUILD CONTEXT's web/ over the result,
                           #     including web/node_modules if the host has one
# `npm ci` above installs devDependencies, so tsc/jsdom are present at this stage;
# the release path must not be able to ship a tree whose guard is red.
RUN npm test               # <-- now runs under whatever survived the line above
```

The comment's premise is true and insufficient. With no `.dockerignore` anywhere in the
repo, `COPY web/ .` copies the developer's `web/node_modules` into the image over the
`npm ci` tree. This *matters more now than before the diff*, because until this round
that only affected `npm run build`; it now sits between the security guard and the
lockfile that is supposed to pin the guard's toolchain.

- **Impact.** A host `node_modules` missing `typescript` fails the build — fail-closed,
  fine. A host `node_modules` containing a *tampered* `typescript` or `jsdom` runs the
  URL guard under attacker-influenced tooling and it passes — fail-open, and the release
  path is exactly where the diff says the guard must be authoritative. This is a
  build-integrity issue, not a remote one, so Low.
- **Secondary, pre-existing, flagging as Info not as a defect of this diff:**
  `Dockerfile:17` is `COPY . .` with no `.dockerignore`, so `.git/` and
  `.farmtable/farmtable.db` (which holds token material) enter the *builder* stage. The
  final stage is `debian:bookworm-slim` + `/ft` only, so nothing leaks into the shipped
  image, and the build context bloat is a separate concern. Recording it because the
  round touched these files.
- **Recommendation.** Add a `.dockerignore` — it fixes both, and it is one file:

```
.git
.gitignore
.farmtable
web/node_modules
web/dist
web/.tmp-test
**/*.db
.env
.env.*
```

`web/dist` is safe to exclude because `Dockerfile:18` overwrites it from the frontend
stage anyway.

---

### [LOW] `[OPEN]` XSS-R4-O6 — Comment added by this diff points at a document that does not exist.

- **Location:** `web/src/components/inspector/ft-inspector-desc.ts:240`
- **Label:** INTRODUCED BY THIS DIFF

Part I told me this file is a comment-only change and to verify that and leave it. **I
verified it: the change is comment-only, and the `unsafeHTML(renderMarkdown(...))` sink
on line 241 is byte-identical to `6805daa`.** The `#195` markdown/DOMPurify branch is
fenced out of scope and I am not filing against it.

The new comment is not correct, though. Its last sentence is
*"See `docs/url-policy.md` for what IS stated."* `docs/` contains `architecture.md`,
`code-of-conduct.md`, `contributing.md`. `find . -name 'url-policy*'` returns nothing,
and `grep -rn url-policy` returns exactly one hit — this comment, referring to itself.

- **Impact.** Small but pointed. The comment's entire purpose is to stop a reader
  mistaking DOMPurify for the URL-scheme policy, and it discharges that by redirecting
  to a document that does not exist. A reader who follows the pointer finds nothing and
  is left where they started. The rest of the comment is accurate and valuable — the
  observation that DOMPurify runs on defaults with no explicit `ALLOWED_URI_REGEXP`, so
  the stripping behaviour is a *dependency fact* rather than a repo-stated property, is
  a good catch and worth keeping.
- **Recommendation.** Either write the document, or point at what actually states the
  policy today: `internal/server/urlvalidate.go` (`allowedURLSchemes`) and
  `web/src/util/safe-url.ts` (`SAFE_SCHEMES`), with `web/testdata/url-scheme-cases.json`
  as the pinned differential. Do not leave a forward reference to an unwritten file in a
  security comment — it reads as "this is documented elsewhere" and it is not.

---

### [INFO] `[OPEN]` XSS-R4-O7 — The mitigation is keyed on the key's *name*; the sink is keyed on the value. This is the residual risk and it is correctly acknowledged, but the function's own doc line overstates it.

- **Location:** `internal/server/urlvalidate.go:125-152` (`urlBearingKeyWords`), `:199-200`
- **Label:** LATENT

`sanitizeRemoteData`'s summary line reads:

> returns a copy of a task's RemoteData with every URL-bearing entry that fails
> `validateURLField` removed, **AT EVERY DEPTH.**

A reader takes "URL-bearing" as *is a URL*. It means *is under a key whose name contains
a segment in a 10-word list*. `"javascript:alert(1)"` under `description`, `homepage`,
`avatar`, `website`, `blog`, `src`, `target`, `endpoint`, `path` or `action` survives
every layer of this round, at every depth, and is stored and shipped verbatim.

I want to be fair here: the long comment block at `:100-121` is honest about this and
says so well — *"Nothing closes the set; that is why the predicate above fails closed"* —
and the fail-closed naming rule is the right design for an open-set escape hatch. The
predicate is also better than it needs to be (whole-segment matching, camelCase
splitting, the all-caps suffix fallback). My point is narrower: the **summary line**, which
is what shows in godoc and what a hurried reader sees, promises a value property and
delivers a name property. `homepage` and `blog` are real fields on GitHub's REST
responses, so this is not a contrived gap.

**Not currently reachable** — see the reachability section above; nothing renders
`remote_data`. That is the whole reason this is Info.

- **Recommendation.** One-line change to the summary, and one row to the classification
  test:

```go
// sanitizeRemoteData returns a copy of a task's RemoteData with every entry under a
// URL-BEARING KEY NAME (see urlBearingRemoteDataKey -- this is a naming rule, not a
// value inspection) that fails validateURLField removed, at every depth. A URL under
// a key whose name does not announce it -- "homepage", "avatar", "target" -- is NOT
// removed and is not intended to be; that gap is closed by the client-side binding
// scanner refusing to render anything into an href without safeHref().
```

The cross-reference matters more than the wording: the two halves of this property are
in different languages in different directories, and this is the seam between them.

---

### [INFO] `[OPEN]` XSS-R4-O8 — `TestEveryRemoteDataWriteSiteSanitizes` scans one directory, non-recursively; its doc says "the non-test sources".

- **Location:** `internal/server/remotedata_depth_test.go:506-508`, `:523-536`
- **Label:** LATENT

The doc claims it *"reads the non-test sources, finds every place a RemoteData FIELD is
assigned"*. It reads `internal/server/*.go` only: `os.ReadDir(root)` with
`if e.IsDir() { continue }`, so not even subdirectories of `internal/server`.

`RemoteData:` field assignments outside that scope: `platform/github/github.go:{169,200}`,
`platform/github/passthrough.go:147`, `platform/beads/beads.go:{199,238}`.

**None of these is a defect.** They are *inbound* writes into `store.Task` from an
adapter, and sanitizing there would be wrong — the read path is the correct chokepoint,
and `convert.go` covers all of them. The test's scope is right; its *description* is
what overreaches, and the test is one of the round's headline "we replaced a sentence
with a measurement" artefacts, so the description carries weight.

I also confirmed the regex is correctly blind to the store: `\bRemoteData` does not match
`SetRemoteData` (no word boundary between `t` and `R`), so `entstore.go`'s
`create.SetRemoteData(p.RemoteData)` is out of scope by construction rather than by
accident. Worth stating, because a reader checking coverage will wonder.

- **Recommendation.** Say what it scans:

```go
// SCOPE: internal/server/*.go, non-recursively. That is deliberate and it is the
// whole scope -- these are the OUTBOUND sites, where a map that came from an adapter
// or the database is handed to a client. The adapters themselves
// (internal/platform/{github,beads}) assign RemoteData too, INBOUND, and must not
// sanitize: the read path is the chokepoint and sanitizing at the adapter would give
// two places to forget instead of one. A new outbound serialiser added outside
// internal/server would not be seen here.
```

---

### [INFO] `[OPEN]` XSS-R4-O9 — `structpb.NewStruct` is all-or-nothing and its error is discarded, so "remote_data is empty" is ambiguous between "the sanitizer worked" and "serialisation failed".

- **Location:** `internal/server/convert.go:358`, `:534`
- **Label:** LATENT (pre-existing shape; this round adds a second instance of it at `:534`)

Both sites are `pc.RemoteData, _ = structpb.NewStruct(sanitizeRemoteData(...))`. A single
unrepresentable value anywhere in the map makes `NewStruct` return `(nil, err)`, the
error is dropped, and **the entire `remote_data` field becomes nil** — not just the
offending key.

`json.RawMessage` is one such value, and the classification test relies on precisely this
for its `"metadata"` exemption:

> Not walked by `sanitizeRemoteData`: `structpb.NewStruct` cannot represent
> `json.RawMessage` either, so it never reaches the wire at all

That is true, and the mechanism is sound (a named type does not match `case []byte:` in a
Go type switch, so it falls to `NewValue`'s error default). But the exemption is resting
on a behaviour whose actual effect is *"the whole map is silently discarded"*, which is
a much larger hammer than the sentence suggests, and which `TestGitHubPassthroughRemote-
DataNeverSerialises` already documents for `[]string` on the passthrough path.

- **Impact.** Fail-safe in the security direction — nothing ships. It is an availability
  and observability issue: a client silently loses all of `remote_data` with no server
  log line, and the two causes are indistinguishable at the wire.
- **Recommendation.** Do not swallow it. This is a two-line change at each site:

```go
st, err := structpb.NewStruct(sanitizeRemoteData(t.RemoteData))
if err != nil {
    // All-or-nothing: one unrepresentable value nils the WHOLE map. Log it, because
    // "remote_data absent" otherwise cannot be told apart from "the sanitizer
    // emptied it", and the exemption for "metadata" in
    // TestRemoteDataKeysWrittenByAdaptersAreClassified depends on this branch being
    // the reason that key never ships.
    slog.WarnContext(ctx, "remote_data not serialised", "task", t.ID, "err", err)
}
pt.RemoteData = st
```

---

## Positive observations `[OPEN]`

Recorded deliberately, and specifically — Part I asks for impact before severity, and
several of these are load-bearing for why my severities above are as low as they are.

1. **The read-path chokepoint is genuinely closed, and I verified it independently of
   the round's claim.** Two proto builders in the whole tree, both sanitizing; no second
   serialiser; MCP does not touch `RemoteData`. That is what makes every `remote_data`
   traversal gap in this round non-exploitable rather than merely unexploited.
2. **X3 is sanitize-on-read *and* sanitize-on-write.** The belt-and-braces is what
   contains XSS-R4-O3 to a data-loss finding instead of an import bypass. Doing both was the
   right call and it paid off against a defect the round did not know it had.
3. **`validateURLField`'s control-character pre-check** (`r <= ' ' || r == 0x7f`, before
   `url.Parse`) is the correct order of operations, and the comment explains *why* it does
   not rely on `net/url` rejecting them. `java\tscript:` is the exact shape that defeats
   naive denylists and it is handled at the right layer.
4. **`safe-url.ts`'s no-base `new URL()` decision** is subtle and correct, and the comment
   proves it with the two counterexamples (`//evil.com/x` and `not-a-url`) rather than
   asserting it. The `javascript://evil.com/%0aalert(1)` note — correcting an *earlier
   version of the same comment* that overclaimed the host guard as fail-closed — is the
   best single piece of security writing in this tree.
5. **`renderPrLink` / `renderExternalSourceLink` are exported solely so the JSDOM test
   drives the real function**, with a comment saying that a previous test declared its own
   copy and therefore shipped green against `safeHref(url)` → `url`. That is a real
   measured fail-open, fixed at the root.
6. **Rejected URLs degrade to visible text, not to nothing.** Both sinks render a `<span>`
   with the raw value in a `title`. Security controls that silently delete user data get
   removed by product pressure; this one will not.
7. **`checkViaSafeHref` was extracted specifically because its two assertions were
   unkillable inline** — and `testViaSafeHrefConsumption` includes a *positive control* so
   that a function that always throws cannot pass the negative cases. That is the correct
   structure and most test suites do not have it.
8. **`directoryCensus` replaces a count with a per-directory identity check**, with the
   measurement that motivated it recorded inline (skip 3 dirs, 41 files, clears a floor of
   40, stays green with a planted `href=${raw}`). Replacing a floor with a binding on the
   tree's shape is the right generalisation.
9. **`run-tests.mjs` closes the naming gap with a chokepoint rather than a checklist**, and
   `requireTestConfigGlob()` pins the premise that scanning `src/` suffices. Broad
   `TEST_WORD`/`TEST_DIR` patterns erring toward false positives is the right trade and is
   argued as one.
10. **`EXPECTED_ASSERTIONS`' comment states what the pin misses** — count-neutral mutations,
    two of five survivors — instead of claiming completeness, and says out loud that it is
    the outermost level with nothing above it. A guard that documents its own ceiling is
    rarer than it should be.

---

## Numbered list of everywhere the briefs are wrong `[OPEN]`

Part I requires this as a deliverable. Open-pass instalment; I expect to add to it after
Part II and the checklist.

1. **`briefs/audit-xss-r4.md:3` conflicts with the ordering it is enforcing.** It says
   *"READ `_xss-r4-baseline-block.md` (PART I) IN THIS DIRECTORY FIRST, IN FULL"* — and
   Part I line 15 says its shared-machine section binds *"BEFORE any other instruction in
   this document or your leg brief."* Fine. But line 3's *"IN FULL"* is the same
   construction that Part I §"The method rules are in PART II" identifies as having made
   an uncontaminated open pass impossible by construction, and that the dispatch message
   identifies as the defect found at three levels tonight. Part I is now facts-only so it
   is harmless *in this instance* — but the load-bearing property is "Part I contains no
   targeting", not "the instruction says IN FULL". The instruction is one edit to Part I
   away from reintroducing the defect it was split to fix, and nothing marks Part I as
   needing to stay targeting-free. **Recommendation:** replace *"IN FULL"* with *"in full
   — it is facts, environment and policy only, and it must stay that way; if you find
   targeting in it, that is a defect, report it."*
2. **`reports/dev-xss-r4.md` does not exist.** Part I flagged this as unconfirmed and
   instructed me to say so rather than substitute. Confirmed absent. Recorded in the
   Input availability section above.
3. **Part I's commit table mislabels `d12f572`.** It lists it as
   *"X2/X4/X5/X7a: close the guard-tracer's universal, scope and walk-identity holes"*,
   and separately says three of the six commits *"change instrumentation rather than
   production behaviour (`2f6500f`, `d12f572`, `4e58242`)"*. `d12f572`'s actual subject
   line in `git log` is *"Close the guard-tracer's universal, scope and walk-identity
   holes"* — no `X2/X4/X5/X7a` prefix. Minor, but Part I also says *"Name the SHA, not the
   branch. The branch name is not an identifier"* — the same discipline should apply to
   quoting a subject line, since a leg cross-checking by `git log --oneline | grep X2`
   finds nothing.
4. **Part I's gate table is missing the gate this round exists to create.** It measures
   `go build ./...`, `make test`, `git status --porcelain` as EM-MEASURED, and carries
   `go vet`, `go test ./internal/server/`, `gofmt` as REPORTED. It does not carry
   `cd web && npm test` as a row in its own right, nor either container build — and
   `RUN npm test` in both Dockerfiles is one of X1's two deliverables. The `make test`
   row subsumes the first (`test: test-go test-web`) but does not distinguish it, so a
   leg cannot tell from the table whether the web half ran or whether `test-go` passed
   and `test-web` was never reached. Given that this round's headline is *"`make test`
   now runs the web guard at all"*, the table should separate them.
5. **Dispatch vs. Part I, resolved in Part I's favour, reported as instructed.** The
   dispatch message orders `1. baseline block → 2. leg brief → 3. open pass`. The leg
   brief's own line 9 orders *"THEN WRITE YOUR OPEN PASS. ONLY THEN read
   `_xss-r4-method-block.md` (PART II)"*, and its line 37 heading says *"STEP 1 — THE
   OPEN PASS. THIS FILE CONTAINS NOTHING ELSE, BY DESIGN."* These agree. **No conflict
   this time** — recording the check rather than the failure, since Part I asks to be
   told about conflicts and the absence of one is the result.
6. **The 00:12Z addendum's item 2 is confirmed from this container.**
   `SCION_WORKSPACE_MODE` is a false label as the EM states; I did not rely on it. My
   clone is private, HEAD is `e6bda71`, the tree is clean, and the branch is
   `url-scheme-validation-r2-audit`. Reporting the confirmation because a second
   independent observation of the same wrong value is worth more than one.

---

## Open questions I am carrying into the checklist phase `[OPEN]`

Listed so it is visible which of these the checklist steered me to versus which I
already had.

1. Does `TestSanitizeAndImportAgreeAtEveryDepth` still pass with the XSS-R4-O3 wrapper row
   added? I believe it fails; I have not run it. **This is my one run request.**
2. Does the nested-key rule in `TestRemoteDataKeysWrittenByAdaptersAreClassified`
   currently fire on anything in-tree, or is it dormant? (XSS-R4-O1's severity depends on
   whether a real adapter key is already close to tripping it.)
3. `assertions.ts` and the `#assertions` receipt mechanism — can a file inflate its own
   count? **Impression only; this is the test leg's axis** and I will not file on it.
4. Whether `EXPECTED_ASSERTIONS = 380` matches the baseline artefact's reported
   `PASS: 4 test file(s), 380 assertions`. It appears to; I have not consumed the
   artefact yet.

---

## Run requests

Front-loaded per Part I, batched into one ask. Everything above was reached without a
build or a suite.

| # | Command | For | Est |
|---|---|---|---|
| R1 | `go test ./internal/server/ -run 'TestSanitizeAndImportAgreeAtEveryDepth' -count=2` | XSS-R4-O3, after I add one wrapper row in a scratch copy. Confirms the second asymmetry is real and that the sweep currently cannot see it. | <1 min |
| R2 | `go test ./internal/server/ -run 'TestRemoteDataKeysWrittenByAdaptersAreClassified' -v -count=2` | XSS-R4-O1 question 2 — the `t.Logf` lines enumerate the nested keys actually found, which tells me whether the stale rule is dormant or live. | <1 min |

Both are single-test, single-package, `-count=2` per Part I's flake guidance
(`TestWatchTasks_*` is not in either selection, so the 4.5% flake should not apply —
stating that so it can be contradicted). Neither needs the web suite. R1 requires me to
modify a test file; I will do it in a **scratch copy under
`/var/tmp/scratch-audit-xss-r4/`**, not in the tree, and the tree will stay at 0 dirty
cells either way.

---

<!-- ======================= CHECKLIST DIVIDER ======================= -->
<!-- Nothing below this line existed when "OPEN PASS FILED" was sent.  -->

# PART 1.5 — POST-PART-II, PRE-CHECKLIST `[POST-II]`

**Why a third tag.** The scheme is `[OPEN]` / `[CHECKLIST]`, and neither fits what is in
this section. Part II is described as "method", but its §"SELF-REPORTED GAPS" names five
specific items — **P10, X8, `scopes.go`, P2cn, P11** — and says they are carried into the
leg briefs as claims to test. That is targeting. Anything I found after reading it is not
open-pass-independent, and folding it into `[OPEN]` would corrupt the control the
attribution exists to provide. Folding it into `[CHECKLIST]` would be equally false — I
have not received the checklist. So: `[POST-II]`. Written after Part II and the in-tree
dev log, before `audit-xss-r4-checklist.md`. **Nothing in this section changed a word of
the `[OPEN]` section above it.**

---

## REQUIRED DELIVERABLE — did Part I alone leave me under-equipped?

Part II §18-21 asks this directly and says a false negative from withholding method is a
worse outcome than contamination. Answering plainly.

**No — for my axis. But the split did not work, and I can show you the seam.**

**Where it held.** Six findings, all from source reading and threat modelling. None
needed the method block. Two of Part II's rules I applied without being told, because
they are ordinary security-audit practice: I assessed the binding scanner by *constructing
the thing it should catch* (XSS-R4-O2's PoC, XSS-R4-O4's five measured probes) rather than by
running it, and I treated every "the tree is clean" as needing a positive control. For a
threat-modelling axis, Part I's facts — the tree, the sinks, the fenced scope — were
enough. **A reviewer or test leg may answer differently and I would not argue with them;**
the count-neutral bar and the arm-attribution rule are much closer to load-bearing for
those axes than for mine.

**Where it did not hold, and this is the part I think you need.**

### `[POST-II]` PII-1 — Part I is not facts-only. It contains targeting, and my two Mediums are in exactly the two components it named.

`_xss-r4-baseline-block.md:126-129`:

> The dev leg reports that **it found and fixed defects in the guard tracer and in the
> adapter-key scanner** during this round, and that no defect it found was a live
> vulnerability. Those are its claims; they are in scope for you.

That is not a fact about the environment. It names **two of the five instruments** and
tells me they are where the defects were. My two Medium findings are:

- **XSS-R4-O1** — in the **adapter-key scanner** (`TestRemoteDataKeysWrittenByAdaptersAre-
  Classified`).
- **XSS-R4-O2** — in the **guard tracer** (`url-binding-scan.test.ts`'s allow-list).

Two named components; two Mediums; one in each. **I cannot claim my open pass was
uncontaminated, and I am not going to.**

Being fair to myself and to the measurement: both are reachable without the hint. XSS-R4-O1
came from reading `urlvalidate.go:221`'s "so the two agree" in the production diff and
going to check whether that was true — a path that starts in production code. XSS-R4-O2 came
from enumerating `href=` sinks myself and then reading the allow-list that exempts them.
Neither began at "go look at the two things the EM named." But I read Part I in full
before I started, line 126-129 was in it, and **the honest report is that the ordering
cannot distinguish those two histories from the outside — which is exactly the property
the split was built to give you.**

Three further pieces of Part I steer, less sharply:

- **§"What this round was, as facts", lines 121-123** partitions the six commits into
  instrumentation / production / docs. That is analysis, not a fact, and it is *correct* —
  but it told me `6551712` was the one production commit before I had opened the diff, and
  I did read `urlvalidate.go` first because of it.
- **The "Fenced OUT OF SCOPE" list** is negative targeting. Telling me not to look at CSP,
  `#195`, `#194`, the merge seam and the `web/dist` defect shapes the search as surely as
  telling me where to look. It is *necessary* — I would otherwise have spent the pass
  re-filing known items — but it is not "facts only".
- **Part I §199-206's flake statistics** (4.5%, Wilson CI, the 27-row / ~71% arithmetic,
  "a spurious RED reads as mutant killed, so the bias flatters the suite") is method. It
  is the same content as Part II §43-46 and §63-67. It is in the mandatory-first document.

**Recommendation, and it is cheap.** The split is the right idea and it mostly worked —
Part I is *far* closer to facts-only than the r3 baseline block was, and the four levels
of contamination you have chased tonight are real progress. To close the seam:

1. Move lines 126-129 to Part II verbatim. Replace them in Part I with the bare fact:
   *"The round changed five instruments. The dev leg's own account is in the in-tree log;
   treat every sentence as a claim."* That is a fact, and it does not say which two.
2. Move the flake arithmetic to Part II; keep only *"there is a known flake in
   `TestWatchTasks_*`; see Part II before you run a matrix"* in Part I.
3. Keep the fenced-scope list in Part I — its cost is real but its absence is worse — and
   **label it** as the one acknowledged steer in the document, so the next leg can price
   it rather than absorb it.
4. **Add a standing rule to Part I:** *"Part I must contain no sentence that tells a leg
   where a defect is likely to be. If you find one, that is a defect in the apparatus and
   a required report item."* You have now found this class at four levels; the thing that
   stops a fifth is a rule that makes any leg the detector, not another split.

---

## Adjudicating the self-reported claims Part II carried to me

Part II §115-121: *"a self-reported gap that reviewers treat as already-settled is how a
leg reviews itself. Do not accept any of them because they were disclosed."* Two of the
five are pure reasoning and I can settle them now, without a run.

### `[POST-II]` PII-2 — P2cn's equivalence argument: **CONFIRMED**, by my own derivation, with a load-bearing premise the dev leg did not name.

The claim: walking `[]any` elements under the parent key instead of `""` is an equivalent
mutant, because "the generic slice arm is reachable only when the key is not URL-bearing,
and both spellings are then non-URL-bearing."

I derived it independently rather than checking their reasoning. In `sanitizeRemoteValue`,
the URL-bearing block's `case []any:` **returns**, so control reaches the generic switch
only when `urlBearingRemoteDataKey(key)` is false. `key` is then non-URL-bearing by
hypothesis and `""` is non-URL-bearing trivially. Downstream, `key` is consumed in exactly
two places — the recursive `urlBearingRemoteDataKey` test (false for both) and
`validateURLField(key, …)` inside the URL-bearing block (not reached). Identical for
`validateRemoteDataValue`. **The mutant is equivalent. The argument is sound and should
be accepted.**

**But its premise is the early return in the URL-bearing `[]any` arm — which is XSS-R4-O3.**
If XSS-R4-O3 is fixed, the URL-bearing arm starts walking container elements too, and
"reachable only when the key is not URL-bearing" stops being true of the *elements*. My
proposed fix passes `""` explicitly, so equivalence survives — but only because I chose
that spelling. The equivalence is **contingent on a line the round is likely to change**,
and it is recorded as though it were structural. Worth one sentence in the log:
*"equivalent given that the URL-bearing `[]any` arm does not recurse; revisit if it ever
does."*

### `[POST-II]` PII-3 — P11's redundancy argument: **CONFIRMED**, and one asymmetry the log does not mention.

The claim: two depth bounds on the import walk, removing either leaves the other
enforcing.

Traced: `validateRemoteDataURLs(d)` → `validateRemoteDataValue(d)` → `validateRemote-
DataURLs(d+1)` → … The two alternate strictly, and **every recursive descent passes
through `validateRemoteDataValue`** — including both URL-bearing container cases
(`:411`, `:414`) and both generic ones (`:430`, `:439`). Deleting the bound in
`validateRemoteDataURLs` leaves `validateRemoteDataValue` checking at every level. The
only divergence is the one the log names — an already-past-bound *empty* map returns nil
instead of erroring — and an empty map has nothing to validate. **The argument is sound.
"Mutation testing is correct to flag each bound as individually removable; the
belt-and-braces is deliberate" is the right disposition.**

**Not mentioned, and it is the asymmetry:** the *sanitize* side has **one** bound, not
two. `sanitizeRemoteData` performs no depth check at all and enters at 0; only
`sanitizeRemoteValue` checks. So the "belt and braces" the log defends exists on the
erroring path and not on the dropping path. This is **not a defect** — `sanitizeRemote-
Value` is on every recursive edge, so the single bound is sound — but a reader who takes
"there are two bounds and that is deliberate" as describing the traversal *pair* will be
wrong about half of it. P11's disposition should say "on the import walk" explicitly.

---

## Convergence and divergence with the dev leg's in-tree log

Read after filing the open pass, deliberately, so the pass was not steered by it.

**XSS-R4-O3 directly falsifies a stated claim of the round.** The log, §X3:

> The single documented disagreement — a URL-bearing key holding an unvalidatable scalar,
> which the sanitizer drops and the import accepts — **is pinned *as* the asymmetry, so it
> cannot quietly become two.**

It already is two. The second is a `map` inside a `[]any` under a URL-bearing key
(XSS-R4-O3), and it is not merely unpinned — the sweep's 7×9 table **cannot generate the
shape**, because `[]any` appears in it only under the non-URL-bearing keys `sub_issues`
and `kids`. This is the sharpest divergence between my pass and the round's own account,
and it is a divergence about a *claim the round makes about its own completeness*, which
is the category Part II says not to accept on disclosure.

**Independent convergence, worth recording as convergence rather than as a finding.** The
log's "the client-side scrub is not a compensating control — `Task.remoteData` is read by
nothing in `web/src`" matches what I established independently before reading it. I
reached it by grepping `web/src` for `remote_data|remoteData` and following all five
non-generated hits; the log reaches it via its test O-9. Two methods, same answer. Note
the log's statement is narrower than mine and both are true: it says *`Task`*`.remoteData`
is read by nothing, and that is right — the two live reads (`capabilities.ts:98`,
`ft-app.ts:256`) are on *`Collection`*`.remoteData`, and both consume a boolean.

**XSS-R4-O9 is not novel; it is the log's own X8, self-reported.** Per Part II I tested the
claim rather than accepting it, and it holds: `structpb.NewStruct` is all-or-nothing, the
error is discarded, and one unrepresentable value nils the whole map. The disposition —
*"I deliberately did not make those types serialise: doing so would start shipping data
to the client that does not reach it today, which is a widening of exposure and not this
round's call"* — is **correct, and I endorse it.** Widening the wire surface inside a
security round would be the wrong trade. My XSS-R4-O9 recommendation is therefore narrowed
to *log the error*, which changes no wire behaviour at all. I am downgrading XSS-R4-O9 from
a finding to an endorsement of the dev leg's disposition plus a one-line observability ask.

---

## Additions to the brief-error list `[POST-II]`

Continuing the numbering from the `[OPEN]` section.

7. **The in-tree log's line numbers for the discarded `structpb` errors are wrong — 3 of
   4.** `url-scheme-validation-r4-fix-round.md` says *"The discarded errors at
   `convert.go:358,530,555,558` remain."* Measured at `e6bda71`:

   | log says | actually at | what is at the cited line |
   |---|---|---|
   | 358 | **358** ✓ | `pt.RemoteData, _ = structpb.NewStruct(...)` |
   | 530 | **534** | a comment line — the X3 comment block |
   | 555 | **559** | `ChangedBy: &pb.User{...}` |
   | 558 | **562** | `if c.OldValue != "" {` |

   Three are off by exactly 4, and the X3 comment block that `6551712` added at
   `convert.go:530-533` is exactly 4 lines. **The log was written against the tree before
   the comment its own commit added.** Low impact, but the log is committed *inside the
   artefact under review*, Part I says every sentence in it is a claim, and Part II's
   closing rule is *"a point-in-time claim is not a standing property — if you assert a
   state, say when you measured it."* This is that rule, failing in the log that states it.

   Useful side effect: chasing the wrong numbers surfaced the two real sites the log meant
   — `convert.go:559` and `:562`, `structpb.NewValue(c.OldValue/NewValue)` on change
   history. **I checked whether those reach a sink and they do not:**
   `ft-inspector-changes.ts:133-136` renders them as `${formatValue(c.oldValue)}` inside a
   `<span>`, which is Lit text interpolation and auto-escaped — not an `href`, not
   `unsafeHTML`. Closed, no finding, recorded so the next leg does not re-walk it.

8. **Part II's `-count=1` rule is right in effect and imprecise as stated**, and the
   imprecision costs a sample. Part II §43-46: *"`-count=1` or it is not a sample."* The
   actual mechanism is that Go only reuses a cached result when every flag comes from its
   cacheable set — `-benchtime, -cpu, -list, -parallel, -run, -short, -timeout, -failfast,
   -v, -fullpath`. **`-count` is not in that set at all**, so *any* explicit `-count`
   defeats the cache. `-count=2` is therefore **two uncached samples in one invocation**,
   which is strictly what this project wants given the flake, and it is what I requested
   in R1/R2. Stated because a leg reading Part II literally will run `-count=1` twice and
   get two invocations where one would do — and, worse, may believe `-count=2` is cached
   and avoid it. **I have not verified this empirically and it is a claim about the Go
   toolchain, not about this tree; flag it if you want it measured** — `go test -count=2 -v`
   on any package shows the test body executing twice with no `(cached)` marker, which is
   a one-package check and I will fold it into R2 if you want it.

---

## Predictions, registered before measurement `[POST-II]`

Part II §48-49: *"Predict before you measure, and report every miss. Report accuracy as a
fraction. A perfect score is weak evidence."* Locking these in now so they cannot be
retrofitted.

**R1** — adding one wrapper row `{"inside a []any under a URL-BEARING key",
… map[string]any{"links": []any{in}}}` to `TestSanitizeAndImportAgreeAtEveryDepth`:

- **P1.** The test goes **RED**. *(confidence: high)*
- **P2.** It fails on the `disagreement:` branch (`:390`), **not** the `both traversals
  agreed on … but the row expects` branch (`:394`) — arm attribution, per Part II §51-54.
- **P3.** **All 9** leaf rows under the new wrapper report `dropped=true, errored=false`,
  not just the dirty ones — because the URL-bearing `[]any` arm cannot keep a map at all,
  so content is irrelevant.
- **P4.** Consequently **4 rows that are CLEAN inputs are silently deleted** — "good URL
  under html_url", "bad-looking value under a non-URL key", "no URL at all", and "a map
  under a URL-bearing key is walked, not dropped". This is the data-loss half of XSS-R4-O3
  and I expect it to be the more persuasive half.
- **P5.** The two anti-vacuity floors at `:415` and `:419` are expressed as
  `len(wrappers)*5` and `len(wrappers)*4`, so they scale automatically and do **not**
  need editing. P10's unkilled floor is untouched by my row.
- **P6.** The failure message will name `links` in the row title, not a nested path.

**R2** — `-v` on `TestRemoteDataKeysWrittenByAdaptersAreClassified`:

- **P7.** The test is **GREEN**, and the nested rule at `:620-630` is **dormant** — it
  fires on nothing in-tree. *(This is the prediction that sets XSS-R4-O1's severity: dormant
  keeps it Medium; already-live would raise it.)*
- **P8.** `nested` includes `percent_completed`, `node_id`, `number`, and none of them is
  URL-bearing.
- **P9.** `found` includes both `remote_url` and `html_url` (the test's own positive
  control asserts this, so P9 is a control on my reading, not a result).

Accuracy will be reported as a fraction over P1–P9 with every miss named.

---

# PART 2 — CHECKLIST PASS `[CHECKLIST]`

Everything below was written after reading `audit-xss-r4-checklist.md`. Findings originating
here are `[CHECKLIST]`.

## Runs consumed

| id | target | sha | occupy | start | end | exit | **edit verified applied** |
|---|---|---|---|---|---|---|---|
| G-4 | `go test ./internal/server/ -run TestSanitizeAndImportAgreeAtEveryDepth -count=2` | e6bda71 + 1 probe wrapper, in `/var/tmp/scratch-audit-xss-r4/r1` | 00:25:58Z | 00:26:09Z | 00:27:37Z | 1 (RED, predicted) | **YES** — denominator moved 63→**72** (8 wrappers, arithmetically impossible without the edit) and 8 messages quote the wrapper title verbatim |
| G-5 | `go test ./internal/server/ -run TestRemoteDataKeysWrittenByAdaptersAreClassified -v -count=2` | e6bda71, verified clean **before** the run | — | 00:27:59Z | 00:28:02Z | 0 | **N/A** — unmutated observation, no edit to land |

G-4's 88s wall was 0.011s of test execution and 29 `go: downloading` lines — cold module cache,
**not** a box signal. G-5 warm: 3s. Zero `(cached)` lines in either, both bodies ran twice.

**Edit-landed column added 00:58Z** under the round-wide rule that *a mutation which failed to
apply is indistinguishable from a mutant that survived*. **I have reported no survivors tonight**
and no finding of mine rests on a green mutation row: G-4 was RED, and a no-op edit runs the clean
tree, which is green — so my result is unreachable by a failed edit. The retroactive self-audit,
including one place where I did draw a cause off a cell that could not carry it, is at the end of
the prediction section.

**Consumed, not produced — declared for independence:** the web suite output at
`reports/_r0-web-suite-output.txt` (and its companion `_r0-go-build-output.txt`) is
**test-xss-r4's artefact, produced under grant G-6 at `e6bda71`** — not my measurement. My A3
answer rests on another leg's run. I judged that acceptable because it is output consumption with
no shared tree and no shared process, and because the artefact is verbatim stdout I can read for
myself. **No finding below is blocking on it.**

**And I am adopting, in full, the restriction the producing leg attached to it** — a boundary it
raised against its own convenience and which the EM has made binding:

> **FINE:** consuming it as an OBSERVATION of what the guard tracer reports on a clean tree.
> **NOT FINE:** citing it as a CONTROL — as evidence the tracer WORKS. A control drawn from the
> same run as its subject is not independent of it, and one green run of the instrument under
> review is not evidence the instrument functions. **It is a GREEN run, so every count-neutral
> corruption in the tracer is invisible in it by construction. It shows what the tracer says when
> it has nothing to say.**

I cite it in exactly one place — A3, for the finding set and the 380/157 split — and only as an
observation of the tracer's output. **I do not cite it as evidence the tracer works anywhere in
this report, and my one finding against the tracer (XSS-R4-O2) is derived by reading its `ALLOWED`
table, not from this artefact, precisely because a green run cannot carry that weight.** I was
offered a RED run of my own and declined it; the reasoning is at the end of A3.

Tree: `/workspace` at `e6bda71`, `git diff e6bda71` = 0, `git status --porcelain` = 0.
**Probe cells left dirty: 0.** All probe work was in `/var/tmp/scratch-audit-xss-r4/r1`, a `cp -a`.

---

## A1 — was the recursion gap live at `6805daa`? **No. Two independent breaks in the chain.**

The checklist states this as settled: *"THE RECURSION GAP WAS LIVE. Price it properly."* I priced
it and it does not hold. I walked the chain the checklist specifies, in order.

**Link 1 — who controls a nested URL-valued key? Nobody. No such key exists.**

Measured from the adapter sources, and independently from G-5's own census:

| builder | nested structures written | nested keys |
|---|---|---|
| `graphql_queries.go:476 issueBuildRemoteData` | `parent`, `sub_issues[]`, `sub_issues_summary` | `node_id`, `number` / `number`, `title`, `state` / `total`, `completed`, `percent_completed` |
| `github.go:257 buildRemoteData` | none | — |
| `beads.go:383 buildRemoteData` | none (flat) | — |
| `server.go:660 UpdateTask` | none | — |

G-5's census, over the same four writers by AST: **14 nested keys, zero URL-bearing.**

**`remote_data["parent"]["html_url"]` does not exist.** `parent` carries `node_id` and `number`.
That path is the flagship example in the in-tree log, in the checklist, and in the fixture of
`TestNestedURLReachesTheWireWithoutRecursion` — and no adapter produces it. The test is still a
valid property test of the sanitizer; it is the **narrative** built on its fixture that is wrong.

**Link 2 — does it reach a DOM sink? No, and this is the cap I established in the open pass.**
Nothing in `web/src` renders `Task.remoteData` at all. Five non-generated hits; the two live ones
(`capabilities.ts:98`, `ft-app.ts:256`) read `Collection.remoteData` and consume a boolean.

**Link 3, which I did not expect — for the primary platform the field does not reach the wire
at all.** See XSS-R4-C1 below. `pt.RemoteData` is `nil` for every GitHub-passthrough task.

**Verdict on A1: at `6805daa` the nested-`remote_data` gap was NOT exploitable end to end.** It
required a nested URL-bearing key that no writer produces, arriving at a consumer that does not
exist. X3 is a correct and worthwhile defence-in-depth fix. It is not the closure of a live
vulnerability, and the round's narrative should stop saying it is — not to diminish the work, but
because **a round that overstates what it closed cannot be used later to reason about what is
still open.**

### A1b — persisted poisoned data: **no remediation task is owed, and the checklist's premise is inverted.**

The checklist says: *"Sanitizing at write time does nothing for rows already in the database…
the fix is not retroactive."* **Four of the six sites are not write sites. They are EGRESS sites.**

| site | direction | reached on |
|---|---|---|
| `convert.go:358` | **egress** | every read of a task into proto |
| `convert.go:534` | **egress** | every read of a collection into proto |
| `export_import.go:139` | **egress** | ExportCollection, the collection |
| `export_import.go:438` | **egress** | ExportCollection, each task |
| `export_import.go:332` | ingress | ImportCollection → store |
| `export_import.go:743` | ingress | ImportCollection → store |

Because the four egress sites sanitize on **read**, **the fix IS retroactive** for every consumer
that exists: a poisoned row persisted before this diff is cleaned on the way out, on every path
out. The two ingress sites make the stored data clean going forward — defence in depth, not the
primary control.

Residual exposure, stated precisely so it is not overclaimed: a reader that touches the `ent`
entity directly and does not pass through `convert.go` or `export_import.go`. In-tree there are
two, and neither renders: `graph_support.go:26` (see XSS-R4-C5) and `entstore.go`'s own merge logic.
**No data-remediation task is owed.** Recommend the round say "sanitized at egress" rather than
"at the write sites" — the current phrasing is what generated the checklist's wrong premise.

### A1c — MCP, CLI, gRPC-web. **All three are clean, and two of them for a good reason.**

> **AMENDED 01:04Z — this enumeration was INCOMPLETE as originally filed. Three surfaces named;
> there are eight consuming packages. All five I missed are clean, and one of them strengthens the
> finding. See "Amendment — positive controls on every load-bearing null" below. Read that section
> before relying on this one.**

- **MCP: zero references to `RemoteData` anywhere in `internal/mcp`** (positive control: same
  grep, same directory, `func ` → 50 matches, so the tool works there). `internal/mcp/server.go:863`
  has its **own** `taskToMap` which enumerates fields explicitly and **never mentions
  `remote_data`.** An allow-list renderer. `remote_data` cannot reach an LLM context.
- **CLI: `internal/cli/output.go:62` sets `m["remote_data"] = nil`** — also an allow-list renderer,
  with the key explicitly blanked.
- **gRPC-web**: the wire carries `remote_data`, but the only client is `web/src`, covered above.

**This is the strongest positive observation in the round and nobody has claimed it:** both
non-web consumers are structural allow-lists, so the "a sanitizer scoped to an HTML threat model
is the wrong shape for a terminal or an LLM context" risk **does not arise** — the field never
gets there. That is a better control than any sanitizer, and it is exactly the
"make-the-bad-state-unrepresentable" shape the checklist's method notes ask for.

The caveat is XSS-R4-C6: nothing pins it, and neither renderer says it is load-bearing.

Change history is the one thing that does cross into both surfaces: `changeToMap` (MCP,
`server.go:914-930`) surfaces `old_value`/`new_value` via `AsInterface()`, and
`ft-inspector-changes.ts:133-136` renders them client-side. Both are **text**, and the client one
is Lit text interpolation (auto-escaped). `remote_url` writes are validated at `server.go:666`, so
a `javascript:` value cannot enter the history going forward. **Closed, no finding.**

---

## A2 — my own sweep for write sites: method, coverage, and what it cannot see

### Method (three passes, deliberately different failure modes)

> **CORRECTED 01:20Z. Pass 1's count was wrong — 102 hits, not 63 — and the enumeration should
> never have rested on the count in the first place. See "Amendment — the unquoted glob, and filing
> a derivation backwards" below. The six-site conclusion holds; its stated basis did not.**

1. **Field-name sweep.** `grep -rn "RemoteData" --include='*.go'` over the whole tree, excluding
   `_test.go`, `internal/store/ent/` and `*.pb.go`. ~~63 hits~~ **102 hits**, read individually.
   *Positive control:* the same pattern against `internal/store/ent/` returns matches, so the glob
   and the tool are working.
2. **Serialization-name sweep.** `grep -rn '"remote_data"'` — the JSON/DB spelling, which catches a
   site that never names the Go field. 4 hits: `cli/output.go:62`, `export_import.go:76`, and the
   two ent schema declarations.
3. **Sink sweep.** Every construction of `&pb.Task{` / `&pb.Collection{` tree-wide (2, both in
   `convert.go`), and every `structpb.NewStruct` / `structpb.NewValue` call (4).

### Coverage claim

**Six egress-or-ingress sites, and I agree the enumeration is complete for the shapes that exist
today.** I found no seventh. I did find that the *directions* are mislabelled (A1b) and that the
enumeration test's own scope is narrower than its doc claims (XSS-R4-O8 / XSS-R4-C6).

### What my method cannot see — stated because a coverage claim without one is a boast

- A write through **reflection** or `encoding/json` into a struct containing the field.
- A **whole-struct copy** — `*dst = *src` — that carries `RemoteData` without naming it. I checked
  for this shape specifically and found none, but a grep for `RemoteData` cannot find it by
  construction.
- A proto built in a **future package** — my sweep is a point-in-time fact about `e6bda71`, and per
  Part II's closing rule I am saying so.
- **`entstore.go:890-898` and `:1392-1399` MERGE old and new `RemoteData` key-by-key on update.**
  My sweep sees these; I am naming them because the merge means **a `remote_data` key can never be
  deleted through the update path** — it can only be overwritten. That is not a defect today
  (egress sanitizes), but it is the reason a poisoned key would be *durable* if egress ever stopped
  covering a path.

### `server.go:661` — **the exemption is correct, and the brief's decay mode does not exist**

**(a) Is it safe?** Yes. `p.RemoteData = map[string]any{}` constructs an empty map; the only two
keys written into it are `remote_id` (from `req.GetRemoteId()`, not URL-bearing, and the only
client that turns a `remoteId` into an `href` runs it through `GITHUB_REPO_RE` first) and
`remote_url` (validated by `validateURLField` at `:666` before insertion). Genuinely exempt.

**(b) The decay mode.** The checklist says the exemption is *"keyed by EXACT SOURCE LINE"*, that
it *"silently retargets when anyone edits above it"*, and that it *"fails permissive"*.

**It is keyed by the exact source TEXT, not by the line number:**

```go
exempt := map[string]string{"p.RemoteData = map[string]any{}": "…"}
…
if _, ok := exempt[strings.TrimSuffix(trimmed, ",")]; ok { continue }
```

So the two consequences the brief draws are both wrong, in opposite directions:

- **Editing above it does nothing.** Line numbers are not used. There is no retargeting.
- **It fails CLOSED on edit, not permissive.** Rename `p` to `params`, or change the literal, and
  the key stops matching → the line becomes an unexempted unsanitized site → **RED**. That is the
  right failure direction and it is better than the brief credits.

The real hole is different and narrower: the key is **text, and file-agnostic**. If any other
non-test file in `internal/server` ever contains the byte-identical line `p.RemoteData =
map[string]any{}` in a context that is *not* safe, it is silently exempted too. That is a genuine
permissive failure, but it requires an exact textual coincidence in one directory.

**Rating: `[LOW]`, LATENT.** The checklist says *"A security control whose failure mode is silent
and permissive and triggered by an unrelated edit is not a Low."* I agree with the principle and
it does not apply, because the described failure mode is not this control's. **Recommendation:**
key the exemption on `file + text`, one line, which closes the coincidence hole without giving up
the fail-closed-on-edit property:

```go
exempt := map[string]string{
    "server.go|p.RemoteData = map[string]any{}": "…",
}
…
if _, ok := exempt[name+"|"+strings.TrimSuffix(trimmed, ",")]; ok { continue }
```

### Import as an ingestion path — authorization, and whether it can write what the API cannot

- `ExportCollection` requires `ScopeCollectionRead` (`export_import.go:106`).
- `ImportCollection` requires `ScopeCollectionAdmin` (`export_import.go:268`).

**Yes, import can write `remote_data` the normal API path cannot.** `UpdateTask` can only write
two keys (`remote_id`, `remote_url`), both constrained. Import writes the **whole map, arbitrary
keys, arbitrary depth**, from a caller-supplied file. That is the only arbitrary-`remote_data`
ingress in the product, and it is the axis on which the checklist's A1 question actually has
teeth.

It is defended twice, and correctly: `validateImportedTaskURLs` **errors** at `:722`, and
`sanitizeRemoteData` **drops** at `:743`. Erroring first is the right order — the caller learns
their file was rejected rather than silently having content removed.

Two things worth the record:

1. **The privilege bar is `collection:admin`, which is the top of the collection scope ladder** —
   so this is not a low-privilege ingress. The realistic threat is not scope escalation, it is an
   admin importing an untrusted export file they were handed ("here is our project export"). That
   is a real pattern and the double defence is the right answer to it.
2. **XSS-R4-O3 lands exactly here.** The ingestion path is where a `[]any` under a URL-bearing key
   arrives from outside. Today the consequence is silent content deletion on import, not a bypass
   — `sanitizeRemoteData` is the strict side. If the fix ever inverts which side is strict, this
   is the path that turns.

**Is export sanitization the right call?** It corrupts the round trip, and I think it is still
right — but the corruption should be *stated*, not discovered. An export→import cycle applies
`sanitizeRemoteData` twice; it is idempotent, so the loss happens once and does not compound. The
loss is (i) invalid URLs under URL-named keys, which is intended, and (ii) XSS-R4-O3's containers,
which is not. **Fix XSS-R4-O3 and the round-trip corruption reduces to the intended case.**

---

## A3 — what was the window, and what did the fixed instruments surface?

### The window, measured from history: **4h12m, 18 commits, three complete review rounds.**

| when | what |
|---|---|
| `f0ab53f` 07-28 **08:46** | the guard is CREATED (`url-binding-scan.test.ts`, `safe-url.test.ts`, `safe-url.ts`) |
| … | **18 commits, including the r1, r2 and r3 fix-round logs** |
| `2f6500f` 07-28 **12:58** | `test-web` added to the Makefile; `RUN npm test` added to **both** Dockerfiles; `agents.md` updated |

Verified at the r3 baseline: `git show 6805daa:Makefile` → **`test: go test ./...`**, Go only.
`git show 6805daa:Dockerfile` → `npm ci` … `npm run build`, **no `npm test`.** `2f6500f` is inside
the r4 diff, so the guard had no executor in the documented workflow for its entire pre-r4 life.

**What landed inside the window is the part that matters.** Of the 18 commits, **eleven are edits
to the guard itself or to its runner**: `158f9b0`, `e5ea360`, `b34c44c`, `5c65382`, `ba79b04`,
`859a54d`, `cedef7b`, `d92ae5e`, `42d62a4`, `457886d`, `b06121f`.

> **The guard was written, revised eleven times, and reviewed by three full three-way rounds,
> without ever being executed by the documented workflow.** Every claim rounds 1-3 made about it
> was a claim about an unrun program.

The single sharpest illustration is `5c65382` (09:55): *"Discover web tests instead of hand-listing
them twice."* The round built **test-discovery infrastructure for a suite that nothing ran.** And
`158f9b0` (09:38) — *"Declare jsdom/@types/jsdom/@types/node so the container build passes"* —
means that for the first 52 minutes the guard could not have run even if invoked.

With **no CI on this project** (Part I), "the documented workflow" is the entire enforcement
mechanism. There was no second path.

### The fixed instruments, re-run over the tree

**Adapter-key AST scanner (my G-5): GREEN. Zero new findings.** Full census in the run log above:
2 top-level URL-bearing keys (`html_url`, `remote_url`), 14 nested keys, none URL-bearing. Both
positive controls fired (`remote_url`/`html_url` found at top level; `percent_completed` found as
nested). **The broken regex version reported `top=[] nested=[]` — it let through nothing, because
there was nothing to let through.** The fix converts a vacuous scanner into a live one; it does not
retroactively surface a missed defect.

**Guard tracer — observed via test-xss-r4's G-6 artefact, cited as theirs: GREEN, 4 files, 380
assertions, `url-binding-scan.test.ts` contributing 157.** Zero findings surfaced. **The broken
version let through nothing either.**

**So the honest answer to "what did the broken instruments let through" is: nothing that the fixed
ones can see.** Three separate reasons that is weaker than it sounds, and I would rather state all
three than bank the green:

1. **A green scanner is evidence that the scanner ran. It is not evidence that the tree is clean.**
2. **Green is invisible to count-neutral corruption by construction** — the producing leg's rider,
   and it is exactly right. What the artefact establishes is *which files the tracer reached*, not
   *whether it reached them for the right reason*. For A3's question — what did the broken versions
   miss — reaching-for-the-wrong-reason is the failure mode that matters, and this artefact cannot
   speak to it. Neither could a green run of my own.
3. **XSS-R4-O2 is the structural reason it cannot be reassurance:** two of the four `ALLOWED` entries
   have no enforceable arm, so the tracer is *incapable* of surfacing a finding in those two lines.
   Green is what it returns whether they are safe or not. A control that looks structural and is
   inert — the thing the method notes call worse than none. **I derived that by reading the
   `ALLOWED` table, not from any run**, which is the only way it *could* be derived: no green
   observation can reveal an arm that cannot fire.

### Why I declined the R3-adjacent RED run

The EM offered me my own row for a mutation showing the tracer can fail. **I declined, and the
reason is axis, not box cost.**

- **A mutation batch against the tracer is mutation adequacy, which is test-xss-r4's axis, and it
  holds the slot for exactly that (G-7, seven rows).** Duplicating it beside them would produce a
  second route to the same conclusion at double the cost, and — per the EM's own convergence rule —
  two legs running the same mutation is one route measured twice, not two routes.
- **My finding does not need it.** XSS-R4-O2 says two `ALLOWED` entries have *no arm*. A RED run
  demonstrates the tracer *can* fail somewhere; it cannot demonstrate that it *cannot* fail on
  those two lines. The proposition is universal-negative and the evidence for it is the source. A
  RED would be a nice-to-have that does not touch the claim.
- **Nothing I am filing is blocking on tracer liveness.** XSS-R4-O2 is a Medium, LATENT, "should fix".

**If the EM wants the tracer's fail-liveness established as a control, the right owner is
test-xss-r4's G-7 and the right consumer of the result is the next round, not me.** I am recording
that as an open item rather than as a hole in my own evidence: *no leg has yet shown this tracer
going RED for the right reason on a mutant it should catch* — and if G-7 covers it, that gap
closes tonight without a second run.

### The historical re-run, done statically rather than with a grant

I did not request a run for this. The tracer's `RULES` are per-line regexes and `web/src`'s
`href`-bearing files are enumerable from git history. Result: across the window, the only files
carrying `href` bindings are the three I enumerated in the open pass (`ft-toolbar.ts` ×2, the two
inspector sinks via `safeHref`), and `safe-url.ts` itself is **byte-identical** from `f0ab53f` to
`e6bda71`. **No `href` binding entered or left the tree inside the window.** So the window, while
real and long, contained no change to the thing the guard guards. That materially lowers the
*consequence* of the window without lowering the *process* finding at all.

**Phase 1 (merged, live in production): no finding. Not touched.**

---

## A4 — X8 / `convert.go:358`. **"Out of scope" is CORRECT. The framing is wrong, and the reality is worse.**

The checklist asks whether silent whole-field nulling is *"a data-destruction primitive reachable
from the external platform."* Tested. **The mechanism is real; the attacker is unnecessary.**

### `[MEDIUM]` XSS-R4-C1 — `remote_data` is `nil` at the wire for **every** GitHub-passthrough task, unconditionally. **LIVE TODAY.** Pre-existing, not introduced.

- `graphql_queries.go:468` `issueLabels()` returns `[]string`, always (`make([]string, n)` — never
  a nil interface).
- `issueBuildRemoteData` writes `"labels": issueLabels(issue)` **unconditionally**, on every issue.
- `structpb` type-switches on `[]any`. A named/plain `[]string` matches no case → error. The round
  measured this itself, in `TestGitHubPassthroughRemoteDataNeverSerialises:764`, with a positive
  control at `:773` proving it is the value type and not `NewStruct`.
- `convert.go:358` **discards the error** → `pt.RemoteData` stays `nil`.

**So the whole map is destroyed, on 100% of passthrough tasks, today, in production.** Same for
GitHub REST tasks that have any label (`github.go:275`, `[]string`) and for beads tasks with labels
or with `metadata` (`json.RawMessage`, which is a *named* `[]byte` and so misses structpb's
`[]byte` case).

**The attacker framing in A4 is not needed and is a distraction.** "An attacker who can plant one
unrepresentable value" describes a capability that a *label* already exercises. There is no
adversary; there is a bug.

**Why Medium and not High — applying my own impact-before-severity rule against my own finding:**
the destroyed field is consumed by **nothing**. `web/src` does not read it; MCP omits it; the CLI
blanks it; export reads the `ent` entity directly and is unaffected; and the typed `remote_url` /
`remote_id` fields are set separately at `convert.go:317-321` **before** the struct build, so they
survive. The harm today is confined to hypothetical gRPC API consumers. **It would be High the day
anything reads `Task.remote_data`,** which is precisely the "unguarded by any consumer-side
control the moment someone writes a consumer" concern A1 raises — the same latent-consumer
argument, arriving from the other direction.

> **AMENDED 01:44Z — my severity criterion was aimed at the field with no consumer, and I waved the
> sibling through unmeasured.** The criterion above (*"the day anything reads `Task.remote_data`"*)
> is still **not** met. But `:534` is the **`Collection`** path, and `Collection.remote_data` **does**
> have client call sites — so scoping the whole severity argument to `Task.remote_data` and
> disposing of the sibling with *"Same at `:534`"* was reasoning about the wrong field. The EM
> measured the collection path and it is **also not live**, which vindicates the Medium; the
> measurement is recorded at XSS-R4-C1b below rather than left as my unmeasured aside.
> **The shape, which is sharper than what I filed:** *the field that can fail has no consumer; the
> field that has two consumers cannot fail. I found one of each and crossed them.*

**Fail-open or fail-closed?** Fail-**closed**, and I checked for the mirror the checklist asks
about. `structpb.NewStruct` is all-or-nothing: on error it returns `(nil, err)`, never a partial
struct. There is **no path where a partially converted, partially unsanitized value is used.**

**Is "out of scope" being used to move a live defect out of the round? NO, and I endorse the
disposition.** The dev leg's reasoning — *"doing so would start shipping data to the client that
does not reach it today, which is a widening of exposure and not this round's call"* — is correct.
Making `[]string` and `json.RawMessage` serialise would take a field that is currently `nil` on the
wire and start populating it, inside a security round, on the strength of a sanitizer whose
completeness this very audit is disputing. **That is the right call and I would have made it.**

**What IS owed, and it is one line:**

```go
if st, err := structpb.NewStruct(sanitizeRemoteData(t.RemoteData)); err != nil {
    slog.Warn("remote_data dropped from the wire", "task", t.ID, "err", err)
} else {
    pt.RemoteData = st
}
```

Zero wire-behaviour change; the total data loss stops being invisible. ~~Same at `:534`.~~
**Struck 01:44Z — superseded, not erased.** The same one-line fix applies at `:534`, but *"same"*
was an unmeasured assertion about a different field with different producers and different
consumers. See **XSS-R4-C1b**.

### `[INFO]` XSS-R4-C1b — the collection path is closed, but NOT for the reason given. Answering the EM's residual from source, no run.

**The question:** does `sanitizeRemoteData` ever *construct* a typed value de novo? If it can emit a
`map[string]string` or similar, the collection adjudication flips.

**The answer is YES — it constructs de novo in two arms**, `internal/server/urlvalidate.go` at
`e6bda71`:

```go
case []string:                              // URL-bearing branch, :270
    out := make([]string, 0, len(tv))       // <- constructs []string
...
case []map[string]any:                      // generic branch, :317
    out := make([]map[string]any, 0, len(tv))  // <- constructs []map[string]any
```

Both are **type-preserving reconstructions**, and **both output types are exactly the class
`structpb.NewStruct` rejects** — the same class as XSS-R4-C1's `[]string`. So the sanitizer can hand
`structpb` a value that nils the entire struct, *by construction, on its own success path.*

**The collection path nevertheless holds — by reachability, not by membership.** JSON decoding
produces `[]any` and `map[string]any`; it produces **neither `[]string` nor `[]map[string]any`**.
So a JSON-decoded input **cannot reach either de-novo arm**, and every arm it *can* reach
(`map[string]any` → `map[string]any`, `[]any` → `[]any`, `default` → passthrough) returns a
structpb-acceptable type.

**Why the distinction is load-bearing and not pedantry.** The stated reason was *"the input value
set is {map, slice, string, float64, bool, nil}, every one of which `structpb` accepts."* That
reasons about the **input**; the value handed to `structpb` is the **output**, and this function
demonstrably does not preserve the input's type set in general. The input-set argument would
survive unchanged if someone added `case string: return []string{tv}, true` — and the closure would
silently break. **The property that actually protects the collection path is "JSON-representable
input never reaches a de-novo arm," and it is one type-switch case away from being false.**
Right conclusion; insufficient reason. Recommend the reachability form be the one recorded.

**A residual I am flagging rather than filing, because I have not settled it.** The
`[]map[string]any` arm is on the **generic** branch, so it applies to any key on any path — and two
adapters build exactly that type into `remote_data`:

```go
rd["sub_issues"]    = subs   // []map[string]any — internal/platform/github/graphql_queries.go:510
rd["dependencies"]  = deps   // []map[string]any — internal/platform/beads/beads.go:454
```

For GitHub this is redundant: XSS-R4-C1's unconditional `labels []string` already nils every passthrough
task. **For `beads` it is not redundant, and `beads` is a second adapter my XSS-R4-C1 never considered** —
any beads task carrying dependencies would nil its whole `remote_data` *if* the adapter map reaches
`structpb` without a JSON round-trip. **I have not established which**, and the in-tree test at
`remotedata_depth_test.go:99` (*"inside a `[]any` of maps, which is how `sub_issues` decodes from
JSON"*) shows the round is aware both representations exist. **Candidate second instance of XSS-R4-C1,
explicitly unmeasured, handed over rather than filed.**

**One thing the tree already settles, in the round's favour and against my own reporting instinct:**
`TestGitHubPassthroughRemoteDataNeverSerialises` does not merely *name* the behaviour — it asserts
`structpb.NewStruct(map[string]any{"labels": []string{"bug"}})` returns an error **and carries a
positive control** that `[]any` succeeds, *"so the failure above is about the value type and not
about NewStruct being broken."* That is a properly controlled in-tree measurement and XSS-R4-C1 rests on
it, not on my recollection of the library. **It also sharpens XSS-R4-C7′ rather than softening it:** the
test's own failure message reads *"structpb.NewStruct now accepts `[]string`. The passthrough path
can therefore ship remote_data"* — the test exists to fire **when the bug is fixed.** A name saying
`NeverSerialises` on a guard whose red state means *the data flows again* is the clearest instance
of the vocabulary problem in the whole round.

**Method note, since it cuts against me.** I could **not** source `structpb.NewValue`'s accepted
type set: the module cache holds `protobuf@v1.36.11` unextracted and `find` located no
`structpb/struct.go` on disk. **That arm returned a null and I am recording it as a null, not as a
negative.** My `[]map[string]any` rejection claim is a derivation from the same type switch the
in-tree test exercises for `[]string` — well-founded, but **one premise of it is unverified tonight**
and a single-line test would close it. I am not requesting a slot for that; it belongs to whoever
takes XSS-R4-C1b.

### `[MEDIUM]` XSS-R4-C2 — the round converts this live bug into a claimed security control, and that is the A7 question in miniature. **INTRODUCED BY THIS DIFF.**

`TestGitHubPassthroughRemoteDataNeverSerialises` is named for the bug and framed as reassurance,
and the `metadata` exemption in the adapter-key scanner **rests on it**:

> `remote_data["metadata"]`: not URL-bearing (… **structpb.NewStruct cannot represent
> json.RawMessage either, so it never reaches the wire at all** (same mechanism as
> `TestGitHubPassthroughRemoteDataNeverSerialises`))

This is my axis exactly — *does a stated mitigation remove the harm it names?* Here a **defect** is
being cited as the mitigation. Three problems, in increasing order of importance:

1. It is **not a control**. Nobody chose it, nobody maintains it, and it is not the reason anyone
   would keep `[]string` un-serialisable.
2. It is **load-bearing for a security exemption**. Fixing the bug — which someone eventually
   will, because it is a bug — silently removes the justification for exempting `metadata`, whose
   contents are an opaque platform blob that has never been walked.
3. It is **the round's own failure mode, reproduced.** The whole reason this round exists is that a
   suite had no executor and everyone read "green" as "checked." Here, "the field never arrives" is
   being read as "the field is safe." **Absence of arrival is not a control; it is a symptom.**

**Recommendation:** rename the test to say what it is (`TestStructpbRejectsAdapterSliceTypes_-
DataLossNotAControl`), and re-found the `metadata` exemption on something a fix cannot remove —
`metadata` is opaque platform JSON with no key contract, so the defensible reason is *"it is never
walked and never rendered; if it is ever serialised it must be walked first."*

---

## A5 — preservation SAFETY, as a standing procedure

**The class of harm on a merged branch.** A probe that weakens a security control, committed as
work, in a diff whose suite is green, is a supply-chain compromise with an insider's provenance
and no attacker. It is worse than an external supply-chain attack in one respect: **it arrives
with a legitimate author, a plausible message, and a passing build**, so every downstream signal
that would flag a hostile commit reads normal. The mutant stranded tonight had *survived* the
suite — meaning the suite is not merely silent about it, the suite **certifies** it.

**Is encoding the warning in the ref NAME sufficient? No, and the residue is specific.** A name
protects only readers who read names. It does not reach: anyone who fetches by SHA (the SHA is in
the log and in three reports); `git log --all` / `git bisect`, which traverse the object graph and
never see a ref name; any tooling that enumerates `refs/preserve/*` and acts on the commits; and
`git cherry-pick`. Use a `git notes` entry **as well** — notes travel with the SHA, not the ref —
and, if the mechanism exists, a signed empty commit on top whose message is the warning.

**The standing procedure, one paragraph, for `em-tooling/`:**

> **Preservation fidelity and preservation safety are different properties, and our procedure
> checks only the first.** Byte-identity between tree and snapshot is exactly the property that is
> preserved when what you captured was poisoned — a fidelity check on a mutant returns "perfect."
> Before preserving any tree that a harness has touched, run `git diff <clean-SHA>` and require the
> diff to be **empty or fully enumerated and individually justified**; never `git status`, never a
> green suite, and never a post-restore worktree check, because the restore has already run and the
> dirty cell may be in the commit rather than the worktree. If the diff is non-empty, the artefact
> is a *specimen*, not a *snapshot*, and must be labelled in a channel that travels with the SHA
> (`git notes`), not only in one that travels with the ref name. The governing rule, which is the
> same rule at three levels tonight — the stranded mutant, the `SCION_WORKSPACE_MODE` stratum, and
> the `asym` pin that absorbed a second defect: **A CONFIRMATION THAT CANNOT DISCRIMINATE IS NOT
> EVIDENCE, AND N OF THEM IS STILL NOT EVIDENCE.** Before trusting any check, state the outcome it
> would produce if the thing you fear were true; if that outcome is the one you just got, you have
> measured nothing.

### `[LOW]` XSS-R4-C4 — the assertion-count pin's kill-list is written against an accident model, and A5 asks for an adversary model. **LATENT.**

`run-tests.mjs:281-291` states plainly what the pin KILLS and MISSES, and the honesty is exemplary.
But `KILLS: deleting an assertion` holds only for **unwitting** deletion. The receipt is a literal
string printed on stdout **by the process under test**:

```js
const receipts = stdout.split('\n').filter((l) => l.startsWith('#assertions '))…
const n = Math.max(...receipts);
```

The harness cannot distinguish *"evaluated 157 assertions"* from *"printed `#assertions 157`."* A
deliberately weakened test file that deletes assertions and hardcodes its receipt defeats the
per-file consumption gate **and** the count pin simultaneously. Under the accident model that is
irrelevant. Under A5's model — a deliberately weakened control committed as if it were work — it is
the whole thing, and it is the one place where this otherwise excellent runner's stated reach
exceeds its actual reach.

`Math.max` over multiple receipts is the specific lever: a file that legitimately emits one receipt
and is edited to emit a second, larger one keeps the higher number.

**Not a defect of this diff and not blocking.** Recommendation: have `assertions.ts` emit the
receipt through a channel the test body does not control (a `process.on('exit')` handler writing to
fd 3, or the runner importing the module and reading the counter in-process), and add one sentence
to the pin's comment: *"this counts what the file REPORTS, not what it evaluated; a file that lies
about its receipt defeats both gates."*

---

## A6 — the security downside if P2cn or P11 is wrong

Both hold; derivations are in `[POST-II]` above. The narrower question the checklist asks is what
it would **cost** if they were wrong, and the two answers are very different.

**P2cn wrong → cost ≈ zero, and the mutant is not the interesting object.** If passing `key`
instead of `""` were *not* equivalent, the divergence would be that a container nested under a
URL-bearing key gets its elements treated as URL-bearing. That direction is **strictly stricter** —
more dropping, more erroring. A mutation that can only tighten a security control is not a security
mutant. **The real exposure is not the mutant, it is the equivalence argument's dependence on
XSS-R4-O3** (the URL-bearing `[]any` arm's early return). It is recorded as structural and it is
contingent. That is the item to fix, and it is a one-sentence fix.

**P11 wrong → this is the one that could cost something, and the checklist asks the right
question.** *"'Redundant' means 'the other guard is total.' Name the partner guard and find the
input where it does not fire."*

- **The partner guard is `validateRemoteDataValue`'s bound at `urlvalidate.go:386.`**
- **Where it does not fire:** `validateRemoteDataURLs` is entered directly, from outside the pair,
  with an already-over-bound depth, on a map whose **iteration yields nothing** — i.e. an empty or
  nil map. Then the loop body never runs, `validateRemoteDataValue` is never called, and its bound
  never fires. That is the divergence the dev leg named, and it is the correct one.
- **It is not exploitable, and the reason is structural rather than lucky:** the only external
  entry is `validateImportedTaskURLs` → `validateRemoteDataURLs(path, t.RemoteData, 0)`, always at
  depth 0. Every deeper entry is from `validateRemoteDataValue`, which has already checked. So the
  input that defeats the partner guard **cannot be supplied**, and it carries nothing anyway.
- **Downside if the redundancy were deleted on a wrong totality claim:** unbounded recursion on a
  cyclic `map[string]any`, i.e. stack exhaustion — a DoS from an in-process caller. Not reachable
  from JSON (which cannot express a cycle). The suite already pins this at
  `TestRemoteDataTraversalsTerminateOnACycle`, and that test is honest about the fact that without
  the bound it does not fail, it **crashes the test binary**. **Keep both bounds.**

**The asymmetry neither the log nor the checklist mentions:** the sanitize side has **one** bound
(`sanitizeRemoteValue`), not two. Sound — that function is on every recursive edge — but "two
bounds, deliberate" describes the import walk only. Say so.

---

## A7 — why round 3 did not find that the guard suite was never executed

This is the deliverable I think is worth the most, so I will state the class rather than the
excuse.

**Round 3 was reviewing a diff. An executor is not in a diff.** Every leg's scope was
`<base>..<head>`, and the missing thing was the *absence* of two lines in a file (`Makefile`) that
the diff did not touch. There is no diff-scoped question whose answer is "and nothing runs this."
Three legs × three rounds × a correct process, all looking at the right artefact, all structurally
unable to see it.

**Four contributing factors, in order of how much each cost:**

1. **The reviewed object and the enforcing object were in different files, and only one was in
   scope.** The guard's *content* was in the diff eleven times. Its *invocation* was in the
   Makefile, which was last touched on 07-21.
2. **Green was available and meant something else.** `make test` passed in every round. It ran
   `go test ./...`. Nobody misread the output; everybody read a true statement about a different
   thing.
3. **There is no CI.** With CI, "which jobs ran?" is a visible artefact and the gap surfaces on the
   first push. Without it, the documented workflow *is* the control, and reviewing the workflow was
   nobody's assigned axis.
4. **The instrument was so elaborate that it read as evidence of its own operation.** A 1594-line
   scanner with arm attribution, positive controls and a directory census does not look like dead
   code. **Sophistication was mistaken for liveness** — and I want to name that, because this
   round's response was to build *more* instrumentation, which reproduces the precondition.

**The missed class, in one sentence:** *no leg's checklist contained the question "what executes
this, and how do I know it ran today?"*

**The remedy, and it is small.** Add one line to every leg brief, above every axis:

> **For every control this diff adds or relies on: name its executor, and name the artefact that
> shows it executed at this SHA. If you cannot name both, that is a finding regardless of the
> control's content.**

That question is cheap, it is axis-independent, and it would have caught this in round 1 in about
ninety seconds. Note that it is **not** the same as "run the suite" — running it proves it runs
*for you*, not that it runs in the workflow. `2f6500f` is the fix; the brief line is what makes the
next one get found.

---

## A8 — CSP, in the one sentence requested

**Yes, substantially — but not the fraction you would expect, and the split matters for
scheduling.** A `script-src 'self'` CSP without `unsafe-inline` neutralises the *payload* of every
`javascript:`-scheme finding this branch is about, because `javascript:` URI execution is governed
by `script-src` — so it would subsume the **consequence** of the entire URL-scheme apparatus at a
fraction of the maintenance cost, and it would do so for sinks nobody has enumerated yet, which is
the property source-scanning can never have. What it would **not** subsume is the half this branch
is actually spending its complexity on: `data:` and `blob:` navigation, the *server-side*
`remote_data` sanitization (a CSP is a browser control and does nothing for MCP, the CLI, export
files, or any future non-browser consumer), and the enumeration property itself — "we know every
`href` sink in the tree" is worth having independently of whether XSS at those sinks would execute.
**My scheduling input: a CSP is higher value per hour than any further investment in the guard
tracer, and it is a complement to the server-side work rather than a substitute for it.**

---

## Amendment, 01:04Z — positive controls on every load-bearing null

Filed under the round-wide rule that **a null result from an instrument is indistinguishable from a
misaimed instrument.** My report is unusually exposed to this: the single fact that caps every
finding in it at LATENT — *"nothing renders `remote_data`"* — **is a null.** So is the consumer
enumeration, so is "no seventh write site", so is "no CI". If any of those instruments was
misaimed, my severities are wrong in the dangerous direction.

I re-ran every load-bearing null with a positive control. All read-only, no toolchain, ~2 minutes
total, no grant needed. **Four held unchanged, one held and got stronger, and one was WRONG.**

| # | null claim | positive control | result |
|---|---|---|---|
| N1 | nothing in `web/src` renders `remote_data` | not a null at all — the probe returns **8 hits**; `unsafeHTML` → 3 files, `href=` → 5, both non-null | **HOLDS**, self-attesting |
| N2 | `docs/url-policy.md` does not exist (XSS-R4-O6) | `ls docs/` returns `architecture.md`, `code-of-conduct.md`, `contributing.md` | **HOLDS** |
| N3 | no `.dockerignore` (XSS-R4-O5) | same listing returns `Dockerfile`, `Dockerfile.server` | **HOLDS** |
| N4 | no CI (load-bearing in A7) | `.github/` **exists**, with `ISSUE_TEMPLATE` and `PULL_REQUEST_TEMPLATE.md`, and **no `workflows/`** | **HOLDS, and stronger** |
| N6 | only two `pb.Task`/`pb.Collection` builders tree-wide | `&pb.` anywhere → **107** matches; the specific pattern → exactly 2 | **HOLDS** |
| N7 | the five unnamed packages don't touch `RemoteData` | same pattern in `internal/server` → **218** matches | **HOLDS** |
| **N5** | **"MCP, CLI, gRPC-web" are the non-web consumers** | — | **WRONG — see below** |

**N4 is worth one extra line** because the control changed the claim's meaning. "No CI" could have
been "no `.github`, nobody has set this repo up yet." It is not: `.github/` exists and is
*populated* — issue templates, a PR template. **Somebody configured this repository's GitHub
surface and did not add a workflow.** A7's finding is not that CI was overlooked in a bare repo; it
is that CI is absent from a repo whose GitHub configuration was otherwise attended to. That makes
"the documented workflow IS the enforcement mechanism" a sharper statement than I filed.

### N5 — my consumer enumeration was a SUMMARY OF COVERAGE, not coverage

This is exactly the defect the broadcast describes via review-194-r11's B4, and I made it in the
strongest positive observation in my report.

I wrote: *"MCP, CLI, gRPC-web"* — three surfaces — and concluded *"the field never gets there."*
**Eight packages import the generated protobuf:**

```
15  internal/cli          <- named
 4  internal/server       <- named (the producer)
 1  internal/mcp          <- named
 1  internal/streaming    <- NOT NAMED
 1  internal/decomposer   <- NOT NAMED
 1  internal/convert      <- NOT NAMED
 1  internal/testutil     <- NOT NAMED
 1  cmd/farmtable-server  <- NOT NAMED
```

**All five unnamed packages have ZERO `RemoteData` / `remote_data` references** (positive control:
the identical pattern returns 218 in `internal/server`). So the *claim* is true. The *enumeration*
was not complete, and "both consumers are fine" read as coverage when it was a summary of the
coverage I happened to have looked at.

**Two consequences, and the first one goes in the round's favour:**

1. **`internal/decomposer` is an LLM package** — `llm.go`, `llm_anthropic.go`, `prompt.go`,
   `prompt_default.txt`. It consumes `pb` and **never touches `RemoteData`.** So the "`remote_data`
   cannot reach an LLM context" observation covers **two** LLM surfaces, not one, and I did not
   know the second existed when I filed it. **The finding is stronger than I wrote it; my method
   was weaker than I claimed it.** Both halves belong in the record.
2. **`internal/streaming/eventbus.go`** forwards `pb` objects. It builds none — N6 establishes only
   two builders tree-wide, both in `convert.go`, both sanitizing — so it can only carry
   already-sanitized objects. That closes it **structurally** rather than by inspection, which is
   the better closure, but I did not have it until I looked.

**And the rule caught an instrument mid-flight, in the exercise designed to catch instruments.**
My *first* attempt at N5 grepped for the import path `farmtable/gen/proto|/gen/go/`. It returned a
single line — `api/farmtable/v1` — which is the protobuf package itself, not an importer of it.
**A near-null from a wrong pattern, and it looked like a plausible answer:** "one package consumes
the proto" is a sentence I could have written without blinking. What caught it was the positive
control I had queued in the same command — printing the actual import line from a file I *knew*
imports it — which read `github.com/farmtable-io/farmtable/api/farmtable/v1` and did not match my
pattern. **The correct pattern returned 46 files across 8 packages.** One grep, one typo'd path
fragment, and a five-package blind spot that reads as a finding. I am recording it because the
broadcast asks for evidence the rule is worth its cost, and this is the cheapest possible
demonstration: the control cost nothing and it fired on the first null I tested.

**XSS-R4-C6 widens accordingly:** I recommended widening `TestEveryRemoteDataWriteSiteSanitizes` from
`internal/server` to `internal/`. That recommendation is unchanged and now has a second
justification — a `WalkDir` over `internal/` is also the thing that would have made *my*
enumeration complete without my having to be exhaustive by hand.

### N8 — the `-run` filter exposure, in my own two rows

A `-run` regex matching no test exits 0 and prints `ok`, byte-identical to a passing suite. Both my
rows used `-run`.

- **G-4: RED (exit 1), with 8 failure messages quoting my wrapper's title.** A filter that matched
  nothing cannot produce a failure, and cannot emit a string that exists only in my edit.
  **Immune, twice over.**
- **G-5: GREEN (exit 0) — the exposed shape.** It is nonetheless safe, because I ran it with `-v`
  and the output carries the scanner's **verbatim census**: `html_url, remote_url` at top level and
  fourteen named nested keys. A vacuous filter prints `ok` and *no census*. The evidence that the
  test executed is **inside the result**, which is the self-attesting idiom the round has now
  adopted.

**But I will say plainly how I got it, because two other legs said the same and it is the useful
part: I ran `-v` because I wanted to read the census, not because I was controlling for
vacuity.** The control was a by-product of wanting the data. Had G-5's assertion been a bare
pass/fail rather than a printed enumeration, I would have filed "GREEN, the nested rule is dormant"
off an exit code, and a typo in the test name would have produced exactly the same line in my
report. **P7 — the prediction that sets XSS-R4-O1's severity at Medium rather than higher — would have
been "confirmed" by an instrument that never ran.**

**Standing consequence for my own practice, offered because the fix is free:** prefer an assertion
that *prints what it examined* over one that returns a verdict. A test that emits its census makes
every consumer of its green — including a reviewer three rounds later who cannot re-run it —
immune to the vacuous-filter failure, at the cost of one `t.Logf`.

---

## Amendment, 01:12Z — pending-queue audit, blindness audit, and transcript-verified tag ordering

Filed under broadcast 3. Three checks, all read-only, no toolchain, no grant.

### Hazard A — my pending run queue is EMPTY, so I applied the rule to my CITATIONS instead

I have no queued runs: G-4 and G-5 executed, R3 was served by artefact, and I declined the offered
RED. So the "unaimed instrument sitting in the queue" hazard has nothing to bite on in my case.

**But a report has the same surface, and it outlives the queue.** Every test name I cite is an
instrument aimed by a future reader — the exact shape of review-194-r11's near-miss, where a
docblock was about to be reported as naming a pin that does not exist. So I checked every test name
in this document against the tree.

**Result: 7 of 7 real test names exist.** `TestSanitizeAndImportAgreeAtEveryDepth`,
`TestEveryRemoteDataWriteSiteSanitizes`, `TestRemoteDataKeysWrittenByAdaptersAreClassified`,
`TestGitHubPassthroughRemoteDataNeverSerialises`, `TestNestedURLReachesTheWireWithoutRecursion`,
`TestRemoteDataTraversalsTerminateOnACycle`, `TestValidateImportedTaskURLsReachesNestedCarriers` —
all present. Positive control: an invented name fed to the same checker was correctly reported
missing.

I also verified the one test-name fact I **inherited rather than measured** — Part I's flake note,
which I repeated as *"`TestWatchTasks_*` is not in either selection."* It exists: **10 tests in
`internal/server/watch_test.go`.** They live in the same package I ran, and my claim was about the
`-run` *selection* rather than the package, so it holds — but I had been repeating it on Part I's
authority, and the round has already been bitten once by inherited line numbers.

**And the extractor was misaimed — second one I have caught in two exercises.** My first pass
reported seven "missing" tests. All seven were artefacts: this report **line-wraps long test names
with a hyphen**, so `grep -o 'Test[A-Za-z0-9_]*'` harvested truncated fragments
(`TestRemoteDataTraversals`, `TestGitHubPassthroughRemote`, …), plus the English word "Tested",
plus a fragment of the JavaScript function `requireTestConfigGlob()`, plus my own *proposed* rename
which is not supposed to exist yet. Unwrapping the file first resolved all seven. **A checker that
reports seven fabricated defects is exactly as broken as one that reports none**, and only
hand-adjudicating every hit distinguished them.

### Hazard B — ZERO reads. Measured from my own transcript, not recalled.

The new rule is that a partial read is a **deferred full exposure**, so the only safe posture
toward a document I must stay clear of is *no read at all*. I audited every file access of this
session.

**Positive control on the audit itself:** the transcript is 552 lines / 2.0 MB and spans the whole
session including pre-compaction — the Part I read appears at line 8. So the query is looking at
the full history, not just the rehydrated tail.

- **Every `file_path` I ever passed to a tool, deduped: 19 paths.** My own report (17 accesses), six
  in-scope `/workspace` sources, five of my own scratch messages, four brief/baseline documents, and
  the two consumed artefacts. **No sibling leg's report appears at all.**
- **Every Bash command, grepped for sibling-report paths: zero matches.** Positive control on the
  same file with the same tool: `reports` appears in 6 commands, so the pattern class fires.
- **Eight reads used `offset`/`limit`.** All were against my own report, in-scope `/workspace`
  sources under review, or `url-binding-scan.test.ts` — files I am *required* to read. **No limited
  read touched anything I was meant to stay blind to,** so Hazard B has no purchase here.

**I never used the "grep the headings first" idiom on a withheld document either** — the corollary
that caught audit-194-r11. Not by foresight: the checklist arrived by message, so I never needed to
navigate it before I was allowed to have it. **Luck again, and I would rather say so than let the
clean result imply a discipline I did not exercise.**

### The by-product: my tag attributions are now transcript-verified rather than asserted

`[OPEN]` / `[POST-II]` / `[CHECKLIST]` are claims about *ordering*, and until now the only evidence
for them was my say-so. Transcript line numbers, distinguishing an actual `tool_use` from a mere
mention of a filename (the first cut of this query conflated them and put Part I at line 4, which
is the dispatch message naming the file, not a read):

| event | transcript line |
|---|---|
| Part I (`_xss-r4-baseline-block.md`) **read** | **8** |
| **`[OPEN]` pass written to disk** | **165** |
| Part II (`_xss-r4-method-block.md`) **read** | **193** |
| Checklist **read** | **258** |

**The mandated ordering holds, and it is now a measurement.** The one contamination I already filed
against my own `[OPEN]` pass stands unchanged and is not an ordering problem: Part I itself contains
targeting at `:126-129`, which no ordering discipline can undo.

### One more self-caught error, in the check itself

My first blindness query ended `grep … | head; echo "exit=$?"` — **which reports `head`'s exit
status, not `grep`'s.** It printed `exit=0` and I labelled it "clean" when 0 from `head` means
nothing at all. That is *my own stated rule*, from the run-reporting protocol, violated inside the
audit written to catch violations. Redone without the pipe; the result was genuinely clean, but it
was clean for a reason the first command could not have established.

---

## Amendment, 01:20Z — the unquoted glob, the write arm, and filing a derivation backwards

Broadcasts 4 and 5. Four checks; **three found broken apparatus, and no conclusion moved.**

### 1. I used the unquoted `--include` twice, on two real sweeps. Both aborted LOUDLY.

Measured, not recalled — recovered from my transcript with a **correct JSON parser** (see §3):

```
grep -rn "RemoteData" --include=*.go .                          <- A2 pass 1
grep -rn "remote_data\|remoteData" --include=*.ts --include=*.js web/src web/scripts   <- N1
```

Both are load-bearing: the first is my write-site coverage claim, the second is **the governing
reachability fact that caps every finding in this report at LATENT.**

**Re-ran the unquoted form to see what it actually does here:**

```
(eval):4: no matches found: --include=*.go      # zsh 5.9, nonzero exit, NO OUTPUT AT ALL
```

**The command dies. It does not return a plausible zero — it returns nothing and says so.** So both
of mine were caught at the time and re-run quoted, which is why my report has numbers in it at all.
**Same escape as audit-194-r11: I was saved by the shell not being bash.** Under bash both would
have returned silence, and N1's silence would have read as *"nothing in `web/src` touches
`remote_data`"* — which is the conclusion I wanted, arriving as a fabricated zero. I would have
filed it. The only reason I am not reporting that tonight is the interpreter.

### 2. The re-run does not reproduce my filed count. 63 → **102**.

| exclusion | lines |
|---|---|
| raw `--include='*.go'` | 434 |
| in `*_test.go` | 180 |
| in `internal/store/ent/` | 146 |
| in `*.pb.go` | 6 |
| **after my three stated exclusions** | **102** |

I filed 63 and said I read them individually. **There are 102, across 12 files, and two of those
files are never named anywhere in this report:** `internal/platform/github/testing.go` and
`internal/store/store.go`.

**Both are benign, checked by hand:** `testing.go`'s two hits are inside a *comment* describing this
very fix; `store.go`'s six are **struct field declarations** (`RemoteData map[string]any`) in the
storage DTOs — type definitions, not writes. **No seventh egress or ingress site.** The conclusion
stands and the number under it did not.

### 3. And my 01:12Z blindness audit ran on a truncating extractor

`grep -o '"command":"[^"]*"'` **stops at the first escaped quote inside the command**, so every
command containing a quoted string was chopped at its first `\"`. That is why the `--include` search
in my first attempt returned zero *with its positive control also returning zero* — the string
`--include` had been truncated out of every command before the search ever ran. **A fake zero
produced by the instrument I built to hunt fake zeros.**

Re-done with a real JSON parser: **89 Bash commands recovered, 48 `--include` occurrences, 42 of
them correctly quoted, 3 unquoted (one of which is the broken audit command itself).** My earlier
"zero sibling-report hits" conclusion **held** on re-measurement — but it had been established
against truncated text and was worth nothing until now.

### 4. Route 6 — clean, and my earlier check could not have found it

The recursive-grep-over-`reports/` route is invisible to a filename search, because **a command like
`grep -rn "X" reports/` contains no sibling's filename.** My 01:12Z check grepped for sibling
filenames, so it was *structurally incapable* of detecting the route the broadcast describes. Redone
by printing **all 11** commands that touch `reports/` or `.design/` in full and reading them:

- 3 × `ls` of the reports directory (filenames only, no bodies)
- 1 × my own `scion message`, which merely contains my report's path in its body
- 2 × `sed -n` over `.design/project-log/url-scheme-validation-r4-fix-round.md` — **the in-tree log,
  which is part of the artefact under review and explicitly in scope**
- 5 × greps scoped **by name to `audit-xss-r4.md`**, my own file

**No recursive grep over `reports/` at any point. No `-r` and no directory target anywhere near it.**
That is now a fact established by reading every command, not by pattern-matching for names.

### 5. Broadcast 5's write arm — examined, and clean on both arms

The corrected exposure set is *files touched by any tool, read **or written***. My 01:12Z answer
enumerated reads only. Re-run separating tool names:

- **20 distinct paths touched. 9 written.** My own report; seven of my own scratch message files;
  and one `Edit` to `remotedata_depth_test.go` **inside `/var/tmp/scratch-audit-xss-r4/r1`**, my
  private copy.
- **`/workspace` files written: NONE.** My independence claim — "do not modify production code" —
  is now a measurement on the write arm, not only a green `git diff`.
- **Sibling-report paths touched by ANY tool, read or write: NONE.**

On the coordinator's shared-volume hypothesis, labelled as theirs and unmeasured: my only write to a
shared volume is my own report, which no other leg has reason to edit. Nothing to re-scope. **And I
accept the framing that blindness is not achievable by leg discipline alone — the proximity-inlining
arm is not mine to control, so what I can honestly report is "I did not touch it," not "it never
reached me."**

### 6. The one that actually improves the report: I filed a derivation backwards

Broadcast 4's closing rule — *when a run and a derivation agree, the derivation is the finding and
the run is a control on the derivation* — lands on my two strongest results, and I had both the
wrong way round.

**(a) The six-site enumeration never needed a grep count.** It follows from **N6**, which is a
derivation: `remote_data` can only cross a trust boundary at a proto build or an export-document
build; there are exactly **two** `&pb.Task{` / `&pb.Collection{` constructions tree-wide, both in
`convert.go`; the export writer is `export_import.go`. Everything else the sweep surfaces is
adapter-internal map construction (upstream of sanitization) or store persistence (downstream of
it). **That argument is untouched by the count being 63 or 102 or wrong**, and it is why the
conclusion survived a 39-hit error in its stated basis. I led with the sweep because the sweep felt
like evidence. The sweep is a *control on the derivation*.

**(b) My headline finding is derivable with no run at all, and I should have said so.** Here it is
in full, from source only:

> `sanitizeRemoteValue`'s URL-bearing `[]any` arm drops non-string elements. Its counterpart in
> `validateRemoteDataValue` accepts them. Therefore any container under a URL-bearing key is
> **dropped and not errored**. The `asym` pin asserts exactly `dropped=true, errored=false`.
> **Therefore the pin's condition is satisfied by the second disagreement class.** ∎

No test executes in that argument. **So G-4 could not have falsified it, my probe's landing does not
matter to it, the overdetermined `asym` cell does not matter to it, and none of tonight's five
apparatus hazards can reach it.** G-4 remains valuable — it produced the four silently-deleted clean
rows, which are a *different* finding and genuinely empirical — but the absorption claim was proved
before I ever asked for a slot. **Filed backwards, corrected here, and the correction makes it the
most robust thing in the report rather than the most instrument-dependent.**

### 7. `sanitizeRemoteData` is a fifth misnomer, and this one is in production code

Under the standing "the name is the specification" rule. **"Sanitize" names a repair; this function
performs a deletion**, and by XSS-R4-O3 it deletes *whole well-formed subtrees* on inputs where nothing
is wrong — the four clean rows G-4 surfaced. A maintainer reading `clean := sanitizeRemoteData(rd)`
has no reason to suspect `clean` may be missing keys that were valid. **This is not cosmetic: it is
the precise reason the export round-trip corrupts, and the reason `TestGitHubPassthroughRemoteData-
NeverSerialises` could be mistaken for a control.** Two of tonight's misnomers are in this one
file's vocabulary. **Recommendation:** `dropUnsafeRemoteData`, or keep the name and add one line —
*"drops keys it cannot validate; the returned map may be smaller than the input in ways the caller
is not told about."* `[INFO]`, filed as XSS-R4-C7. **Superseded by XSS-R4-C7′ in the 01:28Z amendment below,
which consolidates it with the other two lying names into a single finding.**

---

## Amendment, 01:28Z — Broadcasts 6 and 7: the pointer audit, the write-arm hole, and the claim I could not evidence

Nine checks. **Two instruments found broken, one of them mine and load-bearing; one technique the
round is currently mandating found to have a hole; zero conclusions moved.** Verdict unchanged.

### 1. The pointer audit — I had exactly one, and it has silently rotted

Broadcast 7: *"Any file:line into `briefs/` or `reports/` is suspect. If the claim rests on a
pointer rather than a quote, PASTE THE TEXT IN NOW."*

I have **one** such pointer in this report. Line 776: `` `_xss-r4-baseline-block.md:126-129` ``,
cited as the source of my Part I targeting finding. It is the worst possible case, on three counts.

**(a) It still resolves — to different text.** Target file today:
`mtime 2026-07-29T00:27:28Z · 424 lines · sha256 44f462f71ed9c7ac…`. Lines 126-129 verbatim, now:

> an adapter-key source scanner, a guard tracer, an assertion-count pin, and the test-runner
> wiring that makes them execute. The round changed instruments. **The dev leg's own account
> is in the in-tree project log; treat every sentence in it as a claim, not as a finding.**

That is the *tail of the corrected paragraph plus a blank line*. It is off by one at the head — it
misses line 125, which carries the phrase the citation exists to point at — and, far worse, the
paragraph now reads **"five instruments."** My finding was *about* the version that said **two.**

**(b) A reader following my pointer would conclude I fabricated the finding.** The text at the
cited lines does not merely fail to support my claim; it states the opposite and states it
correctly. This is the failure mode Broadcast 2b named for null results, arriving instead as a
*false* result: the pointer produces no error, no absence, no signal that anything moved — just
plausible, topical, contradicting prose.

**(c) The original text is unrecoverable, and the volume's version control is a decoy.**
`/scion-volumes/scratchpad` **is** a git repository — 22 commits, `HEAD 2c339df 2026-07-28
01:50:20Z` (positive control: `git log` returns those 22, so the query works). But
`git ls-files --error-unmatch briefs/_xss-r4-baseline-block.md` → **UNTRACKED**; `git status
--porcelain` on that path → `?? …/_xss-r4-baseline-block.md`; commits touching it → **0**. HEAD
predates this entire round by a day. **Every brief and every report tonight sits outside the
repository that is sitting right there.** So there is no `git show` for the sentence I cited. I
searched: `two of the five instruments` occurs exactly **once** in the file, at line 131, and that
occurrence is *inside the EM's own 00:27Z disclosure block* — a description of the deleted text,
not the text.

**The honest statement of my Part I targeting finding is therefore now:** it rests on a document I
read, cannot re-quote, and can no longer produce. It survives only because the EM chose to record
the correction in place rather than patch it quietly. **My citation was rescued by someone else's
disclosure discipline, not by mine** — the same shape as zsh rescuing my unquoted globs. Third time
tonight.

**`[CHECKLIST]` XSS-R4-C8 `[INFO]` — one command fixes this for every leg, permanently.** The volume is
already a git repo. `git -C /scion-volumes/scratchpad add briefs/ reports/ && git commit` at
dispatch, and pointers become `<sha>:<path>:<line>` — content-addressed, and recoverable when the
head moves. **The generalisation of Broadcast 7's rule is not "quote instead of pointing."** It is:
**A POINTER IS SOUND IFF ITS TARGET IS CONTENT-ADDRESSED.** That is exactly why my ~40 `file:line`
citations into `/workspace` are *not* exposed and I am not retracting them: not because they are
source code, but because I published the SHA (`e6bda71`) and verified `git diff e6bda71` = 0. The
same pointer syntax is sound on one volume and unsound on the other, and the discriminator is
versioning, not file type.

*(The second brief I have quoted from, `_xss-r4-method-block.md` — `mtime 2026-07-28T23:58:08Z ·
125 lines · sha256 8dd9ab3924113b94…` — I cited by content, not by line, and re-reading 43-46
returns the `-count=1` flake arithmetic exactly as I characterised it. Intact, and intact by luck
of format rather than by choice.)*

### 2. "GO FIND YOURS" — XSS-R4-O2 was filed on 43% of the file it is about

Broadcast 7's closing charge: *every rule tonight hardens instruments you run; none touches a claim
you inherited.* Mine is **XSS-R4-O2**, and the defect is not an inherited sentence but an
under-evidenced one of my own.

XSS-R4-O2 says the guard tracer's `ALLOWED` table contains entries whose stated security reason **no
arm enforces**. When I filed it I had read `url-binding-scan.test.ts` lines 1-380 and 1290-1594 —
**905 of 1594 lines, 57% unread.** My claim was universally quantified over a file I had seen
sixty percent of. *"I did not see an enforcement arm"* is a null result from an instrument aimed at
part of the target — Broadcast 2b's rule, applied to reading rather than to running.

Closed properly, on primary text. Every reference to `ALLOWED` across all 1594 lines: declaration
`:243`; comments `:911`, `:1120`, `:1345-1348`; consumers `:1407` (findings not in ALLOWED),
`:1426`/`:1430`/`:1434` (stale/ambiguous entry checks), `:1444`. **The sole `viaSafeHref`
enforcement arm is `:1444`** — `for (const a of ALLOWED.filter((x) => x.viaSafeHref))`. Nothing
hides in the region I had not read. The table itself, `:243-268`, verbatim:

```ts
const ALLOWED: readonly Allowed[] = [
  { file: 'components/inspector/ft-inspector-code.ts',
    reason: 'href comes from safeHref(), which allow-lists http/https.',
    viaSafeHref: true },
  { file: 'components/inspector/ft-inspector-meta.ts',
    reason: 'href comes from safeHref(), which allow-lists http/https.',
    viaSafeHref: true },
  { file: 'components/ft-toolbar.ts',
    reason: 'url is built from the literal prefix https://github.com/ plus a remoteId already
             matched against GITHUB_REPO_RE, so the scheme is not attacker-controlled.' },
  { file: 'components/ft-toolbar.ts',
    reason: 'url is a locally minted blob: URL from URL.createObjectURL, for a download.' },
];
```

**Two of four entries carry `viaSafeHref: true`. The two `ft-toolbar.ts` entries carry no flag, and
therefore no arm.** What `:1426-1434` verify for them is only that the quoted *line text* still
exists in the tree. Their reasons are load-bearing security claims — "matched against
`GITHUB_REPO_RE`", "a locally minted `blob:` URL" — and a change that made either false while
leaving the line byte-identical (re-pointing the variable feeding `url`, loosening
`GITHUB_REPO_RE`) leaves the tracer **green**. XSS-R4-O2 holds, at the severity filed.

**The result held; the method did not.** Consistent with tonight's base rate, and it is the seventh
instrument of mine to fail a check without moving a conclusion.

### 3. The write arm sees TOOL writes. It does not see SHELL writes. — a hole in the technique now being mandated

Broadcast 6 requires the write arm for the restore proof, *"because it is causal: it proves there
was only ever one thing in `/workspace` to clean."* I ran it, and then ran it against myself.

Parsed all **96** Bash `tool_use` records with a JSON parser (not `grep` over raw JSONL, per
Broadcast 6). **35 contain write-capable constructs.** Exactly one targets `/workspace`:
`/workspace/.__audit_probe_canary__` — my own disclosed canary, created with `touch` and removed in
the same command.

**That canary is invisible to the write arm.** It was never a `Write` or `Edit`; no `file_path`
ever carried it; it appears in *zero* file-event records. Had I created it and not removed it, the
`tool_use` write arm would have reported `/workspace FILES WRITTEN: NONE` — **truthfully, and
wrongly.** The arm's domain is the tool surface; `Bash` is a hole in that surface wide enough to
drive `>`, `tee`, `sed -i`, `cp`, `mv`, `install`, and `git checkout` through.

**Recommendation to the round, offered as a correction to a technique currently being mandated:**
the write arm needs **two** passes — file events *and* a parsed sweep of Bash commands for
write-capable constructs — and the honest claim is *"no tool wrote and no shell command targeted
`/workspace`."* I make that claim; I could not have made it from the mandated arm alone. **I found
this by aiming the technique at the one write I knew existed**, which is the only reason it
surfaced: had I not planted a canary earlier for an unrelated purpose, this arm would have returned
a clean, complete-looking, unfalsifiable zero. *A control you keep is worth more than the question
you built it for.*

### 4. Restore proof, by enumeration and on both arms

- Tool writes to `/workspace`, entire session, all tools: **zero.**
- Shell writes to `/workspace`: **one**, the disclosed canary, removed in the same command.
- `git diff e6bda71 --stat` → **0 lines.**
- `git status --untracked-files=all --porcelain` → **0 lines**, with a live control: `touch` a
  probe → **1** line; `rm` → back to **0**. The instrument demonstrably fires. *(`-uall` because
  `git diff` is blind to untracked files — hazard shape #1 from tonight's taxonomy.)*

**Causal form, as required:** there was only ever *one* thing in `/workspace` to clean, it was mine,
it was disclosed, and it is gone. Not "the tree looks clean."

### 5. The ordering table, rebuilt from `tool_use` records only — and it was right by luck

Broadcast 6 forbids building ordering tables from string matches; my 01:12Z table was built exactly
that way. Rebuilt from file-event records alone (**43** recovered, as a positive control that the
parser sees file events at all):

| Event | `tool_use` line | 01:12Z string-match line |
|---|---|---|
| Part I brief READ | 8 | 8 |
| `[OPEN]` pass WRITTEN | 165 | 165 |
| Part II brief READ | 193 | 193 |
| Checklist READ | 258 | 258 |

**Identical. Mandated ordering holds, on the sound instrument.** And I want the unflattering half on
the record: the first table was built with the forbidden method and happened to agree. It agreed
because the string in question — a file path — appears in this transcript almost only in file
events. **That is a property of the corpus, not of my method**, and one badly-chosen search term
would have broken the coincidence. I would have filed the same table with the same confidence.

### 6. Glob classification per Broadcast 7(b) — both of mine are the UNSOUND class

*A nullglob abort is sound iff the glob's non-match is itself the proposition under test.* Applying
it rather than blanket-retracting:

| Sweep | Glob's non-match means | Class |
|---|---|---|
| A2 `grep -rn RemoteData --include=*.go .` | "no file named literally `*.go` in CWD" | **UNSOUND** — unrelated to whether `RemoteData` appears |
| N1 `grep -rn remote_data --include=*.ts web/src` | same | **UNSOUND** — unrelated to whether `web/src` renders it |

Neither glob's failure is the question. Both were re-run quoted; both conclusions stand on the
quoted runs. **No sound-class exception applies to me** — I claim none.

**Hand-adjudication of my own detector, per Broadcast 6.** It reported **3** unquoted `--include`
occurrences. Adjudicated one by one: **2 real** (above), **1 false positive** — it matched
`--include=[^` appearing *inside a quoted grep pattern*, i.e. text I was searching *for*, not an
argument I passed. That is the same class as `test-194-r11`'s Go-pointer-syntax false positive, and
the second time tonight a detector I built has manufactured a defect. **A misaimed instrument
produces false positives exactly as readily as false negatives**, and only reading every hit tells
them apart.

### 7. XSS-R4-C7′ `[INFO]` — consolidating three lying names into one finding

Per `test-194-r11`'s reasoning that at three instances it stops being three nits and becomes a
pattern, XSS-R4-C7 is withdrawn as a standalone and refiled as **XSS-R4-C7′: the `remote_data` vocabulary
systematically names an intent the code does not implement.**

| Name | What the name specifies | What the code does |
|---|---|---|
| `sanitizeRemoteData` | a repair | a **deletion** — silently drops whole well-formed subtrees (XSS-R4-O3) |
| `urlBearingRemoteDataKey` | a property of URL-bearing content | tests only the **key name**; never inspects a value |
| `TestGitHubPassthroughRemoteDataNeverSerialises` | a control asserting a safety property | **describes a bug** (XSS-R4-C1) and is mistakable for the control |

**Why one finding and not three:** individually each is a rename. Together they are the reason four
of this round's stated mitigations read as stronger than they are — a reviewer who trusts the
vocabulary concludes data is repaired, that URL *content* is inspected, and that non-serialisation
is *intended*. **All three are wrong in the same direction: they overstate the safety of the
mechanism.** That is a pattern with a severity, not three cosmetic defects.
Severity stays `[INFO]` on code correctness; the recommendation is a naming pass, not a behaviour
change. `[CHECKLIST]`.

### 8. No queued runs to withdraw

Broadcast 7 asks legs to withdraw runs justified as upgrading a derivation. **My queue is empty and
has been since G-5**: G-4/G-5 executed, R3 consumed as `test-xss-r4`'s artefact, the offered RED
declined. Nothing to withdraw. The one run I *would* have asked for — a probe of the tracer's
enforcement arms — was made unnecessary by §2, which is Broadcast 4's rule working as intended:
**the derivation replaced the run rather than being confirmed by it.**

### 9. My own report is in my re-hydration set

Broadcast 7(a). Noted, and it has teeth here: this file is ~2,250 lines on a shared volume, small
enough to be re-hydrated whole. I cannot claim my later reasoning was uncontaminated by my earlier
conclusions — nobody can, from inside. What I can evidence is that **every conclusion in the
`[OPEN]` pass was written before line 193 of the transcript**, per §5. *I did not touch it* is a
measurement. *It never reached me* is not, and I will not phrase it that way.

### Net

**No severity moves. No finding added or withdrawn** except XSS-R4-C7 → XSS-R4-C7′ (consolidation) and XSS-R4-C8
`[INFO]` (commit the briefs volume). **Verdict stays: REQUEST CHANGES, zero LIVE XSS findings.**
Seventh, eighth and ninth self-caught instrument defects of the night. My base rate now stands at
**nine instruments checked, nine broken, zero conclusions moved** — which is either a very good
sign about the conclusions or a very bad one about how much the instruments were ever contributing.

---

## Amendment, 01:36Z — Broadcast 8: the reporting channel, the empty-directory channel, and the claim no source derivation can touch

### 1. My first send DIED, and the thing that saved it was an unrelated defect

Broadcast 8's backtick hazard fired on me, at my **most important message of the night** — the
`[OPEN]` pass filing, transcript line 178, sent inline rather than through a quoted heredoc. It
failed: `Exit code 1 · (eval):39: unmatched "`. I caught it and re-sent through
`"$(cat file)"` at line 188, and every one of my nine subsequent sends used that idiom. So the
dispatch rule *"if your message ever fails, STOP and retry"* was obeyed.

**But the reason it failed is not the reason it should have failed, and that is the finding.** The
message body contained exactly **one** backtick-delimited fragment, which zsh would have evaluated
as a command substitution:

```
`https://github.com/${remoteId}`
```

That is a markdown code span from my **XSS-R4-O2** discussion of `ft-toolbar.ts`. It is also **valid
shell.** It would have run — `${remoteId}` expanding to empty, `https://github.com/` failing as
command-not-found — and substituted **the empty string** into the transmitted body. What actually
killed the send was an **unbalanced double quote elsewhere in the same message**, at character
offset 39, wholly unrelated to the backtick.

**Had my prose happened to be quote-balanced, the message would have been delivered with XSS-R4-O2's
central example silently deleted from the sentence that explains it** — the URL-construction
example being the entire reason that entry is in the report. And it would have been undetectable
from my side: **the file on disk would still read correctly.** The corruption exists only in the
channel.

`test-xss-r4`'s instance died on a syntax error and lost only a message. **Mine carried a
syntactically valid fragment and was saved by an unrelated typo.** That is the stronger form of
Broadcast 8's warning, and it is measured, not hypothetical.

### 2. The echo-header effect had no purchase on me — for a reason that is chronology, not discipline

Broadcast 8 item 4: *an echo header captions whatever appears beneath it, including an error.* I run
captioned batches constantly, so I went and re-read the ones whose captions promised nothing. My two
glob aborts are at transcript lines 41 and 43:

```
L40  grep -rn "RemoteData" --include=*.go . | grep -v "_test.go" | …
L41  (eval):1: no matches found: --include=*.go
L42  grep -rn "remote_data\|remoteData" --include=*.ts --include=*.js web/src web/scripts …
L43  (eval):1: no matches found: --include=*.ts
L45  grep -rn "RemoteData" --include="*.go" . | …          <- re-run, quoted
L47  grep -rn … --include="*.ts" --include="*.js" --include="*.mjs" …   <- re-run, quoted
```

**Both were caught inside one command, and my filed account of that is confirmed.** But the
mechanism was not vigilance: **neither command had an echo caption.** They are bare greps from my
opening reconnaissance, before I adopted the captioned-batch idiom the one-slot policy encourages.
The error printed with **nothing above it telling me what to expect**, which is exactly the
condition Broadcast 8 identifies as necessary. By the time I was captioning (from line 308 on) I was
already quoting my globs. **The two hazards missed each other by chronology.** Fourth
saved-by-circumstance of the night.

**Refinement offered, since the round is now full of captioned batches.** The caption rule needs the
same shape as the 7(b) glob rule: **an error beneath a caption is sound iff the error IS the
proposition, and unsound iff the caption asserts a null that the error merely failed to disprove.**
My own N3 is the sound kind and I want it classified rather than swept up:

```
=== N3: .dockerignore absent (XSS-R4-O5) ===
ls: cannot access '.dockerignore': No such file or directory
```

The error *is* the evidence there. Contrast `test-xss-r4`'s, where the caption asked a question and
the error answered a different one. Same idiom, opposite epistemic status, and only reading the
error tells them apart.

### 3. Glob re-classification under the corrected 7(b): one of mine is a multi-glob command

Broadcast 8 item 2 requires re-checking glob **count**. Doing so:

| Sweep | Globs | Under corrected rule |
|---|---|---|
| A2 `--include=*.go` | **1** | unsound class (already filed) — unchanged |
| N1 `--include=*.ts --include=*.js` | **2** | unsound class, and now **doubly** so |

N1's abort at line 43 names `*.ts` only: **`--include=*.js` was never evaluated.** So even the
abort proved less than I said it proved. No conclusion moves — I had already classified both as the
unsound class and both conclusions rest on the quoted re-runs — but the corrected rule is right, and
it bites me. **A detail that makes the point sharper:** when I re-ran N1 quoted I *added*
`--include="*.mjs"`. The original command could not have seen `.mjs` files at all, on top of never
reaching `.js`. **The unquoted form was wrong in three independent ways and reported none of them.**

### 4. The sixth channel — run, with a control. Clean.

All three of my mandated restore checks are structurally blind to an abandoned `mkdir`. Run
directly:

- `find /workspace -type d -empty` (excluding `.git`, `node_modules`) → **0**.
- Control: `mkdir /workspace/.__b8_emptydir_canary__` → **1**; `rmdir` → **0**. The instrument fires.
- `git clean -nxd` → **2** entries, `web/dist/` and `web/node_modules/`, both pre-existing ignored
  build output. I have run **no build and no `npm install` at any point**, and zero builds since
  G-5; neither is mine. *(`web/dist` in a clean checkout is the A8-fenced defect, not my finding.)*

**Relative-path mutating commands — Broadcast 8's second item-6 hazard: zero.** Every mutating
command I issued used an absolute path, including the canary
(`/workspace/.__audit_probe_canary__`) and my single `Edit`, which was inside
`/var/tmp/scratch-audit-xss-r4/r1`. The harness's silent cwd reset — which I observed directly
tonight, `Shell cwd was reset to /workspace` — never had a relative target to act on.

**And my detector produced its third self-match.** The relative-path sweep flagged eight "hits"
inside transcript lines 652 and 733: those are **the source code of the detectors themselves**,
matching their own regex alternations. Likewise the item-1 sweep reported *ten* `scion message`
commands; one is `b8audit.py` containing the literal string `"scion message"`. **Nine real sends,
not ten.** Hand-adjudicated, per Broadcast 6. That is now three instruments of mine tonight that
manufactured defects out of their own text — the `--include=[^` case, and these two. **A detector
that greps a transcript will always find itself in it**, and it is not a curiosity: every one of
these would have inflated a compliance count in my favour.

### 5. Items 5 and 9 — independently derived here before the broadcast landed

Recorded for convergence rather than credit, since agreement across legs is the only external check
any of us has:

- **Item 5 (the Write/Edit census is blind to the shell).** §3 of the 01:28Z amendment, above,
  reaches the identical conclusion from my own `touch`-created canary. **Four legs now, by four
  different probe-placement mechanisms** — `cp`, Python-inside-Bash, `touch`, and
  `test-194-r11`'s Write tool (sound only by accident of mechanism). That is no longer a hazard, it
  is a property of the tool surface.
- **Item 9 (a `file:line` is meaningless without the SHA it resolved against, source included).**
  §1, above, states it as *a pointer is sound iff its target is content-addressed*, and explicitly
  extends it to source: *"the same pointer syntax is sound on one volume and unsound on the other,
  and the discriminator is versioning, not file type."* My report already names `e6bda71` at the top
  and I have verified `git diff e6bda71` = 0 throughout. **The EM's near-miss on `convert.go:534` is
  the empirical demonstration my section lacked** — and note that the failure it describes is a
  *false positive against a leg*, which is the direction this class keeps firing in tonight.

### 6. Item 8 — my inherited claim, ranked by the severity it carries

The general result is that the soft claims are the ones **no source derivation can settle**. Ranking
mine that way puts a different claim at the top than my "GO FIND YOURS" answer did, and it is the
most load-bearing sentence in the entire report:

> **`[LATENT]`, not `[LIVE]` — "nothing consumes `remote_data`."**

**This single claim is why I filed zero LIVE XSS findings.** Every severity in this report is capped
by it. I established it thoroughly *over the source tree*: nothing in `web/src` renders the field,
MCP omits it, the CLI nils it, and all eight proto-importing packages are clean against a 218-hit
control.

**But `remote_data` is a field on a public gRPC/protobuf wire contract.** `proto/farmtable.proto` is
the source of truth for the data model, and the server speaks gRPC to whatever connects. **Any
third-party client, external dashboard, script, or downstream service that reads `remote_data` off
the wire and renders it is outside this repository and unreachable by any derivation I can perform.**
No grep, no AST walk, no WalkDir over `internal/` can settle it. It is precisely the
`audit-194-r11` shape — a statement about deployment topology, wearing the clothes of a source
measurement, because I *did* measure the part of it that source can reach and the measured part
felt like the whole.

**I am not moving a severity on it, and I want the reason stated rather than assumed:** the
in-tree consumers are the ones this diff is defending, the fix is retroactive at four egress sites,
and inventing a hypothetical external renderer to justify an upgrade would be exactly the
theoretical-risk inflation my own rules forbid. **But "LATENT" is now flagged as resting on a bound
I cannot verify, and the coordinator should have that alongside `audit-194-r11`'s IAP bound** — the
two are the same class, and both are load-bearing for a severity.

Second, and much smaller: **A7's "there is no CI."** `.github/` exists and is populated with no
`workflows/`, which is in-tree and measured. But a pre-receive hook, an external runner, or a GitHub
App is invisible to the tree. The claim I can defend is *"this repository contains no workflow
definition"*; the claim A7 needs is *"nothing enforces the guard automatically."* **Those are not the
same sentence**, and I wrote the second while measuring the first.

### Net

**No severity moves; one severity is now flagged as externally bounded rather than measured.** No
finding added or withdrawn. **Verdict stays: REQUEST CHANGES, zero LIVE XSS findings.** Tenth,
eleventh and twelfth self-caught instrument defects — the inline send, the two-glob N1, and the
detector self-match — bringing me to **twelve instruments checked, twelve broken, zero conclusions
moved.**

---

## Amendment, 01:52Z — Broadcast 9: the falsification test, and a delta opinion that opposes the new remedy

### 1. The falsification test. **I retract 11 of my 12 claimed instrument defects. They were mine.**

The test: *for every error attributed to apparatus, produce the record number where the instrument
gave the **wrong answer**. If you cannot, it was yours.* Run against my own tally, one at a time:

| # | What I called an instrument defect | Did the instrument give a WRONG ANSWER? | Verdict |
|---|---|---|---|
| 1 | Overdetermined `asym` cell | No — the test ran correctly and reported correctly. **I designed the probe so two causes were present.** | **MINE** |
| 2 | N5 enumeration, 3 surfaces vs 8 | No instrument was ever run. **I asserted it from memory.** | **MINE** |
| 3 | Misaimed N5 import-path grep | No — it correctly returned what my pattern described. | **MINE** |
| 4 | Seven "fabricated missing tests" | No — `grep -o` did exactly what the pattern specifies, on text **my** report line-wrapped. | **MINE** |
| 5 | `… \| head; echo exit=$?` | No — the shell correctly reported `head`'s exit, which is documented behaviour I had already written down as a rule. | **MINE** |
| 6 | Truncating transcript extractor | No — `'"command":"[^"]*"'` stops at the first quote **because that is what it means.** | **MINE** |
| 7 | The two unquoted globs, L40/L42 | **No wrong answer** — it printed `no matches found` at L41/L43, loudly, and I re-ran at L45/L47. An environment property that self-reported. | **RETRACTED** (neither) |
| 8 | 63 → 102 | The sweep returned what it was asked. The exclusion arithmetic was **mine**. | **MINE** |
| 9 | Ordering table from string matches | It produced the **correct** answer — identical to the `tool_use` rebuild. | **RETRACTED** |
| 10 | Write-arm blind to shell writes | **YES.** My `touch`-created canary appears in **zero** file-event records; the census answered *"no `/workspace` writes, ever"* when there had been one. The instrument's domain genuinely excludes the truth. | **QUALIFIES** |
| 11 | Inline send died, L178/L179 | No — the shell correctly rejected a command **I** malformed. | **MINE** |
| 12 | Three detector self-matches | No — each detector did precisely what I wrote it to do. | **MINE** |

**One survives. Eleven were my errors wearing an apparatus costume.**

And the uncomfortable part is not the count, it is who was making the argument. **I was the leg
pushing the "every instrument is broken" narrative hardest** — I wrote *"nine instruments checked,
nine broken, zero conclusions moved,"* then *"twelve for twelve,"* and offered it as evidence about
the tooling. It was mostly evidence about me. **The instruments overwhelmingly worked and answered
exactly the questions I posed; the questions were wrong.** My own closing line last message —
*"it may simply mean the instruments were never carrying them"* — was drifting toward this and still
framed it as instruments being weak rather than as me being wrong. Broadcast 9's formulation is the
correct one: **the apparatus-failure narrative is an attractive place to file an error that belongs
to the reader,** and a leg an hour deep in broken instruments will reach for it first. I did,
repeatedly, in a report whose subject is instrument discipline.

**Corrected tally: one genuine instrument limitation (the write arm), eleven reader errors, one
environment property that reported itself.** No conclusion moves — which was true before and means
less than I implied, because if the errors were mine and the conclusions held, **the conclusions
were resting on the derivations all along and my measurements were mostly decoration.**

### 2. Item 7 — own tooling excluded from own census, by record number

Stated as required. Three self-matches, all excluded, all of which would have inflated a compliance
count **in my favour**:

- **L652** — relative-path sweep: 8 hits, **all 8** were the detector's own regex alternation
  matching itself in its own source. True count: **0**.
- **L733** — `b8audit.py` matched its own literal string `"scion message"`, inflating my send census
  from 9 to 10. True count: **9 sends**.
- The unquoted-glob detector matched `--include=[^` inside a *quoted* grep pattern — text I was
  searching **for**, not an argument I passed. 3 hits → **2 real**.

### 3. Item 5(c) — the load-bearing coincidence, and there is a third instance: mine, in my own cap

Two were named. **There is a third, and it is the most consequential sentence in my report.**

My entire severity structure rests on *"nothing consumes `remote_data`."* For the GitHub path, the
reason nothing **can** consume it is that **it is nil on the wire** — XSS-R4-C1, the accidental
`[]string` rejection. **My `LATENT` cap is partly load-bearing on a bug.** Not on a policy, not on
an architectural boundary — on a type-switch accident that the round has now decided to fix.

That is exactly class (c): a correct conclusion resting on a premise that will not survive. And it
is why item 8's delta opinion below is the most important thing in this amendment.

### 4. Item 8 — **DELTA OPINION: ship the logging. Do NOT ship representability normalisation in this round.** Source-only, no run.

The remedy I reviewed was *"drop the offending key at two call sites."* What will ship is
**representability normalisation at the sanitizer's exit** plus logging the discarded error. **I
oppose the first half, and my objection is not stylistic.**

**(a) It reverses, by a different mechanism, the scope decision this round explicitly made — and
which I explicitly endorsed.** The dev leg's stated reason for putting `[]string` serialisation out
of scope was that it *"would start shipping data to the client that does not reach it today, which
is a widening of exposure and not this round's call."* I endorsed that at A4 and wrote *"that is the
right call and I would have made it."* **Representability normalisation is that widening.** It
arrives framed as a correctness fix, which is precisely why the reversal is invisible — Broadcast
9's no-action-label class, running in the opposite direction: **a scope exclusion re-entering the
round under a name that does not sound like the thing that was excluded.**

**(b) What would newly cross to the wire, enumerated from source at `e6bda71`.** Today these are all
nil — GitHub for 100% of passthrough tasks (unconditional `labels`), beads whenever the guarded
fields are present:

```
github/graphql_queries.go   state_reason · milestone · parent{node_id,number} · labels
                            sub_issues[{number,title,state}] · sub_issues_summary
beads/beads.go              external_ref · source_system · owner · created_by · design · notes
                            labels · metadata = json.RawMessage(...) · due_at · defer_until
                            started_at · closed_at · dependencies[{...}]
```

**`design`, `notes`, and `metadata` are the problem.** They are free text and *opaque
attacker-influencable JSON* from an external issue tracker. And `urlBearingRemoteDataKey` is a
**key-name** predicate (XSS-R4-C7′) — `design`, `notes` and `metadata` are not URL-bearing names, so
**the sanitizer does not inspect their values at all.** They pass through untouched.

**(c) Therefore the fix creates the reachability that every finding in my report is capped by.**
This round exists because `javascript:` URLs must not reach a renderer. Today, on these adapter
paths, `remote_data` **never reaches a client**. Normalisation makes it reach one, carrying fields
the URL guard is structurally unable to examine. I am not claiming a live XSS — `web/src` still does
not render the field, MCP still omits it, the CLI still nils it. **I am claiming the remedy removes
the single property that made all of my findings LATENT rather than LIVE**, and it does so inside
the round convened to harden that property.

**(d) It also silently re-rates XSS-R4-O1 and XSS-R4-O3.** Both were rated against a field that never
serialises on the main adapter path. After normalisation, **the sanitizer's output is what ships** —
so its recursion gap and its silent dropping of clean subtrees stop being latent quality issues and
become the live contents of a wire message. **A fix that changes the severity of the round's own
open findings should not land in the same commit as those findings.**

**(e) Wrong location, and it makes XSS-R4-C7′ worse.** `structpb` representability is a **proto/wire**
concern. Putting it at the sanitizer's exit gives one function three jobs — validate URLs, delete
what it cannot validate, and convert types — inside a security boundary. It belongs at
`convert.go:358`/`:534`, where the `structpb` call already is.

**(f) The two halves are in tension, which nobody has said out loud.** The logging exists to make
the invisible data loss visible. **Normalisation removes the data loss, so the log will never
fire.** Shipping both together means shipping an observability mechanism and simultaneously
guaranteeing it stays silent.

**My recommendation, and it is a sequencing one:**

1. **Ship the logging alone, this round.** Zero wire-behaviour change, which is exactly what I asked
   for in XSS-R4-C1. It is the only half that is unambiguously safe.
2. **Let it report from production for a period.** It will say precisely which keys are being
   dropped and how often — including whether my unmeasured **beads** residual (XSS-R4-C1b) is real.
3. **Then decide normalisation in its own round, with a threat model for the newly-shipped
   fields**, and gate it on XSS-R4-O1 and XSS-R4-O3 being closed first, since after normalisation the
   sanitizer's output is the wire contract.

**This is the "do not let a remedy grow past its review" case, and I would have missed it** had the
delta not been pushed to me — I had already filed APPROVE-in-substance on the remedy's *stated*
form. **A file edit is not a notification** applies to remedies as much as to briefs.

### Net

**No severity moves. One severity's basis is now disclosed as resting on a bug the fix will remove.**
Verdict stays: **REQUEST CHANGES**. New: an explicit objection to half the proposed remedy, filed
before the fix leg starts rather than as next round's finding.

---

## Amendment, 02:00Z — Broadcast 10: the split tally, and my error census was contaminated by my own report

### 1. `[item 4]` BROKEN vs MISAIMED, both numbers — and the remedies are aimed at the wrong one

Splitting my retracted tally on the correct axis. **Broken** = wrong answer to the query I asked.
**Misaimed** = right answer to the wrong query.

| Class | Count | Members |
|---|---|---|
| **BROKEN, and it misled me** | **1** | write arm blind to shell writes — asked *"was anything written to `/workspace`"*, answered *"no"*, was **wrong** |
| **BREAKAGE, caught, no wrong answer** | **2** | the two glob aborts (L41/L43) — genuine tooling breakage, self-reported, re-run quoted at L45/L47 before anything was filed |
| **MISAIMED** | **8** | import-path grep · test-name extractor · `head`'s exit · truncating extractor · 63→102 exclusions · 3 detector self-matches · **+2 found tonight, below** |
| **NEITHER — reader or design error, no instrument at fault** | **4** | confounded probe design (`asym`) · N5 (no instrument was ever run) · ordering table (correct result, unsound method) · the malformed inline send |

**8 misaimed to 1 misleading breakage.** That ratio is the finding, and it has a consequence nobody
has drawn yet:

> **The entire tooling-remedy programme — quote the glob, `unsetopt nomatch`, `pipefail`,
> sentinels, `;`-vs-`&&` — would have prevented ZERO of my 8 misaimings and ZERO of my 1 misleading
> breakage.** The write arm is not a shell problem at all. Those remedies would have prevented only
> the 2 aborts **I already caught for free.** They are aimed at the 2/15 of my errors that cost me
> nothing and at none of the 8/15 that did.

Not an argument against the hardening — breakage is real and cheap to retire. It is an argument
against believing the hardening addresses what actually went wrong tonight. **It does not.**

**And my control design silently assumed the right disease.** I built controls the standard way —
copy the instrument line, change the pattern — which varies the query but not the idiom, so it
**detects misaiming and is structurally blind to breakage.** My disease was misaiming, 8 to 1. **My
controls were correctly aimed by an assumption I never stated and never tested**, and had my ratio
been inverted they would have certified nothing while looking identical.

### 2. `[item 5]` My error-string census was contaminated by my own quoted prose — and the adjudicator I built to prevent that was also wrong

I reported *"6 tool_results containing a shell error string"* at 01:36Z as a hand-adjudicated
figure. Re-adjudicated under item 5:

- **L617 is not an error. It is my own echo caption** — `=== CONFIRMED: zsh ABORTS on unquoted
  --include=*.go. 'no matches found', exit nonzero, NO OUTPUT. ===` — quoting the error string
  **as evidence.** Exactly `test-194-r11`'s class. **True count: 5 real, not 6.**
- **Worse, and this is the recursion:** re-running the same census *now* returns **8** records,
  because **L734 and L741 are the outputs of my own earlier audits**, which printed those errors as
  evidence. **My 01:36Z census is now a contamination source for my 02:00Z census, twenty minutes
  later, in the same transcript.** The rule generalises past `reports/`: **any record that quotes an
  error string contaminates every later census of it, including your own audit output.**
- **And the classifier I wrote to separate "real diagnostic" from "my own prose" got one wrong in
  the other direction:** it labelled **L511** (`ls: cannot access '.dockerignore'`) as my prose. That
  is a genuine `ls` diagnostic — my heuristic required `(eval)` or end-of-line and this had neither.
  **I built an adjudicator to avoid counting, and the adjudicator misclassified.** Which is precisely
  why the standing instruction is *adjudicate, do not count* — **a classifier is just a detector with
  better manners.**

Both go in my MISAIMED column, taking it from 6 to 8. Neither changes a conclusion; both would have
inflated a diligence figure in my favour.

**Standing rule adopted:** censuses exclude `reports/` by path, and — my addition — **exclude prior
audit output by record number**, because on this axis my own transcript is a `reports/` directory
that grows while I work.

### 3. `[item 1]` Caption reuse: clean, 0 of 119

Measured, since the hazard is created by good practice: **119 distinct captions, 0 reused across
commands.** My re-runs carried explicit `RE-RUNNING`/`ORIGINAL (unquoted) form` language, so no
aborted head could be spliced onto a re-run's body. Clean, and I note this is the one instrument
hazard tonight I avoided by habit rather than by luck.

### 4. `[item 7]` Ruling adopted, and one requirement for the round where normalisation returns

Logging-only is the right call and the synthesis is correct: **entry-normalisation is strictly
better than exit-normalisation and does not answer my objection**, because
`urlBearingRemoteDataKey` is a **key-name** predicate and `design`, `notes`, `metadata` are not
URL-bearing names under either scheme.

**So the durable requirement for the future round, stated now so it is not rediscovered:**
normalisation must be gated not only on XSS-R4-O1 and XSS-R4-O3 but on **XSS-R4-C7′'s second name** — the
key-name predicate must be replaced by one that inspects **values**, or the day `remote_data` ships,
every non-URL-named field crosses the boundary **unexamined by construction.** The predicate's name
has been describing a value check it never performed; normalisation is the change that makes that
gap load-bearing.

---

## Additional `[CHECKLIST]` findings

### `[INFO]` XSS-R4-C5 — `remote_data` carries a behavioural capability flag, not just display data

`graph_support.go:26-27`: `collectionSupportsGraph` reads `c.RemoteData["graph_queries"]` as a
**bool override** of the per-platform default, and the platform defaults are `false` for `asana`
and `beads`. Import (`collection:admin`) can set it.

Not a vulnerability: the value is type-asserted `v.(bool)`, so nothing but a real boolean is
honoured, and the effect is to enable an analysis feature. **Filed because it changes the threat
model's shape rather than its size:** `remote_data` is documented as an untyped display escape
hatch, and it is also a **policy input**. `sanitizeRemoteData` is scoped entirely to URL-shaped
harm and would not look at a key like this. The next behavioural key added to `remote_data` may not
be a bool. **Recommendation:** one sentence in `urlvalidate.go`'s header noting that `remote_data`
is read for behaviour as well as display, and that the sanitizer's threat model does not cover the
former.

### `[LOW]` XSS-R4-C6 — the write-site enumeration cannot reach the two packages where the non-web controls live (upgrades XSS-R4-O8)

`TestEveryRemoteDataWriteSiteSanitizes` reads `internal/server` only, non-recursively
(`os.ReadDir` + `if e.IsDir() { continue }`), while its doc says *"reads the non-test sources."*
In the open pass I filed that as Info. A1c gives it a consequence and I am upgrading it:

**The two structural controls keeping `remote_data` out of a terminal and out of an LLM context are
`internal/cli/output.go:62` and the field-omission in `internal/mcp/server.go:863` — and the
enumeration test can see neither.** Adding `"remote_data": t.GetRemoteData().AsMap()` to MCP's
`taskToMap` would look like completing an obviously incomplete function, would pass every gate in
this round, and would put adapter-controlled content into an LLM context in one line.

Neither control is pinned by a test (verified: zero `remote_data` matches in `internal/cli/*_test.go`;
positive control — 4 test files exist there) and neither carries a comment saying it is deliberate.
The MCP one is the more dangerous because it is an **omission**: there is nothing to read.

**Recommendation, in priority order:** (1) a one-line comment at both sites saying the exclusion is
deliberate and why; (2) widen the enumeration test's root to `internal/` with `filepath.WalkDir`,
which also fixes the doc/behaviour mismatch; (3) a two-line test asserting `remote_data` is absent
from both `taskToMap` outputs.

---

## Prediction accuracy: **8 / 9**, plus one unpredicted result that outweighs the eight

| # | prediction | outcome |
|---|---|---|
| P1 | R1 goes RED | **HIT** — exit 1 |
| P2 | fails on the `disagreement:` arm, not the "both agreed" arm | **HIT** — all failures at the `disagreement:` arm |
| P3 | all 9 leaves report `dropped=true, errored=false` | **HIT** — 8 reported as failures + 1 (asym) silently matching |
| P4 | 4 CLEAN rows are silently deleted | **HIT** — all four named |
| P5 | the anti-vacuity floors scale and need no editing | **HIT** — not reached; `agreed` Fatalf fires first at `64/72` |
| P6 | the failure message names `links` | **MISS** |
| P7 | R2 green; the nested rule is dormant | **HIT** — 14 nested keys, zero URL-bearing |
| P8 | nested includes `percent_completed`, `node_id`, `number`, none URL-bearing | **HIT** |
| P9 | `found` includes `remote_url` and `html_url` | **HIT** (a control on my reading, not a result) |

**P6, kept as a miss.** It was self-inflicted — I named my probe wrapper without putting `links` in
the name — and I could reclassify it as an apparatus artefact. I am not going to: a prediction
scheme in which the predictor adjudicates their own misses measures nothing. The miss also found
something, which is that the `disagreement:` message names **no path at all**, one function away
from `TestValidateImportedTaskURLsReachesNestedCarriers`, which deliberately asserts the error names
`parent.html_url` so an operator can locate the value.

**The unpredicted result, which is the most important thing in this report:** the `asym` row
**passes**. The pin asserts `dropped=true, errored=false`; the second disagreement class produces
that same signature; so the pin does not merely miss the new defect — **it absorbs an instance of
it and reports agreement.** A pin keyed on the OUTCOME cannot separate two defects that share an
outcome. That is strictly worse than having no pin, because absence leaves a gap while this leaves
a false positive statement of coverage. **The pin must assert the CAUSE (an unvalidatable scalar
under a URL-bearing key), not the SIGNATURE.**

### Amendment, 00:58Z — the edit-landed conjunct, and a self-audit of the sentence above

Filed in response to the round-wide finding that **a mutation which failed to apply is
indistinguishable from a mutant that survived** — a survivor is the conjunction *"the edit landed"*
AND *"the suite passed"*, and only the second conjunct is readable off a green run. Applying it to
my own G-4, including the parts that came out in my favour and the one that did not:

**(a) Did my edit land? Yes, and by two independent routes, neither of which is the exit code.**

1. **A count, not a signal.** The sweep prints `64/72 rows agreed`. The baseline table is 7
   wrappers × 9 leaves = **63**. A denominator of **72** is 8 wrappers, and is arithmetically
   impossible unless my wrapper was in the table. This is the match-count check the new rule
   requires, and I have it retrospectively because the harness happens to print its own
   denominator.
2. **Attribution by content.** Eight failure messages quote my wrapper's title verbatim. A no-op
   edit cannot produce a string that exists only in the edit.

**(b) The asymmetry protects me here, and I want to say why rather than just claim it.** G-4 was
**RED (exit 1)**. A failed edit runs the clean tree, and the clean tree is green — so no no-op
could have produced my result. **I have reported no survivors tonight and none of my findings rest
on a green mutation row.** G-5 was green, but G-5 was an unmutated observation of a scanner's
census, not a mutation row; there was no edit whose landing could be in question.

**(c) The self-audit, which does go against me: my headline sentence draws the conclusion through
an OVERDETERMINED cell.** The `asym` leaf is *"an unvalidatable scalar under a URL-bearing key"* —
the old defect — and I wrapped it in `{"links": []any{…}}`, which is the new defect. **Both causes
are present in that one cell**, so its `dropped=true` is explained twice over, and the observation
alone cannot tell me which one produced it. That is precisely tonight's class — a confirmation that
cannot discriminate — appearing in the finding I wrote *about* confirmations that cannot
discriminate. I did not notice it when I filed.

**The conclusion survives, but it must be derived from a different cell, and it is stronger that
way.** The other **eight** leaves — including the four *clean* ones, which carry no unvalidatable
scalar and no old defect at all — each produced `dropped=true, errored=false` under my wrapper. So
**the new defect, acting alone, demonstrably generates the exact signature the pin accepts.** The
pin's condition is a pure predicate on that signature; it does not inspect the leaf's cause.
Therefore it accepts the new defect's signature wherever it is evaluated. **Absorption is proved by
the eight clean-cause rows, not by the one overdetermined row I originally cited.** The
recommendation is unchanged and now better founded: assert the CAUSE, not the SIGNATURE.

**And that is the same rule applied to my own instrument that the rule asks me to apply to the code:
my probe was a mutation, my probe's cell was overdetermined, and I read a cause off it that the
cell could not carry.** Recording it rather than quietly re-deriving it, because the whole value of
a prediction-and-measurement scheme is that the auditor does not get to launder their own steps.

A perfect score would have been weak evidence, per Part II. 8/9 with one unforeseen result that
changes the finding — and one self-caught error in how I derived it — is the honest summary.

---

## Brief errors, continued — the required list, items 9-14

(1-6 in the `[OPEN]` section; 7-8 in `[POST-II]`.)

9. **A1's premise "Sanitizing at write time does nothing for rows already in the database — the fix
   is not retroactive" is wrong.** Four of the six sites are **egress**, reached on every read.
   Poisoned rows are cleaned on the way out. **No data-remediation task is owed**, and the
   checklist asks for one on a false premise. Root cause is the round's own phrase "write sites";
   recommend "egress sites."
10. **A1's "THE RECURSION GAP WAS LIVE" is overstated, and the flagship example does not exist.**
    `remote_data["parent"]["html_url"]` is written by no adapter; `parent` carries `node_id` and
    `number`. Zero nested keys are URL-bearing anywhere in-tree. The gap was real as a code defect
    and was not reachable end to end.
11. **A2's model of the `server.go:661` exemption is wrong in both directions.** It is keyed by
    source **text**, not line number: editing above it does nothing (no retargeting), and it fails
    **closed** on edit, not permissive. The real hole — a byte-identical line elsewhere in
    `internal/server` — is narrower than described. The checklist's conclusion ("not a Low") rests
    on a decay mode this control does not have; I rate it **Low** and give the one-line fix.
12. **A4 repeats the in-tree log's wrong line numbers** — "Also `convert.go:530,555,558`" — which
    are `534`, `559`, `562`. Inherited from the artefact under review rather than measured, which
    is Part II failure mode 1 ("I supply an input together with a wrong expected result") operating
    through a citation.
13. **A4's attacker framing is unnecessary and understates the defect.** "An attacker who can plant
    one unrepresentable value" describes a capability that an ordinary **GitHub label** already
    exercises on every issue. There is no adversary and no precondition; the field is destroyed
    unconditionally on the primary platform. Framing it as a latent attacker primitive made it look
    like a scope question when it is a live bug.
14. **A3 asks for something partly impossible and does not say so.** *"Nobody has re-run the fixed
    instruments over the history the broken ones cleared"* — the fixed adapter-key scanner and the
    fixed guard tracer both read the **working tree** at whatever SHA they run at, so re-running
    them over history means checking out each of 18 commits. That is affordable, but the request is
    written as though the instruments could be pointed at a range. I did the guard tracer's half
    statically instead and report the method; flagging the framing because the next leg may spend a
    grant discovering it.

---

# VERDICT

## **REQUEST CHANGES**

**And the first thing I want on the record is what this verdict is NOT.** This diff introduces no
vulnerability, closes a real (if unreachable) code defect, and turns on a control that had been off
for four hours and eighteen commits. It is a net security improvement and it should land. **Nothing
below is blocking on exploitability, and by my own count the round contains zero LIVE XSS findings
of any severity.**

I am requesting changes because of my axis, which is *whether a stated mitigation actually removes
the harm it names* — and **four stated mitigations in this diff do not**:

1. **`urlvalidate.go:221` — "It can now, so the two agree."** They do not. Added by this diff.
2. **The `asym` pin — "so it cannot silently become two disagreements."** It already is two, the
   sweep's table cannot generate the second shape, and G-4 measured the pin **absorbing** an
   instance of it and reporting agreement.
3. **`urlvalidate_differential_test.go:532/621-629` — "because `sanitizeRemoteData` walks only the
   top level."** Fixed by this diff, and the sentence justifying the live rule, plus the
   operator-facing failure message prescribing a remedy already implemented, were left behind.
4. **`TestGitHubPassthroughRemoteDataNeverSerialises`** — a live, unconditional data-loss defect
   cited as the foundation of a security exemption.

In a round whose *entire content* is instrumentation and the claims made about it, four false
statements of coverage is the defect class the round exists to attack. Approving would put the
round's own completeness claims into the record unchallenged, and this project's history is that
those claims get relied on two rounds later.

### Required before merge

| | item | severity | status |
|---|---|---|---|
| 1 | **XSS-R4-O3** — second sanitize/import disagreement; add the `[]any`-under-a-URL-bearing-key wrapper (RED measured, G-4); re-key the `asym` pin on the CAUSE, not the signature | Low defect / **the pin is the real issue** | INTRODUCED (nested data loss) |
| 2 | **XSS-R4-O1** — three stale sentences at `:532`, `:621-622`, `:626-629`, incl. the operator-facing remedy | Medium | LIVE (maintainer trap) |
| 3 | **`urlvalidate.go:221`** — delete or correct "so the two agree" | Medium | INTRODUCED |
| 4 | **XSS-R4-C2** — rename `…NeverSerialises` and re-found the `metadata` exemption on something a bug-fix cannot remove | Medium | INTRODUCED |
| 5 | **XSS-R4-C1** — log the discarded `structpb` error at `:358` and `:534`. Wire behaviour unchanged | Medium | **LIVE TODAY** |
| 6 | **XSS-R4-O6** — `docs/url-policy.md` does not exist | Low | INTRODUCED |

### Should fix, not blocking

**XSS-R4-O2** (two `ALLOWED` entries with no enforceable arm — the strongest *latent* item, and the
reason a green tracer proves less than it appears to), **XSS-R4-O4** (measured line-wrap recall hole,
handled inconsistently with the `setAttribute` rules in the same file), **XSS-R4-O5** (`RUN npm test`
below `COPY web/ .` with no `.dockerignore`), **XSS-R4-C6** (widen the enumeration test; pin the MCP and
CLI exclusions), **XSS-R4-C3/A2** (key the `server.go:661` exemption on file+text), **XSS-R4-C4** (receipt
integrity), **XSS-R4-C5** (`remote_data` is a policy input as well as a display field), **P2cn**
(one sentence: the equivalence is contingent on XSS-R4-O3), **P11** (say "on the import walk").

### Reachability summary — the number that should govern how this is read

| | count |
|---|---|
| LIVE TODAY | **2** (XSS-R4-C1 data loss; XSS-R4-O1's maintainer trap) — **neither is an XSS** |
| INTRODUCED BY THIS DIFF | 5 (XSS-R4-O3 nested data loss, `:221`, XSS-R4-C2, XSS-R4-O6, XSS-R4-O5) |
| LATENT | 7 |
| **Live XSS findings, any severity** | **0** |

Nothing in `web/src` renders `remote_data`; MCP omits it; the CLI blanks it; and for the primary
platform it does not reach the wire at all. **Every `remote_data` finding this round — the dev
leg's included, and mine — is LATENT.** Part I warned that severity has gone wrong on this project
in both directions. This is the direction nobody guards, and I am guarding it against my own
findings as well as against the round's.

**Every null underwriting that paragraph now carries a positive control** (amendment above, 01:04Z).
All held. The consumer enumeration behind it was incomplete — three surfaces named, eight consuming
packages — and widening it to all eight *confirmed* the conclusion and added a second LLM surface
(`internal/decomposer`) that also never touches the field. **No severity in this report moves as a
result. The evidence under the severities is materially better than it was when I filed them, and
in one place it was thinner than I claimed.**

### Positive observations

1. **MCP and the CLI are structural allow-list renderers.** `remote_data` cannot reach a terminal
   or an LLM context, not because it is sanitized but because it is never enumerated. That is a
   better control than any sanitizer and nobody in this round has claimed credit for it.
2. **The sanitizer is at egress, so the fix is retroactive** over already-persisted rows. That is a
   significantly better property than the round claims for itself.
3. **`safe-url.ts`'s no-base `new URL()` comment**, which *measures*
   `new URL('javascript://evil.com/%0aalert(1)').hostname === 'evil.com'` rather than asserting it,
   is the best single piece of security documentation in this codebase.
4. **The X3 write-site count was found by writing a scanner rather than auditing the brief's four**
   — and it was six. That is the correct response to a brief that states a count.
5. **`run-tests.mjs` is genuinely well built**, and its comment at `:278-300` — stating what the pin
   KILLS *and* MISSES, and saying explicitly "this is the OUTERMOST level… it stops here because
   this is the last level that exists, not because the level is complete" — is a standard of
   honesty I have not seen elsewhere on this project. XSS-R4-C4 is a refinement of it, not a rebuttal.
6. **Import errors before it drops** (`validateImportedTaskURLs` at `:722`, then
   `sanitizeRemoteData` at `:743`). The caller learns their file was rejected instead of silently
   losing content. The right order, and it is not the obvious one.
7. **`TestRemoteDataKeysWrittenByAdaptersAreClassified` carries two positive controls**, one of
   which (`percent_completed` must appear as NESTED) specifically guards the nesting split from
   collapsing into vacuity. Measured firing in G-5.
8. **The `structpb` all-or-nothing behaviour was checked for a fail-open mirror and there is none.**
   Whoever chose `NewStruct` over a per-key loop got the failure direction right.
9. **The X8 disposition — declining to widen the wire surface inside a security round — is correct**
   and I downgraded my own XSS-R4-O9 on the strength of it.
10. **The cycle test is honest about crashing rather than failing.** `TestRemoteDataTraversals-
    TerminateOnACycle` says in its own comment that without the bound it does not fail, it exhausts
    the stack, "which is still RED, and is the honest outcome to pin."

### Recommendations beyond this round

- **Commit the briefs volume. One command, and it retires a whole hazard class.**
  `/scion-volumes/scratchpad` is already a git repo (22 commits) and *not one document from
  tonight's round is tracked in it.* `git add briefs/ reports/` at dispatch makes every
  cross-document citation recoverable. **The rule this generalises to:** *a pointer is sound iff
  its target is content-addressed* — which is why `file:line` into `/workspace` at a published SHA
  is fine and the identical syntax into `briefs/` is not. See §1 of the 01:28Z amendment, where my
  own single pointer is shown resolving to text that contradicts the claim it supports.
- **The write arm needs a second pass, and the round is currently mandating only the first.**
  `tool_use` file events do not see `Bash` writes — no `>`, `tee`, `sed -i`, `cp`, `mv`, or
  `git checkout`. Proved against my own `touch`-created canary, which is invisible to the arm that
  is supposed to find it. Pair the file-event sweep with a parsed sweep of Bash commands for
  write-capable constructs, and state the claim as *"no tool wrote and no shell command targeted
  the tree."* See §3.
- **A CSP is worth more per hour than further guard-tracer investment.** See A8.
- **Add to every leg brief:** *"For every control this diff adds or relies on, name its executor
  and the artefact showing it executed at this SHA."* See A7. Ninety seconds, round 1.
- **`em-tooling/` taxonomy candidate, third one, and the most general of the three:** *an
  overdetermined cell cannot attribute a cause.* The mutation rule ("a failed edit and a survivor
  are the same observation") is the special case where one of the two explanations is *"nothing
  happened"*; the general case is any test cell in which two sufficient causes are present at once,
  where the observation is consistent with either and licenses neither. The operational form is the
  same in both: **before reading a cause off a cell, enumerate every cause sufficient to produce
  that cell, and if there is more than one, the cell is a specimen and not evidence — go find a
  cell where only your cause is present.** I found this in my own G-4 after filing (amendment in
  the prediction section), so it is not offered as advice from outside.
- **`em-tooling/` taxonomy candidate, second one, and it came from a sibling leg:** *a shared
  artefact is an OBSERVATION of the instrument that produced it and never a CONTROL on it.* When a
  leg consumes another leg's run to save the box, the saving is real for "what did it output" and
  illusory for "does it work" — the second question needs a run whose subject is not its own
  source. The rider is the sharp end: **a green run is blind to every count-neutral corruption by
  construction, so borrowing one tells you which files were reached, not whether they were reached
  for the right reason.** test-xss-r4 raised this against its own convenience, unprompted, and it
  corrected an offer I had already accepted. It belongs in the queue rules next to "a leg's run may
  only be compared against its own prior run of the same target."
- **`em-tooling/` taxonomy candidate:** *a pin keyed on a defect's SIGNATURE rather than its CAUSE
  will absorb the next defect that shares the signature and certify it as the old one.* Three
  instances tonight in one class — the `asym` pin, the stranded mutant that survived the suite, and
  four concordant `SCION_WORKSPACE_MODE` samples drawn from one stratum. The general form:
  **a confirmation that cannot discriminate is not evidence, and N of them is still not evidence.**
- **Beyond my axis, flagged not filed (architecture is the review leg's):** `sanitizeRemoteData`
  and `validateRemoteDataURLs` are two hand-maintained traversals over the same grammar, kept in
  step by a 63-row sweep. XSS-R4-O3 is the second divergence in one round. One traversal parameterised
  by an on-violation action would make the class unrepresentable rather than tested-for. *Impression,
  review leg's call.*

---

## Amendment 02:20Z — Broadcast 11 answered. Two measured results, one of which
## RETRACTS A FINDING I WAS ABOUT TO FILE AGAINST THE ROUND.

Read-only on `/workspace`. No build, no suite, no slot. Verdict unchanged:
**REQUEST CHANGES, zero LIVE XSS.**

### 1. Item 1 — the ID rewrite is applied, and the quoted-span guard failed in BOTH directions

Applied by hand-supervised script, not blind sed. **116 IDs across 100 lines**, `C-N`→`XSS-R4-CN`,
`OPEN-N`→`XSS-R4-ON`. Residual bare IDs: **0**. Measured first, rewritten second.

**Quotation exposure in my report: ZERO.** Not one `C-N` or `OPEN-N` sits inside a quotation of
your text or a sibling's. So the corruption you warned of could not occur here — but I only know
that because I enumerated all 116 before touching any.

**The guard I built to protect quotations skipped 36 IDs that were my own prose.** My
exclusion regex was `"[^"]*"|\*[^*]+\*|`…`` — and `\*[^*]+\*` matches **markdown bold**. Bold is
the single most common way my report marks its own finding IDs (`**XSS-R4-O3**`). First pass:
69 lines rewritten, **33 left bare**, and the residue was concentrated in the summary tables and
the recommendation list — the two sections a reader consults *first*. A half-applied ID scheme in
the summary table is worse than none, because it reads as a deliberate distinction.

> **THE QUOTED-SPAN EXCLUSION HAS A MIRROR HAZARD YOU DID NOT NAME. You warned that the rewrite
> will DESTROY quotations. Implemented by shape, the guard against that instead PRODUCES SILENT
> UNDER-APPLICATION — and it fails loudest exactly where emphasis is densest, which is the
> summary.** Over-application corrupts someone else's words and is visible in diff. Under-
> application leaves my own record internally inconsistent and is visible to nobody.

This is item 4's rule arriving somewhere item 4 did not send it: **I excluded by SHAPE (`*…*`)
what I should have excluded by SOURCE (is this someone else's utterance?).** Bold and italic are
*my* typography; only attribution makes a span a quotation.

### 2. Item 3 — my tally, split four ways: **1 / 8 / 2 / 2**

| Class | N | Instances |
|---|---|---|
| **BROKEN** (instrument gave a wrong answer to the query I asked) | **1** | The write arm: reported `/workspace` writes = NONE while a shell-created file existed. Wrong, and *misleadingly* wrong. |
| **MISAIMED** (instrument answered correctly; I aimed it wrong) | **8** | `[]string{` literal grep; `--include` sweep pre-truncation; `63`→`102`; N5 import path; the 7 fabricated test names; the `--include=[^` self-match; the `b8audit.py` self-match; the L652 8-of-8 self-match. |
| **REFUSED / DECLINED** (loud, empty, self-announcing) | **2** | A2 and N1, the two `zsh: no matches found` glob aborts. **Reclassified** — I had filed these as "breakage, caught." They were never breakage. The shell declined to run and said so. |
| **UNREAD DIAGNOSTIC** (evidence was in the record when I filed) | **2** | (a) the 01:12Z blindness audit: **the positive control returned ZERO and I wrote "clean."** (b) L511, an `ls` diagnostic my census classifier filed as prose with the diagnostic text on screen beside it. |

**(a) is the one that matters, and it is the worst error of my night.** Not because of its
consequence — the conclusion re-measured true — but because of its shape. Your Broadcast 8:
*"A CONTROL YOU DO NOT LOOK AT IS DECORATION."* I had a control. **It fired.** It returned zero,
which is the control's way of saying *the instrument is broken*. I read past it and filed.

**This forces a correction to your taxonomy, and it is worth making at fleet level.** That record
carries **two different errors with two different owners**: the extractor was MISAIMED (truncating
at the first escaped quote — the instrument's failure), and my filing was UNREAD DIAGNOSTIC (the
control told me so — my failure). I have counted it in both columns, which is why my four numbers
sum to 13 against a retraction population of 12.

> **THE FOUR-WAY SPLIT CLASSIFIES THE INSTRUMENT'S FAILURE MODE. IT DOES NOT CLASSIFY THE READER'S.
> ONE RECORD CAN CARRY ONE OF EACH, AND THE READER'S IS THE ONE NO TOOLING REMEDY CAN REACH.**

**Consequence for the tooling programme, updated.** Quoting globs, `unsetopt nomatch`, `pipefail`,
sentinels and `;`-vs-`&&` would have prevented **0 of 8** misaimings, **0 of 1** misleading
breakage, **0 of 2** unread diagnostics, and only the 2 aborts they already caught for free.
**But one remedy would have caught the unread diagnostic, and it is not on the list:**

```bash
# A control that PRINTS is decoration. A control that ASSERTS is a control.
ctl=$(grep -c "$known_present_string" "$f")
[ "$ctl" -gt 0 ] || { echo "CONTROL FAILED — instrument is blind, result below is void"; exit 3; }
```

**MAKE CONTROLS FAIL THE COMMAND, NOT DECORATE IT.** That is the first proposed remedy tonight
with a demonstrated hit against my own record.

### 3. Item 4 — census reclassified by SOURCE. My scratch path is a second corpus, and Broadcast 8 created it.

Re-adjudicated by the only question v3 permits — **did the command that produced this line read the
transcript?** — never by how the line looked:

- **L734, L741** — produced by `b8audit.py` and my census greps, which *read the transcript*.
  Their output is a **quotation corpus**. Not live diagnostics. Excluded.
- **L41, L43, L179, L511, L611** — produced by commands that never opened the transcript. **Live.**

My earlier 6→5 and 5→8 adjudications used shape (*"is this line a caption?"*). They reached the
right answer on L617 and the **wrong** answer on L511. **A method that is right by luck four times
and wrong once is not a method**, and I should not have reported its output as a count.

**DISCLOSURE, AGAINST THE IDIOM YOU MANDATED.** `/var/tmp/scratch-audit-xss-r4/` holds
`send-b678.txt`, `send-b9.txt`, `send-b10.txt`, `broadcast3.msg`, `broadcast45.msg`,
`broadcast67.msg`, `null-controls.msg` — **my outgoing message bodies, which quote
`no matches found`, `unmatched "`, and other abort strings verbatim.** Any future detector
sweeping `/var/tmp` for shell aborts matches all seven and finds "evidence" that is nothing but my
own prose about aborts.

> **THE QUOTED-HEREDOC IDIOM MANDATED IN BROADCAST 8 IS ITSELF A CONTAMINATION FACTORY. It exists
> to stop `scion message` from EXECUTING quoted errors; its side effect is that every error any
> leg reports now also exists as a plain-text file on disk, outside the transcript, in a directory
> no exclusion rule names.** The remedy for one contamination class manufactured another. Both are
> covered by v3 — *the discriminator is source* — and by neither of the path-based exclusions.

### 4. Item 5 — sentinels: 17 distinct, 1 reused, and all of them were guessable

Measured across every Bash command this session: **17 distinct sentinel tokens, 1 reused twice.**
Low collision risk in fact, but they were `SENTINEL-1-END … SENTINEL-10-END`, `SENTINEL-A/B/C` —
**mnemonic and enumerable.** A detector searching for `SENTINEL-3-END` matches my report, my scratch
files, and any sibling who chose the same obvious name. Adopted `SENT-$RANDOM$RANDOM-<letter>`
for every command in this amendment; the seven used here appear in this document **zero** times
outside their own runs.

### 5. Item 7(a) — **I NEARLY FILED A FABRICATED DEFECT AGAINST THE ROUND, AND SOURCE STOPPED ME**

Your rule: a finding downgraded because of an accident owes **a test that goes RED when the accident
is removed** — *"A DEFERRAL WITHOUT AN ALARM IS THE NO-ACTION LABEL WITH A LONGER FUSE."* My
`LATENT` cap rests on XSS-R4-C1's accidental nil-ing, so this lands squarely on me.

**What I was going to file.** `TestGitHubPassthroughRemoteDataNeverSerialises` fires only when
`structpb.NewStruct` starts accepting `[]string` — the **library mechanism**. The deferred
entry-normalisation converts `labels` to `[]any` *upstream*, so `structpb` still rejects `[]string`,
**the alarm stays green, and `remote_data` ships.** An alarm keyed to a mechanism the fix routes
around. That analysis is correct, and I was one step from filing it as the missing alarm.

**It is not the alarm.** `internal/server/passthrough_url_test.go:218` @ `e6bda71`:

```go
if n := len(poisoned.GetRemoteData().GetFields()); n != 0 {
    t.Errorf("remote_data unexpectedly carries %d field(s) on the passthrough "+
        "path: %v. If the []string serialisation issue has been fixed, this "+
        "path can now ship remote_data and the assertions here must be "+
        "upgraded from this guard to real absence checks on remote_url and "+
        "html_url.", n, remoteDataKeysOf(poisoned.GetRemoteData().GetFields()))
}
```

**That is exactly the red test item 7(a) demands, and it is better built than the rule asks for.**
It is keyed to the **outcome** — `remote_data` non-empty at the wire — so it fires on *any* route
that removes the accident: a `structpb` change, entry-normalisation, or an adapter switching
`labels` to `[]any`. And its failure string **names the required follow-up work**. The 24-line
comment above it states the deferral in the round's own words: *"Left as-is rather than fixed…
belongs in its own change, not in a security round."*

**The round deferred a fix, disclosed the deferral in-tree, and shipped an outcome-keyed alarm for
it. That is item 7(a) satisfied before the rule existed, and I had attributed the alarm role to the
wrong test.** This is the strongest single piece of process evidence I have found in the diff and
I would have missed it by reasoning from the test *name* — the very failure mode XSS-R4-C7′ is
about. XSS-R4-C2 is unchanged: `…NeverSerialises` is still a misnomer describing a bug. But it was
never carrying the alarm, so it was never the gap.

**THE RESIDUAL GAP IS REAL, AND IT IS NARROWER AND SHARPER THAN WHAT I ALMOST FILED.** Measured at
`e6bda71`: `GetRemoteData()` appears in exactly **three** test files, and the emptiness guard exists
in exactly **one** — `passthrough_url_test.go`, the **GitHub** path. **There is no `beads`
equivalent.**

`beads` writes `rd["metadata"] = json.RawMessage(...)` (`beads.go:422`) and
`rd["dependencies"] = []map[string]any` (`:454`) — the same class of structpb-rejectable type,
by a different accident, on a different adapter. For `beads` the accident is **undisclosed and
unalarmed**, and `beads` is the adapter that also writes `design` and `notes`: free text under
key names a key-name predicate never inspects (XSS-R4-O1 / XSS-R4-O3 territory).

> **SUPERSEDED 02:35Z by Broadcast 12 item 8 — marked at point of use, not replaced.** `beads` is **unreachable from production** (verified independently below). This paragraph's `REQUIRED` status is **withdrawn**; XSS-R4-C1b returns to `[INFO]`, LATENT. The text is left standing because the reasoning error in it is the finding.
**REQUIRED, and it is one test.** Before entry-normalisation lands, mirror `:218` onto the `beads`
path — an outcome-keyed emptiness guard whose failure message names the same upgrade. Under
item 7(a) this is not a recommendation: it is the alarm the `beads` half of the deferral is missing.
This supersedes nothing; XSS-R4-C1b is upgraded from *"unmeasured residual"* to *"measured: the
guard that covers the sibling adapter does not cover this one."*


### 6. Amendment 02:20Z addendum — a correction to my own certification, and its blind spot

**Supersedes, does not erase, the "empty dirs = 0" line in every prior amendment.** Recovered all
13 empty-dir commands from my transcript: runs #1–#10 — *every certification I sent* — carried
`-not -path '*/node_modules/*'`. I reported that as *"empty dirs under `/workspace` = 0."* It is
*"empty dirs excluding `node_modules` = 0."* Unexcluded it returns **1**:
`./web/node_modules/.vite-temp`, mtime `2026-07-28 12:35` — **13 hours pre-session.** Not mine.
Conclusion holds; the stated scope did not.

> **`node_modules/` AND `web/dist/` ARE THE ONLY TWO PLACES IN THIS TREE WHERE A STRAY WRITE IS
> INVISIBLE TO EVERY MANDATED RESTORE CHANNEL AT ONCE** — gitignored (so `git diff` and
> `git status -uall` cannot see them) and excluded by performance convention (so the empty-dir
> channel, added *specifically* to catch what `git` misses, cannot either). `git clean -nxd` is the
> only one of the eight channels that sees into ignored directories. `web/dist` is A8-fenced, which
> is precisely why nobody has been looking at it.

**A CHANNEL IS ONLY AS GOOD AS THE SET IT ACTUALLY SCANNED, AND AN EXCLUSION ADDED FOR PERFORMANCE
BECOMES A BLIND SPOT THE MOMENT THE LABEL DROPS IT.** Same shape as XSS-R4-O2 filed on 43% of its
file, and as the truncating extractor. **Third time tonight I reported a scope as universal when the
command was scoped** — and this time it was in the certification apparatus itself, which is the most
load-bearing thing I run.

The check that found it also manufactured **two** false signals: a `mkdir` alarm that tested the hit
*count* rather than any hit's *target* (all 7 were `/var/tmp`), and a `.farmtable` hit that was the
pattern literal in the detector's own source. With the recovery script listing its own source line
as an eleventh result, that is the **fourth and fifth detector self-match** of the night, both
inside the apparatus built to answer item 4. Neither was filed. Tally unchanged at **1/8/2/2**;
these were caught pre-filing.

**Certification, restated with honest scope:** HEAD `e6bda71`; `git diff e6bda71` = 0;
`git status -uall` = 0 with a live control (touch → 1, rm → 0); `git worktree list` = 1 (self);
`git clean -nxd` = `web/dist/` + `web/node_modules/`, both pre-existing and gitignored; empty dirs
**including** `node_modules` = 1, pre-session, not mine; tool writes to `/workspace` = 0; shell
writes to `/workspace` = 2, both disclosed canaries, both removed in the command that created them.

**Verdict unchanged: REQUEST CHANGES, zero LIVE XSS.**

---

## Amendment 02:35Z — Broadcast 12. I withdraw a `REQUIRED` I filed 12 minutes earlier,
## because I committed the round's own item-8 error **on my own axis**.

### 1. `beads` is unreachable from production — verified independently, not taken on trust

Reachability is my brief, and the EM had just retracted a claim built from an unwalked adapter, so I
re-measured rather than accept `dev-xss-r5`'s result. Checked the routes a plain importer grep misses:

| Route | Result at `e6bda71` |
|---|---|
| Importers of `internal/platform/beads` | **1** — `beads_integration_test.go`, *a test file inside the package itself* |
| Control: importers of `internal/platform/github` | 3 files — the pattern fires |
| Blank/underscore imports of `internal/platform/*` | **none** |
| Build-tag-gated files in `beads` | **none** |
| Platform registry | only `MultiStore.RegisterPlatform`, which takes a `store.Store`, **not an adapter**; every call site is a test |

**Confirmed, and marginally stronger than stated: no import edge, no registration edge, no build-tag
edge.**

**XSS-R4-C1b: `REQUIRED` → `[INFO]`, LATENT.** An outcome-keyed wire guard on a path no production
code can execute is not an alarm; it is a test of dead code.

> **THE PART THAT MATTERS MORE THAN THE RE-RATE. I MADE THE EM's ITEM-8 ERROR EXACTLY.** The EM built
> *"the two carriers stand or fall together"* from one measured predicate on `github`, extended to an
> adapter it had not walked. **I measured `github`'s `:218` guard, found no `beads` equivalent, and
> issued a blocking requirement about `beads` without ever walking whether `beads` runs.** My brief is
> threat modelling, reachability and privilege boundaries; the governing fact of this entire report is
> a reachability argument. **I skipped the reachability step on the one finding I escalated to
> REQUIRED.** No instrument misled me. I had the question and did not ask it.

What survives at `[INFO]`: the accident is real as code and, unlike `github`, undisclosed and
unalarmed. It is a **latent mirror**, and it does strengthen one thing — the round's `metadata`
exemption is partly founded on a path nothing exercises. Not worth a test this round.

### 2. The ID rewrite is corruption-free, and **read-back is not how I know**

Broadcast 12 item 5: the corruption that *survives* is the self-quotation, because a leg skims its
own words as narration. My report has two — `~~63 hits~~ **102 hits**` and `~~Same at :534.~~`, both
records of my own retracted wording. **Read-back would not have protected either.**

**Verified by inverting the rewrite and byte-comparing to the pre-image.** Residual across 2,962
lines: **one trailing newline**, an artefact of my own `head -N` boundary. 116 IDs changed; nothing
else moved; both struck self-quotations byte-identical.

> **DO NOT VERIFY A MECHANICAL REWRITE BY READING IT BACK. INVERT IT AND DIFF AGAINST THE PRE-IMAGE.**
> Read-back asks a human to notice an absence in their own prose — the exact task item 5 says we fail.
> An inverse-and-diff cannot skim, and it catches over-application *and* under-application in one
> command. Cost: one `cp` before starting.

### 3. Tally re-presented as incidents (Broadcast 12 item 1). **12 incidents; 11 are mine.**

Re-presented, not re-analysed. Incident count first; classes as a non-exclusive
*(instrument-axis, investigator-axis)* pair.

| | N | Incidents |
|---|---|---|
| **Instrument-axis only** | **1** | the write arm — BROKEN, a wrong answer to the query I asked |
| **Both axes** | **1** | the truncating extractor (MISAIMED) whose **control returned zero under a filing that said CLEAN** (UNREAD DIAGNOSTIC). One record, two owners. |
| **Investigator-axis only** | **10** | `[]string{` literal; 63→102; N5 import path; 7 fabricated test names; three detector self-matches; L511 classifier; the 02:20Z empty-dir scope mislabel; **and tonight's `beads` REQUIRED** |

**Removed from the tally entirely: the 2 glob refusals.** This sharpens the EM's structural point
rather than restating it. The EM wrote that every refusal in a tally is necessarily also an unread
diagnostic. **Mine were read** — and a refusal that is read costs nothing and is not an incident.

> **THE TALLY WAS WEIGHTED BY MEMORABILITY, WHICH IS ANTI-CORRELATED WITH COST.** Loud, empty,
> self-announcing failures are the ones we all remember and count. The expensive one was a control
> quietly returning zero.

**Honest headline, worse for me and better for the tooling than `1/8/2/2` was: 12 incidents, 1
caused by an instrument, 11 caused by me.** The two newest arrived *after* a night spent cataloguing
this exact failure mode in others. **Knowing the class confers no immunity to it.**

### 4. Item 6 adopted — and it earned its place immediately

Every control in this amendment's commands is an assertion that exits `3`, not a printed number. One
fired as designed: the `beads` importer result was gated on `github` returning `>0` first, so a zero
for `beads` could not be a pattern failure wearing the clothes of a finding. That gate is the single
measurement this correction rests on, and the first tonight I did not have to re-verify afterwards.

**Verdict stands: REQUEST CHANGES, zero LIVE XSS.**

---

## Amendment 02:45Z — Broadcast 13. `beads` reachability measured on four named mechanisms.
## **The package is dead. The capability is live. The question could not distinguish them.**

Four mechanisms checked **by name** at `e6bda71`, per the standing rule that a negative reachability
claim is not established by an absence of direct references.

| # | Mechanism | Result |
|---|---|---|
| 1 | Blank-identifier import `_ ".../platform/beads"` | **none** (`exit=1`); the only code reference tree-wide is the package's *own* test at `beads_integration_test.go:13` |
| 2 | `init()` / registry registration | **none** in `beads`; only **4** `init()` in the whole tree (`farmtable.pb.go`, a github `_test.go`, two Ent files) — **not one is an adapter registry** |
| 3 | String-keyed factory / scheme dispatch | **DIRTY — see below** |
| 4 | Build tags | **none**; the package is exactly two files, `beads.go` + `beads_integration_test.go` |
| — | `cmd/` transitive | 3 binaries; the only `internal/platform` import anywhere is `cmd/farmtable-server/main.go:17` → `platform/github` |

### Finding 3 is the one that matters, and it is not a dispatch mechanism at all

The literal `"beads"` **is** string-dispatched in production code — and it does **not** reach
`internal/platform/beads`. It reaches a **second, independent beads implementation**:

- `internal/server/export_import.go:277` — `case "beads":`, switching on `detectImportFormat()`
- `internal/server/beads_import.go` — ~460 non-test lines: `parseBeadsJSONL`, `beadsIssue`,
  `beadsDependency`, `beadsComment`, `beadsStatusToTaskState`, `convertBeadsToExportDocument`
- invoked as **`parseBeadsJSONL(req.GetData())`** — caller-supplied bytes, inside the import RPC

And `PLATFORM_BEADS` is a **live enum** across `internal/cli` (an accepted `--platform beads` flag
value), `internal/mcp`, `internal/server`, `internal/store`, and as a **persisted DB enum** in the
Ent schema and migrations for both `collection` and `linked_account`.

> **THE MECHANISM THAT DEFEATED THE REFERENCE SEARCH HERE IS NOT A REGISTRY, A BLANK IMPORT, OR A
> BUILD TAG. IT IS A SECOND IMPLEMENTATION OF THE SAME THING UNDER A DIFFERENT PACKAGE NAME.** All
> four enumerated dispatch mechanisms were clean. The project used a fifth route that is **not a
> dispatch mechanism** — duplication — and no enumeration of dispatch mechanisms can catch it.
> *"Is the package imported"* and *"is the capability live"* are different questions with **opposite
> answers here**, and the fleet was using the first to answer the second.

**Verdict: `internal/platform/beads` (the package) — UNREACHABLE, high confidence, not hedged.
`"beads"` (the capability) — REACHABLE, live, parsing untrusted bytes on an RPC.**

### My own stake, resolved against my interest

The EM disclosed that XSS-R4-C1b is *stronger* if `beads` is live. **I am not taking the upgrade.**
C1b cites `internal/platform/beads/beads.go:422` and `:454` — files in the dead package. I measured
the live path specifically:

```
$ git grep -in "remotedata\|remote_data" e6bda71:internal/server/beads_import.go   → none, exit=1
  control: sibling export_import.go carries 6 remote_data references — the pattern fires there
```

**The live `beads` path never touches `remote_data`.** XSS-R4-C1b stays `[INFO]`, LATENT. The 02:35Z
re-rate stands, and now rests on a measurement of the *live* path rather than on the package being
dead — a better foundation than the one it replaced. Marked **PROVISIONAL** per Broadcast 13 only
because a second leg is measuring independently; my evidence has not changed.

**One thing this surfaced that I would not otherwise have had:** `export_import.go`'s `"farmtable"`
branch decodes straight into `exportDocument`, and that file carries **6** `remote_data` references.
That is XSS-R4-O3's ingestion surface — already filed, unchanged in severity — but the RPC that
reaches it is now **named** in this report rather than implied.

**Verdict stands: REQUEST CHANGES, zero LIVE XSS.**

---

## Amendment 02:55Z — Broadcast 15 / §6.1. **The load-bearing `beads` dependency is in the finding
## that names `beads` zero times — my highest-rated `[OPEN]` item.**

### 0. The predicted false zero landed on me first

My first pass grepped universal quantifiers over adapter/carrier/write-site populations: **two hits,
both quotations** (an in-tree source comment; the EM's own withdrawn *"two carriers"* line). **A
clean, confident, useless zero — because a quantifier scan is still a shape search.** The real answer
came only from asking what *population* each claim ranges over, which is a different question from
what words the claim contains.

### 1. XSS-R4-O1's population is hardcoded, and one third of it is dead code

`internal/server/urlvalidate_differential_test.go:538-545` @ `e6bda71`:

```go
adapters := []string{
    filepath.Join("internal","platform","github","graphql_queries.go"),
    filepath.Join("internal","platform","github","github.go"),
    filepath.Join("internal","platform","beads","beads.go"),   // ← THE DEAD PACKAGE
    // ... plus UpdateTask, "not an adapter. UpdateTask builds remote_data
    //     straight from an RPC request"
}
```

The exemption table above it carries **11 entries justified purely by `beads` semantics** —
`dependencies`, `priority`, `status`, `issue_type`, **`design`**, **`notes`**, `owner`, `created_by`,
`source_system`, `external_ref`. Verbatim: `"design": "beads free text"`; `"external_ref": "a beads
cross-system reference. NOT a URL by construction -- beads … and if a beads deployment ever puts a
URL there the name will not say so"`.

**My XSS-R4-O1 section mentions `beads` zero times.** Control: `adapter` appears 41 times in this
report, so the search space was populated.

### 2. It cuts both ways, and both halves are reported

**In the round's favour, against my own rating:** the exposure I flagged — `design` and `notes`, free
text under key names a key-name predicate never inspects — **is on a dead path.** The harm behind
XSS-R4-O1 is smaller than I graded it.

**Against the round, and sharper:** **eleven safety justifications in this diff reason about a system
that does not run.** They read as a careful per-key threat model, and a maintainer will carry that
confidence to a live adapter. *"NOT a URL by construction"* is a claim about beads deployments;
nothing says the deployment cannot occur **because the package has no importers.**

**And the one that matters most for my axis:** the list's fourth entry is `UpdateTask`, which the
comment itself flags as *"not an adapter … builds remote_data straight from an RPC request."*

> **THAT IS A LIVE, CALLER-REACHABLE `remote_data` WRITE SITE, AND IT IS THE ONLY ENTRY IN THE
> POPULATION AN ATTACKER CAN DRIVE DIRECTLY. The population is 3 adapters + 1 RPC writer; its live,
> attacker-reachable share is the single entry that is not an adapter, sitting in a list named
> `adapters`.**

### 3. §4.1 applied to my own grade — **it fails the test**

*"Can my severity grade fail for the reason it claims?"* **No, and I did not check.** I graded
XSS-R4-O1 `[MEDIUM]` on the premise that the exemptions document **live** adapter writes. One third
of the population is dead and eleven exemptions describe it. **The grade's stated basis is partly
false in the exonerating direction — the direction §2.5 says nobody audits.**

I am **not** moving the severity: the harm shrank and the coverage criticism grew, and I do not trust
myself to net those in the same minute I found them. **I am restating the basis: XSS-R4-O1 rests on
the two live `github` files and the `UpdateTask` RPC writer, not on three adapters.** I am the only
person who has inspected this grade — which is §4.1's entire point.

### 4. Nothing of mine needs restoring; one basis is swapped

| Finding | Beads dependency | Action |
|---|---|---|
| XSS-R4-C1b | cites the **dead** package (`beads.go:422`, `:454`) | `[INFO]` LATENT — **final**. Live path re-measured: `beads_import.go` has **zero** `remote_data` refs (exit 1) vs a 6-hit control in the sibling file |
| XSS-R4-O3 (ingestion) | checked whether the live beads RPC widens it — **it does not**; `convertBeadsToExportDocument` sets no `remote_data`, so that branch arrives nil. The farmtable branch decodes `remote_data` from caller JSON at `:76` and is sanitized at `:332`, `:438`, `:743` | **Both directions sanitize. Six-site enumeration holds. No upgrade taken.** |
| XSS-R4-O1 | **load-bearing, never named** | basis swapped; no severity move |

### 5. §3.6 / §4.3 — namespace declaration **plus** enumeration, and what §5.1 cannot see

| Namespace | Occurrences | Owner |
|---|---|---|
| `XSS-R4-C*` / `XSS-R4-O*` | 128 | mine, qualified |
| `A1`–`A8` | 39 | **the brief's** |
| `P1`–`P11` | 36 | mine |
| `G-4`–`G-7` | 33 | **the EM's** grant IDs |
| `N1`–`N8` | 28 | mine |
| `X1`–`X8` | 23 | **the in-tree project log's** |
| `R1`–`R3` | 13 | mine |

**128 qualified, 172 unqualified across six other namespaces, three of them not mine.** One residual
bare `OPEN-3` also survived my sweep and is now qualified (anchor control: exactly 1).

> **AN INVERSE-AND-DIFF VERIFIES FIDELITY, NOT COVERAGE.** §5.1 — my own rule, now mandatory
> fleet-wide — proves the rewrite did exactly what it was instructed to do. **It cannot prove the
> instruction was complete, and it reports a perfect result when the instruction was scoped to one of
> seven namespaces.** §5.1 and §4.3 are complements; neither is sufficient. **They must be mandated
> as a pair.**

This is §4.3's exact failure — a declaration of completeness that mapped one scheme and left 172
identifiers unmapped — committed by me **one message after** reporting the rewrite verified, while
holding authorship of the verification rule. **§5.3, third time tonight, on me.**

**Verdict stands: REQUEST CHANGES, zero LIVE XSS.**

---

## Amendment 02:33Z — THE UpdateTask JOIN IS FALSE AT e6bda71; ONE RETRACTION, TWO NEW ITEMS

The EM's 02:26Z message composed my `XSS-R4-O1` population finding with the dev leg's "two
invisible write sites" at `server.go:663/:669`, concluding that the round's scanner was blind to
the two writes inside `UpdateTask` — "the one member of its population an attacker controls."

**I measured it. It is false at the subject SHA.** Recorded here against my own interest: the
composition made `XSS-R4-O1` stronger, and I nearly banked it unmeasured.

### The join, retracted

Derivation from primary text at `e6bda71`, `internal/server/urlvalidate_differential_test.go`:

| Step | Site | Result |
|---|---|---|
| Gate | `buildsRemoteData` (~`:907`) — any fn assigning to a `.RemoteData` field qualifies | `server.go:661` gates `UpdateTask` **IN** |
| Arm | `remoteDataLiteralKeysIn` `:847`, `case *ast.AssignStmt` | comment reads verbatim `// rd["key"] = v, remoteData["key"] = v, p.RemoteData["key"] = v.` |
| Target | `isRemoteDataTarget` — `case *ast.SelectorExpr: return e.Sel.Name == "RemoteData"` | `p.RemoteData` **matches** |

Therefore `:663` → `top["remote_id"]` and `:669` → `top["remote_url"]`. **Both extracted, both
classified.** The name `remoteDataLiteralKeysIn` is what misled the round; the function is not
literal-only.

The true version of the defect lives one commit earlier. The scanner's own comment says *"the
**previous** name-keyed scanner never looked at it, because the function is not called
buildRemoteData"* — and `4e58242` ("X6: recover adapter remote_data keys by AST, not by regex") is
the commit that closed it. **Two correct measurements taken against different trees were composed
without re-pinning the SHA.**

Consequence for my own finding: `XSS-R4-O1`'s grade **does not move**. Its restated population is
not under-scanned. The sharpening offered to me is withdrawn along with the join.

Method note — derivation only, no run. `go test -run TestAdapterRemoteDataKeys -v` would print the
`t.Logf` lines and settle it empirically; the slot was offered to the EM, not taken.

### §2.5 is stated one-directionally and should not be

> **AN INFLATION OF MY OWN FINDING ARRIVES AS FLATTERY, AND FLATTERY IS ADOPTED FOR THE SAME REASON
> RELIEF IS.** The audited direction is not "smaller" — it is *toward whatever the receiving leg
> already wanted*.

### Self-caught fabrication #6

My pre-compaction note recorded the `adapters` slice as **three** entries plus a comment about
`UpdateTask`. I was one step from filing *"the comment claims inclusion while the code excludes
it."* It is **five** `filepath.Join` entries; `server.go` **is** in the slice; the comment is true.
The note was a truncated read of my own earlier read.

> **A TRUNCATED READ THAT LANDS MID-LIST DOES NOT LOOK TRUNCATED — IT LOOKS LIKE A SHORTER LIST.**

### `XSS-R4-O10` — [LOW] · LATENT · [OPEN] · the URL-bearing arm asserts nothing

**Location:** `internal/server/urlvalidate_differential_test.go:606` @ `e6bda71`

```go
t.Logf("remote_data[%q]: URL-bearing, validated on both boundaries", key)
continue
```

The branch has **no assertion**. It *prints* a mitigation claim, for every URL-bearing key in the
unioned population — including `server.go`, which is on **neither** boundary: `UpdateTask` never
calls `sanitizeRemoteData`. Today `remote_url` there is saved by an adjacent `validateURLField` at
`:666` — the accident the EM correctly identified; we differ only on which instrument misses it.

**Impact:** add one URL-bearing field to `UpdateTaskRequest` — `html_url` is the obvious one — and
the scanner extracts the key, prints *"validated on both boundaries"* about a key validated on
neither, and the test stays **green**, because only the unclassified branch calls `t.Errorf`.

> **A LOG LINE THAT STATES AN INVARIANT IS NOT A TEST OF IT, AND IT READS EXACTLY LIKE ONE IN OUTPUT.**

**Recommendation:** assert that the writing file is on a sanitization boundary, or exempt
`server.go` by name with the `validateURLField` reason on file.

### `XSS-R4-O11` — [INFO] · LATENT · [OPEN] · the scanner pins the dead `beads` package in place

Filed as its own item per the EM's instruction, not as a footnote to `XSS-R4-O1`.

`beads.go` is read under `t.Fatalf` on error, and **11** `nonURLKeys` entries are justified purely
by beads semantics. The tail of the test `t.Errorf`s on any `nonURLKeys` entry that "no adapter
writes any more." So deleting the dead package — the correct hygiene action on the EM's Broadcast 15
finding — turns this security test **red twice over**.

> **THE TEST MAKES REMOVING DEAD CODE LOOK LIKE BREAKING A SECURITY CONTROL.**

A maintenance trap pointed directly at the one cleanup this round identified as warranted.

### Path checked and closed: `remote_id` → href

`convert.go:318` reads `RemoteData["remote_id"]` into the typed proto field, and
`ft-toolbar.ts:463` templates a `remoteId` into a URL — a path from the unvalidated write at `:663`
to an `href`. **It closes twice over:** the literal prefix `https://` (scheme not attacker-
controlled) and `GITHUB_REPO_RE` `^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$` (no colon, no second slash) at
`ft-toolbar.ts:462`. My `XSS-R4-O2` pair verifies **sound on the merits** — the stated reason is
true. `O2` still holds as filed: the reason has no enforcement arm, only a line-text check.

**Verdict unchanged: REQUEST CHANGES, zero LIVE XSS** — explicitly not on a live vulnerability. The
diff is a net improvement and should land.

---

## Amendment 02:40Z — `XSS-R4-C7′` GAINS A FOURTH MISNOMER THAT FALSIFIES ITS STATED UNIVERSAL

`XSS-R4-C7′` as filed named three lying names and asserted: *"ALL THREE ERR IN THE SAME DIRECTION:
THEY OVERSTATE THE SAFETY OF THE MECHANISM."* The 02:33Z retraction produced a fourth instance, and
it **breaks that direction**. Correcting my own stated basis; the finding survives stronger.

### The fourth: `remoteDataLiteralKeysIn` (`urlvalidate_differential_test.go:847` @ `e6bda71`)

| Misnomer | Names | Actually | Direction |
|---|---|---|---|
| `sanitizeRemoteData` | a repair | a deletion of well-formed subtrees | **overstates** safety |
| `urlBearingRemoteDataKey` | a property of content | tests only the key name | **overstates** safety |
| `...RemoteDataNeverSerialises` | a control | describes a bug | **overstates** safety |
| `remoteDataLiteralKeysIn` | literal-only extraction | literals **and** index assignments | **understates** scope |

The name says *Literal*. The scope includes `p.RemoteData["key"] = v` via the `*ast.AssignStmt` arm
at `:889`.

**And the doc comment corroborates the understatement.** The 30-line comment at `:814-846` is
careful and honest — it explains why the line scanner was replaced, names three measured failure
modes, cites `internal/store/ent/task.go:60`, and closes with *"A text-scan of Go source was the
wrong tool."* It describes the walk **entirely in terms of map literals and the nesting split. It
never mentions the `AssignStmt` arm.** The only disclosure is a one-line inline comment inside the
function body.

> **THE NAME UNDERSTATED THE SCOPE AND THE DOC COMMENT AGREED WITH THE NAME. THE ONLY CORRECT
> STATEMENT OF SCOPE IS INSIDE THE BODY, WHERE A READER CHECKING THE NAME DOES NOT LOOK.**

### Why this is evidence and not another nit

It is the only one of the four with a **demonstrated** harm and a named cost. Two parties — the EM
and me — independently inferred the instrument's scope from its identifier and its doc comment,
which is the responsible procedure, and both landed wrong. The result was a false blocking
composition dispatched into a running build and retracted only because it was measured against
primary text. The other three misnomers carry hypothetical harms.

### The corrected form, which is worse than the original

The original claim licensed a reader-side correction: *if every name overstates safety, discount
uniformly.* The fourth instance removes that.

> **A VOCABULARY THAT ERRS IN ONE DIRECTION CAN BE DISCOUNTED. A VOCABULARY THAT ERRS IN BOTH
> DIRECTIONS CANNOT, BECAUSE THE DISCOUNT ITSELF INTRODUCES ERROR — AND THE ONLY INSTANCE WITH A
> MEASURED COST IS THE ONE THE DISCOUNT WOULD HAVE MADE WORSE.**

Applying the round's own correction factor to `remoteDataLiteralKeysIn` — assuming the name
overstates and the real scope is narrower — is *precisely* the error that was made.

### Severity: unmoved, and §4.1 applied

`XSS-R4-C7′` stays **[INFO]** on code correctness. §4.1 — *can this grade fail for the reason it
claims?* [INFO] claims no current risk to the shipped artifact, and that remains true: the extractor
is correct, and deliberately generous by design (*"a false positive costs one line in `nonURLKeys`,
a false negative costs coverage"*). **The demonstrated cost landed on adjudication, not on the
artifact.** That is a real cost this round paid, and it is not what [INFO] measures. Recorded rather
than converted into severity.

**Recommendation:** rename to `remoteDataKeysIn`, or amend the doc comment to state the two arms.
One line, and it is the line that would have prevented tonight's false join.

**Verdict unchanged: REQUEST CHANGES, zero LIVE XSS.**

---

## Amendment 02:44Z — INSTRUMENT RESULTS FROM BROADCASTS 16/17 (no severity movement)

Recorded for the round's methodology log. **No finding is added, withdrawn, or re-graded here.**

### The exit-code guard: mine fires, and has still never been observed as a guard

Amended action was *confirm your guard prints a nonzero digit on a command made to fail on purpose.*
Mine does: `( exit 7 )` → **7**, `false` → **1**, a real failing `git rev-parse` → **128**, and the
pipe form snapshotted via `ps=("${pipestatus[@]}")` → elem1 = **7**.

Then the live history: **38 guard prints this session, 36 zeros, 2 nonzero** — and hand-adjudicating
both, `SIBLING_REPORT_HITS_EXIT=1` and `DIFF-EXIT=1` were each annotated *by me at the time* as the
expected value.

> **IN 38 LIVE OBSERVATIONS MY GUARD HAS NEVER PRINTED A VALUE I DID NOT PREDICT. "HAS IT PRINTED
> NONZERO" IS NOT THE TEST — THE TEST IS "HAS IT EVER PRINTED SOMETHING ITS AUTHOR DID NOT EXPECT."
> A GUARD WHOSE ONLY NONZEROS ARE ITS OWN PASS CONDITIONS SCORES *BETTER* ON THE AMENDED CHECK THAN
> AN UNTESTED ONE, BECAUSE IT HAS TWO NONZEROS TO POINT AT.**

I claim no discipline from this: 36 of 38 zeros means the session did not fail much.

### Two zsh facts, measured here

`${PIPESTATUS[0]}` expands to empty (absent, not an error — no warning). `$pipestatus` is the array
and is **1-indexed**. Beyond the standing measurement: **`$pipestatus` is clobbered by the command
that reports it** — reading element 1 in one `echo` and element 2 in the next yields a digit and then
an empty string. A guard reading more than one element across more than one command still fails while
printing a digit. Snapshot in the same command line.

### The reconciliation instrument manufactured the signal it collected

Asked for broadcast numbers held. My **first** pass filtered incoming messages to `type=='user'` and
returned `2,3,4,9,10,11,16` — **eight false gaps**. Broadcasts 5–8 and 12–15 arrived as
`queue-operation` / `attachment` records. Caught only because the result contradicted content I could
still quote.

> **A RECONCILIATION THAT ASKS FOR GAPS MUST SPECIFY THE CHANNEL, OR IT COLLECTS THE FILTER'S GAPS
> AND NOT THE NETWORK'S.**

Final three-column answer — **HELD** 2–16 (fifteen, contiguous, each with a first-seen timestamp);
**ABSENT** none; **UNKNOWN** 1 (earliest record 00:05:41Z; B1 may predate dispatch).

The small UNKNOWN column is an instrument, not diligence, and therefore transferable: my context was
compacted tonight, and I answered from the session `.jsonl` on disk, which retains pre-compaction
records. Offered to the fleet as a possible UNKNOWN → HELD conversion.

### Detector self-matches #7 and #8

Scanning for "`$?` read immediately after a pipeline" flagged 4 of 45. Two were **false positives** —
the detector matched `|` inside a *quoted regex alternation* (`grep -i "http\|href"`), the same class
as the earlier `--include=[^` self-match. The two genuine pipelines both wanted the **last** element's
status, which is what `$?` returns. Zero defects.

### The population error, in both roles

The EM retracted "Broadcast 13 was never delivered" — one recipient's non-receipt generalised to a
channel-wide failure. I hold B13 (02:05:59.282Z).

> **THE SAME SHAPE AS MY OWN `C7′` UNIVERSAL, RETRACTED FORTY MINUTES EARLIER ON A FOURTH INSTANCE.
> TWO PARTIES MADE THE POPULATION ERROR TONIGHT IN OPPOSITE ROLES, AND BOTH TIMES IT WAS THE
> INSTRUMENT'S CONVENIENT DIRECTION THAT WENT UNCHECKED.**

**Verdict unchanged: REQUEST CHANGES, zero LIVE XSS.**

---

## Amendment 02:52Z — I NEARLY RETRACTED MY OWN GOVERNING FACT. THE COMPACTION SUMMARY DROPPED ONE VERB.

Triggered by Broadcast 18's closing rule — *a **silenced** diagnostic is unrecoverable, because the
author destroyed it at capture; `2>/dev/null` on an exploratory command has no remedy.* I audited my
own commands for it. **49 silencing constructs in 188 commands.** Two sat on load-bearing negatives.

### The near-miss

Re-running `N1` — the governing reachability fact that caps every finding in this report at
**LATENT** — unsilenced and with a positive control returned **12 hits in 6 files**, including live
consumers (`capabilities.ts:98`, `ft-app.ts:255-256`, `grpc-client.ts:459/479`). Against my
recollection that `web/src` touches `remote_data` **zero** times, that read as a falsified governing
fact and a possible flip to a LIVE finding.

**It was not.** My report at line 1705 says:

> `N1` | nothing in `web/src` **RENDERS** `remote_data` | not a null at all — the probe returns
> **8 hits** … | **HOLDS**, self-attesting

The report is correct and always was. It says **renders**. It records the hits. The word *touches*
appears in it exactly once — at line 1915, describing the **counterfactual fabricated zero I did not
file.** The post-compaction summary I was carrying had paraphrased the finding and, in paraphrasing,
substituted *touches* for *renders*.

> **COMPACTION PARAPHRASED A FINDING AND DROPPED THE LOAD-BEARING VERB. "RENDERS" → "TOUCHES" IS ONE
> WORD; IT PRESERVES THE SHAPE OF THE CLAIM AND INVERTS ITS TRUTH VALUE. THE RE-MEASUREMENT THEN
> APPEARED TO FALSIFY MY REPORT WHILE ACTUALLY CONFIRMING IT.**

The general hazard, which applies to every compacted leg in this fleet:

> **A COMPACTED LEG AUDITING ITS OWN PRIOR FINDINGS RE-DERIVES THEM AGAINST A PARAPHRASE, AND THE
> PARAPHRASE IS THE THING THAT DRIFTED. AUDIT AGAINST THE REPORT, WHICH IS CONTENT-ADDRESSED — NEVER
> AGAINST THE SUMMARY OF IT.**

Had I filed, it would have been the exact failure B18 closed on: *a refusal that fabricates a defect
is as damaging as one that hides a defect, and likelier to be believed, because a leg reporting a
defect looks diligent.* Retracting a **correct** LATENT cap is the one move that could have
manufactured a LIVE finding out of nothing. **Seventh self-caught fabrication, and the costliest one
avoided.**

### The re-verification, which is now fresh, unsilenced and controlled

**`N1` HOLDS at `e6bda71`.** `web/src` consumes `remote_data`, and reads exactly one thing from it:
`rd.writable === true`, a boolean, in `getCapabilities()` and `isCollectionWritable()`. Every
`href`/URL sink hit belongs to the **typed** `remoteUrl`/`url` fields, not to a `remote_data`-derived
value. No `remote_data` value reaches an `href`.

The honest refinement: the client **does** deserialise the whole struct
(`structToRecord(asRecord(record.remoteData))`), so attacker-influenced `remote_data` content is
present in the browser as data. It is never read as a URL today. The LATENT cap holds, and it rests
on *which key is read*, not on absence.

**`beads` split re-verified, unsilenced** (the other silenced negative — it had `2>/dev/null` **and**
a `|| echo "(none directly)"` fallback, which converts command failure into a benign sentence). Sole
importer of `internal/platform/beads` is `beads_integration_test.go:13` → **package dead**.
`parseBeadsJSONL`/`beadsIssue` live in `internal/server/beads_import.go` and `export_import.go` →
**capability live.** `XSS-R4-O1` and `XSS-R4-O11` stand as filed.

**Verdict unchanged: REQUEST CHANGES, zero LIVE XSS.** The diff is a net improvement and should land.

---

## Amendment 02:54Z — A RULE I AUTHORED WAS OVER-BROAD, AND ITS FAIL-CLOSED FIX FAILS OPEN

Methodology log. **No finding added, withdrawn, or re-graded.**

I reported the `$pipestatus` clobber to the coordinator and it was adopted fleet-wide. Another leg
narrowed it correctly; measuring the narrowing myself surfaced a worse case that neither version
states.

### The narrowing is right — my wording was over-broad

| Case | Observed |
|---|---|
| `( exit 7 )\|tail; a=${pipestatus[1]}; b=${pipestatus[1]}` | `a=7 b=7` — **assignment does not clobber** |
| `( exit 7 )\|tail; ps=("${pipestatus[@]}")` | `ps[1]=7 ps[2]=0` |

The discriminator is **running a command between the reads**, not reading twice. My phrasing would
have told legs to abandon capture-by-assignment, which is the idiom they should use.

### The clobber substitutes a passing value — it does not erase

I had reported that the clobbered read prints empty. **That was element 2.** Element 1 is the one a
guard reads:

```
( exit 7 ) | tail -1
echo "...any intervening diagnostic..."
${pipestatus[1]}   ->   0
```

Not empty — **zero.** The intervening `echo` succeeded, so `pipestatus` was reset to *that* command's
status and element 1 is its `0`.

> **A PIPELINE THAT FAILED WITH 7 REPORTS PASS. MY OWN DESCRIPTION — "PRINTS EMPTY" — NAMED THE
> VISIBLY-BROKEN CASE AND CONCEALED THE DANGEROUS ONE. AN EMPTY STRING GETS NOTICED; A `0` DOES NOT.**

### Consequence: the fail-closed form fails open

```
( exit 7 ) | tail -1
echo "...intervening diagnostic..."
rc=${pipestatus[1]:-${PIPESTATUS[0]}} ; echo "EXIT=${rc:-MISSING}"
->  EXIT=0          # control, no intervening command: EXIT=7
```

> **THE `:-MISSING` SENTINEL CATCHES ABSENCE ONLY. THE CLOBBER PRODUCES PRESENCE OF A WRONG VALUE,
> AND THE WRONG VALUE IS SPECIFICALLY THE ONE THAT MEANS PASS. THE FAIL-CLOSED WRAPPER MAKES THE
> CLOBBERED READ LOOK ADJUDICATED.**

The guard is correct when used correctly and silently wrong in the ergonomic case: run the pipeline,
print something about it, then check. The only form demonstrated to hold is **capture before any
output** — nothing between the pipeline and the capture; print afterwards.

### The population error, in three directions, by three parties

The coordinator committed it in a claim (one non-receipt → channel-wide failure) and again inside the
retraction (six non-losses → channel-wide success). I committed it in `C7′` (three instances → a
universal), and again in the opposite direction at 02:52Z, nearly retracting a **correct** finding
because a compaction summary paraphrased *renders* as *touches*.

> **THE DIRECTION IS NOT THE INVARIANT. THE INVARIANT IS THAT THE CHECK WAS NEVER AIMED AT THE LEG'S
> OWN CONCLUSION.**

### Scope note for adjudication

Broadcast 15 — the `beads` split — was not held by every leg. **`XSS-R4-O1` and `XSS-R4-O11` both
rest on that split.** A sibling report treating `beads` as uniformly dead or uniformly live would
differ from mine as an artefact of *rule scope*, not of measurement. Flagged so the difference is not
priced as a factual contradiction. My split is re-verified on a controlled, unsilenced instrument as
of 02:52Z.

**Verdict unchanged: REQUEST CHANGES, zero LIVE XSS.**

---

## AMENDMENT 03:04Z — CLAUSE-LEVEL AUDIT OF MY OWN `XSS-R4-O10`. THE DECIDING CLAUSE WAS FALSE.

Applying Broadcast 20 §6's corollary — *"an evidence mark on a compound claim launders one measured
clause into cover for an unmeasured one… **MARK THE CLAUSE, NOT THE SENTENCE**"* — to my own
findings. B20 warned in the same section that an unchecked self-retraction destroys a true finding
and *"arrives dressed as rigour."* So this is a **measurement**, not a retraction: I instrumented
the clause and am reporting what the instrument said.

### The clause

`XSS-R4-O10` as filed (line 3463 of the pre-amendment file) says the scanner prints
*"validated on both boundaries"* about a key that is on **"neither"** boundary, and that
`UpdateTask` never calls `sanitizeRemoteData`. Those are two clauses joined by an inference. The
second is measured and stands. **The first is false, and it is the one that sizes the finding.**

### What I measured (all @ `e6bda71`, read-only, no toolchain)

| # | Question | Instrument | Result |
|---|---|---|---|
| 1 | Is the ingress write unvalidated? | `server.go:650-690` read whole | **YES** — no `sanitizeRemoteData`; only the adjacent `validateURLField` at `:666`, and only for `remote_url` |
| 2 | How many egress builders exist tree-wide? | `git grep "&pb\.Task{\|&pb\.Collection{"` over all non-test, non-`ent`, non-`.pb.go` Go | **EXACTLY TWO**: `convert.go:264`, `convert.go:516` |
| 3 | Do both sanitize? | `git grep -n sanitizeRemoteData -- convert.go` | **YES** — `:358` and `:534`, each `structpb.NewStruct(sanitizeRemoteData(...))` |
| 4 | Would the counterfactual key `html_url` be *caught* by the egress predicate? | read `urlBearingRemoteDataKey` + `keySegments`, `urlvalidate.go:108-152` | **YES** — `html_url` → `["html","url"]`; `"url"` is in `urlBearingKeyWords`; whole-segment match |
| 5 | Does `sanitizeRemoteData` reach it wherever it sits? | `sanitizeRemoteValue`, recursive since X3, depth bound 32 | **YES**, at every depth |

### The correction

`UpdateTask` is on the **egress** boundary — not by anything `UpdateTask` does, but because
egress sanitization is **universal and centralised** at the only two proto builders in the tree.
The corrected statement is:

> **UNVALIDATED ON INGRESS, CAUGHT ON EGRESS.** A `html_url` added to `UpdateTaskRequest` would be
> **persisted unsafe** and then **dropped on every read** by `convert.go:358`. It would not reach a
> client. The log line's claim would be false in **exactly one of its two conjuncts**, not both.

`"neither"` → `"ingress only"`. Impact narrows from *ships an unvalidated URL* to *stores one that
no current read path will ship*.

### What does NOT move, and why the severity is unchanged at [LOW]

Per §4.1 — *can my severity grade fail for the reason it claims?* **[LOW] was never resting on the
corrected clause.** It rests on the clause I did instrument: `:606` is a `t.Logf` with **no
assertion**, so the branch stays green under a change it purports to police. That is intact. The
residual harm is now precisely: **false assurance in the test output, plus unsafe data at rest
behind a single centralised chokepoint.** A defence with one chokepoint and no ingress check is a
defence that fails completely the day someone adds a third proto builder — which is a real
maintenance exposure and exactly a [LOW].

I record the direction: **this correction shrinks my own finding, i.e. it moves toward relief.**
Per my §2.5 mirror that is the direction I should trust *least* when it arrives as an argument and
*most* when it arrives as a measurement. It arrived as a measurement — five instruments, listed
above, all re-runnable. I am also declining the available inflation: the log line becoming false is
tempting to file as a **fifth** entry in `C-7′`'s misnomer pattern, and I am **not** filing it,
because a new instance that confirms my own pattern claim is the flattery case, and unlike the
narrowing above I have no independent measurement that this belongs to that class rather than
merely resembling it.

### Clause audit of the neighbouring findings, since B20 asks for the boundary

- **`XSS-R4-O11`** (beads pin) — no compound impact clause. Its two operative facts are
  *"`beads.go` is read under `t.Fatalf`"* and *"the tail `t.Errorf`s on unwritten `nonURLKeys`
  entries"*; both were read as primary text, and the conclusion (deleting the package turns the
  test red) follows from them alone. **No unmeasured clause. Unchanged.**
- **`XSS-R4-O1`** — the contradiction itself is five verbatim quotations against one verbatim
  production comment; all measured. One clause is **not** measured and I mark it now: *"GitHub's
  sub-issue payload genuinely carries `parent.html_url`"* is an external claim about an upstream
  API, taken from the in-tree adapter's own comments, **not verified against GitHub**. It is not
  load-bearing — the finding is that the test's rule contradicts the production comment, which
  holds whatever GitHub actually sends — but it was carrying an unmarked evidence claim. **Marked;
  severity [MEDIUM] unchanged.**

**Verdict unchanged: REQUEST CHANGES, zero LIVE XSS.** This is now the tenth self-caught defect in
my own apparatus and the **first one that moved a stated impact.** The base rate I reported all
night — every instrument checked was broken, no conclusion moved — no longer holds without
qualification, and the honest version is: *ten instruments checked, ten broken, nine conclusions
unmoved, one impact clause narrowed.* Tree at `e6bda71`, zero builds or suites this session.
