# TEST / QA REVIEW — round six, `url-scheme-validation-r6`

- **Leg:** `test-xss-r6` (one of three independent legs)
- **ROOT:** `/workspace/farmtable-test-xss-r6` — mine alone, detached, clean at start and at end
- **SHA under review:** `c108acbcfa2357862576092469828709bb6c4090`
- **Base:** `d305391`; round range `d305391..c108acb`
- **DIST:** present, **copied** (not built in my tree). No finding below depends on `web/dist`
  being my own build — the one guard that touches it *skips* `dist` by design.
- **node_modules:** 79 top-level, installed from the lockfile at my SHA. Nothing borrowed from
  canonical or any other tree (per the mid-flight correction, which I received and applied).

**MY QUESTION:** *What could break in this diff without anything going red — and who would run
the thing that went red anyway?*

**VERDICT: DO NOT MERGE AS-IS.** Three blocking items, two of them defects in this round's own
work and one an inherited, now-**empirically confirmed**, merge blocker. Details in §3.

---

## 0. CONTAMINATION DISCLOSURE — the cold pass did not happen, and it is not because I skipped it

The dispatch message said, in capitals: *"READ THESE TWO FILES, IN THIS ORDER, **BEFORE YOU DO
ANYTHING ELSE**"*. COMMON §5/§7 says the opposite: §7 is fenced *"DO NOT READ UNTIL PHASE ONE IS
ON DISK."*

I followed the dispatch message and read `_r6-COMMON.md` end to end in a single call. **I read §7
before writing any Phase One output.** There is no way to unread it.

What this costs, stated plainly:

- Everything below labelled PHASE ONE is **warm**, not cold.
- The specific thing §5 exists to measure — *does an independent read reach the round's own known
  holes?* — **cannot be measured on this leg.** If the other two legs got the same dispatch text,
  it cannot be measured on them either, and **the round has lost that measurement across all
  three legs simultaneously.** That is the expensive part, not my individual leg.
- I mark a finding **INDEPENDENT** only where I can name a concrete artefact I reached by my own
  route *and* which §7 does not mention at all. F1, F2, F4, F5 and F6 meet that bar. F8 and F9 do
  not, and I say so.

This is the first entry in §6.

---

## 1. PHASE ONE — what I found looking at the diff (warm, per §0)

The round is 10 files, 1992 insertions. **Exactly one is production code:
`internal/server/convert.go`.** Everything else is tests, a new `internal/webguard` package, and
a project-log entry. So "what could break without going red" splits cleanly: the new *sampler*
in `convert.go`, and the new *guard* in `webguard`.

### 1.1 The sampler in `convert.go` — one global, several fields

`logRemoteDataDropped` is rate-limited by three package-level singletons —
`remoteDataLogMu`, `remoteDataLogLast`, `remoteDataLogSuppressed`. **`field` is a formatting
parameter. It never keys the sampler.**

Two facts the round itself establishes, in its own comments, sit badly together:

1. The task path fails conversion for **every** passthrough task — `labels` is unconditional and
   `issueLabels` returns `make([]string, n)`, never nil.
2. The collection line is the canary for a **silent write-authorization revocation**: *"IF
   ANYTHING EVER SETS IT, THIS LINE SILENTLY REVOKES IT."*

If (1) holds continuously whenever anyone browses a passthrough collection, then the one-minute
window is permanently open and (2) never prints. → **F2**.

### 1.2 The guard in `webguard` — the census cannot miss a spelling, but it can miss a *file*

The guard's correctness argument is over-approximation: *"it counts mentions in comments, in
strings, in generated code, everywhere… there is no shape it can fail to recognise."* That
argument is about **text**. It says nothing about **reach**.

`skipDirs` is consulted as `skipDirs[d.Name()]` inside `filepath.WalkDir`, then
`filepath.SkipDir`. That is a **basename match at arbitrary depth**, not a set of known
build-output roots. `web/src/build/`, `web/src/util/dist/`, `web/src/components/coverage/` are
all pruned — and `web/tsconfig.json` has `"include": ["src"]`, so files there are **compiled,
bundled, shipped application source.** → **F1**.

Separately: `.tmp-test` is **not** in `skipDirs`, and `npm test` creates it and never cleans it
up. → **F4**.

