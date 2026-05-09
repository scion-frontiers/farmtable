# Farm Table — Roadmap & Backlog

**Date:** 2026-05-09
**Author:** Technical PM
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

## Roadmap Structure

The previous roadmap used rigid phase gating (Phase 1 → 2 → 3 → 4) where each phase blocked the next. This was too conservative — many items are technically independent and were sequenced for convenience rather than necessity.

This roadmap restructures around **technical dependencies only**. Work is organized into parallel streams that can run concurrently. Milestones are checkpoints that validate progress, not gates that block other work from starting.

### Dependency Graph

The following diagram shows the real technical dependencies between workstreams. Items at the same level can run in parallel.

```
                    ┌─────────────────────────────────────────────────────┐
                    │              IMMEDIATELY PARALLELIZABLE              │
                    │                                                     │
                    │  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐  │
                    │  │ Identity │ │Remediat- │ │ CI/CD  │ │  CLI    │  │
                    │  │  (C2)   │ │  ion     │ │Pipeline│ │ Crashes │  │
                    │  └────┬─────┘ └──────────┘ └────┬───┘ └─────────┘  │
                    │       │                         │                   │
                    └───────┼─────────────────────────┼───────────────────┘
                            │                         │
              ┌─────────────┼─────────────────────────┼──────────────────┐
              │             ▼                         ▼                  │
              │  ┌──────────────────┐   ┌──────────────────┐            │
              │  │ CLI Completeness │   │ Binary Distrib.  │            │
              │  │ (whoami, release)│   │ Docker Image     │            │
              │  └──────────────────┘   └──────────────────┘            │
              │                                                         │
              │   INTEGRATIONS (all need platform.Adapter — it exists)  │
              │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
              │  │ GitHub   │ │  Linear  │ │   Jira   │ │  Asana   │   │
              │  │ Harden   │ │          │ │          │ │          │   │
              │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
              │                                                         │
              │   ALSO PARALLELIZABLE (no cross-dependencies)           │
              │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
              │  │   MCP    │ │  Docs:   │ │ Integr.  │ │ Config / │   │
              │  │ Adapter  │ │ Arch +   │ │  Test    │ │ Polish   │   │
              │  │          │ │ Adapter  │ │ Harness  │ │          │   │
              │  └─────┬────┘ │  Guide   │ └──────────┘ └──────────┘   │
              │        │      └──────────┘                              │
              │        ▼                                                │
              │  ┌──────────┐                                           │
              │  │  Agent   │                                           │
              │  │  Skills  │                                           │
              │  └──────────┘                                           │
              └─────────────────────────────────────────────────────────┘
                            │
              ┌─────────────▼───────────────────────────────────────────┐
              │  DOCS: README + Getting Started                         │
              │  (should wait for CLI + identity to stabilize,          │
              │   but can draft in parallel)                            │
              └─────────────────────────────────────────────────────────┘
```

### Parallel Workstreams

Work is organized into seven streams that can run concurrently. Within each stream, items are ordered by their internal dependencies.

---

#### Stream 1: Identity & Auth

**Why it matters:** Without C2, every task claim records a random UUID. The audit trail is meaningless. Identity is the foundation for trustworthy dog-fooding.

**What depends on this:** `ft user whoami`, `ft task release`, `ft task claim --assignee`, proper audit trail in Change records. Nothing else in the roadmap is technically blocked — integrations, CI/CD, MCP, and documentation can all proceed without identity being complete.

| # | Item | Size | Priority | Depends on |
|---|------|------|----------|------------|
| AUTH-1 | **Token → user mapping (C2)** — API tokens mapped to User records in the store | L | P0 | — |
| AUTH-2 | **Propagate auth context to store mutations** — every mutation gets author_id from auth context instead of uuid.New() | M | P0 | AUTH-1 |
| AUTH-3 | **`ft user whoami`** — calls WhoAmI RPC | S | P1 | AUTH-1 |
| AUTH-4 | **`ft task claim --assignee` override** — manager agent assigns work to specific agent identity | S | P2 | AUTH-1 |

---

#### Stream 2: Remediation

**Why it matters:** Critical and high bugs found during code review. These affect correctness and security of the core product.

**What depends on this:** Nothing is technically blocked by remediation items. These are independent fixes that improve reliability. Each bug is independent of the others.

**Critical fixes (P0):**

