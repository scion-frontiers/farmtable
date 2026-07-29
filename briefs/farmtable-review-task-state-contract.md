# Brief: Independent Review — Task State Model Design Contract

## Critical Constraints (read first)
- This is a DESIGN DOCUMENT review, not a code review — but treat the code-citation claims
  in it with the same rigor as a code review. Do not accept any "file:line" citation at
  face value; open the file and confirm the line actually says what's claimed.
- Read-only task. Do not modify the contract document yourself — report findings, the
  coordinator will route fixes back to the authoring agent if needed.

## Key Locations
- Document under review: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
- Original brief it was written against (contains the full acceptance criteria):
  `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-architect-task-state-contract.md`
- Primary source of truth it's supposed to represent:
  `/scion-volumes/scratchpad/projects/farmtable/notes/task-state-model-cphase-decisions.md`
- Codebase: `/workspace/farmtable`

## Task
1. Read the design contract document in full.
2. Read the original brief's "Acceptance Criteria For The Contract" section and check the
   document against EVERY item on that list explicitly. Report pass/fail per item.
3. Spot-check every file:line citation in the "Current-Code Evidence" section (and any
   scattered elsewhere in the doc) against the actual current code in `/workspace/farmtable`.
   Report any citation that is wrong, stale, or doesn't support the claim made.
4. Cross-check the document against `task-state-model-cphase-decisions.md` — is every
   settled decision from that note actually represented in the contract? Flag anything
   missing, contradicted, or reopened without justification (the brief explicitly forbids
   reopening settled decisions absent hard code-evidence contradiction).
5. Apply the brief's own "Suggested Review Stance": check for accidental vocabulary
   survival risk — does the contract's migration section actually account for every place
   `ready`/`blocked`/`scheduled`/`phase`-as-native-UX could hide (CLI enums, MCP schema, web
   column definitions, colors/labels, import/export tables, tests)? Does it distinguish
   query-only guarantees from real API-boundary enforcement (e.g., can ClaimTask bypass
   computed availability by ID per the doc's own stated design)?
6. Evaluate whether the "Unresolved Questions" section is appropriately tight (per the
   brief: "limited to genuine design-time blockers," not a dumping ground) or whether it's
   dodging decisions the brief actually asked to be settled.
7. General quality/internal-consistency check: does the migration section, API contract,
   and CLI/MCP section actually agree with each other and with the persisted data model
   section (no contradictions)?

## Deliverables
1. A review report at `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-contract.md`
   with: a per-acceptance-criterion pass/fail table, a list of any inaccurate/unverifiable
   code citations (with the correct file:line if you find it), any missing/contradicted
   decisions from the source note, and an overall verdict (APPROVE / APPROVE WITH
   FOLLOW-UPS / REQUEST CHANGES).
2. A message to the coordinator with the verdict and a one-paragraph summary.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for the verdict or any question.

## Termination
You MUST review the full document against the brief's acceptance criteria, verify code
citations against real source, check decision-note coverage, and produce the report with an
explicit verdict. Then signal task_completed.
