# 2026-07-29 — the markdown href bypass, and three prose defects next to it

Branch `hardening/markdown-href`, based on `hardening/cred-clause` (89a974da),
which is main 7bb0c756 plus three approved commits. Nothing pushed; main
unmoved.

Every number below is measured in this clone at the revision named next to it.
Where something was not measured, it says NOT MEASURED rather than being left
to the reader's charity.

---

## 1. The defect, reproduced before it was believed

The audit's F-1 was re-derived from scratch rather than taken from the report:
`/workspace/mdhref-rig/repro.mjs` imports the SHIPPED `markdown.ts` under JSDOM
and counts anchors with a DOM parse, not a grep.

Arms written down before the run:

| arm | expected | got |
|---|---|---|
| positive: `[x](https://example.com/)` | 1 anchor, href intact | 1, intact |
| negative control: `[x](javascript:alert(1))` | 0 hrefs | 0 |
| negative control: `[x](data:text/html,...)` | 0 hrefs | 0 |
| the defect: 4 credential-bearing forms | **4** hrefs survive | **4** |

Measured at 89a974da, `web/src/util/markdown.ts` before the fix:

```
[gh](https://user:pass@evil.example/)  -> href survives
                                          host=evil.example user="user" pass="pass"
```

The two negative controls matter: they prove DOMPurify was doing its job and
that the survival is a hole in the URL POLICY, not in the sanitiser.

**This is not XSS, and it is not described as XSS anywhere in the change.**
DOMPurify strips `javascript:` and `data:` on this path and always did. The
harm is destination confusion — a URL that reads as one host and loads another
— with attacker-chosen link text supplied by the same markdown.

**The defect is PRE-EXISTING on main at 7bb0c756.** `markdown.ts` was six lines
and never referenced `safeHref`; 89a974da did not introduce it and did not
widen it. What 89a974da did was make it *reachable in argument*: it added the
userinfo clause to `safeHref`, and this path never called `safeHref`.

## 2. Mechanism: the hook, not `ALLOWED_URI_REGEXP`

Chosen: a DOMPurify `afterSanitizeAttributes` hook in `markdown.ts` that routes
every host-naming `href` through `safeHref`.

Rejected: `DOMPurify.sanitize(html, { ALLOWED_URI_REGEXP })`. It is fewer lines
and it is a SECOND URL POLICY, written in a second dialect (a regex over a raw
string) that would have to be kept in agreement with `safe-url.ts` by hand and
could not read the shared fixtures. One policy, one fixture set, one place to
change, one thing to be wrong. That reasoning is in the commit message of
acd0d8dd and in the docblock, not only here.

Two consequences were chosen deliberately and are recorded at the code:

- **Degradation.** A refused URL does not vanish: the anchor stays, its TEXT
  stays on screen, `href` is removed and the rejected URL is moved to `title`.
  Inert text, not a disappearance. The cost: on a refused link only, an
  author-supplied `title` is overwritten. Pinned in both directions (M4, M5).
- **`mailto:` in markdown becomes inert text.** That is the price of one policy
  rather than two — `safe-url.ts` deliberately excludes `mailto:` to match the
  server allow-list. Recorded, not hidden.

NOT CLOSED, and stated in the docblock: `src` (markdown images) is not covered.
The hook is keyed on `href`.

No entry was needed in `url-binding-scan.test.ts`'s allow-list. The hook uses
`getAttribute`/`removeAttribute`/`setAttribute('title', …)`, none of which is a
binding the scanner has a rule for; confirmed by the scanner running green.

## 3. Mutation results — which test pins which half

`web/src/util/markdown-href.test.ts` (72 assertions) states its two halves in
its own header: HALF A is refusal, HALF B is the relative-link carve-out.
Predictions were written into `/workspace/mdhref-rig/mutate.mjs` before the
first run. Every mutant went red in exactly ONE of the seven suite files —
`util/markdown-href.test.js` — and the tree was restored and re-verified GREEN
7/7 after each.

