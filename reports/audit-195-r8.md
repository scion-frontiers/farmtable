# Security Audit Report — #195 round 8 (independent leg)

- **Branch / SHA:** `markdown-sanitize-r8` @ `3f6a695ed450718316b50303975621bbb725e4f8`
- **Base:** `7b4f6dd` (verified ancestor). Negative control `1d4442f` verified NOT an ancestor.
- **Tree:** `/workspace` (`git rev-parse --show-toplevel` = `/workspace`).
- **Surface (excl. `.design/`):** `web/src/util/markdown.ts` +79/−34, `web/src/util/markdown.test.ts` +514/−59 — matches the brief's numstat exactly.
- **Gates (in `web/`, `npm ci`, child exit codes):**
  - `npm ci` → 0 (`found 0 vulnerabilities`)
  - `npm test` → 0 — **78 checks passed (123 assertions)**
  - `npx tsc --noEmit` → 0
  - `npm run build` → 0
- Production files were **not modified**; `git status` on `/workspace` clean throughout. All mutation work was done in an isolated copy at `/tmp/r8lab` (symlinked `node_modules`), abort-guarded, baseline re-verified green (78/123).

---

## Summary

- **Critical:** 0
- **High:** 0
- **Medium:** 1  (working evasion of the round-8 arity scanner — §3)
- **Low:** 3  (DOM-ownership comment gap — §1; no CSP backstop — §4; version-floor predicate — §5)
- **Info:** F-4 impact re-assessment (§4)

**Verdict:** The two claims the brief flagged as highest-value both hold at the level they were made — §1 (the private DOMPurify instance genuinely closes the config-poisoning class, confirmed *in the built bundle*) is **CONFIRMED**, and §3's balanced parameter scanner is a real improvement over the truncating regex it replaced. **But §3's scanner is beatable:** I have a working, `tsc`-clean, all-gates-green evasion that reopens *both declaration-side halves* of the arity pin against an implementation taking a real, usable second parameter. That is the headline finding.

---

## Findings

### [MEDIUM] Arity scanner (`balancedDeclarationParameterLists`) is evaded by a template-literal parameter type

- **Location:** `web/src/util/markdown.test.ts:1700` (`balancedDeclarationParameterLists`), root cause at `:1221` (`stripInertText`).
- **Description:** The round-8 rewrite counts `(`/`)` depth to find the parameter list, over the derived view `stripInertText(src, { strings: true })`. `stripInertText` blanks the *contents* of `'…'`/`"…"` string literals and all comment forms — but **deliberately does not blank template-literal bodies** (`html`…`` bodies are the real sinks and must stay visible). A parameter *type* may be a template-literal type, and a template-literal body may contain a `)`. That `)` survives into the scanned view and the depth counter treats it as the paren that closes the parameter list — truncating the capture before the second parameter. This is precisely the shape the brief predicted: *"a depth counter that miscounts a `)` inside a string has the same shape one level down."* Strings were closed (they are blanked); the template-literal channel was not.

- **Impact:** The arity pin is the control that exists to deny a configuration channel being added to `renderMarkdown` (`renderMarkdown(body, { inline: true })`). With this spelling the declaration-scan half **and** the `renderMarkdown.length === 1` backstop both pass, against a function that takes a real second parameter which reconfigures the sanitizer — the same "both halves missed the same declaration" failure mode the round-8 rewrite was written to close, re-created against the rewrite.

- **Proof of concept (measured in `/tmp/r8lab`, all gates green):**

  Declaration:
  ```ts
  export function renderMarkdown(md: string | `)`, opts: { inline?: boolean } = {}): string {
    if (typeof md !== 'string') return '';
    return purifier.sanitize(parser.parse(md) as string, {
      FORBID_TAGS: opts.inline ? [] : FORBID_TAGS,
      FORBID_ATTR: opts.inline ? [] : FORBID_ATTR,
    });
  }
  ```
  - `npm test` → **0, 78 checks / 123 assertions** · `npx tsc --noEmit` → **0** · `npm run build` → **0**.
  - **Positive control (same harness reports a catch):** the plain form `renderMarkdown(md: string, opts: {…} = {})` is RED — `renderMarkdown declares 2 parameters … a second parameter is a configuration channel`. So the harness *can* report this class; it stays green only for the template-literal spelling.
  - **Runtime, from the built artifact** (`.tmp-test/util/markdown.js` after `npm run build`):
    ```
    DEFAULT : Sign in                                              (form stripped)
    INLINE  : <form action="https://evil.example"><input name="token" type="password">…  (survives)
    arity   : renderMarkdown.length = 1                            (.length backstop blind too)
    ```
  - **Mechanism, exact:** `balancedDeclarationParameterLists` captures the parameter text as `"md: string | \`"` → `splitTopLevelParameters` → `["md: string | `"]` → length 1 → pin returns `null` (passes). The `)` inside the backtick was counted as the list terminator. `md: string | ")"` (a **string**-literal type) is caught RED, because string contents *are* blanked — confirming the boundary is exactly the template-literal channel.

