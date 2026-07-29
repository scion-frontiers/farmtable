# flakepop-81 — HOW MANY TESTS IN THIS REPOSITORY CAN SEE ANOTHER TEST'S ROWS?

**DIAGNOSIS ONLY. NO REMEDY IMPLEMENTED. NO TEST MARKED, SKIPPED, RETRIED, QUARANTINED, LOOSENED OR
DELETED. NO `t.Skip`, NO `-count`, NO RETRY WRAPPER, NO SLEEP, NO TIMEOUT BUMP.**
Working tree untouched: I never created one. See §0.2.

---

## §0 — THE BOUND OF EVERYTHING BELOW. READ THIS BEFORE ANY FINDING.

### 0.1 THE CORPUS, ITS SHA, AND ITS ROOT

| field | value |
|---|---|
| **SHA measured** | `cc927355e5a23c45bfd983cd331eb540b0a61ad5` |
| **ROOT of every source search below** | `/tmp/flakepop-81/src` |
| **ROOT of every log search below** | `/tmp/flakepop-81/joblog.txt` |
| **how obtained** | `gh api repos/scion-frontiers/farmtable/tarball/<SHA>` → `tar xz` |
| **resolved first attempt?** | **YES** |

**[MEASURED]** `gh api repos/scion-frontiers/farmtable/commits/main --jq .sha` →
`cc927355e5a23c45bfd983cd331eb540b0a61ad5`. So the SHA the coordinator relayed is `main`'s head, and
I did not have to take it on relay.

**[MEASURED]** `gh api .../actions/runs/30421407653` → `head_sha` =
`cc927355e5a23c45bfd983cd331eb540b0a61ad5`, `event` = `push`, `conclusion` = `failure`,
`created_at` = `2026-07-29T04:07:23Z`. Negative control: run id `1` → HTTP 404, exit 1. So the run
ID is not a string that merely looks like evidence.

**THE CORPUS IS CRYPTOGRAPHICALLY PINNED, NOT MERELY DOWNLOADED [MEASURED].** A tarball that
extracts at exit 0 can still be the wrong tree — the §9.3 class. So each cited file was verified by
recomputing its git blob hash locally and comparing with GitHub's:

| file | GitHub blob SHA @ cc92735 | locally recomputed | match |
|---|---|---|---|
| `internal/server/identity_test.go` | `e374508f…10df0` | `e374508f…10df0` | ✅ |
| `internal/testutil/teststore.go` | `543bf12f…36308` | `543bf12f…36308` | ✅ |

Negative control, mandatory per §8.4: the same computation over the same file **plus one appended
byte** yields `0d54f743…5ccd7`, which matches neither. **The instrument can tell the two apart.**

Content control on the extraction, expected non-zero and stated before the result: **208 `.go`
files, 53 `_test.go` files**, and both named files present and non-empty.

### 0.2 I DID NOT TOUCH CANONICAL, AND I DID NOT NEED THE CLONE I WAS GRANTED

The coordinator approved option (i) — `git clone --no-hardlinks` from `/workspace/farmtable`. **I did
not use it.** Fetching the tarball from the GitHub API at a pinned SHA is strictly better on every
axis the standing rules care about, and I am recording the reasoning because the grant is still open
and someone may otherwise assume I spent it:

- **It touches canonical zero times** — not a read, not a `fetch`, no ref, no object, no lock. The
  0.8 prohibition and the shared-`.git`-across-123-worktrees hazard are both moot rather than merely
  respected.
- **It cannot be dirty and cannot have diverged** — the OP-6 property. A clone of canonical inherits
  whatever canonical's working tree and refs happen to be; a tarball at a SHA cannot.
- **It resolves the coordinator's own trap.** §5 of the dispatch warned that canonical's
  `origin/main` was `7a0f220` at 03:55:29Z and the merge landed at 04:07, so **canonical may simply
  not contain `cc92735`**. Via the API that question never arises. I did not fetch, did not
  substitute a nearby ref, and did not fall back to `origin/main`.

**Build fence: nothing was built and nothing was run.** No `go build`, no `go vet`, no `go test`, no
`make`, no `npm`, not once — neither (a)-class nor (b)-class. **I made no entry in the run-queue log
because I ran nothing that requires one**, and I hold no token. Every measurement below is a read of
a pinned blob, a read of a completed CI log, or a `gh api` call.

### 0.3 CLAIMS I WAS TOLD NOT TO REUSE, AND DID NOT

**THE PRIOR "4.5% ACROSS FIVE TESTS" FIGURE IS NOT USED ANYWHERE IN THIS REPORT.** It is confounded
— the load in that measurement was the measurer's own parallelism — and the coordinator confirmed at
04:28Z that the brief overrides the standing-rules text that still carries it. **I did not reuse it,
I did not launder it into a range, and I did not restate it as a hedge.** No flake *rate* of my own
appears below either; I have exactly one observed failing run and one is not a rate.

**Conflict reported and adjudicated:** `_STANDING-RULES-2026-07-29.md` **OP-3 still states that
figure as live fact with no supersession marker at point of use.** The coordinator has confirmed
this is a real defect and is escalating to the eng-manager, who owns the file. Flagged here too,
because a leg that reads OP-3 and not this report will reuse the retracted number.

### 0.4 WHAT IS OUT OF SCOPE, SAID SO MY SILENCE IS NOT READ AS COVERAGE

**22 OF 32 GO PACKAGES HAVE NO TESTS AT ALL, AND 1 JS/TS TEST FILE EXISTS IN THE ENTIRE WEB TREE.**
That is the bigger number. **IT IS NOT MY TASK AND I DID NOT CHASE IT.** I neither confirmed nor
refuted those figures; they reached me through the brief and `ci-22-setup.md` and I have marked
them **[DERIVED]** wherever they appear. Nothing in this report should be read as a coverage
assessment.

---

## D1 — SOURCE-FIRST CENSUS

*Every item below is a read of a blob at `cc92735` under ROOT `/tmp/flakepop-81/src`. No execution.*

### D1.1 THE HEADLINE, BECAUSE IT DETERMINES THE SHAPE OF EVERY OTHER SECTION

**[MEASURED] `internal/testutil/teststore.go:21`:**

```go
DSN:     "file::memory:?cache=shared&_fk=1",
```

**[MEASURED] `go.mod:15`: `github.com/mattn/go-sqlite3 v1.14.44`.**

Under SQLite's shared-cache URI mode, `file::memory:?cache=shared` names **ONE in-memory database
per process**, shared by every connection that opens that same URI — and it lives exactly as long as
at least one connection to it remains open. **THIS IS NOT A PER-TEST DATABASE. IT IS A PROCESS-WIDE
SINGLETON WITH A REFCOUNTED LIFETIME, AND `NewTestStore` HANDS IT OUT ONCE PER CALLER WHILE READING
LIKE A CONSTRUCTOR.**

The pollution boundary is therefore **the test binary, i.e. the package** — Go compiles and runs one
process per package, so cross-package pollution is impossible even under `-p N`, and *within* a
package it depends entirely on whether the previous test's last connection has actually closed.

**[MEASURED] Exactly two sites in the tree construct a store on that DSN:**

| site | reached via |
|---|---|
| `internal/testutil/teststore.go:21` | the shared fixture — the chokepoint |
| `internal/server/graph_routing_test.go:23` | **a second, independent construction that bypasses the fixture** |

The second one matters for D3 and is treated there. Control for that search: the same `grep` shape
for `sql.Open` returns 12, so the pattern fires.

### D1.2 SHARED FIXTURES AND HELPERS

**`internal/testutil/` is the whole shared-fixture surface — two files [MEASURED]:**

