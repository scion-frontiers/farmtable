# Security Audit Report — #194 round 10, `label-write-scope-r10`

**Tree:** `git rev-parse --show-toplevel` = `/workspace`; `git rev-parse HEAD` =
`6d8f19e11f4ddbfdc313301199006d3f7c76eb1c`. Confirmed before any other action, and
re-confirmed after cleanup. Diff under review: `06f01d7..6d8f19e`.

**Axis:** threat modelling and exploitability.

---

## Verdict

### REQUEST CHANGES — on the diff.

The diff closes the vulnerability it targeted for the input shapes it tested, and
**opens a strictly larger one for input shapes it did not test.** Measured, at
`enabled=true`, DefaultConfig, no config change required, through the real
`store.LabelDeltaLifecycleStages` → `SameStageSet` path the server gate uses:

> An issue carrying a bare stage-named label — including GitHub's stock
> **`duplicate`**, which ships in every new repository — lets a principal holding only
> `task:write` stamp the *authoritative* `ft:stage/duplicate` (or `completed`, or
> `cancelled`) for **free**. Before this diff that same write cost **`task:close`**.

The privilege gain is the exact one the round exists to remove — *write a label now,
have it become an authoritative lifecycle signal* — obtained in one step instead of
two, and introduced by the fix.

An exhaustive sweep over 1800 (config × issue-state × label × delta) cells found
**29 cells where the post-fix gate charges strictly less than the pre-fix gate**, in
four families. 337 cells tightened, 1434 unchanged. The tightenings are real and
valuable; they do not offset a regression in the same control.

Separately and **out of the diff's scope**, I hold two open concerns I am *not*
blocking on and which the diff did not cause: the unpriced
`hasExternalUnavailableLabel` path (F-4) and the pre-existing terminal-scan masking
of non-terminal moves (F-6). Stating both separately, per the brief.

### Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| **High** | **1** (F-1, introduced by this diff) |
| Medium | 3 (F-2, F-3, F-4) |
| Low | 3 (F-5, F-6, F-7) |
| Info | 3 (F-8, F-9, F-10) |

---

## Gates — re-measured, not taken from the table

| gate | reported | clean checkout | assets built (`npm ci && npm run build`) | agrees? |
|---|---|---|---|---|
| `go build ./...` | 0 | **1** (`pattern all:web/dist`) | **0**, zero output | conditionally |
| `go vet ./...` | 1, four copylocks | **1** — but *one* line, the embed message, and **zero** copylocks | **1**, exactly 4 lines, all `ephReq` | see below |
| `go test ./... -count=1 -skip TestWatchTasks` | 0 | — | **0**, zero `FAIL` lines | yes |

Against genuinely built assets all three rows reproduce exactly, and identically to the
fabricated `web/dist/index.html` placeholder I used earlier — so the placeholder was an
adequate stand-in for the Go gates. Vet output matched **by message**, as instructed:
`assignment copies lock value to ephReq` at `internal/server/server.go:{1782, 1892, 2100,
2277}` — 4 matches, and `grep -vc` for that string returns **0**, so there is no fifth
line. `grep -c copylock` → **0**. Nothing in vet is attributable to this diff.

**The vet row is the interesting one, and it is not simply "wrong".** On the clean
checkout it *does* exit 1 — the exit code the table predicts — **for a completely
different reason**, having emitted none of the four findings the table names. A leg that
checks the exit code ticks the row green and never reads the text. That is a gate row
that reproduces its exit status for the wrong reason, which is strictly worse than a row
that fails, because nothing announces it. Measured:

```
clean checkout:  go vet ./...  exit=1   lines=1   ephReq matches=0
                 assets.go:5:12: pattern all:web/dist: no matching files found
assets built:    go vet ./...  exit=1   lines=4   ephReq matches=4
```

**The two traps on this row have opposite signs, and my pipe bug cancelled the quiet
one.** Reading the exit code directly on a clean checkout yields `1` → looks green →
false reassurance. Piping through `tail` yields `$?` from `tail` = `0` → contradicts the
table → false alarm. My first gate run was piped, so it produced the *loud* failure and
sent me looking, which is the only reason I opened the message text at all. A defect in
my method masked a trap in the brief. I would not have caught the quiet version: I
measured vet only *after* fabricating `web/dist`, and so never observed the clean-checkout
state until the EM's amendment told me to look. That is not a near-miss I get credit for.

**A control caught my own error, and it is the one the brief warned about.** My first
gate run was `go build ./... 2>&1 | tail -20; echo "build exit: $?"`. It printed
**`build exit: 0`**. `$?` was `tail`'s status, not `go build`'s. The build had in fact
**failed**, on `assets.go:5:12: pattern all:web/dist: no matching files found`. I
discarded that run and re-ran with the exit code captured directly: exit **1**. So the
`go build = 0` row does not reproduce on a clean checkout of this SHA. The baseline block
pre-declares the embed defect as task #100 and out of scope, so I record it as a
disagreement with the *table*, not a finding against the diff.

Positive control for the build column: `go build ./internal/does-not-exist/...` → exit 1,
so the command is capable of failing. Assets were built per the EM's verified procedure
(`npm ci` exit 0, `npm run build` exit 0), and `web/dist` and `web/node_modules` were
removed afterwards; both are gitignored, and `git status --porcelain --ignored` shows no
stray for either.

**The EM corrected this table twice, mid-round, unprompted — and the second message
corrected the first.** The original correction identified the loud failure (zero
copylocks found, leg concludes the tree is broken). The amendment identified the quiet
one the first had missed: that vet still exits 1, so an exit-code check reports the row
as reproduced. Both are recorded in the ledger below as separate items, at the EM's
explicit request that it "not look like one clean fix". I verified rather than accepted
in both cases; both are accurate as measured above.

I want to state the direction of that exchange plainly, because the ledger format will
otherwise flatten it: **the amendment told me something my own method would not have
found.** It also happens to be a better-generalised version of the shared block's own
"match by message, not by count" rule — the rule only fires if you apply it to a row that
already looks green, which is exactly when nobody applies it. That is a reusable lesson
about gate tables, not a local erratum, and it came from the brief's author auditing
their own instrument mid-round.

`go test` exit 0, zero `FAIL`/`--- FAIL` lines (read by name, not count). The full
suite also stayed green with my harness present, and green again after removal.

