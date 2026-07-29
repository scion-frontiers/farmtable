# sec-verify-f7 — measure five security claims. Fix nothing.

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `sec-verify` and commit **`7a0f220dbd9332cb8db62138c841777432b4eda4`**.
**Do NOT create any directory named in this brief.**

**This base is `origin/main` — the code LIVE IN PRODUCTION.** That is the point: every claim
below is a claim about production, so it must be measured against production's tree.

`web/dist` and `web/node_modules` are present and gitignored. **Leave them.** `go build` fails
with `pattern all:web/dist: no matching files found` without `web/dist`.

## Baseline `[MEASURED by me at 7a0f220 in this exact clone]`

| check | result |
|---|---|
| `go build ./...` | exit 0 |
| `git status --porcelain` | empty |

Elsewhere at this same base I measured: `go test ./...` exit 0, **10 packages ok, 0 failing
tests**; `go vet ./...` exit 1 with **exactly 4** pre-existing copylocks in
`internal/server/server.go` at 1500/1610/1818/1995, all `assignment copies lock value to
ephReq: …contains sync.Mutex`; `cd web && npm test` exit 0.

`internal/server` has a `TestWatchTasks*` flake at roughly **8% per full-suite run**
`[MEASURED-BY-test-194-r8]` — **and it fired on my very first run in a sibling clone tonight.**
My `grep -c '^FAIL'` said 3; it was **one** test, `TestWatchTasks_NoInitial`, and the 3 was
output lines. Five re-runs came back clean. **Read failing test NAMES, never counts, and
re-run any `TestWatchTasks*` failure before believing it.**

---

# YOUR JOB IS TO MEASURE, NOT TO FIX

**Do not change production code. Do not write a fix. Do not open a fix branch.**

This is a deliberate instruction from the coordinator, in these words:

> *"Yes, open it as a security track, but verification-first, not fix-first. I don't want to
> prioritize based on an unverified description, **including yours**. Stand up an investigator
> to measure all five with the same rigor as everything else tonight before anyone scopes a
> fix."*

The "including yours" is aimed at me, and you should read it as licence. Everything below is
a **hypothesis I am relaying from someone else's report.** None of it is my measurement. If
you come back and tell me three of the five are over-claimed, that is a **successful** outcome,
not a disappointing one — it means nobody spends a night fixing a non-problem, which is
exactly what this project has done before.

You may write throwaway probe code, test harnesses, and scratch programs to establish facts.
**Revert every experiment** and assert `git status --porcelain` is empty when you are done.

## How to treat this brief

Tags: `[MEASURED]` = I ran it. `[MEASURED-BY-<leg>]` = relayed, **re-measure**.
`[BELIEVED]` = neither. Almost everything below is `[MEASURED-BY-audit-195-r9]`.

**My briefs have contained at least one error in twelve consecutive rounds.** Listing every
place this brief is wrong is a **required deliverable**.

**Tonight's error is the one to learn from:** I relayed a leg's `[MEASURED]` fact into a brief
for a different base — where the file it described **does not exist at all.** A measurement is
indexed to a tree. Re-base every claim below before you trust it, including the line numbers.

---

# Provenance

`audit-195-r9` is an independent security audit of an unrelated workstream. While establishing
that workstream's blast radius it traced the surrounding trust boundary and surfaced five
adjacent findings, explicitly declining to escalate them itself:

> *"Per my role's composition rules I do not invoke other specialists; these go to the manager
> to route. They are here because §1's blast radius depends on them and a rating cannot be
> honest without stating them."*

That is a correct handoff and it is why these are unverified: they were **observations made in
passing**, not the object of the audit. They have had no mutation testing, no positive
controls, and no exploitability work. That is your job.

The auditor's own ranking: *"F7e is the one I would raise first — it is a repo-wide belief that
a control exists when it does not."* **Treat that as a hypothesis about priority, not a
finding.** One of your deliverables is your own ranking, which may disagree.

---

# The five claims, verbatim, with what I want established for each

For **every** one of the five, produce:

- **VERDICT**: `CONFIRMED` / `REFUTED` / `CONFIRMED BUT NARROWER THAN DESCRIBED` /
  `UNRESOLVED (say what would resolve it)`. **"UNRESOLVED" is a legitimate and valuable
  answer.** Do not upgrade a code reading into a confirmation.
- **The evidence**, with a **positive control** for every negative result.
- **PRECONDITIONS**: what must be true of a deployment for this to be reachable? An issue that
  requires an env var nobody sets is a different problem from one that is on by default.
  **Check the repo's own deployment configuration** (Dockerfile, any cloud build/run config,
  scripts, docs, `.env` samples) for what is actually set. **I have not inspected production
  and neither should you** — confine yourself to what is in this tree, and say so.
