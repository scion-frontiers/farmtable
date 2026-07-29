# XSS ROUND 5 — SECURITY AUDIT LEG

I measured a fresh full clone at **`/workspace/farmtable-xss-r5-audit`** (branch `audit-leg-xss-r5`,
created off the cloned `url-scheme-validation-r5` so the reviewed ref cannot move), and
`git rev-parse HEAD` there returns **`d305391ee6dc473f5e7bf202167221e15cf52e10`**.
`git rev-list --count e6bda71..HEAD` = **13**. Working tree clean at clone time. The author's tree
at `/workspace/farmtable-dev-xss-r5` was read only via `git clone --no-local` and one
`--git-dir` rev-parse; I wrote nothing to it, and its `url-scheme-validation-r5` ref still reads
`d305391ee6dc473f5e7bf202167221e15cf52e10` after my work. No production file in any tree was modified.

---

## 0. VERDICT

**APPROVE.**

**Blocking findings: NONE.** No CRITICAL and no HIGH against this diff.

The diff is far smaller than the brief's framing implies. Of the two production files touched,
**`urlvalidate.go` is comment-only** — I verified this by stripping the diff of `+++/---` headers,
comment lines and blanks, and the residue is empty. The *entire* production behaviour change in
13 commits is one substitution in `convert.go`:

```
pt.RemoteData, _ = structpb.NewStruct(sanitizeRemoteData(t.RemoteData))
    ->  pt.RemoteData = structOrNilLoggingErr(sanitizeRemoteData(t.RemoteData), "task.remote_data")
```

and the identical change for `collectionToProto`. Wire behaviour is unchanged by construction: nil
then, nil now. Everything else is tests and prose. **A round that changes no wire behaviour cannot
introduce an XSS regression, and it did not.** My findings are therefore about the *claims*, the
*instruments*, and one genuinely new sink (a log statement), not about a broken guard.

My highest-severity items are **MEDIUM** and the most important of them is not a defect in the
diff at all — it is that this round hardened a field with **zero render sinks** while the field
that has a raw-HTML sink went untouched (F1).

---

## 0.1 CONTAMINATION DISCLOSURE — READ THIS BEFORE YOU READ MY TAGS

**My dispatch message and the brief gave contradictory instructions and I obeyed the wrong one.**

- Dispatch: *"READ THE BRIEF FIRST AND IN FULL."*
- Brief §1: *"DO NOT READ SECTION 4 UNTIL YOU HAVE FINISHED [PASS 1]."*

I read the brief in full, in one `Read` call, before looking at any code — including section 4.
**So I was primed with all six disclosed weakness classes before Pass 1 began.** There was no point
at which I was an uncontaminated Pass-1 reader.

I am not going to launder this. My tagging rule, applied honestly after the fact:

- **`[PASS-1]`** = a finding I reached from the code by a route that does not correspond to any
  section-4 item, and which I can point at a specific artefact I opened to get there.
- **`[PASS-2]`** = anything that is an instance of a class section 4 named, **even where I believe
  I would have found it anyway.** When in doubt I tagged PASS-2.

The net effect is that my PASS-1 tags are probably *conservative* (some may be genuinely
independent), and my PASS-2 tags are worth less than a clean leg's would be. **Weight my PASS-1
findings, discount my PASS-2 ones, and note that the section-4 items I "confirmed" are exactly the
retrieval effect the brief warned about — I cannot distinguish my confirmation from retrieval and
neither should you.** This is written up again in WHERE MY BRIEF WAS WRONG.

---

## 1. PRE-REGISTERED FALSIFIERS AND THEIR OUTCOMES

Written to `/workspace/farmtable-xss-r5-audit/PREREG.md` **before** the corresponding measurements.
Five hypotheses; **two refuted, one confirmed-as-soundness, one confirmed, one split.** Reported
whichever way they came out, per the brief.

### H4 — REFUTED. "The new log statement is an attacker-controlled data sink." IT IS NOT. `[MEASURED]`

This was my best CRITICAL candidate and **it is not there.** I am writing it up as a finding
because the brief is right that this is the kind of result that silently disappears.

**What I suspected.** This round converts a discarded error (`_`) into
`log.Printf("%s dropped: sanitized remote_data is not structpb-representable: %v", field, err)`.
That is a brand-new sink for a `structpb` error string on a path fed by GitHub-controlled data.
I recalled `structpb` formatting invalid-UTF-8 *values* with `%v` (unquoted), which would write an
attacker-controlled GitHub string — newlines and all — raw into the application log. That is log
injection: forged log records, poisoned log-aggregation parsing.

**What would have shown it.** The verbatim format strings in the *installed* version's
`NewValue`/`NewStruct`. Not my memory of them — the brief is explicit that a correct-sounding
justification is what stops a careful reader looking further, and "I remember the format verb" is
one of those.

**What I did.** `go.mod` pins `google.golang.org/protobuf v1.36.11`. The module cache was empty, so
I ran `go mod download google.golang.org/protobuf` (a module fetch, **not** a fenced build) and read
`types/known/structpb/struct.pb.go` from the module cache directly.

**Result — every error path in `NewValue`/`NewStruct` is safe:**

