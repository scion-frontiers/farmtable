# PROJECT LOG — review-xss-r6 (round six, code-review leg)

**Agent:** `review-xss-r6` · **Root:** `/workspace/farmtable-review-xss-r6` (mine alone, never left it)
**SHA:** `c108acbcfa2357862576092469828709bb6c4090`, detached · **Range:** `d305391..c108acb`
**Verdict:** REQUEST CHANGES · **Full report:** `review-xss-r6.md` · **Pre-registration:** `_prereg-review-xss-r6.md`

---

## What happened, in order

1. Read `_r6-COMMON.md` and `review-xss-r6.md` as instructed. **This read §7 before Phase One
   existed** — the embargo is inside the file I was ordered to read first. Contamination declared
   in the pre-registration before any inspection, and filed as brief-error B1.
2. Wrote `_prereg-review-xss-r6.md`: seven predictions with outcome and arm stated separately, plus
   pre-committed verdict-flip conditions and a stated prior (REQUEST CHANGES at ~60%).
3. Phase One, cold-as-available: diff shape, then the single production file, then an audit of
   every falsifiable citation in it, then the guard as engineering.
4. Phase Two: re-read §7, reconciled, marked overlaps CONTAMINATED.
5. Four targeted runs, all logged with ROOT and DIST. No token requested, none spent.

## Findings that decided the verdict

| # | severity | finding |
|---|---|---|
| PO-1 | Required | The `collectionToProto` comment names three collection writers and discharges only two. `ImportCollectionParams.RemoteData` **is** populated in-tree (`export_import.go:332` → `:412`); the only thing stopping the log line is a JSON-decode **type** argument — the exact argument this rewrite disowns as FALSIFIED. |
| PO-2 | Required | The rewrite **deleted** the pre-diff clause covering `syntheticCollection()` (`passthrough.go:644`), a struct literal that bypasses both param structs and is the collection returned for every GitHub passthrough collection. The comment's "INVALIDATING EVENT, NAMED" therefore omits the most likely arming edit — adding `writable` to that literal. |
| PO-3 | Required | `doc.go` (and project log :184-186) assert "no CI configuration in this repository at all … there is no pipeline." On the merge target `cc92735`, `.github/workflows/ci.yml` runs `go test`, `npm test`, `make test` **and** `ci-suite-manifest.mjs`. The document's central "NEITHER PLACEMENT DOMINATES" trade is void on merge. |

Non-blocking: PO-4 (guard population excludes the embedded `web/dist`), PO-5 (a "line census"
described as an "occurrence census"), PO-6 (undocumented helper ordering contract; verified
order-independent today under `-shuffle` 1/2/3), PO-7 (guard catches proto-shape changes, not
payload-shape changes; producer test has zero collection coverage), PO-8 (every passthrough task's
`remote_data` is dropped today — the comment says so and is correct).

Phase Two, all CONTAMINATED: PT-1 (deletion cell in an additions table, confirmed at project log
:137-139), PT-2 (`SITE(S) NO LONGER MATCH` header contradicts its own body text, `:361`), PT-3
(merge blocker **CONFIRMED BY INSPECTION, NOT EXECUTED**; arm is *unanalysable-argument*, not the
missing-file arm I pre-registered — outcome right, arm wrong; and **not this round's defect**).

## Pre-registration scored

| | prediction | result |
|---|---|---|
| P1 | apparatus:production > 3:1 | **CONFIRMED**, ~17:1 (1 production file of 10) |
| P2 | guard fragile to reformatting | **CONFIRMED as designed and disclosed** — not filed; the doc pays the cost openly |
| P3 | policy stated twice, one prose statement already false | **CONFIRMED**, prose-vs-code arm as predicted (PO-2, PO-3) |
| P4 | ≥1 false assertive sentence beyond the two known | **CONFIRMED** — three (PO-1, PO-2, PO-3); arm **wrong**, I predicted test-adjacent prose, two of three are production-comment prose |
| P5 | non-vacuity companion has a partial-pin gap | **NOT CONFIRMED** — the companion is adequate for its stated job; retracted |
| P6 | Go gates pass in my tree | **CONFIRMED** for the three touched packages; wide build not run |
| P7 | merge blocker confirmed | **outcome CONFIRMED, arm WRONG** (unanalysable-argument, not missing-file) |

Prior was REQUEST CHANGES at ~60%; outcome REQUEST CHANGES, driven by P4 as predicted rather than
by a production correctness defect. **I predicted the production change would be correct and it is** —
I looked for F1 and found nothing.

## One finding I raised and then retracted

I suspected leaked global state in the sampler's test helpers — a frozen clock and an unreset
suppression counter escaping across tests. `captureRemoteDataLog`'s `t.Cleanup` restores all five
pieces of state correctly, and three shuffled runs were green. **Retracted rather than downgraded.**
The residual (PO-6) is only that the restore lives in a different helper than the mutation.

## Brief errors — the mandatory section

- **B1 `structural`** — the §7 embargo lives inside the file legs are ordered to read first. Unsatisfiable
  as written; **fired on all three legs identically**; the round's stated measurement (does a cold read
  reach the two known inaccuracies?) is **lost and unrecoverable for this round**. Fix: separate file.
- **B2** — COMMON §2 tells me `web/dist` was not built in my tree while naming my tree as where it was
  built. A shared file cannot address "your tree" in the second person about a per-leg fact.
- **B3** — "`git ls-remote` is the only cheap read in git that cannot be stale" is **false here**: my
  `origin` is `/workspace/farmtable`, a local clone, and `ls-remote origin main` returns the stale
  `7a0f220`. Reading the `cc92735` object directly is what actually worked, with no network at all.
- **B4** — §7's description of the guard is accurate in every structural particular, and both disclosed
  inaccuracies are real and exactly as described. Recorded so this section is not one-sided.
- **B5 `Required`** — §7 listed `ci.yml` under "environmental facts you would otherwise measure as
  findings", i.e. it **pre-classified the decisive evidence for PO-3 as noise.** The §6 hazard firing
  live. Suggested rider: an environmental fact that contradicts something the diff asserts is a finding.
- **B6** — the round's framing named the web-consumer surface; all three blocking findings are on the
  producer/reachability side. The bullet that found them was the open one with no artefact attached.

## Discipline notes

- Read-only on production code throughout. **No mutations planted, none reverted, no controlled
  negatives of my own** — every claim above is inspection plus four logged runs.
- No other agent contacted. No other tree read, written, or built in. No `node_modules` borrowed.
- No build token requested or spent; the wide gate the round itself recommends (`go test ./...`)
  remains unrun and I endorse spending the token on it before merge.
- Every command verified by its output text, never by a reported exit code; no command terminated
  with an echo of its own status.
