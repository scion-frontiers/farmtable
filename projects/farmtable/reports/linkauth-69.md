# linkauth-69 — Is F-1 live in the published tree?

**Author:** la1 (security auditor) · **Written:** 2026-07-29 ~03:55Z
**Method:** source-and-git only. No build, no server started, no request sent to any host, no file modified.

---

## FOUR-LINE SUMMARY

1. **YES — F-1 IS IN THE PUBLISHED TREE (`7a0f220` = `origin/main`). It is not a pre-merge catch.** The file is byte-identical to the audited copy and has been published for **six days** (since 2026-07-23 04:50:44Z).
2. **The six `/api/link/*` routes ARE mounted and served on the public listener, and NO in-process middleware runs in front of them.** The IAP/session middleware wraps only the gRPC-web paths. No middleware saves us.
3. **I assess this HIGH, not Critical.** Exploitation is phishing-assisted OAuth account-linking (a victim must click and consent) — not a remote unauthenticated token dump — and it is inert unless a platform OAuth client ID is set in production.
4. **TWO THINGS WOULD LOWER THIS SHARPLY AND I COULD NOT CHECK EITHER: (a) if `FARMTABLE_{GITHUB,JIRA,LINEAR}_CLIENT_ID` are unset in prod, all six routes return 503 and the bug is inert; (b) if an IAP/load-balancer authenticates ALL paths, it is covered. Ask the owner (a) first — it is one question and it decides the incident.**

> **Age bounds the exposure window. It says nothing about whether anyone used it.** I have no access logs and was not authorised to look for any. Do not read "six days" as evidence of use *or* of non-use.

---

## SEVERITY

| | |
|---|---|
| **Assessed** | **HIGH** |
| Would become **CRITICAL** | Confirmation that a platform client ID *is* set in prod **and** nothing fronts the host |
| Would become **LOW / INFO** | Any one of: the three client-ID env vars unset in prod; an IAP/LB/ingress authenticating **all** paths (not just `/farmtable.v1/*`); the service not actually deployed from `origin/main` |

Rationale against our table — Critical is "exploitable remotely, leads to credential theft"; High is "exploitable with some conditions, significant data exposure". This *is* credential theft, but it needs three conditions I could not verify (OAuth configured, victim interaction, no external auth layer). That is "with some conditions". **I am deliberately not calling it Critical: an overstated severity that turns out to be fronted by a proxy would discredit every real finding this fleet produced tonight.**

---

## Q1 — IS `linkflows.go` PRESENT AT `7a0f220`? **YES.**

### First: the brief's path was wrong, and it failed toward reassurance

- The brief specified `serverapp/linkflows.go`. **That path exists in neither tree** (MEASURED).
- The real path is **`internal/serverapp/linkflows.go`** (MEASURED, both SHAs).
- Running the brief's literal command `git show 7a0f220:serverapp/linkflows.go` yields **exit 128, "path does not exist"** (MEASURED).

**A wrong path and a true absence are indistinguishable by exit code.** Since absence was the very thing being measured, the reassuring misreading — *"absent → pre-merge catch → nobody gets woken"* — was directly available. Coordinator has corrected this at source. Recorded here so the failure mode, not just the fix, survives.

### Measurements at `7a0f220`

| Claim | Evidence | Mark |
|---|---|---|
| `7a0f220` is `origin/main` | `git rev-parse origin/main` → `7a0f220dbd93…` | MEASURED |
| `633f8f2` is 39 commits ahead; `7a0f220` is its ancestor | `rev-list --count` = 39; `merge-base --is-ancestor` exit 0 | MEASURED |
| File present at `7a0f220` | 496 lines, blob `d599b0b4` | MEASURED |
| **Identical in both trees** | blob `d599b0b4` at *both* SHAs; `diff --stat` empty | MEASURED |
| Did not arrive in the 39 unpushed commits | `git log 7a0f220..633f8f2 -- internal/serverapp/linkflows.go` → **zero commits** | MEASURED |
| Line numbers do not shift between trees | follows from blob identity | DERIVED |

