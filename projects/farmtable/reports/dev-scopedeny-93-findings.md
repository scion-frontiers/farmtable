# scopedeny-93 — measurements on user-type and scope handling

**To:** `farmtable-architect-auth`
**From:** `dev-scopedeny-93` (app-layer hardening track, leg 1 of 3)
**Date:** 2026-07-29
**Status:** LIVE FINDING. Owner directed that the auth architecture be left
as-is; measured and transmitted to the auth design owner. This is a
disposition, not a conclusion. Nothing here has been landed.

**Branch (unmerged, unpushed):** `hardening/deny-unrecognised-type`
**Clone:** `/workspace/dev-scopedeny-93`
**Tip:** `1cbf643` · **Base:** `faf1c8c` · `origin/main` at time of writing: `7a2ad51`

Every claim names the SHA it was measured at. Anything attributed to `faf1c8c`
was re-derived by me in a throwaway worktree, not copied from a briefing.

---

## Owner input — his words, not my recommendation

Transmitted verbatim, in full, both directions:

> "any unrecognized type is a pretty severe bug. these can be suddenly blocked."

The two halves pull against each other and the tension is the point: an
unrecognised type must be refused, **and** refusing it can suddenly block real
principals. I am passing on the ruling with the tension intact rather than a
tidied version of it. Nothing below resolves that tension; the measurements are
offered so that whoever does resolve it can see what it costs either way.

---

## The finding that halted this on engineering grounds

Measured at `faf1c8c`. This is the one to read first, because it says a
rejection change is not merely premature but points the wrong way on the widest
path in the system.

**`internal/serverapp/provisioning.go:92` hardcodes `Type: "human"` for every
OAuth/IAP-provisioned user.** Confirmed by direct inspection at `faf1c8c`.

**`"human"` resolves to `ScopeWildcard`** — as do `"admin"` and
`"service_account"`. So every SSO user is wildcard from first login.

**The restricted tier is close to unreachable.** At `faf1c8c`, each of
`"admin"`, `"reviewer"`, `"orchestrator"` and `"viewer"` appears in exactly one
non-test, non-generated Go file, and in every case that file is
`internal/server/scopes.go` — their own switch arm. Nothing in the tree ever
writes them:

```
admin        -> internal/server/scopes.go
reviewer     -> internal/server/scopes.go
orchestrator -> internal/server/scopes.go
viewer       -> internal/server/scopes.go
```

**What this does to a rejection change, path by path** (all at `faf1c8c`):

| Path | Type it supplies | Effect of refusing unrecognised types |
|---|---|---|
| OAuth/IAP, **new** user | always `"human"` | **No-op.** The type is hardcoded and always recognised. |
| OAuth/IAP, **existing** user | **the stored type, whatever it is** | **This is the lockout.** `FindOrCreateByEmail` returns the existing row unchanged, so a stored type outside the vocabulary reaches `CreateSessionToken` and the login is refused outright. |
| `ft token create` / `ft user create` | operator-supplied `--type` | **Not a no-op** — this is where a rejection has value, catching a typo before it persists. |

I want to correct one thing I was briefed, because it inverts the risk. I was
told the ordered change is "a no-op on the CLI path and a regression on OAuth
and IAP". Measured at `faf1c8c`, it is closer to the reverse for the rejection
half: it is a **no-op for new SSO logins** (type hardcoded `"human"`) and it
**has its value on the CLI path**. The OAuth/IAP regression is real but narrower
and conditional — it strikes **existing** users whose stored type is outside the
vocabulary.

Relatedly, `CreateSessionToken` at `faf1c8c` passes
`DefaultScopesForUserType(userType)` straight through, so a `"human"` session
token is minted with an explicit `["*"]` — **not** an empty set. Session tokens
are therefore not part of the empty-scope population described in (c). That
narrows the blast radius of the empty-scope half specifically, and it is worth
knowing before anyone assumes SSO tokens are exposed to it.

