# Farm Table — Auth Improvements Design

**Re-anchored:** 2026-07-29 at `43bd206`
**Original:** 2026-07-23, revised 2026-07-26 (approved by ptone@google.com)
**Author:** Architect agent (auth workstream)
**Companions:** `auth-current-state.md` (re-anchored), `reports/auth-restart-recovery-20260729.md`

> **Status change.** The original six-stage plan **has been implemented.** Stages 1–4 are
> live; Stages 5–6 are landed and **reachable in `farmtable-server`, the binary that ships**
> (corrected 29 Jul — I first reported these unreachable, having analysed `ft dashboard`).
> **All of that holds only where a token is configured** — see the note under the stage table
> and D5; unset, most of it is inert and parts of it are not even registered. This
> document is therefore no longer a build plan. Part I records what landed. Part II is a
> new design — **Stage 7, fail-closed authorization** — which corrects defects that the
> original design itself introduced.

---

# Part I — The Six Stages, As Built

| Stage | What it was | Status at `43bd206` |
|---|---|---|
| 0 | `x-farmtable-token` header (IAP-safe extraction) | **LANDED**, both entrypoints |
| 1 | Mandatory auth enforcement, reject-by-default | **LANDED**, both entrypoints |
| 2 | Web dashboard session login; `?token=` removed | **LANDED**, both entrypoints |
| 3 | Identity-aware mutations (`RequireIdentity`) | **LANDED**, both entrypoints |
| 4 | Scoped tokens & RBAC | **LANDED but unsound** — see Part II |
| 5 | OAuth / SSO / IAP proxy auth | **LANDED**, reachable in `farmtable-server` (ships) — **but OAuth login requires a configured token lookup and is not registered without one**; IAP middleware installs regardless but skips its session bridge. Not wired in `ft dashboard`. |
| 6 | LinkedAccount OAuth, refresh, monitoring | **LANDED**, reachable in `farmtable-server` (ships), **unconditionally** — its gate does not involve the lookup. Not wired in `ft dashboard`. |

> **Every "LANDED" above except stage 6 is conditional on `FARMTABLE_TOKEN` being set.**
> Unset, the interceptor passes all traffic and stages 1–4 are inert, `/api/auth/session` is
> never registered, and OAuth login is never registered. The table asserted these absolutely
> because it was written while measuring a configured server; the qualifier was missing rather
> than considered and rejected. See D5 and recovery note §3.1.

The scion pattern reference table from the original document remains accurate as a record
of provenance; the patterns were followed faithfully.

### Correction to the original Stage 4 text

The original document stated, as a migration note:

> *"Existing tokens have no `scopes` field → treated as `*` (unrestricted). No breakage."*

**This line is withdrawn.** It was implemented exactly as written and is the root of the
privilege defect in Part II. It was presented as a benign compatibility measure; it is in
fact a fail-open rule in the authorization layer. The implementer is not at fault.

---

# Part II — Stage 7: Fail-Closed Authorization

> **Incorporates the hardening track's findings package (29 Jul), received as one-way input.**
> Their measurements were taken at `faf1c8c`; the two that change my design I re-measured
> myself at `43bd206` and both hold. Severity ranking below is corrected from my first pass.

## The Tier System Is Scaffolding, Not A Defect — OWNER RULING, 29 Jul

**I called this "decorative" and a design flaw. The owner corrected me and the correction
is accepted.** His position, in his words: *"We want a token and auth machinery where roles
and permissions can be enforced. Having that basic dial-tone plumbing was a start. Having it
start as 'wildcard' permissions is a place where we can keep developing other features while
we implement actual roles."*

That is a deliberate staging choice, not an oversight. Stage 4's real deliverable was the
enforcement machinery — vocabulary, `RequireScope`, per-collection checks, wired call sites —
and that machinery is present and working. Starting every identity at wildcard keeps other
feature work unblocked while the role model is built out later. **I was reading unfinished
as broken.** The measurements below stand as a record of what remains to build; they are
not a bug list.

**One thing is explicitly carved out of that ruling and remains a live defect** — see
"The Carve-Out" below.

### What remains unbuilt (measurement, not indictment)

