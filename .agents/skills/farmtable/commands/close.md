---
description: Close a completed Farm Table task
argument-hint: [task-id] [stage]
---

Close a task with `task_close`.

If the task id is missing, ask for it. Default the close stage to `completed`
unless the user specifies another terminal stage:

- `completed`
- `wont_fix`
- `duplicate`
- `cancelled`

Before closing, verify the work is actually done or the terminal reason is
clear. After closing, show confirmation and suggest checking `task_ready` for
newly unblocked work.
