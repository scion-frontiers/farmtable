# Flash v1 vs v2 Decomposition Tree Analysis

**Model:** gemini-3.6-flash
**Prompt:** 'Build an ecommerce website that allows users to buy and sell vintage action figures'

## 1. Task Count Discrepancy

| Metric | v1 (original) | v2 (improved) | Ratio |
|--------|--------------|---------------|-------|
| Total tasks | 1543 | 9284 | 6.0x |
| Root tasks | 1 | 1 | |
| Max depth | 4 | 5 | |
| Orphan tasks | 0 | 0 | |

### Depth-by-depth task counts

| Depth | v1 Count | v2 Count | v2/v1 Ratio |
|-------|----------|----------|-------------|
| 0 | 1 | 1 | 1.0x |
| 1 | 11 | 12 | 1.1x |
| 2 | 98 | 106 | 1.1x |
| 3 | 830 | 917 | 1.1x |
| 4 | 603 | 6830 | 11.3x |
| 5 | 0 | 1418 | N/A |

## 2. Tree Shape & Branching Factor

| Metric | v1 | v2 |
|--------|-------|-------|
| Avg branching factor (non-leaf) | 8.43 | 8.26 |
| Median branching factor | 8.0 | 8.0 |
| Non-leaf nodes | 183 | 1124 |
| Leaf nodes | 1360 | 8160 |

### Branching factor distribution (children per parent)

| Children | v1 Parents | v2 Parents |
|----------|-----------|------------|
| 0 (leaf) | 1360 | 8160 |
| 1 | 1 | 0 |
| 6 | 4 | 53 |
| 7 | 28 | 201 |
| 8 | 60 | 438 |
| 9 | 62 | 288 |
| 10 | 25 | 125 |
| 11 | 3 | 16 |
| 12 | 0 | 3 |

## 3. Branch Path Sampling

### v1 Sample Paths (root → leaf)

**Path 1** (depth 3):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Design system architecture and database schema`
    `Evaluate and select core technology stack`
      `Evaluate backend frameworks for multi-vendor marketplace APIs`

**Path 2** (depth 3):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Set up project repository and CI/CD infrastructure`
    `Configure automated deployment preview pipeline`
      `Define preview environment configurations and variables`

**Path 3** (depth 4):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Implement user authentication and authorization service`
    `Build automated unit and integration test suite for auth and profiles`
      `Execute end-to-end integration test suite for full user lifecycle`
        `Implement end-to-end admin lifecycle and user governance journey`

**Path 4** (depth 3):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Build marketplace storefront and search UI`
    `Build product detail page shell and figure grading breakdown`
      `Implement the detailed product metadata grid component`

**Path 5** (depth 4):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Implement shopping cart and checkout UI`
    `Build shipping address entry form`
      `Implement saved address fetch and management hooks`
        `Implement HTTP client utility for fetching saved addresses`

**Path 6** (depth 4):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Implement shopping cart and checkout UI`
    `Assemble main checkout page and submission workflow`
      `Design and implement checkout state management`
        `Implement core checkout state reducer and action dispatchers`

**Path 7** (depth 4):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Implement shopping cart and checkout UI`
    `Build buyer order history and order tracking page`
      `Implement real-time order status updates for active shipments`
        `Manage lifecycle cleanup and channel subscriptions`

### v2 Sample Paths (root → leaf)

**Path 1** (depth 3):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Design database schema and data models for marketplace`
    `Design User Accounts and Profiles Schema`
      `Design user accounts and authentication credentials schema`

**Path 2** (depth 4):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Implement user authentication and profile management API`
    `Design and implement database models for users and profiles`
      `Define indexes, check constraints, and validation rules`
        `Implement model validations and DB constraints for User Profiles and Shipping Addresses`

**Path 3** (depth 4):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Implement shopping cart and order lifecycle backend`
    `Implement stock availability locking mechanism`
      `Implement expired lock cleanup and auto-release handling`
        `Define expiration event schemas and messaging payload formats`

