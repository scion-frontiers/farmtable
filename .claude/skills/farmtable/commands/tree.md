---
description: Show a Farm Table task dependency tree
argument-hint: [task-id]
---

Show dependency context for a task.

Call `task_tree` for the requested task id. Use `task_critical_path` when the
user asks what determines the longest path, what to do first, or why delivery is
blocked.

Present dependencies in a readable outline with task id, name, stage, and
priority. Call out blocked or incomplete ancestors before downstream work.
