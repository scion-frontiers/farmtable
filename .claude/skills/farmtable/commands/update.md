---
description: Update Farm Table task fields
argument-hint: [task-id] [field] [value]
---

Update a task with `task_update`.

If arguments are missing, ask for the task id, field, and new value. Valid
updates include name, description, stage, priority, type, assignees, labels,
parent, due date, blocks, and blocked_by.

Use stage changes intentionally:

- `blocked` when work cannot proceed.
- `waiting_for_input` when a user decision is required.
- `in_review`, `in_qa`, or `deploying` for handoff stages.
- `deferred` or `scheduled` when work is intentionally postponed.

Do not use `task_update` to start work when `task_claim` is appropriate.
Confirm the updated task after the tool call.