| symbol | file:line | creates a store? | notes |
|---|---|---|---|
| `NewTestStore` | `teststore.go:16` | **yes — the shared in-memory DB** | returns `(*store.EntStore, func())`; cleanup is `s.Close()` only |
| `NewTestStorePostgres` | `teststore.go:30` | yes — **isolated**, unique schema per call | `t.Skip` unless `FARMTABLE_TEST_POSTGRES_URL` is set |
| `NewTestServer` | `testserver.go:19` | via `NewTestStore` | cleanup closes conn, srv, **and** store |
| `NewTestServerWithEphemeralPool` | `testserver.go:59` | via `NewTestStore` | cleanup closes store |
| `NewTestServerWithStreaming` | `testserver.go:99` | via `NewTestStore` | cleanup closes store |
| `NewTestServerPostgres` | `testserver.go:137` | via `NewTestStorePostgres` | isolated |
| `NewTestServerWithMultiStore` | `testserver.go:177` | **no** — caller supplies | cleanup closes conn+srv only |
| `NewTestServerWithAuth` | `testserver.go:213` | **no** — caller supplies `*store.EntStore` | **cleanup does NOT close the store (`:243-246`)** |
| `NewTestServerWithAuthAndStreaming` | `testserver.go:253` | **no** — caller supplies | **cleanup does NOT close the store (`:284-287`)** |

**THE TWO `…WithAuth…` CONSTRUCTORS ARE THE ONES `TestListUsers` USES, AND THEY ARE THE TWO WHOSE
CLEANUP DOES NOT OWN THE STORE.** That is not itself a defect — the caller holds `storeCleanup` — but
it splits teardown across two `defer`s whose ordering is load-bearing, which is D2's subject.

**`NewTestStorePostgres` is the only isolated fixture in the tree**, and it isolates properly:
`teststore.go:38` mints `test_<12 hex>` per call and `:69` drops the schema `CASCADE` on cleanup.
**IT IS ALSO SKIPPED IN CI** — `FARMTABLE_TEST_POSTGRES_URL` is unset on the runner, so every
Postgres-backed test `t.Skip`s. The isolated path is the one that does not run.

**Per-package helpers that write rows**, `internal/server` (non-`Test` funcs, file-local) — the
relevant ones by name: `createTestUserAndToken`, `setupAuthTestEnv`, `startServerWithLookup`,
`startServerWithLookupAndStreaming`, `newExportImportTestServer`, `lifecycleFixture`,
`createTestCollection`, `createCollectionAndTask`, `createLifecycleTask`,
`createClaimedLifecycleTask`, `createGitHubCollection`, `newTestService`,
`newPassThroughStoreWithMock`. **`createTestUserAndToken` is the one that writes user rows.**

### D1.3 PACKAGE-LEVEL AND `init()` STATE

**[MEASURED] `func TestMain` — ZERO occurrences tree-wide.** Positive control, same command shape:
`^func main()` → 3 hits. **So the pattern fires, and the zero is real.** There is no package-level
setup/teardown hook anywhere; nothing resets state between tests, because there is no place to.

**[MEASURED] `^func init()` — four occurrences, none of which touch the store:**

| file:line | what it is |
|---|---|
| `internal/platform/github/ratelimit_test.go:21` | test-local rate-limit knob |
| `internal/store/ent/runtime.go:23` | ent generated runtime |
| `api/farmtable/v1/farmtable.pb.go:8385` | protobuf registration |
| `internal/store/ent/migrate/schema.go:304` | ent generated schema |

**[MEASURED] Package-level `var`/`const` in `internal/server` tests** — `passthrough_e2e_test.go:26`
(`cannedIssuesResponse`, a const string), `server_test.go:17` (a const block), and three
`var _ = …` compiler-silencing bindings (`passthrough_e2e_test.go:424`,
`server_postgres_test.go:506-508`). **None is mutable shared state.**

> **THE SHARED STATE IN THIS PACKAGE IS NOT IN A GO VARIABLE. IT IS IN A DSN STRING, AND THAT IS WHY
> EVERY `init()`/`TestMain`/package-`var` CENSUS COMES BACK CLEAN WHILE THE TESTS STILL SEE EACH
> OTHER'S ROWS.** A reviewer who audits Go-level shared state — which is the audit the phrase
> "package-level state" invites — finds nothing and is entitled to conclude the package is isolated.

### D1.4 EVERY USE OF `t.Parallel` — AND IT IS THE FINDING THAT KILLS THE OBVIOUS THEORY

**[MEASURED] `t.Parallel()` appears at exactly 10 sites, in exactly 2 files, in exactly 1 package:**

| file:line |
|---|
| `internal/cli/link_test.go:54, :91, :101, :123, :133, :168, :184, :200` |
| `internal/cli/connect_test.go:6, :26` |

Positive control, same shape: `func Test` matches 52 files, so the search is not silently empty.

**THERE IS NO `t.Parallel()` ANYWHERE IN `internal/server`.** Therefore the tests in the failing
package **run strictly sequentially**, and:

> **THE `TestListUsers` FAILURE CANNOT BE A CONCURRENCY RACE BETWEEN TWO TESTS, BECAUSE NO TWO TESTS
> IN THAT PACKAGE ARE EVER RUNNING AT THE SAME TIME. IT IS A LIFETIME BUG, NOT A RACE BETWEEN PEERS
> — LEAKAGE FORWARD IN TIME FROM A TEST THAT HAS ALREADY RETURNED.**

This is worth stating flatly because "order- or parallelism-dependent" (the brief, §0.3) admits both,
and **only one of the two is possible here.** The distinction changes what a remedy would have to do,
which is why it belongs in a diagnosis and not in a remedy section.

### D1.5 TESTS THAT DEPEND ON ORDERING

**There is no declared ordering mechanism** — no `TestMain`, no explicit sequencing harness, no
build-tag ordering. Go's ordering is the source order of `func Test…` declarations, with files fed to
the compiler in sorted filename order. **That is an implicit, unpinned contract**, and the failure
observed is a function of it.

