# #195 markdown-sanitize round 6 — SHARED review brief (all three legs)

**Target:** branch `markdown-sanitize`, SHA
`86f30bcdc699367681ccffbc4fde1e40006fd754`. Verify with `git rev-parse HEAD`.
**The branch name is not the identifier; the SHA is.**

You are one of **three independent legs** running in parallel (code review,
security audit, test review). **Do not read the other legs' reports or working
files.** Your value is that you did not.

**Your clone is mounted AT `/workspace`.** Ignore any host-style
`/workspace/farmtable-*` path; it does not exist inside your container.

## Isolation

Write scratch artifacts **only** to your own salvage subdirectory, named in your
leg brief. Last round a leg's harness was overwritten mid-read by a concurrent
leg writing to a shared directory — my briefing defect, now structurally fixed.
If you reuse a harness from a prior round, copy it into your own directory first
and record its sha256. If you find yourself reading a file whose header discusses
this round's findings and you did not write it: stop, close it, disclose it.

## How to run the suite — read this or you will file a false finding

**This is NOT a vitest suite.** I wasted a cycle on that. It is a plain node
script compiled by `tsc`:

```
cd /workspace/web && npm test
   # = tsc -p tsconfig.test.json
   #   && node .tmp-test/utils/task-ready.test.js
   #   && node .tmp-test/util/markdown.test.js
```

`npx vitest run src/util/markdown.test.ts` reports **"No test suite found"** —
that is the wrong runner, not a defect.

## My gate, reproduced independently

```
npm test        exit 0   — "markdown sanitizer: 69 checks passed"  (was 61)
npx tsc --noEmit exit 0
```

## Context: what this round fixed

Round 5's three legs returned APPROVE (security) / REQUEST CHANGES (code) /
REQUEST CHANGES (test). **No live vulnerability existed at any point** — both
real sinks were correctly wrapped before this round and still are; the round-5
audit found no XSS across 69 vectors plus 10 mXSS vectors. Round 6 is regression
detection plus four small hardening items.

Blocking items closed: **T1** (arity — `renderMarkdown(body, {inline:true})` was
unreachable by any fixture), **F1** (`stripImportStatements` `[^;]` matched
newlines and one import swallowed the next), **F2/T4a** (`BANNED_SINKS` was
emptyable with the suite green), **T2** (unterminated `<!--` blanked to EOF),
**T3** (`IGNORE_MARKER` removed), **T4b**, **C1** (exit criterion restated in
artifact terms), **C2** (sunset clause), **T7**.

**First production change since round 2**: `slot` added to `FORBID_ATTR`, a
non-string guard on `renderMarkdown`, `dompurify` range tightened
`^3.0.0`→`^3.4.12`, and a URI-policy pin.

The developer's log is `.design/project-log/markdown-sanitize-cleanup-r6.md`.
**Read it, and treat it as a claim to be checked, not as a finding.**

## Standing bars

1. **A check that derives from the thing it is checking cannot falsify it.** The
   unifying defect of this workstream.
2. **Every negative claim needs a control that fails closed.**
3. **"Clean" is not "unchanged."** sha256 against an out-of-repo pristine copy.
4. **Mutations content-addressed, never line-addressed.** Abort if the anchor is
   not unique. Exit codes from the child, never through a pipe.
5. **A fixture that cannot express the input is not evidence.** Ask what inputs
   the tests *cannot* express. This is how T1 was found, and it was invisible to
   five rounds of "what mutation survives."
6. **Verify a green mutation actually weakens the thing before filing it.** The
   round-5 audit correctly declined to file `ADD_ATTR:['style']` because
   `FORBID_ATTR` wins — green was correct.
7. **Costly disclosure is the trust signal.**
8. **A narrower true claim beats a broader unverified one.**

## Deliberately OUT of scope — do not re-file

- **M1, the allow-list inversion** (157 tags permitted, markdown emits 22; 36 of
  46 blocked vectors blocked by DOMPurify *defaults*). Agreed and tracked; it is
  a rewrite of the live XSS boundary and needs its own round, not a ride inside a
  cleanup.
- **CSP / Trusted Types** — do not exist; tracked.
- **#204** (replace the regex guard with a typescript-eslint AST rule) — tracked;
  the sunset clause names what it retires.
- **V25 and the bare non-relative specifier** — disclosed survivors routed to the
  Phase 2 harness.
- **The V25 rationale can rot** — its acceptance rests on a dependency-tree
  property true today and enforced by nothing; the fix is promoting the scan into
  CI. Tracked.

If you believe any of these is materially worse than recorded, say so. Restating
it at its known severity is not a finding.

## Deliverable

- **VERDICT: APPROVE** or **REQUEST CHANGES**, up front.
- Severity table (Critical / High / Medium / Low / Info).
- Findings with `file:line`, evidence, recommended fix.
- Mark each **BY EXECUTION** or **REASONED**.
- Methodology / disclosures / limitations: what you did **not** establish, what
  your harness could not express, anything compromising your independence.
- Commit a short project-log entry in your clone. **Commit locally. Do not push.
  Do not modify production code.**

You MUST write your report file and then mark the task complete.
