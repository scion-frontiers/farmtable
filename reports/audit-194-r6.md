# Security Audit — #194 round 6 (`audit-194-r6`)

**Tree:** `label-write-scope-r6` @ `6ced24e53234da12def832c46df1c2be906fc038` (verified by
`git rev-parse HEAD`; working tree clean at start).
**Verdict: REQUEST CHANGES** — on M-2 (an ungated sibling write path) and M-1 (the
server discards the operator's label config, disarming the round-6 prefix control at a
non-default `push_prefix`). Neither is remotely exploitable today; both are the same
*class* the issue exists to close, and both are cheap to fix.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 2 |
| Low | 4 |
| Info | 3 |

The round-6 invariant — *if authorization reads a value, every write path to that value
must be guarded by the same authorization* — **holds for the four enumerated arms**
(`UpdateTask` stage, `UpdateTask` labels, `CreateTask` stage, `CreateTask` labels). It
does **not** hold for a fifth arm (`InsertTasksAfter`), which is unreachable today only
by accident.

---

## Gate reproduction — my own remedy (charge C-A)

I did not take the EM's build remedy on faith. What I ran and what happened:

| Step | Exit | Note |
|---|---|---|
| `go build ./...` (fresh) | **1** | `assets.go:5:12: pattern all:web/dist: no matching files found` — reproduced |
| `make web` | **0** | real `npm ci && vite build`; `npm ci` reported **0 vulnerabilities** |
| `find web/dist -type f \| wc -l` | — | **4109** (independently matches the EM's 4109) |
| `go build ./...` (after) | **0** | |
| **Build positive control** | **1 → 0** | see below |
| `go vet ./...` | **1** | **exactly 4**, all `copies lock value to ephReq` |
| `go test ./...` | **1 then 0×3** | see L-4 — this did *not* reproduce the brief's clean run |

**My remedy was the real asset build, not a stub.** `npm`/`node` were present, so
`make web` was available and I used it; I deliberately avoided the stub route because a
stub is exactly the artefact that let last round's three legs report a build that had
never happened.

**Positive control on the build claim.** A green build from a harness never seen go red
is worth nothing, so before trusting `EXIT=0` I injected a deliberate type error into a
scratch file in `internal/server/`:

```
POSCONTROL_BUILD_EXIT=1
internal/server/zz_audit_poscontrol.go:4:45: cannot use "not an int" (untyped string constant) as int value
--- after removal ---
RESTORE_BUILD_EXIT=0
```

The harness goes red on a real defect and green on its removal. Exit codes were taken
from the child (`cmd > log 2>&1; E=$?`), never through a pipe.

**`go vet` verified BY REQUEST TYPE, not by line number**, as instructed:
`GetReadyTasksRequest`, `GetBlockedTasksRequest`, `GetCriticalPathRequest`,
`GetBottlenecksRequest` — one each, and `grep -c "platform/github" = 0`. Confirmed
pre-existing and not leg A's.

**Tree restoration** verified by sha256 against an out-of-repo pristine manifest of all
466 tracked files (`diff` clean), not by `git status`. Only `web/dist/` (gitignored
build output) remains.

---

## Findings

### [HIGH] A-4 — The TOCTOU window is not a race window; it is a free, retryable primitive

- **Location:** gate `internal/server/server.go:748-767`; write
  `internal/platform/github/passthrough.go:497-505`.
- **Charge A-4 said: "do not accept *acknowledged* as *bounded*."** It is not bounded.
  I am reporting this as the *width* of KNOWN-OPEN #2, not as a new hole.
- **Description.** Three facts compose:
  1. **Removing a terminal label that is absent is free.** `before`/`after` are both
     computed from the labels present *at authorization time*, so a `remove_labels`
     naming a label the issue does not currently carry produces `before == after`,
     `SameStageSet` short-circuits, and nothing is charged. Measured, with positive
     control: **4 of 4** terminal labels are free to name while absent.
  2. **The write is unconditional and blind.** `p.RemoveLabels` is passed through
     (`server.go:773`) and resolved by `labelNamesToIDs` against the **repo-wide label
     index**, not against the issue's labels, then `removeLabels` is issued for whatever
     it resolves. Nothing re-checks the labels the decision was made on.
  3. **No optimistic concurrency.** `p.Version` is *never consulted* anywhere in
     `GitHubPassThroughStore.UpdateTask` (verified across lines 409-610). Errors are
     discarded (`_ = s.gql.removeLabels(...)`), so the caller cannot even observe it.
- **Impact.** A caller holding **only `task:write`** can destroy a maintainer's terminal
  label. This is the same impact class as the known-open collapse seam, but it needs
  neither a spelling collision nor two labels.
- **Proof of concept.** No race precision is required, which is the point:
  ```
  loop:  UpdateTask(task, remove_labels=["ft:stage/wont_fix"])
  ```
  Each iteration authorizes as free (the label is absent) and writes unconditionally.
  The instant a maintainer applies `ft:stage/wont_fix`, the next iteration removes it.
  The attacker pre-authorizes a destructive write against a *future* state; the
  effective window approaches 100%, bounded only by RPC rate limit.
- **Recommendation.** Make the removal conditional on the state that was authorized —
  intersect the requested removals with the labels observed at decision time, and pass
  that intersection down:
  ```go
  // server.go, alongside the existing gate
  authorized := intersectLabels(existing.Labels, req.GetRemoveLabels())
  p.RemoveLabels = authorized
  ```
  and/or re-validate inside the store after `listIssues` returns `target`, since the
  store already holds the fresh label set:
  ```go
  // passthrough.go UpdateTask, after target is resolved
  removeIDs := s.labelNamesToIDs(intersect(issueLabels(target), p.RemoveLabels))
  ```
  Do not paper over it with a version check alone — `p.Version` is unused here, so
  wiring it would also be needed, but the blind-removal shape is the actual defect.
- **Honest limit on this finding.** The *authorization* half is measured with a positive
  control. The *write* half is established by reading `passthrough.go:497-505` and
  confirming the absence of a version check — **I did not execute it end-to-end against
  a fake GraphQL client.** A reviewer wanting to falsify this should build that fake and
  assert `removeLabels` fires for a label absent at decision time.

### [MEDIUM] M-1 — The server discards the operator's label config entirely; a non-default `push_prefix` disarms the round-6 gate

- **Location:** `internal/platform/github/resolver.go:26`; wired at
  `cmd/farmtable-server/main.go:61`; contrast `internal/cli/connect.go:299`.
- **Description.** `NewPlatformResolver()` takes **no config parameter** and calls
  `NewPassThroughStore(token, owner, repo, nil, &cid)`. `cfg == nil` falls back to
  `DefaultConfig()` (`passthrough.go:74-76`). **In server mode the entire
  `github.labels` block — `push_prefix`, `stages`, `priorities`, `types` — is silently
  ignored.** The CLI (`connect.go:299`) *does* pass the loaded config.
- **Impact.** Round 6 made `push_prefix` a security parameter and spent real effort
  making reader and writer share one resolution. That unification is **dead code in
  server mode**, and worse, it reintroduces the very reader/writer disagreement it was
  written to eliminate — now across the CLI/server process boundary. With
  `push_prefix: "acme:"`:
  - `ft` (CLI) writes `acme:stage/completed`.
  - The server's `matchPrefix()` is `"ft:"`, so `authorizationStage("acme:stage/…")`
    returns false. The terminal set is empty for *every* one of the operator's own
    labels, `before == after` for edits touching them, and **label edits that should
    cost `task:close` become free.**

  This is precisely the A-2 disarm the round-6 fix closed inside the mapper.
- **Reachability.** Requires a non-default `push_prefix`. Default deployments are
  unaffected, which is why this is Medium and not High.
- **Recommendation.** Give the resolver the config, so one resolution serves both
  processes:
  ```go
  func NewPlatformResolver(cfg *GitHubConfig) store.PlatformResolver {
      return func(...) (store.Store, error) {
          ...
          return NewPassThroughStore(token, owner, repo, cfg, &cid), nil
      }
  }
  // main.go
  cfg, err := github.LoadConfig(cfgPath)   // also gives the server Validate()
  if err != nil { log.Fatal(err) }
  s.SetResolver(github.NewPlatformResolver(cfg))
  ```
  Until then, a startup warning if a config file exists but the server cannot honour it
  would prevent the silent split-brain.
- **This settles KNOWN-OPEN #5.** The missing custom-prefix end-to-end matrix is *not*
  blocking, but for a reason nobody stated: it is currently **unexercisable through the
  server at all**, because the server cannot be configured with a custom prefix. The
  12-cell matrix should be deferred behind this fix, not landed before it — otherwise it
  would have to be written against the CLI path and would prove nothing about the gate.

### [MEDIUM] M-2 — `InsertTasksAfter` accepts `labels` with no lifecycle gate: round 5's `CreateTask` defect, one RPC over

- **Location:** `internal/server/server.go:277-335`, label passthrough at `:324`.
- **Description.** This is the answer to charge A-1's "find the ones not on that list."
  `InsertTasksAfter` requires `RequireIdentity` + **`ScopeTaskWrite`** + collection
  access, then assigns `Labels: step.GetLabels()` directly into `CreateTaskParams`. There
  is **no** `LabelDeltaLifecycleStages` / `SameStageSet` gate — the exact control
  `CreateTask` received this round, on the sibling creation RPC that also takes a
  `labels` field.
- **Why it is not High.** `GitHubPassThroughStore.InsertTasksAfter` returns
  `store.ErrNotImplemented` (`passthrough.go:405-407`), mapped to `codes.Unimplemented`
  (`server.go:2337`). GitHub pass-through is the only backend where a label forges the
  lifecycle stage; on `EntStore` the stage is a column and labels are inert. **I
  re-verified this rather than assuming it, as charge A-1 instructed.** So the invariant
  holds today.
- **Impact.** The protection is **incidental, not designed.** Nothing in
  `InsertTasksAfter` knows the invariant exists. The day pass-through implements
  `InsertTasksAfter` — a natural feature request — the hole opens silently, with no test
  and no comment anywhere to catch it. This is the same failure mode as round 5: the gate
  was applied to the RPC someone was looking at, not to the value.
- **Recommendation.** Either apply the same gate per step:
  ```go
  for i, step := range req.GetSteps() {
      if len(step.GetLabels()) > 0 {
          before, after, err := store.LabelDeltaLifecycleStages(ctx, s.store,
              &ent.Task{Stage: task.StageTriage, CollectionID: collID}, step.GetLabels(), nil)
          if err != nil { return nil, status.Errorf(codes.Internal, "...: %v", err) }
          if !store.SameStageSet(before, after) {
              for _, to := range after {
                  if sc := TransitionScope(string(task.StageTriage), string(to)); sc != ScopeTaskWrite {
                      if err := RequireScope(ctx, sc); err != nil { return nil, err }
                  }
              }
          }
      }
      ...
  }
  ```
  or, cheaper and arguably better, **reject `step.labels` outright** with
  `InvalidArgument` until the gate exists, so the restriction is explicit and a future
  pass-through implementation cannot silently inherit an ungated path.

### [LOW] L-1 — The collapse seam is wider than stated: 8 authorized spellings per stage, not 4

- **Location:** `internal/platform/github/labels.go:662-679` (`stripForMatch`).
- **This is charge A-2's "is it worse than stated?" — on reachability, not severity.**
- **Description.** `stripForMatch` applies the push prefix strip once, then **three
  sequential `TrimPrefix` calls** (`stage/`, `priority/`, `priority:`). Every subset of
  those three, in that fixed order, normalises to the bare stage name. **I predicted 8
  before measuring** (recorded as `predictedSpellingsPerStage = 8` in the probe); the
  measurement returned 8:
  ```
  ft:completed                       ft:priority:completed
  ft:stage/completed                 ft:stage/priority:completed
  ft:priority/completed              ft:priority/priority:completed
  ft:stage/priority/completed        ft:stage/priority/priority:completed
  ```
  Across all 10 stages: **80 authorized spellings**, uniformly 8 per stage. The shared
  brief states "four authorized spellings each" — that undercounts by half.
- **Impact.** The "two distinct labels resolving to one stage" precondition is not a
  coincidence an attacker waits for; it is **constructible on demand**. Measured, with
  positive control: **12 free two-step canonical-label destructions** (4 terminal stages
  × 3 alternate spellings) — add an alternate spelling (free, set unchanged), then remove
  the canonical `ft:stage/*` label (free, set unchanged), leaving the maintainer's label
  gone and the stage intact.
- **Honest narrowing — this is weaker end-to-end than the mapper measurement suggests.**
  The 12 destructions are measured at the *mapper* level. At the *store* level,
  `CreateTask`/`UpdateTask` apply labels only via `labelNameToID` against the cached repo
  label index (`passthrough.go:205-212, 374-378, 490-494`), and unknown names are
  **silently dropped**. So step one only works if the alternate spelling *already exists*
  as a repo label. Farm Table only ever writes `ft:stage/*` (`StageToLabel`), so it
  normally will not. End-to-end reachability is therefore **conditional on repo label
  inventory**, or on an attacker who also holds GitHub label-admin. I am stating the
  narrower true claim.
- **Recommendation.** Make the normalisation single-shot rather than a sequential strip
  chain — accept exactly one optional namespace segment, and never a `priority`
  namespace on a *stage* lookup:
  ```go
  // reject priority-namespaced labels on the stage path entirely
  if strings.HasPrefix(s, "priority/") || strings.HasPrefix(s, "priority:") {
      return "" // not a stage spelling
  }
  s = strings.TrimPrefix(s, "stage/")
  ```
  That collapses 8 spellings to 2 and closes L-2 below in the same change.

### [LOW] L-2 — A bare, unprefixed stock label reaches the authorization source on a closed issue

- **Location:** `internal/platform/github/passthrough.go:920-930`
  (`lifecycleStagesForLabels`) → `labels.go:507-522` (`IssueToPhaseStage`).
- **Description.** `terminal_label_stages.go:14-16` states the invariant: *"a label may
  contribute to an authorization or terminal-stage determination only if it carries the
  configured push prefix."* `AllTerminalLabelStages` honours it. But when that set is
  empty, `lifecycleStagesForLabels` **falls back to `IssueToPhaseStage`, which uses the
  prefix-TOLERANT `MapLabelsToStage`** — and the value it returns *is* the `before`
  endpoint the gate authorizes against. Measured:
  ```
  state=open   reason=""             : no labels -> accepted  ; bare "duplicate" -> accepted
  state=closed reason=""             : no labels -> completed ; bare "duplicate" -> duplicate   <-- changed
  state=closed reason="not_planned"  : no labels -> wont_fix  ; bare "duplicate" -> duplicate   <-- changed
  ```
  On an **open** issue the F2 demotion saves it. On a **closed** issue there is no
  demotion, and a stock GitHub `duplicate` label — which ships in every new repository and
  any triager can apply — decides the authorization source stage.
- **Impact today: none exploitable.** All four terminal stages sit in the same
  transition-table rows (`any → terminal = task:close`, `terminal → any = task:accept`),
  so swapping `completed` for `duplicate` as the source changes no scope. **The invariant
  is violated in letter, and is load-bearing on an accident** — that the four terminal
  stages are interchangeable in `transitions.go`.
- **Falsifier / what would make this High.** Any future transition rule that
  distinguishes among terminal stages (e.g. `duplicate → anything` cheaper than
  `wont_fix → anything`). At that moment this becomes a live privilege bug with no test
  guarding it.
- **Recommendation.** Apply the prefix requirement on the fallback path too, or assert
  the coupling explicitly with a test that fails if any two terminal stages ever get
  different scopes in `transitionTable`.

### [LOW] L-3 — `AutoCreateLabels` is dead configuration

- **Location:** `internal/platform/github/config.go:42-44` (declared, documented),
  `:174` (defaulted `true`). **No reader anywhere in production code** (verified by grep
  across `internal/` and `cmd/`).
- **Impact.** An operator reading the struct doc — *"controls whether missing labels are
  created on GitHub during push"* — will believe a knob exists that does not. In practice
  labels are silently dropped when absent from the repo index. Note this currently acts
  as an *accidental mitigating control* for L-1; making it live would widen L-1.
- **Recommendation.** Remove the field, or implement it and gate it off by default. Do
  not leave a security-adjacent knob that reads as active. If it is implemented, L-1's
  end-to-end narrowing disappears — fix L-1 first.

### [LOW] L-4 — Pre-existing flaky `TestWatchTasks_CreatedEvent`; the brief's clean `go test ./...` did not reproduce

- **Location:** `internal/server/watch_test.go:153` (5s timeout).
- **Disclosure against the brief.** The brief states `go test ./... -> EXIT 0, panics 0`.
  **My first run was EXIT 1**: `--- FAIL: TestWatchTasks_CreatedEvent (5.01s) timed out
  waiting for event`. I characterised it rather than reporting either number blindly:
  - isolated, 10 runs: **10 pass, 0 fail**
  - `./internal/server/` package, 6 runs: **6 pass, 0 fail**
  - full `./...`, 3 further runs: **3 pass, 0 fail**

  Total **1 failure in 4 full-suite runs**, and the failure was on the **cold-cache** run,
  where compile contention on 16 cores starved a 5-second timeout. The file is **not
  touched by this branch** (`git diff --name-only` vs the merge base; last modified by
  `328e347`).
- **Impact.** Not a defect in this branch and not a #194 finding. It matters because
  **there is no CI (#12)**: the first CI run will be a cold-cache run, i.e. exactly the
  condition that fails. Whoever lands CI will see a red build and blame the wrong change.
- **Recommendation.** Raise the timeout or make the wait deterministic before #12 lands.

### [INFO] A-5 — `Validate`'s rejection is **not** a denial-of-service surface

Charge A-5 asked whether config is ever attacker-influenced. **It is not, and more than
that, `Validate` is unreachable in server mode.** `LoadConfig` (and therefore `Validate`)
is called from exactly one place: `internal/cli/connect.go:292`, with a path from the
operator's own `FARMTABLE_GITHUB_CONFIG` or a local default. The server never calls it
(see M-1). An attacker who can write the operator's YAML or environment already owns the
host. **No finding** — though the same fact produces M-1, which is a real one.

### [INFO] A-6 — The synthetic task's nil `ClosedAt` is correct, but safe only by an unstated coupling

`CreateTask` models the gate against `&ent.Task{Stage: stage, CollectionID: collID}`
(`server.go:167`), so `ClosedAt == nil` and `taskIssueState` returns `"open"`
(`passthrough.go:932-944`). **The model matches reality**: pass-through `CreateTask` only
calls `s.gql.createIssue` and never `closeIssue` (verified, `passthrough.go:348-397`), so
a created issue is always open. I could not construct an exploit.

Two honest caveats worth a comment in the code:
1. The safety depends entirely on "creation cannot produce a closed issue." Nothing states
   or tests that. A future *create-as-closed* path would silently switch
   `IssueToPhaseStage` to its no-demotion branch and change what the gate models.
2. The comparison endpoint and the charging endpoint come from **different sources**:
   `before`/`after` come from `LabelDeltaLifecycleStages`, but the charge loop uses the
   requested `stage` as `from` (`server.go:174`), not `before`. For an open unlabelled
   synthetic task `before` is `{accepted}` while `stage` may be `triage`. Benign today —
   `TransitionScope(triage, terminal)` and `TransitionScope(accepted, terminal)` both hit
   the `any → terminal` row — but it is the *shape* the brief calls defect class 1.

### [INFO] A-2 — Escalation searched for and **not** found; the EM's severity stands

I searched specifically for escalation rather than re-deriving the seam. **0 escalations**
in two independent brute-force searches, each with its own positive control:
- Over 4 terminal stages × 3 alternate spellings: free two-step edits leave the gate's
  stage set **identical** in all 12 cases — the label dies, the stage never moves.
- Over all 4×4 stage pairs × 4×4 spelling forms (256 combinations): **0** cases where the
  gate's set was unchanged but the *singular* tiebreak `TerminalLabelStage` — which drives
  `ComputeAvailability` and the claim gate — drifted. This was the most plausible hidden
  escalation channel and it is clean.

**The seam destroys labels; it does not grant stages.** The EM's characterisation is
correct on severity. It is worse only on *reachability* (L-1).

---

## Charge C-A — brief claims I did NOT independently verify

**Verified independently** (do not treat as inherited): the HEAD SHA; the cold-clone build
failure and its exact message; `make web` exit and the 4109 file count; the post-`make web`
build; the 4 `go vet` findings *by request type* and zero in `platform/github`; the
31 files / 5102 / 218 diff stat; that both named characterization tests exist, are **not**
`t.Skip`, and pass; the `from == to` short-circuit at `transitions.go:124`; that
`InsertTasksAfter` returns `Unimplemented` on pass-through; that
`ft:priority:completed` authorizes as stage `completed`.

**Relied on without verification:**
1. **"There is no CI (#12, blocked on a GitHub App permission scope)."** Relied on. I did
   not inspect `.github/` or the issue. L-4's impact argument depends on it.
2. **"The merge base is `ea8ac390`" and "the merge was clean — no conflicts."** I used
   `ea8ac390` as the diff base on the brief's say-so; I did not verify merge-base or
   replay the merge. My "not touched by this branch" claim in L-4 inherits this.
3. **All round-5 history** — that A-1/A-2/A-3 were found then, that round 4 introduced the
   `duplicate` regression, that "12 cells changed answer", "6 of 12 pairs converted",
   "500 mappers resolved 60/440". Not re-measured; I treated them as context, and no
   finding above rests on them.
4. **`make race` and `go test -race ./internal/server/` results.** **Not run at all.** I
   have no independent evidence about data races. Given M-1/A-4 concern concurrency-
   adjacent state (the lazily cached label index, shared per collection), this is the
   most material gap in my coverage.
5. **KNOWN-OPEN items 3 (A5 benign) and 6 (stale comment).** Accepted as stated; not
   checked.
6. **"`go test ./...` → EXIT 0, panics 0."** **Relied on and then contradicted** — see
   L-4. This is the one brief claim that did not reproduce for me.

**Where the brief is wrong or imprecise:**
- **"four authorized spellings each" — it is eight** (L-1). This one matters, because it
  is a number about the live seam and it is off by 2×.
- `go test ./...` is not reliably EXIT 0 (L-4).

## Charge C-B — the least-supported claim in this round's work

**The claim:** that the round-6 invariant — *every write path to the value authorization
reads is guarded by the same authorization* — now **holds**, as asserted by the
`CreateTask` comment block at `server.go:129-163` and by closing A-1.

**Why it is least supported.** It is a claim of **exhaustiveness**, and nothing in this
round enumerates the write paths. It was established by fixing the one path someone
noticed, which is exactly how round 5 shipped the `CreateTask` gap after making the same
claim. I falsified it in one pass: `InsertTasksAfter` (M-2) is a fifth arm that writes
caller-supplied labels under bare `task:write`, held shut only by an unrelated
`ErrNotImplemented`. Beyond it sit `ImportCollection` (`export_import.go:710-736`, writes
`Stage` **and** `Labels` directly under `collection:admin`, bypassing `TransitionScope`
entirely — and scopes here are independent strings, so `collection:admin` does not imply
`task:close`) and the inbound `SyncCollection` (`github.go:93-99, 197-205`, writes `Stage`
with actor `uuid.Nil` and no gate at all).

**What would falsify it properly** — and what I recommend round 7 require before anyone
asserts the invariant again: a **generated, exhaustive** enumeration rather than a prose
list. Reflect over every `store.CreateTaskParams`/`UpdateTaskParams` construction site and
every Ent `SetStage`/`SetLabels` caller, and assert each is either (a) behind
`LabelDeltaLifecycleStages`/`LifecycleStages`, or (b) on an explicit, named allow-list with
a reason. A test that fails when a *new* unguarded construction site appears is the only
version of this claim that cannot rot — and, per the brief's own defect class, the only one
whose fixture can express the breaking case.

---

## Positive observations

- **The empty-set fail-open is genuinely closed, and closed in the right place.**
  `ErrEmptyLifecycleStageSet` (`store.go:140-141, 160-162, 191-195`) denies instead of
  substituting. I formed a specific escalation hypothesis against this — that an empty
  `before` would make `for _, from := range before` iterate zero times and charge nothing
  — and it is **falsified**: the helper errors before the loop is reached. One rule, one
  place, and it denies. This was the single best change in the round.
- **Charging the whole set instead of a tiebreak winner** (`server.go:631-637, 754-766`)
  is the correct fix for the right reason: it removes an access-control decision from an
  ordering parameter. The rank-0 argument in the comments is sound.
- **Sharing one `resolvePushPrefix` between reader and writer** is exactly right, and the
  reasoning that a `TrimSpace`-blank prefix is precisely an unusable prefix — because the
  same function normalises both sides — is a genuinely non-obvious, well-argued invariant.
- **`AllTerminalLabelStages` deliberately refuses to inherit two defects** from
  `TerminalLabelStage` (membership via `store.IsTerminalStage` rather than the fail-open
  precedence list; total ordering by name). Declining to reuse a nearby function because
  it fails open is the correct instinct.
- **Sorted map iteration** in the alias table build, with the 60/440 measurement recorded
  as the reason. Non-determinism at an authorization gate is a serious bug and it was
  found by measuring rather than reviewing.
- **The comments are the best I have read in this codebase** — they record what was
  measured, what was rejected, and what remains open. `terminal_label_stages.go:125-165`
  and `server.go:700-747` explain *why*, name the alternative, and say what it would cost.
- **The two characterization tests are real**, active, and assert the defective behaviour
  so round 7 cannot close the seam silently. Both pass; neither is skipped.

## Recommendations (beyond the findings)

1. **Sequence M-1 before the KNOWN-OPEN #5 custom-prefix matrix.** The matrix cannot be
   written against the server today.
2. **Make the write path re-check what the gate authorized** (A-4). The gate reasons about
   a label set the store never re-consults; that gap will keep producing findings.
3. **#203 (moving the authoritative stage off labels) is the real fix** and every control
   in this round is an argument for it. Each gate here guards one verb, and the verb set
   is open-ended — M-2 is that sentence coming true within a single round.
4. Non-security, surfaced for the manager to route: `NewPlatformResolver()` taking no
   config is likely an outright wiring bug, not only a security one — custom `stages`
   aliases are equally ignored server-side.

## Probe hygiene

Two probe files (`zz_audit_r6_probe_test.go`, `zz_audit_r6_toctou_test.go`) and one
build-control file were created in `internal/platform/github/` and `internal/server/`, run,
and **deleted**. No production code was modified. Restoration verified by **sha256 manifest
over all 466 tracked files** against an out-of-repo pristine copy — identical, `git status`
clean. Every probe carries a positive control that **aborts via `t.Fatal`** on a failed
prerequisite rather than continuing to downstream numbers; the spelling count was
**predicted (8) before it was measured (8)**.

**Voided / self-caught errors, disclosed:**
- I ran `grep -c "t.Skip"` on the collapse-seam test file, got `1`, and briefly believed
  the brief was wrong about the tests not being skipped. **My grep was wrong** — it matched
  the *prose of a comment* at line 14 ("do not reach for `t.Skip`"), not a call. Caught by
  reading the file instead of trusting the count. The brief was correct. This is the same
  wrong-grep class the developers disclosed, and it produced a false *alarm* rather than a
  false all-clear only by luck.
- My A-4 probe models the gate with `AllTerminalLabelStages` directly, whereas production
  calls `lifecycleStagesForLabels`, which falls back to `IssueToPhaseStage` when the
  terminal set is empty. The conclusion survives (the fallback returns the *same* value on
  both sides, so the edit is still free), but the probe is a **simplification of the real
  call path**, and I am flagging it rather than presenting it as a faithful model.
- The escalation hypothesis in "Positive observations" (empty `before` ⇒ zero-iteration
  loop ⇒ no charge) was **wrong**, and I am reporting it because it was my most promising
  lead and its death is evidence the F7 fix is load-bearing.
