# Absence-as-Permission: measured population

**Addressed to:** `farmtable-architect-auth`
**From:** security audit, via farmtable-em-hardening
**Measured at:** `7a2ad51`. Also valid at `43bd206` — checked, see §7.
**Tree state at the moment of measurement: see §2.1. Read this before quoting any number.**

**Status of every site below: LIVE.** The owner directed that the auth architecture be left
as-is; these findings are measured and transmitted to the auth design owner. That is a
disposition, not a closure. Nothing here has been patched, and this report deliberately
contains no patches — a patch would prejudge a design assigned elsewhere.

**What this is.** You are inheriting a permission model that is incomplete by design. This is
the *population* of places where that incompleteness takes one specific form. It is not a
to-do list and not a severity ranking. It is a denominator, so you can size the model knowing
how many places must change and which are load-bearing.

**Headline: 21 confirmed sites — 16 reachable, 5 latent — plus 11 unconfirmed candidates.**
The running total before this exercise was three.

---

## 1. (a) The predicate, declared before searching

The starting definition, **sharpened in three ways**. Changes stated, because they change the
count.

> **A site is a code path where an ABSENT value — nil, empty slice/string, unset environment
> variable, missing context key, missing header, missing prefix, zero value, absent config or
> absent constraint — causes the code to GRANT permission, capability, trust or authenticity,
> where the alternative reading available to it was to DENY or to ERROR.**

1. **"Grants" must be a security outcome, not merely a permissive default.** A default that
   picks a port, a label prefix or a dialect is not a site. This excludes a long benign tail.
2. **The counting unit is the code location, not the habit.** One habit in three functions is
   three sites. This is the largest single reason the number is not three: the original items
   were *clusters*, and a designer changes locations.
3. **"Trust or authenticity" is included, not only authorization.** Load-bearing: it is what
   admits S14 (skipped AES-GCM verification), which I had wrongly excluded on my first pass. §3.

**REACHABLE** = some caller can present the absence today. **LATENT** = the permissive branch
exists but every current caller guards it. Latent sites belong in the population because a
designer refactoring call sites will remove a guard without knowing it was load-bearing. They
are not in the population as vulnerabilities.

## 2. (b) Search space and denominator

A `--no-hardlinks --shared` clone from the local path `/workspace/farmtable`, at `7a2ad51`. A
fresh clone carries no untracked files, so the `.claude/worktrees/` copies that inflate counts
in the canonical tree are structurally absent rather than filtered — measured: `0` `.go` files
matching `worktrees`.

| Population | Count |
|---|---|
| All tracked `.go` at `7a2ad51` | **208** |
| − generated ORM (`internal/store/ent/`) | −68 |
| − generated protobuf (`*.pb.go`) | −2 |
| − tests (`*_test.go`) | −53 |
| − test harness (`internal/testutil/`) | −2 |
| **= in-scope, hand-written, non-test** | **83** |

Per-package: `internal/cli` 21, `internal/server` 11, `internal/platform/github` 11,
`internal/store/schema` 9, `internal/serverapp` 9, `internal/store` 6, `internal/decomposer` 6,
`internal/mcp` 2, and 1 each in `internal/streaming`, `internal/platform/beads`,
`internal/platform`, `internal/convert`, `cmd/ft`, `cmd/farmtable-server`, `cmd/decomposer`,
repo root. All 83 searched, not only the auth packages.

## 2.1 Tree state at the moment of measurement — amended disclosure

**An earlier version of this report said "tree clean". That was true before and after the run
and misleading during it,** which is the precise hole the clean-tree rule was rewritten to
address. The execution results (S1, S3–S8) were originally obtained with scratch probe
`_test.go` files present inside the measurement clone. Clean before, clean after, **dirty at the
moment of measurement.** Disclosed here rather than relabelled.

**Re-measured under the corrected protocol. All values reproduced identically.**

The prescribed remedy — measure from a separate module that only reads the target — **does not
work on this repository, and the reason is worth recording.** Go forbids an external module from
importing `internal/…`; a probe module with a `replace` directive fails at load with
`use of internal package github.com/farmtable-io/farmtable/internal/server not allowed`. Farm
Table keeps essentially all of its code under `internal/`, so read-only external measurement is
unavailable for every package in this report. This is an exception class in the rule, not a
shortcut taken here.

