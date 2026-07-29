# test-195 — round 2 review of `markdown-sanitize`

**Reviewer:** test-195 (test engineer)
**Reviewed at:** `5daace4` (confirmed by `git rev-parse --short HEAD`, tree clean before and after)
**Ranges:** `7a0f220..5daace4` (whole branch), `204af7e..5daace4` (round-2 cleanup)
**Round 1 verdict (mine, at `204af7e`):** APPROVE

---

## VERDICT: REQUEST CHANGES

Narrow basis. **The sanitizer hardening itself is sound and I re-verified it by
mutation — every one of the 8 `FORBID_TAGS` entries, 3 of the 5 `FORBID_ATTR`
entries, and all 4 behaviours of the checkbox renderer are load-bearing.** The
SVG coverage is real, not shape-only. G7 works. There is no partial revert.

The problem is G1. **The sink-binding guard does not bind the sinks.** I made
`ft-inspector-comments.ts` render attacker-controlled `c.body` completely raw —
the exact regression the guard's own header comment says it exists to catch —
and the suite printed `49 checks passed`, exit 0. I reproduced the same green
result six more ways. G1 currently provides confidence it has not earned, and a
guard that is trusted and wrong is worse at this gate than no guard.

The fix is roughly ten lines and does not touch production code. Everything else
below is a recommendation, not a gate.

**No live vulnerability exists on this branch.** Both real sinks are correctly
bound today (verified), and no production file contains a raw-HTML sink the
guard misses. This is a regression-detection gap, not an exploitable one. That
is why this is High and not Critical.

---

## Method

All mutations were applied to a working copy restored from **file copies in
`/tmp/mut-backup`, never `git checkout`** — deliberately, because reverting a
tracked file with `git checkout` is precisely the error under review. Every
mutation is followed by a restore that hard-fails if `git status --porcelain`
is non-empty. Harness at `/tmp/mut.sh`. The tree is clean at `5daace4` now.

Control run:

```
$ cd /workspace/web && npm test
markdown sanitizer: 49 checks passed
```

`49` matches `grep -c "  check(" src/util/markdown.test.ts` → `49`.

Findings are labelled **[EXEC]** (verified by execution, actual output pasted) or
**[REASONED]** (argued, not executed).

---

## Findings

### T1 — HIGH — G1 does not bind the named sinks; trivially defeated `[EXEC]`

`web/src/util/markdown.test.ts:553-577`

The guard asserts two *global* properties — "at least 2 `unsafeHTML` call sites
exist" and "no `unsafeHTML` call site has a non-`renderMarkdown` argument". It
never asserts that `ft-inspector-comments.ts` or `ft-inspector-desc.ts` are
among them. Neither filename appears anywhere in the test file. The brief
describes G1 as "a static source scan asserting `ft-inspector-comments.ts` and
`ft-inspector-desc.ts` still route through `renderMarkdown`" — it does not do
that.

**Mutation M-G1-10.** `ft-inspector-comments.ts` import aliased to
`unsafeHTML as rawHtml` and the sink changed to `${rawHtml(c.body)}` — a raw,
unsanitized, attacker-controlled comment body straight into the shadow root.
`ft-inspector-desc.ts` left correct, with its one sink duplicated so the count
floor of 2 is still met:

```
################ M-G1-10: NAMED sink comments.ts fully unbound, count still 2
markdown sanitizer: 49 checks passed
EXIT=0
```

**Mutation M-G1-3.** Both real sinks left untouched and correct; a new file
`src/components/ft-mutant-sink.ts` added with `import { unsafeHTML as rawHtml }`
and `rawHtml(this.body)`:

```
################ M-G1-3: NEW aliased raw sink, both real sinks intact
markdown sanitizer: 49 checks passed
EXIT=0
```

For contrast, the two cases the guard *does* catch:

