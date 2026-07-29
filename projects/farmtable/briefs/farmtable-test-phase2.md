# test-phase2 — test review, full Phase 2 web UI line

Read `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-phase2-review-context.md` first. It has the range, the standing bars, and the gate results I already ran.

Workspace: `/workspace/farmtable-test-phase2`, branch `task-state-web-ui-v2` at `633f8f2`.

## The suite is green. That is the starting point, not a finding.

407 tests pass. I verified it. Your job is to find what green does not prove.

## What I want from you specifically

1. **Hunt the fifteenth self-built oracle.** Thirteen removed, a fourteenth rejected. Across 73 files there is likely another test asserting against a local re-implementation rather than the real exported symbol. Check the *new* attention-view tests first, but do not stop there — the older rounds' tests are in this line too and have not been re-examined as a whole.

2. **Sink binding — the failure mode that green cannot see.** This is the highest-value thing you can do. On the #195 branch a reviewer found that *nothing bound the inspector sinks to `renderMarkdown`*: every test exercised the function directly, so a refactor could bypass the sanitizer at the sink and the entire suite would stay green. Look for the same shape everywhere in Phase 2 — tests that exercise a function thoroughly while nothing proves the production code still calls it. Rank, availability, filters, and the attention predicate are all candidates.

3. **Reproduce the required mutants.** `CMP-02`, `F3-05`, `RANK-09` from r4, and `ATT-01`/`ATT-02` from the attention view. The attention-view dev pasted output for all five and claimed all are dead. Verify independently — apply each mutation yourself and paste your own actual output. If any survives, that is a High.

4. **Design your own mutants for the untested seams.** The five above were chosen by the devs who wrote the code, so they test what those devs were thinking about. Find what they were not. Aim especially at interactions between rounds: r4's `ft-app.ts` write-error path and the attention view's new `@filter-change` binding on the same component.

5. **The near-miss fixture.** The attention-view tests rest on `STRANDED` vs `WAITING` having byte-identical availability payloads so only the blocker's stage separates them, plus a fixture guard. Verify the guard actually guards — break the fixture and confirm the suite goes red rather than quietly passing.

6. **Coverage gaps, classified by blast radius, not by line count.** Say which gaps would let a real defect ship. The attention-view dev noted that a caller forgetting the store would silently answer "nothing needs attention" — a wrong answer indistinguishable from a right one. Are there other silent-wrong-answer paths with no test?

## Verdict discipline

Separate blocking gaps from additive ones and say so explicitly. On #195 the test reviewer found two High gaps and still approved because they were additive — that was the right call and it kept a good branch moving. Make the same distinction here.

## Deliverable

A report at `/scion-volumes/scratchpad/projects/farmtable/reports/test-phase2.md` with a clear verdict, your own pasted mutation output for every mutant you ran, and gaps classified as blocking or additive.

Do not push. Do not modify production code. You MUST write the report at that exact path and then mark the task complete.