### The three F-1 properties, re-measured at `7a0f220` (that SHA's own line numbers)

- **Routes registered** — `:98`, `:99` (GitHub install/callback), `:102`, `:103` (Jira), `:106`, `:107` (Linear), all via `mux.HandleFunc`. MEASURED.
- **`CreateLinkedAccount` called** — `:220`, `:337`, `:449`, writing `AuthToken: token.AccessToken` (`:209`, `:326`, `:439`). MEASURED.
- **`collection_id` from query param** — `uuid.Parse(r.URL.Query().Get("collection_id"))` at `:135`, `:247`, `:364`. MEASURED.
- **No auth code in the file** — grep for session/cookie/bearer/identity/`RequireScope` returns only `oauth2.Config` field names (`AuthURL`, `AuthToken`). Not one identity or scope check. MEASURED.

*(Because the blob is identical, these coincide with the numbers the previous leg reported at `633f8f2`. That is a measured coincidence, not a copy.)*

---

## Q2 — IS THE ROUTE MOUNTED AND SERVED? **YES, ON THE PUBLIC LISTENER, WITH NO MIDDLEWARE IN FRONT.**

**One answer covers both trees.** Every file in the chain is byte-identical at `7a0f220` and `633f8f2`: `unified.go` `85dcbe9`, `main.go` `304d754`, `dashboard.go` `d5c5229`, `linkflows.go` `d599b0b` (MEASURED).

### The chain (MEASURED at `7a0f220`)

```
main.go:92    grpc.NewServer(...)
main.go:111   httpServer := &http.Server{ Addr: ":PORT" }        <- ALL interfaces
main.go:113     Handler: serverapp.UnifiedHandler(...)
unified.go:53     mux := http.NewServeMux()
unified.go:96     linkMgr.RegisterRoutes(mux)                    <- /api/link/* onto the BARE mux
linkflows.go:98-107  the six routes
unified.go:111    mux.ServeHTTP(w, r)                            <- reached with no wrapper
main.go:160   httpServer.ListenAndServe()
```

**ONE `http.Server`. ONE listener. `Addr: ":PORT"` = all interfaces. There is no separate internal listener** — the same socket serves the web UI, gRPC-web, and `/api/link/*`.

### Why no middleware saves us — the core of the answer

Both middlewares assign to the variable `grpcWebHandler`, **not** to the mux:

- `unified.go:67` — `grpcWebHandler = sm.SessionToBearerMiddleware(wrappedGrpc)`
- `unified.go:88` — `grpcWebHandler = iapMiddleware(iapAuth, provisioner, sm, grpcWebHandler)`

`grpcWebHandler` is then mounted on **only two prefixes** — `unified.go:99` `/farmtable.v1/` and `:100` `/farmtable.v1.FarmTableService/`. `/api/link/*` is registered directly on the bare mux and dispatched at `:111` without traversing either wrapper. (MEASURED)

> **ROOT CAUSE CANDIDATE.** The comment at `unified.go:86-87` reads *"Wrap the mux with IAP middleware…"*. **Line 88 wraps `grpcWebHandler`.** The comment describes the safe design; the code implements a narrower one. Someone appears to have believed the mux was covered. (MEASURED — this is the code/comment gap, stated as a finding, not a guess about intent.)

Even if reached, `iapMiddleware` would not gate: it returns `next.ServeHTTP` on a missing assertion (`unified.go:127-131`) — by design, per stage-5 doc line 67, *"enables fall-through to other auth methods"*. (MEASURED)

gRPC interceptors are irrelevant here: these are plain HTTP handlers, not RPCs. (DERIVED)

### Genuine good news — the CLI dashboard is NOT affected

`unified.go:94` gates registration on `o.Store != nil && o.BaseURL != ""`.

