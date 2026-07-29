# go-test-registration — code review of `32255b0`

# VERDICT: **APPROVE**

**Risk: LOW.** No Critical findings. No Required findings. Four non-blocking findings
(O-1, O-2, F-1, F-2), all in the accompanying report rather than in the commit.

**Artefact:** `32255b05a00e59f195d5b4617e6e9f2601e07ed4` (`32255b0`), parent
`2982ffd8f3f6e231d8855b9cae7c448c2bd3144f` (`2982ffd`), branch `go-test-registration`,
leg clone `/workspace/farmtable-reg-goleg`.
**Branch HEAD is `e374367`** (docs-only, adds `.design/project-log/2026-07-29-go-test-registration.md`, 79 lines).
**Report under review:** `go-test-registration.md`.
**Reviewer:** `review-import-hardening-r3`. **Date:** 2026-07-29.
**Evidence:** `_evidence-review-goreg/` (47 files, `SHA256SUMS.txt`), on `st_dev` 2049.

The commit changes **one file** and adds **45 rows to a test manifest**. It deletes
nothing, touches no Go source, and cannot make CI less protective. Every substantive
claim in the accompanying report reproduced independently at the commit.

---

## Executive summary

`32255b0` registers 45 executed-but-unlisted Go tests in `.github/expected-go-tests.txt`.
I re-derived all four headline figures at the commit rather than accepting them: **548
executed, 503 listed at base, 11 packages, 45 added, 0 deletions.** All reconcile, and
three of them reconcile in the strongest available form — byte-identity of files rather
than equality of counts.

The one thing the report does not do is **name the population its central number is drawn
from**. 548 is not the number of Go tests in this repository; it is the number that run
without `-tags integration`. Fifty more exist and are structurally invisible to this gate.
That is finding O-1, and it does not block: the commit is right, and registering these 45
is strictly an improvement.

---

## The four commissioned checks

### Q1 — Is the head manifest a strict superset of the base manifest, and is the added set the 45 claimed, by name?

**Yes to both, proven three ways, with the instrument controlled.**

| Proof | Method | Result |
|---|---|---|
| Set-wise | `comm -23 base.sorted head.sorted` | **0 rows lost** |
| Order-wise (stronger) | `diff base head`, count `<` lines | **0 `<` lines, 45 `>` lines** — base is a strict *subsequence* of head |
| Mechanical | `git diff --numstat 2982ffd 32255b0` | **`45	0`** — one file, 45 additions, **zero deletions** |

Diff-body line counts at `32255b0`: **45 addition lines, 0 deletion lines, 1 file touched.**

**The subsequence result is the load-bearing one.** Zero `<` lines means the 503 base rows
survive not merely as a set but *in their original relative order*: rows were inserted in
sorted position, and nothing was moved, rewritten, or reordered. A pair of counts cannot
distinguish that from a coincidental rebuild that happens to contain the same members.

**Control (required, because a containment proof that cannot report a loss proves nothing):**
I removed one known row from the head file and re-ran the set-wise comparison. It reported
**exactly 1 loss**. The instrument can see a deletion; it saw none here.

**The 45, by name — and they match what the report published.** I parsed the report's own
table (`go-test-registration.md:80-124`), normalised it to package-qualified form, and
compared it against the 45 rows I measured from the commit:

- claimed-but-not-added: **0**
- added-but-not-claimed: **0**
- Control: corrupting one row of the parsed table produced **2** disagreements, so the
  comparison was live.

Distribution, measured: `internal/server` **39**, `internal/webguard` **4**,
`internal/platform/github` **2**. The full 45 are preserved in
`_evidence-review-goreg/added-45.txt` (sha256 `69685a34…`).

**A stronger identity than the report claims for itself.** The file of 45 added rows is
**byte-identical** to the file of rows that were UNEXPECTED at the base — both sha256
`69685a34fee0aede983f5720dedaf4b062afc6e175d5e24ce25a44cd106011f4`. The commit registered
exactly the set the gate was complaining about, no more and no less. That is one hash
comparison and it subsumes the whole table.

### Q2 — Re-derive 548 and 503 at the commit, not at a tree

**Both re-derived at the commit. Both correct.**

`503` and `548` were read with `git show "<SHA>:.github/expected-go-tests.txt"` — never
from a working tree. Blob SHAs, so any reader can re-resolve without trusting me:

| Commit | Manifest blob | Rows | Distinct rows | Blank lines | Trailing newline |
|---|---|---|---|---|---|
| `2982ffd` | `3c01012d145f4a7579546bb520e1df0472cc1757` | **503** | 503 | 0 | yes |
| `32255b0` | `ab04c212feeda2c3d53757bd51137f1509ad7526` | **548** | 548 | 0 | yes |

Row count equals set size in both, so "503 rows" and "503 tests" are the same number here
rather than two numbers that happen to agree.

`548` was re-derived by running the suite at a **detached checkout of `32255b0`** (worktree
clean, 0 porcelain lines) and applying the CI gate's own awk extractor verbatim from
`ci.yml:521-547`:

| Gate self-check at `32255b0` | Value |
|---|---|
| `go test ./... -v` exit status | **0** (captured unpiped) |
| stderr bytes | **0** |
| Package result lines recognised | **33** (gate aborts at 0) |
| `RUN` rows | **548** |
| Top-level `SKIP` rows | **0** |
| `(unterminated)` rows | **0** |
| Failure lines (all four `FAIL` forms) | **0** |
| **Executed (ran − skipped)** | **548 package-qualified top-level Go test functions** |
| Distinct packages in the executed set | **11 packages** |

**Membership at the commit: MISSING 0, UNEXPECTED 0.** And at the base: **MISSING 0,
UNEXPECTED 45** — precisely the defect the commit exists to close.

**The figures belong to the commit, not to a drifted tree**, and this is provable rather
than asserted: `git diff --name-only 2982ffd 32255b0` returns **exactly one file**, the
manifest, with **0** Go/`go.mod`/`go.sum` files among them. The executed set therefore
cannot differ between base and commit.

**The discarded base checks out too.** `eca9239 → 2982ffd` is 12 commits touching **4
files, 0 of them Go/mod/sum**. So re-deriving after the base moved could not have changed
the executed set — but the report was still right to re-run rather than carry the integer,
because `0f2c6f3` changed the *parser* (skips are now subtracted). A number is a
measurement plus an instrument, and the instrument changed. The report makes this argument
at `go-test-registration.md:21-30` and it is correct.

**Strongest single check:** at `32255b0` the manifest and the executed set are
**byte-identical**, both sha256
`e259d99913a36eb7f214db8d2383134e289269fed1f54a51b07f6b771f31ce95`. That is a stronger and
cheaper statement of "0 MISSING, 0 UNEXPECTED" than either `comm` direction.

**The other CI gate that could block the push, checked because it is not free.** `ci.yml`
carries a W1 gate requiring `web/dist`'s **tracked** set to equal exactly the placeholder.
Verified with `ls-tree` at all three commits — `2982ffd`, `32255b0`, `e374367` — each holds
**exactly one** entry, `web/dist/.gitkeep`. The gate will pass. (Control: `.github` at
`32255b0` returns 4 entries, so `ls-tree` was answering.)

One trap worth recording for the next reader: `git ls-files web/dist` run in canonical
`/workspace/farmtable` returns **0**, which looks alarming and is irrelevant — canonical is
checked out on `task-state-web-ui-v2` at `633f8f26`, a different branch, and `ls-files`
reads that index. The question must be asked of the commit with `ls-tree`, not of whatever
tree happens to be checked out.

### Q3 — Is this 45 the same set as the other track's 45?

**They are the same set. Not overlapping, not disjoint — identical. And nobody has pooled
anything.**

This needs stating carefully, because in my R3 review I referred to "the other track's 45
executed-but-unlisted tests, measured against a 503-row manifest, which is `b54c573`."
**That other track is this one.** There are not two 45s to reconcile; there is one
measurement referenced from two reports.

Proven, not inferred:

- The manifest at this base `2982ffd` and the manifest at `b54c573` are **the same blob**,
  `3c01012d145f4a7579546bb520e1df0472cc1757`.
- My **preserved R3 evidence file** for `b54c573` is byte-identical to the base manifest I
  extracted today — both sha256 `91e71738b99e596fba8bceb5ad75fa765eac3c1d4bacd93308b4eac041ee300e`.
  This is a cross-review, cross-clone check, not a re-run of my own reasoning.
