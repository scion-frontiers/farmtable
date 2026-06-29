---
name: farmtable
description: >
  Farm Table task tracking for agents. Use when asked to check tasks, show
  what's ready to work on, create a task, claim a task, track this work, update
  task status, close work, inspect dependencies, or manage farmtable tasks.
allowed-tools: "mcp__farmtable__task_list,mcp__farmtable__task_get,mcp__farmtable__task_create,mcp__farmtable__task_update,mcp__farmtable__task_claim,mcp__farmtable__task_close,mcp__farmtable__task_search,mcp__farmtable__task_tree,mcp__farmtable__task_ready,mcp__farmtable__task_critical_path"
compatible-with: [claude-code]
tags: [task-management, farmtable, mcp, agents]
---

# Farm Table

Farm Table is the project task tracker. Use the configured `farmtable` MCP
server instead of shelling out to `ft` when managing tasks.

## Core Workflow

1. `task_ready` - find unblocked work before claiming anything.
2. `task_get` - read the full task, including comments and change history when useful.
3. `task_claim` - atomically assign the task and move it to `working`.
4. Work the task, using `task_update` for status or metadata changes.
5. `task_close` - close completed work, defaulting to `completed`.

See [workflow.md](resources/workflow.md) for the full agent workflow and
[task-fields.md](resources/task-fields.md) for field values.

## Task Model

- **Phase**: `OPEN` for active work, `CLOSED` for done or terminal work.
- **Stages**: `triage`, `backlog`, `ready`, `working`, `in_review`, `in_qa`,
  `deploying`, `blocked`, `waiting_for_input`, `deferred`, `scheduled`,
  `completed`, `wont_fix`, `duplicate`, `cancelled`.
- **Priorities**: `URGENT`, `HIGH`, `NORMAL`, `LOW`.

## Identity

When claiming or assigning work, use the current Scion agent identity:

```bash
scion whoami --format json | jq -r '.id // "unknown"'
```

Prefer `task_claim` over `task_update` for starting work because claiming is
atomic and prevents two agents from taking the same task.

## Commands

| Command | Purpose |
|---------|---------|
| [list](commands/list.md) | List and filter tasks |
| [ready](commands/ready.md) | Show unblocked work and offer to claim |
| [claim](commands/claim.md) | Atomically claim a task |
| [create](commands/create.md) | Create a task interactively |
| [update](commands/update.md) | Update task fields |
| [close](commands/close.md) | Close completed work |
| [get](commands/get.md) | Show full task details |
| [tree](commands/tree.md) | Show dependency tree |