- `internal/cli/dashboard.go:135-138` passes `TokenLookup` and `Store` but **no `BaseURL`** → `BaseURL == ""` → **the link routes are never registered in the CLI dashboard.** (MEASURED)
- `cmd/farmtable-server/main.go:106-109` reads `FARMTABLE_BASE_URL` and **falls back to `http://localhost:PORT`** when unset → **`BaseURL` is never empty there and the guard can never fail.** Routes always register in `farmtable-server`. (MEASURED)

Blast radius is the deployed server only, not developer laptops.

### The modifier that most affects severity — and I cannot resolve it

Registration is unconditional, but each handler returns **503 Service Unavailable** unless its platform client ID is configured: `linkflows.go:51` `FARMTABLE_GITHUB_CLIENT_ID`, `:65` `FARMTABLE_JIRA_CLIENT_ID`, `:79` `FARMTABLE_LINEAR_CLIENT_ID`; nil-config guards at `:130`, `:165`, `:242`, `:282`, `:359`, `:394`. (MEASURED)

**If none of those three are set in production, all six routes are mounted but inert.** Whether they are set is **UNCHECKED** — no deployment manifest is committed (only `Dockerfile` and `Dockerfile.server`; no k8s/ingress/nginx/terraform anywhere at `7a0f220`, MEASURED).

### The exploit is not what the one-line summary suggests

I checked the state handling rather than assuming it absent. **The callback validates properly**: state must exist in `pendingStates` (`:172`), be unexpired at 10 min (`:183`), and match platform (`:188`). **An attacker cannot simply hit the callback and write a row.** (MEASURED)

The real defect: **`/api/link/github/install` (`:124`) is unauthenticated and mints a valid state bound to any attacker-supplied `collection_id`** (`:135`, `:148`). The state carries `collection_id` but **not the requesting user's identity — because there is no session to bind to.** (MEASURED)

Most plausible attack (**DERIVED — nothing was executed**):

1. Attacker sends a victim `https://<host>/api/link/github/install?collection_id=<ATTACKER_COLLECTION>`.
2. Victim consents at GitHub.
3. Callback writes the **victim's** GitHub OAuth token — scopes `repo`, `read:org` (`:60`) — into the **attacker's** collection (`:207`, `:209`, `:220`).
4. Attacker reads it back through the normal authenticated, scope-checked path on their own collection.

Classic **missing identity-binding on OAuth state** (OWASP A01 broken access control / OAuth CSRF). Reverse direction — linking an attacker's account into a victim's collection — additionally requires guessing a UUIDv4 collection ID, so it is much weaker.

### Secondary, fully-unauthenticated, lower impact: unbounded memory growth

`CleanExpiredStates` exists at `linkflows.go:465` and is **never called from non-test code** — the only caller anywhere in either tree is `linkflows_test.go:159` (MEASURED). Entries are deleted only on a completed callback (`:174`). Repeated unauthenticated `/install` calls grow `pendingStates` indefinitely → slow memory-exhaustion DoS.

**Notably, the identical bug was already found and fixed in the sibling file**: `oauth.go:117` calls `CleanExpiredOAuthStates()` inline in `handleLogin`, recorded as stage-5 review finding F4 *"State cleanup never called (DoS risk)"* (`.design/project-log/stage5-review-fixes.md:18`). **The fix was applied to one of the two state maps and not the other.** (MEASURED)

### Exposure window — pinned to the minute

- Introduced by **`e32dad9`**, *"feat(auth): add encrypted credential storage, OAuth flows, token refresh, and monitoring"*, committed **2026-07-23 04:05:01 +0000**. Both `-S` searches (`/api/link/github/install`, `CreateLinkedAccount`) point at this commit. (MEASURED)
- Last touched by **`cea72a3`**, *"fix(auth): address stage 6 review findings"*, **2026-07-23 04:28:40 +0000**. (MEASURED)
- Rather than rely on commit dates, I bisected the `origin/main` reflog: `e32dad9` is **not** an ancestor of `c6519ab` (origin/main at 2026-07-23 04:01:30, exit 1) and **is** an ancestor of `36235c3` (pushed 2026-07-23 04:50:44, exit 0). (MEASURED)