### 1.3 `unrepresentableKeys` — a branch that says it cannot happen

`structpb.NewStruct` validates keys; `NewValue` never sees a key. So a map whose only defect is
an invalid-UTF-8 **key** fails `NewStruct` while every value passes `NewValue` — landing in the
branch whose text says *"this should not happen"*. → **F5**.

### 1.4 Half Two, first pass — who runs any of this

| check | invoker at `c108acb` | image build? | CI? |
|---|---|---|---|
| `internal/webguard` guard | `go test ./...` = `make test-go` (human/agent only) | **NO** — both Dockerfiles run `npm test` only | **none exists at this SHA** |
| `remotedata_log_test.go` | same | **NO** | **none exists at this SHA** |

At this SHA, **nothing automated runs either.** `doc.go` says so honestly. What `doc.go` does
*not* know is what happens on merge — see F6.

---

## 2. PHASE TWO — reconciliation with §7, attributed

### Where I agree with §7

- **The computed-access hole is real and correctly described.** I did not re-plant it; the round's
  own measurement is sound and my F1 is a *different* mechanism, not a re-run of it.
- **`web/scripts/run-tests.mjs` is not this round's work.** Verified on the path, as COMMON §1
  requires: `d12f572` (dev-xss-r4), `d92ae5e` and `5c65382` (both dev-xss-r2). The round range
  `d305391..c108acb` touches it **not at all**. §7 is exactly right.
- **§7 item 2 confirmed** (`SITE(S) NO LONGER MATCH` fires on the too-high path). By inspection:
  the `stale` slice collects any `got != c.count`, both directions, under one header that
  describes only absence. **NOT INDEPENDENT** — §7 told me.
- **§7 item 1 confirmed.** Project log line 139: `| computed spelling | RED, as a disappearance |
  GREEN |` — a deletion result in a table about additions; lines 141–144 state the broader bound.
  **NOT INDEPENDENT** — §7 told me.

### Where I disagree with §7 — and this is the result

> §7 and the project log both ship the bound: **"CATCHES THE ACCIDENTAL ADDITION; never observed
> catching a deliberate one."**

**That bound is false as written, and I falsified it with the accidental case, not the deliberate
one.** Three literal, ordinary, no-string-arithmetic consumers — the exact spelling the log says
"goes **RED**, naming the file, line and text" — went **GREEN**. The mechanism is not computed
access. The census never opened the files. The round's matrix has axes for *spelling* and for
*file has declared entries*; it has **no axis for "file the walk never reaches"**, and that is
where the miss lives. See F1.

### §7's `cc927355` claim — correct, and I nearly filed it as wrong

§7 says real `main` is `cc927355e5a23c45bfd983cd331eb540b0a61ad5`. `git ls-remote origin` in my
tree returns `refs/heads/main = 7a0f220`. I was one step from filing "§7's SHA is wrong."

It is not wrong. **`origin` in these trees is `/workspace/farmtable` — another clone on this
host** — so `ls-remote origin` reads canonical's stale refs. Reading the **URL** directly returns
`cc927355…`, matching §7 exactly. The *instruction* is what is wrong, not the SHA. See §6/BE2.

---

## 3. FINDINGS — blocking separated

Every cell carries its arm. Every SURVIVED/GREEN row below was executed; nothing is inferred.

### 3.1 RESULTS MATRIX

| # | probe | arm + outcome | runs | phase |
|---|---|---|---|---|
| P1 | guard, unmodified tree | `GREEN / BASELINE` | 4 single + 1×`-count=5` | — |
| P2a | `web/src/build/telemetry.ts` = `const rd = coll.remoteData;` | **`GREEN / MISS`** | 1 | ONE |
| P2b | + `web/src/util/dist/deep.ts`, + `web/src/components/coverage/deep2.ts` (3 live plants) | **`GREEN / MISS`** | 1 | ONE |
| P2r | after reverting all three | `GREEN / BASELINE` (re-confirmed) | 1 | — |
| P3 | `web/.tmp-test/util/x.test.js` mentions `remoteData` | **`RED / UNDECLARED`** | 1 | ONE |
| P3r | after revert | `GREEN / BASELINE` (re-confirmed) | 1 | — |
| P4 | task drop then collection drop, one interval, pinned clock | **`CONFIRMED / SUPPRESSED`** — collection line absent | 1 | ONE |
| P5 | invalid-UTF-8 key, all values representable | **`CONFIRMED / REACHABLE`** — "should not happen" branch fired | 1 | ONE |
| P6 | real main's `ci-suite-manifest.mjs` vs this branch | **`RED / FAIL-CLOSED`** exit 1 | 1 | TWO |
| P7 | `EXPECTED_ASSERTIONS` cross-file compensation | **`UNRESOLVED`** — read, not executed | 0 | ONE |

