# Friction Log: External Store Passthrough Dogfooding

**Date:** 2026-07-21
**Author:** Engineering Manager agent
**Project:** External Store Passthrough feature
**Collection:** `5d1e4eea-3dc7-4958-99ac-01e3372c5a0d` on `farmtable-qo7k5fvpda-uc.a.run.app:443`
**Status:** Complete — all 21 tasks implemented

---

## Setup Experience

### Getting the token and connecting
- **Worked well:** `gcloud secrets versions access latest --secret=farmtable-token` is a clean pattern
- **Friction:** Every ft command needs `TOKEN` and `FARMTABLE_SERVER` environment variables set. Setting these up each time is tedious. The config file at `~/.config/farmtable/config.toml` exists for the local DB but doesn't seem to handle remote server auth elegantly for agents.
- **Suggestion:** `ft config set-server` and `ft config set-token` commands that persist to config so every subsequent command just works.

### Collection scoping
- **Worked well:** `-c <uuid>` flag works on all commands
- **Friction:** Typing `5d1e4eea-3dc7-4958-99ac-01e3372c5a0d` every time is painful. The `-c` flag accepts UUID or name — using the collection name would be nicer.
- **Suggestion:** Support a "default collection" setting: `ft config set-default-collection <id-or-name>` so `-c` isn't needed every time.

---

## Mode 1: Sole Interactor (EM runs all ft commands)

### Claiming tasks (ft task claim)
- **Worked well:** `ft task claim <id>` atomically moves to "working" stage and assigns. The `--reason` flag is nice for audit trail.
- **Friction:** No feedback on WHO claimed the task — the response shows stage=working but no assignee name. Had to infer from the JSON output.
- **Observation:** Claiming 8 tasks in rapid succession worked smoothly — no race conditions or version conflicts.

### Listing tasks (ft task list)
- **Worked well:** JSON output is clean and parseable. Table output is readable.
- **Friction:** Default list doesn't show relationships/blockers — have to use `ft task get <id>` for each one to see what blocks what.
- **Suggestion:** A `--show-deps` flag on `ft task list` to include blocker info inline.

### Task stage transitions
- **Worked well:** Stage transitions (triage → working → completed) are clean
- **Friction:** The EM had to manually track which tasks were done since `ft task close` wasn't integrated into the developer agent workflow
- **Observation:** In sole-interactor mode, the EM is the bottleneck for all task state updates — this doesn't scale

---

## Mode 2: Delegated Updates (devs run ft commands themselves)

### What was attempted
- Delegated mode was NOT fully tested during this session. All ft task operations were performed by the EM (sole interactor mode). Developer agents focused purely on code implementation and did not run ft commands.

### Why delegated mode wasn't used
1. **Agent provisioning issues:** The early session was consumed by debugging Hub API timeouts and template provisioning failures (developer template harness crash). By the time agents were reliably launching, the focus was on maximizing development throughput rather than experimenting with ft integration.
2. **Shared workspace complexity:** All agents share `/workspace/farmtable`. Adding ft CLI operations to dev agent prompts would mean more commands running against the shared workspace state, increasing the risk of conflicts.
3. **Token/auth complexity:** Each dev agent would need the Farmtable server token and connection info — additional setup overhead that would slow down agent launches.

### Delegated mode assessment (projected)
Based on sole-interactor experience, delegated mode would likely face:
- **Token distribution friction:** Every dev agent needs `TOKEN` and `FARMTABLE_SERVER` env vars. These are secrets that shouldn't be in prompts. A config file approach would help.
- **Collection ID friction:** Every ft command needs `-c <uuid>`. Dev agents would need the collection ID in their prompt — manageable but verbose.
- **Task ID mapping:** Dev agents would need to know their specific task ID to update. This means the EM must include the task UUID in each agent's prompt.
- **Benefit:** Automatic status tracking — the EM wouldn't need to manually track which agents finished which tasks. Task history would show who did what and when.

---

## Comparison: Sole Interactor vs. Delegated

