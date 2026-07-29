# 2026-07-29 — Instrument classification for the `remote_data` consumer axis

**Leg:** read-only audit of *what the earlier searches were able to see*, not a re-search for
consumers. Brief: `reports/xss-instrument-audit.md` (briefs dir), plus two amendments at
06:12:02Z (two-axis classification; population cut-off).
**Deliverable:** `reports/xss-instrument-classification.md`.
**Nothing built, nothing run, no build token requested.** Cut-off 2026-07-29T06:12:38Z.

## Why this leg existed

Six rounds recorded negatives on "does anything consume `remote_data`". At 05:47Z
`reports/xss-r5-consumer-population.md` reported a capability-gate consumer
(`capabilities.ts:98` / `ft-app.ts:256` reading `collection.remoteData.writable`) and stated
that a render-sink search was *structurally incapable* of finding it, "which is why three legs
missed it". The coverage claim for the axis was put in question and this leg was dispatched to
classify each earlier negative's instrument.

## Result

**The premise did not survive the record.** The consumer was found, named by `file:line`, and
correctly described as a capability gate in **every round from r1 onward** — `audit-xss-r1.md:495`,
`review-xss-r1.md:178`, `audit-xss-r2.md:179`, `audit-xss-r3.md:152`, `review-xss-r3.md:90`,
`test-xss-r3.md:104`, `audit-xss-r4.md:101`, `review-xss-r4.md:318` — and by the **round-5 audit
leg 29 minutes earlier** (`xss-r5-audit.md:401`: "I found this while establishing (for F1) that
`remote_data` is never rendered — the only two reads turned out to be a permission decision").

Two related claims in the 05:47Z report are also unsupported: the capability-flag *reframing*
was filed at 03:00Z as `audit-xss-r4.md:2661` (XSS-R4-C5) off a third, server-side consumer
(`graph_support.go:26-27`, `RemoteData["graph_queries"]`) that the 05:47Z report does not
mention and that `importtrust-f7d.md:704` found independently at 04:08Z; and `internal/decomposer`,
described as "which nobody had named", is named at `audit-xss-r4.md:1738`.

## Counts as of cut-off (27 negatives; not totals for the axis — a round is open)

- Axis A: **EXPLICIT 24 · UNDETERMINABLE 2 · NOTHING-RUN 1**
- Axis B (plural, over the 24 explicit): **CONSUMPTION 17 · RENDERING 7 · IDENTIFIER 6**

`U` was pre-registered as the expected common answer and came in at 2 of 27. Neither was
upgraded.

## Sixth cell proposed — `P` PREDICATE-NARROWED

The instrument was consumption-keyed and *did* enumerate the consumers, but the negative was
**recorded** against a rendering-keyed predicate ("no sink", "reaches no href"). The consumer is
present in the report's evidence and absent from its conclusion. Applies to 4 rows. This — not
instrument blindness — is the mechanism that produced the six-round illusion, and it is a defect
in summarisation and reading rather than in any leg's search.

## Brief-scoping

`briefs/audit-xss-r3.md:53-56` explicitly mandated a rendering-keyed instrument ("enumerating
every path by which server-held data reaches a rendered URL context") and is the direct cause of
`audit-xss-r3.md:554`. The **same author corrected it at r4**: `briefs/audit-xss-r4-checklist.md:40-48`
asks the consumption question directly, and r4 produced the strongest consumer work on the axis.

## What is genuinely unsigned

- `.design/project-log/url-scheme-validation-stored-xss.md:63` — "Not covered, deliberately:
  `Collection.remote_data` (reaches no `href`)" — **no stated instrument**, and it is the origin
  of the chain. The other half of that same sentence was audited in r2 and found to have been
  "justified against dead code". The half that seeded this axis has never been checked.
- `reports/design-external-store-brainstorm.md:60` — "No code except convert.go inspects it" —
  no stated instrument, and false against both trees read.
- `reports/dev-xss-url.md:98-100` and `reports/audit-xss-r3.md:554` — rendering-bound with no
  consumption-keyed sibling in the same leg.
- `reports/dev-xss-r4.md:597` — relayed AUTHOR-CLAIM, self-labelled.

## Tree hazard recorded

`/workspace/farmtable` is on `task-state-web-ui-v2` at `633f8f2` and **does not contain the xss
project-log entries**. The correct tree for this axis is `/workspace/farmtable-xss-r6-fix`
(`url-scheme-validation-r6`).

## Correction 07:02Z — I made the error I was auditing

I originally recorded that the EM's population command was blind to ten
`.preimage-review-194-r11-b*.md` files because `ls -1` omits dotfiles. **Retracted.** Those
filenames contain neither "xss" nor "remote", so the *name pattern* excludes them;
`ls -1a | grep -iE 'xss|remote'` returns the identical set. I inferred a cause from a count
(`grep -c '^\.'` → 0) without checking the content — a negative read off an instrument's summary
instead of its content, which is the `P` failure this very report names. No conclusion moves;
the diagnosis was wrong. Full detail in §8 of the report, with a self-audit of which of my nulls
lack positive controls (two do).

Also recorded there: the population moved 24 → 28 between 06:12Z and 07:00Z, changing between
two invocations of the same command seconds apart. The open round's `xss-r6-fix.md` landed at
06:39Z and remains outside this classification.

## Open round

The r6 fix leg is live — worktree HEAD moved `ba09244` → `1b29165` during this read. Its B1–B10
negatives are **outside this classification and unclassified**. B11 is exempt per the EM and was
not inspected.
