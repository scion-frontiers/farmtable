# Security audit — #194 round 5 (`label-write-scope`)

**Target:** `ea8ac390dad3d2401d65608684e5d6623ab15ac5`, verified with `git rev-parse HEAD`
against a clean tree before any work started.
**Leg:** security audit (1 of 3). I did not read the other legs' reports or working files.

---

## VERDICT: APPROVE

B1, B5 and B6 do what the round-5 log claims. I reproduced the central claim
independently and it holds: **the terminal→terminal conversion class is closed,
12 of 12 in both shapes, with working positive controls and a working
differential.** I found no new bypass of the `UpdateTask` gates at any prefix I
could construct.

The approval is for round 5 as an increment. It is **not** a statement that #194
is closed, and one thing below should change the shape of what comes next:
**round 5 does not satisfy its own invariant 1.** `CreateTask` is an unguarded
write path to the value authorization reads. The developer disclosed and pinned
this honestly, and the coordinator is tracking it as a residual — my measurement
says the classification is defensible but understated, and I recommend it be
sequenced before #194 is called closed rather than carried as a footnote. See
**A-1**.

### Severity summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 2 |
| Info | 3 |

No finding blocks the merge.

---

## Gate — reproduced independently, I AGREE with the EM's record

Exit codes captured from the child process, not through a pipe. (My first
attempt captured `GO_TEST_EXIT` through `${PIPESTATUS[0]}` after an intervening
command and got an empty value; re-run properly. Disclosed per bar 4.)

```
GO_BUILD_EXIT=0     (after stubbing web/dist, as the shared brief describes)
GO_VET_EXIT=1       exactly 4 copies-lock findings, 0 other lines:
                    server.go:1601, :1711, :1919, :2096
GO_TEST_EXIT=0      10 packages ok, no FAIL, no panic
MAKE_RACE_EXIT=0
```

The four vet findings match the EM's record by line number *and* by request type
(`GetReadyTasks`, `GetBlockedTasks`, `GetCriticalPath`, `GetBottlenecks`). With
my two probe files added, `go test ./...` still exits 0.

---

## Findings

### [MEDIUM] A-1 — `CreateTask` is an unguarded write path to the value authorization reads; round 5 does not meet its own invariant 1

- **Location:** `internal/server/server.go` — `CreateTask`, the `req.Stage` arm
  (`TransitionScope(triage, stage)`) vs. `p.Labels = req.GetLabels()` roughly 50
  lines later, ungated.
- **Mark:** **BY EXECUTION** (`TestAuditR5_Charge5_CreateTaskResidualPrivilegeConsequence`).
- **Description.** Invariant 1, as the round states it, is: *if authorization
  reads a value, every write path to that value must be guarded by the same
  authorization.* B1 applied that to `add_labels`/`remove_labels` on
  `UpdateTask`. `CreateTask` accepts caller-supplied labels with no equivalent
  gate, so the same value the `UpdateTask` gate now protects can be written
  through a different verb at the lowest write scope.
- **Measured, end to end, on a bare `task:write` agent token:**

  | step | result |
  |---|---|
  | `CreateTask(stage=completed)` | DENIED, names `task:close` |
  | `CreateTask(labels=[ft:stage/completed])` | **ALLOWED** |
  | resulting lifecycle stage | `completed` |
  | resulting availability | `Available=false Reasons=[terminal]` |
  | `remove_labels[ft:stage/completed]` to undo | **DENIED, names `task:accept`** |

  So the label route reaches the exact end state the stage route is gated to
  prevent, and it is **one-way**: creating the terminal state costs
  `task:write`, reversing it costs `task:accept`, which the caller does not
  hold. That asymmetry is precisely what #194 was filed for.
- **Why I still call it Medium and not High.** The blast radius is a task the
  caller just created, not one they do not own. `createIssue` makes a *new*
  issue, so this does not let an attacker terminal-ise a maintainer's task. I
  also checked the escalation path I expected to find and it is **not** there:
  `hasOpenSubIssue` (`passthrough.go:640`) and `computeReady`
  (`treewalk.go:84`) both key off GitHub **issue state**, not labels, so a
  born-terminal child does **not** unblock a parent. What remains is an
  authorization-record bypass — an agent can declare work finished without
  `task:close` — plus queue pollution that only a higher-scoped actor can clean
  up.
