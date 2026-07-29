# grpcauth-71 — IS THE AUTH INTERCEPTOR ACTUALLY INSTALLED?

**Leg:** grpcauth-71 (security-auditor, source-only, no token)
**Date:** 2026-07-29
**Root:** private clone of `/workspace/farmtable` at `/tmp/ga71`, **SHA 633f8f2**
**Instrument:** `git`, `grep`, `awk`, file reads. **No `go build`, no `go vet`, no `go test` of any kind was run.**
**Path filter:** my clone was made with `git clone --no-checkout --shared` + `git checkout 633f8f2`. It contains **zero** `.claude/worktrees/` directories (verified: `find . -name worktrees | wc -l` → `0`). The quintupling trap in brief §1 does not apply to any count in this report.

---

## 0. PROCESS NOTE — I WAS NEVER SENT MY BRIEF

The first substantive message I received was the **amendment** to a brief I had never seen. I reported "no original brief in my context" rather than reconstructing the task from the correction. The brief arrived on the second message and everything below is measured against it.

## 1. TREE IDENTITY — THE AMENDMENT'S CLAIM, INDEPENDENTLY REPRODUCED

The amendment asked me to confirm and not take its word. I did. **It reproduces exactly.**

```
$ git diff --name-only 7a0f220 633f8f2 -- '*.go' | wc -l
0
$ git diff --name-only 7a0f220 633f8f2 | wc -l          # POSITIVE CONTROL
73
$ git diff --name-only 7a0f220 633f8f2 | sed 's/.*\.//' | sort | uniq -c | sort -rn
     55 ts
     13 md
      3 json
      1 mjs
      1 css
$ git diff --name-only 7a0f220 633f8f2 -- go.mod go.sum '*.proto' | wc -l
0
$ git rev-parse 7a0f220:internal 633f8f2:internal
dded9470508ee18728ed49e3266414b8e45eb47c
dded9470508ee18728ed49e3266414b8e45eb47c
$ git rev-parse 7a0f220:cmd 633f8f2:cmd
4ef548d22dcf685d8929f347d909e65abce31270
4ef548d22dcf685d8929f347d909e65abce31270
```

My own clone's `HEAD:internal` and `HEAD:cmd` hash to the same two values.

**Consequence, stated as the amendment permits:** for Go, `7a0f220` and `633f8f2` are the same tree. Every Go finding below **transfers to production as an identity, not as a second measurement.** The brief's "TWO live trees and they disagree" paragraph is **false for Go** and is annotated as such. The `160e211` correction already in the brief is separately confirmed: it does not resolve in my clone.

## 2. §3 CENSUS RE-RUN — EM'S NUMBERS, VERIFIED SITE BY SITE

Brief §3 handed me a per-site breakdown as a free positive control. I re-ran it. **Every number matches. No bound differed.**

```
$ grep -rn "grpc\.NewServer" --include='*.go' . | wc -l
23      # 4 non-test + 7 testutil + 12 in-package _test.go
```

| Site (SHA 633f8f2) | Interceptor | EM said | Mine |
|---|---|---|---|
| `cmd/farmtable-server/main.go:92` → `:95,:96` unary+stream | PRESENT | PRESENT | ✅ |
| `internal/cli/connect.go:163` → `:166,:167` unary+stream | PRESENT | PRESENT | ✅ |
| **`internal/cli/connect.go:302` → only `:303,:304` MaxRecv/MaxSend** | **ABSENT** | ABSENT | ✅ |
| `internal/cli/dashboard.go:87` → `:90,:91` unary+stream | PRESENT | PRESENT | ✅ |

`internal/testutil/testserver.go` — 7 constructors, read in full (not grep adjacency):

| Line | Constructor | Interceptor |
|---|---|---|
| `:24` | `NewTestServer` | **ABSENT** |
| `:65` | `NewTestServerWithEphemeralPool` | **ABSENT** |
| `:105` | `NewTestServerWithStreaming` | **ABSENT** |
| `:142` | `NewTestServerPostgres` | **ABSENT** |
| `:183` | `NewTestServerWithMultiStore` | **ABSENT** |
| `:218` | `NewTestServerWithAuth` | PRESENT (unary `:221` + stream `:222`) |
| `:259` | `NewTestServerWithAuthAndStreaming` | PRESENT (unary `:262` + stream `:263`) |

**Five of seven install no auth at all.** Confirmed.