Strongest available substitute, used for the re-measurement:

| Clone | Role | Porcelain at every sample |
|---|---|---|
| pristine, at `7a2ad51` | all reads: greps, file counts, `git ls-files`, code reading | **empty**, sampled after each check |
| mutation, at `7a2ad51` | execution probes only | **exactly one line**, `?? internal/server/zz_probe_test.go` |

In the mutation clone the **tracked tree is provably unmodified** — `git diff --stat` empty at
every sample, `git diff --cached` empty — so the dirt is one named untracked file and nothing
else. Porcelain and `git diff --stat` were sampled after **each** of the five probe runs, not
once at the end. The dirt is the point: the probe is the instrument.

Structurally immune to the dirt regardless: the 208 / 83 denominators come from `git ls-files`,
which lists tracked files only and cannot see an untracked probe.

Verbatim re-measured output, mutation clone, `7a2ad51`:

```
S1  nil lookup:                    handlerCalled=true  err=<nil>
S1  CONTROL non-nil, no creds:     handlerCalled=false err=Unauthenticated: authentication required
S3  bare ctx RequireScope          err=<nil>
S6  enforced + EMPTY scopes        err=<nil>
S6  CONTROL enforced + [task:read] err=PermissionDenied: missing required scope "task:write"
S4  bare ctx RequireCollAccess     err=<nil>
S7  enforced + EMPTY coll list     err=<nil>
S7  CONTROL enforced + [other]     err=PermissionDenied: token not authorized for collection …
S5  bare ctx RequireIdentity       id=00000000-0000-0000-0000-000000000000 err=<nil>
S5  CONTROL enforced ctx           id=388d9827-… err=<nil>
```

Every control denied; every absence granted. The re-measurement also **plants
`authEnforcedKey` the way production does** — by running the real `TokenAuthInterceptor` with a
non-nil lookup and capturing the context the handler sees — rather than by reaching for the
unexported key. That is a fidelity improvement over the original probe, not merely a hygiene
one.

## 3. (c) Exclusions, with reasons — this list is part of the result

| Excluded | Why |
|---|---|
| `internal/store/ent/` (68), `*.pb.go` (2) | Generated. Absence semantics are the generator's. Not actionable by an auth architect. |
| `*_test.go` (53), `internal/testutil/` (2) | Not a runtime trust boundary. |
| Web frontend (TypeScript) | Not a trust boundary; the server re-checks. Excluded by predicate, not oversight. |
| `deriveSessionKeys` — unset `FARMTABLE_SESSION_KEY` → random key | **Denies.** Sessions do not survive restart or validate across replicas. Absence causes denial. |
| `ParseAuthMode("")` → `AuthModeToken` | The default is the *enforcing* mode. |
| `NewGRPCWriter` empty token/server → error | Absence errors. Positive, §8. |
| `IAPAuthenticator` empty `Audience` | **Denies, measured** — §8. Excluded explicitly because a comment in the tree claims the opposite. |
| `extractToken` empty return | Every caller rejects `""`. Listed so it is not re-flagged as a gap. |
| `mcp` `authCtx` empty token → unauthenticated RPC | Client-side omission. It does not *grant*; the server decides. Fails the predicate. |
| grpc-web `WithOriginFunc(func(string) bool { return true })` | Unconditional permit — the input is never read, so no *absence* is misread. Named because it is a real CORS finding someone should own, but it is a different defect class. |
| `ScopeTokenManage` declared, never enforced | **Counter-correction, §6.** |
| GitHub rate-limit header absence | Abuse/availability control, not authorization. |
| ~30 benign nil-guards (`graph.go`, `output.go`, `convert.go`, `beads.go`) | Data shaping. No security outcome. |
| CI vacuous-pass class | Absence as *evidence*, not permission. Adjacent, §6. |

**One exclusion I reversed.** On my first pass I excluded the whole credential-encryptor family
as "confidentiality, not permission". Too broad: `Decrypt` skipping AES-GCM verification is an
**authenticity** failure, and my own predicate names authenticity. S14 is now a site. The
unset-key case (encryption silently off) stays excluded as confidentiality; §6.

