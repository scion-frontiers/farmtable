# UPDATE 18:53 UTC: task #173 reopened - fix was NOT complete, sharper root cause found

## CORRECTION 19:21 UTC - the "empty project template registry" theory below is WRONG
ptone asked whether `scion template status --global` was found not working. Tested it
directly: it works fine, cleanly lists all 16 templates as hub-only (local: no, hub: yes).
The project-local `scion template status` (no `--global`) returning "No templates found" is
the EXPECTED, by-design state for a hub-only setup with no local template overrides - it is
NOT a symptom of anything broken, and is not the cause of the auth failures described below.
Retracting that specific causal claim.
What still stands, independent of the registry question: the degraded-config correlation
(agents landing with the wrong mount/missing explicit_workspace/degraded model vars fail
auth; agents landing correctly do not) was verified directly by mount-path inspection, twice,
and does not depend on the registry theory being right.
What's open again: why template resolution sometimes degrades. Best remaining candidate is
the OTHER finding below (Hub agent-creation endpoint timing out 5/7 attempts) - a Hub-API
flakiness explanation, not a registry-configuration one.

## Why you don't see active agents under the EM
The EM recreated all 4 dev agents after my earlier all-clear. All 4 came up unauthenticated
again (identical "Not logged in", 0s worked). The EM deleted all 4 again immediately to stop
stall-notification noise while waiting for a real fix. So right now there are correctly ZERO
active dev agents under its supervision - that's the incident continuing, not a new/separate
problem, and not something either of us is failing to notice.

## My earlier "confirmed fixed" was premature - here's exactly why
I tested with one canary agent, it worked, and I over-generalized a single sample to "fixed."
It wasn't uniform. I've now run a second independent canary specifically to check, and got
the opposite result - full repro of the failure, moments after the "fix."

## Sharper root cause (EM's diagnosis, independently confirmed by me just now)
1. `scion template status` returns "No templates found" for this project (still true, this
   part hasn't changed since the original report).
2. `scion template list` shows the templates DO exist at the GLOBAL/hub level (developer,
   code-reviewer, eng-manager, etc. - 16 total, all present with valid IDs/hashes).
3. Because the PROJECT-level registry is empty, `scion start --type developer` does not
   reliably resolve to the real global template. When it fails to resolve, the agent gets a
   DEGRADED fallback config: no `explicit_workspace: true` (so it mounts at the PROJECT ROOT
   instead of its own git worktree clone), `ANTHROPIC_SMALL_FAST_MODEL=haiku` instead of
   `ANTHROPIC_DEFAULT_HAIKU_MODEL=haiku-4-5`, ~5 skills instead of ~24, no
   `SCION_TELEMETRY_ENABLED`.
4. That degraded config is exactly what's missing auth provisioning. The correlation is
   exact and I verified it myself independently: I ran two canaries back to back.
   - Canary 1 (reported earlier as "fix confirmed"): mounted correctly at its own worktree
     clone (`/workspace/farmtable-p2-fixes-r4`) - authenticated fine, did real work.
   - Canary 2 (run just now, specifically to check this): mounted at `/workspace` (project
     root - the degraded signature) - failed identically ("Not logged in", 0s worked).
   Same command (`scion start --type developer`), run minutes apart, two different outcomes.
   This is template-resolution flakiness against an empty project registry, not a fixed
   system - your earlier successful test and my first canary both just got lucky draws.

## Secondary, possibly-related problem: the agent-creation endpoint itself is flaky
EM reports `POST /api/v1/projects/<id>/agents` returned "context deadline exceeded" on 5 of 7
creation attempts. When it times out, the agent can be left in `phase=created` with no
container; finishing it with a bare `scion start <name>` (no `--type`) produces a container
with literally no template at all - a second, independent route to the same dead-agent
outcome.

## What's actually needed
Restoring the PROJECT-level template registry (or making `--type` resolution reliably fall
through to the existing global template instead of silently degrading) is what would fix
this for real. A one-off "start an agent, it worked" check isn't sufficient evidence given
the ~50% resolution failure rate we're now seeing - would need several consecutive clean
creations to trust it's actually fixed next time.

## Current status
Reopened task #173. EM has stood down (not retrying agent creation - burns Hub API calls
against a channel already shown to fail 5/7 of the time, and each attempt is a coin flip
regardless). All 4 dev worktrees remain intact and untouched, briefs unchanged, ready the
moment resolution is reliable. Six review containers still untouched and alive. Nothing
merged, no review round declared.
