# Farm Table — Product Definition

## What it is
Farm Table is a universal task interface that lets AI agents work alongside humans in any project management system — GitHub, Jira, Linear, Asana, and beyond — through a single, predictable way of being assigned work, understanding what's left to do, and tracking progress.

## Why it exists
Today's task management tools were built for humans. As AI agents move from chat assistants to autonomous workers, every team that wants to deploy them faces the same problem: each platform models tasks differently, and every agent has to be taught each one from scratch. The result is a fragmented landscape where agents either work on one tool well or many tools poorly. Farm Table collapses this from "every agent integrates every tool" to "every agent and every tool speaks one language."

## Who it's for
- **Teams deploying AI agents** who need those agents to participate in the project tracker the team already uses, without forcing a tool migration.
- **AI agent builders** who want their agents to operate across customer environments without writing N integrations.
- **Operations and engineering leaders** who need agent work to be visible, auditable, and governable inside the same boards their humans live in.

## Core goals
Farm Table exists to make three things true for any AI agent in any task system:

1. **Be assigned work clearly.** An agent receives tasks with unambiguous scope, priority, dependencies, and acceptance criteria — regardless of which platform the work originated in.
2. **Understand what work remains.** An agent can see, at any moment, the full set of open tasks relevant to it, their state, and their relationships to other work.
3. **Track and communicate progress.** An agent can update status, leave context, ask for clarification, and hand work back to humans through the same channel humans already watch.

## Product principles
- **One language of work.** A normalized model of tasks, projects, comments, and state changes that is consistent across providers — so agents reason once, not per-tool.
- **Respect the source of truth.** Teams keep their existing tools, workflows, custom fields, and conventions. Farm Table never asks them to migrate.
- **Humans stay in the loop.** Agents pause for input on ambiguity and stop for approval on high-stakes actions. The tracker is the conversation.
- **Least privilege by default.** Agents get only the access their current work requires, and that access is revocable independently of any human's account.
- **Auditable by construction.** Every agent action is traceable to a task, a moment in time, and a reason.

## What success looks like
- An agent built once works across GitHub, Jira, Linear, and Asana with no per-platform code.
- A human assigning a task to an agent uses the same workflow they use for assigning to a teammate.
- A team deploying agents can see all agent work — in-flight, blocked, completed — on the boards they already use.
- High-stakes agent actions surface for human approval before they execute.
- An agent's account can be suspended in one place and lose access everywhere.

## Non-goals
- Farm Table is **not** a new project management tool. It does not replace GitHub, Jira, Linear, or Asana, and it has no UI of its own for managing tasks.
- Farm Table is **not** an agent framework. It does not decide what agents do or how they reason — only how they connect to work.
- Farm Table is **not** a sync or migration product. It does not move tasks between platforms or maintain mirrored copies.

## The shift it enables
Today, AI agents are deployed as siloed assistants attached to one tool at a time. With Farm Table, agents become first-class participants in the workspace — assigned work the same way humans are, accountable to the same boards, governed by the same rules. The project tracker becomes the operating layer where humans and agents coordinate.