## 3. P1 / P2 — BOTH HOLD, AND THERE IS A THIRD

**P1 — FOUND.** `internal/server/auth.go:111-120` @ 633f8f2:

```go
111  func TokenAuthInterceptor(lookup TokenLookup) grpc.UnaryServerInterceptor {
112    return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
113      if lookup == nil {
114        return handler(ctx, req)
115      }
116
117      // Mark that auth enforcement is active so downstream handlers
120      ctx = context.WithValue(ctx, authEnforcedKey, true)
```

The `lookup == nil` return at `:114` is **before** the `authEnforcedKey` set at `:120`. The key is never set. Same shape in the stream interceptor at `auth.go:163-168`.

**P2 — FOUND.** `internal/server/scopes.go:74-78` @ 633f8f2:

```go
74  func RequireScope(ctx context.Context, scope string) error {
75    // If auth is not enforced (open-access mode), allow everything.
76    if ctx.Value(authEnforcedKey) == nil {
77      return nil
78    }
```

**P1 + P2 both hold: a server with no enforced auth does not merely skip the interceptor — every per-handler scope check inside it returns `nil`.**

**THIRD SINK, NOT IN THE BRIEF — FOUND.** `internal/server/scopes.go:100-104` `RequireCollectionAccess` has the identical early return:

```go
100  func RequireCollectionAccess(ctx context.Context, collectionID uuid.UUID) error {
102    if ctx.Value(authEnforcedKey) == nil {
103      return nil
104    }
```

So **collection isolation is vacuous under the same condition as scope checking.** Any certification that covered only `RequireScope` under-counts the blast radius by one whole axis.

**An important distinction the amendment asked me to keep separate, now resolved.** The other leg measured the chain in the `FARMTABLE_OPEN_ACCESS=1` configuration, where `lookup == nil`. The five bare constructors are a *different object*: they install **no interceptor at all**, so nothing ever executes `context.WithValue(authEnforcedKey, ...)`. **Different source, same sink.** They converge at `scopes.go:76` because that line tests for *absence of the key*, not for the presence of an interceptor. The open-access measurement corroborates the mechanism; it does not discharge the census. The census is below.

---

## 4. FALSIFICATION SENTENCE

Brief §7 disclosed the expectation that I would confirm the five constructors make scope assertions vacuous. Stating what would have broken my actual result:

> **THE FINDING WOULD HAVE BEEN FALSIFIED IF** a single test function that builds its server from one of the five no-interceptor constructors had contained any of `PermissionDenied`, `Unauthenticated`, `missing required scope`, `denied`, `forbidden`, or `unauthorized`. **I ran exactly that regex over the 4,022-line corpus of those functions' bodies and got 0. The same regex over the 839-line corpus of auth-enabled test bodies returned 19 — so the query demonstrably fires when the thing is there.** I ran it twice by two independent methods (per-function state machine, then body-corpus extraction) and both returned 0 / non-zero respectively.

**The disclosed expectation is FALSIFIED. There are no vacuous denial assertions, because there are no denial assertions in those tests at all.** I record this as the "true low" the brief said it would rather have — but §6 below is where the real exposure turned out to be.

---

## 5. RESULTS

### Q1 (PRODUCTION) — `internal/cli/connect.go:302` — **FOUND: NOT NETWORK-REACHABLE. GRADE LOW.**

Full call path traced @ 633f8f2:

```
connect.go:120  func newClient(globals *globalFlags)
connect.go:121    if repo := os.Getenv("FARMTABLE_GITHUB_REPO"); repo != "" {
connect.go:122      return startGitHubPassThrough(repo)
connect.go:275  func startGitHubPassThrough(repo string) (pb.FarmTableServiceClient, io.Closer, error)
connect.go:301    lis := bufconn.Listen(1 << 20)
connect.go:302    srv := grpc.NewServer(  :303 MaxRecvMsgSize  :304 MaxSendMsgSize )   <-- NO INTERCEPTOR
connect.go:307    go srv.Serve(lis)
connect.go:309    conn, err := grpc.NewClient("passthrough:///bufconn",
connect.go:310      grpc.WithContextDialer(... return lis.DialContext(ctx) ))
```