**Mutation cells left dirty after restore: 0.** Four artefacts created and all four
removed: `internal/platform/github/zz_audit_r10_harness_test.go`,
`internal/platform/github/zz_audit_r10_e2e_test.go`, a placeholder `web/dist/index.html`,
and later the genuine `web/dist` + `web/node_modules` from `npm ci && npm run build`.
Final state: `git status --porcelain` empty, `git status --porcelain --ignored` shows no
`web/dist` or `web/node_modules` stray, HEAD still `6d8f19e11f4ddbfdc313301199006d3f7c76eb1c`.
**No production code was modified at any point.**

---

## Findings

### [HIGH] F-1 — The fix makes stamping an authoritative terminal label FREE when the issue already carries a bare one. Regression, introduced by this diff.

- **Location:** `internal/platform/github/passthrough.go:1100-1109`
  (`lifecycleStagesForLabels`) + `internal/platform/github/lifecycle_claim.go:196-211`
  (`canonicalLifecycleLabels`). Consumed at `internal/server/server.go:841-861`.
- **Description.** `lifecycleStagesForLabels` now canonicalises labels through
  `lifecycleStageClaim` before computing the stage set. That widening is applied to
  **both endpoints** of the price. The *before* endpoint therefore also widened — and
  a widened *before* can collapse onto *after* where the two previously differed.
  When before == after, `store.SameStageSet` is true and
  `internal/server/server.go:849` skips the entire scope loop. Nothing is charged.

  Concretely, canonicalisation promotes a bare terminal label (`duplicate`) into the
  `AllTerminalLabelStages` terminal scan, which **bypasses `IssueToPhaseStage`'s
  rule-2 demotion**. Pre-fix, a bare terminal label on an OPEN issue demoted to
  `accepted`, so the *before* endpoint was `[accepted]` and the write was a real
  `accepted → duplicate` transition. Post-fix the *before* endpoint is `[duplicate]`
  and the write is a no-op the gate charges nothing for.

- **Impact.** A principal with **only `task:write`** converts a live task into an
  authoritative terminal one. Measured through the real store interface:

  ```
  labels=[duplicate], add_labels=[ft:stage/duplicate]
    gate: before=[duplicate] after=[duplicate]  SameStageSet=true  -> FREE
    LifecycleStage(): accepted -> duplicate     (live -> TERMINAL)
    survives RestrictLabelWriteToSnapshot: [ft:stage/duplicate]    (the write lands)

  CONTROL, same write, no bare label present:
    gate: before=[accepted] after=[duplicate]   SameStageSet=false -> PRICED task:close
  ```

  The control discriminates, so the RED is the canonicalisation arm, not a build or
  fixture artefact. `LifecycleStage` is what `issueUnavailableForClaim` and
  `ComputeAvailability` consume, so the task becomes unclaimable; reversing it costs
  `task:accept`, which the attacker does not need to hold to have caused it.

- **Proof of concept.**
  1. A triager applies GitHub's stock `duplicate` label to open issue #42. (No
     attacker action; this is ordinary repository hygiene. `duplicate` is created by
     GitHub in every new repository — the codebase says so at
     `terminal_label_stages.go:22-27`.)
  2. Attacker holds `task:write` only. `UpdateTask(#42, add_labels=["ft:stage/duplicate"])`.
  3. Gate computes before=`[duplicate]`, after=`[duplicate]`, skips pricing.
     `RestrictLabelWriteToSnapshot` passes the add through (it is not a snapshot
     no-op). The label lands on GitHub.
  4. #42 is now terminal to the claim gate and the availability gate. Undoing it is a
     `terminal → non-terminal` reopen costing `task:accept`.

  Pre-fix, step 3 required `task:close`.

- **The laundering variant is worse.** The same shape converts a label planted through
  the *pre-fix* hole into the local authoritative spelling, for free:

  ```
  labels=[ft2:stage/completed], add_labels=[ft:stage/completed]
    gate: before=[completed] after=[completed]  free=true
    LifecycleStage(): accepted -> completed
  ```

  Any `ft2:stage/completed` written before this fix shipped — which was free, and is
  the very exposure claim 5 is about — can now be upgraded to a real
  `ft:stage/completed` for `task:write`. The fix supplies the second half of the
  attack it was written to prevent.

- **A `task:claim` bypass falls out of the same mechanism:**

  ```
  labels=[duplicate], add_labels=[ft:stage/working]
    gate: before=[duplicate] after=[duplicate]  free=true
    display/t.Stage: accepted -> working        (pre-fix this cost task:claim)
  CONTROL (no bare label): before=[accepted] after=[working] -> PRICED task:claim
  ```

- **Full extent, measured.** 1800-cell sweep, `enabled ∈ {true,false}` ×
  `closed ∈ {true,false}` × 15 current-label values × 15 delta values × {add, remove}:
  **29 weakened, 337 tightened, 1434 unchanged.** All 29 are at `enabled=true`. Four
  families:

  | family | shape | pre → post |
  |---|---|---|
  | 1 | open + bare/foreign terminal label, add matching `ft:stage/<same>` | `task:close` → `task:write` |
  | 2 | open + bare/foreign terminal label, add any non-terminal stage label | `task:claim` → `task:write` |
  | 3 | closed + bare/foreign terminal label, add `working`/`triage`/`ft:stage/working` | `task:accept` → `task:write` |
  | 4 | open + bare terminal label, add `working` (bare) | `task:claim` → `task:write` |

  Trigger vocabulary for "bare/foreign terminal label" measured as
  `{duplicate, completed, cancelled, wont_fix, ft2:stage/completed}`. `duplicate` is
  stock GitHub; the rest need one prior label write, which is itself priced post-fix,
  so `duplicate` is the reachable entry point.

  **Weakening cannot occur at `enabled=false`**, and that is a property rather than an
  accident: pre-fix, both endpoints collapsed to `[t.Stage]` for every input, so the
  pre-fix price there is always `task:write` and there is nothing to fall below.

- **Recommendation.** Do not make the *before* endpoint config-blind. A write must be
  priced against **the most expensive** reading of its two endpoints, not against a
  uniformly-widened pair. Two shapes that both close it:

  ```go
  // Option A — keep the read answer as the floor for `before`, use the
  // config-blind answer as the ceiling for `after`. Monotone by construction:
  // the price can only rise.
  func (s *GitHubPassThroughStore) LabelDeltaLifecycleStages(
      ctx context.Context, t *ent.Task, add, remove []string,
  ) (before, after []task.Stage) {
      readBefore := s.readLifecycleStagesForLabels(t, t.Labels)      // pre-fix body
      writeAfter := s.lifecycleStagesForLabels(t, applyLabelDelta(t.Labels, add, remove))
      return readBefore, writeAfter
  }
  ```

  ```go
  // Option B — price both ways and charge the strongest. Keeps the config-blind
  // reading available for the cases it was added for, and cannot go below the
  // pre-fix price for any input.
  //   scope = max(price(readBefore, readAfter), price(writeBefore, writeAfter))
  ```

  Option A is the smaller change and matches the invariant the docblock already
  claims ("can only ever charge more scope"). Whichever is chosen, the fix must be
  pinned by a **monotonicity property test**, not by more example cells: for a
  vocabulary of label sets and deltas, assert
  `scopeRank(postPrice) >= scopeRank(prePrice)` for every input. That is the pin that
  would have caught this, and it is cheap — my sweep is 40 lines.

