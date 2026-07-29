# sec-verify-f7 — measurement of five security claims

**Base:** `/workspace`, branch `sec-verify`, commit `7a0f220dbd9332cb8db62138c841777432b4eda4` (= `origin/main`).
**Role:** measurement only. No production code was changed. `git status --porcelain` is empty (verified at the end).
**Tags:** `[RAN]` = I executed it and observed the result. `[READ]` = code reading only. `[SPEC]` = relies on documented browser/protocol behaviour I could not execute here.

---

## Baseline (re-measured, all four of the brief's baseline claims hold)

| gate | brief said | I measured | agree |
|---|---|---|---|
| `go build ./...` | 0 | **0** | ✅ |
| `go test ./...` | 0, 10 pkg ok, 0 failing | **0, 10 ok, 0 failing test names** | ✅ |
| `go vet ./...` | 1, exactly 4 copylocks @1500/1610/1818/1995 | **1, exactly 4, same lines, same messages** | ✅ |
| `git status --porcelain` | empty | **empty** | ✅ |

No `TestWatchTasks*` flake fired in my run (single full-suite run).

---

## Verdicts at a glance

| | claim | verdict | evidence | severity |
|---|---|---|---|---|
| **F7a** | `FARMTABLE_OPEN_ACCESS=1` fails open | **CONFIRMED — and BROADER than described** | `[RAN]` | **High** |
| **F7b** | binds `0.0.0.0`, prints `localhost` | **CONFIRMED (narrow)** | `[RAN]` | Low |
| **F7c** | permissive CORS ⇒ cross-origin credentialed write | **REFUTED as stated; a real latent issue remains** | `[RAN]` + `[SPEC]` | Low now / High if SameSite changes |
| **F7d** | empty scopes as wildcard ⇒ typo mints admin | **CONFIRMED — and broader (remote path exists)** | `[READ]`, deep trace | **High** |
| **F7e** | every `buf.validate` annotation is inert | **CONFIRMED as to mechanism; risk MUCH NARROWER than described** | `[RAN]` | Low–Medium |

---

# F7a — `FARMTABLE_OPEN_ACCESS=1` fails open

### VERDICT: **CONFIRMED, and materially broader than the brief describes.** `[RAN]` — end to end, both arms.

**Prediction I recorded before running:** Arm A (no env var) → `CreateTask` rejected `Unauthenticated`; Arm B (`=1`) → `CreateTask` succeeds unauthenticated. **Both correct.**

### Evidence — `ft dashboard`, real TCP, real unauthenticated gRPC client

Probe = a separate Go module in `/tmp` (`replace` → `/workspace`), dialling `127.0.0.1` over h2c with **no credentials of any kind**.

**Arm A — positive control, no env var:**
```
GetVersion        OK                            (exempt endpoint, expected)
ListCollections   ERR Unauthenticated: authentication required
CreateTask        ERR Unauthenticated: authentication required
```

**Arm B — `FARMTABLE_OPEN_ACCESS=1`:**
```
GetVersion        OK
ListCollections   OK n=1
CreateTask        OK id=e828e0c3-a0f5-4a53-acc9-85bb48a2aca0
UpdateTask        OK name=PROBE-armB-unauth-MUTATED
```

An unauthenticated caller **created and then mutated a task**. This is not a code reading; those rows were written.

### The part the brief and the auditor both missed

The finding is scoped to `internal/cli/dashboard.go`. But `cmd/farmtable-server/main.go` — **the binary that `Dockerfile.server` actually ships** — has the same switch *and a second, wider one*:

```go
// cmd/farmtable-server/main.go:64-73
var lookup server.TokenLookup
token := os.Getenv("FARMTABLE_TOKEN")
if os.Getenv("FARMTABLE_OPEN_ACCESS") == "1" {
    log.Println("Open access mode enabled (FARMTABLE_OPEN_ACCESS)")
} else if token == "" {
    log.Println("WARNING: FARMTABLE_TOKEN not set — server running in open access mode")   // lookup stays nil
} else {
    lookup = server.NewStoreTokenLookup(s)
}
```

**No env var is required to fail open. Simply not setting `FARMTABLE_TOKEN` is enough.** Measured `[RAN]`, three arms against `farmtable-server`:

