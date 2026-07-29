# Project log — `audit-xss-r7` (security audit leg, XSS round 7)

Date: 2026-07-29
Leg: `audit-xss-r7`
ROOT: `/workspace/farmtable-xss-r7-audit`, detached at
`e4e3d1352809428a5dfe386bb53c0b18a562332f`
Round base: `c108acb` · Branch base: `d305391` · Merge target cited by the diff:
`cc92735`
Report: `reports/audit-xss-r7.md`
Verdict: **APPROVE WITH CONDITIONS** (7 conditions)

---

## What I was asked to do, and what I did

Brief: `briefs/_r7-COMMON.md` then `briefs/r7-audit.md`. Two named axes
(the authorization argument as a control; the sampler and the logging path) with
an explicit instruction that they are a floor. Cold pass first, findings on disk
before `_r7-PHASE-TWO.md`.

Order actually executed:

1. Read both briefs. No other artefact.
2. Read the diff `c108acb..e4e3d13` and the surrounding code, unscoped.
3. Built six censuses, wrote eight findings, pre-registered a falsifier and went
   looking for it.
4. Worked the two axes; they produced one finding of their own (5a).
5. Wrote the verdict.
6. **Wrote `reports/audit-xss-r7.md` to disk.** Only then opened
   `_r7-PHASE-TWO.md`.
7. Reconciled against the three r6 reports, the fix brief plus AMENDMENT 1, and
   the fix leg's three self-reported defects. Appended §8; added two findings and
   two conditions. **Sections 1–7 were not edited after step 6.**
8. This log. Then the message to `eng-manager`.

## Constraints observed

- **Nothing pushed.** No commit, no branch, no `git push` from this leg.
- **No production code modified.** `git status --porcelain` in ROOT is clean of
  source changes throughout; I wrote only into
  `/scion-volumes/scratchpad/projects/farmtable/reports/`.
- **No build, no suite, no targeted run.** I hold no build token and did not
  request one. **Nothing was appended to `_run-queue-log.md`, because nothing was
  run.**
- **No contact with another leg.** `eng-manager` only.

## Why I ran nothing, stated as a bound rather than a choice

A single targeted `go test ./internal/<pkg>/ -run '^TestName' -count=1` is
permitted without the token. I did not use the allowance:
`ls $(go env GOMODCACHE)/google.golang.org` is absent in this container, so the
module cache is unpopulated and any Go invocation would first download the
dependency graph — which is not what the allowance is for, and is not something to
do quietly on shared infrastructure. **Every claim in the report about test or
runtime behaviour is derived from reading source.** The report says so in
§9 "WHAT I DID NOT CHECK" rather than leaving it to be inferred.

One consequence worth recording for whoever schedules the next round: **a leg with
no module cache has no cheap execution at all**, and the build fence's "no token
needed" tier is empty for it. If targeted runs are expected from review legs, the
tree needs a warm cache at handover.

## Findings, one line each

| # | sev | finding | pass |
|---|---|---|---|
| 1 | MEDIUM | the invariant in `convert.go` is not the predicate `ft-app.ts:isCollectionWritable` actually applies — the second reader omits the GITHUB conjunct | cold |
| 2 | MEDIUM | `canEditRelationships` is declared, tooltipped and never enforced; two call sites gate on `isReadOnly` alone | cold |
| 3 | MEDIUM | 5 of the round's 27 new line citations do not resolve, and all 5 are the cross-references between the two conjuncts | cold |
| 4 | LOW | a browser-only check is labelled "SECURITY CONTROL" in the two files that lack the "nothing in Go enforces this" caveat | cold |
| 5a | LOW | `%q` hardens the keys; `err` on the same line is `%v` and carries the offending key in exactly the branch whose comment says keys are not printed | axis 2 |
| 5b | INFO | the `%q` justification names a vector no in-tree path realizes | cold |
| 6 | LOW | per-field keying fixes cross-field masking; intra-field masking remains on the field that is permanently saturated | cold |
| 7 | LOW | the producer census omits `UpdateCollection`, the only writer with merge semantics | cold |
| 8 | INFO | the count `convert.go` forbids was reintroduced in `capabilities.ts` in the same round | cold |
| 9 | LOW | `graph_queries` is a plantable key read **in Go**, inert only by an undocumented third farmtable early return at `graph_routing.go:38` | phase two (site from the brief, implication mine) |
| 10 | INFO | `doc.go` says "TWO LIMITS"; there are at least three, and the third is the non-blocking item the fix leg neither did nor logged | phase two (from `review-xss-r6` PO-7) |

**8 from the cold pass, 1 from the briefed axes, 2 from reconciliation.
11 items = 8 + 1 + 2.**

## Verification of the fix leg's three self-reported defects

Done because `_r7-PHASE-TWO.md` is right that a self-report inherits every duty of
a claim. Full working in report §8.1.

1. **6 vs 49 `=== RUN`.** Stated cause **verified**, and I closed the loop it left
   open: 13 `^func TestRemoteData` in the package + 36 subtests (2+21+6+7) = 49,
   derived statically at `e4e3d13`. The finding underneath the verification is that
   **six later pre-registrations were anchored to R7-10's artefact rather than to
   an independent count**, so the anti-vacuity instrument had a single point of
   failure for the rest of the round. My static count is the independent
   derivation that was missing; it agrees.