| mutant | first failing assertion | pins |
|---|---|---|
| M1 hook deleted | `markdown link, user and password: credential-bearing href survived the markdown sink (got https://user:pass@evil.example/, want null)` | HALF A |
| M2 carve-out deleted | `relative path: a relative link was refused as if it named a host (got null, want ./docs/x.md)` | HALF B |
| M3 refusal removes the anchor | `expected exactly one anchor from "[github.com/farmtable/farmtable](https://user:pass@evil.example/)" (got 0, want 1)` | the degradation contract |
| M4 title line deleted | `refusal did not record the rejected URL in the title (got null, want Unsupported URL: https://user:pass@evil.example/)` | the refusal's title |
| M5 title set on accepted links too | `an accepted link lost the author's own title (got Unsupported URL: https://example.com/, want A perfectly ordinary title)` | the *scope* of the title write |

**Mutation B**, the reviewer's shape: delete the hook AND skip the test that
fired first under M1. Prediction: still red, from a different row. Result:
still red — `an attacker-supplied title survived on a refused link (got
Official GitHub repository, want Unsupported URL: https://github.com@evil.example/)`.
So the pin is not one row.

**Surprise worth naming: no EXISTING test file goes red under M1.** Not
`render-sink-xss.test.ts`, not `url-binding-scan.test.ts`, not
`safe-url.test.ts`. Before this commit the markdown sink had no pin at all, in
either direction; `markdown-href.test.ts` is the sole one. That is the honest
measure of how the bypass survived: nothing was watching.

`MIN_TEST_FILES` moved 6 → 7 in the SAME commit as the new test file
(a17dd2b1), as the floor has zero headroom by design, and the committed
path-set comment was re-derived rather than incremented.

## 4. The three prose defects (items 2 and 4)

**(a) `safe-url.ts`, the userinfo clause.** The false sentence was "both call
sites render STATIC link text -- nothing on screen contradicts the misreading".
It is false at `ft-inspector-code.ts`, where the link text is `${id}`.

What now stands there is a MECHANISM and a GAP, and no property:

> safeHref rejects a URL carrying userinfo, so the URL'S OWN TEXT cannot carry
> a false authority.
> NOT MEASURED: whether any adjacent field rendered as the link's label can
> disagree with the destination.

Four successive replacement properties were proposed during the night and every
one of them was TRUE of a working spoof (`pr.id = "github.com/facebook/react#1234"`
with `pr.url = "https://evil.example/"`), because each constrained the visible
text against THE URL while the harm only needs visible text to disagree with
the DESTINATION and the label comes from a different field. **A visible gap is
a deliverable; a fifth property is not.** No pin was added for this anywhere —
in particular not in `url-binding-scan.test.ts`, which is keyed on URL-bearing
bindings and is structurally blind to `${id}`. A green pin over a live spoof
would be worse than the prose. The spoof itself is filed as C85 in the
out-of-scope backlog; it is pre-existing and is not fixed here.

**(b) `ft-inspector-desc.ts:244`.** "url-binding-scan.test.ts asserts that every
href binding routes through safeHref" — false as an unqualified claim, and
`unsafeHTML` is the line the comment sits on. Restated as what the scanner
actually covers (every binding it can PARSE), with `unsafeHTML` named as a
blind spot before and after the fix, and `markdown-href.test.ts` named as what
covers this line instead. A control's stated scope must not be its aspiration.

**(c) Item 4, the cardinal that broke two arguments.** Correcting 9-of-42 to
13-of-45 left two sites saying "they are broken-link and inconsistency bugs,
not XSS" over thirteen rows when the argument only holds for seven.

**Re-derived, NOT taken from the EM's measurement** (`/workspace/mdhref-rig/directions.mjs`,
run against `testdata/url-scheme-cases.json` in this clone, expected values
written down first, with a positive arm that fires on a deliberately wrong
expectation): 45 cases, 13 divergent, **7** client-accept/server-reject, **6**
server-accept/client-reject. Matches.