| arm | env | server log | unauthenticated write |
|---|---|---|---|
| **C1** | *(nothing set)* | `WARNING: FARMTABLE_TOKEN not set — server running in open access mode` | **CreateCollection OK, CreateTask OK, UpdateTask OK** |
| **C2** | `FARMTABLE_TOKEN=secret123` | `Token authentication enabled (store-backed)` | all `Unauthenticated` ← positive control |
| **C3** | `FARMTABLE_TOKEN=secret123` + `OPEN_ACCESS=1` | `Open access mode enabled` | **all OK** — env var overrides a configured token |

C3 confirms the env var is an *override*, not merely a default.

### PRECONDITIONS (from this tree only — I did not inspect production, as instructed)

- `Dockerfile.server` (line 20-21): `EXPOSE 8080`, `CMD ["/farmtable-server"]`. **It sets no `FARMTABLE_TOKEN` and no `FARMTABLE_OPEN_ACCESS`.** A container built and run from this Dockerfile with no additional environment is arm **C1** — world-writable.
- `Dockerfile` (the `ft dashboard` image) likewise sets neither.
- There is **no** cloud build/run config, Terraform, k8s manifest, `.env` sample, or deploy script in this tree. `scripts/` contains one unrelated shell script. **I therefore cannot tell you what production actually sets, and I make no claim about it.**
- **Documentation:** `FARMTABLE_OPEN_ACCESS` appears in exactly two code sites and two `.design/project-log/` entries. `.design/project-log/auth-stage1-mandatory-enforcement.md:32-37` documents it as deliberate. It is **not** in `README.md` or `docs/` and is not described as dev-only or warned against. So: *deliberate and internally documented*, but not surfaced to operators.

### SEVERITY: **High**, attacker position depends on deployment

The failure mode is total for the gRPC surface: no identity, and `RequireScope`/`RequireCollectionAccess` both short-circuit to `nil` because `authEnforcedKey` is never set (`internal/server/scopes.go:76-78`, `:101-104`). Reachable by **anyone who can reach the port**. Combined with F7b (binds all interfaces), on a host without a separate network boundary that is any host on the network. Behind IAP it is limited to principals inside the IAP boundary — which still means *every* authenticated employee gets full write, with no per-user scoping and **no attributable identity** (`RequireIdentity` returns `uuid.Nil`).

The `else if token == ""` branch is the one I would treat as the real finding: it is a **silent default**, not an opt-in.

---

# F7b — bind address vs printed address

### VERDICT: **CONFIRMED, and it is exactly as low-stakes as the brief guessed.** `[RAN]`

- **Bind observed, not inferred** — `ss -lntp` while the process was live:
  ```
  LISTEN 0 4096  *:18080  *:*  users:(("ft",pid=14034,fd=9))
  ```
  `*:18080` = all interfaces. Same for `farmtable-server` (`*:18090`, `*:18091`, `*:18092`).
- **Printed text observed:** `Farm Table dashboard: http://localhost:18080` (`internal/cli/dashboard.go:166-167`).
- Source: `listenAddr := fmt.Sprintf(":%d", port)` at `internal/cli/dashboard.go:124`. `[READ]`

### Can an operator bind loopback today?

**No.** `[READ]`, and this is the answer that decides the fix cost:
- `ft dashboard` has exactly two flags: `--port`, `--open` (`dashboard.go:48-49`). No `--host`/`--bind`.
- `farmtable-server` builds `Addr: fmt.Sprintf(":%s", port)` (`main.go:112`); the only knobs are `PORT` / `FARMTABLE_PORT` (`main.go:165-174`).
- Repo-wide grep for `--host`, `BIND`, `LISTEN_ADDR`, `FARMTABLE_HOST` → no hits.

So the capability **does not exist** and this is "add a small feature", not "change a default". That is the more expensive conversation, but the feature is ~5 lines.

Note `farmtable-server` prints `listening on :8080` (`main.go:159`) — **honest**. Only the `ft dashboard` string is misleading.

### PRECONDITIONS / SEVERITY: **Low (informational)**

The misleading string causes no exposure by itself; the exposure is the bind, and the bind is what the Dockerfile needs (a container must bind `0.0.0.0`). The real defect is that a developer running `ft dashboard` on a laptop or shared host reads "localhost" and reasonably concludes they are not exposed. **It is a severity multiplier on F7a-C1, not an independent vulnerability.** Reachable by anyone on the same network segment.

---

# F7c — unconditional CORS origin acceptance

