# #195 markdown-sanitize — round 6 security audit (leg 2 of 3)

**Branch:** `markdown-sanitize` · **Head audited:** `86f30bc`
**Leg:** security audit, run independently and in parallel with the code-review
and test-review legs. No other leg's report or working files were read.
**Report:** `scratchpad/projects/farmtable/reports/audit-195-r6.md`
**Evidence:** `scratchpad/projects/farmtable/salvage/r6-audit-195/`

## VERDICT: APPROVE

0 Critical, 0 High, 0 Medium, 2 Low, 3 Info. No live XSS at this head: 0
execution-canary firings across a 78-vector corpus. Gate reproduced
independently — `npm test` 0 (69 checks), `npx tsc --noEmit` 0, exit codes read
from the child, never through a pipe.

## What was established, by execution

**Positive control first.** A probe with two independent detectors (structural
artifact walk, plus real script execution in a JSDOM with `runScripts:
'dangerously'`) was run against a copy of the module with DOMPurify removed
entirely: 70 of 78 vectors ALLOWED, 28 firing a real `alert(1)`. Only then was
it pointed at head. A third build with the forbid lists deleted separates
"DOMPurify's defaults blocked it" (allowed=40) from head (allowed=26, all inert
shells or known-tracked `data:`/protocol-relative cases).

**The three production changes are correct and all three are load-bearing.**

- `slot` — confirmed it survived DOMPurify's defaults before this round and is
  blocked now. Extended to eight variants: case, SVG namespace, entity-encoded
  value, inside `<template>`, the `<slot>` element, `onslotchange`, and
  declarative shadow DOM. No hole.
- Non-string guard — airtight against boxed strings, `toString`, `valueOf`,
  `Symbol.toPrimitive`, proxies and template-tag objects; it returns before any
  coercion can run. **It blanks nothing that previously rendered:** the
  pre-round-6 function was reconstructed and every non-string threw under
  `marked`. Purely a throw-to-`''` conversion, and the throw was reachable via
  `description?: string`.
- `dompurify ^3.0.0 -> ^3.4.12` — verified with a control that fails closed.
  Installing each version in isolation: 3.0.0 = 1 high, 3.1.2 = 1 high,
  3.2.3 = 1 moderate, 3.4.11 = 1 low (GHSA-c2j3-45gr-mqc4, `<=3.4.11`),
  3.4.12 = clean. The detector demonstrably fires, so the clean result is real,
  and the floor sits exactly one version above the last advisory.

Note for the record: of the "four production items", three are production; the
URI-policy pin is a check in `markdown.test.ts`. Its claim to pin the policy
rather than a scheme was tested by mutation and holds.

**Sink inventory re-established independently.** Repo-wide sweep found exactly
two sinks, both wrapped, and `REQUIRED_SINKS` matches. Additionally swept the Go
tree, which no prior round appears to have done: no `html/template`, no
`text/template`, no handler emitting `text/html`. There is no second XSS
boundary.

**V25 / protoscan:** no drift, scanner self-check live, and the property was
verified directly — `jsdom` and `nwsapi` are both outside the 23-package
production closure.

## The reframe requested on the guard (recorded once)

`BANNED_SINKS`, `sinkArgumentIsSanitized` and `stripImportStatements` are
build-time lint inside a test file. They are not on any attacker's path.

- An attacker **without** commit access — the real threat model, a mirrored
  GitHub issue body — pays **nothing**; the guard never executes for them.
- An attacker **with** commit access pays approximately nothing, since they can
  edit the guard in the same commit. The amended exit criterion already concedes
  this and is right to.

The guard defends against **accident**, which is a real and worthwhile job (T1
was exactly that shape). But it means every guard finding in this workstream is
regression detection, not vulnerability detection, and should be severity-capped
at Low unless it corresponds to a live weakening of `renderMarkdown`.

Consequence worth acting on: **there is no CI**, so even the accident-defence
only fires when someone chooses to run `npm test` locally.

## Findings

- **LOW-1 — `SANITIZE_DOM: false` survives the suite green and demonstrably
  weakens the sanitizer.** 12 of 13 config weakenings turn the suite red; this
  one does not. Held to the round-5 `ADD_ATTR:['style']` bar before filing: a
  differential probe shows 8 of 10 DOM-clobbering vectors survive with it off,
  with a control (`id="section-1"`) that does not differ. Not exploitable today
  for the same shadow-root nesting reason the `slot` docblock gives — which is
  precisely that docblock's argument for pinning it anyway. One check
  recommended.
- **LOW-2 — the scan root excludes production files and `.html` is treated as
  inert.** The tree scan walks `web/src` only; `web/index.html` ships, contains
  an inline `<script>`, and is invisible to every tree-wide rule at once. Same
  failure shape as T2, which this round fixed. Not exploitable today.
- **INFO** — the caret floors rather than pins (lockfile is the real control,
  `npm ci` only on the `make web` path); DOMPurify's shared singleton is not
  mutated anywhere today but a sticky `setConfig` was measured to override the
  per-call config (20 checks red); V25 tripwire specified.

## Declined, deliberately

A module-scope `globalThis` assignment survives green — declined, it weakens
nothing and the guard's amended criterion explicitly scopes runtime-effect
changes out. `data:` on `img src` and protocol-relative URLs survive — declined
as XSS (script-disabled context; zero canary firings) and belong to M1. The
G-series attribute survivors are M1, unchanged since round 5.

## Disclosures

**My first guard-mutation battery was void and produced a clean fictitious
table.** `guardmut.sh` v1 ran `npm test` from the wrong directory; all eight
"caught" results were `npm ENOENT`. It was caught only when quoting the failure
reasons turned up empty logs. The fix was a **no-op control mutation that must
come out GREEN**, not just the `cd`. The corrected battery: control GREEN, seven
real weakenings RED, including all three arity variants. The config battery was
never affected — it used a subshell `cd` from the start.

**An ARTIF blind spot was found and fixed mid-run:** `<template>.content` is not
reachable via `el.children`, so template-borne payloads were unobservable. Fix
validated by increased sensitivity on the control module.

**Limitations:** jsdom only, no real browser — mXSS negatives are weaker than
they look; the built Vite bundle was not tested; no end-to-end clobbering
exploit was built; the Go server's authn/authz and `govulncheck` were out of
scope.

## Top recommendation

Put `npm test` in CI. The guard is elaborate and carefully reasoned, and its
trigger is currently voluntary. That change is worth more to this workstream's
security posture than any further hardening.

No production code was modified by this leg. Tree verified clean and all
mutated files sha256-verified back to their pristine state.