```
################ M-G1-1: drop wrapper, no alias
Error: 1 of 49 markdown sanitizer checks failed:
  - every unsafeHTML sink routes through renderMarkdown: unsanitized unsafeHTML sink(s): src/components/inspector/ft-inspector-comments.ts -> unsafeHTML(c.body
EXIT=1

################ M-G1-2: alias import in comments.ts (count drops 2->1)
Error: 1 of 49 markdown sanitizer checks failed:
  - unsafeHTML call sites are still found: expected at least 2 unsafeHTML call sites, found 1
EXIT=1
```

Note that M-G1-2 is caught **by accident**: the floor is `>= 2` and the true
count is exactly 2, so removing one happens to cross it. Add a third legitimate
sink anywhere in the app and that accident stops working — M-G1-10 is M-G1-2
with the count restored, and it goes green.

**Recommendation.** Replace the global assertion with a per-file one. Roughly:

```ts
const REQUIRED_SINKS = [
  'src/components/inspector/ft-inspector-comments.ts',
  'src/components/inspector/ft-inspector-desc.ts',
];
for (const rel of REQUIRED_SINKS) {
  check(`${rel} routes its markdown through renderMarkdown`, () => {
    const src = readFileSync(join(root, rel), 'utf8');
    if (!/unsafeHTML\(\s*renderMarkdown\(/.test(src)) {
      throw new Error(`${rel} no longer contains unsafeHTML(renderMarkdown(`);
    }
    if (!/import \{ unsafeHTML \} from/.test(src)) {
      throw new Error(`${rel} aliases or re-exports its unsafeHTML import`);
    }
  });
}
```

Reading each required file by explicit path also removes the narrowing blindness
in T3: a file that stops matching now throws on `readFileSync` instead of
silently leaving the case list.

---

### T2 — HIGH — the banned raw-sink regex misses six real vectors, including the one it targets `[EXEC]`

`web/src/util/markdown.test.ts:582`

```ts
const banned = /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\(|document\.write\(/;
```

Each mutation below adds a single new production file containing only the stated
sink. All six pass:

| # | Sink added | Result |
|---|---|---|
| M-G1-4 | `el.innerHTML += body` | `49 checks passed`, EXIT=0 |
| M-G1-5 | `el["innerHTML"] = body` | `49 checks passed`, EXIT=0 |
| M-G1-6 | `unsafeSVG(body)` (`lit/directives/unsafe-svg.js`) | `49 checks passed`, EXIT=0 |
| M-G1-7 | `el.setHTMLUnsafe(body)` | `49 checks passed`, EXIT=0 |
| M-G1-8 | `unsafeStatic(body)` (`lit/static-html.js`) | `49 checks passed`, EXIT=0 |
| M-G1-9 | `range.createContextualFragment(body)` | `49 checks passed`, EXIT=0 |

M-G1-4 is the sharpest of these: `.innerHTML +=` is the *same sink the regex is
written to catch*, missed because `\.innerHTML\s*=` does not admit the `+`
before the `=`. M-G1-6 and M-G1-8 matter most in practice — this is a Lit
codebase, `unsafeSVG` and `unsafeStatic` are the two directives a developer
would most plausibly reach for next, and neither is covered by the `unsafeHTML`
regex or the banned regex.

**Recommendation.** Widen to
`/\.(inner|outer)HTML\s*[+]?=|\[['"](inner|outer)HTML['"]\]\s*[+]?=|insertAdjacentHTML\(|document\.write\(|setHTMLUnsafe\(|createContextualFragment\(|unsafeSVG\(|unsafeStatic\(/`
and add a comment stating the list is an allowlist-of-known-sinks that must be
revisited when a new raw-injection API is adopted. Also consider scanning
`.tsx`/`.js`, not just `.ts` (`markdown.test.ts:536`).

---

### T3 — MEDIUM — third instance of "tests that disappear instead of failing", two occurrences `[EXEC]`

`web/src/util/markdown.test.ts:556-559` and `:583-585`

This is the variant the brief asked me to treat as likely rather than
hypothetical, and it is here — twice, in the same function.

```ts
for (const m of src.matchAll(/unsafeHTML\(\s*([A-Za-z0-9_$.]*)/g)) {   // :556
  sinks.push({ file: relative(root, file), arg: m[1] ?? '' });
}
...
const unbound = sinks.filter((s) => s.arg !== 'renderMarkdown');        // :570
```

```ts
const offenders = files.filter((f) => banned.test(readFileSync(f, 'utf8')));  // :583-585
```

Both case lists are built by filtering the source tree **through the very
predicate under test**. Each protects against widening — a sink appearing with
the wrong argument — and is structurally blind to narrowing: a sink written in a
form the regex does not match does not fail the check, it vanishes from the case
list and the check passes on a shorter list. Every green result in T1 and T2 is
an instance of this one structural defect.

The mitigations present (`sinks.length < 2` at :563, `files.length < 10` at :547)
are floors, and the floors have the wrong headroom in both directions:

| Floor | Pinned | Actual | Slack |
|---|---|---|---|
| `files.length` | 10 | **50** | 40 files could vanish unnoticed |
| `sinks.length` | 2 | **2** | zero — catches M-G1-2 by luck, breaks the moment a third sink is added |

**Recommendation.** Pin both exactly rather than as floors — `files.length` to
the real count with a comment to update it deliberately, and `sinks.length` to
exactly `REQUIRED_SINKS.length` once T1's per-file check exists. An exact pin
converts narrowing from invisible into a hard failure, which is the whole point
of G7 applied one level down.

---

### T4 — MEDIUM — G7 does not reach inside a check; a payload can be deleted invisibly `[EXEC]`

`web/src/util/markdown.test.ts:372-382`

`check('svg style stripped inside markdown containers')` loops over three
payloads (list, blockquote, table) inside a **single** `check()`. `EXPECTED_CHECKS`
counts `check()` invocations, so deleting a payload from the array is invisible.

**Mutation D-1**, deleting the table payload:

```
################ D-1: delete the table payload from the 3-case loop
markdown sanitizer: 49 checks passed
EXIT=0
```

This is the same defect class G7 was created to close, one level below the
granularity at which G7 operates. It is the only multi-payload loop in the suite,
so the exposure is three payloads wide.

**Recommendation.** Either hoist the three payloads into three `check()` calls
(cheapest, and `EXPECTED_CHECKS` becomes 51), or assert the array length inside
the check before looping.

---

### T5 — LOW — self-built-oracle candidate #15: a hand-rolled regex standing in for the module graph `[REASONED]`

`web/src/util/markdown.test.ts:556`

I hunted the fifteenth self-built oracle in the classic form — a local
re-implementation of the symbol under test — and **found none**. Every
behavioural check routes through the real `renderMarkdown` imported at
`markdown.test.ts:29`; the assertion helpers (`assertNoElement`,
`assertNoEventHandlers`, …) are generic DOM property scanners over jsdom, not
re-implementations of sanitizer logic. On the classic definition, the branch is
clean.

But I want to flag the sink scan as the same defect class wearing different
clothes. `/unsafeHTML\(\s*([A-Za-z0-9_$.]*)/` is a hand-rolled stand-in for the
TypeScript module graph — a local approximation of "what does this code actually
call", asserted against instead of the real resolution. It has the exact failure
signature of a self-built oracle: it **disagrees with the real semantics** (on
aliasing, re-export and indirection) and the test believes the oracle rather than
the language. T1 and T2 are that disagreement, executed.

I am not calling this a confirmed fifteenth oracle — the source-scan approach is
defensible for the reasons the dev gives at `markdown.test.ts:503-512`, and I
agree a component harness is Phase 2's job. I am recording it as the same
pattern in a new location so the next reviewer on this workstream recognises it.

**Recommendation.** Keep the scan, but add a comment at `:556` naming this
limitation explicitly — the regex approximates the module graph and cannot see
aliasing — so the guard's strength is not overestimated again. T1's per-file
import assertion closes the specific aliasing gap.

---

### T6 — LOW — `formaction` and `action` in `FORBID_ATTR` are not load-bearing, and their check passes for the wrong reason `[EXEC]`

`web/src/util/markdown.ts:40`; `web/src/util/markdown.test.ts:124-128`

Removing each `FORBID_ATTR` entry one at a time:

```
REMOVE ATTR style      exit=1 failing=1   - style attribute stripped: inline style survived
REMOVE ATTR class      exit=1 failing=2   - class attribute stripped (no CSS-reuse forgery) / code blocks render
REMOVE ATTR formaction exit=0 failing=0
REMOVE ATTR action     exit=0 failing=0
REMOVE ATTR download   exit=1 failing=1   - download attribute stripped: download attribute survived
```

`formaction` and `action` can be deleted from the config with the suite fully
green. The reason is benign and deliberate — `markdown.ts:9-10` states "Both the
tag and the attribute are forbidden so that neither rule is load-bearing on its
own", and the host tags `<button>`/`<form>` are stripped first, taking the
attribute with them. I am not asking for the config to change; defence in depth
is correct here.

The finding is that `check('formaction stripped')` does not test what its name
says. It asserts the *tag* rule, which
`check('submit button stripped')` already covers. Since `formaction` is only
valid on `<button>`/`<input>` and `action` only on `<form>` — all forbidden —
these two attribute rules are **not testable in isolation at all** through
`renderMarkdown`.

**Recommendation.** Do not delete the config entries. Rename the check to
something honest (`formaction cannot survive because its host tag is stripped`)
and add one line noting the attribute half is deliberately untestable
defence-in-depth. Otherwise a future reader will assume coverage that does not
exist — which is the failure mode this whole workstream is about.

---

### T7 — INFO — `EXPECTED_CHECKS` pins the count, not the content `[EXEC]`

`web/src/util/markdown.test.ts:598`

**Mutation D-2**, gutting the body of `check('dialog stripped (no fake modal)')`
to `void out;` while leaving the `check()` call registered:

```
################ D-2: gut the dialog check body, keep check() registered
markdown sanitizer: 49 checks passed
EXIT=0
```

This is inherent to a count pin and I am not asking for it to be fixed — a
content pin is what mutation testing is for, and this workstream is doing that
manually. Recording it so the pin's guarantee is not overstated: G7 proves no
check was *deleted*, not that every check still *asserts* anything.

---

### T8 — INFO — scan is `.ts`-only and `src/`-only `[EXEC]`

`web/src/util/markdown.test.ts:536`

`collectSourceFiles` accepts only `entry.endsWith('.ts')`. There are 54 non-`.ts`
files under `src/` today (all `.css`/`.json`, none a sink — verified), and
`index.html` at the web root is outside the scanned tree entirely. No current
exposure; noted alongside T2's recommendation to widen the extension filter.

---

## What I verified as GOOD

All by execution.

**Every `FORBID_TAGS` entry is load-bearing.** Removed one at a time:

```
REMOVE TAG form      exit=1  - form tag stripped: credential-phishing form survived
REMOVE TAG input     exit=1  - password input stripped: password field survived
REMOVE TAG button    exit=1  - submit button stripped: submit button survived
REMOVE TAG select    exit=1  - select and option stripped: select survived
REMOVE TAG textarea  exit=1  - textarea stripped: textarea survived
REMOVE TAG option    exit=1  - select and option stripped: option survived
REMOVE TAG dialog    exit=1  - dialog stripped (no fake modal): dialog survived
REMOVE TAG style     exit=3 failing  - svg style element stripped / svg style cannot reach an
                                       attacker origin / svg style stripped inside markdown containers
```

**G2 / SVG coverage is real, not shape-only.** Two independent confirmations:

1. `marked` passes every SVG payload through **verbatim** — I probed its raw
   output directly. `<svg><style>:host{position:fixed}</style></svg>` arrives at
   DOMPurify as `<p><svg><style>:host{position:fixed}</style></svg></p>`, not
   escaped. The payloads genuinely reach the sanitizer, including inside list,
   blockquote and table containers.
2. Removing `'style'` from `FORBID_TAGS` fails all three SVG-style checks
   (above), including all three container variants.

The other seven SVG checks (foreignObject, svg script, svg handlers,
animate/set, xlink:href, use, image) pin **DOMPurify defaults**, not this
branch's config — I confirmed each payload survives `marked` intact and is
neutralised by `DOMPurify.sanitize()` with no config at all. That is legitimate
and valuable as a dependency-upgrade regression pin, but the EM should know the
split: with `FORBID_TAGS` and `FORBID_ATTR` both emptied, **14 of 49** checks
fail. 35 checks pin `marked`/DOMPurify default behaviour; 14 pin this branch's
decisions.

**The checkbox renderer (M2/L2) is fully covered.** All four mutations caught:

```
C-1 drop U+FE0E                     exit=1, 3 checks fail
C-2 change the "Completed" label    exit=1
C-3 drop role="img"                 exit=1
C-4 remove the custom renderer      exit=1, 3 checks fail
```

**G7 fires.** Verified independently of the EM's run, by deleting
`check('textarea stripped')` outright:

```
G7 SELF-CHECK: deleted one check; check() sites now 48
  - check total pinned: expected 49 checks to run, 48 did — a check was added or silently removed
EXIT=1
```

**No live raw-HTML sink escapes the guard today.** A grep for all six vectors
from T2 across `src/` returns nothing in production code, and the only two
`unsafeHTML` call sites are the two named ones, both correctly wrapped:

```
src/components/inspector/ft-inspector-desc.ts:233:        ${unsafeHTML(renderMarkdown(this.description))}
src/components/inspector/ft-inspector-comments.ts:221:                        ${unsafeHTML(renderMarkdown(c.body))}
```

---

## The two disclosures

### 1. The `git checkout` process error — final state is CORRECT `[EXEC]`

I did not take the recovery on trust. Three independent lines of evidence:

**(a) The branch history contains no removal of a check.** Across all three
commits touching the sanitizer files, `git log -p 7a0f220..5daace4 -- web/src/util/markdown.test.ts | grep -E "^-\s*check\("`
returns **empty**. The test file is pure-insertion at every commit
(`327 +`, `295 + / 11 -`, `15 +`).

**(b) Every one of the eleven deleted lines is accounted for as a deliberate
upgrade, not a revert.** Full list from `f202448`:

```
-      '<pre><code class="language-js">const a = 1;\n</code></pre>\n',
-//    unchecked states stay distinguishable and that no input comes back.
-    assertContains(out, '☐', 'unchecked state lost');
-    assertContains(out, '☑', 'checked state lost');
-    assertContains(out, '☑</span> outer', 'outer state lost');
-    assertContains(out, '☐</span> inner', 'inner state lost');
-const FORBID_TAGS = ['form', 'input', 'button', 'select', 'textarea', 'option'];
-const FORBID_ATTR = ['style', 'formaction', 'action', 'download'];
-// allowing any form control past the sanitizer. A private Marked instance keeps
-// this off the shared `marked` singleton.
-      `<span class="ft-task-checkbox">${checked ? '☑' : '☐'}</span>`,
```

Each has a strictly stronger replacement: the code-block expectation loses
`class="language-js"` *because* `class` joined `FORBID_ATTR`; the four checkbox
assertions gain `︎`; both config lines are replaced by expanded ones; the
old renderer used a `class` attribute that the same commit forbids. These are
mutually consistent — a partial revert would have left one of these halves
mismatched, and none is.

**(c) The strongest evidence: I mutation-tested every element a partial revert
could have dropped, and all of them fire.** 8/8 `FORBID_TAGS`, 3/5 `FORBID_ATTR`
(the other 2 by design, T6), 4/4 checkbox behaviours, 3/3 SVG-style checks, and
the G7 pin itself. A reverted test passes silently — but a reverted test also
cannot fail under mutation, and every one of these did.

`grep -c "  check("` returns **49**, matching `EXPECTED_CHECKS = 49` and the
runtime count. **No partial revert. The final state is correct.**

For the record, the harness I used avoids the error entirely: restore is `cp`
from a backup outside the repo, followed by a `git status --porcelain` assertion
that aborts the run if the tree is not clean. I would recommend that pattern to
the dev for future mutation rounds — `git checkout` is unsafe for this by
construction, because it cannot distinguish your mutation from your fix.

### 2. U+FE0E written as `︎` — runtime-identical, CONFIRMED `[EXEC]`

```
escape form codepoints:  [ '3e', '2611', 'fe0e', '3c', '2f', '73', '70', '61', '6e', '3e' ]
literal form codepoints: [ '3e', '2611', 'fe0e', '3c', '2f', '73', '70', '61', '6e', '3e' ]
IDENTICAL: true
```

And the real `renderMarkdown` output:

```
"<ul>\n<li><span role=\"img\" aria-label=\"Not completed\">☐︎</span> todo</li>\n
  <li><span role=\"img\" aria-label=\"Completed\">☑︎</span> done</li>\n</ul>\n"
codepoints of glyph runs: [ '2610', 'fe0e', '2611', 'fe0e' ]
```

Both glyphs carry the variation selector. The dev's reasoning is also correct on
the merits — C-1 shows the suite catches the selector's removal, but only
because the test asserts the escape too; a literal in both files would be
invisible to a reviewer reflowing either line. Upholding this was right.

---

## Out-of-scope items — I did not re-litigate, with one note

- **Phase 2, `go vet`/#199, sourcemaps/#196** — not examined, per the brief.
- **`optgroup`** — I probed for a primitive rather than assume, and **found
  none**, which supports the EM's ruling. `<optgroup label="evil"></optgroup>`
  survives with its label, but `label` is rendered only by the `<select>` widget;
  outside a `select` there is no visible text and no interaction. With `option`
  forbidden, `<optgroup label="x"><option>y</option></optgroup>` renders as
  `<optgroup label="x">y</optgroup>` — inert. **No change to the ruling.**

---

## Summary

| ID | Sev | Location | Finding |
|---|---|---|---|
| T1 | **High** | `markdown.test.ts:553-577` | G1 does not bind the named sinks; defeated by aliasing or any new file |
| T2 | **High** | `markdown.test.ts:582` | Banned-sink regex misses 6 vectors, incl. `.innerHTML +=` and Lit's `unsafeSVG`/`unsafeStatic` |
| T3 | Medium | `markdown.test.ts:556,583` | Third instance of "tests that disappear": 2 case lists filtered through the predicate under test |
| T4 | Medium | `markdown.test.ts:372-382` | 3-payload loop inside one `check()` is invisible to G7 |
| T5 | Low | `markdown.test.ts:556` | Self-built-oracle pattern: regex as stand-in for the module graph |
| T6 | Low | `markdown.ts:40`, `test:124` | `formaction`/`action` not load-bearing; check passes for the wrong reason |
| T7 | Info | `markdown.test.ts:598` | G7 pins count, not content |
| T8 | Info | `markdown.test.ts:536` | Scan is `.ts`-only, `src/`-only |

**Required before merge:** T1 and T2. Both are test-file-only, roughly ten and
one lines respectively, and neither touches production code. T3 largely resolves
itself once T1 reads required sinks by explicit path.

**Recommended but not gating:** T4, T5, T6.

I will re-review on request and expect to approve quickly — the security content
of this branch is verified sound and I have no concerns about the sanitizer
itself.