Verified at `43bd206`:
`admin`, `reviewer`, `orchestrator`, and `viewer` appear **zero** times in non-test,
non-generated Go outside the arms of the one `switch` in `DefaultScopesForUserType`. Only
`agent` is reachable unaided (7 sites). Every user the system provisions on its own is
`human`, and `human` maps to `*`.

So the tiers are unreachable code, and the type that decides them is a free-text column with
no validator. We built an authorization model that, in practice, issues exactly one
permission level: everything.

**And the grant table cannot express the middle even in principle.** Verified at `43bd206`:
of the ten scopes in the vocabulary, **four appear in no named tier at all** —
`collection:write`, `collection:admin`, `token:manage`, `user:read`. The tier table can only
express six. The four it cannot express are precisely the administrative ones, reachable
only by holding `*`.

This matters more than the unreachability. Making every tier assignable tomorrow would
**not** fix it: there would still be no way to describe an identity that administers
collections without also holding the whole system. There is no expressible middle — an
identity is either confined to task operations or it is everything.

Both observations are **forward-looking scope for the roles work**, not defects to fix now.
When real roles are implemented, these are the two things that must be addressed: make the
tiers assignable, and extend the tier table to express the four administrative capabilities
so a non-wildcard identity can hold them. Until then, wildcard-by-default is the intended
state.

**Process note, recorded against myself.** I first put this to the owner as a two-branch
choice — make the tiers real, or delete them. That framing presumed the answer space had two
members and that my read of the situation was correct. It was neither. The actual answer was
outside both branches. Describe the situation; let the owner answer in his own terms.

## The Carve-Out: Unrecognised Types Are Still A Defect

The owner's scaffolding ruling covers wildcard for a **recognised** type. It does not cover
wildcard for an **unrecognised** one, and he has separately ruled on that in his own words:
*"any unrecognized type is a pretty severe bug. these can be suddenly blocked."*

The distinction is the whole point:

| Input | Current result | Status |
|---|---|---|
| A recognised type (`human`, `admin`, `service_account`) | wildcard | **Intended.** Scaffolding. Leave it. |
| A recognised restricted type (`agent`) | limited scopes | Working as designed |
| An **unrecognised** value — e.g. `reviewr` | **wildcard** | **Defect.** A typo mints an administrator. |

An intentional default is a decision. Granting full authority to input the system failed to
understand is not a decision, it is an absence of one — and `type` is a free-text column with
no validator, so nothing upstream prevents it. This is the one part of the scope work that
proceeds independently of the roles roadmap.

**Fix:** the default arm rejects rather than returning `nil`. `DefaultScopesForUserType`
gains an error return; callers that cannot resolve a type fail token creation instead of
issuing an unscoped one. That is 7.1's `DefaultScopesForUserType` change and the canary
commit on the halted branch already implements the CLI half of it.

## Severity, Corrected

My first pass over-ranked the escalation defect. The correction is from the hardening track
and I have verified it:

- **Privilege delta is zero.** `ImportCollection` — the only external write path into
  `users.type` — requires `collection:admin`, which only wildcard holders have. Anyone who
  can reach the escalation already holds the ceiling. The defect is **latent, not live**.
- **The real risk is persistence, not privilege.** A planted user row with an attacker-chosen
  email is a durable wildcard credential that outlives the attacker's own account. That is
  what makes it worth fixing.
- **Owner input, his words, not our recommendation:** *"iap is in front of everything. we will
  still want to fix app layer auth on these endpoints. but there is not the same urgency."*
  **D3 is therefore downgraded** — real, worth fixing, not urgent. It also resolves my earlier
  concern about the demonstration's control: the routes are not internet-facing.
- **Owner input, his words:** *"any unrecognized type is a pretty severe bug. these can be
  suddenly blocked."* Both directions — the bug is severe, and blocking is authorized.

**One correction to my own D1 rationale.** Deny-on-empty is a **no-op for new SSO logins**:
provisioning hardcodes `human`, and `DefaultScopesForUserType("human")` returns an *explicit*
`["*"]`. SSO session tokens are not in the empty-scope population at all. D1's value is on the
CLI path and against existing tokens; **D2 is what governs SSO.** They are independent fixes
and I had them coupled.

## Problem & Goals