### VERDICT: **REFUTED as stated.** The stated causal chain is backwards. A genuine latent issue remains, one configuration change away.

This is the one the coordinator asked me to try hard to falsify. I did, and I also **falsified the coordinator's own counter-hypothesis** — the answer is neither of the two guesses in the brief.

### 1. The CORS policy is real and is as permissive as claimed `[RAN]`

`internal/serverapp/unified.go:46,48` — both origin funcs `return true`. Confirmed on the wire; preflight from a hostile origin:

```
> OPTIONS /farmtable.v1.FarmTableService/ListCollections
> Origin: https://evil.example
< HTTP/1.1 200 OK
< Access-Control-Allow-Origin: https://evil.example      ← reflected
< Access-Control-Allow-Credentials: true                 ← credentials permitted
< Access-Control-Allow-Methods: POST
< Access-Control-Allow-Headers: Content-Type, X-Grpc-Web, Authorization
```

Reflected origin **plus** `Allow-Credentials: true` is the genuinely dangerous CORS shape. The brief did not mention `Allow-Credentials`; it is the load-bearing header.

### 2. The credential denominator — which credentials does the server actually accept?

The brief asked for the denominator. **On the gRPC-web path it is 3** (4 counting proxy mode). Each measured individually `[RAN]`, with a no-credential control, using correctly framed gRPC-web requests:

| # | credential | accepted? | browser attaches it automatically cross-origin? |
|---|---|---|---|
| 0 | *(none)* — control | **`Grpc-Status: 16`, "authentication required"** | — |
| 1 | `Authorization: Bearer <token>` | **accepted** | **No** — custom header, and an attacker page cannot read another origin's `localStorage` |
| 2 | `X-Farmtable-Token: <token>` | **accepted** | **No** — custom header |
| 3 | `farmtable_session` cookie **alone** | **accepted** | **Yes in principle — but see §3** |
| 4 | IAP JWT (`AuthModeProxy` only) | `[READ]` `unified.go:119-131` | injected by the proxy, not the browser |

Credential #3 is the important one and it **refutes the coordinator's hypothesis**. The session cookie alone, with no `Authorization` header, successfully authorises a gRPC-web call — `SessionToBearerMiddleware` (`internal/serverapp/session.go:251-278`) mints the `Authorization`/`X-Farmtable-Token` headers from the cookie server-side.

The brief supposed the dashboard authenticates from `localStorage`. It does not, primarily. `web/src/gen/grpc-client.ts:417-418`, in the repo's own words:

> `// The primary auth path is now session cookies (POST /api/auth/session).`

`localStorage.getItem('farmtable.token')` at `:419` is labelled the **"dev/testing" fallback**. So *a cookie is what authorises*, and the brief's second branch — "in which case `SameSite: Lax` is doing the work" — is the correct one.

### 3. Why the finding is nevertheless REFUTED as stated

The auditor wrote:

> *"Combined with the session cookie's `SameSite: Lax`, a scripted cross-origin credentialed request is not blocked."*

**This has `SameSite: Lax` backwards.** `Lax` is precisely the control that blocks it. Measured cookie, on the wire `[RAN]`:

```
Set-Cookie: farmtable_session=...; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax
```

Under `SameSite=Lax` `[SPEC]`, a cookie is withheld from cross-site subresource requests, `fetch`/`XHR`, and **all non-safe methods**. gRPC-web is *always* `POST` with `Content-Type: application/grpc-web+proto`, which is never a CORS-simple request. So on a cross-site scripted request the browser **sends no cookie**, and the server sees credential #0 — which I measured returns `Grpc-Status: 16`.

The attacker gains the ability to *read* responses to **unauthenticated** requests. Against a correctly configured deployment that is nothing. (Against an arm-C1/F7a deployment it is everything — but then CORS is irrelevant, since the API is already world-writable to any HTTP client.)

**Honesty about the limit of this measurement:** I verified the server side end to end, but `SameSite` is enforced by the *browser*, and there is no browser in this environment (no Playwright/Puppeteer/Cypress in `web/node_modules`; nothing in `package.json`). §3 is therefore `[SPEC]`, not `[RAN]`. **What would upgrade it:** one headless-Chromium run loading an attacker-origin page that `fetch`es the gRPC-web endpoint with `credentials: 'include'`, asserting no `Cookie` header arrives. I recommend this only if someone wants to change `SameSite`.

