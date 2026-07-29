# xss-url-scheme-union @ `d7154a4`: XSS / URL-scheme validation union — Merge-Gate Review

Reviewer: `review-xss-union`. Dispatcher: `farmtable-em-hardening`.
Review target: branch `xss-url-scheme-union`, tip **`d7154a4`** (retargeted from
`34ce4da` mid-review; see §0).

## Provenance of every figure in this report

Node is **v20.20.2** everywhere. `ci.yml:46` pins **NODE 22**. No node 22 binary
exists in this environment. **Every web figure below is "green on node 20", not
"CI will pass".**

### Tree state at the moment of measurement — re-done under the 14:38Z rule

My first pass satisfied the old wording and would have **misled under the new
one**. I am amending it unprompted, and I am disclosing the exposure before the
results.

**Every gate figure quoted in this report has been re-measured at `d7154a4` in a
fresh clone with `git status --porcelain` sampled after each individual check.**
ROOT=`/tmp/xclean`, SHA=`d7154a4`:

| # | check | result | porcelain after |
|---|---|---|---|
| 0 | checkout | — | **0** |
| 1 | `go list ./...` | 33 packages | **0** |
| 2 | `go vet ./...` | EXIT=0, 0 findings | **0** |
| 3 | `go test ./... -v` | EXIT=0, 1160 RUN lines, **0** failure lines under CI's own matcher | **0** |
| 4 | `scripts/ci-suite-manifest.mjs` | EXIT=1, 5 enumerated / 1 executed / 4 missing | **0** |
| 5 | membership assertion | manifest=503, executed=548, **MISSING=0**, UNEXPECTED=45 | **0** |

All values identical to the first pass. Nothing in this report's conclusions
moved; the evidence behind them did.

**Row 5 re-derived a third time using CI's own commands, not my restatement of
them.** Prompted by the 14:42Z standing check — *what question did this flag
actually answer?* — because my earlier figure came from my own reimplementation
of the matcher, and CI keys membership on **package + test name**, not on the
bare test name. Keying on the bare name is a known defect on this repo: `ci.yml`
records that it once collapsed 501 real tests into 499 rows, because
`internal/server` and `internal/store` each define `TestListUsers` and
`TestGetUser`. Had I counted bare names, my number would have answered a
narrower question than the gate does. Re-run with `ci.yml`'s verbatim `awk`
block and its `comm -23` / `comm -13` pair, **all scratch written to `/tmp/memb`,
outside the clone**: manifest 503, executed 548, MISSING **0**, UNEXPECTED
**45**, `(unterminated)` rows **0**. Identical — but now CI's answer rather than
mine.

**The measurement clone holds nothing the commit does not.** Under the 14:40Z
rule, and to meet the 14:42Z disclosure standard, `/tmp/xclean` was audited with
`--porcelain -uall` (untracked **shown**, not `-uno`) and with
`--ignored=matching`: **0 untracked and 0 ignored entries**, before and after a
full `go test ./... -v`. No `node_modules`, no `.tmp-test`, no scratch. The
gitignored-artefact disclosure for these five figures is therefore *nothing on
disk*, not *unstated*.

**`-uno` self-check (14:42Z):** I searched my own session transcript. Every
occurrence of `-uno` in my record is inside the EM's message quoting the trap;
**I never invoked it.** All my checks used bare `git status --porcelain`, which
defaults to `-unormal` and *does* show untracked files. Re-verified with `-uall`
anyway, as instructed: 0.

### Where my trees were dirty, and where the dirt was the point

- **`/tmp/x2`, mutation arms (M1-M5, G1).** A mutation is dirt by definition.
  **The dirt is the point.** Tree restored and re-verified green (`# pass 5
  # fail 0`) between every mutant. These results are differential — the finding
  *is* the difference between a dirty run and a clean one — so they are not
  quotable as a green for `d7154a4` and I do not quote them as one.
- **`/tmp/x2`, the over-denial probe — this is my instance of the hole the CI leg
  disclosed, and I would not have mentioned it under the old rule.** I created
  a scratch Go file, `internal/server/zz_review_legit_test.go`, **inside the
  clone**, ran it, and deleted it. Clean before, clean after, **dirty at the
  moment of measurement.** Porcelain sampled at the end would have returned 0
  and the answer "clean" would have been literally true and materially
  misleading. I could not use the separate-module/`replace` technique here:
  `validateURLField` is unexported, so no external module can reach it. The
  honest options were a scratch file inside the clone or no measurement, and I
  chose the scratch file without saying so. **Saying so now.** The 16-row
  accept/reject table in §4 carries that caveat; it is a probe of the validator's
  behaviour, not a gate result, and no gate figure in this report depends on it.
- **`/tmp/x2`, web mutation runs.** I symlinked `node_modules` into the clone and
  `tsc` wrote `.tmp-test/`. **Both are gitignored, so porcelain was empty while
  the tree was materially altered** — and the alteration was not cosmetic: the
  symlink is what produced the three `internal/webguard` failures I initially
  mistook for a branch defect (see F-1). This is a second, sharper instance of
  the same hole: *porcelain-empty is not tree-unchanged.*
- **`/tmp/xtrial`.** Measured with an **uncommitted `git merge --no-commit` in the
  worktree** — dirty, deliberately, because the merge result was the object of
  measurement. Its vet/test figures are superseded by the `/tmp/xclean` table
  above and are retained only as the provenance of the "clean auto-merge, zero
  conflicted files" claim in C-1.
- **`/workspace/farmtable-dev-xss-r9`.** Read-only use — `git diff`, `git show`,
  `git log`, source reading. `git status --porcelain` empty at every read. **One
  exception:** I ran `npm test` there once at 14:2x, which does `rm -rf .tmp-test`
  and recreates it. Gitignored, no tracked file touched, and the figure it
  produced is superseded by row 4 above. Disclosing it because "I only read that
  tree" would otherwise be false.

On counting: I am quoting **mechanisms**, not a total. Two distinct ones surfaced
in my own evidence above — *scratch file inside the clone* and *gitignored dirt
invisible to porcelain* — and I make no claim about how many exist. I note the two
are not cleanly separable: the gitignored case is *also* an instance of "the
instrument answered a narrower question than I asked." That overlap is the reason
I quote mechanisms and refuse a total, rather than a stylistic preference.

### Artefact re-resolution: which container, which binary (14:45Z clause 2)

My C-1 wording said "the release path" and "the shipping image." **Under the new
clause that sentence is not a claim, because it does not name the artefact.**
Re-resolved at `d7154a4`, ROOT=`/tmp/xclean`, porcelain `-uall` = 0:

| file | builds | `CMD` (line 25) | comment | `RUN npm test` | base image |
|---|---|---|---|---|---|
| `Dockerfile` | `/ft` (`./cmd/ft`, line 19) | `["/ft","dashboard","--port","8080"]` | lines 6-8 | line 9 | `node:22-bookworm` |
| `Dockerfile.server` | `/farmtable-server` (`./cmd/farmtable-server`, line 19) | `["/farmtable-server"]` | lines 6-8 | line 9 | `node:22-bookworm` |

The two comment blocks are **byte-identical**, and both say *"the release path
must not be able to ship a tree whose guard is red."* Per the EM's deploy logs
the live service is **`farmtable-server`, built with `-f Dockerfile.server`**, so
C-1 restated with the artefact inside the sentence:

> **In the image that builds `/farmtable-server` and that production actually
> deploys, `Dockerfile.server:6-8` promises a red URL-scheme guard fails the
> build, and `Dockerfile.server:9` `RUN npm test` cannot deliver that** — at
> `d7154a4` the `test` script runs exactly one file, `task-ready.test.js`, and
> none of the four URL-scheme guard files. The layer goes green having tested
> nothing the comment is about.

Two corrections to my own earlier framing fall out of naming the artefact:

1. I called the four sites "four equivalent text defects." **They are not
   equivalent.** One of them is a false assurance in the shipping image; the
   other three are false assurances in developer-facing text. Same fix, different
   severity, and I had flattened that.
2. **My node-20 caveat does not apply to the container path.** Both Dockerfiles
   are `node:22-bookworm`, matching `ci.yml:46`. So the no-op `RUN npm test` will
   run *green on node 22* — the caveat that weakens my other web figures makes
   this finding **stronger**, not weaker, because there is no node-version escape
   hatch by which that layer might have failed.

### Pre-registered predictions for the authoritative run (14:45Z clause 2)

Recorded **before** EM-CI's runner can settle them, so they cannot be quietly
reconciled afterwards. If CI disagrees with any row, that is a finding and I will
report it loudly rather than adjusting the row.

| # | when the runner is on main and C-1/R-2 are fixed, I predict | if it comes back otherwise |
|---|---|---|
| P1 | `scripts/ci-suite-manifest.mjs` → **EXIT=0, 5 enumerated / 5 executed / 0 missing** (today: EXIT=1, 5/1/4) | Still red ⇒ the fix did not actually re-enter the four guard files into execution |
| P2 | Go membership → **MISSING=0, gate PASSES.** UNEXPECTED=**0** if the EM's merge-time commit lands the 45 (manifest 548); UNEXPECTED=**45** if it does not (manifest 503). Passes either way | MISSING>0 ⇒ a test stopped running at merge |
| P3 | `go test ./... -v` → **EXIT=0, 548 package-qualified tests, 0 failures, 0 `(unterminated)`** | Any failure ⇒ the merge changed Go behaviour I certified as inert |
| P4 | `go vet ./...` → **EXIT=0, 0 findings, 33 of 33 packages** | Non-zero ⇒ regression |
| P5 | **The four URL-scheme guard files pass on node 22.** Every web figure I hold is node 20; this is the row I am least able to underwrite | Red on 22, green on my 20 ⇒ loud finding, and precisely why the shared runner exists |
| P6 | Mutation: **same 5 kills, same 1 survivor** (`testHostGuardIsAFailClosedBackstop`, `safe-url.test.ts:166`) | A kill turning survivor ⇒ the guard is weaker in CI than on my tree. The survivor turning kill ⇒ my unreachable-branch analysis was wrong |