The consequence for design: **the size of the OAuth/IAP lockout is exactly the
size of the existing-user population carrying a non-vocabulary type.** That is
question (c), which is why (c) is the deciding measurement and not a footnote.

---

## (a) Do both halves need to change? — a finding about the code

**Yes, and they are coupled.** Stated as a property of the code at `faf1c8c`,
not as a plan.

Two cooperating reads in `internal/server/scopes.go` at `faf1c8c`:

```go
// half 1 — RequireScope
// nil/empty scopes = wildcard (backward compatible with existing tokens)
if len(scopes) == 0 { return nil }

// half 2 — DefaultScopesForUserType, default arm
log.Printf("WARNING: unrecognized user type %q ... granting wildcard scopes (backward compat)", userType)
return nil // nil = wildcard (backward compatible)
```

Half 2 emits `nil`; half 1 reads `nil` as allow-everything. Neither is harmful
alone. Together, a typo in `--type` yields full admin.

**Measured escalation at `faf1c8c`** (ROOT=`/tmp/wt-faf1c8c`, DIST=absent):

```
VULNERABLE: type "reviewr"   -> scopes [] -> collection:admin GRANTED
VULNERABLE: type "superuser" -> scopes [] -> collection:admin GRANTED
VULNERABLE: type "Admin"     -> scopes [] -> collection:admin GRANTED
VULNERABLE: type ""          -> scopes [] -> collection:admin GRANTED
```

**The asymmetry between the halves, which I tested rather than assumed.**
Changing half 1 alone already stops the escalation: with empty no longer read as
wildcard, the bad token is inert. Half 2's distinct contribution is **not**
security — it converts a *silently dead token* into a *loud refusal to mint
one*. Changing half 1 alone would be secure and unusable; changing half 2 alone
would be cosmetic, because the permissive read would still be there.

A warning in a log is not an access control. At `faf1c8c` the default arm logs
and then grants.

**One thing that must not be made symmetric.** `RequireCollectionAccess` looks
like it wants the same treatment and must not get it. Collection IDs are a
*restriction* list where empty means unrestricted; scopes are a *grant* list
where empty means nothing. Applying the scope rule there would lock every user
out of every collection. This is the kind of asymmetry a future reader "tidies".

---

## (b) What each option would have cost

Framed as costs and the measurements bearing on them. No recommendation.

| Option | What it would have cost | Measurement bearing on it |
|---|---|---|
| Land both halves as-is | Dead-keys every scope-less token at once, with no sweep to carry them across | 19 of 19 tokens in the measured database carry NULL scopes (see (c)) |
| Land half 1 only | Stops the escalation; leaves unrecognised types minting silently dead tokens, diagnosable only at first use | Tested: half 1 alone blocks all four escalation cases |
| Land half 2 only | Cosmetic. The permissive read remains, so the escalation stands | Tested: the escalation travels through half 1 |
| Land with a name-scoped repair | Reaches CLI-owned tokens only; leaves out-of-band tokens denied | 18 of 19 reachable by name; `dashboard-f69` is not |
| Land with a blanket repair | Restores wildcard to every token ever issued — reintroduces the escalation under a friendlier name | Not attempted; stated as a cost |

Three measurements that bear on any of these:

- **A rejection change is a no-op for new SSO logins** and has its value on the
  CLI path — see the section above. Any cost model that assumes it hardens the
  OAuth path is measuring something the code does not do.
- **`ft token list` at `faf1c8c` omits the scopes field when the set is empty**
  (`internal/cli/token.go`). Whichever direction is chosen, an operator cannot
  currently enumerate which of their tokens hold no scopes. Any migration needs
  this primitive before it needs anything else.
- **`ft token update` at `faf1c8c` already ships an `UNSCOPED_TOKEN` guard rail**
  describing "a token with no stored scopes (legacy wildcard)". That is the
  codebase's own written acknowledgement that this population exists in deployed
  databases. It did not have to be inferred.

---

## (c) Enumeration of non-vocabulary type values

The deciding measurement, per the owner's "these can be suddenly blocked".

