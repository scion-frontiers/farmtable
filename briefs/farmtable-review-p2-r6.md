# review-p2-r6 — review the Phase 2 round-5 fix delta

## What you are reviewing, exactly
Branch `phase2-web-ui-r5` in the canonical repo `/workspace/farmtable`.
Commit range: `b429a40..4f30c4e` — five commits.

    4f30c4e test(web): cover embedded credentials in the safe-url contract table
    d3e333a test(web): pin the error toast's HTML escaping
    d10450f test(web): bind the queue's partial-renumber emission
    4db6960 test(web): pin the cardinality of all four derived stage loops
    b429a40 fix(web): anchor the inspector's attention callout copy

Size: 10 files, 253 insertions, 15 deletions. Eight are test files. **Only two are
production code** — `web/src/components/inspector/ft-inspector-relationships.ts` and
`web/src/util/task-state-utils.ts`. Give those two the weight.

Do NOT review the other 33 commits on the branch. They were reviewed at `633f8f2` and
that review is closed. `61ca67e` is a project-log entry only — skip it.

## Why this range and no other
These five commits are the fix pass for the four blocking items raised by the phase 2
review, and **they have never been reviewed by anyone.** They were written, committed,
and then the branch ref regressed, leaving them as unreferenced objects in the repository
until I anchored them. So this is a first look, not a re-review.

The four items they claim to fix are H-1, M-2/F-2/ATT-03, M-3/F-1, and audit L-1. Read
the originals yourself rather than taking my summary:
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-phase2.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-phase2.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/dev-phase2-fixes-r5.md`

## The question I actually want answered
For each of the four items: **is it fixed, and is the test that claims to prove it capable
of failing?** This project's recurring defect is not broken fixes, it is tests that pass
whether or not the fix is present. A test added alongside a fix is the easiest place in
the world to write an assertion that cannot go red.

So for each new or modified test, tell me what would have to break for it to fail. If the
answer is "nothing reachable", say so — that is a finding, and it is the finding I most
want.

## Scope boundaries — do not expand
- Do not review CI, `.github/workflows/`, or `scripts/ci-suite-manifest.mjs`. The branch
  is currently red at a CI membership gate; that is another EM's defect, already routed,
  and it is not yours or mine.
- Do not review authorization, label writes, XSS or markdown sanitisation. Different
  workstream, different EM.
- Do not open a new axis of investigation. If you find something outside this range that
  worries you, write it in a clearly-marked SURFACED-NOT-CHASED section with a one-line
  description and stop there.

## Constraints
- Read-only on canonical. Do not commit, do not push, do not modify the branch.
- If you need to run tests, clone from the LOCAL PATH `/workspace/farmtable`, never the
  network remote, and work in your own tree.
- Do NOT run `npm run build` — it is `tsc --noEmit && vite build`, and vite build writes
  `web/dist`, which is forbidden. `npm test` in `web/` is fine.
- Do not create or delete any `web/dist` anywhere.
- Never print, log or echo a credential.

## Deliverable
A report at `/scion-volumes/scratchpad/projects/farmtable/reports/review-p2-r6.md`
containing:
1. A verdict: APPROVE or REQUEST CHANGES.
2. Per-item disposition for the four blocking items: fixed / not fixed / fixed but
   unpinned, each with the file:line and the reasoning.
3. For each new or modified test, the one-line answer to "what would make this fail?"
4. Findings with severity, if any.
5. A SURFACED-NOT-CHASED section, possibly empty.

Keep it proportionate. This is a 253-line delta, mostly tests. I do not need five hundred
lines back — I need the four dispositions to be right.

## Termination
You MUST write the report to that exact path and then mark the task complete.
