# Analysis: Flash vs Flash-Lite Decomposition Tree Comparison

**Date:** 2026-07-23
**Analyst:** Opus 4.6 agent (architect)
**Context:** Two decomposer runs against the same input prompt ("Build an ecommerce website that allows users to buy and sell vintage action figures") with different models, using the same system prompt and Farmtable API.

## Collections

| | Flash (default) | Flash-lite |
|---|---|---|
| **Model** | `gemini-3.6-flash` | `gemini-3.5-flash-lite` |
| **Collection ID** | `cd948a8e-c57e-423f-beda-2d425dd01869` | `3afcd03e-146a-426b-a5d8-e5b2678861d9` |
| **Initial concurrency** | 4 | 8 (later reduced to 4) |
| **Project name** | Vintage Action Figures Ecommerce | Vintage Action Figures Ecommerce v3 - flash-lite |

---

## 1. Structural Overview

| Metric | Flash (3.6-flash) | Flash-lite (3.5-flash-lite) | Ratio |
|---|---|---|---|
| Total tasks | 1,543 | 20,739 | 13.4x |
| Leaf tasks | 1,360 | 15,307 | 11.3x |
| Terminal labeled | 0 | 144 | -- |
| Internal nodes | 183 | 5,432 | 29.7x |
| Max depth | 4 | 7 (hard cap) | 1.75x |

Notes:
- Flash has 0 tasks explicitly labeled `decomposer:terminal` yet its tree stops cleanly at depth 4 with all depth-3 and depth-4 tasks being genuine atomic implementation tasks. This likely means the terminal label was not being applied in the flash run, or the model judged tasks as terminal and they simply became leaves.
- Flash-lite has only 144 tasks self-assessed as terminal out of 20,739 (0.7%). The tree was still actively decomposing when the depth-7 hard cap forced it to stop.

---

## 2. Depth Distribution

| Depth | Flash tasks | Flash leaves | Lite tasks | Lite leaves |
|---|---|---|---|---|
| 0 | 1 | 0 | 1 | 0 |
| 1 | 11 | 0 | 10 | 0 |
| 2 | 98 | 1 | 72 | 0 |
| 3 | 830 | 756 | 468 | 0 |
| 4 | 603 | 603 | 2,565 | 644 |
| 5 | -- | -- | 5,104 | 4,036 |
| 6 | -- | -- | 3,367 | 1,475 |
| 7 | -- | -- | 9,152 | 9,152 |

Key observations:
- **Flash terminates almost entirely at depths 3-4.** 756 leaves at d3, 603 at d4. Very clean, flat tree.
- **Flash-lite has zero leaves before depth 4.** It never considers any d1/d2/d3 task as terminal.
- **The depth-7 cliff:** 9,152 tasks (44% of the entire tree) are forced-terminal because they hit the max depth cap. Flash-lite was still trying to decompose further.
- Flash-lite has 6,155 leaves at depths 4-6, representing the minority of tasks where the model actually stopped decomposing before hitting the cap.

### Terminal Tasks by Depth (flash-lite only)

Of the 144 tasks explicitly labeled `decomposer:terminal`:
| Depth | Terminal count |
|---|---|
| 4 | 6 |
| 5 | 30 |
| 6 | 108 |

Zero terminal-labeled tasks at depths 0-3. The model essentially never decides to stop decomposing in the upper half of the tree.

---

## 3. Branching Factor

### Overall Statistics

| Metric | Flash | Flash-lite |
|---|---|---|
| Avg children/node | 8.43 | 3.82 |
| Std dev | 1.17 | 2.37 |
| Min children | 1 | 1 |
| Max children | 11 | 11 |

### Branching Factor by Depth

| Depth | Flash avg (n) | Lite avg (n) |
|---|---|---|
| 0 | 11.0 (1) | 10.0 (1) |
| 1 | 8.9 (11) | 7.2 (10) |
| 2 | 8.6 (97) | 6.5 (72) |
| 3 | 8.2 (74) | 5.5 (468) |
| 4 | N/A (0) | 2.7 (1,921) |
| 5 | N/A | 3.2 (1,068) |
| 6 | N/A | 4.8 (1,892) |

At depth 0-1, both models decompose similarly (10-11 top-level groups, 7-9 children each). The divergence starts at depth 2 and grows rapidly. By depth 4 (where flash has stopped), flash-lite still has 1,921 internal nodes decomposing further, but with only 2.7 children each on average.

### Branching Factor Histogram

