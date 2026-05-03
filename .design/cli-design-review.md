# Farm Table — CLI Design Review

**Date:** 2026-05-03
**Scope:** Review of `cli-design.md` v0.1.0 against product decisions and agent ergonomics.

---

## 1. Strengths

### Stage-driven status updates
Agents set `--stage working`, not `--phase IN_PROGRESS --stage working`. The CLI resolves phase automatically from the phase-stage mapping. This eliminates invalid-state bugs and validates the three-tier status model as ergonomic in practice, not just theoretically clean.

### `ft task claim` as a first-class command
Atomic claim is the most important coordination primitive for multi-agent systems. Making it a dedicated command (rather than two-step `update --assignee me && update --stage working`) ensures atomicity, provides clear error semantics for race conditions (exit code 5, CONFLICT/ALREADY_CLAIMED with current assignee and stage in the error body), and makes the operation self-documenting.

### `ft graph` as a separate command group
Clean separation of CRUD from graph traversal. `critical-path` and `bottlenecks` commands are explicitly marked as built-in-backend-only, implementing the "works everywhere, built-in backend unlocks more" framing at the CLI level.

### Exit codes
10 distinct codes covering every failure mode an agent needs to handle programmatically. Agents can branch on exit code alone without parsing JSON: auth (3), not-found (4), conflict (5), validation (6), permission (7), server (8), platform (9). Well-designed for non-interactive agent consumption.

### Stdout vs stderr separation
Structured data (JSON, JSONL, table, IDs) on stdout. Progress messages, warnings, verbose logs, and human-readable error context on stderr. Agents parse stdout only. This is an easy thing to get wrong.

### Workflow patterns section
Walking through real agent scenarios as bash scripts (pick up and complete a task, manager assigns work, agent encounters a blocker, create subtasks) validates that the command surface covers actual agent needs end-to-end.

### JSON as default output
Primary users are coding agents. Agents parse JSON natively. Making JSON the default eliminates a flag from the vast majority of invocations.

### `--reason` on mutating commands
Supports the "auditable by construction" principle. Agents can explain *why* they made a change in the audit trail, not just *what* they changed.

---

## 2. Refinements Recommended

### 2.1 `ft graph ready` vs `ft task list --stage ready` — potential confusion

Both return tasks with stage `ready`. The key difference is that `graph ready` checks that blockers are resolved. An agent who doesn't know about the `graph` command group might use `task list --stage ready` and get tasks that are actually still blocked.

**Recommendation:** Add an explicit note in the `task list` documentation: "For dependency-aware ready tasks, use `ft graph ready`. `task list --stage ready` does not check blocker resolution." Alternatively, consider a `--check-blockers` flag on `task list`.

### 2.2 `--add-pr` flag format is fragile

Current format: `--add-pr "https://github.com/org/repo/pull/42,open"` — comma-delimited positional values in a single flag. Fragile if URLs contain commas.

**Options:**
- Two flags: `--add-pr-url ... --add-pr-status open`
- Structured format: `--add-pr url=...,status=open`
- JSON: `--add-pr '{"url":"...","status":"open"}'`

**Recommendation:** Decide before proto derivation, since this affects the RPC request message shape.

### 2.3 No explicit "release" or "unclaim" command

If an agent can't finish a task, it must `ft task update --assignee none --stage ready`. A dedicated `ft task release <id>` (inverse of `claim`) would be:
- More discoverable
- Could enforce business logic (auto-comment, policy-based stage reset)
- Symmetrical with `claim`

**Recommendation:** Consider for v1.1. Document the `update` workaround in the workflow patterns for v1.

### 2.4 `--fields` projection flag may be premature

`--fields` on `task list` and `task get` introduces projection complexity in both the proto definition and the agent's mental model. The compact vs. full distinction already handles the common case.

**Recommendation:** Consider deferring to v1.1. If agents need minimal output, `--output quiet` covers the ID-only case.

---

## 3. Missing Capabilities (minor gaps)

### 3.1 Health check / server status

No command to check server reachability or platform connection health. Something like `ft ping` or `ft status` would let agents validate their environment at startup ("can I reach Farm Table? are the integrations I need connected?").

**Recommendation:** Add `ft status` that reports server version, connection health, and connected platform status.

### 3.2 Request IDs / tracing

When an agent gets a `PLATFORM_ERROR`, it needs to report the issue. Including a request ID or trace ID in every response's metadata (visible in `--verbose` output and included in error JSON) would make debugging significantly easier.

**Recommendation:** Add `request_id` to all JSON response envelopes (or at minimum to error responses).

### 3.3 Collection-scoped configuration

The config supports one `default_collection`, but agents working across collections might want per-directory or per-repo defaults (similar to git's local/global config hierarchy).

**Recommendation:** Not blocking for v1. Ensure the config design allows hierarchical overrides later (e.g., a `.farmtable.toml` in the repo root).

---

## 4. Assessment

The CLI design is ready to drive proto derivation. The command surface is complete for v1, the workflow patterns validate the design, and the error handling is well thought out. The issues raised above are refinements, not structural problems. Items in section 2 should be reviewed before proto work; items in section 3 can be addressed incrementally.
