# Brief: Engineering Manager — GitHub Passthrough Write-Through (3 Phases)

## Critical Constraints (read first)

- **You own the full implementation lifecycle across all 3 phases.** Spawn your own
  developers and reviewers directly — only contact the coordinator when a phase is
  approved/merged and ready, or you're genuinely blocked on something only the coordinator
  can resolve (infra, credentials, cross-project decisions).
- **Use a dedicated git worktree per phase**, not the shared `/workspace/farmtable`
  checkout: e.g. `git worktree add /workspace/farmtable-passthrough-write-p1 -b
  feat/passthrough-write-p1 origin/main` (standing policy — avoids branch collisions,
  especially since other workstreams may be active concurrently).
- **Use the local-first verification protocol** for your first round of verification on
  each phase — read `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
  Live-server verification happens at deploy time (the coordinator will dispatch that
  separately after each phase, or you can request it).
- **The design architect (`farmtable-architect-passthrough-write`) is still alive and
  available for design questions during implementation** — message it directly via `scion
  message farmtable-architect-passthrough-write "<question>"` if the design doc is unclear
  or you hit an edge case it didn't anticipate. Don't guess on ambiguous design intent when
  you can ask the person who designed it.
- **Only one agent runs at a time within a given phase.** Never run a developer and a
  reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create` per phase, message the
  coordinator when each phase is ready.
- **Reviewers must be blind** — fresh `code-reviewer` agent per review round, `--harness
  claude`.
- **Exit criteria per phase:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if
  only nitpicks remain. Hard cap 5 rounds per phase.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real screenshots/evidence required for every phase** — this project has a strong
  verification bar throughout its history; match it. Given this phase involves real writes
  to GitHub, be extra careful to verify against a TEST collection/repo, not
  scion-frontiers/farmtable's own production issues, unless the design doc specifically
  says otherwise — check with the architect if this isn't already addressed in the design.
- **The coordinator will NOT independently re-read your diffs or re-open your
  screenshots** — your own verification (and the blind reviewer's) is what stands.

## Context

`farmtable-architect-passthrough-write` finalized a design (approved by ptone@google.com)
for extending the existing READ-ONLY GitHub passthrough (External Store Passthrough
project, PRs #85-#104) to support writes that flow through to GitHub and are reflected back
via the read-through proxy.

- Design doc: `/scion-volumes/scratchpad/projects/farmtable/design-passthrough-write.md`
  (525 lines — read this fully, it's your spec).
- Current-state findings:
  `/scion-volumes/scratchpad/projects/farmtable/passthrough-write-current-state.md`
- Key insight from the architect: the backend write path already substantially exists
  (`PassThroughStore` + `MultiStore`) — most of the work is frontend UI gating. One small
  backend fix needed (assignee reverse lookup in `passthrough.go`).

## Phases (per the design doc — read it for full detail, this is a summary)

1. **Phase 1 (MVP)**: Unlock writes for writable GitHub collections, optimistic updates
   with a dirty-task guard, 15s sweep (presumably to reconcile/poll for conflicts — confirm
   exact mechanism in the design doc), a per-collection writable flag, and the assignee
   reverse-lookup bug fix in `passthrough.go`. Estimated ~1-2 days of design-implied scope.
2. **Phase 2**: Capability-based UI gating — per-operation flags and tooltips explaining
   why an operation isn't mappable to GitHub (e.g. relationships have no GitHub-native
   equivalent). Estimated ~1 day of design-implied scope.
3. **Phase 3**: Error handling (write-failure toasts), rate-limit awareness, and
   filling in missing write mappings (task type, labels). Estimated ~1-2 days of
   design-implied scope.

Implement and ship phases sequentially — each phase should be its own PR, merged and
(coordinator-)deployed before starting the next, since later phases build on earlier ones
and the user should get to try each increment.

## Key Locations

- Repo: base each phase off current `main` (which will include prior phases once merged) —
  fresh feature branch per phase, PR to merge.
- Backend: `internal/store/github/` (or wherever `PassThroughStore`/`passthrough.go` and
  `MultiStore` live), `proto/` if any new RPCs/fields are needed per the design.
- Frontend: `web/src/` — wherever B7's read-only UI gating lives (from the original
  passthrough project), which you'll be relaxing/extending.
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad — create a running log:
  `/scion-volumes/scratchpad/projects/farmtable/passthrough-write-implementation-log.md`
  (append progress per phase, decisions made, deviations from the design doc and why).

## Deliverables (per phase)

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real screenshots/evidence proving the phase's functionality (including a real
   write-to-GitHub-and-see-it-reflected-back round trip for Phase 1 specifically — this is
   the core value proposition, verify it for real against a test collection).
3. An entry in the running implementation log.
4. A message to the coordinator with PR URL, summary, review outcome, phase number.

## Direct Contact

- Design architect: `scion message farmtable-architect-passthrough-write "<question>"` for
  design clarifications.
- Coordinator: `scion message coordinator "<message>"` for phase-ready reports, or
  genuine blockers only you can't resolve.
- Do not message ptone@google.com directly — that's the architect's channel for this
  workstream, not yours.

## Termination

You own this until all 3 phases are implemented, reviewed, and merged. Message the
coordinator after EACH phase merges (don't batch all 3 into one final report — the
coordinator needs to deploy and the user needs to try each increment). Signal
task_completed only after Phase 3 is fully merged and reported.