~~Four~~ **Five** defects, measured at `43bd206`. Three are authorization, one is packaging,
and one — **D5, added 29 Jul** — is authentication and is the broadest of them.

**D1 — Absent values are read as permission.** Three sites in `internal/server/scopes.go`
treat an empty value as a grant: `RequireScope` (no scopes → allow), `RequireCollectionAccess`
(no collection list → allow), and `DefaultScopesForUserType` (unknown type → `nil` → wildcard).
Composed, an unknown user type becomes a superuser.

**D2 — Auto-provisioning grants wildcard.** `FindOrCreateByEmail` hardcodes `Type: "human"`,
and `human` maps to `*`. Every SSO/IAP-provisioned user is an administrator, gated only by a
domain allowlist that is empty by default.

**D3 — Link-flow routes are unauthenticated.** *(= architect-reviewer's **D2**, "endpoint
writes stored access tokens with no caller permission check". Same defect, two names; verified
29 Jul as the same three callbacks. Recorded so the allowance cannot be read as covering more
than it does.)* Six `/api/link/*` routes administering external
credentials sit outside every auth layer. **Live in production** — `farmtable-server` always
resolves a non-empty `BaseURL` via its localhost fallback, so they are always registered.
Deprioritised by owner: IAP fronts them.

> **Extent of the allowance, verified 29 Jul.** Three code paths write a stored access token
> from caller input: the link callbacks (`linkflows.go:209/326/438`) and the gRPC handler
> `CreateLinkedAccount` (`server.go:1136`). **Only the first three are unguarded.**
> `CreateLinkedAccount` checks `RequireIdentity`, `RequireScope(ScopeCollectionAdmin)` and
> `RequireCollectionAccess` — it is not part of this defect and is not covered by the
> allowance, because it does not need to be. (`tokenrefresh.go:151` is a background writer,
> not caller-facing.) The allowance covers the link callbacks and nothing else.
>
> Two caveats that do not change the above. `ScopeCollectionAdmin` sits in no named tier, so
> that gate is satisfiable only by a wildcard token — see §4 of the findings doc. And like
> every in-process check, it is inert when the token lookup is nil (D5).

**D4 — The two entrypoints disagree about auth config.** `ft dashboard` does not pass
`AuthMode`, `IAPAudience`, `AllowedDomains`, or `BaseURL`; `farmtable-server` passes all four.

> **Correction, 29 Jul.** I originally wrote D4 as "the shipped container under-configures
> auth, so Stages 5–6 are dead in production." **That was wrong.** There are two Dockerfiles;
> the live service is deployed from `Dockerfile.server`, which runs `farmtable-server`. I read
> `Dockerfile` (which runs `ft dashboard`) and assumed it was the shipping artifact.
> **Stages 5–6 are reachable in production.** D4 is a dev/local consistency issue, not a
> production gap, and its priority drops accordingly.
>
> The lesson is narrow and worth keeping: tracing from the entrypoint is only as good as
> knowing *which entrypoint ships*. I applied the reachability discipline rigorously to the
> wrong binary, which produces a confident, well-evidenced, false conclusion.

**D5 — An unset env var disables authentication in the shipping binary. NO FIX IS DESIGNED
BELOW.** In `cmd/farmtable-server/main.go`, when `FARMTABLE_TOKEN` is empty and
`FARMTABLE_OPEN_ACCESS` is not `1`, the code logs a warning and leaves the token lookup nil.
A nil lookup makes the gRPC interceptor pass every request through. The entire surface is
unauthenticated — reached by the *absence* of a value, not by the deliberate open-access
switch, which is the same rule as D1 applied one layer higher and to everything at once.
`ft dashboard` does not behave this way; it is on-by-default.

The live deployment does set the variable — the hardening track measured a firing 401 on a
gRPC path. So D5 is a property of the artefact, not an observed exposure, and it is a silent
one: the only signal is a log line, and a missing env var is exactly the kind of thing that
goes missing in a new environment, a rollback, or a second region.

D5 has **no phase in §7 and no design below**, deliberately. Auth is parked; this entry exists
so the defect list is complete and correct when work resumes, not so it can be picked up.
Surfaced by the hardening track; verified here because it falsified a claim in my own
re-anchored findings doc. See that document's §1 for the correction.