- The 7 client-looser rows (backslash host confusion, single slash host, opaque
  no slash, bare space in path, trailing newline, bad percent escape, empty
  host with path) ARE the broken-link class.
- Of the 6 server-looser rows, 4 carry userinfo. **One correction to the
  framing I was given:** only THREE are destination confusion
  (`https://github.com@evil.example/`, `https://ok.example@evil.example/`,
  `https://:pass@evil.example/`). The fourth, `https://user:pass@example.com/x`,
  loads the host it names — its harm is credential disclosure on click, not a
  false destination. The remaining two (`""`, `https://example.com:99999/x`)
  throw at `new URL()` and are inert.
- "not XSS" and "no scheme escalation" are true of all 13 and stay.

Left alone as instructed and independently spot-checked: the "at least 23
shapes are known to diverge and this file pins 13" sentence (the 23 is an audit
sample count, not the 13 restated), `url-scheme-validation-r2-fix-round.md`
lines 87/137, and the Go "all nine notes" comment — dated historical records.

## 5. Apparatus failures, which cost more than the fix

Recorded because each one produced a confident wrong answer first.

1. **A green-looking `npm test` that was red.** `npm test 2>&1 | tail -25; echo
   "exit=$?"` printed `exit=0` for a failing run: `$?` is the tail's status.
   Every gate below was re-run redirecting to a file and reading `$?` directly.
   This is the brief's "a count piped into a counter is not a measurement",
   met in the wild within the first ten minutes.
2. **`error TS2688: Cannot find type definition file for 'node'`** — not a code
   defect. The `node_modules` I had copied lacked `@types/node`. Resolved by
   md5-matching `web/package-lock.json` across trees and copying a matching
   `node_modules` as a REAL DIRECTORY. A symlink here defeats the Go
   tree-walker and produces three false `webguard` failures, which the brief
   predicted.
3. **zsh EQUALS expansion**: a bare word beginning with `=` (e.g. a `===`
   separator in an `echo`) is expanded as a command path — `== not found`.
4. **DOMPurify with no `window`** returns a factory with `isSupported=false`
   that defines neither `sanitize` nor `addHook` (`purify.es.mjs`:429-434).
   Importing `markdown.ts` without a DOM now throws AT IMPORT TIME rather than
   silently not installing the hook. Fail-closed, and the test file installs
   JSDOM globals before its dynamic import for exactly this reason.

## 6. Gates, all run in this clone at d7926914

| gate | result |
|---|---|
| `npm test` (web) | exit 0 — 7 files, 7 pass, 0 fail |
| `go build ./...` | exit 0, no output |
| `go vet ./...` | exit 0, no output |
| `go test ./...` | exit 0 — 11 ok, 0 FAIL |
| `node scripts/ci-suite-manifest.mjs` | exit 0 — enumerated=7 executed=7 missing=0 (floor 7), surplus=0; positive control fired this run |

Baseline for comparison, measured at 89a974da before any change: npm test 6/6,
go build/vet clean, go test 11 ok / 0 FAIL, manifest exit 0 with its positive
control firing.

## Commits

| commit | item |
|---|---|
| `acd0d8dd` | fix: route markdown-produced hrefs through safeHref |
| `a17dd2b1` | test: pin the markdown href policy; floor 6 → 7 |
| `75da9b4e` | docs: replace two false justification clauses, keep both findings |
| `d7926914` | docs: split the 13-row security reading by direction |

---

## 7. Follow-on pass — the struck clause had a third home

Instructed after 6f2a8ec5 landed: the "both call sites render STATIC link text"
sentence was killed at `safe-url.ts` but survived as a live ASSERTION at two
further sites. The EM measured the POPULATION rather than the INSTANCE; the
audit's F-2 named two sites and there are three. That is the same shape as the
night's other failures — a correction inherits its predecessor's search scope —
and it is worth its own line here because the fix was correct and incomplete at
the same time.

