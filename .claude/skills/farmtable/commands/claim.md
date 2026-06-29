---
description: Atomically claim a Farm Table task and move it to working
argument-hint: [task-id]
---

Claim a task for the current agent.

If the task id is missing, use `task_ready` first and ask which task to claim.
Before claiming, call `task_get` so the agent has the full task context.

Use `task_claim` rather than `task_update`; it atomically assigns the task and
moves it to `working`.

Use the current Scion agent identity as the assignee:

```bash
scion whoami --format json | jq -r '.id // "unknown"'
```

After claiming, show the task id, name, stage, and assignee.