- **Recommendation.** Route creation-time labels through the same seam the
  `UpdateTask` gate uses, so there is one chokepoint rather than one per verb:

  ```go
  // in CreateTask, after the req.Stage arm and before p.Labels is set:
  if len(req.GetLabels()) > 0 {
      // A task created into a terminal stage costs what moving one there costs,
      // whichever verb spells it. Creation's "before" is the default stage.
      _, after := store.LabelDeltaLifecycleStages(ctx, s.store, &ent.Task{
          Stage: stage, CollectionID: collID,
      }, req.GetLabels(), nil)
      for _, to := range after {
          if sc := TransitionScope(string(stage), string(to)); sc != ScopeTaskWrite {
              if err := RequireScope(ctx, sc); err != nil {
                  return nil, err
              }
          }
      }
  }
  ```

  The durable version is #203 (move the authoritative stage off labels), which
  removes the whole verb-by-verb enumeration. Until then, every new write verb
  is a new hole, and this finding is the evidence for that rather than an
  argument against the interim control.
- **Withdrawn sub-finding, disclosed.** I filed `InsertTasksAfter` as a second
  unguarded creation verb on a static read — it takes only `ScopeTaskWrite`,
  hardcodes `Stage: task.StageTriage`, and passes `step.GetLabels()` straight
  through. **Measured: not reachable.** The pass-through store returns
  `Unimplemented`, and on a native Ent collection the stage is a column no label
  can forge. The static reading was right about the code and wrong about the
  exposure. Withdrawn.

---

### [LOW] A-2 — a whitespace-only `push_prefix` silently disables B1, B5 and B6 together, with no config validation

- **Location:** `internal/platform/github/terminal_label_stages.go:62` (`matchPrefix`),
  interacting with `authorizationStage:47` and `labels.go:543` (`stripForMatch`).
- **Mark:** **BY EXECUTION** (`TestAuditR5_PathologicalPrefixConfigs`).
- **Description.** `matchPrefix` defaults only on the **empty** string. A
  prefix of `" "`, `"  "`, `"\t"` or U+00A0 is non-empty, so it is used as-is —
  but `authorizationStage` and `stripForMatch` both `TrimSpace` the label
  *before* testing `HasPrefix`, so a whitespace prefix can never match anything.
  Measured:

  ```
  push_prefix=" "     own_label=" stage/completed"   authorizes=false  self_consistent=false
  push_prefix="  "    own_label="  stage/completed"  authorizes=false  self_consistent=false
  push_prefix="\t"    own_label="\tstage/completed"  authorizes=false  self_consistent=false
  push_prefix=" " own_label=" stage/..."   authorizes=false  self_consistent=false
  ```

  Under such a config the deployment's **own** terminal labels stop feeding
  authorization. `AllTerminalLabelStages` returns nil for everything, so
  `LifecycleStages` falls back to `t.Stage`, `before == after` at the B1 gate for
  every label edit, and B5 never sees a set with more than one member. All three
  round-5 controls go inert at once, and Farm Table's own closed tasks read as
  live, available and claimable.
- **Direction.** Fail-**open on availability**, fail-closed on privilege —
  wrongly available, not wrongly privileged, which is the direction the
  coordinator has ruled acceptable. That is why this is Low and not Medium.
- **Why it is still worth fixing.** Since B6, `push_prefix` is a security
  parameter, and nothing validates it. The failure is completely silent.
- **Recommendation.** Treat blank as blank, and reject a prefix that cannot
  survive the lookup:

  ```go
  func (m *LabelMapper) matchPrefix() string {
      if p := strings.ToLower(strings.TrimSpace(m.config.PushPrefix)); p != "" {
          return p
      }
      return "ft:"
  }
  ```

  and validate at config load that `stripForMatch(StageToLabel(s))` round-trips
  to `s` for every stage — a two-line startup assertion that would have caught
  every row in the table above.