---

### [MEDIUM] F-2 — Axis 2 is **narrowed, not closed**: prefix-blindness only recognises colon-delimited, single-segment prefixes.

- **Location:** `internal/platform/github/lifecycle_claim.go:143-156`
  (`stripAnyLifecyclePrefix`); claim of closure at `lifecycle_claim.go:44-48`.
- **Description.** `stripAnyLifecyclePrefix` strips **one** leading `<seg>:` (rejected
  if `<seg>` contains `/`) and **one** leading `stage/`. `push_prefix` is an
  unconstrained string: `GitHubConfig.Validate` (`config.go:193-201`) rejects only
  whitespace-only values. Any non-blank string — `ft2/`, `ft-`, `ft.`, `a:b:` — is a
  legal future `push_prefix`, and `StageToLabel` will write and `authorizationStage`
  will honour labels under it.
- **Impact.** Measured, at `enabled=true`, `push_prefix: "ft:"`, DefaultConfig — for
  each label, "claimed by `lifecycleStageClaim` today" vs "authoritative under the
  named future prefix":

  | label | future prefix | claimed today | authoritative then | |
  |---|---|---|---|---|
  | `ft2:stage/completed` | `ft2:` | **yes** | yes | closed |
  | `ft2:completed` | `ft2:` | **yes** | yes | closed |
  | `acme:stage/completed` | `acme:` | **yes** | yes | closed |
  | `ft2/stage/completed` | `ft2/` | **no** | yes | **GAP** |
  | `acme/stage/completed` | `acme/` | **no** | yes | **GAP** |
  | `ft2/completed` | `ft2/` | **no** | yes | **GAP** |
  | `ft-stage/completed` | `ft-` | **no** | yes | **GAP** |
  | `ft.stage/completed` | `ft.` | **no** | yes | **GAP** |
  | `ft_stage/completed` | `ft_` | **no** | yes | **GAP** |
  | `a:b:stage/completed` | `a:b:` | **no** | yes | **GAP** |

  **7 of 10.** End-to-end pricing confirms it: adding `ft2/stage/completed`,
  `ft-stage/completed` or `a:b:stage/completed` to an open accepted issue prices at
  `task:write` post-fix, identically to pre-fix, while `ft2:stage/completed` correctly
  moved from `task:write` to `task:close`.

  The **slash** case matters most: `area/foo`, `kind/bug`, `status/blocked` is the
  dominant GitHub label-namespace convention. An operator normalising to
  `push_prefix: "ft/"` is more likely than one choosing `ft2:`.
- **Recommendation.** Either (a) make `stripAnyLifecyclePrefix` delimiter-general —
  strip any maximal leading run of `[^ ]*[:/._-]` segments and test each residual
  suffix against `labelToStage` — or (b) constrain `push_prefix` in `Validate()` to the
  delimiter set the claim actually recognises, so the code's coverage and the config's
  degrees of freedom are the same set:

  ```go
  // config.go Validate()
  if p := strings.TrimSpace(c.GitHub.Labels.PushPrefix); p != "" && !strings.HasSuffix(p, ":") {
      return fmt.Errorf(
          "github.labels.push_prefix is %q: it must end in %q. A label written under "+
              "one prefix must remain priceable under any other prefix this deployment "+
              "may later adopt, and the write-side claim (lifecycleStageClaim) only "+
              "recognises a single colon-delimited namespace segment", p, ":")
  }
  ```

  (b) is smaller and honest; (a) is the one that actually meets the ruling as stated.
  **Do not ship the current `axis 2 ... CLOSED` comment either way** — see F-8.

---

### [MEDIUM] F-3 — `writeViewMapper` publishes a partially-constructed `LabelMapper` through an unsynchronised field. Data race, confirmed by `-race`.

- **Location:** `internal/platform/github/lifecycle_claim.go:172-182`; field declared
  at `internal/platform/github/labels.go:110-114`.
- **Description.** `writeViewMapper` lazily builds and assigns `m.writeView` with no
  synchronisation. `LabelMapper` is shared: one `GitHubPassThroughStore` instance
  serves every request for its collection, and the file's own comment at
  `passthrough.go:31-42` says so — it is why `cacheMu` exists, added for exactly this
  class in #198. This diff adds new shared mutable state next to that lock and does
  not take it.
- **Impact.** Confirmed with `go test -race`, 8 goroutines × 200 iterations through
  `lifecycleStagesForLabels`:

  ```
  WARNING: DATA RACE
  Read  at ... lifecycle_claim.go:176  (*LabelMapper).writeViewMapper
  Write at ... lifecycle_claim.go:179  (*LabelMapper).writeViewMapper

  WARNING: DATA RACE
  Read  at ... terminal_label_stages.go:157 (*LabelMapper).pushPrefix
             <- authorizationStage <- AllTerminalLabelStages <- lifecycleStagesForLabels
  Write at ... labels.go:122 NewLabelMapper  <- writeViewMapper
  ```

  The second race is the dangerous one: it is a read of the **new mapper's `config`
  field** racing with `NewLabelMapper`'s construction of it. A reader can observe a
  non-nil `writeView` whose fields are not yet visible. There is no happens-before
  edge, so under the Go memory model an observer may see `enabled=false`, an empty
  `labelToStage`, or an empty `PushPrefix`. Every one of those degrades **toward
  refusing to recognise a label**, i.e. toward pricing a lifecycle write as free.
  `LabelDeltaLifecycleStages` calls `lifecycleStagesForLabels` **twice**, and each call
  calls `writeViewMapper` twice (directly and via `canonicalLifecycleLabels`), so the
  two endpoints of one price can be computed under **different views** — a broken one
  and a good one — producing an arbitrary mispricing in either direction.
