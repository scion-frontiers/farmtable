# Auth Restart — Recovery Note

**Date:** 2026-07-29
**Agent:** farmtable-architect-auth (restarted instance)
**Measured at:** `43bd206` (main), in a detached worktree at `/workspace/farmtable-auth-restart`
**Prior work dates:** 2026-07-22 → 2026-07-26 (lost instance; output survived in scratchpad)

---

## 1. What I Recovered

All five recovery documents were present and readable:

| # | Doc | Date | Recovered |
|---|-----|------|-----------|
| 1 | `briefs/farmtable-architect-auth.md` | — | Yes — original charter |
| 2 | `auth-current-state.md` | 22 Jul | Yes — findings |
| 3 | `design-auth-improvements.md` | 26 Jul | Yes — six-stage design |
| 4 | `auth-task-breakdown-log.md` | 23 Jul | Yes — 52-task decomposition |
| 5 | `auth-tasks-refine-log.md` | 23 Jul | Yes — refined to 62 tasks |

I did not re-derive their contents. I used them only as a set of claims to re-test.

**Original auth design located.** Predating all of the above: `.design/roadmap.md`
"Stream 1: Identity & Auth", items AUTH-1 through AUTH-4 (token→user mapping, auth
context on mutations, `ft user whoami`, `ft task claim --assignee`). Present at
`43bd206` and all four are implemented. My staged design is a later layer on top of
this, not the origin.

---

## 2. Method

The brief's instruction was to **ask reachability, not content**. Presence of
vocabulary in the tree does not mean the path is live. Every claim below was
resolved by tracing from a process entrypoint to the code, not by grepping for
identifiers. Where I could, I ran the tests.

`go test ./internal/server/ -run 'Scope|RBAC|Identity|Auth|Enforce'` — **passes** at
`43bd206`. The landed enforcement behavior is locked in by tests, i.e. intentional
and defended, not accidental.

### 2.1 Standing default for this workstream, adopted 29 Jul

> **`farmtable-server` is the subject of every auth claim in these documents unless
> the claim states that it was measured against something else. `ft dashboard` is the
> case that has to be argued for, never the one assumed.**

This is a default, not a reminder to be careful. It exists because care demonstrably
did not work: I made three artefact errors during this restart and **two of them ran in
the same direction — the shipping binary was the weaker one both times.** A run in one
direction is a bias, and more diligence does not correct a bias; only moving the default
does. The pull is structural rather than personal: `Dockerfile` and `ft dashboard` are
the plainly-named things, so they are what the hand reaches for first. The rule costs
nothing when I am right and catches me when it is pulling again.

### 2.2 The failure mode this restart actually surfaced: FALSE RETRACTION

The method above has a failure mode I did not anticipate and that nothing in our process
looks for. **An audit aimed at the wrong artefact does not merely miss things — it deletes
correct work, and its output is indistinguishable from a good audit.**

Concretely: re-anchoring was a pass whose whole purpose was removing false claims. Aimed
at `ft dashboard`, it removed a claim that was **true of the binary that ships** (table row
11, `FARMTABLE_TOKEN` as the enable flag) because that claim was false of the binary I was
reading. The deletion looked exactly like rigour at the moment I performed it.

**A false retraction is worse than a false finding, and much harder to catch.** A wrong
claim leaves the question open and someone eventually trips over it. A wrong retraction
*closes* the question and leaves a receipt saying it was examined — so nobody looks again,
and the person least likely to look again is whoever signed the receipt. That is why I
swept the remaining rows of §3.1 deliberately rather than waiting to be handed a second one.

**Corollary, and it applies to reviewers of this document.** A findings document *shrinking*
is not evidence of quality. Shrinkage is equally consistent with deleting things that were
true. It is a cheap observable that co-varies with the expensive one, and it should not be
read as a proxy for it.

### 2.3 How to scope a correction — procedure, not judgment

I under-scoped a correction **three times in one afternoon**, each time while actively
holding the rule that says not to. The rule was *"ask what else the same pass produced."*
That is a judgment rule, and it fails in a specific way: **"what else did this pass produce"
silently resolves to "what else can I currently see."** Asking the question does not bound
the answer. The generator's extent is itself unmeasured, and nobody measures it because the
question feels answered by having been asked.