---

### [LOW] A-3 — F7 is RPC-reachable on a `task:write`-only token through the surviving `from == to` short-circuit

- **Location:** `internal/server/transitions.go:124` (`from == to` →
  `ScopeTaskWrite`) reaching `labels.go:285` (`StageLabelSwap`, still
  prefix-tolerant via `stripForMatch`).
- **Mark:** **BY EXECUTION** (`TestAuditR5_Charge4_FromEqualsToReachability`,
  cell `cardinality1_terminal_beside_a_bare_stock_label`).
- **This is not a re-file.** F7 is known, the developer measured it, reported it
  **unfixed** and pinned it, and the shared brief puts it out of scope. I am
  reporting it because the brief also says to speak up if a known item is
  **materially worse than recorded**, and I think the *reachability* is:
  the developer's pin measures F7 at the **unit** level
  (`StageLabelSwap([duplicate bug], working)`). I measured it **end to end
  through the RPC**, allowed, on a token holding nothing but `task:write`:

  ```
  UpdateTask(stage=wont_fix) on an issue labelled [ft:stage/wont_fix, duplicate]
    -> ALLOWED (from == to)
    -> labels [ft:stage/wont_fix duplicate] -> [ft:stage/wont_fix]
  ```

  The human's stock `duplicate` label is destroyed by a request that the gate
  correctly classifies as a no-op, because it *is* a no-op for the lifecycle
  stage and is not one for the label set.
- **Charge 4's answer, stated precisely.** `from == to` still fires at
  cardinality 0 and 1 (5 shapes measured). Four of the five write nothing a
  `task:write` token should not write. **This one does** — not lifecycle state,
  but a third party's data.
