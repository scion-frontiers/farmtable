# Are GitHub-backed collections active in production? (issue #198 urgency check)

**Investigator:** inv-github-collections-prod · **Date:** 2026-07-27 · **Read-only investigation**

## Bottom line

**The collection is ACTIVE, but the race's specific trigger is currently RARE.**

GitHub passthrough is emphatically *not* dormant — there is live, daily, successful traffic
against a GitHub-backed collection, most recently **today, 2026-07-27T20:06Z**. But the heavy
concurrency in production is **read-only RPCs, which never touch the racy fields**. The race
needs two concurrent *mutating* RPCs, and production has seen roughly **5 write-path RPCs in
the entire ~7-day log retention window, none of them overlapping**.

My recommendation: **fix it in the next normal deploy — not a wake-someone-up same-day
hotfix, but do not let it ride behind the whole Task State Model chain either.** The fix is
XS (~10 lines, one mutex, self-contained, no design needed) while the blast radius is a
full-process crash affecting every tenant. That asymmetry, plus the fact that write volume
could rise at any time with zero warning, argues for landing it in days, not weeks.

This is a **downgrade from my initial flash message to the coordinator**, which reported the
79 overlapping request pairs as if they directly implicated the race. They do not — see
"Correction" below.

## 1. Collection count

Queried production Postgres directly (Cloud SQL `scion-postgres-test`, db `farmtable`, via
public IP — the instance has `authorizedNetworks: 0.0.0.0/0` and `requireSsl: false`).

| platform | count |
|---|---|
| farmtable | 23 |
| **github** | **2** |

| id | name | remote_id | created |
|---|---|---|---|
| `466c2baa-334e-439c-b9f9-abbe89eb8aae` | github-mirror-scion-frontiers-farmtable-20260720 | scion-frontiers/farmtable | 2026-07-20 |
| `39a35ce4-8ef5-462c-8b24-773b116813dd` | D17-Phase2-Test | scion-frontiers/farmtable | 2026-07-22 |

Both have **0 local task rows** — confirming true passthrough. Task state lives in GitHub, so
`tasks.updated_at` is useless as an activity signal for these collections. All activity
evidence below therefore comes from Cloud Run logs and the GitHub API.

## 2. Most recent activity

**`466c2baa` — actively used, works fine.**

- Most recent request: **2026-07-27T20:06:18Z (today)**.
- ~1,417 attributable RPCs across 07-20 → 07-27. Log retention is effectively ~7 days.
- Unmistakable GitHub round-trip signature: `ListTasks` 0.76–1.2s / 86 KB payloads (native
  collections: ~0.02–0.05s), `ListComments`/`ListChanges` 3–6s.
- Corroborated by rate-limiter logs (`internal/platform/github/ratelimit.go:125,150`) whose
  timestamps match request latencies exactly, e.g. 07-23T02:14:17.962 `ListTasks` 300.000s/504
  ↔ 02:14:18.04 `"github: rate limit low, sleeping 18m31s"`.

**`39a35ce4` — effectively idle.** 43 RPCs, last activity 2026-07-24T19:02Z, read-only, no
concurrency. Its `ListTasks` returns 331–583 B in ~0.02s — no GitHub round trip. It has **no
`linked_accounts` row**, so `lazyResolve` returns nil and it silently falls through to the
native Postgres store. **It is not actually exercising passthrough at all.**

### Credential red herring (worth knowing, not blocking)

The one github `linked_accounts` row is `status='expired'`, `last_validated_at =
2026-07-23T05:51:31Z`. **This is a false positive and does not gate anything.** It was set at
the exact moment of a transient `TLS handshake timeout` on `api.github.com/user`. Evidence the
token is still good: **every** GitHub-path request after that timestamp returned **HTTP 200**
(662/662), including three successful `UpdateTask` **writes** on 07-24. There are zero
401/403/"Bad credentials" anywhere in the logs.

