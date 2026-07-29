# review-xss-r2 — code review, url-scheme-validation-r2 @ 0bc9b72

Read `_xss-r2-baseline-block.md` in this directory first, in full. It is your tree, gates and rules.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r2.md`.

## What this round is

Round 1 on this branch found a CRITICAL (the production container build was broken — `npm run build`
exit 2, and `Dockerfile.server:6` runs it) plus a set of tests that could not fail. `dev-xss-r2`
fixed them across 10 commits. **Its own report is at
`reports/dev-xss-r2.md` and you should read it — but read it as a set of claims to check, not as a
description of what happened.** The round-1 reports (`review-xss-r1.md`, `test-xss-r1.md`,
`audit-xss-r1.md`) are there too.

Your verdict is APPROVE or REQUEST CHANGES on `d4c4e6b..0bc9b72`.

## Your axis, and what is explicitly NOT your axis

You own **correctness, architecture, readability, and whether the code says true things about
itself.** The mutation work is the test leg's axis and the threat modelling is the audit leg's.
Where you suspect a test cannot fail, **say so in one line and move on** — do not build a mutation
matrix.

I am spelling that out because of how I will read your report. Last round I gave a review leg this
same instruction and it approved a mechanism, and a parallel leg then measured that mechanism
CRITICAL-broken. Both were right. **I do not get to treat your approval of something outside your
axis as corroboration, and you should not offer it as one.** If you form an impression outside your
lane, label it as an impression.

## Specific things to examine

**1. Four deliberate deviations from what round 1 asked for.** The dev leg declined four
instructions and documented why in each case. Judge each on its merits — a well-reasoned refusal is
a better outcome than compliance, and I would rather you overturn one than rubber-stamp all four:

- `SetTestGraphQLClient` was asked to move into `export_test.go`. The leg measured that this **does
  not compile** (`vet: internal/server/passthrough_e2e_test.go:111:13: undefined:
  ghplatform.SetTestGraphQLClient` — the callers are in `package server_test`) and shipped a
  `testing.TB` parameter instead. Is the `testing.TB` marker a real constraint or a speed bump?
- `ALLOWED` scanner entries were asked to carry pinned line numbers. The leg shipped a
  **uniqueness** assertion instead, arguing pinned numbers churn on every edit above the binding.
- `pr["url"]` at `convert.go:358-363` was **not** given the read-path validation that `remote_url`
  got. The stated reason is that a silent server-side drop would make legacy rows *vanish* rather
  than degrade to visible inert text.
- Test files were **kept inside** `tsconfig.json`'s type-check surface, when excluding them would
  also have made `npm run build` pass. Stated reason: type-checking the tests is what made the
  original breakage loud instead of invisible.

**2. The R4 test-runner rewrite, which was not on the list.** The leg replaced two hand-maintained
registries (`tsconfig.test.json` `include`, and an `&&` chain in `package.json`) with
`scripts/run-tests.mjs` doing glob discovery and a two-way cross-check. Its justification is that it
was about to add two test files into a trap where forgetting either registry made a file silently
not run.

I think the justification is sound and I am not asking you to relitigate *whether* to do it. I am
asking whether the replacement is **correct**: does the two-way cross-check actually close both
directions, does `rm -rf .tmp-test` reliably prevent a renamed test leaving a stale passing `.js`,
and does reading exit codes off the child process hold everywhere in that script. This is now the
only thing standing between a test file and never running, so it is infrastructure.

**Relevant and possibly load-bearing:** this file is also the mechanism at the centre of task #103,
a known merge collision between this branch and the #195 markdown branch, whose `npm test` lists are
mutually exclusive such that resolving the conflict either way silently deletes a whole suite at
exit 0. Glob discovery *may* dissolve that collision. **Do not go look at the other branch** — it is
out of your scope and I do not want your reasoning entangled with it. Just tell me whether
`run-tests.mjs` would discover an arbitrary new `src/**/*.test.ts` with no configuration edit, which
is the property I need.

**3. The one production behaviour change outside `convert.go`.** Writing an F10 assertion exposed
that `UpdateTask` reported `invalid add_pull_requests.url` with **no index**, while the import path
already included one. Fixed in `server.go`. Check the fix, and check whether the error message now
leaks anything it should not.

**4. `convert.go::taskToProto` — validate-on-read that DEGRADES.** `remote_url` is synthesised from
the GraphQL response on every `ListTasks`/`GetTask` and never persisted, so the leg argues no
write-boundary check can structurally reach it. It drops the field rather than erroring. Is
`taskToProto` genuinely the single convergence point for every read? That is the load-bearing claim
and it is the kind of "this is *the* chokepoint" statement I have personally gotten wrong twice this
week by naming one site when there were three.

**5. Comments that make claims.** This branch has a history of them, and form (7) — a comment
documenting a measurement as a property — has appeared in three consecutive rounds on the sibling
branch. `safe-url.ts` had a false claim about `http:/\/\evil.com` which is now corrected in place;
its docblock at 17-19 states a **two-list** invariant between the client and server guards. Check
every comment the diff adds or edits against what the code does. Where a comment states a property,
ask whether it is a property or a measurement wearing a property's clothes.

## Method notes

- **Impact before severity.** Last round the strongest review finding established that a defect was
  covered indirectly *before* assigning it a severity, which correctly moved it off the blocking
  list. Do that.
- Prefer a **chokepoint** remedy over a checklist whenever the hazard is an open set. The best
  finding of the previous round was one mechanism that closed four separate findings and immunised
  the cases not yet written.
- If you can close a finding by making the bad state **unrepresentable** rather than **detected**,
  say so — that is the remedy I will act on fastest.

## Deliverables

1. Verdict: APPROVE / REQUEST CHANGES, with Required items separated from Suggested.
2. A verdict on each of the four deliberate deviations in item 1.
3. Your answer to the `run-tests.mjs` discovery question in item 2.
4. A numbered list of everywhere this brief is wrong (see the shared block — this is required, and
   note the two failure modes listed there).

Do not push. You MUST write the report file and then mark the task complete.
