# CI STATUS — em-ci track

Updated 2026-07-29 15:35Z. Brief: green CI on main, from a clean clone.

**main = 2982ffd. Run 30466239482: SUCCESS.** Fast-forward only; no history
rewritten. Every fact below names the SHA it was measured at.

**BOTH DELIVERABLES ARE DISCHARGED.** Deliverable 1: green CI on main, verified
by an actual run, from a clean clone — the clean-clone leg returned nine of nine
with zero disagreements @43bd206, and main has since been advanced twice by
fast-forward with a green run at each exact commit. Deliverable 2 is this file.

## What main's green actually asserted

A green that caught nothing is an unlit instrument, not a pass. Run 30466239482
@2982ffd printed, as integers and strings rather than as a colour:

```
OK: the committed tree compiles -- 33 packages, nothing built yet.
enumerated=6 executed=6 missing=0 (floor 6)
package-qualified Go tests executed: 548
go test failure lines matched: 0
OK: all 503 manifest tests executed.
```

The first line is the guard that did not exist this morning, and it runs
**before `npm ci`**, so it measures the commit by construction. The last two
disagree: **548 executed against 503 known.** That gap is real and is stated
under Known Blind Spots.

## The result is not the green — it is the arms

Every check below executed for the **first time in this repository's history**
and has been **observed RED on the runner**, on its own named step.

| Arm | Run | Breakage |
|---|---|---|
| g1 dist-empty-before-build | 30462183955 | stray file in `web/dist` pre-build |
| g2 dist-has-real-content | 30462193493 | index.html stub, no hashed assets |
| g3 `go vet` | 30462180538 | copylock reintroduced (sole failure) |
| g4 Go membership | 30462183557 | manifest test renamed (sole failure) |
| g5 Makefile self-check | 30462188131 | `make test` broken (sole failure) |
| g6 tracked build output | 30462188275 | `git add -f web/dist` — the carve-out hole |
| **control** g5b | 30462186962 **SUCCESS** | web suite dropped: step passes, **zero** npm/vitest occurrences in its log — measured blindness |
| **control** g6b | 30462190434 **SUCCESS** | same canary against unfixed wiring — the hole was real |

### The C-1 / R-1 / R-2 arms, run on the tree that ships

Each canary below was **merged onto main before being run**, so its red is a red
about the shipping tree and not about a predecessor.

| Arm | Run | Result |
|---|---|---|
| w1 tracked dist, 52f79d3 | 30466059025 | **RED at "Assert web/dist holds no build output before the build"** |
| w2 marker untracked, ad15b7b | 30466044052 | **RED at "Assert the COMMITTED tree compiles (nothing built yet)"** — the FIRST gate |
| w3 `t.Skip`, 363864b | 30466053204 | **RED at "Go test membership"** |
| merge candidate 2982ffd | 30466043931 | SUCCESS — the control |
| **floor 6**, fc4e64d | 30466794919 | **RED at "Which JS suites will actually run"**: `FAIL: 1 JS/TS test file(s) have gone missing from the tree. enumerated=5 executed=5 missing=0` |
| **additions**, 2f5bc83 | 30466832947 | **RED**: `enumerated=7 executed=6 missing=1`, `NOT EXECUTED BY ANYTHING (1): web/src/util/canary-added.test.mts` |
| C-1 confirmation, f410023 | 30463794909 | SUCCESS *while a fresh clone of it compiles zero packages* |
| R-1 confirmation, 930fdb1 | 30463804634 | SUCCESS *with `--- SKIP:` in the same log as "all 501 executed"* |

The floor row is the sharpest discriminator on this page. **`enumerated=5
executed=5 missing=0` is the identical triple that was GREEN at floor 1.** The
integers did not change; the verdict did. The file deleted to produce it was
`web/src/util/safe-url.test.ts` — half of the URL-scheme security guard.

