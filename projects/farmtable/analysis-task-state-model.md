# Task State Model — Investigation & Shared Understanding

**Status:** Investigation. No design proposed yet — this document exists to establish a
common diagnosis before any design is drafted.
**Author:** architect agent
**Date:** 2026-07-25
**Repo state:** `/workspace/farmtable` @ `2a21cd9`

---

## 0. What was asked

> Our data models have confusing and overlapping terminology around the current state of a
> task. We have a field for open/closed as well as a state on the board — "completed" and
> "closed" seem not identical but somewhat overlapping. We also have a board column named
> "Ready" as well as a ready list of unblocked items that may or may not be in the Ready
> column. Strike a balance between flexibility of usage and sophistication of the data model
> without being overly confusing to users.

Both observations are correct, and they turn out to be two instances of the *same* underlying
problem. Section 6 states it. Sections 1–5 are the evidence.

---

## 1. The state model as actually implemented

Three declared tiers (`proto/farmtable.proto:36-71`, design rationale in
`.design/discussion-log.md:120-147`):

| Tier | Field | Values | Declared purpose |
|---|---|---|---|
| 1 | `phase` | 4 | Universal lifecycle. "Agents branch on this." |
| 2 | `stage` | 15 | Fine-grained position. "Humans and dashboards use this." |
| 3 | `native_label` | free text | Verbatim platform status, round-trip fidelity |

Plus a fourth, undeclared tier that is not a field at all:

| Tier | Concept | Where it lives |
|---|---|---|
| 0 | **Derived state** — readiness, blockedness | Computed from `Relationship` edges + other tasks' `phase`, in **five independent implementations** |

Tier 0 is the source of most of the confusion, because two of its concepts (`ready`,
`blocked`) *share names with Tier 2 stage values that mean something different*.

### 1.1 `phase` is a pure projection of `stage` — except when it isn't

`phaseForStage` (`internal/server/convert.go:68-81`) is total and deterministic. The server
derives phase on both create (`server.go:115`) and update (`server.go:501-509`). Phase is not
settable through the gRPC write path. On that path it carries **zero information not already
in `stage`**.

But the invariant is convention, not enforcement:

- The store accepts an independent phase (`entstore.go:579`, `entstore.go:142`).
- The beads adapter writes `("blocked" → PhaseOpen, StageBlocked)`
  (`internal/platform/beads/beads.go:308`), which **contradicts** `phaseForStage`
  (`blocked` → `ON_HOLD`). Beads-imported blocked tasks are therefore `phase=OPEN,
  stage=blocked`.
- The import path sets phase verbatim from the payload (`entstore.go:1664`).

So `phase` is redundant on one path and divergent on others — the worst of both.

Meanwhile `phase` is the **only** task-state filter exposed in the web toolbar
(`web/src/components/ft-toolbar.ts:34-39`) and the primary CLI filter
(`internal/cli/task.go:305`). Users filter on a derived field, using a coarser vocabulary than
the one they write with.

---

## 2. "Open" and "closed" mean three different things

| Sense | Definition | Where used | Named in the model? |
|---|---|---|---|
| **A** | `phase == OPEN` — one of four phases. Excludes `IN_PROGRESS` and `ON_HOLD`. | `--phase OPEN`, toolbar "Open", `GetReadyTasks` outer predicate (`entstore.go:2028`) | Yes |
| **B** | "not closed" — `phase != CLOSED`. What agents and humans colloquially mean by "open work". | `GetBlockedTasks` (`entstore.go:2121`), skill docs' "active work" | **No** — no name, no filter, no enum value |
| **C** | Homonyms on other axes | PR `status: open/merged/closed` (`internal/cli/enums.go:104-116`), rendered with the *identical* labels in the same inspector panel (`ft-inspector-code.ts:13-15` vs `ft-inspector-header.ts:12-15`) | n/a |

Sense B is the one people actually want and the one the system cannot express. The damage is
visible in the agent-facing docs:

- `.agents/skills/farmtable/commands/list.md:8-13` — *"default to active work when the user
  asks broadly for current tasks"* and *"`phase`: `OPEN` or `CLOSED`"*. An agent following this
  literally filters `phase=OPEN` and **excludes every task it is currently working on**
  (claiming sets `IN_PROGRESS`, `entstore.go:806`).
- `.agents/skills/farmtable/resources/task-fields.md:5-10` files eleven stages under the
  heading *"Open-stage values"*, including `working`, `in_review`, `blocked`, `deferred`.
  Only three of those are `OPEN` phase.
- `SKILL.md:30` teaches phase as binary. The enum has four values.
- MCP `task_search` advertises *"across all open phases by default"*
  (`internal/mcp/server.go:143`) — a grouping that exists nowhere in code, and the handler
  applies no phase filter at all (`mcp/server.go:560-573`), so it also searches closed tasks.

Note also: **no list surface hides closed tasks by default.** Not `ft task list`, not
`task_list`, not the web. There is no default notion of "current work" anywhere in the stack.

---

## 3. "Closed" vs "completed" — the relationship, and where it breaks

The declared relationship is clean and defensible: `CLOSED` is a phase containing four
stages; `completed` is one of them. **Closed = out of the flow. Completed = closed
successfully.** They are correctly not synonyms.

Four places break it:

1. **Terminal outcome doesn't affect dependency semantics.** A blocker closed as `wont_fix`,
   `duplicate`, or `cancelled` unblocks its dependents identically to `completed`
   (`entstore.go:2069`, `entstore.go:2150` — both test `phase == CLOSED`). Cancelling a
   prerequisite silently marks dependent work ready. This is a behavioural question, not a
   naming one.

2. **The board has one closed column, labelled with a stage name.** `BOARD_COLUMNS`
   (`web/src/components/kanban/ft-kanban-view.ts:28-37`) ends at `Completed`.
   `wont_fix`/`duplicate`/`cancelled` have **no column and are invisible on the board** — they
   are not in `BOARD_COLUMNS` and not in the On Hold group. So the board's "Completed" column
   is narrower than the `CLOSED` phase, while the toolbar's "Closed" filter is wider. Same
   concept, two widths, adjacent on screen.

3. **The board never calls `CloseTask`.** Dropping a card on Completed goes through
   `UpdateTask` (`ft-kanban-view.ts:157-161`), so `closed_at` is never set from the UI
   (`entstore.go:868-871` sets it only in `CloseTask`). The board can mint `phase=CLOSED`
   tasks with null `closed_at`. `closed_at` is decoded client-side and never rendered
   (`web/src/gen/types.ts:240`).

4. **Three UI labels for stage 12.** "Completed" (kanban, inspector, palette) and "Done"
   (`web/src/components/tree/ft-tree-node.ts:36`). There are three independent stage-label
   tables that disagree with each other: `ft-tree-node.ts:24-40`,
   `inspector-stage-utils.ts:3-19`, `ft-command-palette.ts:45-62`.

---

## 4. "Ready" is three different sets

This is the sharpest instance. Same word, three predicates, all live simultaneously:

| # | Where | Predicate | Citation |
|---|---|---|---|
| 1 | **Kanban "Ready" column** | `stage == READY` — nothing else. Blockers not consulted. | `ft-kanban-view.ts:30`, `task-store.ts:50-52` |
| 2 | **Server `GetReadyTasks` / `ft task ready` / MCP `task_ready`** | `phase == OPEN` ∧ `stage ∈ {ready}` (+`triage`,`backlog` with `--include-unblocked`) ∧ no non-closed blocker | `entstore.go:2020-2080` |
| 3 | **Web Ready count + Ready Queue + dependency Layer 0** | `phase ∈ {OPEN, IN_PROGRESS}` ∧ no non-closed blocker. **Does not require `stage == ready`.** | `web/src/utils/task-ready.ts:9-21` |

The web client never calls `GetReadyTasks` — it has no such method
(`web/src/gen/service.ts:37-53`). Set 3 is a client-side reimplementation with different
semantics, and it is a strict superset of set 2.

**Concrete divergences a user will hit:**

| Situation | Ready column (1) | `ft task ready` (2) | Dashboard Ready count (3) |
|---|---|---|---|
| `stage=ready`, one open blocker | shown | excluded | excluded |
| `stage=backlog`, unblocked | not shown | excluded (unless `--include-unblocked`) | **counted** |
| `stage=working`, unblocked | not shown | excluded | **counted** |
| blocker outside the loaded page | — | correct | **counted as ready** |

Three further amplifiers on the web side:

- The dashboard's Ready stat card ignores the active toolbar filters
  (`ft-app.ts:419-425` passes only `.store`), but clicking it navigates to a Ready Queue that
  *does* apply them (`ft-ready-queue-view.ts:222-223`). The number changes on click.
- The client loads one page of 200 tasks with no pagination loop
  (`web/src/gen/grpc-client.ts:210-218`), and a blocker missing from the store is treated as
  resolved (`task-ready.ts:16`, `blocker && …`). Ready count inflates silently on large or
  cross-collection graphs.