- **Exploitability.** Requires `github.labels.enabled=false` (at `enabled=true`
  `writeViewMapper` returns `m` and never writes) and concurrent requests in the window
  between process start and the first successful publish. Narrow, unauthenticated-race
  rather than attacker-timed, and self-healing after the first publish — hence Medium,
  not High. It is a *silent* mispricing, not a crash.
- **Recommendation.** Build the write view eagerly in `NewLabelMapper`, which removes
  the race and the lock together and costs one extra allocation per mapper (mappers
  are built once per store):

  ```go
  // NewLabelMapper, at the end:
  if !m.enabled {
      asIfEnabled := cfg
      asIfEnabled.Enabled = true
      m.writeView = NewLabelMapper(asIfEnabled)   // terminates: the child has Enabled=true
  }
  return m

  // lifecycle_claim.go
  func (m *LabelMapper) writeViewMapper() *LabelMapper {
      if m == nil || m.enabled {
          return m
      }
      return m.writeView   // immutable after construction; no lock needed
  }
  ```

  Add `go test -race ./internal/platform/github/` to the gate set if it is not there;
  the existing `concurrency_test.go` covers `labelIndex` but not this.

---

### [MEDIUM] F-4 — Fourth authoritative path: `hasExternalUnavailableLabel` is unpriced in **both** directions. Not caused by this diff; not reachable by widening `lifecycleStageClaim`.

- **Location:** `internal/platform/github/treewalk.go:217-240`; consumed at
  `treewalk.go:125`, `treewalk.go:157`, `passthrough.go:843`
  (`issueUnavailableForClaim`), `passthrough.go:1406` (`ComputeAvailability`).
- **Description.** The vocabulary `{blocked, waiting_for_input, deferred, scheduled}`
  is prefix-tolerant, requires no prefix, and carries **no `enabled` guard** — the diff's
  own comment at `terminal_label_stages.go:65-71` records this. None of those strings
  is a `task.Stage`, so `lifecycleStageClaim` does not and cannot claim them.
- **Impact.** Measured:

  ```
  add    'blocked'      gate [accepted]->[accepted] free=true | hold false->true
  remove 'blocked'      gate [accepted]->[accepted] free=true | hold true->false
  remove 'ft:blocked'   gate [accepted]->[accepted] free=true | hold true->false
  remove 'deferred'     gate [accepted]->[accepted] free=true | hold true->false
  CONTROL remove 'ft:stage/wont_fix'
                        gate [wont_fix]->[accepted] free=false            <- discriminates
  ```

  The **remove** direction is fail-open and is the one that matters. `issueUnavailableForClaim`
  is *enforcement*, not advisory — it is the pass-through store's claim gate. So
  `UpdateTask(remove_labels=["blocked"])` costs `task:write` and **releases an
  operator's explicit hold**, converting an unclaimable task into a claimable one. The
  add direction is a denial primitive: `task:write` withholds any task from every agent,
  and the withholding survives `enabled=false`.
- **Answer to claim 4:** **No, three is not the complete set.** Three is the complete
  set of *pricing-suppression guards on the stage path at `enabled=false`* — a narrower
  question than "every path by which a written label becomes authoritative". This is a
  fourth, and it is structurally out of reach of the round-10 mechanism.
- **Recommendation.** Price hold-label writes against a hold scope, symmetrically with
  the stage path. Minimum viable: extend the store's delta reporting to a
  `LabelDeltaHold(ctx, t, add, remove) (before, after bool)` and require a scope
  (`task:accept` is the natural one, matching "reopen") when `before && !after`.
  Charging the *add* direction is lower priority than the *remove* direction.

---

### [LOW] F-5 — `assertStageWriteAllowed`'s new predicate loses a nil-receiver refusal.

- **Location:** `internal/platform/github/passthrough.go:319`;
  `lifecycle_claim.go:112-114`.
- **Description.** `authorizationStage` dereferences `m` unguarded (`if !m.enabled`),
  so `assertStageWriteAllowed` on a nil mapper previously **panicked**. `lifecycleStageClaim`
  guards `m == nil` and returns `("", false)`, so it now **allows** the write. Every
  other input is a strict superset (F-8, claim 1 premise), but this one input refuses
  strictly less.
- **Impact.** Not reachable today: `NewPassThroughStore` always sets `mapper`, and the
  only nil-mapper handling in the file (`passthrough.go:1040`) is on a different
  method. It is the shape that turns into a real bypass the moment a zero-value store is
  constructed — which the codebase does elsewhere
  (`empty_stage_set_contract_test.go:85`, and the `LifecycleStage` docblock says
  "callers reach this from a zero-value store").
- **Recommendation.** Fail closed at the gate rather than in the predicate:

  ```go
  func (s *GitHubPassThroughStore) assertStageWriteAllowed(add, remove []string, policy stageWritePolicy) error {
      if policy == stageWriteAllowed {
          return nil
      }
      if s.mapper == nil {
          return fmt.Errorf("refusing a non-stage-moving label write: no label mapper is " +
              "configured, so this store cannot determine whether %v/%v assert a lifecycle stage", add, remove)
      }
      ...
  ```

---

### [LOW] F-6 — Terminal-first ordering masks non-terminal transitions in the price. Pre-existing; this diff widens it.

- **Location:** `internal/platform/github/passthrough.go:1104-1108`.
- **Description.** `lifecycleStagesForLabels` returns the terminal set if it is
  non-empty and never reaches `IssueToPhaseStage`. So on an issue naming any terminal
  stage, adding a non-terminal stage label produces `after == before` and costs
  nothing. This is not new — it holds pre-fix for prefixed terminal labels. What is new
  is that canonicalisation drags **bare and foreign-prefix** terminal labels into the
  terminal scan, so the masked set grows. Families 2-4 of the F-1 sweep are this
  interaction.
- **Impact.** On its own, bounded: the read side short-circuits the same way, so the
  task stays terminal and no privilege is gained. It becomes an escalation only when
  combined with F-1's *before*-widening. Fixing F-1 as recommended removes the
  combination; the underlying masking remains and should be tracked.
- **Recommendation.** Track separately. The correct answer is probably that
  `lifecycleStagesForLabels` should return terminal stages **union** the
  `IssueToPhaseStage` answer rather than short-circuiting, so a `duplicate + working`
  set is priced as both. That is a behaviour change with blast radius and does not
  belong in this diff.

---

### [LOW] F-7 — The write view is a `*LabelMapper`, indistinguishable at the type level from the read mapper.

- **Location:** `internal/platform/github/lifecycle_claim.go:172`,
  `passthrough.go:1101-1107`.
