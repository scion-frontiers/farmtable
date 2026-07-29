# Farm Table Task Fields

## Phase

- `OPEN`: active, visible work.
- `CLOSED`: completed or terminal work.

## Stages

Open-stage values:

- `triage`: new work that needs review.
- `accepted`: accepted work that is eligible for ranking and availability checks.
- `working`: actively being worked.
- `in_review`: implementation complete, awaiting review.
- `in_qa`: awaiting QA.
- `deploying`: in deployment or release flow.

Closed-stage values:

- `completed`: done.
- `wont_fix`: intentionally not fixed.
- `duplicate`: duplicate of another task.
- `cancelled`: no longer needed.

## Hold Reasons

- `waiting_for_input`: accepted or active work needs user or stakeholder input.
- `deferred`: accepted or active work is intentionally postponed without a
  concrete future `start_date`.

## Priorities

- `URGENT`: immediate attention.
- `HIGH`: important and time-sensitive.
- `NORMAL`: default priority.
- `LOW`: lower-impact or opportunistic work.

## Types and Labels

Use the project's existing type and label conventions when present. Common
labels include `feature`, `bug`, `refactor`, `review`, `design`, `test`,
`infra`, and `docs`.

## Dependencies

- `blocks`: tasks this task prevents from starting or finishing.
- `blocked_by`: tasks that must complete before this task is ready.
- `parent`: parent task or larger work item.
