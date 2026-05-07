# Farm Table — Roadmap & Backlog

**Date:** 2026-05-07
**Author:** Technical PM (generated)
**Status:** Proposal — pending product review

---

## Executive Summary

Farm Table is an open-source task runtime for AI agents — a CLI-first interface that gives coding agents a single, predictable way to receive, track, and complete work, whether tasks live in GitHub, Jira, Linear, Asana, or Farm Table's own built-in graph backend.

### What's built

The core product loop works end-to-end on the built-in backend in embedded (SQLite) mode:

- **Proto schema** — canonical NTO with 918 lines covering tasks, collections, comments, changes, relationships, graph RPCs, and user identity
- **Store layer** — Ent ORM on SQLite/Postgres with dual-mode operation, CAS, graph queries (ready tasks, blocked tasks, dependency tree, critical path, bottlenecks), and audit trail
- **gRPC service** — full CRUD + graph RPCs + auth interceptor + field completeness (labels, dates, relationships, code_context)
- **CLI** (`ft`) — embedded mode with bufconn, auto-provisioned default collection, all task/comment/collection commands, graph commands (ready, blocked, tree, critical-path, bottlenecks), cursor-based pagination, four output formats (json, table, quiet, jsonl)
- **Platform adapter** — interface defined + GitHub Issues adapter (sync + push, partial)
- **Tests** — store layer (6 tests, 11 subtests), server layer (5 tests, 7 subtests), GitHub adapter (mapping tests). All passing.
- **Dog-fooding** — Farm Table manages its own development tasks via `ft`

### What's incomplete or missing

| Area | Gap | Severity |
|------|-----|----------|
| **Auth/Identity (C2)** | ClaimTask/AddComment use random UUIDs — agent identity is garbage | Critical |
| **Remediation** | ~15 issues from code review (timing-unsafe auth, no transactions, graph recursion bounds, etc.) | Critical/High |
| **External integrations** | Only GitHub Issues (partial). No Linear, Jira, Asana, or Beads | Blocking for launch |
| **MCP adapter** | Not started | Important for adoption |
| **Documentation** | No README, no getting-started guide, no agent skill examples | Blocking for launch |
| **CI/CD** | No GitHub Actions, no release pipeline, no binary distribution | Blocking for launch |
| **CLI polish** | Missing `ft task release`, `ft task delete`, `ft user whoami`, `ft change list` CLI commands; `ft status` crashes | High |
| **Server deployment** | No Docker image, no Helm chart, no deployment guide for Postgres mode | Important |

### Current state in one sentence

The built-in backend + CLI is a working prototype that proves the architecture — an agent can create, claim, update, close, and query tasks with dependency-aware graph intelligence — but identity, security, integrations, and packaging remain between here and a credible open-source launch.

---

## Roadmap

The roadmap is sequenced around three gates:

1. **Gate 1: Credible dog-food** — Farm Table manages real work reliably, with identity and audit trail that actually work
2. **Gate 2: Universal interface proof** — at least 2 external integrations (GitHub + Linear) demonstrate the normalization thesis
3. **Gate 3: Open-source launch** — documentation, packaging, CI, and a third integration (Jira) make it credible for external adoption

### Phase 1: Harden & Ship Identity (2-3 weeks)

**Goal:** Make the built-in backend trustworthy for real agent workloads. Fix the critical bugs. Ship agent identity so the audit trail and task assignment actually work.

This is the highest-leverage work. Every subsequent phase depends on a reliable core. Dog-fooding has already exposed the gaps.