| Children count | Flash nodes | Flash-lite nodes |
|---|---|---|
| 1 | 1 | 1,562 |
| 2 | 0 | 643 |
| 3 | 0 | 351 |
| 4 | 0 | 386 |
| 5 | 0 | 625 |
| 6 | 4 | 1,146 |
| 7 | 28 | 505 |
| 8 | 60 | 175 |
| 9 | 62 | 34 |
| 10 | 25 | 4 |
| 11 | 3 | 1 |

Flash is tightly clustered at 7-10 children (matching the "6-12 subtasks" guidance in the system prompt). Flash-lite's distribution peaks at 1 child and has a secondary peak at 5-6 children.

---

## 4. Single-Child Node Analysis

**Flash:** 1 single-child node out of 183 internal nodes (**0.5%**)
**Flash-lite:** 1,562 single-child nodes out of 5,432 internal nodes (**28.8%**)

Nearly 30% of flash-lite's internal nodes decompose into exactly 1 child. This is a degenerate case that adds a tree level without adding information -- it is equivalent to renaming a task.

### Sample Single-Child Chains (flash-lite)

These chains show a parent being "decomposed" into a single child, which is then decomposed into another single child, etc.:

```
Chain (len 2, depths 4->6):
  Assess international payout and multi-currency capabilities
    Analyze Stripe Connect supported countries
      Compile supported Stripe Connect platform countries

Chain (len 2, depths 4->6):
  Implement request recovery form component
    Design email input form UI and states
      Review design system tokens and guidelines

Chain (len 2, depths 3->5):
  Run production smoke tests
    Gather production endpoint inventory
      Discover and catalog public routing paths

Chain (len 2, depths 4->6):
  Evaluate and select cryptographic libraries
    Research bcrypt package features and security posture
      Analyze bcrypt cryptographic algorithm

Chain (len 2, depths 4->6):
  Implement token refresh and session persistence
    Audit existing authentication storage and state
      Inspect localStorage and sessionStorage usage

Chain (len 2, depths 4->6):
  Gather and analyze vintage toy industry reports
    Gather vintage toy industry reports and market data
      Identify key public data sources and repositories

Chain (len 2, depths 4->6):
  Run automated accessibility scanning tools
    Configure axe-core automated testing environment
      Install and configure axe-core dependency

Chain (len 2, depths 3->5):
  Configure production environment variables
    Audit all backend environment variables and secrets
      Scan backend source code for environment usage

Chain (len 2, depths 4->6):
  Implement platform fee calculation logic
    Define fee structure constants and types
      Define high-precision numeric representation types

Chain (len 2, depths 4->6):
  Design double-entry ledger schema
    Define the chart of accounts structure
      Analyze marketplace financial flows
```

Each of these chains wastes 2-3 depth levels to express what is conceptually a single task. "Evaluate and select cryptographic libraries" -> "Research bcrypt package features" -> "Analyze bcrypt cryptographic algorithm" is three names for one action.

---

## 5. Top-Level Decomposition Comparison

Both models start from the same root: "Build an ecommerce website that allows users to buy and sell vintage action figures"

### Flash: 11 Top-Level Children

| # | Task | Children |
|---|---|---|
| 0 | Design system architecture and database schema | 9 |
| 1 | Design UI/UX wireframes and key user journeys | 9 |
| 2 | Set up project repository and CI/CD infrastructure | 8 |
| 3 | Implement user authentication and authorization service | 8 |
| 4 | Build product catalog and search API | 7 |
| 5 | Implement order management and payment API | 10 |
| 6 | Build marketplace storefront and search UI | 9 |
| 7 | Develop seller dashboard and listing creation UI | 10 |
| 8 | Implement shopping cart and checkout UI | 7 |
| 9 | Conduct end-to-end testing and quality assurance | 10 |
| 10 | Deploy production platform and monitoring setup | 11 |

### Flash-lite: 10 Top-Level Children

| # | Task | Children |
|---|---|---|
| 0 | Define system requirements and user flows | 7 |
| 1 | Design database schema and data models | 7 |
| 2 | Select technology stack and architecture | 7 |
| 3 | Implement user authentication and authorization | 7 |
| 4 | Build product catalog and search backend | 5 |
| 5 | Integrate payment gateway | 8 |
| 6 | Develop buyer-facing storefront interface | 8 |
| 7 | Develop seller dashboard and listing management | 6 |
| 8 | Implement checkout and order management | 9 |
| 9 | Perform testing, quality assurance, and deployment | 8 |

The top-level decomposition is comparable (10-11 categories, similar themes). The divergence begins at depth 2 and below.

---

## 6. Sample Branch Traces

### Flash Sample Branches (root -> leaf)

Each branch shows the path from a depth-1 category down to a terminal leaf.

