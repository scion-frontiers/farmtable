# #194 round 6 — test review leg (r6)

**Tree:** `label-write-scope-r6` @ `6ced24e53234da12def832c46df1c2be906fc038`
**Verdict:** REQUEST CHANGES (scoped — no production-code change required)
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r6.md`

One of three independent review legs. This entry records the durable findings and
the method, so a later round can disagree with the judgement without re-running
the measurements.

## Build remedy (established independently, not assumed)

`go build ./...` fails on a fresh clone: `assets.go:5:12: pattern all:web/dist: no
matching files found`. `assets.go` embeds `all:web/dist`; `web/dist` is gitignored
(`.gitignore:17`, `dist/`). Remedy used: a **real** `make web` (npm ci + vite
build, 4109 files), deliberately not a stubbed `web/dist` — a stub makes the build
pass but turns "the branch builds" into a claim about a fabricated directory.
After `make web`, `go build ./...` exits 0.

`go vet ./...` exits 1 with exactly 4 pre-existing findings, all
`assignment copies lock value to ephReq` in `internal/server/server.go`. **Verify
them by REQUEST TYPE, never by line number** — the lines moved this round and a
by-line check reports four false new findings. `internal/platform/github/` has zero.

Counts: 625 top-level / 1825 result lines, all PASS, **0 panics, 0 skips, 0 setup
failures**. The 625 was predicted before measurement from a static grep
(675 `func Test` − 50 in the three `//go:build integration` files) and hit exactly.
Leg A in isolation: 147 top-level / 526 result lines.

## Gates are covered — three mutations, all caught

Content-addressed anchors with uniqueness assertions; non-compiling mutants
treated as void runs; restoration verified by sha256 against an out-of-repo
pristine copy.

- **M1** CreateTask label gate disabled → CAUGHT (`TestCreateTask_TerminalStageLabel…` + 4 subtests)
- **M2** `store.LifecycleStages` fail-closed reverted to fail-open → CAUGHT
- **M3** `store.LabelDeltaLifecycleStages` fail-closed reverted to `(current, current)` → CAUGHT

`brokenStageSetStore` (`internal/store/lifecycle_stage_set_test.go:45-63`) is why
M2/M3 are catchable: it genuinely constructs the contract-violating input. It is
the best test engineering added this round and is the pattern the weaker files
below should follow.

## The seam: only ONE of the two tripwires is load-bearing

- `TestUpdateTask_TwoLabelsOneStageCollapseIsUngatedToday` (server) is **sound**.
  Removing only the `SameStageSet` short-circuit leaves it green — confirming its
  own docstring. Removing **both** halves (that short-circuit plus `from == to` at
  `transitions.go:124`) fires it correctly with its "SEAM CLOSED" message.
- `TestSpellingCollision_IsInvisibleToTheStageSetGate` (github) **does not fire on
  a gate-level closure**, despite a docstring promising it goes red "when r7 lands
  a label-level delta". It computes both endpoints from `AllTerminalLabelStages`
  itself. It only reddens for an in-function change to that function — which is not
  the fix shape the other seam test describes (a contract change spanning
  `internal/server` and `internal/platform/github`).

**Round 7: do not rely on "two tests pin the seam." One does.**

Seam severity is otherwise unchanged: it permits destruction of a *redundant*
spelling, never acquisition of a terminal stage. Any set-changing edit is still
charged. **Not an escalation.** Two respects worse in degree:

- **8 authorized spellings per stage, not 4.** `stripForMatch` applies three
  *sequential* `TrimPrefix` calls in fixed order (`stage/`, `priority/`,
  `priority:`), so every order-preserving subset normalises to the bare stage name:
  2³ = 8. Verified by brute force across every stage.
- `ft:priority:completed` authorizes as terminal `completed`, so the label left
  behind holding the stage in place can read to a human as a priority annotation.

## Tests that cannot fail

- **`TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader`
  (`stage_label_swap_scope_test.go:157`) is a tautology.** It derives its expected
  value from `authorizationStage`; `StageLabelSwap`'s ownership predicate *is*
  `authorizationStage` (`labels.go:387`). Proven by mutation: breaking
  `authorizationStage` outright reddens **27 top-level tests** in the package while
  this test stays **green**. The production comment at `labels.go:369-371` credits
  it with failing "if the two ever diverge again" — it cannot.