- **Description.** The entire read/write partition rests on `lifecycleStagesForLabels`
  calling `view.AllTerminalLabelStages(...)` rather than `s.mapper.AllTerminalLabelStages(...)`.
  Both compile. Both type-check. A future edit that spells `s.mapper` silently reverts
  the round-10 fix at `enabled=false`, with no test failure that names the cause.
- **Why this is worth a line.** This codebase already solved this exact problem once,
  deliberately: `stageWritePolicy` (`passthrough.go:261-291`) was converted from a
  named bool to a struct **specifically** so the authorization-relevant parameter
  could not be spelled without naming a policy. The same reasoning applies here and
  was not applied.
- **Recommendation.** A one-line named type makes the mistake a compile error:

  ```go
  // writeView is a LabelMapper restricted to WRITE-side stage computation. The
  // distinct type is the control: it makes `s.mapper.AllTerminalLabelStages(...)`
  // in a write path a compile error rather than a silent revert of #194 round 10.
  type writeView struct{ *LabelMapper }
  func (m *LabelMapper) writeViewMapper() writeView { ... }
  ```

---

### [INFO] F-8 — Four comments state, as measured facts, things that are false or that the measurement does not support. In this codebase that is raw material for the next round's defect.

The brief asks me to treat a confidently wrong comment as security-relevant and to
recommend correcting comment text before merge. I do, and I would apply it to all four.

1. **`lifecycle_claim.go:74-77`** — *"Both differences are deliberate and both are
   fail-closed — this function can only ever claim MORE labels than
   authorizationStage, never fewer, so routing a gate through it can only ever charge
   more scope."* The premise is true (measured: 0 superset violations over 204
   label × config pairs). **The conclusion is false**, and F-1 is 29 measured
   counterexamples. The non-sequitur is that the predicate appears on *both* sides of a
   set difference, so widening it is not monotone in the price. This sentence is the
   diff's entire safety argument and it does not hold. It is repeated verbatim at
   `passthrough.go:304-306`.

2. **`lifecycle_claim.go:44-48`** — *"axis 2 ... **CLOSED** — the claim is prefix-VALUE
   blind."* It is colon-delimiter-specific, not prefix-value blind. 7 of 10 measured
   foreign-prefix spellings are still unpriced (F-2). Recommend "NARROWED — closes
   colon-delimited single-segment prefixes only; see push_prefix validation."

3. **`lifecycle_claim.go:61-67`** — *"checkLifecycleKeyCollisions already refuses a
   config that aims a priority or type key at a lifecycle label, so the crossover is
   closed at load time."* Measured — it normalises the key with `m.stripForMatch`, i.e.
   with **today's** prefix, so it only refuses local spellings:

   ```
   Validate priorities{"ft:stage/completed": high}  -> REJECTED
   Validate priorities{"completed": high}           -> REJECTED
   Validate priorities{"duplicate": high}           -> REJECTED
   Validate priorities{"ft2:stage/completed": high} -> nil      <- accepted
   Validate priorities{"ft2/stage/completed": high} -> nil      <- accepted
   ```

   The crossover is closed at load time for local spellings and *not* closed for
   foreign ones. It happens to be caught downstream by the new
   `assertStageWriteAllowed` — which is defence-in-depth working as designed, and is
   worth saying instead of the false claim.

4. **`lifecycle_claim.go:98-110`** — the measured table justifying inclusion of bare
   stage names concludes *"bare names are ALREADY priced today"*. The table's rows are
   `add "duplicate" to a CLOSED issue` and `add "working" to an OPEN issue`. Neither is
   the case that changed. For a bare **terminal** name on an **OPEN** issue —
   `IssueToPhaseStage`'s rule-2 demotion — bare names were **not** priced today; that
   is precisely the input F-1 exploits, and the table's vocabulary does not contain it.
   The generalisation is drawn from two rows that both avoid the interesting case.

---

### [INFO] F-9 — The diff's own new test matrix cannot see F-1, structurally.

`internal/server/authz_config_blind_write_scope_test.go:117-119` states the fixture:
*"The write under test is the same in every cell: add a label asserting the terminal
stage 'completed' to an OPEN issue sitting at 'accepted'."* Every one of the five axes
starts from an issue with **no pre-existing lifecycle-naming label**. F-1 requires
exactly one: a bare or foreign terminal label already present. The matrix varies the
config and the written label and holds the *snapshot* fixed — so it cannot observe a
change in the *before* endpoint, which is where the regression lives.
`TestLabelWriteScope_PriorityAndTypeAxesDoNotPriceStages` has the same fixture shape.
Its axis-2 cell also uses only `ft2:` and so cannot see F-2.

This is the test leg's lane and I offer it as an **impression**, not a finding: the
matrix is well built for the axis it was built for, and the gap is in what was varied,
not in how.

---

### [INFO] F-10 — At `enabled=false` the new predicate in `assertStageWriteAllowed` is unobservable; the operative change at that call site is prefix-blindness.

`assertStageWriteAllowed` only inspects labels when `policy == stageWriteForbidden`,
which is only the priority and type arms of `UpdateTask`
(`passthrough.go:617-637`). Both arms obtain their label lists from
`PriorityLabelSwap` / `TypeLabelSwap`, and both of those return `nil, nil` when
`!m.enabled` (measured). So with the toggle off, the gate is always handed empty lists
and the toggle-blindness of `lifecycleStageClaim` buys nothing **there** — round 9
recorded exactly this and the situation has not changed. What the substitution does buy
at that call site is the prefix-blind branch, which now refuses e.g.
`priorities: {"ft2:stage/completed": high}` + a matching label — the case
`checkLifecycleKeyCollisions` misses (F-8 item 3). Worth stating because
`passthrough.go:298-303` justifies the substitution on the toggle argument, which is
the half that does not apply here.

---

## Explicit verdict on each of the five claims — agreements at equal weight

### Claim 1 — *"`lifecycleStageClaim` is a strict superset of `authorizationStage`, so it can only refuse more."*

**Premise: CONFIRMED. Conclusion: FALSE. The two must be checked separately.**

*Premise, as a property over inputs I chose:* 34 labels × 6 configs = 204 pairs,
including `enabled=false`, `push_prefix ∈ {ft:, ft2:, acme/, ft-, ""}`, case variants,
whitespace-padded, empty, `":completed"`, `"team/ft:completed"`, `"ft:stage/stage/completed"`,
priority-path spellings, configured aliases. Assertion: `authorizationStage(raw) ⇒
lifecycleStageClaim(raw) with the same stage`. **0 violations.** The reason is
structural and I checked it by reading, not only by executing: the first branch of
`lifecycleStageClaim` is the *identical expression* `m.labelToStage[m.stripForMatch(raw)]`
that `authorizationStage` ends on, with the two guards removed. This is a genuine green
control and I record it as a result.