- **Recommendation.** No change to the gate; the gate is right. Fix belongs with
  F7: make `StageLabelSwap` decide ownership with `authorizationStage`'s prefix
  requirement rather than the prefix-tolerant `stripForMatch`, so the writer and
  the readers agree about which labels are ours. Worth noting that the round-5
  log already frames F7 exactly this way ("one label, two answers, in the same
  mapper"); this finding only raises its measured reach.

---

### [INFO] A-4 — `TrimSpace` is unicode-aware, so the prefix requirement is wider than "starts with the configured string"

- **Location:** `terminal_label_stages.go:47`, `labels.go:543`.
- **Mark:** **BY EXECUTION** (`TestAuditR5_PrefixParseMatrix`,
  `TestAuditR5_NBSPAndTrimSpaceBoundary`).
- **Costly disclosure: my own prediction here was wrong.** I wrote this row
  expecting `want=false`, on the assumption that `strings.TrimSpace` handles
  only ASCII whitespace. It uses `unicode.IsSpace`. Measured:
  `" ft:stage/completed"` **does** authorize as `completed`, as do leading
  ideographic and ogham spaces. The probe caught me, which is the reason the row
  is still in the file with the wrong prediction recorded next to the right
  answer rather than quietly corrected.
- **Not exploitable, and here is why it holds.** The widening is applied
  *consistently*: `authorizationStage`, `stripForMatch` and `labelMatchKey`
  (`passthrough.go:939`) all normalise with `ToLower(TrimSpace(·))`. So a
  whitespace-padded spelling is treated as the same label by the delta
  predictor and by the readers, and — decisively — an attacker who can apply
  `" ft:stage/completed"` can equally apply `"ft:stage/completed"`, which
  costs the same. There is no lower permission bar on the padded spelling, so
  there is nothing to gain.
- **The related asymmetry, checked and safe.** `labelNameToID`
  (`passthrough.go:181`) uses `ToLower(name)` with **no** `TrimSpace`, while
  `labelMatchKey` uses both. The predictor is therefore strictly *coarser* than
  the real GitHub lookup, which means it can only ever over-predict a change —
  charging for a transition that would not have happened. Fail-closed. If those
  two normalisations ever diverge in the other direction, a missed change at
  this gate is a bypass rather than a rounding error.
- **Recommendation.** None required. If you want defence in depth, have
  `labelNameToID` and `labelMatchKey` share one normaliser so the coarser/finer
  relationship is enforced rather than incidental.

---

### [INFO] A-5 — a configured terminal alias that carries the prefix is unreachable by its own spelling, and reachable by a double prefix

- **Location:** `labels.go:141-148` (custom `cfg.Stages` keys are stored
  verbatim) vs. `terminal_label_stages.go:50` (lookup happens *after* the prefix
  is stripped).
- **Mark:** **BY EXECUTION** (`TestAuditR5_CustomStageAliasesUnderB6`).
- **Description.** Configured alias keys are looked up post-strip, so:

  ```
  Stages: {"shipped": "completed", "ft:shipped": "completed"}
    "shipped"       -> auth ("",false)          display ("completed",true)   [B6, intended]
    "ft:shipped"    -> auth ("completed",true)  -- matches the BARE key, not the configured one
    "ft:ft:shipped" -> auth ("completed",true)  -- matches the configured "ft:shipped" key
  ```

  An operator who follows the log's guidance ("must now spell them with the
  prefix") by writing the prefix into the *config key* gets a key reachable only
  as a double prefix. The guidance works if they leave the key bare and spell
  the prefix on the **label**; it silently does not if they put the prefix in
  the key.
- **Impact.** Operator confusion, not privilege. No such configuration exists
  in-tree, as the log correctly says.
- **Recommendation.** Normalise custom `cfg.Stages` keys through `stripForMatch`
  at mapper construction, so a key is stored the way it will be looked up.

---

### [INFO] A-6 — the `stripForMatch` refactor is a provable no-op; no display behaviour changed

- **Mark:** **REASONED** (from the diff) and **BY EXECUTION** (differential sweep).
- The charge asked whether sharing `matchPrefix` changed display as a side
  effect. It did not. `git diff 03ab6b6..ea8ac39 -- labels.go` shows the old body
  was `prefix := strings.ToLower(m.config.PushPrefix); if prefix == "" { prefix = "ft:" }`
  — which is `matchPrefix()` character for character. The extraction is
  behaviour-preserving by inspection, and
  `TestAuditR5_StripForMatchAndAuthorizationStageCannotDisagree` confirms it
  across 9 prefixes × 117 labels with no divergence in either direction.

---

## Charges, answered

**1. Is the class actually closed? — YES. BY EXECUTION.**

Positive control first, as instructed, and it is the part the round-4 audit got
wrong. `TestAuditR5_PositiveControl_TheProbeCanObserveAnAllow` proves three
things before any denial is trusted: the `add_labels` shape can be allowed, the
`UpdateTask(stage=…)` shape can be allowed, and — the specific control round 4
lacked — **all four terminal destinations are reachable via `UpdateTask` when
`task:close` is held**, so a denial naming one of them is a property of the gate
and not of the destination.

| shape | round 4 @ `03ab6b6` | measured now @ `ea8ac39` |
|---|---|---|
| `add_labels[Y]` on a task labelled `X` | 6/12 converted | **0/12 converted, 12/12 denied naming `task:close`, 12/12 allowed once `task:close` is held** |
| `UpdateTask(stage=Y)` on `[X, Y]`, no label write | 6/12 converted | **0/12 converted, 12/12 denied, 12/12 allowed with `task:close`** |
| `remove_labels[X]` from `[X, Y]` (my addition) | not measured | **0/12 ungated, 12/12 denied** |

The differential is what makes this more than a blanket refusal: every one of
the 24 denied cells flips to allowed when — and only when — `task:close` is
added. I agree with the developer's 12-of-12 claim on both shapes, and I add a
third shape they did not tabulate which is also fully gated.

**2. Does B6 open anything new? — No bypass found.**

25-row adversarial matrix plus a 9-prefix × 117-label differential sweep.
Case variation, leading/trailing whitespace, `Contains`-not-`HasPrefix`
(`xft:`, `team-ft:`), double and triple prefix, internal space after the prefix,
prefix-only, empty, fullwidth Latin, Cyrillic look-alike, Turkish dotted capital
İ, zero-width space inside the prefix, combining accent — **all fail closed.**
Double prefix (`ft:ft:stage/completed`) denies, because only one strip happens
and the residue is not a stage key. A prefix that is a substring of a stage name
(`"c"`, `"co"`, `"com"`, `"w"`, `"d"`, `"t"`, `"a"`) does **not** promote the
bare stock label, because the residue after stripping is not a stage key either
— and the positive control confirms the deployment's own label still works at
each of those prefixes. Empty prefix means `ft:`, as documented.

`stripForMatch` and `authorizationStage` cannot disagree: they share
`matchPrefix`, the requirement is evaluated on the same normalised string as the
lookup, and the sweep found zero divergences of any of the three kinds it tests
for (bypass / drift / denial-of-work). Display behaviour is unchanged — A-6.

Two non-bypass notes: A-4 (unicode whitespace, my prediction was wrong) and
A-5 (alias keys).

**3. Is the singular reader exploitable? — Not today, and here is the reason,
stated so it survives a new caller. BY EXECUTION + REASONED.**

96 label sets (every subset of the four terminal labels × 6 masking-label
combinations, including bare stock spellings). On every one, the singular reader
and the set reader **agree on terminal-ness**, and the set **always contains**
the singular winner.

The reason is three facts, and it is worth naming which one is fragile:

1. `TerminalLabelStage` and `AllTerminalLabelStages` compute the same `present`
   set by the same expression; they differ *only* in the final projection.
2. Both consumers of the singular reader ask a **boolean**, never *which* stage:
   `ComputeAvailability` asks `IsTerminalStage(LifecycleStage(...))`
   (`passthrough.go:974`), and `issueUnavailableForClaim` asks
   `lifecycleStage != task.StageAccepted` (`passthrough.go:672`) — and *every*
   terminal stage satisfies both, so the tiebreak's choice cannot change either
   answer.
3. Therefore authorization (the set) is never *weaker* than
   availability/claim (the winner), because the set is a superset.

**What breaks it** is a stage where `store.IsTerminalStage(S)` is true but
`S ∉ terminalStagePrecedence`: the singular reader's loop then falls through and
returns `("", false)`, falling back to `t.Stage`, while the set reader reports
`S`. I verified by execution that the two lists agree today, and demonstrated the
divergence by simulating the short list rather than patching the source. That is
the known round-6 fail-open item; I am not re-filing it, but charge 3's safety
**rests on it**, which is worth recording.

**What would NOT survive a new caller:** any new caller that asks the singular
reader *which* terminal stage for a privilege decision — as opposed to *whether*
it is terminal — reopens the tiebreak-is-the-decision problem immediately.
Recommendation: make that unrepresentable rather than a convention. Give
`LifecycleStage` a doc contract saying "the returned identity is display-only;
privilege paths must use `LifecycleStages`", or better, have the privilege-facing
seam return a `bool` for terminal-ness so a caller cannot read the identity.

**4. Where can `from == to` still be reached? — Cardinality 0 and 1, five shapes,
one of which writes third-party data. REV9's premise holds. BY EXECUTION.**

Enumerated and measured:

| label set | restamp | fires? | wrote |
|---|---|---|---|
| `[bug]` | accepted | allowed | adds `ft:stage/accepted` |
| `[ft:stage/accepted]` | accepted | allowed | nothing |
| `[ft:stage/completed]` | completed | allowed | nothing |
| `[ft:stage/wont_fix, ft:stage/working]` | wont_fix | allowed | strips `ft:stage/working` (benign) |
| `[ft:stage/wont_fix, duplicate]` | wont_fix | allowed | **strips the human's `duplicate`** → A-3 |
| `[ft:stage/wont_fix, ft:stage/completed]` | completed | **DENIED** | — |
| all four terminals | cancelled | **DENIED** | — |

At cardinality ≥ 2 the short-circuit cannot fire for the whole set, exactly as
B5 intends. Terminal-ness was never created or destroyed by an allowed
`task:write` request, and `closeCalls == 0` on every allowed cell.

**REV9's premise, tested adversarially.** The premise is load-bearing for a green
test, so I attacked it two ways.

*First, the counter.* `closeCalls == 0` is evidence only if the counter can reach
1. I proved it can: driving `CloseTask` through the identical fixture takes it to
exactly 1. Without that control, a renamed mutation or a close carried as a field
on `updateIssue` would leave REV9 green for the wrong reason.

*Second, a strictly stronger assertion than the counter.* The counter cannot see a
close that does not travel as a `closeIssue` mutation, so I asserted on the
**issue state itself** across every destination `UpdateTask` accepts — 9 from an
open issue, 3 from a closed one. State never moved: open stayed `OPEN`, and a
closed issue was **not reopened** by `UpdateTask(stage=accepted|in_review|triage)`
even with every scope held.

*Structurally,* this is also forced: `passthrough.go:412` is the only `updateIssue`
call and passes just title and body, and `UpdateIssueInput` is never populated
with a `State` field anywhere in the package (`graphql_queries.go:268`, `:449`).
The `p.Phase` reference at `passthrough.go:255` is a **read** in `ListTasks`, not
a write. **REV9's premise is sound.**

**5. `CreateTask` residual — measured, and the classification is understated.**
See **A-1**. Reaches the #194 end state, one-way, at `task:write`; blast radius
is the caller's own new task; does not unblock parents. My read: **Medium**, and
it should be sequenced rather than carried, because it is the standing
counterexample to the round's own invariant 1.

**6. Custom-prefix deployments — the authorization path honours the configured
prefix end to end. BY EXECUTION.**

I re-ran the whole shape-A matrix under `push_prefix = "acme:"`: **12/12 denied**.
So B6's control is not an artefact of the shipped default — which matters,
because before this round no test in the repository had ever varied
`push_prefix` at all.

A deployment configured with `acme:` correctly treats a foreign
`ft:stage/wont_fix` as inert: lifecycle `accepted`, `available=true`, and
removing it is not gated as a lifecycle transition, because under that
configuration it never was one. That is coherent in both directions.

**Exposure map.** I grepped every hardcoded `"ft:"` / `"stage/"` literal in
non-test code. Outside the mapper's own defaulting (`labels.go:127`, `:264`,
`terminal_label_stages.go:66`, `config.go:81`) and the label *writer*
(`labels.go:136`, `:146`, `:266`, which correctly use the configured prefix),
there is exactly **one** offender: `treewalk.go:156-157`
(`hasExternalUnavailableLabel`), which is the known, out-of-scope, round-6 item.
**Nothing else in the authorization path shares the defect.** The paths that
honour the prefix are `authorizationStage`, `stripForMatch`,
`TerminalLabelStage`, `AllTerminalLabelStages`, `MapLabelsToStage`,
`StageToLabel` and `StageLabelSwap`. The one that does not is
`hasExternalUnavailableLabel`. Add A-2 as a config-hardening item on the same
theme.