- There are four hand-copied versions of the readiness predicate
  (`task-ready.ts:9`, `ft-dashboard-view.ts:156`, `ft-app.ts:594-605`,
  `ft-dependency-view.ts:650`) plus a fifth, entirely different one for GitHub passthrough
  based on sub-issue state (`internal/platform/github/treewalk.go:73-110`).

Note also that dropping a card into the Ready column performs **no blocker validation**
(`ft-kanban-view.ts:146-174`). You can drag a task with an open blocker into Ready and it
will sit there.

---

## 5. "Blocked" has the identical split — it just hasn't been noticed yet

| Where | Predicate | Citation |
|---|---|---|
| `stage == blocked` | An asserted label. Maps to `ON_HOLD`. Set by hand or by adapters. | `convert.go:74` |
| `GetBlockedTasks` / `ft task blocked` | `phase != CLOSED` ∧ has ≥1 `BLOCKED_BY` edge to a non-closed task. **Never consults `stage == blocked`.** | `entstore.go:2119-2160` |
| Card lock icon | has *any* `BLOCKED_BY` edge — **does not check the blocker's phase** | `ft-task-card.ts:179-183` |

Consequences: a `stage=ready` task with an open blocker appears in the Ready column, appears
in `ft task blocked`, and is absent from `ft task ready`. A `stage=blocked` task with no
blocker edges is `ON_HOLD`, off the main board row, and absent from `ft task blocked`. The
lock icon stays on after the blocker closes.

---

## 5A. Round 8 — should `blocked` be derived-only?

Asked by c-phase. Recommendation: **yes, delete `blocked` as a native asserted stage** — but
the reasoning is *not* "symmetry with `ready`", and one input differs materially.

### 5A.1 The principle: ON_HOLD stages should name *why*, not *what*

Compare the four ON_HOLD glosses (`task-fields.md:19-23`):

| Stage | Gloss | Names a… |
|---|---|---|
| `blocked` | "cannot proceed because of a blocker" | **condition** — and one the graph already computes |
| `waiting_for_input` | "needs user or stakeholder input" | reason |
| `deferred` | "intentionally postponed" | reason |
| `scheduled` | "planned for a future time" | reason |

`blocked` is the odd one out. The other three assert something the system **cannot** derive —
why a human parked the task. `blocked` asserts something the system **can** derive, and does:
`GetBlockedTasks` (`entstore.go:2119-2160`) computes blockedness purely from relationship
edges and **never consults `stage == blocked`**. Same structure as `ready` (§4, §6D.1): a
hand-maintained cache of graph state, with no recompute path, sitting next to the live
computation that ignores it.

So the rule that falls out is sharper than symmetry: **an asserted hold should name a reason
the graph cannot see.** That is a test we can apply to future stage proposals, not just a
one-off deletion.

### 5A.2 The out-of-graph objection, and why it mostly dissolves

The real risk in deleting `blocked` is the task that is genuinely stuck on something *not
modelled as a task* — a vendor, an upstream release, a flaky environment. The dependency graph
cannot see those, and that is precisely the state a human most wants to flag.

But we already have slots for it, and they are better named: `waiting_for_input` covers
external/human input, `deferred` covers a deliberate pause, `scheduled` covers a time gate.
The residue — "stuck on an external system that is not input to us" — is thin, and stretching
`deferred` or `waiting_for_input` over it costs less than keeping a word that collides with a
computed predicate.

### 5A.3 Where this differs from `ready` — and it matters

§6E.3 could delete `ready` cheaply because **nothing external mapped to it**. That is **not
true of `blocked`**:

- `internal/platform/beads/beads.go:308` — beads has a genuine native `blocked` status and
  maps it to `StageBlocked`. A real foreign concept, not Farm Table vocabulary echoed back.
- `internal/platform/github/labels.go:13`, `:39` — in both `stagePrecedence` (first, highest
  priority) and the `allStages` auto-map.
- `internal/platform/github/treewalk.go:98`, `:121`, `:145` — rollup logic *reads*
  `StageBlocked` in three places, so deletion has behavioural reach beyond the enum.

So the mapping-only compromise I **rejected** for `ready` (§6E.4) has actual justification
here, because there is a live external producer. Consistency of *outcome* between `ready` and
`blocked` would be pattern-matching; the inputs genuinely differ. My recommendation is
therefore: **native-delete `blocked`, but retain it as a mapping target** — which does require
the write-source boundary (§6E.1) that we deferred. That deferral should be revisited if this
lands.

Also note `beads.go:308` is defect #3: it writes `(PhaseOpen, StageBlocked)`, contradicting
`phaseForStage`. Any migration must handle rows that are already invariant-violating.

### 5A.4 Migration rule

Existing `stage=blocked` rows split cleanly on a checkable condition:

- **Has ≥1 non-closed `BLOCKED_BY` edge** → the derived predicate already covers it. Migrate
  the stage to `accepted`; blockedness continues to surface as derived state. No information
  lost.
- **Has no open blocker** → it was asserting an out-of-graph block. Migrate to
  `waiting_for_input`, which is the closest honest reason.

Side benefit: this is also the fix for defect #5 (the card lock icon that stays lit after the
blocker closes), because the indicator becomes derived rather than a stale asserted stage.

### 5A.5 Status

**Recommendation, not a decision** — same standing as §9.14a. Logged as open question 9.15.
The load-bearing sub-question for ptone is 5A.3: accepting this re-opens the write-source
boundary we deferred in §6E.4.

---

## 5B. Round 9 — should ON_HOLD be a `hold_reason` modifier axis?

**Unbidden.** Not asked of me; recorded because it is circulating as a live design question and
because it **potentially revises §5A.4**, which is advice I have already given. No action
requested.

Position: **yes, and the argument is stronger than ergonomics — the current encoding loses
data.**

### 5B.1 Holds are orthogonal to workflow position, but share a field with it

`stage` is a single enum (`internal/store/schema/task.go:24`). Four of its values
(`blocked`, `waiting_for_input`, `deferred`, `scheduled`) are holds; the rest are workflow
positions. Because they share one field, **asserting a hold overwrites the position.**

A task in `in_review` that starts waiting on a stakeholder becomes `stage=waiting_for_input`.
The fact that it was in review is **gone**. I checked for somewhere it might be preserved —
there is no `previous_stage`, `prior_stage`, or equivalent field anywhere in the schema or
proto. It is not stored in `remote_data` either.

So when the hold clears, the system cannot answer "where does this go back to?" A human or
agent has to guess, and the natural guess is the start of the workflow, which silently demotes
work. This is not a naming problem — it is destructive.

### 5B.2 It is the same defect as everything else in this investigation

§6's diagnosis is that Farm Table has two categorically different kinds of state sharing one
vocabulary. This is the third instance of the identical shape:

| Instance | Two things sharing one slot |
|---|---|
| §4 | asserted `stage=ready` vs. derived availability |
| §5 / §5A | asserted `stage=blocked` vs. derived graph blockedness |
| **§5B** | **workflow position vs. hold status — two orthogonal axes in one enum** |

A `hold_reason` modifier is the same fix applied a third time: separate the axes, stop making
one destroy the other. Consistency here is principled rather than pattern-matched, because the
underlying error is genuinely the same.

### 5B.3 What it would look like

- `stage` keeps only workflow positions.
- `hold_reason` is nullable, valid on non-terminal tasks: `waiting_for_input`, `deferred`,
  `scheduled` (and possibly nothing else — see below).
- `phase == ON_HOLD` becomes derived: `hold_reason != null`. Consistent with `phase` already
  being a projection (§1.1).
- Availability (§6B) gains a clean third term it already needed: not closed, no open blockers,
  **`hold_reason == null`**. Today that last term is expressed as "stage is not one of these
  four", which is exactly the brittle enumeration this removes.
- Clearing a hold restores the task to its untouched `stage`. The "where does it go back to?"
  problem disappears rather than being solved.

### 5B.4 How this revises §5A

§5A.4 proposed migrating asserted `stage=blocked` rows with no open blocker to
`waiting_for_input`. Under a modifier axis that becomes `hold_reason=waiting_for_input` with
`stage` set to the workflow position — except the pre-hold position was already destroyed for
existing rows, so it is unrecoverable for them. Migration would have to park them at the
accepted state and accept the loss. **Worth doing sooner rather than later: every day the
current encoding stands, more position data is overwritten.**

§5A's conclusion is unaffected — `blocked` should not be an asserted value on *either* axis,
because it names a condition the graph computes (§5A.1). It is not a hold reason; it is a
derived fact. The three surviving hold reasons all name something the system cannot see.

### 5B.5 Caveats

- **Cost is real.** New field, proto change, migration, and every stage-filtering surface in
  §6E.4a's inventory has to learn about a second axis. Larger than the `ready` deletion.
- **`scheduled` may not belong here.** It is time-triggered, not a manual hold, and §9.10
  (`start_date` is write-only and inert) is unresolved. It may want automatic clearing rather
  than sitting alongside two manual reasons.
