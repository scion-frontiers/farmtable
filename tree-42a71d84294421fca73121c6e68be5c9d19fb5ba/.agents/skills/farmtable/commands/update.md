---
description: Update Farm Table task fields
argument-hint: [task-id] [field] [value]
---

Update a task with `task_update`.

If arguments are missing, ask for the task id, field, and new value. Valid
updates include name, description, stage, hold_reason, priority, type,
assignees, labels, parent, due date, blocks, and blocked_by.

Use stage changes intentionally:

- `in_review`, `in_qa`, or `deploying` for handoff stages.
- `completed`, `wont_fix`, `duplicate`, or `cancelled` only when closing work.

Use hold reasons intentionally:

- `waiting_for_input` when a user decision is required.
- `deferred` when work is intentionally postponed without a concrete
  future `start_date`.

Do not use `task_update` to start work when `task_claim` is appropriate.
Confirm the updated task after the tool call.