| # | Item | Size | Source | Depends on |
|---|------|------|--------|------------|
| REM-1 | **Timing-safe token comparison** | S | INFRA-1 | — |
| REM-2 | **Transaction boundaries** for CreateTask, UpdateTask | M | STORE-C2 | — |
| REM-3 | **Version regression fix** in unconditional updates | M | STORE-C1 | — |
| REM-4 | **Graph recursion depth bounds** | S | S-03/S-04 | — |
| REM-5 | **Critical path algorithm fix** (backtracking) | M | S-05 | — |
| REM-6 | **Cap task loading** in GetCriticalPath/GetBottlenecks | S | S-06 | — |
| REM-7 | **Relationship unique constraint** | S | STORE-H3 | — |
| REM-8 | **CloseTask re-close guard** | S | STORE-H5 | — |

**High fixes (P1):**

| # | Item | Size | Source | Depends on |
|---|------|------|--------|------------|
| REM-9 | **diffTask missing fields** | S | STORE-H2 | — |
| REM-10 | **Bearer prefix validation** | S | INFRA-2 | — |
| REM-11 | **Internal error message hygiene** | S | S-11 | — |

**Medium fixes (P2):**

| # | Item | Size | Source | Depends on |
|---|------|------|--------|------------|
| REM-12 | **Default sort order** | S | STORE-M5 | — |
| REM-13 | **Label sort stability** | S | STORE-M3 | — |
| REM-14 | **Total count accuracy** (clone query) | S | STORE-M1 | — |

---

#### Stream 3: CI/CD & Packaging

**Why it matters:** Blocking for open-source launch. No technical dependency on any feature work — CI validates the code that exists today.

**What depends on this:** Binary distribution depends on CI pipeline. Docker image depends on CI pipeline. Server deployment guide depends on Docker image. None of these depend on identity, integrations, or MCP.

| # | Item | Size | Priority | Depends on |
|---|------|------|----------|------------|
| INFRA-1 | **CI pipeline** (GitHub Actions) — test + build + release | M | P0 | — |
| INFRA-2 | **Binary distribution** (goreleaser) — `go install` + downloadable binaries | M | P0 | INFRA-1 |
| INFRA-3 | **Docker image** for server mode | M | P1 | INFRA-1 |
| INFRA-4 | **Server deployment guide** — Docker Compose + Postgres for multi-agent production | M | P1 | INFRA-3 |
| INFRA-5 | **Helm chart** | M | P2 | INFRA-3 |

---

#### Stream 4: CLI Polish

**Why it matters:** Crash fixes are P0. Missing commands reduce usability for dog-fooding and early adoption.

| # | Item | Size | Priority | Depends on |
|---|------|------|----------|------------|
| CLI-1 | **Fix `ft status` crash** — implement GetStatus/GetVersion RPCs | S | P0 | — |
| CLI-2 | **`ft change list <task-id>`** — RPC exists, CLI command missing | S | P1 | — |
| CLI-3 | **`ft task delete`** — designed but may not be fully wired | S | P1 | — |
| CLI-4 | **`ft task release <id>`** — inverse of claim, auto-comment + stage reset | S | P2 | AUTH-1 (needs identity) |
| CLI-5 | **Sort/order flag validation** — invalid values silently ignored | S | P1 | — |
| CLI-6 | **`ft user list` / `ft user get`** — RPCs not implemented yet | S | P2 | AUTH-1 |
| CLI-7 | **Shell completions** (`ft completion bash/zsh/fish`) | S | P2 | — |
| CLI-8 | **`ft task batch`** — bulk JSONL create/update for agent plan decomposition | M | P2 | — |

Note: CLI-1 through CLI-3, CLI-5, CLI-7, and CLI-8 have zero dependencies and can start immediately. CLI-4 and CLI-6 depend on identity (Stream 1) only.

---

#### Stream 5: Integrations

**Why it matters:** Proves the universal interface thesis. The `platform.Adapter` interface already exists — each integration implements it independently.

**Key insight:** All integrations depend on the same interface, not on each other. GitHub hardening, Linear, Jira, and Asana can all run in parallel. The only real ordering constraint is priority (GitHub and Linear prove the thesis; Jira adds enterprise credibility; Asana and Beads extend reach).