```
Branch 1: Architecture path
  d1: Design system architecture and database schema (9 children)
    d2: Evaluate and select core technology stack (8 children)
      d3: Evaluate backend frameworks for multi-vendor marketplace APIs [LEAF]

Branch 2: Auth path
  d1: Implement user authentication and authorization service (8 children)
    d2: Design user, role, address, and payment preference database schemas (8 children)
      d3: Define Users and Roles schema and ORM entities [LEAF]

Branch 3: Seller dashboard path
  d1: Develop seller dashboard and listing creation UI (10 children)
    d2: Build seller workspace navigation and layout wrapper (6 children)
      d3: Implement seller authorization and route guard [LEAF]

Branch 4: Deployment path
  d1: Deploy production platform and monitoring setup (11 children)
    d2: Provision production database cluster (8 children)
      d3: Define database engine, sizing, and scaling parameters [LEAF]
```

Flash's leaves are concrete, actionable implementation tasks. "Define Users and Roles schema and ORM entities" or "Implement seller authorization and route guard" are 1-4 hour tasks a developer can pick up and execute.

### Flash-Lite Sample Branches (root -> depth-7 leaf)

```
Branch 1: DB Schema -> FK constraints path
  d0: Build an ecommerce website... (10 children)
  d1: Design database schema and data models (7 children)
    d2: Establish relational constraints and referential integrity (8 children)
      d3: Define user, role, and profile relationships (6 children)
        d4: Configure cascading deletion and update rules (6 children)
          d5: Define foreign key actions for auth-to-role relations (6 children)
            d6: Review security and compliance requirements for data deletion (6 children)
              d7: Synthesize final constraint summary and cascade safety report [LEAF]

Branch 2: Storefront -> filter testing path
  d0: Build an ecommerce website... (10 children)
  d1: Develop buyer-facing storefront interface (8 children)
    d2: Build category browsing and filtering interface (6 children)
      d3: Design filter state management and URL parameter sync (6 children)
        d4: Write unit tests for filter state and URL serialization (3 children)
          d5: Write unit tests for URL serialization and parsing (8 children)
            d6: Test parser resilience against malformed inputs (8 children)
              d7: Verify graceful failure and error suppression [LEAF]

Branch 3: Seller dashboard -> test data path
  d0: Build an ecommerce website... (10 children)
  d1: Develop seller dashboard and listing management (6 children)
    d2: Build active inventory management view (7 children)
      d3: Connect dashboard UI to inventory data queries (7 children)
        d4: Verify inventory integration with end-to-end testing (3 children)
          d5: Seed database with varied test inventory data (9 children)
            d6: Generate long title and special character listings (6 children)
              d7: Generate international Unicode character products [LEAF]

Branch 4: Checkout -> auth middleware path
  d0: Build an ecommerce website... (10 children)
  d1: Implement checkout and order management (9 children)
    d2: Build order confirmation view and receipt generation (6 children)
      d3: Build API endpoint for order confirmation details (6 children)
        d4: Implement authentication and authorization middleware (6 children)
          d5: Implement authentication middleware (7 children)
            d6: Implement credential extraction logic (5 children)
              d7: Define credential extraction interfaces and types [LEAF]

Branch 5: Checkout -> idempotency policy path
  d0: Build an ecommerce website... (10 children)
  d1: Implement checkout and order management (9 children)
    d2: Define checkout and payment API contracts (7 children)
      d3: Specify payment authorization API endpoint and behavior (5 children)
        d4: Document idempotency and retry behavior for payment requests (8 children)
          d5: Define error handling and edge case scenarios (5 children)
            d6: Document error handling for expired idempotency keys (5 children)
              d7: Define idempotency key retention window policy [LEAF]
```

Flash-lite's depth-7 leaves are absurdly fine-grained:
- "Synthesize final constraint summary and cascade safety report" -- a sub-sub-sub-task of FK constraint design
- "Verify graceful failure and error suppression" -- testing that a URL parser does not crash
- "Generate international Unicode character products" -- creating a few test records
- "Define credential extraction interfaces and types" -- writing a TypeScript interface
- "Define idempotency key retention window policy" -- deciding on a TTL value

These are 5-minute tasks that flash would (correctly) fold into their parent implementation task.

### Flash-Lite Depth-6 Nodes Still Decomposing (d6 -> d7 expansions)

These show what flash-lite considers worthy of further decomposition at depth 6:

