# Security Audit — #195 markdown-sanitize, round 6

**Target:** `86f30bcdc699367681ccffbc4fde1e40006fd754` (branch `markdown-sanitize`),
verified with `git rev-parse HEAD` in `/workspace`. Tree clean before and after.
**Leg:** security audit (one of three parallel, independent legs).
**Scratch:** `/scion-volumes/scratchpad/projects/farmtable/salvage/r6-audit-195/`
**Date:** 2026-07-28

---

## VERDICT: APPROVE

No Critical, High or Medium findings. **No live XSS exists at this head** and the
round-6 production diff is correct on all four items — each verified by
execution, not by reading. Two Low findings and three Info items follow; none
blocks merge.

The round's headline claims all reproduce:

| gate | result |
|---|---|
| `npm test` | exit **0** — "markdown sanitizer: 69 checks passed" |
| `npx tsc --noEmit` | exit **0** |

Exit codes read from the child process directly, never through a pipe.

### Severity table

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 2 |
| Info | 3 |

---

## Positive control (charge 1 precondition)

Round 4's audit reported clean DENIEDs from a probe that could not have observed
an ALLOW. Before reporting anything as blocked I built `probe.mjs` with two
independent detectors — **ARTIF** (parse the output, walk it, look for the
dangerous artifact) and **EXEC** (inject into a JSDOM with
`runScripts:'dangerously'`, re-activate inert `<script>` nodes, drive `on*`
handlers and `javascript:` URLs, and watch a canary on the window) — and ran it
against a module with the sanitizer **removed entirely**
(`mod-nosanitize.mjs`).

```
PROBE-COMPLETE module=./mod-nosanitize.mjs vectors=78 allowed=70 denied=8 threw=0
28 vectors fired the EXEC canary with a real alert(1)
```

The probe can observe an ALLOW, both structurally and by actual script
execution. Only then did I run it against head:

```
PROBE-COMPLETE module=./mod-head.mjs   vectors=78 allowed=26 denied=52 threw=0
EXEC canary firings at head: 0
```

A third module (`mod-noforbid.mjs`, production pipeline with the forbid lists
deleted) separates "DOMPurify's defaults blocked it" from "this repo's config
blocked it": `allowed=40`. So the repo's own configuration is load-bearing for
14 vectors that DOMPurify's defaults would let through.

The 26 "allowed" at head are **not** survivals. I inspected every one: 21 are
empty inert shells (`<p><svg></svg></p>`, `<math><mtext></mtext></math>`,
`<template></template>`) that my ARTIF tag-list over-fires on, and 5 are the
known `data:`-on-`img` and protocol-relative cases discussed under Non-findings.
No payload, no handler, no scheme, no execution.

**Harness defect found and fixed mid-run, disclosed:** my ARTIF walker used
`el.children`, which does not expose `<template>.content`. It therefore could
not see anything DOMPurify left inside a template — a false negative of exactly
the shape this round exists to catch. Fixed, and the fix validated against the
positive control: `T3 template with img onerror` went from reporting only
`tag:template` to reporting `event:onerror` on the unsanitized module. At head
T3 reports only `tag:template`, so DOMPurify does correctly clean template
content. The negative is now trustworthy.

---

## Charge 1 — the production diff

### `slot` in `FORBID_ATTR` — correct, load-bearing, and complete. BY EXECUTION

The developer's log claims "Measured: slot survives DOMPurify's defaults, so the
rule is load-bearing." Confirmed independently. Re-running the inherited round-5
corpus at head, vector `G15 slot attr shadow` moved from `SURVIVES` (round 5) to
`BLOCKED-BY-CONFIG`. I extended it with eight `slot` variants to test whether
the rule has holes:

| vector | result |
|---|---|
| `<p slot="x">` | DENIED |
| `<p SLOT="footer">` (case) | DENIED |
| `<span slot="summary">` nested in `<div>` | DENIED |
| `<p slot="&#115;ummary">` (entity-encoded value) | DENIED |
| `<slot name="x">` (the element) | DENIED |
| `<slot onslotchange=alert(1)>` | DENIED |
| `<p slot="x">` inside `<template>` | attribute stripped, shell remains |
| `<text slot="x">` in SVG namespace | attribute stripped, shell remains |

