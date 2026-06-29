---
description: Show unblocked tasks ready to work on
argument-hint: [--assignee] [--label] [--limit]
---

Find tasks that are ready to start.

Call `task_ready` to get unblocked tasks. Present:

- Task id
- Name
- Priority
- Type
- Labels

If the user wants to start one, call `task_get` for context, then `task_claim`
with the user's Scion agent identity. If no tasks are ready, suggest checking
blocked work with `task_list` or creating a new task with `task_create`.