```
d6: Expose clean status flags to the component (5 children)
  d7: Audit existing hook flag exposure
  d7: Define clear state flag contract
  d7: Refactor hook to streamline status flags
  d7: Add tests for hook state transitions
  d7: Verify integration with confirmation view layer

d6: Document mapping assumptions and constraints (6 children)
  d7: Compile cross-referencing assumptions
  d7: Document inferred access rules
  d7: Enumerate mapping limitations and edge cases
  d7: Structure the explanatory document
  d7: Refine context and explanations for clarity
  d7: Cross-link explanatory notes to mapping entries

d6: Write the complete draft of the justification report (5 children)
  d7: Compile evaluation matrix metrics
  d7: Draft report executive summary and introduction
  d7: Outline trade-off analysis sections
  d7: Write performance comparison narrative
  d7: Write bundle size and footprint narrative

d6: Compile platform security goals (4 children)
  d7: Review authentication assurance level frameworks
  d7: Analyze platform vulnerability to phishing vectors
  d7: Audit credential-stuffing historical data and vectors
  d7: Synthesize security goals across assurance and threat domains

d6: Verify successful payment gateway sandbox connection (5 children)
  d7: Check application status endpoint
  d7: Inspect runtime metrics and telemetry
  d7: Examine stdout and log files for authentication records
  d7: Verify absence of sensitive credential leakage in logs
  d7: Synthesize SDK connection verification report

d6: Configure and verify sandbox email receiver (1 child)
  d7: Acquire sandbox email receiver credentials
```

"Verify successful payment gateway sandbox connection" being decomposed into 5 sub-tasks is a clear sign of over-decomposition. This is a single verification step.

---

## 7. Detailed Subtree Comparison: Authentication

### Flash: Auth Subtree (~210 tasks, depths 1-4)

```
Implement user authentication and authorization service (d1, 8 children)
  Design user, role, address, and payment preference database schemas (d2, 8 children)
    Define Users and Roles schema and ORM entities (d3) [LEAF]
    Define Active Sessions schema and ORM entities (d3) [LEAF]
    Define MFA Secrets and security schema and ORM entities (d3) [LEAF]
    Define Address Book schema and ORM entities (d3) [LEAF]
    Define Payment Preferences schema and ORM entities (d3) [LEAF]
    Create database migration scripts for auth and profile entities (d3) [LEAF]
    Create database seeders for initial roles and reference data (d3) [LEAF]
    Validate migration execution and ORM entity mapping (d3) [LEAF]
  Implement password hashing and token management utilities (d2, 7 children)
    Configure cryptographic parameters and key management utilities (d3) [LEAF]
    Implement password hashing and verification helper module (d3) [LEAF]
    Implement JWT access and refresh token generation helper (d3) [LEAF]
    Implement JWT verification and decoding helper (d3) [LEAF]
    Implement token revocation storage interface (d3) [LEAF]
    Implement token revocation and session invalidation helper (d3) [LEAF]
    Build unit and security test suite for auth helper modules (d3, 1 child)
      Set up test framework harness and cryptographic fixtures (d4) [LEAF]
  Implement user registration, login, and session endpoints (d2, 8 children)
    Design authentication DTO schemas and input validation rules (d3) [LEAF]
    Implement rate-limiting and standardized error-handling middleware (d3) [LEAF]
    Implement token generation and verification services (d3) [LEAF]
    Implement user registration endpoint (d3) [LEAF]
    Implement credentials verification and login endpoint (d3) [LEAF]
    Implement token refresh endpoint (d3) [LEAF]
    Implement user logout and token invalidation endpoint (d3) [LEAF]
    Write comprehensive unit and integration tests for auth endpoints (d3) [LEAF]
  Implement multi-factor authentication (MFA) endpoints (d2, 10 children)
    Design and implement database schema for MFA and recovery codes (d3) [LEAF]
    Implement core TOTP and QR code utility functions (d3) [LEAF]
    Build endpoint to initiate MFA setup and generate QR code (d3) [LEAF]
    Build endpoint to verify TOTP code and finalize MFA activation (d3) [LEAF]
    Build backup recovery code generation and management endpoint (d3) [LEAF]
    Build step-up MFA login verification endpoint (d3) [LEAF]
    Build endpoint to disable MFA with credential confirmation (d3) [LEAF]
    Build endpoint to retrieve user MFA configuration status (d3) [LEAF]
    Implement unit tests for TOTP and MFA business logic (d3) [LEAF]
    Implement end-to-end integration tests for MFA API endpoints (d3) [LEAF]
  Implement role-based access control (RBAC) middleware (d2, 7 children)
    Define RBAC permission matrix and access policy schema (d3, 9 d4-leaves)
      Define system roles and hierarchy model (d4) [LEAF]
      Establish standardized permission scope taxonomy (d4) [LEAF]
      Map buyer actions to permission scopes (d4) [LEAF]
      Map seller actions to permission scopes (d4) [LEAF]
      Map administrator actions to permission scopes (d4) [LEAF]
      Design authorization policy type interfaces and schema (d4) [LEAF]
      Implement policy configuration constants and enum module (d4) [LEAF]
      Build permission evaluation and scope resolution helpers (d4) [LEAF]
      Write unit tests for authorization policy module (d4) [LEAF]
    Implement request credential extraction and verification middleware (d3, 9 d4-leaves)
    Implement role-based authorization middleware guards (d3, 10 d4-leaves)
    Implement resource-level ownership authorization helpers (d3, 7 d4-leaves)
    Implement standardized 401 and 403 error response handlers (d3, 6 d4-leaves)
    Write unit tests for credential extraction and authentication parsing (d3, 8 d4-leaves)
    Write integration tests for RBAC and resource ownership guards (d3, 9 d4-leaves)
  Implement user profile and address book management endpoints (d2, 7 children)
    [7 d3-level leaf tasks: profile endpoints, address CRUD, default address logic, tests]
  Implement user payment preferences management endpoints (d2, 10 children)
    [10 d3-level leaf tasks: schema, DTOs, data access, validation, CRUD endpoints, tests]
  Build automated unit and integration test suite for auth and profiles (d2, 9 children)
    [9 d3-level tasks, each with 7-10 d4-level leaves: test env setup, registration tests,
     MFA tests, RBAC tests, profile tests, address tests, payment tests, security tests, E2E]
```

