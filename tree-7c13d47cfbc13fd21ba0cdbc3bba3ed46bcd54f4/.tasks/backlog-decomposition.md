# Backlog Decomposition into Farm Table Task Graph

## Context

We're dogfooding Farm Table by loading our own roadmap backlog (from `.design/roadmap.md`) into the `ft` tool as a structured task graph. This serves two purposes: proving the tool works for real planning, and having a live backlog we work from.

## Setup

The ft binary is at `/workspace/.farmtable/bin/ft`. Set environment:
```
export PATH=/workspace/.farmtable/bin:$PATH
export FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db
```

The database already has a "default" collection. Use it for all tasks.

## Conventions

### Task Types
- **`scope-task`** — Represents a grouping/milestone/phase. These are parent nodes in the graph. They contain no implementable work themselves — they're done when all their children are done. Examples: "Phase 1: Harden & Ship Identity", "Remediation: Critical Fixes", "CLI Completeness".
- **`work-task`** — Leaf nodes in the graph. These represent actual implementable work that can be assigned to a developer agent. Examples: "Timing-safe token comparison", "Add ft user whoami command", "Transaction boundaries for CreateTask".

### Labels
Use labels to categorize:
- `phase-1`, `phase-2`, `phase-3`, `phase-4` — which roadmap phase
- `remediation`, `auth`, `cli`, `integration`, `infra`, `docs`, `mcp` — domain area
- `p0`, `p1`, `p2`, `p3` — priority

### Relationships
- Use `--parent` to set parent scope-tasks
- Use `--blocked-by` to express dependencies between tasks (e.g., Linear integration is blocked by GitHub Issues hardening)
- Use `--blocks` where it makes more sense directionally

### Stages
- Leave new tasks in `triage` stage (default)
- Tasks already completed should be created and immediately closed

## What to Decompose

Read `.design/roadmap.md` and create the full task graph. The roadmap has 4 phases with detailed backlog items. Decompose as follows:

### Top-level scope-tasks (one per phase):
1. Phase 1: Harden & Ship Identity
2. Phase 2: Second Integration + MCP
3. Phase 3: Open-Source Launch
4. Phase 4: Ecosystem

### Mid-level scope-tasks (one per domain area within a phase):
Examples: "Phase 1 > Remediation Critical", "Phase 1 > CLI Polish", "Phase 2 > Linear Integration"

### Work-tasks (leaf nodes):
Each individual backlog item (AUTH-1, REM-1, CLI-1, INT-1, etc.) becomes a work-task with:
- Clear title
- Description from the roadmap
- Appropriate labels
- Parent set to its scope-task
- Dependencies via --blocked-by where noted in the roadmap

### Already-completed items
Some Phase 1 items are already done (C2 identity is shipped, some CLI work is done). Create these tasks and immediately close them so the graph reflects reality. Items known to be complete:
- AUTH-1 (Agent identity / token→user mapping) — done in commit ef5c85f
- AUTH-2 (Auth context propagation) — done in commit ef5c85f
- Graph CLI commands (ready, blocked, tree, critical-path, bottlenecks) — done in ceaea33
- Cursor-based pagination — done in ceaea33, 142c943
- CLI --clear-* flags — done in 2a35cd0

## Process

1. First create the phase-level scope-tasks (top level)
2. Then create mid-level scope-tasks with --parent pointing to phases
3. Then create work-tasks with --parent pointing to mid-level scopes
4. Set up --blocked-by relationships between tasks where dependencies exist
5. Close already-completed tasks

## Output

After creating all tasks, run `ft task list` and `ft task tree` on the phase scope-tasks to verify the graph looks right. Write a summary of what was created (counts, structure) to `/scion-volumes/scratchpad/backlog-summary.md`.

## Constraints
- Use the existing database at `/workspace/.farmtable/farmtable.db`
- Do NOT modify any source code
- Do NOT rebuild the binary
- Push nothing to git — this is purely task data in the SQLite database
