# #195 markdown-sanitize — round 7 security audit

**Leg:** `audit-195-r7` (independent audit leg) · **Tree:** `/workspace` at `7b4f6dd`
**Range:** `86f30bc..7b4f6dd`, ancestry verified —
`git merge-base --is-ancestor 86f30bc 7b4f6dd` exit 0, and
`git merge-base 89306d0 7b4f6dd` = `86f30bc` with `--is-ancestor 89306d0 7b4f6dd` exit 1,
so `89306d0` is a sibling and was not used as a base.
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r7.md`
**Production code:** not modified. `git status --porcelain` empty at exit; every mutation
ran in a throwaway copy at `/tmp/audit-r7/sb`.

**Verdict: REQUEST CHANGES**, narrowly — nothing in the diff needs reverting. The ask is
two sentences of production comment at `web/src/util/markdown.ts:99-107` plus a re-rate of
INFO-2. **No live vulnerability.** Independently confirmed: 40 payloads through the shipped
`renderMarkdown`, 0 flagged, detector proven first.

**Baseline (exit codes read from the child, never through a pipe):** `npm ci` 0
(`npm audit` 0 vulnerabilities, 106 packages) · `npm test` 0,
`75 checks passed (122 assertions)` · `tsc --noEmit` 0 · `vite build` 0.

---

## Findings

Critical 0 · High 0 · **Medium 2** · Low 4 · Info 1.

**F-1 [MEDIUM] R8/R9 is defeated by a non-contiguous module specifier, and the capture
reaches script execution.** Two lines at module scope in `src/components/ft-empty-state.ts`
(imported at `src/index.ts:31`):

```ts
const __p = import('dompur' + 'ify');
void __p.then((m) => (m.default as { setConfig: (c: unknown) => void })
  .setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] }));
