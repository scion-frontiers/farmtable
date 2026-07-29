# dev-xss-r4 — RECONSTRUCTED FACTUAL RECORD (NOT THE AUTHOR'S REPORT)

## Provenance (D5)

**This document is a reconstruction, not the developer's own report.** The `dev-xss-r4`
leg was suspended and never wrote a report; this file was rebuilt after the fact by a
different agent (`developer`, under brief `xss-r4-reconstruct.md`) exclusively from the
git history and working tree at `/workspace/farmtable-xss-r4`, plus the in-tree project-log
file the leg itself committed. The reconstructing agent was **forbidden to open, read, grep
or otherwise inspect** `review-xss-r4.md`, `test-xss-r4.md` or `audit-xss-r4.md`, and did
not do so; this document is therefore **independent of all three by construction**, and any
agreement or disagreement between it and them is real evidence rather than an artefact of
shared sourcing. It contains **no adjudication, no verdict, no quality assessment and no
response to any review finding** — adjudication belongs to the eng-manager. It reconstructs
**the factual half only**: what landed, where, and what is dirty. Statements the original
author made in commit messages or in the committed project log are reported as *the author's
recorded claims* and are marked as such; they are not independently verified here, because
verifying most of them would require running builds or tests, which this agent was forbidden
to do. **A reader must not mistake this for the developer's own account.**

**Evidence marks used throughout:** `MEASURED` = this agent ran a command and read its output;
`DERIVED` = inferred from measured evidence by reasoning; `UNCHECKED` = relayed from the brief
or from an in-tree artefact without independent verification. `AUTHOR-CLAIM` = a statement the
suspended leg wrote into a commit message or the project log; its *existence in the tree* is
MEASURED, its *truth* is UNCHECKED.

**Bounds of every measurement in this document, unless a section states otherwise:**
- Repository root: `/workspace/farmtable-xss-r4` (MEASURED: `git rev-parse --show-toplevel` →
  `/workspace/farmtable-xss-r4`, rc=0).
- Every git command was invoked as `git -C /workspace/farmtable-xss-r4 …` so that the result
  is independent of the shell's cwd.
- No path filter was applied unless explicitly named in the section.
- No build, test, lint, `npm`, `go` or `make` command was run at any point (brief §0.2).
- Nothing in any repository was modified; this file is the only artefact produced.

---

## D1. THE RANGE

### D1.0 Endpoint resolution (the brief relayed `6805daa..e6bda71` unverified)

Both endpoints resolve in this tree. MEASURED:

| Ref | Resolves to | rc |
|---|---|---|
| `6805daa^{commit}` | `6805daa32aa67992bb26a4e66bd9d102bbf6fa53` | 0 |
| `e6bda71^{commit}` | `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1` | 0 |
| `deadbee^{commit}` (negative control) | `fatal: Needed a single revision` | 128 |

The negative control is included per brief §0.7: the same command shape on the same corpus
that is known to fail did fail, so the two rc=0 results above are measurements and not the
silence of a broken command.

Context of the endpoints (MEASURED):
- `6805daa` is `refs/remotes/origin/url-scheme-validation-r2` and also
  `refs/remotes/origin/HEAD`, subject `docs: log the r3 fix round for the URL scheme change`.
  It is the round-3 baseline, i.e. the range's exclusive lower bound is the state the r4 leg
  started from.
- `e6bda71` is the checked-out `HEAD` and the tip of local branch `url-scheme-validation-r2`,
  which `git status -sb` reports as **`ahead 6`** of its upstream.
- The clone's `origin` is **not a network remote**: `git remote -v` gives
  `origin /workspace/farmtable-xss-r2 (fetch/push)` (MEASURED). Nothing in this range has
  been pushed anywhere from this tree (DERIVED, from `ahead 6`).

### D1.1 Commit count

MEASURED, from root `/workspace/farmtable-xss-r4`, no path filter:

- `git rev-list --count 6805daa..e6bda71` → **6**
- Control (reversed range, expect 0): `git rev-list --count e6bda71..6805daa` → `0`
- Control (expect large non-zero): `git rev-list --count HEAD` → `309`

So the range is exactly six commits, `6805daa` is a strict ancestor of `e6bda71`, and the
counting command demonstrably returns non-zero on this corpus.

All six are authored and committed by `dev-xss-r4 <dev-xss-r4@agent.local>` (MEASURED), and
all six are linear on `url-scheme-validation-r2` (DERIVED: `rev-list --count` of the reversed
range is 0 and the count of the forward range equals the `ahead` count).

### D1.2 The six commits, oldest first

All numbers below are MEASURED via
`git -C /workspace/farmtable-xss-r4 log --reverse --numstat --format=… 6805daa..e6bda71`
and cross-checked against `--shortstat`. Dates are author dates, ISO-8601 UTC.

---

**1. `2f6500f77ae68fbc2aa6b7cffbcedd058cd4b2c4`** (`2f6500f`) — 2026-07-28T12:58:14Z
Subject: *Make `make test` run this branch's own URL guard*
4 files changed, **40 insertions(+), 4 deletions(-)**