No hole. `FORBID_ATTR` is namespace- and case-insensitive here and applies
inside template content. I also probed the shadow-DOM interaction the brief
asked about: declarative shadow DOM (`<template shadowrootmode="open">` and the
legacy `shadowroot` attribute) has the mode attribute stripped, leaving an inert
`<template>`, so `slot` cannot be paired with an attacker-created shadow root.

The docblock's reasoning is honest: the "not exploitable today" claim rests on
the markdown landing two levels below the shadow host, which I confirmed at both
sinks. Forbidding it anyway converts a nesting-dependent property into an
unconditional one. Good change.

### Non-string guard — airtight, and it blanks nothing. BY EXECUTION

`typeof md !== 'string'` is not coercible, and I confirmed nothing sneaks a
payload through coercion. All 16 non-string shapes return `''`:

```
EMPTY  boxed String(payload)      -> ""
EMPTY  obj toString->payload      -> ""
EMPTY  obj valueOf->payload       -> ""
EMPTY  Symbol.toPrimitive         -> ""
EMPTY  template-tag strings obj   -> ""
EMPTY  String.prototype proxy     -> ""
EMPTY  null-proto obj             -> ""
LIVE!! real string (control)      -> "<img src=\"x\">"   <- control still renders+sanitizes
```

The guard returns before any coercion, so `toString`/`valueOf`/
`Symbol.toPrimitive` are never invoked. No XSS, and no availability regression
for real strings.

**The brief's specific question — did this silently blank live content rather
than sanitize it?** No. I reconstructed the pre-round-6 function and ran the
same inputs through it: **every** non-string threw
(`marked(): input parameter is of type [object String], string expected`), for
boxed strings and `toString` objects too. There is no input that previously
rendered and now blanks. The change strictly converts a throw into `''`.

That throw was reachable: `ft-inspector-desc.ts:80` declares
`description?: string`, so `undefined` reaches the sink whenever a task has no
description, and pre-change that threw inside a Lit `render()`. T7 was a real
availability bug and this is the right fix.

### The "URI-policy pin" — is a test, not production; and it holds

Worth stating precisely because the shared brief lists it among four
*production* items: three of the four are production changes; the URI-policy pin
is a check in `markdown.test.ts:244-260`, not a change to `markdown.ts`. That is
not a defect — it just means the production diff is three items, not four.

The pin claims to catch "the URI POLICY itself, not one scheme." I tested that
claim by mutation rather than accepting it (table below): it catches
`ALLOW_UNKNOWN_PROTOCOLS`, `ALLOWED_URI_REGEXP` widening, `ADD_URI_SAFE_ATTR`
and `ADD_DATA_URI_TAGS`. The claim holds.

Obfuscation variants at head, all DENIED: tab/newline/NUL inside `java\tscript:`,
`&#106;`/`&#x6a;`/semicolon-less entity encoding, leading whitespace, uppercase
`JAVASCRIPT:`, `vbscript:`, `blob:`, `filesystem:`, `data:text/html` on `<a>`.

---

## Charge 2 — the dependency pin

**A caret range floors, it does not pin.** `^3.4.12` admits `>=3.4.12 <4.0.0`.
Today that range resolves uniquely, because 3.4.12 is also the newest published
3.x — but that is an accident of timing, not a control. The real control is
`web/package-lock.json` (committed, `lockfileVersion: 3`, with a
`sha512-…` integrity hash for dompurify 3.4.12).

**What enforces the lockfile?** `Makefile:17` runs `cd web && npm ci && npm run
build`, and `npm ci` does honour the lockfile strictly. But there is **no CI** —
no `.github/workflows` exists — so nothing verifies that a build actually went
through `make web`. `npm install && npm run build` in `web/` would silently
accept a future 3.4.13 or 3.5.0 and rewrite the lockfile. That is the honest
statement of the control's strength: correct on the documented path, unenforced
off it.

**Is the floor above every known bypass?** Yes, and I gave the negative a control
that fails closed rather than asserting it. Installing each version in an
isolated tree and running `npm audit`:

| dompurify | npm audit |
|---|---|
| 3.0.0 (the *old* caret floor) | **1 high** |
| 3.1.2 | 1 high |
| 3.2.3 | 1 moderate |
| 3.4.11 | 1 low — GHSA-c2j3-45gr-mqc4, `CUSTOM_ELEMENT_HANDLING` bypasses `afterSanitizeElements`, range `<=3.4.11` |
| **3.4.12 (current)** | **clean** |

