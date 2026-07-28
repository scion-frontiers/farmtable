# markdown-sanitize — test review, round 2 on #195

Branch: `markdown-sanitize`, head `5daace4`, base `7a0f220`.
Reviewer: `test-195`. Ranges reviewed: `7a0f220..5daace4` (whole branch) and
`204af7e..5daace4` (the round-2 cleanup).

Follow-up to `.design/project-log/markdown-sanitize-cleanup.md`. I returned
**APPROVE** at `204af7e` in round 1. This entry records the round-2 verdict.

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r2.md`.

## Verdict: REQUEST CHANGES

Narrow basis. The sanitizer hardening is sound and I re-verified it by mutation.
The defect is in **G1, the sink-binding guard**: it does not bind the sinks.

Checks went 32 → 49. The number is largely meaningful — 14 of the 49 pin this
branch's own configuration decisions and the other 35 pin `marked`/DOMPurify
default behaviour as dependency-upgrade regression tests. But the two checks
that were supposed to close the sink-binding defect class do not close it.

## What the mutations proved

Method note: every mutation was restored from **file copies outside the repo**,
never `git checkout`, with a `git status --porcelain` assertion after each
restore that aborts if the tree is dirty. That is deliberate — `git checkout`
cannot distinguish a mutation from an uncommitted fix, which is exactly the
process error disclosed this round.

Load-bearing, verified by breaking each one:

- All 8 `FORBID_TAGS` entries (`form`, `input`, `button`, `select`, `textarea`,
  `option`, `dialog`, `style`).
- 3 of 5 `FORBID_ATTR` entries (`style`, `class`, `download`).
- All 4 checkbox-renderer behaviours (glyph, `U+FE0E`, `role="img"`,
  `aria-label`).
- The G7 check-total pin, verified independently by deleting a check outright.

G2/SVG coverage is **real, not shape-only**: `marked` passes every SVG payload
through verbatim, so the payloads genuinely reach DOMPurify, and removing
`'style'` from `FORBID_TAGS` fails all three SVG-style checks including all
three markdown-container variants.

## The G1 finding

The guard asserts two global properties — "at least 2 `unsafeHTML` call sites
exist" and "none has a non-`renderMarkdown` argument". It never asserts that
`ft-inspector-comments.ts` or `ft-inspector-desc.ts` are among them; neither
filename appears in the test file.

I aliased the import in `ft-inspector-comments.ts` to `unsafeHTML as rawHtml`
and rendered `c.body` raw — attacker-controlled markdown straight into the
shadow root, the exact regression the guard's own header comment says it exists
to catch. The suite printed `49 checks passed`, exit 0. A new file containing an
aliased raw sink, with both real sinks left correct, also passes green.

The companion `banned` regex misses six more vectors, including `.innerHTML +=`
— the same sink it is written to catch, missed because `\.innerHTML\s*=` does
not admit the `+` — and Lit's `unsafeSVG` and `unsafeStatic`, the two directives
a developer in this codebase would most plausibly reach for next.

**No live vulnerability.** Both real sinks are correctly bound today and no
production file contains a missed sink. This is a regression-detection gap.

## Third instance of "tests that disappear instead of failing" — found

Two occurrences, both in `sinkBinding()`:

- `sinks` is built by `matchAll` on the very regex under test
  (`markdown.test.ts:556`), then filtered at `:570`.
- `offenders` is built by filtering files through the `banned` regex under test
  (`:583-585`).

Both protect against widening and are structurally blind to narrowing. Every
green mutation above is an instance of this one defect. The floors meant to
mitigate it have the wrong headroom in both directions: `files.length` is pinned
at 10 against an actual 50, and `sinks.length` is pinned at 2 against an actual
2 — zero slack, which catches one mutation by luck and stops working the moment
a third legitimate sink is added.

A fourth, milder instance: `check('svg style stripped inside markdown
containers')` loops three payloads inside one `check()`, so deleting a payload
is invisible to G7. G7 operates one level above where that deletion happens.

## Fifteenth self-built oracle — none found, one pattern noted

No local re-implementation of the symbol under test exists. Every behavioural
check routes through the real exported `renderMarkdown`; the assertion helpers
are generic DOM scanners, not sanitizer logic.

Recorded for the next reviewer: the sink-scan regex is a hand-rolled stand-in
for the TypeScript module graph, and it has the same failure signature as a
self-built oracle — it disagrees with real semantics on aliasing, and the test
believes the oracle rather than the language. Not called as a confirmed
fifteenth; the source-scan approach is defensible and a component harness is
Phase 2's job.

## Disclosures

**The `git checkout` process error — final state confirmed correct**, not taken
on trust. No `check(` line is removed anywhere in branch history; all eleven
deleted lines in `f202448` are deliberate upgrades with mutually consistent
stronger replacements; `grep -c` gives 49 checks matching `EXPECTED_CHECKS`; and
decisively, every element a partial revert could have dropped fires under
mutation. A reverted test passes silently, but it also cannot fail under
mutation — and all of them did.

**U+FE0E as an escape is runtime-identical**, confirmed by comparing codepoint
sequences and by inspecting real `renderMarkdown` output (`2610 fe0e`,
`2611 fe0e`). Upholding the dev's departure was right.

**`optgroup`** — probed rather than assumed, and no primitive found. `label` is
rendered only by the `<select>` widget; with `option` forbidden the element is
inert. Supports the EM's out-of-scope ruling; no change.

## Required before merge

T1 (bind the named sinks per-file, and assert the import is unaliased) and T2
(widen the banned-sink regex). Both are test-file-only, roughly ten and one
lines, and neither touches production code. T3 largely resolves itself once T1
reads required sinks by explicit path.
