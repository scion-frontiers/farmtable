# LEG BRIEF — test review, #195 round 6

Read the shared brief first:
`/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-195-r6-review-shared.md`

- **Your clone is mounted AT `/workspace`.** Branch `markdown-sanitize`, verify
  `git rev-parse HEAD` == `86f30bcdc699367681ccffbc4fde1e40006fd754`.
- **Scratch dir (yours alone):**
  `/scion-volumes/scratchpad/projects/farmtable/salvage/r6-test-195/`
- **Report to:** `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r6.md`

`markdown.test.ts` moved 638 lines. Check count went 61 → **69**. Volume is not
coverage. Your job is to find what all of it still cannot see.

## Charges

**1. THE PRIORITY CHARGE — what inputs can these fixtures not express?**

The two best findings of the last two rounds came from this question and
**neither was reachable by asking "what mutation survives"**: the `renderMarkdown`
arity bypass, and the #194 label-set cardinality bypass. In both cases the
fixture was not weak on the axis — it was *silent* on it, so no mutation could
produce a failure because nothing ever tried. The generalization the coordinator
signed off on: **an argument list is a collection, and the suite tested exactly
one point on that axis.**

So: **find the next collection whose cardinality is pinned at one.** Candidates
to start from, then go past them:

- `REQUIRED_SINKS` and `BANNED_SINKS` — is any test run with 0, 2, or N entries,
  or does every fixture inherit the production constant?
- The sink *file set*: does any fixture contain two sinks in one file? Two calls
  on one line? A sink inside a template literal or a nested function?
- The DOMPurify config object: does any test vary it, or is it a constant every
  fixture inherits (this is the #194 `LabelConfig.Stages` shape exactly)?
- The `renderMarkdown` return: always consumed as a string by one caller shape?

**2. `EXPECTED_CHECKS` is now derived in code** from
`EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1)`. This is the unifying
defect's exact silhouette: a check that derives from the thing it is checking
cannot falsify it. **Establish by execution** whether this pin can still go red
for the edits it is supposed to catch — add a sink, remove a sink, delete a check
call, duplicate one — or whether the arithmetic now absorbs the change. Round 5
of this same workstream produced a vacuous enum guard *inside a test written to
catch other instances of this class*; assume it can happen again here.

**3. Independently reproduce Leg 3's control.** The developer ran 4 mutations
against `53296af` to prove round 5 was actually GREEN before claiming round 6
turned them RED, and reports T1/F1/T3/T2 all GREEN→RED. **Asserting is not
measuring.** Reproduce both halves yourself. Content-addressed mutations only —
never line-addressed; abort if the anchor is not unique. Backups outside the
repo; after restore assert `git status --porcelain` empty **and** sha256 against
an out-of-repo pristine copy — *"clean" is not "unchanged."* Capture exit codes
from the child, never through a pipe. Then run their other 16 revert-the-fix
mutations and the 4 real-tree repros, and go past all of them.

**4. Are any of the new checks deletable-green?** Ablation-pair the 8 added
checks and any of the 61 the round rewrote. Round 5 of this workstream had seven
checks with no unique coverage. A test with no unique coverage is a maintenance
cost that also inflates confidence — and the count is now load-bearing (charge 2),
so a redundant check is worse than neutral here.

**5. T3 removed `IGNORE_MARKER`.** No test may depend on it, obviously — but check
the harder thing: did any *cell* disappear along with it? A rename or removal that
drops an assertion is a test that disappeared instead of failing. Verify by cells,
not by test names.

**6. The four production items each need a red-on-revert.** `slot` in
`FORBID_ATTR`, the non-string guard, the `^3.4.12` floor, the URI-policy pin. For
each: is there a test that goes red if it is reverted? The dependency floor
probably has none and probably cannot have one — if so, say that explicitly
rather than letting it pass as covered.

**7. Verify the developer's costly disclosure rather than crediting it.** They
wrote: *"I very nearly shipped the insufficient arity fix"* — i.e. my briefed
one-liner, which `renderMarkdown(md, opts = {})` walks straight past because
`Function.length` stops at the first defaulted parameter. That disclosure is the
trust signal and I want the *fix* checked, not the candour: does the three-sided
closure (`Function.length` + declaration-text scan + top-level-comma rejection)
actually go red for `(md, opts = {})`, `(md, ...rest)`, and `(md, {inline} = {})`?
Add the two-argument case to the acceptance vectors if it is not already there.

Report per the shared brief's structure. Mark findings **BY EXECUTION** or
**REASONED**, and state plainly what your harness could not express. **Commit
locally, do not push, do not modify production code.** You MUST write
`test-195-r6.md` and then mark the task complete.