> **D5 relocates D1's centre of gravity.** §7.1 sets out to make absence mean denial, but
> scoped to `scopes.go`. With D5 on the list, the same rule is now known at four sites across
> three layers, and the honest framing is that permissive-on-absence is the system's *default
> posture*, not a trio of local bugs. §7.1 as written remains correct for what it covers — it
> is now visibly partial. Whoever resumes should decide whether to fix the sites or invert the
> posture; that decision is not made here.

**Goals:** no absent value ever grants permission; no identity is provisioned above least
privilege; every credential-administering route is authenticated; `ft dashboard` and
`farmtable-server` agree on auth configuration. **Note that the goal as stated is not met by
§7.1–§7.4**, which address four of the five sites; D5 is out of scope of every phase below.

## Non-Goals

- Redesigning the scope vocabulary. It is sound; only its default semantics are wrong.
- Per-collection *policy* binding (many:many) — still a future feature, unchanged.
- Adding new auth modes or identity providers.

## Proposed Design

### 7.1 Make absence mean denial (D1)

Replace the implicit "empty means everything" rule with an **explicit** wildcard. The
wildcard scope `*` already exists; nothing needs to mean wildcard implicitly.

```
RequireScope(ctx, scope):
    if !authEnforced(ctx):            return nil        // open-access mode, unchanged
    scopes := ScopesFromContext(ctx)
    if len(scopes) == 0:              return PermissionDenied   // WAS: return nil
    if contains(scopes, "*") || contains(scopes, scope): return nil
    return PermissionDenied
```

`RequireCollectionAccess` keeps "no restriction list means all collections" — an empty
collection list is a genuine *absence of restriction*, not an absence of grant, and scope
checks already gate the operation. **This is the one of the three I propose to leave alone,**
and it should be called out for review rather than changed by reflex.

```
DefaultScopesForUserType(userType):
    switch userType:
      case "admin", "human":     return ["*"]
      case "agent":              return [task:read, task:write, task:claim, collection:read]
      case "reviewer","orchestrator": return [...full lifecycle...]
      case "viewer":             return [task:read, collection:read]
      default:
          log.Error("unrecognized user type %q — refusing to mint scopes", userType)
          return ERROR              // WAS: nil, meaning wildcard
```

`DefaultScopesForUserType` gains an error return. Callers that cannot resolve a type must
fail token creation rather than issue an unscoped token.

**Load-bearing.** Changing it later means re-minting tokens. This is the decision point.

### 7.2 Provision at least privilege (D2)

Auto-provisioned users must not default to an administrative type.

- `FindOrCreateByEmail` takes the provisioned type as a parameter rather than hardcoding it.
  **This part is safe to build now** — it is structurally right regardless of which access
  model is chosen, and it is what actually governs SSO identity.
- Default becomes read-only on first contact. **Which named tier that is, is contingent on
  the owner's answer** — `viewer` is the obvious candidate but it is currently a dead tier,
  and the tier set itself may not survive. Do not hard-code a tier name until that lands.
- `FARMTABLE_PROVISION_USER_TYPE` allows an operator to raise it deliberately.
- Elevation becomes an explicit administrative act, not a side effect of logging in.
- Recommend requiring a non-empty `FARMTABLE_ALLOWED_DOMAINS` whenever a non-token auth mode
  is selected — refuse to start otherwise. An SSO deployment open to every domain on the
  internet is not a defensible default.

### 7.3 Authenticate the link routes (D3)

Move the six `/api/link/*` routes behind the session middleware, so they are subject to the
same identity requirement as the rest of the API, and add a `collection:admin` scope check
inside each handler — these routes bind credentials to a collection, so collection-admin is
the right authority.

Because OAuth *callbacks* are entered from the provider's redirect and may not carry the
session cookie under `SameSite=Lax`, the callback leg must be protected by a signed, single-use
`state` parameter bound to the initiating session, rather than by the cookie alone. The initiate
leg is protected by session + scope.

### 7.4 Reconcile the entrypoints (D4)

Extract one shared configuration resolver used by both `ft dashboard` and `farmtable-server`,
so auth configuration cannot silently differ between them:

```
serverapp.AuthConfigFromEnv() -> UnifiedHandlerOptions{AuthMode, IAPAudience, AllowedDomains, BaseURL}
```

