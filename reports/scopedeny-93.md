# scopedeny-93 — an empty or unrecognised permission set must never be permission for everything

Author: scopedeny-93 (developer)
Date: 2026-07-29
Status: patch complete on branch `scopedeny-93-deny-unrecognised-type` at `89973f8`,
**not merged, not pushed**. `internal/server` green (12 deterministic failures → 0).
`internal/cli` **type-checks and its tests pass (13/0)** — but that result stands on a
placeholder asset directory and is a **type-check, not a build** (§3B.1). No shipped-binary
claim is made anywhere in this report.

**Read §0A before quoting anything from §0.** The claim this patch earns is narrow, and §0 is
written in a register that will otherwise be over-read.

---

## 0. The finding that outranks the fix

**The defect did not survive the test suite. It was load-bearing for it.**

Empty-means-wildcard was not one bug with a handful of witnesses. It was **ambient** — it had
quietly become the default way this test suite authenticates. Three independent discoveries,
all the same mechanism:

1. **A green test asserted the vulnerability was intended.**
   `TestScopedToken_ExistingTokenNilScopesIsWildcard` minted a scope-less token, called two
   scoped RPCs, and required both to succeed. Anyone who wondered about nil scopes found a
   named, passing test telling them it was deliberate.
2. **The guard against this fix's failure mode was woven from the defect.**
   `TestScopedToken_WildcardAllowsEverything` minted with `nil` scopes, so despite its name it
   never exercised a wildcard — it exercised the escalation, and would have kept passing if the
   wildcard match were deleted outright. N11 protected the bug loudly; this one would have
   **misreported the cure as safe**, which is worse, because it congratulates you.
3. **Twelve further tests depended on it without ever mentioning scopes.** Every one is about
   auth propagation or actor recording. None tests scope behaviour. They *inherited* it.

**This is why four audits went past it.** Removing the defect breaks things — and "removing it
breaks things" reads as evidence that it is a feature.

### The method result — and it supersedes the one I proposed first

I enumerated the producer side three times and **found a new writer each time**: struct
literals with the field set empty; then literals with the field *omitted* (§5B); then
`TokenLookupResult`, a second type entirely, reachable by a fake with no database at all
(§5B.1). Each enumeration was sound against the previous miss and blind to the next.

> **THE PRODUCER SIDE IS OPEN. YOU CANNOT CLOSE IT BY ENUMERATING HARDER.**

There is also a diagnostic here, and it is the part worth carrying forward, because the signal
was available on the *first* miss and I read it as bad luck twice more:

> **AN OPEN SET DOES NOT ANNOUNCE ITSELF BY RUNNING OUT. IT ANNOUNCES ITSELF BY YIELDING ONE NEW
> MEMBER PER ATTEMPT — AND THAT PATTERN IS THE SIGNAL TO STOP ENUMERATING AND FIND THE DOOR.**

Three sweeps, three new members, each sweep sound against the last miss. A closed set gets
*harder* to extend; mine got easier. I treated a constant yield rate as evidence I was being
thorough when it was evidence the set had no boundary.

The closing argument is one I had already made in another context and failed to notice
transfers. The **consumer** side is closed. The load-bearing reason is a visibility fact, not a
census:

> **`scopesKey` IS AN UNEXPORTED CONST OF AN UNEXPORTED TYPE** (`internal/server/auth.go:18`,
> `scopes.go`). Nothing outside `internal/server` can install a scope set into a context at all
> — not by accident, not by a writer type I have not imagined, not by a future package. The
> compiler enforces this, and it stays true until someone deliberately changes a keyword.

I put that first on purpose. The call-site census below is true today and quietly false after
any refactor; the visibility fact defends itself. **Put the claim that defends itself first.**

With that established, the census is corroboration rather than foundation:

```
non-test writers of the context value (ContextWithScopes):  auth.go:155, auth.go:204
non-test readers (ScopesFromContext):                        one — RequireScope
sites where an empty set becomes authority:                  exactly one — scopes.go:106
```

Two doors in, one door out, and the door out now denies *because this patch made it deny*. So:

> **THE PLACES AN EMPTY SET CAN BE CREATED ARE OPEN. THE PLACE IT BECOMES AUTHORITY IS CLOSED.
> ENUMERATE AT THE CHOKEPOINT, NOT AT THE SOURCE.**

That upgrades the claim from *"I enumerated the producers I could find"* to **"however many
producers exist, and whether or not I found them, every one must pass through a door that
denies"** — which also covers the fourth writer type I have not yet imagined. And it explains
*why* the constructor rule kept needing patches: it was an enumeration over an open set dressed
up as a structural argument.

The earlier rule survives, demoted to a warning about a technique that should never have been
load-bearing:

> **A structural sweep on a constructor is still a vocabulary sweep if the constructor can be
> elided. ABSENCE HAS NO TOKEN TO GREP FOR** — you cannot search for a field that is not there,
> only for the container, and then test what it lacks. **The only closed enumeration is the one
> the compiler or the runtime performs**, which is why the first real run found what every grep
> could not.

---

## 0A. The exact size of the claim — read this before quoting anything above

The chokepoint argument is strong, and that is precisely why it needs a fence around it. Stated
as narrowly as the evidence supports:

> **PROVED: EVERY EMPTY SCOPE SET THAT IS CONSULTED IS DENIED.**
>
> **NOT ESTABLISHED: THAT THE DOOR IS ON EVERY PATH.**

`RequireScope` is a door that now denies. Whether every RPC walks through it is a *different
question with a different method*, and this patch did not ask it. I verified the door; I did not
verify the walls. An RPC that never calls `RequireScope` is unaffected by everything in this
report — correctly so in the case of `WhoAmI` (§2), and I have not enumerated the cases where it
would be incorrect.

So, plainly:

> **THIS FIX DOES NOT MAKE AUTHORIZATION SOUND. IT CLOSES THE EMPTY-SET ESCALATION.**

Those are not the same sentence and the difference is not pedantic. "Empty means wildcard" is
fixed. "Is authorization correct" is untouched, unmeasured, and must not be inferred from the
fact that this section sits next to a strong-sounding result. The adjacent question is filed in
§7 with a falsifier, and as of 03:37Z it has its own owner — a separate source-only auditor
briefed by the coordinator. It is not answered here and nothing in this document should be read
as answering it.

---

## 0B. A finding unrelated to this fix, filed here because it invalidates how it was measured

This is not placeholder justification and it is not context. It is a defect in the fleet's
measurement apparatus, found incidentally while discharging §7 item 1a, and it outranks the
section it came out of.

> **CANONICAL `/workspace/farmtable` CONTAINS A POPULATED `web/dist` — `favicon.svg`,
> `index.html`, `assets/`, `shoelace/` — DATED `Jul 27 16:54`, UNTRACKED AND GITIGNORED
> (`.gitignore:17`, `dist/`). IT IS A LEFTOVER npm BUILD ARTEFACT.**
>
> **THEREFORE `go build ./...` SUCCEEDS IN CANONICAL AND FAILS IN EVERY FRESH CLONE, AND THE
> DIFFERENCE IS AN UNTRACKED DIRECTORY THAT `git status` CANNOT SHOW YOU.**

Three consequences, the third being the one that generalises:

1. **Independently corroborated, from the opposite end.** `ci-22-setup` hit the fresh-clone
   failure on a cold GitHub runner the same night. It saw the failure on a machine with no
   artefact; I found the artefact on the machine that does not fail. Two legs, two machines, no
   channel between them.
2. **It is retroactive.** Every build, vet and test any leg has run *in canonical* was standing on
   that directory. Those greens are not false — **they are true of a machine that exists nowhere
   else.** My own §3A `go build ./...` failure was correct precisely *because* I worked in a clone.
3. **The tool we check reproducibility with is configured to hide this.** That is what makes it
   worse than an unstated SHA, glob, cwd or path:

> **A CLEAN `git status` READS AS "MY TREE IS REPRODUCIBLE" AND MEANS "MY TREE HAS NO TRACKED
> CHANGES." THE CLAIM IT DOES NOT MAKE IS THE ONE EVERYBODY WANTS.**

I reported `git status --short` as empty twice in this document as evidence my placeholder was
contained. That was true and it was **not** evidence of reproducibility, and I am flagging my own
usage rather than leaving the reader to notice.

**Not fixed here** — it belongs to the CI/`web/dist` owner, and this leg does not touch it. Also
recorded in §3B.1 is the thing I declined to do: canonical's real `dist` was sitting one directory
away and copying it would have produced a prettier green than my placeholder did. **A green built
on another agent's two-day-old local state would have meant less than the placeholder's, not
more** — it would have been this very finding, committed on purpose.

---

## 1. Commits

| | |
|---|---|
| Canonical base | `633f8f269bcf9225b62d3c7c119f8166eda9ae64` (`/workspace/farmtable`, branch `task-state-web-ui-v2`) |
| Working clone | `/workspace/farmtable-scopedeny-93` (`git clone --no-hardlinks`; canonical never written to) |
| Branch | `scopedeny-93-deny-unrecognised-type` |
| Branch head | `89973f89ce2e092cbfb2be3114bc13c494368345` |