Fixed:

- `web/src/util/safe-url.test.ts`, docblock above `testRejectsCredentials`.
  The clause is replaced by the mechanism already landed at `safe-url.ts` —
  the guard refuses the URL before any of this is rendered, so no credential
  URL reaches an anchor at all — followed by the same verbatim NOT MEASURED
  line. No new property, no new pin.
- `.design/project-log/url-scheme-credential-clause.md`. A project log is not
  silently rewritten: the sentence is struck through in place and a dated
  correction appended immediately below it, naming `${id}` at
  `ft-inspector-code.ts` as the counter-example and pointing at `safe-url.ts`
  for the corrected reading. The finding is unaffected; only the justification
  was wrong.

Deliberately NOT touched, and this is the reason a grep-driven sweep would have
got it wrong: `web/src/util/safe-url.ts:140-141` and section 4(a) of THIS log
both contain the struck clause QUOTED INSIDE THE EXPLANATION OF ITS OWN
REMOVAL. A string match cannot tell a quotation from an assertion; only reading
the sentence it sits in can. Nothing was added to `url-binding-scan.test.ts`.

Web suite re-run after the edits: 7 files, 7 pass, 0 fail.

---

## 8. The review of `6f2a8ec5` — the fix had a second parser inside it

Three CRITICALs, all against the carve-out rather than the routing. The hook
asked a regexp (`NAMES_A_HOST`) whether a reference could name a host and, if
it decided not, skipped `safeHref` entirely. **That regexp was strictly weaker
than the function it was carving around**, so the carve-out was the hole:

| | vector | why the pattern missed it | where it went |
|---|---|---|---|
| C-1 | `ht<TAB>tps://user:pass@evil.example/` | the tab sits INSIDE the scheme, so `^scheme:` did not match | URL parser removes tab/CR/LF; resolves to the credential URL |
| C-2 | `/\github.com@evil.example/` | starts `/\`, not `//`, so `^//` did not match | WHATWG treats `/\` as `//` for special schemes; leaves the origin |
| C-3 | `<svg><a xlink:href=…>` | the hook keyed on the literal attribute name `href` | a clickable link the hook never entered |

**Every gate was green under all three.** That is the finding behind the
finding: `npm test`, `go build`, `go vet`, `go test` and the suite manifest all
passed while the fix they were certifying was bypassable three ways. A green
suite is evidence about the arms in it and about nothing else.

### The remedy, and why not a wider regexp

Widening `NAMES_A_HOST` would have been a **third dialect** — a second URL
parser was the defect, and a better second parser is still a second parser.
The reference is now resolved ONCE, by the platform:

```ts
resolved = new URL(raw, new URL(document.baseURI));   // markdown.ts:120-121
if (resolved.username !== '' || resolved.password !== '') return false;  // :126
if (resolved.origin !== 'null' && resolved.origin === base.origin) return true;  // :127
return safeHref(resolved.href) !== undefined;         // :129
```

Four decisions, in order, each with a reason that is about the RESOLVED URL and
never about the string:

- **Unresolvable → refused.** Fail closed. "I could not parse it" is not a
  reason to keep an attribute.
- **Any userinfo → refused, BEFORE the origin comparison.** `URL.origin`
  excludes userinfo, so `//user:pass@dashboard.test/` is same-origin and still
  hands credentials over on click. This ordering is pinned by
  `testSameOriginCredentialsAreStillRefused`, both polarities.
- **Resolved same-origin → permitted.** The carve-out survives, as a property
  of the resolved URL: `/\github…` looks relative and is not, `#section` looks
  like a fragment and is one. Opaque origins (`'null'`) are excluded so two of
  them are never "the same".
- **Everything else → `safeHref`,** handed the ABSOLUTE href. `safe-url.ts`'s
  no-base contract is intact: resolution happens before the call, and
  `safeHref` still parses with no base.

