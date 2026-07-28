# markdown sanitize — round 8, independent SECURITY AUDIT leg

Issue #195. Branch `markdown-sanitize-r8`, HEAD `3f6a695`, base `7b4f6dd` (verified
ancestor; negative control `1d4442f` verified not). Tree `/workspace`. Audited in
parallel with an independent code-review leg and test-engineer leg on the same SHA;
this leg did not see their work.

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r8.md`.

## Gates (in `web/`, `npm ci`, child exit codes)

- `npm ci` → 0 (`found 0 vulnerabilities`)
- `npm test` → 0 — **78 checks / 123 assertions**
- `npx tsc --noEmit` → 0
- `npm run build` → 0

Production files were not modified. All mutation work in an isolated `/tmp/r8lab`
copy, abort-guarded, baseline re-verified green.

## Verdict

0 Critical, 0 High, 1 Medium, 3 Low, 1 Info. No live vulnerability in the shipped
tree. One working evasion of a security *control*.

## Headline: the round-8 arity scanner is beatable (MEDIUM)

`balancedDeclarationParameterLists` (markdown.test.ts:1700) counts `(`/`)` depth
over `stripInertText(src, {strings:true})`, which blanks string and comment
contents but **not template-literal bodies**. A template-literal *type* whose body
contains a `)` — `md: string | ` + backtick-`)`-backtick — survives into the
scanned view and is counted as the parameter-list terminator, truncating the
capture before a real, defaulted second parameter. Both declaration-side halves of
the arity pin miss it (the `.length` backstop is blind too, because the second
param is defaulted → `.length === 1`), re-creating the exact "both halves missed
the same declaration" failure the rewrite closed for the regex case.

Measured in `/tmp/r8lab`: all gates green, `tsc` clean, and the built artifact's
`renderMarkdown(payload, {inline:true})` renders a phishing `<form>` that the
one-arg call strips. Positive control: the plain 2-param form is RED; the
string-literal type `")"` is RED (strings are blanked) — the boundary is exactly
the unblanked template-literal channel.

Fix: make the depth counter literal-aware (skip `` `…` ``/`'…'`/`"…"`/`/…/`), as
the docblock already argues for `callArguments`. Same latent class affects every
paren/brace/angle counter over that view; a shared literal-skipping helper removes
the class. Pin the evasion + its string-type mirror in `ARITY_EVASIONS`.

## §1 (private DOMPurify) — CONFIRMED in the built bundle

`web/dist/assets/index-*.js`: exactly one `.sanitize(` call site (`C0.sanitize`);
`C0 = k0(window)` is the private instance, module-local, not exported, referenced
only at its definition and the sanitize call; the singleton `k0` is referenced only
to spawn `C0`; zero `addHook`/`setConfig` invocations anywhere. Split-specifier
poisoning (`import('dompur'+'ify')`) still resolves to `k0` but `renderMarkdown` no
longer traverses `k0`, so it is inert. Residual (LOW): a private instance narrows
CONFIG ownership, not DOM ownership — it shares `window`/`DOMParser`/prototypes with
everything else, and the docblock does not say so.

## §2 architecture — framing upheld, sharpened

The ownership asymmetry was backwards relative to risk and B3a fixes it. After B3a
the remaining asymmetry is not marked-vs-DOMPurify (both private, DOMPurify the sole
sanitize consumer) — it is config-ownership (now symmetric, closed) vs DOM-ownership
(shared, unownable at this layer). The narrowest thing every path traverses is the
shared DOM, which no private-instance move can bind; that points at a CSP, not a
further ownership refactor. `marked` is not the weaker half.

## §4 F-4 — reclassify LOW/INFO; the real fix is a CSP

F-4 is build-integrity (trusted code adding its own sink to `dist/index.html`), not
the data-sanitization boundary #195 defends. An attacker who can inject a build
plugin can already edit `markdown.ts`; F-4 is not a new capability. `EXTRA_SCANNED_FILES`
cannot catch it — the script exists only in the artifact. What closes the class is a
CSP (`script-src 'self'`, no `'unsafe-inline'`), which also backstops the §3 class and
residual DOMPurify bypasses. There is currently NO CSP in source or in
`dist/index.html` (LOW in its own right).

## §5 version floor — predicate is wrong shape; could not audit the advisory list

`dompurify: "^3.4.12"` declared, `3.4.12` locked+installed, `npm audit` clean. The
check asserts `=== '^3.4.12'` on the manifest string only — no lockfile/node_modules
read, and a caret floats to newer 3.x. It gives no artifact-level assurance in either
direction. Recommend `semver.satisfies(installed, '>=3.4.12 <4.0.0')`. Could NOT
independently audit the advisories behind the floor: WebSearch/WebFetch disabled in
sandbox; `npm audit` clean is the strongest signal obtained.

## Where the brief was wrong

§5's "string equality fails open on newer versions as readily as older ones"
mis-attributes the fail-open. Exact equality actually fails *closed* on a newer
*declared* floor (`^3.5.0` → RED). The fail-open is the caret + manifest-only read,
not the `===`. Substantive point stands; named mechanism does not. (Also: the in-file
docblocks say "122 assertions" where the live suite reports 123 — pre-fix figures,
harmless but confusing.)

## Void run

First `balancedDeclarationParameterLists` micro-repro OOM'd (exit 134) on a bug in my
own `re.exec`/`lastIndex` loop; discarded. Authoritative result is the real suite
going green with the evasion applied, not the repro. All negative claims paired with
a positive control in the same harness.