```
$ grep -rn "startGitHubPassThrough(" --include='*.go' . | grep -v "func "
internal/cli/connect.go:122:		return startGitHubPassThrough(repo)     # sole caller

$ grep -n "net.Listen\|bufconn.Listen" internal/cli/connect.go
162:	lis := bufconn.Listen(1 << 20)
301:	lis := bufconn.Listen(1 << 20)
                                        # no net.Listen in this file at all

$ grep -rn "net\.Listen(" --include='*.go' . | grep -v _test.go | head -1   # POSITIVE CONTROL
internal/cli/dashboard.go:125:	lis, err := net.Listen("tcp", listenAddr)
```

**The server at `:302` binds no socket.** Its only listener is an in-process `bufconn`; its only client is dialed through `WithContextDialer` into that same `bufconn`. It is constructed inside the CLI's own client factory, opt-in via `FARMTABLE_GITHUB_REPO`, and the process that runs it *is* the caller. **There is no caller who is not the local operator.**

Further, the absence is **defensible by design here**: this is a GitHub pass-through shim (`github.NewPassThroughStore` at `:299`) whose authority is the operator's own `GITHUB_TOKEN`, required at `:282-285`. There is no local token store to check against.

**This independently corroborates the other leg's LOW grade — and it is a genuinely second measurement, not the same one in another coat.** That leg and the EM both read the *option list*; I traced the *caller chain* and took a *listener census* with a positive control. Different queries, same conclusion. **I could not falsify either half.**

**No rows of the 30-of-33 table are invalidated by Q1.** Concur.

*Minor inconsistency, informational:* `connect.go:163` (`startEmbedded`) is **also** bufconn-only yet **does** install both interceptors. The codebase is inconsistent between its two embedded servers — in the safe direction at `:163`, so no finding, but the asymmetry is what makes `:302` read alarming at a glance.

### Q2 (THE HARNESS) — **MEASURED-ABSENT. THIS IS THE HEADLINE AND IT IS A NEGATIVE.**

Call-site census (definitions excluded; `NewTestServer(` cannot match `NewTestServerWithAuth(` — verified, prefix-collision control returned 0):

| Constructor | Interceptor | Call sites |
|---|---|---|
| `NewTestServer` | ABSENT | 46 |
| `NewTestServerWithStreaming` | ABSENT | 13 |
| `NewTestServerPostgres` | ABSENT | 9 |
| `NewTestServerWithEphemeralPool` | ABSENT | 8 |
| `NewTestServerWithMultiStore` | ABSENT | 3 |
| **subtotal, no interceptor** | | **79** |
| `NewTestServerWithAuth` | PRESENT | 17 |
| `NewTestServerWithAuthAndStreaming` | PRESENT | 2 |

Classified by enclosing function across all `*_test.go`:

```
     74 BARE-ONLY / TEST     (build only from no-interceptor constructors)
     17 AUTH      / TEST
      2 AUTH      / HELPER
      0 MIXED                (no function mixes the two)
      0 BARE      / HELPER   (no helper indirectly reaches a bare constructor)
```

**Do any of them assert that something is DENIED? No. Zero. Of 74 test functions and 79 call sites.**

```
# broad regex: PermissionDenied|Unauthenticated|missing required scope|denied|forbidden|unauthorized
BARE corpus (4022 lines) : 0
AUTH corpus  (839 lines) : 19      <-- POSITIVE CONTROL, query fires
```

Confirmed twice by independent methods (per-function state machine → 0; body-corpus extraction → 0).

**Interpretation.** The inverted-vacuity case the brief was hunting **does not exist in this codebase.** The separation is clean and looks deliberate: **every denial-asserting test uses an auth-enabled constructor.** All 8 denial-asserting tests live in `internal/server/rbac_test.go` (5), `identity_test.go`, `identity_enforcement_test.go`, `lifecycle_evidence_test.go` — all AUTH class.

**No green in this suite means nothing because of a missing interceptor. The EM's expectation was wrong, and it was wrong in the project's favour.**

### Q3 (POLARITY) — **FOUND. 17 OF 29 SCOPE CHECKS HAVE NO AUTH-SIDE COVERAGE.**

This is where the exposure actually is.

```
$ grep -rn "RequireScope(" internal/server/*.go | grep -v _test.go | grep -v "func RequireScope" | wc -l
32          # 32 call sites across 29 distinct handlers
$ grep -c "  rpc " proto/farmtable.proto
33
```