| # | Item | Size | Priority | Depends on |
|---|------|------|----------|------------|
| INT-1 | **GitHub Issues: rate limiting** | M | P0 | — |
| INT-2 | **GitHub Issues: label + repo mapping fixes** | S | P0 | — |
| INT-3 | **GitHub Issues: incremental sync** (use `updated_at`) | M | P1 | — |
| INT-4 | **Linear integration** — full adapter, bidirectional sync, cycle/project mapping, dependency relationships | L | P0 | — |
| INT-5 | **Jira Cloud integration** — workflow-constrained transitions, custom field discovery, mandatory field validation | L | P0 | — |
| INT-6 | **Asana integration** | L | P1 | — |
| INT-7 | **Beads integration** — Git-native task import, branch-aware resolution | L | P2 | — |
| INT-8 | **Webhook ingestion framework** — active drift detection for external platforms | L | P1 | At least one integration complete |
| INT-9 | **Integration test harness** — mock HTTP servers for adapter validation; CI-friendly normalization round-trip tests | M | P1 | At least one integration (INT-1/INT-4) |

**Why no integration depends on identity:** Integrations sync tasks from external platforms. The platform's own identity model applies. Farm Table identity (C2) governs who the *agent* is when it operates via `ft` — that's orthogonal to how tasks are imported from GitHub/Linear/Jira.

**Why Jira doesn't depend on Linear:** Both implement `platform.Adapter`. The normalization patterns are different (Linear has clean dependencies; Jira has custom workflows), but the interface is the same. A team working on Jira doesn't need to wait for Linear to ship. The original phasing placed Jira after Linear for risk management ("learn from the easier one first"), which is a reasonable staffing choice but not a technical dependency.

---

#### Stream 6: MCP & Agent Skills

**Why it matters:** MCP expands reach to tool-discovery-based agent frameworks. Agent skills provide ergonomic wrappers for specific harnesses.

**What this depends on:** MCP adapter needs the gRPC API to be stable (it is). It does NOT depend on external integrations — MCP exposes Farm Table operations, which work on the built-in backend today. Agent skills depend on MCP or can wrap the CLI directly.

| # | Item | Size | Priority | Depends on |
|---|------|------|----------|------------|
| MCP-1 | **MCP adapter** — expose `ft` operations as MCP tools | M | P1 | — |
| MCP-2 | **Claude Code skill** — wraps common `ft` workflows | S | P1 | MCP-1 (or standalone CLI wrapper) |
| MCP-3 | **Cursor/Codex/Devin skills** — framework-specific wrappers | M | P2 | MCP-2 (pattern established) |

---

#### Stream 7: Documentation

**Why it matters:** Blocking for open-source launch. But different docs have different dependencies.

| # | Item | Size | Priority | Depends on |
|---|------|------|----------|------------|
| DOC-1 | **Architecture overview** — for contributors and evaluators | M | P1 | — (architecture is stable) |
| DOC-2 | **Platform adapter development guide** — how to add a new integration | S | P1 | At least one integration complete (INT-1 or INT-4) to document real patterns |
| DOC-3 | **API reference** (proto-generated) | M | P2 | — (proto exists) |
| DOC-4 | **README with installation + quick-start** | M | P0 | CLI-1 (crash fix), AUTH-1 (identity), INFRA-2 (binary distribution) — the install + first-task experience must work |
| DOC-5 | **Agent integration guide** — how to make your agent use Farm Table | M | P0 | DOC-4, MCP-1 (should cover both CLI and MCP paths) |

**Why some docs can start now:** Architecture and API reference describe what exists — they don't need features to stabilize. The adapter guide needs one real integration to document. README and agent guide should wait until the install experience (CI/binary distribution) and core identity work land, but drafting can begin in parallel.

---

### Additional Items (Lower Priority)

These items have no upstream blockers but are lower priority. They can be picked up whenever capacity allows.

| # | Item | Size | Priority | Depends on |
|---|------|------|----------|------------|
| MISC-1 | **Collection-scoped configuration** — `.farmtable.toml` per-repo defaults | S | P2 | — |
| MISC-2 | **`ft watch <task-id>`** — gRPC server streaming for real-time task changes | M | P2 | INT-8 (webhook framework) |
| MISC-3 | **SQLite → Postgres migration tool** (`ft admin migrate-db`) | M | P2 | — |
| MISC-4 | **Multi-project config** — per-directory `.farmtable.toml` with config inheritance | S | P2 | MISC-1 |
| MISC-5 | **Field-level conflict resolution** — merge non-conflicting field changes instead of full CONFLICT | M | P3 | — |
| MISC-6 | **`ft event list`** — webhook/event observability for debugging | S | P3 | INT-8 (webhook framework) |
| MISC-7 | **`ft linked-account`** — platform credential management CLI for admin setup | M | P3 | — |

