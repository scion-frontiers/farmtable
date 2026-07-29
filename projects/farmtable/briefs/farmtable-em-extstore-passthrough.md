# Brief: Engineering Manager — External Store Passthrough Implementation (+ Dogfooding Retrospective)

## Critical Constraints (read first)

- **Harness note (updated 2026-07-20 19:59):** the project's default harness was just
  reset to Claude because the codex harness hit quota limits. Spawn developer agents with
  NO `--harness` flag (`scion start <name> --type developer <task>`) — they'll inherit
  whatever the current project default is. Do not hardcode `--harness codex` (it's
  quota-exhausted right now) or `--harness claude` explicitly on developers unless the
  coordinator tells you otherwise — just take the default. Reviewers stay explicitly
  `--harness claude` on `code-reviewer` agents as usual.
- **PRIME DIRECTIVE: get the feature built.** The dogfooding experiment and friction log
  described below are real, required deliverables — but never let them compromise actually
  shipping the design. If an experiment is slowing you down, stop it and fall back to
  whatever gets tasks merged, then note that in the friction log.
- **You do NOT merge anything.** For every PR (there will be many across this project —
  one per task or batched, your call), push, open the PR, message the coordinator. The
  coordinator merges. Don't let PRs pile up unreported — message as each is ready, don't
  wait to batch-report at the very end.
- **Reviewers must be blind** — fresh `code-reviewer` agent per PR/round
  (`--harness claude`), zero knowledge of prior review feedback.
- **Exit criteria per PR:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpick/minor findings remain. Hard cap 5 rounds per PR.
- **Screenshots/evidence required for anything UI-visible**, same rigor as the rest of this
  project — real Playwright screenshots via genuine interaction, md5sum-verified, no
  `page.evaluate()` faking. For backend-only work, real build/test output is the
  equivalent evidence. The coordinator has repeatedly sent work back for missing evidence
  — don't be the one that gets sent back for skipping this.
- **Use git worktrees for parallel task execution.** A prior experiment
  (`/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`) validated
  running multiple developer agents in parallel on this repo via sibling worktrees
  (`git worktree add /workspace/farmtable-<taskid>-<slug> -b <branch> origin/main`). The
  task DAG (see below) has explicit parallel "waves" — Wave 1 alone has 8 tasks with no
  blockers. Use this to move fast: dispatch multiple developers in parallel on
  same-wave tasks that don't touch the same files (check the task descriptions for file
  overlap first — if two tasks in the same wave touch the same file, either sequence them
  or accept a rebase-conflict resolution step like Feature 19 hit). Don't force
  parallelism where it'll just create conflict overhead — use judgment per wave.
- **The coordinator will NOT independently re-read your diffs or re-open your
  screenshots/transcripts** — your own verification is what stands.
- **Give the coordinator periodic progress updates** (e.g. after each phase, or every
  handful of merged tasks) — this is a large, long-running project; don't go silent for
  extended periods. A short "phase A done, N tasks merged, starting phase B" ping is fine.

## Context

You're implementing the design at
`/scion-volumes/scratchpad/projects/farmtable/design-external-store-passthrough.md` —
adding external task-store (e.g. GitHub issues) support to Farmtable via a server-side
passthrough mechanism, ephemeral SQLite caching, and graph query routing.

This design has ALREADY been decomposed into a real task DAG — do NOT re-decompose it
yourself. The work breakdown (24 tasks: 3 phase-parent epics + 21 leaf tasks, with precise
BLOCKS/BLOCKED_BY dependencies and parallel-wave groupings) lives BOTH as a readable
document and as real, live tasks on the deployed Farmtable server itself:
- Readable index: `/scion-volumes/scratchpad/projects/farmtable/reports/design-passthrough-task-breakdown.md`
  (has exact task IDs, titles, scope, dependencies, and the wave/critical-path structure).
- **Live collection**: `External Store Passthrough`
  (id `5d1e4eea-3dc7-4958-99ac-01e3372c5a0d`) on the deployed Cloud Run service:
  `https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=5d1e4eea-3dc7-4958-99ac-01e3372c5a0d`