```
89973f8 test(server): give fixtures the scopes their callers actually hold
160e211 test(server): invert the tests that certified empty-scopes-as-wildcard
e786341 fix(cli): reject an unrecognised user type at user creation
67dfe66 test(server): adapt call sites to the DefaultScopesForUserType signature
475d4de docs(cli): correct the scope-merge guard rails' stated reasons
5a9cc6f fix(cli): state the local and dashboard tokens' grant explicitly
1a1566d fix(cli,serverapp): refuse to mint a token for an unrecognised user type
0ee34d8 fix(server): an empty scope set grants nothing, never everything
```

No `git gc`, no `git prune`, anywhere. `/workspace/farmtable-em-verify195` untouched.
One temporary worktree (`/tmp/sd93-baseline`) was created for the baseline measurement
and removed with `git worktree remove` — exit 0, no prune involved.

---

## 2. The two senses — established BEFORE anything was changed

The brief's trap: an empty scope list may mean *"this principal HOLDS no scopes"* or
*"this endpoint REQUIRES no scopes."* If one type carries both senses, separating them
is the fix. **Finding: for scopes the two senses share no representation, so inverting
the empty case is safe. The conflation exists one axis over, in collection IDs, and
there the current behaviour is correct.**

### Sense 1 — "the principal HOLDS these scopes" (a GRANT list)

Carried by `[]string` in the request context.

- `internal/server/auth.go:18` — `type contextKey string`, **unexported**.
- `internal/server/scopes.go:45` — `const scopesKey contextKey = "token_scopes"`, **unexported const of an unexported type**.
- `internal/server/auth.go:155` (unary) and `auth.go:204` (stream) — the only writers:
  `ctx = ContextWithScopes(ctx, result.Scopes)`.
- `internal/server/scopes.go:57` — `ScopesFromContext`, the only reader.

For a GRANT list, empty means **nothing is granted**. That is the sense the storage
layer and the interceptors actually produce, and it was being read as its own opposite.

### Sense 2 — "this endpoint REQUIRES no scopes"

**Never expressed as an empty list.** It has two entirely separate representations:

- Not calling `RequireScope` at all. The function's signature is
  `RequireScope(ctx context.Context, scope string) error` — `scopes.go:93`. It takes a
  single string, never a list. There is no way to pass it "requires nothing"; you
  express that by not invoking it.
- `internal/server/auth.go:100-109` — `isUnauthenticatedEndpoint(fullMethod string) bool`,
  a switch over gRPC **method names**, consulted at `auth.go:122` and `auth.go:171`
  before any scope is read. Endpoints that require nothing bypass the whole path.

**Consequence:** denying on an empty held-set cannot break an endpoint that legitimately
requires nothing, because such an endpoint never reaches the check. The senses were
never conflated for scopes; the bug was simply that the GRANT list was read with the
polarity of a RESTRICTION list.

### This was argued, and then the run measured it — a controlled experiment in one file

The `160e211` suite run (§3A) contains an unplanned natural experiment. Two tests in
`internal/server/identity_test.go`, using the **same scope-less token fixture**:

| Test | RPC | Requires a scope? | Result |
|---|---|---|---|
| `TestWhoAmI` | `WhoAmI` — `server.go:1348`, authenticates via `UserIDFromContext`, **never calls `RequireScope`** | No | **PASS** |
| `TestListUsers` | `ListUsers` — `server.go:1360`, `RequireScope(ctx, ScopeUserRead)` | Yes | **FAIL — denied** |

Twenty lines apart in the same source file, same fixture, opposite outcomes. **"Requires
nothing" and "holds nothing" are demonstrably separate at runtime, not merely by my reading of
the signatures.** An endpoint that legitimately requires no scopes was untouched by a change
that denies every principal holding none.

The whole `internal/store` package tells the same story from the other end: it mints five
scope-less tokens and **passed entirely**, because no authorization decision occurs there.
Storage of an empty grant list is unaffected; only *reading it as permission* changed.

### The same shape, one axis over — where empty *is* correctly permissive

`CollectionIDs` **is** a RESTRICTION list, and there empty correctly means
"unrestricted": `scopes.go:157`, `if len(allowed) == 0 { return nil }`.

This is not the same bug and must not be "fixed" by analogy. Two supporting facts:

1. Nothing derives `CollectionIDs` from the user type — the unrecognised-type escalation
   cannot reach a wildcard through it.