Flash's auth tree is well-structured: 8 d2-level categories, most leaves at d3, with the RBAC and test-suite sections going one level deeper to d4. Total ~210 tasks. Each leaf is a coherent 1-4 hour implementation task.

### Flash-Lite: Auth Subtree (~2,700 tasks, depths 1-7)

The flash-lite auth tree is too large to reproduce in full. Here is a representative excerpt showing the depth explosion under "Select and configure authentication provider":

```
Implement user authentication and authorization (d1, 7 children)
  Select and configure authentication provider (d2, 6 children)
    Evaluate authentication providers against requirements (d3, 5 children)
      Define security and compliance requirements (d4, 1 child)
        Research modern password hashing standards (d5) [LEAF]
      Analyze scalability and pricing models (d4, 6 children)
        Model expected user growth trajectories (d5) [LEAF]
        Analyze Auth0 pricing tiers and cost projections (d5, 8 children)
          Analyze Auth0 Free tier limits and features (d6, 6 children)
            Review Free plan MAU limits (d7) [LEAF]
            Catalog included core features (d7) [LEAF]
            Identify supported core identity providers (d7) [LEAF]
            Audit Free tier restrictions and limitations (d7) [LEAF]
            Synthesize Free tier coverage summary (d7) [LEAF]
            Define Free tier viability thresholds (d7) [LEAF]
          Analyze Auth0 Developer/Production paid tiers (d6, 6 children)
            Review Auth0 developer tier pricing and features (d7) [LEAF]
            Review Auth0 standard production tier pricing and features (d7) [LEAF]
            Analyze per-MAU scaling and overage fees (d7) [LEAF]
            Identify volume breakpoints and thresholds (d7) [LEAF]
            Document tiered discount and volume pricing structures (d7) [LEAF]
            Synthesize pricing tiers into a unified comparison model (d7) [LEAF]
          Analyze Auth0 Enterprise tier and custom pricing (d6, 5 children)
            Research enterprise-only Auth0 features (d7) [LEAF]
            Investigate enterprise SLA guarantees (d7) [LEAF]
            Determine entry criteria for enterprise agreements (d7) [LEAF]
            Analyze negotiated volume discounts and cost models (d7) [LEAF]
            Synthesize enterprise pricing and structure documentation (d7) [LEAF]
          Evaluate add-on feature and extension costs (d6, 5 children)
            Analyze advanced MFA pricing model (d7) [LEAF]
            Analyze machine-to-machine pricing model (d7) [LEAF]
            Analyze breached password detection pricing model (d7) [LEAF]
            Analyze custom domains pricing model (d7) [LEAF]
            Synthesize add-on pricing structures into a matrix (d7) [LEAF]
          Evaluate overage fee structure and penalties (d6, 5 children)
            Review official Auth0 MAU overage documentation (d7) [LEAF]
            Analyze automatic tier bumping and plan enforcement (d7) [LEAF]
            Research per-user overage penalty rates (d7) [LEAF]
            Model unexpected user growth spike financial scenarios (d7) [LEAF]
            Document unexpected growth billing impact findings (d7) [LEAF]
          Build user growth and MAU projection model (d6, 7 children)
            Define planning horizon and milestones (d7) [LEAF]
            Gather historical metrics and baseline data (d7) [LEAF]
            Project monthly active user trajectories (d7) [LEAF]
            Estimate anticipated M2M token volumes (d7) [LEAF]
            Model authentication frequency and patterns (d7) [LEAF]
            Synthesize time-series user metrics dataset (d7) [LEAF]
            Document growth model assumptions and methodology (d7) [LEAF]
          Project total Auth0 costs against growth model (d6, 6 children)
            Parse and structure user growth projection data (d7) [LEAF]
            Compile Auth0 pricing tiers and rule engine parameters (d7) [LEAF]
            Calculate month-by-month costs for Free plan (d7) [LEAF]
            Calculate month-by-month costs for Developer plan (d7) [LEAF]
            Calculate month-by-month costs for Enterprise plan (d7) [LEAF]
            Aggregate and format multi-plan cost comparisons (d7) [LEAF]
          Produce final Auth0 cost projection and comparison report (d6, 7 children)
            Compile cost projections across tiers (d7) [LEAF]
            Synthesize feature availability and constraints (d7) [LEAF]
            Document user growth trajectory milestones (d7) [LEAF]
            Determine optimal pricing plan transition timeline (d7) [LEAF]
            Draft executive summary and key findings (d7) [LEAF]
            Write and format comprehensive final report (d7) [LEAF]
            Review report against stakeholder objectives (d7) [LEAF]
        Analyze Firebase Auth pricing tiers and cost projections (d5, 6 children)
          Analyze Firebase Auth Free Tier Allowances (d6, 4 children)
            Document Spark plan Monthly Active User limits (d7) [LEAF]
            Identify identity provider and federation limits (d7) [LEAF]
            Examine anonymous sign-in and token limits (d7) [LEAF]
            Compile comprehensive Spark plan boundary report (d7) [LEAF]
          Calculate Phone and SMS Verification Costs (d6, 7 children)
            Gather regional SMS pricing data (d7) [LEAF]
            Identify free tier SMS quotas and limits (d7) [LEAF]
            Analyze user verification usage patterns (d7) [LEAF]
            Calculate baseline per-user phone auth expenses (d7) [LEAF]
            Model free tier quota depletion thresholds (d7) [LEAF]
            Assess regional taxation and hidden fees (d7) [LEAF]
            Synthesize phone auth expense report (d7) [LEAF]
          Examine Multi-Tenant and Enterprise Billing (d6, 6 children)
            Research Firebase Identity Platform multi-tenancy architecture (d7) [LEAF]
            Examine Identity Platform base pricing for multi-tenancy (d7) [LEAF]
            Analyze per-tenant and monthly active user pricing structures (d7) [LEAF]
            Investigate pricing for advanced security features and MFA (d7) [LEAF]
            Synthesize multi-tenancy cost model across growth scenarios (d7) [LEAF]
            Draft final multi-tenancy pricing and architecture report (d7) [LEAF]
          Identify Core Scaling and Usage Thresholds (d6, 6 children)
            [6 d7-level leaves about MAU thresholds, rate limits]
          Define User Growth and Traffic Milestones (d6, 8 children)
            [8 d7-level leaves about growth modeling]
          Project Total Operational Expenses Across Growth Milestones (d6, 6 children)
            [6 d7-level leaves about cost projections]
        Estimate operational costs for a custom JWT solution (d5) [LEAF]
        Compare long-term cost projections across providers (d5) [LEAF]
        Synthesize cost evaluation into a final recommendation report (d5) [LEAF]
      Evaluate integration effort and developer experience (d4, 1 child)
        Assess SDK availability for candidates (d5) [LEAF]
      Synthesize provider comparison matrix (d4) [LEAF]
      Draft final provider recommendation report (d4) [LEAF]
    Define security policies and token lifecycle requirements (d3, 5 children)
      Define password complexity and lifecycle rules (d4, 1 child)
        Research industry password security standards (d5) [LEAF]
      Specify session duration and inactivity timeouts (d4, 2 children)
        Research industry session security standards (d5) [LEAF]
        Analyze buyer and seller workflow patterns (d5, 6 children)
          Map buyer session and browsing workflows (d6, 5 children)
            Analyze product discovery and search workflows (d7) [LEAF]
            Audit cart management and state persistence (d7) [LEAF]
            Review checkout process and session constraints (d7) [LEAF]
            Create buyer user journey map (d7) [LEAF]
            Draft buyer interaction workflow diagram (d7) [LEAF]
          Map seller inventory and messaging workflows (d6, 7 children)
            Analyze inventory management workflow (d7) [LEAF]
            Analyze bulk upload workflow (d7) [LEAF]
            Analyze order fulfillment workflow (d7) [LEAF]
            Analyze buyer messaging workflow (d7) [LEAF]
            Synthesize comprehensive seller daily workflow (d7) [LEAF]
            Identify active management periods versus idle time (d7) [LEAF]
            Create workflow diagram for seller interactions (d7) [LEAF]
          Audit current session timeout and limit policies (d6, 5 children)
            [5 d7-level leaves about reviewing policies]
          Assess session limit impact on buyers (d6, 5 children)
            [5 d7-level leaves about buyer impact]
          Assess session limit impact on sellers (d6, 7 children)
            [7 d7-level leaves about seller impact]
          Synthesize workflow impact and mitigation recommendations (d6, 1 child)
            Synthesize buyer session impact findings (d7) [LEAF]
      Design refresh token rotation and revocation strategy (d4) [LEAF]
      Evaluate multi-factor authentication requirements (d4, 7 children)
        [continues deeper...]
    [... 4 more d3-level children continue with similar depth ...]
```