*The one exception:* nil receiver — `authorizationStage` panics, `lifecycleStageClaim`
returns false. That is "refuses less" on one input. F-5, Low, not reachable today.

*Conclusion:* I checked the direction the brief asked for — "is there any input it
refuses **less**" — but at the level that matters, which is the **gate**, not the
predicate. **29 inputs.** A superset predicate does not imply a monotone price when the
predicate is applied to both endpoints of a difference. This is F-1 and it is why the
verdict is REQUEST CHANGES. The brief was right that a failure here would be a
regression rather than a shortfall.

### Claim 2 — *Does the write-suppression partition hold, and can a disabled mapper now emit labels?*

**Partition: HOLDS. Emission: NO. Confirmed independently, and I agree with the leg's
call at full weight.**

Measured at `enabled=false`, DefaultConfig, with a label set spanning stage, type and
priority labels:

```
StageLabelSwap    add=[] remove=[]
PriorityLabelSwap add=[] remove=[]
TypeLabelSwap     add=[] remove=[]
StageToLabel(completed)="" PriorityToLabel(high)="" TypeToLabel(bug)=""
```

I also traced the one place the write view *does* produce a real label string —
`canonicalLifecycleLabels` calls `view.StageToLabel(stage)` and at `enabled=false` that
returns `"ft:stage/duplicate"` — and confirmed by enumeration that its output never
escapes to an emission path: `canonicalLifecycleLabels` has exactly one caller
(`passthrough.go:1102`), whose return type is `[]task.Stage`. Nothing reaches
`labelNamesToIDs`. **Had those six guards been deleted, `StageToLabel` would have
started returning a real label at `enabled=false` and `StageLabelSwap` would have
emitted it.** The leg's refusal of the instructed verdict vocabulary was correct and
the near-miss is real.

*The DUAL guard (`terminal_label_stages.go:216-224`, `AllTerminalLabelStages`):*
**safe in one direction, and safe in the other only by convention.** The read
direction is genuinely safe — the guard keeps `LifecycleStages` config-dependent, which
is the operator's expressed intent. The write direction is safe **only because
`lifecycleStagesForLabels` happens to call the method on `view` rather than on
`s.mapper`**; both spellings compile and both type-check. That is not a partition, it is
a habit. See F-7. So: safe in the read direction as a property; safe in the write
direction as a convention.

### Claim 3 — *Coverage of `Priorities` and `Types`.*

**Determination: DELIBERATELY EXCLUDED, with a sound conclusion reached via a false
premise. The exclusion should stand; the stated reason should not ship.**

- **Not covered.** `lifecycleStageClaim` consults `labelToStage` only. Measured:
  `high`, `ft:high`, `priority:high`, `bug`, `ft:bug` all return `claim=(,false)`.
- **Deliberately, not by omission.** `lifecycle_claim.go:61-67` addresses axes 4/5
  explicitly.
- **Does the original escalation reproduce through them?** **No.** I checked whether
  `Priorities`/`Types` feed any authorization or lifecycle decision. They do not:
  `MapLabelsToPriority` / `MapLabelsToType` populate `t.Priority` / `t.Type` only;
  neither appears in `TransitionScope`, `issueUnavailableForClaim`,
  `ComputeAvailability`, `LifecycleStage(s)`, or the treewalk readiness computation.
  A priority label is already writable with `task:write` through
  `UpdateTask(priority=...)`, so writing one via `add_labels` gains nothing. The
  restated ruling's inclusion of `Priorities`/`Types` is, on measurement, not load-
  bearing — the exclusion is correct.
- **The stated reason is false.** `checkLifecycleKeyCollisions` does *not* close the
  crossover for foreign-prefix keys (F-8 item 3). The actual thing that closes it is
  `assertStageWriteAllowed` with the new predicate. The comment credits the wrong
  control, and the control it credits is the one an operator could disable by loading a
  mapper outside `LoadConfig` — which `labels.go:181-183` says happens.

### Claim 4 — *Are three the complete set?*

**No — for the question as the brief phrases it. Yes, plausibly, for the narrower
question the leg actually answered. I did not re-derive the three.**

The leg's three (`terminal_label_stages.go:198`, `:70`, `labels.go:393`) are the
complete set of *guards suppressing the stage-pricing path at `enabled=false`*. That is
a mutation-matrix result on the test leg's axis and I deliberately did not re-run it.

The brief's question is broader — "any path by which a written label becomes
authoritative" — and there I enumerated rather than grepped, per the method note. The
sinks are: `LifecycleStage`/`TerminalLabelStage` (claim gate + availability),
`LifecycleStages`/`AllTerminalLabelStages` (`server.go:716`),
`LabelDeltaLifecycleStages` (the price, `server.go:{199,383,841}`),
`issueToTask`/`IssueToPhaseStage` → `t.Stage`, `MapLabelsToStage` (treewalk node stage,
`treewalk.go:{36,53}`), `AllTerminalLabelStages` in the treewalk (`treewalk.go:112`),
and **`hasExternalUnavailableLabel`** (`treewalk.go:{125,157}`, `passthrough.go:843`,
`passthrough.go:1406`).

The last is a fourth, it is unpriced in both directions, and no widening of
`lifecycleStageClaim` can reach it because its vocabulary contains no `task.Stage`. See
F-4. The brief's hint about *schedulers* was productive — the scheduling surface in this
codebase is `treewalk.go`'s `computeReady`/`computeBlocked`, and that is where the
fourth path lives — though there is no separate scheduler component as the phrasing
implies.

I found no cached index or import path that turns a label into a lifecycle decision:
`labelIndex` is a name→node-ID cache with no semantics, and the Ent-backed import paths
(`entstore.go:2192`, `beads_import.go:288`) store labels as opaque strings on a store
that does not implement `LifecycleStageSetStager`.

### Claim 5 — *Foreign-prefix reachability at `enabled=TRUE`.*

**Pre-fix reachability: CONFIRMED. Post-fix closure: NARROWED, NOT CLOSED — and
partially reversed.**

- *Pre-fix, `enabled=true`, DefaultConfig, no config change:* adding
  `ft2:stage/completed` to an open `accepted` issue prices `[accepted] → [accepted]`,
  i.e. **`task:write`**. Confirmed. The leg's correction of the brief's framing was
  right: this was never a toggle-only problem.