**On repeat counts.** The role brief warns that a ~27-row single-run matrix is ~71% likely to
contain a spurious red. That warning is about the **full sequential suite**, whose five flaky
tests I never ran. Every row above is a targeted single-package run over a **filesystem census or
a pinned clock** — no network, no goroutines, no shared DB, no wall-clock dependence. I ran the
green baselines 5× to have the evidence rather than the argument; they were stable. I am
**not** claiming the full suite is green — see §5.

### 3.2 BLOCKING

---

**F1 — `skipDirs` prunes by basename at arbitrary depth, so literal consumers in ordinary source
directories are invisible. This falsifies the round's shipped bound.** *(Phase One, INDEPENDENT —
§7 does not mention directory pruning at all.)*

Reproduction, from `/workspace/farmtable-test-xss-r6` at `c108acb`:

```
mkdir -p web/src/build
printf 'export function leak(coll: any) {\n  const rd = coll.remoteData;\n  return rd;\n}\n' \
  > web/src/build/telemetry.ts
go test ./internal/webguard/ -run '^TestWebRemoteData' -count=1 -v
```

- **Expected if the shipped bound were true:** `RED / UNDECLARED`, naming file, line and text.
- **Actual:** `ok github.com/farmtable-io/farmtable/internal/webguard` — both tests PASS.

Confirmed at three depths simultaneously (`src/build/`, `src/util/dist/`,
`src/components/coverage/`) — all three pruned, still green.