The additions row answers a question asked of the Go side and turned on the web
side: **the two gates are not one mechanism with two instances, they are
opposite designs.** The Go gate compares execution against a *committed*
manifest, so it catches deletions and is blind to additions (548 vs 503). The
web gate derives its expected set *from the tree*, so it catches additions
automatically and is blind to deletions — which is precisely why it needs a
floor and the Go side does not. Each design has exactly the blindness the other
does not. Filed as **one row**, because it is one trade-off seen from two ends,
not two bugs.

### Runner (web tests)

| Arm | Run | Result |
|---|---|---|
| intact | 30462438729 | SUCCESS |
| mutation: sanitiser deleted | 30462441196 | **RED at Web tests** — the mutation is killed |
| orphan file | 30462444127 | red |
| zero files | 30462446322 | red (exit 1, not the old exit 0) |
| spec divergence | 30462447826 | red: `compiled-but-not-listed … enumerated=2 executed=0 missing=2` |
| **spec EXECUTES** | 30463287118 | GREEN 2/2/0 **and `# CANARY-SPEC-EXECUTES` in the log** |
| explicit-paths arm @439b309 | 30465406500 | GREEN 6/6/0 — green because the set matched, *not* because the arm was skipped and *not* on an empty set |

## The ten

| # | Item | State |
|---|------|-------|
| 1 | main is red | **DONE** @faf1c8c — WatchTasks lost-event race + `file::memory:?cache=shared` leakage. A **disposition**, not a closure: see below. |
| 2 | clean clone cannot build (`all:web/dist`) | **DONE AND NOW GUARDED** @2982ffd — tracked `.gitkeep` + `.gitignore` negation trio; `WebUI()` returns `ErrWebAssetsNotBuilt`; and the step-4 committed-tree-compiles guard closes C-1. |
| 3 | manifest:122 unanchored vitest match | **DONE** @7a2ad51 — leading-token parse. |
| 4 | manifest:132 substring path filter | **DONE** @7a2ad51 — segment/suffix anchored. |
| 5 | manifest:~149 no floor | **DONE** @eca9239 — `MIN_TEST_FILES = 6`, derived set-wise at 439b309, with the six paths written into the constant's comment rather than the integer alone. Prints enumerated/executed/missing. |
| 6 | ci.yml:169 space-vs-tab | **DONE** @509835a — had matched 0 of 31 real failure lines and printed "none" on every run this repo had ever done. Now prints `go test failure lines matched: 0`, a number. |
| 7 | ci.yml:179 `if-no-files-found` | **DONE** @509835a — `error`; fired for the first time as a side effect of g1 @30462183955. |
| 8 | `make lint` broken and never invoked | **DONE** @43bd206 — `go vet ./...`, exit 0; buf split to unwired `lint-proto`. Now invoked. |
| 9 | web/dist existence ≠ content | **DONE** @509835a — ≥200-byte index.html referencing `assets/index-*.js`, hashed js+css, ≥500 files. |
| 10 | CI cannot see its own branches | **NOT A DEFECT** — closed on *runner* evidence (push runs do fire on branches), re-checked 15:00Z, holds. |

## Landed after the ten

`scripts/ci-suite-manifest.mjs:572` called **`tsconfigFiles`, an identifier
defined nowhere** — a `ReferenceError` latent since f94dfa2, invisible to
`node --check`, unreachable on the discovery arm main uses and reached on the
first attempt by an explicit-paths arm. Observed before it was fixed
(`ReferenceError: tsconfigFiles is not defined … :572:23, EXIT=1`), fixed at
85026a0, committed arm at 13eb480, and the whole file swept with a
TypeScript-parser scanner run as a **positive control** against the stock blob,
where it reports exactly `UNDEFINED: tsconfigFiles (first use line 572)`. It was
the only one.

Also: one shared web test runner @f94dfa2 (discovers by suffix; the
compiled-output list is *derived* from the source list, so drift is
unrepresentable and it fails **closed** on suffixes its author never foresaw) ·
Go membership asserted against a committed manifest · node-20/22 hotfix
@060e9ad · the compile guard now publishes its **package list**, not just the
integer 33, so a change in that number resolves to the member that caused it.