Two supporting negative results `[RAN]`: `/api/auth/session` and the static-asset path emit **no CORS headers at all**, so cross-origin JS cannot read the session endpoint or steal a token that way.

### PRECONDITIONS / SEVERITY: **Low today. High the day `SameSite` changes.**

The exposure is currently zero, held there by a **single attribute on one line** — `session.go:55`. `Allow-Credentials: true` with a reflected origin is a loaded weapon with the safety on: any future change to `SameSite: None` (commonly done to support iframe embedding or a split front-end origin) converts it instantly into full cross-origin read/write as the victim. Nothing in the code couples the two, and nothing warns.

**I would close F7c as described and re-open a smaller one:** "CORS reflects any origin with `Allow-Credentials: true`; the only thing preventing CSRF is `SameSite=Lax`." That is a defence-in-depth item, not an incident.

---

# F7d — empty scopes as wildcard

### VERDICT: **CONFIRMED, and broader than "an operator typo".** `[READ]` — deep trace, not executed end to end.

Both sub-claims read true, and — the part the brief flagged as the thing to test — **the join holds: the `default:` branch is reachable from unvalidated input.**

- Wildcard behaviour: `internal/server/scopes.go:83` — `if len(scopes) == 0 { return nil }`. **The brief's line number is correct.**
- Nil-returning default: `scopes.go:145-155`, returns `nil` (= wildcard) after a `log.Printf` warning.

### Reachability — the denominator the brief asked for

Both production sinks read the raw `users.type` **database column**, unfiltered:
1. `internal/serverapp/provisioning.go:141` — `CreateSessionToken`, called from `oauth.go:235` and `unified.go:158` (IAP)
2. `internal/cli/token.go:158` — `ft token create` default scopes

So the question reduces to: what can be written into `users.type`?

**8 paths set a user type; 8 traced to completion; 0 validate against a closed list; 2 carry attacker- or operator-controlled strings.**

| path | source | validates? |
|---|---|---|
| **A. CLI `ft user create --type`** | free-text `StringVar` (`internal/cli/user.go:77`) | **NO** |
| **B. `ImportCollection` RPC** | untrusted JSON in `bytes data` (`export_import.go:583`) | **NO** |
| C. OAuth/IAP provisioning | hardcoded `"human"` (`provisioning.go:92`) | safe by construction |
| D. `ft connect` bootstrap | hardcoded `"agent"` (`connect.go:208`) | safe by construction |
| E. Beads JSONL import | hardcoded `"human"` (`beads_import.go:213,380`) | safe by construction |
| F. import migration author | hardcoded `"service_account"` (`export_import.go:400`) | safe by construction |
| G. GitHub passthrough | echoes/hardcodes, never persists | n/a |
| H. Ent schema default | `field.String("type").Default("agent")` (`schema/user.go:19`) | **no `.Enum()`, no `.Validate()`** |

I verified A, the two sinks, and H by direct read. Confirmed there is **no `TypeValidator`** in generated Ent code (`internal/store/ent/user/user.go:68-69` declares only `DisplayNameValidator`) and **no DB CHECK constraint** (`internal/store/ent/migrate/schema.go:279` — plain string column, default `"agent"`).

**Path B is the one that upgrades this finding.** The brief frames F7d as an operator typo. It is also a **remote privilege escalation**: `ImportCollection` requires only `collection:admin` scope, its payload is opaque `bytes` (so no proto constraint applies even in principle), and it writes `users.type` verbatim. A caller with `collection:admin` can import a user with `type: "reviewr"`, then obtain a wildcard token for it — escalating to full admin. Note that `parseRelationshipType` *is* validated on the same import path (`export_import.go:526, 926-931`); user type simply was not.

**Crucially, the proto enum does not help.** `UserType` is a closed enum (`proto/farmtable.proto:104-109`), but the `User` message is **output-only** — no RPC accepts it as input. `userTypeFromProto` is called from exactly one place, the `ListUsers` *filter* (`server.go:1387`), a read path. **The enum never gates a write.**

### Per the brief's instruction on closed enumerations