Reconciling the prior leg's "30 of 33": 29 handlers carry a `RequireScope` guard; the 4 without are `GetVersion` and `GetStatus` (**intentionally exempt**, `auth.go:104-105`), `WatchTasks` (stream-side), and `WhoAmI`. 29 + `WatchTasks` = the certified 30.

Of those 29 guarded handlers, how many are ever invoked against a server whose interceptor is installed — i.e. where the guard *can* return non-nil?

```
COVERED by an auth-enabled test : 12 / 29
NOT covered                     : 17 / 29
```

**Covered (12):** `AddComment`, `ClaimTask`, `CloseTask`, `CreateCollection`, `CreateTask`, `GetCollection`, `GetTask`, `GetUser`, `ImportCollection`, `ListCollections`, `ListUsers`, `UpdateTask`

**NOT covered (17):** `CreateLinkedAccount`, `DeleteLinkedAccount`, `DeleteTask`, `ExportCollection`, `GetBlockedTasks`, `GetBottlenecks`, `GetComment`, `GetCriticalPath`, `GetDependencyTree`, `GetLinkedAccount`, `GetReadyTasks`, `InsertTasksAfter`, `ListChanges`, `ListComments`, `ListLinkedAccounts`, `ListTasks`, `UpdateCollection`

Spot-check control — `ListTasks` (claimed uncovered) vs `GetTask` (claimed covered):
```
auth corpus .ListTasks( : 0     bare corpus .ListTasks( : 13
auth corpus .GetTask(   : 7
```

**Meaning.** For these 17 handlers, the `RequireScope` guard **has only ever executed down the `authEnforcedKey == nil` early-return path at `scopes.go:76` in the entire test suite.** Their scope checks are certified by inspection and exercised only in the allow direction. Nothing asserts they are vacuous — and nothing would notice if they became so. `DeleteTask`, `UpdateCollection`, `DeleteLinkedAccount` and `ExportCollection` are the ones I would care about: destructive or data-egress RPCs whose scope guard has no negative test anywhere.

**This is the answer to the brief's real worry, relocated.** The 30 rows are not vacuous *today* — production installs the interceptor at all three reachable servers (§2). But **17 of them rest on inspection alone**, and the regression that removes a guard is invisible to this suite.

### Q4 (HISTORY) — **FOUND: "NEVER PRESENT", NOT "REMOVED". ALL SIX SITES.**

```
$ git log -p --follow -- internal/testutil/testserver.go | grep -E "^-.*(UnaryInterceptor|StreamInterceptor)" | wc -l
0
$ git log -p --follow -- internal/testutil/testserver.go | grep -E "^\+.*(Unary|Stream)Interceptor" | wc -l
4       # POSITIVE CONTROL

$ git log -p --follow -- internal/cli/connect.go | grep -E "^-.*(UnaryInterceptor|StreamInterceptor)" | wc -l
0
$ git log -p --follow -- internal/cli/connect.go | grep -E "^\+.*(Unary|Stream)Interceptor" | wc -l
2       # POSITIVE CONTROL
```

**Not one interceptor line has ever been deleted from either file.** Every appearance is an addition, and each arrived with a *purpose-built auth constructor* rather than being retrofitted to an existing one:

- `6207596` "Add agent identity (C2)" — **added** `NewTestServerWithAuth` *as a new function* carrying `grpc.UnaryInterceptor(...)`.
- `3074952` "feat(auth): enforce identity-aware access control on mutating RPCs" — **added** `NewTestServerWithAuthAndStreaming` *as a new function*, plus the stream interceptor on `NewTestServerWithAuth`.

The five bare constructors predate or sit alongside these and were simply never given one. `connect.go:302`'s server entered in `05beb70` ("Add GitHub pass-through store") already without an interceptor.

**This is the benign history.** No one turned auth off. The pattern is additive: when auth was needed in tests, a *new* constructor was written next to the old ones. That is also precisely why 79 call sites still sit on the auth-free path — nothing ever migrated them, and nothing had to.

---

## 6. SUMMARY

