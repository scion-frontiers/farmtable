# Brief: Engineering Manager — Decompose Auth Improvements Plan into a Farmtable Task Collection

## Critical Constraints (read first)

- **This is a task-planning/dogfooding task, not a code feature.** Your deliverable is a
  populated Farmtable collection with a detailed, well-related task DAG — not a PR.
- **Use a dedicated git worktree if you need the repo** for CLI access:
  `git worktree add /workspace/farmtable-auth-tasks -b explore/auth-task-breakdown
  origin/main` (standing policy).
- **Use the live deployed instance** (now reachable behind IAP thanks to Feature 59) via
  the `ft` CLI with the `x-farmtable-token` header — check `/workspace/agents.md`'s new
  "Authenticating to the IAP-Protected Cloud Run Instance" section for exact usage, and
  `/scion-volumes/scratchpad/projects/farmtable/design-iap-token-header.md` for background.
  Get the Farmtable API token via `gcloud secrets versions access latest
  --secret=farmtable-token --project=deploy-demo-test`.
- **Optional tool**: the decomposer binary (`cmd/decomposer/`) exists and can
  LLM-decompose a task into a subtask DAG — you may use it to help generate candidate
  subtasks for each stage if useful, but the design doc already has detailed acceptance
  criteria per stage, so your primary job is faithfully transcribing that INTO Farmtable
  tasks with correct relationships, not re-deriving the plan from scratch via the
  decomposer's own judgment. Use your own judgment on how much to lean on it.
- **You own this end-to-end** — create the collection, create all tasks, set up
  relationships, verify the result looks right, and report. No PR/review cycle needed
  since this is data, not code.

## Context

`farmtable-architect-auth` finalized a 6-stage auth improvements design doc (approved by
ptone@google.com) at
`/scion-volumes/scratchpad/projects/farmtable/design-auth-improvements.md`. ptone@google.com
asked (2026-07-23, verbatim): "we want to start an engineering manager to take the planned
phased architecture, and build out a complete and detailed set of tasks in a farm-table
collection we will set up just for this plan."

Also relevant: the current-state findings doc
(`/scion-volumes/scratchpad/projects/farmtable/auth-current-state.md`) and the already-
implemented/deployed IAP header fix
(`/scion-volumes/scratchpad/projects/farmtable/design-iap-token-header.md`, merged as PR
#136) — the IAP fix was effectively an early/urgent slice of this broader plan, so when you
build out the task DAG, consider whether it should be represented as an already-completed
task (marked done) within this collection for a complete historical record, or referenced/
linked some other way — use judgment, document your choice.

## Task

1. **Read the design doc in full**: `design-auth-improvements.md` — understand all 6 stages
   and their acceptance criteria.
2. **Create a new Farmtable collection** dedicated to this plan (`ft collection create` —
   check exact CLI syntax) with a clear name (e.g. "Auth Improvements").
3. **Build out the task DAG**:
   - One top-level task per design-doc stage (6 tasks), each with a clear description
     summarizing that stage's scope and acceptance criteria.
   - Break each stage down further into concrete, actionable subtasks (parent/child
     relationships) — detailed enough that a developer agent could pick one up and know
     what to build, not just a copy of the stage's one-line summary.
   - Set up BLOCKS/BLOCKED_BY relationships between stages/tasks reflecting real
     dependency order (e.g. stage 2 can't start until stage 1's foundational pieces are
     done) — don't just make everything sequential if the design doc indicates some stages
     or subtasks are actually independent/parallelizable.
   - Represent the already-completed IAP header fix (PR #136) appropriately per your
     judgment call above.
4. **Verify the result**: use `ft task list`/`ft task show`/the Dependency view (now
   fixed, or check with the coordinator if Feature 60 hasn't merged yet) to confirm the
   collection's task DAG looks sensible and complete — no orphaned tasks, no missing
   relationships, no contradictory dependencies (cycles).

## Key Locations

- Design doc: `/scion-volumes/scratchpad/projects/farmtable/design-auth-improvements.md`
- Current-state findings: `/scion-volumes/scratchpad/projects/farmtable/auth-current-state.md`
- IAP fix reference: `/scion-volumes/scratchpad/projects/farmtable/design-iap-token-header.md`
- IAP/Cloud Run access instructions: `/workspace/agents.md` (new section, read this for
  exact auth header usage)
- Decomposer (optional tool): `cmd/decomposer/`, `internal/decomposer/`
- Your scratchpad — create a running log:
  `/scion-volumes/scratchpad/projects/farmtable/auth-task-breakdown-log.md` documenting the
  collection ID, task structure decisions, and how you represented the completed IAP fix.

## Deliverables

1. A new Farmtable collection (on the live deployed instance) populated with a complete,
   well-related task DAG covering all 6 stages of the auth improvements plan.
2. The running log documenting your structure and decisions.
3. A message to the coordinator with the collection ID/URL, task count, and a summary of
   the structure (stages → subtasks → relationships) for tracking purposes.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Design questions: `scion message farmtable-architect-auth "<question>"` — that agent
  designed the plan and is available for clarification.
- Do not message ptone@google.com directly.

## Termination

You MUST create the collection, build out the full task DAG per the design doc, verify it,
produce the log, and message the coordinator with the collection details. Then signal
task_completed.
