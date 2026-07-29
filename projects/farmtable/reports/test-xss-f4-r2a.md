# test-xss-r8 — F4 render-sink pins, R-2a discharge, CSP verdict

To: `farmtable-em-hardening`
From: `test-xss-r8`
Date: 2026-07-29

**Every figure below names the commit it was measured at, and every measurement carries
ROOT / DIST / denominator.** Anything asserted about `main` was re-resolved at `main`.

**TREE STATE.** Every figure states it. Baseline figures were re-measured on a fresh clone with
all scratch held outside the repository and `git status --porcelain -uall` sampled after each
individual check — see **§13d**, where I amend my own earlier "(clean)" claims, which were made
with `-uno` and concealed seven untracked scratch files inside the measurement clone. Mutation
arms are dirty by construction; each states the dirt, and the dirt is the point.

**EVERY WEB FIGURE IN THIS REPORT IS NODE v20.** CI pins node 22 (`ci.yml:46`) and no node 22
binary exists in this environment. Where I say green, I mean **green on node 20**, not *CI will
pass*. That distinction is not pedantry here — see §13, where the runner form this branch was
measured under is the one that fails on node 22.

---

## 0. The two things I most want read

Both are defects in **my own deliverable**, and both are the method working rather than the method
being vindicated.

**0a. My locality pin was vacuous, and my own mutation arm caught it.** The first draft of
`bothSinksStillRouteThroughRenderMarkdown` asserted `src.includes('unsafeHTML')` and
`src.includes('renderMarkdown')` as two separate substring checks. Arm M-F rewrites the sink to
`unsafeHTML(this.description)` — unsanitised, live XSS — and leaves the now-unused `renderMarkdown`
import sitting in the emitted file. Both substrings still present. **The guard stayed GREEN while
the thing it guarded was gone.** It now pins the composition `/unsafeHTML\(\s*renderMarkdown\(/`
and separately enumerates every `unsafeHTML` call site. The only reason I know the first version
was worthless is that I was required to name a mutation that turns it red, and when I ran that
mutation it didn't. **That is the argument for shipping an arm with every test**, and it is the
second instance on this track of a guard passing while its subject was absent.

**0b. The test file was classified binary by git, and I re-ran everything rather than assume.**
Caught at commit time: `Bin 0 -> 19911 bytes`. A character class I intended as `/[\s\x00-\x1f]/`
had been written with a **real NUL byte and a real 0x1F byte** in the source. Semantically
identical — which is exactly why every test passed and why no reader would ever catch it: `Read`,
`sed` and every editor render the line as an innocuous `/[\s -]/g`. Had it shipped: no reviewable
diff on the one file whose entire value is being read. After fixing it I re-ran **both mutation
matrices in full**, because "semantically identical" is a prediction, not a measurement. Results
were byte-identical — but that was the outcome of a check, not an assumption.

**Related standing rule, now adopted track-wide: GREP IS NOT AN ORACLE.** My first detector was a
regex over sanitised HTML and it reported three bypasses against a *correct* production chain. All
three false, all three leaning the same way — alarm on working code. Detail in §5.

---

## 1. Headline

| item | result |
|---|---|
| F4 — both sinks pinned | **DONE.** 7 tests, 417 assertions, all 7 killed by a named mutation, zero UNRESOLVED |
| Real bypass found? | **NO.** Production chain 0 / 20 vectors. **Not stopping; no fix needed.** |
| Sanitiser ordering | **CORRECT** — `sanitize(parse(md))`. Load-bearing: reversed gives 2 / 20 live |
| Sanitiser config | **DEFAULTS**, no config object. `javascript:` / `data:` / event handlers all die |
| CSP — does it mitigate the markdown sink? | **NO. There is no CSP.** |
| R-2a — `go test ./internal/webguard/... -count=1` both arms | **DISCHARGED.** Both PASS, rc=0 |

---

## 1. Delivery

| | |
|---|---|
| Branch | `xss-f4-render-sink-pins` |
| SHA | **`a31c8144c3cb21242d53aa2d1ba57876f676b04d`** |
| Absolute path | **`/workspace/farmtable-test-r8`** |
| Preserve ref | `refs/preserve/xss-f4/branch` → `a31c814` (set) |
| Pushed? | **No.** You are the only agent who pushes. |
| Tree state | clean, `git status --porcelain -uall` empty, DIST=absent |

**Base is `901670e`, not `faf1c8c` — flagging this explicitly.** Per your B-then-rebase ruling I
validated where the harness exists. `901670e` and `faf1c8c` diverged at `7a0f220d`; `faf1c8c` is
**not** an ancestor of `901670e`. I did not cherry-pick onto `faf1c8c`, because at `faf1c8c` there
is no jsdom, no `run-tests.mjs`, and `tsconfig.test.json` includes only `src/utils/task-ready.test.ts`
— the commit would be red on arrival and the SHA I reported to you would be one that had never been
run. **The SHA above is the exact object the mutation matrices below were run against.** It rebases
onto r9's union branch the moment you give me that SHA.

Commit contents — three named paths, no bulk staging:

```
 .design/project-log/2026-07-29-xss-f4-render-sinks.md  | 109 ++++++
 web/scripts/run-tests.mjs                              |   2 +-
 web/src/components/inspector/render-sink-xss.test.ts   | 412 +++++++++++++++++++++
```

`run-tests.mjs` is the `EXPECTED_ASSERTIONS` 380 → 417 bump, in the same commit that adds them, as
that file requires.

---

## 2. F4 — what is pinned

Measured at `901670e`. ROOT=`/tmp/f4-901`, DIST=absent, `npm ci` clean.

Sweep denominator: **all of `web/src`**. Exactly **two** `unsafeHTML` call sites exist, and
**zero** `innerHTML` assignments anywhere:

- `web/src/components/inspector/ft-inspector-desc.ts:233` — `${unsafeHTML(renderMarkdown(this.description))}`
- `web/src/components/inspector/ft-inspector-comments.ts:221` — `${unsafeHTML(renderMarkdown(c.body))}`

Both route through the entire control, which is six lines — `web/src/util/markdown.ts`:

```ts
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(marked.parse(md) as string);
}
```

Seven tests, one named test per sink as required:

| test | pins |
|---|---|
| `domPurifyIsOperativeInThisEnvironment` | precondition — DOMPurify actually bound to a window |
| `renderMarkdownNeutralisesEveryKnownVector` | 20-vector corpus through the real chain |
| `renderMarkdownPreservesBenignMarkdown` | anti-vacuity: a sanitiser that strips everything is not a pass |
| `sanitiserRunsAfterParseNotBefore` | ordering |
| **`ftInspectorDescNeutralisesScriptPayloadInDescription`** | **sink 1, at the DOM** |
| **`ftInspectorCommentsNeutralisesScriptPayloadInCommentBody`** | **sink 2, at the DOM** |
| `bothSinksStillRouteThroughRenderMarkdown` | locality — no third sink, no bypass of the chain |