- **Honest scope of exploitability:** This defeats the arity pin's two **declaration-side** halves. It is not, by itself, a live XSS in the shipped tree, because (a) `opts` defaults to the safe branch, so a sink must *deliberately* pass a truthy option, and (b) that call — `renderMarkdown(body, { inline: true })` — carries a top-level comma that the independent, call-site control `sinkArgumentIsSanitized` still rejects. So a real bypass needs this finding **plus** an evasion of the sink-side control. I probed the sink-side counters (`callArguments`, `sinkArgumentIsSanitized`) for the same template-literal blindness: they share it, but because R5 requires the argument to be *exactly* a bare `renderMarkdown(…)` call with nothing trailing, the truncations it produces get flagged as "not a bare call" rather than passing. I did not find a clean sink-side bypass. The rating is **Medium** because it fully reopens the control the round explicitly asked me to beat, and re-instates the exact defect the rewrite claimed to close; it is not High only because a second, independent layer still stands between it and script/phishing execution.

- **Recommendation:** Make the depth counter in `balancedDeclarationParameterLists` template/string/regex-aware, exactly as the docblock already argues `callArguments` must be. The minimal fix is to skip over `` `…` ``, `'…'`, `"…"` and `/…/` spans while counting parens rather than counting raw characters:
  ```ts
  // inside the while (depth > 0) scan, before the ( / ) tests:
  const c = code[i];
  if (c === '`' || c === '"' || c === "'") { i = skipLiteral(code, i); continue; }
  if (c === '(') depth += 1;
  else if (c === ')') depth -= 1;
  i += 1;
  ```
  Add `md: string | \`)\``, `md: (x: string) => string | \`)\``, and the bare-string mirror `md: string | ")"` to `ARITY_EVASIONS` so the fix is pinned with its positive control. Note this same class latently affects every paren/brace/angle counter that runs over the strings-blanked-but-templates-kept view (`splitTopLevelParameters`, `hasTopLevelDefault`, `callArguments`, `sinkArgumentIsSanitized`); a single literal-skipping helper shared across them removes the class rather than one instance of it.

---

### [LOW] §1 residual: a private instance narrows the CONFIG, not the DOM — the code does not say so

- **Location:** `web/src/util/markdown.ts:86-130` (the `purifier` docblock) and `:130` (`createDOMPurify(window)`).
- **Description:** §1's primary claim is **CONFIRMED in the built bundle** (see "Bundle verification" below). The residual is that the module's own commentary frames the win as ownership without distinguishing *which* ownership it bought. `createDOMPurify(window)` takes a `window`; the private instance shares the process `window`, `document`, `Element`/`Node` prototypes, `DOMParser` and `document.createElement` (23 references to those DOM primitives in the bundle) with every other module. Prototype pollution or a hostile override on any of those is upstream of the private instance exactly as much as it was upstream of the singleton. The docblock at length rebuts the round-7 "nothing can reach the singleton" argument but never records that a private instance leaves the **DOM** trust boundary untouched.
- **Impact:** A future reader sees "we use a private instance" and reasonably concludes the sanitizer is insulated from module-level tampering in general. It is insulated from **config/hook** tampering only. That is the same over-reading (a property that holds for one axis, stated as if it held for all) the brief's own general rule warns against.
- **Recommendation:** One sentence in the docblock: *"This narrows ownership of the DOMPurify CONFIG only. The instance still uses the shared `window`/DOM; prototype pollution on `Node`/`Element`/`DOMParser`/`document.createElement` or a hostile `TrustedTypes` policy is upstream of any instance, private or not, and is out of this module's scope."* No code change.

---

### [LOW] §4: no CSP backstops the sanitizer, in source or in the built `dist/index.html`