Both entrypoints call it, so they cannot silently drift again.

> **This is NOT "pure plumbing with no auth logic change" — I mislabelled it and was
> corrected.** The code change is inert; **the effect is not.** Two directions:
>
> 1. **Lockout.** If the environment sets a non-token auth mode, giving `ft dashboard` an
>    `AuthMode` installs an IAP gate that returns 401 where nothing gated before.
> 2. **Exposure** *(the direction I missed).* Giving `ft dashboard` a `BaseURL` satisfies the
>    link-route registration condition and **adds six unauthenticated routes to a path that
>    currently has none.**
>
> **Therefore: behaviour-preserving by default.** Land the resolver; keep the dashboard's
> current effective behaviour; explicitly do **not** register link routes there. Any
> enforcement flip is a separate, deliberate, announced commit. Because production runs
> `farmtable-server`, none of this touches the live service.

## Alternatives Considered

**A1 — Leave the fail-open defaults, rely on the warning log.** Rejected. The warning already
exists at the `DefaultScopesForUserType` site and did not prevent the defect; it documents it.
A log line is not an access control.

**A2 — Grandfather legacy tokens by backfilling `*` into every existing token row, then flip
the default to deny.** This preserves every current integration and makes the fail-open rule
explicit and auditable in the database. Rejected as the primary route because it permanently
freezes today's over-permissioned tokens into an approved state, and the owner has accepted
sudden blocking. **It is, however, the correct fallback if a hard cutover proves too disruptive**,
and it is strictly better than the status quo. Worth keeping on the table.

**A3 — Migrate tokens by inferring scopes from observed usage** (`last_used_at` plus an audit
of which RPCs each token actually called). Rejected: farmtable does not record per-RPC usage
per token, so the inference has no data to stand on. Attractive in principle, unbuildable here.

**A4 — Deny-by-default only for newly minted tokens, keeping old tokens wildcard.** Rejected as
the end state — it leaves the vulnerable population untouched indefinitely, which is the
population that matters. It is viable as a *transitional* step inside a phased rollout.

**A5 — Fix D2 by mapping `human` to something less than `*`.** Rejected. `human` legitimately
describes an administrator in this product. The defect is provisioning strangers *as* `human`,
not the meaning of `human`.

## Migration / Rollout

The hazard is concentrated in one place: tokens issued before Stage 4 genuinely have no scopes,
and under 7.1 they all lose access simultaneously.

1. **Measure first.** Count `ApiToken` rows with empty scopes, grouped by user type and
   `last_used_at`.

   **A partial measurement already exists and must be carried with its caveat intact.** The
   hardening track measured **19 of 19 tokens holding NULL scopes** — empty-means-deny
   dead-keys every token at once; a name-scoped repair reaches 18. **This is a strong argument
   and a weak census, and it must be quoted as both.** n=1 user, trivial sample, cannot measure
   deployments. It is sufficient to establish that the cutover is disruptive; it is **not**
   sufficient to size the blast radius across real deployments. Do not let it be requoted as
   a census. The per-deployment count is still required before 7g.
2. **Ship a warn-only build.** Log every request that *would* be denied under the new rule,
   with token ID and scope. Run it long enough to see the real access pattern.
3. **Backfill deliberately.** For each still-active token, set explicit scopes — either its
   user type's defaults or `*` where genuinely required. Now every grant is explicit and
   auditable, whichever way it went.
4. **Flip the default to deny.** By this point the warn-only logs should be quiet. Residual
   breakage is the accepted sudden-blocking case.
5. 7.2, 7.3 and 7.4 are independent of this sequence and can land immediately — none of them
   depend on the token migration.

Rollback: steps 1–3 are reversible. Step 4 is a one-line revert until tokens are re-minted.

## Open Questions

1. **Legacy token cutover.** Do we distinguish pre-Stage-4 legacy tokens from newly minted
   empty-scope tokens, or deny both? Denying both is simpler and safer, and more disruptive.
   *This is the one decision I need from the owner.*
2. **Is `ft dashboard` the intended production entrypoint,** or is the Dockerfile an accident?
   Decides whether 7.4 is a config fix or a packaging fix.