This single sub-branch ("Auth0 pricing analysis") alone generates ~60 d7-level leaf tasks. The comparable scope in flash is handled as part of a single d3 leaf task like "Evaluate and select core technology stack."

---

## 8. Matched Topic Comparison

Comparing equivalent top-level categories between the two trees:

### Product Catalog / Search

**Flash: Build product catalog and search API** (7 d2-children, each with 7-9 d3-leaves)
```
  Define listing schema and domain-specific attribute types (8 children)
  Configure database and search engine indexing (9 children)
  Implement listing CRUD endpoints and mutation resolvers (7 children)
  Implement multi-attribute search and filtering endpoints (8 children)
  Implement pagination and sorting logic for listing queries (9 children)
  Implement caching and query performance optimizations (9 children)
  Develop unit and integration tests for listing endpoints (8 children)
```

**Flash-lite: Build product catalog and search backend** (5 d2-children)
```
  Design Listing Data Model and Database Schema (4 children)
  Define REST API Contract and Validation Rules (4 children)
  Implement Core CRUD API Endpoints (7 children)
  Implement Search, Filtering, and Sorting Logic (7 children)
  Write Unit and Integration Tests for Listings API (7 children)
```

At depth 2, flash-lite actually has *fewer* children (5 vs 7). But each of those children decomposes much deeper (to d7), producing far more total tasks.