> **Procedure.** Before making the first fix, **write out the generator's output as an
> explicit list** — every artefact, section, table, status line and summary that pass
> touched. Sweep *that list*. Anything not on it is declared unswept **by name**. The list
> is written **before** the first fix, because afterwards the list silently becomes whatever
> the fix made salient.

Worked example: had this existed at the start, the list would have read *"§3.1 table, §5,
design doc status line, design doc stage table"* and I would have swept four things instead
of one, three times over.

### 2.4 How to end an audit

**Terminate by declaring the unswept surface, never by declaring it clean.** An audit that
keeps finding real things has no natural stopping point, and the tempting terminator is
always "clean" — because *clean* is the word that makes stopping feel earned. It is also
the one claim you have not checked, since you stopped in order to avoid checking it.

The companion already in use here: an absence is a fact about a **search** until the search
is shown to cover. Pointed the other way, this is why Stage 6 and row 6 are recorded as
*verified correct* rather than passed over in silence — a thing checked and found sound is
a result, and leaving it unmarked is indistinguishable from not having looked.

**Unswept surface of this document, declared by name:** the *body* of `auth-current-state.md`
— §§2, 3, 8, 9, 10, 11 — has not been swept against `farmtable-server` with a nil lookup.
It is small, twice-corrected, and not load-bearing while auth is parked. **Unswept is not
clean.** Whoever resumes should sweep it before relying on it, using §2.3.

---

## 3. THE POINT: What In My Old Docs Is Now FALSE

This is the section that matters. My 22 Jul findings doc is substantially obsolete.
Implementation ran against my design between 23 and 29 July and **most of it landed**.
Anyone still working from `auth-current-state.md` as written is working from a picture
of the system that no longer exists.

### 3.1 `auth-current-state.md` — falsified claims

| # | Claim (22 Jul) | Status at `43bd206` |
|---|---|---|
| 1 | "Auth is advisory — almost nothing enforces it" | **FALSE†.** Interceptor is reject-by-default. |
| 2 | "If no `Authorization` header is sent, the request passes through unauthenticated" | **FALSE†.** Returns `Unauthenticated`. |
| 3 | "Only `WhoAmI` explicitly checks for user context" | **FALSE†.** `RequireIdentity` + `RequireScope` are called across ~20 handler sites. |
| 4 | "All RPCs work without any authentication" | **FALSE†.** Only `GetVersion` / `GetStatus` are exempt. |
| 5 | "No login page, no session management" | **FALSE — but only when a lookup is configured.** `/api/auth/session` (POST/GET/DELETE) + encrypted cookie + session-to-bearer middleware all exist. **With `FARMTABLE_TOKEN` unset these routes are never registered** (`unified.go:62` gates them on `TokenLookup != nil`), so the original claim is *literally true* in that configuration. Absent, not merely unenforced. |
| 6 | "Token in URL — `?token=` leaks credentials" | **FALSE.** URL param removed; comment in code records the security rationale. |
| 7 | "The web dashboard operates unauthenticated for most operations" | **FALSE†.** |
| 8 | "No authorization/RBAC — any user can perform any operation" | **FALSE†.** Scope vocabulary, `RequireScope`, and per-collection access checks are enforced. |
| 9 | "No multi-tenancy or data isolation" | **MOSTLY FALSE†.** `RequireCollectionAccess` provides per-collection token restriction (23 call sites). |
| 10 | §9 IAP header collision — "recommended fix, ~20 lines" | **LANDED†.** `extractToken()` checks `x-farmtable-token` first, falls back to Bearer. Web client sends both. |
| 11 | "`FARMTABLE_TOKEN` acts as the auth enable flag" | ~~PARTLY FALSE~~ → **RESTORED AS TRUE for `farmtable-server`.** See the correction below. |

