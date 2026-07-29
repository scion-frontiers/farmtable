# Task Breakdown: External Store Passthrough Design

**Date:** 2026-07-20
**Collection:** External Store Passthrough
**Collection ID:** `5d1e4eea-3dc7-4958-99ac-01e3372c5a0d`
**Dashboard:** https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=5d1e4eea-3dc7-4958-99ac-01e3372c5a0d
**Design doc:** `design-external-store-passthrough.md`
**Total tasks:** 24 (3 phase parents + 21 leaf tasks)

---

## Phase A: Infrastructure (MultiStore + LinkedAccount + CLI)
**Parent ID:** `dceae211-e9f1-4845-a6ce-e02199c1f368`

### A1 — LinkedAccount Ent Schema + Code Generation
- **ID:** `7d83974b-dfc4-4cd8-adfb-0a864bd65ed3`
- **Stage:** ready | **Priority:** HIGH | **Type:** task
- **Labels:** backend, schema, phase-a
- **Scope:** Create LinkedAccount Ent entity schema (fields, edges to Collection) and run go generate.
- **Blocked by:** _(none — ready to start)_

### A2 — LinkedAccount Proto Messages + RPC Definitions
- **ID:** `64c785c4-d9ed-457d-9e89-edb109ae2935`
- **Stage:** ready | **Priority:** HIGH | **Type:** task
- **Labels:** backend, proto, phase-a
- **Scope:** Add CreateLinkedAccount/GetLinkedAccount/DeleteLinkedAccount proto messages and RPC definitions.
- **Blocked by:** _(none — ready to start)_

### A3 — Collection remote_data Ent Schema Field
- **ID:** `30e075e3-e08b-4fbe-be39-c766a5824042`
- **Stage:** ready | **Priority:** HIGH | **Type:** task
- **Labels:** backend, schema, phase-a
- **Scope:** Add remote_data JSON field to Collection Ent schema; wire through store and proto conversion.
- **Blocked by:** _(none — ready to start)_

### A4 — LinkedAccount Store Methods
- **ID:** `a21e4cd8-78ec-4b49-ad2f-a8bbe155928d`
- **Stage:** triage | **Priority:** HIGH | **Type:** task
- **Labels:** backend, phase-a
- **Scope:** Add CRUD store methods (Create/Get/Delete/List) for LinkedAccount entity on EntStore.
- **Blocked by:** A1 (LinkedAccount Ent Schema + Code Generation)

### A5 — LinkedAccount Server RPC Handlers
- **ID:** `6f5eda13-1de7-46fd-b039-26477f4078d3`
- **Stage:** triage | **Priority:** HIGH | **Type:** task
- **Labels:** backend, phase-a
- **Scope:** Implement gRPC handlers for LinkedAccount CRUD; add linkedAccountToProto conversion (omitting auth_token).
- **Blocked by:** A2 (LinkedAccount Proto Messages + RPC Definitions); A4 (LinkedAccount Store Methods)

### A6 — MultiStore Implementation
- **ID:** `5bf94ba9-d1b8-4212-a667-f015f083fe99`
- **Stage:** ready | **Priority:** HIGH | **Type:** task
- **Labels:** backend, phase-a
- **Scope:** Implement MultiStore wrapping EntStore, routing task/comment ops by collection platform, shared ops to primary.
- **Blocked by:** _(none — ready to start)_

### A7 — CLI: ft collection link/unlink Commands
- **ID:** `b4ac342d-f79e-4166-a51b-abb900c092ab`
- **Stage:** triage | **Priority:** NORMAL | **Type:** task
- **Labels:** cli, phase-a
- **Scope:** Add `ft collection link <platform>` and `ft collection unlink` CLI subcommands for credential management.
- **Blocked by:** A5 (LinkedAccount Server RPC Handlers)

### A8 — Server Startup: MultiStore Wiring
- **ID:** `a2e14f78-510e-4117-bbac-f44c829f3d9e`
- **Stage:** triage | **Priority:** HIGH | **Type:** task
- **Labels:** backend, phase-a
- **Scope:** Replace bare EntStore with MultiStore in server main.go; no-op when no platform stores registered.
- **Blocked by:** A6 (MultiStore Implementation); A4 (LinkedAccount Store Methods)

---

## Phase B: Server-Side Passthrough (External Tasks on Board)
**Parent ID:** `1dfc4376-9dac-47af-96fa-4df24dcd7714`

### B1 — Passthrough Store Constructor Enhancement
- **ID:** `cf005010-96f6-47a6-8b38-bda05d89aa59`
- **Stage:** ready | **Priority:** HIGH | **Type:** task
- **Labels:** backend, phase-b
- **Scope:** Change NewPassThroughStore to accept collectionID as parameter instead of generating deterministic UUID.
- **Blocked by:** _(none — ready to start)_