The detector demonstrably fires, so "clean at 3.4.12" is a real result. The floor
sits exactly one version above the last advisory. `npm audit` on the real tree
reports 0 vulnerabilities at every severity. The old `^3.0.0` range genuinely did
admit a high-severity version — tightening it was a real fix, not cosmetics.

**Shared-singleton hazard.** `markdown.ts:2` is the *only* import of `dompurify`
anywhere in the repository, nothing calls `setConfig`/`addHook`, and no other
package in the tree depends on dompurify. So the hazard is not live. I measured
what it would cost if it became live by injecting a module-scope
`DOMPurify.setConfig({ ADD_TAGS:['script'], ADD_ATTR:['onerror'] })`: **20 of 69
checks went red**, confirming that a sticky `setConfig` does leak into and
override the per-call `sanitize(dirty, cfg)` configuration. The existing R8 check
("the sanitizer exclusively owns its own dependencies") is the right place for
this and already constrains it.

---

## Charge 3 — what a guard bypass actually costs an attacker

The brief asked for this on the record once, plainly. Here it is.

`BANNED_SINKS`, `sinkArgumentIsSanitized` and `stripImportStatements` are
**build-time lint that runs inside a test file**. They are not in the request
path. The runtime defence is exactly one thing: `DOMPurify.sanitize` inside
`renderMarkdown`.

- **An attacker without commit access** — the actual threat model, someone
  filing a GitHub issue whose body is mirrored into a task description — pays
  **nothing**. The guard never executes on their path. Whether `BANNED_SINKS`
  has eight patterns or zero is invisible to them. Every guard finding in this
  workstream is therefore, for this attacker, worth zero.
- **An attacker with commit access** pays **approximately nothing**, because they
  can edit `markdown.test.ts` in the same commit. The guard's own amended
  criterion (lines 727-739) concedes precisely this and is right to.

So the guard defends against **accident**: a future developer refactoring a sink,
renaming an import, or adding a convenience parameter without realising what it
opens. That is a real and worthwhile job — T1 was exactly that shape, an
innocent-looking `{inline:true}` that reopens the bug class — but it means:

> **Every finding about the guard in this workstream is a regression-detection
> finding, not a vulnerability finding, and should be severity-capped at Low
> unless it corresponds to a live weakening of `renderMarkdown` itself.**

I have applied that cap to my own findings below.

One consequence deserves stating: **because there is no CI, even the
accident-defence only fires if someone runs `npm test` locally.** The guard is
53 KB of carefully-reasoned machinery whose trigger is voluntary. Promoting
`npm test` into CI would do more for this workstream's actual security posture
than any further hardening of the guard's regexes.

I verified the guard does the accident-detection job it claims, with a
**no-op control that must come out GREEN** (see Disclosures — my first run of
this battery was void without it):

| mutation | suite | caught by |
|---|---|---|
| CONTROL: add a comment (no-op) | **GREEN** | — (runner is live and discriminating) |
| `renderMarkdown(md, opts?)` | RED | `renderMarkdown accepts exactly one parameter` |
| `renderMarkdown(md, opts = {})` | RED | same (defaulted param — `Function.length` blind spot covered) |
| `renderMarkdown(md, ...rest)` | RED | same |
| drop the wrapper: `unsafeHTML(this.description)` | RED | sink-binding + call-site arg check |
| `unsafeHTML(renderMarkdown(d) + d)` | RED | sink-binding + call-site arg check |
| `const rawHtml = unsafeHTML` value alias | RED | sink-binding + tripwire |
| sanitizer returns its input unsanitized | RED | 38 behavioural payload checks |

T1's arity fix is genuinely pinned from three sides, including the two variants
(`= {}` and `...rest`) that defeat a naive `Function.length` check. Notably every
catch above is **behavioural or structural, not a source-text pin of the sanitize
call** — so these are not brittle in the way a literal-shape pin would be.

---

## Charge 4 — independent sink inventory

I did not accept `REQUIRED_SINKS`. Repository-wide sweep for `unsafeHTML`,
`unsafeSVG`, `unsafeStatic`, `.innerHTML`, `.outerHTML`, `insertAdjacentHTML`,
`document.write`, `createContextualFragment`, `srcdoc`,
`dangerouslySetInnerHTML`, `new Function` and `eval(`, excluding
`node_modules`, `dist`, `.tmp-test` and the guard's own prose:

```
web/src/components/inspector/ft-inspector-desc.ts:233      ${unsafeHTML(renderMarkdown(this.description))}
web/src/components/inspector/ft-inspector-comments.ts:221  ${unsafeHTML(renderMarkdown(c.body))}
```

**Exactly two, both wrapped.** The guard's `REQUIRED_SINKS` list names exactly
these two files. The inventory matches what I found.

I also checked the server side, which no previous round appears to have swept:
the Go tree contains **no** `html/template`, **no** `text/template`, and no
handler emitting `text/html`. There is no server-rendered HTML, so there is no
second XSS boundary. The dashboard is static assets plus gRPC.

The one gap is in *coverage*, not in the list — see Low-2.

---

## Charge 5 — prototype pollution scan

Re-ran the inherited `audit-195-r5-protoscan.mjs` from my own directory
(sha256 `8be8991fe94210fbf84b96e297b3f9ddc87a81b3052fa10a4b52825c78bb2278`,
recorded before use) against head.

- Scanner self-check passes: it finds all 4 planted decoy hits, so it is live.
- **No drift** from the round-5 recorded output (byte-identical after timestamp
  normalisation).
- 34 hits across exactly 2 packages: `nwsapi` (24) and `jsdom` (10).

**Is the disclosed survivor still true at this head?** Yes. I verified the
dependency-tree property directly rather than by inspection: the production
closure is 23 packages and neither `jsdom` nor `nwsapi` is in it.

```
prod closure size: 23
  jsdom in prod closure?  false
  nwsapi in prod closure? false
```

**Cheapest tripwire** (as asked, not re-filed): no CI and no subprocess needed.
`web/package-lock.json` is v3 and already carries `"dev": true` on 127 entries.
A ~20-line check in the existing suite can read the lockfile, compute the
non-dev package set, run the existing prototype-patch regex over just those
packages, and fail if any hit. That converts "true today, enforced by nothing"
into "enforced by `npm test`" at essentially zero cost and with no network
access. It is strictly better than promoting the current scan into CI, because
CI does not exist yet.

---

## Findings

### [LOW-1] `SANITIZE_DOM: false` weakens the sanitizer and the suite stays green

- **Location:** `web/src/util/markdown.ts:94-97` (the config object); gap is in
  `web/src/util/markdown.test.ts`
- **Mark:** **BY EXECUTION**
- **Description:** Of 13 configuration weakenings I mutated into the sanitizer,
  12 turn the suite red. One does not: adding `SANITIZE_DOM: false` to the
  `DOMPurify.sanitize` options leaves all 69 checks passing.
- **This meets the round-5 bar** — I verified it actually weakens the thing
  before filing, rather than filing it for being green. `SANITIZE_DOM` is
  DOMPurify's DOM-clobbering defence. Differential probe, 8 of 10 vectors differ:

  ```
  DIFFERS clobber getElementById
      SANITIZE_DOM on : "<p><a>x</a></p>"
      SANITIZE_DOM off: "<p><a id=\"getElementById\">x</a></p>"
  DIFFERS clobber attributes / name=body / id=body / currentScript
        / name=nodeName / id=children / id=location
  same    plain id (control)   <- both keep id="section-1", so the probe is not
                                  simply reporting "id survives"
  ```
- **Impact:** Low. Attacker-controlled `id`/`name` values that shadow DOM
  properties would survive. Live exploitability is currently blocked by the same
  property the developer invoked for `slot`: the markdown renders inside a Lit
  shadow root, and named-property access on `window`/`document` reaches only the
  main document tree. So this is defence-in-depth that is currently redundant —
  **exactly** the situation the `slot` docblock describes as worth pinning
  anyway, "converting a nesting-dependent property into an unconditional one at
  zero cost."
- **Recommendation:** apply the project's own stated standard. Add one check
  beside the URI-policy pin:

  ```ts
  // Pins DOMPurify's DOM-clobbering defence. SANITIZE_DOM:false is a one-word
  // change that no payload check above notices: it leaves every scheme, tag and
  // handler rule intact while letting attacker-chosen id/name values that shadow
  // DOM properties through. Not exploitable while the markdown renders two
  // levels inside a shadow root, which is a property of the template's nesting,
  // not of this sanitizer. Same argument as slot.
  check('DOM-clobbering attributes are stripped', () => {
    assertNotContains(
      renderMarkdown('<a id="getElementById" name="nodeName">x</a>'),
      'getElementById',
      'clobbering id survived — has SANITIZE_DOM been disabled?',
    );
  });
  ```

