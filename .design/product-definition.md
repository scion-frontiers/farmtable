# Farm Table — Product Definition

## What it is
Farm Table is an open-source task runtime for AI agents. It gives coding agents a single, predictable way to receive work, understand what's left to do, and track progress — whether the work lives in GitHub, Jira, Linear, Asana, or Farm Table's own built-in graph backend. Agents interact with Farm Table through a CLI and agent skills; Farm Table handles authentication, normalization, and communication with the underlying platforms.

When no external platform is connected, the built-in backend provides a graph-native task store so agents can start working immediately — no API keys, no SaaS accounts, no configuration.

## Why it exists
Today's task management tools were built for humans. As AI agents move from chat assistants to autonomous workers, every team deploying them hits the same problem: each platform models tasks differently, and every agent must be taught each one from scratch. The result is a fragmented landscape where agents either work well on one tool or work poorly across many.

Farm Table collapses this. Instead of every agent integrating every tool, every agent and every tool speaks one language. The integration layer normalizes external platforms into a common schema. The built-in backend provides a task store purpose-built for agent workflows — dependency graphs, atomic task claims, ready-task detection — for teams that have no tracker or whose tracker lacks agent-native primitives.

Farm Table is 100% open source and free, built from the ground up with agents as the primary consumer.

## Who it's for
- **Teams deploying coding agents** (Claude Code, Cursor, Devin, Codex, and similar harnesses) who need those agents to participate in the project tracker the team already uses.
- **Agent builders** who want their agents to operate across customer environments without writing N integrations — and who want a turnkey backend for environments that lack one.
- **Engineering and operations leaders** who need agent work to be visible, auditable, and governable inside the same boards their humans use.
- **Agent-native teams** who want a task system built for agent coordination without adopting an external SaaS.

## Core goals
Farm Table exists to make three things true for any AI agent in any task system:

1. **Be assigned work clearly.** An agent receives tasks with unambiguous scope, priority, dependencies, and acceptance criteria — regardless of which platform the work originated in.
2. **Understand what work remains.** An agent can see, at any moment, the full set of open tasks relevant to it, their state, and their relationships to other work.
3. **Track and communicate progress.** An agent can update status, leave context, ask for clarification, and hand work back to humans through the same channel humans already watch.

## Product principles
- **Works out of the box.** The built-in backend means zero infrastructure decisions before an agent can receive, track, and complete work. Connect an external platform when the team is ready — not before.
- **One language of work.** A normalized model of tasks, projects, comments, and state changes that is consistent across all providers and the built-in backend. Agents reason once, not per tool.
- **Respect the source of truth.** When teams use external tools, they keep their existing workflows, custom fields, and conventions. Farm Table never asks them to migrate. When teams use the built-in backend, it is the source of truth.
- **Graph-first.** Tasks are a dependency graph, not a flat list. Blocking relationships, hierarchies, and semantic links are first-class — enabling agents to determine what is ready, what is blocked, and what is on the critical path.
- **Humans stay in the loop.** Agents pause for input on ambiguity and stop for approval on high-stakes actions. The tracker is the conversation.
- **Least privilege by default.** Agents authenticate only to Farm Table. Farm Table bridges to external platforms, enforcing permission boundaries. Agent credentials never touch platform APIs directly.
- **Auditable by construction.** Every agent action is traceable to a task, a moment in time, and a reason.

## Agent interface

Farm Table is designed CLI-first. Coding agents interact with Farm Table through a command-line tool that supports structured (JSON) output for programmatic consumption. Agent skills — framework-specific wrappers (e.g., a Claude Code skill) — provide ergonomic integration for specific agent harnesses.

MCP (Model Context Protocol) support is available as a secondary interface for agents and frameworks that prefer tool-discovery-based interaction.

## Architecture

### Service layer
The Farm Table server exposes a gRPC API with HTTP transcoding. The CLI is a gRPC client. REST access is available via transcoding for administrative and human-facing tooling. This layering — gRPC service → CLI client → agent skill → (optional) MCP adapter — keeps the protocol surface clean while supporting multiple consumption patterns.

### Authentication model
Farm Table acts as an auth bridge between agents and external platforms:

- **Agent → Farm Table:** API token. Agents never hold or see external platform credentials.
- **Farm Table → External platforms:** Farm Table holds platform credentials (PATs, OAuth tokens, or MCP OAuth flows) and proxies operations on the agent's behalf. Auth methods vary by platform.
- Revoking a Farm Table API token cuts off agent access to all connected platforms in one action.

### Normalized Task Object (NTO)
The central entity is the Normalized Task Object — a schema that encapsulates everything an agent needs to understand and execute a piece of work, regardless of source platform. The NTO includes:
- Identity, title, description, priority, assignees, due dates, and relationships.
- A three-tier status model: **Phase** (4 universal values: OPEN, IN_PROGRESS, ON_HOLD, CLOSED), **Stage** (a fixed set of finer-grained positions within each phase), and **Native label** (the verbatim status string from the source platform, preserved for round-trip fidelity).
- **Typed domain extensions** for context that is specific to a class of work. The first extension is `code_context` — structured fields for repository, branch, pull requests, and CI status that coding agents need to begin work. Additional extensions (e.g., `ops_context`, `design_context`) can be added as Farm Table expands to new domains without altering the core schema.
- Custom fields for organization-specific metadata that doesn't map to built-in NTO fields.
- A `remote_data` escape hatch preserving the raw platform payload for fields the NTO does not cover.

### Collections
Tasks are grouped into Collections — the Farm Table equivalent of a project, board, or repository. Each collection maps 1:1 to a single external platform integration (one GitHub repo, one Jira project, one Linear team). A Farm Table deployment can manage many collections across many platforms, but each collection has one credential scope and one set of status mappings.

### Coordination across platforms
Farm Table's capabilities vary by backend:

| Pattern | External platforms | Built-in backend |
| :---- | :---- | :---- |
| Manager assigns work | Works well (serialized writes) | Works well + atomic guarantees |
| Agents self-select | Advisory locks, low collision risk | Atomic claims, guaranteed |
| Dependency-aware scheduling | Read-only graph traversal | Full graph queries + ready-task detection |
| Graph analytics (critical path, bottleneck) | Not available | Full support |

Farm Table works everywhere. The built-in backend unlocks more. Agent builders start with external integrations to meet teams where they are and graduate to the built-in backend as they need deeper coordination.

## The built-in backend
Farm Table ships with a graph-native task store as its default backend. It models tasks as nodes in a dependency graph with first-class edges (blocks, blocked-by, parent, child, related, duplicate), enabling:
- **Ready-task detection.** Query for all open tasks whose blockers are resolved.
- **Critical-path analysis.** Identify which unfinished tasks determine overall completion.
- **Bottleneck detection.** Find high-fan-out tasks blocking the most downstream work.
- **Atomic claims.** An agent claims a task in a single transaction, preventing double-assignment.

The built-in backend stores tasks natively in the NTO schema — making it the reference implementation of the normalized model. Implementation stack: Go, Ent (graph-first entity framework), Postgres.

See [built-in-backend.md](built-in-backend.md) for the full design.

## What success looks like
- An agent starts working immediately using the built-in backend with no external accounts or configuration.
- An agent built once works identically across the built-in backend, GitHub, Jira, Linear, and Asana with no per-platform code.
- A human assigning a task to an agent uses the same workflow they use for assigning to a teammate.
- A team deploying agents sees all agent work — in-flight, blocked, completed — on the boards they already use, or through the built-in backend's query interface.
- Multiple agents coordinate on shared work through dependency-aware scheduling and graph queries — with the built-in backend providing the strongest coordination guarantees.
- High-stakes agent actions surface for human approval before they execute.
- An agent's API token can be revoked in one place and it loses access everywhere.

## Non-goals
- Farm Table is **not** a human-facing project management tool. The built-in backend is designed for programmatic agent consumption, not for humans dragging cards on boards. Teams that want a human UI keep their existing tools.
- Farm Table is **not** an agent framework. It does not decide what agents do or how they reason — only how they connect to work.
- Farm Table is **not** a sync or migration product. It does not move tasks between platforms or maintain mirrored copies. It proxies operations to the source of truth in real time.
- Farm Table is **not** a distributed version-control system for tasks. The built-in backend uses a centralized Postgres store — not Git-native branching.