## The Dogfooding Exercise (required, alongside actually building the feature)

Use the `ft` CLI against that live collection as your own real project-tracking tool for
this work — this is Farmtable managing the work of building Farmtable's next feature.
Get the token the same way deploy briefs do:
`TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)`,
`export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443`.

As you work through the DAG:
- Update task status via `ft` as work progresses (claim/start a task, mark it done when its
  PR merges, etc.) — use whatever status/stage transitions the CLI actually supports.
- **Experiment with two interaction modes** across the course of the project and compare
  them in your retrospective:
  1. **You as sole interactor**: you run all `ft` commands yourself to track state on
     behalf of the developers you spawn (they just implement, you track).
  2. **Delegated updates**: for at least a few tasks, give a developer agent the specific
     task ID it's assigned (from the live collection) and have THAT agent run `ft`
     commands itself to update its own task's status as it completes work — i.e., the
     developer directly interacts with Farmtable, not just you.
- You don't need to run every single one of the 24 tasks through both modes — a genuine,
  reasonably-sized comparison (e.g. several tasks each way) is enough to form real opinions.

## Deliverables

1. **The feature, actually built and merged** — as much of the 24-task DAG as you can
   reasonably complete (all of it is the goal; if something turns out much harder than
   scoped, say so explicitly rather than silently dropping it). Follow the DAG's
   dependency order — respect BLOCKED_BY relationships, don't start a task before its
   blockers are actually merged to main.
2. **A beta-user friction log** at
   `/scion-volumes/scratchpad/projects/farmtable/reports/passthrough-dogfood-friction-log.md`
   — a genuine retrospective on using the `ft` CLI as a real user managing real work:
   - What worked well (be specific — which commands, which output formats, which
     workflows felt natural).
   - What didn't work well (confusing flags, missing commands you wished existed, output
     that was hard to parse or act on, anything that broke your flow).
   - A direct comparison of the two interaction modes (sole-interactor vs. delegated) —
     which worked better and why, concrete examples from what actually happened.
   - Any concrete CLI/UX improvement suggestions this surfaces (this feeds back into the
     project's own backlog — be a real beta user, not diplomatic).
3. Standard per-PR deliverables (screenshots/evidence, feature logs) following this
   project's established conventions — see prior feature logs under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/` for the format.
4. Progress messages to the coordinator as described above, and a final summary when the
   full DAG (or as much as achievable) is merged.

## Key Locations

- Design doc: `/scion-volumes/scratchpad/projects/farmtable/design-external-store-passthrough.md`
- Task breakdown (IDs, dependencies, waves): `/scion-volumes/scratchpad/projects/farmtable/reports/design-passthrough-task-breakdown.md`
- Live task collection: `5d1e4eea-3dc7-4958-99ac-01e3372c5a0d` on
  `farmtable-qo7k5fvpda-uc.a.run.app:443`
- Repo: `/workspace/farmtable`, base off current `main` (includes PR #78, the tree-view
  fix). Use worktrees per the constraint above.
- Prebuilt `ft` CLI reference (may be stale, check/rebuild if needed):
  `/workspace/agents.md`
- This project's established EM/dev/reviewer conventions and brief format: any recent
  brief under `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-em-f*.md` —
  mirror this structure for the sub-briefs you write for your own developers.
- Worktree pattern reference: `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for PR-ready reports, progress
  updates, blockers, or quota-concern reports. Do not message ptone@google.com directly.

## Termination

This is a large, multi-task project — do not expect to finish in one sitting. Keep working
through the DAG, reporting PRs as they're ready and progress periodically, until the full
design is implemented (or you hit a genuine blocker worth escalating). Produce the friction
log once you've done enough of the dogfooding exercise to write it honestly — this can
happen before full completion if you have enough material, but update it if your view
changes later. Signal task_completed only once the feature is substantially complete and
the friction log is delivered.