**[MEASURED, from the failing run's log, not inferred]** the executed neighbourhood of the failure:

```
=== RUN   TestWhoAmI                        --- PASS  (0.00s)
=== RUN   TestWhoAmI_Unauthenticated        --- PASS  (0.00s)
=== RUN   TestClaimTask_PropagatesUserID    --- PASS  (0.01s)
=== RUN   TestAddComment_PropagatesUserID   --- PASS  (0.00s)
=== RUN   TestListUsers
    identity_test.go:206: total = 3, want 2
--- FAIL: TestListUsers (0.01s)
=== RUN   TestGetUser                       --- PASS  (0.00s)
=== RUN   TestUpdateTask_PropagatesActorID  --- PASS  (0.01s)
```

This matches the declaration order in `identity_test.go` exactly, confirming sequential execution
**as observed** rather than as derived from the absence of `t.Parallel`.

### D1.6 EVERY PLACE THAT SEEDS, CREATES OR COUNTS A USER ROW

**[MEASURED] `CreateUser(` in `internal/server` tests — 23 call sites across 5 files:**

| file | sites |
|---|---|
| `internal/server/identity_test.go` | 7 |
| `internal/server/rbac_test.go` | 5 |
| `internal/server/auth_test.go` | 5 |
| `internal/server/export_import_test.go` | 4 |
| `internal/server/identity_enforcement_test.go` | 2 |

Positive control, same shape: `CreateAPIToken(` → 18. Both non-zero; the query fires.

**Counting sites** are enumerated by name in D3; the assertion under investigation is
`internal/server/identity_test.go:205-206`.

### D1.7 A CORRECTION TO THE BRIEF — THE "22 EXECUTIONS" DENOMINATOR IS DOUBLE-COUNTED

The brief (§0.3) and `ci-22-setup.md:617` both state: *"`TestListUsers` executed 22 times across the
11 pre-merge runs and failed 0 of them."* **THE NUMBER 22 IS CORRECT FOR THE NAME AND WRONG FOR THE
TEST.**

**[MEASURED] There are TWO distinct top-level tests named `TestListUsers`:**

- `internal/server/identity_test.go:184` ← **the one that failed**
- `internal/store/identity_test.go:92` ← a different test, in a different package, a different process

**[MEASURED] Exactly two duplicate top-level test names exist tree-wide** — `TestListUsers` and
`TestGetUser` — from 551 declared `func Test…` against 549 unique names. **[MEASURED] The failing run
executed `=== RUN   TestListUsers` exactly 2 times.**

> **11 RUNS × 2 DISTINCT TESTS = 22 EXECUTIONS OF A NAME, AND 11 EXECUTIONS OF THE TEST THAT FAILED.
> THE CLEAN PRIOR RECORD IS HALF AS LARGE AS REPORTED.**

Both files are even named `identity_test.go`, so **the failure string `identity_test.go:206` does not
identify the file either.** I disambiguated by reading line 206 of each: only
`internal/server/identity_test.go:206` is `t.Errorf("total = %d, want 2", …)`;
`internal/store/identity_test.go` is 353 lines but its line 206 is not that assertion.

**Bound on this correction:** my 551/549 counts `func Test…` **declared in source at `cc92735` under
my ROOT**, including packages whose tests `t.Skip` at runtime. `ci-22-setup`'s "501 invocations / 499
unique" counts what **executed on the runner**. These are different populations and I am not
claiming a contradiction — **but both independently show a difference of exactly 2, and I have named
which 2.** [MEASURED for mine; DERIVED for the 501/499.]

---

## D2 — `TestListUsers` SPECIFICALLY

*Bound: `internal/server/identity_test.go:184-208` @ `cc92735`, blob `e374508f…10df0`, verified in §0.1.
The failing test is the one in `internal/server`, **not** the same-named test in `internal/store` — see
D1.7 for how I disambiguated, because `identity_test.go:206` alone does not.*

### D2.1 WHAT `total` COUNTS AT `identity_test.go:206`

The chain, each link read at `cc92735` **[MEASURED]**:

`identity_test.go:206` asserts on `resp.GetTotalCount()`
→ `server.go:1396`: `TotalCount: int32(total)`
→ `server.go:1390`: `users, total, err := s.store.ListUsers(ctx, p)`
→ `entstore.go:1796`: `total, err := q.Clone().Count(ctx)`

and `q` at `entstore.go:1792-1795` is:

```go
q := s.client.User.Query()
if p.Type != "" {
    q = q.Where(user.TypeEQ(p.Type))
}
total, err := q.Clone().Count(ctx)
```

The test sends `&pb.ListUsersRequest{}`, so `req.Type` is nil, so `p.Type` is `""`, so **no `Where`
clause is ever attached**. The `Clone()` is taken **before** the cursor predicate (`:1805`) and
**before** `Limit` (`:1808`) are applied.

> **`total` IS AN UNFILTERED, UNPAGINATED `SELECT COUNT(*) FROM users` OVER THE ENTIRE DATABASE. IT
> IS NOT A COUNT OF THE USERS THIS TEST CREATED, AND IT IS NOT A COUNT OF THE PAGE RETURNED. IT
> COUNTS EVERY USER ROW VISIBLE ON THAT CONNECTION AT THAT INSTANT, WHOEVER WROTE IT.**

**THIS ASSERTION IS THEREFORE NOT AN ORDINARY ASSERTION — IT IS AN UNINTENTIONAL WHOLE-DATABASE
CONTAMINATION DETECTOR.** `want 2` is only correct under an unstated premise the test never checks
and cannot check: *that this database contains nothing but what this test put in it.* When it prints
`total = 3, want 2` it is not reporting a bug in `ListUsers`; **it is correctly reporting one extra
user row that belongs to somebody else.** The test is right. The number 3 is right. The premise is
what is false.

### D2.2 WHAT SEEDS THE ROWS IT EXPECTS

Two, both in-test, both direct store writes bypassing the API — `identity_test.go:189-190`:

```go
uA, _ := s.CreateUser(ctx, store.CreateUserParams{DisplayName: "user-a", Type: "agent",  Status: "active"})
s.CreateUser(ctx,       store.CreateUserParams{DisplayName: "user-b", Type: "human", Status: "active"})
```

**Both `CreateUser` errors are discarded** (`_`, and the second has no assignment at all), so a failed
seed would surface as a *count* discrepancy and nothing else. That matters: **this test cannot
distinguish "one row too many arrived from elsewhere" from "one row too few was seeded here."** It
reports the same symptom for both. `want 2` is `2` because these are the two.

### D2.3 WHO ELSE IN THAT PACKAGE WRITES A USER ROW

`internal/server` test files, in **filename order — which is execution order**, with `CreateUser(`
sites **[MEASURED]** (control: `CreateAPIToken(` → 18, non-zero):

| # | file | `CreateUser` sites | runs relative to `TestListUsers` |
|---|---|---|---|
| 1 | `auth_test.go` | 5 | before |
| 2 | `export_import_test.go` | 4 | before |
| 3 | `identity_enforcement_test.go` | 2 | before |
| 4 | **`identity_test.go`** | **7** | **contains it** |
| 5 | `rbac_test.go` | 5 | after |

Plus the helper `createTestUserAndToken` (D1.2). **23 user-row writers in the package; 11 of them run
before the failing assertion.**

**The immediate predecessor is what matters, and the arithmetic is exact [MEASURED from the failing
job log, not inferred]:**

```
=== RUN   TestAddComment_PropagatesUserID   --- PASS
=== RUN   TestListUsers
    identity_test.go:206: total = 3, want 2
```

`TestAddComment_PropagatesUserID` (`identity_test.go:145-182`) creates **exactly one** user,
`"comment-agent"` (`:150-154`).

> **1 (leaked from `TestAddComment_PropagatesUserID`) + 2 (seeded by `TestListUsers`) = 3. THE
> OBSERVED FAILURE IS ARITHMETICALLY EXACT, NOT MERELY CONSISTENT.**

Note what the arithmetic also **rules out**: 11 user-writing tests run before this one, and had the
database simply accumulated across the package the count would be far above 3. **The leak is
single-hop — one predecessor, not all of them.** Any mechanism proposed must explain both the leak
*and* its short reach. The one below does.

### D2.4 HOW THE STORE IS CREATED, AND WHETHER IT IS SHARED — WITH THE LINE

**Created at `identity_test.go:185`:** `s, storeCleanup := testutil.NewTestStore(t)`
**Which is `internal/testutil/teststore.go:16`, whose DSN is `teststore.go:21`:**

```go
DSN: "file::memory:?cache=shared&_fk=1",
```

**IT IS SHARED. NOT PER-TEST, NOT PER-CALL — ONE DATABASE PER PROCESS, KEYED BY THAT DSN STRING.**
Under SQLite shared-cache URI mode every connection opening that identical URI in the same process
attaches to the *same* in-memory database, and that database is destroyed only when the **last**
connection to it closes. `NewTestStore` returns a fresh `*store.EntStore` each call, so at the Go
type level each test appears to own a private store; underneath, all of them are handles onto one
database whose lifetime is refcounted across test boundaries. The server is handed that same `s` at
`identity_test.go:197` (`testutil.NewTestServerWithAuth(t, s)`), so client and test share it too.

`Migrate: true` (`teststore.go:22`) → `NewEntStore` runs `client.Schema.Create(ctx)`
(`entstore.go:54`). **`Schema.Create` is idempotent**, so attaching to an already-populated, already-
migrated database succeeds silently. **There is no error path that would announce the reattachment.**

### D2.5 THE MECHANISM — WHY THE DATABASE SOMETIMES SURVIVES ITS OWNER

The refcount must stay above zero across the boundary for a leak to occur. **Something must still
hold a connection when the test's `s.Close()` runs.** It is not hypothetical, and it is not the
gRPC plumbing. It is this, `internal/server/auth.go:214-220` **[MEASURED]**:

```go
func recordTokenUsage(lookup TokenLookup, tokenID uuid.UUID) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), tokenUsageTimeout)
		defer cancel()
		lookup.RecordUsage(ctx, tokenID)
	}()
}
```

**[MEASURED]** called from **both** interceptors — `auth.go:152` (unary) and `auth.go:201` (stream) —
on **every successfully authenticated RPC**. **[MEASURED]** `auth.go:23`:
`const tokenUsageTimeout = 5 * time.Second`. **[MEASURED]** `token_lookup.go:36-40`: `RecordUsage`
calls `l.store.UpdateTokenLastUsed(ctx, tokenID)` — **a write, to the shared store.**

Every property needed for the leak is present in those six lines:

1. **It is detached.** A bare `go func()` with no `WaitGroup`, no channel, no handle. **Nothing in
   the process can wait for it** — not the test, not `srv.Stop()`, not `s.Close()`.
2. **It deliberately outlives its RPC.** `context.Background()`, not the request context — so
   cancelling the RPC, closing the client conn, and stopping the server all fail to stop it. That is
   *intentional* (usage recording should not fail because the client hung up) and it is exactly what
   makes it outlive the test.
3. **It touches the database**, so it must take a pooled connection.
4. **[MEASURED] `entstore.go:342`: `db.SetMaxOpenConns(1)`.** There is exactly **one** connection.
   The straggler is not competing for a spare — it is contending for *the* connection.
5. **Its budget is 5 seconds**, orders of magnitude longer than the tests, which complete in 0.00–0.01s.

The teardown sequence, with the `defer` LIFO order read off the source
(`identity_test.go:186` registers `storeCleanup` first, `:198` registers `cleanup` second, so
`cleanup` runs **first**) — **[DERIVED]** from here down, and marked so:

1. Test body's last RPC (`client.ListUsers`, `:201`) authenticates → **spawns a straggler.**
2. `cleanup()` (`testserver.go:243-246`) → `conn.Close()`, `srv.Stop()`. **Neither knows the
   straggler exists.**
3. `storeCleanup()` → `s.Close()` → `entstore.go:365-367` → `s.client.Close()` → `sql.DB.Close()`.
   **`database/sql` closes *idle* connections immediately, but a connection currently *in use* is
   closed only when it is returned to the pool.** If the straggler holds it, the underlying SQLite
   connection stays open.
4. While it stays open, the shared in-memory database's refcount is **≥ 1**, so **the database is not
   destroyed and the rows are not freed.**
5. The next test calls `NewTestStore` → same DSN → **attaches to the surviving database**, rows and
   all. `Schema.Create` is idempotent, so nothing complains.
6. The straggler finishes, releases the connection — but the next test's connection is now the one
   holding the refcount, so the database persists into that test and is inherited.

**This explains the single-hop reach that D2.3 requires.** The window is one straggler's tail, so a
leak normally spans exactly one boundary; once no straggler overlaps a `Close()`, the refcount hits
zero, the database is destroyed, and the chain resets. It also explains why the failure is
**intermittent and load-sensitive** rather than deterministic: whether the straggler's connection use
overlaps the next `NewTestStore` is a scheduling race, and CI runners lose that race more often than
idle laptops do.

It also predicts which predecessor leaks worst, and the prediction matches the observed failure:
`TestAddComment_PropagatesUserID` issues **three** authenticated RPCs before teardown
(`CreateCollection :165`, `CreateTask :166`, `AddComment :171`) → **three** stragglers in flight at
`Close()`. It is the heaviest straggler-producer immediately preceding a count assertion in the file.

**STATUS OF THIS MECHANISM: the ingredients are MEASURED; the interleaving at step 3–5 is DERIVED and
UNCONFIRMED BY EXECUTION.** I hold no build token and ran nothing (§0.2).

**FALSIFIERS — any one of these kills it.** I state them because the mechanism is otherwise
uncomfortably tidy:

1. **The one that would settle it.** If `sql.DB.Close()` with `MaxOpenConns(1)` in fact never leaves
   a connection open past return — i.e. if `RecordUsage` always completes before teardown — the
   refcount always hits zero and the database can never survive. Testable **without running any
   test**: a standalone program opening the same DSN, holding a connection, and checking whether a
   second handle sees prior rows. **This is not a test-suite execution and would not need OP-1(b);
   I did not run it because I have not asked, and asking was not in scope tonight.**
2. If `UpdateTokenLastUsed` does not reach the SQLite connection (e.g. short-circuits on a nil or
   cached token), the straggler never holds the connection. **UNCHECKED — I did not read
   `UpdateTokenLastUsed`'s body.** Named here rather than quietly assumed.
3. If the observed `total = 3` were instead caused by a *seed* failure elsewhere plus an unrelated
   extra row, D2.2's discarded errors mean the symptom would look identical. The exact 1+2 match and
   the identity of the predecessor make this unlikely but **do not exclude it**; only inspecting the
   returned `Items` names (`user-a`, `user-b`, `comment-agent`) would. **The test discards
   `resp.Items`, so the failing run's log cannot tell us — the evidence that would confirm the
   mechanism is exactly the evidence the assertion throws away.**
4. If a leak of this kind existed, `TestGetUser` (which runs immediately after `TestListUsers`)
   should *also* frequently inherit rows — and it did, harmlessly, because it asserts on a **name**,
   not a count. **This is a prediction the mechanism makes and the log is consistent with; it is not
   proof, and it is the seed of D3.**

### D2.6 A COINCIDENCE I AM RECORDING AND EXPLICITLY NOT ACTING ON

**[MEASURED]** three independent 5-second constants exist on this path:
`auth.go:23 tokenUsageTimeout = 5 * time.Second`; `entstore.go:345 PRAGMA busy_timeout=5000`; and
the other failing test's **5.00s** deadline (D4).

**I AM NOT UNIFYING THESE. THE BRIEF FORBIDS IT AND THE BRIEF IS RIGHT.** Three 5-second constants in
one codebase is weak evidence — 5s is the most common round timeout a developer picks, and a shared
*value* is not a shared *cause*. It is recorded because a straggler contending for the single
connection under `busy_timeout=5000` is a route by which a **count** bug and a **clock** bug could
share an ingredient, and because if D4 turns out to involve connection starvation someone will want
this noted. **Falsifier for any future attempt to unify them:** show that `TestWatchTasks_NoInitial`
times out in a package or configuration where no authenticated RPC and therefore no
`recordTokenUsage` straggler exists — that would sever the link entirely. D4 treats it as a separate
species and reaches no conclusion here.

---

## D3 — THE POPULATION

**THIS IS A MEMBERSHIP LIST, NOT A COUNT.** Names below, not totals. Where I give a size it is a
label on a list that is written out in full.

### D3.0 WHERE I ENUMERATED, AND WHY THERE

The source-side chokepoint would be "tests that call `NewTestStore`" — and enumerating there is
**wrong**, because a test can reach the shared database without ever naming it: four of the eight
`testutil` server constructors call `NewTestStore` internally (D1.2), so a test that only writes
`NewTestServer(t)` is exposed and would not appear. **I enumerated at the DSN instead** — the single
string `file::memory:?cache=shared&_fk=1` — and swept every transitive route to it: the two
construction sites from D1.1 plus all six shared-DB `testutil` constructors.

### D3.1 THE EXPOSURE POPULATION — WHO CAN SEE ANOTHER TEST'S ROWS

**[MEASURED] 165 tests reach the shared in-memory database**, by package:

| package | exposed tests | pollution domain |
|---|---|---|
| `internal/server` | 95 | one process |
| `internal/store` | 60 | a **different** process |
| `internal/platform/github` | 7 | a different process |
| `internal/platform/beads` | 1 | a different process |
| `internal/cli` | 1 | a different process |
| `cmd/farmtable-server` | 1 | a different process |

Control: the same pass counts **551** total top-level `func Test`, matching D1's independent count —
so the walker sees the whole corpus and the 165 is a subset of a correct denominator.

**The full membership list is written to `/tmp/flakepop-81/exposed.txt`** (165 lines,
`file<TAB>test`), and its per-package census is above. I am not pasting 165 names into this report,
but they are enumerated, not estimated, and the file is the artifact.

**Answering the brief's title question literally: 165 tests can see another test's rows, bounded into
six independent domains, the largest being 95.** Because the shared cache is process-scoped and Go
runs one binary per package, **cross-package pollution is impossible** — `internal/store`'s leaks
cannot reach `internal/server`. That bound is structural, not observed, and it is the one piece of
good news here.

### D3.2 THE VISIBILITY POPULATION — WHO WOULD *NOTICE*

Exposure is not detection. A test that inherits rows and asserts only on a name passes anyway. **40
of the 165 assert on a count or total over state another test could write.** All 40 are named.

**I found them under two different idioms, and the second one nearly escaped me.** My first sweep
matched the protobuf shape (`TotalCount`, `len(...GetItems())`) and returned 20 members, all in
`internal/server` and `internal/platform/github`. That result **looked** like a complete population.
It was a complete population *of the wrong thing*: `internal/store` asserts in plain Go
(`total != 2`, `len(users) != 2`) and contributed **20 more** that the proto pattern could not match.
Had I stopped at the first sweep I would have reported half the population as all of it. The
coordinator's warning that "a large sample of the wrong population reads as exhaustive" is the exact
failure I nearly shipped; it was caught only by re-running with a deliberately different idiom.

#### Group A — NOT ISOLATED, AND NAKED. Unscoped aggregate over a root entity.

*Isolation established by: reading the query parameters at the cited line and finding no filter and
no parent scope. These assert over **every row of a table**, so any leaked row moves the number.*

| test | file:line | assertion | status |
|---|---|---|---|
| `TestListUsers` | `internal/server/identity_test.go:184` | `ListUsersRequest{}` → `TotalCount != 2` @ `:205` | **NOT ISOLATED — THIS IS THE OBSERVED FAILURE** |
| `TestListUsers` | `internal/store/identity_test.go:92` | `ListUsersParams{}` → `total != 2` @ `:104`, `len(users) != 2` @ `:107` | **NOT ISOLATED — an exact structural twin, different package** |
| `TestListLinkedAccounts_NoFilter` | `internal/store/linkedaccount_test.go` | `ListLinkedAccountsParams{}` → `total != 2` @ `:190`, `len != 2` @ `:194` | **NOT ISOLATED — naked by design; "NoFilter" is the point of the test** |
| `TestListAPITokens` | `internal/store/identity_test.go` | exact count | **NOT ISOLATED — UNCHECKED whether scoped by user ID** |
| `TestIntegration_WriteResults` | `internal/platform/github/integration_test.go` | `TotalCount` | **NOT ISOLATED — UNCHECKED scoping; different package, own domain** |

> **`internal/store`'s `TestListUsers` IS THE SAME BUG SITTING IN A SECOND PACKAGE, UNFIRED.** Same
> unscoped `ListUsers`, same `want 2`, same shared DSN, and it additionally asserts `len(users) != 2`,
> which makes it *more* sensitive than the one that failed. It has not failed yet because its
> package's leak windows have not lined up with it. **Anyone who fixes only the test that went red
> tonight leaves this one loaded.** This is the single most actionable finding in D3 and it is a
> membership fact, not a rate.

#### Group B — NOT ISOLATED, BUT ACCIDENTALLY SCOPED. Protected by a UUID, not by design.

*Isolation established by: reading the request/params literal and finding a `CollectionID`,
`ParentID`, `TaskID` or `UserID` that the test itself created. Since those IDs are UUIDs, a foreign
row cannot match the filter, so the count is unaffected by leaked rows.*

**[MEASURED] 6 of 6 `ListTasksRequest{}` literals in `internal/server/server_test.go` carry a
`CollectionId`. [MEASURED] 6 of 6 `ListUsersRequest{}` literals in tests carry no filter at all.**

> **THAT CONTRAST IS THE WHOLE EXPLANATION OF WHO FAILS.** Tasks, changes, comments and linked
> accounts all hang off a collection or a user that the test created, so their list queries are
> filtered by a UUID and are immune to inherited rows. **A user is a root entity — it hangs off
> nothing, so there is no UUID to filter by and no way to write a scoped assertion.** The task
> count-tests are not better written than `TestListUsers`; they are protected by an accident of the
> data model, and they would lose that protection the moment someone added an unfiltered
> `ListTasks` assertion.

Members, all NOT ISOLATED at the database level and all currently masked by scoping:
`TestRPC_ListTasks_FilterByPriority`, `TestRPC_ListTasks_Pagination`, `TestRPC_ListTasks_PageSizeCap`,
`TestRPC_ListTasks_Sort`, `TestRPC_GetBlockedTasks`, `TestRPC_GetBlockedTasks_TerminalDependencyMatrix`,
`TestRPC_GetBottlenecks`, `TestRPC_GetBottlenecks_BlockedBy`, `TestRPC_UpdateTask_AuditTrail`,
`TestRPC_ListLinkedAccounts` (all `internal/server/server_test.go` / `linkedaccount_test.go`);
`TestGraphIntegration_GetReadyTasks_SimpleChain`, `TestGraphIntegration_GetReadyTasks_IndependentTasks`,
`TestGraphIntegration_GetBottlenecks_SimpleChain`, `TestGraphIntegration_GetBottlenecks_Diamond`,
`TestGraphIntegration_GetBlockedTasks_NoneBlocked` (`internal/server/graph_integration_test.go`);
`TestPassthroughE2E`, `TestPassthroughE2E_LazyResolutionWithoutLinkedAccount`,
`TestPassthroughE2E_NativeCollectionUnaffected` (`internal/server/passthrough_e2e_test.go`);
`TestListChanges_FieldFilter`, `TestListTasks_FilterByLabels`, `TestListTasks_FilterByParent`,
`TestListTasks_FilterByPriority`, `TestListTasks_FilterByType`, `TestListTasks_Filters`
(`internal/store/entstore_test.go`); `TestListLinkedAccounts_FilterByCollection`,
`TestListLinkedAccounts_FilterByPlatform`, `TestListLinkedAccounts_Pagination`
(`internal/store/linkedaccount_test.go`).

**Caveat, stated because it weakens my own grouping:** I established scoping from the *request*
literal. For the `Graph*` and `Passthrough*` members I did **not** separately verify that the
server-side handler propagates that scope into the SQL. **Marked UNCHECKED.** If any handler ignores
the filter when computing its result set, that member belongs in Group A.

#### Group C — NOT ISOLATED, AND STRUCTURALLY BLIND. Floor assertions.

*These use `< 1` / `>= N`. **Added rows can only make a floor MORE true.** They cannot fail from
contamination — which means they also cannot report it.*

`TestClaimTask_ChangesRecorded`, `TestCloseTask_ChangesRecorded`, `TestUpdateTask_ChangesRecorded`,
`TestListTasks_DefaultSort`, `TestListTasks_Sort` (`internal/store/entstore_test.go`);
`internal/store/multistore_test.go:583` (`len(users) < 1`, `want >= 1`).

**This is the ARM E lesson from `dev-103-testlist.md` reappearing in the Go suite.** A floor is green
under contamination *and* green under correct behaviour, so it distinguishes nothing about the
property at issue. These five are exposed, will silently inherit rows, and **will never tell anyone**.

#### Group D — MAXIMALLY SENSITIVE. Assertions that the table is EMPTY.

| test | file:line | assertion |
|---|---|---|
| `TestTruncate` | `internal/store/ephemeral_test.go:40, :101` | `total != 0 \|\| len(tasks) != 0` — "want 0" |
| `TestListLinkedAccounts_FilterByStatus` | `internal/store/linkedaccount_test.go:328` | `total != 0` |

**`want 0` is the strictest possible pollution detector: any single leaked row fails it.** These are
the canaries. `TestTruncate` is doubly interesting — it asserts emptiness *after* truncating, so it
fails only if a row arrives from another test **after** the truncate, i.e. it is sensitive to
concurrent stragglers specifically, which is precisely the D2.5 mechanism. **It has not been observed
failing. That is evidence about leak timing, and I have not measured it.**

#### Group E — GENUINELY ISOLATED.

*Everything constructed via `NewTestStorePostgres` / `NewTestServerPostgres`.* Isolation established
by reading `teststore.go:38` (unique `test_<12 hex>` schema per call) and `:69` (`DROP SCHEMA
… CASCADE` on cleanup). **This is real, per-test, enforced isolation.**

> **AND IT IS THE PATH THAT DOES NOT RUN.** These tests `t.Skip` unless
> `FARMTABLE_TEST_POSTGRES_URL` is set, and it is unset on the CI runner. **The repository already
> contains a correct isolation pattern; CI exercises the broken one exclusively.** The fix is not
> unknown to this codebase — it is unreachable in this configuration.

### D3.3 THE BOUND OF THIS ENUMERATION

1. **Corpus bound:** `cc92735`, ROOT `/tmp/flakepop-81/src`, `*_test.go` only. Cryptographically
   pinned (§0.1). Does not cover uncommitted work, other branches, or the JS/TS suite.
2. **Static bound, and it is the serious one.** Membership was determined by **reading source, not by
   running anything** (§0.2 — no build token). A test that reaches the store through a helper I did
   not trace, or that asserts a count via a helper like `assertCount(t, …)` rather than an inline
   comparison, **is exposed and is missing from my list.** My awk matches inline idioms only.
3. **Idiom bound:** two idioms swept (proto and plain-Go). **A third idiom would produce a third
   population and I would not know.** D3.2 documents that this already happened once.
4. **Scoping bound:** Group B membership rests on request literals, not on handler SQL (UNCHECKED,
   flagged above).
5. **No rate is claimed.** I observed one failing run. **One is not a rate**, and per §0.3 I did not
   import the retracted figure to supply one.

**FALSIFIER FOR THE WHOLE ENUMERATION:** grep the corpus for `_ = ` bindings and helper-based
assertions over list results; if any test asserts a count through a helper whose name does not
contain `len`, `total`, `Count` or `Items`, **my population is an undercount and the number 40 is
wrong.** A cheaper falsifier: **any test that inherits rows and fails on a count assertion I have
not listed immediately refutes the list.** I would rather that be found by someone reading this than
by my claiming completeness I did not earn.

**WHAT I COULD NOT DO: I DID NOT REPRODUCE ANY OF THIS, BECAUSE I WAS NOT PERMITTED TO RUN IT.** I
hold no build token, I did not request one, and every claim above is a source read or a read of the
completed CI log. **I am saying that plainly rather than quietly downgrading the deliverable.** The
mechanism in D2.5 remains DERIVED, and D3's Groups A–E are a *static* partition whose dynamic
behaviour is unverified.

---

## D4 — `TestWatchTasks_NoInitial`, TREATED SEPARATELY

**THIS IS A DIFFERENT SPECIES FROM D2/D3 AND I AM NOT MERGING IT. §4.1 BELOW RECORDS THAT I TESTED
THE BRIDGE I MYSELF PROPOSED AND IT BROKE.**

### D4.1 THE BRIDGE I PROPOSED IN D2.6 IS SEVERED — MEASURED, NOT ASSUMED

In D2.6 I recorded a possible shared ingredient between the count bug and the clock bug, and I wrote
the falsifier that would kill it: *"show that `TestWatchTasks_NoInitial` runs in a configuration
where no authenticated RPC and therefore no `recordTokenUsage` straggler exists."*

**[MEASURED] `internal/testutil/testserver.go:99-134`, `NewTestServerWithStreaming` — the constructor
this test uses at `watch_test.go:85` — builds its `grpc.NewServer` with exactly two options,
`MaxRecvMsgSize` and `MaxSendMsgSize`. THERE IS NO `UnaryInterceptor` AND NO `StreamInterceptor`. No
auth interceptor is installed on this path at all.**

`recordTokenUsage` is called **only** from `auth.go:152` and `auth.go:201`, both inside interceptors
that are not present here. **Therefore no straggler goroutine exists on the WatchTasks path, and the
D2.5 mechanism cannot be the cause of this failure.**

> **THE FALSIFIER FIRED AGAINST MY OWN HYPOTHESIS. THE 5-SECOND COINCIDENCE IN D2.6 IS A
> COINCIDENCE.** The brief's instruction not to unify these prematurely was correct, and it was
> correct for a reason I could only establish by trying to unify them and failing. Recorded here so
> that nobody re-proposes the link without re-reading this paragraph.

Note also `testserver.go:130-133`: this constructor's cleanup **does** close the store
(`conn.Close(); srv.Stop(); storeCleanup()`), unlike the two `…WithAuth…` constructors in D1.2.

### D4.2 WHAT ACTUALLY FAILED

**[MEASURED] from the job log, lines 1711-1713:**

```
=== RUN   TestWatchTasks_NoInitial
    watch_test.go:118: timed out waiting for event
--- FAIL: TestWatchTasks_NoInitial (5.00s)
```

**[MEASURED] `watch_test.go:118`** is `event := recvEvent(t, stream, 5*time.Second)`, and
**`recvEvent` (`watch_test.go:14-35`)** races `stream.Recv()` in a goroutine against
`time.After(timeout)`, calling `t.Fatal("timed out waiting for event")` on the timeout branch.
**The 5.00s duration is that constant, not a coincidence, and not the same 5 as `tokenUsageTimeout`.**

**NOTHING WAS COUNTED HERE AND NOTHING WAS MISCOUNTED. AN EVENT THAT WAS EXPECTED TO ARRIVE NEVER
ARRIVED.** That is a delivery failure, not a state-visibility failure.

### D4.3 THE MECHANISM — A LOST EVENT, NOT A SLOW ONE

The test's ordering, `watch_test.go:102-118`:

1. `:102` `client.WatchTasks(streamCtx, …)` — **returns as soon as the client-side stream object
   exists. gRPC does not wait for the server handler to be scheduled, let alone to reach any
   particular line of it.** This is the load-bearing fact.
2. `:110` `client.CreateTask(…, "new-task")` — the server publishes a CREATED event to the bus.
3. `:118` `recvEvent(..., 5*time.Second)` — waits.

Server-side, `internal/server/watch.go`, the handler must reach **`:60 sub := s.eventBus.Subscribe(filter)`**
before that publish, or the event is gone. **[MEASURED] the work that precedes `:60`:**

| line | work before `Subscribe` |
|---|---|
| `:23` | `RequireIdentity(stream.Context())` |
| `:26` | `RequireScope(…, ScopeTaskRead)` |
| `:29` | `validateWatchTasksRequest(req)` |
| `:35` | `uuid.Parse(*req.CollectionId)` |
| `:39` | `RequireCollectionAccess(…, collID)` |
| **`:43`** | **`s.store.GetCollection(stream.Context(), collID)` — A FULL DATABASE ROUND TRIP** |

> **THE HANDLER PERFORMS A DATABASE QUERY BEFORE IT SUBSCRIBES. THE SUBSCRIPTION WINDOW IS THEREFORE
> AS WIDE AS A SQLITE ROUND TRIP ON A POOL OF EXACTLY ONE CONNECTION (`entstore.go:342`,
> `SetMaxOpenConns(1)`) THAT THE TEST'S OWN `CreateTask` IS SIMULTANEOUSLY COMPETING FOR.**

The event bus is a plain pub/sub with no replay and no buffered backlog for late subscribers — the
handler reads from `sub.Events` in the `for/select` at `:84-94`, and an event published before
`Subscribe` at `:60` was never written to that channel and can never be recovered. **So the failure
is not "the event was slow." The event was published to nobody and is permanently lost. The 5 seconds
is simply how long the test waits before admitting it.** No timeout value would fix this; a longer
deadline waits longer for something that will never come. **[DERIVED]** — the ordering is read from
source; I did not execute it.

### D4.4 WHY ITS SIBLINGS PASS, AND WHY THAT IS NOT REASSURING

**[MEASURED]** `TestWatchTasks_IncludeInitial` (`watch_test.go:37`) passed in 0.00s. It sets
`IncludeInitial: true`, so the handler takes the `:65-79` branch and sends a snapshot **read from the
database**, plus a `SNAPSHOT_COMPLETE` event. **Its first `Recv` is satisfied by data that exists
regardless of subscription timing, so it has no lost-event window at all.** It is structurally
immune, not luckier.

`TestWatchTasks_CreatedEvent` (`:130`) is a different matter. **[MEASURED]** it also calls
`WatchTasks` (`:137`) and then `CreateTask` (`:144`) with `IncludeInitial` unset, i.e. **it has the
identical subscribe-after-publish race and it passed in 0.00s this run.**

> **`TestWatchTasks_NoInitial` IS NOT A UNIQUELY BROKEN TEST. IT IS ONE MEMBER OF A GROUP THAT SHARES
> ONE RACE, AND IT IS THE MEMBER THAT LOST THIS TIME.** Anyone who "fixes" only the test that went
> red will leave `TestWatchTasks_CreatedEvent`, `_UpdatedEvent` and `_ClosedEvent` holding the same
> loaded gun — **exactly the same shape of error as fixing only `internal/server`'s `TestListUsers`
> and leaving `internal/store`'s (D3.2 Group A).** The two species are unrelated in mechanism and
> identical in this one respect: **the red test is a sample, not the population.**

**Membership of the WatchTasks race group** (`internal/server/watch_test.go`), by the criterion
*"subscribes then publishes, with no barrier proving the subscription landed"*:
`TestWatchTasks_NoInitial` (**observed red**), `TestWatchTasks_CreatedEvent`,
`TestWatchTasks_UpdatedEvent`, `TestWatchTasks_ClosedEvent`. **Excluded:**
`TestWatchTasks_IncludeInitial`, by the structural argument above. **Bound:** I classified these from
the call ordering inside each function; I did **not** verify `_UpdatedEvent`/`_ClosedEvent` line by
line. **UNCHECKED — falsifier: if either establishes a barrier (an initial Recv, or a create before
the watch) it drops out of the group.**

### D4.5 RELATION TO D3

`TestWatchTasks_NoInitial` **is** a member of D3.1's 165 exposed tests — `NewTestServerWithStreaming`
calls `NewTestStore` at `testserver.go:101`, so it shares the process-wide database like everything
else in the package. **That exposure is real and it is not what failed here.** It is worth stating
plainly because the temptation, having found a database bug, is to attribute the second failure to it
too. **Exposure to a shared database is necessary for a D3-class failure and is nowhere near
sufficient; this test demonstrates the difference by being exposed and failing for an entirely
different reason.**

---

## D3 ADDENDUM — PROVENANCE OF EACH SPECIES, AND A DELIBERATE THIRD-SPECIES PASS

*Added after D3 and D4 were written, at the coordinator's unprompted correction of 04:42Z. D3 and D4
are unchanged; this is an addendum, not a rewrite.*

### A.1 THE CORRECTION, AND WHY IT LANDS

The coordinator authored the two-species framing in my brief and then told me so, warning that if my
census returns "both species present" that is **retrieval of the author's list, not independent
discovery** — a leg primed with a class finds the class, honestly, with correct measurements, which
is exactly what makes it invisible from the inside. Compounded by the trailing-omission property:
an enumeration's *interior* gaps announce themselves, its *end* cannot, because the end of a list is
what a list looks like.

**THIS APPLIES TO MY REPORT AS WRITTEN.** D1–D4 above confirm two species and are organised around
two species, and I did not arrive at that number — **I was given it.**

### A.2 PROVENANCE TABLE

| species | provenance |
|---|---|
| Row visibility across tests — count/total assertions over a shared database (D2, D3) | **NAMED IN BRIEF** |
| Clock/deadline expiry — `TestWatchTasks_NoInitial` at 5.00s (D4) | **NAMED IN BRIEF** |
| *(any third)* | **NOT FOUND IN ONE PASS** |

> **EVERY SPECIES IN THIS REPORT WAS NAMED IN THE BRIEF. I FOUND NO SPECIES THE BRIEF DID NOT HAND
> ME.** That is a real and reportable result, and it is **equally consistent with the brief's list
> having been short.** The tidiness of D1–D4 should not be read as completeness, and I am not
> claiming "there are two."

What *was* independent is narrower and I will not inflate it: the **mechanism** in D2.5 (shared-cache
DSN + refcounted database lifetime + detached `recordTokenUsage` goroutine), the **membership** of
D3, the **scoped-vs-root discriminator** in D3.2, the D1.7 **name-collision correction**, and the
D4.1 result **severing the bridge between the two species**. Mechanism and membership inside a
handed-down class are not a new class.

### A.3 THE THIRD-SPECIES PASS — CORPUS-SHAPED, NOT LIST-SHAPED

I shaped this pass by asking a corpus question — ***what process-global mutable state exists that two
tests in one binary could both touch?*** — deliberately **not** "where else might rows leak or clocks
expire." Sweep and results, control first:

**Control: `testing.T` in `*_test.go` → 770 [MEASURED].** The instrument fires on this corpus.

| candidate global state | hits | verdict |
|---|---|---|
| `os.Setenv` (unrestored, process-global) | **0** | absent |
| `os.Chdir` (process-global cwd) | **0** | absent |
| `sync.Once` in tests (order-dependent init) | **0** | absent |
| `http.DefaultServeMux` (global registry) | **0** | absent |
| `prometheus.MustRegister` / `promauto` (duplicate-registration panics) | **0** | absent |
| `rand.Seed` (global RNG) | **0** | absent |
| fixed `/tmp` paths / `os.TempDir` collisions | **0** | absent |
| wall-clock **boundary** arithmetic (`AddDate`, `Truncate(24h)`, `Format("2006-01-02")`, `time.Local`) | **0** | absent — **a genuinely distinct third species I expected to find and did not** |
| `net.Listen` on a fixed port | 1 | **RULED OUT** — `unified_test.go:82` binds `127.0.0.1:0`, OS-assigned, cannot collide |
| `t.Setenv` + `t.Parallel` in one function (panics) | 1 file, **0 functions** | **RULED OUT** — `internal/cli/link_test.go` contains both idioms but **[MEASURED]** no single function calls both |
| package-level mutable globals in production code | 36 | **RULED OUT** — inspected; all are read-only lookup tables (enum name/value maps, `transitionTable`, `stagePrecedence`) plus one shared `http.Client`. No test writes to any. |

**RESULT: NO THIRD SPECIES FOUND IN ONE PASS. I AM STATING THAT AS THE BOUND AND NOT UPGRADING IT TO
"THERE ARE TWO."**

**And this pass has an end too, which is its least trustworthy part.** Named so the next leg can
start past it — **UNCHECKED, all of it:** goroutine leaks other than `recordTokenUsage`; `bufconn`
listener exhaustion; ent client-level caching; CGO/SQLite global state below `database/sql`; test
fixtures reading committed files that another test rewrites; `-race`-only failures; anything in the
JS/TS suite; and any species that manifests **only** under the package-level parallelism (`-p`) that
I was not permitted to run. **Falsifier for A.3 as a whole:** any flake in this repository whose
mechanism is neither shared-database rows nor an expiring timer refutes "no third species found"
immediately — and I would expect that to come from the `-race` or `-p` axes, which are exactly the
ones a source census cannot reach.

### A.4 UNCLASSIFIED FINDINGS — NOT FORCED INTO EITHER SPECIES

Per the coordinator's instruction 3, these do not fit species 1 or 2 and I am neither dropping them
nor filing them under the nearer heading.

**U-1. Duplicate top-level test names corrupt the evidence used to reason about flakes.**
**[MEASURED]** `TestListUsers` and `TestGetUser` each exist twice (D1.7). **This is not a flake
mechanism at all — it is a measurement defect**, and it already produced a wrong number in a prior
report (the "22 executions" denominator, which is 11). It belongs to neither species because it does
not make anything fail; **it makes failures be counted against the wrong test.** Falsifier: show that
the gate's reporting keys on package-qualified names rather than bare test names, and U-1 is inert.

**U-2. A subset of assertions is structurally incapable of reporting contamination.**
D3.2 Group C — five floor assertions (`len(x) < 1`, `>= N`) over shared state. **Added rows can only
make a floor more true.** This is not a failure mode; it is **the absence of one where one is
warranted**, so it fits neither a "count" species nor a "clock" species. It is the ARM E finding from
`dev-103-testlist.md` recurring in the Go suite. Falsifier: convert one to an exact count and it
either goes red immediately (contamination present, detection was the only thing missing) or stays
green (Group C is inert).

**U-3. The repository contains a correct isolation pattern that CI never executes.**
`NewTestStorePostgres` isolates per-test by unique schema (`teststore.go:38`, `:69`) — and every test
using it `t.Skip`s because `FARMTABLE_TEST_POSTGRES_URL` is unset on the runner. **A configuration
fact, not a failure species**, but it determines which of D3's groups are live. Falsifier: set the
variable in CI and the entire Postgres membership changes isolation class.

---

## D5 — OUT OF SCOPE, RECORDED SO SILENCE IS NOT READ AS COVERAGE

**[DERIVED — from the brief and `ci-22-setup.md`; I did not verify these and did not chase them]:**

- **22 of 32 Go packages have no tests at all.**
- 501 test invocations / 499 unique names on the gate.
- **Exactly 1 JS/TS test file in the entire web tree.**

**THIS IS THE BIGGER NUMBER AND IT IS NOT MY TASK.** My entire report concerns the reliability of
tests that exist; it says nothing about the 22 packages where the question does not arise. **A green
gate after every finding in this report is fixed would still be a green gate over 10 of 32 Go
packages.**

One measured contact point, offered because it bears on the figures rather than to expand scope:
**[MEASURED] 551 top-level `func Test` are declared in source at `cc92735`, of which 549 are unique**
— versus the gate's **[DERIVED]** 501/499. Different populations (declared vs executed; mine includes
`t.Skip`ping Postgres tests), so **not a contradiction and I am not reporting one**. But both show a
gap of **exactly 2**, and D1.7 names which 2. The ~50-invocation difference between declared and
executed is **UNCHECKED** and is a reasonable next question for whoever owns coverage.