2. Its empty state is a genuine and common operator intent ("this token is not scoped to
   particular collections"), whereas an empty scope set is never an intent, only a defect.

I recorded this asymmetry **in the code** (`scopes.go:144-149`), because the next person
to read these two functions side by side will otherwise "fix" the wrong one:

> Deliberately NOT symmetric with RequireScope. CollectionIDs is a RESTRICTION list,
> where empty correctly means "unrestricted"; scopes are a GRANT list, where empty
> correctly means "nothing". The two look alike and mean opposite things, so do not
> "fix" this one by analogy with the other.

---

## 3. Measurement: the behaviour before and after (N11)

Run under a build token granted by the eng-manager, scoped to this one question.
`TestScopedToken_ExistingTokenNilScopesIsWildcard` **is** N11 verbatim — it mints a real
token with a nil scope list, stands up a real auth-enforcing server via
`testutil.NewTestServerWithAuth`, and calls two scoped RPCs. No new code was needed.

Command, identical on both commits; exit captured immediately after the command with
nothing in between (an intervening `echo` clobbers `$?` to 0 and fails open):

```
go test ./internal/server/ -run '^TestScopedToken_ExistingTokenNilScopesIsWildcard$' -v -count=1 > OUT 2>&1; rc=$?
```

**Run A — canonical `633f8f2`, pristine detached worktree. `RUN_A_EXIT=0`**

```
--- PASS: TestScopedToken_ExistingTokenNilScopesIsWildcard (0.01s)
ok  	github.com/farmtable-io/farmtable/internal/server	0.015s
```

**Run B — branch `e786341`. `RUN_B_EXIT=1`**

```
2026/07/29 03:06:25 SECURITY: empty scope set denied — user=234a8257-a45d-4015-b849-86d81330e17d
required_scope="collection:read". This token grants nothing. Inspect the account's user type
with `ft user get 234a8257-...`; if the type is not one of [admin, agent, human, orchestrator,
reviewer, service_account, viewer] it is unrecognised, which is the bug. Re-issue the token
with explicit scopes.
    rbac_test.go:265: nil-scoped token should act as wildcard: rpc error: code = PermissionDenied
    desc = token holds no scopes; "collection:read" denied. An empty scope set grants nothing.
    Check the account's user type and re-issue the token with explicit scopes
--- FAIL: TestScopedToken_ExistingTokenNilScopesIsWildcard (0.01s)
```

Both runs are reported as commands and observed values. The escalation was live on
canonical; it is closed on the branch; and the denial carries the account UUID, the
scope, and the recognised vocabulary — the discoverability the ruling requires.

---

## 3A. Build and full suite at `160e211`

Second token grant. Build reported as its own line, before any interpretation, because a
green suite over a branch that did not compile means nothing.

**`go build ./...` → `BUILD_EXIT=1`.** Sole error, and the entire output:

```
assets.go:5:12: pattern all:web/dist: no matching files found
```

The pre-registered `web/dist` absence. **No compile error anywhere in this change.**

**The build does not by itself discharge the stop condition,** and that needs saying plainly:
`go build` does not compile `_test.go` files, so the never-compiled `strings` import in
`rbac_test.go` was outside its reach either way. What discharges it is that `go test`
compiled *and ran* `internal/server` — 0.817s of real execution producing named assertion
failures, not `[setup failed]`. The test binary therefore did compile. Green-over-uncompiled
is excluded by the *run*, not by the build.

**`go test ./...` → `TEST_EXIT=1`.**

| Result | Packages |
|---|---|
| `[setup failed]`, `web/dist`, unrelated | root, `cmd/farmtable-server`, `cmd/ft`, **`internal/cli`** |
| **PASS** | `decomposer`, `mcp`, `platform/beads`, `platform/github`, `serverapp`, `store`, `streaming` |
| **FAIL** | `internal/server` — 12 failures, all over-denial (§5B) |

Two things this run establishes that no argument could:

1. **`internal/cli` was not tested at all.** The `web/dist` embed takes the whole package
   down, so the `token.go` and `user.go` changes (§5.2, §5.5) are **entirely unmeasured**.
   This is now the largest unverified area of the patch.
2. No `TestWatchTasks_*` failure occurred, so the pre-registered ~4.5% flake never arose and
   there was no re-run to perform. The 12 failures are deterministic, not flake.

---

## 3B. After the fixture repair — `89973f8`

Commands logged to `reports/_run-queue-log.md` **before** each was run, per §6.1(c).

**`go test ./internal/server/ -count=1`, run twice: deterministic failures 12 → 0.**

Each run had exactly one failure and it was a **different `TestWatchTasks_*` each time**
(`ClaimEvent`, then `Heartbeat`) on code that only became more correct in between. Re-run alone
at `-count=5` as pre-committed: **`Heartbeat` 5/5 PASS, `ClaimEvent` 5/5 PASS.**

> **I MADE A JUDGEMENT CALL THERE AND IT SHOULD BE VISIBLE AS ONE, BECAUSE "IT WAS THE KNOWN
> FLAKE" IS ALSO EXACTLY WHAT A REAL REGRESSION SOUNDS LIKE.** I had every incentive to reach for
> the flake explanation: it was pre-registered, it arrived while my own change was under
> suspicion, and it let me keep a green result. The thing that actually separates the two stories
> is narrow, and it is the only reason the call is defensible:
>
> 1. **The 5/5-alone re-run.** A regression from my edits would not pass 5 consecutive isolated
>    runs. This is the load-bearing evidence and nothing else in the list would carry it alone.
> 2. **A different member failed each run**, on code that strictly improved in between. A
>    regression is stable under a fixed input; this was not.
> 3. **Neither test touches anything I changed** — no scope-less mint in `watch_test.go`, and both
>    pass inside the same package run that exercises my edits.
>
> If any one of those had come out otherwise I would be reporting a regression. Recording the
> reasoning rather than the conclusion, because a future reader inherits the conclusion for free
> and the reasoning is what tells them whether to trust it.

**This also turned out to be independently corroborated, which I did not know when I made the
call.** `ci-22-setup` saw `TestWatchTasks_NoInitial` fail cold and pass warm on a GitHub runner,
with no communication path to me. Two machines, two legs, same test family — and the detail that
**a *different member* fails each time means this is a flaky family, not a flaky test.** Filed as
an observation; not chased here, and it does not change this fix.

**The 15 named tests, with anti-vacuity counting: 15 requested, 15 `--- PASS:`, 0 `--- FAIL:`.**
Requested count equals observed count, so the silent-drop mode — `-run` matching nothing and
printing `ok` at exit 0 — did not occur. The exit code is not the evidence and is not offered as
such. This set includes the mandatory over-denial controls of §8.2.

**`go build ./internal/cli/` → exit 1, sole error `assets.go:5:12: pattern all:web/dist: no
matching files found`.** Reading the text rather than the code (§6.4): the embed aborts loading
of the **root** package (`./assets.go` — corrected in §3B.1; I first wrote `internal/assets`,
inferring a path from a bare filename), which `internal/cli` imports, so **`internal/cli` is
never type-checked at all.** This is not a clean result, it is *no* result. Four changed files
there have zero compile evidence **as of this section** — see **§3B.1, which supersedes this
paragraph**: the blocker was subsequently discharged as a type-check.

Weaker substitutes actually performed, offered as what they are and not as a type-check:
`gofmt -e` parses all four clean (PRE=0/POST=0 against the `633f8f2` pre-image), and every
changed call was checked by hand against its callee's real signature — `exitError(int, string,
string)`, `DefaultScopesForUserType(string) ([]string, error)`, `ValidateUserType(string) error`,
`KnownUserTypes() []string`. Imports verified present; `user.go` is the only file where the
`internal/server` import is new, and `internal/server` imports `internal/cli` **zero** times, so
there is no cycle. **Syntax and signatures are not a type-check and I am not claiming they are.**

The gofmt gate was armed before being trusted, per §1.1: a deliberately malformed file was fed
to it and it returned **1**.

### 3B.1 `internal/cli` — TYPE-CHECKED, and the word is chosen

The coordinator relayed a route past the embed and marked it DERIVED. **I verified all three
parts before creating anything**, and one of them corrected me:

- The embed lives at **`./assets.go`, the repo ROOT** — not `internal/assets/assets.go`, which is
  what §7 item 1a and my earlier notes said. `go:embed` resolves relative to the containing
  directory, so the path matters. **I had inferred that path from a bare filename in an error
  message and written it down as if measured.** Corrected everywhere it appears.
- `web/` exists; `web/dist` does not. The embed fails on an **absent directory**, not on bad
  contents — which is why one file is enough.
- `.gitignore:17` is `dist/`, `git ls-files web/dist` returns 0, and `git check-ignore -v`
  confirms the match. The placeholder **cannot** enter a commit. Verified, not assumed.

With one placeholder file under `web/dist`:

| Command | Result |
|---|---|
| `go build ./internal/cli/` | **exit 0** |
| `go test ./internal/cli/ -count=1` | **ok** — 13 `--- PASS:`, **0** `--- FAIL:` |

Anti-vacuity: `ok` in 0.015s is also what a package containing no tests prints, so the run was
repeated with `-v` and the passes counted — **13**, not zero. The two tests §8.4 names by hand
(`TestMergeScopes`, `TestEnsureLocalUserStoresConfiguredToken`) were additionally run by name and
both passed.

> **THIS IS A TYPE-CHECK. IT IS NOT A BUILD RESULT AND MUST NOT BE QUOTED AS ONE.** A binary
> produced over that placeholder embeds an **empty asset tree**. What is now established is that
> the four changed `internal/cli` files compile and their package's tests pass. What is *not*
> established is that anything shippable was produced. Reported in these words deliberately: a
> green build over a fake asset directory is a receipt if it is called a build, and a real result
> only if it is called a type-check.

**An unlooked-for finding, and it is the same pattern one layer out.** Canonical
`/workspace/farmtable` **does** have a populated `web/dist` — `favicon.svg`, `index.html`,
`assets/`, `shoelace/`, all dated **Jul 27 16:54**. It is untracked and gitignored, so it is a
real build artefact left behind by an earlier `npm` build. The consequence:

> **`go build ./...` SUCCEEDS IN CANONICAL AND FAILS IN EVERY FRESH CLONE, AND THE DIFFERENCE IS
> AN UNTRACKED DIRECTORY NOBODY CAN SEE IN `git status`.** Anyone building in canonical gets a
> green result that is not reproducible anywhere else, produced by two-day-old local state.

That is independent corroboration of what `ci-22-setup` measured on a cold GitHub runner, reached
from the opposite direction: they saw the failure on a machine with no artefact, I found the
artefact on the machine that does not fail. **I did not copy canonical's real `dist` into my
clone**, though it would have been easy and would have produced a prettier result — depending on
another agent's two-day-old local state is exactly the unreproducible-run contingency this whole
report argues against, and it would have made my "green" mean even less than the placeholder's.

---

## 4. Fix design — anchored on the invariant, not on the doors

The brief: *"fixing only the two known paths is enumerating doors. The user chose the
room."* Standing rules §6.7: enumerating admissible forms is unsound when the form space
is open. The set of ways a token can come to hold no scopes is open — unrecognised type,
pre-vocabulary token, a future provisioning path, a hand-edited database row. So the
invariant is established at the single point where a held scope set is **read for an
authorization decision**, and the population of such points is argued bounded by the
type system rather than by a search.

**Closing argument (type-level, not grep-level):** `scopesKey` is an unexported constant
of the unexported type `contextKey` (`auth.go:18`, `scopes.go:45`). No package outside
`internal/server` can construct that key, therefore none can install a scope set;
`ScopesFromContext` (`scopes.go:57`) is its only reader; `RequireScope` is that
function's only non-test caller. Any future reader must be written inside this package
and will be looking at the inverted function.

Corroborating measurement, not the argument itself:

```
$ grep -rn "len(scopes) == 0" internal/ | grep -v _test
internal/server/scopes.go:106
```

Exactly one hit — the inverted line.

**The read side** (`scopes.go:106-112`):

```go
if len(scopes) == 0 {
    logEmptyScopeSetDenial(ctx, scope)
    return status.Errorf(codes.PermissionDenied,
        "token holds no scopes; %q denied. An empty scope set grants nothing. "+
            "Check the account's user type and re-issue the token with explicit scopes",
        scope)
}
```

**Why the read side alone is not sufficient — the producer must also change.** An empty
slice cannot be persisted as "holds nothing":

```
internal/store/entstore.go:1840   if len(p.Scopes) > 0 {
internal/store/entstore.go:1841       create.SetScopes(p.Scopes)
internal/store/entstore.go:1842   }
```

An empty scope set and an absent scope set are the same database row. A producer
therefore cannot signal deny by returning an empty slice — it has to **refuse to mint**.
Hence the signature change:

```go
func DefaultScopesForUserType(userType string) ([]string, error)
```

returning `*ErrUnknownUserType` for anything outside the vocabulary, and **never**
nil-with-no-error. The `switch` became a map (`defaultScopesByUserType`, `scopes.go:177`)
with `KnownUserTypes()` derived from it, so the recognised list and the lookup cannot
drift apart — and every operator-facing message quotes that derived list.

**A sentinel deny-scope was considered and rejected.** Any string added to `AllScopes`
becomes operator-assignable via `--scope`, which makes the deny marker grantable. Any
string *not* in `AllScopes` fails `ValidateScopes`. Either way it is a worse mechanism
than an error return.

**No transition ramp exists.** No grace period, no grandfather list, no warn-then-enforce
phase, no auto-repair of existing scope-less tokens. Sudden blocking is intended. What
was added is discoverability: every denial logs the user UUID, the required scope, the
command that reveals the offending user type (`ft user get <uuid>`), and the recognised
vocabulary.

---

## 5. Every call site changed, and why

### 5.1 `internal/server/scopes.go` — the invariant anchor

| Change | Why |
|---|---|
| `RequireScope` empty case inverted (`:106`) | The whole fix. Was `return nil` (wildcard). |
| `logEmptyScopeSetDenial` added (`:127`) | The ruling's discoverability half. Names the account and the offending value's source. The user type is not carried in the request context, so the message names the command that reveals it rather than guessing. |
| `ScopesFromContext` doc rewritten (`:53-56`) | The old doc asserted the behaviour now removed. A reader who trusts the comment reintroduces the bug. |
| `switch` → `defaultScopesByUserType` map (`:177`) + `KnownUserTypes()` (`:196`) | Single definition of the vocabulary. The old `switch` had no way to answer "what types exist?", so every message that listed them was hand-maintained and already wrong. |
| `DefaultScopesForUserType` returns `([]string, error)` (`:227`) | See §4 — nil cannot be persisted as "holds nothing". |
| Returned slice is copied (`:236-237`) | Map values are shared; handing one out lets a caller mutate the table for every future token. Pre-existing hazard the `switch` did not have; introduced by the map, so closed here. |
| `ErrUnknownUserType` (`:208`) | Callers need to distinguish "unknown type" from an I/O error to choose an exit code. |
| `ValidateUserType` (`:245`) | Lets the producer reject at creation without a scope lookup. |
| `RequireCollectionAccess` doc extended (`:144-149`) | See §2. Prevents the symmetric "fix". |

`gofmt`: this file was **already not gofmt-clean at `633f8f2`** — a pre-existing const-block
misalignment in the `Scope*` block (`:23-27`). I left it, per "don't clean up adjacent code",
and instead verified my additions add **no new** drift: hunk count against the pre-image is
1 before and 1 after. The control was armed before use per §1.1 — proved to return 0 on a
clean file and 1 on a deliberately malformed one, digit observed.

### 5.2 `internal/cli/token.go:165` — CLI mint path (brief's known path #1)

```go
defaults, err := server.DefaultScopesForUserType(u.Type)
if err != nil {
    return exitError(ExitValidation, "UNKNOWN_USER_TYPE", fmt.Sprintf(
        "user %s: %v. Fix the user's type, or pass explicit --scope flags", userID, err))
}
p.Scopes = defaults
```

Refuse rather than mint a scope-less token that would be denied at every call — a token
that exists but works nowhere is harder to diagnose than a mint that fails with a reason.
`mergeScopes`' doc comment and both its error messages asserted the *opposite* of the new
truth and were corrected (§3.5: a diff cannot merge describing itself in struck vocabulary).
Error text deliberately preserves the substrings the existing tests key on — `"empty scope"`,
`"no stored scopes"`, `"wildcard scope"`.

### 5.3 `internal/serverapp/provisioning.go:147` — **the third path, not named in the brief**

The widest exposure of the three: **any completed OAuth/IAP login** mints a session token
here. On canonical, an unrecognised type silently produced a wildcard session.

```go
scopes, err := server.DefaultScopesForUserType(userType)
if err != nil {
    return "", fmt.Errorf("creating session token for user %s: %w", userID, err)
}
```

This is the concrete payoff of anchoring on the invariant rather than fixing the two
enumerated doors: the room contained a third door, and it was the biggest one.

### 5.4 `internal/cli/connect.go` and `internal/cli/dashboard.go` — **over-denial repair**

The brief names over-denial as this fix's failure mode. It was already present:
`ensureLocalUser` minted `local-embedded`, and `dashboard.go` minted `dashboard-env`,
**both with no scopes**, and both install the enforcing interceptor
(`connect.go:166`, `dashboard.go:90`). Under this change `ft` and `ft dashboard` would
have been killed outright at first call.

Both now mint `[]string{server.ScopeWildcard}` explicitly. This is not a softening of the
ruling — it is the opposite. These tokens were *relying on emptiness to mean everything*.
The grant is now stated rather than inferred, which is exactly the invariant.

### 5.5 `internal/cli/user.go:44` — close the producer at birth

```go
if err := server.ValidateUserType(userType); err != nil {
    return exitError(ExitValidation, "UNKNOWN_USER_TYPE", err.Error())
}
```

`internal/store/schema/user.go:19` is `field.String("type").Default("agent")` — a free-form
string with **no enum constraint**. This is the only gate between a typo and an account no
token can ever be issued for. The `--type` help text is now derived from
`server.KnownUserTypes()`; it previously listed only `human, agent, service_account`,
omitting `admin, reviewer, orchestrator, viewer` — so the CLI's own documentation was
steering operators toward types it did not admit existed.

### 5.6 Test files — compilation only

`rbac_test.go`, `transitions_test.go`, `lifecycle_evidence_test.go` (all `package server_test`).
Uniform substitution `server.DefaultScopesForUserType(` → `defaultScopes(t, ` across
**15 sites**, plus one helper (`rbac_test.go:51`) that `t.Fatalf`s on error. **No assertion
was altered.**

Verified per §5.1 by inversion, not read-back: the sed was inverted and diffed against a
saved pre-image; all three files returned **byte-identical**, with a live control confirming
`diff` reports a 1-line change when one is present.

---

## 5A. The test surface, swept separately — the coverage that certified the bug

The grep in §4 covered **code** sites. The test surface needed its own sweep, because
the vulnerability's longevity is owed to a *test*, not to a gap:
`TestScopedToken_ExistingTokenNilScopesIsWildcard` minted a scope-less token, called two
scoped RPCs, required both to succeed, and **passed green through four audits**. Anyone
who wondered whether nil scopes were safe found a named, passing test saying it was
deliberate. That is not missing coverage; it is coverage asserting the vulnerability was
intended.

**A keyword sweep was not sufficient, and I want the failure recorded.** Searching test
files for `wildcard` near `nil|empty|legacy` returns four of the five sites and **misses**
`TestScopedToken_LegacyNilScopesKeepLifecycleAccess`, whose name contains no form of the
word "wildcard". This is §6.7 in miniature: the vocabulary is open, so enumerating the
words the old behaviour might be spelled in is unsound. The sound sweep is structural —
find every test that **constructs** an empty scope set, since that is the only way to reach
the behaviour:

```
grep -rn "ContextWithScopes(" --include="*_test.go" . | grep -E "nil|\[\]string\{\}"
grep -rn "createTestUserAndToken(" --include="*_test.go" . | grep -E ", nil, "
```

`createTestUserAndToken` (`rbac_test.go:19`) passes its `scopes` argument straight into
`CreateAPITokenParams` with no default lookup, so a `nil` there produces a token row that
genuinely holds nothing.

> ### ⚠ THE CLAIM THAT FOLLOWED HERE WAS WRONG. SEE §5B.
>
> I wrote: *"Complete population: five sites, all in `rbac_test.go`, none elsewhere in the
> repository."* **The first real test run falsified that.** The population is five *of that
> shape*; there are **20 more of a shape my sweep structurally could not see.** The five
> are still correctly analysed below, and the table stands. The word "complete" did not.

| Site | Old assertion | Now |
|---|---|---|
| `TestRequireScope_NilScopesIsWildcard` | nil ⇒ allow | → `..._NilScopesDenied`, asserts `PermissionDenied` |
| `TestRequireScope_EmptyScopesIsWildcard` | `[]string{}` ⇒ allow | → `..._EmptyScopesDenied` |
| `TestScopedToken_ExistingTokenNilScopesIsWildcard` | no scopes ⇒ 2 RPCs succeed | → `..._ExistingTokenNilScopesDenied`, both denied + denial names the scope |
| `TestScopedToken_LegacyNilScopesKeepLifecycleAccess` | legacy token keeps accept/close | → `..._LegacyNilScopesLoseLifecycleAccess` |
| `TestScopedToken_WildcardAllowsEverything` | — see below — | setup corrected, **name kept** |

**The fifth site is the one worth reading twice.** `TestScopedToken_WildcardAllowsEverything`
minted its token with `createTestUserAndToken(t, s, "admin", nil, nil)` and the comment
`// Create wildcard-scoped token (nil scopes = wildcard)`. **Despite its name it never
exercised a wildcard token.** It exercised the empty-set escalation — and it would have
kept passing if the wildcard match in `RequireScope` had been deleted outright. So the
suite's designated proof that wildcard works was not testing wildcard, and the project's
protection against over-denial was load-bearing on the very defect being fixed. It now
grants `ScopeWildcard` explicitly. Its name was always right; only its setup was wrong,
so it is corrected rather than renamed.

I had this test listed in an earlier draft of the plan as "unchanged, must still pass."
That was wrong, and it was wrong in the most dangerous available direction: it would have
presented a test that cannot fail as the guard against this fix's stated failure mode.

**Inverted, not deleted.** A suite that silently loses the test whose name encodes the old
behaviour is how an invariant disappears with nobody deciding to drop it. Each renamed test
carries a comment recording what it previously asserted, and commit `160e211` says so in
its message, so a reviewer meeting a passing-test-turned-failing knows it was the assertion
that was wrong, not the code.

**Rename verified by inversion, not read-back** (§5.1): the four renames were inverted with
`sed` and the result diffed against the saved pre-image — **zero `func Test` lines differ**,
proving the rename set is exactly accounted for and nothing else was caught. Control per
§1.1: omitting one rename from the inversion makes that count **2**, so the check fires.

Two non-sites, confirmed and deliberately left alone:

- `TestCreateAPIToken_NoScopes` (`rbac_test.go:532`) asserts the stored row has no scopes.
  Still true, still correct — it is the test that documents the `entstore.go:1840` fact the
  whole producer-side argument rests on.
- `internal/cli/token_test.go` H1 cases assert `mergeScopes` **errors** on a nil-scope token.
  Correct under the fix and reinforcing it. Only the stale comment calling such a token
  "(wildcard)" was corrected (§3.5).

---

## 5B. The first real run falsified §5A's closure claim — and the reason generalises

`go build ./...` and `go test ./...` at `160e211` (results in §3A). **12 failures in
`internal/server`, every one an over-denial**, all the same shape:
`PermissionDenied desc = token holds no scopes; "collection:write" denied` — in
`auth_test.go` (2), `identity_enforcement_test.go` (5), `identity_test.go` (5).
Deterministic, 0.00s, zero variance.

### Why the sweep missed them

§5A enumerated on **two** constructors — `ContextWithScopes` and `createTestUserAndToken` —
and declared the population closed. There is a **third**: direct
`s.CreateAPIToken(ctx, store.CreateAPITokenParams{...})` in test files. **20 such call sites
across 6 files omit scopes.**

| Sites omitting `Scopes` | File |
|---|---|
| 6 | `internal/server/identity_test.go` |
| 5 | `internal/store/identity_test.go` |
| 5 | `internal/server/auth_test.go` |
| 2 | `internal/server/identity_enforcement_test.go` |
| 1 | `internal/store/multistore_test.go` |
| 1 | `internal/server/rbac_test.go` |

**But the shallow miss is not the interesting one.** Having correctly reached "enumerate on
the constructor," I then enumerated on the *forms of emptiness I could picture* — the `nil`
literal and `[]string{}`. The actual form is **the `Scopes` field simply not being written
at all**. My grep asked which `CreateAPITokenParams` blocks *contain* `Scopes`. The sites
that mattered are the ones that **do not**.

> **ABSENCE HAS NO TOKEN TO GREP FOR.** You cannot search for a field that is not there.
> You can only search for the *container* and test what it lacks. A Go struct literal
> spells "empty" by silence, and silence matches no pattern.

So the method from §5A survives, but only with a correction it did not have:

> Enumerate on the constructor — but derive the constructor **set** by finding every writer
> of the field's *type*, not the constructors you already happen to know. Then, within each,
> test for the field's **absence**, not for the empty values you can imagine.

The sweep that actually works is an `awk` over `CreateAPITokenParams{...}` blocks selecting
those whose body does not match `/Scopes/`. That found all 20. This is §6.7 again, one level
deeper than I applied it: I closed the form space at the level of *values* while leaving it
open at the level of *syntax*.

### What the 12 failures are, and are not

**Test-side, not a production over-denial.** Evidence rather than assertion:
`setupAuthTestEnv` (`identity_enforcement_test.go:25`) creates a user of type `"agent"` — a
**recognised** type — then mints its token by writing a row directly with no `Scopes` field.
In production that same agent's token comes from `ft token create`, which calls
`DefaultScopesForUserType("agent")` and yields four real scopes. These tests construct a
state the production mint path no longer produces and now refuses to produce. Every failing
assertion is about auth propagation or actor recording; **none is about scopes.** They never
tested the empty-set behaviour — they *inherited* it.

Which is the finding worth keeping: **the escalation was not one bug with a handful of
witnesses. It was ambient.** Empty-means-wildcard had quietly become the default way this
test suite authenticates. That is the same mechanism as N11 and the fifth site, at scale.

**Repair plan:** mint with explicit scopes matching each test's intent — deliberately **not**
a blanket wildcard, because **a blanket wildcard would repeat the original sin: a permission
set nobody chose.** Not yet done.

### 5B.1 "Test-side" was inferred from one caller. Here it is measured.

The claim above initially rested on a single known caller (`ft token create`). That is the
error I had just caught in myself — enumerating the callers I knew and declaring the set
closed — so the corrected sweep was run over the **non-test** half of the tree, by type.

**A second writer type exists, and it is not `CreateAPITokenParams`.** The type-based
enumeration turned it up: `server.TokenLookupResult` (`auth.go:67`). `CreateAPITokenParams`
writes a **database row**; `TokenLookupResult` writes the **context value** consumed at
`auth.go:155` — and a fake lookup can produce one with no database at all.
`TestAuthInterceptor_RecordUsageHasDeadline` mints no token whatsoever; it hands the
interceptor a `deadlineLookup` returning `TokenLookupResult{UserID, TokenID}` with `Scopes`
omitted. **No `CreateAPITokenParams` sweep could ever have seen it.** Enumerating implementers
of `LookupByHash` closes the set at four, two of which are test fakes.

| Sweep | Non-test hits | Verdict |
|---|---|---|
| `CreateAPITokenParams{…}` omitting `Scopes` | 1 — `internal/cli/token.go:134` | **FALSE POSITIVE.** The literal omits `Scopes`, but `p.Scopes` is assigned afterwards on *both* branches (`:150` explicit `--scope`, `:169` the defaults path). |
| `TokenLookupResult{…}` omitting `Scopes` | 1 — `internal/server/auth.go:254` | **Real, but not live.** See below. |
| `StoreTokenLookup.LookupByHash` (`token_lookup.go:19`) | — | **Correct**: propagates `tok.Scopes`. The row→context path is sound. |

**The sweep's own unsoundness, stated because it bit me:** an absence test on a struct literal
is *necessary but not sufficient*. A field can be filled by later assignment, which no
literal-body test can see. The `awk` **over-reports**, which is the safe direction, but it is
not sound alone.

> ⚠ **THE INSPECTION PASS IS THE LOAD-BEARING STEP, NOT THE `awk`.** A future reader sees a
> one-line command and a clean result and cannot tell that a human eye is what made it true.
> Do not re-run the sweep and trust the output.

Confirming the false positive, since it now carries weight: `p.Scopes` is assigned at
`internal/cli/token.go:155` and `:171` — **exactly two, one per arm of the `if/else`.** Every
intervening `return` is an error path that aborts before `CreateAPIToken` is called, so no path
reaches the mint with the field unset. No third branch, no surviving early return.

**`auth.go:254`** is `legacyTokenLookup.LookupByHash` returning `&TokenLookupResult{UserID:
l.userID}`. Reachable only via `LegacyTokenAuth`, which is **exported**, marked `Deprecated`,
documented as *"retained only for backward compatibility in tests"*, and has **zero non-test
callers today** (3 test call sites). Per §2.5 I will not call an exported function unreachable.
This is a third value: not a live production defect, but live API surface. Note the direction —
under the old code it granted **wildcard** to any holder of the legacy token; under the fix it
denies. The change strictly improves it whether or not anyone reaches it.

**Result: measured, not inferred — no live production path mints a scope-less token.** The two
syntactic hits are one false positive and one deprecated test-only export. The claim survived
being put at risk, which is the only reason it is worth stating. Before the sweep I could have
written the same sentence: **I would have written it, but I would not have earned it.**

### 5B.2 Observation, not a fix: a "tests only" comment on an exported symbol

`LegacyTokenAuth` is **exported**, marked `Deprecated`, and documented *"retained only for
backward compatibility in tests."* It has zero non-test callers today.

> **A comment saying "tests only" on an exported symbol records an intention the compiler does
> not enforce, and it reads to every later reader as a constraint. The export is the actual
> contract; the comment is a receipt for a restriction nobody applied.**

This is tonight's central class again — a representation carrying an intention nothing checks —
appearing this time as a **visibility modifier**. Under the old code it handed a **wildcard** to
any holder of the legacy token, through a door labelled "tests only" that stood open to every
importer of the package. The fix denies it either way, so **no action is taken tonight; it is
named, not fixed.**

Per §2.5, "no non-test callers" is recorded here deliberately **without** the word
*unreachable*, and the two must not be conflated by a later reader.

### 5C. The fixture repair — `89973f8`

**The governing rule: per-intent scopes, never a blanket wildcard.** Handing every fixture
`ScopeWildcard` would have turned 12 red tests green in one line, and it would have repeated the
original sin in a different spelling — **a permission set nobody chose**. The whole defect was a
principal silently holding more than anyone decided to give it. Fixing it by silently giving
every test principal everything is the same act with the author's name on it.

So each fixture got either its user type's real defaults or, where the test's subject genuinely
required them, a different user type. The interesting cases are the ones where those two options
were both wrong.

**Where scaffolding needed rights the caller does not have, the scaffolding moved off the wire.**

| Site | The right it lacked | Why the caller was not simply promoted |
|---|---|---|
| `identity_test.go` — `TestClaimTask_PropagatesUserID`, `TestAddComment_PropagatesUserID`, `TestUpdateTask_PropagatesActorID`; `identity_enforcement_test.go` — `TestIdentity_WatchTasksAcceptsValidAuth` | `collection:write` — each built its collection via `client.CreateCollection` as type `agent` | The subject of each is *that an agent's identity is recorded*, so the caller has to stay an agent. Granting an agent `collection:write` would make the fixture assert that agents may create collections. **That is a false permission model baked into a test — the same failure mode as the bug being fixed.** Collections now built through the store. |
| `identity_test.go` — `TestClaimTask_PropagatesUserID` (additionally) | `task:accept` — it created its task directly in stage `accepted` | Sharper than the above, and I only found it because the first repair attempt still failed. Agents may *work* tasks but may not *accept* them out of triage, so **an agent cannot set up its own claimable task.** The setup moved to the store; claiming it — the part the test is about — an agent may still do. |
| `identity_test.go` — `TestListUsers` | `user:read` | No non-wildcard type holds `user:read`. Keeping the caller an agent and handing it an explicit `user:read` token would assert that agents may enumerate users. The caller becomes an `admin`; the asserted count is 2 either way, so the caller's type was never part of this test's subject. |
| `identity_enforcement_test.go` — `setupAuthTestEnv` (4 callers) | `collection:write`, `task:close`, `user:read` | Here the API surface **is** the subject — these tests exercise `CreateCollection`, `CloseTask`, `DeleteTask` and `ListUsers` as the thing under test, not as setup. So the honest repair is a caller that legitimately holds those rights: type `admin` with an explicit wildcard. |
| `auth_test.go:282` — `TestAuthInterceptor_ValidTokenAccessesNonExemptRPC` | `collection:read` | An agent legitimately holds it, so the type's own defaults are the honest grant. |
| `auth_test.go` — `deadlineLookup.LookupByHash` | `collection:read` | **A second writer type, not a second call site.** This fake mints no token and touches no database — it writes the context value directly via `TokenLookupResult`, which is why no sweep over `CreateAPITokenParams` could ever have seen it (§5B.1). Granted the one scope its RPC needs. |

**Two scope-less mints were deliberately kept, and now say so in the code.** A future sweep will
flag both, and deleting them would cost real coverage:

- `TestWhoAmI` (`identity_test.go`) — this is the §2 natural experiment in test form. `WhoAmI`
  never calls `RequireScope`, so a scope-less token **must still succeed** there. The test is
  live proof that "this principal HOLDS nothing" and "this endpoint REQUIRES nothing" are
  distinct senses. Repairing it would delete the evidence that they are not conflated.
- `TestCreateAPIToken_NoScopes` (`rbac_test.go`) — a *storage* assertion, not an authorization
  one: the store still accepts a scope-less row and an omitted set still round-trips as empty
  rather than as something else. Enforcement lives at `RequireScope`, not in the store.

Each carries a comment saying it will be flagged and that leaving it alone is correct. Without
that, the next person running my own sweep will "fix" them and quietly remove two of the more
informative tests in the package.

**Not repaired, deliberately:** the four other `Name: "test-token"` mints in `auth_test.go`
(`StoreBackedValidToken`, `InvalidToken`, `CustomHeader`, `CustomHeaderPrecedence`) and the
scope-less mints in `internal/store` and `internal/serverapp`. All pass. None reaches a
`RequireScope` call — the store-level ones never cross the interceptor at all, and the
`auth_test.go` four assert interceptor behaviour without invoking a scoped RPC. Changing a
passing test to match a pattern is how you lose the reason it was written.

---

## 6. What was NOT changed, and why

**`internal/platform/github/passthrough.go:909` — `LookupToken` synthesises a scope-less
token for ANY hash.** Read as a standalone fact this is the worst finding in the repository.
It is not reachable with auth enforced: `startGitHubPassThrough` installs **no auth
interceptor**, so nothing calls `RequireScope` on that path. Changing it would be a
speculative edit to a subsystem I was not assigned. Falsifier in §7.

**`internal/server/scopes.go:157` — `RequireCollectionAccess` empty case.** Correct as-is;
see §2. Changing it would be the symmetric mistake.

**`internal/server/transitions.go:117-136` — `TransitionScope`.** Every fallthrough returns
`ScopeTaskWrite`, never `""`. It cannot produce an empty requirement, so it needs no change.

**`internal/server/convert.go:205-212` — `userTypeToProto` default → `USER_TYPE_AGENT`.**
This is *why the bug was invisible*: an unrecognised type renders in the UI as "agent".
It is a display concern, not an authorization one, and the authorization side is now closed
regardless. Flagged for a follow-up ticket, not fixed here — fixing it changes UI output for
reasons unrelated to this ruling.

**`internal/store/schema/user.go:19` — no enum constraint on `type`.** A schema change
requires `go generate ./internal/store/ent` and a migration; that is shared infrastructure
and outside my assignment. §5.5 closes the CLI producer; the schema remains the deeper fix.

**Pre-existing scope-less tokens are NOT auto-repaired.** This is deliberate and is the
single place I could most easily have violated the ruling. Repairing them *is* the
grandfather list the brief forbids. See §8.

**Nothing merged, nothing pushed.**

**A note I owe the record:** I briefly believed `userTypeFromProto` (returns `""` for
unknown) created a wire-writable path to an empty user type. It does not — its only
caller is `server.go:1387`, a **ListUsers filter**, and there is no CreateUser RPC. I
caught this before it entered any finding, but it is the kind of error that reads as
authoritative once written down, so it is recorded here rather than quietly dropped.

---

## 7. NOT REACHED — unmeasured bounds, each with a falsifier

One test was run, on two commits. Everything below is argued, not measured. Each item
states the observation that would show me wrong.

| # | Claim not measured | Falsifier |
|---|---|---|
| 1 | ~~The branch compiles and the whole suite passes.~~ **MEASURED, AND I WAS WRONG — see §3A and §5B.** It compiles; the suite does not pass. 12 over-denials from a population my sweep declared closed. Retained here, struck rather than deleted, because the falsifier I wrote is the one that fired. | *Discharged.* |
| **1a** | ~~**`internal/cli` is UNMEASURED — a third value, neither passing nor failing.**~~ **DISCHARGED AS A TYPE-CHECK, NOT AS A BUILD — see §3B.1.** With a placeholder under `web/dist`: `go build ./internal/cli/` **exit 0**, `go test ./internal/cli/` **13 PASS / 0 FAIL**. **The merge blocker is lifted for the four changed files' compilability and for CLI test behaviour, and for nothing else.** What remains undischarged is anything about a *shipped binary*, which over that placeholder would embed an empty asset tree. Also corrected here: the embed is at **`./assets.go` (repo root)**, not `internal/assets/assets.go` as the struck text below claims — I had inferred that path from a bare filename in an error message. Original text retained struck rather than deleted, since the falsifier I wrote is the one that fired. | *Discharged as stated; the shipped-binary question is not this leg's and is not claimed.* |
| ~~1a (original text)~~ | **`internal/cli` is UNMEASURED — a third value, neither passing nor failing.** Exact text: `# github.com/farmtable-io/farmtable/internal/cli` / `assets.go:5:12: pattern all:web/dist: no matching files found` / `FAIL github.com/farmtable-io/farmtable/internal/cli [setup failed]`. Also root, `cmd/farmtable-server`, `cmd/ft`. `token.go` and `user.go` (§5.2, §5.5) are **wholly unmeasured** — including whether `ft user create --type robot` exits `ExitValidation` rather than panicking. **Largest unverified area of the patch, and it is a MERGE BLOCKER.** The suite exited in a way that *looks* like it measured them. A missing dependency edge is concealing whether a privilege fix compiles. **No workaround attempted:** a hand-built `web/dist` would make the run unreproducible and is exactly the local-state contingency to avoid. | Once the `web/dist` build edge is fixed by the leg working on it: `go test ./internal/cli/`. Any failure is a real finding — nothing in that package is expected-red. |
| 1b | ~~**The 12 over-denials are test-side only.**~~ **STATED TOO BROADLY WHEN WRITTEN, AND CORRECTED HERE.** I originally inferred "test-side" from **one** caller — `setupAuthTestEnv` — and generalised it to all 12. That is the same move that produced the §5B miss: a property checked on one member, asserted of the population. It has since been discharged the honest way, by *repairing all 12 individually* (§5C) and finding each one test-side on inspection rather than by inference. The conclusion survived; the method that produced it did not deserve to. | Unchanged and still live: find any **production** path that mints a token without scopes for a recognised user type. §5.2/§5.3/§5.4 close the three I know of; a fourth would be a genuine over-denial and would outrank the rest of this report. |
| 2 | **`RequireScope` is the only authorization reader of the held scope set.** Argued from the unexported key type, corroborated by one grep. | `grep -rn "ScopesFromContext" internal/ \| grep -v _test` returning any caller other than `RequireScope`; or any authorization decision inside `internal/server` that reads `result.Scopes` directly rather than through the context. |
| 3 | **The over-denial repairs work** — `ft` and `ft dashboard` still start. Never executed. | Build `ft`, run `ft user list` against a fresh embedded DB and `ft dashboard`. Any `PermissionDenied` falsifies §5.4. This is the highest-value unrun check on the list. |
| 4 | **The provisioning path (§5.3) behaves.** Never executed; it needs a live OAuth/IAP flow. | A login by a user whose type is recognised must still yield a working session. If §5.3 rejects a *legitimate* login, the error return is mis-scoped. |
| 5 | **`passthrough.go:909` is unreachable with auth enforced.** Argued from the absence of an interceptor in `startGitHubPassThrough`. §2.5: zero importers ≠ zero reachability. | Find any code path that installs `AuthUnaryInterceptor` (or the stream variant) over a `GitHubPassThroughStore`, or any deployment that fronts it with one. If one exists, that store is a wildcard-for-any-hash oracle and outranks everything in this report. |
| 6 | **`multistore.go:430-432` does not widen the surface.** `LookupToken` hardcodes `m.primary`; I read it but did not exercise it. | A secondary store reachable by token lookup — i.e. any configuration where a token resolves against a non-primary store — would mean §4's single-reader argument holds but the *producer* set is larger than §5 enumerates. |
| 7 | **Existing installs break at next call, and only in the predicted way.** Predicted from Run A, not observed on a real install. | Point a built `ft` at `/workspace/.farmtable/farmtable.db` and call any scoped RPC. I predict `PermissionDenied` plus the SECURITY log line naming the token's user UUID. If it *succeeds*, some path still treats empty as wildcard and §4's closure is incomplete. If it fails **without** the log line, the discoverability half of the ruling is not satisfied and the fix is a lateral move by the brief's own definition. |
| 8 | **No new gofmt drift.** Measured by hunk count against the pre-image, not by a clean `gofmt -l`, because `scopes.go` was already dirty at `633f8f2`. | `gofmt -d internal/server/scopes.go` showing a hunk anywhere outside the `Scope*` const block at `:16-28`. |
| **9** | **IS THE DOOR ON EVERY PATH, OR CAN YOU WALK AROUND THE BUILDING?** This patch proves every empty scope set *that is consulted* is denied. It does **not** prove `RequireScope` is consulted on every path that needs it. An RPC that simply never calls it is untouched by this fix and invisible to every measurement in this report. **DELIBERATELY NOT MEASURED** — see the note below the table. | Enumerate the RPC set from the **generated service interface** in `api/farmtable/v1` (closed by the proto) rather than from a grep over receivers, and diff it against the set of methods containing a `RequireScope` call or an `isUnauthenticatedEndpoint` exemption. Any method in neither set is a finding. `WhoAmI` is a *correct* member of the exempt set (§2) and is the reason the diff needs a human reading, not just a count. |

**On item 9, and why it is empty rather than answered.** This is the single most valuable
question adjacent to this fix, and I did not touch it on purpose. I was mid-way through the
repair, and opening a second investigation there is how a leg ships neither. It went to its own
owner: a separate source-only auditor, briefed by the coordinator at 03:37Z, working from the
closed-manifest method above. **Nothing in this report should be read as a partial answer to it.**

**[RELAYED, NOT MEASURED BY ME — do not quote this as my finding.]** That auditor has since
reported, via the coordinator: on the gRPC surface **30 of 33 RPCs check**, the 3 that do not are
defensible, and the exemption skiplist has exactly the right two members. On that surface this
fix's coverage appears complete. **But it also found a second door that is not on my manifest at
all, and this patch does not touch it**; its reachability was still being measured at 03:48Z.

I have not verified any of that and it is not this leg's result. It is recorded here for one
reason only: so that nobody reads "30 of 33" as permission to write the sentence §0A forbids.
**A second door whose reachability is unmeasured is precisely why "the empty-set escalation is
closed" and "authorization is sound" must stay separate sentences.**

---

## 8. TEST PLAN

### 8.1 The five inverted tests — DONE in `160e211`, must now pass

Full analysis in §5A. These are no longer pending work: they are inverted, renamed, and
committed. Under the fix they must all **pass**. Any of them failing means the fix is not
behaving as designed.

**Status at `89973f8`: all five RUN AND GREEN** — named individually in the 15-test run of §3B,
so their passing is measured rather than inferred from a quiet package result.

### 8.2 MANDATORY — a legitimate caller still succeeds

The brief: *"The failure mode of this fix is over-denial."* These must pass, and a
reviewer should treat any failure here as outranking every other result in this report.

**Status at `89973f8`: items 1–3 are RUN AND GREEN**, inside the whole-package run (0 failures)
and again in the 15-test named run with anti-vacuity counting (§3B). Items 4–5 are still
unwritten. And the strongest over-denial evidence is not in this list at all: **the entire
12-failure set of §5B *was* the over-denial failure mode**, caught by the suite and repaired
site by site in §5C. The fix's predicted failure mode did occur, was detected, and was resolved —
that is a better result than never having triggered it.

1. `TestScopedToken_WildcardAllowsEverything` (`rbac_test.go:223`) — **setup corrected in
   `160e211`; see §5A.** It now grants `ScopeWildcard` explicitly. Before that change it
   proved nothing about wildcards, so treat any pre-`160e211` green here as meaningless.
2. `TestScopedToken_ReviewerFullLifecycle` (`rbac_test.go:901`) — the broadest legitimate-caller
   test in the suite; exercises a recognised type end-to-end through the task lifecycle.
3. `TestScopedToken_AgentCanClaimAcceptedTask` (`rbac_test.go:842`) — a *non-wildcard* recognised
   type doing its normal work. Wildcard tests cannot detect over-denial in the scope-matching
   loop; this one can.
4. `TestDefaultScopesForUserType` (`rbac_test.go:180`) — extend to assert **every** entry of
   `KnownUserTypes()` returns a non-empty set and a nil error. This is the direct guard against
   the fix's failure mode: a recognised type that yields nothing is now a total outage for that
   type, where before it was merely wrong.
5. **New — `TestDefaultScopesForUserType_ReturnedSliceIsACopy`**: mutate the returned slice,
   call again, assert the second result is unaffected. Guards the map-sharing hazard §5.1 introduced.

### 8.3 New tests for the new behaviour

6. **`TestDefaultScopesForUserType_UnknownTypeErrors`** — table over `""`, `"Admin"` (case),
   `"robot"`, `"agent "` (trailing space). Each must return `*ErrUnknownUserType` **and** a nil
   slice. Assert via `errors.As`, not string matching.
7. **`TestValidateUserType`** — accepts every `KnownUserTypes()` entry, rejects the §8.3.6 table.
8. **`TestKnownUserTypes_MatchesScopeTable`** — assert `len(KnownUserTypes()) == len(defaultScopesByUserType)`
   and sorted. Cheap guard against the drift the old `switch` allowed.
9. **`TestRequireScope_EmptyScopeSetLogsTheAccount`** — capture `log` output via `log.SetOutput`,
   assert it contains the user UUID and the required scope. **This is the ruling's second half
   and is otherwise untested.** A silent denial is a lateral move, not a fix — so this test is
   not optional polish.
10. **`TestRequireCollectionAccess_NoRestrictions`** (`rbac_test.go:137`) — unchanged, must still
    pass. Its passing is the regression guard that §2's asymmetry was preserved.

### 8.4 CLI-level

11. **`TestUserCreate_RejectsUnknownType`** — `ft user create x --type robot` exits `ExitValidation`
    with code `UNKNOWN_USER_TYPE`, and **no user row is created**.
12. **`TestTokenCreate_RefusesUnknownUserType`** — for a user whose row already carries a bad type
    (insert directly, bypassing §5.5), `ft token create` fails rather than minting.
13. `TestMergeScopes` (`internal/cli/token_test.go:10`) — unchanged, must still pass; confirms the
    error-text edits in §5.2 preserved the substrings it keys on.
14. `TestEnsureLocalUserStoresConfiguredToken` (`internal/cli/dashboard_test.go:64`) — must still
    pass, and should be extended to assert the created token's scopes are `["*"]` rather than empty
    (§5.4). Without that assertion nothing prevents a future edit from silently restoring the
    scope-less local token, which would now be an outage rather than an escalation.

### 8.5 Order to run, given the token is scarce

**Superseded in part — `internal/server` is already done (§3B) under the revised fence, which
permits single-package runs when logged to `reports/_run-queue-log.md` first.** What remains
genuinely needs a full-module token, and it is one thing:

1. **`go test ./internal/cli/`** — the whole of §7 item 1a. Blocked not on the token but on the
   `web/dist` build edge; it will report `[setup failed]` until that leg lands, no matter how
   much token is spent on it. **Sequencing request, not a build request.**
2. `go test ./internal/serverapp/` — passed at `160e211` and unchanged since, so this is a
   regression check, not a first measurement.
3. Full `go test ./...` — last, and only once 1 can actually run.

Stop at the first failure and **report the text, not the exit code**: per apparatus, a bare
exit 1 on this tree may be the `web/dist` embed rather than anything in this change, and the two
are indistinguishable by status alone.

---

## 9. DEPLOYMENT — REQUIRED PRE-MERGE STEP FOR EVERY LIVE INSTALL

**A fix whose correct deployment procedure lives only in a chat message is a fix that will
be deployed without it.** So it is written here, in the report, as a required step.

### 9.1 The line between grandfathering and repair

These two get conflated, and the difference is the whole ruling:

| | |
|---|---|
| **CODE that exempts old tokens** — a grace period, a warn-then-enforce phase, a grandfather list, an auto-repair on startup | **FORBIDDEN.** This is the transition ramp the ruling rules out. If you find yourself designing one, you have overridden the product owner. |
| **AN OPERATOR running the documented repair command** | **The intended path. This is the fix working as designed,** not a concession to it. |

The first hides the defect for another release. The second surfaces every affected account
exactly once, by name, and closes it. This fix ships the second and contains none of the first.

### 9.1a The test-suite repair IS the fleet repair, rehearsed for free

**[DERIVED, not measured — the conditional is in the sentence.]** The repair the suite needs
(§5B) and the repair live databases need (§9.3 step 2) are *the same operation*: replace an
implicit wildcard with an explicit scope set. The suite therefore functions as a dry run of the
fleet migration, in a place where it is cheap and reversible, **before** it is run on a live
database. If the 17 test sites are repairable without a single judgement call about intent,
the live repair likely is too; if any of them turns out ambiguous, that ambiguity will recur
against a real account.

> **THE REHEARSAL HAS NOW BEEN RUN, AND IT FALSIFIED THE OPTIMISTIC HALF OF THAT SENTENCE.**
> I wrote the conditional expecting it to come out clean. It did not. **At least four of the
> sites could not be repaired mechanically** — they required deciding *what the principal was
> supposed to be allowed to do*, and the obvious mechanical answer was wrong in a specific,
> dangerous direction:
>
> - Four fixtures needed `collection:write` for a caller of type `agent`. The mechanical repair
>   is "grant the missing scope." That answer **encodes a permission the model denies** and
>   would have left a fixture asserting that agents may create collections.
> - `TestClaimTask` needed `task:accept`, which agents are *deliberately* denied. Granting it
>   would have quietly reversed a designed restriction.
> - `TestListUsers` needed `user:read`, which **no non-wildcard type holds at all**, so there
>   was no mechanically correct grant to make.
>
> In each case the right answer was to change *who the caller is* or *how the setup is built* —
> a judgement about intent, not a lookup.
>
> **The operational consequence, and it is the reason this rehearsal was worth running:
> DO NOT WRITE A SCRIPT THAT REPAIRS LIVE TOKENS BY GRANTING WHATEVER SCOPE THE FIRST DENIAL
> NAMES.** That is precisely the mechanical repair that failed here, and against a real database
> it would silently widen accounts to whatever they happened to call — reconstructing the
> original defect one `PermissionDenied` at a time, with an audit trail that makes it look
> deliberate. The inventory in §9.3 step 1 must be resolved against the account's *intended*
> user type, by a human, exactly as these four were.

**[DERIVED]** That many test sites needed repair is also a rough prevalence proxy for how common
the scope-less row shape is in real databases. It is an inference from a convenience sample —
test fixtures are not tokens — and it should not be quoted as a count of anything. Treat it as:
*expect this shape to be common, not rare.*

> **CORRECTION TO MY OWN EARLIER FIGURE, because it was quotable and wrong in the direction that
> flatters the finding.** I previously wrote "~17–20 test sites needed repair." **The measured
> number is 9.** The sweep matched 20 syntactic sites; 9 of them actually mint a token that later
> reaches a `RequireScope` call, and those 9 produced all 12 failures (`setupAuthTestEnv` alone
> accounts for 4 of the 12 through its 4 callers). The other 11 are scope-less and harmless —
> they live in `internal/store` and `internal/serverapp`, never cross the interceptor, and never
> consult a scope set.
>
> **The gap between 20 and 9 is the same error this report is about, pointed at my own
> measurement: a syntactic match is not a consulted scope set.** The prevalence proxy should be
> read off 9, not 20, and it is therefore roughly **half** as alarming as I first reported. I am
> correcting it downward unprompted because a security report that overstates prevalence spends
> credibility it will need for the parts that are real.

### 9.2 What breaks

**Every existing token holding no scopes stops working at its next call** — full stop, no
grace period. Specifically:

- Tokens minted before the scope vocabulary existed.
- Tokens minted for a user whose type is outside `KnownUserTypes()`.
- Any `local-embedded` or `dashboard-env` token minted by a **pre-`5a9cc6f`** `ft` binary.
  New ones are fine (§5.4), but ones already sitting in a database were minted scope-less.
- **This fleet's own `/workspace/.farmtable/farmtable.db`.** Agents using `ft` for task
  operations are affected. This is not hypothetical and it is not somebody else's install.

The failure is loud by construction: `PermissionDenied`, plus a `SECURITY:` log line naming
the account UUID, the refused scope, the `ft user get <uuid>` command, and the recognised
type list.

### 9.3 Who runs what, in what order relative to merge

**Order matters. Steps 1–3 happen BEFORE the merge lands on any running install.**

1. **Before merge — inventory.** Operator, against each live database:
   `ft token list` and identify every token with an empty scope set. This is the blast
   radius, and it is knowable in advance rather than discovered by outage.
2. **Before merge — repair each one**, choosing the scopes deliberately rather than
   reflexively:
   ```
   ft token update <token-id> --set-scopes "*"          # only if it genuinely needs wildcard
   ft token update <token-id> --set-scopes "task:read,task:write,task:claim,collection:read"
   ```
   Repairing *before* the merge is safe: under the pre-merge code an explicit scope set
   behaves identically to the empty one it replaces, so **step 2 causes no change in
   behaviour until the merge lands.** That is what makes a zero-downtime rollout possible
   without a line of transition code — the ramp is in the *deployment order*, not the code.
3. **Before merge — audit user types.** Any user whose `type` is outside
   `KnownUserTypes()` can no longer have tokens minted for it (§5.2, §5.3). Fix the type or
   retire the account. `internal/store/schema/user.go:19` has no enum constraint, so typos
   are the expected cause.
4. **Merge**, then rebuild and reinstall `ft` (`go build -o /workspace/.farmtable/bin/ft ./cmd/ft`)
   so that newly minted local tokens take the explicit-wildcard path from §5.4.
5. **After merge — watch for `SECURITY: empty scope set denied`.** Every occurrence is
   either a token missed in step 1 or a genuine unrecognised-type account. Both are repaired
   by re-issuing with explicit scopes. A quiet log here is the success signal.

**If steps 1–3 are skipped, the merge is still correct but the install takes an outage** —
every scope-less token fails at once. That is the intended, discoverable failure, and it is
recoverable by running step 2 late. It should still not be anybody's plan.

---

## 10. Process notes for the coordinator

1. **Channel conflict — raised, and RESOLVED by the coordinator at 03:12:31Z.** The
   eng-manager messaged me directly (03:03:11Z) granting the N11-scoped token, while brief
   constraint 5 said "Coordinator only." I did not reply to him, and asked the coordinator
   to relay. The coordinator has since **amended the brief**: eng-manager direct for
   *logistics* (token returns, scheduling, merge sequencing, queue position); coordinator for
   *findings and design*. The isolation was always about findings. Later work should follow
   the amended rule, not constraint 5 as written.
2. **Token conflict — RESOLVED in the same message.** The coordinator's 02:59:42Z "you still
   have no build token" was a statement of fact about 02:59, not a standing prohibition, and
   the eng-manager's grant wins because he is the run queue. Worth recording the general
   lesson, which is the coordinator's own: **a prohibition with a timestamp is
   indistinguishable from a policy once the timestamp is out of view, and the reader is
   always the one for whom it is out of view.** I held the grant to its stated scope — one
   test, two commits — and returned it on answering N11.
3. **No disagreement with the ruling.** The brief invites me to say so if I think the fix
   is wrong. I do not. Run A shows the escalation was live, and the fix is the narrowest
   change that closes it. My one substantive addition to the ruling's scope is §5.4, and
   that is over-denial repair, which the brief explicitly anticipates.

---

## 11. Salvage — the branch existed on exactly one disk

**Measured by the eng-manager, not by me:** `git cat-file -t 89973f8` and `git cat-file -t
160e211` both returned `fatal: Not a valid object name` in canonical, and another leg reported
`160e211` exiting 128 in its own clone.

> **A SHA THAT RESOLVES IN EXACTLY ONE CLONE IS NOT A CITABLE SHA. IT IS A LOCAL FILENAME THAT
> LOOKS LIKE EVIDENCE.**

Every commit citation in this report was in that state until 03:54Z. The failure mode is
particularly poor: `git cat-file` exits 128 with no output, which reads as *"nothing there"*
rather than *"you cannot see it from here."* Same shape as §3B.1's untracked `web/dist` — a fact
about the *machine* masquerading as a fact about the *object*.

**Remedy, and it is not a push:** `/scion-volumes/scratchpad/projects/farmtable/salvage/scopedeny-93.bundle`

| | |
|---|---|
| Size | 19312 bytes |
| Commits | 8 (`633f8f2..HEAD`) |
| Ref named | `89973f89ce2e092cbfb2be3114bc13c494368345` as `HEAD` |
| Requires | `633f8f269bcf9225b62d3c7c119f8166eda9ae64` — which canonical has, so it is verifiable by someone who is not me |
| `git bundle verify` | `is okay`, exit 0 |

**`is okay` is a verify, not a restore, and I did not let it stand in for one.** By this report's
own standard — `ok` at 0.015s is also what an empty package prints — I proved the recovery end to
end in a throwaway clone of canonical:

```
BEFORE: git cat-file -t 89973f8  ->  fatal: could not get object info   (the EM's failure, reproduced)
        git fetch <bundle> HEAD:scopedeny-93-deny-unrecognised-type
AFTER:  git cat-file -t 89973f8  ->  commit
        commits recovered: 8;  scopes.go contains logEmptyScopeSetDenial x3
```

Note for whoever fetches: the bundle names the ref **`HEAD`**, not the branch name — that is what
`633f8f2..HEAD` produces — so the receiving side needs `HEAD:<branch-name>`, as above. Temp clone
removed with `rm -rf`; **no `gc`, no `prune`**. Canonical remains `633f8f2` with zero tracked
modifications. **Not pushed. Pushing is the merge owner's alone.**