## 4. (d) The population: 21 confirmed sites

Instruments: **X** = executed with a positive control · **R** = code read at `7a2ad51` ·
**G** = grep (code-shape and intent-comment, two different signals) · **I2** = independently
surfaced by a second sweep run without sight of my list, then confirmed by me.

### Reachable (16)

| # | Identifier | File | Absent value | What absence grants | Inst. |
|---|---|---|---|---|---|
| S1 | `TokenAuthInterceptor` | `server/auth.go` | the `TokenLookup` (nil) | Every unary RPC unauthenticated — returns `handler(ctx,req)` before any check | **X** |
| S2 | `TokenAuthStreamInterceptor` | `server/auth.go` | same | Same for streaming (`WatchTasks`) | R |
| S3 | `RequireScope` | `server/scopes.go` | `authEnforcedKey` missing | Every scope check returns nil | **X** |
| S4 | `RequireCollectionAccess` | `server/scopes.go` | same | Every collection restriction returns nil | **X** |
| S5 | `RequireIdentity` | `server/auth.go` | same | Mutating RPCs proceed with `uuid.Nil`, no error | **X** |
| S6 | `RequireScope` | `server/scopes.go` | `len(scopes)==0` | Wildcard. **Fires even when auth IS enforced** — distinct from S3 | **X** |
| S7 | `RequireCollectionAccess` | `server/scopes.go` | `len(allowed)==0` | All collections. Distinct from S4 | **X** |
| S8 | `DefaultScopesForUserType` | `server/scopes.go` | unrecognised **or empty** type (`default:`) | nil → wildcard via S6 | **X** |
| S9 | `UserProvisioner.checkDomain` | `serverapp/provisioning.go` | `FARMTABLE_ALLOWED_DOMAINS` unset | `return nil // all domains allowed` — any email domain provisions an account | R |
| S10 | `IAPAuthenticator.Authenticate` + `iapMiddleware` | `serverapp/iapauth.go`, `unified.go` | `X-Goog-IAP-JWT-Assertion` header | `nil, nil` → `next.ServeHTTP`. Omitting the header is a fall-through, not a denial | G+R |
| S11 | `UserProvisioner` active-user loop | `serverapp/provisioning.go` | any user with `Status=="active"` | `if len(users)>0 { return users[0] }` — a **suspended or blank-status account is logged in anyway** | R+**I2** |
| S12 | `EntStore.CreateUser` | `store/entstore.go` | non-empty `p.Type` | Unconditional `SetType(p.Type)` **overrides the schema's `.Default("agent")`**, persisting `""` → S8 → wildcard | R+**I2** |
| S13 | `newTokenCreateCmd` | `cli/token.go` | `--scope`, when `DefaultScopesForUserType` returns nil | `p.Scopes` stays nil → stored NULL → wildcard via S6 | R+**I2** |
| S14 | `CredentialEncryptor.Decrypt` | `store/crypto.go` | the `enc:v1:` prefix | `if !IsEncrypted(ciphertext) { return ciphertext, nil }` — **AES-GCM verification skipped entirely**; stored bytes trusted verbatim. DB-write access defeats authenticity by stripping a prefix | R+**I2** |
| S15 | `matchesFilter` | `streaming/eventbus.go` | `event.GetTask()` nil | `return true` — delivered to **all** subscribers, crossing the per-collection filter. Tenant isolation | R+**I2** |
| S16 | `stageSet.contains` | `server/transitions.go` | nil set | `if s == nil { return true }` — a rule with an unpopulated from/to set permits every stage | R+**I2** |

S1 measured with control: `TokenAuthInterceptor(nil)` → `handlerCalled=true err=<nil>`; same
interceptor, non-nil lookup, no credentials → `Unauthenticated`. S3–S8 measured on a bare
context; controls (restrictive scope set, real collection list, recognised type) returned
`PermissionDenied` / correct scopes. **Every control denied**, so the grants are real, not a
harness artifact.