The brief warns that this project's most-repeated defect is an incomplete closed enumeration, and asks that an enumeration I cannot prove complete be reported as a lower bound. **In those words: 8 paths is a LOWER BOUND.** I can argue it structurally — `users.type` is written from exactly three expressions repo-wide (`entstore.go:1728`, `entstore.go:2102`, and the schema default), there is no `UpdateUser` in the store interface, no raw SQL, no `.sql` migration files, and no Ent hooks or privacy layer — but three caveats defeat completeness: (i) **direct DB writes** are unconstrained since the column has no CHECK constraint; (ii) I did not audit `test/` or `scripts/` for seed fixtures; (iii) **rows already in a deployed database** could hold arbitrary types written by an older schema.

### SEVERITY: **High**

Two positions: an **operator** (path A, a one-character typo silently grants wildcard instead of a restricted set), and an **authenticated caller inside the boundary holding `collection:admin`** (path B, remote escalation to wildcard). Not reachable by an unauthenticated outsider unless F7a applies.

**Aggravating, and worth more than the finding itself:** `internal/server/convert.go:202-213` collapses **any** unrecognised type string to `USER_TYPE_AGENT`. A user stored as `"reviewr"` therefore *displays as `AGENT`* in `ft user get`, the dashboard, and MCP — while holding wildcard scopes. The escalation is **invisible to every read surface in the product**. The only signal is the `log.Printf` at `scopes.go:153`, which is detective, not preventive.

---

# F7e — every `buf.validate` annotation is inert

### VERDICT: **CONFIRMED as to mechanism. The risk framing is substantially over-claimed.** `[RAN]`

The auditor ranks this first. **I disagree** — see the ranking section. The mechanism claim is exactly right; the "whole-schema false sense of validation" characterisation does not survive measurement.

### 1. The counts, re-measured from scratch — and my method's blind spots

**142 field-level `buf.validate` annotations.** Not "two", not the total I might have inherited.

| constraint | count |
|---|---|
| `string.uuid = true` | 40 |
| `string.min_len` (all `= 1`) | 30 |
| `enum.defined_only = true` | 24 |
| `enum = {defined_only: true...}` | **21** ← *different spelling, same constraint* |
| `int32 = {gte,lte}` / `int64.gte` | 11 |
| `required = true` | 10 |
| **`string.uri = true`** | **4** |
| `string.email = true` | 1 |
| `bytes.min_len = 2` | 1 |
| **total** | **142** |

**The brief's warning was justified and the two spellings are the trap**: `enum.defined_only = true` (24) and `enum = {defined_only: true}` (21) are the same constraint written two ways. Anyone counting with a single literal pattern lands on 24 or 21 and misses 45.

**Method and what it would miss** (as required): I enumerated occurrences of `(buf.validate.field)` with a character-class tail and cross-checked the breakdown sums to the total (40+30+24+21+11+10+4+1+1 = 142 ✅). Cross-check: 142 lines match `buf\.validate` literally; 143 match `buf.validate` as a regex — **the 143rd is the import at line 13**, `import "buf/validate/validate.proto";`, not an annotation. Verified **no** line carries two annotations and **no** multi-line form exists. My pattern **would** miss message-level (`option (buf.validate.message)`), oneof-level, `predefined`, and CEL (`.cel`) constraints — so I grepped for those explicitly: **none exist.**

**On the brief's own cautionary tale:** the brief's `string.uri = true` count of **4** at lines **241, 265, 343, 633** is **correct** — I reproduced it exactly. This is one of the few relayed figures that survived.

### 2. Is protovalidate instantiated? **No — and it is stronger than "not instantiated".** `[RAN]`, with two positive controls

- `grep protovalidate cmd/ internal/` → **zero references.**
- **Positive control #1** (same dirs, same grep style, symbol known present): `UnaryInterceptor` → 4 hits incl. `cmd/farmtable-server/main.go:95`. The grep works.
- **Positive control #2** (the term *is* findable in this tree): `protovalidate` → `api/farmtable/v1/farmtable.pb.go` only, i.e. generated descriptors.
- **The finding that sharpens this:** the runtime validator module **`buf.build/go/protovalidate` is absent from `go.mod` *and* `go.sum` entirely.** The only protovalidate module present is `buf.build/gen/go/bufbuild/protovalidate/protocolbuffers/go` (`go.mod:6`) — the *annotation descriptor* codegen package, which carries no validation engine.

So it is not "wired up but never called". **The validator is not a dependency; it could not be called.** All 142 annotations are inert. The brief's `[MEASURED-BY-EM]` claim re-measures true, and is understated.