---

## Positive observations

- **The positive-control discipline is now structural, not aspirational.**
  `TestLabelWriteScope_HarnessCanExpressTheStateChange` fails closed and is
  correctly framed as the precondition for every denial in its file. My
  independent controls agreed with it.
- **`AllTerminalLabelStages` is built to not inherit two known defects** — it
  takes membership from `store.IsTerminalStage` rather than from
  `terminalStagePrecedence`, and orders by stage name. Both choices are
  documented with the reason. That is the difference between a fix and a patch,
  and it is why charge 3's answer came out clean.
- **Sharing `matchPrefix` between the requirement and the lookup** is the right
  structural call: it makes the drift that would reopen B6 unrepresentable
  rather than merely tested. Verified as a behaviour-preserving refactor.
- **`applyLabelDelta` over-predicts deliberately and says so**, with the
  fail-closed direction reasoned out in the comment. The case-insensitivity
  choice is correct for GitHub's actual identity semantics.
- **`taskStateReason` recovering `state_reason` from `RemoteData`** is a subtle
  and correct catch — without it, stripping labels off a closed `not_planned`
  issue reads as `wont_fix → completed`.
- **The round-5 log discloses more than it had to**, including the F7 negative
  result that contradicts a prior audit claim, and the `CreateTask` residual that
  became my highest finding. Costly disclosure is the trust signal, and it was
  paid here.

