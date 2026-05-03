# Farm Table — Product Definition

## What it is
Farm Table is a universal task interface with a built-in graph backend. It lets AI agents work alongside humans in any project management system — GitHub, Jira, Linear, Asana, and beyond — through a single, predictable way of being assigned work, understanding what's left to do, and tracking progress. When no external platform is connected, Farm Table's own graph-native task store serves as the default backend — so agents can start working immediately without requiring teams to adopt or configure a third-party tool.

## Why it exists
Today's task management tools were built for humans. As AI agents move from chat assistants to autonomous workers, every team that wants to deploy them faces the same problem: each platform models tasks differently, and every agent has to be taught each one from scratch. The result is a fragmented landscape where agents either work on one tool well or many tools poorly. Farm Table collapses this from "every agent integrates every tool" to "every agent and every tool speaks one language."

But there is a deeper problem: many teams deploying agents have no task system at all, or their existing tracker lacks the primitives agents actually need. Farm Table solves both problems. Its built-in backend provides a task store purpose-built for agent workflows, while its integration layer normalizes every major external platform into the same interface. One integration point, zero mandatory infrastructure.

## Who it's for
- **Teams deploying AI agents** who need those agents to participate in the project tracker the team already uses, without forcing a tool migration.
- **AI agent builders** who want their agents to operate across customer environments without writing N integrations — and who want a turnkey backend for environments that lack one.
- **Operations and engineering leaders** who need agent work to be visible, auditable, and governable inside the same boards their humans live in.
- **Agent-native teams** who want a task system built from the ground up for agent coordination without adopting an external SaaS.

## Core goals
Farm Table exists to make three things true for any AI agent in any task system:

1. **Be assigned work clearly.** An agent receives tasks with unambiguous scope, priority, dependencies, and acceptance criteria — regardless of which platform the work originated in.
2. **Understand what work remains.** An agent can see, at any moment, the full set of open tasks relevant to it, their state, and their relationships to other work.
3. **Track and communicate progress.** An agent can update status, leave context, ask for clarification, and hand work back to humans through the same channel humans already watch.

## Product principles
- **Works out of the box.** An agent should be productive from minute one. The built-in backend means zero infrastructure decisions before an agent can receive, track, and complete work.
- **One language of work.** A normalized model of tasks, projects, comments, and state changes that is consistent across providers and the built-in backend — so agents reason once, not per-tool.
- **Respect the source of truth.** When teams use external tools, they keep their existing workflows, custom fields, and conventions. Farm Table never asks them to migrate. When teams use the built-in backend, it is the source of truth.
- **Graph-first.** Tasks are a dependency graph, not a flat list. Blocking relationships, hierarchies, and semantic links are first-class — so agents can determine what is ready, what is blocked, and what is on the critical path.
- **Humans stay in the loop.** Agents pause for input on ambiguity and stop for approval on high-stakes actions. The tracker is the conversation.
- **Least privilege by default.** Agents get only the access their current work requires, and that access is revocable independently of any human's account.
- **Auditable by construction.** Every agent action is traceable to a task, a moment in time, and a reason.

## What success looks like
- An agent starts working immediately using the built-in backend with no external accounts, API keys, or platform configuration.
- An agent built once works identically across the built-in backend, GitHub, Jira, Linear, and Asana with no per-platform code.
- A human assigning a task to an agent uses the same workflow they use for assigning to a teammate.
- A team deploying agents can see all agent work — in-flight, blocked, completed — on the boards they already use, or in the built-in backend's query interface.
- Multiple agents coordinate on shared work through atomic task claims, dependency-aware scheduling, and graph queries — without custom orchestration code.
- High-stakes agent actions surface for human approval before they execute.
- An agent's account can be suspended in one place and lose access everywhere.

## Non-goals
- Farm Table is **not** a human-facing project management tool. The built-in backend is designed for programmatic agent consumption, not for humans browsing boards and dragging cards. Teams that want a human UI keep their existing tools and connect them via the integration layer.
- Farm Table is **not** an agent framework. It does not decide what agents do or how they reason — only how they connect to work.
- Farm Table is **not** a sync or migration product. It does not move tasks between platforms or maintain mirrored copies.
- Farm Table is **not** a distributed version-control system for tasks. The built-in backend uses a centralized Postgres store for data integrity, query power, and multi-agent coordination — not Git-native branching.

## The built-in backend
Farm Table includes a graph-native task store as its default backend. When no external platform is connected, agents can start working immediately — no API keys, no SaaS accounts, no platform configuration. The built-in backend models tasks as a dependency graph with first-class relationships, enabling ready-task detection, multi-agent coordination via atomic claims, and analytical operations like critical-path and bottleneck analysis.

See [built-in-backend.md](built-in-backend.md) for the full design, implementation stack, and trade-offs.

## The shift it enables
Today, AI agents are deployed as siloed assistants attached to one tool at a time — or they have no task system at all. With Farm Table, agents become first-class participants in the workspace — assigned work the same way humans are, accountable to the same boards, governed by the same rules. The built-in backend means this works from day one, without waiting for a team to configure an external platform. The project tracker — whether Farm Table's own or an existing tool — becomes the operating layer where humans and agents coordinate.
