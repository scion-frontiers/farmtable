# markdown-sanitize round 10 — test-engineering review leg

**Reviewed:** `0b52dcd` on `markdown-sanitize-r10`, base `13680c2`, 15 commits.
**Verdict:** REQUEST CHANGES.
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r10.md`
(reports are not in this repository).

Zero production code in the round under review. `markdown.ts` byte-for-byte unchanged
(sha256 `c6b195f8…` verified before and after every probe). Diff is `markdown.test.ts`
**+1071 / −98** — note `--numstat`, not `--stat`, whose 1169 is insertions *plus*
deletions — plus one project-log file.

## Method

59 mutation cells through `/tmp/r10lab/mut.py`: aborts on a dirty tree, aborts unless
every anchor count is exact, runs `npm test` as a child process and reads `returncode`
from the child (never through a pipe), classifies any run containing `error TS` as
TSC-FAIL rather than as evidence, restores from an in-memory byte snapshot in a
`finally` (never `git checkout`), and re-asserts a clean tree afterwards.

- **Cells dirty after restore: 0 of 59.**
- `npm ci` run in this clone; no handed `node_modules`.
- Predictions stated before measurement: **46 made, 39 hit, 7 missed.** Two misses
  changed conclusions and are kept in the report.
- Gates before and after identical: `npm test` 0 (*83 checks, 131 assertions*),
  `tsc --noEmit` 0, `npm run build` 0, tree clean.

## What the round got right, measured

- The six evasion-table wraps work for the mutations they were built against:
  **11 of 11** neutering cells RED, every message naming its own table.
- The docblock's `break` refutation is correct. Verified independently in standalone
  Node: `break` runs the generator's `return()`, the trailing arm is never reached, the
  name is never recorded, and nothing throws. The census is what catches it.
- All six emptied-table REDs reproduce.
- **Over-strictness coverage is comprehensive and previously unclaimed: 10 of 10**
  mutations that make the sanitizer *too* aggressive go RED, each naming a specific
  check. This suite protects the product as well as the security property. I predicted
  GREEN five times here and was wrong five times.

## Why REQUEST CHANGES

`consumeFixtureTable` pins **delivery**, not **consumption**. It proves the loop was
handed every entry and yielded every entry; it cannot see whether the body did anything.

    markdown.test.ts:5066, first statement of the SINK_EVASIONS loop body:
    +      if (label) continue;

→ **GREEN, 83 checks / 131 assertions, `tsc --noEmit` 0.** Twenty-seven sink-binding
evasions unexercised. That is a *one-line, one-site* edit — cheaper than the
`.slice(0, 0)` mutation the round exists to close. The defect moved one level in.

Three more single-edit GREEN defeats: the census `Set` is keyed by name and two loops
share `OWNERSHIP_EVASIONS`, so it can only prove that one of them ran; `EXPECTED_FIXTURE_LOOPS`
has no size pin, unlike its sibling `EXPECTED_TREE_WIDE_CONTROLS` at `:4653`; and the
self-test feeds caller-controlled sentinel names into the same global `Set` the census reads.

Four of the round's **own** fixes (MUST 1 `REPORT_FROM_ORIGINAL`, MUST 4 `unsound`,
S6 `STRING_BLANKING_CONTROLS`, S10 `BANNED_SINKS`:4266) sit in loops still neuterable by
`.slice(0, 0)`, so the residual is not the "legitimate/false-positive mirrors" the report
describes.

## Counts

- **"Twenty-nine loops" is twenty-eight.** The recipe counted a prose spelling of itself
  at `:3288` — the exact defect this file documents at length at `:4459-4491`, having
  already committed it twice. This is the third. Also a unit slip: six *tables* are
  wrapped across seven *loop sites*, so 29 − 6 = 23 is not the right arithmetic; it is
  28 − 7 = 21.
- **83 vs 82 is not a discrepancy.** `EXPECTED_CHECKS = CALL_SITES + (REQUIRED_SINKS.length − 1)`
  and `REQUIRED_SINKS.length === 2`. Call sites 78 → 81 → 82 across `13680c2` → `e510d40`
  → `0b52dcd`, so checks 79 → 82 → 83. Both quoted figures are correct at their commits.
- **The two seventeens are different sets:** 11 shared, 6 out (the `*_EVASIONS` tables),
  6 in. The in-tree warning is accurate.

## Vacuity census (rule 22′), measured not reasoned

| region | guarded / total |
|---|---|
| wrapped evasion loops | 7 / 7 |
| unwrapped fixture-consumption loops | **8 / 23** |
| the new machinery itself | **0 / 4** attacks blocked |
| emptied-table declaration pins | 6 / 6 |
| over-strictness | 10 / 10 |

Rule 22′ holds with no exceptions across 23 loops: every guarded loop demands a *positive*
outcome (a rejection count, a perturbation counter, a planted-probe hit, a file total);
every unguarded one ends in `if (array.length > 0) throw`, which an empty iteration satisfies.

## Ruling: a file-count pin is not evidence of non-vacuity

Measured, not argued. Replacing 8 of `INERT_EXTENSIONS`' 14 entries with garbage
*count-neutrally* is **GREEN**; the positive control that moves the count by one is **RED**.
The pin's discriminating power is 6 of 14 entries — the six that occur in `src/`. It
establishes non-vacuity of the **enumeration**, not of the **table**, and with respect to
the claim it is offered for it is form (5), a post-hoc tally. Recommendation: require a
count-neutral corruption control before accepting any future count-pin RED.

## Largest unstated risk

`tsconfig.json` is `"include": ["src"]`, so `markdown.test.ts` is type-checked by
`npm run build`, which both the root `Dockerfile` and `Dockerfile.server` run. Nothing
anywhere invokes `npm test` — verified with a positive control (`npm run build` is found
at `Makefile:17`, `Dockerfile.server:6`, `web/README.md:153`; `npm test` appears only in
project-log prose, and `.github/` holds only issue templates). So this file is **always
compiled and never executed** by automation: a type error in it breaks the production
image, while a logic hole in it breaks nothing until a human types `npm test`. Ten rounds
of evidence rest on that habit.

## Also filed (out of scope for this round)

`BANNED_SINKS` is a spelling blacklist over source text: every pattern needs a contiguous
literal name adjacent to its call-paren or assignment operator. Four escapes measured live
in `src/components/ft-empty-state.ts` against attacker-reachable `this.heading`, with the
listed spelling as a RED positive control — property bag (`Object.assign(el, { innerHTML })`),
split literal (`el['inner'+'HTML'] =`), aliasing (`insertAdjacentHTML.bind`), and
`Reflect.set`. The split-literal trick is the same one `markdown.ts:109-114` already records
as a measured-and-closed bypass of the specifier rule; it is open here. Rule 24: the closure
is the closed-world identifier discipline `SINK_BINDINGS` already implements, generalised
tree-wide — not a longer list.

## Nothing changed

No production code modified. `markdown.ts`, `markdown.test.ts` and `ft-empty-state.ts` are
byte-identical to `0b52dcd` by sha256. Nothing pushed. This log entry is the only commit.
