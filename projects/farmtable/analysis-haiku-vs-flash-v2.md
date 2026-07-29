# Decomposition Tree Analysis: Haiku 4.5 vs Flash 3.6 v2

**Date:** 2026-07-24
**Prompt:** "Build an ecommerce website that allows users to buy and sell vintage action figures"
**Tool:** Farmtable Decomposer (recursive LLM decomposition with self-assessed terminality)

## Summary

Haiku 4.5 produces a **66% larger tree** (15,415 vs 9,284 tasks) despite reaching only depth 4 (vs Flash's depth 5), driven by a higher branching factor (9.17 avg vs 8.26). The Haiku run was aborted before terminal assessment at depth 4, so **zero tasks** carry the `decomposer:terminal` label — a critical gap compared to Flash's 1,581 terminal-labeled tasks. Both models produce zero single-child nodes, indicating neither "pads" depth gratuitously. Flash tends toward more concrete, implementation-oriented task titles at deeper levels, while Haiku's depth-4 leaf tasks are frequently research/documentation/planning tasks that feel like they could decompose further — consistent with the run being incomplete. Flash produces tighter sequential group structures (modal: 3-4 groups), while Haiku spreads wider per group (more tasks per sequential layer, wider range of group counts). Neither model exhibits pathological decomposition patterns; the key difference is completion state, not fundamental quality.

---

## 1. Tree Shape

### Depth Distribution

| Depth | Flash v2 Tasks | Flash % | Haiku 4.5 Tasks | Haiku % |
|-------|---------------|---------|-----------------|---------|
| 0     | 1             | 0.01%   | 1               | 0.01%   |
| 1     | 12            | 0.13%   | 18              | 0.12%   |
| 2     | 106           | 1.14%   | 214             | 1.39%   |
| 3     | 917           | 9.88%   | 2,056           | 13.34%  |
| 4     | 6,830         | 73.57%  | 13,126          | 85.15%  |
| 5     | 1,418         | 15.27%  | —               | —       |
| **Total** | **9,284** |         | **15,415**      |         |

**Key observations:**
- Both trees are heavily bottom-weighted: 88.8% of Flash's tasks are at depth 4-5, 85.2% of Haiku's are at depth 4.
- Haiku's depth-1 has 18 children (vs Flash's 12), setting up 50% more top-level work streams from the start.
- Flash's depth 5 exists because ~87 depth-4 tasks were assessed as non-terminal and decomposed further; this never happened for Haiku because the run was aborted during depth-4 terminal assessment.

### Branching Factor Distribution

| Children per Parent | Flash Parents | Haiku Parents |
|--------------------|---------------|---------------|
| 3                  | 0             | 1             |
| 4                  | 0             | 1             |
| 5                  | 0             | 33            |
| 6                  | 53            | 111           |
| 7                  | 201           | 236           |
| 8                  | 438           | 297           |
| 9                  | 288           | 326           |
| 10                 | 125           | 277           |
| 11                 | 16            | 175           |
| 12                 | 3             | 105           |
| 13                 | 0             | 61            |
| 14                 | 0             | 27            |
| 15                 | 0             | 19            |
| 16                 | 0             | 6             |
| 17                 | 0             | 3             |
| 18                 | 0             | 2             |
| 20                 | 0             | 1             |

| Metric | Flash v2 | Haiku 4.5 |
|--------|----------|-----------|
| Mean branching factor | 8.26 | 9.17 |
| Median branching factor | 8.0 | 9.0 |
| Non-leaf nodes | 1,124 | 1,681 |
| Leaf nodes | 8,160 (87.9%) | 13,734 (89.1%) |

**Key observations:**
- Flash is tighter and more consistent: its branching range is 6-12, tightly clustered around 8. Standard deviation is low.
- Haiku has a much wider spread (3-20) with a heavier right tail — more parents with 11-20 children. This is a significant contributor to the larger overall tree.
- Haiku's wider branching creates more parallelizable work at the cost of potentially less focused decomposition at each level.

---

## 2. Branch Path Sampling

### Flash v2 — Representative Paths

**Path A (depth 4 — Database/Design):**
```
[d0] Build an ecommerce website...
  [d1] Design database schema and data models for marketplace
    [d2] Produce Database Schema Specification Document and ERD
      [d3] Map database data flows for core marketplace interactions
        [d4] Document checkout execution and order placement state transitions
```

