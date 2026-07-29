# Brief — audit-195-r7: independent security audit

## Your tree

`/workspace/farmtable-195-r7-audit`, detached at `7b4f6dd`.

**[MEASURED by me, just now]** The round-7 range is `86f30bc..7b4f6dd`. Do NOT use
`89306d0` as a base — it is a sibling commit, not an ancestor
(`merge-base(89306d0, 7b4f6dd) = 86f30bc`), and diffing against it fabricates a 68-line
"deletion" that never happened. Verify the ancestry yourself:
`git merge-base --is-ancestor 86f30bc 7b4f6dd`.

## What this code is

`web/src/util/markdown.ts` is the **XSS sanitization boundary** for the dashboard. It is
the only thing standing between markdown from GitHub issues and the DOM. Treat it
accordingly: this is a security control, and the whole issue exists because a HIGH
severity XSS was found in this area earlier in this phase.

## How to read this brief

Every claim is tagged **[MEASURED]** or **[CLAIM]**. Verify any **[CLAIM]** you rely on.
**Telling me this brief is wrong is a first-class deliverable** — last round on a
sibling issue, the audit leg caught a factual error in my brief by predicting the
underlying mechanism and measuring it. That was the single most valuable thing in the
round. Do that again.

Be aware of a specific trap: two other legs are auditing this same tree under different
charters. If you find yourself agreeing with a premise **I** supplied, that agreement is
worth nothing — it is my claim echoing back, not independent confirmation. Agreement is
only evidence when it is DERIVED, not when it is handed to you.

## What I am asking you for

A security audit with severity classification. Specifically:

1. **Can anything reach the DOM unsanitized?** Enumerate the sinks. Do not accept the
   guard's own accounting of the sinks it covers — that is a check deriving from the
   thing it checks, which is the exact defect class this whole workstream keeps hitting
   (nine instances so far).
2. **[MEASURED]** The sink guard is REGEX-based. A regex guard over a programming
   language is an approximation. I want a concrete assessment of what it misses:
   construct inputs that are real sinks the regex does not match. There is an open
   follow-up to replace it with an AST rule; **evidence of a concrete escape would
   change that item's priority**, so this is worth your time even though the
   replacement itself is out of scope for r7.
3. **[CLAIM — verify]** Round 7 claims to have brought `web/index.html` into the scanned
   set and to have made a "sunset clause" and a "dependency floor" fire. Check whether
   the scanned set is now actually complete, or merely larger. "We added one more file"
   and "we cover everything" are different claims and the first is often reported as
   the second.
4. **DOMPurify/marked ownership**: r7 records an ownership asymmetry between these two
   dependencies. **[CLAIM]** Verify what that asymmetry actually permits. Configuration
   of a sanitizer is part of its attack surface — a correctly-called DOMPurify with
   permissive options is not a control.
5. **Supply chain**: version floors on the sanitizer's dependencies, and whether a
   downgrade would silently pass.

## Standing bars

- **Positive control before any negative claim.** A grep or scanner that has never
  returned a hit cannot support "no occurrences". Show it finding something first.
- **Any harness must ABORT on a failed prerequisite**, never continue and report green.
  Eleven void harnesses on this workstream printed clean, confident, wrong numbers.
  The only detector that has ever caught one is *a number contradicting something
  visible*.
- **Exit codes from the child process, never through a pipe.** `npm test | tail` gives
  you `tail`'s exit status. Made twice here already.
- **Predict counts BEFORE measuring them.** Write it down first, then measure. Last
  round the audit leg predicted "8 spellings per stage" from the mechanism before
  counting, measured 8, and thereby caught an error in my brief that a leg counting
  first would have rationalized.
- **A confirmed lower bound is not a count.** "At least N" reported as "N" is its own
  failure mode and it has bitten this workstream.
- **Costly disclosure is the trust signal.** Name what you could not verify and stop.
  Do not reason onward from an unverified limit — that mistake produced a wrong
  production-security determination on this workstream, where asking first would have
  cost eleven minutes.
- **Do not push. Do not modify production code.** Your independence depends on it.

## Required report sections

Write to `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r7.md`:

1. **VERDICT**: APPROVE or REQUEST CHANGES.
2. **FINDINGS** with severity (Critical/High/Medium/Low/Info), each with file:line, a
   concrete PoC or the reason one could not be built, and a recommended fix.
3. **C-A — what I could not verify**, and what would falsify each.
4. **C-B — the finding you are least sure about.**
5. **WHERE THIS BRIEF IS WRONG**: if nothing, say so explicitly.

You MUST write that report file, commit a project-log entry in `.design/project-log/`,
and then mark the task complete. Do not stop after the analysis.