C-3 is closed by a list, not by the predicate: `LINK_ATTRS`
(`markdown.ts:54`) is iterated at `markdown.ts:211`, so the policy applies to
`href` and `xlink:href` on **every** element DOMPurify keeps — `<area href>`
included, and that arm is now pinned rather than assumed. `src` remains out;
recorded, not closed.

### What moved, deliberately

`//evil.example/x` and `/\evil.example/x` now resolve to `https://evil.example/x`
and are **KEPT**, where the first version refused the first spelling and waved
the second past. This is a real behaviour change and it is the consistent one:
the policy is about **schemes and credentials**, an attacker-chosen host is
reachable through any plainly accepted link, and owner ruling C2 keeps ordinary
http(s) links clickable. Refusing one spelling of a URL the policy accepts in
another spelling is a decision about the string — the exact class of decision
being repaired. `safeHref` at the component bindings is unchanged and still
refuses `//host/x`: there is no resolution step there and the value is a stored
field expected to be absolute.

### RED before GREEN, per arm, both polarities

The suite aborts on the first failed assertion, which would have hidden how
many vectors were live. `/workspace/mdhref-rig/red-per-arm.mjs` temporarily
rewrites `run()` into a catching loop, runs the real suite, prints the first
failure of each arm and restores the file byte-for-byte. Against `57531d3c`
with the new tests in place and `markdown.ts` reverted:

```
RED   testSchemeSplittingControlCharactersAreRefused :: tab inside the scheme: the reference
      survived the markdown sink (got ht\ttps://user:pass@evil.example/, want null)      C-1
RED   testBackslashAuthoritiesAreRefused :: slash backslash: a backslash authority survived
      as a live reference (got /\github.com@evil.example/, want null)                    C-2
RED   testSvgLinksArePoliced :: an SVG anchor kept a credential-bearing xlink:href
      (got https://user:pass@evil.example/, want null)                                   C-3
RED   testCredentialHrefsAreRefused :: the refusal announced itself in a title attribute
      (Option B forbids the signal)
RED   testARefusalAddsNothing :: a refusal added a title where the author wrote none
RED   testProtocolRelativeLinksArePoliced :: the refusal announced itself in a title attribute
RED   testNoRejectedAddressReachesAnAttribute
RED   testHrefOnNonAnchorElementsIsPoliced :: the rejected address survived in an attribute on
      a non-anchor element: <p><map><area title="Unsupported URL: https://…"></map></p>
RED   testSameOriginCredentialsAreStillRefused :: a same-origin reference without credentials
      was refused (got null, want //dashboard.test/x)
RED   testTheGlobalSanitiserCannotDisarmThisOne :: removeAllHooks() on the global DOMPurify
      disarmed the markdown URL policy
GREEN testRefusalKeepsTheTextOnScreen, testOrdinaryLinksSurvive,
      testRelativeLinksAreUntouched, testNonHttpSchemesAreRefused,
      testBothMarkdownSinksStillCallRenderMarkdown
```

All 15 GREEN after the fix, same rig, same run shape. Every refusal arm carries
the KEEP row it must not break — the SOH control character (measured NOT a
scheme splitter: it is refused for a different reason and is pinned as that),
the markdown-percent-encoded `/%5C…`, the credential-free backslash authority,
the same-origin reference, and the plain cross-origin link. **Two of those KEEP
rows started life as post-fix REDs and were the TEST being wrong, not the code**
— `//evil.example/x` and `/\evil.example/x` resolve to ordinary cross-origin
https URLs that this policy accepts. Recording that here because "the fix made
a test go red, so I changed the test" is exactly the move that needs its
reasoning in writing to be distinguishable from covering something up.

### Option B, by owner ruling

`coordinator-rulings/PTONE-REJECTUX-2035.md:11`, verbatim: *"Show the item's
name with no link and no trace of the address. The user sees a plain label and
gets no signal that anything was refused."* This SUPERSEDED an instruction to
truncate and strip the notice. The `title` is therefore **deleted**, not
shortened: the reference attribute is removed and nothing is added.