### 3. Is validation happening by another mechanism? **Yes — for 139 of 142.** `[RAN]`

This is the distinction the coordinator asked me to protect, and it is where the finding deflates. I ran violating values against a live server (in open-access mode, so auth could not mask validation):

| constraint tested | result | enforced by |
|---|---|---|
| `min_len` — `CreateCollection name=""` | **REJECTED** | **Ent schema validator** — `ent: validator failed for field "Collection.name"` |
| `min_len` — `CreateTask name=""` | **REJECTED** | **hand-rolled** — `InvalidArgument: name is required` |
| `string.uuid` — `collection_id="NOT-A-UUID"` | **REJECTED** | **`uuid.Parse`** — `invalid UUID length: 10` |
| `enum.defined_only` — `stage=9999` | **REJECTED** | **hand-rolled** `validateDefinedEnum` (`server.go:61-66`) |
| `int32 {gte:1,lte:200}` — page_size | **clamped** `[READ]` | hand-rolled, 10 sites (`server.go:370-374` etc.) |
| **`string.uri` — `remote_url`** | **ACCEPTED** | **nothing** |

```
remote_url="javascript:alert(1)"       -> stored "javascript:alert(1)"        *** ACCEPTED ***
remote_url="not a uri at all"          -> stored "not a uri at all"           *** ACCEPTED ***
remote_url="data:text/html;base64,..." -> stored verbatim                     *** ACCEPTED ***
remote_url="   "                       -> stored "   "                        *** ACCEPTED ***
```

**Conflating "inert" with "unvalidated" would have misdirected this fix badly.** 139 of 142 annotations are decorative *and redundant* — the constraint they express is independently enforced by Ent validators, `uuid.Parse`, or hand-rolled handler checks. Wiring up protovalidate would, for those, change nothing except the error text.

### 4. Which inert annotations would actually matter if violated — the ranked list

Filtering to annotations that are inert **AND** unenforced elsewhere **AND** on a message that is an **RPC input** (an output-only annotation has no attack surface — nothing external can violate it):

1. **`UpdateTaskRequest.remote_url` — `proto/farmtable.proto:633` — the only one that genuinely matters.** An RPC input, at the write boundary, accepting `javascript:` and `data:` URIs verbatim, **proven by execution**. This is the field that reaches an `href`. **Already assigned to another leg** (the URL-validation track) — noting the overlap and moving on, per the brief.
2. `ImportCollectionRequest.data` — `:751` — `bytes.min_len = 2`, an RPC input, but effectively covered: a 0–1 byte payload fails JSON/format detection anyway. Negligible.
3. *Everything else: no attack surface.* The other three `string.uri` (`:241` `Attachment.url`, `:265` `PullRequest.url`, `:343` `Task.remote_url`) are on **output/entity** messages, as are all 10 `required` (`Task`, `Collection`, `Comment`, `Change`, `LinkedAccount`, `WebhookEvent`, `CustomFieldValue`) and the single `string.email` (`:224`, `User`). None is accepted as RPC input, so no external caller can violate them.

**Worth flagging to avoid a repeat of the brief's own error:** line **343** is `Task.remote_url` (output-only); the write-boundary field is line **633**, `UpdateTaskRequest.remote_url`. These are easy to swap and they have opposite risk.

### PRECONDITIONS / SEVERITY: **Low–Medium**, and only one field is live

No precondition — the annotations are inert in every deployment. But the exploitable surface is **one field**, already owned by another leg. Reachable by any caller authorised to update a task (inside the boundary), or by anyone at all under F7a.

**What a fix would involve, and its blast radius** (a sentence, not a recommendation): adding the `buf.build/go/protovalidate` dependency and a validating interceptor is a *new dependency plus a global behaviour change*. Because 139 annotations are currently unenforced-but-redundant, turning them on would begin rejecting requests that hand-rolled checks presently accept — most consequentially the **40 `string.uuid`** and **45 `enum.defined_only`** constraints, whose hand-rolled equivalents may differ at the edges (empty-string, unset-optional, and zero-enum cases). That is a compatibility review of 142 fields, not a wiring task, which is exactly why it should be decided knowing the above rather than reflexively.

---

# Deliverable 2 — my own risk ranking