- **`TestLifecycleStageSetStager_EmptySideIsDetectable` is a positive control that
  controls nothing.** Two of three assertions are Go language guarantees
  (`len(nil) != 0`, `0 != 0`); it exercises no code from either package. The 96-cell
  sweep it claims to license therefore has no demonstration that its predicate can
  recognise its target — and the production paths return length-≥1 slice literals on
  every branch, so the target is unreachable by construction.
- **The `winnersSeen` block** (`lifecycle_stage_consumers_test.go`) names "the
  precedence order changed" in its failure message but stays green when
  `terminalStagePrecedence` is reversed. Mis-attributed assertion rather than a
  coverage hole: the reversal *is* caught by `TestTerminalLabelStage_Cardinality`
  and by 3 packages tree-wide.
- **`SameStageSet(before, after)`** at `lifecycle_stage_set_test.go:191` and `:288`
  compares the same slice header (`store.go:186-188`, `multistore.go:287-288` both
  return `current, current`). Cannot be false.

## Salvaged r5 probes: keeps sound, one drop reason expired

All four keeps are worth keeping. `Charge1_RemovalDirection`'s
`denied+ungated != 12` coverage abort and `Charge4_REV9PremiseAdversarially`'s
validate-the-counter-before-trusting-it pattern are the standards to copy.

**Drop #6 (`Charge6_CustomPrefixEndToEnd`) was deferred to "the combined tree."
This IS the combined tree** — `6ced24e` merges leg A (`5db3937`) and leg B
(`089fac7`). The stated blocker has expired and the test is still absent. Schedule
it rather than letting the deferral age into a permanent gap.

Related correction to the round-6 framing: a custom-prefix **end-to-end** control
*is* landed — `TestTerminalStageInput_RequiresTheConfiguredPrefix`
(`authz_label_write_scope_test.go:2111`), 7 cells, two at `acme:`, driving the real
`svc.UpdateTask`. Verified non-decorative: hardcoding `matchPrefix()` to the
default reddens both `acme:` cells. The real gap is narrower than "no custom-prefix
control": it is the **12-cell label-write (add/remove) matrix** at a non-default
prefix.

## The WatchTasks flake — characterized, NOT silenced

Reproduced at the reported signature (`--- FAIL (5.01s)`, "timed out waiting for
event"). Rate **3 / 5000 ≈ 0.06%** unloaded.

Mechanism: `eventBus.Subscribe` is at **`watch.go:60`**, inside the handler, behind
auth, validation and a `GetCollection` DB read. `client.WatchTasks(...)` returns
before the handler gets there. A `CreateTask` publishing inside that window is
dropped — nothing buffers, nothing replays. The event is **lost, not late**: the
failure consumes the entire 5s `recvEvent` timeout.

Discriminator at equal N=5000: no settle → 3 failures; 20ms settle → 0. Under the
null that is p ≈ 0.05 — **evidence, not proof**, and recorded as such.

**Undocumented API precondition, for which this flake is currently the only
detector:** *a `WatchTasks` call returning does not mean the subscription is
active; events published between return and `watch.go:60` are lost with no gap
indication.*

Do not add a sleep, extend the timeout, or `t.Skip` it. Either document the
precondition (noting `include_initial` closes the gap for clients, since
`Subscribe` at :60 precedes the snapshot at :65) or add a readiness signal. If the
test is "fixed" with a bare sleep, the precondition loses its only detector.

## Method disclosures

Two void runs of my own, both discarded and both reported: (1) a settle comparison
at N=300 where the control never fired, making the clean settle arm meaningless —
my prediction that N=300 would reproduce was simply wrong at a 0.06% rate; (2) a
CPU-load run (32 busy loops on 16 cores) that starved the test process into a
timeout.

Not covered by this leg: **the race detector was not run at all** — every
concurrency statement this round rests on the EM's measurement, not mine. Also
uncovered: anything under `-tags integration` (50 tests, no Postgres), and whether
the four vet findings are pre-existing at `ea8ac390` (verified present at HEAD and
matched by request type, but the base was not checked out).

Tree returned untouched: `git status` empty, all mutated files sha256-identical to
the pristine copy, `go test ./...` EXIT 0.