## Known blind spots — stated, not fixed

1. **MEMBERSHIP IS ASSERTED IN ONE DIRECTION ONLY.** 548 Go tests execute; the
   manifest knows 503. The gate detects a **deletion** and is blind to an
   **addition**, and the unprotected fraction grows every time anyone adds a
   test. Owed as a both-directions set diff, to land as one named registration
   commit reviewed as a set diff — never a regeneration.
2. **SUBSTITUTION DEFEATS THE FLOOR — CONFIRMED ON THE SHIPPING TREE, NOT
   INFERRED.** Canary 5d9df1f at 2982ffd deletes `web/src/utils/task-ready.test.ts`
   and adds a compilable replacement in the same commit. Run **30467223768:
   SUCCESS**, `enumerated=6 executed=6 missing=0 (floor 6)`. The deleted file
   left the tree, left the derived expected set with it, and nothing noticed.
   **A FLOOR IS A SCALAR; A MANIFEST IS A SET; THEY ARE NOT THE SAME STRENGTH.
   The web gate has a floor where it needs a manifest.** The Go gate catches
   this same move, because the deleted *name* is in a committed list. Remedy is
   a committed expected NAME SET for web, not a larger floor. Filed as C14, and
   declared in eca9239's own commit message rather than only here.
   The file used to produce that green is a member of the in-flight merge's
   conflict set: this is not a model of the merge, it is the merge's shape.
3. **A TEST CAN BE UNPINNED FROM ITS SUBJECT AND STAY GREEN.**
   `testdata/url-scheme-cases.json` is the client half of a cross-language
   differential pin whose server half is
   `TestValidateURLFieldMatchesSharedFixtures`. If the safe-url adjudication
   lands the branch side without rehoming the fixture, that Go test goes on
   asserting against a fixture nothing on the client checks — **present,
   executing, passing, and no longer measuring anything.** Membership and
   execution are both satisfied. My gate is structurally blind to this class.
4. **CI runs no TypeScript typecheck of the web app** (C9).
5. `web/scripts/run-tests.mjs` is a second, 331-line runner referenced by no
   script, target or workflow — but four test files reference it in prose and
   `web/src/util/assertions.ts` pins `RECEIPT_PREFIX` to it. Orphaned code with
   live couplings pointing at it. Reported, not deleted.

Filed under the owner's scope freeze (`OUT-OF-SCOPE-BACKLOG.md`): R-3 extract
the inline awk parser + write the missing manifest generator (**one work item,
not two**) · C12 · C13 · C17 the undefined-identifier scanner, with the full
technique inlined in the row so the knowledge survives without a branch ·
pipefail@202 · missing `if: always()`@243/261.

## A fact about the product, not about a parked item

**Measured @aa08f1a, both files, read-only from the object store: `Dockerfile`
and `Dockerfile.server` each run `npm ci`, `npm run build`, `go mod download`,
`go build`. No `go test`. No `npm test`. THE RELEASE PATH RUNS ZERO TESTS OF ANY
KIND.**

**F14 (release-path `go test`) — PARKED.**
~~"its premise was false and the leg proved it before editing"~~ — struck, not
deleted: that withdrawal had **no SHA, no artefact and no log entry** anywhere.
A withdrawal with no receipt is worse than the claim it replaced. Re-measured
rather than inherited. Premise false; **parking holds, now on a measurement.**

## Item 1 is a DISPOSITION, not a closure

Load-sensitive flake, ~15%/run, fixed on the interleaved discriminator (armA
10/10 fail vs armB 0/10, load-matched, p~1e-5) — **not on a run**. One green is
a likelihood ratio of ~1.18. Do not read the green as evidence the flake is
gone. The identity arm is unrecoverable: logs expired.

## Not a regression — on record