- **Interaction with §6E.1.** External platforms model holds as statuses, not modifiers, so
  adapters must flatten and re-expand across the two axes.

Logged as open question 9.16.

---

## 6. The diagnosis

**Farm Table has two categorically different kinds of task state and one vocabulary for
both.**

- **Asserted state** — a human or agent *chose* it. Durable, editable, one value at a time,
  belongs on a board. This is `stage`.
- **Derived state** — a *function* of the dependency graph and of other tasks' state.
  Recomputed on read, never editable, can be true of many tasks in many stages
  simultaneously. This is readiness and blockedness.

The words **`ready`** and **`blocked`** exist in *both* categories, with different meanings,
and neither surface signals which one it is showing. `open`/`closed` straddle a third
distinction: `phase` (asserted-derived, 4 values) versus the colloquial "not closed" (2
values, unnamed).

Everything in §2–§5 falls out of that one collision. Two secondary factors compound it:

- **No single source of truth for the derived predicates.** Five implementations, at least
  three distinct semantics. Every new surface adds a sixth.
- **`phase` is exposed as the primary user-facing filter but is not a user-facing concept.**
  It is a normalization artifact for cross-platform mapping (its original justification —
  Jira/Linear status categories — is in `.design/discussion-log.md:135-147` and is still
  sound). Surfacing it as *the* filter is what makes "Open" hide your own in-progress work.

Worth saying explicitly: **the three-tier model is not the problem.** `phase`/`stage`/
`native_label` was the right call for cross-platform normalization and should survive. The
problem is that Tier 0 was never named, and that Tier 1 leaked into the UI as a filter.

---

## 6A. Decisions taken — round 1 (2026-07-25, ptone)

| # | Question | Decision | Consequence |
|---|---|---|---|
| Q1 | Is `ready` an assertion or a computation? | **Assertion.** `stage=ready` keeps the word. The derived set is renamed — candidates offered: "available", "unblocked". Agent retraining on `ft task ready` is explicitly **not** a constraint. | D1 confirmed. The derived tier needs a name (§6B). |
| Q2 | Acceptable breakage? | **We are very early and can break what we need to reach the correct design.** | D2 and D4(c) are back on the table. Enum changes, RPC renames, and wire changes are all permitted. Migration still needs to be designed, but is not a veto. |
| Q3 | Is `phase` load-bearing? | **Yes for cross-platform normalization — but it need not be surfaced in native UX.** | Keep `phase` on the wire as the normalization tier. Remove it from the toolbar and demote `--phase`. This is D4(a), and it rules out D4(c). |

### Follow-on question raised

> Does the work queue become "ready AND available" as a compound requirement?

Answered in §6B. Short answer: **no — availability should be a hard filter and readiness a
ranking tier, not a conjunction.**

---

## 6B. The work queue: why not a conjunction

### Recommendation

- **Hard filter (a physical fact):** `available` — not closed, not on hold, no open blocking
  dependency. You genuinely cannot work a blocked task, so this is a legitimate gate.
- **Ranking tier (an editorial judgment):** `ready` > `backlog` > `triage`. Groomed work
  surfaces first; ungroomed available work is still visible, explicitly marked as ungroomed.

Not `ready AND available`.

### Why

**1. The conjunction is already the implemented behaviour, and it already failed.**
`GetReadyTasks` today is exactly `phase==OPEN ∧ stage==ready ∧ no open blocker`
(`entstore.go:2020-2034`). `.design/dogfooding-notes.md:69` records the result verbatim:

> "`ft task ready` returns 0 results because it filters to `stage='ready'` by default. All
> tasks are created in `triage` stage."

The `--include-unblocked` flag is scar tissue from that failure. Making the conjunction
official would institutionalize a failure mode we have already observed in production use.

**2. The failure costs are asymmetric.**

| Design | Failure mode | Character |
|---|---|---|
| `ready ∧ available` | False negatives — workable tasks hidden because nobody groomed them | **Silent.** Presents as "no work available." An idle agent fleet, and nothing in the system says why. |
| `available`, ranked by stage | False positives — an agent picks up something under-specified | **Loud and self-correcting.** The agent opens it, finds no acceptance criteria, kicks it back to triage or asks. |

For an agent-first system, silent starvation is far worse than a noisy queue. One agent asking
a question beats twenty agents idling.

**3. Hard-gating on an editorial judgment makes grooming discipline a liveness dependency.**
`available` answers *can this be worked* — a property of the graph. `ready` answers *should
this be worked / is it prepared* — a human or decomposer judgment. AND-ing them means the
entire fleet stalls whenever grooming falls behind, which is precisely when you most want
agents picking work up.

> **r3 correction (c-phase review):** calling availability a "physical fact" overstates it.
> As defined below it is a *graph* fact (no open blocking dependency) conjoined with an
> *asserted* one (not on hold). The correction sharpens the argument rather than weakening
> it — see §6C.3. The right distinction is not computed-vs-asserted but **explicit act vs.
> act of omission**.

### Refinement: there are two derived predicates, not one

> **r3 correction (c-phase review):** the dashboard-vs-queue divergence in §4 is
> *overdetermined* — it also follows from filter propagation, assignment, pagination, and
> duplicated client predicates. It is therefore **not clean evidence** for this split, and I
> have retracted it as such. The split still stands, but on the argument below, not on that
> observation.

| Predicate | Definition | Question it answers | Surface |
|---|---|---|---|
| `available` | not closed ∧ not on hold ∧ no open blocking dependency | *How much of the backlog is unobstructed?* — a graph-health metric | Dashboard count, dependency Layer 0 |
| `claimable` | `available` ∧ unassigned | *What can I pick up right now?* — a work queue | Queue view, `ft task <queue-cmd>`, MCP |

Both are legitimate. Conflating them is why today's dashboard number and Ready Queue number
disagree — they are measuring genuinely different things under one name. Naming both fixes
that without a judgment call about which is "correct".

Open sub-question: should `IN_PROGRESS ∧ unassigned` count as claimable? (A released or
abandoned task.) Today the server says no, the web says yes. Listed in §9.

### The asserted/derived disagreement becomes diagnostic

A free benefit of separating the axes: where the two disagree, that is *signal*, not noise.
Today it is invisible.

| Condition | Meaning | Today |
|---|---|---|
| `stage==ready` ∧ ¬`available` | Groomed, then a blocker appeared — or the stage was mis-set | Sits silently in the Ready column looking fine |
| `available` ∧ `stage==blocked` | Marked blocked, but the graph disagrees — blocker closed and nobody updated the label | Invisible; task stays off the board's main row indefinitely |

Both are worth surfacing as warnings once the split exists.

### Terminology: prefer `available` over `unblocked`

`unblocked` is defined negatively against "blocked" — which is **also a stage name**. It
re-imports the exact collision we are removing. `available` is positive, collides with
nothing in the enum, and reads naturally: "available work", "3 available".

Two follow-ons this creates:

- **The negation of `available` should not get a state noun at all.** It should always be
  rendered with its cause — "Waiting on 3 tasks" — because it is a fact about edges, not a
  label. `GetBlockedTasks` should be renamed accordingly.
- **What does `stage=blocked` mean once availability is derived?** It should mean "obstructed
  by something that is *not* a modelled task dependency" — vendor, infra, an external
  approval. That is a genuinely useful and distinct concept, but the name still collides.
  Given Q2, recommend renaming the stage to **`stalled`** (or `impeded`), which also forces
  the useful question of whether an external blocker should be modelled as a first-class
  thing rather than a stage.

---

## 6C. Independent review response — round 3 (c-phase, 2026-07-25)

c-phase reviewed adversarially and agreed with the core asserted-vs-derived framing. Its
disagreements were about scope and surfacing. I accept most of them. Every new code claim
below I re-verified against `2a21cd9` before incorporating.

### 6C.1 — Accepted: two consumers, and the conjunction belongs in *policy*

c-phase's strongest point: my asymmetry argument holds for discovery UIs and supervised
agents, but is weaker for an **auto-claiming fleet**, where picking up ungroomed work can
mean unclear blast radius, missing acceptance criteria, or product/security judgment calls.
There the false positive is not a cheap question — it is a bad branch.

This does not overturn §6B; it relocates it. **The conjunction was always a policy question
masquerading as a model question.**

| Consumer | Contract |
|---|---|
| Discovery / browse / human queue | `available`, ranked `ready > backlog > triage`. No stage gate. |
| Autonomous auto-claim | `available ∧ unassigned ∧ stage ≥ policy floor`. **Default floor: `ready`.** Configurable. |

This satisfies both positions and is better than either. The strict conjunction becomes the
*default* for the one consumer that needs it, while the data model stays uncommitted — which
is exactly the "flexibility of usage without confusing the user" the brief asked for. c-phase
and I agree substantially more than the review's framing suggests; the dispute was about
layer, not substance.

c-phase's warning stands and should be recorded: **if auto-claim defaults to all available
triage work, the `ready` signal becomes decorative once groomed work runs out.** The policy
floor is what prevents that.

