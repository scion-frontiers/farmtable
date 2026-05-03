# Farm Table — Target Integrations

The initial integration set is drawn from the platforms analyzed in the primary research. Each is selected because it represents a distinct category of task management user and exercises a different shape of the normalization problem — covering this set proves the universal interface holds up across the real range of teams Farm Table needs to serve.

Farm Table also includes a **built-in graph backend** that serves as the default task store when no external platform is connected. The built-in backend covers the "agent-native work" archetype directly — it provides dependency-aware graph queries, atomic task claims, and analytical capabilities (critical path, bottleneck detection) out of the box. External integrations extend Farm Table's reach into the tools teams already use.

## Tier 1 — Launch targets

These four external integrations plus the built-in backend form the baseline. Together they make Farm Table credible as a "universal" interface — spanning human-first tools that agents must adapt to, while the built-in backend ensures agents can start working immediately without any external dependency.

### Built-in backend (default)
- **Who it serves:** Any team deploying agents, especially those without an existing task tracker or those whose existing tracker lacks agent-native primitives.
- **Why it matters:** Eliminates the cold-start problem. Agents can receive, claim, track, and complete work from minute one. No API keys, no SaaS accounts, no platform configuration. Also serves as the reference implementation of the NTO — every normalization adapter targets the same schema the built-in backend stores natively.
- **Product shape it tests:** Graph-native task relationships (blocks, blocked-by, parent, child, related), atomic task claims for multi-agent coordination, ready-task detection via dependency resolution, critical-path and bottleneck analysis, and Postgres-backed transactional integrity.

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
- **Who it serves:** Teams already using Beads for Git-native, local-first task management who want their agents to participate in that workflow through Farm Table's universal interface.
- **Why it matters:** Beads represents the distributed, Git-adjacent model — tasks travel with the repository, branch with the code, and merge with the pull request. While Farm Table's built-in backend now covers agent-native graph capabilities in a centralized Postgres store, Beads integration ensures Farm Table works for teams that have chosen the opposite architectural trade-off: offline-first, branch-local task state over centralized query power. This keeps Farm Table's "universal" promise honest across both centralized and distributed paradigms.
- **Product shape it tests:** Git-native storage normalization (JSONL → NTO), branch-aware task resolution, hash-based ID mapping, and import/migration path from Beads into the built-in backend for teams that outgrow local-first constraints.

## Coverage rationale
Together, the built-in backend and the Tier 1 integrations cover the six archetypes Farm Table must serve:

| Archetype | Represented by |
| :---- | :---- |
| Agent-native work (default) | Built-in backend |
| Code-integrated work | GitHub |
| Developer-velocity work | Linear |
| Enterprise / customized work | Jira Cloud |
| Cross-functional / collaborative work | Asana |
| Distributed / Git-native work | Beads |

Any gap here would leave a major class of team unable to deploy agents through Farm Table. The built-in backend ensures every deployment has a working task system from day one; the integrations ensure Farm Table meets teams where they already are.

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
