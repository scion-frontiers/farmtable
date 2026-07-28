# #194 close-label-swap — round 4: closing the multi-label bypass

Fixes the Critical the audit and test legs converged on in round 3: a second,
non-terminal stage label on the same issue defeated every consumer of
`TerminalLabelStage`. Round 3 is **kept**, not reverted — it closed the
single-label half, and this round narrows what remained.

## Root cause

`TerminalLabelStage` delegated to `MapLabelsToStage`, which returns the single
highest-precedence stage under `stagePrecedence`. That ordering ranks every
non-terminal above every terminal, so `[ft:stage/wont_fix, ft:stage/accepted]`
resolved to `accepted` and the seam reported "not terminal".

The deeper defect is a category error. `MapLabelsToStage`'s single-winner
contract is a **display** contract — one badge per issue. Deriving a privilege
decision from it inherits the display bias wholesale. A privilege question over
a set is *"is any terminal label present?"*, not *"is the winner terminal?"*.

## The fix (B1)

`TerminalLabelStage` now scans the whole label set for any terminal stage,
independent of `stagePrecedence`.

**Deliberate deviation from the audit's candidate fix.** The audit proposed
iterating `stagePrecedence` filtered to terminal stages. I did not ratify that.
Filtering leaves the privilege answer coupled to the display rule: reorder the
display tail and a privilege answer changes silently. Instead there is a
separately declared `terminalStagePrecedence`, and the B5 guard test
deliberately does *not* constrain the order *among* terminals — so the coupling
cannot be reintroduced by accident.

### Is precedence the right tiebreak for a privilege decision?

Asked because the brief said the specific stage only matters "for the error
message and for `ComputeAvailability`'s `Reasons`". **That is incomplete.** The
returned stage feeds `TransitionScope` as `from`, and the `from == to`
short-circuit returns `task:write`. The tiebreak is security-relevant.

Under *any* fixed total order, an attacker holding `task:write` can add the
terminal label matching their destination and win the short-circuit. This
residual is **not closable inside `TerminalLabelStage`** — it belongs to the
`from == to` rule. It is **unchanged from round 3** (precedence already returned
`completed` for `[cancelled, completed]`), so it is a disclosure, not a
regression. I chose determinism as the goal the tiebreak *can* achieve: map
iteration order is randomised, so "any of them" would make one unchanged issue
produce different authorization answers run to run.

### The `!m.enabled` guard

Confirmed by execution rather than inherited from audit F6. With `enabled=false`:
`TerminalLabelStage` → `("", false)`, `MapLabelsToStage` → `("", false)`,
`IssueToPhaseStage` → `(open, accepted)`. Producer and consumer are gated by the
same flag, so declining is correct. The guard is now **load-bearing in a new
way**: the scan reads `m.labelToStage`, which `NewLabelMapper` populates
regardless of `Enabled`. Pinned with an enabled control.

## Three sinks, all closed by the one change

All three route through `store.LifecycleStage`, so B1 closes them with no
additional production change:

| Sink | Location | Cells | Bypassed under round-3 impl |
|---|---|---|---|
| Authorization (`UpdateTask`) | `server.go:552` | 140 | 104 |
| Availability (advisory) | `passthrough.go:818` | 28 | 28 |
| Claim gate (enforcement) | `passthrough.go:671` | 28 | 4 |

**The claim gate's exposure is narrower than the others, and this is worth
recording.** `issueUnavailableForClaim`'s first arm is
`lifecycleStage != task.StageAccepted` — a positive whitelist, not an
`IsTerminalStage` check. Only the `ft:stage/accepted` mask unlocks it; every
other mask resolves to a non-accepted stage and is refused for an unrelated
reason. That is a property of the arm's current shape, not a guarantee. The 24
currently-passing cells are retained to catch a future rewrite to
`IsTerminalStage`, and the test says so.