**New detail from the re-measurement, on S8.** The recognised vocabulary is only three values:
`agent` → `[task:read task:write task:claim collection:read]`, `human` → `[*]`, `admin` → `[*]`.
Everything else falls to `default:` → nil → wildcard via S6 — including `""` **and `service`**.
`service` is not a typo; it is the kind of type name an operator would reasonably expect to
exist, and it silently yields wildcard. The failure mode is therefore not only "misspelling" but
"plausible-but-unimplemented", which is a materially larger input space for the designer to
consider.

S1's trigger, plainly: in `cmd/farmtable-server/main.go` `lookup` stays nil when
`FARMTABLE_OPEN_ACCESS=1` **or when `FARMTABLE_TOKEN` is merely unset** — the latter emits only
`WARNING: FARMTABLE_TOKEN not set — server running in open access mode`. One is a deliberate
switch; the other is a missing variable. Same code path.

### Latent (5)

| # | Identifier | File | Absent value | Would grant | Why latent |
|---|---|---|---|---|---|
| L1 | `ScopesFromContext`, `CollectionIDsFromContext` | `server/scopes.go` | failed type assertion (`, _`) → nil | nil feeds S6/S7 as wildcard | Only this package writes those keys |
| L2 | `isLocalhost` | `cli/connect.go` | `host==""` → true | Plaintext gRPC, bearer token in clear | Caller `dialServer` reached only when `server != ""` |
| L3 | `isLocalhost` | `decomposer/writer.go` | same (duplicated impl) | same | `NewGRPCWriter` errors on empty server first |
| L4 | `GitHubPassThroughStore.LookupToken` | `platform/github/passthrough.go` | any stored token record | **Fabricates a valid `ent.ApiToken` for any hash** — random `UserID` satisfies S5, nil `Scopes` wildcard via S6, nil `CollectionIds` all-collections via S7, nil `ExpiresAt` never expires | `MultiStore.LookupToken` hard-routes to `m.primary`, so the server binary does not reach it |
| L5 | `startGitHubPassThrough` | `cli/connect.go` | any interceptor on `grpc.NewServer(...)` | `authEnforcedKey` never planted → S3/S4/S5 for every RPC on that listener | Serves on a **`bufconn`** in-memory listener — no socket, not reachable on-host or off-host (measured in the prior token-write audit) |

**L4 deserves attention above its tier.** It is the most dangerous function in the repo and one
routing decision away from live. It is latent only because `MultiStore` discards the resolution
and returns the primary store — i.e. one absence-driven fallback is what neutralises another.
That is not a safety property anyone designed; it is a coincidence, and it will not survive a
`MultiStore` refactor.

## 5. Unconfirmed candidates — surfaced by the second sweep, NOT independently confirmed by me

Listed so the population is not silently truncated at what I had time to verify. Each is
plausible under the predicate and **each needs confirmation before anyone relies on it.**
Tag: **UNCHECKED by me at `7a2ad51`.**

`EntStore.CreateAPIToken` (empty slices leave NULL columns → S6/S7) · `decryptLinkedAccount`
(nil encryptor returns ciphertext untouched) · `SessionManager.handleGetSession` (nil `sm.lookup`
skips the revocation/expiry re-check, so a revoked session keeps working) · `TransitionScope`
(unrecognised transition falls back to the weakest scope, `ScopeTaskWrite`) ·
`credmonitor.checkAccount` (no validator for a platform → account stays `active` and trusted) ·
`isDefinitiveAuthError` (an auth failure phrased without `401/403/unauthorized/forbidden` leaves
the account trusted) · `MultiStore.storeForCtx`/`lazyResolve` (every failure returns the primary
store) · `unified.go` auth-mode wiring (nil `o.Store`/`o.TokenLookup` silently no-ops the
configured mode and serves anyway) · `github.LoadConfig` (missing config file →
`Enabled: true, AutoCreateLabels: true`) · `resolveLinkToken` (absent token → `""`, plus
`inferAuthMethod` defaulting to `AUTH_METHOD_PAT`, asserting a credential type never observed) ·
`ImportCollection` type/status trusted from the uploaded document.

**Confirmed floor 21; plausible ceiling 32.** For planning, use 21 and treat the rest as
unpriced.

## 6. Chains, counter-corrections, adjacent classes