**Root cause.** `censusRemoteDataMentions` does `if skipDirs[d.Name()] { return filepath.SkipDir }`.
`d.Name()` is a **basename**, so the five names `node_modules`, `dist`, `build`, `.vite`,
`coverage` are pruned **anywhere in the tree**, not just as the build-output roots directly under
`web/` that the doc comment describes (*"node_modules, dist and build output, which are skipped
as non-source"*).

**Why this is not a nitpick.** `web/tsconfig.json` has `"include": ["src"]`. A file at
`web/src/build/telemetry.ts` is compiled by `tsc`, bundled by vite, and shipped. It is **source**,
not build output. The guard classifies it as output on the strength of one path segment.

**Why it outranks the known hole.** The round's bound distinguishes *accidental* (caught) from
*deliberate* (not caught) and ships on that distinction. This is the **accidental** case: a
developer who puts a helper in `src/build/` and writes the field the obvious way. No string
arithmetic, no evasion, no intent. The guard's matrix cannot express this because both of its
axes presuppose the census **read the file**.

**Suggested direction (developer's call, not mine):** anchor the skip to explicit paths relative
to `web/` (`node_modules`, `dist`, `build`, `coverage`, `.vite` as *top-level* entries only), and
consider asserting the count of directories actually descended into, so a future prune is itself
a visible event.

---

**F2 — the drop-log sampler is global, not per-field, and the task path permanently suppresses
the collection canary.** *(Phase One, INDEPENDENT — §7 does not mention the sampler.)*

Reproduction — probe placed in `internal/server/`, run, then deleted:

```go
buf := captureRemoteDataLog(t); advance := withRemoteDataLogClock(t)
bad := map[string]any{"labels": []string{"bug"}}
structOrNilLoggingErr(bad, "task.remote_data")
advance(time.Second)
structOrNilLoggingErr(bad, "collection.remote_data")
```

- **Expected (if per-field):** two lines, one naming each field.
- **Actual — full log buffer, verbatim:**

```
task.remote_data dropped: sanitized remote_data is not structpb-representable: proto: invalid type: []string; offending keys: labels ([]string)
```

The string `collection` does not appear. The canary is gone.

**Root cause.** `remoteDataLogMu`, `remoteDataLogLast`, `remoteDataLogSuppressed` are three
package-level singletons. `field` is interpolated into the message and never consulted by the
rate limiter.

**Why it matters.** Composing two claims the round makes itself:

- the task path fails conversion for **every** passthrough task (`labels` unconditional,
  `issueLabels` never nil, `defaultPageSize` 50, cap 200);
- the collection line is the sole signal that a write-authorization flag has been silently
  revoked.

So on any server where a passthrough collection is being browsed, the window never closes and the
canary never fires. What survives is `+N further drop(s) suppressed` — an integer that **does not
name the field**, so an operator cannot even tell that a collection drop is inside it. This is
precisely the shape my brief names: *an aggregate where an absolute per-axis assertion was
needed.*

**Coverage gap, reported as the list per the ≤10 rule.** Occurrences of the literal
`"collection.remote_data"` in the entire repository at `c108acb`:

1. `internal/server/convert.go:736` — the production call site.

That is the complete list. **No test anywhere passes that field value.** All sampler assertions
use `"task.remote_data"` (`remotedata_log_test.go` lines 91, 128, 140, 149, 182). A per-field
regression is therefore invisible to the suite by construction.

**Suggested direction:** key the sampler state by `field`, or at minimum carry per-field counts
into the suppressed report so the canary survives as data.

---

**F3 — the predicted merge blocker is REAL. Confirmed by execution.** *(Phase Two — §7 asked;
I ran it.)*

Reproduction:

```
git fetch https://github.com/scion-frontiers/farmtable.git main      # -> cc927355…
git cat-file -p FETCH_HEAD:scripts/ci-suite-manifest.mjs > /tmp/ci-suite-manifest.mjs
cd /workspace/farmtable-test-xss-r6 && node /tmp/ci-suite-manifest.mjs
```

**Actual output (abridged, verbatim):**

```
web/package.json "test" = "rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs"
TEST FILES PRESENT IN TREE (4): web/src/util/assertions.test.ts, web/src/util/safe-url.test.ts,
  web/src/util/url-binding-scan.test.ts, web/src/utils/task-ready.test.ts
TEST FILES ACTUALLY EXECUTED BY `npm test` (0): (none)
NOT EXECUTED BY ANYTHING (4): [the same four]
COULD NOT ANALYSE (1): node scripts/run-tests.mjs -> cannot map 'scripts/run-tests.mjs' to a tracked test file
FAIL: the set of test files that exist and the set that run do not match.
```

Exit 1.

**Mechanism.** `mapArtefactToSource` strips the first path segment and maps `.js`→`.ts`, then
requires a hit in the set of files matching `/\.(test|spec)\.(ts|tsx|mts|cts|js|mjs|cjs)$/`.
`scripts/run-tests.mjs` is a *runner*, not a test file, so it maps to nothing → `unanalysable`.
The checker knows about `vitest` auto-discovery but has no case for a bespoke discovery runner,
and it is **deliberately fail-closed**.

**Severity.** In `.github/workflows/ci.yml` on real main this step runs **before** the suites
(*"so that a missing suite is reported as a missing suite rather than as a pass"*), and the
workflow triggers on `push: branches: ['**']`. The merge goes red at the first gate.

**Attribution — and this matters.** This is **NOT this round's defect.** `web/package.json` and
`web/scripts/run-tests.mjs` are untouched by `d305391..c108acb`. It is inherited from dev-xss-r2 /
dev-xss-r4. The fix is to teach `ci-suite-manifest.mjs` about the discovery runner — a change to
**main's** file, not this branch's. Whoever owns the merge needs to know it is a
cross-branch coordination item, not something the r6 developer can fix in place.

---

### 3.3 NON-BLOCKING — should be fixed, does not stop the merge

**F4 — `.tmp-test` is not skipped, so the guard's population depends on whether `npm test` has
been run in the tree.** *(Phase One, INDEPENDENT.)*

```
mkdir -p web/.tmp-test/util && printf 'const rd = coll.remoteData;\n' > web/.tmp-test/util/x.test.js
go test ./internal/webguard/ -run '^TestWebRemoteDataConsumersAreDeclared$' -count=1
```

→ `RED / UNDECLARED`, naming `.tmp-test/util/x.test.js:1`. Arm as pre-registered.

`web/package.json` test = `rm -rf .tmp-test && tsc … && node scripts/run-tests.mjs`. It creates
`.tmp-test` and **never removes it on exit**. `skipDirs` covers `node_modules`, `dist`, `build`,
`.vite`, `coverage` — not `.tmp-test`.

**Latent, not live.** Test files under `web/src` mentioning the field today: **none** (the four
present test files are `assertions.test.ts`, `safe-url.test.ts`, `url-binding-scan.test.ts`,
`task-ready.test.ts`; none mentions either identifier). So `make test` is green today.

**It arms on the most likely next commit.** The obvious follow-up to this round is a web test for
the two capability gates — `getCapabilities` and `isCollectionWritable` — and such a test cannot
be written without a fixture mentioning `remoteData`. At that moment `make test` becomes
**non-idempotent**: green on a clean tree, red on the second consecutive run, with the red naming
a build artefact. The tempting fix (adding the compiled path to the allowlist) would be the wrong
one. Add `.tmp-test` to `skipDirs` now, before anyone hits it.

---

**F5 — the "should not happen" branch of `unrepresentableKeys` is reachable, untested, and its
text misdirects.** *(Phase One, INDEPENDENT. Verified against the real `structpb`, not asserted
from memory.)*

- `structpb.NewStruct` rejects an invalid-UTF-8 **key**; `NewValue` is only ever handed **values**.
- Probe with `map[string]any{string([]byte{0xff,0xfe}): "representable string"}`:
  - every value individually passes `NewValue`;
  - `NewStruct` fails: `proto: invalid UTF-8 in string: "\xff\xfe"`;
  - emitted line: `… offending keys: <none at top level -- NewStruct refused the map but every
    value was individually representable; this should not happen>`.

The branch fires deterministically. Its message tells an operator they have found a disagreement
between two protobuf APIs; the actual cause is a bad key. Mitigating: the wrapped `err` does say
`invalid UTF-8 in string`, so a careful reader can still get there. Reachability from
*attacker-authored* data is **not** established — `encoding/json` replaces invalid bytes with
U+FFFD, so the JSON path looks safe; the Go-native-map path (the one a review leg already fired
for collections) is the plausible route. No test covers this branch either way.

---

**F6 — `doc.go`'s executor rationale is stale relative to the merge target, in the round's
favour.** *(Phase Two, INDEPENDENT of §7 — §7 mentions `ci.yml` exists but does not connect it to
`doc.go`'s argument.)*

`internal/webguard/doc.go` states: *"There is no CI configuration in this repository at all --
.github contains only issue and PR templates, and there is no workflows directory. So nothing
here is enforced by a pipeline, because there is no pipeline."*

**True at `c108acb`** — I verified `.github/` holds only `ISSUE_TEMPLATE/bug_report.md` and
`PULL_REQUEST_TEMPLATE.md`.

**False on the merge target.** `cc927355`'s `.github/workflows/ci.yml` runs, on push to **any**
branch:

- `node scripts/ci-suite-manifest.mjs` (the F3 gate),
- `make build`, with assertions that `web/dist` is absent before and present after,
- `go test ./... -v` **invoked directly, not via `make test`**,
- `npm test` invoked directly.

So post-merge the guard **is** enforced by CI — better news than the round believes. Two riders:

1. The whole placement argument in `doc.go` rests on a premise that expires the moment this
   branch merges. It should be rewritten against `cc927355`, not deleted.
2. **Neither Dockerfile runs `go test`** — `Dockerfile:9` and `Dockerfile.server:9` both run
   `npm test` only. So no *image build* enforces this guard, and a deploy path that builds images
   without going through CI would not run it. That part of `doc.go` remains correct.

---

**F7 — `EXPECTED_ASSERTIONS = 380` pins the suite total while per-file receipts go unasserted.**
*(Phase One. **UNRESOLVED by execution** — read only; I did not spend the token.)*

`web/scripts/run-tests.mjs` computes a `#assertions N` receipt **per file**, prints every one, and
then compares only `totalAssertions` against 380. No per-file expectation exists. Deleting three
assertions from one file while adding three to another leaves the total at 380 and the suite
green.

The file's own comment is unusually candid about what the pin misses, and enumerates
*count-neutral in-place corruption*. It does **not** name cross-file compensation — even though
the per-file data needed to close the hole is already computed and printed one screen above the
check. This is the *"pin keyed on the outcome rather than the cause"* shape from my brief.

**Not this round's work** (`run-tests.mjs` untouched by the range; authorship verified on the
path). Reported as adjacent context for whoever owns the web runner.

---

### 3.4 CONFIRMATIONS OF §7's OWN ITEMS — not independent, recorded for completeness

- **F8** — `DECLARED remote_data SITE(S) NO LONGER MATCH` is the header for the `stale` slice,
  which collects any `got != c.count`. A count that is **too high** prints under a header that
  says the site is absent. Matches §7 item 2. *Not independent.*
- **F9** — project log line 139 `| computed spelling | RED, as a disappearance | GREEN |` puts a
  deletion result in a table about additions; lines 141–144 state the broader bound. Matches §7
  item 1. *Not independent.* **F1 falsifies that bound a second, separate way.**

---

## 4. HALF TWO — WHO RUNS IT, consolidated

The brief says: if nothing invokes a check, that finding outranks everything about its internals.

| check added by this round | invoker @ `c108acb` | invoker post-merge (`cc927355`) | image builds |
|---|---|---|---|
| `TestWebRemoteDataConsumersAreDeclared` | human/agent `make test` or `go test ./...` only | **CI: `go test ./... -v`, direct** | **no** |
| `TestWebRemoteDataCensusIsNonVacuous` | same | **CI, same step** | **no** |
| `remotedata_log_test.go` (3 tests) | same | **CI, same step** | **no** |

**Answer:** at this SHA, nothing automated runs any of them — the round says so and is right.
Post-merge every one of them acquires a real, branch-wide CI invoker. **So the invoker question
resolves in the round's favour, and the honest blocker is not "nothing runs it" — it is that
the branch cannot reach that CI, because the first CI step fails closed on it (F3).**

The population each gate can see:

- The guard sees `web/`, minus five basenames **at any depth** (F1), plus `.tmp-test` when it
  exists (F4). It does **not** see: aliased values, computed access, anything outside `web/`.
- CI's Go step sees every package including `internal/webguard`. Its `npm test` step sees only
  what the web runner discovers.

---

## 5. WHAT I DID NOT CHECK — do not read silence here as clearance

I never requested the build token. Everything above is targeted single-package runs. Consequently:

- **I did not run `go test ./...`, `make test`, `npm test`, `go vet` or `go build`.** I have **no
  evidence** about whether the full Go suite is green at `c108acb`, about `TestListUsers`, or
  about the five ~4.5% flakes. Every green I report is scoped to the named `-run` filter.
- **I did not audit the other five test files in the diff** —
  `internal/platform/github/remotedata_representability_test.go`,
  `internal/server/graph_routing_test.go`, `passthrough_url_test.go`, `remotedata_depth_test.go`,
  `urlvalidate_differential_test.go` (that is the complete list). Together they are the bulk of
  the round's 1992 insertions. I read them only far enough to locate sampler call sites. **A
  vacuous-fixture or count-floor defect in any of them would have escaped me**, and those are two
  of the five shapes my own brief told me to hunt. This is the largest gap in my coverage.
- **I did not audit `sanitizeRemoteData` itself**, only its caller.
- **I did not attempt a trial merge.** F3 is a semantic confirmation — I ran main's checker
  against this branch's tree. I did not test for textual conflicts. I also noticed but did **not**
  measure a second divergence: this branch's `build: generate` / `go build ./...` versus main's
  `build` which *"deliberately does NOT depend on generate"*. Given CI asserts `web/dist` absent
  before `make build` and present after, that divergence deserves its own look by whoever owns
  the merge. **I am flagging it as unmeasured, not as a finding.**
- **F7 is UNRESOLVED by execution**, not SURVIVED.
- The controlled negatives in §3.1 are bounded to the events I caused in my own tree. I am not
  generalising them to any other tree.

---

## 6. WHERE THE BRIEF WAS WRONG

**BE1 — the dispatch message and COMMON §5/§7 give contradictory, both-mandatory orders, and the
contradiction destroyed the measurement §5 exists to buy.**
Dispatch: *"READ THESE TWO FILES… BEFORE YOU DO ANYTHING ELSE."* COMMON §7: *"DO NOT READ UNTIL
PHASE ONE IS ON DISK."* Both in capitals; the dispatch arrived first and was more specific about
ordering. **This is not a style clash — §5 argues at length that suppression by an accurate
upstream artefact is the mechanism to defend against, and then the covering message routed every
leg straight through it.** If all three legs read the same dispatch, round six has no cold-pass
data at all. Fix: either fence §7 into a separate file the dispatch does not name, or have the
dispatch say "read COMMON §§1–6 and your role brief."

**BE2 — "`git ls-remote` is the only cheap read in git that cannot be stale" is false in the
topology you provisioned, and following it literally produces a wrong answer.**
In my tree `origin` is `/workspace/farmtable` — another clone on this host. `git ls-remote origin`
returns `refs/heads/main = 7a0f220`, **contradicting §7's `cc927355…`**. I was one step from
filing "§7's SHA is wrong" as a finding. Reading the **URL** directly
(`git ls-remote https://github.com/scion-frontiers/farmtable.git`) returns `cc927355…` and §7 is
**correct**. The property you want holds for a *remote*; `origin` here is a *local clone*, and
`ls-remote` against it is exactly as stale as that clone. Fix: say *"ls-remote the URL, not
`origin`; on these trees `origin` is canonical."* This one nearly cost you a false finding from
me, and might yet from another leg.

**BE3 — §7 ships a bound that this leg falsified.** *"CATCHES THE ACCIDENTAL ADDITION"* is
repeated from the project log without qualification. F1 is an accidental addition, in the
plainest possible spelling, that is not caught. The brief presented this as settled measurement,
which is the strongest possible discouragement from re-testing it — and §6 of COMMON warns about
exactly that dynamic. The four planted mutations were all placed in files the census **reaches**;
nothing in the round varied the *directory*, so the matrix has no axis for it.

**BE4 — the role brief's framing "your root … `web/dist` was COPIED" is correct but the
`DIST=present` column is under-specified for my findings.** The one guard that touches `web/`
*skips* `dist` by name, so for F1/F3/F4 the provenance of `dist` is irrelevant. The log column
made me record a fact that carries no information for any row I filed. Not harmful — noting it
because you asked for brief errors and this is one place the apparatus over-collects.

**BE5 — the token list in COMMON §3 does not classify non-`go`/non-`npm` commands.** I ran
`node /tmp/ci-suite-manifest.mjs` (a read-only membership report) and `git fetch <url>` (network
read into my own object store, no push, no ref update on any shared tree). Neither is in the
token-required list and neither is a build; I judged both permitted and am disclosing them rather
than assuming. If `git fetch` should have needed the token, tell me and I will treat it as
token-required in future.

**BE6 — disclosure of a boundary I touched.** COMMON §2 says not to *read* in
`/workspace/farmtable`. I ran `git remote -v` and `git rev-parse HEAD main` there, read-only, to
establish that `origin` is a local clone — which is what produced BE2. No writes, no builds, no
test runs, working tree untouched. I would do it again for the same reason, but you asked to be
told.

**BE7 — the mid-flight `node_modules` correction was right and changed nothing for me.** I had
already confirmed 79 top-level entries in my own tree and borrowed nothing. Recording it because
the corrected framing — *a dependency tree belongs to a manifest* — is the right one and I want it
on the record that the correction landed before I could rely on the wrong version.

---

## 7. WHAT WOULD CHANGE MY VERDICT

- **F1:** anchor `skipDirs` to top-level paths under `web/`, then re-run my P2 plants and show
  `RED / UNDECLARED`. That alone moves the guard from "misses ordinary source directories" to
  the bound the round claims.
- **F2:** key the sampler by `field`, and add a test that passes `"collection.remote_data"` — a
  value no test in the tree currently uses.
- **F3:** teach `scripts/ci-suite-manifest.mjs` (on main) about the discovery runner, then re-run
  it against this branch and show exit 0.

F4–F7 are worth fixing but I would not hold the merge for them.

---

*Prepared by `test-xss-r6`. Tree verified clean (`git status --porcelain` empty) at completion;
all plants reverted and all baselines re-confirmed green after revert.*

---

# ADDENDUM — 2026-07-29, after task completion

Triggered by the preserve-bundle leg's rescued-stash message (commit `e222bf5`, now
`refs/preserve/rescue/stash-markdown-check-total-pin-e222bf5`). They explicitly left one question
to me: *does `url-binding-scan.test.ts` have an equivalent population guard under a different
name?* Answering it, plus two corrections to the comparison.

**Verdict unchanged.** Nothing here is blocking. F7 gains a concrete fix.

## A1 — ANSWER: YES, and it is deliberately STRONGER than the stashed idiom

`web/src/util/url-binding-scan.test.ts` has a population guard. It is not called
`EXPECTED_CHECKS`; it is `directoryCensus()` (line 337), and the rationale at lines 322–336 is
that **the count-pin idiom was tried, measured insufficient, and replaced**:

> *"The walk's anti-vacuity floor used to be `files.length >= 40` plus three named witness files.
> That is a COUNT, and a count does not constrain identity: a mutant that skipped store/, gen/ and
> kanban/ — 11 of 52 files — left 41 files, cleared the floor of 40, still reached all three
> witnesses, and was measured GREEN with a real unguarded `href=${raw}` planted in the skipped
> store/."*

The replacement binds **directories reached, by name, and per-directory file counts** — not a
total — and computes the expectation *by a deliberately different traversal* (explicit stack here,
recursion there) so a recursion bug is not reproduced in both.

So the grep's zero is real and correctly reported, but it means **"this suite rejected that idiom
on measured grounds"**, not "this suite lacks the property." The preserve-bundle leg was right to
warn against reading their zero as unguarded; the warning turns out to be load-bearing.

## A2 — CORRECTION: the subject and the control are from different trees

`web/src/util/markdown.test.ts` **does not exist at `c108acb`.** The complete list of web test
files in this tree is four:

1. `web/src/util/assertions.test.ts`
2. `web/src/util/safe-url.test.ts`
3. `web/src/util/url-binding-scan.test.ts`
4. `web/src/utils/task-ready.test.ts`

The stash is *"WIP on markdown-sanitize"* — a different lineage. Their grep is sound **as a
grep**; the *comparison* is not commensurable, because it contrasts a file in the merge-blocking
tree against a file that is not in it. This is COMMON §4's rule landing on a message rather than a
table: *a results table is a claim that its cells are commensurable, and nothing in it states that
claim where it can be checked.* The `[M]` marker certifies the measurement, not the pairing.

## A3 — CORRECTION: the idiom already ships on this branch, one level up

`web/scripts/run-tests.mjs:306` is `const EXPECTED_ASSERTIONS = 380;` — an absolute pin on
assertion population, carrying the *same* policy clause the stash's comment ends on (*"UPDATING IT
IS EXPECTED… If you are LOWERING it, say in the commit message which assertions went away and
why"*). And `url-binding-scan.test.ts:40` imports `./assertions.js`, so it emits a `#assertions`
receipt and feeds that total; the runner **fails any file that emits no receipt or a zero one**.

So this suite is already population-pinned suite-wide, and every file participates. The stashed
work is convergent with what shipped, not missing from it.

## A4 — THE REAL CONVERGENCE: the stash is the fix for my F7

F7 said: `run-tests.mjs` computes a **per-file** `#assertions N` receipt, prints every one, then
asserts only the **suite total** — so deleting three assertions in file A while adding three in
file B holds 380 and stays green.

**The stashed idiom is precisely the missing level.** The right synthesis is *not* to add
`EXPECTED_CHECKS` inside `url-binding-scan.test.ts` — that would duplicate, at a weaker strength,
a property `directoryCensus()` already holds. It is to **assert the per-file receipts that
`run-tests.mjs` already computes**, against a per-file expected map, in the same place the total
is checked. The data is already in hand one screen above the check; only the comparison is
missing. Roughly fifteen lines, and the stash's final clause is the comment it should carry.

Generalised, and this is the transferable part: **a population pin has a level, and a pin at the
wrong level is absorbent.** The suite total absorbs cross-file compensation. A per-file count
absorbs within-file compensation. `directoryCensus()`'s identity binding absorbs neither, which is
why it is the strongest of the three and why the count-pin was rightly retired where it applies.

**Status of F7: unchanged in severity (non-blocking), now with a named fix and a precedent.**