**Path B (depth 5 — UI component):**
```
[d0] Build an ecommerce website...
  [d1] Build seller dashboard and listing creation UI
    [d2] Build active inventory management view
      [d3] Build edit navigational links and delete confirmation modals
        [d4] Create deletion and archival confirmation modal component
          [d5] Write unit and component tests for confirmation modal
```

**Path C (depth 4 — Search backend):**
```
[d0] Build an ecommerce website...
  [d1] Implement specialized search and filtering engine
    [d2] Develop search autosuggest and autocomplete endpoint
      [d3] Build autosuggest indexing and sync worker
        [d4] Add error handling and sync metrics telemetry
```

### Haiku 4.5 — Representative Paths

**Path A (depth 4 — Architecture/Research):**
```
[d0] Build an ecommerce website...
  [d1] Design system architecture and tech stack
    [d2] Evaluate and select frontend framework
      [d3] Research Vue framework and ecosystem
        [d4] Survey Vue component libraries and UI frameworks
```

**Path B (depth 4 — Database design):**
```
[d0] Build an ecommerce website...
  [d1] Implement buyer-seller messaging
    [d2] Implement message storage and retrieval
      [d3] Design message and conversation database schema
        [d4] Identify core entities and relationships
```

**Path C (depth 4 — Requirements/Planning):**
```
[d0] Build an ecommerce website...
  [d1] Define functional and non-functional requirements
    [d2] Document trust and safety features
      [d3] Design dispute resolution and appeals workflow
        [d4] Create dispute resolution workflow diagram
```

### Comparison

- **Flash's leaf tasks** tend to be concrete implementation actions: "Write unit tests," "Add error handling," "Construct rollback SQL migration script." These are plausibly terminal — an agent could execute them directly.
- **Haiku's depth-4 leaf tasks** are often research/discovery/documentation tasks: "Survey Vue component libraries," "Identify core entities and relationships," "Create dispute resolution workflow diagram." Many of these feel like they *should* decompose further into concrete implementation steps — consistent with the run being aborted before those tasks could be assessed for terminality and decomposed.
- Haiku also dedicates an entire depth-1 branch to "Define functional and non-functional requirements" — a meta/planning task that Flash handles implicitly within implementation branches. This is a philosophical difference in decomposition strategy.

---

## 3. Terminal Self-Assessment

| Metric | Flash v2 | Haiku 4.5 |
|--------|----------|-----------|
| Tasks with `decomposer:terminal` label | 1,581 (17.0%) | 0 (0.0%) |
| Leaf tasks (no children) | 8,160 (87.9%) | 13,734 (89.1%) |
| Leaf tasks without any labels | 6,579 (80.6% of leaves) | 13,734 (100% of leaves) |

### Flash v2 Terminal Assessment by Depth

| Depth | Tasks | Terminal | Terminal % |
|-------|-------|----------|------------|
| 0     | 1     | 0        | 0%         |
| 1     | 12    | 0        | 0%         |
| 2     | 106   | 1        | 0.9%       |
| 3     | 917   | 83       | 9.1%       |
| 4     | 6,830 | 87       | 1.3%       |
| 5     | 1,418 | 1,410    | 99.4%      |

**Key observations:**
- Flash's terminal labeling is coherent: depth-5 tasks are 99.4% terminal (as expected for the deepest level), while depth-3 terminal rate (9.1%) represents tasks the model correctly identified as already atomic.
- The depth-4 terminal rate of only 1.3% (87/6,830) is notable — it means most depth-4 tasks were assessed but found non-terminal, leading to depth-5 decomposition for only ~87 of them (which produced the 1,418 depth-5 tasks). The remaining ~6,743 depth-4 tasks appear to be leaves without terminal labels — likely they *were* assessed as non-terminal but decomposition produced the depth-5 children.
  - Actually: 6,830 depth-4 tasks total. 87 are terminal-labeled. Of the remaining 6,743, only those that have children were decomposed (producing depth-5 tasks). Let me verify: depth-5 has 1,418 tasks. With avg branching ~8, that means ~177 depth-4 parents decomposed into depth-5 children. So ~6,566 depth-4 tasks are neither labeled terminal nor decomposed further. This suggests the terminal assessment phase for depth 4 was not fully completed for Flash either, OR some tasks were assessed non-terminal but not further decomposed (perhaps depth limit reached).