---

## D6 — NOT REACHED

*Every bound I did not measure, each with the falsifier that would settle it. **Nothing in this
section is a finding. It is the shape of my ignorance, stated so it is not mistaken for coverage.***

| # | not reached | falsifier / how to settle it |
|---|---|---|
| 1 | **No execution of any kind.** No `go build`, `go vet`, `go test`, `make`, `npm` — I hold no build token and did not request one (§0.2). **Every dynamic claim in this report is DERIVED.** | Run `internal/server` under OP-1(b) with `-v`; if `TestListUsers` never reports `total = 3` across repeated runs, D2.5 is wrong. |
| 2 | **The D2.5 interleaving.** That a `recordTokenUsage` straggler holds the single connection past `s.Close()` and keeps the shared database alive. | A standalone program (not a test-suite run) opening `file::memory:?cache=shared&_fk=1`, holding one connection, and checking whether a second handle sees prior rows. Settles it without touching the gate. |
| 3 | **`UpdateTokenLastUsed`'s body.** I never read it. If it short-circuits, no straggler ever takes the connection and D2.5 collapses. | Read `entstore.go`; confirm it issues SQL. |
| 4 | **The failing run's `Items` payload.** `TestListUsers` discards `resp.Items`, so I cannot prove the third row was `comment-agent`. **The evidence that would confirm the mechanism is what the assertion throws away.** | Print the names on failure; if the extra row is not `comment-agent`, D2.3's arithmetic is coincidence. |
| 5 | **Group B handler scoping** (D3.2). Established from request literals, not from handler SQL. | Read each handler; any that ignores its filter moves that test into Group A. |
| 6 | **Group C/D dynamic behaviour.** `TestTruncate` asserts `want 0` and has never been observed failing. I do not know whether that means leaks never reach it or merely that they have not yet. | Instrument the leak window; a single observed `TestTruncate` failure confirms post-truncate arrival. |
| 7 | **D4.4 group membership.** `_UpdatedEvent`/`_ClosedEvent` classified from call ordering, not line-by-line. | Read each; a barrier before the publish drops it from the group. |
| 8 | **Frequency of anything.** I observed **one** failing run. **One is not a rate**, and per §0.3 I did not import the retracted figure to manufacture one. **I therefore state no flake rate at all.** | Repeated runs under the token. |
| 9 | **The `-p` and `-race` axes.** Package-level parallelism and the race detector are exactly the conditions a source census cannot see, and A.3 names them as the likeliest home of an unfound third species. | Run the suite under `-race`; any failure there is by construction outside both named species. |
| 10 | **Everything listed in A.3's own trailing bound** — goroutine leaks beyond `recordTokenUsage`, bufconn exhaustion, ent caching, CGO/SQLite global state, the JS/TS suite. | Each named there. |
| 11 | **Whether the gate keys failures on bare or package-qualified test names** (U-1). Determines whether the 11-vs-22 correction propagates to other reports. | Inspect the gate's reporting configuration. |

