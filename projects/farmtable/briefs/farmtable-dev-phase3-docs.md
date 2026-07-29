# dev-phase3-docs — documentation polish (contract Phase 4)

## Context

Final phase of the task-state-model workstream. Contract §13 calls this
**Phase 4**; we call it Phase 3 internally (there is a known off-by-one — the
contract's Phase 1 was contract review, which we did not run as a dev phase).
Contract lives at
`/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`.

The core model, API, CLI and MCP shipped earlier and are **live in production**.
The web UI phase is merged. This phase is documentation only. **You should not
need to change behaviour.** If you think you do, stop and report — see
"If you find a behaviour bug" below.

Your workspace and base commit will be confirmed at dispatch.

---

## The single most important instruction: this is NOT a find-and-replace

The contract retires `backlog`, `ready`, `blocked`, `scheduled`,
`waiting_for_input`-as-stage and `deferred`-as-stage. It is tempting to grep
those words and purge them. **That would break correct documentation.** The
contract's own test, from §12, is precise:

> A value removed from the native model must not survive as a
> **selectable native value**.

So the line is *selectable native value*, not *the English word*. Concretely:

**MUST be purged** — anywhere these read as a stage a user can pick or a stage
the system has:
- a stage named `ready` / `blocked` / `backlog` / `scheduled`
- "open phases" as the native work-queue concept
- `--phase` presented as the primary native filter

**MUST be kept** — these are correct and load-bearing:
- `blocked_by` — a real relationship type in the contract
- `BLOCKED_BY_DEPENDENCY` — a real availability reason
- prose like "tasks whose dependencies are unresolved are blocked" — that is
  plain English describing a real condition, and rewording it to avoid the word
  makes the docs worse
- `ON_HOLD` described as **compatibility-only projection for external
  statuses** — contract-sanctioned; `.agents/skills/farmtable/SKILL.md:32` and
  `docs/architecture.md:76` already say this correctly. Leave them.
- `task_ready` and `GetReadyTasks` — **do NOT rename these.** See below.

If you are unsure whether a specific occurrence is a retired value or ordinary
English, leave it and list it in your report. I will rule. Do not guess, and do
not "tidy" borderline cases in bulk.

---

## `task_ready` / `GetReadyTasks` stay — but their descriptions are wrong

Contract §9 (line 611) is explicit:

> `task_ready` should become availability/work-queue semantics, not
> `stage=ready`.

and (line 616):

> MCP tool descriptions must stop saying "ready stage" or "open phases" for
> native work queues.

So the **names are retained** — renaming an MCP tool or a gRPC RPC is a breaking
change for external agent consumers and is out of scope. What must change is
what the docs and tool descriptions *say* about them.

### A concrete defect I have already confirmed for you

`internal/mcp/server.go:158`:

```go
mcp.WithDescription("Get tasks ready to work on: open tasks whose blocking dependencies are all resolved."),
```

This is wrong twice over:
1. **"open tasks"** is exactly the "open phases" vocabulary §9 bans.
2. It describes the gate as *dependency resolution only*. **I verified the
   actual behaviour and it is broader**: `EntStore.GetReadyTasks`
   (`internal/store/entstore.go:2502`) filters
   `task.StageEQ(task.StageAccepted)` **and** `task.HoldReasonIsNil()`, then
   calls `ComputeAvailability` per task. So held, future-start,
   assigned-elsewhere, triage and terminal work are all excluded too — none of
   which the description mentions.

**The behaviour is correct and contract-compliant. Only the description lies.**
That matters more than a typo: MCP descriptions are how agents learn what a tool
does, so an inaccurate one actively misleads every agent consumer.

Also check the sibling `include_unblocked` description on line 161 ("Include
unblocked open tasks…"), and `handleTaskReady`'s output vocabulary.

Contract §12's survival checklist names **"MCP schemas, descriptions, and tool
outputs"** explicitly, so this is an unfinished checklist item, not new scope.

---

## Surfaces to cover

Work outward from agent-facing to human-facing:

1. **`.agents/skills/farmtable/`** — highest value, this is what agents read.
   `SKILL.md`, `resources/workflow.md`, `resources/task-fields.md`, and
   `commands/*.md` (including `commands/ready.md` — keep the filename, it is a
   command name; fix the content). Known prose hits at `SKILL.md:5,54`,
   `commands/ready.md:2,18`, `resources/task-fields.md:48`,
   `commands/tree.md:10,13` — **most of these are legitimate English**; apply
   the test above rather than editing all seven.
2. **MCP tool descriptions** — `internal/mcp/server.go`, per above.
3. **`docs/architecture.md`** — 7 hits, incl. `:406` documenting `task_ready` /
   `GetReadyTasks` as "Available accepted tasks ready to work on", `:315`/`:350`
   on blocked/`blocked_by` (likely legitimate), `:76` `ON_HOLD` (legitimate).
4. **`README.md`, `CLAUDE.md`, `agents.md`** — small counts; `CLAUDE.md:8,13`
   and `agents.md:8,13` mention "ready work" and `task_ready`.
5. **CLI help/completions** — verify no retired stage is still *selectable* or
   suggested. This is the "selectable native value" test at its sharpest.

### Do NOT rewrite `.design/` historical records

`.design/*.md` (wave specs, discussion logs, retros, review findings) are a
**record of past thinking**. Editing them to match current vocabulary falsifies
the historical record. Leave them alone. The only `.design/` writing you do is
the new project-log entry. If you believe a specific `.design/` doc is a *live*
reference rather than history, say so in your report and leave it.

---

## Also required by the contract

- **Document the rank storage choice.** §15 deliberately leaves the algorithm
  open ("requires ordering semantics, not a specific storage algorithm"). We
  chose **sparse integer ranks**, `RANK_STEP = 1024`, `MIN_RANK = 1`, with
  renumber-on-exhaustion. Record the choice and the reasoning where a
  maintainer will find it (`docs/architecture.md` is the natural home).
  Ordering is: priority band → rank → `created_at` → task id, scoped to
  (collection, priority band) per §4.6, and **must not depend on dense ranks**.
- **Document LOW-4 as a known limitation** — overlapping/concurrent reorders.
  §14 permits "explicit tests **or documented limitations**"; we are taking the
  documented-limitation route for the residual window, so the documentation is
  what discharges the obligation. Be honest and specific about the failure mode.
- **Migration notes and adapter fidelity notes** per §11/§12 — including that
  `cancelled` and `wont_fix` **do not** automatically unblock dependents (§11).
  That is deliberate, it strands dependents permanently, and the attention view
  is the remedy. Users must be told, because it is surprising.

---

## The attention view — added to this brief 2026-07-27, after the feature shipped

This brief was written before the attention view existed, so it mentioned it
only in passing as "the remedy". It is now built (contract §10, branch
`attention-view`, merged into `task-state-web-ui-v2`) and it is **completely
undocumented**. I measured this rather than assuming it:

```
$ grep -rln -i "attention" docs/ README.md CLAUDE.md agents.md .agents/
docs/code-of-conduct.md                            <- unrelated
.agents/skills/farmtable/resources/task-fields.md  <- "URGENT: immediate attention", unrelated

$ grep -rn -i -e "wont_fix" -e "won't be fixed" docs/ .agents/ README.md CLAUDE.md agents.md \
    | grep -i -e "unblock" -e "strand" -e "depend"
(no output)
```

So **neither the §11 stranding behaviour nor its §10 remedy appears in any
document.** The most surprising behaviour in the model is currently something a
user can only discover by hitting it.

Document both, together — the behaviour is what makes the feature make sense:

- Closing a prerequisite as `cancelled`, `wont_fix` or `duplicate` does **not**
  unblock its dependents. They stay blocked permanently and no process clears
  them.
- The attention view is how you find them. Filter value `attention`, labelled
  **"Needs attention"**, on both the board filter and a dashboard tile.
- The canonical user-facing wording already exists in
  `web/src/util/task-state-utils.ts:291` (`ATTENTION.label`, `.explanation`).
  **Reuse that wording rather than inventing a second phrasing** — the vocabulary
  anchor exists precisely to stop the same concept being worded five ways, and
  this workstream has already found several such divergences. If you need a
  wording the constant does not provide, say so in your report.

### Document the asymmetry honestly — do NOT fix it

The remedy is **web-UI only**. I checked for any equivalent on the agent-facing
surfaces:

```
$ grep -rn -i -e "attention" -e "stranded" internal/ cmd/ | grep -v _test.go
(no output)

$ grep -rn "availability\|AvailabilityReason\|BLOCKED_BY_DEPENDENCY" internal/mcp/ | grep -v _test.go
(no output)
```

Caveat on my own evidence, because I got bitten by exactly this today: these
greps prove **no surface exists under those names**, not that discovery is
impossible. MCP does expose relationships through `task_get`, so an agent could
in principle derive stranding by walking every task and inspecting each
blocker's stage — but that is per-task traversal, not a query, and availability
reasons are not exposed at all. If you find a practical MCP or CLI path I
missed, **tell me — that would be good news and I would rather be wrong.**

So an agent consumer — which is this system's primary consumer — currently
cannot practically find stranded work, while a human with the dashboard can.
**Write that limitation down plainly.** Do not build an MCP or CLI surface for
it: that is behaviour, not documentation, and it needs its own PR and its own
review round. Flag it in your report and I will decide whether it becomes a
follow-up feature.

---

## Acceptance criteria

- No retired stage survives as a **selectable native value** anywhere: CLI enum
  parsing, help, completions, MCP schemas/descriptions/outputs, docs.
- `task_ready` and `GetReadyTasks` still exist under those names, and every
  description of them reflects **availability semantics**, not `stage=ready`
  and not "open".
- The MCP description defect above is fixed and accurate to the real gate.
- `blocked_by`, `BLOCKED_BY_DEPENDENCY`, and compatibility-only `ON_HOLD` are
  **intact**. A diff that removes them is wrong.
- `.design/` historical documents unmodified (except the new project-log entry).
- Rank choice, LOW-4 limitation, and the cancelled/wont_fix stranding behaviour
  are all documented.
- **The attention view is documented**, together with the stranding behaviour it
  exists to remedy, reusing `ATTENTION.label` / `.explanation` wording rather
  than a new phrasing — and its **web-UI-only** limitation is stated plainly for
  agent consumers.
- **Provide the grep commands you used as verification evidence**, with output,
  and state honestly what they do and do not prove. A grep for `\bready\b` will
  return legitimate hits — do not present a zero-hit grep you achieved by
  damaging correct text.
- Full gate green, run and pasted: `go build ./...`, `go test ./...`, `gofmt`
  clean, and if you touch `web/`: `npm test`, `npx tsc --noEmit`,
  `npm run build`.

Note: do not read build success from a pipeline's exit code —
`go build ./... | tail -3; echo $?` reports `tail`'s status. Redirect to a file,
then check `$?`.

## If you find a behaviour bug

This phase is docs-only, but reading docs against code is exactly how behaviour
bugs surface — that is how we found the MCP description defect. If you find one:
**report it, do not fix it.** It needs its own PR and its own review round.
Precedent: #194 was found this way and shipped separately.

## Deliverables — all required

1. Commits on your branch.
2. A project log entry at `.design/project-log/task-state-phase3-docs.md` with a
   "Not done, and why" section.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-phase3-docs.md`
   covering: what you changed and why, every borderline occurrence you left
   alone and your reasoning, your grep evidence, and anything found but not
   fixed.

**Do not push.** Commit locally; the manager pushes.

This gets the same three-way independent review as every other phase.

You MUST commit your work, write the project log entry, write the report file at
the exact path above, and then mark the task complete.