### B2 — taskToProto Platform Awareness
- **ID:** `76ce6710-31ae-42a4-ab54-5ced1762f6dc`
- **Stage:** ready | **Priority:** HIGH | **Type:** task
- **Labels:** backend, phase-b
- **Scope:** Fix taskToProto in convert.go to derive platform from task/collection instead of hardcoding PLATFORM_FARMTABLE.
- **Blocked by:** _(none — ready to start)_

### B3 — MultiStore Lazy Platform Registration
- **ID:** `d3657b64-99db-4a58-8ee5-fa9c0e7d2dcb`
- **Stage:** triage | **Priority:** HIGH | **Type:** task
- **Labels:** backend, phase-b
- **Scope:** Add lazy passthrough store construction in MultiStore from linked account credentials on first request.
- **Blocked by:** A6 (MultiStore Implementation); A4 (LinkedAccount Store Methods); B1 (Passthrough Store Constructor Enhancement)

### B4 — WatchTasks External Collection Guard
- **ID:** `6c64627f-4103-404f-bc86-f433b0856a34`
- **Stage:** triage | **Priority:** NORMAL | **Type:** task
- **Labels:** backend, phase-b
- **Scope:** Return codes.Unimplemented from WatchTasks for external-platform collections with descriptive message.
- **Blocked by:** B3 (MultiStore Lazy Platform Registration)

### B5 — Unimplemented Operation Guards for Passthrough
- **ID:** `3036ff12-0a24-44fe-b107-98fac4559f07`
- **Stage:** ready | **Priority:** NORMAL | **Type:** task
- **Labels:** backend, phase-b
- **Scope:** Replace silent empty returns/panics with clear error returns for unsupported Store methods on passthrough.
- **Blocked by:** _(none — ready to start)_

### B6 — UI: Collection Selector Dropdown
- **ID:** `6dfd072e-08ee-4fa8-a7b2-47327e1dc418`
- **Stage:** triage | **Priority:** NORMAL | **Type:** story
- **Labels:** frontend, phase-b
- **Scope:** Add sl-select dropdown in toolbar to switch collections; update URL param and reload tasks on change.
- **Blocked by:** B3 (MultiStore Lazy Platform Registration)

### B7 — UI: Read-Only Mode for External Collections
- **ID:** `b8870185-1a8e-4800-b1d9-cc9aa4ba345d`
- **Stage:** triage | **Priority:** NORMAL | **Type:** story
- **Labels:** frontend, phase-b
- **Scope:** Disable edit controls (create, drag, inline edit, comments) for external collections; show read-only badge.
- **Blocked by:** B6 (UI: Collection Selector Dropdown)

### B8 — UI: Poll-on-Interval Refresh
- **ID:** `482ab7a5-2144-43ee-b725-7c473649a9db`
- **Stage:** triage | **Priority:** NORMAL | **Type:** story
- **Labels:** frontend, phase-b
- **Scope:** Replace WatchTasks with setInterval polling for external collections; add manual Refresh button.
- **Blocked by:** B4 (WatchTasks External Collection Guard); B6 (UI: Collection Selector Dropdown)

### E1 — End-to-End Passthrough Integration Test
- **ID:** `d8546e00-809c-4246-9221-363d24a6b25e`
- **Stage:** triage | **Priority:** NORMAL | **Type:** task
- **Labels:** backend, test, phase-b
- **Scope:** E2E test: create GitHub collection + linked account → ListTasks via passthrough → verify platform/remote_id.
- **Blocked by:** A8 (Server Startup: MultiStore Wiring); B3 (MultiStore Lazy Platform Registration); B4 (WatchTasks External Collection Guard)

---

## Phase C: Ephemeral SQLite + Graph Queries
**Parent ID:** `7cea968e-2e00-4936-8972-6bf84a462eb0`

### C1 — EphemeralStorePool Implementation
- **ID:** `08f0bb13-d234-4439-9b74-e7e4f8e682de`
- **Stage:** ready | **Priority:** NORMAL | **Type:** task
- **Labels:** backend, phase-c
- **Scope:** Pool of pre-migrated in-memory SQLite EntStore instances; Get/Return/Truncate lifecycle.
- **Blocked by:** _(none — ready to start)_

### C2 — collectionSupportsGraph Setting Check
- **ID:** `0c565a20-cf7b-4ded-a391-d241b25ab813`
- **Stage:** triage | **Priority:** NORMAL | **Type:** task
- **Labels:** backend, phase-c
- **Scope:** Function checking collection.remote_data["graph_queries"] with platform-based defaults (github=true, asana=false).
- **Blocked by:** A3 (Collection remote_data Ent Schema Field)

