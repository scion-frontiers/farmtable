# c108acb (`url-scheme-validation-r6`): remote_data consumer guard + sampled drop log — Review

**Leg:** `review-xss-r6` (code review). **Root:** `/workspace/farmtable-review-xss-r6`.
**SHA under review:** `c108acbcfa2357862576092469828709bb6c4090`. **Range:** `d305391..c108acb`.
**Pre-registration:** `_prereg-review-xss-r6.md`, written before inspection.

---

## Executive Summary

The production change — a rate-sampled, key-naming log line for dropped `remote_data` — is
**correct**, and the B11 census guard is **sound engineering** for the property it actually has.
The defects are not in the code; they are in what the code says about itself. Three assertive
prose blocks shipped at `c108acb` are false or materially incomplete, and in each case the
omitted path is the one a future maintainer is most likely to take. **Risk level: MEDIUM** —
nothing here breaks today, and every blocking item is a comment edit rather than a redesign.

**Verdict: REQUEST CHANGES** (three blocking items, all prose; est. under an hour).

### Contamination disclosure — this affects how to score this leg

**I read COMMON §7 before Phase One was on disk.** The embargo ("do not read until Phase One is
on disk") sits at line 168 *inside* `_r6-COMMON.md`, and the dispatch ordered me to read that
file first, in full, before anything else. A file read returns the whole file. The instruction is
unsatisfiable as written and **will have fired identically on all three legs**. Filed as **B1**
below.

Consequence, stated plainly: **the round's stated measurement — whether a cold read independently
reaches the two known in-tree inaccuracies — is lost for this round and I cannot recover it.**
Every finding below is attributed, and anything overlapping §7's disclosures is marked
`CONTAMINATED` and is worth nothing as evidence of an independent read.

---

## What is actually in this change

| | files | insertions | note |
|---|---|---|---|
| **Production behaviour** | 1 (`internal/server/convert.go`) | ~110 real lines | the sampler + `unrepresentableKeys` |
| **Apparatus** (tests, guard, doc, project log) | 9 | ~1,880 | incl. 403-line guard, 246-line log |

Eleven commits, one production file. **P1 CONFIRMED** (predicted >3:1 apparatus:production; actual
is roughly 17:1 by line). Per my pre-registration this is a fact about the round and **not** a
defect I am filing — the apparatus is mostly load-bearing.

---

## PHASE ONE — findings from the cold pass

### PO-1 — `Required` — the collection reachability argument discharges two of the three writers it names

`internal/server/convert.go`, `collectionToProto` comment.

The comment names the real collection writers as **CreateCollection (`entstore.go:1366`),
UpdateCollection (`:1399`) and ImportCollection (`:2117`)**. I verified all three resolve to the
right functions. It then gives the reason the log line does not fire:

> NO IN-TREE CALLER POPULATES `CreateCollectionParams.RemoteData` OR
> `UpdateCollectionParams.RemoteData`.

That discharges writers one and two. **It never discharges ImportCollection**, and
`ImportCollectionParams.Collection.RemoteData` *is* populated by an in-tree caller —
`internal/server/export_import.go:332`:

```go
RemoteData:  sanitizeRemoteData(doc.Collection.RemoteData),
```

reaching the store at `export_import.go:412`. The only thing that keeps that path from firing is
that the value arrives from a JSON decode and is therefore representable — **a claim about TYPES,
which is precisely the claim this same comment rewrite explicitly disowns** ("What it used to say
was that no input path ... could carry a Go type structpb rejects — a claim about TYPES. That was
FALSIFIED"). So the new reason is incomplete, and the gap is quietly filled by the reason the
comment rejects.

**Suggested fix:** add ImportCollection to the discharge, and state its reason honestly — "reaches
this line only with JSON-decoded values, so representable today; that is a type argument and it is
weaker than the caller argument above."

### PO-2 — `Required` — the rewrite dropped `syntheticCollection()`, which is the path that matters

Same comment. The **pre-diff** version covered it: *"syntheticCollection() leaves RemoteData nil,
so the `!= nil` guard above skips this line entirely for that path."* The rewrite replaced that
with a param-struct-only argument and **lost the path**.

`GitHubPassThroughStore.syntheticCollection()` (`internal/platform/github/passthrough.go:644`)
builds `*ent.Collection` as a **struct literal**. It touches neither param struct. It is returned
by `GetCollection` (`:636`) and `ListCollections` (`:640`) — so it is the collection object for
*every* GitHub passthrough collection, i.e. exactly the object whose `remoteData.writable` the
dashboard gate reads.

The comment's named invalidating event is therefore not exhaustive:

> THE INVALIDATING EVENT, NAMED: anyone setting RemoteData on **either param struct** arms this line.

The **most likely** invalidating edit — someone enabling GitHub write support by adding
`RemoteData: map[string]any{"writable": true}` to that literal — is not on the list. A maintainer
who reads this comment, checks their edit against the named event, and sees no match, will
correctly conclude they are safe and be wrong. That is the exact harm this comment exists to
prevent, and it is the harm this round spent five prior rounds undoing.

**Suggested fix:** restore the `syntheticCollection()` clause and add it to the named invalidating
event: "…on either param struct, **or on the `ent.Collection` literal in `syntheticCollection()`**."

### PO-3 — `Required` — `doc.go`'s placement rationale is computed against a 12-commit-stale tree and is false against the merge target

`internal/webguard/doc.go`, repeated in `.design/project-log/2026-07-29-dev-xss-r6.md:184-186`:

> There is no CI configuration in this repository at all -- `.github` contains only issue and PR
> templates, and there is no workflows directory. So nothing here is enforced by a pipeline,
> because there is no pipeline.

True at `c108acb` (I confirmed: `.github` holds only the two templates). **False on the branch
this merges into.** On `cc927355e5a23c45bfd983cd331eb540b0a61ad5` — 12 commits ahead of
`7a0f220`, which is an ancestor — `.github/workflows/ci.yml` exists and runs:

| step | command |
|---|---|
| Which JS suites will actually run | `node scripts/ci-suite-manifest.mjs` |
| Build | `make build` |
| Go tests (invoked directly) | `go test …` |
| Web tests (invoked directly) | `npm test` |
| Makefile self-check | `make test` |

This does not merely date a sentence. `doc.go`'s central argument — *"THE EXECUTOR TRADE, MEASURED
RATHER THAN ASSUMED … NEITHER PLACEMENT DOMINATES"*, a guard in `web/` is missed by a Go-only
workflow, a guard here is missed by the image builds — **is void on merge, because the real
pipeline runs both suites.** The dilemma the round's most carefully reasoned document resolves
does not exist at the destination. The placement is still fine; the reasoning offered for it is
obsolete, and it is written in the present tense.

*(Attribution: that real `main` is `cc92735` and added `ci.yml` came from §7 — CONTAMINATED. That
`ci.yml` runs both suites, and that this falsifies `doc.go`'s premise, is mine. §7 pre-labelled
`ci.yml` as an "environmental fact you would otherwise measure as a finding" — see **B5**.)*

**Suggested fix:** re-derive the executor trade against `cc92735`, or bound the claim in time
("as of `c108acb`, and this is expected to change — see `cc92735`").

### PO-4 — `Optional` — the guard's population excludes the bytes actually shipped

`skipDirs` excludes `dist`. The repo root carries `//go:embed all:web/dist`, so `web/dist` is
the tree compiled into the server binary — the guard cannot see the artefact that ships. This is
a defensible choice (dist is build output, and scanning it would be noise), but the doc claims a
wider population than it has:

> WHAT IT COVERS: any occurrence of the literal strings "remoteData" or "remote_data" anywhere
> under web/, in any file, of any type.

Per the standing rule that a gate is only as good as the population it can see: **state the
population in the doc**, alongside the four limits already listed honestly.

### PO-5 — `Nit` — "occurrence census" is a line census

`censusRemoteDataMentions` records at most one mention per line (`break` after the first
identifier match). The declared grpc-client line contains **three** occurrences of `remoteData`
and counts as one. The *allowlist* semantics ("N occurrences of that exact text") are correct and
the practical impact is nil, since any edit to a declared line changes its text and goes red. But
this file's whole correctness argument is "we over-approximate and our errors are all in the noisy
direction", so its description of the unit it counts should be exact. Say "line census".

### PO-6 — `Optional` — undocumented ordering contract between two test helpers

`withRemoteDataLogClock` (`remotedata_log_test.go:62`) overwrites the package global
`remoteDataLogNow` and registers **no cleanup**; the restore lives in `captureRemoteDataLog`'s
`t.Cleanup`. All three call sites (`:80/81`, `:120/121`, `:176/177`) call capture first, so it is
**correct today** — I verified order-independence under `-shuffle` seeds 1, 2 and 3, all green. But
a future test calling only `withRemoteDataLogClock` leaks a frozen clock into every subsequent
test in `internal/server`, and nothing says so. Register the restore in `withRemoteDataLogClock`
itself.

### PO-7 — `FYI` — the guard does not fire for the server-side change `doc.go` says it exists to catch

`doc.go` justifies the Go placement thus: *"the reader it most needs to stop is a Go developer
changing the server-side shape of `remote_data`, and that developer's reflex is `go test ./...`."*

The census only reads `web/`. A Go developer who changes the **payload** shape — adds a key in
`issueBuildRemoteData`, or normalises `[]string` in `sanitizeRemoteData` — changes nothing under
`web/` and the guard stays green. It fires for that developer only if they change the `.proto` and
regenerate `web/src/gen/*`. So the guard catches **proto-shape** changes, not **payload-shape**
changes, and the payload is where the attacker-authored bytes live.

Compounding: the producer-side pin `internal/platform/github/remotedata_representability_test.go`
contains exactly two tests — `TestIssueBuildRemoteDataIsNotStructpbRepresentable` and
`TestGitHubBuilderRepresentabilityAsymmetry` — and **no Collection coverage at all** (grep for
`Collection`/`writable`: zero hits). So the collection capability gate is unpinned at both ends:
the consumer guard cannot see a producer change, and the producer test does not cover collections.
Not blocking — this is a scope observation, not a defect in what shipped.

### PO-8 — `FYI` — a correct and material fact worth surfacing to the EM

`issueBuildRemoteData` (`graphql_queries.go:476`) sets `"labels": issueLabels(issue)`
**unconditionally**, and `issueLabels` returns `make([]string, n)` — never nil, always `[]string`,
which `structpb` has no case for. **Therefore every GitHub passthrough task's `remote_data` is
dropped on the wire today.** The comment asserts exactly this and the assertion is **true**; I
verified it. The round's response was to make the drop audible rather than to fix it, which the
project log states openly ("The fail-closed accident was left armed"). That is a defensible
deferral and I am not filing it — but it means the field the B11 guard polices is, on the main
carrier path, always absent.

---

## PHASE TWO — findings after reading COMMON §7

All three are `CONTAMINATED`: §7 disclosed them and I cannot claim a cold read reached them.

### PT-1 — `CONTAMINATED` — the project-log table mixes a deletion result into a table about additions

Verified in-tree at `.design/project-log/2026-07-29-dev-xss-r6.md:137-139`:

```
| | file WITH declared entries | file with NONE |
| literal spelling  | RED (serialisation sink) | RED   |
| computed spelling | RED, as a disappearance  | GREEN |
```

The `computed / file-with-entries` cell reads **RED, as a disappearance** — that is the result of
*replacing* an existing declared line, i.e. a deletion, in a table whose row axis is additions.
The shipping table in §7 gives `GREEN` for computed access in both columns. The log also claims
"Every cell now has execution evidence", which is true per-cell and misleading in aggregate:
the cells are not commensurable. Exactly the failure COMMON §4 warns about. **Confirms §7 item 1.**

### PT-2 — `CONTAMINATED` — the failure header describes an absence on a path that also fires for a surplus

`remotedata_consumers_test.go:361`: `DECLARED remote_data SITE(S) NO LONGER MATCH`. The same
`t.Errorf` body ends by explaining that *"a count that is too HIGH is as much a failure as one that
is too low"* — so the header contradicts its own text on half its trigger conditions. **Confirms
§7 item 2.** Suggested header: `DECLARED remote_data SITE(S) DO NOT MATCH AT THE DECLARED COUNT`.

### PT-3 — merge blocker vs real `main`: **CONFIRMED BY INSPECTION, NOT EXECUTED**

- `cc92735:web/package.json` → `"test": "tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js"` (explicit file).
- `c108acb:web/package.json` → `"test": "rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs"` (discovery).
- `cc92735:scripts/ci-suite-manifest.mjs:117` → `unanalysable.push(\`${t} -> cannot map '${a}' to a tracked test file\`)`, documented **fail-closed**, and wired as a CI step.

`scripts/run-tests.mjs` is not a tracked test file, so the checker fails closed on merge.

**Pre-registration result: P7 outcome CORRECT, P7 arm WRONG.** I predicted failure by
*missing-file / empty-list*; the actual arm is *unanalysable-argument*. Recording this because a
red from the wrong arm is a different result from a red.

**This is NOT a defect of this diff and does not block it.** `run-tests.mjs` is `5c65382`/`d92ae5e`
(dev-xss-r2) and `d12f572` (dev-xss-r4). It is a merge-sequencing item for whoever lands this.

**Row status: CONFIRMED-BY-INSPECTION, not SURVIVED** — I did not construct the merge and did not
execute the checker, so this row carries no execution evidence.

---

## Verification performed

Every command logged to `_run-queue-log.md` with ROOT and DIST. No build token requested or spent.

| command | result | evidence |
|---|---|---|
| `go test ./internal/webguard/ -run '^TestWebRemoteData' -count=1 -v` | **PASS 2/2** (`ConsumersAreDeclared`, `CensusIsNonVacuous`) | named test output, not exit code |
| `go test ./internal/server/ -run '^TestZZZNoSuchTest$'` | `ok … [no tests to run]` | compile receipt incl. test files |
| `go test ./internal/platform/github/ -run '^TestZZZNoSuchTest$'` | `ok … [no tests to run]` | compile receipt incl. test files |
| `go test ./internal/server/ -run '^TestRemoteData' -shuffle={1,2,3}` | **PASS × 3** | order-independence of PO-6 |

`web/dist` present, mtime 06:52, built in **this** tree (role brief line 8 — note COMMON §2 says
otherwise; see **B2**). `web/node_modules` = **79** top-level entries, from this SHA's lockfile.
Nothing borrowed from any other tree.

**Wide build not run.** The project log itself flags this ("No `go build ./...`, `go vet ./...`,
`go test ./...`, `npm test` or `make` was run; the project build token was never spent … a single
`go test ./...` is recommended before merge") and I agree with the recommendation. My three
targeted runs establish that the three touched packages compile; **compilation of untouched
packages remains unverified.** I did not request the token because targeted runs answered every
question I had; if you want the wide gate before merge, that is a token spend I endorse.

---

## Positive Feedback

Not manufactured — these are things I checked and found correct.

- **Every citation in the rewritten comment resolves.** `entstore.go:1366/:1399/:2117` land in
  CreateCollection / UpdateCollection / ImportCollection; `server.go:1057`, `server.go:1085` and
  `graph_routing.go:83` all genuinely omit `RemoteData`. Given that the *previous* version of this
  comment cited `:408`/`:898` — task sites that resolve to plausible-looking `SetRemoteData` calls
  and thereby rewarded a diligent reader with false confidence — the correction is real and the
  new citations survive checking.
- **The web-side claims are accurate.** `capabilities.ts:98-99` and `ft-app.ts:254-261` both branch
  on `writable` and both default to not-writable. The fail-closed characterisation is right.
- **The `labels` claim is right** (PO-8), and it is the load-bearing justification for sampling.
- **`captureRemoteDataLog`'s save/restore is complete and correct** — log writer, log flags, the
  clock seam, and both sampler globals, all restored under `t.Cleanup`. I went looking for leaked
  global state here and did not find it.
- **The project log's "Not established" section** names what was not run instead of implying a
  green. That is the behaviour this project has been trying to install.
- **The guard's non-vacuity test earns its keep.** Deliberately duplicating part of the allowlist
  so that a bug emptying the allowlist cannot green both tests is the right call.

## Test Coverage

New paths are well covered: the sampler has first-line, suppression-and-count, and interval-expiry
tests under a pinned clock; `unrepresentableKeys` is exercised with two independent offenders. The
gaps are the ones named in PO-7 — no collection-side producer coverage, and no test pins the
`syntheticCollection()` literal that PO-2 identifies as the live invalidating surface.

## Backward Compatibility

No wire-format change. An unrepresentable map yielded a nil field before and yields a nil field
now; only the log output changes. Log-line **format** changed (keys appended, plus an optional
suppression suffix) — if anything greps these lines, that is a break, but I found no consumer.

---

## Final Verdict

# REQUEST CHANGES

**Blocking:** PO-1, PO-2, PO-3 — all three are false or materially incomplete assertive prose.
**Non-blocking:** PO-4, PO-5, PO-6, PO-7, PO-8, PT-1, PT-2. **Merge-sequencing, not this diff:** PT-3.

I want to be precise about why prose is blocking here, because on most reviews it would not be.
This round's entire thesis is that false reachability claims in comments are what cost five prior
rounds. PO-2 ships a comment that tells a maintainer which edit will arm a fail-closed path and
**omits the most likely such edit** — and it does so by deleting a clause that the pre-diff comment
had right. Approving that would ratify the exact defect class the round was convened to close.
The fixes are three comment edits.

**What would have flipped me to APPROVE** (pre-registered, restated): had PO-1/PO-2/PO-3 not been
present, the remaining findings are all Optional/Nit/FYI and I would have approved without
hesitation. Specifically, I pre-committed that guard inelegance, allowlist verbosity and the
apparatus:production ratio would **not** block — and they did not, though P1 confirmed at 17:1.
I also pre-committed to blocking on a production correctness defect (F1); **I found none, and I
looked.** The production change is correct.

---

## WHAT I DID NOT CHECK

- **No wide build.** `go build ./...`, `go vet ./...`, `go test ./...`, `npm test`, `make` — none
  run, no token requested. Untouched packages are unverified by me.
- **The web suite.** I ran no JS/TS tests at all. `npm test` needs the token.
- **PT-3 was not executed.** No merge constructed, `ci-suite-manifest.mjs` never run. Inspection only.
- **The five known flaky tests.** I ran no full suite, so I contributed no evidence about flake
  rates and none of my reds/greens are repeat-confirmed at suite scale (my four runs were targeted
  and, for the shuffle case, repeated three times).
- **`TestListUsers` / the red `main`.** Not investigated; out of this diff.
- **The guard as a security control** — explicitly another leg's question. I evaluated it as
  engineering only. **I did not attempt any evasion of the census**, so I contribute nothing to the
  deliberate-addition question, and my PO-7 remark about producer-side blindness should not be read
  as an adversarial result.
- **Planted mutations: none.** I modified no production code. Every behavioural statement above is
  from reading plus the four logged runs, so I have **no controlled negatives of my own** — where I
  say a path is not covered, that is an inspection claim, not a caused-and-observed one.
- **Out-of-tree consumers of `remote_data`.** Bounded to this tree only.
- **Whether GitHub collections being permanently read-only** (nothing in-tree ever sets
  `remoteData.writable`, so `GITHUB_CAPABILITIES` appears unreachable today) **is intended.** It is
  pre-existing and outside the diff; flagging it as a question, not a finding.

---

## WHERE THE BRIEF WAS WRONG

### B1 — `Critical, structural` — the §7 embargo is unenforceable, and it broke the cold pass on all three legs

The dispatch said "READ THESE TWO FILES, IN THIS ORDER, BEFORE YOU DO ANYTHING ELSE". The embargo
that section 7 must not be read until Phase One is on disk sits **at line 168 of the first of those
two files**. A read returns the file. The two instructions cannot both be obeyed.

This is not a near-miss. §5 states the cold pass is mandatory and that the reason is measured, and
§7 states you specifically wanted to know whether a cold read independently reaches the two known
inaccuracies. **That measurement is gone for this round on every leg**, because every leg got the
same ordering instruction against the same file.

**Fix, and it is cheap:** put §7 in its own file — `_r6-COMMON-PHASE-TWO.md` — and have §5 say
"open it now" at the point where Phase One is on disk. An embargo enforced by the file boundary
cannot be violated by a compliant reader. As written, the more obedient the leg, the more
thoroughly it is contaminated.

### B2 — `Required` — COMMON §2 asserts a per-leg fact in the second person and is false for me

> `web/dist` **was NOT built in your tree.** It was built once by the engineering manager in
> `/workspace/farmtable-review-xss-r6` … and **copied** into the other two trees.

`/workspace/farmtable-review-xss-r6` **is my root.** So the sentence tells me my dist was not built
in my tree while naming my tree as the place it was built. My role brief line 8 says the opposite
("was built in your tree … You are the only leg for whom this is true") and is the correct one.

The failure mode is generic: **a file shared by three legs cannot address "your tree" in the second
person about a fact that differs per leg.** The cost, had I trusted §2 over the role brief, is a
needless `npm run build` — a token spend — to establish something already true. Fix: state
provenance as a table keyed by leg root, in the shared file, with no second person.

### B3 — `Required` — "`git ls-remote` is the only cheap read in git that cannot be stale" is false in this topology

§7 offers this as the way to defeat the stale `main`. In my tree `origin` is **`/workspace/farmtable`**
— a local clone — not GitHub. So:

```
git ls-remote origin main  →  7a0f220dbd9332cb8db62138c841777432b4eda4
```

which is the **stale** value §7 warns about. A leg that followed the instruction would have
"verified" `main` with the authoritative-feeling tool and got the wrong answer, with the brief's
own assurance that this particular read cannot be stale. Only canonical has the GitHub remote.

`ls-remote` is unstale with respect to *the remote you name*; naming a stale intermediary inherits
its staleness. What actually worked: `cc92735` is present as an object in my tree, so
`git ls-tree`/`git show` against the SHA answered every question without any network read at all.
Fix: "`ls-remote` the GitHub URL, or read the SHA directly — your `origin` is a local clone."

### B4 — `Optional` — §7's guard description is accurate, and that is worth recording

Every structural claim in §7 about the guard (file+text keying, exact multiplicity under strict
equality, the non-vacuity companion, the computed-access mechanism) checks out against the source.
The two disclosed inaccuracies (PT-1, PT-2) are both real and both exactly as described. I found no
error in §7's account of the artefact. Noting this because "where the brief was wrong" should not
become a section that only ever fills up.

### B5 — `Required` — the targeting pre-labelled the fact that falsifies `doc.go` as environmental noise

§7 lists under **"ENVIRONMENTAL FACTS YOU WOULD OTHERWISE MEASURE AS FINDINGS"**:

> The real `main` … is `cc927355…` … and it added `.github/workflows/ci.yml`.

You had both halves — `ci.yml` exists on the merge target; `doc.go` and the project log assert no
CI exists anywhere in this repository — and the brief joined them into an instruction **not** to
treat the first as a finding. PO-3 is that join, and it is one of my three blocking items.

This is the §6 hazard firing in the live round: the brief did not merely fail to point at the
defect, it pre-classified the decisive evidence as noise. The generic fix is that an
"environmental facts" list should carry a standing rider — *these are facts about the environment,
not exemptions; if one of them contradicts something the diff asserts, that contradiction is a
finding.*

### B6 — `Optional` — the round's framing steered away from the highest-severity defects

§7 frames the round as "**`remote_data` is an attacker-authored map, and the question is what goes
RED when somebody adds a consumer of it**", and the surfaces named are the web consumer guard. My
three blocking findings are all on the **producer / reachability** side — `convert.go`'s collection
comment (PO-1, PO-2) and the guard's placement rationale (PO-3). None sits on the named surface.

The role brief's second bullet ("every sentence in a comment … that asserts a fact about the code")
is what actually found them, and it is the bullet with no named artefact attached. **Reported as
you asked: the open bullet outperformed all the targeted ones.**