| + | − | path |
|---|---|---|
| 4 | 0 | `Dockerfile` |
| 4 | 0 | `Dockerfile.server` |
| 20 | 2 | `Makefile` |
| 12 | 2 | `agents.md` |

---

**2. `d12f572589cd482596373fa70dd73c42bd968223`** (`d12f572`) — 2026-07-28T13:21:27Z
Subject: *Close the guard-tracer's universal, scope and walk-identity holes*
2 files changed, **912 insertions(+), 72 deletions(-)**

| + | − | path |
|---|---|---|
| 58 | 0 | `web/scripts/run-tests.mjs` |
| 854 | 72 | `web/src/util/url-binding-scan.test.ts` |

---

**3. `4e5824218eb21cb4ead1ccf3320c19827a84165e`** (`4e58242`) — 2026-07-28T23:35:35Z
Subject: *X6: recover adapter remote_data keys by AST, not by regex*
1 file changed, **396 insertions(+), 69 deletions(-)**

| + | − | path |
|---|---|---|
| 396 | 69 | `internal/server/urlvalidate_differential_test.go` |

---

**4. `655171287b29dfbf5c411a1a0ecff60968d30f44`** (`6551712`) — 2026-07-28T23:35:53Z
Subject: *X3: sanitize remote_data at every depth, and at every write site*
5 files changed, **820 insertions(+), 28 deletions(-)**

| + | − | path |
|---|---|---|
| 5 | 1 | `internal/server/convert.go` |
| 4 | 4 | `internal/server/export_import.go` |
| 581 | 0 | `internal/server/remotedata_depth_test.go` (new file) |
| 220 | 22 | `internal/server/urlvalidate.go` |
| 10 | 1 | `web/src/components/inspector/ft-inspector-desc.ts` |

---

**5. `e4316aef3a920899bd69855874a828e640e71b64`** (`e4316ae`) — 2026-07-28T23:38:32Z
Subject: *docs: log the r4 fix round, its survivors, and the stranded-mutant incident*
1 file changed, **210 insertions(+), 0 deletions(-)**

| + | − | path |
|---|---|---|
| 210 | 0 | `.design/project-log/url-scheme-validation-r4-fix-round.md` (new file) |

---

**6. `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1`** (`e6bda71`) — 2026-07-28T23:39:25Z
Subject: *docs: name server.go:661's exemption, the contaminated ref, and the scopes.go decision*
1 file changed, **64 insertions(+), 12 deletions(-)**

| + | − | path |
|---|---|---|
| 64 | 12 | `.design/project-log/url-scheme-validation-r4-fix-round.md` |

Its body describes itself as *"Coordinator amendments to the r4 log"* (AUTHOR-CLAIM) — i.e.
the last commit in the range is documentation written at the coordinator's direction, not
code.

### D1.3 Aggregate effect of the range

MEASURED, `git diff --stat 6805daa e6bda71` (root `/workspace/farmtable-xss-r4`, no path
filter): **13 files changed, 2430 insertions(+), 173 deletions(-)**. Control: `git diff --stat
e6bda71 e6bda71` printed nothing, confirming the command distinguishes change from no-change.

| path | net stat line | new file? |
|---|---|---|
| `.design/project-log/url-scheme-validation-r4-fix-round.md` | 262 ++++ | yes |
| `Dockerfile` | 4 + | no |
| `Dockerfile.server` | 4 + | no |
| `Makefile` | 22 +− | no |
| `agents.md` | 14 +− | no |
| `internal/server/convert.go` | 6 +− | no |
| `internal/server/export_import.go` | 8 +− | no |
| `internal/server/remotedata_depth_test.go` | 581 ++++ | yes |
| `internal/server/urlvalidate.go` | 242 ++++ | no |
| `internal/server/urlvalidate_differential_test.go` | 465 ++++ | no |
| `web/scripts/run-tests.mjs` | 58 ++ | no |
| `web/src/components/inspector/ft-inspector-desc.ts` | 11 +− | no |
| `web/src/util/url-binding-scan.test.ts` | 926 ++++ | no |

DERIVED, from the table: the round is dominated by test/instrument code. The only
non-test, non-docs production files touched in the whole range are `internal/server/convert.go`,
`internal/server/export_import.go`, `internal/server/urlvalidate.go` and
`web/src/components/inspector/ft-inspector-desc.ts` — 269 of the 2430 inserted lines by the
stat lines above.

### D1.4 Refs present in this clone

MEASURED, `git for-each-ref` at root `/workspace/farmtable-xss-r4`:

```
refs/heads/url-scheme-validation-r2        e6bda71  docs: name server.go:661's exemption, …
refs/preserve/wip-snapshot                 27e0ee0  WIP SNAPSHOT (not authored by the leg): dev-xss-r4 uncommitted X3/X6 work at crash
refs/remotes/origin/HEAD                   6805daa  docs: log the r3 fix round for the URL scheme change
refs/remotes/origin/url-scheme-validation  d4c4e6b  docs: log the stored-XSS URL scheme fix
refs/remotes/origin/url-scheme-validation-r2 6805daa docs: log the r3 fix round for the URL scheme change
```

