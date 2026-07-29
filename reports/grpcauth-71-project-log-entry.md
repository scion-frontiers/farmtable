# task-state-grpcauth-71

**STAGED, NOT LANDED.** Intended destination `.design/project-log/task-state-grpcauth-71.md`.
Held outside the canonical tree because grpcauth-71 was instructed that `/workspace/farmtable` is
read-only to it. See §9 of `reports/grpcauth-71.md`.

## Task
Determine whether `TokenAuthInterceptor` is actually installed on the gRPC servers that serve the
30-of-33 scope-checked RPCs — the unstated precondition of that certification.

## Status
COMPLETE. Source-only audit at SHA `633f8f2`. No build, vet, or test executed. No production code changed.

## Outcome
**The certification holds. The feared failure is not live.** All three network-reachable servers
(`cmd/farmtable-server/main.go:92`, `internal/cli/connect.go:163`, `internal/cli/dashboard.go:87`)
install both unary and stream interceptors. The fourth site, `internal/cli/connect.go:302`, has no
interceptor but is an in-process `bufconn` inside the CLI's own client factory with no listening
socket and no caller other than the local operator — graded LOW, design-appropriate.

**Two premises confirmed, one bonus sink found.** `auth.go:113` returns before `authEnforcedKey` is
set at `:120`; `scopes.go:76` allows when that key is unset. `RequireCollectionAccess`
(`scopes.go:100-104`) shares the identical early return and was outside the original certification.

**The expected finding was falsified.** Of 74 test functions built from the five no-interceptor
`testutil` constructors (79 call sites), **zero** assert a denial — verified by two independent
methods with a positive control returning 19 hits on the auth-enabled corpus. Denial tests and
auth-enabled constructors are cleanly separated in this codebase, apparently deliberately.

**The real gap sits next door.** 17 of 29 scope-guarded handlers are never invoked under an
auth-enabled server, so their `RequireScope` guard has only ever taken the allow path in the whole
suite. Not exploitable; it is a regression surface. Deleting any of those 17 guards leaves the
suite green. `DeleteTask`, `UpdateCollection`, `DeleteLinkedAccount`, `ExportCollection` are the
ones worth caring about.

**History is benign.** Zero interceptor deletions across the full history of both files (positive
controls: 4 and 2 additions respectively). Auth was never turned off — new auth-carrying
constructors were added beside the old ones, and the 79 existing call sites were never migrated.

## Method note worth keeping
Two queries in this leg returned a clean-looking `0` that was actually a **broken query** — once
from a missing `gawk`, once from a greedy name-extraction regex that reduced `func TestFoo(t
*testing.T) {` to `{`. Both were caught only by the mandated positive control. The rule earned its
keep twice in one leg.

## Process defect (EM-owned, recorded at EM's request)
The brief was written to disk but its path was never sent. The first message this leg received was
an *amendment* to a document it had never seen. An amendment reads as coherent context — it names a
SHA, corrects a premise, and sounds like the tail of a conversation. The leg reported the brief
missing rather than reconstructing the task from the correction.
**A dispatch is complete when the leg has the path, not when the brief is written.**

## Follow-ups proposed
1. Table-drive `TestEvidence_Stage4ScopeMatrix` over all 29 guarded handlers instead of 17 new tests.
2. Add a negative test for `RequireCollectionAccess`.
3. Consider a test-only guard that fails when a scope check is reached with enforcement absent.
4. Comment `connect.go:302` explaining the intentional absence.