P5 and P6 are the rows worth watching: both were measured on node 20, on a tree,
by me.

---

## 0. The delta question — ANSWERED, and the answer is NOT "main plus docs"

EM asked me to check, not assume, that `34ce4da..d7154a4` is main's own commits
plus documentation. **It is not. There are two non-main, non-documentation
changes in it.** Both are benign; both are behaviourally or gate-relevant, so I
name them loudly as instructed.

Method: for each of the 16 files in `git diff --name-only 34ce4da d7154a4`,
compare the blob at `d7154a4` against the blob at `43bd206`.

**12 of 16 files are byte-identical to main** (`ci.yml`, `.gitignore`,
`Makefile`, `assets.go`, `cmd/farmtable-server/main.go`,
`internal/cli/dashboard.go`, `scripts/ci-suite-manifest.mjs`,
`web/dist/.gitkeep`, and main's three project-log files).

**4 of 16 differ from main:**

| file | difference from main | class |
|---|---|---|
| `.design/project-log/2026-07-29-xss-url-scheme-union.md` | +21/-5 | documentation |
| `reports/dev-xss-union.md` | +122/-5 | documentation |
| **`.github/expected-go-tests.txt`** | **+2 lines, −0** | **CI gate input — not main's, not documentation** |
| **`internal/server/server.go`** | main's 5 hunks applied over ours | **production Go — verified inert, see below** |
| `web/package.json` | +3 devDependency lines over main | manifest |

**`.github/expected-go-tests.txt`** — exactly two additions, zero deletions:
`TestConjunctA_ImportAcceptsFarmtableAndStoresItAsFarmtable` and
`TestConjunctA_ImportRejectsNonFarmtableCollection`, both in
`internal/server`. Both exist and both execute (verified in the membership run,
§4). Correct content, but it is a fourth category your description did not
have, and a manifest edit is exactly the class of change that should never pass
unremarked.

**`internal/server/server.go`** — I extracted `34ce4da:internal/server/server.go`
and `d7154a4:internal/server/server.go` and diffed them. The difference is
**exactly and only** main's own `7a2ad51..43bd206` patch: one added import
(`google.golang.org/protobuf/proto`) and four `ephReq := *req` →
`proto.Clone(req).(*pb.X)` conversions, at offsets shifted +9 lines by our
additions above them. **Not one line the merge invented.** Our
`validateURLField` call sites survive at `server.go:645` (`add_pull_requests[i].url`)
and `server.go:667` (`remote_url`) — both present, both still reached.

**`web/package.json`** — differs from main by the three devDependencies and
**nothing else**. The `"test"` script is byte-identical to main's, i.e. the
held/narrowed single-file form. See Critical-1.

**Conclusion: the behavioural delta `34ce4da..d7154a4` is inert.** My findings
measured at `34ce4da` and `b54c573` therefore **CARRY to `d7154a4`**, and I say
so naming all three SHAs. The one substantive change between `34ce4da` and
`d7154a4` is main's `web/package.json` "test" script arriving — which is
Critical-1, and it is new at `b54c573`, not carried.

---

## Executive Summary

The security work is real, correctly placed, and mutation-tested; the owner's
union ruling is genuinely honoured, not merely asserted; the dependency manifest
is complete and self-sufficient. **Risk level: MEDIUM**, and it is entirely
process risk, not code risk: at `d7154a4` four of the five web test files —
including both halves of the URL-scheme guard this branch exists to add —
compile and never execute, and four assertion sites *added by this branch* now
state the opposite in the imperative.

---

## Critical

### C-1. `npm test` at `d7154a4` runs 1 of 5 web test files; four in-branch assertion sites say otherwise

**TRI-STATE** (14:47Z standard; a report silent about which half it is in is
treated as inferred)

- **MEASURED** — @`d7154a4`. `npm test` executes 1 of 5 emitted web test files
  (ROOT=`/tmp/x3`, and re-confirmed by `ci-suite-manifest.mjs` EXIT=1, 5/1/4 in
  the fresh clone `/tmp/xclean`). The four assertion sites exist and say
  otherwise: `agents.md:37-40`, `agents.md:101-105` (`CLAUDE.md` is a symlink to
  `agents.md`), `Dockerfile:6-8`, `Dockerfile.server:6-8`. Read directly at
  `d7154a4`: `Dockerfile` builds `/ft` (`CMD ["/ft","dashboard",…]`),
  `Dockerfile.server` builds `/farmtable-server` (`CMD ["/farmtable-server"]`);
  both comment blocks byte-identical, both `RUN npm test` at line 9, both
  `node:22-bookworm`.
- **NOT MEASURED** — that `Dockerfile.server` is the production image. **I did not
  demonstrate this**; it comes from the EM's deploy logs (14:45Z), which I have
  not seen. I also did not build either image, so "the layer goes green" is
  inferred from the script's exit 0 on node 20, not observed in a container. And
  I have not measured whether any *other* deployment path exists.
- **PRECONDITIONS** — for the shipping-image half to bite, `Dockerfile.server`
  must be the deploying artefact (**not checked by me**, asserted by the EM) *and*
  `npm test` must exit 0 while skipping the guard files (**checked**, it does).
  For the developer-facing half to bite, nothing further is required — the three
  text sites are false as written at `d7154a4` regardless of which image ships.

Measured, ROOT=`/tmp/x3`, SHA=`d7154a4`, clean tree:

```
tsc -p tsconfig.test.json  ->  5 files emitted to .tmp-test/
npm test                   ->  1 file executed, 10 assertions, exit 0
scripts/ci-suite-manifest.mjs -> EXIT=1, enumerated=5 executed=1 missing=4
```

Not executed: `web/src/util/safe-url.test.ts` (631 lines),
`web/src/util/url-binding-scan.test.ts` (1594),
`web/src/capabilities.test.ts` (256), `web/src/util/assertions.test.ts` (96).

I understand and accept the EM's ruling that the **held `web/package.json`
"test" hunk is parked pending EM-CI's shared runner and must not be counted
against the branch or fixed to get green.** I am not asking for it to be fixed
and I do not count the red suite-manifest against the branch.

**What I am raising is a different thing, and it is the branch's own:**

**The branch adds four sites that assert, in the imperative, that this suite
runs. All four are false at `d7154a4`.** You asked for the count when you
gave me one site; here are four (surfacing as six grep hits, because
`CLAUDE.md` is a symlink to `agents.md`):

| # | site | added by | text, now false |
|---|---|---|---|
| 1 | `agents.md:37-40` (`CLAUDE.md:37-40`) | **this branch** | "Do not substitute a bare `go test ./...`: the URL-scheme security guard lives in `web/src/util/*.test.ts` and is executed only by `npm test`." |
| 2 | `agents.md:101-105` (`CLAUDE.md:101-105`) | **this branch** | "`url-binding-scan.test.ts` and `safe-url.test.ts` are the client-side half of the URL-scheme security property, and `npm test` is their only executor. Both container builds run it too, so a red guard fails the image." |
| 3 | `Dockerfile:6-9` | **this branch** | "The URL-binding guard runs here or nowhere. … the release path must not be able to ship a tree whose guard is red." |
| 4 | `Dockerfile.server:6-9` | **this branch** | identical text |

Sites 3 and 4 are worse than stale prose: `RUN npm test` in both Dockerfiles is
now a **no-op guard in the release path**. A container build cannot go red on a
URL-scheme regression, while a comment three lines above promises it will. That
is the vacuous-control shape this track has been bitten by twice, planted
directly in the release path by this branch's own diff.

**Suggested fix — no runner, no package.json edit, nothing held is touched:**
change the four texts from present-indicative to a stated dependency on the
held hunk. E.g. `Dockerfile:6` → *"`npm test` currently executes only
`utils/task-ready.test.js` (main's narrowed form at 43bd206, held pending
EM-CI's shared runner). Until that lands this step does NOT run the URL-binding
guard."* Same for `agents.md`. Four one-paragraph edits, zero behaviour change,
and it removes the false claim rather than the red gate.

**A separate mechanical hazard, and it is why I am grading this Critical rather
than Required:** the merge that introduced this **had no conflict**. I trial-merged
`43bd206` into `34ce4da` independently (ROOT=`/tmp/xtrial`): `git merge` reported
*"Automatic merge went well"*, `git diff --diff-filter=U` returned zero files.
Our side had not touched the `"test"` line since the merge base, so git took
theirs silently. **Nothing will stop at this hunk. A "hold this hunk"
instruction has no mechanism behind it** — the next person to merge main will
get it again, with no conflict marker, and the only thing that catches it is
`ci-suite-manifest.mjs` going red, which is currently expected-red and therefore
its signal is masked. Consider a `.gitattributes` merge driver, or accept that
this recurs on every main merge until the shared runner lands.

---

## Required

### R-1. 45 of the 47 Go tests this branch adds are absent from `.github/expected-go-tests.txt` — **REMEDY ADOPTED AND EM-OWNED, 14:34Z**

> **STATUS UPDATE, after this section was written.** EM has adopted the fix:
> *"one named commit at merge time, reviewed as a list, mine to write."* dev-xss-r9
> reached the same finding independently and also established the fact I had not
> checked — **0 of the 45 exist on main, so main's manifest is complete for main's
> tree** and the gap is created by the merge, not by main. I confirm that
> independently: all 47 come from files in `git diff --name-only 7a2ad51..HEAD`,
> so none can be present in a manifest generated from main.
>
> **This is therefore no longer a change request against the branch.** It remains
> a merge-gate item, it is owned by the EM, and it must land in the same push. The
> measurement below stands as the list that commit has to cover. I do not count it
> as a blocker.



Measured, ROOT=`/tmp/x2`, SHA=`b54c573`, and unchanged at `d7154a4`:

```
branch-added top-level Test funcs (11 new/changed _test.go files):  47
present in .github/expected-go-tests.txt:                            2
absent:                                                             45
```

I independently confirm the correction you have already accepted from
dev-xss-r9: the gate is asymmetric (`ci.yml`, "Deliberately asymmetric …
UNEXPECTED (executed, not expected) -> REPORT ONLY"), MISSING=0 at `d7154a4` —
**against the branch's own 503-entry manifest, not main's 501**; UNEXPECTED is
**45**, being the 47 branch-added tests less the 2 already registered — so
**the gate passes and adding tests does not fail it.** This is not a gate
failure. It is a coverage gap in the gate.

**Where I push back on the rule as you have restated it.** You endorsed r9's
2-of-47 as "exactly right" on the ground that only 2 were its own. That
authorship boundary is a *leg* boundary. The gate's population is **main**, and
main has never seen any of the 47. From main's point of view all 47 are this
branch's own, and the other 45 are not "someone else's tests" whose absence is a
question for you — they are r6/r7/r8's tests on this same branch, arriving in
this same merge, with no other owner behind them.

The 45 unregistered include **every server-side URL-scheme security test**:
`TestValidateURLField_RejectsScriptBearingSchemes`,
`TestSanitizeRemoteDataScrubsEveryURLCarrier`,
`TestTaskToProtoScrubsRemoteDataURLCarriers`,
`TestRPC_UpdateTask_RejectsScriptURLInRemoteURL`,
`TestRPC_ImportCollection_RejectsScriptURLs`,
`TestSanitizeAndImportAgreeAtEveryDepth`,
`TestValidateImportedTaskURLsReachesNestedCarriers`, and 38 others.

A test with no manifest entry can stop running and the gate stays green — the
exact failure the manifest exists to catch. This branch ships a security control
and leaves the control's own tests outside the only device that notices when
they disappear.

**Suggested fix (now the adopted one):** add the 47 entries **by name**, generated
from the branch's own test files and nothing else. This is not regenerating the
manifest: no existing line is touched, no absence belonging to anything else is
closed, `sort -u` order is preserved, diff is +45/−0 over the 2 already present.
The full 47-name list is reproducible with:

```
git diff --name-only 7a2ad51..d7154a4 -- '*_test.go' \
  | xargs grep -hoE '^func Test[A-Za-z0-9_]*'
```


### R-2. `docs/url-policy.md` does not exist — 1 site, `web/src/components/inspector/ft-inspector-desc.ts:240`

**TRI-STATE** (14:47Z standard)

- **MEASURED** — @`d7154a4`, ROOT=`/tmp/xclean`. `git ls-files | grep url-policy`
  returns nothing; `docs/` holds `architecture.md`, `code-of-conduct.md`,
  `contributing.md`. The citation is at `ft-inspector-desc.ts:240`, **1
  occurrence in source** (grepped, not assumed).
- **NOT MEASURED** — whether the file was ever intended to be written on this
  branch versus cited aspirationally from another. I did not search other
  branches or the object store for it.
- **PRECONDITIONS** — none. A citation to a non-existent path is false at
  `d7154a4` unconditionally. This is the one finding on my list with no
  precondition to check, which is why it is one line to fix.

The comment block this branch adds at `ft-inspector-desc.ts:231-241` ends:

> "…which is a dependency fact rather than a property this repo states or tests.
> **See `docs/url-policy.md` for what IS stated.**"

`docs/` contains `architecture.md`, `code-of-conduct.md`, `contributing.md`.
`git ls-files | grep url-policy` returns nothing at `d7154a4`. **One occurrence
in source** (a second in `.design/project-log/2026-07-29-dev-xss-r6.md:240`,
which records that r6 saw this and deferred it as "trivial-and-allowed").

The sentence's entire function is to redirect a reader who has just been told
that the DOMPurify behaviour is *not* stated policy. It redirects to nothing.
On a branch whose stated discipline is that a citation must point at something
that goes red when it stops being true, and having already been deferred once,
this should not merge a third time.

**Suggested fix:** one line. Either drop the final sentence, or repoint it at
`web/src/util/safe-url.ts`, which is where the policy is actually stated and
which does go red when it changes.

### R-3. OUT OF SCOPE — routing to you, not reviewing it: `af9ea8c` alters what a user may do

`af9ea8c` ("fix(web): require GITHUB platform in isCollectionWritable") changes
`isCollectionWritable` (`web/src/capabilities.ts:108`) from an effective
predicate of *"not FARMTABLE and writable"* to *"GITHUB and writable"*. Its own
comment states the consequence: *"Every other external platform moves from
'writable if the flag …'"*.

Applying your test — does it alter WHO IS AUTHENTICATED, WHAT THEY MAY DO, or
HOW THAT IS DECIDED — **it alters what they may do**, in the dashboard, for
non-GITHUB non-FARMTABLE external collections. `ft-app.ts:230` and
`ft-app.ts:240` both route through it.

I am not reviewing it and I have formed no view on whether the tightening is
right. Flagging and stopping, per the fence. Note that `af9ea8c`'s identity is
the thing this whole branch is a merge rather than a rebase to preserve, so
this is not separable from the merge — it needs your ruling, not a rework.

**One thing that is squarely in my scope and is fine:** `export_import.go:306-362`
adds a long "SECURITY CONTROL, CONJUNCT A" comment above
`if doc.Collection.Platform != string(collection.PlatformFarmtable)`. I verified
the guard line itself is **context, not an addition** — the branch documents a
pre-existing server-side check and does not change it.

---

## The six things you asked for

### 1. The owner's ruling — HONOURED, and I measured it rather than inheriting your earlier count

**Exactly one file is genuinely two-sided.** Method: the r8∪r9 merge is
`a276a51`, parents `74d9db2` (r9) and `07f12a3` (r8). Diffing the merge against
each parent:

```
vs r9 parent 74d9db2:  1 file changed, 175 insertions, 2 deletions
vs r8 parent 07f12a3:  8 files changed, 730 insertions, 63 deletions
```

The intersection — files changed relative to **both** parents — is exactly one:
`.design/project-log/2026-07-29-dev-xss-r8-fix.md`. The other seven are r9's
one-sided commits, which is the tip-diff/disagreement conflation you flagged.
**Your corrected count is right: one, not eight.**

**Both sides survive in that file, verified by reading the diff, not the claim.**
There are exactly two deletions across both parent-diffs, and each one is
preserved verbatim elsewhere in the merged file:

| deleted relative to | text | where it survives |
|---|---|---|
| r8 parent `07f12a3` | *"Verdict: **five items closed, F1 VERIFIED, two conditions open and routed.** Not pushed."* | quoted verbatim inside the `UNION NOTE, 2026-07-29` at the merged file's lines 312-318, with a dated supersession note giving r9 the win and the reason (r9 ran the behavioural revert; r8 ran only `tsc`) |
| r9 parent `74d9db2` | *"cells R8-01 … R8-15 … are the build-token session…"* | quoted verbatim inside a second `UNION NOTE` at merged lines 312-319, with r8 winning and the reason stated (r9's text is the older `901670e` reading, frozen before r8 registered R8-16…R8-19) |

Two contradictions, two dated notes, **both sides present in each**, and the
supersession direction argued in each rather than asserted. Neither side was
silently preferred. `url-scheme-validation-r5-fix-round.md` was never two-sided
— identical blob at `901670e`, `07f12a3` and `74d9db2`; I confirmed this
independently of the adjudication record's claim.

I read `dev-xss-union-adjudication.md`. Its §2 claim-3 ("both sides survive each
contradiction") is the right test, its §5 self-report of the vacuous fifth
mutant is the honest kind of disclosure, and §7's three self-attacks are the
real limits. I found nothing in it I can falsify. Its §7.1 caveat — a
contradiction where both sides happen to be verbatim-containable would not be
detected as a contradiction — is real and unclosed, but it is a limit of the
instrument, correctly stated, not a defect.

### 2. The `package.json` hunk — MANIFEST IS COMPLETE AND SELF-SUFFICIENT

**I checked the manifest, not the run.** ROOT=`/workspace/farmtable-dev-xss-r9`,
SHA=`d7154a4`.

Every bare (non-relative) import across `web/src/**/*.ts`, 14 distinct
specifiers, resolved against the manifest:

| specifier | uses | declared |
|---|---|---|
| `lit`, `lit/decorators.js`, `lit/directives/class-map.js`, `lit/directives/unsafe-html.js` | 72 | `dependencies.lit` ✓ |
| `@improbable-eng/grpc-web` | 3 | `dependencies` ✓ |
| `@shoelace-style/shoelace/dist/...` | 1 | `dependencies` ✓ |
| `@dagrejs/dagre`, `protobufjs`, `marked`, `dompurify` | 4 | `dependencies` ✓ |
| **`jsdom`** | 1 (`safe-url.test.ts:11`) | **`devDependencies.jsdom ^29.1.1`** ✓ |
| `node:fs` ×4, `node:path` ×3, `node:url` ×3 | 10 | **`@types/node ^26.1.2`** + `tsconfig.json "types": ["vite/client","node"]` ✓ |

`package-lock.json` (lockfileVersion 3, 152 packages) carries all three at exact
pinned versions with `dev: true`: `jsdom@29.1.1`, `@types/jsdom@28.0.3`,
`@types/node@26.1.2`. `npm ci` from this lock installs them. **No figure in this
paragraph came from a test run.**

The `tsconfig.json` change (`"types": ["vite/client", "node"]`) is the right
call and its comment states the right reason: declaring `node` explicitly rather
than letting it arrive transitively through `@types/jsdom`'s
`/// <reference types="node" />`.

`web/tsconfig.test.json` — took theirs wholesale. **Verified, not assumed:**
main's include list is `["src/**/*.test.ts", "src/**/*.test.tsx",
"src/**/*.spec.ts", "src/**/*.spec.tsx"]`, ours was `["src/**/*.test.ts"]`.
Strict superset; nothing lost. At `d7154a4` it is byte-identical to main's.

### 3. Does the fix actually fix anything — YES, it closes a real gap, and the census is complete

**Client side: 4 href bindings in `web/src`, 4 accounted for, 0 unguarded.**

| binding | disposition |
|---|---|
| `ft-inspector-code.ts:34` (PR link) | **newly guarded** via `safeHref` |
| `ft-inspector-meta.ts:27` (external source) | **newly guarded** via `safeHref` |
| `ft-toolbar.ts:465` ("View on GitHub") | exempt, correctly: URL is literal `https://github.com/` + a `remoteId` already matched against `GITHUB_REPO_RE`; scheme is not attacker-controlled |
| `ft-toolbar.ts:496` (`a.href = url`) | exempt, correctly: locally minted `blob:` URL from `URL.createObjectURL` for a download |

Both exemptions are declared with reasons in `url-binding-scan.test.ts`'s
`ALLOWED` list (lines 243-268), and the scanner fails on a stale entry as well
as on an undeclared binding, in both directions. That is a better structure than
a comment.

**What the branch ADDS that was not there before, concretely:**

- Two render sinks that previously bound a server-supplied string straight into
  `href` now allow-list the scheme. For `PullRequest.url` this is **not defence
  in depth — it is the only control**: I verified at `convert.go:587-588` that
  `taskToProto` copies `PullRequests[].url` verbatim with no read-path
  validation, exactly as `safe-url.ts:8-12` claims. A legacy row holding
  `javascript:…` written before `urlvalidate.go` existed reaches the browser and
  is stopped only here.
- Server read-path scrubbing at `convert.go:557` (`remote_url`) and
  `convert.go:570`/`:975` (`sanitizeRemoteData` over `task.remote_data` and
  `collection.remote_data`) — which closes the hole where the rejected string
  rode out one field away from the field that had just been cleaned.
- Recursive traversal at every depth (`maxRemoteDataDepth = 32`), against the
  measured fact that `structpb` does serialise nested maps.
- Export is scrubbed too (`export_import.go:139`), so export→import round-trips
  do not re-inject.

**This is not only structure.** The pre-existing markdown chain (0/20 bypasses)
does not touch `href` bindings at all, and the branch's own added comment at
`ft-inspector-desc.ts:231-237` says so explicitly and correctly — it refuses to
let DOMPurify be read as a compensating control for the URL policy. That
distinction being written down is itself worth something.

`safeHref`'s no-base `new URL()` decision, and its honesty about what that does
and does not guarantee (correct for the SCHEME, **not** for the HOST, with the
base-dependent fixtures marked and the markers themselves checked), is the
strongest piece of reasoning in the diff.

### 4. Two-sided acceptance — one genuine over-denial found in 16 probes

I drove 16 URLs through `validateURLField` directly (temporary test file in a
pinned clone, removed afterwards; ROOT=`/tmp/x2`):

**ACCEPTED (10):** `https://github.com/o/r/pull/1`, `http://localhost:8080/x`,
`https://api.github.com/repos/o/r/issues/1/labels{/name}` (RFC 6570 template —
good, GitHub's REST payloads are full of these),
`https://例え.jp/path` (IDN), `https://user:pw@example.com/x`,
`https://example.com/#frag`, `HTTPS://EXAMPLE.COM/X`, `https://192.168.1.1:3000/`,
`https://[::1]:8080/`, `https://gitlab.internal.corp/g/p/-/merge_requests/7`.

**REJECTED (6):**

| input | verdict |
|---|---|
| `mailto:a@b.com` | deliberate, documented at `safe-url.ts:24-28` |
| `//example.com/x` | deliberate — accepting it launders an attacker-chosen origin |
| `github.com/o/r` | scheme-less; was a broken relative link before |
| `/relative/path` | same |
| `https://example.com/a b` | **GENUINE OVER-DENIAL — the one I am naming** |

**The one to name: an unencoded space.** `validateURLField`'s pre-parse loop
(`urlvalidate.go:56-61`, `r <= ' '`) rejects any URL containing a raw space.
Copy-pasted Confluence/SharePoint/Jira URLs routinely carry one; browsers
percent-encode it silently, so a user has no reason to think it is malformed.
Consequences differ by path and neither is great:

- **Write path** — `UpdateTask` returns `InvalidArgument: "URL must not contain
  whitespace or control characters"`. Actionable, if terse.
- **Read path** — `taskToProto` (`convert.go:557`) **silently drops** the value.
  A legacy row with a spaced `remote_url` loses its External Source row entirely,
  with no user-visible explanation.
- **Import path** — `validateImportedTaskURLs` **fails the whole import**.

I do not think the pre-parse check should be removed; its stated reason (browsers
strip tabs/newlines, so `java\tscript:x` navigates as `javascript:x`) is correct
and load-bearing. **Consider** narrowing it to the characters that actually
enable the bypass — tab, LF, CR and C0 controls — and letting `0x20` through to
`url.Parse`, which rejects it anyway but with a better message. That preserves
the security property exactly and stops rejecting a merely-untidy URL.

**A second over-denial, structural rather than a rejected input.** `safe-url.ts:50-51`
states the design intent: *"Callers should degrade to rendering the raw text in a
non-link element rather than dropping the value, so a rejected URL stays visible
to the user."* Two departures:

- `renderExternalSourceLink` (`ft-inspector-meta.ts:23-25`) puts the rejected URL
  **only in a `title` attribute** and shows the fixed string "Unsupported
  external source URL". Hover-only: invisible on touch, not selectable, not
  copyable. The value does not "stay visible" in any usable sense.
  `renderPrLink` does better — the PR `id` is still rendered as text.
- That degrade branch is **unreachable in production anyway**, because
  `convert.go:557` already dropped the bad `remote_url` server-side, so
  `t.remoteUrl` is empty and `ft-inspector-meta.ts:629` renders `nothing`. Not a
  defect — it is the defence-in-depth layering `safe-url.ts:13-17` describes —
  but the client's stated UX promise cannot fire for this field, and the code
  reads as though it can.

Both **Optional**.

### 5. The merge itself — nothing created that neither parent had

- **`bbea1e5`** (main `7a2ad51` into the union): the recorded per-hunk
  resolution matches the tree. `tsconfig.test.json` took theirs and theirs is a
  verified strict superset; `package.json` hunk 1 theirs, hunk 2 ours restored,
  all three devDependencies present.
- **`b54c573`** (main `43bd206` into `34ce4da`): I reproduced it independently in
  `/tmp/xtrial` — clean auto-merge, zero conflicted files. The only production
  file both sides touched is `internal/server/server.go`, and I verified byte-wise
  that the result is ours plus exactly main's five hunks (§0). Nothing invented.
- **`d7154a4`**: `b54c573` + two documentation files. Inert.

**The one thing the merge did create is C-1**, and it created it *by not
conflicting*.

### 6. Vacuous tests — one named, and it is documented rather than defective

Mutation runs, ROOT=`/tmp/x2`, SHA=`b54c573`, tree restored and re-verified green
(`# pass 5 # fail 0`) between every mutant. Web figures on node 20, full suite
invoked directly with `node --test .tmp-test` (i.e. what CI *would* run if the
held hunk were resolved — **not** what `npm test` runs today).

| # | mutation | result |
|---|---|---|
| M1 | `renderPrLink` uses raw `url` instead of `safeHref(url)` | **KILLED** — 2 files red |
| M2 | `'javascript:'` added to `SAFE_SCHEMES` | **KILLED** — 1 file red |
| M3 | `if (parsed.hostname === '') return undefined;` deleted | **SURVIVED** — 5 pass, 0 fail |
| M4 | `renderExternalSourceLink` uses raw `remoteUrl` | **KILLED** — 2 files red |
| M5 | M2 **and** M3 together | **KILLED** — `safe-url.test.js` red |
| G1 | `validateURLField` neutered to `return nil` | **KILLED** — 10 top-level Go tests red, incl. `TestValidateURLField_RejectsScriptBearingSchemes`, `TestSanitizeRemoteDataScrubsEveryURLCarrier`, `TestTaskToProtoScrubsRemoteDataURLCarriers` |

**The one to name, as instructed: `testHostGuardIsAFailClosedBackstop()`,
`web/src/util/safe-url.test.ts:166`.** It survives deletion of the exact line it
pins (M3). It is **not** a defective test: `safe-url.ts:109-115` states that the
line is unreachable while `SAFE_SCHEMES` holds only WHATWG special schemes, and
`safe-url.ts:139-141` scopes the test's promise precisely — *"goes red the moment
a non-special scheme is allow-listed, i.e. the moment this branch stops being
unreachable."* M5 confirms that scoped promise is true. So the honest statement
is: **the guard line is deliberately-retained dead code, and its test is a
conditional guard whose condition is currently false.** Both facts are written
down next to the code. Reporting it because you asked for anything that cannot
be killed by a plausible mutation — not as a finding against the branch.

Everything else I attacked died. Notably, the two component guards are pinned
through the **exported** `renderPrLink`/`renderExternalSourceLink` rather than
through a test-local copy — the comments at `ft-inspector-code.ts:19-26` and
`ft-inspector-meta.ts:14-19` record that a previous version tested a copy and
shipped green with the guard removed. M1 and M4 confirm that hole is closed.

---

## Nit / Optional

- **O-1. Narrow the control-character pre-check** to exclude `0x20` — see §4.
- **O-2. `renderExternalSourceLink` should render the rejected URL as text**, not
  only in `title` — see §4. `renderPrLink` is the model.
- **O-3. Orphaned: `web/scripts/run-tests.mjs`, 331 lines.** No longer invoked by
  anything since `bbea1e5` adopted main's runner. Only surviving references are
  its own line 324 and documentation. `reports/dev-xss-union.md:724` already
  acknowledges it is "left in the tree, no longer invoked". **Asking, not
  deleting:** it may be worth keeping until EM-CI's shared runner lands, since it
  is the only artefact that ever enforced a non-zero assertion count. Your call —
  but it should not sit unowned indefinitely.
- **O-4. The 483→"whatever `node --test` counts" receipt loss** is recorded in
  `bbea1e5`'s message and handed to EM-CI. Noting it survives at `d7154a4` and is
  still open, so it is not lost when this branch merges.

## FYI

- **F-1. `internal/webguard`'s census walker hard-errors if `web/node_modules` is
  a *symlink*.** Reproduced: `walking the web tree: reading .../web/node_modules:
  is a directory`, failing `TestWebRemoteDataConsumersAreDeclared`,
  `TestWebRemoteDataCensusIsNonVacuous`, `TestWebCensusDescendsIntoShippedSource`.
  **This is my own artefact and not a CI problem** — `skipDirs`
  (`remotedata_consumers_test.go:120-121`) prunes `node_modules` and `dist` by
  basename, and `fs.WalkDir` reports a real directory correctly; CI's `npm ci`
  (`ci.yml:71-73`, before `go test` at `ci.yml:238`) creates a real directory.
  But a symlinked `node_modules` is exactly the setup that produced the false
  green in r9's trial merge, so the next agent to reach for that shortcut will hit
  this. It fails loudly, which is the right failure. Recording the reproduction so
  nobody spends twenty minutes on it.
- **F-2. Denominator, confirming your correction:** `go list ./...` is **33 of 33**
  on this branch (ROOT=`/tmp/x3`, SHA=`d7154a4`), **32 of 32** on main — the
  difference is `internal/webguard`, which is this branch's. Both right for their
  own tree, as you said.
- **F-3. The `web/dist/.gitkeep` design is a genuine positive control**, and it is
  the inverse of this track's recurring defect: a tree with no built frontend
  embeds a stub and `WebUI()` returns `ErrWebAssetsNotBuilt` rather than serving a
  blank dashboard. Absence reported as an error instead of read as success.
  Agreed, and worth keeping visible.

## Positive Feedback

- **`safe-url.ts` is the best-documented file in this diff and the documentation
  is *accurate*.** Every claim I spot-checked held: the per-binding weight
  analysis (lines 8-17) matches `convert.go:557` vs `:587`; the no-base rationale
  (53-63) is correct; and lines 30-42 retract a previous false claim
  ("a scheme the client allows and the server rejects is unreachable") and replace
  it with a measured 9-of-42 divergence pinned in a fixture file read by *both*
  languages' suites. Comments that name their own prior errors are rare and this
  one does it three times.
- **The `ALLOWED` structure in `url-binding-scan.test.ts` is the right shape** for
  an exemption list: reasons are mandatory, entries go stale loudly, and the
  `viaSafeHref` flag is separately verified. Better than the comment it replaces.
- **`sanitizeRemoteData` / `validateRemoteDataURLs` are held in step by
  `TestSanitizeAndImportAgreeAtEveryDepth` rather than by a sync comment**, and the
  one deliberate asymmetry (non-string scalar under a URL-bearing key: dropped by
  the sanitizer, not an import error) is pinned rather than left to drift. The
  `urlBearingKeyWords` predicate replacing a "keep this in sync" list is the right
  call — the comment at `urlvalidate.go:90-98` shows the list was already wrong
  (`html_url`, written twice by the GitHub adapters, validated by nobody).
- **The `ft-app.ts` change deletes rather than wraps.** The private
  `isCollectionWritable` method is gone, both getters call the shared function
  directly, and `capabilities.test.ts` asserts no local copy is reintroduced.
  One implementation, nothing to drift, one fewer concept for a reader.

## Test Coverage

New paths are covered and the coverage is non-vacuous where I could attack it
(6 mutants, 5 killed, the survivor explained and scoped). Server: 1160 Go tests
executed, 0 failure lines under CI's own matcher (ROOT=`/tmp/xtrial`). Gaps:

- **The web half does not execute at `d7154a4`** (C-1) — held, understood, not
  counted against the branch, but the coverage is nominal until the shared
  runner lands.
- **45 of 47 Go tests are outside the membership manifest** (R-1).
- No test asserts the *degrade-to-visible-text* UX contract for
  `renderExternalSourceLink` beyond the `title` attribute (O-2).

## Backward Compatibility

No wire-format change: no proto field added, removed or retyped. Behavioural
compatibility changes, all intentional and all in the deny direction:

- `UpdateTask` and `ImportCollection` now reject previously-accepted URL values.
  Import rejects the **whole document** on one bad URL-bearing key at any depth.
- Read paths now silently drop values that previously reached the client
  (`remote_url`, and any URL-bearing `remote_data` key at any depth). A client
  that depended on a non-http(s) `remote_data` value will see the key vanish.
- Export output is now scrubbed (`export_import.go:139`), so an export is no
  longer a faithful copy of stored `remote_data`.
- `af9ea8c` narrows dashboard writability for non-GITHUB external platforms —
  **out of scope, routed (R-3)**.

## Final Verdict

**REQUEST CHANGES**

Blocking, and both are the branch's own text:

- **C-1** — four in-branch sites assert the URL-scheme guard runs when it does
  not; two of them make `RUN npm test` a no-op guard in the release path.
  Fixable by editing the four texts. **The held `package.json` hunk is not
  touched and I am not asking for it to be.**
- **R-2** — dangling `docs/url-policy.md` citation, `ft-inspector-desc.ts:240`,
  one line, already deferred once in r6.

Not blocking:

- **R-1** — measured and real, but the remedy is adopted and EM-owned (one named
  commit at merge time). Listed so it cannot be lost.
- **R-3** — out of scope by the owner fence; needs your ruling or the
  architect's, not mine.

The URL-scheme work itself is sound, the union ruling is honoured, and the
dependency manifest is complete. I am not asking for the held hunk to be
resolved and I am not counting the red suite-manifest against the branch. All
three blockers are text or manifest edits; none requires touching the security
code, and none should take long.

---

# RE-VERIFICATION PASS at `70790b4` (14:54Z tasking)

Scope: C-1 and R-2 only, plus the manifest gate input and a judgement of r9's
R-3 measurement. **Not a re-review.** No settled item re-opened.

**Provenance.** ROOT=`/tmp/u2`, fresh clone from the local path, HEAD `70790b4`.
`porcelain -uall` = 0 and **0 gitignored entries** for every Go/git measurement.
For the npm measurements only, `npm ci` was run inside the clone: `porcelain
-uall` stayed 0 while `web/node_modules/` and `web/.tmp-test/` were present and
gitignored. **Stating that because porcelain-empty is not tree-unchanged.** Node
v20.20.2; `ci.yml` pins 22.

Ancestry confirmed: `aa08f1a`, `3006492`, `e35e8d6`, `d7154a4`, `34ce4da`,
`43bd206`, `af9ea8c` are all contained in `70790b4`.

## C-1 — NOT RESOLVED. INVERTED, AND IT IS FIVE SITES, NOT FOUR. **BLOCKING**

r9's `e35e8d6` was correct **when written**. Then `dfc26dc` adopted the shared
runner and inverted the facts underneath it:

```
web/package.json  "test":  node scripts/run-node-tests.mjs     (DISCOVERS files)
npm test @70790b4:  EXIT=0, 6 files, 6 pass, 0 fail
  safe-url.test.js        RAN  (204 assertions)
  url-binding-scan.test.js RAN (157 assertions)
```

**The guard now runs. All five sites say it does not.** Nothing after `e35e8d6`
touched them — `git log e35e8d6..70790b4 -- agents.md Dockerfile
Dockerfile.server` is empty and the diff is byte-empty.

| # | site | now-false assertion |
|---|---|---|
| 1 | `agents.md` "Quick Start" (~40-45) | "As of this commit, `npm test` does NOT execute that guard… 1 of the 5 tracked files runs" |
| 2 | `agents.md` "Build And Test" (~111-121) | "Neither of those two files is executed by `npm test`… 4 of the 5 tracked web test files compile and never run" |
| 3 | `Dockerfile:6-12` | "WARNING: … `RUN npm test` BELOW DOES NOT EXECUTE THE URL-BINDING GUARD" |
| 4 | `Dockerfile.server:6-12` | same, **in the production image** |
| 5 | **`ft-inspector-desc.ts` (~245)** | "neither of those two test files is executed by `npm test` as of this commit" |

`CLAUDE.md` is a symlink to `agents.md`, so sites 1-2 surface twice: **7
surfacings from 5 source sites.**

**Site 5 was created by the R-2 fix itself.** The corrected citation carries the
C-1 caveat forward, so fixing R-2 minted a sixth false claim in the same commit
that removed one. Also note the denominator moved: the text says **5** tracked
web test files; at `70790b4` there are **6** (`capabilities.test.ts`,
`render-sink-xss.test.ts`, `assertions`, `safe-url`, `url-binding-scan`,
`task-ready`).

**Direction, as instructed.** The sign is opposite and so is the risk. The
original C-1 promised protection that did not exist. The inversion denies
protection that *does* exist — it tells a maintainer the guard in the release
path is worthless, which is an invitation to delete it. Less immediately
dangerous, still false, still in `Dockerfile.server`.

**No check catches this.** `ci-suite-manifest.mjs` verifies which files
*execute*; nothing verifies whether prose *about* execution is true. That is why
C-1 recurred through a green gate.

## R-2 — RESOLVED

`docs/url-policy.md` still does not exist, and **no source file cites it**. r9
corrected the citation to point at the executable policy (`safe-url.ts`,
`safe-url.test.ts`, `url-binding-scan.test.ts`) rather than inventing a prose
doc — the right call, and argued. The single remaining `url-policy` string is in
`.design/project-log/2026-07-29-dev-xss-r6.md:240`, a historical record of the
flag. Correctly left alone.

## Manifest as a CI gate input — SAFE

Treated as code, per instruction. `aa08f1a` = **501**, `70790b4` = **503**,
**+2 / −0**. No removals, so no test can silently leave the asserted set.
MISSING=0.

## Judgement of r9's R-3 measurement — conclusion SOUND, two defects in support

**Sound, and I verified it independently at `70790b4`**: the branch predicate is
`(platform === GITHUB) && <main's predicate>`, a strict subset, so it **permits
nothing new** — the proof is checkable and it checks out. Both callers
(`ft-app.ts:227-231`, `:238-241`) short-circuit `FARMTABLE` before calling, on
*both* sides, so the FARMTABLE row of its denial table is right. Genuinely
two-sided, tri-stated, and it declined to fix. Good work.

Two defects that must not be relied on as written:

1. **Its lead artefact correction is false.** It states `web/src/capabilities.ts`
   "does not exist on main — not at `43bd206`, not at `aa08f1a`, and not at the
   common ancestor `901670e`." **It exists at all three** (entered main via
   `2095838`, #118; 105 lines at `aa08f1a` vs 230 on the branch). Its follow-on
   claim that diffing against `43bd206:web/src/capabilities.ts` "returns empty"
   is therefore also false — that diff is large. **The comparison it chose was
   nevertheless the right one**, because main's `capabilities.ts` does not
   *define* `isCollectionWritable` (0 occurrences); main's lives at
   `ft-app.ts:254` as a private method. Right target, wrong reason — and the
   wrong reason is an artefact claim, on the day artefact claims have cost this
   track twice.
2. **Measured at `439b309`, which is not an ancestor of `70790b4`** and is not
   present in a clone of the union at all. The substantive claims hold at the
   tip because I re-derived them there; they were not carried there by r9.

## Frozen predictions P1-P6 vs actual — reported, not adjusted

| # | predicted | actual @`70790b4` | |
|---|---|---|---|
| P1 | `ci-suite-manifest` EXIT=0, 5/5/0 | EXIT=0, **6/6/0** | **verdict right, denominator wrong** — I froze P1 before r8's `render-sink-xss.test.ts` merged |
| P2 | MISSING=0 passes; UNEXPECTED 0 or 45 | manifest 503, MISSING=0, **UNEXPECTED=45** | CORRECT (the "else" branch; the merge-time commit has not landed) |
| P3 | EXIT=0, 548, 0 failures, 0 unterminated | exactly that | CORRECT |
| P4 | vet EXIT=0, 0 findings, 33/33 | exactly that | CORRECT |
| P5 | guard files pass on node 22 | **NOT MEASURED** — node 20 only | UNRESOLVED. The runner is *designed* to remove the divergence (it hands node explicit paths, the only form both versions agree on), but that is inference |
| P6 | same 5 kills, 1 survivor | **NOT RE-MEASURED, deliberately** | re-running mutation arms is re-review, which is out of scope |

P1 is the useful miss: my prediction was keyed to a file count that a
*different* leg's merge changed. A frozen prediction can be invalidated by
someone else's landing, not only by being wrong.

## The masking rule, applied

`ci-suite-manifest.mjs` is **now green** (EXIT=0, 6/6/0) where it was held
expected-red. **The masking condition is gone** — its red would now be
distinguishable, which is a real gain and removes half the cause of the original
C-1. Nothing I am approving here has a red indistinguishable from an existing
red. But note the limit above: this guard cannot see C-1's inversion at all,
because it checks execution, not claims about execution.

## Verdict at `70790b4`: **NOT MERGEABLE**

Single blocking item: **C-1, inverted, 5 source sites / 7 surfacings.** Text
only. Everything else in scope is clean: R-2 resolved, manifest gate input safe,
R-3 measured-not-fixed with its conclusion independently confirmed.

---

# FINAL RE-VERIFICATION at `439b309` — **MERGEABLE: YES**

ROOT=`/tmp/u3`, fresh clone, HEAD `439b309`. `porcelain -uall` = 0 and **0
gitignored entries** for all Go/git figures. For npm figures, `npm ci` was run
in-clone: porcelain stayed 0 while `web/node_modules/` and `web/.tmp-test/` were
present and gitignored — **stated, because porcelain-empty is not
tree-unchanged**. Node v20.20.2; `ci.yml` pins 22.

## C-1 — RESOLVED, direction verified

`439b309` re-trues all sites, and I checked the **direction**, not just presence:

| site | now asserts | true? |
|---|---|---|
| `agents.md:38-44` | `npm test` runs `run-node-tests.mjs`, which **discovers** every `src/**/*.{test,spec}.{ts,tsx}` | ✅ |
| `agents.md:110-115` | both guard files execute; `RUN npm test` in both images **does** fail on a red guard | ✅ |
| `Dockerfile:6-16` | guard **does** execute here | ✅ |
| `Dockerfile.server:6-16` | same, **artefact named** as the production image | ✅ |
| `ft-inspector-desc.ts:244-247` | both test files **are** executed by `npm test` | ✅ |

Verified by execution, not by reading: `npm test` **EXIT=0, 6 files, 6 pass, 0
fail**, with `safe-url.test.js` and `url-binding-scan.test.js` both in the run.

**The fifth site was caught.** I reported at `70790b4` that the inversion hit
five sites, the fifth being one the R-2 fix itself minted in
`ft-inspector-desc.ts`. `439b309` includes that file. Nothing is left stale.

**No cardinality is hardcoded anywhere in the new text.** That is the right
lesson drawn: the "5 tracked files" figure went stale inside an hour when a
sixth landed. The text now names the *mechanism* and points at `make
suite-manifest` as the executable form.

## R-2 — RESOLVED

No `url-policy` citation in any source file. The sole surviving mention is the
historical record in `.design/project-log/2026-07-29-dev-xss-r6.md`.

## `.github/expected-go-tests.txt` as a GATE INPUT — SAFE

`aa08f1a` = **501**, `439b309` = **503**, **+2 / −0**. **Zero removals**, so no
test can silently exit the asserted set. MISSING=0.

## Frozen P1-P6 vs actual — reported without adjustment

| # | predicted | actual @`439b309` | |
|---|---|---|---|
| P1 | EXIT=0, **5/5/0** | EXIT=0, **6/6/0** | **MISS on the denominator, hit on the verdict.** I froze P1 before r8's `render-sink-xss.test.ts` merged |
| P2 | MISSING=0; UNEXPECTED 0 or 45 | 503/548, MISSING=0, **UNEXPECTED=45** | HIT |
| P3 | EXIT=0, 548, 0 fail, 0 unterminated | exactly that | HIT |
| P4 | vet EXIT=0, 33/33 | exactly that | HIT |
| P5 | guard passes on **node 22** | **NOT MEASURED** — node 20 only | UNRESOLVED, and the one row I still cannot underwrite |
| P6 | 5 kills, 1 survivor | **not re-measured** | out of scope: re-running arms is re-review |

Also green here: `tsc --noEmit` EXIT=0, `go build` implied by vet EXIT=0.

**P1's miss is the informative one**: a frozen prediction was invalidated by a
*different leg's* merge, not by being wrong. Pre-registration catches drift in
the world as well as error in the predictor.

## Differential check of the new text's own promise

The new Dockerfile text says `make suite-manifest` "catches the regression."
Tested it — **deliberate mutation, dirt is the point**, `web/package.json`
narrowed back to the single hardcoded file, restored after, porcelain back to 0
and green re-confirmed:

- **Mutant → `ci-suite-manifest.mjs` EXIT=1.** So the promise holds: the
  regression *is* caught and the build *does* fail. **C-1's claim is true.**
- **But it fails by crashing, not by reporting.** `ReferenceError:
  tsconfigFiles is not defined` at `scripts/ci-suite-manifest.mjs:572` — the
  symbol is referenced once and defined nowhere, on the code path taken when the
  test script is *not* a discovery runner.
- **Inherited, not branch-introduced.** The identical bug is on main at
  `aa08f1a`, and `git diff aa08f1a 439b309 -- scripts/ci-suite-manifest.mjs` is
  empty: the branch never touched the file.

**Not blocking**, and not mine to fix (that file is permanently off-limits by
instruction). Filed as a one-liner. Worth flagging to whoever owns it: on the
one regression it exists to catch, its red is a stack trace rather than "these
files never execute" — a red that invites someone to fix the crash instead of
the regression.

## R-3 — I do not require a change, and I answer the explicit question

The EM asked whether it must come **out** to keep the branch coherent. **No.**
It is one-directional (permits nothing — I re-derived the subset proof myself),
it is pinned by `capabilities.test.ts` across the whole platform enum, and
removing it now would itself be an unreviewed behavioural change landing late.
"It is unrelated" is not sufficient grounds, and I am not offering it.

**One condition on the routing, from r9's own NOT-MEASURED line:** whether the
server enforces the same restriction was never traced. So this is a **UI
affordance change of unmeasured server backing**, and the routed question must
not treat the UI denial as an authorisation control.

### Correction to the artefact claim, which is repeated in the tasking

> "web/src/capabilities.ts DOES NOT EXIST on main at 43bd206 or aa08f1a."

**Measured at `439b309`, ROOT=`/tmp/u3`, porcelain 0 — it does exist, at all
three SHAs:**

| SHA | `web/src/capabilities.ts` | defines `isCollectionWritable`? |
|---|---|---|
| `43bd206` | PRESENT, 105 lines | **no** (0 occurrences) |
| `aa08f1a` | PRESENT, 105 lines, blob `7e19801` | **no** (0 occurrences) |
| `901670e` | PRESENT, 163 lines | **no** (0 occurrences) |
| `439b309` | PRESENT, 230 lines | yes (1) |

It entered main via `2095838` (#118). The follow-on claim that diffing the named
path "returns empty" is also false: `git diff --numstat aa08f1a 439b309 --
web/src/capabilities.ts` = **125 added, 0 removed**.

**The comparison r9 chose was nonetheless the correct one** — main's predicate
really is the private method at `ft-app.ts:254`, because main's
`capabilities.ts` does not *define* the function. Right target, wrong reason.
The false-negative hazard described is real, but it comes from grepping for a
**file** when the question is about a **function**. That distinction matters more
than the erratum: the fix is to resolve the *symbol*, not the path.

**A note on my own instrument.** My first run of this check used broken shell
quoting and printed "PRESENT (0 lines)" for every SHA. I nearly reported it. It
is re-run above with correct quoting — the same failure mode this track has been
cataloguing all day, in my own hands, on the check I was using to correct
somebody else.

## VERDICT at `439b309`: **MERGEABLE — YES**

No blocking items. C-1 resolved and direction-verified, R-2 resolved, gate input
safe, R-3 accepted as the EM's routing decision. Outstanding non-blocking:
P5 (node 22) is unmeasured by me and only CI can settle it.

---

# WIND-DOWN PRESERVATION PASS (15:33Z–15:45Z)

**Canonical tested against: `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f`**, resolved
**by name** (`git -C /workspace/farmtable rev-parse main`), freshly fetched into each
clone as `refs/canonical/main`. `SCION_WORKSPACE_MODE=shared-plain`, so `/workspace/*`
is shared; my container-only surface is `/tmp/*`.

## Result: 21 objects existed nowhere outside my container. All 21 are preserved.

**Durability predicate (the one that bears on loss):** is the object absent from
`/workspace/farmtable`, tested with `cat-file -e`, stderr visible.
**ABSENT: 21 of 608** distinct candidate objects across my six clones.

The ancestry number, reported but **not** the durability finding: of my six clones'
refs, every one is reachable from canonical main except
`refs/remotes/origin/task-state-web-ui-v2` (`633f8f2`) — not my work, and canonical's
own checked-out branch.

The 21 are the **pre-squash history of the XSS work** (authors `dev-xss-url`,
`dev-xss-r2`, one `Scion Agent`), including **`625550856`, the pre-amend version of
the C-1 fix commit itself** — "docs: correct four false claims that npm test runs the
URL-scheme guard (C-1, R-2)", touching `agents.md` and `ft-inspector-desc.ts`. That
one existed in **no** `/tmp` clone; only in the leg clone, unreachable.

## Bundles (both left on disk, delta auditable)

| bundle | bytes | refs | orphans restored |
|---|---|---|---|
| `bundles/review-xss-union.bundle` (v1) | 2,607,640 | 28 (21 preserve) | **21/21** |
| `bundles/review-xss-union-v2.bundle` (v2) | 2,607,045 | 28 (21 preserve) | **21/21** |

Verified **by restore** into empty repos, not by `git bundle verify`.

## Defect 7 reproduced, with the delta

A true control from `/tmp/x2`, where the 20 orphans were **still unreachable** at
bundle time:

| bundle | bytes | orphans after restore |
|---|---|---|
| `/tmp/x2` plain `--all HEAD` | 2,600,144 | **0 / 21** |
| my v2, preserve refs created **first** | 2,607,045 | **21 / 21** |

Reachability was the variable, exactly as the EM's retraction states.

## Three corrections to the preservation instruction, measured on git 2.54.0

1. **Defect 3 is false here — independently confirmed.** `--all` *does* cover
   `refs/preserve`: `for-each-ref` total 28, `refs/preserve` 21, `rev-parse --all`
   28. `--all` means every ref under `refs/`.
2. **`git bundle verify` failed on bundles that restore perfectly** — because I ran
   it from `/workspace`, which is not a git repo. Run from inside a repo, both pass.
   So `verify` is unreliable in **both** directions: the EM saw it false-PASS, I saw
   it false-FAIL. Neither direction is a reason to trust it; the restore is the check.
3. **Trap (a) avoided:** a bare `git fetch /workspace/farmtable` returns
   `FETCH_HEAD=633f8f2` (`task-state-web-ui-v2`), not main. I named `main:` explicitly
   in all six clones and verified `refs/canonical/main = 2982ffd` in each.

## An eighth defect, in my own hands: zsh does not word-split

My first orphan sweep reported `439b309` **absent from canonical** — contradicted by a
direct check showing it present *and* an ancestor of main. Cause: this host is zsh,
where unquoted `for s in $shas` iterates **once** with all SHAs concatenated, so git
returned `rc=128` ("Not a valid object name <two SHAs>") and my `if !` read that as
"absent". A clean, plausible, entirely fabricated table — trap (b), in a different
shell dialect. Caught only because stderr was visible and because the result
contradicted a check I had already run. Re-run with `while read`: the real answer is 21.

This is the third time today this exact class has bitten this leg (`$r:web` zsh history
modifier; `PIPESTATUS` after a pipe; now word-splitting). **The instrument, not the
subject, was wrong every time.**

## Non-ref artefacts (invisible to every sweep and bundle above)

- **Arm definitions written out** to `reports/review-xss-union-ARM-DEFINITIONS.md`.
  **My mutation arms produced NO COMMITS** — every arm was a working-tree edit applied,
  measured and reverted, so no object exists and no bundle can carry them. The prose is
  the recoverable form.
- **Uncommitted project log copied** to `reports/review-xss-union-PROJECT-LOG.md`.
  Still `??` untracked in `/workspace/farmtable`; no ref points at it.

## Residual exposure I did NOT act on

The 21 are absent from canonical, and in the leg clone
`/workspace/farmtable-dev-xss-r9` they are present but **unreachable** — prunable by a
routine `git gc`, with the freeze lifted at 13:29Z. The `/scion-volumes` bundle is now
their durable copy. **Recommend** pinning them into canonical as
`refs/preserve/xss-presquash/*`, as the EM did for the four worktree-detached tips. I
did not do it: it writes to shared canonical state and was not asked of me.

## ADDENDUM 15:48Z — set identity confirmed, and canonical moved mid-comparison

**CONFIRMED: my 21 is a strict subset of `dev-xss-r9`'s 49 `refs/preserve/reflog/*`.**
Compared SHA-wise, not by integer: only-in-mine **0**, in-both **21**, only-in-r9 **28**.
Control on `comm` itself ran 1/1/1. Same objects — not two different 21s.

**Canonical moved between my two measurements.** At 15:40Z the 21 were absent from
canonical (present=0, absent=21). At 15:47Z: present=21, absent=0, all pinned as
`refs/preserve/legfetch/dev-xss-r9/preserve/reflog/<sha>`. Instrument controls passed
in both directions at both times, so this is a real state change, not a broken probe.

Consequence worth flagging: **re-deriving r9's at-risk number now yields 0 of 49, which
makes r9 look like it over-reported. It did not** — the filter is reading a later clock.
The 15:40Z measurement has not aged into a false claim; it was superseded by an action.

**Pinning is load-bearing, verified:** all 21 are **non-ancestors of main** (ancestors=0,
non-ancestors=21) and all 21 are pointed at by a real ref (pinned=21, unpinned=0).

Durable copies of the 21: canonical refs (EM's), plus `review-xss-union.bundle` and
`-v2.bundle`, both restore-verified 21/21. `/tmp/xclean` is container-only and dies
with this leg. No further action requested from me; attribution refs under my leg name
would be pure aliases of objects already pinned.

## ADDENDUM 15:50Z — the fsck-vs-reflog law, corrected for this leg

The operation-wide finding was filed as "the fsck sweep found nothing at risk; the
reflog sweep found everything at risk." **That does not hold for review-xss-union.**

| clone | fsck-absent | reflog-absent |
|---|---|---|
| `/tmp/x2`, `/tmp/x3`, `/tmp/xtrial` | **20** each | 0 |
| `/tmp/u2`, `/tmp/u3` | 0 | 0 |
| leg clone `farmtable-dev-xss-r9` | 0 | **21** |

Intersection here was **20, not zero**; fsck found 20 of the 21 at-risk objects. The
reflog sweep's unique marginal catch was exactly one — `6255508`, which existed in no
`/tmp` clone.

**Why, and it decides the wording:** the sweeps are not intrinsically biased. Which one
sees an object depends on *which clone you run it in*. My `/tmp` clones were cloned
**from** the leg clone, so objects that were reflog-only in r9's tree arrived in mine as
ref-less objects — fsck's natural territory. Same 20 objects, different sweep, purely
because of clone topology.

**Accurate law:** neither sweep is complete; which one catches a given object depends on
where you stand; the intersection is not reliably zero. Run both, in every clone. The
operational conclusion is unchanged — the reflog sweep is cheap, easiest to skip, and
produced the marginal catch on every leg including this one.

## ADDENDUM 15:55Z — filesystem namespace: my clones are container-local

`stat -c '%d %n'`:

| st_dev | path |
|---|---|
| **184** (overlay, container-local) | `/tmp/xclean` (holds all 21), `/tmp/u2`, `/tmp/u3`, `/tmp/x2`, `/tmp/x3`, `/tmp/xtrial` |
| 2049 (`/dev/root`, host-backed) | `/workspace`, `/workspace/farmtable`, `/workspace/farmtable-dev-xss-r9`, `/scion-volumes/scratchpad` and both my bundles |

184 differs from `dev-safeurl-union`'s 1048612, so `/tmp` is **per-container**, not a
shared mount. **The EM's namespace cannot reach any of my six clones.**

**Do not fetch `/tmp/xclean` by path from another container.** It resolves to *that*
container's `/tmp`, and `xclean` is a plausible generic name — so the fetch can succeed
against an unrelated repository and exit `rc=0`. Same shape as
`farmtable-scopedeny-93` vs `dev-scopedeny-93`.

**Residual exposure: zero, by two independent routes.** Re-verified unpiped with both
controls firing in the same invocation — negative arm (fabricated SHA) `rc=1`, positive
arm (main) `rc=0`, my 21 in canonical `present=21 absent=0` — and both bundles sit on
`/dev/root`.

**The directional asymmetry worth carrying forward.** My 15:40Z figure ("absent from
canonical = 21 of 608") was taken *from inside the container, looking out* at
`/workspace`. That direction works: overlay can read `/dev/root`. An EM-side sweep runs
the opposite direction and cannot. Both produce NOT-FOUND, so the difference is
invisible from the EM's end. **A leg-side measurement of "absent from canonical" is
sound; an EM-side sweep of a leg is not.** The remedy is therefore not "sweep harder"
but "require each leg to report its own `st_dev` and its own absent-count."

Against **host** loss a scratchpad bundle is a weak copy; against **container** loss —
today's live risk — it is a strong one. The bundle is on `/dev/root`; the clone is on
overlay 184. The bundle already outlives the container and the clone does not.

## ADDENDUM 16:10Z — store-level population, and a defect in my own earlier denominator

Probed with `git cat-file --batch-all-objects --batch-check='%(objecttype) %(objectname)'`,
bare spelling, against host-backed `/workspace/farmtable`.

| repo | all objects | **commits** | present | **absent** | other | for-each-ref | `rev-list --all` |
|---|---|---|---|---|---|---|---|
| `/tmp/u2` | 4195 | 467 | 467 | **0** | 0 | 7 | 467 |
| `/tmp/u3` | 4195 | 467 | 467 | **0** | 0 | 7 | 467 |
| `/tmp/xclean` | 7359 | 1066 | 1066 | **0** | 0 | 28 | 488 |
| `/tmp/x2` | 7352 | 1065 | 1065 | **0** | 0 | 7 | 467 |
| `/tmp/x3` | 7352 | 1065 | 1065 | **0** | 0 | 7 | 467 |
| `/tmp/xtrial` | 7352 | 1065 | 1065 | **0** | 0 | 7 | 467 |
| **total** | | **5195** | 5195 | **0** | 0 | | |

**Stashes: 0** in all six clones and in the leg clone — `stash list`=0,
`log -g refs/stash`=0, `refs/stash` does not exist. Zero over a population.

**Controls, rc value printed, three visible buckets:** positive (main) `rc=0`, negative
(fabricated 40-hex) `rc=1`, malformed (`not-a-sha-at-all`) `rc=128`. Three distinct
values, so the buckets discriminate. Peeled probe: present `rc=0`, absent `rc=128`,
never 1 — consistent with the rule that `rc=1` from a peeled probe proves git did not run.

**The factor-of-N is real here and larger than ts-diff-r8's:** `rev-list --all` sees 467
where the store holds 1065. **It hides 598 commits per clone.** `for-each-ref` sees 7 refs.

### What I cannot certify

My 15:40Z figure was "21 absent of **608**". That 608 was a ref+reflog+fsck population,
**not** a store population — 8.5× too small, exactly this defect. Unlike ts-diff-r8, **I
cannot claim my answer would have been unchanged.** Between 15:40Z and now, canonical
gained 1988 `refs/preserve/*` from the EM and other legs, so today's zero is measured
against a materially larger canonical. There is no way to re-run 15:40Z.

**Honest statement:** 0 of 5195 absent *now*, store-level; and "21 of 608" **may have
been an undercount of the absent set at that time**. It was correct about the 21 it
named — all 21 were real and are now pinned — but I cannot certify it was complete.

What saves the outcome is not my population. It is that the 21 it did name were the
reflog-side catch including `6255508`, and that everything in my store is now in
canonical regardless. Had my population been the only line of defence, it would not
have been enough.

## ADDENDUM 16:16Z — defect 12 hit one of my numbers, and the object-typed gate found 14

### Correction: my `refs/preserve/*` count was silently truncated

| spelling | count |
|---|---|
| `for-each-ref 'refs/preserve/*'` (what I reported) | **3** |
| `for-each-ref refs/preserve/` (bare prefix) | **2836** |
| `rev-list --glob=refs/preserve/` | 638 |

`*` does not cross `/`. My 3 was silent zero-truncation — `rc=0`, no stderr — and it sat
in the *small-number slot* of a population control, where a truncated figure looks like
the point being made. The bare-prefix spellings I used for bundle construction and
restore verification were correct, so **no bundle was affected**; only that one figure.

### The object-typed gate: 14 objects the commit-typed gate called zero

My 16:08Z "0 absent of 5195" was **commit-typed**. Object-typed, same repos, same
canonical:

| repo | objects absent |
|---|---|
| `/tmp/xclean`, `/tmp/x2`, `/tmp/x3`, `/tmp/xtrial` | **14 each — identical set** (new-vs-xclean = 0) |
| `/tmp/u2`, `/tmp/u3` | 0 |

Composition **measured by restore, not by my prose: 6 blobs + 8 trees, zero commits.**
Arms all distinct: negative (fabricated) = missing, positive (main) = commit,
population = 7359.

**What they are:** five of the six blobs carry `<<<<<<< HEAD` — they are the
**conflict-resolution states of the union trial merge** (`git merge --no-commit`, run to
measure the merge result). The sixth is `cc443aad`, 38,442 bytes, a superseded revision
of this report. The eight trees are the index states around them.

**No commit-shaped enumerator could return these.** The reflog sweep, the fsck sweep and
the `--batch-all-objects` *commit filter* all correctly returned zero, because nothing
there is commit-shaped.

### Preserved as a pack (a bundle needs a commit; these have none)

`packs/review-xss-union-orphan-objects.pack` — 30,679 bytes, `st_dev=2049` (host-backed).
Restore-verified into an empty repo via `unpack-objects`: **14/14 present**, negative arm
fired, types 6 blob + 8 tree.

### Self-correction in the same breath

I first wrote "9 trees + 5 blobs" from eyeballing my own listing. The restore says
**6 blobs + 8 trees**. The restore is right. Recorded because a hand-tallied composition
is exactly the number that travels into a summary unchallenged.

### Revised final position

**My residual exposure was not zero when I said it was.** It was 14 objects, in all four
merge-testing clones, and only an object-typed gate could see them. Now zero by
measurement at object granularity, verified by restore.