> **Correction to this table, 29 Jul — I falsified a true claim.**
>
> Row 11 originally read: *"PARTLY FALSE. Enablement is now `FARMTABLE_OPEN_ACCESS=1` to
> disable; auth is on by default in both entrypoints."* **The second half is wrong.** In
> `farmtable-server` — the binary that ships — an unset `FARMTABLE_TOKEN` leaves the token
> lookup nil, and a nil lookup makes the interceptor pass every request through. Auth is
> off. Only `ft dashboard` is on-by-default. The 22 Jul claim I struck was accurate for the
> shipping binary and I should not have struck it.
>
> **Rows 1, 2, 4 and 7 are therefore scoped, not absolute.** Each is true *when a token
> lookup is configured*. In the unset-token configuration they revert to true-as-originally-
> written: the gRPC surface is open. They are false **of the live deployment**, where the
> hardening track measured a firing 401 on a gRPC path — that measurement is what makes the
> live service demonstrably token-enforcing, not anything in the code path itself.
>
> **Second correction, same hour — the paragraph above was itself too narrow.** I named four
> rows because four were the ones in front of me. Having then swept the remaining six against
> `farmtable-server` deliberately, the conditionality is not a property of four rows, it is a
> property of **the whole table**. Rows 3, 8, 9 and 10 are equally inert when the lookup is
> nil: `RequireIdentity` returns `uuid.Nil, nil`, `RequireScope` returns nil, and the
> interceptor returns before `extractToken` ever runs, so even the IAP-collision fix in row 10
> is unreachable. **Row 5 is worse than conditional** — session routes are registered only
> when `TokenLookup != nil` (`unified.go:62`), so with an unset token `/api/auth/session` does
> not exist at all. Not "present but unenforced": absent.
>
> Correcting a class and then under-scoping the correction is the same defect one level up. I
> have now done it twice in this document, which is why the rule below is a default and not a
> reminder.
>
> This is the third time in this restart that a claim of mine was true of one artefact and
> false of another, and the second time the shipping binary was the weaker one. The artefact
> clause is not a formatting convention; it is load-bearing, and I keep re-learning that.
> Surfaced by the hardening track. Recorded, not queued — auth is parked.

† **Conditional on a token lookup being configured.** With `FARMTABLE_TOKEN` unset in
`farmtable-server`, the interceptor passes every request through and each of these rebuttals
fails — the original 22 Jul claim becomes true again. Row 6 was re-verified and is
**unconditionally false** (the `?token=` param is genuinely gone from source; the surviving
`URLSearchParams` call serves `?collection=`). Row 11 is corrected below.

**Still true:** LinkedAccounts remain a separate credential path from app auth (§5);
the User model still has no password/login credential (§6); the roadmap table (§8)
is still accurate.

### 3.2 `design-auth-improvements.md` — falsified framing

- **Status line "Approved… staged plan" reads as forward-looking. It is not.**
  Stages 0–6 all have landed code. This is now a maintenance and correction
  document, not a build plan.
- The Implementation Phases table (Phases 0–6, "suggested ordering") is spent.
  Phases 0–4 are substantially done; **5 and 6 are landed and reachable in
  `farmtable-server`, the binary that ships** — they are not wired in `ft dashboard`
  (see §4.3, and note that my first pass had this backwards).
- **Stage 4's migration note is the most damaging stale line in either doc:**
  *"Existing tokens have no `scopes` field → treated as `*` (unrestricted). No
  breakage."* That was written as a benign backward-compatibility measure. It is the
  root of the live privilege defect in §4.1. **I authored this. The defect is a
  design defect, not an implementation defect** — the implementer built exactly what
  I specified.

### 3.3 A stale claim I could not carry forward

`auth-task-breakdown-log.md` and `auth-tasks-refine-log.md` describe a live task
collection of 62 tasks with specific task IDs. I have **not** re-resolved the state
of that collection against the live instance. Those completion states are unverified
and should be treated as unknown, not as recorded.

---

## 4. What I Re-Resolved At `43bd206` — New Findings

These are not in either old doc.

### 4.1 Three sites where an absent value is read as permission

All three are in the same short file (`internal/server/scopes.go`):

1. **`RequireScope`** — `if len(scopes) == 0 { return nil }`. A token with no scopes
   passes every scope check.
2. **`RequireCollectionAccess`** — `if len(allowed) == 0 { return nil }`. A token with
   no collection list reaches every collection.
3. **`DefaultScopesForUserType`** — an unrecognized user type returns `nil`, and `nil`
   means wildcard by rule (1). It logs a warning and grants full access.

Individually each is a defensible backward-compatibility choice. **Composed, they
convert an unknown input into superuser.** A typo in a user type — `reviewr` for
`reviewer` — mints a wildcard token. The code comment at that site openly
acknowledges this and ships it anyway.

This matches the owner's ruling relayed in my brief: an unrecognised user type is a
severe bug. It is confirmed at `43bd206`.

### 4.2 OAuth/IAP auto-provisioning hardcodes one user type

