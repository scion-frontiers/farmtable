# Farm Table Agent Workflow

## Standard Loop

1. **Find available work**: call `task_ready` before claiming anything.
2. **Inspect context**: call `task_get` for the selected task. Include comments
   and changes when resuming work or diagnosing status.
3. **Claim atomically**: call `task_claim` with the current Scion identity. This
   assigns the task and moves it to `working`.
4. **Work the task**: update stage or metadata with `task_update` when the task
   becomes held, waits for input, enters review, or changes scope.
5. **Close**: call `task_close` when done, defaulting to `completed`.
6. **Check for unblocked follow-up**: call `task_ready` again after closing.

## Claiming Protocol

Use the current Scion agent id as the assignee:

```bash
scion whoami --format json | jq -r '.id // "unknown"'
```

Prefer `task_claim` over a manual `task_update` because it is atomic.

## Status Handoffs

- Use `hold_reason=waiting_for_input` when the user must decide something.
- Use `hold_reason=deferred` when work is intentionally postponed without a
  concrete future `start_date`.
- Use `in_review`, `in_qa`, or `deploying` for handoffs after implementation.
- Use terminal close stages only through `task_close`.

## Dependency Hygiene

Use `blocked_by` for prerequisites and `blocks` for downstream tasks. Use
`task_tree` or `task_critical_path` when dependency order is unclear.