---

## Milestones

Milestones are validation checkpoints, not gates. Work on later milestones can (and should) start before earlier milestones are met. Milestones tell us when we've proven something, not when we're allowed to start something else.

### Milestone 1: Credible Dog-food

**What it proves:** Farm Table manages real work reliably with trustworthy identity and audit trail.

**Required items:** AUTH-1, AUTH-2, REM-1 through REM-8 (critical/high remediation), CLI-1 (crash fix).

**Validation:** An agent authenticates with a stable identity, claims tasks, updates with audit trail, queries the graph, and every CLI command works or returns a clear error. `go test ./...` passes.

### Milestone 2: Universal Interface Proof

**What it proves:** At least 2 external integrations demonstrate the normalization thesis.

**Required items:** INT-1+INT-2 (GitHub hardened), INT-4 (Linear) OR INT-5 (Jira). Integration test harness (INT-9).

**Validation:** An agent works on tasks from the built-in backend and two external platforms with identical CLI commands. The NTO normalization holds across architecturally different platforms.

### Milestone 3: Open-Source Launch

**What it proves:** Farm Table is credible for external adoption.

**Required items:** INFRA-1+INFRA-2 (CI + binary distribution), DOC-4+DOC-5 (README + agent guide), INT-5 (Jira — enterprise credibility), INFRA-3 (Docker image).

**Validation:** A developer can `go install` or download a binary, run `ft task create "hello"`, and be productive in under 2 minutes. README, getting-started guide, and architecture doc exist. CI runs on every PR. Docker image published.

### Milestone 4: Ecosystem

**What it proves:** Farm Table has broad platform coverage and advanced coordination.

**Required items:** INT-6 (Asana), INT-7 (Beads), INT-8 (webhook ingestion), MCP-3 (multi-framework skills).

**Validation:** Full Tier 1 integration matrix covered. Webhook-based drift detection operational. Agent skills available for major frameworks.

---

## What Changed from the Previous Roadmap

The backlog items are identical. The structure changed:

| Before (Phase-gated) | After (Dependency-driven) |
|---|---|
| Linear blocked on all of Phase 1 | Linear can start immediately — needs `platform.Adapter` (exists) |
| Jira blocked on all of Phase 2 | Jira can start immediately — same interface as Linear |
| CI/CD blocked on Phase 2 | CI/CD can start immediately — no feature dependencies |
| MCP blocked on Phase 1 | MCP can start immediately — gRPC API is stable |
| All docs blocked on Phase 2 | Architecture doc and API reference can start now; README waits for install experience |
| Remediation bugs sequenced into Phase 1 | Each bug is independent — can be fixed in any order, by any team |
| Shell completions blocked on Phase 2 | Can ship whenever — zero dependencies |
| Collection config blocked on Phase 2 | Can ship whenever — zero dependencies |

**Items that genuinely depend on identity (AUTH-1):** `ft user whoami`, `ft task release`, `ft user list/get`, `ft task claim --assignee`. That's it — four CLI commands, not the entire roadmap.

**Items that genuinely need ordering:**
- Binary distribution needs CI pipeline
- Docker image needs CI pipeline
- Server deployment guide needs Docker image
- Agent integration guide needs README draft + MCP adapter
- Platform adapter guide needs at least one integration shipped
- Webhook framework needs at least one integration to watch
- `ft watch` needs webhook framework
- Agent skills for other frameworks need the Claude Code skill pattern

Everything else is parallelizable.

---

## Sequencing Rationale

**Why identity is high priority but doesn't block everything:** Identity affects the audit trail and four CLI commands. It doesn't affect how integrations sync tasks, how CI builds the binary, how MCP exposes tools, or how docs describe the architecture. It's critical work that should start immediately — but so should many other things.

**Why Linear and Jira can run in parallel:** Both implement `platform.Adapter`. Linear exercises clean dependency mapping; Jira exercises custom workflows. These are different normalization challenges against the same interface. A team working on Jira gains nothing by waiting for Linear to ship. The original phasing ("learn from Linear first") is a reasonable staffing heuristic for a single-person team, not a technical constraint.

