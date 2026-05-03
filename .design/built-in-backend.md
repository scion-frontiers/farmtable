# Farm Table — Built-in Backend

## What it is
Farm Table ships with a graph-native task store that serves as the default backend when no external platform is connected. It is the zero-configuration path: agents can receive, claim, track, and complete work from minute one without API keys, SaaS accounts, or platform setup.

## Why it exists
Many agent deployments begin without an existing task tracker, or with tools that lack the primitives agents actually need — dependency graphs, atomic task claims, ready-task detection. Requiring an external platform before an agent can receive work creates unnecessary friction. The built-in backend eliminates this: agents start working immediately, and teams adopt external integrations if and when their workflows demand it.

The built-in backend also serves as the reference implementation of the Normalized Task Object. Every external normalization adapter targets the same schema the built-in backend stores natively — making it the canonical source of truth for what a well-formed NTO looks like.

## Design philosophy

### Graph-first
Tasks are modeled as nodes in a dependency graph. Relationships — blocks, blocked-by, parent, child, related, duplicate — are first-class edges, not metadata. This enables operations that flat-list trackers cannot support natively:
- **Ready-task detection.** Query for all open tasks whose blockers are resolved — the set of work an agent can start right now.
- **Critical-path analysis.** Traverse the dependency graph to identify which unfinished tasks determine the overall completion date.
- **Bottleneck detection.** Find tasks with high fan-out (many dependents blocked) that should be prioritized.

### Multi-agent coordination
- **Atomic claims.** An agent claims a task in a single transaction, preventing double-assignment in multi-agent environments.
- **Dependency-aware scheduling.** Agents query the graph to determine what is unblocked and claimable, rather than relying on external orchestration.

### Centralized by design
The built-in backend uses a centralized Postgres store. Trade-off: agents gain query speed, transactional integrity, and multi-agent coordination at the cost of offline/branch-local task state. For teams that need Git-adjacent task storage, Beads remains available as an external integration.

## Implementation stack
- **Go** — Application layer.
- **Ent** — Graph-first entity framework. Schemas define the task graph with typed, self-referential edges (subtasks, blocks, discovered-from). Generates type-safe traversals for graph queries.
- **Postgres** — Enforces referential integrity. Supports recursive CTEs for efficient graph traversal (e.g., resolving the full dependency chain to compute ready tasks).

## Interface contract
The built-in backend exposes the same NTO schema as every external integration. When `platform` is `farmtable`, the task lives in the built-in store; when it is `github` or `jira`, it is a normalized view of an external record. From an agent's perspective, the interface is identical — the backend is an implementation detail.

## What it does not do
- It is not a human-facing project management UI. It is designed for programmatic consumption — graph queries, atomic operations, structured status transitions.
- It does not replicate Beads' distributed, Git-native branching model. Tasks do not branch with the code or merge with the pull request.
- It is not a sync engine. It does not mirror tasks from external platforms into its own store.
