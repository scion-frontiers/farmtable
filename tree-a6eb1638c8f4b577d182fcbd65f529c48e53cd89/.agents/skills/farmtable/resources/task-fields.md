# Farm Table Task Fields

## Phase

- `OPEN`: active, visible work.
- `CLOSED`: completed or terminal work.

## Stages

Open-stage values:

- `triage`: new work that needs review.
- `backlog`: accepted but not ready.
- `ready`: ready for an agent to claim.
- `working`: actively being worked.
- `in_review`: implementation complete, awaiting review.
- `in_qa`: awaiting QA.
- `deploying`: in deployment or release flow.
- `blocked`: cannot proceed because of a blocker.
- `waiting_for_input`: needs user or stakeholder input.
- `deferred`: intentionally postponed.
- `scheduled`: planned for a future time.

Closed-stage values:

- `completed`: done.
- `wont_fix`: intentionally not fixed.
- `duplicate`: duplicate of another task.
- `cancelled`: no longer needed.

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