| error site | format | attacker content? |
|---|---|---|
| invalid UTF-8 in a **key** (`NewStruct`) | `"invalid UTF-8 in string: %q"` | quoted+escaped |
| invalid UTF-8 in a **string value** (`NewValue`) | `"invalid UTF-8 in string: %q"` | **`%q`, not `%v` — I was wrong** |
| bad `json.Number` | `"invalid number format %q, expected a float64: %v"` | quoted |
| unsupported type | `"invalid type: %T"` | **type name only, no content** |

`%q` escapes `\n`/`\r`, so **there is no CRLF log-injection primitive here.**

**And it is doubly refuted.** The error that actually fires on the passthrough path is
`invalid type: []string` — a constant string containing no input at all. The invalid-UTF-8 branches
are additionally unreachable in practice: every string on this path arrives through `encoding/json`,
which replaces invalid UTF-8 with U+FFFD, so `utf8.ValidString` cannot fail. `[REASONED, NOT
MEASURED]` on the U+FFFD step — I did not exercise a raw invalid-UTF-8 byte sequence end to end.

**H4 is refuted twice over. The new log line discloses nothing.** F2 below is a *volume* finding
about the same line, and it is a different claim; I have kept them separate on purpose.

### H3 — CONFIRMED as a soundness result. `[MEASURED]`

**This is the strongest positive thing I can say about the design, and it is the real reason
XSS-R4-O1 is non-exploitable.** I want it stated precisely because it is easy to overclaim.

`sanitizeRemoteValue`'s generic switch ends in **`default: return v, true`** — any type it has no
case for is **passed through completely unexamined**. It walks exactly `map[string]any`, `[]any`,
and `[]map[string]any`. So `map[string]string{"html_url": "javascript:alert(1)"}` is *not* walked.
That looks alarming, and the question is whether structpb catches what the walk misses.

I enumerated `structpb.NewValue`'s type switch from source rather than from memory. The complete
set of representable types is: `nil`, `bool`, `int/8/16/32/64`, `uint/8/16/32/64`, `float32/64`,
`json.Number`, `string`, `[]byte`, **`map[string]any`**, **`[]any`**. Representability is recursive
— `NewStruct` -> `NewValue` -> `NewStruct`/`NewList`.

**Therefore: the only *container* types structpb accepts are `map[string]any` and `[]any`, and the
sanitizer walks both.** It follows that for any value structpb accepts, every container node in it
was visited by the sanitizer. The composition is fail-closed on both branches:

- sanitizer walked every node -> URLs validated -> struct ships **clean**; or
- sanitizer skipped a node (unwalked type) -> that same type makes `NewStruct` fail -> field is
  **nil**.

**There is no third branch.** `[]map[string]any` is walked but *not* representable — harmless
over-coverage.

**What this result does NOT cover, stated in the same breath, because a narrow true claim announced
in a security context gets remembered as the broad one:** this argument holds **only where structpb
is downstream.** It says nothing about `sanitizeRemoteData`'s four call sites in `export_import.go`,
which serialise to **JSON**, where the `default: return v, true` blind spot has **no backstop at
all** — `encoding/json` marshals `map[string]string` happily. See H2/F5.

### H2 — REFUTED, but on a precondition nothing pins. `[MEASURED]` + `[REASONED]`

Suspected: the export path (`sanitizeRemoteData` -> JSON, no structpb) exposes the H3 blind spot.

Refuted by a gate I measured: `exportCollection` rejects anything that is not
`collection.PlatformFarmtable` (`"export only supports farmtable platform collections"`), so
GitHub-platform collections — the ones whose builders emit Go-native `[]string`/`[]map[string]any`
— **cannot be exported.** Tasks in a farmtable collection arrive from JSON import or from a structpb
request, both of which yield only `map[string]any`/`[]any`/scalars, so the sanitizer walks
everything. `[REASONED, NOT MEASURED]` — I did not enumerate every writer into a farmtable-platform
collection. Recorded as F5 (LOW), because the thing standing between here and a real bug is an
**input-type precondition that no instrument enforces**.

### H1 — SPLIT. C-1 holds where it is claimed; it does not generalise. See §2 and F3.

### H5 — CONFIRMED. See F2.

---

## 2. THE C-1 QUESTION, ANSWERED DIRECTLY

> *"If a value can reach that path already structpb-representable, the guard is decorative."*

**C-1 HOLDS. I attacked it and it did not break. The guard is real, not a formality, and — contrary
to what I expected — it IS pinned end to end.** Measurements:

**Carrier 1, `labels`, is genuinely unconditional.** `[MEASURED]` — `issueLabels` in
`graphql_queries.go` is `labels := make([]string, len(issue.Labels.Nodes))`. `make` with length 0
returns a **non-nil, empty `[]string`**, not `nil`. And `issueBuildRemoteData` sets `"labels":
issueLabels(issue)` **inside the map literal itself**, not under any `if`. So *every* passthrough
`remote_data` contains a `[]string` at the top level, even for an unlabelled issue. `[]string` has
no case in `NewValue` -> `invalid type: []string` -> field nil. Verified against the enumerated type
switch, not assumed.

**Carrier 2, `sub_issues`, is real but conditional.** `[MEASURED]` — `[]map[string]any`, also with
no `NewValue` case. It is written only under `if len(issue.SubIssues.Nodes) > 0`, so it is a genuine
*second* carrier but it is not independently load-bearing. The round's own test says exactly this.

