# Infra Blocker: newly created containers fail to authenticate (2026-07-27, ~17:10 UTC onward)

## Summary
Production is effectively halted on the Task State Model workstream. Every NEWLY CREATED
agent container since ~17:10 UTC today comes up unauthenticated - "Not logged in - Please
run /login" with 0 seconds of actual work done. This blocks all 4 currently-running fix
agents and every downstream review agent for the rest of the workstream.

Confirmed independently by the coordinator, not just relayed from the EM.

## Affected agents (all dead, zero commits, ~20-25 min stalled)
- dev-terminal-predicate-r2 (#191 fixes)
- dev-194-close-label-swap (#194 fix)
- dev-p2-fixes-r4 (Phase 2 round 4 fixes)
- dev-markdown-sanitize (#195 fix)

Coordinator ran `scion look dev-p2-fixes-r4` directly and confirmed the fatal signature:
"Not logged in - Please run /login" appears directly under the prompt (not the cosmetic
footer banner that also appears on healthy agents), with "Crunched for 0s".

## Scope: NOT a global outage
Pre-existing containers that authenticated before the regression are all still fine:
farmtable-em-task-state-model-v2 (the EM itself), review-191, audit-191, test-191,
review-p2-r3, audit-p2-r3, test-p2-r3. Coordinator independently ran `scion look review-191`
and confirmed it is genuinely alive and functioning (correctly self-managed, idle-blocked,
already pre-registered its own re-review plan for when #191 fixes land).

So this is specifically a provisioning/auth-bootstrap failure for freshly-created
containers, not a broad service outage.

## Likely related finding: template registry
Coordinator ran `scion template status` and got back "No templates found" for this
project - the hub-side template registry may be empty or broken.

This lines up with a separate observation from the EM: the developer template's env/mount
config regressed around the same ~17:10 UTC window -
- new agents get a deprecated `ANTHROPIC_SMALL_FAST_MODEL=haiku` var (likely-invalid model
  id) instead of the known-good `ANTHROPIC_DEFAULT_HAIKU_MODEL=haiku-4-5`
- lose `explicit_workspace: true`, so they mount at the PROJECT ROOT instead of their own
  workspace clone
- drop ~19 `gh://` skills

The EM patched one agent's `scion-agent.json` to the exact known-good shape and verified it
survived a resume - it STILL failed to authenticate. So the auth bootstrap failure is likely
a separate/deeper issue than just the template config drift, not fully explained by it.
`auth_selectedType` is `container-script` for both working and broken agents, so the
in-image auth bootstrap script itself is what's failing - this is as far as diagnosis can go
from inside a container (no docker/host exec available to either the coordinator or the EM).

## Impact / what's NOT lost
No work is lost. All 4 dev worktrees are verified intact at their correct bases with clean
trees (the Go branch's `web/dist` build output is still present). The moment provisioning is
fixed, the EM can restart all 4 fix agents immediately - their briefs are already written
and unchanged.

## What's needed
Someone with host/docker/broker access to:
1. Fix the container auth bootstrap for newly-created containers.
2. Investigate/restore the template registry (the "No templates found" result) and the
   developer-template env/mount regression, which appears related but is possibly a
   secondary issue.

## Current holding pattern
Coordinator and EM are both holding: no new agent starts on this workstream until this is
confirmed fixed. No merge decisions, no review round declared - nothing has been merged.
The EM's standing rule (wait for all 3 review reports before acting) remains in force
regardless of this blocker.

## UPDATE 17:49 UTC - failure is NOT scoped to new containers. This is fleet-wide risk.
The EM tested resuming `dev-terminal-predicate`, a pre-regression STOPPED agent (created
hours before the regression, confirmed correct template: `explicit_workspace: true`,
`ANTHROPIC_DEFAULT_HAIKU_MODEL=haiku-4-5`, full `gh://` skills). Sent it a trivial probe.
Result: identical fatal failure - "Not logged in - Please run /login", "Crunched for 0s".
(Test deliberately run on an already-dead stopped agent so a failed experiment cost nothing;
no live container was risked.)

**This means the failure hits any container (re)start - creation OR resume - not just
creation.** Consequence: the six review containers currently alive
(review-191/audit-191/test-191/review-p2-r3/audit-p2-r3/test-p2-r3, all confirmed still
running, 54-57 min uptime) are alive ONLY because they have run continuously since before
the regression and have never been stopped. **They are unrecoverable if they stop for any
reason** - manual stop/delete, host restart, docker daemon bounce, or an OOM kill would lose
them permanently with no way to revive them until bootstrap is fixed.

This is not limited to this workstream's containers. ANY currently-running agent across the
whole fleet - including long-lived ones (farmtable-architect-auth, phase-arch, c-phase, this
coordinator itself) - would be similarly unrecoverable if it stopped right now for any
reason. This raises the stakes of the blocker beyond just the Task State Model workstream.

**Action taken:** the EM has suspended its own standing GC-stopped-agents-at-milestone-end
process, and the coordinator will not stop/delete/resume ANY currently-running agent for any
reason until this is resolved. Recommend host-level remediation avoid bouncing/restarting
running containers if at all possible.

**Open question for ptone:** once bootstrap is fixed, will the six review containers (and
any other currently-running containers) keep working as-is, or will they also need a
restart to pick up repaired credentials - in which case the "don't touch them" protection
above is moot, and it changes whether the EM should plan for fresh review agents once fixed
rather than trying to preserve the live ones.

The `scion template status` "No templates found" finding fits this cleanly: if the hub
template registry was wiped/broken around ~17:10 UTC and the in-image auth bootstrap
resolves credentials through it, every container START - new or resumed - would fail
identically, matching exactly what's been observed.