| # | Item | Size | Priority | Dependencies |
|---|------|------|----------|--------------|
| 1.1 | **Agent identity (C2)** — token→user mapping, auth context propagation to ClaimTask/AddComment/UpdateTask | L | P0 | — |
| 1.2 | **Remediation: critical fixes** — timing-safe auth (INFRA-1), transaction boundaries (STORE-C2), version regression (STORE-C1) | M | P0 | — |
| 1.3 | **Remediation: high fixes** — graph recursion bounds (S-03/S-04), critical path algorithm fix (S-05), unbounded task loading (S-06), relationship unique constraint (STORE-H3), CloseTask re-close guard (STORE-H5), diffTask missing fields (STORE-H2) | M | P0 | — |
| 1.4 | **CLI crash fixes** — `ft status` crashes (C3), implement GetStatus/GetVersion RPCs | S | P0 | — |
| 1.5 | **CLI completeness** — `ft user whoami`, `ft change list`, `ft task delete` commands; ensure all task create/update/list flags work end-to-end | M | P1 | 1.1 (whoami needs identity) |
| 1.6 | **Remediation: medium fixes** — Bearer prefix validation, error message hygiene, default sort, config permissions, label sort stability | S | P1 | — |
| 1.7 | **`ft task release`** — dedicated inverse of `ft task claim` with auto-comment and stage reset | S | P2 | 1.1 |

**Exit criteria:** An agent can authenticate with a stable identity, claim tasks, update with audit trail, query the graph, and every CLI command either works or returns a clear error. All critical/high remediation items resolved. `go test ./...` passes.

### Phase 2: Second Integration + MCP (3-4 weeks)

**Goal:** Prove the universal interface thesis with a second external platform, and open the MCP channel for tool-discovery-based agents.

Linear is the right second integration: it has native dependency support (blocks/blocked-by), clean API, and its audience overlaps heavily with Farm Table's target users. This exercises the normalization layer on a platform that's architecturally different from GitHub Issues.

| # | Item | Size | Priority | Dependencies |
|---|------|------|----------|--------------|
| 2.1 | **GitHub Issues adapter: harden** — rate limiting, incremental sync (use `updated_at`), error handling, label/repo field mapping fixes (PLATFORM-C1, C2) | M | P0 | Phase 1 |
| 2.2 | **Linear integration** — adapter implementing `platform.Adapter`, bidirectional sync, cycle/project mapping to collections, dependency relationship mapping | L | P0 | Phase 1 |
| 2.3 | **MCP adapter** — expose Farm Table operations as MCP tools so agents using tool-discovery frameworks can interact without learning the CLI | M | P1 | Phase 1 |
| 2.4 | **Agent skill: Claude Code** — a Claude Code skill wrapping common `ft` workflows (claim next task, post update, close task) | S | P1 | 2.3 or standalone |
| 2.5 | **Integration test harness** — mock HTTP servers for GitHub + Linear adapters; CI-friendly test suite that validates normalization round-trips | M | P1 | 2.1, 2.2 |
| 2.6 | **Collection-scoped configuration** — `.farmtable.toml` per-repo defaults so agents working across collections don't need `--collection` on every call | S | P2 | — |

**Exit criteria:** An agent can work on tasks from GitHub Issues, Linear, and the built-in backend with identical CLI commands. MCP adapter passes basic smoke tests. Two external platforms demonstrate that the NTO normalization holds.

### Phase 3: Open-Source Launch (3-4 weeks)

**Goal:** Package Farm Table for external adoption. Documentation, CI/CD, binary distribution, and a third integration (Jira) for enterprise credibility.

Jira is the must-have third integration. It's the hardest normalization problem (custom fields, workflow constraints, mandatory field discovery) and the most common platform in enterprise environments. If Farm Table works for Jira, the "universal" claim is defensible.