- *Post-fix, same input:* `[accepted] → [completed]`, i.e. **`task:close`**. Confirmed
  closed **for that spelling**.
- *But:* only for colon-delimited single-segment prefixes. `ft2/stage/completed`,
  `ft-stage/completed`, `a:b:stage/completed` and four other measured spellings still
  price at `task:write` post-fix. **7 of 10.** F-2.
- *And, plainly:* the live exposure is **not** closed, because F-1 reintroduces it on a
  different input. `labels=[ft2:stage/completed], add=[ft:stage/completed]` now costs
  `task:write` and moves `LifecycleStage` from `accepted` to `completed`. Any label
  planted through the pre-fix hole is now *upgradeable* to the authoritative local
  spelling for free. The fix narrowed the front door and, on the same code path, opened
  a side door for the tenants the front door already admitted.

---

## Where this brief is wrong — numbered, required deliverable

1. **Both non-test gate rows are wrong for this tree, and the vet row is the dangerous
   one.** `go build ./...` exits **1** on a clean checkout
   (`pattern all:web/dist: no matching files found`), not 0. Worse, `go vet ./...` emits
   a **single** line — that same embed message — and **zero** of the four `ephReq`
   copylocks the block names. So the block's own instruction to match by message finds
   nothing, and its sentence *"anything else vet says is attributable to this diff"*
   aims a pre-existing, explicitly-fenced defect (#100) at the diff under review. That
   is a brief that manufactures a false finding in a leg that follows it correctly —
   the most costly shape of brief error, because the leg's diligence is what produces
   the wrong answer. Root cause: the tree was cloned and `web/dist` is untracked.

   **The EM caught and corrected this mid-round, unprompted, having re-measured in my
   tree, and explicitly asked to be counted against here rather than quietly amended.**
   I verified rather than accepted: both rows re-measured from scratch, with a positive
   control, after the message. The correction is accurate. Logged as an error because
   that is what was asked for and because the ledger should be complete — but the
   self-correction is a materially better outcome than a table that had been right by
   luck, and it should be weighted that way when this ledger is read.

2. **The correction in item 1 was itself wrong in the way that mattered, and the EM
   amended it.** It framed the risk as a *false alarm* — leg finds zero copylocks,
   concludes the tree is broken. That failure self-announces. The real risk is the
   opposite sign: **`go vet` still exits 1 on the clean checkout**, for the embed error,
   so the table's `vet → 1` row is recorded as REPRODUCED by any leg that checks the exit
   code, with none of the four named findings ever emitted and nothing to announce it.
   Verified: clean checkout `exit=1, lines=1, ephReq=0`. A gate row that reproduces its
   exit status for the wrong reason is worse than one that fails.

   Logged as a distinct item at the EM's request. Two observations that belong next to
   it. First, the shared block's own "match by MESSAGE, not by count" rule is the only
   thing that catches this, and it structurally will not fire, because it is applied to
   rows that look suspicious and this row looks green — the rule needs restating as
   *match by message on every row, especially the green ones*. Second, **I did not catch
   this and my method would not have**; I measured vet only after fabricating `web/dist`.
   What accidentally saved me was a defect: my first run was `go build ... | tail`, which
   reports `tail`'s exit code, converting the quiet trap into a loud one. A bug in my
   harness masked a trap in the brief, which is luck, not diligence, and I am recording
   it as luck.

3. **`go build ./... | tail` reports `$?` from `tail`.** Flagged by the EM in the same
   amendment and independently hit by me on my first gate run (reported above). Not a
   brief error as such, but it belongs on this list because the brief's gate table is
   the thing legs pipe.

4. **Claim 1 is stated as one claim and is two.** *"is a strict superset ... so it can
   only refuse more"* — premise and conclusion have different truth values (true;
   false). The brief inherits the diff's non-sequitur and asks me to check it as a unit.
   The instruction that saved the finding was the *other* one: "check it as a property
   over inputs you choose". Checking the property confirmed the premise; only checking
   the **gate** rather than the predicate found the regression.

5. **Claim 1's failure mode is under-specified.** *"If the new claim is not a strict
   superset, then somewhere the fix allows a write the old code refused."* This is a
   sufficient condition presented as a necessary one. The fix *does* allow writes the
   old code refused, and the claim **is** a strict superset. Both, simultaneously,
   measured. Looking only where the brief points would have found nothing.

6. **Claim 5 presupposes its answer.** *"confirm the post-fix closure"* — there is no
   closure to confirm. Axis 2 is narrowed to one delimiter class, and F-1 partially
   reverses it. This is failure mode 1 from the shared block: a real input supplied with
   a stated consequence that is wrong.

7. **The restated ruling is not met, and the diff says it is.** *"`ft:stage/completed`,
   `ft2:stage/completed` and `anything:stage/completed` price identically. The unbounded
   thing was the prefix, not the suffix."* `anything/stage/completed` and
   `anything-stage/completed` do not. `push_prefix` is unconstrained, so "anything" is
   the right word and the code implements "anything followed by a colon".

8. **Claim 3's premise does not survive measurement.** *"A label whose suffix matches a
   configured priority or type ... is the same shape of defect **if** those maps feed any
   authorization or lifecycle decision."* The conditional is well posed and the answer is
   no — they feed nothing. So the restated ruling naming three config maps names one
   more than the threat model supports. This is the reverse of failure mode 2: a stated
   set that is too **wide**, not too narrow.

9. **Claim 4's framing mismatches the leg's result.** The three contributors answer
   "what suppressed pricing at `enabled=false`". The brief then asks whether three is the
   complete set of *paths by which a written label becomes authoritative* — a different
   set, which has at least four members. Read literally the two questions have different
   answers and the brief treats them as one.

10. **Claim 2's premise about where the toggle matters is wrong.** The brief treats
   `enabled=false` as the interesting case for the `assertStageWriteAllowed`
   substitution. At `enabled=false` that gate is provably handed empty lists; the
   substitution is unobservable there. F-10.