3. **Should `RequireCollectionAccess` keep its empty-means-all rule?** I argue yes (7.1). Flagged
   for review because it is superficially the same shape as the defect and will look like an
   oversight to a reviewer who pattern-matches.

## Implementation Phases

| Phase | Work | Size | Depends on |
|---|---|---|---|
| 7a | Measure empty-scope token population | S | — |
| 7b | Least-privilege provisioning (7.2) | S | — |
| 7c | Shared auth config resolver, both entrypoints (7.4) | S | — |
| 7d | Authenticate link routes + signed state (7.3) | M | — | *(deprioritised — IAP fronts these; real but not urgent)* |
| 7e | Warn-only denial logging | S | 7a |
| 7f | Scope backfill for active tokens | M | 7e |
| 7g | Flip `RequireScope` + `DefaultScopesForUserType` to deny (7.1) | M | 7f |

7b, 7c, 7d are independent and can run in parallel immediately. The 7a→7e→7f→7g chain is
strictly sequential and carries all of the risk.

## Existing Work In Flight

**Halted branch — `scopedeny-93-deny-unrecognised-type`.** Held unmerged for my inspection.
Tip is `89973f8` (an earlier record of `951502d` does not resolve; do not chase it). Merge-base
`7a0f220`, 47 ahead. Findings at `reports/dev-scopedeny-93-findings.md`. Canary commits:
`160e211` inverts the tests that certified empty-scopes-as-wildcard; `e786341` rejects an
unrecognised type at CLI user creation. That is the shape of 7.1 and 7g, already written.

**Two evidence defects attach to it, both self-disclosed:**
1. Its middle commits **do not build** (test signature drift), so every green it reported
   measured the working tree, not the commit. Only the tip is reproducible.
2. The tip fails to build **only because it predates main's asset-embed fix**. With that one
   file restored it builds clean. **The branch is not broken — it must be rebased onto
   `43bd206` before any green from it means anything.**

**Adopted rule — MEASURE THE COMMIT, NOT THE TREE.** Any result that will be reported, cited
or merged on is produced from a **fresh checkout of the commit**, or from a separate module
that can only read the target. Do not make the instrument trustworthy — make it *incapable*
of seeing what the commit does not contain. A tree-state declaration survives only where that
is genuinely impractical, and is then a confession, not a certificate.

*(This replaces the earlier "declare your tree state" rule. That was a diligence remedy for a
systems property: it produces truthful declarations that still mislead. The known false greens
were not produced by careless legs — each measured accurately, but the instrument answered a
question about a tree while every reader took it to be about a commit. CI satisfies the
structural form by construction, which is why an off-runner green is worth little here.)*

**Compliance of this document's own measurements:** every figure re-resolved for this restart
was taken in a fresh detached worktree checked out at `43bd206`, not in a shared or reused
tree. The one place I failed was not tree hygiene but target selection — see the entrypoint
correction below.

**Favourable trend, from the task-state track (triage-grade, not certification).** Its phase 2
web UI work stops the dashboard re-deriving task readiness locally and defers to server-computed
availability. It changes no Go and adds no permission check, but it moves the "may this user
act" boundary off the client. Any Stage 7 reasoning that treats the browser as a place where
authorization is decided has one fewer instance to account for once it lands.

## Acceptance Criteria

- **7.1** A token with an empty scope list is denied on every scope-checked RPC. A token with
  `*` is unaffected. Open-access mode is unchanged. An unrecognized user type causes token
  creation to **fail**, not to mint a wildcard.
- **7.2** A newly auto-provisioned SSO/IAP user receives read-only scopes. Elevation requires
  an explicit administrative action. A non-token auth mode with no domain allowlist refuses
  to start.
- **7.3** All six `/api/link/*` routes reject unauthenticated requests. Verified by execution
  **against the handler, with a control proving the static file server is not answering** —
  a 200 carrying `index.html` is not a pass.
- **7.4** `ft dashboard` and `farmtable-server` resolve identical auth configuration from
  identical environment. Confirm by running both with the same env and diffing effective config.
- **Regression** `go test ./internal/server/` passes; the existing RBAC, identity, and auth
  suites are updated to assert denial where they previously asserted the fail-open behavior.
- **Migration** The warn-only phase reports zero would-be denials for active tokens before 7g
  is enabled.