Fixing the embed made four pre-existing `assignment copies lock value` findings
appear. Always there, masked by vet aborting at zero packages. Fixed via
`proto.Clone` @a1642b8, and independently re-derived as *correct* rather than
merely vet-silent: all four request types are scalar-only, and the shallow copy
had been aliasing `unknownFields` and sharing `protoimpl.MessageState`.

## Rules this track operates by

- **MEASURE THE COMMIT, NOT THE TREE.** Fresh checkout, or a separate module
  that can only *read* the target. The guarantee is not that nothing was
  written; it is that **nothing uncommitted was READ**. And a fresh checkout
  guarantees you measured *the commit*, not *the right thing* — state the
  artefact in the same sentence as the result.
- **CANARY THE PROPERTY, THEN ASK WHICH GUARD WENT RED. IF NONE DID, THE
  PROPERTY IS UNGUARDED, AND THAT IS THE FINDING.** Paired clause: if you cannot
  write the property as a command, you have not finished specifying it.
- **EVERY REPORTED RESULT, ABSENCE OR PRESENCE, MUST NAME SOMETHING THE SAME
  INVOCATION WAS EXPECTED TO CATCH AND SAY WHETHER IT CAUGHT IT.** For an
  absence, a known-present member. For a green, what the run flagged. For
  anything counted, assert the **expected integer**, never the presence of
  results. Rationale: alarm-direction instrument failures are the only ones
  currently detectable, so counting them measures our detection, not our
  instruments.
- **PUBLISH THE PATH SET, NEVER THE INTEGER.** A count cannot be diffed by the
  next reader and cannot distinguish a leak from real growth. Demonstrated
  twice today: `26 = 22+4` inverted into the *expected* value when the
  population moved, and two parties reconciling conflict counts of 8 and 9
  would have sent an unexamined file into a merge — the sets differed in
  **three** members.
- **A mutation arm beats a canary**, and **a positive control red under both
  hypotheses is not a control** — name the two different outcomes before the run.
- **A retraction is a claim and gets the same controls as a claim.** Struck
  through in place, never deleted.
- **A colour is not a discriminator; name the integer or the string.**
- **A run that does not reach the step the hypothesis is about produces no
  evidence in either direction.** Name that branch before the push.
- A canary run only in the dev environment does not prove the gate on the runner.
- A fact offered as a fact states the SHA it was measured at.
- Report and stop: no leg disables, skips or weakens anything. No leg pushes.
  EM merges and pushes. Explicit-path staging only.

## Every run ID in this file is now pinned to an immutable ref

Raised by ci-workflow, which noticed that its four pre-rebase commits had become
reflog-only in its own tree and asked whether origin still held them. It did — and the
check turned up the sharper version of its question:

**Ten of the twelve commits cited by run ID in this document were reachable from exactly
ONE mutable branch on origin.** One force-push or branch delete and the commit a cited
green (or a cited RED) was produced from is unreachable, while the run ID goes on
resolving in the GitHub UI and pointing at nothing you can check out. **A RUN ID IS
EVIDENCE ONLY WHILE THE COMMIT IT RAN ON IS RETRIEVABLE.**

Each is now also pinned outside `refs/heads/`, so no branch operation can orphan it:

    git fetch origin 'refs/salvage/*:refs/salvage/*'
    git for-each-ref refs/salvage/ci-evidence

    refs/salvage/ci-evidence/run-<id>-<name>   12 refs

Both fast-forwards, all three pre-rebase and all three shipping-tree ci.yml canaries,
and the floor / additions / substitution arms. Verified after a prune-fetch: every one
now has a second, non-branch pointer.

## The one red, owned

I merged 7a2ad51 and main went red for five minutes (run 30458935255,
`node --test <dir>`: passes on node 20, fails on the runner's node 22). Mine. I
did not force-push it away — rewriting the default branch to hide a five-minute
red would have destroyed the one record showing the gate working. Fixed forward
@060e9ad. The breakage was caught **by the guard the same merge installed**.
