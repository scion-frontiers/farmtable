# #195 markdown-sanitize — round 6 TEST REVIEW

**Target:** `markdown-sanitize` @ `86f30bcdc699367681ccffbc4fde1e40006fd754`
**Leg:** test review (one of three independent legs; the other two legs' reports
and working files were not read).
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r6.md`
**Harness + raw results:** `salvage/r6-test-195/` (62 mutations, 6 batches, plus
a round-5 control tree extracted out of the repo via `git archive 53296af web`).

## VERDICT: REQUEST CHANGES

Gate reproduced independently: `npm test` 0 (**69 checks passed**),
`npx tsc --noEmit` 0. No live vulnerability; both real sinks remain correctly
wrapped, and nothing below changes that. Every finding is about whether the
*guard* can still falsify what it claims to pin.

| ID | Sev | Finding |
|----|-----|---------|
| T-1 | High | The arity pin is GREEN for three ordinary spellings of a second parameter |
| T-2 | Medium | The derived `EXPECTED_CHECKS` absorbed a scope shrink that round 5 caught |
| T-3 | Medium | Every fixture table is emptyable with the suite green — F2/T4a one level up |
| T-4 | Low | The check total pins deletion of a check, not evisceration of one |
| T-5 | Low | `Function.length` has no unique coverage on any measured arity form |
| T-6 | Info | The `^3.4.12` floor has no red-on-revert and cannot get one here |
| T-7 | Info | `SANITIZE_DOM: false` is the one measured config widening with no signal |
| T-8 | Info | The private `Marked` instance has no pin; the shared singleton is green |

All findings **BY EXECUTION**.

### T-1 — the arity pin (`markdown.test.ts:566-576`)

`.exec()` returns the first match and the scan reads raw `readFileSync` bytes
rather than `stripInertText(src, {strings:true})` — this file's own
comment/string blanking is not applied to its own newest rule. Three mutations
of `markdown.ts` are GREEN at 69 with `tsc --noEmit` 0:

- two overload signatures + a defaulted implementation (a fully usable 2-arg API),
- a comment above the declaration quoting the old signature,
- a string literal containing the same text.

`(md, opts = {})`, `(md, ...rest)`, `(md, {inline} = {})` and the const-arrow
form are all correctly RED. The sink-side comma rejection still fires at the
live sink, so this is not a live hole — but "closed from three sides" is
falsified. Fix: `matchAll` over the stripped view, require exactly one match.

### T-2 — `EXPECTED_CHECKS` derivation (`markdown.test.ts:2391-2392`)

Charge 1's answer: **`REQUIRED_SINKS` is the collection whose cardinality is now
pinned by nothing independent.** Removing `ft-inspector-desc.ts` from
`REQUIRED_SINKS` and rendering `this.description` through a unicode-escaped raw
`unsafeHTML` alias is **GREEN at 68 checks, tsc 0**. Counterfactuals measured:
the identical mutation is RED with r5's hard literal `EXPECTED_CHECKS = 61`-style
pin restored, and RED without the escape (tree-wide tripwire). R7 is per-file
only, so shrinking `REQUIRED_SINKS` deletes the only rule the tree-wide scan does
not duplicate. Fix: one `EXPECTED_REQUIRED_SINKS = 2` assertion inside the
existing tree-scan check; correct the failure message at `:2408-2410`.

### T-3 — fixture tables (`:1884, 1916, 1937, 1980, 2111, 2288`)

All six are emptyable GREEN. A two-line pair — neuter the `document.write`
pattern **and** drop its one positive fixture — is GREEN at 69, restoring F2 for
that pattern inside the fix for F2. The positives check also asks `.some()`, so
per-pattern coverage is incidental rather than asserted. Fix: invert the
quantifier, and pin (or non-empty-assert) the tables.

## Confirmed, not findings

- **Leg 3's control reproduced in full**, both halves, content-addressed, on an
  out-of-repo r5 tree: T1/F1/T3/T2 all GREEN at `53296af` and all RED at
  `86f30bc`, each via the right rule. Untouched-tree controls GREEN in both.
  The developer's claim is verified by measurement.
- **No check is deletable-green.** Each of the 8 new checks is the sole falsifier
  for its target defect. The only redundancy found is inside a check (T-5).
- **No cell disappeared with `IGNORE_MARKER`.** Zero assertion cells, fixture
  entries or `SINK_EVASIONS` labels lost r5→r6; assertion cells 105 → 113. One
  fixture migrated `INERT_PROSE` → `BANNED_SINK_POSITIVES`, i.e. changed polarity
  from negative to positive — a strengthening.
- **Red-on-revert:** `slot` RED, `action` RED, non-string guard RED, URI policy
  RED, dependency floor **uncovered** (T-6, stated explicitly).
- **The costly disclosure is upheld.** `Function.length` alone really would have
  left T1 open; the developer was right to refuse the briefed one-liner. The fix
  they wrote instead is better and still incomplete.
- **False-positive controls hold:** IIFE-wrapped sink and a nested `String(...)`
  argument are both correctly GREEN; a second raw `unsafeHTML` in one file is RED
  via three checks.

## Limitations

No component was instantiated, so no runtime sanitizer *effect* was observed —
V23/V25 and T-8's effect-side remain Phase 2's. Mutations are exact-text
substitutions, so multi-file refactors were not expressible. The installed
DOMPurify was never varied, only the declared range. No new XSS vectors were run.
62 mutations is not a proof of absence.

## Integrity

Mutations content-addressed only, aborting unless the anchor occurs exactly once.
Backups outside the repo; after every run each touched file restored and verified
by sha256 against the out-of-repo pristine copy **and** `git status --porcelain`
asserted empty — "clean" is not "unchanged". Exit codes from
`subprocess.run().returncode`, never through a pipe. Driver validated with a
known-GREEN and a known-RED control before use. Final state: working tree clean,
HEAD unchanged, all five pristine sha256 UNCHANGED, gate still green. No
production code was modified; nothing was pushed.