`UserProvisioner.FindOrCreateByEmail` creates every new user with `Type: "human"`
(hardcoded). `DefaultScopesForUserType("human")` returns `ScopeWildcard`.

**Therefore every user auto-provisioned via SSO or IAP receives full administrative
scope.** The only control standing in front of this is the domain allowlist — and
`checkDomain` returns nil (allow all) when `FARMTABLE_ALLOWED_DOMAINS` is unset.

### 4.3 Entrypoint fork — MY CLAIM HERE WAS WRONG, CORRECTED 29 Jul

> **RETRACTED.** I originally wrote that the shipped container runs `ft dashboard` and
> that Stages 5–6 are therefore unreachable in production. **That is false.**
>
> There are **two** Dockerfiles. `Dockerfile` runs `ft dashboard`. **`Dockerfile.server`
> builds and runs `farmtable-server`.** The deploy logs show the live service is deployed
> from the image `farmtable-server:latest`, built with `-f Dockerfile.server`.
> **Production runs `farmtable-server`.**
>
> I read the first Dockerfile, assumed it was the shipping artifact, and reasoned from it.
> This is precisely the failure the brief warned against — I asked reachability rigorously,
> **of the wrong binary**. The lesson is that "trace from the entrypoint" is only as good as
> knowing which entrypoint ships.
>
> **Corrected consequences:** `farmtable-server` passes `AuthMode`, `IAPAudience`,
> `AllowedDomains` and `BaseURL`. **Stages 5 and 6 ARE reachable in production**, subject to
> environment configuration. The six link routes **ARE registered and ARE unauthenticated in
> production** (§4.4).

**BLAST RADIUS OF THIS ERROR — BOUNDED, so no one over-corrects.** I verified the two
Dockerfiles at `43bd206` myself: they differ in **exactly three lines**, all of them the Go
binary — the `go build` target, the `COPY` of that binary, and the `CMD`. Lines 1–14, the
entire frontend stage including `npm run build` and the `COPY` of `web/dist`, are
byte-identical. Both blobs are unchanged between `43bd206` and `633f8f2`. *(Measurement
originally supplied by the task-state track; I re-resolved it rather than accept it, on the
principle that a claim which shrinks my own remaining work deserves more scrutiny, not less.)*

Consequence: **the same web assets ship in both images; only the binary wrapping them
differs.** So everything I concluded about the *dashboard client* — `?token=` removed, dual
`Authorization`/`X-Farmtable-Token` headers, the session flow (§8 of the findings doc) —
holds for production and needs no re-resolution. **Only conclusions about what wraps the
assets were wrong**, and those are corrected above.

A retraction should state its limits as precisely as its content, or it invites a second
error in the opposite direction.

The fork below is real and still worth closing — the two entrypoints genuinely disagree —
but it is a **dev/local** inconsistency, not a production gap.

`Dockerfile`: `CMD ["/ft", "dashboard", "--port", "8080"]` — **not the deployed artifact**
`Dockerfile.server`: `CMD ["/farmtable-server"]` — **this is what ships**

| Option passed to `UnifiedHandler` | `ft dashboard` (shipped) | `farmtable-server` |
|---|---|---|
| `TokenLookup` | yes | yes |
| `Store` | yes | yes |
| `AuthMode` | **not passed → defaults to token** | from `FARMTABLE_AUTH_MODE` |
| `IAPAudience` | **not passed** | from env |
| `AllowedDomains` | **not passed** | from env |
| `BaseURL` | **not passed → empty** | env, with localhost fallback |

Consequences **in `ft dashboard`** — a local/dev path, **not the deployed artefact**:

- `AuthMode` defaults to `AuthModeToken`, so the `switch` in `UnifiedHandler` selects
  neither branch. The IAP middleware is never installed and the Google OAuth routes are
  never registered **in `ft dashboard`**.
- `BaseURL` is empty, so `o.Store != nil && o.BaseURL != ""` is false. The six
  `/api/link/*` routes are never registered **in `ft dashboard`**.
- Stage 6 background services (token refresher, credential monitor) start only in
  `farmtable-server`'s `main()`. They do not run in `ft dashboard`.

**In `farmtable-server`, the binary that ships, all of the above ARE wired.** Stages 5
and 6 are reachable in production, subject to environment configuration.