---

## D7 — REMEDY HYPOTHESES — NOT A RECOMMENDATION

**I IMPLEMENTED NONE OF THESE. NO CODE IN THIS REPOSITORY WAS MODIFIED BY ME, NOT EVEN TEMPORARILY,
NOT EVEN TO ISOLATE SOMETHING.** These are hypotheses with falsifiers, listed so the next leg does
not have to re-derive them. **Each is a guess about a mechanism that is itself DERIVED (D6.1–2).
Anyone acting on one should settle D6.2 first, because if the mechanism is wrong, H1–H4 are all
solutions to a problem that does not exist.**

**H1 — Give each test its own in-memory database by making the DSN unique per call.**
The Postgres fixture already does exactly this (`teststore.go:38`, unique schema per test), so the
pattern is established in-repo rather than imported. *Falsifier:* if `TestListUsers` still sees
`total = 3` with a per-call-unique DSN, the leak is not via the shared cache and D2.5 is wrong.
*Risk that must be checked first:* any test relying on two `NewTestStore` handles addressing the
**same** database would break — **UNCHECKED whether any does.**

**H2 — Make `recordTokenUsage` waitable and drain it at shutdown.**
Removes the detached goroutine that D2.5 blames for holding the connection. *Falsifier:* if leaks
persist with the straggler fully drained, the connection is being held by something else and the
diagnosis is misattributed. *Note:* this changes production behaviour, not just tests, and the
detachment is deliberate — usage recording should not fail because a client hung up.