- `b54c573 → 2982ffd` touches **17 files, 0 Go/mod/sum**. Same manifest *and* same Go
  source means the same executed set, hence the same difference. The 45 at `b54c573` and
  the 45 at `2982ffd` are necessarily one set.
- `b54c573` is an ancestor of `2982ffd` (`merge-base --is-ancestor` rc=0).

**Against branch `import-hardening`, the sets are genuinely disjoint.** `comm -12` of this
45 against that branch's 9 added rows: **0 rows**. The two tracks reconcile from a shared
ancestor, and the arithmetic closes exactly:

| Quantity | Rows |
|---|---|
| Executed rows common to both tracks | **501** — byte-identical to the `43bd206` manifest |
| Unique to this track | **47** |
| …of which are the 45 registered here | **45** |
| …of which were already listed at base | **2** (`TestConjunctA_ImportAcceptsFarmtableAndStoresItAsFarmtable`, `TestConjunctA_ImportRejectsNonFarmtableCollection`) |
| Unique to `import-hardening` (`f487dc5`) | **9** |

So: **501 + 47 = 548 here; 501 + 9 = 510 there; 501 + 2 = 503 base manifest.** Three
independent figures from two separate reviews, all resolving onto one 501-row ancestor.
They must still never be added together, and nothing in either report does.

Package scope also differs and the difference is a single named package: this track
executes **11** packages, `import-hardening` executes **10**, and the extra one is
`internal/webguard` — consistent with the report's observation that webguard was missing
from the manifest as a whole package.

**A live collision hazard, flagged as F-1 below:** there is a *third* 45 in the same
reports directory — `safeurl-union-table.md:327` and
`safeurl-tables-control-projectlog-COPY.md:29` — and it is **45 (input, verdict) pairs**,
a completely different unit. I searched all reports for a pooled figure
(`45+9`, `9+45`, `45+45`, `510+548`, `1058`): **no report pools them.** The only arithmetic
hit was safeurl-union's own internal `49 + 45 − 12 = 82`, which is within one unit and
correct.

### Q4 — Is "0 listed-but-not-executed" a measurement or a tautology?

**Both, at different commits — and the distinction matters.**

**At the base it is a real measurement with a named population.** The population is the
**503 rows of the base manifest**, each compared against the 548-row executed set;
MISSING = 0. The report obtained it three independent ways (`comm`, `grep -F -x -v -f`,
`awk`) specifically so that agreement rules out a collation artefact rather than merely
not exhibiting one — that is good practice and it is sound. It also injected a canary row
and confirmed the check **reported it as MISSING**, so the zero is lit rather than dead.
I reproduced MISSING = 0 against the 503-row population independently.

**At the head commit the same zero is guaranteed by construction and carries no
information.** The 45 were derived as `executed \ manifest` and then appended, so:

- `MISSING_head = (503 ∪ 45) \ executed = (503 \ executed) ∪ ∅ = MISSING_base`
- `UNEXPECTED_head = executed \ (503 ∪ 45) = 45 \ 45 = ∅`

Measured: **45 of 45** added rows are a subset of the executed set. So of the 548 rows at
head, **45 cannot be MISSING no matter what**, and the informative population is still
**503**, not 548. Both post-commit zeros are entailed by the pre-commit measurement plus
the append.

This is **not** a defect in the commit, and it is not dishonesty in the report — the base
measurement is real and the report's second canary (removing
`internal/streaming TestEventBus_Unsubscribe`, which I confirmed is genuinely a registered
row at `manifest.32255b0.sorted.txt:544`) does establish something worth establishing: that
the append was performed correctly and the file is not corrupt. But that is a check on a
*file operation*, not on the codebase. The report's §4 table
(`go-test-registration.md:272-273`) presents "0 after" alongside genuinely informative
results without noting it could not have come out otherwise. Filed as **O-2**.

### Q5 — Anything in the 45 that should not be registered?

**Nothing. This is the cleanest of the five checks.**

| Audit | Result |
|---|---|
| All 45 exist as top-level `func Test…` in a `_test.go` at `32255b0` | **45/45 present** (control: a fabricated name correctly reported absent) |
| Any of the 45 in a **generated** file (`Code generated … DO NOT EDIT`) | **0** — no `_test.go` in the tree is generated |
| Any of the 45 carrying `t.Skip` / `testing.Short()` within its body | **0** |
| Any of the 45 in a **build-tagged** file | **0** |
| Any of the 45 that did not execute | **0** |
| Any row in the **full 548** that cannot execute | **0** |

