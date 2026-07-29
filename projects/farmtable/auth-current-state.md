# Farm Table — Auth Current State (Findings)

**Re-anchored:** 2026-07-29 at `43bd206`
**Supersedes:** the 2026-07-22 edition of this document, which is obsolete
**Author:** Architect agent (auth workstream)
**Companion:** `reports/auth-restart-recovery-20260729.md` — lists exactly which prior claims were falsified

> **Read this first.** The 22 Jul edition of this document described farmtable auth
> as "advisory" and largely unenforced. **That is no longer true and has not been true
> for some days.** Implementation ran against the staged design between 23 and 29 July
> and most of it landed. Every figure below was re-measured at `43bd206` by tracing from
> a process entrypoint, not by searching for identifiers. Nothing was carried forward
> from the prior edition on the strength of having been approved.
>
> **Subject of every claim here is `farmtable-server`, the binary that ships, unless the
> claim says otherwise.** `ft dashboard` is the case that must be argued for. This default
> was adopted after two errors in the same direction, both of which read the dev command
> and reported the result as if it described production. Rationale in the recovery note §2.1.
>
> **This document has been wrong in both directions.** It has carried false claims, and
> during the pass that removed them it also deleted a claim that was true. Do not read its
> having shrunk as evidence that it is now correct — see recovery note §2.2.

---

## Executive Summary

Farm Table now has **mandatory, enforced** token auth with an identity requirement on
mutations and a scope-based RBAC layer. The browser has a real session flow. The IAP
header collision is fixed.

All six stages are landed and reachable in production. Three things qualify that:

1. **The shipping binary disables auth entirely when `FARMTABLE_TOKEN` is unset** (§1) —
   silently, apart from a log line, and without anyone setting the deliberate open-access
   switch. The live deployment does set it (measured), so this is a property of the artefact
   rather than an observed exposure. Largest blast radius of the three.
2. **An unrecognised user type is granted wildcard** (§4). Per owner, wildcard *as a default
   for recognised types* is deliberate scaffolding while the real role model is built — not a
   defect. But granting full authority to a value the system failed to understand is a
   separate matter, and he has ruled it a severe bug.
3. **Six link-flow routes are unauthenticated** (§7). Live, but IAP fronts them and the owner
   has deprioritised them.

All three are the same shape: **an absent value is read as permission.** Unset token → no
auth; empty scopes → all scopes; empty collection list → all collections; unknown user type
→ wildcard. That is four instances across three layers, which makes it the system's default
posture rather than a set of separate bugs. Whatever the real role model turns out to be, it
has to invert this, and that is a larger change than fixing any one site.

The system is far stronger than the 22 Jul edition claimed, and the remaining defects are
narrower and sharper than the ones that document described — with the exception of §1, which
is broader than anything in it.

> **Status, 29 Jul: auth work is parked at the owner's direction.** *"we don't need to make
> continuous progress on the auth front at the moment - we are focused on some other data
> model refactors - and then can layer on the auth plan."* This document exists to be an
> accurate baseline for when it resumes. Nothing here is queued for dispatch.

---

## 1. Server-Side Auth: gRPC Interceptors

**File:** `internal/server/auth.go`

Both unary and stream interceptors are **reject-by-default** when a `TokenLookup` is
configured:

1. If `lookup == nil` → open-access mode, pass through.
2. Otherwise mark the context auth-enforced.
3. Exempt `GetVersion` and `GetStatus` only.
4. Extract the token: `x-farmtable-token` **first**, then `Authorization: Bearer`.
5. Missing/invalid/expired token → `codes.Unauthenticated`.
6. On success inject user ID, scopes, and collection IDs into the context.

**Changed since 22 Jul:** requests without a token are now rejected. The prior claim that
tokenless requests pass through is false.

### Open-access mode — CORRECTED 29 Jul, AND THE TWO BINARIES DIFFER

> **I got this wrong in the first re-anchored edition** and am correcting it against myself.
> I wrote "auth is on by default in both entrypoints" and declared the old
> `FARMTABLE_TOKEN`-as-enable-flag finding obsolete. **That is false for `farmtable-server`,
> the binary that ships**, where the 22 Jul finding was closer to right than my correction
> of it. I falsified a true claim.

| Binary | Behaviour when `FARMTABLE_TOKEN` is unset |
|---|---|
| `ft dashboard` | Auth **on**. Only `FARMTABLE_OPEN_ACCESS=1` disables it. |
| **`farmtable-server` (ships)** | **Auth OFF.** `lookup` stays nil, the interceptor passes everything, and the entire gRPC surface is unauthenticated. A warning is logged. |

