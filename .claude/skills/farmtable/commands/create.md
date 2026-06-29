---
description: Create a Farm Table task interactively
argument-hint: [name] [type] [priority]
---

Create a task with `task_create`.

If details are missing, ask only for the fields needed to create a useful task:

1. Name, required.
2. Description, optional but recommended for non-trivial work.
3. Type, default `task`.
4. Priority, default `NORMAL`.
5. Stage, default `triage` unless the user says it is ready.
6. Labels, parent, due date, blocks, or blocked_by when relevant.

Use dependency fields explicitly:

- `blocks`: tasks this new task blocks.
- `blocked_by`: tasks that must finish before this task is ready.

After creation, show the new task id and key fields.