**Instrument.** No `sqlite3` binary exists in this environment. I copied
`/workspace/.farmtable/farmtable.db` (3,194,880 bytes, mtime 2026-07-28 12:30)
to `/tmp/popsnap.db` and queried the copy read-only with a throwaway Go program
using `mattn/go-sqlite3`. Schema and code paths inspected at `faf1c8c`; the data
is a snapshot and not tied to a SHA.

**Population — user types:**

```
== users.type population ==
  type="agent"              count=1
```

**Zero non-vocabulary type values. n=1 user.** I want to be blunt that a clean
result over one row is not evidence the wild is clean. It is a very small
sample, honestly reported, and it should not be read as reassurance.

**Population — token scopes:**

```
== api_tokens scopes population ==
  name="dashboard-env"      scopes=<NULL>   count=17
  name="dashboard-f69"      scopes=<NULL>   count=1
  name="local-embedded"     scopes=<NULL>   count=1
```

**19 of 19 tokens hold NULL scopes.** Not a marginal population — the entire
one. Any change making empty mean "nothing" denies every token in this database
on the first call after upgrade.

**Corroborated independently at `faf1c8c`** (ROOT=`/tmp/wt2`, DIST=present),
running the real `ensureLocalUser` against a real store:

```
token name="local-embedded" scopes=[] len=0
token name="dashboard-env"  scopes=[] len=0
```

Every developer who has run `ft connect` or `ft dashboard` has two.

`dashboard-f69` is the significant row. I grepped the tree: **no code path in
this repository generates that name.** It was created out-of-band. It is the
concrete instance of the class a name-scoped repair cannot reach, and it is 1 in
19 in the only real database I have.

**Import — a producer I cannot measure, per instruction to include it.**
`ImportCollection` writes `imported.Type` verbatim with no validation at any
layer: `internal/server/export_import.go:585` → `internal/store/entstore.go:2102`,
both re-read by me at `faf1c8c`. Free-form at the persistence layer too —
`internal/store/schema/user.go:19` is `field.String("type").Default("agent")`,
no enum constraint.

One qualification I checked rather than assumed, and it cuts in the reassuring
direction: **`export_import.go` contains no `ApiToken` references at all.**
Import creates users but never tokens. So an imported user with a bad type lands
in the "account that cannot mint a token" class — a loud refusal at
`ft token create` — and **not** in the "suddenly blocked" class, *unless* that
user also logs in via OAuth/IAP, in which case the existing-user path in the
first section applies and the login is refused. That intersection —
**imported users with non-vocabulary types who authenticate via SSO** — is the
population that decides whether any future change blocks live principals. I
could not measure it here; it is n=0 in a 1-user dev database, which
establishes nothing.

**A correction I owe upward.** I was given `entstore.go:2102` as the ingestion
site. Another leg found three `SetType` call sites (2102, 2139, 2219). I did not
verify the other two — not my file, owned by `dev-import-hardening` — but I
flag it because it matches the pattern I was warned about: a single line number
is a lower bound, not a location. Treat the ingestion surface as at least three
sites.

---

## Evidence artefact: the branch

Held unmerged and unpushed. The value is the red-then-green canaries: each
oracle was committed and demonstrated RED before the change that turned it
GREEN, so the branch is direct evidence of what the defect is and what would
close it.

| SHA | Role |
|---|---|
| `02e68f6` | oracle: empty scope set must grant nothing |
| `79f442a` | change: half 1 |
| `7c324cb` | oracle: unrecognised type must yield no authority |
| `99097de` | oracles: the three mint paths (CLI token, CLI user, OAuth session) |
| `c8be951` | change: half 2, plus the three call sites the signature change forces |
| `bb34c5c` | oracle: a database that worked before must still work after |
| `32aa843` | change: name-scoped repair of CLI-owned tokens |
| `ff3542c` / `0b6d67e` | oracle + change: `ft token update` help stated the pre-change rule |
| `49b3542` / `ee28a99` | oracle + change: `ft token list` hid empty scope sets |
| `22dbfaf` | **pin only** — characterises what each named arm returns today |
| `1cbf643` | repairs a compile break in the branch's own history (below) |