```

`npm test` **exit 0, 75 checks / 122 assertions — unchanged**; `tsc --noEmit` 0;
`vite build` 0 with the capture in the shipped bundle verbatim
(`setConfig({ADD_TAGS:["script"],ADD_ATTR:["onerror"]}` in `dist/assets/index-*.js`).
Rollup confirms it is the same module instance, unprompted: *"purify.es.mjs is dynamically
imported by ft-empty-state.ts but also statically imported by src/util/markdown.ts, dynamic
import will not move module into another chunk."* Under Node,
`(await import('dompur'+'ify')).default === (await import('dompurify')).default` → `true`.
Effect: `renderMarkdown` returns
`<p><img src="x" onerror="alert(1)"><script>alert(2)</script></p>` where baseline returns
`<p><img src="x"></p>`. Controls: `import DOMPurify from 'dompurify'` RED,
`document.write(x)` RED. **This is not V25** — V25 is accepted because it names nothing;
this names the module, and is on the near side of the boundary drawn at
`markdown.test.ts:907-919`.
*Fix:* the private instance the file already names and defers (`markdown.ts:108-113`).

**F-2 [MEDIUM] A production security comment states a false narrowing, and it is the
stated reason the fix was deferred.** `markdown.ts:99-107` says `<script>` is still
stripped under a captured singleton, "`alert(1)` does not [come back]", and "nothing can
reach the singleton today". I reproduced the author's exact config **first** — and they are
right about that config: `setConfig({FORBID_TAGS:[],FORBID_ATTR:[]})` leaves
`<img src=x onerror=…><script>…</script>` as `<p><img src="x"></p>`. It is written as a
property of *the state*, and one different config on the same object
(`ADD_TAGS`/`ADD_ATTR`) gives full script execution. The second sentence is falsified by
F-1. Both are the premise for "close a finding filed as INFO with the ownership guard
already standing", so the deferral rests on nothing. Same text at `r7.md:220-223`.

**F-3 [LOW] `BANNED_SINKS` misses spellings of sinks it already enumerates.** 12 mutations,
each into a scanned non-sink component, all `tsc`-clean. GREEN at 75/122:
`document.writeln(x)`, `this.ownerDocument.write(x)` (the pattern is case-sensitive;
`ownerDocument`/`contentDocument` spell `Document.write`), `document.write?.(x)`,
`document["write"](x)` — **these four are misses inside the rule's own intent, not covered
by the "not a proof of absence" disclosure**. Also GREEN, but disclosed at class level:
`DOMParser().parseFromString`, `iframe.srcdoc =`, `setAttribute('onmouseover', …)`,
`Object.assign(el,{innerHTML})`, `Document.parseHTMLUnsafe`, `execCommand('insertHTML')`.
Control `document.write(x)` RED. **I predicted a line-straddling `el.innerHTML\n = x`
escape and was wrong** — `BANNED_SINKS` uses whole-text `.test()`, so `\s` spans newlines;
it is RED. Correct design, recorded as such.

**On #204 — the brief asked whether a concrete escape exists. It does, and it is cheap.**
The four within-intent misses are one-token variations nobody needs adversarial intent to
write. Equally important: **none of my escapes landed on the hand-rolled
balanced-delimiter layer** (`callArguments`, `sinkArgumentIsSanitized`,
`splitTopLevelParameters`) — that held against everything. So #204 should be scoped to the
regex-shaped subset the sunset clause already enumerates and should *not* absorb the
argument/arity parsers.

**F-4 [LOW] The scanned set is larger, not complete.** 51 = 50 under `src/` + `index.html`,
reproduced independently with `find`; the pin is accurate and `index.html` really is in.
PoC with **zero changes to any scanned file**: a `transformIndexHtml` plugin in the
unscanned `web/vite.config.ts` puts `<script>` into `dist/index.html` — `npm test` 0,
`vite build` 0, `grep -c` → 1. `public/favicon.svg` is copied verbatim into `dist`.
**Already disclosed** at `r7.md:275-277`, accurately, naming `public/` and "a Vite plugin".
What I add: **adding `vite.config.ts` to `EXTRA_SCANNED_FILES` would not have caught this**
— no rule matches a build hook returning a string. Do not close it that way.

**F-5 [LOW] Nothing in CI runs the guard.** `Makefile:9-10` is `go test ./...`;
`Makefile:16-17` is `npm ci && npm run build`, and `build` is `tsc --noEmit && vite build`.
No `.github/workflows`. All 75 checks execute only when a human types `npm test`. Disclosed
at `r7.md:285-287`; raised because it is the multiplier on everything above.

**F-6 [LOW] No CSP.** `internal/serverapp/unified.go:101` serves the dashboard as a bare
`http.FileServer` with no security headers; no `Content-Security-Policy` anywhere (positive
control: the same grep finds `Content-Type` in three Go files). Remote images and `srcset`
from attacker markdown load with no interaction — IP/UA/referrer disclosure and a read
receipt on internal task viewing. A CSP would independently neuter F-1 and F-4.

**F-7 [INFO] Dependency floors — stronger than documented in one direction.** The floor
docblock says a lockfile below the floor "passes here". I could not make that true:
`overrides` → npm `EOVERRIDE`; lockfile edited below the range → `npm ci` `EUSAGE`. Both
blocked by npm itself, so the residue is narrower than claimed — a patched `node_modules`,
which is an SRI/provenance problem. `marked` has **no** floor (`^15.0.0`); its exposure is
ReDoS, not XSS, since DOMPurify runs downstream.

---

## Brief items answered

- **Sinks enumerated independently** (not from the guard's accounting): exactly 2
  `unsafeHTML(` call sites in non-test source, `ft-inspector-comments.ts:221` and
  `ft-inspector-desc.ts:233`, both correctly wrapped; **zero** `innerHTML` /
  `document.write` / `insertAdjacentHTML` / `srcdoc` / `eval` in non-test source. Positive
  control: the grep finds `host.innerHTML = html` at `markdown.test.ts:61`. No Go-side HTML
  rendering exists — no `html/template` import in the repo; `assets.go` embeds `web/dist`.
- **Sunset clause and dependency floor both genuinely fire**, verified by mutation with
  false-positive controls: `typescript-eslint` declared → RED with the full message;
  `prettier` declared → GREEN; floor loosened to `^3.0.0` → RED. The r7 claim is accurate.
- **The DOMPurify/marked asymmetry is backwards relative to risk.** Measured: poisoning the
  shared `marked` singleton yields `<script>alert(1)</script><img src=x onerror=alert(2)>`
  raw, which DOMPurify then filters to `<img src="x">` — capture of the *private* half buys
  an attacker nothing even on success, because `marked` runs upstream. Capture of the
  *shared* half buys everything, because DOMPurify is the terminal filter. The dependency
  that was hardened is the one the other already covered.

## Where the brief was wrong

1. **Tree path.** `/workspace/farmtable-195-r7-audit` does not exist in-container; the
   checkout is `/workspace`. Found before starting; the missing directory was not created.
   (EM sent a correction mid-audit confirming this.)
2. **"[MEASURED] The sink guard is REGEX-based" is two-thirds true, and the untrue third is
   the third that held.** Three layers: regex rules, a ~220-line hand-rolled tokenizer
   (`stripInertText`), and hand-rolled balanced-delimiter parsers. Every escape I found is
   in the regex layer; nothing defeated the paren-counting layer. The framing pointed at the
   right target for a slightly wrong reason, and taken literally would have mis-scoped #204.
3. **Item 1 as posed ("can anything reach the DOM unsanitized?") answers "no"** and risks a
   leg stopping there. The exposure is entirely in what a future commit can do while green.
4. **Item 3 implies the round may have overclaimed completeness. It did not** —
   `r7.md:275-277` states the residue and names the exact two gaps I then demonstrated. The
   warned-about failure mode did not occur; this round is the counterexample.

## Costly disclosure — my own limits

- **Every behavioural result is jsdom 26.1.0, not a browser.** mXSS is a parser-differential
  class. I am not extrapolating from 40 jsdom passes to "no mXSS exists".
- **I never instantiated either Lit component.** No component harness exists. "The sanitized
  string reaches the shadow root" is a source reading at two line numbers, not a measurement.
- **`reports/dev-195-vectors.json` is not in this tree** (`ls reports` → no such path), so I
  could not read the V25 evidence. I neither confirm nor dispute it; F-1 does not depend on it.
- **I took `3.4.12` as the advisory line on trust**, confirming only that `npm audit` is
  clean there. I did not enumerate DOMPurify's GHSAs.
- **I scanned first-party source only** for F-1-style laundering points, not the 105
  installed packages.
- **I nearly shipped an unverified limit.** I had written "could not verify whether the split
  specifier survives a Vite production bundle" into C-A. That was reasoning onward from an
  unverified limit — the exact standing-bar failure — so I measured it instead. It cost about
  a minute and it is what turned F-1 from a test-harness curiosity into a shipped-bundle
  result.
- **My E10 prediction was wrong** and is reported as wrong rather than dropped.

## Harness integrity

Five harnesses, each aborting on a failed prerequisite with a distinct exit code, each
reading child exit codes directly rather than through a pipe: `mutate.sh` (baseline 75/122;
`document.write` control RED; `dompurify` import control RED), `effect.mjs` (baseline must
sanitize; split specifier must be the same object), `chain.sh`, `supply.sh`/`supply2.sh`
(floor value; `npm ci` 0; loosening control RED), `fuzz.mjs` (detector must see `onerror` on
raw markup). Predictions P1-P9 were written to `/tmp/audit-r7/predictions.md` before any
measurement.