**Path 4** (depth 4):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Implement specialized search and filtering engine`
    `Build real-time index synchronization worker`
      `Build data drift reconciliation and audit job`
        `Build record comparison and discrepancy detection engine`

**Path 5** (depth 4):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Build public storefront and listing discovery UI`
    `Set up frontend project scaffolding, routing, and layout shell`
      `Assemble root layout shell and verify page transitions`
        `Establish responsive breakpoints and layout sizing variables`

**Path 6** (depth 5):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Build seller dashboard and listing creation UI`
    `Implement individual listing wizard form step views`
      `Build Condition Grading & Accessories step view`
        `Build Flaws and Paint Wear Description Inputs`
          `Implement ARIA attributes and keyboard navigation for flaw controls`

**Path 7** (depth 4):
`Build an ecommerce website that allows users to buy and sell vintage action figures`
  `Build seller dashboard and listing creation UI`
    `Integrate complete seller web interface and end-to-end flows`
      `Configure client-side routing for seller portal`
        `Implement default route redirects and fallback 404 handling`

## 4. Terminal Self-Assessment (decomposer:terminal label)

| Depth | v1 Terminal | v1 Total | v1 % | v2 Terminal | v2 Total | v2 % |
|-------|-------------|----------|------|-------------|----------|------|
| 0 | 0 | 1 | 0.0% | 0 | 1 | 0.0% |
| 1 | 0 | 11 | 0.0% | 0 | 12 | 0.0% |
| 2 | 0 | 98 | 0.0% | 1 | 106 | 0.9% |
| 3 | 0 | 830 | 0.0% | 83 | 917 | 9.1% |
| 4 | 0 | 603 | 0.0% | 87 | 6830 | 1.3% |
| 5 | 0 | 0 | 0.0% | 1410 | 1418 | 99.4% |

**v1 total terminal-labeled:** 0 / 1543 (0.0%)
**v2 total terminal-labeled:** 1581 / 9284 (17.0%)

## 5. Single-Child Nodes (Quality Anti-Pattern)

| Metric | v1 | v2 |
|--------|-------|-------|
| Single-child non-leaf nodes | 1 | 0 |
| Total non-leaf nodes | 183 | 1124 |
| Single-child percentage | 0.5% | 0.0% |

## 6. Group Encoding Patterns

### v1 Group distribution by depth

**Depth 1:** 1 distinct groups, group 'Conduct end': 1 tasks
**Depth 2:** 12 distinct groups, group 'Implement multi': 2 tasks, group 'Build interactive high': 1 tasks, group 'Optimize responsive layout and cross': 1 tasks, group 'Create multi': 1 tasks, group 'Configure end': 1 tasks, group 'Configure pre': 1 tasks, group 'Implement role': 1 tasks, group 'Integrate real': 1 tasks, group 'Build post': 1 tasks, group 'Test post': 1 tasks
**Depth 3:** 95 distinct groups, group 'Implement post': 4 tasks, group 'Implement real': 2 tasks, group 'Implement role': 2 tasks, group 'Design high': 2 tasks, group 'Create Husky commit': 1 tasks, group 'Implement rate': 1 tasks, group 'Implement end': 1 tasks, group 'Design full': 1 tasks, group 'Build drag': 1 tasks, group 'Evaluate and select high': 1 tasks
**Depth 4:** 63 distinct groups, group 'Implement end': 4 tasks, group 'Implement real': 2 tasks, group 'Implement multi': 2 tasks, group 'Validate end': 2 tasks, group 'Define prop interfaces for summary sub': 1 tasks, group 'Connect product listing add': 1 tasks, group 'Implement item image thumbnail sub': 1 tasks, group 'Build figure metadata display sub': 1 tasks, group 'Build the screen': 1 tasks, group 'Unit test single': 1 tasks

### v2 Group distribution by depth

**Depth 1:** 2 distinct groups, group 'Implement buyer': 1 tasks, group 'Perform end': 1 tasks
**Depth 2:** 11 distinct groups, group 'Develop multi': 2 tasks, group 'Implement soft': 1 tasks, group 'Build real': 1 tasks, group 'Implement add': 1 tasks, group 'Integrate complete seller web interface and end': 1 tasks, group 'Build core full': 1 tasks, group 'Implement real': 1 tasks, group 'Build API for in': 1 tasks, group 'Verify real': 1 tasks, group 'Execute production release and complete post': 1 tasks
**Depth 3:** 89 distinct groups, group 'Design high': 4 tasks, group 'Implement real': 3 tasks, group 'Execute end': 3 tasks, group 'Design in': 3 tasks, group 'Verify end': 2 tasks, group 'Write end': 2 tasks, group 'Implement client': 2 tasks, group 'Validate end': 2 tasks, group 'Implement soft': 2 tasks, group 'Design multi': 2 tasks
**Depth 4:** 626 distinct groups, group 'Implement multi': 12 tasks, group 'Design multi': 10 tasks, group 'Execute end': 7 tasks, group 'Implement real': 7 tasks, group 'Implement client': 6 tasks, group 'Validate end': 6 tasks, group 'Write end': 6 tasks, group 'Implement double': 5 tasks, group 'Implement server': 5 tasks, group 'Implement end': 5 tasks
**Depth 5:** 152 distinct groups, group 'Implement client': 3 tasks, group 'Verify end': 2 tasks, group 'Configure dual Y': 2 tasks, group 'Implement top': 2 tasks, group 'Implement canvas': 2 tasks, group 'Configure X': 2 tasks, group 'Define time': 2 tasks, group 'Implement post': 2 tasks, group 'Build multi': 2 tasks, group 'Re': 2 tasks

## 7. Completeness Check — Dropped Branches

Tasks that are leaves (no children) AND lack the `decomposer:terminal` label are likely branches that were silently dropped due to connection failures.

| Metric | v1 | v2 |
|--------|-------|-------|
| Dropped leaf tasks | 1360 | 6579 |
| Dropped % of total | 88.1% | 70.9% |

### Dropped leaves by depth

| Depth | v1 Dropped | v1 Total at Depth | v1 % | v2 Dropped | v2 Total at Depth | v2 % |
|-------|-----------|-------------------|------|-----------|-------------------|------|
| 0 | 0 | 1 | 0.0% | 0 | 1 | 0.0% |
| 1 | 0 | 11 | 0.0% | 0 | 12 | 0.0% |
| 2 | 1 | 98 | 1.0% | 0 | 106 | 0.0% |
| 3 | 756 | 830 | 91.1% | 6 | 917 | 0.7% |
| 4 | 603 | 603 | 100.0% | 6565 | 6830 | 96.1% |
| 5 | 0 | 0 | 0.0% | 8 | 1418 | 0.6% |

### Sample dropped leaves in v1

- depth 3: `Evaluate backend frameworks for multi-vendor marketplace APIs` (labels: [])
- depth 3: `Evaluate frontend frameworks and rendering strategies` (labels: [])
- depth 3: `Evaluate primary relational database systems` (labels: [])
- depth 3: `Evaluate search and discovery engines` (labels: [])
- depth 3: `Evaluate caching and in-memory datastores` (labels: [])
- depth 3: `Evaluate cloud infrastructure and hosting providers` (labels: [])
- depth 3: `Analyze cross-cutting stack tradeoffs and cost estimates` (labels: [])
- depth 3: `Compile comprehensive technology decision document` (labels: [])
- depth 3: `Research vintage action figure condition grading scales` (labels: [])
- depth 3: `Analyze packaging types and condition variations` (labels: [])
- depth 3: `Identify core toy line identification metadata` (labels: [])
- depth 3: `Analyze completeness tracking and accessory authenticity` (labels: [])
- depth 3: `Specify standardized condition grading attribute schemas` (labels: [])
- depth 3: `Specify packaging type and defect attribute schemas` (labels: [])
- depth 3: `Specify core product catalog metadata attributes` (labels: [])

## Summary & Key Findings

### Root Cause of 6x Task Count Difference

**The 6x difference (1,543 → 9,284) is almost entirely caused by v1 silently dropping branches due to connection failures that v2's retry resilience prevented.**

Evidence:
- Depths 0–2 are nearly identical between v1 and v2 (within 10%). The model produces the same high-level decomposition.
- At depth 3, v1 has 830 tasks but **91.1% are leaves** (756 tasks that stopped decomposing). In v2, only 0.7% of depth-3 tasks are unexpanded leaves. This is the smoking gun: v1's connection pool issues silently ate ~750 decomposition requests at depth 3.
- v1's depth-4 layer has only 603 tasks (the children of the ~74 depth-3 tasks that did succeed). v2's depth-4 layer has 6,830 tasks — the children of all ~911 depth-3 tasks that were successfully decomposed.
- v2 also reaches depth 5 (1,418 tasks) which v1 never reached at all.

### Key Findings

1. **v1 was catastrophically incomplete.** 91% of depth-3 tasks were silently dropped — the original code had no retry logic, and connection pool exhaustion caused most decomposition calls at depth 3+ to fail silently. The tree looks structurally sound but is missing most of its lower branches.

2. **Branching structure is identical when decomposition succeeds.** Both trees have avg branching factor ~8.3 and median 8. The distribution shape (mostly 7-9 children per parent) is the same. The model is consistent across runs — the difference is purely in how many branches the code successfully completed.

3. **v1 has ZERO terminal labels.** The `decomposer:terminal` labeling feature didn't exist in v1's code. Every leaf in v1 is unlabeled, making it impossible to distinguish "legitimately terminal" from "silently dropped" using labels alone. We can only infer drops by comparing depth patterns to v2.

4. **v2's terminal labeling works well at its actual max depth.** At depth 5, 99.4% of tasks have the `decomposer:terminal` label. At depth 4, only 1.3% are labeled terminal (87 out of 6,830) — meaning the model mostly views depth-4 tasks as decomposable, and only stops at depth 5.

5. **v2 goes one level deeper than v1** (max depth 5 vs 4). This may reflect a change in depth-limit behavior in the improved code, or it may simply be that v1 never reached the point where depth-5 decomposition would trigger.

6. **Single-child anti-pattern is negligible** in both trees: 0.5% in v1 (1 node), 0.0% in v2. The model consistently produces multi-child decompositions.

7. **v2 still has a completeness gap at depth 4.** 96.1% of depth-4 tasks are leaves without `decomposer:terminal` labels. Since depth 5 only has 1,418 tasks (from 6,830 depth-4 parents), only ~265 depth-4 tasks were further decomposed. This suggests either (a) the depth limit caps decomposition for most depth-4 tasks, or (b) there are still some silent failures even with retry resilience, just at a much lower rate.

8. **Group encoding patterns are similar.** Both trees use the `<NN>-<slug>` convention. The group diversity at each depth is comparable — v2 has more groups at depth 4 simply because it has more tasks there.

### Conclusions

- **The retry resilience fix is the primary cause of the 6x difference.** This is not model variance — the identical tree shape at depths 0-2 and matching branching factors prove the model is deterministic enough. v1 simply couldn't complete the tree.
- **Terminal labeling is a v2-only feature** and works correctly. v1 predates it.
- **For future runs, the depth-4 gap in v2 should be investigated.** Are 6,500+ depth-4 leaves legitimately terminal (model thinks they're atomic) or are some still being dropped? The 99.4% label rate at depth 5 suggests the model labels reliably when it considers a task terminal — so the depth-4 unlabeled leaves may indicate the depth limit is preventing further decomposition rather than labeling the task as terminal.

## Raw Statistics (JSON)

```json
{
  "v1": {
    "avg_branching": 8.43,
    "depth_counts": {
      "0": 1,
      "1": 11,
      "2": 98,
      "3": 830,
      "4": 603
    },
    "dropped_leaves": 1360,
    "max_depth": 4,
    "median_branching": 8,
    "non_leaf_nodes": 183,
    "orphan_count": 0,
    "root_count": 1,
    "single_child": 1,
    "total_tasks": 1543,
    "total_terminal": 0
  },
  "v2": {
    "avg_branching": 8.26,
    "depth_counts": {
      "0": 1,
      "1": 12,
      "2": 106,
      "3": 917,
      "4": 6830,
      "5": 1418
    },
    "dropped_leaves": 6579,
    "max_depth": 5,
    "median_branching": 8,
    "non_leaf_nodes": 1124,
    "orphan_count": 0,
    "root_count": 1,
    "single_child": 0,
    "total_tasks": 9284,
    "total_terminal": 1581
  }
}
```