Two latent bugs fall out of this, both out of scope here but worth filing:
- `internal/serverapp/credmonitor.go:90-98` — `checkAll` filters `Status: &active`, so once an
  account is flipped to `expired` it is **permanently excluded from all future sweeps**.
  `expired` is a sticky, unrecoverable state latched by a single network blip.
- `internal/store/multistore.go:122-131` — `lazyResolve` reads linked accounts with **no status
  filter** and uses `accounts[0].AuthToken` regardless. So `expired` is purely cosmetic and
  never gates the data path. (Fortunate today; also means the status field is untrustworthy.)

## 3. Concurrency evidence — and why it does not implicate this race

**Concurrency is real and substantial:** 79 overlapping request pairs where both requests
target `466c2baa` *and* land on the same Cloud Run instance (therefore sharing one cached
`GitHubPassThroughStore` — `multistore.go:107` `lazyResolve` caches per collection). Peak 6
simultaneous in-flight on one instance. Examples:

```
inst 001548f72994  2026-07-27 18:49:02.049 ListComments 5.995s
                   2026-07-27 18:49:02.053 ListChanges  3.316s   -> overlap 5.992s
inst 001548f7298b  2026-07-24 23:07:03.257 UpdateTask   5.623s   (WRITE)
                   2026-07-24 23:07:05.343 ListTasks    0.960s   -> overlap 3.536s
```

**But the racy fields are only touched by three methods.** I verified this by exhaustive grep
of every reference to `s.repoID` / `s.labelIndex` / `ensureRepoID` / `ensureLabelIndex` /
`labelNameToID` in the whole package. The complete set of callers is:

- `CreateTask` (`passthrough.go:255,258,266,274,281`)
- `UpdateTask` (`:344,361,378,395,404`)
- `ClaimTask` (`:544`)

`ListTasks`, `ListComments`, `ListChanges`, `GetTask`, `ListUsers`, `WatchTasks` — **none of
them touch `repoID` or `labelIndex`.** So all 79 overlapping pairs above are read/read or
read/write against *disjoint* state. They are not race triggers.

**Actual write-path traffic is tiny.** Post-07-23 against `466c2baa`: `UpdateTask` ×3 only
(07-24 at 18:45:50, 23:07:03, 23:07:22 — all 200). Pre-07-23: `UpdateTask` ×2, `AddComment` ×1
(`AddComment` is not a racy path either). The two closest writes are 13s apart; the 23:07:03
call finished at ~23:07:08.6, well before 23:07:22 began. **No two mutating RPCs have
overlapped in the observable window.**

**No crashes.** Zero hits for `fatal error`, `concurrent map`, `panic`, `SIGSEGV`, or
`runtime error` across a 60-day log sweep. All shutdowns are graceful or Cloud Run scale-down.

### Blind spot I closed

Collection attribution in Cloud Run logs comes *only* from the browser `Referer` query param,
so CLI/MCP/agent traffic is unattributable — and there **are** non-referer `CreateTask`/
`UpdateTask` calls from a GCP-range caller (`34.171.233.74`, agent automation). Those could in
principle have been concurrent writes to the GitHub collection.

I ruled this out from the GitHub side. The mirrored repo `scion-frontiers/farmtable` shows
bursty issue creation (#171/#172/#173 all created at **exactly** `00:49:37Z`; #183/#184 two
seconds apart) — exactly the pattern that *would* trigger the race. But those issues were
**not** created through passthrough:

1. They carry plain `bug` / `enhancement` / `documentation` labels. Farmtable's passthrough
   push applies a `ft:` prefix (`LabelConfig.PushPrefix`, default `"ft:"`, `config.go:37-39`).
   No `ft:`-prefixed label appears on any of them.
2. **Decisive timing argument:** observed passthrough `CreateTask` latency is 4–6s per call
   (real GraphQL round trips). Creating three issues within the *same one-second tick* is
   physically impossible through that path. These came from `gh`/GitHub API directly.

