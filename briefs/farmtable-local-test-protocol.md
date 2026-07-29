# Brief: Design a Local-Build-First Playwright Testing Protocol

## Critical Constraints (read first)
- Use a dedicated git worktree if you need to touch the repo for investigation:
  `git worktree add /workspace/farmtable-localtest -b explore/local-test-protocol origin/main`
  (standing policy — avoids branch collisions with other in-flight work).
- This is a process/methodology task: investigate + write a protocol doc + update the
  project's methodology doc. It is NOT a feature implementation — do not open a PR for
  application code changes unless you find a small, genuinely necessary fix (e.g. a missing
  npm script or docker-compose file) that directly unblocks the protocol. If you find one,
  say so and ask the coordinator before proceeding with a PR.
- The coordinator will NOT independently re-read your investigation in depth — your
  written protocol doc is what stands. Be concrete and actionable, not theoretical.

## Context
ptone@google.com asked (2026-07-21 22:34, verbatim): "Should we work up a protocol for
agents to also test by building the web local to their environment and using playwright
there first? Live server test is also good, but we should have a shorter validation path
with a local build."

This is a real, recurring pain point in this project's history:
- Multiple feature EMs (Feature 39's dev most recently) have hit friction where the LOCAL
  Go server needs Postgres to run, so local Playwright screenshots end up empty/app-shell-only
  (no real task data), forcing reliance on the LIVE Cloud Run URL for meaningful
  verification screenshots — which is slower (requires a full build+deploy cycle) and
  riskier (verifying against production).
- There IS a local SQLite test database already in the scratchpad from earlier in this
  project: `web-test/farmtable.db` (confirmed present, 7 tables, real task data) — ported
  over specifically for local testing purposes. It's unclear whether/how the current
  Go server (`cmd/farmtable-server/main.go`) can be pointed at SQLite instead of Postgres,
  or whether a docker-compose Postgres setup already exists for fast local spin-up.

## Task
1. Investigate what's actually needed to run `cmd/farmtable-server` locally with real data
   for Playwright testing, fast:
   - Can the Go server run against SQLite (check `internal/store/` / Ent config for
     driver flexibility), using `web-test/farmtable.db` or a similar seed DB?
   - Is there a docker-compose Postgres setup anywhere in the repo already (check for
     `docker-compose.yml`, `Makefile`, `.design/` dev-setup docs)?
   - What exact steps does a fresh agent currently need to do to get `main` +
     `cmd/farmtable-server` + `web/` running locally with a working dev server AND real
     task data, from a clean worktree checkout? Try it yourself and time it.
   - What's the fastest reliable path? (Prefer SQLite-with-seed-data if the server supports
     it — it avoids needing Postgres at all, which is the single biggest source of friction
     seen so far.)
2. Design a concrete protocol: "Local-first verification" — every dev/reviewer agent should
   default to building `web/` locally, running the server locally against seed data
   (SQLite or lightweight Postgres, whichever you find works), and using Playwright against
   `localhost` for their FIRST round of verification screenshots — before/in addition to
   any live-server verification the EM/coordinator decides is also needed for a given
   feature.
   - Include exact commands (build, run server, seed data, launch Playwright) an agent can
     copy-paste.
   - Note what's still worth verifying against the LIVE site afterward (e.g., anything
     that depends on real Cloud Run infra — auth, actual external GitHub data via
     passthrough, actual deployed CSS/build artifacts) vs. what local-only verification
     fully covers (most UI/layout/interaction features).
3. Write this up as a new section in
   `/scion-volumes/scratchpad/projects/farmtable/HANDOFF-METHODOLOGY.md` (read the existing
   doc first, match its style, add rather than restructure) titled something like "Local
   Verification Protocol", plus a standalone reference doc if useful:
   `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.

## Deliverables
1. Updated `/scion-volumes/scratchpad/projects/farmtable/HANDOFF-METHODOLOGY.md` with the
   new protocol section.
2. `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md` — standalone,
   copy-paste-able quick reference (exact commands).
3. A short report to the coordinator: what you found blocking local testing today, what the
   new protocol is, and whether any small infra fix (docker-compose file, seed script, npm
   script) is needed to make it work — call this out explicitly if so, don't silently add
   one without asking.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports, or
  if you find a small infra fix is needed and want to confirm before opening a PR.
- Do not message ptone@google.com directly.

## Termination
You MUST produce both docs and the report to the coordinator, then signal task_completed.