**PUBLICATION: 2026-07-23 04:50:44 +0000. WINDOW: 5 days 23 hours — six days.**

*Caveat:* the reflog records when **this clone** observed `origin/main` move. I treat it as exact, but it is reflog-derived, not server-side. **Age bounds the window only; it is not evidence of use in either direction.**

---

## Q3 — IS `TokenAuthInterceptor` ON EVERY `grpc.NewServer`? **THREE OF FOUR. THE OMISSION IS LOW-IMPACT.**

Four non-test call sites; the list is **identical in both trees** (MEASURED).

| # | Site (`7a0f220`) | Interceptor? | Reachability | Mark |
|---|---|---|---|---|
| 1 | `cmd/farmtable-server/main.go:92` | **YES** — `:95` unary, `:96` stream | Public TCP listener | MEASURED |
| 2 | `internal/cli/connect.go:163` | **YES** — `:166`, `:167` | `bufconn`, in-process only | MEASURED |
| 3 | `internal/cli/connect.go:302` | **NO** — only `MaxRecvMsgSize`/`MaxSendMsgSize` | `bufconn`, in-process only | MEASURED |
| 4 | `internal/cli/dashboard.go:87` | **YES** — `:90`, `:91`, *but see below* | `bufconn` + public HTTP listener | MEASURED |

**Answering the brief's specific worry: `connect.go` embedded mode is FINE.** The brief flagged `connect.go:169` as UNCHECKED and predicted a possible omission there. The server is constructed at `:163` (`:169` is the `RegisterFarmTableServiceServer` line) and **the interceptor is attached**. That bound is now closed and it is good news.

**However there is a second site the brief did not know about — `connect.go:302`** (GitHub pass-through mode), which has **no interceptor**. Impact is **LOW**, not thirty-rows-invalidated: it serves on `bufconn` (`:301`), an in-memory listener dialled only by the same process (`:309-312`). It is not network-reachable, and the local user already supplies the token and controls the process. It should still be fixed for consistency — a future refactor that puts this server on a socket would silently make it a hole. **Falsifier: any change binding `connect.go:302`'s server to a `net.Listener`.**

### The wider issue: `FARMTABLE_OPEN_ACCESS=1`

The `lookup == nil` short-circuit the brief describes is real and I confirmed the whole chain:

- `auth.go:113` — `if lookup == nil { return handler(ctx, req) }`, so `authEnforcedKey` (set at `:120`) is never set. (MEASURED)
- `scopes.go:76` — `if ctx.Value(authEnforcedKey) == nil { return nil }` — **`RequireScope` allows everything.** (MEASURED)

**Both production entry points honour an env var that triggers exactly this:** `main.go:66` and `dashboard.go:81` set `lookup = nil` when `FARMTABLE_OPEN_ACCESS=1`. So all 33 RPCs are unenforced whenever that flag is set. This is an **explicit, opt-in, logged** kill switch ("Open access mode enabled"), which is defensible design — but it means the gRPC wall is env-conditional, not absolute. Whether it is set in production is **UNCHECKED**. It appears in committed test/predeploy recipes (`.design/project-log/task-state-model-phase1-predeploy-migration.md:38,111`), which is where I would expect it and not alarming by itself.