| Aspect | Sole Interactor | Delegated (Projected) |
|--------|----------------|----------------------|
| Setup overhead | Low — one agent has all config | Higher — every agent needs token/server/collection |
| Task tracking accuracy | Manual by EM, error-prone | Automatic, task state always current |
| EM bottleneck | Yes — EM must update all tasks | No — agents self-report |
| Agent prompt complexity | Simple — just code task | More complex — code task + ft commands |
| Audit trail | Limited — EM's perspective only | Rich — each agent's updates recorded |
| Scaling | Poor — EM can't keep up with 4+ parallel agents | Good — agents are self-sufficient |

**Verdict:** Sole interactor mode works for proof of concept but doesn't scale. Delegated mode is the clear winner for multi-agent workflows. The main friction points (token distribution, collection ID boilerplate) are solvable with `ft config` commands and defaults.

---

## Infrastructure/Orchestration Observations

### Hub API timeouts from agent sessions
- **Issue:** scion start consistently times out from the EM agent session (context deadline exceeded), while the coordinator's session can start agents fine.
- **Impact:** EM agent cannot provision dev agents, breaking the delegation model.
- **Workaround:** Coordinator dispatches agents on EM's behalf.
- **Friction level:** HIGH — the EM becomes a bottleneck relay instead of a self-sufficient orchestrator.
- **Resolution:** Switched to `--type default` template which resolved the timeouts.

### Claude Code workspace trust dialog blocks agents
- **Issue:** Newly provisioned Claude Code agents hit the "Is this a project you trust?" interactive prompt and cannot proceed. The harness config had `hasTrustDialogAccepted: true` only for `/repo-root/.scion/agents/ggg/workspace` but agents land in `/workspace`.
- **Fix:** Adding `/workspace` to the projects section in the claude harness config's `.claude.json` — but this didn't help because the real issue was the developer template's provision.py crash.
- **Root cause:** The `developer` template's provision.py crashes with exit status 1, preventing workspace trust configuration AND auth credential setup.
- **Fix:** Using `--type default` template instead of `--type developer` avoids the crash entirely.
- **Friction level:** HIGH — every agent with developer template was DOA.

### Shared workspace branch pollution
- **Issue:** All agents share `/workspace/farmtable`. When one agent checks out a branch, it affects other agents' working trees. Agents that commit while another agent's branch is checked out create superset branches.
- **Impact:** Required manual branch ref corrections (e.g., `git branch -f` to reset A7's branch after B4 committed on top of it). C3's branch lost its commit after another agent's checkout.
- **Workaround:** Careful branch management by the EM — rebasing, ref resets, verifying diffs before pushing.
- **Friction level:** MEDIUM — manageable but error-prone. Would be eliminated by per-agent worktrees.
- **Suggestion:** Agent isolation via git worktrees — each agent works in its own worktree to prevent interference.

### Agent GC and lifecycle
- **Observation:** Completed agents must be manually deleted (`scion delete`). With 21 tasks × 2 agents each (dev + reviewer), that's ~42 agent lifecycle operations to manage.
- **Suggestion:** Auto-cleanup of stopped/completed agents after a configurable timeout.

---

## CLI/UX Improvement Suggestions

1. **Default collection setting** — avoid repeating `-c <uuid>` on every command
2. **`ft task list --show-deps`** — show blockers inline in list view  
3. **Token/server persistence** — `ft config set-server` for remote server config
4. **Claim feedback** — show assignee name in claim response
5. **Harness auto-trust** — workspace trust should be path-agnostic in harness configs
6. **Agent worktrees** — per-agent git worktrees to prevent shared workspace conflicts
7. **Auto-cleanup** — auto-delete completed agents after timeout

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total tasks | 21 leaf + 3 parent |
| Tasks completed | 21/21 |
| PRs created | 20 (#85-#104) |
| Dev agents spawned | ~18 |
| Review agents spawned | ~12 |
| Total agents managed | ~30 |
| Session duration | ~2.5 hours |
| Avg task completion time | ~10 min |
| Agent template used | `default` (workaround for broken `developer`) |
| ft dogfood mode | Sole interactor (delegated not tested) |