The skip check matters more than it looks: a registered test that skips becomes MISSING
under the post-`0f2c6f3` parser, which **fails CI**. Registering a conditionally-skipped
test would be a latent red. None of the 45 is one. The only `t.Skip` calls in the entire
tree are in `internal/platform/github/integration_test.go`, which is build-tagged and does
not run.

**What the audit did surface is a population the report never names** — see O-1. The tree
at `32255b0` holds **598** package-qualified top-level test functions; **548** execute;
**50** do not. All 50 are accounted for, exactly and with nothing left over, by three
`//go:build integration` files:

| File | Tag | Non-executing funcs |
|---|---|---|
| `internal/store/entstore_postgres_test.go` | `//go:build integration` | 23 |
| `internal/platform/github/integration_test.go` | `//go:build integration` | 18 |
| `internal/server/server_postgres_test.go` | `//go:build integration` | 9 |

**50 of 50 explained, 0 unexplained.** The reverse-direction control (executed rows not
found in the tree) is **0**, confirming the parse was sound.

---

## Critical

**None.**

## Required

**None.** Nothing in `32255b0` blocks the merge. The commit is a pure, order-preserving
data addition to a manifest, verified against a live gate.

## Nit / Optional

**O-1 (Optional, report) — the central number has no stated denominator.**
`go-test-registration.md:66` reports "Go test functions executed | **548 test functions**"
and `:300` describes the drift as "45 test functions across 3 packages". Neither states
that 548 is drawn from a population of **598**, with **50** structurally excluded by
`//go:build integration`. The report never uses the words "build tag", "go:build" or
"integration" anywhere (grep over the whole file: 0 hits; control grep for `548`: 9 hits,
so the search was live).

Two consequences, both real:

1. A reader finishing this report will reasonably believe the manifest now gates every Go
   test in the repository. It gates every Go test **that runs without `-tags integration`**.
2. Those 50 tests can be deleted, renamed, or broken and **this gate will never notice**,
   in either direction, permanently — not as drift that accumulates, but by design.

**Suggested fix:** one sentence in §1 next to the 548, e.g. "548 of 598 top-level test
functions in the tree; the remaining 50 are `//go:build integration` and are outside this
gate's population by construction." Nothing in the commit changes.

**O-2 (Optional, report) — the post-commit zeros are entailed, and are presented as
findings.** `go-test-registration.md:272-273`. See Q4. The base measurement is real and
well controlled; it is only the *head* zeros that are tautological. **Suggested fix:**
label the post-commit row as verifying the append rather than the codebase — "0 after (by
construction; this row verifies the append, not the tree)".

## FYI

**F-1 — three different 45s are in circulation in one reports directory**, in two
different units: 45 Go test functions (this track, and the same 45 I referenced in the R3
review) and 45 (input, verdict) pairs (`safeurl-union-table.md:327`,
`safeurl-tables-control-projectlog-COPY.md:29`). No report pools them and no arithmetic
error exists today. Recording it because the collision is exactly the shape that produces
one later, and because "the other track's 45" is now an ambiguous phrase in this project.

**F-2 — `--no-local` in the appendix reads like the opposite of what it does.**
`go-test-registration.md:312` records `git clone --no-local --branch main /workspace/farmtable …`
under a heading asserting the clone was local. Both are correct: `--no-local` disables the
hardlink optimisation but still clones from the given path, and no network remote was used.
Worth a parenthetical, since a skimming reader may read it as a violation of the standing
"never clone from the network remote" rule. It is not one.

**F-3 — a durability note, not a review finding.** The leg clone
`/workspace/farmtable-reg-goleg` has only 4 refs, and its object store holds **739** commits
against **430** reachable via `rev-list --all` — 309 commits, 42% of the store, invisible to
the reachable spelling. Both `32255b0` and `e374367` are present in canonical
`/workspace/farmtable` (probed bare, rc=0). Reported separately to the EM.

## Positive Feedback

Specific and earned, not manufactured:

- **The re-derivation after the base moved (`go-test-registration.md:14-34`) is the best
  judgement call in the change.** The author could have carried 45 forward — it was still
  45 — and would have been arithmetically right and methodologically wrong. Recognising
  that `0f2c6f3` altered the *parser*, and therefore that the old 45 and the new 45 are
  different measurements that happen to share an integer, is precisely the distinction
  this project has spent the day failing to make elsewhere.
- **`45 of 45` names verified present at `b54c573`, plus zero Go drift, converts
  "previously executed" from an inference into a proof** (`:175-183`). I reproduced both:
  596 distinct funcs at `b54c573`, 0 of the 45 absent.
- **The rename analysis (`:189-229`) is the part a count-based review would have missed
  entirely.** All four old names verify as gone from tree, manifest, and executed set, and
  none was ever in the manifest — so the gate's Direction-B zero is, as the report itself
  says, luck rather than design. Declining to classify `TestEphemeralGraphRouteDropsRemoteData`
  as a fifth rename (`:223-229`) is the right call and is argued correctly.
- **Both canaries are real**, and the second one targets a row I independently confirmed is
  registered. The author distinguished "the check returned zero" from "the check works",
  which is the distinction that has failed repeatedly elsewhere today.
- **The two self-corrections at `:345-362` are struck in place with SHAs**, and the second
  one narrows a claim *against* the author's own earlier alarm.

## Test Coverage

Not applicable in the usual sense — the commit adds no code and no tests. It brings 45
already-executing tests inside the CI gate's view, which strictly increases the number of
regressions CI can catch. Coverage of the *gate itself* is verified above: MISSING 0 /
UNEXPECTED 0 at the commit, with both directions demonstrated live by canary.

## Backward Compatibility

No wire-format change, no proto change, no exported Go API touched, no removed fields. The
only file changed is a CI manifest. The single behavioural consequence is that the 45 named
tests now fail CI if they stop running — which is the intent.

## Final Verdict

**APPROVE.**

O-1 and O-2 are report-quality items and do not gate the push. I would take O-1 before this
report is cited by anyone else, because an unnamed denominator is the specific failure this
project has been chasing all day and this report is otherwise a model of the opposite.

---

## Instrument notes and my own corrections

Struck in place, never deleted.

1. **A broken parser of mine produced a clean zero, and I nearly shipped it.** While
   building the tree-vs-executed comparison I used gawk's three-argument
   `match(line, /…/, m)`. This system's awk is **mawk**, which does not support it. It threw
   a visible syntax error, emitted an **empty** population, and the next two lines of my own
   script then printed `count=[0]` and `REGISTERED BUT NOT EXECUTING=[0]` — a reassuring
   pair of zeros over a population of nothing. ~~I first recorded "0 registered-but-not-executing"
   from that run.~~ **Struck.** Re-derived with a `sed`-based parser carrying an explicit
   population control (598 parsed, 0 lines retaining `func `, 0 executed-rows-not-in-tree).
   The corrected answer is the same — 0 — but the first run was not evidence for it. This is
   the same shape as the defect the EM circulated: *a broken loop produces a clean,
   plausible, entirely fabricated table.* Mine failed loudly and I still almost kept the
   number, because the number looked like the one I expected.

2. **I hit the zsh glob trap once**, on an unquoted `--include=*.md`. It failed with
   "no matches found" and exit 1 rather than silently searching nothing. Re-run quoted.
   Noting it because five other legs hit the same shell behaviour today; it is the shell,
   not the operator.

3. **No measurement was `2>/dev/null`'d.** Every existence probe used the bare spelling and
   was classified on the rc *value* in three visible buckets — real `0`, fabricated `1`,
   malformed `128` — demonstrated in the same invocation so that ABSENT is provably not
   collapsed into "my question was malformed".

4. **Every containment and equality claim above carries a control that produced a different
   outcome in the same invocation.** Where I report a zero, I first showed the instrument
   returning non-zero on an injected defect.

Read-only `--local` clone at `/workspace/review-goreg`; never cloned from a network remote;
nothing staged, committed, stashed, or pushed; no `git add -A`/`.`/`-u`, no `git commit -a`,
no `git stash -u`; `/workspace/farmtable/web/dist` untouched. All revision specs written
braced and echoed as `arg …=[…]` before use. Scope frozen: nothing outside `32255b0` is
proposed as a change here.