### [LOW-2] The guard's scan root excludes production files, and `.html` is treated as inert

- **Location:** `web/src/util/markdown.test.ts:1737` (`collectSourceFiles(join(root, 'src'), files)`)
  and `:874-877` (`INERT_EXTENSIONS`)
- **Mark:** **BY EXECUTION** (scan root and extension list read and confirmed;
  `web/index.html` confirmed to ship and to contain an inline script)
- **Description:** Two boundaries, both hand-chosen, neither pinned:
  1. The tree-wide scan walks `web/src` only. `web/index.html` is a production
     artifact — it is the application's entry document, it ships, and it
     contains an inline `<script>` block (currently a benign theme toggle) — and
     it is outside the scanned set entirely.
  2. `.html` is listed in `INERT_EXTENSIONS`. HTML is not inert; it is the one
     extension that can *contain* a script. If the scan root were ever widened,
     this entry would silently exclude the file again.
- **Impact:** Low, not currently exploitable — the inline script is static and
  touches no user input. But the guard's central claim is inventory
  completeness, and this is a hole in it: a sink added to `index.html` is
  invisible to every tree-wide rule at once. This is the same failure shape as
  T2 (unterminated `<!--` blanking a file to EOF), which this round fixed.
- **Recommendation:** cheapest correct fix is to stop calling HTML inert and
  assert the boundary explicitly:

  ```ts
  // .html is NOT inert: it is the only extension that can contain a <script>.
  // index.html ships. Scan it for the same banned sinks as any source file.
  const INERT_EXTENSIONS = ['.css', '.scss', '.json', '.svg', '.md', '.txt', ...];
  collectSourceFiles(join(root, 'src'), files);
  files.push(join(root, 'index.html'));
  ```

  Pin the count as the suite already does for `src/`, so that adding a second
  top-level HTML file turns it red.

### [INFO-1] The caret range is not the control; the lockfile is, and nothing off the `make web` path enforces it

Detail under Charge 2. `^3.4.12` is a correct and materially valuable floor —
it excludes a genuinely high-severity 3.0.0 — but it does not pin. Recommend
(a) documenting `npm ci`, never `npm install`, as the only supported build path,
and (b) when CI arrives, running `npm ci` plus `npm audit --audit-level=moderate`
plus `npm test` there. No change requested this round.

### [INFO-2] DOMPurify's default export is a shared singleton

Not live: `markdown.ts:2` is the only importer in the repository and nothing
calls `setConfig`/`addHook`. Measured cost if it became live: 20 of 69 checks
red, i.e. a sticky `setConfig` does override the per-call config. R8 already
constrains this. Recorded so the next round does not have to re-derive it.

### [INFO-3] V25 / protoscan holds at head; a cheap offline tripwire exists

Detail under Charge 5. No drift, property still true, tripwire specified. Not
re-filed as a finding per the brief.

---

## Non-findings — verified and deliberately declined

Holding the round-5 `ADD_ATTR:['style']` bar: green is not a finding unless the
mutation demonstrably weakens something.

- **`(globalThis as any).__p = DOMPurify.sanitize` at module scope survives
  green.** Declined. It is a no-op assignment that weakens nothing, and the
  guard's amended criterion (lines 733-739) explicitly scopes runtime-effect
  changes out and routes them to the tripwire. The guard is honest about this;
  filing it would be restating a disclosed limitation at its known severity.
- **`data:` URIs survive on `img src`** (`![x](data:text/html,…)`,
  `data:image/svg+xml` with an `onload` inside the URI, and its base64 form).
  Declined as XSS: SVG loaded through `<img>` is a script-disabled context and
  `data:text/html` in `img src` does not parse as HTML. Zero EXEC canary
  firings. This is DOMPurify's documented default `DATA_URI_TAGS` behaviour and
  belongs to the M1 allow-list discussion.
- **Protocol-relative `//evil.example` survives in `href` and `img src`.**
  External resource load / beacon, i.e. the tracking-pixel axis already recorded
  under M1 and G11/G12. Not restated at its known severity.