The two per-sink tests render the **real lit component** into jsdom and inspect the resulting
document. They assert neutralisation **by the time the HTML reaches the DOM**, not at the return
value of `renderMarkdown` — which is what you asked for and is a materially stronger claim, because
it also covers the `unsafeHTML` directive and the component's own template.

---

## 3. Mutation evidence — zero UNRESOLVED

Bulletin 19.1 discipline: **N=2 per arm fixed in advance, interleaved by round, no arm re-run to
agreement, every run reported.** Both rounds identical, no split. Each arm carries a liveness
control proving the mutation was actually in the file before the run.

| arm | mutation | liveness | R1 | R2 | tests turned red |
|---|---|---|---|---|---|
| baseline | — | present | GREEN | GREEN | none |
| **M-A** | `DOMPurify.sanitize` removed | removed | RED | RED | 4/7 — vector sweep, order pin, **both sinks** |
| **M-B** | `ADD_TAGS:['script']`, `ADD_ATTR:['onerror','onload']` | present | RED | RED | 3/7 — vector sweep, **both sinks** |
| **M-C** | order reversed → `parse(sanitize(md))` | present | RED | RED | 2/7 — vector sweep, order pin |
| **M-D** | **no-op refactor** (extract local, same semantics) | present | **GREEN** | **GREEN** | none |
| **M-E** | `ALLOWED_TAGS: []` | present | RED | RED | 3/7 — **benign-preservation**, both sinks |
| **M-F** | sink 1 → `unsafeHTML(this.description)` | removed | RED | RED | 2/7 — desc sink, **locality pin** |
| **M-G** | jsdom global setup deleted | present | RED | RED | 6/7 — incl. environment precondition |

**Every one of the seven tests is killed by at least one named mutation. Zero UNRESOLVED,
zero SURVIVED.** M-D is the negative control: it proves the reds are caused by the semantic change
and not by the file having been edited.

**Answering your test directly — "a test that stays green when you delete the sanitiser is not a
test": M-A deletes the sanitiser and turns BOTH per-sink tests red, in both rounds.** M-B is the
subtler arm and the one I would trust more: it leaves `DOMPurify.sanitize` in place and only widens
its config, i.e. it survives any check that greps for the call. Both sinks go red there too.

One honest limitation, reported rather than buried: **M-C does not kill the two per-sink component
tests.** The raw-HTML canary those tests inject is stripped under either ordering, so the sinks
cannot see the difference. That is precisely why `sanitiserRunsAfterParseNotBefore` exists as a
separate pin rather than being folded into the sink tests.

Baseline receipt, ROOT=`/tmp/f4-901`, DIST=absent:
`PASS: 5 test file(s), 417 assertions.`

---

## 4. Ordering and config — the statement you asked for

**Ordering: CORRECT, and load-bearing.** `sanitize(parse(md))` is right. Under the reversed
composition `parse(sanitize(md))`, **2 of 20 vectors go live** — the markdown-link forms
`[click](javascript:alert(1))` and its whitespace-obfuscated sibling. Sanitising the markdown
*source* is a no-op against them, because at that point `javascript:alert(1)` is just text inside
parentheses; `marked` then builds a real `<a href="javascript:alert(1)">` from it afterwards and
nothing runs again. This is not theoretical — it is arm M-C, measured, twice.

**Config: defaults.** `DOMPurify.sanitize` is called with **no second argument** at
`markdown.ts:5`. Against the 20-vector corpus the defaults strip:

- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>` — element-level
- every `on*` event-handler attribute — `onerror`, `onload`, `onfocus`, `onmouseover`, `onbegin`
- `javascript:` in `href` / `src` / `action` / `formaction`, including tab-, newline- and
  entity-obfuscated spellings
- `data:text/html` and `data:image/svg+xml` in navigable positions

**No `javascript:`, no dangerous `data:`, and no event handler survives.** 0 / 20.

I did **not** go looking for a bypass to justify the round, per your instruction. **0/20 is the
result.**

---

## 5. GREP IS NOT AN ORACLE — and neither is a regex over rendered HTML

You asked for this stated as the reason, not just the fix applied.

My first detector was a regex over the sanitised HTML string. Against the **correct production
chain** it reported three bypasses. All three were false:

1. **`<form action=...>`** — the regex matched the substring `action=`. DOMPurify had already
   stripped the attribute; what remained was a bare `<form>`, which executes nothing.
2. **`style="background:url(javascript:alert(1))"`** — matched `javascript:`. No browser shipping
   today executes `javascript:` from a CSS `url()`; it has been dead since IE.
3. **A literal `![x](x" onerror=` sitting in a text node** — matched `onerror`. It was *text*.
   DOMPurify had correctly escaped it into content, which is the sanitiser working, not failing.

Three false alarms, and every one of them leaning the same direction: **alarm on correct code.**
That is my fourth measured instance of a fails-toward-alarm lean and I am reporting it as such.

The fix is structural, not a tighter pattern. `findExecutable()` now parses the output into a real
document and asks the DOM the questions a regex cannot answer: *is this an attribute or is it
text?* *is this attribute name actually an event handler?* *is this element actually in the tree?*
It flags `^on` attributes, dangerous URI schemes in navigable attributes after control-character
normalisation, and live `SCRIPT`/`IFRAME`/`OBJECT`/`EMBED`/`BASE` elements. All three false
positives cleared, and the 15/20 under M-A still fires — so the fix did not simply blunt the
instrument.

**A regex over HTML cannot distinguish a stripped attribute from a live one, or an escaped payload
from an executing one. That distinction is the entire finding. So the assertions parse a DOM.**

---

## 6. Two defects this work found in its own deliverable

Reporting both, because the mutation arm catching my own bad assertion is the part of the method
that actually earned its keep this round.

**6a. `bothSinksStillRouteThroughRenderMarkdown` was vacuous, and M-F proved it.** The first draft
asserted `src.includes('unsafeHTML') && src.includes('renderMarkdown')`. M-F rewrites the sink to
`unsafeHTML(this.description)` — unsanitised — and leaves the now-unused `renderMarkdown` import in
the emitted file. Both substrings still present. **The assertion stayed GREEN while the sink was
live.** It now pins the composition `/unsafeHTML\(\s*renderMarkdown\(/` and separately enumerates
the component tree, asserting the set of files calling `unsafeHTML(` is exactly
`ft-inspector-comments.js,ft-inspector-desc.js`, so a *third* sink fails rather than passing
unnoticed. M-F now kills it. This is a count-neutral-style corruption of exactly the kind I have
been auditing others for, in my own test, caught only because the arm existed.

**6b. The test file contained two literal control bytes and git classified it as binary.** Caught
at commit time: the diffstat read `Bin 0 -> 19911 bytes`. Root cause — the character class I
intended to write as `/[\s\x00-\x1f]/` had been written with a **real NUL byte and a real 0x1F
byte** in the source at line 117. Semantically identical, which is why every test passed and why no
reader would ever have spotted it: the Read tool, `sed` and every editor render the line as the
harmless-looking `/[\s -]/g`. Consequences had it shipped: **no reviewable diff on the single file
whose whole value is being read**, and silent corruption on any copy/paste or editor round-trip.
Fixed at byte level to visible escapes; the file now contains zero non-printable bytes outside tab
and LF, and the diff is 412 readable lines. **Both mutation matrices were re-run in full after the
fix and are byte-identical to the pre-fix results** — I did not assume a "semantically identical"
edit forward.

---

## 7. CSP — ITEM E, the half IAP does not catch

Measured at **`faf1c8c`** (main). ROOT=`/tmp/r2a-run`, DIST=absent. Denominator: **all** `.go`,
`.ts`, `.html`, `.yaml`, `.yml` in the repository.

### VERDICT: DOES CSP MITIGATE THE MARKDOWN SINK? **NO. THERE IS NO CSP.**

- **Emitting site: NONE EXISTS.** Zero occurrences of `Content-Security-Policy`,
  `ContentSecurityPolicy` or `content-security-policy`, case-insensitive, repo-wide. No `<meta
  http-equiv>` CSP in `web/index.html`.
- **Positive control on that zero:** the same sweep finds `Header().Set` at 10+ sites, so the
  search discriminates and the zero is a real absence, not a broken query. *(Per your standing
  rule: this control validates the instrument only. The substrate claim — that no CSP exists — is
  the file-level absence, which you independently re-confirmed at `faf1c8c`.)*
- **Serving path, by identifier:** the dashboard is served by `serverapp.UnifiedHandler` →
  `internal/serverapp/unified.go:101`, `mux.Handle("/", http.FileServer(assets))`. A bare
  `FileServer`. It sets no headers at all.
- **The only response header set anywhere in that path** is `Content-Type: application/json` at
  `internal/serverapp/session.go:286`.
- **Does it permit inline script?** The question does not arise — with no CSP the browser applies
  no script restriction whatsoever. Inline script, `eval`, and remote script are all permitted.

**IAP does not close this.** IAP authenticates the *request*. The markdown sink executes in an
already-authenticated user's own browser, with their session, on content another user stored. The
authentication boundary is upstream of the vulnerability, not across it. This is the one the
infrastructure in front does not catch.

Consistent with your downgrade: this is not a live vector. It is **the control is correct today,
it is the only control, there is no CSP behind it, and until this commit nothing would have gone
red if someone deleted it.**

---

## 8. Minimal CSP sizing — one paragraph, as scoped

Measured at `faf1c8c`. Denominator: `web/index.html` plus all of `web/src`, plus the shipped
runtime dependency tree.

The app has **exactly one inline `<script>`** — a theme-flash-prevention IIFE at
`web/index.html:17–28` that reads `localStorage['ft-theme']` and toggles the `sl-theme-dark` class
before first paint. There is **no `eval` and no `new Function` in our source**, and none in any
shipped runtime dependency: `protobufjs`, `@improbable-eng/grpc-web`, `lit`,
`@shoelace-style/shoelace`, `@dagrejs/dagre` and `marked` are all zero. The single `dompurify` hit
is in `dist/purify.cov.cjs.js`, a coverage build that is not the entry point and is not shipped.
**So a `script-src` strict enough to mitigate this sink is a one-line fix, not a project:** hash or
nonce that one block, or move it to a module, and `script-src 'self'` holds. The messier half is
`style-src` — one inline `<style>` block plus ~20 inline `style=` attributes in lit templates,
which would need `'unsafe-inline'` or real work — **but `style-src` is not what mitigates a script
sink.** The two can be scoped independently, and the valuable half is the cheap half.

---

## 9. R-2a — DISCHARGED

`go test ./internal/webguard/... -count=1`, both arms, pristine tree.
**ROOT=`/tmp/r2a-run`** (throwaway clone from a local path, outside `/workspace`). **DIST=absent.**
`-count=1` used on every invocation, so no cached results.

| arm | packages | tests | result | rc |
|---|---|---|---|---|
| `e4e3d13` | 1 | 3 | all PASS | **0** |
| `901670e` | 1 | 4 | all PASS | **0** |

Denominator is 1 package both arms — `internal/webguard` is the whole matched set; the `/...`
expands to nothing further. The arm-to-arm delta is one added test,
`TestWebCensusAnchoringIsTopLevelOnly`, hence 3 → 4.

**I verified your scoping claim rather than accepting it.** `internal/server/convert.go` and
`internal/server/export_import.go` fall inside the commit range, which would have put them in
scope. Both have **0 non-comment changed lines** — the diff is comments only. Positive control for
that measurement: the same non-comment differ reports **111** changed lines on the webguard test
file, so it is not silently returning zero.

**No blocker remains on R-2a.** R-2b (TypeScript) is not mine.

---

## 10. Secondary observation — harness fragility, not a finding

Surfacing rather than escalating, per composition rules. **The test program is not the typecheck
program.** `npm run typecheck` compiles all of `src/`, so it picks up Shoelace's
`HTMLElementTagNameMap` augmentation transitively via `src/index.ts`. `tsconfig.test.json` compiles
only the transitive closure of `*.test.ts`. Adding a test that imports an app component therefore
fails with `error TS2339: Property 'open' does not exist on type 'Element'` at
`ft-inspector-comments.ts:111` — **an error in a file the test does not modify and the app compiles
cleanly.** I resolved it with a type-only import of the Shoelace declaration in the *test* file,
not in app source; importing the real component would drag Shoelace into jsdom. This will bite the
next person who adds a component test, and the error message points at the wrong file.

Also noted and moving on, per your instruction: the four pre-existing `assignment copies lock
value` vet findings at `internal/server/server.go` lines 1500, 1610, 1818, 1995. Not a regression,
declined for this track, no action taken.

---

## 11. What I did not do

- **No fix.** Pinning only, per scope. Nothing to fix — 0/20.
- **No CSP added.** Reported for you to scope.
- **No push.** Branch and preserve ref are local to `/workspace/farmtable-test-r8`.
- **No `web/dist` created, deleted or cleaned** anywhere. All measurement in throwaway clones
  outside `/workspace`, cloned from local paths only.
- **Apparatus retained** as instructed: `/tmp/m8-r8-clone` and `/tmp/ignoretest` are untouched.
  `/tmp/f4-901` and `/tmp/r2a-run` are now also audit trail and I will not dispose of any of the
  four until you say.

---

# ADDENDUM — post-rebase, 14:35Z

## 13. The rebase, and the finding it produced

**Rebased. New SHA `30064929d0e7209bd0b67a7fa4ee9aa2328bd1fc`, path `/workspace/farmtable-test-r8`,
branch `xss-f4-render-sink-pins`, `refs/preserve/xss-f4/branch` updated. Not pushed.**

**I did not rebase onto `34ce4da`.** You gave me that SHA and also named
`refs/preserve/xss-union/branch`. By the time I got there the ref had moved to **`d7154a4`**, which
is strictly ahead of `34ce4da` (ancestor: YES) and carries main `43bd206`. I followed the ref, not
the SHA, because the SHA was the stale half of the same instruction — and because `34ce4da`
predates `43bd206`, so rebasing there would have delivered onto a base where the new gates cannot
even run. Flagging the deviation explicitly rather than quietly taking the better option.

**One hunk dropped.** The rebase conflicted on `web/scripts/run-tests.mjs` — r9 raised
`EXPECTED_ASSERTIONS` 380→483, I had raised it 380→417. I dropped mine and took the union's
verbatim. The file is no longer invoked by `npm test`, so my edit was dead weight, and a stale
count in a dead file is worse than no count. Per your instruction I did not try to preserve the
receipt. **My commit now touches exactly two paths and does not include `run-tests.mjs`.**

### 13a. THE FINDING: on the delivery base, these tests do not execute

ROOT=`/tmp/f4-union`, DIST=present, base `d7154a4`, node v20.

`web/package.json` at `d7154a4` still carries main's script,
`node --test .tmp-test/utils/task-ready.test.js` — one hardcoded file. Measured:

| | |
|---|---|
| web test files on branch (denominator) | **6** |
| executed by `npm test` | **1** |
| never executed | **5**, including both of my sink pins |
| `render-sink-xss.test.js` compiled? | **yes** — compiled, then not run |

**And the consequence, measured rather than predicted: with `DOMPurify.sanitize` deleted from
`markdown.ts` (arm M-A), `npm test` on the delivery base is GREEN — `# tests 1 / # pass 1 /
# fail 0`.** The sanitiser is gone, both stored-XSS sinks are live, and the suite is green. My
pins are inert under the currently committed script.

This is your held hunk, not a defect in the tests, and I have **not** touched it — no runner
written, no glob invented, `scripts/ci-suite-manifest.mjs` untouched. Recording it because
"delivery is not consumption" is my standing axis and this is the cleanest instance of it I have
measured: **the tests exist, compile, are correct, discriminate, and do nothing.** Your predicted
guard arithmetic was 5 enumerated / 1 executed / 4 missing; with my file it is **6 / 1 / 5**.

**I verified this was correct-for-main before characterising it.** Main `43bd206` has exactly
**1** web test file (`web/src/utils/task-ready.test.ts`), so its single-file form skips nothing
there — no security guard is silently unexecuted on main. Had I not checked I would have filed
"main silently skips its URL-scheme guard," which is false, and which would have been my fifth
fails-toward-alarm. `safe-url.test.ts` and `url-binding-scan.test.ts` do not exist on main; they
are ours.

### 13b. Matrices re-run in full on the new base — nothing changed

N=2 per arm, interleaved, liveness control per arm, no arm re-run to agreement, no split.
Run twice over: once under `node --test .tmp-test` (the directory form), and once under the
portable explicit-file form `node --test .tmp-test/components/inspector/render-sink-xss.test.js`,
since the directory form is the one that dies on node 22.

**All 7 tests killed by ≥1 named mutation. M-D negative control GREEN ×2. Zero UNRESOLVED.
Identical to the pre-rebase results, arm for arm.** Under the directory form I additionally
confirmed `node --test` marks my file `not ok` on every red arm — it surfaces the failure rather
than swallowing it, which was the live risk when the custom `run-tests.mjs` reporter went away.

Baseline on the new base: my file alone reports `#assertions 37`, `# pass 1 / # fail 0`.
The 417-assertion suite receipt is gone with the runner, as you said it would be; the matrices are
unaffected because they never rested on that number.

### 13c. TS2339 re-checked, not carried forward — it still reproduces

You were right to make me re-check rather than carry it. The union branch takes main's
`tsconfig.test.json`, widening `include` from 1 entry to 4 globs, which could plausibly have
dissolved the whole observation. **It does not.** Deleting my type-only Shoelace import at
`d7154a4` still yields:

```
src/components/inspector/ft-inspector-comments.ts(111,20): error TS2339: Property 'open' does not exist on type 'Element'.
```

The widened globs add more *test* files; they do not add the app entry point that supplies
Shoelace's `HTMLElementTagNameMap` augmentation. The test program is still narrower than the
typecheck program, and the error still points at a file the test never modifies. Observation
stands, now verified at the delivery base.

## 13d. TREE-STATE AMENDMENT — I used a flag that concealed my own scratch

Filed against myself under the 14:38Z rule, before anyone asked.

**I reported "(clean)" several times in §13–14 using `git status --porcelain -uno`. That flag
suppresses untracked files.** At the moment I made those measurements, `/tmp/f4-union` contained
seven untracked scratch files **inside the clone**:

```
?? .orig/desc  ?? .orig/md  ?? .orig/test
?? md.keep  ?? mutate-union.sh  ?? pkg.orig  ?? t.keep
```

The mutation driver and its restore snapshots were living in the repository root. My answer was
true as phrased and misleading in substance — precisely the hole the CI leg disclosed. **This is
the same failure mode as the regex oracle and as `-uno` on a check-ignore question: the instrument
answered a narrower question than the one I was actually asking, and I read the narrow answer as
the broad one.**

**So I discarded those figures and re-measured from a fresh clone with all scratch outside it,
sampling porcelain after every single check.** ROOT=`/tmp/f4-clean`, commit `3006492`, scratch at
`/tmp/f4-scratch`, DIST=present.

| # | check | value | porcelain `-uall` after |
|---|---|---|---|
| 0 | at rest | — | EMPTY |
| 2 | `go list ./...` | **33** | EMPTY |
| 3 | `go vet ./...` | **rc=0, clean** | EMPTY |
| 4 | `npm ci` | OK | EMPTY |
| 5 | `npx tsc --noEmit` | **rc=0, clean** | EMPTY |
| 6 | `npm test` | **1 executed** | EMPTY |
| 7 | web test files tracked | **6** | EMPTY |

**Every value is identical to what I reported. Nothing changes except that the numbers are now
defensible.** `node_modules/` and `web/.tmp-test/` are present on disk during checks 4–6 and are
gitignored at `.gitignore:45` and `:46` — disclosing that rather than letting "porcelain EMPTY"
imply an empty directory.

**The M-A demonstration in §13a is dirty by construction and the dirt is the point.** Re-run under
the same discipline:

- before mutation — porcelain **EMPTY**
- M-A applied — porcelain **DIRTY**, exactly one path: ` M web/src/util/markdown.ts`
- liveness at the moment of measurement — `grep -c DOMPurify src/util/markdown.ts` = **0**, the
  sanitiser is verifiably gone, not merely edited
- **`npm test` → `# tests 1 / # pass 1 / # fail 0`** — green, with the sanitiser deleted
- after restore — porcelain **EMPTY**, `markdown.ts:5` back to `return DOMPurify.sanitize(...)`

The same statement applies to every mutation arm in §3 and §13b, and to the TS2339 re-check in
§13c: each was measured with exactly one intended modification present and the tree returned to
empty afterwards. **A mutation arm is dirt by definition. The measurement is what the dirt causes.**

Delivery tree `/workspace/farmtable-test-r8` re-verified with `-uall`: **empty, untracked
included.**

## 13e. MEASURE THE COMMIT, NOT THE TREE — how each figure here was produced

Under the 14:40Z rule. Stated, not re-run wholesale, per your instruction.

**Baseline figures (§13d table): COMMIT-MEASURED.** `/tmp/f4-clean` is a fresh clone with
`git checkout 3006492`, all scratch held at `/tmp/f4-scratch` outside the repository. The working
tree contains what the commit contains and nothing else — porcelain `-uall` empty after every
individual check.

**Provenance of the one thing the tree has that the commit does not.** `node_modules/` is the
exact class of artefact that produced a false green on this track, so I checked rather than
assumed: it is `npm ci` from `web/package-lock.json`, which **is tracked in the commit**, into a
fresh clone. Nine symlinks exist at scoped depth — all standard `.bin` shims
(`tsc`, `vite`, `rollup`, `marked`, …) resolving *inside* `node_modules`. **Zero escape the
directory.** Nothing was linked in from outside, which is the r9 mechanism specifically.

**Both GREEN arms re-run in dedicated fresh checkouts.** False greens are the failure that
matters, and I had exactly two greens. Each got its own clone that never held scratch and never
had anything else applied:

| arm | ROOT | porcelain `-uall` | result |
|---|---|---|---|
| baseline | `/tmp/f4-nc-baseline` | **EMPTY** | `# pass 1 / # fail 0`, rc=0 |
| M-D negative control | `/tmp/f4-nc-MD` | ` M web/src/util/markdown.ts` — the intended mutation, nothing else | `# pass 1 / # fail 0`, rc=0 |

M-D mattered most: it is the control that licenses every RED in this report. Had it been a false
green produced by tree contamination, the whole matrix would rest on nothing.

**The RED arms remain tree-measured, and I am declaring that as a confession rather than
certifying it.** Each was produced in `/tmp/f4-union`, which held the seven scratch files.

**~~A tree carrying more than its commit biases toward false PASS, not false FAIL, so the REDs are
safe in direction.~~ — WITHDRAWN, 14:44Z. This argument was wrong and I had it as a principle.**
It holds for an ordinary test, where you want green and contamination manufactures green. **It
does not transfer to a mutation arm, where I want the red.** A red produced by contamination
rather than by the mutation is a **FALSE RED**, and a false red means the pin did *not* catch the
mutation while I believe it did. That is the believed-guard failure — the identical shape to the
§13a finding this entire branch is blocked over, arrived at from the opposite direction. My
argument protected me against under-claiming. **Over-claiming is the failure mode here, and it
protected me against nothing.**

**Second defect, also not mine to spot:** baseline is now commit-measured and the arms are
tree-measured, so **the differential is confounded**. The delta between them could be "fresh clone
vs. scratch-bearing tree" rather than "no mutation vs. mutation." A differential needs both sides
under identical conditions, and mine are not. **The liveness control proves the mutation was
PRESENT at run time; it does not prove the mutation CAUSED the red.** I had been treating presence
as causation.

**What partial evidence does exist** — offered as partial, not as a rescue: the matrix captured a
TypeScript-error column on every run, and it was **empty for all sixteen**, so no arm went red via
a compile failure. Each red additionally names specific assertions from my own harness rather than
failing opaquely. That is consistent with assertion-caused reds and inconsistent with the crudest
contamination mechanism. It is not causation.

**Ruling (EM, 14:44Z): do NOT redo the fourteen.** CI satisfies measure-the-commit by construction
and will re-measure the matrix properly once EM-CI's runner lands, so eight clones now buys a
result discarded within the hour. **Nothing merges on these fourteen in the meantime, and they are
not to be cited as merge evidence — by him or by me.**

### Pre-registration, so nothing gets quietly reconciled later

When the runner lands, baseline and arms get re-run **in the same conditions**. Recording the
tree-measured per-arm expectation *now*, before CI can settle it, so any divergence is visible
rather than explainable after the fact:

| arm | predicted red tests |
|---|---|
| baseline | none (GREEN) |
| M-A | vector sweep, order pin, **both sinks** (4) |
| M-B | vector sweep, **both sinks** (3) |
| M-C | vector sweep, order pin (2) |
| M-D | none (GREEN) — commit-measured already |
| M-E | benign-preservation, both sinks (3) |
| M-F | desc sink, locality pin (2) |
| M-G | 6 of 7 incl. environment precondition |

**If any arm that was red on the tree comes back green in CI, that is a finding and it gets
reported loudly.** A green there would mean the pin never caught that mutation and I claimed it
did.

## 13f. ARTEFACT RE-RESOLUTION (14:45Z rule) — and one finding it produced

Every claim I hold that could be artefact-ambiguous, re-resolved in a **fresh checkout** with the
artefact named **in the same sentence as the result**.

**CSP finding: SURVIVES, and now names the binary.** ROOT=`/tmp/artefact`, commit **`43bd206`**,
porcelain `-uall` **0**. I had written "the dashboard is served by `serverapp.UnifiedHandler`"
without saying which binary — exactly the ambiguity you flagged. Re-resolved:

- `Dockerfile` → `CMD ["/ft","dashboard","--port","8080"]`, built from `./cmd/ft`
- `Dockerfile.server` → `CMD ["/farmtable-server"]`, built from `./cmd/farmtable-server` — **the
  live service**

**Both** route through `UnifiedHandler`: the shipped binary at `cmd/farmtable-server/main.go:112`,
and `ft dashboard` at `internal/cli/dashboard.go:134`. `internal/serverapp/unified.go` sets
**zero** headers by any spelling, and `mux.Handle("/", http.FileServer(assets))` is at
**`unified.go:101`** at this commit. Repo-wide CSP occurrences: **0**; positive control
`Header().Set`: **10**.

**Restated with the artefact inside the sentence: `farmtable-server` — the binary the deploy logs
confirm is live, built via `-f Dockerfile.server` — serves the dashboard through a bare
`http.FileServer` that emits no Content-Security-Policy.** The finding did not depend on the
wrong artefact, but I could not have known that until I checked.

- **MEASURED** — @`43bd206`, fresh clone, porcelain `-uall` 0: 0 CSP occurrences repo-wide against
  a 10-hit `Header().Set` positive control; both binaries reach `UnifiedHandler`
  (`cmd/farmtable-server/main.go:112`, `internal/cli/dashboard.go:134`); `unified.go` sets no headers.
- **NOT MEASURED** — no HTTP response was captured from a running container or the live service. I
  read the serving path; I did not observe a response. An edge proxy could add CSP where the repo
  does not, and that is exactly the class of thing the repo cannot tell me.
- **PRECONDITIONS** — bites only if no CSP is injected above the Go handler. **Not checked**, and
  not checkable from the repo. Same shape as A2/A3.

**CSP IS OUT OF SCOPE (P2, unowned).** Nothing above is a request to start it; it is the record of
what was measured while it was still a live question, kept so P2 does not begin from zero.

**CSP sizing: artefact-independent.** Both Dockerfiles have byte-identical frontend stages
(`node:22-bookworm`, `npm ci`, `npm run build`), so the shipped frontend is the same asset either
way. At `43bd206`: **1** inline `<script>` in `web/index.html` (line 17), **0** `eval`/`new
Function` in `web/src`. Sizing conclusion unchanged.

### THE FINDING: the release gate is decorative for exactly the guards it names

ROOT=`/tmp/f4-clean`, commit **`3006492`** (our branch), porcelain `-uall` **0**.

I nearly filed "CLAUDE.md falsely claims the container builds run the web suite." **I checked
first, and it is not false** — the claim exists only on our branch, not at `43bd206`, and on our
branch both Dockerfiles genuinely carry `RUN npm test` at line 9, under the comment:

> `# the release path must not be able to ship a tree whose guard is red.`

**So the gate is real, deliberate, and documented. And it does not do the thing it was built to
do.** `CLAUDE.md:104` names `web/src/util/url-binding-scan.test.ts` and `safe-url.test.ts` as the
client-side half of the URL-scheme security property and says "a red guard fails the image." Both
files are tracked at `3006492`. Measured:

| | |
|---|---|
| `RUN npm test` present in **both** Dockerfiles | yes, line 9 |
| test files that command executes | **1** (`task-ready`) |
| the two named security guards among them | **0 matches** |

**Both container images — including `farmtable-server`, the live one — run a test command whose
explicit purpose is to block a red guard, and that command does not execute either guard it was
written to protect.** This is §13a made materially worse: not only do my new XSS pins not run, the
*documented release backstop* silently skips the two pre-existing security guards, and
`CLAUDE.md` tells every future agent that it doesn't.

It is the same believed-guard shape a third time today: **the gate exists, is intentional, is
documented, and is empty.** Same root cause as everything else here — main's single-file test
script is correct for main's one test file and wrong for any branch with more.

- **MEASURED** — @`3006492` (this branch), fresh clone `/tmp/f4-clean`, porcelain `-uall` 0:
  `RUN npm test` at line 9 of **both** `Dockerfile` and `Dockerfile.server`; that command executes
  **1** test file (`task-ready`); `url-binding-scan.test.ts` and `safe-url.test.ts` are tracked and
  score **0 matches** in the run output. At `43bd206` the `RUN npm test` line does not exist at all.
- **NOT MEASURED** — **I did not build either image.** I read the Dockerfiles and ran `npm test` in
  a clone; I am inferring that the `RUN` line behaves in the build the way it behaves in my shell.
  I also did not measure the other container steps — C8 stays open.
- **PRECONDITIONS** — bites only on a branch carrying *both* the container gate and main's
  single-file `test` script, i.e. this branch and the union, **not** main. **Checked**: main has
  neither half, so nothing shipped today is affected.

**No fix attempted, and I am not following this.** It sits inside the held `web/package.json` hunk
and closes when EM-CI's runner lands. Filed as backlog **C10**. Recorded here only because it
raises the stakes on an existing hold — from "my pins are inert" to "the documented release gate is
inert" — not because it opens anything.

## 13g. THE TIP RUN — 439b309, under the real shared runner

ROOT=`/tmp/tip439`, fresh clone, `git checkout --detach 439b309`, porcelain `-uall` **0** before
install and **0** after (`node_modules` gitignored). `npm ci --offline` EXIT=0 — the same call that
is line 4 of both Dockerfiles. **node v20.20.2; there is still no node 22 binary in this
environment, so every figure below is "the real runner on node 20", not "CI".** Mutation arms make
the tree dirty on purpose; each arm's diff-line count is reported as its own column so a
zero-diff non-mutant cannot masquerade as a survivor.

### (a) Per-arm diff against the FROZEN §13e table

**THE DIFF IS EMPTY. Every arm matched its pre-registered count, on both rounds, exactly.**

| arm | pre-registered | tip result (r1, r2) | diff | liveness | vacuity (diff lines) | status |
|---|---|---|---|---|---|---|
| baseline | GREEN | GREEN, GREEN | — | pristine | 0 — no mutant, by definition | MEASURED |
| M-A | 4 of 7 | **4, 4** | none | removed | 3 | MEASURED |
| M-B | 3 of 7 | **3, 3** | none | present | 5 | MEASURED |
| M-C | 2 of 7 | **2, 2** | none | present | 2 | MEASURED |
| M-D | GREEN (neg. control) | GREEN, GREEN | none | present | 3 — **not vacuous** | MEASURED |
| M-E | 3 of 7 | **3, 3** | none | present | 2 | MEASURED |
| M-F | 2 of 7 | **2, 2** | none | removed | 2 | MEASURED |
| M-G | 6 of 7 | **6, 6** | none | present | 2 | MEASURED |

**No arm that was red on my tree came back green at the tip.** The believed-guard direction did
not fire. Every run reported `enum=6 exec=6`; no arm silently shrank the suite.

- **MEASURED** — all sixteen runs above, plus `Compiling 6` / `Running 6` on every one.
- **NOT MEASURED** — **this is not CI.** I ran the runner CI runs, at the commit CI would run, but
  on node 20 and on this machine. I have not seen a CI job for 439b309. If CI on node 22 disagrees
  with any row, CI is right and I want to hear it.
- **PRECONDITIONS** — liveness confirms each mutation was **present** at run time; it does **not**
  establish that the mutation **caused** the red. What licenses causation here is M-D: 3 real diff
  lines, semantically neutral, GREEN on both rounds. No arm was vacuous, so nothing is reported as
  "control unreachable".

### (b) C10 — **CLOSED**, verified rather than inferred

At `439b309`, `RUN npm test` is still present in **both** Dockerfiles (`Dockerfile:20`,
`Dockerfile.server:21`), now under a comment naming the discovering runner. Executed:

| | at 3006492 (C10 filed) | at 439b309 |
|---|---|---|
| enumerated / executed / missing | 6 / 1 / 5 | **6 / 6 / 0** |
| `url-binding-scan.test.js` executed | **0** | **1, ok** |
| `safe-url.test.js` executed | **0** | **1, ok** |
| `render-sink-xss.test.js` executed | 0 | **1, ok** |
| `npm test` EXIT | 0 (vacuously) | **0 (on 6 files)** |

**C10 closes by construction, and the construction was checked.** The release gate now executes
the two guards it was written to protect. **NOT MEASURED:** I still have not built either image —
that the `RUN` line behaves in a build as in my shell remains inferred, unchanged from the filing.

### (c) BOARD READING — canary the property, then ask which guard went red

Two properties, each broken at the tip, reporting **every file** rather than my own.

**Property 1 — stored content must not reach the DOM executable.** Broken by deleting
`DOMPurify.sanitize` (M-A, 3 diff lines, not vacuous):

```
ok 1 - capabilities.test.js          ok 3 - util/assertions.test.js
not ok 2 - render-sink-xss.test.js   ok 4 - util/safe-url.test.js
                                     ok 5 - util/url-binding-scan.test.js
                                     ok 6 - utils/task-ready.test.js
```

**ONE FILE REDS, AND IT IS THE ONE WRITTEN THIS AFTERNOON. The other five are green while stored
markdown renders `<script>` and `img[onerror]` into the DOM.** This is the finding, and it is
about the other five files, not about mine. It is not an oversight by any of them:
`url-binding-scan.test.ts`'s own header states its boundary — *"WHAT IT STILL DOES NOT SEE … lit's
`unsafeStatic` and `unsafeHTML`"* — so the tree's one tree-wide scanner **excludes this sink by
design and says so in writing**. The exclusion was documented and the replacement never existed.
Before today, deleting the sanitiser reddened nothing.

**Property 2 — a URL-bearing attribute must never carry a dangerous scheme.** Two arms, because
one arm cannot distinguish behaviour from locality:

| arm | diff lines | safe-url | url-binding-scan | others |
|---|---|---|---|---|
| `safeHref` body gutted to `return raw` | 64 | **not ok** | ok | all green |
| a binding bypasses `safeHref` (`ft-inspector-meta.ts:21`) | 2 | **not ok** | **not ok** | all green |

**Answer to "is one correct?" — NO, and r9's single arm undersold this property rather than
overselling it.** It is defended on two complementary axes by two files. Gutting the function reds
only the behavioural guard, which is correct: `url-binding-scan` is a static chokepoint scanner and
has no opinion about what `safeHref` *does*. Bypass the chokepoint instead and **both** red —
`safe-url.test.ts` turns out to carry component-level assertions too (it renders
`ft-inspector-meta` and asserts a `javascript:` URL *"must not produce an anchor at all"*), and the
scanner rejects the stale allow-list entry by name. So: URL-scheme is **two files deep on two
axes**; the markdown sink is **one file deep on one axis**, and that file is one commit old.

- **MEASURED** — the four boards above, each with its diff-line count, each restored to 0 after.
- **NOT MEASURED** — I did not enumerate *why* each of the five green files is green under M-A
  beyond `url-binding-scan`, whose exclusion is self-documented. I am not claiming the other four
  *should* have caught it.
- **PRECONDITIONS** — the asymmetry bites only where content reaches the DOM through `unsafeHTML`.
  **Checked:** exactly two such call sites exist, both pinned, and the sweep in my own file fails if
  a third appears.

## 14. Gates — measured, ROOT and denominator stated

> **Tree state for this section:** re-measured at `/tmp/f4-clean` per §13d. The `34ce4da` and
> `43bd206` rows below were taken in a pristine clone and a throwaway `git worktree` respectively,
> neither of which ever held scratch; the `d7154a4` row was originally taken in the clone that held
> the seven files and has been re-measured clean.

Your retraction of the "vet is unusable" rule is correct **at 43bd206** and I can confirm it, but
it does **not** reach the SHA you told me to rebase onto:

| tree | ROOT | `go list ./...` | `go vet ./...` | `web/dist/.gitkeep` |
|---|---|---|---|---|
| main `43bd206` | `/tmp/wt-43bd` | **32 of 32** | clean | present |
| union `34ce4da`, pristine clone | `/tmp/f4-union` | **0** (`-e`: 33) | `pattern all:web/dist: no matching files found` | **absent** |
| union `d7154a4` = my base, pristine clone | `/tmp/f4-union` | **33 of 33** | clean | present |

Your "32 of 32 on main, 33 of 33 on the XSS branch" is confirmed, and the delta is exactly one
package: `internal/webguard`, which main does not have. **But the 33 only holds from `d7154a4`
onward.** On a pristine clone of `34ce4da` it is 0, because `.gitkeep` arrives with `43bd206`.
r9's own working tree reads 33 at every point only because the directory exists on disk there.
This is the same shape as r9's symlinked `node_modules`: the local signal was real and did not mean
what it appeared to mean. Anyone quoting a union-branch vet figure needs to say which union commit.

**Membership manifest: nothing for me to add, and I did not.** The 501-entry manifest is
package-qualified Go tests; my commit adds **zero** Go tests and touches zero Go files. Under your
corrected rule ("add your own, by name; never regenerate") my correct action is no action.
Recording the reasoning because your first broadcast and your standing "do not touch
`scripts/ci-suite-manifest.mjs`" pointed opposite ways for a web test, and I want it on record
which one I followed and why: **I touched neither manifest.**

Also confirmed and not re-reported: the copylock quartet is fixed at `43bd206` (`proto.Clone`),
and my branch surfaces no vet findings at all.

## 15. Open

**MERGE STATUS (EM ruling, 14:37Z): the union branch does not merge until EM-CI's shared runner
lands.** The §13a measurement is the evidence — merging as-is would ship a guard that everyone
believes in and nothing enforces. An absent guard is honest; a decorative one is not. EM-CI has
been told the runner now gates a security merge, and explicitly told not to hurry. The branch sits
red and honest until then.

1. **`web/package.json` "test" hunk — HELD, per your instruction.** Until EM-CI's shared runner
   lands, my pins are compiled and not run on the delivery base. I will take the runner and re-run
   the moment you relay it. **This is the only thing standing between these tests and being live.**
2. **CSP `script-src`** — scoped by you as its own change, not folded into the union. Not started,
   per instruction.
3. Everything else is delivered.

## 16. PRESERVATION — the durability figure, scoped

Wind-down bundling (15:33Z–15:41Z instructions). Recorded here because the figure is easy to
over-read, and EM's 15:43Z retraction withdrew the reference set I originally tested against.

**MEASURED.** Two sweeps into refs before bundling — `git fsck --unreachable --dangling` → 308
commits → `refs/preserve/unreachable/*`; `git reflog --all --format=%H | sort -u` → 8 SHAs →
`refs/preserve/reflog/*`. 528 refs total, bundled as `bundles/test-xss-r8-v2.bundle`
(4,063,104 bytes), restored into an empty repo, 528 refs back, blob
`a31c814:web/src/components/inspector/render-sink-xss.test.ts` read through at 19,917 bytes.
Of 316 swept objects, **1** is absent from every store outside this container: `a31c814`, the
pre-amend commit. v1 (`--all` only, 3,079,177 bytes) dropped 308 of those 316 — real durability
loss **0**, because all 308 are in canonical and the container-only one was already a ref.

**NOT MEASURED.** "Absent from canonical" is a statement about the *local* canonical store at
`/workspace/farmtable` and about r9's store. It says nothing about GitHub. Per EM's retraction,
`origin` in a leg tree is canonical, not GitHub, and canonical's fetch refspec is heads-only —
so no measurement here reaches the network remote, and I did not make one. The reason `a31c814`
cannot be on a remote is *provenance*, not measurement: it was created by `git commit --amend`
in this container and I have never pushed.

**PRECONDITIONS.** The durability predicate is **object presence elsewhere**, not ancestry from
canonical main. Checked: ancestry would have answered the wrong question, since `a31c814` is
reachable from no branch anywhere. Also checked: canonical HEAD is `633f8f2` (branch
`task-state-web-ui-v2`), **not** main — every figure above resolved `main` by name
(`2982ffd8f3f6e231d8855b9cae7c448c2bd3144f`). A bare `git fetch /workspace/farmtable` returns
that HEAD and would have shifted the answer in the losing direction.

**Internal control on the durability loop.** 315 of 316 came back present. A loop whose `git`
invocation was broken yields 316 of 316 *absent* — the plausible-looking clean table EM warned
about at 15:43Z. The 315 is what rules that out; stderr was captured to a file and read, not
discarded. `git cat-file -e` is silent on a full-40-hex miss, so the empty stderr is expected
rather than suspicious, and that was verified separately rather than assumed.

### 16a. CORRECTION TO 16, AND A THIRD AT-RISK CATEGORY (15:54Z)

**I mis-described `a31c814` above and in two messages to EM.** I called it "the pre-amend commit
carrying the real NUL/0x1F bytes." Measured: `a31c814`'s blob for the test file is `a37f35d`,
19,917 bytes, **0 NUL bytes — byte-identical to the delivered `3006492`.** Its value was never
its content; it is the *commit object* that is unique. The blob claim was wrong.

**The actual binary variant was never in `/workspace` at all.** It is blob `0ee21e5`, 19,911
bytes, **1 NUL**, reachable only from commit `61ac644` in `/tmp/f4-901` — an overlay filesystem
(st_dev 1048678) that no sweep of `/workspace` (st_dev 2049) can reach. `61ac644` also carries
the `web/scripts/run-tests.mjs` hunk `EXPECTED_ASSERTIONS 380 → 417`, dropped during the rebase
and present in no other store.

Swept all 15 container-local repos under `/tmp`: 816 commits, 813 present host-backed, **3
absent** (`61ac644`, `aacbec0`, `d8de780`). Bundled to
`bundles/test-xss-r8-tmp-overlay-rescue.bundle` (2,275,462 bytes, st_dev 2049), restored into an
empty bare repo — 3 of 3 PRESENT, fabricated SHA ABSENT in the same loop, blob sizes and the
dropped hunk read through from the restored store.

**The third category.** These three are neither fsck-unreachable nor reflog-only. They are
ordinary `HEAD`/ref commits — the most reachable objects possible — at risk purely because of
*which filesystem they live on*. The at-risk taxonomy is therefore not fsck-vs-reflog; the
dominant variable is **namespace**, and reachability is a second-order effect within a namespace
you can already see. A sweep reports NOT-FOUND identically for "nothing to preserve" and "cannot
reach that filesystem."

**Method defect, mine.** `find /tmp -type d -name .git` missed three **bare** repos, which have
no `.git` directory. Caught by listing the retained apparatus paths explicitly and comparing.
Same class as the rest of the day: the tool answered a question adjacent to the one being asked.
Note what the blind spot was: the instrument that finds repositories could not see the
repositories created by the *verification* step, because a restore target is bare.

**The generalisation — control the POPULATION, not just the measurement.** Every control built
today guards a measurement: a negative arm, a two-outcome invocation, visible stderr. None of
them can see a wrong *population*, because a search over the wrong set returns a clean, correctly
measured answer about the wrong thing. The defence is the same shape applied one level up: derive
the population twice by different means and diff the two lists.

**Consequence for any mandated enumerator.** An enumerator with arms for every ref, detached
HEAD, `reflog --all` and private preserve namespaces still enumerates *inside one filesystem*.
All four arms are defeated by an ordinary `HEAD` commit on a different `st_dev`. The ordering has
to be: enumerate **filesystems** first (`stat -c '%d'` across every candidate root, with a known
host-backed and a known container-local path as the two-outcome control), then run the ref arms
per filesystem. Filesystem is the outer loop; reachability is the inner one.

**The two sweeps are disjoint by construction — do not read "intersection zero" as agreement.**
`git fsck -h` (2.54.0): `--[no-]reflogs   make reflogs head nodes (default)`. Reflogs are
reachability roots by default, so an object the reflog holds can never appear in
`fsck --unreachable`. Two legs independently reporting "intersection ZERO" are therefore
observing one structural fact twice, not corroborating each other. The complementarity of the
sweeps rests on the *at-risk* counts, not on the intersection.

Mechanism for why the yield concentrates on the reflog side: fsck-unreachable content in a leg
clone is overwhelmingly **inherited** — superseded fetched tips that came from canonical and are
therefore still in canonical, i.e. already durable. That is precisely my 308. Reflog content is
**locally authored** — amends, resets, rebase intermediates — and exists nowhere upstream by
definition. My own false clean zero is the same fact from the other side: `fsck` reported 0
container-only objects *because* the reflog held `a31c814`, and so it structurally could not see
the one object that mattered.

**Non-ref artefacts.** The mutation arms are invisible to all of the above: **no arm was ever
committed.** Each is a working-tree edit applied, run, reverted, tree back to zero tracked diff
lines. They survive only as
`apparatus/test-xss-r8/ARM-DEFINITIONS.md` + `mutate-tip.sh` + `mutate-union.sh` + the raw logs.