So the audit automation writes to GitHub natively, and reads it back through the farmtable
dashboard. That is precisely why prod traffic is read-heavy and write-light.

## 4. Judgment: reachable-now vs dormant

**Reachable, but low-probability under current observed traffic.** Precisely, the trigger needs
all three of:

1. Two concurrent calls from {`CreateTask`, `UpdateTask`, `ClaimTask`} — observed rate ~5/week,
   never overlapping;
2. On the same Cloud Run instance — plausible: `maxScale: 4`, `containerConcurrency: 80`, so
   most traffic lands on one instance;
3. With a **cold** `labelIndex` (still nil). Note this condition is *usually satisfied*: there
   are 6–40 cold starts/day against ~5 writes/week, so nearly every write hits a fresh
   instance. Once populated the map is read-only and safe.

Condition (1) is the only real barrier, and it is a traffic-pattern accident, not a structural
guarantee. Any authenticated caller can trigger it deliberately, and it would fire immediately
if someone pointed the existing bursty audit automation at the farmtable API instead of `gh`.

**Recommended urgency: land the mutex in the next normal deploy (days).** Do not queue it
behind the full Task State Model chain, and do not treat it as an emergency page.

### Correction to issue #198

#198's cited examples are partly inaccurate and would mislead whoever fixes it:

- **`CloseTask` does not touch the racy state at all** (`passthrough.go:579-607` — it calls
  `listIssues`/`closeIssue` directly, never `ensureLabelIndex`). So "two concurrent CloseTasks"
  and the `CloseTask` half of "CreateTask+CloseTask" are **not** valid triggers.
- "`ClaimTask`+`UpdateTask`" **is** valid.
- The real trigger set is exactly {`CreateTask`, `UpdateTask`, `ClaimTask`} × {same} on a cold index.

The issue's *diagnosis* of the defect and its proposed fix are otherwise correct, and
`MultiStore.platforms` itself is properly guarded by an `RWMutex` with correct double-checked
caching (`multistore.go:84-153`) — there is no second, broader race at that layer.

## 5. Scope

**XS.** Add a `sync.Mutex`/`RWMutex` to `GitHubPassThroughStore` guarding `ensureRepoID`,
`ensureLabelIndex`, and `labelNameToID`. Only two mutable fields exist on the struct
(`repoID` at `:87`, `labelIndex` at `:99`) — everything else is set at construction. No
architect needed. Note for the implementer: the natural `RWMutex` shape has a
check-then-upgrade pattern; simplest correct version is a single `sync.Mutex` held across the
whole ensure call, since these run once per store lifetime and are already behind a network
round trip.

## Open questions

- **Cannot rule out concurrent writes before 2026-07-20.** Cloud Run log retention is ~7 days;
  the collection was created 07-20 so this is nearly full coverage, but not quite.
- **Non-referer traffic remains structurally unattributable.** My GitHub-side cross-check
  (labels + sub-second burst timing) is strong circumstantial evidence, not proof. Adding
  per-RPC server-side logging with collection ID + method would close this permanently, and is
  worth doing regardless.
- **`39a35ce4`'s missing linked account** — is that intentional (an abandoned test) or a
  half-finished setup that someone will complete, converting it into a second live passthrough
  collection? Worth a one-line confirmation from whoever created it on 07-22.

## Method / reproduction notes

- DB: direct `lib/pq` connection from a throwaway Go program in `/tmp/dbq`, password from
  Secret Manager (`farmtable-db-password`). **SELECT statements only; no writes, no schema
  changes, no code touched in `/workspace/farmtable`.**
- Logs: `gcloud logging read 'resource.type="cloud_run_revision" AND
  resource.labels.service_name="farmtable"' --project=deploy-demo-test --freshness=60d`.
  Note `--freshness` defaults to 1d and will silently truncate results if omitted.
- GitHub: `gh api repos/scion-frontiers/farmtable/...`. Plain `gh issue view` fails in this
  repo with a Projects-classic GraphQL deprecation error; use `gh api` instead.