- **SEVERITY with justification**, and explicitly: is this reachable by an attacker *outside*
  the IAP boundary, *inside* it, or only by an operator?

## F7a — `FARMTABLE_OPEN_ACCESS=1` fails open

`internal/cli/dashboard.go:81-84` + `internal/server/auth.go:112-114`
`[MEASURED-BY-audit-195-r9]`:

> `FARMTABLE_OPEN_ACCESS=1` leaves `lookup == nil`, and the interceptor then returns
> `handler(ctx, req)` before setting `authEnforcedKey` — so `RequireIdentity`, `RequireScope`
> and `RequireCollectionAccess` all fail open. One env var makes the API world-writable.

This one is **end-to-end measurable and I want it measured end to end, not read.** Build the
binary, start it with and without the env var, and issue a real unauthenticated write. The
question "does `RequireScope` return nil" is a code question; "can an unauthenticated caller
create or mutate a task" is the question that matters. **Both arms** — the run *without* the
env var is your positive control, and if it also succeeds you have found something bigger than
F7a.

Also establish: is this env var documented, and as what? A deliberate, documented local-dev
escape hatch is a very different finding from an accidental bypass — **and the difference is
decided by the deployment config and the docs, not by the code.**

## F7b — bind address vs printed address

`internal/cli/dashboard.go:124` vs `:162` `[MEASURED-BY-audit-195-r9]`:

> binds `:PORT` (0.0.0.0) while printing `http://localhost:%d`. The message misrepresents the
> exposure.

