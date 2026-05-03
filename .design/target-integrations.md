# Farm Table — Target Integrations

The initial integration set is drawn from the platforms analyzed in the primary research. Each is selected because it represents a distinct category of task management user and exercises a different shape of the normalization problem — covering this set proves the universal interface holds up across the real range of teams Farm Table needs to serve.

## Tier 1 — Launch targets

These five are the baseline. Supporting all of them is what makes Farm Table credible as a "universal" interface rather than a single-platform adapter — and ensures it spans both human-first tools that agents must adapt to and agent-native tools that already speak the agent's language.

### GitHub Issues
- **Who it serves:** Engineering teams whose work lives next to the code — open source projects, developer tools, infrastructure teams.
- **Why it matters:** Tasks are tightly coupled to source control. Agents assigned here often need to reason about branches, pull requests, and review state, not just issue text.
- **Product shape it tests:** Hierarchical work decomposition (sub-issues), code-linked task lifecycle, organization-wide issue typing.

### Linear
- **Who it serves:** High-velocity product and engineering teams that prioritize speed and developer ergonomics.
- **Why it matters:** Strong native support for explicit task relationships (blocks, blocked by, related, duplicate) and time-boxed cycles — both critical signals for agents deciding what to work on next.
- **Product shape it tests:** Dependency-aware task selection, iteration/cycle context, clean programmatic-first design.

### Jira Cloud
- **Who it serves:** Enterprise teams with formal workflows, compliance requirements, and heavy customization.
- **Why it matters:** The hardest case. Custom fields, custom workflows, and custom states are the norm rather than the exception. If Farm Table works for Jira, it works for the enterprise.
- **Product shape it tests:** Custom field preservation, workflow-constrained state transitions, mandatory-field discovery before task creation.

### Asana
- **Who it serves:** Cross-functional teams coordinating work that spans engineering, marketing, operations, and leadership.
- **Why it matters:** Represents the collaboration-first audience whose work is often less structured than engineering tickets but no less important to keep agents aligned with.
- **Product shape it tests:** Multi-level hierarchy (Portfolio → Project → Section → Task), inherited metadata, mixed human/agent collaboration patterns.

### Beads (`bd`)
- **Who it serves:** Teams whose work is largely driven by coding agents — and who want a tracker that was designed for agent workflows from day one rather than retrofitted onto a human-first tool.
- **Why it matters:** Beads is the only Tier 1 target built natively for AI agents. It treats issues as a dependency-aware graph, supports atomic task claims for multi-agent coordination, and runs locally next to the code rather than as a SaaS. Including it ensures Farm Table's notion of "universal" stretches to agent-native systems, not just human-first ones — and gives Farm Table a credible answer for teams that want zero SaaS dependency in their agent loop.
- **Product shape it tests:** Agent-native primitives (atomic claim, ready-task detection, semantic compaction), rich graph relationships beyond simple parent/child (blocks, relates, supersedes, duplicates, replies), local-first / git-adjacent storage rather than cloud APIs, and multi-agent/multi-branch coordination via hash-based IDs.

## Coverage rationale
Together, the Tier 1 set covers the five archetypes Farm Table must serve:

| Archetype | Represented by |
| :---- | :---- |
| Code-integrated work | GitHub |
| Developer-velocity work | Linear |
| Enterprise / customized work | Jira Cloud |
| Cross-functional / collaborative work | Asana |
| Agent-native work | Beads |

Any gap here would leave a major class of team unable to deploy agents through Farm Table.

## Future candidates
Not committed for launch, but on the radar for later expansion based on user demand:
- ClickUp
- Monday.com
- Trello
- Notion (tasks/databases)
- Azure DevOps Boards
- ServiceNow

Each of these is a variant of an archetype already covered by Tier 1, so they extend reach rather than test new product shapes.

## Out of scope (for now)
- CRM-style task systems (Salesforce, HubSpot tasks) — different domain semantics around opportunities and contacts.
- Personal to-do apps (Todoist, Things) — single-user, no agent-collaboration story.
- Spreadsheet-based "task trackers" — no stable schema or state model to normalize against.