> **Every claim in this subsection now names its binary, deliberately.** The original
> version of this section said "unreachable in production" with no artefact attached, and
> that sentence is what travelled. A reachability claim without a named artefact is not a
> claim. Stating the artefact in the same sentence as the result is the only guard against
> this, and it is a discipline, not a mechanism — a fresh checkout does not supply it.

### 4.4 Six unauthenticated HTTP routes — confirmed live in `farmtable-server`

The six link-flow routes are `/api/link/{github/install, github/callback,
jira/connect, jira/callback, linear/connect, linear/callback}`. They contain **zero**
auth checks (grep for session/identity checks in `linkflows.go` returns 0). They are
registered directly on the mux, outside both the gRPC interceptor (which covers only
`/farmtable.v1*`) and the session-to-bearer middleware (which wraps only the gRPC-web
handler). They administer external platform credentials.

The count of six matches the hardening package described in my brief exactly.

**CONFIRMED LIVE IN PRODUCTION.** `farmtable-server` — the binary that actually ships —
always resolves a non-empty `BaseURL` via its `localhost` fallback, so the registration
condition `o.Store != nil && o.BaseURL != ""` is **always true** there. The routes are
always registered and have no auth checks.

> **I withdraw the caveat I originally attached here.** I had warned that a 200 might be
> the static file server answering rather than the handler, and asked for a control to
> distinguish them. That warning was predicated on the wrong binary (§4.3). The hardening
> track's demonstration was sound: an unauthenticated GET returned **307 to the GitHub
> authorize URL** — a redirect the static file server cannot produce — with a **firing 401
> control** on a gRPC path. Their measurement was right and my objection to it was not.

Per owner input, IAP fronts everything, so these are not internet-facing: *"we will still
want to fix app layer auth on these endpoints. but there is not the same urgency."*

### 4.5 The stage4 branch is fully merged, not pending

`auth/stage4-scoped-tokens-rbac` (`7cd046b`) — I verified all three of its
collection-access commits are ancestors of `43bd206`. It is **merged**, and its
`RequireCollectionAccess` call-site counts are identical to main's. Whatever halted
fix is being held for me by the hardening track, it is **not** this branch.

---

## 5. Landed vs. Remaining — Ordered

**Landed** (at `43bd206`). **"Reachable" below means reachable in `farmtable-server` *with a
token configured*.** That qualifier was missing when this list was written and it is not
cosmetic — see item 6, where it decides whether a whole login mechanism exists:

1. Stage 0 — `x-farmtable-token` header, IAP-safe extraction. Landed, both entrypoints.
2. Stage 1 — mandatory auth enforcement, reject-by-default with health/version exemption. Landed, both entrypoints.
3. Stage 2 — session endpoints, cookie, session-to-bearer, `?token=` removed. Landed, both entrypoints.
4. Stage 3 — `RequireIdentity` on mutating RPCs. Landed, both entrypoints.
5. Stage 4 — scope vocabulary, `RequireScope`, per-collection access. Landed, both entrypoints — **but unsound, see §4.1**.
6. Stage 5 — OAuth + IAP proxy auth. Landed. **Reachability is conditional and I stated it
   absolutely — corrected 29 Jul.** OAuth login is registered only when
   `o.Store != nil && sm != nil` (`unified.go:73`), and `sm` exists only when
   `TokenLookup != nil` (`:62`). **With `FARMTABLE_TOKEN` unset, Google OAuth login is never
   registered** — the same gate that hides `/api/auth/session` in §3.1 row 5. IAP differs:
   `AuthModeProxy` needs only `o.Store != nil`, so the middleware *is* installed, but it skips
   session creation and the bearer bridge when `sm` is nil, and with a nil lookup the gRPC
   surface is open regardless. "Subject to env config" was hand-waving that concealed exactly
   which variable it depended on. *(Separately corrected earlier: I first reported Stage 5
   unreachable outright, having analysed `ft dashboard`.)*
7. Stage 6 — link OAuth flows, token refresh, credential monitoring. Landed and
   **unconditionally reachable** — the link-flow gate is `o.Store != nil && o.BaseURL != ""`
   (`unified.go:94`), which does not involve the lookup. Checked deliberately rather than
   assumed; this one is correct as it stood. With the auth gap in §4.4.

**Remaining work — PARKED BY OWNER, 29 Jul.**

