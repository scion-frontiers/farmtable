# Top 10 GitHub Issues for Next Round of Work

**Date:** 2026-07-19
**Author:** Investigator agent
**Source:** All 43 open issues on `scion-frontiers/farmtable`, cross-referenced against the 25 shipped features (loop-log.md), in-flight export/import design, and queued suggestions in projects.md.

---

## Methodology

- 43 open issues total; 12 are milestone/stream tracking meta-issues (not actionable on their own) — excluded.
- 1 issue (#45) is an operational blocker requiring human action on GitHub App permissions — excluded from ranking but noted as a dependency.
- Export/Import is already in progress (architect design complete) — excluded.
- Remaining 30 substantive issues evaluated on: clarity of scope, user-facing value, effort/risk, dependency chains, and fit for the proven UI-improvement-loop workflow (or similar contained CLI work).

---

## Ranked Top 10

### 1. [#41 — Web: Rightmost kanban stage column clips at 1440px viewport](https://github.com/scion-frontiers/farmtable/issues/41)

**What it asks for:** At 1440px viewport width, the rightmost Kanban stage column header text is truncated (e.g., "IN" instead of "IN QA"). Needs horizontal scroll or responsive columns.

**Rationale:** Active bug in the deployed web dashboard. Pure CSS/layout fix in the frontend — exactly the type of contained UI work the loop has been executing successfully (25 features merged). No backend changes, no dependencies. Fixes a visible defect that users encounter on common laptop resolutions. **Effort: XS.**

---

### 2. [#28 — Remove ft task delete command](https://github.com/scion-frontiers/farmtable/issues/28)

**What it asks for:** Remove `ft task delete` from the CLI. Close should be the terminal state; delete is not a meaningful operation in a work tracker (no major platform exposes it).

**Rationale:** XS scope with specific files already identified (`internal/cli/task.go`, `internal/server/server.go`, `proto/farmtable.proto`). The RPC already returns `codes.Unimplemented`. Improves cross-platform compatibility and simplifies the API surface. Zero dependencies. Clean, low-risk code removal. **Effort: XS.**

---

### 3. [#42 — FR: ft task search — full-text search on task descriptions](https://github.com/scion-frontiers/farmtable/issues/42)

**What it asks for:** `ft task search <query>` for full-text search across task names and descriptions. Currently requires `ft task list --limit 100` piped through external JSON filtering.

**Rationale:** High dogfooding utility — the coordinator identified this need while analyzing the task graph. v1 can be simple LIKE queries on name/description (no FTS5 index needed initially). Contained CLI command addition, respects existing pagination/format flags. Identified from real usage during the project. **Effort: S/M.**

---

### 4. [#30 — CLI-7: Shell completions (bash/zsh/fish)](https://github.com/scion-frontiers/farmtable/issues/30)

**What it asks for:** `ft completion bash/zsh/fish` for shell tab completion.

**Rationale:** Cobra (the CLI framework farmtable uses) has built-in `GenBashCompletion`/`GenZshCompletion`/`GenFishCompletion` support — this is largely wiring, not novel implementation. High usability value for anyone using the CLI regularly. No dependencies. Standard pattern across Go CLI tools. **Effort: S.**

---

### 5. [#31 — CLI-8: ft task batch — bulk JSONL create/update](https://github.com/scion-frontiers/farmtable/issues/31)

**What it asks for:** Bulk JSONL create/update for agent plan decomposition — read a stream of JSON task objects and create/update them in batch.

**Rationale:** High value for the agent workflow use case (farmtable's core audience). Agents decomposing plans into tasks currently must call `ft task create` N times sequentially. A batch command is both faster and enables atomic plan decomposition. Well-defined CLI pattern (read stdin/file, call RPCs). **Effort: M.**

---

### 6. [#33 — DOC-3: API reference (proto-generated)](https://github.com/scion-frontiers/farmtable/issues/33)

**What it asks for:** Auto-generated API reference documentation from the proto definitions.

**Rationale:** No upstream dependencies (proto already exists). Important for open-source readiness and for any external integrator. Can use standard tooling (`protoc-gen-doc`, `buf generate`). The proto surface is stable enough after 25+ features that the docs won't immediately go stale. **Effort: M.**

---

### 7. [#34 — MISC-1: Collection-scoped configuration (.farmtable.toml)](https://github.com/scion-frontiers/farmtable/issues/34)

**What it asks for:** Per-repo defaults via `.farmtable.toml` — set default collection, server address, etc. at the project level.

**Rationale:** Enables a more natural per-project workflow without repeating `--server`/`--collection` flags. Small, self-contained feature. Also unblocks #37 (Multi-project config) later. Familiar pattern from tools like `.goreleaser.yaml`, `.eslintrc`. **Effort: S.**

---

### 8. [#43 — FR: ft task tree — subtree visualization with dependency context](https://github.com/scion-frontiers/farmtable/issues/43)

**What it asks for:** Enhance `ft task tree` with `--show-deps` (cross-stream dependency annotations), `--show-completed`, and `--depth` flags.

**Rationale:** The underlying RPC (`GetDependencyTree`) already exists — this is primarily CLI output formatting and flag wiring. Identified from real dogfooding needs (coordinator reasoning about graph insertion). Contained CLI enhancement. Pairs well with #44 (dependency queries). **Effort: S/M.**

---

### 9. [#44 — FR: Cross-stream dependency queries](https://github.com/scion-frontiers/farmtable/issues/44)

**What it asks for:** `ft task deps <scope-id>` to show all external dependencies (inbound/outbound) for tasks in a given scope.

**Rationale:** Graph query + presentation feature — the relationship data already exists in the store. High coordination utility (identified from real dogfooding). Could be a new command or a flag on `ft task tree`. Pairs naturally with #43. **Effort: S/M.**

---

### 10. [#12 — INFRA-1: CI pipeline (GitHub Actions)](https://github.com/scion-frontiers/farmtable/issues/12)

**What it asks for:** Test + build + release pipeline via GitHub Actions.

**Rationale:** Critical for project maturity and a prerequisite for the entire INFRA chain (#13 goreleaser, #21 Docker, #22 deployment guide, #29 Helm). However, **this is currently blocked by #45** — the GitHub App token lacks `workflows` permission to push to `.github/workflows/`. Requires human action (ptone@google.com granting the permission scope or manually pushing the workflow files). Included at #10 because of its strategic importance, with the caveat that #45 must be unblocked first. **Effort: M (but blocked).**

---

## Considered but Excluded

| Issue | Title | Why excluded |
|-------|-------|-------------|
| #14, #15, #23 | Linear / Jira / Asana integrations | Size L each, complex adapter design, bidirectional sync. Not the contained-feature pattern this loop handles well. |
| #20 | Full URI support for tasks | Design-level architectural change (configurable base URL, proto field additions, reverse lookup endpoint). Needs architect design before implementation. |
| #24 | Webhook ingestion framework | Size L, complex infrastructure. Blocks #35 and #39 but is itself a large foundational piece. |
| #35 | ft watch (gRPC streaming) | Depends on #24 (webhook framework). Can't start until that ships. |
| #36 | SQLite to Postgres migration | Size M, backend-heavy infrastructure. Less immediate user-facing value compared to ranked items. |
| #37 | Multi-project config | Depends on #34 (MISC-1). Evaluate after #34 ships. |
| #38 | Field-level conflict resolution | Size M, complex reconciliation logic. Important but lower urgency than the ranked items. |
| #39, #40 | Event observability / Linked-account management | Both depend on unshipped infrastructure (#24 webhooks, platform integration layer). |
| #13, #21, #22, #29 | Goreleaser / Docker / Deploy guide / Helm | All transitively blocked by #12, which is blocked by #45. Unblock #45 first. |
| #16, #17, #26 | README / Agent guide / Adapter guide | All depend on upstream features (AUTH-1, INFRA-2, MCP-1, or a completed integration). |
| #25 | Integration test harness | Depends on at least one integration being complete. |
| #32 | Cursor/Codex/Devin skills | Depends on MCP-2 (pattern established). |
| #45 | GitHub App workflows permission | Operational blocker, not a feature. Requires human action to grant the permission scope. |
| #3-#11, #18-#19, #27 | Stream/Milestone tracking issues | Meta-issues tracking groups of work, not actionable features themselves. |

## Notes

- **Export/Import** is already in progress (architect design at `design-export-import.md` is complete and ready for implementation) — not included since it's already in flight.
- **Queued developer suggestions** (URL routing for phase filters, component tests for inspector comments) are tracked in `projects.md` but don't have corresponding GitHub issues — not evaluated here.
- Items #1-#5 and #8-#9 are the best candidates for the UI improvement loop specifically (#41 is pure frontend; the rest are CLI/backend but still contained).
- The **INFRA chain** (#45 -> #12 -> #13 -> #21 -> #22 -> #29) is the most significant blocked dependency chain. Unblocking #45 (human action) would unlock substantial project-maturity work.
