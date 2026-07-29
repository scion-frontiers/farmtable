---
description: Show full Farm Table task details
argument-hint: [task-id] [--comments] [--changes]
---

Fetch full task details with `task_get`.

Include comments and changes when the user asks for history, context recovery,
or why a task is in its current state. Otherwise, fetch the base task details.

Summarize:

- Name, id, phase, stage, priority, and type
- Assignees and labels
- Description
- Parent and dependency links
- Recent comments or changes when requested