2. **Two compile-receipt mtimes written from expectation.** The artefacts are in
   another container and **I could verify neither the numbers nor the correction**.
   What I could establish: in both corrected readings the mtime equals the
   pre-build stamp to the second, which is exactly where an mtime comparison
   cannot discriminate — so the number was decorative before and after, and the
   receipts rest on `rm -f` plus existence. Compilation of the two packages is
   independently established by the targeted test runs, which cannot produce `ok`
   from a package that does not compile.
3. **"Reported the producer count wrongly once and corrected it."** **FALSE AS
   STATED.** The correction landed in `convert.go` (which now prohibits the count)
   and not in `capabilities.ts:108`, which still says "the two producers" and
   points the reader at the prohibiting paragraph. `2 = 1 + 1`: one site
   forbidding, one committing.

## Brief-vs-delivered

14 instructions enumerated across `dev-xss-r7-fix.md` and AMENDMENT 1;
**13 delivered, 1 gap.** The gap is the non-blocking item *"the guard catches
proto-shape changes but not payload-shape changes; the producer test has zero
collection coverage — note in the log if you do not act"*, which was neither acted
on nor logged, while the project log's line 8 states *"all non-blocking items
done."* B4 also delivered **more** than was asked (the descent-assertion test was
not in the brief) and it is the best work in the round.

## Contamination — disclosed, and it is mine to disclose

A `grep` over `reports/*.md` during the cold pass put **two lines of
`review-xss-r7.md`** — a concurrent leg's live report on this same commit — in
front of me. I stopped, did not open that file, and never opened
`test-xss-r7.md`. The lines concerned a word-boundary census of `writable` over
the Go tree (9 hits) and one bound sentence. My Census 4 used a different
instrument (the quoted key), returned 1, and was written before the leak; the two
results are consistent and no conclusion moves.

I have filed the layout, not the accident, as the defect: three legs writing
current-round reports into the same flat directory every leg must read for
prior-round artefacts makes this a matter of scheduling. `reports/r7/` fixes it.

## Where I was wrong, in the order I was wrong

1. **A bounded instrument of my own nearly produced a false headline.**
   `grep -rln 'capabilities' web/src/components/*.ts` is top-level only in zsh and
   returned one file, which briefly told me the entire capability system was
   inert. The recursive form found five components gating on
   `this.readOnly || this.capabilities?.canX === false`. Caught by my own
   pre-registered falsifier, before anything was written down — and recorded in the
   report rather than quietly repaired, because the near-miss is the measurement.
2. **My cold pass asked the wrong noun.** I asked *"who reads `writable`"* and not
   *"who reads any key out of collection `remote_data`"* — one level more general,
   identical cost — and so I did not find `graph_support.go`. PHASE-TWO handed me
   the site. The implication is mine, the miss is mine, and the general census that
   would close the population is still not run: **I am not claiming
   `graph_queries` is the last one.** That is the largest open set in the report.
3. **I under-read the fix brief during the cold pass.** I judged the commit
   against the code, as instructed, but did not read `dev-xss-r7-fix.md` until
   phase two — at which point it turned out that the stale line numbers in my
   Finding 3 originated in AMENDMENT 1 §A2 and were *correct at `c108acb`*. Reading
   the brief earlier would not have changed the finding, but it would have changed
   the attribution I would have given it, and I would have given the wrong one.

## Where the brief was wrong — pointers, full text in report §10

Three from the cold pass (scope line undercounts the behavioural changes by one;
the cite-by-SHA rule has no cite-by-identifier corollary; the two-way
`ENUMERATED = FLAGGED + EXCLUDED` split hides the instrument's blind set) and
three from reconciliation, of which one matters most:

**An instruction of the form "add a comment at `file:NNN` naming this control" is
self-invalidating, and the more thorough the comment, the more wrong the number.**
Proven with two SHAs: the platform check is at `export_import.go:306` at
`c108acb`, the annotation the leg was asked to write is 29 lines and sits directly
above it, and the same commit moves the cited line to `:335`. Three files then
copied the pre-shift number. Ask for annotations by identifier.

The other two: `_r7-PHASE-TWO.md` files `graph_support.go` under "known, do not
re-discover" when it in fact falsifies a universal the round shipped in a security
comment; and the shared `reports/` directory makes cold-pass contamination a
scheduling accident rather than a discipline problem.

## Handover

- Report: `reports/audit-xss-r7.md` (10 findings, 7 conditions, §8 reconciliation).
- Highest-severity: three MEDIUMs, none exploitable; the one I would fix first is
  **Finding 1**, because it is the only one where the in-tree security argument and
  the code it describes disagree about a predicate.
- The one I would most like escalated beyond this round is **Finding 9** — it is
  LOW, and it is the only finding that says the round's reachability model is
  structurally incomplete rather than imprecise.
- Nothing here needs another leg. Everything is a comment, a follow-up ticket, or
  a log line.

**One apparatus note for the next round's briefs.** Both briefs name the recipient
as `eng-manager`. There is no agent with that NAME in this project;
`scion message eng-manager ...` fails with `agent_not_found` (404). `eng-manager`
is a *template*, and the agent carrying it is named
`farmtable-em-task-state-model-v2`, which is where the verdict was delivered.
A leg that took the brief literally, hit the 404, and had no `scion list` handy
would either fail its termination condition or guess. **Briefs should name the
recipient by agent name, not by template.**