11. **The scope fence omits concurrency, and the diff adds shared mutable state.** The
   fence lists six settled items and reads as though the remaining surface is the stage
   semantics. This diff adds an unsynchronised lazily-initialised field to a struct whose
   sibling fields are lock-protected *because a previous round found a fatal race there*
   (#198). Nothing in the fence would have stopped a leg concluding concurrency was
   someone else's lane. F-3.

12. **"a related finding on this branch involved enumerating *authorization gates* when
    the thing that mattered was *schedulers*."** Productive hint, inaccurate noun. There
    is no scheduler component; the scheduling surface is `treewalk.go`'s
    `computeReady`/`computeBlocked`, reached through `hasExternalUnavailableLabel` and
    `MapLabelsToStage`. A leg grepping for a scheduler finds nothing and stops.

13. **On the residual risk of deferring axis 3, since you asked:** I think you are
    rating it **about right**, with one caveat you should hold explicitly. The
    unknowable part — a suffix like `shipped` that no config recognises yet — is
    genuinely unpriceable at write time and the deferral is correct. The caveat is that
    the promotion is **retroactive over all history and there is no attribution**: the
    day an operator adds `stages: {shipped: completed}`, every `shipped` label ever
    written becomes authoritative at once, and nothing records who wrote which. So the
    config-CHANGE-time control needs to *enumerate and report* the labels the change
    would promote, not merely warn — otherwise the operator is asked to approve a
    transition whose blast radius is not shown to them. That is a design requirement on
    the deferred item, not a reason to un-defer it.

---

## Predictions — accuracy, and why the score is not the result

I recorded 12 predictions before running the harness.

| # | prediction | outcome |
|---|---|---|
| 1 | `lifecycleStageClaim ⊇ authorizationStage` holds as a property | HIT (0/204) |
| 2 | `ft2/stage/completed` unclaimed → unpriced | HIT |
| 3 | `ft-stage/completed` unclaimed → unpriced | HIT |
| 4 | `a:b:stage/completed` unclaimed → unpriced | HIT |
| 5 | `ft2:stage/completed` claimed → axis 2 colon case closed | HIT |
| 6 | nothing emits a label at `enabled=false` | HIT |
| 7 | `writeView` races under `-race` | HIT |
| 8 | `Priorities`/`Types` not covered by the claim | HIT |
| 9 | `checkLifecycleKeyCollisions` accepts a foreign-prefix priority key | HIT |
| 10 | `hasExternalUnavailableLabel` writes are unpriced | HIT |
| 11 | axis 1 closed: `ft:stage/completed` at `enabled=false` now priced | HIT |
| 12 | a weakening exists, in the "bare terminal label on an open issue" shape | HIT |

**12/12, and I am treating that as weak evidence, for a specific reason.**
Prediction 12 was right about the *existence* and *mechanism* of the regression and
badly wrong about its *extent*: I predicted two cells and one family; the exhaustive
sweep found **29 cells in four families**, including the two highest-impact shapes —
the `ft2:` laundering path and the `task:claim` bypass — which I did not predict at
all and would not have found by testing the cells I had reasoned my way to. The sweep
was 40 lines and cost less than the reasoning did.

**Misses, reported per the rule:**
- My first gate run reported `build exit: 0` for a build that failed. Caught only by
  re-running with the exit code captured directly. Discarded.
- A `grep --include=*.go` was eaten by the shell (`no matches found`). That one
  announced itself by erroring rather than returning a clean zero, which is the lucky
  version of the failure; the build one was the unlucky version and is the reason the
  rule exists.
- I initially reasoned that the diff could only tighten prices, on the same superset
  argument the docblock makes, and started writing that as a green control. The sweep
  is what corrected me.

---

## Positive observations

These are results, not politeness.

- **The axis-1 closure is real and the mechanism is the right one.** Routing the write
  side through an `asIfEnabled` view reuses the *same* `StageToLabel`,
  `AllTerminalLabelStages` and `IssueToPhaseStage` rather than reimplementing them.
  That is the correct answer to "how do I ask a different question of the same rules"
  and it is consistent with the `checkLifecycleKeyCollisions` precedent it cites.
- **337 of 1800 sweep cells tightened.** Adding `ft2:stage/completed`, removing a bare
  `duplicate` from an open issue, creating a task with a bare terminal label — all
  previously free, all now priced. The round moved a lot of real ground.
- **The six write-suppression guards were correctly identified and kept.** I confirmed
  independently that deleting them would have made `StageToLabel` return a live label
  at `enabled=false` and `StageLabelSwap` emit it to a repository the operator had
  deliberately disabled mapping for. The leg's refusal of an instructed verdict
  vocabulary prevented a real outbound-integrity failure.
- **`stripAnyLifecyclePrefix`'s slash guard is right.** Requiring that the pre-colon
  segment contain no `/` means `team/ft:completed` is not read as namespaced — a
  deliberate, correct narrowing that preserves the round-4 fix. Verified in the
  superset sweep.
- **Round 9's false sentence about the toggle was corrected rather than deleted**
  (`terminal_label_stages.go:46-74`), with the measurement and a discriminating
  control shown inline. That is the right disposal of a wrong claim and it is why I
  trust the surrounding text enough to have checked the four claims in F-8 rather than
  all of them.
- **The gate table was corrected by its own author, mid-round, unprompted, with the
  measurement attached and a request to be counted against in the ledger** (item 1).
  I verified it independently rather than accepting it. This is the same disposal
  discipline as the round-9 comment retraction, applied to the brief instead of the
  code, and it is the reason the vet row in this report rests on a fresh measurement
  rather than on a table nobody re-ran.
- **`RestrictLabelWriteToSnapshot` deriving from `applyLabelDelta` rather than
  mirroring it** remains the strongest structural control in this file, and the round-10
  correction of its mutant table (naming a mutant that proved the opposite of the claim,
  and fixing the sweep rather than the prose) is exactly the discipline the F-8 comments
  are missing.

## Recommendations

1. **Blocking:** fix F-1 by making the price monotone — floor the *before* endpoint at
   the read answer, or charge `max(readPrice, writePrice)`. Pin it with a
   **monotonicity property test** over a label/delta vocabulary, not with more example
   cells; example cells are what missed it.
2. **Blocking:** correct the four comments in F-8, especially
   `lifecycle_claim.go:74-77`, which is the sentence the next reader will budget
   against. Downgrade `axis 2 ... CLOSED` to `NARROWED`.
3. **Before merge:** fix F-3 by building the write view eagerly in `NewLabelMapper`,
   and add `-race` to the package's gate set.
4. **Same sprint:** close F-2, preferably by constraining `push_prefix` in `Validate()`
   to the delimiter class the claim recognises, so the code's coverage and the config's
   degrees of freedom are the same set by construction rather than by review.
5. **Next sprint / separate task:** F-4 (`hasExternalUnavailableLabel` unpriced in both
   directions — the *remove* direction first) and F-6 (terminal-first masking).
6. **Design requirement on the deferred axis 3:** the config-change-time control must
   enumerate and display the labels a `stages:` alias would retroactively promote, not
   merely warn that some exist.