In `farmtable-server` the branch is `else if token == "" { log warning }`, leaving `lookup`
nil. This is **not** the deliberate `FARMTABLE_OPEN_ACCESS=1` switch — it is the *absence*
of a value being read as an instruction to disable authentication. So in the shipping
binary `FARMTABLE_TOKEN` **is** still effectively the enable flag.

**This is the same failure mode as §4, at the top of the stack rather than inside it**, and
it is the one with the largest blast radius: §4 escalates a single token's authority, this
one removes authentication from every RPC at once. The pattern now has four instances —
absent token, absent scopes, absent collection list, unrecognised user type — which makes
it a **property of the design, not a collection of oversights**.

*(Measured at `43bd206`. Surfaced by the hardening track; verified here because it
contradicted a claim in this document. Recorded, not queued — auth is parked.)*

---

## 2. Identity Enforcement

`RequireIdentity(ctx)` returns `Unauthenticated` when auth is enforced but the resolved
user is missing or `uuid.Nil`. Mutating RPCs call it. In open-access mode it returns
`uuid.Nil` with no error, preserving local-dev behavior.

`LegacyTokenAuth` is now explicitly deprecated in a doc comment — it returns `uuid.Nil`
and therefore always fails identity checks.

---

## 3. Authorization: Scopes and Collections

**File:** `internal/server/scopes.go`

Vocabulary: `*`, `task:read`, `task:write`, `task:claim`, `task:accept`, `task:close`,
`collection:read`, `collection:write`, `collection:admin`, `token:manage`, `user:read`.

`RequireScope` is wired into ~20 handler sites in `server.go` plus `watch.go`.
`RequireCollectionAccess` is wired into 23 sites. Lifecycle transitions are scope-governed:
leaving triage or reopening requires `task:accept`; terminal transitions require `task:close`.

Tests pass: `go test ./internal/server/ -run 'Scope|RBAC|Identity|Auth|Enforce'` at `43bd206`.

---

## 4. DEFECT: Absent Values Are Read As Permission

Three sites, one file, one shared failure mode — **and a fourth site outside this file**,
in `cmd/farmtable-server/main.go`, where an unset token env var disables authentication
altogether (§1). The three below decide *how much* authority a caller has; the fourth
decides whether callers are authenticated at all. Same rule, different layer.

| Site | Rule | Effect |
|---|---|---|
| `RequireScope` | `len(scopes) == 0` → allow | A token with no scopes passes every check |
| `RequireCollectionAccess` | `len(allowed) == 0` → allow | A token with no collection list reaches every collection |
| `DefaultScopesForUserType` | unrecognized type → `nil` | And `nil` means wildcard, per row 1 |

Each is individually defensible as backward compatibility. **Composed, they turn an
unknown user type into a superuser.** A typo — `reviewr` for `reviewer` — mints a
wildcard token. The code comment at that site acknowledges precisely this risk and
ships the behavior anyway, logging a warning.

**Provenance:** this originates in the Stage 4 migration line of the design doc
("existing tokens have no scopes → treated as `*`… no breakage"), authored by this
workstream. It is a **design defect, not an implementation defect**. The implementer
built what was specified.

**Owner ruling on file:** an unrecognised user type is a severe bug, and such users may
be suddenly blocked.

---

## 5. DEFECT: Auto-Provisioning Grants Wildcard

`UserProvisioner.FindOrCreateByEmail` hardcodes `Type: "human"` for every new user.
`DefaultScopesForUserType("human")` returns `ScopeWildcard`.

**Every user auto-provisioned via SSO or IAP therefore receives full administrative
scope.** The sole gate in front of this is the domain allowlist, and `checkDomain`
allows all domains when `FARMTABLE_ALLOWED_DOMAINS` is unset.

---

## 6. The Two Entrypoints Disagree — But Production Runs The Stronger One

**Which binary ships (settled 29 Jul).** There are two Dockerfiles. `Dockerfile` runs
`ft dashboard`; **`Dockerfile.server` builds and runs `farmtable-server`.** Deploy logs
show the live service is deployed from the image `farmtable-server:latest`, built with
`-f Dockerfile.server`. **Production runs `farmtable-server`.**

> An earlier edition of this section claimed the shipped container runs `ft dashboard` and
> that Stages 5–6 were therefore unreachable in production. **That was false** and is
> withdrawn. It came from reading the first Dockerfile and assuming it was the shipping
> artifact. Recorded because the failure mode is instructive: the reachability discipline
> was applied correctly *to the wrong binary*, which yields a confident and false result.

`runDashboard` passes only `TokenLookup` and `Store` to `UnifiedHandler`, omitting
`AuthMode`, `IAPAudience`, `AllowedDomains` and `BaseURL`. `farmtable-server` passes all four.

