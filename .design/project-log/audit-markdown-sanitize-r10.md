# Security audit — markdown-sanitize round 10

**Commit audited:** `0b52dcdd6a06f694378084ea3ebefa7d9c473f15` (branch `markdown-sanitize-r10`).
**Verdict:** APPROVE. **Findings:** 0 Critical, 0 High, 2 Medium, 2 Low, 1 Info.
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r10.md` (not in-repo).

**Gates re-run in a clone built from scratch** (`npm ci` run by this leg, no handed
`node_modules`): `npm test` 0 — **83 checks / 131 assertions**; `npx tsc --noEmit` 0;
`npm run build` 0; `git status --porcelain` empty. Exit codes read from the child, never
through a pipe.

The diff is test-only. `git diff 13680c2..0b52dcd -- web/src/util/markdown.ts` is **0 lines** —
`markdown.ts` is byte-identical, verified rather than assumed. So this audit is about the product,
not the diff.

## What was measured

**Differential corpus: 1,073 renders** (29 schemes × 37 carriers) through the real
`renderMarkdown`, output re-parsed and *every* attribute of *every* element enumerated rather than
grepping for attributes chosen in advance. 238 attribute survivals. 6/6 positive controls passed.

**Execution: nothing executes.** Six payload classes in **Chromium 149**, injected via
`shadowRoot.innerHTML` (the faithful model of Lit's `unsafeHTML`). All NOT_EXECUTED, with both
positive controls firing. The DOM dump shows *why*: `href` is removed outright
(`<a id="T">x</a>`), `onerror` stripped, `<script>` gone. The sanitiser's core job is being done.

**Egress: 13 carriers fetch an attacker-chosen URL on render, with no user interaction** —
`img src`, markdown image, `img srcset`, `video poster`, `video/audio/source/track src`,
`source srcset`, `table background`, `svg image href`/`xlink:href`, `svg feImage`. `Description`
is `issue.GetBody()` mirrored verbatim (`internal/platform/github/github.go:163`), so the injector
need not be inside IAP while the viewer is. IAP protects inbound, not outbound. Not XSS; a
tracking and reconnaissance primitive. **Medium.**

The suite already holds the right threat model — check 36, *"svg style cannot reach an attacker
origin"*, reasons explicitly about reaching an attacker origin "with no user interaction" — but
applies it to CSS only, while check 48 pins the `<img src>` channel open. Same threat, opposite
conclusions, on two channels with identical effect.

**Ablation** (snapshot/`cp` restore, never `git checkout`; **0 of 2 cells left the tree dirty**):

| mutation | result |
|---|---|
| `ALLOW_UNKNOWN_PROTOCOLS: true` | **RED** — exit 1, 1 of 83 failed |
| `ADD_ATTR: ['ping']` (pure egress primitive) | **GREEN** — exit 0, 83/83 |

The suite catches scheme-widening and is blind to egress-widening.

**Guard invocation.** No pipeline runs `npm test`. Both Dockerfiles and the Makefile run only
`npm ci` / `npm run build` / `npm run dev`; `.git/hooks/` is empty; `.github/` exists but holds
only templates and no `workflows/`. The sole enforcement mechanism in the repository is the
`- [ ] Tests pass` checkbox in `PULL_REQUEST_TEMPLATE.md`. Every behavioural assertion here can be
eviscerated with all container builds green. `npm run build` *does* type-check the file
(`tsc --noEmit --listFiles` → 1 hit), so it cannot silently stop compiling — but type-checked is
not executed. **Medium.**

## On the relayed finding

Partially confirmed. Confirmed: the two sink line numbers, the permissive scheme set, the absent
`target`, and — measured in Chromium with the popup blocker both on *and* off — that
`target="_blank"` genuinely suppresses `javascript:` execution. **Refuted:** `<form action>` cannot
reach the DOM; `form` is in `FORBID_TAGS` and `action`/`formaction` in `FORBID_ATTR`, deliberately,
"so that neither rule is load-bearing on its own". **Incomplete:** the scheme list omits `callto:`
and `ftps:`. **Inapplicable:** the `target` result does not bear on this route, because `href` is
stripped before the question arises — so it is Low here, not High.

Correcting the brief's premise: **there is no first-party URL allow-list on this branch.** The
three `href` bindings (`ft-toolbar.ts:465`, `ft-inspector-code.ts:106`,
`ft-inspector-meta.ts:611`) bind `href=${url}` raw. The two-policy asymmetry is *prospective*, and
today runs the opposite way — the DOMPurify route is the better-defended of the two.

## Method note, recorded because it nearly cost a false result

My first Chromium execution arm returned all six payloads NOT_EXECUTED — a clean-looking result.
**The positive control also returned NOT_EXECUTED, so the run was invalid and was discarded.** A
literal `</script>` in the control payload had terminated the page's inline script
(`JSON.stringify` does not escape `/`), so nothing on the page ran at all. Two arms returning the
same value for different reasons, which is the failure mode this project keeps rediscovering. The
control is the only reason it was caught. Also worth recording: `innerHTML` never executes
`<script>`, and since `unsafeHTML` injects the same way, that is a real mitigation of the live sink
that no test pins.

## Recommendation

Route both URL consumers through one policy module and set the scheme list once — the hazard is
open-set, so the fix is a chokepoint, not a longer deny-list. Add one `href`/`src` attribute-policy
check to `markdown.test.ts`; it is the highest-marginal-value item left in this workstream and the
author has already disclosed its absence. Make something invoke the suite.

No production code was modified by this audit; `markdown.ts` ends byte-identical
(md5 `2cfe203b5872cd11359b414285cfa33c`).
