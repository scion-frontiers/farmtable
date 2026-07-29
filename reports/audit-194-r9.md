# audit-194-r9 — security audit (authorization axis) of `label-write-scope-r9` @ `06f01d7`

**Verdict: REQUEST CHANGES** — narrowly, on one item introduced by this change (Finding 1).
The rest of the round is high-quality work and the author's own report is the most honest
I have reviewed on this project. The change is a **net improvement**; it also contains one
regression that contradicts the ruling it cites, in the same commit.

Tree: `/workspace` (`git rev-parse --show-toplevel`), branch `label-write-scope-r9`,
commit `06f01d7d6555a311fcd0728eac40335e654c1de6`, `merge-base HEAD 158c8ae` = `158c8ae`.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 3 |
| Low | 1 |
| Informational | 2 |

Only **Finding 1** is introduced by this change. Findings 2 and 3 are pre-existing but are
**wider than the escalation on record**, and matter now because r10 is about to be scoped
from that escalation.

## My gate baseline `[MEASURED]` — reconstructed, not inherited

Exit codes read from `$?` of the child, no pipe.

| gate | observed |
|---|---|
| `go build ./...` | 0 |
| `go test ./...` | 0, zero FAIL lines (flake did not fire) |
| `go vet ./...` | 1 — the **same 4** copylocks, compared by **message**, not count |
| `git status --porcelain` | empty, before and after every probe |

The 4 vet messages matched the baseline block verbatim (`server.go:1782/1892/2100/2277`,
`GetReadyTasks/GetBlockedTasks/GetCriticalPath/GetBottlenecks`). Diffed as text, so "a
different 4" would have been caught.

All probes were added as new `_test.go` files only. **No production file was modified.**
Reverted by snapshot restore (`cp -a` from `/tmp/snap`), never `git checkout`.

---

# Findings

## [MEDIUM] Finding 1 — MUST 5(a) moves a WRITE-side gate onto the `enabled` toggle, which is the defect the round-9 ruling forbids

**This is the answer to the brief's item 1: YES, MUST 5 creates a second instance of the ruled defect.**

- **Location:** `internal/platform/github/terminal_label_stages.go:69-72` (the added guard);
  consumed as a write-side gate at `internal/platform/github/passthrough.go:302-325`
  (`assertStageWriteAllowed`), reached from `passthrough.go:351` (`writeLabelSwap`).
- **Introduced by:** `794bdce` (MUST 5a).