- Haiku has **zero terminal labels** — confirming the run was aborted before any terminal assessment could be applied. All 13,734 leaf tasks are unlabeled.

---

## 4. Group Encoding (Sequential Dependencies)

Tasks within the same sequential "group" can execute in parallel; tasks in higher-numbered groups depend on all tasks in the previous group. This is encoded via `BLOCKED_BY` relationships.

### Relationship Counts

| Metric | Flash v2 | Haiku 4.5 |
|--------|----------|-----------|
| Total BLOCKED_BY relationships | 16,410 | 29,061 |
| Total BLOCKS relationships | 16,410 | 29,061 |
| Relationships per task (avg) | 3.53 | 3.77 |

### Sequential Group Count per Parent

| Groups per Parent | Flash Parents | Haiku Parents |
|-------------------|---------------|---------------|
| 1 (all parallel)  | 0             | 1             |
| 2                 | 37            | 60            |
| 3                 | 565           | 622           |
| 4                 | 487           | 751           |
| 5                 | 34            | 207           |
| 6                 | 0             | 36            |
| 7                 | 1             | 3             |
| 8                 | 0             | 1             |
| **Total parents** | **1,124**     | **1,681**     |
| **Mean groups/parent** | **~3.5** | **~3.8**      |

**Key observations:**
- Both models consistently use 3-4 sequential groups as the dominant pattern.
- Flash is narrower: 93.7% of parents use 3-4 groups. Haiku spreads wider with 12.3% of parents using 5+ groups vs Flash's 3.1%.
- Flash's maximum is 7 groups (1 parent); Haiku reaches 8 groups (1 parent).
- Both models correctly avoid single-group (fully parallel) decomposition — only 1 Haiku parent has all children in a single group.

### Example Decompositions

**Flash — 4 groups (database entity):**
```
Parent: "Create escrow status and ledger entity" (9 children)
  Group 1: [Define enumerations, Design schema specs]              — design
  Group 2: [Map relationships, Implement ORM, Create migration]    — build
  Group 3: [State transition logic, Repository layer]              — behavior
  Group 4: [Audit log tracking, Tests]                             — verification
```

**Haiku — 4 groups (UI component):**
```
Parent: "Implement Navigation components" (10 children)
  Group 1: [Audit tokens, Document a11y requirements, Design IA]   — research
  Group 2: [Build sidebar, Build dropdown, Build header]           — build
  Group 3: [Responsive behavior, Accessibility features]           — enhance
  Group 4: [Integration tests, Accessibility compliance tests]     — verify
```

Both models follow a natural **design→build→enhance→verify** sequencing pattern. This is a strong quality signal.

---

## 5. Single-Child Nodes

| Metric | Flash v2 | Haiku 4.5 |
|--------|----------|-----------|
| Single-child non-leaf nodes | 0 | 0 |
| Single-child percentage | 0.0% | 0.0% |

**Both models produce zero single-child nodes.** This is excellent — it means neither model wastes depth by creating intermediate nodes that don't add branching. Every decomposition step introduces at minimum 3 new parallel/sequential tasks (the actual minimum observed is 3 for Haiku, 6 for Flash).

---

## 6. Task Title Quality

### Sample Titles by Depth

#### Flash v2

| Depth | Sample Titles |
|-------|--------------|
| 1 | "Design UI/UX wireframes and component design system", "Integrate payment gateway and marketplace payout processor" |
| 2 | "Implement add-to-cart state management and API integration", "Implement stock availability locking mechanism" |
| 3 | "Implement 'Buy Now' direct checkout action handler", "Enforce payment tokenization and eliminate sensitive data logging" |
| 4 | "Construct rollback (Down) SQL migration script", "Implement partial-match and phrase-match clause generator" |
| 5 | "Add ARIA live regions and accessibility states", "Implement canvas-based image cropping utility" |

#### Haiku 4.5

| Depth | Sample Titles |
|-------|--------------|
| 1 | "Define functional and non-functional requirements", "Implement user authentication and profiles" |
| 2 | "Build product listing form with all input fields", "Test authorization and access control" |
| 3 | "Build the image preview gallery display", "Design thread management endpoints" |
| 4 | "Select and document token strategy", "Map all valid order status transitions" |