**The user-type chain (strengthened).** S8 is usually described as an operator typo
(`"reviewr"`). It is worse, because the vocabulary has **no constraint anywhere**:
`schema/user.go` declares `field.String("type").Default("agent")` — free string, no enum, no
validator; S12 shows the unconditional `SetType` **defeats even that default**, persisting `""`;
`ImportCollection` writes `Type: exported.Type` straight from an uploaded document; S11 returns
an existing user with its stored type uncorrected; `CreateSessionToken` feeds it to S8 → nil →
wildcard via S6. So an empty or attacker-chosen user type mints **wildcard** session tokens for
a legitimate person at their next login. Import requires `collection:admin`, so this is an
authenticated-actor or operator-error path, not anonymous. Each link **MEASURED**; the
end-to-end chain **DERIVED** — not executed, and it should be executed before anyone relies
on it.

**Counter-correction to the second instrument.** The sweep reported `ScopeTokenManage` as
declared-but-never-enforced and concluded "token-management RPCs are reachable by any token".
The first half is confirmed by two instruments: `token:manage` appears only in `scopes.go`
(declaration + `AllScopes`), one test, and one design doc — **zero** enforcement call sites. The
conclusion does not follow: there are **no token-management RPCs on the gRPC surface at all**
(`grep "func (s \*Server) .*Token" server.go` → 0 hits). Nothing is granted. It is a scope that
exists in the vocabulary, can be granted, and gates nothing — a completeness hazard for you as
designer, not a live grant. Excluded from the count.

**A conflict between my own two instruments, resolved rather than averaged.** I had cited
`cli/token.go` as a *positive* (it refuses to write an empty scope set, naming the reason). The
sweep reported the same file as a *site*. Both are right, about different functions:
`resolveScopeMutation` guards the **mutation** path, while `newTokenCreateCmd` (S13) leaves
`p.Scopes` nil on the **create** path. One file both defends against empty-as-wildcard and
manufactures it. That asymmetry is probably the most instructive artifact here for anyone
designing the replacement.