### C3 — Graph Query Routing for External Collections
- **ID:** `2509b00c-d516-45c8-a6da-eb21044e9e5e`
- **Stage:** triage | **Priority:** NORMAL | **Type:** task
- **Labels:** backend, phase-c
- **Scope:** Modify 4 graph query handlers to detect external collections and route through ephemeral SQLite path.
- **Blocked by:** C1 (EphemeralStorePool Implementation); C2 (collectionSupportsGraph Setting Check); B3 (MultiStore Lazy Platform Registration)

### C4 — Graph Query Integration Test
- **ID:** `25d176ca-fc4b-4e30-a4ed-1175e69796a9`
- **Stage:** triage | **Priority:** NORMAL | **Type:** task
- **Labels:** backend, test, phase-c
- **Scope:** Integration test: mock passthrough data → ephemeral SQLite → graph queries → verify results + isolation.
- **Blocked by:** C3 (Graph Query Routing for External Collections)

---

## DAG Summary

### Ready Tasks (no unresolved blockers — can start immediately)

1. **A1 — LinkedAccount Ent Schema + Code Generation** (`7d83974b`) — HIGH — Create LinkedAccount Ent entity schema (fields, edges to Collection) and run go generate.
2. **A2 — LinkedAccount Proto Messages + RPC Definitions** (`64c785c4`) — HIGH — Add CreateLinkedAccount/GetLinkedAccount/DeleteLinkedAccount proto messages and RPC definitions.
3. **A3 — Collection remote_data Ent Schema Field** (`30e075e3`) — HIGH — Add remote_data JSON field to Collection Ent schema; wire through store and proto conversion.
4. **A6 — MultiStore Implementation** (`5bf94ba9`) — HIGH — Implement MultiStore wrapping EntStore, routing task/comment ops by collection platform.
5. **B1 — Passthrough Store Constructor Enhancement** (`cf005010`) — HIGH — Change NewPassThroughStore to accept collectionID as parameter.
6. **B2 — taskToProto Platform Awareness** (`76ce6710`) — HIGH — Fix taskToProto to derive platform from task/collection instead of hardcoding PLATFORM_FARMTABLE.
7. **B5 — Unimplemented Operation Guards for Passthrough** (`3036ff12`) — NORMAL — Replace silent empty returns/panics with clear error returns for unsupported Store methods.
8. **C1 — EphemeralStorePool Implementation** (`08f0bb13`) — NORMAL — Pool of pre-migrated in-memory SQLite EntStore instances; Get/Return/Truncate lifecycle.

### Critical Path
```
A1 (Schema) → A4 (Store) → A5 (RPC Handlers) → A7 (CLI link/unlink)

A6 (MultiStore) ─┐
A4 (Store) ──────┤→ A8 (Server Startup)
                  │
A6 (MultiStore) ─┤
A4 (Store) ──────┤→ B3 (Lazy Registration) → B4 (WatchTasks Guard)
B1 (Constructor) ┘                          → B6 (Collection Selector)
                                                → B7 (Read-Only Mode)
                                                → B8 (Poll Refresh)

C1 (Pool) ───┐
C2 (Setting) ┤→ C3 (Graph Routing) → C4 (Graph Test)
B3 ───────────┘
```

### Parallel Waves

| Wave | Tasks | Blocked By |
|------|-------|-----------|
| 1 | A1, A2, A3, A6, B1, B2, B5, C1 | _(none)_ |
| 2 | A4 | A1 |
| 3 | A5, A8, C2 | A2+A4, A6+A4, A3 |
| 4 | A7, B3 | A5, A6+A4+B1 |
| 5 | B4, B6, E1 | B3, B3, A8+B3+B4 |
| 6 | B7, B8, C3 | B6, B4+B6, C1+C2+B3 |
| 7 | C4 | C3 |

### Task Count by Status

| Status | Count | Tasks |
|--------|-------|-------|
| Ready (no blockers) | 8 | A1, A2, A3, A6, B1, B2, B5, C1 |
| Blocked (has unresolved deps) | 13 | A4, A5, A7, A8, B3, B4, B6, B7, B8, E1, C2, C3, C4 |
| Phase parents (tracking only) | 3 | Phase A, Phase B, Phase C |

### Note on API Relationship Display

The Farmtable API returns bidirectional relationship views — when task B is BLOCKED_BY task A, task A's `source_relationships` also shows a link to B. The "Blocked by" fields in this report reflect the **intended design dependency direction** (which task must complete first), not the raw API output. The underlying DAG structure is correct as verified by `ft task ready` (8 ready) and `ft task blocked` (13 blocked).
