# Brief: Architect — Explore Write-Through Support for GitHub Passthrough

## Critical Constraints (read first)
- **This is an open-ended design exploration, not a scoped implementation task.**
  ptone@google.com wants to explore what's involved in extending the existing GitHub
  passthrough from read-only to read-write with you directly.
- **Contact ptone@google.com directly** via `scion message --non-interactive ptone@google.com
  --channel discord --thread-id 1528900732965748836 "<message>"` (this is the project's
  main Discord thread) for the discussion itself — the coordinator is not a conduit for
  this conversation. Only message the coordinator for infra-level blockers or to report a
  milestone (e.g. "design doc finalized, ready for implementation phase").
- Use a dedicated git worktree if you need to inspect the repo:
  `git worktree add /workspace/farmtable-passthrough-write -b explore/passthrough-write
  origin/main` (standing policy — avoids branch collisions with other in-flight work).
- Do not implement anything yet — this is investigation + design discussion. If/when a
  concrete plan emerges, the coordinator will dispatch an EM to implement it (likely
  phased, given the existing passthrough project was itself a 21-task, multi-phase effort).
- You are a long-lived agent for this workstream — stay alive across the discussion, don't
  self-terminate after one exchange. The coordinator will not delete you without the user's
  explicit confirmation once this workstream is inactive (same standing rule as
  `farmtable-architect-decomposer` and `farmtable-architect-auth`).

## Context

The External Store Passthrough project (PRs #85-#104, 21 tasks) built READ-ONLY passthrough
for GitHub-backed collections: `MultiStore`/`PlatformResolver` lazily construct a
`PassThroughStore` per external collection, `LinkedAccount` holds the platform credential
(GitHub PAT), an ephemeral SQLite cache serves graph queries (`C3`/`C4`), and the web UI
enforces read-only mode for external collections (`B7`, PR #104) — this last part is
exactly what ptone@google.com now wants to relax for writes.

Relevant docs (read before talking to the user, don't assume these are exhaustive):
- Original design: check the scratchpad for the passthrough design doc(s) from that
  project (search `/scion-volumes/scratchpad/projects/farmtable/` for passthrough/external
  store design docs).
- `internal/store/github/` (or wherever the GitHub platform resolver lives) —
  `NewPlatformResolver()`, wired into `cmd/farmtable-server/main.go` per PR #107.
- `web/src/` — wherever `B7`'s read-only enforcement lives (collection selector, task
  editing UI gating).
- The dogfooding friction log from that project:
  `/scion-volumes/scratchpad/projects/farmtable/reports/passthrough-dogfood-friction-log.md`
  — may have relevant notes on what was deliberately deferred/out-of-scope at the time.

## Task

ptone@google.com's ask (verbatim): "explore what would be involved to have the pass through
to github be not only read only. should be possible to have writes go to the platform
(github) and be reflected in the read through proxy."

1. **Investigate the current architecture thoroughly** before proposing anything: exactly
   how does a read flow through today (GitHub API → ephemeral SQLite cache → graph query →
   UI)? What would a write need to do differently — write directly to GitHub's API (e.g.
   creating/updating a GitHub issue when a Farmtable task is edited), then either (a)
   invalidate/refresh the ephemeral cache so the read-through reflects it, or (b)
   optimistically update the local cache and reconcile on next poll?
2. Identify the real design challenges: GitHub API rate limits for writes, mapping
   Farmtable's task fields back to GitHub issue fields (inverse of whatever read-mapping
   exists), conflict handling (what if the GitHub issue changed since last poll —
   last-write-wins? merge? reject?), what subset of Farmtable operations should map to
   GitHub writes at all (task creation → new issue? phase change → labels/state? comments →
   issue comments? relationships → ??? GitHub has no native "blocked by" concept),
   authentication/permissions (does the LinkedAccount's PAT have write scope? need a new
   scope prompt?), and how this interacts with `B4`'s WatchTasks guard and `B8`'s
   poll-on-interval refresh (PRs #98, #103) which currently assume external collections
   are read-only.
3. **Open the discussion with ptone@google.com on the main Discord thread** — share your
   understanding of the current read-path architecture and the design challenges above, and
   ask clarifying questions about scope (which task fields/operations should support
   write-through first? is eventual consistency via polling acceptable, or does this need
   to feel synchronous?). Don't assume — let them shape priorities.
4. Iterate with them as needed. When/if a concrete direction solidifies, write it up as a
   phased design doc (this is very likely to need phasing, given the original read-only
   passthrough project was itself substantial).

## Deliverables
1. A findings doc on the current read-path architecture and what write-through would
   require: `/scion-volumes/scratchpad/projects/farmtable/passthrough-write-current-state.md`
2. (Once direction is clear) a design doc:
   `/scion-volumes/scratchpad/projects/farmtable/design-passthrough-write.md`
3. Ongoing direct communication with ptone@google.com on Discord thread
   `1528900732965748836`.
4. A message to the coordinator once a concrete implementation-ready plan exists (or if you
   hit an infra/tooling blocker only the coordinator can resolve).

## Direct Contact
- ptone@google.com: `scion message --non-interactive ptone@google.com --channel discord
  --thread-id 1528900732965748836 "<message>"` — this is your primary communication
  channel for this workstream.
- Coordinator: `scion message coordinator "<message>"` for infra blockers or milestone
  reports only.

## Termination
This is a long-lived discussion/design agent — do not signal task_completed after the
first exchange. Stay available for follow-up. Signal task_completed only if/when
ptone@google.com or the coordinator explicitly tells you this workstream is closed.
