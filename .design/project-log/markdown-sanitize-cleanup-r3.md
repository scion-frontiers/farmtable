# #195 markdown-sanitize — round 3 cleanup (close the G1 sink-binding gap)

**Branch:** `markdown-sanitize` · **Base:** `5daace4` · **Head:** `9932eff`
**Scope:** test-file-only. No production code changed on this round.
**Gate:** `npm ci && npm test` on jsdom **26.1.0** (the locked version), plus
`tsc --noEmit`, `npm run build`, `npm audit --audit-level=low` — all exit 0.

## Why this round existed

Round 2 came back split: the security auditor approved, the test engineer
requested changes. Both found the *same* weakness in the G1 sink-binding guard
and rated it differently — Low ("defence in depth; no such sink exists today")
versus High. The EM ruled with the test engineer, on grounds worth recording
because they generalise:

1. G1 did not do what its specification said. It was asked to prove that
   `ft-inspector-comments.ts` and `ft-inspector-desc.ts` still route through
   `renderMarkdown`; it asserted two tree-wide properties and never named either
   file. That is an unmet deliverable, not a quality preference.
2. The stronger mutation changed the severity. Every audit mutation *added a new
   file*. The test engineer's `M-G1-10` aliased the import inside the **real
   named sink** and rendered attacker-controlled `c.body` completely raw, with
   the sink count preserved so the `>= 2` floor still passed — `49 checks
   passed`, exit 0.
3. A guard that is trusted and wrong is worse at a merge gate than no guard.
   G1 had been cited as evidence by three reviewers.

**No live vulnerability existed at any point.** Both real sinks were correctly
wrapped before this round and still are. This was a regression-detection gap.

## What changed

| Item | Commit | Change |
|---|---|---|
| T1 + T3 | `849a9da` | Read each required sink by explicit path; ban aliasing; pin sink count to `REQUIRED_SINKS.length`; pin scanned-file count exactly at 50 (was a floor of 10 under an actual 50) |
| T2 | `fa41008` | Banned-sink list widened from 4 to 8 forms; scan widened past `.ts` |
| T4 | `951ee89` | Three container payloads split into three `check()` calls |
| T6 | `64187a0` | `formaction` check renamed to say it asserts the tag rule |
| residuals | `96d26a5` | Two alias bypasses found in my own T1 guard, closed |
| docs | `9932eff` | Static/runtime check-count arithmetic stated precisely |

`EXPECTED_CHECKS` 49 → **54**. There are 53 literal `check()` call sites; the
extra runtime check comes from the `REQUIRED_SINKS` loop.

## Verification

Every mutation was run green → red with pasted output, before and after the fix.
Full transcript in
`/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-cleanup-3.md`.

- 9 mutations that previously passed at exit 0 (`M-G1-3`, `M-G1-4`…`M-G1-9`,
  `M-G1-10`, `D-1`) now all fail at exit 1.
- The 2 mutations G1 already caught (`M-G1-1`, `M-G1-2`) are still caught.
- **Independence check:** the six T2 vectors were re-run injected into an
  *existing* file, so the file-count pin stayed at 50 and could not be what
  caught them. Each was caught by the banned-sink check alone, naming the
  specific sink. This matters — in the add-a-file form, two checks fire, and
  without this second run I could not have claimed the sink guard itself works.
- **False-positive control:** `import { html } from 'lit/static-html.js'` is a
  legitimate non-sink import and stays green.

## Process notes (both were standing hazards for this workstream)

- **Mutations addressed by content, never by line number.** The test file was
  edited repeatedly this round, so every line number in both round-2 reports
  went stale after the first commit. The harness substitutes literal strings and
  **hard-fails (exit 98) if a substitution matches nothing** — verified
  deliberately, because a non-applying mutation otherwise reports a false
  SURVIVED indistinguishable from a real finding.
- **Restore is `cp` from `/tmp/mut-backup`, never `git checkout`.** A previous
  round reverted its own uncommitted fix this way; `git checkout` cannot tell a
  mutation from a fix. Every restore asserts `git status --porcelain` is empty
  and aborts the run otherwise. Each fix was committed *before* mutations ran
  against it.
- **`npm ci`, not `npm install`.** The auditor found reviewer clones on jsdom
  29.1.1 against a locked 26.1.0. This clone was already correct; `npm ci` was
  used regardless so the tree under test is the tree that ships.

## Found but not fixed

**Two alias bypasses in my own T1 guard — found by self-review, and fixed
(`96d26a5`).** Recording them because they are the most instructive part of the
round: the guard I had just written to catch aliasing was itself defeated by
aliasing, twice.

- `lit-html/directives/unsafe-html.js` — my first guard anchored on the `lit/`
  prefix. `lit-html@3.3.2` is installed and directly importable and exports the
  same directive, so the prefix was a one-word bypass.
- `unsafeSVG` / `unsafeStatic` aliases — these were in the banned *call* list,
  but aliasing renames the call, so the alias defeated that list too. Only
  `unsafeHTML` had alias protection.

The fix generalises over all three directives and bans the three renaming forms
(`X as Y`, `import * as ns`, re-export), matching module paths by suffix.

## Not done, and why

- **T5 (self-built-oracle recognition note)** — out of scope by the brief beyond
  a one-line comment. Added as a comment on the section-6 header rather than at
  a line number, since line numbers shift. The concrete aliasing gap it warns
  about is now closed by the per-file and anti-indirection checks.
- **CSP** — the highest-value follow-up per both reviewers. Needs its own issue
  and owner; explicitly out of scope. Unchanged by this round.
- **Component-rendering harness to replace the static scan** — Phase 2
  territory, deferred with both reviewers' agreement. The static scan remains a
  hand-rolled stand-in for the module graph, and the section-6 comment now says
  so plainly. Whoever picks up the harness inherits this.
- **`optgroup`** — closed by EM ruling; both reviewers independently probed for a
  primitive and found none. Not reopened.
- **T7 (`EXPECTED_CHECKS` pins count, not content)** — inherent to a count pin
  and explicitly not asked for. A check can still be gutted while staying
  registered. Manual mutation testing is the compensating control; recorded so
  the pin's guarantee is not overstated.
- **audit INFO-1 (beaconing via `![](url)`)** — pre-existing, inherent to
  supporting markdown images, not filed against #195. Belongs with the CSP
  follow-up where `img-src` is the right control.
- **The exact-count pins are deliberately brittle.** Adding any source file under
  `src/` now fails the suite until `EXPECTED_SOURCE_FILES` is updated. That is
  the point — the previous floor of 10 sat under an actual 50 — but it is a real
  maintenance cost and the failure message says explicitly what to do.
- **`.innerHTML ==` would match the banned pattern.** `\+?=` also admits a
  comparison operator. Accepted: a false positive here fails loudly and is
  trivial to resolve, whereas a false negative is the defect this round exists
  to fix.
- **`go vet`/#199, #193, #196 sourcemaps, Phase 2** — other branches.

## Handover

Commits are local on `markdown-sanitize`; **not pushed** (project rule — the
manager pushes). Head `9932eff`, tree clean.

One clone-hygiene note for the next agent: `/workspace` is not itself a git
repository — it is the parent of ~35 sibling clones, and the branch name
`markdown-sanitize` currently resolves to **three different commits** across
`farmtable-markdown-sanitize` (`5daace4`, the dev clone, correct),
`farmtable-review-195` (`5daace4`) and `farmtable-audit-195` / `farmtable-test-195`
(`9db3e9d` / `04abbe7`). Verify the commit, not the branch name.