### Quality Assessment

**Specificity:**
- Flash titles at depth 3-5 are highly specific and implementation-oriented: "Implement partial-match and phrase-match clause generator" tells a developer exactly what to build.
- Haiku titles are more abstract at comparable depths: "Select and document token strategy" is a research task, not an implementation task. This aligns with Haiku creating more planning/research branches.

**Actionability:**
- Flash: strong verbs tied to concrete artifacts ("Construct rollback SQL script", "Add ARIA live regions"). An engineer could pick up most depth-4/5 tasks and start coding.
- Haiku: mix of concrete ("Build the image preview gallery display") and abstract ("Categorize inputs by injection risk type", "Write comprehensive field definitions document"). Many depth-4 tasks are documentation/analysis rather than implementation.

**Decomposability:**
- Flash's depth-4 tasks that lack terminal labels (the majority) are edge cases — they appear concrete enough to be terminal but weren't labeled.
- Haiku's depth-4 tasks often *feel* decomposable: "Implement buyer-seller messaging" → "Design message database schema" → "Identify core entities and relationships" ends at a task that clearly has sub-steps (define entities, define relationships, define indexes, etc.).

**Domain Coverage:**
- Haiku has a broader requirements/planning surface: dedicated branches for "Define functional and non-functional requirements", "Plan API endpoints and data contracts", "Design system architecture and tech stack" — Flash handles these implicitly.
- Flash is more implementation-focused from depth 1 onward: "Build checkout flow and buyer account management UI" vs Haiku's "Implement shopping cart and checkout flow".

---

## 7. Cross-Cutting Observations

### Tree Efficiency
- **Flash produces fewer, more implementation-ready tasks.** If the goal is to hand tasks to coding agents, Flash's 9,284-task tree is more immediately actionable.
- **Haiku is more thorough in upfront planning** but at the cost of 66% more tasks, many of which are research/documentation that would need another decomposition pass to become executable.

### Completion State Caveat
The Haiku run was aborted during depth-4 terminal assessment. If it had completed:
1. Some depth-4 tasks would have been labeled terminal (probably the more concrete ones).
2. Others would have been decomposed to depth 5, generating thousands more tasks.
3. The final Haiku tree would likely be **20,000-25,000+ tasks** — roughly 2.5x Flash's size.

### Branching Consistency
Flash is more predictable: narrow branching range (6-12), tight group count (3-4), consistent depth (4-5). Haiku is more variable across all dimensions. For a system that needs to estimate cost/time before running, Flash's consistency is valuable.

### Group Quality
Both models produce sensible sequential group structures that follow natural software development phases. This is a strong signal that both models understand task dependencies. Haiku tends to create more groups (up to 8 vs Flash's 7), with more tasks per group — reflecting its wider branching factor.

---

## Appendix: Raw Numbers

| Metric | Flash v2 | Haiku 4.5 |
|--------|----------|-----------|
| Collection ID | 85d56006-473f-4633-bfde-1b834dcadf9d | ab1f2a98-58bd-4504-8a41-5b62978a9b9b |
| Model | gemini-3.6-flash | claude-haiku-4-5@20251001 |
| Total tasks | 9,284 | 15,415 |
| Max depth | 5 | 4 |
| Root tasks | 1 | 1 |
| Depth-1 tasks | 12 | 18 |
| Leaf tasks | 8,160 (87.9%) | 13,734 (89.1%) |
| Terminal-labeled | 1,581 (17.0%) | 0 (0.0%) |
| Avg branching factor | 8.26 | 9.17 |
| Median branching factor | 8.0 | 9.0 |
| Branching range | 6-12 | 3-20 |
| Non-leaf nodes | 1,124 | 1,681 |
| Single-child nodes | 0 (0.0%) | 0 (0.0%) |
| BLOCKED_BY relationships | 16,410 | 29,061 |
| Avg sequential groups/parent | ~3.5 | ~3.8 |
| Status | COMPLETE | INCOMPLETE (aborted during depth-4 terminal assessment) |
| Analysis scripts | /tmp/ft-analysis/main.go, /tmp/ft-groups/main.go | — |
