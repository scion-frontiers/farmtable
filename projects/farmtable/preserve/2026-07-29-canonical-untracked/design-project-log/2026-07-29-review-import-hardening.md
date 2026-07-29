# 2026-07-29 — Code review: import-hardening @ `2ff87d2`

**Type:** review record (no code changed)
**Branch reviewed:** `import-hardening` @ `2ff87d2`, base `43bd206`, 4 commits, not pushed.
**Verdict:** REQUEST CHANGES — 1 Required, 1 Nit, 4 FYI.
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/review-import-hardening.md`
**Reviews:** `2026-07-29-dev-import-hardening.md`

## Artefact, stated with the result

Every figure below was measured at `2ff87d2` in a throwaway clone at `/tmp/rev-ih/ft`
(`git clone --no-local`, detached), **not** in the developer's tree and not in `/workspace/farmtable`
(which is on another agent's branch with a dirty tree). `-uall` porcelain and `-uall --ignored`
both 0 entries before and after; scratch outside the repo; `web/dist/` only the committed
`.gitkeep`.

## What I confirmed rather than inherited

`go list` 32 · build OK · vet OK · `go test` ok=10 notest=22 FAIL=0 total=32 · gofmt clean on the
three changed files · manifest 501→507, six additions, **zero** deletions, base preserved
byte-for-byte and in order, fully sorted · membership gate 507 executed = 507 manifest, 0 MISSING,
0 UNEXPECTED · the CI gate really is asymmetric (`ci.yml` 365–408).

**Recovery pointer verified end to end.** `6dbfc8c:internal/server/export_import_provenance_test.go`
resolves and defines all three retired tests; `a809849`'s message cites `6dbfc8c`; no dead
pre-rebase SHA (`3fc9792`, `c33b5dc`, `d5e3f00`) survives in any of the four commit messages.

**Mutation arm M3 re-run, not inherited.** Delta `0+/4-` matching the dev's figure, the tree
**still compiled**, and the canary went RED via a genuine assertion. The arm carries information.

## The finding

**A task-less import records no provenance at all.** Measured: a zero-task document is accepted,
creates a collection, persists two user accounts, and writes **0** provenance rows. The stamp loop
is keyed to `importParams.Tasks`, and nothing requires that array to be non-empty. The report's
unhedged claim that "task-level provenance covers 100% of rows the import writes" is false as
written — it covers 100% of *task* rows, and collections and users are also rows the import
writes. With defect 2 LIVE, the uncovered path is exactly the one that persists arbitrarily-typed
accounts. Acceptable resolution under the scope freeze is to correct the claim and file the gap;
the code fix is not required on this branch.

## Two things worth keeping

**The vacuous-arm lesson generalises one step further than it was applied.** The dev used it to
find that M6 was reporting an unreachable control (a dead export strip) and deleted it. Testing
the lesson rather than noting it, I looked for another: `json.Marshal` on a struct of five string
fields cannot fail, so the `codes.Internal` branch guarding it is unreachable and no test can kill
it. Same shape, same diff. The lesson holds and it is worth running as a *search*, not just as a
retrospective explanation.

**A positive control has to be red under exactly one hypothesis, and subtests are where that
slips.** The canary has three subcases. Under M3 — the arm that deletes the control it guards —
only **one** fails; the other two still pass, because they exercise `RequireIdentity` behaviour
that already existed at `43bd206`. They are good regression guards on the base and they are *not*
evidence for the new refusal. A test can be a control at the function level and vacuous at the
subtest level, and a table-driven test reports both as one green line.

## Correction against myself

My first `go list` reported **87** packages. Wrong: I had merged stderr into the capture and
counted 55 `go: downloading …` lines as packages. The answer is 32 and the developer's figure was
right. The instrument answered a different question than the one I asked it — the same failure
this track keeps cataloguing, committed by the reviewer this time.