### Storefront UI

**Flash: Build marketplace storefront and search UI** (9 d2-children, each with 8-10 d3-leaves)
```
  Build buyer application layout shell and navigation frame (9 children)
  Set up catalog data fetching and filter state management (9 children)
  Construct homepage view with featured vintage figure collections (9 children)
  Implement visual catalog browser view (10 children)
  Construct advanced search input and facet filter controls (9 children)
  Build product detail page shell and figure grading breakdown (9 children)
  Build interactive high-resolution photo gallery and viewer (9 children)
  Build seller profile summary and trust signals component (8 children)
  Optimize responsive layout and cross-device display for buyer pages (10 children)
```

**Flash-lite: Develop buyer-facing storefront interface** (8 d2-children)
```
  Setup design system and global UI styling (7 children)
  Build the buyer homepage (7 children)
  Build category browsing and filtering interface (6 children)
  Build search results and auto-suggest interface (6 children)
  Build product detail view component (6 children)
  Build shopping cart management interface (6 children)
  Integrate frontend with buyer API endpoints (8 children)
  Conduct responsive design audit and accessibility review (9 children)
```

Again similar at d2, but flash-lite continues decomposing these d3 tasks down to d7.

### Authentication (direct match)

**Flash: Implement user authentication and authorization service** (8 d2-children)
```
  Design user, role, address, and payment preference database schemas (8 children)
  Implement password hashing and token management utilities (7 children)
  Implement user registration, login, and session endpoints (8 children)
  Implement multi-factor authentication (MFA) endpoints (10 children)
  Implement role-based access control (RBAC) middleware (7 children)
  Implement user profile and address book management endpoints (7 children)
  Implement user payment preferences management endpoints (10 children)
  Build automated unit and integration test suite for auth and profiles (9 children)
```

**Flash-lite: Implement user authentication and authorization** (7 d2-children)
```
  Select and configure authentication provider (6 children)
  Design user database schema and roles (7 children)
  Implement user registration API and UI (6 children)
  Implement user login and session management (7 children)
  Implement password recovery workflow (7 children)
  Implement role-based access control middleware (7 children)
  Test authentication and security measures (6 children)
```

The d2 children are comparable in both trees. But flash's d3 leaves are all terminal, while flash-lite's d3 children each decompose 4-5 more levels deep.

---

## 9. Root Cause Analysis

### Primary Cause: Terminal Judgment Failure