**Why CI/CD should start immediately:** CI validates the code that exists today. It doesn't need identity, integrations, or MCP. Every day without CI is a day where regressions can slip in undetected. This was artificially blocked on Phase 2 in the previous roadmap.

**Why MCP doesn't depend on integrations:** MCP exposes Farm Table operations as tools. Those operations work on the built-in backend today. An agent using MCP to create, claim, and close tasks on the built-in backend exercises the full MCP interface. External integration support is additive, not prerequisite.

**Why docs have mixed dependencies:** Architecture overview describes what exists — no dependency. Adapter development guide needs a real integration to document patterns from. README needs the install experience to work (CI + binary). Agent guide needs README + MCP. Writing these in the wrong order produces docs that describe aspirations, not reality.

**Why Beads remains last among integrations:** Per the discussion log, Beads' Tier 1 inclusion should be validated with user evidence. It's architecturally interesting but has the smallest user base. No technical dependency prevents starting it earlier — this is a priority call, not a sequencing constraint.

---

## Recommended Parallelism for a Small Team

With the dependencies clarified, here's how a small team (1-3 engineers) might parallelize:

**Immediate start (all independent):**
1. Identity (AUTH-1, AUTH-2) — highest leverage for dog-fooding
2. Critical remediation (REM-1 through REM-8) — security and correctness
3. CI pipeline (INFRA-1) — unblocks binary distribution and catches regressions
4. CLI crash fix (CLI-1) — quick win, P0

**After CI pipeline lands:**
- Binary distribution (INFRA-2), Docker image (INFRA-3)

**After identity lands:**
- CLI completeness (CLI-4 `release`, CLI-6 `user list/get`)

**Whenever capacity allows (no blockers):**
- Any integration (GitHub hardening, Linear, Jira — pick based on staffing, not sequencing)
- MCP adapter
- Architecture doc, API reference
- Shell completions, collection config, batch command

**After at least one integration ships:**
- Integration test harness, adapter development guide

**After CLI + identity + binary distribution stabilize:**
- README, agent integration guide

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| C2 (identity) design takes longer than expected | High — degrades dog-fooding quality but does NOT cascade to integrations/CI/MCP | Timebox to simple token→user table. Defer JWT/OAuth until needed. |
| Jira integration complexity — custom workflows are open-ended | High | Scope to "read-only sync + basic transitions" for v1. Full workflow support later. |
| Parallelism exceeds team capacity — everything starts, nothing finishes | High | Use milestones as focus anchors. Prioritize Milestone 1 items, but don't artificially block independent work. |
| MCP spec evolution — the protocol is still maturing | Medium | Build a thin adapter layer; don't couple deeply. |
| Beads API stability — Beads is also early-stage | Low | Defer until demand signal. |

---

## Open Decisions

1. **Auth design for C2:** Simple API token → User table lookup, or JWT with embedded claims? Recommend token table for simplicity — it matches the existing `FARMTABLE_TOKEN` model and avoids introducing a token issuer.

2. **MCP adapter scope:** Full bidirectional (tools + resources), or tools-only for v1? Recommend tools-only — it covers the primary use case (agents calling `ft` operations) without the complexity of MCP resource subscriptions.

3. **Beads Tier 1 commitment:** Validate with user evidence before committing engineering time. If no signal by Milestone 4, demote to "future candidates."

4. **Server mode auth:** Current single-token model (`FARMTABLE_TOKEN` env var) works for single-team deployments. Multi-tenant requires per-agent tokens + admin tokens. Design when the first multi-agent production deployment is attempted.

5. **Integration parallelism vs. staffing:** The dependency graph permits all integrations to run in parallel. For a solo maintainer, a sequential approach (GitHub → Linear → Jira) may be more practical — but that's a staffing choice, not a technical constraint, and the roadmap shouldn't enforce it.

---

## Sizing Guide

| Size | Effort | Examples |
|------|--------|----------|
| **S** | 1-2 days | Single-file fix, new CLI command wiring, flag validation |
| **M** | 3-5 days | New RPC implementation, adapter hardening, CI pipeline, documentation |
| **L** | 1-2 weeks | Full platform integration, auth system, major architectural feature |
