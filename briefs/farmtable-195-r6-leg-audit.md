# LEG BRIEF — security audit, #195 round 6

Read the shared brief first:
`/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-195-r6-review-shared.md`

- **Your clone is mounted AT `/workspace`.** Branch `markdown-sanitize`, verify
  `git rev-parse HEAD` == `86f30bcdc699367681ccffbc4fde1e40006fd754`.
- **Scratch dir (yours alone):**
  `/scion-volumes/scratchpad/projects/farmtable/salvage/r6-audit-195/`
- **Report to:** `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r6.md`

If you reuse a harness from a prior round (`audit-195-r5-*.mjs` exist in the
shared salvage root), **copy it into your own directory first and record its
sha256.** Last round a leg's harness was overwritten mid-read by a concurrent
leg. That was my briefing defect and it is structurally fixed now; the discipline
is still yours.

## Charges

**1. PRIORITY — the production diff is the first change to `markdown.ts` since
round 2. Attack it directly, do not review it.**

Four items landed: `slot` added to `FORBID_ATTR`, a non-string guard, the
`dompurify` range tightened `^3.0.0`→`^3.4.12`, and a URI-policy pin.

- **Positive control first.** Before you report that anything is blocked,
  demonstrate your harness can observe an *unsanitized* string reaching output —
  patch a vector past the sanitizer in a scratch copy and show your probe goes
  red. Round 4's audit reported clean DENIEDs from a probe that could not have
  observed an ALLOW. A negative result from an unfalsifiable harness is not a
  result.
- Re-run the round-5 vector corpus (69 XSS + 10 mXSS) against head and confirm no
  regression, then extend it: does `slot` in `FORBID_ATTR` interact with anything
  DOMPurify does with shadow DOM or `<template>`? Does the URI-policy pin change
  the answer for `data:`, `blob:`, `javascript:` with entity/whitespace
  obfuscation, or protocol-relative `//evil`?
- **The non-string guard is a new parse on the security path.** `typeof md !==
  'string'` returns `''`. Probe boxed strings (`new String(x)`), objects with
  `toString`/`Symbol.toPrimitive`, and template-tag objects. Does any caller in
  the real tree pass a non-string today, and if so did this change silently blank
  live content rather than sanitize it? Blanking user content is not a
  vulnerability but it is a behaviour change at a boundary and it belongs in your
  report.

**2. The dependency pin.** `^3.4.12` is still a caret range — it does not pin, it
floors. Establish what a caret range actually admits here, whether the lockfile
is the real control, and whether anything enforces the lockfile at build time
(there is **no CI**; that is the relevant fact). Then check the DOMPurify 3.4.12
advisory surface: is 3.4.12 the current fixed version as of today, and is the
floor above every known bypass? Note the standing hazard that DOMPurify's default
export is a **shared singleton** — confirm nothing in the tree mutates the shared
instance's config in a way that leaks across call sites.

**3. Does the guard's own strengthening open anything?** T1/F2/T4a hardened
`BANNED_SINKS`, `sinkArgumentIsSanitized` and `stripImportStatements`. These are
build-time lint, not runtime defence — but they are the reason nobody re-audits
the sinks by hand. Ask the security question that follows: **what does a
successful bypass of the guard cost an attacker who already has commit access,
and what does it cost one who does not?** If the honest answer is that the guard
defends only against accident, say so plainly — that reframes the severity of
every guard finding in this workstream and I want it on the record once.

**4. Re-establish the live sink inventory yourself.** Do not accept
`REQUIRED_SINKS`. Sweep the real tree for every path where a string reaches
`unsafeHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`,
`Range.createContextualFragment`, or a Lit template interpolation into an
attribute/event position. Confirm each is wrapped, and confirm the *inventory
list in the guard matches what you found*. A guard that checks a hand-maintained
list is only as good as the list; that list is exactly the collection whose
cardinality nobody varies.

**5. Prototype pollution / the scan.** `audit-195-r5-protoscan.mjs` exists.
Re-run it in your own directory against head and report drift. The standing
disclosed survivor is that its acceptance rests on a dependency-tree property
that is true today and enforced by nothing. **Do not re-file it** — instead tell
me whether it is still true at this head, and what the cheapest tripwire would
be.

**6. Severity discipline.** The round-5 audit correctly *declined* to file
`ADD_ATTR:['style']` because `FORBID_ATTR` wins. Hold that bar: verify a green
mutation actually weakens the thing before filing it. Equally, if you find
nothing High, say so — an APPROVE with a tight limitations section is worth more
than a padded severity table.

Report per the shared brief's structure. Mark findings **BY EXECUTION** or
**REASONED**. **Commit locally, do not push, do not modify production code.**
You MUST write `audit-195-r6.md` and then mark the task complete.
