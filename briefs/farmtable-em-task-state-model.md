# Brief: EM — Task State Model Refactor, Full Implementation Lifecycle

## Critical Constraints (read first)
- You own the full implementation lifecycle for this refactor. Spawn your own developers
  and reviewers, route feedback, retry until approved. Only contact the coordinator when a
  phase is approved and ready to deploy, or you are genuinely blocked on something only the
  coordinator can resolve (e.g. a cross-project decision, a live production risk, or a
  design-contract ambiguity that isn't resolvable from the contract itself).
- Dedicated git worktree per workstream/phase (`git worktree add /workspace/farmtable-<slug>
  -b <branch> origin/main`), never a direct checkout in the shared `/workspace/farmtable`.
- This is a HIGH blast-radius change: it touches the core data model, API, CLI, MCP, web
  UI, and every external adapter (GitHub pass-through, mirrored GitHub sync, Beads) at once.
  Treat it with the same diligence as the recent Auth Stage 4 workstream (see
  `.design/project-log/auth-stage4-scope-extension.md` and the review reports under
  `/scion-volumes/scratchpad/projects/farmtable/reports/review-scope-ext*.md`,
  `review-deploy-v*.md` for the bar this project holds for high-risk changes): every phase
  needs a genuine INDEPENDENT review before merge — do not self-review, and do not accept a
  reviewer's "ship it" if it hasn't verified claims against real evidence (running tests,
  reading actual diffs, checking real citations) rather than trusting a dev's self-report.
- The design contract explicitly flags "accidental vocabulary survival" as the highest risk
  area (deleted stage values surviving through labels, color tables, import/export maps,
  CLI completions, MCP schemas, generated TypeScript types, kanban columns, tests, docs).
  Hold every phase to this standard: a stage isn't really removed until NO code path can
  produce or interpret it as a native asserted value anymore (deriving/reading it for
  wire-compatibility projection is fine, per the contract's `phase` rules).
- Local-build-first Playwright verification protocol applies (see
  `HANDOFF-METHODOLOGY.md`/`local-test-protocol.md` if present, or ask the coordinator) —
  reserve live Cloud Run checks for what only real infra can prove.

## Key Locations
- **Authoritative design contract (the spec you're implementing)**:
  `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
  — this has been through 2 rounds of independent review and is APPROVED. Follow it
  exactly; do not reopen settled decisions without a hard code-evidence contradiction (and
  if you find one, flag it to the coordinator rather than unilaterally deviating).
- Original architect brief (context on rationale, non-goals, review stance):
  `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-architect-task-state-contract.md`
- Primary product-decision source (background only, contract is authoritative):
  `/scion-volumes/scratchpad/projects/farmtable/notes/task-state-model-cphase-decisions.md`
- Independent review reports on the contract (useful for understanding what was
  scrutinized and why):
  `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-contract.md`
- Codebase: `/workspace/farmtable`

## Implementation Phases (per the contract's Section 13)
Follow this order — each phase should get its own dev/review cycle and should be reported
to the coordinator as a discrete milestone when merged (not bundled):

1. **Core data / API / CLI / MCP implementation** — persisted primitives, computed
   availability, transition/claim/accept/close semantics, migration execution, CLI/MCP
   vocabulary updates. This is the highest-risk phase (data migration + API contract
   changes) — budget the most review scrutiny here.
2. **Web UI implementation** against the now-stable contract (remove native phase/Ready/
   Blocked controls, hold-reason display, computed-availability indicators, attention view
   for blocked-by-unsuccessful-terminal dependents, drag/drop rank semantics).
3. **User/process documentation polish** (README, docs/architecture.md, agents.md, MCP/CLI
   help text) — the contract's Section 11 already specifies the process rules that must
   exist earlier; this phase is about finished user-facing docs, not the process rules
   themselves.

Do not skip straight to web UI before core data/API is merged and deployed — the contract
explicitly calls out that web UI needs stable server-computed availability semantics to
build against.

## Deliverables
1. Each phase merged to `main` via its own PR(s), independently reviewed and approved.
2. Migration executed and verified with real evidence (not just "should work") — the
   contract's migration section has explicit source/destination rules; verify actual data
   transformations against a real or realistic test dataset, not just unit tests of the
   mapping function in isolation.
3. A completion report per phase to the coordinator: what shipped, PR links, review
   verdicts, and any deviations from the contract (with justification).
4. Before deploying core data/API changes to the live Cloud Run service: flag to the
   coordinator explicitly, since this changes stored data shape and API contracts for an
   already-live service with real collections (including this project's own farmtable
   usage) — same "confirm live and healthy before the risky step" pattern used for the auth
   token rollout.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — for phase-completion reports,
  genuine blockers, or contract ambiguities you can't resolve yourself.
- ptone@google.com requested this work (discord thread 1528900732965748836) — you do not
  need to contact ptone directly unless you hit a product decision the contract and its
  "Unresolved Questions" section don't cover; route those through the coordinator first.

## Termination
You own this until all 3 implementation phases are merged, independently reviewed,
deployed, and verified live. Report each phase's completion to the coordinator as it
lands. Do not mark yourself done until the final documentation phase is also complete —
this is a standing workstream, not a one-shot task.