> *"we don't need to make continuous progress on the auth front at the moment - we are
> focused on some other data model refactors - and then can layer on the auth plan."*
>
> **Nothing below is to be dispatched.** This is a backlog for when auth resumes, ordered
> so it can be picked up cold. The purpose of this restart was to establish an accurate
> baseline, and that is done.

1. **Reject unrecognised user types** (§4.1, third site). The one item the owner's
   scaffolding ruling does **not** cover — he separately called it a severe bug and
   authorised sudden blocking. A typo in a user type currently mints an administrator.
   Smallest and best-understood item; a canary implementation already exists on the
   halted branch.
2. **Stop auto-provisioning at wildcard** (§4.2). Governs SSO identity. Structurally
   right regardless of the eventual role model, but **the target tier depends on the role
   work**, so it should not be hard-coded before then.
3. **Build the real role model.** Per owner, the tier system is deliberate scaffolding, not
   a defect. When it is built: make the tiers assignable, and extend the grant table to
   express `collection:write`, `collection:admin`, `token:manage` and `user:read`, none of
   which any named tier can currently hold.
4. **Deny-on-empty scopes** (§4.1, first site). Latent, not live — privilege delta is zero.
   Requires the warn-first migration and the legacy-token decision. Sequence it *after* the
   role model, since that is what makes explicit scopes assignable in the first place.
5. **Authenticate the link-flow routes** (§4.4). Real and live in production, but IAP fronts
   them; owner has explicitly deprioritised.
6. **Reconcile the entrypoints** (§4.3). Dev/local consistency only — **not** a production
   gap. Must be behaviour-preserving: giving `ft dashboard` a BaseURL would *register* the
   six unauthenticated link routes it currently lacks.
7. Re-resolve the 62-task collection state (§3.3) before any of it is used for planning.

---

## 6. Open Questions

1. **Legacy tokens.** Fixing §4.1 means `nil` scopes must stop meaning wildcard. Every
   token issued before Stage 4 genuinely has no scopes and will lose all access at once.
   The owner has already ruled that suddenly blocking such users is acceptable. What I
   still need to settle is whether we distinguish *pre-Stage-4 legacy* tokens from
   *newly minted empty-scope* tokens, or treat both as deny. Treating both as deny is
   simpler and safer; it is also the more disruptive of the two.
2. **Is `ft dashboard` the production entrypoint, or an accident of the Dockerfile?**
   The answer changes whether §4.3 is a configuration bug or a packaging bug.

## 7. Not Investigated — By Instruction

The known unrotated host credential. This is **accepted risk by owner instruction, not
resolved**. The investigation was stood down by the owner. I did not reopen it, did not
sweep for it, and no credential value appears in this note.

## 9. Hardening Package — What I Adopted, What I Verified

Received as one-way input; no reply owed and none sent. Their measurements were at
`faf1c8c`, mine at `43bd206`. **I re-measured the two claims that change my design and
both hold:**

- Four restricted tiers are unreachable outside one `switch` (0 occurrences each);
  only `agent` is reachable unaided (7). **Verified.**
- `ImportCollection` requires `collection:admin`, so privilege delta is zero and the
  escalation is latent, not live. **Verified.**

Adopted from them: the severity downgrade (latent, persistence-not-privilege); the
downgrade of the link routes on owner input that IAP fronts everything; the correction
that deny-on-empty is a **no-op for new SSO logins** because provisioning mints an
*explicit* `["*"]` — so D1 and D2 are independent, which I initially had coupled; and the
19-of-19 empty-scope token figure, **carried with its caveat unweakened as a strong
argument and a weak census, n=1 user**.

Also adopted: *a green measured on a dirty tree is not a green for the commit.* The halted
branch's middle commits do not build, and its tip fails only because it predates main's
asset-embed fix — it needs rebasing onto `43bd206` before any result from it counts.

One thing I did **not** take from them: I found the `auth/stage4-scoped-tokens-rbac`
worktree fully merged (§4.5) and initially took it for the halted fix. It is not. The
halted branch is `scopedeny-93-deny-unrecognised-type`, tip `89973f8`.

## 8. Reversible Classification Left As-Is

Audit-trail integrity in the import path was classified as the hardening track's, not
mine, on the test *does the change alter who is authenticated, what they may do, or how
that is decided*. Reading an auth decision is not making one. **I agree with that test
and I am leaving the classification where it is.** I am not converting it to report-only.