| # | Item | Size | Priority | Dependencies |
|---|------|------|----------|--------------|
| 3.1 | **Jira Cloud integration** — adapter with workflow-constrained transitions, custom field discovery, mandatory field validation | L | P0 | Phase 2 |
| 3.2 | **Documentation: README + getting-started** — installation, quick-start (embedded mode), first-task tutorial, agent integration guide | M | P0 | Phase 2 |
| 3.3 | **Documentation: architecture & contributing** — design overview, how to add a platform adapter, development setup | M | P1 | Phase 2 |
| 3.4 | **CI/CD pipeline** — GitHub Actions for test, build, release. Binary distribution (goreleaser or equivalent). Docker image for server mode. | M | P0 | — |
| 3.5 | **Server deployment guide** — Docker Compose + Postgres for multi-agent production. Helm chart (stretch). | M | P1 | 3.4 |
| 3.6 | **Shell completions** — `ft completion bash/zsh/fish` (Cobra built-in, just needs wiring) | S | P2 | — |
| 3.7 | **`ft task batch`** — bulk create/update from JSONL for agents decomposing large plans | S | P2 | — |

**Exit criteria:** A developer can `go install` or download a binary, run `ft task create "hello"`, and be productive in under 2 minutes. README, getting-started guide, and architecture doc exist. CI runs on every PR. Docker image published. Jira integration works for at least one enterprise Jira project.

### Phase 4: Ecosystem (Ongoing)

**Goal:** Fill out the integration matrix, add advanced coordination features, and build toward the full product vision.

| # | Item | Size | Priority | Dependencies |
|---|------|------|----------|--------------|
| 4.1 | **Asana integration** | L | P1 | Phase 3 |
| 4.2 | **Beads integration** — Git-native task import, branch-aware resolution | L | P2 | Phase 3 |
| 4.3 | **Webhook ingestion** — active drift detection for external platforms (vs. poll-on-read) | L | P1 | Phase 3 |
| 4.4 | **`ft watch <task-id>`** — gRPC server streaming for real-time task change notifications | M | P2 | 4.3 |
| 4.5 | **SQLite → Postgres migration tool** — `ft admin migrate-db` for teams graduating from embedded to server mode | M | P2 | Phase 3 |
| 4.6 | **Multi-project config** — per-directory `.farmtable.toml` with config inheritance | S | P2 | Phase 3 |
| 4.7 | **Agent skills for other frameworks** — Cursor, Devin, Codex wrappers | M | P2 | 2.4 |
| 4.8 | **Field-level conflict resolution** — merge non-conflicting field changes instead of full CONFLICT on version mismatch | M | P3 | Phase 3 |
| 4.9 | **`ft event list`** — webhook/event observability for debugging | S | P3 | 4.3 |
| 4.10 | **`ft linked-account`** — platform credential management CLI for admin setup | M | P3 | Phase 3 |

---

## Detailed Backlog

### Identity & Auth

| ID | Title | Size | Pri | Phase | Notes |
|----|-------|------|-----|-------|-------|
| AUTH-1 | Token → user mapping (C2) | L | P0 | 1 | Core blocker. Design decision: API tokens mapped to User records in the store, or JWT with embedded identity? Recommend simple token→user table for v1. |
| AUTH-2 | Propagate auth context to store mutations | M | P0 | 1 | Every store mutation (UpdateTask, ClaimTask, CloseTask, AddComment) gets author_id from auth context instead of uuid.New()/uuid.Nil |
| AUTH-3 | `ft user whoami` CLI command | S | P1 | 1 | Depends on AUTH-1. Calls WhoAmI RPC. |
| AUTH-4 | `ft task claim --assignee` override | S | P2 | 1 | Manager agent assigns work to specific agent identity |

### Remediation (from code review + review reports)