---

## Methodology, disclosures and limitations

**Artifacts.** Probes are committed in my clone as
`internal/platform/github/audit_r5_prefix_probe_test.go` and
`internal/server/audit_r5_probe_test.go`. Logs in
`/scion-volumes/scratchpad/projects/farmtable/salvage/r5-audit-194/`. No
production file was modified — verified by `sha256sum -c` against a pre-work
manifest of all five changed files, all `OK`, and by `git status --short` showing
only my two new untracked test files.

**Environment discrepancy (one line, per the EM).** The leg brief named my clone
`/workspace/farmtable-audit-194b`, which does not exist in my container; the EM
confirmed the briefs carry host paths and `/workspace` is the mount. I verified
the SHA rather than the path before starting.

**Harness provenance — the significant dependency.** My server-level probe
**reuses** the fixture helpers from `authz_label_write_scope_test.go`
(`labelWriteFixture`, `openIssue`, `scopedCtx`, `agentScopes`, `stageLabel`,
`requireDeniedFor`). I judged that rebuilding a second mock GitHub would measure
my mock rather than the code. **This is a real independence limit: if those
helpers are wrong, my charge-1, -4, -5 and -6 results are wrong with them.** What
I did *not* inherit is the expectation set — every cell states its own predicted
outcome, defines its own terminal-stage list (`auditTerminals`) and its own
terminal-label test (`labelSetNamesATerminal`) rather than importing the mapper's,
and every negative is paired with a control. My unit-level prefix probe shares
nothing at all. Per the shared brief I did not read the other legs' files, and I
copied nothing from a prior round, so there is no prior-round harness sha256 to
record.