**Adjacent, deliberately outside the count.** *Absence as confidentiality waiver:* unset
`FARMTABLE_ENCRYPTION_KEY` → encryption silently off, while a *malformed* key correctly
`log.Fatalf`s ("refusing to start with plaintext credential storage when encryption was
intended"). Absent and invalid treated as different in kind — worth revisiting. *Absence as
evidence of correctness:* `scripts/ci-suite-manifest.mjs` fights exactly this pattern in the
build system and names it — "a check that cannot see is not a check that passes". The habit is
not confined to auth; CI has prior art. (Not touched, per instruction.)

## 7. SHA discipline — the enumeration does not age silently

The standing "`go vet` is unusable here" rule was retracted mid-task. I re-measured rather than
accept either version. `ROOT=/tmp/ft-audit`, `go list ./... 2>/dev/null | wc -l`:

| SHA | packages | first error |
|---|---|---|
| `7a2ad51` | **0** | `assets.go:5:12: pattern all:web/dist: no matching files found` |
| `43bd206` | **32** | none |

Retraction **confirmed**; build tooling is usable from `43bd206`. The caveat was *true as
measured* at `7a2ad51`, so it is recorded as SHA-anchored rather than as having been wrong.

**Correcting my own error in an earlier draft of this file.** I wrote that the denominator "is
32, not 33" and attributed 33 to the RPC-method count. That was wrong. **Main is 32 of 32; the
XSS branch is 33 of 33** — the branch carries `internal/webguard`, a package main does not have.
Both are correct for their own tree. My "correction" would have corrupted a correct number. The
rule that catches it is *cite the tree with the number*, which I had failed to do.

**Does `43bd206` stale this report? No — checked, not assumed.** Four `.go` files differ between
`7a2ad51` and `43bd206`: `assets.go` plus the two call sites migrating to `farmtable.WebUI()`,
and `internal/server/server.go`, whose entire Go diff is the copylock quartet moving from `*req`
to `proto.Clone(req)`. **None touches any enumerated site.** All 21 stand at `43bd206`.

## 8. Positive exemplars — the inverse habit, already in this tree

Design vocabulary you can build on. Each reports absence instead of trusting it.

- **`WebUI()` / `ErrWebAssetsNotBuilt`** (`assets.go`, at `43bd206`). Stats `index.html` and
  returns a named error when only the placeholder is embedded, rather than serving a blank
  dashboard. The cleanest template in the repo: *distinguish "never provided" from "provided and
  valid", and give the former its own error.* If the permission model adopts one pattern from
  this report, adopt this one.
- **Empty IAP `Audience` denies.** Measured with a control: empty → `iap: audience mismatch: got
  [...], expected ""`; correct audience on the same path → accepted. Flagged because `main.go`'s
  fatal guard justifies itself with *"without it, audience binding is disabled and any valid IAP
  JWT would be accepted"* — describing behaviour the code does not have. The guard is still
  right to fail fast; only its stated reason is wrong. The habit is being **over-attributed in
  comments**, which is its own drift.
- **`cli/token.go` `resolveScopeMutation`** refuses to write an empty scope set and refuses
  `--add-scope` on a legacy nil-scope token, naming the hazard. The CLI already treats
  empty-as-wildcard as something to guard at the boundary. The server does not, and the same
  file's create path does not — §6.
- `NewGRPCWriter` errors on an absent token instead of proceeding unauthenticated.
- `collectionSupportsGraph`: unknown platform → `false`.
- Token comparison uses `subtle.ConstantTimeCompare`.

## 9. (e) Do the original three survive this predicate?

**All three survive. None is retracted.** But the arithmetic does not come out at three:

| Item | Verdict | Sites |
|---|---|---|
| 1 — unset `FARMTABLE_TOKEN` nils the lookup | Survives | **S1, S2** (unary and stream are separate locations) |
| 2 — absent `authEnforcedKey` soft-passes the three checks | Survives | **S3, S4, S5** |
| 3 — unrecognised user type → nil scopes → wildcard | Survives, **with a correction** | **S8** — but S8 grants nothing alone; it grants *via* **S6**. It is a two-step and **S6 is the load-bearing half**. S12 also shows the trigger is broader than "unrecognised": the empty string reaches it by defeating the schema default |

Those three account for **6 of 21** sites. **Fifteen are new**, and the two most consequential
are not in the auth package at all: **S14** (skipped credential authenticity) and **S15**
(tenant isolation bypass on a nil task). An enumeration confined to `internal/server` would have
missed both.

One refinement on item 1, bearing on the design: `FARMTABLE_OPEN_ACCESS=1` is the *presence* of
an explicit opt-out and does not meet the predicate, whereas an unset `FARMTABLE_TOKEN` does.
They currently share one code path. Separating "the operator asked for open access" from "the
operator forgot a variable" is the smallest change with the largest effect on this population —
and it is a design decision, which is why it is described here and not patched.

## 10. Method notes

- Instrument kinds, deliberately different: code-shape grep, intent-comment grep, execution with
  positive controls, and an independent second sweep run without sight of my site list. No
  negative here rests on a single grep; the `ScopeTokenManage` negative took two.
- The second sweep raised my count from 13 to 21. I confirmed each promotion at `7a2ad51` rather
  than adopting its list, **rejected one of its conclusions** (§6), and parked eleven of its
  items as explicitly unconfirmed (§5) rather than absorbing them into a headline figure.
- Controls validate the instrument, never the substrate: in §4 every control **denied**; in §8
  the empty-audience control **accepted** on the matching-audience path. A probe that cannot
  produce both outcomes proves nothing.
- Every count carries its denominator: 208 tracked → 83 in-scope; 21 confirmed = 16 reachable +
  5 latent; 11 unconfirmed; original 3 → 6 sites, 15 new. Package counts cite their tree (§7).
- Tree state is disclosed in **§2.1**, including the amended "clean tree" claim, the
  `internal/`-package exception that makes read-only external measurement impossible here, and
  per-check porcelain sampling. Nothing created in `/workspace` except the project-log entry;
  nothing staged, committed, or pushed. No production code written, no site patched, no test
  manifest regenerated, `scripts/ci-suite-manifest.mjs` not touched.
- Citations are by identifier, not line number.