- **`id`, `name`, `target`, `rel`, `width`, `background`, `align`, `hidden`,
  `popover`, `srcset`, `loading`, `is`, `draggable` survive.** M1, out of scope,
  agreed and tracked. I re-measured them only to confirm no *change* since round
  5; there is none.
- I do **not** believe any out-of-scope item (M1, CSP/Trusted Types, #204, V25)
  is materially worse than recorded.

---

## Methodology, disclosures and limitations

### Costly disclosure: my first guard-mutation battery was void

`guardmut.sh` v1 invoked `( npm test )` without changing into `web/`. Every one
of its eight mutations reported "RED (caught)" — and every one of those was
`npm error code ENOENT: Could not read package.json`, not the suite. I had a
clean, complete, entirely fictitious table of eight caught mutations, and it
agreed with what I expected to find, which is precisely why it was dangerous.

I caught it only because I went to quote the *reason* each mutation was caught
and found the logs empty. The fix was not just the `cd` — it was adding a
**no-op control mutation that must come out GREEN**. With that control in place
the runner proves it can distinguish, and the corrected table (Charge 3) is
trustworthy. The config battery (`mutate.sh`) was never affected: it used
`( cd /workspace/web && npm test )` from the start, and its mixed RED/GREEN
output was itself evidence it was really running.

This is the round's own standing bar #1 turned on the auditor: a check that
cannot fail cannot confirm. I report it because a reader who trusted my first
table would have concluded the guard was stronger than I have shown it to be.

### Second disclosure: an ARTIF blind spot, found and fixed mid-run

`<template>.content` is not reachable through `el.children`. Described under
Positive control, with the validation that the fix increased sensitivity on the
control module. Any DENIED I reported for a template-bearing vector *before*
that fix would have been unfounded; all template results in this report are
post-fix.

### Independence

I read only the two briefs named in my instructions, the repository at head, and
my own scratch directory. I did **not** read the other two legs' reports or
working files, and none of `reports/review-195-r6.md` or `reports/test-195-r6.md`
was opened. I did read `reports/`-adjacent *round-5* artifacts only to the extent
of reusing the round-5 **audit** leg's own harnesses, which the leg brief
explicitly permits.

**Harness provenance.** Inherited harnesses were copied into
`salvage/r6-audit-195/` before use and sha256'd into
`INHERITED-HARNESS-SHA256.txt`:

```
0ca8b9e1dadb7a7af80c0ef732a479fc05946b36767cc04fc52cbc2286017f15  audit-195-r5-greenprobe.mjs
8bb6572fc29619cc8b4fc30905dd81762606698b619588b9378cec0a350c4e76  audit-195-r5-poc.mjs
8be8991fe94210fbf84b96e297b3f9ddc87a81b3052fa10a4b52825c78bb2278  audit-195-r5-protoscan.mjs
fe7313aeddf8b61816fd48a0858db68274853880668b4e09ea72d9497f84b400  audit-195-r5-slotprobe.mjs
9ee339eab1c31f7e170d7b68830acdfa22cb6fcd4c26ae89b8f3073b9dc2c3d6  audit-195-r5-surface.mjs
```

`probe.mjs`, `corpus.json`, `nonstring.mjs`, `prechange.mjs`, `clobber.mjs`,
`mutate.sh` and `guardmut.sh` are new this round.

### Mutation hygiene

All source mutations were **content-addressed**, aborting if the anchor was not
unique in the file; the pristine file was sha256'd before the run and re-verified
after every single case via an `EXIT`/`INT`/`TERM` trap that exits 99 on drift.
Confirmed restored at the end of every battery:

```
web/src/util/markdown.ts                          3c9ed48c7702cfa5928ebd6d4cbdce51ee8b734fc70bb1660a3ee56d038a87ed
web/src/components/inspector/ft-inspector-desc.ts 050fb42ba5e8ee0edd35678932aab4afc93c9d11d2bae6ef4a5a792a4b4a1c56
web/src/components/inspector/ft-inspector-comments.ts 493f2fb13dc6e2fa4e7b9b29ee191ad778bbe89ed45f435fc6415356391a66d5
git status --porcelain -> empty
npm test -> exit 0, 69 checks passed
```

No production code was modified. Nothing was pushed.

### What I did NOT establish

- **No real browser was used.** Everything ran in jsdom 26. jsdom is not a
  browser: it does not implement mXSS reparsing faithfully, does not load
  resources, and does not run the CSS engine. **mXSS results and any claim about
  `data:`/SVG script contexts are therefore weaker than they look.** The five
  mXSS vectors that produced empty shells in jsdom could in principle mutate
  differently in Chrome or Safari. A round that wants a *strong* mXSS negative
  needs Playwright against real engines; this one does not have it.
- **I did not test the built bundle**, only the TypeScript sources compiled by
  `tsconfig.test.json`. A Vite transform or a `define` replacement that alters
  the sanitizer in `vite build` output would be invisible to everything here and
  to the guard.
- **My probe cannot express DOM-clobbering exploitation end to end.** I showed
  the attributes survive with `SANITIZE_DOM:false`; I did **not** build a working
  clobbering exploit against the real components, and I state Low partly for
  that reason.
- **I did not audit the Go server's authn/authz**, CORS, or how issue bodies
  reach the database. My scope was the markdown boundary. I did confirm there is
  no server-side HTML rendering.
- **The advisory check depends on the npm registry's database** as of
  2026-07-28. It is a floor on known-ness, not a statement that 3.4.12 is free of
  undiscovered bypasses. DOMPurify has had multiple 3.x bypasses; there will be
  more.
- **`npm audit` covers the JS tree only.** No `govulncheck` was run against the
  Go module; out of scope for this leg but worth someone's round.
- **I did not vary the cardinality of `REQUIRED_SINKS` itself** beyond confirming
  the list matches the tree today. The check-total pin makes that expensive to
  change silently, but I did not prove it.

---

## Recommendations, in priority order

1. **Put `npm test` in CI.** This is the single highest-value change available to
   this workstream and it is not a sanitizer change. The guard is elaborate,
   carefully reasoned, and currently triggered only by voluntary local
   invocation. Everything else in this report is worth less than this.
2. **Pin `SANITIZE_DOM`** (LOW-1) — one check, matches the project's own `slot`
   standard.
3. **Bring `index.html` into the scanned set and stop classing `.html` as inert**
   (LOW-2).
4. **Add the offline lockfile-based prototype-patch tripwire** (Charge 5) — it
   retires the V25 disclosed survivor for ~20 lines and needs no CI.
5. Document `npm ci` as the only supported build path until CI exists.
6. When M1 is scheduled, prefer `ALLOWED_TAGS` (an allow-list of the ~22 tags
   marked actually emits) over the current `FORBID_*` subtraction. That single
   change would retire most of the G-series survivors, the `data:`-on-`img`
   cases and the protocol-relative cases at once, and would make this sanitizer
   default-deny.

---

## Positive observations

- **The three production changes are all correct, and all three are
  load-bearing** — I verified each by execution rather than accepting the log.
  `slot` genuinely survived DOMPurify's defaults before this round; `^3.0.0`
  genuinely admitted a high-severity version.
- **The developer's log is accurate.** I treated it as a claim to be checked and
  did not find an overstatement in it. The `slot` docblock in particular is
  unusually honest: it states plainly that the rule is not exploitable today and
  explains why it is worth having anyway. That reasoning is correct and is the
  standard I applied back to it in LOW-1.
- **The guard catches weakenings behaviourally, not by pinning source text.**
  Every one of the 19 mutations it caught failed on a live payload assertion or
  a structural rule, never on a literal-shape comparison of the sanitize call.
  That is the robust design and it is much harder to build than the brittle one.
- **The non-string guard is genuinely airtight**, including against
  `Symbol.toPrimitive` and boxed-string coercion tricks — it returns before any
  coercion can run.
- **DOMPurify fails closed with no DOM.** I hit this by accident when a static
  import hoisted above my jsdom setup: `sanitize` is simply absent and the call
  throws `TypeError`, rather than silently returning the input. Worth knowing.
- **T1 was a genuinely good find**, and its fix covers the two variants
  (`opts = {}` and `...rest`) that would defeat a naive `Function.length` pin.
- **The exit criterion was amended honestly.** Conceding that the guard cannot
  hold against someone with commit access — rather than quietly keeping the
  unsatisfiable claim — is the right call and made Charge 3 straightforward to
  answer.

---

*Report: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r6.md`*
*Evidence: `/scion-volumes/scratchpad/projects/farmtable/salvage/r6-audit-195/`*