`git stash list` printed nothing at rc=0 — **no stashes** in this tree (MEASURED).

Naming discrepancy, reported as a fact and not adjudicated: commit `e4316ae`'s body names the
preserved ref **`refs/preserve/xss-r4/wip-snapshot`** and `e6bda71`'s body refers to a renamed
contaminated ref and to **`refs/preserve/xss-r4/branch`** (AUTHOR-CLAIM). Neither of those two
refnames exists in this clone; the only `refs/preserve/*` ref here is **`refs/preserve/wip-snapshot`**
at `27e0ee0` (MEASURED). Whether the `xss-r4/`-prefixed names exist in some other clone was not
checked — other clones are out of this task's bounds.

`27e0ee0` is **outside** the range `6805daa..e6bda71` and its own subject marks it *"not
authored by the leg"* (MEASURED); it is therefore not counted as part of the landed work.

---

## D2. THE WORK ITEMS

### D2.0 How the item labels were established, and the answer on X4

The brief handed me **X1, X2, X3, X5, X6** and warned that the list may be incomplete.
It is. Establishing the item set from the tree alone (MEASURED, root `/workspace/farmtable-xss-r4`):

1. `git log --format='%h%n%B' 6805daa..e6bda71 | grep -nE 'X[0-9]+[a-z]?'` — 13 matching lines
   (last-stage rc=0). Labels appearing: **X1–X8, plus X7a and X7b**.
2. `git grep -nE '\bX[0-9]+[a-z]?\b' e6bda71 -- .design .tasks docs agents.md README.md` —
   8 matching lines, all in the leg's own committed log
   `.design/project-log/url-scheme-validation-r4-fix-round.md` (rc=0).
3. `git grep -nE '\bX[0-9]+[a-z]?\b' e6bda71 -- ':(exclude).design'` — exactly one non-binary
   source hit, `internal/server/remotedata_depth_test.go:67` (`"defect X3 exists to close"`),
   plus three PNG screenshots matching as binary (rc=0).
4. Control for every grep above: the same command shape with a token known to be absent
   returned no output at rc=1 (MEASURED), so the hits above are hits and not a broken pipeline.

**X4: LANDED.** MEASURED, and on three independent kinds of evidence:
- Commit `d12f572`'s body opens *"X2, X5, X7a and X4 of round 4"* and devotes a paragraph to
  X4 (AUTHOR-CLAIM that the label is X4; the text's presence is MEASURED).
- The leg's committed log has a section heading `### X4 — assertion-count pin (d12f572)`
  (MEASURED, file line 60).
- The code change itself is present and was not there before (MEASURED):
  at `6805daa`, `web/scripts/run-tests.mjs` contained `totalAssertions` only at lines
  198/246/259/264 with the sole gate `if (totalAssertions === 0)`; at `e6bda71` the file adds
  `const EXPECTED_ASSERTIONS = 380;` at **line 306** and `if (totalAssertions !== EXPECTED_ASSERTIONS)`
  at **line 307**, in a 58-line addition made by `d12f572`.

DERIVED as to *why* X4 was missing from the brief's list: X4 landed inside a commit whose
subject names none of its items (`Close the guard-tracer's universal, scope and walk-identity
holes`), so a subject-line reading of the range shows `X3` and `X6` only. **I did not verify
this explanation against any source; it is an inference, not a finding.**

**Beyond X6, the tree also reveals X7a, X7b and X8** — see D2.7 and D2.8. **No X9 or higher
exists anywhere in the range's commit messages or in the tree** (MEASURED, greps above:
the highest label matched is X8).

### D2.1 X1 — `make test` executes the web guard — commit `2f6500f`

MEASURED, from `git show 2f6500f`:

| File | Change | Site |
|---|---|---|
| `Makefile` | `test:` split into `test: test-go test-web`; new `test-go:` (`go test ./...`) and `test-web:` (`cd web && npm test`); `.PHONY` line extended | Makefile lines 1, 9–29 in the post-image |
| `Dockerfile` | `RUN npm test` inserted before `RUN npm run build`, with a 3-line comment | after `COPY web/ .` in the web build stage |
| `Dockerfile.server` | same insertion, identical comment | same position |
| `agents.md` | 12 insertions / 2 deletions; `CLAUDE.md` is a symlink to `agents.md` (MEASURED: `ls -l` shows `CLAUDE.md -> agents.md`) | two command blocks |

