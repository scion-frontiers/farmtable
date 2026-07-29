# Task #173 FINAL RESOLUTION (2026-07-27 19:32 UTC)

Real root cause found - much smaller than the "fleet-wide auth outage" framing given earlier.

## What actually happened
The `POST /api/v1/projects/<id>/agents` endpoint (agent creation) had a transient bad window
roughly 18:40-18:51 UTC - every templated create timed out during that window. It recovered
on its own. The coordinator's endpoint-divergence theory (deprecated `/groves/` vs `/projects/`)
was wrong and the EM ruled it out cleanly from its own logs (same endpoint for both, same CLI
commit, just different timing - the `/groves/` line is a pre-flight GET lookup, not the create
POST). Templates, the project registry, and auth provisioning were never actually broken.

## What made it look worse than it was
When the EM's templated creates timed out, its retry was a bare `scion start <name> "<task>"`
with no `--type`. That succeeded - but a create with no `--type` applies no template BY
DESIGN, so it silently produces an agent with no `explicit_workspace`, minimal skills,
mounted at the project root, and no template-provisioned auth. That degraded,
unauthenticated-looking agent is what was diagnosed for hours as a platform bug. It was a
side effect of the retry method, self-inflicted, not a platform break.

## Actionable platform bug (the real, worth-fixing issue)
Bare `scion start` with no `--type` silently produces a degraded, unauthenticated agent that
reports `Phase: running` and looks like a completely successful creation - no error, no
warning. That single behavior turned a roughly 10-minute endpoint blip into a multi-hour
investigation, because the natural retry-after-timeout is exactly the command that
manufactures the bad state. Recommend either refusing a create with no template, or warning
loudly when one happens.

## Smaller gotcha
`-w` takes a project-relative subdirectory, not a container-absolute path -
`-w /workspace/foo` returns a fast clean 500 "workspace path does not exist";
`-w foo` works.

## Current verified state
All 4 dev agents recreated, healthy (explicit_workspace true, 24 skills, correct branches, no
fatal login lines) - independently verified by the coordinator, not just relayed.
`dev-p2-fixes-r4` is doing real work right now (362 tests passing, working through its fix
checklist). The 6 review containers were never touched and remain untouched. Resuming the
Task State Model workstream now - r4/#191/#194/#195 proceeding in parallel with full
independent review before any merge, as always. Restart-safety for previously-stopped agents
remains UNVERIFIED (that finding was made during the bad window and hasn't been retested) -
not treating it as safe.