Both options are equally safe against the attack — the href is gone either way.
Option A composed a user-visible string out of an attacker-chosen one and
rendered it as product, at whatever length its author liked; the ruling settles
diagnosability against disclosure in favour of disclosing nothing. No
server-side logging and no network call was added.

**Consequence, filed not decided:** "add nothing" leaves an author-supplied
markdown title (`[t](url "title")`) in place on a refused link, because removing
it would be adding a behaviour the ruling did not ask for. That is the same
reach the author already has over the link TEXT, which Option B keeps by design.
The two `ft-inspector` call sites still render Option A notices; a separate pass.

### The hook was on the process-global singleton

`import DOMPurify from 'dompurify'` hands every importer the same object, so the
URL policy was installed where any module could remove it with one
`removeAllHooks()` and where import order decided whether it was installed at
all. Neither is checkable by reading `markdown.ts`. It is now a module-private
`createDOMPurify(window)` instance, with `isSupported` asserted at import so a
missing DOM is a loud error instead of an unsanitised value. Pinned by
`testTheGlobalSanitiserCannotDisarmThisOne`, which calls `removeAllHooks()` on
the global and re-checks both polarities. Pattern copied from
`origin/markdown-sanitize-r10`; nothing merged, cherry-picked or rebased.

### T-1: the fix and its only test could be deleted together

Measured, not argued. `REQUIRED_TEST_FILES` in `scripts/ci-suite-manifest.mjs`
now names the four suites whose absence is a security regression, checked
immediately after the floor. The mutation: `markdown-href.test.ts` removed from
both the index and the disk with a substitute test file added, against a scratch
`GIT_INDEX_FILE` so the real index was never touched.

```
enumerated=7 executed=7 missing=0        floor satisfied, surplus 0
FAIL: 1 named security suite(s) are not in the tree.
        web/src/util/markdown-href.test.ts        exit 1
```

Every other arm green; the new one is the only thing that fired. Its own
positive control fires in-process on every run (`absentFrom([CONTROL_PATH])`
must return 1), because a check whose pass condition is zero is
indistinguishable from a broken check that returns zero. The list is
deliberately NOT the population: removals block, additions are free, mirroring
`.github/expected-go-tests.txt`.

Also corrected there: the RE-DERIVED comment called `markdown-href.test.ts`
"the sixth line being the new one". It is the FOURTH. A wrong ordinal in a
comment about a list is a comment about a different file.

### NOT REPRODUCED — the "16 markdown-only shapes"

The addendum stated that 16 measured shapes reach an off-origin
credential-bearing href **with no raw HTML at all**. Swept all 13 vectors
through markdown link syntax only, on this pipeline: **0 survived off-origin**.
`marked` 15.0.12 percent-encodes backslashes in link destinations, and a literal
tab breaks the link syntax before the sanitiser ever sees it. Every survivor I
measured needed a raw `<a>` or `<svg>`, which `renderMarkdown` does pass through.
The disagreement is recorded rather than resolved: **the fix does not depend on
who is right**, since it decides on the resolved URL regardless of how the
attribute got into the tree, and the raw-HTML path alone justifies it.

### Gates, re-run at `19c306a2`

| gate | result |
|---|---|
| `npm test` | 7 files, 7 pass, 0 fail |
| `go build ./...` | exit 0 |
| `go vet ./...` | exit 0 |
| `go test ./...` | 11 ok, 0 FAIL |
| `node scripts/ci-suite-manifest.mjs` | exit 0 — `enumerated=7 executed=7 missing=0 (floor 7)`, surplus=0, required=4, both positive controls fired |

| commit | item |
|---|---|
| `57531d3c` | docs: strike the static-link-text clause at its two surviving sites |
| `2287883c` | fix: decide URLs with the platform parser; xlink:href; Option B; private instance |
| `19c306a2` | ci: name the security suites in the manifest; fix a false ordinal |