Before this commit `make test` was `go test ./...` alone (MEASURED, from the diff's pre-image).

### D2.2 X2 — the guard tracer's existential→universal arm — commit `d12f572`

File: `web/src/util/url-binding-scan.test.ts` (854 insertions / 72 deletions in this commit —
MEASURED). Sites at `e6bda71` (MEASURED via `git grep -n`):

- `traceGuard(src, id, lineNo, what)` — line **1088**; it calls `enclosingBlock` at line **1094**.
- `enclosingBlock(...)` — line **575**, calling `assertBraceBalanced` at line **578**.
- `defeatingAssignments(...)` — line **697**.
- `assignsFromSafeHref(line, id)` — line **638**.
- `testMultiStatementGuards()` — line **1146**.
- `checkViaSafeHref(a, lineNo, read)` — line **1468**, driven by `testViaSafeHrefConsumption()`
  at line **1516**, which is invoked from `run()` at line **1590**.

### D2.3 X3 — recursion and write sites — commit `6551712`

Traversal changes in `internal/server/urlvalidate.go` (220 insertions / 22 deletions —
MEASURED). Sites at `e6bda71`:

- `const maxRemoteDataDepth = 32` — line **197**, with its rationale comment at line 193.
- `sanitizeRemoteData(rd map[string]any)` — line **230**.
- `sanitizeRemoteValue(key, v, depth)` — line **249**, depth guard at line **250**.
- `validateRemoteDataURLs(path, rd, depth)` — line **373**, depth guard at **374**, the
  `nested more than %d levels deep` error at **375**.
- `validateRemoteDataValue(path, key, v, depth)` — line **385**, depth guard at **386–387**.

**Write sites — measured independently of any stated number.** `git grep -nE 'sanitizeRemoteData\('`
over non-test Go sources:

| | at base `6805daa` | at `e6bda71` |
|---|---|---|
| call sites | **1** — `convert.go:358` | **6** — `convert.go:358`, `convert.go:534`, `export_import.go:139`, `export_import.go:332`, `export_import.go:438`, `export_import.go:743` |

So **five new sanitize call sites landed**, and the total at HEAD is six, which matches the
"six sites now sanitize" wording in the commit body (MEASURED count; the wording is AUTHOR-CLAIM).
Control: the same grep for an absent token returned rc=1 with no output.

**Observation, reported without adjudication:** the diff of `6551712` changes **four**
`RemoteData:` assignments in `export_import.go` from raw to sanitized (post-image lines
139 collection export, 332 collection import, 438 `taskExport`, 743 `importedTask`), plus one
in `convert.go` (534, `collectionToProto`). The commit body and the log name only
`export_import.go:139` and `:332` as newly discovered sites. Both statements can be true of
different populations (newly *discovered* vs. newly *sanitized*); **I am not resolving which,
that is adjudication.** The measured fact is: 5 assignments changed from raw to sanitized.

The one non-sanitizing site that remains is `internal/server/server.go:661`,
`p.RemoteData = map[string]any{}` (MEASURED, present at `e6bda71`). `server.go` itself is
**not modified anywhere in the range** (MEASURED: it appears in no commit's file list).

New test file `internal/server/remotedata_depth_test.go` (581 lines, new in `6551712`), test
functions at these lines (MEASURED):
`TestNestedURLReachesTheWireWithoutRecursion` 35, `TestSanitizeRemoteDataRecursesThroughEveryCarrier` 75,
`TestSanitizeRemoteDataDoesNotMutateItsInput` 177, `TestSanitizeRemoteDataStopsAtTheDepthBound` 194,
`TestRemoteDataTraversalsTerminateOnACycle` 254, `TestSanitizeAndImportAgreeAtEveryDepth` 307,
`TestValidateImportedTaskURLsReachesNestedCarriers` 428, helper `remoteDataWriteIsSanitized` 465,
`TestRemoteDataWriteIsSanitized` 469, `TestEveryRemoteDataWriteSiteSanitizes` 515.

Also in `6551712`: `web/src/components/inspector/ft-inspector-desc.ts`, **10 insertions /
1 deletion**, described in the body as comment-only (AUTHOR-CLAIM; the line counts are MEASURED).

### D2.4 X4 — absolute assertion-count pin — commit `d12f572`

File `web/scripts/run-tests.mjs`, 58 insertions / 0 deletions (MEASURED). The added block is
a ~50-line comment plus `const EXPECTED_ASSERTIONS = 380;` at line **306** and the inequality
gate at lines **307–320**, inserted after the pre-existing `totalAssertions === 0` floor
(which remains, at line **259**). Status: **LANDED**.

### D2.5 X5 — walk identity check — commit `d12f572`

Same file as X2. Sites at `e6bda71` (MEASURED):
`directoryCensus(root)` — line **337**, with its "WHY IT EXISTS, AND WHY IT IS NOT sourceFiles()"
comment at line 322; `tally(root, files)` — line **1297**; `compareWalk(census, reached)` —
line **1324**; consumed in `testNoUnapprovedBindings()` at line **1334**, which calls
`sourceFiles(SRC)` at 1335 and `directoryCensus(SRC)` at **1368**.
Related in the same commit: `SOURCE_EXT = /\.[cm]?[jt]sx?$/` at line **303** and
`TEST_FILE = /\.test\.[cm]?[jt]sx?$/` at **304**, feeding `sourceFiles(dir, out)` at **306**.

### D2.6 X6 — adapter-key scanner, regex → AST — commit `4e58242`

Single file: `internal/server/urlvalidate_differential_test.go`, 396 insertions / 69 deletions
(MEASURED). Sites at `e6bda71`: `remoteDataLiteralKeysIn(src)` — line **847**;
`buildsRemoteData(fn *ast.FuncDecl)` — **909**; `rootRemoteDataLiteral(fn)` — **934**;
`isRemoteDataTarget(expr)` — **954**; `stringLit(expr)` — **965**; `TestRemoteDataLiteralKeysIn` —
**985**; the predecessor helper `remoteDataKeysIn(src)` still present at **1136**;
`TestRemoteDataKeysWrittenByAdaptersAreClassified` — **492**.

**X6 tail, in commit `6551712`:** the comment in `internal/server/urlvalidate.go` that called
the adapter-written key set finite was replaced. MEASURED: at `6805daa`, line 109 reads
`// platform adapters write IS finite, and every one of them must be either`; at `e6bda71`,
line 113 reads `// What that test produces is a LOWER BOUND, not the set. It cannot see a key`.

### D2.7 X7a and X7b — LANDED, and absent from the list I was handed

**X7a** — template-literal tracking in `blankNonCode`, commit `d12f572`, file
`web/src/util/url-binding-scan.test.ts` (MEASURED). Sites at `e6bda71`:
`blankNonCode(text, blankTemplateText = false)` — line **409**; `blankToCode(text)` — **497**;
`assertBraceBalanced(code, what)` — **511**; `testStructuralHelpers()` — **968**; the
apostrophe fixture at **910–924**.

**X7b** — negation-aware `noteDeclaresBaseDependence`, commit `4e58242`, file
`internal/server/urlvalidate_differential_test.go` (MEASURED). Sites at `e6bda71`:
`noteDeclaresBaseDependence(lower string)` — line **234**; `TestNoteDeclaresBaseDependence` — **259**.

### D2.8 X8 — present as a label, NOT LANDED as a code change

MEASURED. The label X8 appears twice in the range's commit messages (`6551712` body: *"that is
X8 and is not what this commit is about"*) and once in the committed log (line 237: *"X8 is
only partly addressed"*). No code change in the range handles the discarded
`structpb.NewStruct` error:

| | at `6805daa` | at `e6bda71` |
|---|---|---|
| `convert.go` error-discarding assignments | 358, 530, 555, 558 | 358, 534, 559, 562 |

All four still discard the error at HEAD (MEASURED: `, _ = ` grep). The only change among them
is that lines 358 and 534 now wrap their argument in `sanitizeRemoteData(...)`. Status for X8:
**NOT LANDED as a behaviour change; named and deliberately deferred in the log.** (That the
deferral was deliberate is AUTHOR-CLAIM; that no error handling changed is MEASURED.)

Note for future readers: the log's residual-defect line numbers `convert.go:358,530,555,558`
are **base-`6805daa` numbering**, not HEAD numbering (MEASURED — they match `6805daa` exactly
and three of the four have shifted by `e6bda71`).

### D2.9 Item status summary

| Item | Status | Commit | Primary file(s) |
|---|---|---|---|
| X1 | LANDED | `2f6500f` | `Makefile`, `Dockerfile`, `Dockerfile.server`, `agents.md` |
| X2 | LANDED | `d12f572` | `web/src/util/url-binding-scan.test.ts` |
| X3 | LANDED | `6551712` | `internal/server/urlvalidate.go`, `convert.go`, `export_import.go`, `remotedata_depth_test.go`, `web/src/components/inspector/ft-inspector-desc.ts` |
| **X4** | **LANDED** (absent from the brief's list) | `d12f572` | `web/scripts/run-tests.mjs` |
| X5 | LANDED | `d12f572` | `web/src/util/url-binding-scan.test.ts` |
| X6 | LANDED | `4e58242` (+ comment tail in `6551712`) | `internal/server/urlvalidate_differential_test.go`, `urlvalidate.go` |
| **X7a** | **LANDED** (absent from the brief's list) | `d12f572` | `web/src/util/url-binding-scan.test.ts` |
| **X7b** | **LANDED** (absent from the brief's list) | `4e58242` | `internal/server/urlvalidate_differential_test.go` |
| **X8** | **NO CODE CHANGE IN RANGE** — label exists, deferral recorded | — | `internal/server/convert.go` (unchanged in this respect) |
| X9+ | **NO SUCH ITEM** — no label above X8 occurs in the range's messages or in the tree | — | — |

Two documentation commits (`e4316ae`, `e6bda71`) carry no item label of their own; they write
and then amend `.design/project-log/url-scheme-validation-r4-fix-round.md`.

---

## D3. UNCOMMITTED WORK IN `/workspace/farmtable-xss-r4`

### D3.1 The measurement, and its bound

`git status --porcelain -uall`, **no pathspec**, run three times from three different working
directories to make the cwd bound explicit rather than assumed (brief §0.8). All three
MEASURED, all three identical:

| Run | cwd | command | output |
|---|---|---|---|
| A | `/workspace/farmtable-xss-r4` | `git status --porcelain -uall` | ` M internal/server/scopes.go` |
| B | `/` | `git -C /workspace/farmtable-xss-r4 status --porcelain -uall` | ` M internal/server/scopes.go` |
| C | `/workspace/farmtable-xss-r4/internal` | `git status --porcelain -uall` | ` M internal/server/scopes.go` |

**Exactly one entry. One tracked file modified in the worktree, nothing staged, nothing
untracked.** The status code is ` M` (space-M): modified in the working tree, **not** staged.
Confirmed independently: `git diff --cached --stat` printed nothing (MEASURED), so the index
matches `HEAD`.

Positive control for the "empty output at exit 0" hazard (brief §0.7): the same command with
`--ignored` on the same corpus returns **14,013 lines** — 14,012 of them `!!` (ignored,
predominantly `web/node_modules`) plus the one ` M` line (MEASURED, counted with
`cut -c1-2 | sort | uniq -c`). The command is therefore demonstrably capable of printing
thousands of lines against this tree; the one-line result in runs A/B/C is a measurement of
cleanliness, not a silent failure.

`git stash list` → no output at rc=0: **no stashed work** (MEASURED).

### D3.2 The one dirty file, measured independently

`git diff --stat` (worktree vs index), root `/workspace/farmtable-xss-r4`, MEASURED:

```
 internal/server/scopes.go | 12 ++++++------
 1 file changed, 6 insertions(+), 6 deletions(-)
```

**My own line count: 6 insertions, 6 deletions, on 6 distinct source lines** — the file's
lines for `ScopeWildcard`, `ScopeTaskRead`, `ScopeTaskWrite`, `ScopeTaskClaim`,
`ScopeTaskAccept`, `ScopeTaskClose`, each gaining one space before the `=` so the `const`
block aligns with the longer `ScopeCollection*` names below it. Hunk header `@@ -12,12 +12,12 @@`;
the block is the `// Scope constants define the RBAC permission vocabulary.` const block.

**Whitespace-only, measured, with a control:** `git diff -w --stat` on the worktree prints
**nothing** — the change vanishes when whitespace is ignored. Control that `-w` is not simply
blind on this corpus: `git diff -w --shortstat 6805daa e6bda71` prints
`13 files changed, 2412 insertions(+), 155 deletions(-)`, i.e. `-w` still reports substantive
change elsewhere in the same repository (MEASURED).

This is an **independent confirmation of the shape the brief described** (one modified file,
`internal/server/scopes.go`, ~6 lines, alignment in a const block). I measured it without
reference to that description and arrived at the same numbers. **Whether it is pre-existing,
in-scope, or correctly left dirty is not adjudicated here.**

Two further measured facts, offered without interpretation:
- The file's mtime is **2026-07-28 13:32:09 +0000** (`ls -l --time-style=full-iso`). The
  range's commits run 12:58:14 → 23:39:25 on the same day, so the last write to this file
  falls inside that window. mtime records *when the file was last written*, not by whom, nor
  whether the write changed the content. **No conclusion is drawn from it here.**
- `internal/server/scopes.go` is **not touched by any commit in the range** (MEASURED: it
  appears in none of the six commits' file lists in D1.2).

### D3.3 Anything else dirty — the loud-finding check

**Nothing else is dirty.** No second modified file, no staged change, no untracked file, no
stash, no unmerged path (MEASURED, runs A/B/C above plus `git diff --cached` and
`git stash list`, all with the positive control in D3.1). The one thing in this tree that is
*not* accounted for by the range or by `git status` is the ref
`refs/preserve/wip-snapshot` → `27e0ee0`, recorded in D1.4; it is a ref, not a worktree state,
and its own subject declares it *"not authored by the leg"*.

---

## D3-ADJUNCT. THE PRESERVED WIP SNAPSHOT `27e0ee0` (measured, because it bears on "what is in this tree")

Not part of the range and not part of the uncommitted work, but it is state in this clone and
leaving it unmeasured would leave a reader guessing. All MEASURED:

- `27e0ee00f4a789978fa96083ca00db186bcb6b72`, author `dev-xss-r4 <dev-xss-r4@agent.local>`,
  date 2026-07-28 22:47:56 +0000, parent `d12f572`.
- Subject: `WIP SNAPSHOT (not authored by the leg): dev-xss-r4 uncommitted X3/X6 work at crash`.
  Body states it was captured by the eng-manager during crash recovery and *"must not be
  treated as the leg's own commit"*.
- `git merge-base --is-ancestor 27e0ee0 e6bda71` → **rc=1: it is NOT an ancestor of HEAD**; it
  is off-branch.
- `git diff --stat d12f572 27e0ee0` → 7 files, 1222 insertions / 103 deletions — i.e. the
  snapshot holds the then-uncommitted X3 and X6 work **plus** `internal/server/scopes.go`
  (12 lines changed).
- `git diff --stat 27e0ee0 e6bda71` → 3 files: the project log (+262, added later),
  `scopes.go` (12 ±, because it is still uncommitted at HEAD), and **`urlvalidate.go`, 1
  insertion / 1 deletion**.

That single one-line difference is, MEASURED, at `validateRemoteDataValue`'s
`case map[string]any:` branch — post-image line **430**:

```
-		return validateRemoteDataURLs(path, tv, 0)        # in 27e0ee0
+		return validateRemoteDataURLs(path, tv, depth+1)  # in e6bda71
```

The log's claim that the snapshot contains a live depth-counter-reset mutant at
`urlvalidate.go:430` is therefore **independently corroborated by measurement here**, and it is
the *only* code difference between the snapshot and HEAD. Reported as a measurement; the
handling of the snapshot is not adjudicated here.

`git diff 27e0ee0 -- internal/server/scopes.go` (worktree vs snapshot) prints nothing: the
dirty `scopes.go` in the worktree today is **byte-identical** to the copy captured at 22:47:56
(MEASURED).

Reflog of this clone (MEASURED, `git reflog --date=iso`), which bounds when the work happened:

```
clone from /workspace/farmtable-xss-r2   2026-07-28 12:34:51  -> 6805daa
commit 2f6500f  12:58:14
commit d12f572  13:21:27
commit 4e58242  23:35:35
commit 6551712  23:35:53
commit e4316ae  23:38:32
commit e6bda71  23:39:25
```

Eight reflog entries total, no rebase, no amend, no reset, no branch switch (MEASURED — the
only non-commit entries are the clone and the checkout it implies).

---

## D4. NOT RECONSTRUCTABLE FROM THE TREE

Everything below is **absent from git history and the working tree**, or present only as the
author's unverifiable assertion. A developer's report normally contains these; this
reconstruction cannot supply them, and their absence is named here so that no later reader
mistakes silence for their non-existence.

**1. The round's item definitions — what X1…X8 actually *were*.**
The tree contains the labels only in the leg's own commit messages and its committed log
(MEASURED, D2.0). **The r4 brief/assignment that defined the items is not in this repository**
(MEASURED: `git grep` over `.design`, `.tasks`, `docs`, `agents.md`, `README.md` at `e6bda71`
returns only the leg's own log). So the mapping from label to requirement is the author's
paraphrase, not a primary source. *To recover:* the original r4 brief handed to the leg, held
outside the repo by the coordinator/eng-manager.

**2. Why the item list circulating downstream omits X4, X7a and X7b.**
The tree establishes that all three landed (D2). It cannot establish how they came to be
missing from a later list. DERIVED-only speculation is recorded in D2.0 and is explicitly not
a finding. *To recover:* the coordinator's own dispatch records.

**3. Intent — the "why" behind every choice, beyond what a comment happens to say.**
A diff shows what changed. It cannot show what the author was trying to achieve, what they
believed the threat model was, or which risk they were trading against which. Where the commit
messages and the log *do* narrate intent, that narration is **the author's claim recorded in
the tree, not evidence of the intent** — it is unfalsifiable from the tree.
**I did not infer intent from any diff anywhere in this document.** *To recover:* the leg's
session transcript.

**4. Rejected alternatives.**
Nothing in the tree records a design considered and discarded. The log names two decisions not
taken (not making `[]string`/`[]map[string]any`/`json.RawMessage` serialise; not adopting or
reverting the `scopes.go` alignment), but a decision *stated* is not the set of alternatives
*weighed*. *To recover:* the leg's session transcript.

**5. All verification evidence. Nothing in the log's "How I verified it" section is checked
here, and none of it can be, from the tree.**
The log asserts `go build ./...` exit 0; `go vet ./...` 4 pre-existing copylock findings at
`server.go:1509,1619,1827,2004`; `make test` exit 0 with `PASS: 4 test file(s), 380
assertions`; `gofmt -l internal/server/` clean. **All AUTHOR-CLAIM.** This agent was forbidden
to run any build, test, vet or lint command (brief §0.2, single project-wide build token held
by the eng-manager), so every one of those is UNCHECKED here. The assertion total 380 is
*consistent* with the pinned constant in the tree (`EXPECTED_ASSERTIONS = 380`, MEASURED) but
consistency with a constant the same author wrote is not verification. *To recover:* the build
token, and one clean run.

**6. The mutation-testing matrix.**
The log reports 21 rows, four iterations, 0 surviving non-equivalent mutants, and names `P2cn`,
`P11`, `P10`, `P5cn`. **No mutation harness, row table, matrix output or harness script exists
in the tree** (MEASURED: the range touches no such file, and `git status` shows no untracked
one). The log itself states the harness output log and snapshot directory were in `/tmp` and
were destroyed by the crash restore. So the matrix is **unrecoverable, not merely unverified** —
the primary artefact no longer exists anywhere. *To recover:* re-run a reconstructed harness
under the build token; the original results are gone.

**7. Per-mutant reasoning for the three recorded survivors.**
`P2cn` (claimed equivalent), `P11` (claimed redundant-guard), `P10` (claimed genuinely
unkilled, with the stated gap that the Go suite has no `EXPECTED_ASSERTIONS` analogue). The
arguments exist only as prose in the log. The *code* facts they rest on are partly checkable —
e.g. the two depth bounds `P11` refers to are both present and MEASURED at
`urlvalidate.go:374` and `:386` — but the survival claims themselves are not checkable without
running the suite. AUTHOR-CLAIM.

**8. Known gaps and residual risk as the author understood them.**
The log's "What I could not verify" section is the only record: X8 partial; the four `go vet`
copylocks; `web/dist` clean-checkout (#100); CSP absence (#85); the #195 markdown/DOMPurify
branch and its two `unsafeHTML(renderMarkdown(...))` sinks (#163); the #194 branch; CI absence
(#22); the merge seam (#115); `Task.remoteData` claimed to be read by nothing in `web/src`.
**Every one of those is AUTHOR-CLAIM.** Scope fences in particular are *decisions taken
elsewhere* and leave no trace in a diff. *To recover:* the round baseline and scope fence as
issued by the coordinator.

**9. The provenance of the dirty `scopes.go` change — specifically the claim that it
pre-existed this round.**
MEASURED facts available: it is whitespace-only; it is 6 lines; it is in no commit in the
range; its mtime is 2026-07-28 13:32:09, inside the round's window; it is byte-identical to the
copy in the 22:47:56 crash snapshot. **None of that establishes when it was introduced or by
whom**, because an uncommitted change carries no authorship and mtime is not creation time.
The claim that it predates the leg is AUTHOR-CLAIM. *To recover:* the state of this clone at
`12:34:51` (clone time) — which no longer exists — or the corresponding state of the upstream
clone `/workspace/farmtable-xss-r2`, which is outside this task's bounds and was not read.

**10. The crash, the recovery, and the ref renaming.**
The log describes a container crash with the mutation harness live and a coordinator-performed
snapshot and rename. In this clone, the snapshot commit exists and its contamination is
independently corroborated (D3-ADJUNCT). **The refnames the log and commit `e6bda71` cite —
`refs/preserve/xss-r4/wip-snapshot`, its `-CONTAMINATED-…` rename, and
`refs/preserve/xss-r4/branch` — do not exist here** (MEASURED, D1.4); the only preserve ref is
`refs/preserve/wip-snapshot`. Whether they exist in another clone was not checked, as other
clones are out of bounds. *To recover:* `git for-each-ref refs/preserve` in whichever clone the
coordinator operated on.

**11. Coordinator interaction.**
Commit `e6bda71` is titled as *"Coordinator amendments to the r4 log"*. The instructions that
produced it are not in the tree. *To recover:* the coordinator's message log.

**12. Why the leg stopped, and what it would have done next.**
Nothing in the tree records the suspension, its reason, or an unfinished intention. The last
commit is a docs amendment at 23:39:25 and the reflog ends there (MEASURED). **There is no
"next step" list anywhere in this repository.** *To recover:* the orchestration record for the
`dev-xss-r4` agent.

**13. Any response to the three review documents.**
The reviews postdate the work and this agent is forbidden to read them (brief §0.1). Whether
the leg would have accepted, disputed or already anticipated any finding is unknowable from the
tree, and is in any case adjudication, which is the eng-manager's and is not delegable.

---

## D5. PROVENANCE — see the top of this file

The provenance statement required by D5 is the first section of this document, before all
other content, as specified. It states that this is a post-hoc reconstruction from git history
and the working tree, produced by an agent forbidden to read `review-xss-r4.md`,
`test-xss-r4.md` and `audit-xss-r4.md` (and which did not read them), that it is therefore
independent of those three by construction, that it is **not** the original author's account,
and that it contains no adjudication.

### Completeness and honesty notes on this reconstruction

- **Sections present:** D1 (range), D2 (work items), D3 (+ adjunct) (uncommitted work), D4
  (not reconstructable), D5 (provenance, at top). All five deliverables are in this file.
- **The brief's relayed facts, checked as instructed (§0.9):** the range endpoints
  `6805daa..e6bda71` both resolve — **the brief was correct** (D1.0). The expected dirty file
  and its ~6 lines — **the brief was correct**, and measured independently (D3.2). The item
  list `X1, X2, X3, X5, X6` — **the brief was incomplete, as it warned it might be**: X4
  landed, and so did X7a and X7b; X8 exists as a named, deliberately deferred item (D2).
- **One error found in the brief:** none of substance. Its only inaccuracy is the item list,
  which it flagged as untrusted itself.
- **No build, test, lint or package-manager command was run** (§0.2). **No file in any
  repository was created, modified or deleted** (§0.3) — this markdown file in the scratchpad
  is the sole artefact. **`/workspace/farmtable` and `/workspace/farmtable-em-verify195` were
  never read or touched** (§0.4). **No `git gc`, no `git prune`, anywhere** (§0.4). **No
  `2>/dev/null` anywhere** (§0.6). **The three review reports were never opened, listed,
  grepped or measured** (§0.1).