#### The legibility constraint (c-phase, r4) — binding on the design

The policy floor reintroduces my original objection: `stage ≥ ready` is a conjunction, and a
conjunction can starve the queue silently. c-phase's resolution is the piece I was missing,
and it dissolves the disagreement rather than splitting it:

> **My objection was never to strictness. It was to *silence*.** A strict gate is safe
> exactly when its exclusions are legible.

So the constraint is: **an empty auto-claim queue must never be indistinguishable from a
healthy one.** The queue must be able to say *why* it is empty, distinguishing at minimum:

| Exclusion reason | Meaning | Who acts |
|---|---|---|
| No work at all | Backlog genuinely exhausted | Nobody — this is success |
| Available but **ungroomed** (below the floor) | Work exists and is unobstructed; nobody has approved it | Groomer / decomposer |
| Available but **assigned** | Work exists and is taken | Nobody, or check for stalled owners |
| **Not available** — waiting on dependencies | Work exists but is obstructed | Unblock the named blockers |
| **Not available** — on hold | Work exists but was deliberately parked | Whoever parked it |

This has a real API consequence, not just a UI one: **the queue query must return a breakdown,
not just a list.** A bare `[]` is the failure mode we are trying to design out, and it is
exactly what `ft task ready` returns today (the `graph.go:62-64` stderr hint is a hardcoded
guess at one of five possible reasons). Both CLI and MCP need the breakdown, since the agent
is the consumer that most needs to know whether to wait, groom, or escalate.

This is the single strongest acceptance criterion to come out of the whole review, and it
supersedes the weaker "surface the anomalies" note in §6B.

**Corollary:** the same treatment retires §8 defect #7 as a class of bug. If every count
discloses its scope and its exclusions, dashboard-vs-queue disagreements stop being mysterious
by construction.

### 6C.2 — Accepted, and it is a real hole: the decomposer makes the ranking tier empty

Verified: `internal/decomposer/writer.go:104` hardcodes `TASK_STAGE_TRIAGE` for **every**
created task. So on any decomposed project, `ready`/`backlog` are empty and the §6B ranking
degenerates to a no-op — every task sits in one tier.

This means the dogfooding failure in §6B.1 is **structural, not anecdotal**: it follows from
the producer, not from poor grooming discipline. That strengthens my argument against the
hard conjunction and simultaneously exposes a hole in my proposed replacement. Options:

- (a) The decomposer assigns stages intentionally — e.g. leaves with no open blockers created
  directly as `ready`.
- (b) An explicit grooming step between decomposition and queueing.
- (c) Treat "no assertion made yet" as its own rank *below* `triage`, so the ranking is
  meaningful from day one without requiring a producer change.

**Whichever we choose, task production is now a first-class input to this design, not an
afterthought.** I had not treated it as one. Good catch.

### 6C.3 — Accepted: "physical fact" was overstated, and the correction improves the argument

`available` as defined = graph fact (no open blocking dependency) **∧** asserted fact (not on
hold). So the hard gate is partly editorial after all, and the docs must not imply otherwise.

But the correction points at a sharper principle than the one I originally used:

> Gating on an **explicit act** is safe. Gating on an **act of omission** is not.

Putting a task on hold is a deliberate removal from the flow — someone decided. Failing to
groom is an omission — nobody decided anything. Conjunction on `ready` fails because it lets
an omission silently starve the queue. Excluding ON_HOLD is fine because someone affirmatively
put it there. This is the argument I should have made in r2.

### 6C.4 — Accepted: I overclaimed the evidence for `available` vs `claimable`

c-phase is right that today's dashboard/queue divergence is overdetermined — filter
propagation, assignment, pagination, and duplicated client predicates all contribute, and
the current Ready Queue is not `claimable` anyway (it includes assigned and `IN_PROGRESS`
tasks). It is **not** clean proof of the split. Retracted as evidence in §6B; the split now
rests on its own argument.

Also accepted: **demote `claimable` to API/internal vocabulary.** One user-facing derived term
(`available`) is the confusion budget. `claimable` is query semantics plus auto-claim policy,
and does not need a product name.

### 6C.5 — Accepted: UX consequences of keeping `stage=ready`