**H3 — Close the store before stopping the server, or have `…WithAuth…` own the store.**
Addresses the split teardown in D1.2. *Falsifier:* reorder and re-run; if the leak persists, ordering
was never the variable. *I suspect this one is wrong* — the LIFO order in `TestListUsers` is already
correct (D2.5), so it likely treats a symptom.

**H4 — Make `WatchTasks` subscribe before its pre-flight database query**, moving `Subscribe`
(`watch.go:60`) above `GetCollection` (`watch.go:43`), or have the server emit a stream-ready signal
the client can await. Narrows or closes D4.3's lost-event window. *Falsifier:* if
`TestWatchTasks_NoInitial` still times out with the subscription taken first, the window is elsewhere.
*Note:* subscribing before authorisation checks has its own consequences and is not obviously safe.

**H5 — Scope or strengthen the assertions rather than the isolation.** Distinct from H1–H4: it
changes what tests *detect*, not what they *do*. Converting Group C floors to exact counts (U-2) and
asserting on `Items` membership rather than `TotalCount` (D6.4) would make contamination *visible*
instead of *absent*. *Falsifier:* the ARM E result in `dev-103-testlist.md` — an exact count is still
count-shaped and can still pass under a count-neutral substitution; **only membership assertions go
red.** *This is a detection change, and on its own it would make CI redder, not greener.*