Flash-lite almost never judges a task as terminal. Only 144 out of 20,739 tasks (0.7%) were labeled `decomposer:terminal`. The model lacks the reasoning capacity to determine when a task is "atomic enough to be completed with a relatively trivial amount of effort" (the system prompt's definition of terminal).

Flash, in contrast, naturally stops at depth 3-4 with leaf tasks that are genuinely atomic implementation tasks.

### Secondary Cause: Research-Oriented Decomposition

Flash-lite frequently decomposes implementation tasks into research/analysis subtasks. Instead of "Select auth provider" being a decision task with clear output, it becomes a research tree:

- "Research Auth0 free tier" (d6)
- "Research Auth0 paid tier" (d6)
- "Research Firebase free tier" (d6)
- "Calculate Phone and SMS Verification Costs" (d6)
- "Build user growth and MAU projection model" (d6)

This is a pattern of treating decomposition as a research outline rather than an implementation plan. The system prompt says "break a task into 6-12 subtasks" -- it does not distinguish between implementation subtasks and research subtasks.

### Tertiary Cause: Single-Child Pathology

28.8% of flash-lite's internal nodes decompose into exactly 1 child. This wastes depth budget without adding decomposition value. A node with 1 child is semantically identical to its child -- it is just a rename.

### Compounding Effect

These three causes compound exponentially:
- Low branching (avg 3.8) x 7 depth levels = 3.8^7 = ~114K theoretical nodes
- Mitigated by some early termination to ~21K actual nodes
- But the depth cap is the primary limiter, not the model's judgment
- Without the depth-7 cap, the tree would be much larger

---

## 10. Verdict: Over-Decomposing vs Under-Decomposing

**Flash-lite is clearly over-decomposing.** Evidence:

1. Flash's depth-3 leaves like "Define Users and Roles schema and ORM entities" are genuine 1-4 hour implementation tasks suitable for a developer agent.

2. Flash-lite's depth-7 leaves like "Review Free plan MAU limits" or "Define credential extraction interfaces and types" are 5-minute sub-sub-tasks that would be absurd as standalone work items.

3. Flash-lite hit the depth-7 hard cap on 9,152 tasks -- it would have kept going deeper if allowed.

4. 28.8% single-child nodes means nearly a third of decompositions add no information.

5. Flash's tree at ~1,500 tasks with max depth 4 is a reasonable decomposition of an ecommerce platform. Flash-lite's 20,739 tasks would be unworkable as an actual project plan.

Flash is NOT under-decomposing. Its ~1,500 task tree covers the same functional scope as flash-lite's 20,739 task tree, with leaves at an appropriate granularity for developer agents.

---

## 11. Recommendations

### For the Decomposer

1. **Model-specific depth limits:** Weaker models should have lower max-depth (e.g., 4 for flash-lite class models vs 7 for flash class models). The depth cap should match the model's terminal-judgment capability.

2. **Minimum branching factor:** Reject or auto-collapse decompositions that produce only 1 child (merge back into parent). This alone would eliminate 28.8% of flash-lite's internal nodes and recover wasted depth budget.

3. **Terminal calibration in the prompt:** Add depth-aware hints like "at depth 3+, most tasks should be terminal unless they represent genuinely large implementation efforts." The existing `design-decomposer-terminal-calibration.md` design covers this.

4. **Max tasks budget:** Set a global task count limit (e.g., 3,000-5,000) and stop decomposing once reached, marking remaining non-terminal tasks as terminal. This prevents runaway trees regardless of model behavior.

5. **Anti-research guidance:** Add prompt guidance like "decompose into implementation subtasks, not research or analysis steps. Evaluating options, researching pricing, and reviewing documentation should be folded into the parent task, not broken out as separate subtasks."

6. **Branching floor:** If the system prompt says "6-12 subtasks" but the model consistently produces 1-5 subtasks, that is a signal the task was likely terminal. Consider treating decompositions with fewer than 3 subtasks as a failed decomposition and marking the parent as terminal instead.

### Broader Insight

**Terminal judgment capability scales with model size.** Flash-lite (as a smaller/faster model) lacks the judgment to assess "is this task atomic enough?" Flash (3.6) has that judgment naturally. This is a useful data point for choosing decomposer models: the decomposer role requires stronger reasoning than the model's speed/cost profile might suggest. Using a weaker model for decomposition does not just produce lower quality -- it produces exponentially more work through runaway recursion.

---

## Related Documents

- `design-decomposer-terminal-calibration.md` -- depth hint + max-tasks cap design
- `decomposer-system-prompt.md` -- the system prompt used for both runs
- `issue-cloud-sql-connection-pooling.md` -- infrastructure impact of large trees
- `followup-decomposer-terminal-criteria.md` -- terminal criteria tuning
- `design-decomposer-resume-mode.md` -- resume mode for interrupted decomposition runs