| # | Question | Outcome |
|---|---|---|
| Q1 | `connect.go:302` reachable by a non-operator? | **FOUND — NO.** in-process bufconn, no socket, sole caller is the CLI's own factory. **LOW.** Independently corroborates the other leg. |
| Q2 | Denial assertions inside no-interceptor servers? | **MEASURED-ABSENT — 0 of 74 functions / 79 call sites.** Expectation falsified. |
| Q3 | Certified checks that run only under no-interceptor servers? | **FOUND — 17 of 29** have zero auth-side coverage. |
| Q4 | Removed, or never present? | **FOUND — NEVER PRESENT**, all six sites, 0 deletions in full history. |
| P1 | `auth.go:113` short-circuits before `authEnforcedKey` | **FOUND** |
| P2 | `scopes.go:76` allows when key unset | **FOUND** |
| +  | `scopes.go:102` `RequireCollectionAccess` — same sink | **FOUND, not in brief** |

**Severity: the thing the brief feared is not live. The thing next to it is a real gap.**

- **No production server is missing its interceptor.** The three reachable ones (`main.go:92`, `connect.go:163`, `dashboard.go:87`) all install unary + stream. The fourth (`connect.go:302`) is unreachable and defensibly exempt. **The 30-of-33 table stands.**
- **[LOW]** `connect.go:302` — no interceptor, not network-reachable. Design-appropriate; worth a comment, not a fix.
- **[MEDIUM]** **Q3: 17 of 29 scope guards have no negative test under an auth-enabled server.** Not exploitable today. It is the *regression surface*: delete any of those 17 `RequireScope` lines and the suite stays green.
- **[MEDIUM, new]** `RequireCollectionAccess` (`scopes.go:100-104`) shares the `authEnforcedKey == nil` early return. Collection isolation has the same property as scope checking and was outside the certification's scope entirely.

## 7. RECOMMENDATIONS

1. **Close the Q3 gap where it is cheapest.** `rbac_test.go` already has the pattern (`NewTestServerWithAuth` + a scoped token + assert `codes.PermissionDenied`). Extend the existing `TestEvidence_Stage4ScopeMatrix` in `lifecycle_evidence_test.go` to table-drive all 29 guarded handlers rather than adding 17 hand-written tests. Prioritise `DeleteTask`, `UpdateCollection`, `DeleteLinkedAccount`, `ExportCollection`.
2. **Add a negative test for `RequireCollectionAccess`** alongside it — same sink, currently uncertified.
3. **Consider making the vacuous path loud in tests.** The root cause of the whole class is that `authEnforcedKey == nil` means "allow" and is indistinguishable from "misconfigured". A `testing`-only guard that fails when a scope check is reached with no enforcement would convert every future instance of this from silent to red. *(Design note, not a security fix — and explicitly **not** a suggestion to change the production default, which is deliberate for open-access mode.)*
4. **Comment `connect.go:302`** stating the interceptor is intentionally absent because authority is the operator's `GITHUB_TOKEN`. It cost this leg real time to establish that, and it will cost the next one the same.

## 8. WHAT I DID NOT MEASURE

- **UNMEASURED: runtime behaviour of anything.** No `go test`, `go build`, or `go vet` was run, per §0 of the brief. Every claim is source-derived. Whether the 17 uncovered handlers *would* deny correctly if tested is **not established** — I show only that nothing tests them.
- **UNMEASURED: the stream-side scope story.** I traced `TokenAuthStreamInterceptor` far enough to confirm P1's shape at `auth.go:163-168`; I did not census stream-handler scope checks the way I did unary.
- **UNMEASURED: whether the prior leg's "30 of 33" rows map 1:1 to my 29 handlers.** I reconciled the *count* (29 + `WatchTasks`), not the *membership*. If that table names a specific 30, someone should diff it against my list in §Q3.
- **Q1 residual:** I proved no listening socket in `connect.go`. I did not exhaustively prove no other code path constructs a `startGitHubPassThrough` client and re-exports it over a network boundary; the sole-caller grep is my evidence and it is one grep.

## 9. FLAG FOR THE EM — A CONFLICT I DID NOT RESOLVE SILENTLY

Brief §8.2 instructs me to write a project log entry in `.design/project-log/`. The later dispatch message instructs: *"It is SHARED and READ-ONLY to you: DO NOT WRITE IN IT, DO NOT CREATE FILES IN IT."* `.design/project-log/` lives inside `/workspace/farmtable`.

**I followed the later, more explicit instruction and did not write to the canonical tree.** The log entry is staged next to this report at `reports/grpcauth-71-project-log-entry.md`, formatted to the existing `task-state-*.md` convention (84 files in that directory), ready to land at `.design/project-log/task-state-grpcauth-71.md` by anyone holding write access. Tell me if you want it placed differently.