| ID | Title | Size | Pri | Phase | Source |
|----|-------|------|-----|-------|--------|
| REM-1 | Timing-safe token comparison | S | P0 | 1 | INFRA-1 |
| REM-2 | Transaction boundaries for CreateTask, UpdateTask | M | P0 | 1 | STORE-C2 |
| REM-3 | Version regression fix in unconditional updates | M | P0 | 1 | STORE-C1 |
| REM-4 | Graph recursion depth bounds | S | P0 | 1 | S-03/S-04 |
| REM-5 | Critical path algorithm fix (backtracking) | M | P0 | 1 | S-05 |
| REM-6 | Cap task loading in GetCriticalPath/GetBottlenecks | S | P0 | 1 | S-06 |
| REM-7 | Relationship unique constraint | S | P0 | 1 | STORE-H3 |
| REM-8 | CloseTask re-close guard | S | P0 | 1 | STORE-H5 |
| REM-9 | diffTask missing fields | S | P1 | 1 | STORE-H2 |
| REM-10 | Bearer prefix validation | S | P1 | 1 | INFRA-2 |
| REM-11 | Internal error message hygiene | S | P1 | 1 | S-11 |
| REM-12 | Default sort order | S | P2 | 1 | STORE-M5 |
| REM-13 | Label sort stability | S | P2 | 1 | STORE-M3 |
| REM-14 | Total count accuracy (clone query) | S | P2 | 1 | STORE-M1 |

### CLI

| ID | Title | Size | Pri | Phase | Notes |
|----|-------|------|-----|-------|-------|
| CLI-1 | Fix `ft status` crash (implement GetStatus/GetVersion RPCs) | S | P0 | 1 | C3 — crashes in all modes |
| CLI-2 | `ft change list <task-id>` command | S | P1 | 1 | RPC exists, CLI command missing |
| CLI-3 | `ft task delete` command | S | P1 | 1 | Designed but may not be fully wired |
| CLI-4 | `ft task release <id>` command | S | P2 | 1 | Inverse of claim. Documented workaround exists. |
| CLI-5 | Sort/order flag validation | S | P1 | 1 | CLI-H1 — invalid values silently ignored |
| CLI-6 | `ft user list` / `ft user get` commands | S | P2 | 2 | RPCs not implemented yet |
| CLI-7 | Shell completions (`ft completion`) | S | P2 | 3 | Cobra built-in, needs wiring |
| CLI-8 | `ft task batch` — bulk JSONL create/update | M | P2 | 3 | Agent plan decomposition use case |

### Integrations

| ID | Title | Size | Pri | Phase | Notes |
|----|-------|------|-----|-------|-------|
| INT-1 | GitHub Issues: rate limiting | M | P0 | 2 | PLATFORM-H1 — no rate limit handling |
| INT-2 | GitHub Issues: label + repo mapping fixes | S | P0 | 2 | PLATFORM-C1, C2 |
| INT-3 | GitHub Issues: incremental sync | M | P1 | 2 | Use updated_at for delta sync |
| INT-4 | Linear integration | L | P0 | 2 | Second integration — proves universality |
| INT-5 | Jira Cloud integration | L | P0 | 3 | Enterprise credibility |
| INT-6 | Asana integration | L | P1 | 4 | Cross-functional teams |
| INT-7 | Beads integration | L | P2 | 4 | Git-native, niche audience |
| INT-8 | Webhook ingestion framework | L | P1 | 4 | Active drift detection vs. poll-on-read |

### MCP & Agent Skills

| ID | Title | Size | Pri | Phase | Notes |
|----|-------|------|-----|-------|-------|
| MCP-1 | MCP adapter — expose `ft` operations as MCP tools | M | P1 | 2 | Secondary interface per product definition |
| MCP-2 | Claude Code skill | S | P1 | 2 | Wraps common workflows |
| MCP-3 | Cursor/Codex/Devin skills | M | P2 | 4 | Framework-specific wrappers |

### Infrastructure & Packaging

| ID | Title | Size | Pri | Phase | Notes |
|----|-------|------|-----|-------|-------|
| INFRA-1 | CI pipeline (GitHub Actions) | M | P0 | 3 | Test + build + release |
| INFRA-2 | Binary distribution (goreleaser) | M | P0 | 3 | `go install` + downloadable binaries |
| INFRA-3 | Docker image for server mode | M | P1 | 3 | Multi-agent production deployment |
| INFRA-4 | Server deployment guide (Docker Compose + Postgres) | M | P1 | 3 | Production setup documentation |
| INFRA-5 | Helm chart | M | P2 | 4 | Kubernetes deployment |
| INFRA-6 | SQLite → Postgres migration tool | M | P2 | 4 | Team graduation path |