- **Location:** `web/index.html`, `web/dist/index.html` — neither carries a `Content-Security-Policy`. `web/vite.config.ts` sets no CSP header.
- **Description:** The entire security posture of the dashboard's untrusted-markdown path rests on a single runtime filter (DOMPurify `C0.sanitize`) plus a static test suite. There is no second runtime line of defence. Any DOMPurify bypass that the suite does not model (a future mXSS class, a config regression on an axis the suite does not cover, or the arity/sink channel above if both layers were ever defeated) reaches script execution unimpeded.
- **Impact / why it matters to §4:** A CSP with `script-src 'self'` and no `'unsafe-inline'` would neutralise an injected inline `<script>` **regardless of how it entered the page** — which is exactly the property F-4 needs, and which expanding the static scan cannot provide. It is therefore both the answer to §4 and defense-in-depth for the §3 class.
- **Recommendation:** Serve the dashboard with a CSP (meta tag in `index.html` as a floor, HTTP header from the serving layer as the real control): `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. Shoelace/Lit may need `style-src 'self' 'unsafe-inline'` audited; that is a smaller surface than the current all-or-nothing.

---

### [LOW] §5: the version-floor check gives no assurance about the installed artifact, and exact-string-equality is the wrong predicate for a floor

- **Location:** `web/src/util/markdown.test.ts:3718` (`dompurify declares a floor equal to the advisory line`).
- **Measured:** `package.json` declares `dompurify: "^3.4.12"`; `package-lock.json` pins `3.4.12` with an integrity hash; `node_modules/dompurify/package.json` is `3.4.12`; `npm audit --omit=dev` → **0 vulnerabilities**. So the installed artifact is at the floor today and clean against the advisory DB npm ships.
- **Description:** The check asserts `deps['dompurify'] === '^3.4.12'` — string equality against the **manifest range string**, which the check's own docblock admits does not read the lockfile or `node_modules`. Two predicate problems:
  1. **No artifact-level assurance, in either direction.** A caret range `^3.4.12` floats to the newest `3.x`. A lockfile or a patched `node_modules` pinned *below* the floor passes (the string is unchanged); a future `3.x` carrying a *new* advisory also passes (still `< 4.0.0`, still matches the caret). The security question is "is the *installed* version `≥ 3.4.12` and advisory-clean," and this predicate answers a different question.
  2. **Exact equality is the wrong shape.** It fails *closed* on a legitimate floor bump (declaring `^3.5.0` turns the suite RED and forces a human edit — fine, if intended) but does nothing to constrain what is actually installed. A floor is a `≥` relation; the predicate that expresses it is `semver.satisfies(installedVersion, '>=3.4.12')` read from the lockfile or `node_modules`, optionally with an upper pin.
- **What I could NOT verify:** I could not independently audit the advisory list *behind* the 3.4.12 floor. `WebSearch`/`WebFetch` are disabled in this sandbox (org policy / model-access errors), so I could not enumerate DOMPurify GHSAs and confirm 3.4.12 sits at or above the highest advisory fix line. `npm audit` clean is real evidence the *installed* tree has no *known* advisory, but it is not the same as confirming the floor value is the correct one. I am taking the docblock's "advisories through 3.2.x" claim on the same trust the dev leg took the install on — flagged, not confirmed.
- **Recommendation:** Replace the string-equality check with a lockfile-or-`node_modules` read plus `semver.satisfies(installed, '>=3.4.12 <4.0.0')`; keep a comment naming the advisories the floor encodes so the number is auditable. Re-run `npm audit` in the same check so the artifact is actually exercised.

---

## §2 — the architectural ruling, tested rather than confirmed

**Your framing is correct, and B3a is the right move.** Round 7 made the *upstream* dependency (`marked`, `new Marked({…})`) private while leaving the *terminal filter* (DOMPurify) the process-global singleton. That is backwards relative to risk: poisoning `marked` is still filtered by DOMPurify afterwards, whereas poisoning the terminal filter is unfiltered by anything. The last line of defence was the one left shared. B3a makes the terminal filter private too, so the config-ownership axis is now symmetric and both halves are owned.

**Where I would sharpen it: `marked` is *not* the weaker half now, and neither is DOMPurify.** After B3a both instances are private and the terminal filter is the sole `.sanitize` consumer in the bundle. The remaining asymmetry is no longer *marked vs DOMPurify* — it is **config-ownership (now private, symmetric, closed) vs DOM-ownership (shared `window`, unowned, and unownable at this layer)**. Your general rule — *bind a control to the narrowest thing every path must traverse* — is exactly right, and it identifies the real weakest link: the narrowest thing every path traverses here is not the config, it is the **shared DOM**, which no private-instance refactor can bind. That is why the highest-value hardening is a CSP (a control the runtime traverses regardless of instance ownership), not a further ownership move. So: B3a goes far enough on the axis it addresses; the axis it *cannot* address is the one to escalate next, and it is not `marked`.

---

## §4 — F-4 severity, now that it is the remaining static-scan hole

**Reclassify F-4 as LOW as a data-path XSS risk, INFO as a "gap in the sanitizer's static scan."** Reasoning:

- F-4 lives on a **different trust boundary** from everything else in #195. The sanitizer defends *untrusted DATA* (mirrored GitHub markdown) against reaching a raw sink. F-4 is *trusted CODE* (a Vite plugin / the build config) adding its **own** sink into `dist/index.html`. An attacker who can inject a plugin into the build can equally edit `markdown.ts` to delete DOMPurify, weaken `FORBID_TAGS`, or add the `opts` channel above directly. F-4's *incremental* severity over "attacker controls the build" is therefore ~nil — it is not a new capability, it is one instance of a capability that already implies full compromise.
- You are right that `EXTRA_SCANNED_FILES` cannot close it, and the reason is worth stating precisely: the injected `<script>` exists only in the **build output**, never in any source file, and the plugin doing the injection is arbitrary JS whose intent (`transformIndexHtml` appending a script) the sink-shaped rules are not built to recognise even if `vite.config.ts` *were* scanned. It is on the wrong side of the source/artifact line, and the scan is a source-side control.
- **What would actually close it:** not a scan expansion, but (1) a **CSP** served with the dashboard (`script-src 'self'`, no `'unsafe-inline'`) — which neutralises the injected inline script regardless of how it entered `dist/index.html`, and simultaneously backstops any DOMPurify bypass; and (2) **build-integrity** controls for the supply-chain vector the config represents — `npm ci` against a committed lockfile (present) with integrity hashes (present), pinned+audited plugin deps, and a diff of `dist/index.html` against an expected template as a release gate. CSP is the single highest-leverage item because it is the only one that also covers the §3 class and residual DOMPurify bypasses.

Net: F-4 is not the scary "remaining hole" its position in the list suggests; it is a build-integrity concern misfiled against a data-sanitization suite. The genuinely useful action it points at — a CSP — is one this workstream does not yet have and should adopt for reasons well beyond F-4.

---

## Bundle verification (§1, in the shipped Rollup output, not source)

Built `web/dist/assets/index-0X1Hw_8G.js` (825 KB). Minified identifiers resolved:

- `function Hp(){…arguments[0]…}` = `createDOMPurify` (the factory; reads an optional `window` arg).
- `var k0=Hp()` = the **process-global singleton** DOMPurify instance, created at dompurify's own module load (`var purify = createDOMPurify()` at `purify.es.mjs:2422`, `export { purify as default }` at `:2424` — so the source name `createDOMPurify` is bound to the singleton instance, which is itself callable to spawn children).
- `C0 = k0(window)` = the **private instance** (`purifier` in source), spawned from the singleton with the shared `window`.

Evidence the fix closes the class **in the bundle**:

1. **Exactly one `.sanitize(` call site in the entire bundle: `C0.sanitize(`.** Nothing calls `.sanitize` on `k0` or any other object. So the singleton is not on any rendering path.
2. **`k0` is referenced only twice: `var k0=Hp()` and `C0=k0(window)`.** The singleton is used solely to birth the private instance; it is not exported and nothing else obtains it.
3. **`C0` is referenced only twice: its definition and `C0.sanitize(...)`.** The private instance is a module-local const, not exported, not leaked — genuinely unreachable from other modules.
4. **Zero `.addHook(` / `.setConfig(` / `.removeHook(` *invocations* anywhere in the bundle** (only the method *definitions* on the factory prototype appear). So no module — including any split-specifier `import('dompur'+'ify')` re-import, of which there are none in the current bundle — poisons even the singleton; and since DOMPurify config/hooks are per-instance, poisoning `k0` could not reach `C0` regardless of load order. This corroborates the dev leg's V23 (`addHook`) bonus claim: hooks are instance-local.

So the split-specifier poisoning the dev leg reproduced pre-fix (`import('dompur'+'ify')` resolving to the same singleton) is now **inert against `renderMarkdown`**: it still resolves to `k0`, but `renderMarkdown` no longer traverses `k0`. Confirmed, not merely in source.

---

## §3 second half — R6b promotion and `stripImportStatements`

Reviewed `stripImportStatements` (`markdown.test.ts:1473`) against `import`'s grammatical productions. The round-8 fix `(?!\s*[.(])` + optional `;?` closes the two documented swallows (`import.meta`, `import(<non-literal>)`). Probed for a new swallow **with a positive control**:

- **Positive control (my probe can report a swallow):** the round-7 lookahead `(?!\s*\.)` on the documented `import(spec)` block **swallows** the `unsafeHTML` alias (`true`).
- **Shipped `(?!\s*[.(])`** on the same block, on `import.meta.env.DEV`, on `import type { X } from …`, and on `import x from 'y' with { type: 'json' }` (import attributes) — **does not swallow** any alias (`false` for all).

I did not find a new swallow spelling. The honest residual is the tracked one: these are regex-shaped controls over a language regexes cannot parse (the `#204` type-aware-lint follow-up is the correct closure), and the string-blanking view means a runtime-assembled specifier (`import(k)`, `(0,eval)('unsafeHTML')`) is invisible — already recorded in the `stripInertText` docblock as the strongest argument for #204. No new finding here.

---

## What I could not verify

- **The DOMPurify advisory list behind the 3.4.12 floor** — `WebSearch`/`WebFetch` are disabled in this sandbox (org-policy and model-access errors, quoted in my run log). `npm audit` clean is the strongest signal I could obtain; it confirms the *installed* tree is advisory-clean but not that 3.4.12 is the *correct* floor value. Flagged in the §5 finding.
- **Whether the §3 evasion is reachable to live XSS end-to-end** — I established it defeats both declaration-side halves of the arity pin and that the built artifact takes a live configuration parameter, but a full XSS also requires defeating `sinkArgumentIsSanitized`, which I probed and could not defeat. I am *not* claiming live XSS; I am claiming a defeated control (see the finding's honest-scope paragraph).

## My void runs

- First reproduction of `balancedDeclarationParameterLists` (`/tmp/mech.mjs` v1) OOM-crashed (heap limit, exit 134) due to a bug in **my** harness's `re.exec`/`lastIndex` loop, not in the shipped code. **Discarded.** Re-run with a corrected loop returned the exact capture (`"md: string | \`"`, 1 param). The authoritative result for the evasion is the **real suite** going green (78/123) + `tsc` 0 + `build` 0 + runtime exploit, not the micro-repro.
- All negative claims in this report are paired with a positive control run in the same harness (arity: plain 2-param form RED; import-swallow: round-7 regex swallows; string-type-`")"` RED). Per the standing bar, "I could not evade it" is only asserted where the harness demonstrably reported an evasion elsewhere.

## WHERE THIS BRIEF IS WRONG

**§5, the characterisation of the predicate (line ~120).** The brief says string equality *"fails open on newer versions as readily as older ones."* That attributes the fail-open to the wrong operator. Exact string-equality against the declared range actually fails **closed** on a newer *declared* floor — declaring `^3.5.0` turns the suite RED and forces a human edit; it does not silently accept it. The genuine fail-open is a property of (a) the **caret range** `^3.4.12` floating to newer `3.x` and (b) the check reading **only the manifest string**, never the lockfile or `node_modules`. So the installed artifact is unconstrained in *both* directions, but that is because of the caret + manifest-only read, **not** because the predicate is string-equality — if anything, string-equality is the fail-*closed* part. The fix (semver-satisfies against the installed version) changes the *source of truth and the relation*, and is orthogonal to swapping `===` for something else. The substantive point ("a string floor is not a security control over the installed artifact") stands; the mechanism named for it does not.

Secondary (not an error, a caveat on a MEASURED-BY-me value): the brief's gate line reads "78 checks, **123 assertions**" while the C7-l/`balancedDeclarationParameterLists` docblocks inside the test file repeatedly say "78 checks / **122** assertions." The live suite reports **123**; the in-file "122" figures are describing the historical pre-fix state, not current, so they are not wrong in context — but a reader diffing the two numbers will trip on it. Worth a one-word "(pre-fix)" in those docblocks.