Lowest stakes of the five and probably quick. Confirm the bind is genuinely all-interfaces
(observe a listening socket, don't infer from the string), confirm the printed text, and state
whether any flag or env var lets an operator bind loopback today. If the capability exists and
is merely not the default, say so — that changes the fix from "add a feature" to "change a
default", which is a much cheaper conversation to have with the repo owner.

## F7c — unconditional CORS origin acceptance

`internal/serverapp/unified.go:46-48` `[MEASURED-BY-audit-195-r9]`:

> `WithOriginFunc` and `WithWebsocketOriginFunc` both return `true` unconditionally. Combined
> with the session cookie's `SameSite: Lax`, a scripted cross-origin credentialed request is
> not blocked.

**I want you to try hard to falsify this one, and here is my specific reason.** A separate
finding in the same report says the dashboard authenticates with a **long-lived token read
from `localStorage`** (`web/src/gen/grpc-client.ts:419`). If the credential that actually
authorises a request is a bearer token from `localStorage`, then a permissive CORS policy is
**much** less dangerous than the finding implies, because an attacker's page cannot read the
victim's `localStorage` for another origin — the browser sends no credential at all, and CORS
permissiveness buys the attacker nothing beyond what an unauthenticated request already gets.
Whereas if a **cookie** is what authorises, `SameSite: Lax` is doing the work and the question
becomes exactly which request shapes Lax permits.

So the discriminating question is: **which credential does the server actually accept, and is
it attached automatically by the browser on a cross-origin request?** There may be more than
one accepted credential, and they may differ between the gRPC-web path and the asset path.
**Enumerate the accepted credential types and report the denominator.** I do not know the
answer, and I would rather have a correct "REFUTED, and here is why" than a confirmation of my
own guess in either direction.

## F7d — empty scopes as wildcard

`internal/server/scopes.go:83` `[MEASURED-BY-audit-195-r9]`:

> `len(scopes) == 0` is treated as wildcard, and `DefaultScopesForUserType`'s `default:`
> branch returns nil for an unknown user type — so a typo in a user type mints an unrestricted
> token.

Two separate claims joined by "so", and the join is the part to test. The wildcard behaviour
and the nil-returning default branch are both easy to read off the source. **The claim that
actually matters is reachability: can a user type that is not a known value ever reach
`DefaultScopesForUserType`?** Trace it from every token-minting and user-creating boundary
(gRPC, CLI, config file, import, database seed, migrations). If user type is a closed proto
enum validated at the boundary, the `default:` branch may be unreachable and the finding
collapses to a defensive-coding nit. If it is free-text anywhere — a config key, a CLI flag, an
import file — it stands.

Whichever way it goes, **report the denominator: how many paths set a user type, how many you
traced, how many validate.** Note that this project's most-repeated defect is a closed
enumeration that is incomplete, so an enumeration of paths that you cannot show is complete
should be reported as a **lower bound**, in those words.

## F7e — every `buf.validate` annotation is inert

`proto/farmtable.proto` throughout `[MEASURED-BY-audit-195-r9]`:

> every `buf.validate` annotation in the file is inert: protovalidate is never instantiated.
> This is a whole-schema false sense of validation, not just the two URL fields.

The auditor ranks this first. It is also the claim most exposed to a counting error, and there
is a live cautionary tale attached to it.

Earlier tonight, working on the URL-validation track, **I** wrote that the proto declares
`string.uri = true` on **two** fields. **The auditor independently also wrote "two" — but a
different two.** There are **four** `[MEASURED by me at 7a0f220: `grep -c 'string.uri = true'`
= 4, at lines 241, 265, 343, 633]`. The union of our two confident lists was three of four, and
the one neither of us named, `UpdateTaskRequest.remote_url`, was the actual write-boundary
field. **Two independent partial enumerations agreeing on a count is not corroboration.** Do
not inherit any count in this brief, including that one — re-measure it.

So, with real denominators:

- **How many `buf.validate` annotations exist**, broken down by constraint kind, not just a
  total. Count them with a method that cannot miss multi-line or differently-spelled forms, and
  **say what your method would miss**.
- **Is protovalidate instantiated anywhere?** A prior measurement `[MEASURED-BY-EM, needs
  re-measuring]` found zero references in `cmd/` and `internal/`, while the library is in
  `go.mod` and the generated `pb.go`. A negative grep needs a positive control — grep for
  something you know is there, in the same way, and show it hits.
- **Is validation happening by some other mechanism?** The finding is "a belief that a control
  exists when it does not." Falsify the *belief*, not just the *library call*: hand-rolled
  checks in service methods, an interceptor, store-layer constraints, database constraints.
  **A field may be validated even though its annotation is inert**, and conflating the two
  would badly misdirect the fix.
- **Then the part that turns a count into a risk assessment:** for the annotations that are
  inert *and* unvalidated elsewhere, **which ones would actually matter if violated?** A
  `min_len` on a display name is not a `uri` on something that reaches an `href`. Give me a
  short ranked list. This is the deliverable that lets the repo owner decide, and no count
  substitutes for it.

**Do not fix any of this.** Another leg is already validating URL schemes at the write
boundary. Wiring up protovalidate globally is a much larger decision that has to be made
knowing what would start rejecting — and telling us that is your job here.

---

# Scope boundaries

- **Read-only with respect to production code.** Probes and harnesses are fine; revert them.
- **Do NOT fix, and do NOT recommend a specific implementation as though it were decided.** A
  sentence on what a fix would plausibly involve, and its blast radius, is welcome and useful.
  A patch is not.
- Three fix legs are running in other clones on other branches. **Ignore them entirely**; do
  not merge, rebase, or cherry-pick anything.
- **Do not contact the repository owner.** Everything routes through me.
- **The two `href` XSS sinks and the missing CSP are already assigned elsewhere.** If your work
  touches them, note the overlap and move on.

# Verification bars

- **Exit codes come from the child process, never through a pipe.**
- **A negative claim needs a positive control** — mine included, and I gave you one above that
  cost a real error.
- **Predict before measuring**, and report the prediction next to the result. A prediction you
  got wrong is more informative than one you got right; report both.
- **A refutation is a finding.** If a claim is over-stated, say so plainly and show the
  measurement that refutes it. I would rather ship four accurate verdicts and one honest
  UNRESOLVED than five confident ones.
- **Distinguish "I read the code and it looks like X" from "I ran it and observed X".** Tag
  every verdict with which one it is. For F7a in particular, a code reading is not acceptable
  on its own.

# Final gates — child-process exit codes

`go build ./...` = 0 · `go test ./...` = 0 with **zero failing test names** (re-run any
`TestWatchTasks*` failure) · `go vet ./...` = 1 with the **same 4** copylocks and the **same
messages** · `git status --porcelain` empty.

# Deliverables — you are not done until all five exist

1. **A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/sec-verify-f7.md`** — the five
   verdicts with evidence, preconditions, severity and reachability, each tagged
   read-vs-executed.
2. **Your own ranking of the five by real risk**, with the reasoning. Say explicitly whether
   you agree with the auditor that F7e comes first. **Include any of the five you think should
   simply be closed with no action** — that is a valuable answer and I will act on it.
3. **Anything you found while looking that is NOT one of the five.** Two independent audits
   tonight landed on the same class of sink from different directions; adjacent territory is
   productive. Surface it, do not chase it.
4. **A project log entry** in `.design/project-log/`, **committed.** (This commit and the
   report are the only things you commit.)
5. **An explicit list of every place this brief was wrong** — including any line number, count,
   or file path I relayed that does not match this tree. If nothing, say so and say what you
   checked. Twelve consecutive rounds; assume there are more.

**You MUST produce all five deliverables and then mark the task complete.**

**Do NOT push.** Pushing is the manager's job and mine alone.