**I do not agree with the auditor that F7e comes first.** The auditor's reasoning — "a repo-wide belief that a control exists when it does not" — is a fair description of the *mechanism*, but measurement shows the belief is *mostly true by other means*: 139 of 142 constraints are independently enforced. F7e's real content is one field, and that field is already assigned. Ranking it first would spend a night wiring a global validator to fix something another leg is already fixing.

| rank | claim | why |
|---|---|---|
| **1** | **F7a — specifically the `FARMTABLE_TOKEN` unset branch** (`main.go:68-70`) | The only finding that is **on by default**, needs no attacker skill, and is **proven by execution** to permit unauthenticated writes. `Dockerfile.server` as committed produces this configuration. Not a bypass to be triggered — a default to be corrected. Amplified by F7b. |
| **2** | **F7d** | Silent privilege escalation to wildcard, **two** unvalidated paths, one of them **remote** (`ImportCollection`, `collection:admin` → admin), and **invisible to every read surface** because `convert.go:211` renders the escalated user as `AGENT`. The invisibility is what moves this above F7e: you cannot audit your way out of it. |
| **3** | **F7e** | Mechanism confirmed, blast radius one RPC-input field (`:633`), already owned elsewhere. Keep open as a **documentation/decision** item ("these annotations are decorative"), not an engineering push. |
| **4** | **F7b** | Real but informational. Its value is as a severity multiplier on #1 and as a cheap ergonomics fix. |
| **5** | **F7c** | **Refuted as stated.** Retain only as a defence-in-depth note. |

### Which of the five to close with no action

- **F7c — close as described.** The stated mechanism is backwards; exposure today is zero. Replace with a one-line code comment at `session.go:55` recording that `SameSite=Lax` is load-bearing given `Allow-Credentials: true`, so nobody removes it casually. **No engineering work.**
- **F7e — close the "whole-schema" framing; do not open a protovalidate project.** The one field that matters is already assigned. If anything remains, it is a note in the proto that the annotations are not enforced.
- **F7b — close or fold into F7a.** Not worth its own ticket; the print-string fix is two lines and belongs with whatever touches the bind.

That leaves **two** items genuinely worth a night: **F7a (the unset-token default)** and **F7d**.

---

# Deliverable 3 — found while looking, NOT one of the five

Surfacing, not chasing.