c-phase agrees keeping it is not circular (the ranking depends on the *concept* "groomed and
approved", not on the literal enum value — a cleaner statement than mine). But the residual
UX hazard is real: a Ready column containing unavailable tasks will still surprise people.
Required mitigations, all accepted:

- Prominent unavailable/blocked overlay on cards in the Ready column.
- Rename the queue view to **"Available Work"** or **"Work Queue"** — not "Ready Queue".
- `Ready` appears as a stage badge and grouping, never as a global state.
- Do not expose "ranking tier" as product language.

### 6C.6 — Accepted and extended: `stalled` is a bad name

c-phase is right, and the collision is worse in our context than they flagged: **Scion's own
agent lifecycle uses "stalled"** — it appears in the agent list in this very workspace. Naming
a task stage `stalled` inside an agent-orchestration product is asking for it.

I go further than the review, though. Before naming it, ask whether it should exist. Once
dependency-blockedness is derived, the residual meaning of `blocked` is "on hold for a
non-task reason" — which may already be covered by `waiting_for_input` and `deferred` in the
same ON_HOLD phase. **Raised as an open question (§9.7): delete rather than rename.** If it
survives, name it for its cause (`external_wait`, `held`), and define it narrowly so it
cannot decay into a generic blocked synonym.

### 6C.7 — Accepted: §8 defect reclassification

- **#4** (board sets CLOSED without `closed_at`) → invariant/API bug. The fix is to route
  board closure through `CloseTask`, not to special-case the board.
- **#7** (dashboard vs queue counts) → partly model/UX. Both scopes can be legitimate; the
  actual bug is that the labels do not disclose their scope.
- **#10** (terminal stages invisible on the board) → board-model question. Either the board is
  an active-flow board and closed outcomes need a separate archive/outcomes view, or the
  Closed filter needs columns for all four terminal stages.

### 6C.8 — Accepted: four material misses, all verified, one worse than reported

| Miss | Verified at | Impact |
|---|---|---|
| **`ClaimTask` does not enforce availability** | `entstore.go:786-808` — checks only *not closed* and *unassigned* | **Sharpest of the four.** The queue can be perfectly correct while the core mutation still lets an agent claim blocked or on-hold work by ID, moving it straight to `working`/`IN_PROGRESS`. Any availability gate living only in the query layer is *advisory*. If availability is a hard gate, it has to be enforced in the mutation. |
| **Derived state changes emit no events** | `server.go:743-749` — `CloseTask` publishes only the closed blocker's own event | Hard prerequisite for D3. When a blocker closes, every dependent's availability changes and nothing is published. Clients recomputing from a full local store may recover; filtered subscribers and any future server-computed field will not. |
| **Watch snapshot and live stream disagree on multi-stage filters** | `watch.go:248-250` forwards all stages; `server.go:383-391` honors `stages[0]` only | Separable defect (relates to §8 #2), but it becomes load-bearing once phase is demoted and stage multi-select is the primary filter (D4a). |
| **`scheduled` + `start_date`** | `start_date` is **write-only** — verified no read anywhere outside create/update | Worse than c-phase stated. Nothing reads it: no filter, no sort, no promotion. A `scheduled` task never becomes available under *any* design, which makes `scheduled` currently indistinguishable from `deferred`. |

### 6C.9 — Net position after review

The core diagnosis (§6) survives unchanged and is now independently confirmed. §6B survives
but is **relocated to policy** and **corrected on two counts** (overstated "physical fact",
overclaimed evidence). Three new hard design inputs are added: task production (§6C.2),
claim-time enforcement, and streaming of derived-state change. My r2 recommendation was not
wrong so much as **under-scoped** — it designed a query and called it a contract.

---

## 6D. Round 5 — what `ready` and `backlog` actually are

c-phase proposed deleting one of `backlog`/`ready`, arguing that `ready` encodes prioritization
("pull this sooner") rather than lifecycle state, and that agents are being made to learn a
process artifact as task state. I went to check the documented semantics before answering.
**The evidence contradicts both of us**, and it changes the recommendation.

### 6D.1 — `ready` has never meant "groomed" in Farm Table

I had assumed `ready` carried a preparedness/grooming assertion, and built §6B's ranking tier
and §7A's "keep the enum value" argument on top of that. **That assumption was imported from
general Scrum practice, not from this codebase.** Every definition in the repo:

| Source | Definition of `ready` |
|---|---|
| `agents.md:62` | "unblocked and available" |
| `.agents/skills/farmtable/resources/task-fields.md:14` | "ready for an agent to claim" |
| `.design/cli-design.md:507` | claimability is *all three* OPEN stages, so `ready` is not a claim gate |
| `internal/cli/task.go:861` | `ft task release` resets to `ready` — i.e. "back in the available pool" |

All four are the **availability** meaning. Nowhere is `ready` defined as prepared, refined,
groomed, or specified. And `backlog` is defined at `task-fields.md:13` as *"accepted but not
ready"* — defined by negation of `ready`, so when `ready`'s meaning is removed, `backlog`'s
definition evaporates with it.

**This deepens the §6 diagnosis rather than just correcting me.** The collision between
`ready`-the-stage and `ready`-the-computation was never an unlucky name clash between two
distinct concepts. They collided because **they are the same concept**: `stage=ready` is a
hand-maintained cache of a derived value. That is why it drifts, and the drift is exactly the
§4 symptom (a Ready column containing tasks with open blockers). Denormalized state without a
recompute path always drifts; this one had no recompute path at all.

So c-phase's conclusion (`ready` should not be a native workflow stage) is right, but for a
stronger reason than the one offered: it is not a process artifact encoding priority, it is
**denormalized derived state**.

### 6D.2 — But it exists for a third reason neither of us considered: Linear

`.design/schema-review-findings.md:37` records why the Stage tier was added at all:

> "Linear has 6 state categories (`triage`, `backlog`, `unstarted`, `started`, `completed`,
> `canceled`)... Without Stage, agents cannot distinguish between 'Triage' and 'Backlog' tasks
> that both map to OPEN, losing information the product definition intended to preserve."

The OPEN triple is a direct transcription of Linear's pre-work categories. **`ready` is the
normalization slot for Linear's `unstarted`.** It was minted for cross-platform fidelity, then
re-glossed in the agent docs as "unblocked and available", and then a derived query was built
using the same word. Three layers of meaning accreted onto one enum value — which is the
complete explanation for the original complaint.

So deleting it outright, as c-phase proposed, would cost real round-trip fidelity against a
named target platform. That is a genuine cost, not a hypothetical one.

### 6D.3 — Recommendation: apply the Q3 pattern to stage

We do not have to choose between fidelity and simplicity. ptone already gave the rule for
exactly this situation in Q3:

> "We do want strong cross-platform normalization — but may not need it surfaced in our native
> UX."

That was decided for `phase`. The same treatment applies one tier down. **Keep `backlog` and
`ready` in the enum for Linear round-trip; stop treating them as native workflow states.**

| Linear category | FT stage | Native role |
|---|---|---|
| `triage` | `triage` | Native — not yet accepted |
| `backlog` | `backlog` | **Native — the single pre-work "accepted" state** |
| `unstarted` | `ready` | **Mapping-only.** Never offered natively, never set by native writes |
| `started` | `working` | Native |
| `completed` / `canceled` | `completed` / `cancelled` | Native |

Consequences:

- **The Ready column disappears** — which is where this whole investigation started. `ready`
  stops being a native concept, so there is nothing to collide with `available`.
- **The §6B stage-ranking tier collapses.** With one native pre-work state, ranking by stage
  has exactly two tiers, which is just the policy floor restated. Replace it with an explicit
  ordering (below) — strictly simpler than what I proposed in r2.
- **The auto-claim floor simplifies to c-phase's version:** `available ∧ unassigned ∧ stage ≠
  triage`, ordered by policy. No floor configuration needed in v1.
- **§6C.2's decomposer problem narrows** to a single clear question: who makes the acceptance
  decision that moves a task `triage → backlog`? The "unasserted rank below triage" option
  becomes unnecessary.

### 6D.4 — The cost: mapping-only enum values need a rule

This pattern has a failure mode, and it is the one that produced `phase`'s current mess: if
some enum values are native and some are mapping-only, and that distinction lives only in a
doc, someone will eventually build a UI that offers the mapping-only value. It must be:

- documented in the proto as normalization-only,
- enforced on native write paths (reject `ready` from `CreateTask`/`UpdateTask`; permit it
  only from sync adapters), and
- excluded from board columns, CLI stage help, and agent skill vocabulary.

Without enforcement this decays back into exactly the state we are fixing.

### 6D.5 — c-phase's ordering caveat becomes load-bearing

Once stage carries no ordering signal, ordering has to come from somewhere. Today the only
mechanism is `priority` (4 coarse values — `URGENT/HIGH/NORMAL/LOW`, semantically
importance/severity) plus `created_at` as a tiebreak (`ft-kanban-column.ts:24-36`,
`entstore.go:430-432`). For a fleet pulling work continuously that is thin: four buckets and
then FIFO.

c-phase is right that this argues for a distinct **queue rank** — a stable, total-ish pull
order independent of importance. That is now a real design question rather than a caveat,
because collapsing the stage ladder removes the only other lever. Logged as §9.12.

### 6D.6 — This partially revises Q1

ptone's Q1 answer was "ready is an assertion; the derived set gets renamed." The naming half
stands and is unaffected: **the derived set is `available`.** But the premise of the other
half does not hold — the asserted "ready" concept that decision presumed **does not exist in
this system**. Keeping `ready` as a native asserted stage would mean *inventing* a new concept,
not preserving an existing one.

Flagging this explicitly rather than quietly reinterpreting the decision. If ptone does want a
native preparedness assertion, that is a legitimate thing to add — but it should be added
deliberately, on its own merits, with its own name, and it should probably be derived from
`acceptance_criteria` presence rather than hand-maintained, given what §6D.1 shows happens to
hand-maintained caches here.

---

## 6E. Round 6 — testing the mapping-only compromise against the adapters

c-phase agreed with §6D's conclusion and raised three constraints on it: mapping-only needs a
*write-source boundary* (not just an enum annotation), external `ready` rows would still leak
the word to agents over the read path, and migration needs a reliable origin discriminator.

All three are answerable from the code. Two hold, one dissolves, and checking them undercut my
own §6D compromise. **I am changing the §6D.3 recommendation as a result.**

### 6E.1 The write-source boundary is real, and `collection.platform` cannot stand in for it

Confirmed: `store.CreateTaskParams` and `store.UpdateTaskParams`
(`internal/store/store.go:24`, `:46`) carry no caller, source, or capability field. Nothing
below the RPC layer can tell a native write from a sync write.

The obvious cheap substitute is the collection: `internal/store/schema/collection.go:19`
already has `platform` enum `{farmtable, github, linear, jira, asana, beads}`. Tempting — but
it does not work. `CreateTaskServer` (`internal/server/server.go:100-118`) validates
collection *access* and never looks at the collection's platform. Any caller can create a task
directly into a `github` or `beads` collection. Collection platform describes where a
collection syncs, not who wrote a given row.

So c-phase is right: this needs an explicit source/capability on the write path. It is real
plumbing, not an annotation, and it should be costed as such.

### 6E.2 There is a second leak the boundary must cover: the GitHub label auto-map

`internal/platform/github/labels.go:30-45` maps *every* stage name to a like-named GitHub
label by default, `ready` included. So an issue labelled `ready` becomes `stage=ready` on
import — through the adapter, which is exactly the path a mapping-only rule would permit.

Worth being clear about what that mapping is: GitHub has no "unstarted" concept. Its native
issue states are open and closed. The `ready` label round-trip is **Farm Table's own
vocabulary echoed back through GitHub labels** — not a foreign concept being normalized. A
write-source boundary that permits adapter writes would keep this alive indefinitely.

### 6E.3 Nothing currently normalizes *to* `ready` — the fidelity argument is prospective

This is the finding that changes my recommendation. §6D.2 justified keeping `ready` as the
normalization slot for Linear's `unstarted`. Checking the adapters:

- **There is no Linear adapter.** `internal/platform/` contains `beads` and `github` only.
  Linear is a design target in `.design/schema-review-findings.md`, not shipped code.
- **Beads never produces `ready`.** No `StageReady` write anywhere in `internal/platform/beads/`.
- **GitHub produces it only via §6E.2's generic label name-match**, not from any GitHub state.

So the empirical count of foreign states normalizing to `ready` today is **zero**. I argued in
§6D.3 for preserving round-trip fidelity that does not yet exist against a platform that is not
yet integrated. That is a weaker argument than I made it, and I should retract it rather than
let it stand because it happened to produce a tidy compromise.

### 6E.4 Revised recommendation: delete `ready` now, reserve the wire number

Given ptone's Q2 ("we are very early and can break what we need"), the cheaper and more honest
option is:

- **Delete `ready` from the stage enum's live values.** `backlog` (or its rename, §9.14)
  becomes the single native pre-work accepted state, exactly as c-phase originally proposed.
- **Reserve the proto enum number and name.** Precision matters here (c-phase's correction):
  reserving prevents *accidental reuse* of tag 3 for some unrelated future value, and preserves
  the numeric identity if we restore it. It does **not** make re-adding Linear `unstarted`
  automatically additive — that will be a deliberate schema change that removes the reservation
  and restores the value. The benefit is protection against silent semantic reuse, not a free
  future migration.
- **Drop `ready` from the GitHub `allStages` auto-map** (§6E.2), so the deleted value cannot
  re-enter through the import path.
- **Defer the write-source boundary** (§6E.1). It is only needed once a mapping-only value
  actually exists. Deleting instead of reserving-and-permitting means we do not have to build
  it for this change — though we will need it when Linear lands.

Trade-off, stated plainly: if the Linear adapter arrives soon, we pay a small re-add later.
If it does not, we have avoided building a capability boundary to protect a value nothing
writes. Given that a mapping-only value with no enforcement is precisely how `phase` rotted
(§6D.4), the option that requires no enforcement is the safer one.

**This supersedes §6D.3.** §6D.1 and §6D.2 — the actual findings about what `ready` means and
where it came from — stand unchanged; only the disposition changes.

### 6E.4a Removal inventory — acceptance criteria, not a sketch

c-phase's second caution is the right one to bind: *a dead enum value survives as behaviour
unless every live surface is removed*. Deleting the value and leaving the plumbing is how we
get a third meaning of `ready` rather than zero. Concrete inventory, to be verified by whoever
reviews the eventual implementation:

| Surface | Locations |
|---|---|
| Proto / generated Go | stage enum tag 3 → `reserved`; `internal/convert/convert.go:29-30`, `internal/server/convert.go:37-38` |
| Phase projection | `internal/server/convert.go:70` (drop from the OPEN arm) |
| Ent schema + migration | stage enum values; migration `stage=ready → backlog` (§6E.5) |
| Availability query | `internal/store/entstore.go:2023` — `GetReadyTasks` loses its `StageEQ(ready)` predicate **and should be renamed** (`GetAvailableTasks`), per the Q1 naming decision |
| Release semantics | `task.go:861` — `ft task release` resets to `ready`; must reset to `backlog` |
| CLI | `internal/cli/enums.go:20`, `:38` — parser, formatter, stage help text |
| MCP | `internal/mcp/server.go:762`, `:780` — same pair, plus tool schema docs |
| GitHub adapter | `internal/platform/github/labels.go:18` (`stagePrecedence`), `:34` (`allStages` auto-map — §6E.2), `treewalk.go:89` (reads `StageReady` for rollup) |
| Export/import validation | `internal/server/export_import.go:749` allowlist |
| Web enums + labels | `web/src/gen/types.ts:27`, `gen/service.ts:159`, `:187` |
| Web board | `kanban/ft-kanban-view.ts:31` (the Ready column itself), `kanban/ft-kanban-column.ts:12`, `tree/ft-tree-node.ts:9`, `:27`, `inspector/inspector-stage-utils.ts:6`, `:24`, `--ft-stage-ready` CSS token |
| Web derived predicate | `utils/task-ready.ts` — keep the computation, rename to `available`, reconcile with the server predicate (§4) |
| Docs | `agents.md:62`, `task-fields.md:13-14`, `cli-design.md:507`, `SKILL.md` |
| Tests seeded with `ready` | `github/labels_test.go`, `server/graph_routing_test.go`, `server/graph_integration_test.go`, `server/server_test.go`, `server/server_postgres_test.go`, `store/multistore_test.go` |

Note the two entries that are *renames, not deletions* — `GetReadyTasks` and
`task-ready.ts`. The derived computation survives this change; only the asserted stage dies.
Conflating the two during implementation is the most likely way to break availability while
"removing ready".

### 6E.4b Sequencing against defect #13

Defect #13 (§6E.6) should **not** gate this change. `native_label` is broken, and it blocks any
UX that claims to display verbatim external state — but `ready` is not currently real external
state (§6E.3), so nothing about deleting it depends on #13 being fixed first. Independent
tracks.

### 6E.5 Migration is simpler than feared

c-phase's third constraint asked for a conservative fallback where origin is unreliable. It is
not needed: by §6E.3 nothing external maps to `ready`, so every existing `stage=ready` row is
native or a GitHub label echo of a native value. Migration is a single unconditional
`stage=ready → backlog` update, with `native_label` preserved verbatim for audit. No origin
discrimination required.

### 6E.6 New defect: `native_label` is not carrying what c-phase's read-path fix assumes

c-phase proposed presenting external rows as accepted/available with `native_label=unstarted`
retained for fidelity. That is the right shape, but the field cannot support it today:

- `internal/server/server.go:124` — native `CreateTask` sets `NativeLabel: string(stage)`
- `internal/server/server.go:244` — decomposer path sets it to `"triage"`
- `internal/platform/github/passthrough.go:141` — **overwrites** it with the *mapped Farm Table
  stage*, discarding the GitHub state it just read

So for most rows `native_label` is a duplicate of `stage`, not the verbatim platform string the
NTO design says it is. Only `beads.go:194` (`issue.Status`) and `github.go:167`
(`issue.GetState()`) populate it honestly. Filed as §8 defect #13. It should be empty for
native tasks, and this must be fixed before `native_label` can be relied on as the fidelity
carrier in any UX.

### 6E.7 Agreed without qualification

Queue rank is first-class, and `priority` (importance) is not a substitute for pull order.
Recorded in §9.12; my position is now that v1 may ship with priority+FIFO **only if** it is
labelled an explicit compromise in the design doc rather than presented as the answer.

---

## 7. Candidate directions

Options with trade-offs. **Superseded in part by §6A** — retained for the reasoning. D1 is
confirmed; D4(a) is confirmed; D4(c) is ruled out; D2 is now permitted by Q2 but see §7A for
why I still argue against it.

### D1 — Rename the derived concepts so they never collide (lowest cost)

Keep `stage` values `ready` and `blocked` as asserted labels. Rename the *derived* views:
"Actionable" / "Available" queue, "Waiting on dependencies" list. One shared predicate
implementation consumed by all surfaces.

- **For:** No schema change, no migration, no wire break. Mostly UI copy, docs, and
  consolidating five predicates into one.
- **Against:** Doesn't fix the underlying invariant drift — `stage=ready` with an open
  blocker is still constructible and still confusing, just less confusingly named. Doesn't
  address the phase filter.
- **Reversible:** Yes, cheaply.

### D2 — Remove the colliding stage values

Delete `ready` and `blocked` from the stage enum. Stage becomes purely asserted workflow
position. Readiness/blockedness exist only as computed badges and filters. The board's Ready
column becomes a derived swimlane over `backlog`.

- **For:** Eliminates the ambiguity at the root. One truth per concept.
- **Against:** Expensive and load-bearing. Enum values are wired into GitHub label round-trip
  (`ft:stage/ready`, `internal/platform/github/labels.go:257`), beads status mapping, agent
  skill docs, `ft task release --stage ready` default (`task.go:861`), and existing databases.
  More importantly it **destroys a genuinely useful distinction**: "I have groomed this and
  declared it available" is a different claim from "it has no open blockers." Both are real
  and a mature backlog needs both.
- **Reversible:** No. Enum deletion is a one-way door.

### D3 — Promote derived state to first-class computed fields on the NTO

Keep `stage` as-is. Add read-only server-computed fields to `Task` — e.g. `is_blocked`,
`open_blocker_count`, `is_actionable` — never settable, populated on reads. Every surface
consumes them instead of re-deriving. The board shows an accurate lock badge; "Actionable"
becomes a *filter/overlay*, not a column.

- **For:** Kills all five divergent reimplementations. Makes the derived tier explicit and
  visible in the schema, which is the actual missing piece. Preserves the asserted labels.
- **Against:** Cost per task on list responses — `GetBlockedTasks` already does a `Task.Get`
  per blocker inside a loop (`entstore.go:2146`), so this needs a batched or SQL-side
  implementation before it can go on the hot path. Staleness semantics on the `WatchTasks`
  stream need deciding (blocker closes → do dependents emit an update event?). Widens an
  already-wide proto.
- **Reversible:** Mostly — additive fields can be deprecated.

### D4 — Stop exposing `phase` as the user-facing filter

Several sub-options, roughly increasing in cost:

- **(a)** Keep `phase` on the wire as the normalization tier; remove it from the toolbar and
  demote `--phase`. Replace with a tri-state "Active / Closed / All" (= sense B) plus a
  stage multi-select. Names sense B for the first time.
- **(b)** Additionally make the "not closed" predicate a real, named, filterable concept in
  the API.
- **(c)** Redefine `phase` as a genuine binary `open|closed`, folding `IN_PROGRESS`/`ON_HOLD`
  into stage only.

- **For:** Removes the single biggest day-one confusion — "Open" not meaning "not closed."
  (a) and (b) are cheap and high-value.
- **Against:** (c) is a wire-breaking enum change and discards the cross-platform
  status-category mapping that `phase` exists for. I'd want a strong reason before touching
  (c).
- **Reversible:** (a) yes. (c) no.

### D5 — Decide whether unsuccessful closure unblocks dependents

Orthogonal to all naming. Today any `CLOSED` blocker unblocks. Options: keep it; or have only
`completed`/`duplicate` unblock while `wont_fix`/`cancelled` flag dependents for review; or
surface the distinction without changing behaviour (e.g. `blockers_resolved` gains a
`blockers_abandoned` sibling).

- **For:** This is arguably a correctness issue, not cosmetics — cancelling a prerequisite
  currently marks its dependents ready with no signal.
- **Against:** Adds a second dimension to readiness. May produce tasks that are neither ready
  nor blocked, which needs a home in the UI.
- **Reversible:** Yes, but it changes agent-visible behaviour, so it wants a deliberate
  rollout.

### Combination worth considering

D1 + D3 + D4(a) is additive, non-breaking, and addresses every symptom in §2–§5 without
touching the enum or the wire format. D5 is a separate decision. D2 is the only option that
requires a one-way door, and I don't currently think it earns it.

---

## 7A. Post-decision position

With Q1–Q3 answered, the shape narrows to **D1 + D3 + D4(a) + D5**, with D2 still declined.

**D2 is now permitted (Q2) but I still argue against it.** The case for deleting `stage=ready`
was that it collides with the derived concept. Q1 resolved that collision the other way — the
stage keeps the word and the derived set is renamed — so D2's motivating problem is already
solved by D1 at a fraction of the cost. Deleting the value would also destroy the distinction
§6B depends on: the queue's *ranking* tier requires an asserted grooming signal to rank by.
Remove `ready` and the ranking has nothing to sort on.

`stage=blocked` is a different matter — see the rename argument at the end of §6B. That one
I would change, because unlike `ready` it has no post-rename job that justifies the collision.

**Q2 mainly unlocks the cleanups, not a bigger redesign.** With breakage permitted:

- Rename the derived RPCs and the CLI/MCP surface (`GetReadyTasks` → an availability/queue
  query; `GetBlockedTasks` → a dependency-wait query). No compatibility shim needed.
- Delete `--include-unblocked` outright rather than deprecating it (§6B makes it meaningless).
- Rename `stage=blocked` → `stalled`.
- Fix the beads projection violation by making the invariant enforced at the store layer
  rather than by convention, and let the migration correct existing rows.

**Q3 pins D4(a) precisely.** `phase` stays in the proto as the normalization tier and stays
derived from `stage`. What changes is exposure, not existence:

- Remove the phase dropdown from the toolbar; replace with an **Active / Closed / All**
  tri-state — which names sense B (§2) for the first time — plus a stage multi-select.
- Demote `--phase` in the CLI; it becomes an advanced/normalization-facing filter.
- Document `phase` in the proto as an output-oriented normalization projection, so no future
  surface treats it as a user-facing control.
- The store should enforce `phase = phaseForStage(stage)` on every write path, closing the
  beads and import gaps. If phase is a projection, nothing should be able to write it directly.

**Load-bearing vs reversible, for the eventual design:**

| Decision | Load-bearing? |
|---|---|
| `ready` stays an asserted stage | Yes — §6B's ranking depends on it |
| Availability is a hard filter, readiness a ranking tier | Yes — defines the queue contract for every agent |
| `available` / `claimable` split | Yes — shapes the API surface |
| `phase` retained but unexposed | Yes for the wire, reversible for the UX |
| Choice of the word "available" | Reversible |
| Renaming `stage=blocked` → `stalled` | Reversible-ish; enum change, so cheaper now than later |
| D5 unblock-on-abandonment semantics | Behavioural; reversible but agent-visible |

---

## 8. Separable defects found along the way

These are bugs, not model questions. Listing them so they don't get conflated with the design
discussion — several could ship independently, today.

| # | Defect | Citation |
|---|---|---|
| 1 | `claim --stage` is parsed, validated, transmitted, and silently ignored — the store hardcodes `working` | `entstore.go:804-808` vs `task.go:768`, `mcp/server.go:128` |
| 2 | `list --stage` is documented as repeatable with OR semantics; only the first value is honored | `server.go:383-391`, `entstore.go:405-407` |
| 3 | Beads adapter writes `(OPEN, blocked)`, violating `phaseForStage` | `beads.go:308` |
| 4 | Kanban "Completed" drop uses `UpdateTask`, so `closed_at` is never set from the UI | `ft-kanban-view.ts:157-161` |
| 5 | Card lock icon ignores blocker phase — stays lit after the blocker closes | `ft-task-card.ts:179-183` |
| 6 | Web loads 200 tasks with no pagination loop; missing blockers count as resolved → inflated Ready count | `grpc-client.ts:210-218`, `task-ready.ts:16` |
| 7 | Dashboard Ready card ignores active filters; the Ready Queue it links to applies them | `ft-app.ts:419-425` vs `ft-ready-queue-view.ts:222` |
| 8 | MCP `task_search` claims a default open-phase filter it does not apply | `mcp/server.go:143` vs `:560-573` |
| 9 | Three divergent stage-label tables in the web UI | `ft-tree-node.ts:24`, `inspector-stage-utils.ts:3`, `ft-command-palette.ts:45` |
| 10 | `wont_fix`/`duplicate`/`cancelled` tasks are invisible on the kanban — no column, not in On Hold | `ft-kanban-view.ts:28-51` |
| 11 | `.design/cli-design.md` documents an `ft graph` command group that does not exist | `cli-design.md:820-852` |
| 12 | Skill docs teach a two-value phase model and misfile 8 non-OPEN stages under "Open-stage values" | `SKILL.md:30`, `task-fields.md:10` |
| 13 | `native_label` is set to the Farm Table stage on native writes, and the GitHub passthrough *overwrites* the real GitHub state with the mapped stage — so the "verbatim platform string" field mostly duplicates `stage` | `server.go:124`, `server.go:244`, `github/passthrough.go:141` |

---

## 9. Open questions

**Resolved in round 1** (see §6A): Q1 ready-as-assertion; Q2 breakage permitted; Q3 phase
retained on the wire, removed from UX.

**Still open:**

1. **Does `IN_PROGRESS ∧ unassigned` count as claimable?** A released or abandoned task.
   Today the server says no (`phase==OPEN` outer predicate) and the web says yes. `ft task
   release` resets the stage to `ready` (`task.go:861`), which suggests release is expected
   to round-trip through the asserted tier — but an agent that dies without releasing leaves
   a task stranded in `working` forever, invisible to every queue. Related: is there a
   staleness/liveness concept needed here at all, or is that a separate problem?

2. **Should cancelling a prerequisite unblock its dependents?** (D5.) Behavioural, not
   cosmetic, and independent of everything else here. My lean: `completed` and `duplicate`
   unblock; `wont_fix` and `cancelled` mark dependents as needing review rather than silently
   promoting them.

3. **Should a board column ever show derived state?** I lean strongly no — columns are drop
   targets, and you cannot drop something into "available." That argues availability is a
   filter, overlay, or separate queue view, never a column. Confirming this decides whether
   the kanban keeps a Ready column at all (under §6B it would remain, as the *asserted*
   ready stage, with an availability badge overlaid).

4. **Does the ranking tier need to be configurable per collection?** §6B ranks
   `ready > backlog > triage`. Fixed global order is simpler; per-collection ordering is more
   flexible and matches the "flexibility of usage" goal, but adds a configuration surface
   that has to be explained.

5. **Is an external blocker a first-class concept?** Falls out of the `stage=blocked` →
   `stalled` rename. If "obstructed by something outside the graph" is common, a stage label
   is a weak way to model it — there is nothing to point at and nothing to resolve. Out of
   scope for this round, but the rename is the moment to decide whether to leave room.

6. **Who is the primary dashboard user — human, or human supervising agents?** Changes how
   much vocabulary sophistication is affordable. The CLI/MCP surface can carry more precision
   than the board can. Partly answered by §6C.1's two-consumer split, but the board itself
   still needs an audience.

**Added in round 3:**

7. **Should `stage=blocked` be deleted rather than renamed?** (§6C.6.) Once
   dependency-blockedness is derived, its residual meaning may be fully covered by
   `waiting_for_input` and `deferred`. Deleting is cleaner than naming; naming is safer if
   external obstruction is common. Q2 permits either.

8. **What sets the initial stage, and does the decomposer change?** (§6C.2.) Options (a)
   decomposer assigns stages, (b) explicit grooming step, (c) an "unasserted" rank below
   `triage`. This gates whether the §6B ranking is meaningful at all on decomposed projects.

9. **What is the auto-claim policy floor, and where does it live?** (§6C.1.) Default `ready`
   is my recommendation. Per-collection config, server config, or agent-side? Whoever owns it
   owns fleet liveness. **Gated by the legibility constraint** — the floor is only acceptable
   if the empty-queue breakdown ships with it, not after it.

10. **Should `scheduled` + `start_date` actually schedule?** (§6C.8.) Today `start_date` is
    write-only and `scheduled` is inert. Either availability becomes time-aware, or we admit
    `scheduled` is a manual hold and merge it with `deferred`.

11. **Where is availability enforced?** (§6C.8.) Query-layer only is advisory. My position:
    `ClaimTask` must reject unavailable tasks, with an explicit override path for the
    deliberate case. Needs confirming, because it changes an existing mutation's contract.

**Added in round 5:**

12. **Does the queue need a `rank` field?** (§6D.5.) Collapsing the stage ladder removes the
    only ordering lever other than `priority`, which is 4 coarse importance buckets plus FIFO.
    A distinct pull-order rank is the obvious answer but it is new surface. Alternative: accept
    coarse ordering in v1 and add rank when it demonstrably hurts.

13. **Do we want a native preparedness assertion at all?** (§6D.6.) Q1 presumed one exists;
    it does not. If we want "specified enough to hand to an agent" as a first-class signal, my
    recommendation is to **derive** it from `acceptance_criteria` presence rather than mint
    another hand-maintained stage — §6D.1 is a case study in what happens to those here.

14. **Is `backlog` the right native word for "accepted"?** — **answered in r7 below.**
    Recommendation: **`accepted`.** (The r5 version of this question said `backlog` "already
    carries the correct Linear mapping." §6E.4 invalidated that; see §9.14a.)

15. **Should `blocked` be derived-only?** (§5A.) Recommend yes — native-delete, but **retain
    as a mapping target**, because unlike `ready` it has a live external producer (beads has a
    native `blocked` status). That re-opens the write-source boundary deferred in §6E.4, which
    is the real decision here.

16. **Should ON_HOLD become a `hold_reason` modifier axis?** (§5B.) Recommend yes — the
    current single-enum encoding **destroys workflow position** when a hold is asserted, and
    there is no `previous_stage` field anywhere to recover it. Same defect shape as §4 and §5A.
    Cost is materially larger than the `ready` deletion, and it interacts with §9.10
    (`scheduled`/`start_date`). Not asked of me; recorded because it revises §5A.4.

### 9.14a Round 7 — naming the accepted pre-work stage

Three candidates: `backlog`, `accepted`, `planned`. My recommendation is **`accepted`**, and
the reasoning changed once §6E.4 deleted `ready`.

**The rename is not optional churn — the current definition evaporates either way.**
`task-fields.md:13` defines `backlog` as *"accepted but not ready"* — by negation of `ready`.
Delete `ready` and that sentence is meaningless. The word has to be redefined regardless, so
the marginal cost of also renaming it is the mechanical churn only, not a conceptual reset.

**Against `backlog` — it names the wrong half of a merge.** With `ready` gone, the single
native pre-work state must absorb *both* Linear `backlog` **and** Linear `unstarted`
(`.design/schema-review-findings.md:37`). Those mean different things on the Linear side:
`backlog` is explicitly *not scheduled*, `unstarted` is *accepted and startable*. Our merged
state is the auto-claim pool — an agent can pull from it right now — which is semantically
`unstarted`, not `backlog`. Naming it `backlog` therefore:
- describes it as the parking lot when it is in fact the work queue, and
- disguises a lossy 2:1 merge as a faithful 1:1 mapping. A Linear `unstarted` task would land
  in something called `backlog` and sync back as `backlog`, silently demoting it. A neutral
  native name makes the merge visible at the mapping layer, which is where it belongs.

**Against `planned` — it collides with an existing stage.** `task-fields.md:22` already
glosses `scheduled` as *"planned for a future time."* Introducing `planned` next to
`scheduled` and `deferred` re-creates exactly the near-synonym problem this investigation
exists to remove, and it drags in the unresolved `start_date`/`scheduled` question (§9.10).

**For `accepted` — it names the assertion.** The spine of this whole investigation is
asserted vs. derived state (§6). `accepted` is unambiguously an assertion: a human or agent
judged this worth doing. It is the verb of the transition §9.8 is about — "who makes the
triage → accepted decision" reads as the question it actually is. And it has no collision with
any other stage, current or proposed.

**Cost, stated plainly:** it diverges from Linear's vocabulary. That is acceptable under
ptone's own Q3 decision — normalize strongly, do not surface the platform vocabulary natively.
Divergence is what the mapping layer and `native_label` are for. (Caveat: `native_label` cannot
currently carry that weight — defect #13, §6E.6. It should be fixed before we lean on this
argument in a shipped UX.)

**Reversibility:** high. This is a rename of one enum value, caught by the §6E.4a inventory
and by the compiler on the Go side. If `accepted` reads wrong in practice, changing it later
is cheap — unlike the `ready` deletion, which is load-bearing.

---

## 10. Suggested next step

Round 1 decisions are incorporated. Pending independent critical review (requested from
`c-phase`), the remaining gate is §9.1 and §9.2 — both narrow, both answerable without
further investigation.

The §8 defects can be filed and fixed independently; they are not blocked on the model
discussion. Fixing #1, #2, #3, #4, and #6 would remove a fair amount of noise from whatever
we decide. #3 (the beads projection violation) is arguably urgent regardless, since it puts
rows in the database that contradict an invariant the rest of the system assumes.

---

## Changelog

- **2026-07-25 r1** — Initial investigation (§1–§5, §8), diagnosis (§6), directions (§7).
- **2026-07-25 r2** — Incorporated ptone's Q1–Q3 decisions (§6A). Added the work-queue
  conjunction analysis and the `available`/`claimable` split (§6B). Added post-decision
  position (§7A). Rewrote open questions (§9).
- **2026-07-25 r3** — Incorporated c-phase's independent review (§6C). Relocated the queue
  contract from model to policy with a two-consumer split. Retracted the overclaimed
  dashboard/queue evidence and the "physical fact" framing. Added three new hard design
  inputs: task production, claim-time enforcement, derived-state streaming. Added §9.7–§9.11.
- **2026-07-25 r4** — Added the legibility constraint (§6B, end of the policy subsection):
  an empty auto-claim queue must be able to explain itself, with a five-way exclusion
  breakdown returned by the queue query. Strongest acceptance criterion from the review;
  makes the strict floor safe and retires §8 #7 as a bug class. c-phase confirmed no
  remaining pushback on the r3 dispositions.
- **2026-07-25 r5** — §6D. Investigated `backlog`/`ready` semantics after c-phase proposed
  deleting one. Found `ready` has never meant "groomed" in this codebase (it has always meant
  availability — so it is denormalized derived state, deepening §6's diagnosis) and that the
  OPEN triple exists as a transcription of Linear's pre-work categories. Recommendation:
  apply the Q3 pattern to stage — keep `backlog`/`ready` for normalization, make `ready`
  mapping-only, `backlog` the single native accepted state. Kills the Ready column, collapses
  the §6B ranking tier. Partially revises Q1 (§6D.6). Added §9.12–§9.14.
- **2026-07-25 r6** — §6E. Tested the §6D.3 mapping-only compromise against c-phase's three
  constraints and against the actual adapters. Two constraints hold (the write-source boundary
  is real; `collection.platform` cannot substitute for it), one dissolves (migration needs no
  origin discrimination). Decisive finding: **nothing normalizes to `ready` today** — no Linear
  adapter exists, beads never emits it, and GitHub only round-trips Farm Table's own vocabulary
  through a generic label name-match. **Retracted §6D.3 and replaced it with §6E.4: delete
  `ready` now, reserve the proto number, drop it from the GitHub auto-map, defer the capability
  boundary until a real mapping-only value exists.** Added defect #13 (`native_label` is
  overwritten with the mapped stage, so it cannot yet serve as the fidelity carrier).
  Incorporated c-phase's two cautions on the revision: corrected the proto-reservation claim
  (reservation prevents accidental reuse; re-adding is still a deliberate schema change, not
  automatically additive), and added §6E.4a — a concrete file-and-line removal inventory across
  proto, ent, query layer, CLI, MCP, GitHub adapter, web board and tests, flagging that
  `GetReadyTasks` and `task-ready.ts` are renames rather than deletions because the derived
  computation survives. Added §6E.4b: defect #13 does not gate the deletion.
- **2026-07-25 r7** — Answered §9.14 (§9.14a): recommend **`accepted`** over `backlog` and
  `planned`. Corrected the r5 claim that `backlog` "carries the correct Linear mapping" —
  §6E.4's deletion of `ready` makes the single native state a 2:1 merge target for Linear
  `backlog` + `unstarted`, and it behaves as `unstarted` (the claim pool), so `backlog` names
  the wrong half. `planned` collides with the existing `scheduled` gloss ("planned for a future
  time").
- **2026-07-25 r8** — §5A. Answered c-phase's question on `blocked`: recommend native-deleting
  it as an asserted stage. Principle extracted — **an asserted hold should name a reason the
  graph cannot see**; `blocked` is the only ON_HOLD stage naming a condition the graph already
  computes. Flagged the material difference from `ready`: beads has a genuine native `blocked`
  status and GitHub's treewalk reads `StageBlocked` in three places, so the mapping-only
  compromise rejected in §6E.4 is justified here and re-opens the deferred write-source
  boundary. Added a two-branch migration rule (§5A.4) and open question 9.15.
- **2026-07-25 r9** — §5B (unbidden, recorded because it revises §5A.4). Position on the
  `hold_reason` modifier-axis question: yes. Key finding — `stage` is a single enum mixing
  workflow positions with holds, so asserting a hold **overwrites the position**, and there is
  no `previous_stage` field anywhere to recover it. Third instance of the investigation's core
  defect shape. Added open question 9.16.