### Documentation

| ID | Title | Size | Pri | Phase | Notes |
|----|-------|------|-----|-------|-------|
| DOC-1 | README with installation + quick-start | M | P0 | 3 | First impression for OSS users |
| DOC-2 | Agent integration guide | M | P0 | 3 | How to make your agent use Farm Table |
| DOC-3 | Architecture overview | M | P1 | 3 | For contributors and evaluators |
| DOC-4 | Platform adapter development guide | S | P1 | 3 | How to add a new integration |
| DOC-5 | API reference (proto-generated) | M | P2 | 3 | Auto-generated from proto comments |

---

## Sizing Guide

| Size | Effort | Examples |
|------|--------|----------|
| **S** | 1-2 days | Single-file fix, new CLI command wiring, flag validation |
| **M** | 3-5 days | New RPC implementation, adapter hardening, CI pipeline, documentation |
| **L** | 1-2 weeks | Full platform integration, auth system, major architectural feature |

---

## Sequencing Rationale

**Why identity before integrations?** Without C2, every task claim records a random UUID. The audit trail is meaningless. Dog-fooding can't work if you can't tell which agent did what. Identity is the foundation for everything else.

**Why Linear before Jira?** Linear's API is clean, well-documented, and has native dependency support — making it the fastest path to proving the normalization thesis works on a second platform. Jira is harder (custom workflows, mandatory fields, workflow constraints) and should be tackled with the confidence that the adapter pattern works. Linear also shares Farm Table's target audience (velocity-focused engineering teams), so it's a more natural early integration.

**Why MCP in Phase 2, not Phase 1?** The CLI is the primary interface and already works. MCP is a secondary channel that expands reach to tool-discovery-based agent frameworks. It's important for adoption but not for proving the core product works.

**Why Beads last among Tier 1?** The discussion log notes that Beads' Tier 1 inclusion should be validated with concrete user evidence. It's architecturally interesting (Git-native model exercises a different normalization path) but has the smallest user base. Build it when there's demand signal, not on spec.

**Why documentation in Phase 3, not Phase 1?** Documentation for a product with broken identity and a single partial integration would be premature. The product needs to stabilize (Phase 1) and demonstrate universality (Phase 2) before it's worth documenting for external users. Internal dog-fooding doesn't need polished docs.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| C2 (identity) design takes longer than expected — cascades to everything | High | Timebox to simple token→user table. Defer JWT/OAuth until needed. |
| Jira integration complexity — custom workflows are an open-ended problem | High | Scope to "read-only sync + basic transitions" for v1. Full workflow support is Phase 4. |
| MCP spec evolution — the protocol is still maturing | Medium | Build a thin adapter layer; don't couple deeply. |
| Beads API stability — Beads is also early-stage | Low | Defer until demand signal. |
| Single maintainer / small team — 50+ backlog items | High | Phase gating prevents scope creep. Don't start Phase N+1 until N's exit criteria are met. |

---

## Open Decisions

1. **Auth design for C2:** Simple API token → User table lookup, or JWT with embedded claims? Recommend token table for simplicity — it matches the existing `FARMTABLE_TOKEN` model and avoids introducing a token issuer.

2. **MCP adapter scope:** Full bidirectional (tools + resources), or tools-only for v1? Recommend tools-only — it covers the primary use case (agents calling `ft` operations) without the complexity of MCP resource subscriptions.

3. **Beads Tier 1 commitment:** Validate with user evidence before committing engineering time. If no signal by Phase 4, demote to "future candidates."

4. **Server mode auth:** Current single-token model (`FARMTABLE_TOKEN` env var) works for single-team deployments. Multi-tenant requires per-agent tokens + admin tokens. Design when the first multi-agent production deployment is attempted.