**What my harness could NOT express.**

- **The single-issue mock conflates create with update.** Its `createIssue` arm
  applies requested labels to the one issue it serves. My charge-5 terminal
  reading was therefore observed on the *pre-existing* task, not a new one. I
  reasoned to the production consequence from `createIssue` semantics instead,
  and A-1's severity is written around that limit rather than over it.
- **The custom-prefix `CreateTask` cell measures nothing.** The mock registers
  node IDs only for `ft:`-prefixed stage labels plus the fixture's initial
  labels, so `acme:stage/completed` is silently dropped by `labelNamesToIDs` and
  never reaches the issue. The subtest is renamed
  `..._FIXTURE_CANNOT_EXPRESS_THIS` so it cannot be misread as a clean result.
  **B6 at creation time under a custom prefix is unmeasured by me.**
- **Cardinality 3 was not exercised end to end** — I covered 0, 1, 2 and 4.
- **Label writes made on GitHub directly** are outside this control by design,
  and outside my probe by construction.
- **No live GitHub.** Everything is against the mock, so real GraphQL behaviour
  (label name uniqueness under unicode normalisation, in particular) is
  unverified. A-4's safety argument is partly reasoned from GitHub's documented
  semantics, not measured against the API.
- **Concurrency was not probed.** I did not test whether two interleaved
  `UpdateTask` calls can race the read-then-gate-then-write sequence. `make race`
  is green but is scoped to `./internal/platform/github/` only and does not
  exercise the server gate. **A TOCTOU between `LabelDeltaLifecycleStages` and
  the actual label write is not excluded by anything I did** — worth a look in a
  later round.

**Where my own first answer was wrong** (bar 7): two places, both left visible.
The NBSP row in A-4, where I predicted deny and measured allow. And
`InsertTasksAfter`, which I filed as a second unguarded verb from a static read
and then withdrew after measuring `Unimplemented`. The probe files retain both
with the wrong prediction recorded next to the right answer.

**Out-of-scope items I confirmed but did not re-file:** the fourth sink
(`ft ready` / `MapLabelsToStage`), `hasExternalUnavailableLabel`, the fail-open
tiebreak loop, enum drift, the missing audit trail, and the 12 accepted
newly-denied cells. I verified the round-5 edits did not touch the tiebreak loop.
Only F7 (A-3) is raised, and only on **reachability**, not on severity.
