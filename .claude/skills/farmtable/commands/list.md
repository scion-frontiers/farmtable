---
description: List and filter Farm Table tasks
argument-hint: [--stage] [--phase] [--priority] [--type] [--assignee] [--label] [--limit]
---

List Farm Table tasks with optional filters.

Use the `task_list` MCP tool. Apply only filters the user requested, and default
to active work when the user asks broadly for current tasks.

## Common Filters

- `phase`: `OPEN` or `CLOSED`
- `stage`: task stage such as `ready`, `working`, or `blocked`
- `priority`: `URGENT`, `HIGH`, `NORMAL`, `LOW`
- `labels`: one or more labels
- `assignee`: agent or user id
- `parent`: parent task id
- `limit`: cap results for readable output
- `sort` / `order`: use when the user asks for priority or recency ordering

## Output

Show task id, name, stage, priority, assignee, and labels. If the list is long,
summarize counts by stage and show the highest-priority items first.