A successful bypassing claim **erased its own evidence**: it stamped
`ft:stage/working` over the terminal label. The test therefore snapshots the
label set before the call and asserts a refused claim has no side effects at
all, rather than only checking the error.

## Testing

New `internal/platform/github/terminal_label_stage_test.go` (unit) and a
rewritten `internal/server/authz_terminal_reopen_test.go` (integration).

**Input-domain variation, not just mutation.** The round-3 diagnosis was that
mutation testing proves tests are bound to the code, while only varying the
shape of the input proves they are bound to reality; for a predicate over a
collection the axis is **cardinality**. Covered explicitly: zero, one, two,
and conflicting — including the four-terminal collision
`[duplicate wont_fix completed cancelled]`, and both label orders to pin that
the answer is set-derived rather than slice-order-derived.

**Fixture schema changed before any count was pinned** (B2 before B4). The old
fixture took a single `string`; it now takes a variadic label **set**. Pinning
a count over the single-label schema would have been a rigorous-looking
assertion over rows structurally incapable of expressing the live bypass. Every
count pin states what its rows can and cannot express.

Labels are derived from the production mapper via `StageToLabel`, not
hard-coded, so a config rename cannot desync the fixture from production.

## Corrections to earlier claims

- **`passthrough.go`:** the comment claiming availability is "the one answer
  every client inherits", naming `ft ready`, MCP `task_ready` and the web
  dashboard, was false. Only the web dashboard inherits it; `ft ready` filters
  server-side via `GetReadyTasks` and MCP `task_ready` calls that same RPC and
  drops the field.
- **Round-3 log** (`close-label-swap-authz-and-scheduling.md`) carried the same
  false claim and is corrected in place.
- **The brief's characterisation of the `triage` mask was wrong.** Both review
  legs recorded the 4 `triage` rows as non-bypassing. My matrix shows the
  `triage` mask **does** bypass when the destination is also `triage`, via the
  `from == to` short-circuit — 4 such cells. The audit's PoC used
  `dest=accepted` only and structurally could not see it.
- **0 unmasked cells bypass** under the round-3 implementation, independently
  corroborating "incomplete fix, not a regression".

## Observation: the returned proto is stale

`UpdateTask` builds its response proto from the issue as it was *before* the
label swap runs, so the returned stage can disagree with the issue's final
label state. This cost me two rounds of false test failures. Tests assert label
effects rather than the returned stage where the two diverge. Not fixed here —
it is a response-construction ordering question, out of scope for this round.

## Deferred / tickets

- **Bare `duplicate` label.** Ptone ruled: do not gate on any label, prefixed or
  not; the mapper should key off closed state + `state_reason`. Current
  behaviour is pinned by a characterisation test with a `bug` negative control,
  marked documented-not-endorsed. Own issue.
- **#203** display/authoritative stage split — the general form of this defect
  class. Noted only.
- **#202** ephemeral pool / making the other two consumers inherit availability.
- **`passthrough.go:424-431`** remove-then-add error swallowing. **Ticket, not
  fixed:** the naive fix creates a mirror risk where a failed *add* after a
  successful *remove* strips the terminal label entirely — worse than the
  current behaviour. Needs a designed ordering, not a returned error.
- **Audit F5**, **audit F7** (`go vet` copies-lock ×4 — verified identical at
  pristine `651da26`, none in files this round touched), and the disclosed
  `labelNameToID` RLock mutant (accepted).
- **`add_labels`/`remove_labels` transition-scope control** (audit R1.1) — the
  self-service vector's other end. Sequenced as its own round by the EM; not
  started here.

## Gate

`go build ./...` rc=0 · `go test ./...` rc=0, 0 failures · `make race` rc=0, 0
data races · `go vet` rc=1 with exactly the 4 pre-existing deferred F7 findings.
Audit PoC re-run on the fixed tree: 3/3 pass, 19 subtests, **0 BYPASS lines**
(13 at pristine `651da26`). Scratch and PoC files deleted; tree contains only
the intended changes.