1. **`cmd/farmtable-server/main.go:68-70` — fail-open when `FARMTABLE_TOKEN` is unset.** Formally part of F7a but a *different trigger* with a *different precondition* (default vs opt-in). If only one thing is fixed, this is it. `[RAN]`
2. **`internal/server/convert.go:202-213` masks the F7d escalation.** Any unrecognised user type renders as `USER_TYPE_AGENT`. An escalated account looks normal in CLI, dashboard, and MCP. This is a *detection* defect and outlives any single fix. `[READ]`
3. **GET-only state-changing link-flow endpoints.** `/api/link/{github,jira,linear}/{install,connect,callback}` are all `r.Method != http.MethodGet → reject` (`linkflows.go:125,160,237,277,354,389`), as is the OAuth callback. `SameSite=Lax` **does** send cookies on cross-site *top-level navigations*, so these are reachable cross-site in a way the gRPC-web POST path is not. Worth a CSRF look; independent of CORS (navigations aren't gated by CORS). `[READ]`
4. **`FARMTABLE_SESSION_KEY` unset ⇒ a fresh random key per process** (`session.go:79-84`). Fine locally. On a multi-replica deployment, replicas would not share a key and sessions would fail unpredictably across them — a reliability trap adjacent to a security control. No warning about weak or shared keys either. `[RAN]` — observed the log line on every start.
5. **`LegacyTokenAuth`** (`auth.go:241-246`) is deprecated and documented as test-only, but still exported and compiled into production binaries. Low risk, easy cleanup. `[READ]`

Overlap noted per the brief: the two `href` XSS sinks and the missing CSP are assigned elsewhere; item (1) of the F7e ranked list feeds one of them. Not pursued.

---

# Deliverable 5 — every place the brief was wrong

The brief asks for this and warns there will be errors. There are. Most are minor; **two are material.**

### Material

1. **F7a is scoped to the wrong file, and misses the more dangerous trigger.** The brief cites only `internal/cli/dashboard.go`. `cmd/farmtable-server/main.go:66` has the same env var, **and `:68-70` fails open merely because `FARMTABLE_TOKEN` is unset — no env var at all.** `Dockerfile.server` sets neither. The framing "one env var makes the API world-writable" understates it: **zero env vars** make the shipped server image world-writable. Measured `[RAN]`.
2. **F7c's causal claim is backwards, in the relayed quote.** *"Combined with the session cookie's `SameSite: Lax`, a scripted cross-origin credentialed request is not blocked."* `SameSite=Lax` is exactly what **does** block it. The actual risk driver is the unmentioned **`Access-Control-Allow-Credentials: true`** with a reflected origin, which `Lax` currently neutralises.

### The brief's own hypotheses, tested as instructed

3. **The coordinator's F7c counter-hypothesis is also refuted.** The brief supposes the dashboard authenticates "with a bearer token from `localStorage`, not obviously a cookie". The repo says the opposite: `web/src/gen/grpc-client.ts:417-418` — *"The primary auth path is now session cookies (POST /api/auth/session)"*; `localStorage` is the labelled dev/testing fallback. A cookie **is** what authorises, and it **is** accepted alone (measured). The brief's second branch was the right one. *(Requested explicitly: this is a prediction the brief got wrong, and it is the more informative outcome.)*
4. **F7d is understated.** Framed as an operator typo. It is also a **remote** escalation via `ImportCollection` (`collection:admin` → wildcard) whose payload is opaque `bytes`, so no proto constraint could ever apply.
5. **F7e's risk framing is over-claimed.** "A whole-schema false sense of validation" — measured, 139 of 142 constraints are independently enforced (Ent validators, `uuid.Parse`, hand-rolled checks). The genuine gap is **one RPC-input field**.

### Line numbers and citations

6. **`internal/cli/dashboard.go:162`** (printed address) — **wrong**. The `fmt.Printf` is at **166-167**; `url` is built at 166.
7. **`internal/server/auth.go:112-114`** — off by one. `if lookup == nil { return handler(ctx, req) }` is at **113-115**; 112 is the closure signature.
8. **`internal/cli/dashboard.go:81-84`** — off by one at the end; the `if/else` block closes at **85**.
9. **F7e, implied line attribution.** The brief names `UpdateTaskRequest.remote_url` as the write-boundary field but does not pin its line; a reader pattern-matching against the listed lines could land on **343**, which is `Task.remote_url` (**output-only**). The write boundary is **633**. Opposite risk profiles.

### Verified correct (checked, so the list is falsifiable)

- `internal/serverapp/unified.go:46-48` ✅ · `internal/server/scopes.go:83` ✅ · `internal/cli/dashboard.go:124` (bind) ✅
- `string.uri = true` count **4** at **241, 265, 343, 633** ✅ — reproduced exactly
- All four baseline gates ✅ — build 0; tests 0 with 10 ok / 0 failing; vet 1 with exactly 4 copylocks at 1500/1610/1818/1995 with identical messages; porcelain empty
- `go build` does fail without `web/dist`, as warned (not re-triggered; `web/dist` left untouched)

---

# Method, and the limits of it

- **Probes lived entirely outside the repo** — a separate Go module in `/tmp/ftprobe` with `replace github.com/farmtable-io/farmtable => /workspace`. No file in `/workspace` was created, edited, or deleted. Temp SQLite DBs and temp `HOME`s under `/tmp`. Final `git status --porcelain` → **empty**.
- **Exit codes taken from the child process directly**, never through a pipe.
- **Every negative result has a positive control**: F7a arm A and C2; the F7c no-credential control (`Grpc-Status: 16`); two independent positive controls for the protovalidate grep.
- **One measurement error I made and corrected mid-run, recorded because it changes how much you should trust raw curl output:** my first CORS probe sent `--data-binary $'\x00\x00\x00\x00\x00'`, but bash truncates strings at NUL, so the body was empty and both the authenticated and unauthenticated arms returned an identical `Grpc-Status: 2 / EOF` — a *framing* error I could have mistaken for an auth result. Rebuilt the 5-byte gRPC-web frame with `python3` into a file; only then did the arms separate (16 vs success). **Any earlier read of that first probe would have been wrong.**
- **Not executed:** browser `SameSite` enforcement (§F7c.3) — no browser available; tagged `[SPEC]`. F7d's full exploit chain was traced and its components verified by read, but I did not run the OAuth login end to end; tagged `[READ]`.
- **I did not inspect production**, per instruction. All precondition statements are about this tree only, and this tree contains **no** deploy manifests beyond the two Dockerfiles.