| Capability | `ft dashboard` (local/dev) | `farmtable-server` (**ships**) |
|---|---|---|
| Token auth, identity, scopes | Yes | Yes |
| Session/cookie login | Yes | Yes |
| IAP proxy auth | No — never installed | If configured |
| Google OAuth login | No — never registered | If configured |
| `/api/link/*` routes | No — not registered | **Yes — always** (BaseURL falls back to localhost) |
| Token refresh / credential monitor | No — not started | Yes |

**Stages 5 and 6 are reachable in production**, subject to environment configuration.

The divergence is a **dev/local** inconsistency, not a production gap. It is still worth
closing so the two cannot drift — but note that any fix must be behaviour-preserving:
giving `ft dashboard` a `BaseURL` would *register* the six unauthenticated link routes it
currently lacks.

---

## 7. DEFECT: Link-Flow Routes Are Unauthenticated

Six routes — `/api/link/{github/install, github/callback, jira/connect, jira/callback,
linear/connect, linear/callback}` — contain no auth checks whatsoever. They sit directly
on the mux, outside the gRPC interceptor (which covers only `/farmtable.v1*`) and outside
the session-to-bearer middleware (which wraps only the gRPC-web handler). They administer
external platform credentials.

**These are live in production.** Per §6, production runs `farmtable-server`, where
`BaseURL` always resolves non-empty via its localhost fallback, so the registration
condition is always satisfied.

Demonstrated by execution: an unauthenticated GET returns **307 to the GitHub authorize
URL** — which the static file server cannot produce — against a firing **401** control on
a gRPC path.

> An earlier edition warned that a 200 here might be the static file server answering
> rather than the handler. That caveat was predicated on the wrong binary and is withdrawn.

**Owner input, his words, on urgency:** *"iap is in front of everything. we will still want
to fix app layer auth on these endpoints. but there is not the same urgency."* Real, worth
fixing, not urgent, and not internet-facing.

---

## 8. Web Frontend

`web/src/gen/grpc-client.ts`:

- Token resolution: `window.FARMTABLE_TOKEN` → `localStorage['farmtable.token']` → `''`.
- **`?token=` URL parameter has been removed**, with the security rationale recorded in
  a code comment. The prior finding about credential leakage in URLs is resolved.
- The client sends **both** `Authorization: Bearer` and `X-Farmtable-Token`.

Session endpoints exist at `/api/auth/session` — POST to log in with a token, GET for
current session, DELETE to log out. `SessionToBearerMiddleware` bridges the cookie to a
Bearer header for gRPC-web. The POST endpoint is necessarily public; that is correct.

---

## 9. LinkedAccounts

Still a separate credential path from app auth: bound to a Collection, not a User, and
storing the full `auth_token` (marked `Sensitive()` in Ent) rather than a hash. Unchanged
in shape from the prior edition.

New since then: OAuth link flows for GitHub/Jira/Linear, a background token refresher, and
a credential monitor — all subject to the reachability limits in §6, and the auth gap in §7.

---

## 10. User Model

Unchanged: `id`, `email`, `display_name`, `type` (default `agent`), `status`, `platform_id`.
No password or login credential on `User`; authentication remains token-based.

Note the interaction with §4: `type` is a free-form string with no enforced vocabulary,
and it is the input that decides default scopes.

---

## 11. Original Roadmap Items

`.design/roadmap.md` "Stream 1: Identity & Auth" — AUTH-1 through AUTH-4 — remains
accurate and all four are complete. This is the earliest auth design in the project and
predates the staged design work.

---

## 12. Open Questions

1. **Legacy tokens.** Fixing §4 means `nil` scopes must stop meaning wildcard, which
   revokes every pre-Stage-4 token at once. The owner has accepted sudden blocking. The
   remaining choice is whether to distinguish pre-Stage-4 legacy tokens from newly minted
   empty-scope tokens, or deny both. Denying both is simpler and safer, and more disruptive.
2. ~~**Is `ft dashboard` the intended production entrypoint,** or is the Dockerfile an
   accident?~~ **Withdrawn — §6 settled this.** Production runs `farmtable-server`. The
   question survived here after the section that answered it was corrected; it is the
   residue of my own retracted entrypoint error, left behind because I fixed the finding
   and not the question derived from it.

   What remains genuinely open is narrower: **the first `Dockerfile` still exists and still
   runs `ft dashboard`.** Whether anything builds it is not established here.
3. **Does the live deployment set `FARMTABLE_TOKEN`?** Per §1 this is what stands between
   the shipping binary and a fully open gRPC surface. The hardening track's 401 measurement
   says the live service *is* enforcing, so in practice yes. But that is an observation of
   one deployment at one moment, not a guarantee in the artefact — nothing in the code or
   the Dockerfile requires the variable to be set, and the failure is silent apart from a
   log line. Recorded as a question about the deployment, not a proposal to change it.