**My attack, and why it failed.** I expected to find the property pinned only by hand-copied
synthetic literals. `TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` **does** assert
against literals typed out in the test, and **no test in the repository calls `issueBuildRemoteData`
or `issueLabels` at all** — I checked, and every hit in a `_test.go` file is a `//` comment or the
one string `"issueBuildRemoteData"` in `remoteDataBuilderFuncs`. The AST scanner that *does* read
the real builder extracts **keys only** (`stringLit(kv.Key)`); it never inspects `kv.Value`, so it
is blind to a `[]string` -> `[]any` change. On that evidence I was going to report that C-1's
instrument measures the protobuf library rather than farmtable.

**That report would have been wrong, and I checked before writing it.**
`TestPassthroughReadDropsUnsafeRemoteURL` in `passthrough_url_test.go` drives the **real passthrough
store end to end through `ListTasks`** and asserts
`if n := len(poisoned.GetRemoteData().GetFields()); n != 0`. If anyone changes `issueLabels` to
return `[]any`, `NewStruct` starts succeeding, `remote_data` ships ~9 fields, and **that assertion
goes red.** So the answer to section 4 item 4's "what goes red if it changes?" is: **that test
does.** Its failure message even tells the next engineer what to do
(*"the assertions here must be upgraded from this guard to real absence checks"*).

**Conclusion: the representability check is a genuine guard, it is load-bearing, and it is
instrumented. This round does what it says on the passthrough path.** The one thing I would still
change is F3.

---

## 3. FINDINGS

### F1 — `[PASS-1]` **MEDIUM** — The round hardened a field with no render sink; the field with a raw-HTML sink is untouched and has nothing behind it

- **Where:** `web/src/components/inspector/ft-inspector-desc.ts`, `ft-inspector-comments.ts`,
  `web/src/util/markdown.ts`; absence of CSP in `internal/serverapp/unified.go`.
- **This is the most important thing in my report and it is a threat-model finding, not a bug.**

I traced `remote_data` all the way to the DOM and **it never gets there.** `[MEASURED]` — the only
non-generated reads of `remoteData` anywhere under `web/src` are:

- `capabilities.ts`: `if (rd && typeof rd === 'object' && 'writable' in rd && rd.writable === true)`
- `ft-app.ts`: the same `rd.writable === true` predicate

Both are **boolean predicate reads of one key.** No component iterates it, renders it, or dumps it.
**`html_url` has zero occurrences under `web/` at all.** So thirteen commits of XSS hardening were
spent on a field that has **no render sink in this application.** As defence-in-depth for a
documented passthrough blob that a future component might render, that is legitimate — but it should
be *known* to be defence-in-depth, and the round's framing does not say so.

Meanwhile, the trace the dispatch actually asked for — one attacker-controlled string from ingestion
to render, and every place it is transformed:

```
GitHub issue body (fully attacker-controlled: anyone who can file an issue)
  -> passthrough.go:  Description: string(issue.Body)        [NO TRANSFORM]
  -> ent.Task.Description                                     [NO TRANSFORM]
  -> taskToProto -> pb.Task.description                       [NO TRANSFORM — no validation,
                                                               no escaping, no length bound]
  -> grpc-client.ts -> Task.description                       [NO TRANSFORM]
  -> ft-inspector-desc.ts:  unsafeHTML(renderMarkdown(this.description))
                                                              [marked -> DOMPurify, IN THE BROWSER]
  -> DOM
```

**The number of server-side transformations of a GitHub issue body on its way to an
`unsafeHTML` sink is zero.** The entire defence is one line:

```ts
export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(marked.parse(md) as string);
}
```

And behind it: **no Content-Security-Policy anywhere in the repository.** `[MEASURED]` — my own
grep for `content-security|X-Frame-Options|X-Content-Type` across all `.go` files returns **zero
hits**; `unified.go` serves the SPA with a bare `mux.Handle("/", http.FileServer(assets))` and sets
no security headers. Comment bodies (`c.body`) reach the identical sink.

**Impact.** A single DOMPurify bypass or config regression is stored XSS in an authenticated
dashboard, with **no second layer**. `remote_data`, by contrast, currently cannot produce XSS at all
because nothing renders it.

**Not exploitable today** `[MEASURED]`: `npm audit` over `web/` returns
`{'info': 0, 'low': 0, 'moderate': 0, 'high': 0, 'critical': 0, 'total': 0}`; resolved versions are
`dompurify 3.4.12` and `marked 15.0.12`, both above the known DOMPurify bypass ranges. This is why
F1 is MEDIUM and not HIGH, and why it does **not** block.

