# #195 markdown-sanitize — round 3 test review

**Branch:** `markdown-sanitize` · **SHA reviewed:** `bae4fd0` · **Range:** `5daace4..bae4fd0`
**Leg:** test engineering (`test-195-r3`). Security audit and code review run separately at this same SHA.
**Gate:** `npm ci && npm test` under node. **jsdom 26.1.0** — matches the tree's `^26.1.0`; no version drift in this clone. `lit` / `lit-html` both 3.3.2.
**Baseline:** `markdown sanitizer: 54 checks passed`, exit 0.

**Verdict: REQUEST CHANGES** — 2 High, 2 Medium, 2 Low, 2 Info.

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r3.md`

## What this round got right

Verified dead by content-addressed mutation, 40 mutations, tree asserted clean
after each restore:

- **T2** — all 11 raw-sink forms, each failing with the file *and* the sink named.
- **Alias ban** — all 8 forms, including both bypasses the dev found in its own
  fix (`lit-html/` path, aliased `unsafeSVG`/`unsafeStatic`) and a third path I
  added, `lit-html/development/directives/unsafe-html.js`, which suffix matching
  handles correctly.
- **T4** — deleting one of the three hoisted payloads now fails via
  `EXPECTED_CHECKS`. The dev's call to reuse a pin already proven to fire, rather
  than add a second unguarded length counter, is the right trade and I endorse it.
- **T3 narrowing** — dropping a `REQUIRED_SINKS` entry, removing the
  `sinkBinding()` call, and renaming a sink file on disk all go red.
- **Check-count arithmetic** — re-derived independently: 53 literal sites, one
  loop site, `REQUIRED_SINKS.length` 2, so 53 − 1 + 2 = 54. The first version's
  self-confirming grep inflation is genuinely fixed; the comment line begins at
  column 0 and cannot match `^\s+check\(`.
- **Zero production code** in the range. Confirmed independently.

## Why it still fails

**HIGH-1 — value-aliasing evades the sink binding.** The ban covers `X as Y`,
`import * as`, and `export … from`: three *import-syntax* forms. It does not
cover aliasing the imported *value*, which needs no `as`. Adding
`const rawHtml = unsafeHTML;` and a second `${rawHtml(c.body)}` render to the
**real** sink file — leaving line 221 intact so the per-file check passes and the
sink count stays 2 — yields `54 checks passed`, exit 0, with attacker-controlled
comment bodies rendering raw. The component is production-wired
(`src/index.ts:48`, `ft-inspector.ts:211`), so this is reachability, not
reconstruction. This is the M-G1-10 shape one indirection step along.

**HIGH-2 — the new-file guard is the file-count pin, and its message invites the
update that disarms it.** Attribution differs from what the fix brief assumes: a
new file with an `as`-aliased sink trips two checks, but a new file with a
*value*-aliased sink trips **only** `EXPECTED_SOURCE_FILES`. Bumping that pin
50 → 51 — exactly what its failure message instructs, and the correct action
almost every time it fires — takes the raw sink fully green. The message names
the edit, not the decision.

**MEDIUM-1** — `.mts`, `.cts`, `.jsx` are filtered out before `files` is built,
so a raw sink in one of them trips *no* pin at all, not even the count. Worse
than the new-`.ts` case.

**MEDIUM-2** — the scan matches comments and string literals. A comment saying
*"never import unsafeHTML as something else"* turns the suite red. The most
likely person to trip the guard is the next developer documenting it.

**LOW-1** — the false-positive control the brief calls deliberate,
`import { html } from 'lit/static-html.js'`, is **not in the tree**. I injected
it and confirmed the guard correctly stays green, so there is no defect — but
nothing in the repo exercises the boundary.

## The generalisable point

Each round has closed the *named forms* of the previous finding rather than the
class behind it. Round 2 found aliasing; round 3 banned `as`-aliasing,
namespace imports and re-exports — and value-aliasing walks through. The fix
should be stated as a rule about how the directive may be **used** (the name may
appear only immediately followed by a call paren), not as another list of
spellings to ban, or round 4 finds a sixth spelling.

That applies to my own remedy too. My round-2 snippet was right about the defect
and partial about the fix; I have not implemented and re-mutated the
negative-lookahead rule I propose here, so it should be re-attacked after
implementation rather than accepted because it cites this entry.