**`22dbfaf` is worth keeping whatever is decided.** It pins the current return
of every named arm and asserts nothing about what any should return, so whenever
the SSO-privilege question is answered, the change produces a visible RED naming
the arm that moved rather than landing silently. Verified non-vacuous:
temporarily narrowing the `human` arm to `task:read` fails both pins with the arm
named; `scopes.go` restored byte-identical afterwards. The pre-existing
recognised-type test only checked for a non-empty set and would not have caught
a narrowing.

**Named arms were not altered.** Compared arm by arm against `faf1c8c`:
`admin`, `human` and `service_account` all still return `{ScopeWildcard}`. Only
the default arm differs.

### Two defects in my own evidence, stated plainly

- **The branch's middle commits do not build.** `rbac_test.go` kept the
  one-value `DefaultScopesForUserType` signature after `c8be951` moved it to two
  values. Proven at `22dbfaf` in a clean detached worktree (ROOT=`/tmp/wt-head`,
  DIST=absent): `assignment mismatch: 1 variable but ... returns 2 values`. The
  repair was sitting uncommitted in my working tree from `c8be951` onward, which
  means **every green run I reported measured the working tree, not a commit.**
  `1cbf643` records it. Only the tip is independently reproducible; verified at
  `1cbf643` in a clean worktree (ROOT=`/tmp/wt-tip`, DIST=present): build OK,
  `internal/server`, `internal/cli`, `internal/serverapp` all ok.
- **A spurious pass, caught and corrected.** My first CLI oracle passed for the
  wrong reason: it used `--user <id>`, but `ft token create` takes a positional
  argument, so cobra returned "unknown flag" and the deny assertion succeeded on
  a usage error. Corrected to positional args, which produced a genuine 4/4 RED.
  An oracle that passes for the wrong reason is worse than none.

---

## Site inventory

Sites found by searching `faf1c8c` independently, not by reading the candidate
commits. The last four are **not** in the eight candidates and are open.

| Site | Behaviour at `faf1c8c` |
|---|---|
| `server.RequireScope` | empty scope set read as wildcard |
| `server.DefaultScopesForUserType` default arm | logs a warning, then grants wildcard |
| `ft token create` | mints from the wildcard default |
| `serverapp.CreateSessionToken` | widest route, no operator in the loop |
| `ft user create --type` | only gate above a schema with no enum constraint |
| `server.userTypeToProto` (`convert.go:202`) | **open** — coerces unrecognised types to `AGENT`, *and* the valid `reviewer`/`orchestrator`/`viewer`, which have no proto enum member |
| `ft token update` help text | **open** — documents the permissive rule |
| `ft token list` | **open** — omits empty scope sets, so a scope-less token renders identically to a healthy one |
| `ImportCollection` ingestion | **open** — no validation; owned by `dev-import-hardening`; at least three `SetType` sites |

`userTypeToProto` deserves attention from the auth design owner specifically,
because it makes the model unobservable: `ft user get` reports `AGENT` for a
`reviewer`, a `viewer`, an `orchestrator`, and for any unrecognised value. Any
operator asked to diagnose a type problem is looking at a field that cannot
represent the answer. The proto enum lacks the members, so this is a schema
question, not a mapping bug.

---

## What I did not do

- Did not alter any named arm, per the fence, and confirmed arm by arm that none
  moved.
- Did not widen the token repair beyond a two-name allowlist; a blanket repair
  would restore wildcard to every token ever issued.
- Did not touch `RequireCollectionAccess`.
- Did not touch the import path.
- Did not merge and did not push.
- Noted and left alone the four pre-existing `assignment copies lock value` vet
  findings at `server.go:1500/1610/1818/1995`. **Vet delta versus `faf1c8c` is
  zero** — diffed, not eyeballed.