**Description.** `authorizationStage` is a *shared* predicate. It serves the read side
(`AllTerminalLabelStages`, `StageLabelSwap`'s "is this ours to remove") **and** the write
side (`assertStageWriteAllowed`, the `stageWriteForbidden` control). MUST 5(a) added
`if !m.enabled { return "", false }` inside it. Because the predicate is shared, the toggle
now reaches the write side too.

The round-9 ruling states: *"the scope required to WRITE a lifecycle-prefixed label must never
depend on `enabled`. Only the read/authorization-derivation side varies with the toggle; the
write side does not vary at all."* A predicate used by both sides cannot resolve in two
directions at once — and this commit put the toggle inside it.

**Evidence `[MEASURED]`.** Probe in-package, reconstructing the pre-commit predicate (today's
body minus the guard) so the differential is measured rather than argued:

```
enabled=true  (POSITIVE CONTROL)
  SHIPPED   authorizationStage("ft:stage/completed") = ("completed", true)
  PRE-MUST5 authorizationStage("ft:stage/completed") = ("completed", true)
  assertStageWriteAllowed(add,    stageWriteForbidden) -> refusing to add lifecycle label …
  assertStageWriteAllowed(remove, stageWriteForbidden) -> refusing to remove lifecycle label …

enabled=false
  SHIPPED   authorizationStage("ft:stage/completed") = ("", false)
  PRE-MUST5 authorizationStage("ft:stage/completed") = ("completed", true)     <-- would have refused
  assertStageWriteAllowed(add,    stageWriteForbidden) -> <nil>                <-- now PERMITS
  assertStageWriteAllowed(remove, stageWriteForbidden) -> <nil>                <-- now PERMITS
```

Both arms of the control produce **different messages** ("refusing to add" vs "refusing to
remove"), so the two are not a colliding oracle. `stageWriteAllowed` returned `nil` in every
arm, as designed — that is the third control, confirming the harness drives the real function.

So MUST 5(a) is **not** the no-op the report describes. It converts a *refusing* write-side
backstop into a *permitting* one whenever the toggle is off. The author measured "adding the
guard changed no existing test" — true, and I reproduce it — but *no test covers this
predicate on the write path*, so a green suite is not evidence of no change. The
counterfactual above is.

**Impact.** Latent, not exploitable today. I verified the author's reachability claim myself
rather than accepting it: the only two `stageWriteForbidden` call sites
(`passthrough.go:615`, `:626`) receive their labels from `PriorityLabelSwap` / `TypeLabelSwap`,
both of which return `nil, nil` at `!m.enabled` (`labels.go:427`, `:503`). So the lists are
empty and the gate has nothing to refuse. **No current caller can observe it.**

What makes it worth reporting anyway is that the guard's *stated purpose* is to protect the
caller that does not exist yet — `terminal_label_stages.go:64-66`: *"the next caller added to
this function inherits the rule instead of having to know it."* The rule it now inherits is
**"at `enabled=false`, nothing is a lifecycle label"**, which is the wrong rule for a write
gate. The commit inverts the safety direction for precisely the population it was written to
protect. `config.go:282-283` designates `assertStageWriteAllowed` as *"the backstop for every
route into the writer that does not pass through Validate"* — this weakens that backstop.

The internal contradiction is visible inside the single commit `794bdce`: half (b) rebuilds
the mapper as `asIfEnabled` so that *config* correctness cannot depend on a flippable flag,
with the explicit rationale *"it is fine because the feature happens to be off today"* is
exactly the state-dependent correctness this workstream has spent the night removing. Half (a)
then applies the opposite reasoning to a write gate.

**Recommendation.** The guard is *redundant* on the read side (every read caller already
short-circuits — the author re-measured all of them, and so did I) and *harmful* on the write
side. Cheapest correct fix is to drop it and keep the toggle at the read-side callers where it
already lives:

```go
// terminal_label_stages.go — revert to the 158c8ae body
func (m *LabelMapper) authorizationStage(raw string) (task.Stage, bool) {
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(raw)), m.matchPrefix()) {
		return "", false
	}
	stage, ok := m.labelToStage[m.stripForMatch(raw)]
	return stage, ok
}
```

If the "next caller inherits the rule" goal is to be kept, split the predicate rather than
overloading it, so the two sides cannot be conflated again:

```go
// readers: authority follows the toggle.
func (m *LabelMapper) authorizationStageForRead(raw string) (task.Stage, bool) {
	if !m.enabled {
		return "", false
	}
	return m.lifecycleStageOfLabel(raw)
}

// writers: what a label WILL mean is independent of today's toggle.
func (m *LabelMapper) authorizationStageForWrite(raw string) (task.Stage, bool) {
	return m.lifecycleStageOfLabel(raw)
}
```

`assertStageWriteAllowed` calls the `ForWrite` variant. Keep
`TestAuthorizationStage_IsSilentWhenLabelMappingIsOff` pointed at `ForRead`, and add its mirror
— *the write-side predicate is NOT silent when the mapping is off* — which is the test that
would have caught this.

---

## [HIGH] Finding 2 — the ruled open finding is wider than escalated: it also covers CreateTask, InsertTasksAfter, and the REMOVAL half

- **Location:** `internal/server/server.go:198-217` (CreateTask), `:382-399`
  (InsertTasksAfter), `:840-860` (UpdateTask — the site on record).
- **Status:** pre-existing, not introduced here. **The core is already ruled and going to r10 —
  I am not re-deriving it.** What is new is the **scope**, and it matters because r10 will be
  scoped from the escalation as written.

The escalation on record names one site (`server.go:840-860`) and one direction
(*"Caller-supplied `add_labels` therefore goes through unpriced"*). All three gates call the
same `store.LabelDeltaLifecycleStages`, so all three inherit the same toggle dependency.

**Evidence `[MEASURED]`** — driving the real `LabelDeltaLifecycleStages` on the real
pass-through store:

```
enabled=true   remove_terminal_label            before=[completed]        after=[accepted]   PRICED=true
enabled=true   add_terminal_label               before=[accepted]         after=[completed]  PRICED=true
enabled=true   cross_list_absent_from_snapshot  before=[accepted]         after=[accepted]   PRICED=false
enabled=true   cross_list_present_in_snapshot   before=[completed]        after=[accepted]   PRICED=true
enabled=true   swap_wont_fix_for_completed      before=[completed wont_fix] after=[completed] PRICED=true

enabled=false  remove_terminal_label            before=[accepted] after=[accepted]  PRICED=false
enabled=false  add_terminal_label               before=[accepted] after=[accepted]  PRICED=false
enabled=false  cross_list_absent_from_snapshot  before=[accepted] after=[accepted]  PRICED=false
enabled=false  cross_list_present_in_snapshot   before=[accepted] after=[accepted]  PRICED=false
enabled=false  swap_wont_fix_for_completed      before=[accepted] after=[accepted]  PRICED=false
```

The `enabled=true` block is the positive control: it discriminates five distinct shapes. At
`enabled=false` **every** shape collapses to unpriced.

Three consequences the escalation does not state:

1. **CreateTask is equally unpriced.** `server.go:198` is the round-6 / audit A-1 fix, whose
   own comment records the defect it closed: `CreateTask(labels=[ft:stage/completed])` ALLOWED
   on bare `task:write` while `CreateTask(stage=completed)` was DENIED. At `enabled=false` that
   gate prices nothing, so **the A-1 hole is reopened**. r10 fixing only `840-860` leaves it.
2. **Removal is equally unpriced** (row `remove_terminal_label`). A bare `task:write` holder can
   *strip* a maintainer's `ft:stage/wont_fix`. That is the brief's item 3 in the toggle-off
   world, and it is the direction that makes a declined task available again.
3. **InsertTasksAfter's refusal never fires.** `server.go:382-399` rejects lifecycle-naming
   labels via `!SameStageSet`; at `enabled=false` `SameStageSet` is always true, so the refusal
   is disarmed. Impact is currently nil — `GitHubPassThroughStore.InsertTasksAfter` returns
   `ErrNotImplemented` (`passthrough.go:557`, verified) — but that is a reachability accident,
   and the code comment beside it says so.

**Recommendation.** Scope r10 to *the helper*, not the call site: make
`LabelDeltaLifecycleStages` / `LifecycleStages` evaluate the write-pricing question as-if-enabled,
using the pattern half (b) already established (`asIfEnabled := labels; asIfEnabled.Enabled = true`).
Fixing the three call sites individually will drift; fixing the helper covers all three and any
fourth. Add a test per call site asserting parity across the toggle.

---

## [MEDIUM] Finding 3 — the ruling as written is too narrow: `push_prefix` and `stages` aliases reproduce the defect with the toggle ON

**This is the generalisation deliverable's headline result.**

- **Location:** `internal/platform/github/terminal_label_stages.go:69-73` (prefix requirement),
  `internal/platform/github/labels.go:114+` (`NewLabelMapper` alias table), consumed by every
  gate in Finding 2.

The ruling is phrased as *"must never depend on `enabled`"*. The toggle is one axis. The defect
is **any config field that decides which labels are lifecycle labels**, because the durable
GitHub label outlives the config.

**Evidence `[MEASURED]`** — same label evaluated under the config at write time and under the
config after a plausible operator change:

| axis | label | priced at write time | priced after change | stage carried after change |
|---|---|---|---|---|
| 1 — `enabled` false→true *(the ruled instance)* | `ft:stage/completed` | **false** | true | `[completed]` |
| 2 — `push_prefix` `ft:` → `ft2:` | `ft2:stage/completed` | **false** | true | `[completed]` |
| 3 — `stages: {shipped: completed}` added later | `ft:shipped` | **false** | true | `[completed]` |

All three are "free to write, authoritative later". Axes 2 and 3 need **no toggle at all** — the
deployment is fully enabled the whole time. An operator who rebrands a prefix, or who adds the
alias that round 5's own remediation advice suggests, retroactively promotes every previously-free
label written in that spelling.

**Precondition, stated honestly.** For the write to land, the label must already exist in the
repository: `labelNamesToIDs` (`passthrough.go:205-213`) silently drops names with no repo label,
and `AutoCreateLabels` is declared but never read anywhere (so Farm Table creates none). For axis 1
the label typically exists already (the deployment created it while enabled). For axes 2 and 3 the
attacker needs the label to pre-exist or to hold GitHub label-creation rights. **Established:** the
pricing differential and the promotion. **Inferred:** that an attacker can arrange the label to
exist — I did not demonstrate that.

**Recommendation.** Restate the ruling on the general axis:

> The scope required to WRITE a label must be computed from the set of labels that *could ever*
> be lifecycle-authoritative under *any* configuration this deployment might adopt — not from the
> set that is authoritative under today's configuration.

Concretely: price a write against the **prefix-and-alias-agnostic** reading (does this label's
`stripForMatch` key name a stage?), not the prefix-requiring `authorizationStage`. Note this
deliberately over-charges — `ft2:stage/completed` would cost `task:close` even though it means
nothing today. That is the correct direction for a write, and is the same trade
`labelNamesToIDs`'s comment already accepts ("over-charges rather than under-charges").

### Method, denominator, and what it misses

**Method.** (a) Enumerate every `if !cfg.X` / `if !m.enabled` early return and classify each as
*suppresses a read / produces no label* (safe) vs *skips a check so a write proceeds* (dangerous).
(b) For each config field feeding `authorizationStage`, construct the A/B pair and measure the same
label under both. (c) Cross-check with two independent fan-out searches, then re-verify every
load-bearing claim myself.

**Denominator of config inputs to the authoritative-label decision:** `LabelConfig.Enabled`,
`.PushPrefix`, `.Stages`, `.Priorities`, `.Types` — 5 fields. I measured axes on 3 (`Enabled`,
`PushPrefix`, `Stages`). `Priorities`/`Types` do not add lifecycle labels; they are the *capture*
direction that `checkLifecycleKeyCollisions` now covers, which is why half (b) matters.

**What this method misses.**
- It only covers config reachable through `LabelMapper`. A read-time predicate living in the
  transition table (`TransitionScope`) or the scope vocabulary would not be found this way.
- It assumes the operator change is a *config* change. State changes with the same effect —
  a collection gaining a linked account, changing which store answers and therefore whether
  labels are authoritative at all — are the same shape and I did not measure them.
- It cannot see a future config field. The defect is structural: the *architecture* prices writes
  with a read-time predicate, so every new field that feeds the predicate is a new instance. That
  is the argument for #203 (move the authoritative stage off labels), which this control's own
  comment already makes.

---

## [MEDIUM] Finding 4 — ADJACENT, not my axis: `Encrypt` skips encryption on a caller-controlled prefix, storing a credential in plaintext

Surfaced, not chased, per the brief. **Routing recommendation: this belongs to whoever owns
credential handling.**

- **Location:** `internal/store/crypto.go:63-65` (`Encrypt`), `:134-136` (`EncryptIfNeeded`);
  caller-controlled input at `internal/server/server.go:1410`, `:1417` (`CreateLinkedAccount`).

**Evidence `[MEASURED — code read, both halves verified by me]`:**

```go
func (e *CredentialEncryptor) Encrypt(plaintext string) (string, error) {
	if plaintext == "" { return plaintext, nil }
	if IsEncrypted(plaintext) { return plaintext, nil }   // <-- prefix test on caller data
	...
}
func IsEncrypted(value string) bool { return strings.HasPrefix(value, encryptedPrefix) } // "enc:v1:"
```

and `AuthToken: req.GetAuthToken()` at `server.go:1417`, taken verbatim from the RPC.

**Impact.** A caller with `collection:admin` who sends `auth_token = "enc:v1:" + <real credential>`
causes the credential to be stored **in plaintext** even with encryption fully enabled, and it is
indistinguishable at rest from a properly encrypted row. Secondary effect: `Decrypt` will then fail
on that row, so `Get`/`ListLinkedAccounts` error — a durable DoS planted by one write.

This is the same abstract shape as my main axis — a predicate describing *how a reader will
interpret a string* being used to decide whether a *protective write* happens — which is why I
surfaced it rather than dropping it.

**Recommendation.** Do not infer "already encrypted" from attacker-controllable content. Track
it out of band (a column, or a typed `Ciphertext` wrapper), and reject or escape a caller-supplied
value carrying the reserved prefix:

```go
if IsEncrypted(plaintext) {
    return "", fmt.Errorf("credential must not begin with %q", encryptedPrefix)
}
```

**Not verified:** I did not execute this end-to-end against a database. The mechanism is read from
source and both halves are confirmed; the exploitation is **inferred**, not observed.

---

## [LOW] Finding 5 — the CLI pass-through server installs no auth interceptors, but the incremental privilege is ~zero

I am reporting this **with a correction**, because a fan-out search returned it rated
"EXPLOITABLE" and that rating does not survive the trust boundary. The brief warns that previous
rounds have both over- and under-stated blast radius; this is the over- direction.

- **Location:** `internal/cli/connect.go:301-305` (no interceptors) vs `:162-167` (both installed).
  `internal/server/scopes.go:76` returns `nil` when `authEnforcedKey` is absent.

**Established:** the asymmetry is real — I read both call sites. With no interceptor,
`RequireScope` returns `nil` unconditionally, so **every** gate on that server is inert,
including the method-body gate at `840-860`.

**Why it is Low, not High.** To reach that server the actor must already hold a GitHub token with
write access to the repository — that is what `NewPassThroughStore(token, …)` is constructed from.
Anyone holding such a token can edit the labels directly with `gh` or `curl`, bypassing Farm Table
entirely. The codebase says so explicitly (`server.go:815-819`): *"it guards Farm Table's own write
path, and a maintainer with GitHub triage rights still edits labels directly, outside this process
entirely."* So the incremental capability gained is approximately nil.

**Correction to the brief.** The brief says the CLI pass-through registration installs no
interceptors *"so method-body placement matters"*. Method-body placement does **not** rescue this
path: the gate body runs, but `RequireScope` inside it fails open on the missing `authEnforcedKey`.
Placement helps against a *missing interceptor for a specific method*; it does not help against
*no interceptor at all*.

---

## [INFO] Finding 6 — item 4: `labelMatchKey` normalisation is NOT an authorization bypass here

The brief asked whether normalisation creates an authorization bypass, and said a known open item
exists — naming it and stopping. The known item is the `labelMatchKey`(TrimSpace) vs
`labelIndex`(no TrimSpace) spelling gap, which **MUST 3 / P3 addresses** by returning
snapshot-verbatim spellings. I am not re-deriving it.

On the question actually asked, `[MEASURED]` with a positive control:

```
authorizationStage("ft:stage/working")            = ("working",   true )   <-- POSITIVE CONTROL
authorizationStage("ft:stage/worKing")       = ("working",   true )   Kelvin sign folds to 'k'
authorizationStage("FT:STAGE/COMPLETED")          = ("completed", true )
authorizationStage("  ft:stage/completed  ")      = ("completed", true )
authorizationStage(" ft:stage/completed")    = ("completed", true )   NBSP trimmed
authorizationStage("ft:stage/completed​")    = ("",          false)   ZWSP NOT trimmed
authorizationStage("ft:stage/İN_REVIEW")     = ("in_review", true )   dotted capital I
authorizationStage("ft:stage/ın_review")     = ("",          false)   dotless i
authorizationStage("")                            = ("",          false)
authorizationStage("   ")                         = ("",          false)
```

**No bypass.** Every deviation resolves in the fail-**closed** direction. The Unicode pairs
(U+212A, U+0130) are *recognised* as lifecycle labels, so they are priced, not evaded. The ones
that are not recognised (U+200B, U+0131) are also not authoritative when read, so writing them
achieves nothing — the read side and the write side agree, which is the property that matters.
The empty and whitespace-only cases return false, and `checkLifecycleKeyCollisions`'s new empty-key
guard is consistent with that.

Payloads were written as Go source escapes in a file, never assembled in a bash string literal.

## [INFO] Finding 7 — ADJACENT: `labelIndex` is keyed by `strings.ToLower` with no collision handling

`passthrough.go:201` / the index build both key on `strings.ToLower(name)`. Go's `ToLower` folds
U+212A→`k` and U+0130→`i`, but GitHub treats those as distinct label names. Two repo labels
(`ft:stage/working` and `ft:stage/wor{U+212A}ing`) therefore collapse to one index key, last write
wins by map iteration over the fetched list — so a priced removal could resolve to the wrong node
ID. Surfaced, not chased: it needs repo label-creation rights and I built no end-to-end
demonstration. Worth a dedup-and-warn on index build.

---

# Deliverable 3 — label-writer denominator, method, and blind spots

**Method.** Work backwards from the *sinks* rather than forwards from the RPCs, because the RPC
surface is the part most likely to grow. There are exactly three GraphQL label sinks; every label
that reaches GitHub passes one. Then enumerate forward from the proto to confirm nothing lands
outside them. Both directions cross-checked by an independent fan-out search, then each
load-bearing claim re-verified by me.

**Sink denominator (3, complete for GraphQL):** `createIssue(input.labelIds)`
(`graphql_queries.go:256`), `addLabelsToLabelable` (`:371`), `removeLabelsFromLabelable` (`:390`).
`updateIssue` carries title/body only — verified, no `LabelIDs` in its input.

**Writer denominator — 12 paths.** ✓ = passes `assertStageWriteAllowed`.

| # | path | store site | policy | server-side gate |
|---|---|---|---|---|
| 1 | UpdateTask stage | `passthrough.go:595` | ✓ `stageWriteAllowed` | `TransitionScope` @ `server.go:721` |
| 2 | UpdateTask priority | `passthrough.go:615` | ✓ **`stageWriteForbidden`** | — |
| 3 | UpdateTask type | `passthrough.go:626` | ✓ **`stageWriteForbidden`** | — |
| 4 | UpdateTask add_labels | `passthrough.go:640` | ✓ `stageWriteAllowed` | gate @ `840-860` + snapshot narrowing |
| 5 | UpdateTask remove_labels | `passthrough.go:648` | ✓ `stageWriteAllowed` | same |
| 6 | ClaimTask | `passthrough.go:789` | ✓ `stageWriteAllowed` | `ScopeTaskClaim` |
| 7 | **CreateTask → `createIssue`** | `passthrough.go:544` | **✗ bypasses** | gate @ `server.go:198` only |
| 8 | **CloseTask inline swap** | `passthrough.go:891`, `:899` | **✗ bypasses** | `ScopeTaskClose` only; failures logged |
| 9 | REST `Issues.Edit`/`Create` | `github.go:128`, `:135` | ✗ none | none — **unwired** |
| 10 | adapter sync → `store.UpdateTask` | `github.go:203`, `beads.go:239` | ✗ none | none — **unwired** |
| 11 | ImportCollection | `entstore.go:2193` | n/a EntStore | `collection:admin` only *(out of scope, separately owned)* |
| 12 | InsertTasksAfter | `entstore.go:528` | n/a EntStore | rejects lifecycle labels @ `server.go:382` |

Paths 7 and 8 are the two GitHub writers that never see `stageWritePolicy`. **8 is documented**
(`passthrough.go:286-289`) and is legitimately privileged. **7 is not mentioned in the policy doc
comment at all** — it is gated only at the server, which is the gate Finding 2 shows is
toggle-dependent. That combination is worth a sentence in the policy comment.

Paths 9 and 10 are ungated but unreachable. **I verified this negative myself with a positive
control:** `grep -rn --include='*.go' "PushTask"` returns the interface declaration
(`platform/platform.go:17`) and two implementations and **no callers**; `SyncCollection` likewise;
`NewGitHubAdapter` has **no non-test constructor**. The grep demonstrably finds definitions, so
"finds no callers" is a result rather than a broken search. Reachability is an accident, not a
control — the same thing `server.go:354-375` says about `InsertTasksAfter`.

**Excluded, correctly:** `ListTasks` (`server.go:580`), `WatchTasks` (`watch.go:221`) — label
*filters*, verified as reads. `graph_routing.go:144` writes labels into a throwaway ephemeral
EntStore.

**What this denominator would miss.** (a) A label write via raw HTTP that does not use the
`graphqlClient` wrapper — I searched for the wrapper's methods and for the githubv4 input types,
so an inlined mutation string elsewhere would be found, but a `net/http` POST composed at runtime
would not. (b) Anything reached by reflection or code generation. (c) The `ft` binary is
pre-built at `/workspace/.farmtable/bin/ft`; I audited source, not that binary. (d) I did not audit
the web dashboard's own fetch layer.

---

# Deliverable 4 — before/after for a bare `task:write` holder

Against a **GitHub pass-through** collection. Native Ent collections are inert throughout — stage
is a column, `EntStore` does not implement `LifecycleStageSetStager`.

**At `158c8ae`, with `github.labels.enabled=true`:** could not move the lifecycle stage by writing
a label. Gate at `840-860` priced add/remove against the snapshot; `RestrictLabelWriteToSnapshot`
bound the write to what was priced; `assertStageWriteAllowed` refused lifecycle labels on the
priority/type arms. **At `enabled=false`:** everything below was already free — this is
pre-existing, not introduced.

**At `06f01d7`, unchanged for the attacker.** `[MEASURED]` — none of the six commits changes what a
`task:write` holder can do at either toggle setting. The round is tests, comments, a config-validation
widening, and one type change. Specifically:

| capability | `158c8ae` | `06f01d7` |
|---|---|---|
| write `ft:stage/completed` via `UpdateTask`, `enabled=true` | DENIED | DENIED |
| write it via `UpdateTask`, `enabled=false` | **allowed** | **allowed** (unchanged; ruled, → r10) |
| write it via `CreateTask(labels=…)`, `enabled=false` | **allowed** | **allowed** (Finding 2) |
| strip `ft:stage/wont_fix`, `enabled=false` | **allowed** | **allowed** (Finding 2) |
| reach a lifecycle label through the priority/type arms | refused | refused *(at `enabled=false`, the refusal is now vacuous rather than unreachable — Finding 1)* |

**What genuinely improved:** operators are now told at startup where their config came from
(`loadGitHubConfig`, and the banner is now testable); a config with a stage name in
`types`/`priorities` is rejected regardless of the toggle, closing a real capture class; and
`writeLabelSwap(…, false)` no longer compiles.

**Blast radius, honestly (item 5).** *Established:* a bare `task:write` holder can, at
`enabled=false`, durably set or clear a terminal lifecycle label; after a later flip-on the task
reads `stages=[completed]`, `available=false`, and reversing it costs `task:accept`. Effect is
denial-of-work and destruction of a maintainer's decline — **not** data loss, and **not** GitHub
issue state: `UpdateTask` never closes or reopens an issue, and `state:CLOSED` survives label
stripping. *Inferred, and I want it marked as such:* that this is materially harmful in practice.
It is bounded by three things I did not previously see stated together — the deployment sits behind
IAP so attacker and victim are both already inside the trust boundary; the pass-through store's
authority is a GitHub label that any repo-write holder can edit directly anyway; and
`RequireScope` treats an **empty** scope set as a wildcard (`scopes.go:83-85`), so the "bare
`task:write` holder" is only a real population if tokens are actually being minted with explicit
narrow scopes. I did not establish that they are. If most tokens are empty-scoped, this whole
control is protecting against a population of size zero — which would be worth knowing before r10
spends another round on it. **That is a question, not a claim.**

---

# Deliverable 6 — every place the brief is wrong

1. **"Your working tree is `/workspace`"** — corrected by the sender mid-task. In *my* environment
   it happened to be true and `git rev-parse --show-toplevel` returned `/workspace` with the right
   SHA, so this cost me nothing; recording it because it was wrong for at least one leg.
2. **Reports/briefs directories are outside the repo** — also self-corrected by the sender. Counts.
3. **Baseline block: "`web/dist` is gitignored (`.gitignore:17`)"** — `.gitignore:17` is `dist/`,
   not `web/dist`. The *conclusion* is right (`git check-ignore -v web/dist` →
   `.gitignore:17:dist/`), but the pattern is quoted inaccurately. A reader grepping `.gitignore`
   for `web/dist` finds nothing and concludes the baseline is wrong.
4. **"the gate itself is at `internal/server/server.go:840-860`"** — accurate for `UpdateTask`, but
   presented as *the* gate. There are **three** structurally identical gates (`:198`, `:382`,
   `:840`). Finding 2 is a direct consequence of that framing, and r10 scoped from this sentence
   would fix one of three.
5. **"the CLI pass-through registration (which installs no interceptors …) so method-body placement
   matters"** — the inference is wrong. Method-body placement does not save that path, because
   `RequireScope` fails open on the absent `authEnforcedKey` (Finding 5). A correct fact carrying a
   wrong inference, which is the failure mode the baseline block itself warns about.
6. **Item 1's framing — "verify it did not also move any write-side gate onto the toggle"** —
   phrased as a verification of a likely-negative. It is a positive: it did (Finding 1). Minor, but
   the framing invites confirmation.
7. **Item 4 presumes the interesting answer is a collision.** The measured answer is that
   normalisation is uniformly fail-closed here; the interesting artefact was one axis over
   (`labelIndex` collision, Finding 7), not in `labelMatchKey`'s comparison semantics.
8. **The ruling quoted in the brief is too narrow** — *"must never depend on `enabled`"*. Measured:
   `push_prefix` and `stages` aliases reproduce the defect with the toggle on (Finding 3). A fix
   written to the ruling's literal wording will close one axis of at least three.
9. **"three legs … none of you seeing the others' reports. Do not scope around what you assume the
   others cover"**, set against an out-of-scope list that names five specific items as "separately
   owned and already tracked" — these pull in opposite directions. I resolved it by surveying
   adjacent items and surfacing them with routing notes rather than fixes (Findings 4, 5, 7).

**Not an error, recorded as a check:** every line reference in the brief and baseline block that I
spot-checked resolved correctly — `server.go:840-860`, `config.go`/`passthrough.go`/
`terminal_label_stages.go` diff line counts, the six commit SHAs, `+1663/−97 across 12 files`, and
all four vet messages. The `12 files` / four-production-files claim is exact.

---

# Positive observations

- **The author escalated rather than silently fixing**, and the escalation is correct on its own
  terms. The report separates measured from inferred, names two predictions it got wrong, and
  documents a test it had to discard because *it could not fail*. That last one is a higher
  standard than most reviews apply.
- **`checkLifecycleKeyCollisions`'s `asIfEnabled` is the correct pattern** and is the only place in
  the codebase that already implements the defence this workstream is looking for. It is the
  template for fixing Findings 2 and 3 — the fix is to apply half (b)'s reasoning to the write path.
- **`stageWritePolicy` as a one-field struct** is a genuine improvement: `stageWritePolicy{}` *is*
  the forbidden policy by construction, so a forgotten argument fails closed, and the untyped-`false`
  spelling no longer compiles.
- **`ErrEmptyLifecycleStageSet` fails closed** rather than substituting "no transition" — correct,
  and the comment explains why the previous fallback was fail-open.
- **The gate is in the method body, not an interceptor.** Given path 7 and path 8 bypass the store
  chokepoint, body placement is the right call for the paths where scopes *are* enforced.
- **`labelNamesToIDs` over-charges rather than under-charges**, and the comment says so. Correct
  direction, correctly reasoned.
- Comments consistently record *what was measured*, including negative results. This is why the
  audit could be targeted rather than exploratory.

---

# Method notes

- Every gate re-run by me from the child's `$?`; no piped exit codes.
- Every negative claim carries a positive control (enumerated inline above).
- Probes were new `_test.go` files only; production code never modified; reverted by `cp -a` from
  `/tmp/snap`; `git status --porcelain` empty and HEAD still `06f01d7` after each revert.
- Unicode payloads written as Go escapes in a source file, never assembled in a shell string.
- Two fan-out searches were used for breadth; **every load-bearing claim from them was
  independently re-verified before it entered this report**, and one ("EXPLOITABLE" for the CLI
  interceptor gap) was **downgraded** as a result.
- **Prediction I got wrong, recorded per the brief's rule:** I predicted before measuring that
  MUST 5(a) would be observable today through the priority/type arms. It is not — the swaps return
  `nil, nil` first, exactly as the author says. Chasing the wrong prediction is what produced the
  pre-MUST-5 counterfactual, which is the actual evidence for Finding 1. I also predicted the
  normalisation probe would find at least one fail-open case; it found none, and the negative is
  reported as a negative.