**WHAT I WOULD WARN AGAINST, STATED AS DIAGNOSIS AND NOT AS A RECOMMENDATION TO ACT:** every finding
in this report says the two red tests are **samples, not populations** — `internal/store`'s
`TestListUsers` carries the identical unscoped assertion (D3.2 Group A) and three sibling WatchTasks
tests carry the identical race (D4.4). **A change that turns the two observed failures green without
addressing the mechanism would move this from a red gate to a green gate over the same defects, and
would delete the only two instruments currently reporting them.**

---

## CLOSING — COMPLIANCE

- **Diagnosis only.** No test marked, skipped, retried, quarantined, loosened or deleted. No `t.Skip`,
  no `-count`, no retry wrapper, no sleep, no timeout bump. **No file in any repository was modified.**
- **The gate was not reverted, disabled or softened.**
- **The retracted "4.5% across five tests" figure was NOT reused**, in any form, and **no flake rate
  of my own is claimed** — I observed one failing run and one is not a rate (§0.3, D6.8).
- **OP-1 build fence respected.** Nothing built, nothing run, no token requested. **No run-queue log
  entry was made because I ran nothing requiring one.**
- **`/workspace/farmtable` (canonical) and `/workspace/farmtable-em-verify195` were never touched** —
  not read, not fetched, no ref created. **No `git gc` or `git prune` anywhere.** I did not spend the
  approved `--no-hardlinks` clone: an API tarball at a pinned SHA was strictly safer (§0.2), which
  also sidestepped the risk that canonical did not yet contain `cc92735`.
- **SHA measured: `cc927355e5a23c45bfd983cd331eb540b0a61ad5`. Resolved on the first attempt.**
  Obtained via `gh api …/tarball/<SHA>`, verified against GitHub blob SHAs with a negative control.
- **Contacted the coordinator only.** Not the user, not the eng-manager.
- **Unprompted staleness check performed** (logged per the coordinator's 04:28Z ruling that the 7.10
  trigger counts *whether* legs check, not *whom* they check with).
- **Two brief/standing-rules conflicts reported**; both adjudicated in the brief's favour. Conflict
  (b) — OP-3 carrying the retracted figure as live fact at its point of use — is escalated to the EM
  and **remains open at the time of writing**.
- **Sections written incrementally to disk as completed**, not held in memory.

**Author: flakepop-81. Ends.**
