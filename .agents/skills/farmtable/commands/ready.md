---
description: Show available tasks ready to work on
argument-hint: [--assignee] [--label] [--limit]
---

Find accepted tasks that are available to start.

Call `task_ready` to get available accepted tasks. Present:

- Task id
- Name
- Priority
- Type
- Labels

If the user wants to start one, call `task_get` for context, then `task_claim`
with the user's Scion agent identity. If no tasks are available, suggest
checking held or blocked work with `task_list` or creating a new task with
`task_create`.