Also worth flagging as a standing weakness (in scope of Q3's chain, not a new finding): `scopes.go:83` treats **nil/empty scopes as a wildcard** for backward compatibility. Any legacy token with no scopes set passes every scope check.

*Out of scope but noted:* `internal/testutil/testserver.go` has 7 further `grpc.NewServer` sites. It is a non-`_test.go` file so it compiles into any importer, but it is test infrastructure and I did not classify it. **UNCHECKED.**

---

## Q4 — WHAT ELSE IS ON THE HTTP SURFACE? **THE LIST IS SHORT — AND THAT IS THE GOOD NEWS.**

The coordinator asked me to stop and report if the list were long. **It is not long.** Twelve registrations, ten distinct paths, all in `internal/serverapp/`, identical in both trees (MEASURED). The HTTP surface is **not** a different world from the gRPC one — it is small and fully enumerable, and I completed it.

| # | Route | Registered | AuthN/AuthZ? | Note |
|---|---|---|---|---|
| 1 | `/api/link/github/install` | `linkflows.go:98` | **NO** | **F-1.** Mints state for any `collection_id` |
| 2 | `/api/link/github/callback` | `:99` | **NO identity** | State-validated only; writes token |
| 3 | `/api/link/jira/connect` | `:102` | **NO** | **F-1** |
| 4 | `/api/link/jira/callback` | `:103` | **NO identity** | State-validated only; writes token |
| 5 | `/api/link/linear/connect` | `:106` | **NO** | **F-1** |
| 6 | `/api/link/linear/callback` | `:107` | **NO identity** | State-validated only; writes token |
| 7 | `/api/auth/oauth/google/login` | `oauth.go:96` | NO — *by design* | It *is* the login endpoint; CSRF state at `:136` |
| 8 | `/api/auth/oauth/google/callback` | `oauth.go:97` | NO — *by design* | State-validated `:161`; provisions user `:211` |
| 9 | `/api/auth/session` | `session.go:101` | **PARTIAL / by design** | `POST` = login, validates token (401 at `:143`,`:148`); `GET`/`DELETE` require session cookie (401 at `:187`,`:193`,`:209`) |
| 10 | `/farmtable.v1/` | `unified.go:99` | **YES** | Session→bearer middleware + gRPC `TokenAuthInterceptor` |
| 11 | `/farmtable.v1.FarmTableService/` | `unified.go:100` | **YES** | Same |
| 12 | `/` | `unified.go:101` | NO — *by design* | Static web bundle |

**The crisp distinction that makes this a finding rather than a list:** routes 7–9 and 12 are unauthenticated *correctly* — they are login and public-asset endpoints, and they are the doorway into authentication. **Routes 1–6 are the only ones that perform a privileged, credential-writing state mutation with no identity whatsoever.** They are not "another unauthenticated endpoint among many"; they are the sole anomaly on an otherwise coherent surface. That is *why* this reads as a defect rather than a design choice — and it is consistent with the `unified.go:86-88` comment/code gap above.

---

## D5 — NOT REACHED (each with a falsifier)

| # | Bound | Why not reached | Falsifier |
|---|---|---|---|
| 1 | **Is there an external auth layer (IAP / reverse proxy / ingress / LB) in front of the binary?** | **UNCHECKED AND UNKNOWABLE FROM THIS REPOSITORY.** No infra config is committed (only `Dockerfile`, `Dockerfile.server`; no k8s/ingress/nginx/envoy/terraform at `7a0f220`, MEASURED). The project has a *live* deferred IAP question and ships an IAP implementation wired only to `/farmtable.v1/*`. **Not resolved in either direction, per instruction.** | The LB/IAP/ingress configuration, held outside this repo |
| 2 | Are `FARMTABLE_{GITHUB,JIRA,LINEAR}_CLIENT_ID` set in production? | No deployment manifest in repo; no probing authorised | Prod env/secret manifest. **Highest-value single question** |
| 3 | Is `FARMTABLE_OPEN_ACCESS=1` set in production? | Same | Prod env manifest |
| 4 | Is `origin/main` what is actually deployed, and is the host publicly routable? | Source-and-git only; no network probing authorised | Deployment pipeline / release record |
| 5 | Was the route ever actually called in the six-day window? | **No access logs available and I was not authorised to look for any.** Age bounds the window; it is not evidence of use | Server access logs / LB logs |
| 6 | `internal/testutil/testserver.go` — 7 `grpc.NewServer` sites | Non-`_test.go` but test infrastructure; not classified | Whether any non-test binary imports `testutil` |
| 7 | Full correctness of the Jira/Linear handlers | Verified structurally identical to GitHub (same shape at `:247`/`:364`, `:337`/`:449`); not line-by-line audited | Line-by-line read of `:236-460` |
| 8 | Anything at `160e211` | Ref does not resolve in this clone (exit 128, MEASURED); coordinator confirmed it is out of scope | Access to that branch |
| 9 | Whether the previous leg's "no scope/identity/session check" reading is correct | Out of scope by instruction — I did **not** re-derive it. I independently confirmed no auth code exists *in the file* | Independent re-read at `633f8f2` |

---

## POSITIVE OBSERVATIONS

These are real and should not be lost in the noise:

- **OAuth `state` is implemented properly** in the link flow — cryptographically random (`crypto/rand`, `:112-116`), single-use (`delete` at `:174`), time-bounded (10 min, `:183`), and platform-bound (`:188`). The defect is a *missing identity* binding, not absent CSRF protection. This materially lowers severity and I want it on the record.
- **The CLI dashboard is not affected** — `BaseURL` is simply never passed, so the routes never register.
- `pendingStates` access is correctly mutex-guarded throughout (stage-6 review fix, verified).
- Request body size is limited on session login (`io.LimitReader(r.Body, 4096)`, `session.go:123`) — good DoS hygiene.
- `TokenAuthInterceptor` **is** present on the production server and on the embedded CLI server — the bound the brief was most worried about came back clean.
- `main.go:82-85` **fatals** if `FARMTABLE_AUTH_MODE=proxy` without `FARMTABLE_IAP_AUDIENCE`, with an explicit rationale about unbound audiences. That is exactly the right instinct.
- The IAP JWT verifier has genuinely thorough test coverage per the stage-5 log (expiry, audience, issuer, kid, clock skew, JWKS failure).
- The gRPC surface really is the clean result the previous leg reported; the HTTP surface is small enough to enumerate completely.

---

## RECOMMENDATIONS

1. **Answer bound #2 first.** Whether a platform client ID is set in prod is one question and it decides whether this is an incident or a ticket.
2. **Fix — bind identity to the link flow.** The routes must require an authenticated session *and* verify the caller may write to the requested `collection_id`. The gRPC equivalent costs `collection:admin` (`server.go:1107`); the HTTP path should cost the same. Sketch:
   ```go
   // in RegisterRoutes — require a session before any link handler runs
   mux.Handle("/api/link/", sm.RequireSession(http.HandlerFunc(lm.route)))
   // and inside each handler, after parsing collectionID:
   if err := authz.RequireCollectionAdmin(r.Context(), collectionID); err != nil {
       http.Error(w, "forbidden", http.StatusForbidden)
       return
   }
   ```
   Additionally bind the session's user ID into `linkState` at `:148` and re-verify it at `:172`, so a state minted for one user cannot be completed by another.
3. **Close the `unified.go:86-88` comment/code gap** — either wrap the mux as the comment claims, or correct the comment. Right now the code reads as safe to a reviewer who trusts the comment. This is the defect most likely to recur.
4. **Call `CleanExpiredStates`** — mirror the `oauth.go:117` fix that was already applied to the sibling state map.
5. **Attach the interceptor at `connect.go:302`** for consistency, before a refactor makes it reachable.
6. **Consider retiring the nil-scopes-means-wildcard rule** (`scopes.go:83`) once legacy tokens are migrated.
7. **Process note for the fleet:** tonight's near-miss came from a path written in prose and later pasted as a command argument. *The same string was true as a description and false as an instruction, and nothing marked the transition.* When a brief hands over a literal command, it is worth one paste-and-run before it ships — especially when the measurement is an absence, because **a mis-scoped absence check is the one error that fails toward reassurance.**