**Recommendation** (none of this belongs in *this* merge; it belongs in the next round's scope):

1. Add a CSP. This is the single highest-value control available and it costs one handler:
   ```go
   func securityHeaders(next http.Handler) http.Handler {
       return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
           w.Header().Set("Content-Security-Policy",
               "default-src 'self'; script-src 'self'; object-src 'none'; "+
                   "base-uri 'none'; frame-ancestors 'none'")
           w.Header().Set("X-Content-Type-Options", "nosniff")
           w.Header().Set("Referrer-Policy", "no-referrer")
           next.ServeHTTP(w, r)
       })
   }
   // mux.Handle("/", securityHeaders(http.FileServer(assets)))
   ```
   Verify against Lit's styling before shipping `script-src 'self'`.
2. Pin DOMPurify's URI policy explicitly instead of inheriting defaults, so it is a repo property
   rather than a dependency fact, and align it with the repo's own `SAFE_SCHEMES`:
   ```ts
   const CLEAN = { ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/)/i, FORBID_TAGS: ['style'] };
   export function renderMarkdown(md: string): string {
     return DOMPurify.sanitize(marked.parse(md, { async: false }) as string, CLEAN);
   }
   ```
   `{ async: false }` also removes the unchecked `as string` cast over a value `marked` may return
   as `Promise<string>` — today it is sync by default, so a config change would silently sanitise
   the string `"[object Promise]"`.
3. Add `web/src/util/markdown.test.ts`. There is **none**, and `url-binding-scan.test.ts`
   explicitly carves `unsafeHTML` out of its scope — so the one raw-HTML sink in the tree is
   excluded from the scanner that guards every other URL sink **and** has no direct test.

### F2 — `[PASS-1]` **MEDIUM** — The new log statement is an unbounded, remotely-triggerable amplification sink, and it is the one thing this diff genuinely adds

- **Where:** `structOrNilLoggingErr` in `convert.go`; `ListTasks` in `server.go`.
- **Pre-registered as H5. CONFIRMED.** `[MEASURED]` on the call chain, `[DERIVED]` on the volume.

Before this round the error was discarded (`_`) and the path was **silent**. Now it logs. Combine
that with the C-1 result — which says the conversion **always** fails on the passthrough path,
for **every** task, because `labels` is unconditional — and:

```
ListTasks -> for _, t := range tasks { resp.Items = append(resp.Items, s.taskToProto(ctx, t)) }
          -> taskToProto -> structOrNilLoggingErr -> ALWAYS fails on passthrough -> ONE LOG LINE PER TASK
```

`defaultPageSize` is 50 and the cap is 200 `[MEASURED]`, so **one `ListTasks` call against a
GitHub-backed collection emits up to 200 identical log lines**, and every poll/refresh repeats it.
The line is a constant (`task.remote_data dropped: ... invalid type: []string`) so there is **no
information disclosure** (H4) — the cost is pure volume: log storage and ingestion spend, and
drowning of real signal. Any authenticated user browsing a passthrough collection triggers it;
no attacker sophistication required.

The author's comment reasons carefully about whether the log is *reachable* and concludes
"it ships as an ordinary reachable log." **The gap is that reachability was analysed and frequency
was not.** This is not an ordinary reachable log; on the passthrough path it is a *certainty*, once
per task per request.

**Recommendation.** Do not remove the log — making the drop audible is the right instinct, and
"disable the control" is never the fix. Make it once-per-conversion-batch rather than
once-per-task, or rate-limit it:

```go
// in taskToProto's caller, or via a sync.Once/rate.Sometimes guard:
var remoteDataDropLog = rate.Sometimes{First: 1, Interval: time.Minute}

func structOrNilLoggingErr(sanitized map[string]any, field string) *structpb.Struct {
    s, err := structpb.NewStruct(sanitized)
    if err != nil {
        remoteDataDropLog.Do(func() {
            log.Printf("%s dropped: sanitized remote_data is not structpb-representable: %v", field, err)
        })
        return nil
    }
    return s
}
```

A counter/metric would be strictly better than a log line here, since the interesting quantity is
"how often" and the message is constant.

### F3 — `[PASS-1]` **LOW** — C-1's "unconditional carrier" property is true of one GitHub adapter and false of the other; the round's prose does not distinguish them

- **Where:** `buildRemoteData` in `internal/platform/github/github.go`, versus `issueBuildRemoteData`
  in `graphql_queries.go`.
- `[MEASURED]`.

C-1 is stated as a property of "the GitHub passthrough path," and there it is exactly right. But
there are **two** GitHub `remote_data` builders and they do not behave the same way:

```go
// github.go — buildRemoteData. NOTE the guard.
var labelNames []string
for _, l := range issue.Labels { labelNames = append(labelNames, l.GetName()) }
if len(labelNames) > 0 {          // <-- CONDITIONAL
    rd["labels"] = labelNames
}
```

Every other key this builder writes is a **scalar**: `remote_id`, `node_id`, `html_url` (string),
`number` (int), `created_at`, `updated_at`, optional `milestone`. So **a GitHub issue with zero
labels produces a `remote_data` map that is 100% structpb-representable, the guard does not fire,
and `remote_data` ships.** Whether the fail-closed accident engages on this adapter is toggled by
whether an issue happens to carry a label — which is upstream-controlled.

**This is not a vulnerability, and I want to be exact about why.** That path writes into
`store.CreateTaskParams`/`UpdateTaskParams` and persists; on read-back the map is JSON-decoded into
`map[string]any`, so by H3 the sanitizer walks every node and `html_url` is validated by
`urlBearingRemoteDataKey`. The content is clean either way. Severity LOW.

**The risk is to the reader, not to the wire.** Section 4 item 2 is about correct-sounding
justifications that stop people looking. "The GitHub passthrough path carries non-representable
types" reads naturally as "GitHub `remote_data` never ships," and that broader sentence is **false**.
The next person to rely on the accident on a non-passthrough path will be relying on nothing.

**Recommendation.** One sentence in the `structOrNilLoggingErr` comment bounding the claim to
`issueBuildRemoteData`, and an assertion that `buildRemoteData`'s zero-label output **is**
representable — pin the asymmetry rather than leaving it to be rediscovered:

```go
// github.go's buildRemoteData is NOT a carrier: labels there is conditional on
// len>0 and every other key is a scalar, so an unlabelled issue yields a fully
// representable map and remote_data DOES ship on that path. Safe because that
// path is JSON-round-tripped and sanitizeRemoteData therefore walks all of it.
if _, err := structpb.NewStruct(map[string]any{
    "remote_id": "o/r#1", "number": 1, "html_url": "https://x",
}); err != nil {
    t.Fatalf("buildRemoteData's zero-label shape should serialise: %v", err)
}
```

### F4 — `[PASS-1]` **MEDIUM — OUT OF SCOPE FOR THIS DIFF, NON-BLOCKING** — the `writable` capability gate is enforced only in the browser

- **Where:** `web/src/capabilities.ts`, `web/src/components/ft-app.ts`; absence in `internal/`.
- `[MEASURED]` on the absence, `[UNCHECKED]` on the deployment authorization model.

I found this while establishing (for F1) that `remote_data` is never rendered — the only two reads
turned out to be a **permission decision**:

```ts
private isCollectionWritable(coll: Collection): boolean {
  const rd = coll.remoteData;
  if (rd && typeof rd === 'object' && 'writable' in rd) { return rd.writable === true; }
  return false;   // "external collections are read-only unless explicitly enabled"
}
```

**A grep for `writable` across all non-test `.go` files under `internal/` returns zero hits.** The
server has no corresponding check. And the passthrough store's writes are **real**:
`GitHubPassThroughStore.UpdateTask` resolves the issue and calls `s.gql.updateIssue(ctx, issueID,
p.Title, p.Description)` — it mutates the actual GitHub issue, using the **server's** GitHub
credential. `CreateTask`, `ClaimTask`, `CloseTask`, `AddComment` are all implemented too.

So a client that does not run the UI — a direct gRPC/gRPC-web call — can write to a collection the
product presents as read-only, spending the server's GitHub token.

**Why MEDIUM and not HIGH:** a `TokenAuthInterceptor` is installed on every server entrypoint
(`cmd/farmtable-server/main.go`, `internal/cli/dashboard.go`), so this is **not** an unauthenticated
bypass. It is only a privilege boundary if farmtable distinguishes users who may write from users
who may not, and **I did not verify that** — `[UNCHECKED]`. If all authenticated principals are
equally trusted, this is a UX affordance and not a vulnerability.

**This predates the diff and must not block it.** Flagging per my brief's instruction to surface
non-security-scope concerns as recommendations: **please decide explicitly whether `writable` is a
security boundary.** If it is, it needs a server-side check in the mutating RPCs, not just in Lit.

### F5 — `[PASS-1]` **LOW** — `default: return v, true` has no backstop on the export path, and nothing pins the precondition that saves it

- **Where:** `sanitizeRemoteValue`'s terminal `default`; the four `sanitizeRemoteData` call sites in
  `export_import.go`.
- H2, refuted as an exploit; retained as a durability finding. `[MEASURED]` gate, `[REASONED]` scope.

By H3 the sanitizer/structpb pair is fail-closed **on the structpb path**. `export_import.go` is not
that path — it sanitizes and then emits **JSON**, and `encoding/json` will happily marshal the
`map[string]string` that structpb rejects. Today this is unreachable because export is gated to
`PlatformFarmtable`, whose tasks are JSON- or structpb-sourced and therefore fully walkable.

That is a **reachability precondition**, and it is precisely the shape section 4 item 4 warns about:
nothing goes red if it changes. A future writer putting a Go-native `map[string]string` into a
farmtable-platform task's `RemoteData` gets a nested `javascript:` URL through export **and back
through import**, with no guard anywhere.

**Recommendation.** Cheapest durable fix is to make the sanitizer's blind spot impossible rather
than merely unreached — normalise instead of passing through:

```go
case map[string]string:
    clean := make(map[string]any, len(tv))
    for k, s := range tv {
        if nv, keep := sanitizeRemoteValue(k, s, depth+1); keep { clean[k] = nv }
    }
    return clean, true
case []string:
    // (already handled under URL-bearing keys; add the generic arm too)
```

**IMPORTANT CAVEAT IF YOU DO THIS:** normalising `[]string` -> `[]any` **destroys the C-1
fail-closed accident** and turns the passthrough path's `remote_data` on for the first time.
`TestPassthroughReadDropsUnsafeRemoteURL` will go red and must be upgraded to real absence checks
before the change lands — which is exactly what its failure message says. The `structOrNilLoggingErr`
comment's warning about rewording the log message on normalisation also applies. **These two changes
are coupled and must not be made independently.**

### F6 — `[PASS-2]` **INFO** — section 4 item 1: I looked for another persistence path and did not find one

Section 4 told me to assume another path exists. `[MEASURED]`: `taskToCreateParams` in
`graph_routing.go` copies fourteen fields (`Title`, `Description`, `CollectionID`, `Phase`, `Stage`,
`NativeLabel`, `Type`, `Priority`, `Labels`, `StartDate`, `DueDate`, `Repo`, `Branch`, …) and
**never assigns `RemoteData`**, so the ephemeral-store round trip drops it. `d305391` adds
`TestEphemeralGraphRouteDropsRemoteData` pinning this, and the run log for #228 records three
mutants (prod assigns `RemoteData`; fixture literal deleted; control assignment deleted) all going
red, with checksum-verified restores. That is a properly instrumented property.

**Bounding my own sweep, because a clean search is not a bound:** my search space was
non-test, non-generated `.go` files under `internal/` and `platform/` matching `RemoteData`. Writers
found: `github.go` (x2), `beads.go` (x2), `passthrough.go`, `export_import.go` (x4), `entstore.go`
(per the in-code reference). Readers reaching a client: `taskToProto`, `collectionToProto`,
`export_import.go`. **What that search could not have seen:** any write via reflection, via `ent`'s
generated mutation builders under `internal/store/ent/` (which I excluded), via struct-literal copy
that does not mention the identifier `RemoteData`, or in a `_test.go` file. **I did not independently
re-derive `reports/persistence-walk-194-r11.md`'s verdict**, so the persistence premise still rests
on that earlier walk and not on mine.

### F7 — `[PASS-1]` **INFO** — a live comment points at a document that does not exist

`ft-inspector-desc.ts` tells the reader *"See docs/url-policy.md for what IS stated."*
`[MEASURED]` — `docs/` contains only `architecture.md`, `code-of-conduct.md`, `contributing.md`, and
the only occurrence of `url-policy` in the tree is that dangling reference. Given this round's
explicit theme — reason strings that sound right and stop people looking — a citation to a
nonexistent policy document is the same defect class in the frontend. Either write the file or
delete the sentence.

---

## 4. POSITIVE OBSERVATIONS

These are real and I would not want the finding count to obscure them.

1. **The fail-closed composition is sound, and it is sound for a *reason*, not by luck** — see H3.
   Whatever the sanitizer fails to walk, structpb refuses to serialise. Independently derived from
   the library's type switch.
2. **`TestPassthroughReadDropsUnsafeRemoteURL` refuses to be vacuous.** It explicitly declines to
   assert "remote_url is absent from remote_data" on a path where `remote_data` is always empty,
   *names* the unrelated reason, and points at the two tests that pin the scrub non-vacuously. A
   test that argues against its own strongest-looking assertion is rare and worth saying so.
3. **`TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` asserts its non-carriers.** It pins
   `parent` and `sub_issues_summary` as *serialising fine*, so nobody later "discovers" them as
   carriers, and they double as positive controls proving the failures are about `[]T` and not about
   nesting. That is a control that could actually have failed.
4. **The AST rewrite of the write-site scanner was correct and the reasoning is documented with
   measured failure modes** — `map[string]interface{}` not opening a frame, one-line literals never
   closing, bodies truncated at the first `\n}\n`. Replacing a line scanner with `go/parser` rather
   than adding a fourth special case is the right call.
5. **`safeHref` is a properly built allow-list:** `new Set(['http:','https:'])`, `new URL(raw)` with
   **no base** so protocol-relative `//evil.com` throws rather than being laundered, plus an empty
   `hostname` backstop. Rejected URLs degrade to an inert `<span>` rather than failing the render.
6. **`url-binding-scan.test.ts` is a real instrument** that fails the build on new unguarded
   URL-bearing bindings — and it *states its own blind spots* (`unsafeStatic`, `unsafeHTML`) instead
   of implying coverage.
7. **Two false reason strings were found and repaired mid-round** (the `metadata`/`json.RawMessage`
   exemption; "so the two agree" -> "they still do not agree, deliberately"). Correcting a
   justification while behaviour stays the same is unrewarding work and it is the work that keeps
   this codebase auditable.
8. **`npm audit` is clean: 0 vulnerabilities at every severity.** `dompurify 3.4.12`,
   `marked 15.0.12`.

---

## 4.5 §10.25 COMPLIANCE — MY CONTROLS' ENVIRONMENTS, AND ONE I HAD TO REPAIR

Added after the 05:15Z standing-rules message. §10.25 point 4 requires stating, next to each
result, what environment the plant sat in — *"a passing control whose environment is unstated is
indistinguishable from one that could not have failed."* Applying it to my own work found a real
hole in my headline claim, which I have now repaired rather than restated.

### 4.5.1 THE CONTROL I HAD TO REPAIR — my "comment-only" filter had no positive control

**My entire verdict leans on "`urlvalidate.go`'s diff is comment-only."** I originally established
that by piping the diff through a filter that strips `+++/---` headers, `//` lines and blanks, and
observing **empty output**. That is precisely the §10.25 failure mode and also a bare §10.20 one:
**I had a zero, and a zero from an unproven instrument is indistinguishable from a broken
instrument.** I never showed the filter could emit anything.

**Repaired with a control that could actually have failed** `[MEASURED]`:

| run | environment | result |
|---|---|---|
| `urlvalidate.go` (the claim) | 26 raw `^[+-]` lines present — a **non-empty** diff, not an empty one | **0** lines survive |
| `convert.go` (**positive control**) | same filter, same base, a file known to contain real code changes | **13** lines survive |

The instrument fires. And the zero is **not vacuous**: the raw diff for `urlvalidate.go` has 24
content lines, of which the filter classified 24 as comment-or-blank — the numbers close, so nothing
was silently dropped by a path error. I also checked for the one form my filter is blind to,
**`/* */` block comments** (it only knows `//`): **zero occurrences** in the changed lines, so no
code change could have hidden inside one.

**Environment statement:** the target sat in a 24-line real diff hunk inside a large existing doc
comment, at `internal/server/urlvalidate.go` — real depth in the tree, not a synthetic fixture.
**The claim survives, but it survived a check it had not previously been given.**

### 4.5.2 §10.25 AS A READING CRITERION — the C-1 pin plants its target alone in clean space

`TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` makes **every one of its assertions
against a map containing exactly one key.** The real `issueBuildRemoteData` output has ~13. That is
the clean plant: the environment was chosen by the same hand that wrote the claim.

**For the NEGATIVE assertions this turns out not to matter, and I want to say why rather than
just flagging the shape.** `NewStruct` fails if *any* key fails, so failure is **monotone under
adding keys** — a one-key map that fails cannot be rescued by adding twelve valid siblings. The
single-key environment is therefore sound *for these particular assertions*. Credit where due:
the test also asserts its **non-carriers** (`parent`, `sub_issues_summary`) serialise, which is a
control that could have failed and which stops a future reader "discovering" a third carrier.

**But the positive side is a genuine clean plant, and here is where it bites** `[MEASURED]`:

The test pins `parent` as a non-carrier with the literal
`{"parent": map[string]any{"node_id": "MDU6SXNzdWU=", "number": 3}}` — a **hardcoded Go `string`**.
Its own comment says *"node_id is `githubv4.ID` (an `interface{}`) holding a string once the GraphQL
response is decoded."* I chased that down instead of accepting it:

- `githubv4.ID` is declared `ID graphql.ID` in `githubv4/scalar.go`;
- `graphql.ID` is declared **`ID any`** in `shurcooL/graphql/scalar.go`.

**So the static type is `interface{}` and the dynamic type is whatever the decoder produced.
The test plants the ASSUMED dynamic type rather than measuring the actual one** — the environment
is the author's belief about the decoder, not the decoder. `issueBuildRemoteData` writes
`issue.ID` into `"node_id"` at top level and `issue.Parent.ID` into `parent.node_id`.

Consequences if that belief is ever wrong, which nothing in the round would detect:

- decoder yields **`json.Number`** -> a base64 node ID does not parse as a float -> `NewValue`
  errors -> **a third, unenumerated carrier**, and the test's claim that removing `labels` leaves
  only `sub_issues` is wrong;
- decoder yields **`json.RawMessage`** (i.e. `[]byte`) -> **representable**, and `NewValue`
  silently **base64-encodes the raw JSON** into the shipped field.

**I did not measure the runtime dynamic type** (`[UNCHECKED]` — it needs a decode, which needs a
build). This is not a defect I can demonstrate; it is a control whose environment is an assumption,
which is exactly what §10.25 point 4 asks me to surface. **Cheap fix:** assert the type rather than
plant it — `if _, ok := issue.ID.(string); !ok { t.Fatalf(...) }` against a decoded fixture, so the
enumeration of carriers rests on a measurement instead of on a comment.

### 4.5.3 The rest of my controls, environments stated

- **H3 (soundness) and H4 (log injection)** were **source enumerations, not plants** — I read the
  complete type switch and every format verb out of `protobuf@v1.36.11` in the module cache. There
  is no environment to pad because there is no fixture; the failure mode for this method is reading
  the wrong version, which I guarded by resolving the exact version from `go.mod`. §10.25 does not
  apply; §10.10 (agreement with self) does, and reading the dependency's own source rather than my
  memory of it is the mitigation.
- **F1's render trace** was an absence claim over `web/src`. Its positive control is that the *same*
  search **did** return the two `rd.writable` reads and the two `unsafeHTML` sites — so the
  instrument demonstrably finds `remoteData` and raw-HTML sinks when they exist. Bounded in
  WHAT I DID NOT CHECK.
- **F4's absence claim** (`writable` in no Go file) has **no positive control and I did not give it
  one.** It is a single grep over non-test `internal/**.go`. Listed below.

---

## 5. WHERE MY BRIEF WAS WRONG

1. **The dispatch and the brief gave contradictory ordering instructions, and following the dispatch
   destroyed the thing the brief was protecting.** Dispatch: *"READ THE BRIEF FIRST AND IN FULL."*
   Brief §1: *"DO NOT READ SECTION 4 UNTIL YOU HAVE FINISHED [PASS 1]."* I obeyed the dispatch,
   read section 4 before seeing a line of code, and **my PASS-1/PASS-2 split is therefore
   compromised** (see §0.1). This is the single most consequential error in my instructions tonight:
   the tags are described as "the only way this round can tell me anything about the codebase rather
   than about my own brief," and the covering message defeated them before I started. **Fix: put the
   ordering constraint in the dispatch, or split section 4 into a separate file handed over on
   request after Pass 1.** The brief cannot protect itself from its own cover letter.
2. **"Sanitization was extended to every write site and every depth" is not what these 13 commits
   do.** `urlvalidate.go`'s diff is **comment-only** — measured. The recursion and the write-site
   coverage already existed at `e6bda71`; this round *documents*, *tests* and *instruments* them and
   changes exactly one line of wire-adjacent behaviour. I nearly spent my budget auditing a
   sanitizer rewrite that had already happened. **Describe a round by its diff, not by its theme.**
3. **The dispatch's framing sent me at the wrong asset.** I was told to attack `remote_data`
   representability as the load-bearing security claim. `remote_data` **has no render sink in this
   application** — the actual raw-HTML sink is `description`/`comment.body`, which this round does
   not touch and which has no CSP behind it (F1). The framing is defensible for a scoped review, but
   *"this is the load-bearing security claim"* overstates it: it is load-bearing for the round, not
   for the product's XSS posture.
4. **"Section 4 item 3: the scanner is blind to `_test.go`, so green means NOT SCANNED" was correct
   and useful, and I used it** — it is why I did not treat scanner silence as coverage anywhere. Not
   an error; recorded because the brief asked which instructions helped.
5. **Minor:** the brief says `grep` is ugrep and unquoted globs are fatal in zsh. Both true — my
   first `grep --include=*.go` died with `no matches found`. The warning was accurate and I should
   have applied it on the first call rather than the second.
6. **I could not comply with "audit dependencies using the project's tooling" for Go.** `govulncheck`
   is not vendored and the module cache was empty; a Go-side audit needs a build and therefore the
   token. I audited the npm side only (clean) and have listed the Go side under WHAT I DID NOT CHECK.
   I did **not** request the token, because nothing I could learn from it would change an APPROVE
   verdict on a comment-and-test diff — flagging that judgement call so you can overrule it.

---

## 6. WHAT I DID NOT CHECK

- **I ran no Go tests. None. Not one.** The module cache was empty; a single-package run would have
  required a full dependency download and, in practice, the build token. **Therefore every statement
  I make about test *behaviour* is derived from reading test source, not from observing a run** —
  including my claim that `TestPassthroughReadDropsUnsafeRemoteURL` would go red under a
  `[]string` -> `[]any` change (`[DERIVED]`, not `[MEASURED]`). I appended nothing to
  `reports/_run-queue-log.md` because I ran nothing that required it.
- **I ran no mutation experiments**, for the same reason. I therefore verified no restores by
  checksum — because I mutated nothing. **No production file in any tree was modified.**
- **Go dependency vulnerability audit: not performed.** No `govulncheck`, no `go list -m -u all`.
  npm side only.
- **The authorization model behind F4 is unverified.** I confirmed `TokenAuthInterceptor` exists and
  that `writable` appears in no Go file. I did **not** determine whether farmtable has per-user write
  permissions, so I cannot say whether F4 crosses a privilege boundary.
- **I did not re-derive `reports/persistence-walk-194-r11.md`.** The persistence premise still rests
  on that earlier walk pinned to `e6bda71`, not on any enumeration of mine (see F6 for my sweep's
  explicit bounds).
- **I excluded `internal/store/ent/` (generated code) from every search.** A `RemoteData` write
  through ent's generated mutation builders would not appear in my results.
- **I did not audit the beads adapter's `buildRemoteData`** beyond noting it exists, nor the Linear/
  Jira/Asana platforms.
- **I did not attempt a DOMPurify bypass.** F1's severity rests on `npm audit` being clean and on
  version numbers, not on my having tried to defeat `dompurify@3.4.12`.
- **I did not test the frontend at runtime** — no browser, no built `web/dist`. The render trace is
  from source.
- **I did not review the 447-line `.design/project-log/url-scheme-validation-r5-fix-round.md`** for
  further reason strings of the section-4-item-2 shape. Given that two false justifications were
  already found and repaired mid-round, **that document is where I would look next.**
- **§10.25 gaps I am declaring rather than quietly re-running**, per the 05:15Z instruction:
  - **F4's absence claim has no positive control.** "Zero occurrences of `writable` in non-test Go"
    is one grep that I never demonstrated could return a hit. It is consistent with `capabilities.ts`
    and with `UpdateTask` being implemented, but **I did not prove the instrument fires**, and by
    §10.20 an unproven zero looks exactly like a clean result. Treat F4's *absence* half as
    `[MEASURED, UNCONTROLLED]`.
  - **My write-site sweep for F6 also has no positive control** — same objection, same status.
  - **I ran no plants, mutants or exploit strings at all**, so §10.25 points 1–3 (alphanumeric
    neighbours, a line break through the middle of the target, real depth) had **nothing to apply
    to**. Where I state a guard holds, I am reasoning from source and from the round's own fixtures,
    **not from a payload I constructed and surrounded.** That is the single largest bound on this
    audit and it follows directly from having run no tests.
  - The one control I did repair under §10.25 is in §4.5.1; it passed, and I have stated its
    environment.
- **`maxRemoteDataDepth = 32`:** I read the bound and confirmed both the sanitizer and the import
  validator return fail-closed at `depth > 32` (drop / error respectively). I did **not** construct
  a 33-deep payload and observe it, and I did **not** check for stack-exhaustion behaviour below 32
  with a very wide map.
